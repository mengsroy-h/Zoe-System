const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { moduleRuntime, memoryStorage } = require('./react-view');

const ROOT = process.env.RAWREAD_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

function sliceBalanced(src, startIdx, open, close) {
    let depth = 0, i = startIdx;
    for (; i < src.length; i++) {
        if (src[i] === open) depth++;
        else if (src[i] === close) { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
    }
    throw new Error('unbalanced');
}

function extractFn(src, name) {
    const m = src.indexOf('function ' + name + '(');
    if (m === -1) return '';
    const braceAt = src.indexOf('{', m);
    return 'function ' + name + '(' + src.slice(src.indexOf('(', m) + 1, braceAt).replace(/\)\s*$/, '') + ')' +
        sliceBalanced(src, braceAt, '{', '}');
}

function extractArrow(src, anchor, argName) {
    const at = src.indexOf(anchor);
    if (at === -1) throw new Error('anchor not found: ' + anchor);
    const braceAt = src.indexOf('{', at + anchor.length - 1);
    return 'function (' + argName + ') ' + sliceBalanced(src, braceAt, '{', '}');
}

// ⛔ ជ្រើសប្លុកតាម **ខ្លឹមសារ** (ប្លុកដែល normalize barcode) មិនមែនតាមលំដាប់ ៖ `deletedItems.forEach` មានច្រើនកន្លែង
//    (ការ purge ធុងសំរាមក៏ដើរតាមវា) ហើយលំដាប់ module ប្រែ ➜ «ទី ១» មិនមែនអត្តសញ្ញាណ។
function extractTrashNormalizer(src) {
    const anchor = 'deletedItems.forEach(item => {';
    for (let at = src.indexOf(anchor); at !== -1; at = src.indexOf(anchor, at + 1)) {
        const braceAt = src.indexOf('{', at + anchor.length - 1);
        const body = sliceBalanced(src, braceAt, '{', '}');
        if (/normalizeBarcodesOf\(item\)/.test(body)) return body;
    }
    throw new Error('trash normalizer anchor not found');
}

async function makeCtx(src, options, closePlan) {
    const protocol = moduleRuntime(ROOT, src, ['src/core/storage-keys.ts', 'src/core/shop-scope.ts', 'src/domain/barcode.ts', 'src/domain/pickup.ts']);
    const storage = memoryStorage({ zoew_firebase_config: JSON.stringify({ databaseURL: 'https://raw-read-shape.invalid' }) });
    const ctx = {
        console, options,
        db: {}, authGeneration: 0,
        auth: { currentUser: { uid: 'raw-read-user' } }, isInitializingFirebase: false,
        appLocalStore: storage, dataState: { pickupPendingVersion: 0 },
        dbOp: (promise) => promise, txRestUrl: () => '', showToast: () => {},
        getFormattedDate: () => '2026-10-19',
        __pickupAdds: [],
        getServerNow: () => 1700000000000,
        parseTimestampFromId: () => 1700000000000,
        ABANDON_AGE_MS: 7 * 24 * 60 * 60 * 1000,
        TWO_HOURS_MS: 2 * 60 * 60 * 1000
    };
    ctx.fb = {
        ref: (_database, raw) => ({ path: raw }),
        get: async () => ({ val: () => ({ pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 }) }),
        runTransaction: () => { throw new Error('raw-read-shape: unexpected ledger write'); }
    };
    vm.createContext(ctx);
    vm.runInContext("var SCANNER_LOOKUP_BARCODE_INDEX_FIELD = '__zoeScannerLookupIndex';", ctx);
    vm.runInContext('var deletedItems = []; var activeRestoreClaims = new Map(); var dbListenerPendingPaths = new Set(); const DB_LISTENER_KEY_DELETED = "deleted";', ctx);
    for (const fn of ['barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState', 'barcodeSignIdentity',
                      'itemHasRestoreMarkers', 'isActiveRestoreClaim', 'dropStaleRestoreMarkers',
                      'getPickupPhoneKey', 'barcodeRegistryKey', 'pickupBarcodeKey', 'collectPickupMarks',
                      'safeStoreGet', 'safeStoreSet', 'safeStoreRemove', 'generateUniqueId']) {
        const code = extractFn(src, fn);
        if (code) vm.runInContext(protocol.withoutBindings(code), ctx);
    }
    for (const name of ['txCanonical', 'txSameValue']) {
        const code = extractFn(src, name);
        if (!code) throw new Error('raw-read-shape: missing actual function ' + name);
        vm.runInContext(protocol.withoutBindings(code), ctx);
    }
    vm.runInContext(protocol.code, ctx);
    const database = ctx.db;
    ctx.pickupJournal = ctx.pickupIntentTracker(() => ctx.db === database && ctx.authGeneration === 0, 'i1');
    const codes = closePlan ? (closePlan.whole ? ['AAA', 'BBB'] : ['BBB']) : ['AAA', 'BBB'];
    ctx.pickupContext = await ctx.pickupJournal.prepare(ctx.getFormattedDate(), codes.map(ctx.pickupBarcodeKey));
    const started = closePlan ? ctx.pickupJournal.startClose(closePlan.item, true, closePlan.whole) : ctx.pickupJournal.start();
    const entry = ctx.readPickupJournal().find(candidate => candidate.id === ctx.pickupContext?.intent);
    ok(started && entry?.stage === 'started' && entry.scope === ctx.liveShopScope() && entry.uid === ctx.auth.currentUser.uid
        && entry.pickupResetEpoch === 0 && entry.keys.length === codes.length,
        'fixture ➜ journal ពិតបាន admission និង start មុន transaction callback', entry);
    if (closePlan) ok(ctx.pickupClosePlanValid(entry) && entry.closePlan.whole === closePlan.whole
        && entry.closePlan.desiredClosed === true && entry.closePlan.targets.length === codes.length,
        'fixture ➜ startClose រក្សាផែនការពិតមុន transaction callback', entry);
    const add = ctx.pickupJournal.add;
    ctx.pickupJournal.add = (date, keys) => {
        ctx.__pickupAdds.push({ date, keys: [...keys] });
        return add(date, keys);
    };
    const applyClose = ctx.pickupJournal.applyClose;
    ctx.__closePlanCalls = [];
    ctx.pickupJournal.applyClose = (item) => {
        const result = applyClose(item);
        ctx.__closePlanCalls.push(result && result.kind);
        return result;
    };
    vm.runInContext('function normalizeTrashItem(item) ' + extractTrashNormalizer(src)
        .replace('runAutomaticDeletedCleanup();', '').replace('refreshNotifyRemovedView();', ''), ctx);
    // ⛔ យុថ្កាដែលរកមិនឃើញ ➜ `indexOf` ត្រឡប់ -1 ➜ `sliceBalanced` កាត់កូដ
    // **ខុសកន្លែងទាំងស្រុង** ➜ ការធ្លាក់គ្មានឈ្មោះដែលចំណាយពេលដេញតាមយូរ
    // (មេរៀន «ការធ្លាក់ក្លែងក្លាយ» — សំណួរទី ១១)។ ត្រូវធ្លាក់ដោយមានឈ្មោះជំនួស។
    const anchorWhole = 'closeTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {';
    const anchorOne = 'closeTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`), (currentItem) => {';
    if (src.indexOf(anchorWhole) === -1 || src.indexOf(anchorOne) === -1) {
        throw new Error('raw-read-shape: រកយុថ្កា transaction មិនឃើញក្នុង app.js ➜ '
            + 'ការស្រង់នឹងកាត់កូដខុសកន្លែង។ ត្រូវធ្វើបច្ចុប្បន្នភាពយុថ្កាក្នុងឯកសារនេះ។');
    }
    const bodyAt = (anchor) => src.indexOf(anchor) + anchor.length - 1;
    const ast = require('acorn').parse(src, { ecmaVersion: 'latest' });
    for (const [name, sourceName, anchor] of [
        ['toggleWholeTx', 'toggleCloseStatus', anchorWhole],
        ['toggleOneTx', 'applyBarcodeCloseChange', anchorOne]
    ]) {
        const fn = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === sourceName);
        const captures = ['closeAuthGeneration', 'closeDatabase', 'closeIsCurrent', ...(sourceName === 'applyBarcodeCloseChange' ? ['opts'] : ['closeChangeOf', 'applyWholeClose', 'localMarkedKeys', 'wholeCloseMarks'])];
        const declarations = captures.map(name => fn && fn.body.body.find(node => node.type === 'VariableDeclaration'
            && node.declarations.some(declaration => declaration.id.name === name)));
        if (declarations.some(node => !node)) throw new Error('raw-read-shape: missing actual close session capture in ' + sourceName);
        // ស្រង់ closure ពិតមុនហៅ callback; ការប្តូរ auth/db ត្រូវវាស់ guard ពិត។
        vm.runInContext('globalThis.' + name + ' = (() => {\n' +
            [...new Set(declarations)].map(node => src.slice(node.start, node.end)).join('\n') +
            '\nreturn function (currentItem) ' + sliceBalanced(src, bodyAt(anchor), '{', '}') + ';\n})();', ctx);
    }
    return ctx;
}

// the three shapes RTDB hands back for the SAME stored array
const DENSE = () => ([{ code: 'AAA', createdAt: 1000, cod: 5, dod: 1, isClosed: false }, { code: 'BBB', createdAt: 1000, cod: 7, dod: 2, isClosed: false }]);
const WITH_NULLS = () => ([{ code: 'AAA', createdAt: 1000, cod: 5, dod: 1, isClosed: false }, null, { code: 'BBB', createdAt: 1000, cod: 7, dod: 2, isClosed: false }]);
const OBJECT_GAPS = () => ({ '0': { code: 'AAA', createdAt: 1000, cod: 5, dod: 1, isClosed: false }, '2': { code: 'BBB', createdAt: 1000, cod: 7, dod: 2, isClosed: false } });

const SHAPES = [['array ដែលមាន null', WITH_NULLS], ['object ដែលមាន gap', OBJECT_GAPS]];

function checkReceipts(ctx, item, codes, label) {
    const entry = ctx.readPickupJournal().find(candidate => candidate.id === ctx.pickupContext?.intent);
    const barcodes = Object.values(item.barcodes || {}).filter(Boolean);
    ok(codes.every(code => {
        const barcode = barcodes.find(candidate => candidate.code === code);
        const proof = barcode?.pickupTransition;
        return proof && proof.intent === entry?.id && proof.actorUid === entry.uid && proof.scope === entry.scope
            && proof.scanDate === item.scanDate && proof.itemId === item.id && proof.epoch === 0
            && proof.code === code && proof.birth === 1000 && proof.restored === 0 && proof.closed === true
            && proof.closedAt === ctx.getServerNow() && proof.changes === codes.length;
    }) && barcodes.filter(barcode => barcode.pickupTransition).length === codes.length,
    label + ' ➜ receipt ពិតគ្រប់ barcode ដែលបានប្តូរ និងភ្ជាប់ journal/scope/វគ្គកញ្ចប់', barcodes);
    const recovered = entry && ctx.pickupTransitionProofKeys(entry, [item], []);
    ok(Array.isArray(recovered) && JSON.stringify([...recovered].sort()) === JSON.stringify(codes.map(ctx.pickupBarcodeKey).sort()),
        label + ' ➜ recovery verifier ពិតទទួល receipt នោះ', recovered);
}

(async () => {
for (const app of ['ZoeW']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    let ctx = await makeCtx(src);

    console.log('\n=== ' + app + ' — normalizer នៃធុងសំរាម (dbRefDeleted) ===');
    for (const [label, make] of SHAPES) {
        const item = { id: 't1', cod: 12, dod: 3, count: 2, barcodes: make(), isFromDeletion: false };
        let threw = null;
        try { ctx.normalizeTrashItem(item); } catch (e) { threw = e; }
        ok(!threw, label + ' ➜ មិន throw', threw && threw.message);
        ok(Array.isArray(item.barcodes), label + ' ➜ ក្លាយជា array ពិត (ការស្តារពឹងលើ Array.isArray)', item.barcodes);
        ok(Array.isArray(item.barcodes) && item.barcodes.length === 2,
            label + ' ➜ រក្សា barcode ទាំង ២ (លុយត្រូវបានបន្ថែមមកវិញតាមវា)', item.barcodes && item.barcodes.length);
    }
    const denseTrash = { id: 't0', barcodes: DENSE() };
    ctx.normalizeTrashItem(denseTrash);
    ok(denseTrash.barcodes.length === 2, 'array ធម្មតា ➜ មិនប្រែ', denseTrash.barcodes.length);

    console.log('\n=== ' + app + ' — transaction បិទការបញ្ជាទិញទាំងមូល ===');
    for (const [label, make] of SHAPES) {
        ctx = await makeCtx(src);
        const item = { id: 'i1', scanDate: ctx.getFormattedDate(), isClosed: false, barcodes: make() };
        let threw = null;
        try {
            vm.runInContext('var desiredClosed = true;', ctx);
            ctx.__pickupAdds.length = 0;
            ctx.toggleWholeTx(item);
        } catch (e) { threw = e; }
        ok(!threw, label + ' ➜ មិន throw', threw && threw.message);
        ok(ctx.__pickupAdds.length === 1 && ctx.__pickupAdds[0].keys.length > 0, label + ' ➜ callback ផ្តល់កូនសោ pickup ទៅ admission boundary ពិត', ctx.__pickupAdds);
        const list = Array.isArray(item.barcodes) ? item.barcodes : Object.values(item.barcodes || {});
        ok(list.length === 2 && list.every(b => b && b.isClosed === true),
            label + ' ➜ barcode ទាំងអស់ត្រូវបានបិទពិត', list);
        checkReceipts(ctx, item, ['AAA', 'BBB'], label);
    }

    console.log('\n=== ' + app + ' — transaction បិទ barcode តែមួយ ===');
    for (const [label, make] of SHAPES) {
        ctx = await makeCtx(src);
        const item = { id: 'i1', scanDate: ctx.getFormattedDate(), barcode: 'AAA', isClosed: false, barcodes: make() };
        let threw = null;
        try {
            vm.runInContext('var desiredClosed = true; var barcodeCode = "BBB";', ctx);
            ctx.__pickupAdds.length = 0;
            ctx.toggleOneTx(item);
        } catch (e) { threw = e; }
        ok(!threw, label + ' ➜ មិន throw', threw && threw.message);
        ok(ctx.__pickupAdds.length === 1 && ctx.__pickupAdds[0].keys.length > 0, label + ' ➜ callback ផ្តល់កូនសោ pickup ទៅ admission boundary ពិត', ctx.__pickupAdds);
        const list = Array.isArray(item.barcodes) ? item.barcodes : Object.values(item.barcodes || {});
        ok(list.length === 2, label + ' ➜ barcode មិនត្រូវបានលុបចោលពី Firebase', list.map(b => b && b.code));
        const bbb = list.find(b => b && b.code === 'BBB');
        ok(bbb && bbb.isClosed === true, label + ' ➜ barcode ដែលអតិថិជនយក ត្រូវបានបិទ', bbb);
        const aaa = list.find(b => b && b.code === 'AAA');
        ok(aaa && aaa.isClosed === false, label + ' ➜ barcode ដែលមិនទាន់យក នៅបើកដដែល', aaa);
        checkReceipts(ctx, item, ['BBB'], label);
    }

    console.log('\n=== ' + app + ' — Sign ACK ត្រូវនឹងវគ្គកញ្ចប់ ===');
    for (const [label, make] of SHAPES) {
        for (const restored of [false, true]) {
            const item = { id: 'i1', scanDate: '2026-10-19', createdAt: 1000, isClosed: false, barcodes: make() };
            const barcode = Object.values(item.barcodes).find(b => b && b.code === 'BBB');
            const pending = await makeCtx(src, { expectedSignIdentity: ctx.barcodeSignIdentity(item, barcode) });
            pending.desiredClosed = true;
            pending.barcodeCode = 'BBB';
            if (restored) barcode.restoredAt = 2000;
            const before = JSON.stringify({ ...item, barcodes: Object.values(item.barcodes).filter(Boolean) });
            let result, threw = null;
            try { result = pending.toggleOneTx(item); } catch (error) { threw = error; }
            const current = Object.values(item.barcodes).find(b => b && b.code === 'BBB');
            ok(!threw && (restored ? result === undefined && JSON.stringify(item) === before : result === item && current.isClosed === true),
                label + (restored ? ' ➜ ACK ចាស់មិនបិទកញ្ចប់ដែលបានស្តារ' : ' ➜ ACK វគ្គដដែលបិទកញ្ចប់បាន'),
                threw ? threw.message : item);
        }
    }

    console.log('\n=== ' + app + ' — transaction របស់ session ចាស់ ===');
    for (const operation of ['toggleWholeTx', 'toggleOneTx']) {
        for (const changed of ['authGeneration', 'db']) {
            for (const [label, make] of SHAPES) {
                const stale = await makeCtx(src);
                const item = { id: 'i1', barcode: 'AAA', isClosed: false, barcodes: make() };
                const before = JSON.stringify(item);
                stale.desiredClosed = true;
                stale.barcodeCode = 'BBB';
                if (changed === 'authGeneration') stale.authGeneration++;
                else stale.db = {};
                let result, threw = null;
                try { result = stale[operation](item); } catch (error) { threw = error; }
                ok(!threw && result === undefined && JSON.stringify(item) === before,
                    operation + ' / ' + changed + ' / ' + label + ' ➜ បោះបង់ដោយមិនកែ barcode របស់ session ចាស់',
                    threw ? threw.message : item);
            }
        }
    }

    console.log('\n=== ' + app + ' — ផែនការ Close ពិតលើទម្រង់ Firebase ទាំងពីរ ===');
    for (const whole of [false, true]) {
        for (const [shape, make] of SHAPES) {
            const label = (whole ? 'បញ្ជីទាំងមូល' : 'barcode តែមួយ') + ' / ' + shape;
            const original = { id: 'i1', scanDate: '2026-10-19', barcode: 'AAA', isClosed: false, barcodes: make() };
            const planned = await makeCtx(src, undefined, { item: original, whole });
            planned.desiredClosed = true;
            planned.barcodeCode = 'BBB';
            const invoke = whole ? planned.toggleWholeTx : planned.toggleOneTx;
            const item = JSON.parse(JSON.stringify(original));
            let result, threw = null;
            try { result = invoke(item); } catch (error) { threw = error; }
            ok(!threw && result === item && planned.__closePlanCalls[0] === 'before',
                label + ' ➜ transaction ប្រើ applyClose ពិត មិនមែនច្រក legacy', threw ? threw.message : result);
            const expected = whole ? ['AAA', 'BBB'] : ['BBB'];
            ok(Array.isArray(item.barcodes) && item.barcodes.length === 2
                && item.barcodes.every(barcode => barcode.isClosed === expected.includes(barcode.code)),
                label + ' ➜ ផែនការរក្សា barcode ទាំងអស់ និងបិទតែគោលដៅ', item);
            checkReceipts(planned, item, expected, label);
            const after = JSON.stringify(item);
            threw = null;
            try { result = invoke(item); } catch (error) { threw = error; }
            ok(!threw && result === item && planned.__closePlanCalls.at(-1) === 'applied' && JSON.stringify(item) === after,
                label + ' ➜ updater រត់ឡើងវិញទទួល receipt ដដែល ដោយមិនសរសេរជាន់', threw ? threw.message : item);
            const changed = JSON.parse(JSON.stringify(original));
            Object.values(changed.barcodes).find(barcode => barcode && barcode.code === 'BBB').createdAt++;
            threw = null;
            try { result = invoke(changed); } catch (error) { threw = error; }
            ok(!threw && result === undefined && planned.__closePlanCalls.at(-1) === 'conflict'
                && Object.values(changed.barcodes).filter(Boolean).every(barcode => barcode.isClosed === false && !barcode.pickupTransition),
                label + ' ➜ វគ្គ barcode ថ្មីមិនទទួលផែនការចាស់', threw ? threw.message : changed);
        }
    }
}

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
})().catch(error => { console.error('FAIL raw-read-shape fixture: ' + (error.stack || error)); process.exitCode = 1; });
