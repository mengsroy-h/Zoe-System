import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo, fieldValue, setFieldValue } from '../src/app/refs';
import { MODAL_IDS, modalIsOpen, registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { dataState, firebaseState, securityState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { openEditModal, saveEditedPhone } from '../src/features/entry-ops';
import { saveFirebaseConfig } from '../src/features/config';
import { initFirebase } from '../src/services/firebase-init';
import { followStoredFirebaseConfig } from '../src/services/firebase-sdk';
import { openModalHelper } from '../src/ui/modal';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';

import { completePinUnlock } from '../src/features/pin';
import * as cryptoService from '../src/services/crypto';
import * as network from '../src/services/network';
const loading = { wait: null as null | Promise<any> };
const A = { apiKey: 'modal-a', databaseURL: 'https://modal-a.firebaseio.com' };
const B = { apiKey: 'modal-b', databaseURL: 'https://modal-b.firebaseio.com' };
const H = 'zoew_scan_history_cod_dod';
const ID = 'copied-row';
const fields = ['editPhoneInput', 'firebaseConfigInput', 'searchPhoneInput'] as const;
const copy = (v: any) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const row = (phone: string) => ({ id: ID, phone, scanDate: '2026-10-31', createdAt: 123, count: 1,
    cod: 0, dod: 0, price: 0, isClosed: false, barcodes: [{ code: 'COPIEDCODE', cod: 0, dod: 0, createdAt: 123, isClosed: false }] });
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
let fixture: ReturnType<typeof sdkFixture>;
function sdkFixture() {
    const apps: any[] = [], auths = new Map<any, any>(), callbacks = new Map<any, any>();
    const stores: any = { [A.databaseURL]: { [ID]: row('011111111') }, [B.databaseURL]: { [ID]: row('022222222') } };
    const writes: any[] = [];
    let delayed: null | (() => void) = null;
    let hold = false;
    const ref = (db: any, path = '') => ({ db, path, toString: () => db.app.options.databaseURL + '/' + path });
    const value = (r: any) => r.path === H ? stores[r.db.app.options.databaseURL]
        : r.path === H + '/' + ID ? stores[r.db.app.options.databaseURL][ID] : r.path.startsWith('zoew_daily_pickup_cod_dod/') ? { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 } : null;
    const snapshot = (r: any) => ({ ref: r, val: () => copy(value(r)) });
    const sdk: any = {
        getApps: () => apps.slice(), initializeApp: (options: any) => { const app = { options }; apps.push(app); return app; },
        deleteApp: vi.fn(async (app: any) => { apps.splice(apps.indexOf(app), 1); }),
        getAuth: (app: any) => { if (!auths.has(app)) auths.set(app, { app, currentUser: null }); return auths.get(app); },
        getDatabase: (app: any) => ({ app }), ref, goOnline() {}, goOffline() {}, off() {},
        onAuthStateChanged: (auth: any, cb: any) => { callbacks.set(auth, cb); return () => callbacks.delete(auth); },
        onValue: () => () => {}, get: async (r: any) => snapshot(r),
        getIdTokenResult: async () => ({ authTime: new Date().toISOString(), token: 'fixture' }),
        runTransaction: (r: any, update: any) => new Promise((resolve, reject) => {
            const commit = () => {
                try {
                const next = update(copy(value(r)));
                if (next !== undefined && r.path === H + '/' + ID) {
                    stores[r.db.app.options.databaseURL][ID] = copy(next); writes.push({ shop: r.db.app.options.databaseURL, next });
                }
                resolve({ committed: next !== undefined, snapshot: snapshot(r) });
                } catch (error) { reject(error); }
            };
            if (hold && r.path === H + '/' + ID) delayed = commit;
            else commit();
        }),
        update: async () => {}, set: async () => {}, increment: (amount: number) => ({ '.sv': { increment: amount } })
    };
    return { sdk, stores, writes, apps,
        emit(uid: string | null) { const auth = firebaseState.auth; auth.currentUser = uid ? { uid, getIdToken: async () => 'fixture' } : null; callbacks.get(auth)?.(auth.currentUser); },
        hold() { hold = true; }, release() { hold = false; delayed?.(); }, pending: () => !!delayed };
}
async function signIn(uid: string | null) {
    fixture.emit(uid); await flush();
    if (uid) { dataState.scanHistory = Object.values(copy(fixture.stores[firebaseState.db.app.options.databaseURL])); dbListenerPendingPaths.clear(); }
}
function edit() { openEditModal(ID); setFieldValue('editPhoneInput', '099999999'); }
function follow(config = B) {
    const text = JSON.stringify(config); appLocalStore.setItem('zoew_firebase_config', text);
    return followStoredFirebaseConfig({ key: 'zoew_firebase_config', newValue: text });
}
beforeEach(async () => {
    MODAL_IDS.forEach(id => registerModalMeta(id, {}));
    vi.useFakeTimers(); appLocalStore.clear(); loading.wait = null;
    vi.spyOn(network, 'waitForFirebaseSDK').mockImplementation(() => loading.wait!);
    firebaseState.authUnsubscribe?.();
    Object.assign(firebaseState, { fb: null, db: null, auth: null, authUnsubscribe: null, authRecoveryTimeout: null,
        isInitializingFirebase: false, isDatabaseInitialized: false, firebaseSdkUnavailable: false,
        isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    firebaseState.authGeneration++;
    uiState.modalDisplay = {}; uiState.modalStack = []; uiState.isModalOpen = false; uiState.toasts = [];
    dataState.scanHistory = []; dataState.deletedItems = []; dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    securityState.pinTargetAction = null; viewState.backendKind = 'firebase';
    for (const field of fields) refTo(field)(document.createElement('input'));
    (window as any).ZoeLicense = { getStatus: async () => ({ state: 'active' }) };
    (window as any).ZoeErrors = { capture: vi.fn() };
    fixture = sdkFixture();
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        const url = new URL(String(input)); const path = url.pathname.slice(1).replace(/\.json$/, '');
        const history = fixture.stores[url.origin];
        return new Response(JSON.stringify(path === H ? history : path === H + '/' + ID ? history?.[ID] : path.startsWith('zoew_daily_pickup_cod_dod/') ? { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 } : null), { status: 200 });
    }));
    loading.wait = Promise.resolve(fixture.sdk);
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(A));
    await initFirebase(); await signIn('same-user');
});
afterEach(() => {
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null; firebaseState.authGeneration++;
    for (const field of fields) refTo(field)(null);
    MODAL_IDS.forEach(unregisterModalMeta);
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); appLocalStore.clear();
    delete (window as any).ZoeLicense; delete (window as any).ZoeErrors;
});
for (const path of ['storage', 'explicit']) for (const uid of ['same-user', 'other-user', null]) it(`${path}: old modal cannot mutate B after first auth callback ${uid}`, async () => {
    edit(); expect(modalIsOpen('editPhoneModal')).toBe(true);
    if (path === 'storage') expect(follow()).toBe(true);
    else { viewState.configBackend = 'firebase'; setFieldValue('firebaseConfigInput', JSON.stringify(B)); expect(saveFirebaseConfig()).toBe(true); }
    await flush(); await signIn(uid);
    expect(modalIsOpen('editPhoneModal')).toBe(false);
    expect(uiState.editingItemId).toBeNull(); expect(fieldValue('editPhoneInput')).toBe('');
    await saveEditedPhone(); expect(fixture.writes).toEqual([]);
    expect(fixture.stores[B.databaseURL][ID].phone).toBe('022222222');
});
it('same-backend SDK wait invalidates UI and PIN intent immediately without deleting durable records', async () => {
    edit(); openModalHelper('pinModal'); securityState.pinTargetAction = vi.fn();
    const generation = securityState.pinFlowGeneration;
    const keys = ['zoew_scan_evidence_v2:pending', 'zoew_cleanup_journal_v2:pending', 'zoew_pickup_journal_v2:pending', 'zoew_remembered_login_v1'];
    keys.forEach(key => appLocalStore.setItem(key, 'retain'));
    loading.wait = new Promise(() => {}); follow(); await flush();
    expect(MODAL_IDS.filter(modalIsOpen)).toEqual([]);
    expect(securityState.pinTargetAction).toBeNull(); expect(securityState.pinFlowGeneration).toBeGreaterThan(generation);
    expect(uiState.editingItemId).toBeNull(); expect(fieldValue('editPhoneInput')).toBe('');
    keys.forEach(key => expect(appLocalStore.getItem(key)).toBe('retain'));
});
it('failed new SDK leaves no old form and unchanged storage event remains a no-op', async () => {
    edit(); const originalDb = firebaseState.db; const deletes = fixture.sdk.deleteApp.mock.calls.length;
    expect(follow(A)).toBe(false); await flush();
    expect(firebaseState.db).toBe(originalDb); expect(modalIsOpen('editPhoneModal')).toBe(true);
    expect(fixture.sdk.deleteApp).toHaveBeenCalledTimes(deletes);
    loading.wait = Promise.reject(Object.assign(new Error('unavailable'), { code: 'SDK_UNAVAILABLE' }));
    follow(); await flush();
    expect(firebaseState.firebaseSdkUnavailable).toBe(true);
    expect(modalIsOpen('editPhoneModal')).toBe(false); expect(uiState.editingItemId).toBeNull();
});
it('control: unchanged session edit reaches the actual transaction path', async () => {
    edit(); await saveEditedPhone();
    expect(fixture.writes).toHaveLength(1); expect(fixture.writes[0].shop).toBe(A.databaseURL);
    expect(fixture.stores[A.databaseURL][ID].phone).toBe('099999999');
});
it('late old save cannot restore its modal or overwrite B after reconfiguration', async () => {
    edit(); fixture.hold(); const saving = saveEditedPhone(); await flush();
    expect(fixture.pending()).toBe(true);
    follow(); await flush(); await signIn('other-user');
    fixture.release(); await saving; await flush();
    expect(modalIsOpen('editPhoneModal')).toBe(false); expect(uiState.editingItemId).toBeNull();
    expect(fixture.stores[B.databaseURL][ID].phone).toBe('022222222');
    expect(fixture.writes.filter(write => write.shop === B.databaseURL)).toEqual([]);
});
it('old PIN continuation cannot open or mutate the replacement session', async () => {
    openModalHelper('pinModal'); const action = vi.fn(); securityState.pinTargetAction = action;
    appLocalStore.setItem('zoew_security_pin_hash', 'saved-hash');
    let release!: (key: CryptoKey) => void;
    vi.spyOn(cryptoService, 'deriveLookupSecretKey').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = completePinUnlock('123456'); await flush();
    expect(typeof release).toBe('function');
    follow(); await flush(); await signIn('other-user');
    release({} as CryptoKey); expect(await pending).toBe(false);
    expect(action).not.toHaveBeenCalled(); expect(modalIsOpen('configModal')).toBe(false);
    expect(securityState.lookupSecretKey).toBeNull();
    expect(appLocalStore.getItem('zoew_security_pin_hash')).toBe('saved-hash');
});
it('latest Config is followed when another storage change arrives during SDK wait', async () => {
    edit(); let release!: (sdk: any) => void;
    loading.wait = new Promise(resolve => { release = resolve; });
    follow(); await flush();
    expect(modalIsOpen('editPhoneModal')).toBe(false);
    const C = { apiKey: 'modal-c', databaseURL: 'https://modal-c.firebaseio.com' };
    fixture.stores[C.databaseURL] = { [ID]: row('033333333') };
    follow(C); await flush(); release(fixture.sdk); await flush();
    expect(firebaseState.db.app.options.databaseURL).toBe(C.databaseURL);
    await signIn('other-user'); await saveEditedPhone();
    expect(fixture.writes).toEqual([]); expect(fixture.stores[C.databaseURL][ID].phone).toBe('033333333');
});
