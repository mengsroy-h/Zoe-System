// ថ្នាក់កំហុស៖ **ការសម្រេចលើ retention/revenue ធ្វើតាមនាឡិកា *ឧបករណ៍* ជំនួសនាឡិកា server។**
//
// បង្អួច ២ ម៉ោង · ៨ ថ្ងៃ · ១៥ ថ្ងៃ សុទ្ធតែប្រៀបធៀប timestamp ធៀបនឹង «ឥឡូវ»។ បើ
// «ឥឡូវ» នោះជា `Date.now()` ឆៅ នោះឧបករណ៍ដែលនាឡិកាខុស (ដែលកើតឡើងពិតលើទូរស័ព្ទ
// ដែលបិទ «កាលបរិច្ឆេទស្វ័យប្រវត្តិ») នឹង៖
//   · ផ្លាស់កញ្ចប់ចូលធុងសំរាម **មុនពេល** ឬ **យឺតជាង** ការពិត
//   · ដកលុយចេញពីស្ថិតិដោយផ្អែកលើបង្អួចដែលមិនទាន់ដល់
// ហើយ **គ្មានអ្វីក្នុង rules ចាប់វាបានទេ** ព្រោះ payload នៅត្រឹមត្រូវតាម schema។
//
// ច្បាប់គម្រោង (CLAUDE.md ➜ «នាឡិកា»)៖ រាល់ timestamp ដែលចូលរួមក្នុងការសម្រេច
// retention/revenue ត្រូវមកពី `getServerNow()`; timer ដែលជា **cosmetic/local
// សុទ្ធសាធ** (PIN lockout · scan debounce · TTL cache · deadline ផ្ទុក script ·
// ចង្វាក់ស៊ុម) នៅតែប្រើ `Date.now()` ឆៅ **ដោយចេតនា**។
//
// ⚠️ មេរៀនដែលកត់ទុកក្នុង CLAUDE.md៖ **ការស្វែងរកតែ `Date.now()` ខកខានចំណុចពិត**
// — `new Date()` (គ្មាន argument) ក៏ជានាឡិកាឧបករណ៍ដែរ (`processScannedCode`
// ធ្លាប់ប្រើវា)។ ដូច្នេះ checker នេះចាប់ **ទាំង ២ ទម្រង់** តាម AST មិនមែន regex។
//
// មេរៀនទី ២ (`network-timeout-test.js` 2.12.1 · `fluid-type-focus-test.js` 2.16.0 ·
// `payload-schema.js` 2.17.3)៖ **ពេលសរសេរ checker ត្រូវសួរថា វាស្កេនឯកសារណាខ្លះ។**
// ដូច្នេះវាស្កេន App ទាំង ២ បូក `license-verify.js` — មិនមែនតែ ZoeW ទេ។
let acorn;
try { acorn = require('acorn'); } catch (e) { console.log('SKIP — ត្រូវការ acorn (npm i acorn)'); process.exit(0); }
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLOCK_APP_DIR || path.join(__dirname, '..');

// វាលដែល rules ទទួល ហើយដែលការសម្រេច retention/revenue ពឹងលើ
const SERVER_TIME_FIELDS = new Set([
    'createdAt', 'closedAt', 'deletedAt', 'lockerUpdatedAt',
    'claimedAt', 'finalizedAt', 'issuedAt', 'expiresAt', 'signQueuedAt', 'userRetryAt', 'signedVerifiedAt', 'signedCleanupAt'
]);

// function ដែលអនុញ្ញាតឲ្យប្រើនាឡិកាឧបករណ៍ឆៅ — **រាល់ធាតុមានហេតុផលសរសេរជាប់**។
// កុំបន្ថែមធាតុដោយគ្មានហេតុផលពិត — ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។
const LOCAL_CLOCK_OK = {
    'ZoeW/app.js': {
        '<top>': 'ថេរពេល boot splash និង throttle `reg.update()` — cosmetic/local',
        // ⛔ React ៖ ការចុះឈ្មោះ Service Worker ផ្លាស់ពីកម្រិតកំពូលចូល function (lifecycle scope) — កូដដដែល
        registerServiceWorker: 'throttle `reg.update()` ១៥ នាទី — cosmetic/local ហើយវាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ update ភ្លាម)',
        elapsedSince: 'ជាមូលដ្ឋាននៃពិដានល្បឿនទាំងអស់ — អានក្លាក់ឆៅ **ដើម្បីធ្វើឲ្យវាមានសុវត្ថិភាព** (ថយក្រោយ ➜ Infinity); ចាក់សោដោយ `monotonic-gate-test.js`',
        getServerNow: 'និយមន័យរបស់នាឡិកា server ខ្លួនឯង',
        finishLocal: 'Sign outbox local retry deadline only; parcel close uses the server clock in applyBarcodeCloseChange. Never a retention or revenue timestamp.',
        processJob: 'Sign outbox local IndexedDB lease/retry deadlines shared by tabs on this device; server journal CAS independently guards photo/05 and uncertain sends are polled, never replayed.',
        publish: 'Sign outbox busy indicator from the local IndexedDB lease; UI only, no receipt or money verdict.',
        runPalmSignOutbox: 'Sign outbox local lease/retry scheduling; authoritative receipt ACK and parcel identity checks remain required before local close.',
        actOnQueuedSign: 'Sign outbox local lease check before an explicit user action; revision CAS guards the IndexedDB write, server validates confirmation separately.',

        verifySecurityPin: 'ការជាប់សោ PIN — local ដោយចេតនា (server មិនស្គាល់វា)',
        appLockLockoutSecondsLeft: 'ការអានវិនាទីដែលនៅសល់នៃការជាប់សោ PIN — local ដោយចេតនា (ការប្រៀបធៀបថ្ងៃឈប់ មិនស្ថិតក្នុងច្បាប់ `elapsedSince`)',
        registerAppLockFailure: 'ការជាប់សោ PIN នៃអេក្រង់ចាក់សោ App — local ដោយចេតនា ដូច `verifySecurityPin`; ការថយក្រោយធ្វើឲ្យ lockout **យូរជាង** ដែលជាទិសសុវត្ថិភាព',
        noteAppLockExcuse: 'ត្រាពេលនៃសកម្មភាពដែលនាំអ្នកប្រើចេញពី App ដោយចេតនា (ខល · រើសឯកសារ · ស្កេនជីវមាត្រ) — local សុទ្ធសាធ ហើយអ្នកអានវា (`noteAppLockAway`) ឆ្លងកាត់ `elapsedSince()` ➜ នាឡិកាថយក្រោយ ➜ Infinity ➜ **ចាក់សោ** ដែលជាទិសសុវត្ថិភាព',
        runBiometricUnlock: 'ការជាប់សោ PIN ដដែល',
        fetchCustomerDataTableRows: 'TTL cache និង cooldown ក្រោយបរាជ័យ — local',
        noteTxOutcomeUnknown: 'បង្អួច dedup Sentry «Transaction outcome unknown» ១០ នាទីក្នុង key (database ឬ Project + tenant របស់ adapter + path) — local សុទ្ធសាធ (Firebase និង Supabase ឆ្លងកាត់ function នេះ) · នាឡិកាលោត ➜ key ថ្មី ➜ រាយការណ៍ម្តងទៀតតែប៉ុណ្ណោះ · មិនប៉ះទិន្នន័យ ឬលុយ',
        recheckZtoPickupStatus: 'ត្រាពេលចាប់ផ្តើមជុំ «🔄 ពិនិត្យម្តងទៀត» ដើម្បីរាប់ធាតុរបាដែលជុំនោះមិនបានសួរ — ប្រៀបនឹង `at` នៃសាលក្រម ZTO ដែលជាត្រាពេល local ដដែល · តែចំនួនក្នុង toast · មិនប៉ះទិន្នន័យ ឬលុយ',
        fetchNotifyFeed: 'ពិដានល្បឿនការទាញសារជូនដំណឹង ៦០ វិ. — local ហើយវាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ ទាញ)',
        probeApkRelease: 'ពិដានល្បឿនការសួរ GitHub Release (APK ថ្មី) ២ នាទី · ៣០ វិ. — ត្រាពេល local ដែល `checkApkRelease()` វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ សួរម្តងទៀត) · មិនប៉ះទិន្នន័យ ឬលុយ',
        checkForAppUpdate: 'ត្រាស្ថានភាពប៊ូតុង «🔄 ពិនិត្យកំណែថ្មី» (`appUpdateCheck.at` · local · គ្មានការសម្រេចណាអានវា) — ការរង់ចាំការទាញសារដែលកំពុងរត់មានព្រំដែនរចនាសម្ព័ន្ធ (`APP_UPDATE_CHECK_WAIT_MAX` ជុំ) មិនពឹងនាឡិកា · មិនប៉ះទិន្នន័យ ឬលុយ',
        markReleaseAbsent: 'ត្រាពេលដដែលនឹង `probeApkRelease()` (Release ឆ្លើយ 404 ពេលទាញ) — local · វាស់តាម `elapsedSince()`',
        downloadWithStallGuard: 'ពិដាន «ការទាញ APK ឈប់រីក» ៤៥ វិ. — ត្រាពេល progress ចុងក្រោយ local · វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ បោះបង់ ➜ ចុចម្តងទៀតបាន) · មិនប៉ះទិន្នន័យ ឬលុយ',
        sampleScrollHz: 'ចន្លោះ ៥ វិ. រវាងការវាស់ Hz ពេលរមូរ (រៀន Hz ខ្ពស់បំផុតរបស់ឧបករណ៍) — local ហើយវាស់តាម `elapsedSince()` · មិនប៉ះទិន្នន័យ ឬលុយ',
        subscribeWeb: 'ត្រាពេលចុះឈ្មោះ Push/ផ្ញើកាលវិភាគចុងក្រោយ — ពិដានល្បឿន local (២៤ ម៉ោង · ១០ នាទី · ៦ ម៉ោង) វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ ចុះឈ្មោះ/ផ្ញើម្តងទៀត) · មិនប៉ះ retention ឬលុយ · ម៉ោងផុតកំណត់ដែលផ្ញើទៅ server មកពី `getServerNow()`',
        onNativeToken: 'ត្រាពេលចុះឈ្មោះ Push/ផ្ញើកាលវិភាគចុងក្រោយ — ពិដានល្បឿន local (២៤ ម៉ោង · ១០ នាទី · ៦ ម៉ោង) វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ ចុះឈ្មោះ/ផ្ញើម្តងទៀត) · មិនប៉ះ retention ឬលុយ · ម៉ោងផុតកំណត់ដែលផ្ញើទៅ server មកពី `getServerNow()`',
        notePalmSignPosition: 'ត្រាពេលទីតាំង GPS ចុងក្រោយក្នុងផ្ទាំង Sign — local សុទ្ធសាធ វាស់តាម `elapsedSince()` (`palmSignCurrentFix()` ៖ ចាស់ជាង ២ នាទី ឬថយក្រោយ ➜ Infinity ➜ មិនប្រើកូអរដោនេ ➜ រូបមានតែម៉ោង) · ម៉ោងលើរូបមកពី `getServerNow()` · មិនប៉ះ retention ឬលុយ',
        noteShopDevice: 'ត្រាពេលការផ្ញើឧបករណ៍ហាង Supabase ធ្លាក់ (`note_my_device`) — គម្លាតសាកម្តងទៀត local ៥ នាទី (`SHOP_DEVICE_RETRY_MS`) វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ សាកម្តងទៀត) · មិនសរសេរត្រាពេលទៅ server (ថ្ងៃ `last_seen` មកពី now() របស់ Postgres) · មិនប៉ះ retention ឬលុយ',
        resyncPush: 'ត្រាពេលចុះឈ្មោះ Push/ផ្ញើកាលវិភាគចុងក្រោយ — ពិដានល្បឿន local (២៤ ម៉ោង · ១០ នាទី · ៦ ម៉ោង) វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ ចុះឈ្មោះ/ផ្ញើម្តងទៀត) · មិនប៉ះ retention ឬលុយ · ម៉ោងផុតកំណត់ដែលផ្ញើទៅ server មកពី `getServerNow()`',
        syncExpirySchedule: 'ត្រាពេលចុះឈ្មោះ Push/ផ្ញើកាលវិភាគចុងក្រោយ — ពិដានល្បឿន local (២៤ ម៉ោង · ១០ នាទី · ៦ ម៉ោង) វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ ចុះឈ្មោះ/ផ្ញើម្តងទៀត) · មិនប៉ះ retention ឬលុយ · ម៉ោងផុតកំណត់ដែលផ្ញើទៅ server មកពី `getServerNow()`',
        seedCustomerTableFromImport: 'ត្រាថា cache តារាងអតិថិជនស្រស់ពេលណា — TTL local ដដែល គ្មានទំនាក់ទំនងនឹង retention ឬលុយ',
        setFastLookupRow: 'ត្រាពេល cache Lookup ក្នុងសតិ — TTL local សុទ្ធសាធ គ្មានទំនាក់ទំនងនឹង retention ឬលុយ',
        scheduleCustomerTableSoonRefresh: 'ត្រាពេលតាំងម៉ោងទាញឡើងវិញ — វាស់តាម elapsedSince() ដែល fail-open ពេលនាឡិកាថយក្រោយ',
        scheduleZtoWarmSoon: 'ត្រាពេលតាំងម៉ោងត្រៀម ZTO ឡើងវិញពេលរវល់ — local សុទ្ធសាធ (មិនប៉ះ retention ឬលុយ) ហើយវាស់តាម elapsedSince() ដែល fail-open ➜ នាឡិកាថយក្រោយ ➜ បោះបង់ ជំនួសការភ្ញាក់រហូត',
        armLookupFocus: 'ត្រាពេលនៃការរង់ចាំ Lookup មុនលើក Keyboard — local សុទ្ធសាធ (មិនប៉ះ retention ឬលុយ) ហើយវាស់តាម elapsedSince() ដែល fail-open ➜ នាឡិកាថយក្រោយ ➜ Keyboard មកភ្លាម មិនជាប់អន្ទាក់',
        scheduleAutoLookupQueueRetry: 'ត្រាពេលចូលជួររង់ចាំ Lookup — វាស់តាម elapsedSince() ដែល fail-open ពេលនាឡិកាថយក្រោយ; local សុទ្ធសាធ គ្មានទំនាក់ទំនងនឹង retention ឬលុយ',
        warmZtoLookupProxyIfConfigured: 'ត្រាពេល warm-up ZTO ក្នុង cooldown ១០ នាទី — local សុទ្ធសាធ និងមិនប៉ះ retention/revenue',
        attemptAutoLookup: 'cooldown ក្រោយ Lookup បរាជ័យ — local',
        setZtoPickupVerdict: 'ត្រាពេលនៃសាលក្រម ZTO ក្នុង cache localStorage — TTL local សុទ្ធសាធ (មិនចូល Firebase · មិនប៉ះ retention ឬលុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now(): មូលដ្ឋានលាយគ្នាធ្វើឲ្យសាលក្រម *ថ្មី* ត្រូវបោះចោល រាល់ការផ្ទុកឡើងវិញ ➜ ការហៅឥតឈប់ (`clock-basis-test.js`)',
        txReadServerValue: 'ថវិកាអាន token + fetch + body ក្នុងសំណើតែមួយ; elapsedSince() មិនមែន timestamp ទិន្នន័យ ឬច្បាប់លុយ',
        closeZtoSignedBarcodes: 'ត្រាពេលនៃការអានបញ្ជី «ចុះហត្ថលេខា» ZTO ចុងក្រោយ (ព្យាយាម · ជោគជ័យ) — ចន្លោះ `ZTO_SIGNED_SWEEP_GAP_MS`/`ZTO_SIGNED_SWEEP_IDLE_MS` និងការជ្រើសជួរថ្ងៃ local សុទ្ធសាធ (មិនប៉ះ retention ឬលុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() មិនមែន getServerNow(): មូលដ្ឋានលាយគ្នាធ្វើឲ្យ elapsedSince() ត្រឡប់ Infinity ➜ ចន្លោះរលាយ ➜ សួរ ZTO រាល់ជុំ (`clock-basis-test.js`) · ថ្ងៃរបស់សំណួរយកពី getServerNow() ដដែល',
        noteZtoUserActivity: 'ត្រាសកម្មភាពអ្នកប្រើ (ការប៉ះ · គ្រាប់ចុច/scanner) សម្រាប់ល្បឿនអានបញ្ជី «ចុះហត្ថលេខា» (`ztoSignedSweepCadenceMs()` ៖ ZTO_USER_ACTIVE_WINDOW_MS) — ពិដានល្បឿន local សុទ្ធសាធ (មិនសរសេរ Firebase · មិនប៉ះ retention/លុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (ត្រា getServerNow() ➜ Infinity ➜ ល្បឿនបាត់)',
        ztoAbandonCleanupIsHeld: 'ត្រាពេលនៃការរង់ចាំបញ្ជី «ចុះហត្ថលេខា» មុនការសម្អាត ៧ ថ្ងៃ (ZTO-E1 ៖ ពិដាន `ZTO_ABANDON_HOLD_MAX_MS` · ការអានពេញលេញស្រស់ `ZTO_SIGNED_FRESH_MS` · ការភ្ញាក់ពី background `ZTO_ABANDON_RESUME_GAP_MS`) — ពិដានរង់ចាំ local សុទ្ធសាធ (មិនសរសេរ Firebase · មិនប្តូរថេរ retention) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() ដូច `closeZtoSignedBarcodes` (ត្រា `ztoSignedCompleteAt` មកពីទីនោះ) · អាយុកញ្ចប់នៅតែវាស់ដោយ getServerNow() ក្នុង `runAutomaticCleanupRules()`',
        noteZtoShopSweep: 'ត្រាពេលដែល `completeAt` នៃសញ្ញាហាង ZTO ឡើង (`advancedAt` ៖ ការរង់ចាំការសម្អាត ៧ ថ្ងៃលើឧបករណ៍គ្មាន ZTO ចាប់វគ្គថ្មី) — ប្រៀបធៀបតែជាមួយ `ztoAbandonHoldSince` (Date.now() ក្នុង `ztoAbandonCleanupIsHeld`) ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (មូលដ្ឋានដូចគ្នា) · ត្រាដែលចែករំលែកក្នុង database (`activeAt` · `completeAt`) នៅជាម៉ោង Server (getServerNow())',
        fetchZtoPalmListAllPages: 'ត្រាចាប់ផ្តើមការទាញបញ្ជី Palm សម្រាប់បង្ហាញរយៈពេល «⏱ X វិ» (A183 ៖ ម្ចាស់គម្រោងវាស់ល្បឿនធៀប Cookie) — តម្លៃបង្ហាញ local សុទ្ធសាធ (មិនសរសេរ Firebase · មិនប៉ះ retention/លុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (ត្រា getServerNow() ➜ Infinity)',
        palmConfigFor: 'ត្រាពេល Login ZTO Palm (`palmLoginAt`) ៖ អាយុ session វាស់តាម elapsedSince() ដើម្បីដឹងពេល Login ឡើងវិញនៅ background — local សុទ្ធសាធ (fail-open ពេលនាឡិកាថយក្រោយ ➜ Login ឡើងវិញ) មិនប៉ះ retention ឬលុយ',
        noteZtoPalmSessionRejected: 'ពិដានល្បឿន Login ZTO Palm ឡើងវិញពេល ZTO បដិសេធ session (≤ ១ ដង/៦០ វិ.) — local សុទ្ធសាធ (ការពារ risk control ZTO) មិនប៉ះ retention ឬលុយ',
        runZtoPalmRefresh: 'ត្រា `palmLoginAt` · ពេលបរាជ័យ (រង់ចាំ ២ នាទី) នៃ Login ZTO Palm ឡើងវិញ — local វាស់តាម elapsedSince() មិនប៉ះ retention ឬលុយ',
        fetchZtoSignedCodes: 'ត្រាពេលដែលបញ្ជី «ចុះហត្ថលេខា» លើសពិដានទំព័រ (`ztoSignedSplitAt` ៖ ការអានបន្ទាប់ក្នុង `ZTO_SIGNED_SPLIT_MEMO_MS` ទៅតាមថ្ងៃភ្លាម) — ការចងចាំ quota local សុទ្ធសាធ (មិនសរសេរ Firebase · មិនប៉ះ retention/លុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (ត្រា getServerNow() ➜ Infinity ➜ ការចងចាំរលាយ)',
        noteZtoShopSweepError: 'ត្រាពេលដែល listener សញ្ញាហាង ZTO ត្រូវបដិសេធ/បរាជ័យ (`failedAt` ៖ ការភ្ជាប់ឡើងវិញ ≤ ១ ដងក្នុង `ZTO_SHOP_SWEEP_MARK_GAP_MS`) — ពិដានល្បឿន local សុទ្ធសាធ (មិនសរសេរ Firebase) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (ត្រា getServerNow() ➜ Infinity ➜ ភ្ជាប់រាល់ជុំ)',
        retryZtoShopSweepListener: 'ត្រាពេលនៃការភ្ជាប់ listener សញ្ញាហាងឡើងវិញ (`failedAt`) — ពិដានល្បឿន local សុទ្ធសាធ (មិនសរសេរ Firebase) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() ដូច `noteZtoShopSweepError`',
        noteZtoTrashModeError: 'ត្រាពេល listener សញ្ញារបៀបធុងសំរាមហាង (`zoew_settings/zto_trash_mode`) ទទួលកំហុស (`failedAt`) — ពិដានល្បឿនភ្ជាប់ឡើងវិញ local សុទ្ធសាធ (មិនសរសេរ Firebase · មិនប៉ះ retention/លុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (ត្រា getServerNow() ➜ Infinity ➜ ពិដានរលាយ)',
        retryZtoTrashModeListener: 'ត្រាពេលនៃការភ្ជាប់ listener សញ្ញារបៀបធុងសំរាមហាងឡើងវិញ (`failedAt`) — ពិដានល្បឿន local សុទ្ធសាធ ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() ដូច `noteZtoTrashModeError`',
        noteZtoSweepLaneError: 'ត្រាពេល listener វេនអានសាខា (`zoew_settings/zto_sweep_lead`) ទទួលកំហុស (`failedAt`) — ពិដានល្បឿនភ្ជាប់ឡើងវិញ local សុទ្ធសាធ (មិនសរសេរ Firebase · មិនប៉ះ retention/លុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() (ត្រា getServerNow() ➜ Infinity ➜ ពិដានរលាយ) · ត្រាវេន `at` ខ្លួនវាជា getServerNow()',
        retryZtoSweepLaneListener: 'ត្រាពេលនៃការភ្ជាប់ listener វេនអានសាខាឡើងវិញ (`failedAt`) — ពិដានល្បឿន local សុទ្ធសាធ ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() ដូច `noteZtoSweepLaneError`',
        claimZtoSweepLane: 'ត្រាពេលផ្អាកការកក់វេន (`pausedAt`) ពេលការកក់ត្រូវបដិសេធ ឬលើសពិដាន — ការផ្អាក `ZTO_SWEEP_LANE_RETRY_MS` ក្នុង memory សុទ្ធសាធ (មិនសរសេរ Firebase) វាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now(); ត្រាវេនដែលសរសេរ (`at`) ជា getServerNow()',
        holdCollectedSettle: 'ត្រាពេលដែលការបិទកញ្ចប់លើឧបករណ៍នេះចាប់ផ្តើមរង់ចាំ ACK + ការ Sync ចំណូលតាមថ្ងៃយក — ពិដាន `COLLECTED_SETTLE_HOLD_MS` ក្នុង memory សុទ្ធសាធ (ការសម្អាត «យករួច» រង់ចាំ ≤ ២ នាទី) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now(); មិនសរសេរទៅ server ឡើយ',
        sendZtoTrashModeWithdrawal: 'ត្រាពេលដែលឧបករណ៍ផ្ញើការដកត្រារបៀបធុងសំរាមនៃសោខ្លួនឯង (`ztoTrashModeWithdrawnAt` · ពី `withdrawZtoTrashMode()` និង `withdrawLeftZtoTrashModes()`) — ពិដានល្បឿនផ្ញើឡើងវិញ local សុទ្ធសាធ (`withdrawLeftZtoTrashModes()` ៖ ≤ ១ ដង / `ZTO_TRASH_MODE_RETRY_MS` ក្នុងមួយសោ) វាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() · ការលុបសោខ្លួនឯងមិនផ្អែកលើនាឡិកាទេ ➜ មិនប៉ះ retention ឬលុយ',
        ztoTrashModeGapStamp: 'ត្រាពេលផ្ញើនៃពិដានល្បឿនសរសេររបៀបធុងសំរាម (`ztoTrashModeWrote` របស់ `markZtoTrashMode()`) — ផែនទីគម្លាតផ្ញើ local សុទ្ធសាធ (≤ ១ ដង / `ZTO_TRASH_MODE_RETRY_MS`) វាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() · function ជំនួយនេះត្រឡប់តែផែនទីគម្លាត មិនមែនលេខ ➜ `markZtoTrashMode()` និង `markLegacyZtoTrashMode()` លែងនៅក្នុងបញ្ជីនេះ ដូច្នេះ Date.now() ណាមួយក្នុងពួកវា (ឧ. តម្លៃត្រាដែលសរសេរទៅ server ត្រូវតែជា getServerNow()) ក្លាយជាកំហុស',
        noteZtoTrashModeRefused: 'ត្រាពេលដែល rules បដិសេធការសរសេររបៀបធុងសំរាម (`ztoTrashModeRefusal.at`) — ការផ្អាកការសរសេរតាមឧបករណ៍ `ZTO_TRASH_MODE_REFUSED_RETRY_MS` ក្នុង memory សុទ្ធសាធ វាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now(); មិនសរសេរទៅ server ឡើយ',
        pruneZtoTrashMode: 'ត្រាពេលនៃជុំសម្អាតត្រារបៀបធុងសំរាមហាងដែលចាស់ជាង `ZTO_TRASH_MODE_ACTIVE_MS` (`ztoTrashModePrunedAt`) — ពិដានល្បឿន local សុទ្ធសាធ (≤ `ZTO_TRASH_MODE_PRUNE_MAX` សោ / `ZTO_TRASH_MODE_RETRY_MS`) វាស់តាម elapsedSince() · ការសម្រេចថាត្រាចាស់ប្រើ getServerNow() ដែលទុកចិត្តបាន (`cleanupClockIsTrustworthy()`) ➜ មិនប៉ះ retention ឬលុយ',
        runZtoStatusSweep: 'ត្រាពេលនៃជុំបោស ZTO ចុងក្រោយ — ពិដានល្បឿន local សុទ្ធសាធ (មិនប៉ះ retention ឬលុយ) ហើយវាស់តាម elapsedSince() ➜ ⛔ វា **ត្រូវតែ** ជា Date.now() មិនមែន getServerNow(): មូលដ្ឋានលាយគ្នាធ្វើឲ្យ elapsedSince() ត្រឡប់ Infinity ➜ ពិដានរលាយ (`clock-basis-test.js`)',
        attemptDbListenerRecovery: 'ពិដានល្បឿននៃការស្តារ listener — local',
        noteDbListenerAlive: 'ត្រាពេលនៃវឌ្ឍនភាព resync — វាស់ចន្លោះពេលក្នុងវគ្គដដែល មិនមែនការសម្រេច retention/revenue',
        scheduleFirebaseSdkRetry: 'កត់ត្រាពេលព្យាយាមផ្ទុក SDK — ចូលរួមក្នុងពិដានល្បឿន local',
        retryFirebaseSdkNow: 'ពិដានល្បឿននៃការផ្ទុក SDK ឡើងវិញ — local (ដូច attemptDbListenerRecovery)',
        reloadForFirebaseSdk: 'គម្លាតអប្បបរមារវាងការផ្ទុកទំព័រឡើងវិញ — local សុទ្ធសាធ (server មិនស្គាល់វា ហើយវាមិនប៉ះ retention/revenue សោះ)',
        forceDatabaseReconnect: 'គម្លាតអប្បបរមារវាងវដ្តភ្ជាប់ឡើងវិញ — local',
        noteDatabaseLinkUnresponsive: 'ត្រាពេលនៃការផ្តាច់ socket «ងាប់ស្ងាត់» ចុងក្រោយ (≤ ១ ដង/៣០ វិ.) — ពិដានល្បឿន local វាស់តាម `elapsedSince()` · មិនប៉ះ retention ឬលុយ',
        probeDatabaseLiveness: 'ត្រាពេលនៃ round trip ដែលឆ្លើយចុងក្រោយ — local សុទ្ធសាធ ហើយអ្នកអាន (`probeDatabaseLivenessIfIdle`) ឆ្លង `elapsedSince()` ➜ ថយក្រោយ ➜ Infinity ➜ វាស់ (ទិសសុវត្ថិភាព) · ⛔ ត្រូវតែជា Date.now() (`clock-basis-test.js`)',
        setupConnectionRecovery: 'ត្រាពេលដែលទំព័រ hidden ➜ រយៈពេលនៅ background វាស់តាម `elapsedSince()` ដើម្បីសម្រេចវាស់ភាពរស់ពេលត្រឡប់មក — local សុទ្ធសាធ',
        attachInfoListeners: 'ត្រាពេលដែល `.info/connected` ក្លាយជា true (round trip ថ្មី) — local វាស់តាម `elapsedSince()` · មិនប៉ះ retention ឬលុយ',
        createSupabaseDatabase: 'adapter Supabase ៖ RTT របស់ RPC (t0/t1 ➜ offset នាឡិកា server ដូច `.info/serverTimeOffset` ៖ ត្រង់នេះជាអ្នកផ្តល់ getServerNow() មិនមែនអ្នកប្រើ) · ត្រាចាប់ផ្តើមការរង់ចាំលទ្ធផល transaction វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ `unknown` ភ្លាម មិនប៉ះលុយ) — local សុទ្ធសាធ មិនប៉ះ retention ឬលុយ',
        generateUniqueId: 'salt នៃ id — មិនមែនការសម្រេច retention',
        syncZtoFinalMarks: 'ត្រាពេលបរាជ័យ/rules បដិសេធ នៃការកត់ Sign · ត្រឡប់ ZTO លើ barcode (`ztoFinalFailedAt` · `ztoFinalRefusedAt`) — គម្លាតសាកម្តងទៀត local វាស់តាម `elapsedSince()` (ថយក្រោយ ➜ Infinity ➜ សាកម្តងទៀត) · តម្លៃដែលសរសេរទៅ server (`ztoSignedAt`) មកពី `getServerNow()` · មិនប៉ះ retention ឬលុយ',
        beginPickupIntent: 'អាយុធាតុ journal ស្ថិតិយករួច (`zoew_pickup_journal_v1` · ការពារការបាត់ការបិទ/បើកដែល App បិទពាក់កណ្តាល) — ត្រា local វាស់តាម `elapsedSince()` ប៉ុណ្ណោះ (ថយក្រោយ ➜ Infinity ➜ ធាតុចាស់ត្រូវបោះចោល · ការសម្រេចលុយ/retention មិនអានវា) · មិនសរសេរទៅ server',
        waitForZXingThenInitScanEngine: 'deadline ផ្ទុក script — local',
        confirmLiveScan: 'បង្អួច «២ ស៊ុមជាប់គ្នា» — local',
        processScannedCode: 'debounce ការស្កេនស្ទួន ២.៥ វិ. — local',
        renderLoop: 'ចង្វាក់ស៊ុម (fallback ពី performance.now)',
        loop: 'ចង្វាក់ស៊ុមនៃការស្កេន (fallback ពី performance.now)'
    },
    'ZoeKeyGen/app.js': {
        '<top>': 'ថេរពេល boot splash និង throttle `reg.update()` — cosmetic/local',
        elapsedSince: 'ជាមូលដ្ឋាននៃពិដានល្បឿនទាំងអស់ — អានក្លាក់ឆៅ **ដើម្បីធ្វើឲ្យវាមានសុវត្ថិភាព** (ថយក្រោយ ➜ Infinity); ចាក់សោដោយ `monotonic-gate-test.js`',
        getServerNow: 'និយមន័យរបស់នាឡិកា server ខ្លួនឯង',
        verifySecurityPin: 'ការជាប់សោ PIN — local ដោយចេតនា',
        forceDatabaseReconnect: 'គម្លាតអប្បបរមារវាងវដ្តភ្ជាប់ឡើងវិញ — local',
        scheduleFirebaseSdkRetry: 'កត់ត្រាពេលព្យាយាមផ្ទុក SDK — ចូលរួមក្នុងពិដានល្បឿន local',
        retryFirebaseSdkNow: 'ពិដានល្បឿននៃការផ្ទុក SDK ឡើងវិញ — local',
        reloadForFirebaseSdk: 'គម្លាតអប្បបរមារវាងការផ្ទុកទំព័រឡើងវិញ — local សុទ្ធសាធ (server មិនស្គាល់វា ហើយវាមិនប៉ះ retention/revenue សោះ)',
        runBiometricUnlock: 'ការជាប់សោ PIN ដដែល (ការប្រៀបធៀបថ្ងៃឈប់ ៖ ថយក្រោយ ➜ lockout យូរជាង = ទិសសុវត្ថិភាព)',
        noteSigningKeyActivity: 'ត្រាសកម្មភាពនៃ Signing Key (ពិដានទុកចោល) — local សុទ្ធសាធ · អ្នកអាន `expireIdleSigningKey()` ឆ្លង `elapsedSince()` ➜ ថយក្រោយ ➜ Infinity ➜ ដក Key (fail-closed)',
        loadSigningKey: 'ត្រាសកម្មភាពពេល Load Signing Key — ដូច `noteSigningKeyActivity`',
        tryRestoreSigningKeyFromSession: 'ត្រាសកម្មភាពពេលស្តារ Signing Key — ដូច `noteSigningKeyActivity`',
        sbAdminActivity: 'ត្រាសកម្មភាពនៃ session Admin Supabase (ពិដានស្ងៀម) — local សុទ្ធសាធ · អ្នកអាន `expireIdleSbAdmin()` ឆ្លង `elapsedSince()` ➜ ថយក្រោយ ➜ Infinity ➜ ចាកចេញ (fail-closed)',
        sbAdminLogin: 'ត្រាសកម្មភាពពេលចូល Admin Supabase — ដូច `sbAdminActivity`',
        noteKeygenActivity: 'ត្រាសកម្មភាពនៃសម័យ Admin ZoeKeyGen (ពិដានចាកចេញស្វ័យប្រវត្តិ) — local សុទ្ធសាធ · អ្នកអាន `expireIdleKeygenSession` វាស់ដោយ `elapsedSince`',
        updateAuthButton: 'ត្រាសកម្មភាពពេលចូលប្រព័ន្ធ — ដូច `noteKeygenActivity`'
    },
    'ZoeW/license-verify.js': {
        getServerNow: 'និយមន័យរបស់នាឡិកា server ខ្លួនឯង',
        checkOnline: 'គណនា offset ពី header HTTP `Date` — ត្រូវការនាឡិកាឧបករណ៍ជាមូលដ្ឋាន',
        syncServerTime: 'ដដែល — គណនា offset',
        activate: 'ពេលកន្លង (វិនាទី) ពីការចាប់ផ្តើមអានរបស់ Activate ដល់ការសរសេរ record ដកចេញពី `getServerNow()` ➜ `activatedAt` = ម៉ោង Server ពេលការអានចាប់ផ្តើម (ការដោះចាប់ពីការកក់កៅអីតទៅ ចាប់បានឧបករណ៍) · នាឡិកាថយក្រោយ ➜ ពេលកន្លង 0 · មិនមែនត្រាពេលដែលសរសេរពីនាឡិកាឧបករណ៍'
    },
};

// អនុញ្ញាតតែចំណុចកំណត់ពេល local ជាក់លាក់ មិនមែន function ទាំងមូល; server fields/retention នៅផ្ទៀងដដែល។
const LOCAL_CLOCK_SITES = [
    { fn: 'restartQueuedSign', expression: 'pendingDeadline(value.row.leaseUntil,Date.now(),SIGN_OUTBOX_LEASE_MS)', reason: 'ផ្ទៀង lease local មុនស្នើចាប់ផ្ដើមថ្មី; Server នៅផ្ទៀង lease/អាយុរបស់ខ្លួន។' },
    { fn: 'restartQueuedSign', call: 'updateJob', argument: 4, expression: 'Date.now()+SIGN_OUTBOX_LEASE_MS', reason: 'កក់សិទ្ធិ IndexedDB ក្នុងឧបករណ៍សម្រាប់ការស្នើដោយដៃ; មិនអនុញ្ញាត Sign ឬកំណត់អាយុកញ្ចប់។' },
    { fn: 'restartQueuedSign', property: 'at', expression: 'Date.now()', reason: 'ត្រាប្រវត្តិការងារនិងការផ្ទៀងក្នុងឧបករណ៍; មិនមែនម៉ោង Sign ឬ retention/លុយ។' },
    { fn: 'restartQueuedSign', property: 'archivedAt', expression: 'Date.now()', reason: 'ត្រាផ្លាស់ទៅសង្គ្រោះ local ប៉ុណ្ណោះ; មិនលុបរូប ឬបញ្ជាក់អាយុសំណើ Server។' },
    { fn: 'createSupabaseTransport', expression: 'current.expires_at*1000<=Date.now()', reason: 'ពិនិត្យ expiry របស់ token ដែលបានរក្សាទុកសម្រាប់ health អានសុទ្ធដោយមិន refresh; server នៅផ្ទៀងសិទ្ធិពិត។ មិនសម្រេច retention/លុយ ហើយពិដាន network ប្រើ performance.now។' },
    { fn: 'maintainQueueLifecycle', expression: 'pendingDeadline(value.row.leaseUntil,Date.now(),SIGN_OUTBOX_LEASE_MS)', reason: 'ផ្ទៀង lease ក្នុងឧបករណ៍; កាលលុបប្រើនាឡិកា server ដែលទុកចិត្ត។' },
    { fn: 'deleteQueuedSign', expression: 'pendingDeadline(value.row.leaseUntil,Date.now(),SIGN_OUTBOX_LEASE_MS)', reason: 'ទប់ការលុបពេល worker កំពុងកាន់ lease ក្នុងឧបករណ៍។' },
    { fn: 'deleteQueuedSign', call: 'updateJob', argument: 4, expression: 'Date.now()+SIGN_OUTBOX_LEASE_MS', reason: 'កក់ lease មុនការបោះបង់សំណើលើ server; មិនមែនកាលលុបស្វ័យប្រវត្តិ។' },
    { fn: 'retainSignedJob', property: 'archivedAt', expression: 'Date.now()', reason: 'ត្រារក្សា original ក្នុងឧបករណ៍ មិនបញ្ជាក់ Sign ឬលុបរូប; completion ត្រូវការចម្លើយ status ថ្មី។' },
    { fn: 'previousSignCheck', property: 'at', expression: 'Date.now()', reason: 'ត្រាស្ថានភាពផ្ទៀង local ដែលរក្សាភស្តុតាងមុន; មិនមែនពេល Sign, server proof, retention ឬលុយ។' },
    { fn: 'reconcileHeldSign', call: 'updateJob', argument: 4, expression: 'Date.now()+SIGN_OUTBOX_LEASE_MS', reason: 'lease local សម្រាប់ការអាន status តែមួយ; CAS និងការផ្ទៀង barcode នៅតែចាំបាច់។' },
    { fn: 'checkTrashedParent', property: 'at', expression: 'Date.now()', reason: 'ត្រាពេលផ្ទៀងក្នុង recoveryCheck local ប៉ុណ្ណោះ; Sign/រូបត្រូវការភស្តុតាង server មិនពឹងត្រានេះ។' },
    { fn: 'archiveQueuedSign', property: 'at', expression: 'Date.now()', reason: 'ត្រាពេល diagnosis ក្នុង IndexedDB មិនមែនម៉ោង Sign ឬ retention។' },
    { fn: 'archiveQueuedSign', property: 'archivedAt', expression: 'Date.now()', reason: 'ប្រវត្តិផ្លាស់ទៅ recovery ក្នុងឧបករណ៍; មិនមាន TTL ឬការលុបរូបតាមត្រានេះ។' },
    { fn: 'recoverQueuedSign', property: 'resumedAt', expression: 'Date.now()', reason: 'ប្រវត្តិចុចបន្តក្នុងឧបករណ៍; request ដើម និង server proof នៅតែចាំបាច់។' },
    { fn: 'recoverQueuedSign', expression: 'pendingDeadline(value.row.leaseUntil,Date.now(),SIGN_OUTBOX_LEASE_MS)', reason: 'អាន lease local ក្នុង IndexedDB ដើម្បីទប់ប្រតិបត្តិការស្របគ្នា; មិនជំនួស server CAS។' },
    { fn: 'recoverQueuedSign', call: 'updateJob', argument: 4, expression: 'Date.now()+SIGN_OUTBOX_LEASE_MS', reason: 'កក់ lease local តាម revision CAS មុនផ្ទៀងសំណើ; មិនមែន server token expiry ឬសិទ្ធិ replay។' },
    { fn: 'waitForPhoto', expression: 'photoGraceEnded(value.job,Date.now())', reason: 'ពិដានពេល local polling ប្តូរទៅ manual hold ប៉ុណ្ណោះ; មិនបញ្ជាក់ signed/photo proof ឬពេលកញ្ចប់។' },
    { fn: 'waitForPhoto', expression: 'value.job.photoGraceStartedAt+PHOTO_GRACE_MS-Date.now()', reason: 'បន្ថយ local poll delay មិនឱ្យលើស grace ដែលចាប់ផ្តើមរួច; មិន reset budget និងមិនមែន server expiry។' },
    { fn: 'waitForPhoto', call: 'updateJob', argument: 3, expression: 'Date.now()+(poll.photoPollDelay||15000)', reason: 'ចង្វាក់សាក photo poll ក្នុង local encrypted queue; proof មកពី server ដដែល។' },
    { fn: 'cancelJob', call: 'updateJob', argument: 3, expression: 'Date.now()+15000', reason: 'រង់ចាំសាក cancellation មិនច្បាស់ម្ដងទៀត មិនបញ្ជាក់ cancel/discard។' },
    { fn: 'refreshBeforeWrite', expression: 'pendingDeadline(value.job.warningRefreshRetryAfter||0,Date.now(),300000)', reason: 'ចង្វាក់ local warning/prewrite refresh; server ផ្ទៀង one-shot intent។' },
    { fn: 'refreshBeforeWrite', call: 'updateJob', argument: 3, expression: 'Date.now()+15000', reason: 'ពេលសាក local queue ខណៈរង់ចាំ authoritative refresh។' },
    { fn: 'refreshBeforeWrite', property: 'warningRefreshRetryAfter', expression: 'Date.now()+300000', reason: 'រក្សាតែ local refresh throttle មិនមែន server token expiry។' }
];

// ឯកសារដែលមាននាឡិកា server ផ្ទាល់ខ្លួន ➜ ត្រូវមាន getServerNow() និងផ្លូវធ្វើឲ្យ offset ស្រស់
const CLOCK_OWNERS = {
    'ZoeW/app.js': /\.info\/serverTimeOffset/,
    'ZoeKeyGen/app.js': /\.info\/serverTimeOffset/,
    'ZoeW/license-verify.js': /headers\.get\(\s*['"]date['"]\s*\)/i
};

const FILES = Object.keys(LOCAL_CLOCK_OK);

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('   ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function check(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

function isRawClock(node) {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed &&
        node.callee.object.type === 'Identifier' && node.callee.object.name === 'Date' &&
        node.callee.property.name === 'now') return true;
    return node.type === 'NewExpression' && node.callee.type === 'Identifier' &&
        node.callee.name === 'Date' && node.arguments.length === 0;
}

function containsRawClock(node) {
    let found = false;
    (function scan(n) {
        if (!n || typeof n.type !== 'string' || found) return;
        if (isRawClock(n)) { found = true; return; }
        for (const k of Object.keys(n)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(scan);
            else if (v && typeof v.type === 'string') scan(v);
        }
    })(node);
    return found;
}

function fieldNameOf(node) {
    if (node.type === 'Property') {
        if (node.computed) return null;
        return node.key.type === 'Identifier' ? node.key.name : (node.key.type === 'Literal' ? String(node.key.value) : null);
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed) {
        return node.left.property.type === 'Identifier' ? node.left.property.name : null;
    }
    return null;
}

function memberFieldOf(node) {
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') return node.property.name;
    return null;
}

for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { bad(rel + ': រកឯកសារមិនឃើញ'); continue; }
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }); }
    catch (e) { bad(rel + ': parse មិនបាន', e.message); continue; }

    const allow = LOCAL_CLOCK_OK[rel];
    const stack = [];
    const ancestors = [];
    const seenSites = new Set();
    const offenders = [];
    const seenFns = new Set();
    const fieldViolations = [];
    const compareViolations = [];

    (function walk(node) {
        if (!node || typeof node.type !== 'string') return;
        ancestors.push(node);
        let pushed = false;
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            stack.push((node.id && node.id.name) || '<anon>');
            pushed = true;
        }

        if (isRawClock(node)) {
            const named = stack.filter((n) => n !== '<anon>');
            const fn = named.length ? named[named.length - 1] : '<top>';
            seenFns.add(fn);
            const site = rel === 'ZoeW/app.js' && LOCAL_CLOCK_SITES.find((entry) => entry.fn === fn && ancestors.some((ancestor) => {
                let expression = ancestor;
                if (entry.call) {
                    if (ancestor.type !== 'CallExpression' || ancestor.callee.type !== 'Identifier' || ancestor.callee.name !== entry.call) return false;
                    expression = ancestor.arguments[entry.argument];
                } else if (entry.property) {
                    if (ancestor.type !== 'Property' || fieldNameOf(ancestor) !== entry.property) return false;
                    expression = ancestor.value;
                }
                return expression && expression.start <= node.start && expression.end >= node.end
                    && code.slice(expression.start, expression.end).replace(/\s+/g, '') === entry.expression;
            }));
            if (site) seenSites.add(site);
            if (!site && !Object.prototype.hasOwnProperty.call(allow, fn)) {
                offenders.push(rel + ':' + node.loc.start.line + '  ក្នុង `' + fn + '()`');
            }
        }

        // វាល timestamp ដែលចូល Firebase ត្រូវមកពី getServerNow() — មិនមែននាឡិកាឧបករណ៍
        const fieldName = fieldNameOf(node);
        if (fieldName && SERVER_TIME_FIELDS.has(fieldName)) {
            const value = node.type === 'Property' ? node.value : node.right;
            if (value && containsRawClock(value)) {
                fieldViolations.push(rel + ':' + node.loc.start.line + '  `' + fieldName + '` សរសេរពីនាឡិកាឧបករណ៍');
            }
        }

        // ការប្រៀបធៀបបង្អួច (`now - item.closedAt > TWO_HOURS_MS`) ត្រូវប្រើនាឡិកា server
        if (node.type === 'BinaryExpression') {
            const leftField = memberFieldOf(node.left);
            const rightField = memberFieldOf(node.right);
            if (leftField && SERVER_TIME_FIELDS.has(leftField) && containsRawClock(node.right)) {
                compareViolations.push(rel + ':' + node.loc.start.line + '  `' + leftField + '` ធៀបនឹងនាឡិកាឧបករណ៍');
            }
            if (rightField && SERVER_TIME_FIELDS.has(rightField) && containsRawClock(node.left)) {
                compareViolations.push(rel + ':' + node.loc.start.line + '  `' + rightField + '` ធៀបនឹងនាឡិកាឧបករណ៍');
            }
        }

        for (const k of Object.keys(node)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v.type === 'string') walk(v);
        }
        if (pushed) stack.pop();
        ancestors.pop();
    })(ast);

    check(offenders.length === 0,
        rel + ': នាឡិកាឧបករណ៍ឆៅ ស្ថិតតែក្នុង function ដែលមានហេតុផលសរសេរជាប់',
        offenders.join('\n         '));

    check(fieldViolations.length === 0,
        rel + ': គ្មានវាល timestamp ណាសរសេរពី `Date.now()`/`new Date()`',
        fieldViolations.join('\n         '));

    check(compareViolations.length === 0,
        rel + ': គ្មានការប្រៀបធៀបបង្អួច retention នឹងនាឡិកាឧបករណ៍',
        compareViolations.join('\n         '));

    // ២ ខាង៖ ធាតុ allowlist ដែលលែងប្រើ ត្រូវដកចេញ បើមិនដូច្នេះវាលាក់កំហុសបន្ទាប់
    if (rel === 'ZoeW/app.js') check(LOCAL_CLOCK_SITES.every((site) => site.reason && seenSites.has(site)),
        'ZoeW/app.js: local scheduling sites មានហេតុផល និងមិនមានធាតុងាប់', LOCAL_CLOCK_SITES.filter((site) => !seenSites.has(site)).map((site) => site.fn + ': ' + site.expression));

    const dead = Object.keys(allow).filter((fn) => !seenFns.has(fn));
    check(dead.length === 0, rel + ': បញ្ជីអនុញ្ញាតគ្មានធាតុងាប់ (សិទ្ធិតូចបំផុត)', dead);

    if (CLOCK_OWNERS[rel]) {
        check(/function getServerNow\(\)\s*\{[\s\S]{0,120}?Date\.now\(\)\s*\+\s*serverTimeOffsetMs/.test(code),
            rel + ': មាន `getServerNow()` = `Date.now() + serverTimeOffsetMs`');
        check(CLOCK_OWNERS[rel].test(code),
            rel + ': offset នៃនាឡិកា server ត្រូវធ្វើឲ្យស្រស់ពីប្រភពពិត');
    }
}

// ការសម្រេចរបស់ការសម្អាតស្វ័យប្រវត្តិ ត្រូវឈរលើនាឡិកា server ទាំងស្រុង
const zoew = fs.existsSync(path.join(ROOT, 'ZoeW/app.js')) ? fs.readFileSync(path.join(ROOT, 'ZoeW/app.js'), 'utf8') : '';
if (zoew) {
    for (const fn of ['runAutomaticCleanupRules', 'claimAndCleanupItem', 'barcodeCloseIsRipe']) {
        const m = new RegExp('function ' + fn + '\\s*\\([^)]*\\)\\s*\\{').exec(zoew);
        if (!m) { bad('ZoeW/app.js: រក `' + fn + '()` មិនឃើញ'); continue; }
        let i = zoew.indexOf('{', m.index), depth = 0, end = i;
        for (; end < zoew.length; end++) {
            if (zoew[end] === '{') depth++;
            else if (zoew[end] === '}') { depth--; if (!depth) break; }
        }
        const body = zoew.slice(i, end + 1);
        check(!/\bDate\.now\(\)/.test(body) && !/new Date\(\s*\)/.test(body),
            'ZoeW/app.js: `' + fn + '()` មិនប៉ះនាឡិកាឧបករណ៍សោះ');
    }
}

console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
