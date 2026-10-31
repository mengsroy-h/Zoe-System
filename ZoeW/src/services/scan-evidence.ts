import { scanImportProofValid, type ScanImportProof } from './scan-import-proof';

export const SCAN_EVIDENCE_PREFIX = 'zoew_scan_evidence_v1:';
export const SCAN_EVIDENCE_V2_PREFIX = 'zoew_scan_evidence_v2:';
export const SCAN_EVIDENCE_MAX_PENDING = 200;
export const SCAN_EVIDENCE_MAX_BYTES = 512 * 1024;

export type ScanEvidencePhase = 'prepared' | 'claim-pending' | 'claimed' | 'save-pending' | 'pending' | 'hold' | 'collected-pending';
export type ScanEvidenceProof = 'saved-and-ledger-confirmed' | 'compensated-and-release-confirmed' | 'not-started';
export type ScanEvidencePayload = {
    barcode: string;
    createdAt: number;
    cod: number;
    dod: number;
    scanDate?: string;
    itemId?: string;
    mode?: string;
    importProof?: ScanImportProof;
};
export type ScanEvidenceHandle = { id: string; scope: string };
export type ScanEvidenceRecord = ScanEvidenceHandle & Partial<ScanEvidencePayload> & { phase: ScanEvidencePhase; corrupt?: boolean; v?: 1 | 2 };

const phases: ScanEvidencePhase[] = ['prepared', 'claim-pending', 'claimed', 'save-pending', 'pending', 'hold', 'collected-pending'];
const proofs: ScanEvidenceProof[] = ['saved-and-ledger-confirmed', 'compensated-and-release-confirmed', 'not-started'];
const textOf = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
const failure = (message: string) => Object.assign(new Error(message), { code: 'scan_evidence_unavailable', noRetry: true });

export function createScanEvidenceJournal(storage: Storage | null | undefined, version: 1 | 2 = 1) {
    const prefix = version === 2 ? SCAN_EVIDENCE_V2_PREFIX : SCAN_EVIDENCE_PREFIX;
    const scopePrefix = (scope: string) => {
        if (!textOf(scope, 2048)) throw failure('Scan evidence scope unavailable');
        return prefix + encodeURIComponent(scope) + ':';
    };
    const baseOf = (handle: ScanEvidenceHandle) => {
        if (!/^scan_[a-f0-9]{32}$/.test(handle.id)) throw failure('Scan evidence identity invalid');
        return scopePrefix(handle.scope) + handle.id + ':';
    };
    const keys = () => {
        if (!storage) throw failure('Scan evidence storage unavailable');
        const result: string[] = [];
        try {
            for (let index = 0; index < storage.length; index++) {
                const key = storage.key(index);
                if (key && (key.startsWith(SCAN_EVIDENCE_PREFIX) || key.startsWith(SCAN_EVIDENCE_V2_PREFIX))) result.push(key);
            }
        } catch (e) { throw failure('Scan evidence storage unreadable'); }
        return result;
    };
    const read = (key: string) => {
        try { return storage?.getItem(key) ?? null; }
        catch (e) { throw failure('Scan evidence storage unreadable'); }
    };
    const parse = (key: string) => {
        try { return JSON.parse(read(key) || 'null'); } catch (e) { return null; }
    };
    const write = (key: string, value: unknown, terminal = false) => {
        if (!storage) throw failure('Scan evidence storage unavailable');
        const encoded = JSON.stringify(value);
        const existing = read(key);
        if (existing !== null) {
            if (existing === encoded) return;
            throw failure('Scan evidence already exists');
        }
        if (!terminal) {
            const size = keys().reduce((total, saved) => total + 2 * (saved.length + (read(saved)?.length || 0)), 0);
            if (size + 2 * (key.length + encoded.length) > SCAN_EVIDENCE_MAX_BYTES) throw failure('Scan evidence storage full');
        }
        try {
            storage.setItem(key, encoded);
            if (storage.getItem(key) !== encoded) throw failure('Scan evidence was not persisted');
        } catch (e) { throw failure('Scan evidence was not persisted'); }
    };
    const validPayload = (row: any) => row && textOf(row.barcode, 256) && Number.isFinite(row.createdAt) && row.createdAt > 0
        && Number.isFinite(row.cod) && row.cod >= 0 && Number.isFinite(row.dod) && row.dod >= 0
        && (row.scanDate === undefined || textOf(row.scanDate, 32)) && (row.itemId === undefined || textOf(row.itemId, 128))
        && (row.mode === undefined || textOf(row.mode, 64))
        && (row.importProof === undefined || version === 2 && row.mode === 'zto-import' && scanImportProofValid(row.importProof)
            && JSON.parse(row.importProof.identity)[0] === row.scanDate && JSON.parse(row.importProof.identity)[1] === row.createdAt);
    const recordOf = (handle: ScanEvidenceHandle): ScanEvidenceRecord => {
        const base = baseOf(handle);
        const row = parse(base + 'prepared');
        let corrupt = !row || row.v !== version || row.id !== handle.id || row.scope !== handle.scope || !validPayload(row);
        const result: ScanEvidenceRecord = corrupt ? { id: handle.id, scope: handle.scope, phase: 'hold', corrupt: true } : {
            id: handle.id, scope: handle.scope, barcode: row.barcode, createdAt: row.createdAt, cod: row.cod, dod: row.dod, phase: 'prepared',
            ...(version === 2 ? { v: 2 as const } : {}),
            ...(row.scanDate !== undefined ? { scanDate: row.scanDate } : {}), ...(row.itemId !== undefined ? { itemId: row.itemId } : {}),
            ...(row.mode !== undefined ? { mode: row.mode } : {}),
            ...(row.importProof !== undefined ? { importProof: row.importProof } : {})
        };
        for (const key of keys().filter((key) => key.startsWith(base) && key !== base + 'prepared' && key !== base + 'terminal')) {
            const event = parse(key);
            const phase = key.slice(base.length);
            if (!event || event.id !== handle.id || event.scope !== handle.scope || event.phase !== phase || !phases.includes(phase as ScanEvidencePhase)
                || (event.itemId !== undefined && !textOf(event.itemId, 128))) { corrupt = true; continue; }
            if (event.itemId !== undefined) {
                if (result.itemId !== undefined && result.itemId !== event.itemId) corrupt = true;
                else result.itemId = event.itemId;
            }
            if (phases.indexOf(phase as ScanEvidencePhase) > phases.indexOf(result.phase)) result.phase = phase as ScanEvidencePhase;
        }
        if (corrupt) { result.corrupt = true; result.phase = 'hold'; }
        return result;
    };
    const terminalOf = (handle: ScanEvidenceHandle) => {
        const base = baseOf(handle);
        const marker = parse(base + 'terminal');
        if (!marker || marker.id !== handle.id || marker.scope !== handle.scope || !proofs.includes(marker.proof)) return null;
        if (marker.proof === 'not-started' && keys().some((key) => key.startsWith(base) && !['prepared', 'claim-pending', 'terminal'].includes(key.slice(base.length)))) return null;
        return marker;
    };
    const clear = (handle: ScanEvidenceHandle) => {
        const base = baseOf(handle);
        const marker = terminalOf(handle);
        if (!marker) return;
        const saved = keys().filter((key) => key.startsWith(base) && key !== base + 'terminal'
            && (marker.proof !== 'not-started' || key === base + 'prepared' || key === base + 'claim-pending'));
        try {
            for (const key of saved) storage!.removeItem(key);
            if (keys().some((key) => key.startsWith(base) && key !== base + 'terminal')) return;
            storage!.removeItem(base + 'terminal');
        } catch (e) {}
    };
    return {
        prepare(scope: string, payload: ScanEvidencePayload): ScanEvidenceRecord {
            scopePrefix(scope);
            if (!validPayload(payload)) throw failure('Scan evidence payload invalid');
            for (const key of keys().filter((key) => key.endsWith(':terminal'))) {
                const marker = parse(key);
                if (marker && textOf(marker.scope, 2048) && /^scan_[a-f0-9]{32}$/.test(marker.id) && key === baseOf(marker) + 'terminal' && terminalOf(marker)) clear(marker);
            }
            const pending = new Set(keys().map((key) => key.slice(0, key.lastIndexOf(':'))));
            if (pending.size >= SCAN_EVIDENCE_MAX_PENDING) throw failure('Scan evidence pending limit reached');
            const id = 'scan_' + crypto.randomUUID().replace(/-/g, '');
            const handle = { id, scope };
            if (read(baseOf(handle) + 'prepared') !== null) throw failure('Scan evidence identity already exists');
            const row = { v: version, ...handle, barcode: payload.barcode, createdAt: payload.createdAt, cod: payload.cod, dod: payload.dod,
                ...(payload.scanDate !== undefined ? { scanDate: payload.scanDate } : {}), ...(payload.itemId !== undefined ? { itemId: payload.itemId } : {}),
                ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
                ...(payload.importProof !== undefined ? { importProof: payload.importProof } : {}) };
            write(baseOf(handle) + 'prepared', row);
            return { ...row, phase: 'prepared' };
        },
        appendPhase(handle: ScanEvidenceHandle, event: { phase: Exclude<ScanEvidencePhase, 'prepared'>; itemId?: string }) {
            const record = recordOf(handle);
            if (record.corrupt || terminalOf(handle)) throw failure('Scan evidence cannot be amended');
            if (!phases.includes(event.phase) || event.phase === ('prepared' as ScanEvidencePhase)
                || (event.itemId !== undefined && (!textOf(event.itemId, 128) || record.itemId !== undefined && record.itemId !== event.itemId))) {
                throw failure('Scan evidence transition invalid');
            }
            write(baseOf(handle) + event.phase, { id: handle.id, scope: handle.scope, phase: event.phase, ...(event.itemId !== undefined ? { itemId: event.itemId } : {}) });
            return true;
        },
        list(scope: string): ScanEvidenceRecord[] {
            const prefix = scopePrefix(scope);
            const ids = new Set(keys().filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length).split(':')[0]));
            const rows: ScanEvidenceRecord[] = [];
            for (const id of ids) {
                const handle = { id, scope };
                if (!/^scan_[a-f0-9]{32}$/.test(id)) { rows.push({ ...handle, phase: 'hold', corrupt: true }); continue; }
                if (terminalOf(handle)) continue;
                const record = recordOf(handle);
                if (read(baseOf(handle) + 'terminal') !== null) { record.corrupt = true; record.phase = 'hold'; }
                rows.push(record);
            }
            return rows;
        },
        finish(handle: ScanEvidenceHandle, proof: ScanEvidenceProof) {
            if (!proofs.includes(proof)) throw failure('Scan evidence completion proof missing');
            if (terminalOf(handle)) { clear(handle); return true; }
            const record = recordOf(handle);
            if (record.corrupt || proof === 'not-started' && !['prepared', 'claim-pending'].includes(record.phase)) {
                throw failure('Scan evidence remains unresolved');
            }
            write(baseOf(handle) + 'terminal', { id: handle.id, scope: handle.scope, proof }, true);
            clear(handle);
            return !keys().some((key) => key.startsWith(baseOf(handle))) || !!terminalOf(handle);
        }
    };
}
