import { firebaseState } from '../core/state';
import { liveShopScope } from '../core/shop-scope';
import { barcodeEntriesOf } from '../domain/barcode';

export type PriceOperationPhase = 'admitted' | 'history' | 'cancelling' | 'settled';
export type PriceOperationOutcome = 'committed' | 'compensated';
export type PriceOperationMarker = {
    token: string;
    actorUid: string;
    code: string;
    slot: string;
    birth: number;
    rowBirth: number;
    scanDate: string;
    priorCod: number;
    priorDod: number;
    wantCod: number;
    wantDod: number;
    phase: PriceOperationPhase;
    outcome?: PriceOperationOutcome;
};
export type PriceOperationHandle = {
    itemId: string;
    marker: PriceOperationMarker;
    expected: any;
    db: typeof firebaseState.db;
    sdk: typeof firebaseState.fb;
    auth: number;
    scope: string;
};

export const PRICE_PROTOCOL_V2_TAG = 'c0de5eed00000002';
const immutableKeys = ['token', 'actorUid', 'code', 'slot', 'birth', 'rowBirth', 'scanDate', 'priorCod', 'priorDod', 'wantCod', 'wantDod'];
const textBound = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const birthValid = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 9007199254740990;
const priceValid = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 90071992547409 && Math.round(value * 100) / 100 === value;
const birthOf = (value) => value === undefined || value === null ? 0 : value;
const moneyOf = (value) => value === undefined || value === null ? 0 : value;
const copy = (value) => JSON.parse(JSON.stringify(value));

export function priceOperationMarkerValid(marker): marker is PriceOperationMarker {
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
    if (!/^price_[a-f0-9]{32}$/.test(marker.token) || !textBound(marker.actorUid, 2048) || !textBound(marker.code, 2048)
        || typeof marker.slot !== 'string' || !/^(0|[1-9][0-9]{0,8})$/.test(marker.slot)
        || !birthValid(marker.birth) || !birthValid(marker.rowBirth) || !/^\d{4}-\d{2}-\d{2}$/.test(marker.scanDate)
        || !['priorCod', 'priorDod', 'wantCod', 'wantDod'].every((key) => priceValid(marker[key]))
        || !['admitted', 'history', 'cancelling', 'settled'].includes(marker.phase)
        || Object.keys(marker).some((key) => ![...immutableKeys, 'phase', 'outcome'].includes(key))) return false;
    return marker.phase === 'settled' ? ['committed', 'compensated'].includes(marker.outcome) : marker.outcome === undefined;
}

export function rowOperationActive(row) {
    if (!row || typeof row !== 'object') return false;
    if (row.scanPending !== undefined && row.scanPending !== null) return true;
    return row.pricePending !== undefined && row.pricePending !== null
        && (!priceOperationMarkerValid(row.pricePending) || row.pricePending.phase !== 'settled');
}

function canonical(value): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    return '{' + Object.keys(value).filter((key) => value[key] !== undefined && value[key] !== null)
        .sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function rowIdentity(row) {
    const value = { ...row };
    delete value.id;
    delete value.pricePending;
    return canonical(value);
}

function rowBlocked(row) {
    return !row || rowOperationActive(row)
        || ['clearClaim', 'restoreClaim', 'restoreClaimId', 'restoreClaimToken', 'restoreAddedCodes', 'trashClaim', 'trashClaimAt']
            .some((key) => row[key] !== undefined && row[key] !== null)
        || barcodeEntriesOf(row.barcodes).some(({ barcode }) => barcode && ['trashClaim', 'trashClaimAt'].some((key) => barcode[key] !== undefined && barcode[key] !== null));
}

export function capturePriceOperation(item, code, wantCod, wantDod): PriceOperationHandle | null {
    const sdk = firebaseState.fb;
    const operationDb = firebaseState.db;
    const scope = liveShopScope();
    const actorUid = firebaseState.auth?.currentUser?.uid;
    if (!sdk || !operationDb || !scope || !textBound(actorUid, 2048) || !textBound(code, 2048)
        || !/^[a-zA-Z0-9_-]{1,128}$/.test(item?.id || '') || rowBlocked(item)) return null;
    const entries = barcodeEntriesOf(item.barcodes).filter(({ barcode }) => barcode?.code === code);
    if (entries.length !== 1) return null;
    const { barcode, index } = entries[0];
    const bytes = new Uint8Array(8);
    try { crypto.getRandomValues(bytes); } catch (e) { return null; }
    const marker: PriceOperationMarker = {
        token: 'price_' + PRICE_PROTOCOL_V2_TAG + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
        actorUid, code, slot: String(index), birth: birthOf(barcode.createdAt), rowBirth: birthOf(item.createdAt),
        scanDate: item.scanDate, priorCod: moneyOf(barcode.cod), priorDod: moneyOf(barcode.dod), wantCod, wantDod, phase: 'admitted'
    };
    if (!priceOperationMarkerValid(marker)) return null;
    return { itemId: item.id, marker, expected: copy(item), db: operationDb, sdk, auth: firebaseState.authGeneration, scope };
}

export function priceOperationProtocol(marker) {
    return priceOperationMarkerValid(marker) && marker.token.slice(6, 6 + PRICE_PROTOCOL_V2_TAG.length) === PRICE_PROTOCOL_V2_TAG ? 'v2' : 'legacy';
}

export function priceOperationFromRow(itemId: string, row): PriceOperationHandle | null {
    const marker = row?.pricePending;
    const sdk = firebaseState.fb;
    const operationDb = firebaseState.db;
    const scope = liveShopScope();
    if (!sdk || !operationDb || !scope || !/^[a-zA-Z0-9_-]{1,128}$/.test(itemId || '') || !priceOperationMarkerValid(marker) || marker.phase === 'settled'
        || marker.actorUid !== firebaseState.auth?.currentUser?.uid || row.id !== undefined && row.id !== itemId) return null;
    const view = copy(row);
    delete view.pricePending;
    delete view.id;
    if (view.barcodes?.[marker.slot]?.code !== marker.code) return null;
    const expected = marker.phase === 'history' ? slotPricedRow(view, marker.slot, marker.priorCod, marker.priorDod) : view;
    const immutable: any = {};
    for (const key of immutableKeys) immutable[key] = marker[key];
    return { itemId, marker: { ...immutable, phase: 'admitted' }, expected, db: operationDb, sdk, auth: firebaseState.authGeneration, scope };
}

export function priceOperationCurrent(handle: PriceOperationHandle) {
    return !!handle && handle.db === firebaseState.db && handle.sdk === firebaseState.fb && handle.auth === firebaseState.authGeneration
        && handle.marker.actorUid === firebaseState.auth?.currentUser?.uid && handle.scope === liveShopScope();
}

function slotPricedRow(source, slot: string, cod: number, dod: number) {
    const row = copy(source);
    row.barcodes[slot].cod = cod;
    row.barcodes[slot].dod = dod;
    const entries = barcodeEntriesOf(row.barcodes);
    row.cod = Math.round(entries.reduce((total, { barcode }) => total + (parseFloat(barcode.cod) || 0), 0) * 100) / 100;
    row.dod = Math.round(entries.reduce((total, { barcode }) => total + (parseFloat(barcode.dod) || 0), 0) * 100) / 100;
    row.price = Math.round((row.cod + row.dod) * 100) / 100;
    return row;
}

export function pricedRow(handle: PriceOperationHandle) {
    return slotPricedRow(handle.expected, handle.marker.slot, handle.marker.wantCod, handle.marker.wantDod);
}

export function priceOperationOwned(row, handle: PriceOperationHandle, phase: PriceOperationPhase, outcome?: PriceOperationOutcome) {
    const marker = row?.pricePending;
    if (!priceOperationCurrent(handle) || !priceOperationMarkerValid(marker) || marker.phase !== phase
        || marker.outcome !== outcome || !immutableKeys.every((key) => marker[key] === handle.marker[key])
        || row.id !== undefined && row.id !== handle.itemId) return false;
    const expected = phase === 'history' || phase === 'settled' && outcome === 'committed' ? pricedRow(handle) : handle.expected;
    return rowIdentity(row) === rowIdentity(expected);
}

function priceAdmissionBasis(row, handle: PriceOperationHandle) {
    if (!row || row.id !== undefined && row.id !== handle.itemId) return false;
    if (!handle.marker.birth || !handle.marker.rowBirth) return rowIdentity(row) === rowIdentity(handle.expected);
    if (row.createdAt !== handle.marker.rowBirth || row.scanDate !== handle.marker.scanDate
        || ['time', 'restoredAt'].some((key) => (row[key] ?? null) !== (handle.expected[key] ?? null))) return false;
    const matches = barcodeEntriesOf(row.barcodes).filter(({ barcode }) => barcode?.code === handle.marker.code);
    if (matches.length !== 1 || String(matches[0].index) !== handle.marker.slot) return false;
    const barcode = matches[0].barcode;
    const expected = handle.expected.barcodes[handle.marker.slot];
    return barcode.createdAt === handle.marker.birth && moneyOf(barcode.cod) === handle.marker.priorCod && moneyOf(barcode.dod) === handle.marker.priorDod
        && ['time', 'restoredAt', 'isClosed', 'closedAt', 'isDeducted', 'isFromDeletion']
            .every((key) => (barcode[key] ?? null) === (expected[key] ?? null));
}

function priceAdmissionOwned(row, handle: PriceOperationHandle) {
    const marker = row?.pricePending;
    return priceOperationCurrent(handle) && priceOperationMarkerValid(marker) && marker.phase === 'admitted'
        && immutableKeys.every((key) => marker[key] === handle.marker[key])
        && !rowBlocked({ ...row, pricePending: undefined }) && priceAdmissionBasis(row, handle);
}

export async function admitPriceOperation(handle: PriceOperationHandle) {
    if (!priceOperationCurrent(handle)) return null;
    const update: any = (row) => {
        if (!priceOperationCurrent(handle) || rowBlocked(row) || !priceAdmissionBasis(row, handle)) return;
        return { ...row, pricePending: { ...handle.marker } };
    };
    update.txOutcomeWitness = (row) => priceAdmissionOwned(row, handle) ? 'applied' : null;
    const result = await handle.sdk.runTransaction(handle.sdk.ref(handle.db, 'zoew_scan_history_cod_dod/' + handle.itemId), update, { applyLocally: false });
    const row = result?.snapshot?.val();
    if (!result?.committed || !priceAdmissionOwned(row, handle)) return null;
    handle.expected = copy(row);
    return row;
}

export async function movePriceOperation(handle: PriceOperationHandle, from: PriceOperationPhase, to: PriceOperationPhase, outcome?: PriceOperationOutcome) {
    if (!priceOperationCurrent(handle) || !((from === 'admitted' && ['history', 'cancelling'].includes(to) && outcome === undefined)
        || (from === 'history' && to === 'settled' && outcome === 'committed')
        || (from === 'cancelling' && to === 'settled' && outcome === 'compensated'))) return null;
    const update: any = (row) => {
        if (!priceOperationOwned(row, handle, from)) return;
        const next = { ...row };
        if (to === 'history') {
            const priced = pricedRow(handle);
            next.barcodes = priced.barcodes;
            next.cod = priced.cod;
            next.dod = priced.dod;
            next.price = priced.price;
        }
        next.pricePending = { ...handle.marker, phase: to, ...(outcome ? { outcome } : {}) };
        return next;
    };
    update.txOutcomeWitness = (row) => priceOperationOwned(row, handle, to, outcome) ? 'applied' : null;
    const result = await handle.sdk.runTransaction(handle.sdk.ref(handle.db, 'zoew_scan_history_cod_dod/' + handle.itemId), update, { applyLocally: false });
    const row = result?.snapshot?.val();
    return result?.committed && priceOperationOwned(row, handle, to, outcome) ? row : null;
}
