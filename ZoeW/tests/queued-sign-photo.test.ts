import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { firebaseState, securityState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { sealSignJob, replaceSignJob, addSignJob, type SignEnvelope, type SignJob } from '../src/services/palm-sign-outbox-store';
import { exportQueuedSignPhoto } from '../src/features/queued-sign-photo';
import { saveOriginalQueuedPhoto } from '../src/platform/queued-photo-output';
const disk = vi.hoisted(() => ({ rows: [] as SignEnvelope[], wait: null as Promise<void> | null }));
vi.mock('../src/services/palm-sign-outbox-store', async (original) => ({ ...await original<any>(),
    listSignJobs: vi.fn(async (owner) => { if (disk.wait) await disk.wait; return disk.rows.filter((r) => r.owner === owner); }),
    replaceSignJob: vi.fn(() => { throw new Error('mutation'); }), addSignJob: vi.fn(() => { throw new Error('mutation'); })
}));
vi.mock('../src/platform/queued-photo-output', () => ({ saveOriginalQueuedPhoto: vi.fn(async () => 'saved') }));
const owner = JSON.stringify(['https://synthetic.firebaseio.com', 'synthetic-user']);
const photos = [btoa('\xff\xd8\xff\x00\x01\xff\xd9'), btoa('\xff\xd8\xff\x02\x03\xff\xd9')];
let key: CryptoKey;
beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('network'); }));
    firebaseState.authGeneration++; firebaseState.db = {}; firebaseState.auth = { currentUser: { uid: 'synthetic-user' } };
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    securityState.lookupSecretKey = key;
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://synthetic.firebaseio.com' }));
    disk.wait = null; disk.rows = await Promise.all(photos.map((photo, i) => sealSignJob(owner, key, { code: 'SYNTHETIC' + i, itemId: 'item', requestId: 'request', photo, phase: 'checking', attempts: 1, signature: '', parcelIdentity: '', signMan: '', dispatchProof: '', message: '' } as SignJob)));
    vi.mocked(saveOriginalQueuedPhoto).mockClear();
});
afterEach(() => { vi.unstubAllGlobals(); });
it('រក្សារូបដើមតាមកញ្ចប់ដោយមិនប្តូរជួរ ឬហៅបណ្ដាញ', async () => {
    const before = structuredClone(disk.rows);
    await exportQueuedSignPhoto(disk.rows[1].id, 'SYNTHETIC1');
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0');
    expect(vi.mocked(saveOriginalQueuedPhoto).mock.calls.map((c) => c.slice(0, 2))).toEqual([[photos[1], 'ZoeW-SYNTHETIC1-original.jpg'], [photos[0], 'ZoeW-SYNTHETIC0-original.jpg']]);
    expect(disk.rows).toEqual(before); expect(fetch).not.toHaveBeenCalled();
    expect(replaceSignJob).not.toHaveBeenCalled(); expect(addSignJob).not.toHaveBeenCalled();
});
it('PIN ខុស ម្ចាស់ខុស លេខខុស និងជួរបាត់ មិនចេញរូប', async () => {
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC1');
    await exportQueuedSignPhoto('missing', 'SYNTHETIC0');
    securityState.lookupSecretKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0');
    securityState.lookupSecretKey = key; firebaseState.auth = { currentUser: { uid: 'other' } };
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0');
    expect(saveOriginalQueuedPhoto).not.toHaveBeenCalled(); expect(disk.rows).toHaveLength(2);
});
it.each(['session', 'shop', 'lock', 'key'])('ប្តូរ %s ក្រោយអាន មិនចេញរូប', async (kind) => {
    let done!: () => void; disk.wait = new Promise<void>((resolve) => { done = resolve; });
    const work = exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0');
    if (kind === 'session') firebaseState.authGeneration++;
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'lock') securityState.appIsLocked = true;
    if (kind === 'key') securityState.lookupSecretKey = null;
    done(); await work; expect(saveOriginalQueuedPhoto).not.toHaveBeenCalled();
});
it('ចុចជាប់គ្នាចេញតែម្ដង និងអាចរក្សាម្ដងទៀត', async () => {
    let done!: () => void; disk.wait = new Promise<void>((resolve) => { done = resolve; });
    const first = exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0');
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0'); done(); await first;
    expect(saveOriginalQueuedPhoto).toHaveBeenCalledTimes(1);
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0'); expect(saveOriginalQueuedPhoto).toHaveBeenCalledTimes(2);
});

it('ប្តូរសម័យពេលឌីគ្រីប មិនចេញរូប', async () => {
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'decrypt').mockImplementationOnce(async (...args) => {
        const result = await decrypt(...args); firebaseState.authGeneration++; return result;
    });
    await exportQueuedSignPhoto(disk.rows[0].id, 'SYNTHETIC0');
    expect(saveOriginalQueuedPhoto).not.toHaveBeenCalled();
});
it('snapshot អ៊ិនគ្រីបដែលអានរួចរក្សារូបដើម ទោះ worker ដកជួរក្រោយអាន', async () => {
    const row = disk.rows[0]; const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'decrypt').mockImplementationOnce(async (...args) => {
        disk.rows = []; return decrypt(...args);
    });
    await exportQueuedSignPhoto(row.id, 'SYNTHETIC0');
    expect(saveOriginalQueuedPhoto).toHaveBeenCalledWith(photos[0], 'ZoeW-SYNTHETIC0-original.jpg', expect.any(Function));
});
