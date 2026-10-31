const { modulePrograms } = require('./audit-module-ast');
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
    'currentItem', 'freshItem', 'revertItem', 'existingItem']);
const TRASH_VARS = new Set(['trashItem', 'removed', 'deletedItem']);
const BARCODE_VARS = new Set(['b', 'bc', 'barcode', 'restoredBc', 'newBarcode', 'revertB']);
// ⛔ ZoeW ជា React ៖ view model ក្នុងឃ្លាំង (មិនមែន payload Firebase) ដែលកូដហៅថា `item` ដែរ ➜ ការសម្គាល់តាម **ប្រភពនៃ
//    ការប្រកាស** ៖ អថេរដែល `const <ឈ្មោះ> = <function>(...)` ក្នុង function ដដែល ជា view model មិនមែនកំណត់ត្រា
//    ⛔ រាល់ធាតុមានហេតុផល — កុំបន្ថែមដោយគ្មានការតាមដានពិត
const VIEW_MODEL_SOURCES = {
    toastItem: 'toast ក្នុង `uiState.toasts` (`ToastList.tsx` គូរ) — គ្មានផ្លូវណាសរសេរវាទៅ Firebase'
};
// ⛔ កំណត់ត្រាក្នុងឧបករណ៍ (localStorage) ដែលកូដហៅថា `entry` ដែរ ➜ មិនមែន payload Firebase ទេ ➜ ប្រៀបនឹង schema **ផ្ទាល់របស់វា** នៅទីនេះ
//    (មិនមែន rules) ៖ គន្លឹះ = `<function>:<អថេរ>` · អថេរប្រកាសពី object literal ក្នុង function នោះ (មិនមែនកញ្ចប់ដែលយកពីកន្លែងផ្សេង) ·
//    function មិនហៅ Firebase ផ្ទាល់ · field នីមួយៗមានរូបរាង (`shape`) និង guard ដែលការពារតម្លៃ (`if (<guard>(x)) entry.f = x`)
//    ⛔ field មិនមានក្នុង schema នេះ · គ្មាន guard · ធាតុ ឬ field ងាប់ (គ្មានការសរសេរ) ➜ FAIL
const LOCAL_RECORDS = {
    'beginPickupIntent:entry': {
        store: 'zoew_pickup_journal_v2:',
        reason: 'journal ស្ថិតិយក (`writePickupJournal()` ➜ localStorage តែប៉ុណ្ណោះ)',
        fields: { item: { shape: 'string item id (`[a-zA-Z0-9_-]+`)', guard: 'pickupJournalItemId' } }
    },
    'markCleanupJournalStage:entry': {
        store: 'zoew_cleanup_journal_v2:',
        reason: 'វាល stage របស់ journal cleanup ក្នុងឧបករណ៍; ប្រភព readCleanupJournal/filter និងច្រក writeCleanupJournal មិនមែន Firebase។',
        source: 'readCleanupJournal', persist: 'writeCleanupJournal',
        fields: { stage: { shape: 'parameter stage របស់ protocol cleanup', parameter: 'stage' } }
    }
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
    const programs = modulePrograms(src, path.join(ROOT, app, 'app.js'), { ecmaVersion: 2022, locations: true });

    const found = { item: new Map(), trash: new Map(), barcode: new Map() };
    const viewModelHits = new Map();
    const localHits = new Map();
    const localFieldHits = new Set();
    const localProblems = [];
    const localRecordIsLiteral = (fnNode, name) => {
        let literal = 0;
        let other = 0;
        (function scan(n) {
            if (!n || typeof n !== 'object') return;
            if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name) {
                if (n.init && n.init.type === 'ObjectExpression') literal++;
                else other++;
            }
            for (const k of Object.keys(n)) {
                const v = n[k];
                if (Array.isArray(v)) v.forEach(scan);
                else if (v && typeof v === 'object' && v.type) scan(v);
            }
        })(fnNode.body);
        return literal > 0 && other === 0;
    };
    const localRecordFromCollection = (fnNode, name, parents, record) => {
        if (!record.source || !record.persist) return false;
        const declarations = new Map();
        for (const statement of fnNode.body.body) if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
            for (const item of statement.declarations) if (item.id.type === 'Identifier') declarations.set(item.id.name, item.init);
        }
        const fromSource = (node, seen = new Set()) => {
            if (node?.type === 'Identifier') {
                if (seen.has(node.name)) return false;
                seen.add(node.name);
                return fromSource(declarations.get(node.name), seen);
            }
            if (node?.type !== 'CallExpression') return false;
            if (node.callee.type === 'Identifier') return node.callee.name === record.source;
            return node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'filter'
                && fromSource(node.callee.object, seen);
        };
        for (let i = parents.length - 1; i >= 0; i--) {
            const callback = parents[i], call = parents[i - 1];
            if (callback.type !== 'ArrowFunctionExpression' || callback.params[0]?.name !== name || call?.type !== 'CallExpression'
                || call.arguments[0] !== callback || call.callee.type !== 'MemberExpression' || call.callee.computed
                || call.callee.property.name !== 'forEach' || call.callee.object.type !== 'Identifier') continue;
            const collection = call.callee.object;
            const persisted = fnNode.body.body.some(statement => {
                const write = statement.type === 'IfStatement' ? statement.consequent : statement;
                return write.type === 'ExpressionStatement' && write.expression.type === 'CallExpression'
                    && write.expression.callee.name === record.persist && write.expression.arguments[0]?.name === collection.name;
            });
            return persisted && fromSource(collection);
        }
        return false;
    };
    const lineageProbes = [
        ['const list = readCleanupJournal();', true],
        ['const list = scanHistory;', false],
        ['let list = readCleanupJournal(); list = scanHistory;', false],
        ['const list = changed;', false]
    ];
    for (const [declaration, expected] of lineageProbes) {
        const probe = acorn.parse('function update(stage) { ' + declaration + ' const changed = list.filter(e => true); changed.forEach(entry => { entry.stage = stage; }); if (changed.length) writeCleanupJournal(changed); }', { ecmaVersion: 2022 });
        const fn = probe.body[0];
        let measured = null;
        const ancestors = [];
        (function visit(node) {
            if (!node || typeof node.type !== 'string') return;
            if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.name === 'entry') {
                measured = localRecordFromCollection(fn, 'entry', ancestors, LOCAL_RECORDS['markCleanupJournalStage:entry']);
            }
            ancestors.push(node);
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value.type === 'string') visit(value);
            }
            ancestors.pop();
        })(fn);
        if (measured !== expected) { console.log('   FAIL  probe ប្រភព journal មិនត្រឹមត្រូវ៖ ' + declaration); problems++; }
    }
    const guardedBy = (guard, assign, parents) => {
        if (!assign.right || assign.right.type !== 'Identifier') return false;
        for (let i = parents.length - 1; i >= 0; i--) {
            const p = parents[i];
            if (/Function/.test(p.type)) return false;
            if (p.type !== 'IfStatement') continue;
            const child = i + 1 < parents.length ? parents[i + 1] : assign;
            const test = p.test;
            if (p.consequent === child && test && test.type === 'CallExpression' && test.callee.type === 'Identifier' && test.callee.name === guard
                && test.arguments[0] && test.arguments[0].type === 'Identifier' && test.arguments[0].name === assign.right.name) return true;
        }
        return false;
    };
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
    let fnNode = null;
    const parents = [];
    programs.forEach(ast => (function walk(n) {
        if (!n || typeof n !== 'object') return;
        const outer = viewModelNames;
        const outerFn = fnNode;
        if (n.type === 'FunctionDeclaration') {
            viewModelNames = viewModelNamesIn(n);
            fnNode = n;
        }
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
            const localKey = fnNode && fnNode.id ? fnNode.id.name + ':' + obj : '';
            const local = obj && Object.prototype.hasOwnProperty.call(LOCAL_RECORDS, localKey) ? LOCAL_RECORDS[localKey] : null;
            if (local && (localRecordIsLiteral(fnNode, obj) || localRecordFromCollection(fnNode, obj, parents, local))) {
                localHits.set(localKey, (localHits.get(localKey) || 0) + 1);
                const where = `${app}/app.js:${n.loc.start.line}`;
                const field = Object.prototype.hasOwnProperty.call(local.fields, prop) ? local.fields[prop] : null;
                const body = src.slice(fnNode.start, fnNode.end);
                if (/\bfirebaseState\.fb\b|\bfb\.[A-Za-z]+\(/.test(body)) {
                    localProblems.push(`${where}  ${fnNode.id.name} ហៅ Firebase ➜ '${obj}' មិនមែនកំណត់ត្រាក្នុងឧបករណ៍តែប៉ុណ្ណោះទៀតទេ`);
                } else if (!field) {
                    localProblems.push(`${where}  '${prop}' មិនមានក្នុង schema កំណត់ត្រាក្នុងឧបករណ៍ ${localKey} (${local.store})`);
                } else if (!(field.guard ? guardedBy(field.guard, n, parents)
                    : field.parameter && n.right.type === 'Identifier' && n.right.name === field.parameter && fnNode.params.some(param => param.name === field.parameter))) {
                    localProblems.push(`${where}  '${prop}' គ្មាន ${field.guard}(…) ការពាររូបរាង (${field.shape})`);
                } else {
                    localFieldHits.add(localKey + '.' + prop);
                }
                obj = null;
            }
            if (ITEM_VARS.has(obj)) bucket = 'item';
            else if (TRASH_VARS.has(obj)) bucket = 'trash';
            else if (BARCODE_VARS.has(obj)) bucket = 'barcode';
            if (bucket && !found[bucket].has(prop)) found[bucket].set(prop, n.loc.start.line);
        }
        parents.push(n);
        for (const k of Object.keys(n)) {
            const v = n[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === 'object' && v.type) walk(v);
        }
        parents.pop();
        viewModelNames = outer;
        fnNode = outerFn;
    })(ast));
    // ⛔ ជាន់អប្បបរមា ៖ ការលើកលែងត្រូវមានអ្នកប្រើពិត (ធាតុងាប់ = សិទ្ធិលើស)
    if (viewModelHits.size === 0) {
        console.log('   FAIL  VIEW_MODEL_SOURCES គ្មានការសរសេរណាត្រូវលើកលែង ➜ ធាតុងាប់');
        problems++;
    } else {
        console.log('   ok    view model មិនមែន payload ៖ ' + [...viewModelHits.keys()].join(' · '));
    }
    for (const [key, record] of Object.entries(LOCAL_RECORDS)) {
        const deadFields = Object.keys(record.fields).filter((f) => !localFieldHits.has(key + '.' + f));
        if (typeof record.reason !== 'string' || !record.reason.trim()) {
            localProblems.push(`LOCAL_RECORDS '${key}' គ្មានហេតុផលសរសេរជាប់`);
        } else if (!localHits.get(key)) {
            localProblems.push(`LOCAL_RECORDS '${key}' គ្មានការសរសេរណា (object literal ក្នុង function នោះ) ➜ ធាតុងាប់`);
        } else if (deadFields.length) {
            localProblems.push(`LOCAL_RECORDS '${key}' field ងាប់ ៖ ${deadFields.join(' · ')}`);
        } else if (!src.includes("'" + record.store + "'")) {
            localProblems.push(`LOCAL_RECORDS '${key}' ឃ្លាំង ${record.store} មិនមានក្នុងកូដ`);
        }
    }
    localProblems.forEach((line) => { console.log('   FAIL  ' + line); problems++; });
    if (!localProblems.length) {
        console.log('   ok    កំណត់ត្រាក្នុងឧបករណ៍ (មិនមែន payload) ស្រប schema ផ្ទាល់ ៖ ' + Object.keys(LOCAL_RECORDS).map((k) => k + ' ➜ ' + LOCAL_RECORDS[k].store
            + ' (' + Object.keys(LOCAL_RECORDS[k].fields).map((f) => f + ' = ' + LOCAL_RECORDS[k].fields[f].shape).join(' · ') + ')').join(' · '));
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
