import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.env.KEYGEN_CALENDAR_SOURCE_ROOT || path.resolve(__dirname, '../../../..');
const probes = [
    Date.UTC(2026, 11, 31, 16, 59, 59, 999), Date.UTC(2026, 11, 31, 17),
    Date.UTC(2028, 1, 28, 16, 59, 59, 999), Date.UTC(2028, 1, 28, 17),
    Date.UTC(2028, 1, 29, 16, 59, 59, 999), Date.UTC(2028, 1, 29, 17),
    Date.UTC(2026, 2, 8, 7), Date.UTC(2026, 10, 1, 6)
];
const child = String.raw`
const fs=require('node:fs'), vm=require('node:vm');
const root=process.argv[1], probes=JSON.parse(process.argv[2]);
const source=fs.readFileSync(root+'/ZoeKeyGen/app.js','utf8');
const ast=require(root+'/ZoeW/node_modules/acorn').parse(source,{ecmaVersion:'latest'});
const names=['seatMetaText','seatDeviceLabel','escapeHtml','renderKeyList','confirmExtendKey','renderNoticeList','sbTenantState','sbDeviceLabel','sbDevicesHtml','renderSbTenantList','renderSbInviteResult','sbIssueInvite'];
const pieces=names.map(name=>{
 const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);
 if(!node) throw Error('Missing actual source function: '+name);
 return source.slice(node.start,node.end);
});
function fixture(ms){
 const nodes={}, effects={toasts:[],writes:[],rpc:[]};
 const c={Date,Intl,console,Promise,Number,String,Math,Map,Set,JSON,Object,Array,isFinite,isNaN,
  document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:'',value:'1',classList:{toggle(){},add(){},remove(){}}})},
  getServerNow:()=>ms-86400000,captureSensitiveSession:()=>({}),adminOperationIsCurrent:()=>true,
  waitForServerTimeSync:async()=>true,captureKeygenClock:()=>({now:ms-86400000}),keygenClockIsCurrent:()=>true,
  withTimeout:async p=>p,showToast:message=>effects.toasts.push(message),alert:message=>{throw Error(message);},
  closeModal(){},refreshKeyList(){},renderSbLookupTargets(){},setSbAdminBusy(){},sbAdminIsCurrent:()=>true,
  sbAdminRpc:async(session,name,payload)=>{effects.rpc.push({name,payload});return{ok:true,body:[{code:'synthetic',expires_at:new Date(ms).toISOString()}]};},
  sbInviteSetupLink:()=>'',renderQrInto(){},sbAdminErrorText:()=>'',
  fb:{ref:(db,p)=>p,runTransaction:async(p,updater)=>{const value=updater(ms-86400000);effects.writes.push({p,value});return{committed:true,snapshot:{val:()=>value}};}},
  db:{},keyListCache:[{id:'synthetic-key',expiresAt:ms,paths:['ZOE','ALL'],perApp:{ZOE:{expiresAt:ms-86400000},ALL:{expiresAt:ms-86400000}},seatDevices:[],maxDevices:1,scope:'ZOE',inconsistent:true}],
  seatReadFailed:false,APP_LABELS:{ZOE:'ZoeW',ALL:'ទាំងអស់'},extendTargetId:'synthetic-key',
  NOTICE_KIND_LABELS:{notice:'ដំណឹង'},noticeReadFailed:false,noticeListCache:[{id:'synthetic',at:ms,kind:'notice',title:'ដំណឹង',body:''}],
  sbMemberCache:[],sbDeviceReadFailed:false,sbDeviceCache:[],sbTenantReadFailed:false,sbMemberReadFailed:false,sbAdminBusy:false,
  sbTenantCache:[{id:'synthetic-tenant',name:'ហាង',branch_code:'SYN',expires_at:new Date(ms).toISOString()}],
  sbLastInvite:null,SB_INVITE_VALID_HOURS:24
 }; c.window=c;vm.createContext(c);vm.runInContext(pieces.join('\n'),c);
 return {c,nodes,effects};
}
(async()=>{
 const out=[];
 for(const ms of probes){
  const h=fixture(ms),c=h.c;
  const seat=c.seatDeviceLabel({slot:'d1',device:'synthetic',at:ms});
  c.renderKeyList();const key=h.nodes.keyListBody.innerHTML;
  c.renderNoticeList();const notice=h.nodes.noticeListBody.innerHTML;
  const device=c.sbDeviceLabel({last_seen:new Date(ms).toISOString()});
  c.renderSbTenantList();const tenant=h.nodes.sbTenantListBody.innerHTML;
  await c.sbIssueInvite({}, {id:'synthetic-tenant',name:'ហាង'}, 'owner');
  const invite=h.nodes.sbInviteResultLabel.textContent;
  await c.confirmExtendKey();
  const extend=h.effects.toasts[0];
  out.push({ms,seat,key,notice,device,tenant,invite,extend,writes:h.effects.writes,rpc:h.effects.rpc});
 }
 const empty=fixture(probes[0]);empty.c.keyListCache=[];empty.c.noticeListCache=[];empty.c.sbTenantCache=[];
 empty.c.renderKeyList();empty.c.renderNoticeList();empty.c.renderSbTenantList();
 process.stdout.write(JSON.stringify({out,empty:{key:empty.nodes.keyListBody.innerHTML,notice:empty.nodes.noticeListBody.innerHTML,tenant:empty.nodes.sbTenantListBody.innerHTML}}));
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
const zones = ['UTC', 'Asia/Phnom_Penh', 'America/Los_Angeles', 'America/New_York', 'Pacific/Kiritimati'];
const date = (ms: number) => new Date(ms).toLocaleDateString('km-KH', { timeZone: 'Asia/Phnom_Penh' });
const stamp = (ms: number) => new Date(ms).toLocaleString('km-KH', { timeZone: 'Asia/Phnom_Penh' });
for (const zone of zones) describe('KeyGen ប្រតិទិនកម្ពុជា៖ ' + zone, () => {
    const result = JSON.parse(execFileSync(process.execPath, ['-e', child, root, JSON.stringify(probes)], {
        env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 15000
    }));
    for (const field of ['seat', 'key', 'device', 'tenant', 'extend']) {
        it(field + ' បង្ហាញថ្ងៃកម្ពុជានៅព្រំដែនថ្ងៃ/ខែ/ឆ្នាំ', () => {
            for (const row of result.out) expect(row[field]).toContain(date(row.ms));
        });
    }
    it('per-App ផុតកំណត់ក្នុង tooltip ជាថ្ងៃកម្ពុជា', () => {
        for (const row of result.out) expect(row.key).toContain('ផុតកំណត់ ' + date(row.ms - 86400000));
    });
    for (const field of ['notice', 'invite']) it(field + ' បង្ហាញថ្ងៃ និងម៉ោងកម្ពុជា', () => {
        for (const row of result.out) expect(row[field]).toContain(stamp(row.ms));
    });
    it('ទិសផ្ទុយ៖ ការបង្ហាញមិនបម្លែង epoch ដែលសរសេរ ឬ RPC', () => {
        for (const row of result.out) {
            expect(row.writes).toHaveLength(2);
            expect(row.writes.map((write: any) => write.value)).toEqual([row.ms, row.ms]);
            expect(row.rpc).toEqual([{ name: 'admin_issue_invite', payload: { p_tenant_id: 'synthetic-tenant', p_role: 'owner', p_max_uses: 1, p_valid_hours: 24 } }]);
        }
        expect(result.empty.key).toContain('មិនទាន់មាន Key');
        expect(result.empty.notice).toContain('មិនទាន់មានដំណឹង');
        expect(result.empty.tenant).toContain('មិនទាន់មានហាង');
    });
});
