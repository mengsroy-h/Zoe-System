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
        + sliceFn(source, 'lookupApiIsZto') + '\n' + sliceFn(source, 'lookupApiIsPalm') + '\n'
        + ['shopScope', 'sameShop', 'shopOwnsSetting'].map((name) => sliceFnOptional(source, name)).join('\n') + '\n'
        + sliceFn(source, 'lookupApiSendsHeader') + '\n'
        // X4 ៖ key Apps Script អ៊ិនគ្រីប (`urlKeyEnc`) ➜ helper បំបែក/ភ្ជាប់ key និងកំណត់ចំណាំប្រអប់ (ក្រៅជួរដែលកាត់)
        + ['lookupSetupSecretName', 'lookupUrlSecretParams', 'lookupUrlSplitKey', 'lookupUrlWithKey', 'lookupKeyedUrl', 'lookupSecretLocked'].map((name) => sliceFnOptional(source, name)).join('\n') + '\n'
        + ((source.match(/\n\s*const LOOKUP_URL_KEY_NOTE = [^\n]+;/) || [''])[0]) + '\n'
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
        authGeneration: 0,
        encryptLookupSecret: encrypt,
        clearCustomerDataTableCache: () => {},
        clearZtoPickupStatusStore: () => {},
        prefetchCustomerDataTableRowsIfConfigured: () => {},
        closeModal: () => {},
        refreshZtoAutoCloseUi: () => {},
        refreshZtoListSyncUi: () => {},
        refreshShopBoundUi: () => {},
        showToast: () => {},
        alert: (message) => alerts.push(String(message)),
        queueMicrotask
    });
    // ⛔ ស្រទាប់ React (`fieldValue` · `fieldChecked` · ប្រអប់) — កូដពិតពីទិដ្ឋភាពដដែល (`react-view.js`)
    vm.runInContext(reactRuntime(source, { context, exclude: ['appLocalStore', 'appSessionStore'] }), context);
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
    // ⛔ Phase B ជុំ ៥ (គ្មាន compat មុន launch) ៖ គ្មាន helper បម្លែង Secret ចាស់ (Header ធម្មតា · key Apps Script ធម្មតាក្នុង URL) ទៀតទេ ហើយ
    //    ផ្លូវដោះសោ PIN មិនហៅវា ➜ Secret ក្នុង storage មានតែទម្រង់អ៊ិនគ្រីប (`headerValueEnc` · `urlKeyEnc`) ដែលរក្សាទុកដោយប្រអប់ ឬ Setup Link។
    check(!/function\s+migrateLookupSecretIfNeeded\s*\(/.test(appSource), 'Lookup config: គ្មាន helper បម្លែង Secret ចាស់');
    const unlockSources = ['saveNewSecurityPin', 'completePinUnlock', 'completeAppUnlock']
        .map((name) => sliceFnOptional(appSource, name)).join('\n');
    check(unlockSources.length > 0 && !/migrateLookupSecret/.test(unlockSources),
        'Lookup config: ផ្លូវដោះសោ PIN មិនផ្លាស់ Secret ធម្មតា (រកឃើញផ្លូវ ' + ['saveNewSecurityPin', 'completePinUnlock', 'completeAppUnlock'].filter((name) => sliceFnOptional(appSource, name)).length + ')');

    const legacy = { enabled: false, autoSubmit: false, url: '', headerName: 'Authorization', headerValue: 'legacy-secret', phoneField: 'phone', codField: 'cod', dodField: 'dod' };
    const noKey = createRuntime(legacy, null, async () => { throw new Error('should not encrypt'); });
    await noKey.context.saveConfig();
    const dropped = JSON.parse(noKey.storage.get('zoew_lookup_api_config'));
    check(!Object.prototype.hasOwnProperty.call(dropped, 'headerValue') && !dropped.headerValueEnc && noKey.alerts.length === 0,
        'Lookup config: រក្សាទុកដោយគ្មានសោ PIN ➜ Header ធម្មតាចាស់មិនសល់ក្នុង storage (គ្មាន compat)', JSON.stringify({ dropped, alerts: noKey.alerts }));

    const encrypted = [];
    const withKey = createRuntime(legacy, { key: true }, async (value) => { encrypted.push(value); return `enc:${value}`; });
    await withKey.context.saveConfig();
    const notMigrated = JSON.parse(withKey.storage.get('zoew_lookup_api_config'));
    check(!Object.prototype.hasOwnProperty.call(notMigrated, 'headerValue') && !notMigrated.headerValueEnc && encrypted.length === 0,
        'Lookup config: រក្សាទុកមានសោ PIN ➜ Header ធម្មតាចាស់មិនត្រូវអ៊ិនគ្រីប ឬរក្សា', JSON.stringify({ notMigrated, encrypted }));

    const typedNoKey = createRuntime(legacy, null, async () => 'unexpected');
    typedNoKey.elements.lookupApiHeaderValueInput.value = 'replacement-secret';
    await typedNoKey.context.saveConfig();
    const blocked = JSON.parse(typedNoKey.storage.get('zoew_lookup_api_config'));
    check(blocked.headerValue === 'legacy-secret' && !blocked.headerValueEnc && typedNoKey.alerts.length === 1,
        'Lookup config: Secret ដែលវាយដោយគ្មានសោ PIN ➜ បដិសេធ (alert) មិនសរសេរអ្វី', JSON.stringify({ blocked, alerts: typedNoKey.alerts }));

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
