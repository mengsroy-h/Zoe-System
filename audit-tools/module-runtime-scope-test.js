const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { moduleRuntime } = require('./react-view');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'module-scope-'));
try {
    fs.mkdirSync(path.join(root, 'ZoeW'));
    const views = {
        a: 'const text = x => "A" + x; let count = 0; function first(x) { count++; return text(x); }',
        b: 'const text = x => "B" + x; function second(x) { return text(x); }',
        c: 'function first(x) { return x; }'
    };
    fs.writeFileSync(path.join(root, 'ZoeW/audit-module-views.json'), JSON.stringify(views));
    const src = Object.values(views).join('\n');
    const runtime = moduleRuntime(root, src, [{ path: 'a', expose: ['first', 'count'] }, { path: 'b', expose: ['second'] }]);
    const ctx = vm.createContext({});
    vm.runInContext(runtime.code, ctx);
    assert.equal(ctx.first('x'), 'Ax'); assert.equal(ctx.second('x'), 'Bx');
    assert.equal(ctx.count, 1); ctx.count = 4; ctx.first('x'); assert.equal(ctx.count, 5);
    assert.equal(ctx.text, undefined);
    assert.throws(() => moduleRuntime(root, src, ['a', 'b']), /duplicate module binding text/);
    assert.throws(() => moduleRuntime(root, src, [{ path: 'a', expose: ['first'] }, 'c']), /duplicate module binding first/);
    assert.throws(() => moduleRuntime(root, src, [{ path: 'a', expose: ['absent'] }]), /missing exposed binding/);
    for (const expose of [['first', 'first'], ['bad-name'], [null], 'first'])
        assert.throws(() => moduleRuntime(root, src, [{ path: 'a', expose }]), /invalid expose descriptor/);
    const old = vm.createContext({}); vm.runInContext(moduleRuntime(root, src, ['a']).code, old);
    assert.equal(old.text('x'), 'Ax'); assert.equal(old.first('x'), 'Ax');
    assert.throws(() => moduleRuntime(root, '', [{ path: 'a', expose: ['first'] }]), /mismatched actual module/);
    console.log('PASS moduleRuntime explicit scopes, live state, duplicate/missing/invalid rejection, unchanged default');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
