import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { preparePendingScan } from '../src/services/scan-pending';
import { claimScanOperation, saveScanOperation } from '../src/services/scan-operation';
const H='zoew_scan_history_cod_dod', D='zoew_daily_revenue_cod_dod', M='zoew_monthly_revenue_cod_dod';
const NOW=Date.UTC(2026,9,30,9), HOST='https://fake-default-rtdb.firebaseio.com';
function fixture() {
 const text=fs.readFileSync('../audit-tools/revenue-fuzz-test.js','utf8');
 const context:any=vm.createContext({window:{dispatchEvent(){},setTimeout,setInterval},Event,Date,setTimeout,URL,Response});
 vm.runInContext(text.slice(text.indexOf('const BOOT = function'),text.indexOf('function seedData()'))+'\nBOOT({});',context);
 return context.window;
}
beforeEach(()=>{localStorage.clear();localStorage.setItem('zoew_firebase_config',JSON.stringify({databaseURL:HOST}));
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(NOW);vi.stubGlobal('crypto',webcrypto);
 firebaseState.authGeneration++;firebaseState.firebaseConfig={databaseURL:HOST} as any;
 Object.assign(firebaseState,{isDatabaseConnected:true,isDatabaseInitialized:true,isInitializingFirebase:false,serverClockTrusted:true,serverTimeOffsetMs:0});
 dataState.scanHistory=[];dataState.deletedItems=[];
});
afterEach(()=>{firebaseState.authGeneration++;vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it.each(['applied','lost'])('real coordinator atomic packet %s: truthful receipt, unchanged provisional money, independent oracle',async(mode)=>{
 const f=fixture(),sdk=f.firebaseSDK;vi.stubGlobal('fetch',f.fetch);Object.assign(firebaseState,{fb:sdk,db:sdk.getDatabase(),auth:sdk.getAuth()});
 const h=preparePendingScan('FUZZCONTRACT',5,2,NOW,'direct',2);
 expect(await claimScanOperation(h,'FUZZCONTRACT')).toBe('claimed');
 f.__ledgerBlip=mode;
 const result=await saveScanOperation(h,'012345678','A1');
 expect(f.__ledgerBlipFired).toEqual([mode]);
 expect(result).toBe(mode==='applied'?true:'unknown');
 const op=f.__fakeStore.zoew_scan_operations[h.record.id];
 expect(op.phase).toBe(mode==='applied'?'committed':'prepared');
 const inv=f.__invariant('2026-10-30');
 expect(inv.unmeasurable).toEqual([]);expect(inv.pendingHolds).toHaveLength(mode==='lost'?1:0);
 expect(inv.expectCod).toBe(inv.gotCod);expect(inv.expectDod).toBe(inv.gotDod);expect(inv.expectCount).toBe(inv.gotCount);
 expect(Object.values<any>(f.__fakeStore[M])[0]).toMatchObject({codDollar:mode==='applied'?5:0,dodDollar:mode==='applied'?2:0,totalCount:mode==='applied'?1:0});
 if(mode==='lost') {
  const original=JSON.stringify(f.__fakeStore);
  for(const mutate of [
   (r:any,_o:any)=>{r.scanPending.payloadHash='bad';},
   (r:any,_o:any)=>{r.scanPending.slot='99';},
   (r:any,o:any)=>{o.phase='committed';},
   (r:any,_o:any)=>{r.barcodes[0].cod=99;},
   (r:any,_o:any)=>{r.scanDate=null;},
   (r:any,_o:any)=>{r.scanDate=17;},
   (r:any,o:any)=>{o.code={invalid:true};},
   (r:any,o:any)=>{o.registryKey=null;}
  ]) {
   const copy=JSON.parse(original);Object.keys(f.__fakeStore).forEach(k=>delete f.__fakeStore[k]);Object.assign(f.__fakeStore,copy);
   mutate(f.__fakeStore[H][op.targetId],f.__fakeStore.zoew_scan_operations[h.record.id]);
   expect(f.__invariant('2026-10-30').unmeasurable).toHaveLength(1);
  }
 }
});
it('incomplete packet does not consume atomic finalization fault; legacy transaction fault remains active',async()=>{
 const f=fixture(),sdk=f.firebaseSDK,db=sdk.getDatabase();
 f.__ledgerBlip='lost';
 await sdk.update(sdk.ref(db),{'zoew_daily_revenue_cod_dod/2026-10-30/codDollar':sdk.increment(1)});
 expect(f.__ledgerBlipFired).toEqual([]);expect(f.__ledgerBlip).toBe('lost');
 await expect(sdk.runTransaction(sdk.ref(db,D+'/2026-10-30'),()=>({codDollar:9,dodDollar:0,totalCount:1}))).rejects.toThrow('disconnect');
 expect(f.__ledgerBlipFired).toEqual(['lost']);
 expect(f.__fakeStore[D]['2026-10-30'].codDollar).not.toBe(9);
});
it('rules refusal precedes atomic patch application, leaving all paths unchanged',async()=>{
 const f=fixture(),sdk=f.firebaseSDK,db=sdk.getDatabase();
 const before=JSON.stringify(f.__fakeStore);
 await expect(sdk.update(sdk.ref(db),{'history/x':{value:1},[D+'/2026-10-30/codDollar']:-1})).rejects.toThrow('PERMISSION_DENIED');
 expect(JSON.stringify(f.__fakeStore)).toBe(before);
});

it('independent pending oracle accepts canonical trimmed special-character barcode and rejects old lossy key',async()=>{
 const f=fixture(),sdk=f.firebaseSDK;vi.stubGlobal('fetch',f.fetch);Object.assign(firebaseState,{fb:sdk,db:sdk.getDatabase(),auth:sdk.getAuth()});
 const code='  fx.a/b#c$[d]%  ';
 const h=preparePendingScan(code,5,0,NOW,'direct',2);
 expect(await claimScanOperation(h,code)).toBe('claimed');
 f.__ledgerBlip='lost';expect(await saveScanOperation(h,'012345678','A1')).toBe('unknown');
 const op=f.__fakeStore.zoew_scan_operations[h.record.id];
 expect(op.registryKey).toBe('FX%2EA%2FB%23C%24%5BD%5D%25');
 expect(f.__invariant('2026-10-30').unmeasurable).toEqual([]);
 op.registryKey='__FX_A_B_C__D____';
 expect(f.__invariant('2026-10-30').unmeasurable).toHaveLength(1);
});

it.each([false,true])('sweep fixture preserves modern receipt birth in mixed rows (map=%s)',(mapped)=>{
 const f=fixture();
 const entries=[{code:'MODERN',scanIntent:'scan_receipt',createdAt:NOW,isClosed:false},{code:'LEGACY',createdAt:NOW,isClosed:false}];
 const row={id:'mixed',createdAt:NOW,isClosed:false,barcodes:mapped?{a:entries[0],b:entries[1]}:entries};
 f.__fakeStore[H]={mixed:row};
 f.__fakeStore.zoew_scan_operations={scan_receipt:{birth:NOW,phase:'committed'}};
 f.__fakeStore.zoew_barcode_registry={MODERN:{birth:NOW,intent:'scan_receipt'}};
 const evidence=JSON.stringify([f.__fakeStore.zoew_scan_operations,f.__fakeStore.zoew_barcode_registry]);
 f.__ageForSweep('mixed',NOW);
 expect(row.createdAt).toBe(NOW);expect(entries[0].createdAt).toBe(NOW);
 expect(entries[1].createdAt).toBe(NOW-9*24*3600*1000);
 expect(JSON.stringify([f.__fakeStore.zoew_scan_operations,f.__fakeStore.zoew_barcode_registry])).toBe(evidence);
 expect(f.__writeLog.every((e:any)=>e.owner&&e.p.endsWith('/'+(mapped?'b':'1')+'/createdAt'))).toBe(true);
});
it('sweep fixture still ages legacy rows and closed time without mutating modern birth',()=>{
 const f=fixture(),legacy={id:'legacy',createdAt:NOW,isClosed:false,barcodes:[{code:'OLD',createdAt:NOW}]},closed={id:'closed',createdAt:NOW,isClosed:true,barcodes:[{code:'NEW',scanIntent:'receipt',createdAt:NOW}]};
 f.__fakeStore[H]={legacy,closed};f.__ageForSweep('legacy',NOW);f.__ageForSweep('closed',NOW);
 expect(legacy.createdAt).toBe(NOW-9*24*3600*1000);expect(legacy.barcodes[0].createdAt).toBe(legacy.createdAt);
 expect(closed.createdAt).toBe(NOW);expect(closed.barcodes[0].createdAt).toBe(NOW);
 expect((closed as any).closedAt).toBe(NOW-3*3600*1000);
 const source=fs.readFileSync('../audit-tools/revenue-fuzz-test.js','utf8');
 const action=source.slice(source.indexOf("if (wanted === 'sweep')"),source.indexOf("if (wanted === 'sweepPickup')"));
 expect(action).toContain('window.__ageForSweep(id, Date.now())');expect(action).not.toContain('/createdAt');
});

it('rules replay compiles once per isolated probe and clears each seed before all writes',async()=>{
 const source=fs.readFileSync('../audit-tools/emu/app-writes-rules-test.js','utf8');
 const start=source.indexOf('async function replay('),end=source.indexOf('\n(async () => {',start);
 let namespaces=0,loads=0,clears=0,seeds=0,user=0,current:any=null;
 const req=async(method:string,p:string,value:any)=>{
  if(p.startsWith('/.settings/')){loads++;return {status:200,body:'{}'};}
  if(p.includes('2000-01-01'))return {status:401,body:'Permission denied'};
  if(method==='GET')return {status:200,body:JSON.stringify(current)};
  if(p.startsWith('/.json')){current=value;if(value===null)clears++;else seeds++;return {status:200,body:'null'};}
  user++;return {status:200,body:'{}'};
 };
 const context:any={req,emuNamespace:()=>{namespaces++;return 'isolated-'+namespaces;},AUTH:'auth',dataOf:(x:any)=>x,denied:(r:any)=>r.status>=400,rootOf:(p:string)=>p.split('/')[0],withServerValues:(v:any)=>v};
 const replay=vm.runInNewContext(source.slice(start,end)+'\nreplay;',context);
 const cap=Array.from({length:8},(_,run)=>({run,seed:{x:run},log:[{m:'PUT',p:'history/item',v:{x:run}}]}));
 const out=await replay(cap,{},'positive');
 expect(out.user).toBe(8);expect(out.denied).toEqual([]);expect(user).toBe(8);
 expect(namespaces).toBe(1);expect(loads).toBe(1);expect(clears).toBe(16);expect(seeds).toBe(8);
 await replay(cap,{},'negative');expect(namespaces).toBe(2);expect(loads).toBe(2);
 context.req=async(method:string,p:string,value:any)=>method==='GET'?{status:200,body:'{"leftover":true}'}:req(method,p,value);
 await expect(replay(cap,{},'broken-reset')).rejects.toThrow('reset');
});
it('rules refusal diagnostics expose shape, never fixture contacts or claim tokens',()=>{
 const source=fs.readFileSync('../audit-tools/emu/app-writes-rules-test.js','utf8');
 const start=source.indexOf('function structuralWrite('),end=source.indexOf('\nfunction capture(',start);
 const shape=vm.runInNewContext(source.slice(start,end)+'\nstructuralWrite;');
 const result=shape({'0123':'PRIVATE_PIN','PRIVATE_KEY_CONTACT':1,'PRIVATE_EMAIL@EXAMPLE.INVALID':2,'PRIVATE_TOKEN_KEY':3,phone:'PRIVATE_CONTACT',email:'PRIVATE_EMAIL',restoreClaim:{token:'PRIVATE_TOKEN',claimedAt:123,targetId:'PRIVATE_TARGET'},barcodes:[{code:'PRIVATE_CODE',createdAt:10}],createdAt:10});
 const text=JSON.stringify(result);expect(text).not.toContain('PRIVATE_');
 expect(result.state.createdAt).toBe(10);expect(result.state.restoreClaim.state.claimedAt).toBe(123);
 expect(result.fields).toContain('phone');expect(result.unknownFieldCount).toBe(4);expect(text).not.toContain('0123');expect(result.state.restoreClaim.state.token).toEqual({type:'string',length:13});
});
