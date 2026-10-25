const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { verifyReceiptPhoto } = require('../netlify/functions/_shared/zto-receipt-photo-readback.js');
const HOST = 'zto-haiwai2025.oss-cn-hongkong.aliyuncs.com';
const URL0 = `https://${HOST}/track/shortterm/bill/1/202610/0000_123.jpg?Signature=fake%2Bonly&Expires=0`;
// រូប JPEG សិប្បនិម្មិតសម្រាប់រចនាសម្ព័ន្ធ មិនមែនរូបអ្នកប្រើ និងមិនអានបណ្តាញ។
const JPG = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const input = (url = URL0) => ({ authenticated: true, barcode: '0000', expectedSha256: hash(JPG), receiptRefs: [{ source: 'web', barcode: '0000', kind: 'receipt', picType: 1, url }] });
const response = (bytes = JPG, headers = {}) => new Response(bytes, { headers: { 'content-type': 'image/jpeg', ...headers } });
test('រូបដូចដើមត្រូវភ្ជាប់ Barcode និងមិនផ្ញើព័ត៌មានចូលគណនី', async () => {
 const result = await verifyReceiptPhoto(input(), async (url, init) => {
  assert.equal(url, URL0); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
  assert.deepEqual(init.headers, {}); assert.equal(init.body, undefined); return response();
 });
 assert.deepEqual(result, { verified: true, reason: 'exact_match', matchedRefIndex: 0 });
});
test('ប្តូរតែ HTTP ទៅ HTTPS ដោយរក្សា query ដដែល', async () => {
 assert.equal((await verifyReceiptPhoto(input(URL0.replace('https:', 'http:')), async url => { assert.equal(url, URL0); return response(); })).verified, true);
});
test('ទិន្នន័យមិនសុវត្ថិភាពមិនអានបណ្តាញ', async () => {
 const urls = ['https://169.254.169.254/latest/meta-data', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://localhost/x', URL0.replace(HOST, HOST + '.evil.test'), URL0.replace(HOST, 'user@' + HOST), URL0.replace(HOST, HOST + ':444'), URL0 + '#x', URL0.replace('/1/', '/4/'), URL0.replace('/0000_', '/0001_'), URL0.replace('/202610/', '/202613/'), URL0.replace('/202610/', '/%2e%2e/202610/'), URL0.replace('/202610/', '/x/../202610/'), URL0.replace('/0000_', '/%30000_'), URL0.replace('https:', 'file:'), URL0.replace(HOST, HOST.toUpperCase()), ' ' + URL0, URL0.replace('/track/', '\\track/')];
 for (const url of urls) assert.equal((await verifyReceiptPhoto(input(url), () => { throw Error('must not fetch'); })).reason, 'invalid_reference');
 for (const patch of [{ authenticated: false }, { barcode: '0001' }, { expectedSha256: '' }, { receiptRefs: [] }, { receiptRefs: null }]) assert.equal((await verifyReceiptPhoto({ ...input(), ...patch }, () => { assert.fail('fetch'); })).verified, false);
 for (const patch of [{ source: 'unknown' }, { barcode: '0001' }, { kind: 'other' }, { picType: 4 }]) { const data = input(); Object.assign(data.receiptRefs[0], patch); assert.equal((await verifyReceiptPhoto(data, () => { assert.fail('fetch'); })).verified, false); }
});
test('រូបខុស ទទេ ខូច ឬមិនមែនរូប មិនអះអាងថាត្រឹមត្រូវ', async () => {
 for (const bytes of [Buffer.alloc(0), Buffer.from('null'), Buffer.from('<xml>error</xml>'), JPG.subarray(0, -1), Buffer.from([255,216,255,217])]) assert.equal((await verifyReceiptPhoto({...input(),expectedSha256:hash(bytes)}, async () => response(bytes))).verified, false);
 for (const type of ['text/html', 'application/xml', 'application/json']) assert.equal((await verifyReceiptPhoto(input(), async () => response(JPG, {'content-type':type}))).verified, false);
 assert.equal((await verifyReceiptPhoto({...input(), expectedSha256:'0'.repeat(64)}, async () => response())).verified, false);
});
test('ប្តូរទិស និងកំហុស មិនបញ្ចេញសម្ងាត់ ឬអះអាងរូប', async () => {
 for (const fn of [async () => { throw Error(URL0 + ' private-token'); }, async () => new Response('private-token', {status:500}), async () => new Response(null, {status:302,headers:{location:'https://169.254.169.254/'}})]) {
  const out = await verifyReceiptPhoto(input(), fn); assert.equal(out.verified,false); assert.doesNotMatch(JSON.stringify(out), /Signature|private|https/);
 }
});
test('រូបស្ទួនអានម្តង និងមិនរក្សាជោគជ័យចាស់', async () => {
 let calls=0; const data=input(); data.receiptRefs.push({...data.receiptRefs[0]});
 assert.equal((await verifyReceiptPhoto(data, async () => { calls++; return response(Buffer.from('bad')); })).verified,false); assert.equal(calls,1);
 assert.equal((await verifyReceiptPhoto(input(), async () => response())).verified,true);
 assert.equal((await verifyReceiptPhoto(input(), async () => response(Buffer.from('bad')))).verified,false);
});
test('ទំហំហួសព្រំដែន ឬខុសទំហំ ត្រូវបញ្ឈប់', async () => {
 assert.equal((await verifyReceiptPhoto(input(), async () => response(JPG, {'content-length':'8388609'}))).verified,false);
 assert.equal((await verifyReceiptPhoto(input(), async () => response(JPG, {'content-length':'1'}))).verified,false);
 let canceled=false, signal;
 assert.equal((await verifyReceiptPhoto(input(), async (_url, init) => { signal=init.signal; return new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(8388609));},cancel(){canceled=true;}}),{headers:{'content-type':'image/jpeg'}}); })).verified,false);
 assert.equal(canceled,true); assert.equal(signal.aborted,true);
});
test('កំណត់ចំនួនរូបមុនអាន', async () => { const data=input(); data.receiptRefs=Array(5).fill(data.receiptRefs[0]); assert.equal((await verifyReceiptPhoto(data,()=>assert.fail('fetch'))).verified,false); });
test('ហួសពេលត្រូវបញ្ឈប់ មិនយកចម្លើយយឺត និងរក្សាព្រំដែនអានស្របគ្នា', async t => {
 t.mock.timers.enable({apis:['setTimeout']});
 let resolveA, resolveB, signalA, canceled=false;
 const a=verifyReceiptPhoto(input(), (_url,init)=>{signalA=init.signal;return new Promise(resolve=>{resolveA=resolve;});});
 const b=verifyReceiptPhoto(input(), ()=>new Promise(resolve=>{resolveB=resolve;}));
 assert.equal((await verifyReceiptPhoto(input(),()=>assert.fail('third fetch'))).reason,'busy');
 t.mock.timers.tick(8000);
 assert.equal((await a).reason,'timeout'); assert.equal((await b).reason,'timeout'); assert.equal(signalA.aborted,true);
 assert.equal((await verifyReceiptPhoto(input(),()=>assert.fail('late third fetch'))).reason,'busy');
 resolveA(new Response(new ReadableStream({cancel(){canceled=true;}})));
 resolveB(response()); await new Promise(resolve=>setImmediate(resolve));
 assert.equal(canceled,true);
 assert.equal((await verifyReceiptPhoto(input(),async()=>response())).verified,true);
});
test('ទិន្នន័យរូបយឺតមិនអាចប្តូរការហួសពេលទៅជោគជ័យ', async t => {
 t.mock.timers.enable({apis:['setTimeout']});
 let resolveRead, canceled=false, signal;
 const pending=verifyReceiptPhoto(input(),async (_url,init)=>{signal=init.signal;return {status:200,headers:new Headers({'content-type':'image/jpeg'}),body:{getReader(){return {read(){return new Promise(resolve=>{resolveRead=resolve;});},cancel(){canceled=true;return Promise.resolve();}};}}};});
 await new Promise(resolve=>setImmediate(resolve));
 t.mock.timers.tick(8000); assert.deepEqual(await pending,{verified:false,reason:'timeout'}); assert.equal(signal.aborted,true);assert.equal(canceled,true);
 resolveRead({done:false,value:JPG}); await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await verifyReceiptPhoto(input(),async()=>response())).verified,true);
});
test('ប្រភពដែលបានឃើញទាំងពីរ និង Palm ប្រើទិន្នន័យរៀបចំរួច មិនមែនចម្លើយដើម',async()=>{
 const data=input(URL0.replace(HOST,'zt-haiwai.oss-cn-hongkong.aliyuncs.com'));data.receiptRefs[0].source='palm';
 assert.equal((await verifyReceiptPhoto(data,async()=>response())).verified,true);
 assert.equal((await verifyReceiptPhoto({status:true,result:[{billCode:'0000',savePos:URL0}]},()=>assert.fail('raw envelope'))).verified,false);
});
test('ចំនួនបំណែកតូចមានព្រំដែន និងបញ្ឈប់មុនអានរូបបន្ទាប់',async()=>{
 let count=0,signal,canceled=false;
 const data=input();data.receiptRefs.push({...data.receiptRefs[0],url:URL0.replace('_123','_456')});
 const out=await verifyReceiptPhoto(data,async(_url,init)=>{signal=init.signal;count++;return new Response(new ReadableStream({pull(c){c.enqueue(Uint8Array.of(1));},cancel(){canceled=true;}}),{headers:{'content-type':'image/jpeg'}});});
 assert.equal(out.verified,false);assert.equal(count,1);assert.equal(signal.aborted,true);assert.equal(canceled,true);
});
test('ព្រំដែនពេលរួមមិនចាប់ផ្តើមឡើងវិញតាមរូប',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,resolveSecond;
 const data=input();data.receiptRefs.push({...data.receiptRefs[0],url:URL0.replace('_123','_456')});
 const out=verifyReceiptPhoto(data,async()=>{calls++;if(calls===1){await new Promise(resolve=>setTimeout(resolve,5000));return response(Buffer.from('bad'));}return new Promise(resolve=>{resolveSecond=resolve;});});
 t.mock.timers.tick(5000);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);
 t.mock.timers.tick(3000);assert.equal((await out).reason,'timeout');resolveSecond(response());await new Promise(resolve=>setImmediate(resolve));
});
test('បញ្ជីមានចន្លោះទទេមិនបោះកំហុស ឬអានបណ្តាញ', async()=>{
 assert.deepEqual(await verifyReceiptPhoto({...input(),receiptRefs:Array(1)},()=>assert.fail('fetch')),{verified:false,reason:'invalid_reference'});
 assert.equal((await verifyReceiptPhoto(input(),async()=>response())).verified,true);
});
test('ផ្ទៀងផ្ទាត់ពេលម្តងទៀតក្រោយគណនា SHA256',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
 const source=fs.readFileSync(require.resolve('../netlify/functions/_shared/zto-receipt-photo-readback.js'),'utf8');
 for(const finishAt of [7999,8001]){
  let now=0;const module={exports:{}};
  vm.runInNewContext(source,{module,Buffer,Uint8Array,URL,AbortController,setTimeout,clearTimeout,require(name){
   if(name==='node:perf_hooks')return {performance:{now:()=>now}};
   if(name==='node:crypto')return {createHash(...args){const h=crypto.createHash(...args);return {update(bytes){h.update(bytes);return this;},digest(enc){now=finishAt;return h.digest(enc);}};}};
   throw Error('unexpected import');
  }});
  assert.equal((await module.exports.verifyReceiptPhoto(input(),async()=>response())).verified,finishAt===7999);
 }
});
test('ការបោះបង់មិនទាន់ចប់រក្សាព្រំដែនអានស្របគ្នា និងមិនអានរូបបន្ទាប់',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;const settle=[];
 const data=input();data.receiptRefs.push({...data.receiptRefs[0],url:URL0.replace('_123','_456')});
 const fetch=async()=>{calls++;return {status:500,body:{cancel(){return new Promise(resolve=>settle.push(resolve));}}};};
 const a=verifyReceiptPhoto(data,fetch),b=verifyReceiptPhoto(data,fetch);
 await new Promise(resolve=>setImmediate(resolve));
 try{
  assert.equal(calls,2);
  t.mock.timers.tick(8000);assert.equal((await a).verified,false);assert.equal((await b).verified,false);
  assert.equal((await verifyReceiptPhoto(input(),fetch)).reason,'busy');assert.equal(calls,2);
 }finally{for(const resolve of settle)resolve();await new Promise(resolve=>setImmediate(resolve));}
 assert.equal((await verifyReceiptPhoto(input(),async()=>response())).verified,true);
});
test('ហួសពេលក្នុង read ត្រូវចុះបញ្ជី cancel មុនដោះលែងកន្លែងអាន',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const vm=require('node:vm'),fs=require('node:fs');let now=0,calls=0;const settle=[],module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../netlify/functions/_shared/zto-receipt-photo-readback.js'),'utf8'),{module,Buffer,Uint8Array,URL,AbortController,setTimeout,clearTimeout,require(name){return name==='node:perf_hooks'?{performance:{now:()=>now}}:require(name);}});
 const verify=module.exports.verifyReceiptPhoto;
 const fetch=async()=>{calls++;return {status:200,headers:new Headers({'content-type':'image/jpeg'}),body:{getReader(){return {async read(){now+=8001;return {done:false,value:JPG};},cancel(){return new Promise(resolve=>settle.push(resolve));}};}}};};
 const a=verify(input(),fetch);await new Promise(resolve=>setImmediate(resolve));
 const b=verify(input(),fetch);await new Promise(resolve=>setImmediate(resolve));
 try{
  const third=await verify(input(),async()=>response());assert.equal(third.reason,'busy');assert.equal(calls,2);
  t.mock.timers.tick(8000);assert.equal((await a).verified,false);assert.equal((await b).verified,false);
 }finally{for(const resolve of settle)resolve();await new Promise(resolve=>setImmediate(resolve));}
 assert.equal((await verify(input(),async()=>response())).verified,true);
});
test('មូលហេតុមិនអះអាងរូបបែងចែកប្រភេទមិនគាំទ្រ រូបខូច និង hash ខុស',async()=>{
 assert.deepEqual(await verifyReceiptPhoto(input(),async()=>response(JPG,{'content-type':'image/png'})),{verified:false,reason:'unsupported_content_type'});
 const invalid=Buffer.from([255,216,255,217]);
 assert.deepEqual(await verifyReceiptPhoto({...input(),expectedSha256:hash(invalid)},async()=>response(invalid)),{verified:false,reason:'invalid_image'});
 assert.deepEqual(await verifyReceiptPhoto({...input(),expectedSha256:'0'.repeat(64)},async()=>response()),{verified:false,reason:'hash_mismatch'});
 assert.equal((await verifyReceiptPhoto(input(),async()=>response())).verified,true);
});
test('រូបចម្រុះមិនប្តូរកំហុសបណ្តោះអាសន្នទៅមូលហេតុមិនគាំទ្រ',async()=>{
 const data=input();data.expectedSha256='0'.repeat(64);data.receiptRefs.push({...data.receiptRefs[0],url:URL0.replace('_123','_456')});
 for(const reversed of [false,true]){
  for(const [responses,expected] of [
   [[()=>response(JPG,{'content-type':'image/png'}),()=>response()],'hash_mismatch'],
   [[()=>response(JPG,{'content-type':'image/png'}),()=>new Response('fake-error',{status:500})],'not_verified'],
   [[()=>response(Buffer.from('fake-invalid')),()=>response(JPG,{'content-type':'image/png'})],'invalid_image'],
   [[()=>response(),()=>response(JPG,{'content-type':'image/jpeg','content-length':'1'})],'not_verified']
  ]){
   const queue=reversed?[...responses].reverse():responses;
   const out=await verifyReceiptPhoto(data,async()=>queue.shift()());assert.equal(out.verified,false);assert.equal(out.reason,expected);
  }
 }
 const mixed=input();mixed.receiptRefs.push({...mixed.receiptRefs[0],url:URL0.replace('_123','_456')});
 const queue=[()=>response(JPG,{'content-type':'image/png'}),()=>response()];
 assert.equal((await verifyReceiptPhoto(mixed,async()=>queue.shift()())).verified,true);
});
