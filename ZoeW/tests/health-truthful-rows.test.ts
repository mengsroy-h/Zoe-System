import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, lookupState } from '../src/core/state';
import { healthDatabaseLiveRow, healthLicenseRow, healthLookupRow, healthSheetScriptRow } from '../src/features/health-check';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://abcdefgh.supabase.co', supabaseKey: 'sb_publishable_TEST' }));
    firebaseState.auth = { currentUser: { uid: 'u' }, _account: { tenant_id: 't', status: 'active', expires_at: '2099-01-01' } } as any;
    firebaseState.fb = { accountOf: (auth) => auth._account, ref: () => ({}), getForHealth: async () => ({ val: () => null }) } as any;
    firebaseState.firebaseConfig = { supabaseUrl: 'https://abcdefgh.supabase.co', supabaseKey: 'sb_publishable_TEST' } as any;
    firebaseState.db = {} as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.sessionExpiryCheck = '';
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbLivenessProbe = null;
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
it('ពិនិត្យសុខភាពមិន replay ការសរសេរ', async () => {
    const retry = vi.fn(async () => {});
    firebaseState.fb.retryWriteRecovery = retry;
    await healthDatabaseLiveRow();
    expect(retry).not.toHaveBeenCalled();
});
it('ព័ត៌មានហាងក្នុង cache មិនស្មើការផ្ទៀងផ្ទាត់ថ្មី', async () => {
    (firebaseState.auth as any)._accountUnverified = true;
    expect((await healthLicenseRow()).state).not.toBe('ok');
});
it('my_account ឆ្លើយថ្មី និងពេលផុតមានសុពលភាព ➜ បៃតង', async () => {
    (firebaseState.auth as any)._transport = { rpc: vi.fn(async () => [(firebaseState.auth as any)._account]) };
    expect((await healthLicenseRow()).state).toBe('ok');
    expect((firebaseState.auth as any)._transport.rpc).toHaveBeenCalledWith('my_account', {}, 8000, expect.objectContaining({ observational: true, current: expect.any(Function), deadline: expect.any(Number) }));
});
it.each(['invalid', null])('ថ្ងៃផុតមិនស្គាល់ %s មិនត្រូវប្រាប់ថាផុត', async (expires_at) => {
    (firebaseState.auth as any)._account.expires_at = expires_at;
    (firebaseState.auth as any)._transport = { rpc: async () => [(firebaseState.auth as any)._account] };
    expect((await healthLicenseRow()).state).toBe('warn');
});
it('RPC បរាជ័យ មិនយក cache បៃតង', async () => {
    (firebaseState.auth as any)._transport = { rpc: async () => { throw new Error('network'); } };
    expect((await healthLicenseRow()).state).not.toBe('ok');
});
it('Sheet Config មិនមែនភស្តុតាងសេវា live', async () => {
    localStorage.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: 'https://script.google.com/macros/s/synthetic/exec' }));
    expect((await healthLookupRow()).state).not.toBe('ok');
});
it('កំណែ Sheet ជាចម្លើយចុងក្រោយ ត្រូវប្រាប់អាយុប្រភព', () => {
    localStorage.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: 'https://script.google.com/macros/s/synthetic/exec' }));
    lookupState.sheetScriptVersionSeen = 2;
    expect(healthSheetScriptRow().detail).toContain('ចុងក្រោយ');
});
it.each([NaN, Infinity, -Infinity])('នាឡិកា offset %s មិនមែនភស្តុតាង sync', async (offset) => {
    firebaseState.serverTimeOffsetMs = offset;
    const { healthClockRow } = await import('../src/features/health-check');
    expect(healthClockRow().state).toBe('warn');
    expect(healthClockRow().detail).not.toMatch(/NaN|Infinity/);
});

it('ការពិនិត្យហាងមានរបងកម្មសិទ្ធិ និងពិដានពេលសរុបថេរ', async () => {
    const started = performance.now();
    const rpc = vi.fn(async () => [(firebaseState.auth as any)._account]);
    (firebaseState.auth as any)._transport = { rpc };
    expect((await healthLicenseRow()).state).toBe('ok');
    const observation = (rpc.mock.calls[0] as any)[3];
    expect(observation.deadline).toBeGreaterThanOrEqual(started + 8000);
    expect(observation.deadline).toBeLessThanOrEqual(performance.now() + 8000);
    expect(observation.current()).toBe(true);
    firebaseState.authGeneration++;
    expect(observation.current()).toBe(false);
});
