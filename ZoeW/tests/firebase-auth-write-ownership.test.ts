// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';

let native: typeof import('firebase/auth');
let apps: typeof import('firebase/app');
let fetchResponse: (url: string, init: RequestInit) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => fetchResponse(String(url), init));
  apps = await import('firebase/app');
  native = await import('firebase/auth');
});
afterAll(() => vi.unstubAllGlobals());
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
const reply = (uid: string) => {
  const now = Math.floor(Date.now() / 1000);
  const token = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, user_id: uid, aud: 'audit-auth', iss: 'https://securetoken.google.com/audit-auth', iat: now, exp: now + 3600, auth_time: now })).toString('base64url') + '.fake-signature';
  return new Response(JSON.stringify({ localId: uid, idToken: token, refreshToken: 'fake-' + uid, expiresIn: '3600' }), { status: 200 });
};
for (const mode of ['logout', 'replacement', 'normal']) {
  it('real Firebase Auth: pending sign-in ownership after ' + mode, async () => {
    const app = apps.initializeApp({ apiKey: 'fake-audit-key', projectId: 'audit-auth' }, 'auth-race-' + mode);
    const auth = native.initializeAuth(app, { persistence: native.inMemoryPersistence });
    const sdk = withTransactionOutcomeResolution(native);
    await auth.authStateReady(); native.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const started = deferred<void>(); const old = deferred<Response>();
    const seen: (string | null)[] = [];
    const off = native.onAuthStateChanged(auth, user => seen.push(user?.uid ?? null));
    fetchResponse = async (url, init) => {
      if (url.includes('signInWithPassword')) {
        const body = JSON.parse(String(init.body));
        if (body.email === 'a@example.test') { started.resolve(); return old.promise; }
        return reply('B');
      }
      const body = JSON.parse(String(init.body));
      const uid = JSON.parse(Buffer.from(body.idToken.split('.')[1], 'base64url').toString()).sub;
      return new Response(JSON.stringify({ users: [{ localId: uid, email: uid.toLowerCase() + '@example.test', emailVerified: false }] }), { status: 200 });
    };
    const loginA = sdk.signInWithEmailAndPassword(auth, 'a@example.test', 'fake-audit-secret').catch(() => null);
    await started.promise;
    let loginB: Promise<unknown> | null = null;
    if (mode === 'logout') await sdk.signOut(auth);
    if (mode === 'replacement') loginB = sdk.signInWithEmailAndPassword(auth, 'b@example.test', 'fake-audit-secret');
    old.resolve(reply('A')); await loginA; if (loginB) await loginB;
    const uid = auth.currentUser?.uid ?? null;
    if (mode === 'normal') await sdk.signOut(auth);
    const afterSignOut = auth.currentUser?.uid ?? null;
    off(); await apps.deleteApp(app);
    expect(uid).toBe(mode === 'logout' ? null : mode === 'replacement' ? 'B' : 'A');
    if (mode !== 'normal') expect(seen).not.toContain('A');
    if (mode === 'normal') expect(afterSignOut).toBeNull();
  });
}
it('real Firebase Auth: a rejected request releases the guard and queue for a subsequent login', async () => {
  const app = apps.initializeApp({ apiKey: 'fake-audit-key', projectId: 'audit-auth' }, 'auth-race-rejected');
  const auth = native.initializeAuth(app, { persistence: native.inMemoryPersistence });
  const sdk = withTransactionOutcomeResolution(native);
  await auth.authStateReady(); native.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  fetchResponse = async (url, init) => {
    const body = JSON.parse(String(init.body));
    if (url.includes('signInWithPassword')) {
      if (body.email === 'a@example.test') return new Response(JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }), { status: 400 });
      return reply('B');
    }
    return new Response(JSON.stringify({ users: [{ localId: 'B', email: 'b@example.test' }] }), { status: 200 });
  };
  const denied = await sdk.signInWithEmailAndPassword(auth, 'a@example.test', 'fake-audit-secret').catch(e => e);
  const signed = await sdk.signInWithEmailAndPassword(auth, 'b@example.test', 'fake-audit-secret');
  await apps.deleteApp(app);
  expect(denied.code).toBe('auth/invalid-credential');
  expect(signed.user.uid).toBe('B');
});
