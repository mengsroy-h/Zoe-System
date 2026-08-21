const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

function createRuntime(existing, key, encrypt) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'ZoeAdmin', 'app.js'), 'utf8');
    const start = source.indexOf('    function getLookupApiConfig() {');
    const end = source.indexOf('    async function testLookupApiConfig(', start);
    if (start === -1 || end === -1) throw new Error('lookup config functions not found');
    const code = source.slice(start, end);
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
            setItem: (name, value) => storage.set(name, String(value))
        },
        lookupSecretKey: key,
        encryptLookupSecret: encrypt,
        closeModal: () => {},
        showToast: () => {},
        alert: (message) => alerts.push(String(message))
    });
    new vm.Script(`${code}\nglobalThis.saveConfig = saveLookupApiConfig;`).runInContext(context);
    return { context, storage, elements, alerts };
}

(async () => {
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

    console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
});
