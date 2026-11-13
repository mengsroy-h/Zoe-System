import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = process.env.KEYGEN_AUTH_RECOVERY_SOURCE_ROOT || path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(sourceRoot, 'ZoeKeyGen/app.js'), 'utf8');
const nodes = require('acorn').parse(source, { ecmaVersion: 'latest' }).body;
const functions = ['attemptAuthStorageRecovery', 'setupAuthListener'].map(name => {
  const node = nodes.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  if (!node) throw new Error('Missing actual function: ' + name);
  return source.slice(node.start, node.end);
}).join('\n');
const drain = async () => { for (let n = 0; n < 3; n++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function fixture(options: { hidden?: boolean; enumerationPending?: boolean; deletionPending?: boolean; attempted?: boolean; enumerationError?: boolean; deletionResult?: string; noIndexedDB?: boolean } = {}) {
  const enumeration = deferred();
  const storage = new Map(options.attempted ? [['zoe_auth_recovery_attempted', '1']] : []);
  const events = new Set<() => void>();
  const timers = [];
  const callbacks = [];
  const requests = [];
  const calls = { enumerations: 0, deleted: [], reloads: 0, login: 0, roles: [], authUi: [] };
  const rows = [{ name: 'firebaseLocalStorageDb' }, { name: 'business-retained' }, { name: 'firebase-heartbeat-database' }];
  let config = '{"project":"synthetic-A"}';
  let now = 0;
  const authA = { currentUser: null };
  const sdk = { onAuthStateChanged: (auth, callback) => { const row = { auth, callback, unsubscribed: false }; callbacks.push(row); return () => { row.unsubscribed = true; }; } };
  const indexedDB = {
    databases: () => { calls.enumerations++; if (options.enumerationError) throw new Error('synthetic enumeration refusal'); return options.enumerationPending ? enumeration.promise : Promise.resolve(rows); },
    deleteDatabase: name => {
      calls.deleted.push(name);
      const request = {}; requests.push(request);
      if (!options.deletionPending) queueMicrotask(() => request[options.deletionResult || 'onsuccess']?.());
      return request;
    }
  };
  const document = { hidden: !!options.hidden,
    addEventListener: (name, callback) => { if (name === 'visibilitychange') events.add(callback); },
    removeEventListener: (name, callback) => { if (name === 'visibilitychange') events.delete(callback); } };
  const ctx = vm.createContext({ console, Promise, document, indexedDB,
    window: { ...(options.noIndexedDB ? {} : { indexedDB }), location: { reload: () => calls.reloads++ } },
    auth: authA, fb: sdk, authGeneration: 7, authRecoveryTimeout: null, authUnsubscribe: null, pendingRoleRecheck: false,
    appLocalStore: { getItem: () => config }, appSessionStore: storage,
    safeStoreGet: (store, key) => store instanceof Map ? store.get(key) : store.getItem(key),
    safeStoreSet: (store, key, value) => { store.set(key, value); return true; },
    showLoginModalWithPrefill: () => calls.login++,
    verifyAdminRoleThenProceed: (user, generation) => calls.roles.push([user.uid, generation]),
    updateAuthButton: value => calls.authUi.push(value),
    setTimeout: (callback, delay) => { const timer = { callback, delay, at: now + delay, dead: false, fired: false }; timers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.dead = true; }
  });
  vm.runInContext('const AUTH_STUCK_RECOVERY_FLAG = "zoe_auth_recovery_attempted";\n' + functions, ctx);
  return { ctx, calls, storage, timers, callbacks, requests, events, authA, sdk,
    setup: () => ctx.setupAuthListener(),
    advance(ms) { now += ms; for (const timer of [...timers]) if (!timer.dead && !timer.fired && timer.at <= now) { timer.fired = true; timer.callback(); } },
    visible(hidden = false) { document.hidden = hidden; for (const callback of [...events]) callback(); },
    emit(user, index = callbacks.length - 1, replaceCurrent = true) { if (replaceCurrent) callbacks[index].auth.currentUser = user; callbacks[index].callback(user); },
    resolveEnumeration: () => enumeration.resolve(rows),
    changeConfig: () => { config = '{"project":"synthetic-B"}'; }
  };
}
function expectNoRecovery(f) {
  expect(f.calls.deleted).toEqual([]); expect(f.calls.reloads).toBe(0);
  expect(f.storage.has('zoe_auth_recovery_attempted')).toBe(false);
}
it('ZoeKeyGen៖ វគ្គលាក់រង់ចាំ auth ៨ វិនាទី មិនលុប storage ឬចំណាយសញ្ញាស្តារ', async () => {
  const f = fixture({ hidden: true }); f.setup(); f.advance(7999); await drain(); expect(f.calls.enumerations).toBe(0);
  f.advance(1); await drain(); expectNoRecovery(f); expect(f.calls.enumerations).toBe(0);
});
it('ZoeKeyGen៖ ត្រឡប់មើលឃើញក្រោយពិដាន ស្តារម្តងតែប៉ុណ្ណោះ', async () => {
  const f = fixture({ hidden: true, enumerationPending: true }); f.setup(); f.advance(8000); await drain();
  expect(f.calls.enumerations).toBe(0); f.visible(); f.visible(); await drain(); expect(f.calls.enumerations).toBe(1);
  f.resolveEnumeration(); await drain(); expect(f.calls.deleted).toEqual(['firebaseLocalStorageDb', 'firebase-heartbeat-database']); expect(f.calls.reloads).toBe(1);
  f.visible(); await drain(); expect(f.calls.enumerations).toBe(1);
});
it('ZoeKeyGen៖ visibility មុនពិដាន មិនចាប់ផ្តើមស្តារមុន ៨ វិនាទី', async () => {
  const f = fixture({ hidden: true }); f.setup(); f.advance(7999); f.visible(); await drain(); expectNoRecovery(f); expect(f.calls.enumerations).toBe(0);
  f.advance(1); await drain(); expect(f.calls.reloads).toBe(1);
});
for (const change of ['auth-response', 'signed-out-response', 'auth', 'sdk', 'generation', 'config', 'unsubscribe', 'new-listener', 'hidden']) {
  it('ZoeKeyGen៖ ' + change + ' កណ្តាលការអានបញ្ជី IDB មិនបន្តលុប', async () => {
    const f = fixture({ enumerationPending: true }); f.setup(); f.advance(8000); await drain(); expect(f.calls.enumerations).toBe(1);
    if (change === 'auth-response') f.emit({ uid: 'current-admin' });
    if (change === 'signed-out-response') f.emit(null);
    if (change === 'auth') f.ctx.auth = { currentUser: null };
    if (change === 'sdk') f.ctx.fb = { ...f.sdk };
    if (change === 'generation') f.ctx.authGeneration++;
    if (change === 'config') f.changeConfig();
    if (change === 'unsubscribe') f.ctx.authUnsubscribe();
    if (change === 'new-listener') f.setup();
    if (change === 'hidden') f.visible(true);
    f.resolveEnumeration(); await drain(); expectNoRecovery(f);
    expect(f.calls.roles).toEqual(change === 'auth-response' ? [['current-admin', 8]] : []);
    expect(f.calls.login).toBe(change === 'signed-out-response' ? 1 : 0);
  });
}
it('ZoeKeyGen៖ លាក់កណ្តាល enumeration រួចត្រឡប់មកវិញ អាចស្តារដោយម្ចាស់ដើម', async () => {
  const f = fixture({ enumerationPending: true }); f.setup(); f.advance(8000); await drain(); f.visible(true); f.resolveEnumeration(); await drain(); expectNoRecovery(f);
  f.visible(); await drain(); expect(f.calls.reloads).toBe(1); expect(f.calls.deleted).toHaveLength(2);
});
for (const change of ['auth-response', 'generation', 'hidden']) {
  it('ZoeKeyGen៖ ' + change + ' កណ្តាល delete ដំបូង មិនលុប DB បន្ទាប់ ឬ reload', async () => {
    const f = fixture({ deletionPending: true }); f.setup(); f.advance(8000); await drain();
    expect(f.calls.deleted).toEqual(['firebaseLocalStorageDb']);
    if (change === 'auth-response') f.emit({ uid: 'current-admin' });
    if (change === 'generation') f.ctx.authGeneration++;
    if (change === 'hidden') f.visible(true);
    f.requests[0].onsuccess(); await drain(); expect(f.calls.deleted).toEqual(['firebaseLocalStorageDb']); expect(f.calls.reloads).toBe(0);
  });
}
for (const user of [null, { uid: 'obsolete-admin' }]) {
  it('ZoeKeyGen៖ callback listener ដែលផ្តាច់រួច មិនប៉ះវគ្គ ឬ timer ថ្មី ' + (user?.uid || 'null'), async () => {
    const f = fixture(); f.setup(); f.setup(); expect(f.callbacks[0].unsubscribed).toBe(true);
    f.emit(user, 0); expect(f.ctx.authGeneration).toBe(7); expect(f.calls.login).toBe(0); expect(f.calls.roles).toEqual([]); expect(f.calls.authUi).toEqual([]);
    f.advance(8000); await drain(); expect(f.calls.reloads).toBe(1);
  });
}
it('ZoeKeyGen៖ listener បច្ចុប្បន្ន ទទួល user → null → user ជាធម្មតា', async () => {
  const f = fixture(); f.setup(); f.emit({ uid: 'first-admin' }); f.emit(null); f.emit({ uid: 'second-admin' }); f.advance(8000); await drain();
  expect(f.calls.roles).toEqual([['first-admin', 8], ['second-admin', 10]]); expect(f.calls.login).toBe(1); expect(f.calls.authUi).toEqual([false]); expectNoRecovery(f);
});
it('ZoeKeyGen៖ auth ឆ្លើយមុនពិដាន ទោះ tab លាក់ក៏បិទ recovery', async () => {
  const f = fixture({ hidden: true }); f.setup(); f.emit(null); f.advance(8000); f.visible(); await drain(); expectNoRecovery(f); expect(f.calls.login).toBe(1);
});
it('ZoeKeyGen៖ វគ្គមើលឃើញ auth មិនឆ្លើយ ស្តារ Firebase DB តែប៉ុណ្ណោះ', async () => {
  const f = fixture(); f.setup(); f.advance(8000); await drain(); expect(f.calls.deleted).toEqual(['firebaseLocalStorageDb', 'firebase-heartbeat-database']); expect(f.calls.reloads).toBe(1); expect(f.storage.get('zoe_auth_recovery_attempted')).toBe('1');
});
it('ZoeKeyGen៖ ស្តារម្តងរួចក្នុង session បើក login ជំនួសលុបឡើងវិញ', async () => {
  const f = fixture({ attempted: true }); f.setup(); f.advance(8000); await drain(); expect(f.calls.deleted).toEqual([]); expect(f.calls.reloads).toBe(0); expect(f.calls.login).toBe(1);
});
for (const failure of ['enumeration', 'onerror', 'onblocked', 'absent']) {
  it('ZoeKeyGen៖ storage ' + failure + ' នៅវគ្គបច្ចុប្បន្ន រក្សាផ្លូវ reload', async () => {
    const f = fixture({ enumerationError: failure === 'enumeration', deletionResult: failure, noIndexedDB: failure === 'absent' }); f.setup(); f.advance(8000); await drain(); expect(f.calls.reloads).toBe(1); expect(f.storage.get('zoe_auth_recovery_attempted')).toBe('1');
  });
}

for (const hidden of [false, true]) {
  it('ZoeKeyGen៖ ជំនាន់ auth ប្រែមុន recovery ចាប់ផ្តើម មិនស្តារវគ្គចាស់ ' + hidden, async () => {
    const f = fixture({ hidden }); f.setup();
    if (hidden) { f.advance(8000); await drain(); }
    f.ctx.authGeneration++;
    if (hidden) f.visible(); else f.advance(8000);
    await drain(); expectNoRecovery(f); expect(f.calls.enumerations).toBe(0); expect(f.events.size).toBe(0);
  });
}
it('ZoeKeyGen៖ callback user ចាស់ដែលមិនមែន currentUser មិនកែ UI ឬបិទ timer', async () => {
  const f = fixture(); f.setup(); const current = { uid: 'current-admin' }; f.authA.currentUser = current;
  f.emit({ uid: 'obsolete-admin' }, 0, false);
  expect(f.ctx.authGeneration).toBe(7); expect(f.calls.roles).toEqual([]); expect(f.calls.login).toBe(0);
  f.emit(current); f.advance(8000); await drain(); expect(f.calls.roles).toEqual([['current-admin', 8]]); expectNoRecovery(f);
});
