/** សម្រាប់តេស្តតែប៉ុណ្ណោះ៖ Firebase-shaped memory SDK និង Supabase adapter ពិត + RPC ក្នុងសតិ។ គ្មាន rules/RLS ពិត។ */
import { createSupabaseDatabase, SbIncrement, canonicalJson } from '../../src/services/supabase-rtdb';
import { firebaseState } from '../../src/core/state';

const copy = (value: any) => value == null ? null : JSON.parse(JSON.stringify(value));
export async function returnMemoryBackend(backend: 'firebase' | 'supabase', initial: Record<string, any>) {
    const store = copy(initial);
    let seq = 1;
    const listeners = new Set<() => void>();
    const writes: any[] = [];
    const errors: any[] = [];
    const get = (path: string | string[]) => copy((Array.isArray(path) ? path : path.split('/')).filter(Boolean).reduce((v, k) => v?.[k], store));
    const set = (path: string[], value: any) => {
        let node = store;
        for (const key of path.slice(0, -1)) node = node[key] ||= {};
        if (value == null) delete node[path.at(-1)!]; else node[path.at(-1)!] = copy(value);
    };
    const allDocs = () => Object.entries(store).flatMap(([r, root]: any) => Object.entries(root).map(([k, v]) => ({ r, k, v: copy(v), s: seq })));
    const doc = (r: string, k: string) => ({ r, k, v: get([r, k]), s: seq });
    let db: any, sdk: any;
    const previous = firebaseState.fb as any;
    if (backend === 'firebase') {
        db = firebaseState.db;
        const ref = (_db: any, path = '') => ({ path, key: path.split('/').at(-1) });
        const snapshot = (r: any) => ({ val: () => get(r.path), exists: () => get(r.path) !== null });
        sdk = { ...previous, ref, get: async (r: any) => snapshot(r), increment: (delta: number) => ({ __inc: delta }),
            runTransaction: async (r: any, update: any) => {
                const proposed = update(get(r.path));
                if (proposed !== undefined) { writes.push({ kind: 'cas', path: r.path }); set(r.path.split('/'), proposed); listeners.forEach(fn => fn()); }
                return { committed: proposed !== undefined, snapshot: snapshot(r) };
            },
            update: async (r: any, values: any) => {
                for (const [key, value] of Object.entries(values) as any) {
                    const p = [r.path, key].filter(Boolean).join('/').split('/');
                    set(p, value?.__inc !== undefined ? (get(p) || 0) + value.__inc : value);
                    writes.push({ kind: 'update', path: p.join('/') });
                }
                listeners.forEach(fn => fn());
            },
            onValue: (r: any, fn: any) => { const fire = () => fn(snapshot(r)); listeners.add(fire); fire(); return () => listeners.delete(fire); },
            off: () => {}
        };
    } else {
        const transport = { subscribe: () => () => {}, ping: async () => true,
            rpc: async (fn: string, args: any) => {
                if (fn === 'zoe_now') return Date.now();
                if (fn === 'zoe_pull') return { seq, head: seq, more: false, reset: true, tenant: 't-881859', now: Date.now(), rows: allDocs() };
                if (fn === 'zoe_read') return { now: Date.now(), docs: args.p_key == null ? allDocs().filter(d => d.r === args.p_root) : [doc(args.p_root, args.p_key)] };
                if (fn !== 'zoe_write_v2') throw new Error('Unexpected memory RPC ' + fn);
                if (args.p_expected_tenant !== 't-881859') throw new Error('Unexpected tenant');
                for (const op of args.p_ops) if (op.k === 'cas' && canonicalJson(get(op.p)) !== canonicalJson(op.x ?? null)) {
                    return { ok: false, conflict: true, value: get(op.p), now: Date.now() };
                }
                const touched = new Set<string>();
                for (const op of args.p_ops) {
                    if (!['cas', 'set', 'inc'].includes(op.k)) throw new Error('Unexpected memory operation ' + op.k);
                    const oldRoot = op.p.length === 1 ? Object.keys(get(op.p) || {}) : [];
                    set(op.p, op.k === 'inc' ? (get(op.p) || 0) + op.d : op.v);
                    const keys = op.p.length === 1 ? [...oldRoot, ...Object.keys(get(op.p) || {})] : [op.p[1]];
                    keys.forEach(k => touched.add(op.p[0] + '/' + k));
                    writes.push(copy(op));
                }
                seq++;
                return { ok: true, seq, now: Date.now(), docs: [...touched].map(key => { const [r, k] = key.split('/'); return doc(r, k); }) };
            }
        };
        db = createSupabaseDatabase(transport, { onListenerError: (e: any) => errors.push(e), onSynced: () => {}, onForbidden: (e: any) => errors.push(e) },
            { docsCache: null, writeJournal: null, pollFallbackMs: 600000 });
        db.setTenantTopic('zoe:t-881859'); db.setAuthed(true, 'matrix-supabase');
        sdk = { ...previous, ref: (_db: any, path?: string) => db.ref(path), get: (r: any) => db.get(r),
            update: (r: any, v: any) => db.update(r, v), set: (r: any, v: any) => db.set(r, v),
            runTransaction: (r: any, fn: any) => db.runTransaction(r, fn), increment: (v: number) => new SbIncrement(v),
            onValue: (r: any, fn: any) => db.onValue(r, fn), off: (r: any) => db.off(r) };
    }
    firebaseState.db = db;
    firebaseState.fb = sdk;
    return { get, writes, errors, sdk, db, close: () => { listeners.clear(); if (backend === 'supabase') db.close('test'); } };
}
