// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const file = require.resolve('../netlify/functions/_shared/zto-palm-sign.js');
const code = '77130500000012';
const photo = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]).toString('base64');
const originalSHA256 = createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex');
const photoProtocol = 'original-sha256-v1';
function container() { delete require.cache[file]; return require(file); }
function fixture(enrolled = true) {
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
    const input: any = { barcode: code, requestId, stage: 'receipt', photoProtocol, originalSHA256, signMan: 'សុខា', photo, background: true,
        dispatchProof: proof.seal({ kind: 'dispatch', barcode: code, requestId, tokenHash: createHash('sha256').update(session.token).digest('hex'), expiresAt: Date.now() + 3600000 }) };
    if (enrolled) Object.assign(input, { reservationProtocol: 'original-reservation-v1', originalFingerprint: createHash('sha256').update(JSON.stringify([code, requestId, input.signMan, input.photo])).digest('hex') });
    let signed = false;
    const request = vi.fn(async (path: string) => {
        if (path.endsWith('queryTrackInfo')) return { status: true, result: [{ mail: { mailNo: code, isSign: signed ? 1 : 0 }, tracks: [{ mailNo: code, siteCode: session.site, time: '2026-10-19 12:00:00', action: signed ? '5' : '4' }] }] };
        if (path.endsWith('queryPreOrderByBillCode')) return { status: true, result: { billCode: code } };
        if (path.endsWith('saveScanInfo')) { signed = true; return { status: true, result: [] }; }
        return { status: true, result: null };
    });
    const call = async (fn: any, patch: any = {}) => {
        const body = { ...input, ...patch };
        if (body.stage === 'receipt' && body.reservationProtocol && !body.reservationToken) {
            const reservation = await fn.signPalm({ body: JSON.stringify({ ...body, stage: 'receipt-status', photo: undefined, signMan: undefined }) }, session, deps, request, proof);
            const ready = JSON.parse(reservation.body);
            if (ready.code !== 'ZTO_PALM_SIGN_RESUME_READY') return reservation;
            Object.assign(input, { reservationOwner: ready.reservationOwner, reservationToken: ready.reservationToken });
            Object.assign(body, { reservationOwner: ready.reservationOwner, reservationToken: ready.reservationToken });
        }
        return fn.signPalm({ body: JSON.stringify(body) }, session, deps, request, proof);
    };
    const seedLegacy = (phase = 'signed') => {
        const hash = (value: string) => createHash('sha256').update(value).digest('hex');
        rows.set('palm-sign-v1/' + hash(JSON.stringify([deps.keyLabel, session.site.toUpperCase(), code])), { etag: 'seed', data: JSON.stringify({ kind: 'sign-journal', owner: 'legacy-owner', requestId, fingerprint: hash(JSON.stringify([code, requestId, input.signMan, input.photo])), phase, leaseUntil: 0, photoAccepted: ['photo', 'sending', 'signed', 'rejected'].includes(phase), originalSHA256, photoProtocol }) });
    };
    const count = (suffix: string) => request.mock.calls.filter(([path]) => path.endsWith(suffix)).length;
    return { seedLegacy, rows, store, session, proof, deps, input, request, call, count, setSigned: (value: boolean) => { signed = value; } };
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
it('Lambda គ្មាន strong read៖ journal ផ្អាកដោយសុវត្ថិភាព មិនបន្ទាបទៅ eventual ឬផ្ញើរូប05', async () => {
    const f = fixture();
    f.store.getWithMetadata.mockImplementation(async (key: string, options?: any) => {
        if (options?.consistency === 'strong') throw new Error('Missing uncachedEdgeURL');
        return f.rows.get(key) || null;
    });
    const out = await f.call(container());
    expect(out.statusCode).toBe(503);
    expect(JSON.parse(out.body).code).toBe('ZTO_PALM_SIGN_STORE_UNAVAILABLE');
    expect(f.store.getWithMetadata).toHaveBeenCalledOnce();
    expect(f.store.getWithMetadata).toHaveBeenCalledWith(expect.stringContaining('palm-sign-v1/'), { type: 'text', consistency: 'strong' });
    expect(f.store.set).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
});
it('Blobs អានចាស់ថាគ្មាន journal៖ CAS បដិសេធ មិនផ្ញើរូប/05 ស្ទួន', async () => {
    const f = fixture(); await f.call(container());
    f.store.getWithMetadata.mockResolvedValue(null);
    expect(JSON.parse((await f.call(container())).body)).toMatchObject({ manualReview: true, reason: 'missing_journal' });
    expect((await f.call(container(), { stage: 'receipt-status', photo: undefined, reservationOwner: undefined, reservationToken: undefined })).statusCode).toBe(503);
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it('background ៖ record photo ACK សរសេរបរាជ័យ មិនផ្ញើ05', async () => {
    const f = fixture(); const real = f.store.set.getMockImplementation()!;
    f.store.set.mockImplementation(async (key, data, options) => {
        if (JSON.parse(data).phase === 'reservation-v1:photo') throw new Error('store unavailable');
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
    const before = await f.call(container(), { stage: 'receipt-status', photo: undefined, reservationProtocol: undefined });
    expect(JSON.parse(before.body)).toMatchObject({ code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason: 'missing_journal', barcode: code, requestId: f.input.requestId });
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
    expect(JSON.parse([...f.rows.values()][0].data)).toMatchObject({ phase: 'reservation-v1:rejected', photoAccepted: true });
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000);
    try {
        for (const patch of [{}, { stage: 'receipt-status', photo: undefined }, { requestId: randomUUID() }]) {
            const next = JSON.parse((await f.call(container(), patch)).body);
            expect(next.code).toBe('requestId' in patch ? 'ZTO_PALM_SIGN_INVALID' : 'ZTO_PALM_SIGN_REPORTED_REJECTED');
            expect(next.retryable).not.toBe(true); expect(next.success).not.toBe(true);
        }
        expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
    } finally { now.mockRestore(); }
});

it('ការពារ៖ foreground មាន journal និងភស្តុតាង request រូប ដូច background', async () => {
    const f = fixture();
    const out = JSON.parse((await f.call(container(), { background: false })).body);
    expect(out).toMatchObject({ success: true, requestId: f.input.requestId, photoAccepted: true });
    expect(JSON.parse([...f.rows.values()][0].data).phase).toBe('reservation-v1:signed');
    const status = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body);
    expect(status).toMatchObject({ success: true, requestId: f.input.requestId, photoAccepted: true });
    expect(f.count('saveScanInfo')).toBe(1);
});

it.each(['refused', 'ack-lost'])('ការពារ៖ journal rejected %s មិនបម្លែង sending ទៅ replay', async (kind) => {
    const f = fixture(); const upstream = f.request.getMockImplementation()!; const save = f.store.set.getMockImplementation()!;
    f.request.mockImplementation(async (path, ...args: any[]) => path.endsWith('saveScanInfo')
        ? { status: true, result: [{ barScannerId: args[0][0].barScannerId }] } as any : upstream(path));
    f.store.set.mockImplementation(async (key, data, options) => {
        if (JSON.parse(data).phase !== 'reservation-v1:rejected') return save(key, data, options);
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
    expect(other).toMatchObject({ code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason: 'different_request' });
    expect(other.photoAccepted).not.toBe(true); expect(other.photoProof).toBeUndefined();
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
    expect(JSON.parse([...f.rows.values()][0].data).phase).toBe('reservation-v1:sending');
    const next = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body);
    expect(next.uncertain).toBe(true); expect(next.retryable).not.toBe(true);
    expect(f.count('saveScanInfo')).toBe(1);
});


it.each(['empty', 'wrong', 'exact'])('ការពាររូប៖ ACK មិនមែនភស្តុតាង readback %s', async kind => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('querySignPic') ? {status:true,result:kind === 'empty' ? [] : [{billCode:code, savePos:`https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/${code}_123.jpg`}]} as any : real(path));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(kind === 'wrong' ? Buffer.from(photo,'base64').map((v,i) => i === 25 ? 2 : v) : Buffer.from(photo,'base64'), {headers:{'content-type':'image/jpeg'}})));
    try {
        const out = JSON.parse((await f.call(container())).body);
        expect(out).toMatchObject({scanCompleted:true, ztoClosed:true, requestId:f.input.requestId});
        if (kind === 'exact') expect(out.photoProof).toEqual({protocol:photoProtocol, barcode:code, requestId:f.input.requestId, originalSHA256, verified:true});
        else expect(out.photoProof).toBeUndefined();
        expect(JSON.stringify(out)).not.toMatch(/https|savePos/);
    } finally { vi.unstubAllGlobals(); }
});
it('ពិធីការចាស់មិនសរសេរ receipt ឬទទួលចម្លើយលុបរូប', async () => {
 const f=fixture(); const out=JSON.parse((await f.call(container(), {photoProtocol:undefined})).body);
 expect(out.code).toBe('ZTO_PALM_SIGN_PROTOCOL_REQUIRED'); expect(f.request).not.toHaveBeenCalled(); expect(f.rows.size).toBe(0);
});
it.each(['claimed','photo','sending','signed','retry','rejected'])('journal ចាស់ %s មិនបាត់ fence ហើយ bind តាម fingerprint ដើម', async phase => {
 const f=fixture(false); f.seedLegacy(); const [key,row]=[...f.rows][0]; const saved=JSON.parse(row.data);
 delete saved.originalSHA256; delete saved.photoProtocol; saved.phase=phase; saved.leaseUntil=0; saved.photoAccepted=['photo','sending','signed','rejected'].includes(phase); f.rows.set(key,{...row,data:JSON.stringify(saved)});
 const status=JSON.parse((await f.call(container(),{stage:'receipt-status',photo:undefined})).body);
 expect(status.code).toBe('ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED');
 const wrong=JSON.parse((await f.call(container(),{stage:'receipt-status',signMan:'ខុស'})).body);
 expect(wrong.code).toBe('ZTO_PALM_SIGN_INVALID'); expect(JSON.parse(f.rows.get(key)!.data).originalSHA256).toBeUndefined();
 await f.call(container(),{stage:'receipt-status'});
 expect(JSON.parse(f.rows.get(key)!.data).originalSHA256).toBe(originalSHA256);
 expect(f.count('saveScanInfo')).toBe(0); expect(f.count('saveBillPic')).toBe(0);
});
it('bind CAS បរាជ័យមិនអះអាង completion', async () => {
 const f=fixture(false); f.seedLegacy(); const [key,row]=[...f.rows][0];const saved=JSON.parse(row.data);delete saved.originalSHA256; f.rows.set(key,{...row,data:JSON.stringify(saved)});
 f.store.set.mockResolvedValue({modified:false} as any);
 const out=await f.call(container(),{stage:'receipt-status'});expect(out.statusCode).toBe(503);expect(JSON.parse(out.body).photoProof).toBeUndefined();
});

it.each(['expired-sending','signed-other-request','signed-CAS'])('របាំង05៖ %s មិន replay និងមិនអះអាង proof ដែលមិនបានរក្សា', async kind => {
 const f=fixture(); const real=f.request.getMockImplementation()!;
 if(kind==='expired-sending') f.request.mockImplementation(async path => {if(path.endsWith('saveScanInfo')) throw Error('lost');return real(path);});
 if(kind==='signed-CAS') {const set=f.store.set.getMockImplementation()!;f.store.set.mockImplementation(async (key,data,options) => JSON.parse(data).phase==='reservation-v1:signed'?{modified:false} as any:set(key,data,options));}
 const first=JSON.parse((await f.call(container())).body);
 if(kind==='signed-CAS') expect(first.photoProof).toBeUndefined();
 f.setSigned(false); const now=vi.spyOn(Date,'now').mockReturnValue(Date.now()+86400000);
 try {const out=JSON.parse((await f.call(container(),{stage:'receipt-status',photo:undefined,...(kind==='signed-other-request'?{requestId:randomUUID()}: {})})).body); expect(out.retryable).not.toBe(true);expect(out.photoProof).toBeUndefined();expect(f.count('saveScanInfo')).toBe(1);}finally{now.mockRestore();}
});
it.each(['missing-protocol','wrong-hash'])('សំណើ status %s មិនទទួល tuple លុបរូប',async kind=>{
 const f=fixture();await f.call(container());const out=JSON.parse((await f.call(container(),{stage:'receipt-status',photo:undefined,...(kind==='missing-protocol'?{photoProtocol:undefined}:{originalSHA256:'0'.repeat(64)})})).body);
 expect(out.success).not.toBe(true);expect(out.photoProof).toBeUndefined();expect(f.count('saveScanInfo')).toBe(1);
});
it.each(['web-envelope','foreign-row','auth'])('Palm readback %s មិនត្រូវបានយល់ថារូបដើម',async kind=>{
 const f=fixture();const real=f.request.getMockImplementation()!;f.request.mockImplementation(async path=>path.endsWith('querySignPic')?(kind==='web-envelope'?{success:true,data:[{picType:1}]}:kind==='auth'?{status:true,authRejected:true,result:[]}:{status:true,result:[{billCode:'OTHER123',savePos:'https://invalid.test'}]}) as any:real(path));
 const out=JSON.parse((await f.call(container())).body);expect(out.scanCompleted).toBe(true);expect(out.photoProof).toBeUndefined();expect(f.count('saveScanInfo')).toBe(1);
});
it.each([4, 5, 6, 7, '1', null, {}, 1])('Palm picType %j៖ metadata ផ្ទុយពីរូបទទួលមិនអាចផ្ដល់ proof', async picType => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('querySignPic') ? { status: true, result: [{ billCode: code, picType,
        savePos: `https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/${code}_123.jpg` }] } as any : real(path));
    const download = vi.fn(async () => new Response(Buffer.from(photo, 'base64'), { headers: { 'content-type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', download);
    try {
        const out = JSON.parse((await f.call(container())).body);
        expect(out.scanCompleted).toBe(true);
        if (picType === 1) { expect(out.photoProof?.verified).toBe(true); expect(download).toHaveBeenCalledOnce(); }
        else { expect(out.photoProof).toBeUndefined(); expect(download).not.toHaveBeenCalled(); }
    } finally { vi.unstubAllGlobals(); }
});
it.each(['claimed', 'photo', 'sending', 'signed', 'retry', 'rejected'])('journal v1 ដែលមានមុន rollout %s៖ មិនបង្កើត namespace ថ្មីរំលងរបាំង', async phase => {
    const f = fixture(false);
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    const key = 'palm-sign-v1/' + hash(JSON.stringify([f.deps.keyLabel, f.session.site.toUpperCase(), code.toUpperCase()]));
    const original = { kind: 'sign-journal', owner: 'historical-owner', requestId: f.input.requestId,
        fingerprint: hash(JSON.stringify([code, f.input.requestId, f.input.signMan, f.input.photo])), phase, leaseUntil: 0,
        photoAccepted: ['photo', 'sending', 'signed', 'rejected'].includes(phase) };
    f.rows.set(key, { data: JSON.stringify(original), etag: 'historical-etag' });
    const read = JSON.parse((await f.call(container(), { stage: 'receipt-status', photo: undefined })).body);
    expect(read.code).toBe('ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED');
    const result = JSON.parse((await f.call(container(), { stage: 'receipt-status' })).body);
    expect(result.retryable).not.toBe(true);
    expect(f.rows.size).toBe(1);
    expect(JSON.parse(f.rows.get(key)!.data)).toMatchObject({ owner: original.owner, fingerprint: original.fingerprint, originalSHA256 });
    expect(f.count('saveScanInfo')).toBe(0); expect(f.count('saveBillPic')).toBe(0);
});

it.each(['claimed','photo','retry'])('legacy status %s៖ activeleaseរង់ចាំ បន្ទាប់expiry manual មិនបើក replay',async phase=>{
 const f=fixture(false);f.seedLegacy();const [key,row]=[...f.rows][0];const saved={...JSON.parse(row.data),phase,leaseUntil:Date.now()+90000,photoAccepted:phase==='photo'};f.rows.set(key,{...row,data:JSON.stringify(saved)});
 const first=JSON.parse((await f.call(container(),{stage:'receipt-status',photo:undefined})).body);expect(first.uncertain).toBe(true);expect(first.manualReview).not.toBe(true);const now=vi.spyOn(Date,'now').mockReturnValue(Date.now()+120000);
 try{const out=JSON.parse((await f.call(container(),{stage:'receipt-status',photo:undefined})).body);expect(out).toMatchObject({code:'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED',manualReview:true,reason:'legacy_journal',stage:'receipt',barcode:code,requestId:f.input.requestId,photoProtocol,originalSHA256});expect(out.retryable).not.toBe(true);expect(JSON.parse(f.rows.get(key)!.data)).toEqual(saved);expect(f.count('saveBillPic')).toBe(0);expect(f.count('saveScanInfo')).toBe(0);}finally{now.mockRestore();}
});

it.each([900000, 900001])('parser ពិត៖ legacy fulloriginal %s bytes bind hash តាមព្រំដែន', async size => {
    const f = fixture(false); f.seedLegacy();
    const bytes = Buffer.alloc(size);
    Buffer.from(photo, 'base64').subarray(0, 25).copy(bytes);
    bytes[size - 2] = 255; bytes[size - 1] = 217;
    f.input.photo = bytes.toString('base64');
    f.input.originalSHA256 = createHash('sha256').update(bytes).digest('hex');
    const [key, row] = [...f.rows][0]; const saved = JSON.parse(row.data);
    saved.fingerprint = createHash('sha256').update(JSON.stringify([code, f.input.requestId, f.input.signMan, f.input.photo])).digest('hex');
    delete saved.originalSHA256; delete saved.photoProtocol;
    f.rows.set(key, { ...row, data: JSON.stringify(saved) });
    f.request.mockClear(); f.store.set.mockClear();
    const payload = { ...f.input, stage: 'receipt-status' };
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(1250000);
    expect(Object.values(payload).filter(value => value === f.input.photo)).toHaveLength(1);
    const result = await f.call(container(), { stage: 'receipt-status' });
    if (size === 900000) {
        expect(JSON.parse(result.body).scanCompleted).toBe(true);
        expect(JSON.parse(f.rows.get(key)!.data).originalSHA256).toBe(f.input.originalSHA256);
        expect(f.store.set).toHaveBeenCalledTimes(1);
    } else {
        expect(result.statusCode).toBe(400); expect(f.request).not.toHaveBeenCalled(); expect(f.store.set).not.toHaveBeenCalled();
        expect(JSON.parse(f.rows.get(key)!.data).originalSHA256).toBeUndefined();
    }
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it.each([true, false])('receipt គ្មាន reservation protocol មិនអាចបង្កើត write ទោះ background %s', async background => {
    const f = fixture(false);
    const result = await f.call(container(), { background });
    expect(JSON.parse(result.body).code).toBe('ZTO_PALM_SIGN_PROTOCOL_REQUIRED');
    expect(f.request).not.toHaveBeenCalled(); expect(f.store.set).not.toHaveBeenCalled();
});
it.each(['absent', 'claimed', 'photo', 'retry', 'sending', 'signed', 'rejected'])('journal direct caller %s គ្មាន reservation មិនអាចឆ្លងកាត់ fallback write', async phase => {
    const f = fixture(false); const run = vi.fn();
    if (phase !== 'absent') f.seedLegacy(phase);
    const before = [...f.rows.entries()];
    const journal = require('../netlify/functions/_shared/zto-palm-sign-journal.js');
    const result = await journal.withSignJournal(f.input, f.session, f.deps, f.proof, run, vi.fn(), vi.fn());
    expect(JSON.parse(result.body).code).toBe('ZTO_PALM_SIGN_PROTOCOL_REQUIRED');
    expect(run).not.toHaveBeenCalled(); expect(f.store.set).not.toHaveBeenCalled(); expect([...f.rows.entries()]).toEqual(before);
});
