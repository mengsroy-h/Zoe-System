/**
 * លេខទូរស័ព្ទ និង Barcode ក្លែង៖ Sign ពិតក្នុង App + close/pickup/collected ពិត។
 * App → encrypted durable queue → handler/journal/reservation/photo-proof ពិត; upstream ZTO និង storage ជា simulator។ `.validate` អានពី rules ពិត ហើយបដិសេធមុន commit;
 * មិនមែន Firebase emulator, មិនអនុវត្ត `.write`/RLS, មិនសាក ZTO ផ្ទាល់ ឬ camera ពិត។
 * រូបមាន bytes ខុសគ្នាតាម Barcode ដើម្បីចាប់ការប្តូររូបខុសកញ្ចប់។
 */
import { createRequire } from 'node:module';
import { runPalmSignOutbox } from '../src/features/palm-sign-outbox';
import { openSignJob } from '../src/services/palm-sign-outbox-store';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import { pickupBarcodeKey, countPickedUpCustomers } from '../src/domain/pickup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { uncollectedValueByDate, collectedValueOf } from '../src/features/export';
import { palmSignState } from '../src/core/palm-sign-state';
import { registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { openZtoPalmSign, submitZtoPalmSign, recheckZtoPalmSign, acceptPalmSignBarcode, setPalmSignName, palmSignProof } from '../src/features/zto-palm-sign';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
const disk = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('../src/services/palm-sign-outbox-store', async original => ({ ...await original<any>(),
    listSignJobs: vi.fn(async owner => [...disk.rows.values()].filter(row => row.owner === owner).map(row => ({ ...row }))),
    addSignJob: vi.fn(async (row, current) => { if (!current() || disk.rows.has(row.id)) return false; disk.rows.set(row.id, { ...row }); return true; }),
    replaceSignJob: vi.fn(async (previous, next, current) => { const row = disk.rows.get(previous.id); if (!current() || !row || row.revision !== previous.revision) return false; if (next) disk.rows.set(next.id, { ...next }); else disk.rows.delete(previous.id); return true; })
}));
vi.mock('../src/services/palm-sign-camera', () => ({ palmSignLocation: { status: 'ready' }, subscribePalmSignLocation: vi.fn(() => () => {}), capturePalmSignPhoto: vi.fn(async () => ''), palmSignFramePhoto: vi.fn(() => ''), startPalmSignCamera: vi.fn(() => () => {}), startPalmSignLocation: vi.fn(() => () => {}) }));
const HISTORY = 'zoew_scan_history_cod_dod';
const H = 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lab = { latMs: 5, store: {} as Record<string, any> };

function getPath(path: string) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object' || !(p in cur)) return null;
        cur = cur[p];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
}
function setPath(path: string, value: any) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    if (value === null || value === undefined) {
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') return;
            cur = cur[parts[i]];
        }
        delete cur[parts[parts.length - 1]];
        return;
    }
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
}
const rules = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'firebase-database.rules.json'), 'utf8')).rules;
function validateStore(previous: any) {
    function snap(store: any, path: string[]): any {
        const value = path.reduce((v,k) => v?.[k],store) ?? null;
        return { val:()=>structuredClone(value), exists:()=>value!==null,
            isNumber:()=>typeof value==='number' && Number.isFinite(value), isString:()=>typeof value==='string', isBoolean:()=>typeof value==='boolean',
            hasChildren:(keys?: string[])=>value!==null && typeof value==='object' && (keys ? keys.every(k=>value[k]!=null) : Object.keys(value).length>0),
            child:(key: string)=>snap(store,[...path,...String(key).split('/')]), parent:()=>snap(store,path.slice(0,-1)) };
    }
    function walk(rule: any, path: string[], vars: Record<string,string>) {
        const value = path.reduce((v,k)=>v?.[k],lab.store);
        if(value == null) return;
        if(rule['.validate'] !== undefined) {
            const expression = rule['.validate'];
            const valid = typeof expression==='boolean' ? expression : new Function('newData','data','root','auth','now',...Object.keys(vars), 'return ('+expression+');')(snap(lab.store,path),snap(previous,path),snap(previous,[]),{uid:'synthetic'},NOW,...Object.values(vars));
            if(!valid) throw new Error('permission_denied: '+path.join('/'));
        }
        if(typeof value==='object') for(const key of Object.keys(value)) {
            const matched = rule[key] ? key : Object.keys(rule).find(k=>k.startsWith('$')&&k!=='$other') || '$other';
            if(rule[matched]) walk(rule[matched],[...path,key],matched.startsWith('$')?{...vars,[matched]:key}:vars);
        }
    }
    walk(rules,[],{});
}
function checkedWrite(action:()=>void) {
    const previous=structuredClone(lab.store);
    try { action(); validateStore(previous); } catch(error) { lab.store=previous; throw error; }
}
function makeFb() {
    return {
        getIdTokenResult: async () => ({ token: 't' }),
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => {
            await sleep(lab.latMs);
            const v = getPath(ref.path);
            return { val: () => v, exists: () => v !== null };
        },
        update: async (ref: any, payload: any) => {
            await sleep(lab.latMs);
            checkedWrite(()=>{ for (const k of Object.keys(payload)) setPath(ref.path + '/' + k, payload[k]); });
            return true;
        },
        set: async (ref: any, value: any) => {
            await sleep(lab.latMs);
            checkedWrite(()=>setPath(ref.path, value));
            return true;
        },
        runTransaction: async (ref: any, fn: any) => {
            await sleep(lab.latMs);
            const cur = getPath(ref.path);
            const next = fn(cur);
            if (next === undefined) return { committed: false, snapshot: { val: () => cur }, txOutcome: 'not-applied' };
            checkedWrite(()=>setPath(ref.path, next));
            const v = getPath(ref.path);
            return { committed: true, snapshot: { val: () => v }, txOutcome: 'committed' };
        },
        onValue: () => () => {},
        off: () => {},
        increment: (n: number) => n
    };
}
const NOW = Date.UTC(2026, 9, 5, 17, 30, 0);
beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'restamp-user' } } as any;
    firebaseState.db = { restamp: true } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', 'zoew_recently_deleted_cod_dod'],
        ['dbRefDailyRevenue', 'zoew_daily_revenue_cod_dod'], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod'], ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod'],
        ['dbRefRegistry', 'zoew_barcode_registry']] as const) {
        (firebaseState as any)[name] = { path };
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    (window as any).ZoeErrors = { capture: () => {} };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('crypto', webcrypto);
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://sign-shop.firebaseio.com' }));
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    const session = await setupHandler();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}', headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(KEY), palmTokenEnc: await encryptLookupSecret(session), shop: 'https://sign-shop.firebaseio.com' }));
    registerModalMeta('ztoPalmSignModal', {});
    palmSignState.busy = false;
    requests = [];
    outcomes = {};
    gate = null;
    reversedArrival = null;
    vi.stubGlobal('fetch', vi.fn(route));

});

afterEach(async () => {
    firebaseState.authGeneration++; securityState.lookupSecretKey = null;
    await runPalmSignOutbox();
    fn.setBlobsModuleForTests(null);
    vi.unstubAllEnvs();
    closeModal('ztoPalmSignModal');
    unregisterModalMeta('ztoPalmSignModal');
    securityState.lookupSecretKey = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).ZoeErrors;
    firebaseState.dbLivenessProbe = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
    appLocalStore.clear();
});


const CODES = ['77130500990011', '77130500990012', '77130500990013', '77130500990014', '77130500990015'];
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzeiiivYPMP//Z', 'base64');
const PHOTOS = CODES.map((_, i) => Buffer.concat([JPEG.subarray(0,2), Buffer.from([255,254,0,3,65+i]), JPEG.subarray(2)]).toString('base64'));
const DAY = getZoneDateKey(NOW, 0);
const OLD = getZoneDateKey(NOW - 86400000, 0);
const REVENUE = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const COLLECTED = 'zoew_daily_collected_cod_dod';
let requests: any[] = [];
let outcomes: Record<string, string> = {};
let gate: { code: string; promise: Promise<void> } | null = null;
let reversedArrival: { held: string; first: string; promise: Promise<void>; release: () => void } | null = null;
const fn = createRequire(import.meta.url)('../netlify/functions/_shared/zto-order-detail-core.cjs');
const KEY = 'partial-sign-proxy-key-0123456789';
const SITE = 'KH001';
let upstream: Array<{path:string;body:any}> = [];
let uploaded = new Map<string,string>();
const reply = (result: unknown, status = true) => new Response(JSON.stringify({ status, result }));
const photoUrl = (code:string) => 'https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/'+code+'_123.jpg';
const scans = (type:string) => upstream.filter(c=>c.path.endsWith('saveScanInfo')&&c.body[0].scanTypeCode===type).map(c=>c.body[0]);
async function setupHandler() {
    const rows = new Map<string, {data:string;etag:string}>(); let revision=0;
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore:()=>({
        getWithMetadata:async(key:string)=>rows.get(key)||null,
        set:async(key:string,data:string,options:any)=>{
            const previous=rows.get(key);
            if(options?.onlyIfNew&&previous||options?.onlyIfMatch&&previous?.etag!==options.onlyIfMatch)return {modified:false};
            const etag=String(++revision); rows.set(key,{data,etag});return {modified:true,etag};
        }
    }) });
    for(const [key,value] of Object.entries({ZTO_PROXY_KEY:KEY,ZTO_PROXY_KEYS_JSON:'',ZTO_PALM_SESSION_SECRET:'synthetic-session-secret-at-least-32-characters',ZTO_PALM_SIGN_KEY:'synthetic-sign-key',ZTO_PALM_PASSWORD_KEY:'zoew-test-aes-16',ZTO_DETAIL_IDENTITY:'off',ZTO_DETAIL_BRANCH_PATHS:''}))vi.stubEnv(key,value);
    disk.rows.clear(); upstream=[]; uploaded=new Map();
    vi.stubGlobal('indexedDB',{});
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
    securityState.appIsLocked=false; securityState.appLockVeiled=false;
    vi.stubGlobal('fetch',vi.fn(route));
    const login=await fn.handler({httpMethod:'POST',headers:{'x-zoe-proxy-key':KEY},queryStringParameters:{palm:'login'},body:JSON.stringify({username:'test-operator',password:'test',deviceSn:'partial-customer-test'})});
    const session=JSON.parse(login.body).sessionToken; expect(session).toEqual(expect.any(String));return session;
}
async function fakeZto(url:string,init?:RequestInit) {
    const path=new URL(url).pathname, body=init?.body?JSON.parse(String(init.body)):null;
    upstream.push({path,body});
    const code=String(body?.billCode||body?.mailNos||'');
    if(path.endsWith('doLogin'))return reply({token:'palm-token',countryCode:'KH',siteCode:SITE});
    if(path.endsWith('queryTrackInfo')) {
        const signed=outcomes[code]==='elsewhere'||outcomes[code]==='signed'||scans('05').some(c=>c.billCode===code)&&outcomes[code]!=='unknown';
        const tracks:any[]=[{action:'3',siteCode:SITE,mailNo:code,time:'2026-10-05 23:25:26'}];
        if(scans('04').some(c=>c.billCode===code))tracks.unshift({action:'4',siteCode:SITE,mailNo:code,time:'2026-10-05 23:33:04',preOrNextID:'04'});
        if(signed)tracks.unshift({action:'5',siteCode:SITE,mailNo:code,time:'2026-10-05 23:34:04'});
        return reply([{mail:{mailNo:code,isSign:signed?1:0},tracks}]);
    }
    if(path.endsWith('newBusinessCheck'))return reply(body.scanType===5&&outcomes[code]==='failed'?{message:'synthetic rejected',whetherForce:true}:null);
    if(path.endsWith('queryPreOrderByBillCode'))return reply({billCode:code});
    if(path.endsWith('querySignPic'))return reply(uploaded.has(code)?[{billCode:code,savePos:photoUrl(code)}]:[]);
    if(path.endsWith('saveBillPic')) { uploaded.set(code,body.fileName);return reply(null); }
    if(path.endsWith('/add'))return reply('log-id');
    if(path.endsWith('saveScanInfo')) {
        if(body[0].scanTypeCode==='05'&&outcomes[body[0].billCode]==='unknown')throw new Error('synthetic-lost-05-ack');
        return reply([]);
    }
    return reply(null);
}
async function route(url:unknown,init?:RequestInit):Promise<Response> {
    const target=String(url);
    const photoCode=CODES.find(code=>target===photoUrl(code));
    if(photoCode) {
        expect(init?.credentials).toBe('omit'); expect(init?.redirect).toBe('error');
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
        return new Response(Buffer.from(uploaded.get(photoCode)!,'base64'),{headers:{'Content-Type':'image/jpeg'}});
    }
    if(!target.includes('/.netlify/functions/zto-order-detail'))return fakeZto(target,init);
    const body=JSON.parse(String(init?.body));
    if(body.stage==='receipt'&&reversedArrival?.held===body.barcode)await reversedArrival.promise;
    requests.push(body);
    if(body.stage==='receipt'&&reversedArrival?.first===body.barcode)reversedArrival.release();
    if(body.stage==='receipt') {
        const durable=(await jobs()).find(job=>job.code===body.barcode);
        expect(durable).toMatchObject({photo:PHOTOS[CODES.indexOf(body.barcode)],requestId:body.requestId,reservationProtocol:'original-reservation-v1',reservationOwner:body.reservationOwner,reservationToken:body.reservationToken});
        expect(durable?.originalSHA256).toMatch(/^[a-f0-9]{64}$/);
        for(const row of disk.rows.values()) { expect(row).not.toHaveProperty('photo'); expect(row.cipher.byteLength).toBeGreaterThan(0); }
        if(gate?.code===body.barcode)await gate.promise;
    }
    const parsed=new URL(target),headers:Record<string,string>={};
    new Headers(init?.headers).forEach((v,k)=>{headers[k.toLowerCase()]=v;});
    const result=await fn.handler({httpMethod:init?.method||'GET',headers,queryStringParameters:Object.fromEntries(parsed.searchParams),blobs:'synthetic-context',body:JSON.stringify(body)});
    return new Response(result.body,{status:result.statusCode,headers:result.headers});
}
async function drain() {
    await runPalmSignOutbox();
    await vi.waitFor(async()=>{
        for(const row of disk.rows.values()) {
            const job=await openSignJob(row,securityState.lookupSecretKey!);
            expect(row.leaseUntil).toBe(0);
            expect(job.phase==='action'||job.phase==='checking'&&row.due>Date.now()).toBe(true);
        }
    },{timeout:5000});
}
async function jobs() { return Promise.all([...disk.rows.values()].map(row=>openSignJob(row,securityState.lookupSecretKey!))); }
async function retryUnknown(code:string) {
    await drain();
    for(const row of disk.rows.values())if((await openSignJob(row,securityState.lookupSecretKey!)).code===code)disk.rows.set(row.id,{...row,due:0});
    await drain();
}
function seed() {
    const barcodes = CODES.map((code, i) => ({ code, isClosed: false, cod: i + 1, dod: (i + 1) / 10, isDeducted: false, isFromDeletion: false, createdAt: NOW - H, time: '17:00:00' }));
    const item = { id: 'samePhone', phone: '012000000', scanDate: DAY, isClosed: false, createdAt: NOW-H, cod: 15, dod: 1.5, price: 15, count: 5, barcode: CODES[0], time: '17:00:00', barcodes };
    const other = { ...structuredClone(item), id: 'otherPhone', phone: '012000001', barcodes: [{...barcodes[0], code: '77130500999991'}], cod: 1, dod: 0.1, count: 1 };
    const prior = { ...structuredClone(other), id: 'priorDay', phone: item.phone, scanDate: OLD, barcodes: [{...barcodes[0], code: '77130500999992'}] };
    for (const row of [item,other,prior]) {
        setPath(HISTORY+'/'+row.id,row);
        row.barcodes.forEach(b => setPath('zoew_barcode_registry/'+barcodeRegistryKey(b.code),true));
    }
    setPath(REVENUE, { [DAY]: { codDollar: 16, dodDollar: 1.6, totalCount: 6 }, [OLD]: { codDollar: 1, dodDollar: 0.1, totalCount: 1 } });
    setPath(MONTHLY, { [DAY.slice(0,7)]: { codDollar: 17, dodDollar: 1.7, totalCount: 7 } });
    dataState.scanHistory = [item,other,prior] as any;
    dataState.dailyRevenueData = getPath(REVENUE);
    dataState.monthlyRevenueData = getPath(MONTHLY);
    validateStore({});
    return structuredClone(lab.store);
}
async function prepare(selected: string[]) {
    openZtoPalmSign('samePhone');
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    setPalmSignName('សុខា');
    for(const code of selected) acceptPalmSignBarcode(code, PHOTOS[CODES.indexOf(code)]);
    await vi.waitFor(() => expect(selected.every(code => !!palmSignProof(code))).toBe(true));
}
function verify(before: any, signed: string[]) {
    const row = getPath(HISTORY+'/samePhone');
    expect(row.isClosed).toBe(signed.length === 5);
    for(const code of CODES) {
        const index = CODES.indexOf(code), b = row.barcodes[index];
        expect(b.isClosed,code).toBe(signed.includes(code));
        expect(b.cod).toBe(index+1); expect(b.dod).toBe((index+1)/10);
        expect(b.isDeducted).toBe(false);
        if (!signed.includes(code)) expect(b).toEqual(before[HISTORY].samePhone.barcodes[index]);
    }
    expect(getPath(HISTORY+'/otherPhone')).toEqual(before[HISTORY].otherPhone);
    expect(getPath(HISTORY+'/priorDay')).toEqual(before[HISTORY].priorDay);
    expect(getPath(REVENUE)).toEqual(before[REVENUE]);
    expect(getPath(MONTHLY)).toEqual(before[MONTHLY]);
    const collected = getPath(COLLECTED+'/'+DAY) || {};
    expect(Object.keys(collected).sort()).toEqual(signed.map(pickupBarcodeKey).sort());
    signed.forEach(code => expect(collected[pickupBarcodeKey(code)]).toEqual({ c: CODES.indexOf(code)+1,d:(CODES.indexOf(code)+1)/10 }));
    const pickup = getPath(PICKUP+'/'+DAY) || {};
    expect(pickup.packagesPickedUp || 0).toBe(signed.length);
    expect(countPickedUpCustomers(pickup)).toBe(signed.length ? 1 : 0);
    dataState.scanHistory = Object.values(getPath(HISTORY));
    const open = uncollectedValueByDate();
    const value = collectedValueOf(16,1.6,open[DAY]);
    const cod = signed.reduce((s,c) => s + CODES.indexOf(c)+1,0);
    expect(value).toEqual({cod,dod:cod/10,total:Math.round(cod*1.1*100)/100});
    const monthOpen = Object.entries(open).filter(([day])=>day.startsWith(DAY.slice(0,7))).reduce((sum,[,v]:any)=>({cod:sum.cod+v.cod,dod:sum.dod+v.dod}),{cod:0,dod:0});
    expect(collectedValueOf(17,1.7,monthOpen)).toEqual(value);
    expect(collectedValueOf(1,.1,open[OLD])).toEqual({cod:0,dod:0,total:0});
}
function expectReceiptAssociations(receipts: any[], chosen: string[]) {
    expect([...receipts].sort((a,b)=>a.barcode.localeCompare(b.barcode))).toEqual([...chosen].sort().map(code => expect.objectContaining({barcode:code,photo:PHOTOS[CODES.indexOf(code)],stage:'receipt',signMan:'សុខា'})));
}
it.each([false,true])('លេខទូរស័ព្ទមួយ កញ្ចប់៥៖ Sign ២ រូបតាម Barcode · ទុក៣ · ចុចស្ទួនមិនបូកប្រាក់ឬចំនួន · លំដាប់បញ្ច្រាស %s', async (reverse) => {
    const before = seed();
    const chosen = [CODES[0],CODES[3]];
    await prepare(chosen);
    if(reverse) {
        let release!:()=>void;
        const promise=new Promise<void>(resolve=>{release=resolve;});
        reversedArrival={held:chosen[0],first:chosen[1],promise,release};
    }
    await Promise.all([submitZtoPalmSign(chosen),submitZtoPalmSign(chosen)]);
    await drain();
    verify(before,chosen);
    const receipts=requests.filter(r=>r.stage==='receipt');
    expectReceiptAssociations(receipts,chosen);
    if(reverse) {
        expect(receipts.map(row=>row.barcode)).toEqual([...chosen].reverse());
        expect(()=>expectReceiptAssociations(receipts.map((row,index)=>({...row,photo:receipts[1-index].photo})),chosen)).toThrow();
        expect(()=>expectReceiptAssociations([receipts[0],receipts[0]],chosen)).toThrow();
        expect(()=>expectReceiptAssociations(receipts.slice(0,1),chosen)).toThrow();
        expect(()=>expectReceiptAssociations([...receipts,receipts[0]],chosen)).toThrow();
    }
    await recheckZtoPalmSign();
    await drain();
    verify(before,chosen);
    expect(requests.filter(r=>r.stage==='receipt')).toHaveLength(2);
    expect(scans('05').map(row=>row.billCode).sort()).toEqual([CODES[0],CODES[3]]);
    expect(disk.rows.size).toBe(chosen.length);
    expect((await jobs()).every(job=>job.signedCleanupConfirmed===true)).toBe(true);
    for (const job of await jobs()) expect(job.photo).toBe(PHOTOS[CODES.indexOf(job.code)]);
});
it('លេខទូរស័ព្ទមួយ៖ ជោគជ័យ១ បរាជ័យ១ មិនច្បាស់១ ទុក២ · recheck មិន Sign ស្ទួន', async () => {
    const before = seed();
    outcomes[CODES[1]] = 'failed'; outcomes[CODES[2]] = 'unknown';
    const chosen = CODES.slice(0,3);
    await prepare(chosen);
    await submitZtoPalmSign(chosen);
    await drain();
    verify(before,[CODES[0]]);
    expect((await jobs()).filter(j=>!j.signedCleanupConfirmed).map(j=>[j.code,j.phase]).sort()).toEqual([[CODES[1],'action'],[CODES[2],'checking']]);
    for(const job of await jobs()) expect(job.photo).toBe(PHOTOS[CODES.indexOf(job.code)]);
    expect(requests.filter(r=>r.stage==='receipt')).toHaveLength(3);
    outcomes[CODES[2]] = 'signed';
    await retryUnknown(CODES[2]);
    verify(before,[CODES[0],CODES[2]]);
    expect(requests.filter(r=>r.stage==='receipt')).toHaveLength(3);
    expect(scans('05').map(row=>row.billCode).sort()).toEqual([CODES[0],CODES[2]]);
    expect((await jobs()).filter(job=>!job.signedCleanupConfirmed).map(job=>job.code)).toEqual([CODES[1]]);
    expect((await jobs()).filter(job=>job.signedCleanupConfirmed)).toHaveLength(2);
    expect(uploaded.get(CODES[0])).toBe(PHOTOS[0]); expect(uploaded.get(CODES[2])).toBe(PHOTOS[2]);
    const stable = structuredClone(lab.store);
    await recheckZtoPalmSign();
    expect(lab.store).toEqual(stable);
});
it('Sign ពីកន្លែងផ្សេងតែមួយ · Sign ជ្រើសរើសមួយឆ្លើយយឺត · ទុកកញ្ចប់ផ្សេង', async () => {
    const before = seed(); outcomes[CODES[4]]='elsewhere';
    await prepare([CODES[0]]);
    verify(before,[CODES[4]]);
    let release!:()=>void;
    gate = { code:CODES[0],promise:new Promise<void>(resolve=>{release=resolve;}) };
    const sending = submitZtoPalmSign([CODES[0]]);
    await vi.waitFor(()=>expect(requests.some(r=>r.stage==='receipt')).toBe(true));
    verify(before,[CODES[4]]);
    release(); await sending; await drain();
    verify(before,[CODES[0],CODES[4]]);
    expect(requests.filter(r=>r.stage==='receipt')).toHaveLength(1);
});

it('rules បដិសេធ money អវិជ្ជមាន និង field ខុស · បន្ទាប់មក Sign៥ មនុស្ស១ កញ្ចប់៥', async () => {
    const before = seed();
    await expect(firebaseState.fb!.set(firebaseState.fb!.ref(firebaseState.db,REVENUE+'/'+DAY+'/codDollar'),-1)).rejects.toThrow('permission_denied');
    await expect(firebaseState.fb!.set(firebaseState.fb!.ref(firebaseState.db,HISTORY+'/samePhone/unknownField'),'bad')).rejects.toThrow('permission_denied');
    await prepare(CODES);
    await submitZtoPalmSign(CODES);
    await drain();
    verify(before,CODES);
    expect(disk.rows.size).toBe(CODES.length);
    expect((await jobs()).every(job=>job.signedCleanupConfirmed===true)).toBe(true);
    for (const job of await jobs()) expect(job.photo).toBe(PHOTOS[CODES.indexOf(job.code)]);
    expect(requests.filter(r=>r.stage==='receipt').map(r=>r.barcode).sort()).toEqual(CODES);
    for(const code of CODES) {
        expect(requests.find(r=>r.stage==='receipt'&&r.barcode===code).photo).toBe(PHOTOS[CODES.indexOf(code)]);
        expect(uploaded.get(code)).toBe(PHOTOS[CODES.indexOf(code)]);
    }
    expect(scans('05').map(row=>row.billCode).sort()).toEqual(CODES);
    expect(upstream.filter(row=>row.path.endsWith('querySignPic'))).toHaveLength(5);
});
it('phone ដដែល Sign ម្តង២ថ្ងៃ៖ scan-day count មនុស្ស១ · collected បែងតាមថ្ងៃពិត និងមិន restamp', async () => {
    const before=seed();
    await prepare([CODES[0]]);
    await submitZtoPalmSign([CODES[0]]);
    await drain();
    const original=getPath(HISTORY+'/samePhone').barcodes[0].closedAt;
    vi.setSystemTime(new Date(NOW+86400000));
    const login=await fn.handler({httpMethod:'POST',headers:{'x-zoe-proxy-key':KEY},queryStringParameters:{palm:'login'},body:JSON.stringify({username:'test-operator',password:'test',deviceSn:'partial-customer-test'})});
    const cfg=JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
    cfg.palmTokenEnc=await encryptLookupSecret(JSON.parse(login.body).sessionToken);
    appLocalStore.setItem('zoew_lookup_api_config',JSON.stringify(cfg));
    await prepare([CODES[1]]);
    await Promise.all([submitZtoPalmSign([CODES[1]]),submitZtoPalmSign([CODES[1]])]);
    await drain();
    const row=getPath(HISTORY+'/samePhone');
    expect(row.isClosed).toBe(false);
    expect(row.barcodes[0].closedAt).toBe(original);
    expect(getZoneDateKey(row.barcodes[1].closedAt,0)).toBe(getZoneDateKey(NOW+86400000,0));
    expect(row.barcodes.slice(2)).toEqual(before[HISTORY].samePhone.barcodes.slice(2));
    expect(getPath(COLLECTED+'/'+DAY)).toEqual({[pickupBarcodeKey(CODES[0])]:{c:1,d:.1}});
    expect(getPath(COLLECTED+'/'+getZoneDateKey(NOW+86400000,0))).toEqual({[pickupBarcodeKey(CODES[1])]:{c:2,d:.2}});
    expect(getPath(PICKUP+'/'+DAY).packagesPickedUp).toBe(2);
    expect(countPickedUpCustomers(getPath(PICKUP+'/'+DAY))).toBe(1);
    expect(getPath(REVENUE)).toEqual(before[REVENUE]);
    expect(getPath(MONTHLY)).toEqual(before[MONTHLY]);
    expect(getPath(HISTORY+'/otherPhone')).toEqual(before[HISTORY].otherPhone);
    expect(getPath(HISTORY+'/priorDay')).toEqual(before[HISTORY].priorDay);
    expect(requests.filter(r=>r.stage==='receipt')).toHaveLength(2);
    await submitZtoPalmSign([CODES[1]]);
    expect(requests.filter(r=>r.stage==='receipt')).toHaveLength(2);
});
