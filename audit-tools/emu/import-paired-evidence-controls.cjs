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
 console.log(JSON.stringify({status:'PASS',scope:'private synthetic evidence and stdout canary; no backend',fixtureRetained:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
