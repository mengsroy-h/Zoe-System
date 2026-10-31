// SDK data semantics only. Real backend rules and concurrency remain separate integration gates.
export function createScanMemorySdk(token = 'fixture-token') {
    const store: Record<string, any> = {};
    const clone = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const parts = (path: string) => String(path || '').split('/').filter(Boolean);
    const get = (path: string) => clone(parts(path).reduce((value: any, key: string) => value?.[key], store) ?? null);
    const put = (path: string, value: any) => {
        const keys = parts(path), last = keys.pop();
        if (last === undefined) throw new Error('Fixture root set is unsupported');
        let target = store;
        for (const key of keys) target = target[key] ||= {};
        if (value === null || value === undefined) delete target[last];
        else if (typeof value?.['.sv']?.increment === 'number') target[last] = (Number(target[last]) || 0) + value['.sv'].increment;
        else if (value?.['.sv'] === 'timestamp') target[last] = Date.now();
        else target[last] = clone(value);
    };
    const snapshot = (ref: any, value: any) => ({ ref, key: ref.key, val: () => clone(value), exists: () => value !== null && value !== undefined });
    const sdk = {
        ref: (db: any, path = '') => ({ db, path, key: parts(path).at(-1) || null }),
        getIdTokenResult: async () => ({ token }),
        get: async (ref: any) => snapshot(ref, get(ref.path)),
        set: async (ref: any, value: any) => put(ref.path, value),
        update: async (ref: any, patch: any) => {
            for (const [key, value] of Object.entries(patch)) put([ref.path, key].filter(Boolean).join('/'), value);
        },
        runTransaction: async (ref: any, update: any) => {
            const before = get(ref.path), next = update(clone(before));
            if (next === undefined) return { committed: false, snapshot: snapshot(ref, before) };
            put(ref.path, next);
            return { committed: true, snapshot: snapshot(ref, get(ref.path)) };
        },
        increment: (amount: number) => ({ '.sv': { increment: amount } }),
        onValue: () => () => {},
        off: () => {}
    };
    return { sdk, store, get, put, reset: () => { for (const key of Object.keys(store)) delete store[key]; } };
}
