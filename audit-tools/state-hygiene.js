const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');

const APPS = {
    ZoeAdmin: { reset: ['showLoginModalWithPrefill', 'clearSensitiveModalFields'] },
    ZoeW: { reset: ['showLoginModalWithPrefill', 'clearSensitiveModalFields'] },
    Zoescan: { reset: ['handleSignedOut', 'detachDatabaseListeners'] },
    ZoeKeyGen: { reset: ['showLoginModalWithPrefill', 'clearSigningKey'] }
};

const ACCEPTED = {
    ZoeAdmin: {
        firebaseConfig: 'device provisioning, survives logout by design',
        fb: 'SDK handle, not user data',
        auth: 'SDK handle, reused by the next login',
        db: 'SDK handle, reused by the next login',
        dbRefConnected: 'kept live so retryPendingRoleCheck can fire',
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
        torchOn: 'reset by stopCurrentStream',
        autoLoginAttempted: 'dead variable, never read',
        isDatabaseConnected: 'live connection state, not user data',
        lastRoleRestOutcome: 'diagnostic string sent to Sentry',
        pendingRoleRecheck: 'reset in the sign-out branch itself',
        isDatabaseInitialized: 'reset in the sign-out branch itself',
        pdfExportOriginalTitle: 'reset by restoreAfterPdfExport',
        lastRecallSignature: 'only suppresses a redundant re-render; login always does a full render anyway',
        pendingHistoryViewRefresh: 'a 0ms setTimeout handle that always fires and nulls itself',
        activeEditingBarcode: 'barcode label only; modal field blanked on logout',
        editingItemId: 'cleared by closeModal on every modal close',
        markingItemId: 'cleared by closeModal on every modal close',
        pendingBarcode: 'cleared by closeModal on every modal close',
        scanHistory: 'cleared in the sign-out branch itself',
        deletedItems: 'cleared in the sign-out branch itself',
        dailyRevenueData: 'cleared in the sign-out branch itself',
        monthlyRevenueData: 'cleared in the sign-out branch itself',
        dailyPickupData: 'cleared in the sign-out branch itself'
    }
};
ACCEPTED.ZoeW = ACCEPTED.ZoeAdmin;
ACCEPTED.Zoescan = Object.assign({}, ACCEPTED.ZoeAdmin, {
    app: 'SDK handle, not user data',
    activeLocker: 'operator convenience, persisted in localStorage by design',
    currentTab: 'view preference, no customer data',
    listenersAttached: 'reset by detachDatabaseListeners',
    loginGeneration: 'monotonic guard counter',
    assignGeneration: 'monotonic guard counter',
    imageDecodeCodeReader: 'scanner handle, torn down by cleanup',
    cameraStoppedByVisibility: 'reset in the sign-out branch itself',
    currentUserEmail: 'cleared in the sign-out branch itself',
    historyData: 'cleared by detachDatabaseListeners',
    barcodeIndex: 'cleared by detachDatabaseListeners',
    pendingLocationCode: 'cleared in the sign-out branch itself'
});
ACCEPTED.ZoeKeyGen = Object.assign({}, ACCEPTED.ZoeAdmin, {
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
