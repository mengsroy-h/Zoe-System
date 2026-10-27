// N1 (deep audit 8): the Firebase SDK re-runs a transaction updater when the server rejects its base. If the updater
// throws during that re-run, the real SDK leaves the transaction half-finished: its promise never settles, the local view
// keeps a value the server does not have, and the next transaction anywhere sends that stale value (measured on the real
// SDK + emulator: a month ledger 100 ➜ 6). runTransactionResolved() is the single wrapper every `fb.runTransaction` goes
// through ➜ it never lets an updater exception reach the SDK: the updater answers `undefined` (a clean abort) and the
// caller still receives the original error with its fields (`txOutcome` included).
import { describe, expect, it } from 'vitest';
import { runTransactionResolved } from '../src/services/tx-outcome';

const ref = { path: 'zoew_monthly_revenue_cod_dod', toString: () => 'https://n1.firebaseio.com/zoew_monthly_revenue_cod_dod' };

function rerunningSdk(serverValues: any[]) {
    const seen: string[] = [];
    return {
        seen,
        runTransaction: async (_ref: any, update: any) => {
            let last: any;
            for (const value of serverValues) {
                try {
                    last = update(JSON.parse(JSON.stringify(value)));
                } catch {
                    seen.push('threw into the SDK');
                    return new Promise(() => {});
                }
                if (last === undefined) {
                    seen.push('aborted');
                    return { committed: false, snapshot: { val: () => value } };
                }
            }
            seen.push('committed');
            return { committed: true, snapshot: { val: () => last } };
        }
    };
}

describe('N1 ៖ an updater that throws during the SDK re-run never reaches the SDK', () => {
    it('the re-run throws ➜ the SDK sees a clean abort and the caller gets the original error with its fields', async () => {
        const sdk = rerunningSdk([{ codDollar: 100 }, { codDollar: 99 }]);
        let runs = 0;
        const updater = (current: any) => {
            runs++;
            if (runs === 2) throw Object.assign(new Error('Ledger operation outcome unknown'), { txOutcome: 'unknown' });
            return { codDollar: (current && current.codDollar || 0) - 1 };
        };
        const outcome = await runTransactionResolved(sdk, ref, updater, undefined).then(() => 'resolved', (error: any) => error);
        expect(sdk.seen).toEqual(['aborted']);
        expect(outcome).toBeInstanceOf(Error);
        expect(outcome.message).toBe('Ledger operation outcome unknown');
        expect(outcome.txOutcome).toBe('unknown');
    });

    it('a throw on the first run is a clean abort too', async () => {
        const sdk = rerunningSdk([{ codDollar: 5 }]);
        const outcome = await runTransactionResolved(sdk, ref, () => { throw new Error('write_journal_unavailable'); }, undefined).then(() => 'resolved', (error: any) => error);
        expect(sdk.seen).toEqual(['aborted']);
        expect(outcome.message).toBe('write_journal_unavailable');
    });

    it('control: a later re-run that succeeds after an earlier throw commits normally (the error belongs only to the run that threw)', async () => {
        const sdk = rerunningSdk([{ codDollar: 3 }]);
        const result: any = await runTransactionResolved(sdk, ref, (current: any) => ({ codDollar: current.codDollar + 1 }), undefined);
        expect(sdk.seen).toEqual(['committed']);
        expect(result.committed).toBe(true);
    });
});
