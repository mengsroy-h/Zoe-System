import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = process.env.KEYGEN_LOGIN_SOURCE_ROOT || path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(sourceRoot, 'ZoeKeyGen/app.js'), 'utf8');
const declarations = new Map();
for (const node of require('acorn').parse(source, { ecmaVersion: 'latest' }).body) {
  if (node.type === 'FunctionDeclaration') declarations.set(node.id.name, source.slice(node.start, node.end));
  if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) {
    if (declaration.id.type === 'Identifier') declarations.set(declaration.id.name, source.slice(node.start, node.end));
  }
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const drain = () => new Promise(resolve => setImmediate(resolve));
function fixture(stage = 'persistence') {
  const gate = deferred();
  const calls = { persistence: [], signIn: [], alerts: [], storage: [], roles: [], toasts: [] };
  const elements = {
    loginEmailInput: { value: 'admin@example.invalid' },
    loginPasswordInput: { value: 'synthetic-password' },
    rememberMeCheckbox: { checked: true },
    loginBtn: { disabled: false, textContent: 'ចូលប្រព័ន្ធ' }
  };
  const optionsA = { apiKey: 'synthetic-api-key-A', databaseURL: 'https://fixture-a.firebaseio.com', projectId: 'fixture-a' };
  const optionsB = { apiKey: 'synthetic-api-key-B', databaseURL: 'https://fixture-b.firebaseio.com', projectId: 'fixture-b' };
  const authA = { project: 'A', currentUser: null, app: { options: optionsA } };
  const authB = { project: 'B', currentUser: null, app: { options: optionsB } };
  const user = { uid: 'synthetic-admin' };
  let config = JSON.stringify(optionsA);
  let entered = false;
  const sdk = {
    browserSessionPersistence: {},
    async setPersistence(auth) {
      calls.persistence.push(auth.project);
      if (stage === 'persistence') { entered = true; await gate.promise; }
    },
    async signInWithEmailAndPassword(auth, email, password) {
      calls.signIn.push({ project: auth.project, email, password });
      if (stage === 'sign-in') { entered = true; await gate.promise; }
      auth.currentUser = user;
      return { user };
    }
  };
  const intentValues = new Map<string, string>();
  const sessionValues = new Map<string, string>();
  const ctx = vm.createContext({
    console, Promise, crypto: require('node:crypto').webcrypto,
    appSessionStore: { get length() { return sessionValues.size; }, key: i => [...sessionValues.keys()][i] ?? null, getItem: key => sessionValues.get(key) ?? null, setItem: (key, value) => sessionValues.set(key, value) },
    document: { getElementById: id => elements[id] },
    fb: stage === 'sdk' ? null : sdk, auth: authA, authGeneration: 7,
    isInitializingFirebase: false, firebaseSdkUnavailable: false,
    keygenLoginOwner: null,
    waitForFirebaseSDK: async () => { entered = true; await gate.promise; return sdk; },
    withTimeout: promise => promise,
    appLocalStore: {
      get length() { return intentValues.size + 1; }, key: i => i === 0 ? 'zoew_firebase_config' : [...intentValues.keys()][i - 1] ?? null,
      getItem: key => key === 'zoew_firebase_config' ? config : intentValues.get(key) ?? null,
      setItem: (key, value) => { intentValues.set(key, value); calls.storage.push(['set', key, value]); },
      removeItem: key => calls.storage.push(['remove', key])
    },
    safeStoreGet: (store, key) => store.getItem(key),
    verifyAdminRoleThenProceed: (value, generation) => calls.roles.push([value.uid, generation]),
    showToast: message => calls.toasts.push(message),
    alert: message => calls.alerts.push(message), window: {}
  });
  vm.runInContext(['LOCAL_LOGOUT_INTENT_PREFIX', 'createLocalLogoutIntentStore', 'localLogoutIntent', 'acceptedLogoutIntents', 'keygenLogoutOwner', 'FIREBASE_CONFIG_KEYS', 'keygenAuthScope', 'keygenLoginBackendIsReady', 'enforceSessionOnlyAuthPersistence', 'doLogin']
    .filter(name => declarations.has(name)).map(name => declarations.get(name)).join('\n'), ctx);
  return {
    ctx, sdk, authA, authB, elements, calls, gate, user,
    entered: () => entered,
    switchProject() { config = JSON.stringify(optionsB); ctx.auth = authB; ctx.authGeneration++; },
    changeConfig(value = JSON.stringify(optionsB)) { config = value; }
  };
}
for (const change of ['project', 'auth', 'config', 'generation']) {
  it('ZoeKeyGen៖ persistence យឺត + ប្តូរ ' + change + ' មិនផ្ញើ credentials ចាស់', async () => {
    const f = fixture(); const work = f.ctx.doLogin(); await drain();
    expect(f.entered()).toBe(true); expect(f.calls.persistence).toEqual(['A']);
    if (change === 'project') f.switchProject();
    if (change === 'auth') f.ctx.auth = f.authB;
    if (change === 'config') f.changeConfig();
    if (change === 'generation') f.ctx.authGeneration++;
    f.elements.loginPasswordInput.value = 'replacement-password';
    f.gate.resolve(); await work;
    expect(f.calls.signIn).toEqual([]); expect(f.calls.storage).toEqual([]);
    expect(f.calls.alerts).toEqual([]);
    expect(f.elements.loginPasswordInput.value).toBe('replacement-password');
    expect(f.elements.loginBtn.disabled).toBe(false);
  });
}
it('ZoeKeyGen៖ SDK ចាស់មកយឺតមិនជំនួស SDK ឬចូល project ថ្មី', async () => {
  const f = fixture('sdk'); const work = f.ctx.doLogin(); await drain();
  expect(f.entered()).toBe(true);
  f.switchProject(); const replacementSdk = { replacement: true }; f.ctx.fb = replacementSdk;
  f.gate.resolve(); await work;
  expect(f.ctx.fb).toBe(replacementSdk); expect(f.calls.persistence).toEqual([]);
  expect(f.calls.signIn).toEqual([]); expect(f.calls.storage).toEqual([]);
});
for (const result of ['resolve', 'reject']) {
  it('ZoeKeyGen៖ login ចាស់ ' + result + ' ក្រោយប្តូរ project មិនប៉ះវគ្គថ្មី', async () => {
    const f = fixture('sign-in'); const work = f.ctx.doLogin(); await drain();
    expect(f.calls.signIn).toHaveLength(1); expect(f.calls.signIn[0].project).toBe('A');
    f.switchProject(); f.elements.loginPasswordInput.value = 'replacement-password';
    if (result === 'resolve') f.gate.resolve(); else f.gate.reject(new Error('synthetic failure'));
    await work;
    expect(f.calls.storage).toEqual([]); expect(f.calls.roles).toEqual([]); expect(f.calls.alerts).toEqual([]);
    expect(f.elements.loginPasswordInput.value).toBe('replacement-password');
  });
}
it('ZoeKeyGen៖ ចុចស្ទួនពេល persistence រង់ចាំបង្កើត login តែមួយ', async () => {
  const f = fixture(); const first = f.ctx.doLogin(); await drain();
  const second = f.ctx.doLogin(); await drain(); f.gate.resolve(); await Promise.all([first, second]);
  expect(f.calls.persistence).toEqual(['A']); expect(f.calls.signIn).toHaveLength(1);
  expect(f.calls.roles).toEqual([['synthetic-admin', 8]]);
});
it('ZoeKeyGen៖ login ធម្មតាប្រើ Auth ដើម និងជម្រើស remember ពេលចុច', async () => {
  const f = fixture(); const work = f.ctx.doLogin(); await drain();
  f.elements.rememberMeCheckbox.checked = false;
  f.gate.resolve(); await work;
  expect(f.calls.signIn).toEqual([{ project: 'A', email: 'admin@example.invalid', password: 'synthetic-password' }]);
  expect(f.calls.storage).toEqual([['set', 'remembered_email', 'admin@example.invalid']]);
  expect(f.calls.roles).toEqual([['synthetic-admin', 8]]);
  expect(f.elements.loginPasswordInput.value).toBe(''); expect(f.elements.loginBtn.disabled).toBe(false);
});
it('ZoeKeyGen៖ auth listener ផ្ទៀង user ដដែលមិនបោះចោល remember ជោគជ័យ', async () => {
  const f = fixture('sign-in'); const work = f.ctx.doLogin(); await drain();
  f.ctx.authGeneration++; f.authA.currentUser = f.user;
  f.gate.resolve(); await work;
  expect(f.calls.storage).toEqual([['set', 'remembered_email', 'admin@example.invalid']]);
  expect(f.calls.roles).toEqual([]); expect(f.elements.loginPasswordInput.value).toBe('');
});
it('ZoeKeyGen៖ ចម្លើយចាស់មិនដោះ busy ឬលុប password របស់ login ថ្មី', async () => {
  const f = fixture(); const first = f.ctx.doLogin(); await drain();
  f.switchProject();
  f.elements.loginEmailInput.value = 'replacement@example.invalid';
  f.elements.loginPasswordInput.value = 'replacement-password';
  const secondGate = deferred();
  f.sdk.signInWithEmailAndPassword = async (auth, email, password) => {
    f.calls.signIn.push({ project: auth.project, email, password });
    await secondGate.promise; auth.currentUser = f.user; return { user: f.user };
  };
  const second = f.ctx.doLogin(); await drain(); f.gate.resolve(); await drain();
  try {
    expect(f.calls.signIn).toEqual([{ project: 'B', email: 'replacement@example.invalid', password: 'replacement-password' }]);
    expect(f.elements.loginBtn.disabled).toBe(true);
    expect(f.elements.loginPasswordInput.value).toBe('replacement-password');
  } finally {
    secondGate.resolve(); await Promise.all([first, second]);
  }
  expect(f.elements.loginBtn.disabled).toBe(false); expect(f.elements.loginPasswordInput.value).toBe('');
  expect(f.elements.loginBtn.textContent).toBe('ចូលប្រព័ន្ធ');
  expect(f.calls.storage).toEqual([['set', 'remembered_email', 'replacement@example.invalid']]);
});
it('ZoeKeyGen៖ SDK មកទាន់វគ្គដើមអាចចូល និងគោរព remember បិទ', async () => {
  const f = fixture('sdk'); f.elements.rememberMeCheckbox.checked = false;
  const work = f.ctx.doLogin(); await drain(); f.gate.resolve(); await work;
  expect(f.ctx.fb).toBe(f.sdk); expect(f.calls.persistence).toEqual(['A']);
  expect(f.calls.signIn).toHaveLength(1); expect(f.calls.signIn[0].project).toBe('A');
  expect(f.calls.storage).toEqual([['remove', 'remembered_email']]);
});
it('ZoeKeyGen៖ login បរាជ័យក្នុងវគ្គដើមបង្ហាញសារ និងដោះ busy', async () => {
  const f = fixture('sign-in'); const work = f.ctx.doLogin(); await drain();
  f.gate.reject(new Error('synthetic rejected credentials')); await work;
  expect(f.calls.alerts).toHaveLength(1); expect(f.calls.storage).toEqual([]);
  expect(f.elements.loginBtn.disabled).toBe(false); expect(f.elements.loginPasswordInput.value).toBe('');
});
for (const condition of ['initializing', 'switching', 'failed-switch', 'sdk-unavailable', 'different-api-key', 'malformed-config', 'missing-config', 'missing-auth']) {
  it('ZoeKeyGen៖ ' + condition + ' មិនទទួល login មុន Auth ត្រូវ Config', async () => {
    const f = fixture('ready');
    if (condition === 'initializing' || condition === 'switching') f.ctx.isInitializingFirebase = true;
    if (condition === 'switching' || condition === 'failed-switch') f.changeConfig();
    if (condition === 'sdk-unavailable') f.ctx.firebaseSdkUnavailable = true;
    if (condition === 'different-api-key') f.changeConfig(JSON.stringify({ ...f.authA.app.options, apiKey: 'synthetic-other-key' }));
    if (condition === 'malformed-config') f.changeConfig('{');
    if (condition === 'missing-config') f.changeConfig(null);
    if (condition === 'missing-auth') f.ctx.auth = null;
    const work = f.ctx.doLogin(); await drain(); f.gate.resolve(); await work;
    expect(f.calls.persistence).toEqual([]); expect(f.calls.signIn).toEqual([]);
    expect(f.calls.storage).toEqual([]); expect(f.calls.toasts).toHaveLength(1);
    expect(f.elements.loginBtn.disabled).toBe(false);
    expect(f.elements.loginPasswordInput.value).toBe('synthetic-password');
  });
}
it('ZoeKeyGen៖ init ចាប់ផ្តើមកណ្តាល persistence ទោះ Config ដដែល ក៏មិនផ្ញើ login ចាស់', async () => {
  const f = fixture(); const work = f.ctx.doLogin(); await drain();
  expect(f.entered()).toBe(true); f.ctx.isInitializingFirebase = true;
  f.gate.resolve(); await work;
  expect(f.calls.signIn).toEqual([]); expect(f.calls.storage).toEqual([]);
});
it('ZoeKeyGen៖ init project ដដែលចប់ រួច login សាកម្ដងទៀតបាន', async () => {
  const f = fixture('ready'); f.ctx.isInitializingFirebase = true;
  await f.ctx.doLogin(); f.ctx.isInitializingFirebase = false; await f.ctx.doLogin();
  expect(f.calls.persistence).toEqual(['A']); expect(f.calls.signIn).toHaveLength(1);
  expect(f.calls.signIn[0].project).toBe('A'); expect(f.elements.loginBtn.disabled).toBe(false);
});
it('ZoeKeyGen៖ Auth ថ្មីត្រូវ Config ថ្មី អាចទទួល login ថ្មី', async () => {
  const f = fixture('ready'); f.switchProject(); await f.ctx.doLogin();
  expect(f.calls.persistence).toEqual(['B']); expect(f.calls.signIn).toHaveLength(1);
  expect(f.calls.signIn[0].project).toBe('B');
});
