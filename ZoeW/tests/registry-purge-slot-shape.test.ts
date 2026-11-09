import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as proof from '../src/domain/registry-purge-proof';
import * as generation from '../src/domain/trash-generation';
import { canonicalBarcodeRegistryKey } from '../src/domain/barcode-key';

const T = 'zoew_recently_deleted_cod_dod', G = 'zoew_trash_consumptions', R = 'zoew_barcode_registry', P = 'zoew_registry_releases';
const api: any = { ...proof, ...generation };
const clone = (value: any) => JSON.parse(JSON.stringify(value));
const SLOTS = ['0', '7', '15'];

function receipt(slot: string, count: number) {
    return { v: 2, generation: 3, id: 'release_' + Number(slot).toString(16).padStart(32, '0'), kind: 'legacy', actorUid: 'member', releasedBy: 'member',
        scope: 'shop', code: 'CODE' + slot, registryKey: 'CODE' + slot, birth: 10 + Number(slot), trashId: 'source', slot,
        deletedAt: 456, rowBirth: 100, rowCount: count };
}
function certificate(receipts: any[]) {
    const ordered = receipts.slice().sort((a, b) => Number(a.slot) - Number(b.slot));
    const members: any = {}, keys: any = {};
    ordered.forEach((value, index) => {
        members[value.slot] = { o: index, id: value.id, ...(index ? { p: ordered[index - 1].slot } : {}), ...(index < ordered.length - 1 ? { n: ordered[index + 1].slot } : {}) };
        keys[value.registryKey] = value.id;
    });
    return { first: ordered[0].slot, members, keys };
}
const core = { v: 1, sourceId: 'source', generation: 3, kind: 'purge', actorUid: 'member', scope: 'shop', deletedAt: 456, rowBirth: 100 };
function slotOps(slots = SLOTS, fields = ['cod', 'count', 'deletedAt', 'phone']) {
    const receipts = slots.map(slot => receipt(slot, slots.length));
    return [...receipts.flatMap(value => [{ k: 'set', p: [T, 'source', 'barcodes', value.slot], v: null },
        { k: 'set', p: [R, value.registryKey], v: null }, { k: 'set', p: [P, value.id], v: value }]),
    ...fields.map(field => ({ k: 'set', p: [T, 'source', field], v: null })),
    { k: 'set', p: [G, 'source'], v: { ...core, ...certificate(receipts) } }];
}
function rowOps(slots = SLOTS) {
    const receipts = slots.map(slot => receipt(slot, slots.length));
    return [{ k: 'set', p: [T, 'source'], v: null }, { k: 'set', p: [G, 'source'], v: core },
        ...receipts.flatMap(value => [{ k: 'set', p: [R, value.registryKey], v: null }, { k: 'set', p: [P, value.id], v: value }])];
}

beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe('F03 purge តាម slot ៖ packet ថ្មីដែល rules ផ្ទៀង slot នីមួយៗ', () => {
    it('packet slot ពេញលេញ parse បាន ហើយ hash ដូច packet ជួរដដែល', async () => {
        const ops = slotOps();
        expect(typeof api.slotRegistryPurgeIntent).toBe('function');
        const intent = api.slotRegistryPurgeIntent(ops);
        expect(intent?.sourceId).toBe('source');
        expect(intent?.receipts.map((value: any) => value.slot)).toEqual(SLOTS);
        expect(proof.boundedRegistryPurgeIntent(ops)?.receipts).toHaveLength(3);
        expect(await proof.registryPurgeBindingHash(ops)).toBe(await proof.registryPurgeBindingHash(rowOps()));
        expect(api.slotRegistryPurgeIntent(rowOps())).toBeNull();
    });
    it('rowOps បម្លែង packet slot ទៅជាជួរ v1 ដែល SQL ស្គាល់ ហើយ packet ជួរនៅដដែល', () => {
        expect(typeof api.registryPurgeRowOps).toBe('function');
        const converted = api.registryPurgeRowOps(slotOps());
        expect(converted).toEqual(rowOps());
        expect(proof.registryPurgeIntent(converted)?.receipts).toHaveLength(3);
        expect(api.registryPurgeRowOps(rowOps())).toEqual(rowOps());
        expect(api.registryPurgeRowOps([{ k: 'set', p: ['other'], v: 1 }])).toBeNull();
    });
    it.each(['slot-missing', 'slot-extra', 'no-field', 'field-value', 'barcodes-field', 'mixed-row-path', 'two-sources', 'v1-receipt',
        'first-wrong', 'ordinal-wrong', 'link-missing', 'keys-swapped', 'keys-extra', 'members-extra', 'certificate-missing', 'deep-field'])('packet slot %s ត្រូវបដិសេធ', kind => {
        let ops: any[] = slotOps();
        const g = ops.at(-1).v;
        if (kind === 'slot-missing') ops = ops.filter(op => !(op.p.length === 4 && op.p[3] === '7'));
        if (kind === 'slot-extra') ops.push({ k: 'set', p: [T, 'source', 'barcodes', '99'], v: null });
        if (kind === 'no-field') ops = slotOps(SLOTS, []);
        if (kind === 'field-value') ops.find(op => op.p[2] === 'cod').v = 0;
        if (kind === 'barcodes-field') ops.push({ k: 'set', p: [T, 'source', 'barcodes'], v: null });
        if (kind === 'mixed-row-path') ops.push({ k: 'set', p: [T, 'source'], v: null });
        if (kind === 'two-sources') ops.push({ k: 'set', p: [T, 'other', 'cod'], v: null });
        if (kind === 'v1-receipt') for (const op of ops) if (op.p[0] === P) { op.v.v = 1; delete op.v.generation; }
        if (kind === 'first-wrong') g.first = '7';
        if (kind === 'ordinal-wrong') g.members['15'].o = 3;
        if (kind === 'link-missing') delete g.members['7'].n;
        if (kind === 'keys-swapped') [g.keys.CODE0, g.keys.CODE7] = [g.keys.CODE7, g.keys.CODE0];
        if (kind === 'keys-extra') g.keys.OTHER = g.keys.CODE0;
        if (kind === 'members-extra') g.members['20'] = { o: 3, id: g.members['15'].id, p: '15' };
        if (kind === 'certificate-missing') { delete g.first; delete g.members; delete g.keys; }
        if (kind === 'deep-field') ops.push({ k: 'set', p: [T, 'source', 'origins', 'CODE0'], v: null });
        expect(proof.boundedRegistryPurgeIntent(ops)).toBeNull();
        expect(api.slotRegistryPurgeIntent?.(ops) ?? null).toBeNull();
        expect(proof.registryPurgeBindingPreimage(ops)).toBeNull();
    });
    it('consumption ដែល members ធំលើស 1 MiB មិនអាចផ្ញើជា packet slot ទោះ packet នៅក្រោម 4 MiB', () => {
        const slots = Array.from({ length: 1250 }, (_, index) => String(index));
        const receipts = slots.map(slot => ({ ...receipt(slot, slots.length), code: '/'.repeat(250) + slot }))
            .map(value => ({ ...value, registryKey: canonicalBarcodeRegistryKey(value.code) }));
        const ops = [...receipts.flatMap(value => [{ k: 'set', p: [T, 'source', 'barcodes', value.slot], v: null },
            { k: 'set', p: [R, value.registryKey], v: null }, { k: 'set', p: [P, value.id], v: value }]),
        { k: 'set', p: [T, 'source', 'cod'], v: null }, { k: 'set', p: [G, 'source'], v: { ...core, ...certificate(receipts) } }];
        expect(new TextEncoder().encode(JSON.stringify(ops.at(-1)!.v)).byteLength).toBeGreaterThan(1024 * 1024);
        expect(new TextEncoder().encode(JSON.stringify(ops)).byteLength).toBeLessThan(proof.REGISTRY_PURGE_MAX_BYTES);
        expect(proof.boundedRegistryPurgeIntent(ops)?.receipts).toHaveLength(1250);
        expect(api.slotRegistryPurgeIntent(ops)).toBeNull();
        const small = slotOps(SLOTS);
        expect(api.slotRegistryPurgeIntent(small)).not.toBeNull();
    });
});

describe('F03 consumption ៖ certificate ក្នុង G ជាទម្រង់ canonical តែប៉ុណ្ណោះ', () => {
    const value = () => ({ ...core, ...certificate(SLOTS.map(slot => receipt(slot, 3))) });
    it('purge G ចាស់គ្មាន certificate និង G មាន certificate canonical ទទួលបាន', () => {
        expect(generation.trashConsumptionValid(core)).toBe(true);
        expect(generation.trashConsumptionValid(value())).toBe(true);
        expect(generation.trashConsumptionSame(value(), clone(value()))).toBe(true);
        const reordered = value(); reordered.members = Object.fromEntries(Object.entries(reordered.members).reverse());
        expect(generation.trashConsumptionSame(value(), reordered)).toBe(true);
    });
    it('certificate ដែល RTDB អានត្រឡប់ជា array (slot ជាលេខ) នៅតែត្រឹមត្រូវ ហើយដូចតម្លៃដែលសរសេរ', () => {
        const dense = { ...core, ...certificate(['0', '1', '2'].map(slot => receipt(slot, 3))) };
        const read: any = clone(dense); read.members = [read.members['0'], read.members['1'], read.members['2']];
        expect(generation.trashConsumptionValid(read)).toBe(true);
        expect(generation.trashConsumptionSame(dense, read)).toBe(true);
        const sparse: any = { ...core, ...certificate(['0', '2'].map(slot => receipt(slot, 2))) };
        const sparseRead: any = clone(sparse); sparseRead.members = [sparseRead.members['0'], null, sparseRead.members['2']];
        expect(generation.trashConsumptionValid(sparseRead)).toBe(true);
        expect(generation.trashConsumptionSame(sparse, sparseRead)).toBe(true);
        const keyed: any = { ...core, first: '0', members: { '0': { o: 0, id: receipt('0', 1).id } }, keys: [receipt('0', 1).id] };
        expect(generation.trashConsumptionValid(keyed)).toBe(true);
        expect(generation.trashSourceUnconsumed({ id: 'source', trashGeneration: 4, deletedAt: core.deletedAt + 1 }, read)).toBe(true);
        const shifted: any = clone(read); shifted.members = [null, ...read.members];
        expect(generation.trashConsumptionValid(shifted)).toBe(false);
    });
    it.each(['partial', 'restore', 'order', 'duplicate-id', 'keys-value', 'keys-size', 'bad-id', 'bad-slot', 'extra-member-field', 'first-missing'])('certificate %s មិនត្រឹមត្រូវ', kind => {
        const g: any = value();
        if (kind === 'partial') delete g.keys;
        if (kind === 'restore') Object.assign(g, { kind: 'restore', token: 't', targetId: 'x' });
        if (kind === 'order') { g.members['0'].o = 1; g.members['7'].o = 0; g.first = '7'; }
        if (kind === 'duplicate-id') { g.members['7'].id = g.members['0'].id; g.keys.CODE7 = g.members['0'].id; }
        if (kind === 'keys-value') g.keys.CODE7 = 'release_' + 'f'.repeat(32);
        if (kind === 'keys-size') delete g.keys.CODE7;
        if (kind === 'bad-id') { g.members['7'].id = 'release_x'; g.keys.CODE7 = 'release_x'; }
        if (kind === 'bad-slot') { g.members['07'] = g.members['7']; delete g.members['7']; }
        if (kind === 'extra-member-field') g.members['7'].x = 1;
        if (kind === 'first-missing') delete g.first;
        expect(generation.trashConsumptionValid(g)).toBe(false);
        expect(generation.trashConsumptionSame(value(), g)).toBe(false);
    });
});
