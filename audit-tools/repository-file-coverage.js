// បញ្ជីអ្នកយាមតាមឯកសារ៖ ភស្តុតាង static/behavior/integrity/manual ដាច់ពីគ្នា។
// PASS បញ្ជាក់ការភ្ជាប់និងកិច្ចសន្យាដែលវាស់ មិនមែនគ្របលើរាល់បន្ទាត់ទេ។
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const ROOT = path.resolve(process.env.REPOCOVER_APP_DIR || path.join(__dirname, '..'));
const MANIFEST = 'audit-tools/repository-file-coverage.json';
let pass = 0, fail = 0;
function check(label, condition, detail) {
    if (condition) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
}
function safeRelative(value) {
    return typeof value === 'string' && value.length > 0 && !value.includes('\\')
        && !path.posix.isAbsolute(value) && !value.split('/').some((part) => part === '..' || part === '.' || part === '')
        && !/[:*?\0]/.test(value);
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function inventory() {
    const top = cp.spawnSync('git', ['-C', ROOT, 'rev-parse', '--show-toplevel'],
        { encoding: 'utf8', timeout: 10000 });
    if (top.status === 0 && path.resolve(top.stdout.trim()) === ROOT) {
        const result = cp.spawnSync('git', ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
            { encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
        if (result.status !== 0) throw new Error('git ls-files បរាជ័យ៖ ' + result.stderr);
        return { mode: 'git ls-files', files: [...new Set(result.stdout.split('\0').filter(Boolean))]
            .filter((rel) => fs.existsSync(path.join(ROOT, rel))).sort() };
    }
    // git archive គ្មាន index៖ ដើរថតពិត ដោយមិនយក manifest ជាប្រភព inventory។
    // node_modules និងស្រមោលរបស់ mutation ជា runtime artifacts តែប៉ុណ្ណោះ។
    const found = [];
    (function visit(rel) {
        for (const entry of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
            if (entry.name === '.git' || entry.name === 'node_modules'
                || (['audit-tools', 'audit-tools/emu', 'zto-import'].includes(rel) && entry.name.startsWith('.tmp-poison-'))) continue;
            const next = rel ? rel + '/' + entry.name : entry.name;
            if (entry.isDirectory()) visit(next);
            else found.push(next);
        }
    })('');
    return { mode: 'ដើរថត archive ពិត', files: found.sort() };
}
let manifest = null, files = [], mode = '';
try { ({ files, mode } = inventory()); }
catch (error) { check('អាន inventory ពិត', false, error.message); }
try { manifest = JSON.parse(read(MANIFEST)); }
catch (error) { check('អាន manifest អ្នកយាម', false, error.message); }
check('ជាន់អប្បបរមា៖ repo មានឯកសារយ៉ាងតិច ២០០ (' + mode + ')', files.length >= 200, String(files.length));
const categories = ['behavior', 'static', 'integrity', 'manual'];
const policies = manifest && manifest.policies || {};
const entries = manifest && manifest.files || {};
check('manifest ៖ schema និងបញ្ជីឯកសារមានពិត', manifest && manifest.schemaVersion === 1
    && !Array.isArray(entries) && Object.keys(entries).length >= 200 && Object.keys(policies).length > 0);
const actual = new Set(files);
const unknown = files.filter((rel) => !Object.prototype.hasOwnProperty.call(entries, rel));
const stale = Object.keys(entries).filter((rel) => !actual.has(rel));
check('រាល់ឯកសារ tracked និងឯកសារថ្មីមានអ្នកយាមកំណត់ជាក់លាក់', !unknown.length, unknown.join(' · '));
check('គ្មាន mapping ចាស់ក្រោយលុបឬប្តូរឈ្មោះឯកសារ', !stale.length, stale.join(' · '));

const badEntries = [], badPolicies = [], badHashes = [], empty = [];
const totals = Object.fromEntries(categories.map((name) => [name, 0]));
const usedPolicies = new Set();
let runall = '';
try { runall = read('audit-tools/run-all.sh'); } catch (_) {}
const scheduled = new Set(['audit-tools/run-all.sh']);
const baselineAt = runall.search(/if\s+\[\s+-n\s+"\$BASE"\s*\]/);
const normal = baselineAt < 0 ? runall : runall.slice(0, baselineAt);
const shell = normal.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
// ការយោងឈ្មោះក្នុង comment/echo/baseline មិនមែនជាការរត់ធម្មតាទេ។
for (const match of shell.matchAll(/^\s*run\s+(?:"[^"]*"|'[^']*'|\S+)\s+node\s+["']?((?:audit-tools|zto-import)\/[A-Za-z0-9._/-]+\.js)["']?(?=\s|$)/gm)) scheduled.add(match[1]);
for (const match of shell.matchAll(/for\s+([A-Za-z_]\w*)\s+in\s+([^;]+);\s*do([\s\S]*?)\bdone\b/g)) {
    const variable = match[1];
    const runner = new RegExp('^\\s*run\\s+(?:"[^"]*"|\'[^\']*\'|\\S+)\\s+node\\s+["\']?audit-tools/(?:\\$'
        + variable + '|\\$\\{' + variable + '\\})\\.js["\']?(?=\\s|$)', 'm');
    if (!runner.test(match[3])) continue;
    for (const name of match[2].split(/\s+/)) if (/^[A-Za-z0-9_/-]+$/.test(name)) scheduled.add('audit-tools/' + name + '.js');
}
for (const [name, policy] of Object.entries(policies)) {
    if (!policy || !categories.includes(policy.category) || !Array.isArray(policy.guards)
        || !policy.guards.length || typeof policy.evidence !== 'string' || !policy.evidence.trim()
        || typeof policy.limitation !== 'string' || !policy.limitation.trim()) {
        badPolicies.push(name + '៖ metadata ខ្វះ');
        continue;
    }
    for (const guard of policy.guards) {
        if (!safeRelative(guard) || !actual.has(guard) || !scheduled.has(guard)) badPolicies.push(name + ' → ' + guard);
    }
}
for (const [rel, entry] of Object.entries(entries)) {
    const policy = entry && policies[entry.policy];
    if (!safeRelative(rel) || !policy || typeof entry !== 'object') { badEntries.push(rel); continue; }
    usedPolicies.add(entry.policy);
    if (categories.includes(policy.category)) totals[policy.category]++;
    if (policy.category === 'manual' && !(rel === 'LICENSE' || rel === 'NOTICE'
        || rel.startsWith('LICENSES/') || /^docs\/(?:HISTORY-ARCHIVE|ARCHIVE-[0-9-]+)\.md$/.test(rel))) {
        badEntries.push(rel + '៖ code/config មិនអាចចាត់ជា manual');
    }
    if (!actual.has(rel)) continue;
    try {
        const file = path.join(ROOT, rel), stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.size === 0) { empty.push(rel); continue; }
        if (entry.sha256 || policy.category === 'integrity' || policy.category === 'manual') {
            let bytes = fs.readFileSync(file);
            if (entry.encoding === 'lf-text') bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
            const digest = crypto.createHash('sha256').update(bytes).digest('hex');
            if (!/^[a-f0-9]{64}$/.test(entry.sha256 || '') || digest !== entry.sha256) badHashes.push(rel);
        }
    } catch (error) { badEntries.push(rel + '៖ ' + error.message); }
}
for (const name of Object.keys(policies)) if (!usedPolicies.has(name)) badPolicies.push(name + '៖ គ្មានឯកសារប្រើ');
check('mapping ៖ ប្រភេទនិងផ្លូវត្រឹមត្រូវ; manual មានតែអត្ថបទអាជ្ញាប័ណ្ណ/ប្រវត្តិបណ្ណសារ', !badEntries.length, badEntries.join(' · '));
check('ភស្តុតាងអ្នកយាមយោងឯកសារពិតដែល suite ហៅ', !badPolicies.length, badPolicies.join(' · '));
check('ឯកសារត្រូវមានទិន្នន័យ និងមិនមែន symlink', !empty.length, empty.join(' · '));
check('integrity/manual ៖ SHA-256 ត្រូវនឹង bytes ដែលបានកត់ត្រា; កែដោយចេតនាត្រូវ review hash', !badHashes.length, badHashes.join(' · '));

const brokenLinks = [];
let documents = 0, links = 0;
for (const [rel, entry] of Object.entries(entries)) {
    // ប្រវត្តិអាចយោងផ្លូវពីកំណែមុន; ឯកសារ .md ផ្សេងទៀតស្កេនស្វ័យប្រវត្តិ។
    // ការលុប metadata `links` មិនអាចធ្វើឲ្យឯកសារសកម្មគេចការពិនិត្យបានទេ។
    if (!rel.endsWith('.md') || rel === 'docs/HISTORY.md' || !actual.has(rel)
        || (policies[entry.policy] || {}).category === 'manual') continue;
    documents++;
    const source = read(rel).replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm, '');
    const targets = [];
    for (const match of source.matchAll(/!?\[[^\]\r\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g)) targets.push(match[1]);
    for (const match of source.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) targets.push(match[1]);
    for (const match of source.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g)) targets.push(match[1]);
    for (let target of targets) {
        target = target.replace(/^<|>$/g, '');
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
        target = target.split(/[?#]/)[0];
        if (!target) continue;
        links++;
        try { target = decodeURIComponent(target); } catch (_) { brokenLinks.push(rel + ' → ' + target); continue; }
        const resolved = target.startsWith('/') ? path.resolve(ROOT, '.' + target) : path.resolve(ROOT, path.dirname(rel), target);
        const relative = path.relative(ROOT, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(resolved)) brokenLinks.push(rel + ' → ' + target);
    }
}
check('ឯកសារសកម្ម៖ មានជាន់ឯកសារនិងតំណដែលវាស់ពិត', documents >= 10 && links >= 15,
    documents + ' ឯកសារ · ' + links + ' តំណ');
check('ឯកសារសកម្ម៖ តំណក្នុង repo មានគោលដៅពិតក្រោយការលុប/ប្តូរឈ្មោះ', !brokenLinks.length, brokenLinks.join(' · '));
console.log('\nប្រភេទភស្តុតាង៖ ' + JSON.stringify(totals));
console.log('ការមាន mapping មិនបញ្ជាក់ behavioral coverage គ្រប់បន្ទាត់ ឬការកំណត់ផលិតកម្មទេ។');
console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
