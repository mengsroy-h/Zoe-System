'use strict';
// Evaluate the SDK fixture's own date builder at fixed dates, not the host date.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const ROOT = path.resolve(process.env.SCANMONTHDATE_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '..'));
const fixtureFile = 'audit-tools/emu/scan-month-coordination-sdk-test.js';
const source = fs.readFileSync(path.join(ROOT, fixtureFile), 'utf8');
function functionSource(file, name) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const start = text.indexOf('function ' + name + '(');
    assert.ok(start >= 0, 'Missing function: ' + name);
    const open = text.indexOf('{', start);
    let depth = 1, end = open + 1;
    for (; depth && end < text.length; end++) {
        if (text[end] === '{') depth++;
        if (text[end] === '}') depth--;
    }
    assert.equal(depth, 0, 'Unbalanced function: ' + name);
    return text.slice(start, end);
}
const sessionSource = fs.readFileSync(path.join(ROOT, 'ZoeW/src/features/session.ts'), 'utf8');
function durationConstant(name) {
    const expression = sessionSource.match(new RegExp('export const ' + name + ' = ([0-9 *]+);'));
    assert.ok(expression, 'Missing numeric duration: ' + name);
    return vm.runInNewContext(expression[1]);
}
const context = vm.createContext({ Intl, Date, ABANDON_AGE_MS: durationConstant('ABANDON_AGE_MS'),
    trashRetentionMs: () => durationConstant('TRASH_RETENTION_MS') });
for (const [file, name] of [
    ['ZoeW/src/domain/barcode.ts', 'barcodeAbandonBasis'],
    ['ZoeW/src/domain/barcode.ts', 'barcodeAbandonIsRipe'],
    ['ZoeW/src/features/zto-list-sync.ts', 'ztoListRowAgeState'],
]) vm.runInContext(functionSource(file, name), context);
let dates;
if (source.includes('function scanMonthFixtureDates(')) {
    assert.match(source, /const fixtureDates = scanMonthFixtureDates\(Date.now\(\)\)/, 'capture real time once');
    assert.match(source, /at:fixtureDates\.at/, 'import rows must use tested arrival');
    assert.match(source, /from:fixtureDates\.from,to:fixtureDates\.to/, 'range must use tested dates');
    assert.match(source, /const \{ day, month \} = fixtureDates/, 'ledger assertions must use tested keys');
    vm.runInContext(functionSource(fixtureFile, 'scanMonthFixtureDates'), context);
    dates = now => context.scanMonthFixtureDates(now);
} else {
    // Baseline: evaluate the old fixture's actual fixed arrival and date keys.
    const arrival = source.match(/dod:0,at:'([^']+)'/);
    const keys = source.match(/const day = '([^']+)', month = '([^']+)'/);
    assert.ok(arrival && keys, 'Fixture initialization changed; update checker explicitly');
    dates = () => ({ at: arrival[1], day: keys[1], month: keys[2], from: '2026-10-25', to: '2026-10-31' });
}
let failures = 0, checks = 0;
function check(label, fn) {
    checks++;
    try { fn(); console.log('PASS ' + label); }
    catch (error) { failures++; console.error('FAIL ' + label + ': ' + error.message); }
}
const oldStamp = Date.parse('2026-10-30T02:00:00Z');
for (const [offset, state] of [[7 * 86400000, 'fresh'], [7 * 86400000 + 1, 'old'], [30 * 86400000, 'old'], [30 * 86400000 + 1, 'purged']]) {
    check('production age boundary ' + offset, () => assert.equal(context.ztoListRowAgeState(oldStamp, oldStamp + offset), state));
}
for (const instant of ['2026-11-06T02:12:06.404Z', '2026-12-31T16:59:59.999Z', '2026-12-31T17:00:00.000Z',
    '2027-01-31T17:00:00.000Z', '2028-02-29T17:00:00.000Z', '2030-06-01T00:00:00.000Z']) {
    check('fixture fresh and coherent at ' + instant, () => {
        const now = Date.parse(instant), fixture = dates(now);
        const stamp = Date.parse(fixture.at.replace(' ', 'T') + '+07:00');
        assert.ok(Number.isFinite(stamp), 'arrival must parse as Phnom Penh wall time');
        assert.equal(context.ztoListRowAgeState(stamp, now), 'fresh', 'fixture arrival expired');
        assert.ok(now - stamp >= 4 * 3600000 && now - stamp < 4 * 3600000 + 1000, 'arrival must be four hours before captured now, rounded to seconds');
        assert.equal(fixture.day, fixture.at.slice(0, 10));
        assert.equal(fixture.month, fixture.day.slice(0, 7));
        assert.equal(fixture.from, fixture.day);
        assert.equal(fixture.to, fixture.day);
    });
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exitCode = failures ? 1 : 0;
