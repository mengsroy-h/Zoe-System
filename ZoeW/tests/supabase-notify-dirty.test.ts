/**
 * ⛔ SCALE-3 ៖ `notify()` របស់ adapter Supabase គណនា និង serialize (`canonicalJson`) តម្លៃរបស់ **គ្រប់ listener** រាល់ពេលហៅ
 *    (រាល់ pull · poll ទទេ · ការសរសេរ · `get()`) ➜ root ធំ (ធុងសំរាម ៣០ ថ្ងៃ · ប្រវត្តិ) ត្រូវ serialize ឡើងវិញ ទោះគ្មានអ្វីប្រែក្នុងវា។
 * ⛔ listener ត្រូវគណនាឡើងវិញតែពេល root របស់វាប្រែពិត (doc server · overlay ការសរសេរកំពុងរង់ចាំ · ការប្តូរ scope/សម័យ) — វាស់តាម
 *    **ចំនួនការអាន** តម្លៃ doc (getter រាប់) មិនមែនតាមម៉ោង · ទិសផ្ទុយ ៖ ការប្រែក្នុង root ធំនៅតែទៅដល់ listener របស់វា។
 */
import { describe, expect, it } from 'vitest';
import * as rtdb from '../src/services/supabase-rtdb';

const BIG = 60;
let reads = 0;
const countedDoc = (i: number) => {
    const o: any = {};
    Object.defineProperty(o, 'x', { enumerable: true, get() { reads++; return i; } });
    return o;
};

function fakeTransport() {
    let seq = 0;
    const queue: any[] = [];
    const writeMode = { value: 'ok' as 'ok' | 'reject' | 'hang' };
    const holdFull = { value: null as null | Promise<void> };
    let tenant = 't1';
    let pulls = 0;
    const full = () => {
        const rows: any[] = [];
        for (let i = 0; i < BIG; i++) rows.push({ r: 'big', k: 'd' + i, v: countedDoc(i), s: ++seq });
        rows.push({ r: 'small', k: 's1', v: { n: 1 }, s: ++seq });
        return rows;
    };
    const transport = {
        ping: async () => {},
        subscribe: () => () => {},
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull') {
                pulls++;
                if (!args.p_since) {
                    if (holdFull.value) await holdFull.value;
                    return { seq: seq + BIG + 1, more: false, reset: true, head: seq + BIG + 1, tenant, now: Date.now(), rows: full() };
                }
                const next = queue.shift() || [];
                if (next instanceof Error) throw next;
                const reset = !Array.isArray(next) && !!next.reset;
                if (!Array.isArray(next) && next.tenant) tenant = next.tenant;
                const rows = Array.isArray(next) ? next : next.rows;
                for (const r of rows) seq = Math.max(seq, r.s);
                return reset ? { seq, more: false, reset: true, head: seq, tenant, now: Date.now(), rows } : { seq, more: false, reset: false, tenant, now: Date.now(), rows };
            }
            if (fn === 'zoe_write') {
                if (writeMode.value === 'reject') throw new Error('check_violation');
                if (writeMode.value === 'hang') return new Promise(() => {});
                const docs = args.p_ops.map((op: any) => ({ r: op.p[0], k: op.p[1], v: op.v, s: ++seq }));
                return { ok: true, seq, docs, now: Date.now() };
            }
            return { ok: 1 };
        },
    };
    return { transport, queue, writeMode, holdFull, nextSeq: () => ++seq, pulls: () => pulls };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean) {
    for (let i = 0; i < 400 && !fn(); i++) await sleep(5);
    expect(fn()).toBe(true);
}

async function open() {
    const fake = fakeTransport();
    const db = rtdb.createSupabaseDatabase(fake.transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
        { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    const seen = { big: [] as any[], small: [] as any[] };
    db.onValue(db.ref('big'), (s: any) => seen.big.push(s.val()));
    db.onValue(db.ref('small'), (s: any) => seen.small.push(s.val()));
    await until(() => seen.big.length === 1 && seen.small.length === 1);
    await sleep(20);
    return { db, fake, seen };
}

async function pullOnce(db: any, fake: any) {
    const before = fake.pulls();
    db.goOnline();
    await until(() => fake.pulls() > before);
    await sleep(20);
}

describe('SCALE-3 ៖ notify() គណនាឡើងវិញតែ root ដែលប្រែ', () => {
    it('ជាន់អប្បបរមា ៖ root ធំត្រូវបានអានពេលទទួលដំបូង (getter រាប់ពិត)', async () => {
        reads = 0;
        const { seen } = await open();
        expect(reads).toBeGreaterThanOrEqual(BIG);
        expect(Object.keys(seen.big[0]).length).toBe(BIG);
    });

    it('⛔ poll ទទេ (គ្មាន row) ➜ គ្មាន listener ណាត្រូវ serialize ឡើងវិញ', async () => {
        const { db, fake, seen } = await open();
        reads = 0;
        await pullOnce(db, fake);
        await pullOnce(db, fake);
        expect(reads).toBe(0);
        expect(seen.big.length).toBe(1);
        expect(seen.small.length).toBe(1);
    });

    it('⛔ pull ប្រែតែ root តូច ➜ listener តូចទទួលតម្លៃថ្មី · root ធំមិនត្រូវអាន', async () => {
        const { db, fake, seen } = await open();
        reads = 0;
        fake.queue.push([{ r: 'small', k: 's1', v: { n: 2 }, s: fake.nextSeq() }]);
        await pullOnce(db, fake);
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 2 } });
        expect(reads).toBe(0);
        expect(seen.big.length).toBe(1);
    });

    it('⛔ ការសរសេរ (overlay ➜ ចម្លើយ server) លើ root តូច ➜ root ធំមិនត្រូវអាន', async () => {
        const { db, seen } = await open();
        reads = 0;
        const write = db.set(db.ref('small/s2'), { n: 3 });
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 }, s2: { n: 3 } });
        await write;
        await sleep(20);
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 }, s2: { n: 3 } });
        expect(reads).toBe(0);
        expect(seen.big.length).toBe(1);
    });

    it('⛔ ការសរសេរត្រូវបដិសេធ ➜ overlay ដកចេញពី listener វិញ (គ្មានតម្លៃខុសនៅលើអេក្រង់)', async () => {
        const { db, fake, seen } = await open();
        fake.writeMode.value = 'reject';
        const write = db.set(db.ref('small/bad'), { n: 9 });
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 }, bad: { n: 9 } });
        await expect(write).rejects.toBeTruthy();
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 } });
    });

    it('⛔ ការសរសេរកំពុងរង់ចាំរបស់គណនីមួយ ➜ scope ប្តូរ ➜ pull បន្ទាប់មិនបង្ហាញ overlay នោះទៀត', async () => {
        const { db, fake, seen } = await open();
        fake.writeMode.value = 'hang';
        db.set(db.ref('small/mine'), { n: 7 }).catch(() => {});
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 }, mine: { n: 7 } });
        await sleep(20);
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 }, mine: { n: 7 } });
        db.setAuthed(true, 'other');
        await pullOnce(db, fake);
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 1 } });
    });

    it('ទិសផ្ទុយ ៖ pull ប្រែ doc ក្នុង root ធំ ➜ listener ធំទទួលតម្លៃថ្មី', async () => {
        const { db, fake, seen } = await open();
        fake.queue.push([{ r: 'big', k: 'd0', v: { x: 'new' }, s: fake.nextSeq() }]);
        await pullOnce(db, fake);
        expect(seen.big.length).toBe(2);
        expect(seen.big[1].d0).toEqual({ x: 'new' });
        expect(seen.small.length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ server ឆ្លើយ reset កណ្តាលសម័យ (pull ពេញ ➜ stage) ➜ listener ដែលធ្លាប់ទទួលរួចទទួលតម្លៃថ្មី', async () => {
        const { db, fake, seen } = await open();
        const rows: any[] = [];
        for (let i = 0; i < BIG; i++) rows.push({ r: 'big', k: 'd' + i, v: { x: i }, s: fake.nextSeq() });
        rows.push({ r: 'small', k: 's1', v: { n: 5 }, s: fake.nextSeq() });
        fake.queue.push({ reset: true, rows });
        await pullOnce(db, fake);
        expect(seen.small[seen.small.length - 1]).toEqual({ s1: { n: 5 } });
        expect(seen.big.length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ listener ថ្មីលើ root ទទេ ភ្ជាប់ក្រោយ permission_denied ➜ pull ជោគជ័យបន្ទាប់ផ្តល់ snapshot ដំបូង (null)', async () => {
        const { db, fake } = await open();
        fake.queue.push(new rtdb.SbRpcError('denied', '42501', 403, ''));
        await pullOnce(db, fake);
        const empty: any[] = [];
        db.onValue(db.ref('nothing'), (s: any) => empty.push(s.val()));
        await until(() => empty.length === 1);
        expect(empty).toEqual([null]);
    });

    it('⛔ pull ឆ្លើយហាងផ្សេង (tenant) ➜ ទិដ្ឋភាពចាស់ត្រូវសម្អាត ៖ notify ណាមួយខណៈ pull ពេញកំពុងរង់ចាំ មិនបង្ហាញទិន្នន័យហាងមុនទៀត', async () => {
        const { db, fake, seen } = await open();
        let release: () => void = () => {};
        fake.holdFull.value = new Promise<void>((r) => { release = r; });
        fake.queue.push({ tenant: 't2', rows: [] });
        db.goOnline();
        await sleep(30);
        await db.get(db.ref('small'));
        expect(seen.big[seen.big.length - 1]).toBe(null);
        fake.holdFull.value = null;
        release();
        await until(() => seen.big.length >= 3 && seen.big[seen.big.length - 1] !== null);
        expect(Object.keys(seen.big[seen.big.length - 1]).length).toBe(BIG);
    });

    it('ទិសផ្ទុយ ៖ resetForSignOut ➜ ចូលម្តងទៀត ➜ listener ទាំងពីរទទួលតម្លៃពី pull ពេញម្តងទៀត', async () => {
        const { db, seen } = await open();
        db.resetForSignOut();
        db.setAuthed(true, 'scope');
        await until(() => seen.big.length === 2 && seen.small.length === 2);
        expect(Object.keys(seen.big[1]).length).toBe(BIG);
        expect(seen.small[1]).toEqual({ s1: { n: 1 } });
    });
});
