'use strict';
// Exercise the actual isolated native cleanup body with fake, non-network resources.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const code=fs.readFileSync(path.join(__dirname,'import-paired-sdk-test.js'),'utf8');
const start=code.indexOf('close:async()=>{const before=await workflowLedger.drain(15000);');
const end=code.indexOf('}};\n}',start);assert(start>=0&&end>start);
const expression=code.slice(start+'close:'.length,end+1);assert(expression.endsWith('cleanupEvidence.runtimeQuiescent=true;}'));
function fixture(kind){let reads=0;const cleanupEvidence={runtimeQuiescent:false,upstreamClosed:false,namespaceHeld:false,rootEmpty:'UNVERIFIED'};
 let drainCount=0,sealed=false;const workflowLedger={drain:async()=>({outcome:kind==='pre-unknown'&&drainCount++===0||kind==='post-unknown'&&drainCount++===1?'UNKNOWN':sealed?'DRAINED':'EMPTY_SNAPSHOT'}),seal(){sealed=true;}};
 const ctx={assert,cleanupEvidence,workflowLedger,active:new Set(),lease:{active:false,held:kind==='held'},sockets:new Set(kind==='socket'?[{}]:[]),wirePending:new Set(),
  owner:async()=>{reads++;return kind==='foreign-root'?{synthetic:true}:null;},websocket:{Client:'wrapped'},original:'original',upstream:{close:async()=>{if(kind==='upstream-error')throw Error('owned upstream failure');}}};
 return {cleanupEvidence,ctx,reads:()=>reads,close:new Function('ctx','with(ctx){return ('+expression+');}')(ctx)};
}
(async()=>{
 const good=fixture('success');await good.close();assert.equal(good.cleanupEvidence.runtimeQuiescent,true);assert.equal(good.cleanupEvidence.workflowSealed.outcome,'DRAINED');assert.equal(good.cleanupEvidence.rootEmpty,true);assert.equal(good.reads(),1);assert.equal(good.ctx.websocket.Client,'original');
 const held=fixture('held');await held.close();assert.equal(held.cleanupEvidence.namespaceHeldDuringRuntime,true);assert.equal(held.cleanupEvidence.rootEmpty,'UNVERIFIED');assert.equal(held.reads(),0);
 for(const kind of ['pre-unknown','post-unknown','socket','foreign-root','upstream-error']){const f=fixture(kind);await assert.rejects(f.close());assert.equal(f.cleanupEvidence.runtimeQuiescent,false);if(kind==='pre-unknown')assert.equal(f.reads(),0);if(kind==='upstream-error')assert.equal(f.cleanupEvidence.upstreamClosed,false);}
 console.log(JSON.stringify({status:'PASS',scope:'native cleanup body with fake resources only; no native engine or backend'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
