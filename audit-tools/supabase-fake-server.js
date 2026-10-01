// ម៉ាស៊ីនមេ Supabase ក្លែង (តែផ្នែកដែល ZoeW ប្រើ) លើ Postgres ពិត ៖
//   · GoTrue ៖ POST /auth/v1/token?grant_type=password|refresh_token · POST /auth/v1/logout · GET /auth/v1/user · GET /auth/v1/health
//     JWT HS256 ពិត (sub · role · exp · iat · amr[{method,timestamp}] · session_id) ➜ supabase-js ពិត decode/refresh បាន
//   · PostgREST ៖ POST /rest/v1/rpc/<fn> ➜ ផ្ទៀង JWT ➜ `set local role` + `request.jwt.claims` (ដូច PostgREST) ➜ ហៅ function តាមឈ្មោះ
//     argument (type ពី pg_proc) ➜ scalar ➜ តម្លៃ JSON · table ➜ array · កំហុស ➜ {code, message, details, hint} + status ដូច PostgREST
//     (42501 ➜ 403 authenticated / 401 anon · 22023/P0001/P0002 ➜ 400 · JWT ខុស/ផុត ➜ 401 PGRST301/PGRST303)
//   · Edge Function ៖ POST /functions/v1/<name> ➜ handler ដែលអ្នកហៅផ្តល់ (ឬ 404)
//   · ការគ្រប់គ្រងសម្រាប់តេស្ត ៖ `setMode('down' | 'hang' | 'drop-response' | 'ok')` · `requests` · `issueToken()` · `expireTokens()`
// ⛔ Realtime (websocket) មិនធ្វើត្រាប់ ➜ adapter ត្រូវធ្លាក់ចុះទៅការទាញតាមវដ្ត/`goOnline()` (ការវាស់នោះជាផ្នែកនៃតេស្ត)។
'use strict';

const http = require('http');
const crypto = require('crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function signJwt(payload, secret) {
    const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const p = b64u(JSON.stringify(payload));
    const s = b64u(crypto.createHmac('sha256', secret).update(h + '.' + p).digest());
    return h + '.' + p + '.' + s;
}

function verifyJwt(token, secret, nowSec) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return { ok: false, code: 'PGRST301' };
    const want = b64u(crypto.createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest());
    if (want !== parts[2]) return { ok: false, code: 'PGRST301' };
    let claims;
    try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch (e) { return { ok: false, code: 'PGRST301' }; }
    if (!(Number(claims.exp) > nowSec)) return { ok: false, code: 'PGRST303' };
    return { ok: true, claims };
}

async function startFakeSupabase(opts) {
    const secret = opts.jwtSecret || crypto.randomBytes(32).toString('hex');
    const pool = opts.pool;
    const users = new Map();
    const refreshTokens = new Map();
    const requests = [];
    const functions = opts.functions || {};
    let mode = 'ok';
    let tokenTtlSec = opts.tokenTtlSec || 3600;
    let expireBefore = 0;
    const signatures = new Map();
    const sockets = new Set();

    const addUser = (email, password, id) => { users.set(email.toLowerCase(), { id, email: email.toLowerCase(), password }); };
    const issueToken = (user, authTime) => {
        const now = Math.floor(Date.now() / 1000);
        const sessionId = crypto.randomUUID();
        const access = signJwt({ aud: 'authenticated', role: 'authenticated', sub: user.id, email: user.email, iat: now, exp: now + tokenTtlSec,
            session_id: sessionId, amr: [{ method: 'password', timestamp: authTime || now }], app_metadata: {}, user_metadata: {} }, secret);
        const refresh = crypto.randomBytes(16).toString('hex');
        refreshTokens.set(refresh, { user, authTime: authTime || now });
        return {
            access_token: access, token_type: 'bearer', expires_in: tokenTtlSec, expires_at: now + tokenTtlSec, refresh_token: refresh,
            user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {},
                created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:00:00Z' }
        };
    };

    async function signatureOf(fn) {
        if (signatures.has(fn)) return signatures.get(fn);
        const c = await pool.connect();
        try {
            const r = await c.query(`select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
                    p.proretset as setof, format_type(p.prorettype, null) as ret, rt.typtype as rettype
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
                where n.nspname = 'public' and p.proname = $1`, [fn]);
            const sig = r.rows[0] ? { names: r.rows[0].names || [], types: r.rows[0].types || [], setof: r.rows[0].setof, ret: r.rows[0].ret, composite: r.rows[0].rettype === 'c' } : null;
            signatures.set(fn, sig);
            return sig;
        } finally {
            c.release();
        }
    }

    function send(res, status, body, headers) {
        const text = body === undefined ? '' : JSON.stringify(body);
        res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, headers || {}));
        res.end(text);
    }

    async function rpc(req, res, fn, body) {
        const auth = String(req.headers.authorization || '');
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        let role = 'anon';
        let claims = { role: 'anon' };
        if (token && token.split('.').length === 3) {
            const v = verifyJwt(token, secret, Math.floor(Date.now() / 1000));
            if (!v.ok) return send(res, 401, { code: v.code, message: v.code === 'PGRST303' ? 'JWT expired' : 'JWSError', details: null, hint: null });
            if (v.claims.iat < expireBefore) return send(res, 401, { code: 'PGRST303', message: 'JWT expired', details: null, hint: null });
            claims = v.claims;
            role = v.claims.role === 'authenticated' ? 'authenticated' : 'anon';
        }
        const sig = await signatureOf(fn);
        if (!sig) return send(res, 404, { code: 'PGRST202', message: 'Could not find the function public.' + fn, details: null, hint: null });
        const args = body && typeof body === 'object' ? body : {};
        const parts = [];
        const params = [];
        for (const name of Object.keys(args)) {
            const idx = sig.names.indexOf(name);
            if (idx === -1) return send(res, 404, { code: 'PGRST202', message: 'Could not find the function public.' + fn + ' with argument ' + name, details: null, hint: null });
            const type = sig.types[idx];
            const v = args[name];
            params.push(v === null ? null : (type === 'jsonb' || type === 'json') ? JSON.stringify(v) : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
            parts.push(name + ' => $' + params.length + '::' + type);
        }
        const call = 'public.' + fn + '(' + parts.join(', ') + ')';
        const sql = sig.setof || sig.composite || /^record$/.test(sig.ret) ? 'select * from ' + call : 'select ' + call + ' as r';
        const c = await pool.connect();
        try {
            await c.query('begin');
            await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
            await c.query('set local role ' + role);
            const r = await c.query(sql, params);
            await c.query('commit');
            if (mode === 'drop-response') { req.socket.destroy(); return; }
            if (sig.setof) return send(res, 200, r.rows);
            if (sig.composite) return send(res, 200, r.rows[0] && Object.values(r.rows[0]).some((v) => v !== null) ? r.rows[0] : null);
            return send(res, 200, r.rows[0] ? r.rows[0].r : null);
        } catch (e) {
            try { await c.query('rollback'); } catch (x) {}
            const status = e.code === '42501' ? (role === 'anon' ? 401 : 403) : (e.code === 'P0002' ? 404 : e.code === '23505' ? 409 : 400);
            return send(res, status, { code: e.code || '', message: e.message, details: e.detail || null, hint: null });
        } finally {
            c.release();
        }
    }

    async function selectTable(req, res, table, params) {
        const auth = String(req.headers.authorization || '');
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        let role = 'anon';
        let claims = { role: 'anon' };
        if (token && token.split('.').length === 3) {
            const v = verifyJwt(token, secret, Math.floor(Date.now() / 1000));
            if (!v.ok || v.claims.iat < expireBefore) return send(res, 401, { code: 'PGRST303', message: 'JWT expired', details: null, hint: null });
            claims = v.claims;
            role = v.claims.role === 'authenticated' ? 'authenticated' : 'anon';
        }
        const ident = /^[a-z_][a-z0-9_]*$/;
        const cols = String(params.get('select') || '*').split(',').map((x) => x.trim());
        if (!cols.every((x) => x === '*' || ident.test(x))) return send(res, 400, { code: 'PGRST100', message: 'bad select' });
        let order = '';
        const ord = params.get('order');
        if (ord) {
            const m = /^([a-z_][a-z0-9_]*)\.(asc|desc)$/.exec(ord);
            if (!m) return send(res, 400, { code: 'PGRST100', message: 'bad order' });
            order = ' order by ' + m[1] + ' ' + m[2];
        }
        const c = await pool.connect();
        try {
            await c.query('begin');
            await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
            await c.query('set local role ' + role);
            const r = await c.query('select ' + cols.join(', ') + ' from public.' + table + order);
            await c.query('commit');
            return send(res, 200, r.rows);
        } catch (e) {
            try { await c.query('rollback'); } catch (x) {}
            return send(res, e.code === '42501' ? (role === 'anon' ? 401 : 403) : 400, { code: e.code || '', message: e.message, details: null, hint: null });
        } finally {
            c.release();
        }
    }

    const server = http.createServer((req, res) => {
        let data = '';
        req.on('data', (d) => { data += d; });
        req.on('end', async () => {
            let body = null;
            try { body = data ? JSON.parse(data) : null; } catch (e) { body = null; }
            const u = new URL(req.url, 'http://x');
            requests.push({ method: req.method, path: u.pathname, search: u.search, body });
            if (req.method === 'OPTIONS') return send(res, 204);
            if (mode === 'down') { req.socket.destroy(); return; }
            if (mode === 'hang') return;
            try {
                if (u.pathname === '/auth/v1/health') return send(res, 200, { name: 'GoTrue', version: 'fake' });
                if (u.pathname === '/auth/v1/token' && req.method === 'POST') {
                    const grant = u.searchParams.get('grant_type');
                    if (grant === 'password') {
                        const user = users.get(String(body && body.email || '').toLowerCase());
                        if (!user || user.password !== (body && body.password)) {
                            return send(res, 400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, { 'X-Supabase-Api-Version': '2024-01-01' });
                        }
                        return send(res, 200, issueToken(user));
                    }
                    if (grant === 'refresh_token') {
                        const rt = refreshTokens.get(body && body.refresh_token);
                        if (!rt) return send(res, 400, { code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, { 'X-Supabase-Api-Version': '2024-01-01' });
                        refreshTokens.delete(body.refresh_token);
                        return send(res, 200, issueToken(rt.user, rt.authTime));
                    }
                    return send(res, 400, { code: 'unsupported_grant_type', msg: 'bad grant' });
                }
                if (u.pathname === '/auth/v1/logout') return send(res, 204);
                if (u.pathname === '/auth/v1/user' && req.method === 'GET') {
                    const token = String(req.headers.authorization || '').slice(7);
                    const v = verifyJwt(token, secret, Math.floor(Date.now() / 1000));
                    if (!v.ok) return send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' });
                    return send(res, 200, { id: v.claims.sub, aud: 'authenticated', role: 'authenticated', email: v.claims.email });
                }
                const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/);
                if (m && req.method === 'POST') return await rpc(req, res, m[1], body);
                const t = u.pathname.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)$/);
                if (t && req.method === 'GET') return await selectTable(req, res, t[1], u.searchParams);
                const f = u.pathname.match(/^\/functions\/v1\/([a-z0-9-]+)$/);
                if (f && functions[f[1]]) {
                    const out = await functions[f[1]](body, req);
                    return send(res, out.status, out.body);
                }
                return send(res, 404, { message: 'no route ' + u.pathname });
            } catch (e) {
                return send(res, 500, { message: String(e && e.message || e) });
            }
        });
    });
    server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
    server.on('upgrade', (req, socket) => { socket.destroy(); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + server.address().port;
    return {
        url,
        secret,
        requests,
        addUser,
        setMode(next) { mode = next; },
        setTokenTtl(sec) { tokenTtlSec = sec; },
        expireTokens() { expireBefore = Math.floor(Date.now() / 1000) + 1; },
        close() {
            for (const s of sockets) s.destroy();
            return new Promise((r) => server.close(() => r()));
        }
    };
}

module.exports = { startFakeSupabase, signJwt, verifyJwt };
