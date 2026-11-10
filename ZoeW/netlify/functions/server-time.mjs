const ALLOWED_ORIGINS = new Set([
    'https://zoew.netlify.app',
    'https://zoekeygen.netlify.app',
    'https://localhost'
]);

export default function serverTime(request) {
    const origin = request.headers.get('Origin');
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
        'Netlify-CDN-Cache-Control': 'no-store',
        Vary: 'Origin',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff'
    };
    const ownPreview = origin !== null && /^https:\/\/deploy-preview-[1-9]\d*--(?:zoew|zoekeygen)\.netlify\.app$/.test(origin)
        && origin === new URL(request.url).origin;
    if (origin !== null && !ALLOWED_ORIGINS.has(origin) && !ownPreview) {
        return new Response('{}', { status: 403, headers });
    }
    if (origin !== null) headers['Access-Control-Allow-Origin'] = origin;
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
