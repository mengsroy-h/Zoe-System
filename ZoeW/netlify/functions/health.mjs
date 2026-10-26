export default function health(request) {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
    if (request.method !== 'GET') return new Response('{}', { status: 405, headers });
    const nonce = new URL(request.url).searchParams.get('nonce');
    if (!/^[a-f0-9]{32}$/.test(nonce || '')) return new Response('{}', { status: 400, headers });
    return new Response(JSON.stringify({ nonce }), { headers });
}
