// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const file = require.resolve('../netlify/functions/_shared/zto-palm-sign.js');
const code = '77130500000012';
const photo = '/9j/AAECAwQF/9k=';
function container() { delete require.cache[file]; return require(file); }
function fixture() {
    const rows = new Map<string, { data: string; etag: string }>();
    let serial = 0;
    const store = {
        getWithMetadata: vi.fn(async (key: string) => rows.get(key) || null),
        set: vi.fn(async (key: string, data: string, options: any) => {
            const prior = rows.get(key);
            if (options.onlyIfNew && prior || options.onlyIfMatch && prior?.etag !== options.onlyIfMatch) return { modified: false };
            const etag = String(++serial); rows.set(key, { data, etag }); return { modified: true, etag };
        })
    };
    const session = { token: 'synthetic-palm', site: 'KH1', operator: 'test-operator' };
    const proof = { seal: JSON.stringify, open: JSON.parse, stamp: (s: string) => s, verdict: (r: any) => ({ ztoClosed: r.result[0].mail.isSign === 1 }) };
    const deps = { keyLabel: 'synthetic-key', lookupAccess: async () => ({ verified: true, site: session.site }), blobStore: () => ({ store }) };
    const requestId = randomUUID();
    const input = { barcode: code, requestId, stage: 'receipt', signMan: 'សុខា', photo, background: true,
        dispatchProof: proof.seal({ kind: 'dispatch', barcode: code, requestId, tokenHash: createHash('sha256').update(session.token).digest('hex'), expiresAt: Date.now() + 3600000 }) };
    let signed = false;
    const request = vi.fn(async (path: string) => {
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: code, isSign: signed ? 1 : 0 }, tracks: [{ mailNo: code, siteCode: session.site, time: '2026-10-19 12:00:00', action: signed ? '5' : '4' }] }] };
        if (path.endsWith('queryPreOrderByBillCode')) return { status: true, result: { billCode: code } };
        if (path.endsWith('saveScanInfo')) { signed = true; return { status: true, result: [] }; }
        return { status: true, result: null };
    });
    const call = (fn: any, patch = {}) => fn.signPalm({ body: JSON.stringify({ ...input, ...patch }) }, session, deps, request, proof);
    const count = (suffix: string) => request.mock.calls.filter(([path]) => path.endsWith(suffix)).length;
    return { rows, store, session, proof, deps, input, request, call, count, setSigned: (value: boolean) => { signed = value; } };
}
it('background ៖ container ពីរប្រជែងគ្នាមិន upload រូប/05 ស្ទួន', async () => {
    const f = fixture(); const a = container(); const b = container();
    const [x, y] = await Promise.all([f.call(a), f.call(b)]);
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
    expect([x, y].some((r) => JSON.parse(r.body).photoAccepted === true)).toBe(true);
});
it('background ៖ ចម្លើយ05បាត់ រួច reload container ផ្ទៀង track និង photo ACK ដោយមិនផ្ញើ05ម្ដងទៀត', async () => {
    const f = fixture();
    const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async (path) => { const out = await real(path); if (path.endsWith('saveScanInfo')) throw new Error('lost-ack'); return out; });
    const first = await f.call(container());
    expect(JSON.parse(first.body).uncertain).toBe(true);
    f.request.mockImplementation(real);
    const recovered = await f.call(container());
    expect(JSON.parse(recovered.body)).toMatchObject({ success: true, ztoClosed: true, photoAccepted: true });
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it('background ៖ 05 មិនទាន់បញ្ជាក់ និង track មិនបិទ មិន retry សរសេរដោយងងឹត', async () => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async (path) => { if (path.endsWith('saveScanInfo')) throw new Error('disconnected'); return real(path); });
    await f.call(container()); await f.call(container());
    expect(f.count('saveScanInfo')).toBe(1);
});
it('background ៖ គ្មាន store មិនផ្ញើការងារដែលមិនអាចស្តារបាន', async () => {
    const f = fixture(); f.deps.blobStore = () => null as any;
    const out = await f.call(container());
    expect(out.statusCode).toBe(503); expect(f.request).not.toHaveBeenCalled();
});
it('Lambda edge-only Blobs៖ journal ប្រើការអានដែល SDK គាំទ្រ និង CAS សម្រាប់ការសរសេរ', async () => {
    const f = fixture();
    f.store.getWithMetadata.mockImplementation(async (key: string, options?: any) => {
        if (options?.consistency === 'strong') throw new Error('Missing uncachedEdgeURL');
        return f.rows.get(key) || null;
    });
    expect(JSON.parse((await f.call(container())).body)).toMatchObject({ success: true, photoAccepted: true });
    expect(f.count('saveScanInfo')).toBe(1);
});
it('Blobs អានចាស់ថាគ្មាន journal៖ CAS បដិសេធ មិនផ្ញើរូប/05 ស្ទួន', async () => {
    const f = fixture(); await f.call(container());
    f.store.getWithMetadata.mockResolvedValue(null);
    expect((await f.call(container())).statusCode).toBe(503);
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it('background ៖ record photo ACK សរសេរបរាជ័យ មិនផ្ញើ05', async () => {
    const f = fixture(); const real = f.store.set.getMockImplementation()!;
    f.store.set.mockImplementation(async (key, data, options) => {
        if (JSON.parse(data).phase === 'photo') throw new Error('store unavailable');
        return real(key, data, options);
    });
    const out = await f.call(container());
    expect(out.statusCode).not.toBe(200); expect(f.count('saveScanInfo')).toBe(0);
});
it('background ៖ requestId របស់ឧបករណ៍ផ្សេង មិនចាប់05ស្ទួនលើកញ្ចប់ដដែល', async () => {
    const f = fixture(); await f.call(container());
    const requestId = randomUUID();
    await f.call(container(), { requestId, dispatchProof: f.proof.seal({ kind: 'dispatch', barcode: code, requestId, tokenHash: createHash('sha256').update(f.session.token).digest('hex'), expiresAt: Date.now() + 3600000 }) });
    expect(f.count('saveScanInfo')).toBe(1);
});

it('queue status តូច ៖ គ្មានរូបក្នុងសំណើ ហើយមិនសរសេរ Sign រហូតមានការងារពិត', async () => {
    const f = fixture();
    const before = await f.call(container(), { stage: 'receipt-status', photo: undefined });
    expect(JSON.parse(before.body)).toMatchObject({ retryable: true });
    expect(f.request).not.toHaveBeenCalled(); expect(f.store.set).not.toHaveBeenCalled();
    await f.call(container());
    const after = await f.call(container(), { stage: 'receipt-status', photo: undefined });
    expect(JSON.parse(after.body)).toMatchObject({ success: true, photoAccepted: true, ztoClosed: true });
    expect(f.count('saveScanInfo')).toBe(1);
});
it('receipt-check ៖ ពិនិត្យបញ្ហាមុន queue ហើយមិនផ្ញើរូប/05 ទាល់តែបញ្ជាក់', async () => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async (path) => path.endsWith('newBusinessCheck') ? { status: true, result: { message: 'កញ្ចប់មានបញ្ហា', whetherForce: false } } as any : real(path));
    const out = await f.call(container(), { stage: 'receipt-check', photoHash: createHash('sha256').update(f.input.photo).digest('hex') });
    const warning = JSON.parse(out.body);
    expect(warning).toMatchObject({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', stage: 'receipt', barcode: code });
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
    expect(f.store.set).not.toHaveBeenCalled();
    const approved = await f.call(container(), { stage: 'receipt-check', photoHash: createHash('sha256').update(f.input.photo).digest('hex'), confirmationToken: warning.confirmationToken });
    expect(JSON.parse(approved.body)).toMatchObject({ stage: 'receipt-check', ready: true });
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
    const sent = await f.call(container(), { confirmationToken: warning.confirmationToken });
    expect(JSON.parse(sent.body).photoAccepted).toBe(true);
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it.each(['changed', 'forbidden', 'expired', 'photo'])('background ៖ %s ក្រោយ foreground approval មិន upload រូប ឬ05', async (kind) => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    let message = 'កញ្ចប់មានបញ្ហា';
    let forbidden = false;
    f.request.mockImplementation(async (path) => path.endsWith('newBusinessCheck') ? { status: true, result: { message, whetherForce: forbidden } } as any : real(path));
    const first = JSON.parse((await f.call(container(), { stage: 'receipt-check', photoHash: createHash('sha256').update(f.input.photo).digest('hex') })).body);
    const approval = JSON.parse(first.confirmationToken);
    if (kind === 'changed') message = 'សារបញ្ហាថ្មី';
    if (kind === 'forbidden') forbidden = true;
    if (kind === 'expired') approval.expiresAt = Date.now() - 1;
    const out = await f.call(container(), { confirmationToken: JSON.stringify(approval), ...(kind === 'photo' ? { photo: '/9j/AAECAwQG/9k=' } : {}) });
    expect(out.statusCode).toBe(409);
    expect(JSON.parse(out.body).success).not.toBe(true);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});

it('ការពារ៖ 05 បដិសេធតាមអត្តសញ្ញាណ រក្សា terminal មិន replay ឬបម្លែងជា uncertain', async () => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async (path, ...args: any[]) => path.endsWith('saveScanInfo')
        ? { status: true, result: [{ barScannerId: args[0][0].barScannerId, exceptionMessage: 'synthetic rejection' }] } as any : real(path));
    const first = JSON.parse((await f.call(container())).body);
    expect(first).toMatchObject({ code: 'ZTO_PALM_SIGN_REPORTED_REJECTED', verificationRequired: true, requestId: f.input.requestId });
    expect(first.uncertain).not.toBe(true); expect(first.success).not.toBe(true);
    expect(JSON.parse([...f.rows.values()][0].data)).toMatchObject({ phase: 'rejected', photoAccepted: true });
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000);
    try {
        for (const patch of [{}, { stage: 'receipt-status', photo: undefined }, { requestId: randomUUID() }]) {
            const next = JSON.parse((await f.call(container(), patch)).body);
            expect(next.code).toBe('ZTO_PALM_SIGN_REPORTED_REJECTED');
            expect(next.retryable).not.toBe(true); expect(next.success).not.toBe(true);
        }
        expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
    } finally { now.mockRestore(); }
});

it('ការពារ៖ foreground មាន journal និងភស្តុតាង request រូប ដូច background', async () => {
    const f = fixture();
    const out = JSON.parse((await f.call(container(), { background: false })).body);
    expect(out).toMatchObject({ success: true, requestId: f.input.requestId, photoAccepted: true });
    expect(JSON.parse([...f.rows.values()][0].data).phase).toBe('signed');
    const status = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body);
    expect(status).toMatchObject({ success: true, requestId: f.input.requestId, photoAccepted: true });
    expect(f.count('saveScanInfo')).toBe(1);
});

it.each(['refused', 'ack-lost'])('ការពារ៖ journal rejected %s មិនបម្លែង sending ទៅ replay', async (kind) => {
    const f = fixture(); const upstream = f.request.getMockImplementation()!; const save = f.store.set.getMockImplementation()!;
    f.request.mockImplementation(async (path, ...args: any[]) => path.endsWith('saveScanInfo')
        ? { status: true, result: [{ barScannerId: args[0][0].barScannerId }] } as any : upstream(path));
    f.store.set.mockImplementation(async (key, data, options) => {
        if (JSON.parse(data).phase !== 'rejected') return save(key, data, options);
        if (kind === 'ack-lost') await save(key, data, options);
        throw new Error('synthetic journal rejection');
    });
    expect(JSON.parse((await f.call(container())).body).uncertain).toBe(true);
    const next = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body);
    if (kind === 'ack-lost') expect(next).toMatchObject({ code: 'ZTO_PALM_SIGN_REPORTED_REJECTED', verificationRequired: true });
    else expect(next.uncertain).toBe(true);
    expect(next.retryable).not.toBe(true); expect(next.success).not.toBe(true);
    expect(f.count('saveScanInfo')).toBe(1); expect(f.count('saveBillPic')).toBe(1);
});

it('ការពារ៖ foreground container ថ្មីផ្ទៀង ACK បាត់ដោយ journal មិនផ្ញើរូប/05 ឡើងវិញ', async () => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async (path) => { const out = await real(path); if (path.endsWith('saveScanInfo')) throw new Error('lost'); return out; });
    expect(JSON.parse((await f.call(container(), { background: false })).body).uncertain).toBe(true);
    f.request.mockImplementation(real);
    expect(JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body))
        .toMatchObject({ success: true, requestId: f.input.requestId, photoAccepted: true });
    expect(f.count('saveScanInfo')).toBe(1); expect(f.count('saveBillPic')).toBe(1);
});

it.each([true, false])('ការពារ៖ background %s គ្មាន store មិនសរសេរ ហើយ photo/request ខុសមិនទទួលភស្តុតាងចាស់', async (background) => {
    const f = fixture(); const blobStore = f.deps.blobStore;
    f.deps.blobStore = () => null as any;
    expect((await f.call(container(), { background })).statusCode).toBe(503);
    expect(f.request).not.toHaveBeenCalled();
    f.deps.blobStore = blobStore;
    expect((await f.call(container(), { background })).statusCode).toBe(200);
    expect(JSON.parse((await f.call(container(), { background, photo: '/9j/AAECAwQG/9k=' })).body).code).toBe('ZTO_PALM_SIGN_INVALID');
    const other = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined, requestId: randomUUID() })).body);
    expect(other).toMatchObject({ code: 'ZTO_PALM_SIGN_OTHER_REQUEST', photoAccepted: false });
    expect(other.success).not.toBe(true);
    expect(f.count('saveScanInfo')).toBe(1); expect(f.count('saveBillPic')).toBe(1);
});

it.each(['throw', 'status-false', 'wrong-id', 'bad-shape'])('ការពារ៖ 05 %s នៅតែ sending មិនបង្កើត terminal rejection ឬ replay', async (kind) => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => {
        if (!path.endsWith('saveScanInfo')) return real(path);
        if (kind === 'throw') throw new Error('lost');
        return { status: kind !== 'status-false', result: kind === 'wrong-id' ? [{ barScannerId: -1 }] : kind === 'bad-shape' ? {} : null } as any;
    });
    const first = JSON.parse((await f.call(container())).body);
    expect(first.success).not.toBe(true); expect(first.code).not.toBe('ZTO_PALM_SIGN_REPORTED_REJECTED');
    expect(JSON.parse([...f.rows.values()][0].data).phase).toBe('sending');
    const next = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body);
    expect(next.uncertain).toBe(true); expect(next.retryable).not.toBe(true);
    expect(f.count('saveScanInfo')).toBe(1);
});
