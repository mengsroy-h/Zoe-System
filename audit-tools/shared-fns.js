let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.error('ត្រូវការ acorn — រត់ `npm i acorn` ជាមុនសិន (ឬកំណត់ NODE_PATH ទៅកន្លែងដែលបានដំឡើង)។');
    process.exit(2);
}
const fs = require('fs');
const path = require('path');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.SHAREDFNS_APP_DIR ? path.resolve(process.env.SHAREDFNS_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

const EXPECTED_DIVERGENT = new Set([
    'applySetupLinkFromUrl', 'atTop', 'attemptAuthStorageRecovery', 'cancelPinEntryFlow',
    'cancelPinSetupFlow', 'checkPinAndOpenConfig', 'closeModal', 'ensureAppActivated',
    'forceExpireSession', 'handleConfigQrResult', 'hashPin', 'hashPinLegacy',
    'initDatabaseListeners', 'initFirebase', 'isFirebaseSessionExpired', 'isPinFlowPending',
    'licenseFailureMessage',
    'loginWithFirebase', 'logoutApp', 'openConfigModal', 'openConfigQrScanner', 'openModalHelper',
    'requestPinBeforeConfig', 'retryPendingRoleCheck', 'sanitizePhoneNumber', 'saveFirebaseConfig',
    'saveNewSecurityPin',
    'setupAuthListener', 'setupIOSPullToRefresh', 'showLoginModalWithPrefill',
    'submitActivationKey', 'updateAuthButton', 'verifySecurityPin', 'verifyStoredPin',
    // normalizeFirebaseConfig · firebaseConfigErrorMessage ៖ ZoeW ទទួល Config **Supabase** ផង (backend អាជីវកម្ម ៖ `supabaseUrl` ➜
    // `normalizeSupabaseConfig()`) ចំណែក ZoeKeyGen ភ្ជាប់តែ License Project Firebase ➜ ផ្នែក Firebase ក្នុង function ទាំង ២ នៅដូចគ្នា
    // (`firebase-config-paste-test` វាស់សារកំហុសរបស់ App ទាំង ២ លើ input ដដែល)
    'normalizeFirebaseConfig', 'firebaseConfigErrorMessage',
    // ក្រយៅដៃ/មុខ ៖ ZoeKeyGen ទទួល **តែ** WebAuthn PRF (គ្មានរបៀបរក្សា PIN ធម្មតា ➜ `enrollBiometricRecord` ត្រឡប់ `unsupported`) ·
    // UI ជា DOM ផ្ទាល់ (`#pinBiometricBtn` · `#biometricToggleBtn`) ខណៈ ZoeW ជា state React + ផ្លូវ native (APK) · `completePinUnlock`
    // របស់ ZoeKeyGen ដេរីវេសោ Session របស់ Signing Key ➜ ឥរិយាបថរបស់ ZoeKeyGen វាស់ដោយ `keygen-biometric-test` · ZoeW ដោយ `biometric-unlock-test`
    'biometricPlatformAvailable', 'biometricUnlockPin', 'clearBiometricRecord', 'completePinUnlock', 'enrollBiometricRecord',
    'readBiometricRecord', 'refreshBiometricUi', 'runBiometricUnlock', 'setBiometricBusy', 'startBiometricEnrollment',
    'toggleBiometricUnlock',

    // ស្ថានភាពការតភ្ជាប់៖ **យន្តការភ្ជាប់ឡើងវិញរួមគ្នា** (forceDatabaseReconnect,
    // scheduleReconnectWatchdog, clearReconnectWatchdog, nudgeDatabaseConnection)
    // ត្រូវនៅដូចគ្នាបេះបិទ — ហើយវាដូចគ្នាពិត។ បី function ខាងក្រោមប៉ុណ្ណោះ
    // ដែលបែកគ្នាដោយចេតនា ព្រោះវាជាប់នឹង UI និងទិន្នន័យរបស់ App នីមួយៗ៖
    //   connectionLooksOnline  — ZoeW រាប់បញ្ចូល `dbListenersFailed` ផងដែរ
    //                            (វាមាន onValue លើទិន្នន័យអាជីវកម្ម; ZoeKeyGen
    //                            អានតាម `fb.get` មួយដងៗ ដូច្នេះគ្មានទង់នោះទេ)
    //   renderConnectionStatus — class និងអត្ថបទផ្ទុយគ្នា៖ ZoeW toggle `.offline`
    //                            ជាមួយ «ភ្ជាប់ Server រួចរាល់» ចំណែក ZoeKeyGen
    //                            toggle `.online` ជាមួយ «ភ្ជាប់បណ្ដាញ»
    //   setupConnectionRecovery — ZoeW ស្តារ listener ទិន្នន័យ; ZoeKeyGen ស្តារ
    //                            ការពិនិត្យតួនាទី admin (`retryPendingRoleCheck`)
    //   liveToastState         — សេចក្តីពិតដែល toast រស់ត្រូវរាយការណ៍ ខុសគ្នាតាម App៖
    //                            ZoeW មាន listener ទិន្នន័យ (`dbListenerPendingPaths`,
    //                            `dbListenersFailed`) ដូច្នេះវាបែងចែក «កំពុងទាញទិន្នន័យ»
    //                            ចេញពី «ភ្ជាប់រួច»; ZoeKeyGen អានតាម `fb.get` មួយដងៗ
    //                            ដូច្នេះវាមានតែស្ថានភាព socket ប៉ុណ្ណោះ។
    //   attachInfoListeners     — callback របស់ `.info/connected` ខុសគ្នាដោយចេតនា៖
    //                              ZoeW ស្តារ listener ទិន្នន័យ (`retryFailedDbListenersNow`)
    //                              ចំណែក ZoeKeyGen ស្តារការពិនិត្យតួនាទី admin
    //                              (`retryPendingRoleCheck`) ហើយដោះ `serverTimeSyncWaiters`។
    //                              ⛔ helper ៣ ផ្សេងទៀត (`scheduleInfoListenerRecovery` ·
    //                              `clearInfoListenerRecovery` · `handleInfoListenerError`)
    //                              ត្រូវនៅ byte-identical ទាំង ២ App។
    'connectionLooksOnline', 'renderConnectionStatus', 'setupConnectionRecovery', 'liveToastState',
    'attachInfoListeners',

    // ⛔ ZoeW ជា React (ZoeKeyGen នៅជា vanilla) ៖ helper ខាងក្រោមធ្វើការងារដដែល តែ ZoeW សរសេរ **view model ក្នុងឃ្លាំង**
    //    ដែល JSX គូរ ចំណែក ZoeKeyGen កែ DOM ផ្ទាល់ ➜ byte-identical មិនអាចទៅរួច។ ឥរិយាបថវាស់ដោយ checker របស់វា ៖
    //   toast (`showToast` · `paintToast` · `armToastDismiss` · `dropOldestToast` · `showLiveToast` · `settleLiveToast` ·
    //          `refreshLiveToasts`) — `uiState.toasts` ➜ `ToastList.tsx` (`toast-truth` · `toast-action-truth`)
    //   `anyModalIsOpen` — `openModalIds()` ពី `MODAL_IDS` (ស្ថានភាពប្រអប់ជា state) (`connection-recovery`)
    //   `hideBootSplash` · `showUpdateAvailableBanner` · `renderAppVersionLabels` — `viewState` ➜ JSX (`boot-animation` ·
    //          `version-check`)
    //   `fetchWithTimeout` — App Android បញ្ជូន `/.netlify/` តាម `resolveNativeApiUrl()` (web ៖ URL ដដែល) (`network-timeout`)
    'showToast', 'paintToast', 'armToastDismiss', 'dropOldestToast', 'showLiveToast', 'settleLiveToast',
    'refreshLiveToasts', 'anyModalIsOpen', 'hideBootSplash', 'showUpdateAvailableBanner', 'renderAppVersionLabels',
    'fetchWithTimeout'
]);

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, cb));
        else if (value && typeof value.type === 'string') walk(value, cb);
    }
}

const fns = {};
for (const app of APPS) {
    const src = fs.readFileSync(path.join(root, app, 'app.js'), 'utf8');
    walk(acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' }), (node) => {
        if (node.type !== 'FunctionDeclaration' || !node.id) return;
        const body = src.slice(node.start, node.end).split('\n').map((l) => l.trim()).join('\n');
        (fns[node.id.name] = fns[node.id.name] || {})[app] = body;
    });
}

const shared = Object.keys(fns).filter((n) => Object.keys(fns[n]).length >= 2).sort();
const unexpected = [];
let identical = 0;

for (const name of shared) {
    const where = Object.keys(fns[name]);
    const uniq = new Set(where.map((a) => fns[name][a]));
    if (uniq.size === 1) { identical++; continue; }
    if (EXPECTED_DIVERGENT.has(name)) continue;
    unexpected.push(name + '  (' + where.join(', ') + ')');
}

console.log('shared by >=2 apps: ' + shared.length +
    '   identical: ' + identical +
    '   expected-divergent: ' + (shared.length - identical - unexpected.length) +
    '   UNEXPECTED: ' + unexpected.length);

if (unexpected.length) {
    console.log('\nUNEXPECTED DRIFT (a shared helper that should be one implementation):');
    unexpected.forEach((line) => console.log('  - ' + line));
    console.log('\nរត់ `node audit-tools/shared-fns.js --show <name>` ដើម្បីមើលកូដទាំងអស់ជាប់គ្នា។');
    process.exitCode = 1;
} else {
    console.log('\n✅ គ្មានការបែកគ្នាដែលមិនរំពឹងទុកទេ');
}

const showIdx = process.argv.indexOf('--show');
if (showIdx !== -1) {
    process.argv.slice(showIdx + 1).forEach((name) => {
        console.log('\n########## ' + name + ' ##########');
        APPS.forEach((app) => {
            if (!fns[name] || !fns[name][app]) return;
            console.log('--- ' + app + ' ---');
            console.log(fns[name][app]);
        });
    });
}
