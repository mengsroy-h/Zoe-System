'use strict';
// Synthetic canaries and retained private fixture only; no backend.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process');
const selectedRoot=path.resolve(process.env.IMPORTPAIRED_APP_DIR||process.env.ZOE_REPO_ROOT||path.join(__dirname,'../..'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'zoe-import-evidence-control-'));process.env.TMPDIR=root;
const check=require('./import-paired-sdk-test.js'),canary='SYNTHETIC_TOKEN_CANARY_35b125',journal='SYNTHETIC_PENDING_ORIGINAL';
async function main(){const stores={local:check.storage(),session:check.storage()},lease=check.ownedLease();stores.local.setItem('zoew_scan_evidence_v2:synthetic',journal);stores.local.setItem('synthetic-auth-token',canary);lease.acquire();lease.closed();const held=check.preserveLease(lease,'synthetic-owned',stores);
 process.env.IMPORTPAIRED_NATIVE_MARKER=path.join(root,'native-marker.json');const namespace='paired-import-'+process.pid+'-abcdef12';
 assert.throws(()=>check.writeNativeMarker('not-synthetic','I100-cookie-signed'),/namespace invalid/);assert.equal(fs.existsSync(process.env.IMPORTPAIRED_NATIVE_MARKER),false);
 assert.throws(()=>check.writeNativeMarker(namespace,'I100-invented'),/profile invalid/);assert.equal(fs.existsSync(process.env.IMPORTPAIRED_NATIVE_MARKER),false);
 check.writeNativeMarker(namespace,'I100-cookie-signed');const marker=JSON.parse(fs.readFileSync(process.env.IMPORTPAIRED_NATIVE_MARKER,'utf8'));
 assert.deepEqual(marker,{schema:1,profile:'I100-cookie-signed',pid:process.pid,namespace});assert.equal(fs.statSync(process.env.IMPORTPAIRED_NATIVE_MARKER).mode&0o077,0);
 assert.throws(()=>check.writeNativeMarker(namespace,'I100-cookie-signed'),/EEXIST/);assert.deepEqual(JSON.parse(fs.readFileSync(process.env.IMPORTPAIRED_NATIVE_MARKER,'utf8')),marker);
 assert.equal(held.state,'HELD_NAMESPACE');assert.equal(held.journalCount,1);assert(!JSON.stringify(held).includes(canary));assert.equal(stores.local.getItem('zoew_scan_evidence_v2:synthetic'),journal);
 const summary=check.publicSummary({schema:1,status:'FAIL',error:canary,caseSelection:'I100-cookie-signed',caseLedger:[{provider:'native',id:'I100-cookie-signed',status:'FAIL',error:canary}],providerEvidence:[{secret:canary}],unrunProviders:['sql'],cleanup:false});assert(!JSON.stringify(summary).includes(canary));
 const owned=check.publicOwned({outcome:'UNKNOWN',stopped:false,reason:canary,errors:[canary]});assert(!JSON.stringify(owned).includes(canary));assert.equal(owned.errorCount,1);
 for(const method of ['log','info','debug','trace','warn','error','table']){const events={captured:[]},sink=check.createVmConsole(events);try{sink[method](canary);}catch(_){}assert.throws(()=>check.assertNoSourceErrors(events),undefined,method+' must be a strict failure even when caught');assert(!JSON.stringify(events).includes(canary));}
 const backend={name:'native'},spec={id:'I100-cookie-signed'},client={read:async()=>({synthetic:1}),f:{stores},events:{captured:[],offOrigin:[]}};let log='';const old=console.error;
 try{console.error=(...args)=>{log+=args.join(' ');};const saved=await check.captureCheckpoint(backend,client,spec,'failure',canary,held);
  assert(!log.includes(canary));assert(!log.includes(journal));assert(!log.includes(saved.file));
  const text=fs.readFileSync(saved.file,'utf8'),value=JSON.parse(text);assert.equal(value.journals.length,1);assert.equal(value.journals[0][1],journal);assert(!text.includes('synthetic-auth-token'));
  assert.equal(saved.checkpointSha256,crypto.createHash('sha256').update(text).digest('hex'));assert.equal(fs.statSync(saved.file).mode&0o077,0);
 }finally{console.error=old;}
 const childScript=`(async()=>{const assert=require('assert/strict'),check=require('./import-paired-sdk-test.js');const raw=check.bundle(),code=check.instrumentRecovery(check.instrumentAuth(check.instrumentSubscribe(check.instrumentTransport(check.instrumentSweep(raw)))));const events={captured:[]},stores={local:check.storage(),session:check.storage()};const f=await check.frame(code+'\\nconsole.log('+JSON.stringify(${JSON.stringify(canary)})+');window.console.warn('+JSON.stringify(${JSON.stringify(canary)})+');try{console.table('+JSON.stringify(${JSON.stringify(canary)})+')}catch(_){}',stores,new Set(),events);await f.close();assert.equal(events.vmConsole.counts.log,1);assert.equal(events.vmConsole.counts.warn,1);assert.equal(events.vmConsole.counts.unsupported,1);assert.throws(()=>check.assertNoSourceErrors(events));console.log(JSON.stringify(check.publicSummary({schema:1,status:'FAIL',caseLedger:[],unrunProviders:[],cleanup:false})));})().catch(()=>{console.error('synthetic VM failure');process.exitCode=1;});`;
 const child=cp.spawnSync(process.execPath,['--unhandled-rejections=strict','-e',childScript],{cwd:__dirname,encoding:'utf8',timeout:15000,env:{...process.env,IMPORTPAIRED_APP_DIR:selectedRoot}});
 assert.equal(child.status,0,'synthetic VM child failed; stderrSha256='+crypto.createHash('sha256').update(child.stderr||'').digest('hex'));assert(!child.stdout.includes(canary));assert(!child.stderr.includes(canary));const publicResult=JSON.parse(child.stdout.trim());assert.equal(publicResult.vmConsole.counts.warn,1);assert.equal(publicResult.vmConsole.counts.log,1);assert.equal(publicResult.vmConsole.counts.unsupported,1);
 await testBrowserPerformanceBinding();
 await testSavePreparedHoldWithMissingPerformance();
 await testUnsignedFirstCheckpointAggregate();
 for(const [script,expected] of [['import-paired-diagnostic-controls.cjs','PASS bounded synthetic diagnostics: privacy, identity/phase, origin timeout marking, nested assertion, forgery, two mutants\n'],['import-paired-diagnostic-integration-controls.cjs','PASS actual runCore catch to runner projection: marked origin and real failing assertion; no backend\n']]){
  const run=cp.spawnSync(process.execPath,['--unhandled-rejections=strict',path.join(__dirname,script)],{cwd:__dirname,encoding:'utf8',timeout:15000,maxBuffer:65536,env:process.env});
  assert.equal(run.status,0,'owned diagnostic controls failed');assert.equal(run.signal,null,'owned diagnostic control signal');assert.equal(run.stdout,expected,'owned diagnostic control output');assert.equal(run.stderr,'','owned diagnostic controls stderr');
 }
 console.log(JSON.stringify({status:'PASS',scope:'private synthetic evidence and stdout canary; no backend',fixtureRetained:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

async function testUnsignedFirstCheckpointAggregate(){
const child=check,aggregate=child.firstImportCountAggregate,eligible=child.isFirstUnsignedNativeCountTimeout;
const H='zoew_scan_history_cod_dod',R='zoew_barcode_registry',O='zoew_scan_operations',canary='SYNTHETIC_PRIVATE_CANARY',ns='paired-import-'+process.pid+'-abcdef12',birth=Date.UTC(2026,9,30,2),groupId='id_123_a';
const scan=i=>'scan_'+i.toString(16).padStart(32,'0');
const op=(i,phase)=>({id:scan(i),actorUid:'import-owner',code:'SYNTHETIC'+i,registryKey:'SYNTHETIC'+i,birth,phase});
const base=()=>({id:'I100-cookie-unsigned',provider:'native',phase:'first-import',roots:{state:'READABLE',value:{[H]:{[groupId]:{id:groupId,phone:'0910000000',barcodes:[{code:'SYNTHETIC0',cod:canary},{code:'SYNTHETIC1'}]}},[R]:{SYNTHETIC0:{v:2,intent:scan(0),actorUid:'import-owner',birth},SYNTHETIC1:{v:2,intent:scan(1),actorUid:'import-owner',birth}},[O]:Object.fromEntries(['admitted','prepared','committed','cancelled'].map((p,i)=>[scan(i),op(i,p)]))}},journals:[['zoew_scan_evidence_synthetic',canary]],captured:[{message:canary}]});
const n=base(),out=aggregate(n,ns);assert.equal(out.availability,'AVAILABLE');assert.deepEqual(out.counts,{historyGroups:1,historyBarcodes:2,historyUniqueBarcodes:2,registryEntries:2,operationsAdmitted:1,operationsPrepared:1,operationsCommitted:1,operationsCancelled:1,operationsOther:0,journalStorageKeys:1,capturedEvents:1,pendingJournalOperations:null});assert(!JSON.stringify(out).includes(canary));assert.equal(out.consistency,'POST_TIMEOUT_NONATOMIC');
n.roots.value[H][groupId].barcodes.push({code:'SYNTHETIC2'});n.journals.push(['zoew_scan_evidence_x','y']);assert.equal(out.counts.historyBarcodes,2);assert.equal(out.counts.journalStorageKeys,1);
const empty=base();empty.roots.value=null;const ev=aggregate(empty,ns);assert.equal(ev.availability,'AVAILABLE');assert.equal(ev.counts.historyBarcodes,0);assert.equal(ev.counts.registryEntries,0);assert.equal(ev.counts.pendingJournalOperations,null);assert.equal(ev.consistency,'POST_TIMEOUT_NONATOMIC');
const dup=base();dup.roots.value[H][groupId].barcodes[1].code='SYNTHETIC0';assert.equal(aggregate(dup,ns).counts.historyUniqueBarcodes,1);
const many=base();many.roots.value[H][groupId].barcodes=Array.from({length:101},(_,i)=>({code:'SYNTHETIC'+(i%100)}));assert.equal(aggregate(many,ns).counts.historyBarcodes,101);assert.equal(aggregate(many,ns).counts.historyUniqueBarcodes,100);
const bad=[v=>v.roots.state='UNREADABLE',v=>delete v.roots.value,v=>v.roots.value[H]=[],v=>v.roots.value[H][groupId].barcodes[0]=null,v=>v.roots.value[H][groupId].barcodes[0].code=canary,v=>v.roots.value[H][groupId].phone=canary,v=>v.roots.value[H].foreign=v.roots.value[H][groupId],v=>v.roots.value[R].SYNTHETIC0=canary,v=>v.roots.value[R][canary]=v.roots.value[R].SYNTHETIC0,v=>v.roots.value[O][scan(0)]=null,v=>v.roots.value[O][scan(0)].phase=canary,v=>v.roots.value[O][scan(0)].code=canary,v=>v.roots.value[O][scan(0)].actorUid=canary,v=>v.journals=[canary],v=>v.captured=[canary],v=>v.roots.value[H][groupId].barcodes=Array.from({length:10001},(_,i)=>({code:'SYNTHETIC'+(i%100)})),v=>v.id='I100-palm-unsigned',v=>v.provider='sql',v=>v.phase='cleanup'];
for(const mutate of bad){const x=base();mutate(x);const v=aggregate(x,ns);assert.equal(v.availability,'UNAVAILABLE');assert(Object.values(v.counts).every(x=>x===null));assert(!JSON.stringify(v).includes(canary));}assert.equal(aggregate(base(),'paired-import-99999999-abcdef12').availability,'UNAVAILABLE');
{const label='I100-cookie-unsigned authoritative100',message='ពេលកំណត់៖ '+label,spec={id:'I100-cookie-unsigned'},backend={name:'native'};let marked;const realNow=Date.now;let calls=0;Date.now=()=>calls++===0?0:15000;try{await child.untilFirstImportCount(async()=>false,label);}catch(e){marked=e;}finally{Date.now=realNow;}assert(marked instanceof Error);assert.equal(marked.message,message);assert(eligible(backend,spec,'first-import',marked));const impostor=new Error(message);assert(!eligible(backend,spec,'first-import',impostor));let thrown;try{await child.untilFirstImportCount(()=>Promise.reject(impostor),label);}catch(e){thrown=e;}assert.equal(thrown,impostor);assert(!eligible(backend,spec,'first-import',thrown));for(const [b,s,p] of [[{name:'sql'},spec,'first-import'],[backend,{id:'I100-palm-unsigned'},'first-import'],[backend,spec,'same-batch-repeat']])assert(!eligible(b,s,p,marked));
 // Exercise actual extracted runCore catch/finally with fake promises, including
 // earlier identical import error and an actual-marked deadline; no extra I/O.
 const source=fs.readFileSync(path.join(__dirname,'import-paired-sdk-test.js'),'utf8'),a=source.indexOf('async function runCore('),b=source.indexOf('\nfunction instrumentSweep(',a);assert(a>=0&&b>a);
 async function flow(err,earlier){const first=base(),later=base();later.roots.value[H]={};let reads=0;const f={api:{ztoState:{ztoStatusInFlight:false},importZtoListRows:()=>Promise.resolve()},stores:{local:{}}},events={captured:[]};const client={ns,f,events,observation:{state:{closed:false},quiesce:async()=>{}},close:async()=>{},preserve:()=>({state:'HELD_NAMESPACE'})};const apiBackend={name:'native',open:async()=>client,upstream:{pending:()=>0},cleanupEvidence:{}};const body=`let firstImportFailureAggregate=null,firstAssertionFailure=null;const failureEvidenceByError=new WeakMap();${source.slice(a,b)};return {runCore,get:()=>firstImportFailureAggregate};`;const api=new Function('input','bounded','untilFirstImportCount','until','captureCheckpoint','isFirstUnsignedNativeCountTimeout','firstImportCountAggregate','journalRows','assertNoSourceErrors','assertNoOutbound','cleanupAction','assert','withAssertionLabel','getAssertionFailure','isMixedOriginTimeout','originTimeoutAggregate','untilOriginFence',body)(()=>'batch',()=>earlier?Promise.reject(err):Promise.resolve(),()=>Promise.reject(err),async()=>{},async()=>{reads++;return {report:reads===1?first:later,checkpointSha256:'a'.repeat(64)};},eligible,aggregate,()=>[],()=>{},()=>{},()=> 'preserve',assert,child.withAssertionLabel,child.getAssertionFailure,child.isMixedOriginTimeout,child.originTimeoutAggregate,child.untilOriginFence);await assert.rejects(api.runCore(apiBackend,spec,{}),x=>x===err);assert.equal(reads,2);return api.get();}
 const original=await flow(impostor,true);assert.equal(original,null);const observed=await flow(marked,false);assert.equal(observed.availability,'AVAILABLE');assert.equal(observed.counts.historyBarcodes,2);assert(!JSON.stringify(observed).includes(canary));
 const Module=require('module'),file=require.resolve('./import-paired-sdk-test.js');function mutate(before,after){const src=fs.readFileSync(file,'utf8');assert.equal(src.split(before).length,2);const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(src.replace(before,after),file);return m.exports;}
 const unknownMutant=mutate("assert(['admitted','prepared','committed','cancelled'].includes(phase));",'');const unknown=base();unknown.roots.value[O][scan(0)].phase=canary;assert.throws(()=>assert.equal(unknownMutant.firstImportCountAggregate(unknown,ns).availability,'UNAVAILABLE'));
 const pendingMutant=mutate('FIRST_IMPORT_COUNT_KEYS.map(key=>[key,null])','FIRST_IMPORT_COUNT_KEYS.map(key=>[key,0])');assert.throws(()=>assert.equal(pendingMutant.firstImportCountAggregate(base(),ns).counts.pendingJournalOperations,null));
}
}

// Runs the actual compiled monthly mutation in the same owned VM frame.
// Only the ownership predicate is replaced to control positive and negative cases.
async function testBrowserPerformanceBinding(){
 const code=check.bundle()+`\noperationCurrent = () => globalThis.__fixtureOwnerCurrent; module.exports.__testMonthMutation = scanMonthMutation;`;
 const events={captured:[]},stores={local:check.storage(),session:check.storage()};
 const f=await check.frame(code,stores,new Set(),events);let calls=0;
 try{
  const vm=require('vm');
  assert.equal(vm.runInContext('performance === window.performance',f.context),true,'fixture must expose the actual window performance object globally');
  const before=vm.runInContext('performance.now()',f.context),after=vm.runInContext('performance.now()',f.context);
  assert(Number.isFinite(before)&&Number.isFinite(after)&&after>=before,'browser timing must be monotonic and finite');
  f.context.__fixtureOwnerCurrent=true;
  const action=async()=>{calls++;return 'native-ok';};
  assert.equal(await f.api.__testMonthMutation({sdk:{__supabase:false},db:{}},{},action),'native-ok');assert.equal(calls,1);
  delete f.context.performance;
  await assert.rejects(f.api.__testMonthMutation({sdk:{__supabase:false},db:{}},{},action),e=>e.name==='ReferenceError');assert.equal(calls,1,'missing native clock cannot invoke mutation');
  assert.equal(await f.api.__testMonthMutation({sdk:{__supabase:true},db:{}},{},async()=>{calls++;return 'sql-ok';}),'sql-ok');assert.equal(calls,2);
  f.context.performance=f.window.performance;f.context.__fixtureOwnerCurrent=false;
  await assert.rejects(f.api.__testMonthMutation({sdk:{__supabase:false},db:{}},{},action),/owner changed/);assert.equal(calls,2,'stale owner cannot invoke native mutation');
  await assert.rejects(f.api.__testMonthMutation({sdk:{__supabase:true},db:{}},{},action),/owner changed/);assert.equal(calls,2,'stale owner cannot invoke SQL mutation');
  f.context.__fixtureOwnerCurrent=true;await assert.rejects(f.api.__testMonthMutation({sdk:{__supabase:false},db:{}},{},async()=>{throw new Error('synthetic mutation failure');}),/synthetic mutation failure/);
  assert.equal(events.captured.length,0);
 }finally{await f.close();}
}

// Synthetic SDK and identity stubs stop before writing history; actual compiled save flow.
async function testSavePreparedHoldWithMissingPerformance(){
 const patch=`\noperationOf=h=>h.original;pendingScanIsLive=()=>false;operationCurrent=()=>true;scanOperationSame=()=>true;scanOperationValid=()=>true;generateUniqueId=()=>"fixture_id";readOperationNode=async(h,o,p)=>p.startsWith("zoew_scan_operations/")?h.current:p.startsWith("zoew_monthly_revenue")?{codDollar:0,dodDollar:0,totalCount:0,ops:{[o.monthToken]:1}}:null;notePendingScan=(h,p)=>h.phases.push(p);scanHeld=h=>{h.phases.push("hold");return false};releasePendingScan=()=>{};module.exports.__fixtureSave=saveScanOperation;`;
 const events={captured:[]},f=await check.frame(check.bundle()+patch,{local:check.storage(),session:check.storage()},new Set(),events);
 async function run(){const h={original:{id:'scan_'+'a'.repeat(32),phase:'admitted',scanDate:'2026-10-30',birth:1,month:'2026-10',monthToken:'op_m'+'a'.repeat(32)},phases:[],paths:[],db:{},sdk:{__supabase:false}};h.current=h.original;h.sdk.ref=(db,p)=>p;h.sdk.runTransaction=async(p,fn)=>{h.paths.push(p.split('/')[0]);if(p.startsWith('zoew_scan_operations/')){h.current=fn(h.current);return {committed:true};}if(p==='zoew_monthly_revenue_cod_dod')return {committed:true};throw new Error('synthetic stop before history write');};const result=await f.api.__fixtureSave(h,'synthetic','N/A',0);return {result,phase:h.current.phase,phases:h.phases,paths:h.paths};}
 try{delete f.context.performance;const red=await run();assert.deepEqual(red,{result:'unknown',phase:'prepared',phases:['save-pending','hold'],paths:['zoew_scan_operations']});f.context.performance=f.window.performance;const green=await run();assert.deepEqual(green,{result:'unknown',phase:'prepared',phases:['save-pending','hold'],paths:['zoew_scan_operations','zoew_monthly_revenue_cod_dod','zoew_scan_history_cod_dod']});assert.equal(events.captured.length,0);}finally{await f.close();}
}
