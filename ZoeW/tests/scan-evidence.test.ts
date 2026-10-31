import { afterEach, expect, it, vi } from 'vitest';
import { createScanEvidenceJournal, SCAN_EVIDENCE_MAX_BYTES, SCAN_EVIDENCE_MAX_PENDING, SCAN_EVIDENCE_PREFIX } from '../src/services/scan-evidence';

function memory() {
    const rows = new Map<string, string>();
    const storage: Storage = {
        get length() { return rows.size; },
        key: (index) => [...rows.keys()][index] ?? null,
        getItem: (key) => rows.get(key) ?? null,
        setItem: (key, value) => { rows.set(key, String(value)); },
        removeItem: (key) => { rows.delete(key); },
        clear: () => rows.clear()
    };
    return { rows, storage };
}
const scope = 'firebase|https://shop.firebaseio.com|userA';
const payload = { barcode: 'ZTO100001', createdAt: 1793000000000, cod: 5, dod: 0, scanDate: '2026-10-26', mode: 'simple' };
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('prepared intent survives a new journal instance and keeps immutable lifecycle identity', () => {
    const { storage } = memory();
    const first = createScanEvidenceJournal(storage);
    const handle = first.prepare(scope, payload);
    first.appendPhase(handle, { phase: 'claim-pending' });
    first.appendPhase(handle, { phase: 'save-pending', itemId: 'item1' });
    const restarted = createScanEvidenceJournal(storage);
    expect(restarted.list(scope)).toEqual([expect.objectContaining({ ...payload, id: handle.id, scope, itemId: 'item1', phase: 'save-pending' })]);
    expect(() => restarted.appendPhase(handle, { phase: 'pending', itemId: 'other' })).toThrow();
    expect(restarted.list(scope)[0].itemId).toBe('item1');
});

it('independent tabs use per-operation keys and never replace another pending scan', () => {
    const { storage } = memory();
    const a = createScanEvidenceJournal(storage); const b = createScanEvidenceJournal(storage);
    const one = a.prepare(scope, payload); const two = b.prepare(scope, { ...payload, barcode: 'ZTO100002' });
    a.appendPhase(one, { phase: 'hold' }); b.appendPhase(two, { phase: 'pending' });
    expect(new Set(a.list(scope).map((row) => row.id))).toEqual(new Set([one.id, two.id]));
    expect(one.id).not.toBe(two.id);
});

it('append-only phases cannot hide a hold and repeating the same phase consumes no space', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage);
    const handle = journal.prepare(scope, payload);
    journal.appendPhase(handle, { phase: 'hold' });
    journal.appendPhase(handle, { phase: 'claimed' });
    const size = rows.size;
    for (let n = 0; n < 20; n++) journal.appendPhase(handle, { phase: 'claimed' });
    expect(rows.size).toBe(size);
    expect(journal.list(scope)[0].phase).toBe('hold');
});

it('tenant/user/backend scopes are independent even for the same barcode', () => {
    const { storage } = memory(); const journal = createScanEvidenceJournal(storage);
    for (const own of [scope, scope + '|otherUser', 'supabase|https://project.invalid|tenantA|u1', 'supabase|https://project.invalid|tenantB|u1']) journal.prepare(own, payload);
    expect(journal.list(scope)).toHaveLength(1);
    expect(journal.list('supabase|https://project.invalid|tenantB|u1')).toHaveLength(1);
    expect(journal.list('firebase|https://else.invalid|userA')).toHaveLength(0);
});

it('unknown survives time passing and list never performs a server mutation or deletes evidence', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage);
    const handle = journal.prepare(scope, payload); journal.appendPhase(handle, { phase: 'pending' });
    const before = [...rows];
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 400 * 86400000);
    expect(createScanEvidenceJournal(storage).list(scope)[0].phase).toBe('pending');
    expect([...rows]).toEqual(before);
});

it.each(['prepared', 'claim-pending'] as const)('not-started may retire %s only with explicit proof', (phase) => {
    const { storage } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    if (phase !== 'prepared') journal.appendPhase(handle, { phase });
    expect(journal.finish(handle, 'not-started')).toBe(true);
    expect(journal.list(scope)).toEqual([]);
});

it.each(['claimed', 'save-pending', 'pending', 'hold'] as const)('not-started cannot erase %s evidence', (phase) => {
    const { storage } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    journal.appendPhase(handle, { phase });
    expect(() => journal.finish(handle, 'not-started')).toThrow();
    expect(journal.list(scope)).toHaveLength(1);
});

it.each(['saved-and-ledger-confirmed', 'compensated-and-release-confirmed'] as const)('only explicit terminal proof %s permits completion after hold', (proof) => {
    const { storage } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    journal.appendPhase(handle, { phase: 'hold' });
    expect(() => journal.finish(handle, 'unknown' as any)).toThrow();
    expect(journal.list(scope)).toHaveLength(1);
    journal.finish(handle, proof);
    expect(journal.list(scope)).toEqual([]);
});

it('terminal marker is durable before cleanup; crash during deletion cannot resurrect an unresolved scan', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    journal.appendPhase(handle, { phase: 'pending' });
    const remove = vi.spyOn(storage, 'removeItem').mockImplementation(() => { throw new Error('simulated crash'); });
    journal.finish(handle, 'saved-and-ledger-confirmed');
    expect([...rows.keys()].some((key) => key.endsWith(':terminal'))).toBe(true);
    expect(createScanEvidenceJournal(storage).list(scope)).toEqual([]);
    remove.mockRestore();
    journal.finish(handle, 'saved-and-ledger-confirmed');
    expect(rows.size).toBe(0);
});

it('a failed terminal persist leaves all unresolved evidence intact', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    journal.appendPhase(handle, { phase: 'pending' }); const before = [...rows];
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => journal.finish(handle, 'saved-and-ledger-confirmed')).toThrow();
    expect([...rows]).toEqual(before);
    expect(journal.list(scope)[0].phase).toBe('pending');
});

it('malformed/orphan evidence stays visible as corrupt hold and cannot be finished', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    const key = [...rows.keys()][0]; rows.set(key, '{bad json');
    expect(journal.list(scope)).toEqual([{ id: handle.id, scope: handle.scope, phase: 'hold', corrupt: true }]);
    expect(() => journal.finish(handle, 'saved-and-ledger-confirmed')).toThrow();
    expect(rows.get(key)).toBe('{bad json');
});

it('a malformed terminal marker cannot hide a pending scan', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    rows.set([...rows.keys()][0].replace(/prepared$/, 'terminal'), '{}');
    expect(journal.list(scope)[0]).toMatchObject({ id: handle.id, phase: 'hold', corrupt: true });
});

it('a correctly scoped marker with unknown outcome cannot hide or garbage-collect evidence', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    rows.set([...rows.keys()][0].replace(/prepared$/, 'terminal'), JSON.stringify({ id: handle.id, scope, proof: 'unknown' }));
    expect(journal.list(scope)[0]).toMatchObject({ id: handle.id, phase: 'hold', corrupt: true });
    journal.prepare(scope, { ...payload, barcode: 'ZTO100002' });
    expect(journal.list(scope).some((row) => row.id === handle.id && row.corrupt)).toBe(true);
    expect([...rows.keys()].filter((key) => key.includes(handle.id))).toHaveLength(2);
});

it('storage failure and silent failure reject preparation before the caller starts any effect', () => {
    expect(() => createScanEvidenceJournal(null).prepare(scope, payload)).toThrow();
    const { storage } = memory();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {});
    expect(() => createScanEvidenceJournal(storage).prepare(scope, payload)).toThrow();
    expect(storage.length).toBe(0);
});

it('the pending count bound rejects new work without evicting any unresolved evidence', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage);
    for (let n = 0; n < SCAN_EVIDENCE_MAX_PENDING; n++) journal.prepare(scope, { ...payload, barcode: 'B' + n });
    const before = [...rows];
    expect(() => journal.prepare(scope, payload)).toThrow(/pending limit/);
    expect([...rows]).toEqual(before);
    expect(journal.list(scope)).toHaveLength(SCAN_EVIDENCE_MAX_PENDING);
});

it('the byte bound preserves existing evidence and rejects the next preparation', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage);
    rows.set(SCAN_EVIDENCE_PREFIX + 'opaque', 'x'.repeat(SCAN_EVIDENCE_MAX_BYTES / 2));
    const before = [...rows];
    expect(() => journal.prepare(scope, payload)).toThrow(/storage full/);
    expect([...rows]).toEqual(before);
});

it('stored payload includes only business evidence, never extra phone/cookie/config fields', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage);
    journal.prepare(scope, { ...payload, phone: 'private-phone', cookie: 'private-cookie', config: 'private-config' } as any);
    expect([...rows.values()].join()).not.toMatch(/private-phone|private-cookie|private-config/);
    expect(() => journal.prepare(scope, { ...payload, createdAt: 0 })).toThrow();
    expect(() => journal.prepare(scope, { ...payload, cod: NaN })).toThrow();
});

it('completion racing a previously started append leaves an orphan visible, never silently drops pending evidence', () => {
    const { storage } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    const write = storage.setItem;
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
        if (key.endsWith(':pending')) journal.finish(handle, 'saved-and-ledger-confirmed');
        write(key, value);
    });
    journal.appendPhase(handle, { phase: 'pending' });
    expect(journal.list(scope)).toEqual([{ id: handle.id, scope, phase: 'hold', corrupt: true }]);
});

it('not-started completion cannot erase a claimed phase appended during its terminal write', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage); const handle = journal.prepare(scope, payload);
    const write = storage.setItem;
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
        if (key.endsWith(':terminal')) journal.appendPhase(handle, { phase: 'claimed' });
        write(key, value);
    });
    expect(journal.finish(handle, 'not-started')).toBe(false);
    expect(journal.list(scope)[0]).toMatchObject({ id: handle.id, phase: 'hold', corrupt: true });
    expect([...rows.keys()].some((key) => key.endsWith(':claimed'))).toBe(true);
});

it('a later preparation cleans only verified terminal leftovers, preserving unresolved rows', () => {
    const { storage, rows } = memory(); const journal = createScanEvidenceJournal(storage);
    const done = journal.prepare(scope, payload); const pending = journal.prepare(scope, { ...payload, barcode: 'ZTO100002' });
    const remove = vi.spyOn(storage, 'removeItem').mockImplementation(() => { throw new Error('crash'); });
    journal.finish(done, 'saved-and-ledger-confirmed'); remove.mockRestore();
    journal.prepare(scope, { ...payload, barcode: 'ZTO100003' });
    expect([...rows.keys()].some((key) => key.includes(done.id))).toBe(false);
    expect(journal.list(scope).some((row) => row.id === pending.id)).toBe(true);
});

it('encoded scopes and strict operation identities cannot read or overwrite another scope key', () => {
    const { storage } = memory(); const journal = createScanEvidenceJournal(storage);
    const names = ['A', 'A:B', 'A%3AB'];
    const handles = names.map((name) => journal.prepare(name, payload));
    names.forEach((name, i) => expect(journal.list(name).map((row) => row.id)).toEqual([handles[i].id]));
    expect(() => journal.appendPhase({ ...handles[0], id: handles[1].id + ':prepared' }, { phase: 'pending' })).toThrow();
    expect(() => journal.finish({ ...handles[0], scope: 'A:B' }, 'saved-and-ledger-confirmed')).toThrow();
    expect(journal.list('A')).toHaveLength(1);
    expect(journal.list('A:B')).toHaveLength(1);
});
