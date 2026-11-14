'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TARGET_FLAGS = new Map([
    ['--project', 'project'], ['--instance', 'instance'], ['--branch', 'branch'], ['--region', 'region'], ['--stage-dir', 'stageDir']
]);
const REGIONS = new Set([
    'africa-south1', 'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2', 'asia-northeast3',
    'asia-south1', 'asia-south2', 'asia-southeast1', 'asia-southeast2', 'australia-southeast1', 'australia-southeast2',
    'europe-central2', 'europe-north1', 'europe-north2', 'europe-southwest1', 'europe-west1', 'europe-west2',
    'europe-west3', 'europe-west4', 'europe-west6', 'europe-west8', 'europe-west9', 'europe-west10', 'europe-west12',
    'me-central1', 'me-central2', 'me-west1', 'northamerica-northeast1', 'northamerica-northeast2',
    'southamerica-east1', 'southamerica-west1', 'us-central1', 'us-east1', 'us-east4', 'us-east5',
    'us-south1', 'us-west1', 'us-west2', 'us-west3', 'us-west4'
]);
const RUNTIME_FILES = ['index.cjs', 'business-audit.cjs', 'package.json', 'package-lock.json', 'firebase.json'];

function fail(message) {
    throw Object.assign(new Error(message), { code: 'audit-stage-refused' });
}

function parseArgs(argv) {
    const args = argv.slice();
    const explicitAction = ['plan', 'stage'].includes(args[0]) ? args.shift() : null;
    const options = {};
    for (let index = 0; index < args.length; index++) {
        const flag = args[index], key = TARGET_FLAGS.get(flag);
        if (!key) fail('Unknown argument');
        if (Object.prototype.hasOwnProperty.call(options, key)) fail('Duplicate argument');
        const value = args[++index];
        if (typeof value !== 'string' || !value || value.startsWith('--')) fail('Missing argument value');
        options[key] = value;
    }
    if (explicitAction === 'plan' && options.stageDir) fail('Plan does not accept a stage destination');
    if (explicitAction === 'stage' && !options.stageDir) fail('Stage requires --stage-dir');
    options.action = explicitAction || (options.stageDir ? 'stage' : 'plan');
    return options;
}

function targetOf(options) {
    for (const key of ['project', 'instance', 'branch', 'region']) {
        if (typeof options[key] !== 'string' || !options[key]) fail('Required target argument missing: ' + key);
    }
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(options.project)) fail('Invalid project identifier');
    if (!/^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(options.instance)) fail('Invalid database instance identifier');
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.branch)) fail('Invalid branch identifier');
    if (!REGIONS.has(options.region)) fail('Invalid or unsupported region');
    return { project: options.project, instance: options.instance, branch: options.branch, region: options.region };
}

function planAudit(options) {
    const target = targetOf(options);
    const action = options.action || (options.stageDir ? 'stage' : 'plan');
    if (!['plan', 'stage'].includes(action)) fail('Invalid action');
    if (action === 'stage' && !options.stageDir) fail('Stage requires --stage-dir');
    if (action === 'plan' && options.stageDir) fail('Plan does not accept a stage destination');
    if (options.stageDir && (typeof options.stageDir !== 'string' || !options.stageDir.trim() || /[\x00-\x1f\x7f]/.test(options.stageDir))) fail('Invalid stage destination');
    return {
        action,
        target,
        stageDir: options.stageDir ? path.resolve(options.stageDir) : null,
        functions: { source: 'functions', codebase: 'zoe-business-audit', runtime: 'nodejs22' },
        environmentKeys: ['ZOE_AUDIT_PROJECT_ID', 'ZOE_AUDIT_DATABASE_INSTANCE', 'ZOE_AUDIT_BRANCH_ID', 'ZOE_AUDIT_REGION'],
        deploymentPerformed: false,
        networkPerformed: false,
        apiOrBillingChangesPerformed: false
    };
}

function inspectPath(target, mustExist) {
    const absolute = path.resolve(target), parsed = path.parse(absolute);
    let current = parsed.root;
    for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        let info;
        try { info = fs.lstatSync(current); } catch (error) {
            if (error.code === 'ENOENT' && !mustExist && current === absolute) return false;
            fail('Stage path parent must already exist');
        }
        if (info.isSymbolicLink()) fail('Symlink paths are refused');
        if (!info.isDirectory()) fail('Stage path must be a directory');
    }
    return true;
}

function runtimeFiles(source) {
    if (!inspectPath(source, true)) fail('Runtime source unavailable');
    const entries = fs.readdirSync(source);
    for (const name of entries) {
        if (name === 'node_modules') continue;
        if (!RUNTIME_FILES.includes(name)) fail('Runtime contains unsupported source entry');
        const info = fs.lstatSync(path.join(source, name));
        if (!info.isFile() || info.isSymbolicLink()) fail('Runtime source must contain regular files');
    }
    if (RUNTIME_FILES.some(name => !entries.includes(name))) fail('Runtime source file missing');
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
        JSON.parse(fs.readFileSync(path.join(source, 'package-lock.json'), 'utf8'));
    } catch { fail('Runtime package manifest is invalid'); }
    if (manifest.main !== 'index.cjs' || String(manifest.engines?.node) !== '22') fail('Runtime package must target index.cjs on Node22');
    return RUNTIME_FILES.map(name => ({ name, contents: fs.readFileSync(path.join(source, name)) }));
}

function stageAudit(options) {
    const plan = planAudit(options);
    if (plan.action !== 'stage') return plan;
    const source = path.join(__dirname, 'business-audit-functions');
    const relative = path.relative(source, plan.stageDir);
    if (!relative || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) fail('Stage destination must be outside the runtime source');
    if (inspectPath(plan.stageDir, false)) fail('Stage destination already exists');
    const files = runtimeFiles(source);
    fs.mkdirSync(plan.stageDir, { mode: 0o700 });
    const functions = path.join(plan.stageDir, 'functions');
    fs.mkdirSync(functions, { mode: 0o700 });
    for (const file of files) fs.writeFileSync(path.join(functions, file.name), file.contents, { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(path.join(plan.stageDir, 'firebase.json'), JSON.stringify({ functions: plan.functions }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    const target = plan.target;
    const environment = 'ZOE_AUDIT_PROJECT_ID=' + target.project + '\nZOE_AUDIT_DATABASE_INSTANCE=' + target.instance
        + '\nZOE_AUDIT_BRANCH_ID=' + target.branch + '\nZOE_AUDIT_REGION=' + target.region + '\n';
    fs.writeFileSync(path.join(functions, '.env.' + target.project), environment, { mode: 0o600, flag: 'wx' });
    return plan;
}

if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2));
        const result = options.action === 'stage' ? stageAudit(options) : planAudit(options);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } catch (error) {
        process.stderr.write(JSON.stringify({ ok: false, code: error.code === 'audit-stage-refused' ? error.code : 'audit-stage-failed', error: error.code === 'audit-stage-refused' ? error.message : 'Local staging failed' }) + '\n');
        process.exitCode = 1;
    }
}

module.exports = { parseArgs, planAudit, stageAudit };
