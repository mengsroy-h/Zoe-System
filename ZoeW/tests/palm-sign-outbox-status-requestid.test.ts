import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { appLocalStore } from '../src/core/storage';
import { dataState, firebaseState, securityState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { barcodeSignIdentity } from '../src/domain/barcode';
import { sealSignJob, openSignJob, type SignJob } from '../src/services/palm-sign-outbox-store';
import { palmOriginalFingerprint, palmOriginalPhotoHash, palmSignConfigKey } from '../src/services/palm-sign-transport';
import { encryptLookupSecret } from '../src/services/crypto';
import { actOnQueuedSign, runPalmSignOutbox } from '../src/features/palm-sign-outbox';
const disk=vi.hoisted(()=>({rows:new Map<string,any>()}));
vi.mock('../src/services/palm-sign-outbox-store',async original=>({...await original<any>(),
    listSignJobs:async(owner:string)=>[...disk.rows.values()].filter(row=>row.owner===owner).map(row=>structuredClone(row)),
    replaceSignJob:async(previous:any,next:any,current:()=>boolean)=>{const actual=disk.rows.get(previous.id);if(!current()||!actual||actual.revision!==previous.revision)return false;if(next)disk.rows.set(next.id,structuredClone({...next,revision:previous.revision+1}));else disk.rows.delete(previous.id);return true;}
}));
const req=createRequire(import.meta.url);
const fn=req('../netlify/functions/_shared/zto-order-detail-core.cjs');
const KEY='synthetic-outbox-proxy-0123456789';
const BLOBS=Buffer.from(JSON.stringify({url:'https://blobs.invalid',token:'synthetic'})).toString('base64');
const NOW=Date.UTC(2026,10,1,1),CODE='SYNTHETIC0001';
const photo=Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]).toString('base64');
const localClose = vi.hoisted(() => vi.fn(async () => false));
vi.mock('../src/services/palm-sign-transport', async original => ({ ...await original<any>(), recordPalmSignResult: localClose }));
let key:CryptoKey,job:SignJob,id:string;
beforeEach(async()=>{
    vi.stubGlobal('crypto',webcrypto);vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(NOW);disk.rows.clear();localClose.mockClear();
    Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
    securityState.appIsLocked=false;securityState.appLockVeiled=false;
    key=await webcrypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']) as CryptoKey;securityState.lookupSecretKey=key;
    firebaseState.authGeneration++;viewState.backendKind='supabase';firebaseState.isInitializingFirebase=false;
    const options={supabaseUrl:'https://audit.invalid'};
    firebaseState.auth={app:{options},currentUser:{uid:'synthetic-user'}} as any;firebaseState.db={app:{options}} as any;
    firebaseState.fb={tenantScope:()=> 'tenant-a',getIdTokenResult:async()=>({token:'synthetic-supabase-token'})} as any;
    firebaseState.isDatabaseConnected=true;firebaseState.serverClockTrusted=true;firebaseState.serverTimeOffsetMs=0;
    appLocalStore.clear();appLocalStore.setItem('zoew_firebase_config',JSON.stringify(options));
    for(const [name,value] of Object.entries({ZTO_PROXY_KEY:KEY,ZTO_PROXY_KEYS:'',ZTO_PALM_SESSION_SECRET:'synthetic-session-secret-longer-than32characters',ZTO_PALM_SIGN_KEY:'synthetic-protocol',ZTO_PALM_PASSWORD_KEY:'zoew-test-aes-16',ZTO_DETAIL_IDENTITY:'off',ZTO_DETAIL_BRANCH_PATHS:''}))vi.stubEnv(name,value);
    fn.resetCachesForTests();
    const blobs=new Map<string,any>();let revision=0;
    fn.setBlobsModuleForTests({connectLambda(){},getStore:()=>({getWithMetadata:async(k:string)=>structuredClone(blobs.get(k)||null),set:async(k:string,data:string,options:any)=>{const current=blobs.get(k);if(options?.onlyIfNew&&current||options?.onlyIfMatch&&current?.etag!==options.onlyIfMatch)return {modified:false};const etag='e'+(++revision);blobs.set(k,{data,etag,metadata:options?.metadata});return {modified:true,etag};}})});
    vi.stubGlobal('fetch',async(target:any)=>{if(String(target).endsWith('/doLogin'))return new Response(JSON.stringify({status:true,result:{token:'synthetic-palm',siteCode:'KH001',countryCode:'KH'}}));if(String(target).endsWith('/queryTrackInfo'))return new Response(JSON.stringify({status:true,result:[{mail:{mailNo:CODE,isSign:0},tracks:[{mailNo:CODE,siteCode:'KH001',action:'3',time:'2026-11-01 07:58:00'}]}]}));throw new Error('មិនអនុញ្ញាតសំណើ '+target);});
    const login=await fn.handler({blobs:BLOBS,httpMethod:'POST',headers:{'x-zoe-proxy-key':KEY},queryStringParameters:{palm:'login'},body:JSON.stringify({username:'synthetic',password:'synthetic',deviceSn:'zoew-test-device'})});
    expect(login.statusCode).toBe(200);
    const predecessor=await fn.handler({blobs:BLOBS,httpMethod:'POST',headers:{'x-zoe-proxy-key':KEY,'x-zoe-palm-token':JSON.parse(login.body).sessionToken},queryStringParameters:{palm:'sign'},body:JSON.stringify({stage:'receipt-status',barcode:CODE,requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',photoProtocol:'original-sha256-v1',originalSHA256:'a'.repeat(64),reservationProtocol:'original-reservation-v1',originalFingerprint:'b'.repeat(64)})});
    expect(predecessor.statusCode).toBe(409);expect(JSON.parse(predecessor.body).code).toBe('ZTO_PALM_SIGN_RESUME_READY');
    const cfg={enabled:true,url:window.location.origin+'/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',palmTokenEnc:await encryptLookupSecret(JSON.parse(login.body).sessionToken),headerName:'X-Zoe-Proxy-Key',headerValueEnc:await encryptLookupSecret(KEY),palmAccount:{siteCode:'KH001'},shop:'https://audit.invalid#tenant-a'};
    appLocalStore.setItem('zoew_lookup_api_config',JSON.stringify(cfg));
    dataState.scanHistory=[{id:'synthetic-row',scanDate:'2026-11-01',createdAt:NOW-3600000,barcodes:[{code:CODE,createdAt:NOW-3600000,isClosed:false}]}] as any;dataState.deletedItems=[];
    const requestId='12345678-1234-1234-1234-123456789abc';
    job={code:CODE,itemId:'synthetic-row',requestId,signMan:'សាកល្បង',photo,dispatchProof:'',reservationProtocol:'original-reservation-v1',originalFingerprint:await palmOriginalFingerprint(CODE,requestId,'សាកល្បង',photo),originalSHA256:await palmOriginalPhotoHash(photo),signature:palmSignConfigKey(cfg),parcelIdentity:barcodeSignIdentity(dataState.scanHistory[0],dataState.scanHistory[0].barcodes[0]),phase:'action',attempts:1,message:'សាកល្បង',recovery:{archivedAt:NOW-600000,previousPhase:'checking',previousMessage:'សាកល្បង'}};
    const row=await sealSignJob(JSON.stringify(['https://audit.invalid#tenant-a','synthetic-user']),key,job);id=row.id;disk.rows.set(id,row);
});
afterEach(async()=>{firebaseState.authGeneration++;securityState.lookupSecretKey=null;securityState.appIsLocked=false;await runPalmSignOutbox();fn.resetCachesForTests();fn.setBlobsModuleForTests(null);vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});

async function reseal(patch: Partial<SignJob> = {}) {
    job = { ...job, ...patch };
    const row = await sealSignJob(JSON.stringify(['https://audit.invalid#tenant-a', 'synthetic-user']), key, job);
    disk.rows.set(id, row);
}
async function keptJob() { return openSignJob(disk.rows.get(id), key); }

type StatusKind = 'signed' | 'unsigned' | 'wrong-barcode' | 'cached' | 'returned' | 'failure';
function serverNetwork(options: { kind?: StatusKind; addIdControl?: boolean; receiptSigned?: boolean } = {}) {
    const statusBodies: any[] = [];
    const stages: string[] = [];
    const responses: { status: number; stage: string }[] = [];
    let upstreamReads = 0;
    vi.stubGlobal('fetch', async (target: any, init: any) => {
        const url = new URL(String(target));
        if (!url.pathname.startsWith('/.netlify/functions/')) {
            if (url.pathname !== '/zto/locus/v1/queryTrackInfo') throw new Error('មិនអនុញ្ញាត upstream mutation ' + url.pathname);
            upstreamReads++;
            const signed = options.kind !== 'unsigned';
            return new Response(JSON.stringify({ status: true, result: [{ mail: { mailNo: CODE, isSign: signed ? 1 : 0 }, tracks: [
                { mailNo: CODE, siteCode: 'KH001', action: '3', time: '2026-11-01 07:58:00' },
                ...(signed ? [{ mailNo: CODE, siteCode: 'KH001', action: '5', time: '2026-11-01 07:59:00' }] : [])
            ] }] }));
        }
        const input = JSON.parse(init.body);
        if (!['receipt-status', 'status'].includes(input.stage)) throw new Error('មិនអនុញ្ញាត mutation ' + input.stage);
        stages.push(input.stage);
        if (input.stage === 'status') statusBodies.push(input);
        if (options.receiptSigned && input.stage === 'receipt-status') {
            return new Response(JSON.stringify({ success: true, stage: 'receipt', barcode: CODE, requestId: job.requestId,
                ztoClosed: true, scanCompleted: true, photoAccepted: false }));
        }
        const wire = options.addIdControl && input.stage === 'status' ? { ...input, requestId: job.requestId } : input;
        const out = await fn.handler({ blobs: BLOBS, httpMethod: init.method, headers: Object.fromEntries(new Headers(init.headers)),
            queryStringParameters: Object.fromEntries(url.searchParams), body: JSON.stringify(wire) });
        let payload = JSON.parse(out.body), status = out.statusCode;
        responses.push({ status, stage: input.stage });
        if (input.stage === 'status' && status === 200) {
            if (options.kind === 'wrong-barcode') payload = { ...payload, barcode: 'SYNTHETIC0002' };
            if (options.kind === 'cached') payload = { ...payload, cached: true };
            if (options.kind === 'returned') payload = { ...payload, ztoReturned: true };
            if (options.kind === 'failure') status = 503;
        }
        return new Response(JSON.stringify(payload), { status });
    });
    return { statusBodies, stages, responses, upstreamReads: () => upstreamReads };
}

it.each(['recover', 'held', 'trash', 'confirmed'] as const)('C03 ផ្លូវ %s ផ្ញើ requestId ដើមទៅ status parser ពិត ហើយរក្សារូប', async route => {
    if (route === 'trash') {
        const item = structuredClone(dataState.scanHistory[0]);
        item.barcodes[0].ztoSignedAt = NOW - 1000;
        dataState.deletedItems = [{ ...item, deletedAt: NOW, trashReason: 'pickup' }];
        dataState.scanHistory = [];
        await reseal({ recovery: undefined, phase: 'checking' });
    } else if (route === 'confirmed') await reseal({ recovery: undefined, phase: 'checking' });
    const net = serverNetwork({ receiptSigned: route === 'confirmed' });
    if (route === 'recover') await actOnQueuedSign(id, 'recover');
    else {
        await runPalmSignOutbox();
        await vi.waitFor(async () => expect((await keptJob()).recoveryCheck?.statusChecked).toBe(true));
        await vi.waitFor(() => expect(disk.rows.get(id).leaseUntil).toBe(0));
    }
    const kept = await keptJob();
    expect(net.statusBodies).toHaveLength(1);
    expect(net.statusBodies[0]).toMatchObject({ stage: 'status', barcode: CODE, requestId: job.requestId });
    expect(net.responses.find(response => response.stage === 'status')?.status).toBe(200);
    expect(net.upstreamReads()).toBe(1);
    expect(kept.recoveryCheck?.signedStatusVerified).toBe(true);
    expect(kept.signedCleanupConfirmed).toBe(true);
    expect(kept.recovery?.dismissed).toBe(true);
    expect(kept.photo).toBe(photo);
    expect(kept.requestId).toBe(job.requestId);
    expect(kept.photoVerified).not.toBe(true);
    expect(localClose).not.toHaveBeenCalled();
    expect(net.stages.every(stage => ['status', 'receipt-status'].includes(stage))).toBe(true);
});

it('control៖ server ទទួល UUID ដើមដោយឯករាជ្យពី client request builder', async () => {
    const net = serverNetwork({ addIdControl: true });
    await actOnQueuedSign(id, 'recover');
    expect(net.responses.find(response => response.stage === 'status')?.status).toBe(200);
    expect(net.upstreamReads()).toBe(1);
    expect((await keptJob()).recoveryCheck?.signedStatusVerified).toBe(true);
});

it.each(['unsigned', 'wrong-barcode', 'cached', 'returned', 'failure'] as const)('control៖ status %s មិនលាក់ការងារ ឬលុបរូប', async kind => {
    const net = serverNetwork({ kind, addIdControl: true });
    await actOnQueuedSign(id, 'recover');
    const kept = await keptJob();
    expect(net.statusBodies).toHaveLength(1);
    expect(kept.recoveryCheck?.signedStatusVerified).toBe(false);
    expect(kept.signedCleanupConfirmed).not.toBe(true);
    expect(kept.recovery?.dismissed).not.toBe(true);
    expect(kept.photo).toBe(photo);
    expect(kept.requestId).toBe(job.requestId);
    expect(localClose).not.toHaveBeenCalled();
    if (kind === 'unsigned') expect(kept.recoveryCheck).toMatchObject({ signed: false, statusUnavailable: false });
    else expect(kept.recoveryCheck?.statusUnavailable).toBe(true);
});

it('control៖ Sign status ពិតគ្មាន trusted server clock មិនកំណត់ពេលលុបរូប', async () => {
    firebaseState.serverClockTrusted = false;
    const net = serverNetwork({ addIdControl: true });
    await actOnQueuedSign(id, 'recover');
    const kept = await keptJob();
    expect(net.upstreamReads()).toBe(1);
    expect(kept.signedCleanupConfirmed).toBe(true);
    expect(kept.signedVerifiedAt).toBeUndefined();
    expect(kept.signedCleanupAt).toBeUndefined();
    expect(kept.photo).toBe(photo);
});

it.each(['cookie', 'locked'] as const)('control៖ context %s មិនផ្ញើ status របស់ការងារ Palm', async mode => {
    if (mode === 'locked') securityState.appIsLocked = true;
    else {
        const cfg = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
        cfg.url = cfg.url.replace('palm=1&', '');
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
    }
    const net = serverNetwork();
    await actOnQueuedSign(id, 'recover');
    await runPalmSignOutbox();
    expect(net.stages).toEqual([]);
    expect((await keptJob()).photo).toBe(photo);
});
