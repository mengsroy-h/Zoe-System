import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const shared = path.join(process.env.AUTH_PROBE_SOURCE_ROOT || path.resolve(__dirname, '../..'), 'supabase/functions/_shared');
const modules = new Map();
function load(file: string) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  modules.set(file, exports);
  const source = fs.readFileSync(path.join(shared, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'require', js)(exports, (name: string) => {
    if (!/^\.\/[a-z-]+\.ts$/.test(name)) throw new Error('unexpected import ' + name);
    return load(name.slice(2));
  });
  return exports;
}
const { adminDeps } = load('admin-deps.ts');
const TIMEOUT = 100;
const USER = '11111111-1111-4111-8111-111111111111';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const drain = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
function sessionReply(sessionId = '22222222-2222-4222-8222-222222222222') {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = encode({ alg: 'HS256' }) + '.' + encode({ exp, sub: USER, session_id: sessionId }) + '.synthetic';
  return { token, response: new Response(JSON.stringify({ access_token: token, refresh_token: 'synthetic-refresh',
    token_type: 'bearer', expires_in: 3600, user: { id: USER, email: 'fixture@users.zoew.invalid' } }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }) };
}
const clients: SupabaseClient[] = [];
const releases: (() => void)[] = [];
let clientSequence = 0;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  await drain();
  for (const client of clients.splice(0)) await client.auth.dispose();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
async function fixture(hangLogout = false) {
  const token = deferred<Response>(), logout = deferred<Response>();
  releases.push(() => { token.resolve(new Response('{}', { status: 400 })); logout.resolve(new Response(null, { status: 204 })); });
  const background: Promise<unknown>[] = [];
  vi.stubGlobal('EdgeRuntime', { waitUntil: (task: Promise<unknown>) => background.push(task) });
  const requests: { path: string; authorization: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ path: url.pathname + url.search, authorization: new Headers(init?.headers).get('Authorization') || '' });
    if (url.pathname.endsWith('/token')) return token.promise;
    if (url.pathname.endsWith('/logout') && hangLogout) return logout.promise;
    return new Response(null, { status: 204 });
  };
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } };
  const openClient = () => createClient('https://fixture.supabase.co', 'sb_secret_synthetic_only',
    { ...options, auth: { ...options.auth, storageKey: 'synthetic-probe-' + ++clientSequence } });
  const admin = openClient(), probe = openClient();
  clients.push(admin, probe);
  await Promise.all([admin.auth.initialize(), probe.auth.initialize()]);
  const adminSignOut = vi.spyOn(admin.auth, 'signOut');
  return { admin, probe, token, logout, background, requests, adminSignOut,
    deps: adminDeps(admin, TIMEOUT, () => probe) };
}
it.each([TIMEOUT, TIMEOUT + 1])('probe login មកនៅ %sms ក្រោយ UNKNOWN ត្រូវដកតែ session ផ្ទាល់របស់វា', async (delay) => {
  const f = await fixture();
  const work = f.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  await drain(); expect(f.requests.filter(r => r.path.includes('/token'))).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(delay); expect(await work).toBeUndefined();
  const reply = sessionReply(); f.token.resolve(reply.response); await drain();
  await Promise.all(f.background);
  const logouts = f.requests.filter(r => r.path.includes('/logout'));
  expect(logouts).toEqual([{ path: '/auth/v1/logout?scope=local', authorization: 'Bearer ' + reply.token }]);
  expect((await f.probe.auth.getSession()).data.session).toBeNull();
  expect(f.background).toHaveLength(1); expect(f.adminSignOut).not.toHaveBeenCalled();
});
it('probe login ទាន់ពេលនៅបញ្ជាក់ user ហើយដក session ម្តង', async () => {
  const f = await fixture(); const work = f.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  await drain(); f.token.resolve(sessionReply().response); expect(await work).toBe(USER);
  expect(f.requests.filter(r => r.path.includes('/logout'))).toHaveLength(1);
  expect((await f.probe.auth.getSession()).data.session).toBeNull(); expect(f.adminSignOut).not.toHaveBeenCalled();
});
for (const late of [false, true]) {
  it('probe password បដិសេធ ' + (late ? 'យឺត' : 'ទាន់ពេល') + ' មិនបង្កើត logout ឬប្តូរ UNKNOWN', async () => {
    const f = await fixture(); const work = f.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
    await drain();
    if (late) await vi.advanceTimersByTimeAsync(TIMEOUT + 1);
    f.token.resolve(new Response(JSON.stringify({ code: 'invalid_credentials', msg: 'synthetic refusal' }),
      { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } }));
    expect(await work).toBe(late ? undefined : null); await drain(); await Promise.all(f.background);
    expect(f.requests.filter(r => r.path.includes('/logout'))).toEqual([]);
    expect(f.adminSignOut).not.toHaveBeenCalled();
  });
}
it('probe cleanup ព្យួរមានពិដាន ហើយមិនលាក់ user ដែលផ្ទៀងរួច', async () => {
  const f = await fixture(true); const work = f.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  let settled = false; work.then(() => { settled = true; });
  await drain(); f.token.resolve(sessionReply().response); await drain();
  expect(f.requests.filter(r => r.path.includes('/logout'))).toHaveLength(1); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(TIMEOUT + 1); expect(settled).toBe(true); expect(await work).toBe(USER);
  await Promise.all(f.background); expect(f.adminSignOut).not.toHaveBeenCalled();
});
it('probe login ព្យួរមិនរក្សា Edge worker ហួសពិដាន login និង cleanup', async () => {
  const f = await fixture(); const work = f.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  await drain(); expect(f.background).toHaveLength(1);
  let released = false; f.background[0].then(() => { released = true; });
  await vi.advanceTimersByTimeAsync(TIMEOUT + 1); expect(await work).toBeUndefined();
  expect(released).toBe(false);
  await vi.advanceTimersByTimeAsync(TIMEOUT); expect(released).toBe(true);
  expect(f.requests.filter(r => r.path.includes('/logout'))).toEqual([]);
  expect(f.adminSignOut).not.toHaveBeenCalled();
});
it('admin client មិនអាចប្រើជំនួស probe ហើយគ្មាន credential request', async () => {
  const f = await fixture(); const deps = adminDeps(f.admin, TIMEOUT, () => f.admin);
  expect(await deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password')).toBeUndefined();
  expect(f.requests).toEqual([]); expect(f.adminSignOut).not.toHaveBeenCalled();
});
it('គ្មាន EdgeRuntime ក៏រក្សាការផ្ទៀងនិង cleanup ទាន់ពេល', async () => {
  const f = await fixture(); vi.stubGlobal('EdgeRuntime', undefined);
  const work = f.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  await drain(); f.token.resolve(sessionReply().response); expect(await work).toBe(USER);
  expect(f.requests.filter(r => r.path.includes('/logout'))).toHaveLength(1);
  expect(f.background).toEqual([]); expect(f.adminSignOut).not.toHaveBeenCalled();
});
it('probe ពីរស្របគ្នាប្រើ admin ដូចគ្នា តែដកតែ token ក្នុង probe របស់ខ្លួន', async () => {
  const a = await fixture(), b = await fixture();
  const second = adminDeps(a.admin, TIMEOUT, () => b.probe);
  const workA = a.deps.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  const workB = second.passwordUserId('fixture@users.zoew.invalid', 'synthetic-password');
  await drain(); await vi.advanceTimersByTimeAsync(TIMEOUT + 1);
  expect(await workA).toBeUndefined(); expect(await workB).toBeUndefined();
  const replyA = sessionReply('33333333-3333-4333-8333-333333333333');
  const replyB = sessionReply('44444444-4444-4444-8444-444444444444');
  a.token.resolve(replyA.response); b.token.resolve(replyB.response); await drain();
  await Promise.all(b.background);
  expect(a.requests.filter(r => r.path.includes('/logout'))).toEqual([
    { path: '/auth/v1/logout?scope=local', authorization: 'Bearer ' + replyA.token }
  ]);
  expect(b.requests.filter(r => r.path.includes('/logout'))).toEqual([
    { path: '/auth/v1/logout?scope=local', authorization: 'Bearer ' + replyB.token }
  ]);
  expect(b.background).toHaveLength(2);
  expect(a.adminSignOut).not.toHaveBeenCalled(); expect(b.adminSignOut).not.toHaveBeenCalled();
});
