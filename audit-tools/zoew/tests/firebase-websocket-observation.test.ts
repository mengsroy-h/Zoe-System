import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { renderConnectionStatus } from '../../../ZoeW/src/services/connection';
import { healthDatabaseRow } from '../../../ZoeW/src/features/health-check';
import { buildHealthAdvice } from '../../../ZoeW/src/features/health-advice';

const message = 'បណ្ដាញនេះបិទ WebSocket — សូមប្តូរ Wi-Fi ឬប្រើ 4G';
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { onLine: true });
    firebaseState.authGeneration++;
    Object.assign(firebaseState, {
        db: {}, fb: { ref: (_database, path) => ({ toString: () => 'https://socket-test.firebaseio.com/' + path }) },
        auth: { currentUser: { uid: 'socket-user', getIdToken: async () => 'synthetic-token' } },
        firebaseConfig: { databaseURL: 'https://socket-test.firebaseio.com' },
        isDatabaseConnected: false, hasEverConnectedToDatabase: false, isInitializingFirebase: false,
        firebaseSdkUnavailable: false, dbListenersFailed: false, reconnectWatchdogAttempt: 0
    });
    localStorage.setItem('zoew_firebase_config', JSON.stringify(firebaseState.firebaseConfig));
    request = vi.fn(async () => new Response('null'));
    vi.stubGlobal('fetch', request);
});
afterEach(() => {
    firebaseState.db = null;
    renderConnectionStatus();
    localStorage.clear();
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
const shown = () => [viewState.connectionText, healthDatabaseRow().detail];

it('REST អានបាន តែ WebSocket មិនដែលភ្ជាប់៖ ក្រោយពិដាន ទាំង status និង Server ប្រាប់បណ្ដាញបិទ WebSocket', async () => {
    renderConnectionStatus();
    await vi.advanceTimersByTimeAsync(19999);
    expect(shown()).not.toContain(message);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10001);
    expect(shown()).toEqual([message, message]);
    expect(buildHealthAdvice([healthDatabaseRow()]).steps).toContain(message);
    expect(request.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'omit' });
    expect(new URL(request.mock.calls[0][0]).searchParams.get('auth')).toBe('synthetic-token');
});

it.each(['offline', 'REST បដិសេធ', 'REST ដាច់', 'Supabase', 'socket zombie', 'ការដាច់ធម្មតា'])('%s មិនច្រឡំជាបណ្ដាញបិទ WebSocket', async mode => {
    if (mode === 'offline') vi.stubGlobal('navigator', { onLine: false });
    if (mode === 'REST បដិសេធ') request.mockResolvedValue(new Response('{}', { status: 403 }));
    if (mode === 'REST ដាច់') request.mockRejectedValue(new Error('offline'));
    if (mode === 'Supabase') firebaseState.firebaseConfig = { supabaseUrl: 'https://socket-test.supabase.co' } as any;
    localStorage.setItem('zoew_firebase_config', JSON.stringify(firebaseState.firebaseConfig));
    if (mode === 'socket zombie' || mode === 'ការដាច់ធម្មតា') firebaseState.isDatabaseConnected = true;
    renderConnectionStatus();
    if (mode === 'ការដាច់ធម្មតា') { firebaseState.isDatabaseConnected = false; renderConnectionStatus(); }
    await vi.advanceTimersByTimeAsync(60000);
    expect(shown()).not.toContain(message);
    if (['offline', 'Supabase', 'socket zombie', 'ការដាច់ធម្មតា'].includes(mode)) expect(request).not.toHaveBeenCalled();
});

it('WebSocket ភ្ជាប់បានវិញ ➜ លុបសារភ្លាម និងការដាច់បន្ទាប់មិនប្ដូរជាសារនេះ', async () => {
    renderConnectionStatus(); await vi.advanceTimersByTimeAsync(30000);
    expect(shown()).toEqual([message, message]);
    firebaseState.isDatabaseConnected = true; renderConnectionStatus();
    expect(shown()).not.toContain(message);
    firebaseState.isDatabaseConnected = false; renderConnectionStatus();
    await vi.advanceTimersByTimeAsync(60000);
    expect(shown()).not.toContain(message);
});

it('REST ចាស់ក្រោយប្ដូរគណនី មិនបញ្ជាក់បណ្ដាញរបស់ session ថ្មី', async () => {
    let finish!: (response: Response) => void;
    request.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    renderConnectionStatus(); await vi.advanceTimersByTimeAsync(20000);
    firebaseState.authGeneration++;
    finish(new Response('null')); await vi.advanceTimersByTimeAsync(0);
    expect(shown()).not.toContain(message);
});

it.each([-1, 30001])('នាឡិកាប្រែ %s ms ក្រោយ REST ➜ មិនប្រើភស្តុតាងអនាគត ឬផុតអាយុ', async shift => {
    renderConnectionStatus(); await vi.advanceTimersByTimeAsync(20000);
    expect(shown()).toEqual([message, message]);
    vi.setSystemTime(Date.now() + shift);
    renderConnectionStatus();
    expect(shown()).not.toContain(message);
});
