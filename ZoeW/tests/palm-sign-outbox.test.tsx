import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState } from '../src/core/state';
import { palmSignState } from '../src/core/palm-sign-state';
import { registerModalMeta, unregisterModalMeta, modalIsOpen } from '../src/core/modals';
import { appLocalStore } from '../src/core/storage';
import { encryptLookupSecret } from '../src/services/crypto';
import { openSignJob, sealSignJob, replaceSignJob, addSignJob, SIGN_OUTBOX_LEASE_MS } from '../src/services/palm-sign-outbox-store';
import { openZtoPalmSign, submitZtoPalmSign, acceptPalmSignBarcode, setPalmSignName } from '../src/features/zto-palm-sign';
import { actOnQueuedSign, palmSignOutboxState, runPalmSignOutbox } from '../src/features/palm-sign-outbox';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { closeModal } from '../src/ui/modal';
import { barcodeSignIdentity } from '../src/domain/barcode';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
const disk = vi.hoisted(() => ({ rows: new Map<string, any>(), commit: null as null | Promise<void>, fail: false }));
vi.mock('../src/services/palm-sign-outbox-store', async (original) => ({ ...await original<any>(),
    listSignJobs: vi.fn(async (owner) => [...disk.rows.values()].filter((r) => r.owner === owner).map((r) => ({ ...r }))),
    addSignJob: vi.fn(async (row, current) => {
        if (disk.commit) await disk.commit;
        if (disk.fail || !current()) throw new Error('outbox:aborted');
        if (disk.rows.has(row.id)) return false;
        disk.rows.set(row.id, { ...row }); return true;
    }),
    replaceSignJob: vi.fn(async (previous, next, current) => {
        const actual = disk.rows.get(previous.id);
        if (!current() || !actual || actual.revision !== previous.revision) return false;
        if (next) disk.rows.set(next.id, { ...next, revision: previous.revision + 1 }); else disk.rows.delete(previous.id);
        return true;
    })
}));
vi.mock('../src/services/palm-sign-camera', () => ({ capturePalmSignPhoto: vi.fn(async () => ''), palmSignLocation: { status: 'ready' } }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {}, removeSingleBarcode: async () => 'failed', toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {}, closeEditBarcodeModal: () => {}, saveEditedBarcodePrice: () => {}, applyBarcodeCloseChange: vi.fn(async () => true)
}));
const codes = ['77130500000012', '77130500000013', '77130500000014'];
const photos = codes.map((_, n) => Buffer.from([255, 216, 255, n, 1, 2, 3, 255, 217]).toString('base64'));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const receipt = (body: any, patch = {}) => reply({ success: true, stage: 'receipt', barcode: body.barcode, requestId: body.requestId, ztoClosed: true, photoAccepted: true, ...patch });
const warning = (body: any, token = 'confirmation') => reply({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: body.barcode, stage: 'receipt', message: 'កញ្ចប់មានបញ្ហា សូមបញ្ជាក់ដោះស្រាយរួច', confirmationToken: token }, 409);
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { resolve, promise }; }
let requests: any[];
let network: (body: any) => Promise<Response>;
let key: CryptoKey;
let config: any;
async function ready(count = 3) {
    openZtoPalmSign('item1');
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    setPalmSignName('សុខា');
    for (let i = 0; i < count; i++) acceptPalmSignBarcode(codes[i], photos[i]);
    await vi.waitFor(() => expect(palmSignState.dispatchResults.filter((r) => r.proof)).toHaveLength(3));
    requests = [];
}
async function jobs() { return Promise.all([...disk.rows.values()].map(async (row) => ({ row, job: await openSignJob(row, key) }))); }
const bodies = (stage: string) => requests.filter((b) => b.stage === stage);
const closes = () => vi.mocked(applyBarcodeCloseChange).mock.calls.map((c) => c[1]);
beforeEach(async () => {
    resetZtoFinalMarks(); ztoPickupStatus.clear();
    disk.rows.clear(); disk.commit = null; disk.fail = false;
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('indexedDB', {});
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    firebaseState.authGeneration++; firebaseState.db = {}; firebaseState.auth = { currentUser: { uid: 'audit-user' } };
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'synthetic-id' }) };
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
    securityState.lookupSecretKey = key;
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://sign-shop.firebaseio.com' }));
    config = { enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}', headerName: 'X-Zoe-Proxy-Key', headerValue: 'synthetic-key', palmTokenEnc: await encryptLookupSecret('session'), shop: 'https://sign-shop.firebaseio.com' };
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(config));
    dataState.scanHistory = [{ id: 'item1', phone: '012345678', isClosed: false, barcodes: codes.map((code, i) => ({ code, cod: i + 1, dod: 0.5, isClosed: false })) }];
    registerModalMeta('ztoPalmSignModal', {}); palmSignState.busy = false;
    vi.mocked(applyBarcodeCloseChange).mockReset().mockResolvedValue(true);
    requests = [];
    network = async (body) => body.stage === 'status' ? reply({ success: true, barcode: body.barcode, stage: 'status', dispatched: true, ztoClosed: false, dispatchProof: 'dispatch-' + body.barcode })
        : body.stage === 'receipt-check' ? reply({ success: true, barcode: body.barcode, stage: 'receipt-check', ready: true }) : receipt(body);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { const b = JSON.parse(String(init?.body)); requests.push(b); return network(b); }));
    await runPalmSignOutbox();
});
afterEach(async () => {
    resetZtoFinalMarks(); ztoPickupStatus.clear();
    firebaseState.authGeneration++; securityState.lookupSecretKey = null;
    closeModal('ztoPalmSignModal'); unregisterModalMeta('ztoPalmSignModal');
    await runPalmSignOutbox();
    vi.unstubAllGlobals(); vi.restoreAllMocks();
});
it('លេខទូរស័ព្ទមួយ ៣ កញ្ចប់៖ modal បិទក្រោយ durable commit ដោយមិនរង់ចាំ receipt-check ឬ ACK · រូបដាច់តាម barcode', async () => {
    await ready(); const ack = gate<Response>(); const precheck = gate<Response>(); const requestId = palmSignState.requestId;
    network = async (body) => body.stage === 'receipt-check' ? precheck.promise : ack.promise.then(() => receipt(body));
    await submitZtoPalmSign();
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(disk.rows.size).toBe(3); expect(closes()).toEqual([]);
    expect(bodies('receipt-check')).toHaveLength(0);
    expect((await jobs()).map(({ job }) => ({ code: job.code, photo: job.photo, signMan: job.signMan,
        dispatchProof: job.dispatchProof, requestId: job.requestId, autoConfirm: job.autoConfirm })).sort((a, b) => a.code.localeCompare(b.code)))
        .toEqual(codes.map((code, i) => ({ code, photo: photos[i], signMan: 'សុខា', dispatchProof: 'dispatch-' + code, requestId, autoConfirm: true })));
    await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(2));
    expect(palmSignOutboxState.rows).toHaveLength(3);
    ack.resolve(reply({}));
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(3);
    expect(bodies('receipt').map((b) => [b.barcode, b.photo]).sort()).toEqual(codes.map((code, i) => [code, photos[i]]));
    expect(closes().sort()).toEqual(codes);
    await runPalmSignOutbox(); expect(bodies('receipt')).toHaveLength(3);
});
it.each(['cipher', 'key'])('ការងារ Sign អានមិនបាន (%s) មិនរារាំងកញ្ចប់ផ្សេង ហើយមិនលុបរូបដើម', async (kind) => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await ready();
    await submitZtoPalmSign();
    await runPalmSignOutbox();
    expect(disk.rows.size).toBe(3);
    const badId = (await jobs()).find((value) => value.job.code === codes[0])!.row.id;
    const bad = disk.rows.get(badId);
    if (kind === 'cipher') {
        const bytes = new Uint8Array(bad.cipher.slice(0)); bytes[0] ^= 1;
        bad.cipher = bytes.buffer;
    } else {
        const oldKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
        const job = await openSignJob(bad, key);
        const old = await sealSignJob(bad.owner, oldKey, job);
        bad.cipher = old.cipher; bad.iv = old.iv;
    }
    const original = new Uint8Array(bad.cipher.slice(0));
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(palmSignOutboxState.message).not.toBe(''));
    requests = []; online.mockReturnValue(true);
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(disk.rows.size).toBe(1));
    expect(closes().sort()).toEqual(codes.slice(1));
    expect(bodies('receipt').map((body) => body.barcode).sort()).toEqual(codes.slice(1));
    expect(new Uint8Array(disk.rows.get(bad.id).cipher)).toEqual(original);
    expect(palmSignOutboxState.message).toContain('១');
});
it('ការងារ Sign អានមិនបាន (key ចាស់) ៖ Sign កញ្ចប់នោះម្ដងទៀត ➜ ជំនួសការងារចាស់ ហើយ Sign បាន ១ ដង', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await ready(1); await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox();
    expect(disk.rows.size).toBe(1);
    const row = [...disk.rows.values()][0];
    const oldKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
    const old = await sealSignJob(row.owner, oldKey, await openSignJob(row, key));
    row.cipher = old.cipher; row.iv = old.iv;
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(palmSignOutboxState.message).toContain('១'));
    online.mockReturnValue(true);
    await ready(1); await submitZtoPalmSign([codes[0]]);
    expect(palmSignState.results).toEqual([expect.objectContaining({ code: codes[0], state: 'queued' })]);
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt').map((body) => body.barcode)).toEqual([codes[0]]);
    expect(closes()).toEqual([codes[0]]);
    expect(palmSignOutboxState.message).toBe('');
});
it('នាឡិកាថយក្រោយ៖ deadline ចាស់មិនបញ្ឈប់ការផ្ទៀង ACK ហើយមិនផ្ញើ05ម្ដងទៀត', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await ready(1); await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox();
    const row = [...disk.rows.values()][0]; const job = await openSignJob(row, key);
    const sealed = await sealSignJob(row.owner, key, { ...job, phase: 'checking' });
    disk.rows.set(row.id, { ...sealed, due: Date.now() + 3600000, leaseUntil: Date.now() + 3600000 });
    requests = []; online.mockReturnValue(true);
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt-status')).toHaveLength(1);
    expect(bodies('receipt')).toHaveLength(0);
    expect(closes()).toEqual([codes[0]]);
});
it.each(['leaseUntil', 'due'])('ការរង់ចាំ %s ត្រឹមត្រូវនៅតែទប់ការផ្ញើមុនកំណត់', async (field) => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await ready(1); await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox();
    const row = [...disk.rows.values()][0];
    row[field] = Date.now() + (field === 'due' ? 14000 : 85000);
    requests = []; online.mockReturnValue(true);
    await runPalmSignOutbox();
    expect(disk.rows.size).toBe(1); expect(bodies('receipt')).toHaveLength(0);
    expect(bodies('receipt-status')).toHaveLength(0); expect(closes()).toEqual([]);
});
it('durable commit កំពុងរង់ចាំ និងបរាជ័យ៖ modal និងរូបនៅដដែល · មិន upload រូប/05', async () => {
    await ready(1); const committed = gate<void>(); disk.commit = committed.promise; disk.fail = true;
    const before = vi.mocked(addSignJob).mock.calls.length;
    const work = submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(vi.mocked(addSignJob).mock.calls.length).toBeGreaterThan(before));
    expect(bodies('receipt-check')).toHaveLength(0);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true); expect(bodies('receipt')).toHaveLength(0);
    committed.resolve(); await work;
    expect(disk.rows.size).toBe(0); expect(bodies('receipt')).toHaveLength(0); expect(closes()).toEqual([]);
    expect(palmSignState.photos[codes[0]]).toBe(photos[0]); expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
});
it('៣ កញ្ចប់៖ queue មុនបណ្ដាញ ហើយ worker បញ្ជាក់សាររបស់កញ្ចប់នីមួយៗដោយមិនច្រឡំ token', async () => {
    await ready(); const normal = network;
    network = async (body) => body.barcode === codes[1] && body.stage === 'receipt' && !body.confirmationToken ? warning(body) : normal(body);
    await submitZtoPalmSign();
    expect(palmSignState.confirmation).toBeNull(); expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(bodies('receipt-check')).toHaveLength(0);
    await vi.waitFor(() => expect(new Set(closes())).toEqual(new Set(codes)));
    expect(bodies('receipt').filter((b) => b.confirmationToken).map((b) => b.barcode)).toEqual([codes[1]]);
    expect(bodies('receipt')).toHaveLength(4);
});
it('ការងារចាស់គ្មាន autoConfirm៖ បញ្ហាថ្មីក្នុង background នៅតែរង់ចាំបញ្ជាក់តែមួយ barcode', async () => {
    const online = await queuedWithPolicy(); const normal = network;
    network = async (body) => body.stage === 'receipt' && !body.confirmationToken ? warning(body, 'new-warning') : normal(body);
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(() => expect(palmSignOutboxState.rows[0]?.warning).toContain('កញ្ចប់មានបញ្ហា'));
    expect(closes()).toEqual([]); await runPalmSignOutbox(); expect(bodies('receipt')).toHaveLength(1);
    const id = palmSignOutboxState.rows[0].id;
    await Promise.all([actOnQueuedSign(id, 'approve'), actOnQueuedSign(id, 'approve')]);
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(2); expect(bodies('receipt')[1].confirmationToken).toBe('new-warning'); expect(closes()).toEqual([codes[0]]);
});

async function queuedWithPolicy(autoConfirm?: boolean) {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await ready(1); await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox();
    const value = (await jobs())[0];
    const next = await sealSignJob(value.row.owner, key, { ...value.job, autoConfirm } as any);
    disk.rows.set(value.row.id, { ...next, revision: value.row.revision + 1 });
    requests = [];
    return online;
}

it('ការងារថ្មីបញ្ជាក់ warning ដោយស្វ័យប្រវត្តិ៖ រក្សា token និងបន្ត lease តាម CAS មុន replay', async () => {
    const online = await queuedWithPolicy(true); const now = Date.now(); let clock = now;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    let beforeLease = 0; let savedBeforeReplay: any;
    network = async (body) => {
        if (!body.confirmationToken) { beforeLease = (await jobs())[0].row.leaseUntil; clock += 44000; return warning(body, 'auto-warning'); }
        savedBeforeReplay = (await jobs())[0]; return receipt(body);
    };
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(2); expect(disk.rows.size).toBe(0); expect(closes()).toEqual([codes[0]]);
    expect(savedBeforeReplay.job).toMatchObject({ phase: 'checking', autoConfirm: true, confirmationToken: 'auto-warning' });
    expect(savedBeforeReplay.row.leaseUntil).toBe(clock + SIGN_OUTBOX_LEASE_MS);
    expect(savedBeforeReplay.row.leaseUntil).toBeGreaterThan(beforeLease);
    expect(bodies('receipt')[1]).toEqual({ ...bodies('receipt')[0], confirmationToken: 'auto-warning' });
});

it('CAS រក្សា token បរាជ័យ៖ ការងារ auto-confirm មិន replay និងមិនបិទ', async () => {
    const online = await queuedWithPolicy(true);
    network = async (body) => { vi.mocked(replaceSignJob).mockResolvedValueOnce(false); return warning(body); };
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('បណ្ដាញ'));
    expect(bodies('receipt')).toHaveLength(1); expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
});

it.each(['restore', 'remove'])('កញ្ចប់ %s ខណៈ warning រង់ចាំ៖ មិន replay រូបចាស់ និងមិនបិទ', async (change) => {
    const online = await queuedWithPolicy(true); const pending = gate<void>();
    network = async (body) => body.confirmationToken ? receipt(body) : pending.promise.then(() => warning(body));
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(1));
    if (change === 'restore') dataState.scanHistory[0].barcodes[0].restoredAt = Date.now();
    else dataState.scanHistory[0].barcodes = dataState.scanHistory[0].barcodes.slice(1);
    pending.resolve();
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(bodies('receipt')).toHaveLength(1); expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
    expect((await jobs())[0].job.confirmationToken).toBeUndefined();
});

it('កញ្ចប់ស្តារពេល CAS រក្សា token៖ រក្សាការងារដើម ហើយមិន replay រូបចាស់', async () => {
    const online = await queuedWithPolicy(true);
    network = async (body) => {
        vi.mocked(replaceSignJob).mockImplementationOnce(async (previous, next, current) => {
            const actual = disk.rows.get(previous.id);
            if (!current() || !next || !actual || actual.revision !== previous.revision) return false;
            disk.rows.set(next.id, { ...next, revision: previous.revision + 1 });
            dataState.scanHistory[0].barcodes[0].restoredAt = Date.now();
            return true;
        });
        return warning(body, 'auto-warning');
    };
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('បណ្ដាញ'));
    expect(bodies('receipt')).toHaveLength(1); expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
    expect((await jobs())[0].job).toMatchObject({ phase: 'checking', confirmationToken: 'auto-warning' });
});

it('បាត់ ACK ក្រោយ auto-confirm៖ token នៅរក្សាទុក ហើយបើកឡើងវិញសួរតែ receipt-status', async () => {
    const online = await queuedWithPolicy(true);
    network = async (body) => {
        if (body.stage === 'receipt-status') return receipt(body);
        if (!body.confirmationToken) return warning(body, 'auto-warning');
        throw new Error('lost ack after automatic confirmation');
    };
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('បណ្ដាញ'));
    expect(bodies('receipt')).toHaveLength(2); expect(closes()).toEqual([]);
    expect((await jobs())[0].job).toMatchObject({ phase: 'checking', confirmationToken: 'auto-warning' });
    for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(2); expect(bodies('receipt-status')).toHaveLength(1);
    expect(closes()).toEqual([codes[0]]); expect(disk.rows.size).toBe(0);
});

it('ការងារ auto-confirm មាន token រួច៖ warning ថ្មីនៅតែទាមទារសកម្មភាព ហើយមិនបញ្ជាក់ជារង្វង់', async () => {
    const online = await queuedWithPolicy(true); const value = (await jobs())[0];
    const next = await sealSignJob(value.row.owner, key, { ...value.job, confirmationToken: 'already-approved' });
    disk.rows.set(value.row.id, { ...next, revision: value.row.revision + 1 });
    network = async (body) => warning(body, 'changed-warning');
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(bodies('receipt')).toHaveLength(1); expect(closes()).toEqual([]);
    expect((await jobs())[0].job).toMatchObject({ phase: 'action', warningToken: 'changed-warning' });
});
it('បណ្ដាញដាច់ក្រោយ05៖ ស្តារដោយ receipt-status តូច មិនផ្ញើរូប/05 ម្ដងទៀត', async () => {
    await ready(1); const normal = network;
    network = async (body) => { if (body.stage === 'receipt') throw new Error('lost ack'); return normal(body); };
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('បណ្ដាញ'));
    expect(closes()).toEqual([]);
    for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(1); expect(bodies('receipt-status')).toHaveLength(1);
    expect(bodies('receipt-status')[0].photo).toBeUndefined(); expect(closes()).toEqual([codes[0]]);
});
it.each(['photo', 'request'])('ACK ខ្វះ %s មិនជោគជ័យ និងមិនបិទក្នុង ZoeW', async (kind) => {
    await ready(1); const normal = network;
    network = async (body) => body.stage === 'receipt' ? receipt(body, kind === 'photo' ? { photoAccepted: undefined } : { requestId: 'other-request' }) : normal(body);
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('មិនទាន់បញ្ជាក់'));
    expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
});
it('ZTO ACK រួច · local DB ACK បាត់ ទោះ optimistic closed ក៏រក្សា queue ហើយ retry តែ local close', async () => {
    await ready(1);
    vi.mocked(applyBarcodeCloseChange).mockImplementationOnce(async () => { dataState.scanHistory[0].barcodes[0].isClosed = true; return false; });
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('confirmed'));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(disk.rows.size).toBe(1);
    for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(1); expect(closes()).toEqual([codes[0], codes[0]]);
});
it('offline ក្រោយ precheck៖ រក្សា ៣ រូប · online បន្តតែមួយដងតាម barcode', async () => {
    await ready(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await submitZtoPalmSign();
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(disk.rows.size).toBe(3); expect(bodies('receipt')).toHaveLength(0); expect(closes()).toEqual([]);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(closes().sort()).toEqual(codes); expect(bodies('receipt')).toHaveLength(3);
});
it('ស្តារកញ្ចប់ខណៈ ACK រង់ចាំ៖ ការងារចាស់មិនបិទវគ្គថ្មី ឬផ្ញើ05ម្ដងទៀត', async () => {
    await ready(1); const ack = gate<Response>(); const normal = network;
    network = async (body) => body.stage === 'receipt' ? ack.promise.then(() => receipt(body)) : normal(body);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(1));
    dataState.scanHistory[0].barcodes[0].restoredAt = Date.now();
    ack.resolve(reply({}));
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('បណ្ដាញ'));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox(); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(closes()).toEqual([]); expect(dataState.scanHistory[0].barcodes[0].isClosed).toBe(false);
    expect(bodies('receipt')).toHaveLength(1); expect(disk.rows.size).toBe(1);
});
it('DB មាន restore ថ្មីជាង local៖ transaction មិនបិទ barcode ឬបន្ថែមលុយក្នុងវគ្គថ្មី', async () => {
    const real = await vi.importActual<typeof import('../src/features/barcode-ops')>('../src/features/barcode-ops');
    const item = dataState.scanHistory[0];
    const identity = barcodeSignIdentity(item, item.barcodes[0]);
    const server = structuredClone(item); server.barcodes[0].restoredAt = Date.now();
    let mutation: any = 'not-called';
    const update = vi.fn(async () => {});
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }), update,
        runTransaction: async (_ref: any, change: (v: any) => any) => {
            mutation = change(server);
            return { committed: false, snapshot: { val: () => server } };
        }
    };
    expect(await real.applyBarcodeCloseChange(item.id, codes[0], true, { silent: true, showModal: false, expectedSignIdentity: identity })).toBe(false);
    expect(mutation).toBeUndefined(); expect(server.barcodes[0].isClosed).toBe(false);
    expect(update).not.toHaveBeenCalled(); expect(item.barcodes[0].isClosed).toBe(false);
});
it.each(['auth', 'shop', 'database', 'lock'])('ចម្លើយមកក្រោយប្ដូរ %s មិនបិទឬលុប queue របស់ម្ចាស់ដើម', async (kind) => {
    await ready(1); const ack = gate<Response>(); const normal = network;
    network = async (body) => body.stage === 'receipt' ? ack.promise.then(() => receipt(body)) : normal(body);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(1));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'database') firebaseState.db = {};
    if (kind === 'lock') securityState.appIsLocked = true;
    ack.resolve(reply({})); await new Promise((resolve) => setTimeout(resolve, 30));
    expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
});

it.each<[number, boolean]>([[2, false], [3, false], [2, true]])('លេខមួយ %s កញ្ចប់ · rollback takeover %s៖ App → Function → ZTO → local close ពិត · បញ្ហា + ACK បាត់ · លុយ/អតិថិជនមិនស្ទួន', async (count, rollback) => {
    const real = await vi.importActual<typeof import('../src/features/barcode-ops')>('../src/features/barcode-ops');
    const sign = createRequire(import.meta.url)('../netlify/functions/_shared/zto-palm-sign.js');
    const chosen = codes.slice(0, count);
    const day = (await import('../src/core/timezone')).getFormattedDate();
    const clone = (v: any) => v == null ? null : JSON.parse(JSON.stringify(v));
    const db: any = { zoew_scan_history_cod_dod: { item1: { id: 'item1', phone: '012345678', scanDate: day, isClosed: false,
        barcodes: chosen.map((code, i) => ({ code, cod: i + 1, dod: 0.5, isClosed: false })) } } };
    const read = (path: string) => clone(path.split('/').filter(Boolean).reduce((value: any, part) => value?.[part], db));
    const write = (path: string, value: any) => {
        const parts = path.split('/').filter(Boolean); const last = parts.pop()!; let target = db;
        for (const part of parts) target = target[part] ||= {};
        if (value == null) delete target[last]; else target[last] = clone(value);
    };
    firebaseState.fb = {
        getIdTokenResult: async () => ({ token: 'synthetic-id' }),
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => read(ref.path), exists: () => read(ref.path) !== null }),
        runTransaction: async (ref: any, change: (value: any) => any) => {
            const next = change(read(ref.path)); if (next === undefined) return { committed: false };
            write(ref.path, next); return { committed: true, snapshot: { val: () => read(ref.path) } };
        },
        update: async (ref: any, updates: any) => { for (const [key, value] of Object.entries(updates)) write(ref.path + '/' + key, value); }
    };
    dataState.scanHistory = [clone(db.zoew_scan_history_cod_dod.item1)]; dataState.deletedItems = []; dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' }; firebaseState.dbRefDailyCollected = { path: 'zoew_daily_collected_cod_dod' };
    vi.mocked(applyBarcodeCloseChange).mockImplementation(real.applyBarcodeCloseChange);
    const journal = new Map<string, { data: string; etag: string }>(); let revision = 0;
    const session = { token: 'session', site: 'KH1', operator: 'operator' };
    const proof = { seal: JSON.stringify, open: JSON.parse, stamp: (s: string) => s, verdict: (r: any) => ({ ztoClosed: r.result[0].mail.isSign === 1 }) };
    const deps = { keyLabel: 'synthetic', lookupAccess: async () => ({ verified: true, site: 'KH1' }), blobStore: () => ({ store: {
        getWithMetadata: async (key: string) => journal.get(key) || null,
        set: async (key: string, data: string, opts: any) => {
            const old = journal.get(key);
            if (opts.onlyIfNew && old || opts.onlyIfMatch && old?.etag !== opts.onlyIfMatch) return { modified: false };
            const etag = String(++revision); journal.set(key, { data, etag }); return { modified: true, etag };
        }
    } }) };
    const upstream: any[] = []; const received = new Set<string>(); let problemChecks = 0;
    const firstSign = gate<void>();
    const request = async (path: string, body: any) => {
        upstream.push({ path, body });
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: body.mailNos, isSign: received.has(body.mailNos) ? 1 : 0 },
            tracks: [{ mailNo: body.mailNos, siteCode: session.site, action: received.has(body.mailNos) ? '5' : '4', time: '2026-10-19 12:01:00' }] }] };
        if (path.endsWith('queryPreOrderByBillCode')) return { status: true, result: { billCode: body.billCode } };
        if (path.endsWith('newBusinessCheck') && body.billCode === codes[1]) return { status: true, result: { message: rollback && ++problemChecks > 1 ? 'បញ្ហាថ្មី ត្រូវបញ្ជាក់ម្ដងទៀត' : 'កញ្ចប់មានបញ្ហា', whetherForce: false } };
        if (path.endsWith('saveScanInfo')) {
            if (rollback && body[0].billCode === codes[0]) await firstSign.promise;
            received.add(body[0].billCode);
            if (body[0].billCode === codes[0]) throw new Error('accepted-but-ack-lost');
            return { status: true, result: [] };
        }
        return { status: true, result: null };
    };
    network = async (body) => { const out = await sign.signPalm({ body: JSON.stringify(body) }, session, deps, request, proof); return new Response(out.body, { status: out.statusCode }); };
    try {
        openZtoPalmSign('item1'); await vi.waitFor(() => expect(palmSignState.checking).toBe(false)); setPalmSignName('សុខា');
        chosen.forEach((code, i) => acceptPalmSignBarcode(code, photos[i]));
        await submitZtoPalmSign();
        expect(palmSignState.confirmation).toBeNull();
        expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
        if (rollback) {
            await vi.waitFor(async () => expect((await jobs()).find((value) => value.job.code === codes[1])?.job.phase).toBe('action'));
            expect(upstream.filter((c) => c.path.endsWith('saveBillPic') && c.body.billCode === codes[1])).toHaveLength(0);
            await vi.waitFor(() => expect(upstream.filter((c) => c.path.endsWith('saveScanInfo'))).toHaveLength(1));
            const before = (await jobs()).find((value) => value.job.code === codes[0])!;
            expect(before.job.phase).toBe('checking');
            // A clock rollback makes an active lease appear farther away than its maximum duration.
            disk.rows.get(before.row.id).leaseUntil = Date.now() + 3600000;
            const otherTab = await import('../src/features/palm-sign-outbox' + '?rollback-takeover');
            expect(otherTab.runPalmSignOutbox).not.toBe(runPalmSignOutbox);
            await otherTab.runPalmSignOutbox();
            await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(1));
            await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
            const pending = (await jobs())[0];
            expect(pending.row.revision).toBeGreaterThan(before.row.revision);
            expect(pending.job).toMatchObject({ requestId: before.job.requestId, photo: photos[0], phase: 'checking' });
            expect(received.has(codes[0])).toBe(false);
            expect(read('zoew_scan_history_cod_dod/item1').barcodes[0].isClosed).toBe(false);
            expect(upstream.filter((c) => c.path.endsWith('saveScanInfo'))).toHaveLength(1);
            expect(upstream.filter((c) => c.path.endsWith('saveBillPic'))).toHaveLength(1);
            firstSign.resolve();
            await vi.waitFor(() => expect(received.has(codes[0])).toBe(true));
            expect((await jobs())[0].job.requestId).toBe(before.job.requestId);
        }
        await vi.waitFor(async () => expect((await jobs()).find((v) => v.job.code === codes[0])?.job.message).toContain('មិនទាន់បញ្ជាក់'));
        expect(read('zoew_scan_history_cod_dod/item1').barcodes[0].isClosed).toBe(false);
        if (rollback) {
            expect(read('zoew_scan_history_cod_dod/item1').barcodes[1].isClosed).toBe(false);
            const pending = (await jobs()).find((value) => value.job.code === codes[1])!;
            await actOnQueuedSign(pending.row.id, 'approve');
        }
        expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
        await vi.waitFor(() => expect(read('zoew_scan_history_cod_dod/item1').barcodes.filter((b: any) => b.isClosed)).toHaveLength(count - 1));
        expect(read('zoew_scan_history_cod_dod/item1').isClosed).toBe(false);
        for (const row of disk.rows.values()) row.due = 0;
        await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
        await vi.waitFor(() => expect(read('zoew_daily_pickup_cod_dod/' + day)?.packagesPickedUp).toBe(count));
        expect(read('zoew_scan_history_cod_dod/item1').isClosed).toBe(true);
        expect(Object.keys(read('zoew_daily_pickup_cod_dod/' + day).pickedUpPhones)).toHaveLength(1);
        const money = Object.values(read('zoew_daily_collected_cod_dod/' + day)) as { c: number; d: number }[];
        expect(money.reduce((sum, r) => sum + r.c, 0)).toBe(count * (count + 1) / 2);
        expect(money.reduce((sum, r) => sum + r.d, 0)).toBe(count * 0.5);
        expect(upstream.filter((c) => c.path.endsWith('saveScanInfo'))).toHaveLength(count);
        expect(upstream.filter((c) => c.path.endsWith('saveBillPic')).map((c) => [c.body.billCode, c.body.fileName]).sort()).toEqual(chosen.map((code, i) => [code, photos[i]]));
        await runPalmSignOutbox();
        expect(read('zoew_daily_pickup_cod_dod/' + day).packagesPickedUp).toBe(count);
        expect(upstream.filter((c) => c.path.endsWith('saveScanInfo'))).toHaveLength(count);
    } finally {
        firstSign.resolve();
        firebaseState.serverClockTrusted = false; firebaseState.dbRefDailyPickup = null; firebaseState.dbRefDailyCollected = null;
    }
});
