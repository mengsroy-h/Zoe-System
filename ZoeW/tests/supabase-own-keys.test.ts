import { describe, expect, it } from 'vitest';
import { createSupabaseDatabase, exportVal, getAt, setAt, toCanonical } from '../src/services/supabase-rtdb';

const special = () => JSON.parse('{"__proto__":{"kept":true},"constructor":true,"toString":true,"normal":{"n":2}}');

describe('កូនសោ RTDB ដែលដូច prototype', () => {
    it('រក្សាកូនសោទាំងអស់ពេលបម្លែង និងអានចេញ', () => {
        expect(JSON.stringify(toCanonical(special(), '/r'))).toBe(JSON.stringify(special()));
        expect(exportVal(special())).toEqual(special());
        expect(Object.getPrototypeOf(exportVal(special()))).toBe(Object.prototype);
        expect(exportVal({ 0: 'a', 1: 'b' })).toEqual(['a', 'b']);
    });
    it('អានតែកូនសោផ្ទាល់ និងមិនកែ prototype ពេលសរសេរ', () => {
        for (const key of ['__proto__', 'constructor', 'toString']) {
            expect(getAt({}, [key])).toBeNull();
            const value = setAt(special(), [key, 'nested'], 3);
            expect(getAt(value, [key, 'nested'])).toBe(3);
            expect(getAt(value, ['normal', 'n'])).toBe(2);
            expect(getAt(setAt(value, [key], null), [key])).toBeNull();
        }
        expect(({} as any).nested).toBeUndefined();
    });
    it('អាន root និង snapshot កូនដោយមិនបាត់កូនសោ', async () => {
        const rows = Object.entries(special()).map(([k, v]) => ({ r: 'zoew_barcode_registry', k, v, s: 1 }));
        const transport = {
            rpc: async (fn: string) => {
                if (fn === 'zoe_read') return { now: Date.now(), docs: rows };
                if (fn === 'zoe_pull') return { seq: 1, more: false, reset: true, head: 1, tenant: 't1', now: Date.now(), rows };
                throw new Error(fn);
            },
            ping: async () => true,
            subscribe: () => () => {}
        };
        const db = createSupabaseDatabase(transport, {}, { pollFallbackMs: 600000 });
        db.setAuthed(true, 'scope');
        try {
            const snapshot = await db.get(db.ref('zoew_barcode_registry'));
            expect(snapshot.val()).toEqual(special());
            expect(snapshot.child('__proto__/kept').val()).toBe(true);
            expect(snapshot.child('normal').hasChild('constructor')).toBe(false);
            let seen: any;
            const off = db.onValue(db.ref('zoew_barcode_registry'), (snap: any) => { seen = snap.val(); });
            await expect.poll(() => seen).toEqual(special());
            off();
        } finally { db.close(); }
    });
    it('set និង update ផ្ញើ JSON ដែលរក្សាកូនសោពិសេស', async () => {
        const sent: any[] = [];
        const transport = {
            rpc: async (fn: string, args: any) => {
                if (fn === 'zoe_pull') return { seq: 0, more: false, reset: true, head: 0, tenant: 't1', now: Date.now(), rows: [] };
                if (fn !== 'zoe_write') throw new Error(fn);
                sent.push(JSON.parse(JSON.stringify(args.p_ops)));
                return { ok: true, seq: sent.length, now: Date.now(), docs: [] };
            },
            ping: async () => true,
            subscribe: () => () => {}
        };
        const db = createSupabaseDatabase(transport, {}, { pollFallbackMs: 600000 });
        db.setAuthed(true, 'scope');
        try {
            await db.set(db.ref('root'), special());
            expect(sent[0][0].v).toEqual(special());
            await db.update(db.ref('root'), { nested: special() });
            expect(sent[1][0].v).toEqual(special());
            await db.update(db.ref('root'), special());
            expect(sent[2].map((op: any) => op.p[1])).toEqual(Object.keys(special()));
            expect(sent[2].find((op: any) => op.p[1] === '__proto__').v).toEqual({ kept: true });
        } finally { db.close(); }
    });

});
