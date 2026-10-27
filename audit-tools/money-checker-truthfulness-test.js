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
for (const file of [path.join('emu', 'money-multidevice-emu-test.js'), 'supabase-money-multishop-test.js']) {
    scenario(file + ' ទ្វារស្ងប់', () => {
        const source = fs.readFileSync(path.join(ROOT, 'audit-tools', file), 'utf8');
        const all = nodes(source);
        const gates = all.filter((n) => n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
            && n.callee.object.name === 'states' && n.callee.property.name === 'every');
        check(file + ' រកឃើញទ្វារស្ងប់ពិតមួយ', gates.length === 1);
        const gate = gates[0] ? source.slice(gates[0].start, gates[0].end) : 'false';
        const good = { pending: 0, rows: 0, phase: 'ready', cleanupJournal: 0, pickupJournal: 0, blocked: 0 };
        const settled = (states, done) => vm.runInNewContext(gate, { states, done });
        for (const count of [2, 3]) {
            const states = Array.from({ length: count }, () => ({ ...good }));
            const done = states.map(() => true);
            check(file + ' ឧបករណ៍ ' + count + ' ស្ងប់ពិត', settled(states, done));
            for (const key of ['pending', 'rows', 'cleanupJournal', 'pickupJournal', 'blocked']) {
                states[count - 1][key] = 1;
                check(file + ' ឧបករណ៍ចុងក្រោយ ' + key + ' មិនត្រូវស្ងប់', !settled(states, done));
                states[count - 1][key] = 0;
            }
            done[count - 1] = false;
            check(file + ' operation មិនទាន់ចប់', !settled(states, done));
            done[count - 1] = true;
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
        const fallback = all.filter((n) => n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
            && n.callee.property.name === 'catch' && n.callee.object.type === 'CallExpression'
            && n.callee.object.callee.type === 'MemberExpression' && n.callee.object.callee.property.name === 'evaluate'
            && source.slice(n.callee.object.start, n.callee.object.end).includes('window.__settled()'));
        check(file + ' ការអាន operation បរាជ័យត្រូវ fail closed', fallback.length === 1 &&
            vm.runInNewContext('(' + source.slice(fallback[0].arguments[0].start, fallback[0].arguments[0].end) + ')()') === false);
    });
}
(async () => {
    for (const file of [path.join('emu', 'money-multidevice-emu-test.js'), 'supabase-money-multishop-test.js']) {
        try {
            const source = fs.readFileSync(path.join(ROOT, 'audit-tools', file), 'utf8');
            const all = nodes(source);
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
