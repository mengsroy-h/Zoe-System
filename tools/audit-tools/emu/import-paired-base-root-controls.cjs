'use strict';
// Synthetic retained BASE source copy; never starts a database or emulator.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),cp=require('child_process'),crypto=require('crypto');
const real=path.resolve(process.env.IMPORTPAIRED_APP_DIR||process.env.ZOE_REPO_ROOT||path.join(__dirname,'../../..'));
const deps=path.resolve(process.env.ZOE_NODE_MODULES||path.join(process.env.ZOE_REPO_ROOT||real,'ZoeW/node_modules'));
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'zoe-import-base-source-'));
fs.mkdirSync(path.join(fixture,'ZoeW'));fs.cpSync(path.join(real,'ZoeW/src'),path.join(fixture,'ZoeW/src'),{recursive:true});
fs.copyFileSync(path.join(real,'firebase-database.rules.json'),path.join(fixture,'firebase-database.rules.json'));
assert.equal(fs.existsSync(path.join(fixture,'ZoeW/node_modules')),false,'BASE must lack its own dependencies');
const script="process.argv=['node','checker','--matrix=core','--provider=both','--case=I100-cookie-unsigned'];const c=require('./import-paired-sdk-test.js');c.assertRuntimeReady();const r=c.bundle();const i=c.instrumentRecovery(c.instrumentAuth(c.instrumentSubscribe(c.instrumentTransport(c.instrumentSweep(r)))));if(!i.includes('__observeSweep'))throw Error('no sweep instrumentation');";
const run=cp.spawnSync(process.execPath,['-e',script],{cwd:__dirname,encoding:'utf8',env:{...process.env,IMPORTPAIRED_APP_DIR:fixture,IMPORTPAIRED_CI_CASE:'I100-cookie-unsigned',IMPORTPAIRED_CI_PROVIDER:'both',IMPORTPAIRED_NATIVE_MARKER:'/tmp/native-marker.json',IMPORTPAIRED_STRICT:'1',CRUD_FLOW_STRICT:'1',ZOE_NODE_MODULES:deps}});
assert.equal(run.status,0,'synthetic BASE child failed; stderrSha256='+crypto.createHash('sha256').update(run.stderr||'').digest('hex'));console.log(JSON.stringify({status:'PASS',scope:'synthetic BASE source with external dependency root; no PG or native backend',fixtureRetained:true}));
