'use strict';
process.exitCode = 1;
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const ROOT = path.resolve(process.env.TESTPLACEMENT_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const GENERATED = new Set(['ZoeW/dist', 'ZoeW/dist-audit', 'ZoeW/android/.gradle', 'ZoeW/android/build', 'ZoeW/android/app/build', 'ZoeW/.native-check-dist', 'ZoeW/.rules-check-dist', 'ZoeW/.history-window-check-dist', 'ZoeW/test-results']);
const THIRD_PARTY = new Set(['tools/firebase-provision/vendor', 'ZoeW/public/vendor']);
const CONFIG = /^(?:vitest|vite|jest|playwright|karma|cypress)\.config\.[cm]?[jt]s$/;
const CODE = /\.(?:[cm]?[jt]sx?|py|java|kt|go|rs|c|cpp|cs|sh|bash)$/;
function testAsset(file) {
    const parts = file.split('/'), name = parts.at(-1);
    if (CONFIG.test(name)) return false;
    return parts.some(part => /^(?:__tests__|__mocks__|tests?|fixtures?|testdata)$/i.test(part))
        || (CODE.test(name) && /(?:^test(?:[._-]|\.)|[._-](?:test|spec|fixture|fixtures)(?:[._-]|\.)|(?:Test|Tests|Spec)\.(?:java|kt|cs)$)/.test(name));
}
function misplaced(root) {
    const files = [];
    const walk = (dir, rel) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = rel ? rel + '/' + entry.name : entry.name;
            if (entry.name === '.git' || entry.name === 'node_modules' || GENERATED.has(file) || THIRD_PARTY.has(file)) continue;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), file);
            else if (entry.isFile()) files.push(file);
        }
    };
    walk(root, '');
    return { files, bad: files.filter(file => {
        if (file.startsWith('tools/audit-tools/')) return false;
        if (testAsset(file)) return true;
        if (!CODE.test(file)) return false;
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        return /(?:from\s*|require\(\s*|import\(\s*)['"](?:vitest|node:test|@playwright\/test|@jest\/globals)['"]/.test(source)
            || /^\s*(?:import pytest|from pytest import|@Test\b)/m.test(source);
    }) };
}
let pass = 0, fail = 0;
function ok(label, value) { if (value) { pass++; console.log('✅ ' + label); } else { fail++; console.error('❌ ' + label); } }
try {
    const actual = misplaced(ROOT);
    ok('មានប្រភពកម្មវិធីទាំងពីរ និងឧបករណ៍វាស់ពិត', actual.files.includes('ZoeW/package.json') && actual.files.includes('ZoeKeyGen/app.js') && actual.files.some(file => /^tools\/audit-tools\/zoew\/tests\/.+\.test\.tsx?$/.test(file)));
    ok('តេស្ត និង fixture របស់គម្រោងស្ថិតតែក្នុង tools/audit-tools', actual.bad.length === 0);
    for (const file of actual.bad) console.error('   ' + file);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-test-placement-'));
    try {
        const examples = ['ZoeW/src/probe.test.ts', 'ZoeKeyGen/probe-test.js', 'supabase/test/probe.js', 'tools/sample/__tests__/probe.ts', 'audit-tools/probe.test.ts', 'ZoeW/src/__mocks__/sdk.ts', 'ZoeW/fixtures/sample.json', 'ZoeW/android/app/src/test/ProbeTest.java', 'ZoeW/src/checks.ts'];
        for (const file of [...examples, 'tools/audit-tools/zoew/tests/probe.test.ts', 'tools/audit-tools/fixtures/sample.json', 'ZoeW/vitest.config.mts', 'ZoeW/src/app.ts', 'ZoeKeyGen/app.js']) {
            fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
            fs.writeFileSync(path.join(temp, file), file.endsWith('/checks.ts') ? "import { test } from 'vitest';\n" : '');
        }
        assert.deepEqual(misplaced(temp).bad.sort(), examples.sort());
        ok('fixture ពុលនៅ source/product ត្រូវចាប់ ហើយ tools/audit-tools/config ពិតត្រូវទទួល', true);
        for (const file of examples) fs.unlinkSync(path.join(temp, file));
        assert.deepEqual(misplaced(temp).bad, []);
        ok('ដក fixture ពុលចេញ ស្ថានភាពស្អាតត្រឡប់មកវិញ', true);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
} catch (error) { ok('រត់អ្នកយាមបានពេញលេញ', false); console.error(error.stack); }
console.log(`test-placement: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
