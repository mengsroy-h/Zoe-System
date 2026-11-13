import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../../../ZoeW/src/core/state';
import { acceptServerClockOffset, getServerClockBounds, getServerNow, resetServerClock } from '../../../ZoeW/src/core/clock';
import { appLocalStore, appSessionStore } from '../../../ZoeW/src/core/storage';
import { barcodeCloseIsRipe } from '../../../ZoeW/src/domain/barcode';
import * as mode from '../../../ZoeW/src/services/zto-trash-mode';

const NOW = 1800000000000;
let pending: Array<{ path: string; update: (current: any) => any }>;
let shopNumber = 0;
function clock(lower = NOW - 100, upper = NOW + 100) {
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: lower, estimateEpochMs: NOW,
        uncertaintyMs: upper - lower, monotonicMs: 1000, wallMs: NOW }), false)).toBe(true);
}
function seed(palm: Record<string, number> = {}, cookie: Record<string, number> = {}) {
    mode.noteZtoTrashMode({ palm, cookie });
}
async function flush() { await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    appLocalStore.clear(); appSessionStore.clear();
    const url = `https://clock-${++shopNumber}.firebaseio.com`;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url }));
    firebaseState.db = {} as any;
    firebaseState.auth = { app: { options: { databaseURL: url } }, currentUser: { uid: 'mode-user' } } as any;
    firebaseState.authGeneration++;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isInitializingFirebase = false;
    firebaseState.firebaseSdkUnavailable = false;
    pending = [];
    firebaseState.fb = { ref: (_db: any, path: string) => path,
        runTransaction: (path: string, update: any) => { pending.push({ path, update }); return Promise.resolve({ committed: false }); }
    } as any;
    mode.resetZtoTrashMode(); resetServerClock(); clock(); seed();
});
afterEach(() => { resetServerClock(); mode.resetZtoTrashMode(); vi.restoreAllMocks(); });

it('រក្សា Palm នៅពេលអាយុប្រាំពីរថ្ងៃមិនប្រាកដ និងមិនបើក cleanup', () => {
    seed({ device0001: NOW - mode.ZTO_TRASH_MODE_ACTIVE_MS - 50 }, { device0002: NOW });
    const selected = mode.effectiveZtoTrashMode('local');
    expect(selected).toBe('palm');
    expect(barcodeCloseIsRipe({ isClosed: true, closedAt: NOW - 3 * 3600000 }, getServerClockBounds()!.lowerMs, selected)).toBe(false);
    expect(mode.effectiveZtoTrashMode('cookie')).toBe('cookie');
    clock(NOW, NOW + 100);
    expect(mode.shopZtoTrashMode()).toBe('cookie');
});
it('ពេល clock មិនប្រាកដ រក្សា mode ចាស់ ហើយគ្មាន mode ចាស់ត្រូវ HOLD', () => {
    resetServerClock(); expect(mode.shopZtoTrashMode()).toBe('');
    clock(); seed({ device0001: NOW }); expect(mode.shopZtoTrashMode()).toBe('palm');
    seed({ device0001: NOW - mode.ZTO_TRASH_MODE_ACTIVE_MS - 1000 });
    resetServerClock(); expect(mode.shopZtoTrashMode()).toBe('palm');
});
it.each(['age', 'future'])('មិន prune នៅព្រំដែនមិនប្រាកដ %s', (kind) => {
    seed({ device0001: kind === 'age' ? NOW - mode.ZTO_TRASH_MODE_ACTIVE_MS - 50 : NOW + mode.ZTO_TRASH_MODE_FUTURE_MS + 50 });
    expect(mode.pruneZtoTrashMode()).toBe(0);
});
it('មិន stamp ពី clock មិនប្រាកដ', () => {
    resetServerClock(); expect(mode.markZtoTrashMode('palm')).toBe(false);
});
it.each(['prune', 'stamp'])('បញ្ឈប់ %s ពេល clock ប្ដូរក្នុង updater', async (op) => {
    const old = NOW - mode.ZTO_TRASH_MODE_ACTIVE_MS - 1000;
    seed({ device0001: old });
    expect(op === 'prune' ? mode.pruneZtoTrashMode() : mode.markZtoTrashMode('cookie')).toBeTruthy();
    await flush(); expect(pending).toHaveLength(1);
    resetServerClock(); clock();
    expect(pending[0].update(old)).toBeUndefined();
});
it.each(['auth', 'database', 'account', 'shop'])('បញ្ឈប់ updater ពេលប្ដូរ %s', async (change) => {
    expect(mode.markZtoTrashMode('palm')).toBe(true); await flush();
    if (change === 'auth') firebaseState.authGeneration++;
    if (change === 'database') firebaseState.db = {} as any;
    if (change === 'account') (firebaseState.auth.currentUser as any).uid = 'other';
    if (change === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    expect(pending[0].update(null)).toBeUndefined();
});
it('prune ពិនិត្យ bounds ថ្មី និង CAS រាល់ updater', async () => {
    const old = NOW - mode.ZTO_TRASH_MODE_ACTIVE_MS - 150;
    seed({ device0001: old }); expect(mode.pruneZtoTrashMode()).toBe(1); await flush();
    expect(pending[0].update(old + 1)).toBeUndefined();
    expect(pending[0].update(old)).toBeNull();
    clock(NOW - 200, NOW + 100);
    expect(pending[0].update(old)).toBeUndefined();
});
it('stamp រក្សាតម្លៃ point និង withdrawal មិនទាមទារ clock', async () => {
    expect(mode.markZtoTrashMode('palm')).toBe(true); await flush();
    expect(pending[0].update(null)).toBe(getServerNow());
    expect(pending[0].update(null)).not.toBe(getServerClockBounds()!.lowerMs);
    resetServerClock(); expect(mode.withdrawZtoTrashMode('palm')).toBe(true); await flush();
    expect(pending[1].update(NOW)).toBeNull();
});
