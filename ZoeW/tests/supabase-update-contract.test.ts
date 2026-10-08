/**
 * ⛔ SUPABASE-6 ៖ `update()` ពហុផ្លូវរបស់ RTDB ជា atomic ។ `zoe_write` ទទួល ≤ `SB_OPS_PER_WRITE` (៥០០) op ក្នុងមួយការហៅ (migration ៖ ⛔ មិនប្តូរ)
 *    ➜ adapter បំបែក update ធំជាការសរសេរច្រើន ដែល atomic **ដាច់ៗពីគ្នា** ➜ ការបំបែកមានសុវត្ថិភាពតែលើ payload idempotent (`null` ·
 *    តម្លៃ state ដាច់ខាត ៖ សរសេរម្តងទៀតបានលទ្ធផលដដែល)។ `increment()` ក្នុង update ធំ ➜ ការអនុវត្តពាក់កណ្តាល + ការព្យាយាមម្តងទៀត = បូកពីរដង
 *    ➜ adapter ត្រូវបដិសេធ **មុនសរសេរអ្វីទាំងអស់** (fail-closed)។
 * ⛔ អ្នកហៅ `fb.update(` គ្រប់កន្លែងក្នុង `src/` ត្រូវចាត់ថ្នាក់ ៖ BOUNDED (ចំនួនផ្លូវថេរតូច · atomic) ឬ IDEMPOTENT (ផែនទី `null`/តម្លៃដាច់ខាត ·
 *    គ្មាន increment) — បញ្ជីដេរីវេពីកូដទាំងពីរទិស ➜ អ្នកហៅថ្មីធ្លាក់រហូតដល់មាននរណាចាត់ថ្នាក់វា។
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as rtdb from '../src/services/supabase-rtdb';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const PER_WRITE: number = (rtdb as any).SB_OPS_PER_WRITE;

function memStore() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}

function fakeBackend() {
    let seq = 0;
    const writes: number[] = [];
    const reply = (body: any) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
    const fetch = async (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1] || u;
        const args = init && init.body ? JSON.parse(String(init.body)) : {};
        if (fn === 'zoe_pull') return reply({ seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: [] });
        if (fn === 'zoe_write') {
            writes.push(args.p_ops.length);
            seq += args.p_ops.length;
            return reply({ ok: true, seq, docs: [] });
        }
        return reply({ ok: 1 });
    };
    return { fetch, writes };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openDb() {
    const backend = fakeBackend();
    const local = memStore();
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'live.token.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } }));
    const transport = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch: backend.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
    const db = rtdb.createSupabaseDatabase(transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
        { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref('zoew_barcode_registry'), () => { fired = true; });
    for (let i = 0; i < 200 && !fired; i++) await sleep(5);
    expect(fired).toBe(true);
    return { db, backend };
}

const keysOf = (n: number, value: (i: number) => any) => {
    const out: Record<string, any> = {};
    for (let i = 0; i < n; i++) out['K' + i] = value(i);
    return out;
};

describe('SUPABASE-6 ៖ update() ពហុផ្លូវ ↔ ពិដាន ៥០០ op របស់ zoe_write', () => {
    it('ជាន់អប្បបរមា ៖ ពិដាន = ៥០០ (ស្មើ migration)', () => {
        expect(PER_WRITE).toBe(500);
        const sql = fs.readdirSync(path.join(__dirname, '..', '..', 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'))
            .map((f) => fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', f), 'utf8')).join('\n');
        expect(sql).toMatch(/ops_count < 1 or ops_count > 500/);
    });

    it('≤ ៥០០ ផ្លូវ ➜ ការសរសេរតែមួយ (atomic) · ៥០១ ➜ បំបែក ២', async () => {
        const { db, backend } = await openDb();
        await db.update(db.ref('zoew_barcode_registry'), keysOf(PER_WRITE, () => null));
        expect(backend.writes).toEqual([PER_WRITE]);
        await db.update(db.ref('zoew_barcode_registry'), keysOf(PER_WRITE + 1, () => null));
        expect(backend.writes.slice(1)).toEqual([PER_WRITE, 1]);
    });

    it('> ៥០០ ផ្លូវ idempotent (null · តម្លៃដាច់ខាត) ➜ បំបែកជាការសរសេរ ≤ ៥០០ ហើយទាំងអស់ទៅដល់', async () => {
        const { db, backend } = await openDb();
        await db.update(db.ref('zoew_daily_collected_cod_dod'), keysOf(1201, (i) => (i % 2 ? null : { c: 1, d: 0 })));
        expect(backend.writes).toEqual([500, 500, 201]);
    });

    it('⛔ > ៥០០ ផ្លូវ ដែលមាន increment() ➜ បដិសេធមុនសរសេរ (គ្មាន zoe_write) · ≤ ៥០០ ជាមួយ increment នៅ atomic ដូចដើម', async () => {
        const { db, backend } = await openDb();
        const inc = (db as any).increment ? (db as any).increment(1) : new (rtdb as any).SbIncrement(1);
        const big = keysOf(PER_WRITE, () => null);
        big['zoew_counter/x'] = inc;
        const out = await Promise.resolve().then(() => db.update(db.ref('zoew_settings'), big)).then(() => 'resolved', (e: any) => 'rejected:' + String(e && e.message));
        expect(out).toMatch(/^rejected/);
        expect(backend.writes).toEqual([]);
        const small = keysOf(10, () => null);
        small['zoew_counter/x'] = inc;
        await db.update(db.ref('zoew_settings'), small);
        expect(backend.writes).toEqual([11]);
    });
});

const SRC = path.join(__dirname, '..', 'src');
const CALLERS: Record<string, string> = {
    'services/history-write.ts#saveSingleHistoryItemToFirebase': 'BOUNDED ៖ { [item.id]: item } ផ្លូវ ១',
    'services/history-write.ts#saveSingleDeletedItemToFirebase': 'BOUNDED ៖ { [item.id]: item } ផ្លូវ ១',
    'services/history-write.ts#deleteSingleDeletedItemFromFirebase': 'BOUNDED ៖ { [id]: null } ផ្លូវ ១',
    'services/history-write.ts#purgeDeletedItemsQuietly': 'IDEMPOTENT ៖ { id: null } ការលុបអចិន្ត្រៃយ៍ · ផ្នែកដែលនៅសល់ ➜ ជុំសម្អាតបន្ទាប់',
    'features/clear-history.ts#finalizeClaimedHistoryClear': 'BOUNDED ៖ ផ្លូវ ៣ (finalization · ធុងសំរាម · history) ➜ របងត្រូវ atomic',
    'features/restore.ts#finalizeClaimedRestore': 'BOUNDED ៖ របង + ធុងសំរាម + marker ២ + increment ledger ៣ ក្នុងមួយថ្ងៃ/ខែនៃធាតុមួយ ➜ ត្រូវ atomic',
    'domain/registry.ts#releaseRegistryKeys': 'IDEMPOTENT ៖ { key: null } · ការបរាជ័យ ➜ ជួរ retry ដែលពិនិត្យ registryReleaseVerdict ម្តងទៀត',
    'domain/collected.ts#commitCollectedMarks': 'IDEMPOTENT ៖ { day/key: {c,d} | null } តម្លៃដាច់ខាត · reconcileCollectedHistory() ព្យាបាល',
    'domain/collected.ts#runAutomaticCollectedCleanup': 'IDEMPOTENT ៖ { day: null } ថ្ងៃចាស់',
};

function updateCallers() {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { walk(full); continue; }
            if (!/\.tsx?$/.test(e.name) || /supabase-/.test(e.name)) continue;
            const text = fs.readFileSync(full, 'utf8');
            const re = /\bfb\.update\(/g;
            let m;
            while ((m = re.exec(text))) {
                const head = text.slice(0, m.index);
                const fns = [...head.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)];
                const fn = fns.length ? fns[fns.length - 1][1] : '?';
                out.push(path.relative(SRC, full).replace(/\\/g, '/') + '#' + fn);
            }
        }
    };
    walk(SRC);
    return out;
}

describe('SUPABASE-6 ៖ អ្នកហៅ fb.update( គ្រប់កន្លែងត្រូវចាត់ថ្នាក់ (BOUNDED · IDEMPOTENT)', () => {
    it('បញ្ជីដេរីវេពី src ទាំងពីរទិស · មានហេតុផលគ្រប់ធាតុ', () => {
        const found = updateCallers();
        expect(found.length).toBeGreaterThanOrEqual(6);
        expect([...new Set(found)].sort()).toEqual(Object.keys(CALLERS).sort());
        for (const [k, why] of Object.entries(CALLERS)) expect(why, k).toMatch(/^(BOUNDED|IDEMPOTENT) ៖ \S/);
    });

    const INCREMENT_FEEDS: Record<string, string> = {
        'features/restore.ts#appendRestoreRevenueIncrements': 'features/restore.ts#finalizeClaimedRestore'
    };

    it('⛔ increment() មានតែក្នុង update របស់អ្នកហៅ BOUNDED (បញ្ជីដេរីវេទាំងពីរទិស)', () => {
        const withInc = new Set<string>();
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) { walk(full); continue; }
                if (!/\.tsx?$/.test(e.name) || /supabase-/.test(e.name)) continue;
                const text = fs.readFileSync(full, 'utf8');
                for (const m of text.matchAll(/\bfb\.increment\(/g)) {
                    const fns = [...text.slice(0, m.index).matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)];
                    withInc.add(path.relative(SRC, full).replace(/\\/g, '/') + '#' + (fns.length ? fns[fns.length - 1][1] : '?'));
                }
            }
        };
        walk(SRC);
        expect(withInc.size).toBeGreaterThanOrEqual(1);
        expect([...withInc].sort()).toEqual(Object.keys(INCREMENT_FEEDS).sort());
        for (const k of withInc) {
            const fed = INCREMENT_FEEDS[k] || k;
            expect(CALLERS[fed] || 'unclassified ' + fed).toMatch(/^BOUNDED/);
            expect(fs.readFileSync(path.join(SRC, fed.split('#')[0]), 'utf8')).toContain(k.split('#')[1] + '(updates');
        }
    });
});
