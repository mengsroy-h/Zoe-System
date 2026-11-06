'use strict';
process.exitCode = 1;
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');
const path = require('node:path');
const ROOT = path.resolve(process.env.SCANMONTHORCH_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '..'));
const file = path.join(ROOT, 'ZoeW/src/services/scan-operation.ts');
const source = fs.readFileSync(file, 'utf8');
const network = fs.readFileSync(path.join(ROOT, 'ZoeW/src/services/network.ts'), 'utf8');
assert.match(network, /export const DB_OP_TIMEOUT_MS = 15000;/, 'ថវិកា production ត្រូវផ្ទៀងមុនវាស់');
function between(start, end) {
  const from=source.indexOf(start), to=source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'ប្រភពខ្វះ៖ ' + start);
  return source.slice(from, to);
}
const extracted = [
  between('type MonthlyWaiter =', '\nfunction scanMonthMutation'),
  between('function scanMonthMutation', '\nfunction operationOf'),
  between('async function prepareScanMonth', '\nfunction stagedScanRow'),
  between('export async function saveScanOperation', '\nexport function scanImportCollectedOwned'),
].join('\n').replaceAll('export ', '');
const js = stripTypeScriptTypes(extracted);
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const flush = async () => { for (let i=0;i<50;i++) await Promise.resolve(); };
async function scenario(poison) {
  let now = 0, serial = 0, starts = 0, digestCalls = 0;
  const calls = [];
  const timers = new Map(), operations = new Map(), results = new Map();
  const digestGate = deferred(), monthGate = deferred(), preparedReadGate = deferred();
  const thirdDigestGate = deferred(), thirdReadGate = deferred();
  const digestValue = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('payload'));
  const sdk = { runTransaction: async (ref, update) => {
    if (ref === 'zoew_monthly_revenue_cod_dod') { starts++; await monthGate.promise; return { committed: true }; }
    const next = update(operations.get(ref)); operations.set(ref, next); return { committed: true };
  }, ref: (_db, path) => path };
  const context = {
    DB_OP_TIMEOUT_MS: 15000, performance: {now: () => now},
    setTimeout: (fn, ms) => { calls.push([fn, ms]); const id=++serial; timers.set(id,{fn,at:now+ms}); return id; },
    clearTimeout: id => timers.delete(id),
    crypto: {subtle: {digest: async () => {
      if (++digestCalls===2) await digestGate.promise;
      if (digestCalls===3) await thirdDigestGate.promise;
      return digestValue;
    }}},
    TextEncoder, Uint8Array,
    activeScans: new Map(), originalScanHandles: new WeakSet(), liveImportCollected: new WeakMap(),
    operationOf: handle => ({...handle.record}), pendingScanIsLive: () => false,
    readOperationNode: async (_h,_o,path) => {
      const record=operations.get(path);
      if (record?.id==='second' && record.phase==='prepared') await preparedReadGate.promise;
      if (record?.id==='third' && record.phase==='prepared') await thirdReadGate.promise;
      return record;
    },
    scanOperationSame: (a,b) => a?.id===b.id, scanOperationValid: x => !!x,
    operationCurrent: () => true, dataState: {scanHistory:[]}, rowOperationActive: () => false,
    SCAN_OPERATIONS_ROOT:'zoew_scan_operations', generateUniqueId: () => 'row'+serial,
    notePendingScan: () => {}, scanHeld: () => {}, releasePendingScan: () => {}, warnPendingScans: () => {},
    validLedgerBucket: () => true, ledgerLatestMonths: x=>x, ledgerTokenSeen:()=>false,ledgerOpRing:()=>[],
  };
  vm.createContext(context); vm.runInContext(js+'\nthis.save = saveScanOperation;', context, {timeout:1000});
  const db={};
  const handles=['first','second'].map(id=> {const record={id,phase:'admitted',scanDate:'2026-11-06',month:'2026-11',monthToken:id}; operations.set('zoew_scan_operations/'+id,record); return {record,db,sdk};});
  const runs=handles.map(h=>context.save(h,'0910000001','N/A',0).then(value=>results.set(h.record.id,value)));
  await flush(); assert.equal(starts,1); assert.equal(timers.size,1);
  async function tick(ms) {const end=now+ms; for (;;) {const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]; if(!due)break; now=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}now=end;await flush();}
  const testSource = fs.readFileSync(path.join(ROOT, 'ZoeW/tests/scan-month-coordination.test.ts'), 'utf8');
  const at = testSource.indexOf("it('one bounded budget");
  assert.ok(at >= 0, 'រកតេស្តថវិកាមិនឃើញ');
  const end = testSource.indexOf("\nit('queued old-session", at);
  assert.ok(end > at, 'ព្រំដែនតេស្តត្រូវមាន');
  const target = testSource.slice(at, end);
  const advance = target.match(/await vi\.advanceTimersByTimeAsync\((.*?)\);/);
  assert.equal(advance?.[1], 'DB_OP_TIMEOUT_MS', 'ថវិកាតេស្តត្រូវដដែល');
  let predicate = target.match(/await waitForRealCondition\(\(\)=> ([\s\S]*?),'hung native reserve'\)/)?.[1]
    || target.match(/await waitForRealCondition\(\(\)=>([\s\S]*?),'hung native reserve'\)/)?.[1];
  assert.ok(predicate, 'ត្រូវរត់ predicate ត្រៀមរួចរបស់តេស្តពិត');
  Object.defineProperty(context, 'monthStarts', {get: () => starts});
  const helper = target.match(/const budgetsStarted = (.*?);/);
  context.timers = {mock:{calls}};
  if (helper) context.budgetsStarted = vm.runInContext(helper[1], context, {timeout:1000});
  if (poison === 'digest') predicate = 'monthStarts===1';
  if (poison === 'budget') predicate = "monthStarts===1 && get('zoew_scan_operations/'+second.record.id)?.phase==='prepared'";
  context.first = handles[0]; context.second = handles[1];
  context.get = key => operations.get(key);
  const ready = vm.runInContext('() => (' + predicate + ')', context, {timeout:1000});
  if (!ready()) {
    // crypto បញ្ចប់នៅវេនពិតបន្ទាប់ ដោយមិនរំកិលម៉ោងក្លែង។
    digestGate.resolve(); await flush();
  }
  if (!ready()) {
    // receipt prepared មិនបញ្ជាក់ថាថវិកាជួររង់ចាំបានចុះឈ្មោះរួចទេ។
    preparedReadGate.resolve(); await flush();
  }
  assert.equal(ready(), true, 'ត្រូវឃើញការត្រៀមរួចក្រោយបញ្ចប់ការងារពិត');
  await tick(15000);
  digestGate.resolve(); preparedReadGate.resolve(); await flush();
  assert.equal(results.get('first'), 'unknown');
  assert.equal(results.get('second'), 'unknown',
    'SCAN_MONTH_EARLY_CLOCK៖ ម៉ោងរត់មុន crypto ទីពីរ និងថវិកាជួររង់ចាំ');
  assert.equal(starts, 1, 'ការងារ native ក្នុងជួរមិនត្រូវចាប់ផ្ដើម');
  assert.equal(now, 15000, 'មិនត្រូវបន្ថែមថវិកាពេលរង់ចាំ');
  await Promise.all(runs);
  const thirdAt = target.indexOf('const third=');
  assert.ok(thirdAt >= 0, 'រកការងារទីបីមិនឃើញ');
  const thirdSource = target.slice(thirdAt);
  let thirdPredicate = thirdSource.match(/await waitForRealCondition\(\(\)=>([\s\S]*?),'third prepared'\)/)?.[1];
  assert.ok(thirdPredicate, 'ត្រូវរត់ predicate ទីបីពិត');
  const thirdAdvance = thirdSource.match(/await vi\.advanceTimersByTimeAsync\((.*?)\);/);
  assert.equal(thirdAdvance?.[1], 'DB_OP_TIMEOUT_MS', 'ថវិកាទីបីត្រូវដដែល');
  const record = {id:'third', phase:'admitted', scanDate:'2026-11-06', month:'2026-11', monthToken:'third'};
  operations.set('zoew_scan_operations/third', record);
  context.third = {record, db, sdk};
  context.priorBudgets = context.budgetsStarted();
  const thirdRun = context.save(context.third, '0910000003', 'N/A', 0).then(value => results.set('third', value));
  await flush();
  assert.equal(results.has('third'), false);
  if (poison === 'third-digest') thirdPredicate = 'monthStarts===1';
  if (poison === 'third-budget') thirdPredicate = "get('zoew_scan_operations/'+third.record.id)?.phase==='prepared'";
  const thirdReady = vm.runInContext('() => (' + thirdPredicate + ')', context, {timeout:1000});
  if (!thirdReady()) { thirdDigestGate.resolve(); await flush(); }
  if (!thirdReady()) { thirdReadGate.resolve(); await flush(); }
  assert.equal(thirdReady(), true, 'ការងារទីបីត្រូវត្រៀមរួច');
  await tick(15000);
  thirdDigestGate.resolve(); thirdReadGate.resolve(); await flush();
  assert.equal(results.get('third'), 'unknown', 'SCAN_MONTH_THIRD_CLOCK៖ ម៉ោងរត់មុនថវិកាទីបី');
  assert.equal(starts, 1, 'native ដើមនៅជាប់៖ ការងារទីបីមិនត្រូវចាប់ផ្ដើម');
  assert.equal(now, 30000, 'ទីបីប្រើថវិកាដដែលតែមួយ');
  await thirdRun;
}
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ok    ' + label); }
  else { fail++; console.error('  FAIL  ' + label, detail || ''); }
}
(async () => {
  try {
    await scenario();
    ok('digest និង budget រួចរាល់មុនរំកិលម៉ោង៖ unknown បី · native មួយ · ថវិកា 15000ms ក្នុងមួយជំហាន', true);
    for (const poison of ['digest', 'budget', 'third-digest', 'third-budget']) {
      await assert.rejects(() => scenario(poison), /SCAN_MONTH_(EARLY|THIRD)_CLOCK/);
      ok('poison ' + poison + ' ត្រូវធ្លាក់', true);
    }
  } catch (error) { ok('scan-month orchestration', false, error.stack); }
  console.log('ជោគជ័យ ' + pass + ' · ធ្លាក់ ' + fail);
  process.exitCode = fail ? 1 : 0;
})();
