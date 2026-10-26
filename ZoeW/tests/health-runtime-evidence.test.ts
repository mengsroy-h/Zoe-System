import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { healthDatabaseLiveRow, healthNetworkRow, healthServiceWorkerRow, healthStorageRow } from '../src/features/health-check';

const localSetItem = localStorage.setItem;
const sessionSetItem = sessionStorage.setItem;

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://demo-zoe.firebaseio.com' }));
    firebaseState.db = {} as any;
    firebaseState.auth = { currentUser: { uid: 'health-user' } } as any;
    firebaseState.fb = { ref: () => ({}), get: () => Promise.resolve({ val: () => null }) } as any;
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
        firebaseState.fb.get = () => Promise.reject(new Error('permission_denied'));
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
        delete firebaseState.fb.get;
        expect((await healthDatabaseLiveRow()).state).toBe('warn');
    });

    it('គណនីប្តូរកណ្តាលការវាស់ ➜ ចម្លើយចាស់មិនអះអាងថាគណនីថ្មីល្អ', async () => {
        let finish!: (value: any) => void;
        firebaseState.fb.get = () => new Promise((resolve) => { finish = resolve; });
        const pending = healthDatabaseLiveRow();
        firebaseState.authGeneration++;
        finish({ val: () => null });
        expect((await pending).state).toBe('warn');
    });

    it('listener បរាជ័យខណៈ probe កំពុងរង់ចាំ ➜ ប្រើស្ថានភាពថ្មី', async () => {
        let finish!: (value: any) => void;
        firebaseState.fb.get = () => new Promise((resolve) => { finish = resolve; });
        const pending = healthDatabaseLiveRow();
        dbListenerFailedPaths.add('history');
        finish({ val: () => null });
        expect((await pending).state).toBe('warn');
    });

    it('write ថ្មីមិនទាន់ចប់ខណៈ probe រង់ចាំ ➜ មិនអះអាងថាបានរក្សាទុកគ្រប់', async () => {
        let finish!: (value: any) => void;
        let pendingWrites = 0;
        (firebaseState.db as any).recoveryState = () => ({ pending: pendingWrites });
        firebaseState.fb.get = () => new Promise((resolve) => { finish = resolve; });
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
