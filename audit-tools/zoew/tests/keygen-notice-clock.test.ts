import {it, expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto');
const root=process.env.KEYGEN_NOTICE_CLOCK_SOURCE_ROOT||path.resolve(__dirname,'../../..');
const source=fs.readFileSync(root+'/ZoeKeyGen/app.js','utf8');
const ast=require('acorn').parse(source,{ecmaVersion:'latest'});
const names=['LICENSE_APP_CODE','NOTICE_KIND_LABELS','NOTICE_TITLE_MAX','NOTICE_BODY_MAX','NOTICE_KEEP_MAX','NOTICE_ID_ALPHABET','getServerNow','getTrustedServerNow','captureKeygenClock','keygenClockIsCurrent','waitForServerTimeSync','serverTimeSynced','serverTimeOffsetMs','serverTimeSyncWaiters','cleanNoticeText','buildNoticePayload','newNoticeId','noticeIdsToTrim','noticeBucketPath','sendNotice','noticeErrorMessage','noticeSendOwner','isSendingNotice'];
const code=ast.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)||n.type==='VariableDeclaration'&&n.declarations.some(d=>names.includes(d.id.name))).map(n=>source.slice(n.start,n.end)).join('\n');
const T=1794139200000,DAY=86400000;
function fixture() {
 const clock={wall:T,mono:1000};class FakeDate extends Date{static now(){return clock.wall;}}
 const effects={writes:[],alerts:[],toasts:[],reads:0,kicks:0,confirms:0};
 const els={noticeKindInput:{value:'notice'},noticeTitleInput:{value:'Synthetic'},noticeBodyInput:{value:'Body'}};
 const timers=new Map();let tid=0;
 const c:any={console:{error(){},warn(){},log(){}},Date:FakeDate,performance:{now:()=>clock.mono},crypto:webcrypto,TextEncoder,TextDecoder,AbortController,URL,
 setTimeout:(f,ms)=>{timers.set(++tid,{f,ms});return tid;},clearTimeout:id=>timers.delete(id),atob,btoa,
 navigator:{onLine:true},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{getElementById:id=>els[id]},
 alert:text=>effects.alerts.push(text),confirm:()=>{effects.confirms++;return true;},
 captureSensitiveSession:()=>({}),adminOperationIsCurrent:()=>true,setNoticeSendBusy(){},withTimeout:async p=>p,retryAsync:async run=>run(),
 showToast:text=>effects.toasts.push(text),kickNoticePush:()=>effects.kicks++,refreshNoticeList(){},
 db:{},fetch:async()=>{throw Error('network unavailable in fixture');},
 fb:{ref:(_db,p)=>p,get:async()=>{effects.reads++;return{exists:()=>false};},update:async(_,u)=>effects.writes.push(u)}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/ZoeW/public/license-verify.js','utf8'),c);vm.runInContext(code,c);
 return{c,clock,effects,els,timers,sync:()=>c.ZoeLicense.setServerTimeOffset(T-clock.wall)};
}
async function settle(h,run=()=>h.c.sendNotice()) {
 let done=false;const task=run().finally(()=>{done=true;});
 for(let i=0;i<50&&!done;i++)await new Promise(r=>setImmediate(r));
 if(!done)for(const timer of [...h.timers.values()])timer.f();
 await task;
}
function notice(h){return Object.entries(h.effects.writes[0]).find(([,v])=>v!==null) as [string,{at:number;title:string;body:string}];}
it('Notice៖ unsynced/skew មិនចេញ timestamp ពីឧបករណ៍',async()=>{
 const h=fixture();h.clock.wall+=400*DAY;await settle(h);
 expect(h.effects.writes).toHaveLength(0);expect(h.effects.kicks).toBe(0);expect(h.els.noticeTitleInput.value).toBe('Synthetic');
});
for(const jump of [-400*DAY,400*DAY])it('Notice៖ clock jump '+jump+' មិនប្រើ sample ចាស់',async()=>{
 const h=fixture();h.sync();h.clock.wall+=jump;await settle(h);expect(h.effects.writes).toHaveLength(0);
});
it('Notice៖ fresh endpoint time បង្កើត ID និង at ពី sample ដូចគ្នា',async()=>{
 const h=fixture();h.clock.wall+=400*DAY;
 h.c.fetch=async url=>({ok:true,status:200,redirected:false,headers:{get:n=>n.toLowerCase()==='content-type'?'application/json':null},json:async()=>({nonce:new URL(url).searchParams.get('nonce'),now:T})});
 await settle(h);expect(h.effects.writes).toHaveLength(1);const [id,payload]=notice(h);
 expect(payload.at).toBe(T);expect(id.split('/').at(-1).slice(1,14)).toBe(String(T));expect(payload.title).toBe('Synthetic');
});
it('Notice៖ sample ត្រឹមត្រូវរក្សា trim និង payload',async()=>{
 const h=fixture();h.sync();const old=Array.from({length:20},(_,i)=>h.c.newNoticeId(T-(20-i)*DAY));
 h.c.fb.get=async()=>({exists:()=>true,val:()=>Object.fromEntries(old.map(id=>[id,{title:'older'}]))});
 await settle(h);expect(h.effects.writes).toHaveLength(1);
 expect(h.effects.writes[0]['license_announcements/ZOE/'+old[0]]).toBe(null);
 expect(Object.keys(h.effects.writes[0])).toHaveLength(2);expect(notice(h)[1]).toEqual({kind:'notice',title:'Synthetic',body:'Body',at:T});
});
for(const recover of [false,true])it('Notice៖ clock loss ពេលអាន'+(recover?' ហើយ sync ថ្មី':'')+' មិនសរសេរ',async()=>{
 const h=fixture();h.sync();h.c.fb.get=async()=>{h.clock.wall+=400*DAY;if(recover)h.sync();return{exists:()=>false};};
 await settle(h);expect(h.effects.writes).toHaveLength(0);expect(h.effects.kicks).toBe(0);
});
it('Notice៖ server correction ពេលអានបោះបង់ lease ចាស់',async()=>{
 const h=fixture();h.sync();h.c.fb.get=async()=>{h.c.ZoeLicense.setServerTimeOffset(400*DAY);return{exists:()=>false};};
 await settle(h);expect(h.effects.writes).toHaveLength(0);
});
it('Notice៖ clock loss ក្រោយ attempt មិនផ្ញើ retry ឬអះអាងជោគជ័យ',async()=>{
 const h=fixture();h.sync();h.c.fb.update=async(_,u)=>{h.effects.writes.push(u);throw Error('unknown transport');};
 h.c.retryAsync=async run=>{try{return await run();}catch{h.clock.wall+=400*DAY;h.sync();return run();}};
 await settle(h);expect(h.effects.writes).toHaveLength(1);expect(h.effects.kicks).toBe(0);expect(h.effects.toasts).toHaveLength(0);
 expect(h.effects.alerts.some(text=>text.includes('មិនទាន់បញ្ជាក់'))).toBe(true);
});
it('Notice៖ ACK ពិតក្រោយ clock loss នៅជោគជ័យ',async()=>{
 const h=fixture();h.sync();h.c.fb.update=async(_,u)=>{h.effects.writes.push(u);h.clock.wall+=400*DAY;};
 await settle(h);expect(h.effects.writes).toHaveLength(1);expect(h.effects.kicks).toBe(1);expect(h.effects.toasts.some(t=>t.startsWith('✅'))).toBe(true);
});
it('Notice៖ session ប្តូរពេល sync មិនអាន ឬសរសេរ',async()=>{
 const h=fixture();h.c.fetch=async url=>{h.c.adminOperationIsCurrent=()=>false;return{ok:true,status:200,redirected:false,headers:{get:()=> 'application/json'},json:async()=>({nonce:new URL(url).searchParams.get('nonce'),now:T})};};
 await settle(h);expect(h.effects.reads).toBe(0);expect(h.effects.writes).toHaveLength(0);
});
it('Notice៖ title ខ្វះ/confirm បដិសេធ មិនសុំម៉ោង ឬសរសេរ',async()=>{
 const h=fixture();let fetches=0;h.c.fetch=async()=>{fetches++;throw Error('not expected');};h.els.noticeTitleInput.value='';
 await settle(h);expect(fetches).toBe(0);expect(h.effects.writes).toHaveLength(0);
 h.els.noticeTitleInput.value='Synthetic';h.c.confirm=()=>false;await settle(h);expect(fetches).toBe(0);expect(h.effects.writes).toHaveLength(0);
});
it('Notice៖ resample ធម្មតាពេលអានរក្សា payload snapshot',async()=>{
 const h=fixture();h.sync();h.c.fb.get=async()=>{h.clock.wall+=1000;h.clock.mono+=1000;h.c.ZoeLicense.setServerTimeOffset(0);return{exists:()=>false};};
 await settle(h);expect(h.effects.writes).toHaveLength(1);expect(notice(h)[1].at).toBe(T);
});
it('Notice៖ ចុចស្ទួនពេលរង់ចាំម៉ោងផ្ញើតែមួយ',async()=>{
 const h=fixture();let answer;
 h.c.fetch=url=>new Promise(resolve=>{answer=()=>resolve({ok:true,status:200,redirected:false,headers:{get:()=> 'application/json'},json:async()=>({nonce:new URL(url).searchParams.get('nonce'),now:T})});});
 const first=h.c.sendNotice();const second=h.c.sendNotice();for(let i=0;i<20;i++)await Promise.resolve();
 if(typeof answer==='function')answer();await first;await second;
 expect(h.effects.writes).toHaveLength(1);expect(h.effects.confirms).toBe(1);
});
