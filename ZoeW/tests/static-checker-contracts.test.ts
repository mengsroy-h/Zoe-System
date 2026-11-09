import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { moduleView } from '../scripts/checker-view.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');

const require=createRequire(root+'/audit-tools/static-checker-contracts.cjs');
const {cleanupSelection,dispatcherContract,onValueGuarded,walk,parse}=require(root+'/audit-tools/static-checker-contracts.cjs');
const view=(p: string)=>moduleView(fs.readFileSync(root+'/ZoeW/'+p,'utf8'),p);
it('ប្រភពពិត និង mutations នៃ checker រចនាសម្ព័ន្ធ', () => {
const cleanup=view('src/domain/cleanup.ts');
assert(cleanupSelection(cleanup));
for(const [a,b] of [['bounds.lowerMs','bounds.upperMs'],['if (!clock.current()) return;',''],['if (!bounds) return;',''],['&& claimable(b) && collectedAllows(currentItem, b)','&& collectedAllows(currentItem, b)'],['&& collectedAllows(currentItem, b)',''],['!ripeClosed.includes(b)','ripeClosed.includes(b)']])assert(!cleanupSelection(cleanup.replaceAll(a,b)),a);
assert(!cleanupSelection(cleanup.replace('const ripeClosed =', 'const ageNow = Infinity; const ripeClosed =')));
for(const declaration of ['const {ageNow} = {ageNow:Infinity};', 'const [ageNow] = [Infinity];', 'const {...bounds} = {lowerMs:Infinity};']) assert(!cleanupSelection(cleanup.replace('const ripeClosed =', declaration+' const ripeClosed =')));
for(const declaration of ['const claimable = () => true;', 'const collectedAllows = () => true;', 'function getServerClockBounds(){return {lowerMs:Infinity};}']) assert(!cleanupSelection(cleanup.replace('const ripeClosed =', declaration+' const ripeClosed =')));
const actions=view('src/app/actions.ts');assert(dispatcherContract(actions));
for(const [a,b] of [['if (!sessionUserActionAllowed(name)) return;',''],['lookupAction(name)','window[name]'],['if (!fn)','if (fn)'],['fn(...args);','fn(...args); fn(...args);'],['const fn = lookupAction(name);','fn(...args); const fn = lookupAction(name);']])assert(!dispatcherContract(actions.replace(a,b)),a);
const connection=view('src/services/connection.ts').replaceAll('firebaseState.','');
const checks=(source: string)=>{const result: boolean[]=[];walk(parse(source),(n: any,p: any[])=>{if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='onValue'&&/^dbRef/.test(n.arguments[0]?.name))result.push(onValueGuarded(n,p));});return result;};
assert.deepEqual(checks(connection),[true,true]);
for(const name of ['dbRefConnected','dbRefServerTimeOffset']){
 const modified=connection.replace(' || !'+name,'');const result=checks(modified);assert.equal(result[name==='dbRefConnected'?0:1],false);
}
assert.deepEqual(checks('function f(){ if (!dbRefX) return; '+ 'void 0;'.repeat(500)+'fb.onValue(dbRefX, ()=>{}); }'),[true]);
for(const s of ['function f(){if(false){if(!dbRefX)return;}fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefY)return;fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefX)return;dbRefX=null;fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefX&&ready)return;fb.onValue(dbRefX,()=>{});}', 'function f(){if(!dbRefX)return;(()=>{fb.onValue(dbRefX,()=>{});})();}']) assert.deepEqual(checks(s),[false]);
for (const source of ['function f(){if(!dbRefX)return;{let dbRefX=null;fb.onValue(dbRefX,()=>{});}}', 'function f(){if(dbRefX){let dbRefX;fb.onValue(dbRefX,()=>{});}}', 'function f(){if(!dbRefX)return;for(let dbRefX of refs){fb.onValue(dbRefX,()=>{});}}', 'function f(){if(!dbRefX)return;try{}catch(dbRefX){fb.onValue(dbRefX,()=>{});}}']) assert.deepEqual(checks(source),[false]);
for(const statement of ['{ const {dbRefX} = {dbRefX:null}; fb.onValue(dbRefX,()=>{}); }', '{ const [dbRefX] = [null]; fb.onValue(dbRefX,()=>{}); }', 'for(const {dbRefX} of [{dbRefX:null}]) {fb.onValue(dbRefX,()=>{});}', 'try{}catch({dbRefX}){fb.onValue(dbRefX,()=>{});}']) assert.deepEqual(checks('function f(){if(!dbRefX)return;'+statement+'}'),[false]);
assert.deepEqual(checks('function f(){if(dbRefX){fb.onValue(dbRefX,()=>{});}}'),[true]);
console.log('PASS actual module views and 19 negative/distance controls; no browser');
const kg=fs.readFileSync(root+'/ZoeKeyGen/app.js','utf8');assert(checks(kg).every(Boolean));
const all=[];for(const p of fs.readdirSync(root+'/ZoeW/src',{recursive:true, encoding:'utf8'}).filter(p=>p.endsWith('.ts')&&!p.endsWith('.d.ts'))){if(!fs.readFileSync(root+'/ZoeW/src/'+p,'utf8').includes('.onValue('))continue;const src=view('src/'+p).replaceAll('firebaseState.','');for(const result of checks(src))all.push({p,result});}
assert(all.every(x=>x.result),JSON.stringify(all.filter(x=>!x.result)));console.log('PASS all ZoeW source and KeyGen onValue guards',all.length,checks(kg).length);
const {sharedClockContract}=require(root+'/audit-tools/static-checker-contracts.cjs');
const clock=view('src/core/clock.ts');
const fn=(source: string,name: string)=>{const node=parse(source).body.find((n: any)=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end);};
const zfn=fn(clock,'getServerNow'),kfn=fn(kg,'getServerNow');assert(sharedClockContract(clock,zfn,kfn));
for(const [a,b] of [['sample.estimateEpochMs + Math.floor(elapsed)','Date.now()'],['invalidateServerClock();','void 0;'],['return sample.estimateEpochMs;','return 0;']]){const mutant=clock.replaceAll(a,b);assert(!sharedClockContract(mutant,fn(mutant,'getServerNow'),kfn),a);}
assert(!sharedClockContract(clock,zfn,kfn.replace('window.ZoeLicense.getServerNow()','123')));
assert(!sharedClockContract(clock,zfn,kfn.replace('Date.now() + serverTimeOffsetMs','Date.now()')));
assert(!sharedClockContract(clock,zfn.replace('Math.floor(elapsed)','elapsed'),kfn));
console.log('PASS shared clock owner behavior and six negative controls');

});
