export const CODE = '77130500000012';
export const PHOTO = '/9j/AAECAwQF/9k=';

const response = (result, status = true) => Response.json({ status, result });

export function createNetwork() {
    const rows = new Map();
    const calls = [];
    const state = {
        conflict: false,
        staleCached: true,
        omitETag: false,
        warning: true,
        signed: false,
        revision: 0
    };
    async function fetch(input, init) {
        const request = input instanceof Request && init === undefined ? input : new Request(input, init);
        const url = new URL(request.url);
        const method = request.method.toUpperCase();
        const body = request.body ? await request.text() : '';
        const call = {
            url: url.href,
            host: url.hostname,
            path: url.pathname,
            method,
            body,
            headers: Object.fromEntries(request.headers),
            journal: url.pathname.includes('/palm-sign-v1/'),
            status: undefined
        };
        calls.push(call);
        const finish = (result) => { call.status = result.status; return result; };
        if (url.hostname === 'cached.blobs.invalid' || url.hostname === 'strong.blobs.invalid') {
            if (!/^\/(?:region:[^/]+\/)?[^/]+\/site:zto-auth\/.+/.test(url.pathname) || url.search || url.port) {
                throw new Error('សំណើ Blobs ក្លែងមានផ្លូវខុស៖ ' + url.href);
            }
            const key = url.pathname;
            call.key = key;
            const current = rows.get(key);
            if (method === 'GET' || method === 'HEAD') {
                if (!current || call.journal && state.staleCached && url.hostname === 'cached.blobs.invalid') {
                    return finish(new Response(null, { status: 404 }));
                }
                const headers = { etag: current.etag, 'x-amz-meta-user': current.metadata };
                if (request.headers.get('if-none-match') === current.etag) return finish(new Response(null, { status: 304, headers }));
                return finish(new Response(method === 'HEAD' ? null : current.data, { headers }));
            }
            if (method === 'PUT') {
                const ifMatch = request.headers.get('if-match');
                const ifNoneMatch = request.headers.get('if-none-match');
                if (call.journal && state.conflict || ifMatch && current?.etag !== ifMatch || ifNoneMatch === '*' && current) {
                    return finish(new Response(null, { status: 412 }));
                }
                const etag = '"revision-' + (++state.revision) + '"';
                rows.set(key, { data: body, etag, metadata: request.headers.get('x-amz-meta-user') || 'b64;e30=' });
                return finish(new Response(null, { status: 200, headers: state.omitETag ? {} : { etag } }));
            }
            if (method === 'DELETE') {
                rows.delete(key);
                return finish(new Response(null, { status: 204 }));
            }
            throw new Error('សំណើ Blobs ក្លែងមាន method ខុស៖ ' + method);
        }
        if (url.hostname !== 'aargus-api.ztoglobal.net' || method !== 'POST' || url.search || url.port) {
            throw new Error('បដិសេធសំណើបណ្ដាញដែលមិនស្គាល់៖ ' + method + ' ' + url.href);
        }
        const payload = body ? JSON.parse(body) : {};
        call.payload = payload;
        switch (url.pathname) {
            case '/zto/system/v1/doLogin':
                return finish(response({ token: 'artifact-palm-token', countryCode: 'KH', siteCode: 'KH001', siteName: 'សាខាសាកល្បង' }));
            case '/zto/locus/v1/queryTrackInfo':
                return finish(response([{ mail: { mailNo: CODE, isSign: state.signed ? 1 : 0 }, tracks: [
                    { mailNo: CODE, action: '4', time: '2026-10-17 09:00:00', siteCode: 'KH001' },
                    ...(state.signed ? [{ mailNo: CODE, action: '5', time: '2026-10-17 10:00:00', siteCode: 'KH001' }] : [])
                ] }]));
            case '/zto/collect/v1/queryPreOrderByBillCode':
                return finish(response({ billCode: CODE, consigneeName: 'សុខា', agentAmount: 10, fcAmount: 2 }));
            case '/zto/basic/v2/newBusinessCheck':
                return finish(response(state.warning && payload.scanType === 5 ? { message: 'សូមបញ្ជាក់កញ្ចប់មានបញ្ហា', whetherForce: false } : null));
            case '/zto/sign/log/v1/add':
                return finish(response('artifact-log-id'));
            case '/zto/basic/v1/saveBillPic':
                return finish(response(null));
            case '/zto/basic/v1/saveScanInfo':
                if (!Array.isArray(payload) || payload.length !== 1 || payload[0].billCode !== CODE || !['04', '05'].includes(payload[0].scanTypeCode)) {
                    throw new Error('សំណើស្កេនក្លែងមានទិន្នន័យខុស');
                }
                if (payload[0].scanTypeCode === '05') state.signed = true;
                return finish(response([]));
            case '/zto/sign/log/v1/deleteByBillCode':
                return finish(response(null));
            case '/zto/picture/v1/querySignPic':
                return finish(response([]));
            default:
                throw new Error('បដិសេធផ្លូវ ZTO ដែលមិនស្គាល់៖ ' + url.pathname);
        }
    }
    return { fetch, rows, calls, state };
}
