# Supabase (Project តែមួយ · ហាងច្រើន) — ឯកសារបញ្ជូនការងារ

> ⛔ ឯកសារនេះជា **prompt ធ្វើការ** សម្រាប់ session Claude ថ្មី ដែលបន្តការងារ Supabase លើ branch
> **`claude/great-ritchie-47ujj5`** (មិនទាន់ merge ចូល `main` · ⛔ កុំ merge ដោយគ្មានការស្នើពីម្ចាស់គម្រោង)។
> អាន `CLAUDE.md` ទាំងស្រុងជាមុនសិន។ ពេលការងារចប់ ➜ ផ្លាស់ខ្លឹមសារសំខាន់ទៅ `CLAUDE.md` (ច្បាប់) និង
> `docs/HISTORY.md` (ប្រវត្តិ) រួច **លុបឯកសារនេះ** (និងធាតុរបស់វាក្នុង `audit-tools/repository-file-coverage.json`)។
> ⛔ ផ្ទៀងផ្ទាត់ស្ថានភាព git ដោយខ្លួនឯង (`git log --oneline origin/main..HEAD`) — ឯកសារនេះមិនមែនភស្តុតាងទេ។

## ១. សំណើរបស់ម្ចាស់គម្រោង (ខ្លឹមសារ)

- ឈប់បង្កើត Firebase Project · Rules · គណនី Login ដោយដៃ ក្នុងមួយអតិថិជន។
- **Supabase Project តែមួយ** (Free 500MB · Upgrade ទៅ Pro លើ Project ដដែលពេលអតិថិជនច្រើន — គ្មាន migration)
  ➜ ទិន្នន័យកញ្ចប់របស់ហាងទាំងអស់ក្នុងតារាងរួម បំបែកដោយ `tenant_id` + RLS (ហាងមិនឃើញគ្នា)។
- អតិថិជនចុះឈ្មោះ/ចូលដោយខ្លួនឯង (Modal ក្នុង ZoeW) ៖ ម្ចាស់គម្រោង **ជ្រើស «Supabase + កូដអញ្ជើញ»** (មិនមែន SMS OTP ព្រោះ
  Firebase Phone Auth ត្រូវការ Blaze/ចំណាយ) ➜ កូដអញ្ជើញដែលអ្នកលក់ចេញ **ចងលេខសាខា (branch_code) របស់ហាង** ពេលចុះឈ្មោះជោគជ័យ។
- ⛔ **មិន Hardcode** ៖ ការតភ្ជាប់ទាំងអស់ dynamic ដូចមុន (Config/Setup Link លើឧបករណ៍ · env នៅ server)។

## ២. អ្វីដែលធ្វើរួច (commit លើ branch · ផ្ទៀងតាម `git log`)

| ផ្នែក | ឯកសារ | អ្នកយាម (វាស់រួច · mutation ចាប់) |
|---|---|---|
| Tenancy + កូដអញ្ជើញ + កូដប្តូរពាក្យសម្ងាត់ | `supabase/migrations/20260930120000_zoe_tenancy.sql` · `supabase/functions/{register,reset-password,_shared}` | `audit-tools/supabase-rls-test.js` (283) · `supabase-functions-test.js` (154) |
| Rules RTDB អនុវត្តក្នុង Postgres (`firebase-database.rules.json` ជាប្រភពតែមួយ) | `supabase/scripts/rtdb-rules.mjs` · `generate-rules-sql.mjs` ➜ `migrations/20261001000100_zoe_rules.sql` | `emu/supabase-rules-parity-test.js` (RTDB emulator ជា oracle ៖ ការសរសេរពិត ៦៤២ សាលក្រមដូចគ្នា) |
| ឃ្លាំងទិន្នន័យដូច RTDB (`zoe_docs` · seq · tombstone · CAS · increment · op_id idempotent · Realtime broadcast) | `migrations/20261001000200_zoe_datastore.sql` | `supabase-datastore-test.js` (102) |
| adapter `fb` លើ Supabase ក្នុង ZoeW (surface ដូច SDK Firebase) | `ZoeW/src/services/supabase-{rtdb,sdk,transport,config,backend}.ts` · `tx-disconnect.ts` | `emu/supabase-adapter-parity-test.js` (SDK Firebase ពិត ធៀប adapter · ៧៩ · mutation ១៤/១៤) |
| ភ្ជាប់ចូល App ៖ `initFirebase()` ផ្ទុក chunk Supabase តាម dynamic import តែពេល Config មាន `supabaseUrl` | `ZoeW/src/services/firebase-init.ts` | build ៖ supabase-js នៅក្នុង chunk `supabase-backend-*.js` តែមួយ |
| Config/Setup Link ទទួល `{supabaseUrl, supabaseKey, loginDomain?, invite?}` · បដិសេធ Secret key | `ZoeW/src/features/config.ts` | `ZoeW/tests/supabase-account.test.tsx` (១២ · mutation ៩/៩) |
| Modal ចូល (ឈ្មោះគណនី) · ចុះឈ្មោះដោយកូដអញ្ជើញ · ប្តូរពាក្យសម្ងាត់ ⛔ Firebase mode មិនប្រែ | `ZoeW/src/app/components/modals/LoginModal.tsx` · `features/account.ts` · `features/auth.ts` (`performLogin`) | ដដែល |
| ស្ថានភាពហាង (server) ជំនួស Activation Key · 🩺 ជួរ License = ស្ថានភាពហាង · journal ការសម្អាតចងនឹង tenant | `features/license.ts` · `features/health-check.ts` · `domain/cleanup.ts` | ដដែល |
| ZTO Function ៖ token Supabase ➜ សួរ `my_account` ➜ សាខា = `branch_code` របស់ហាង | `ZoeW/netlify/functions/zto-order-detail.js` (env `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY`) | `zto-list-sync-test.js` ផ្នែក ២០ (៣៧០ · mutation ៥/៦ · ១ equivalent) |
| CSP `connect-src` ៖ ZoeW `https://*.supabase.co wss://*.supabase.co` · ZoeKeyGen `https://*.supabase.co` | `ZoeW/netlify.toml` · `ZoeKeyGen/netlify.toml` | `netlify-config-scope-test.js` ផ្នែក ង |
| ZoeKeyGen ៖ កាត «🏪 ហាង Supabase» (ចូលជា Admin · បង្កើតហាង + កូដអញ្ជើញម្ចាស់ហាង + Setup Link/QR · កូដអញ្ជើញបុគ្គលិក · ពន្យារ/បិទ · កូដប្តូរពាក្យសម្ងាត់) | `ZoeKeyGen/index.html` · `app.js` (`sbAdmin*` · `sb*`) · `style.css` | ⛔ **មិនទាន់មានអ្នកយាម** (ជំហាន ៣ក) |

## ៣. ការងារដែលនៅសល់ (តាមលំដាប់)

### ៣ក. ZoeKeyGen ៖ អ្នកយាមផ្ទាំងអ្នកលក់ (`audit-tools/keygen-supabase-admin-test.js` — ឯកសារថ្មី)
- គំរូ ៖ `audit-tools/keygen-notice-test.js` (ស្រង់ function ពិតពី `ZoeKeyGen/app.js` ចូល `vm` + DOM stub)។
- Backend ពិត ៖ `audit-tools/supabase-pg.js` (Postgres ពិត + migration ពិត) + `audit-tools/supabase-fake-server.js`
  (✅ **ពង្រីករួច** ៖ GET `/rest/v1/<table>?select=…&order=col.asc|desc` · RPC ត្រឡប់ composite ជា object · 23505 ➜ 409)។
  គណនី admin ៖ `fake.addUser(...)` + `insert into public.platform_admins`។ ⛔ `sbAdminConfigProblem()` អនុញ្ញាត `http://127.0.0.1` សម្រាប់តេស្ត។
- សេណារីយ៉ូដែលត្រូវវាស់ ៖ Secret key/`service_role` ➜ បដិសេធ · គណនីមិនមែន admin ➜ «forbidden» + panel លាក់ · admin ➜ បញ្ជីហាង ·
  បង្កើតហាង (ឈ្មោះមាន `<img onerror>` ➜ escape) ➜ កូដអញ្ជើញ owner ក្នុង DB + Setup Link decode បាន `{supabaseUrl, supabaseKey, invite}` ·
  សាខាស្ទួន ➜ សារ `branch-taken` · `sb-invite` លើហាងមាន owner ➜ role `member` · `sb-extend` ➜ `expires_at` = max(ឥឡូវ, ចាស់) + N ថ្ងៃ ·
  `sb-revoke` បិទ/បើក · កូដប្តូរពាក្យសម្ងាត់ (ឈ្មោះមិនស្គាល់ ➜ `member-not-found`) · JWT ផុត (`fake.expireTokens()`) ➜ `sbAdminReset(true)` ·
  ចាកចេញពី ZoeKeyGen កណ្តាលការងារ ➜ គ្មាន toast/DOM ក្រោយ · `sbAdminReset()` សម្អាត DOM ទាំងអស់ (ឈ្មោះហាង · username · កូដ · password)។
- បញ្ចូលក្នុង `run-all.sh` (ផ្នែក supabase · lane `any`) + baseline + `audit-tools/README.md` + `repository-file-coverage.json` ។
- បន្ទាប់មករត់ checker ZoeKeyGen ដែលប៉ះ ៖ `wiring` · `csp-enforced` (allowlist ២ ទិស ៖ `sbAdminLogin` · `sbAdminLogout` · `sbAdminRefresh` ·
  `sbCreateTenant` · `sbIssueResetCode` · `copySbInviteLink` · `copySbInviteCode` · `copySbResetCode`) · `html-sink-escaping` · `dom-hygiene` ·
  `state-hygiene` · `secret-hygiene` (`sbAdminPasswordInput` ត្រូវលុបពេលចាកចេញ) · `function-surface` · `css-classes` (`sb-link-output` ·
  `sb-qr` · `sb-member`) · `layout-check` · `shared-fns` (ឈ្មោះ `sb*` មិនជាន់ ZoeW) · `keygen-session-security` · `boot-runtime`។

### ៣ខ. ការរត់ suite ពេញ ហើយកែអ្វីដែលធ្លាក់
- `CRUD_FLOW_STRICT=1 VERSIONSCOPE_STRICT=1 MONEYGUARD_STRICT=1 SUPABASE_STRICT=1 bash audit-tools/run-all.sh` (emulator រស់ — Runbook ជំហានទី ០)។
- ⛔ ត្រូវរំពឹងការធ្លាក់ដែលមិនទាន់កែ ៖ `version-bump-scope` (ZoeW និង ZoeKeyGen ប្រែកូដ ship តែមិនទាន់ឡើងកំណែ) · `doc-scope-test`
  (`run "emu/supabase-adapter-parity"` ថ្មី ត្រូវមានឈ្មោះក្នុងកថាខណ្ឌធ្លាក់ចុះ emulator នៃ Runbook ក្នុង `CLAUDE.md` · តារាង UI) ·
  `repository-file-coverage` (ឯកសារថ្មីទាំងអស់ ៖ `ZoeW/src/services/supabase-*.ts` · `tx-disconnect.ts` · `features/account.ts` ·
  `ZoeW/tests/supabase-account.test.tsx` · `audit-tools/supabase-fake-server.js` · `audit-tools/emu/supabase-adapter-parity-test.js` · ឯកសារនេះ) ·
  `audit-tools/README.md` (រាល់ `.js` ត្រូវមានឈ្មោះ) · ប្រហែល `wiring`/`csp-enforced` លើ ZoeW (សកម្មភាពថ្មី ៖ `openRegisterForm` ·
  `openResetPasswordForm` · `backToLoginForm` · `submitRegisterForm` · `submitResetPasswordForm`) · `zoew-parity` (Firebase mode ត្រូវដូចដើម —
  បើធ្លាក់ ពិនិត្យ LoginModal/health-check មុន) · `function-surface` · `code-duplication`។
- ⛔ checker ដែលអាន `app.js` ជាអត្ថបទ (text view ពី TS) អាចឃើញ function ថ្មីៗ ➜ ពិនិត្យ `clock-hygiene` (`Date.now()` ក្នុង `supabase-rtdb.ts` ៖
  `rpc()` វាស់ RTT · `noteServerTime` — ជា local timer ➜ អាចត្រូវដាក់ក្នុង allowlist ដោយមានហេតុផល) · `secret-hygiene` · `storage-guard`
  (`supabase-transport.ts` ប្រើ storage តាម `createModeStorage` ដែលរុំ try)។

#### លទ្ធផល run-all ពេញលើ commit `3cb1686` (emulator រស់ · STRICT ទាំងអស់) ៖ ❌ ធ្លាក់ ២២ · ជោគជ័យ ១៧៣ · រំលង ០
(⛔ រត់ម្តងទៀតមុនជឿ — tree អាចប្រែ។ ការណែនាំខាងក្រោមជាតម្រុយពី log មិនមែនការវិនិច្ឆ័យពេញលេញ)
- **sandbox របស់ checker ខ្វះឈ្មោះថ្មី** (រំពឹងទុក — ការធ្លាក់ល្អ ៖ checker រត់កូដពិត) ➜ បន្ថែមឈ្មោះក្នុងបញ្ជីស្រង់/stub ៖
  `firebase-config-paste-test` (`looksLikeSupabaseConfig`) · `health-check-test` (`databaseHealthLabel`) · `emu/crud-rules-flow`
  (dependency sandbox) · `connection-recovery-test` (ផ្នែក Reconfig ៖ `initFirebase()` ថ្មី — `previousFb`/`loadSupabaseFb`) ·
  `tx-outcome` (ការអះអាងស្វែងរកអក្សរ `withTransactionOutcomeResolution(await waitForFirebaseSDK())` ក្នុង `initFirebase` — ឥឡូវ `nextFb = …`) ·
  `money-guardian` (ធ្លាក់តាម `tx-outcome-test` ខាងលើ)។
- **ច្បាប់ពិតដែលត្រូវកែកូដ** ៖ `monotonic-gate-test` + `clock-hygiene` (`Date.now() - startedAt` ក្នុង `supabase-rtdb.ts`
  ➜ ប្រើ `elapsedSince()`) · `sdk-surface` (`fb.X` ថ្មីដែល loader Firebase មិន export ៖ `tenantScope` · `accountOf` · `__supabase` ·
  `registerAccount` · `resetPassword` ➜ ហៅតាម `typeof … === 'function'` ឬ allowlist មានហេតុផល) · `html-sink-escaping` (១ កន្លែង —
  ទំនងជា `renderSbTenantList()` ក្នុង ZoeKeyGen ៖ `labels[state][1]`/`members`) · `shared-fns` (`firebaseConfigErrorMessage`
  ឃ្លាតរវាង ZoeW និង ZoeKeyGen ➜ ផ្លាស់ផ្នែក Supabase ទៅ helper ដាច់ ឬ allowlist មានហេតុផល) · `dom-hygiene` (៦ វាល) ·
  `state-hygiene` (១ អថេរ) · `secret-hygiene` (`sbAdminPasswordInput` ត្រូវសម្អាតក្នុងផ្លូវចាកចេញដែល checker ស្គាល់) ·
  `csp-enforced` (អានសារវាលទទេ `loginWithFirebase()` មិនបាន — ការអះអាងស្វែងរកអក្សរ alert ចាស់ · ការ submit ទម្រង់ចូល) ·
  `zoew-suite` (`npm run purity:check` — ទំនងជា `commitNow`/ref ក្នុង `features/account.ts` ឬ `document`/`window` ក្នុង `supabase-sdk.ts`) ·
  `zoew-parity` (`parity:deep` ៖ «ស្កេន ZL5 ➜ ZTO បំពេញស្វ័យប្រវត្តិ» — ពិនិត្យថាជា flake ក្រោមបន្ទុក ឬផលពី `performLogin`/`ensureAppActivated`) ·
  `supabase-datastore` (មើល log — ប្រហែលការប្តូរ fake server ឬ CAS) · `checker-coverage` (`emu/supabase-adapter-parity-test.js` គ្មាន
  `*_APP_DIR` ដែល checker-coverage ស្គាល់ ➜ `SBADAPTER_APP_DIR` ត្រូវប្រើ/ចុះបញ្ជី)។
- **រំពឹងទុក (ការងារ ៣គ)** ៖ `version-bump-scope` (ZoeW + ZoeKeyGen) · `doc-scope-test` (README `supabase/` មិនក្នុងបញ្ជី · `audit-tools/README.md`
  កាតាឡុក · `emu/supabase-adapter-parity` ក្នុង Runbook) · `repository-file-coverage` (ឯកសារថ្មី)។

### ៣គ. កំណែ · ឯកសារ · ច្បាប់ (ច្បាប់ ៦ · ៨ · ៩ · ១២)
- ZoeW ៖ ឡើង `APP_VERSION` (MINOR — មុខងារថ្មី) ក្នុង `ZoeW/src/core/version.ts` · `manifest.json` · `index.html` · `CACHE_VERSION` ·
  ធាតុ `update` ថ្មីក្នុង `ZoeW/public/announcements.json`។ ZoeKeyGen ៖ ឡើង `APP_VERSION` · `manifest.json` · `index.html` · `CACHE_VERSION` (`sw.js`)។
- `docs/HISTORY.md` ផ្នែក ១ ៖ ផ្នែកថ្មី + **«សកម្មភាពដែលត្រូវធ្វើដោយដៃ»** (ជំហាន ៣ឃ ខាងក្រោម)។
- `CLAUDE.md` ៖ ជួរថ្មីក្នុងតារាងស្នូល (adapter Supabase ↔ SDK Firebase · ZTO អត្តសញ្ញាណ Supabase · ផ្ទាំងអ្នកលក់) · កែតារាងក្បាល
  (ZoeW = React + backend ២ ប្រភេទ) · Runbook (`emu/supabase-adapter-parity` · `SUPABASE_STRICT`) · ផ្នែក «ការងារដែលនៅសល់» · តារាង UI
  (Modal ចូល ៣ របៀប · កាតថ្មីក្នុង ZoeKeyGen)។
- README ៖ `supabase/README.md` (សរសេរឡើងវិញ ៖ កូដអញ្ជើញ · datastore · ជំហាន deploy · ផ្ទាំង ZoeKeyGen · ⛔ លុបផ្នែក «Firebase សម្រាប់ OTP») ·
  `ZoeW/README.md` · `ZoeKeyGen/README.md` · `ZoeW/ZTO-SETUP-KH.md` (env `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY`) · `audit-tools/README.md` ·
  សៀវភៅក្នុង App `ZoeW/public/guide.html` (ចុះឈ្មោះដោយកូដអញ្ជើញ · ភ្លេចពាក្យសម្ងាត់) — ⛔ README គ្មានប្រវត្តិ/លេខកំណែ (ច្បាប់ ៩)។
- `.github/workflows/audit.yml` ៖ `npm ci --prefix supabase` · `SUPABASE_STRICT=1`។
- ចុងជុំ ៖ `node audit-tools/strip-comments.js` · `git diff origin/main -- ZoeW/src ZoeW/public ZoeKeyGen | grep '^-'` (ពន្យល់រាល់បន្ទាត់ដែលលុប)។

### ៣ឃ. សកម្មភាពដោយដៃរបស់ម្ចាស់គម្រោង (សរសេរចូល HISTORY ផ្នែក ១)
1. បង្កើត Supabase Project (Free) ➜ Region ជិតកម្ពុជា (Singapore)។
2. `supabase db push` (ឬ paste migration ៣ តាមលំដាប់ក្នុង SQL Editor) ➜ `20260930120000_zoe_tenancy.sql` · `20261001000100_zoe_rules.sql` · `20261001000200_zoe_datastore.sql`។
3. បង្កើតគណនី Admin (Authentication ➜ Add user) ➜ `insert into public.platform_admins (user_id) values ('<uuid>');`។
4. Deploy Edge Function ៖ `supabase functions deploy register --no-verify-jwt` និង `reset-password --no-verify-jwt` · secrets ៖ `ZOE_SECRET_KEY`
   (Secret key — ⛔ តែក្នុង secrets) · `ZOE_LOGIN_DOMAIN` (ឧ. `users.zoew.invalid` ⛔ ត្រូវដូច `loginDomain` ក្នុង Config ZoeW) ·
   `ZOE_ALLOWED_ORIGINS` (`https://<site>.netlify.app,https://localhost` — `https://localhost` សម្រាប់ APK)។
5. Netlify (site ZoeW) env ៖ `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` (សម្រាប់ «ទាញបញ្ជីពី ZTO» តាមសាខាហាង)។
6. ZoeKeyGen ➜ កាត «🏪 ហាង Supabase» ➜ ចូលជា Admin ➜ បង្កើតហាង ➜ ផ្ញើ Setup Link (មានកូដអញ្ជើញ) ឲ្យម្ចាស់ហាង។
7. Firebase rules **មិនប្រែ** (Project Firebase ចាស់នៅដំណើរការដដែលសម្រាប់អតិថិជនចាស់)។

### ៣ង. ចំណុចដែលនៅបើក (សម្រេចជាមួយម្ចាស់គម្រោង ឬធ្វើក្រោយ)
- **Push notification** (🔔 · FCM/Web Push) អាស្រ័យលើ Activation Key ➜ អតិថិជន Supabase (គ្មាន Key) ទទួលស្ថានភាព `no-license`។
  ជម្រើស ៖ ចងអត្តសញ្ញាណ Push នឹង token Supabase (`netlify/lib/push-core.mjs`)។
- **Egress Free tier (5GB/ខែ)** ៖ adapter ទាញឡើងវិញពី `cursor=0` រាល់ការផ្ទុកទំព័រ ➜ គួររក្សា cache `zoe_docs` ក្នុង IndexedDB (delta តាម `seq`)។
- **ផ្ទេរទិន្នន័យអតិថិជនចាស់** Firebase ➜ Supabase ៖ CLI តាម `public.zoe_admin_write(p_tenant, p_op_id, p_ops, p_replace)` (មិនទាន់សាង)។
- `firebase-loader.js` នៅតែទាញ SDK Firebase ពី gstatic សូម្បីតែ Config ជា Supabase (ខ្ជះខ្ជាយ ~150KB · មិនខូចមុខងារ)។
- chunk `supabase-backend` (~241KB/65KB gz) ចូល `CORE_SHELL` របស់ SW សម្រាប់អ្នកប្រើទាំងអស់ (ដើម្បីឲ្យ Supabase បើកក្រៅបណ្តាញបាន)។
- ការសាកលើ iPhone + Android ពិត ៖ ចុះឈ្មោះ · ចូល · ស្កេន · ក្រៅបណ្តាញ ➜ ភ្ជាប់វិញ · ឧបករណ៍ ២ ក្នុងហាងដដែល។

## ៤. វិធីរត់អ្នកយាមជាក់លាក់ (ក្នុង session ថ្មី)

```bash
npm ci --prefix ZoeW && npm ci --prefix supabase
M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1)
node audit-tools/emu/supabase-adapter-parity-test.js        # ត្រូវការ emulator 127.0.0.1:9000 + Postgres (@embedded-postgres ក្នុង supabase/node_modules)
(cd "$M" && ZOE_REPO_ROOT="$PWD/../../.." node audit-tools/emu/supabase-rules-parity-test.js)
node audit-tools/supabase-datastore-test.js && node audit-tools/supabase-rls-test.js && node audit-tools/supabase-functions-test.js
(cd ZoeW && npx vitest run tests/supabase-account.test.tsx)
(cd "$M" && node audit-tools/zto-list-sync-test.js && node audit-tools/netlify-config-scope-test.js)
```
