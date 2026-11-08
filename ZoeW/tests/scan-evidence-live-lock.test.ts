import { afterEach, beforeEach, expect, it } from 'vitest';
import { firebaseState } from '../src/core/state';
import { preparePendingScan, releasePendingScan, releasePendingScanAfter, SCAN_EVIDENCE_LOCK_PREFIX } from '../src/services/scan-pending';

/**
 * Web Lock `zoew-scan-live:<id>` ការពារភស្តុតាងស្កេនដែលកំពុងរក្សាទុក មិនឲ្យផ្លូវចេញម្ចាស់ក្នុងផ្ទាំងផ្សេងទម្លាក់។ ពេលការរក្សាទុកហួសពិដាន
 * (Save timed out) ការងារនៅបន្តក្រោយ ➜ lock ត្រូវនៅរហូតដល់ការរក្សាទុកបញ្ចប់ ⛔ មិនដោះពេលផ្ទាំងស្កេនបិទ (មុនកែ ៖ finally ដោះភ្លាម)។
 */

const HOST = 'https://scan-live-lock.firebaseio.com';
let held: Set<string>;
const waiters = new Map<string, () => void>();

beforeEach(() => {
    firebaseState.serverClockTrusted = true; firebaseState.sessionExpiryCheck = 'live';
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    held = new Set();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (name: string, callback: any) => {
        held.add(name);
        return Promise.resolve(callback({ name })).finally(() => { held.delete(name); waiters.get(name)?.(); });
    } } });
    const app = { options: { databaseURL: HOST } };
    Object.assign(firebaseState, { firebaseConfig: app.options, db: { app }, fb: {}, auth: { app, currentUser: { uid: 'lock-owner' } } });
    firebaseState.authGeneration++;
});
afterEach(() => { delete (navigator as any).locks; firebaseState.authGeneration++; });

const settled = (name: string) => new Promise<void>(resolve => { if (!held.has(name)) resolve(); else waiters.set(name, resolve); });

it('⛔ ការរក្សាទុកដែលនៅបន្ត ➜ lock នៅរហូតដល់វាបញ្ចប់ · គ្មានការងារបន្ត ➜ ដោះភ្លាម', async () => {
    const late = preparePendingScan('LIVELOCK0001', 1, 0, Date.now(), 'direct', 2);
    const name = SCAN_EVIDENCE_LOCK_PREFIX + late.record.id;
    await Promise.resolve();
    expect(held.has(name), 'លក្ខខណ្ឌចាំបាច់ ៖ lock ត្រូវកាន់ពេលរៀប').toBe(true);
    let finish!: (value: unknown) => void;
    const save = new Promise(resolve => { finish = resolve; });
    releasePendingScanAfter(late, save);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(held.has(name), 'ការរក្សាទុកមិនទាន់ចប់ ➜ lock នៅ').toBe(true);
    finish(true);
    await settled(name);
    expect(held.has(name), 'ការរក្សាទុកចប់ ➜ lock ដោះ').toBe(false);

    const quick = preparePendingScan('LIVELOCK0002', 1, 0, Date.now(), 'direct', 2);
    const quickName = SCAN_EVIDENCE_LOCK_PREFIX + quick.record.id;
    await Promise.resolve();
    releasePendingScanAfter(quick, null);
    await settled(quickName);
    expect(held.has(quickName)).toBe(false);

    const failed = preparePendingScan('LIVELOCK0003', 1, 0, Date.now(), 'direct', 2);
    const failedName = SCAN_EVIDENCE_LOCK_PREFIX + failed.record.id;
    await Promise.resolve();
    releasePendingScanAfter(failed, Promise.reject(new Error('late failure')));
    await settled(failedName);
    expect(held.has(failedName), 'ការរក្សាទុកបរាជ័យយឺត ➜ lock ដោះដែរ').toBe(false);
    releasePendingScan(late);
});


it('[audit-fixture-clock] clock មិនទាន់ផ្ទៀង មិនបង្កើត evidence ឬ lock ហើយបន្តក្រោយផ្ទៀង', async () => {
    firebaseState.serverClockTrusted = false;
    const before = Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]);
    expect(() => preparePendingScan('CLOCKLOCK0001', 1, 0, Date.now(), 'direct', 2)).toThrow('Scan clock uncertain');
    expect(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])).toEqual(before);
    expect(held.size).toBe(0);
    firebaseState.serverClockTrusted = true;
    const handle = preparePendingScan('CLOCKLOCK0001', 1, 0, Date.now(), 'direct', 2);
    const name = SCAN_EVIDENCE_LOCK_PREFIX + handle.record.id;
    await Promise.resolve();
    expect(held.has(name)).toBe(true);
    releasePendingScan(handle); await settled(name);
    expect(held.has(name)).toBe(false);
});
