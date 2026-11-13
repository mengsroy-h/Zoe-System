import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const ROOT = process.env.KEYGEN_CLOCK_SOURCE_ROOT || require('node:path').resolve(__dirname, '../../../..');
const acorn = require(ROOT + '/ZoeW/node_modules/acorn');
const licSource = fs.readFileSync(ROOT + '/ZoeW/public/license-verify.js', 'utf8');
const kgSource = fs.readFileSync(ROOT + '/ZoeKeyGen/app.js', 'utf8');
const ast = acorn.parse(kgSource, {ecmaVersion:'latest'});
const DAY = 86400000, T = Date.UTC(2026, 10, 8, 12);
const fn = name => {
  const n = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
  assert(n, 'actual function missing: '+name);
  return kgSource.slice(n.start,n.end);
};
const decl = name => {
  const n = ast.body.find(n => n.type === 'VariableDeclaration' && n.declarations.some(d=>d.id.name===name));
  assert(n, 'actual declaration missing: '+name);
  return kgSource.slice(n.start,n.end);
};
function env() {
  const clock={wall:T,mono:1000,real:T};
  class FakeDate extends Date { constructor(value?: string | number){super(value === undefined ? clock.wall : value);} static now(){return clock.wall;} }
  const store=new Map(), timers=new Map(); let tid=0;
  const c: Record<string, any>={console,Promise,Error,JSON,Object,Array,Number,String,Boolean,Math,Map,Set,RegExp,Uint8Array,TextEncoder,TextDecoder,AbortController,
    isNaN,isFinite,Date:FakeDate,performance:{now:()=>clock.mono}, navigator:{onLine:true},
    URL, crypto:{getRandomValues:a=>webcrypto.getRandomValues(a),subtle:{importKey:(...a)=>webcrypto.subtle.importKey(...a),sign:(...a)=>webcrypto.subtle.sign(...a),verify:async()=>true}},
    atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    setTimeout:(f,ms)=>{timers.set(++tid,{f,ms});return tid;},clearTimeout:id=>timers.delete(id),
    fetch:async()=>{throw Error('No synthetic route installed: production network prohibited');}};
  c.window=c; c.globalThis=c;
  vm.createContext(c);vm.runInContext(licSource,c);
  return {c,clock,store,timers,advance(ms){clock.wall+=ms;clock.real+=ms;clock.mono+=ms;},shift(ms){clock.wall+=ms;}};
}
function response(body,date=T){return {ok:true,status:200,redirected:false,headers:{get:n=>n==='Date'?(date===null?null:new Date(date).toUTCString()):n==='Content-Type'?'application/json':null},json:async()=>body};}
function keygen(h){
  const c=h.c, elements={};
  c.document={getElementById:id=>elements[id]||(elements[id]={value:'',textContent:'',disabled:false,classList:{add(){},remove(){}}})};
  c.__effects={writes:[],rpc:[],alerts:[],toasts:[],logout:0};
  Object.assign(c,{
    alert:s=>c.__effects.alerts.push(s),confirm:()=>true,showToast:s=>c.__effects.toasts.push(s),
    captureSensitiveSession:()=>({user:{uid:'synthetic-admin',email:'synthetic@example.invalid'}}),adminOperationIsCurrent:()=>true,
    retryAsync:async run=>run(),withTimeout:async p=>p,refreshKeyList(){},closeModal(){},
    clearInfoListenerRecovery(){},clearReconnectWatchdog(){},scheduleReconnectWatchdog(){},renderConnectionStatus(){},retryPendingRoleCheck(){},noteInfoListenerAlive(){},handleInfoListenerError(){},
    sbAdminIsCurrent:()=>true,sbInputValue:id=>elements[id]?.value||'',setSbAdminBusy(){},
    sbAdminRpc:async (s,name,payload)=>{c.__effects.rpc.push({name,payload});return {ok:true,body:{id:'synthetic-tenant'}};},sbIssueInvite:async()=>true,sbAdminRefresh:async()=>{},
    sbAdminErrorText:()=>'',invalidateSensitiveSession(){},updateSigningKeyBadge(){},requestSessionSigningKeyRestoreIfEligible(){},isPinFlowPending:()=>false,
    hasUncopiedKeypair:()=>false,lockKeygenSession(){},logoutApp(){c.__effects.logout++;},sbAdminReset(){},sbAdminRevoke(){}
  });
  const names=['RELEASE_PENDING_TEXT','serverTimeOffsetMs','serverTimeSynced','serverTimeSyncWaiters','infoListenerGeneration','INFO_LISTENER_KEY_CONNECTED','INFO_LISTENER_KEY_OFFSET','infoListenerFailedPaths','LICENSE_APP_CODE','LICENSE_SEAT_SLOT_NAMES','LICENSE_SEAT_MAX','signingPrivateKeyJwk','signingKeyLastUseAt','SIGNING_KEY_IDLE_MS','isGeneratingKey','generateKeyOwner','lastGeneratedKey','KEYGEN_IDLE_LOGOUT_MS','keygenLastActivityAt','SB_TENANT_DAYS_MAX','SB_BRANCH_CODE_RE','SB_ADMIN_IDLE_MS','sbAdminBusy','sbAdminGeneration','sbAdminLastUseAt'];
  const functions=['getTrustedServerNow','captureKeygenClock','keygenClockIsCurrent','getServerNow','waitForServerTimeSync','serverClockOffsetIsFromServer','detachInfoListeners','attachInfoListeners','seatLimitOf','generateLicenseKey','confirmExtendKey','releaseKeySeat','sbCreateTenant','elapsedSince','noteSigningKeyActivity','expireIdleSigningKey','noteKeygenActivity','expireIdleKeygenSession','khmerMinutes','expireIdleSbAdmin','sbAdminActivity'];
  const listeners={};
  c.__fb={off(){},onValue:(r,cb)=>listeners[r]=cb,ref:(d,p)=>p||'root',update:async (p,u)=>c.__effects.writes.push({p,u}),runTransaction:async(p,updater)=>{const val=updater(c.__expires);c.__effects.writes.push({p,val});return{committed:true,snapshot:{val:()=>val}};}};
  vm.runInContext(names.map(decl).join('\n')+`\nlet db={},fb=__fb,auth=null; let dbRefConnected='connected',dbRefServerTimeOffset='offset'; let isDatabaseConnected=false,hasEverConnectedToDatabase=false; let keyListSessionGeneration=1; let signingKeySessionKey=null; let authButtonIsLoggedIn=true; let extendTargetId='synthetic-key'; let keyListCache=[];let seatReadFailed=false;let sbAdminSession={id:'synthetic'}; const SB_ADMIN_ERROR_TEXT={};\n`+functions.filter(name => ast.body.some(n => n.type === 'FunctionDeclaration' && n.id.name === name)).map(fn).join('\n'),c);
  c.document.getElementById('genDaysInput').value='30';c.document.getElementById('genDevicesInput').value='1';c.document.getElementById('genNoteInput').value='';
  c.document.getElementById('sbTenantNameInput').value='Synthetic';c.document.getElementById('sbTenantBranchInput').value='SYN';c.document.getElementById('sbTenantDaysInput').value='30';
  h.sync=()=>{c.ZoeLicense.setServerTimeOffset(h.clock.real-h.clock.wall);c.__offset=h.clock.real-h.clock.wall;vm.runInContext('serverTimeSynced=true;serverTimeOffsetMs=__offset',c);};
  h.listeners=listeners;
  return h;
}

async function settle(h, run) {
  let done = false;
  const task = run().finally(() => { done = true; });
  for (let i = 0; i < 100 && !done; i++) await new Promise(resolve => setImmediate(resolve));
  if (!done) { for (const timer of [...h.timers.values()]) timer.f(); }
  await task;
}
async function signer() {
  const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey);
  const h=keygen(env());h.c.__jwk=jwk;vm.runInContext('signingPrivateKeyJwk=__jwk',h.c);h.sync();
  return {h,pair};
}
function written(h) { return h.c.__effects.writes[0] && Object.values(h.c.__effects.writes[0].u) as Array<{expiresAt: number; issuedAt: number}>; }
function signed(h) { return h.c.ZoeLicense.parseKeyString(vm.runInContext('lastGeneratedKey',h.c)); }
async function extend(h) {
  h.c.__expires=T+DAY;
  vm.runInContext("keyListCache=[{id:'synthetic-key',paths:['ZOE'],perApp:{ZOE:{expiresAt:__expires}}}]",h.c);
  h.c.document.getElementById('extendDaysInput').value='30';
  await settle(h,()=>h.c.confirmExtendKey());
}
it('Generate៖ ម៉ោងត្រឹមត្រូវរក្សាហត្ថលេខាពិត និងថ្ងៃ ៣០ ដូចគ្នា',async()=>{
  const {h,pair}=await signer();h.advance(1234);
  await settle(h,()=>h.c.generateLicenseKey());
  expect(h.c.__effects.writes).toHaveLength(1);const p=signed(h);
  expect(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,p.sigBytes,new TextEncoder().encode(p.payloadB64))).toBe(true);
  expect(written(h)[0].expiresAt).toBe(p.payload.exp*1000);
  expect(written(h)[1].issuedAt).toBe(p.payload.iat*1000);
  expect(p.payload.exp-p.payload.iat).toBe(30*86400);
});
for(const skew of [-400*DAY,400*DAY]) it('Generate៖ clock skew '+skew+' មិនចេញ Key',async()=>{
  const {h}=await signer();h.shift(skew);await settle(h,()=>h.c.generateLicenseKey());
  expect(h.c.__effects.writes).toHaveLength(0);
});
it('Generate៖ យឺតពេល sign រក្សាថ្ងៃ signed និង DB ដូចគ្នា',async()=>{
  const {h}=await signer();h.c.crypto.subtle.sign=async(...args)=>{const result=await webcrypto.subtle.sign(...args);h.advance(1500);return result;};
  await settle(h,()=>h.c.generateLicenseKey());expect(h.c.__effects.writes).toHaveLength(1);
  expect(written(h)[0].expiresAt).toBe(signed(h).payload.exp*1000);
  expect(written(h)[1].issuedAt).toBe(signed(h).payload.iat*1000);
});
for(const recover of [false,true]) it('Generate៖ clock uncertainty ពេល sign'+(recover?' និង sync ថ្មី':'')+' បោះបង់ការសរសេរចាស់',async()=>{
  const {h}=await signer();h.c.crypto.subtle.sign=async(...args)=>{const result=await webcrypto.subtle.sign(...args);h.shift(400*DAY);if(recover)h.sync();return result;};
  await settle(h,()=>h.c.generateLicenseKey());expect(h.c.__effects.writes).toHaveLength(0);
});
it('Generate៖ sync ថ្មីគ្មាន uncertainty មិនរារាំង operation',async()=>{
  const {h}=await signer();h.c.crypto.subtle.sign=async(...args)=>{const result=await webcrypto.subtle.sign(...args);h.advance(1500);h.sync();return result;};
  await settle(h,()=>h.c.generateLicenseKey());expect(h.c.__effects.writes).toHaveLength(1);
  expect(written(h)[0].expiresAt).toBe(signed(h).payload.exp*1000);
});
it('Generate៖ sync ដាច់ដោយឡែកជួសជុលម៉ោងទាំងពីរ',async()=>{
  const {h}=await signer();h.shift(400*DAY);h.c.fetch=async url=>response({nonce:new URL(url).searchParams.get('nonce'),now:T});
  expect(await h.c.ZoeLicense.syncServerTime()).toBe(true);await settle(h,()=>h.c.generateLicenseKey());
  expect(h.c.__effects.writes).toHaveLength(1);expect(written(h)[0].expiresAt).toBe(T+30*DAY);
  expect(written(h)[0].expiresAt).toBe(signed(h).payload.exp*1000);
});
it('Generate៖ uncertainty មុន retry មិនចេញ write ថ្មី',async()=>{
  const {h}=await signer();let calls=0;h.c.__fb.update=async()=>{calls++;throw Error('synthetic transient');};
  h.c.retryAsync=async run=>{try{return await run();}catch{h.shift(400*DAY);h.sync();return run();}};
  await settle(h,()=>h.c.generateLicenseKey());expect(calls).toBe(1);
});
it('Tenant៖ មិនមាន trusted time មិនផ្ញើ RPC',async()=>{
  const h=keygen(env());h.shift(400*DAY);await settle(h,()=>h.c.sbCreateTenant());
  expect(h.c.__effects.rpc).toHaveLength(0);expect(vm.runInContext('sbAdminBusy',h.c)).toBe(false);
});
it('Tenant៖ fresh endpoint time អនុញ្ញាតថ្ងៃ ៣០',async()=>{
  const h=keygen(env());h.shift(400*DAY);h.c.fetch=async url=>response({nonce:new URL(url).searchParams.get('nonce'),now:T});
  await settle(h,()=>h.c.sbCreateTenant());expect(h.c.__effects.rpc).toHaveLength(1);
  expect(Date.parse(h.c.__effects.rpc[0].payload.p_expires_at)).toBe(T+30*DAY);
});
it('Tenant៖ session ប្តូរពេល sync មិនផ្ញើ RPC',async()=>{
  const h=keygen(env());h.c.fetch=async url=>{h.c.sbAdminIsCurrent=()=>false;return response({nonce:new URL(url).searchParams.get('nonce'),now:T});};
  await settle(h,()=>h.c.sbCreateTenant());expect(h.c.__effects.rpc).toHaveLength(0);
});
it('Extend៖ trusted time បន្ថែមពីថ្ងៃផុតកំណត់បច្ចុប្បន្ន',async()=>{
  const h=keygen(env());h.sync();await extend(h);expect(h.c.__effects.writes).toHaveLength(1);
  expect(h.c.__effects.writes[0].val).toBe(T+31*DAY);
});
it('Extend៖ skew ក្រោយ sync មិនសរសេរ',async()=>{
  const h=keygen(env());h.sync();h.shift(400*DAY);await extend(h);expect(h.c.__effects.writes).toHaveLength(0);
});
for(const recover of [false,true]) it('Extend៖ updater ក្រោយ uncertainty'+(recover?' និង sync ថ្មី':'')+' មិនសរសេរ',async()=>{
  const h=keygen(env());h.sync();h.c.__fb.runTransaction=async(p,updater)=>{
    h.shift(400*DAY);if(recover)h.sync();const val=updater(h.c.__expires);
    if(val!==undefined)h.c.__effects.writes.push({p,val});return{committed:val!==undefined,snapshot:{val:()=>val}};
  };
  await extend(h);expect(h.c.__effects.writes).toHaveLength(0);
});
for (const alreadySynced of [false, true]) it('Listener៖ cached offset '+alreadySynced+' មិនបញ្ជាក់ fresh time',async()=>{
  const h=keygen(env());if(alreadySynced)h.sync();h.shift(400*DAY);
  h.c.attachInfoListeners();h.listeners.connected({val:()=>true});h.listeners.offset({val:()=>0});
  for(let i=0;i<20;i++)await Promise.resolve();
  await settle(h,()=>h.c.sbCreateTenant());expect(h.c.__effects.rpc).toHaveLength(0);
});
it('Listener៖ nonce response អាចបើកចេញ Key ទោះ offset cache ខុស',async()=>{
  const h=keygen(env());h.shift(400*DAY);h.c.fetch=async url=>response({nonce:new URL(url).searchParams.get('nonce'),now:T});
  h.c.attachInfoListeners();h.listeners.connected({val:()=>true});h.listeners.offset({val:()=>0});
  for(let i=0;i<20;i++)await Promise.resolve();
  await settle(h,()=>h.c.sbCreateTenant());expect(h.c.__effects.rpc).toHaveLength(1);
  expect(Date.parse(h.c.__effects.rpc[0].payload.p_expires_at)).toBe(T+30*DAY);
});
it('Generate៖ ACK ក្រោយ clock uncertainty នៅបង្ហាញ Key ដែលចុះរួច',async()=>{
  const {h}=await signer();h.c.__fb.update=async(p,u)=>{h.c.__effects.writes.push({p,u});h.shift(400*DAY);};
  await settle(h,()=>h.c.generateLicenseKey());expect(h.c.__effects.writes).toHaveLength(1);
  expect(vm.runInContext('lastGeneratedKey',h.c)).not.toBe('');expect(written(h)[0].expiresAt).toBe(signed(h).payload.exp*1000);
});
it('Sync៖ waiter ដែលអស់ពេលត្រូវដកចេញ',async()=>{
  const h=keygen(env());for(let i=0;i<4;i++)await settle(h,()=>h.c.waitForServerTimeSync(15000));
  expect(vm.runInContext('serverTimeSyncWaiters.length',h.c)).toBe(0);
});
it('Clock lease៖ malformed inputs មិន throw ឬអនុញ្ញាត',async()=>{
  const h=keygen(env());h.sync();expect(typeof h.c.keygenClockIsCurrent).toBe('function');
  for(const value of [undefined,null,NaN,0,{},[],{generation:Infinity}])expect(h.c.keygenClockIsCurrent(value)).toBe(false);
});
it('Generate៖ server correction ធំពេល sign បោះបង់ snapshot ចាស់',async()=>{
  const {h}=await signer();h.c.crypto.subtle.sign=async(...args)=>{const result=await webcrypto.subtle.sign(...args);h.c.ZoeLicense.setServerTimeOffset(400*DAY);return result;};
  await settle(h,()=>h.c.generateLicenseKey());expect(h.c.__effects.writes).toHaveLength(0);
});
it('Extend៖ server correction ធំមុន updater បោះបង់ snapshot ចាស់',async()=>{
  const h=keygen(env());h.sync();h.c.__fb.runTransaction=async(p,updater)=>{
    h.c.ZoeLicense.setServerTimeOffset(400*DAY);const val=updater(h.c.__expires);
    if(val!==undefined)h.c.__effects.writes.push({p,val});return{committed:val!==undefined,snapshot:{val:()=>val}};
  };
  await extend(h);expect(h.c.__effects.writes).toHaveLength(0);
});
async function release(h, options: { outcome?: string; releasedAt?: number; afterPatch?: () => void; stale?: boolean } = {}) {
  h.c.__shownAt=T-3*DAY;
  vm.runInContext("keyListCache=[{id:'synthetic-key',paths:['ZOE'],maxDevices:1,seatDevices:[{device:'synthetic'}],perApp:{ZOE:{releasedAt:__shownAt}}}]",h.c);
  h.c.patchLicenseViaRest=async(_operation,_db,payload,isCurrent)=>{
    if(!isCurrent())return{outcome:'stale'};
    h.c.__effects.writes.push(payload);if(options.afterPatch)options.afterPatch();
    return{outcome:options.outcome||'unknown'};
  };
  h.c.readKeyReleaseViaRest=async()=>[{path:'ZOE',seats:null,releasedAt:options.releasedAt??T+1000}];
  h.c.adminOperationIsCurrent=()=>!options.stale;
  await settle(h,()=>h.c.releaseKeySeat('synthetic-key'));
}
it('Release៖ rollback មិនបញ្ជាក់ PATCH បាត់ដោយ release ចាស់',async()=>{
  const h=keygen(env());h.sync();h.shift(-7*DAY);
  await release(h,{releasedAt:T-2*DAY});expect(h.c.__effects.writes).toHaveLength(1);
  expect(h.c.__effects.toasts.some(t=>t.startsWith('✅'))).toBe(false);
  expect(h.c.__effects.alerts).toContain(vm.runInContext('RELEASE_PENDING_TEXT',h.c));
});
it('Release៖ server correction ពេល PATCH បាត់ មិនបញ្ជាក់ពី sample ចាស់',async()=>{
  const h=keygen(env());h.sync();await release(h,{releasedAt:T+DAY,afterPatch:()=>h.c.ZoeLicense.setServerTimeOffset(400*DAY)});
  expect(h.c.__effects.writes).toHaveLength(1);expect(h.c.__effects.toasts.some(t=>t.startsWith('✅'))).toBe(false);
});
it('Release៖ trusted bound និង release ថ្មីបញ្ជាក់ចម្លើយបាត់ដោយមិន retry',async()=>{
  const h=keygen(env());h.sync();await release(h);
  expect(h.c.__effects.writes).toHaveLength(1);expect(h.c.__effects.toasts.some(t=>t.startsWith('✅'))).toBe(true);
  expect(h.c.__effects.writes[0]['license_keys/ZOE/synthetic-key/releasedAt']).toEqual({'.sv':'timestamp'});
});
it('Release៖ ACK ពិតនៅជោគជ័យទោះ clock មិនច្បាស់',async()=>{
  const h=keygen(env());h.sync();h.shift(-7*DAY);await release(h,{outcome:'applied'});
  expect(h.c.__effects.writes).toHaveLength(1);expect(h.c.__effects.toasts.some(t=>t.startsWith('✅'))).toBe(true);
});
it('Release៖ session ចាស់មិនសរសេរ',async()=>{
  const h=keygen(env());h.sync();await release(h,{stale:true});expect(h.c.__effects.writes).toHaveLength(0);
});

it.each([
  {expiresAt:T-DAY,lostAck:false},{expiresAt:T+DAY+0.75,lostAck:false},
  {expiresAt:T-DAY,lostAck:true},{expiresAt:T+DAY+0.75,lostAck:true}
])('Extend legacy៖ $expiresAt ម៉ោងទសភាគ និងចម្លើយបាត់ $lostAck រក្សាចំនួនគត់', async ({expiresAt,lostAck}) => {
  const h=keygen(env());h.sync();h.advance(0.75);
  h.c.__expires=expiresAt;
  if(lostAck){
    const transact=h.c.__fb.runTransaction;
    h.c.__fb.runTransaction=async(...args)=>{await transact(...args);throw Error('synthetic lost ACK');};
    h.c.readExpiresAtViaRest=async()=>h.c.__effects.writes[0].val;
  }
  vm.runInContext("keyListCache=[{id:'synthetic-key',paths:['ZOE'],perApp:{ZOE:{expiresAt:__expires}}}]",h.c);
  h.c.document.getElementById('extendDaysInput').value='30';
  await settle(h,()=>h.c.confirmExtendKey());
  expect(h.c.__effects.writes).toHaveLength(1);
  expect(h.c.__effects.writes[0].val).toBe(Math.floor(Math.max(expiresAt,T+0.75))+30*DAY);
  expect(Number.isSafeInteger(h.c.__effects.writes[0].val)).toBe(true);
  expect(h.c.__effects.toasts.some(t=>t.startsWith('✅'))).toBe(true);
});
