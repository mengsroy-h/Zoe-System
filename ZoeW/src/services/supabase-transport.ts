import { createClient } from '@supabase/supabase-js';
import { SbNetworkError, SbRpcError } from './supabase-rtdb';

export const SB_AUTH_STORAGE_KEY = 'zoew-sb-auth';

export const SB_ACCOUNT_STORAGE_KEY = 'zoew-sb-account';

export const SB_AUTH_OWNER_KEY = 'zoew-sb-auth-owner';

export const SB_AUTH_KEY_SUFFIXES = ['', '-code-verifier', '-user'];

export const SB_FETCH_TIMEOUT_MS = 15000;

export function claimSessionStorageFor(storage, url) {
    const owner = storage.getItem(SB_AUTH_OWNER_KEY);
    if (owner !== null && owner !== url) {
        SB_AUTH_KEY_SUFFIXES.forEach((suffix) => storage.removeItem(SB_AUTH_STORAGE_KEY + suffix));
        storage.removeItem(SB_ACCOUNT_STORAGE_KEY);
    }
    if (owner !== url) storage.setItem(SB_AUTH_OWNER_KEY, url);
    return owner === null || owner === url;
}

function storeOf(name) {
    try {
        const s = (window as any)[name];
        return s && typeof s.getItem === 'function' ? s : null;
    } catch (e) {
        return null;
    }
}

export function createModeStorage(localStore, sessionStore) {
    let mode = 'local';
    const read = (store, key) => {
        try { return store ? store.getItem(key) : null; } catch (e) { return null; }
    };
    const write = (store, key, value) => {
        try { if (store) store.setItem(key, value); return !!store; } catch (e) { return false; }
    };
    const drop = (store, key) => {
        try { if (store) store.removeItem(key); } catch (e) {}
    };
    return {
        setMode(next) { mode = next === 'session' ? 'session' : 'local'; },
        getMode() { return mode; },
        getItem(key) {
            const local = read(localStore, key);
            return local !== null ? local : read(sessionStore, key);
        },
        setItem(key, value) {
            const inSession = read(sessionStore, key) !== null;
            const inLocal = read(localStore, key) !== null;
            const target = inSession && !inLocal ? 'session' : (inLocal ? 'local' : mode);
            if (target === 'session') {
                if (write(sessionStore, key, value)) drop(localStore, key);
            } else if (write(localStore, key, value)) {
                drop(sessionStore, key);
            }
        },
        removeItem(key) {
            drop(localStore, key);
            drop(sessionStore, key);
        }
    };
}

export function sbFetchWithTimeout(fetchImpl, url, init, timeoutMs) {
    let controller = null;
    try { controller = new AbortController(); } catch (e) { controller = null; }
    let timer = null;
    const guard = new Promise((_, reject) => {
        timer = setTimeout(() => {
            try { if (controller) controller.abort(); } catch (e) {}
            reject(new SbNetworkError('timeout'));
        }, timeoutMs);
    });
    let started;
    try {
        started = Promise.resolve(fetchImpl(url, controller ? Object.assign({}, init, { signal: controller.signal }) : init));
    } catch (e) {
        started = Promise.reject(e);
    }
    const run = started.then(async (res) => {
        const text = await res.text();
        return { status: res.status, ok: res.ok, text };
    }, (e) => {
        throw new SbNetworkError(String((e && e.message) || e || 'network'));
    });
    return Promise.race([run, guard]).finally(() => clearTimeout(timer));
}

export function sbFetchWithCeiling(fetchImpl, input, init, timeoutMs) {
    let controller = null;
    try { controller = new AbortController(); } catch (e) { controller = null; }
    const source = init && init.signal;
    const abort = () => { try { if (controller) controller.abort(); } catch (e) {} };
    if (source && typeof source.addEventListener === 'function') {
        if (source.aborted) abort();
        else source.addEventListener('abort', abort, { once: true });
    }
    let timer = null;
    const guard = new Promise((_, reject) => {
        timer = setTimeout(() => {
            abort();
            reject(new SbNetworkError('timeout'));
        }, timeoutMs);
    });
    let started;
    try {
        started = Promise.resolve(fetchImpl(input, controller ? Object.assign({}, init, { signal: controller.signal }) : init));
    } catch (e) {
        started = Promise.reject(e);
    }
    const run = started.then(async (res) => {
        const body = await res.text();
        const empty = res.status === 204 || res.status === 205 || res.status === 304;
        return new Response(empty ? null : body, { status: res.status, statusText: res.statusText, headers: res.headers });
    });
    return Promise.race([run, guard]).finally(() => {
        clearTimeout(timer);
        if (source && typeof source.removeEventListener === 'function') source.removeEventListener('abort', abort);
    });
}

export function sbWithin(promise, timeoutMs) {
    let timer = null;
    const guard = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new SbNetworkError('timeout')), timeoutMs);
    });
    return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

export function rpcErrorFrom(status, text) {
    let body = null;
    try { body = JSON.parse(text); } catch (e) { body = null; }
    const code = body && typeof body.code === 'string' ? body.code : '';
    const message = body && typeof body.message === 'string' ? body.message : ('HTTP ' + status);
    const detail = body && typeof body.details === 'string' ? body.details : '';
    return new SbRpcError(message, code, status, detail);
}

export function createSupabaseTransport(config, deps?) {
    const url = String(config.supabaseUrl || '').replace(/\/+$/, '');
    const key = String(config.supabaseKey || '');
    const fetchImpl = (deps && deps.fetch) || ((...args) => (globalThis.fetch as any)(...args));
    const fetchTimeoutMs = (deps && deps.fetchTimeoutMs) || SB_FETCH_TIMEOUT_MS;
    const storage = createModeStorage((deps && deps.localStorage) || storeOf('localStorage'), (deps && deps.sessionStorage) || storeOf('sessionStorage'));
    claimSessionStorageFor(storage, url);
    const client = createClient(url, key, {
        auth: {
            storage,
            storageKey: SB_AUTH_STORAGE_KEY,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        },
        global: {
            fetch: (input, init) => sbFetchWithCeiling(fetchImpl, input, init, fetchTimeoutMs)
        }
    });
    const toSession = (s) => (s && s.access_token && s.user ? { accessToken: s.access_token, user: { id: s.user.id, email: s.user.email || '' } } : null);
    const accessToken = async () => {
        const { data } = await client.auth.getSession();
        return data && data.session ? data.session.access_token : null;
    };
    const post = async (path, body, token, timeoutMs) => {
        const headers: any = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
        if (token) headers.Authorization = 'Bearer ' + token;
        return sbFetchWithTimeout(fetchImpl, url + path, { method: 'POST', headers, body: JSON.stringify(body || {}), cache: 'no-store', credentials: 'omit' }, timeoutMs);
    };
    const sessionStored = () => {
        try { return !!storage.getItem(SB_AUTH_STORAGE_KEY); } catch (e) { return false; }
    };
    const rpc = async (fn, args, timeoutMs) => {
        let token = await sbWithin(accessToken().catch(() => null), timeoutMs);
        if (!token && sessionStored()) throw new SbNetworkError('auth-unavailable');
        let res = await post('/rest/v1/rpc/' + fn, args, token, timeoutMs);
        if (res.status === 401 && token) {
            const refreshed = await sbWithin(client.auth.refreshSession().catch(() => null), timeoutMs);
            const next = refreshed && refreshed.data && refreshed.data.session ? refreshed.data.session.access_token : null;
            if (next && next !== token) {
                token = next;
                res = await post('/rest/v1/rpc/' + fn, args, token, timeoutMs);
            } else if (!next && sessionStored()) {
                throw new SbNetworkError('auth-unavailable');
            }
        }
        if (!res.ok) throw rpcErrorFrom(res.status, res.text);
        if (!res.text) return null;
        try {
            return JSON.parse(res.text);
        } catch (e) {
            throw new SbRpcError('bad json', 'bad_response', res.status, '');
        }
    };
    return {
        url,
        loginDomain: config.loginDomain,
        async restoreSession() {
            const { data } = await client.auth.getSession();
            return toSession(data && data.session);
        },
        async signIn(email, password) {
            let out;
            try {
                out = await client.auth.signInWithPassword({ email, password });
            } catch (e) {
                throw new SbNetworkError(String((e && e.message) || e));
            }
            if (out.error) {
                const err: any = new Error(out.error.message || 'auth error');
                err.code = (out.error as any).code || '';
                err.status = (out.error as any).status || 0;
                if (!err.status || /fetch|network/i.test(err.message)) throw new SbNetworkError(err.message);
                throw err;
            }
            return toSession(out.data.session);
        },
        async signOut() {
            const out = await client.auth.signOut({ scope: 'local' });
            if (out && out.error && !/session/i.test(String(out.error.message))) throw out.error;
        },
        onSession(cb) {
            const { data } = client.auth.onAuthStateChange((event, session) => cb(event, toSession(session)));
            return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
        },
        setPersistence(mode) {
            storage.setMode(mode);
        },
        accessToken,
        rpc,
        readAccount() {
            const raw = storage.getItem(SB_ACCOUNT_STORAGE_KEY);
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : null;
            } catch (e) {
                return null;
            }
        },
        writeAccount(entry) {
            if (!entry || !entry.row) { storage.removeItem(SB_ACCOUNT_STORAGE_KEY); return; }
            const row = entry.row;
            storage.setItem(SB_ACCOUNT_STORAGE_KEY, JSON.stringify({ uid: entry.uid, row: { tenant_id: row.tenant_id, tenant_name: row.tenant_name, branch_code: row.branch_code, username: row.username, role: row.role, status: row.status, expires_at: row.expires_at } }));
        },
        async ping(timeoutMs) {
            const res = await sbFetchWithTimeout(fetchImpl, url + '/auth/v1/health', { method: 'GET', headers: { apikey: key }, cache: 'no-store', credentials: 'omit' }, timeoutMs);
            if (res.status >= 500) throw new SbNetworkError('HTTP ' + res.status);
            return true;
        },
        subscribe(topic, onEvent, onStatus) {
            let channel = null;
            let cancelled = false;
            (async () => {
                try {
                    const token = await accessToken();
                    if (cancelled) return;
                    await client.realtime.setAuth(token);
                    if (cancelled) return;
                    channel = client.channel(topic, { config: { private: true, broadcast: { self: false } } });
                    channel.on('broadcast', { event: 'seq' }, (msg) => onEvent(msg && msg.payload));
                    channel.subscribe((status) => onStatus(status));
                } catch (e) {
                    onStatus('CHANNEL_ERROR');
                }
            })();
            return () => {
                cancelled = true;
                if (channel) { try { client.removeChannel(channel); } catch (e) {} }
            };
        },
        async callFunction(name, body) {
            const res = await sbFetchWithTimeout(fetchImpl, url + '/functions/v1/' + name, {
                method: 'POST',
                headers: { apikey: key, 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
                cache: 'no-store',
                credentials: 'omit'
            }, 20000);
            let parsed = null;
            try { parsed = JSON.parse(res.text); } catch (e) { parsed = null; }
            return { status: res.status, body: parsed && typeof parsed === 'object' ? parsed : { ok: false, code: 'bad-response' } };
        },
        close() {
            try { client.removeAllChannels(); } catch (e) {}
            try { client.auth.stopAutoRefresh(); } catch (e) {}
        }
    };
}
