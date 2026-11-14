'use strict';

function terminalEnrichmentCases() {
    const base = () => ({ id: 'source', createdAt: 100, deletedAt: 200, trashGeneration: 1,
        restorePublication: 2, trashMode: 'cookie', trashReason: 'remove', phone: 'synthetic',
        cod: 7, dod: 2, price: 9, count: 1, restoreAttestationId: 'proof',
        restoreClaim: { token: 'operation', targetId: 'target', claimedAt: 300 },
        barcodes: { 3: { code: 'SYNTH0001', cod: 7, dod: 2, isDeducted: true, createdAt: 101,
            restoredAt: 150, locker: 'A1', isClosed: false } } });
    const vectors = [];
    const add = (name, expected, change = () => {}, prepare = () => {}) => {
        const before = base(); prepare(before);
        const after = structuredClone(before); change(after);
        vectors.push({ name, expected, sourceId: 'source', before, after });
    };
    const row = source => source.barcodes[3];
    add('unchanged business snapshot', true);
    for (const legacy of [null, 0, 'legacy', [], {}]) add('unchanged legacy barcodes ' + JSON.stringify(legacy), true,
        () => {}, value => { value.barcodes = legacy; });
    add('unchanged missing legacy barcodes', true, () => {}, value => { delete value.barcodes; });
    add('missing and null barcodes are distinct', false, value => { value.barcodes = null; }, value => { delete value.barcodes; });
    add('null and missing barcodes are distinct', false, value => { delete value.barcodes; }, value => { value.barcodes = null; });
    add('legacy primitive barcodes cannot change', false, value => { value.barcodes = 'changed'; }, value => { value.barcodes = 'legacy'; });
    add('array and object barcode containers are distinct', false, value => { value.barcodes = {}; }, value => { value.barcodes = []; });
    add('server publication and claim metadata', true, value => {
        value.restorePublication++; value.restoreClaim.token = 'new-operation'; value.restoreAttestationId = 'new-proof';
    });
    add('permanent block may only increase', true, value => { value.restoreBlocked = true; });
    add('legacy nested id canonicalization', true, value => { value.id = 'source'; }, value => { delete value.id; });
    add('missing decision becomes returned', true, value => { value.ztoTerminalDecision = 'returned'; });
    add('returned decision becomes signed', true, value => { value.ztoTerminalDecision = 'signed'; }, value => { value.ztoTerminalDecision = 'returned'; });
    add('signed decision remains signed', true, () => {}, value => { value.ztoTerminalDecision = 'signed'; });
    for (const field of ['ztoSignedAt', 'ztoReturnedAt', 'ztoMisplacedAt', 'ztoSentOutAt']) {
        add('new positive ' + field, true, value => { row(value)[field] = 1000; });
        for (const empty of [null, 0]) add('unmeasured ' + field + ':' + empty, true,
            value => { row(value)[field] = 1000; }, value => { row(value)[field] = empty; });
        for (const invalid of [0, -1, 1.5, '1000', false, null, 9007199254740991]) add('invalid new ' + field + ':' + invalid, false,
            value => { row(value)[field] = invalid; });
        add('cannot delete positive ' + field, false, value => { delete row(value)[field]; }, value => { row(value)[field] = 1000; });
        add('cannot replace positive ' + field, false, value => { row(value)[field] = 2000; }, value => { row(value)[field] = 1000; });
        add('unchanged positive ' + field, true, () => {}, value => { row(value)[field] = 1000; });
    }
    for (const flag of [undefined, null, false]) add('first exact correction from ' + String(flag), true,
        value => { row(value).ztoSignedAt = 1500; row(value).ztoSignedExact = true; },
        value => { row(value).ztoSignedAt = 2000; if (flag !== undefined) row(value).ztoSignedExact = flag; });
    add('cannot correct an already exact Sign', false, value => { row(value).ztoSignedAt = 1500; },
        value => { row(value).ztoSignedAt = 2000; row(value).ztoSignedExact = true; });
    add('cannot downgrade exact Sign', false, value => { row(value).ztoSignedExact = false; },
        value => { row(value).ztoSignedAt = 2000; row(value).ztoSignedExact = true; });
    add('cannot delete exact flag', false, value => { delete row(value).ztoSignedExact; },
        value => { row(value).ztoSignedAt = 2000; row(value).ztoSignedExact = false; });
    add('new false exact flag is not enrichment', false, value => { row(value).ztoSignedExact = false; });
    add('new exact flag needs a real Sign', false, value => { row(value).ztoSignedExact = true; });
    add('malformed old exact flag is not silently corrected', false,
        value => { row(value).ztoSignedAt = 1500; row(value).ztoSignedExact = true; },
        value => { row(value).ztoSignedAt = 2000; row(value).ztoSignedExact = 'false'; });
    add('unchanged legacy fraction with exact Sign permits other enrichment', true,
        value => { row(value).ztoReturnedAt = 3000; },
        value => { row(value).ztoSignedAt = 1000.5; row(value).ztoSignedExact = true; });
    add('unchanged exact legacy fraction remains valid', true, () => {},
        value => { row(value).ztoSignedAt = 1000.5; row(value).ztoSignedExact = true; });
    add('unchanged exact flag needs an existing Sign', false, () => {}, value => { row(value).ztoSignedExact = true; });
    for (const invalid of [0, -1, null, '1000']) add('unchanged exact flag with invalid Sign ' + String(invalid), false,
        () => {}, value => { row(value).ztoSignedExact = true; row(value).ztoSignedAt = invalid; });
    add('first exact correction may replace a legacy fraction', true,
        value => { row(value).ztoSignedAt = 1000; row(value).ztoSignedExact = true; },
        value => { row(value).ztoSignedAt = 1000.5; row(value).ztoSignedExact = false; });
    for (const field of ['cod', 'dod', 'price', 'count', 'createdAt', 'deletedAt', 'trashGeneration']) add('cannot change source ' + field, false, value => { value[field]++; });
    for (const field of ['cod', 'dod', 'createdAt', 'restoredAt']) add('cannot change barcode ' + field, false, value => { row(value)[field]++; });
    add('cannot change barcode value', false, value => { row(value).code = 'OTHER0001'; });
    add('cannot change deduction', false, value => { row(value).isDeducted = false; });
    add('cannot change barcode closure', false, value => { row(value).isClosed = true; });
    add('cannot add an arbitrary barcode field', false, value => { row(value).unreviewed = true; });
    add('cannot add a barcode slot', false, value => { value.barcodes[4] = { ...row(value) }; });
    add('cannot delete a barcode slot', false, value => { delete value.barcodes[3]; });
    add('cannot reindex a barcode slot', false, value => { value.barcodes[0] = row(value); delete value.barcodes[3]; });
    add('cannot lower source publication', false, value => { value.restorePublication = 1; });
    add('cannot clear permanent block', false, value => { delete value.restoreBlocked; }, value => { value.restoreBlocked = true; });
    add('cannot downgrade signed decision', false, value => { value.ztoTerminalDecision = 'returned'; }, value => { value.ztoTerminalDecision = 'signed'; });
    add('cannot delete returned decision', false, value => { delete value.ztoTerminalDecision; }, value => { value.ztoTerminalDecision = 'returned'; });
    for (const invalid of [null, false, 0, 'unknown', 'Signed']) add('malformed decision ' + String(invalid), false, value => { value.ztoTerminalDecision = invalid; });
    return vectors;
}

module.exports = { terminalEnrichmentCases };
