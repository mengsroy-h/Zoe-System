// ⛔ ថ្នាក់កំហុស៖ **ការសរសេរ Locker ជាន់នឹង «លុបទាំងអស់» ដែលបាន claim រួច
// ➜ ការងាររបស់អ្នកប្រើបាត់ស្ងាត់ៗ ខណៈ App រាយថា ✅ ជោគជ័យ។**
//
// ផ្លូវសរសេរទាំងអស់ដែលប៉ះ `zoew_scan_history_cod_dod/$id` មាន gate `clearClaim`
// ក្នុង transaction ៖ `mergeBarcodeIntoHistoryItem` · `removeSingleBarcode` ·
// `deleteSingleItem` · `claimAndCleanupItem` · `toggleCloseStatus` ·
// `applyClaimedRestoreToHistory`។ **`assignLockerToEntry` ជាផ្លូវតែមួយដែលគ្មាន។**
//
// ⛔ **Firebase rules មិនទប់វាទេ** ៖ fence នៃ `clearClaim` អនុញ្ញាតរាល់ការសរសេរ
// ដែល `newData.exists()` — វាការពារត្រឹមតែ **ការលុប**។ ដូច្នេះការការពារត្រូវ
// រស់នៅក្នុងកូដ។
//
// **វាស់បានលើ tree មុនកែ (ខ្សែសង្វាក់ពិត · កូដ ship ក្នុង `vm`)**៖
//   ១. `claimHistoryItemForClear()` ថត snapshot (`locker: 'OLD'`) ហើយដាក់
//      `clearClaim` លើ server
//   ២. អ្នកប្រើស្កេនកំណត់ Locker ថ្មី ➜ `assignLockerToEntry()` **សរសេរជោគជ័យ**
//      ➜ server ក្លាយជា `A1` ➜ toast **«✅ ផ្លាស់ទីកញ្ចប់ … ➜ A1»**
//   ３. `finalizeClaimedHistoryClear()` សរសេរ trash ពី snapshot **ចាស់** ហើយ
//      លុប history ➜ ធុងសំរាមរក្សា **`OLD`** ➜ **ការប្តូរ Locker បាត់ទាំងស្រុង**
//
// នេះជាការបំពានច្បាប់ «**Toast និយាយការពិត**» ៖ success មិនត្រូវលេចមុន
// durable commit នៃ *លទ្ធផលដែលអ្នកប្រើឃើញ*។ កញ្ចប់នោះបាត់ក្នុងវិនាទីបន្ទាប់។
//
// ⚠️ **អ្វីដែលវាស់រួច ហើយ *មិនមែន* កំហុស (កុំ «កែ» វា)** ៖ ផ្លូវ **ស្តារ**
// មិនបាត់ Locker ទេ — `applyClaimedRestoreToHistory()` merge លើ `currentItem`
// (មិនមែន snapshot) ហើយ `finalizeClaimedRestore()` សរសេរតែ **field-level**
// (`.../restoreClaimId: null`)។ ដូច្នេះ gate នៃ restore markers **មិនត្រូវ
// បន្ថែម** លើផ្លូវ Locker — វាមិនប៉ះលុយ ហើយការ abort នឹងទប់ការកំណត់ Locker
// ដោយឥតប្រយោជន៍ខណៈការស្តារកំពុងដំណើរការ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LOCKERCLAIM_APP_DIR
    ? path.resolve(process.env.LOCKERCLAIM_APP_DIR)
    : path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return null;
}
function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    if (!body) return null;
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + body;
}

const src = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n') : '';

// ── ១. ជាន់អប្បបរមា ៖ ថតទទេ / ការស្រង់ដែលធ្លាក់ មិនត្រូវបៃតង ────────────────
console.log('== ១. ជាន់អប្បបរមា ==');
ok('អាន ZoeW/app.js បាន (>= ១០០ KB)', src.length > 100000, src.length);
const NEEDED = ['assignLockerToEntry', 'claimHistoryItemForClear', 'buildClearHistoryTrashItem',
    'finalizeClaimedHistoryClear', 'withTimeout', 'dbOp', 'dbOpStalled'];
const missing = NEEDED.filter((n) => !extractFn(src, n));
ok('រកឃើញ function ដែលត្រូវវាស់ ' + NEEDED.length, missing.length === 0, { missing: missing });

function fnSource(name) { return extractFn(src, name) || ('function ' + name + '() {}'); }

// ── ២. Sandbox ដែលរត់កូដ ship ពិត ─────────────────────────────────────────
function buildWorld() {
    const log = { toasts: [], writes: [] };
    const store = {};
    const ctx = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Promise, JSON, Object, Array, Number, String, Boolean, Math, Set, Map, Date,
        setTimeout, clearTimeout, isNaN, parseFloat, parseInt, isFinite,
        window: { ZoeErrors: { capture: () => {} } }, ZoeErrors: { capture: () => {} },
        __log: log
    };
    vm.createContext(ctx);
    const preamble = `
let db = {}, fb = null, auth = { currentUser: { email: 'a@b.c' } };
let lockerBarcodeIndex = {}, activeLocker = 'A1', lockerAssignGeneration = 0;
const DB_OP_TIMEOUT_MS = 15000;
const CLEAR_HISTORY_CLAIM_LEASE_MS = 120000;
function getServerNow() { return 1750000000000; }
function showToast(m) { __log.toasts.push(String(m)); }
function lockerErrorFeedback() {}
function lockerSuccessFeedback() {}
function openLockerPicker() {}
function renderLockerList() {}
function refreshCurrentHistoryView() {}
function safeFocusScanner() {}
function isValidLockerName(n) { return typeof n === 'string' && /^[A-Z][0-9]+$/.test(n); }
function lockerCodeKey(c) { return String(c || '').trim().toUpperCase(); }
function sanitizePhoneNumber(p) { return String(p || ''); }
function getEntryCurrentLocker(e) { return (e && e.barcodeIdx !== null && e.item.barcodes[e.barcodeIdx].locker) || 'N/A'; }
function normalizeBarcodesOf(i) { if (i && !Array.isArray(i.barcodes)) i.barcodes = []; return i; }
function barcodeEntriesOf(v) { return Array.isArray(v) ? v.map((b, i) => ({ barcode: b, index: i })).filter((e) => e.barcode) : []; }
function cloneRestoreItem(v) { return v ? JSON.parse(JSON.stringify(v)) : null; }
function isActiveClearHistoryClaim(c) { return !!(c && c.token && (getServerNow() - c.claimedAt) < CLEAR_HISTORY_CLAIM_LEASE_MS); }
function generateClearHistoryClaimToken() { return 'tok1'; }
function trashReasonOf() { return 'delete'; }
function stripHistoryOnlyMarkers(x) { if (x) { delete x.restoreClaimId; delete x.restoreClaimToken; delete x.clearClaim; } return x; }
function recalcItemMoneyFromBarcodes(t) {
    t.cod = t.barcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0);
    t.dod = t.barcodes.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0);
    t.price = Math.round((t.cod + t.dod) * 100) / 100;
}
`;
    const FNS = ['withTimeout', 'dbOp', 'dbOpStalled', 'assignLockerToEntry',
        'claimHistoryItemForClear', 'buildClearHistoryTrashItem', 'finalizeClaimedHistoryClear'];
    vm.runInContext(preamble + FNS.map(fnSource).join('\n') + `
globalThis.__setFb = (i) => { fb = i; };
globalThis.__setIndex = (i) => { lockerBarcodeIndex = i; };
globalThis.__assign = assignLockerToEntry;
globalThis.__claim = claimHistoryItemForClear;
globalThis.__buildTrash = buildClearHistoryTrashItem;
globalThis.__finalize = finalizeClaimedHistoryClear;
`, ctx);

    ctx.__setFb({
        ref: (_d, p) => ({ path: p || 'zoew_scan_history_cod_dod/itm1' }),
        runTransaction: (ref, updater) => {
            const key = ref.path;
            const cur = store[key] ? JSON.parse(JSON.stringify(store[key])) : null;
            let out;
            try { out = updater(cur); } catch (e) { return Promise.reject(e); }
            if (out === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => store[key] } });
            store[key] = out === null ? null : out;
            log.writes.push('tx:' + key);
            return Promise.resolve({ committed: true, snapshot: { val: () => out } });
        },
        update: (ref, updates) => {
            Object.keys(updates).forEach((k) => { store[k] = updates[k]; log.writes.push('upd:' + k); });
            return Promise.resolve();
        },
        get: (ref) => Promise.resolve({ exists: () => !!store[ref.path], val: () => store[ref.path] || null })
    });
    return { ctx, log, store };
}

function seedItem(w, extra) {
    const item = Object.assign({
        id: 'itm1', phone: '0974158508', scanDate: '2026-09-01', time: '10:00:00 (2026-09-01)',
        createdAt: 1749000000000, count: 1, cod: 5, dod: 0, price: 5, isClosed: false,
        barcodes: [{ code: 'BC1', cod: 5, dod: 0, locker: 'OLD', isClosed: false, isDeducted: false, isFromDeletion: false }]
    }, extra || {});
    w.store['zoew_scan_history_cod_dod/itm1'] = JSON.parse(JSON.stringify(item));
    w.ctx.__setIndex({ BC1: { itemId: 'itm1', barcodeIdx: 0, item: JSON.parse(JSON.stringify(item)) } });
    return item;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    // ── ២. ទិសផ្ទុយ ៖ កញ្ចប់ធម្មតា ➜ Locker ត្រូវសរសេរ និងរាយ ✅ ─────────────
    console.log('\n== ២. ទិសផ្ទុយ ៖ កញ្ចប់ធម្មតា ==');
    {
        const w = buildWorld();
        seedItem(w);
        await w.ctx.__assign('BC1');
        await sleep(30);
        const server = w.store['zoew_scan_history_cod_dod/itm1'];
        ok('ជាន់អប្បបរមា ៖ transaction បានចេញដំណើរពិត', w.log.writes.length >= 1, w.log.writes);
        ok('Locker ថ្មីត្រូវសរសេរលើ server', server.barcodes[0].locker === 'A1', server.barcodes[0].locker);
        ok('អ្នកប្រើឃើញសារជោគជ័យ', w.log.toasts.some((t) => /^✅/.test(t)), w.log.toasts);
    }

    // ── ３. ស្នូល ៖ កញ្ចប់ដែល «លុបទាំងអស់» claim រួច ──────────────────────────
    console.log('\n== ៣. ស្នូល ៖ ខ្សែសង្វាក់ «លុបទាំងអស់» ជាន់នឹងការកំណត់ Locker ==');
    {
        const w = buildWorld();
        seedItem(w);
        // ជំហាន ១ ៖ «លុបទាំងអស់» claim (snapshot ថត locker ចាស់)
        const claimed = await w.ctx.__claim('itm1', 'tok1');
        ok('ជាន់អប្បបរមា ៖ claim ជោគជ័យ ហើយ snapshot ថត Locker ចាស់',
            !!claimed && claimed.barcodes[0].locker === 'OLD', claimed && claimed.barcodes[0].locker);
        ok('ជាន់អប្បបរមា ៖ server ទទួល `clearClaim`',
            !!w.store['zoew_scan_history_cod_dod/itm1'].clearClaim);

        // ជំហាន ២ ៖ អ្នកប្រើស្កេនកំណត់ Locker ថ្មី (ជាន់)
        const writesBefore = w.log.writes.length;
        await w.ctx.__assign('BC1');
        await sleep(30);
        const afterLocker = w.store['zoew_scan_history_cod_dod/itm1'].barcodes[0].locker;

        // ជំហាន ３ ៖ «លុបទាំងអស់» finalize ដោយប្រើ snapshot ចាស់
        const trashItem = w.ctx.__buildTrash(claimed, 'itm1');
        await w.ctx.__finalize('itm1', 'tok1', trashItem);
        const trash = w.store['zoew_recently_deleted_cod_dod/itm1'];
        const hist = w.store['zoew_scan_history_cod_dod/itm1'];

        ok('ជាន់អប្បបរមា ៖ ខ្សែសង្វាក់ឈានដល់ការ finalize ពិត',
            hist === null && !!trash, { hist: hist, hasTrash: !!trash });
        // ⛔ ការអះអាងស្នូល ៖ App មិនត្រូវអះអាងជោគជ័យលើការងារដែលនឹងបាត់
        ok('⛔ ស្នូល ៖ App **មិនត្រូវរាយ ✅** លើកញ្ចប់ដែលកំពុងត្រូវលុប',
            !w.log.toasts.some((t) => /^✅/.test(t)), w.log.toasts);
        ok('⛔ ស្នូល ៖ អ្នកប្រើត្រូវដឹងថាកញ្ចប់ប្រែពីឧបករណ៍ផ្សេង',
            w.log.toasts.some((t) => /ផ្លាស់ប្តូរពីឧបករណ៍ផ្សេង/.test(t)), w.log.toasts);
        ok('⛔ ការសរសេរ Locker មិនត្រូវប្តូរ server ខណៈ `clearClaim` នៅរស់',
            afterLocker === 'OLD', afterLocker);
        ok('ការប្តូរ Locker មិនត្រូវ«បាត់ស្ងាត់ៗ» (trash ស៊ីនឹងអ្វីដែលអ្នកប្រើឃើញ)',
            trash && trash.barcodes && trash.barcodes[0].locker === 'OLD',
            trash && trash.barcodes && trash.barcodes[0].locker);
        ok('⛔ `clearClaim` fence នៅដដែល (ការលុបមិនត្រូវទប់)',
            w.log.writes.length > writesBefore || afterLocker === 'OLD');
    }

    // ── ４. ភាពស៊ីសង្វាក់ ៖ gate ត្រូវដូចផ្លូវសរសេរដទៃទាំងអស់ ────────────────
    console.log('\n== ៤. ភាពស៊ីសង្វាក់នៃ gate ==');
    {
        // ⛔ **រូបមន្តតែមួយមិនត្រូវរស់នៅ ២ កន្លែង** (ច្បាប់ «តក្កវិជ្ជាដដែល
        // ក្នុងឯកសារតែមួយ»)។ ផ្លូវសរសេរដទៃទាំងអស់ abort លើ `clearClaim`
        // **ណាមួយ** — មិនរាប់ lease ទេ។ ការធ្វើឲ្យ Locker ខុសពីពួកវានឹង
        // បង្កើតច្បាប់ ២ ផ្ទុយគ្នា ➜ ជុំក្រោយកែមួយ ភ្លេចមួយ។
        const w = buildWorld();
        seedItem(w, { clearClaim: { token: 'dead', claimedAt: 1750000000000 - 10 * 60 * 1000 } });
        await w.ctx.__assign('BC1');
        await sleep(30);
        const server = w.store['zoew_scan_history_cod_dod/itm1'];
        ok('gate ត្រូវអានវត្តមាននៃ `clearClaim` ដូចផ្លូវសរសេរដទៃ',
            server.barcodes[0].locker === 'OLD', server.barcodes[0].locker);
        const lockerFn = extractFn(src, 'assignLockerToEntry') || '';
        ok('⛔ gate មិនត្រូវប្រើ `isActiveClearHistoryClaim()` (លំនាំទី ២)',
            !/isActiveClearHistoryClaim/.test(lockerFn));
        // ជាន់អប្បបរមា ៖ ផ្លូវសរសេរដទៃពិតជាប្រើលំនាំដដែល ➜ បើថ្ងៃណាពួកវាប្តូរ
        // ទៅ lease-aware នោះជួរខាងលើត្រូវប្តូរតាមក្នុងជុំតែមួយ។
        const peers = (src.match(/if \(currentItem(?: && currentItem)?\.clearClaim\)/g) || []).length;
        ok('ជាន់អប្បបរមា ៖ ផ្លូវសរសេរដែលប្រើលំនាំដដែល >= ៨', peers >= 8, peers);
    }

    // ── ５. ទិសផ្ទុយ ៖ ការស្តារ **មិនត្រូវ** ទប់ការកំណត់ Locker ──────────────
    console.log('\n== ៥. ទិសផ្ទុយ ៖ កញ្ចប់ដែលកំពុងស្តារ ==');
    {
        // ⛔ វាស់រួច ៖ ផ្លូវស្តារ **មិនបាត់** Locker (`applyClaimedRestoreToHistory`
        // merge លើ `currentItem` · `finalizeClaimedRestore` សរសេរតែ field-level)
        // ➜ ការ abort នៅទីនេះនឹងទប់ការកំណត់ Locker ដោយឥតប្រយោជន៍។
        const w = buildWorld();
        seedItem(w, { restoreClaimId: 'src1', restoreClaimToken: 'tk2' });
        await w.ctx.__assign('BC1');
        await sleep(30);
        const server = w.store['zoew_scan_history_cod_dod/itm1'];
        ok('⛔ ការស្តារមិនត្រូវទប់ការកំណត់ Locker (វាមិនប៉ះលុយ)',
            server.barcodes[0].locker === 'A1', server.barcodes[0].locker);
        ok('⛔ marker នៃការស្តារត្រូវរក្សា (fence មិនត្រូវបំបែក)',
            server.restoreClaimId === 'src1' && server.restoreClaimToken === 'tk2',
            { id: server.restoreClaimId, token: server.restoreClaimToken });
    }

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
