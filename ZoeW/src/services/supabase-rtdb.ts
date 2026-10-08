import { txDisconnectResolving } from './tx-disconnect';
import { elapsedSince } from '../core/elapsed';
import { SB_DOCS_CACHE_VERSION, docsCacheRecordIsValid } from './supabase-docs-cache';

export const INVALID_KEY_RE = /[[\].#$/\u0000-\u001F\u007F]/;
export const INVALID_PATH_RE = /[[\].#$\u0000-\u001F\u007F]/;
const INTEGER_REGEXP = /^-?(0*)\d{1,10}$/;
const ARRAY_KEY_RE = /^(0|[1-9]\d*)$/;
const MAX_KEY_BYTES = 768;
const MAX_DEPTH = 32;

export const SB_RPC_TIMEOUT_MS = 20000;
export const SB_TX_MAX_RETRIES = 25;
export const SB_RETRY_STEPS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
export const SB_POLL_REALTIME_MS = 300000;
export const SB_POLL_FALLBACK_MS = 30000;
export const SB_REALTIME_RETRY_STEPS_MS = [5000, 15000, 30000, 60000];
export const SB_CLOCK_SKEW_WARN_MS = 5 * 60 * 1000;
export const SB_PULL_PAGE = 2000;
export const SB_PULL_MAX_RESTARTS = 2;
export const SB_DOCS_CACHE_LOAD_MAX_MS = 3000;
export const SB_DOCS_CACHE_FIRST_SAVE_MS = 1500;
export const SB_DOCS_CACHE_MIN_INTERVAL_MS = 30000;
export const SB_OPS_PER_WRITE = 500;

export class SbNetworkError extends Error {
    unsent: boolean;
    constructor(message, unsent = false) {
        super(message);
        this.name = 'SbNetworkError';
        if (unsent) this.unsent = true;
    }
}

export class SbRpcError extends Error {
    code: string;
    status: number;
    detail: string;
    constructor(message, code, status, detail) {
        super(message);
        this.name = 'SbRpcError';
        this.code = code || '';
        this.status = status || 0;
        this.detail = detail || '';
    }
}

export class SbIncrement {
    delta: number;
    constructor(delta) {
        this.delta = delta;
    }
}

export function utf8Length(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 0x80) n += 1;
        else if (c < 0x800) n += 2;
        else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
        else n += 3;
    }
    return n;
}

export function isValidKey(key) {
    return typeof key === 'string' && key.length > 0 && !INVALID_KEY_RE.test(key) && utf8Length(key) <= MAX_KEY_BYTES;
}

export function tryParseInt(str) {
    if (INTEGER_REGEXP.test(str)) {
        const n = Number(str);
        if (n >= -2147483648 && n <= 2147483647) return n;
    }
    return null;
}

export function nameCompare(a, b) {
    if (a === b) return 0;
    const ai = tryParseInt(a);
    const bi = tryParseInt(b);
    if (ai !== null) {
        if (bi !== null) return ai - bi === 0 ? a.length - b.length : ai - bi;
        return -1;
    }
    if (bi !== null) return 1;
    return a < b ? -1 : 1;
}

export function parsePath(path) {
    if (path === undefined || path === null || path === '') return [];
    if (typeof path !== 'string') throw new Error('Invalid path: expected a string');
    if (INVALID_PATH_RE.test(path)) throw new Error('Invalid path "' + path + '": paths must not contain ".", "#", "$", "[", or "]"');
    return path.split('/').filter((s) => s.length > 0);
}

function describe(path) {
    return '/' + path.join('/');
}

export function toCanonical(value, where, depth?) {
    const level = depth || 0;
    if (level > MAX_DEPTH) throw new Error('Value at ' + where + ' is nested too deeply');
    if (value === null) return null;
    if (value === undefined) throw new Error('Value contains undefined in property \'' + where + '\'');
    if (value instanceof SbIncrement) throw new Error('increment() is only valid at the write location: ' + where);
    const kind = typeof value;
    if (kind === 'number') {
        if (!Number.isFinite(value)) throw new Error('Value contains NaN or Infinity in property \'' + where + '\'');
        return value;
    }
    if (kind === 'string' || kind === 'boolean') return value;
    if (kind !== 'object') throw new Error('Value contains a ' + kind + ' in property \'' + where + '\'');
    const out = {};
    const keys = Array.isArray(value) ? value.map((_, i) => String(i)) : Object.keys(value);
    for (const key of keys) {
        if (!isValidKey(key)) throw new Error('Invalid key "' + key + '" in property \'' + where + '\'');
        const child = toCanonical(value[key], where + '/' + key, level + 1);
        if (child !== null) out[key] = child;
    }
    return Object.keys(out).length ? out : null;
}

export function exportVal(node) {
    if (node === null || typeof node !== 'object') return node === undefined ? null : node;
    const keys = Object.keys(node).sort(nameCompare);
    const obj = {};
    let numKeys = 0;
    let maxKey = 0;
    let allIntegerKeys = true;
    for (const key of keys) {
        obj[key] = exportVal(node[key]);
        numKeys++;
        if (allIntegerKeys && ARRAY_KEY_RE.test(key)) maxKey = Math.max(maxKey, Number(key));
        else allIntegerKeys = false;
    }
    if (allIntegerKeys && maxKey < 2 * numKeys) {
        const array = [];
        for (const key in obj) array[key] = obj[key];
        return array;
    }
    return obj;
}

export function canonicalJson(node) {
    if (node === null || typeof node !== 'object') return JSON.stringify(node === undefined ? null : node);
    const keys = Object.keys(node).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(node[k])).join(',') + '}';
}

export function getAt(node, segs) {
    let cur = node;
    for (const s of segs) {
        if (cur === null || typeof cur !== 'object' || !(s in cur)) return null;
        cur = cur[s];
    }
    return cur === undefined ? null : cur;
}

export function setAt(node, segs, value) {
    if (!segs.length) return value;
    const base = node !== null && typeof node === 'object' ? Object.assign({}, node) : {};
    const child = setAt(base[segs[0]] === undefined ? null : base[segs[0]], segs.slice(1), value);
    if (child === null) delete base[segs[0]];
    else base[segs[0]] = child;
    return Object.keys(base).length ? base : null;
}

function cloneCanonical(node) {
    return node === null || typeof node !== 'object' ? node : JSON.parse(JSON.stringify(node));
}

export function firebaseLikeError(code, path, reason?) {
    const text = code === 'permission_denied' ? 'Client doesn\'t have permission to access the desired data.'
        : code === 'disconnect' ? 'The transaction was interrupted by a lost connection.'
            : (reason || 'Unknown Error');
    const err: any = new Error(code + ' at ' + describe(path) + ': ' + text);
    err.code = code.toUpperCase();
    return err;
}

function disconnectError() {
    const err: any = new Error('disconnect');
    err.code = 'DISCONNECT';
    return err;
}

function newOpId() {
    const bytes = new Uint8Array(18);
    try {
        crypto.getRandomValues(bytes);
    } catch (e) {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let out = 'w';
    bytes.forEach((b) => { out += alphabet[b & 63]; });
    return out;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class SbSnapshot {
    ref: any;
    key: string | null;
    _node: any;
    constructor(ref, node) {
        this.ref = ref;
        this.key = ref ? ref.key : null;
        this._node = node === undefined ? null : node;
    }
    val() {
        return exportVal(cloneCanonical(this._node));
    }
    exportVal() {
        return this.val();
    }
    toJSON() {
        return this.val();
    }
    exists() {
        return this._node !== null;
    }
    child(path) {
        const segs = parsePath(path);
        return new SbSnapshot(this.ref ? this.ref.child(path) : null, getAt(this._node, segs));
    }
    hasChild(path) {
        return getAt(this._node, parsePath(path)) !== null;
    }
    hasChildren() {
        return this._node !== null && typeof this._node === 'object';
    }
    numChildren() {
        return this._node !== null && typeof this._node === 'object' ? Object.keys(this._node).length : 0;
    }
    size() {
        return this.numChildren();
    }
    forEach(cb) {
        if (this._node === null || typeof this._node !== 'object') return false;
        for (const key of Object.keys(this._node).sort(nameCompare)) {
            if (cb(new SbSnapshot(this.ref ? this.ref.child(key) : null, this._node[key])) === true) return true;
        }
        return false;
    }
}

class SbRef {
    _db: any;
    _path: string[];
    key: string | null;
    constructor(db, path) {
        this._db = db;
        this._path = path;
        this.key = path.length ? path[path.length - 1] : null;
    }
    get parent() {
        return this._path.length ? new SbRef(this._db, this._path.slice(0, -1)) : null;
    }
    get root() {
        return new SbRef(this._db, []);
    }
    child(path) {
        if (typeof path !== 'string' || !path.length) throw new Error('Invalid path "' + path + '": paths must be non-empty strings');
        return new SbRef(this._db, this._path.concat(parsePath(path)));
    }
    toString() {
        return 'supabase:' + describe(this._path);
    }
    isEqual(other) {
        return !!other && other._db === this._db && describe(other._path) === describe(this._path);
    }
}

function docKey(root, key) {
    return root + '/' + key;
}

function opDocKeys(op) {
    if (op.p.length === 1) return ['#' + op.p[0]];
    return [docKey(op.p[0], op.p[1])];
}

function keysOverlap(a, b) {
    for (const x of a) {
        for (const y of b) {
            if (x === y) return true;
            if (x[0] === '#' && y.startsWith(x.slice(1) + '/')) return true;
            if (y[0] === '#' && x.startsWith(y.slice(1) + '/')) return true;
            if (x[0] === '#' && y[0] === '#' && x === y) return true;
        }
    }
    return false;
}

function applyOpsToDocs(getDoc, ops) {
    const touched = new Map();
    const docOf = (root, key) => {
        const k = docKey(root, key);
        return touched.has(k) ? touched.get(k) : getDoc(root, key);
    };
    for (const op of ops) {
        const root = op.p[0];
        if (op.p.length === 1) {
            for (const key of Object.keys(getDoc(root, null) || {})) touched.set(docKey(root, key), null);
            for (const k of Array.from(touched.keys())) {
                if (k.startsWith(root + '/')) touched.set(k, null);
            }
            if (op.v && typeof op.v === 'object') {
                for (const key of Object.keys(op.v)) touched.set(docKey(root, key), op.v[key]);
            }
            continue;
        }
        const key = op.p[1];
        const sub = op.p.slice(2);
        const doc = docOf(root, key);
        if (op.k === 'inc') {
            const cur = getAt(doc, sub);
            touched.set(docKey(root, key), setAt(doc, sub, (typeof cur === 'number' ? cur : 0) + op.d));
        } else {
            touched.set(docKey(root, key), setAt(doc, sub, op.v));
        }
    }
    return touched;
}

export function createSupabaseDatabase(transport, hooks, options?) {
    const opt = options || {};
    const rpcTimeoutMs = opt.rpcTimeoutMs || SB_RPC_TIMEOUT_MS;
    const retrySteps = opt.retryStepsMs || SB_RETRY_STEPS_MS;
    const pollFallbackMs = opt.pollFallbackMs || SB_POLL_FALLBACK_MS;
    const pullPage = opt.pullPage || SB_PULL_PAGE;
    const docsCache = opt.docsCache || null;
    const cacheFirstSaveMs = opt.docsCacheFirstSaveMs || SB_DOCS_CACHE_FIRST_SAVE_MS;
    const cacheMinIntervalMs = opt.docsCacheMinIntervalMs || SB_DOCS_CACHE_MIN_INTERVAL_MS;
    const cacheLoadMaxMs = opt.docsCacheLoadMaxMs || SB_DOCS_CACHE_LOAD_MAX_MS;
    const server = new Map();
    const listeners = new Set();
    const infoListeners = new Set();
    const pending = [];
    let cursor = 0;
    let pullFullHead = null;
    let cacheScope = null;
    let cacheTried = false;
    let cacheTenant = null;
    let serverTenant = null;
    let cacheSaveTimer = null;
    let lastCacheSaveAt = 0;
    let cacheGeneration = 0;
    let sessionEpoch = 0;
    let authScope = null;
    let ready = false;
    let pullStage = null;
    let pullStageAbove = 0;
    let syncing = false;
    let wantSync = false;
    let online = true;
    let connected = false;
    let serverOffset = 0;
    let offsetKnown = false;
    let retryAttempt = 0;
    let retryTimer = null;
    let pollTimer = null;
    let realtimeHealthy = false;
    let unsubscribeRealtime = null;
    let realtimeGeneration = 0;
    let realtimeRetryTimer = null;
    let realtimeRetryAttempt = 0;
    let clockSkewWarned = false;
    let tenantTopic = null;
    let forbidden = null;
    let closed = false;
    let authed = false;
    const waiters = new Set();
    const db: any = { _sb: true };

    const serverDoc = (root, key) => {
        const docs = server.get(root);
        if (key === null) {
            if (!docs) return null;
            const out = {};
            docs.forEach((entry, k) => { if (entry.v !== null) out[k] = entry.v; });
            return Object.keys(out).length ? out : null;
        }
        const entry = docs && docs.get(key);
        return entry ? entry.v : null;
    };

    const effectiveDocs = () => {
        const overlay = new Map();
        const getDoc = (root, key) => {
            if (key === null) {
                const base = serverDoc(root, null) || {};
                const out = Object.assign({}, base);
                overlay.forEach((v, k) => {
                    if (k.startsWith(root + '/')) {
                        const name = k.slice(root.length + 1);
                        if (v === null) delete out[name];
                        else out[name] = v;
                    }
                });
                return Object.keys(out).length ? out : null;
            }
            const k = docKey(root, key);
            return overlay.has(k) ? overlay.get(k) : serverDoc(root, key);
        };
        for (const w of pending) {
            if (!w.overlay || w.scope !== authScope) continue;
            applyOpsToDocs(getDoc, w.ops).forEach((v, k) => overlay.set(k, v));
        }
        return getDoc;
    };

    const valueAt = (path, docs?) => {
        const getDoc = docs || effectiveDocs();
        if (!path.length) {
            const out = {};
            const roots = new Set(server.keys());
            for (const w of pending) if (w.overlay && w.scope === authScope) for (const op of w.ops) roots.add(op.p[0]);
            roots.forEach((root) => {
                const v = getDoc(root, null);
                if (v !== null) out[root] = v;
            });
            return Object.keys(out).length ? out : null;
        }
        if (path.length === 1) return getDoc(path[0], null);
        return getAt(getDoc(path[0], path[1]), path.slice(2));
    };

    const serverValueAt = (path) => {
        if (path.length === 1) return serverDoc(path[0], null);
        return getAt(serverDoc(path[0], path[1]), path.slice(2));
    };

    const putDocIn = (target, root, key, value, seq) => {
        let docs = target.get(root);
        const entry = docs && docs.get(key);
        if (entry && seq < entry.s) return false;
        if (!docs) { docs = new Map(); target.set(root, docs); }
        if (value === null) docs.set(key, { v: null, s: seq });
        else docs.set(key, { v: value, s: seq });
        return true;
    };

    const putDoc = (root, key, value, seq) => putDocIn(server, root, key, value, seq);

    const loadCacheWithin = (scope) => new Promise<any>((resolve) => {
        let finished = false;
        let timer = null;
        const finish = (value) => {
            if (finished) return;
            finished = true;
            if (timer !== null) clearTimeout(timer);
            resolve(value);
        };
        timer = setTimeout(() => finish(null), cacheLoadMaxMs);
        try {
            Promise.resolve(docsCache.load(scope)).then(finish, () => finish(null));
        } catch (e) {
            finish(null);
        }
    });

    const seedFromCache = (rec) => {
        for (const d of rec.docs) putDoc(d[0], d[1], d[2], d[3]);
        cursor = rec.cursor;
        cacheTenant = rec.tenant;
    };

    const clearDocsCache = () => {
        if (!docsCache) return;
        try { Promise.resolve(docsCache.clear()).catch(() => {}); } catch (e) {}
    };

    const saveDocsCacheNow = () => {
        if (closed || !authed || !cacheScope || !serverTenant || cursor <= 0 || pullStage) return;
        if (syncing) { scheduleCacheSave(); return; }
        const docs = [];
        server.forEach((entries, root) => entries.forEach((entry, key) => { if (entry.v !== null) docs.push([root, key, entry.v, entry.s]); }));
        const scope = cacheScope;
        const generation = cacheGeneration;
        lastCacheSaveAt = Date.now();
        try {
            Promise.resolve(docsCache.save(scope, { v: SB_DOCS_CACHE_VERSION, scope, tenant: serverTenant, cursor, docs })).then(() => {
                if (generation !== cacheGeneration) clearDocsCache();
            }, () => {});
        } catch (e) {}
    };

    function scheduleCacheSave() {
        if (!docsCache || !cacheScope || !serverTenant || cacheSaveTimer || closed) return;
        const wait = lastCacheSaveAt ? Math.max(cacheFirstSaveMs, cacheMinIntervalMs - elapsedSince(lastCacheSaveAt)) : cacheFirstSaveMs;
        cacheSaveTimer = setTimeout(() => {
            cacheSaveTimer = null;
            saveDocsCacheNow();
        }, wait);
    }

    const fireListener = (l, getDoc?) => {
        if (closed || !ready || l.cancelled || !listeners.has(l)) return;
        const node = valueAt(l.path, getDoc);
        const json = canonicalJson(node);
        if (l.fired && json === l.last) return;
        l.fired = true;
        l.last = json;
        try { l.cb(new SbSnapshot(l.ref, cloneCanonical(node))); } catch (e) { hooks.onListenerError(e); }
    };

    const notify = () => {
        if (closed || !ready) return;
        const getDoc = effectiveDocs();
        listeners.forEach((l) => fireListener(l, getDoc));
    };

    const fireInfo = () => {
        infoListeners.forEach((l: any) => {
            const value = l.kind === 'connected' ? connected : (offsetKnown ? serverOffset : 0);
            const json = JSON.stringify(value);
            if (l.fired && json === l.last) return;
            l.fired = true;
            l.last = json;
            try { l.cb(new SbSnapshot(l.ref, value)); } catch (e) { hooks.onListenerError(e); }
        });
    };

    const setConnected = (value) => {
        if (connected === value) return;
        connected = value;
        fireInfo();
    };

    const noteServerTime = (now, t0, t1) => {
        if (typeof now !== 'number' || !Number.isFinite(now)) return;
        serverOffset = Math.round(now - (t0 + t1) / 2);
        offsetKnown = true;
        if (!clockSkewWarned && Math.abs(serverOffset) > SB_CLOCK_SKEW_WARN_MS && hooks.onClockSkew) {
            clockSkewWarned = true;
            hooks.onClockSkew(serverOffset);
        }
        fireInfo();
    };

    const rpc = async (fn, args) => {
        const t0 = Date.now();
        let data;
        try {
            data = await transport.rpc(fn, args, rpcTimeoutMs);
        } catch (e) {
            if (fn === 'zoe_write' && e instanceof SbRpcError && e.code === 'bad_response') throw new SbNetworkError('write reply unreadable');
            throw e;
        }
        if (fn === 'zoe_write' && (!data || typeof data !== 'object')) throw new SbNetworkError('write reply empty');
        if (data && typeof data === 'object' && typeof data.now === 'number') noteServerTime(data.now, t0, Date.now());
        return data;
    };

    const wakeWaiters = () => {
        const list = Array.from(waiters);
        waiters.clear();
        list.forEach((fn: any) => fn());
    };

    const waitForLink = () => new Promise<void>((resolve) => {
        if (closed || (online && (navigator.onLine as boolean) !== false)) { resolve(); return; }
        waiters.add(resolve);
    });

    const cancelListenersWith = (error) => {
        listeners.forEach((l: any) => {
            if (l.cancelled) return;
            l.cancelled = true;
            listeners.delete(l);
            if (l.errCb) {
                try { l.errCb(firebaseLikeError('permission_denied', l.path)); } catch (e) { hooks.onListenerError(e); }
            }
        });
        void error;
    };

    const applyPull = (res) => {
        if (!res || !Array.isArray(res.rows)) throw new SbRpcError('bad pull response', 'bad_response', 0, '');
        if (res.reset) {
            pullStage = new Map();
            pullStageAbove = typeof res.head === 'number' && Number.isFinite(res.head) ? Math.max(res.seq, res.head) : res.seq;
        }
        const target = pullStage || server;
        for (const row of res.rows) putDocIn(target, row.r, row.k, row.v === undefined ? null : row.v, row.s);
        if (pullStage && !res.more) {
            const stage = pullStage;
            pullStage = null;
            server.forEach((docs, root) => docs.forEach((entry, key) => { if (entry.s > pullStageAbove) putDocIn(stage, root, key, entry.v, entry.s); }));
            server.clear();
            stage.forEach((docs, root) => server.set(root, docs));
        }
    };

    const scheduleRetry = () => {
        if (retryTimer || closed) return;
        const step = retrySteps[Math.min(retryAttempt, retrySteps.length - 1)];
        retryAttempt++;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            requestSync();
        }, step);
    };

    const schedulePoll = () => {
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        if (closed || !online) return;
        pollTimer = setTimeout(() => {
            pollTimer = null;
            requestSync();
        }, realtimeHealthy ? SB_POLL_REALTIME_MS : pollFallbackMs);
    };

    const runSync = async () => {
        syncing = true;
        try {
            while (wantSync && !closed) {
                wantSync = false;
                const epoch = sessionEpoch;
                if (!online || (navigator.onLine as boolean) === false) { setConnected(false); break; }
                if (!authed) {
                    try {
                        await transport.ping(rpcTimeoutMs);
                        if (closed) return;
                        retryAttempt = 0;
                        setConnected(true);
                    } catch (e) {
                        if (closed) return;
                        setConnected(false);
                        scheduleRetry();
                        break;
                    }
                    continue;
                }
                if (docsCache && cacheScope && !cacheTried) {
                    cacheTried = true;
                    if (cursor === 0 && server.size === 0) {
                        const scope = cacheScope;
                        const rec = await loadCacheWithin(scope);
                        if (closed) return;
                        if (epoch !== sessionEpoch) { wantSync = true; continue; }
                        if (scope === cacheScope && authed && cursor === 0 && server.size === 0 && docsCacheRecordIsValid(rec, scope)) seedFromCache(rec);
                    }
                }
                try {
                    let restarts = 0;
                    let staleSession = false;
                    for (let page = 0; page < 1000; page++) {
                        const args: any = { p_since: cursor, p_limit: pullPage };
                        if (cursor > 0 && pullFullHead !== null) args.p_full_head = pullFullHead;
                        const res = await rpc('zoe_pull', args);
                        if (closed) return;
                        if (epoch !== sessionEpoch) { staleSession = true; break; }
                        if (cacheTenant !== null) {
                            const sameShop = !!res && typeof res.tenant === 'string' && res.tenant === cacheTenant;
                            cacheTenant = null;
                            if (!sameShop || res.reset) server.clear();
                            if (!sameShop) {
                                cursor = 0;
                                pullFullHead = null;
                                page = -1;
                                continue;
                            }
                        }
                        if (serverTenant !== null && res && typeof res.tenant === 'string' && res.tenant && res.tenant !== serverTenant) {
                            if (++restarts > SB_PULL_MAX_RESTARTS) throw new SbRpcError('pull keeps restarting', 'pull_restart', 0, '');
                            server.clear();
                            pullStage = null;
                            pullStageAbove = 0;
                            serverTenant = null;
                            cursor = 0;
                            pullFullHead = null;
                            page = -1;
                            continue;
                        }
                        if (res && res.reset && page > 0 && ++restarts > SB_PULL_MAX_RESTARTS) {
                            throw new SbRpcError('pull keeps restarting', 'pull_restart', 0, '');
                        }
                        applyPull(res);
                        cursor = res.seq;
                        if (typeof res.tenant === 'string' && res.tenant) serverTenant = res.tenant;
                        if (res.reset) pullFullHead = res.more && typeof res.head === 'number' && Number.isFinite(res.head) ? res.head : null;
                        if (!res.more) {
                            pullFullHead = null;
                            break;
                        }
                    }
                    if (staleSession) { wantSync = true; continue; }
                    forbidden = null;
                    retryAttempt = 0;
                    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
                    setConnected(true);
                    ready = true;
                    notify();
                    hooks.onSynced();
                    schedulePoll();
                    scheduleCacheSave();
                } catch (e) {
                    if (closed) return;
                    if (epoch !== sessionEpoch) { wantSync = true; continue; }
                    if (e instanceof SbRpcError && (e.code === '42501' || e.status === 401 || e.status === 403)) {
                        forbidden = e;
                        setConnected(true);
                        cancelListenersWith(e);
                        hooks.onForbidden(e);
                        break;
                    }
                    setConnected(false);
                    scheduleRetry();
                    break;
                }
            }
        } finally {
            syncing = false;
        }
    };

    function requestSync() {
        if (closed) return;
        wantSync = true;
        if (!syncing) runSync();
    }

    const scheduleRealtimeRetry = () => {
        if (realtimeRetryTimer || closed) return;
        const step = SB_REALTIME_RETRY_STEPS_MS[Math.min(realtimeRetryAttempt++, SB_REALTIME_RETRY_STEPS_MS.length - 1)];
        realtimeRetryTimer = setTimeout(() => {
            realtimeRetryTimer = null;
            if (realtimeHealthy || closed) return;
            stopRealtime();
            startRealtime();
        }, step);
    };

    const startRealtime = () => {
        if (unsubscribeRealtime || !tenantTopic || !online || closed || !authed) return;
        const generation = ++realtimeGeneration;
        try {
            unsubscribeRealtime = transport.subscribe(tenantTopic, (payload) => {
                const seq = payload && typeof payload.seq === 'number' ? payload.seq : Infinity;
                if (seq > cursor) requestSync();
            }, (status) => {
                if (generation !== realtimeGeneration) return;
                const healthy = status === 'SUBSCRIBED';
                if (healthy && !realtimeHealthy) requestSync();
                realtimeHealthy = healthy;
                if (healthy) realtimeRetryAttempt = 0;
                else scheduleRealtimeRetry();
                schedulePoll();
            });
        } catch (e) {
            unsubscribeRealtime = null;
            realtimeHealthy = false;
            scheduleRealtimeRetry();
        }
    };

    const stopRealtime = () => {
        realtimeGeneration++;
        realtimeHealthy = false;
        if (realtimeRetryTimer) { clearTimeout(realtimeRetryTimer); realtimeRetryTimer = null; }
        if (unsubscribeRealtime) { try { unsubscribeRealtime(); } catch (e) {} }
        unsubscribeRealtime = null;
    };

    const settleWrite = (w) => {
        const i = pending.indexOf(w);
        if (i !== -1) pending.splice(i, 1);
    };

    const applyWriteResult = (res) => {
        const docs = res && Array.isArray(res.docs) ? res.docs : [];
        let complete = true;
        for (const d of docs) {
            if (!('v' in d)) { complete = false; continue; }
            if (typeof d.s === 'number' && d.s > 0) putDoc(d.r, d.k, d.v === undefined ? null : d.v, d.s);
        }
        if (!complete || res.replayed) requestSync();
    };

    const rpcFailureToError = (e, path) => {
        if (e instanceof SbRpcError) {
            if (e.code === '42501' || e.status === 401 || e.status === 403) return firebaseLikeError('permission_denied', path);
            return firebaseLikeError(e.message || 'error', path, e.detail);
        }
        return firebaseLikeError('unknown', path, String((e && e.message) || e));
    };

    const waitDeps = async (w) => {
        const deps = pending.filter((x) => x !== w && x.seq < w.seq && keysOverlap(x.keys, w.keys));
        await Promise.all(deps.map((d) => d.done.catch(() => {})));
    };

    let writeSeq = 0;
    const enqueueWrite = (ops, path, overlay) => {
        const w: any = { seq: ++writeSeq, ops, path, overlay, keys: ops.flatMap(opDocKeys), opId: newOpId(), scope: authScope };
        let resolveDone;
        let rejectDone;
        w.done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
        pending.push(w);
        if (overlay) notify();
        (async () => {
            await waitDeps(w);
            for (;;) {
                if (closed) { settleWrite(w); rejectDone(firebaseLikeError('disconnect', path)); return; }
                await waitForLink();
                if (closed) continue;
                if (authScope !== w.scope) {
                    if (authed) { settleWrite(w); notify(); rejectDone(firebaseLikeError('permission_denied', path)); return; }
                    await delay(retrySteps[Math.min(retryAttempt, retrySteps.length - 1)]);
                    continue;
                }
                const sendEpoch = sessionEpoch;
                try {
                    const res = await rpc('zoe_write', { p_op_id: w.opId, p_ops: ops.map((o) => Object.assign({}, o)) });
                    retryAttempt = 0;
                    setConnected(true);
                    if (sendEpoch === sessionEpoch) applyWriteResult(res);
                    settleWrite(w);
                    notify();
                    resolveDone(res);
                    return;
                } catch (e) {
                    if (e instanceof SbNetworkError) {
                        setConnected(false);
                        scheduleRetry();
                        await delay(retrySteps[Math.min(retryAttempt, retrySteps.length - 1)]);
                        continue;
                    }
                    settleWrite(w);
                    notify();
                    rejectDone(rpcFailureToError(e, path));
                    return;
                }
            }
        })();
        return w.done;
    };

    const writeOpsFor = (path, value) => {
        if (value instanceof SbIncrement) {
            if (path.length < 2) throw new Error('increment() needs a path below a node');
            return [{ k: 'inc', p: path, d: value.delta }];
        }
        return [{ k: 'set', p: path, v: toCanonical(value, describe(path)) }];
    };

    db.ref = (path?) => {
        if (path === undefined) return new SbRef(db, []);
        if (typeof path !== 'string' || !path.length) throw new Error('Invalid path "' + path + '": paths must be non-empty strings');
        const info = path.match(/^\/*\.info(\/|$)/);
        if (info) return new SbRef(db, ['.info'].concat(parsePath(path.slice(info[0].length))));
        return new SbRef(db, parsePath(path));
    };

    const assertWritable = (fn, path) => {
        if (!path.length) throw new Error(fn + '() on the database root is not supported');
        if (path[0] === '.info') throw new Error(fn + '() failed: ' + describe(path) + ' is read-only');
    };

    db.onValue = (ref, cb, errCb) => {
        if (ref._path[0] === '.info') {
            const kind = ref._path[1] === 'connected' ? 'connected' : ref._path[1] === 'serverTimeOffset' ? 'offset' : null;
            if (!kind) throw new Error('Unsupported .info path ' + describe(ref._path));
            const l = { ref, path: ref._path, cb, errCb, kind, fired: false, last: null };
            infoListeners.add(l);
            Promise.resolve().then(fireInfo);
            return () => infoListeners.delete(l);
        }
        const l: any = { ref, path: ref._path, cb, errCb, fired: false, last: null, cancelled: false };
        listeners.add(l);
        if (forbidden || !ready) {
            requestSync();
        } else {
            Promise.resolve().then(() => fireListener(l));
        }
        return () => { l.cancelled = true; listeners.delete(l); };
    };

    db.off = (ref) => {
        const key = describe(ref._path);
        listeners.forEach((l: any) => { if (describe(l.path) === key) { l.cancelled = true; listeners.delete(l); } });
        infoListeners.forEach((l: any) => { if (describe(l.path) === key) infoListeners.delete(l); });
    };

    db.get = async (ref) => {
        const path = ref._path;
        if (path[0] === '.info') return new SbSnapshot(ref, path[1] === 'connected' ? connected : serverOffset);
        if (!path.length) throw new Error('get() on the database root is not supported');
        let res;
        try {
            res = await rpc('zoe_read', { p_root: path[0], p_key: path.length > 1 ? path[1] : null });
        } catch (e) {
            if (e instanceof SbNetworkError) {
                setConnected(false);
                scheduleRetry();
                throw new Error('Client is offline.');
            }
            throw rpcFailureToError(e, path);
        }
        for (const d of (res && res.docs) || []) {
            if (typeof d.s === 'number' && d.s > 0) putDoc(d.r, d.k, d.v === undefined ? null : d.v, d.s);
        }
        let node = null;
        if (path.length === 1) {
            const out = {};
            for (const d of (res && res.docs) || []) if (d.v !== null && d.v !== undefined) out[d.k] = d.v;
            node = Object.keys(out).length ? out : null;
        } else {
            const doc = ((res && res.docs) || []).find((d) => d.k === path[1]);
            node = getAt(doc ? doc.v : null, path.slice(2));
        }
        notify();
        return new SbSnapshot(ref, node);
    };

    db.set = (ref, value) => {
        const path = ref._path;
        assertWritable('set', path);
        const ops = writeOpsFor(path, value);
        return enqueueWrite(ops, path, true).then(() => undefined);
    };

    db.update = (ref, values) => {
        const base = ref._path;
        if (base[0] === '.info') assertWritable('update', base);
        if (values === null || typeof values !== 'object' || Array.isArray(values)) {
            throw new Error('update() failed: first argument must be an object containing the children to replace');
        }
        const ops = [];
        const paths = [];
        for (const rel of Object.keys(values)) {
            const full = base.concat(parsePath(rel));
            assertWritable('update', full);
            paths.push(full);
            ops.push(...writeOpsFor(full, values[rel]));
        }
        const seen = new Set(paths.map(describe));
        if (seen.size !== paths.length) throw new Error('update() failed: the same path is written twice');
        for (const full of paths) {
            for (let n = 1; n < full.length; n++) {
                const prefix = describe(full.slice(0, n));
                if (seen.has(prefix)) throw new Error('update() failed: path ' + prefix + ' is an ancestor of another path ' + describe(full));
            }
        }
        if (!ops.length) return Promise.resolve();
        if (ops.length > SB_OPS_PER_WRITE && ops.some((op) => op.k === 'inc')) {
            throw new Error('update() failed: ' + ops.length + ' paths with increment() exceed the atomic write limit of ' + SB_OPS_PER_WRITE);
        }
        const writes = [];
        for (let i = 0; i < ops.length; i += SB_OPS_PER_WRITE) writes.push(enqueueWrite(ops.slice(i, i + SB_OPS_PER_WRITE), base, true));
        return Promise.all(writes).then(() => undefined);
    };

    db.runTransaction = (ref, updateFn) => {
        const path = ref._path;
        assertWritable('runTransaction', path);
        let outer;
        const run = async () => {
            const txScope = authScope;
            const gate: any = { seq: ++writeSeq, keys: opDocKeys({ p: path }), ops: [], overlay: false, scope: txScope };
            let release;
            gate.done = new Promise<void>((res) => { release = res; });
            pending.push(gate);
            try {
                await waitDeps(gate);
                let base;
                if (ready && !forbidden) {
                    base = cloneCanonical(serverValueAt(path));
                } else {
                    await waitForLink();
                    const snap = await db.get(ref);
                    base = cloneCanonical(snap._node);
                }
                for (let attempt = 0; attempt < SB_TX_MAX_RETRIES; attempt++) {
                    const proposed = updateFn(exportVal(cloneCanonical(base)));
                    if (proposed === undefined) return { committed: false, snapshot: new SbSnapshot(ref, cloneCanonical(base)) };
                    const next = toCanonical(proposed, describe(path));
                    const op = { k: 'cas', p: path, x: base, v: next };
                    const opId = newOpId();
                    await waitForLink();
                    let res;
                    let lost = null;
                    let lostAttempts = 0;
                    const giveUp = () => {
                        lost.txOutcome = 'unknown';
                        lost.txServerUnread = true;
                        hooks.onTxOutcomeUnknown(path);
                        return lost;
                    };
                    let sendEpoch = sessionEpoch;
                    for (;;) {
                        if (closed) throw lost ? giveUp() : firebaseLikeError('disconnect', path);
                        if (authScope !== txScope) {
                            if (authed) throw lost ? giveUp() : firebaseLikeError('permission_denied', path);
                            await delay(retrySteps[Math.min(lostAttempts, retrySteps.length - 1)]);
                            continue;
                        }
                        sendEpoch = sessionEpoch;
                        try {
                            res = await rpc('zoe_write', { p_op_id: opId, p_ops: [op] });
                            break;
                        } catch (e) {
                            if (!(e instanceof SbNetworkError)) {
                                if (lost) throw giveUp();
                                throw rpcFailureToError(e, path);
                            }
                            setConnected(false);
                            scheduleRetry();
                            if (!lost && !e.unsent) {
                                lost = disconnectError();
                                txDisconnectResolving.set(outer, lost);
                            }
                            if (!closed) {
                                await delay(retrySteps[Math.min(lostAttempts++, retrySteps.length - 1)]);
                                await waitForLink();
                            }
                            if (closed) throw lost ? giveUp() : firebaseLikeError('disconnect', path);
                        }
                    }
                    setConnected(true);
                    if (res && res.ok) {
                        const current = sendEpoch === sessionEpoch;
                        if (current) applyWriteResult(res);
                        notify();
                        const committed = { committed: true, snapshot: new SbSnapshot(ref, res.replayed || !current ? next : cloneCanonical(serverValueAt(path))) };
                        if (lost) {
                            (committed as any).txOutcome = 'applied';
                            (committed as any).txProven = true;
                        }
                        return committed;
                    }
                    if (res && res.conflict) {
                        if (lost) {
                            lost.txOutcome = 'not-applied';
                            throw lost;
                        }
                        base = res.value === undefined ? null : res.value;
                        if (path.length >= 2) putDocFromConflict(path, base);
                        continue;
                    }
                    throw firebaseLikeError('unknown', path, 'bad transaction response');
                }
                throw firebaseLikeError('maxretry', path, 'Transaction had too many retries');
            } finally {
                const i = pending.indexOf(gate);
                if (i !== -1) pending.splice(i, 1);
                release();
                if (outer) txDisconnectResolving.delete(outer);
            }
        };
        outer = run();
        return outer;
    };

    const putDocFromConflict = (path, value) => {
        if (path.length !== 2) return;
        const docs = server.get(path[0]);
        const entry = docs && docs.get(path[1]);
        if (entry && canonicalJson(entry.v) !== canonicalJson(value)) requestSync();
    };

    db.goOnline = () => {
        if (closed) return;
        online = true;
        wakeWaiters();
        startRealtime();
        requestSync();
    };

    db.goOffline = () => {
        online = false;
        stopRealtime();
        setConnected(false);
    };

    db.setTenantTopic = (topic) => {
        if (tenantTopic === topic) return;
        stopRealtime();
        tenantTopic = topic;
        startRealtime();
    };

    db.setAuthed = (value, scope?) => {
        const next = !!value;
        const nextScope = next && typeof scope === 'string' && scope ? scope : null;
        authScope = nextScope;
        if (nextScope !== cacheScope) {
            cacheScope = nextScope;
            cacheTried = false;
        }
        if (authed === next) return;
        authed = next;
        if (authed) {
            startRealtime();
            requestSync();
        } else {
            stopRealtime();
        }
    };

    db.resetForSignOut = () => {
        sessionEpoch++;
        authScope = null;
        stopRealtime();
        authed = false;
        server.clear();
        cursor = 0;
        pullFullHead = null;
        pullStage = null;
        pullStageAbove = 0;
        if (cacheSaveTimer) { clearTimeout(cacheSaveTimer); cacheSaveTimer = null; }
        cacheGeneration++;
        cacheScope = null;
        cacheTried = false;
        cacheTenant = null;
        serverTenant = null;
        lastCacheSaveAt = 0;
        clearDocsCache();
        ready = false;
        forbidden = null;
        tenantTopic = null;
        listeners.forEach((l: any) => { l.fired = false; l.last = null; });
    };

    db.onBrowserOnline = () => {
        wakeWaiters();
        if (online) { startRealtime(); requestSync(); }
    };

    db.onBrowserOffline = () => {
        setConnected(false);
    };

    db.start = () => {
        startRealtime();
        requestSync();
    };

    db.close = (reason) => {
        closed = true;
        stopRealtime();
        if (retryTimer) clearTimeout(retryTimer);
        if (pollTimer) clearTimeout(pollTimer);
        if (cacheSaveTimer) clearTimeout(cacheSaveTimer);
        retryTimer = null;
        pollTimer = null;
        cacheSaveTimer = null;
        wakeWaiters();
        listeners.clear();
        infoListeners.clear();
        void reason;
    };

    db.isReady = () => ready;
    db.cursor = () => cursor;
    db.snapshotState = () => {
        const out = {};
        server.forEach((docs, root) => docs.forEach((entry, key) => { out[docKey(root, key)] = entry; }));
        return { cursor, docs: out };
    };

    return db;
}
