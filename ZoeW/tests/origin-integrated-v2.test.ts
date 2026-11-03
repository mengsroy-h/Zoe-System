import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, ztoState } from '../src/core/state';
import { makeFreshOriginEntry, saveBarcodeOrigins } from '../src/features/barcode-origin';
import { preparePendingScan, releasePendingScan } from '../src/services/scan-pending';
import { getFormattedClockTime, getFormattedDate } from '../src/core/timezone';

// Real service and callback; only the SDK/clock/storage are synthetic. No backend.
const UID='synthetic-user', SCOPE='https://synthetic.invalid', DATE='2026-01-01', PATH='zoew_scan_history_cod_dod/row-a';
const id=(x:string)=>'scan_'+x.repeat(32), copy=(v:any)=>v==null?v:JSON.parse(JSON.stringify(v));
const item=(x='a',birth=100)=>({code:'SYNTH'+x,createdAt:birth,scanIntent:id(x),cod:4,dod:0});
const row=(members=[item()])=>({id:'row-a',scanDate:DATE,createdAt:20,cod:4,dod:0,count:members.length,barcodes:members});
let db:any, sdk:any, server:any, mode:string, calls:number, writes:number, reads:number;
const operation=(x:string,birth:number)=>({v:2,id:id(x),actorUid:UID,scope:SCOPE,code:'SYNTH'+x,registryKey:('SYNTH'+x).toUpperCase(),birth,scanDate:DATE,month:'2026-01',cod:4,dod:0,count:1,monthToken:'op_m'+id(x).slice(5),phase:'committed',targetId:'row-a',payloadHash:'f'.repeat(64),phone:'synthetic',locker:'N/A',closedAt:0});
function entry(x='a',birth=100){const code='SYNTH'+x;return {code,from:'synthetic-origin',binding:{id:id(x),code,birth,signIdentity:JSON.stringify([DATE,birth,null,null]),uid:UID,scope:SCOPE,recordScope:JSON.stringify([SCOPE,UID]),db,sdk,auth:firebaseState.authGeneration,cod:4,dod:0,scanDate:DATE,sessionCurrent:()=>true}};}
beforeEach(()=>{
 firebaseState.authGeneration++; ztoState.ztoOriginRefusedDb=null; dataState.deletedItems=[]; dataState.scanHistory=[row() as any];
 localStorage.setItem('zoew_firebase_config',JSON.stringify({databaseURL:SCOPE}));
 db={app:{options:{databaseURL:SCOPE}}}; firebaseState.db=db; firebaseState.auth={currentUser:{uid:UID}} as any;
 server=row();mode='normal';calls=0;writes=0;reads=0;
 sdk={ref:(_db:any,p:string)=>({p}), get:async(ref:any)=>{reads++;if(mode==='unreadable-op')throw Error('unreadable');if(ref.p===PATH)return {val:()=>copy(server)};const x=ref.p.endsWith(id('b'))?'b':'a';return {val:()=> mode==='missing-op' ? null : mode==='mismatch-op' ? {...operation(x,x==='b'?101:100),birth:999} : operation(x,x==='b'?101:100)};},
  runTransaction:async(_ref:any,fn:any)=>{calls++;
   if(mode==='transaction-error')throw Object.assign(Error('synthetic transport'),{code:'UNAVAILABLE'});
   if(mode==='no-callback')return {committed:true,snapshot:{val:()=>copy(server)}};
   if(mode==='conflict-replacement'){fn(copy(server));server=row([item('a',200)]);}
   if(mode==='conflict-claim'){fn(copy(server));server.barcodes[0].trashClaim='synthetic-claim';server.barcodes[0].trashClaimAt=42;}
   if(mode==='conflict-same')fn(copy(server));
   const next=fn(copy(server));if(next===undefined)return {committed:false,snapshot:{val:()=>copy(server)}};
   if(mode==='switch-after-dispatch')firebaseState.authGeneration++;
   server=copy(next);writes++;
   if(mode==='phantom-sql')return {committed:true,txOutcome:'applied',snapshot:{val:()=>copy(server)}};
   if(mode==='no-snapshot')return {committed:true};
   if(mode==='mismatch-snapshot')return {committed:true,snapshot:{val:()=>row([item('a',999)])}};
   return {committed:true,snapshot:{val:()=>copy(server)}};
  }};
 firebaseState.fb=sdk;
});
afterEach(()=>vi.useRealTimers());
function outcome(actual:any,expected:any){expect(actual).toEqual(expect.objectContaining(expected));}
describe('origin original-incarnation integration contract',()=>{
 for (const provider of ['cookie','palm'] as const) {
  it(`real prepared ${provider} signed proof matches the actual origin binding`,async()=>{
   const birth=Date.UTC(2026,0,1,8), date=getFormattedDate(birth as unknown as Date), time=getFormattedClockTime(birth as unknown as Date)+' ('+date+')';
   const proof={v:1 as const,provider,observedAt:birth+1000,signedAt:birth+500,signedAtExact:true,identity:JSON.stringify([date,birth,time,null])};
   const handle=preparePendingScan('SYNTHa',4,0,birth,'zto-import',2,proof);
   const captured=makeFreshOriginEntry('SYNTHa','synthetic-origin',handle,()=>true);
   expect(('binding' in captured ? captured.binding : undefined)?.signIdentity).toBe(proof.identity);
   const closedAt=birth+500;
   const op={...operation('a',birth),id:handle.record.id,scanDate:handle.record.scanDate,month:handle.record.scanDate.slice(0,7),monthToken:'op_m'+handle.record.id.slice(5),closedAt};
   server={...row(),scanDate:date,isClosed:true,closedAt,barcodes:[{...item('a',birth),scanIntent:handle.record.id,time,isClosed:true,closedAt}]};
   dataState.scanHistory=[copy(server)];sdk.get=async(ref:any)=>({val:()=>copy(ref.p===PATH?server:op)});
   const out=await saveBarcodeOrigins([captured]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});outcome(out,{applied:1,unresolved:0});releasePendingScan(handle);
  });
 }
 it('a conflicting or malformed signed proof cannot create an origin binding',()=>{
  const birth=Date.UTC(2026,0,1,8), handle=preparePendingScan('SYNTHa',4,0,birth,'zto-import',2);
  (handle.record as any).importProof={v:1,provider:'cookie',observedAt:birth+1000,signedAt:birth+500,signedAtExact:true,identity:'invalid'};
  expect(makeFreshOriginEntry('SYNTHa','synthetic-origin',handle,()=>true)).toEqual({code:'SYNTHa',from:'synthetic-origin'});
  const date=getFormattedDate(birth as unknown as Date),time=getFormattedClockTime(birth as unknown as Date)+' ('+date+')';
  (handle.record as any).importProof.identity=JSON.stringify([date,birth+1,time,null]);
  expect(makeFreshOriginEntry('SYNTHa','synthetic-origin',handle,()=>true)).toEqual({code:'SYNTHa',from:'synthetic-origin'});
  releasePendingScan(handle);
 });
 for (const scenario of ['positive','replacement','conflict-replacement','session-switch']) {
  it(`real prepare and binding to staged row: ${scenario}`,async()=>{
   const birth=Date.UTC(2026,0,1,8), handle=preparePendingScan('SYNTHa',4,0,birth,'zto-import',2);
   const captured=makeFreshOriginEntry('SYNTHa','synthetic-origin',handle,()=>true);
   expect(('binding' in captured ? captured.binding : undefined)?.id).toBe(handle.record.id);
   expect(('binding' in captured ? captured.binding : undefined)?.birth).toBe(birth);
   const op={...operation('a',birth),id:handle.record.id,scanDate:handle.record.scanDate,month:handle.record.scanDate.slice(0,7),monthToken:'op_m'+handle.record.id.slice(5)};
   server={...row(),scanDate:handle.record.scanDate,barcodes:[{...item('a',birth),scanIntent:handle.record.id,time:getFormattedClockTime(birth as unknown as Date)+' ('+handle.record.scanDate+')'}]};
   dataState.scanHistory=[copy(server)];
   sdk.get=async(ref:any)=>({val:()=>copy(ref.p===PATH?server:op)});
   if(scenario==='replacement') server.barcodes[0].createdAt=birth+1;
   if(scenario==='conflict-replacement') mode='conflict-replacement';
   if(scenario==='session-switch') firebaseState.authGeneration++;
   const out=await saveBarcodeOrigins([captured]);
   if(scenario==='positive') {expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});outcome(out,{applied:1,unresolved:0,unknown:0});}
   else {expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});}
   releasePendingScan(handle);
  });
 }
 it('same original incarnation writes once then reports unchanged',async()=>{const a=entry();const first=await saveBarcodeOrigins([a]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});outcome(first,{applied:1,unchanged:0,unresolved:0,unknown:0});const second=await saveBarcodeOrigins([a]);expect(writes).toBe(1);outcome(second,{applied:0,unchanged:1,unresolved:0,unknown:0});});
 it('replacement birth before callback is not written',async()=>{server=row([item('a',200)]);const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();outcome(out,{applied:0,unresolved:1});});
 it.each(['corrupt-scalar', ['corrupt-array']])('malformed existing origins %j are never replaced',async(original)=>{server.origins=copy(original);const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toEqual(original);expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('adding an origin preserves unrelated existing origins',async()=>{server.origins={EXISTING:'untouched'};const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toEqual({EXISTING:'untouched',SYNTHA:'synthetic-origin'});outcome(out,{applied:1,unresolved:0});});
 it('replacement intent before callback is not written',async()=>{server=row([{...item(),scanIntent:id('b')}]);const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();outcome(out,{applied:0,unresolved:1});});
 it.each(['target','other','retry'])('trash claim on %s prevents write',async(which)=>{if(which==='target'){server.barcodes[0].trashClaim='synthetic-claim';server.barcodes[0].trashClaimAt=42;}if(which==='other'){server.barcodes.push({...item('b',101),trashClaim:'synthetic-claim',trashClaimAt:42});}if(which==='retry')mode='conflict-claim';const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('deducted target prevents origin write',async()=>{server.barcodes[0].isDeducted=true;const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('claim timestamp alone prevents write',async()=>{server.barcodes[0].trashClaimAt=42;const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('null claim fields are treated as absent',async()=>{server.barcodes[0].trashClaim=null;server.barcodes[0].trashClaimAt=null;const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});outcome(out,{applied:1,unresolved:0});});
 it('same ID and birth with new restore identity is not written',async()=>{server.barcodes[0].restoredAt=7;const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();outcome(out,{applied:0,unresolved:1});});
 it('replacement between transaction retries is not written',async()=>{mode='conflict-replacement';const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('repeated callback for same incarnation commits exactly once',async()=>{mode='conflict-same';const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});expect(writes).toBe(1);outcome(out,{applied:1,unresolved:0});});
 it('missing original identity is explicitly unresolved and not written',async()=>{const out=await saveBarcodeOrigins([{code:'SYNTHa',from:'synthetic-origin'}]);expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1,unknown:0});});
 it('unreadable original operation is unresolved without transaction',async()=>{mode='unreadable-op';const out=await saveBarcodeOrigins([entry()]);expect(calls).toBe(0);expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('unreadable operation stops subsequent reads while retaining both unresolved keys',async()=>{mode='unreadable-op';dataState.scanHistory=[row([item('a',100),item('b',101)]) as any];const out=await saveBarcodeOrigins([entry('a',100),entry('b',101)]);expect(reads).toBe(1);expect(calls).toBe(0);outcome(out,{applied:0,unresolved:2});});
 it.each(['missing-op','mismatch-op'])('%s committed evidence does not authorize a write',async(m)=>{mode=m;const out=await saveBarcodeOrigins([entry()]);expect(calls).toBe(0);expect(writes).toBe(0);outcome(out,{applied:0,unresolved:1});});
 it('unproven SQL applied metadata cannot establish success',async()=>{mode='phantom-sql';const out=await saveBarcodeOrigins([entry()]);expect(writes).toBe(1);outcome(out,{applied:0,unknown:1});});
 it('committed result without a readable snapshot is unknown',async()=>{mode='no-snapshot';const out=await saveBarcodeOrigins([entry()]);expect(writes).toBe(1);outcome(out,{applied:0,unknown:1});});
 it('committed result with a different incarnation does not count as success',async()=>{mode='mismatch-snapshot';const out=await saveBarcodeOrigins([entry()]);expect(writes).toBe(1);expect(out.applied).toBe(0);expect(out.unresolved+out.unknown).toBe(1);});
 it('transaction result with no updater invocation does not count as success',async()=>{mode='no-callback';const out=await saveBarcodeOrigins([entry()]);expect(writes).toBe(0);expect(out.applied).toBe(0);expect(out.unresolved+out.unknown).toBe(1);});
 it('malformed helper inputs return unbound origin without throwing',()=>{expect(makeFreshOriginEntry('SYNTHa','synthetic-origin',null,()=>true)).toEqual({code:'SYNTHa',from:'synthetic-origin'});expect(makeFreshOriginEntry('SYNTHa','synthetic-origin',{},()=>{throw Error('synthetic')})).toEqual({code:'SYNTHa',from:'synthetic-origin'});});
 it('only verified matching keys count when one row member was replaced',async()=>{dataState.scanHistory=[row([item('a',100),item('b',101)]) as any];server=row([item('a',100),item('b',999)]);const out=await saveBarcodeOrigins([entry('a',100),entry('b',101)]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});outcome(out,{applied:1,unresolved:1});});
 it('exact duplicate identity and origin is one verified key',async()=>{const a=entry(), b={...a,binding:{...a.binding}};const out=await saveBarcodeOrigins([a,b]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});expect(writes).toBe(1);outcome(out,{applied:1,unchanged:0,unresolved:0,unknown:0});});
 it('conflicting origins for the same key are unresolved once and never written',async()=>{const a=entry(),b={...a,from:'another-synthetic-origin'};const out=await saveBarcodeOrigins([a,b]);expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unchanged:0,unresolved:1,unknown:0});});
 it('conflicting identities for the same key are unresolved once and never written',async()=>{const a=entry(),b={...a,binding:{...a.binding,id:id('b')}};const out=await saveBarcodeOrigins([a,b]);expect(server.origins).toBeUndefined();expect(writes).toBe(0);outcome(out,{applied:0,unchanged:0,unresolved:1,unknown:0});});
 it('a dispatched transaction error has unknown outcome',async()=>{mode='transaction-error';const out=await saveBarcodeOrigins([entry()]);outcome(out,{applied:0,unknown:1});});
 it('a session change after dispatch does not claim no effect',async()=>{mode='switch-after-dispatch';const out=await saveBarcodeOrigins([entry()]);expect(server.origins).toEqual({SYNTHA:'synthetic-origin'});outcome(out,{applied:0,unknown:1});});
});
