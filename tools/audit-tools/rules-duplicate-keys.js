const fs = require('fs');
const path = require('path');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.RULESDUP_APP_DIR ? path.resolve(process.env.RULESDUP_APP_DIR) : path.resolve(__dirname, '../..');
const files = ['firebase-database.rules.json', 'ZoeKeyGen/firebase-database.rules.json'];
const { objectShapeNodes, requiresObject } = require('./rules-shape.js');

function assertNoDuplicateKeys(source, file) {
    let index = 0;
    const error = (message) => { throw new Error(file + ':' + (index + 1) + ' ' + message); };
    const whitespace = () => {
        while (/\s/.test(source[index] || '')) index++;
    };
    const string = () => {
        const start = index;
        if (source[index] !== '"') error('រំពឹង string');
        index++;
        while (index < source.length) {
            if (source[index] === '\\') {
                index += 2;
                continue;
            }
            if (source[index] === '"') {
                index++;
                try {
                    return JSON.parse(source.slice(start, index));
                } catch (err) {
                    error('string JSON មិនត្រឹមត្រូវ');
                }
            }
            index++;
        }
        error('string មិនបិទ');
    };
    const primitive = () => {
        const start = index;
        while (index < source.length && !/[\s,}\]]/.test(source[index])) index++;
        try {
            JSON.parse(source.slice(start, index));
        } catch (err) {
            error('តម្លៃ JSON មិនត្រឹមត្រូវ');
        }
    };
    const value = (location) => {
        whitespace();
        if (source[index] === '{') return object(location);
        if (source[index] === '[') return array(location);
        if (source[index] === '"') {
            string();
            return;
        }
        primitive();
    };
    const object = (location) => {
        index++;
        whitespace();
        const seen = new Set();
        if (source[index] === '}') {
            index++;
            return;
        }
        while (index < source.length) {
            whitespace();
            const key = string();
            if (seen.has(key)) error('មាន key ស្ទួន "' + key + '" នៅ ' + location);
            seen.add(key);
            whitespace();
            if (source[index] !== ':') error('រំពឹង :');
            index++;
            value(location + '/' + key);
            whitespace();
            if (source[index] === '}') {
                index++;
                return;
            }
            if (source[index] !== ',') error('រំពឹង , ឬ }');
            index++;
        }
        error('object មិនបិទ');
    };
    const array = (location) => {
        index++;
        whitespace();
        let position = 0;
        if (source[index] === ']') {
            index++;
            return;
        }
        while (index < source.length) {
            value(location + '/' + position++);
            whitespace();
            if (source[index] === ']') {
                index++;
                return;
            }
            if (source[index] !== ',') error('រំពឹង , ឬ ]');
            index++;
        }
        error('array មិនបិទ');
    };

    value('');
    whitespace();
    if (index !== source.length) error('មានអក្សរបន្ថែមក្រោយ JSON');
}

function assertBalancedRuleExpressions(value, location) {
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach((key) => {
        const child = value[key];
        const childLocation = location + '/' + key;
        if ((key === '.read' || key === '.write' || key === '.validate') && typeof child === 'string') {
            let depth = 0;
            for (const character of child) {
                if (character === '(') depth++;
                else if (character === ')') depth--;
                if (depth < 0) throw new Error(childLocation + ' មាន ) លើស');
            }
            if (depth !== 0) throw new Error(childLocation + ' មាន ( និង ) មិនស្មើគ្នា');
        } else {
            assertBalancedRuleExpressions(child, childLocation);
        }
    });
}

let failed = false;
files.forEach((file) => {
    try {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const parsed = JSON.parse(source);
        assertNoDuplicateKeys(source, file);
        assertBalancedRuleExpressions(parsed, '');
        console.log('   ok    ' + file + ' គ្មាន key ស្ទួន និង expression balanced');
    } catch (error) {
        failed = true;
        console.log('  FAIL   ' + (error && error.message ? error.message : error));
    }
});

// ⛔ node ដែលរំពឹង object (មាន schema កូន · អាចសរសេរបាន) ត្រូវមាន `.validate` ដែលទាមទារ object ៖ primitive គ្មានកូន ➜
//    ការពិនិត្យកូនមិនរត់ ➜ server ទទួល ➜ listener របស់គ្រប់ឧបករណ៍ធ្លាក់ (2.45.4 · បញ្ជីដេរីវេពី rules ពិតក្នុង `rules-shape.js`)។
//    ពិនិត្យដាច់ពី try ខាងលើ ➜ កូនសោស្ទួនមិនបិទបាំងការធ្លាក់នេះ។ ការវាស់លើ engine ពិត ៖ `emu/crud-rules-flow` · `emu/license-seat-rules-test`។
files.forEach((file) => {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
        const shapes = objectShapeNodes(parsed.rules || {});
        const loose = shapes.filter((n) => !requiresObject(n.validate));
        if (!shapes.length) throw new Error(file + ' ៖ រក node ដែលរំពឹង object មិនឃើញ (ជាន់អប្បបរមា ➜ ការវាស់ខូច)');
        if (loose.length) throw new Error(file + ' ៖ node ដែលរំពឹង object តែគ្មាន `newData.hasChildren(…)` ក្នុង .validate (' + loose.length + '/' + shapes.length + ') ៖ ' + loose.map((n) => n.rulePath).join(' · '));
        console.log('   ok    ' + file + ' ៖ node ដែលរំពឹង object ទាំង ' + shapes.length + ' ទាមទារ object (primitive ត្រូវបដិសេធ)');
    } catch (error) {
        failed = true;
        console.log('  FAIL   ' + (error && error.message ? error.message : error));
    }
});

// ⛔ ឯកសារ Publish (`firebase-database.rules.min.json`) ៖ ប្រភពអានបាន (`firebase-database.rules.json`) ធំលើសដែន Firebase Console
//    ➜ Publish តែ artifact ដែល token ដូចប្រភពគ្រប់ rule · guard canonical ដដែល · compile ទៅ SQL ដូចគ្នា · ក្រោម RULES_PUBLISH_MAX_BYTES (F03)។
async function artifactCheck() {
    try {
        const artifactModule = path.join(root, 'supabase/scripts/rtdb-rules-artifact.cjs');
        const { RULES_PUBLISH_MAX_BYTES, minifyRulesText, rulesArtifactProblems } = require(artifactModule);
        const sourceText = fs.readFileSync(path.join(root, 'firebase-database.rules.json'), 'utf8');
        const artifact = fs.readFileSync(path.join(root, 'firebase-database.rules.min.json'), 'utf8');
        const problems = rulesArtifactProblems(sourceText, artifact), bytes = Buffer.byteLength(artifact, 'utf8');
        if (problems.length) throw new Error('firebase-database.rules.min.json ៖ ' + problems.slice(0, 3).join(' · ') + ' (node supabase/scripts/generate-rules-sql.mjs)');
        if (RULES_PUBLISH_MAX_BYTES !== 251904 || bytes > RULES_PUBLISH_MAX_BYTES || Buffer.byteLength(sourceText, 'utf8') <= bytes) {
            throw new Error('artifact ' + bytes + ' bytes · ដែន ' + RULES_PUBLISH_MAX_BYTES + ' (ត្រូវ ≤ 251904 និងតូចជាងប្រភព)');
        }
        const { NATIVE_F03_CANONICAL_GUARD: guard } = require(path.join(root, 'supabase/scripts/rtdb-canonical-key.cjs'));
        const firstRule = artifact.indexOf('newData.');
        const probes = [
            ['artifact ចាស់ (ប្រភពប្តូរ token មួយ)', rulesArtifactProblems(sourceText.replace("auth != null", "auth !== null"), artifact)],
            ['artifact ប្តូរ token មួយ', rulesArtifactProblems(sourceText, artifact.slice(0, firstRule) + 'data.' + artifact.slice(firstRule + 'newData.'.length))],
            ['artifact ប្តូរ guard canonical', rulesArtifactProblems(sourceText, JSON.stringify(JSON.parse(artifact), (key, value) =>
                typeof value === 'string' && value.includes(guard) ? value.replace(guard, guard.replace('length > 0', 'length > 1')) : value))],
            ['artifact ធំលើសដែន', rulesArtifactProblems(sourceText, artifact.replace(/}$/, ',"x":"' + 'a'.repeat(RULES_PUBLISH_MAX_BYTES) + '"}'))],
            ['artifact ដកដកឃ្លាការពារ ++/--', rulesArtifactProblems('{"rules":{".write":"1 - -1 === 2"}}', '{"rules":{".write":"1--1===2"}}')]
        ];
        const blind = probes.filter(([, found]) => !found.length).map(([label]) => label);
        if (blind.length) throw new Error('ទិសផ្ទុយ ៖ ការពិនិត្យ artifact មិនរកឃើញ ៖ ' + blind.join(' · '));
        if (minifyRulesText(sourceText) !== artifact) throw new Error('minifyRulesText(source) ≠ artifact');
        const { compileRules, rulesSql } = await import(require('url').pathToFileURL(path.join(root, 'supabase/scripts/rtdb-rules.mjs')).href);
        if (rulesSql(compileRules(JSON.parse(artifact))) !== rulesSql(compileRules(JSON.parse(sourceText)))) throw new Error('artifact compile ទៅ SQL ខុសពីប្រភព');
        console.log('   ok    firebase-database.rules.min.json ៖ token ដូចប្រភព · SQL ដូចគ្នា · ' + bytes + ' bytes ≤ ' + RULES_PUBLISH_MAX_BYTES
            + ' (ប្រភព ' + Buffer.byteLength(sourceText, 'utf8') + ') · ទិសផ្ទុយ ' + probes.length + ' ចាប់បាន');
    } catch (error) {
        failed = true;
        console.log('  FAIL   ' + (error && error.message ? error.message : error));
    }
}

artifactCheck().then(() => {
    if (failed) process.exit(1);
    console.log('✅ rules JSON ទាំងអស់គ្មាន key ស្ទួន · node ដែលរំពឹង object ទាមទារ object · artifact Publish ត្រឹមត្រូវ');
    process.exitCode = 0;
});
