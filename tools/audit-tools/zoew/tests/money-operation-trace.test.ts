import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const trace = (ctx: any) => require('../../money-operation-trace.js').installMoneyTransportTrace(ctx);
const ctx = () => Object.assign(new EventEmitter(), { pages: () => [] });
const request = (path = 'zoew_daily_pickup_cod_dod/2026-11-08') => ({
    url: () => 'http://127.0.0.1:9000/' + path + '.json?ns=demo-test&auth=DO_NOT_RECORD',
    method: () => 'GET', failure: () => ({ errorText: 'net::ERR_INTERNET_DISCONNECTED' })
});
const newSocket = () => Object.assign(new EventEmitter(), { url: () => 'ws://127.0.0.1:9000/.ws?auth=SECRET' });
function wire(context: any) { const page = new EventEmitter(), socket = newSocket(); context.emit('page', page); page.emit('websocket', socket); return socket; }
const send = (socket: any, r: number, path: string, value: any) => socket.emit('framesent', { payload: JSON.stringify({ t: 'd', d: { r, a: 'p', b: { p: '/' + path, d: value } } }) });
const ack = (socket: any, r: number, status = 'ok') => socket.emit('framereceived', { payload: JSON.stringify({ t: 'd', d: { r, b: { s: status, d: 'PRIVATE_BODY' } } }) });
const fixtureId = 'sheet_flow_firebase_0_1';
const fixtureHistory = 'zoew_scan_history_cod_dod/' + fixtureId;
const fixtureTrash = 'zoew_recently_deleted_cod_dod/' + fixtureId;
const fixtureRow = (token = 'PRIVATE_CLAIM') => ({ phone: 'PRIVATE_PHONE', barcodes: [{ code: '900000000001201', trashClaim: token, cod: 10 }] });
const frame = (socket: any, direction: 'framesent' | 'framereceived', data: any) => socket.emit(direction, { payload: JSON.stringify({ t: 'd', d: data }) });

it('ភ្ជាប់ action និង CAS hash ទៅសំណើនិង ACK របស់ជួរដែលវាស់ ដោយមិនរក្សាតម្លៃដើម', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    frame(socket, 'framesent', { r: 1, a: 'p', b: { p: '/' + fixtureHistory, d: fixtureRow(), h: 'PRIVATE_BASE_HASH' } }); ack(socket, 1, 'datastale');
    frame(socket, 'framesent', { r: 2, a: 'p', b: { p: '/' + fixtureHistory, d: null, h: '' } }); ack(socket, 2);
    send(socket, 3, fixtureTrash, fixtureRow()); ack(socket, 3);
    const [proposal, stale, deletion, deleted, trash, trashed] = recorder.snapshot().events;
    expect(proposal).toMatchObject({ action: 'p', casHashPresent: true, casHashEmpty: false, baseHashDigest: expect.stringMatching(/^[a-f0-9]{32}$/),
        fixtureOperations: [{ path: fixtureHistory, shape: { kind: 'object' }, valueDigest: expect.stringMatching(/^[a-f0-9]{32}$/), claimAliases: [expect.stringMatching(/^claim-[a-f0-9]{32}$/)] }] });
    expect(stale).toMatchObject({ phase: 'ws-ack', request: 1, socket: proposal.socket, status: 'datastale', baseHashDigest: proposal.baseHashDigest, fixtureOperations: proposal.fixtureOperations });
    expect(deletion).toMatchObject({ action: 'p', casHashPresent: true, casHashEmpty: true, baseHashDigest: expect.stringMatching(/^[a-f0-9]{32}$/), fixtureOperations: [{ shape: { kind: 'null' }, claimAliases: [] }] });
    expect(deletion.baseHashDigest).not.toBe(proposal.baseHashDigest);
    expect(deleted).toMatchObject({ status: 'ok', fixtureOperations: deletion.fixtureOperations });
    expect(trash).toMatchObject({ casHashPresent: false, casHashEmpty: false, baseHashDigest: null });
    expect(trashed).toMatchObject({ request: 3, status: 'ok', fixtureOperations: trash.fixtureOperations });
    expect(recorder.snapshot().websocketBoundary).toBe('server-wire-not-app-settlement');
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/PRIVATE|900000000001201|"cod":|"phone":|"trashClaim":/);
});
it('ចាប់ server push ដែលគ្មានលេខសំណើ ហើយប្រៀបធៀប digest និង alias ជាមួយសំណើឆ្លង context', () => {
    const a = ctx(), b = ctx(), ra = trace(a), rb = trace(b), sa = wire(a), sb = wire(b), row = fixtureRow();
    send(sa, 11, fixtureHistory, row);
    frame(sb, 'framereceived', { a: 'd', b: { p: '/' + fixtureHistory, d: { barcodes: row.barcodes, phone: row.phone } } });
    frame(sb, 'framereceived', { a: 'd', b: { p: '/' + fixtureHistory, d: null } });
    const proposal = ra.snapshot().events[0].fixtureOperations?.[0], [push, deletion] = rb.snapshot().events;
    expect(push).toMatchObject({ phase: 'ws-push', action: 'd', socket: 1, fixtureOperations: [{ path: fixtureHistory, valueDigest: proposal?.valueDigest, claimAliases: proposal?.claimAliases }] });
    expect(push).not.toHaveProperty('request'); expect(push).not.toHaveProperty('status');
    expect(deletion.fixtureOperations[0]).toMatchObject({ shape: { kind: 'null' }, claimAliases: [] });
    expect(deletion.fixtureOperations[0].valueDigest).not.toBe(proposal.valueDigest);
    expect(rb.snapshot().pendingRequests).toBe(0);
});
it('បំបែក p និង m រួមទាំងផ្លូវមេនិងផ្លូវរង ដោយកំណត់ព័ត៌មានលម្អិតត្រឹមជួរគោលដៅ', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context), row = fixtureRow();
    frame(socket, 'framesent', { r: 1, a: 'm', b: { p: '/', d: { [fixtureHistory]: row, 'zoew_scan_history_cod_dod/other': fixtureRow('OTHER_CLAIM') } } });
    frame(socket, 'framereceived', { a: 'd', b: { p: '/zoew_scan_history_cod_dod', d: { [fixtureId]: row, other: fixtureRow('OTHER_CLAIM') } } });
    frame(socket, 'framereceived', { a: 'm', b: { p: '/zoew_scan_history_cod_dod', d: { [fixtureId + '/barcodes/0/trashClaim']: 'PRIVATE_CLAIM', 'other/barcodes/0/trashClaim': 'OTHER_CLAIM' } } });
    frame(socket, 'framesent', { r: 2, a: 'm', b: { p: '/' + fixtureHistory, d: { 'barcodes/0/trashClaim': 'PRIVATE_CLAIM' } } });
    const [write, full, push, patch] = recorder.snapshot().events;
    expect(write).toMatchObject({ action: 'm', casHashPresent: false, fixtureOperations: [{ path: fixtureHistory }] });
    expect(write.fixtureOperations).toHaveLength(1);
    expect(full.fixtureOperations).toEqual(write.fixtureOperations);
    expect(push).toMatchObject({ phase: 'ws-push', action: 'm', fixtureOperations: [{ path: fixtureHistory + '/barcodes/0/trashClaim', claimAliases: write.fixtureOperations[0].claimAliases }] });
    expect(patch.fixtureOperations).toEqual(push.fixtureOperations);
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/PRIVATE|OTHER_CLAIM/);
});
it('មិនបង្កើតភាពអវត្តមានពី merge របស់ជួរផ្សេង ហើយមិនអាន credential ជាទិន្នន័យ fixture', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    frame(socket, 'framesent', { r: 1, a: 'auth', b: { cred: 'PRIVATE_CREDENTIAL', p: '/' + fixtureHistory, d: fixtureRow(), h: 'PRIVATE_HASH' } });
    frame(socket, 'framesent', { r: 2, a: 'p', b: { p: '/zoew_scan_history_cod_dod/other', d: fixtureRow(), h: 'PRIVATE_HASH' } }); ack(socket, 2);
    for (const action of ['d', 'm']) frame(socket, 'framereceived', { a: action, b: { p: '/zoew_scan_history_cod_dod/other', d: fixtureRow() } });
    frame(socket, 'framereceived', { a: 'm', b: { p: '/zoew_scan_history_cod_dod', d: { other: fixtureRow() } } });
    const result = recorder.snapshot(); expect(result.events).toHaveLength(2);
    for (const event of result.events) { expect(event).not.toHaveProperty('fixtureOperations'); expect(event).not.toHaveProperty('baseHashDigest'); }
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|900000000001201|valueDigest|claimAliases/);
});
it('រំលង merge ខូចនិង body បាត់ ដោយមិនបម្លែងវាជាការលុបជួរ ឬស្នើ ACK', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    for (const value of [undefined, null, 1, false, 'PRIVATE', []]) {
        frame(socket, 'framesent', { r: 1, a: 'm', b: { p: '/' + fixtureHistory, d: value } });
        frame(socket, 'framereceived', { a: 'm', b: { p: '/' + fixtureHistory, d: value } });
    }
    frame(socket, 'framesent', { r: 2, a: 'p', b: { p: '/' + fixtureHistory } });
    frame(socket, 'framereceived', { a: 'd', b: { p: '/' + fixtureHistory } });
    ack(socket, 1); ack(socket, 2);
    expect(recorder.snapshot()).toMatchObject({ events: [], pendingRequests: 0, diagnosticErrors: 0 });
});
it('server snapshot ពេញលេញរក្សាភាពអវត្តមាននៃជួរគោលដៅ ប៉ុន្តែ merge មិនលុបស្ថានភាពដោយសន្និដ្ឋាន', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    frame(socket, 'framereceived', { a: 'm', b: { p: '/zoew_scan_history_cod_dod', d: {} } });
    expect(recorder.snapshot().events).toEqual([]);
    frame(socket, 'framereceived', { a: 'd', b: { p: '/zoew_scan_history_cod_dod', d: { other: fixtureRow() } } });
    expect(recorder.snapshot().events).toMatchObject([{ phase: 'ws-push', fixtureOperations: [{ path: fixtureHistory, shape: { kind: 'null' }, claimAliases: [] }] }]);
});
it('query មាន tag មិនបញ្ជាក់ថាជួរបាត់ពី server ទាំងមូល ហើយដានមិនរក្សា tag ដើម', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    frame(socket, 'framereceived', { a: 'd', b: { p: '/zoew_scan_history_cod_dod', d: { other: fixtureRow() }, t: 'PRIVATE_TAG' } });
    expect(recorder.snapshot().events).toEqual([]);
    frame(socket, 'framereceived', { a: 'd', b: { p: '/zoew_scan_history_cod_dod', d: { [fixtureId]: fixtureRow() }, t: 7 } });
    frame(socket, 'framereceived', { a: 'd', b: { p: '/' + fixtureHistory, d: null, t: 7 } });
    frame(socket, 'framereceived', { a: 'd', b: { p: '/' + fixtureHistory, d: null } });
    expect(recorder.snapshot().events.map((event: any) => event.queryTagged)).toEqual([true, true, false]);
    expect(recorder.snapshot().events[1].fixtureOperations[0]).toMatchObject({ shape: { kind: 'null' } });
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/PRIVATE|"tag":|"t":/);
});
it('ផ្លូវឫសប្រៀបធៀបប្រវត្តិនិងធុងសំរាមដាច់ដោយឡែក ហើយ alias បែងចែក token ផ្សេង', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context), root = {
        zoew_scan_history_cod_dod: { [fixtureId]: fixtureRow('PRIVATE_A'), other: fixtureRow('PRIVATE_OTHER') },
        zoew_recently_deleted_cod_dod: { [fixtureId]: fixtureRow('PRIVATE_B') },
        credentials: { token: 'PRIVATE_CREDENTIAL' }
    };
    frame(socket, 'framesent', { r: 1, a: 'p', b: { p: '/', d: root } });
    frame(socket, 'framereceived', { a: 'd', b: { p: '/', d: root } });
    frame(socket, 'framereceived', { a: 'd', b: { p: '/', d: null } });
    const [write, push, empty] = recorder.snapshot().events;
    expect(write.fixtureOperations.map((op: any) => op.path)).toEqual([fixtureHistory, fixtureTrash]);
    expect(push.fixtureOperations).toEqual(write.fixtureOperations);
    expect(write.fixtureOperations[0].claimAliases[0]).not.toBe(write.fixtureOperations[1].claimAliases[0]);
    expect(empty.fixtureOperations).toHaveLength(2);
    for (const op of empty.fixtureOperations) expect(op).toMatchObject({ shape: { kind: 'null' }, claimAliases: [] });
    expect(recorder.snapshot().digestScope).toBe('node-process');
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/PRIVATE|credentials/);
});
it('កំណត់ដានថ្មីតាមចំនួនព្រឹត្តិការណ៍ ផ្លូវនិង claim ហើយរាយការណ៍ការកាត់', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context), values: Record<string, any> = {};
    for (let i = 0; i < 20; i++) values[fixtureHistory + '/barcodes/' + i + '/trashClaim'] = 'PRIVATE_' + i;
    frame(socket, 'framereceived', { a: 'm', b: { p: '/', d: values } });
    expect(recorder.snapshot().events[0]).toMatchObject({ truncatedFixtureOperations: 4 });
    expect(recorder.snapshot().events[0].fixtureOperations).toHaveLength(16);
    send(socket, 1, fixtureHistory, { barcodes: Array.from({ length: 20 }, (_, i) => ({ trashClaim: 'PRIVATE_' + i })) });
    expect(recorder.snapshot().events[1].fixtureOperations[0]).toMatchObject({ truncatedClaims: 4 });
    expect(recorder.snapshot().events[1].fixtureOperations[0].claimAliases).toHaveLength(16);
    for (let i = 0; i < 400; i++) frame(socket, 'framereceived', { a: 'd', b: { p: '/' + fixtureHistory, d: null } });
    expect(recorder.snapshot()).toMatchObject({ limit: 256, droppedEvents: 146 });
    expect(recorder.snapshot().events).toHaveLength(256);
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/PRIVATE/);
});
it('មិនភ្ជាប់ ACK ទៅសំណើដែលលេខបាត់ ស្ទួន ឬត្រូវបានប្រើសម្រាប់ credential', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    frame(socket, 'framesent', { a: 'p', b: { p: '/' + fixtureHistory, d: null } }); ack(socket, 0);
    send(socket, 7, fixtureHistory, fixtureRow()); send(socket, 7, fixtureHistory, null); ack(socket, 7); ack(socket, 7);
    send(socket, 8, fixtureHistory, null); frame(socket, 'framesent', { r: 8, a: 'auth', b: { cred: 'PRIVATE_CREDENTIAL' } }); ack(socket, 8);
    const result = recorder.snapshot(), acks = result.events.filter((e: any) => e.phase === 'ws-ack');
    expect(result.events[0]).toMatchObject({ phase: 'ws-write', request: null, correlation: 'missing-id' });
    expect(acks).toHaveLength(2);
    for (const event of acks) { expect(event).toMatchObject({ status: 'ok', correlation: 'duplicate-id' }); expect(event).not.toHaveProperty('fixtureOperations'); expect(event).not.toHaveProperty('operations'); }
    expect(result).toMatchObject({ pendingRequests: 0, duplicateRequestIds: 2, missingRequestIds: 1 });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE/);
});
it('ការសង្កេត frame រក្សា payload អ្នកស្តាប់ callback និង promise ដើម ទោះ JSON ខូច', async () => {
    const context = ctx(), socket = wire(context), otherPage = new EventEmitter();
    context.pages = () => [otherPage];
    let resolve!: (value: string) => void;
    const promise = new Promise<string>(yes => { resolve = yes; }), callback = vi.fn((_event: { payload: string | Buffer }) => promise);
    socket.on('framesent', callback);
    const recorder = trace(context); otherPage.emit('websocket', socket);
    const payload = Buffer.from(JSON.stringify({ t: 'd', d: { r: 1, a: 'p', b: { p: '/' + fixtureHistory, d: fixtureRow() } } })), before = Buffer.from(payload), event = Object.freeze({ payload });
    socket.emit('framesent', event);
    expect(callback.mock.calls[0][0]).toBe(event); expect(callback.mock.results[0].value).toBe(promise);
    expect(payload).toEqual(before); expect(socket.listeners('framesent')[0]).toBe(callback);
    expect(recorder.snapshot().events[0]).toHaveProperty('fixtureOperations');
    socket.emit('framesent', Object.freeze({ payload: '{invalid' })); expect(callback).toHaveBeenCalledTimes(2);
    expect(recorder.snapshot().unparsedFrames).toBe(1);
    resolve('done'); await expect(promise).resolves.toBe('done');
});

it('សង្កេតវដ្ត HTTP ដោយមិនរក្សាប៉ារ៉ាម៉ែត្រ URL ព័ត៌មានសម្ងាត់ ឬតួសំណើ', () => {
    const context = ctx(), recorder = trace(context), req = request();
    context.emit('request', req); context.emit('response', { request: () => req, status: () => 403 });
    const result = recorder.snapshot(); expect(result.available).toBe(true);
    expect(result.events.map((e: any) => e.phase)).toEqual(['http-start', 'http-response']);
    expect(result.events[0]).toMatchObject({ path: 'zoew_daily_pickup_cod_dod/2026-11-08', method: 'GET' });
    expect(result.events[1]).toMatchObject({ request: result.events[0].request, status: 403 });
    expect(JSON.stringify(result)).not.toMatch(/DO_NOT_RECORD|auth=|demo-test|PRIVATE_BODY|https?:/);
});
it('កត់ការបដិសេធបណ្តាញតាមប្រភេទកំណត់ ដោយមិនចម្លងសារកំហុសសេរី', () => {
    const context = ctx(), recorder = trace(context), first = request(), second = request();
    context.emit('request', first); context.emit('requestfailed', first);
    second.failure = () => ({ errorText: 'https://host/?token=SECRET custom error' }); context.emit('request', second); context.emit('requestfailed', second);
    expect(recorder.snapshot().events.filter((e: any) => e.phase === 'http-failed').map((e: any) => e.failure)).toEqual(['net::ERR_INTERNET_DISCONNECTED', 'request-failed']);
    expect(JSON.stringify(recorder.snapshot())).not.toContain('SECRET');
});
it('សារបដិសេធបណ្តាញដែលវែងពេកត្រូវបង្រួមជាប្រភេទកំណត់', () => {
    const context = ctx(), recorder = trace(context), req = request();
    req.failure = () => ({ errorText: 'net::' + 'A'.repeat(100000) });
    context.emit('request', req); context.emit('requestfailed', req);
    expect(recorder.snapshot().events.at(-1).failure).toBe('request-failed');
    expect(JSON.stringify(recorder.snapshot()).length).toBeLessThan(2048);
});
it('រំលង URL មិនពាក់ព័ន្ធ ហើយមិនអានបឋមកថា ឬតួសំណើ', () => {
    const context = ctx(), recorder = trace(context);
    const req = { url: () => 'https://identitytoolkit.googleapis.com/accounts?key=SECRET', method: () => 'POST', postData: vi.fn(), headers: vi.fn() };
    context.emit('request', req); context.emit('response', { request: () => req, status: () => 200 });
    expect(recorder.snapshot().events).toEqual([]); expect(req.headers).not.toHaveBeenCalled(); expect(req.postData).not.toHaveBeenCalled();
});
it('កត់ព្រំដែនការកាន់សិទ្ធិ ការលុប និង ACK ដោយមិនរក្សា token ឬទិន្នន័យកញ្ចប់', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    send(socket, 1, 'zoew_scan_history_cod_dod/row', { phone: 'PRIVATE_PHONE', barcodes: [{ code: 'PRIVATE_CODE', trashClaim: 'SECRET_CLAIM', cod: 10 }] }); ack(socket, 1);
    send(socket, 2, 'zoew_scan_history_cod_dod/row', null); ack(socket, 2);
    const events = recorder.snapshot().events;
    expect(events.map((e: any) => e.phase)).toEqual(['ws-write', 'ws-ack', 'ws-write', 'ws-ack']);
    expect(events[0].operations[0]).toMatchObject({ path: 'zoew_scan_history_cod_dod/row', shape: { kind: 'object', barcodes: 1, claimed: 1 } });
    expect(events[2].operations[0]).toMatchObject({ path: 'zoew_scan_history_cod_dod/row', shape: { kind: 'null' } });
    expect(events[1]).toMatchObject({ request: 1, status: 'ok', socket: events[0].socket });
    expect(JSON.stringify(recorder.snapshot())).not.toMatch(/PRIVATE|SECRET|"cod":|"phone":/);
});
it('មិនភ្ជាប់លេខសំណើ Firebase ដែលប្រើឡើងវិញទៅ socket ផ្សេង', () => {
    const context = ctx(), recorder = trace(context), a = wire(context), b = wire(context);
    send(a, 7, 'zoew_scan_history_cod_dod/a', null); send(b, 7, 'zoew_scan_history_cod_dod/b', null); ack(b, 7, 'permission_denied'); ack(a, 7);
    const events = recorder.snapshot().events;
    expect(events[2]).toMatchObject({ socket: events[1].socket, status: 'permission_denied', operations: [{ path: 'zoew_scan_history_cod_dod/b' }] });
    expect(events[3]).toMatchObject({ socket: events[0].socket, status: 'ok', operations: [{ path: 'zoew_scan_history_cod_dod/a' }] });
});
it('បែងចែកការលុបប្រវត្តិ ការបដិសេធសរសេរធុងសំរាម និងការស្តារប្រវត្តិវិញ', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    send(socket, 1, 'zoew_scan_history_cod_dod/row', null); ack(socket, 1);
    send(socket, 2, 'zoew_recently_deleted_cod_dod/partial', { barcodes: [{}] }); ack(socket, 2, 'permission_denied');
    send(socket, 3, 'zoew_scan_history_cod_dod/row', { barcodes: [{}] }); ack(socket, 3);
    expect(recorder.snapshot().events.filter((e: any) => e.phase === 'ws-ack').map((e: any) => [e.status, e.operations[0].shape.kind])).toEqual([['ok', 'null'], ['permission_denied', 'object'], ['ok', 'object']]);
});
it('កំណត់ចំនួនព្រឹត្តិការណ៍និងសំណើរង់ចាំ ACK ហើយរាយការណ៍ភស្តុតាងបាត់', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context);
    for (let i = 0; i < 400; i++) send(socket, i, 'zoew_scan_history_cod_dod/row', null);
    const result = recorder.snapshot(); expect(result.events).toHaveLength(256); expect(result.droppedEvents).toBe(144);
    expect(result.pendingRequests).toBeLessThanOrEqual(128); expect(result.droppedPending).toBeGreaterThan(0);
});
it('កំហុសរោគវិនិច្ឆ័យ និង frame ខូចឬធំពេក មិនរំខានអ្នកសង្កេតផ្សេង', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context), observer = vi.fn(); socket.on('framesent', observer);
    expect(() => context.emit('request', { url() { throw new Error('SECRET_READER_FAILURE'); } })).not.toThrow();
    socket.emit('framesent', { payload: '{not-json' }); socket.emit('framesent', { payload: 'x'.repeat(1024 * 1024 + 1) });
    expect(observer).toHaveBeenCalledTimes(2); expect(recorder.snapshot().diagnosticErrors).toBeGreaterThan(0); expect(recorder.snapshot().unparsedFrames).toBeGreaterThan(0);
    expect(JSON.stringify(recorder.snapshot())).not.toContain('SECRET');
});
it('ផ្តល់ច្បាប់ចម្លងភស្តុតាងដាច់ដោយឡែក ហើយដំឡើងតែម្តងក្នុង context និងទំព័រដដែល', () => {
    const page = new EventEmitter(), context = Object.assign(new EventEmitter(), { pages: () => [page] }), recorder = trace(context);
    expect(trace(context)).toBe(recorder); context.emit('page', page);
    const socket = newSocket(); page.emit('websocket', socket); send(socket, 1, 'zoew_scan_history_cod_dod/row', null);
    const result = recorder.snapshot(); result.events[0].operations[0].path = 'changed';
    expect(recorder.snapshot().events).toHaveLength(1); expect(recorder.snapshot().events[0].operations[0].path).toBe('zoew_scan_history_cod_dod/row');
});
it('បញ្ជាក់ថា context មិនគាំទ្រការសង្កេត ជំនួសការអះអាងថាគ្មានចរាចរណ៍', () => {
    expect(trace({}).snapshot()).toMatchObject({ available: false, events: [] });
});
function pageFixture() {
    const win: any = { scanHistory: [{ id: 'row', barcodes: [{ code: 'PARCEL' }] }], deletedItems: [], navigator: { onLine: true }, isDatabaseConnected: false,
        cleanupInFlight: new Set(), connectionFlowSnapshot: () => ({ phase: 'connecting' }) };
    const { PAGE_OPS } = require('../../money-multidevice-core.js');
    runInNewContext('(' + PAGE_OPS.toString() + ')()', { window: win, console: { error: vi.fn() }, setTimeout }); return win;
}
it('កត់អត្តសញ្ញាណប្រតិបត្តិការ គោលដៅដែលជ្រើស និងស្ថានភាពភ្ជាប់តាមព្រំដែនទាំងពីរ ដោយមានកំណត់', async () => {
    const win = pageFixture();
    win.removeSingleBarcode = async (id: string, code: string) => { expect([id, code]).toEqual(['row', 'PARCEL']); win.isDatabaseConnected = true; win.connectionFlowSnapshot = () => ({ phase: 'ready' }); return 'failed'; };
    win.__startOp({ wanted: 'removeBarcode', target: { id: 'row', code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops);
    const events = win.__operationTrace().events; expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ phase: 'start', wanted: 'removeBarcode', requested: { id: 'row', code: 'PARCEL' }, selected: { id: 'row', code: 'PARCEL' }, state: { connected: false, phase: 'connecting' } });
    expect(events[1]).toMatchObject({ phase: 'end', attempt: events[0].attempt, result: 'failed', state: { connected: true, phase: 'ready' } }); expect(events[1].at).toBeGreaterThanOrEqual(events[0].at);
});
it('រក្សាការបោះកំហុសភ្លាមរបស់កម្មវិធី ទោះអ្នកអានស្ថានភាពសម្រាប់ដានបោះកំហុស', () => {
    const win = pageFixture(); win.connectionFlowSnapshot = () => { throw new Error('trace reader'); }; win.removeSingleBarcode = () => { throw new Error('application failure'); };
    expect(win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 })).toBe('threw:removeBarcode:application failure');
    expect(win.__operationTrace().events.at(-1)).toMatchObject({ phase: 'end', result: 'threw', state: { diagnosticUnavailable: true } });
    expect(win.__operationHistory()).toEqual([{ wanted: 'removeBarcode', threw: 'application failure' }]);
});
it('កំណត់និងចម្លងភស្តុតាងប្រតិបត្តិការ ដោយមិនប្តូរប្រវត្តិលទ្ធផល', async () => {
    const win = pageFixture(); win.removeSingleBarcode = async () => 'failed';
    for (let i = 0; i < 100; i++) { win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops); }
    const result = win.__operationTrace(); expect(result.events).toHaveLength(128); expect(result.droppedEvents).toBe(72);
    result.events[0].requested.code = 'changed'; expect(win.__operationTrace().events[0].requested.code).toBe('PARCEL'); expect(win.__operationHistory()).toHaveLength(100);
});
it('កត់សោជួរដែលជ្រើសពិត នៅពេលសំណើផ្តល់តែ barcode', async () => {
    const win = pageFixture(); win.cleanupInFlight.add('row'); win.removeSingleBarcode = async () => 'failed';
    win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops);
    expect(win.__operationTrace().events[0]).toMatchObject({ selected: { id: 'row', code: 'PARCEL' }, state: { cleanupHeld: true } });
});
it('កំណត់ប្រភេទតែលទ្ធផលដានថ្មី ហើយរក្សាលទ្ធផលប្រតិបត្តិការដើម', async () => {
    const win = pageFixture(), raw = 'SECRET_RESULT_' + 'x'.repeat(100000);
    win.removeSingleBarcode = async () => raw; win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops);
    expect(win.__operationHistory()[0].r).toBe(raw);
    expect(win.__operationTrace().events.at(-1).result).toBe('other');
    expect(JSON.stringify(win.__operationTrace())).not.toContain('SECRET_RESULT');
});
it('ការជ្រើសភស្តុតាងមិនអាន getter របស់អាគុយម៉ង់ពីរដង ឬប្តូរអ្នកទទួលការហៅ', async () => {
    const win = pageFixture(); let ids = 0;
    Object.defineProperty(win.scanHistory[0], 'id', { get() { ids++; return 'row'; } });
    win.removeSingleBarcode = function (this: any, id: string, code: string) { expect(this).toBe(win); expect([id, code]).toEqual(['row', 'PARCEL']); return Promise.resolve('done'); };
    win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops);
    expect(ids).toBe(1);
});
it('ស្ថានភាពរោគវិនិច្ឆ័យដែលមិនមែនតម្លៃឯក មិនបំផ្លាញការបម្លែង JSON ឬលេចធ្លាយ object សេរី', async () => {
    const win = pageFixture(); win.isDatabaseConnected = { secret: 'SECRET_STATE' }; win.connectionFlowSnapshot = () => ({ phase: 1n }); win.removeSingleBarcode = async () => 'failed';
    win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops);
    expect(() => win.__operationTrace()).not.toThrow();
    expect(JSON.stringify(win.__operationTrace())).not.toContain('SECRET_STATE');
});
it('ការដកឬបិទ socket សម្អាតតែភស្តុតាងរង់ចាំរបស់វា ហើយរាយការណ៍ការបាត់', () => {
    const context = ctx(), recorder = trace(context), sockets: any[] = [];
    for (let i = 0; i < 20; i++) { const socket = wire(context); sockets.push(socket); send(socket, 1, 'zoew_scan_history_cod_dod/row' + i, null); }
    expect(recorder.snapshot()).toMatchObject({ droppedSockets: 4, droppedPending: 4, pendingRequests: 16 });
    sockets[19].emit('close'); expect(recorder.snapshot()).toMatchObject({ droppedPending: 5, pendingRequests: 15 });
    const before = recorder.snapshot().events.length; ack(sockets[0], 1); expect(recorder.snapshot().events).toHaveLength(before);
    ack(sockets[18], 1); expect(recorder.snapshot().events.at(-1)).toMatchObject({ phase: 'ws-ack', operations: [{ path: 'zoew_scan_history_cod_dod/row18' }] });
});
it('ការសរសេរច្រើនផ្លូវរក្សាផ្លូវអនុញ្ញាតត្រឹមត្រូវ កំណត់សេចក្តីសង្ខេប និងរាយការណ៍ការកាត់', () => {
    const context = ctx(), recorder = trace(context), socket = wire(context), values: Record<string, any> = { 'unrelated/SECRET': 'SECRET' };
    for (let i = 0; i < 19; i++) values['zoew_scan_history_cod_dod/row' + i] = null;
    socket.emit('framesent', { payload: JSON.stringify({ t: 'd', d: { r: 3, a: 'm', b: { p: '/', d: values } } }) }); ack(socket, 3);
    const first = recorder.snapshot().events[0]; expect(first.operations).toHaveLength(16); expect(first.truncatedOperations).toBe(3);
    expect(first.operations[0]).toEqual({ path: 'zoew_scan_history_cod_dod/row0', shape: { kind: 'null' } });
    expect(JSON.stringify(recorder.snapshot())).not.toContain('SECRET');
});
it('promise យឺតរបស់កម្មវិធីរក្សាដានចាប់ផ្តើមរហូតដល់បញ្ចប់ពិត ដោយមិនជំនួសមុខងារកម្មវិធី', async () => {
    const win = pageFixture(); let resolve!: (value: string) => void;
    const promise = new Promise<string>(yes => { resolve = yes; }), original = vi.fn(() => promise);
    const updater = vi.fn(); win.fb = { runTransaction: updater }; win.removeSingleBarcode = original;
    win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.resolve();
    expect(win.__operationTrace().events).toHaveLength(1); expect(win.__operationHistory()).toEqual([]);
    expect(win.removeSingleBarcode).toBe(original); expect(win.fb.runTransaction).toBe(updater); expect(original.mock.results[0].value).toBe(promise);
    resolve('done'); await Promise.all(win.__ops); expect(win.__operationTrace().events.at(-1)).toMatchObject({ phase: 'end', result: 'done' });
});
it('បែងចែកការបដិសេធ promise ពីលទ្ធផល failed ហើយមិនចម្លងសារបដិសេធចូលដានថ្មី', async () => {
    const win = pageFixture(); win.removeSingleBarcode = () => Promise.reject(new Error('SECRET_REJECTION'));
    win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 }); await Promise.all(win.__ops);
    expect(win.__operationTrace().events.at(-1)).toMatchObject({ result: 'rejected' }); expect(JSON.stringify(win.__operationTrace())).not.toContain('SECRET_REJECTION');
    expect(win.__operationHistory()[0].e).toBe('SECRET_REJECTION');
});
it('networkGate ភ្ជាប់ភស្តុតាងសង្កេត ហើយមិនសម្អាតវាពេលរៀបចំឬដោះការចាក់កំហុស', async () => {
    const context: any = Object.assign(ctx(), { routeWebSocket: async () => {} });
    const { networkGate } = require('../../money-cookie-blob.js'), gate = await networkGate(context, 'firebase'), req = request();
    context.emit('request', req); context.emit('response', { request: () => req, status: () => 200 });
    gate.arm('before'); gate.release();
    expect(gate.evidence().transport).toMatchObject({ available: true, websocketBoundary: 'server-wire-not-app-settlement' });
    expect(gate.evidence().transport.events).toHaveLength(2);
});
