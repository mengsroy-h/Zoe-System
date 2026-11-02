'use strict';

// Each profile uses the repository's existing owned RTDB lifecycle. This runner
// retains synthetic evidence and stops on any failed or unproven outcome.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict'), crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const PROFILES = Object.freeze(['I100-cookie-unsigned', 'I100-cookie-signed', 'I100-cookie-mixed', 'I100-cookie-mixed-same-group',
    'I100-palm-unsigned', 'I100-palm-signed', 'I100-palm-mixed', 'I100-palm-mixed-same-group']);
const ASSERTIONS = ['core.oracle', 'core.codes-phones', 'core.prices-incarnations', 'core.pending-empty', 'core.same-batch',
    'core.repeat-unchanged', 'core.effects-unchanged', 'core.upstream', 'core.no-outbound', 'core.journals-empty', 'core.no-source-errors'];
// Planning floor only, not an upper bound on actual use or a product limit.
const MIN_FREE_BYTES = 1024n * 1024n * 1024n;
const HASH = /^[0-9a-f]{64}$/;

// Never forward child output: only one exact synthetic success summary is allowed.
// The existing owner still inspects the original streams for FAIL/SKIP.
function makeChildOutputGate(id,provider='both') {
    assert(PROFILES.includes(id));assert(['both','native'].includes(provider));
    const LIMIT=65536, stats={stdoutBytes:0,stderrBytes:0,unexpectedLines:0,failureLines:0,skipLines:0,warningLines:0,vmWarnings:null,vmErrors:null,vmUnsupported:null,vmCountStatus:'UNKNOWN',overflow:false,streamCountsComplete:false,countsComplete:false};
    const streams={stdout:{buffer:Buffer.alloc(LIMIT),size:0},stderr:{buffer:Buffer.alloc(LIMIT),size:0}};
    const sink=name=>({write(chunk){
        const state=streams[name], bytes=typeof chunk==='string'?Buffer.byteLength(chunk):chunk.byteLength;
        stats[name+'Bytes']=Math.min(Number.MAX_SAFE_INTEGER,stats[name+'Bytes']+bytes);
        if(state.size+bytes>LIMIT){stats.overflow=true;return true;}
        if(typeof chunk==='string')state.buffer.write(chunk,state.size,bytes,'utf8');else Buffer.from(chunk.buffer,chunk.byteOffset,bytes).copy(state.buffer,state.size);
        state.size+=bytes;return true;
    }});
    const stdout=sink('stdout'),stderr=sink('stderr');let finished=null;
    function finish(streamComplete=true){
        if(finished)return finished;
        let summary=null, stdoutLines=[], stderrLines=[], validStdout=false, vmConflict=false, vmOverflow=false;const vmByStream={stdout:null,stderr:null};
        try {
            for(const name of ['stdout','stderr']) {
                const state=streams[name], text=new TextDecoder('utf-8',{fatal:true}).decode(state.buffer.subarray(0,state.size));
                const lines=text.split(/\r?\n/);if(lines.at(-1)==='')lines.pop();
                if(name==='stdout')stdoutLines=lines;else stderrLines=lines;
                for(const line of lines){
                    const trimmed=line.trimStart();if(/^(?:FAIL(?:\s|$)|❌(?:\s|$)|\*\*\* FAIL \*\*\*)/u.test(trimmed))stats.failureLines++;
                    if(/^(?:SKIP|PARTIAL PASS)(?:\s|$)/u.test(trimmed))stats.skipLines++;
                    if(/^(?:warn(?:ing)?\b|⚠)/iu.test(trimmed))stats.warningLines++;
                    const resultPrefix='IMPORT_PAIRED_RESULT ',countsPrefix='IMPORT_VM_CONSOLE_COUNTS ';
                    if(line.startsWith(resultPrefix)||line.startsWith(countsPrefix))try {
                        const isResult=line.startsWith(resultPrefix), prefix=isResult?resultPrefix:countsPrefix;
                        const parsed=JSON.parse(line.slice(prefix.length)),vm=isResult?parsed?.vmConsole:parsed;
                        assert(vm&&typeof vm==='object'&&!Array.isArray(vm));assert.deepEqual(Object.keys(vm).sort(),['counts','overflow']);
                        assert.equal(typeof vm.overflow,'boolean');const c=vm.counts;
                        assert(c&&typeof c==='object'&&!Array.isArray(c));assert.deepEqual(Object.keys(c).sort(),['debug','error','info','log','trace','unsupported','warn']);
                        for(const value of Object.values(c))assert(Number.isSafeInteger(value)&&value>=0);
                        const previous=vmByStream[name];if(previous&&Object.keys(c).some(key=>c[key]<previous[key]))vmConflict=true;
                        vmByStream[name]=Object.fromEntries(Object.keys(c).map(key=>[key,Math.max(previous?.[key]??0,c[key])]));vmOverflow ||= vm.overflow;
                    }catch(_){vmConflict=true;}

                }
            }
            stats.streamCountsComplete=streamComplete&&!stats.overflow;assert.equal(stats.overflow,false);assert.equal(stdoutLines.length,1);
            const prefix='IMPORT_PAIRED_RESULT ';assert(stdoutLines[0].startsWith(prefix));summary=JSON.parse(stdoutLines[0].slice(prefix.length));
            assert.deepEqual(Object.keys(summary).sort(),['caseLedger','caseSelection','cleanup','instrumentedBundleSha256','schema','sourceBundleSha256','status','unrunProviders','vmConsole']);
            assert.equal(summary.schema,1);assert.equal(summary.status,provider==='native'?'NATIVE_ONLY_CORE':'PASS_PAIRED_CORE_SELECTED_SCOPE');assert.equal(summary.caseSelection,id);
            assert.equal(summary.cleanup,true);assert.deepEqual(summary.unrunProviders,provider==='native'?['sql']:[]);
            assert.deepEqual(summary.caseLedger,provider==='native'?[{provider:'native',id,status:'PASS'}]:[{provider:'native',id,status:'PASS'},{provider:'sql',id,status:'PASS'}]);
            assert(HASH.test(summary.sourceBundleSha256));assert(HASH.test(summary.instrumentedBundleSha256));
            assert.deepEqual(Object.keys(summary.vmConsole).sort(),['counts','overflow']);assert.equal(summary.vmConsole.overflow,false);
            assert.deepEqual(Object.keys(summary.vmConsole.counts).sort(),['debug','error','info','log','trace','unsupported','warn']);
            for(const v of Object.values(summary.vmConsole.counts))assert.equal(v,0);
            validStdout=true;assert.equal(stats.stderrBytes,0);assert.equal(streamComplete,true);
        } catch (_) {stats.unexpectedLines=Math.max(1,(validStdout?0:stdoutLines.length)+stderrLines.length);summary=null;}
        const snapshots=Object.values(vmByStream).filter(Boolean);
        if(snapshots.length===2){const [a,b]=snapshots,keys=Object.keys(a);if(!keys.every(k=>a[k]<=b[k])&&!keys.every(k=>b[k]<=a[k]))vmConflict=true;}
        if(snapshots.length&&!vmConflict){const max=key=>Math.max(...snapshots.map(v=>v[key]));
            stats.vmWarnings=max('warn');stats.vmErrors=max('error');stats.vmUnsupported=max('unsupported');
            stats.vmCountStatus=summary&&stats.streamCountsComplete&&!vmOverflow?'FINAL':'LOWER_BOUND';
        }
        stats.countsComplete=stats.streamCountsComplete&&stats.vmCountStatus==='FINAL';
        finished={ok:!!summary,stats:{...stats},hashes:summary?{raw:summary.sourceBundleSha256,instrumented:summary.instrumentedBundleSha256}:null};return finished;
    }
    return {stdout,stderr,finish};
}

function publicReport(report) {
    if(report.scope==='NATIVE_ONLY')return {status:report.status==='PASS'?'PASS':'FAIL',scope:'NATIVE_ONLY',sql:'UNRUN',crossProviderParity:'UNRUN_SINGLE_PROVIDER',profiles:report.profiles.map(p=>({id:PROFILES.includes(p.id)?p.id:null,status:['PASS','FAIL','UNRUN'].includes(p.status)?p.status:'UNRUN',outcome:p.outcome==='PROVEN'?'PROVEN':'UNKNOWN',phase:['PREFLIGHT','DISK','RULE_IDENTITY','CAPTURE_SETUP','INITIAL_RECEIPT','OWNED_WRAPPER','CHILD_OUTPUT','NATIVE_SNAPSHOT','CHILD_EVIDENCE'].includes(p.failure)?p.failure:null,category:['PREFLIGHT_FAILED','ASSERTION_FAILED','SYNTAX_ERROR','TYPE_ERROR','ERROR'].includes(p.category)?p.category:null,ownerDiagnostic:projectOwnerFailure(p.ownerDiagnostic),childDiagnostic:projectChildFailure(p.childDiagnostic,p.id),output:p.output?Object.fromEntries(['stdoutBytes','stderrBytes','unexpectedLines','failureLines','skipLines','warningLines','vmWarnings','vmErrors','vmUnsupported','vmCountStatus','overflow','streamCountsComplete','countsComplete'].map(k=>[k,p.output[k]])):null})),sourceHashes:report.sourceHashes&&HASH.test(report.sourceHashes.raw)&&HASH.test(report.sourceHashes.instrumented)?{raw:report.sourceHashes.raw,instrumented:report.sourceHashes.instrumented}:null,emulatorJarSHA256:HASH.test(report.emulatorJarSHA256||'')?report.emulatorJarSHA256:null,nativeRulesSha256:HASH.test(report.nativeRulesSha256||'')?report.nativeRulesSha256:null,nativeRulesHashStatus:HASH.test(report.nativeRulesSha256||'')&&['OBSERVED_PRECHECK','VERIFIED_AFTER'].includes(report.nativeRulesHashStatus)?report.nativeRulesHashStatus:'UNAVAILABLE',emulatorJarHashStatus:HASH.test(report.emulatorJarSHA256||'')&&report.emulatorJarHashStatus==='REPORTED_BY_OWNER'?'REPORTED_BY_OWNER':'UNAVAILABLE',batchSha256:HASH.test(report.batchSha256||'')?report.batchSha256:null};
    return {status:report.status==='PASS'?'PASS':'FAIL',profiles:PROFILES.map(id=>{const p=report.profiles.find(x=>x.id===id);return {id,status:['PASS','FAIL','UNRUN'].includes(p?.status)?p.status:'UNRUN',output:p?.output?{stdoutBytes:p.output.stdoutBytes,stderrBytes:p.output.stderrBytes,unexpectedLines:p.output.unexpectedLines,failureLines:p.output.failureLines,skipLines:p.output.skipLines,warningLines:p.output.warningLines,vmWarnings:p.output.vmWarnings,vmErrors:p.output.vmErrors,vmUnsupported:p.output.vmUnsupported,vmCountStatus:p.output.vmCountStatus,overflow:p.output.overflow,streamCountsComplete:p.output.streamCountsComplete,countsComplete:p.output.countsComplete}:null};}),
        sourceHashes:report.sourceHashes&&HASH.test(report.sourceHashes.raw)&&HASH.test(report.sourceHashes.instrumented)?{raw:report.sourceHashes.raw,instrumented:report.sourceHashes.instrumented}:null,
        emulatorJarSHA256:HASH.test(report.emulatorJarSHA256||'')?report.emulatorJarSHA256:null};
}

// BEGIN PRIVATE NATIVE SNAPSHOT HOOK
const snapshotFeature=(()=>{

// Isolated proof-of-design: integrate into the paired runner, not the shared
// owned-rtdb-command. No environment value is accepted as emulator identity.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), {performance}=require('perf_hooks'), {constants:osConstants}=require('os');
const { TextDecoder } = require('util');
const LIMIT = 4 * 1024 * 1024, DEADLINE_MS = 3000;
const PROFILES = new Set(['I100-cookie-unsigned','I100-cookie-signed','I100-cookie-mixed','I100-cookie-mixed-same-group',
    'I100-palm-unsigned','I100-palm-signed','I100-palm-mixed','I100-palm-mixed-same-group']);
const PHONES = new Set(Array.from({length:8},(_,i) => '09' + String(10000000+i)));
const ROOTS = new Set(['zoew_barcode_registry','zoew_scan_operations','zoew_scan_pending','zoew_scan_history_cod_dod','zoew_recently_deleted_cod_dod',
 'zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod','zoew_daily_collected_cod_dod','zoew_daily_pickup_cod_dod',
 'zoew_write_receipts','zoew_registry_releases','zoew_trash_consumptions']);
const FIELDS = new Set(['actorUid','barcode','barcodes','birth','closedAt','cod','codDollar','code','count','createdAt','dod','dodDollar',
 'id','intent','isCalled','isClosed','locker','month','monthToken','op','ops','origins','packagesPickedUp','payloadHash','phase','phone',
 'pickupResetEpoch','pickupRevision','price','registryKey','scanDate','scope','targetId','time','totalCount','v','c','d','isDeducted',
 'isFromDeletion','scanIntent','ztoSignedAt','uid','at','hash','scanPending','pickedUpBarcodes','pickedUpPhones']);
const TEXT_FIELDS = new Set(['actorUid','barcode','code','id','intent','locker','month','monthToken','op','payloadHash','phase','phone',
 'registryKey','scanDate','scope','targetId','time','scanIntent','uid','hash']);
const NUMBER_FIELDS = new Set(['birth','closedAt','cod','codDollar','count','createdAt','dod','dodDollar','packagesPickedUp',
 'pickupResetEpoch','pickupRevision','price','totalCount','v','c','d','ztoSignedAt','at']);
const INTEGER_FIELDS = new Set(['birth','closedAt','count','createdAt','packagesPickedUp','pickupResetEpoch','pickupRevision','totalCount','v','ztoSignedAt','at']);
const BOOLEAN_FIELDS = new Set(['isCalled','isClosed','isDeducted','isFromDeletion']);
const DYNAMIC_KEY = /^(?:SYNTHETIC(?:[0-9]|[1-9][0-9])|scan_[a-f0-9]{32}|native_[a-f0-9]{32}|id_[0-9]{1,16}_[a-z0-9]{1,9}|op_[a-z]?[a-f0-9]{1,32}|[0-9]{4}-[0-9]{2}(?:-[0-9]{2})?|[0-9]{1,3})$/;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function sameIdentity(a,b){return !!a&&!!b&&a.pid===b.pid&&a.start===b.start&&a.exe===b.exe&&Array.isArray(a.args)&&Array.isArray(b.args)&&a.args.length===b.args.length&&a.args.every((value,index)=>value===b.args[index]);}
function reason(code){const error=new Error(code);error.category=code;return error;}
function category(error){return typeof error?.category==='string'&&/^[A-Z_]{1,48}$/.test(error.category)?error.category:'INTERNAL_ERROR';}
// The existing owner registers its abort callback after awaiting child spawn.
// Deliver an already-fired abort to that late listener once; otherwise delegate.
function raceSafeSignal(signal){
 if(!signal)return undefined;
 if(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function')throw new TypeError('invalid abort signal');
 const registered=new Map();
 return {get aborted(){return signal.aborted;},addEventListener(type,listener,options){
  if(type!=='abort'||typeof listener!=='function')throw new TypeError('unsupported abort listener');
  if(registered.has(listener))return;let delivered=false;
  const wrapped=event=>{if(delivered)return;delivered=true;signal.removeEventListener('abort',wrapped);registered.delete(listener);listener.call(signal,event);};
  registered.set(listener,wrapped);signal.addEventListener('abort',wrapped,options);
  if(signal.aborted)wrapped({type:'abort'});
 },removeEventListener(type,listener){const wrapped=registered.get(listener);if(wrapped){registered.delete(listener);signal.removeEventListener(type,wrapped);}}};
}
function childStatus(result){return {code:Number.isInteger(result?.code)&&result.code>=0&&result.code<=255?result.code:null,
 signal:typeof result?.signal==='string'&&Object.prototype.hasOwnProperty.call(osConstants.signals,result.signal)?result.signal:null,
 outputPresent:result?.outputPresent===true,failureLine:result?.failureLine===true,skipLine:result?.skipLine===true,
 ...(result?.error?{error:'CHILD_PROCESS_ERROR'}:{})};}

function validateMarker(value,profile,pid){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='namespace,pid,profile,schema')throw reason('MARKER_INVALID');
 if(value.schema!==1||value.profile!==profile||!PROFILES.has(profile)||!Number.isSafeInteger(pid)||pid<1||value.pid!==pid)throw reason('MARKER_MISMATCH');
 if(typeof value.namespace!=='string'||!new RegExp('^paired-import-'+String(pid)+'-[a-f0-9]{8}$').test(value.namespace))throw reason('MARKER_MISMATCH');
 return value.namespace;
}
function validateSynthetic(root, namespace){
 if(root===null)return;
 if(!root||typeof root!=='object'||Array.isArray(root))throw reason('ROOT_INVALID');
 if(Object.keys(root).some(key=>!ROOTS.has(key)))throw reason('NON_SYNTHETIC_CONTENT');
 let nodes=0;
 const visit=(value,key,level)=>{
  if(++nodes>200000)throw reason('ROOT_LIMIT');
  if(/^(authorization|password|access_token|refresh_token|cookie|secret|api_key)$/i.test(key))throw reason('SENSITIVE_CONTENT');
  if(level>1&&!FIELDS.has(key)&&!DYNAMIC_KEY.test(key))throw reason('NON_SYNTHETIC_CONTENT');
  if(TEXT_FIELDS.has(key)&&typeof value!=='string')throw reason('NON_SYNTHETIC_CONTENT');
  if(NUMBER_FIELDS.has(key)&&typeof value!=='number')throw reason('ROOT_INVALID');
  if(INTEGER_FIELDS.has(key)&&!Number.isSafeInteger(value))throw reason('ROOT_INVALID');
  if(BOOLEAN_FIELDS.has(key)&&typeof value!=='boolean')throw reason('ROOT_INVALID');
  if(typeof value==='string'){
   if(/\bbearer\s+\S+/i.test(value)||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)||/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(value))throw reason('SENSITIVE_CONTENT');
   const safe=value===''||value==='N/A'||value==='cn'||value==='import-owner'||['admitted','prepared','committed','cancelled'].includes(value)
    ||PHONES.has(value)||DYNAMIC_KEY.test(value)||/^[a-f0-9]{64}$/.test(value)||/^[0-9]{2}:[0-9]{2}:[0-9]{2} \([0-9]{4}-[0-9]{2}-[0-9]{2}\)$/.test(value)
    ||value==='http://127.0.0.1:9000/?ns='+namespace;
   if(!safe||key==='phone'&&!PHONES.has(value)||(key==='code'||key==='barcode'||key==='registryKey')&&!/^SYNTHETIC(?:[0-9]|[1-9][0-9])$/.test(value)
    ||(key==='actorUid'||key==='uid')&&value!=='import-owner'||key==='scope'&&value!=='http://127.0.0.1:9000/?ns='+namespace
    ||key==='phase'&&!['admitted','prepared','committed','cancelled'].includes(value)
    ||(key==='hash'||key==='payloadHash')&&!/^[a-f0-9]{64}$/.test(value)
    ||key==='targetId'&&!/^id_[0-9]{1,16}_[a-z0-9]{1,9}$/.test(value))throw reason('NON_SYNTHETIC_CONTENT');
  } else if(typeof value==='number'&&(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER))throw reason('ROOT_INVALID');
  else if(value&&typeof value==='object')for(const [childKey,child] of Object.entries(value))visit(child,childKey,level+1);
 };
 visit(root,'',0);
}
function summarize(root,raw,namespace){
 validateSynthetic(root,namespace);
 const operations=root&&root.zoew_scan_operations;
 if(operations!==undefined&&operations!==null&&(typeof operations!=='object'||Array.isArray(operations)))throw reason('OPERATIONS_INVALID');
 const rows=Object.entries(operations||{}).map(([key,value])=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw reason('OPERATIONS_INVALID');
  return {idSha256:digest(key),valueSha256:digest(JSON.stringify(value)),phase:['admitted','prepared','committed','cancelled'].includes(value.phase)?value.phase:'OTHER'};
 }).sort((a,b)=>a.idSha256.localeCompare(b.idSha256));
 const operationStatus=root===null?'UNAVAILABLE_ROOT_EMPTY':operations===undefined||operations===null?'UNAVAILABLE_NO_INDEX':'OBSERVED_CURRENT_INDEX';
 return {rootSha256:digest(raw),rootState:root===null?'EMPTY':'NONEMPTY',operationStatus,operationCount:operationStatus==='OBSERVED_CURRENT_INDEX'?rows.length:null,operations:rows};
}

// The destination is fixed to the verified loopback emulator; namespace is
// validated separately before this is called. The timeout aborts the request.
function readRoot(namespace, timeoutMs=DEADLINE_MS, httpImpl=http){
 return new Promise((resolve,reject)=>{
  if(typeof namespace!=='string'||!/^paired-import-[1-9][0-9]*-[a-f0-9]{8}$/.test(namespace))return reject(reason('MARKER_MISMATCH'));
  let settled=false,timer,req;
  const finish=(error,value)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);error?reject(error):resolve(value);};
  try{
   req=httpImpl.request({hostname:'127.0.0.1',port:9000,path:'/.json?ns='+encodeURIComponent(namespace),method:'GET',headers:{Authorization:'Bearer owner'},agent:false},res=>{
    let buffer;try{buffer=Buffer.allocUnsafe(LIMIT);}catch(_){finish(reason('READ_ERROR'));req.destroy();return;}let bytes=0;
    res.on('data',chunk=>{if(settled)return;try{if(!Buffer.isBuffer(chunk))throw new Error('unexpected stream chunk');if(chunk.length>LIMIT-bytes){finish(reason('ROOT_TOO_LARGE'));req.destroy();return;}chunk.copy(buffer,bytes);bytes+=chunk.length;}catch(_){finish(reason('READ_ERROR'));req.destroy();}});
    res.on('error',()=>finish(reason('READ_ERROR')));res.on('aborted',()=>finish(reason('READ_ABORTED')));
    res.on('end',()=>{if(settled)return;if(res.statusCode!==200)return finish(reason('READ_REFUSED'));try{finish(null,new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytes)));}catch(_){finish(reason('READ_ENCODING'));}});
   });
   req.on('error',()=>finish(reason('READ_ERROR')));timer=setTimeout(()=>{finish(reason('READ_TIMEOUT'));req.destroy();},timeoutMs);req.end();
  }catch(_){finish(reason('READ_ERROR'));}
 });
}
async function readMarker(file, io=fs.promises){
 const handle=await io.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const stat=await handle.stat();if(!stat.isFile()||(stat.mode&0o777)!==0o600||typeof process.getuid==='function'&&stat.uid!==process.getuid()||stat.size<2||stat.size>2048)throw reason('MARKER_INVALID');
  return JSON.parse(await handle.readFile({encoding:'utf8'}));
 }finally{await handle.close();}
}
async function writeReceipt(file, value, io=fs.promises){
 const handle=await io.open(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{const privateFile=stat=>stat.isFile()&&(stat.mode&0o777)===0o600&&(typeof process.getuid!=='function'||stat.uid===process.getuid());
  if(!privateFile(await handle.stat()))throw reason('RECEIPT_INVALID');
  const bytes=Buffer.from(JSON.stringify(value)+'\n');await handle.writeFile(bytes);await handle.sync();const after=await handle.stat();
  if(!privateFile(after)||after.size!==bytes.length)throw reason('RECEIPT_INVALID');return digest(bytes);}
 finally{await handle.close();}
}
function createSnapshotAdapters(base, options){
 const {stateDir,profile,io=fs.promises,timeoutMs=DEADLINE_MS}=options||{};
 const read=options?.readRoot||((namespace,ms)=>readRoot(namespace,ms,options?.httpImpl||http));
 if(!path.isAbsolute(stateDir||'')||!PROFILES.has(profile)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>3000)throw new Error('invalid snapshot scope');
 const markerPath=path.join(stateDir,'native-marker.json'),receiptPath=path.join(stateDir,'native-snapshot.json'),initialPath=path.join(stateDir,'native-snapshot-initial.json');
 let engine=null,engineIdentity=null,lastReceipt=null,activeChild=null,snapshotPromise=null,prepareStarted=false;
 async function prepare(){
  if(prepareStarted)throw new Error('initial snapshot receipt already attempted');prepareStarted=true;
  const work=(async()=>{await io.mkdir(stateDir,{mode:0o700});const dir=await io.lstat(stateDir);
   if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o077)!==0||typeof process.getuid==='function'&&dir.uid!==process.getuid())throw reason('STATE_DIRECTORY_INVALID');
   const initial={schema:1,state:'NOT_ATTEMPTED',reason:'CAPTURE_NOT_COMPLETED',finality:'UNKNOWN',profile};const receiptSha256=await writeReceipt(initialPath,initial,io);
   const handle=await io.open(initialPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const st=await handle.stat();if(!st.isFile()||(st.mode&0o777)!==0o600||typeof process.getuid==='function'&&st.uid!==process.getuid())throw reason('INITIAL_RECEIPT_INVALID');const bytes=await handle.readFile();if(digest(bytes)!==receiptSha256)throw reason('INITIAL_RECEIPT_INVALID');}finally{await handle.close();}
   return {state:'NOT_ATTEMPTED',reason:'CAPTURE_NOT_COMPLETED',finality:'UNKNOWN',receipt:'PRIVATE_0600',receiptSha256};})();
  let timer;const began=performance.now();try{const value=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(reason('INITIAL_RECEIPT_TIMEOUT')),timeoutMs);})]);if(performance.now()-began>timeoutMs)throw reason('INITIAL_RECEIPT_TIMEOUT');return value;}finally{clearTimeout(timer);}
 }
 async function capture(pid,checker){
  const start=performance.now(),readBudget=Math.max(1,Math.floor(timeoutMs*0.75));let receipt;
  const within=async(promise,ms,code)=>{let timer;const began=performance.now(),budget=Math.max(1,ms);try{const value=await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(reason(code)),budget);})]);if(performance.now()-began>budget)throw reason(code);return value;}finally{clearTimeout(timer);}};
  const readLeft=()=>Math.max(1,readBudget-(performance.now()-start));
  try{
   let dir;try{dir=await within(io.lstat(stateDir),readLeft(),'SNAPSHOT_TIMEOUT');}catch(error){throw error?.category?error:reason('STATE_DIRECTORY_UNREADABLE');}
   if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o077)!==0||typeof process.getuid==='function'&&dir.uid!==process.getuid())throw reason('STATE_DIRECTORY_INVALID');
   let marker;try{marker=await within(readMarker(markerPath,io),readLeft(),'SNAPSHOT_TIMEOUT');}catch(error){throw error?.category?error:reason('MARKER_UNREADABLE');}
   const namespace=validateMarker(marker,profile,pid);
   const checkOwner=()=>{let current;try{current=base.identity(engineIdentity?.pid);if(!sameIdentity(engineIdentity,current)||!base.ownsListener(engineIdentity))throw reason('OWNER_UNPROVEN');}catch(error){throw error?.category?error:reason('OWNER_UNPROVEN');}};
   checkOwner();let raw;try{raw=await within(read(namespace,readLeft()),readLeft(),'SNAPSHOT_TIMEOUT');}catch(error){throw error?.category?error:reason('READ_ERROR');}
   checkOwner();let root;try{if(typeof raw!=='string'||Buffer.byteLength(raw)>LIMIT)throw reason('ROOT_TOO_LARGE');root=JSON.parse(raw);}catch(error){throw error?.category?error:reason('ROOT_UNREADABLE');}
    const summary=summarize(root,raw,namespace);
    receipt={schema:1,state:'OBSERVED_POINT_IN_TIME_ONLY',finality:'UNKNOWN',lateEffects:'POSSIBLE',profile,namespace,checker,summary,root};
  }catch(error){receipt={schema:1,state:'UNREADABLE',reason:category(error),finality:'UNKNOWN',profile,checker};}
  const left=timeoutMs-(performance.now()-start);
  if(left<=0)return {state:'UNREADABLE',reason:'SNAPSHOT_TIMEOUT',receipt:'UNWRITTEN'};
  try{const receiptSha256=await within(writeReceipt(receiptPath,receipt,io),left,'RECEIPT_TIMEOUT');
   return {state:receipt.state,receiptSha256,receipt:'PRIVATE_0600',...(receipt.reason?{reason:receipt.reason}:{})};
  }catch(error){return {state:'UNREADABLE',reason:category(error)==='RECEIPT_TIMEOUT'?'RECEIPT_TIMEOUT':'RECEIPT_WRITE_FAILED',receipt:'UNKNOWN'};}
 }
 function ensureSnapshot(pid,status){if(!snapshotPromise)snapshotPromise=capture(pid,status).then(value=>{lastReceipt=value;return value;});return snapshotPromise;}
 const adapters={...base,
  launch(...args){engine=base.launch(...args);const started=engine.spawned;engine.spawned=started.then(()=>{engineIdentity=base.identity(engine.child.pid);});return engine;},
  command(...args){const child=base.command(...args),exit=child.exit;activeChild=child;child.exit=Promise.resolve(exit).catch(()=>({code:null,signal:null,outputPresent:false,failureLine:true,skipLine:false,error:'CHILD_PROCESS_ERROR'})).then(async result=>{
   const status=childStatus(result);lastReceipt=await ensureSnapshot(child.child.pid,status);
   return {...status,failureLine:status.failureLine||lastReceipt.state!=='OBSERVED_POINT_IN_TIME_ONLY',nativeSnapshot:lastReceipt};
  });return child;},
  async within(promise,ms,label){try{return await base.within(promise,ms,label);}catch(error){
   if(activeChild&&(label==='Original checker KILL deadline'||label==='Original checker close deadline'))
    await ensureSnapshot(activeChild.child.pid,childStatus({code:null,signal:null,outputPresent:false,failureLine:true,skipLine:false,error:'CHILD_PROCESS_ERROR'}));
   throw error;
  }}
 };
 return {adapters,markerPath,receiptPath,initialPath,prepare,getReceipt:()=>lastReceipt};
}
return {LIMIT,DEADLINE_MS,raceSafeSignal,validateMarker,validateSynthetic,summarize,readMarker,writeReceipt,createSnapshotAdapters};

})();
// END PRIVATE NATIVE SNAPSHOT HOOK

function expected(profile) {
    const signed = profile.endsWith('-signed'), unsigned = profile.endsWith('-unsigned');
    return { barcodes: 100, unique: 100, registry: 100, closed: signed ? 100 : unsigned ? 0 : 50,
        dailyCount: 100, monthlyCount: 100, dailyCod: 27288, monthlyCod: 27288, dailyDod: 0, monthlyDod: 0,
        collected: signed ? 100 : unsigned ? 0 : 50, collectedCod: signed ? 27288 : unsigned ? 0 : 2465,
        collectedDod: 0, manualPickup: 0, operations: 100, committed: 100 };
}
function validateOwner(owner) {
    assert.equal(owner?.code, 0, 'owned wrapper failed');
    const report = owner.report;
    assert.equal(report?.status, 'PASS'); assert.equal(report.cleanup, true);
    assert.equal(report.ownedRuntimeStarted, true); assert.equal(report.commandStarted, true); assert.equal(report.commandCompleted, true);
    assert.equal(report.childResult?.code, 0); assert.equal(report.childResult.error,undefined); assert.equal(report.childResult.outputPresent, true);
    assert.equal(report.childResult.failureLine, false); assert.equal(report.childResult.skipLine, false);
    assert.equal(report.childResult.nativeSnapshot?.state,'OBSERVED_POINT_IN_TIME_ONLY');assert.equal(report.childResult.nativeSnapshot.receipt,'PRIVATE_0600');assert(HASH.test(report.childResult.nativeSnapshot.receiptSha256||''));
    assert.equal(report.owner?.port, 9000); assert.equal(report.owner.maxHeapMiB, 512);
    assert(HASH.test(report.owner.jarSHA256 || ''), 'owned emulator hash missing');
}
function validateResult(value, id, priorHashes, targetRoot) {
    assert.equal(value?.status, 'PASS_PAIRED_CORE_SELECTED_SCOPE'); assert.equal(value.cleanup, true);
    assert.equal(value.sourceRoot, targetRoot, 'child source root differs from selected source');
    assert.deepEqual(value.unrunProviders, [], 'paired success cannot omit a provider');
    const consoleCounts=value.vmConsole?.counts;
    assert(consoleCounts&&typeof consoleCounts==='object'&&!Array.isArray(consoleCounts),'VM console counts missing');
    assert.deepEqual(Object.keys(consoleCounts).sort(),['debug','error','info','log','trace','unsupported','warn']);
    for(const key of ['log','info','debug','trace','warn','error','unsupported']){assert(Number.isSafeInteger(consoleCounts[key])&&consoleCounts[key]>=0,'VM console count malformed');assert.equal(consoleCounts[key],0,'VM console output must fail');}
    assert.equal(value.vmConsole.overflow,false,'VM console overflow must fail');
    assert.deepEqual(value.declared, [id]); assert.equal(value.fixture?.size, 100);
    assert.equal(value.fixture?.phones, 8); assert.equal(value.fixture?.codCents, 27288); assert.equal(value.fixture?.dodCents, 0);
    assert(HASH.test(value.sourceBundleSha256 || '') && HASH.test(value.instrumentedBundleSha256 || ''), 'source bundle hashes missing');
    const hashes = { raw: value.sourceBundleSha256, instrumented: value.instrumentedBundleSha256 };
    if (priorHashes) assert.deepEqual(hashes, priorHashes, 'source changed between profiles');
    assert.deepEqual(value.caseLedger, [{ provider: 'native', id, status: 'PASS' }, { provider: 'sql', id, status: 'PASS' }]);
    assert.equal(value.cases?.length, 2); const cases = new Map(value.cases.map(row => [row.provider, row]));
    assert.equal(cases.size, 2); const native = cases.get('native'), sql = cases.get('sql'); assert(native && sql);
    for (const item of [native, sql]) {
        assert.equal(item.id, id); assert.equal(item.provider === 'native' || item.provider === 'sql', true);
        assert.equal(item.pass, true); assert.equal(item.size, 100); assert.deepEqual(item.assertions, ASSERTIONS);
        assert.deepEqual(item.logical, expected(id)); assert(HASH.test(item.batchSha256 || ''), 'batch hash missing');
    }
    assert.equal(native.batchSha256, sql.batchSha256, 'both providers must use the same complete input');
    assert(isDeepStrictEqual(native.logical, sql.logical), 'provider financial/count results differ');
    assert.equal(value.providerEvidence?.length, 2);
    const evidence = new Map(value.providerEvidence.map(row => [row.provider, row]));
    assert.equal(evidence.size, 2); const n = evidence.get('native')?.cleanup, s = evidence.get('sql')?.cleanup; assert(n && s);
    assert.equal(n.runtimeQuiescent, true); assert.equal(n.upstreamClosed, true); assert.equal(n.namespaceHeldDuringRuntime, false); assert.equal(n.rootEmpty, true);
    assert.equal(n.workflowSealed?.outcome, 'DRAINED'); assert.deepEqual(n.workflowSealed.failures, []);
    assert.equal(s.managerExited, true); assert.equal(s.dataRootRetained, true);
    assert(Number.isSafeInteger(s.sizeBytes) && s.sizeBytes >= 0); assert(path.isAbsolute(s.dataRoot || ''));
    assert(path.basename(s.dataRoot).startsWith('zoe-paired-pg-'), 'unexpected retained directory');
    assert.equal(s.stop?.outcome, 'STOPPED'); assert.equal(s.stop.stopped, true);
    assert.equal(s.stop.dataRoot, s.dataRoot); assert.equal(s.stop.sizeBytes, s.sizeBytes);
    assert.equal(s.stop.pid, s.manager?.pid); assert.deepEqual(s.stop.errors, []);
    assert.equal(s.fake?.quiescent, true); assert.equal(s.fake.requests, 0); assert.equal(s.fake.responses, 0);
    assert.equal(s.fake.handlers, 0); assert.equal(s.fake.sockets, 0); assert.equal(s.fake.errors, 0);
    assert.deepEqual(s.pgAfterClose?.pending, []); assert.deepEqual(s.pgAfterClose.errors, []);
    assert.equal(s.pgAfterClose.total, 0); assert.equal(s.pgAfterClose.idle, 0); assert.equal(s.pgAfterClose.waiting, 0);
    assert.equal(s.sealedWorkflow?.outcome, 'DRAINED'); assert.deepEqual(s.sealedWorkflow.failures, []);
    return { hashes, retainedBytes: s.sizeBytes, retainedPath: s.dataRoot };
}
// Fixed-category diagnostics only; never expose raw child errors or private data.
function projectOwnerFailure(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 const bool=x=>typeof x==='boolean'?x:null;
 return {status:['PASS','FAIL','UNRUN','UNKNOWN'].includes(v.status)?v.status:'UNKNOWN',cleanup:['WRAPPER_CONFIRMED','UNKNOWN'].includes(v.cleanup)?v.cleanup:'UNKNOWN',
  commandStarted:bool(v.commandStarted),commandCompleted:bool(v.commandCompleted),childCode:Number.isInteger(v.childCode)&&v.childCode>=0&&v.childCode<=255?v.childCode:null,
  childSignal:['NONE','SIGTERM','SIGKILL','SIGINT','OTHER','UNKNOWN'].includes(v.childSignal)?v.childSignal:'UNKNOWN',outputPresent:bool(v.outputPresent),failureLine:bool(v.failureLine),skipLine:bool(v.skipLine),
  snapshot:['OBSERVED_POINT_IN_TIME_ONLY','UNREADABLE','NOT_ATTEMPTED','UNKNOWN'].includes(v.snapshot)?v.snapshot:'UNKNOWN',
  snapshotReason:['MARKER_UNREADABLE','MARKER_INVALID','MARKER_MISMATCH','OWNER_UNPROVEN','READ_ERROR','SNAPSHOT_TIMEOUT','RECEIPT_TIMEOUT','RECEIPT_WRITE_FAILED','ROOT_INVALID','ROOT_UNREADABLE','ROOT_TOO_LARGE','NON_SYNTHETIC_CONTENT','SENSITIVE_CONTENT','ROOT_LIMIT','STATE_DIRECTORY_INVALID','STATE_DIRECTORY_UNREADABLE'].includes(v.snapshotReason)?v.snapshotReason:null};
}
// Aggregate values describe one synthetic post-timeout checkpoint, never finality.
function projectFailureAggregate(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const keys=['schema','evidence','availability','consistency','case','phase','error','counts'];
 if(Object.keys(value).sort().join(',')!==keys.slice().sort().join(',')||value.schema!==1||value.evidence!=='PRIVATE_CHILD_REPORTED'||!['AVAILABLE','UNAVAILABLE'].includes(value.availability)||value.consistency!=='POST_TIMEOUT_NONATOMIC'||value.case!=='I100-cookie-unsigned'||value.phase!=='FIRST_IMPORT'||value.error!=='AUTHORITATIVE_100_TIMEOUT')return null;
 const fields=['historyGroups','historyBarcodes','historyUniqueBarcodes','registryEntries','operationsAdmitted','operationsPrepared','operationsCommitted','operationsCancelled','operationsOther','journalStorageKeys','capturedEvents','pendingJournalOperations'];
 const counts=value.counts;if(!counts||typeof counts!=='object'||Array.isArray(counts)||Object.keys(counts).sort().join(',')!==fields.slice().sort().join(','))return null;
 if(counts.pendingJournalOperations!==null)return null;
 for(const key of fields){const n=counts[key];if(value.availability==='UNAVAILABLE'||key==='pendingJournalOperations'){if(n!==null)return null;}else if(!Number.isSafeInteger(n)||n<0||n>10000)return null;}
 if(value.availability==='AVAILABLE'&&(counts.operationsOther!==0||counts.historyUniqueBarcodes>100||counts.registryEntries>100||counts.historyUniqueBarcodes>counts.historyBarcodes||(counts.historyBarcodes>0&&(counts.historyGroups===0||counts.historyUniqueBarcodes===0))||counts.operationsAdmitted+counts.operationsPrepared+counts.operationsCommitted+counts.operationsCancelled>10000))return null;
 return {schema:1,evidence:'PRIVATE_CHILD_REPORTED',availability:value.availability,consistency:'POST_TIMEOUT_NONATOMIC',case:'I100-cookie-unsigned',phase:'FIRST_IMPORT',error:'AUTHORITATIVE_100_TIMEOUT',counts:Object.fromEntries(fields.map(key=>[key,counts[key]]))};
}
function projectChildFailure(v,id){
 if(!v||v.evidence!=='PRIVATE_CHILD_REPORTED')return null;
 const waits=['AUTHORITATIVE_100','ORIGINS_ACK_FENCE','AUTHORITATIVE_LISTENERS','FIRST_ACK_QUIESCENCE','FIRST_STATUS_QUIESCENCE','FIRST_POST_STATUS_ACK','REPEAT_ACK_QUIESCENCE','REPEAT_STATUS_QUIESCENCE','REPEAT_POST_STATUS_ACK','NATIVE_TRANSPORT_QUIESCENCE','BACKGROUND_QUIESCENCE'];
 const l=v.location,location=l&&l.file==='import-paired-sdk-test.js'&&['until','runCore','nativeBackend','ready','main'].includes(l.function)?{file:'import-paired-sdk-test.js',function:l.function}:null;
 return {evidence:'PRIVATE_CHILD_REPORTED',ledger:['FAIL','UNRUN','IN_PROGRESS'].includes(v.ledger)?v.ledger:'UNKNOWN',category:['WAIT_TIMEOUT_REPORTED','ASSERTION_REPORTED','OTHER_REPORTED'].includes(v.category)?v.category:'UNKNOWN',wait:waits.includes(v.wait)?v.wait:null,location,aggregate:id==='I100-cookie-unsigned'&&v.ledger==='FAIL'&&v.category==='WAIT_TIMEOUT_REPORTED'&&v.wait==='AUTHORITATIVE_100'?projectFailureAggregate(v.aggregate):null};
}
function summarizeOwnerFailure(owner){
 const r=owner?.report,c=r?.childResult,s=c?.nativeSnapshot;
 const snap=['OBSERVED_POINT_IN_TIME_ONLY','UNREADABLE','NOT_ATTEMPTED'].includes(s?.state)?s.state:'UNKNOWN';
 const reason=['MARKER_UNREADABLE','MARKER_INVALID','MARKER_MISMATCH','OWNER_UNPROVEN','READ_ERROR','SNAPSHOT_TIMEOUT','RECEIPT_TIMEOUT','RECEIPT_WRITE_FAILED','ROOT_INVALID','ROOT_UNREADABLE','ROOT_TOO_LARGE','NON_SYNTHETIC_CONTENT','SENSITIVE_CONTENT','ROOT_LIMIT','STATE_DIRECTORY_INVALID','STATE_DIRECTORY_UNREADABLE'].includes(s?.reason)?s.reason:null;
 return {status:['PASS','FAIL','UNRUN'].includes(r?.status)?r.status:'UNKNOWN',cleanup:r?.cleanup===true?'WRAPPER_CONFIRMED':'UNKNOWN',
  commandStarted:typeof r?.commandStarted==='boolean'?r.commandStarted:null,commandCompleted:typeof r?.commandCompleted==='boolean'?r.commandCompleted:null,
  childCode:Number.isInteger(c?.code)&&c.code>=0&&c.code<=255?c.code:null,
  childSignal:c?.signal===null?'NONE':['SIGTERM','SIGKILL','SIGINT'].includes(c?.signal)?c.signal:typeof c?.signal==='string'?'OTHER':'UNKNOWN',
  outputPresent:typeof c?.outputPresent==='boolean'?c.outputPresent:null,failureLine:typeof c?.failureLine==='boolean'?c.failureLine:null,skipLine:typeof c?.skipLine==='boolean'?c.skipLine:null,snapshot:snap,snapshotReason:reason};
}
function childFailureProjection(value,id,targetRoot){
 assert(PROFILES.includes(id));assert.equal(value?.schema,1);assert.equal(value.status,'FAIL');assert.equal(value.sourceRoot,targetRoot);
 assert.equal(value.caseSelection,id);assert.equal(value.providerSelection,'native');assert.deepEqual(value.declared,[id]);
 assert.equal(value.caseLedger?.length,1);const row=value.caseLedger[0];assert.equal(row.provider,'native');assert.equal(row.id,id);assert(['FAIL','UNRUN','IN_PROGRESS'].includes(row.status));assert.deepEqual(value.unrunProviders,row.status==='UNRUN'?['native','sql']:['sql']);
 assert(typeof value.error==='string'&&value.error.length<=1048576);
 const lines=value.error.split(/\r?\n/),first=lines[0],waits=new Map([
  [`Error: ពេលកំណត់៖ ${id} authoritative100`,'AUTHORITATIVE_100'],
  [`Error: ពេលកំណត់៖ ${id} all100 authoritative origins`,'ORIGINS_ACK_FENCE'],
  ['Error: ពេលកំណត់៖ authoritative listeners','AUTHORITATIVE_LISTENERS'],
  ['Error: ពេលកំណត់៖ loopback ACK quiescence','FIRST_ACK_QUIESCENCE'],
  ['Error: ពេលកំណត់៖ first status quiescence','FIRST_STATUS_QUIESCENCE'],
  ['Error: ពេលកំណត់៖ first post-status ACK quiescence','FIRST_POST_STATUS_ACK'],
  ['Error: ពេលកំណត់៖ repeat ACK quiescence','REPEAT_ACK_QUIESCENCE'],
  ['Error: ពេលកំណត់៖ repeat status quiescence','REPEAT_STATUS_QUIESCENCE'],
  ['Error: ពេលកំណត់៖ repeat post-status ACK quiescence','REPEAT_POST_STATUS_ACK'],
  ['Error: ពេលកំណត់៖ native transport quiescence','NATIVE_TRANSPORT_QUIESCENCE'],
  ['Error: ពេលកំណត់៖ background status/owned upstream quiescence','BACKGROUND_QUIESCENCE']]);
 const wait=waits.get(first)||null,category=wait?'WAIT_TIMEOUT_REPORTED':/^AssertionError(?: \[ERR_ASSERTION\])?:/.test(first)?'ASSERTION_REPORTED':'OTHER_REPORTED';
 let location=null;for(const line of lines.slice(1,30)){
  const m=/^\s*at (until|runCore|nativeBackend|ready|main) \((?:[^()\r\n]*\/)?audit-tools\/emu\/import-paired-sdk-test\.js:(\d{1,6}):(\d{1,4})\)$/.exec(line);
  if(m&&Number(m[2])>0&&Number(m[3])>0){location={file:'import-paired-sdk-test.js',function:m[1]};break;}
 }
 return {evidence:'PRIVATE_CHILD_REPORTED',ledger:row.status,category,wait,location,aggregate:id==='I100-cookie-unsigned'&&row.status==='FAIL'&&wait==='AUTHORITATIVE_100'?projectFailureAggregate(value.failureAggregate):null};
}
function readPrivateFailure(file){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let bytes;
 try{const st=fs.fstatSync(fd);assert(st.isFile()&&(st.mode&0o777)===0o600&&(typeof process.getuid!=='function'||st.uid===process.getuid()));assert(st.size>0&&st.size<=10*1024*1024);bytes=fs.readFileSync(fd);}
 finally{fs.closeSync(fd);}return JSON.parse(new (require('util').TextDecoder)('utf-8',{fatal:true}).decode(bytes));
}

// A native-only result is native evidence, not a paired-provider success.
function validateNativeResult(value,id,targetRoot,rulesHash) {
    assert(PROFILES.includes(id));assert.equal(value?.status,'NATIVE_ONLY_CORE');assert.equal(value.cleanup,true);
    assert.equal(value.sourceRoot,targetRoot);assert.equal(value.providerSelection,'native');assert.equal(value.caseSelection,id);assert.equal(value.crossProviderParity,'UNRUN_SINGLE_PROVIDER');assert(HASH.test(rulesHash||''));
    assert.deepEqual(value.unrunProviders,['sql']);assert.deepEqual(value.declared,[id]);
    assert.equal(value.fixture?.size,100);assert.equal(value.fixture?.phones,8);assert.equal(value.fixture?.codCents,27288);assert.equal(value.fixture?.dodCents,0);
    assert(HASH.test(value.sourceBundleSha256||'')&&HASH.test(value.instrumentedBundleSha256||''));
    const c=value.vmConsole?.counts;assert(c&&typeof c==='object'&&!Array.isArray(c));
    assert.deepEqual(Object.keys(c).sort(),['debug','error','info','log','trace','unsupported','warn']);
    for(const k of Object.keys(c))assert.equal(c[k],0);assert.equal(value.vmConsole.overflow,false);
    assert.deepEqual(value.caseLedger,[{provider:'native',id,status:'PASS'}]);assert.equal(value.cases?.length,1);
    const item=value.cases[0];assert.equal(item.provider,'native');assert.equal(item.id,id);assert.equal(item.pass,true);assert.equal(item.size,100);
    assert.deepEqual(item.assertions,ASSERTIONS);assert.deepEqual(item.logical,expected(id));assert(HASH.test(item.batchSha256||''));
    assert.equal(value.providerEvidence?.length,1);const n=value.providerEvidence[0];assert.equal(n.provider,'native');assert.equal(n.provenance?.ruleLoads,1);assert.equal(n.provenance.ruleSha256,rulesHash);
    assert.equal(n.cleanup?.runtimeQuiescent,true);assert.equal(n.cleanup.upstreamClosed,true);assert.equal(n.cleanup.namespaceHeldDuringRuntime,false);assert.equal(n.cleanup.rootEmpty,true);
    assert.equal(n.cleanup.workflowSealed?.outcome,'DRAINED');assert.deepEqual(n.cleanup.workflowSealed.failures,[]);
    return {hashes:{raw:value.sourceBundleSha256,instrumented:value.instrumentedBundleSha256},batchSha256:item.batchSha256};
}
async function runNativeProfile(options) {
    const {id,runOwned,getDiskFree,readChild,makeSnapshot,verifySnapshot,readRulesHash,readFailure,env,root,targetRoot,evidenceDir,ownerState,node,checker,signal}=options;
    assert(PROFILES.includes(id));for(const flag of ['RUNALL_STRICT','CRUD_FLOW_STRICT','SUPABASE_STRICT'])assert.equal(env[flag],'1');
    for(const value of [root,targetRoot,evidenceDir,ownerState,node,checker])assert(path.isAbsolute(value||''));
    assert.notEqual(ownerState,evidenceDir,'owner state and private evidence must be distinct');
    const report={status:'FAIL',scope:'NATIVE_ONLY',profiles:[{id,status:'UNRUN'}],sourceHashes:null,emulatorJarSHA256:null,targetRoot,retained:[],sql:'UNRUN'};
    const item=report.profiles[0],output=makeChildOutputGate(id,'native');let stage='DISK',outputComplete=false,owner=null,resultPath=null;
    try {
        const free=await getDiskFree();assert(typeof free==='bigint'&&free>=MIN_FREE_BYTES,'disk capacity unavailable or below floor');stage='RULE_IDENTITY';const rulesHash=await readRulesHash(targetRoot);assert(HASH.test(rulesHash||''));report.nativeRulesSha256=rulesHash;report.nativeRulesHashStatus='OBSERVED_PRECHECK';
        assert(!signal?.aborted,'interrupted before start');item.status='IN_PROGRESS';
        const captureDir=path.join(evidenceDir,id+'-capture');resultPath=path.join(evidenceDir,id+'.json');
        stage='CAPTURE_SETUP';const capture=makeSnapshot({stateDir:captureDir,profile:id,stdout:output.stdout,stderr:output.stderr});
        assert.equal(capture.markerPath,path.join(captureDir,'native-marker.json'));assert.equal(capture.receiptPath,path.join(captureDir,'native-snapshot.json'));assert.equal(capture.initialPath,path.join(captureDir,'native-snapshot-initial.json'));
        stage='INITIAL_RECEIPT';const initial=await capture.prepare();assert.equal(initial.state,'NOT_ATTEMPTED');assert.equal(initial.reason,'CAPTURE_NOT_COMPLETED');assert.equal(initial.finality,'UNKNOWN');assert.equal(initial.receipt,'PRIVATE_0600');assert(HASH.test(initial.receiptSha256||''));
        assert(!signal?.aborted,'interrupted before owned runtime');stage='OWNED_WRAPPER';
        const args=[node,checker,'--matrix=core','--provider=native','--case='+id];
        owner=await runOwned({stateDir:ownerState,args,cwd:root,env:{...env,IMPORTPAIRED_APP_DIR:targetRoot,IMPORTPAIRED_STRICT:'1',IMPORTPAIRED_CI_CASE:id,IMPORTPAIRED_CI_PROVIDER:'native',IMPORTPAIRED_RESULT:resultPath,IMPORTPAIRED_NATIVE_MARKER:capture.markerPath},signal:snapshotFeature.raceSafeSignal(signal)},capture.adapters);
        outputComplete=owner?.report?.commandCompleted===true&&!!owner.report.childResult&&!owner.report.childResult.error;if(HASH.test(owner?.report?.owner?.jarSHA256||'')){report.emulatorJarSHA256=owner.report.owner.jarSHA256;report.emulatorJarHashStatus='REPORTED_BY_OWNER';}
        assert(!signal?.aborted,'owned profile interrupted');validateOwner(owner);
        stage='CHILD_OUTPUT';const childOutput=output.finish();item.output=childOutput.stats;assert(childOutput.ok,'unexpected child output');
        const observed=owner.report.childResult.nativeSnapshot;assert.deepEqual(observed,capture.getReceipt());
        stage='NATIVE_SNAPSHOT';const namespace=await verifySnapshot(capture,observed,id);assert(typeof namespace==='string'&&/^paired-import-[0-9]+-[a-f0-9]{8}$/.test(namespace),'snapshot namespace absent');
        report.emulatorJarSHA256=owner.report.owner.jarSHA256;stage='CHILD_EVIDENCE';
        const child=await readChild(resultPath);assert.equal(child?.providerEvidence?.[0]?.provenance?.ns,namespace,'child and snapshot namespaces differ');const verified=validateNativeResult(child,id,targetRoot,rulesHash);assert.equal(await readRulesHash(targetRoot),rulesHash,'native rules changed during execution');assert.deepEqual(childOutput.hashes,verified.hashes);report.nativeRulesHashStatus='VERIFIED_AFTER';
        report.sourceHashes=verified.hashes;report.batchSha256=verified.batchSha256;item.status='PASS';item.outcome='PROVEN';report.status='PASS';
    }catch(error){item.status='FAIL';item.outcome='UNKNOWN';item.failure=stage;item.category=error?.name==='AssertionError'?'ASSERTION_FAILED':error?.name==='SyntaxError'?'SYNTAX_ERROR':error?.name==='TypeError'?'TYPE_ERROR':'ERROR';item.output=output.finish(outputComplete).stats;item.ownerDiagnostic=owner?summarizeOwnerFailure(owner):null;
        if(owner?.report?.commandCompleted===true&&owner.report.cleanup===true&&Number.isInteger(owner.report.childResult?.code)&&owner.report.childResult.code>0&&owner.report.childResult.signal===null&&!owner.report.childResult.error&&resultPath&&typeof readFailure==='function')try{item.childDiagnostic=childFailureProjection(await readFailure(resultPath),id,targetRoot);}catch(_){item.childDiagnostic=null;}
        item.errorType=['AssertionError','SyntaxError','Error','TypeError'].includes(error?.name)?error.name:'Error';item.errorHash=crypto.createHash('sha256').update(String(error?.message||error)).digest('hex');}
    return report;
}

function diskFree(dir) {
    const info = fs.statfsSync(dir, { bigint: true });
    if (typeof info.bavail !== 'bigint' || typeof info.bsize !== 'bigint' || info.bsize <= 0n) throw new Error('disk capacity unavailable');
    return info.bavail * info.bsize;
}
function readResult(file) {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        const stat = fs.fstatSync(fd); if (!stat.isFile() || stat.size <= 0 || stat.size > 10 * 1024 * 1024) throw new Error('invalid child evidence file');
        return JSON.parse(fs.readFileSync(fd, 'utf8'));
    } finally { fs.closeSync(fd); }
}
async function readPrivateSnapshot(capture, observed, profile) {
    const fd=fs.openSync(capture.receiptPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    let bytes;try{const st=fs.fstatSync(fd);assert(st.isFile()&&(st.mode&0o777)===0o600&&(typeof process.getuid!=='function'||st.uid===process.getuid()));assert(st.size>0&&st.size<=8*1024*1024);bytes=fs.readFileSync(fd);}finally{fs.closeSync(fd);}
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),observed.receiptSha256,'private snapshot digest mismatch');
    const proof=JSON.parse(new (require('util').TextDecoder)('utf-8',{fatal:true}).decode(bytes));
    assert.equal(proof.state,'OBSERVED_POINT_IN_TIME_ONLY');assert.equal(proof.finality,'UNKNOWN');assert.equal(proof.lateEffects,'POSSIBLE');assert.equal(proof.profile,profile);
    assert.equal(proof.checker?.code,0);assert.equal(proof.checker.signal,null);assert.equal(proof.checker.error,undefined);assert.equal(proof.checker.outputPresent,true);assert.equal(proof.checker.failureLine,false);assert.equal(proof.checker.skipLine,false);
    const marker=await snapshotFeature.readMarker(capture.markerPath);snapshotFeature.validateMarker(marker,profile,marker.pid);assert.equal(proof.namespace,marker.namespace);
    assert(HASH.test(proof.summary?.rootSha256||''));const check=snapshotFeature.summarize(proof.root,JSON.stringify(proof.root),proof.namespace);
    for(const key of ['rootState','operationStatus','operationCount','operations'])assert.deepEqual(proof.summary[key],check[key]);
    return proof.namespace;
}
async function runMatrix(options) {
    const { runOwned, getDiskFree, readChild, makeSnapshot, verifySnapshot, env, root, targetRoot, evidenceDir, node, checker, signal } = options;
    assert.equal(env.RUNALL_STRICT, '1'); assert.equal(env.CRUD_FLOW_STRICT, '1'); assert.equal(env.SUPABASE_STRICT, '1');
    assert(path.isAbsolute(root) && path.isAbsolute(targetRoot) && path.isAbsolute(evidenceDir) && path.isAbsolute(checker) && path.isAbsolute(node));
    const report = { status: 'FAIL', minFreeBytes: MIN_FREE_BYTES.toString(), profiles: PROFILES.map(id => ({ id, status: 'UNRUN' })),
        sourceHashes: null, emulatorJarSHA256: null, targetRoot, retained: [], limit: 'CI disk floor is a planning minimum, not a maximum or guarantee' };
    for (const item of report.profiles) {
        if (signal?.aborted) { item.reason = 'INTERRUPTED_BEFORE_START'; break; }
        let free;
        try { free = await getDiskFree(); } catch (_) { item.status = 'FAIL'; item.failure = 'DISK_CAPACITY_UNAVAILABLE'; break; }
        item.freeBytes = String(free);
        if (typeof free !== 'bigint' || free < MIN_FREE_BYTES) { item.status = 'FAIL'; item.failure = 'DISK_CAPACITY'; break; }
        if (signal?.aborted) { item.reason = 'INTERRUPTED_BEFORE_START'; break; }
        item.status = 'IN_PROGRESS';
        const resultPath = path.join(evidenceDir, item.id + '.json'), stateDir = path.join(evidenceDir, item.id + '-owner');
        const args = [node, checker, '--matrix=core', '--provider=both', '--case=' + item.id];
        let stage = 'OWNED_WRAPPER',outputComplete=false;const output=makeChildOutputGate(item.id);
        try {
            const capture=makeSnapshot({stateDir,profile:item.id,stdout:output.stdout,stderr:output.stderr});assert.equal(capture.markerPath,path.join(stateDir,'native-marker.json'));assert.equal(capture.receiptPath,path.join(stateDir,'native-snapshot.json'));assert.equal(capture.initialPath,path.join(stateDir,'native-snapshot-initial.json'));
            stage='INITIAL_RECEIPT';const initial=await capture.prepare();assert.equal(initial.state,'NOT_ATTEMPTED');assert.equal(initial.reason,'CAPTURE_NOT_COMPLETED');assert.equal(initial.finality,'UNKNOWN');assert.equal(initial.receipt,'PRIVATE_0600');assert(HASH.test(initial.receiptSha256||''));if(signal?.aborted)throw new Error('interrupted before owned runtime');stage='OWNED_WRAPPER';
            const owner = await runOwned({ stateDir, args, cwd: root,
                env: { ...env, IMPORTPAIRED_APP_DIR: targetRoot, IMPORTPAIRED_STRICT: '1', IMPORTPAIRED_CI_CASE: item.id, IMPORTPAIRED_RESULT: resultPath, IMPORTPAIRED_NATIVE_MARKER:capture.markerPath }, signal:snapshotFeature.raceSafeSignal(signal) },capture.adapters);
            outputComplete=owner?.report?.commandCompleted===true&&!!owner.report.childResult&&!owner.report.childResult.error;
            if (signal?.aborted) throw new Error('owned profile interrupted; database outcome unknown');
            validateOwner(owner);
            stage='CHILD_OUTPUT';const childOutput=output.finish();item.output=childOutput.stats;assert(childOutput.ok,'unexpected child output');
            const observed=owner.report.childResult.nativeSnapshot;assert.deepEqual(observed,capture.getReceipt(),'snapshot callback and owner result differ');
            stage='NATIVE_SNAPSHOT';await verifySnapshot(capture,observed,item.id);
            const jar = owner.report.owner.jarSHA256;
            if (report.emulatorJarSHA256 !== null) assert.equal(jar, report.emulatorJarSHA256, 'owned emulator changed between profiles');
            report.emulatorJarSHA256 = jar;
            stage = 'CHILD_EVIDENCE';
            const verified = validateResult(await readChild(resultPath), item.id, report.sourceHashes, targetRoot);
            assert.deepEqual(childOutput.hashes,verified.hashes,'public and private child hashes differ');report.sourceHashes = verified.hashes; report.retained.push({ id: item.id, bytes: verified.retainedBytes, path: verified.retainedPath });
            item.status = 'PASS';
        } catch (error) {
            item.status = 'FAIL'; item.failure = stage;item.output=output.finish(outputComplete).stats;
            item.pgOutcome = 'UNKNOWN';
            // Do not echo raw backend records or credentials; preserve evidence under private scope.
            item.errorType = ['AssertionError', 'SyntaxError', 'Error', 'TypeError'].includes(error?.name) ? error.name : 'Error';
            item.errorHash = crypto.createHash('sha256').update(String(error?.message || error)).digest('hex'); break;
        }
    }
    if (report.profiles.every(item => item.status === 'PASS')) report.status = 'PASS';
    return report;
}
async function main() {
    const args=process.argv.slice(2);
    if(args.length){
        assert.equal(args.length,2);assert.equal(args[1],'--provider=native');assert(args[0].startsWith('--case='));const id=args[0].slice('--case='.length);assert(PROFILES.includes(id));
        const root=path.resolve(process.env.ZOE_REPO_ROOT||path.join(__dirname,'../..')),targetRoot=path.resolve(process.env.IMPORTPAIRED_APP_DIR||root);
        const ownerState=process.env.IMPORTPAIRED_OWNER_STATE;assert(path.isAbsolute(ownerState||''));
        const state=fs.lstatSync(ownerState);assert(state.isDirectory()&&!state.isSymbolicLink()&&(state.mode&0o077)===0);if(typeof process.getuid==='function')assert.equal(state.uid,process.getuid());
        const {runOwnedCommand,productionAdapters}=require('../owned-rtdb-command.js'),tempRoot=os.tmpdir(),evidenceDir=fs.mkdtempSync(path.join(tempRoot,'zoe-paired-native-ci-'));
        const controller=new AbortController(),abort=()=>controller.abort();for(const event of ['SIGTERM','SIGINT','SIGHUP'])process.on(event,abort);
        try {
            const report=await runNativeProfile({id,runOwned:runOwnedCommand,getDiskFree:()=>diskFree(tempRoot),readChild:readResult,
                makeSnapshot:opts=>snapshotFeature.createSnapshotAdapters(productionAdapters({stdout:opts.stdout,stderr:opts.stderr}),opts),verifySnapshot:readPrivateSnapshot,
                readRulesHash:target=>crypto.createHash('sha256').update(fs.readFileSync(path.join(target,'firebase-database.rules.json'))).digest('hex'),readFailure:readPrivateFailure,
                env:process.env,root,targetRoot,evidenceDir,ownerState,node:process.execPath,checker:path.join(__dirname,'import-paired-sdk-test.js'),signal:controller.signal});
            report.evidenceDir=evidenceDir;fs.writeFileSync(path.join(evidenceDir,'native-report.json'),JSON.stringify(report)+'\n',{mode:0o600,flag:'wx'});
            console.log('IMPORT_PAIRED_CI_RESULT '+JSON.stringify(publicReport(report)));if(report.status!=='PASS'){console.error('FAIL native import case; evidence retained');process.exitCode=1;}
        }finally{for(const event of ['SIGTERM','SIGINT','SIGHUP'])process.removeListener(event,abort);}return;
    }
    assert.equal(process.argv.length, 2, 'runner accepts no case/provider overrides');
    const root = path.resolve(process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
    const targetRoot = path.resolve(process.env.IMPORTPAIRED_APP_DIR || root);
    const { runOwnedCommand,productionAdapters } = require('../owned-rtdb-command.js');
    const tempRoot = os.tmpdir();
    const evidenceDir = fs.mkdtempSync(path.join(tempRoot, 'zoe-paired-ci-'));
    const controller = new AbortController(), abort = () => controller.abort();
    for (const event of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(event, abort);
    try {
        const report = await runMatrix({ runOwned: runOwnedCommand, getDiskFree: () => diskFree(tempRoot), readChild: readResult, makeSnapshot:opts=>snapshotFeature.createSnapshotAdapters(productionAdapters({stdout:opts.stdout,stderr:opts.stderr}),opts), verifySnapshot:readPrivateSnapshot,
            env: process.env, root, targetRoot, evidenceDir, node: process.execPath, checker: path.join(__dirname, 'import-paired-sdk-test.js'), signal: controller.signal });
        report.evidenceDir = evidenceDir;
        fs.writeFileSync(path.join(evidenceDir,'matrix-report.json'),JSON.stringify(report)+'\n',{mode:0o600,flag:'wx'});
        console.log('IMPORT_PAIRED_CI_RESULT ' + JSON.stringify(publicReport(report)));
        if (report.status !== 'PASS') { console.error('FAIL paired import matrix incomplete; evidence retained'); process.exitCode = 1; }
    } finally { for (const event of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.removeListener(event, abort); }
}
module.exports = { PROFILES, ASSERTIONS, MIN_FREE_BYTES, expected, validateOwner, validateResult, diskFree, readResult, readPrivateSnapshot, runMatrix, makeChildOutputGate, publicReport, validateNativeResult, runNativeProfile, summarizeOwnerFailure, childFailureProjection, projectOwnerFailure, projectChildFailure, projectFailureAggregate, readPrivateFailure, ...snapshotFeature };
if (require.main === module) main().catch(() => {
    process.exitCode=1;const args=process.argv.slice(2),id=args.length===2&&args[1]==='--provider=native'&&args[0].startsWith('--case=')?args[0].slice(7):null;
    if(PROFILES.includes(id))console.log('IMPORT_PAIRED_CI_RESULT '+JSON.stringify(publicReport({status:'FAIL',scope:'NATIVE_ONLY',profiles:[{id,status:'FAIL',outcome:'UNKNOWN',failure:'PREFLIGHT',category:'PREFLIGHT_FAILED'}]})));
    console.error('FAIL paired import runner');
});
