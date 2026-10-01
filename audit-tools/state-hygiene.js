const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const ROOT = process.env.STATEHYG_APP_DIR ? path.resolve(process.env.STATEHYG_APP_DIR) : path.resolve(__dirname, '..');

// ⚠️ App `ZoeImport` ត្រូវលុបចេញពី repo ក្នុងកំណែ 2.21.0 — មុខងារនាំចូល
// របស់វាផ្លាស់ចូល **ZoeW ផ្ទាល់**។ ដូច្នេះ **ពាក្យសម្ងាត់នាំចូល**
// (`sheetImportPassword`) និង **កូនសោ AES** (`sheetImportKey`) ព្រមទាំងវាល
// `siApiPasswordInput` ក្នុង DOM ឥឡូវរស់នៅក្នុង `ZoeW/app.js` ➜ ការស្កេន
// ZoeW គ្របពួកវារួចហើយ។ ⛔ កុំបន្ថយវិសាលភាពនៃឯកសារដែលស្កេន — នោះជាថ្នាក់
// «checker ស្កេនឯកសារណាខ្លះ» ដដែលនឹង 2.12.1 · 2.16.0 · 2.19.1។
const APPS = {
    ZoeW: { reset: ['showLoginModalWithPrefill', 'clearSensitiveModalFields'] },
    ZoeKeyGen: { reset: ['showLoginModalWithPrefill', 'clearSigningKey'] }
};

const ACCEPTED = {
    ZoeW: {
        firebaseConfig: 'device provisioning, survives logout by design',
        fb: 'SDK handle, not user data',
        auth: 'SDK handle, reused by the next login',
        db: 'SDK handle, reused by the next login',
        dbRefConnected: 'kept live so the next session reuses the connection listener',
        dbRefServerTimeOffset: 'kept live to keep getServerNow accurate',
        dbRefHistory: 'ref object, detached via fb.off; holds no data',
        dbRefDeleted: 'ref object, detached via fb.off; holds no data',
        dbRefDailyRevenue: 'ref object, detached via fb.off; holds no data',
        dbRefMonthlyRevenue: 'ref object, detached via fb.off; holds no data',
        dbRefDailyPickup: 'ref object, detached via fb.off; holds no data',
        dbRefExchangeRate: 'ref object, detached via fb.off; holds no data',
        authUnsubscribe: 'the listener must survive logout to see the next login',
        authRecoveryTimeout: 'cleared in the auth callback itself',
        authGeneration: 'monotonic counter, resetting it would break generation guards',
        documentHiddenAt: 'page-visibility timestamp used only to measure time spent in the background before a database liveness probe; it describes the device tab, not the user, and holds no customer data',
        sessionExpiryCheckInFlight: 'bounded request mutex that settles in finally; keeping it through logout prevents an old request from overlapping the next session and it holds no user data',
        licenseRecheckInFlight: 'bounded request mutex that settles in finally; keeping it through logout prevents an old request from overlapping the next session and it holds no user data',
        exchangeRateSaveInFlight: 'bounded Firebase write mutex that settles in finally or its late handlers; retaining it across logout prevents an older rate write from racing a newer session and it holds no customer data',
        sessionExpiryCheck: 'the 4-hour session verdict for the CURRENT user; forceExpireSession sets it to "expired" and showLoginModalWithPrefill runs inside that path, so resetting it there would erase the very fact the login toast must report. proceedAfterLogin re-arms it to "pending" on the next sign-in',
        exchangeRateRiel: 'business config, not user data; mirrored in localStorage',
        serverTimeOffsetMs: 'clock offset, not user data',
        isInitializingFirebase: 'init mutex, unrelated to session',
        lastEnteredLocker: 'operator convenience, persisted in localStorage by design',
        currentFilterMode: 'view preference, no customer data',
        customFilterDate: 'view preference, no customer data',
        lastScannedCode: 'debounce state, cleared by scanner teardown',
        lastScanTime: 'debounce state',
        codeReader: 'scanner handle, torn down by cleanupResources',
        liveScanCodeReader: 'scanner handle, torn down by cleanupResources',
        scanVideoResumeTimer: 'a 150ms setTimeout handle that always fires and nulls itself; also cleared by stopCurrentStream',
        currentStream: 'camera handle, torn down by stopCurrentStream',
        currentVideoTrack: 'camera handle, torn down by stopCurrentStream',
        nativeDetector: 'stateless decoder instance',
        pendingLoadedMetadataHandler: 'camera handle, torn down by stopCurrentStream',
        globalAudioCtx: 'audio handle, no user data',
        ownCaptureCanvas: 'scratch canvas, overwritten on next frame',
        ownCaptureCtx: 'scratch canvas context',
        searchTimer: 'debounce timer, no user data',
        isVerifyingPin: 'reset by the PIN flow itself',
        configQrReader: 'torn down by closeConfigQrScanner',
        configQrImageSeq: 'ជំនាន់នៃការឌិកូដ QR ពីរូបភាព — លេខរាប់ឡើងសុទ្ធ (គ្មានទិន្នន័យ) ៖ ការរស់រានក្រោយចាកចេញធ្វើឲ្យការឌិកូដចាស់ដែលកំពុងហោះ **មិនត្រូវ** បំពេញប្រអប់ (ការ reset វិញនឹងបើកវាឡើងវិញ)',
        configQrScanActive: 'reset by closeConfigQrScanner',
        lookupLockedNoticeShown: 'one-shot notice flag, no user data',
        autoLookupLastFailedAt: 'cooldown timestamp, no user data',
        customerDataTableFetchedAt: 'cleared via clearCustomerDataTableCache',
        customerDataTableRows: 'cleared via clearCustomerDataTableCache',
        customerDataTableFetchPromise: 'cleared via clearCustomerDataTableCache',
        customerDataTableSessionGeneration: 'monotonic guard counter',
        customerDataTableLastFailedAt: 'cooldown timestamp, no user data',
        isModalOpen: 'recomputed from the DOM on every closeModal',
        phoneModalDismissPromptOpen: 'single-tick reentrancy guard',
        isCameraScanning: 'reset by stopCurrentStream',
        isCameraStarting: 'reset by stopCurrentStream',
        cameraRequestId: 'monotonic guard counter',
        nativeLoopActive: 'reset by stopCurrentStream',
        zxingLoopActive: 'reset by stopCurrentStream',
        liveScanWidthIndex: 'scanner quality step, reset by resetLiveScanQuality inside stopCurrentStream',
        liveScanCostEma: 'rolling decode cost in ms, reset by resetLiveScanQuality inside stopCurrentStream',
        lastDecodedVideoTime: 'last decoded video frame stamp, reset by resetLiveScanQuality inside stopCurrentStream',
        staleFrameStreak: 'counter for the fresh-frame gate, reset by resetLiveScanQuality inside stopCurrentStream',
        freshFrameGateUsable: 'browser capability flag for video.currentTime, reset by resetLiveScanQuality inside stopCurrentStream',
        perfSamplePending: 'frame-pace sampler mutex, clears itself when the sample finishes',
        displayRateSampling: 'drawer frame-rate sampler mutex (device property, no user data), clears itself after DISPLAY_RATE_SAMPLES frames or when requestAnimationFrame throws',
        displayHz: 'measured display refresh rate, a device property not user data',
        displayHzMeasured: 'flag saying the refresh rate has been measured; a device property',
        torchOn: 'reset by stopCurrentStream',
        autoLoginAttempted: 'dead variable, never read',
        isDatabaseConnected: 'live connection state, not user data',
        isDatabaseInitialized: 'reset in the sign-out branch itself',
        pdfExportOriginalTitle: 'reset by restoreAfterPdfExport',
        lastRecallSignature: 'only suppresses a redundant re-render; login always does a full render anyway',
        pendingHistoryViewRefresh: 'a 0ms setTimeout handle that always fires and nulls itself',
        activeEditingBarcode: 'barcode label only; modal field blanked on logout',
        editingItemId: 'cleared by closeModal when editPhoneModal itself closes, and whenever the modal stack empties; the logout path closes every modal in a loop so the last close clears it (locked by lookup-prefetch-test scenario "chakchenh")',
        markingItemId: 'cleared by closeModal when callMarkModal itself closes, and whenever the modal stack empties; same logout loop as editingItemId',
        pendingBarcode: 'cleared by closeModal when phoneModal itself closes, and whenever the modal stack empties; same logout loop as editingItemId',
        scanHistory: 'cleared in the sign-out branch itself',
        deletedItems: 'cleared in the sign-out branch itself',
        dailyRevenueData: 'cleared in the sign-out branch itself',
        monthlyRevenueData: 'cleared in the sign-out branch itself',
        dailyPickupData: 'cleared in the sign-out branch itself',
        activeLocker: 'operator convenience, persisted in localStorage by design',
        entryScanMode: 'view preference, persisted in localStorage by design',
        currentAppPage: 'view preference, no customer data',
        lockerAssignGeneration: 'monotonic guard counter',
        appIsLocked: 'app-lock screen state, recomputed from scratch by initAppLock() on every page load; it guards a screen shown BEFORE sign-in, so it holds no customer data. Resetting it on logout would visually unlock a locked screen',
        appLockBusy: 'reentrancy guard for the unlock button; cleared by setAppLockBusy(false) in the finally of every unlock path',
        // ⛔ React ៖ ស្រទាប់ឃ្លាំង (`core/store.ts`) — មិនមែនទិន្នន័យអតិថិជន
        immediateCommit: 'React store plumbing: the commitNow() hook registered once by the React layer (a function, no customer data)',
        immediateDepth: 'React store plumbing: reentrancy depth of commitImmediately(), always back to 0 in its finally (a number, no customer data)',
        pendingInvite: 'Supabase invite code from the Setup Link (device provisioning, like firebaseConfig): showLoginModalWithPrefill() — the logout path itself — reads it to open the register form, so clearing it there would break registration; cleared by clearPendingInvite() once registration succeeds'
    }
};
ACCEPTED.ZoeKeyGen = Object.assign({}, ACCEPTED.ZoeW, {
    isGeneratingKey: 'reset by generateLicenseKey itself',
    generateAlreadyTimedOut: 'reset by generateLicenseKey itself',
    keyListSessionGeneration: 'monotonic guard counter',
    extendTargetId: 'key id only, modal blanked on logout',
    isSignedInUiActive: 'reset in showLoginModalWithPrefill itself',
    keypairPrivateCopied: 'reset in showLoginModalWithPrefill itself',
    serverTimeSyncedAt: 'clock sync timestamp, not user data',
    serverTimeSyncWaiters: 'each waiter has its own timeout and an idempotent finish(); never blocks',
    serverTimeSynced: 'clock sync flag, not user data',
    lastGeneratedKey: 'reset in showLoginModalWithPrefill itself',
    lastGeneratedSetupLink: 'reset in showLoginModalWithPrefill itself',
    keyListCache: 'reset in showLoginModalWithPrefill itself'
});

function parse(src) {
    return acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
}

function collectModuleStateVars(ast) {
    const names = new Map();
    const scan = (body) => {
        body.forEach((node) => {
            if (node.type === 'VariableDeclaration' && node.kind !== 'const') {
                node.declarations.forEach((d) => {
                    if (d.id.type === 'Identifier') names.set(d.id.name, node.start);
                });
            }
            if (node.type === 'ExpressionStatement' &&
                node.expression.type === 'CallExpression' &&
                (node.expression.callee.type === 'FunctionExpression' ||
                 (node.expression.callee.type === 'ParenthesizedExpression'))) {
                // top-level IIFE: skip, its vars are private
            }
        });
    };
    scan(ast.body);
    return names;
}

function indexFunctions(ast) {
    const fns = new Map();
    const walk = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'FunctionDeclaration' && node.id) fns.set(node.id.name, node);
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c));
            else if (v && typeof v.type === 'string') walk(v);
        }
    };
    walk(ast);
    return fns;
}

function collectAssignedAndCalled(node, assigned, called) {
    const walk = (n) => {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') assigned.add(n.left.name);
        if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') assigned.add(n.argument.name);
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier') called.add(n.callee.name);
        for (const k of Object.keys(n)) {
            const v = n[k];
            if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c));
            else if (v && typeof v.type === 'string') walk(v);
        }
    };
    walk(node);
}

let failed = 0;
for (const [appName, cfg] of Object.entries(APPS)) {
    const file = path.join(ROOT, appName, 'app.js');
    const src = fs.readFileSync(file, 'utf8');
    const ast = parse(src);
    const stateVars = collectModuleStateVars(ast);
    const fns = indexFunctions(ast);

    const assigned = new Set();
    const seen = new Set();
    const queue = [...cfg.reset];
    // also treat the sign-out branch of the auth listener as reset code
    const signOutMarkers = ['setupAuthListener', 'initFirebase'];
    signOutMarkers.forEach((m) => queue.push(m));
    while (queue.length) {
        const name = queue.shift();
        if (seen.has(name)) continue;
        seen.add(name);
        const fn = fns.get(name);
        if (!fn) continue;
        const called = new Set();
        collectAssignedAndCalled(fn.body, assigned, called);
        called.forEach((c) => { if (fns.has(c) && !seen.has(c)) queue.push(c); });
    }

    const accepted = ACCEPTED[appName] || {};
    const missing = [];
    for (const name of stateVars.keys()) {
        if (assigned.has(name)) continue;
        if (accepted[name]) continue;
        missing.push(name);
    }
    console.log(`--- ${appName} --- module state vars: ${stateVars.size}   reset somewhere in the logout path: ${[...stateVars.keys()].filter((n) => assigned.has(n)).length}   documented-accepted: ${[...stateVars.keys()].filter((n) => !assigned.has(n) && accepted[n]).length}`);
    if (missing.length) {
        failed += missing.length;
        missing.forEach((m) => console.log(`   ⚠️  ${m}  — neither reset on logout nor documented in ACCEPTED`));
    }
}

if (failed) {
    console.log(`\n❌ ${failed} state variable(s) survive logout with no documented reason.`);
    process.exit(1);
}
console.log('\n✅ គ្មានអថេរ state ណាដែលរស់រានក្រោយចាកចេញ ដោយគ្មានហេតុផលកត់ត្រាទេ');
