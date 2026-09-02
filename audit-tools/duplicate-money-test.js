// ថ្នាក់៖ **barcode ស្ទួន ➜ លុយបូកស្ទួន** — ជាន់ការពារចុងក្រោយ។
//
// 🔴 **កំហុសពិត** (វាស់ 2026-09-02, `run-all.sh` បៃតងទាំង ១២២ លើ tree មុនកែ) ៖
//   ប្រព័ន្ធការពារស្ទួនមាន ៥ ជាន់ តែ **៤ ក្នុង ៥ អាន *ច្បាប់ចម្លងក្នុងសតិ
//   របស់ទូរស័ព្ទនេះ*** ៖
//     ១. debounce កូដដដែល ២.៥ វិ.        (សតិ)
//     ២/៣. isBarcodeAlreadyUsed()         (សតិ ៖ scanHistory + deletedItems)
//     ៤. claimBarcodeInRegistry()          (**server** — ជាន់តែមួយគត់ដែលឆ្លងឧបករណ៍)
//     ៥. addOrUpdateEntry() merge          (server តែ **គ្របតែផ្លូវ merge**)
//
// ⛔ **ជាន់ទី ៥ គ្របតែករណីមួយក្នុងបី។** វាបញ្ច្រាសលុយវិញតែពេល
//   `existingIndex !== -1` — គឺពេល merge ចូលកញ្ចប់ **ដែលបើក · លេខទូរស័ព្ទដដែល ·
//   ថ្ងៃដដែល**។ បើលេខទូរស័ព្ទផ្សេង ឬកញ្ចប់ដើមបិទ «យករួច» នោះវាសាង
//   **កញ្ចប់ថ្មី** ➜ barcode ស្ទួន **ហើយលុយបូកម្តងទៀត គ្មានការបញ្ច្រាស**។
//
// ⛔ ដូច្នេះការការពារឆ្លងឧបករណ៍ពឹងលើ **ជាន់ទី ៤ តែម្នាក់ឯង**។ ពេលវាឆ្លើយ
//   `'unknown'` (transaction បដិសេធ · `!db`) នោះ **គ្មានអ្វីសល់** — ហើយកូដ
//   មុនកែ **បន្តរក្សាទុកដូចធម្មតា**។ វាស់បានតាម UI ពិត ៖ ឧបករណ៍ផ្សេងរក្សាទុក
//   `CC7` រួច ➜ listener យើងមិនទាន់ដឹង ➜ registry ដាច់ ➜ **លុយ 120 ➜ 150
//   ហើយ `CC7` មាន ២ ដងក្នុងប្រវត្តិ**។
//
// ច្បាប់៖ ការរក្សាទុកត្រូវទាមទារ **សាលក្រម `'claimed'` ពិតពី server**។
//   «ផ្ទៀងផ្ទាត់មិនបាន» ≠ «គ្មានស្ទួន» — នេះជាច្បាប់ «unverified ➜ កុំផ្តល់
//   សិទ្ធិថ្មី» ដដែលនឹង `license-verify.js` ដែលអនុវត្តលើផ្លូវលុយ។
//   ⛔ វាមិនបំបែកការស្កេនក្រៅបណ្តាញទេ ៖ ក្រៅបណ្តាញ RTDB **ព្យួរ** (មិនបដិសេធ)
//   ➜ `withTimeout` បោះ ➜ ការរក្សាទុកត្រូវបដិសេធរួចស្រាប់តាំងពីមុន។
//
// ⚠️ **ហេតុអ្វី checker ១២២ បៃតងទាំងអស់** ៖ `duplicate-scan-test.js` វាស់ជាន់
//   ១–៤ ខណៈ **ទិដ្ឋភាពមូលដ្ឋានស្រស់ជានិច្ច** ➜ ជាន់ ២/៣ ទប់មុនដល់ជាន់ទី ៥។
//   `revenue-fuzz-test.js` ស្កេន **កូដថ្មីជានិច្ច** (`'FZ' + random`) ➜ វា
//   **មិនដែលស្កេនស្ទួនសោះ**។ នេះជា **សំណួរទី ៨** ៖ «តើ checker ដាក់ប្រព័ន្ធ
//   ក្នុង *ស្ថានភាព* ណា មុនអះអាង?» — ស្ថានភាពពិតគឺ **ទិដ្ឋភាពមូលដ្ឋានចាស់**។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.DUPMONEY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.DUPMONEY_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm' };
let pass=0, fail=0;
function ok(l,c,d){ if(c){console.log('  ok    '+l);pass++;} else {console.log('  FAIL  '+l+(d!==undefined?'\n        '+JSON.stringify(d):''));fail++;} }
function serve(dir){return new Promise((res)=>{const s=http.createServer((rq,rp)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(dir,p); if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rp.writeHead(404);return rp.end();}
 rp.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'text/plain'});rp.end(fs.readFileSync(f));});s.listen(0,'127.0.0.1',()=>res(s));});}
const LICENSE_STUB = `window.ZoeLicense={getStatus:()=>Promise.resolve({state:'active'}),setServerTimeOffset(){},syncServerTime:()=>Promise.resolve(),activate:()=>Promise.resolve({ok:true}),verifyKeyString:()=>Promise.resolve({ok:true}),clearActivation(){}};`;
const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store; window.__toasts = [];
    const listeners = [];
    function getPath(p){ if(!p||p==='/')return store; let cur=store;
      for(const part of p.split('/').filter(Boolean)){ if(cur===null||typeof cur!=='object')return null; cur=cur[part]; }
      return cur===undefined?null:cur; }
    function setPath(p,val){ const parts=p.split('/').filter(Boolean); if(!parts.length)return; let cur=store;
      for(let i=0;i<parts.length-1;i++){ if(cur[parts[i]]===null||typeof cur[parts[i]]!=='object')cur[parts[i]]={}; cur=cur[parts[i]]; }
      const last=parts[parts.length-1]; if(val===null)delete cur[last]; else cur[last]=JSON.parse(JSON.stringify(val)); }
    function snapOf(p){ const v=getPath(p); return { val:()=>(v===undefined||v===null)?null:(typeof v==='object'?JSON.parse(JSON.stringify(v)):v), exists:()=>v!==null&&v!==undefined }; }
    function fire(p){ listeners.filter(l=>l.path===p).forEach(l=>{try{l.cb(snapOf(p));}catch(e){}}); }
    function fireAll(){ [...new Set(listeners.map(l=>l.path))].forEach(fire); }
    window.__fireAll = fireAll;
    const user={uid:'u',email:'a@b.c',getIdToken:()=>Promise.resolve('t'),metadata:{lastSignInTime:new Date().toISOString()}};
    window.firebaseSDK={ initializeApp:()=>({name:'f'}),getApps:()=>[],deleteApp:()=>Promise.resolve(),
      getAuth:()=>({currentUser:user}), onAuthStateChanged:(a,cb)=>{setTimeout(()=>cb(user),0);return()=>{};},
      signInWithEmailAndPassword:()=>Promise.resolve({user}),signOut:()=>Promise.resolve(),
      setPersistence:()=>Promise.resolve(),browserLocalPersistence:{},browserSessionPersistence:{},
      getIdTokenResult:()=>Promise.resolve({authTime:new Date().toISOString(),claims:{}}),
      getDatabase:()=>({fake:true}), ref:(d,p)=>({path:p===undefined?'':String(p)}),
      onValue:(r,cb)=>{listeners.push({path:r.path,cb});setTimeout(()=>{if(r.path==='.info/connected')cb({val:()=>true});else cb(snapOf(r.path));},0);return()=>{};},
      off:()=>{},goOnline:()=>{}, get:(r)=>Promise.resolve(snapOf(r.path)),
      set:(r,v)=>{setPath(r.path,v);fireAll();return Promise.resolve();},
      update:(r,o)=>{Object.keys(o).forEach(k=>setPath((r.path?r.path+'/':'')+k,o[k]));fireAll();return Promise.resolve();},
      runTransaction:(r,fn)=>{ const c=getPath(r.path); const n=fn(c===null?null:JSON.parse(JSON.stringify(c)));
        if(n===undefined)return Promise.resolve({committed:false,snapshot:snapOf(r.path)});
        setPath(r.path,n);fireAll();return Promise.resolve({committed:true,snapshot:snapOf(r.path)}); } };
    window.dispatchEvent(new Event('firebasesdkready'));
};
function seedEmpty(){ const t=new Date();
  const d=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  return { zoew_scan_history_cod_dod:{}, zoew_recently_deleted_cod_dod:{}, zoew_daily_revenue_cod_dod:{},
    zoew_monthly_revenue_cod_dod:{}, zoew_daily_pickup_cod_dod:{}, zoew_barcode_registry:{},
    zoew_settings:{exchange_rate:4100}, _dateKey:d }; }

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const server = await serve(path.join(ROOT,'ZoeW'));
  const port = server.address().port;
  const ctx = await browser.newContext({ viewport:{width:412,height:780} });
  const page = await ctx.newPage();
  page.on('dialog', d=>d.accept());
  await page.route('**', (r)=>{ const u=r.request().url();
    if(u.indexOf('/license-verify.js')!==-1) return r.fulfill({status:200,contentType:'application/javascript',body:LICENSE_STUB});
    if(u.startsWith('http://127.0.0.1:'+port)) return r.continue(); return r.abort(); });
  await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({apiKey:'k',databaseURL:'https://fake-default-rtdb.firebaseio.com',projectId:'p'}))});`);
  await page.addInitScript('('+BOOT.toString()+')('+JSON.stringify(seedEmpty())+');');
  await page.goto('http://127.0.0.1:'+port+'/', {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>typeof window.addOrUpdateEntry==='function' && window.__fakeStore, null, {timeout:30000});
  await page.evaluate(()=>new Promise(r=>setTimeout(r,400)));

  await page.evaluate(()=>{ window.__origTx = window.firebaseSDK.runTransaction;
      window.__origUpdate = window.firebaseSDK.update; });
  await page.evaluate(()=>{ const real = window.showToast;
      window.showToast = function(m){ window.__toasts.push(String(m)); return real.apply(this, arguments); }; });

  const money = () => page.evaluate(()=>{ const rev=window.__fakeStore.zoew_daily_revenue_cod_dod||{};
    const day=Object.keys(rev)[0]; const hist=window.__fakeStore.zoew_scan_history_cod_dod||{};
    const codes=[]; Object.keys(hist).forEach(id=>(hist[id].barcodes||[]).forEach(b=>codes.push(String(b.code))));
    return { cod: day?rev[day].codDollar:0, count: day?rev[day].totalCount:0,
             items:Object.keys(hist).length, codes }; });

  // helper: call the REAL addOrUpdateEntry (layer 5) directly, bypassing layers 1-4
  const layer5 = (code, phone, cod) => page.evaluate(async (a)=>{
      try { await window.addOrUpdateEntry(a.code, a.phone, a.cod, 0, 'N/A'); } catch(e){}
      await new Promise(r=>setTimeout(r,150));
  }, {code, phone, cod});

  console.log('\n=== ជាន់ទី ៥ ដោយឡែក ៖ addOrUpdateEntry() ជាមួយ barcode ស្ទួន ===');

  // S1: same phone, same day, item OPEN, barcode already present
  await layer5('AA9','012345678',30);
  const s1a = await money();
  ok('S1 ការស្កេនទី ១ ➜ លុយ 30 · barcode ១', s1a.cod===30 && s1a.codes.length===1, s1a);
  await layer5('AA9','012345678',30);
  const s1b = await money();
  ok('S1 ⛔ ស្កេន AA9 ស្ទួន (លេខដដែល ប្រអប់បើក) ➜ លុយ **នៅ 30** មិនស្ទួន',
      s1b.cod===30 && s1b.codes.filter(c=>c==='AA9').length===1, s1b);

  // S2: control - a genuinely different barcode must still add
  await layer5('BB1','012345678',30);
  const s2 = await money();
  ok('S2 ទិសផ្ទុយ ៖ barcode ថ្មីពិត ➜ លុយឡើងទៅ 60', s2.cod===60, s2);

  // ⛔ S3/S4 ៖ ការវាស់បង្ហាញថា **ជាន់ទី ៥ តែម្នាក់ឯងមិនគ្របករណីឆ្លងកញ្ចប់ទេ** ៖
  //   លេខទូរស័ព្ទផ្សេង ឬកញ្ចប់ដើមបិទ ➜ `existingIndex === -1` ➜ សាងកញ្ចប់ថ្មី
  //   ➜ លុយបូកម្តងទៀត។ ⛔ **យើងមិនអះអាងថា «លុយត្រូវឡើង» ទេ** — នោះនឹងជាការ
  //   **ចាក់សោកំហុស** ជំនួសការការពារ (មេរៀន 2.20.6)។ ជំនួសវិញយើងអះអាង
  //   **ច្រកទ្វារ** ដែលធ្វើឲ្យស្ថានភាពនោះទៅមិនដល់ ៖ ការរក្សាទុកត្រូវទាមទារ
  //   សាលក្រម `'claimed'` ពិតពី server។ បើច្រកទ្វារនោះបាត់ ➜ ធ្លាក់។
  const guardSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
  const saveFn = (() => {
      const i = guardSrc.indexOf('async function confirmPhone');
      if (i === -1) return '';
      let d = 0, j = guardSrc.indexOf('{', i), started = false;
      for (; j < guardSrc.length; j++) {
          if (guardSrc[j] === '{') { d++; started = true; }
          else if (guardSrc[j] === '}') { d--; if (started && d === 0) { j++; break; } }
      }
      return guardSrc.slice(i, j);
  })();
  ok('រកឃើញ confirmPhone() (ជាន់អប្បបរមា)', saveFn.length > 500, saveFn.length);
  ok("⛔ ការរក្សាទុកទាមទារសាលក្រម 'claimed' ពិត (មិនមែន «ផ្ទៀងផ្ទាត់មិនបាន»)",
      /claim\s*!==\s*'claimed'/.test(saveFn));
  ok("⛔ ទិសផ្ទុយ ៖ សាលក្រម 'taken' នៅតែបដិសេធដដែល",
      /claim\s*===\s*'taken'/.test(saveFn));

  // ── ការទៅដល់បានពិត ៖ ស្កេនតាម UI ពេញលេញ ខណៈ registry មិនអាចប្រើបាន ──
  // ⛔ នេះជាការវាស់សំខាន់បំផុត ៖ វាមិនហៅ function ខាងក្នុងទេ — វាស្កេនតាម
  //   លំហូរអ្នកប្រើពិត (`triggerScanAction` ➔ `confirmPhone`)។
  console.log('\n=== ការទៅដល់បានពិត ៖ ស្កេនតាម UI ខណៈ registry ដាច់ ===');
  await page.evaluate(()=>{
      const realTx = window.firebaseSDK.runTransaction;
      window.firebaseSDK.runTransaction = function(r, fn){
          if (r && String(r.path).indexOf('zoew_barcode_registry') === 0) return Promise.reject(new Error('registry down'));
          return realTx.apply(this, arguments);
      };
  });
  const scanUI = (code, phone) => page.evaluate(async (a)=>{
      window.__toasts.length = 0;
      window.triggerScanAction(a.code);
      const pe=document.getElementById('modalPhoneInput'), ce=document.getElementById('modalCodInput');
      if(pe) pe.value=a.phone; if(ce) ce.value='30';
      const open = document.getElementById('phoneModal').style.display==='flex';
      if(open) await window.confirmPhone(false);
      await new Promise(r=>setTimeout(r,300));
      return { open, toasts: window.__toasts.slice() };
  }, {code, phone});

  const beforeUI = await money();
  const uiDup = await scanUI('AA9','077777777');
  const afterUI = await money();
  ok('UI ៖ ស្កេន AA9 ស្ទួន ខណៈ registry ដាច់ ➔ ប្រអប់មិនបើក (ជាន់ ២/៣ ទប់)',
      uiDup.open === false, uiDup);
  ok('UI ៖ លុយមិនប្រែ', afterUI.cod === beforeUI.cod, {beforeUI, afterUI});

  // ស្ថានភាពពិត ៖ **ឧបករណ៍ផ្សេង** រក្សាទុក CC7 រួច តែ listener របស់យើងមិនទាន់
  // ដឹង (ឬងាប់) ➔ `isBarcodeAlreadyUsed()` មើលមិនឃើញ; registry ក៏ដាច់។
  await page.evaluate(()=>{
      window.__fakeStore.zoew_scan_history_cod_dod['id_other_device'] = {
          id:'id_other_device', phone:'066666666', scanDate:window.__fakeStore._dateKey,
          cod:30, dod:0, price:30, count:1, barcode:'CC7', isClosed:false,
          createdAt:Date.now(), time:'10:00:00 ('+window.__fakeStore._dateKey+')',
          barcodes:[{code:'CC7',time:'10:00:00',cod:30,dod:0,locker:'N/A',
                     isClosed:false,isDeducted:false,isFromDeletion:false,createdAt:Date.now()}]
      };
      // ⛔ ដោយចេតនា ៖ **មិន**ហៅ __fireAll() ➔ ទិដ្ឋភាពមូលដ្ឋានមិនដឹង
  });
  const beforeStale = await money();
  const uiStale = await scanUI('CC7','088888888');
  const afterStale = await money();
  ok('UI ៖ ឧបករណ៍ផ្សេងបានរក្សាទុករួច + registry ដាច់ ➔ ជាន់ ២/៣ ខកខានពិត',
      uiStale.open === true, uiStale);
  ok('⛔ UI ៖ លុយមិនត្រូវឡើងលើ barcode ស្ទួន (ជាន់ចុងក្រោយត្រូវទប់)',
      afterStale.cod === beforeStale.cod,
      {beforeStale, afterStale, toasts: uiStale.toasts});
  ok('⛔ UI ៖ barcode មិនត្រូវស្ទួនក្នុងប្រវត្តិ',
      afterStale.codes.filter((c)=>c==='CC7').length === 1, afterStale.codes);
  ok('អ្នកប្រើត្រូវដឹងមូលហេតុ (សារមិនស្ងាត់)',
      uiStale.toasts.some((t)=>/ស្ទួន|ផ្ទៀងផ្ទាត់|បញ្ចូលរួច/.test(t)), uiStale.toasts);

  // ── ការរក្សាទុកធ្លាក់ ➔ លុយត្រូវត្រឡប់មកវិញ ──────────────────────────
  // ⛔ `addOrUpdateEntry()` បូកលុយ **ជាមុន** (សុទិដ្ឋិនិយម) រួច
  //   `revertRevenueOnSaveFailure()` បញ្ច្រាសវាពេលការសរសេរប្រវត្តិធ្លាក់។
  //   វាស់រួច (mutation) ៖ ការដកការបញ្ច្រាសនោះចេញ **រស់រានលើ checker ទាំង ៣**
  //   (`revenue-fuzz` · `slow-write` · `policy-test`) ➔ ចន្លោះពិត។
  //   បើវាបាក់ ៖ កញ្ចប់ **មិនត្រូវបានរក្សាទុក** តែ **លុយនៅតែបូក** ➔ លើសចំណូល។
  console.log('\n=== ការរក្សាទុកធ្លាក់ ➔ លុយត្រូវត្រឡប់មកវិញ ===');
  await page.evaluate(()=>{
      // ⛔ ត្រូវចាប់ផ្តើមពី fn ដើម — stub របស់ registry ពីសេណារីយ៉ូមុននៅសល់
      //   នឹងធ្វើឲ្យច្រកទ្វារបដិសេធការរក្សាទុក ➔ ការអះអាងវាស់អ្វីមិនបាន
      //   (បៃតងក្លែងក្លាយ — ចាប់បានដោយ mutation P3/P8)។
      window.firebaseSDK.runTransaction = function(r, fn){
          if (r && String(r.path).indexOf('zoew_scan_history_cod_dod') === 0) {
              return Promise.reject(new Error('permission_denied'));
          }
          return window.__origTx.apply(this, arguments);   // registry + revenue នៅដើរ
      };
      window.firebaseSDK.update = function(r, o){
          if (r && String(r.path).indexOf('zoew_scan_history_cod_dod') === 0) {
              return Promise.reject(new Error('permission_denied'));
          }
          return window.__origUpdate.apply(this, arguments);
      };
  });
  const beforeFail = await money();
  const failScan = await scanUI('DD8','055555555');
  await page.evaluate(()=>new Promise(r=>setTimeout(r,600)));
  const afterFail = await money();
  ok('⛔ សេណារីយ៉ូបានឈានដល់ផ្លូវរក្សាទុកពិត (ប្រអប់បើក)',
      failScan.open === true, failScan);
  ok('ការសរសេរប្រវត្តិធ្លាក់ ➔ កញ្ចប់មិនត្រូវរក្សាទុក',
      afterFail.codes.filter((c)=>c==='DD8').length === 0, afterFail.codes);
  ok('⛔ ការសរសេរធ្លាក់ ➔ លុយត្រូវត្រឡប់មកវិញ (កុំបូកលើស)',
      afterFail.cod === beforeFail.cod && afterFail.count === beforeFail.count,
      {beforeFail, afterFail, toasts: failScan.toasts});

  // ⛔ សាខា **merge** មានផ្លូវបញ្ច្រាសដាច់ដោយឡែក — ត្រូវវាស់វាដោយឡែកដែរ។
  //   វាស់រួច (mutation P8) ៖ សេណារីយ៉ូកញ្ចប់ថ្មីតែម្នាក់ឯង **មិនប៉ះវាទេ**។
  await page.evaluate(()=>{
      window.firebaseSDK.runTransaction = window.__origTx;
      window.firebaseSDK.update = window.__origUpdate;
  });
  const mergePhone = '044444444';
  const okScan = await scanUI('EE1', mergePhone);
  ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ កញ្ចប់ដំបូងរក្សាទុកបាន', okScan.open === true, okScan);
  await page.evaluate(()=>{
      window.firebaseSDK.runTransaction = function(r, fn){
          if (r && String(r.path).indexOf('zoew_scan_history_cod_dod') === 0) {
              return Promise.reject(new Error('permission_denied'));
          }
          return window.__origTx.apply(this, arguments);
      };
  });
  const beforeMergeFail = await money();
  const mergeFail = await scanUI('EE2', mergePhone);
  await page.evaluate(()=>new Promise(r=>setTimeout(r,600)));
  const afterMergeFail = await money();
  ok('⛔ សាខា merge ឈានដល់ផ្លូវរក្សាទុកពិត', mergeFail.open === true, mergeFail);
  ok('⛔ សាខា merge ៖ ការសរសេរធ្លាក់ ➔ លុយត្រូវត្រឡប់មកវិញ',
      afterMergeFail.cod === beforeMergeFail.cod
      && afterMergeFail.count === beforeMergeFail.count,
      {beforeMergeFail, afterMergeFail, toasts: mergeFail.toasts});

  console.log('\n' + pass + ' ok, ' + fail + ' fail');
  await browser.close(); server.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.log('CRASH', e && e.message); process.exit(1); });
