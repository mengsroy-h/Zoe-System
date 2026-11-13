'use strict';
// Synthetic orchestration checks. No real RTDB, PostgreSQL, process signal or network.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert/strict'), vm = require('vm');
// Fake adapters exercise the owner entry without launching an emulator. The
// scheduler conservatively serializes this test with emulator-lane work.
const selectedRoot = path.resolve(process.env.IMPORTPAIRED_RUNNER_TEST_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const runner = require(path.join(selectedRoot, 'tools/audit-tools', 'emu', 'import-paired-ci-runner.js'));
const owner = require(path.join(selectedRoot, 'tools/audit-tools', 'owned-rtdb-command.js'));
const env = { RUNALL_STRICT: '1', CRUD_FLOW_STRICT: '1', SUPABASE_STRICT: '1', ZOE_REPO_ROOT: '/synthetic/root' };
const clone = value => structuredClone(value), HASH = 'a'.repeat(64), HASH2 = 'b'.repeat(64);
function childResult(id) {
    const roots = runner.expected(id), cases = ['native', 'sql'].map(provider => ({ provider, id, pass: true, size: 100,
        batchSha256: HASH, assertions: [...runner.ASSERTIONS], logical: clone(roots) }));
    return { status: 'PASS_PAIRED_CORE_SELECTED_SCOPE', cleanup: true, sourceRoot: '/synthetic/target', unrunProviders: [], vmConsole: {counts:{log:0,info:0,debug:0,trace:0,warn:0,error:0,unsupported:0},overflow:false}, declared: [id], fixture: { size: 100, phones: 8, codCents: 27288, dodCents: 0 },
        sourceBundleSha256: HASH, instrumentedBundleSha256: HASH2, cases,
        caseLedger: ['native', 'sql'].map(provider => ({ provider, id, status: 'PASS' })),
        providerEvidence: [{ provider: 'native', cleanup: { runtimeQuiescent: true, upstreamClosed: true, namespaceHeldDuringRuntime: false, rootEmpty: true, workflowSealed: { outcome: 'DRAINED', failures: [] } } },
            { provider: 'sql', cleanup: { manager: { pid: 5 }, managerExited: true, dataRootRetained: true, sizeBytes: 52,
                dataRoot: '/tmp/zoe-paired-pg-synthetic', fake: { quiescent: true, requests: 0, responses: 0, handlers: 0, sockets: 0, errors: 0 },
                pgAfterClose: { pending: [], errors: [], total: 0, idle: 0, waiting: 0 }, sealedWorkflow: { outcome: 'DRAINED', failures: [] },
                stop: { outcome: 'STOPPED', stopped: true, dataRoot: '/tmp/zoe-paired-pg-synthetic', sizeBytes: 52, pid: 5, errors: [] } } }] };
}
const SNAPSHOT={state:'OBSERVED_POINT_IN_TIME_ONLY',receipt:'PRIVATE_0600',receiptSha256:HASH2}, INITIAL={state:'NOT_ATTEMPTED',reason:'CAPTURE_NOT_COMPLETED',finality:'UNKNOWN',receipt:'PRIVATE_0600',receiptSha256:HASH};
function publicChild(id){const v=childResult(id);return {schema:1,status:v.status,caseSelection:id,sourceBundleSha256:v.sourceBundleSha256,instrumentedBundleSha256:v.instrumentedBundleSha256,caseLedger:v.caseLedger,unrunProviders:v.unrunProviders,cleanup:v.cleanup,vmConsole:v.vmConsole};}
function fakeCapture({stateDir,stdout}){const markerPath=path.join(stateDir,'native-marker.json');return {markerPath,receiptPath:path.join(stateDir,'native-snapshot.json'),initialPath:path.join(stateDir,'native-snapshot-initial.json'),prepare:async()=>INITIAL,adapters:{__syntheticCapture:markerPath,__output:stdout},getReceipt:()=>SNAPSHOT};}
function ownerPass() { return { code: 0, report: { status: 'PASS', cleanup: true, ownedRuntimeStarted: true, commandStarted: true, commandCompleted: true,
    owner: { port: 9000, maxHeapMiB: 512, jarSHA256: HASH }, childResult: { code: 0, outputPresent: true, failureLine: false, skipLine: false, nativeSnapshot:SNAPSHOT } } }; }
function fakeOptions(overrides = {}) {
    const files = new Map(), calls = [], active = { count: 0, maximum: 0 };
    const options = { root: '/synthetic/root', targetRoot: '/synthetic/target', evidenceDir: '/synthetic/private', node: '/synthetic/node', checker: '/synthetic/import-paired-sdk-test.js', env,
        getDiskFree: () => runner.MIN_FREE_BYTES, makeSnapshot:fakeCapture, verifySnapshot:async(capture,observed)=>assert.deepEqual(observed,SNAPSHOT),
        runOwned: async (request,adapters) => {
            assert.equal(adapters?.__syntheticCapture,request.env.IMPORTPAIRED_NATIVE_MARKER,'snapshot adapter must reach owner wrapper');active.count++; active.maximum = Math.max(active.maximum, active.count); calls.push(request);
            assert.deepEqual(request.args.slice(2, 4), ['--matrix=core', '--provider=both']);
            assert.equal(request.env.IMPORTPAIRED_NATIVE_MARKER,path.join(request.stateDir,'native-marker.json'));assert.equal(request.env.ZOE_REPO_ROOT, '/synthetic/root'); assert.equal(request.env.IMPORTPAIRED_APP_DIR, '/synthetic/target'); assert.equal(request.env.IMPORTPAIRED_STRICT, '1');
            const id = request.args[4].slice('--case='.length); assert.equal(request.env.IMPORTPAIRED_CI_CASE, id);
            adapters.__output.write(Buffer.from('IMPORT_PAIRED_RESULT '+JSON.stringify(publicChild(id))+'\n'));files.set(request.env.IMPORTPAIRED_RESULT, childResult(id)); await Promise.resolve(); active.count--; return ownerPass();
        }, readChild: async file => { assert(files.has(file)); return clone(files.get(file)); }, ...overrides };
    return { options, calls, files, active };
}
function mutations() {
    return [
        ['wrong status', v => { v.status = 'SQL_ONLY_CORE'; }], ['wrong source root', v => { v.sourceRoot = '/synthetic/not-target'; }], ['unrun provider', v => { v.unrunProviders = ['native']; }],
        ['VM console missing', v => { delete v.vmConsole; }], ['VM warning', v => { v.vmConsole.counts.warn = 1; }], ['VM error', v => { v.vmConsole.counts.error = 1; }],
        ['VM log', v => { v.vmConsole.counts.log = 1; }], ['VM info', v => { v.vmConsole.counts.info = 1; }],
        ['VM debug', v => { v.vmConsole.counts.debug = 1; }], ['VM trace', v => { v.vmConsole.counts.trace = 1; }],
        ['VM overflow', v => { v.vmConsole.overflow = true; }], ['VM unsupported', v => { v.vmConsole.counts.unsupported = 1; }], ['VM count malformed', v => { v.vmConsole.counts.log = -1; }], ['missing native case', v => { v.cases.shift(); }],
        ['duplicate provider', v => { v.cases[1].provider = 'native'; }], ['wrong id', v => { v.cases[0].id += '-other'; }],
        ['wrong count', v => { v.cases[0].logical.dailyCount = 99; }], ['both wrong count', v => { for (const c of v.cases) c.logical.dailyCount = 99; }],
        ['wrong money', v => { v.cases[1].logical.dailyCod--; }], ['batch mismatch', v => { v.cases[1].batchSha256 = HASH2; }],
        ['missing assertion', v => { v.cases[0].assertions.pop(); }], ['ledger unrun', v => { v.caseLedger[1].status = 'UNRUN'; }],
        ['native root unknown', v => { v.providerEvidence[0].cleanup.rootEmpty = false; }], ['native workflow unsealed', v => { v.providerEvidence[0].cleanup.workflowSealed.outcome = 'EMPTY_SNAPSHOT'; }],
        ['SQL exit unknown', v => { v.providerEvidence[1].cleanup.stop.outcome = 'UNKNOWN'; }],
        ['SQL fake still active', v => { v.providerEvidence[1].cleanup.fake.handlers = 1; }],
        ['SQL live client', v => { v.providerEvidence[1].cleanup.pgAfterClose.total = 1; }],
        ['SQL workflow unsealed', v => { v.providerEvidence[1].cleanup.sealedWorkflow.outcome = 'EMPTY_SNAPSHOT'; }],
        ['cleanup omitted', v => { v.providerEvidence.pop(); }]
    ];
}
async function testRealWrapperEntry(unknownCleanup = false) {
    // Calls the actual repository owner entry with fake adapters; fake signals only.
    let id = 0, calls = [], activeEngine = null; const results = new Map();
    function handle(kind) { let resolve; const obj = { child: { pid: ++id }, spawned: Promise.resolve(), done: false, kind };
        obj.exit = new Promise(r => { resolve = r; }); obj.ended = () => obj.done;
        obj.finish = code => { obj.done = true; resolve({ code, signal: null, outputPresent: true, failureLine: false, skipLine: false }); }; return obj; }
    const adapters = { validateSource() {}, now: Date.now, delay: async () => {}, verifyJar: () => ({ jar: '/fake/jar', sha256: HASH }),
        portFree: async () => {}, launch: () => { assert.equal(activeEngine, null); calls.push('launch'); activeEngine = handle('engine'); return activeEngine; },
        identity: pid => ({ pid, start: 'owned', exe: '/fake/java', args: ['java', ...owner.javaArguments('/fake/jar')] }),
        ownsListener: () => true, readyRead: async () => true,
        command: (args, env) => { calls.push('command'); assert.equal(args[2], '--matrix=core'); assert.equal(args[3], '--provider=both');
            assert.equal(env.IMPORTPAIRED_APP_DIR, '/synthetic/target'); assert.equal(env.ZOE_REPO_ROOT, '/synthetic/root'); assert.equal(env.IMPORTPAIRED_STRICT, '1');
            const profile = args[4].slice('--case='.length); assert.equal(env.IMPORTPAIRED_CI_CASE, profile);
            results.set(env.IMPORTPAIRED_RESULT, childResult(profile)); const child = handle('command'); queueMicrotask(() => child.finish(0)); return child; },
        signal: child => { calls.push('fake-signal'); assert.equal(child.kind, 'engine'); if (!unknownCleanup) { child.finish(0); activeEngine = null; } },
        within: async (promise, ms, label) => { if (unknownCleanup && label.startsWith('Owned JVM')) throw new Error('synthetic cleanup unknown'); return promise; } };
    const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paired-runner-fake-'));
    const report = await runner.runMatrix({ root: '/synthetic/root', targetRoot: '/synthetic/target', evidenceDir, node: '/synthetic/node', checker: '/synthetic/checker', env,
        getDiskFree: () => runner.MIN_FREE_BYTES, readChild: async file => clone(results.get(file)), verifySnapshot:async(capture,observed)=>assert.deepEqual(observed,SNAPSHOT),
        makeSnapshot:({stateDir,stdout})=>({...fakeCapture({stateDir,stdout}),adapters:{...adapters,command(...args){const id=args[0][4].slice('--case='.length);stdout.write(Buffer.from('IMPORT_PAIRED_RESULT '+JSON.stringify(publicChild(id))+'\n'));const child=adapters.command(...args),exit=child.exit;child.exit=exit.then(value=>({...value,nativeSnapshot:SNAPSHOT}));return child;}}}),
        runOwned: (options,adapters) => owner.runOwnedCommand(options, adapters) });
    if (unknownCleanup) {
        assert.equal(report.status, 'FAIL'); assert.equal(report.profiles[0].status, 'FAIL'); assert(report.profiles.slice(1).every(item => item.status === 'UNRUN'));
        assert.deepEqual(calls, ['launch', 'command', 'fake-signal', 'fake-signal']);
        assert(fs.existsSync(path.join(evidenceDir, runner.PROFILES[0] + '-owner', 'blocked.json')), 'actual owned wrapper must persist cleanup block');
    } else {
        assert.equal(report.status, 'PASS'); assert.equal(report.profiles.filter(item => item.status === 'PASS').length, 8);
        assert.deepEqual(calls, Array.from({ length: 8 }, () => ['launch', 'command', 'fake-signal']).flat()); assert.equal(activeEngine, null);
    }
}
async function testActualCliOwnerContract() {
    const filename = path.join(selectedRoot, 'tools/audit-tools', 'emu', 'import-paired-ci-runner.js'), original = fs.readFileSync(filename, 'utf8');
    const marker = 'runOwned: runOwnedCommand'; assert.equal(original.split(marker).length, 2, 'one production wrapper call site');
    async function exercise(mutated,extraEnv={}) {
        const contents = new Map(), descriptors = new Map(); let nextFd = 3, ownerCalls = 0, bypassCalls = 0, finish;
        const done = new Promise(resolve => { finish = resolve; });
        const fakeFs = { constants: fs.constants, writeFileSync(file,data,options){ assert.equal(options.mode,0o600);assert.equal(options.flag,'wx');contents.set(file,data); }, mkdtempSync: () => '/synthetic/private', statfsSync: () => ({ bavail: runner.MIN_FREE_BYTES, bsize: 1n }),
            openSync(file) { assert(contents.has(file)); const fd = nextFd++; descriptors.set(fd, contents.get(file)); return fd; },
            fstatSync(fd) { const text = descriptors.get(fd); return { isFile: () => true, size: Buffer.byteLength(text) }; },
            readFileSync(fd) { return descriptors.get(fd); }, closeSync(fd) { descriptors.delete(fd); } };
        async function execute(options, owned,adapters) {
            assert.equal(adapters?.__syntheticCapture,options.env.IMPORTPAIRED_NATIVE_MARKER,'snapshot adapter must reach CLI owner');if (owned) ownerCalls++; else bypassCalls++;
            assert.equal(options.env.IMPORTPAIRED_APP_DIR,extraEnv.IMPORTPAIRED_APP_DIR||'/synthetic/root','actual CLI source selection must remain correct');const id = options.env.IMPORTPAIRED_CI_CASE, result = childResult(id);adapters.__output.write(Buffer.from('IMPORT_PAIRED_RESULT '+JSON.stringify(publicChild(id))+'\n')); result.sourceRoot = options.env.IMPORTPAIRED_APP_DIR;
            contents.set(options.env.IMPORTPAIRED_RESULT, JSON.stringify(result)); return ownerPass();
        }
        const fakeModule = { exports: {} }, fakeProcess = { argv: ['/synthetic/node', '/synthetic/runner'], execPath: '/synthetic/node',
            env: { ...env,...extraEnv }, exitCode: 0, on() {}, removeListener() {} };
        function fakeRequire(id) { if (id === 'fs') return fakeFs; if (id === '../owned-rtdb-command.js') return { runOwnedCommand: (opts,adapters) => execute(opts, true,adapters),productionAdapters:()=>({}) }; return require(id); }
        fakeRequire.main = fakeModule;
        const sandbox = { module: fakeModule, exports: fakeModule.exports, require: fakeRequire, __dirname: '/synthetic/root/tools/audit-tools/emu', AbortController, Buffer, TextDecoder,
            process: fakeProcess, fakeSnapshotFeature:{createSnapshotAdapters:(_base,opts)=>fakeCapture(opts),raceSafeSignal:signal=>signal}, bypassOwned: (opts,adapters) => execute(opts, false,adapters), console: { log(line) { if (String(line).startsWith('IMPORT_PAIRED_CI_RESULT ')) finish(JSON.parse(String(line).slice('IMPORT_PAIRED_CI_RESULT '.length))); }, error(line) { finish({ error: String(line) }); } } };
        const begin=original.indexOf('// BEGIN PRIVATE NATIVE SNAPSHOT HOOK'),end=original.indexOf('// END PRIVATE NATIVE SNAPSHOT HOOK');assert(begin>=0&&end>begin);let code=original.slice(0,begin)+'const snapshotFeature=fakeSnapshotFeature;\n'+original.slice(end);code=code.replaceAll('verifySnapshot:readPrivateSnapshot','verifySnapshot:async()=>{}');if(mutated==='NO_ADAPTER'){const needle='IMPORTPAIRED_NATIVE_MARKER:capture.markerPath }, signal:snapshotFeature.raceSafeSignal(signal) },capture.adapters);';assert.equal(code.split(needle).length,2);code=code.replace(needle,'IMPORTPAIRED_NATIVE_MARKER:capture.markerPath }, signal:snapshotFeature.raceSafeSignal(signal) });');}else if(mutated)code=code.replace(marker,'runOwned: bypassOwned');
        new vm.Script(code, { filename: 'actual-runner-cli.js' }).runInNewContext(sandbox);
        const report = await done; return { report, ownerCalls, bypassCalls, exitCode: fakeProcess.exitCode };
    }
    const verify = result => { assert.equal(result.report.status, 'PASS'); assert.equal(result.ownerCalls, 8, 'each actual CLI profile must invoke owned wrapper'); assert.equal(result.bypassCalls, 0); };
    const normal=await exercise(false,{IMPORTPAIRED_BASE_SOURCE:'/synthetic/base'});verify(normal);assert.equal('targetRoot' in normal.report,false,'public report must not expose target path');
    const base=await exercise(false,{IMPORTPAIRED_BASE_SOURCE:'/synthetic/base',IMPORTPAIRED_APP_DIR:'/synthetic/explicit-base'});verify(base);assert.equal('targetRoot' in base.report,false,'public report must not expose target path');
    const noAdapter=await exercise('NO_ADAPTER');assert.equal(noAdapter.report.status,'FAIL','missing snapshot adapter must fail closed');
    const mutant = await exercise(true); assert.equal(mutant.report.status, 'PASS', 'bypass mutant must otherwise look successful');
    assert.throws(() => verify(mutant), /each actual CLI profile must invoke owned wrapper/, 'bypass mutant must fail at owner assertion');
}
async function runSnapshotControls(){

// Actual owned-wrapper entry with fake process and HTTP adapters. All data is
// synthetic; no emulator, PostgreSQL, network or real signal is used. Private
// temp directories are intentionally retained.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert/strict'), Module = require('module'), crypto = require('crypto'), {EventEmitter} = require('events');
const owner = require(path.join(selectedRoot,'tools/audit-tools/owned-rtdb-command.js'));
const { createSnapshotAdapters, writeReceipt, raceSafeSignal, readPrivateSnapshot } = runner;
const PROFILE='I100-cookie-unsigned', CANARY='synthetic-Bearer-do-not-print-549';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paired-snapshot-controls-'));
const fakeOp='scan_'+'a'.repeat(32);
const fakeRoot = { zoew_scan_operations: { [fakeOp]: { id:fakeOp,phase:'committed',count:1 } },
    zoew_scan_history_cod_dod: { 'id_123_abc': { barcodes: { 0: { code:'SYNTHETIC0',cod:1 } } } } };
let serial=0;

function fakeBase(options,calls,stateDir){
 let nextPid=100, engine, identityVersion='original', listener=true, identityReads=0;
 const identity = pid => ({ pid, start: identityVersion, exe:'/synthetic/java',args:['java',...owner.javaArguments('/synthetic/rtdb.jar')] });
 function handle(kind){let finish;const x={kind,child:{pid:++nextPid},spawned:Promise.resolve(),done:false};
  x.exit=new Promise(resolve=>finish=resolve);x.ended=()=>x.done;x.finish=(code=0)=>{x.done=true;finish({code,signal:null,outputPresent:true,failureLine:false,skipLine:false,...(kind==='command'?options.childFields:{})});};return x;}
 const base={validateSource(){},now:Date.now,delay:async()=>{},verifyJar:()=>({jar:'/synthetic/rtdb.jar',sha256:'a'.repeat(64)}),portFree:async()=>{},
  launch:()=>{calls.push('engine-launch');engine=handle('engine');return engine;},
  identity:pid=>{const seen=identity(pid);return options.firstEmpty&&++identityReads===1?{...seen,args:[]}:seen;},ownsListener:()=>listener,readyRead:async()=>true,
  command:()=>{calls.push('command');const child=handle('command');
   let marker={schema:1,profile:PROFILE,pid:child.child.pid,namespace:'paired-import-'+child.child.pid+'-ab12cd34'};
   if(options.marker)marker=options.marker(marker);
   if(!options.noMarker){const target=path.join(stateDir,'native-marker.json');
    if(options.markerSymlink){const foreign=path.join(root,'target-'+(++serial)+'.json');fs.writeFileSync(foreign,JSON.stringify(marker),{mode:0o600,flag:'wx'});fs.symlinkSync(foreign,target);}
    else {const fd=fs.openSync(target,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(marker));if(options.markerMode!==undefined)fs.fchmodSync(fd,options.markerMode);}finally{fs.closeSync(fd);}}}
   if(options.ownerChangeBefore)identityVersion='changed';if(options.listenerGoneBefore)listener=false;
   if(options.abortController)queueMicrotask(()=>options.abortController.abort());else queueMicrotask(()=>child.finish(options.childExit??0));return child;},
  signal:x=>{calls.push('fake-signal-'+x.kind);if(!(options.stuck&&x.kind==='command'))x.finish();},
  within:async(promise,ms,label)=>{if(options.stuck&&label.startsWith('Original checker'))throw new Error('synthetic stuck checker');return promise;}};
 return {base,changeIdentity(){identityVersion='changed';},loseListener(){listener=false;}};
}

async function scenario(name, options={}){
 const stateDir=path.join(root,'case-'+(++serial)),calls=[];let fake;
 if(options.abort)options.abortController=new AbortController();
 const readRoot=async (...args)=>{calls.push('snapshot-read');if(options.beforeRead)options.beforeRead(fake,args);
  if(options.readError)throw new Error(CANARY);if(options.never)return new Promise(()=>{});
  if(options.afterRead)options.afterRead(fake,args);return JSON.stringify(options.root===undefined?fakeRoot:options.root);};
 fake=fakeBase(options,calls,stateDir);
 const snapshot=(options.factory||createSnapshotAdapters)(fake.base,{stateDir,profile:PROFILE,...(options.httpImpl?{httpImpl:options.httpImpl(calls)}:{readRoot}),...(options.io?{io:options.io}:{}),identityMatches:owner.identityMatches,...(options.timeoutMs?{timeoutMs:options.timeoutMs}:{})});
 if(options.prepare){const initial=await snapshot.prepare(),file=path.join(stateDir,'native-snapshot-initial.json'),bytes=fs.readFileSync(file),proof=JSON.parse(bytes);assert.equal(initial.state,'NOT_ATTEMPTED');assert.equal(initial.finality,'UNKNOWN');assert.equal(proof.reason,'CAPTURE_NOT_COMPLETED');assert.equal(fs.statSync(file).mode&0o777,0o600);assert.equal(initial.receiptSha256,crypto.createHash('sha256').update(bytes).digest('hex'));await assert.rejects(snapshot.prepare());}
 const result=await owner.runOwnedCommand({stateDir,args:['node','synthetic-checker','--matrix=core','--provider=both','--case='+PROFILE],env:{RUNALL_STRICT:'1'},signal:raceSafeSignal(options.abortController?.signal)},snapshot.adapters);
 const receipt=snapshot.getReceipt(), receiptFile=path.join(stateDir,'native-snapshot.json');
 assert(receipt,'every completed child must report receipt status');
 if(options.expectReceipt===false)assert.equal(fs.existsSync(receiptFile),false,'unwritten receipt must not be claimed');
 else{assert(fs.existsSync(receiptFile),'private receipt required');assert.equal(fs.statSync(receiptFile).mode&0o777,0o600,'private receipt must be 0600');}
 const publicText=JSON.stringify({result,receipt});
 if(options.privateCanary)assert(!publicText.includes(CANARY),'public summary must not expose private canary');
 if(options.expectPass){assert.equal(result.code,0,name);assert.equal(receipt.state,'OBSERVED_POINT_IN_TIME_ONLY',name);assert(calls.indexOf('snapshot-read')<calls.indexOf('fake-signal-engine'),'snapshot must precede fake JVM stop');}
 else if(options.expectAbort){assert.notEqual(result.code,0,name);assert.equal(receipt.state,'OBSERVED_POINT_IN_TIME_ONLY',name);assert(calls.indexOf('fake-signal-command')<calls.indexOf('snapshot-read'));assert(calls.indexOf('snapshot-read')<calls.indexOf('fake-signal-engine'));}
 else if(options.expectedChildFailure){assert.notEqual(result.code,0,name);assert.equal(receipt.state,'OBSERVED_POINT_IN_TIME_ONLY',name);assert.equal(result.report.childResult.error,'CHILD_PROCESS_ERROR',name);}
 else {assert.notEqual(result.code,0,name);assert.equal(receipt.state,'UNREADABLE',name);assert.equal(result.report.childResult.failureLine,true,name);}
 if(options.noRead)assert(!calls.includes('snapshot-read'),name+': unsafe marker/owner must prevent read');
 return {result,receipt,calls,stateDir,receiptFile};
}
function receiptIo(kind){return {lstat:(...args)=>fs.promises.lstat(...args),open:async(file,...args)=>{
 if(file.endsWith('native-snapshot.json')&&kind==='hang')return new Promise(()=>{});
 const handle=await fs.promises.open(file,...args);if(!file.endsWith('native-snapshot.json')||kind!=='mode-after')return handle;
 let calls=0;return new Proxy(handle,{get(target,key){if(key==='stat')return async()=>{const stat=await target.stat();if(++calls===1)return stat;return {isFile:()=>stat.isFile(),mode:(stat.mode&~0o777)|0o644,uid:stat.uid,size:stat.size};};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}};}
function fakeHttp(kind, inspect){
 let destroyed=0;
 const factory=calls=>({request(options, respond){
  calls.push('snapshot-read');inspect.options=options;
  const req=new EventEmitter();req.destroy=()=>{destroyed++;};
  req.end=()=>queueMicrotask(()=>{
   if(kind==='hang')return;
   if(kind==='error'){req.emit('error',new Error(CANARY));return;}
   const res=new EventEmitter();res.statusCode=kind==='refused'?403:200;respond(res);
   if(kind==='aborted'){res.emit('aborted');return;}
   if(kind==='tiny-chunks'){res.emit('data',Buffer.from('null'));const small=Buffer.alloc(64,32);for(let i=0;i<65535;i++)res.emit('data',small);res.emit('data',Buffer.alloc(60,32));}
   else if(kind==='boundary'){res.emit('data',Buffer.from('null'));res.emit('data',Buffer.alloc(4*1024*1024-4,32));}
   else if(kind==='over-multi'){res.emit('data',Buffer.from('null'));res.emit('data',Buffer.alloc(4*1024*1024-4,32));res.emit('data',Buffer.from(' '));res.emit('data',Buffer.from('ignored after overflow'));}
   else if(kind==='split-utf8'){const bytes=Buffer.from('{\"é\":1}');const i=bytes.indexOf(0xc3);res.emit('data',bytes.subarray(0,i+1));res.emit('data',bytes.subarray(i+1));}
   else if(kind==='split-invalid'){res.emit('data',Buffer.from([0xc3]));res.emit('data',Buffer.from([0x28]));}
   else if(kind==='large')res.emit('data',Buffer.alloc(4*1024*1024+1,120));
   else if(kind==='invalidutf8')res.emit('data',Buffer.from([0xc3,0x28]));
   else res.emit('data',Buffer.from(JSON.stringify(fakeRoot)));
   res.emit('end');
  });return req;
 }});
 factory.destroyed=()=>destroyed;return factory;
}
function loadMutant(before,after){
 const filename=path.join(selectedRoot,'tools/audit-tools','emu','import-paired-ci-runner.js'),whole=fs.readFileSync(filename,'utf8'),start=whole.indexOf('// BEGIN PRIVATE NATIVE SNAPSHOT HOOK'),end=whole.indexOf('// END PRIVATE NATIVE SNAPSHOT HOOK');assert(start>=0&&end>start);const source=whole.slice(start,end)+'\nmodule.exports=snapshotFeature;',parts=source.split(before);
 assert.equal(parts.length,2,'exactly one intentional mutant target required');const mutant=new Module(filename,module);
 mutant.filename=filename;mutant.paths=Module._nodeModulePaths(path.dirname(filename));mutant._compile(parts.join(after),filename);return mutant.exports.createSnapshotAdapters;
}
function loadClockedSnapshot(){
 const filename=path.join(selectedRoot,'tools/audit-tools','emu','import-paired-ci-runner.js'),whole=fs.readFileSync(filename,'utf8'),start=whole.indexOf('// BEGIN PRIVATE NATIVE SNAPSHOT HOOK'),end=whole.indexOf('// END PRIVATE NATIVE SNAPSHOT HOOK');assert(start>=0&&end>start);
 let now=0,next=0;const timers=new Map(),scheduled=[],clockModule={exports:{}};
 new vm.Script(whole.slice(start,end)+'\nmodule.exports=snapshotFeature;',{filename}).runInNewContext({module:clockModule,Buffer,process,
  require:id=>id==='perf_hooks'?{performance:{now:()=>now}}:require(id),
  setTimeout(callback,ms){const id=++next;timers.set(id,{at:now+ms,callback});scheduled.push(ms);return id;},clearTimeout:id=>timers.delete(id)});
 return {factory:clockModule.exports.createSnapshotAdapters,scheduled,now:()=>now,pending:()=>timers.size,
  fireReadDeadline(){assert.equal(timers.size,1,'only the unsettled read timer may remain');const [id,timer]=timers.entries().next().value;assert.equal(timer.at,75,'read gets 75ms of the unchanged 100ms budget');timers.delete(id);now=timer.at;timer.callback();}};
}

async function main(){
 await scenario('argv ទទេដំបូង មិនចាក់សោ snapshot លើ identity ចាស់',{firstEmpty:true,expectPass:true});
 await scenario('snapshot និង owner ដាច់ពី callback argument ដែលបានកែ',{expectPass:true,factory(base,options){
  const snapshot=createSnapshotAdapters(base,options),accept=snapshot.adapters.ownerAcquired;
  snapshot.adapters.ownerAcquired=identity=>{accept(identity);identity.start='changed';identity.args[1]='changed';};return snapshot;
 }});
 await scenario('គ្មាន ownership callback មិនអាច snapshot',{noRead:true,factory(base,options){
  const snapshot=createSnapshotAdapters(base,options);delete snapshot.adapters.ownerAcquired;return snapshot;
 }});
 {
  const calls=[],stateDir=path.join(root,'handoff-'+(++serial)),fake=fakeBase({},calls,stateDir),snapshot=createSnapshotAdapters(fake.base,{stateDir,profile:PROFILE,readRoot:async()=>JSON.stringify(fakeRoot)});
  assert.throws(()=>snapshot.adapters.ownerAcquired({pid:101,args:[]}),/OWNER_UNPROVEN/);
  const engine=snapshot.adapters.launch();await engine.spawned;
  const identity=fake.base.identity(engine.child.pid);
  for(const value of [{...identity,args:[]},{...identity,pid:identity.pid+1},{...identity,start:'changed'}])assert.throws(()=>snapshot.adapters.ownerAcquired(value),/OWNER_UNPROVEN/);
  snapshot.adapters.ownerAcquired(identity);assert.throws(()=>snapshot.adapters.ownerAcquired(identity),/OWNER_UNPROVEN/);
 }
 {const c=new AbortController();c.abort();let n=0;raceSafeSignal(c.signal).addEventListener('abort',()=>n++,{once:true});assert.equal(n,1,'already-aborted signal must be delivered');}
 {let wrapped,aborted=false,n=0;const raw={get aborted(){return aborted;},addEventListener(_type,fn){wrapped=fn;aborted=true;fn({type:'abort'});},removeEventListener(){}};raceSafeSignal(raw).addEventListener('abort',()=>n++,{once:true});wrapped({type:'abort'});assert.equal(n,1,'registration-race abort delivered exactly once');}
 {const c=new AbortController(),safe=raceSafeSignal(c.signal);let n=0;safe.addEventListener('abort',()=>n++,{once:true});c.abort();c.abort();assert.equal(n,1,'later abort delivered exactly once');}
 {
  const observed=await scenario('valid synthetic observation',{expectPass:true}),bytes=fs.readFileSync(observed.receiptFile),proof=JSON.parse(bytes),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
  const capture={receiptPath:observed.receiptFile,markerPath:path.join(observed.stateDir,'native-marker.json')};await readPrivateSnapshot(capture,observed.receipt,PROFILE);
  await assert.rejects(readPrivateSnapshot(capture,{...observed.receipt,receiptSha256:'0'.repeat(64)},PROFILE));
  const altered={...proof,summary:{...proof.summary,operationCount:999}},alteredBytes=Buffer.from(JSON.stringify(altered)+'\n'),alteredPath=path.join(observed.stateDir,'altered-proof.json');fs.writeFileSync(alteredPath,alteredBytes,{mode:0o600,flag:'wx'});
  await assert.rejects(readPrivateSnapshot({...capture,receiptPath:alteredPath},{...observed.receipt,receiptSha256:sha(alteredBytes)},PROFILE));
  assert.equal(observed.receipt.receiptSha256,sha(bytes));assert.equal(proof.state,'OBSERVED_POINT_IN_TIME_ONLY');assert.equal(proof.finality,'UNKNOWN');assert.equal(proof.lateEffects,'POSSIBLE');
  assert.equal(proof.summary.operationCount,1);assert.equal(proof.summary.operations[0].phase,'committed');assert.equal(proof.summary.operations[0].idSha256,sha(fakeOp));
  assert.equal(proof.summary.operations[0].valueSha256,sha(JSON.stringify(fakeRoot.zoew_scan_operations[fakeOp])));
 }
 {
  const pending=await scenario('valid pending operation remains visible',{expectPass:true,root:{...fakeRoot,zoew_scan_pending:{[fakeOp]:'import-owner'}}});
  const proof=JSON.parse(fs.readFileSync(pending.receiptFile,'utf8'));assert.equal(proof.root.zoew_scan_pending[fakeOp],'import-owner');assert.equal(proof.finality,'UNKNOWN');
 }
 {const empty=await scenario('empty root remains observation',{expectPass:true,root:null});const proof=JSON.parse(fs.readFileSync(empty.receiptFile,'utf8'));assert.equal(proof.summary.operationStatus,'UNAVAILABLE_ROOT_EMPTY');assert.equal(proof.summary.operationCount,null);assert.equal(proof.checker.code,0);assert.equal(proof.checker.signal,null);}
 {const empty=await scenario('missing operation index is unavailable',{expectPass:true,root:{zoew_daily_revenue_cod_dod:{}}});const proof=JSON.parse(fs.readFileSync(empty.receiptFile,'utf8'));assert.equal(proof.summary.operationStatus,'UNAVAILABLE_NO_INDEX');assert.equal(proof.summary.operationCount,null);}
 {const aborted=await scenario('mid-flight abort snapshots after child TERM and before JVM stop',{prepare:true,abort:true,expectAbort:true});assert.equal(aborted.result.report.cleanup,true);}
 {const stuck=await scenario('stuck child is snapshotted but cleanup stays unknown',{abort:true,stuck:true,expectAbort:true});assert.equal(stuck.result.report.cleanup,false);assert(fs.existsSync(path.join(stuck.stateDir,'blocked.json')));const proof=JSON.parse(fs.readFileSync(stuck.receiptFile,'utf8'));assert.equal(proof.checker.code,null);assert.equal(proof.finality,'UNKNOWN');}
 await scenario('missing marker',{noMarker:true,noRead:true});
 await scenario('wrong profile',{marker:m=>({...m,profile:'I100-palm-signed'}),noRead:true});
 await scenario('wrong child pid',{marker:m=>({...m,pid:m.pid+1}),noRead:true});
 await scenario('wrong namespace pid',{marker:m=>({...m,namespace:'paired-import-987654-ab12cd34'}),noRead:true});
 await scenario('namespace injection',{marker:m=>({...m,namespace:m.namespace+'?ns=other'}),noRead:true});
 await scenario('wrong marker schema',{marker:m=>({...m,schema:2}),noRead:true});
 await scenario('extra marker field',{marker:m=>({...m,extra:'unexpected'}),noRead:true});
 await scenario('marker mode 0644',{markerMode:0o644,noRead:true});
 await scenario('symlink marker',{markerSymlink:true,noRead:true});
 await scenario('owner differs before read',{ownerChangeBefore:true,noRead:true});
 await scenario('listener absent before read',{listenerGoneBefore:true,noRead:true});
 await scenario('owner changes during read',{beforeRead:fake=>fake.changeIdentity(),noRead:false});
 await scenario('owner changes after read',{afterRead:fake=>fake.changeIdentity()});
 await scenario('listener disappears after read',{afterRead:fake=>fake.loseListener()});
 await scenario('read throws canary',{readError:true,privateCanary:true});
 await scenario('malformed root',{root:'synthetic-unexpected-scalar'});
 await scenario('non-synthetic barcode',{root:{zoew_scan_operations:{[fakeOp]:{code:'NOT_SYNTHETIC'}}},privateCanary:true});
 await scenario('non-synthetic phone',{root:{zoew_scan_operations:{[fakeOp]:{phone:'011000000'}}},privateCanary:true});
 await scenario('numeric phone refused',{root:{zoew_scan_operations:{[fakeOp]:{phone:12345678}}},privateCanary:true});
 await scenario('numeric barcode refused',{root:{zoew_scan_operations:{[fakeOp]:{barcode:42}}},privateCanary:true});
 await scenario('credential key',{root:{zoew_scan_operations:{[fakeOp]:{api_key:CANARY}}},privateCanary:true});
 await scenario('bearer credential',{root:{zoew_scan_operations:{[fakeOp]:{time:'Bearer '+CANARY}}},privateCanary:true});
 await scenario('unknown personal field',{root:{zoew_scan_operations:{[fakeOp]:{customerName:'CANARY_PRIVATE_PERSON'}}},privateCanary:true});
 await scenario('camel-case credential field',{root:{zoew_scan_operations:{[fakeOp]:{apiKey:'CANARY_PRIVATE_KEY'}}},privateCanary:true});
 await scenario('negative amount',{root:{zoew_scan_operations:{[fakeOp]:{cod:-1}}},privateCanary:true});
 await scenario('text numeric amount',{root:{zoew_scan_operations:{[fakeOp]:{cod:'1'}}},privateCanary:true});
 await scenario('fractional count',{root:{zoew_scan_operations:{[fakeOp]:{count:1.5}}},privateCanary:true});
 await scenario('numeric boolean',{root:{zoew_scan_operations:{[fakeOp]:{isClosed:1}}},privateCanary:true});
 await scenario('foreign scope',{root:{zoew_scan_operations:{[fakeOp]:{scope:'http://127.0.0.1:9000/?ns=paired-import-999-aaaaaaaa'}}},privateCanary:true});
 {
  // Only snapshot time is virtual; private receipt I/O and the outer watchdog remain real.
  const clock=loadClockedSnapshot();let entered,readReached=false,receiptDelay=0;const readEntered=new Promise(resolve=>entered=resolve),realNow=require('perf_hooks').performance.now.bind(require('perf_hooks').performance);
  const io={lstat:(...args)=>fs.promises.lstat(...args),open:async(file,...args)=>{
   if(file.endsWith('native-snapshot.json')){const began=realNow();await new Promise(resolve=>setTimeout(resolve,50));receiptDelay=realNow()-began;}
   return fs.promises.open(file,...args);
  }};
  const pending=scenario('unsettled synthetic read',{factory:clock.factory,io,never:true,timeoutMs:100,privateCanary:true,beforeRead(){readReached=true;entered();}});
  await Promise.race([readEntered,pending]);assert.equal(readReached,true,'the intended unsettled read must be reached');clock.fireReadDeadline();const timed=await pending;
  assert.equal(timed.receipt.reason,'SNAPSHOT_TIMEOUT');assert.equal(timed.receipt.receipt,'PRIVATE_0600');
  const timeoutFile=JSON.parse(fs.readFileSync(timed.receiptFile,'utf8'));assert.equal(timeoutFile.state,'UNREADABLE');assert.equal(timeoutFile.reason,'SNAPSHOT_TIMEOUT');assert(!JSON.stringify(timeoutFile).includes(CANARY));
  assert.deepEqual(clock.scheduled,[75,75,75,25],'read deadline and remaining receipt budget stay unchanged');assert(receiptDelay>25,'real receipt I/O must outlast the virtual remaining budget');assert.equal(clock.now(),75);assert.equal(clock.pending(),0,'completed snapshot must clear every timer');
 }
 {
  const inspect={},httpImpl=fakeHttp('ok',inspect);await scenario('bounded fake HTTP',{httpImpl,expectPass:true});
  assert.equal(inspect.options.hostname,'127.0.0.1');assert.equal(inspect.options.port,9000);assert.equal(inspect.options.method,'GET');assert.equal(inspect.options.agent,false);
  assert.match(inspect.options.path,/^\/\.json\?ns=paired-import-[1-9][0-9]*-ab12cd34$/);assert.equal(inspect.options.headers.Authorization,'Bearer owner');
 }
 {
  const counted=loadMutant('root=JSON.parse(raw)', 'root=(global.__syntheticParseCount++,JSON.parse(raw))');
  for(const [kind,expected,passes] of [['tiny-chunks',1,true],['boundary',1,true],['over-multi',0,false],['large',0,false],['split-invalid',0,false],['split-utf8',1,false]]){
   global.__syntheticParseCount=0;const info={},httpImpl=fakeHttp(kind,info);
   const out=await scenario('byte-boundary '+kind,{factory:counted,httpImpl,expectPass:passes,privateCanary:true});
   assert.equal(global.__syntheticParseCount,expected,kind+' parse reachability');
   if(kind==='over-multi'||kind==='large'){assert.equal(out.receipt.reason,'ROOT_TOO_LARGE');assert(httpImpl.destroyed()>0);}
   if(kind==='split-invalid')assert.equal(out.receipt.reason,'READ_ENCODING');
   if(kind==='split-utf8')assert.notEqual(out.receipt.reason,'READ_ENCODING');
  }
  delete global.__syntheticParseCount;
 }
 for(const kind of ['refused','error','aborted','large','invalidutf8']){const info={},httpImpl=fakeHttp(kind,info);const outcome=await scenario('fake HTTP '+kind,{httpImpl,privateCanary:true});assert.equal(outcome.receipt.state,'UNREADABLE');if(kind==='invalidutf8')assert.equal(outcome.receipt.reason,'READ_ENCODING');}
 {
  const info={},httpImpl=fakeHttp('hang',info),outcome=await scenario('fake HTTP timeout',{httpImpl,timeoutMs:150,privateCanary:true});
  assert.equal(outcome.receipt.state,'UNREADABLE');await new Promise(resolve=>setTimeout(resolve,50));assert(httpImpl.destroyed()>0,'timed-out request must be aborted');
 }
 {
  const oldMask=process.umask(0o200);
  try{await assert.rejects(writeReceipt(path.join(root,'restrictive-umask.json'),{state:'UNREADABLE',reason:'SYNTHETIC'}),'non-0600 mode must not claim PRIVATE_0600');}
  finally{process.umask(oldMask);}
 }
 {
  const outcome=await scenario('receipt mode changed during write',{io:receiptIo('mode-after')});assert.equal(outcome.receipt.reason,'RECEIPT_WRITE_FAILED');assert.equal(outcome.receipt.receipt,'UNKNOWN');
 }
 {
  const outcome=await scenario('receipt sink hangs',{io:receiptIo('hang'),timeoutMs:100,expectReceipt:false});assert.equal(outcome.receipt.reason,'RECEIPT_TIMEOUT');assert.equal(outcome.receipt.receipt,'UNKNOWN');
 }
 {
  const outcome=await scenario('child error sanitized',{childFields:{error:CANARY,privateExtra:CANARY},expectedChildFailure:true,privateCanary:true});assert.equal(outcome.result.report.childResult.error,'CHILD_PROCESS_ERROR');
 }
 await scenario('child extra property stripped',{childFields:{privateExtra:CANARY},expectPass:true,privateCanary:true});
 {const result=await scenario('child nonzero status preserved',{childExit:19,childFields:{error:CANARY},expectedChildFailure:true,privateCanary:true});const proof=JSON.parse(fs.readFileSync(result.receiptFile,'utf8'));assert.equal(proof.checker.code,19);assert.equal(proof.checker.error,'CHILD_PROCESS_ERROR');assert.equal(proof.finality,'UNKNOWN');}
 {const result=await scenario('child signal preserved',{childFields:{code:null,signal:'SIGTERM',error:CANARY},expectedChildFailure:true,privateCanary:true});const proof=JSON.parse(fs.readFileSync(result.receiptFile,'utf8'));assert.equal(proof.checker.code,null);assert.equal(proof.checker.signal,'SIGTERM');assert.equal(proof.finality,'UNKNOWN');}
 {
  const factory=loadMutant("if(typeof value.namespace!=='string'||!new RegExp('^paired-import-'+String(pid)+'-[a-f0-9]{8}$').test(value.namespace))throw reason('MARKER_MISMATCH');",'');
  await assert.rejects(scenario('namespace mutant',{factory,marker:m=>({...m,namespace:'paired-import-987654-ab12cd34'}),noRead:true}),/namespace mutant/);
 }
 {
  const factory=loadMutant("status.failureLine||lastReceipt.state!=='OBSERVED_POINT_IN_TIME_ONLY'","status.failureLine");
  await assert.rejects(scenario('failure-line mutant',{factory,noMarker:true,noRead:true}),/failure-line mutant/);
 }
 {
  const factory=loadMutant("checkOwner();let root;",'let root;');
  await assert.rejects(scenario('post-read identity mutant',{factory,afterRead:fake=>fake.changeIdentity()}),/post-read identity mutant/);
 }
 {
  const factory=loadMutant('const handle=await io.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);','const handle=await io.open(file,fs.constants.O_RDONLY);');
  await assert.rejects(scenario('symlink mutant',{factory,markerSymlink:true,noRead:true}),/symlink mutant/);
 }
 console.log(JSON.stringify({status:'PASS',cases:64,mutants:4,scope:'actual owned wrapper with fake process/HTTP adapters; no backend, network or real signals; synthetic files retained'}));
}
let controlDeadline;try{await Promise.race([main(),new Promise((_,reject)=>{controlDeadline=setTimeout(()=>reject(new Error('synthetic snapshot controls did not complete')),5000);})]);}finally{clearTimeout(controlDeadline);}

}
async function testActualNativeCliContract(){
 const filename=path.join(selectedRoot,'tools/audit-tools','emu','import-paired-ci-runner.js'),original=fs.readFileSync(filename,'utf8'),id=runner.PROFILES[0],rules=Buffer.from('synthetic-rules'),ruleSha=require('crypto').createHash('sha256').update(rules).digest('hex');
 async function run(kind){let resolveDone;const done=new Promise(r=>resolveDone=r),files=new Map(),fds=new Map();let next=3,ownerCalls=0;
  const fakeFs={constants:fs.constants,mkdtempSync:()=>'/synthetic/private',lstatSync:()=>({isDirectory:()=>true,isSymbolicLink:()=>false,mode:0o700}),statfsSync:()=>({bavail:runner.MIN_FREE_BYTES,bsize:1n}),
   writeFileSync(file,data,opts){assert.equal(opts.mode,0o600);assert.equal(opts.flag,'wx');files.set(file,data);},
   openSync(file){assert(files.has(file));const fd=next++;fds.set(fd,files.get(file));return fd;},fstatSync(fd){return {isFile:()=>true,size:Buffer.byteLength(fds.get(fd))};},
   readFileSync(file){return typeof file==='string'?rules:fds.get(file);},closeSync(fd){fds.delete(fd);}};
  const p={argv:['/synthetic/node','/synthetic/runner','--case='+id,'--provider=native'],execPath:'/synthetic/node',env:{...env,IMPORTPAIRED_OWNER_STATE:'/synthetic/shared-owner'},exitCode:0,on(){},removeListener(){}};
  async function owned(request,adapters){ownerCalls++;assert.equal(request.stateDir,'/synthetic/shared-owner');assert.equal(request.env.IMPORTPAIRED_CI_PROVIDER,'native');assert.equal(request.env.IMPORTPAIRED_NATIVE_MARKER,'/synthetic/private/'+id+'-capture/native-marker.json');
   if(kind==='missing-result')return ownerPass();
   const v=childResult(id);v.schema=1;v.providerSelection='native';v.caseSelection=id;v.crossProviderParity='UNRUN_SINGLE_PROVIDER';v.status='NATIVE_ONLY_CORE';v.unrunProviders=['sql'];v.caseLedger=[{provider:'native',id,status:'PASS'}];v.cases=v.cases.filter(x=>x.provider==='native');v.providerEvidence=[v.providerEvidence[0]];v.providerEvidence[0].provenance={ruleLoads:1,ruleSha256:ruleSha,ns:'paired-import-123-aaaaaaaa'};v.sourceRoot=request.env.IMPORTPAIRED_APP_DIR;
   const summary={schema:1,status:v.status,caseSelection:id,sourceBundleSha256:v.sourceBundleSha256,instrumentedBundleSha256:v.instrumentedBundleSha256,caseLedger:v.caseLedger,unrunProviders:v.unrunProviders,cleanup:v.cleanup,vmConsole:v.vmConsole};adapters.__output.write(Buffer.from('IMPORT_PAIRED_RESULT '+JSON.stringify(summary)+'\n'));files.set(request.env.IMPORTPAIRED_RESULT,JSON.stringify(v));return ownerPass();}
  if(kind==='missing-owner')delete p.env.IMPORTPAIRED_OWNER_STATE;
  const fakeModule={exports:{}};function fakeRequire(name){if(name==='fs')return fakeFs;if(name==='../owned-rtdb-command.js')return {runOwnedCommand:owned,productionAdapters:()=>({})};return require(name);}fakeRequire.main=fakeModule;
  const sandbox={module:fakeModule,exports:fakeModule.exports,require:fakeRequire,__dirname:'/synthetic/root/tools/audit-tools/emu',AbortController,Buffer,TextDecoder,process:p,
   fakeSnapshotFeature:{createSnapshotAdapters:(_base,opts)=>fakeCapture(opts),raceSafeSignal:signal=>signal},console:{log(v){if(String(v).startsWith('IMPORT_PAIRED_CI_RESULT '))resolveDone(JSON.parse(String(v).slice('IMPORT_PAIRED_CI_RESULT '.length)));},error(v){resolveDone({error:String(v)});}}};
  const begin=original.indexOf('// BEGIN PRIVATE NATIVE SNAPSHOT HOOK'),end=original.indexOf('// END PRIVATE NATIVE SNAPSHOT HOOK');let code=original.slice(0,begin)+'const snapshotFeature=fakeSnapshotFeature;\n'+original.slice(end);code=code.replaceAll('verifySnapshot:readPrivateSnapshot',"verifySnapshot:async()=>'paired-import-123-aaaaaaaa'");
  new vm.Script(code,{filename:'native-actual-cli.js'}).runInNewContext(sandbox);return {report:await done,ownerCalls};}
 const ok=await run('pass');assert.equal(ok.report.status,'PASS');assert.equal(ok.report.scope,'NATIVE_ONLY');assert.equal(ok.report.sql,'UNRUN');assert.equal(ok.report.crossProviderParity,'UNRUN_SINGLE_PROVIDER');assert.equal(ok.ownerCalls,1);
 const missing=await run('missing-result');assert.equal(missing.report.status,'FAIL');assert.equal(missing.report.profiles[0].outcome,'UNKNOWN');assert.equal(missing.report.sql,'UNRUN');assert.equal(missing.ownerCalls,1);
 const state=await run('missing-owner');assert.equal(state.report.status,'FAIL');assert.equal(state.report.profiles[0].outcome,'UNKNOWN');assert.equal(state.report.profiles[0].phase,'PREFLIGHT');assert.equal(state.report.profiles[0].category,'PREFLIGHT_FAILED');assert.equal(state.report.nativeRulesSha256,null);assert.equal(state.report.nativeRulesHashStatus,'UNAVAILABLE');assert.equal(state.report.emulatorJarHashStatus,'UNAVAILABLE');assert.equal(state.report.sql,'UNRUN');assert.equal(state.report.crossProviderParity,'UNRUN_SINGLE_PROVIDER');assert.equal(state.ownerCalls,0);
}
async function testFailureDiagnostics(){
 const id='I100-palm-signed',target='/synthetic/target',secret='synthetic-private-diagnostic-canary',hash='a'.repeat(64);
 const result={schema:1,status:'FAIL',sourceRoot:target,caseSelection:id,providerSelection:'native',unrunProviders:['sql'],declared:[id],caseLedger:[{provider:'native',id,status:'FAIL'}],error:'Error: ពេលកំណត់៖ '+id+' all100 authoritative origins\n    at until (/synthetic/tools/audit-tools/emu/import-paired-sdk-test.js:24:41)\n    at arbitrary ('+secret+')'};
 const ownerResult={code:1,report:{status:'FAIL',cleanup:true,commandStarted:true,commandCompleted:true,owner:{jarSHA256:hash},errors:[secret],childResult:{code:1,signal:null,outputPresent:true,failureLine:true,skipLine:false,nativeSnapshot:{state:'OBSERVED_POINT_IN_TIME_ONLY',reason:secret,receipt:'PRIVATE_0600',receiptSha256:hash}}}};
 function opts(){let reads=0;const o=structuredClone(ownerResult),child=structuredClone(result);return {o,child,getReads:()=>reads,args:{id,runOwned:async()=>o,getDiskFree:()=>runner.MIN_FREE_BYTES,readRulesHash:()=>hash,readChild:async()=>{throw Error('unexpected success read');},readFailure:async()=>{reads++;return child;},makeSnapshot:fakeCapture,verifySnapshot:async()=>{throw Error('failed owner must not pass');},env,root:'/synthetic/root',targetRoot:target,evidenceDir:'/synthetic/private',ownerState:'/synthetic/owner',node:'/synthetic/node',checker:'/synthetic/checker'}};}
 const x=opts(),r=runner.publicReport(await runner.runNativeProfile(x.args)),d=r.profiles[0];assert.equal(r.status,'FAIL');assert.equal(d.outcome,'UNKNOWN');assert.equal(r.sql,'UNRUN');assert.equal(d.ownerDiagnostic.status,'FAIL');assert.equal(d.ownerDiagnostic.cleanup,'WRAPPER_CONFIRMED');assert.equal(d.ownerDiagnostic.childCode,1);assert.equal(d.ownerDiagnostic.snapshot,'OBSERVED_POINT_IN_TIME_ONLY');assert.equal(d.ownerDiagnostic.snapshotReason,null);assert.equal(d.childDiagnostic.category,'WAIT_TIMEOUT_REPORTED');assert.equal(d.childDiagnostic.wait,'ORIGINS_ACK_FENCE');assert.deepEqual(d.childDiagnostic.location,{file:'import-paired-sdk-test.js',function:'until'});assert.equal(x.getReads(),1);assert(!JSON.stringify(r).includes(secret));assert(!JSON.stringify(r).includes('/synthetic'));
 for(const mutate of [v=>v.o.report.cleanup=false,v=>v.o.report.commandCompleted=false,v=>v.o.report.childResult.code=0,v=>v.o.report.childResult.signal='SIGTERM',v=>v.o.report.childResult.error=secret]){const y=opts();mutate(y);const q=runner.publicReport(await runner.runNativeProfile(y.args));assert.equal(q.status,'FAIL');assert.equal(q.profiles[0].childDiagnostic,null);assert.equal(y.getReads(),0);}
 for(const mutate of [v=>v.child.caseSelection='I100-cookie-signed',v=>v.child.sourceRoot='/foreign',v=>v.child.providerSelection='sql',v=>v.child.status='PASS',v=>v.child.caseLedger[0].status='PASS',v=>v.child.unrunProviders=[]]){const y=opts();mutate(y);const q=runner.publicReport(await runner.runNativeProfile(y.args));assert.equal(q.status,'FAIL');assert.equal(q.profiles[0].childDiagnostic,null);}
 const y=opts();y.child.error='Error: '+secret+'\n    at '+secret+' (/tmp/'+secret+':22:9)';const q=runner.publicReport(await runner.runNativeProfile(y.args));assert.equal(q.profiles[0].childDiagnostic.category,'OTHER_REPORTED');assert.equal(q.profiles[0].childDiagnostic.location,null);assert(!JSON.stringify(q).includes(secret));
 const startup=structuredClone(result);startup.caseLedger[0].status='UNRUN';startup.unrunProviders=['native','sql'];assert.equal(runner.childFailureProjection(startup,id,target).ledger,'UNRUN');const invalidStartup=structuredClone(startup);invalidStartup.unrunProviders=['sql'];assert.throws(()=>runner.childFailureProjection(invalidStartup,id,target));const invalidFail=structuredClone(result);invalidFail.unrunProviders=['native','sql'];assert.throws(()=>runner.childFailureProjection(invalidFail,id,target));
 const numeric=structuredClone(result);numeric.error='Error: '+secret+'\n    at until (/synthetic/tools/audit-tools/emu/import-paired-sdk-test.js:867530:4137)';const numericResult=runner.childFailureProjection(numeric,id,target);assert.deepEqual(numericResult.location,{file:'import-paired-sdk-test.js',function:'until'});assert(!JSON.stringify(numericResult).includes('867530'));assert(!JSON.stringify(numericResult).includes('4137'));
 const forgedFrame=structuredClone(result);forgedFrame.error='Error: '+secret+'\n    at untilForged (/synthetic/tools/audit-tools/emu/import-paired-sdk-test.js:12:1)';assert.equal(runner.childFailureProjection(forgedFrame,id,target).location,null);
 const forgedLocation=runner.projectChildFailure({evidence:'PRIVATE_CHILD_REPORTED',ledger:'FAIL',category:'OTHER_REPORTED',wait:null,location:{file:'import-paired-sdk-test.js',function:'until',line:867530,column:4137}});assert.deepEqual(forgedLocation.location,{file:'import-paired-sdk-test.js',function:'until'});assert(!JSON.stringify(forgedLocation).includes('867530'));
 const spoof=structuredClone(result);spoof.error+=' '+secret;assert.equal(runner.childFailureProjection({...spoof,error:'Error: ពេលកំណត់៖ '+id+' all100 authoritative origins '+secret},id,target).wait,null);
 const forged=runner.publicReport({status:'FAIL',scope:'NATIVE_ONLY',profiles:[{id,status:'FAIL',ownerDiagnostic:{status:secret,snapshotReason:secret},childDiagnostic:{evidence:'PRIVATE_CHILD_REPORTED',ledger:secret,category:secret,wait:secret,location:{file:secret,function:secret,line:24,column:8}}}]});assert(!JSON.stringify(forged).includes(secret));
 const aggregateCounts={historyGroups:8,historyBarcodes:99,historyUniqueBarcodes:99,registryEntries:99,operationsAdmitted:1,operationsPrepared:0,operationsCommitted:99,operationsCancelled:0,operationsOther:0,journalStorageKeys:1,capturedEvents:0,pendingJournalOperations:null};
 const aggregate={schema:1,evidence:'PRIVATE_CHILD_REPORTED',availability:'AVAILABLE',consistency:'POST_TIMEOUT_NONATOMIC',case:'I100-cookie-unsigned',phase:'FIRST_IMPORT',error:'AUTHORITATIVE_100_TIMEOUT',counts:aggregateCounts};
 const aggregateResult={...structuredClone(result),caseSelection:'I100-cookie-unsigned',declared:['I100-cookie-unsigned'],caseLedger:[{provider:'native',id:'I100-cookie-unsigned',status:'FAIL'}],error:'Error: ពេលកំណត់៖ I100-cookie-unsigned authoritative100',failureAggregate:aggregate};
 const aggregateProjected=runner.childFailureProjection(aggregateResult,'I100-cookie-unsigned',target);assert.deepEqual(aggregateProjected.aggregate,aggregate);assert.deepEqual(runner.projectChildFailure(aggregateProjected,'I100-cookie-unsigned').aggregate,aggregate);assert.equal(aggregateProjected.ledger,'FAIL');assert.equal(aggregateProjected.wait,'AUTHORITATIVE_100');
 const emptyAggregate={...aggregate,counts:{...aggregateCounts,historyGroups:0,historyBarcodes:0,historyUniqueBarcodes:0,registryEntries:0,operationsAdmitted:0,operationsPrepared:0,operationsCommitted:0,operationsCancelled:0,operationsOther:0}};assert.deepEqual(runner.projectFailureAggregate(emptyAggregate),emptyAggregate);
 const duplicate101={...aggregate,counts:{...aggregateCounts,historyBarcodes:101,historyUniqueBarcodes:100,registryEntries:100}};assert.deepEqual(runner.projectFailureAggregate(duplicate101),duplicate101);assert.deepEqual(runner.childFailureProjection({...aggregateResult,failureAggregate:duplicate101},'I100-cookie-unsigned',target).aggregate,duplicate101);
 const unavailable={...aggregate,availability:'UNAVAILABLE',counts:Object.fromEntries(Object.keys(aggregateCounts).map(key=>[key,null]))};assert.deepEqual(runner.projectFailureAggregate(unavailable),unavailable);
 for(const mutant of [{...aggregate,raw:'SYNTHETIC_PRIVATE_CANARY'},{...aggregate,counts:{...aggregateCounts,historyBarcodes:10001}},{...aggregate,counts:{...aggregateCounts,historyBarcodes:'SYNTHETIC_PRIVATE_CANARY'}},{...aggregate,counts:{...aggregateCounts,pendingJournalOperations:0}},{...aggregate,counts:{...aggregateCounts,operationsOther:1}},{...aggregate,counts:{...aggregateCounts,historyUniqueBarcodes:100}},{...aggregate,counts:{...aggregateCounts,historyBarcodes:101,historyUniqueBarcodes:101}},{...aggregate,counts:{...aggregateCounts,registryEntries:101}},{...aggregate,counts:{...aggregateCounts,historyGroups:0}},{...aggregate,counts:{...aggregateCounts,historyUniqueBarcodes:0}},{...aggregate,counts:{...aggregateCounts,operationsAdmitted:10000}},{...aggregate,availability:'UNAVAILABLE'}, {...aggregate,case:'I100-palm-signed'}]){assert.equal(runner.projectFailureAggregate(mutant),null);assert.equal(runner.childFailureProjection({...aggregateResult,failureAggregate:mutant},'I100-cookie-unsigned',target).aggregate,null);}
 assert.equal(runner.childFailureProjection({...aggregateResult,error:'Error: other'},'I100-cookie-unsigned',target).aggregate,null);assert.equal(runner.projectChildFailure({...aggregateProjected,ledger:'UNRUN'},'I100-cookie-unsigned').aggregate,null);assert.equal(runner.projectChildFailure(aggregateProjected,'I100-palm-signed').aggregate,null);const unsafeProjection=runner.projectChildFailure({...aggregateProjected,aggregate:{...aggregate,raw:'SYNTHETIC_PRIVATE_CANARY'}},'I100-cookie-unsigned');assert.equal(unsafeProjection.aggregate,null);assert(!JSON.stringify(unsafeProjection).includes('SYNTHETIC_PRIVATE_CANARY'));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'paired-diagnostic-private-')),good=path.join(temp,'good.json'),bad=path.join(temp,'bad.json'),sym=path.join(temp,'link.json');fs.writeFileSync(good,JSON.stringify(result),{mode:0o600});fs.writeFileSync(bad,JSON.stringify(result),{mode:0o600});fs.chmodSync(bad,0o644);fs.symlinkSync(good,sym);assert.equal(runner.readPrivateFailure(good).status,'FAIL');assert.throws(()=>runner.readPrivateFailure(bad));assert.throws(()=>runner.readPrivateFailure(sym));
}
// Exercise the selected tree's actual producer controls without forwarding child output.
function testSelectedProducerControls(){
 const cp=require('child_process'),script=path.join(selectedRoot,'tools/audit-tools','emu','import-paired-evidence-controls.cjs');
 const expected=JSON.stringify({status:'PASS',scope:'private synthetic evidence and stdout canary; no backend',fixtureRetained:true})+'\n';
 function run(root,spawn=cp.spawnSync,extraEnv={}){const file=path.join(root,'tools/audit-tools','emu','import-paired-evidence-controls.cjs');
  return spawn(process.execPath,[file],{cwd:root,env:{...process.env,...extraEnv,IMPORTPAIRED_APP_DIR:root,ZOE_REPO_ROOT:root},encoding:'utf8',timeout:30000,maxBuffer:65536});}
 let captured=null;run('/synthetic/selected',(node,args,options)=>{captured={node,args,options};return {status:0,stdout:expected,stderr:''};});
 assert.equal(captured.args[0],'/synthetic/selected/tools/audit-tools/emu/import-paired-evidence-controls.cjs');assert.equal(captured.options.cwd,'/synthetic/selected');assert.equal(captured.options.env.IMPORTPAIRED_APP_DIR,'/synthetic/selected');assert.equal(captured.options.env.ZOE_REPO_ROOT,'/synthetic/selected');
 const valid=result=>result?.status===0&&result.stdout===expected&&result.stderr==='';
 const absent=path.join(os.tmpdir(),'zoe-absent-selected-'+process.pid+'-'+require('crypto').randomBytes(8).toString('hex'));assert.equal(fs.existsSync(absent),false);assert.equal(valid(run(absent)),false,'missing selected source must fail');
 const wrong=fs.mkdtempSync(path.join(os.tmpdir(),'zoe-wrong-selected-'));fs.mkdirSync(path.join(wrong,'tools/audit-tools','emu'),{recursive:true});fs.writeFileSync(path.join(wrong,'tools/audit-tools','emu','import-paired-evidence-controls.cjs'),'process.exit(0);\n');assert.equal(valid(run(wrong)),false,'wrong selected source cannot pass on empty output');
 const mutantDir=fs.mkdtempSync(path.join(os.tmpdir(),'zoe-producer-mutant-')),preload=path.join(mutantDir,'preload.cjs');fs.writeFileSync(preload,"const M=require('module'),old=M._load;M._load=function(request,parent,...rest){const value=old.call(this,request,parent,...rest);if(request==='./import-paired-sdk-test.js'&&parent?.filename?.endsWith('import-paired-evidence-controls.cjs'))return {...value,firstImportCountAggregate:undefined};return value;};\n");const mutant=run(selectedRoot,cp.spawnSync,{NODE_OPTIONS:'--require='+preload});assert.equal(valid(mutant),false,'selected producer missing helper must fail');assert.equal(mutant.status,1,'selected producer mutant must reach the missing helper');assert.equal(/TypeError: aggregate is not a function/.test(mutant.stderr||''),true,'selected producer mutant must fail at the intended helper');
 assert.equal(fs.existsSync(script),true,'selected producer control missing');const actual=run(selectedRoot);
 assert.equal(valid(actual),true,'selected producer controls failed, timed out or output invalid');
}
// ⛔ controls ដែល repository-file-coverage កត់ hash ត្រូវរត់ពិតដែរ (hash បញ្ជាក់តែ bytes) ➜ control នីមួយៗរបស់ tree ដែលជ្រើស ត្រូវចេញ 0
//    ហើយបោះពុម្ពបន្ទាត់ PASS ចុងក្រោយ · control ដែលចេញ 0 ដោយគ្មាន PASS មិនត្រូវរាប់ថាឆ្លង
const RETAINED_CONTROLS=['import-paired-base-root-controls.cjs','import-paired-diagnostic-controls.cjs','import-paired-diagnostic-integration-controls.cjs',
 'import-paired-gate-controls.cjs','import-paired-native-cleanup-controls.cjs'];
function testRetainedControls(){
 const cp=require('child_process');
 const run=(root,name)=>cp.spawnSync(process.execPath,[path.join(root,'tools/audit-tools','emu',name)],{cwd:path.join(root,'tools/audit-tools','emu'),env:{...process.env,IMPORTPAIRED_APP_DIR:root,ZOE_REPO_ROOT:root},encoding:'utf8',timeout:120000,maxBuffer:1<<20});
 const passed=result=>result?.status===0&&!result.signal&&/(^|\n)(PASS\b[^\n]*|\{"status":"PASS"[^\n]*)\n?$/.test(String(result.stdout||'').trimEnd()+'\n')&&!/^\s*FAIL\b/m.test(String(result.stdout||'')+String(result.stderr||''));
 const wrong=fs.mkdtempSync(path.join(os.tmpdir(),'zoe-wrong-control-'));fs.mkdirSync(path.join(wrong,'tools/audit-tools','emu'),{recursive:true});
 fs.writeFileSync(path.join(wrong,'tools/audit-tools','emu','silent.cjs'),'process.exit(0);\n');fs.writeFileSync(path.join(wrong,'tools/audit-tools','emu','failing.cjs'),"console.log('PASS');process.exitCode=1;\n");
 assert.equal(passed(run(wrong,'silent.cjs')),false,'control ដែលចេញ 0 ដោយគ្មាន PASS មិនត្រូវរាប់ថាឆ្លង');
 assert.equal(passed(run(wrong,'failing.cjs')),false,'control ដែលចេញ 1 មិនត្រូវរាប់ថាឆ្លង');
 for(const name of RETAINED_CONTROLS){assert.equal(fs.existsSync(path.join(selectedRoot,'tools/audit-tools','emu',name)),true,'control បាត់ ៖ '+name);
  const result=run(selectedRoot,name);assert.equal(passed(result),true,'control '+name+' ធ្លាក់ ឬផុតពេល ៖ status='+result.status+' '+String(result.stdout||'').slice(-200)+String(result.stderr||'').slice(-200));}
}
async function testNativeOnly(){
 const id=runner.PROFILES[0];let count=0;
 function nativeResult(){const v=childResult(id);v.schema=1;v.providerSelection='native';v.caseSelection=id;v.crossProviderParity='UNRUN_SINGLE_PROVIDER';v.status='NATIVE_ONLY_CORE';v.unrunProviders=['sql'];v.caseLedger=[{provider:'native',id,status:'PASS'}];v.cases=v.cases.filter(x=>x.provider==='native');v.providerEvidence=[v.providerEvidence[0]];v.providerEvidence[0].provenance={ruleLoads:1,ruleSha256:HASH,ns:'paired-import-123-aaaaaaaa'};return v;}
 const publicNative=v=>({schema:1,status:v.status,caseSelection:id,sourceBundleSha256:v.sourceBundleSha256,instrumentedBundleSha256:v.instrumentedBundleSha256,caseLedger:v.caseLedger,unrunProviders:v.unrunProviders,cleanup:v.cleanup,vmConsole:v.vmConsole});
 function options(mutate=()=>{}){let result=nativeResult(),owner=ownerPass(),outExtra='',hash=HASH,abort=false,missing=false;const calls=[];
  const opts={id,root:'/synthetic/root',targetRoot:'/synthetic/target',evidenceDir:'/synthetic/private',ownerState:'/synthetic/shared-owner',node:'/synthetic/node',checker:'/synthetic/checker',env,
   getDiskFree:()=>runner.MIN_FREE_BYTES,readRulesHash:()=>hash,readChild:async()=>{if(missing)throw new Error('missing private result');return result;},makeSnapshot:fakeCapture,verifySnapshot:async(capture,observed)=>{assert.deepEqual(observed,SNAPSHOT);return 'paired-import-123-aaaaaaaa';},
   runOwned:async(request,adapters)=>{calls.push(request);assert.equal(request.stateDir,'/synthetic/shared-owner');assert.equal(request.env.IMPORTPAIRED_NATIVE_MARKER,'/synthetic/private/'+id+'-capture/native-marker.json');assert.deepEqual(request.args.slice(2),['--matrix=core','--provider=native','--case='+id]);assert.equal(request.env.IMPORTPAIRED_CI_PROVIDER,'native');
    adapters.__output.write(Buffer.from('IMPORT_PAIRED_RESULT '+JSON.stringify(publicNative(result))+'\n'+outExtra));return owner;}};
  mutate({result,owner,opts,setMissing:()=>{missing=true;},setExtra:v=>{outExtra=v;},setHash:v=>{hash=v;}});return {opts,calls};}
 {const f=options(),r=await runner.runNativeProfile(f.opts);assert.equal(r.status,'PASS');assert.equal(r.profiles[0].outcome,'PROVEN');const p=runner.publicReport(r);assert.equal(p.sql,'UNRUN');assert.equal(p.crossProviderParity,'UNRUN_SINGLE_PROVIDER');assert.equal(p.nativeRulesHashStatus,'VERIFIED_AFTER');assert.equal(p.emulatorJarHashStatus,'REPORTED_BY_OWNER');assert.equal(p.nativeRulesSha256,HASH);assert.equal(p.emulatorJarSHA256,HASH);assert.equal(f.calls.length,1);count++;}
 const mutations=[
  ['financial',({result})=>result.cases[0].logical.dailyCod--],['count',({result})=>result.cases[0].logical.dailyCount--],
  ['pending assertion',({result})=>result.cases[0].assertions.splice(result.cases[0].assertions.indexOf('core.pending-empty'),1)],
  ['source error assertion',({result})=>result.cases[0].assertions.pop()],['missing snapshot',({owner})=>delete owner.report.childResult.nativeSnapshot],
  ['unknown owner cleanup',({owner})=>owner.report.cleanup=false],['owner lock status',({owner})=>{owner.code=1;owner.report.status='FAIL';}],
  ['missing private result',({setMissing})=>setMissing()],['missing SQL unrun',({result})=>result.unrunProviders=[]],
  ['false parity',({result})=>result.crossProviderParity='PASS'],['wrong provider',({result})=>result.cases[0].provider='sql'],
  ['rule digest',({result})=>result.providerEvidence[0].provenance.ruleSha256=HASH2],['foreign namespace',({result})=>result.providerEvidence[0].provenance.ns='paired-import-124-aaaaaaaa'],['VM warning',({result})=>result.vmConsole.counts.warn=1],
  ['unsealed',({result})=>result.providerEvidence[0].cleanup.workflowSealed.outcome='UNKNOWN'],['root unverified',({result})=>result.providerEvidence[0].cleanup.rootEmpty=false],
  ['unexpected output',({setExtra})=>setExtra('synthetic-secret-DO-NOT-PRINT\n')],['hash mismatch',({result})=>result.instrumentedBundleSha256=HASH2.slice(1)]];
 for(const [name,mutation] of mutations){const f=options(mutation),r=await runner.runNativeProfile(f.opts);assert.equal(r.status,'FAIL',name);assert.equal(r.profiles[0].outcome,'UNKNOWN',name);const projected=runner.publicReport(r),p=JSON.stringify(projected);assert(!p.includes('synthetic-secret-DO-NOT-PRINT'));assert(p.includes('UNRUN_SINGLE_PROVIDER'));assert.equal(projected.profiles[0].outcome,'UNKNOWN');assert(['ASSERTION_FAILED','SYNTAX_ERROR','TYPE_ERROR','ERROR'].includes(projected.profiles[0].category));assert.equal(projected.nativeRulesHashStatus,'OBSERVED_PRECHECK');assert.equal(projected.nativeRulesSha256,HASH);if(['financial','count','missing private result','false parity','rule digest','foreign namespace'].includes(name))assert.equal(projected.profiles[0].phase,'CHILD_EVIDENCE',name);if(['missing snapshot','unknown owner cleanup','owner lock status'].includes(name))assert.equal(projected.profiles[0].phase,'OWNED_WRAPPER',name);if(['VM warning','unexpected output'].includes(name))assert.equal(projected.profiles[0].phase,'CHILD_OUTPUT',name);if(name==='VM warning'){assert.equal(projected.profiles[0].output.vmWarnings,1);assert.equal(projected.profiles[0].output.vmCountStatus,'LOWER_BOUND');}count++;}
 // Fixed-name collision and pre-existing blocked owner cannot become PASS.
 {const f=options(({opts})=>{opts.makeSnapshot=()=>{throw new Error('synthetic existing capture marker');};}),r=await runner.runNativeProfile(f.opts);assert.equal(r.status,'FAIL');assert.equal(f.calls.length,0);count++;}
 {const f=options(({opts})=>{let n=0;opts.readRulesHash=()=>++n===1?HASH:HASH2;}),r=await runner.runNativeProfile(f.opts);assert.equal(r.status,'FAIL');assert.equal(r.profiles[0].outcome,'UNKNOWN');count++;}
 {const secret='synthetic-private-canary',f=options(({opts})=>{opts.getDiskFree=()=>{throw new Error(secret);};}),r=await runner.runNativeProfile(f.opts),p=runner.publicReport(r);assert.equal(p.profiles[0].phase,'DISK');assert.equal(p.profiles[0].category,'ERROR');assert.equal(p.nativeRulesSha256,null);assert.equal(p.nativeRulesHashStatus,'UNAVAILABLE');assert.equal(p.emulatorJarHashStatus,'UNAVAILABLE');assert(!JSON.stringify(p).includes(secret));assert.equal(f.calls.length,0);count++;}
 {const bogus=runner.publicReport({status:'FAIL',scope:'NATIVE_ONLY',profiles:[{id,status:'FAIL',failure:'synthetic-private-canary',category:'synthetic-private-canary'}],nativeRulesSha256:'bad',nativeRulesHashStatus:'VERIFIED_AFTER',emulatorJarSHA256:'bad',emulatorJarHashStatus:'REPORTED_BY_OWNER'});assert.equal(bogus.profiles[0].phase,null);assert.equal(bogus.profiles[0].category,null);assert.equal(bogus.nativeRulesHashStatus,'UNAVAILABLE');assert.equal(bogus.emulatorJarHashStatus,'UNAVAILABLE');assert(!JSON.stringify(bogus).includes('synthetic-private-canary'));count++;}
 // Actual owner entry must reject existing shared fences before invoking any adapter.
 for(const fence of ['active','blocked.json']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'paired-native-fence-test-')),state=path.join(root,'state');fs.mkdirSync(state,{mode:0o700});
  const marker=path.join(state,fence);if(fence==='active')fs.mkdirSync(marker,{mode:0o700});else fs.writeFileSync(marker,'synthetic unproven cleanup\n',{mode:0o600,flag:'wx'});
  const result=await owner.runOwnedCommand({stateDir:state,args:['/synthetic/node','/synthetic/checker'],env},{validateSource(){throw new Error('adapter should not run');}});
  assert.notEqual(result.code,0);assert.equal(result.report.status,'FAIL');assert.equal(result.report.commandStarted,false);assert(fs.existsSync(marker));count++;
 }
 console.log(JSON.stringify({status:'PASS',nativeOnlySynthetic:count,scope:'fake owner and private evidence, no backend'}));
}
async function main() {
    {
        const f = fakeOptions(), report = await runner.runMatrix(f.options);
        assert.equal(report.status, 'PASS'); assert.equal(f.calls.length, 8); assert.equal(f.active.maximum, 1);
        assert.deepEqual(f.calls.map(call => call.env.IMPORTPAIRED_CI_CASE), runner.PROFILES);
        assert.equal(new Set(f.calls.map(call => call.stateDir)).size, 8);
        assert.equal(new Set(f.calls.map(call => call.env.IMPORTPAIRED_RESULT)).size, 8);
    }
    for (const [name, mutate] of mutations()) {
        const f = fakeOptions(), originalRead = f.options.readChild; f.options.readChild = async file => { const value = await originalRead(file); mutate(value); return value; };
        const report = await runner.runMatrix(f.options); assert.equal(report.status, 'FAIL', name); assert.equal(f.calls.length, 1, name);
        assert.equal(report.profiles[0].status, 'FAIL', name); assert(report.profiles.slice(1).every(row => row.status === 'UNRUN'), name);
    }
    for (const [name, mutate] of [
        ['wrapper exit', o => { o.code = 1; }], ['wrapper child error', o => { o.report.childResult.error='CHILD_PROCESS_ERROR'; }], ['snapshot unknown', o => { o.report.childResult.nativeSnapshot={state:'UNREADABLE',receipt:'PRIVATE_0600',receiptSha256:HASH}; }], ['wrapper cleanup', o => { o.report.cleanup = false; }],
        ['owner not started', o => { o.report.ownedRuntimeStarted = false; }], ['no output', o => { o.report.childResult.outputPresent = false; }],
        ['skip line', o => { o.report.childResult.skipLine = true; }], ['failure line', o => { o.report.childResult.failureLine = true; }]
    ]) {
        const f = fakeOptions(), old = f.options.runOwned; f.options.runOwned = async (request,adapters) => { const value = await old(request,adapters); mutate(value); return value; };
        const report = await runner.runMatrix(f.options); assert.equal(report.status, 'FAIL', name); assert.equal(f.calls.length, 1, name);
    }
    {
        const f = fakeOptions({ getDiskFree: () => runner.MIN_FREE_BYTES - 1n }), report = await runner.runMatrix(f.options);
        assert.equal(report.status, 'FAIL'); assert.equal(report.profiles[0].failure, 'DISK_CAPACITY'); assert.equal(f.calls.length, 0);
    }
    {
        const f = fakeOptions({ getDiskFree: () => { throw new Error('synthetic statfs failure'); } }), report = await runner.runMatrix(f.options);
        assert.equal(report.status, 'FAIL'); assert.equal(report.profiles[0].failure, 'DISK_CAPACITY_UNAVAILABLE'); assert.equal(f.calls.length, 0);
    }
    {
        const secret = 'synthetic-secret-must-not-appear', f = fakeOptions({ readChild: async () => { throw new Error(secret); } }), report = await runner.runMatrix(f.options);
        assert.equal(report.status, 'FAIL'); assert.equal(f.calls.length, 1); assert(!JSON.stringify(report).includes(secret));
    }
    {
        const f = fakeOptions(), old = f.options.readChild; let count = 0;
        f.options.readChild = async file => { const value = await old(file); if (++count === 2) value.sourceBundleSha256 = HASH2; return value; };
        const report = await runner.runMatrix(f.options); assert.deepEqual(report.profiles.slice(0, 3).map(x => x.status), ['PASS', 'FAIL', 'UNRUN']); assert.equal(f.calls.length, 2);
    }
    {
        const f = fakeOptions({ env: { ...env, SUPABASE_STRICT: '0' } }); await assert.rejects(runner.runMatrix(f.options)); assert.equal(f.calls.length, 0);
    }
    {
        const controller = new AbortController(), f = fakeOptions({ signal: controller.signal }), old = f.options.runOwned;
        f.options.runOwned = async (request,adapters) => { assert.equal(request.signal.aborted, controller.signal.aborted);assert.equal(typeof request.signal.addEventListener,'function'); const result = await old(request,adapters); controller.abort(); return result; };
        const report = await runner.runMatrix(f.options); assert.equal(report.status, 'FAIL'); assert.equal(report.profiles[0].status, 'FAIL');
        assert(report.profiles.slice(1).every(row => row.status === 'UNRUN')); assert.equal(f.calls.length, 1);
    }
    {
        const controller = new AbortController(); controller.abort(); const f = fakeOptions({ signal: controller.signal }), report = await runner.runMatrix(f.options);
        assert.equal(report.status, 'FAIL'); assert(report.profiles.every(row => row.status === 'UNRUN')); assert.equal(f.calls.length, 0);
    }
    {
        const id=runner.PROFILES[0], secret='synthetic-canary-must-not-appear', good=publicChild(id);
        const encode=value=>Buffer.from('IMPORT_PAIRED_RESULT '+JSON.stringify(value)+'\n');
        const gate=runner.makeChildOutputGate(id);gate.stdout.write(encode(good));assert.equal(gate.finish().ok,true);const incomplete=runner.makeChildOutputGate(id);incomplete.stdout.write(encode(good));assert.equal(incomplete.finish(false).ok,false);assert.equal(incomplete.finish(false).stats.countsComplete,false);
        for(const text of [secret, 'SKIP '+secret, 'FAIL '+secret, 'WARN '+secret, 'x'.repeat(65537)]) {
            const g=runner.makeChildOutputGate(id);g.stdout.write(Buffer.from(text));const first=g.finish();assert.equal(first.ok,false);assert.deepEqual(g.finish(),first);assert(!JSON.stringify(first).includes(secret));
        }
        const malformed=runner.makeChildOutputGate(id);malformed.stdout.write(Buffer.from([0xff]));assert.equal(malformed.finish().stats.countsComplete,false);const overflow=runner.makeChildOutputGate(id);overflow.stdout.write(Buffer.alloc(65537));assert.equal(overflow.finish().stats.countsComplete,false);const exactFail=runner.makeChildOutputGate(id);exactFail.stdout.write(Buffer.from('FAIL'));assert.equal(exactFail.finish().stats.failureLines,1);
        const failed=runner.makeChildOutputGate(id), bad=structuredClone(good);bad.status='FAIL';bad.vmConsole.counts.warn=2;bad.vmConsole.counts.error=3;
        failed.stderr.write(encode(bad));const v=failed.finish();assert.equal(v.ok,false);assert.equal(v.stats.vmWarnings,2);assert.equal(v.stats.vmErrors,3);assert.equal(v.stats.streamCountsComplete,true);assert.equal(v.stats.countsComplete,false);assert.equal(v.stats.vmCountStatus,'LOWER_BOUND');assert(v.stats.stderrBytes>0);
        const fallback=runner.makeChildOutputGate(id);fallback.stderr.write(Buffer.from('IMPORT_VM_CONSOLE_COUNTS '+JSON.stringify(bad.vmConsole)+'\n'));const fb=fallback.finish();assert.equal(fb.ok,false);assert.equal(fb.stats.vmWarnings,2);assert.equal(fb.stats.vmErrors,3);assert.equal(fb.stats.vmCountStatus,'LOWER_BOUND');assert.equal(fb.stats.countsComplete,false);
        const absent=runner.makeChildOutputGate(id);absent.stderr.write(Buffer.from('FAIL'));const ab=absent.finish();assert.equal(ab.stats.failureLines,1);assert.equal(ab.stats.vmWarnings,null);assert.equal(ab.stats.vmCountStatus,'UNKNOWN');assert.equal(ab.stats.countsComplete,false);
        const duplicated=runner.makeChildOutputGate(id);duplicated.stderr.write(encode(bad));duplicated.stderr.write(Buffer.from('IMPORT_VM_CONSOLE_COUNTS '+JSON.stringify(bad.vmConsole)+'\n'));const dup=duplicated.finish();assert.equal(dup.stats.vmWarnings,2);assert.equal(dup.stats.vmErrors,3);assert.equal(dup.stats.vmCountStatus,'LOWER_BOUND');
        const conflict=runner.makeChildOutputGate(id);conflict.stderr.write(encode(bad));conflict.stderr.write(Buffer.from('IMPORT_VM_CONSOLE_COUNTS '+JSON.stringify(good.vmConsole)+'\n'));const c=conflict.finish();assert.equal(c.stats.vmWarnings,null);assert.equal(c.stats.vmCountStatus,'UNKNOWN');assert.equal(c.stats.countsComplete,false);
        const projected=runner.publicReport({status:'FAIL',profiles:[{id,status:'FAIL',output:v.stats}],sourceHashes:{raw:HASH,instrumented:HASH2,secret},retained:[{path:secret}],evidenceDir:secret,targetRoot:secret});
        assert(!JSON.stringify(projected).includes(secret));assert.equal(projected.profiles[0].output.vmWarnings,2);
    }
    await testFailureDiagnostics();
    testSelectedProducerControls();
    testRetainedControls();
    await testNativeOnly();
    await testActualNativeCliContract();
    await testRealWrapperEntry();
    await testRealWrapperEntry(true);
    await testActualCliOwnerContract();
    await runSnapshotControls();
    console.log(JSON.stringify({ status: 'PASS', cases: 49, scope: 'synthetic runner and actual owner/CLI entry with fake adapters; no backend, network or real process signals' }));
    process.exitCode = 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
