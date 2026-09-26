import { dataState, firebaseState, lookupState, scanState, securityState, sheetImportState, uiState, ztoState } from './core/state';
import groups from './_generated-state.json';
import { installAuditActionAnnotations, installAuditClassAdapter } from './audit-compat';
import { commitNow } from './app/flush';

export function exposeGlobals() {
    const modules = import.meta.glob(
        ['./core/**/*.ts', './domain/**/*.ts', './features/**/*.ts', './services/**/*.ts', './ui/**/*.ts',
            './app/behaviors/**/*.ts', './app/lifecycle/layers.ts', './app/refs.ts', './app/flush.ts'],
        { eager: true }
    );
    const w = window as any;
    const NO_WRAP = new Set(['commitNow', 'renderNow', 'setImmediateCommit']);
    let depth = 0;
    const settle = () => { try { commitNow(); } catch { } };
    const wrap = (key: string, fn: (...args: any[]) => any) => {
        if (NO_WRAP.has(key) || /^[A-Z]|^use[A-Z]/.test(key)) return fn;
        const wrapped = function (this: unknown, ...args: any[]) {
            depth++;
            try { return fn.apply(this, args); } finally { depth--; if (depth === 0) settle(); }
        };
        Object.defineProperty(wrapped, 'length', { value: fn.length });
        Object.defineProperty(wrapped, 'name', { value: fn.name });
        (wrapped as any).__auditOrig = fn;
        wrapped.toString = () => Function.prototype.toString.call(fn);
        return wrapped;
    };
    const wrapCache = new WeakMap<(...args: any[]) => any, (...args: any[]) => any>();
    const wrapped = (key: string, fn: (...args: any[]) => any) => {
        let w2 = wrapCache.get(fn);
        if (!w2) { w2 = wrap(key, fn); wrapCache.set(fn, w2); }
        return w2;
    };
    for (const mod of Object.values(modules) as Record<string, any>[]) {
        for (const key of Object.keys(mod)) {
            if (key.startsWith('__') || key in w) continue;
            const value = mod[key];
            if (typeof value !== 'function') { w[key] = value; continue; }
            const rebind = typeof mod.__auditRebind === 'function' ? mod.__auditRebind : null;
            Object.defineProperty(w, key, {
                configurable: true,
                enumerable: true,
                get: () => {
                    const cur = mod[key];
                    return typeof cur === 'function' ? wrapped(key, cur) : cur;
                },
                set: (v) => {
                    const target = v && v.__auditOrig ? v.__auditOrig : v;
                    if (rebind && rebind(key, target)) return;
                    Object.defineProperty(w, key, { configurable: true, enumerable: true, writable: true, value: v });
                }
            });
        }
    }
    installAuditClassAdapter();
    installAuditActionAnnotations();
    const stores: Record<string, any> = { firebaseState, dataState, scanState, uiState, securityState, lookupState, sheetImportState, ztoState };
    for (const [store, fields] of Object.entries(groups as Record<string, { name: string }[]>)) {
        for (const f of fields) {
            Object.defineProperty(w, f.name, {
                configurable: true,
                get: () => stores[store][f.name],
                set: (v) => { stores[store][f.name] = v; }
            });
        }
    }
}
