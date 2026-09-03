# audit-tools

ឧបករណ៍ static-check + តេស្តសម្រាប់ការធ្វើ audit លើ Zoe-System។
រត់ពី **root** នៃ repo។ **មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។**

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព ·
> អាជ្ញាប័ណ្ណ**។ **ហេតុអ្វី** checker នីមួយៗមាន និងលេខដែលវាស់បាន ស្ថិតក្នុង
> **[docs/HISTORY.md](../docs/HISTORY.md)**។

---

## កំណែ

ឧបករណ៍ទាំងនេះ **គ្មានកំណែផ្ទាល់ខ្លួន** ហើយ **មិនប៉ះ `APP_VERSION` ឬ
`CACHE_VERSION`** របស់ App ណាមួយឡើយ (`version-bump-scope.js` លើកលែងផ្លូវ
`audit-tools/`)។ ចំនួន assertion ពិតរបស់ checker នីមួយៗ **បោះពុម្ពពេលរត់** —
⛔ កុំចម្លងលេខទាំងនោះចូលឯកសារ ព្រោះវាចាស់លឿន។

---

## មុខងារ

`run-all.sh` រត់ការត្រួតពិនិត្យជាង **១២០** ដែលបែងចែកជា ៦ ក្រុម ៖

| ក្រុម | គ្របអ្វី |
|---|---|
| **តក្កវិជ្ជាអាជីវកម្ម** | ច្បាប់លុប/ដក · ធុងសំរាម · ការសម្អាតស្វ័យប្រវត្តិ · ស្ថិតិយក · ចំណូល |
| **បណ្តាញ និងការតភ្ជាប់** | timeout · retry · ការស្តារ listener · សម្ពាធសំណើ · បណ្តាញ «ភ្ជាប់តែស្លាប់» |
| **Service Worker** | សំបក cache · ការធ្វើឲ្យស្រស់ · ការធ្លាក់របស់ Cache API · ល្បឿនបើក App |
| **UI និងទម្រង់បង្ហាញ** | កាយវិការ · ចលនាផ្ទាំង · មាត្រដ្ឋានអក្សរ · ទម្រង់លើអេក្រង់ ៦ ទំហំ |
| **សុវត្ថិភាព** | CSP · XSS · ការលាក់ secret · storage · License · ចាក់សោ App |
| **Meta (ឧបករណ៍ត្រួតពិនិត្យឧបករណ៍)** | checker អាចធ្លាក់បានទេ · ព្យួរបានទេ · ការធ្លាក់ឡើងដល់ exit code ទេ |

ការត្រួតពិនិត្យ **៣៥** បើក **Chromium ពិត** ហើយវាស់ឥរិយាបថពិត មិនមែនអានកូដទេ។

---

## របៀបប្រើប្រាស់

### ១. ដំឡើង dependency (ម្តងក្នុងមួយ session)

```bash
npm i acorn playwright-core xlsx
```

| Package | ត្រូវការសម្រាប់ |
|---|---|
| `acorn` | checker ស្តាទិចដែល parse តាម AST |
| `playwright-core` | តេស្តដែលបើក Chromium ពិត |
| `xlsx` | ការត្រួតពិនិត្យ XML ដែល Export emit ចេញ |

បើខ្វះមួយណា checker ដែលពឹងលើវា **SKIP ដោយស្អាត** — `run-all.sh` នៅតែរត់ចប់
ហើយរាយ `SKIPPED`/`PARTIAL PASS` **ដាច់ពី `PASS`** ដើម្បីកុំឲ្យការគ្របតេស្ត
មើលទៅពេញខណៈ browser មិនបានរត់។

Chromium នៅ `/opt/pw-browsers/chromium-*/chrome-linux/chrome` — ប្តូរបានតាម
env `*_CHROME` របស់ checker នីមួយៗ។

### ២. រត់ទាំងអស់

```bash
bash audit-tools/run-all.sh
```

**រត់វាមុនចាប់ផ្តើម និងក្រោយកែរាល់ដង។** បើវាបៃតងទាំងអស់ នោះមានន័យថា
កំហុសដែលបានដោះស្រាយរួច មិនបានត្រឡប់មកវិញទេ។

### ៣. រត់តែមួយ

```bash
node audit-tools/policy-test.js
node audit-tools/trash-modal-test.js
```

### ៤. រត់លើ tree ផ្សេង (បញ្ជាក់ថាតេស្តមិនទទេ)

រាល់ checker ភាគច្រើនទទួល env override ដើម្បីចង្អុលទៅថតផ្សេង។ នេះជាវិធី
បញ្ជាក់ថា **តេស្តថ្មីពិតជាចាប់កំហុស** ៖

```bash
git fetch origin main
rm -rf /tmp/baseline && mkdir /tmp/baseline
git archive origin/main | tar -x -C /tmp/baseline
bash audit-tools/run-all.sh /tmp/baseline    # ចំណុចដែល *គួរតែធ្លាក់* នឹងបង្ហាញ
```

⛔ **បើតេស្តថ្មីជោគជ័យលើ tree មុនកែ នោះវាមិនចាប់អ្វីទេ — សរសេរវាឡើងវិញ។**
⚠️ ត្រូវ `git archive origin/main` មិនមែន `HEAD` បើបាន commit ការកែរួចហើយ។

### ៥. Firebase RTDB emulator (សម្រាប់ការកែ rules)

```bash
npm i firebase-tools
npx firebase setup:emulators:database   # ចាំបាច់ — ថត cache ទទេក្រោយ npm i
java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/rules.sh
```

`real.rules.json` ជាឯកសារបង្កើតឡើងវិញរាល់ដង (gitignored) — **ចម្លងពី
`firebase-database.rules.json` ជានិច្ចមុនរត់** ដើម្បីកុំឲ្យតេស្តលើ rules ចាស់។

**អន្ទាក់ ៤ ដែលខាតពេលច្រើន** ៖

1. `firebase emulators:start` **upload rules មិនចេញ** កាត់ proxy — រត់ jar ផ្ទាល់។
2. `.settings/rules.json` និង `auth_variable_override` **ទាំងពីរត្រូវការ**
   `-H "Authorization: Bearer owner"` — បើគ្មាន rules មិន load ទេ ហើយ
   **តេស្តទាំងអស់ជោគជ័យក្លែងក្លាយ**។
3. កុំប្រើ `pkill -f firebase-database-emulator` — វាផ្គូផ្គងនឹង shell
   របស់ខ្លួនឯង។ បិទតាម PID វិញ រួចផ្ទៀងផ្ទាត់ដោយ `curl` ទៅ port 9000។
4. request ដែលមាន `Bearer owner` **ដោយគ្មាន** `auth_variable_override`
   ត្រូវចាត់ទុកជា project owner ➜ **រំលង rules ទាំងស្រុង**។ សម្រាប់តេស្ត
   «unauthenticated ត្រូវ DENIED» **កុំផ្ញើ Authorization header សោះ**។

⛔ **តែងតែពិនិត្យថា write ដែលគួរ DENIED ពិតជា DENIED** មុននឹងជឿលទ្ធផល។

### ៦. បញ្ជី checker និង env override

#### Meta — ត្រួតពិនិត្យឧបករណ៍ខ្លួនឯង (**រត់ ៣ នេះមុនគេ**)

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `checker-coverage.js` | checker ត្រូវ **អាចធ្លាក់បាន** — ថតទទេ ➜ គ្មានមួយណាបៃតង; CI មិនរត់ checker ដែល `run-all.sh` មិនរត់; `pageerror` ត្រូវឃើញការបដិសេធ promise ដែរ | — |
| `hang-guard.js` | checker ត្រូវអាចធ្លាក់បាន **ក្នុងពេលកំណត់** — ការព្យួរ ≠ ការធ្លាក់ | `HANGGUARD_APP_DIR` |
| `exit-code-integrity.js` | ការធ្លាក់ត្រូវឡើងដល់ **exit code** — «FAIL» ដែលចេញ exit 0 = បៃតងក្លែងក្លាយ | `EXITCODE_APP_DIR` |
| `shared-fns.js` | helper ដែលចែករំលែក ZoeW ↔ ZoeKeyGen ត្រូវ byte-identical | — |
| `version-check.js` | `app.js` ↔ `manifest.json` ↔ `index.html` ក្នុង App នីមួយៗ | `VERSION_APP_DIR` |
| `version-bump-scope.js` | ឡើងកំណែ **តែ App ដែលកែពិត** | `VERSIONSCOPE_APP_DIR` · `VERSIONSCOPE_BASE` |
| `netlify-config-scope-test.js` | ⛔ **គ្មាន root `netlify.toml`** (វាបង្វែរ build របស់ App មួយទៀត) · config ត្រូវស៊ីនឹងអ្វីដែល App ship · រាល់ config ត្រូវមាន checker អាន | `NETLIFYSCOPE_APP_DIR` |
| `function-surface-test.js` | ផ្ទៃ function ទាំងមូល · ទប់ declaration ឈ្មោះស្ទួន · រាល់ `data-act` មាន function ពិត | `FNSURFACE_APP_DIR` |

#### តក្កវិជ្ជាអាជីវកម្ម — លុយ · ធុងសំរាម · ការសម្អាត

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `policy-test.js` | គោលការណ៍ **លុប ទល់នឹង ដក**; `deleteSingleItem` និង `buildClearHistoryTrashItem` **មិនប៉ះលុយ** | `POLICY_APP_DIR` |
| `trash-modal-test.js` | ស្លាកធុងសំរាម ↔ ថេរ · ការ merge · តួលេខសរុប ២ ក្រុម | `TRASH_APP_DIR` |
| `partial-pickup-cleanup-test.js` | ច្បាប់ ២ ម៉ោង / ថ្ងៃទី ៨ ដើរតាម **barcode** មិនមែនកញ្ចប់ | `PARTIAL_APP_DIR` |
| `restore-marker-hygiene-test.js` | marker របស់ប្រវត្តិ មិនធ្លាក់ចូលធុងសំរាម · ការសម្អាតមិនដណ្តើមធាតុដែលកំពុងស្តារ | `MARKER_APP_DIR` |
| `pickup-ledger-test.js` | អតិថិជនយក ↔ កញ្ចប់យក រាប់លើ **មូលដ្ឋានតែមួយ** | `PICKUP_APP_DIR` |
| `pickup-reset-test.js` | Reset ស្ថិតិយក ៖ node នៅមានជាមួយ `0` · គោរពតម្រង · មិនប៉ះលុយ | `PICKUPRESET_APP_DIR` |
| `pickup-repair-test.js` | ការជួសជុលស្ថិតិយកស្វ័យប្រវត្តិ | `PICKUPREPAIR_APP_DIR` |
| `revenue-fuzz-test.js` | invariant ចំណូល/ស្ថិតិ លើលំដាប់ចៃដន្យ (rules ពិត · អថេរ registry និងធុងសំរាម) | `FUZZ_APP_DIR` |
| `ledger-clamp-symmetry-test.js` | «អនុវត្ត ➜ ដកវិញ» ត្រូវជាគូបញ្ច្រាសពិត — ការ clamp ត្រឹម 0 មិនត្រូវបង្កើតចំណូល | `CLAMPSYM_APP_DIR` |
| `emu/ledger-revert-emu-test.js` | ដដែល តែវាស់លើ **RTDB emulator ពិត ជាមួយ rules ពិត** (មិនមែន stub) | `LEDGEREMU_APP_DIR` |
| `money-guardian-test.js` | ⛔ **«សំណុំបៃតង» មិនមែនភស្តុតាង** — បំបែកតក្កវិជ្ជាលុយ រួចទាមទារថាអ្នកយាមយ៉ាងតិច ១ ក្រហម | `MONEYGUARD_APP_DIR` |
| `price-edit-abort-test.js` | ⛔ transaction ដែល **បោះបង់** ➜ ការបញ្ច្រាសលុយត្រូវរត់ដដែល · ការ **ព្យួរ** ≠ ការបរាជ័យ | `PRICEABORT_APP_DIR` |
| `stale-write.js` | គ្មានការសរសេរ item ទាំងមូលពីសតិ | `STALEWRITE_APP_DIR` |
| `compensation-order.js` | `.then(A).catch(B)` ដែល B ជាការសង្គ្រោះ | `COMP_APP_DIR` |
| `payload-schema.js` | payload ដែលសរសេរទៅ Firebase ↔ schema ក្នុង rules (**២ ទិស**) | — |
| `field-shape-test.js` | រូបរាងវាលឆៅ (លេខជាចំនួន · null · XSS) | `FIELDSHAPE_APP_DIR` |
| `raw-read-shape-test.js` | រូបរាងទិន្នន័យដែលអានចេញ | `RAWREAD_APP_DIR` |
| `concurrent-scan-test.js` | ការស្កេនស្របគ្នា | `CONCSCAN_APP_DIR` |
| `slow-write-test.js` | ការសរសេរដែលចុះយឺតក្រោយ timeout | `SLOWWRITE_APP_DIR` |
| `restore-race-test.js` · `restore-finalization-fence-test.js` | ការស្តារស្របគ្នា និង fence | — |
| `clear-history-claim-test.js` · `clear-history-finalization-fence-test.js` | «លុបទាំងអស់» claim និង fence | — |
| `emu/crud-rules-flow.js` | payload ពិត ធៀបនឹង **rules ពិត** លើ emulator | `CRUDFLOW_APP_DIR` |
| `emu/restore-deadlock-test.js` | witness ដែលបន្សល់ មិនត្រូវចាក់សោ id (deadlock ៣ ខាង) | `DEADLOCK_APP_DIR` |
| `emu/rules.sh` | rules ពិតលើ emulator ពិត | — |
| `rules-duplicate-keys.js` | rules JSON គ្មានកូនសោស្ទួន | — |

#### នាឡិកា និងពេលវេលា

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `clock-hygiene.js` | retention ប្រើ `getServerNow()` មិនមែន `Date.now()` | `CLOCK_APP_DIR` |
| `monotonic-gate-test.js` | រយៈពេលកន្លងផុតឆ្លងកាត់ `elapsedSince()` (ថយក្រោយ ➜ fail-open) | `MONOGATE_APP_DIR` |
| `khmer-timezone-test.js` | ប្រតិទិនអាជីវកម្មជា `Asia/Phnom_Penh` គ្រប់ឧបករណ៍ | `KHMERTZ_APP_DIR` |
| `cleanup-clock-guard-test.js` | ការសម្អាតដែលបំផ្លាញ ត្រូវការនាឡិកា server **និងការភ្ជាប់រស់** | `CLEANUPCLOCK_APP_DIR` |

#### បណ្តាញ · ការតភ្ជាប់ · Service Worker

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `connection-recovery-test.js` | listener ដែលធ្លាក់ត្រូវត្រឡប់មកវិញ · បងប្អូនមិនប្រកាសជំនួស · `.info/*` ដែរ | `CONNRECOVERY_APP_DIR` |
| `reconnect-ladder-test.js` | វដ្តភ្ជាប់ឡើងវិញមិនកាត់ handshake | `LADDER_APP_DIR` |
| `network-timeout-test.js` | រាល់ `fetch` ត្រូវ abort ពិត | `NETTIMEOUT_APP_DIR` |
| `network-pressure-test.js` | ពិដានចំនួនសំណើស្របគ្នា | `NETPRESSURE_APP_DIR` |
| `license-network-pressure-test.js` | ផ្លូវបណ្តាញទី ៣ (`license-verify.js`) មានពិដានដែរ | `LICPRESSURE_APP_DIR` |
| `stall-guard-test.js` | បណ្តាញ «ភ្ជាប់តែស្លាប់» ព្យួរ — មិនបោះកំហុស | `STALLGUARD_APP_DIR` |
| `db-stall-guard-test.js` | RTDB មិនបដិសេធពេលក្រៅបណ្តាញ ➜ សោ in-flight ជាប់រហូត | `DBSTALL_APP_DIR` |
| `write-stall-guard-test.js` | ការសរសេរដែលព្យួរ **ខាងក្រោយ helper** ➜ ការសម្អាតស្វ័យប្រវត្តិងាប់ · គ្មានសារដល់អ្នកប្រើ | `WRITESTALL_APP_DIR` |
| `periodic-network-guard-test.js` | ការងារតាមវដ្តមិនស៊ីបណ្តាញខុសពេល | `PERIODICGUARD_APP_DIR` |
| `adaptive-link-test.js` | ការងារស្រេចចិត្តសម្របតាម 2G/Data Saver (**fail open**) | `ADAPTIVE_APP_DIR` |
| `history-patch-retry-test.js` | ការដាច់បណ្តាញ ≠ ការបរាជ័យ — ការសរសេរត្រូវរត់ឡើងវិញ | `HISTPATCH_APP_DIR` |
| `sw-install-integrity-test.js` | SW មិន activate ដោយសំបកមិនពេញ | `SWINTEG_APP_DIR` |
| `sw-shell-latency-test.js` | សំបកដែល cache រួច មិនរង់ចាំបណ្តាញ | `SWLATENCY_APP_DIR` |
| `sw-cache-key-test.js` | URL រសើប (Setup Link) មិនជាប់ក្នុង Cache Storage | `SWKEY_APP_DIR` |
| `sw-cache-failure-test.js` | Cache API បរាជ័យ ≠ App ដាច់ | `SWFAIL_APP_DIR` |
| `sw-revalidate-pressure-test.js` | ការធ្វើឲ្យសំបកស្រស់ មិនស៊ីកូតាការតភ្ជាប់ | `SWREVAL_APP_DIR` |
| `sw-abort-propagation-test.js` | SW គោរព caller abort | `SWABORT_APP_DIR` |
| `offline-shell-test.js` | ស្កេនដើរពេលបណ្តាញដាច់ (គ្មានការពឹងលើ CDN) | `OFFLINE_APP_DIR` |
| `sdk-surface.js` | `fb.X` ដែល loader មិន export ➜ `undefined` ស្ងាត់ | `SDKSURFACE_APP_DIR` |
| `sdk-offline-boot-test.js` | បើកក្រៅបណ្តាញ ➜ ស្ថានភាព «ក្រៅបណ្ដាញ» មិនមែនប្រអប់ Config | `SDKBOOT_APP_DIR` |

#### Lookup API និង ZTO

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `lookup-prefetch-test.js` | ការទាញតារាងជាមុន ៖ ព្យាយាមវិញលឿន តែមិនបាញ់ចំពេលស្កេន | `LOOKUPPREFETCH_APP_DIR` |
| `lookup-freshness-test.js` | នាំចូលរួច ➜ ទិន្នន័យត្រូវមកភ្លាម (client **និង** Apps Script) | `LOOKUPFRESH_APP_DIR` |
| `lookup-failure-identity-test.js` | `lookupCode` ត្រូវរស់រានពីការព្យាយាមឡើងវិញ | `LOOKUPFAILURE_APP_DIR` |
| `lookup-burst-test.js` | ការស្កេនជាបន្តបន្ទាប់ ៖ ការរវល់ជា *ការរង់ចាំ* មិនមែន *ការបញ្ចប់* | `LOOKUPBURST_APP_DIR` |
| `lookup-config-secret-test.js` | Secret របស់ Lookup API ត្រូវអ៊ិនគ្រីប | — |
| `google-sheets-cache-test.js` | cache ខាង Apps Script | — |
| `sheet-import-test.js` | នាំចូល Excel ៖ PIN ជាច្រកទ្វារ · *simple request* · secret អ៊ិនគ្រីប · លេខ ០ នាំមុខ | `SHEETIMPORT_APP_DIR` |
| `zto-proxy-test.js` | ZTO proxy ៖ ការដក auto-login · ថវិកាពេល · «រកមិនឃើញ» ≠ កំហុស · `?diag=1` គ្មាន secret | `ZTOPROXY_APP_DIR` |
| `zto-cookie-store-test.js` | Cookie ក្នុង Netlify Blobs · Blobs មិនមែនចំណុចដាច់តែមួយ · ការបន្តអាយុ | `ZTOSTORE_APP_DIR` |
| `zto-budget-test.js` | ⛔ ថវិកាពេលត្រូវគ្របដណ្តប់ handler ទាំងមូល (អាន Cookie + upstream + ការបន្តអាយុ) · 401 ដោយ Cookie ចាស់ក្នុង cache ➜ អានឡើងវិញ ១ ដង | `ZTOBUDGET_APP_DIR` |
| `zto-negative-cache-test.js` | ⛔ សាលក្រម «រកមិនឃើញ» ត្រូវចូល cache (TTL ខ្លី) ដោយ **ការបរាជ័យបណ្តោះអាសន្នមិនចូល** · ស្នាមភ្ជាប់ ៖ លេខលំនាំដើមក្នុង `ZTO-SETUP-KH.md` ត្រូវស៊ីនឹងកូដ | `ZTONEG_APP_DIR` |
| `zto-cookie-sync-test.js` | Windows helper ៖ ចាប់ header ពិត · DPAPI · signed URL · របៀប `--auto` | `ZTO_SYNC_APP_DIR` |

⛔ ក្រុមតេស្តរបស់ `zto-proxy-test.js` រត់ **តាមលំដាប់** ព្រោះពួកវាចែក
`process.env` និង `global.fetch` — ការរត់ស្របគ្នាបង្កើត **ការធ្លាក់ក្លែងក្លាយ**។

#### សុវត្ថិភាព · License · Storage

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `csp-enforced-test.js` | បម្រើ App ជាមួយ **header CSP ពិត** ➜ គ្មានការរំលោភ ហើយ UI នៅដើរ | `CSP_APP_DIR` |
| `csp-lazy-resource-test.js` | ធនធានផ្ទុក **យឺត** ក៏ត្រូវឆ្លង CSP ដែរ | `CSPLAZY_APP_DIR` |
| `inline-handler-xss-test.js` | ខ្សែអក្សរពី Firebase មិនធ្លាក់ចូល attribute របស់ handler | `INLINEXSS_APP_DIR` |
| `html-sink-escaping.js` | រាល់តម្លៃចូល HTML ត្រូវ `sanitizeInput()` (**ទាំង ២ ទម្រង់**) | `SINK_APP_DIR` |
| `secret-hygiene.js` | credential ក្នុង DOM · ការលាក់ secret មុនផ្ញើទៅ Sentry | — |
| `storage-guard.js` | រាល់ការប៉ះ storage ត្រូវការពារ (getter ខ្លួនវាក៏បោះដែរ) | `STORAGE_APP_DIR` |
| `storage-blocked-boot-test.js` | storage ដែលត្រូវបិទ ➜ App នៅតែបើកបាន | `STORAGEBOOT_APP_DIR` · `STORAGEBOOT_CHROME` |
| `dom-hygiene.js` · `state-hygiene.js` | គ្មានទិន្នន័យអតិថិជនសល់ក្រោយចាកចេញ | — |
| `setup-link-logout-test.js` | Setup Link មិនរស់រានក្រោយចាកចេញ | `SETUP_APP_DIR` |
| `setup-link-roundtrip-test.js` · `setup-link-browser-test.js` | ZoeKeyGen encode ↔ ZoeW decode | `SETUPRT_APP_DIR` · `SETUPLINK_APP_DIR` |
| `pin-prompt-test.js` | សារប្រអប់ PIN ត្រូវតាមប៊ូតុងដែលហៅ | `PINPROMPT_APP_DIR` |
| `biometric-unlock-test.js` | ជីវមាត្រជាការ **ដោះសោ PIN** មិនមែនជំនួស PIN | `BIOMETRIC_APP_DIR` |
| `app-lock-test.js` | ចាក់សោ App ៖ មិនប៉ះ session ៤ ម៉ោង · Refresh និងការខលមិនចាក់សោ | `APPLOCK_APP_DIR` · `APPLOCK_CHROME` |
| `license-grace-test.js` | «ផ្ទៀងផ្ទាត់មិនបាន» ≠ «ហត្ថលេខាខុស» — កុំលុប record | — |
| `license-clock-trust-test.js` | ទង់ «sync រួច» បើកតែដោយតម្លៃពី server ពិត | `LICENSECLOCK_APP_DIR` |
| `license-clock-rollback-test.js` | ម៉ោងមិនអាចថយក្រោយ; Activate ត្រូវការសាលក្រម server | `LICROLLBACK_APP_DIR` |
| `keygen-pin-flow-test.js` · `keygen-session-security-test.js` | ផ្លូវ PIN និង session របស់ ZoeKeyGen | `KEYGEN_APP_DIR` |
| `keylist-consistency-test.js` | meta ចាស់/ថ្មី merge ត្រឹមត្រូវ | — |
| `auth-recovery-test.js` | ការស្ដារ session ពេលបណ្ដាញយឺត (ZoeKeyGen) | `AUTH_APP_DIR` |
| `devtools-guard-test.js` | ការរកឃើញ DevTools (ZoeKeyGen) | `DEVGUARD_APP_DIR` |
| `dependency-security-test.js` | dependency ដែល vendor ត្រូវចាក់សោដោយ hash | `DEPSEC_APP_DIR` |
| `firebase-config-paste-test.js` · `firebase-backup-test.js` | ការ paste Config និង CLI បម្រុងទុក | `FBACKUP_APP_DIR` |

#### UI · ទម្រង់បង្ហាញ · កាយវិការ

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `layout-check.js` | CSS បំបែក/លើសទទឹង លើ 320–1440px (**អះអាង ២ ខាង**) | `LAYOUT_APP_DIR` |
| `fluid-type-focus-test.js` | មាត្រដ្ឋានអក្សរ ៣ ជំហាន និងសញ្ញាផ្តោត | `FLUIDTYPE_APP_DIR` |
| `gesture-test.js` | PTR · ការលាក់របា Tab · ចង្វាក់ស៊ុម | `GESTURE_APP_DIR` |
| `panel-motion-test.js` | ចលនាផ្ទាំង ១:១ (កម្ពស់ស្មើ · snap ↔ PTR) | `PANELMOTION_APP_DIR` |
| `ios-panel-glide-test.js` | ចលនាលើ iOS មិនឃ្លាតពី Android | `IOSGLIDE_APP_DIR` |
| `phone-search-swipe-test.js` | កាយវិការអូស និង auto pull up | `SWIPE_APP_DIR` |
| `phone-suggest-test.js` | ការណែនាំលេខទូរស័ព្ទ | `PHONE_APP_DIR` |
| `page-nav-test.js` | រចនាសម្ព័ន្ធទំព័រ · របា Slide · Locker | `PAGENAV_APP_DIR` |
| `ui-flow-test.js` | អន្តរកម្មជម្រៅ · ការប្រណាំងឧបករណ៍ច្រើន · ផ្លូវបរាជ័យ | `UIFLOW_APP_DIR` |
| `toast-truth-test.js` | Toast និយាយការពិត realtime | `TOAST_APP_DIR` |
| `boot-runtime.js` · `boot-animation-test.js` | កំហុស runtime ពេល boot · ចលនា boot · ធនធានឆ្លង origin | `BOOT_APP_DIR` · `BOOTANIM_APP_DIR` |
| `animation-cost.js` · `layout-thrash.js` | ចលនាដែលបង្កើត layout/paint រាល់ស៊ុម | `ANIM_APP_DIR` · `THRASH_APP_DIR` |
| `css-classes.js` · `css-media-override.js` | class គ្មានច្បាប់ · ច្បាប់ `@media` ដែលស្លាប់ | `CSSMEDIA_APP_DIR` |
| `listener-leak-test.js` | listener/node កកកុញឆ្លងវដ្តពិត | `LEAK_APP_DIR` · `LEAK_CHROME` |
| `wiring.js` | HTML ↔ JS មិនត្រូវគ្នា (`id` · `data-act` · `data-close`) | — |
| `perf-check.js` | ដំណើរការនៅទិន្នន័យធំ | `PERF_APP_DIR` |
| `sentry-load-race-test.js` | Sentry មកយឺត ➜ កំហុសមិនធ្លាក់ចោល | `SENTRYRACE_APP_DIR` |

#### ការស្កេន · Export · ទម្លាប់គម្រោង

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `scan-engine-test.js` | ល្បឿន · ជួរអាន · ភាពត្រឹមត្រូវនៃ Barcode (ITF ត្រូវបដិសេធ) | `SCAN_APP_DIR` |
| `duplicate-scan-test.js` | ការទប់ស្កាត់ Barcode ស្ទួន ៥ ជាន់ | `DUP_APP_DIR` |
| `barcode-shape-test.js` | រូបរាង Barcode | `BARCODE_APP_DIR` |
| `camera-resume-test.js` | កាមេរ៉ាកកក្រោយប្រអប់ native · dependency អវត្តមាន | `CAMERA_APP_DIR` |
| `export-cells-test.js` | លេខទូរស័ព្ទ/Barcode ជា TEXT ក្នុង XML · CSV មិនក្លាយជារូបមន្ត | — |
| `listener-pending-key-test.js` | កូនសោដែលសួរ ត្រូវជាកូនសោដែលដាក់ចូល | `PENDINGKEY_APP_DIR` |
| `comments.js` · `strip-comments.js` | កូដ App ដែល ship ត្រូវគ្មាន comment | `STRIP_APP_DIR` |
| `trimws.js <files>` | លុប trailing whitespace | — |

### ៧. Allowlist — កុំបន្ថែមដោយគ្មានហេតុផល

`dom-hygiene.js` (`ACCEPTED`) · `state-hygiene.js` · `css-classes.js`
(`IGNORE`) · `shared-fns.js` (`EXPECTED_DIVERGENT`) មាន allowlist ដែល
**រាល់ធាតុមានហេតុផលសរសេរជាប់**។

⛔ **ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។** បើបន្ថែម helper ចែករំលែកថ្មី
ដែលត្រូវតែដូចគ្នា **កុំដាក់វាចូល `EXPECTED_DIVERGENT`** — ចម្លងឲ្យដូចគ្នាវិញ។

### ៨. អន្ទាក់ក្នុង harness (បើសាង harness ថ្មី)

1. **`snapshot.val()` ត្រូវត្រឡប់ច្បាប់ចម្លងជ្រៅ** — បើត្រឡប់ reference
   ទៅ store នោះទិន្នន័យក្នុងសតិក្លាយជា alias ➜ ការកែត្រូវរាប់ពីរដង។
2. **អថេរ `let` កម្រិត module មិនស្ថិតលើ `window`** — មានតែ `function`
   declaration ទេ។ អានវាដោយឈ្មោះទទេ (`typeof x !== 'undefined' ? x : {}`)។
3. **seed ត្រូវប្រាកដនិយម** — ចំណូលថ្ងៃ **≥** ផលបូក item បើមិនដូច្នេះ
   clamp-to-0 បាញ់ ហើយការ revert មើលទៅដូចមិនស៊ីមេទ្រី ខណៈវាត្រឹមត្រូវ។
4. **Fake SDK ត្រូវគាំទ្រ `increment()`** — បើគ្មាន វា throw ហើយ invariant បែក។
5. **ការធ្វើតេស្តការប្រណាំង** ត្រូវដាក់ការសរសេររបស់ឧបករណ៍ផ្សេង **ក្នុងចន្លោះ**
   នៃការអាន និងការសរសេរ មិនមែនក្រោយវាទេ។

---

## ប្រព័ន្ធសុវត្ថិភាព

### ច្បាប់សម្រាប់ checker ខ្លួនឯង

| ច្បាប់ | មូលហេតុ |
|---|---|
| **`listen(0, '127.0.0.1')` ជានិច្ច** | port ថេរ ➜ ការរត់ ២ ស្របគ្នាធ្លាក់ដោយ `EADDRINUSE` (សញ្ញាក្លែងក្លាយ); `listen(port)` ទទេ bind `0.0.0.0` ➜ បើកថត App ចំហលើគ្រប់ interface |
| **ការពុលត្រូវធ្វើលើឯកសារស្រមោល** | `exit-code-integrity.js` ពុលច្បាប់ចម្លង `.tmp-poison-*` ➜ SIGKILL មិនអាចធ្វើឲ្យ repo ខូច |
| **ការអះអាង *អវត្តមាន* ត្រូវមានជាន់អប្បបរមា** | «គ្មានលំនាំអាក្រក់ទេ» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ |
| **កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ** | `process.exit(1)` បិទបាំងការអះអាងខាងក្រោម ➜ រាយវាជាការធ្លាក់ **ដែលមានឈ្មោះ** រួច stub ជំនួស |
| **SKIP តែសម្រាប់ dependency របស់បរិស្ថាន** | SKIP លើឯកសាររបស់ repo ខ្លួនឯង ជាបៃតងក្លែងក្លាយ |
| **គ្មាន secret ក្នុងតេស្ត** | តម្លៃសាកល្បងត្រូវជាតម្លៃក្លែង; response body ដែលអាចមាន secret ត្រូវបោះចោល |

### សំណួរ ១១ មុនជឿថា checker ថ្មីមួយដំណើរការ

១. វាស្កេន **ឯកសារណា**ខ្លះ?
២. វាស្កេន **ទម្រង់វេយ្យាករណ៍ណា**ខ្លះ? (template literal ធៀបនឹងការតភ្ជាប់ខ្សែអក្សរ)
៣. វាពិនិត្យ **ទិសណា**? (marker ចូល និងចេញ)
៤. **តើវាអាចធ្លាក់បានទេ?** ➜ `node audit-tools/checker-coverage.js`
៥. **តើវាអាចព្យួរបានទេ?** ➜ `node audit-tools/hang-guard.js`
៦. **តើការធ្លាក់ឡើងដល់ exit code ទេ?** ➜ `node audit-tools/exit-code-integrity.js`
៧. តើមានឧបករណ៍ណាឃើញ **ស្នាមភ្ជាប់** រវាងឯកសារ ២ ទេ?
៨. វាដាក់ប្រព័ន្ធក្នុង **ស្ថានភាព** ណា មុនអះអាង?
៩. វាដាក់ dependency ក្នុង **របៀបបរាជ័យ** ណា? (ធ្លាក់ ≠ ព្យួរ)
១០. តើវាឃើញ **ការបដិសេធ promise** ទេ?
១១. តើការធ្លាក់របស់វា ជាការធ្លាក់ពិត ឬសំណល់នៃការវាស់?

⛔ **Mutation testing ៖ សួរថា *អ្នកណាចាប់* មិនមែន *តើចាប់បានទេ*។** ពេល
mutation មួយត្រូវចាប់បាន ត្រូវសួរបន្តថា «តើ checker ណាទៀត *គួរ* ចាប់វា
តែមិនចាប់?» — ចម្លើយបង្ហាញព្រំដែនពិតនៃការគ្របដណ្តប់។

---

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — ផ្នែកមួយនៃ Zoe-System។ ឧបករណ៍ទាំងនេះមិន deploy
និងមិនត្រូវការ Activation Key ទេ។
