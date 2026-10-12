import { describe, it, expect } from 'vitest';
import { barcodeRegistryKey, claimBarcodeInRegistry, isBarcodeAlreadyUsed } from '../src/domain/registry';
import { collectPickupMarks, applyPickupMarksToSet, buildPickupRecordFromSet } from '../src/domain/pickup';
import { firebaseState, dataState } from '../src/core/state';

describe('Registry/pickup barcode identity, using actual domain functions', () => {
  it('control: ordinary different barcodes have different keys and remain two pickups', () => {
    const marks = collectPickupMarks({ phone: '012345678', barcodes: [{ code: 'ZT123', isClosed: true }, { code: 'ZT124', isClosed: true }] });
    expect(barcodeRegistryKey('ZT123')).not.toBe(barcodeRegistryKey('ZT124'));
    expect(buildPickupRecordFromSet(applyPickupMarksToSet({}, marks)).packagesPickedUp).toBe(2);
  });
  it('all barcodes without percent retain their existing stored keys', () => {
    const legacy = (code: string) => Array.from(code.trim().toUpperCase(), c => '.#$[]/'.includes(c) || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0') : c).join('');
    for (let ch = 0; ch < 128; ch++) {
      if (ch === 37) continue;
      const code = 'ZT' + String.fromCharCode(ch) + '123';
      expect(barcodeRegistryKey(code)).toBe(legacy(code));
    }
  });
  it('percent-encoded text must not share registry identity with literal punctuation', () => {
    const pairs = [['AB.C', 'AB%2EC'], ['AB/C', 'AB%2FC'], ['AB#C', 'AB%23C'], ['AB[C', 'AB%5BC']];
    for (const [a, b] of pairs) expect(barcodeRegistryKey(a)).not.toBe(barcodeRegistryKey(b));
  });
  it('two distinct barcodes that the duplicate checker accepts must both be claimable', async () => {
    const docs = new Map();
    const oldFb = firebaseState.fb, oldDb = firebaseState.db, oldHistory = dataState.scanHistory, oldTrash = dataState.deletedItems;
    try {
      firebaseState.db = {};
      firebaseState.fb = { ref: (_: any, path: string) => ({ path }), runTransaction: async (ref: any, fn: any) => {
        const current = docs.get(ref.path) ?? null;
        const next = fn(current);
        if (next === undefined) return { committed: false };
        docs.set(ref.path, next); return { committed: true };
      } } as any;
      dataState.scanHistory = [{ barcode: 'AB.C' }]; dataState.deletedItems = [];
      expect(isBarcodeAlreadyUsed('AB%2EC')).toBe(false);
      expect(await claimBarcodeInRegistry('AB.C')).toBe('claimed');
      expect(await claimBarcodeInRegistry('AB%2EC')).toBe('claimed');
    } finally { firebaseState.fb=oldFb; firebaseState.db=oldDb; dataState.scanHistory=oldHistory; dataState.deletedItems=oldTrash; }
  });
  it('two closed identities must count as two; reopening one must keep the other picked up', () => {
    const parcel = { phone: '012345678', barcodes: [{ code: 'AB.C', isClosed: true }, { code: 'AB%2EC', isClosed: true }] };
    const set = applyPickupMarksToSet({}, collectPickupMarks(parcel));
    expect(buildPickupRecordFromSet(set).packagesPickedUp).toBe(2);
    applyPickupMarksToSet(set, collectPickupMarks({ phone: parcel.phone, barcodes: [parcel.barcodes[0]] }, false));
    expect(buildPickupRecordFromSet(set).packagesPickedUp).toBe(1);
  });
});
