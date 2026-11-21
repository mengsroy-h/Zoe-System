'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { parseExpression } = require('../../supabase/scripts/rtdb-expression.cjs');
const clone = value => JSON.parse(JSON.stringify(value));

function normalized(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(normalized);
    if (value.t === 'm' && value.n === 'hasChild') return normalized({ t: 'm', n: 'exists', o: { t: 'm', n: 'child', o: value.o, a: value.a }, a: [] });
    if (value.t === 'm' && value.n === 'child') {
        const parts = node => node.t === 'l' && typeof node.v === 'string' ? [node.v] : node.t === 'v' ? [{ variable: node.n }]
            : node.t === 'b' && node.o === '+' && parts(node.l) && parts(node.r) ? [...parts(node.l), ...parts(node.r)] : null;
        const list = parts(value.a[0]);
        if (list && (value.a[0].t === 'b' || value.a[0].t === 'l' && value.a[0].v.includes('/'))) {
            const segments = list.map(part => typeof part === 'string' ? part : '\u0001' + part.variable + '\u0001').join('').split('/').filter(Boolean);
            if (segments.every(segment => !segment.includes('\u0001') || /^\u0001\$[A-Za-z0-9_]+\u0001$/.test(segment))) {
                let node = value.o;
                for (const segment of segments) node = { t: 'm', n: 'child', o: node,
                    a: [segment.startsWith('\u0001') ? { t: 'v', n: segment.slice(1, -1) } : { t: 'l', v: segment }] };
                return normalized(node);
            }
        }
    }
    if (value.t === '&&' || value.t === '||') {
        const items = node => node.t === value.t ? [...items(node.l), ...items(node.r)] : [normalized(node)];
        return { t: value.t, ordered: items(value) };
    }
    return Object.fromEntries(Object.keys(value).filter(key => key !== 'f').sort().map(key => [key, normalized(value[key])]));
}
const digest = value => createHash('sha256').update(JSON.stringify(normalized(value ?? null))).digest('hex');
const REVIEWED = {
    "c/zoew_scan_history_cod_dod/x/r/w": [
        "f925d978faf62d25e27183f0051c0655a289b94153d2adcf71b79f173645cbe3",
        "4cef9643229987179b627ba801e53fdfa125fb4d62c53fafdcf1a75fda9f6480"
    ],
    "c/zoew_scan_history_cod_dod/x/r/v": [
        "ff760e2156aa6b7b49a253a4e92470e801ea4415fd6fe4109d3bf3c45549325d",
        "953ddd10e8d921c865a5ab74d5cf54aabacf01f106d662c16bc1d467c1715c44"
    ],
    "c/zoew_scan_history_cod_dod/x/r/c/barcodes/x/r/c/code/v": [
        "ae7997a2ef62b08d8dcebccd5e8cedf12ac84206cdb92e901fa7edc834f0c900",
        "2612bf1d1757cde6e5ecb18ec06d5c727ea173e545dbda000a22c33eca3870d5"
    ],
    "c/zoew_recently_deleted_cod_dod/x/r/w": [
        "7e5e38fdb7aa85174d9b745b1808fcf22de475d0c1dfc2559267c38c9a0818ef",
        "2de72b5479c0e0743c7940c25a5015ccf85c1bc1ebe3348761613cb4c0d3a866"
    ],
    "c/zoew_recently_deleted_cod_dod/x/r/v": [
        "62dc3090c8f5f0d8eb0c2b953942e46e0cb0e4fb827f01fd600de8eb06b35c05",
        "fe212972f5f138adc22d272961e54fae3ddbe6d14ad5b6c7d705c15f2c1a6e37"
    ],
    "c/zoew_recently_deleted_cod_dod/x/r/c/restoreClaim/v": [
        "51f401f6a3dae16d879959885a7ed9008ceaa2085e0397b0f8182e0bfc7a9121",
        "ef54b290e2bb879b398b65c2a7f89cbc80c1986a0515525ac8367ecd4af76441"
    ],
    "c/zoew_recently_deleted_cod_dod/x/r/c/restoreAttestationId": [
        "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
        "80c31af87dd3b805eeb7cb96daa9b81169b79b65879a8772aa2112d56e38153d"
    ],
    "c/zoew_trash_consumptions/x/r/w": [
        "8d6253597b64926db9559678473ced8a922c267e342b1acc3ffde91c5932fbdd",
        "bcf3b07d4c2290efd7fab362a66e12bf78af50e39cbd2ac4dd90a1f6e347d38c"
    ],
    "c/zoew_restore_policy": [
        "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
        "f61d80dd9669039a19e22e75244981eb332a03f27676fffc42b8c6b4181d143f"
    ],
    "c/zoew_restore_attestations": [
        "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
        "cfbc656fdad7d2d8528b7da927285209b242992ed1f25d2b51446a135bdcc511"
    ]
};

function rawCanonical(value) {
    if (Array.isArray(value)) return value.map(rawCanonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, rawCanonical(value[key])]));
}
const rawDigest = value => createHash('sha256').update(JSON.stringify(rawCanonical(value))).digest('hex');
function restoreTerminalDecisionRulesProjection(current) {
    assert.equal(rawDigest(current), 'cc8e93bad4ba527e7ae740cdc4f1cdfeba7ae2f2dd4d73216d29dec30435f994', 'reviewed terminal decision Rules AST or optimization hint changed');
    const projected = clone(current), row = projected.c.zoew_recently_deleted_cod_dod.x.r;
    const equality = parseExpression("newData.child('ztoTerminalDecision').val()===data.child('ztoTerminalDecision').val()", []);
    const field = { w: { t: 'l', v: false }, v: parseExpression("newData.val()==='signed'||newData.val()==='returned'", []) };
    const finalDelete = parseExpression("!data.hasChild('ztoTerminalDecision')||newData.exists()||!data.hasChild('restoreClaim')", []);
    assert.equal(row.v.t, '&&'); assert.equal(digest(row.v.r), digest(equality));
    assert.equal(digest(row.c.ztoTerminalDecision), digest(field));
    assert.equal(row.w.t, '&&'); assert.equal(digest(row.w.r), digest(finalDelete));
    row.v = row.v.l; row.w = row.w.l; delete row.c.ztoTerminalDecision;
    const localVetoes = [
        [projected.c.zoew_scan_history_cod_dod.x.r, 'v', "root.child('zoew_recently_deleted_cod_dod').child(newData.child('restoreClaimId').val())"],
        [projected.c.zoew_scan_history_cod_dod.x.r.c.barcodes.x.r.c.code, 'v', "root.child('zoew_recently_deleted_cod_dod').child(newData.parent().parent().parent().child('restoreClaimId').val())"],
        [row.c.restoreClaim, 'v', 'newData.parent()'],
        [projected.c.zoew_trash_consumptions.x.r, 'w', "root.child('zoew_recently_deleted_cod_dod').child($sourceId)"]
    ];
    for (const [node, key, reference] of localVetoes) {
        const veto = digest(parseExpression('!' + reference + ".hasChild('ztoTerminalDecision')", ['$sourceId']));
        let removed = 0;
        const strip = value => {
            if (!value || typeof value !== 'object') return value;
            if (Array.isArray(value)) return value.map(strip);
            if (value.t === '&&' && digest(value.r) === veto) { removed++; return strip(value.l); }
            return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, strip(child)]));
        };
        node[key] = strip(node[key]);
        assert.equal(removed, 1, 'exact local terminal decision veto must occur once');
    }
    assert.equal(rawDigest(projected), 'def6cbc9bfb965bfe0d1f13e16fb5adf2cee12d1eff673f9f0dbc04af2e1c076', 'terminal decision projection changed an existing rule or optimization hint');
    return projected;
}
function restorePublicationRulesProjection(current) {
    assert.equal(rawDigest(current), 'def6cbc9bfb965bfe0d1f13e16fb5adf2cee12d1eff673f9f0dbc04af2e1c076', 'reviewed publication Rules AST or optimization hint changed');
    const projected = clone(current), row = projected.c.zoew_recently_deleted_cod_dod.x.r;
    const equality = parseExpression("newData.child('restorePublication').val()===data.child('restorePublication').val()", []);
    const field = { w: { t: 'l', v: false }, v: parseExpression('newData.isNumber()&&newData.val()>=1&&newData.val()<=9007199254740990&&newData.val()%1===0', []) };
    assert.equal(row.v.t, '&&', 'publication preservation must extend the original row validator');
    assert.equal(digest(row.v.r), digest(equality), 'reviewed publication preservation predicate changed');
    assert.equal(digest(row.c.restorePublication), digest(field), 'reviewed publication field guard changed');
    row.v = row.v.l; delete row.c.restorePublication;
    assert.equal(rawDigest(projected), '036e82896add6cecf82436d716071bbf169a73a7a22a65850cc2d8b803d1a84d', 'publication projection changed an existing rule or optimization hint');
    return projected;
}
function restorePurgeAllowRulesProjection(current) {
    assert.equal(rawDigest(current), 'f5ddf02b8a6d54a94869ec8dcee0439d7c3d65ebf868aa45263135f1299ec4a3', 'reviewed trash purge-allow Rules AST or optimization hint changed');
    const projected = clone(current), row = projected.c.zoew_recently_deleted_cod_dod.x.r;
    const purgeWrite = parseExpression("auth!=null&&!newData.parent().exists()&&data.parent().hasChild('barcodes')", []);
    assert.equal(digest(row.c.restorePublication.w), digest(purgeWrite), 'reviewed restorePublication purge write rule changed');
    assert.equal(digest(row.c.ztoTerminalDecision.w), digest(purgeWrite), 'reviewed ztoTerminalDecision purge write rule changed');
    row.c.restorePublication.w = { t: 'l', v: false };
    row.c.ztoTerminalDecision.w = { t: 'l', v: false };
    assert.equal(rawDigest(projected), 'cc8e93bad4ba527e7ae740cdc4f1cdfeba7ae2f2dd4d73216d29dec30435f994', 'trash purge-allow projection changed an existing rule or optimization hint');
    return projected;
}
function restoreAttestationRulesProjection(current, legacy) {
    if (rawDigest(current) === 'f5ddf02b8a6d54a94869ec8dcee0439d7c3d65ebf868aa45263135f1299ec4a3') current = restorePurgeAllowRulesProjection(current);
    if (rawDigest(current) === 'cc8e93bad4ba527e7ae740cdc4f1cdfeba7ae2f2dd4d73216d29dec30435f994') current = restoreTerminalDecisionRulesProjection(current);
    if (rawDigest(current) === 'def6cbc9bfb965bfe0d1f13e16fb5adf2cee12d1eff673f9f0dbc04af2e1c076') current = restorePublicationRulesProjection(current);
    assert.deepEqual([rawDigest(legacy), rawDigest(current)], ["043609a50954502fd3f83446738653ba72663b41c2446f748b194149e2a16af6","036e82896add6cecf82436d716071bbf169a73a7a22a65850cc2d8b803d1a84d"], 'reviewed full Rules AST or optimization hint changed');
    const seen = new Set();
    function walk(before, after, location) {
        if (digest(before) === digest(after)) return;
        if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || ['w', 'v'].includes(location.split('/').at(-1))) {
            const expected = REVIEWED[location];
            assert(expected, 'unreviewed restore attestation rule delta: ' + location);
            assert.deepEqual([digest(before), digest(after)], expected, 'reviewed restore attestation predicate changed: ' + location);
            seen.add(location); return;
        }
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) walk(before[key], after[key], location ? location + '/' + key : key);
    }
    walk(legacy, current, '');
    assert.equal(seen.size, Object.keys(REVIEWED).length, 'reviewed restore attestation delta missing');
    return clone(legacy);
}
module.exports = { restoreAttestationRulesProjection, restorePublicationRulesProjection, restoreTerminalDecisionRulesProjection, restorePurgeAllowRulesProjection };
