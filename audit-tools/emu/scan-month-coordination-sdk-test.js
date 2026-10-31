'use strict';
let failed = 0;const offOrigin=[];let commitGate=null;let collectedWrites=0;
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), assert = require('assert/strict');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(process.env.SCANSDK_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const deps = path.join(ROOT, 'ZoeW/node_modules');
const port = Number(process.env.SCANRULES_EMU_PORT || 9000);
const websocket = require(require.resolve('faye-websocket', { paths: [deps] }));
const originalClient = websocket.Client;
const localSocketOptions = (url, options) => {
    const target = new URL(url);
    if (target.protocol !== 'ws:' || target.hostname !== '127.0.0.1' || Number(target.port) !== port) return options;
    const local = { ...options }; delete local.proxy; return local;
};
const originalOptions = { proxy: { origin: 'http://fixture-proxy.invalid' }, headers: { test: 'kept' } };
assert.deepEqual(localSocketOptions('ws://127.0.0.1:' + port, originalOptions), { headers: originalOptions.headers });
assert.ok(originalOptions.proxy);
for (const url of ['ws://example.invalid:' + port, 'ws://127.0.0.1:' + (port + 1), 'wss://127.0.0.1:' + port]) {
    assert.equal(localSocketOptions(url, originalOptions), originalOptions);
}
websocket.Client = function(url,protocols,options) {
    const target=new URL(url);
    if(target.protocol!=='ws:'||target.hostname!=='127.0.0.1'||Number(target.port)!==port) { offOrigin.push(target.origin); throw new Error('Fixture blocked off-origin websocket'); }
    return new originalClient(url,protocols,localSocketOptions(url,options));
};
const { buildSync } = require(path.join(deps, 'esbuild'));
const { initializeApp, deleteApp, getApps } = require(path.join(deps, 'firebase/app'));
const database = require(path.join(deps, 'firebase/database'));
const { createMockUserToken } = require(path.join(deps, '@firebase/util'));
const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', R = 'zoew_barcode_registry';
const day = '2026-10-30', month = '2026-10', stamp = Date.UTC(2026, 9, 30, 2), uid = 'scan-owner';
const copy = value => JSON.parse(JSON.stringify(value));
const apps=[];
const modes=process.argv.slice(2);
if(!modes.length){
    const {spawnSync}=require('child_process');
    for(const mode of ['--open','--mixed','--pickup-cleanup']){
        const run=spawnSync(process.execPath,[__filename,mode],{env:process.env,stdio:'inherit',timeout:90000});
        if(run.error || run.signal || run.status !== 0){
            failed++;
            console.error('scan-month-coordination-sdk child failed', mode, run.error || run.signal || run.status);
            break;
        }
    }
    process.exit(failed ? 1 : 0);
}
assert.ok(modes.length===1&&['--open','--mixed','--pickup-cleanup'].includes(modes[0]));
setTimeout(() => { console.error('fixture global timeout'); process.exit(124); }, 120000).unref();
function localRequest(url, init = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || Number(parsed.port) !== port) {offOrigin.push(parsed.origin);throw new Error('Fixture blocked off-origin request');}
    return new Promise((resolve, reject) => {
        const request = http.request(parsed, { method: init.method || 'GET', headers: init.headers || {}, timeout: 15000 }, response => {
            let body = ''; response.on('data', part => { body += part; });
            response.on('end', () => resolve(new Response(body, { status: response.statusCode, headers: response.headers })));
        });
        request.on('timeout', () => request.destroy(new Error('fixture local request timed out')));
        request.on('error', reject); if (init.body) request.write(init.body); request.end();
    });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const bounded = (promise, label) => Promise.race([promise, pause(60000).then(() => { throw new Error('probe timed out: ' + label); })]);

(async () => {
    const { Window } = await import(pathToFileURL(path.join(deps, 'happy-dom/lib/index.js')).href);
    const window = new Window({ url: 'https://scan-probe.invalid' });
    for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLVideoElement',
        'HTMLCanvasElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'MutationObserver', 'CustomEvent', 'FileReader', 'Image', 'Node', 'Element', 'Event']) {
        Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    globalThis.confirm = () => true;
    Object.defineProperty(globalThis, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    const built = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-scan-sdk-')), 'source.cjs');
    buildSync({ absWorkingDir: ROOT, stdin: { contents: `export { addOrUpdateEntry } from './ZoeW/src/features/scan-action';
export { resumePendingScanOperations } from './ZoeW/src/services/scan-operation';
export { createScanEvidenceJournal } from './ZoeW/src/services/scan-evidence';
export { pendingScanScope } from './ZoeW/src/services/scan-pending';
export { withTransactionOutcomeResolution, txResolvingPaths } from './ZoeW/src/services/tx-outcome';
export { initDatabaseListeners, anyDbListenerViewIsStale } from './ZoeW/src/services/db-listeners';
export { dbListenerPendingPaths, dbListenerFailedPaths } from './ZoeW/src/core/text';
export { runScheduledCleanup, runAutomaticCleanupRules, cleanupInFlight, readCleanupJournal } from './ZoeW/src/domain/cleanup';
export { syncZtoFinalMarks } from './ZoeW/src/features/zto-final-marks';
export { readPickupJournal } from './ZoeW/src/domain/pickup';
export { importZtoListRows, ZTO_LIST_IMPORT_CONCURRENCY } from './ZoeW/src/features/zto-list-sync';
export { ztoState, firebaseState, dataState, uiState } from './ZoeW/src/core/state';`, resolveDir: ROOT },
        bundle: true, platform: 'node', format: 'cjs', outfile: built, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    const api = require(built);assert.equal(api.ZTO_LIST_IMPORT_CONCURRENCY,4);
    globalThis.ZoeErrors = window.ZoeErrors = { capture: (error, context) => console.log('fixture captured', error?.message, context?.context) };
    let blockReads = false;
    globalThis.fetch = (url, init) => blockReads ? Promise.reject(new TypeError('fixture read lost')) : localRequest(String(url), init);

    const ns = 'demo-parallel-' + process.pid;
    const endpoint = 'http://127.0.0.1:' + port + '/?ns=' + ns;
    const owner=async(location='',method='GET',body)=>{const r=await localRequest('http://127.0.0.1:'+port+'/'+location+'.json?ns='+ns,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
    await owner('.settings/rules','PUT',JSON.parse(fs.readFileSync(path.join(ROOT,'firebase-database.rules.json'),'utf8')));
    await owner('','PUT',{});
    localStorage.clear();localStorage.setItem('zoew_firebase_config',JSON.stringify({databaseURL:endpoint}));
    const app=initializeApp({projectId:'demo-scan-sdk',databaseURL:endpoint},ns);apps.push(app);const db=database.getDatabase(app);database.connectDatabaseEmulator(db,'127.0.0.1',port,{mockUserToken:{sub:uid,user_id:uid}});
    const token=createMockUserToken({sub:uid,user_id:uid},'demo-scan-sdk');const auth={app,currentUser:{uid,getIdToken:async()=>token}};
    const errors=[];const raw={...database,getAuth:()=>auth,getDatabase:()=>db,deleteApp,
      update:async(ref,patch)=>{try{if(String(ref).includes('/zoew_daily_collected_cod_dod')||Object.keys(patch).some(key=>key.startsWith('zoew_daily_collected_cod_dod/')))collectedWrites++;const result=await database.update(ref,patch);if(commitGate&&!commitGate.held&&Object.values(patch).some(value=>value&&value.phase==='committed')){commitGate.held=true;await new Promise(resolve=>commitGate.resolve({deliver:resolve}));}return result;}catch(e){errors.push({kind:'update',paths:Object.keys(patch),error:String(e)});throw e;}},
      runTransaction:async(ref,fn,options)=>{try{if(String(ref).includes('/zoew_daily_collected_cod_dod'))collectedWrites++;return await database.runTransaction(ref,fn,options);}catch(e){errors.push({kind:'transaction',path:String(ref),error:String(e)});throw e;}}
    };
    const sdk=api.withTransactionOutcomeResolution(raw);sdk.getAuth(app);sdk.getDatabase(app);Object.assign(api.firebaseState,{fb:sdk,db,auth,firebaseConfig:app.options,isDatabaseInitialized:true,isInitializingFirebase:false,firebaseSdkUnavailable:false,isDatabaseConnected:true,sessionExpiryCheck:'live',authLoginOperation:null});
    api.dataState.scanHistory=[];api.dataState.deletedItems=[];api.dataState.dailyRevenueData={};api.dataState.monthlyRevenueData={};api.dataState.dailyPickupData={};api.dataState.dailyCollectedData={};
    for(const [key,root] of [['dbRefHistory',H],['dbRefDeleted','zoew_recently_deleted_cod_dod'],['dbRefDailyRevenue',D],['dbRefMonthlyRevenue',M],['dbRefRegistry',R],['dbRefDailyPickup','zoew_daily_pickup_cod_dod'],['dbRefDailyCollected','zoew_daily_collected_cod_dod']])api.firebaseState[key]=sdk.ref(db,root);
    api.firebaseState.dbLivenessProbe=Promise.resolve(null);
    localStorage.setItem('zoew_lookup_api_config',JSON.stringify({enabled:true,fastMode:true,url:'http://127.0.0.1:'+port+'/.netlify/functions/zto-order-detail?barcode={barcode}'}));
    if(modes[0]==='--pickup-cleanup'){
        const now=Date.now(), code='SYNTHETIC_CLEANUP';
        const localTime=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(ms));
        const arrival=localTime(now-4*3600000), signed=localTime(now-3*3600000);
        localStorage.setItem('zoew_lookup_api_config',JSON.stringify({enabled:true,fastMode:true,url:'http://127.0.0.1:'+port+'/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}'}));
        localStorage.setItem('zoew_zto_pickup_status_v1',JSON.stringify({[code]:{closed:true,at:now-60000,signedAt:now-3*3600000,signedAtExact:true}}));
        const row={barcode:code,phone:'0910000000',cod:0.1,dod:0.5,at:arrival,ztoClosed:true,skip:'',from:'cn'};
        api.ztoState.ztoListSyncResult={palm:true,verifiedAt:now,verifiedServerAt:now,rows:[row],signedRows:[{...row,at:signed}],from:arrival.slice(0,10),to:localTime(now).slice(0,10),total:1};
        api.firebaseState.serverClockTrusted=true;
        api.initDatabaseListeners();
        await bounded((async()=>{while(api.anyDbListenerViewIsStale(['history','deleted']))await pause(10);})(),'cleanup-history-ready');
        const held=new Promise(resolve=>commitGate={held:false,resolve});
        const importing=bounded(api.importZtoListRows(),'cleanup-import');
        const ack=await bounded(held,'cleanup-final-ack');
        const before=await owner();
        assert.equal(Object.values(before.zoew_scan_operations||{}).filter(operation=>operation.phase==='committed').length,1);
        assert.equal(collectedWrites,0);
        await api.syncZtoFinalMarks();api.runAutomaticCleanupRules();
        await bounded((async()=>{while(api.cleanupInFlight.size)await pause(10);})(),'cleanup-held-pass');
        const during=await owner();
        assert.equal(Object.keys(during[H]||{}).length,1);
        assert.equal(Object.keys(during.zoew_recently_deleted_cod_dod||{}).length,0);
        assert.equal(collectedWrites,0);
        ack.deliver();commitGate=null;await importing;
        api.runScheduledCleanup();
        await bounded((async()=>{while(api.cleanupInFlight.size)await pause(10);})(),'cleanup-after-collected');
        const after=await owner();
        assert.equal(Object.keys(after[H]||{}).length,0);
        const trash=Object.values(after.zoew_recently_deleted_cod_dod||{});
        assert.equal(trash.length,1);assert.equal(trash[0].trashReason,'pickup');
        const collected=Object.values(after.zoew_daily_collected_cod_dod||{}).flatMap(bucket=>Object.values(bucket));
        assert.deepEqual(collected,[{c:0.1,d:0.5}]);
        assert.equal(after[D][arrival.slice(0,10)].totalCount,1);
        assert.equal(after[D][arrival.slice(0,10)].codDollar,0.1);
        assert.equal(after[D][arrival.slice(0,10)].dodDollar,0.5);
        assert.equal(after[M][arrival.slice(0,7)].totalCount,1);
        assert.equal(after[M][arrival.slice(0,7)].codDollar,0.1);
        assert.equal(after[M][arrival.slice(0,7)].dodDollar,0.5);
        assert.ok(Object.values(after.zoew_daily_pickup_cod_dod||{}).every(bucket=>bucket.packagesPickedUp===0));
        assert.equal(api.readCleanupJournal().length,0);assert.equal(api.readPickupJournal().length,0);
        assert.equal(api.createScanEvidenceJournal(localStorage,2).list(api.pendingScanScope()).length,0);
        const writes=collectedWrites;api.runScheduledCleanup();
        await bounded((async()=>{while(api.cleanupInFlight.size)await pause(10);})(),'cleanup-repeat');
        assert.equal(collectedWrites,writes);assert.equal(errors.length,0);assert.equal(offOrigin.length,0);
        console.log('PASS scan-month-coordination-sdk --pickup-cleanup authoritative mirror gate, no cleanup money writes');
        await sdk.deleteApp(app);await window.happyDOM.close();return;
    }
    const rows=Array.from({length:100},(_,index)=>({barcode:'SYNTHETIC'+index,phone:'09'+String(10000000+index%8),cod:[0.1,0.2,1.35,4.99,0,10][index%6],dod:0,at:'2026-10-30 09:00:00',ztoClosed:modes[0]==='--mixed'&&index%2===0,skip:'',from:'cn'}));
    api.ztoState.ztoListSyncResult={verifiedAt:Date.now(),verifiedServerAt:Date.now(),rows,signedRows:[],from:'2026-10-25',to:'2026-10-31',total:rows.length};
    api.initDatabaseListeners();
    await bounded((async()=>{while(api.anyDbListenerViewIsStale(['history','deleted']))await pause(10);})(),'history-trash-ready');
    console.log('PRODUCTION_ADMISSION',JSON.stringify({pending:[...api.dbListenerPendingPaths],failed:[...api.dbListenerFailedPaths],importGuard:api.anyDbListenerViewIsStale(['history','deleted'])}));
    const outcomes=[];const start=Date.now();await bounded(api.importZtoListRows(),'actual100ZTOimport');
    const after=await owner();const summary={offOrigin,roots:after,ms:Date.now()-start,outcomes,errors,daily:after[D],monthly:after[M],pending:api.createScanEvidenceJournal(localStorage,2).list(api.pendingScanScope()),operations:Object.values(after.zoew_scan_operations||{}).map(o=>({id:o.id,code:o.code,phase:o.phase,monthToken:o.monthToken,targetId:o.targetId})),history:after[H]};
    if(summary.pending.length) console.error('SCAN_PENDING_DIAGNOSTIC',JSON.stringify(summary.pending.map(record=>({
        id:record.id,code:record.barcode,phase:record.phase,itemId:record.itemId,
        operation:summary.operations.find(operation=>operation.id===record.id),
        holders:Object.values(after[H]||{}).filter(row=>Object.values(row.barcodes||{}).some(barcode=>barcode.code===record.barcode)).map(row=>({
            id:row.id,scanDate:row.scanDate,scanPending:row.scanPending,pricePending:row.pricePending,clearClaim:row.clearClaim,
            restoredAt:row.restoredAt,barcodes:Object.values(row.barcodes||{}).map(barcode=>({code:barcode.code,scanIntent:barcode.scanIntent,
                createdAt:barcode.createdAt,closedAt:barcode.closedAt,isClosed:barcode.isClosed,cod:barcode.cod,dod:barcode.dod,
                restoredAt:barcode.restoredAt,trashClaim:barcode.trashClaim,trashClaimAt:barcode.trashClaimAt,ztoSignedAt:barcode.ztoSignedAt}))
        })),registry:after[R]?.[record.barcode],collected:Object.fromEntries(Object.entries(after.zoew_daily_collected_cod_dod||{}).filter(([,bucket])=>bucket[record.barcode]).map(([date,bucket])=>[date,bucket[record.barcode]]))
    }))));
    assert.equal(offOrigin.length,0);assert.equal(summary.pending.length,0);assert.equal(errors.length,0);
    assert.equal(summary.operations.length,100);assert.ok(summary.operations.every(operation=>operation.phase==='committed'));
    assert.equal(after[D][day].totalCount,100);assert.equal(after[M][month].totalCount,100);
    assert.ok(Math.abs(after[D][day].codDollar-272.88)<1e-9);assert.ok(Math.abs(after[M][month].codDollar-272.88)<1e-9);
    const barcodes=Object.values(after[H]).flatMap(row=>Object.values(row.barcodes||{}));
    assert.equal(barcodes.length,100);assert.equal(new Set(barcodes.map(barcode=>barcode.code)).size,100);
    assert.equal(barcodes.filter(barcode=>barcode.isClosed).length,modes[0]==='--mixed'?50:0);
    assert.equal(Object.keys(after[R]).length,100);
    const collected=Object.values(after.zoew_daily_collected_cod_dod||{}).flatMap(bucket=>Object.values(bucket));
    assert.equal(collected.length,modes[0]==='--mixed'?50:0);
    assert.ok(Math.abs(collected.reduce((total,row)=>total+row.c,0)-(modes[0]==='--mixed'?24.65:0))<1e-9);
    assert.ok(Object.values(after.zoew_daily_pickup_cod_dod||{}).every(bucket=>bucket.packagesPickedUp===0));
    console.log('PASS scan-month-coordination-sdk '+modes[0]+' 100 committed, zero pending, conserved money/count');
    await sdk.deleteApp(app);await window.happyDOM.close();
})().catch(async error=>{failed++;console.error(error.stack||error);for(const app of apps)await deleteApp(app).catch(()=>{});}).finally(()=>process.exit(failed?1:0));
