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
    const input = { barcode: code, requestId, stage: 'receipt', photoProtocol, originalSHA256, signMan: 'សុខា', photo, background: true,
        dispatchProof: proof.seal({ kind: 'dispatch', barcode: code, requestId, tokenHash: createHash('sha256').update(session.token).digest('hex'), expiresAt: Date.now() + 3600000 }) };
    Object.assign(input, { reservationProtocol: 'original-reservation-v1', refreshRequestId: randomUUID(), originalFingerprint: createHash('sha256').update(JSON.stringify([code, requestId, input.signMan, photo])).digest('hex') });
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
const nonTracking = (f: ReturnType<typeof fixture>) => f.request.mock.calls.filter(([path]) => !path.endsWith('queryTrackInfo'));
const state = (f: ReturnType<typeof fixture>) => JSON.parse([...f.rows.values()][0].data);
const poll = (f: ReturnType<typeof fixture>, patch = {}) => f.call(container(), { stage: 'receipt-status', photo: undefined, signMan: undefined, ...patch });
async function reserve(f: ReturnType<typeof fixture>) {
    const out = await poll(f); expect(out.statusCode).toBe(409);
    const body = JSON.parse(out.body); expect(body.code).toBe('ZTO_PALM_SIGN_RESUME_READY');
    expect(body).toMatchObject({ stage: 'receipt', barcode: code, requestId: f.input.requestId, photoProtocol, originalSHA256, reservationProtocol: 'original-reservation-v1', originalFingerprint: (f.input as any).originalFingerprint });
    expect(body.reservationToken).toEqual(expect.any(String)); expect(body.reservationOwner).toEqual(expect.any(String));
    return { reservationToken: body.reservationToken, reservationOwner: body.reservationOwner };
}
it('ការរក្សាទុកថ្មី៖ crash មុនសំណើដំបូងត្រូវ reserve មុនរូបនិង05', async () => {
    const f=fixture(); const noToken=await f.call(container()); expect(JSON.parse(noToken.body).success).not.toBe(true);expect(nonTracking(f)).toHaveLength(0);
    const bound=await reserve(f);expect(state(f).phase).toBe('reservation-v1:reserved');expect(nonTracking(f)).toHaveLength(0);
    const out=JSON.parse((await f.call(container(),bound)).body);expect(out.scanCompleted).toBe(true);expect(state(f).phase).toBe('reservation-v1:signed');expect(f.count('saveScanInfo')).toBe(1);
});
it('ចម្លើយ reserve បាត់៖ owner ដើម និងគ្មានសរសេរ ZTO ពេល poll ថ្មី', async () => {
    const f=fixture(); const real=f.store.set.getMockImplementation()!;let lost=true;
    f.store.set.mockImplementation(async(key,data,options)=>{const out=await real(key,data,options);if(lost){lost=false;throw Error('lost');}return out;});
    await poll(f);const owner=state(f).owner;const bound=await reserve(f);expect(bound.reservationOwner).toBe(owner);expect(nonTracking(f)).toHaveLength(0);expect(f.rows.size).toBe(1);
});
it.each(['first','late'])('receipt គ្មាន token %s មិនប្រើ reservation',async order=>{
    const f=fixture();if(order==='first')await f.call(container());const bound=await reserve(f);const out=await f.call(container());expect(JSON.parse(out.body).success).not.toBe(true);expect(state(f).phase).toBe('reservation-v1:reserved');expect(nonTracking(f)).toHaveLength(0);await f.call(container(),bound);expect(f.count('saveScanInfo')).toBe(1);
});
it('អ្នកប្រើ token ពីរប្រជែង៖ CAS មួយ និង token ដែល consume រួចមិន replay',async()=>{
 const f=fixture();const bound=await reserve(f);await Promise.all([f.call(container(),bound),f.call(container(),bound)]);await f.call(container(),bound);expect(f.count('saveBillPic')).toBe(1);expect(f.count('saveScanInfo')).toBe(1);expect(state(f).phase).toBe('reservation-v1:signed');
});
it.each(['hash','fingerprint','owner','token','original'])('reservation %s ខុសមិនសរសេរ',async kind=>{
 const f=fixture();const bound=await reserve(f);const patch:any={...bound};if(kind==='hash')patch.originalSHA256='0'.repeat(64);if(kind==='fingerprint')patch.originalFingerprint='0'.repeat(64);if(kind==='owner')patch.reservationOwner=randomUUID();if(kind==='token')patch.reservationToken='invalid';if(kind==='original')patch.signMan='ផ្សេង';await f.call(container(),patch);expect(nonTracking(f)).toHaveLength(0);expect(state(f).phase).toBe('reservation-v1:reserved');
});
it('token ផុតកំណត់មិនកំណត់ journal ឡើងវិញ តែ reserved owner ដើមអាចបន្ត',async()=>{
 const f=fixture();const bound=await reserve(f);const saved=state(f);const now=vi.spyOn(Date,'now').mockReturnValue(Date.now()+3600000);
 try{await f.call(container(),bound);expect(nonTracking(f)).toHaveLength(0);const renewed=JSON.parse((await poll(f,bound)).body);expect(renewed.code).toBe('ZTO_PALM_SIGN_RESUME_READY');expect(renewed.reservationOwner).toBe(saved.owner);expect(state(f)).toEqual(saved);}finally{now.mockRestore();}
});
it.each(['claimed','photo','sending'])('crash %s មិន takeover ទោះ lease ផុត និង dispatched',async phase=>{
 const f=fixture();const bound=await reserve(f);const [key,row]=[...f.rows][0];f.rows.set(key,{...row,data:JSON.stringify({...state(f),phase:'reservation-v1:'+phase,photoAccepted:phase!=='claimed',leaseUntil:0})});const out=JSON.parse((await poll(f,bound)).body);expect(out.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');await f.call(container(),bound);expect(f.count('saveBillPic')).toBe(0);expect(f.count('saveScanInfo')).toBe(0);
});
it('journal បាត់ក្រោយមាន owner/token មិន reserve ឡើងវិញ',async()=>{
 const f=fixture();const bound=await reserve(f);f.rows.clear();await poll(f,bound);expect(f.rows.size).toBe(0);expect(nonTracking(f)).toHaveLength(0);
});
it('prewrite logical false ជា blocked មិនអនុញ្ញាត lease retry',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;f.request.mockImplementation(async path=>path.endsWith('queryTrackInfo')?real(path):{status:false,result:null} as any);const out=await f.call(container(),bound);expect(out.statusCode).not.toBe(200);expect(state(f).phase).toBe('reservation-v1:blocked');const reads=nonTracking(f).length;await poll(f,bound);await f.call(container(),bound);expect(nonTracking(f)).toHaveLength(reads);expect(f.count('saveScanInfo')).toBe(0);
});
it('warning ដើមនិងផ្លាស់៖ continuation មាន token តែមួយ និង fresh check',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;let message='ពិនិត្យដំបូង';f.request.mockImplementation(async path=>path.endsWith('newBusinessCheck')?{status:true,result:{message,whetherForce:false}} as any:real(path));
 const first=JSON.parse((await f.call(container(),bound)).body);expect(state(f).phase).toBe('reservation-v1:warning');expect(f.count('saveScanInfo')).toBe(0);
 message='ពិនិត្យថ្មី';const second=JSON.parse((await f.call(container(),{...bound,confirmationToken:first.confirmationToken})).body);expect(second.code).toBe('ZTO_PALM_SIGN_CONFIRM_REQUIRED');expect(second.confirmationToken).not.toBe(first.confirmationToken);expect(f.count('saveScanInfo')).toBe(0);
 await f.call(container(),{...bound,confirmationToken:second.confirmationToken});expect(f.count('saveScanInfo')).toBe(1);expect(state(f).phase).toBe('reservation-v1:signed');
});
it('05 ACK បាត់៖ sending មិនទទួល resume និងមិន replay រូប/05',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;f.request.mockImplementation(async path=>{const out=await real(path);if(path.endsWith('saveScanInfo'))throw Error('lost');return out;});await f.call(container(),bound);expect(state(f).phase).toBe('reservation-v1:sending');f.setSigned(false);expect(JSON.parse((await poll(f,bound)).body).code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');await f.call(container(),bound);expect(f.count('saveScanInfo')).toBe(1);expect(f.count('saveBillPic')).toBe(1);f.setSigned(true);expect(JSON.parse((await poll(f,bound)).body).scanCompleted).toBe(true);
});

it('CAS reserve ប្រជែង និង stale absence មិនប្តូរ owner ដើម',async()=>{
 const f=fixture();const results=await Promise.all([poll(f),poll(f)]);expect(results.filter(out=>JSON.parse(out.body).code==='ZTO_PALM_SIGN_RESUME_READY')).toHaveLength(1);const old=state(f);f.store.getWithMetadata.mockResolvedValue(null);expect((await poll(f)).statusCode).toBe(503);expect(state(f)).toEqual(old);expect(nonTracking(f)).toHaveLength(0);
});
it('សំណើគ្មាន reservation protocol ក្រោយ reserve មិនអាចបាត់ fence',async()=>{
 const f=fixture();await reserve(f);const out=JSON.parse((await f.call(container(),{reservationProtocol:undefined,originalFingerprint:undefined})).body);expect(out.code).toBe('ZTO_PALM_SIGN_PROTOCOL_REQUIRED');expect(state(f).phase).toBe('reservation-v1:reserved');expect(nonTracking(f)).toHaveLength(0);
});
it('warning status continuation ត្រូវការសំណើនិង token បច្ចុប្បន្នទាំងពីរ',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;f.request.mockImplementation(async path=>path.endsWith('newBusinessCheck')?{status:true,result:{message:'សូមបញ្ជាក់',whetherForce:false}} as any:real(path));
 const warning=JSON.parse((await f.call(container(),bound)).body);const saved=state(f);
 for(const patch of [{},bound,{...bound,confirmationToken:'wrong'},{reservationOwner:bound.reservationOwner,confirmationToken:warning.confirmationToken},{...bound,reservationOwner:'wrong',confirmationToken:warning.confirmationToken}])expect(JSON.parse((await poll(f,patch)).body).code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');
 const ready=JSON.parse((await poll(f,{...bound,confirmationToken:warning.confirmationToken})).body);expect(ready.code).toBe('ZTO_PALM_SIGN_RESUME_READY');expect(ready.reservationOwner).toBe(bound.reservationOwner);expect(state(f)).toEqual(saved);
 await f.call(container(),{...bound,reservationToken:ready.reservationToken,confirmationToken:warning.confirmationToken});expect(f.count('saveScanInfo')).toBe(1);
});
it('warning token ផុតកំណត់មិនអនុញ្ញាត continuation capability',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;f.request.mockImplementation(async path=>path.endsWith('newBusinessCheck')?{status:true,result:{message:'សូមបញ្ជាក់',whetherForce:false}} as any:real(path));const warning=JSON.parse((await f.call(container(),bound)).body);const saved=state(f);const now=vi.spyOn(Date,'now').mockReturnValue(Date.now()+3600000);try{const out=JSON.parse((await poll(f,{...bound,confirmationToken:warning.confirmationToken})).body);expect(out.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');expect(state(f)).toEqual(saved);expect(f.count('saveScanInfo')).toBe(0);}finally{now.mockRestore();}
});
it.each(['scope','requestId','originalFingerprint','originalSHA256','owner','protocol'])('capability seal binding %s ខុសមិនអនុញ្ញាត receipt',async field=>{
 const f=fixture();const bound=await reserve(f);const token=JSON.parse(bound.reservationToken);token[field]='wrong';await f.call(container(),{...bound,reservationToken:JSON.stringify(token)});expect(nonTracking(f)).toHaveLength(0);expect(state(f).phase).toBe('reservation-v1:reserved');
});
it('consume CAS បាត់ ACK មិនបើកការផ្ញើថ្មី',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.store.set.getMockImplementation()!;f.store.set.mockImplementation(async(key,data,options)=>{const out=await real(key,data,options);if(JSON.parse(data).phase==='reservation-v1:claimed')throw Error('lost');return out;});await f.call(container(),bound);expect(state(f).phase).toBe('reservation-v1:claimed');await poll(f,bound);await f.call(container(),bound);expect(nonTracking(f)).toHaveLength(0);
});

function gate() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
it('ស្តារមុនរូប៖ lease claimed ផុតប្តូរ capability តែ owner ដើម ហើយ request ចាស់មិន upload', async () => {
    const f = fixture(); const bound = await reserve(f); const held = gate(); const real = f.request.getMockImplementation()!;
    let first = true;
    f.request.mockImplementation(async path => { if (path.endsWith('queryPreOrderByBillCode') && first) { first = false; await held.promise; } return real(path); });
    const original = f.call(container(), bound);
    let now: ReturnType<typeof vi.spyOn> | undefined;
    try {
        await vi.waitFor(() => expect(state(f).phase).toBe('reservation-v1:claimed'));
        expect(state(f).leaseUntil).toBeGreaterThan(Date.now());
        now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
        const resumed = JSON.parse((await poll(f, bound)).body);
        expect(resumed.code).toBe('ZTO_PALM_SIGN_RESUME_READY');
        expect(resumed.reservationOwner).toBe(bound.reservationOwner);
        expect(resumed.reservationToken).not.toBe(bound.reservationToken);
        await f.call(container(), bound);
        expect(f.count('saveBillPic')).toBe(0);
        await f.call(container(), { reservationOwner: resumed.reservationOwner, reservationToken: resumed.reservationToken });
        expect(f.count('saveScanInfo')).toBe(1);
    } finally { held.resolve(); await original; now?.mockRestore(); }
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it('photo ACK រក្សារួច lease ផុត៖ capability ថ្មីរំលង upload ហើយ stale owner មិន05', async () => {
    const f = fixture(); const bound = await reserve(f); const held = gate(); const set = f.store.set.getMockImplementation()!;
    let first = true;
    f.store.set.mockImplementation(async (key, data, options) => { const out = await set(key, data, options); if (JSON.parse(data).phase === 'reservation-v1:photo' && first) { first = false; await held.promise; } return out; });
    const original = f.call(container(), bound);
    let now: ReturnType<typeof vi.spyOn> | undefined;
    try {
        await vi.waitFor(() => expect(state(f).phase).toBe('reservation-v1:photo'));
        expect(state(f).leaseUntil).toBeGreaterThan(Date.now());
        now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
        const resumed = JSON.parse((await poll(f, bound)).body);
        expect(resumed.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(resumed.reservationOwner).toBe(bound.reservationOwner);
        await f.call(container(), { reservationOwner: resumed.reservationOwner, reservationToken: resumed.reservationToken });
        expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
    } finally { held.resolve(); await original; now?.mockRestore(); }
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it.each(['exact', 'unknown'])('image-sending lease ផុត %s៖ មិន upload រូបឡើងវិញ ហើយបន្តតែ exact proof', async kind => {
    const f = fixture(); const bound = await reserve(f); const held = gate(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => {
        if (path.endsWith('saveBillPic')) await held.promise;
        if (path.endsWith('querySignPic')) return { status: true, result: kind === 'unknown' ? [] : [{ billCode: code, savePos: `https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/${code}_123.jpg` }] } as any;
        return real(path);
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(photo, 'base64'), { headers: { 'content-type': 'image/jpeg' } })));
    const original = f.call(container(), bound); let now: ReturnType<typeof vi.spyOn> | undefined;
    try {
        await vi.waitFor(() => expect(f.count('saveBillPic')).toBe(1));
        expect(state(f).phase).toBe('reservation-v1:image-sending');
        expect(state(f).leaseUntil).toBeGreaterThan(Date.now());
        now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
        const resumed = JSON.parse((await poll(f, bound)).body);
        if (kind === 'exact') {
            expect(resumed.code).toBe('ZTO_PALM_SIGN_RESUME_READY');
            await f.call(container(), { reservationOwner: resumed.reservationOwner, reservationToken: resumed.reservationToken });
            expect(f.count('saveScanInfo')).toBe(1);
        } else { expect(resumed.manualReview).toBe(true); expect(resumed.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(f.count('saveScanInfo')).toBe(0); }
        expect(f.count('saveBillPic')).toBe(1);
    } finally { held.resolve(); await original; now?.mockRestore(); vi.unstubAllGlobals(); }
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});

async function warned() {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('newBusinessCheck') ? { status: true, result: { message: 'សូមបញ្ជាក់', whetherForce: false } } as any : real(path));
    const warning = JSON.parse((await f.call(container(), bound)).body);
    return { f, bound: { ...bound, confirmationToken: warning.confirmationToken } };
}
it('បោះបង់ warning មុនរូប៖ ACK ត្រូវ binding និង tombstone មិនអនុញ្ញាត token ចាស់', async () => {
    const { f, bound } = await warned();
    const cancel = await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined });
    expect(cancel.statusCode).toBe(200);
    expect(JSON.parse(cancel.body)).toMatchObject({ success: true, cancelled: true, stage: 'receipt-cancel', barcode: code, requestId: f.input.requestId, reservationOwner: bound.reservationOwner, originalSHA256, originalFingerprint: (f.input as any).originalFingerprint, photoProtocol, reservationProtocol: 'original-reservation-v1' });
    expect(state(f).phase).toBe('reservation-v1:cancelled');
    const second = await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined });
    expect(second.body).toBe(cancel.body);
    await f.call(container(), bound); await poll(f, bound);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it.each(['owner', 'token', 'confirmation', 'fingerprint'])('បោះបង់ binding %s ខុស មិនប្តូរ warning', async kind => {
    const { f, bound } = await warned(); const before = state(f); const patch: any = { ...bound, stage: 'receipt-cancel', photo: undefined };
    if (kind === 'owner') patch.reservationOwner = 'other'; if (kind === 'token') patch.reservationToken = 'wrong'; if (kind === 'confirmation') patch.confirmationToken = 'wrong'; if (kind === 'fingerprint') patch.originalFingerprint = '0'.repeat(64);
    const result = await f.call(container(), patch); expect(JSON.parse(result.body).cancelled).not.toBe(true); expect(state(f)).toEqual(before);
});
it.each(['photo', 'image-sending', 'sending', 'signed', 'claimed'])('បោះបង់ក្រោយ %s ត្រូវបដិសេធ មិន ACK លុបរូប', async phase => {
    const { f, bound } = await warned(); const [key, row] = [...f.rows][0]; const saved = { ...state(f), phase: 'reservation-v1:' + phase, photoAccepted: ['photo', 'sending', 'signed'].includes(phase) };
    f.rows.set(key, { ...row, data: JSON.stringify(saved) });
    const result = await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined }); expect(JSON.parse(result.body).cancelled).not.toBe(true); expect(state(f)).toEqual(saved);
});
it('cancel journal ACK បាត់៖ tombstone អាច ACK ត្រឡប់ដោយមិនប្តូររូបឬ05', async () => {
    const { f, bound } = await warned(); const real = f.store.set.getMockImplementation()!; let lost = true;
    f.store.set.mockImplementation(async (key, data, options) => { const out = await real(key, data, options); if (lost && JSON.parse(data).phase === 'reservation-v1:cancelled') { lost = false; throw Error('lost'); } return out; });
    await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined });
    expect(state(f).phase).toBe('reservation-v1:cancelled');
    expect(JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined })).body).cancelled).toBe(true);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it.each(['cancel', 'claim'])('cancel និង claim ប្រជែង winner %s មិន05ក្រោយcancelACK', async winner => {
    const { f, bound } = await warned(); const real = f.store.set.getMockImplementation()!; const held = gate();
    const loserPhase = winner === 'cancel' ? 'reservation-v1:claimed' : 'reservation-v1:cancelled';
    f.store.set.mockImplementation(async (key, data, options) => { if (JSON.parse(data).phase === loserPhase) await held.promise; return real(key, data, options); });
    const cancel = f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined }); const claim = f.call(container(), bound);
    try { await vi.waitFor(() => expect(state(f).phase).toBe(winner === 'cancel' ? 'reservation-v1:cancelled' : 'reservation-v1:signed')); }
    finally { held.resolve(); }
    const [cancelResult] = await Promise.all([cancel, claim]); expect(JSON.parse(cancelResult.body).cancelled === true).toBe(winner === 'cancel'); expect(f.count('saveScanInfo')).toBe(winner === 'cancel' ? 0 : 1);
});
it('tombstone អនុញ្ញាតតែ request ថ្មី CAS reserve ហើយ token ចាស់មិនរស់ឡើងវិញ', async () => {
    const { f, bound } = await warned(); await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined });
    const requestId = randomUUID(); const originalFingerprint = createHash('sha256').update(JSON.stringify([code, requestId, f.input.signMan, photo])).digest('hex');
    const ready = JSON.parse((await poll(f, { requestId, originalFingerprint })).body); expect(ready.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(ready.reservationOwner).not.toBe(bound.reservationOwner);
    await f.call(container(), bound); expect(f.count('saveScanInfo')).toBe(0); expect(state(f).requestId).toBe(requestId);
});

it('receipt-cancel គ្មាន reservation protocol មិនធ្លាក់ចូល submit 05',async()=>{
 const f=fixture();const out=await f.call(container(),{stage:'receipt-cancel',photo:undefined,reservationProtocol:undefined,originalFingerprint:undefined});expect(out.statusCode).toBe(409);expect(nonTracking(f)).toHaveLength(0);expect(f.rows.size).toBe(0);
});
it('cancel ACK ដែលបាត់អាចផ្ទៀងក្រោយ token ផុតកំណត់ តែមិនបោះបង់ការងារថ្មី',async()=>{
 const {f,bound}=await warned();await f.call(container(),{...bound,stage:'receipt-cancel',photo:undefined});const now=vi.spyOn(Date,'now').mockReturnValue(Date.now()+3600000);try{const out=JSON.parse((await f.call(container(),{...bound,stage:'receipt-cancel',photo:undefined})).body);expect(out.cancelled).toBe(true);expect(out.reservationToken).toBe(bound.reservationToken);expect(f.count('saveScanInfo')).toBe(0);}finally{now.mockRestore();}
});
it('photo→sending ឈ្នះ CAS មុន recovery៖ capability មិនអាចបានក្រោយ05', async () => {
    const f = fixture(); const bound = await reserve(f); const photoAck = gate(); const recoveryWrite = gate(); const real = f.store.set.getMockImplementation()!;
    let photoHeld = false; let recoveryHeld = false;
    f.store.set.mockImplementation(async (key, data, options) => {
        const next = JSON.parse(data);
        if (next.phase === 'reservation-v1:reserved' && next.attempt !== JSON.parse(bound.reservationToken).attempt) { recoveryHeld = true; await recoveryWrite.promise; }
        const result = await real(key, data, options);
        if (next.phase === 'reservation-v1:photo' && !photoHeld) { photoHeld = true; await photoAck.promise; }
        return result;
    });
    const original = f.call(container(), bound); let now: ReturnType<typeof vi.spyOn> | undefined; let recovery: Promise<any> | undefined;
    try {
        await vi.waitFor(() => expect(state(f).phase).toBe('reservation-v1:photo'));
        now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
        recovery = poll(f, bound); await vi.waitFor(() => expect(recoveryHeld).toBe(true));
        photoAck.resolve(); await original; expect(state(f).phase).toBe('reservation-v1:signed');
        recoveryWrite.resolve(); const result = await recovery; expect(JSON.parse(result.body).code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');
    } finally { photoAck.resolve(); recoveryWrite.resolve(); await original; await recovery; now?.mockRestore(); }
    expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it('recovery CAS ACK បាត់៖ token ចាស់អាចអាន current attempt តែគ្មានសិទ្ធិ consumeចាស់', async () => {
    const f = fixture(); const bound = await reserve(f); const held = gate(); const realRequest = f.request.getMockImplementation()!; let first = true;
    f.request.mockImplementation(async path => { if (path.endsWith('queryPreOrderByBillCode') && first) { first = false; await held.promise; } return realRequest(path); });
    const original = f.call(container(), bound); let now: ReturnType<typeof vi.spyOn> | undefined;
    try {
        await vi.waitFor(() => expect(state(f).phase).toBe('reservation-v1:claimed')); now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
        const realSet = f.store.set.getMockImplementation()!; let lost = true;
        f.store.set.mockImplementation(async (key, data, options) => { const out = await realSet(key, data, options); if (lost && JSON.parse(data).phase === 'reservation-v1:reserved') { lost = false; throw Error('lost'); } return out; });
        await poll(f, bound); expect(state(f).phase).toBe('reservation-v1:reserved');
        await f.call(container(), bound); expect(f.count('saveBillPic')).toBe(0);
        const ready = JSON.parse((await poll(f, bound)).body); expect(ready.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(ready.reservationOwner).toBe(bound.reservationOwner);
        expect(JSON.parse(ready.reservationToken).attempt).toBe(state(f).attempt); expect(state(f).attempt).not.toBe(JSON.parse(bound.reservationToken).attempt);
    } finally { held.resolve(); await original; now?.mockRestore(); }
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it.each(['unsupported_content_type', 'invalid_image', 'hash_mismatch', 'empty'])('រូប signed %s មានមូលហេតុជាក់លាក់ មិនអះអាង proof', async reason => {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('querySignPic') ? { status: true, result: reason === 'empty' ? [] : [{ billCode: code, savePos: `https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/${code}_123.jpg` }] } as any : real(path));
    const bytes = reason === 'invalid_image' ? Buffer.from('invalid') : reason === 'hash_mismatch' ? Buffer.from(photo, 'base64').map((v, i) => i === 25 ? 2 : v) : Buffer.from(photo, 'base64');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, { headers: { 'content-type': reason === 'unsupported_content_type' ? 'text/plain' : 'image/jpeg' } })));
    try { const out = JSON.parse((await f.call(container(), bound)).body); expect(out.scanCompleted).toBe(true); expect(out.photoProof).toBeUndefined(); expect(out.photoStatusReason).toBe(reason); expect(out.manualReview === true).toBe(['unsupported_content_type', 'invalid_image'].includes(reason)); }
    finally { vi.unstubAllGlobals(); }
});
it('expired token អនុញ្ញាតតែ explicit cancel warning មុនរូប មិនអនុញ្ញាត READY ឬ receipt', async () => {
    const { f, bound } = await warned(); const before = state(f); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600000);
    try {
        const ready = JSON.parse((await poll(f, bound)).body); expect(ready.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');
        const receipt = JSON.parse((await f.call(container(), bound)).body); expect(receipt.success).not.toBe(true); expect(state(f)).toEqual(before);
        const cancelled = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined })).body);
        expect(cancelled).toMatchObject({ cancelled: true, stage: 'receipt-cancel', reservationOwner: bound.reservationOwner, reservationToken: bound.reservationToken });
        expect(state(f).phase).toBe('reservation-v1:cancelled'); expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
    } finally { now.mockRestore(); }
});
it('expired cancel token មិនអាចបោះបង់ reservation របស់ request ថ្មី', async () => {
    const { f, bound } = await warned(); await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined });
    const requestId = randomUUID(); const originalFingerprint = createHash('sha256').update(JSON.stringify([code, requestId, f.input.signMan, photo])).digest('hex');
    await poll(f, { requestId, originalFingerprint }); const saved = state(f); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600000);
    try { const out = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined })).body); expect(out.cancelled).not.toBe(true); expect(state(f)).toEqual(saved); expect(f.count('saveScanInfo')).toBe(0); }
    finally { now.mockRestore(); }
});

it.each(['same', 'changed', 'clear', 'forbidden'])('expired warning refresh %s អានតែប៉ុណ្ណោះ ហើយការសម្រេចថ្មីមាន CAS', async kind => {
    const { f, bound } = await warned(); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000);
    const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('newBusinessCheck') ? { status: true, result: kind === 'clear' ? null : { message: kind === 'same' ? 'សូមបញ្ជាក់' : 'សារថ្មី', whetherForce: kind === 'forbidden' } } as any : real(path));
    try {
        const trigger = JSON.parse((await poll(f, bound)).body); expect(trigger).toMatchObject({ code: 'ZTO_PALM_SIGN_WARNING_REFRESH_REQUIRED', warningRefreshRequired: true, reservationToken: bound.reservationToken, confirmationToken: bound.confirmationToken });
        const reads = nonTracking(f).length;
        const out = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-warning-refresh' })).body);
        expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0); expect(f.count('/add')).toBe(0); expect(nonTracking(f).length).toBeGreaterThan(reads);
        if (kind === 'same' || kind === 'clear') {
            expect(out).toMatchObject({ code: 'ZTO_PALM_SIGN_RESUME_READY', warningRefreshed: true, reservationOwner: bound.reservationOwner });
            expect(out.confirmationToken).toEqual(kind === 'clear' ? '' : expect.any(String));
            const continued = await f.call(container(), { ...bound, reservationToken: out.reservationToken, confirmationToken: out.confirmationToken });
            expect(JSON.parse(continued.body).scanCompleted).toBe(true); expect(f.count('saveScanInfo')).toBe(1);
        } else if (kind === 'changed') {
            expect(out).toMatchObject({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', warningChanged: true, warningRefreshed: true, message: 'សារថ្មី', reservationOwner: bound.reservationOwner });
            await f.call(container(), bound); expect(f.count('saveScanInfo')).toBe(0);
        } else { expect(state(f).phase).toBe('reservation-v1:blocked'); expect(out.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY'); }
    } finally { now.mockRestore(); }
});
it.each(['same', 'changed'])('refresh ACK បាត់ %s៖ prior token អាន challenge ដែលរក្សារួច មិនធ្វើ preflight ម្តងទៀត', async kind => {
    const { f, bound } = await warned(); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('newBusinessCheck') ? { status: true, result: { message: kind === 'same' ? 'សូមបញ្ជាក់' : 'សារថ្មី', whetherForce: false } } as any : real(path));
    try {
        const first = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-warning-refresh' })).body); expect(first.warningRefreshed).toBe(true);
        const reads = nonTracking(f).length;
        const again = JSON.parse((await poll(f, bound)).body); expect(again.code).toBe(first.code); expect(again.confirmationToken).toBe(first.confirmationToken); expect(again.warningChanged).toBe(first.warningChanged); expect(nonTracking(f)).toHaveLength(reads);
        expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
    } finally { now.mockRestore(); }
});
it('refresh និង cancel ប្រជែង៖ cancelled CAS ឈ្នះ មិនអាចផ្ដល់ capability', async () => {
    const { f, bound } = await warned(); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000); const held = gate(); const real = f.request.getMockImplementation()!; let reading = false;
    f.request.mockImplementation(async path => { if (path.endsWith('newBusinessCheck')) { reading = true; await held.promise; } return real(path); });
    const work = f.call(container(), { ...bound, stage: 'receipt-warning-refresh' });
    try { await vi.waitFor(() => expect(reading).toBe(true)); expect(JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined })).body).cancelled).toBe(true); }
    finally { held.resolve(); }
    try { const out = JSON.parse((await work).body); expect(out.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(out.warningRefreshed).not.toBe(true); expect(state(f).phase).toBe('reservation-v1:cancelled'); expect(f.count('saveBillPic')).toBe(0); }
    finally { now.mockRestore(); }
});
it.each(['clear', 'refused', 'warning'])('explicit prewrite refresh %s មានតែការងារ blocked មុនរូប', async kind => {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!; let allowed = false;
    f.request.mockImplementation(async path => path.endsWith('queryPreOrderByBillCode') && !allowed ? { status: false, result: null } as any : path.endsWith('newBusinessCheck') && kind === 'warning' ? { status: true, result: { message: 'សារថ្មី', whetherForce: false } } as any : real(path));
    await f.call(container(), bound); const manual = JSON.parse((await poll(f, bound)).body); expect(manual).toMatchObject({ manualReview: true, reason: 'blocked', continuationAllowed: true }); allowed = kind !== 'refused';
    const out = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-prewrite-refresh' })).body);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0); expect(f.count('/add')).toBe(0);
    if (kind === 'clear') { expect(out.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); await f.call(container(), { ...bound, reservationToken: out.reservationToken, confirmationToken: out.confirmationToken }); expect(f.count('saveScanInfo')).toBe(1); }
    else if (kind === 'warning') expect(out).toMatchObject({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', warningChanged: true });
    else { expect(out.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(state(f).phase).toBe('reservation-v1:blocked'); }
});
it.each(['expiry', 'relogin'])('readonly refresh %s ប្រើ fresh dispatch proof តែគ្មាន04ឬimageក្នុង refresh', async kind => {
    const { f, bound } = await warned(); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + (kind === 'expiry' ? 7200000 : 600000));
    if (kind === 'relogin') f.session.token = 'renewed-palm';
    try {
        const stale = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-warning-refresh' })).body); expect(stale).toMatchObject({ code: 'ZTO_PALM_DISPATCH_REQUIRED', requestId: f.input.requestId });
        const status = JSON.parse((await f.call(container(), { stage: 'status', photo: undefined })).body); expect(status.dispatched).toBe(true); expect(status.ztoClosed).toBe(false);
        const fresh = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-warning-refresh', dispatchProof: status.dispatchProof })).body); expect(fresh.code).toBe('ZTO_PALM_SIGN_RESUME_READY');
        expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0); expect(f.count('/add')).toBe(0);
        const result = JSON.parse((await f.call(container(), { ...bound, dispatchProof: status.dispatchProof, reservationToken: fresh.reservationToken, confirmationToken: fresh.confirmationToken })).body); expect(result.scanCompleted).toBe(true); expect(f.count('saveScanInfo')).toBe(1);
    } finally { now.mockRestore(); }
});
it('refresh CAS ACK បាត់៖ persisted challenge តែមួយ ទោះ prior request ផ្ញើម្ដងទៀត', async () => {
    const { f, bound } = await warned(); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000); const real = f.store.set.getMockImplementation()!; let lost = true;
    f.store.set.mockImplementation(async (key, data, options) => { const out = await real(key, data, options); if (lost && JSON.parse(data).refreshDecision) { lost = false; throw Error('lost'); } return out; });
    try {
        expect((await f.call(container(), { ...bound, stage: 'receipt-warning-refresh' })).statusCode).toBe(503); const saved = state(f); expect(saved.refreshDecision).toBe('same'); const reads = nonTracking(f).length;
        const recovered = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-warning-refresh' })).body); expect(recovered.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(recovered.confirmationToken).toBe(saved.warning.confirmationToken); expect(nonTracking(f)).toHaveLength(reads); expect(state(f)).toEqual(saved);
    } finally { now.mockRestore(); }
});
it('blocked refresh click ពីរប្រជែង៖ capability មួយ ហើយ receipt មួយ', async () => {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('queryPreOrderByBillCode') ? { status: false, result: null } as any : real(path)); await f.call(container(), bound); f.request.mockImplementation(real);
    const outcomes = await Promise.all([f.call(container(), { ...bound, stage: 'receipt-prewrite-refresh' }), f.call(container(), { ...bound, stage: 'receipt-prewrite-refresh' })]);
    const ready = outcomes.map(out => JSON.parse(out.body)).filter(body => body.code === 'ZTO_PALM_SIGN_RESUME_READY'); expect(ready).toHaveLength(1); expect(f.count('saveScanInfo')).toBe(0);
    await f.call(container(), { ...bound, reservationToken: ready[0].reservationToken, confirmationToken: '' }); expect(f.count('saveScanInfo')).toBe(1);
});
it.each(['expired', 'stale-attempt', 'postimage'])('blocked refresh %s ផ្តល់សិទ្ធិតែ provenance ដើមមុនរូប', async kind => {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('queryPreOrderByBillCode') ? { status: false, result: null } as any : real(path)); await f.call(container(), bound); f.request.mockImplementation(real);
    const [key, row] = [...f.rows][0]; if (kind !== 'expired') f.rows.set(key, { ...row, data: JSON.stringify({ ...state(f), ...(kind === 'postimage' ? { photoAccepted: true } : { attempt: randomUUID() }) }) });
    const reads = nonTracking(f).length; const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000);
    try { const out = JSON.parse((await f.call(container(), { ...bound, stage: 'receipt-prewrite-refresh' })).body); if (kind === 'expired') expect(out.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); else { expect(out.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(nonTracking(f)).toHaveLength(reads); } expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0); }
    finally { now.mockRestore(); }
});

it('refusal ACK បាត់ មិនពិនិត្យម្ដងទៀតដោយ intent ដដែល ទោះ condition បានកែ',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;let allowed=false;f.request.mockImplementation(async path=>path.endsWith('queryPreOrderByBillCode')&&!allowed?{status:false,result:null} as any:real(path));await f.call(container(),bound);
 const refused=JSON.parse((await f.call(container(),{...bound,stage:'receipt-prewrite-refresh'})).body);expect(refused).toMatchObject({manualReview:true,reason:'blocked',refreshRequestId:(f.input as any).refreshRequestId});expect(refused.reservationToken).toEqual(expect.any(String));const reads=nonTracking(f).length;allowed=true;
 const retry=JSON.parse((await f.call(container(),{...bound,stage:'receipt-prewrite-refresh'})).body);expect(retry.manualReview).toBe(true);expect(retry.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');expect(nonTracking(f)).toHaveLength(reads);
 const repeated=JSON.parse((await f.call(container(),{...bound,reservationToken:refused.reservationToken,stage:'receipt-prewrite-refresh'})).body);expect(repeated.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');expect(nonTracking(f)).toHaveLength(reads);
 const fresh=JSON.parse((await f.call(container(),{...bound,reservationToken:refused.reservationToken,refreshRequestId:randomUUID(),stage:'receipt-prewrite-refresh'})).body);expect(fresh.code).toBe('ZTO_PALM_SIGN_RESUME_READY');expect(f.count('saveScanInfo')).toBe(0);
});
it('intent A false→B false→late A មិនបើក preflight ឬREADYឡើងវិញ',async()=>{
 const f=fixture();const bound=await reserve(f);const real=f.request.getMockImplementation()!;let allowed=false;f.request.mockImplementation(async path=>path.endsWith('queryPreOrderByBillCode')&&!allowed?{status:false,result:null} as any:real(path));await f.call(container(),bound);
 const first=JSON.parse((await f.call(container(),{...bound,stage:'receipt-prewrite-refresh'})).body);expect(first.reservationToken).toEqual(expect.any(String));const secondId=randomUUID();const second=JSON.parse((await f.call(container(),{...bound,reservationToken:first.reservationToken,refreshRequestId:secondId,stage:'receipt-prewrite-refresh'})).body);expect(second.refreshRequestId).toBe(secondId);expect(second.reservationToken).not.toBe(first.reservationToken);const reads=nonTracking(f).length;allowed=true;
 const late=JSON.parse((await f.call(container(),{...bound,stage:'receipt-prewrite-refresh'})).body);expect(late.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');expect(nonTracking(f)).toHaveLength(reads);expect(f.count('saveScanInfo')).toBe(0);
});
it('tracking signed មុន reservation ទប់ READY រហូត fulloriginal bind មុន photo proof', async () => {
    const f = fixture(); f.setSigned(true);
    const first = JSON.parse((await poll(f)).body);
    expect(first.code).toBe('ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED');
    expect(state(f).phase).toBe('reservation-v1:closed-observed');
    expect(f.count('querySignPic')).toBe(0);
    const wrong = JSON.parse((await poll(f, { photo, signMan: 'ខុស' })).body);
    expect(wrong.code).toBe('ZTO_PALM_SIGN_INVALID'); expect(state(f).originalValidated).not.toBe(true);
    const bound = JSON.parse((await poll(f, { photo, signMan: f.input.signMan })).body);
    expect(bound).toMatchObject({ scanCompleted: true, ztoClosed: true, closureObserved: true });
    expect(bound.photoProof).toBeUndefined(); expect(state(f).originalValidated).toBe(true);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it.each(['absent', 'unknown', 'malformed', 'unsigned'])('tracking %s គោរព fresh guard មុន READY', async kind => {
    const f = fixture(); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('queryTrackInfo') ? { status: true, result: kind === 'absent' ? [] : [{ mail: { mailNo: code, isSign: kind === 'unknown' ? null : 0 }, tracks: kind === 'malformed' ? [{}] : [] }] } as any : real(path));
    const out = JSON.parse((await poll(f)).body);
    expect(out.code === 'ZTO_PALM_SIGN_RESUME_READY').toBe(kind === 'unsigned');
    expect(f.rows.size).toBe(kind === 'unsigned' ? 1 : 0);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it('tracking signed ក្រោយ READY ទប់ actualreceipt មុនរូបនិង05', async () => {
    const f = fixture(); const bound = await reserve(f); f.setSigned(true);
    const out = JSON.parse((await f.call(container(), bound)).body);
    expect(out).toMatchObject({ scanCompleted: true, closureObserved: true });
    expect(state(f).phase).toBe('reservation-v1:closed-observed'); expect(state(f).originalValidated).toBe(true);
    expect(f.count('queryTrackInfo')).toBe(2); expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it('normal receipt ប្រើ guard tracking ពីរដងប៉ុណ្ណោះ', async () => {
    const f = fixture(); const bound = await reserve(f); await f.call(container(), bound);
    expect(f.count('queryTrackInfo')).toBe(2); expect(f.count('saveBillPic')).toBe(1); expect(f.count('saveScanInfo')).toBe(1);
});
it.each(['warning', 'claimed', 'photo', 'image-sending'])('fresh signed ក្រោយ %s មិន renew READY ឬ05', async phase => {
    const f = fixture(); const bound = await reserve(f); const [key, row] = [...f.rows][0];
    const start = Date.now() - 120000;
    f.rows.set(key, { ...row, data: JSON.stringify({ ...state(f), phase: 'reservation-v1:' + phase, originalValidated: true, leaseStartedAt: start, leaseUntil: start + 90000, photoAccepted: phase === 'photo' }) });
    f.setSigned(true); const reads = f.count('queryTrackInfo');
    const out = JSON.parse((await poll(f, bound)).body);
    expect(out).toMatchObject({ closureObserved: true, scanCompleted: true, photoAccepted: phase === 'photo' });
    expect(state(f).phase).toBe('reservation-v1:closed-observed'); expect(f.count('queryTrackInfo')).toBe(reads + 1);
    expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it.each(['wrong-hash', 'CAS', 'wrong-attempt'])('closed original bind %s មិនចេញ positive proof', async kind => {
    const f = fixture(); f.setSigned(true); await poll(f);
    let patch: any = { photo, signMan: f.input.signMan };
    if (kind === 'wrong-hash') patch.originalSHA256 = '0'.repeat(64);
    if (kind === 'CAS') f.store.set.mockResolvedValue({ modified: false } as any);
    if (kind === 'wrong-attempt') patch = { ...patch, reservationOwner: state(f).owner, reservationToken: JSON.stringify({ kind: 'sign-reservation', attempt: 'wrong' }) };
    const out = JSON.parse((await poll(f, patch)).body);
    expect(out.success).not.toBe(true); expect(out.photoProof).toBeUndefined(); expect(state(f).originalValidated).toBe(false);
    expect(f.count('querySignPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
});
it('closed exact original proof ក្រោយ fullbind ប៉ុណ្ណោះ ហើយ smallpoll មិន querytracking ម្ដងទៀត', async () => {
    const f = fixture(); f.setSigned(true); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('querySignPic') ? { status: true, result: [{ billCode: code, savePos: `https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/${code}_123.jpg` }] } as any : real(path));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(photo, 'base64'), { headers: { 'content-type': 'image/jpeg' } })));
    try {
        await poll(f); expect(fetch).not.toHaveBeenCalled();
        const bound = JSON.parse((await poll(f, { photo, signMan: f.input.signMan })).body);
        expect(bound).toMatchObject({ closureObserved: true, scanCompleted: true, photoAccepted: false, photoProof: { verified: true, originalSHA256 } });
        const again = JSON.parse((await poll(f)).body); expect(again.photoProof.verified).toBe(true);
        expect(f.count('queryTrackInfo')).toBe(1); expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
    } finally { vi.unstubAllGlobals(); }
});
it('own05 ACK បាត់ freshclosed គ្រាន់តែបញ្ជាក់បិទ មិនអះអាង external signer', async () => {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => { const out = await real(path); if (path.endsWith('saveScanInfo')) throw new Error('lost'); return out; });
    await f.call(container(), bound); expect(state(f).phase).toBe('reservation-v1:sending');
    const out = JSON.parse((await poll(f, bound)).body);
    expect(out.scanCompleted).toBe(true); expect(out.closureObserved).toBeUndefined(); expect(out.externalSigner).toBeUndefined();
    expect(f.count('saveScanInfo')).toBe(1); expect(f.count('saveBillPic')).toBe(1);
});
it.each(['absent', 'unknown', 'malformed', 'unsigned'])('actual receipt tracking %s មុន firstwrite មិនទាមទារ04ថ្មី', async kind => {
    const f = fixture(); const bound = await reserve(f); const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('queryTrackInfo') ? { status: true, result: kind === 'absent' ? [] : [{ mail: { mailNo: code, isSign: kind === 'unknown' ? null : 0 }, tracks: kind === 'malformed' ? [{}] : [] }] } as any : real(path));
    const out = JSON.parse((await f.call(container(), bound)).body);
    expect(out.scanCompleted === true).toBe(kind === 'unsigned');
    expect(f.count('saveBillPic')).toBe(kind === 'unsigned' ? 1 : 0); expect(f.count('saveScanInfo')).toBe(kind === 'unsigned' ? 1 : 0);
    if (kind !== 'unsigned') expect(state(f).phase).toBe('reservation-v1:reserved');
    expect(f.count('queryTrackInfo')).toBe(2);
});
it('lost refresh ACK prior token ដែលអាន closed រួច អាចផ្ទៀង exactphoto ក្រោយ clear warning intent', async () => {
    const { f, bound } = await warned();
    await f.call(container(), { ...bound, stage: 'receipt-warning-refresh' });
    f.setSigned(true);
    const first = JSON.parse((await poll(f, bound)).body); expect(first).toMatchObject({ scanCompleted: true, closureObserved: true });
    const real = f.request.getMockImplementation()!;
    f.request.mockImplementation(async path => path.endsWith('querySignPic') ? { status: true, result: [{ billCode: code, savePos: `https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/${code}_123.jpg` }] } as any : real(path));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from(photo, 'base64'), { headers: { 'content-type': 'image/jpeg' } })));
    try {
        const later = JSON.parse((await poll(f, { ...bound, confirmationToken: undefined, refreshRequestId: undefined })).body);
        expect(later.photoProof?.verified).toBe(true);
        const forged = JSON.parse(bound.reservationToken); forged.attempt = 'unaccepted-old-attempt';
        const invalid = JSON.parse((await poll(f, { ...bound, reservationToken: JSON.stringify(forged), confirmationToken: undefined })).body);
        expect(invalid.photoProof).toBeUndefined(); expect(invalid.success).not.toBe(true);
        const receipt = JSON.parse((await f.call(container(), bound)).body);
        expect(receipt.success).not.toBe(true); expect(receipt.code).not.toBe('ZTO_PALM_SIGN_RESUME_READY');
        expect(f.count('saveBillPic')).toBe(0); expect(f.count('saveScanInfo')).toBe(0);
    } finally { vi.unstubAllGlobals(); }
});
it('cancel ក្រោយ closed ត្រូវ manual refusal មិនឆ្លើយ scan success ឬ cancelACK', async () => {
    const { f, bound } = await warned(); f.setSigned(true); await poll(f, bound);
    const before = state(f); const reads = nonTracking(f).length;
    const out = await f.call(container(), { ...bound, stage: 'receipt-cancel', photo: undefined });
    expect(out.statusCode).toBe(409); expect(JSON.parse(out.body)).toMatchObject({ manualReview: true, reason: 'preimage_uncertain', barcode: code, requestId: f.input.requestId });
    expect(JSON.parse(out.body).cancelled).not.toBe(true); expect(state(f)).toEqual(before); expect(nonTracking(f)).toHaveLength(reads);
});
