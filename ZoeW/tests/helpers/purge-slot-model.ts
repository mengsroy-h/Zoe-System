import { purgeCertificateOf } from '../../src/domain/trash-generation';

const T = 'zoew_recently_deleted_cod_dod', G = 'zoew_trash_consumptions', P = 'zoew_registry_releases';
const plain = (value: any) => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (left: any, right: any): boolean => left === right || plain(left) && plain(right)
    && Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => same(left[key], right[key]));

export function prunedPut(store: Record<string, any>, path: string, value: any) {
    const keys = path.split('/').filter(Boolean), chain: any[] = [store];
    let target = store;
    for (const key of keys.slice(0, -1)) { target = target[key] ||= {}; chain.push(target); }
    if (value == null) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = JSON.parse(JSON.stringify(value));
    for (let index = keys.length - 2; index >= 1; index--) {
        const node = chain[index + 1];
        if (node && typeof node === 'object' && !Object.keys(node).length) delete chain[index][keys[index]];
    }
}

export function purgesSource(patch: Record<string, any>, sourceId: string) {
    return Object.keys(patch).some(path => path.startsWith(P + '/'))
        && Object.keys(patch).some(path => path === T + '/' + sourceId || path.startsWith(T + '/' + sourceId + '/'));
}

export function slotPurgeAdmitted(patch: Record<string, any>, sourceId: string, source: any) {
    if (!plain(source) || Object.prototype.hasOwnProperty.call(patch, T + '/' + sourceId) || patch[T + '/' + sourceId + '/barcodes'] !== undefined) return false;
    const receipts = Object.entries(patch).filter(([path, value]) => path.startsWith(P + '/') && value?.trashId === sourceId).map(([, value]) => value);
    const live = Object.entries(source.barcodes || {}).filter(([, barcode]) => barcode !== null && barcode !== undefined).map(([slot]) => slot);
    const consumption = patch[G + '/' + sourceId], certificate = purgeCertificateOf(receipts);
    return !!certificate && live.length === source.count && receipts.length === live.length
        && live.every(slot => patch[T + '/' + sourceId + '/barcodes/' + slot] === null && receipts.some(receipt => receipt.slot === slot))
        && Object.keys(source).filter(key => key !== 'barcodes').every(key => patch[T + '/' + sourceId + '/' + key] === null)
        && ['first', 'members', 'keys'].every(key => same(consumption?.[key], (certificate as any)[key]));
}
