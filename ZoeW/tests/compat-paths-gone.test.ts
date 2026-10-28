/**
 * ⛔ Phase B ជុំ ៥ (ម្ចាស់គម្រោង ៖ «ធ្វើអោយចប់ស្អាតទៅ កុំអោយនៅសល់» · គ្មាន compat មុន launch) ៖ ផ្លូវសម្រាប់ App ចាស់ ·
 *    ទិន្នន័យទម្រង់ចាស់ និង rules មុន ring/ded ដកចេញ ៖ ការផ្លាស់ key Apps Script ក្នុង URL · ការ upgrade hash PIN · ledger
 *    ទម្លាក់កម្រិតពេល `permission_denied` · seed ring ពី `op` គ្មាន ring · ផ្លូវ ledger `legacy` នៃការសម្អាត · ការផ្ទៀង journal
 *    តាមវាល item · `ztoSentOutAt` ដែល App ចាស់នាំឆ្លងការស្តារ · ផ្លូវ 🛠️ ដោះការស្តារដែលគ្មាន provenance · migration metadata
 *    License (ZoeKeyGen) · function reset ចាស់របស់ Supabase · ការងារ Sign និង journal ទម្រង់មុន reservation · ការពិនិត្យ receipt-status ពីប្រអប់ Sign។
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import * as lookupConfig from '../src/features/lookup-config';
import * as restore from '../src/features/restore';
import * as cleanup from '../src/domain/cleanup';
import { completeAppUnlock } from '../src/features/app-lock';
import { ledgerOpRing, runLedgerTransaction } from '../src/domain/ledger';
import { barcodeZtoSentOut } from '../src/domain/barcode';
import { PIN_PROMPT_MESSAGES } from '../src/features/pin';
import { ACTION_ALLOWLIST } from '../src/core/runtime';
import { openSignJob, sealSignJob } from '../src/services/palm-sign-outbox-store';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');
const requireNode = createRequire(import.meta.url);

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    appLocalStore.clear();
});

describe('ផ្លូវ compat ដែលនៅសល់ ៖ ដកចេញ', () => {
    it('Lookup ៖ គ្មាន migration key Apps Script ក្នុង URL', () => {
        expect('migrateLookupSecretIfNeeded' in lookupConfig).toBe(false);
    });

    it('App lock ៖ hash PIN ដែលមិនមែន PBKDF2 មិនត្រូវ upgrade ស្ងាត់ៗ', async () => {
        vi.stubGlobal('indexedDB', undefined);
        appLocalStore.setItem('zoew_security_pin_hash', 'deadbeef');
        await completeAppUnlock('1234', 'deadbeef');
        expect(appLocalStore.getItem('zoew_security_pin_hash')).toBe('deadbeef');
    });

    it('Ledger ៖ `permission_denied` មិនទម្លាក់កម្រិត (គ្មាន resend ដោយគ្មាន ring/op)', async () => {
        const runTransaction = vi.fn(async () => { throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); });
        const saved = firebaseState.fb;
        firebaseState.fb = { runTransaction } as any;
        try {
            await expect(runLedgerTransaction({}, (current, op, ring) => ({ ...(current || {}), codDollar: 1, op, ops: ring }), 3)).rejects.toThrow(/permission/i);
            expect(runTransaction).toHaveBeenCalledTimes(1);
        } finally {
            firebaseState.fb = saved;
        }
    });

    it('Ledger ៖ ring មិន seed ពី `op` របស់កំណត់ត្រាគ្មាន ring', () => {
        const ring = ledgerOpRing({ codDollar: 5, op: 'op_oldwriter001' }, 'op_newwriter001');
        expect(ring).toEqual({ op_newwriter001: 2 });
    });

    it('ការសម្អាត ៖ គ្មានផ្លូវ ledger `legacy` · journal មិនផ្ទៀងតាមវាល item', () => {
        expect('CLEANUP_LEDGER_LEGACY' in cleanup).toBe(false);
        const stored = { id: 't1', deletedAt: 100, barcode: 'A', closedAt: 1 };
        const expected = { id: 't1', deletedAt: 100, barcode: 'B', closedAt: 2 };
        expect(cleanup.cleanupJournalClaimMatches({ id: 'item1', reason: 'abandon', trashItem: stored }, expected)).toBe(true);
    });

    it('ZTO ៖ `ztoSentOutAt` ជាភស្តុតាងបញ្ជូនចេញ ទោះ `restoredAt` ក្រោយ', () => {
        expect(barcodeZtoSentOut({ code: 'X', ztoSentOutAt: 100, restoredAt: 200 })).toBe(true);
    });

    it('ការស្តារ ៖ គ្មានផ្លូវ 🛠️ ដោះការស្តារដោយដៃ (PIN · សកម្មភាព · ផែនការ)', () => {
        for (const name of ['promptHeldRestoreRecovery', 'recoverHeldRestore', 'restoreHeldPlan', 'releaseHeldRestoreRow', 'restoreSourceCodes']) {
            expect(name in restore, name).toBe(false);
        }
        expect('heldRestore' in PIN_PROMPT_MESSAGES).toBe(false);
        expect(Array.from(ACTION_ALLOWLIST as any).includes('promptHeldRestoreRecovery')).toBe(false);
        expect(read('ZoeW/src/features/restore.ts')).not.toMatch(/!priorAdded/);
    });

    it('Sign ៖ ការងារគ្មាន reservation អានមិនបាន · journal ទម្រង់មុន reservation ➜ 503 · ប្រអប់ Sign គ្មាន receipt-status', async () => {
        vi.stubGlobal('crypto', webcrypto);
        const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
        const job: any = { code: '77130500000012', itemId: 'item1', requestId: 'request-1', signMan: '', photo: 'cGhvdG8=', dispatchProof: '', signature: '', parcelIdentity: '', phase: 'queued', attempts: 0, message: '' };
        await expect(openSignJob(await sealSignJob('owner', key, job), key)).rejects.toThrow('outbox:shape');
        const reserved = { ...job, reservationProtocol: 'original-reservation-v1', originalFingerprint: 'f'.repeat(64), originalSHA256: 'e'.repeat(64) };
        await expect(openSignJob(await sealSignJob('owner', key, reserved), key)).resolves.toMatchObject({ code: job.code });
        const journal = requireNode('../netlify/functions/_shared/zto-palm-sign-journal.js');
        const store = { getWithMetadata: vi.fn(async () => ({ etag: 'seed', data: JSON.stringify({ kind: 'sign-journal', owner: 'o', requestId: 'request-1', fingerprint: 'f'.repeat(64), phase: 'signed', leaseUntil: 0, photoAccepted: true }) })), set: vi.fn() };
        const run = vi.fn(); const status = vi.fn();
        const out = await journal.withSignJournal({ barcode: job.code, requestId: 'request-1', stage: 'receipt-status', photoProtocol: 'original-sha256-v1', originalSHA256: 'e'.repeat(64), reservationProtocol: 'original-reservation-v1', originalFingerprint: 'f'.repeat(64) },
            { site: 'KH1' }, { keyLabel: 'label', blobStore: () => ({ store }) }, { open: JSON.parse, seal: JSON.stringify }, run, status, vi.fn());
        expect(out.statusCode).toBe(503);
        expect(run).not.toHaveBeenCalled(); expect(status).not.toHaveBeenCalled(); expect(store.set).not.toHaveBeenCalled();
        expect(read('ZoeW/src/features/palm-sign-outbox.ts')).not.toMatch(/RETRY_READY|legacy_journal|legacyBinding/);
        expect(read('ZoeW/src/features/zto-palm-sign.ts')).not.toMatch(/legacyPhotoBindings|'receipt-status'/);
    });

    it('ZoeKeyGen ៖ គ្មាន migration metadata License ចាស់', () => {
        expect(read('ZoeKeyGen/app.js')).not.toMatch(/migrateLegacyLicenseKeyMetadata|legacyMeta/);
        expect(read('ZoeKeyGen/index.html')).not.toMatch(/migrateLegacyLicenseKeyMetadata/);
    });

    it('Supabase ៖ function reset ចាស់ (`reset_code_user` · `consume_reset_code`) ត្រូវ drop ក្នុង migration ចុងក្រោយដែលនិយាយពីវា', () => {
        const dir = resolve(ROOT, 'supabase/migrations');
        const sql = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort().map((name) => readFileSync(resolve(dir, name), 'utf8')).join('\n');
        for (const fn of ['reset_code_user', 'consume_reset_code']) {
            const statements = sql.split(';').filter((statement) => statement.includes(fn));
            expect(statements.length, fn).toBeGreaterThan(0);
            expect(statements[statements.length - 1], fn).toMatch(new RegExp('drop function if exists public\\.' + fn, 'i'));
        }
    });
});
