import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { purgeTrashWithRegistry } from '../src/services/registry-purge';
import { createNativeWriteRecovery, nativeWriteRecoveryState, NATIVE_WRITE_RECEIPTS } from '../src/services/native-write-recovery';
import { registryPurgeIntent, REGISTRY_PURGE_MAX_BYTES } from '../src/domain/registry-purge-proof';
import { createLocalWriteJournal, WRITE_JOURNAL_PREFIX } from '../src/services/write-journal';
const env=vi.hoisted(()=>({store:{} as Record<string,any>,current:true,releaseDenied:false,nativeReceiptDenied:false,loseAckThenClose:false,loseAckLive:false}));
vi.mock('../src/services/tx-outcome',()=>({TX_ROOT_READ_TIMEOUT_MS:1000,txRestUrl:(r:any)=>String(r),txReadServerValue:async(url:string)=>{
 const p=new URL(url).pathname.split('/').filter(Boolean);if(env.releaseDenied&&p[0]==='zoew_registry_releases'||env.nativeReceiptDenied&&p[0]==='zoew_write_receipts')throw Object.assign(new Error('synthetic release READ permission denied'),{code:'PERMISSION_DENIED',readRefused:true});return JSON.parse(JSON.stringify(p.reduce((v:any,k)=>v?.[k],env.store)??null));
},txReadWasRefused:(error:any)=>error?.readRefused===true,txSameValue:(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b),transactionDisconnectPending:()=>false}));
vi.mock('../src/domain/scan-transport-proof',()=>({scanTransportIntent:()=>null,scanTransportReceipt:()=>false}));
const HOST='https://synthetic-purge.firebaseio.com',UID='synthetic-purge-user',NOW=Date.UTC(2026,10,1,12);
const T='zoew_recently_deleted_cod_dod',R='zoew_barcode_registry',P='zoew_registry_releases',C='zoew_trash_consumptions';
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const at=(p:string):any=>copy(p.split('/').filter(Boolean).reduce((v:any,k)=>v?.[k],env.store)??null);
function put(p:string,v:any){const ks=p.split('/');let x=env.store;for(const k of ks.slice(0,-1))x=x[k]||={};if(v===null)delete x[ks.at(-1)!];else x[ks.at(-1)!]=copy(v);}
const ref=(_db:any,path='')=>({path,toString:()=>HOST+'/'+path});
const turn=async()=>{for(let i=0;i<500;i++)await Promise.resolve();};
function source(n:number){return{id:'source',createdAt:NOW-2000,deletedAt:NOW-1000,trashGeneration:1,scanDate:'2026-11-01',count:n,barcodes:Array.from({length:n},(_,i)=>({code:'SYNTH'+String(i).padStart(6,'0'),createdAt:NOW-2000}))};}
function ops(n:number){const s=source(n),rs=s.barcodes.map((b,i)=>({v:2,generation:1,id:'release_'+i.toString(16).padStart(32,'0'),kind:'legacy',actorUid:UID,releasedBy:UID,scope:HOST,code:b.code,registryKey:b.code,birth:b.createdAt,trashId:s.id,slot:String(i),deletedAt:s.deletedAt,rowBirth:s.createdAt,rowCount:n}));
return[{k:'set',p:[T,s.id],v:null},{k:'set',p:[C,s.id],v:{v:1,sourceId:s.id,generation:1,kind:'purge',actorUid:UID,scope:HOST,deletedAt:s.deletedAt,rowBirth:s.createdAt}},...rs.flatMap(r=>[{k:'set',p:[R,r.registryKey],v:null},{k:'set',p:[P,r.id],v:r}])];}
let writes:any[],raw:any,db:any,auth:any;
function rawSdk(){return{ref,get:async(r:any)=>({val:()=>at(r.path)}),update:vi.fn(async(_r:any,patch:Record<string,any>)=>{
 const rs=Object.entries(patch).filter(([p])=>p.startsWith(P+'/'));
 if(rs.length){const s=at(T+'/source'),keys=new Set(),slots=new Set();if(!s||s.restoreClaim||rs.length!==s.count||patch[T+'/source']!==null||patch[C+'/source']?.generation!==s.trashGeneration)throw Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
 for(const[,r]of rs){const b=s.barcodes[r.slot];if(!b||b.code!==r.code||r.releasedBy!==UID||r.scope!==HOST||r.rowCount!==s.count||r.deletedAt!==s.deletedAt||r.rowBirth!==s.createdAt||r.birth!==b.createdAt||patch[R+'/'+r.registryKey]!==null||at(R+'/'+r.registryKey)!==true||keys.has(r.registryKey)||slots.has(r.slot))throw Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});keys.add(r.registryKey);slots.add(r.slot);}}
 writes.push(copy(patch));for(const[p,v]of Object.entries(patch))put(p,p.startsWith(NATIVE_WRITE_RECEIPTS+'/')&&v?.at?.['.sv']==='timestamp'?{...v,at:NOW}:v);if(env.loseAckLive){env.loseAckLive=false;env.nativeReceiptDenied=true;env.releaseDenied=true;throw new Error('synthetic live lost network ACK');}if(env.loseAckThenClose){env.loseAckThenClose=false;env.current=false;throw new Error('synthetic commit with lost ACK at page end');}
}),runTransaction:vi.fn()};}
function prepare(n:number){const row=source(n);env.store={[T]:{source:copy(row)},[R]:Object.fromEntries(row.barcodes.map(b=>[b.code,true])),zoew_scan_history_cod_dod:{},money_sentinel:{unchanged:17}};raw=rawSdk();const native=createNativeWriteRecovery(raw,auth,db,()=>env.current,()=>{},()=>{throw new Error('No Web Locks fixture');});firebaseState.fb={...raw,update:(r:any,v:any)=>native.mutate('update',r,v)} as any;return{row,native};}
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(NOW);localStorage.clear();vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('navigator',{onLine:true});env.current=true;env.releaseDenied=false;env.nativeReceiptDenied=false;env.loseAckThenClose=false;env.loseAckLive=false;writes=[];db={app:{options:{databaseURL:HOST}}};auth={currentUser:{uid:UID}};Object.assign(firebaseState,{db,auth,firebaseConfig:db.app.options,authGeneration:firebaseState.authGeneration+1,serverClockTrusted:true,serverTimeOffsetMs:0,isInitializingFirebase:false,isDatabaseInitialized:true,isDatabaseConnected:true});});
afterEach(()=>{env.current=false;vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();localStorage.clear();});
it.each([249,250,251])('F03 local-wrapper ៖ ក្រុម %s purge atomic ពេញលេញ',async n=>{const{row}=prepare(n);await turn();expect(await purgeTrashWithRegistry(row)).toBe(true);expect(writes).toHaveLength(1);expect(Object.keys(writes[0])).toHaveLength(3+2*n);expect(Object.keys(writes[0]).filter(p=>p.startsWith(NATIVE_WRITE_RECEIPTS+'/'))).toHaveLength(1);expect(at(T+'/source')).toBeNull();expect(Object.keys(at(R))).toHaveLength(0);expect(Object.keys(at(P))).toHaveLength(n);expect(at(C+'/source')).toMatchObject({generation:1,kind:'purge',actorUid:UID});expect(at('money_sentinel')).toEqual({unchanged:17});expect(createLocalWriteJournal().list(HOST+'/|'+UID,'firebase')).toEqual([]);});
it.each([false,true])('F03 local-wrapper ៖ 3-day full proof missing=%s មិន replay new holder',async missing=>{const original=ops(250),journal=createLocalWriteJournal(),scope=HOST+'/|'+UID;const digest=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(original))),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');expect(journal.put({v:1,scope,topic:'firebase',opId:'native_original_purge_123456789',ops:original,hash,stage:'sent',sentAfter:NOW-3*86400000,queuedAt:NOW-3*86400000})).toBe(true);
 const{native}=prepare(250);env.store[T]={};env.store[P]=Object.fromEntries(original.filter(o=>o.p[0]===P).map(o=>[o.p[1],copy(o.v)]));if(missing)delete env.store[P][Object.keys(env.store[P])[0]];env.store[C]={source:{v:1,sourceId:'source',generation:3,kind:'purge',actorUid:UID,scope:HOST,deletedAt:NOW+1000,rowBirth:NOW}};env.store[R]={SYNTH000000:{v:2,intent:'scan_'+'f'.repeat(32),actorUid:'future-user',birth:NOW}};const before=copy(env.store);await native.retry();await turn();expect(journal.list(scope,'firebase')).toHaveLength(missing?1:0);expect(nativeWriteRecoveryState(db).blocked).toBe(missing?1:0);expect(writes).toEqual([]);expect(env.store).toEqual(before);});
it('F03 local-wrapper ៖ storage unavailable មិន bypass journal',async()=>{const row=source(250);env.store={[T]:{source:row},[R]:Object.fromEntries(row.barcodes.map(b=>[b.code,true]))};raw=rawSdk();vi.stubGlobal('localStorage',undefined);const native=createNativeWriteRecovery(raw,auth,db,()=>env.current,()=>{},()=>{throw new Error('No Web Locks fixture');});const patch=Object.fromEntries(ops(250).map(o=>[o.p.join('/'),o.v]));const outcome=await Promise.resolve().then(()=>native.mutate('update',ref(db),patch)).then(()=>'sent',(e:any)=>e);expect(outcome).toMatchObject({code:'write_journal_unavailable',noRetry:true});expect(writes).toEqual([]);expect(at(T+'/source')).toEqual(row);});
it('F03 local-wrapper ៖ setItem denial មិន dispatch',async()=>{const{row}=prepare(250);await turn();const storage=localStorage;vi.stubGlobal('localStorage',{get length(){return storage.length;},key:(i:number)=>storage.key(i),getItem:(k:string)=>storage.getItem(k),removeItem:(k:string)=>storage.removeItem(k),clear:()=>storage.clear(),setItem:(k:string,v:string)=>{if(k.startsWith(WRITE_JOURNAL_PREFIX))throw new DOMException('synthetic quota','QuotaExceededError');storage.setItem(k,v);}});expect(await purgeTrashWithRegistry(row)).toBe(false);expect(writes).toEqual([]);expect(at(T+'/source')).toEqual(row);});

it('F03 adversarial byte envelope ៖ v2 under500 ops cannot bypass UTF8 cap through legacy parser',async()=>{
 const {native}=prepare(230);await turn();const packet:any[]=ops(230),largeScope='\u0002'.repeat(2048),oldActor='漢'.repeat(2048);
 packet[1].v.scope=largeScope;
 for(const operation of packet)if(operation.p[0]===P){operation.v.scope=largeScope;operation.v.actorUid=oldActor;operation.v.kind='scan';operation.v.id='scan_'+Number(operation.v.slot).toString(16).padStart(32,'0');operation.p[1]=operation.v.id;}
 expect(packet.length).toBeLessThanOrEqual(500);expect(registryPurgeIntent(packet)).not.toBeNull();
 const serialized=JSON.stringify(packet);expect(serialized.length+1000).toBeLessThan(REGISTRY_PURGE_MAX_BYTES);expect(new TextEncoder().encode(serialized).byteLength).toBeGreaterThan(REGISTRY_PURGE_MAX_BYTES);
 const patch=Object.fromEntries(packet.map(o=>[o.p.join('/'),o.v]));expect(new TextEncoder().encode(JSON.stringify(patch)).byteLength).toBeGreaterThan(REGISTRY_PURGE_MAX_BYTES);
 raw.update.mockImplementation(async()=>{env.current=false;throw new Error('oversized transport must never be called');});
 const before=copy(env.store),result=await native.mutate('update',ref(db),patch).then(()=>'sent',(e:any)=>e);
 expect(result).toMatchObject({code:'write_purge_oversize',txOutcome:'not-applied',noRetry:true});expect(raw.update).not.toHaveBeenCalled();expect(env.store).toEqual(before);
});

it('F03 lost ACK restart ៖ release READ denied រក្សា full journal/HOLD មិនដកភស្តុតាង',async()=>{
 const {native}=prepare(250);await turn();env.loseAckThenClose=true;const original=ops(250),patch=Object.fromEntries(original.map(o=>[o.p.join('/'),o.v]));
 const outcome=await native.mutate('update',ref(db),patch).then(()=>'sent',(e:any)=>e);expect(outcome).toBeInstanceOf(Error);expect(writes).toHaveLength(1);expect(at(T+'/source')).toBeNull();expect(Object.keys(at(P))).toHaveLength(250);
 const journal=createLocalWriteJournal(),scope=HOST+'/|'+UID;const [retained]=journal.list(scope,'firebase');expect(retained.ops).toEqual(original);expect(retained.hash).toMatch(/^[a-f0-9]{64}$/);
 env.current=true;env.releaseDenied=true;db={app:{options:{databaseURL:HOST}}};raw=rawSdk();const restarted=createNativeWriteRecovery(raw,auth,db,()=>env.current,()=>{},()=>{throw new Error('No Web Locks fixture');});const sent=writes.length;await restarted.retry();await turn();
 expect(journal.list(scope,'firebase'),'release READ refusal is not completion proof').toEqual([retained]);expect(nativeWriteRecoveryState(db).blocked).toBeGreaterThan(0);expect(writes.slice(sent)).toEqual([]);
 env.releaseDenied=false;await restarted.retry();await turn();expect(journal.list(scope,'firebase')).toEqual([]);expect(nativeWriteRecoveryState(db).blocked).toBe(0);expect(writes.slice(sent)).toEqual([]);
});

it('F03 live lost ACK ៖ generic receipt READ denied រក្សា unknown full journal',async()=>{
 const {native}=prepare(250);await turn();env.loseAckLive=true;const original=ops(250),patch=Object.fromEntries(original.map(o=>[o.p.join('/'),o.v]));
 const result=await native.mutate('update',ref(db),patch).then(()=>'sent',(e:any)=>e);await native.retry();await turn();
 const journal=createLocalWriteJournal(),scope=HOST+'/|'+UID;expect.soft(result).toMatchObject({code:'write_recovery_pending',txOutcome:'unknown',noRetry:true});expect(writes).toHaveLength(1);expect(at(T+'/source')).toBeNull();expect(Object.keys(at(P))).toHaveLength(250);expect.soft(journal.list(scope,'firebase')).toEqual([expect.objectContaining({ops:original})]);expect.soft(nativeWriteRecoveryState(db).blocked).toBeGreaterThan(0);
 const sent=writes.length;env.releaseDenied=false;env.nativeReceiptDenied=false;await native.retry();await turn();expect(journal.list(scope,'firebase')).toEqual([]);expect(nativeWriteRecoveryState(db).blocked).toBe(0);expect(writes.slice(sent)).toEqual([]);
});
it('F03 definite SDK permission rejection នៅតែ not-applied cleanup',async()=>{
 const {native}=prepare(250);await turn();env.store[T].source.restoreClaim={token:'another-restore'};const before=copy(env.store),patch=Object.fromEntries(ops(250).map(o=>[o.p.join('/'),o.v]));
 const result=await native.mutate('update',ref(db),patch).then(()=>'sent',(e:any)=>e);expect(result).toMatchObject({code:'PERMISSION_DENIED'});expect(writes).toEqual([]);expect(env.store).toEqual(before);expect(createLocalWriteJournal().list(HOST+'/|'+UID,'firebase')).toEqual([]);
});
it('F03 synchronous SDK unsent នៅតែ not-applied cleanup',async()=>{
 const {native}=prepare(250);await turn();raw.update.mockImplementation(()=>{throw new Error('synthetic synchronous unsent');});const before=copy(env.store),patch=Object.fromEntries(ops(250).map(o=>[o.p.join('/'),o.v]));
 const result=await native.mutate('update',ref(db),patch).then(()=>'sent',(e:any)=>e);expect(result).toMatchObject({nativeUnsent:true});expect(writes).toEqual([]);expect(env.store).toEqual(before);expect(createLocalWriteJournal().list(HOST+'/|'+UID,'firebase')).toEqual([]);
});
