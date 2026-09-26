const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const ROOT = process.env.PAYLOAD_APP_DIR ? path.resolve(process.env.PAYLOAD_APP_DIR) : path.resolve(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')).rules;

function schemaFields(node) {
    return new Set(Object.keys(node).filter((k) => !k.startsWith('.') && !k.startsWith('$')));
}
function allowsOther(node) {
    if (!node.$other) return true;
    const v = node.$other['.validate'];
    return !(v === false || v === 'false');
}

// item-shaped objects and the rules node each is ultimately written to
const TARGETS = {
    'zoew_scan_history_cod_dod/$itemId': rules.zoew_scan_history_cod_dod.$itemId,
    'zoew_recently_deleted_cod_dod/$itemId': rules.zoew_recently_deleted_cod_dod.$itemId,
    'zoew_scan_history_cod_dod/$itemId/barcodes/$idx': rules.zoew_scan_history_cod_dod.$itemId.barcodes.$idx,
    'zoew_recently_deleted_cod_dod/$itemId/barcodes/$idx': rules.zoew_recently_deleted_cod_dod.$itemId.barcodes.$idx
};

// variables in app.js that hold an object destined for each node
const ITEM_VARS = new Set(['item', 'newItem', 'entry', 'updated', 'targetItem', 'itemToRestore',
    'resultingLiveItem', 'currentItem', 'freshItem', 'revertItem', 'existingItem']);
const TRASH_VARS = new Set(['trashItem', 'removed', 'deletedItem']);
const BARCODE_VARS = new Set(['b', 'bc', 'barcode', 'restoredBc', 'newBarcode', 'revertB']);
// ⛔ ZoeW ជា React ៖ view model ក្នុងឃ្លាំង (មិនមែន payload Firebase) ដែលកូដហៅថា `item` ដែរ ➜ ការសម្គាល់តាម **ប្រភពនៃ
//    ការប្រកាស** ៖ អថេរដែល `const <ឈ្មោះ> = <function>(...)` ក្នុង function ដដែល ជា view model មិនមែនកំណត់ត្រា
//    ⛔ រាល់ធាតុមានហេតុផល — កុំបន្ថែមដោយគ្មានការតាមដានពិត
const VIEW_MODEL_SOURCES = {
    toastItem: 'toast ក្នុង `uiState.toasts` (`ToastList.tsx` គូរ) — គ្មានផ្លូវណាសរសេរវាទៅ Firebase'
};

function sliceLimitFor(src, at) {
    let depth = 0;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return i - at + 1; }
    }
    return 4000;
}

let problems = 0;
for (const app of ['ZoeW']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true });

    const found = { item: new Map(), trash: new Map(), barcode: new Map() };
    const viewModelHits = new Map();
    // ឈ្មោះដែលប្រកាសពី VIEW_MODEL_SOURCES ក្នុង function នីមួយៗ (រួម closure ខាងក្នុង)
    const viewModelNamesIn = (fnNode) => {
        const names = new Set();
        (function scan(n) {
            if (!n || typeof n !== 'object') return;
            if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && n.init.type === 'CallExpression'
                && n.init.callee.type === 'Identifier' && VIEW_MODEL_SOURCES[n.init.callee.name]) names.add(n.id.name);
            for (const k of Object.keys(n)) {
                const v = n[k];
                if (Array.isArray(v)) v.forEach(scan);
                else if (v && typeof v === 'object' && v.type) scan(v);
            }
        })(fnNode);
        return names;
    };
    let viewModelNames = new Set();
    (function walk(n) {
        if (!n || typeof n !== 'object') return;
        const outer = viewModelNames;
        if (n.type === 'FunctionDeclaration') viewModelNames = viewModelNamesIn(n);
        if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' &&
            !n.left.computed && n.left.object.type === 'Identifier' &&
            n.left.property.type === 'Identifier') {
            let obj = n.left.object.name;
            const prop = n.left.property.name;
            let bucket = null;
            if (viewModelNames.has(obj)) {
                viewModelHits.set(obj + '.' + prop, n.loc.start.line);
                obj = null;
            }
            if (ITEM_VARS.has(obj)) bucket = 'item';
            else if (TRASH_VARS.has(obj)) bucket = 'trash';
            else if (BARCODE_VARS.has(obj)) bucket = 'barcode';
            if (bucket && !found[bucket].has(prop)) found[bucket].set(prop, n.loc.start.line);
        }
        for (const k of Object.keys(n)) {
            const v = n[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === 'object' && v.type) walk(v);
        }
        viewModelNames = outer;
    })(ast);
    // ⛔ ជាន់អប្បបរមា ៖ ការលើកលែងត្រូវមានអ្នកប្រើពិត (ធាតុងាប់ = សិទ្ធិលើស)
    if (viewModelHits.size === 0) {
        console.log('   FAIL  VIEW_MODEL_SOURCES គ្មានការសរសេរណាត្រូវលើកលែង ➜ ធាតុងាប់');
        problems++;
    } else {
        console.log('   ok    view model មិនមែន payload ៖ ' + [...viewModelHits.keys()].join(' · '));
    }

    // an item-shaped var travels BOTH ways (live record and trash record), so it is
    // checked against the union; the direction-specific danger is covered below.
    const liveFields = schemaFields(TARGETS['zoew_scan_history_cod_dod/$itemId']);
    const trashOnly = [...schemaFields(TARGETS['zoew_recently_deleted_cod_dod/$itemId'])]
        .filter((f) => !liveFields.has(f));
    const clearBuilderAt = src.indexOf('function buildClearHistoryTrashItem(');
    const clearBuilderEnd = clearBuilderAt === -1 ? -1 : src.indexOf('async function claimHistoryItemForClear(', clearBuilderAt);
    const clearBuilder = clearBuilderAt === -1 ? '' : src.slice(clearBuilderAt, clearBuilderEnd === -1 ? clearBuilderAt + 3000 : clearBuilderEnd);
    const itemFieldsStrippedBeforeTrash = new Set();
    const strippedFieldPattern = /delete\s+trashItem\.([A-Za-z_$][\w$]*)/g;
    let strippedFieldMatch;
    while ((strippedFieldMatch = strippedFieldPattern.exec(clearBuilder))) itemFieldsStrippedBeforeTrash.add(strippedFieldMatch[1]);
    // helper រួម៖ អ្វីដែល stripHistoryOnlyMarkers() លុប ក៏រាប់ថាលុបរួចដែរ
    if (clearBuilder.includes('stripHistoryOnlyMarkers')) {
        const helperAt = src.indexOf('function stripHistoryOnlyMarkers(');
        if (helperAt !== -1) {
            const helper = src.slice(helperAt, helperAt + sliceLimitFor(src, helperAt));
            const helperPattern = /delete\s+item\.([A-Za-z_$][\w$]*)/g;
            let helperMatch;
            while ((helperMatch = helperPattern.exec(helper))) itemFieldsStrippedBeforeTrash.add(helperMatch[1]);
        }
    }

    const CHECKS = [
        ['item', 'zoew_recently_deleted_cod_dod/$itemId'],
        ['trash', 'zoew_recently_deleted_cod_dod/$itemId'],
        ['barcode', 'zoew_scan_history_cod_dod/$itemId/barcodes/$idx']
    ];
    for (const [bucket, target] of CHECKS) {
        const node = TARGETS[target];
        const allowed = schemaFields(node);
        const open = allowsOther(node);
        const unknown = [...found[bucket].entries()].filter(([f]) => !allowed.has(f) &&
            !(bucket === 'item' && target === 'zoew_recently_deleted_cod_dod/$itemId' && itemFieldsStrippedBeforeTrash.has(f)));
        console.log(`\n=== ${app} — ${bucket} ➜ ${target} ${open ? '($other បើក)' : '($other បិទ)'} ===`);
        if (!unknown.length) { console.log('   ok    គ្រប់ field ដែលកូដកំណត់ មានក្នុង schema'); continue; }
        for (const [f, line] of unknown) {
            const fatal = !open;
            console.log(`   ${fatal ? 'FAIL ' : 'note '} ${app}/app.js:${line}  '${f}' មិនមានក្នុង schema`);
            if (fatal) problems++;
        }
    }

    // Direction-specific: writing a trash-only field back into scan_history is rejected
    // by the live schema ($other: false). Every restore path must strip them first.
    console.log(`\n=== ${app} — ផ្លូវស្តារត្រូវលុប field ធុងសំរាម មុនសរសេរទៅ scan_history ===`);
    for (const fn of ['executeRestoreItem', 'restoreClaimedItemToScanHistory']) {
        const at = src.indexOf('function ' + fn + '(');
        if (at === -1) { console.log(`   note  ${fn} មិនមានក្នុង ${app}`); continue; }
        // ⛔ តួ function ពិត (ផ្គូ brace) មិនមែន ៤០០០ តួអក្សរថេរ ៖ function បន្ទាប់ដែលអាន `deletedAt` ត្រឹមត្រូវ
        //    (ឧ. `cleanupClaimAccountedElsewhere`) ធ្លាប់ធ្លាក់ចូល window ➜ FAIL ក្លែង
        const body = src.slice(at, at + sliceLimitFor(src, at));
        for (const f of trashOnly) {
            const stripped = body.includes('delete ' + 'itemToRestore.' + f) ||
                body.includes('delete ' + 'updated.' + f) ||
                !body.includes(f);
            if (stripped) { console.log(`   ok    ${fn} មិនបញ្ជូន '${f}' ទៅ scan_history`); }
            else { console.log(`   FAIL  ${fn} អាចសរសេរ '${f}' ទៅ scan_history (schema បដិសេធ)`); problems++; }
        }
    }

    // ទិសផ្ទុយ៖ វាលដែលជាកម្មសិទ្ធិរបស់ scan_history តែម្យ៉ាង (marker ស្តារ/លុបជាក្រុម)
    // មិនត្រូវធ្លាក់ចូល zoew_recently_deleted_cod_dod ឡើយ — $other: false បដិសេធ
    // ការសរសេរ **ទាំងមូល** ➜ «ដក/លុប» ស្លាប់ជារៀងរហូតលើធាតុនោះ (កំហុសផលិតកម្ម 2.17.3)។
    console.log(`\n=== ${app} — ផ្លូវសរសេរធុងសំរាមត្រូវលុប marker របស់ scan_history ===`);
    const trashSchemaFields = schemaFields(TARGETS['zoew_recently_deleted_cod_dod/$itemId']);
    const HISTORY_ONLY = ['restoreClaimId', 'restoreClaimToken', 'clearClaim']
        .filter((f) => !trashSchemaFields.has(f));
    const TRASH_WRITERS = ['deleteSingleItem', 'removeSingleBarcode', 'claimAndCleanupItem', 'buildClearHistoryTrashItem'];
    if (!HISTORY_ONLY.length) {
        console.log('   note  schema ធុងសំរាមទទួល marker ទាំងនោះ ➜ គ្មានអ្វីត្រូវពិនិត្យ');
    } else {
        for (const fn of TRASH_WRITERS) {
            const at = src.indexOf('function ' + fn + '(');
            if (at === -1) { console.log(`   note  ${fn} មិនមានក្នុង ${app}`); continue; }
            const body = src.slice(at, at + sliceLimitFor(src, at));
            const strips = body.includes('stripHistoryOnlyMarkers') ||
                HISTORY_ONLY.every((f) => new RegExp('delete\\s+\\w+\\.' + f).test(body));
            if (strips) console.log(`   ok    ${fn} លុប marker មុនសរសេរចូលធុងសំរាម`);
            else { console.log(`   FAIL  ${fn} អាចសរសេរ ${HISTORY_ONLY.join('/')} ចូលធុងសំរាម (rules បដិសេធទាំងមូល)`); problems++; }
        }
    }
}

console.log('\n' + (problems ? 'FAIL ' + problems : 'PASS') + ' — payload ↔ rules schema');
process.exit(problems ? 1 : 0);
