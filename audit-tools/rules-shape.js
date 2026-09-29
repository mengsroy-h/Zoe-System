// helper ៖ node ក្នុង Firebase rules ដែល **រំពឹង object** ➜ ត្រូវមាន `.validate` ដែលទាមទារ object (`newData.hasChildren(…)`)។
//
// ⛔ ហេតុអ្វី (2.45.4) ៖ node ដែលកំណត់ schema កូន (វាល ឬ wildcard) ពិនិត្យតែ **កូន** ➜ តម្លៃ primitive (ខ្សែអក្សរ · លេខ · bool)
//    **គ្មានកូន** ➜ ការពិនិត្យកូនមិនរត់ទាល់តែសោះ ➜ server ទទួល ➜ callback `onValue` របស់គ្រប់ឧបករណ៍ធ្លាក់ (ប្រវត្តិ/ធុងសំរាម
//    ជាប់ «វាស់មិនបាន»)។ វាស់បាន ៖ rules មុនកែមានចន្លោះ ១៩ (Business ១៥ · License ៤)។
//
// បញ្ជី node **ដេរីវេពី rules ពិត** (មិនមែនបញ្ជីរឹង) ៖ node ណាដែល (១) មានកូនក្រៅពី `.*` និង `$other` (២) អាចសរសេរបាន
// (`.write` លើខ្លួន ឬលើឪពុក) ➜ node ថ្មីនៅថ្ងៃក្រោយត្រូវគ្របដោយស្វ័យប្រវត្តិ។
// អ្នកប្រើ ៖ `rules-duplicate-keys.js` (ស្តាទិច) · `emu/crud-rules-flow.js` (Business) · `emu/license-seat-rules-test.js` (License)។
'use strict';

const PRIMITIVES = ['junk', 5, true];

function objectShapeNodes(rules) {
    const out = [];
    (function walk(node, segs, writable) {
        if (!node || typeof node !== 'object') return;
        const canWrite = writable || (Object.prototype.hasOwnProperty.call(node, '.write') && node['.write'] !== false && node['.write'] !== 'false');
        const kids = Object.keys(node).filter((k) => !k.startsWith('.') && k !== '$other');
        if (segs.length && kids.length && canWrite) {
            out.push({ segs: segs.slice(), rulePath: '/' + segs.join('/'), validate: typeof node['.validate'] === 'string' ? node['.validate'] : '' });
        }
        kids.forEach((k) => walk(node[k], segs.concat(k), canWrite));
    })(rules, [], false);
    return out;
}

function requiresObject(validate) {
    return /(^|[^!\w.])newData\.hasChildren\(/.test(String(validate || ''));
}

function concretePath(segs, samples) {
    return '/' + segs.map((s) => (s.startsWith('$') ? (samples[s] !== undefined ? samples[s] : 'probe') : s)).join('/');
}

// rules សម្រាប់ control ៖ node ដែលវាស់ ➜ គ្មាន `.validate` ហើយ `.write` **ផ្ទាល់ខ្លួន** (បើមាន) ក្លាយជា `auth != null` (ឪពុកនៅដដែល)
function looseControlRules(rules, nodes) {
    const copy = JSON.parse(JSON.stringify(rules));
    nodes.forEach((n) => {
        let cur = copy;
        n.segs.forEach((s) => { cur = cur && cur[s]; });
        if (!cur || typeof cur !== 'object') return;
        delete cur['.validate'];
        if (typeof cur['.write'] === 'string') cur['.write'] = 'auth != null';
    });
    return copy;
}

// ⛔ ការវាស់ពីរជំហាន (differential) ៖ (១) control (`looseControlRules`) ➜ primitive ត្រូវ **ទទួល** ➜ បញ្ជាក់ថាផ្លូវ probe និងតម្លៃ
//    wildcard ពិតជាទៅដល់ node (មិនមែនធ្លាក់ត្រង់ឪពុក ឬ key ខុសទម្រង់) · (២) rules ពិត ➜ primitive ត្រូវ **បដិសេធ** ដោយការការពារ
//    របស់ node ខ្លួនឯង (`.validate` · ឬ `.write` ដែលទាមទារវាលកូន)។ `.validate` ជាកាតព្វកិច្ចត្រូវវាស់ស្តាទិចដោយ `rules-duplicate-keys`។
//    rules ពិតត្រូវ load វិញជានិច្ចនៅចុងក្រោយ។
async function probeObjectShapes({ rules, file, samples, loadRules, reset, write, denied }) {
    const nodes = objectShapeNodes(rules.rules || rules);
    const full = rules.rules ? rules : { rules };
    const stripped = { rules: looseControlRules(full.rules, nodes) };
    const results = nodes.map((n) => ({ rulePath: n.rulePath, path: concretePath(n.segs, samples), reachable: true, rejected: true, detail: [] }));
    try {
        if (!(await loadRules(stripped))) throw new Error((file || 'rules') + ' ៖ load rules control មិនបាន');
        for (const r of results) {
            for (const value of PRIMITIVES) {
                await reset(r.path);
                const res = await write(r.path, value);
                if (denied(res)) { r.reachable = false; r.detail.push('control ' + JSON.stringify(value) + ' ➜ ' + res.status); }
            }
        }
    } finally {
        if (!(await loadRules(full))) throw new Error((file || 'rules') + ' ៖ load rules ពិតវិញមិនបាន');
    }
    for (const r of results) {
        for (const value of PRIMITIVES) {
            await reset(r.path);
            const res = await write(r.path, value);
            if (!denied(res)) { r.rejected = false; r.detail.push('rules ពិតទទួល ' + JSON.stringify(value)); }
        }
        await reset(r.path);
    }
    return results;
}

module.exports = { PRIMITIVES, objectShapeNodes, requiresObject, concretePath, looseControlRules, probeObjectShapes };
