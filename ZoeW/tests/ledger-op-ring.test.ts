/**
 * ⛔ MONEY-4 ៖ ring `ops` ក្នុង record ledger (ថ្ងៃ · ខែ) ជាភស្តុតាងថាការសរសេរណាបានចុះ ពេល wrapper អាន server ក្រោយ `disconnect`
 *    ហើយឧបករណ៍ផ្សេងបានសរសេរចន្លោះ commit និងការអាន (server ≠ តម្លៃដែលផ្ញើ ≠ តម្លៃមុន)។ សាលក្រម ៖
 *    token យើងនៅក្នុង ring ឬ `op` ➜ `applied` · token ដែលនៅក្នុង ring មុន (ឬ `op` របស់ record ចាស់) នៅតែមាន ហើយយើងគ្មាន ➜ `not-applied`
 *    (ring រុញចេញចាស់បំផុតមុន) · record មិនទាន់មាន ហើយ ring មានលំដាប់ 1 ➜ `not-applied` · ផ្សេងពីនោះ ➜ `null` (សម្រេចមិនបាន)។
 *    ការវាស់ពីរឧបករណ៍ពិត ៖ `audit-tools/tx-outcome-test.js` ផ្នែក ៤ខ២ · `revenue-fuzz-test` (`ledgerBlip`)។
 */
import { describe, expect, it } from 'vitest';
import { LEDGER_OP_RING_MAX, ledgerOpRing, ledgerOpRingOf, ledgerOpWitness, ledgerTagged } from '../src/domain/ledger';

const vals = { codDollar: 10, dodDollar: 0, totalCount: 2 };
const write = (record: any, op: string) => ({ ...vals, op, ops: ledgerOpRing(record, op) });

describe('ledgerOpRing ៖ ring មានលំដាប់ និងព្រំដែន', () => {
    it('record មិនទាន់មាន ➜ លំដាប់ 1 · record ចាស់គ្មាន ring ➜ ចាប់ពី 2 (`op` ចាស់ក្លាយជាធាតុដំបូង)', () => {
        expect(ledgerOpRing(null, 'op_aaaaaaaaaaaa')).toEqual({ op_aaaaaaaaaaaa: 1 });
        expect(ledgerOpRing({ ...vals }, 'op_aaaaaaaaaaaa')).toEqual({ op_aaaaaaaaaaaa: 2 });
        expect(ledgerOpRing({ ...vals, op: 'op_oldoldoldold' }, 'op_aaaaaaaaaaaa')).toEqual({ op_oldoldoldold: 2, op_aaaaaaaaaaaa: 3 });
    });

    it('ring ពេញ ➜ រុញចេញលំដាប់ចាស់បំផុតមុន (មិនមែនថ្មី)', () => {
        let rec: any = null;
        const ops: string[] = [];
        for (let i = 0; i < LEDGER_OP_RING_MAX + 3; i++) {
            const op = 'op_' + String(i).padStart(12, '0');
            ops.push(op);
            rec = write(rec, op);
        }
        expect(Object.keys(rec.ops).sort()).toEqual(ops.slice(-LEDGER_OP_RING_MAX).sort());
        expect(rec.ops[rec.op]).toBe(LEDGER_OP_RING_MAX + 3);
    });

    it('តម្លៃខូចក្នុង ring មិនត្រូវរាប់ (មិន throw)', () => {
        expect(ledgerOpRingOf({ ops: { op_aaaaaaaaaaaa: 'x', op_bbbbbbbbbbbb: -1, op_cccccccccccc: 4, 'bad key': 5, op_: 6 } })).toEqual({ op_cccccccccccc: 4 });
        [undefined, null, NaN, 5, 'x', [], {}, { ops: 7 }].forEach((v: any) => {
            expect(() => ledgerOpRing(v, 'op_aaaaaaaaaaaa')).not.toThrow();
            expect(() => ledgerOpWitness(v, v, 'op_aaaaaaaaaaaa')).not.toThrow();
        });
    });

    it('ledgerTagged ៖ គ្មាន op ➜ record ដើម · ring ➜ `op` + `ops`', () => {
        expect(ledgerTagged(vals, null, { op_a: 1 })).toBe(vals);
        expect(ledgerTagged(vals, 'op_aaaaaaaaaaaa', null)).toEqual({ ...vals, op: 'op_aaaaaaaaaaaa' });
        expect(ledgerTagged(vals, 'op_aaaaaaaaaaaa', { op_aaaaaaaaaaaa: 1 })).toEqual({ ...vals, op: 'op_aaaaaaaaaaaa', ops: { op_aaaaaaaaaaaa: 1 } });
    });
});

describe('ledgerOpWitness ៖ សាលក្រមក្រោយ `disconnect` ពេលឧបករណ៍ផ្សេងសរសេរ', () => {
    const prior = write({ ...vals, op: 'op_seedseedseed' }, 'op_priorpriorpr');
    const mine = 'op_minemineminem';

    it('⛔ យើងចុះ ➜ ឧបករណ៍ផ្សេងសរសេរបន្ត ➜ applied', () => {
        const ours = write(prior, mine);
        const foreign = write(ours, 'op_foreignforei');
        expect(ledgerOpWitness(foreign, prior, mine)).toBe('applied');
        expect(ledgerOpWitness({ ...ours, codDollar: 99 }, prior, mine)).toBe('applied');
    });

    it('⛔ យើងមិនដល់ ➜ ឧបករណ៍ផ្សេងសរសេរពីមូលដ្ឋានដដែល ➜ not-applied', () => {
        expect(ledgerOpWitness(write(prior, 'op_foreignforei'), prior, mine)).toBe('not-applied');
        const legacy = { ...vals, op: 'op_legacylegacy' };
        expect(ledgerOpWitness(write(legacy, 'op_foreignforei'), legacy, mine)).toBe('not-applied');
        expect(ledgerOpWitness(write(null, 'op_foreignforei'), null, mine)).toBe('not-applied');
    });

    it('⛔ សម្រេចមិនបាន ➜ null ៖ ring ពេញរុញ token ទាំងអស់ · App ចាស់លុប ring · record ចាស់គ្មាន token · record បាត់', () => {
        let rec: any = write(prior, mine);
        for (let i = 0; i < LEDGER_OP_RING_MAX; i++) rec = write(rec, 'op_f' + String(i).padStart(11, '0'));
        expect(ledgerOpWitness(rec, prior, mine)).toBeNull();
        expect(ledgerOpWitness({ ...vals, op: 'op_oldversionap' }, prior, mine)).toBeNull();
        expect(ledgerOpWitness(write({ ...vals }, 'op_foreignforei'), { ...vals }, mine)).toBeNull();
        expect(ledgerOpWitness(null, prior, mine)).toBeNull();
        expect(ledgerOpWitness(write(prior, 'op_foreignforei'), prior, null)).toBeNull();
    });
});
