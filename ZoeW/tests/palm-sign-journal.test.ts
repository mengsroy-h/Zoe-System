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
