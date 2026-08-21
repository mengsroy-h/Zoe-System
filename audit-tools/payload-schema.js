const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
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

let problems = 0;
for (const app of ['ZoeAdmin', 'ZoeW']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true });

    const found = { item: new Map(), trash: new Map(), barcode: new Map() };
    (function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' &&
            !n.left.computed && n.left.object.type === 'Identifier' &&
            n.left.property.type === 'Identifier') {
            const obj = n.left.object.name, prop = n.left.property.name;
            let bucket = null;
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
    })(ast);

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
        const body = src.slice(at, at + 4000);
        for (const f of trashOnly) {
            const stripped = body.includes('delete ' + 'itemToRestore.' + f) ||
                body.includes('delete ' + 'updated.' + f) ||
                !body.includes(f);
            if (stripped) { console.log(`   ok    ${fn} មិនបញ្ជូន '${f}' ទៅ scan_history`); }
            else { console.log(`   FAIL  ${fn} អាចសរសេរ '${f}' ទៅ scan_history (schema បដិសេធ)`); problems++; }
        }
    }
}

console.log('\n' + (problems ? 'FAIL ' + problems : 'PASS') + ' — payload ↔ rules schema');
process.exit(problems ? 1 : 0);
