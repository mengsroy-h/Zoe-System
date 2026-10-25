import { exportQueuedSignPhoto } from '../src/features/queued-sign-photo';
import { saveOriginalQueuedPhoto } from '../src/platform/queued-photo-output';
import { createHash, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState } from '../src/core/state';
import { palmSignState } from '../src/core/palm-sign-state';
import { registerModalMeta, unregisterModalMeta, modalIsOpen } from '../src/core/modals';
import { appLocalStore } from '../src/core/storage';
import { encryptLookupSecret } from '../src/services/crypto';
import { openSignJob, sealSignJob, replaceSignJob, addSignJob, SIGN_OUTBOX_LEASE_MS } from '../src/services/palm-sign-outbox-store';
import { openZtoPalmSign, submitZtoPalmSign, acceptPalmSignBarcode, setPalmSignName } from '../src/features/zto-palm-sign';
import { actOnQueuedSign, palmSignOutboxState, runPalmSignOutbox, refreshPalmSignQueue } from '../src/features/palm-sign-outbox';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { closeModal } from '../src/ui/modal';
import { barcodeSignIdentity } from '../src/domain/barcode';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
vi.mock('../src/platform/queued-photo-output', () => ({ saveOriginalQueuedPhoto: vi.fn(async () => 'saved') }));
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
const photos = codes.map((_, n) => Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,n + 1,255,217]).toString('base64'));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const receipt = (body: any, patch = {}) => reply({ success: true, stage: 'receipt', barcode: body.barcode, requestId: body.requestId, ztoClosed: true, photoAccepted: true, photoProof: { protocol: 'original-sha256-v1', verified: true, barcode: body.barcode, requestId: body.requestId, originalSHA256: body.originalSHA256 }, ...patch });
const warning = (body: any, token = 'confirmation') => reply({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: body.barcode, stage: 'receipt', message: 'កញ្ចប់មានបញ្ហា សូមបញ្ជាក់ដោះស្រាយរួច', confirmationToken: token }, 409);
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { resolve, promise }; }
let requests: any[];
let reservationFixtures = true;
const sentReceipts = new Set<string>();
const warningReceipts = new Set<string>();
function legacy(job: any) { return { ...job, reservationProtocol: undefined, originalFingerprint: undefined, reservationOwner: undefined, reservationToken: undefined, everReserved: undefined }; }
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
    requests = []; reservationFixtures = true; sentReceipts.clear(); warningReceipts.clear();
    network = async (body) => body.stage === 'status' ? reply({ success: true, barcode: body.barcode, stage: 'status', dispatched: true, ztoClosed: false, dispatchProof: 'dispatch-' + body.barcode })
        : body.stage === 'receipt-check' ? reply({ success: true, barcode: body.barcode, stage: 'receipt-check', ready: true }) : receipt(body);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { const b = JSON.parse(String(init?.body)); requests.push(b); const identity = b.barcode + '|' + b.requestId;
        if (b.stage === 'receipt') { sentReceipts.add(identity); warningReceipts.delete(identity); }
        if (reservationFixtures && b.stage === 'receipt-status' && b.reservationProtocol === 'original-reservation-v1' && (!sentReceipts.has(identity) || b.confirmationToken && warningReceipts.has(identity))) return resume(b);
        const response = await network(b);
        if (b.stage === 'receipt' && (await response.clone().json()).code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED') warningReceipts.add(identity);
        return response; }));
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
it('ការងារ Sign អានមិនបាន (key ចាស់) ៖ Sign កញ្ចប់នោះម្ដងទៀត មិនជំនួស ឬលុបរូបដើម', async () => {
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
    expect(palmSignState.results).toEqual([expect.objectContaining({ code: codes[0], state: 'failed' })]);
    expect(disk.rows.size).toBe(1);
    expect(bodies('receipt')).toHaveLength(0);
    expect(closes()).toEqual([]);
    expect(disk.rows.get(row.id).cipher).toEqual(old.cipher);
});
it('នាឡិកាថយក្រោយ៖ deadline ចាស់មិនបញ្ឈប់ការផ្ទៀង ACK ហើយមិនផ្ញើ05ម្ដងទៀត', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await ready(1); await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox();
    const row = [...disk.rows.values()][0]; const job = await openSignJob(row, key);
    const sealed = await sealSignJob(row.owner, key, { ...legacy(job), phase: 'checking' });
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
    expect(bodies('receipt')).toHaveLength(2); expect(bodies('receipt-status')).toHaveLength(2);
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
    expect(bodies('receipt')).toHaveLength(1); expect(bodies('receipt-status')).toHaveLength(2);
    expect(bodies('receipt-status')[0].photo).toBeUndefined(); expect(closes()).toEqual([codes[0]]);
});
it.each(['photo', 'request'])('ACK ខ្វះ %s រក្សារូបដើម ហើយបិទតែ Sign ដែលបានបញ្ជាក់', async (kind) => {
    await ready(1); const normal = network;
    network = async (body) => body.stage === 'receipt' ? receipt(body, kind === 'photo' ? { photoAccepted: undefined, photoProof: undefined } : { requestId: 'other-request' }) : normal(body);
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain(kind === 'photo' ? 'រង់ចាំផ្ទៀងរូបដើម' : 'មិនទាន់បញ្ជាក់'));
    expect(closes()).toEqual(kind === 'photo' ? [codes[0]] : []); expect(disk.rows.size).toBe(1);
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
it.each(['auth', 'shop', 'database', 'lock', 'key'])('ចម្លើយមកក្រោយប្ដូរ %s មិនបិទឬលុប queue របស់ម្ចាស់ដើម', async (kind) => {
    await ready(1); const ack = gate<Response>(); const normal = network;
    network = async (body) => body.stage === 'receipt' ? ack.promise.then(() => receipt(body)) : normal(body);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(1));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'database') firebaseState.db = {};
    if (kind === 'lock') securityState.appIsLocked = true;
    if (kind === 'key') securityState.lookupSecretKey = null;
    ack.resolve(reply({})); await new Promise((resolve) => setTimeout(resolve, 30));
    expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
});

it.each<[number, boolean, boolean]>([[2, false, false], [3, false, false], [2, true, false], [2, false, true]])('លេខមួយ %s កញ្ចប់ · rollback takeover %s · រូបផ្ទៀង %s៖ App → Function → ZTO → local close ពិត · បញ្ហា + ACK បាត់ · លុយ/អតិថិជនមិនស្ទួន', async (count, rollback, exactPhoto) => {
    const real = await vi.importActual<typeof import('../src/features/barcode-ops')>('../src/features/barcode-ops');
    reservationFixtures = false;
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
        if (path.endsWith('querySignPic')) return { status: true, result: [{ billCode: body.billCode, savePos: 'https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/' + body.billCode + '_1.jpg' }] };
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
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        if (String(url).startsWith('https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/')) {
            const index = codes.findIndex(code => String(url).includes('/' + code + '_'));
            return new Response(Buffer.from(photos[exactPhoto ? index : (index + 1) % photos.length], 'base64'), { headers: { 'Content-Type': 'image/jpeg' } });
        }
        const body = JSON.parse(String(init?.body)); requests.push(body); return network(body);
    }));
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
            await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(count + 1));
            await vi.waitFor(async () => expect((await jobs()).find((value) => value.job.code === codes[0])?.row.leaseUntil).toBe(0));
            const pending = (await jobs()).find((value) => value.job.code === codes[0])!;
            expect(pending.row.revision).toBeGreaterThan(before.row.revision);
            expect(pending.job).toMatchObject({ requestId: before.job.requestId, photo: photos[0], phase: 'checking' });
            expect(received.has(codes[0])).toBe(false);
            expect(read('zoew_scan_history_cod_dod/item1').barcodes[0].isClosed).toBe(false);
            expect(upstream.filter((c) => c.path.endsWith('saveScanInfo'))).toHaveLength(1);
            expect(upstream.filter((c) => c.path.endsWith('saveBillPic'))).toHaveLength(1);
            firstSign.resolve();
            await vi.waitFor(() => expect(received.has(codes[0])).toBe(true));
            expect((await jobs()).find((value) => value.job.code === codes[0])!.job.requestId).toBe(before.job.requestId);
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
        await runPalmSignOutbox(); await vi.waitFor(() => expect(read('zoew_scan_history_cod_dod/item1').barcodes.filter((b: any) => b.isClosed)).toHaveLength(count));
        await vi.waitFor(() => expect(disk.rows.size).toBe(exactPhoto ? 0 : count));
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

it('ការពារ៖ terminal rejection រក្សារូប មិនបង្កើត retry និងមិនរត់សំណើបន្ថែម', async () => {
    await ready(1);
    network = async body => reply({ code: 'ZTO_PALM_SIGN_REPORTED_REJECTED', barcode: body.barcode, requestId: body.requestId, stage: 'receipt', verificationRequired: true }, 409);
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    const value = (await jobs())[0];
    expect(value.job).toMatchObject({ verificationRequired: true, photo: photos[0] });
    expect(palmSignOutboxState.rows[0]).toMatchObject({ verificationRequired: true });
    expect(closes()).toEqual([]);
    const count = requests.length;
    await actOnQueuedSign(value.row.id, 'retry'); await runPalmSignOutbox();
    expect(requests).toHaveLength(count); expect(disk.rows.size).toBe(1);
});

it('ការពារ៖ ACK ចាស់មិនលុប verificationRequired ដែលរក្សាទុកដោយ worker ផ្សេង', async () => {
    await ready(1); const ack = gate<Response>();
    network = async body => { await ack.promise; return receipt(body); };
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(1));
    const old = (await jobs())[0];
    const sealed = await sealSignJob(old.row.owner, key, { ...old.job, phase: 'action', verificationRequired: true, message: 'ត្រូវផ្ទៀងក្នុង ZTO' });
    expect(await replaceSignJob(old.row, sealed, () => true)).toBe(true);
    ack.resolve(reply({}));
    await vi.waitFor(() => expect(palmSignOutboxState.rows[0]?.busy).toBe(false));
    expect((await jobs())[0].job).toMatchObject({ phase: 'action', verificationRequired: true, photo: photos[0] });
    expect(closes()).toEqual([]); expect(bodies('receipt')).toHaveLength(1);
});

it('ការពារ៖ queue terminal បង្ហាញសារផ្ទៀង តែគ្មាន Retry ឬ Approve', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { PalmSignQueueModal } = await import('../src/app/components/modals/PalmSignQueueModal');
    palmSignOutboxState.rows = [{ id: 'synthetic', code: codes[0], phase: 'action', message: 'ត្រូវផ្ទៀងក្នុង ZTO', verificationRequired: true, busy: false }];
    const html = renderToStaticMarkup(createElement(PalmSignQueueModal));
    expect(html).toContain('ត្រូវផ្ទៀងក្នុង ZTO');
    expect(html).not.toContain('ពិនិត្យស្ថានភាពឡើងវិញ');
    expect(html).not.toContain('បញ្ជាក់ និងបន្ត');
    palmSignOutboxState.rows = [{ ...palmSignOutboxState.rows[0], verificationRequired: undefined }];
    expect(renderToStaticMarkup(createElement(PalmSignQueueModal))).toContain('ពិនិត្យស្ថានភាពឡើងវិញ');
});

it.each([
    { ztoClosed: true, dispatched: true, dispatchProof: 'fresh', message: '⚠️ ZTO បង្ហាញថាកញ្ចប់បាន Sign រួច ប៉ុន្តែមិនទាន់បញ្ជាក់រូបរបស់ការងារនេះ។ សូមផ្ទៀងក្នុង ZTO។' },
    { ztoClosed: false, dispatched: false, dispatchProof: 'fresh', message: '⚠️ ZTO មិនទាន់បញ្ជាក់ការចែកចាយកញ្ចប់នេះ។ សូមផ្ទៀងក្នុង ZTO មុនបន្ត។' },
    { ztoClosed: false, dispatched: true, dispatchProof: '', message: '⚠️ ZTO បង្ហាញថាបានចែកចាយ ប៉ុន្តែ ZoeW មិនទាន់ទទួលភស្តុតាងសម្រាប់បន្ត Sign។ សូមផ្ទៀងក្នុង ZTO។' },
    { ztoClosed: undefined, dispatched: true, dispatchProof: 'fresh', message: '⚠️ មិនទាន់ផ្ទៀងស្ថានភាពកញ្ចប់នេះបានច្បាស់ពី ZTO។ សូមផ្ទៀងក្នុង ZTO មុនបន្ត។' }
])('មូលហេតុ queue ច្បាស់តាម status $ztoClosed/$dispatched/$dispatchProof ដោយមិនផ្ញើស្ទួន', async ({ message: _message, ...status }) => {
    const online = await queuedWithPolicy(true);
    const value = (await jobs())[0];
    const row = await sealSignJob(value.row.owner, key, { ...legacy(value.job), phase: 'checking' });
    disk.rows.set(row.id, row);
    network = async (body) => body.stage === 'receipt-status'
        ? reply({ code: 'ZTO_PALM_SIGN_RETRY_READY', barcode: body.barcode, retryable: true }, 409)
        : reply({ success: true, barcode: body.barcode, stage: 'status', ...status });
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0].row.leaseUntil).toBe(0));
    const retained = (await jobs())[0].job;
    expect(retained.phase).toBe('action');
    expect(retained.manualReviewReason).toBe('server_capability_missing');
    expect(retained.photo).toBe(value.job.photo); expect(retained.requestId).toBe(value.job.requestId);
    expect(bodies('status')).toHaveLength(0);
    expect(disk.rows.size).toBe(1); expect(bodies('receipt')).toHaveLength(0);
    expect(bodies('dispatch')).toHaveLength(0); expect(closes()).toEqual([]);
});

it.each([
    ...['queryPreOrderByBillCode', 'newBusinessCheck', '/add'].flatMap(failure => ['logical', 'transport', 'malformed', 'auth'].map(mode => ({ failure, mode }))),
    { failure: 'saveBillPic', mode: 'logical' },
    ...['transport', 'logical', 'malformed'].map(mode => ({ failure: 'saveScanInfo', mode }))
])('ការបដិសេធមុន Sign $failure/$mode មិនច្រឡំនឹងការផ្ញើមិនទាន់បញ្ជាក់', async ({ failure, mode }) => {
    reservationFixtures = false;
    const sign = createRequire(import.meta.url)('../netlify/functions/_shared/zto-palm-sign.js');
    const journal = new Map<string, { data: string; etag: string }>(); let serial = 0;
    const session = { token: 'session', site: 'KH1', operator: 'operator' };
    const proof = { seal: JSON.stringify, open: JSON.parse, stamp: (s: string) => s, verdict: (r: any) => ({ ztoClosed: r.result[0].mail.isSign === 1 }) };
    const deps = { keyLabel: 'synthetic', lookupAccess: async () => ({ verified: true, site: 'KH1' }), blobStore: () => ({ store: {
        getWithMetadata: async (key: string) => journal.get(key) || null,
        set: async (key: string, data: string, opts: any) => {
            const old = journal.get(key);
            if (opts.onlyIfNew && old || opts.onlyIfMatch && old?.etag !== opts.onlyIfMatch) return { modified: false };
            const etag = String(++serial); journal.set(key, { data, etag }); return { modified: true, etag };
        }
    } }) };
    const upstream: string[] = [];
    const request = async (path: string, body: any) => {
        upstream.push(path);
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: body.mailNos, isSign: 0 },
            tracks: [{ mailNo: body.mailNos, siteCode: 'KH1', action: '4', time: '2026-10-19 12:01:00' }] }] };
        if (path.endsWith(failure)) {
            if (mode === 'transport') throw new Error('synthetic transport failure');
            if (mode === 'malformed') return { result: null };
            if (mode === 'auth') return { status: false, authRejected: true };
            return { status: false, result: null };
        }
        if (path.endsWith('queryPreOrderByBillCode')) return { status: true, result: { billCode: body.billCode } };
        return { status: true, result: null };
    };
    const responses: any[] = [];
    network = async (body) => { const out = await sign.signPalm({ body: JSON.stringify(body) }, session, deps, request, proof);
        responses.push({ requestStage: body.stage, status: out.statusCode, ...JSON.parse(out.body) }); return new Response(out.body, { status: out.statusCode }); };
    openZtoPalmSign('item1'); await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    setPalmSignName('សុខា'); acceptPalmSignBarcode(codes[0], photos[0]);
    await submitZtoPalmSign([codes[0]]);
    const photoFailure = failure === 'saveBillPic'; const postSend = failure === 'saveScanInfo';
    const blocked = !postSend && (mode === 'logical' || mode === 'auth');
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe(blocked ? 'action' : 'checking'));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    const snapshots: any[] = [];
    const snapshot = async () => { const value = (await jobs())[0]; return { queue: value.job.phase, message: value.job.message,
        journal: JSON.parse([...journal.values()][0].data).phase, photoAccepted: JSON.parse([...journal.values()][0].data).photoAccepted,
        receipt: bodies('receipt').length, receiptStatus: bodies('receipt-status').length,
        photos: upstream.filter(p => p.endsWith('saveBillPic')).length, scans: upstream.filter(p => p.endsWith('saveScanInfo')).length }; };
    snapshots.push(await snapshot());
    for (let i = 0; i < 3; i++) {
        for (const row of disk.rows.values()) { row.due = 0; row.leaseUntil = 0; }
        const stopped = (await jobs())[0].job.phase === 'action';
        const polls = bodies('receipt-status').length;
        await runPalmSignOutbox();
        if (!stopped) {
            await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(polls + 1));
            await vi.waitFor(async () => expect((await jobs())[0].row.leaseUntil).toBe(0));
        }
        snapshots.push(await snapshot());
    }
    expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
    if (photoFailure) {
        expect(snapshots.at(-1)).toMatchObject({ queue: 'action', journal: 'reservation-v1:image-sending', photoAccepted: false, receipt: 1, receiptStatus: 1, photos: 1, scans: 0 });
    } else if (postSend) {
        expect(snapshots.at(-1)).toMatchObject({ queue: 'checking', journal: 'reservation-v1:sending', photoAccepted: true, receipt: 1, receiptStatus: 4, photos: 1, scans: 1 });
    } else if (blocked) {
        expect(snapshots.at(-1)).toMatchObject({ queue: 'action', journal: 'reservation-v1:blocked', photoAccepted: false, receipt: 1, receiptStatus: 1, photos: 0, scans: 0 });
        expect(upstream.filter(p => p.endsWith(failure))).toHaveLength(1);
    } else {
        expect(snapshots.at(-1)).toMatchObject({ queue: mode === 'malformed' ? 'action' : 'checking', journal: mode === 'transport' ? 'reservation-v1:claimed' : 'reservation-v1:blocked', photoAccepted: false, receipt: 1, receiptStatus: mode === 'malformed' ? 2 : 4, photos: 0, scans: 0 });
        expect(upstream.filter(p => p.endsWith(failure))).toHaveLength(1);
    }
    const retained = (await jobs())[0].job;
    expect(retained.photo).toBe(photos[0]);
    expect(retained.requestId).toBe(bodies('receipt')[0].requestId);
    if (blocked && !photoFailure) expect(responses.find(r => r.requestStage === 'receipt')).toMatchObject({ status: mode === 'auth' ? 401 : 409, code: mode === 'auth' ? 'ZTO_AUTH_EXPIRED' : 'ZTO_PALM_SIGN_CHECK_REJECTED' });
});

it('បើកជួរដើម្បីសង្គ្រោះរូប៖ អានតែប៉ុណ្ណោះ មិន Sign ឬកែ envelope', async () => {
    const owner = JSON.stringify(['https://sign-shop.firebaseio.com', 'audit-user']);
    const row = await sealSignJob(owner, key, { code: codes[0], itemId: 'item1', requestId: 'synthetic-request', signMan: '', photo: photos[0], dispatchProof: '', signature: '', parcelIdentity: '', phase: 'queued', attempts: 0, message: '' });
    disk.rows.set(row.id, row);
    const before = structuredClone(row);
    await refreshPalmSignQueue();
    expect(palmSignOutboxState.rows.map((v) => v.code)).toEqual([codes[0]]);
    expect(disk.rows.get(row.id)).toEqual(before);
    expect(requests).toEqual([]); expect(closes()).toEqual([]);
});

it('បិទការភ្ជាប់ ZTO នៅតែអានជួររូបបាន ដោយគ្មានបណ្ដាញ', async () => {
    const owner = JSON.stringify(['https://sign-shop.firebaseio.com', 'audit-user']);
    const row = await sealSignJob(owner, key, { code: codes[0], itemId: 'item1', requestId: 'synthetic-request', signMan: '', photo: photos[0], dispatchProof: '', signature: '', parcelIdentity: '', phase: 'queued', attempts: 0, message: '' });
    disk.rows.set(row.id, row);
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, enabled: false }));
    await refreshPalmSignQueue();
    expect(palmSignOutboxState.rows.map((v) => v.code)).toEqual([codes[0]]);
    await runPalmSignOutbox();
    expect(palmSignOutboxState.rows.map((v) => v.code)).toEqual([codes[0]]);
    await exportQueuedSignPhoto(row.id, codes[0]);
    expect(saveOriginalQueuedPhoto).toHaveBeenCalledWith(photos[0], 'ZoeW-' + codes[0] + '-original.jpg', expect.any(Function));
    expect(requests).toEqual([]); expect(closes()).toEqual([]);
});

it.each(['absent', 'wrong', 'reversed'])('រូបដើមនៅរក្សាទុក ពេលភស្តុតាង %s', async (kind) => {
    await ready(1);
    network = async (body) => receipt(body, { photoProof: kind === 'absent' ? undefined : { protocol: 'original-sha256-v1', verified: true,
        barcode: kind === 'reversed' ? codes[1] : body.barcode, requestId: body.requestId, originalSHA256: kind === 'wrong' ? '0'.repeat(64) : body.originalSHA256 } });
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(closes()).toEqual([codes[0]]));
    expect(disk.rows.size).toBe(1);
    expect((await jobs())[0].job.photo).toBe(photos[0]);
});
it('គ្មាន IndexedDB មិនផ្ញើ receipt និងរក្សារូបក្នុង modal', async () => {
    await ready(1); vi.stubGlobal('indexedDB', undefined);
    await submitZtoPalmSign([codes[0]]);
    expect(bodies('receipt')).toHaveLength(0);
    expect(palmSignState.photos[codes[0]]).toBe(photos[0]);
});

it('ការងារ confirmed ចាស់ក្រោយបើកឡើងវិញ មិនលុបរូបតាម ACK ចាស់', async () => {
    const online = await queuedWithPolicy(true);
    const value = (await jobs())[0];
    const row = await sealSignJob(value.row.owner, key, { ...legacy(value.job), originalSHA256: undefined, phase: 'confirmed' });
    disk.rows.set(row.id, row);
    network = async (body) => receipt(body, { photoProof: undefined });
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(1));
    await vi.waitFor(async () => expect((await jobs())[0].row.leaseUntil).toBe(0));
    expect(disk.rows.size).toBe(1); expect((await jobs())[0].job.photo).toBe(photos[0]);
    expect(bodies('receipt')).toHaveLength(0);
    expect(bodies('receipt-status')[0].originalSHA256).toMatch(/^[a-f0-9]{64}$/);
});

it.each([28, 900000])('legacy binding រូប %s bytes ផ្ញើពេញតែម្ដង រួច poll hash តូច និងលុបតែភស្តុតាងត្រឹមត្រូវ', async photoBytes => {
    const online = await queuedWithPolicy(true); const value = (await jobs())[0];
    const bytes = Buffer.alloc(photoBytes, 17); const template = Buffer.from(value.job.photo, 'base64');
    template.copy(bytes, 0, 0, template.length - 2); bytes.set([255, 217], bytes.length - 2);
    const originalPhoto = bytes.toString('base64');
    const row = await sealSignJob(value.row.owner, key, { ...legacy(value.job), photo: originalPhoto, originalSHA256: undefined, phase: 'checking' });
    disk.rows.set(row.id, row);
    let bound = false; let verified = false;
    network = async (body) => {
        const serialized = JSON.stringify(body); expect(Buffer.byteLength(serialized)).toBeLessThan(1220000);
        if (body.photo) { expect(body.photo).toBe(originalPhoto); expect(serialized.split(originalPhoto)).toHaveLength(2); expect(body.signMan).toBe(value.job.signMan); bound = true; }
        if (!bound) return reply({ code: 'ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED', barcode: body.barcode, uncertain: true }, 409);
        return receipt(body, verified ? {} : { photoProof: undefined });
    };
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0].row.leaseUntil).toBe(0));
    expect(bodies('receipt-status')).toHaveLength(2); expect(disk.rows.size).toBe(1);
    verified = true; for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt-status')).toHaveLength(3);
    expect(bodies('receipt-status').filter(body => body.photo)).toHaveLength(1);
    expect(bodies('receipt')).toHaveLength(0);
});

it('៣ កញ្ចប់ ACK បញ្ច្រាស លុបតែកញ្ចប់ដែលរូបបានផ្ទៀងត្រូវ', async () => {
    await ready(); const pending = codes.map(() => gate<void>());
    network = async (body) => { const index = codes.indexOf(body.barcode); await pending[index].promise; return receipt(body, index === 1 ? { photoProof: undefined } : {}); };
    await submitZtoPalmSign(); await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(2));
    pending[codes.indexOf(bodies('receipt')[1].barcode)].resolve(); await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(3));
    pending.forEach(gate => gate.resolve());
    await vi.waitFor(() => expect(new Set(closes())).toEqual(new Set(codes)));
    await vi.waitFor(() => expect(disk.rows.size).toBe(1));
    expect((await jobs())[0].job.code).toBe(codes[1]); expect((await jobs())[0].job.photo).toBe(photos[1]);
});

it('ភស្តុតាងរូបត្រឹមត្រូវ តែ restore ក្រោយ local close ACK មិនលុបរូប', async () => {
    await ready(1);
    vi.mocked(applyBarcodeCloseChange).mockImplementationOnce(async () => { dataState.scanHistory[0].barcodes[0].restoredAt = Date.now(); return true; });
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(closes()).toEqual([codes[0]]));
    expect(disk.rows.size).toBe(1); expect((await jobs())[0].job.photo).toBe(photos[0]);
});

it('legacy bind បាត់សំណើ៖ poll តូច និងសាក binding ឡើងវិញក្រោយរយៈពេលរង់ចាំ ដោយមិន05', async () => {
    const online = await queuedWithPolicy(true); const value = (await jobs())[0];
    const row = await sealSignJob(value.row.owner, key, { ...legacy(value.job), originalSHA256: undefined, phase: 'checking' });
    disk.rows.set(row.id, row);
    let fail = true;
    network = async (body) => {
        if (!body.photo) return reply({ code: 'ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED', barcode: body.barcode, uncertain: true }, 409);
        if (fail) throw new Error('binding lost');
        return receipt(body);
    };
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0].row.leaseUntil).toBe(0));
    expect(bodies('receipt-status').filter(body => body.photo)).toHaveLength(1);
    for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox();
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(3));
    await vi.waitFor(async () => expect((await jobs())[0].row.leaseUntil).toBe(0));
    expect(bodies('receipt-status').filter(body => body.photo)).toHaveLength(1);
    const saved = (await jobs())[0];
    const expired = await sealSignJob(saved.row.owner, key, { ...saved.job, legacyBindingRetryAfter: Date.now() - 1 });
    disk.rows.set(expired.id, { ...expired, revision: saved.row.revision + 1 }); fail = false;
    await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt-status').filter(body => body.photo)).toHaveLength(2);
    expect(bodies('receipt')).toHaveLength(0);
});

it('ភស្តុតាងត្រឹមត្រូវ តែ CAS លុបបរាជ័យ រូបនៅរក្សាទុក ហើយសាក local close ដោយមិន05', async () => {
    const replace = vi.mocked(replaceSignJob).getMockImplementation()!;
    vi.mocked(replaceSignJob).mockImplementation(async (previous, next, current) => next === null ? false : replace(previous, next, current));
    await ready(1); await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(closes()).toEqual([codes[0]]));
    expect(disk.rows.size).toBe(1); expect((await jobs())[0].job.photoVerified).toBe(true);
    vi.mocked(replaceSignJob).mockImplementation(replace);
    for (const row of disk.rows.values()) { row.due = 0; row.leaseUntil = 0; }
    await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(1);
});

it.each(['signed', 'sending'].flatMap(phase => [true, false].map(legacy => ({ phase, legacy }))))('Barcode វគ្គថ្មី៖ journal $phase ចាស់ legacy=$legacy មិនបិទវគ្គស្តារ ឬលុបរូបថ្មី', async ({ phase, legacy }) => {
    reservationFixtures = false;
    const sign = createRequire(import.meta.url)('../netlify/functions/_shared/zto-palm-sign.js');
    const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
    const oldRequest = crypto.randomUUID();
    const session = { token: 'synthetic-session', site: 'KH1', operator: 'synthetic-operator' };
    const keyLabel = 'synthetic-cycle';
    const journalKey = 'palm-sign-v1/' + digest(JSON.stringify([keyLabel, session.site, codes[0]]));
    const historical = { kind: 'sign-journal', owner: 'old-cycle-owner', requestId: oldRequest,
        fingerprint: digest(JSON.stringify([codes[0], oldRequest, 'អ្នកទទួលចាស់', photos[1]])), phase, photoAccepted: true, leaseUntil: 0,
        ...(legacy ? {} : { originalSHA256: digest(Buffer.from(photos[1], 'base64')), photoProtocol: 'original-sha256-v1' }) };
    const journal = new Map([[journalKey, { data: JSON.stringify(historical), etag: 'historical' }]]); let serial = 0;
    const deps = { keyLabel, lookupAccess: async () => ({ verified: true, site: session.site }), blobStore: () => ({ store: {
        getWithMetadata: async (id: string) => journal.get(id) || null,
        set: async (id: string, data: string, options: any) => {
            const old = journal.get(id);
            if (options.onlyIfNew && old || options.onlyIfMatch && old?.etag !== options.onlyIfMatch) return { modified: false };
            const etag = String(++serial); journal.set(id, { data, etag }); return { modified: true, etag };
        }
    } }) };
    const proof = { seal: JSON.stringify, open: JSON.parse, stamp: (value: string) => value, verdict: (value: any) => ({ ztoClosed: value.result[0].mail.isSign === 1 }) };
    let closed = false;
    const upstream: string[] = [];
    const request = async (path: string, body: any) => {
        upstream.push(path);
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: body.mailNos, isSign: closed ? 1 : 0 },
            tracks: [{ mailNo: body.mailNos, siteCode: session.site, action: closed ? '5' : '4', time: '2026-10-25 12:00:00' }] }] };
        throw new Error('unexpected upstream write or photo read');
    };
    network = async body => { const out = await sign.signPalm({ body: JSON.stringify(body) }, session, deps, request, proof); return reply(JSON.parse(out.body), out.statusCode); };
    dataState.scanHistory[0].barcodes[0].restoredAt = 1792890000000;
    await ready(1);
    expect(palmSignState.requestId).not.toBe(oldRequest);
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(1));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    const original = (await jobs())[0].job;
    expect(original).toMatchObject({ code: codes[0], phase: 'action', photo: photos[0] });
    expect(original.requestId).not.toBe(oldRequest);
    expect(original.parcelIdentity).toBe(barcodeSignIdentity(dataState.scanHistory[0], dataState.scanHistory[0].barcodes[0]));
    expect(closes()).toEqual([]);
    expect(JSON.parse(journal.get(journalKey)!.data)).toEqual(historical);
    closed = true;
    for (const row of disk.rows.values()) row.due = 0;
    await actOnQueuedSign((await jobs())[0].row.id, 'retry');
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(2));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
    expect((await jobs())[0].job).toMatchObject({ photo: original.photo, requestId: original.requestId, parcelIdentity: original.parcelIdentity });
    expect(upstream.every(path => path.endsWith('queryTrackInfo'))).toBe(true);
    expect(journal.size).toBe(1); expect(JSON.parse(journal.get(journalKey)!.data).requestId).toBe(oldRequest);
    expect(bodies('receipt')).toHaveLength(0);
});

it('ចម្លើយ proof ត្រឹមត្រូវរបស់ request ចាស់ មិនបិទ ឬលុបរូបនៃ request វគ្គថ្មី', async () => {
    dataState.scanHistory[0].barcodes[0].restoredAt = 1792890000000;
    await ready(1);
    const oldRequest = crypto.randomUUID();
    network = async body => receipt(body, { requestId: oldRequest, photoProof: { protocol: 'original-sha256-v1', verified: true,
        barcode: body.barcode, requestId: oldRequest, originalSHA256: body.originalSHA256 } });
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(() => expect(bodies('receipt')).toHaveLength(1));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(closes()).toEqual([]); expect(disk.rows.size).toBe(1);
    expect((await jobs())[0].job.photo).toBe(photos[0]);
    expect((await jobs())[0].job.requestId).not.toBe(oldRequest);
});

const resume = (body: any, patch = {}) => reply({ ...(body.refreshRequestId ? { refreshRequestId: body.refreshRequestId } : {}), code: 'ZTO_PALM_SIGN_RESUME_READY', stage: 'receipt', barcode: body.barcode, requestId: body.requestId,
    photoProtocol: body.photoProtocol, originalSHA256: body.originalSHA256, originalFingerprint: body.originalFingerprint,
    reservationProtocol: 'original-reservation-v1', reservationOwner: body.reservationOwner || 'reserved-owner', reservationToken: 'reserved-token', ...patch }, 409);

it('reservation server ចាស់គ្មាន capability មិនផ្ញើរូបឬ05', async () => {
    reservationFixtures = false; await ready(1); network = async body => receipt(body, { photoProof: undefined });
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0)); await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(bodies('receipt')).toHaveLength(0); expect((await jobs())[0].job.photo).toBe(photos[0]);
});

it('reservation crash checking មុនសំណើដំបូង បន្ត status បន្ទាប់មកផ្ញើតែម្ដង', async () => {
    reservationFixtures = false; const online = await queuedWithPolicy(true); const value = (await jobs())[0];
    expect(value.job.reservationProtocol).toBe('original-reservation-v1');
    expect(value.job.originalFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const row = await sealSignJob(value.row.owner, key, { ...value.job, phase: 'checking' }); disk.rows.set(row.id, row);
    network = async body => body.stage === 'receipt-status' ? resume(body) : receipt(body);
    online.mockReturnValue(true); await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt-status')).toHaveLength(1); expect(bodies('receipt')).toHaveLength(1);
    expect(bodies('receipt')[0]).toMatchObject({ reservationProtocol: 'original-reservation-v1', reservationOwner: 'reserved-owner', reservationToken: 'reserved-token' });
});

it('reservation token រក្សាទុកបរាជ័យ មិនផ្ញើរូបឬ05', async () => {
    reservationFixtures = false; const online = await queuedWithPolicy(true);
    const replace = vi.mocked(replaceSignJob).getMockImplementation()!;
    vi.mocked(replaceSignJob).mockImplementation(async (previous, next, current) => {
        if (next && (await openSignJob(next, key)).reservationToken) return false;
        return replace(previous, next, current);
    });
    network = async body => body.stage === 'receipt-status' ? resume(body) : receipt(body);
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(bodies('receipt')).toHaveLength(0); expect(disk.rows.size).toBe(1);
    vi.mocked(replaceSignJob).mockImplementation(replace);
});

it.each(['barcode', 'requestId', 'photoProtocol', 'originalSHA256', 'originalFingerprint', 'reservationProtocol', 'reservationOwner', 'reservationToken'])('reservation READY ខ្វះឬខុស %s មិនផ្ញើរូប', async field => {
    reservationFixtures = false; const online = await queuedWithPolicy(true);
    network = async body => resume(body, { [field]: field === 'reservationOwner' || field === 'reservationToken' ? '' : 'mismatch' });
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(bodies('receipt')).toHaveLength(0); expect((await jobs())[0].job.photo).toBe(photos[0]);
});

it.each(['queued', 'checking', 'confirmed'] as const)('reservation មិនដំឡើងការងារចាស់ %s ទៅ protocol ថ្មី', async phase => {
    reservationFixtures = false; const online = await queuedWithPolicy(true); const value = (await jobs())[0];
    const row = await sealSignJob(value.row.owner, key, { ...legacy(value.job), phase }); disk.rows.set(row.id, row);
    network = async body => resume(body);
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(bodies('receipt-status')[0].reservationProtocol).toBeUndefined(); expect(bodies('receipt')).toHaveLength(0);
    expect((await jobs())[0].job.reservationProtocol).toBeUndefined();
});

it('reservation រក្សា owner token ក្រោយ network ដាច់ ហើយមិនទទួល owner ថ្មី', async () => {
    reservationFixtures = false; const online = await queuedWithPolicy(true);
    network = async body => body.stage === 'receipt-status' ? resume(body) : Promise.reject(new Error('lost scan ack'));
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toContain('បណ្ដាញ'));
    expect((await jobs())[0].job).toMatchObject({ everReserved: true, reservationOwner: 'reserved-owner', reservationToken: 'reserved-token' });
    for (const row of disk.rows.values()) row.due = 0;
    network = async body => resume(body, { reservationOwner: 'other-owner' });
    await runPalmSignOutbox(); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(bodies('receipt-status')[1]).toMatchObject({ reservationOwner: 'reserved-owner', reservationToken: 'reserved-token' });
    expect(bodies('receipt')).toHaveLength(1); expect((await jobs())[0].job.reservationOwner).toBe('reserved-owner');
});

it('photo poll រង់ចាំតាមការងារ 15 30 60 120 300 វិនាទី ដោយមិនបង្កើនរបាំងចាស់', async () => {
    await ready(1); network = async body => receipt(body, { photoProof: undefined });
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.scanCompleted).toBe(true));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    for (const [index, delay] of [15000, 30000, 60000, 120000, 300000, 300000].entries()) {
        const value = (await jobs())[0]; expect(value.job.photoPollDelay).toBe(delay);
        expect(value.row.due - Date.now()).toBeGreaterThan(delay - 3000);
        const polls = bodies('receipt-status').length;
        await runPalmSignOutbox(); expect(bodies('receipt-status')).toHaveLength(polls);
        if (index < 5) {
            disk.rows.get(value.row.id).due = 0; await runPalmSignOutbox();
            await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(polls + 1));
            await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
        }
    }
    const value = (await jobs())[0]; disk.rows.get(value.row.id).due = Date.now() + 3600000;
    const polls = bodies('receipt-status').length; await runPalmSignOutbox();
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(polls + 1));
    expect(bodies('receipt')).toHaveLength(1); expect(disk.rows.size).toBe(1);
});

it('manual review ចងសំណើត្រឹមត្រូវ ទប់ poll រក្សារូប និងអនុញ្ញាតតែ retry អានស្ថានភាព', async () => {
    await ready(1);
    network = async body => reply({ code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, uncertain: true, stage: 'receipt',
        barcode: body.barcode, requestId: body.requestId, photoProtocol: body.photoProtocol, originalSHA256: body.originalSHA256,
        reservationProtocol: body.reservationProtocol, originalFingerprint: body.originalFingerprint, reason: 'photo_unverified' }, 409);
    await submitZtoPalmSign([codes[0]]);
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect((await jobs())[0].job.manualReviewReason).toBe('photo_unverified');
    expect((await jobs())[0].job.verificationRequired).not.toBe(true);
    const count = requests.length; await runPalmSignOutbox(); expect(requests).toHaveLength(count);
    network = async body => receipt(body, { photoProof: undefined });
    await actOnQueuedSign((await jobs())[0].row.id, 'retry');
    await vi.waitFor(async () => expect((await jobs())[0]?.job.photoPollDelay).toBe(15000));
    expect(bodies('receipt')).toHaveLength(1); expect((await jobs())[0].job.photo).toBe(photos[0]);
});

async function warningJob() {
    const online = await queuedWithPolicy(false); network = async body => warning(body);
    online.mockReturnValue(true); await runPalmSignOutbox();
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    requests = []; return (await jobs())[0];
}
const cancelled = (body: any, patch = {}) => reply({ ...body, stage: 'receipt-cancel', success: true, cancelled: true, ...patch });

it('cancel បិទ confirmation មិនរក្សា intent មិនហៅ API និងមិនលុបរូប', async () => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => false));
    await actOnQueuedSign(value.row.id, 'cancel');
    expect(confirm).toHaveBeenCalledOnce(); expect(requests).toHaveLength(0);
    expect((await jobs())[0].job.cancelRequested).not.toBe(true); expect(disk.rows.size).toBe(1);
});

it('cancel រក្សា intent មុន API ហើយលុបតែ cancelled ACK ត្រឹមត្រូវ', async () => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => true));
    network = async body => { expect((await jobs())[0].job.cancelRequested).toBe(true); return cancelled(body); };
    await actOnQueuedSign(value.row.id, 'cancel'); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ stage: 'receipt-cancel', reservationOwner: value.job.reservationOwner,
        reservationToken: value.job.reservationToken, originalFingerprint: value.job.originalFingerprint, confirmationToken: value.job.warningToken });
});

it('cancel intent CAS បរាជ័យ មិនហៅ API និងមិនលុបរូប', async () => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => true));
    const replace = vi.mocked(replaceSignJob).getMockImplementation()!;
    vi.mocked(replaceSignJob).mockImplementation(async (previous, next, current) => next && (await openSignJob(next, key)).cancelRequested ? false : replace(previous, next, current));
    await actOnQueuedSign(value.row.id, 'cancel').catch(() => {});
    expect(requests).toHaveLength(0); expect(disk.rows.size).toBe(1); vi.mocked(replaceSignJob).mockImplementation(replace);
});

it('cancel ACK បាត់ បើកឡើងវិញផ្ញើតែ cancellation ដែលអ្នកបានបញ្ជាក់', async () => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => true));
    network = async () => { throw new Error('cancel ack lost'); };
    await actOnQueuedSign(value.row.id, 'cancel');
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect((await jobs())[0].job.cancelRequested).toBe(true);
    network = async body => cancelled(body); for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(requests).toHaveLength(2); expect(requests.every(body => body.stage === 'receipt-cancel')).toBe(true);
    expect(closes()).toEqual([]);
});

it.each(['barcode', 'requestId', 'originalSHA256', 'originalFingerprint', 'reservationOwner', 'reservationToken', 'reservationProtocol', 'photoProtocol'])('cancel ACK ខុស %s មិនលុបរូប', async field => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => true));
    network = async body => cancelled(body, { [field]: 'other' });
    await actOnQueuedSign(value.row.id, 'cancel');
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(disk.rows.size).toBe(1); expect((await jobs())[0].job.cancelRequested).toBe(true);
});

it('cancel Server បដិសេធ រូបនៅ action មិនផ្ញើកម្ចាត់ឡើងវិញស្វ័យប្រវត្តិ', async () => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => true));
    network = async () => reply({ code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED' }, 409);
    await actOnQueuedSign(value.row.id, 'cancel');
    await vi.waitFor(async () => expect((await jobs())[0]?.job.cancelRequested).toBe(false));
    expect((await jobs())[0].job.phase).toBe('action'); const count = requests.length;
    await runPalmSignOutbox(); expect(requests).toHaveLength(count); expect(disk.rows.size).toBe(1);
});

it.each(['auth', 'key', 'restore'])('cancel ACK មកក្រោយ %s មិនលុបរូបម្ចាស់ដើម', async kind => {
    const value = await warningJob(); vi.stubGlobal('confirm', vi.fn(() => true)); const pending = gate<void>();
    network = async body => { await pending.promise; return cancelled(body); };
    await actOnQueuedSign(value.row.id, 'cancel'); await vi.waitFor(() => expect(requests).toHaveLength(1));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'key') securityState.lookupSecretKey = null;
    if (kind === 'restore') dataState.scanHistory[0].barcodes[0].restoredAt = Date.now();
    pending.resolve(); await new Promise(resolve => setTimeout(resolve, 20)); expect(disk.rows.size).toBe(1);
});

it('reservation headers រង់ចាំ ហើយកញ្ចប់ត្រូវដក មិនហៅ fetch និងរក្សារូប', async () => {
    await ready(1); const pending = gate<void>();
    const identity = vi.fn(async () => { await pending.promise; return { token: 'synthetic-id' }; });
    firebaseState.fb.getIdTokenResult = identity;
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(() => expect(identity).toHaveBeenCalled());
    dataState.scanHistory[0].barcodes = dataState.scanHistory[0].barcodes.slice(1);
    pending.resolve(); await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(requests).toHaveLength(0); expect((await jobs())[0].job.photo).toBe(photos[0]);
});

it('photo poll metadata មិនត្រូវ មិនអាចពង្រីករបាំងរង់ចាំការងារមិនទាន់ Sign', async () => {
    const online = await queuedWithPolicy(true); const value = (await jobs())[0];
    const row = await sealSignJob(value.row.owner, key, { ...value.job, photoPollStep: 5, photoPollDelay: 300000, scanCompleted: false });
    disk.rows.set(row.id, { ...row, due: Date.now() + 60000 });
    online.mockReturnValue(true); await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt')).toHaveLength(1);
});

it('cancel App → Server CAS tombstone ពិត មិនផ្ញើរូបឬ05 ហើយទើបលុប local original', async () => {
    reservationFixtures = false;
    const sign = createRequire(import.meta.url)('../netlify/functions/_shared/zto-palm-sign.js');
    const journal = new Map<string, { data: string; etag: string }>(); let revision = 0;
    const session = { token: 'session', site: 'KH1', operator: 'operator' };
    const proof = { seal: JSON.stringify, open: JSON.parse, stamp: (value: string) => value, verdict: () => ({ ztoClosed: false }) };
    const deps = { keyLabel: 'cancel-seam', lookupAccess: async () => ({ verified: true, site: session.site }), blobStore: () => ({ store: {
        getWithMetadata: async (id: string) => journal.get(id) || null,
        set: async (id: string, data: string, options: any) => { const old = journal.get(id);
            if (options.onlyIfNew && old || options.onlyIfMatch && old?.etag !== options.onlyIfMatch) return { modified: false };
            const etag = String(++revision); journal.set(id, { data, etag }); return { modified: true, etag };
        }
    } }) };
    const upstream: string[] = [];
    const request = async (path: string, body: any) => {
        upstream.push(path);
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: body.mailNos, isSign: 0 }, tracks: [{ mailNo: body.mailNos, siteCode: session.site, action: '4', time: '2026-10-25 12:00:00' }] }] };
        if (path.endsWith('queryPreOrderByBillCode')) return { status: true, result: { billCode: body.billCode } };
        if (path.endsWith('newBusinessCheck')) return { status: true, result: { message: 'ត្រូវបញ្ជាក់', whetherForce: false } };
        throw new Error('unexpected image or scan write');
    };
    network = async body => { const out = await sign.signPalm({ body: JSON.stringify(body) }, session, deps, request, proof); return reply(JSON.parse(out.body), out.statusCode); };
    await ready(1); const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox();
    const value = (await jobs())[0]; const row = await sealSignJob(value.row.owner, key, { ...value.job, autoConfirm: false }); disk.rows.set(row.id, row);
    online.mockReturnValue(true); await runPalmSignOutbox(); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(JSON.parse([...journal.values()][0].data).phase).toBe('reservation-v1:warning');
    vi.stubGlobal('confirm', vi.fn(() => true)); await actOnQueuedSign(row.id, 'cancel');
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(JSON.parse([...journal.values()][0].data).phase).toBe('reservation-v1:cancelled');
    expect(bodies('receipt-cancel')).toHaveLength(1); expect(upstream.some(path => /saveBillPic|saveScanInfo/.test(path))).toBe(false);
});

it('manual retry ជា read-only ទោះ Server ឆ្លើយ READY ក៏មិនផ្ញើរូបឬ05', async () => {
    await ready(1);
    network = async body => reply({ code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, uncertain: true, stage: 'receipt',
        barcode: body.barcode, requestId: body.requestId, photoProtocol: body.photoProtocol, originalSHA256: body.originalSHA256,
        reservationProtocol: body.reservationProtocol, originalFingerprint: body.originalFingerprint, reason: 'photo_unverified' }, 409);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    network = async body => body.stage === 'receipt-status' ? resume(body) : receipt(body);
    await actOnQueuedSign((await jobs())[0].row.id, 'retry');
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(2));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(bodies('receipt')).toHaveLength(1); expect((await jobs())[0].job).toMatchObject({ phase: 'action', readOnlyProbe: true, photo: photos[0] });
});

const refreshRequired = (body: any) => reply({ ...body, stage: 'receipt', code: 'ZTO_PALM_SIGN_WARNING_REFRESH_REQUIRED', warningRefreshRequired: true,
    message: 'ត្រូវផ្ទៀងសារឡើងវិញ', confirmationToken: body.confirmationToken }, 409);
const refreshedWarning = (body: any) => reply({ ...body, stage: 'receipt', code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', message: 'សារថ្មីត្រូវបញ្ជាក់',
    confirmationToken: 'changed-warning', reservationToken: 'fresh-reservation-token', warningRefreshed: true, warningChanged: true }, 409);

it('expired warning refresh ជាអានតែប៉ុណ្ណោះ រក្សា fresh token មុនបន្ត receipt', async () => {
    const value = await warningJob(); reservationFixtures = false;
    network = async body => {
        if (body.stage === 'receipt-status') return refreshRequired(body);
        if (body.stage === 'receipt-warning-refresh') { expect(body.photo).toBe(photos[0]); expect(body.signMan).toBe(value.job.signMan); return resume(body, { warningRefreshed: true, confirmationToken: 'fresh-warning', reservationToken: 'fresh-reservation-token' }); }
        expect((await jobs())[0].job.confirmationToken).toBe('fresh-warning'); expect(body.reservationToken).toBe('fresh-reservation-token'); return receipt(body);
    };
    await actOnQueuedSign(value.row.id, 'approve'); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt-warning-refresh')).toHaveLength(1); expect(bodies('receipt')).toHaveLength(1);
});

it('expired warning ផ្លាស់សារ មិនបន្តតាមការយល់ព្រមចាស់ ឬ autoConfirm', async () => {
    const value = await warningJob(); reservationFixtures = false;
    network = async body => body.stage === 'receipt-status' ? refreshRequired(body) : refreshedWarning(body);
    await actOnQueuedSign(value.row.id, 'approve');
    await vi.waitFor(async () => expect((await jobs())[0]?.job.warningToken).toBe('changed-warning'));
    expect((await jobs())[0].job).toMatchObject({ phase: 'action', confirmationToken: '', reservationToken: 'fresh-reservation-token' });
    expect(bodies('receipt')).toHaveLength(0); expect(bodies('receipt-warning-refresh')).toHaveLength(1);
});

it('blocked continuation ត្រូវការ eligibility ពី Server និងសកម្មភាព Continue ដាច់ដោយឡែក', async () => {
    await ready(1);
    network = async body => reply({ ...body, stage: 'receipt', code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason: 'blocked', continuationAllowed: true }, 409);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect((await jobs())[0].job.continuationAllowed).toBe(true); requests = [];
    network = async body => body.stage === 'receipt-prewrite-refresh' ? resume(body, { warningRefreshed: true, confirmationToken: '', reservationToken: 'fresh-reservation-token' }) : receipt(body);
    await actOnQueuedSign((await jobs())[0].row.id, 'continue'); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('receipt-prewrite-refresh')).toHaveLength(1); expect(bodies('receipt')).toHaveLength(1);
});

it('expired warning បាត់ចម្លើយ refresh មិនបញ្ជាក់តាម token ចាស់ និងមិនផ្ញើរូបពេញរៀងរាល់ poll', async () => {
    const value = await warningJob(); reservationFixtures = false;
    network = async body => { if (body.stage === 'receipt-status') return refreshRequired(body); throw new Error('lost refresh response'); };
    await actOnQueuedSign(value.row.id, 'approve');
    await vi.waitFor(() => expect(bodies('receipt-warning-refresh')).toHaveLength(1));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    for (const row of disk.rows.values()) row.due = 0; await runPalmSignOutbox();
    await vi.waitFor(() => expect(bodies('receipt-status')).toHaveLength(2));
    await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
    expect(bodies('receipt-warning-refresh')).toHaveLength(1); expect(bodies('receipt')).toHaveLength(0);
    expect((await jobs())[0].job.confirmationToken).toBe(value.job.warningToken);
});

it('expired warning dispatch proof ចាស់ ប្រើ status read មួយ ដោយមិនផ្ញើ04', async () => {
    const value = await warningJob(); reservationFixtures = false; let refreshed = false;
    network = async body => {
        if (body.stage === 'receipt-status') return refreshRequired(body);
        if (body.stage === 'status') return reply({ success: true, stage: 'status', barcode: body.barcode, dispatched: true, ztoClosed: false, dispatchProof: 'fresh-dispatch-proof' });
        if (body.stage === 'receipt-warning-refresh') {
            if (!refreshed) { refreshed = true; return reply({ code: 'ZTO_PALM_DISPATCH_REQUIRED', barcode: body.barcode, requestId: body.requestId }, 409); }
            expect(body.dispatchProof).toBe('fresh-dispatch-proof'); return resume(body, { warningRefreshed: true, confirmationToken: '' });
        }
        expect(body.dispatchProof).toBe('fresh-dispatch-proof'); return receipt(body);
    };
    await actOnQueuedSign(value.row.id, 'approve'); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(bodies('status')).toHaveLength(1); expect(bodies('receipt-warning-refresh')).toHaveLength(2); expect(bodies('dispatch')).toHaveLength(0);
});

it('expired warning សារថ្មីកើតឡើងក្រោយ refresh clear មិន autoConfirm ស្ទួន', async () => {
    const value = await warningJob(); reservationFixtures = false;
    network = async body => body.stage === 'receipt-status' ? refreshRequired(body)
        : body.stage === 'receipt-warning-refresh' ? resume(body, { warningRefreshed: true, confirmationToken: '' }) : warning(body, 'raced-warning');
    await actOnQueuedSign(value.row.id, 'approve'); await vi.waitFor(async () => expect((await jobs())[0]?.job.warningToken).toBe('raced-warning'));
    expect(bodies('receipt')).toHaveLength(1); expect((await jobs())[0].job.autoConfirm).toBe(false);
});

it.each(['flag', 'owner', 'fingerprint'])('blocked continuation eligibility ខុស %s មិនបើកផ្លូវ Continue', async kind => {
    await ready(1);
    network = async body => reply({ ...body, stage: 'receipt', code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason: 'blocked',
        continuationAllowed: kind !== 'flag', reservationOwner: kind === 'owner' ? 'other' : body.reservationOwner,
        originalFingerprint: kind === 'fingerprint' ? '0'.repeat(64) : body.originalFingerprint }, 409);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    const before = requests.length; await actOnQueuedSign((await jobs())[0].row.id, 'continue');
    expect(requests).toHaveLength(before); expect((await jobs())[0].job.continuationAllowed).not.toBe(true);
});

it('blocked continuation បដិសេធម្ដងទៀត ត្រូវចុច Continue ថ្មី មិនសាកជារង្វង់', async () => {
    await ready(1);
    network = async body => reply({ ...body, stage: 'receipt', code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason: 'blocked', continuationAllowed: true }, 409);
    await submitZtoPalmSign([codes[0]]); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action')); requests = [];
    await actOnQueuedSign((await jobs())[0].row.id, 'continue'); await vi.waitFor(async () => expect((await jobs())[0]?.job.continueRequested).toBe(false));
    expect(bodies('receipt-prewrite-refresh')).toHaveLength(1); await runPalmSignOutbox(); expect(requests).toHaveLength(1);
    expect((await jobs())[0].job.phase).toBe('action'); expect(bodies('receipt')).toHaveLength(0);
});

it.each([['expired-warning', 28], ['blocked', 28], ['blocked-lost', 28], ['expired-warning', 900000], ['blocked', 900000]] as const)('App → Server readonly refresh %s រូប %s bytes → fresh decision → exact proof ពិត', async (scenario, photoBytes) => {
    const originalBytes = Buffer.alloc(photoBytes, 17);
    const template = Buffer.from(photos[0], 'base64');
    template.copy(originalBytes, 0, 0, template.length - 2);
    originalBytes.set([255, 217], originalBytes.length - 2);
    const originalPhoto = originalBytes.toString('base64');
    const measuredBodies: Array<{ stage: string; bytes: number }> = [];
    reservationFixtures = false;
    const sign = createRequire(import.meta.url)('../netlify/functions/_shared/zto-palm-sign.js');
    const journal = new Map<string, { data: string; etag: string }>(); let revision = 0;
    let clock = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => clock);
    let condition = scenario.startsWith('blocked') ? 'blocked' : 'old'; let closed = false;
    const session = { token: 'refresh-session', site: 'KH1', operator: 'operator' };
    const proof = { seal: JSON.stringify, open: JSON.parse, stamp: (value: string) => value, verdict: () => ({ ztoClosed: closed }) };
    const deps = { keyLabel: 'refresh-seam', lookupAccess: async () => ({ verified: true, site: session.site }), blobStore: () => ({ store: {
        getWithMetadata: async (id: string) => journal.get(id) || null,
        set: async (id: string, data: string, options: any) => { const old = journal.get(id);
            if (options.onlyIfNew && old || options.onlyIfMatch && old?.etag !== options.onlyIfMatch) return { modified: false };
            const etag = String(++revision); journal.set(id, { data, etag }); return { modified: true, etag };
        }
    } }) };
    const upstream: string[] = [];
    const request = async (path: string, body: any) => {
        upstream.push(path);
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: body.mailNos, isSign: closed ? 1 : 0 }, tracks: [{ mailNo: body.mailNos, siteCode: session.site, action: closed ? '5' : '4', time: '2026-10-25 12:00:00' }] }] };
        if (path.endsWith('queryPreOrderByBillCode')) return { status: true, result: { billCode: body.billCode } };
        if (path.endsWith('newBusinessCheck')) return condition === 'blocked' ? { status: false } : { status: true, result: condition === 'clear' ? null : { message: condition === 'old' ? 'សារដើម' : 'សារថ្មី', whetherForce: false } };
        if (path.endsWith('saveScanInfo')) closed = true;
        if (path.endsWith('querySignPic')) return { status: true, result: [{ billCode: body.billCode, savePos: 'https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/' + body.billCode + '_1.jpg' }] };
        return { status: true, result: null };
    };
    let lost = false;
    network = async body => { const out = await sign.signPalm({ body: JSON.stringify(body) }, session, deps, request, proof);
        if (scenario === 'blocked-lost' && body.stage === 'receipt-prewrite-refresh' && !lost) { lost = true; throw new Error('lost refusal ACK'); }
        return reply(JSON.parse(out.body), out.statusCode); };
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        if (String(url).startsWith('https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/')) return new Response(originalBytes, { headers: { 'Content-Type': 'image/jpeg' } });
        const serialized = String(init?.body);
        const body = JSON.parse(serialized);
        expect(Buffer.byteLength(serialized)).toBeLessThanOrEqual(1250000);
        if (body.photo) {
            expect(body.photo).toBe(originalPhoto);
            expect(serialized.split(originalPhoto)).toHaveLength(2);
            measuredBodies.push({ stage: body.stage, bytes: Buffer.byteLength(serialized) });
        }
        requests.push(body); return network(body);
    }));
    await ready(1); palmSignState.photos[codes[0]] = originalPhoto; const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await submitZtoPalmSign([codes[0]]); await runPalmSignOutbox(); const value = (await jobs())[0];
    const row = await sealSignJob(value.row.owner, key, { ...value.job, autoConfirm: false }); disk.rows.set(row.id, row);
    online.mockReturnValue(true); await runPalmSignOutbox(); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    expect(upstream.some(path => /saveBillPic|saveScanInfo/.test(path))).toBe(false);
    if (scenario === 'expired-warning') {
        condition = 'changed'; clock += 3600001;
        await actOnQueuedSign(row.id, 'approve'); await vi.waitFor(async () => expect((await jobs())[0]?.job.message).toBe('សារថ្មី'));
        expect((await jobs())[0].job.phase).toBe('action'); expect(bodies('receipt-warning-refresh')).toHaveLength(2);
        expect(upstream.some(path => /saveBillPic|saveScanInfo/.test(path))).toBe(false);
        condition = 'clear'; await actOnQueuedSign(row.id, 'approve');
    } else {
        await actOnQueuedSign(row.id, 'retry'); await vi.waitFor(async () => expect((await jobs())[0]?.job.continuationAllowed).toBe(true));
        if (scenario === 'blocked-lost') {
            const oldToken = (await jobs())[0].job.reservationToken;
            await actOnQueuedSign(row.id, 'continue');
            await vi.waitFor(() => expect(bodies('receipt-prewrite-refresh')).toHaveLength(1));
            await vi.waitFor(async () => expect((await jobs())[0]?.row.leaseUntil).toBe(0));
            const nonce = (await jobs())[0].job.refreshRequestId; expect(nonce).toMatch(/^[a-f0-9-]{36}$/i);
            condition = 'clear'; for (const envelope of disk.rows.values()) envelope.due = 0;
            await runPalmSignOutbox(); await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
            expect((await jobs())[0].job.reservationToken).not.toBe(oldToken);
            expect((await jobs())[0].job.refreshRequestId).toBeUndefined(); expect((await jobs())[0].job.refreshStage).toBeUndefined();
            expect((await jobs())[0].job.continueRequested).toBe(false);
            expect(upstream.filter(path => path.endsWith('newBusinessCheck'))).toHaveLength(2);
            expect(upstream.some(path => /saveBillPic|saveScanInfo/.test(path))).toBe(false);
        }
        condition = 'clear'; await actOnQueuedSign(row.id, 'continue');
    }
    await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    expect(upstream.filter(path => path.endsWith('newBusinessCheck'))).toHaveLength(scenario === 'blocked-lost' ? 4 : 3);
    expect(upstream.filter(path => path.endsWith('saveBillPic'))).toHaveLength(1); expect(upstream.filter(path => path.endsWith('saveScanInfo'))).toHaveLength(1);
    expect(closes()).toEqual([codes[0]]);
    expect(measuredBodies.some(row => row.stage === 'receipt')).toBe(true);
    expect(measuredBodies.some(row => row.stage === (scenario === 'expired-warning' ? 'receipt-warning-refresh' : 'receipt-prewrite-refresh'))).toBe(true);
    if (photoBytes === 900000) expect(Math.max(...measuredBodies.map(row => row.bytes))).toBeLessThan(1220000);
});


it('pending warning refresh read-only retry រក្សា prior confirmation សម្រាប់ cached decision', async () => {
    const value = await warningJob(); reservationFixtures = false;
    let pending: any;
    network = async body => {
        if (body.stage === 'receipt-status') return refreshRequired(body);
        pending = body;
        return resume(body, { warningRefreshed: true, originalFingerprint: '0'.repeat(64), confirmationToken: 'fresh-warning' });
    };
    await actOnQueuedSign(value.row.id, 'approve');
    await vi.waitFor(async () => expect((await jobs())[0]?.job.refreshStage).toBe('receipt-warning-refresh'));
    await vi.waitFor(async () => expect((await jobs())[0]?.job.phase).toBe('action'));
    network = async body => {
        expect(body.stage).toBe('receipt-status');
        expect(body.confirmationToken).toBe(pending.confirmationToken);
        expect(body.refreshRequestId).toBe(pending.refreshRequestId);
        return resume(body, { warningRefreshed: true, confirmationToken: 'fresh-warning', reservationToken: 'cached-fresh-cap' });
    };
    await actOnQueuedSign(value.row.id, 'retry');
    await vi.waitFor(async () => expect((await jobs())[0]?.job.reservationToken).toBe('cached-fresh-cap'));
    expect((await jobs())[0].job).toMatchObject({ readOnlyProbe: true, phase: 'action', photo: photos[0] });
    expect(bodies('receipt')).toHaveLength(0);
});
