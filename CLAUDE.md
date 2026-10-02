# Zoe-System — rules for Claude sessions

> Written for **Claude**, not for the owner. This file is English by owner request (fewer tokens);
> **everything else stays Khmer** (rule 7). It holds rules and runbooks only. Bug history, measured numbers and
> per-version notes live in [`docs/HISTORY.md`](docs/HISTORY.md) (React era) and
> [`docs/HISTORY-ARCHIVE.md`](docs/HISTORY-ARCHIVE.md) (vanilla era) — reference files, not reading material.
> The previous long Khmer edition of this file is in git history (`git log -- CLAUDE.md`).

## ⛔ The one lesson that matters most

**Writing a lesson down is not enforcing it.** "The checker checked nothing" was written into the old version of
this file **13 times** across 5 versions and still recurred the next round every time. So:

**Bug found ➜ build the tool first ➜ prove it fails on the pre-fix tree ➜ only then fix the code.**

Rules with a tool can be short because **the tool is the memory**. Rules marked 📝 have no tool — only this text
remembers them.

## 🗺️ Map

| Section | Read when |
|---|---|
| Warnings · Non-negotiable rules · Forbidden zone | **every round, before touching code** |
| Core table (rule ➜ tool) | **every round** — what you must not violate |
| Core business rule | before touching money · trash · pickup stats · cleanup |
| Architecture | before touching UI · gestures · CSS · CSP · scanner · clock |
| Network · SW · License | before touching connection · listeners · Service Worker · ZTO · License |
| Checker discipline | before writing or trusting any checker |
| Runbook | start of round (setup) and end of round (before commit) |
| Expected error patterns | when you see an error in Sentry or console |
| Pending work | when the user asks "what should I test?" |

---

## 🛑 Warnings before a new audit round

1. **`run-all.sh` green ≠ no bugs.** A real money bug (revenue created from thin air) was found with **130 checkers
   green, SKIP 0**; same for 2.25.6 · 2.25.8 · 2.25.9. Green only proves that *measured* bugs did not return.
   - **The same bug returning 3 times through 3 doors = broken *structure*, not broken doors.** Weather-made pickup
     stats were fixed 3 rounds (2.26.0 · 2.26.1 · 2.26.2), each fix correct and locked by a tool — but they fixed the
     *calculator* while the problem was *what is counted*. Counting **identities** (a barcode set) instead of
     **numbers** removed the class (2.27.0). Always ask: "does this number have an identity?"
2. **Bugs live in the gaps tools don't watch:** stubs that accept everything (no checker made real rules reject a
   write) · states never entered (ledger smaller than the delta, stale local view vs another device, a `fetch` that
   **hangs** instead of failing, a promise that resolves **after** the ceiling) · seams between two files (writer side
   locked, reader side locked, nobody checks they talk about the same thing).
3. **Every round ask "what is *not yet* measured?"**, not "which checker is red?". Proven methods: fake SDK in
   **real-rules reject mode** · dependencies in new failure modes (hang · slow success · absent) · fuzz outside the
   default seed range: `FUZZ_RUN0=100 FUZZ_RUNS=14 FUZZ_OPS=50 node audit-tools/revenue-fuzz-test.js` (the 2026-09-03
   money bug fails at **run=102**; `FUZZ_RUNS=30` alone covers seeds 0–29 and does **not** reproduce it). Deeper runs
   are luck — useful for **finding new classes**, not for protecting old ones.
4. **Review deleted lines in every fix.** 2.25.4 fixed one money bug and accidentally deleted 3 guard lines in the
   same commit ➜ new money bug, no checker failed. Before every commit:
   `git diff "$BASE_REF" -- ZoeW/src ZoeW/public ZoeKeyGen | grep '^-'` — **an unexplained deletion is a regression**.
   Deletions are step 1 of 6 of the impact verification (Runbook step 3).
5. **Don't change verified areas on suspicion** (see Forbidden zone). 2.11.3 removed motion **based on theory** ➜
   user reported "looks like two different apps" ➜ next round restored it. **Measurement is evidence, reading code
   is not.**

---

## What the system is

**Two PWAs**, deployed as separate Netlify sites: **ZoeW** is **React + TypeScript + Vite** (build step);
**ZoeKeyGen** is vanilla JS (no build step).

| App | Role | Current version | Sentry tag |
|---|---|---|---|
| **ZoeW** | Single business app — add/edit parcels, COD/DOD, Locker positions, stats, Export, Excel import · also an **Android app** (Capacitor) · backend **Firebase or Supabase** per Config | `2.48.0` (`zoew-v253`) | `zoew` |
| **ZoeKeyGen** | Seller tool — create/Revoke/Extend Activation Keys and Setup Link/QR · card "🏪 ហាង Supabase" (shops · invite codes · password-reset codes). Uses a **separate Firebase project** | `2.24.2` (`zoekeygen-v113`) | `zoekeygen` |

**ZoeW is React since `2.38.0`.** Code lives in `ZoeW/src/**` (same function names and storage keys as vanilla
ZoeW) and builds to `ZoeW/dist/`. `src/**` is the single hand-edited source. Wherever this file says `ZoeW/app.js` ·
`ZoeW/index.html` · `ZoeW/sw.js` the rule still applies; the code lives in `src/**` · JSX · `src/sw/sw.ts`.
Architecture: [`ZoeW/docs/ARCHITECTURE.md`](ZoeW/docs/ARCHITECTURE.md) · development and parity measurement:
[`ZoeW/docs/DEVELOPMENT.md`](ZoeW/docs/DEVELOPMENT.md).

- 🔬 **`audit-tools/` measure the React app through the audit build** (`ZoeW/scripts/build-audit.mjs` ➜
  `ZoeW/dist-audit/ZoeW`: a text view `app.js` from TS sources · the `index.html` React really renders · `sw.js` · the
  real bundle exposing functions on `window` only in the audit build). ⛔ `bash audit-tools/run-all.sh` builds it and
  runs every checker on the measure tree (`ZoeW/dist-audit/measure-root`). ⛔ Running a checker **directly on the repo**
  (`node audit-tools/<x>.js`) measures a `ZoeW/app.js` that no longer exists ➜ "code not found" (not an app bug).
- ZoeW's own guards (tsc · eslint · vitest · purity · native · android · parity) run via `zoew-suite-test.js` in
  `run-all.sh`. Parity **DOM · layout · live · deep** against original ZoeW runs as job `zoew-parity`
  (`zoew-suite-test.js --parity`). ⛔ Intentional differences live in **one list**, `INTENTIONAL_UI`
  (`ZoeW/scripts/snapshot.mjs`). Measured: outside CI it was red **79/79** steps with nobody noticing.
- 💰 `check-money.cmd` (`money-reality-check.js`) reads money code from **`audit-tools/money-core.js`** (extracted from
  real code by `npm --prefix ZoeW run money:core`). ⛔ Money code changes ➜ regenerate it (freshness guard fails).
- ⛔ **React is in production** (`main` carries `ZoeW/src/**` — verify: `git cat-file -e origin/main:ZoeW/src/main.tsx`).
  Real iPhone + Android testing ([`ZoeW/docs/MIGRATION.md`](ZoeW/docs/MIGRATION.md) section 5) is the one measurement
  this machine cannot do.
- 📱 **Android app (Capacitor, Android only)**: `ZoeW/android/` · [`ZoeW/docs/ANDROID.md`](ZoeW/docs/ANDROID.md).
  ⛔ Web must **fail closed**: `src/platform/native.ts` is the single decider · plugins load by dynamic import only on
  native · web/iOS paths unchanged. ⛔ **PTR on Android native** (explicit owner request — rule 11) goes through the
  same `setupIOSPullToRefresh()` plus a "pre-slop capture" **only on Android native**; the iOS path is unchanged.
  Guards: `npm run android:check` (APK version = `APP_VERSION` · appId · permissions · logo · **display rate**:
  `MainActivity` requests the highest-Hz mode at the same resolution — ⛔ don't remove; many ROMs cap apps at 60Hz
  while Chrome runs 120Hz · launch splash: ⛔ no `android:background` (it stretches into every View ➜ logo
  scaled/squashed on tablets) · no title/ActionBar · `postSplashScreenTheme` = `BridgeActivity` theme · icon = vector
  `drawable/splash_icon.xml` derived from `icon.svg` in a 192dp circle ⛔ not `@mipmap` (288dp PNG ➜ blurry; some
  ROMs don't round it) · plugins · ⛔ permission `ACCESS_NETWORK_STATE` (without it WebView reports
  `navigator.onLine === true` forever and never fires `online`/`offline`) · web never loads native code ·
  Gradle/AGP/SDK ↔ Capacitor template · release workflow ↔ keystore: ⛔ APKs are signed by **one keystore forever** ·
  no debug-key path · certificate pinned in `ZoeW/android/release-cert.sha256` ➜ another keystore = no Release ·
  ⛔ the keystore **never enters the repo** — it lives only with the owner and in a GitHub secret) ·
  `npm run native:check` (fake bridge: Back · history · pause/resume · Share/Print · biometrics · PTR/latch) ·
  `npm run rules:check` (delete/remove · 2h · 7d · 2d · 30d on original ZoeW · web · Android).
  ⛔ **Back never returns into "remove" mode** (`safeScreen()`).
- ⚛️ **React 100%**: React is the single DOM owner ➜ feature code (`src/core` · `domain` · `features` · `services` ·
  `ui` · `platform`) writes **only state/refs**; the React layer (`src/app/**`) writes DOM **only through exits**
  (`refs.ts` · `DocumentEffects`). See the "React 100%" core-table row and `ZoeW/docs/ARCHITECTURE.md` sections 10–11.

**No `admin`/`worker`/`scanner` roles in the business app** — every signed-in user (`auth != null`) has the same
rights. ZoeKeyGen **still** uses an `admin` role in its separate License Project — don't confuse them.

🏪 **Two backend kinds, per device Config**: Firebase Config (`databaseURL`) ➜ one Firebase project per customer.
Supabase Config (`supabaseUrl` · `supabaseKey` · `loginDomain?`) ➜ **one Supabase project, many shops** (`tenant_id` +
RLS · sign-up by **invite code** bound to a ZTO branch number). `initFirebase()` loads chunk `supabase-backend` by
dynamic import **only** when Config has `supabaseUrl`; the adapter (`src/services/supabase-*.ts`) exposes the same
`fb` surface as the Firebase SDK ➜ ⛔ money/listener code **never branches on backend** — differences live in the
adapter only (`emu/supabase-adapter-parity`). ⛔ **RTDB rules are the single source**: `firebase-database.rules.json`
➜ `node supabase/scripts/generate-rules-sql.mjs` writes a **new** `<timestamp>_zoe_rules.sql` (`supabase-datastore-test`
fails when stale) ➜ changing rules = Publish on Firebase **and** merge to `main` (Supabase GitHub integration "Deploy to
production" applies new migrations) or paste the new file in the SQL Editor. ⛔ Migrations in `main` cannot be
edited/deleted (deploy applies only new versions). Supabase: no Activation Key (shop status instead ·
`ensureAppActivated()`) · `owner`/`member` are account labels (the app grants no different rights). Setup:
[`supabase/README.md`](supabase/README.md).

Other dirs: `audit-tools/` (checker catalog: [`audit-tools/README.md`](audit-tools/README.md) section 6 — ⛔ don't copy
counts here, they go stale) · `zto-import/` (server-side Apps Script) · `tools/zto-cookie-sync-windows/` (Windows
helper) · `tools/firebase-provision/` (new customer: Firebase project · database · rules · sign-up disabled · account in
one command + deploy rules to all customers · [`README-KH.md`](tools/firebase-provision/README-KH.md)) ·
`firebase-backup/` (standalone CLI + backup workflow) · `supabase/` (migrations · Edge Functions · rules generator;
deployed by CLI/GitHub integration, not Netlify) · `.github/workflows/` (`audit.yml` · `backup.yml`) ·
`docs/HISTORY.md`.

---

## ⛔ Non-negotiable rules

1. **Real customers and real money (COD/DOD).** Never merge to `main` without an explicit user request.
2. **"Delete" vs "Remove" is a business rule, not a bug** — read "Core business rule" fully before touching any
   money code.
3. **Shipped app code has no comments** (`.js`/`.css` in `ZoeW/` · `ZoeKeyGen/`; also `ZoeW/public/*.js` ·
   **`ZoeW/src/**`** TS/TSX/CSS · `ZoeW/netlify/functions/*.js` · configs (`vite.config.mts` · `capacitor.config.ts` ·
   `eslint.config.mjs` · …) · **Gradle** (`android/**/*.gradle` · `gradle.properties`; ⛔ except files Capacitor
   regenerates with a "DO NOT EDIT" header) · **shipped HTML** (`index.html` of both apps · `guide.html`)).
   ⛔ End every round with `node audit-tools/strip-comments.js`: it verifies stripping **doesn't change code** (JS:
   token-for-token diff · CSS: declaration stream · React via `ts-comments.js`: TypeScript AST and **esbuild output
   identical before/after**, else the file is untouched; `/// <reference …>` is a directive ➜ kept) and `comments.js`
   fails when comments return. **Exceptions**: `audit-tools/` · `*/test.js` · `vendor/` · `qrcode.js`.
   ⛔ An empty `catch` is an intentional swallow ➜ ESLint `no-empty` has `allowEmptyCatch` (don't add a comment to
   fill it). Knowledge lives in **`CLAUDE.md`** (rules) and **`docs/HISTORY.md`** (history), not in code.
4. **`license-verify.js` and `error-reporting.js` are byte-identical in both apps.** Use `cp` + `md5sum`, never edit
   one app at a time.
5. **Never claim git/branch/merge state without verifying** — `git rev-list --count origin/main..origin/<branch>`.
   **This file is not evidence — git is.**
6. **`APP_VERSION` belongs to each app — ⛔ bump only the app that really changed.** What must match is **inside each
   app**: `app.js` ↔ `manifest.json` ↔ `index.html`. `version-bump-scope.js` locks both directions: shipped code
   changed ➜ **must** bump; no real change ➜ **must not**. ⛔ It is not `CACHE_VERSION`.
7. **Language.** This file (`CLAUDE.md`) is English. **Everything else is Khmer**: chat replies, commit messages, PR
   titles and bodies, all other docs, user-facing text in the apps. Code identifiers stay English.
   ⛔ **Thai script (U+0E00–U+0E7F) looks like Khmer** and slips past the eye ➜ `doc-scope-test` fails on any Thai
   character in any repo text file (incl. `ZoeW/src/**`); never write Thai examples, even in comments.
   ⛔ Number ranges in app text **never mix** Khmer and Latin digits (a JS constant renders Latin ➜ the range head is
   Latin too). ⛔ **In-app text** (`index.html` · `guide.html` · messages · release notes in 🔔
   `announcements.json`) describes **current behavior in present tense** — never compare with the old system and
   **never mention what was removed** ("button X no longer exists" · "(before…)" · "as before"). Code messages may
   state real data status ("this parcel is no longer in the system"); only comparisons with old versions are banned.
   Guard: `doc-scope-test`.
8. **Every audit round that changes shipped code bumps `APP_VERSION`** (PATCH for fix rounds · only apps really
   changed — rule 6) **and adds a new section in [`docs/HISTORY.md`](docs/HISTORY.md) part 1 in the same commit**,
   always stating the **"actions to do by hand"**. ⛔ Rounds that change only `audit-tools/` or docs ➜ **no bump**
   (`version-bump-scope` fails if bumped) and are recorded in `docs/HISTORY.md` **part 2** instead.
9. **README files describe **usage only**.** Every README has **5** sections in this order:
   **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព · អាជ្ញាប័ណ្ណ**. ⛔ No bug history or per-version notes
   in a README. Never copy assertion counts into a README (they go stale). READMEs checked every round: root ·
   `ZoeW/` · `ZoeKeyGen/` · `audit-tools/` · `tools/zto-cookie-sync-windows/` · `tools/firebase-provision/` ·
   `firebase-backup/` · `zto-import/` (and `google-sheets-api/`) · `supabase/` ·
   [`ZoeW/ZTO-SETUP-KH.md`](ZoeW/ZTO-SETUP-KH.md). **A stale README is a wrong document.**
   ⛔⛔ **Scope is every `*.md` file in the repo**: bug history lives only in `docs/HISTORY.md` and
   `docs/HISTORY-ARCHIVE.md` — `HISTORY.md` = React era (**all new entries**) · `HISTORY-ARCHIVE.md` = vanilla era
   (**read, never append**) · no third history file. ⛔ Exceptions: root `docs/` (history files · `AUDIT-PROMPT.md`)
   and `CLAUDE.md` (it *must* cite measurements as reasons for rules). ⛔ `ZoeW/docs/` is **not** an exception.
   ⛔ Banned elsewhere: version numbers (`កំណែ 2.x.y`) · date-bound requests · measurements bound to a version or date
   ➜ write in **present tense**. ⛔ File lists are **derived from real directories**, not hard-coded.
   `doc-scope-test.js` locks this rule.
10. **Firebase rules don't deploy automatically** — Netlify serves only static files. Every new path gets its rule in
    the same commit, and **tell the user to paste it in Firebase Console ➜ Publish by hand**. Two files:
    `firebase-database.rules.json` (Business) and `ZoeKeyGen/firebase-database.rules.json` (License). Business: the
    owner may run `tools/firebase-provision/deploy-rules.cmd` instead (deploys to every known project ➜ reads back ➜
    `verify`) — still a **manual action** to report. License: paste.
11. **⛔ Don't touch PTR · history-panel motion · scroll smoothness without an explicit request.** See next section.
12. **⛔ `rg` before writing anything new into `CLAUDE.md` or `docs/HISTORY.md`.** Extend existing rules. A rule in two
    places ➜ next round edits one, forgets the other ➜ **two contradictory rules** ➜ the next session believes either
    (happened 3 times: a rule · the emulator procedure · "question 13" — `docs/HISTORY-ARCHIVE.md` part 5).
    ⛔ Delete duplication **when you see it**. ⛔ Other docs **reference** rules here, never copy them. ⛔ Same rule on
    a new branch ➜ **extend the original**; a new core-table row only when the rule gets a **new guard**. ⛔ Core-table
    cells hold short **rules**; "measured (x.y.z)" narratives go to `docs/HISTORY.md`. `doc-scope-test` fails when the
    same ```` ``` ```` block lives in 2 files (⛔ `docs/` exempt).

---

## ⛔ Forbidden zone — PTR · history-panel motion · scrolling

The user explicitly asked to record this (2026-08-25): these three areas were "the hardest to fix" and took **~11
rounds and 2 reverts** (details in `docs/HISTORY-ARCHIVE.md`). Key lesson (2.11.3 ➜ 2.11.4): motion was removed on a
theory about `scroll-snap` without measuring ➜ "looks like two different apps" (measured: iOS **0px** vs Android
**357px**) ➜ restored next round. The right fix was **pausing snap**, not removing motion.

- These areas **are verified on real iPhone and Android** — not untested code. Don't "fix" them on suspicion, code
  reading or WebKit theory.
- Green `run-all.sh` proves only the scenarios run; it does not prove this area is bug-free. A fix needs evidence of a
  real problem. `gesture-test.js` · `panel-motion-test.js` · `ios-panel-glide-test.js` ·
  `panel-snap-ownership-test.js` · `phone-search-swipe-test.js` lock it.
- Change only when **the user reports a real problem** (video or a precise description).
- If you truly must touch it: read the "5-point table" below fully, **measure** iOS vs Android directly (never
  assume), and test on **real devices of both systems** before merge.

## Accepted by design — don't report as new bugs

- **Users can write revenue/pickup numbers directly** — no rule can verify delta history without a trusted backend
  (Cloud Functions); this project has none. **No aggregate validation** for the same reason.
- **"Inspect element" protection cannot be hardened** — all client code is visible. ⛔ Don't try: every layer
  (`devtools-guard`) is an obstacle, not protection, and "hardening" only risks breaking the real app.
- **`zto-import/google-sheets-api/Code.gs` is a template** — repo edits **don't change the deployed script**; it must be
  pasted into script.google.com and deployed as a new version by hand.
- **Netlify Base directory lives in the UI** — `zoew` ➜ **`ZoeW`** · `zoekeygen` ➜ **`ZoeKeyGen`** (**case-sensitive**,
  Linux). Repo checkers can't see it and a PAT in Netlify env is banned. See "Netlify config" below.
- **Clearing site data loses License `seenMax`** — it grants nothing without the server (`activate()` requires
  `checkOnline().ok === true`).

⛔ The first four are 📝 zones (no tool) — intentional acceptances, not gaps. Don't build tools for them unasked.

---

## 🔒 Core table: rule ➜ tool that locks it (read before trusting any rule)

> Each rule is short because **the tool is the memory**: violate it and the tool goes red. Want the *why*? `grep` the
> tool name in `docs/HISTORY*.md` (or the index at the end of [`docs/HISTORY.md`](docs/HISTORY.md)).
> **📝 = no tool** ➜ only human care protects it ➜ **that is where the next bug happens**; build a tool before
> touching a 📝 area. **3** 📝 rows remain in this table — all **intentional acceptances**, not gaps (see above).
> ⛔ That count is derived from the table — `doc-scope-test` part 6 locks it.

| Area | Short rule | Tool |
|---|---|---|
| **Tools themselves** | A checker must **be able to fail** — empty dir ➜ none green; ⛔ an `ok()` that takes **only a label** must never be called conditionally | `checker-coverage.js` |
| **Tools themselves** | ⛔ **A "green set" is not evidence** — every money class needs a guard that goes *really red* | `money-guardian-test.js` |
| **Tools themselves** | A checker must **fail within a time limit** — hang ≠ fail. ⛔ Meta-checkers running many children (`checker-coverage` · `exit-code-integrity`) run them **in parallel under a ceiling**, not serially; a child that **exhausts its budget** while poisoned = FAIL (unmeasurable), not "failed correctly" · ⛔ never fix overruns by raising `CHECKER_TIMEOUT` (hides real hangs) | `hang-guard.js` |
| **Tools: the `run-all.sh` runner** | ⛔ Bounded parallel lanes, output **always in list order** · `emu/*` + `money-guardian` one at a time (single emulator) · checkers writing/sweeping `.tmp-poison-*` (`checker-coverage` · `exit-code-integrity`) **run alone** · lanes derived from source and verified **both directions** (a new checker using the emulator or sweeping shadows ➜ must enter `runall_lane()`) · `RUNALL_STATE` written **as soon as a checker ends** · `RUNALL_RESUME=1` **refuses on a different tree** (content hash + `*_STRICT` flags) · unknown `RUNALL_ONLY` name ➜ refuse; a partial run **never prints "all passed"** · TERM leaves no orphans · ⛔ `RUNALL_SHARD=k/n` (parallel CI) is a function of **the list + `RUNALL_HINTS` only** (not state/nproc which differ per runner) ➜ shards never overlap or miss · matrix in `audit.yml` = 1..n · CI STRICT flags ⊇ Runbook step 0 block · bad value ➜ refuse | `runall-runner-test` · `hang-guard` |
| **Tools themselves** | ⛔ Every checker runs normally and as baseline; a CLI needing a dump has a fixture checker; CI and runner agree | `checker-coverage.js` |
| **Every repo file** | ⛔ New files need a guard mapping in `repository-file-coverage.json`; stale entries or missing guards fail; integrity/manual kinds are not behavioral coverage | `repository-file-coverage.js` · `repository-contract-test.js` |
| **Reports and data to send** | ⛔ The real CLI finds money bugs identically before/after redaction; the launcher never claims "sent" when redaction fails | `money-reality-test.js` |
| **Tools themselves** | ⛔ Every sandbox dependency exists in real scope (function/state/constant); smoke runs the real collected path before the emulator gate | `emu/crud-rules-flow.js` |
| **Tools themselves** | ⛔ Failure must reach the **exit code** — "FAIL" with exit 0 = fake green. ⛔ **Second half: assertions that *never run* also exit 0** — `await` on a promise **nobody resolves** (e.g. a stub the test is supposed to resolve) neither throws nor hangs: the event loop **drains** ➜ node exits **0** silently ➜ summary and all later assertions **never run** ➜ `run-all.sh` lists **PASS**. ⛔ The fix is **structural**: `process.exitCode = 1` at the top and only the summary line lowers it — not eyeballing "my test resolves every promise" | `exit-code-integrity.js` |
| **Tools themselves** | ⛔ `pageerror` doesn't see promise rejections — watch `unhandledrejection` too | `checker-coverage.js` part 8 |
| **Accumulating listeners** | ⛔ N real cycles ➜ listener and node counts must not grow | `listener-leak-test.js` |
| Delete vs Remove | `isDeducted` is the **single** field that decides money | `policy-test` · `revenue-fuzz` |
| **Duplicate barcode ↔ money** | ⛔ Save only with a real `'claimed'` verdict. ⛔ The registry writes **constant `true`** ➜ a server read after `disconnect` seeing `true` can't tell "we claimed" from "another parcel claimed" ➜ `claimBarcodeInRegistry()` returns **`unknown`** on `txOutcome: 'applied'` (a trap is cheaper than duplicate money) | `duplicate-money-test` · `tx-outcome-test` part 5 · `emu/tx-disconnect-emu-test` part គ (real SDK) |
| **Row money totals** | ⚠️ Terms: **`barcode` = 1 parcel** · **`item` = row = one customer on one day** (`addOrUpdateEntry` merges by `phone`+`scanDate`) ➜ `item.count` = **parcel count** ➜ label "កញ្ចប់សរុប" is right. ⛔ `item.cod/.dod/.price` must **equal the sum over barcodes** (when `barcodes` is non-empty — legacy items derive from `price`). ⛔ **Check the server too**: `initDatabaseListeners` recomputes `price` on read ➜ it **heals** memory while wrong numbers sit on the server and reach Excel. ⛔ Ledger guards **don't see this class** | `item-money-integrity-test` |
| **Colors: COD vs DOD** | ⛔ In one row COD and DOD must **look different**. ⛔ COD **keeps status colors** (`money-collected`/`money-pending` — `semantic-ui-color-test` locks their literals); DOD gets modifier `kind-dod` ➜ `--money-dod-collected` / `--money-dod-pending`. ⛔ Measure the **computed color** in a real browser, not class presence; draw sites **derived from `app.js`**. ⛔ **Reverse: a pure COD line must not carry `kind-dod`** | `semantic-ui-color-test` · `page-nav-test` |
| **Drawer: collapsible categories** | ⛔ Items grouped in `.drawer-group`, collapsed by default · state in `zoew_drawer_groups_v1` · opening one doesn't open another. ⛔ **A category whose items are all hidden hides its header too** ➜ `refreshDrawerGroups()` is the single choke point. ⛔ **Measure with `getBoundingClientRect()`** — `getComputedStyle(child).display` still resolves when the **parent** is `display:none` (⚠️ computed style is valid **only when** `.hidden` sits on the element itself, as in `zto-sync-banner-test` part 22) | `page-nav-test` · `zto-sync-banner-test` |
| **Values rules reject** | ⛔ Clamp negatives **before writing** — memory must match the server | `revenue-rules-clamp-test` |
| **Clamp at 0 ↔ revert** | ⛔ "apply ➜ revert" must be a **true inverse** — revert by the delta the *server applied* | `ledger-clamp-symmetry-test` · `emu/ledger-revert-emu-test` |
| **Revert after clamp** | ⛔ Revert the **actually applied delta**, not the requested one | `revenue-rules-clamp-test` |
| **Revert after a *failed* apply** | ⛔ Same rule for verdict **`null`**: `null` = "server did not apply" ➜ **nothing to revert** (⛔ never fall back to the memory delta). In-memory revert is **idempotent** because the commit's `catch` already reverted memory | `ledger-failed-apply-revert-test` |
| **Transactions: `disconnect` ↔ real outcome** | ⛔ `disconnect` = "unknown", not "not applied" ➜ `runTransactionResolved()` (wrapper on the single `fb`) reads the server via REST before reversing · `applied` ➜ success · `unknown` ➜ don't touch money + Sentry money · late cleanup never writes duplicate trash. ⛔ **"Equals the sent value" is valid only when that value belongs to one writer** (token · parcel data) ➜ constant values (registry `true`) are not trusted · cleanup checks the trash owner · daily/monthly ledger carry a unique `op` token per write (`runLedgerTransaction()` is the choke point ⛔ never `fb.runTransaction` directly on the ledger) ➜ rules not yet Published (`permission_denied`) ➜ resend without `op`. ⛔ The wrapper **delays** `disconnect` (REST read up to 60s) ➜ paths queuing on `disconnect` (`patchHistoryItemFields` · call marking) must check `transactionDisconnectPending()` when `dbOp` times out — otherwise a network drop becomes revert + "failed" | `tx-outcome-test` · `emu/tx-disconnect-emu-test` (real SDK) · `money-guardian-test` · `history-patch-retry-test` (real wrapper) |
| **Pickup stats: identity** | ⛔ Count by **barcode set** (`pickedUpBarcodes`) — both numbers are **derived mirrors**, not counters | `pickup-barcode-identity-test` · `pickup-ledger-test` |
| **Pickup stats ↔ registry key** | ⛔ Barcode key is the same `barcodeRegistryKey()` — two key formulas = double counting | `pickup-ledger-test` |
| **Pickup stats ↔ server verdict** | ⛔ Writes are **idempotent state** — no arithmetic on `packagesPickedUp` | `revenue-rules-clamp-test` · `money-guardian-test` |
| **Aborted transactions** | ⛔ `committed: false` ➜ the money reversal still runs (a `throw` inside the success handler **does not** reach the failure handler) | `price-edit-abort-test` |
| **Orphan registry keys** | ⛔ A failed release is queued and retried — never swallowed | `registry-release-test` |
| **Registry release queue ↔ releaser** | ⛔ Deferral needs a second exit (view arrival) | `registry-release-test` |
| Trash · `trashReason` | Display label ≠ money decision. ⛔ **The two group totals derive from `TRASH_REASON_META[r].deducted`**, not literals, and **keep cents** (`renderTrashSummary()` must be run and the user-visible number read) | `trash-modal-test` · `restore-marker-hygiene-test` |
| **Pickup stats**: customers ↔ parcels | Counted on **one basis** (closed barcodes) | `pickup-ledger-test` |
| **Reset pickup stats** by filter | Node **remains** with `0` · honors filter · never touches money | `pickup-reset-test` |
| 2h/8d cleanup | Walks **barcodes**, not parcels | `partial-pickup-cleanup-test` |
| Rules fence · deadlock | A witness must not lock the id | `emu/restore-deadlock-test` |
| **Rules: nodes expecting objects** | ⛔ A writable node with child schema (fields or wildcard) needs a `.validate` requiring an object (`newData.hasChildren(…)`) — a primitive **has no children** ➜ child checks don't run ➜ server accepts ➜ every device's listener fails. ⛔ List derived from both real rules files (`rules-shape.js`) ➜ new nodes covered automatically · emulator two steps (control without guard ➜ accepts · real rules ➜ rejects). ⚠️ Console writes by the project owner bypass rules ➜ `rawSnapshotToItemList()` skipping broken records stays necessary | `rules-duplicate-keys` · `emu/crud-rules-flow` · `emu/license-seat-rules-test` |
| **Rules ↔ the app's real writes** | ⛔ Browser checkers' fake SDK accepts **every write** ➜ "real rules reject a normal app write" is invisible ➜ every rules change (or new write path) is proven on **real writes in real order**: `revenue-fuzz-test` (`FUZZ_CAPTURE`) captures what the fake accepted ➜ replays to the emulator with real rules (app ➜ user · harness ➜ owner) ➜ **0** rejections · reverse probe (history record `.validate: false` ➜ must reject) · floor ≥ 150 writes · 9 roots. ⛔ A new write path fuzz doesn't exercise ➜ add an op to `revenue-fuzz-test` before trusting rules | `emu/app-writes-rules-test` |
| Clock | Retention uses `getServerNow()`, not `Date.now()` | `clock-hygiene` |
| **Rate ceilings ↔ clock** | ⛔ Elapsed time goes through `elapsedSince()` (backwards ➜ fail-open) | `monotonic-gate-test` |
| **Rate ceilings ↔ clock *basis*** | ⛔ Stamps measured by `elapsedSince()` must be **minted with `Date.now()`** (a `getServerNow()` stamp ➜ `−offset` ➜ `Infinity` ➜ ceilings and backoff ladders **dissolve**). ⛔ Stamps live as **variables** and **properties** (`{ at: … }` · `x.deletedAt = …`). ⛔ Two fix directions: **local** stamps (TTL) ➜ mint with `Date.now()`; **retention** stamps (`deletedAt` in Firebase) ➜ ⛔ don't change minting — measure `getServerNow() - mark`. ⛔ One property never holds two bases | `clock-basis-test` · `zto-sync-banner-test` (behavior) |
| Connection · recovery | A failed listener must come back; the SDK is really recoverable · ⛔ reloading to recover the SDK **measures reachability of the SDK host first** before spending the ceiling (`navigator.onLine` lies on WiFi without internet / data exhausted ➜ otherwise 3 reloads burn while the network is dead and the SDK never recovers) · CSP `connect-src` allows that origin | `connection-recovery-test` · `netlify-config-scope-test` |
| **Zombie socket** | ⛔ `.info/connected` = `true` **is not proof** the socket carries answers — the SDK closes only on `window` `offline` (keepalive 45s doesn't wait for replies) ➜ WiFi without upstream · NAT expiry · wake from background ➜ "connected" for minutes while nothing works. `probeDatabaseLiveness()` is the single decider: real round trip (`get()` on `DB_LIVENESS_PROBE_PATH` which has no listener ➜ any reply incl. `permission_denied` = alive) · only a timeout (10s) disconnects (`forceDatabaseReconnect()` = same effect as the SDK's `offline`). 3 doors: hung `dbOp` + hung scan claim/save · wake from background ≥ 30s · 60s cycle (visible + no round trip in 55s). ⛔ Never probe while a listener is pending (first pull on a slow network queues the reply ➜ false disconnect ➜ endless re-pull) · disconnect ≤ 1 per 30s · reverse: slow but alive ➜ no disconnect | `emu/app-network-e2e-test` (app · SDK · real emulator) |
| **A listener dying alone** | ⛔ Siblings must not announce recovery on its behalf | `connection-recovery-test` |
| **An `.info/*` listener dying alone** | ⛔ Same rule for `.info/connected` and `.info/serverTimeOffset` | `connection-recovery-test` |
| **Stale callbacks after reconnect** | ⛔ Every `onValue` callback has a generation gate (`listenerGeneration !== dbListenerGeneration`) — `fb.off()` is wrapped in `try/catch` so it can fail, and in-flight snapshots arrive **after** a database/auth switch ➜ an old callback (1) writes **old project** data into memory and (2) calls `noteDbListenerAlive()` ➜ **declares the view fresh** ➜ "empty list ↔ measurable" dies and destructive cleanup runs on a stale view. ⛔ **The measurement derives from real `DB_LISTENER_KEYS`** (measuring only `history` let a gate removal on any other listener survive) | `connection-recovery-test` |
| **Secret redaction** | Frozen objects redacted by copying · private/signing keys and private JWK (incl. as JSON string) redacted · public JWK and money field `d` kept. ⛔ `SECRET_KEY_PATTERN` (object keys) and `SECRET_PARAM_PATTERN` (`x=…` strings — the biggest path because Sentry captures `console` breadcrumbs) are **two separate lists** ➜ both must cover every secret the system **really holds** (`headerValue` · `headerValueEnc` · `X-Zoe-Proxy-Key` · `ZTO_PROXY_KEY` · `BOS-MAN-SESSION` · `activationKey` · `keyString` · …) · credential field list derived from `fieldsToBlank` of `clearSensitiveModalFields()` · measured from real code. ⛔ Reverse: don't swallow non-secrets (`path` · `patch` · `dispatch` · `headerName`) · the param list is intentionally larger than the key list (`key` empty) | `secret-hygiene` |
| **Tools themselves** | ⛔ Poisoning happens on shadow files — SIGKILL never touches originals | `checker-coverage` |
| **Tools themselves** | ⛔ No **fixed** shared resources: always `listen(0, '127.0.0.1')` · the RTDB namespace of `emu/*` is unique per run | `checker-coverage` |
| **Writes ↔ leaving to make a call** | Retry keeps rollback of every field and newer choices; old callbacks can't write/deduct stats/show messages after an auth or database switch | `history-patch-retry-test` |
| **Table prefetch** | Retry fast **but never fire during a scan** | `lookup-prefetch-test` |
| **State ↔ modal owner** | ⛔ `closeModal()` clears only the state of **that** modal (or when the stack is empty) — a modal on top must not erase the Barcode · price edit · call mark of the modal below | `lookup-prefetch-test` · `ui-flow-test` |
| **Stacked modals** | ⛔ The **last opened is on top** (incl. re-opening an open modal) — `.modal` z-index is equal ➜ DOM order wins ➜ the PIN from Config hid behind ➜ ZoeKeyGen `openModalHelper()` re-orders z-index · ZoeW `uiState.modalStack` ➜ `Modal.tsx` (only when ≥ 2 open ➜ parity) · ⛔ never order modals by fixed z-index or DOM order | `layout-check` |
| **Keyboard ↔ search** | ⛔ Don't jump while a lookup works; done ➜ come at once; ceiling 15s (fail-open) | `lookup-prefetch-test` |
| **Lookup failure identity** | ⛔ `lookupCode` survives retries; the Cookie message points to the Windows sync tool ➜ Netlify Blobs, not the old env-paste workflow | `lookup-failure-identity-test` |
| **Consecutive scans** | ⛔ Busy is a *wait*, not an *end* | `lookup-burst-test` |
| **Orphan lookup queue entries** | ⛔ Early exits **release** their queue entry; the ceiling measures **real** waits only | `lookup-burst-test` |
| **Cleanup rule labels ↔ constants** | ⛔ User-facing text is read from the constants | `trash-modal-test` |
| **Progress trackers** | ⛔ Polling must not consume the evidence (idempotent) | `connection-recovery-test` |
| **Queried key ↔ registered key** | ⛔ A dead guard = no guard. ⛔ **The key existing is not enough — each listener reports *its own key***: a callback passing a **sibling** key (1) keeps its death out of `dbListenerFailedPaths` ➜ `dbListenerViewIsStale()` **dies silently** and (2) lets the sibling announce for it | `listener-pending-key-test` |
| Reconnect ladder | The cycle must not cut a handshake | `reconnect-ladder-test` |
| Timeout · retry | Every `fetch` truly aborts | `network-timeout-test` |
| Network pressure | Concurrency ceilings | `network-pressure` · `license-network-pressure` |
| Service worker | Cache-first; ⛔ every fetch that fills the SW cache (install · revalidate · cache miss) uses `cache: 'no-cache'` — a stale device HTTP cache (`immutable` on unhashed names) ignores new headers ➜ new JS + old wasm = `LinkError` ➜ iPhone can't scan · `immutable` only on hashed names (`/assets/*`); Cache API failure ≠ app down; normal navigation and direct assets like `/app.js` ➜ `index.html`; `guide.html` and Netlify Pretty URL `/guide` ➜ guide cache; sensitive queries never enter the cache key; ⛔ **background refresh never puts a *new deploy* into an *old* cache**: the old SW stays in control while a new install fails ➜ new `index.html` references assets missing from the cache ➜ **offline white screen** ➜ `shellDeployIsCurrent()` (server sw.js still at this `CACHE_VERSION`) is the gate · new versions arrive only as one install group · both apps | `sw-cache-failure-test` · `sw-shell-latency` · `sw-install-integrity` (round 4: stale HTTP cache · round 5: failed new install) · `sw-cache-key` · `sw-revalidate-pressure` · `offline-shell` · `user-guide-test` · `netlify-config-scope-test` part 5 |
| **Unbounded waits** | ⛔ "Connected but dead" networks hang — they don't throw | `stall-guard-test` |
| **SW ↔ page: wiring in `registerServiceWorker()`** | ⛔ Both ends have tests (SW posts · handler · update banner) but **the listener in `boot.ts` connects them** ➜ measure with real app · SW · browser and post from the **SW context** (`clients.matchAll()` ➜ `postMessage`), not `dispatchEvent` in the page: `zoew-open-notify` ➜ 🔔 panel · `zoew-push` ➜ fetch notices · message types derived from `sw.js` (new type without assertion ➜ fail) · `visibilitychange`/`focus`/`online` ➜ `reg.update()` only after a 15-minute ceiling · `controllerchange` ➜ "new version" banner only when a controller existed since load (⛔ not on first install) | `sw-client-wiring-test` |
| **Loops that never end** | ⛔ A stuck tab **answers nothing** (no toast · save · Sentry) ➜ worse than a named failure. ⛔ Bounds are **structural**: arithmetic on `Infinity` never ends · numbers from Firebase are not bounds · `Number.isFinite()` is not enough (`1e12`) ➜ ceilings by real structure. ⛔ Shapes to measure: `while` · `do-while` · condition-less `for` · **numeric-counting `for`** · **start points from arguments** (`matchingBraceIndex(src, -Infinity)` ➜ harden the start inside the helper: `Number.isFinite` + `< 0 ➜ 0`, not at call sites). ⛔ A **one-sided clamp** is no protection ➜ `clampLockerCount()` is the choke point **reads and writes** pass. ⛔ Measure by **really running in a separate process** (time + heap ceiling) · with a **reverse** direction (normal values give the same result) · scope **both apps** | `loop-termination-test` |
| **Hung Firebase calls** | ⛔ RTDB doesn't reject offline — it hangs ➜ in-flight locks stick forever | `db-stall-guard-test` |
| **Hung writes behind helpers** | ⛔ Cleanup locks release · late writes finish their work · the user sees a message | `write-stall-guard-test` |
| **Work locks ↔ hung trash writes** | ⛔ Same rule for locks behind writes **without a ceiling**: "transaction lands fast ➜ network drops ➜ `fb.update` hangs" ➜ `finally` **never runs** ➜ lock stuck forever ➜ ⛔ the **2h/7d** rules die for that parcel (**money never deducted**) and remove-scan mode dies. ⛔ The fix is `settleLockWithin()` on the **lock** — **not** `dbOp()` on the write (that would reverse money wrongly when the write lands late) | `stall-lock-release-test` |
| **Locker assignment ↔ claim** | ⛔ `assignLockerToEntry()` has the `clearClaim` gate **like the other 10 write paths** — Firebase rules don't block it (the fence allows every write with `newData.exists()`; it only protects **deletes**). Without it ➜ "delete all" writes trash from the snapshot **before** the Locker ➜ the change vanishes while the toast shows **✅**. ⛔ **Don't add a gate for restore markers** — measured: restore paths **don't lose** the Locker (`applyClaimedRestoreToHistory` merges onto `currentItem` · `finalizeClaimedRestore` writes field-level only) | `locker-claim-guard-test` |
| **Dead `clearClaim`** | ⛔ An **ownerless** marker is a permanent trap: `runAutomaticCleanupRules()` aborts on the **presence** of `clearClaim` ➜ an expired-lease claim ➜ ⛔ **2h/7d** rules die for that parcel forever ➜ **money never deducted**. `releaseStaleClearHistoryClaim()` is the single releaser: ⛔ decides on the **server view inside a transaction** · ⛔ never touches **live** claims or claims of **this device** (`activeClearHistoryClaims`) | `stale-clear-claim-test` |
| **ZTO: budget ↔ Netlify ceiling** | ⛔ The default budget fits in **10s**, otherwise the Function is killed before answering | `zto-budget-test` |
| **ZTO: cache ↔ Cookie renewal** | ⛔ The cache key holds no Cookie; a cache hit never touches Blobs | `zto-budget-test` |
| **ZTO: "not found" verdict** | ⛔ Cached (short TTL); transient failures **must not** be | `zto-negative-cache-test` |
| **ZTO: tuning numbers ↔ docs** | ⛔ Defaults in docs are read from real code | `zto-negative-cache-test` |
| **Late commit after a ceiling** | ⛔ Hang ≠ didn't happen — post-commit work runs when the commit arrives | `late-commit-test` |
| **Blocked storage** | ⛔ The `window.localStorage` **getter itself** throws | `storage-guard` · `storage-blocked-boot-test` |
| **Absent dependency** | ⛔ A synchronous `TypeError` bypasses `.catch()` | `camera-resume-test` |
| **`data-act` element ↔ second listener** | ⛔ Rule 4 of "CSP and `data-act`" has a **structural guard**: `el.on<evt> =` on an element that already has `data-act` ➜ fail (derived from real `index.html` · honors scope · **reverse**: elements without `data-act` bind freely from JS) | `action-binding-test` |
| CSP | No `on*=`; lazily loaded resources must pass CSP | `csp-enforced-test` · `csp-lazy-resource-test` |
| XSS | Every value into HTML goes through `sanitizeInput()` (**both forms**) | `html-sink-escaping` · `inline-handler-xss-test` |
| Secret leaks | Redaction walks the whole event | `secret-hygiene` |
| **Sentry: error storms** | ⛔ A listener rejecting repeatedly reports **once per path per outage** (`dbListenerReportedFailures` ➜ cleared when the path lives again) · `ZoeErrors.capture()` drops identical events (zone·context·message) for 10 minutes (`suppressedRepeats` · fail-open) — both apps. ⛔ **Dedup never swallows identity**: different `itemId` · `item` · `barcode` · `keyId` · `date` · `path` ➜ send (cap 5/signature/window) — the admin needs each parcel id | `connection-recovery-test` · `sentry-load-race-test` |
| **Error alerts** | ⛔ Alert rules search only **tags** ➜ money paths send `zone: 'money'` | `money-guardian-test` · `sentry-load-race-test` |
| DOM · state after logout | No customer data left | `dom-hygiene` · `state-hygiene` · `setup-link-logout-test` |
| PTR · panel motion · scrolling | ⛔ Don't touch without a request | `gesture-test` · `panel-motion-test` · `ios-panel-glide-test` · `panel-snap-ownership-test` · `phone-search-swipe-test` |
| Layout | Assert **both sides** (no overflow **and** no squeeze) | `layout-check` · `fluid-type-focus-test` |
| **Undeclared CSS variables** | ⛔ `var(--x)` without `--x` ➜ **the whole declaration dies silently** (not just the color) | `css-var-test` |
| **3-step type scale** | Phone `<700` · tablet `700–991` · desktop `>=992` | `fluid-type-focus-test` · `layout-check` |
| Toasts tell the truth | "connected" ≠ "data arrived" ≠ "still signed in"; a write's success comes after a durable commit, not optimistic UI · ⛔ the live network toast (`noteConnectionTransition`: connected ➜ offline while signed in) is **one** element that changes itself · ✅ only when every listener is fresh · "connecting" grace · never connected since open · a live login/Config toast exists ➜ no toast · ⛔ a live toast past its ceiling (20s) while "🔄 …" ➜ turns into "⚠️ … longer than usual" before vanishing (⛔ never vanishes silently) and a late success ➜ ✅ once (`expireLiveToast()`) · ⛔ one recovery ➜ one ✅: once the live toast announced, `noteDbListenerAlive()` adds no second message (`liveSuccessCount()`) | `toast-truth-test` · `toast-action-truth-test` · `ZoeW/tests/network-toast.test.tsx` · `ZoeW/tests/toast-live-expiry.test.tsx` · `ZoeW/tests/recovery-toast-dedup.test.tsx` |
| Helpers shared by both apps | Byte-identical except a reasoned list | `shared-fns` |
| **Same logic twice in one file** | ⛔ One formula must not live in 2 places — next round fixes one, forgets the other (rule 12 for *code*). ⛔ **Reported ≠ "delete it"** — "same text, different function" is real ➜ before unifying, measure **free variables** (only helpers reading parameters + top-level functions are safe) and **keep the difference as a parameter or at the call site**, never delete it. ⛔ **Text scanning misses half** — measured (2.30.2): a money formula lived in **11 places** while a text detector caught **5** ➜ needs a **structural** detector that **keeps property names** (`.cod` ≠ `.dod`) | `code-duplication-test` |
| `fb.X` the loader doesn't export | Silent `undefined` in production | `sdk-surface` |
| App version | `app.js` ↔ `manifest.json` ↔ `index.html` **inside each app** | `version-check` |
| **Version bump scope** | ⛔ Bump only apps really changed (don't force users to re-download) — ⛔ **server code** (`netlify/` · `tools/`) **is not "shipped code"** ➜ it must not force a PWA shell bump | `version-bump-scope` |
| License ↔ crypto | ⛔ "Can't verify" ≠ "bad signature" — never delete the record | `license-grace-test` |
| **License ↔ clock** | ⛔ An unsynced clock **cannot delete** a record | `license-grace-test` |
| **App ↔ License module** | ⛔ The "synced" flag is set only by a value **from the real server** · ⛔ post-login verification over 20s (slow network) ➜ retry per `ACTIVATION_RETRY_STEPS_MS` (session switch aborts · ladder exhausted ➜ guidance message) — ⛔ never toast-and-stop (empty app, no dialog) | `license-clock-trust-test` · `ZoeW/tests/activation-retry.test.ts` |
| **License ↔ clock changes** | ⛔ Time can't go backward; Activate needs a server verdict | `license-clock-rollback-test` |
| **Key 1 ➜ devices by ceiling** | ⛔ **The decider is the rules** (client code is cosmetic): seat `license_seats/<appCode>/<keyId>` in the License Project is writable only if (a) absent **and** the Key really exists, or (b) same `device` · clients can't delete · listing denied (`.read` at `$keyId`). ⛔ `getDeviceId()` reads back after writing · "can't identify ≠ seat belongs to someone else" ➜ `ok: null` doesn't delete the record (only a real `seat-taken` does) · `activate()` requires a real `seat === 'mine'` · old record + empty seat ➜ claim it (otherwise one deploy locks every customer) · the same device can Activate again · `checkOnline()` without `claimSeat` never writes · releasing devices is the admin's job via ZoeKeyGen · ⛔ never loosen seats. ⛔ Ceiling `license_keys/<app>/<keyId>/maxDevices` (admin-only write · absent = 1) enforced by **fixed slot names `d1..d5`** (RTDB rules can't count children ➜ slot count = ceiling in the schema) · slot names live in 3 files (`license-verify.js` · `ZoeKeyGen/app.js` · rules) and must agree · races move to a free slot (`LICENSE_SEAT_CLAIM_TRIES`) · ZoeKeyGen counts only within the ceiling. ⚠️ iOS: PWA and Safari have separate storage ➜ install the PWA **before** Activating | `license-seat-test` · `emu/license-seat-rules-test` · `license-app-code-test` |
| **Seller notices (ZoeKeyGen ➜ ZoeW 🔔)** | ⛔ ZoeKeyGen writes `license_announcements/<App>/<id>` in the **License Project**: rules **public read · admin-only write/delete** · locked schema (kind `notice`/`maintenance` ⛔ not `update` · title 1–120 · body ≤ 600 · id `n` + 13-digit time + 6 chars ➜ time-ordered · `$other` rejected). ⛔ Kinds · length bounds · count cap live in `ZoeKeyGen/app.js` · `ZoeKeyGen/index.html` · rules · `ZoeW/src/features/notifications.ts` ➜ must agree (guard derives from both sides, not literals). ⛔ ZoeW reads via `ZoeLicense.announcementsUrl()` (one License URL · `orderBy $key` + `limitToLast`) · ⛔ "can't fetch" (401 before Publish · network · bad JSON) ≠ "none" ➜ keep old notices · `null` from the server = truly none · ⛔ seller notices **never touch** "📱 កំណែ App" (it reads only `announcements.json`). ⛔ ZoeKeyGen: ✅ only after commit · hang ➜ "⏳ not confirmed" (⛔ not "failed") + ✅ on late commit · rejection ➜ "failed" · session switch ➜ silent · keep the last 20 (delete old in the same update) · ⚠️ anyone can read ➜ never put secrets there | `keygen-notice-test` · `emu/license-seat-rules-test` part 12 · `ZoeW/tests/seller-notices.test.tsx` |
| **Supabase: `fb` adapter ↔ Firebase SDK (ZoeW)** | ⛔ Money/listener code **never branches on backend** ➜ every difference lives in the adapter (`src/services/supabase-*.ts`) and it must equal the real Firebase SDK (val · key order · deep update · increment · transaction · listener · sync/async errors). ⛔ Adapter surface ⊇ every `fb.X` the app uses · adapter-only names (`accountOf` · `tenantScope` · `registerAccount` · `resetPassword`) used behind gates (`typeof` or `__supabase`) · reply lost after commit ➜ same `op_id` (increment never applied twice) · transaction ➜ `txOutcome` `applied`/`unknown` (same `disconnect` rule · stamps via `elapsedSince()`) · `document` access goes through `platform/document-io.ts` | `emu/supabase-adapter-parity` · `sdk-surface` · `npm run purity:check` |
| **Supabase: RTDB rules in Postgres** | ⛔ `firebase-database.rules.json` is the single source ➜ the **latest** `*_zoe_rules.sql` must equal `rulesSql(compileRules(…))` (change rules ➜ `node supabase/scripts/generate-rules-sql.mjs` writes a new file ➜ Publish on Firebase **and** merge/paste the new file) · the verdict on every real app write equals the real RTDB emulator. ⛔ Cross-tenant (RLS · `zoe_read`/`zoe_pull` · broadcast by topic) · `zoe_write` locks the tenant (`for update`) **before** reading seq (measured with a real lock from a third session, not a timing race) | `emu/supabase-rules-parity` · `supabase-datastore-test` · `supabase-rls-test` |
| **Supabase: accounts · invite codes · shop status** | ⛔ Identity = `auth.uid()` + `tenant_members` (server-written only), not claims/`user_metadata` · invite/reset codes 100 bits · DB stores only hashes · code checked **before** creating the account · unknown outcome ➜ **don't delete** the account. ⛔ ZoeW refuses Secret key/`service_role` · `loginDomain` must be `.invalid` · no Activation Key (`ensureAppActivated()`) ➜ 🩺 License row = shop status (expired/disabled ➜ ❌ · unknown ➜ ⚠️) · cleanup journal bound to tenant · ⛔ **a Setup Link whose invite code was used/expired ➜ login dialog, not sign-up** (`routePendingInvite()`: code hash on device `zoew_used_invites_v1` · `register` + `check: true` mismatch · old/unknown Function ➜ sign-up only if this device ever signed into that project · ⛔ never swap forms under the user · another project's code ➜ discard) · login memory bound to **backend + project** (`login-memory.ts`: `remembered_email` + `remembered_email_scope`) · Supabase session bound to URL (`zoew-sb-auth-owner`) | `supabase-rls-test` · `supabase-functions-test` · `ZoeW/tests/supabase-account.test.tsx` · `ZoeW/tests/login-routing.test.tsx` · `health-check-test` · `firebase-config-paste-test` |
| **Supabase: SECURITY DEFINER ↔ API** | ⛔ A `security definer` function callable by anon/authenticated **is never in a schema PostgREST exposes** (`pgrst.db_schemas`: `public`) ➜ definer bodies live in `private` · `public.*` are `security invoker` wrappers calling them (same name · arguments · defaults · result) — Supabase Database Linter rules 0028/0029 replicated from the real `supabase/splinter` · ⛔ never add `private` to Exposed schemas · a new user-callable RPC ➜ same pattern · service_role-only functions (`finish_registration` …) are outside this rule | `supabase-rls-test` |
| **Supabase: migrations ↔ Deploy from GitHub** | ⛔ The integration ("Deploy to production" on merge to `main` · Working directory `.`) applies only versions missing from `supabase_migrations.schema_migrations` ➜ files in `origin/main` **can't be edited · deleted · renamed** (edits never reach the database, silently) · new versions sort last · no duplicates · one migration per transaction (no `concurrently`) · a migration pasted in the SQL Editor ➜ `migration repair` first · ⛔ no secrets in `config.toml` (Auth/API config is not applied to production · Edge Functions declared in `config.toml` are deployed) | `supabase-datastore-test` part 0ខ |
| **ZoeKeyGen: "🏪 ហាង Supabase" panel** | ⛔ Branch regex · name length · days · code hours · account name equal the checks in the migration · every error code the `admin_*` RPCs raise has Khmer text (both directions). ⛔ `sbAdminConfigProblem()` agrees with ZoeW's `supabaseUrlIsAllowed`/`supabaseKeyIsSecret` (a Link ZoeKeyGen issues must be accepted by ZoeW) · Setup Link `{supabaseUrl, supabaseKey, invite, dsn?}` carries no token/password. ⛔ Every step after `await` checks `sbAdminIsCurrent()` (logout midway ➜ no toast · request · DOM) · `sbAdminReset()` (called from `showLoginModalWithPrefill()`) clears every sensitive value (incl. labels with shop names) · 401 ➜ reset + a single "expired" | `keygen-supabase-admin-test` · `dom-hygiene` · `secret-hygiene` · `html-sink-escaping` |
| **Phone notifications (Push · ZoeW)** | ⛔ Identity = **Activation Key** (real ECDSA signature + Revoke/expiry from the License Project · Extend in DB wins) ➜ no extra setup per customer · "can't verify" = 503 ≠ "bad" 403 · public key/prefix/License URL in `netlify/lib/push-core.mjs` derived equal to `license-verify.js`. ⛔ **Supabase shops** (no Key by design): identity = session token ➜ `my_account()` on the project in env (`SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY`, same as the ZTO Function ⛔ Secret key refused) ➜ key per **shop** (`supabaseTenantKeyId()` ➜ devices in a shop share index/schedule) · foreign/expired issuer ➜ never call Supabase · shop expired/disabled ➜ `shop-inactive` · bad token/no shop ➜ `no-account` · down ➜ 503 · env missing ➜ `server-off` · app: `pushIdentityMissing()` checks **synchronously** before `requestPermission()` and fetches the token after (iPhone gesture). ⛔ Web Push: aes128gcm (RFC 8291 · official test vector) + VAPID ES256 · endpoints only on real push-service hosts (SSRF) · 404/410 ➜ delete sub. ⛔ APK: FCM via the service account of the **single License Project** (not customer projects) · `__FCM_CONFIGURED__` (presence of `google-services.json` at build) ➜ absent ➜ **don't load the plugin** (FirebaseMessaging crashes the app) · channel `zoew_notify` (high importance) equal in server/manifest. ⛔ At-most-once delivery: ledger locked by ETag (`onlyIfMatch`/`onlyIfNew`) ➜ cron + kick in parallel send once · first run = baseline (no old notices) · notices > 24h never sent. ⛔ Netlify scheduled functions have a **30s** ceiling ➜ the cron's 2 stages (notices ➜ reminders) **share one ceiling** (`runPushCron()` · send ceiling + last-send ceiling < 30s) · ceiling exhausted ➜ **don't lock** that day's reminder (the next run within 8am sends) — otherwise a kill after the ledger lock = reminder silently lost. ⛔ Near-expiry parcels: the app sends **only times** (no phone/barcode) computed from the same `barcodeAbandonIsRipe()` (binary search ± 1 minute · no second formula) and only when the view is fresh · server reminds once a day at 8am Asia/Phnom_Penh · schedule > 48h ➜ no reminder · message states data time. ⛔ App: `Notification.requestPermission()` before any `await` (iPhone gesture) · ⛔ `busy` is a **lock** (`togglePush()` refuses) ➜ **every wait behind it has a ceiling**: web: `getSubscription`/`subscribe`/`unsubscribe`/`serviceWorker.ready` through `withTimeout(…, PUSH_TIMEOUT_MS)` · APK: steps before `register()` that don't ask the user (load plugin · `checkPermissions` · `createChannel` · listeners) through `pushStep` (the permission prompt has no ceiling by design, like web) + watchdog `PUSH_NATIVE_REGISTER_TIMEOUT_MS` after `register()` (no token ➜ `error` · late token ➜ still ends `on` · token arrived and server slow ➜ watchdog doesn't cut) · ⛔ **a promise must never resolve to a Capacitor plugin directly**: the plugin is a Proxy answering `then` ➜ the promise hangs forever (APK stuck at "⏳" with 29 tests green) ➜ `loadNativePush()` returns a `{ PN }` shell · test mocks must be Proxies like the real one (a test binds this to installed `@capacitor/core`) · ⛔ APK **off** ➜ send `unsubscribe` for the token to the server (token kept in `zoew_push_v1`) before `unregister()` — the plugin's FCM token delete fails silently offline ➜ otherwise the server keeps sending after the user turned it off · ⛔ accept a token **only** when the user wants it on (`nativeWanted` · `nativeEnabling` · `saved.on`): FCM auto-init tokens at boot · late tokens after off ➜ don't register · registered while off ➜ remove it again · status tells the truth (server-off · no-license · denied · needs-install · native-unconfigured) · tap ➜ 🔔 panel (`?notify=1` · SW message · `pushNotificationActionPerformed`) · SW shows every push (userVisibleOnly) and URLs stay in-origin. ⛔ **🧹 សម្អាត** hides only announcements/notices (`zoew_notify_dismissed_v1`) + OS notifications ⛔ never the near-expiry list or "កំណែ App" | `ZoeW/tests/push-server.test.ts` · `ZoeW/tests/push-client.test.tsx` · `npm run android:check` · `keygen-notice-test` (wake-up) |
| Inspect-element protection | ⛔ Can't be hardened — don't try | 📝 (structural) |
| **Users write revenue numbers directly** | Accepted by design (no backend) | 📝 |
| **Customer identity: phone number** | ⛔ The stored number is the merge key (`phone`+`scanDate`) and the basis of `getPickupPhoneKey()` ➜ one junk character splits a customer in **two**. `normalizeOneStoredPhone()` strips `= " '` **symmetrically at both ends** (Sheets/Excel `="012…"` form). ⛔ **Inner** separators stay (changing the format splits merges with old data) | `phone-suggest-test` |
| **Dates and times** | The business calendar is `Asia/Phnom_Penh` on every device | `khmer-timezone-test` |
| **Monthly report** | ⛔ Derived from **days** (month nodes keep only 3 months) · **read-only** · same basis as the original screen. ⛔ **Every exported column carries the field its header promises** — assertions **derived from headers** plus layers "all values differ" and "has cents" | `monthly-report-test` |
| **Monthly ledger ↔ daily ledger** | ⛔ `monthly[M]` must **equal the sum of `daily[d ∈ M]`** on the server. `ledgerDeltaWithClamp()` clamps **per bucket** ➜ a deduction larger than the *day's* ledger clamps on the day but **not** on the month ➜ 📊 drifts from the monthly report **permanently**. `alignMonthlyLedgerToDaily()` is the single aligner (⛔ the normal path **writes nothing extra**). ⛔ **Restore adds back *every field* into *both buckets*** (`appendRestoreRevenueIncrements`) — scenarios must run with non-zero DOD. ⛔ The month verdict reads **what the server really stores** — nodes trimmed to 3 months ➜ a trimmed month ➜ verdict **`0`** | `monthly-ledger-agreement-test` |
| **"Revenue" ↔ uncollected parcels** | ⛔ Revenue = ledger **minus** barcode values with `!isDeducted && !isClosed` · clamp per currency · unmeasurable ➜ `—` · **2** stats screens use the same helper. ⛔ **5** guard layers: (1) calls + "month total = sum of days" (static) · (2) **the number the user reads** in a real browser · (3) **summation level**: month revenue = **sum of daily revenues** (`buildMonthlyReport()` sums `collectedValueOf()` per day · ⛔ no month-level formula · `buildStatCardItem()` receives already-computed revenue) · (4) **measurability** covers the `ledger` side too · (5) **random order** on the display path (`collected-value-fuzz-test`) | `monthly-report-test` · `stats-collected-truth-test` · `stats-screen-agreement-test` · `stats-measurable-gate-test` · `collected-value-fuzz-test` |
| **Empty list ↔ measurability** | ⛔ "No data" is a business claim ➜ a non-fresh view = "not arrived yet". `emptyViewMessage(pathKeys, emptyText)` is the single decider (from `dbListenerViewIsStale()`) ➜ covers **5 screens** (daily stats · daily revenue · monthly report · trash · history table) · **5 exports** · and the "ZTO មិនទាន់បិទ" bar/dialog (`ZTO_SYNC_VIEW_KEYS` = `history` + `deleted`: the formula's sources = the gate's sources). ⛔ Incompleteness enters the signature too | `empty-state-truth-test` |
| **"ចំណូលប្រចាំថ្ងៃ": by pickup day** | `zoew_daily_collected_cod_dod` counts barcode sets `{c,d}` by closing day (daily/monthly ledger by scan day). ⛔ Close goes through the history transaction first, then reconciles from server values · reopening deducts from the day holding the entry · moving days = one multipath update · price edits decided in a server transaction · keep the newest day, drop old duplicates · never create keys/days cleanup already deleted · retry Native SDK rejections only within a ceiling, re-reading history and re-checking auth/database. ⛔ The memory mirror reads from one listener (no writes/rollbacks from local snapshots) · rejection never shows Sync success · late callbacks stay within the same auth/database · Delete/pickup never delete collected · never touch `isDeducted` · ledger · `packagesPickedUp` from the mirror. ⛔ 7-day cleanup: server clock + fresh view · keep unknown keys · not cleaned yet ≠ missing day. ⛔ History and mirror are 2 separate writes ➜ drift is measurable only on a **real dump** (`money-reality-check.js` part 5ខ: bounds derived from the dump, not the clock) | `daily-collected-test` · `emu/restore-mutation-emu-test` · `money-reality-check` (real dump) |
| **Revenue mirror ↔ ledger** | ⛔ Second half of the row above: mirror `zoew_daily_collected_cod_dod` has 3 writers (close/reopen barcode · close/reopen parcel · price edit) — **paths that take a parcel *out of the system* must touch it too**. ⛔ **"Remove" (row 4) deducts the ledger ➜ it must delete the mirror entry**; ⛔ **"Restore" (row 9) adds the ledger back ➜ it must rebuild the mirror on the day of the **new** `closedAt`** (`reconcileCollectedHistory()` is the choke point — ⛔ no second formula). ⛔ **Reverse: "Delete" (row 5) doesn't touch the ledger ➜ it must *not* touch the mirror** (deleting it would erase real revenue of a customer who picked up) | `collected-mirror-lifecycle-test` · `collected-mirror-fuzz-test` (random order) |
| **Interrupted cleanup** | ⛔ `claimAndCleanupItem()` writes **4 separate times** (history ➜ trash ➜ daily ledger ➜ monthly) ➜ interruption between steps (deploy · PTR · tab close · network drop) loses the parcel from both places. ⛔ The fix = **a journal in `localStorage`** (`zoew_cleanup_journal_v1`) written **before** network writes · `resumeInterruptedCleanups()` finishes on the next tab · ⛔ not a new server marker. ⛔ The ledger step sits **after** trash: verdict `moved` ➜ restore can deduct · `ledger` = uncertain ➜ **don't touch money**, tell the user. ⛔ Reverse: `ledger` + empty trash ➜ don't revive · clean cleanups leave no journal · "picked up" never touches money. ⛔ Measured as **barcode conservation** · journal calls are **fail-open** (`noteCleanupJournalEntry`) · key = **trash** id · `cleanupJournalScope()` (`databaseURL`) protects against the wrong project after Reconfig. ⛔ **The journal of a cleanup that is *still running* is not an interruption**: the journal lands **before** the trash write ➜ the 60s cycle / `visibilitychange` / a second tab sees a `moved` entry while the write is in flight ➜ **double deduction** ➜ `withCleanupEntryOwnership()` is the gate (`cleanupJournalLive` in page · Web Locks `zoew-cleanup-live-<id>` across tabs, released by the browser when a tab dies · fail-open without the API) and re-reads the entry **fresh** after acquiring | `cleanup-interrupt-atomicity-test` · `money-guardian-test` |
| **Destructive cleanup** | ⛔ Needs the real server clock **and a live connection** | `cleanup-clock-guard-test` |
| **App lock on open/return** | The lock never touches the 4-hour session · Refresh and calls don't lock. ⛔ Unlock-flag lifetime = `lookupSecretKey` lifetime: `CryptoKey` kept in **IndexedDB** (⛔ not sessionStorage — that needs `extractable: true`) · cleared only via `clearAppUnlockedForSession()` · the two protection layers (`appLockShouldArm()` · clearing on lock) measured separately. ⛔ The switch has an **off direction**: flag `zoew_app_lock_v1` in `localStorage` · `appLockIsEnabled()` is the single decider (gate · task-switcher cover · label) · absent key = **on** (only `'0'` is off) · turning off goes through PIN with its own `promptKey` `appLockOff` · ⛔ turning the lock off **is not** deleting the PIN (PIN · 4h session · email stay) | `app-lock-test` |
| **System health check** | ⛔ Read-only · never forces PIN · "can't check" is ⚠️ not ❌ · secrets never reach the DOM · ⛔ **real `fetchWithTimeout`, not a stub** · ⛔ an old round (close ➜ reopen) never overwrites "⏳" or unlocks buttons of the new round (`uiState.healthRunSeq`). ⛔ **The reverse too: ✅ must be measured** — ✅ on something unmeasured is **worse** than a false ❌ (it sends the user to the wrong cause). ⛔ **`cookieState` belongs to each container** ➜ "never used yet" = **⚠️** not ✅ · ⛔ the ZTO row shows Cookie renewal: `renewals > 0` ➜ clear evidence; `observed:false` ➜ **"not measured yet"** (⛔ not "can't renew" — `upstreamCookieSignal` is per container); `observed && !setCookie` ➜ Argus didn't send ➜ manual Sync needed. ⛔ This info **doesn't change the verdict** ❌/⚠️/✅ and **cookie names never reach the DOM** · ⛔ **Cookie age = real age in the Blob** (`blobSyncAgeMs` from the Sync tool's `syncedAt` metadata · `blobRenewAgeMs`), not `ageMs` (container cache age) · no stamp ➜ "unknown" · ⛔ the License row (Firebase) shows **Key validity** (expiry · days left · ≤ `LICENSE_NEAR_EXPIRY_DAYS` ➜ ⚠️ · expired/revoked ➜ ❌ · unverifiable ➜ ⚠️) | `health-check-test` · `zto-cookie-store-test` · `zto-cookie-sync-test` |
| **Excel import to Sheet (in ZoeW)** | PIN is the gate · requests must be *simple requests* · secrets encrypted | `sheet-import-test` |
| **APK ↔ ZTO Function: preflight** | ⛔ The APK (origin `https://localhost`) calls the Function cross-origin ➜ the preflight cache is keyed by **full URL** ➜ the query goes in header `X-Zoe-Query` to a fixed URL (`nativeFunctionRequest()` inside `fetchWithTimeout` is the single path · web unchanged) · ⛔ no `cache: 'no-store'` on that path (it bypasses the preflight cache) · the Function reads the header only when there is no query string · Max-Age 7200 · old Function ➜ 400 ➜ the app tries the URL with a query and remembers | `zto-proxy-test` part 2ខ · `ZoeW/tests/native/zto-preflight.test.ts` |
| **Apps Script ↔ simple request** | ⛔ Same rule for the **Lookup path** — no custom header and **no PIN** for it | `lookup-prefetch-test` |
| **CSV/TSV import** | ⛔ Leading zeros never lost (`raw` only for text) | `sheet-import-test` |
| **Import done ➜ data arrives at once** | Table filled from the file · `fresh=1` opens the cache · cleanup never resurrects | `lookup-freshness-test` |
| **ZTO: auto-login** | ⛔ **Removed (2.25.0)** — the IdP doesn't open to Netlify IPs; never bring it back | `zto-proxy-test` |
| **ZTO: Cookie store** | ⛔ Blobs down/hung ➜ fall back to env, never fail the lookup. ⛔ **"Can't re-read" ≠ "Cookie gone"**: that fallback **must not overwrite memory** — the in-memory blob Cookie lives until a **real 401** (`mustRevalidate`); otherwise Blobs-based installs (no `ZTO_COOKIE` env) answer **503 `ZTO_AUTH_NOT_CONFIGURED`** while the Cookie is fine. ⛔ **Background** refresh is never locked behind the *request* budget (it has its own ceiling) — otherwise a tight budget **freezes the Cookie forever** | `zto-cookie-store-test` · `zto-budget-test` |
| **ZTO: "signed" status** | ⛔ **3** verdicts: `true` · `false` · `null` (field missing ➜ `null`, not `false`). ⛔ The field is optional ➜ misconfiguration (`ZTO_FIELD_SIGNED`/`ZTO_SIGNED_VALUES`) **disables only this feature** + reason in `?diag=1` (⛔ never throw `ZtoConfigError` ➜ 503) · configured values never appear in `?diag=1`. ⛔ Field paths are **flat** (no `data.` · `orderCandidates()` already unwrapped), incl. doc examples. ⛔ Production values: `ZTO_FIELD_SIGNED` = **`billStatus`** · `ZTO_SIGNED_VALUES` = **`5`** — ZTO owns them ➜ they can change: picked-up parcels reappear on the bar ➜ check the number in Argus and add `ZTO_SIGNED_VALUES=5,<new>` (⛔ don't suspect code first) | `zto-signed-status-test` |
| **"ZTO មិនទាន់បិទ" bar** | ⛔ Verdicts live only in `localStorage` (`zoew_zto_pickup_status_v1`) — **never touch money · `isDeducted` · Firebase directly**; writes only through the **single** door `applyBarcodeCloseChange()`. ⛔ The bar appears only on a real `false` verdict · a reopened barcode leaves at once · scans both `scanHistory` and `deletedItems` (only `trashReason === 'pickup'` within 12h) · non-ZTO Lookup ➜ dormant · logout ➜ clear DOM + storage. ⛔ **No endless calls**: 1 per barcode · 10 per round · 20s apart · never while scanning (`autoLookupInFlight.size > 0`) or offline · `ztoClosed: null` is **remembered** like a verdict · upstream failures are **not remembered** but retry is bounded (`ZTO_STATUS_FAIL_BACKOFF_MS` · cleared on success/`online`/`clearZtoPickupStatusStore()` · `force` bypasses) · `resumeZtoStatusSweep()` only touches timers already set. ⛔ Eviction when full (`ZTO_STATUS_MAX`) goes by **value** (`true`/`null` before `false`) · the entry just inserted can't be the victim · fallback victim = **oldest** · `while` has a `break` · measurement inserts **more than 1** non-`false` entry. ⛔ Automatic rounds are optional work ➜ `ztoStatusNetworkAllowed(userAsked)` covers `linkIsFrugal()` · `isModalOpen` (a tap wins) · long blocks ➜ no wake timer (`ztoStatusBlockIsTransient()`). ⛔ Bar/dialog say counting isn't finished ("កំពុងពិនិត្យបន្ត N") and N enters the signature (`ztoStatusModalSig`) · Locker reads `barcode.locker || item.locker` · field name `ztoClosed` derived from the real Function. ⛔ The list dialog holds only barcodes with a real `false` · Barcode image = `Code128Svg` (JSX) from `code128Bars()` (not an HTML string) · `clearSensitiveModalFields()` clears the list (it has phone numbers). ⛔ Code 128 verified by **real ZXing read-back** + reverse probe · quiet zone 10 modules measured **structurally** (`CODE128_QUIET`) · round-trip samples cover **even and odd** lengths · size measured as **width per module** (ceiling 1.5px) · ⚠️ ≥15-digit codes can't be fixed by CSS (accepted). ⛔ The sweep has **3** triggers: 60s cycle · `visibilitychange` · PIN unlock (⛔ never call it from `runScheduledCleanup()` itself). ⛔ **ZTO closed ➜ ZoeW closes too**: switch `zoew_zto_autoclose_v1` (default on) · ZTO switches appear only when `ztoFastModeIsOn()` and hiding **disables the feature** (`ztoAutoCloseEnabled()`/`ztoListSyncEnabled()`) · old settings kept · asks only about **open** barcodes in `scanHistory` (not trash · skips `clearClaim`/restore markers) · re-asks every hour (`ZTO_OPEN_RECHECK_MS` via `elapsedSince()`) · closes only on a real `true` · through `applyBarcodeCloseChange()` (money untouched) with `silent: true` · `showModal: false` · one summary message per round (failure/slow messages unchanged). ⛔ The sweep queue **rotates** (`rotateZtoSweepQueue(queue, ztoStatusSweepCursor)` · cursor advances in `finally`) instead of cutting the same head · no extra calls | `zto-sync-banner-test` |
| **ZTO: branch rights** | ⛔ **The branch number comes from *identity*, not a parameter**: Cookie `BOS-MAN-SESSION` reads **nationwide** and `ZTO_PROXY_KEY` is shared by every device ➜ binding the branch client-side **is not protection**. The server decides: Firebase **ID token** (RS256 · `aud` ∈ `FIREBASE_PROJECT_IDS` · `iss` · `exp`) ➜ branch from email `@zoew<number>.com` (**any digit count**) · `?site=` ignored · branch enters the cache key. ⛔ This layer rests on **"Enable create (sign-up)" being off** in Firebase Console · `email_verified` **not required** · failure disables only the list feature (`enabled:false` without `error`) · **scanning needs no token**. ✅ The Function calls only **read** endpoints ➜ ZoeW can't write to ZTO. ⛔ **Supabase shops**: Supabase token ➜ `my_account()` (env `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` ⛔ never the Secret key) ➜ the **shop's** `branch_code` · shop expired/disabled ➜ `site:tenant-*` · env missing ➜ `idtoken:supabase-unset` | `zto-list-sync-test` parts 18–20 |
| **ZTO: pulling the *list*** | ⛔ `?list=1` lives in the **same Function** (Cookie · budget · auth · `?diag=1` shared · `requestOnce()` per `plan` · **`fetch(` appears once**). ⛔ Misconfiguration ➜ disables only the list feature (`readListConfig()` never throws) · "disabled" = HTTP 200 `enabled:false` **without an `error` field** (an `error` field ➜ 30s cooldown) · non-array `result` = failure (not "0 rows"). ⛔ Branch from **identity** (row above): `query.site` ignored · `ZTO_LIST_SITE_CODE` no longer read · **no client-side branch field** · branch enters the **cache key** (`…\|L\|…` · TTL ≤ `cacheTtlMs`) and never appears in `?diag=1`. ⛔ The server projects only `barcode·phone·cod·dod·at`. ⛔ **DOD = `fcAmount`** on **both paths** (one `DOD_PATHS` · **first** because `arrivalServiceCharge` is always `0.00`) · ⛔ `freightFee` is **not** DOD (it charges freight already paid) · `ZTO_FIELD_DOD` wins · negative money **clamped to 0** in `pickNumber()` (⛔ not skipped to the next field) · reverse: `0` is valid. ⛔ "Not a customer" = **phone** `"0"`/empty (not `cod === 0`) · de-dupe within the list (last wins) · `fresh+existing+duplicate+skipped` = raw row count always · "new/existing" groups covered by `ZTO_SYNC_VIEW_KEYS`. ⛔ `scanTypeCode` + `scanTypeDesc` layers are **independent** (the same barcode appears as `03`·`04`·`05` ➜ otherwise money ×3) · field present but wrong ➜ `skip:'scan-type'` · field absent/empty ➜ **don't skip** · field values never reach the browser. ⛔ Preview **writes nothing**; import (`importZtoListRows`) goes through `claimBarcodeInRegistry()` ➜ `addOrUpdateEntry()` like a scan: real `'claimed'` verdict · failure ➜ `releaseBarcodesInRegistry()` · sequential · ceiling `ZTO_LIST_IMPORT_MAX` · stale view ➜ refuse entirely · honors **4 failure modes** (claim timeout ➜ `releaseLateBarcodeClaim()` · write timeout ➜ `armLateWrite()` ⛔ never release the key at once · "⏳ saving" message). ⛔ Date = **ZTO scan day** (`ztoScanStampMillis()` · wall clock `Asia/Phnom_Penh` · **optional** 6th argument of `addOrUpdateEntry()`) ➜ money lands on the ZTO scan day · bad stamp ➜ `getServerNow()` · no stamp ➜ not skipped but counted in the message. ⛔ Old rows: same decider as cleanup, `barcodeAbandonIsRipe()` (⛔ no fourth boundary formula · not via `elapsedSince()`), then by ZTO verdict: `true` ➜ import **already closed** (7th argument ➜ `applyBarcodeCloseState()` · stamp `getServerNow()` · pickup stats via `applyBarcodeCloseChange()` · ⛔ skip merge · failure doesn't release registry) · `false` ➜ `too-old-open` · `null` ➜ `too-old-unknown` · older than `trashRetentionMs({trashReason:'pickup'})` ➜ `too-old-purged` (derived · prevents duplicate money after purge). ⛔ Two-source verdicts (`pickSignedVerdict()` ➜ `resolveZtoListSignedVerdicts()` · ceiling `ZTO_LIST_SIGNED_PROBE_MAX`) · failures not remembered. ⛔ Every skip reason has text (`ZTO_LIST_SKIP_TEXT` ➜ `ztoListSkipText()`) · the end message lists **the days parcels landed on**. ⛔ Switch `zoew_zto_listsync_v1` (default off · under `ztoFastModeIsOn()`) · PIN `ztoListSync` · taps are not blocked by `linkIsFrugal()` | `zto-list-sync-test` |
| **ZTO: warm-up** | Warm by **user intent** and warm the **Cookie** too, not just the container; ⛔ **busy at the scheduled time ➜ reschedule, never give up** (ceiling 90s) | `lookup-prefetch-test` · `zto-cookie-store-test` |
| **ZTO: store name on both sides** | ⛔ The helper writes to the same `site:<store>` that `getStore()` reads | `zto-cookie-sync-test` |
| **ZTO: store failure reason** | ⛔ The reason survives the 60s env cache | `zto-cookie-store-test` |
| **ZTO helper: Android/Termux path** | ⛔ The second path lives in the **same helper**: the 4 deciders (`isTargetApiUrl` · `validateCookieHeader` · `captureResponseSucceeded` · `cookieAfterResponse`) are **imported** from `sync-zto-cookie.js` ⛔ never rewritten. ⛔ **`--auto` needs ADB** (it falls back to capture) ➜ putting it in the "no ADB" set guarantees **100%** failure; connecting must be an **attempt** (`|| true`). ⛔ **unzip drops exec bits** ➜ `chmod +x ./*.sh` **unconditionally** and helpers called via `bash`. ⛔ **The project dir is derived**, not literal `$HOME/ZTO-Cookie-Sync`. ⛔ **Intent URLs are plain https with no shell characters** — `adb shell` re-parses arguments **on the device** ➜ `#` starts a comment and swallows `-p com.android.chrome`. ⛔ Secrets live in Termux private storage mode **600** (dir **700**) ➜ reads refuse looser files and symlinks; Windows keeps **DPAPI** | `zto-cookie-sync-test` part 9 |
| **ZTO helper: cmd screen** | Messages are English ASCII · Cookie shown · keys never shown | `zto-cookie-sync-test` |
| **ZTO: Cookie renewal** | Never write a value that lost its session; write with ETag; a response from a timed-out attempt can't overwrite a newer renewal. An auth rejection in any of `code/errorCode/statusCode` wins over a success envelope | `zto-cookie-store-test` · `zto-cookie-session-test` |
| **ZTO: rate ceiling ↔ memory** | Auxiliary Cookies/same-value retries have a 60s ceiling; a new core session tries to write at once within budget, and pending lives until the write is confirmed | `zto-cookie-session-test` |
| **ZTO: Blobs reads ↔ response path** | ⛔ A value in memory ➜ answer at once, then refresh **in the background**; ⛔ empty memory or after a 401 ➜ a **blocking** read | `zto-cookie-store-test` |
| **ZTO helper: brief network drops** | ⛔ Transient failures retry **within a ceiling** (fresh signed URL each round); 401/403/404/422 **never retry** | `zto-cookie-sync-test` |
| **ZTO: auto mode** | ⛔ Never opens a browser without knowing the state | `zto-cookie-sync-test` |
| **ZTO: setup path** | ⛔ Re-running keeps the PAT — Netlify shows it once | `zto-cookie-sync-test` |
| **ZTO: `--auto` gate** | ⛔ Measure the value that decrypts, not file presence | `zto-cookie-sync-test` |
| **ZTO: Argus jar** | ⛔ Bad pairs ➜ skipped; no session ➜ rejected | `zto-cookie-sync-test` · `zto-cookie-store-test` |
| **ZTO: "not logged in"** | ⛔ ZTO answers with an **IdP URL**, not an auth code | `zto-proxy-test` |
| **ZTO: Netlify time ceiling** | ⛔ The Function answers JSON before being killed | `zto-proxy-test` |
| **ZTO: budget ↔ whole handler** | ⛔ Cookie store reads/writes sit **inside** the budget | `zto-budget-test` |
| **ZTO: 401 from a stale Cookie** | Re-read the store once; retry **only if the fingerprint changed** | `zto-budget-test` |
| **ZTO: time budget ↔ clock** | ⛔ The budget is measured via `elapsedSince()` (backwards ➜ fail-open) on **every budget basis** (`budgetLeftMs()` ➜ `cookieReadTimeoutMs()` · `cookieRenewTimeoutMs()` · `retryAfterAuthRejected()`). ⛔ Reverse: a budget too tight is also a bug: empty memory ➜ the Cookie read is **the whole request** ➜ gets the full store ceiling, reserving `COOKIE_COLD_UPSTREAM_RESERVE_MS` (otherwise 503 `ZTO_AUTH_NOT_CONFIGURED` while the Cookie is in Blobs); memory has a value ➜ the read is optional ➜ skippable. ⛔ Guard bounds derived from the real `COOKIE_STORE_TIMEOUT_MS` and the worst case (full read + upstream) < 10s | `zto-proxy-test` · `zto-budget-test` |
| **ZTO: hung network** | ⛔ Settling is guaranteed **structurally**, not by `AbortController` | `zto-proxy-test` |
| **ZTO: official API** | ⛔ Argus fake headers **are never sent** to Token/Authorization | `zto-proxy-test` |
| **ZTO: "not found"** | ⛔ ≠ error — HTTP 200 `found:false` with no `error` field | `zto-proxy-test` |
| **ZTO: `ZTO_UPSTREAM_REJECTED` is a mixed bucket** | ⛔ It mixes **permanent verdicts** (unknown number: test codes · non-ZTO parcels ➜ retrying is **useless**) with **transient ones** (ZTO really down ➜ retrying is **right**). Client-side 5xx is retryable ➜ an unknown code costs **2 rounds** and a Sentry event. ⛔ **Never silence it all** — that hides **real ZTO outages**. ⛔ **Never guess codes**: splitting needs **real ZTO payloads**. Step 1 is **visibility**: `noteUpstreamReject()` records `count · status · code` in `?diag=1` ⛔ **without changing verdict · cache · retry**. ⛔ The code is read via `upstreamCodeText()`, the **single choke point** shared with `upstreamSucceeded()`, and passes `SAFE_REASON_RE` ➜ **raw upstream text never appears** | `zto-proxy-test` |
| **React 100%: single DOM owner (ZoeW)** | ⛔ Feature code **never touches DOM**: modals = `uiState.modalDisplay` · text/flags = `viewState` · focus/value/measure = `src/app/refs.ts` · exceptions in `platform/document-io.ts` (reason + ceiling). ⛔ React layer (`src/app/**`): class · style · attribute · text · listener as JSX; remaining DOM writes (focus · scroll · `animate()` · uncontrolled inputs · `<html>`/`<body>` · non-passive `touch*` · `muted`) only in exits in `APP_ALLOWED`. ⛔ PTR indicator drawn from `ptrState` (not `uiState`) · `boot-flags.js` never touches React elements · every ref name has a real `ref={…}` (AST) · `commitNow()` before measuring/focus · inputs are **uncontrolled** (`defaultValue`/`defaultChecked`) · original checkers that write classes are translated only in the audit build (`src/audit-compat.ts`) | `npm run purity:check` (ZoeW) |
| **Big lists ↔ re-rendering (ZoeW)** | ⛔ The history table is **unbounded** (filter "ទាំងអស់" = thousands of rows) ➜ list bodies subscribe **only to their own view fields** (`useStoreFields`), not all of `useStore(uiState)` — `markImmediate` fields (sheet drag · menu · modal · `chromeHidden` while scrolling) commit **at once** ➜ rendering every row inside a motion path. ⛔ Parents re-rendered on every drag (`PageData` · `PageEntry`) use `Memo…` versions (the original function stays exported for `react-view`) · `HistoryRow` compares by **value** (`sameHistoryRowModel()` — Firebase gives new objects every snapshot). ⛔ Reverse: in-place edits + `renderHistory()` must render (`historyRenderSeq` ⛔ not `uiState.touch()`) · a listener failing on an empty list ➜ "unmeasurable" message (`firebaseState`) · other view producers assign a **new** object (in-place edits don't trigger rendering). ⛔ Big list dialogs (trash · ZTO not closed) render **pages of 20** + load more (IntersectionObserver/button) · totals/search over **all** items · search/reopen ➜ first page. ⛔ **The history table** renders **50 rows** (`HISTORY_PAGE_ROWS`) + loads more before the end (sentinel on `.table-responsive` · bottom `rootMargin`) · header count over **all** items · `renderHistory(data, viewKey)`: a Firebase sync (same key) **never pushes the user back to 50** · filter/search change (new key) ➜ 50. ⛔ APK: status-bar color measurement (forced layout + hit-test) runs only when **the layer under the bar** changes (`statusBarLayerSignature()`), not on every `uiState` change | `ZoeW/tests/list-render-scope.test.tsx` · `ZoeW/tests/list-paging.test.tsx` · `ZoeW/tests/history-paging.test.tsx` · `perf-check` (real Chromium) · `npm run native:check` 4ឃ |
| **🔔 notification panel (ZoeW)** | ⛔ "Near expiry" asks the **same `barcodeAbandonIsRipe()`** as the 7-day cleanup (no second boundary formula) · read-only (never touches money/Firebase) · stale history view or no database ➜ "unmeasurable" · logout ➜ list removed from DOM. ⛔ The 🔔 panel and the drawer are **one layer** (`isSideDrawerOpen()` counts both ➜ PTR · Back · Escape · backdrop). ⛔ Messages: `public/announcements.json` fetched **network-only** (not in the SW shell · APK via `VITE_NATIVE_WEB_ORIGIN` + CORS) ➜ **every ZoeW version bump needs a newest `update` entry = `APP_VERSION`** · pure `maintenance` messages **don't bump** (`version-bump-scope` ignores them). ⛔ Logos in the app (navbar · boot splash · guide) = the app icon derived from `resources/icon.svg` / ZoeKeyGen `manifest.json` | `ZoeW/tests/notifications.test.tsx` · `ZoeW/tests/app-icon-logo.test.tsx` · `version-bump-scope` |
| **Toolchain ↔ what ships (ZoeW)** | ⛔ CSS/layout checkers measure **source** CSS and Chromium parses new syntax ➜ a Vite/minifier upgrade can change **output** unmeasured. ⛔ The CSS minifier is **esbuild** (`cssMinify`): Lightning CSS (Vite default) rewrites design tokens and reorders declarations in CSS that covers PTR/panel motion · built JS must parse in `build.target` (old iPhones) · ⛔ chunks split by `codeSplitting` + `priority` (Rolldown captures group dependencies ➜ the `__vitePreload` helper falls into the native chunk ➜ web loads it ➜ **offline boot fails**). ⛔ Android config (SDK · AndroidX · AGP · Gradle) stays on the template line of the **installed Capacitor** — beyond it = a Capacitor major upgrade (`ZoeW/docs/ANDROID.md`) because Android builds can't be measured here | `npm run smoke` · `npm run android:check` · `npm run native:check` (ZoeW) |
| **New Firebase project (seller tool)** | ⛔ **One project per customer** (free Spark · own quotas — a single project/Supabase was rejected on cost: `docs/HISTORY.md` part 2) · ⛔ rules allow every `auth != null` ➜ **sign-up must be disabled, and measured** by a real sign-up via the public apiKey (succeeds ➜ delete the probe account + FAIL) · Authentication settings read back (server accepting PATCH ≠ applied) · rules = repo file read back and compared · ⛔ never adopt an existing project silently (`--adopt`) · never change an existing account's password (`--reset`) · `pendingProject` recorded **before** creation ➜ "slow but succeeded" and 409 on our own project never create a second project · step ceilings · passwords **never in files** · email ↔ real `siteCodeFromEmail()` · Setup Link ↔ real `decodeSetupPayload()` · `firebase-tools` pinned exactly (internal functions used). ⛔ Measured with **real** `firebase-tools` over **HTTPS** (over http it sends `Bearer owner` ➜ the token path never runs) | `firebase-provision-test` |
| **Netlify config ↔ 2 sites** | ⛔ **No root `netlify.toml`** — it is read for both sites ➜ redirects the other app's build | `netlify-config-scope-test` |
| **Netlify config ↔ app needs** | ⛔ CSP · `functions` · headers match what the app **really ships** | `netlify-config-scope-test` |
| **Document scope** | ⛔ README and `ZTO-SETUP-KH.md` describe **usage only** (rule 9) · history goes only to `docs/HISTORY.md` / `docs/HISTORY-ARCHIVE.md`. ⛔ **Freshness**: the header table of [`docs/AUDIT-PROMPT.md`](docs/AUDIT-PROMPT.md) names each app **with its own shipped version** (word boundary: `ZoeKeyGen` contains `ZoeW`) · **current** version claims (root README · each README · this file's header table incl. `CACHE_VERSION`) derived from real code · *historical* references untouched. ⛔ **Hard-coded lists in checkers = expiry dates** ➜ derive or compare with reality: required words in `guide.html` from real switches · README list from real dirs (`listReadmeFiles()`) · UI surfaces · 🩺 row count · `collectedValueOf()` screen count · 📝 count extracted from the real table · "alive" helpers measured by **definition** · every `.js` in `audit-tools/` named in `audit-tools/README.md` · `money-reality-check.js` measurement count equals real `── N.` sections in **every file** that claims it. ⛔ **Reverse: removed surfaces must not live in docs**: `localStorage` keys this file references must exist in shipped code · conditional gates (no branch field in the app ➜ no doc tells users to fill one · negations "**គ្មាន**…" pass). ⛔ New surfaces appear in the **in-app guide** (`guide.html`), not only README (real `licenseFailureMessage()` messages · gate on `LICENSE_SEAT_SLOTS`). ⛔ `emu/*` catalog: every `run "emu/…"` in `run-all.sh` is named in the **degradation paragraph** of the Runbook | `doc-scope-test` · `user-guide-test` |
| **Netlify Base directory** | ⛔ **Case-sensitive**: `ZoeW` · `ZoeKeyGen` (lives in the UI) | 📝 |
| **`zto-import` · Apps Script** | Repo edits don't change the deployed script ➜ `SCRIPT_VERSION` rises on **every response** from **one** exit point | `google-sheets-cache-test` · `health-check-test` |

### Extra rules carried by specific checkers (not repeated above)

| Rule | Tool |
|---|---|
| Run first: helper drift between the two apps | `shared-fns.js` |
| Run first: fake-green checkers (empty dir · wrong tree · masked assertions) · hangs · exit codes | `checker-coverage.js` · `hang-guard.js` · `exit-code-integrity.js` |
| Rules in `@media` killed by a later base rule · a class variant (`X-<base>` / `<base>-X`) placed **before** its base on elements wearing both ➜ equal specificity ➜ order wins ➜ silent death | `css-media-override.js` |
| Callbacks of an old glide released by watchdog/cleanup must not release the snap pause of a newer glide | `panel-snap-ownership-test.js` (`PANELSNAP_APP_DIR`) |
| A record that is not an object (string/number/bool under `$itemId`) ➜ `onValue` throws ➜ history/trash "unmeasurable" on every device ➜ `rawSnapshotToItemList()` skips + Sentry `zone: 'data'` | `field-shape-test.js` |
| Idle frames: an `infinite` animation while idle ➜ LTPO screens can't drop Hz; count **DrawFrame and BeginMainThreadFrame** (DrawFrame alone is blind to color animation) · per-mutation reverse probes · ZoeKeyGen login + workspace 0 idle frames | `perf-check.js` |
| Ledger deducts money but forgets parcel count (or the reverse) ➜ "scan by day" and money disagree permanently — `db-stall-guard-test` stubs `addRevenueToDailyAndMonthlyRecord`, so it can't see this | `ledger-count-integrity-test.js` |
| ⛔ A `sessionExpiryCheck === 'pending'` gate nobody settles is a permanent trap (`runSessionExpiryCheck()` has one caller, a 60s `setInterval`) ➜ every path that makes the app **usable** arms it via `armSessionExpiryCheck()` (single choke point) | `periodic-network-guard-test.js` |
| SW must pass the abort signal on: on `navigate` the target is a **string** (`'./index.html'`, no `.signal`) ➜ the only path is `networkOptions` ➜ measure the real `fetch` handler, not just `timedFetch()` | `sw-abort-propagation-test.js` |
| ZoeKeyGen biometrics: **WebAuthn PRF only** (no PRF ➜ PIN not kept) · credential is a **discoverable passkey** (`residentKey: 'required'` — Android/Google Password Manager give PRF only on passkeys) · PRF from `create()` used directly · `prf: {}` without `enabled` ➜ ask `get()` · cancelled scan ≠ "unsupported" · decrypted PIN verified against the hash · PIN change ➜ unbind. Extend/Revoke/device count/release **hang** ➜ "⏳ not confirmed" + ✅ on late commit via `armAdminLateWrite()` · real rejection ➜ "failed" · Signing Key expires from memory after idle (`SIGNING_KEY_IDLE_MS` via `elapsedSince`) | `keygen-pin-flow-test.js` · `keygen-session-security-test.js` · `keygen-biometric-test.js` |
| Money in the system *today* is wrong while all checkers are green ➜ checkers measure **code**, this measures **real data** — ⚠️ needs a dump ➜ **not in `run-all.sh`** | `money-reality-check.js` (read-only) · `money-reality-test.js` (fixture) |
| Duplicate declarations JS hoists/overwrites silently · dead functions | `function-surface-test.js` |
| Behavior differs from original ZoeW: DOM · layout (3 screens) · 18 interaction steps · money/logout/ZTO/Sheet/PDF paths 79 steps ⛔ intentional differences ➜ `INTENTIONAL_UI` only | `zoew-suite-test.js --parity` |

For everything else each checker measures, see [`audit-tools/README.md`](audit-tools/README.md) section 6.
⛔ **Don't build duplicate checkers** — duplicates cost CI time and make the next round believe coverage is larger
than it is. Some tools have allowlists (`ACCEPTED` / `EXPECTED_DIVERGENT` / `IGNORE`) where **every entry has a written
reason** — never add an entry without real tracing.

---

# 💰 Core business rule — "Delete" vs "Remove"

> ⛔ **READ BEFORE TOUCHING REVENUE CODE.** Intentional business policy, not a bug, and easy to misjudge.

- **Delete (លុប)** = delete the whole parcel. **Never touches** `zoew_daily_revenue_cod_dod` /
  `zoew_monthly_revenue_cod_dod` in any direction — not on delete, restore, or repeated rounds. **Idempotent by design.**
- **Remove (ដក)** = remove one barcode (or the 7-day automatic cleanup). It **deducts** that barcode's cod/dod at once,
  **adds it back** on restore from trash, and deducts again if removed again. Tracked by `isDeducted`.

**If revenue looks odd, first decide which of the two paths it is** (check `isFromDeletion` and whether the trash item
has 1 barcode or the full original set) before proposing a fix.

## ⛔⛔ "Revenue" = value of parcels **picked up**, not the sum of all parcels

> Owner correction (2026-09-05): uncollected parcels = "expired" after 7 days ➜ removed automatically and returned to
> the central branch, so their data must not stay in our system.

`zoew_daily_revenue_cod_dod` **is not money received**:

```
ledger = (picked up) + (waiting, < 7 days) + (deleted by hand)
```

Uncollected ➜ `claimAndCleanupItem('abandon')` ➜ `isDeducted: true` ➜ **money deducted** ➜ purge in **2 days**
(`EXPIRED_TRASH_RETENTION_MS`). So the ledger is **temporarily inflated** until parcels resolve ➜ showing the raw
ledger as "revenue" **lies during the first 7 days**.

- ⛔ **Both stats screens show "ចំណូល (យករួច)"**, not the raw ledger: monthly report · daily stats. They show **total
  parcel value** as a separate row too (transparency). ⛔ The "3-month stats" screen was removed (2.34.0, user
  request) ➜ guards that used it now compare the **sum of real day cards** with the **monthly report total** — ⛔
  dropping that assertion would reopen the "summation level" class.
- **One formula**: `collectedValueOf(ledgerCod, ledgerDod, uncollected)` where `uncollectedValueByDate()` counts only
  barcodes **`!isDeducted`** (money still in the ledger) **and `!isClosed`** (not picked up) across `scanHistory`
  **and** `deletedItems`. Same golden rule: `isDeducted` is the single field.
- ⛔ **Clamp per currency** (COD separate from DOD) — never sum before clamping.
- ⛔ **Needs a complete view of *both sides*** of the subtraction: `collected = ledger − open` ➜
  `collectedValueIsMeasurable()` covers **all 3** listeners `DB_LISTENER_KEY_HISTORY` · `DB_LISTENER_KEY_DELETED`
  (`open` side) **and `DB_LISTENER_KEY_DAILY_REVENUE`** (`ledger` side). Incomplete ➜ show **`—`**, not a number.
  Symmetric reason: empty history ➜ revenue = ledger (too high) · stale ledger ➜ `max(0, stale ledger − fresh open)` =
  `$0.00` (too low).
- ⚠️ **One accepted boundary**: "Delete" (row 5) **doesn't deduct** ➜ within the first 30 days the item sits in trash
  with `!isDeducted` ➜ **subtracted correctly**; after purge it is invisible ➜ revenue slightly inflated. ⛔ Don't
  "fix" it by making Delete deduct — that changes business policy.

## 📋 Full scenario table — single source of truth

> User asked to record this (2026-08-26). **Code must match this table.**

| # | Action | Function | `trashReason` | `isFromDeletion` | `isDeducted` | **Money** | `closedAt` stamp |
|---|---|---|---|---|---|---|---|
| 1 | **Close "picked up"** 1 barcode | `toggleIndividualBarcodeClose` | — | — | — | **untouched** | stamped on that barcode |
| 2 | **Close** whole parcel | `toggleCloseStatus` | — | — | — | **untouched** | stamped on every barcode |
| 3 | **Reopen** (both paths) | same | — | — | — | **untouched** | **stamp removed** |
| 4 | **Remove** 1 barcode | `removeSingleBarcode` | `remove` | `false` | **`true`** | **deducted** | kept per barcode |
| 5 | **Delete** parcel | `deleteSingleItem` | `delete` | `true` | untouched | **untouched** | kept |
| 6 | **Delete all** | `buildClearHistoryTrashItem` | `delete` | `true` | untouched | **untouched** | kept |
| 7 | **2-hour cleanup** (closed barcodes) | `claimAndCleanupItem('close')` | `pickup` | `true` | untouched | **untouched** | is the decider |
| 8 | **7-day cleanup** (not picked up) | `claimAndCleanupItem('abandon')` | `expired` | `false` | **`true`** | **deducted** | — |
| 9 | **Restore** from trash | `executeRestoreItem` | removed | removed | **reset** | **added back** if deducted | **reset to "now"** |
| 10 | **✖️ Permanent delete** | `executePermanentDelete` | — | — | — | **untouched** | — |

**Golden rule: `isDeducted` is the *only* field that decides money.** `trashReason` is a **display label** only.
**Rows 4 and 8 deduct; row 9 adds back only what was deducted.**

## ⛔ Automatic cleanup — constants that must not change without a request

| Rule | Measures | Result | Money |
|---|---|---|---|
| **2 hours** (`TWO_HOURS_MS`) | `barcode.closedAt` **of each barcode** | ➜ trash `pickup` | untouched |
| **over 7×24 hours** (`ABANDON_AGE_MS`) | `item.createdAt`; restored-open barcodes use the later of parent and `barcode.restoredAt`, then split by `barcode.isClosed` | ➜ trash `expired` | **deducted** |
| **2 days** | `expired` items in trash | ➜ permanent purge | — |
| **30 days** (`TRASH_RETENTION_MS`) | other trash items | ➜ permanent purge | — |

⛔ **Duration = 7 days but *ordinal day* = day 8** because the comparison is `now - createdAt > ABANDON_AGE_MS`
(**`>` not `>=`**) — at exactly 7×24h the parcel **stays**; at `+60s` it goes to trash. So the label "ផុតកំណត់ ៨ថ្ងៃ" is
**correct** — don't "fix" it to 7. `trash-modal-test.js` reads `ABANDON_AGE_MS` from `app.js`, derives
`ABANDON_LABEL_DAY = ABANDON_DAYS + 1`, matches `index.html` text and the "rows more" message, and **asserts the
comparison is still `>`**. Scans for stale day numbers cover **both forms** ("៨ ថ្ងៃ" and "៨ថ្ងៃ").

**Restored-open barcodes carry an optional `barcode.restoredAt`**: never change the parent's or siblings' clock.
Barcodes without it follow the parent's age. Selection and transaction use one age helper; after a partial removal,
`isClosed` is computed from the barcodes really remaining.

**Per-barcode split on mixed parcels** (A closed · B open):

| Rule | Leaves | Stays | Money |
|---|---|---|---|
| 2 hours | **A only** as `pickup` | B and its 7-day clock | untouched |
| 7 days | **B only** as `expired` | A (closed) ➜ waits for the 2-hour rule | deduct B only |

⛔ **Every close/open goes through `applyBarcodeCloseState(barcode, closed, at)`** — never `b.isClosed = x` directly.
`barcodeCloseIsRipe()` is the single decider; `normalizeBarcodeCloseStamps()` covers old data by **stamping** (not
deleting at once). `executeRestoreItem()` must **reset `closedAt`** to `getServerNow()`, otherwise restored items jump
back into trash.

## Trash and `trashReason`

| Path | `trashReason` | UI label | Revenue stats |
|---|---|---|---|
| `deleteSingleItem` · `buildClearHistoryTrashItem` | `'delete'` | លុប | **untouched** |
| `claimAndCleanupItem('close')` | `'pickup'` | យករួច | **untouched** |
| `claimAndCleanupItem('abandon')` | `'expired'` | ផុតកំណត់ | **deducted** |
| `removeSingleBarcode` | `'remove'` | ដក | **deducted** |

- `trashReasonOf()` falls back for old items: `isFromDeletion === true` ➜ `isClosed ? 'pickup' : 'delete'`; else
  `'remove'`.
- ⛔ **`executeRestoreItem()` must `delete itemToRestore.trashReason`** before writing back to
  `zoew_scan_history_cod_dod` — that node has `$other: { ".validate": false }` ➜ forgetting it **rejects the restore**.
- **Merging in the table is display-only** — group key `[trashReason, phone, scanDate, time].join('~')`; 🔄/✖️ **still
  act on one `id`**. ⛔ Don't switch to bulk restore/purge without a request — restore has claim tokens and rules
  fences written for single items.
- **Totals split in 2 groups** by `TRASH_REASON_META[reason].deducted`: `remove`+`expired` vs `pickup`+`delete`. The
  search filter filters **both table and totals**.

## ⛔ Markers that must not be confused (confusion ➜ `permission_denied` forever)

| Marker | Belongs to | Strip before writing to |
|---|---|---|
| `restoreClaimId` · `restoreClaimToken` | `zoew_scan_history_cod_dod` | **trash** (`stripHistoryOnlyMarkers`) |
| `clearClaim` | `zoew_scan_history_cod_dod` | **trash** |
| `restoreClaim` | `zoew_recently_deleted_cod_dod` | **history** (`executeRestoreItem`) |
| `trashReason` · `deletedAt` · `isFromDeletion` | `zoew_recently_deleted_cod_dod` | **history** (`executeRestoreItem`) |

- **Cleanup, delete, remove and price edits skip items being restored** (`itemHasRestoreMarkers()` gates the
  transaction).
- **Dead claims are released** — `clearStaleRestoreMarkers()` reads the source before releasing a history marker when
  the source is gone or has no live claim. `releaseStaleRestoreClaimForPurge()` releases a trash claim inside a
  transaction only when it isn't live; lease = `RESTORE_CLAIM_LEASE_MS` (2 minutes). A live claim = another device is
  restoring ➜ **don't touch**. A local view or a single `fb.get()` is not atomic evidence: history `.write` blocks
  deleting/changing markers whose source has a matching live claim by server `now`. Finalize needs a matching witness
  and deletes the source in the same atomic write (`emu/restore-mutation-emu-test.js`).
- **Group purge is atomic** — one bad item locks all clean ones ➜ a failed group **falls back to one-by-one**.

## ⛔ Pickup stats — barcode set as the single basis (2.27.0)

**Source of truth is a *set*, not a counter**:

```
zoew_daily_pickup_cod_dod/<day>/pickedUpBarcodes/<barcodeKey> = <phoneKey>
packagesPickedUp = number of keys        ← derived mirror
pickedUpPhones   = count per value        ← derived mirror
```

- **Customers = distinct phones with ≥ 1 closed barcode. Parcels = closed barcodes.** `sum(pickedUpPhones) ===
  packagesPickedUp` is **true by structure**.
- ⛔ **No arithmetic on `packagesPickedUp` or `pickedUpPhones[...]` anywhere** — closing = write a key · reopening =
  delete a key. **Idempotent** ➜ overlap · offline queueing · retries **can't create parcels** (this class returned 3
  times in the delta model: 2.26.0 · 2.26.1 · 2.26.2).
- ⛔ **Barcode key = `barcodeRegistryKey(code)`**, same as `zoew_barcode_registry`.
- ⛔ **The server verdict beats the local view** — `reapplyPickupMarks()` writes the verdict *and removes* local marks
  the verdict doesn't include.
- ⛔ **A failed write never rolls memory back to the old view** — show a toast and let the **next snapshot heal**.
- **Changing a phone number = changing the *owner* of every closed barcode key**, not ±1. Scan merges change
  **nothing**.
- **Old data (no set)**: `pickupSetFromRecord(record, seed)` seeds from a recount of history+trash **only when it equals
  `packagesPickedUp`**; otherwise placeholder keys `_lg_<phone>_<n>` that **keep the number exactly**. ⛔ That equality
  gate is what keeps **Reset from resurrecting**.
- **Reset pickup stats** writes **`{ packagesPickedUp: 0 }`** (the set goes too) — ⛔ **never delete the node**
  (`return null`): display falls back to counting history ➜ the number **jumps back at once**.
  `getFilterTargetDateKey()` is the single day basis for display and Reset. ⛔ Money untouched.

## ⛔⛔ Ledger: "apply ➜ revert" must be a **true** inverse

> 🔴 Real money bug (2.26.0) — `run-all.sh` **green 130 · SKIP 0** on the tree that had it.

Clamping at 0 breaks the inverse when the ledger is smaller than the delta: apply swallows **the excess**, revert adds
back **the full amount** ➜ **revenue from thin air**.

- **`ledgerAppliedDelta(before, after)` is the single revert basis** — revert **the actually applied delta**
  (`after - before`), not the requested one.
- ⛔ **Verdict `null` = "server did not apply", not "unknown"** — `ledgerServerVerdict(serverPromise)`: rejection or
  `committed: false` ➜ `{cod:0,dod:0,count:0}` ➜ **nothing to revert**. ⛔ Falling back to the memory delta deducts
  numbers never added (measured: a blip during apply ➜ revert succeeds ➜ day goes **$10.00 ➜ $14.00**). ⛔ The
  **in-memory** revert is idempotent (`ledgerMemoryCompensationClaimed`) — **both orders**.
- ⛔ **Server-side revert waits for the *server verdict*** — `commitDailyRevenueDelta` and `commitMonthlyRevenueDelta`
  capture `serverBefore`/`serverAfter` **inside the transaction** and return `ledgerAppliedDelta(...)`.
- **Every write to a stats node clamps before returning** — day · month · pickup (real rules reject negatives).
  ⛔ `ZoeErrors.capture('… clamped to 0')` **is not a clamp**.
- **`pickedUpPhones/$phoneKey` requires `> 0`** ➜ a key reaching 0 is **deleted**, not written as `0`.
- 🔴 **2.27.0: pickup stats left the delta model entirely** ➜ rules live in the pickup section above. ⛔ **Never bring
  delta arithmetic back to pickup stats.** Old functions of that path (`addPickupToDailyRecord` ·
  `commitDailyPickupDelta` · `applyPickupMemoryDelta` · `pickupAppliedDelta` · `revertPickupOnServer` ·
  `revertPickupLedgerDelta` · `correctPickupServerToActual` · `correctPickupLedgerToActual` · `closedBarcodeCount`)
  **no longer exist** — seeing those names anywhere means a history record, not a rule. Full story:
  `docs/HISTORY-ARCHIVE.md` part 2.
- ⛔ **Keep the reverse**: a normal deduction (`50 - 12.5`) writes exactly `37.5`, no early clamp.

Tools: `ledger-clamp-symmetry-test` (browser) · **`ledger-failed-apply-revert-test`** · **`emu/ledger-revert-emu-test`**
(real RTDB + real rules via ETag/`if-match` — ground truth) · `money-guardian-test` (10 mutations ➜ guards must go
truly red) · `price-edit-abort-test` · `revenue-rules-clamp-test` · `revenue-fuzz-test`.

## ⛔ Duplicate barcode ➜ duplicated money

Five layers, but **4 of 5 read this phone's in-memory copy**: debounce 2.5s · `isBarcodeAlreadyUsed()` (2 layers) ·
**`claimBarcodeInRegistry()` (server — the only one)** · `addOrUpdateEntry()` merge (**covers only the merge path**).

⛔ **Saving requires a real `'claimed'` verdict from the server.** Same rule as `license-verify.js` ("unverified ➜ keep
but grant nothing new") applied to the **money path**: "can't verify" ≠ "no duplicate". ⛔ It doesn't break offline
scanning — offline RTDB **hangs, not rejects** ➜ `withTimeout` throws ➜ the save was refused anyway.

## ⛔ Orphan keys in `zoew_barcode_registry` ➜ barcode trapped

An **ownerless** key is a permanent trap: the user sees "⚠️ ត្រូវបានបញ្ចូលរួចហើយ" while the parcel is **in neither
history nor trash**.

- Release goes through `dbOp()` + `retryAsync()` then **into `pendingRegistryReleases`**.
- The queue reruns **when `.info/connected` returns `true`** **and** has a **second exit**: `noteDbListenerAlive()`
  (view arrived again) plus a safety net in `runScheduledCleanup()`. ⛔ A queue that can *defer* with no second
  releaser = **permanent trap**. Callbacks apply and normalize the snapshot **before** `noteDbListenerAlive()`;
  announcing freshness first lets the release queue delete the registry key of a barcode that just came back.
- **`registryReleaseVerdict(key)` has 3 outcomes**: `release` · `owned` (barcode came back ➜ don't release) · `defer`
  (`dbListenerViewIsStale()`). ⛔ **The *immediate* release path must not have that gate.**
- ⛔ **Automatically repairing keys that "look orphaned" is rejected** — **a trap is cheaper than duplicate money**.
  Already-visible keys are deleted by hand in Console. Many of them: `node audit-tools/registry-orphan-list.js
  <dump.json>` emits `{"KEY":null,…}` ➜ a human **reviews it** and sends `curl -X PATCH` themselves (⛔ `PATCH`
  merges · ⛔ **never "Import JSON" in Console** — that is a **REPLACE** ➜ wipes the whole registry). ⛔ The tool
  **deletes nothing** by design: the final decision belongs to a human.

---

# 🏗️ Architecture

- **ZoeW React is ES modules in `ZoeW/src/**`** (layers: [`ZoeW/docs/ARCHITECTURE.md`](ZoeW/docs/ARCHITECTURE.md)).
  ⛔ **Functions are not globals** — only the **audit build** (`VITE_EXPOSE_GLOBALS=1` ➜ `src/expose-globals.ts`)
  exposes them on `window` for checkers; replacing `window.<fn>` in tests works via plugin `zoew-audit-rebind`
  (`vite.config.mts`) ➜ ⛔ **production builds never have these bridges** (`version-bump-scope` doesn't count audit-only
  files as shipped code). ⛔ State lives in stores (`src/core/state.ts`), not module-level `let` ➜ tests read it as
  `window.<field>` in the audit build.
- **`zoew_scan_history_cod_dod` is the *single* primary data source.** The app reads it directly via
  `onValue(dbRefHistory)` ➜ `scanHistory`. **No second projection layer.**
- **Every parcel edit runs `runTransaction` on the *server* record**, not the in-memory copy.

## UI structure (ZoeW)

> ⛔ This table is derived from real `index.html` and `app.js` ➜ `doc-scope-test` part 6 fails when a new surface
> appears in code but not here (labels below are the real Khmer UI text — keep them verbatim).

| Part | id | Content |
|---|---|---|
| Page 1 — data | `pageData` | daily management, number search, history table, 2 stats buttons (📅 កញ្ចប់ប្រចាំថ្ងៃ · 💵 ចំណូលប្រចាំថ្ងៃ) |
| Page 2 — scan | `pageEntry` | 3 scan modes (parcel, Locker, remove), camera, hardware scanner, image, `parcelPanel`, `lockerPanel` |
| Bottom tab bar | `pageTabBar` | page switching (`switchAppPage`) |
| Drawer (menu) | `sideDrawer` | **4 collapsible categories** (`.drawer-group`, collapsed by default, state in `zoew_drawer_groups_v1`): **ការតភ្ជាប់ និងទិន្នន័យ** (Config / Reconfig · API ស្វែងរកអតិថិជន · តារាងអតិថិជន · នាំចូល Excel ទៅ Sheet) · **ZTO** (បិទតាម ZTO ស្វ័យប្រវត្តិ · ទាញបញ្ជីកញ្ចប់ពី ZTO — ⛔ these 2 and **the category header itself** appear only when Fast Mode is ticked) · **ចាក់សោ និងសុវត្ថិភាព** (ចាក់សោពេលបើក App · ចូលដោយក្រយៅដៃ ឬមុខ) · **ឧបករណ៍** (កំណត់ទូ Locker · ពិនិត្យសុខភាពប្រព័ន្ធ). ⛔ **ចូល/ចាកចេញ sits in `.drawer-foot`** with the version number, not in `.drawer-body` |
| Top (...) button | `globalMoreMenu` | Export Data · របាយការណ៍អាជីវកម្មប្រចាំខែ · កែទឹកប្រាក់/កញ្ចប់ (PIN) · អត្រាប្រាក់ · ធុងសំរាម · Reset ចំនួនយករួច (PIN) · លុបទាំងអស់ (PIN) |
| Per-row (...) button | `globalMoreMenu` | កែតម្លៃកញ្ចប់ · កែលេខទូរស័ព្ទ · លុប |
| Notification panel (🔔 navbar right) | `notifyDrawer` | opens from the right: 📦 near-expiry parcels (24h) · 📱 កំណែ App · 📲 phone notifications (Push on/off) · 📢 announcements/maintenance (`public/announcements.json` + seller notices via ZoeKeyGen · 🧹 សម្អាត) · ⛔ **"Powered By ZoeW" sits in this panel's footer**, not the navbar |

Top and per-row (...) menus close when an outside panel drag or history scroll starts; taps/scrolls inside the menu
still work. A transform-driven panel drag doesn't guarantee a `scroll` event. The open motion scoped to
`#globalMoreMenu` honors Reduce Motion and never delays closing on outside drags (`history-menu-dismiss-test.js`).

**🩺 ពិនិត្យសុខភាពប្រព័ន្ធ** (drawer): **9** rows, read-only — network · Firebase · clock · License · storage · Service
Worker · customer table · Apps Script version · Lookup. ⛔ The count is derived from `runHealthCheck()`
(`doc-scope-test` part 6). ⛔ **"Can't check" is ⚠️, not ❌**, and **"not measured" is never ✅** — the ZTO Lookup row
has **3 outcomes** from the last upstream verdict in `?diag=1`: rejected ➜ **❌** · accepted ➜ **✅** · never used ➜
**⚠️**. ⛔ **Never forces PIN** (locked ➜ say why). ⛔ **Secret header values never reach the DOM** — only the 8-char
fingerprint from `?diag=1`. ⛔ **The Apps Script path makes no network call** (simple-request rule — see ZTO Lookup).

**`entryScanMode`** (`'parcel'` / `'locker'` / `'remove'`) is the **single** branch point — every scan source
(camera, hardware, image) goes through `triggerScanAction()`. `'remove'` is not persisted; reload returns to
`'parcel'` so the next scan can't remove by accident.

**`history-expanded` follows the active page.** `syncHistoryExpandedLock()` puts that class on `#appPages` only when
the **active page's** `.page-side` has `.collapsed` (`activePanelSections()` reads the DOM, not `currentAppPage`).
⛔ If the lock sticks across pages, one page **can't scroll at all** (`overflow-y: hidden` on `#appPages`).
Test: `page-nav-test.js`.

**Layout**: each page has `.page-side` and `.page-main`. Phone = flex column; **≥992px** = 2-column grid (`380px` +
rest) and the tab bar moves under the navbar via `order`. **A closed drawer has `visibility: hidden`.**

## Swipe gestures (<992px) — `setupSwipeGestures()` ➜ `bindPanelSwipe()` ×2

**Both pages behave the same — never fix only one:**

| Page | `.page-side` | `.page-main` | Drag handle | Scroll container |
|---|---|---|---|---|
| data | `#dataSideSection` | `#dataMainSection` | `#dragHandle` | `#tableResponsive` |
| scan | `#entrySideSection` | `#entryMainSection` | `#entryDragHandle` | `#entryTableResponsive` or `#lockerTableResponsive` |

Page 2 has **two** scroll containers — `entryScrollerInView()` picks by the visible panel. List cards need class
**`.panel-section`**, otherwise the inner `.table-responsive` **doesn't flex**.

- **Toggling `.collapsed`/`.search-focus` and the `history-expanded` lock happens at `touchend`, not mid-drag.** iOS
  keeps the scroll owner until the finger lifts ➜ class changes mid-gesture **cut scrolling**. `touchcancel` drops the
  whole intent.
- ⛔ **No `transition` on `.collapsed`/`.search-focus`** — `max-height` **can't animate** from `none` ➜ only a useless
  0.3s repaint while scrolling. Collapsed panels have `visibility: hidden`.
- **Swiping up never closes the panel while the user is searching** (`phoneSearchIsActive()`).
- **iOS nested-scroll handoff**: `usesIOSPanelHandoff()` gated by `navigator.standalone === true` plus
  `CSS.supports('-webkit-touch-callout','none')`. Android stays passive. On iOS the table's `touchmove` is non-passive
  and calls `preventDefault()` only when the panel is `.collapsed` · clearly downward · past 8px slop ·
  `scrollTop <= 1`. The intent **latches** until the last `touchend` — never overwrite it by re-reading `scrollTop`
  (WebKit sends 0.5px or a stale 2px).

### ⛔ Finger-following motion (2.9.0) — the 5-point table, all required

Core condition: **the list card (`.page-main`) has exactly the same height in normal and full-screen modes** ➜ it moves
down in place ➜ no jump. Missing any point = the jump returns:

| # | What | Where |
|---|---|---|
| 1 | `.page-main` has `height: calc(100dvh - --chrome-top - --chrome-bottom - 16px)` + `flex: none` | `src/styles/app.css` in `@media (max-width: 991px)` |
| 2 | Inner flex chain: `.history-section`/`.panel-section`/`#parcelPanel`/`#lockerPanel` are `flex: 1; min-height: 0` and `.table-responsive` is `max-height: none; flex: 1; min-height: 0` (**scoped to `.page-main`** ➜ modals keep 62vh) | same |
| 3 | `.app-pages` has `scroll-snap-type: y proximity` **plus** `scroll-padding-top` equal to `padding-top`; its 2 children have `scroll-snap-align: start` | same |
| 4 | `panelGlideFrom()` (FLIP via Web Animations) is called **unconditionally** in `applyPanelAction()` and the `#dragHandle` `click` handler — ⛔ **never re-add an iOS exception** | `src/app/behaviors/panel-motion.ts` |
| 5 | `panelGlideFrom()` **pauses snap** (`#appPages.panel-gliding` ➜ `scroll-snap-type: none`) during motion and **removes it via 2 paths** (`anim.finished.then(release, release)` **plus** `setTimeout(…, PANEL_GLIDE_MS + GRACE)`). After a watchdog or cleanup ends an old glide, that glide's callbacks **must not release the newer glide's pause** (`panel-snap-ownership-test.js`) | `src/app/behaviors/panel-motion.ts` + `src/styles/app.css` |

⛔ **Missing `scroll-padding-top` ➜ the "open" snap point lands at `scrollTop 71` ➜ PTR dies completely** (it needs
`scrollTop <= 1`). Same if `panel-gliding` sticks. `clearSensitiveModalFields()` calls `endPanelGlideSnapPause()`.
Reference numbers (412×780, seed 120): glide distance **361px**; card **642px in both modes**; table **538px in both
modes**. Verification: `panel-motion-test.js` — `cardHeightDelta`/`tableHeightDelta` fail ➜ point 1 or 2 missing;
`snapRestNearTop` fails ➜ point 3 (**PTR dies too**); `residualTransform` fails ➜ point 4.

**Auto pull up (`setPhoneSearchPulledUp()`)**: focusing the search box ➜ `#dataSideSection` gets `.search-focus`.
⛔ **The search card must stay the last child of `.page-side`** (CSS: `.page-side.search-focus > *:not(:last-child)`).

## ⛔ `--chrome-bottom` and safe-area — READ BEFORE TOUCHING LAYOUT

`--chrome-bottom` includes the bar height **and** the safe-area part that makes the iOS standalone body taller than
the viewport:

```js
tabbar.offsetHeight + Math.max(0, document.body.getBoundingClientRect().height - window.innerHeight)
```

⛔ **Never measure `tabbar.offsetHeight` alone** (misses the iPhone bottom inset), never use
`body.getBoundingClientRect().bottom` or a transformed tabbar rect (root scroll restoration and transform-hiding shrink
the numbers). Only `html.ios-standalone` extends the body by the bottom inset and locks the root. ⛔ **Never remove that
iOS rule** and **never re-add a generic `@media (display-mode: standalone)`** (it creates a root scroll range on
Android). **The audit environment is Chromium — `env(safe-area-*)` is always 0** ➜ tests **simulate** it
(`min-height: calc(100dvh + 34px)`) and call `measureAppChromeSize()` again. Changes here **must be tested on a deploy
preview and a real iPhone before merge**.

## Pull-to-refresh on iOS PWA — `setupIOSPullToRefresh()`

- `<head>` detects iOS standalone **before the stylesheet** (`boot-flags.js`) and sets `html.ios-standalone`, where
  `html/body` are `overflow-y:hidden` + `overscroll-behavior-y:none`; **`#appPages` is the single outer scroll owner**.
- PTR engages only when every scroll container is at the top (`scrollTop <= 1` incl. negative rubber-band), one touch,
  clearly downward. Modals/drawer/inputs/navbar/tabbar are not targets.
- ⛔ **3 owner-requested rules (app standard)**: (1) the finger must **start** in the **top 40%** of the screen
  (`PTR_START_ZONE_RATIO`) · (2) **any open layer** (modal · (...) menu · drawer · app lock) ➜ no PTR —
  `ptrBlockedByOverlay()` is the single decider and the state is **remembered at `pointerdown` on `window` (capture)**
  because a tap outside a menu closes it at `pointerdown` **before** `touchstart` ➜ the tap that closes a layer doesn't
  reload · (3) **one haptic tick** when crossing the "release to refresh" threshold (`hapticTick()`: Android ➜
  `@capacitor/haptics` · web ➜ `navigator.vibrate`) — ⛔ **iPhone has no vibration API for web pages** ➜ nothing on
  iOS PWA. Guard: `native-check` (3/3 mutations caught).
- ⛔ **While a panel has `.collapsed`/`.search-focus` or `history-expanded` ➜ PTR is fully off**: no indicator,
  `preventDefault`, or reload. Safari decides cancelability before `touchstart` ends ➜ the non-passive listener is
  armed ahead in the normal state and removed via `MutationObserver`; **never install it after touchstart**.
- ⛔ **≥992px** the tab bar sits under the navbar ➜ `.ptr-indicator` gets `top: calc(var(--chrome-top) +
  var(--tabbar-height) - 41px)` (`react-root.css`, that media only) ➜ at `ready` the gap to the top bar's bottom edge
  **equals the phone's ±2px** (`gesture-test`: 412 · 1280×800 · 1194×834 · 800×1280). ⛔ Phones <992px untouched.
- `iosTouchArbiter` uses `Touch.identifier`: 0–30px no action; ~56–212px spring back; ~213px+ refresh. A second finger
  cancels both. Panel swipes require vertical-axis ratio 1.6 like PTR.
- Before reload: marker `zoew_ptr_reload_pending` · `history.scrollRestoration='manual'` · clear offsets. ⛔ **Never
  replace with a bare `location.reload()`** — the history card slides under the navbar. A 5s watchdog releases the
  spinner if reload doesn't happen; `beforeunload` ➜ cancel the watchdog **without clearing markers**.

## Hiding bars by scroll direction — `setupChromeAutoHide()`

**Only the *bottom tab bar* hides. The top navbar never hides (user request)** — never re-add
`body.chrome-hidden .app-navbar`.

⛔ **During momentum, hiding/showing the bar must never change the height or padding of any scroll container**
(the list would jump). So:

- The tab bar is `position: fixed`, moved **only by `translate3d`**.
- **Android path**: `.table-responsive` has `padding-bottom: var(--tabbar-height)` and `.page-main` has
  `clip-path: inset(0 0 calc(var(--tabbar-height) - 8px) 0 …)`. ⛔ **Use `--tabbar-height`, not `--chrome-bottom`**
  (it includes safe-area *below* the viewport ➜ clips 53px too high on iPhone). ⛔ **The card's bottom frame must match
  iOS pixel for pixel** (owner request): `react-root.css` in `@supports (not (-webkit-touch-callout: none)) and
  selector(:has(*))` clips **`.app-card`** (not `.page-main`) at `--tabbar-height` ➜ the card stops **8px** above the bar
  and **paints** the table edge (`::before` + `--card-bg` shadows over hidden rows) and card edge (`::after` · catches
  taps ➜ never reaches hidden buttons). ⛔ All **paint**: scroll container height unchanged · `chrome-hidden` removes the
  clip + `visibility: hidden` (⛔ never change `position`/`content` by bar state — that is layout). ⛔ A card whose last
  child is `.empty-state`: `margin-bottom: var(--tabbar-height)` on the message · empty table has no padding · no
  `::before`. ⛔ The iOS simulation in checkers **also removes the `not (-webkit-touch-callout…)` block**
  (`dropAndroidOnlyCss`). Guard: `panel-motion-test` part 9 (Android/iOS screenshots · 5 scenarios × 3 viewports).
- **iOS path**: `@supports (-webkit-touch-callout: none)` — the card has a real height and **grows down to fill**.
  `clip-path` **doesn't work on Safari**. ⚠️ Chromium returns `false` for `-webkit-touch-callout` ➜ that block is
  **never tested by Chromium** — `panel-motion-test.js` extracts and injects it by hand.
- ⛔ **The 180ms delay and `chrome-space-released` were removed — never bring them back** (gap while the card falls).
- The scroll handler coalesces via `requestAnimationFrame`. `SHOW_AFTER` (48px) > `HIDE_AFTER` (36px) **on purpose**
  (iOS momentum emits small reverse motion ➜ a low threshold makes the bar flicker).

## Frame rate and lite mode

- **Web pages can't raise the refresh rate** — `measureDisplayHz()` takes the **median** of 24 rAF intervals, clamped
  `[10, 120]`.
- `longFrameThresholdMs()` = `frame budget × 1.6` (min 12ms) — ⛔ **never bring back a fixed number**.
- **`setupAdaptivePerformance()` measures frame drops twice** (1.5s and 10s) and sets `body.perf-lite` only when **both**
  drop — one measurement confuses boot business with a slow device. `perf-lite` **never touches business features**.

## Barcode scanner

- **Decoder is ZXing-WASM in the repo**: `vendor/zxing-wasm.js` + `vendor/zxing_reader.wasm` (both in `sw.js`
  `CORE_SHELL`), decoding via `ZXingWASM.readBarcodes(imageData, options)` on `ImageData` from a canvas. ⛔ CSP needs
  `'wasm-unsafe-eval'`.
- **Code 128 only — never add formats back.** `SCAN_FORMAT_NAMES = ['Code128']` (ZXing-WASM) and
  `NATIVE_SCAN_FORMAT_NAMES = ['code_128']` (`BarcodeDetector` on Android). ITF · CODABAR · CODE_39 **have no mandatory
  check digit** ➜ one label can be read as a **completely different number** "successfully".
- **`confirmLiveScan()` is the second layer** — the same number must read `SCAN_CONFIRM_REPEATS` (2) consecutive
  frames. **Both** live paths go through it; image and hardware paths **don't** by design (single frame).
- **Decode frame size bounds *reading range* on iPhone**: `LIVE_SCAN_WIDTH_STEPS = [640, 800, 1024, 1280]` starting at
  the **highest step**, then `noteLiveScanCost()` steps down/up by real cost. ⛔ **Never pin the width.** Height capped at
  `LIVE_SCAN_MAX_BAND_PX` (240px) on purpose (vertical bars ➜ **horizontal** quality matters).
- **Real decode cost decides the width**: `noteLiveScanCost()` keeps an EMA, steps down above `LIVE_SCAN_SLOW_MS`
  (22ms) and up below `LIVE_SCAN_FAST_MS` (9ms). Scan interval as fps (`LIVE_SCAN_MIN_FPS` 10 ➜ `LIVE_SCAN_MAX_FPS` 120).
- **`takeFreshVideoFrame()` is part of the protection** — decoding one frame twice makes `confirmLiveScan()` a 1-frame
  check.
- **QR scanning in Config is a separate reader** (`configQrReader`) — unrelated to `SCAN_FORMAT_NAMES`.

## Clock

Every timestamp taking part in retention/revenue decisions (`createdAt`, `closedAt`, `deletedAt`, `lockerUpdatedAt`,
and the "now" they're compared with) uses **`getServerNow()`**, not raw `Date.now()`. Purely cosmetic/local timers (PIN
lockout, salt id, scan debounce, script-load deadlines, cache TTL) **keep raw `Date.now()` on purpose** — don't "fix"
them.

- ⛔ **Searching only `Date.now()` misses real spots — also search argument-less `new Date()`.** `clock-hygiene.js`
  scans the **AST**, asserts 4 directions, and **its allowlist must have no dead entries**.
- **The business calendar is `Asia/Phnom_Penh`**, not the device zone: `appZoneParts()` is the single converter
  (`Intl` + fixed UTC+7 fallback — Cambodia has no DST); `getZoneDateKey(ms, dayOffset)` does day arithmetic **in the
  zone** (⛔ never `d.setDate(d.getDate() - 1)`); `getFormattedClockTime(ms)` is the source of `item.time`. ⛔ **Old
  data is never recomputed.** ⛔ **The stored format is `HH:MM:SS (YYYY-MM-DD)` — never change it**; sorting happens on
  **display** via `formatScanStamp(raw)`, which **fails open**.
- **`elapsedSince(mark)` is the single basis for every elapsed-time measurement** — `!mark` ➜ `Infinity`;
  `delta < 0` ➜ `Infinity` (**fail-open**). A **shared** byte-identical helper in both apps. ⛔ **Deadline comparisons
  are outside this rule** — `Date.now() < lockoutUntil` (PIN lockout) stays, because going backward makes the lockout
  **longer** = the safe direction.
- **Destructive cleanup needs the clock *from the server* and a *live* connection**:
  `cleanupClockIsTrustworthy()` = `serverClockTrusted && isDatabaseConnected`. ⛔ **Never drop
  `isDatabaseConnected`** ("connect ➜ WiFi off ➜ change date" put 2 parcels in trash, one `abandon` ➜ **money deducted**
  + full purge). ⛔ The gate sits in `runAutomaticCleanupRules()` and `runAutomaticDeletedCleanup()` **themselves**
  (`debouncedRenderAfterHistorySync` calls them directly). ⛔ **No "clock jump detection" via `performance.now()`** —
  iOS PWA suspension makes it lie.
- **`serverClockOffsetIsFromServer(offsetMs)` is the single gate**: `offsetMs !== 0 || isDatabaseConnected ||
  hasEverConnectedToDatabase`. ⛔ **Never simplify it to one check** (we never measured whether
  `.info/serverTimeOffset` or `.info/connected` arrives first). ⛔ **A non-number value `return`s at once** — never call
  with an old offset.

## ⛔ CSP and `data-act` — never bring `onclick=` back

**2.13.0 removed `'unsafe-inline'` from `script-src` in both apps.** ⛔ Every `on*=` attribute and inline `<script>` is
**silently refused in production** while tests without CSP all pass.

| What | How |
|---|---|
| no-arg call | `data-act="openSideDrawer"` |
| constant args | `data-act="filterDataByDate" data-args='["today"]'` (JSON) |
| data args | `data-a1="${sanitizeInput(item.id)}"` |
| event | `data-evt="1"` ➜ `event` prepended |
| the element itself | `data-self="1"` ➜ element first |
| events other than `click` | `data-on="change"` (or `input`/`submit`) |

1. **`ACTION_ALLOWLIST` is the boundary** — never switch to plain `window[name]`.
2. **New button ➜ add its name to the list** — `wiring.js` and `csp-enforced-test.js` assert **both directions**
   (least privilege).
3. **`event.currentTarget` is `document`** — functions needing the element take it via `data-self`.
4. ⛔ **Never add a second listener to an element that has `data-act`** — the action **runs twice** (worst on
   `executePermanentDelete`). ⛔ **The sneaky form: `el.onclick = …` set from JS** — invisible to `wiring.js` and
   `csp-enforced-test`. ⛔ Fix = **one gate**: a single `data-act` that decides by a state flag (`navAuthFlow()` in
   ZoeKeyGen). `page-nav-test` counts **real calls** after a click ➜ must be **1**; `action-binding-test` locks this
   **structurally across both apps**.
5. **`<head>` scripts live in `boot-flags.js`**, loaded as `<script src>` **before the stylesheet**, and it must be in
   the Service Worker core shell (list in `serviceWorkerPlugin` in `ZoeW/vite.config.mts` ➜ `__CORE_SHELL__`).
6. `style-src` **keeps `'unsafe-inline'`** — **don't remove it without a request and measurement** (React sets
   `style={{…}}` via CSSOM, but removal is unmeasured on all real browsers).
7. ⛔ **Never add a CDN to `script-src`** — the scan engine and SheetJS are **in the repo**; `sw.js` drops cross-origin
   requests ➜ CDN resources never enter the cache. CSP needs `'wasm-unsafe-eval'`.

## ⛔ Cross-origin resources in `<head>` — READ BEFORE TOUCHING index.html

Cross-origin resources **never enter the cache** ➜ if they block rendering, on a "connected but dead" network the user
sees a **white screen** while every app file is cached (measured: **20,251 ms** ➜ **249 ms**).

- **Cross-origin scripts must be `async`** (`js.sentry-cdn.com`) — `error-reporting.js` has a late-load path;
  `sentry-load-race-test.js` locks it.
- **Cross-origin stylesheets use `media="print"`** and `boot-flags.js` switches to `all` on `DOMContentLoaded`.
  ⛔ **Never `onload="this.media='all'"`** (CSP refuses silently). `<noscript>` is the fallback.

## Locked CSS invariants — ⛔ READ BEFORE EDITING `src/styles/*.css`

`ZoeW/src/styles/app.css` must equal vanilla ZoeW `style.css` **byte for byte** (`npm run parity`) ➜ it **has no
comments**, and React-only CSS goes to `react-root.css` · `native.css` ➜ reasons live here. Selectors below refer to
these 3 files.

| Selector | Rule | Why |
|---|---|---|
| `.status-dot::after` | animates `transform`/`opacity`, not `box-shadow` · ⛔ online blinks **3 times then stops** (`animation-iteration-count: 3` in `react-root.css`) · "connecting" stays `infinite` | `box-shadow` can't composite ➜ repaint every frame forever · any `infinite` animation while **idle** ➜ the compositor draws every vsync ➜ LTPO screens can't drop Hz · battery (`perf-check` "idle frames": real trace + reverse probe) |
| `.call-btn-recall` ("ខលម្តងទៀត") | ⛔ blinks **5.5 times** on appearance, then stays **`--action-danger`** (`react-root.css`: `background-color` + `animation-iteration-count: 5.5`) · ⛔ never restore `infinite` | infinite background color is a **main-thread** animation (paint every frame) even when the row is off-screen · reduced-motion sees steady red (`perf-check` "idle frames") |
| `.app-navbar` | no `backdrop-filter` · `transform` · `transition` | iOS recomputes blur every frame; the top bar **never hides** |
| `.modal` | plain dark backdrop, no `backdrop-filter` | modals open on every scan |
| `.scan-line` | animates `transform`, not `top` | `top` causes layout every frame while decoding |
| `.page-main` | fixed `height` + `flex: none` (`max-width: 991px`) | card height equal in both modes (5-point table) |
| `.table-responsive` | `max-height: none; flex: 1` **scoped to `.page-main`** | modals keep 62vh |
| `.mrep-table` | `width: max-content; min-width: 100%` ⛔ **not `width: 100%`** | `width:100%` + `nowrap` makes text **overflow onto each other** instead of horizontal scroll (`layout-check` injects test rows and measures per-cell overflow) |
| `.app-pages` | `scroll-snap-type: y proximity` + `scroll-padding-top` equal to `padding-top` — ⚠️ **these live in *two separate* `@media (max-width: 991px)` blocks** (`scroll-padding-top` in the first · `padding-top` ~300 lines later) ➜ **edit one, check the other**. ⛔ Never merge the blocks to "clean up" — it reorders the cascade in the forbidden zone | forget ➜ **PTR dies** (`panel-motion-test`: `snapRestNearTop`) |
| `#appPages.panel-gliding` | `scroll-snap-type: none` during motion | `.page-main` is a snap target ➜ WebKit snap fights the motion |
| `.app-pages.history-expanded` | ⛔ `display: block` + `> .app-page.active { height: 100% }` (`react-root.css` beats `app.css` `display: flex`) ⛔ **never switch `.app-pages` `display` by mode** | block ↔ flex on the biggest container rebuilds the whole layout tree on every drag (measured: 97.8% dirty · Layout 458–559ms on 260 rows ➜ 1ms after fix) · `panel-motion-test` part 8 measures the **dirty object ratio** from a real trace |
| `.table-responsive` | `padding-bottom: var(--tabbar-height)` | reserves bar space **inside the scroll container** ➜ only `scrollHeight` changes |
| `.page-main` | `clip-path` uses `--tabbar-height`, **not** `--chrome-bottom` | safe-area is *below* the viewport ➜ clips 53px too high on iPhone |
| `.app-card` in `.page-main` (Android · `react-root.css`) | `clip-path` at `--tabbar-height` + `::before`/`::after` paint table/card edges ⛔ paint only | iOS-like card bottom without changing scroll container height (`panel-motion-test` part 9) |
| `@supports (-webkit-touch-callout: none)` | separate iOS path | `clip-path` doesn't work on Safari |
| `.boot-splash` | always `pointer-events: none` | decoration never swallows taps |
| `.boot-splash-bar > span` | moves **inside the bar** (`width: 40%`, `translateX(0 → 150%)`) | `translateX(-100%)` on a full-width span ➜ `left = -38` at 320px |
| every `font-size` | `calc(N * var(--fs-unit))` — **no fixed `px`** (except `#pdfExportPrintArea`) | a fixed `px` stays small while surrounding text grows |
| `:focus-visible` | 2px `outline` ring on buttons/links/checkboxes/file/range | Tab users and hardware scanners need to know where they are |
| text inputs | `outline: none` needs a `:focus` replacement | clean `outline: none` = no focus signal at all |
| `.modal-content` · `.modal-btns button` | **46px** tall | finger tap targets |
| non-text controls | disable inherited `min-height`/`padding` from `.modal-content input` (`min-height: 0; padding: 0; flex: none`) | `min-height: 46px` stretched checkboxes to 16×46px **in every modal** |
| overrides of `.modal-content` **and its children** | must sit **after** the general rule (or raise specificity) | equal specificity ➜ **order decides** ➜ the rule dies silently — including a modal's own shell (`.zto-sync-modal-content` before `.modal-content` never applied). ⛔ `css-classes`/`css-media-override`/`css-var` **can't see it** ➜ guards compare `getComputedStyle()` with values **derived from real CSS** plus a probe that both rules give different values |
| `.btn-biometric` | **white background, red border** plus `margin-bottom` | a pink fill looks like an **error box** |
| `.bio-ico` · `.bio-label` | label wrapped in 2 spans | flex `gap` **has no effect** on a single text node |
| **ZoeKeyGen** `.app-container` | `display: grid` 2 columns at `≥900px` · `max-width: 1180px` | otherwise a 660px empty gap at 1440px |
| **ZoeKeyGen** `#appContainer` | shown/hidden by class `hidden` — **not** `style.display` | inline `display: flex` beats the media query's `display: grid` |

**Type scale has 3 steps**: phone `< 700px` (clamp to 1.1px) · tablet `700–991px` (floor 1.2px) · desktop `>= 992px`
(up to 1.35px). Only **2** declarations (`:root` and `@media (min-width: 700px)`) ➜ crossing 992px is **fully smooth**.
⛔ **`< 700px` and `>= 992px` never change.** ⛔ **ZoeKeyGen doesn't change** (`tabletStep: null` asserts the
reverse). ⛔ **`style.display` in JS overrides CSS layout** — show/hide via **class**; table column widths live in
**CSS**, not inline.

---

# 🌐 Network · Service Worker · License

## ⛔ Hang ≠ fail — 5 separate failure modes

This class returned again and again through different doors (2.22.4 · 2.23.1 · 2.25.6 · 2.25.8 · 2.42.6 · 2.45.4):

| Mode | What happens | What's needed |
|---|---|---|
| **reject** | promise rejects | `.catch()` |
| **absent** | **synchronous** `TypeError` | a presence check first — `.catch()` **can't catch it** |
| **hang** | neither answers nor rejects | a **time ceiling** that settles structurally |
| **slow success** | resolves **after** the ceiling | **post-commit work runs when it arrives** |
| **rejected but applied** | `runTransaction` rejects `disconnect` while the server **already committed** (lost ack) | **read the real server first** before reversing (`runTransactionResolved()`) |

- ⛔ **`disconnect` ≠ "not applied"** — the SDK rejects an already-sent transaction with `disconnect` when the
  connection drops before the ack (measured on the real SDK + emulator). ⛔ `fb.get()` is not evidence (an active
  listener answers from cache). `withTransactionOutcomeResolution()` wraps `fb` **once in `initFirebase()`** ➜ every
  `fb.runTransaction` (single choke point ⛔ not editing 40+ call sites) reads **REST with the ID token** and compares
  with the sent/pre-send value: `applied` ➜ **success** (`txOutcome: 'applied'`) · `not-applied` ➜ reject as before ·
  `unknown` ➜ reject + Sentry `zone: 'money'` (once per path). ⛔ A late-committing cleanup checks **another device
  hasn't already written the trash** (`cleanupClaimAccountedElsewhere()`) before writing/deducting.
- **`dbOp(promise, msg)` is the single path** for Firebase calls behind a lock (`withTimeout(…, DB_OP_TIMEOUT_MS)` =
  15s). ⛔ No more direct `await fb.<dataOp>(…)`. The right question is "**can this lock get stuck?**", not "is there
  `fb.` here?" — calls through **helpers** count too.
- ⛔ **RTDB doesn't reject writes offline** — it queues them and sends on reconnect ➜ **transactions commit after the
  timeout**. **`armLateCommit(promise, onCommitted, onFailed, label)`** keeps the original promise and finishes
  post-commit work (trash · money · pickup stats). ⛔ **`committed: false` and rejection go to `onFailed`**. ⛔ **Messages
  tell the truth**: while the transaction lives, the app **never claims data was rolled back**.
- **`armLateWrite(promise, onDone)`** for writes that release keys (registry · in-memory) and **`notifyIfSlow(promise,
  ms, message)`** to tell the user. ⛔ `notifyIfSlow` must **return the same promise** (`=== promise`) — wrapping it in a
  new `.then()` swallows the caller's rejection ➜ money revert dies silently.
- ⛔ **No `dbOp()` on trash writes** — its `catch` path **reverses** (adds money back · removes from trash) ➜ when the
  queued write lands later, the item lives in **both** places.
- ⛔ **The one exception: `claimBarcodeInRegistry`** — its call sites already have a ceiling plus late reporting. An
  inner ceiling makes a late-successful claim **never released** ➜ **that barcode can never be scanned again**.
- **Batch work aborts after the *first* hang** (`dbOpStalled(e)`) — otherwise 30 trash items = **7.5 minutes** with the
  lock held.
- **`sw.js`: `timedFetch()` is the single network path** — `NETWORK_TIMEOUT_MS` (20s) with `AbortController` **plus a
  race fallback** ➜ settling is **guaranteed by structure**. `networkOnly()` uses it too. ⚠️ The ceiling covers the
  header phase only.
- **`loadScriptOnce()` has a ceiling and *forgets* on failure** — a `<script>` the browser never answers fires
  **neither `onload` nor `onerror`**. Forgetting compares **identity** (`=== pending`). The failure message tells the
  real cause ("too long" ⛔ not "load failed").

## Listener and connection recovery

- **`dbListenerFailedPaths` records *which* path died** — `handleDbListenerError(err, pathKey)` always gets the **path
  key**. ⛔ **Never pass bare `handleDbListenerError` as an error callback** — no key ➜ **dead guard** ➜ siblings
  announce recovery while one listener never reattaches all session.
- **`dbListenerViewIsStale(key)` is the single basis** of "untrustworthy view" — ⛔ nothing asks
  `dbListenerPendingPaths.has()` directly.
- **Keys live as one shared constant** (`DB_LISTENER_KEYS` · `DB_LISTENER_KEY_DELETED`) — the key asked is the key
  registered (`initDatabaseListeners()` builds a `listenerRefs` map ➜ pending keys match real listeners).
- **`.info/*` follows the same rule** — `infoListenerFailedPaths` · `noteInfoListenerAlive(pathKey)`. ⛔ **Only the death
  of `.info/connected` may announce a network drop.** ⛔ **Fix both apps.**
- **Progress is a *timestamp*** (`dbListenerProgressAt`) written in `noteDbListenerAlive()` ➜ polling is
  **idempotent**. ⛔ **Never overwrite evidence inside a poll.**
- **`canCycleDatabaseConnection()`**: `goOffline()` **cuts an in-progress handshake** ➜ cycling allowed only when
  `hasEverConnectedToDatabase` or `networkJustReturned`. ⛔ Never drop this condition.
- **`retryFirebaseSdkNow()` is called from `online` *and* `visibilitychange` in both apps** — on phones a returning
  network often **never fires `online`**. ⛔ `shared-fns.js` **can't see it** (handlers aren't FunctionDeclarations) ➜
  **assert the *events* directly**.
- **`FIREBASE_SDK_RETRY_MIN_GAP_MS` (3s) must be *smaller* than the ladder's first step (5s)** or the ladder is
  swallowed. ⛔ `clearFirebaseSdkRetry()` **never resets `lastFirebaseSdkAttemptAt`**.
- **SDK recovery is a *page reload*** — **the browser module map caches failures per URL for the page's life**
  (measured: re-import · entry query · new `<script type="module">` **all still fail**). `reloadForFirebaseSdk()` has
  **4** ceilings: `firebaseSdkUnavailable` · `navigator.onLine !== false` · **`anyModalIsOpen()` ➜ no reload** ·
  `FIREBASE_SDK_RELOAD_MAX` (3)/`MIN_GAP` (20s). ⛔ **`navigator.onLine` lies** ➜ **measure reachability of the SDK host
  first** (`probeFirebaseSdkHost()`: `FIREBASE_SDK_PROBE_URL` · no-cors · ceiling) · unreachable ➜ **don't spend the
  ceiling** but keep the ladder · one probe in flight (`firebaseSdkProbeInFlight`) · the gate is re-checked **after the
  probe** (a modal just opened ➜ no reload) · ⛔ CSP `connect-src` must allow that origin (else fetch throws like a dead
  network ➜ **never reloads**) · both apps (`connection-recovery-test` 10ខ5 · `netlify-config-scope-test` ឃ).
  ⛔ `recoverFirebaseSdk()` exits at once when `!firebaseSdkUnavailable`.
- **The listener recovery ladder never cuts a resync in progress** — `dbListenerResyncIsProgressing()` decides, with
  `DB_LISTENER_PROGRESS_GRACE_MS` (20s) ➜ a **delay**, not a block.
- **A network drop ≠ a failure** — `pendingHistoryPatches` rerun when `.info/connected` returns `true`. ⛔ **Only
  `disconnect` or SDK `already deleted` may queue** (`permission_denied` and timeouts **revert**). ⛔ Queueing is
  **opt-in per call site** — `saveEditedPhone()` **must not use it**. ⛔ **Never add `flushPendingHistoryPatches()` to
  the 60s cycle** — it burns `HISTORY_PATCH_RETRY_MAX` while offline.

## Short rules — easy to break, heavy consequences

- **Reconfig during SDK load**: `initFirebase()` reads config **before** `await waitForFirebaseSDK()` and drops repeat
  calls ➜ `finally` compares stored config with `savedConfig` **and reruns only when it changed**. ⛔ **Never an
  unconditional rerun** — it stacks on `scheduleFirebaseSdkRetry()` into a **network-eating loop**. ⛔ **This rule
  belongs to both apps**: `saveFirebaseConfig()` of ZoeW and ZoeKeyGen writes the same `zoew_firebase_config` key and
  calls `initFirebase()` ➜ both have this order (ZoeKeyGen once lacked the rerun ➜ new config silently dropped ➜ keys
  written to the **old License Project** while "saved" showed). ⛔ General lesson: **a guard extracting from 1 file
  while the rule belongs to both apps = an expiry date.**
- **Network lookups feed the table back** (`rememberCustomerTableRow()`) ➜ the next scan of the same barcode answers in
  0 ms. ⛔ **A lookup that *finds nothing* never inserts an empty row** (a lying negative cache). **`customerTableIsPartial`
  is the honesty flag**: a miss on a **partial** table falls back to the network; a miss on a **fresh, complete** table
  schedules nothing. The scheduled pull **gives up after `CUSTOMER_TABLE_SOON_MAX_WAIT_MS`** (waking every 3s offline
  only burns battery).
- **`armLookupFocus()`**: focus after `LOOKUP_FOCUS_GRACE_MS` (250ms) if the lookup isn't done — never when the user
  already typed · the modal closed · `pendingBarcode` changed, and focus **once**.
- **`planPickupLedgerRepair()` never undoes a pickup Reset** — it repairs only when `bucket.total === recordedPackages`.
  Lock `pickupResetInFlight` is released in `resetClearHistoryOperationState()`.
- **`PIN_PROMPT_MESSAGES`**: `requestPinBeforeConfig(targetAction, promptKey)` — **every new PIN-protected button adds
  an entry**, else users see the "Config or Reconfig" message everywhere. ⛔ **Reusing another button's key falls under
  the same rule**: the message describes **what happens after the PIN** ➜ one key serving **2 target actions** = one
  side reads the wrong message. ⛔ `promptKey` touches **text** only (`applyPinPromptText()`) (`pin-prompt-test.js`).
- **Biometrics *unlock* the PIN, never replace it** — `deriveLookupSecretKey(pin)` derives the AES key from the PIN ➜
  biometrics only **wrap the PIN**. Enabling requires typing the real PIN first; a decrypted PIN **is verified against
  `zoew_security_pin_hash` before trust**; changing the PIN ➜ unbind. `completePinUnlock()` is the **single success
  path** for PIN and biometrics. ⛔ **ZoeKeyGen accepts only WebAuthn PRF** (no "device" mode storing the PIN) ➜ no PRF
  ➜ "unsupported" (`keygen-biometric-test`).
- **`linkIsFrugal()` must *fail open*** (Safari lacks the API) and skips only **optional** work — ⛔ never required
  work.
- ⛔ **JavaScript allows duplicate declarations and a later function silently overwrites an earlier one** — syntax ·
  boot · UI tests can all pass with drift. `function-surface-test.js` blocks it.

## Service Worker

- **Cache-first** with `CACHE_VERSION` pattern `<app>-vN`; the cache cleanup filter only scans its own prefix —
  ⛔ **never widen it**.
- **`CORE_SHELL` uses `cache.addAll()` (atomic)** — a SW activated with an incomplete shell kills scanning offline
  silently.
- ⛔ **The Cache API must not be a single point of failure** — `caches.open()` and `cache.match()` can throw (ITP ·
  quota · "Clear site data" while open) ➜ `respondWith` rejects ➜ **every request fails** ➜ white screen.
  `networkOnly(request)` attaches in **3 places**: `cache.match()` (second argument of `.then`) · `caches.open()` (outer
  `.catch`) · the fallback to `./index.html` on navigate. It **resolves** to `Response.error()` — never rejects. On
  navigate, both cache miss and Cache API rejection fetch **the same shell `cacheKey`** and pass `request.signal` on;
  never cache JavaScript or original assets under the `index.html` key.
- `/.netlify/functions/` goes straight to **`networkOnly()`** ➜ Functions **never enter the cache** ➜ they can't make
  the shell stale (why `version-bump-scope.js` exempts `netlify/` and `tools/`).
- Cached HTML stays with the SW version that installed it; never revalidate HTML into an old cache.
  `shellDeployIsCurrent()` and `revalidateShell()` settle within 6s even when fetch/body ignore abort or there is no
  AbortController. Guard: `ZoeW/tests/sw-revalidation-timeout.test.ts` measures the SW of both apps.

## `license-verify.js` is the **third** network path — READ BEFORE TOUCHING IT

It is **REST-only** (no Firebase SDK by design) with **its own network helpers**, separate from `app.js` ➜ every network
rule must be applied to it **separately** (it slipped twice: 2.11.6 · 2.17.4). `network-pressure-test.js` replaces it
with a **full stub**.

- **Every request goes through `sharedRequest(key, priority, run)`** — dedup by key plus ceiling `NET_MAX_IN_FLIGHT`
  (2). Release via `started.then(release, release)` — **both paths**.
- **`checkOnline()` and `syncServerTime()` need `networkLooksDown()`.**
- ⛔ **A skip returns `{ ok: null }` — never `{ ok: false }`.** `getStatus()` deletes the record **only when
  `ok === false`**. **Changing it to `false` deletes customers' Licenses on bad networks — don't.**
- **`activate()` (user tap) goes through `{ priority: true }`**.
- **`getStatus()` binds the verdict to the record snapshot** and re-checks after `await` on signature and REST; record
  changed ➜ read fresh, never delete/overwrite it. Shared requests per App + snapshot and recheck have ceiling 2
  (`license-record-race-test.js` uses real ECDSA and shared storage).
- ⚠️ `license-grace-test.js` extracts functions by name into `vm` — **a new helper ➜ add its name to that extraction
  list**.

### ⛔ "Can't verify" ≠ "wrong" — applies to **every axis**

Every validity check has **3 outcomes**: `valid` · `invalid` · **`unverified`**. Only `invalid` may delete anything.
`unverified` ➜ keep, but **grant nothing new**. Closed axes:

| Axis | Rule |
|---|---|
| **network** (2.17.4) | a skip ➜ `{ ok: null }` |
| **crypto** (2.20.1) | WebCrypto down ≠ forged signature |
| **clock** (2.20.1) | deletion needs `serverTimeSynced` or a server verdict |
| **rollback** (2.20.6) | `monotonicNow(record) = max(getServerNow(), record.seenMax)` |

- **`activate()` needs `checkOnline().ok === true`** plus `serverTimeSynced` (tries `syncServerTime({ priority: true })`
  before giving up). Activation needs internet — **an intentional behavior change**.
- **Ceiling from DB**: `online.expiresAt` beats the signed `exp` ➜ "Extend" works on new devices. ⛔ Revoke · missing
  from DB · bad signature **still refuse**.
- ⛔ **Deleting a record needs a real `checkOnline()` verdict** — no longer by `serverTimeSynced` (that flag stays
  `true` after going offline).
- ⛔ **A server verdict *heals* `seenMax`** (overwritten with real server time) — otherwise a phone that booted into the
  future **poisons the floor forever**.
- **Failure messages tell the truth** — `network` · `clock-unverified` ➜ "ភ្ជាប់ Server មិនបានទេ!" ⛔ not
  "Key មិនត្រឹមត្រូវទេ!".

## Toasts · status labels · XSS · secrets

- **4 toast classes by message prefix**; `renderConnectionStatus()` is the **single** broadcaster; toast registration
  lives **in the DOM**, not module state. ⛔ **"connected" ≠ "data arrived" ≠ "still signed in".**
- ⛔ **Optimistic UI ≠ durable commit** — write success appears only after Firebase resolves/`committed:true`;
  offline/timeouts that may late-commit are ⏳/⚠️ and ✅ comes after reconnect (`toast-action-truth-test.js`).
- **Every value into HTML goes through `sanitizeInput()`** — `html-sink-escaping.js` scans **both forms** (template
  literals **and** string concatenation).
- **`redactDeep()` walks the whole event** before sending to Sentry:
  - Bearer/Basic are redacted before splitting on colons; Cookie headers redact the whole value. Covers JSON
    credentials with spaces/quotes/arrays/objects and encoded URL param names.
  - Separators include `, ; { |` besides `?&#` and spaces (console breadcrumbs are the biggest leak path — Sentry
    captures them **automatically**).
  - ⛔ **Values stop at separators**, otherwise one pair swallows the next.
  - ⛔ **Hitting the depth ceiling *truncates* (`'[truncated]'`), never returns raw.**
  - **Redaction by object key name too**, and **any value type**, not only strings.
  - ⛔ **Writes are verified to stick** (`if (target[key] === next) return;`); when in-place edits fail (frozen ·
    `writable: false` · getter) ➜ **copy that object once** and return the copy. `seen` is a **`Map`**. Live cycles are
    cut as `[circular]`; never return the original unredacted object.
  - **"Keep case"**: `barcode` · `keyId` · `id` · `count` **stay visible** — the key-name list is smaller than the URL
    param list.
- **`appLocalStore` / `appSessionStore` are the single path to storage** — they read `window.localStorage` **inside a
  `try` once** at the top and may be `null`. ⛔ **`safeStoreSet(localStorage, …)` is not enough** — arguments are
  evaluated **before** entering the function ➜ a throwing **getter** throws **at the call site**. ⛔ **Never judge by
  `typeof <fn> === 'function'`** (hoisting). Real signals: **stuck boot screen** and **runtime errors**.
- **Credentials never survive in DOM or state after logout** — `clearSensitiveModalFields()` is the single cleaner.
  ⚠️ **New state ➜ add its name to the extraction list of `setup-link-logout-test.js`** too.

## ⛔ App lock on open and on return

`#appLockScreen` is a **device access layer**, not authentication.

- ⛔ **Locking never touches the 4-hour session** — no `fb.signOut()` · no clearing `zoew_login_time`/`remembered_email`
  in lock/unlock paths.
- ⛔ **`lookupSecretKey` survives reload like the unlock flag** — the `CryptoKey` lives in **IndexedDB**
  (`zoew_lookup_key_v1`) with `extractable: false` ➜ scripts can't read its *value*. ⛔ Restore refuses when
  `appLockShouldArm()` **and** when the record isn't a CryptoKey; ⛔ every IndexedDB path is **fail-open** with a 3s
  ceiling (throwing getter · `onblocked` · transaction abort ➜ the app behaves exactly as before).
- ⛔ **The unlock flag lives in `sessionStorage` (`zoew_app_unlocked`)**, not `localStorage` — PTR and
  `reloadForFirebaseSdk()` do a real `location.reload()` ➜ locking on every load = **a PIN on every pull-down**.
- **Leaving/returning locks in 3 steps**: (1) `hidden` ➜ **cover** `showAppLockScreen(true)` ⛔ **without touching the
  session flag** (otherwise the **task switcher** snapshot shows customer numbers); (2) `visible` ➜ **really lock**
  (clear the session flag) plus a silent `runAppLockBiometric(true)` — ⛔ **clearing happens at this step**; (3)
  **intentional exits from inside the app are excused** via `noteAppLockExcuse()` + `APP_LOCK_EXCUSE_WINDOW_MS` (60s,
  **that one round only**). ⛔ **Never use `blur`/`focus`** (they fire on native dialogs ➜ fake locks). ⛔ **Never
  "harden" by removing the excuse** — that means a PIN on every call.
- `body.app-locked` hides **`.modal` · `.more-menu` · `.phone-suggest` · `.toast-container`** besides navbar/pages/tab
  bar/drawer. Hiding is **real** (`visibility: hidden` + an **opaque** `var(--body-bg)` background).
- **Two gates to keep**: `safeFocusScanner()` `return`s at once when `appIsLocked` (else a barcode lands in the PIN
  field) and `pullTargetBlocked()` counts `appIsLocked`.
- **Locks only when `zoew_security_pin_hash` exists** — ⛔ **never force PIN setup at boot**. **"ភ្លេច PIN?" exit is
  required** (a lock without an exit is a trap).
- ⚠️ `initAppLock()` runs in boot (`src/app/lifecycle/boot.ts` via `oncePerPage`) **before** data rendering — calling
  it later opens a window where data renders before the lock.

## ZTO Lookup

- **`ZoeW/netlify/functions/zto-order-detail.js` is one file** with **one** dependency: `@netlify/blobs`.
  ⛔ `puppeteer-core` and `@sparticuz/chromium` **are banned** — auto-login was removed in 2.25.0 because **ZTO IDaaS
  doesn't open to Netlify IPs** (evidence: host suffix `@argus.ztoglobal.com` ➜ the browser isn't even redirected to the
  IdP). ⛔ **Never bring it back without proof that the IdP opens to foreign servers.**
- **Two budget layers**: `ZTO_UPSTREAM_TIMEOUT_MS` (6s) per request plus `ZTO_REQUEST_BUDGET_MS` (**9s**) total — the
  app's response budget. [Netlify docs](https://docs.netlify.com/build/functions/configuration/) list 60s for
  synchronous functions; don't confuse with the 10s streaming limit. Client ceilings: `ZTO_AUTO_LOOKUP_TIMEOUT_MS`
  **13s** · `ZTO_TEST_TIMEOUT_MS` **11s** (server budget 9s + margin 4/2s).
- ⛔ **Budget measured via `elapsedSince()`** (backwards ➜ `Infinity` ➜ fail-open) and **settling guaranteed by
  structure** (a real timer races `attempt()` in addition to `AbortController`).
- ⛔ **"Not found" is not an error** — HTTP 200 `{ found: false }` **with no `error` field**. Adding `error` ➜
  `attemptAutoLookup()` throws "Lookup rejected" ➜ **30s cooldown**.
- **Server cache**: key = `config.fingerprint + '|' + barcode` — ⛔ **no Cookie fingerprint** (results are order data,
  not session-dependent). The **single-flight key still holds the Cookie**, ordered `config|barcode|cookie` for both
  normal lookups and the post-auth-rejection retry. The cache check sits **before** `resolveCookieCredential()`.
  **`notFound` is cached too** (short TTL **15s**) — ⛔ **transient failures never enter the cache** (401 · 5xx · 429 ·
  timeout). ⛔ **The negative TTL is capped by `cacheTtlMs`** ➜ `ZTO_CACHE_TTL_MS=0` disables **both** paths in one
  place; `ZTO_NOT_FOUND_CACHE_TTL_MS=0` disables only the negative path. The negative TTL is **short on purpose** (newly
  entered parcels must be found soon).
- **`resolveCookieCredential()` is the single source decider**: `ZTO_AUTHORIZATION` / `ZTO_TOKEN` ➜ **never touches the
  store**; else blob ➜ `ZTO_COOKIE` env. ⛔ **Blobs must not be a single point of failure** — `import` fails ·
  `connectLambda` throws · `getStore` throws · read fails/hangs · bad value ➜ fall back to env. ⛔ `connectLambda(event)`
  sets only **`edgeURL`** ➜ `consistency: 'strong'` throws `BlobsConsistencyError` — **never "fix" it by adding a PAT**.
- ⛔ **Store names agree on both sides**: `getStore('zto-auth')` ➜ the real store is **`site:zto-auth`** ➜ the helper
  writes `/api/v1/blobs/{siteID}/site:zto-auth/cookie`. **Checkers read the name from the real Function**, not a literal.
- **A 401 from ZTO clears that cache at once** (`invalidateCookieCache()`) and `?diag=1` answers the reason **surviving
  the 60s cache**. ⛔ **Secret values never leave** — only the 8-char `fingerprint`.
- **Auth verdicts belong to the Cookie ZTO measured**: a new Cookie from Sync starts "unverified"; late answers for an
  old Cookie never reject/accept the new one (`zto-cookie-session-test.js`). Client messages say **"rejected"**; a 401
  doesn't prove time expiry and a timeout is not an auth verdict (`health-check-test.js`).
- **Renewals are stored without overwriting a newer Sync**: SDK `getWithMetadata()` locks the version and `set()` uses
  `onlyIfMatch` with the read ETag, or `onlyIfNew` when it read nothing. `modified:false` is a conflict; `modified:true`
  without an ETag doesn't prove success either. A changed `BOS-MAN-SESSION` tries to write at once within the same
  budget; the 60s ceiling applies to auxiliary Cookies and same-value retries. Pending must survive budget/timeouts and
  stale cache reads, and a failed fresh read never deletes a working Cookie (`zto-cookie-session-test.js` ·
  `zto-cookie-store-test.js`).
- **Consecutive scans**: busy is a **wait**, not an **end** ➜ capped parcels go to `autoLookupQueueRetries` and retry.
  ⛔ **Every early exit calls `dropAutoLookupQueueEntry(lookupKey)`** (except the "concurrency full" path, which
  requeues) — orphan entries make later scans refused as "busy too long" **while no wait happens**. The ceiling measures
  **real** waits (`existing.timer` **or** `existing.pending`). ⛔ **Never turn `waiting` into a "don't schedule"
  condition** — skip scheduling only when **a live timer exists** (`existing && existing.timer`); using `waiting`
  (which includes `pending`) makes `return true` **without scheduling** ➜ **the retry cycle dies silently**.
  ⛔ **Concurrency ceiling stays 2** — never raise it on theory.
- **`lookupResponseError(status, body, retryable)` is the single error builder** — it always attaches `lookupCode` and
  `lookupReason`. ⛔ No bare `new Error('HTTP ' + status)`. `err.noRetry` ➜ `retryAsync()` honors it. Cooldown:
  transient **6s**; permanent verdicts **30s**.
- **`customerTablePrefetchAllowed()` is the single gate** — blocks when `isModalOpen` or `autoLookupInFlight.size > 0`.
  **The ladder's first step is longer than `CUSTOMER_TABLE_FAIL_COOLDOWN_MS`**. **Busy at the scheduled time ➜
  reschedule, never give up.**
- **Import ➜ the table fills at once**: `seedCustomerTableFromImport()` **fills**, never **clears**, and honors the
  import mode **exactly like the server** (`replace`/`upsert`/`newOnly`; duplicates in the file ➜ **last row wins**).
  ⛔ **`runSheetImportClear()` still *clears***. `fresh=1` is the cache-opening key **for forced pulls only**. The server
  cache key carries the row count (`customer_rows_v2_<lastRow>`).
- ⛔ **Requests to Apps Script are always *simple requests*** — `Content-Type: text/plain;charset=utf-8` and **no custom
  headers**. Apps Script **doesn't answer `OPTIONS`** ➜ a preflight = **import dead in production while fetch-stubbing
  tests pass**. ⛔ **This covers *every* path to Apps Script, not just import** (the **Lookup** path once lacked it ➜ the
  "Header name" field killed `?list=1` and `?code=` with `Failed to fetch`). `lookupApiSendsHeader(cfg)` is the single
  gate: header **and** PIN prompt are skipped for Apps Script. ⛔ **Apps Script can't read headers at all** (`Code.gs`
  reads `e.parameter`). ⛔ Detection compares the **hostname**, not a substring (`script.google.com.evil…` doesn't
  count). ⛔ Not sending must be told to the user — **no silent drops**.
- ⛔ **`fetch()` doesn't reject on HTTP errors** — 408/425/429/5xx are turned into rejections **inside** the
  `retryAsync()` callback; 401/403 stay outside.

## ZTO Cookie Sync on Windows (`tools/zto-cookie-sync-windows/`)

Chain: `sync-zto-cookie.cmd ➜ Edge/Chrome request ➜ Netlify Blobs (store site:zto-auth, key cookie)` — **no redeploy**.
After Login and opening Argus the helper captures from an API response that accepts the session. If still waiting, the
fallback is **Scan Management ➜ Arrival Scan ➜ type a Waybill** to trigger
`POST https://aargus-api.ztoglobal.com/scan/get/order/detail`.

⛔ **Start point ≠ capture target**: the helper opens **`gate.ztoglobal.com`** (keeps the session ➜ tap the branch card ➜
Argus opens without a password) while `argus.ztoglobal.com` asks for Login **every time** ➜ it's still printed as a
**fallback** (⛔ never remove). Capture **doesn't follow it**: `BOS-MAN-SESSION` belongs to **`aargus-api.ztoglobal.com`**
➜ signing into the gate alone doesn't create that Cookie. ⛔ **Long-lived Cookies on `argus` can't replace it**
(`__zcat_uuid__` · `ZTO_INTL_BOS_MAN_TOKEN` — **another domain** ➜ never sent to the API host) ➜
`validateCookieHeader()` still requires `BOS-MAN-SESSION`. ⛔ **Opening Argus for the user** (`openArgusFromPortal()`):
tapping the branch card opens a **new tab** at plain `https://argus.ztoglobal.com/#/` which redirects to `#/index`
**already signed in** ➜ ⛔ **no token in the URL** ➜ what grants access is **loading the gate page first** (SSO
handshake). So the helper **opens a new tab to `ARGUS_URL` directly** ⛔ **without scanning the DOM for links** (the
main frame lists **0 links**). ⛔ **3 gates before opening**: capture not done · no tab already on Argus (`isArgusHost()`
— ⛔ **not a loose `endsWith`**: `aargus-api` and `notargus` don't count) · gate page settled (`waitForLoadState` within a
ceiling). ⛔ **Fully fail-open**: `newPage` fails · `goto` slow · `waitForLoadState` fails ➜ never throws, and **an
already-opened tab is left alone** (slow `goto` ≠ failure). `watchApiTraffic()` reports counts of API calls seen
(total · 2xx · 401/403) on failure: **outside the capture path** · registered after the capturer · wrapped in `try` ➜
can't make capture fail · ⛔ **numbers only, no URLs, no Cookies**.

- Cookies live in memory; **shown on the cmd screen by user request**. ⛔ **PAT and `ZTO_PROXY_KEY` must never be shown**
  (AST scan — ask "can the **value** reach output?", not regex on **names**).
- ⛔ **All text to cmd is ASCII English** and **`.cmd` is pure ASCII + CRLF** — `cmd.exe` splits UTF-8 Khmer/emoji mid-word.
- **Unverifiable cookie pairs ➜ skipped** (list **names**, never values) while **real protection stays**: CR/LF/NUL ➜
  reject **the whole jar**; no valid `BOS-MAN-SESSION` ➜ reject. ⛔ **The server applies the same rules.**
- The PAT is prompted with `Read-Host -AsSecureString`, kept as **DPAPI/CurrentUser** in `%LOCALAPPDATA%`, and crosses
  only a stdout pipe (`shell:false`). ⛔ No PAT on command lines or Netlify env. **The PAT never flows to the signed-URL
  host.** The DPAPI child must finish within 30s and clear buffers/timers on every exit.
- **Setup can rerun, with Enter = keep the old value** (Netlify shows the PAT **once**). ⛔ **No silent drops** — a short
  key reports characters typed and required. ⛔ **Gates measure *the value that decrypts*, not *file presence*.**
- **`--auto` opens a browser only on a clear verdict** (`status === 'ok' && healthy === false`). `mismatch` **is not
  `error`**.
- **Netlify timeouts cover reading the body to the end**; streams over 1 MB are refused before EOF. Broken EOF is a
  retryable network error; 401/403 never retry even if `body.cancel()` hangs (`zto-network-boundaries-test.js`).
- **Capture waits for a *response* proving ZTO accepted the session**: HTTPS `GET`/`POST` on the **real host** (⛔ **any
  path** — Cookies belong to the **domain**, not the path). Empty requests, HTTP 401/403, redirects/IdP, OPTIONS/HEAD and
  bad JSON can't prove success. Read the response fully and merge `Set-Cookie` matching the URL before closing the
  browser; keep the time ceiling and remove listeners on every exit. ⛔ **Locking path `/scan/get/order/detail` is a
  regression** (2.31.2 ➜ user report): it forces **scanning a parcel every time** with no protection gained — protection
  lives in the **response**, not the path. ⛔ The host is the **only** URL gate ➜ its looseness (`endsWith`) has guards
  (`zto-cookie-capture-test.js` · `zto-cookie-sync-test.js`).
- **The same fingerprint proves only storage**: verdicts are accepted/rejected/not measured. `--auto` doesn't open a
  browser for "not measured" (`zto-cookie-sync-test.js` · `zto-cookie-capture-test.js`).
- ⛔ **Server env the old extension used stays deleted**: `ZTO_COOKIE_UPDATE_KEY` · `NETLIFY_AUTH_TOKEN` ·
  `NETLIFY_ACCOUNT_ID` · `NETLIFY_SITE_ID`.

## Excel import to Sheet (in ZoeW) and `zto-import`

- **Replace grows the grid and writes new data successfully before clearing extra old rows**; rejected writes/resizes
  never delete old data (`zto-import/test.js`).
- **The only path to the dialog is PIN** — `requestPinBeforeConfig(openSheetImportModal, 'sheetImport')`.
  ⛔ **`openSheetImportModal` must not be in `ACTION_ALLOWLIST`**.
- **Salts stay fixed**: `zoew_sheet_import_secret_v1` (AES from Security PIN), `zoeadmin_pin_verify_v2`,
  `zoeadmin_lookup_api_secret_v1` and **`LICENSE_APP_CODE`** — changing any breaks data on every device (or every issued
  Key). ⛔ **The value is now `'ZOE'`** (once `'ADM'`) — ⛔ not a display label: it lives **inside the signature**
  (`payload.a`) · is a Firebase path · and a key `zoe_license_activation_` plus the code ➜ changing it again **breaks
  every Key and Activation** and needs new Keys for every customer. `license-app-code-test` locks it.
- ⛔ **"Can't decrypt" ≠ "wrong"**: wrong PIN ➜ show the setup form, **never delete the record**. **Logout ➜
  `clearSheetImportSession()`** while **the encrypted connection stays**.
- **`sheetImportReadOptions(bytes)` is the single decider**: `raw: true` **only when the file is not a container** (ZIP
  `50 4b` · OLE `d0 cf 11 e0`) — detected by **bytes**, not the file name. ⛔ **`.xlsx` never gets `raw`** (date cells
  become serials). Without `raw` ➜ CSV **loses leading zeros** ➜ wrong phone numbers flow back to ZoeW.
- **SheetJS 0.20.3 is in the repo** (`ZoeW/public/vendor/xlsx.full.min.js`) — ⛔ no CDN. ⛔ **Never keep
  `IMPORT_PASSWORD` plaintext in Web Storage**.
- `zto-import/` is a **standalone** Apps Script (writes) while `zto-import/google-sheets-api/` is a **bound** Apps Script
  (reads) — **2 separate projects with separate `CacheService`**. `Code.gs` **fails closed** (no ScriptProperty
  `API_KEY` ➜ refuse).

## Export · Setup Link · Firebase Backup

- **jsPDF can't shape Khmer** — PDF export uses browser print-to-PDF. ⛔ Never bring jsPDF back for Khmer.
- **Phone numbers and barcodes are TEXT, not numbers** — `XLSX.writeFile(..., { bookSST: true })` plus
  `forceExportTextCells()` (`EXPORT_TEXT_COLUMN_INDEXES = [1, 2]`). ⛔ **Never judge this from in-memory cell objects —
  check the emitted XML.**
- **`csvSafeText()` prefixes `'`** to values starting with `=` `+` `-` `@` (free-text Locker names ➜ live formulas in
  Excel). ⛔ **Never apply it to all of `csvEscape`** — `sheetsText()` output starts with `=` **on purpose**.
- **Setup Link**: `applySetupLinkFromUrl()` **goes through the same PIN gate** before filling the textarea — **no auto
  save path**. The query string is removed at once via `history.replaceState`. An abandoned Setup Link **doesn't survive
  logout**, but a Link the user is **actively typing a PIN for** is never dropped (`isPinFlowPending()` decides).
- **`firebase-backup/`** is a Node.js 18+ CLI (native HTTPS/OAuth, no dependencies). `config.json` · `secrets/` ·
  `backups/` are in `.gitignore` — ⛔ **a service-account key is a real credential, never commit it.** Backups write to
  `.partial` then `renameSync()`.
- **It runs 2 ways**: by hand/Task Scheduler on the user's machine **and** `.github/workflows/backup.yml` (daily 02:00
  Cambodia = cron `0 19 * * *`). The GitHub path uses `ci-config.js` (config + key from secrets) ➜ `backup.js` ➜
  `crypt.js seal` (AES-256-GCM via scrypt).
- ⛔ **Artifacts never hold plaintext** — dumps have real phone numbers and COD/DOD. `seal` encrypts **and deletes the
  `.json.gz`**, and a separate verification step **fails before upload** if any non-`.enc` file remains. ⛔ Encryption is
  **decrypted back and verified** before writing — an unopenable backup is worthless and must never happen silently.
- ⛔ **Keys never land in the checkout** — `ci-config.js` **refuses** any path inside the repo ➜ accidental commits are
  impossible *by structure*; the workflow deletes the key **even when the round fails** (`if: always()`) and token
  permissions are `contents: read`.
- **Many businesses ➜ many projects**: `ZOE_BACKUP_TARGETS` is an **array** ➜ one round covers any number of projects
  (separate folder per name; one failing doesn't stop others). The limits are **not technical**: customer data lives in
  the **customer's** project ➜ you need their key (ask for role **`Firebase Realtime Database Viewer`**, read-only), and
  GitHub Free artifact quota (private repo = **500 MB**) = one round size × `ZOE_BACKUP_RETENTION_DAYS`.
- ⛔ **One business failing must not destroy another's backup** — the pull step has `continue-on-error: true` (because
  `backup.js` exits non-zero when one fails) and **the last step, after upload,** turns the job red. ⛔ **Never move that
  step up** — successful backups would be lost.
- ⚠️ **GitHub pauses scheduled workflows after 60 days of repo inactivity** — a 📝 area (no repo tool sees it). If
  backups stop silently, check Actions first.

## Firebase rules — current shape

`firebase-database.rules.json` (Business): root default-deny; every node uses `auth != null` as the only permission.
The real protection left:

- **Schema validation** — field types, value ranges, and `$other: { ".validate": false }` rejecting unknown fields.
  ⛔ **Never remove it.**
- **Claim/witness fences** on `zoew_restore_finalizations` and `zoew_clear_history_finalizations` prevent
  Restore/Clear All replay and duplicate revenue. ⛔ **Never remove them.**
- ⛔ **A witness must not require `!data.exists()`** — it creates a **3-way deadlock** (restore 401 · deleting the
  witness 401 · deleting the trash item 401) ➜ the item can **never be restored or deleted**. What really blocks replay is
  "the claim token is in the trash item **before** the update and that item is deleted **in** the same update".
- **`license_keys/$appCode/$keyId` is publicly readable** (only `expiresAt` and `revoked`) because `checkOnline()` is
  REST without auth. Sensitive metadata lives in `license_keys_meta`, readable/writable only by admins.
- **Nodes expecting objects require objects** — `.validate: "newData.hasChildren()"` (or `hasChildren([...])`) on every
  writable node with child schema (history/trash records · `barcodes` · daily/monthly ledger · pickup stats · revenue
  mirror · License Key/seat/meta). ⛔ **Never remove it** — see the core-table row. `.validate` doesn't run on deletes
  (`null`).
- `ZoeKeyGen/firebase-database.rules.json` keeps `user_roles` and the `admin` role **on purpose** — separate project.

## ⛔⛔ Netlify config: 2 sites from one repo — never add a root `netlify.toml`

> 🔴 Real finding (2026-09-03, PR #150): Netlify's agent opened a PR **adding a root `netlify.toml`**, claiming "your
> `base` setting points to `/opt/build`". **That claim was false**: no `base` existed anywhere and there was no root file.

The repo deploys **2** Netlify sites (`zoew` · `zoekeygen`). **Base directory belongs to the Netlify UI per site** — not
the repo.

### ⛔ 📝 Base directory is case-sensitive (no tool can lock it)

| Netlify site | Correct Base directory |
|---|---|
| `zoew` | **`ZoeW`** |
| `zoekeygen` | **`ZoeKeyGen`** |

🔴 **Real cause of the 2026-09-03 failed deploy**: base was set to **`zoekeygen`** instead of **`ZoeKeyGen`**. Netlify
builds on **case-sensitive Linux** ➜ "base directory does not exist" was **true** — the problem was never in the repo.
When a deploy fails with that message: **check case in the UI first**, before believing any analysis pointing at the
repo.

- ⛔ **No root `netlify.toml`, ever** — Netlify reads it for **both** sites and it beats UI settings ➜ a `base` there
  redirects the other app's build.
- ⛔ **No `base` key in any app config** either.
- **Config matches what the app *really ships*** (derived, not literal): ships `.wasm` ➜ CSP has `'wasm-unsafe-eval'`
  **and** header `Content-Type = "application/wasm"`; has `netlify/functions/*.js` ➜ toml has `functions = ` pointing at
  a real dir; `index.html` requests `script.google.com` ➜ `connect-src` allows it. ⛔ **Keep the reverse**: apps without
  wasm/Functions are not forced.
- ⛔ **Every config production reads needs at least 1 checker reading it** — the gap PR #150 exposed.

⚠️ **Lesson: bot-proposed fixes go through the same discipline.** Before accepting any PR (human or bot) ask "**is the
claimed cause true?**" and `grep` it. Test: **`netlify-config-scope-test.js`**.

---

# 🔬 Checker discipline

## ⛔ 13 questions before believing a new checker works

1. Which **files** does it scan/run?
2. Which **syntax forms** does it scan? (template literals vs string concatenation)
3. Which **directions**? (markers in **and** out)
4. **Can it fail?** ➜ `node audit-tools/checker-coverage.js` (runs each checker with `*_APP_DIR` pointing to an **empty
   dir**)
5. **Can it hang?** ➜ `node audit-tools/hang-guard.js`
6. **Does its failure reach the exit code?** ➜ `node audit-tools/exit-code-integrity.js` (`run-all.sh` decides by **exit
   code only**)
7. **Does any tool see the *seam* between 2 files?** ⛔ Stubbing a seam in every test = that seam has no test; stubbing
   the seam you measure = measuring something else.
8. **What *state* does it put the system in before asserting?** (`connection-recovery-test` had 127 assertions **all
   green** on buggy code because every scenario fired `errCb` **right after** `initDatabaseListeners()` ➜ the buggy
   condition was protected **by accident**)
9. **Which *failure modes* does it put dependencies in?** (reject · absent · **hang** · **slow success**)
10. **Does it see *promise rejections*?** — `pageerror` only catches **synchronous** throws; nearly all code here is
    `async`. Converters via `addInitScript` sit **before `.goto()`**.
11. **Is its failure real or a measurement artifact?** ➜ needs a **reverse probe** and a **minimum floor**.
12. **Is the result `PASS` or `SKIP`?** ⛔ **`SKIP` means "couldn't measure", not "correct"** ➜ eliminate SKIPs before
    claiming a green tree.
13. **Does the *measurer* itself point at the right tree?** — a round ran 5 mutations with the **wrong `*_APP_DIR`
    name** ➜ checkers scanned the real tree ➜ "survived" all 5 **wrongly**. Before believing mutation results:
    `grep -n 'process.env\.[A-Z_]*APP_DIR' audit-tools/<checker>.js` and make it **fail on purpose** once.

## Core tool rules

- **Static checkers lock *names*; behavioral checkers lock *outcomes*.** Renames · refactors · moving code **fool only
  the first kind** ➜ every class **measurable in a browser** deserves a behavioral checker.
- **Assertions of *absence* need a *minimum floor*** — "no bad pattern" is automatically true on empty input. Floors
  count **files** too, not just "number of calls".
- **Every checker can point at another tree** (`*_APP_DIR`) **and is called in the baseline part of `run-all.sh`**.
- ⛔ **Never stop a checker when a function name isn't found — *stub* it instead.** `process.exit(1)` on "function not
  found" **masks every assertion below it**.
- ⛔ **Never wrap all scenarios in one `try`** — the first failure swallows the rest. ⛔ **`await scenario()`** when `fn`
  is `async`.
- ⛔ **Every scenario starts from the original stubs** — **stubs leaking across scenarios are the quietest fake green**.
  Add **precondition assertions** ("the dialog really opened") proving it reached the path under test.
- ⛔ **Always `listen(0, '127.0.0.1')`** — fixed ports ➜ parallel runs ➜ `EADDRINUSE` ➜ **false signals**; bare
  `listen(port)` binds `0.0.0.0` ➜ **exposure**. ⛔ **Same for the RTDB namespace** of `emu/*`: all `emu/*` share one
  emulator ➜ namespaces come from `emu/ns.js` (`emuNamespace()`), **unique per run** (fixed namespaces made
  `ledger-revert` ×2 and `restore-deadlock` ×2 fail on trees that never touched ledger code).
- ⛔ **An `ok()` taking *only a label* must never be called conditionally** — `ok = (label) => { pass++ }` with
  `ok(label, condition)` **silently drops the condition** ➜ the assertion **can't fail**. ⛔ **Counting arguments needs a
  real parser** — character scans confuse **regex literals** containing `'` and `,`.
- ⛔ **`checker-coverage.js` skips part 5 when `EXITCODE_CHILD` is set** — else a **mutual loop** (checker-coverage ➜
  exit-code-integrity ➜ checker-coverage ➜ …). Hash snapshots skip `.tmp-poison-*` too.
- ⛔ **Poisoning happens on a *shadow file*** (`.tmp-poison-<pid>-<name>.js` in the same dir) — originals **are never
  opened for writing** ➜ SIGKILL can't corrupt the repo.
- ⛔ **Every checker with a depth parameter defaults to *at least* the depth measured as necessary** — a smaller fixed
  number is a run that runs nothing.
- ⛔ **Assertions about *ceilings* compute against the real ceiling** — read it from the sandbox and use `cap + N`;
  never a fixed number.
- ⛔ **Same for fuzz *minimum floors***: a fixed floor tied to the default run count is **luck** — it moves with the seed
  range (same 160 runs gave 43 clean states at `CFUZZ_RUN0=0` and 17 at `CFUZZ_RUN0=500` ➜ `>= 30` failed with no bug).
  ⛔ The fix is **structural**: reserve a fixed share of runs per state (e.g. 2 of 8 clearly clean) and **derive every
  floor from `RUNS`** ➜ short or deep runs never go falsely red, and removing the reserved share **still fails**.
- ⛔ **Doc assertions measure *facts*, not *word choice*** — rewording must not fail it, removing the guarantee must.
  **Default numbers in docs are read from real code**, not literals in the checker. ⛔ **Same for *code text***:
  "line X before line Y in function Z" scanning **X's literal text** expires when X moves into a helper **correctly** ➜
  the fix is **derivation**: find which function's **body** contains that text ➜ calling it is the same guarantee
  (⛔ not a second hard-coded helper name). It must still fail when nothing provides the guarantee.
- ⛔ **Never write assertions that *lock a bug in*.** When an assertion fails ask "does it protect something or lock
  something?" (e.g. `ok(caught.length === 0)` on an equivalent mutant fails when someone **strengthens** the guard).
- ⛔ **Fuzz asserts *after every operation*, not only at the end** — later operations **erase evidence** of earlier
  failures (two revenue-mirror seams needed **opposite** orders; end-only checks caught one at a time, and tuning weights
  to catch one lost the other). The fix is **measuring every step** ➜ seams in every direction measured
  **structurally** (assertions 36 ➜ **276**, run time unchanged).
- **Mutation testing: ask *who catches it*, not *is it caught*.** The answer shows real coverage boundaries.
- ⛔ **Hypotheses about gaps are measured before building tools to close them.** (A suspected ZTO seam gap ➜ 13
  mutations ➜ **existing tools caught all** ➜ the new tool was deleted.)
- ⚠️ **Failures caused by adding a new helper (sandbox breaks) are a *good sign*** — they prove those checkers run real
  shipped code. A refactor that breaks **no** checker means they don't touch real code.

---

# 📘 Runbook

## Step 0 — setup (once per session)

⛔ **Run CI in this session too** before pushing: GitHub Actions quota ran out before (2026-09-09) ➜ waiting for "CI green
on GitHub" may never end. `.github/workflows/audit.yml` runs full `run-all.sh` as **4 parallel shards**
(`RUNALL_SHARD=k/4` · an emulator per shard · STRICT flags as below) ➜ CI green = all 4 shards green. (`backup.yml` is
separate.)

```bash
npm ci --prefix ZoeW          # ZoeW React: vite · acorn · playwright-core · firebase (real SDK for emu/tx-disconnect · emu/app-network-e2e)
npm ci --prefix supabase      # Supabase guards: real Postgres (@embedded-postgres) · pg · supabase-js · typescript
npm ci --prefix tools/firebase-provision --ignore-scripts   # real firebase-tools for firebase-provision-test
bash audit-tools/run-all.sh
```

⛔ `run-all.sh` on the React repo **builds the measure tree itself** (`ZoeW/dist-audit/measure-root`) and runs every
checker there ➜ ⛔ running one checker **directly on the repo** measures a `ZoeW/app.js` that no longer exists. One
checker alone: `M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1)` then
`(cd "$M" && node audit-tools/<x>.js)`. ⛔ Full CI (incl. `zoew-suite` · real emulator) takes **~10 minutes** on 4 CPUs
➜ run it in the background and **commit + push before waiting** (a session that runs out of quota mid-wait loses all
unpushed work).

⛔ **`run-all.sh` is parallel and *resumable*** (usage: [`audit-tools/README.md`](audit-tools/README.md) section 2):
lanes `RUNALL_JOBS` (default = CPUs within 2–6) · output **always in list order** · every finished checker is written to
`RUNALL_STATE` (`<git-dir>/zoe-runall-state.tsv`) **at once** ➜ a session that ran out of quota midway: the next session
runs `RUNALL_RESUME=1` **with the same `*_STRICT` flags** (they're in the hash) ➜ reruns only failed/unfinished checkers
⛔ **never stitch logs by hand**. ⛔ Tree changed (any file · STRICT flags) ➜ RESUME **refuses**: old results aren't
evidence for a new tree ➜ run fully. ⛔ `RUNALL_ONLY=…` and `RUNALL_SHARD=k/n` = **incomplete** — not proof the tree is
green. ⛔ **One run-all per repo**: the measure root (`ZoeW/dist-audit`) is shared ➜ a second run or `ZOE_MEASURE_ONLY=1`
while it runs ➜ **exit 2** (lock `<git-dir>/zoe-runall-measure.lock`); to measure in parallel, copy the repo (`tar`
without `node_modules` · `dist-audit`, then symlink `node_modules`) and run `ZOE_MEASURE_ONLY=1` in the copy.
⛔ A new checker using the emulator or writing/sweeping `.tmp-poison-*` must enter lane `emu`/`excl` in `runall_lane()` —
`runall-runner-test` fails if forgotten. ⛔ `RUNALL_JOBS=1` gives the old serial order (for chasing failures suspected to
come from parallelism).

⛔ **No RTDB emulator ➜ every `emu/*` checker degrades — and `SKIP` is not `PASS`.** ⛔ **Count from the real directory**
(`audit-tools/emu/*-test.js` plus `crud-rules-flow.js`), never remember a number. Degradation has **2 shapes**:
`emu/restore-deadlock` · `emu/ledger-revert` · `emu/license-seat-rules` · `emu/tx-disconnect` · `emu/app-writes-rules` ·
`emu/app-network-e2e` · `emu/supabase-rules-parity` · `emu/supabase-adapter-parity` print **`SKIPPED`**, while
`emu/crud-rules-flow` and `emu/restore-mutation` print **`PARTIAL PASS (3; SKIP …)`** / **`(1; SKIP …)`**. ⛔ The second
shape is more dangerous because it **contains the word `PASS`** while its core assertions (real rules) **never ran**.
The `run-all.sh` summary lists them separately (`… complete, 2 partial, 2 skipped`) ➜ **always read the "partial" and
"skipped" numbers**. Before claiming a green tree, run like CI:

```bash
npm i firebase-tools
npx --no-install firebase setup:emulators:database
setsid nohup java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar \
    --port 9000 --host 127.0.0.1 > /tmp/emu.log 2>&1 < /dev/null &
cp firebase-database.rules.json audit-tools/emu/real.rules.json
curl -s "http://127.0.0.1:9000/.json?ns=x"    # must answer null — otherwise the emulator is dead
CRUD_FLOW_STRICT=1 VERSIONSCOPE_STRICT=1 MONEYGUARD_STRICT=1 SUPABASE_STRICT=1 FBPROVISION_STRICT=1 bash audit-tools/run-all.sh
```

⛔ **The emulator can die when the shell call that started it ends** (later run-alls saw `ECONNREFUSED` ➜ 5 `emu/*`
failed/skipped on a fine tree) ➜ in harnesses with background tasks run `java -jar …` as a long-lived task and `curl`
again **before** run-all. ⛔ `money-guardian-test.js` must run in the measure root (it reads `ZoeW/app.js`) ➜ set
`MONEYGUARD_STRICT=1` on `run-all.sh` ⛔ never run it directly on the repo.

⚠️ **Never stop anything with `pkill -f <pattern>` in this session** — the pattern matches **your own shell's command
line** ➜ **kills the session**. ⛔ Not only `pkill -f firebase-database-emulator`: `pkill -f "node audit-tools"` and
`pkill -f run-all.sh` also killed the shell (exit 144). The rule is **any pattern** appearing in your command. Instead:
let it finish · use `timeout` from the start · or kill a **specific PID** (`ps aux | grep …` then `kill <pid>`) after
verifying it isn't your shell.

## Step 1 — read real code and try scenarios checkers don't cover

Checker results are partial evidence. Read the real code paths, especially `await` points, session switches and late
callbacks, and try behavior:

- **New tool classes** — building a checker for a bug class is the best investment
- **Newly shipped code** — `git log --oneline <last point in this file>..HEAD`
- **Real user reports** (Sentry, videos) — worth far more than guesses

## Step 2 — rules for every test

**Tests extract *real* code from `app.js` into `vm` or run a real browser — never test a copy.** And **prove the test
isn't empty**:

```bash
BASE_REF=origin/main          # or the commit before your change (branches with many unmerged commits)
git fetch origin main
rm -rf /tmp/baseline && mkdir /tmp/baseline
git archive "$BASE_REF" | tar -x -C /tmp/baseline
bash audit-tools/run-all.sh /tmp/baseline   # what *should* fail will show
```

A new test passing on the pre-fix tree catches nothing — rewrite it. *Trap: archive the **pre-fix** tree, not `HEAD`.*
The React tree in the baseline is audit-built automatically by `run-all.sh`. **Mutations must be real** — weak mutations
give fake passes, and **`grep` that the mutation landed in the real file** before believing results.

## Step 3 — before commit

```bash
node --check <edited .js files>
node audit-tools/strip-comments.js
CRUD_FLOW_STRICT=1 VERSIONSCOPE_STRICT=1 MONEYGUARD_STRICT=1 SUPABASE_STRICT=1 FBPROVISION_STRICT=1 bash audit-tools/run-all.sh   # emulator alive (step 0)
git diff "$BASE_REF" -- ZoeW/src ZoeW/public ZoeKeyGen | grep '^-'   # unexplained deletions = regressions
```

Then bump `CACHE_VERSION` and `APP_VERSION` in apps whose shipped code changed and add a section in `docs/HISTORY.md`
part 1. ⛔ `version-check` · `version-bump-scope` · `doc-scope-test` run **inside** `run-all.sh` — ⛔ running them
**directly on the repo** fails falsely ➜ one checker: `M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1)` then
`(cd "$M" && node audit-tools/<x>.js)`.

### ⛔ Impact verification — required at the end of every task (user request)

> The user asked: verify what was changed or deleted, in case it affects something else. ⛔ **Green `run-all.sh` is not
> the answer** — it measures only classes *with a measurer*. These steps found **3** real bugs a fully green suite missed
> (2.28.1).

| # | Question | How |
|---|---|---|
| 1 | **What was deleted?** | `git diff "$BASE_REF" -- <shipped dirs> \| grep '^-'` — ⛔ every line explained (`BASE_REF`: Runbook step 2) |
| 2 | **How much *existing* code was touched?** | `git diff "$BASE_REF" -U3` ➜ separate "new code" from "edits to old code"; real risk is the second group |
| 3 | **Who uses what I changed?** | response shapes · return values · field names ➜ `grep` **every** user and check they read only named fields |
| 4 | **Did behavior change?** | extract the function **before** (`git show "$BASE_REF":<file>`) and **after** into `vm`, run **the same cases** ➜ same results |
| 5 | **Can a new hot-path helper throw?** | run it on bad input (`undefined` · `null` · `NaN` · object · array) — ⛔ a throw at the start of the lookup path kills the feature |
| 6 | **Is it a shared helper?** | `error-reporting.js` · `license-verify.js` ship in **both apps** ➜ editing them bumps **both** (`version-bump-scope` catches it) |

⛔ **Step 4 is the strongest proof**: before/after behavior comparison on the same cases reveals regressions code reading
can't see.

## Harness traps (cost a lot of time repeatedly)

- **`snapshot.val()` must return a deep copy.** Returning a reference aliases memory to the store ➜ edits count twice.
- **State lives in stores (`src/core/state.ts`), not on `window`** ➜ checkers read `window.<field>` **only in the audit
  build** (`expose-globals`) · that bridge loads by dynamic import (async) ➜ wait with `waitAuditBridge()` before reading.
- ⛔ **The `ZoeW/app.js` text view rewrites `<store>.<field>` ➜ `<field>`** ➜ in TS sources never declare a local named
  like a store field (`const fb = firebaseState.fb;` ➜ `const fb = fb;` ➜ TDZ in `vm` · `catch` swallows ➜ checkers
  measure wrong behavior) ➜ `build-audit.mjs` refuses self-referencing declarations. The view starts with `\n` because
  checkers find declarations by `\n<spaces>function X(`.
- **The fake SDK must support `fb.increment()`** (ledger fanout). ⛔ It **should enforce real `.validate`** — "server
  rejects a write" was **never tested** by 123 checkers until 2.25.5.
- **Race tests put the other device's write *between* the read and the write**, not after.
- ⛔ **`.wasm`/new asset in cache ≠ the new SW controls the page** — `install` adds `OPTIONAL_SHELL` after `CORE_SHELL` then
  `skipWaiting()` ➜ `clients.claim()` ➜ measurements needing the new SW wait for empty `installing`/`waiting` **and**
  old caches deleted.
- **`renderHistory` caches per row** (`tr.dataset.sig`) — clear `sig` before performance measurements.
- **Fuzz that triggers cleanup must age stamps *per barcode*, not per parcel** — coverage follows **the level code
  decides at**.
- **An empty `vm` context has no host `setTimeout`** ➜ `withTimeout` throws ReferenceError. A sandbox with
  `setTimeout: (fn) => { fn(); return 0; }` makes ceilings **expire at once** ➜ use
  `(fn, ms) => ms >= 10000 ? setTimeout(fn, ms) : (fn(), 0)`.
- **`Date` in the sandbox must be a real constructor**, not `{ now }` — `sheetImportCellToText()` uses
  `value instanceof Date`.
- **An `extractConst()` that *throws* when not found makes `|| fallback` useless** ➜ the checker crashes on the pre-fix
  tree instead of a named failure.
- ⛔ **Coverage depending on the *environment* is accidental** — e.g. building `.xlsx` **when package `xlsx` is installed**
  and falling back to CSV otherwise ➜ answers change per machine. Write both paths **on purpose**.
- ⚠️ JS `String.replace(from, to)` interprets `$$`/`$&` in `to` ➜ SQL mutations with `$$` silently fail to apply ➜ use
  `replace(from, () => to)`.

## Firebase RTDB emulator (for rules changes)

⛔ **Installing and starting the emulator lives in Runbook step 0 only** — never copy those commands here (rule 12: an
old copy here once ran `java -jar …` in the **foreground**, which **closes the session's shell forever**, and lacked the
`pkill` warning — **the user caught it, not a tool**). Start the emulator per **step 0**, then for rules changes:

```bash
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/rules.sh
```

- CLI `emulators:start` **can't upload rules** through the proxy — run the jar directly (step 0).
- Both `.settings/rules.json` and `auth_variable_override` need `-H "Authorization: Bearer owner"`, else **rules stay
  open and tests pass falsely**.
- A request with `Bearer owner` **but without** `auth_variable_override` = project owner ➜ **bypasses rules**. For
  "unauthenticated is refused" tests, **send no Authorization header**.
- **Assert that a write known to be wrong is really refused** before trusting any result.

---

# ⚠️ Expected error patterns — don't "fix" them

- `"<X> timed out"` — the intentional `withTimeout()` guard. The Error is built **synchronously at the call site** so
  the stack shows the real caller.
- `permission_denied` at `repoRerunTransactionQueue` / on reconnect — offline transactions replayed after auth/rules
  changed.
- `"Daily/Monthly revenue underflow clamped to 0"` — a safety net. Firing **often for the same day/month** signals
  duplicate deduction — the capture itself is not a bug.
- **"⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ!"** — the transaction found the item gone on the server. **Not a bug.** Frequent ➜
  check the device clock.
- **Recorded false positives — don't "fix"**: `ResizeObserver` (`if (window.ResizeObserver)` exists) ·
  `navigator.credentials` (`biometricPlatformAvailable()` plus `try`) · `crypto.subtle` (absent only on non-secure
  contexts where the app **can't run at all**).
- **`waitForZXingThenInitScanEngine()` uses the raw clock** — left on purpose (touches no data or money).
- **All 7 ZoeW `setInterval` timers run while the page is `hidden`** — ⛔ **never add a `document.hidden` gate**: browsers
  already throttle, and a gate risks a **stale customer-table cache when the user returns**. ⚠️ The one exception
  **inside** a cycle: `probeDatabaseLivenessIfIdle()` doesn't probe while `hidden` (pure network round trip; the
  "wake from background" door probes at once on return) — the cycle itself still runs.
- **`revenue-fuzz` doesn't trigger the "7 days + mixed parcel" path** — its safety net is
  `partial-pickup-cleanup-test` ⛔ **never assume `revenue-fuzz` covers it**.
- **ZTO: ⛔ never add a global circuit breaker** — measured: 12 parcels ➜ 12 upstream calls (no duplicates) and
  `ZTO_AUTH_EXPIRED` is already `noRetry`. A breaker would keep a fresh Cookie unused until it expires.

---

# 📌 Pending work — user verification

> ⛔ Keep only what the user **hasn't confirmed yet** or **live decisions**. Confirmed working on real devices ➜ delete
> the item here (the permanent record lives in `docs/HISTORY*.md`).

- ⏳ **Supabase (ZoeW 2.46.0 · ZoeKeyGen 2.23.0) — merged (PR #276) · ✅ owner: "Supabase works"**: manual actions
  (Project · 3 migrations · Admin · Edge Functions + secrets · Netlify env · first shop) in `docs/HISTORY.md` part 1
  [2.46.0] · setup: [`supabase/README.md`](supabase/README.md). ⏳ Test on real iPhone + Android: sign-up · login · scan ·
  offline ➜ reconnect · 2 devices in one shop · forgot password · shop disabled ➜ logout. **Open points** (decide with
  the owner): (1) **Push** bound to the shop account (ZoeW 2.47.1) ➜ ⏳ test on real devices · (2) **Egress Free 5
  GB/month**: the adapter pulls from `cursor=0` on every page load ➜ cache `zoe_docs` in IndexedDB (delta by `seq`) ·
  (3) **Migrate old customer data** Firebase ➜ Supabase: CLI via `public.zoe_admin_write(p_tenant, p_op_id, p_ops,
  p_replace)` (not built yet) · (4) `firebase-loader.js` still loads the Firebase SDK under a Supabase Config (~150 KB) ·
  chunk `supabase-backend` enters the SW shell for everyone.
- ⏳ **ZoeW 2.47.0 · ZoeKeyGen 2.24.0 — merged (PR #277)** — test on real devices: ⚙️ connect (QR image · paste Link ·
  choose Supabase) · "Supabase" toast · live network toast (WiFi off ➜ on ➜ ✅) · new icon (reinstall) · ZoeKeyGen:
  phone tabs · Signing Key expires after 15 minutes (`docs/HISTORY.md` [2.47.0]).
- ⏳ **ZoeW 2.47.1 · ZoeKeyGen 2.24.1 — merged (PR #278)** — test on real devices: Supabase shop ➜ 🔔 enable
  notifications (no Activation Key · 2 phones in one shop get the 8am reminder) · saving a Supabase Config ➜ no login
  dialog flash · ZoeKeyGen: fingerprint/face on Android (Chrome · Google Password Manager) · centered QR + 💾 save QR
  (`docs/HISTORY.md` [2.47.1]).
- ⏳ **ZoeW 2.48.0 · ZoeKeyGen 2.24.2 (branch `claude/focused-brown-3xf7am`: not merged)** — Supabase: ✅ history repaired
  (project `xrobehzmmwjfxwkjysgg`: the first 3 migrations verified on the server — tables · functions · md5 of
  `private.zoe_rules()` equals the repo ➜ recorded in `schema_migrations`) ➜ merge ➜ the integration applies migration
  `20261002000100` (SECURITY DEFINER ➜ schema `private`) + deploys `register`/`reset-password` ➜ Security Advisor keeps
  only "Leaked Password Protection" (Pro). Test on real devices: Reconfig with the same Setup Link ➜ login dialog · switch
  Config Firebase ⇄ Supabase · 🩺 License/ZTO · ZoeKeyGen Key edits on slow internet (`docs/HISTORY.md` [2.48.0]).
- ⏳ **Owner request: "once Supabase is complete, delete unused Firebase files"** — ⛔ **don't delete before every
  condition holds**: Supabase deployed · tested on real devices · data migration CLI (open point 3) · **the last Firebase
  customer migrated** (real money) · owner confirms. Then ⛔ **keep**: `firebase-database.rules.json` (Supabase rules
  source) · License Project/`license-verify.js`/`ZoeKeyGen/firebase-*` (Activation Key · Push · seller notices · ZoeKeyGen
  admin login) · emulators in `audit-tools/emu/*` (parity oracle). **Deletion candidates**: Firebase Config/Login paths in
  ZoeW (`firebase-loader.js` · SDK wrapper · `databaseURL` path) · `firebase-backup/` + `backup.yml` (replaced by
  Supabase backups) · Firebase-only docs in README/guide — each deletion needs impact verification (Runbook step 3), not
  in one round.
- ⏳ **`tools/firebase-provision/`: first run on a real Google account** — the checker runs real `firebase-tools` only
  against a **fake** Google (this session can't call real Google) ➜ owner: `setup.cmd` ➜
  `new-customer.cmd --branch <test branch> --user test` ➜ exit 0 (no `FAIL` · `WARN`) ➜ log into ZoeW with that account.
  Then `new --project-id <id> --branch <branch> --adopt` per existing customer ➜ `deploy-rules.cmd` covers them.
  ⛔ The ZTO Function reads `FIREBASE_PROJECT_IDS` up to `PROJECT_ID_MAX` (beyond ➜ the list feature turns off for all).
- ⏳ **Automatic Release APK** (keystore `CN=ZoeW` · pin `ZoeW/android/release-cert.sha256`) — workflow `Android APK`
  creates no Release until the 4 secrets (`ZoeW/docs/ANDROID.md`) are set **and** GitHub Actions quota returns ➜ **Run
  workflow** by hand. ⛔ Another keystore ➜ the pin step fails ➜ no Release (correct) · ⛔ never create a new keystore.
  Measured (2026-09-29): **0 Releases** · every `Android APK` run failed in ~2s **with no runner** (quota) ➜ not proof the
  secrets are wrong.
- ⏳ **Publish both rules files (ZoeW 2.45.4: nodes expecting objects)** — `firebase-database.rules.json` ➜ Business
  Project · `ZoeKeyGen/firebase-database.rules.json` ➜ License Project (Firebase Console ➜ Realtime Database ➜ Rules ➜
  paste ➜ Publish). Deploy/Publish order doesn't matter (old/new apps never write primitives; 955 real app writes
  replayed on old and new rules ➜ **0 / 0** rejections · `emu/app-writes-rules` locks it every run). After Publish: try
  "កំណត់ទូ Locker" · close/open · remove · restore · ZoeKeyGen create/Extend a Key once.
- ⏳ **2.45.7 (ZoeW): deploy + build a new APK and test the "zombie connection" on a real device** — unplug the router's
  internet cable (WiFi stays) ➜ within ~1 minute the status dot stops being green (or ~25s after a hung scan) ➜ plug back
  ➜ green again by itself + data from other devices arrives · 🩺 Firebase row ❌ when the server doesn't answer.
  ⛔ ZoeKeyGen **doesn't yet have** this liveness probe (admin tool: operations have a 15s ceiling, but the status dot can
  be falsely green the same way).
- ⏳ **2.45.5 (ZoeW) · 2.22.1 (ZoeKeyGen): deploy both sites + build a new APK** — new CSP (`connect-src` +
  `https://www.gstatic.com`) ships with `netlify.toml` in the same deploy · permission `ACCESS_NETWORK_STATE` arrives only
  with the **new APK**. Test on real devices: APK Airplane mode ➜ status becomes "offline" within seconds · Airplane off ➜
  "connected" again at once · 🩺 "internet" row tells the truth · turning Push off on the APK on a bad network ➜ the next
  seller notice **doesn't arrive**. ⛔ Real WebView can't be measured here (no Android SDK).
- ⏳ **2.45.4: the "ខលម្តងទៀត" button blinks 5.5 times then stays red** (instead of blinking forever ➜ the screen can drop
  Hz · saves battery) — the owner should check on a real phone that the signal is clear enough. ⛔ Wanting a permanent
  blink again is the owner's decision (cost: the main thread paints ~60 frames/s while such a row exists) · `perf-check`
  locks it now.
- ⏳ **Automatic backup — postponed by the user on purpose** (⛔ don't nag every round): `backup.yml` backs up nothing until
  secrets `ZOE_BACKUP_TARGETS` · `ZOE_BACKUP_PASSPHRASE` are set ([`firebase-backup/README.md`](firebase-backup/README.md)
  step 6) ➜ Run workflow once ➜ **download the artifact and try a restore** (an untested backup isn't a backup yet) ·
  backups stop silently ➜ check **Actions** first (GitHub pauses schedules after 60 quiet days). ⛔ Measured (2026-09-29):
  scheduled runs #21–#25 failed in ~2s **with no runner** (Actions quota) ➜ **no backup has been created yet**.
- ✅ **Sentry events from test barcodes (`ZTO_UPSTREAM_REJECTED`) — the user decided not to fix** (test parcels not in
  ZTO). ⛔ Never silence it all (hides real ZTO outages) — see the `ZTO_UPSTREAM_REJECTED` core-table row ·
  `lookupReason: ""` in breadcrumbs **is not a bug** (the client reads `reason` only on the `ZTO_CONFIG_INVALID` path).
- ✅ **`ZTO_UPSTREAM_TIMEOUT_MS = 7000` in Netlify env is intentional** (code default `6000` · ZTO answers in 2.1–5.3s in
  production · Cookie read window on cold containers) ➜ a non-`6000` value in `?diag=1` is not a bug. ⛔ Never raise
  `ZTO_REQUEST_BUDGET_MS` to `10000` without re-measuring the client path (an app budget, not a platform ceiling).
- ✅ **Firebase rules of the Business and License projects are Published** (`pickedUpBarcodes` · app code `ZOE` ·
  `maxDevices` · seat slots · new Keys issued · `op` field in daily/monthly ledger · `license_announcements`). ✅ Push
  (VAPID · FCM · `google-services.json`) configured. ⛔ Pickup-stats writes refused ➜ check rules before code (`$other`
  rejects unknown fields) · Activate fails with `seat-unavailable`/"Key នេះមិនមែនសម្រាប់ ZoeW" ➜ check whether it's an old
  Key (`a: 'ADM'`) first.

---

# 📖 References

| Need | File |
|---|---|
| **Rules to follow** | **this file** (`CLAUDE.md`) |
| **Prompt for the next audit round** (techniques · harness traps · what measurement rejected) | [`docs/AUDIT-PROMPT.md`](docs/AUDIT-PROMPT.md) |
| Why a rule exists · measured numbers · mutation results | [`docs/HISTORY.md`](docs/HISTORY.md) **part 2** (React era) · [`docs/HISTORY-ARCHIVE.md`](docs/HISTORY-ARCHIVE.md) **part 2** (vanilla era) |
| **Find a checker's explanation** | [`docs/HISTORY.md`](docs/HISTORY.md) **🔎 index** at the end (covers both history files) |
| ZoeW ≤ 2.37.3 · versions before 2.20.0 · text removed or condensed from `CLAUDE.md` | [`docs/HISTORY-ARCHIVE.md`](docs/HISTORY-ARCHIVE.md) **parts 1 · 3 · 4 · 5** · the previous Khmer `CLAUDE.md` in git history |
| "Actions to do by hand" of any version · what users see differently | [`docs/HISTORY.md`](docs/HISTORY.md) **part 1** |
| How to use each app and tool | that directory's `README.md` |
| Checker list and what each measures | [`audit-tools/README.md`](audit-tools/README.md) |
| ZTO Lookup setup | [`ZoeW/ZTO-SETUP-KH.md`](ZoeW/ZTO-SETUP-KH.md) |
