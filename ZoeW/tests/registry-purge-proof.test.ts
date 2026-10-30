import { TRASH_CONSUMPTIONS_ROOT } from '../src/domain/trash-generation';
import { describe, expect, it } from 'vitest';
import { registryPurgeIntent, registryPurgeReceiptMatches, registryPurgeReceiptValid, type RegistryPurgeReceipt } from '../src/domain/registry-purge-proof';

function receipt(index = 0, count = 1): RegistryPurgeReceipt {
    return { v: 1, id: 'release_' + index.toString(16).padStart(32, '0'), kind: 'legacy', actorUid: 'member', releasedBy: 'member', scope: 'shop',
        code: 'CODE' + index, registryKey: 'CODE' + index, birth: 123, trashId: 'source', slot: String(index), deletedAt: 456, rowBirth: 100, rowCount: count };
}
const ops = (receipts: RegistryPurgeReceipt[]) => [{ k: 'set', p: ['zoew_recently_deleted_cod_dod', 'source'], v: null }, ...receipts.flatMap(value => [
    { k: 'set', p: ['zoew_barcode_registry', value.registryKey], v: null }, { k: 'set', p: ['zoew_registry_releases', value.id], v: value }
])];

describe('registry purge proof ៖ payload ពេញលេញ និង receipt មិនប្រែ', () => {
    it('លុបមួយ pair ទាំងមូលមិនអាចធ្វើជាភស្តុតាង batch ពេញលេញ', () => {
        const complete = ops([receipt(0, 2), receipt(1, 2)]);
        expect(registryPurgeIntent(complete)?.receipts).toHaveLength(2);
        expect(registryPurgeIntent(complete.slice(0, 3))).toBeNull();
        expect(registryPurgeIntent(complete.slice(1))).toBeNull();
        expect(registryPurgeIntent(complete.filter((_, index) => index !== 1))).toBeNull();
    });
    it.each([0, -1, 2, undefined])('rowCount %s មិនអាចបញ្ជាក់ payload មួយ barcode', rowCount => {
        expect(registryPurgeIntent(ops([{ ...receipt(), rowCount } as any]))).toBeNull();
    });
    it.each(['extra-path', 'duplicate-path', 'wrong-root', 'increment', 'undefined-null', 'extra-op-field'])('បដិសេធ %s មិនមែន atomic payload តែមួយ', kind => {
        const value: any[] = ops([receipt()]);
        if (kind === 'extra-path') value.push({ k: 'set', p: ['other'], v: null });
        if (kind === 'duplicate-path') value.push(value[1]);
        if (kind === 'wrong-root') value[1].p[0] = 'wrong';
        if (kind === 'increment') value[1] = { k: 'inc', p: value[1].p, d: -1 };
        if (kind === 'undefined-null') value[1].v = undefined;
        if (kind === 'extra-op-field') value[1].extra = true;
        expect(registryPurgeIntent(value)).toBeNull();
    });
    it.each(['slot', 'scope', 'releasedBy', 'deletedAt', 'rowBirth'])('pair %s មិនដូចគ្នាត្រូវ HOLD', field => {
        const a = receipt(0, 2), b: any = receipt(1, 2);
        b[field] = field === 'slot' ? '0' : typeof b[field] === 'number' ? b[field] + 1 : 'other';
        if (field === 'releasedBy') b.actorUid = b.releasedBy;
        expect(registryPurgeIntent(ops([a, b]))).toBeNull();
    });
    it.each(['extra', 'bad-id', 'bad-slot', 'bad-key', 'negative-birth', 'too-large', 'nan', 'wrong-kind', 'bad-uid', 'missing-field'])('receipt %s មិនត្រឹមត្រូវមិនស្មើ proof', kind => {
        const value: any = receipt();
        if (kind === 'extra') value.extra = 1;
        if (kind === 'bad-id') value.id = 'release_';
        if (kind === 'bad-slot') value.slot = '01';
        if (kind === 'bad-key') value.registryKey = 'other';
        if (kind === 'negative-birth') value.birth = -1;
        if (kind === 'too-large') value.deletedAt = 9007199254740991;
        if (kind === 'nan') value.rowBirth = NaN;
        if (kind === 'wrong-kind') value.kind = 'other';
        if (kind === 'bad-uid') value.actorUid = 'x'.repeat(2049);
        if (kind === 'missing-field') delete value.scope;
        expect(registryPurgeReceiptValid(value)).toBe(false);
        expect(registryPurgeReceiptMatches(receipt(), value)).toBe(false);
    });
    it('legacy birth0 អនុញ្ញាត ប៉ុន្តែ scan birth0 និង extra field មិនអនុញ្ញាត', () => {
        const legacy = { ...receipt(), birth: 0, rowBirth: 0 };
        expect(registryPurgeIntent(ops([legacy]))).not.toBeNull();
        const scan: any = { ...legacy, id: 'scan_' + 'a'.repeat(32), kind: 'scan', actorUid: 'original-member' };
        expect(registryPurgeReceiptValid(scan)).toBe(false); scan.birth = 123;
        expect(registryPurgeIntent(ops([scan]))?.receipts[0]).toEqual(scan);
        expect(registryPurgeReceiptMatches(scan, { ...scan })).toBe(true);
        expect(registryPurgeReceiptMatches(scan, { ...scan, releasedBy: 'other' })).toBe(false);
    });
    it('cap249 អនុញ្ញាត499paths ប៉ុន្តែ250 មិនបំបែក501paths', () => {
        expect(registryPurgeIntent(ops(Array.from({ length: 249 }, (_, index) => receipt(index, 249))))?.receipts).toHaveLength(249);
        expect(registryPurgeIntent(ops(Array.from({ length: 250 }, (_, index) => receipt(index, 250))))).toBeNull();
    });
    it('លំដាប់ផ្លូវមិនប្តូរ proof ហើយ kind ចម្រុះប្រើ actor ដើម', () => {
        const a = receipt(0, 2), b = { ...receipt(1, 2), kind: 'scan' as const, id: 'scan_' + 'a'.repeat(32), actorUid: 'original-member' };
        expect(registryPurgeIntent(ops([a, b]).reverse())?.receipts).toHaveLength(2);
    });
});


describe('purge generation ៖ batch ថ្មី consume source ដោយមិនលាយ proof ចាស់', () => {
    const newer = (index = 0, count = 1): RegistryPurgeReceipt => ({ ...receipt(index, count), v: 2, generation: 3 });
    const complete = (count = 1) => [...ops(Array.from({ length: count }, (_, index) => newer(index, count))),
        { k: 'set', p: [TRASH_CONSUMPTIONS_ROOT, 'source'], v: { v: 1, sourceId: 'source', generation: 3, kind: 'purge', actorUid: 'member', scope: 'shop', deletedAt: 456, rowBirth: 100 } }];
    it('249 barcodes ជា500paths រួម consumption ហើយ250 ត្រូវ HOLD', () => {
        expect(complete(249)).toHaveLength(500);
        expect(registryPurgeIntent(complete(249))?.receipts).toHaveLength(249);
        expect(registryPurgeIntent(complete(250))).toBeNull();
    });
    it.each(['missing', 'extra', 'sourceId', 'generation', 'kind', 'actorUid', 'scope', 'deletedAt', 'rowBirth'])('consumption %s មិនត្រូវគ្នាមិនអាច settle', field => {
        const value: any[] = complete();
        if (field === 'missing') value.pop();
        else if (field === 'extra') value.at(-1).v.extra = true;
        else { const prior = value.at(-1).v[field]; value.at(-1).v[field] = typeof prior === 'number' ? prior + 1 : 'other'; }
        expect(registryPurgeIntent(value)).toBeNull();
    });
    it.each([undefined, null, false, -1, 1.5, 9007199254740991])('generation %s មិន downgrade ជា legacy', generation => {
        const value: any = { ...newer(), generation };
        if (generation === undefined) delete value.generation;
        expect(registryPurgeReceiptValid(value)).toBe(false);
        expect(registryPurgeReceiptMatches(newer(), value)).toBe(false);
    });
    it('v1 និង v2 មិនលាយ ទោះ barcode/source/time ដូចគ្នា', () => {
        const value: any[] = complete(2); value[1].v = receipt(0, 2);
        expect(registryPurgeIntent(value)).toBeNull();
        expect(registryPurgeReceiptMatches(newer(), { ...newer(), generation: 4 })).toBe(false);
        expect(registryPurgeReceiptMatches(newer(), receipt())).toBe(false);
    });
});
