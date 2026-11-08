import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.env.KEYGEN_CLOCK_SOURCE_ROOT || path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'ZoeKeyGen/app.js'), 'utf8');
const ast = require('acorn').parse(source, { ecmaVersion: 'latest' });
const declarations = new Map();
for (const node of ast.body) {
  if (node.type === 'FunctionDeclaration') declarations.set(node.id.name, source.slice(node.start, node.end));
  if (node.type === 'VariableDeclaration') for (const d of node.declarations) declarations.set(d.id.name, source.slice(node.start, node.end));
}
function fixture() {
  const clock = { wall: 1794139200000, mono: 1000 };
  class FakeDate extends Date { static now() { return clock.wall; } }
  const calls = [];
  const c = vm.createContext({ Date: FakeDate, performance: { now: () => clock.mono },
    invalidateSensitiveSession() {}, updateSigningKeyBadge() {}, requestSessionSigningKeyRestoreIfEligible() {}, isPinFlowPending: () => false,
    hasUncopiedKeypair: () => false, lockKeygenSession() {}, logoutApp: () => calls.push('logout'),
    sbAdminReset() {}, sbAdminRevoke: () => calls.push('revoke'), showToast() {} });
  const names = ['elapsedSince', 'keygenIdleStamp', 'keygenIdleElapsed', 'SIGNING_KEY_IDLE_MS', 'KEYGEN_IDLE_LOGOUT_MS', 'SB_ADMIN_IDLE_MS',
    'expireIdleSigningKey', 'expireIdleKeygenSession', 'expireIdleSbAdmin', 'noteSigningKeyActivity', 'noteKeygenActivity', 'sbAdminActivity', 'khmerMinutes'];
  vm.runInContext(names.filter(name => declarations.has(name)).map(name => declarations.get(name)).join('\n') + `
    var signingPrivateKeyJwk = {synthetic:true}, signingKeySessionKey = {}, isGeneratingKey = false;
    var authButtonIsLoggedIn = true, sbAdminSession = {}, sbAdminBusy = false;
    var signingKeyLastUseAt = typeof keygenIdleStamp === 'function' ? keygenIdleStamp() : Date.now();
    var keygenLastActivityAt = typeof keygenIdleStamp === 'function' ? keygenIdleStamp() : Date.now();
    var sbAdminLastUseAt = typeof keygenIdleStamp === 'function' ? keygenIdleStamp() : Date.now();`, c);
  return { c, calls, clock, advance(ms) { clock.wall += ms; clock.mono += ms; } };
}
for (const fn of ['expireIdleSigningKey', 'expireIdleKeygenSession', 'expireIdleSbAdmin']) {
  it(fn + '៖ partial rollback ក្រោយ ៣៥ នាទីត្រូវផុតកំណត់', () => {
    const h = fixture(); h.advance(35*60000); h.clock.wall -= 30*60000;
    expect(h.c[fn]()).toBe(true);
  });
  it(fn + '៖ ពេល ៥ នាទីធម្មតានៅអាចប្រើ', () => {
    const h = fixture(); h.advance(5*60000); expect(h.c[fn]()).toBe(false);
  });
  it(fn + '៖ suspension មិនបន្ត credentials', () => {
    const h = fixture(); h.clock.wall += 35*60000; expect(h.c[fn]()).toBe(true);
  });
}
for (const note of ['noteSigningKeyActivity', 'noteKeygenActivity', 'sbAdminActivity']) it(note + '៖ activity ក្រោយ partial rollback មិនបន្ត credential ចាស់', () => {
  const h = fixture(); h.advance(35*60000); h.clock.wall -= 30*60000;
  h.c[note]();
  if (note === 'noteSigningKeyActivity') expect(h.c.signingPrivateKeyJwk).toBe(null);
  if (note === 'noteKeygenActivity') expect(h.calls).toContain('logout');
  if (note === 'sbAdminActivity') expect(h.calls).toContain('revoke');
});
it('keygenIdleElapsed៖ malformed stamp មិន throw និងផុតកំណត់', () => {
  const h = fixture();
  expect(typeof h.c.keygenIdleElapsed).toBe('function');
  for (const value of [undefined, null, NaN, 0, {}, [], {wall: NaN, mono: 1}, {wall: h.clock.wall, mono: Infinity}]) expect(h.c.keygenIdleElapsed(value)).toBe(Infinity);
});
