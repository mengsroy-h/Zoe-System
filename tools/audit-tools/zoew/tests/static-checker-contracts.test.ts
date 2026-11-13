import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { moduleView } from '../scripts/checker-view.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../../../..');

const require=createRequire(root+'/tools/audit-tools/static-checker-contracts.cjs');
const {cleanupSelection,dispatcherContract,onValueGuarded,walk,parse}=require(root+'/tools/audit-tools/static-checker-contracts.cjs');
const view=(p: string)=>moduleView(fs.readFileSync(root+'/ZoeW/'+p,'utf8'),p);
it('ប្រភពពិត និង mutations នៃ checker រចនាសម្ព័ន្ធ', () => {
const cleanup=view('src/domain/cleanup.ts');
assert(cleanupSelection(cleanup));
for(const [a,b] of [['bounds.lowerMs','bounds.upperMs'],['if (!clock.current()) return;',''],['if (!bounds) return;',''],['&& claimable(b) && collectedAllows(currentItem, b)','&& collectedAllows(currentItem, b)'],['&& collectedAllows(currentItem, b)',''],['!ripeClosed.includes(b)','ripeClosed.includes(b)']])assert(!cleanupSelection(cleanup.replaceAll(a,b)),a);
assert(!cleanupSelection(cleanup.replace('const ripeClosed =', 'const ageNow = Infinity; const ripeClosed =')));
for(const declaration of ['const {ageNow} = {ageNow:Infinity};', 'const [ageNow] = [Infinity];', 'const {...bounds} = {lowerMs:Infinity};']) assert(!cleanupSelection(cleanup.replace('const ripeClosed =', declaration+' const ripeClosed =')));
for(const declaration of ['const claimable = () => true;', 'const collectedAllows = () => true;', 'function getServerClockBounds(){return {lowerMs:Infinity};}']) assert(!cleanupSelection(cleanup.replace('const ripeClosed =', declaration+' const ripeClosed =')));
const actions=view('src/app/actions.ts');assert(dispatcherContract(actions));
for(const [a,b] of [['if (!sessionUserActionAllowed(name)) return;',''],['lookupAction(name)','window[name]'],['if (!fn)','if (fn)'],['fn(...args);','fn(...args); fn(...args);'],['const fn = lookupAction(name);','fn(...args); const fn = lookupAction(name);']])assert(!dispatcherContract(actions.replace(a,b)),a);
const connection=view('src/services/connection.ts').replaceAll('firebaseState.','');
const checks=(source: string)=>{const result: boolean[]=[];walk(parse(source),(n: any,p: any[])=>{if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='onValue'&&/^dbRef/.test(n.arguments[0]?.name))result.push(onValueGuarded(n,p));});return result;};
assert.deepEqual(checks(connection),[true,true]);
for(const name of ['dbRefConnected','dbRefServerTimeOffset']){
 const modified=connection.replace(' || !'+name,'');const result=checks(modified);assert.equal(result[name==='dbRefConnected'?0:1],false);
}
assert.deepEqual(checks('function f(){ if (!dbRefX) return; '+ 'void 0;'.repeat(500)+'fb.onValue(dbRefX, ()=>{}); }'),[true]);
for(const s of ['function f(){if(false){if(!dbRefX)return;}fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefY)return;fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefX)return;dbRefX=null;fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefX&&ready)return;fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefX)return;(()=>{fb.onValue(dbRefX,()=>{});})();}']) assert.deepEqual(checks(s),[false]);
for (const source of ['function f(){if(!dbRefX)return;{let dbRefX=null;fb.onValue(dbRefX,()=>{});}}', 'function f(){if(dbRefX){let dbRefX;fb.onValue(dbRefX,()=>{});}}', 'function f(){if(!dbRefX)return;for(let dbRefX of refs){fb.onValue(dbRefX,()=>{});}}', 'function f(){if(!dbRefX)return;try{}catch(dbRefX){fb.onValue(dbRefX,()=>{});}}']) assert.deepEqual(checks(source),[false]);
for(const statement of ['{ const {dbRefX} = {dbRefX:null}; fb.onValue(dbRefX,()=>{}); }', '{ const [dbRefX] = [null]; fb.onValue(dbRefX,()=>{}); }', 'for(const {dbRefX} of [{dbRefX:null}]) {fb.onValue(dbRefX,()=>{});}', 'try{}catch({dbRefX}){fb.onValue(dbRefX,()=>{});}']) assert.deepEqual(checks('function f(){if(!dbRefX)return;'+statement+'}'),[false]);
assert.deepEqual(checks('function f(){if(dbRefX){fb.onValue(dbRefX,()=>{});}}'),[true]);
console.log('PASS actual module views and 19 negative/distance controls; no browser');
const kg=fs.readFileSync(root+'/ZoeKeyGen/app.js','utf8');assert(checks(kg).every(Boolean));
const all=[];for(const p of fs.readdirSync(root+'/ZoeW/src',{recursive:true, encoding:'utf8'}).filter(p=>p.endsWith('.ts')&&!p.endsWith('.d.ts'))){if(!fs.readFileSync(root+'/ZoeW/src/'+p,'utf8').includes('.onValue('))continue;const src=view('src/'+p).replaceAll('firebaseState.','');for(const result of checks(src))all.push({p,result});}
assert(all.every(x=>x.result),JSON.stringify(all.filter(x=>!x.result)));console.log('PASS all ZoeW source and KeyGen onValue guards',all.length,checks(kg).length);
const {sharedClockContract}=require(root+'/tools/audit-tools/static-checker-contracts.cjs');
const clock=view('src/core/clock.ts');
const fn=(source: string,name: string)=>{const node=parse(source).body.find((n: any)=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end);};
const zfn=fn(clock,'getServerNow'),kfn=fn(kg,'getServerNow');assert(sharedClockContract(clock,zfn,kfn));
for(const [a,b] of [['sample.estimateEpochMs + Math.floor(elapsed)','Date.now()'],['invalidateServerClock();','void 0;'],['return sample.estimateEpochMs;','return 0;']]){const mutant=clock.replaceAll(a,b);assert(!sharedClockContract(mutant,fn(mutant,'getServerNow'),kfn),a);}
assert(!sharedClockContract(clock,zfn,kfn.replace('window.ZoeLicense.getServerNow()','123')));
assert(!sharedClockContract(clock,zfn,kfn.replace('Date.now() + serverTimeOffsetMs','Date.now()')));
assert(!sharedClockContract(clock,zfn.replace('Math.floor(elapsed)','elapsed'),kfn));
console.log('PASS shared clock owner behavior and six negative controls');

});

// ទិដ្ឋភាពប្រភព និង JSX ក្នុង node តែប៉ុណ្ណោះ។ មិនសាង index.html ឬអះអាងថា browser audit បានរត់ទេ។
import { beforeAll, afterAll, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
let fixtureRoot: string;
let temporaryRoot: string;
beforeAll(() => {
    temporaryRoot = fs.mkdtempSync(path.join(tmpdir(), 'zoe-checker-seams-'));
    fixtureRoot = path.join(temporaryRoot, 'source-view');
    fs.symlinkSync(path.join(root, 'ZoeW/src'), path.join(temporaryRoot, 'src'), 'dir');
    fs.symlinkSync(path.join(root, 'ZoeW/node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    const buildSource = fs.readFileSync(path.join(root, 'tools/audit-tools/zoew/scripts/build-audit.mjs'), 'utf8');
    const stageOne = buildSource.indexOf('/* ២. សំបកពិត');
    const ssrStart = buildSource.indexOf('{\n    const components = [];');
    const ssrEnd = buildSource.indexOf('\n/*\n * ២ឃ.', ssrStart);
    assert(stageOne > 0 && ssrStart > stageOne && ssrEnd > ssrStart);
    const source = (buildSource.slice(0, stageOne) + buildSource.slice(ssrStart, ssrEnd))
        .replace("const OUT = path.join(ROOT, 'dist-audit');", () => 'const OUT = ' + JSON.stringify(fixtureRoot) + ';');
    const file = path.join(root, 'tools/audit-tools/zoew/scripts/.' + path.basename(temporaryRoot) + '.mjs');
    try {
        fs.writeFileSync(file, source);
        const result = spawnSync(process.execPath, [file], { cwd: path.join(root, 'ZoeW'), encoding: 'utf8', timeout: 30000 });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        fs.symlinkSync(path.join(root, 'ZoeKeyGen'), path.join(fixtureRoot, 'ZoeKeyGen'), 'dir');
        assert(!fs.existsSync(path.join(fixtureRoot, 'ZoeW/index.html')));
    } finally { fs.rmSync(file, { force: true }); }
}, 40000);
afterAll(() => { if (temporaryRoot) fs.rmSync(temporaryRoot, { recursive: true, force: true }); });

function checkerSource(file: string) { return fs.readFileSync(path.join(root, 'tools/audit-tools', file), 'utf8'); }
function checkerContext(env: Record<string, string>) {
    const output: string[] = [];
    const context = vm.createContext({
        require, __dirname: path.join(root, 'tools/audit-tools'), performance, URL, TextEncoder,
        process: { env }, console: { log: (...args: unknown[]) => output.push(args.join(' ')), error: (...args: unknown[]) => output.push(args.join(' ')) },
        setTimeout, clearTimeout, queueMicrotask
    });
    return { context, output };
}

it('trash checker ពិតរក្សា async តាមការស្រង់ពី concatenation ហើយពុលដោយគ្មាន crash', () => {
    const source = checkerSource('trash-modal-test.js');
    const ast = parse(source);
    const htmlRead = ast.body.find((node: any) => node.declarations?.some((d: any) => d.id.name === 'indexHtml'));
    assert(htmlRead);
    const prefix = source.slice(0, htmlRead.start);
    const summary = source.slice(source.lastIndexOf("console.log('\\n' + (fail === 0"));
    const baseline = checkerContext({ TRASH_APP_DIR: fixtureRoot });
    vm.runInContext(prefix + '\nglobalThis.result = { pass, fail };', baseline.context);
    expect(baseline.context.result.fail, baseline.output.join('\n')).toBe(0);
    expect(baseline.context.result.pass).toBeGreaterThanOrEqual(55);

    const integrity = checkerSource('exit-code-integrity.js');
    const poisonSource = vm.runInNewContext(integrity.slice(integrity.indexOf('const POISON ='), integrity.indexOf('function durationMs(')) + '\npoisonSource;', { acorn: { parse } });
    const poisoned = poisonSource(prefix + summary);
    assert(poisoned);
    const file = path.join(root, 'tools/audit-tools/.tmp-checker-seam-poison-' + process.pid + '.js');
    try {
        fs.writeFileSync(file, poisoned);
        const result = spawnSync(process.execPath, ['--require', path.join(root, 'tools/audit-tools/runall-exit-guard.cjs'), file], {
            cwd: root, env: { ...process.env, TRASH_APP_DIR: fixtureRoot, ZOE_RUNALL_EXIT_GUARD: '1' }, encoding: 'utf8', timeout: 30000
        });
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.signal).toBeNull();
        expect(result.stderr).toContain('ZOE_EXITCODE_POISON_REACHED');
        expect(result.stdout).toContain('❌ ធ្លាក់');
        expect(result.stdout + result.stderr).not.toMatch(/SyntaxError|ReferenceError|TypeError/);
    } finally { fs.rmSync(file, { force: true }); }
});

it('connection checker ពិតផ្ទុក clock owner និងឯកជន មុន attachInfoListeners', () => {
    const result = spawnSync(process.execPath, [path.join(root, 'tools/audit-tools/connection-recovery-test.js')], {
        cwd: root, env: { ...process.env, CONNRECOVERY_APP_DIR: fixtureRoot }, encoding: 'utf8', timeout: 30000
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout).toMatch(/សរុប: \d+ ok, 0 FAIL/);
}, 40000);

it('daily checker សេណារីយ៉ូអធ្រាត្រពិតរត់លើ clock bounds ដែលដើរស្របគ្នា', async () => {
    const source = checkerSource('daily-collected-test.js');
    const ast = parse(source);
    const setup = ast.body.filter((node: any) => ['VariableDeclaration', 'FunctionDeclaration'].includes(node.type))
        .map((node: any) => source.slice(node.start, node.end)).join('\n');
    let midnight: any;
    walk(ast, (node: any) => { if (node.type === 'ForOfStatement' && source.slice(node.start, node.end).includes("operationScenario('៣៧.")) midnight = node; });
    assert(midnight);
    const { context, output } = checkerContext({ COLLECTED_APP_DIR: fixtureRoot });
    vm.runInContext(setup + '\nglobalThis.work = (async () => {' + source.slice(midnight.start, midnight.end) + '\nreturn { pass, fail };})();', context);
    const result = await context.work;
    expect(result.fail, output.join('\n')).toBe(0);
    expect(result.pass).toBeGreaterThanOrEqual(8);
});

it('crud checker ផ្ទៀង scope និងរត់ preflight ពិតមុនទាក់ទង emulator', async () => {
    const source = checkerSource('emu/crud-rules-flow.js');
    const emulatorGate = source.indexOf('    let load;');
    assert(emulatorGate > 0);
    const { context, output } = checkerContext({ CRUDFLOW_APP_DIR: fixtureRoot });
    context.require = createRequire(path.join(root, 'tools/audit-tools/emu/crud-rules-flow.js'));
    context.__dirname = path.join(root, 'tools/audit-tools/emu');
    context.process.exit = (code: number) => { throw new Error('preflight exit ' + code); };
    const prefix = source.slice(0, emulatorGate).replace('(async () => {', 'globalThis.work = (async () => {');
    vm.runInContext(prefix + '\nreturn { pass, fail }; })();', context);
    const result = await context.work.catch((error: Error) => { throw new Error(output.join('\n') + '\n' + error.stack); });
    expect(result.fail, output.join('\n')).toBe(0);
    expect(result.pass).toBeGreaterThanOrEqual(10);
});


it('info listener contract ចាប់ readiness និង callback ពិតដោយគ្មានចម្ងាយអក្សរ', () => {
    const { infoListenerRecoveryContract } = require(root + '/tools/audit-tools/static-checker-contracts.cjs');
    const sources = [view('src/services/connection.ts').replaceAll('firebaseState.', ''), fs.readFileSync(root + '/ZoeKeyGen/app.js', 'utf8')];
    for (const source of sources) {
        expect(infoListenerRecoveryContract(source)).toEqual({ pending: true, connected: true, offset: true });
        expect(infoListenerRecoveryContract(source.replace('infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);', ''))).toMatchObject({ pending: false });
        expect(infoListenerRecoveryContract(source.replace('handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);', 'handleInfoListenerError(err);'))).toMatchObject({ offset: false });
        expect(infoListenerRecoveryContract(source.replace('handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);', 'if (false) { handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET); }'))).toMatchObject({ offset: false });
        expect(infoListenerRecoveryContract(source.replace('infoListenerFailedPaths.clear();', 'void 0;'.repeat(500) + 'infoListenerFailedPaths.clear();'))).toEqual({ pending: true, connected: true, offset: true });
    }
});

it('daily checker រត់សេណារីយ៉ូ operation ទាំងអស់ដោយមិនជំនួស HTML ដែលខ្វះ', () => {
    const source = checkerSource('daily-collected-test.js');
    const ast = parse(source);
    const setup = ast.body.filter((node: any) => ['VariableDeclaration', 'FunctionDeclaration'].includes(node.type))
        .map((node: any) => source.slice(node.start, node.end)).join('\n');
    const runner = ast.body.at(-1);
    assert(source.slice(runner.start, runner.end).startsWith('(async () => {'));
    const file = path.join(root, 'tools/audit-tools/.tmp-collected-operation-' + process.pid + '.js');
    try {
        fs.writeFileSync(file, setup + '\n' + source.slice(runner.start, runner.end));
        const result = spawnSync(process.execPath, ['--require', path.join(root, 'tools/audit-tools/runall-exit-guard.cjs'), file], {
            cwd: root, env: { ...process.env, COLLECTED_APP_DIR: fixtureRoot, ZOE_RUNALL_EXIT_GUARD: '1' }, encoding: 'utf8', timeout: 40000
        });
        const outcome = JSON.stringify({ status: result.status, signal: result.signal, error: (result.error as NodeJS.ErrnoException)?.code });
        expect(result.status, outcome + '\n' + result.stdout + result.stderr).toBe(0);
        expect(result.signal).toBeNull();
        const summary = /✅ ចំណូលប្រចាំថ្ងៃ — ok (\d+)/.exec(result.stdout);
        expect(Number(summary?.[1])).toBe(110);
    } finally { fs.rmSync(file, { force: true }); }
}, 50000);

it('daily checker រៀបចំប្រភពតែម្តង ហើយ sandbox នីមួយៗរក្សាស្ថានភាពដាច់គ្នា', () => {
    const source = checkerSource('daily-collected-test.js');
    const setup = parse(source).body.filter((node: any) => ['VariableDeclaration', 'FunctionDeclaration'].includes(node.type))
        .map((node: any) => source.slice(node.start, node.end)).join('\n');
    const { context } = checkerContext({ COLLECTED_APP_DIR: fixtureRoot });
    const preparation = { runtime: 0, bindings: 0 };
    context.require = (name: string) => {
        const module = require(name);
        if (name !== './react-view') return module;
        return { ...module, moduleRuntime: (...args: unknown[]) => {
            preparation.runtime++;
            const runtime = module.moduleRuntime(...args);
            return { ...runtime, withoutBindings: (code: string) => {
                preparation.bindings++;
                return runtime.withoutBindings(code);
            } };
        } };
    };
    vm.runInContext(setup + '\nglobalThis.fixture = { makeOperationSandbox, editFixture };', context);
    const prepared = { ...preparation };
    const first = context.fixture.makeOperationSandbox(context.fixture.editFixture());
    const second = context.fixture.makeOperationSandbox(context.fixture.editFixture());
    expect(preparation).toEqual(prepared);
    expect(preparation.runtime).toBeGreaterThan(0);
    expect(preparation.bindings).toBe(1);
    expect(first.box.serverClockIsTrustworthy()).toBe(true);
    expect(second.box.serverClockIsTrustworthy()).toBe(true);
    const secondClock = second.box.captureClockOperation();
    first.box.resetServerClock();
    expect(first.box.serverClockIsTrustworthy()).toBe(false);
    expect(second.box.serverClockIsTrustworthy()).toBe(true);
    expect(secondClock.current()).toBe(true);
    first.box.livePriceTokens.add('first-only');
    first.box.priceOperationSeen.set('first-only', 1);
    expect(second.box.livePriceTokens.has('first-only')).toBe(false);
    expect(second.box.priceOperationSeen.has('first-only')).toBe(false);
    first.write('zoew_scan_history_cod_dod/fixture_item/price', 99);
    expect(second.read('zoew_scan_history_cod_dod/fixture_item/price')).toBe(13.25);
}, 10000);

it.each([
    ['early-return', 'handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);', 'return; handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);', 'offset'],
    ['clear-pending', 'infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);', 'infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET); infoListenerFailedPaths.clear();', 'pending'],
    ['shadow-handler', 'function attachInfoListeners() {', 'function attachInfoListeners() { const handleInfoListenerError = () => {};', 'offset'],
    ['shadow-pending', 'function attachInfoListeners() {', 'function attachInfoListeners() { const infoListenerFailedPaths = new Set();', 'pending'],
    ['alias-clear', 'infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);', 'infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET); const pendingAlias = infoListenerFailedPaths; pendingAlias.clear();', 'pending']
])('info listener contract បដិសេធផ្លូវក្លែង៖ %s', (_label, before, after, field) => {
    const { infoListenerRecoveryContract } = require(root + '/tools/audit-tools/static-checker-contracts.cjs');
    for (const source of [view('src/services/connection.ts').replaceAll('firebaseState.', ''), fs.readFileSync(root + '/ZoeKeyGen/app.js', 'utf8')]) {
        expect(source).toContain(before);
        expect(infoListenerRecoveryContract(source.replace(before, after))[field]).toBe(false);
    }
});


it('info listener contract មិនទទួល current ក្លែង ឬការលុប pending ក្រោយ registration', () => {
    const { infoListenerRecoveryContract } = require(root + '/tools/audit-tools/static-checker-contracts.cjs');
    const module = view('src/services/connection.ts').replaceAll('firebaseState.', '');
    const attach = parse(module).body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'attachInfoListeners');
    const source = module.slice(attach.start, attach.end);
    expect(infoListenerRecoveryContract(source.replace('infoListenerFailedPaths.clear();', 'current = () => false; infoListenerFailedPaths.clear();')).offset).toBe(false);
    const tail = parse(source).body[0].body.body.at(-1);
    expect(infoListenerRecoveryContract(source.slice(0, tail.start) + 'infoListenerFailedPaths.clear(); ' + source.slice(tail.start)).pending).toBe(false);
    expect(infoListenerRecoveryContract(source.replace('handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);', 'void 0;'.repeat(500) + 'handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);')).offset).toBe(true);
});

it.each([
    ['ZoeW', 'current'], ['ZoeKeyGen', 'listenerGeneration'], ['ZoeKeyGen', 'infoListenerGeneration']
])('info listener callback param មិនលាក់ម្ចាស់៖ %s %s', (app, name) => {
    const { infoListenerRecoveryContract } = require(root + '/tools/audit-tools/static-checker-contracts.cjs');
    const source = app === 'ZoeW' ? view('src/services/connection.ts').replaceAll('firebaseState.', '') : fs.readFileSync(root + '/ZoeKeyGen/app.js', 'utf8');
    const attach = parse(source).body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'attachInfoListeners');
    let callback: any;
    walk(attach, (node: any) => {
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'onValue'
            && node.arguments[0]?.name === 'dbRefServerTimeOffset') callback = node.arguments[2];
    });
    expect(callback.params[0].name).toBe('err');
    const edits: number[][] = [];
    walk(callback, (node: any) => { if (node.type === 'Identifier' && node.name === 'err') edits.push([node.start, node.end]); });
    let mutant = source;
    for (const [start, end] of edits.sort((a, b) => b[0] - a[0])) mutant = mutant.slice(0, start) + name + mutant.slice(end);
    expect(infoListenerRecoveryContract(mutant).offset).toBe(false);
});

it.each([['ZoeW', 'current'], ['ZoeKeyGen', 'listenerGeneration']])('info listener callback function name មិនលាក់ម្ចាស់៖ %s %s', (app, name) => {
    const { infoListenerRecoveryContract } = require(root + '/tools/audit-tools/static-checker-contracts.cjs');
    const source = app === 'ZoeW' ? view('src/services/connection.ts').replaceAll('firebaseState.', '') : fs.readFileSync(root + '/ZoeKeyGen/app.js', 'utf8');
    const attach = parse(source).body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'attachInfoListeners');
    let callback: any;
    walk(attach, (node: any) => {
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'onValue'
            && node.arguments[0]?.name === 'dbRefServerTimeOffset') callback = node.arguments[2];
    });
    const mutant = source.slice(0, callback.start) + 'function ' + name + '(err) ' + source.slice(callback.body.start, callback.end) + source.slice(callback.end);
    expect(infoListenerRecoveryContract(mutant).offset).toBe(false);
});


it.each(['source', 'measure'])('react-view ប្រើ Acorn របស់ root វាស់ មិនមែន ambient៖ %s', (layout) => {
    const isolated = fs.mkdtempSync(path.join(tmpdir(), 'zoe-acorn-owner-'));
    try {
        fs.mkdirSync(path.join(isolated, 'tools/audit-tools'), { recursive: true });
        fs.mkdirSync(path.join(isolated, 'ZoeW'));
        fs.copyFileSync(path.join(root, 'tools/audit-tools/react-view.js'), path.join(isolated, 'tools/audit-tools/react-view.js'));
        const clock = view('src/core/clock.ts');
        fs.writeFileSync(path.join(isolated, 'ZoeW/audit-module-views.json'), JSON.stringify({ 'src/core/clock.ts': clock }));
        const poison = path.join(isolated, 'ambient/acorn');
        fs.mkdirSync(poison, { recursive: true });
        fs.writeFileSync(path.join(poison, 'index.js'), "throw new Error('ambient Acorn must not run');");
        if (layout === 'source') {
            fs.symlinkSync(path.join(root, 'ZoeW/node_modules'), path.join(isolated, 'ZoeW/node_modules'), 'dir');
            fs.mkdirSync(path.join(isolated, 'node_modules'));
            fs.symlinkSync(poison, path.join(isolated, 'node_modules/acorn'), 'dir');
        } else fs.symlinkSync(path.join(root, 'ZoeW/node_modules'), path.join(isolated, 'node_modules'), 'dir');
        const expected = createRequire(path.join(root, 'ZoeW/package.json')).resolve('acorn');
        const script = `const assert = require('node:assert/strict');
            const { moduleRuntime } = require(${JSON.stringify(path.join(isolated, 'tools/audit-tools/react-view.js'))});
            const root = ${JSON.stringify(isolated)}, source = ${JSON.stringify(clock)};
            const runtime = moduleRuntime(root, source, ['src/core/clock.ts']);
            assert(runtime.code.includes('getServerClockBounds'));
            assert(require.cache[${JSON.stringify(expected)}]);
            const fs = require('node:fs');
            fs.writeFileSync(root + '/ZoeW/audit-module-views.json', JSON.stringify({ 'src/core/clock.ts': 'function broken( {' }));
            assert.throws(() => moduleRuntime(root, 'function broken( {', ['src/core/clock.ts']), SyntaxError);
            console.log('owned-parser:' + ${JSON.stringify(expected)});`;
        const result = spawnSync(process.execPath, ['-e', script], { cwd: isolated,
            env: { ...process.env, NODE_PATH: path.join(isolated, 'ambient') }, encoding: 'utf8', timeout: 10000 });
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('owned-parser:' + expected);
    } finally { fs.rmSync(isolated, { recursive: true, force: true }); }
});
