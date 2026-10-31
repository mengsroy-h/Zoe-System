import { expect, it } from 'vitest';
import { canonicalBarcodeRegistryKey } from '../src/domain/barcode-key';
import { SCAN_LEDGER_MAX_MONEY, SCAN_STORED_MONEY_TOLERANCE, scanLedgerIncrementSafe, scanProtocolMoney, scanStoredMoney } from '../src/domain/scan-protocol';

it.each([0.29, 0.07, 0.1 + 0.2, ...[100, 1000].map(count => Array.from({ length: count }).reduce<number>(sum => sum + 0.1, 0))])(
    'stored bucket %s ទទួលតំណាងជិតសេន ដោយមិនកែតម្លៃ', value => {
        const original = value;
        expect(scanStoredMoney(value)).toBe(true);
        expect(value).toBe(original);
    });

it.each([-0.01, NaN, Infinity, -Infinity, 0.001, 0.100001, 0.1 + 2 * SCAN_STORED_MONEY_TOLERANCE, Number.MAX_SAFE_INTEGER, '0.1', null])(
    'stored bucket ខុស %s ត្រូវ HOLD', value => expect(scanStoredMoney(value)).toBe(false));

it('operation input នៅតែ strict cents ទោះ stored predicate ទទួល deviation តូច', () => {
    expect(scanStoredMoney(0.1 + 0.2)).toBe(true);
    expect(scanProtocolMoney(0.1 + 0.2)).toBe(false);
    expect(scanProtocolMoney(0.29)).toBe(true);
});

it('increment នៅព្រំដែន precision ដែលមិនអាចផ្ទៀងសេន ត្រូវ HOLD មិន clamp ឬកែ ledger', () => {
    expect(scanLedgerIncrementSafe(2 ** 46, 0.01)).toBe(false);
    expect(scanLedgerIncrementSafe(SCAN_LEDGER_MAX_MONEY, 0.01)).toBe(false);
    expect(scanLedgerIncrementSafe(SCAN_LEDGER_MAX_MONEY - 0.01, 0.01)).toBe(true);
    expect(scanLedgerIncrementSafe(0.1, 0.2)).toBe(true);
    expect(scanLedgerIncrementSafe(0.29, 0.07)).toBe(true);
});

it.each([
    [' ab.c%/#$[] ', 'AB%2EC%25%2F%23%24%5B%5D'],
    ['ខ្មែរ', 'ខ្មែរ'], ['éß', 'ÉSS'], ['a\u0000\u001f\u007f', 'A%00%1F%7F'], [' A\u00a0', 'A']
])('canonical key រក្សា Unicode និង escape ដើម %s', (code, key) => expect(canonicalBarcodeRegistryKey(code)).toBe(key));
