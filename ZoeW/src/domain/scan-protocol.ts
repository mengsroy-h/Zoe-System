import { canonicalBarcodeRegistryKey } from './barcode-key';

export const SCAN_OPERATIONS_ROOT = 'zoew_scan_operations';
export const SCAN_PENDING_ROOT = 'zoew_scan_pending';
export const SCAN_PROTOCOL_VERSION = 2;
export const SCAN_PROTOCOL_MAX_INTEGER = 9007199254740990;
export const SCAN_STORED_MONEY_TOLERANCE = 1e-7;
export const SCAN_LEDGER_MAX_MONEY = 2 ** 28;

export type ScanOperationPhase = 'admitted' | 'prepared' | 'committed' | 'cancelled';
export type ScanOperation = {
    v: 2;
    id: string;
    actorUid: string;
    scope: string;
    code: string;
    registryKey: string;
    birth: number;
    scanDate: string;
    month: string;
    cod: number;
    dod: number;
    count: 1;
    monthToken: string;
    phase: ScanOperationPhase;
    targetId?: string;
    payloadHash?: string;
    phone?: string;
    locker?: string;
    closedAt?: number;
};

export type ScanPendingMarker = {
    intent: string;
    actorUid: string;
    code: string;
    birth: number;
    slot: string;
    payloadHash: string;
};

export function scanProtocolText(value: unknown, maximum: number) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

export function scanProtocolInteger(value: unknown, minimum = 0) {
    return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= SCAN_PROTOCOL_MAX_INTEGER;
}

export function scanProtocolMoney(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        && Math.round(value * 100) / 100 === value && scanProtocolInteger(Math.round(value * 100));
}

export function scanStoredMoney(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
    const cents = Math.round(value * 100);
    return scanProtocolInteger(cents) && Math.abs(value - cents / 100) <= SCAN_STORED_MONEY_TOLERANCE;
}

export function scanLedgerIncrementSafe(value: number, delta: number) {
    if (!scanStoredMoney(value) || !scanProtocolMoney(delta) || value > SCAN_LEDGER_MAX_MONEY) return false;
    const next = value + delta;
    const wanted = Math.round(value * 100) + Math.round(delta * 100);
    return next <= SCAN_LEDGER_MAX_MONEY && scanStoredMoney(next) && scanProtocolInteger(wanted) && Math.round(next * 100) === wanted;
}

export function scanOperationValid(value: any): value is ScanOperation {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.v !== 2
        || !/^scan_[a-f0-9]{32}$/.test(value.id) || !scanProtocolText(value.actorUid, 2048)
        || !scanProtocolText(value.scope, 2048) || !scanProtocolText(value.code, 256)
        || !scanProtocolText(value.registryKey, 768) || value.registryKey !== canonicalBarcodeRegistryKey(value.code) || !scanProtocolInteger(value.birth, 1)
        || !/^\d{4}-\d{2}-\d{2}$/.test(value.scanDate) || value.month !== value.scanDate.slice(0, 7)
        || !scanProtocolMoney(value.cod) || !scanProtocolMoney(value.dod) || value.count !== 1
        || value.monthToken !== 'op_m' + value.id.slice(5)
        || !['admitted', 'prepared', 'committed', 'cancelled'].includes(value.phase)) return false;
    const fields = ['v', 'id', 'actorUid', 'scope', 'code', 'registryKey', 'birth', 'scanDate', 'month', 'cod', 'dod', 'count', 'monthToken', 'phase'];
    if (['targetId', 'payloadHash', 'phone', 'locker', 'closedAt'].some(key => value[key] !== undefined) || value.phase === 'prepared' || value.phase === 'committed') {
        if (!scanProtocolText(value.targetId, 128) || !/^[a-zA-Z0-9_-]+$/.test(value.targetId)
            || typeof value.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.payloadHash)
            || !scanProtocolText(value.phone, 2048) || !scanProtocolText(value.locker, 2048) || !scanProtocolInteger(value.closedAt)
            || value.phase === 'admitted') return false;
        fields.push('targetId', 'payloadHash', 'phone', 'locker', 'closedAt');
    }
    return Object.keys(value).every(key => fields.includes(key));
}

export function scanOperationSame(left: any, right: any, prepared = true) {
    if (!scanOperationValid(left) || !scanOperationValid(right)) return false;
    const fields = ['v', 'id', 'actorUid', 'scope', 'code', 'registryKey', 'birth', 'scanDate', 'month', 'cod', 'dod', 'count', 'monthToken'];
    if (prepared) fields.push('targetId', 'payloadHash', 'phone', 'locker', 'closedAt');
    return fields.every(field => left[field] === right[field]);
}

export function scanRegistryOwner(operation: ScanOperation) {
    return { v: 2, intent: operation.id, actorUid: operation.actorUid, birth: operation.birth };
}

export function scanRegistryOwned(value: any, operation: ScanOperation) {
    const expected = scanRegistryOwner(operation);
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === Object.keys(expected).length
        && Object.keys(expected).every(key => value[key] === expected[key]);
}

export function scanPendingSlot(row): string | null | undefined {
    const marker = row?.scanPending;
    if (marker === undefined || marker === null) return undefined;
    if (!marker || typeof marker !== 'object' || Array.isArray(marker) || Object.keys(marker).length !== 6
        || !/^scan_[a-f0-9]{32}$/.test(marker.intent) || !scanProtocolText(marker.actorUid, 2048)
        || !scanProtocolText(marker.code, 256) || !scanProtocolInteger(marker.birth, 1)
        || typeof marker.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(marker.payloadHash)
        || typeof marker.slot !== 'string' || !/^(0|[1-9][0-9]{0,8})$/.test(marker.slot)) return null;
    const barcode = row?.barcodes?.[marker.slot];
    return barcode?.code === marker.code && barcode?.createdAt === marker.birth && barcode?.scanIntent === marker.intent ? marker.slot : null;
}

export function scanConfirmedBarcodes(row): any[] | null {
    const slot = scanPendingSlot(row);
    if (slot === null) return null;
    return Object.entries(row?.barcodes || {}).filter(([key]) => key !== slot).map(([, barcode]) => barcode);
}

export function scanPendingMatches(row: any, operation: ScanOperation) {
    const marker = row?.scanPending;
    if (!scanOperationValid(operation) || !operation.targetId || scanPendingSlot(row) === undefined || scanPendingSlot(row) === null
        || marker.intent !== operation.id || marker.actorUid !== operation.actorUid
        || marker.code !== operation.code || marker.birth !== operation.birth || marker.payloadHash !== operation.payloadHash
        || typeof marker.slot !== 'string' || !/^(0|[1-9][0-9]{0,8})$/.test(marker.slot)) return false;
    const barcode = row?.barcodes?.[marker.slot];
    return !!barcode && barcode.code === operation.code && barcode.createdAt === operation.birth
        && barcode.cod === operation.cod && barcode.dod === operation.dod && row.scanDate === operation.scanDate
        && row.phone === operation.phone && barcode.locker === operation.locker
        && (operation.closedAt === 0 ? barcode.isClosed === false && !barcode.closedAt
            : barcode.isClosed === true && barcode.closedAt === operation.closedAt);
}
