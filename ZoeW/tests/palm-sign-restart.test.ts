// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const sign = require('../netlify/functions/_shared/zto-palm-sign');
const code = '77130538161028';
function fixture() {
    const requestId = randomUUID();
    const input: any = { barcode: code, requestId, stage: 'receipt-restart-check', photoProtocol: 'original-sha256-v1',
        restartFromRequestId: randomUUID(), originalSHA256: 'a'.repeat(64), reservationProtocol: 'original-reservation-v1', originalFingerprint: 'b'.repeat(64) };
    const session = { token: 'synthetic', site: 'KH1', operator: 'test' };
    let row: any = { data: JSON.stringify({ kind: 'sign-journal', phase: 'retry', owner: 'old-owner', requestId: randomUUID(),
        fingerprint: 'c'.repeat(64), photoAccepted: false, leaseUntil: 0 }), etag: 'seed', metadata: { at: Date.now() - 1800000 } };
    let serial = 0;
    const store = { getWithMetadata: vi.fn(async () => row), set: vi.fn(async (_key: string, data: string, options: any) => {
        if (options.onlyIfMatch !== row.etag) return { modified: false };
        row = { data, etag: String(++serial), metadata: options.metadata }; return { modified: true, etag: row.etag };
    }) };
    let eligible = true, signed = false, returned = false;
    const request = vi.fn(async (path: string) => {
        if (!path.endsWith('queryTrackInfo')) throw Error('unexpected upstream mutation');
        return { status: true, result: [{ mail: { mailNo: code, isSign: signed ? 1 : 0 }, tracks: [
            { mailNo: code, siteCode: session.site, time: '2026-10-25 10:00:00', action: '3' },
            { mailNo: code, siteCode: session.site, time: '2026-10-25 11:00:00', action: '4' } ] }] };
    });
    const proof = { open: JSON.parse, seal: JSON.stringify, stamp: (s: string) => s,
        verdict: (_body: any) => ({ ztoClosed: signed ? true : eligible ? false : null, ztoReturnedAt: returned ? '2026-10-25 12:00:00' : null,
            ztoMisplacedAt: null, ztoSentOutAt: null, ztoArrivalAt: '2026-10-25 10:00:00' }) };
    const deps = { keyLabel: 'restart-test', blobStore: () => ({ store }), lookupAccess: async () => ({ verified: true, site: session.site }) };
    const call = async (patch = {}) => { const out = await sign.signPalm({ body: JSON.stringify({ ...input, ...patch }) }, session, deps, request, proof); return { status: out.statusCode, body: JSON.parse(out.body) }; };
    return { input, session, deps, store, proof, request, call, row: () => row,
        setRow: (patch: any) => { row = { ...row, ...patch }; },
        setState: (patch: any) => { row.data = JSON.stringify({ ...JSON.parse(row.data), ...patch }); },
        verdict: (patch: any) => { eligible = patch.eligible ?? eligible; signed = patch.signed ?? signed; returned = patch.returned ?? returned; } };
}
async function challenge(f: ReturnType<typeof fixture>) {
    const result = await f.call();
    expect(result.body.code).toBe('ZTO_PALM_SIGN_RESTART_CONFIRM_REQUIRED');
    expect(result.body.restartToken).toEqual(expect.any(String)); return result.body.restartToken;
}
it('ចាប់ផ្ដើមឡើងវិញត្រូវ consent challenge ហើយកក់តែសំណើថ្មី មិនផ្ញើរូបឬ05', async () => {
    const f = fixture(); const before = f.row().data; const token = await challenge(f);
    expect(f.row().data).toBe(before); expect(f.store.set).not.toHaveBeenCalled();
    const no = await f.call({ stage: 'receipt-restart-confirm', restartToken: token });
    expect(no.body.restarted).not.toBe(true); expect(f.row().data).toBe(before);
    const yes = await f.call({ stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true });
    expect(yes.body).toMatchObject({ code: 'ZTO_PALM_SIGN_RESUME_READY', restarted: true, requestId: f.input.requestId });
    const state = JSON.parse(f.row().data);
    expect(state).toMatchObject({ phase: 'reservation-v1:reserved', requestId: f.input.requestId, photoAccepted: false });
    expect(state.owner).not.toBe('old-owner'); expect(state.restartAudit.predecessor.owner).toBe('old-owner');
    expect(f.request.mock.calls.every(([path]) => path.endsWith('queryTrackInfo'))).toBe(true);
    expect(yes.body.photoProof).toBeUndefined();
});
it.each(['signed', 'returned', 'unknown', 'active', 'recent', 'wrong-branch'])('មិន restart ពេល %s', async kind => {
    const f = fixture();
    if (kind === 'signed') f.verdict({ signed: true });
    if (kind === 'returned') f.verdict({ returned: true });
    if (kind === 'unknown') f.verdict({ eligible: false });
    if (kind === 'active') f.setState({ leaseUntil: Date.now() + 90000 });
    if (kind === 'recent') f.setRow({ metadata: { at: Date.now() } });
    if (kind === 'wrong-branch') f.deps.lookupAccess = async () => ({ verified: true, site: 'KH2' });
    const out = await f.call(); expect(out.body.restartToken).toBeUndefined(); expect(f.store.set).not.toHaveBeenCalled();
});
it('គ្មានអាយុ server ត្រូវ quarantine មិនទុកចិត្ត timestamp ពី client', async () => {
    const f = fixture(); f.setRow({ metadata: undefined }); const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
        const wait = await f.call({ restartAt: 1 }); expect(wait.body.code).toBe('ZTO_PALM_SIGN_RESTART_WAIT');
        expect(wait.body.retryAfterMs).toBeGreaterThan(0); expect(wait.body.restartToken).toBeUndefined();
        clock.mockReturnValue(now + wait.body.retryAfterMs + 1); await challenge(f);
    } finally { clock.mockRestore(); }
});
it.each(['etag', 'owner', 'barcode', 'fingerprint', 'expired', 'signed-now', 'returned-now'])('challenge ប្រែ %s មិនផ្ទេរសំណើ', async kind => {
    const f = fixture(); const restartToken = await challenge(f); const patch: any = { stage: 'receipt-restart-confirm', restartToken, restartConsent: true };
    if (kind === 'etag') f.setRow({ etag: 'another-writer' });
    if (kind === 'owner') f.setState({ owner: 'another-owner' });
    if (kind === 'barcode') patch.barcode = '77130538161029';
    if (kind === 'fingerprint') patch.originalFingerprint = 'd'.repeat(64);
    if (kind === 'signed-now') f.verdict({ signed: true });
    if (kind === 'returned-now') f.verdict({ returned: true });
    const clock = kind === 'expired' ? vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000) : null;
    try { const out = await f.call(patch); expect(out.body.restarted).not.toBe(true); expect(f.store.set).not.toHaveBeenCalled(); }
    finally { clock?.mockRestore(); }
});
it('CAS ប្រជែង winner មួយ និង ACK បាត់អាចផ្ទៀងតែសំណើដដែល', async () => {
    const f = fixture(); const token = await challenge(f);
    const patch = { stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true };
    const results = await Promise.all([f.call(patch), f.call(patch)]);
    expect(results.some(out => out.body.restarted === true)).toBe(true);
    const state = f.row().data; const replay = await f.call(patch);
    expect(replay.body.restarted).toBe(true); expect(f.row().data).toBe(state);
    const old = await f.call({ stage: 'receipt-status', requestId: JSON.parse(state).restartAudit.predecessor.requestId });
    expect(old.body.reason).toBe('different_request'); expect(f.row().data).toBe(state);
});


it.each(['duplicate', 'malformed', 'empty', 'returned', 'sent-out', 'other-branch', 'unknown-sign'])('tracking source ពិតមិន restart lifecycle %s', async kind => {
    const f = fixture();
    const file = require.resolve('../netlify/functions/_shared/zto-palm.js');
    const module = { exports: {} as any };
    new Function('require', 'module', 'exports', readFileSync(file, 'utf8') + '\nmodule.exports.restartTest = { trackingVerdict, trackingStamp };')(createRequire(file), module, module.exports);
    const actual = module.exports.restartTest;
    f.proof.verdict = (body: any) => actual.trackingVerdict(body, code, f.session.site);
    f.proof.stamp = actual.trackingStamp;
    const tracks = [
        { mailNo: code, siteCode: f.session.site, time: '2026-10-25 10:00:00', action: '3' },
        { mailNo: code, siteCode: f.session.site, time: '2026-10-25 11:00:00', action: '4' }
    ];
    const row = { mail: { mailNo: code, isSign: kind === 'unknown-sign' ? 2 : 0 }, tracks };
    if (kind === 'malformed') tracks[0].time = 'invalid';
    if (kind === 'empty') row.tracks = [];
    if (kind === 'other-branch') tracks.forEach(track => { track.siteCode = 'KH2'; });
    if (kind === 'returned' || kind === 'sent-out') tracks.push({ mailNo: code, siteCode: f.session.site,
        time: '2026-10-25 12:00:00', action: kind === 'returned' ? '-710' : '2' });
    f.request.mockImplementation(async () => ({ status: true, result: kind === 'duplicate' ? [row, row] : [row] }));
    const out = await f.call(); expect(out.body.restartToken).toBeUndefined(); expect(f.store.set).not.toHaveBeenCalled();
});
it('quarantine អានម្ដងទៀតមិនកំណត់អាយុឡើងវិញ ទោះ metadata បាត់', async () => {
    const f = fixture(); f.setRow({ metadata: undefined }); const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
        const wait = await f.call(); const state = f.row().data;
        f.setRow({ metadata: undefined }); clock.mockReturnValue(now + 1000);
        const again = await f.call(); expect(again.body.retryAfterMs).toBe(wait.body.retryAfterMs - 1000);
        expect(f.row().data).toBe(state); expect(f.store.set).toHaveBeenCalledOnce();
        clock.mockReturnValue(now + wait.body.retryAfterMs); await challenge(f);
    } finally { clock.mockRestore(); }
});
it('old sender រូបអាចទៅដល់ក្រោយ fence ប៉ុន្តែ CAS រារាំង05 និងមិនសរសេរជាន់ generation ថ្មី', async () => {
    const f = fixture(); const oldJournal = require('./fixtures/palm-sign-journal-before-reservation.cjs');
    const photo = Buffer.from('synthetic-old-image').toString('base64'); const requestId = randomUUID();
    const input = { barcode: code, requestId, stage: 'receipt', signMan: 'old', photo,
        originalSHA256: createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex'), photoProtocol: 'original-sha256-v1' };
    f.setState({ requestId, fingerprint: createHash('sha256').update(JSON.stringify([code, requestId, input.signMan, photo])).digest('hex'),
        originalSHA256: input.originalSHA256, photoProtocol: input.photoProtocol });
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    let started = false, uploaded = false, signed = false;
    const old = oldJournal.withSignJournal(input, f.session, f.deps, f.proof, async (hooks: any) => {
        started = true; await gate; uploaded = true; await hooks.photo(); await hooks.sending(); signed = true;
        return { statusCode: 200, body: '{}' };
    }, async () => { throw Error('unexpected old status'); }, async () => false);
    await vi.waitFor(() => expect(started).toBe(true));
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 900001);
    try {
        const restartToken = await challenge(f);
        const restart = await f.call({ stage: 'receipt-restart-confirm', restartToken, restartConsent: true });
        expect(restart.body.restarted).toBe(true); const current = f.row().data;
        release(); await old;
        expect(uploaded).toBe(true); expect(signed).toBe(false); expect(f.row().data).toBe(current);
    } finally { release(); await old; clock.mockRestore(); }
});
it('restart ACK បាត់៖ check បន្ទាប់បាន capability ដដែលដោយមិនផ្ទេរជំនាន់ម្ដងទៀត', async () => {
    const f = fixture(); const token = await challenge(f); const write = f.store.set.getMockImplementation()!;
    f.store.set.mockImplementation(async (...args) => { await write(...args); throw Error('synthetic lost write ACK'); });
    const out = await f.call({ stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true });
    expect(out.body.restarted).not.toBe(true); const state = f.row().data;
    f.store.set.mockImplementation(write);
    const checked = await f.call(); expect(checked.body.restarted).toBe(true);
    expect(f.row().data).toBe(state); expect(f.store.set).toHaveBeenCalledOnce();
});

it.each(['reservation-v1:sending', 'reservation-v1:photo', 'reservation-v1:image-sending'])('សំណើចាស់ %s restart រក្សាភស្តុតាងរូបចាស់ មិនអះអាងថាថ្មីបានទៅដល់', async phase => {
    const f = fixture(); f.setState({ phase, photoAccepted: phase !== 'reservation-v1:image-sending' });
    const token = await challenge(f); const out = await f.call({ stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true });
    expect(out.body.restarted).toBe(true); const state = JSON.parse(f.row().data);
    expect(state.photoAccepted).toBe(false); expect(state.restartAudit.predecessor.phase).toBe(phase);
    expect(state.restartAudit.predecessor.photoAccepted).toBe(phase !== 'reservation-v1:image-sending');
    expect(out.body.photoAccepted).toBeUndefined(); expect(out.body.photoProof).toBeUndefined();
});
it('successor restart អាច prewrite-refresh ដាច់ដោយឡែក មុនទាមទារភស្តុតាងចែកចាយថ្មី', async () => {
    const f = fixture();
    const photo = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]).toString('base64');
    const signMan = 'ថ្មី';
    f.input.originalSHA256 = createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex');
    f.input.originalFingerprint = createHash('sha256').update(JSON.stringify([code, f.input.requestId, signMan, photo])).digest('hex');
    const token = await challenge(f); const out = await f.call({ stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true });
    const before = f.row().data;
    const prewrite = await f.call({ stage: 'receipt-prewrite-refresh', photo, signMan, refreshRequestId: randomUUID(),
        reservationOwner: out.body.reservationOwner, reservationToken: out.body.reservationToken, dispatchProof: '' });
    expect(prewrite.body.code).toBe('ZTO_PALM_DISPATCH_REQUIRED');
    expect(f.row().data).toBe(before);
    expect(f.request.mock.calls.every(([path]) => path.endsWith('queryTrackInfo'))).toBe(true);
});

it('legacy store.set យឺតហួស timeout មិនអាចសរសេរជាន់ restart CAS', async () => {
    const f = fixture(); const legacy = require('./fixtures/palm-sign-journal-before-reservation.cjs');
    const oldInput = { ...f.input, requestId: randomUUID(), stage: 'receipt', signMan: 'old', photo: 'cGhvdG8=' };
    f.setState({ requestId: oldInput.requestId, originalSHA256: oldInput.originalSHA256, photoProtocol: oldInput.photoProtocol,
        fingerprint: createHash('sha256').update(JSON.stringify([code, oldInput.requestId, oldInput.signMan, oldInput.photo])).digest('hex') });
    const realSet = f.store.set.getMockImplementation()!;
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    let delayed: Promise<any> | undefined;
    f.store.set.mockImplementation((key, data, options) => {
        if (JSON.parse(data).phase === 'claimed') { delayed = gate.then(() => realSet(key, data, options)); return delayed; }
        return realSet(key, data, options);
    });
    vi.useFakeTimers();
    try {
        const run = vi.fn(async () => { throw Error('old sender must never run'); });
        const old = legacy.withSignJournal(oldInput, f.session, f.deps, f.proof, run, run, run);
        await vi.advanceTimersByTimeAsync(2501);
        expect((await old).statusCode).toBe(503); expect(run).not.toHaveBeenCalled();
        vi.setSystemTime(Date.now() + 900001);
        const token = await challenge(f);
        expect((await f.call({ stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true })).body.restarted).toBe(true);
        const current = f.row().data; release(); await delayed;
        expect(f.row().data).toBe(current); expect(run).not.toHaveBeenCalled();
    } finally { release(); await delayed; vi.useRealTimers(); }
});

it.each(['off', 'shadow', 'require-matching'])('restart គោរព auth mode ដូច Sign ធម្មតា %s', async mode => {
    const f = fixture();
    f.deps.lookupAccess = async () => (mode === 'off' ? null : mode === 'shadow' ? { verified: false, site: '' }
        : { verified: true, site: f.session.site }) as any;
    await challenge(f);
    expect(f.store.set).not.toHaveBeenCalled();
});
it.each([401, 503])('require identity បដិសេធ %s រក្សាចម្លើយដើម មិនចូល restart store ឬ upstream', async statusCode => {
    const f = fixture(); const response = { statusCode, body: JSON.stringify({ code: statusCode === 401 ? 'ZTO_IDENTITY_REQUIRED' : 'ZTO_IDENTITY_UNAVAILABLE' }) };
    f.deps.lookupAccess = async () => ({ response }) as any;
    const out = await f.call(); expect(out.status).toBe(statusCode); expect(out.body).toEqual(JSON.parse(response.body));
    expect(f.store.getWithMetadata).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
});
it.each(['key', 'site'])('challenge មិនផ្ទេរទៅ scope %s ផ្សេង', async kind => {
    const f = fixture(); const token = await challenge(f);
    if (kind === 'key') f.deps.keyLabel = 'other-label'; else f.session.site = 'KH2';
    const out = await f.call({ stage: 'receipt-restart-confirm', restartToken: token, restartConsent: true });
    expect(out.body.restarted).not.toBe(true); expect(f.store.set).not.toHaveBeenCalled();
});
