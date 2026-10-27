import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchHealthCheck } from '../src/app/behaviors/health-live';
import { openHealthCheck, runHealthCheck } from '../src/features/health-check';
import { registerModalMeta, setModalDisplay, unregisterModalMeta } from '../src/core/modals';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
let stops: Array<() => void>;
let requests: Array<{ url: string; resolve: (response: Response) => void }>;
let runs: Array<Promise<unknown>>;
let online: boolean;
let hidden: boolean;
let workers: EventTarget & { controller: null };
let originalWorker: PropertyDescriptor | undefined;
const start = () => { const run = runHealthCheck(); runs.push(run); return run; };
const watch = () => { const stop = watchHealthCheck(); stops.push(stop); return stop; };
const answer = (index: number, valid = true) => {
    const request = requests[index];
    request.resolve(new Response(JSON.stringify({ nonce: valid ? new URL(request.url, 'https://audit.invalid').searchParams.get('nonce') : 'stale' })));
};
beforeEach(() => {
    vi.useFakeTimers(); stops = []; requests = []; runs = []; online = true; hidden = false;
    localStorage.clear();
    const config = { supabaseUrl: 'https://audit.supabase.co', supabaseKey: 'sb_publishable_TEST' };
    localStorage.setItem('zoew_firebase_config', JSON.stringify(config));
    firebaseState.firebaseConfig = config as any;
    firebaseState.db = {} as any;
    firebaseState.auth = { currentUser: { uid: 'race-user' } } as any;
    firebaseState.fb = { ref: () => ({}), get: async () => ({ val: () => null }) } as any;
    firebaseState.isDatabaseConnected = true; firebaseState.isDatabaseInitialized = true;
    firebaseState.isInitializingFirebase = false; firebaseState.firebaseSdkUnavailable = false;
    firebaseState.sessionExpiryCheck = ''; firebaseState.dbListenersFailed = false;
    firebaseState.dbLivenessProbe = null;
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    uiState.modalDisplay = { healthCheckModal: 'flex' }; viewState.healthRecheckBusy = false;
    workers = Object.assign(new EventTarget(), { controller: null });
    originalWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: workers });
    vi.stubGlobal('fetch', vi.fn((url: string) => new Promise<Response>(resolve => requests.push({ url, resolve }))));
});
afterEach(async () => {
    stops.forEach(stop => stop()); uiState.modalDisplay = {};
    requests.forEach((_, index) => answer(index, false));
    await vi.advanceTimersByTimeAsync(10000); await Promise.allSettled(runs);
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    if (originalWorker) Object.defineProperty(navigator, 'serviceWorker', originalWorker);
    else delete (navigator as any).serviceWorker;
    localStorage.clear(); firebaseState.dbLivenessProbe = null;
    unregisterModalMeta('healthCheckModal');
});

it('openHealthCheck ពិតហៅស្ទួនក្នុង modal ដដែល មិនបង្កើតជុំថ្មី', async () => {
    registerModalMeta('healthCheckModal', {});
    setModalDisplay('healthCheckModal', 'none');
    openHealthCheck(); const first = start();
    expect(requests).toHaveLength(1);
    openHealthCheck();
    expect(requests).toHaveLength(1);
    expect(start()).toBe(first);
    answer(0); await first;
    expect(uiState.healthRows[0].state).toBe('ok');
});

it('openHealthCheck ពិតក្រោយបិទនិងបើក ត្រូវបង្កើតជុំថ្មីមិនប្រើចម្លើយចាស់', async () => {
    registerModalMeta('healthCheckModal', {});
    setModalDisplay('healthCheckModal', 'none');
    openHealthCheck(); const first = start();
    setModalDisplay('healthCheckModal', 'none');
    openHealthCheck(); const second = start();
    expect(second).not.toBe(first);
    expect(requests).toHaveLength(2);
    answer(1, false); await second;
    const rows = uiState.healthRows;
    answer(0); await first;
    expect(uiState.healthRows).toBe(rows);
    expect(uiState.healthRows[0].state).toBe('info');
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('ចុចពិនិត្យស្ទួនក្នុងជុំដដែល មិនផ្ញើ network ពីរដង', async () => {
    const first = start(); const second = start();
    expect(requests).toHaveLength(1);
    answer(0); await Promise.all([first, second]);
    expect(uiState.healthRows[0].state).toBe('ok');
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('បិទនិងបើកវិញ៖ ចម្លើយចាស់មិនលុប busy ឬលទ្ធផលថ្មី', async () => {
    const stop = watch(); const old = start();
    uiState.modalDisplay = {}; stop();
    uiState.modalDisplay = { healthCheckModal: 'flex' }; watch(); const fresh = start();
    expect(requests).toHaveLength(2);
    answer(0); await old;
    expect(viewState.healthRecheckBusy).toBe(true);
    answer(1, false); await fresh;
    expect(uiState.healthRows[0].state).toBe('info');
    expect(viewState.healthRecheckBusy).toBe(false);
});

it.each(['auth', 'config'])('ប្ដូរ %s ខណៈ RPC រង់ចាំ មិនដាក់លទ្ធផលគណនីចាស់', async change => {
    const rpc = deferred<any[]>();
    (firebaseState.auth as any)._transport = { rpc: () => rpc.promise };
    const pending = start(); answer(0);
    if (change === 'auth') firebaseState.authGeneration++;
    else localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://other.supabase.co', supabaseKey: 'sb_publishable_OTHER' }));
    uiState.healthRows = null;
    rpc.resolve([{ tenant_id: 'old', status: 'revoked' }]); await pending;
    expect(uiState.healthRows).toBeNull();
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('ព្យុះ online/offline/controller មិនបង្កើតជុំស្ទួន ហើយរត់ជុំថ្មីក្រោយចាស់ចប់', async () => {
    watch(); const old = start();
    for (let i = 0; i < 10; i++) {
        online = false; window.dispatchEvent(new Event('offline'));
        online = true; window.dispatchEvent(new Event('online'));
        workers.dispatchEvent(new Event('controllerchange'));
    }
    await vi.advanceTimersByTimeAsync(250);
    expect(requests).toHaveLength(1);
    answer(0); await old;
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29749);
    expect(requests).toHaveLength(2);
    answer(1); await vi.advanceTimersByTimeAsync(1);
    expect(uiState.healthRows[0].state).toBe('ok');
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests).toHaveLength(2);
});

it('hidden មិនទទួលចម្លើយចាស់ ហើយ dispose មិនសល់ timer ឬ listener', async () => {
    const stop = watch(); const old = start();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    answer(0); await old;
    expect(uiState.healthRows[0].state).not.toBe('ok');
    await vi.advanceTimersByTimeAsync(60000); expect(requests).toHaveLength(1);
    stop(); hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online')); workers.dispatchEvent(new Event('controllerchange'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(requests).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
});

it('ជុំចាស់ចប់ក្រោយជុំថ្មី មិនជំនួសលទ្ធផលថ្មី', async () => {
    const stop = watch(); const old = start();
    uiState.modalDisplay = {}; stop();
    uiState.modalDisplay = { healthCheckModal: 'flex' }; watch(); const fresh = start();
    answer(1, false); await fresh;
    const acceptedRows = uiState.healthRows;
    expect(viewState.healthRecheckBusy).toBe(false);
    answer(0); await old;
    expect(uiState.healthRows).toBe(acceptedRows);
    expect(uiState.healthRows[0].state).toBe('info');
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('hidden ហើយ visible ពេលជុំចាស់មិនទាន់ចប់ ផ្ទៀងផ្ទាត់ម្តងប៉ុណ្ណោះក្រោយចប់', async () => {
    watch(); const old = start();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(1);
    answer(0); await old;
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29749);
    expect(requests).toHaveLength(2);
    answer(1); await vi.advanceTimersByTimeAsync(1);
    expect(uiState.healthRows[0].state).toBe('ok');
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('ព្យុះស្ថានភាពមិនចាប់ផ្តើម retryWriteRecovery ឬកែ Config', async () => {
    const retry = vi.fn(async () => {});
    firebaseState.fb.retryWriteRecovery = retry;
    const config = localStorage.getItem('zoew_firebase_config');
    watch(); const pending = start();
    window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('storage'));
    answer(0); await pending; await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29749);
    expect(requests).toHaveLength(2);
    answer(1); await vi.advanceTimersByTimeAsync(1);
    expect(retry).not.toHaveBeenCalled();
    expect(localStorage.getItem('zoew_firebase_config')).toBe(config);
    expect(Object.keys(localStorage).some(key => key.startsWith('__zoew_health_'))).toBe(false);
});

const completionOrders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const verdicts = Array.from({ length: 8 }, (_, bits) => [Boolean(bits & 1), Boolean(bits & 2), Boolean(bits & 4)]);
const permutations = completionOrders.flatMap(order => verdicts.map(valid => ({ order, valid })));
it.each(permutations)('បីជុំ ចប់ $order និង nonce $valid ៖ រក្សាតែជុំចុងក្រោយ', async ({ order, valid }) => {
    const retry = vi.fn(async () => {}); firebaseState.fb.retryWriteRecovery = retry;
    let stop = watch();
    const generations = [start()];
    for (let i = 1; i < 3; i++) {
        uiState.modalDisplay = {}; stop();
        uiState.modalDisplay = { healthCheckModal: 'flex' }; stop = watch();
        generations.push(start());
    }
    expect(requests).toHaveLength(3);
    let newestDone = false;
    let finalRows: typeof uiState.healthRows = null;
    for (const index of order) {
        answer(index, valid[index]); await generations[index];
        if (index === 2) { newestDone = true; finalRows = uiState.healthRows; }
        expect(viewState.healthRecheckBusy).toBe(!newestDone);
        if (newestDone) {
            expect(uiState.healthRows).toBe(finalRows);
            expect(uiState.healthRows[0].state).toBe(valid[2] ? 'ok' : 'info');
        } else {
            expect(start()).toBe(generations[2]);
            expect(requests).toHaveLength(3);
        }
    }
    expect(retry).not.toHaveBeenCalled();
});

it('ចុចស្ទួនទទួល promise ដូចគ្នា តែជុំចប់អាចពិនិត្យថ្មី', async () => {
    const first = start();
    for (let i = 0; i < 20; i++) expect(start()).toBe(first);
    expect(requests).toHaveLength(1);
    answer(0); await first;
    const next = start(); expect(next).not.toBe(first);
    expect(requests).toHaveLength(2);
    answer(1, false); await next;
    expect(uiState.healthRows[0].state).toBe('info');
});

it.each([true, false])('timeout ហើយចម្លើយចាស់យឺត %s មិនលុបលទ្ធផលថ្មី', async valid => {
    const expired = start();
    await vi.advanceTimersByTimeAsync(4001); await expired;
    expect(uiState.healthRows[0].state).toBe('info');
    expect(viewState.healthRecheckBusy).toBe(false);
    const next = start(); expect(start()).toBe(next);
    answer(1, !valid); await next;
    const rows = uiState.healthRows;
    answer(0, valid); await vi.advanceTimersByTimeAsync(1);
    expect(uiState.healthRows).toBe(rows);
    expect(uiState.healthRows[0].state).toBe(!valid ? 'ok' : 'info');
    expect(viewState.healthRecheckBusy).toBe(false);
    expect(requests).toHaveLength(2);
});

it('ចុចស្ទួនក្រោយព្យុះ event ចែករំលែកជុំថ្មី មិនជាប់ busy', async () => {
    watch(); const old = start();
    for (let i = 0; i < 10; i++) {
        online = false; window.dispatchEvent(new Event('offline'));
        online = true; window.dispatchEvent(new Event('online'));
        workers.dispatchEvent(new Event('controllerchange'));
    }
    const fresh = start();
    for (let i = 0; i < 10; i++) expect(start()).toBe(fresh);
    expect(requests).toHaveLength(2);
    answer(0, false); await old;
    expect(start()).toBe(fresh); expect(viewState.healthRecheckBusy).toBe(true);
    answer(1); await fresh;
    expect(uiState.healthRows[0].state).toBe('ok');
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('ជុំ manual ថ្មីបានផ្ទៀង event រួច watcher មិនផ្ញើជុំលើសក្នុង 250ms', async () => {
    watch(); const old = start();
    window.dispatchEvent(new Event('online'));
    const fresh = start();
    expect(requests).toHaveLength(2);
    answer(0, false); await old;
    answer(1); await fresh;
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(2);
    expect(uiState.healthRows[0].state).toBe('ok');
});

it('poll 30s មកដល់ខណៈ manual ថ្មីកំពុងរង់ចាំ មិនបោះបង់ជុំនោះ', async () => {
    watch();
    await vi.advanceTimersByTimeAsync(29000);
    const pending = start(); const generation = uiState.healthRunSeq;
    await vi.advanceTimersByTimeAsync(1001);
    expect(uiState.healthRunSeq).toBe(generation);
    expect(requests).toHaveLength(1);
    answer(0); await pending;
    await vi.advanceTimersByTimeAsync(251);
    expect(uiState.healthRows[0].state).toBe('ok');
    expect(requests).toHaveLength(1);
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('event ថ្មីក្រោយ manual ចាប់ផ្តើម មិនត្រូវលុបដោយជុំ manual ចាស់ចប់', async () => {
    watch(); const manual = start();
    window.dispatchEvent(new Event('online'));
    const invalidatedGeneration = uiState.healthRunSeq;
    answer(0); await manual;
    expect(uiState.healthRunSeq).toBe(invalidatedGeneration);
    expect(uiState.healthRows[0].state).not.toBe('ok');
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29749);
    expect(requests).toHaveLength(2);
    expect(viewState.healthRecheckBusy).toBe(true);
    answer(1, false); await vi.advanceTimersByTimeAsync(1);
    expect(uiState.healthRows[0].state).toBe('info');
    expect(viewState.healthRecheckBusy).toBe(false);
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(2);
});

it.each(['db', 'fb', 'auth', 'config'])('ownership %s ប្ដូរទោះ uid/status ដដែល ដកបៃតងភ្លាមមិនចាំ 30s', async change => {
    watch(); const initial = start(); answer(0); await initial;
    await vi.advanceTimersByTimeAsync(1);
    expect(uiState.healthRows[0].state).toBe('ok');
    const generation = uiState.healthRunSeq;
    const epoch = firebaseState.authGeneration;
    if (change === 'db') firebaseState.db = {} as any;
    if (change === 'fb') firebaseState.fb = { ...firebaseState.fb };
    if (change === 'auth') firebaseState.auth = { ...firebaseState.auth, currentUser: { uid: 'race-user' } } as any;
    if (change === 'config') localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://other.supabase.co', supabaseKey: 'sb_publishable_OTHER' }));
    firebaseState.touch(); firebaseState.flush();
    expect(firebaseState.authGeneration).toBe(epoch);
    expect(uiState.healthRunSeq).toBeGreaterThan(generation);
    expect(uiState.healthRows[0].state).not.toBe('ok');
    await vi.advanceTimersByTimeAsync(251);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29749);
    expect(requests).toHaveLength(2);
    answer(1); await vi.advanceTimersByTimeAsync(1);
    expect(uiState.healthRows[0].state).toBe('ok');
});
it('logout cleanup ដកជុំពិនិត្យដែលកាន់ context ចាស់ ហើយមិនឱ្យ share ចូលជុំថ្មី', async () => {
    const { clearSensitiveModalFields } = await import('../src/features/session');
    const old = start();
    clearSensitiveModalFields();
    expect(viewState.healthRecheckBusy).toBe(false);
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    const fresh = start();
    expect(requests).toHaveLength(2);
    answer(0); await old;
    expect(viewState.healthRecheckBusy).toBe(true);
    answer(1); await fresh;
    expect(viewState.healthRecheckBusy).toBe(false);
});

it('clock ពី probe មិនបដិសេធចម្លើយជុំដដែល ឬបង្កជុំ network ថ្មី', async () => {
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    watch(); const pending = start();
    const generation = uiState.healthRunSeq;
    firebaseState.serverTimeOffsetMs = 2000;
    firebaseState.flush();
    expect(uiState.healthRunSeq).toBe(generation);
    answer(0); await pending;
    expect(uiState.healthRows[0].state).toBe('ok');
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests).toHaveLength(1);
});

it('ជុំ manual ក្នុង cooldown ដំណើរការភ្លាម ហើយ automatic រង់ចាំក្រោយវាចប់', async () => {
    watch(); const first = start(); answer(0); await first;
    await vi.advanceTimersByTimeAsync(20000);
    window.dispatchEvent(new Event('online'));
    const manual = start();
    expect(requests).toHaveLength(2);
    answer(1); await manual;
    await vi.advanceTimersByTimeAsync(10001);
    expect(requests).toHaveLength(2);
    expect(uiState.healthRows[0].state).toBe('ok');
    await vi.advanceTimersByTimeAsync(20250);
    expect(requests).toHaveLength(3);
    answer(2); await vi.advanceTimersByTimeAsync(1);
});
