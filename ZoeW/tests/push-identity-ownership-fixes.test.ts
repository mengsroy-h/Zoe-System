import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { enablePush, ensureNativePushListeners, resyncPush, togglePush, watchPushIdentity, PUSH_STATE_KEY, pushRuntime } from '../src/features/push';
const nativePush = vi.hoisted(() => ({ listeners: {} as Record<string, (value: any) => void>, addListener: vi.fn(async (name, fn) => { nativePush.listeners[name] = fn; return { remove: async () => {} }; }) }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: nativePush }));
vi.mock('../src/core/action-registry', () => ({ ACTION_REGISTRY: {}, ACTION_NAMES: [], lookupAction: () => null }));
vi.mock('../src/features/license', async () => {
 const { firebaseState } = await import('../src/core/state');
 return { LICENSE_APP_CODE: 'zoew', proceedAfterLogin: vi.fn(() => { firebaseState.authButtonIsLoggedIn = true; }) };
});
vi.mock('../src/services/db-listeners', () => ({ dbListenerViewIsStale: () => false, detachDatabaseListeners: vi.fn(), resetDbListenerHealthState: vi.fn(), updateRecentPhonesList: vi.fn() }));
vi.mock('../src/features/customer-table', () => ({ clearCustomerDataTableCache: vi.fn() }));
vi.mock('../src/features/clear-history', () => ({ resetClearHistoryOperationState: vi.fn() }));
vi.mock('../src/features/monthly-report', () => ({ applyCurrentFilter: vi.fn() }));
vi.mock('../src/features/trash', () => ({ renderRecentlyDeleted: vi.fn() }));
vi.mock('../src/features/auto-lookup', () => ({ cancelPendingLookupUnlock: vi.fn(), clearLookupStatus: vi.fn() }));
vi.mock('../src/features/phone-suggest', () => ({ hidePhoneSuggestions: vi.fn() }));
vi.mock('../src/features/locker', () => ({ expandedTrashGroups: new Set() }));
vi.mock('../src/services/scan-engine', () => ({ resetScanConfirm: vi.fn() }));
vi.mock('../src/features/batch-scan', () => ({ SCAN_FLOW_MODALS: [], resetBatchScan: vi.fn() }));
vi.mock('../src/features/config', () => ({ isPinFlowPending: () => false, checkPinAndOpenConfig: vi.fn() }));
vi.mock('../src/features/config-qr', () => ({ closeConfigQrScanner: vi.fn() }));
vi.mock('../src/features/zto-palm-login', () => ({ resetZtoPalmRefresh: vi.fn(), cancelZtoPalmLogin: vi.fn() }));
vi.mock('../src/features/zto-list-sync', () => ({ ztoListSignedProbe: new Map() }));
vi.mock('../src/features/zto-final-marks', () => ({ resetZtoFinalMarks: vi.fn() }));
vi.mock('../src/features/zto-palm-sign', () => ({ cancelZtoPalmSign: vi.fn() }));
vi.mock('../src/features/zto-status', () => ({ clearZtoPickupStatusStore: vi.fn() }));
vi.mock('../src/features/export', () => ({ restoreAfterPdfExport: vi.fn() }));
vi.mock('../src/features/label-print', () => ({ resetLabelPrint: vi.fn() }));
vi.mock('../src/features/sheet-import', () => ({ clearSheetImportSession: vi.fn() }));
vi.mock('../src/features/health-check', () => ({ resetHealthCheck: vi.fn() }));
vi.mock('../src/features/password-memory', () => ({ forgetLoginPassword: vi.fn(), prefillRememberedPassword: vi.fn(), rememberLoginPassword: vi.fn(), rememberPasswordPrefIsOff: () => true, setRememberPasswordPref: vi.fn() }));

import { setupAuthListener } from '../src/features/auth';
import { showLoginModalWithPrefill } from '../src/features/session';
const BASE = 'https://audit.supabase.co';
const turn = async () => { for (let i=0;i<50;i++) await Promise.resolve(); };
const deferred = <T>() => { let resolve!: (v:T)=>void; const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}; };
function shop(tenant:string, token:()=>Promise<string> = async()=> 'token-'+tenant) {
 firebaseState.authGeneration++;
 firebaseState.auth={currentUser:{uid:tenant,getIdToken:token},_account:{tenant_id:tenant}} as any;
 firebaseState.db={shop:tenant} as any;
}
beforeEach(()=> {
 appLocalStore.clear();
 appLocalStore.setItem('zoew_firebase_config',JSON.stringify({supabaseUrl:BASE}));
 firebaseState.fb={tenantScope:(a:any)=>a?._account?.tenant_id||''} as any;
 firebaseState.isInitializingFirebase=false;firebaseState.isDatabaseInitialized=false;
 viewState.backendKind='supabase';dataState.scanHistory=[];
 delete (window as any).Capacitor;Object.keys(nativePush.listeners).forEach(k=>delete nativePush.listeners[k]);
 Object.assign(pushRuntime,{nativeListeners:false,scheduleInFlight:false,scheduleAttemptAt:0,nativeEnabling:false,nativeWanted:false,webKeyChecked:false});uiState.pushStatus='off';
 const N:any=function(){};N.permission='granted';N.requestPermission=()=>Promise.resolve('granted');
 vi.stubGlobal('Notification',N);vi.stubGlobal('PushManager',function(){});
 const sub={endpoint:'https://push.example.invalid/device',toJSON:()=>({endpoint:'https://push.example.invalid/device',keys:{p256dh:'p',auth:'a'}})};
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>sub}})}});
});
afterEach(()=>{delete (window as any).Capacitor;pushRuntime.nativeWatchdogSeq++;vi.unstubAllGlobals();delete(navigator as any).serviceWorker;});
it('F06 control៖ ម្ចាស់បច្ចុប្បន្ន subscribe បាន',async()=>{
 shop('a');const posts:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{
 if(String(url).includes('op=config')) return new Response(JSON.stringify({web:true,vapidPublicKey:'AQID'}));
 posts.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true}));
 }));
 expect(await enablePush()).toBe(true);expect(posts[0].supabase).toBe('token-a');
});
it('F06៖ token A មកក្រោយផ្លាស់ B មិនអាច subscribe',async()=>{
 const gate=deferred<string>();const token=vi.fn(()=>gate.promise);shop('a',token);
 const posts:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{
 if(String(url).includes('op=config')) return new Response(JSON.stringify({web:true,vapidPublicKey:'AQID'}));
 posts.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true}));
 }));
 const work=enablePush();await turn();expect(token).toHaveBeenCalledOnce();
 shop('b');uiState.pushStatus='off';
 gate.resolve('token-a');await work;
 expect(String(JSON.parse(appLocalStore.getItem(PUSH_STATE_KEY)||'{}').shop || '')).not.toContain('#a');
 expect(posts).toEqual([]);
 expect(uiState.pushStatus).toBe('off');
});

it('F06៖ SDK/transport ពិតមិនយក credential ចាស់ក្រោយរកឃើញ signout',async()=>{
 const {createSupabaseSdk}=await import('../src/services/supabase-sdk');
 const {createSupabaseTransport,SB_AUTH_STORAGE_KEY,SB_ACCOUNT_STORAGE_KEY}=await import('../src/services/supabase-transport');
 vi.stubGlobal('BroadcastChannel',undefined);
 const tokenA='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({iss:BASE+'/auth/v1',sub:'user-a',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}))+'.signature';
 appLocalStore.setItem(SB_AUTH_STORAGE_KEY,JSON.stringify({access_token:tokenA,refresh_token:'synthetic-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user:{id:'user-a',email:'a@users.zoew.invalid',aud:'authenticated'}}));
 const account={tenant_id:'a',status:'active',username:'a',role:'member'};
 appLocalStore.setItem(SB_ACCOUNT_STORAGE_KEY,JSON.stringify({uid:'user-a',row:account}));
 const noStore={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
 const sdk=createSupabaseSdk((cfg:any)=>createSupabaseTransport(cfg,{localStorage:appLocalStore,sessionStorage:noStore,eventTarget:new EventTarget(),fetch:async()=>new Response(JSON.stringify([account]))}),{onListenerError:()=>{},onAccountBlocked:()=>{},onSessionEnded:()=>{},docsCache:null});
 const app=sdk.initializeApp({supabaseUrl:BASE,supabaseKey:'sb_publishable_synthetic'});
 const auth=sdk.getAuth(app);firebaseState.auth=auth;firebaseState.fb=sdk;firebaseState.db={} as any;
 sdk.onAuthStateChanged(auth,()=>{firebaseState.authGeneration++;});
 try {
  await vi.waitFor(()=>expect(auth.currentUser?.uid).toBe('user-a'));
  await vi.waitFor(()=>expect(auth._account?.tenant_id).toBe('a'));
  const originalUser=auth.currentUser;expect(await originalUser.getIdToken()).toBe(tokenA);
  appLocalStore.removeItem(SB_AUTH_STORAGE_KEY);appLocalStore.removeItem(SB_ACCOUNT_STORAGE_KEY);
  await expect(originalUser.getIdToken()).rejects.toThrow();
  const posts:any[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{
   if(String(url).includes('op=config')) return new Response(JSON.stringify({web:true,vapidPublicKey:'AQID'}));
   posts.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true}));
  }));
  await enablePush();
  
  expect(auth.currentUser).toBeNull();expect(posts).toEqual([]);
 } finally {await sdk.deleteApp(app);}
});

it.each(['config','subscription','post'])('F06៖ owner ផ្លាស់នៅ await %s មិនអាចសរសេរ push state របស់ B',async stage=>{
 const gate=deferred<any>();shop('a');const posts:any[]=[];
 const sub={endpoint:'https://push.example.invalid/device',toJSON:()=>({endpoint:'https://push.example.invalid/device',keys:{p256dh:'p',auth:'a'}})};
 let entered=false;
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>{if(stage==='subscription'){entered=true;return gate.promise;}return sub;}}})}});
 vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{
  if(String(url).includes('op=config')){if(stage==='config'){entered=true;return gate.promise;}return new Response(JSON.stringify({web:true,vapidPublicKey:'AQID'}));}
  posts.push(JSON.parse(opts.body));if(stage==='post'){entered=true;return gate.promise;}return new Response(JSON.stringify({ok:true}));
 }));
 const work=enablePush();await vi.waitFor(()=>expect(entered).toBe(true));shop('b');uiState.pushStatus='off';
 appLocalStore.setItem(PUSH_STATE_KEY,JSON.stringify({on:false,shop:BASE+'#b',kind:'',token:'',syncedAt:0}));
 const saved=appLocalStore.getItem(PUSH_STATE_KEY);
 gate.resolve(stage==='subscription'?sub:new Response(JSON.stringify(stage==='config'?{web:true,vapidPublicKey:'AQID'}:{ok:true})));
 expect(await work).toBe(false);expect(posts).toHaveLength(stage==='post'?1:0);expect(uiState.pushStatus).toBe('off');expect(appLocalStore.getItem(PUSH_STATE_KEY)).toBe(saved);
});

it('F06៖ permission រង់ចាំមិនអាចបន្តក្រោយ owner ផ្លាស់',async()=>{
 const permission=deferred<string>();shop('a');const notification:any=function(){};notification.permission='granted';notification.requestPermission=vi.fn(()=>permission.promise);vi.stubGlobal('Notification',notification);
 const fetch=vi.fn(async()=>new Response('{}'));vi.stubGlobal('fetch',fetch);
 const work=enablePush();expect(notification.requestPermission).toHaveBeenCalledOnce();shop('b');uiState.pushStatus='off';permission.resolve('granted');
 expect(await work).toBe(false);expect(fetch).not.toHaveBeenCalled();expect(uiState.pushStatus).toBe('off');
});
it('F06៖ native token A រង់ចាំ credential មិនអាច subscribe ក្រោយផ្លាស់ B',async()=>{
 const gate=deferred<string>(),token=vi.fn(()=>gate.promise);shop('a',token);(window as any).Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android'};pushRuntime.nativeWanted=true;
 const posts:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url:any,opts:any)=>{posts.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true}));}));
 await ensureNativePushListeners();nativePush.listeners.registration({value:'synthetic-fcm-token'});await vi.waitFor(()=>expect(token).toHaveBeenCalledOnce());
 shop('b');uiState.pushStatus='off';appLocalStore.setItem(PUSH_STATE_KEY,JSON.stringify({on:false,shop:BASE+'#b'}));const saved=appLocalStore.getItem(PUSH_STATE_KEY);gate.resolve('token-a');await turn();
 expect(posts).toEqual([]);expect(appLocalStore.getItem(PUSH_STATE_KEY)).toBe(saved);expect(uiState.pushStatus).toBe('off');
});
it('F06៖ web resync មិនផ្ញើ credential ឬរក្សាលទ្ធផលរបស់ owner ចាស់',async()=>{
 const gate=deferred<string>(),token=vi.fn(()=>gate.promise);shop('a',token);appLocalStore.setItem(PUSH_STATE_KEY,JSON.stringify({on:true,shop:BASE+'#a',syncedAt:1}));
 const posts:any[]=[];vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{if(String(url).includes('op=config'))return new Response(JSON.stringify({web:true,vapidPublicKey:'AQID'}));posts.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true}));}));
 const work=resyncPush();await vi.waitFor(()=>expect(token).toHaveBeenCalledOnce());shop('b');uiState.pushStatus='off';appLocalStore.setItem(PUSH_STATE_KEY,JSON.stringify({on:false,shop:BASE+'#b'}));const saved=appLocalStore.getItem(PUSH_STATE_KEY);gate.resolve('token-a');
 expect(await work).toBe(false);expect(posts).toEqual([]);expect(appLocalStore.getItem(PUSH_STATE_KEY)).toBe(saved);expect(uiState.pushStatus).toBe('off');
});


it.each(['complete-new', 'old-finishes-first'])('F06 integration៖ actual auth callbacks ដោះ push busy ហើយ old owner មិនប៉ះ new busy (%s)', async order => {
 const oldToken=deferred<string>(),newToken=deferred<string>();shop('a',()=>oldToken.promise);
 const auth=firebaseState.auth;let callback!:(user:any)=>void;
 firebaseState.authButtonIsLoggedIn=false;
 firebaseState.fb.onAuthStateChanged=(_auth:any,onUser:any)=>{callback=onUser;return()=>{};};
 const stop=watchPushIdentity();const posts:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{if(String(url).includes('op=config'))return Response.json({web:true,vapidPublicKey:'AQID'});posts.push(JSON.parse(opts.body));return Response.json({ok:true});}));
 try {
  setupAuthListener();callback(auth.currentUser);await turn();
  const oldWork=enablePush();await turn();expect(uiState.pushStatus).toBe('busy');
  auth.currentUser=null;callback(null);await turn();
  auth._account={tenant_id:'b'};auth.currentUser={uid:'b',getIdToken:()=>newToken.promise};callback(auth.currentUser);await turn();
  expect(uiState.pushStatus).not.toBe('busy');
  const newWork=togglePush();await turn();expect(uiState.pushStatus).toBe('busy');
  if(order==='old-finishes-first'){
   oldToken.resolve('token-a');expect(await oldWork).toBe(false);expect(uiState.pushStatus).toBe('busy');expect(posts).toEqual([]);
  }
  newToken.resolve('token-b');expect(await newWork).toBe(true);expect(uiState.pushStatus).toBe('on');
  if(order==='complete-new'){oldToken.resolve('token-a');expect(await oldWork).toBe(false);expect(uiState.pushStatus).toBe('on');}
  expect(posts).toHaveLength(1);expect(posts[0].supabase).toBe('token-b');
 }finally{stop();firebaseState.authUnsubscribe?.();firebaseState.authUnsubscribe=null;oldToken.resolve('token-a');newToken.resolve('token-b');await turn();}
});
it('F06 integration control៖ login UI reset ដដែល invalidates old owner មិនដោះ busy របស់សំណើថ្មី',async()=>{
 const oldToken=deferred<string>(),newToken=deferred<string>();const getToken=vi.fn().mockReturnValueOnce(oldToken.promise).mockReturnValueOnce(newToken.promise);shop('a',getToken);
 const posts:any[]=[];vi.stubGlobal('fetch',vi.fn(async(url:any,opts:any)=>{if(String(url).includes('op=config'))return Response.json({web:true,vapidPublicKey:'AQID'});posts.push(JSON.parse(opts.body));return Response.json({ok:true});}));
 const oldWork=enablePush();await vi.waitFor(()=>expect(getToken).toHaveBeenCalledTimes(1));showLoginModalWithPrefill();
 expect(uiState.pushStatus).not.toBe('busy');const newWork=togglePush();await vi.waitFor(()=>expect(getToken).toHaveBeenCalledTimes(2));
 oldToken.resolve('token-a');expect(await oldWork).toBe(false);expect(uiState.pushStatus).toBe('busy');expect(posts).toEqual([]);
 newToken.resolve('token-a');expect(await newWork).toBe(true);expect(posts).toHaveLength(1);expect(uiState.pushStatus).toBe('on');
});

function metadataJwt(hoursAgo: number, extra: Record<string, unknown> = {}) {
 const now=Math.floor(Date.now()/1000), authTime=now-hoursAgo*3600;
 const encode=(value:any)=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 return { token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:'metadata-a',iat:authTime,exp:now-3600,amr:[{method:'password',timestamp:authTime}],...extra})+'.synthetic',authTime };
}
async function metadataSdk(readToken:()=>Promise<string|null>,cached=metadataJwt(5).token){
 const {createSupabaseSdk,SB_SESSION_ENDED_TEXT}=await import('../src/services/supabase-sdk');
 let emit=(_event:string,_session:any)=>{};
 let session={accessToken:cached,user:{id:'metadata-a',email:'a@users.zoew.invalid'}};
 const row={tenant_id:'metadata-shop',status:'active',username:'metadata-user',role:'member'};
 const transport={url:BASE,restoreSession:async()=>session,accessToken:vi.fn(readToken),onSession:(callback:any)=>{emit=callback;return()=>{};},onForeignSession:()=>()=>{},
  signOut:async()=>{emit('SIGNED_OUT',null);},signIn:async()=>{session={accessToken:metadataJwt(1,{sub:'metadata-b'}).token,user:{id:'metadata-b',email:'b@users.zoew.invalid'}};return session;},
  setPersistence:()=>{},rpc:async()=>[row],readAccount:()=>({uid:session.user.id,row}),writeAccount:()=>{},close:vi.fn()};
 const sdk=createSupabaseSdk(()=>transport,{onListenerError:()=>{},onAccountBlocked:()=>{},onSessionEnded:()=>{},onTxOutcomeUnknown:()=>{},docsCache:null});
 const app=sdk.initializeApp({supabaseUrl:BASE,supabaseKey:'sb_publishable_metadata_synthetic'}),auth=sdk.getAuth(app);
 await vi.waitFor(()=>expect(auth.currentUser?.uid).toBe('metadata-a'));
 return {sdk,app,auth,transport,ended:SB_SESSION_ENDED_TEXT};
}
it.each([1,5])('F06 metadata៖ offline %sh អាន authTime ដោយគ្មាន cached bearer និងគោរព TTL ដើម',async hours=>{
 const cached=metadataJwt(hours),f=await metadataSdk(async()=>null,cached.token);
 try{
  await expect(f.auth.currentUser.getIdToken()).rejects.toThrow(f.ended);
  const result=await f.sdk.getIdTokenResult(f.auth.currentUser);
  expect(result.token).toBe('');expect(result.authTime).toBe(new Date(cached.authTime*1000).toISOString());
  firebaseState.fb=f.sdk;firebaseState.auth=f.auth;firebaseState.serverTimeOffsetMs=0;
  const {isFirebaseSessionExpired}=await import('../src/features/session');
  expect(await isFirebaseSessionExpired(f.auth.currentUser)).toBe(hours>4);
  const {ztoIdToken}=await import('../src/features/lookup-api');
  expect(await ztoIdToken()).toBe('');
 }finally{await f.sdk.deleteApp(f.app);}
});
it('F06 metadata control៖ token ថ្មីរក្សារូបរាង result និងមិនប្រើ cached authTime',async()=>{
 const fresh=metadataJwt(1,{exp:Math.floor(Date.now()/1000)+3600}),f=await metadataSdk(async()=>fresh.token);
 try{
  const result=await f.sdk.getIdTokenResult(f.auth.currentUser),claims=JSON.parse(atob(fresh.token.split('.')[1]));
  expect(result).toEqual({token:fresh.token,claims,authTime:new Date(fresh.authTime*1000).toISOString(),issuedAtTime:new Date(claims.iat*1000).toISOString(),expirationTime:new Date(claims.exp*1000).toISOString(),signInProvider:'password',signInSecondFactor:null});
  firebaseState.fb=f.sdk;firebaseState.auth=f.auth;
  const {ztoIdToken}=await import('../src/features/lookup-api');
  expect(await ztoIdToken()).toBe(fresh.token);
 }finally{await f.sdk.deleteApp(f.app);}
});
it('F06 metadata៖ user ដែលបានចាកចេញរួចមិនអាន cached metadata ឬស្នើ token',async()=>{
 const f=await metadataSdk(async()=>null),user=f.auth.currentUser;
 try{await f.sdk.signOut(f.auth);await expect(f.sdk.getIdTokenResult(user)).rejects.toThrow(f.ended);expect(f.transport.accessToken).not.toHaveBeenCalled();}
 finally{await f.sdk.deleteApp(f.app);}
});
it.each(['signout','replacement','close'])('F06 metadata៖ %s ខណៈ token រង់ចាំ មិនអនុញ្ញាត cached fallback',async action=>{
 const token=deferred<string|null>(),f=await metadataSdk(()=>token.promise),user=f.auth.currentUser;
 const work=f.sdk.getIdTokenResult(user),rejected=expect(work).rejects.toThrow(f.ended);
 try{
  await vi.waitFor(()=>expect(f.transport.accessToken).toHaveBeenCalledOnce());
  if(action==='close')await f.sdk.deleteApp(f.app);else{await f.sdk.signOut(f.auth);if(action==='replacement')await f.sdk.signInWithEmailAndPassword(f.auth,'b','synthetic-password');}
  token.resolve(null);await rejected;
  expect(f.auth.currentUser?.uid).toBe(action==='replacement'?'metadata-b':undefined);
 }finally{token.resolve(null);await f.sdk.deleteApp(f.app);}
});
it.each(['malformed','missing-time','invalid-time'])('F06 metadata៖ cached claims %s មិនបង្កើត authTime ថ្មី',async mode=>{
 const cached=mode==='malformed'?'invalid.payload':metadataJwt(5,{iat:mode==='invalid-time'?'bad':undefined,amr:[]}).token;
 const f=await metadataSdk(async()=>null,cached);
 try{await expect(f.sdk.getIdTokenResult(f.auth.currentUser)).rejects.toThrow(f.ended);expect(f.auth.currentUser?.uid).toBe('metadata-a');}
 finally{await f.sdk.deleteApp(f.app);}
});
it('F06 metadata control៖ unexpected token error មិនត្រូវបានបម្លែងជាការស្តារ offline',async()=>{
 const f=await metadataSdk(async()=>{throw new Error('synthetic unexpected fault');});
 try{await expect(f.sdk.getIdTokenResult(f.auth.currentUser)).rejects.toThrow('synthetic unexpected fault');}
 finally{await f.sdk.deleteApp(f.app);}
});
