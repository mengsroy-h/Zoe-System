/**
 * ⛔ ការសរសេរ ledger ដែល backend ដឹងច្បាស់ថា **មិនបានអនុវត្ត** (`txOutcome: 'not-applied'` ៖ Supabase replay `op_id` ➜ conflict ·
 *    Firebase អាន REST ឃើញតម្លៃមុន) ត្រូវសាកឡើងវិញ មិនមែនបោះបង់។ ករណីពិត (ឧបករណ៍ ៣ ក្នុងហាងតែមួយ) ៖ «ដក» barcode ➜ ការផុតកំណត់ ៤ ម៉ោង
 *    ចាកចេញចំពេល transaction ledger ថ្ងៃកំពុងរត់ ➜ ចូលវិញ ➜ replay ប៉ះ conflict ព្រោះឧបករណ៍ផ្សេងស្កេនបន្ត ➜ មុនកែ ៖ ខែត្រូវកាត់ ថ្ងៃមិនកាត់ ➜
 *    ចំណូលថ្ងៃលើសការពិតមួយ barcode (`money-reality-check` ៖ «ខែឃ្លាតពីផលបូកថ្ងៃ»)។ `unknown` មិនសាកឡើងវិញ (ប្រហែលបានអនុវត្តរួច ➜ ការសាកដកពីរដង)។
 */
import { afterEach, describe, expect, it } from 'vitest';
import { firebaseState } from '../src/core/state';
import { runLedgerTransaction } from '../src/domain/ledger';

const saved = firebaseState.fb;
afterEach(() => { firebaseState.fb = saved; });

function sdkWith(outcomes: Array<'ok' | 'not-applied' | 'unknown' | 'permission'>) {
    const seen: any[] = [];
    let value: any = { codDollar: 10, dodDollar: 1, totalCount: 2 };
    firebaseState.fb = {
        runTransaction: async (_ref: any, fn: any) => {
            const proposed = fn(value);
            const outcome = outcomes.shift() || 'ok';
            seen.push({ outcome, proposed });
            if (outcome === 'ok') { value = proposed; return { committed: true, snapshot: { val: () => value } }; }
            if (outcome === 'permission') throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            throw Object.assign(new Error('disconnect'), { code: 'disconnect', txOutcome: outcome });
        }
    } as any;
    return { seen, value: () => value };
}

const deduct = (current: any, op: any) => ({ codDollar: current.codDollar - 3.5, dodDollar: current.dodDollar - 0.25, totalCount: current.totalCount - 1, op });

describe('runLedgerTransaction ៖ «មិនបានអនុវត្ត» ច្បាស់ ➜ សាកឡើងវិញ', () => {
    it('⛔ not-applied ម្តង ➜ សាកឡើងវិញ ➜ ការកាត់ចូលតែម្តង', async () => {
        const s = sdkWith(['not-applied', 'ok']);
        const res: any = await runLedgerTransaction({}, deduct);
        expect(res.committed).toBe(true);
        expect(s.seen.map((x) => x.outcome)).toEqual(['not-applied', 'ok']);
        expect(s.value()).toMatchObject({ codDollar: 6.5, dodDollar: 0.75, totalCount: 1 });
        expect(s.seen[1].proposed.op).toBe(s.seen[0].proposed.op);
    });

    it('not-applied ជាប់គ្នា ➜ ព្រំដែន (លំនាំដើម ៣ · ឬប៉ារ៉ាម៉ែត្រ) ➜ បដិសេធ (មិនវិលជារៀងរហូត)', async () => {
        const s = sdkWith(Array(20).fill('not-applied'));
        const err: any = await runLedgerTransaction({}, deduct).then(() => null, (e: any) => e);
        expect(err && err.txOutcome).toBe('not-applied');
        expect(s.seen.length).toBe(4);
        const t = sdkWith(Array(20).fill('not-applied'));
        await runLedgerTransaction({}, deduct, 1).then(() => null, (e: any) => e);
        expect(t.seen.length).toBe(2);
    });

    it('ទិសផ្ទុយ ៖ unknown ➜ មិនសាកឡើងវិញ (ប្រហែលបានអនុវត្តរួច)', async () => {
        const s = sdkWith(['unknown', 'ok']);
        const err: any = await runLedgerTransaction({}, deduct).then(() => null, (e: any) => e);
        expect(err && err.txOutcome).toBe('unknown');
        expect(s.seen.length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ permission_denied ➜ ផ្ញើម្តងទៀតដោយគ្មាន op (ឥរិយាបថដើម)', async () => {
        const s = sdkWith(['permission', 'ok']);
        const res: any = await runLedgerTransaction({}, deduct);
        expect(res.committed).toBe(true);
        expect(s.seen[0].proposed.op).toMatch(/^op_/);
        expect(s.seen[1].proposed.op).toBeNull();
    });
});
