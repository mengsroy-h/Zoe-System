'use strict';
const vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
module.exports=function(source, retained) {
 const store=retained||{props:{IMPORT_PASSWORD:'synthetic-password',SHEET_ID:'synthetic-sheet',SHEET_NAME:'Customers'},rows:[['Barcode','DOD','COD','Phone']],formulas:[],capacity:20,writes:0,clears:0,held:false,locks:0,releases:0,reads:0,fault:{}};
 const sheet={getParent:()=>({getName:()=> 'Synthetic Sheet'}),getName:()=>store.props.SHEET_NAME,getSheetId:()=>store.tabId||123,getMaxRows:()=>store.capacity,
  getLastRow:()=>{for(let i=store.rows.length-1;i>=0;i--)if(store.rows[i].some(x=>x!==''))return i+1;return 0;},
  insertRowsAfter:(_,n)=>{store.capacity+=n;},getRange:(start,col,n,w)=>({setNumberFormat(){},
   getValues:()=>{store.reads++;return Array.from({length:n},(_,i)=>(store.rows[start-1+i]||['','','','']).slice(col-1,col-1+w));},
   getFormulas:()=>Array.from({length:n},(_,i)=>(store.formulas[start-1+i]||['','','','']).slice(col-1,col-1+w)),
   setValues:rows=>{store.writes++;for(let i=0;i<n;i++){store.rows[start-1+i]=Array.from(rows[i]);store.formulas[start-1+i]=['','','',''];if(store.fault.afterRow){store.fault.afterRow--;if(!store.fault.afterRow)throw Error('synthetic crash after applied row');}}},
   clearContent:()=>{store.clears++;for(let i=0;i<n;i++){store.rows[start-1+i]=['','','',''];store.formulas[start-1+i]=['','','',''];if(store.fault.clearAfterRow){store.fault.clearAfterRow--;if(!store.fault.clearAfterRow)throw Error('synthetic crash after cleared row');}}}})};
 const ctx=vm.createContext({ScriptApp:{getScriptId:()=> store.writerProjectId || 'synthetic-writer-project'},PropertiesService:{getScriptProperties:()=>({getProperty:k=>Object.hasOwn(store.props,k)?store.props[k]:null,
  setProperty:(k,v)=>{if(store.fault.properties)throw Error('synthetic storage refusal');if(store.fault.fence&&k.startsWith('ZTO_IMPORT_FENCE_V1_'))throw Error('synthetic fence storage refusal');if(store.fault.done&&k.startsWith('ZTO_IMPORT_RECEIPT_V1_')&&JSON.parse(v).state==='done')throw Error('synthetic crash before receipt ACK');store.props[k]=String(v);},
  deleteProperty:k=>{delete store.props[k];},getProperties:()=>({...store.props})})},
  SpreadsheetApp:{openById:id=>{assert.equal(id,store.props.SHEET_ID);return{getSheetByName:n=>{assert.equal(n,store.props.SHEET_NAME);return sheet;}};},flush(){if(store.fault.flush)throw Error('synthetic flush error');}},
  LockService:{getScriptLock:()=>({tryLock:()=>{if(store.held)return false;store.held=true;store.locks++;return true;},releaseLock:()=>{assert.equal(store.held,true);store.held=false;store.releases++;}})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},getUuid:()=>crypto.randomUUID(),computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(String(v)).digest(),x=>x>127?x-256:x)},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}});
 vm.runInContext(source,ctx);
 const post=body=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({...body,password:body.password===undefined?'synthetic-password':body.password})}}).text);
 const prep=(kind,payload)=>{const r=post({action:'prepareWrite',request:{kind,payload,confirm:'CLEAR'}});if(!r.ok)throw Error(r.error);return r.data.intent;};
 const send=(kind,payload,intent)=>post(kind==='clear'?{action:'clear',confirm:'CLEAR',intent}:{action:'import',payload:{...payload,intent}});
 const rows=()=>store.rows.slice(1).filter(r=>r.some(v=>v!=='')).map(r=>r.slice());
 return {ctx,store,post,prep,send,rows,restart:()=>module.exports(source,store)};
};

module.exports.writerTransport = function (source, options = {}) {
 const fs = require('node:fs');
 const fixture = module.exports(fs.readFileSync(source, 'utf8'));
 fixture.store.props.IMPORT_PASSWORD = options.password || 'pw';
 fixture.store.writerProjectId = crypto.randomUUID();
 const calls = [];
 let seeded = false;
 const json = value => new Response(JSON.stringify(value), { status: 200 });
 const seed = () => {
  if (seeded) return;
  seeded = true;
  const rows = typeof options.rows === 'function' ? options.rows() : options.rows || [];
  fixture.store.rows = [['Barcode', 'DOD', 'COD', 'Phone'], ...rows.map(row => Array.from(row))];
  fixture.store.capacity = Math.max(20, fixture.store.rows.length);
 };
 const respond = async (_url, init) => {
  const body = JSON.parse(init.body);
  calls.push(body);
  if (body.action === 'status' || body.action === 'prepareWrite') {
   seed();
   return json(fixture.post(body));
  }
  if (body.action !== 'import' && body.action !== 'clear') {
   if (!options.header) throw Error('Unexpected fixture action: ' + body.action);
   return options.header(body);
  }
  let supplied;
  const early = options.commitBeforeReply ? fixture.post(body) : null;
  if (early) assert.equal(early.ok, true);
  try { if (options.commit) supplied = await options.commit(body); }
  catch (error) {
   const committed = early || fixture.post(body);
   assert.equal(committed.ok, true, 'injected lost response must follow actual server commit');
   throw error;
  }
  let decoded;
  if (supplied) {
   try { decoded = JSON.parse(await supplied.clone().text()); } catch {}
  }
  if (decoded?.ok === false && decoded.written === false) {
   fixture.store.props.IMPORT_PASSWORD = 'synthetic-rotated-password';
   const rejected = fixture.post(body);
   assert.equal(rejected.ok, false);
   assert.equal(rejected.written, false);
   return json(rejected);
  }
  const committed = early || fixture.post(body);
  assert.equal(committed.ok, true, 'actual server validates intent/source/target/revision before test response');
  if (supplied && !(supplied.ok && decoded?.ok === true && decoded.data && typeof decoded.data === 'object')) return supplied;
  return json(committed);
 };
 return { fixture, calls, respond };
};
