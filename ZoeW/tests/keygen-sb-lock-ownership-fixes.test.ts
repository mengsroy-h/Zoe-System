import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const root = process.env.AUTH_FIX_SOURCE_ROOT || path.resolve(__dirname, '../..');
const acorn = require('acorn');
const src = fs.readFileSync(path.join(root, 'ZoeKeyGen/app.js'), 'utf8');
const ast = acorn.parse(src, {ecmaVersion: 'latest'});
const decl = new Map();
for (const n of ast.body) {
  if (n.type === 'FunctionDeclaration') decl.set(n.id.name, src.slice(n.start, n.end));
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
    if (d.id.type === 'Identifier') decl.set(d.id.name, 'var ' + src.slice(d.start, d.end) + ';');
  }
}
const fns = ['captureSensitiveSession', 'isSensitiveSessionCurrent', 'adminOwnerIsCurrent',
  'invalidateSensitiveSession', 'clearSigningKey', 'lockKeygenSession', 'sbAdminLogin',
  'sbAdminLogout', 'sbAdminReset', 'sbAdminConfigProblem', 'sbAdminJwtRole',
  'sbAdminRequest', 'setSbAdminBusy', 'sbInputValue'];
const vars = [...decl.keys()].filter(n => /^(sb[A-Z]|SB_)/.test(n) && !/^\s*(async )?function/.test(decl.get(n)));
const code = [...vars, ...fns].map(n => {assert(decl.has(n), n); return decl.get(n);}).join('\n');
function deferred() {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};}
const drain = () => new Promise(r => setImmediate(r));
async function scenario(action, stage) {
  const els = new Map();
  function el(id) {
    if (!els.has(id)) {
      const classes = new Set(['sbAdminPanel', 'sbAdminLogoutBtn'].includes(id) ? ['hidden'] : []);
      els.set(id, {value: '', textContent: '', innerHTML: '', disabled: false,
        classList: {add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c)}});
    }
    return els.get(id);
  }
  const gate = deferred(); const calls = []; const toasts = []; const alerts = [];
  let enteredGate = false;
  const ctx = vm.createContext({URL, atob, console, Date, Promise,
    document: {getElementById: el, querySelectorAll: () => []},
    safeStoreSet() {}, safeStoreRemove() {}, updateSigningKeyBadge() {}, refreshKgStatus() {},
    renderSbLookupTargets() {}, showToast: t => toasts.push(t), alert: t => alerts.push(t),
    sbAdminRefresh: async () => {},
    fetchWithTimeout: async (url, _init) => {
      calls.push(url.replace('https://fixture.supabase.co', ''));
      if ((stage === 'token' && url.includes('/token')) || (stage === 'admins' && url.includes('/platform_admins'))) {
        enteredGate = true; await gate.promise;
      }
      const body = url.includes('/token') ? {access_token:'synthetic-access-token'}
        : url.includes('/platform_admins') ? [{user_id:'fixture-admin'}] : {};
      return {res: {ok:true,status:200}, body: JSON.stringify(body)};
    }
  });
  vm.runInContext(code, ctx);
  vm.runInContext(`var auth = {currentUser: {uid: 'fixture-admin'}};
    var isSignedInUiActive = true, authGeneration = 1, sensitiveSessionGeneration = 1;
    var appLocalStore = {}, appSessionStore = {}, SIGNING_KEY_SESSION_STORAGE_KEY = 'fixture';
    var signingPrivateKeyJwk = null, signingKeySessionKey = null, signingKeyLastUseAt = 0;
    var isGeneratingKey = false, generateKeyOwner = null, lookupSetupGeneration = 0, lastGeneratedSetupLink = '';`, ctx);
  el('sbAdminUrlInput').value = 'https://fixture.supabase.co';
  el('sbAdminKeyInput').value = 'sb_publishable_fixture';
  el('sbAdminEmailInput').value = 'fixture@example.test';
  el('sbAdminPasswordInput').value = 'fixture-password';
  const p = ctx.sbAdminLogin();
  await drain(); assert.equal(enteredGate,true);
  assert.equal(ctx.sbAdminSession,null);
  const before = {sensitive:ctx.sensitiveSessionGeneration, admin:ctx.sbAdminGeneration};
  if (action === 'lock') ctx.lockKeygenSession(true);
  if (action === 'logout') ctx.sbAdminLogout();
  const after = {sensitive:ctx.sensitiveSessionGeneration, admin:ctx.sbAdminGeneration};
  gate.resolve(); await p; await drain();
  const row = {action, stage, before, after, acceptedSession:!!ctx.sbAdminSession,
    panelVisible:!el('sbAdminPanel').classList.contains('hidden'), calls,
    passwordCleared:el('sbAdminPasswordInput').value === '', toasts, alerts};
  if(action === 'logout') assert.equal(row.acceptedSession,false);
  if(action === 'none') assert.equal(row.acceptedSession,true);
  return row;
}
for (const stage of ['token','admins']) for (const action of ['none','lock','logout']) {
  it('F07៖ '+stage+' → '+action+' គោរព admin session ownership',async()=>{
    const result=await scenario(action,stage);
    expect(result.acceptedSession).toBe(action==='none');
    expect(result.panelVisible).toBe(action==='none');
    expect(result.passwordCleared).toBe(true);
  });
}
