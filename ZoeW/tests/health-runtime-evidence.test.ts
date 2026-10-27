import { watchHealthCheck } from '../src/app/behaviors/health-live';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { healthDatabaseLiveRow, healthNetworkRow, healthServiceWorkerRow, healthStorageRow, runHealthCheck } from '../src/features/health-check';

const localSetItem = localStorage.setItem;
const sessionSetItem = sessionStorage.setItem;

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://demo-zoe.supabase.co', supabaseKey: 'sb_publishable_TEST' }));
    firebaseState.firebaseConfig = { supabaseUrl: 'https://demo-zoe.supabase.co', supabaseKey: 'sb_publishable_TEST' } as any;
    firebaseState.db = {} as any;
    firebaseState.auth = { currentUser: { uid: 'health-user' } } as any;
    firebaseState.fb = { ref: () => ({}), getForHealth: () => Promise.resolve({ val: () => null }) } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.sessionExpiryCheck = '';
    firebaseState.dbListenersFailed = false;
    firebaseState.dbLivenessProbe = null;
    firebaseState.lastDbLivenessOkAt = 0;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    uiState.isModalOpen = false;
    Object.defineProperty(localStorage, 'setItem', { value: localSetItem, configurable: true });
    Object.defineProperty(sessionStorage, 'setItem', { value: sessionSetItem, configurable: true });
    localStorage.clear();
    sessionStorage.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    firebaseState.dbLivenessProbe = null;
});

describe('ភស្តុតាងពិតនៃសុខភាព App', () => {
    it('ការអានបានចម្លើយក្នុង session ដដែល ➜ បៃតង', async () => {
        expect((await healthDatabaseLiveRow()).state).toBe('ok');
    });

    it('socket ភ្ជាប់តែចេញពីគណនីរួច ➜ មិនបៃតងទោះ get បដិសេធសិទ្ធិ', async () => {
        firebaseState.auth.currentUser = null;
        firebaseState.fb.getForHealth = () => Promise.reject(new Error('permission_denied'));
        expect((await healthDatabaseLiveRow()).state).toBe('warn');
    });

    it('socket ភ្ជាប់តែមិនទាន់ផ្ទុកទិន្នន័យ ➜ មិនបៃតង', async () => {
        firebaseState.isDatabaseInitialized = false;
        expect((await healthDatabaseLiveRow()).state).toBe('warn');
    });

    it('session ផុតកំណត់តែ socket នៅភ្ជាប់ ➜ មិនបៃតង', async () => {
        firebaseState.sessionExpiryCheck = 'expired';
        expect((await healthDatabaseLiveRow()).state).toBe('warn');
    });

    it('គ្មានមុខងារវាស់ live ➜ មិនអាចបៃតងពី listener ចាស់', async () => {
        delete firebaseState.fb.getForHealth;
        expect((await healthDatabaseLiveRow()).state).toBe('warn');
    });

    it('គណនីប្តូរកណ្តាលការវាស់ ➜ ចម្លើយចាស់មិនអះអាងថាគណនីថ្មីល្អ', async () => {
        let finish!: (value: any) => void;
        firebaseState.fb.getForHealth = () => new Promise((resolve) => { finish = resolve; });
        const pending = healthDatabaseLiveRow();
        firebaseState.authGeneration++;
        finish({ val: () => null });
        expect((await pending).state).toBe('warn');
    });

    it('listener បរាជ័យខណៈ probe កំពុងរង់ចាំ ➜ ប្រើស្ថានភាពថ្មី', async () => {
        let finish!: (value: any) => void;
        firebaseState.fb.getForHealth = () => new Promise((resolve) => { finish = resolve; });
        const pending = healthDatabaseLiveRow();
        dbListenerFailedPaths.add('history');
        finish({ val: () => null });
        expect((await pending).state).toBe('warn');
    });

    it('write ថ្មីមិនទាន់ចប់ខណៈ probe រង់ចាំ ➜ មិនអះអាងថាបានរក្សាទុកគ្រប់', async () => {
        let finish!: (value: any) => void;
        let pendingWrites = 0;
        (firebaseState.db as any).recoveryState = () => ({ pending: pendingWrites });
        firebaseState.fb.getForHealth = () => new Promise((resolve) => { finish = resolve; });
        const pending = healthDatabaseLiveRow();
        pendingWrites = 1;
        finish({ val: () => null });
        expect((await pending).state).toBe('warn');
    });

    it('Browser online តែគ្មាន server proof ➜ មិនមែនបៃតងអ៊ីនធឺណិត', () => {
        expect(healthNetworkRow().state).toBe('info');
    });

    it('storage មាន object តែ quota ពេញ ➜ ក្រហម និងទុក Config ដដែល', () => {
        const original = localStorage.getItem('zoew_firebase_config');
        Object.defineProperty(localStorage, 'setItem', { configurable: true, value: () => { throw new DOMException('full', 'QuotaExceededError'); } });
        expect(healthStorageRow().state).toBe('bad');
        expect(localStorage.getItem('zoew_firebase_config')).toBe(original);
    });

    it('storage សរសេរស្ងាត់មិនចូល ➜ ក្រហម', () => {
        Object.defineProperty(sessionStorage, 'setItem', { configurable: true, value: () => {} });
        expect(healthStorageRow().state).toBe('bad');
    });

    it('storage អាន/សរសេរបាន ➜ បៃតង ហើយសម្អាត probe', () => {
        const localKeys = Object.keys(localStorage).sort();
        const sessionKeys = Object.keys(sessionStorage).sort();
        expect(healthStorageRow().state).toBe('ok');
        expect(Object.keys(localStorage).sort()).toEqual(localKeys);
        expect(Object.keys(sessionStorage).sort()).toEqual(sessionKeys);
    });

    it('មាន SW controller តែមិនបានវាស់ cache ➜ មិនអះអាងថាបើក offline បាន', () => {
        vi.stubGlobal('navigator', { onLine: true, serviceWorker: { controller: {} } });
        try { expect(healthServiceWorkerRow().state).toBe('info'); }
        finally { vi.unstubAllGlobals(); }
    });
});


describe('លទ្ធផលបណ្ដាញពីជុំពិនិត្យពិត', () => {
    it('ផ្ទៀងផ្ទាត់ថ្មី ➜ ជួរអ៊ីនធឺណិតបៃតង', async () => {
        uiState.modalDisplay = { healthCheckModal: 'flex' };
        vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ nonce: new URL(url, 'https://audit.invalid').searchParams.get('nonce') }))));
        await runHealthCheck();
        expect(uiState.healthRows[0].state).toBe('ok');
        expect(uiState.healthRows[0].icon).toBe('✅');
    });
    it('database បៃតងតែ network probe មិនមានភស្តុតាង ➜ មិនបៃតងអ៊ីនធឺណិត', async () => {
        uiState.modalDisplay = { healthCheckModal: 'flex' };
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
        await runHealthCheck();
        expect(uiState.healthRows[1].state).toBe('ok');
        expect(uiState.healthRows[0].state).toBe('info');
    });
    it('បិទ modal ខណៈ probe មិនទាន់ចប់ ➜ មិនដាក់លទ្ធផលវិញ', async () => {
        uiState.modalDisplay = { healthCheckModal: 'flex' };
        let finish!: (res: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish = resolve; })));
        const pending = runHealthCheck();
        uiState.modalDisplay = {};
        uiState.healthRows = null;
        finish(new Response('{}'));
        await pending;
        expect(uiState.healthRows).toBeNull();
    });
});
it('ជុំទាំងមូលមិនលាក់ការសរសេរ blocked ដោយសារទូទៅ', async () => {
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    (firebaseState.db as any).recoveryState = () => ({ blocked: 1, pending: 0 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    await runHealthCheck();
    expect(uiState.healthRows[1].detail).toContain('ការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់');
});
it('write ចាប់ផ្តើមក្រោយ DB probe ខណៈ network រង់ចាំ ➜ មិនបៃតង', async () => {
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    let pendingWrites = 0;
    (firebaseState.db as any).recoveryState = () => ({ pending: pendingWrites });
    let finish!: (res: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    const pending = runHealthCheck();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    pendingWrites = 1;
    finish(new Response('{}'));
    await pending;
    expect(uiState.healthRows[1].detail).toContain('ការសរសេរ 1');
});

it('watcher ពិតចាប់បាន pending write ហើយផ្លាស់ស្ថានភាពដោយមិនចាំ polling', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    let count = 0;
    (firebaseState.db as any).recoveryState = () => ({ pending: count });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    const stop = watchHealthCheck();
    try {
        const seq = uiState.healthRunSeq;
        count = 1; firebaseState.touch(); firebaseState.flush();
        expect(uiState.healthRunSeq).toBeGreaterThan(seq);
        await vi.advanceTimersByTimeAsync(251);
        expect(uiState.healthRows[1].state).toBe('warn');
        expect(uiState.healthRows[1].detail).toContain('ការសរសេរ 1');
    } finally { stop(); vi.useRealTimers(); }
});
