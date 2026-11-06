export default function serverTime(request) {
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
        'Netlify-CDN-Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff'
    };
    if (request.method !== 'GET') {
        return new Response('{}', { status: 405, headers: { ...headers, Allow: 'GET' } });
    }
    const params = new URL(request.url).searchParams;
    const nonce = params.get('nonce');
    if (params.getAll('nonce').length !== 1 || !/^[a-f0-9]{32}$/.test(nonce || '')) {
        return new Response('{}', { status: 400, headers });
    }
    return new Response(JSON.stringify({ now: Date.now(), nonce }), { headers });
}
