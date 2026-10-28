import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { dbListenerPendingPaths } from '../src/core/text';
import { discardPendingWrites, drawerDiscardPendingWritesFlow } from '../src/features/pending-writes';
import { securityState } from '../src/core/state';
import { SideDrawer } from '../src/app/components/SideDrawer';
import '../src/app/flush';
import { mount, step, unmount } from './native/react-harness';

const host = 'https://shop.firebaseio.com';
const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:'));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (window as any).ZoeErrors; });

function lab(update: any) {
  const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
    update, set: update, runTransaction: vi.fn(), deleteApp: async () => {}, get: async () => ({ val: () => null }) };
  const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true, isInitializingFirebase: false,
    firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
  return { sdk, db, app };
}
const verdictOf = (p: Promise<any>) => p.then(() => 'sent', (e: any) => e.code || e.message);

async function blockedFirebaseLab() {
  let resolve!: (v: any) => void; const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); await first.sdk.deleteApp(first.app);
  vi.stubGlobal('fetch', async () => Response.json({ uid: 'A', hash: 'f'.repeat(64), at: Date.now() }));
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  const before = await verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300));
  write.catch(() => {});
  return { ...second, dispatched, before };
}

it('Firebase ៖ the owner discard drops every journal row of the shop, records Sentry money, and the next write goes through', async () => {
  const l = await blockedFirebaseLab();
  const capture = vi.fn(); (window as any).ZoeErrors = { capture };
  vi.stubGlobal('confirm', () => true);
  viewState.connectionPhase = 'blocked';
  const done = await discardPendingWrites();
  const after = await verdictOf(l.sdk.set(l.sdk.ref(l.db, 'zoew_settings/exchange_rate'), 4400));
  expect({ before: l.before, done, after, rows: records().length, blocked: nativeWriteRecoveryState(l.db).blocked, dispatched: l.dispatched.mock.calls.length })
    .toEqual({ before: 'write_recovery_pending', done: true, after: 'sent', rows: 0, blocked: 0, dispatched: 1 });
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture.mock.calls[0][1]).toMatchObject({ zone: 'money', context: 'discardPendingWrites', count: 1, paths: 'zoew_settings/exchange_rate' });
});

it('Firebase ៖ discard keeps a row another tab is still writing (its Web Lock is held) and drops the rest', async () => {
  await blockedFirebaseLab();
  const [key] = records();
  const dead = JSON.parse(localStorage.getItem(key)!);
  const live = { ...dead, opId: 'native_livetab0000000000000001' };
  const liveKey = key.slice(0, key.lastIndexOf(':') + 1) + live.opId;
  localStorage.setItem(liveKey, JSON.stringify(live));
  const held = new Set(['zoew-write:' + live.opId]);
  const keptByDiscard: boolean[] = [];
  vi.stubGlobal('navigator', { onLine: true, locks: { request: async (name: string, options: any, callback?: any) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    if (!held.has(name)) return callback({ name });
    if (options.ifAvailable) return callback(null);
    await vi.waitFor(() => expect(held.has(name)).toBe(false), { timeout: 2000 });
    return callback({ name });
  } } });
  (window as any).ZoeErrors = { capture: vi.fn() };
  vi.stubGlobal('confirm', () => { setTimeout(() => { keptByDiscard.push(localStorage.getItem(liveKey) !== null); localStorage.removeItem(liveKey); held.clear(); }, 50); return true; });
  viewState.connectionPhase = 'blocked';
  expect(await discardPendingWrites()).toBe(true);
  expect({ keptByDiscard, rows: records().length }).toEqual({ keptByDiscard: [true], rows: 0 });
  expect((window as any).ZoeErrors.capture.mock.calls[0][1]).toMatchObject({ count: 1 });
});

it('a cancelled confirm discards nothing and the device stays blocked', async () => {
  const l = await blockedFirebaseLab();
  const capture = vi.fn(); (window as any).ZoeErrors = { capture };
  vi.stubGlobal('confirm', () => false);
  const done = await discardPendingWrites();
  const after = await verdictOf(l.sdk.set(l.sdk.ref(l.db, 'zoew_settings/exchange_rate'), 4400));
  expect({ done, refused: after !== 'sent', rows: records().length, captures: capture.mock.calls.length }).toEqual({ done: false, refused: true, rows: 1, captures: 0 });
});

it('Supabase ៖ discard drops the undecidable rows of this account and shop only and unblocks the session', async () => {
  const rows = new Map<string, any>();
  const journal = { put: (row: any) => { rows.set(row.opId, structuredClone(row)); return true; },
    list: (scope: string, topic: string) => [...rows.values()].filter(x => x.scope === scope && x.topic === topic),
    remove: (_s: string, _t: string, id: string) => rows.delete(id) };
  journal.put({ v: 1, scope: 'project|user', topic: 'zoe:A', stage: 'unresolved', opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  journal.put({ v: 1, scope: 'project|user', topic: 'zoe:B', stage: 'unresolved', opId: 'operation_othershopxyz', sentAfter: Date.now() - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 1 }] });
  const writes: any[] = [];
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write') { writes.push(args); return { ok: true, docs: [], now: Date.now() }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() }, { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const before = await verdictOf(db.set(db.ref('zoew_settings/exchange_rate'), 4200));
  const result = await db.discardPendingWrites(); await turn();
  const after = await verdictOf(db.set(db.ref('zoew_settings/exchange_rate'), 4300)); db.close('test');
  expect({ before, result, after, writes: writes.length, left: [...rows.keys()] })
    .toEqual({ before: 'WRITE_RECOVERY_PENDING', result: { count: 1, paths: ['zoew_settings/exchange_rate'] }, after: 'sent', writes: 1, left: ['operation_othershopxyz'] });
});

it('the drawer offers «លុបការសរសេររង់ចាំ» only while writes are blocked, behind the PIN', () => {
  uiState.drawerOpen = true;
  viewState.connectionPhase = 'ready';
  mount(<SideDrawer />);
  const btn = () => document.getElementById('discardPendingWritesBtn')!;
  const hiddenWhenReady = btn().classList.contains('hidden');
  step(() => { viewState.connectionPhase = 'blocked'; });
  const shownWhenBlocked = !btn().classList.contains('hidden');
  securityState.pinTargetAction = null;
  localStorage.setItem('zoew_security_pin_hash', 'x');
  drawerDiscardPendingWritesFlow();
  const gated = securityState.pinTargetAction === discardPendingWrites && viewState.pinPromptVerifyText.indexOf('លុបការសរសេររង់ចាំ') !== -1;
  unmount(); document.body.innerHTML = '';
  expect({ hiddenWhenReady, shownWhenBlocked, gated }).toEqual({ hiddenWhenReady: true, shownWhenBlocked: true, gated: true });
});
