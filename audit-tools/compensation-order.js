// រកលំនាំ `p.then(A).catch(B)` ដែល B ជា *ការសង្គ្រោះ* (revert/release/ដក delta)។
// JavaScript រត់ B ពេល A throw ដែរ ➜ ការសរសេរជោគជ័យ តែការសង្គ្រោះរត់ខុស ➜ លុយ/ទិន្នន័យខូច។
// ដំណោះស្រាយត្រឹមត្រូវ៖ `.then(A, B)` ឬទង់ (flag) ដែលធ្វើឲ្យ B ទៅដល់មិនបាន។
let acorn;
try { acorn = require('acorn'); } catch (e) { console.log('SKIP — ត្រូវការ acorn (npm i acorn)'); process.exit(0); }
const fs = require('fs');
const path = require('path');
const ROOT = process.env.COMP_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

// ការសង្គ្រោះ = ហៅ function ដែលបញ្ច្រាស/ដោះ/ស្តារ ស្ថានភាពដែលបានអនុវត្តជាមុន
const RECOVERY = /^(revert|rollback|restore|release|undo)/i;
const RECOVERY_CALL = /(revertRevenueOnSaveFailure|rollbackFailedSave|releaseBarcodesInRegistry|restoreClaimedItemToScanHistory|revertPickupDeltaAfterNoOp)/;

// ធាតុដែលបានពិនិត្យរួច ហើយ B មិនមែនជាការសង្គ្រោះ (គ្រាន់តែ log / toast / capture)
const ACCEPTED = new Set([
    // ទម្រង់៖ '<app>:<line>' — បន្ថែមតែពេលបានតាមដានពិត
]);

let problems = [];
function srcOf(code, node) { return code.slice(node.start, node.end); }

for (const app of APPS) {
    const file = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });

    (function walk(node, parent) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'CallExpression' &&
            node.callee.type === 'MemberExpression' &&
            !node.callee.computed &&
            node.callee.property.name === 'catch' &&
            node.callee.object.type === 'CallExpression' &&
            node.callee.object.callee.type === 'MemberExpression' &&
            !node.callee.object.callee.computed &&
            node.callee.object.callee.property.name === 'then' &&
            node.callee.object.arguments.length === 1) {
            // A ដែល throw មិនបាន (ឧ. `() => { flag = true; }`) ធ្វើឲ្យ B ទៅដល់បានតែពេលសរសេរបរាជ័យពិត
            const onFulfilled = node.callee.object.arguments[0];
            let aCanThrow = true;
            if (onFulfilled) {
                aCanThrow = false;
                (function scan(n) {
                    if (!n || typeof n.type !== 'string' || aCanThrow) return;
                    if (n.type === 'CallExpression' || n.type === 'NewExpression' ||
                        n.type === 'ThrowStatement' || n.type === 'AwaitExpression' ||
                        n.type === 'TaggedTemplateExpression') { aCanThrow = true; return; }
                    for (const k of Object.keys(n)) {
                        if (k === 'loc' || k === 'start' || k === 'end') continue;
                        const v = n[k];
                        if (Array.isArray(v)) v.forEach(scan);
                        else if (v && typeof v.type === 'string') scan(v);
                    }
                })(onFulfilled);
            }
            const handler = node.arguments[0];
            const body = handler ? srcOf(code, handler) : '';
            const isRecovery = RECOVERY_CALL.test(body) ||
                (handler && handler.params && handler.params.length > 0 &&
                 /addRevenueToDailyAndMonthlyRecord\(\s*[^,]+,\s*-|addPickupToDailyRecord\(\s*[^,]+,\s*[^,]+,\s*-|scanHistory\s*=\s*\w*[Ss]napshot|deletedItems\s*=\s*\w*[Ss]napshot/.test(body)) ||
                (handler && handler.id && RECOVERY.test(handler.id.name));
            if (isRecovery && aCanThrow) {
                const key = app + ':' + node.loc.start.line;
                if (!ACCEPTED.has(key)) {
                    problems.push('  ' + app + '/app.js:' + node.loc.start.line +
                        '  .then(A).catch(B) ដែល B ជាការសង្គ្រោះ ➜ ប្រើ .then(A, B)');
                }
            }
        }
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            if (Array.isArray(v)) v.forEach((c) => walk(c, node));
            else if (v && typeof v.type === 'string') walk(v, node);
        }
    })(ast, null);
}

if (problems.length) {
    console.log('រកឃើញ ' + problems.length + ' កន្លែង៖');
    problems.forEach((p) => console.log(p));
    process.exit(1);
}
console.log('ស្អាត — គ្មាន `.then(A).catch(B)` ដែល B ជាការសង្គ្រោះ');
