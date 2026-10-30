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
   (r:any,o:any)=>{r.scanPending.payloadHash='bad';},
   (r:any,o:any)=>{r.scanPending.slot='99';},
   (r:any,o:any)=>{o.phase='committed';},
   (r:any,o:any)=>{r.barcodes[0].cod=99;},
   (r:any,o:any)=>{r.scanDate=null;},
   (r:any,o:any)=>{r.scanDate=17;},
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
