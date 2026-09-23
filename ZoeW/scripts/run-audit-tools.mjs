/**
 * រត់ checker របស់ `audit-tools/` (ដែលសរសេរសម្រាប់ ZoeW ដើម) ទៅលើ
 * **tree របស់ ZoeW Next**។ នេះជាការវាស់ដែលឯករាជ្យបំផុត ៖ ឧបករណ៍មិនបាន
 * សរសេរដោយយើង ហើយវាមិនដឹងថា App ត្រូវសរសេរឡើងវិញទេ។
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = process.env.AUDIT_TOOLS || path.join(HERE, '..', '..', 'audit-tools');
const TREE = path.join(HERE, '..', 'dist-audit');
const ONLY = process.argv[2] ? new RegExp(process.argv[2]) : null;

const files = readdirSync(TOOLS).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort();
const TIMEOUT = Number(process.env.CHECKER_TIMEOUT_MS || 90000);
const CONCURRENCY = Number(process.env.CHECKER_CONCURRENCY || 4);
const results = [];

async function runOne(f) {
    const full = path.join(TOOLS, f);
    const src = readFileSync(full, 'utf8');
    const envNames = [...new Set([...src.matchAll(/process\.env\.([A-Z0-9_]*APP_DIR)/g)].map((m) => m[1]))];
    if (!envNames.length) return { f, status: 'NO_OVERRIDE' };
    const env = { ...process.env, NODE_PATH: process.env.NODE_PATH || path.join(HERE, '..', 'node_modules') };
    for (const n of envNames) env[n] = TREE;
    try {
        const { stdout, stderr } = await run('node', [full], { env, timeout: TIMEOUT, maxBuffer: 32 * 1024 * 1024 });
        const out = stdout + stderr;
        const okCount = (out.match(/ok {4}/g) || []).length;
        const skip = /^SKIP/m.test(out);
        return { f, status: skip && okCount === 0 ? 'SKIP' : 'PASS', ok: okCount, out };
    } catch (e) {
        const out = String(e.stdout || '') + String(e.stderr || '') + (e.killed ? '\n(TIMEOUT)' : '');
        return { f, status: 'FAIL', out, err: e.message };
    }
}

const queue = files.filter((f) => !ONLY || ONLY.test(f));
let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < queue.length) {
        const f = queue[cursor++];
        const r = await runOne(f);
        results.push(r);
        process.stderr.write(`${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '·'} ${r.f}\n`);
    }
}));
results.sort((a, b) => a.f.localeCompare(b.f));

const pass = results.filter((r) => r.status === 'PASS');
const fail = results.filter((r) => r.status === 'FAIL');
const skip = results.filter((r) => r.status === 'SKIP');
const none = results.filter((r) => r.status === 'NO_OVERRIDE');

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  checker របស់ ZoeW ដើម រត់លើ tree របស់ ZoeW Next                    ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
for (const r of results) {
    if (r.status === 'PASS') console.log(`✅ ${r.f.padEnd(42)} ${r.ok} assertion`);
    else if (r.status === 'SKIP') console.log(`⏭️  ${r.f.padEnd(42)} រំលង`);
    else if (r.status === 'NO_OVERRIDE') console.log(`➖ ${r.f.padEnd(42)} គ្មាន *_APP_DIR`);
    else console.log(`❌ ${r.f.padEnd(42)} ធ្លាក់`);
}
console.log(`\nសរុប ៖ ✅ ${pass.length}  ❌ ${fail.length}  ⏭️ ${skip.length}  ➖ ${none.length}  (assertion ដែលជាប់ ៖ ${pass.reduce((s, r) => s + r.ok, 0)})`);

if (process.env.SHOW_FAILURES) {
    for (const r of fail) {
        console.log('\n' + '─'.repeat(72) + '\n❌ ' + r.f);
        console.log(r.out.split('\n').filter((l) => /FAIL|Error|✗|not found|missing/i.test(l)).slice(0, 6).join('\n'));
    }
}
