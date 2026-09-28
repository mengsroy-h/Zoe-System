const fs = require('fs');
const path = require('path');
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const APP_ROOT = process.env.LOOKUPSEC_APP_DIR ? path.resolve(process.env.LOOKUPSEC_APP_DIR) : path.resolve(__dirname, '..');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

let pass = 0;
let fail = 0;

function check(condition, label, detail) {
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
    }
}

function sliceFn(source, name) {
    let start = source.indexOf('function ' + name + '(');
    if (start === -1) throw new Error('not found: ' + name);
    if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, started = false, i = source.indexOf('{', start);
    for (; i < source.length; i++) {
        if (source[i] === '{') { depth++; started = true; }
        else if (source[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return source.slice(start, i);
}

function sliceFnOptional(source, name) {
    try { return sliceFn(source, name); } catch (e) { return ''; }
}

function createRuntime(existing, key, encrypt, failStorage) {
    const source = fs.readFileSync(path.join(APP_ROOT, 'ZoeW', 'app.js'), 'utf8');
    const start = source.indexOf('    function getLookupApiConfig() {');
    const end = source.indexOf('    async function testLookupApiConfig(', start);
    if (start === -1 || end === -1) throw new Error('lookup config functions not found');
    // ⛔ រាល់ឈ្មោះដែល sandbox *ហៅ* ត្រូវមានក្នុង sandbox — helper ទាំងនេះ
    //    រស់នៅក្រៅជួរដែលកាត់ ➜ ត្រូវចាក់ចូលដោយឈ្មោះ។
    const code = sliceFn(source, 'safeStoreSet') + '\n' + sliceFn(source, 'safeStoreRemove') + '\n'
        + sliceFn(source, 'safeStoreGet') + '\n'
        + sliceFn(source, 'lookupApiIsAppsScript') + '\n'
        + sliceFn(source, 'lookupApiSendsHeader') + '\n'
        + source.slice(start, end);
    const storage = new Map();
    storage.set('zoew_lookup_api_config', JSON.stringify(existing));
    const elements = {
        lookupApiEnabledCheckbox: { checked: false },
        lookupApiAutoSubmitCheckbox: { checked: false },
        lookupApiUrlInput: { value: '' },
        lookupApiHeaderNameInput: { value: 'Authorization' },
        lookupApiHeaderValueInput: { value: '' },
        lookupApiPhoneFieldInput: { value: 'phone' },
        lookupApiCodFieldInput: { value: 'cod' },
        lookupApiDodFieldInput: { value: 'dod' }
    };
    const alerts = [];
    const context = vm.createContext({
        document: { getElementById: (id) => elements[id] || null },
        localStorage: {
            getItem: (name) => storage.has(name) ? storage.get(name) : null,
            setItem: (name, value) => {
                if (failStorage) throw new Error('QuotaExceededError');
                storage.set(name, String(value));
            },
            removeItem: (name) => { storage.delete(name); }
        },
        lookupSecretKey: key,
        encryptLookupSecret: encrypt,
        clearCustomerDataTableCache: () => {},
        clearZtoPickupStatusStore: () => {},
        prefetchCustomerDataTableRowsIfConfigured: () => {},
        closeModal: () => {},
        refreshZtoAutoCloseUi: () => {},
        refreshZtoListSyncUi: () => {},
        showToast: () => {},
        alert: (message) => alerts.push(String(message)),
        queueMicrotask
    });
    // ⛔ ស្រទាប់ React (`fieldValue` · `fieldChecked` · ប្រអប់) — កូដពិតពីទិដ្ឋភាពដដែល (`react-view.js`)
    vm.runInContext(reactRuntime(source, { context }), context);
    // ⛔ កំណែ 2.22.5 ៖ កូដ ship ចូលប្រើ storage តាម shim `appLocalStore` /
    // `appSessionStore` (អាន `window.localStorage` ក្នុង `try` តែម្តង ព្រោះ
    // **getter ខ្លួនវាបោះ** ពេល browser បិទ site data)។
    vm.runInContext('var appLocalStore = typeof localStorage !== "undefined" ? localStorage : null;'
        + ' var appSessionStore = typeof sessionStorage !== "undefined" ? sessionStorage : null;', context);
    new vm.Script(`${code}\nglobalThis.saveConfig = saveLookupApiConfig;`).runInContext(context);
    return { context, storage, elements, alerts };
}

(async () => {
    const appSource = fs.readFileSync(path.join(APP_ROOT, 'ZoeW', 'app.js'), 'utf8');
    const migrateSource = sliceFnOptional(appSource, 'migrateLookupSecretIfNeeded');
    check(!!migrateSource, 'Lookup config: មាន helper បម្លែង Secret ចាស់ដោយស្វ័យប្រវត្តិ');
    const unlockSources = ['saveNewSecurityPin', 'completePinUnlock', 'completeAppUnlock']
        .map((name) => sliceFnOptional(appSource, name)).join('\n');
    check((unlockSources.match(/migrateLookupSecretIfNeeded\(/g) || []).length === 3,
        'Lookup config: រាល់ផ្លូវដោះសោ PIN បម្លែង plaintext Secret ភ្លាមៗ');

    if (migrateSource) {
        const storage = new Map([['zoew_lookup_api_config', JSON.stringify({
            enabled: true,
            headerName: 'X-Zoe-Proxy-Key',
            headerValue: 'legacy-secret'
        })]]);
        const context = vm.createContext({
            appLocalStore: {
                getItem: (name) => storage.get(name) || null,
                setItem: (name, value) => storage.set(name, String(value))
            },
            lookupSecretKey: { key: true },
            encryptLookupSecret: async (value) => ({ sealed: value })
        });
        const runtimeCode = sliceFn(appSource, 'safeStoreSet') + '\n' + sliceFn(appSource, 'getLookupApiConfig')
            + '\n' + migrateSource + '\nthis.runMigration = migrateLookupSecretIfNeeded;';
        vm.runInContext(runtimeCode, context);
        const changed = await context.runMigration();
        const stored = JSON.parse(storage.get('zoew_lookup_api_config'));
        check(changed === true && stored.headerValueEnc && !Object.prototype.hasOwnProperty.call(stored, 'headerValue'),
            'Lookup config: ដោះសោ PIN ម្តង ➜ plaintext Secret ត្រូវបានលុបចេញពី storage', JSON.stringify(stored));
    }

    const legacy = { enabled: false, autoSubmit: false, url: '', headerName: 'Authorization', headerValue: 'legacy-secret', phoneField: 'phone', codField: 'cod', dodField: 'dod' };
    const noKey = createRuntime(legacy, null, async () => { throw new Error('should not encrypt'); });
    await noKey.context.saveConfig();
    const preserved = JSON.parse(noKey.storage.get('zoew_lookup_api_config'));
    check(preserved.headerValue === 'legacy-secret' && !preserved.headerValueEnc && noKey.alerts.length === 0,
        'Lookup config: unrelated save preserves legacy headerValue when no PIN key is available', JSON.stringify({ preserved, alerts: noKey.alerts }));

    const migrate = createRuntime(legacy, { key: true }, async (value) => `enc:${value}`);
    await migrate.context.saveConfig();
    const migrated = JSON.parse(migrate.storage.get('zoew_lookup_api_config'));
    check(migrated.headerValueEnc === 'enc:legacy-secret' && !Object.prototype.hasOwnProperty.call(migrated, 'headerValue'),
        'Lookup config: legacy headerValue migrates only after successful encryption', JSON.stringify(migrated));

    const typedNoKey = createRuntime(legacy, null, async () => 'unexpected');
    typedNoKey.elements.lookupApiHeaderValueInput.value = 'replacement-secret';
    await typedNoKey.context.saveConfig();
    const blocked = JSON.parse(typedNoKey.storage.get('zoew_lookup_api_config'));
    check(blocked.headerValue === 'legacy-secret' && typedNoKey.alerts.length === 1,
        'Lookup config: typed secret without PIN key is rejected without losing the existing legacy value', JSON.stringify({ blocked, alerts: typedNoKey.alerts }));

    // ⛔ ផ្លូវស្នូល ៖ មានសោ PIN ហើយអ្នកប្រើវាយ Secret **ថ្មី** ➜ រក្សាទុកតែទម្រង់អ៊ិនគ្រីប (គ្មាន plaintext ថ្មី
    //    ឬចាស់សល់)។ មុននេះគ្មានសេណារីយ៉ូណាដាក់ Secret ថ្មីជាមួយសោ ➜ mutation «រក្សា plaintext ផង» រស់រាន។
    // ⛔ ការអ៊ិនគ្រីបក្លែងត្រឡប់ token **ស្រអាប់** ➜ អត្ថបទ Secret ណាមួយក្នុង storage = plaintext ពិត
    const sealedTokens = [];
    const typedWithKey = createRuntime(legacy, { key: true }, async (value) => {
        const token = 'sealed#' + sealedTokens.length;
        sealedTokens.push(value);
        return token;
    });
    typedWithKey.elements.lookupApiHeaderValueInput.value = 'replacement-secret';
    await typedWithKey.context.saveConfig();
    const sealedRaw = typedWithKey.storage.get('zoew_lookup_api_config');
    const sealed = JSON.parse(sealedRaw);
    check(sealedTokens[sealed.headerValueEnc === undefined ? -1 : Number(String(sealed.headerValueEnc).split('#')[1])] === 'replacement-secret'
        && !Object.prototype.hasOwnProperty.call(sealed, 'headerValue')
        && sealedRaw.indexOf('replacement-secret') === -1 && sealedRaw.indexOf('legacy-secret') === -1,
        'Lookup config: Secret ថ្មីជាមួយសោ PIN ➜ រក្សាទុកតែទម្រង់អ៊ិនគ្រីប (គ្មាន plaintext)', JSON.stringify(sealed));

    const quota = createRuntime(legacy, { key: true }, async (value) => `enc:${value}`, true);
    let closed = false;
    quota.context.closeModal = () => { closed = true; };
    await quota.context.saveConfig();
    check(quota.alerts.length === 1 && !closed,
        'Lookup config: localStorage ដែលពេញ ➜ ប្រាប់អ្នកប្រើ ហើយមិនបិទប្រអប់ (មិន throw)', JSON.stringify({ alerts: quota.alerts, closed }));

    console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
});
