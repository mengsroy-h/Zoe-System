import { SCAN_OPERATIONS_ROOT, SCAN_PENDING_ROOT, scanOperationSame, scanOperationValid, scanRegistryOwner, type ScanOperation } from './scan-protocol';

type ScanTransportIntent = { operation: ScanOperation; kind: 'admit' | 'cancel' | 'finalize' };

function same(value, expected) {
    if (value === expected) return true;
    if (!value || !expected || typeof value !== 'object' || typeof expected !== 'object' || Array.isArray(value) !== Array.isArray(expected)) return false;
    const keys = Object.keys(value);
    return keys.length === Object.keys(expected).length && keys.every(key => Object.prototype.hasOwnProperty.call(expected, key) && same(value[key], expected[key]));
}

export function scanTransportIntent(ops): ScanTransportIntent | null {
    if (!Array.isArray(ops) || ![2, 3, 10].includes(ops.length)) return null;
    const entries = new Map<string, any>();
    for (const op of ops) {
        if (!op || !Array.isArray(op.p) || !op.p.length || op.p.some(part => typeof part !== 'string' || !part || /[.#$\[\]\/]/.test(part))) return null;
        const keys = Object.keys(op).sort().join(',');
        if (op.k === 'set' ? keys !== 'k,p,v' : op.k === 'inc' ? keys !== 'd,k,p' : true) return null;
        const path = op.p.join('/');
        if (entries.has(path)) return null;
        entries.set(path, op);
    }
    const candidates = [...entries].filter(([path]) => path.startsWith(SCAN_OPERATIONS_ROOT + '/'));
    if (candidates.length !== 1) return null;
    const [operationPath, op] = candidates[0];
    const operation = op.v;
    if (op.k !== 'set' || !scanOperationValid(operation) || operationPath !== SCAN_OPERATIONS_ROOT + '/' + operation.id) return null;
    const expected = new Map<string, any>([[operationPath, operation]]);
    const pendingPath = SCAN_PENDING_ROOT + '/' + operation.id;
    const registryPath = 'zoew_barcode_registry/' + operation.registryKey;
    let kind: ScanTransportIntent['kind'];
    if (operation.phase === 'admitted') {
        kind = 'admit'; expected.set(pendingPath, operation.actorUid);
    } else if (operation.phase === 'cancelled') {
        kind = 'cancel'; expected.set(pendingPath, null);
        if (entries.has(registryPath)) expected.set(registryPath, null);
    } else if (operation.phase === 'committed') {
        kind = 'finalize'; expected.set(pendingPath, null);
        expected.set('zoew_scan_history_cod_dod/' + operation.targetId + '/scanPending', null);
        expected.set(registryPath, scanRegistryOwner(operation));
        for (const root of ['zoew_daily_revenue_cod_dod/' + operation.scanDate, 'zoew_monthly_revenue_cod_dod/' + operation.month]) {
            for (const [field, delta] of [['codDollar', operation.cod], ['dodDollar', operation.dod], ['totalCount', 1]] as const) {
                const path = root + '/' + field;
                const entry = entries.get(path);
                if (!entry || !(entry.k === 'inc' && entry.d === delta || entry.k === 'set' && same(entry.v, { '.sv': { increment: delta } }))) return null;
                expected.set(path, entry);
            }
        }
    } else return null;
    if (entries.size !== expected.size) return null;
    for (const [path, value] of expected) {
        const actual = entries.get(path);
        if (!actual || (value === actual ? false : actual.k !== 'set' || !same(actual.v, value))) return null;
    }
    return { operation, kind };
}

export function scanTransportReceipt(intent: ScanTransportIntent | null, receipt, actorUid: string) {
    if (!intent || !scanOperationValid(receipt) || receipt.actorUid !== actorUid
        || !scanOperationSame(receipt, intent.operation, intent.kind === 'finalize' || intent.kind === 'cancel' && !!intent.operation.targetId)) return null;
    if (intent.kind === 'finalize') return receipt.phase === 'committed' ? 'applied' : null;
    if (intent.kind === 'admit') return 'applied';
    if (receipt.phase === 'cancelled') return 'applied';
    return receipt.phase === 'committed' ? 'superseded' : null;
}
