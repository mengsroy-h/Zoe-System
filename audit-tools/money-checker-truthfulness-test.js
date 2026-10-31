// វាស់អ្នកវាស់៖ អថេរលុយ និងទ្វារស្ងប់ពិត តាម VM ដោយគ្មាន browser/DB។
// មិនមែនជាភស្តុតាងទំហំផ្ទុក ឬ throughput របស់ backend ទេ។
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const ROOT = path.resolve(process.env.MONEYTRUTH_APP_DIR || path.join(__dirname, '..'));
let pass = 0, fail = 0;
function check(label, condition, detail) {
    if (condition) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
}
function scenario(label, fn) {
    try { fn(); } catch (e) { check(label, false, e.message); }
}
function nodes(source) {
    const out = [];
    (function visit(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type) out.push(n);
        Object.values(n).forEach((v) => Array.isArray(v) ? v.forEach(visit) : visit(v));
    })(acorn.parse(source, { ecmaVersion: 2022 }));
    return out;
}
// ទទួលតែ call sites ដែលជាទ្វាររបស់ scope ពិត; មិនអនុញ្ញាត helper/shadow binding ផ្សេង។
function settlementProof(source, historicalRequired) {
    const all = nodes(source);
    const call = (n, name, args) => n && n.type === 'CallExpression' && n.callee.type === 'Identifier'
        && n.callee.name === name && n.arguments.length === args.length
        && n.arguments.every((a, i) => a.type === 'Identifier' && a.name === args[i]);
    const inside = (n, scope) => n.start > scope.start && n.end < scope.end;
    const ownedBy = (n, scope) => inside(n, scope) && !all.some(parent => parent !== scope
        && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(parent.type)
        && inside(parent, scope) && inside(n, parent));
    const directLoopGate = (gate, scope) => scope.body.body.some(loop => loop.type === 'ForStatement'
        && loop.test === null && loop.body.type === 'BlockStatement' && loop.body.body.includes(gate));
    const mains = all.filter(n => n.type === 'VariableDeclarator' && n.id.name === 'settle'
        && n.init && n.init.type === 'ArrowFunctionExpression' && n.init.async);
    const histories = all.filter(n => n.type === 'FunctionDeclaration' && n.id.name === 'waitForHistoricalSettlement' && n.async);
    if (mains.length !== 1 || histories.length !== (historicalRequired ? 1 : 0)) return null;
    const main = mains[0].init;
    const mainGates = all.filter(n => n.type === 'IfStatement' && inside(n, main)
        && n.consequent.type === 'ReturnStatement' && n.consequent.argument
        && n.consequent.argument.type === 'Literal' && n.consequent.argument.value === null);
    if (mainGates.length !== 1 || !directLoopGate(mainGates[0], main) || !call(mainGates[0].test, 'devicesSettled', ['states', 'done'])) return null;
    const mainReturns = all.filter(n => n.type === 'ReturnStatement' && ownedBy(n, main));
    if (mainReturns.length !== 2 || mainReturns.filter(n => n.argument?.type === 'Identifier' && n.argument.name === 'states').length !== 1) return null;
    const owned = [{ scope: main, gate: mainGates[0].test }];
    if (historicalRequired) {
        const scope = histories[0];
        const returns = all.filter(n => n.type === 'ReturnStatement' && inside(n, scope));
        const gates = all.filter(n => n.type === 'IfStatement' && inside(n, scope)
            && n.consequent === returns[0]);
        const test = gates[0] && gates[0].test;
        if (returns.length !== 1 || returns[0].argument?.type !== 'Identifier' || returns[0].argument.name !== 'dump'
            || gates.length !== 1 || !directLoopGate(gates[0], scope) || test.type !== 'LogicalExpression' || test.operator !== '&&'
            || !call(test.left, 'devicesSettled', ['states', 'done']) || !call(test.right, 'accepts', ['dump'])) return null;
        owned.push({ scope, gate: test.left });
    }
    const imports = all.filter(n => n.type === 'VariableDeclarator' && n.id.type === 'ObjectPattern')
        .flatMap(n => n.id.properties).filter(p => p.type === 'Property' && p.key.name === 'devicesSettled' && p.value.name === 'devicesSettled');
    if (imports.length !== 1) return null;
    const allowed = new Set([imports[0].key.start, imports[0].value.start, ...owned.map(o => o.gate.callee.start)]);
    const refs = new Set(all.filter(n => n.type === 'Identifier' && n.name === 'devicesSettled').map(n => n.start));
    if (refs.size !== allowed.size || [...refs].some(at => !allowed.has(at))) return null;
    // ការអាន ACK ត្រូវមាន catch fail-closed មួយ ក្នុង scope នីមួយៗ មិនមែនរាប់សរុបប៉ុណ្ណោះ។
    const fallbacks = all.filter(n => n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
        && n.callee.property.name === 'catch' && n.callee.object.type === 'CallExpression'
        && n.callee.object.callee.type === 'MemberExpression' && n.callee.object.callee.property.name === 'evaluate'
        && source.slice(n.callee.object.start, n.callee.object.end).includes('window.__settled()'));
    if (fallbacks.length !== owned.length) return null;
    for (const owner of owned) {
        const local = fallbacks.filter(n => ownedBy(n, owner.scope));
        if (local.length !== 1 || local[0].arguments.length !== 1
            || vm.runInNewContext('(' + source.slice(local[0].arguments[0].start, local[0].arguments[0].end) + ')()') !== false) return null;
    }
    return { gate: owned[0].gate, historical: histories[0], owned };
}
const day = '2026-10-01', month = '2026-10';
function fixture() {
    return {
        zoew_scan_history_cod_dod: { item: { id: 'item', phone: '012345678', scanDate: day,
            barcodes: [{ code: 'ONE', cod: 12.25, dod: 1.5, isClosed: true }, { code: 'TWO', cod: 3, dod: 0, isClosed: false }] } },
        zoew_daily_revenue_cod_dod: { [day]: { codDollar: 15.25, dodDollar: 1.5, totalCount: 2 } },
        zoew_monthly_revenue_cod_dod: { [month]: { codDollar: 15.25, dodDollar: 1.5, totalCount: 2 } },
        zoew_daily_pickup_cod_dod: { [day]: { packagesPickedUp: 1, pickedUpPhones: { '012345678': 1 }, pickedUpBarcodes: { ONE: '012345678' } } },
        zoew_barcode_registry: { ONE: true, TWO: true }
    };
}
scenario('អថេរលុយរួមពិត', () => {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'audit-tools/money-multidevice-core.js'), 'utf8'), { module });
    const { invariant, invariantBroken } = module.exports;
    const verdict = (dump, known = ['ONE', 'TWO']) => invariantBroken(invariant(dump, day, month, known));
    check('ទិន្នន័យត្រឹមត្រូវមិនក្រហម', verdict(fixture()) === null);
    const poisons = [
        ['ledger ថ្ងៃបូកស្ទួន', (d) => { d.zoew_daily_revenue_cod_dod[day].codDollar += 12.25; }],
        ['ledger ខែបូកស្ទួន', (d) => { d.zoew_monthly_revenue_cod_dod[month].dodDollar += 1.5; }],
        ['ចំនួនយកស្ទួន', (d) => { d.zoew_daily_pickup_cod_dod[day].packagesPickedUp++; }],
        ['pickup អត្តសញ្ញាណខុស តែចំនួនដដែល', (d) => { d.zoew_daily_pickup_cod_dod[day].pickedUpBarcodes = { TWO: '012345678' }; }],
        ['pickup ម្ចាស់ខុស', (d) => { d.zoew_daily_pickup_cod_dod[day].pickedUpBarcodes.ONE = '099'; }],
        ['pickup លេខទូរស័ព្ទខុស តែផលបូកដដែល', (d) => { d.zoew_daily_pickup_cod_dod[day].pickedUpPhones = { '099': 1 }; }],
        ['barcode ស្ទួនក្នុងធុងសំរាម', (d) => { d.zoew_recently_deleted_cod_dod = { duplicate: d.zoew_scan_history_cod_dod.item }; }],
        ['registry កំព្រា', (d) => { d.zoew_barcode_registry.GHOST = true; }],
        ['registry ខ្វះ', (d) => { delete d.zoew_barcode_registry.ONE; }],
        ['ដកលុយគ្មាន ledger', (d) => { d.zoew_scan_history_cod_dod.item.barcodes[0].isDeducted = true; }]
    ];
    for (const [label, poison] of poisons) {
        const dump = fixture(); poison(dump);
        check(label, !!verdict(dump));
    }
    check('barcode ដែលធ្លាប់មានត្រូវរកឃើញថាបាត់', !!verdict(fixture(), ['ONE', 'TWO', 'LOST']));
});
scenario('journal observation follows current v2 entries and preserves legacy HOLD', () => {
    const entries = new Map();
    const localStorage = {
        get length() { return entries.size; },
        key: (i) => [...entries.keys()][i] ?? null,
        getItem: (key) => entries.get(key) ?? null,
        setItem: (key, value) => { entries.set(key, String(value)); },
        removeItem: (key) => { entries.delete(key); }
    };
    const cleanupPrefix = 'zoew_cleanup_journal_v2:', pickupPrefix = 'zoew_pickup_journal_v2:';
    const read = (prefix) => [...entries].filter(([key]) => key.startsWith(prefix)).map(([, value]) => JSON.parse(value));
    const window = {
        CLEANUP_JOURNAL_KEY: cleanupPrefix, CLEANUP_LEGACY_JOURNAL_KEY: 'zoew_cleanup_journal_v1',
        PICKUP_JOURNAL_V2_PREFIX: pickupPrefix, PICKUP_JOURNAL_KEY: 'zoew_pickup_journal_v1',
        readCleanupJournal: () => read(cleanupPrefix), readPickupJournal: () => read(pickupPrefix),
        connectionFlowSnapshot: () => ({ phase: 'ready' }), scanHistory: [], deletedItems: []
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'audit-tools/money-multidevice-core.js'), 'utf8'),
        { module, window, localStorage, document: { getElementById: () => null } });
    module.exports.PAGE_OPS();
    check('empty current and legacy journals are settled', window.__state().cleanupJournal === 0 && window.__state().pickupJournal === 0);
    localStorage.setItem(cleanupPrefix + 'current', JSON.stringify({ id: 'current', stage: 'collected' }));
    localStorage.setItem(pickupPrefix + 'intent', JSON.stringify({ id: 'intent', protocol: 2, stage: 'started' }));
    localStorage.setItem(window.CLEANUP_LEGACY_JOURNAL_KEY, '[]');
    localStorage.setItem(window.PICKUP_JOURNAL_KEY, '[]');
    check('empty cleanup v1 cannot hide current cleanup v2', window.__state().cleanupJournal === 1);
    check('empty pickup v1 cannot hide current pickup v2', window.__state().pickupJournal === 1);
    localStorage.setItem(window.CLEANUP_LEGACY_JOURNAL_KEY, JSON.stringify([{ id: 'old-cleanup' }]));
    localStorage.setItem(window.PICKUP_JOURNAL_KEY, JSON.stringify([{ id: 'old-pickup' }]));
    check('legacy cleanup HOLD remains pending beside v2', window.__state().cleanupJournal === 2);
    check('legacy pickup HOLD remains pending beside v2', window.__state().pickupJournal === 2);
    entries.delete(window.CLEANUP_LEGACY_JOURNAL_KEY); entries.delete(window.PICKUP_JOURNAL_KEY);
    const oldReader = window.readCleanupJournal;
    window.readCleanupJournal = () => [];
    check('reader silently omitting stored current cleanup fails closed', window.__state().cleanupJournal === -1);
    window.readCleanupJournal = oldReader;
    localStorage.setItem(pickupPrefix + 'intent', '{broken');
    check('malformed current pickup fails closed', window.__state().pickupJournal === -1);
    localStorage.setItem(pickupPrefix + 'intent', JSON.stringify({ id: 'intent' }));
    localStorage.setItem(window.CLEANUP_LEGACY_JOURNAL_KEY, 'null');
    check('malformed legacy cleanup cannot look empty', window.__state().cleanupJournal === -1);
    entries.clear();
    localStorage.setItem('zoew_pickup_completed_v2:receipt', JSON.stringify({ id: 'receipt', outcome: 'reset-cancelled' }));
    check('terminal pickup receipt is not a pending journal entry', window.__state().pickupJournal === 0);
    delete window.CLEANUP_JOURNAL_KEY;
    check('missing current cleanup key export fails closed', window.__state().cleanupJournal === -1);
    window.CLEANUP_JOURNAL_KEY = cleanupPrefix;
    delete window.readPickupJournal;
    check('missing current pickup reader fails closed', window.__state().pickupJournal === -1);
});
for (const file of [path.join('emu', 'money-multidevice-emu-test.js'), 'supabase-money-multishop-test.js']) {
    scenario(file + ' ទ្វារស្ងប់', () => {
        const source = fs.readFileSync(path.join(ROOT, 'audit-tools', file), 'utf8');
        const all = nodes(source);
        const imports = all.filter((n) => n.type === 'VariableDeclarator' && n.id.type === 'ObjectPattern'
            && n.id.properties.some((p) => p.type === 'Property' && p.key.name === 'devicesSettled' && p.value.name === 'devicesSettled'));
        const imported = imports[0] && imports[0].init;
        const corePath = path.join(ROOT, 'audit-tools/money-multidevice-core.js');
        const realImport = imports.length === 1 && imported && imported.type === 'CallExpression'
            && imported.callee.name === 'require' && imported.arguments.length === 1
            && typeof imported.arguments[0].value === 'string'
            && path.resolve(ROOT, 'audit-tools', path.dirname(file), imported.arguments[0].value) === corePath;
        check(file + ' ទ្វារស្ងប់នាំចូល helper រួមពិត', realImport);
        const historicalRequired = file.startsWith('emu');
        const proof = settlementProof(source, historicalRequired);
        const realGate = !!proof;
        const gate = proof && proof.gate;
        check(file + ' ទ្វារស្ងប់មានម្ចាស់ scope ពិត និងគ្មាន helper ជំនួស', realGate);
        // មិនប្រើ `false` ជំនួស helper ដែលបាត់៖ វាធ្វើឱ្យ negative controls បៃតងដោយគ្មានការវាស់។
        if (!realImport || !realGate) return;
        const core = { exports: {} };
        vm.runInNewContext(fs.readFileSync(corePath, 'utf8'), { module: core });
        const devicesSettled = core.exports.devicesSettled;
        check(file + ' helper ទ្វារស្ងប់រួមមាន implementation ពិត', typeof devicesSettled === 'function');
        if (typeof devicesSettled !== 'function') return;
        const good = { pending: 0, rows: 0, phase: 'ready', cleanupJournal: 0, pickupJournal: 0, blocked: 0, trashClaims: 0 };
        const settled = (states, done) => vm.runInNewContext(source.slice(gate.start, gate.end), { states, done, devicesSettled });
        check(file + ' គ្មានឧបករណ៍ មិនមែនស្ងប់', !settled([], []));
        for (const count of [2, 3]) {
            const states = Array.from({ length: count }, () => ({ ...good }));
            const done = states.map(() => true);
            check(file + ' ឧបករណ៍ ' + count + ' ស្ងប់ពិត', settled(states, done));
            for (const key of ['pending', 'rows', 'cleanupJournal', 'pickupJournal', 'blocked', 'trashClaims']) {
                for (const value of [1, -1, undefined]) {
                    states[count - 1][key] = value;
                    check(file + ' ឧបករណ៍ចុងក្រោយ ' + key + '=' + String(value) + ' មិនត្រូវស្ងប់', !settled(states, done));
                }
                states[count - 1][key] = 0;
            }
            done[count - 1] = false;
            check(file + ' operation មិនទាន់ចប់', !settled(states, done));
            done[count - 1] = 1;
            check(file + ' operation គ្មាន ACK true ពិត', !settled(states, done));
            done[count - 1] = true;
            check(file + ' ចំនួន ACK ខ្វះមិនមែនស្ងប់', !settled(states, done.slice(1)));
            check(file + ' ចំនួន ACK លើសមិនមែនស្ងប់', !settled(states, done.concat(true)));
            states[count - 1].phase = 'recovering';
            check(file + ' recovering មិនមែន ready', !settled(states, done));
        }
        const raceGates = all.filter((n) => n.type === 'IfStatement' &&
            /injections\.returnRace\+\+/.test(source.slice(n.consequent.start, n.consequent.end)))
            .filter((n, _, candidates) => !candidates.some((child) => child !== n && child.start > n.start && child.end < n.end));
        check(file + ' រកឃើញច្រករាប់ return race មួយ', raceGates.length === 1);
        const race = raceGates[0] ? source.slice(raceGates[0].start, raceGates[0].end) : '';
        for (const outcomes of [[null, null, null], ['zreturn', null, null], ['zreturn', 'zreturn', 'zreturn']]) {
            const shop = { trail: [], coverage: { returnRace: 0 } };
            const plan = outcomes.map(() => ({ wanted: 'zreturn', shop }));
            const injections = { returnRace: 0 };
            vm.runInNewContext(race, { target: { code: 'ONE' }, trail: [], shop, plan, plans: plan, started: outcomes, injections,
                runCoverage: { returnRace: 0 } });
            check(file + ' return race រាប់តែឧបករណ៍ទាំងអស់ចាប់ផ្តើម ' + JSON.stringify(outcomes),
                injections.returnRace === (outcomes.every((outcome) => outcome === 'zreturn') ? 1 : 0));
        }
        const sweepGates = all.filter((n) => n.type === 'IfStatement' &&
            /injections\.sweepRace\+\+/.test(source.slice(n.consequent.start, n.consequent.end)))
            .filter((n, _, candidates) => !candidates.some((child) => child !== n && child.start > n.start && child.end < n.end));
        check(file + ' រកឃើញច្រករាប់ sweep race មួយ', sweepGates.length === 1);
        const sweep = sweepGates[0] ? source.slice(sweepGates[0].test.start, sweepGates[0].test.end) : 'false';
        for (const outcomes of [[null, null, null], ['sweep', null, null], ['sweep', 'sweep', 'sweep']]) {
            const shop = {};
            const plan = outcomes.map(() => ({ wanted: 'sweep', shop }));
            check(file + ' sweep race មិនរាប់តែផែនការ ' + JSON.stringify(outcomes),
                !!vm.runInNewContext(sweep, { item: {}, ids: ['item'], shop, plan, plans: plan, started: outcomes }) ===
                outcomes.every((outcome) => outcome === 'sweep'));
        }
        if (file.startsWith('supabase')) {
            const modeNode = all.find((n) => n.type === 'VariableDeclarator' && n.id.name === 'mode');
            check('Supabase រកឃើញការកំណត់ mode', !!modeNode);
            for (const count of [2, 3]) {
                const modes = Array.from({ length: count }, (_, deviceIndex) => modeNode ? vm.runInNewContext(
                    source.slice(modeNode.init.start, modeNode.init.end), { i: 1, deviceIndex, randomMode: 'online', r: () => 0 }) : null);
                check('Supabase ជុំកំណត់មាន offline ទាំងពីរ សម្រាប់ឧបករណ៍ ' + count,
                    modes.includes('offline-online') && modes.includes('offline-reload'));
            }
            const returnFloors = all.filter((n) => n.type === 'CallExpression' && n.callee.name === 'check' && n.arguments[0] &&
                source.slice(n.arguments[0].start, n.arguments[0].end).includes('returnRace'));
            check('Supabase រកឃើញជាន់ return មួយ', returnFloors.length === 1);
            const returnFloor = returnFloors[0] ? source.slice(returnFloors[0].arguments[0].start, returnFloors[0].arguments[0].end) : 'false';
            for (const missing of [false, true]) {
                const shops = [{ coverage: { returnRace: 2 } }, { coverage: { returnRace: missing ? 0 : 1 } }];
                check('Supabase return race ត្រូវដល់គ្រប់ហាង missing=' + missing,
                    vm.runInNewContext(returnFloor, { shops, SHOPS: 2, injections: { returnRace: 2 } }) === !missing);
            }
            const floors = all.filter((n) => n.type === 'CallExpression' && n.callee.name === 'check' && n.arguments[0] &&
                source.slice(n.arguments[0].start, n.arguments[0].end).includes('offlineOnline'));
            check('Supabase រកឃើញជាន់ offline មួយ', floors.length === 1);
            const floor = floors[0] ? source.slice(floors[0].arguments[0].start, floors[0].arguments[0].end) : 'false';
            for (const missing of [false, true]) {
                const shops = [{ coverage: { offlineOnline: 2, offlineReload: 2 } },
                    { coverage: { offlineOnline: missing ? 0 : 1, offlineReload: missing ? 0 : 1 } }];
                check('Supabase offline ត្រូវដល់គ្រប់ហាង missing=' + missing,
                    vm.runInNewContext(floor, { shops, injections: { offlineOnline: 2, offlineReload: 2 } }) === !missing);
            }
        }
        check(file + ' ការអាន operation បរាជ័យត្រូវ fail closed តាម scope នីមួយៗ',
            proof.owned.length === (historicalRequired ? 2 : 1));
        if (historicalRequired) {
            const mutations = [
                ['dead nested historical gate', source.replace('if (devicesSettled(states, done) && accepts(dump)) return dump;', 'function unusedHistoricalGuard() { if (devicesSettled(states, done) && accepts(dump)) return dump; }')],
                ['dead conditional historical gate', source.replace('if (devicesSettled(states, done) && accepts(dump)) return dump;', 'if (false) { if (devicesSettled(states, done) && accepts(dump)) return dump; }')],
                ['main extra success return', source.replace('const settle = async () => {', 'const settle = async () => { return null;')],
                ['callback shadow helper', source.replace('const started = now();', 'const unused = (devicesSettled) => devicesSettled([], []); const started = now();')],
                ['dead nested main gate', source.replace('if (devicesSettled(states, done)) return null;', 'function unusedSettlementGuard() { if (devicesSettled(states, done)) return null; }')],
                ['dead conditional main gate', source.replace('if (devicesSettled(states, done)) return null;', 'if (false) { if (devicesSettled(states, done)) return null; }')],
                ['main helper replacement', source.replace('if (devicesSettled(states, done)) return null;', 'if (true) return null;')],
                ['historical helper replacement', source.replace('devicesSettled(states, done) && accepts(dump)', 'true && accepts(dump)')],
                ['server predicate bypass', source.replace('devicesSettled(states, done) && accepts(dump)', 'devicesSettled(states, done)')],
                ['OR predicate bypass', source.replace('devicesSettled(states, done) && accepts(dump)', 'devicesSettled(states, done) || accepts(dump)')],
                ['historical early return', source.replace('const started = now();', 'return {}; const started = now();')],
                ['shadow helper', source.replace('const started = now();', 'const devicesSettled = () => true; const started = now();')],
                ['wrong ACK identity', source.replace('devicesSettled(states, done) && accepts(dump)', 'devicesSettled(states, states) && accepts(dump)')],
                ['historical ACK catch accepts error', source.replace('window.__settled()).catch(() => false)', 'window.__settled()).catch(() => true)')]
            ];
            for (const [label, mutant] of mutations) check('settlement structural negative: ' + label,
                mutant !== source && settlementProof(mutant, true) === null);
        }
    });
}
(async () => {
    // រត់ historical gateway ពិត ជាមួយ helper រួមពិត និងនាឡិកាកំណត់បាន; គ្មាន browser/DB claim។
    const historicalSource = fs.readFileSync(path.join(ROOT, 'audit-tools/emu/money-multidevice-emu-test.js'), 'utf8');
    const historicalProof = settlementProof(historicalSource, true);
    check('historical executable gateway has the verified AST owner', !!historicalProof);
    if (historicalProof) {
        const core = { exports: {} };
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'audit-tools/money-multidevice-core.js'), 'utf8'), { module: core });
        const fn = historicalProof.historical;
        const wait = vm.runInNewContext('(' + historicalSource.slice(fn.start, fn.end) + ')',
            { devicesSettled: core.exports.devicesSettled, Date, sleep: async () => {} });
        const ready = { pending: 0, rows: 0, phase: 'ready', cleanupJournal: 0, pickupJournal: 0, blocked: 0, trashClaims: 0 };
        const cases = ['valid', 'server-not-accepted', 'ACK-false', 'ACK-not-boolean', 'ACK-throws', 'no-devices',
            ...['pending', 'rows', 'cleanupJournal', 'pickupJournal', 'blocked', 'trashClaims'].flatMap(k => [k + ':1', k + ':-1', k + ':missing'])];
        for (const kind of cases) {
            let tick = 0;
            const state = { ...ready };
            if (kind.includes(':')) {
                const [key, value] = kind.split(':');
                if (value === 'missing') delete state[key]; else state[key] = Number(value);
            }
            const device = { state: async () => state, page: { evaluate: async () => {
                if (kind === 'ACK-throws') throw new Error('injected ACK transport error');
                return kind === 'ACK-false' ? false : kind === 'ACK-not-boolean' ? 1 : true;
            } } };
            const dump = { accepted: kind !== 'server-not-accepted', receipt: 'synthetic-operation' };
            let result, error;
            try {
                result = await wait(kind === 'no-devices' ? [] : [device], async () => dump, value => value.accepted,
                    600, () => tick * 300, async () => { tick++; });
            } catch (e) { error = e; }
            check('historical actual bounded gateway: ' + kind, kind === 'valid'
                ? result === dump && !error && tick === 0
                : !result && error?.message === 'Historical v2 operation did not settle with its expected server state' && tick === 2);
        }
    }
    for (const file of [path.join('emu', 'money-multidevice-emu-test.js'), 'supabase-money-multishop-test.js']) {
        try {
            const source = fs.readFileSync(path.join(ROOT, 'audit-tools', file), 'utf8');
            const all = nodes(source);
            const proof = settlementProof(source, file.startsWith('emu'));
            check(file + ' main executable gateway has verified ownership', !!proof);
            if (proof) {
                const core = { exports: {} };
                vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'audit-tools/money-multidevice-core.js'), 'utf8'), { module: core });
                for (const kind of ['valid', 'pending', 'journal', 'claim', 'ACK-false', 'ACK-throws']) {
                    let tick = 0;
                    const state = { pending: kind === 'pending' ? 1 : 0, rows: 0, phase: 'ready', cleanupJournal: 0,
                        pickupJournal: kind === 'journal' ? 1 : 0, blocked: 0, trashClaims: kind === 'claim' ? 1 : 0 };
                    const device = { sync: async () => {}, state: async () => state, page: { evaluate: async () => {
                        if (kind === 'ACK-throws') throw new Error('injected main ACK transport failure');
                        return kind !== 'ACK-false';
                    } } };
                    const main = proof.owned[0].scope;
                    const settle = vm.runInNewContext('(' + source.slice(main.start, main.end) + ')', {
                        devices: [device], devicesSettled: core.exports.devicesSettled, DEBUG: false,
                        Date: { now: () => tick * 61000 }, sleep: async () => { tick++; }
                    });
                    const result = await settle();
                    check(file + ' actual main bounded gateway: ' + kind, kind === 'valid'
                        ? result === null && tick === 0
                        : Array.isArray(result) && result.length === 1 && result[0] === state && tick === 1);
                }
            }
            for (const action of ['reload', 'goOffline']) {
                const statements = all.filter((n) => n.type === 'ExpressionStatement' && n.expression.type === 'AwaitExpression')
                    .filter((n) => {
                        const text = source.slice(n.start, n.end);
                        return action === 'reload' ? text.startsWith('await p.dev.page.reload(') : text.startsWith('await p.dev.page.evaluate(') && text.includes('fb.goOffline(db)');
                    });
                check(file + ' រកឃើញការចាក់ ' + action + ' មួយ', statements.length === 1);
                const reject = async () => { throw new Error('injected transport failure'); };
                let failed = false;
                try {
                    await vm.runInNewContext('(async () => {' + (statements[0] ? source.slice(statements[0].start, statements[0].end) : '') + '})()',
                        { p: { dev: { page: { reload: reject, evaluate: reject } } } });
                } catch (e) { failed = e.message === 'injected transport failure'; }
                check(file + ' ការចាក់ ' + action + ' បរាជ័យ មិនត្រូវបៃតង', failed);
            }
        } catch (e) { check(file + ' ការចាក់បណ្តាញ', false, e.message); }
    }
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ok ' + pass : 'PASS ' + pass + '/' + pass));
    process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
