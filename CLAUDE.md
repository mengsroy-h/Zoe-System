# Zoe-System

> ## ⚡ START HERE — ស្ថានភាពបច្ចុប្បន្ន (2026-08-19)
>
> ការងារចុងក្រោយនៅលើ branch **`claude/deep-audit-bug-fixes-90pmhb`** (ជុំ audit ទី៦ + គោលការណ៍ លុប/ដក
> + ការបិទចំណុចដែលនៅសល់)។ Branch នេះមាន `...-7f6izx` ទាំងស្រុងនៅក្នុងវា (fast-forward) បូកបន្ថែម
> ២ commit ថ្មី។ Push រួចរាល់ · working tree ស្អាត · គ្មានអ្វីកែពាក់កណ្តាល · **មិនទាន់ merge ចូល `main`**
> (ម្ចាស់គម្រោងគ្រប់គ្រងពេលណាកូដទៅដល់ production ដោយខ្លួនឯង)។
>
> **ត្រូវការសកម្មភាពដោយដៃ (មនុស្ស មិនមែន Claude) — នៅសល់តែប៉ុណ្ណេះ:**
> 1. Publish `firebase-database.rules.json` (root) — Console របស់អាជីវកម្មនីមួយៗ
> 2. Publish `ZoeKeyGen/firebase-database.rules.json` — Console ZoeKeyGen
>
> ដរាបណាមិន publish ៣ យ៉ាងខាងក្រោមមិនទាន់មានប្រសិទ្ធភាព (App នៅដំណើរការធម្មតា):
> scanner បង្កើត barcode មិនបាន · ZoeW ធ្វើ 8-day *partial* cleanup បាន · `license_keys` លែងអានបាន
> ជាសាធារណៈត្រង់ node មេ។
>
> **គ្មានចំណុចណាត្រូវការការសម្រេចទៀតទេ។** រឿង 8-day partial cleanup សម្រេចរួច (បន្ធូរ per-barcode
> lock សម្រាប់ `worker` — មូលហេតុពេញលេញនៅ section **"Follow-up session"** ខាងក្រោម)។
>
> **មុននឹងចាប់ផ្តើម audit ជុំក្រោយ:** រត់ `node audit-tools/extract.js /tmp/fns` (រក divergence រវាង
> ZoeAdmin/ZoeW) និង `node audit-tools/policy-test.js` (ផ្ទៀងផ្ទាត់គោលការណ៍ លុប/ដក)។ សម្រាប់ rules
> រត់ emulator រួច `bash audit-tools/emu/real.sh` និង `bash audit-tools/emu/partial-claim.sh`។ មើល
> `audit-tools/README.md`។ លម្អិតពេញលេញនៅ section **"Sixth deep-audit pass"** ខាងក្រោម។


4 independent PWAs (vanilla JS, no framework, no build step), each deployed as its own
Netlify site, sharing ONE Sentry project distinguished by the `app` tag:

- **ZoeAdmin** (`app: zoeadmin`) — full admin: add/edit/delete parcels, stats, PDF/Excel export
- **ZoeW** (`app: zoew`) — worker: scan, close/open bills, edit phone, view stats. Cannot add new parcels.
- **Zoescan** (`app: zoescan`) — scanner only: assigns barcodes to lockers. Cannot add/delete parcels.
- **ZoeKeyGen** (`app: zoekeygen`) — standalone activation-key generator/admin tool for the
  other 3 apps. Uses a completely separate Firebase project from the other 3 (business data).

ZoeAdmin/ZoeW/Zoescan share a single Firebase Realtime Database (business data) but each
app's `app.js` is a **separate file with independently duplicated logic** — a fix in one
app's function does not automatically apply to the same-named function in another app.
Always check whether a bug/fix applies to just one app or needs mirroring across siblings.

## Project status (verify before assuming this is still current)

**UPDATE 2026-08-19: this project is now LIVE — real customers are actively using it.** The
user confirmed this explicitly while reviewing PR #5 (`claude/deep-audit-final-8lur4w`) and
asked to merge that PR themselves rather than have it merged automatically, specifically
because of the risk of disrupting live customer usage. **The pre-launch "safe to auto-fix
non-trivial revenue/data-integrity bugs directly" exception described below no longer
applies as of this update** — treat this system as carrying real money and real customer
data from now on. Revenue/data-integrity fixes should go back to being proposed for human
review rather than auto-applied (see point 5 under "When triaging a Sentry report" below,
without the pre-launch exception). Do not merge PRs into `main` unless explicitly asked to —
the user wants to control exactly when changes reach production.

(Historical note, no longer operative: as of 2026-08-18 this project was believed not yet
deployed for real users, which was the basis for a looser default of fixing some
revenue/data-integrity bugs directly rather than only proposing them. That exception is
superseded by the update above. This never extended to the core Delete-vs-Remove business
logic itself in any case — that's deliberate policy, not a bug, regardless of launch status.)

## Core business rule: "លុប" (Delete) vs "ដក" (Remove) — READ BEFORE TOUCHING REVENUE CODE

This is a deliberate business rule, not a bug, and gets misdiagnosed as one easily:

- **លុប / Delete** = deleting an entire parcel (all its barcodes). Must **never** affect
  `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod` stats, in any direction,
  ever — not on delete, not on restore-from-trash, not on repeated delete/restore cycles.
  Idempotent by design.
- **ដក / Remove** = removing a single barcode from a parcel that has multiple barcodes
  (or the automatic 8-day stale-open-item cleanup). This **does** subtract that barcode's
  cod/dod value from revenue stats at the moment of removal, and **must** add it back on
  restore-from-trash, and subtract it again if removed again. Tracked via a per-barcode
  `isDeducted: true/false` flag that must flip correctly at each step.

If revenue numbers behave unexpectedly, first determine which of these two flows is
involved (check for the `isFromDeletion` flag and whether the trash item has 1 barcode vs
the full original set) before proposing a fix.

All timestamps that feed retention/revenue decisions (`createdAt`, `closedAt`, `deletedAt`,
`lockerUpdatedAt`, and the "now" used to compare against them) are computed via
`getServerNow()` in each app (`Date.now() + serverTimeOffsetMs`, where the offset is kept
live from Firebase's `.info/serverTimeOffset`), not raw `Date.now()` — a wrong device clock
must not be able to skew the 2h/8d/10d windows or misdate revenue. Purely local/cosmetic
timers (PIN lockout, ID generation salt, scan-debounce, "recent" UI badges, script-load
retry deadlines) intentionally still use raw `Date.now()` — don't "fix" those too, they
don't need server sync and `getServerNow()` isn't even in scope at the point some of them
run (e.g. before Firebase has initialized).

`license-verify.js` (shared, byte-identical across all 4 apps) has its **own separate**
`getServerNow()`/`serverTimeOffsetMs` — it cannot use each app's SDK-based
`.info/serverTimeOffset` listener because it's REST-only (plain `fetch`, no Firebase SDK
access, by design — it's the shared module ZoeAdmin/ZoeW/Zoescan/ZoeKeyGen all load
identically). Instead it reads the standard HTTP `Date` response header on every request it
already makes (`checkOnline()`), and exposes `syncServerTime()` (a lightweight fetch whose
only purpose is capturing that header) for callers that don't naturally trigger a request
early — ZoeKeyGen calls it at startup so key `issuedAt`/`expiresAt` (the values baked into
the cryptographically signed key payload itself, via `signNewKey()`) aren't wrong from
the admin's own device clock, which can never be corrected after the fact once signed.
ZoeAdmin/ZoeW/Zoescan also call it at startup for a warm cache, though their own
`ensureAppActivated()` → `getStatus()` → `checkOnline()` flow would self-correct it anyway
on first use. If you touch `license-verify.js`, copy the change identically to all 4
apps' copies (`cp` + `md5sum` to confirm byte-identical) — don't hand-edit each one.

**Lesson from auditing this**: grepping only `Date.now()` missed real spots — also check
`new Date()` (no args, same meaning). Missed on the first pass: `getFormattedDate(d = new
Date())`'s default parameter (used implicitly as "today" by callers throughout both apps)
and `addOrUpdateEntry()`'s `const now = new Date()` (ZoeAdmin — sets the scanDate a new
parcel's revenue gets bucketed under). Only caught via a second, wider-search pass after
being asked to re-check. When auditing this class of bug again, also grep the *shared*
`license-verify.js` and `ZoeKeyGen/app.js`, not just the 3 business apps — easy to forget
since ZoeKeyGen doesn't participate in the retention/revenue system, but it still
independently writes clock-dependent timestamps (key issuedAt/expiresAt).

Retention/auto-cleanup windows (do not change without being asked): closed parcels
auto-move to trash after 2 hours; still-open parcels after 8 days; anything in trash is
permanently purged after 10 days.

When auditing for raw device-time usage, grep for **both** `Date.now()` and `new Date()`
(no arguments) — they mean the same "current device time" but a search for only the first
form misses real ones. This bit us once: `getFormattedDate(d = new Date())`'s default
parameter (used implicitly as "today" by callers all over both apps) and
`addOrUpdateEntry()`'s `const now = new Date()` (ZoeAdmin — sets the scanDate a new parcel's
revenue gets bucketed under) were both missed on the first pass and only caught by asking
"check again, in case something wasn't fixed" and re-auditing with the wider search.

## Persistent daily pickup-count stat (implemented 2026-08-18)

The "អតិថិជនយក" (Customers Picked Up) stat card (`index.html` id `todayClosedCount`) used
to be a live count derived from `scanHistory` (`filteredList.filter(isClosed).length`), so
it silently *decreased* as closed items aged past the 2-hour auto-cleanup and moved to
trash. Fixed the same way revenue already solves this structural gap: a Firebase-persisted
per-day node, `zoew_daily_pickup_cod_dod/{date}`, written via
`addPickupToDailyRecord()`/`commitDailyPickupDelta()` (mirrors
`addRevenueToDailyAndMonthlyRecord()`/`commitDailyRevenueDelta()`'s `runTransaction` +
clamp-to-0 pattern; no monthly bucket, only the daily stat card needed this). A second
line, `todayPackagesPickedUpCount`, sits under the customer count in the same stat card in
both `ZoeAdmin/index.html` and `ZoeW/index.html`.

**Two different identities, tracked two different ways** (per user's explicit correction on
2026-08-18 — the first version incorrectly tied both to whole-order completion):
- **Customer** = unique **phone number** for the day, not "1 per closed order." Node shape:
  `pickedUpPhones: { [phoneKey]: refCount }`, where `refCount` is how many *currently-closed*
  orders reference that phone today; the displayed count is `Object.keys(pickedUpPhones)
  .length` (`countPickedUpCustomers()`), never a stored scalar, so multiple orders under the
  same phone closing/reopening independently can never double-count or prematurely zero out
  — the phone only drops out once its last closed order is reopened. Items with no phone
  logged (`phone === "គ្មានលេខ"`) each count as their own separate customer (confirmed with
  user) via a per-item fallback key (`getPickupPhoneKey()`: `'__item_' + id`) rather than
  collapsing onto one shared bucket.
- **Package** = each individual **barcode**, counted the instant *that barcode* transitions
  open→closed, independent of whether the rest of its order is done — not batched with the
  order's other barcodes. So if a customer picks up 1 of their 2 packages, that 1 is counted
  immediately even though the order (and therefore the customer) isn't "done" yet.

Increment/decrement hooks live in `toggleCloseStatus(id)` and
`toggleIndividualBarcodeClose(itemId, barcodeCode)` in **both** `ZoeAdmin/app.js` and
`ZoeW/app.js`. `toggleIndividualBarcodeClose` always applies exactly ±1 package (this
barcode's own transition, unconditional since `desiredClosed` is always the toggle's
opposite) and only a customer ref-delta when the whole order's `isClosed` crosses the
fully-closed boundary. `toggleCloseStatus` (whole-order close/reopen) diffs each barcode's
*previous* state against the new one and only counts barcodes that actually transition —
this matters because it can be invoked on an order where some barcodes were already closed
individually, and double-counting those would be wrong. Both revert the exact applied delta
in the existing revert-on-Firebase-failure catch block. `claimAndCleanupItem()`'s automatic
2h/8d sweep was deliberately left untouched — it never calls the toggle functions, so it
can't move this counter, same as revenue's `'close'` reason already didn't. Explicitly
re-opening a closed item **does** decrement (confirmed with user, symmetric with revenue's
"explicit corrections adjust, automatic cleanup never does" precedent). Deleting (លុប) or
restoring a closed item does not touch this counter either, for the same reason it doesn't
touch revenue — delete/restore never calls the toggle functions.

**Known, intentionally-uncounted edge case (confirmed with user 2026-08-18):** if the *last*
open barcode in a multi-barcode order goes stale and gets auto-abandoned after 8 days
(`claimAndCleanupItem(id, 'abandon')`), the remainder's `isClosed` flips to `true` as a side
effect of that transaction — but since this flip never passes through the toggle functions,
none of the already-closed barcodes in that order retroactively add to the customer count
if they hadn't already (they may well have already counted their own package delta
individually, per the per-barcode rule above — only the *customer* half of this specific
transition is what's skipped). Confirmed intentional: an uncollected barcode in this
scenario gets physically returned to the central branch, so its abandonment isn't a pickup
event and correctly follows "automatic cleanup never touches this stat."

**Known unfixed edge case (not raised by user, noted for awareness):** the customer ref-delta
on reopen re-derives the phone key from the item's *current* `phone` field
(`getPickupPhoneKey(freshItem)`). If a phone number is edited (`saveEditedPhone()`) between
an order being closed and later reopened, the reopen's decrement lands on the *new* phone's
bucket, not the one actually incremented at close time — leaving a stale +1 on the old phone
and an erroneous (harmlessly clamped) decrement on the new one. Narrow, rare sequence; not
fixed since it wasn't asked for and correctly fixing it means snapshotting the phoneKey used
at close time onto the item itself, a bigger change than today's scope.

**Firebase rules gotcha hit while building this:** the root rules doc is default-deny
(`.read: false, .write: false`), and `firebase-database.rules.json` in this repo is **not
deployed automatically** — Netlify only serves the static app files; the rules JSON must be
manually pasted into Firebase Console → Realtime Database → Rules → Publish. Shipping the
`zoew_daily_pickup_cod_dod` client code without a matching rule block caused every
read/write to fail with `permission_denied` in production (confirmed via a live Sentry
breadcrumb) until the rule was added and manually published. When adding any new Firebase
path, add its rule in the same change and flag to the user that it needs manual publishing
— don't assume the schema-code and the rules are deployed together.

## Error patterns that are EXPECTED / already handled — do not "fix" these

- `Role check timed out`, `Activation timed out`, or any `"<X> timed out"` message —
  deliberate `withTimeout()` guards (15-20s) around Firebase reads. Already caught with a
  user-facing toast and a safe fallback (sign-out / retry prompt). Firing under a slow
  connection is expected, not a crash. Each `withTimeout()` constructs its Error
  synchronously at the call site (not inside the timeout callback) specifically so the
  stack trace shows the real caller — don't "simplify" that back, it was a real bug.
- `permission_denied` during `repoRerunTransactionQueue` / on reconnect — a queued offline
  transaction being replayed after the auth session or rules state changed. Already caught
  with a `.catch()` + toast.
- `"Daily/Monthly revenue underflow clamped to 0"` — a deliberate diagnostic capture (not a
  crash) that fires when a transaction would compute a negative value; the safety net
  working as designed. If it fires *repeatedly* for the same date/month, that's a real
  signal of a double-subtraction bug upstream (see Delete vs Remove above) — but the
  capture itself is not the bug.

## Known past bug classes (already fixed — watch for reintroductions or similar patterns)

- **Firebase ref used before init**: `initDatabaseListeners()` in each app must guard every
  `onValue(dbRefX, ...)` call with `if (dbRefX)`. A re-init cycle (Firebase config re-saved)
  tears down and recreates the app/db without nulling the old ref variables, so an unguarded
  call can hit a stale/deleted ref (`TypeError: Cannot read properties of undefined
  (reading '_repo')`).
- **Whole-list diff-and-save racing a live listener**: never resync a Firebase node by
  diffing a full in-memory array against `lastSyncedKeys` and writing the whole object back
  — a live `onValue` listener on that same path can refresh the in-memory array mid-flight
  and silently undo the diff. Use a targeted single-key write (`update(ref, {[id]: value})`
  or `{[id]: null}` to delete) instead.
- **jsPDF cannot shape Khmer script**: it maps codepoints to glyphs via the font's cmap with
  no OpenType shaping, so coeng-stacked subscript consonants and pre-base vowels render
  broken regardless of font. PDF export now uses browser print-to-PDF (render HTML into a
  hidden print-only container, call `window.print()`) instead — the browser's own text
  engine handles Khmer correctly. Don't reintroduce jsPDF for Khmer text.
- **Mobile `onclick=` attributes can silently fail to fire** on some WebView/Chrome builds —
  confirmed via a real-device screen recording (native tap ripple appeared, handler never
  ran). Activation-key submit buttons now also bind via `addEventListener('click', ...)` as
  a backup alongside the inline `onclick=`.
- **Zoescan's CSP `script-src` lacks `'unsafe-inline'`**, unlike the other 3 apps — any bare
  `onclick=` attribute added to Zoescan's HTML is silently dead on some browsers. Always pair
  a new Zoescan `onclick=` with an `addEventListener('click', ...)` backup (already done for
  the activation-modal buttons). Re-check this asymmetry specifically before adding any new
  inline handler to Zoescan — it's a structural difference from the other 3 apps' CSP, not a
  one-off fix, so it will keep being relevant.
- **Firebase multi-step writes aren't atomic — compensate, don't assume**: RTDB's
  `runTransaction` (needed for cross-device conflict safety) and multi-path `update()` can't
  be combined into one atomic operation. Established pattern: apply local/optimistic state
  first, fire the Firebase write, and on failure reverse the exact applied delta in the
  `.catch()` (revenue via `addRevenueToDailyAndMonthlyRecord` with negated values, pickup-stat
  via `addPickupToDailyRecord` with negated deltas). `retryAsync(fn, attempts, delayMs)` (near
  `withTimeout`) adds retry-with-backoff before giving up — used for `claimAndCleanupItem`'s
  trash write (4 attempts, ZoeAdmin+ZoeW) and ZoeKeyGen's `appPaths` corrective tag write (3
  attempts). When a compensable write can leave local-only state behind if retries are
  exhausted (e.g. an optimistically `unshift`-ed trash item with no matching Firebase write),
  the exhausted-retry `.catch` must also undo *that* local mutation, not just reverse the
  revenue/stat delta — missed on `claimAndCleanupItem` in both ZoeAdmin and ZoeW until a
  2026-08-18 follow-up audit caught it (the parcel record briefly existed only in memory,
  then vanished silently on next resync, even though revenue was correctly reversed).
- **Restore-from-trash must be one atomic multi-path write**: `executeRestoreItem`'s
  history-write + trash-delete uses one `fb.update(fb.ref(db), {two top-level paths})` call
  rather than two separate writes/`Promise.all` — avoids double-applying the revenue add-back
  if the first write succeeds and a second, separate write fails on retry.
- **`isClosed` must be recomputed after any `barcodes[]` mutation, not just at
  create/toggle-time**: any code path that adds/removes barcodes from an item's `barcodes[]`
  array (not just the explicit toggle functions) must recompute `item.isClosed =
  barcodes.length > 0 && barcodes.every(b => b.isClosed)` and set/clear `closedAt` to match.
  `executeRestoreItem`'s restore-merge already did this; `removeSingleBarcode` (ZoeAdmin) did
  not, until a 2026-08-18 follow-up audit found it — an item could get stuck permanently
  misclassified as "open" if its last remaining barcode(s) happened to already be
  individually closed, breaking the 2h/8d retention classification and silently skipping
  pickup-stat credit. If you add a new `barcodes[]` mutation path, recompute `isClosed`
  there too — but do NOT pair it with a pickup-stat credit call
  (`addPickupToDailyRecord`), since that crediting is deliberately scoped only to the
  explicit toggle functions (`toggleCloseStatus`/`toggleIndividualBarcodeClose`), matching
  how the restore-merge path already doesn't credit it either.
- **ZoeKeyGen ALL-scope key generation is not all-or-nothing**: `generateLicenseKey()`
  writes the key to 3 separate Firebase paths (one per target app) in parallel; if some
  succeed and some fail, a corrective follow-up write tags the surviving records with
  `appPaths` so the key list can show accurate per-app coverage. That corrective write now
  retries (`retryAsync`, 3 attempts) and captures to Sentry + warns the operator if it still
  fails — it used to be a silent one-shot `.catch(() => {})`. Left unfixed, a failed tag
  write let `renderKeyList()` wrongly assume full 3-app coverage (its
  `scope === 'ALL' ? [3 apps] : [scope]` fallback only trusts a partial-coverage signal when
  `appPaths` was actually recorded) and let `toggleRevokeKey`/`confirmExtendKey` write to
  paths that never had a real key record — Firebase RTDB `update()` on a nonexistent path
  silently creates a sparse node there instead of erroring. `renderKeyList()` now also shows
  a persistent ⚠️ badge (with a tooltip listing which apps are actually covered) whenever
  `appPaths` is present and shorter than 3, so partial coverage stays visible after a reload,
  not just in the one-time generation-time alert.

## Style conventions

- JS source in `app.js`/`license-verify.js` is kept **comment-free** by deliberate
  convention (see commit `a6aa840`). If you add explanatory comments while working, strip
  them before finishing — parse with `acorn`, remove exact comment byte ranges, then
  re-tokenize and diff token-for-token against the original to confirm the code itself is
  unchanged before committing.
- `license-verify.js` is byte-identical across all 4 apps by design (embeds the shared
  public key + verification logic). Keep it that way if you touch it in one app.
- Every service worker's `CACHE_VERSION` follows `<app>-vN` and its cache-cleanup filter
  only ever deletes keys starting with its own `<app>-` prefix — never broaden that filter,
  it's what keeps one app's service worker from wiping another app's cache if they ever end
  up sharing an origin.

## When triaging a Sentry report

1. Check the `app` tag first — confirms which of the 4 apps/files to look in.
2. Read breadcrumbs for the real user action sequence, not just the final error.
3. If it touches revenue (`addRevenueToDailyAndMonthlyRecord`, `isDeducted`,
   `commitDailyRevenueDelta`, `commitMonthlyRevenueDelta`), re-read Delete vs Remove above
   before proposing a change.
4. If a near-identical function exists in a sibling app (ZoeAdmin/ZoeW especially), check
   whether that sibling already solved the same problem correctly — copy its pattern rather
   than inventing a new one. There's also an old reference copy of ZoeAdmin/ZoeW the user can
   provide on request, from before recent changes, useful for confirming intended behavior.
5. This system tracks real money (COD/DOD revenue) — prefer a suggested fix for human
   review over auto-applying anything non-trivial (see "Project status" above for the
   current pre-launch exception to this default, and re-verify it still applies).

## Final deep-audit pass (2026-08-19, branch `claude/deep-audit-final-8lur4w`) — handoff notes

Requested as a last audit round before full deployment. Ran 5 parallel research agents (one per
app plus one cross-cutting infra/rules pass), each instructed to check the known bug classes
above and hunt for new ones, then triaged and fixed the findings directly (pre-launch exception
applies; nothing here touches the Delete-vs-Remove policy itself). **If resuming in a new
session: everything below is already committed on this branch — check `git log` on it before
redoing anything.**

### Fixed
- **ZoeAdmin `clearHistory()` ("Delete All") had zero snapshot/revert** — could permanently wipe
  the whole dataset with no trash backup if the trash-save write failed after the history-clear
  write succeeded (highest blast-radius finding of the audit). Now snapshots both arrays and does
  one atomic multi-path `fb.update(fb.ref(db), {...})`, reverting on failure. Same atomic-write
  pattern also applied to `removeSingleBarcode` and `deleteSingleItem` (previously two independent
  `Promise.all`-raced writes that could partially fail while the UI claimed a full revert).
  `removeSingleBarcode` also now re-fetches the item/barcode index fresh after the blocking
  `confirm()` dialog (mirrors `toggleCloseStatus`'s existing pattern). Dead helper functions
  (`deleteSingleHistoryItemFromFirebase`, `saveMultipleDeletedItemsToFirebase`) removed since the
  refactor made them unused.
- **Zoescan `assignLockerToEntry()` read the live global `activeLocker` instead of a value
  snapshotted at call time** — across two `await`s (up to 12s each), a worker switching lockers
  mid-write could get the wrong locker recorded, and the primary write vs. the
  `zoew_scan_history_cod_dod` mirror write could each land a *different* locker value for the same
  barcode. Fixed by capturing `const targetLocker = activeLocker` once up front. Mirror-update
  failure now also retries via a newly-added `retryAsync` (matching the pattern used elsewhere in
  the codebase) instead of failing after one attempt.
- **Zoescan locker occupancy warning added** (per explicit user request during this session) —
  scanning a barcode into a locker that already holds a different *open* barcode now warns
  symmetrically to the existing "barcode already has a different locker" warning, via the same
  `locationWarningModal`/`pendingLocationCode` confirm flow. Closed/picked-up occupants don't
  trigger it (`isEntryBarcodeClosed` check) since they no longer physically occupy the locker.
- **ZoeKeyGen `firebase-database.rules.json`** (its own, separate-project rules file) was missing
  an `appPaths` field in the `$keyId` schema; `$other: false` meant the corrective partial-failure
  tagging write in `generateLicenseKey()` — and the ⚠️ partial-coverage badge in `renderKeyList()`
  that depends on it — was **permanently, deterministically rejected**, not just occasionally
  failing. Added an `appPaths` validation block. **Needs manual publish in Firebase Console** (this
  repo's rules JSON is never auto-deployed — see the "Firebase rules gotcha" note above).
- **ZoeKeyGen stored-XSS → signing-key exfiltration path**: `renderKeyList()` built
  `onclick="toggleRevokeKey('${escapeHtml(row.id)}')"` — HTML-entity escaping does not make a
  string safe inside an `on*=` attribute (the browser HTML-decodes before parsing it as JS), so a
  compromised admin-role account (without the separately-held signing private key) could plant a
  crafted Firebase key-id and run JS in another admin's session, reading `signingPrivateKeyJwk`
  out of memory/sessionStorage. Fixed by switching to `data-key-id`/`data-action` attributes plus a
  single delegated `addEventListener('click', ...)` on `#keyListBody`.
- **`license-verify.js` `getStatus()`** computed `now` *before* `checkOnline()` refreshed the
  server-time offset, so the very first status check after a fresh page load could misjudge
  expiry/offline-grace using the raw (uncorrected) device clock. Moved the `getServerNow()` call to
  after `checkOnline()` resolves. Propagated identically to all 4 apps' copies (`cp` + `md5sum`
  confirmed — all four still hash to `04d2db7b8977a12c3ddd76542ddba684`).
- **ZoeKeyGen `loadSigningKey()`** accepted any structurally-valid EC P-256 private key without
  checking it actually pairs with the public key baked into `license-verify.js` — a stale/wrong
  key would show "Loaded ✓" and every key issued with it would silently fail verification
  everywhere. Now calls `window.ZoeLicense.verifyKeyString()` on the smoke-test-signed key and
  rejects the load if it doesn't verify.
- **ZoeAdmin `netlify.toml` CSP `connect-src`** used a bare `https:` scheme-wildcard (any HTTPS
  host reachable) instead of an explicit allowlist like the other 3 apps. Narrowed to the same
  Firebase/Sentry hosts plus `script.google.com`/`*.googleusercontent.com` (needed for the
  Google Sheets/Apps Script lookup feature).
- **Root `firebase-database.rules.json` worker-role hardening (safe subset only — see below)**:
  `zoew_scan_history_cod_dod/$itemId/barcodes/$idx/{cod,dod}` and
  `zoew_recently_deleted_cod_dod/$itemId/{cod,dod}` (top-level and nested `barcodes/$idx/{cod,dod}`)
  were writable by `worker` at any time with zero protection — a worker could inflate/deflate a
  barcode's cod/dod value before triggering a remove/restore to fabricate revenue deltas. Tightened
  to the same "`admin` OR not-yet-existing OR unchanged" pattern already used elsewhere in this
  same rules file for other admin-locked fields (not a new pattern — just extended to two fields
  that had been missed). Verified safe by tracing every legitimate ZoeW write path for these exact
  fields (none exist — ZoeW only ever *sums* per-barcode cod/dod into aggregates, never writes a
  fresh value into an existing barcode's own cod/dod). **Also needs manual publish in Firebase
  Console.**
- Small: ZoeAdmin/ZoeKeyGen README staleness (missing Excel/CSV export + Customer Data Table
  view; misleading "LICENSE_DB_URL is a placeholder" wording when it's actually already filled
  in — see open question below); unhandled-rejection `.catch(() => {})` added to
  `runAutomaticDeletedCleanup`'s purge call.

### Explicitly NOT fixed (deliberate scope decisions, made together with the user this session)
- **Worker role can still write arbitrary absolute values directly to
  `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod` / `zoew_daily_pickup_cod_dod`**,
  and can still create brand-new `zoew_scan_history_cod_dod`/`zoew_recently_deleted_cod_dod`
  entries. Investigated a full lockdown ("workers can only update, never create") but it would
  break ZoeW's real, reachable "restore from trash" feature (`executeRestoreItem`'s create-new-entry
  branch is the *common* restore case, not an edge case). Deeper still: revenue/pickup nodes are
  updated via client-computed read-modify-write transactions, so no declarative rule can verify a
  delta's *history* is honest — that fundamentally requires a trusted server (Cloud Functions),
  which this project doesn't have (static Netlify + client-direct Firebase RTDB, no backend). User
  chose "safe subset only" — see fixed items above for what that covered. Revisit if/when a backend
  trust boundary is ever added.
- Firebase RTDB emulator testing was attempted (to verify rules changes empirically rather than by
  hand) but blocked: `firebase-tools` needs `firebase-public.firebaseio.com`, which this session's
  network egress policy rejected with 403. Per that policy's own instructions, did not attempt to
  route around it. **The rules changes above were reasoned through manually and cross-checked
  against every actual write call site in the app code, but were never run against a live
  Firebase project or the Rules Playground — verify there before/after publishing.**
- Minor/low-priority findings noted but not applied (pick up later if useful): ZoeW has a dead
  `saveSingleHistoryItemToFirebase` function (harmless, unused); ZoeKeyGen's `toggleRevokeKey`/
  `confirmExtendKey` trust the client-side path cache without an existence check before writing;
  ZoeKeyGen's signing-key PIN minimum is only 6 characters; Zoescan's "barcode not found" toast can
  theoretically fire in the first instant before the Firebase listener's initial payload arrives.

### Open question for the user
`ZoeKeyGen/license-verify.js`'s `LICENSE_DB_URL` constant (byte-identical across all 4 apps) is
hardcoded to `https://zoew-z1-default-rtdb.firebaseio.com` — but ZoeKeyGen is supposed to use a
**separate** Firebase project (`zoe-license` per the README's setup instructions), not ZoeW's
business database. The hostname strongly resembles "ZoeW," which is suspicious, though if it were
actually wrong, Online Revoke/Extend checks would already be visibly broken for everyone (not a
silent failure) — which argues it's probably fine, just an oddly-named project. **Please confirm
this is genuinely the dedicated `zoe-license` project's URL and not a mixed-up copy of ZoeW's
business DB URL** — README updated to flag this for verification either way.

### Three remaining items closed on request
- **The pickup-stat phone-edit gap** (open since 2026-08-18, listed as "known unfixed edge case" above).
  Editing the phone of an order that is *already closed* now moves its `pickedUpPhones` ref from the old
  key to the new one, so the later reopen's −1 lands on the bucket that was actually incremented. Fixed at
  the moment of the edit rather than by snapshotting the key onto the item, deliberately: the item schema
  in `firebase-database.rules.json` ends with `$other: { ".validate": false }`, so a new field would be
  rejected until the rules were published — a deploy-ordering hazard with two publishes already pending.
  Moving the ref needs no schema change and is equally correct across devices, since the pickup node is
  shared and the move is written immediately. `patchHistoryItemFields` now resolves `true`/`false` instead
  of `undefined` so the caller can undo the move when the write fails; existing callers ignore the value.
- **ZoeW's dead `saveSingleHistoryItemToFirebase`** removed. It is genuinely dead in ZoeW only — ZoeAdmin
  has three live call sites and keeps its copy.
- The `applyCurrentFilter()` conversion described above.

`CACHE_VERSION` bumped (zoeadmin-v33, zoew-v30).

### Not yet done as of this handoff
- Nothing critical is mid-edit. All changes described above are complete, syntax-checked
  (`node --check` on every modified `.js`, JSON-validated on both rules files), and either
  committed or about to be committed in the same push as this note.
- Two rules files changed this session (`firebase-database.rules.json` at repo root, and
  `ZoeKeyGen/firebase-database.rules.json`) both need **manual publishing** in their respective
  Firebase Consoles — this repo's rules JSON is never auto-deployed by Netlify.

## Second deep-audit pass (2026-08-19, branch `claude/deep-audit-cleanup-n4bar6`) — handoff notes

Requested explicitly as a confirmatory **final** round, after PR #6 (`claude/customer-table-timeout-x3sc9v`,
landed on top of the first "final" audit above) showed that round hadn't actually been the last word —
the user asked to re-confirm nothing else was left, plus a repo-wide comment-cleanup check. Ran 5 parallel
research agents again (one per app, plus one cross-cutting infra pass), each re-checking every bug class
listed above for regressions and independently hunting for anything new, with explicit extra scrutiny on
the 5 commits that had landed since the first "final" audit and were never part of a dedicated review
(`d7924f9`..`49137a4`: the customer-table fetch dedup fix, and the two-stage PWA auto-update rewrite that
added then fully removed a forced-reload/write-guard mechanism in favor of "apply on next natural launch").
Agents were research-only (no edits); findings were triaged and safe ones applied directly in this same
session — none of this round touched Delete-vs-Remove, retention-window semantics, or any live revenue math.

**Comment-cleanup check (the second half of this round's request):** re-verified byte-for-byte that every
`app.js`/`license-verify.js` across all 4 apps is still comment-free (grepped `//`/`/*` excluding
string/regex-literal false positives — zero real comments found). Also found and fixed something the prior
round's cleanup missed: **`ZoeKeyGen/app.js` had 7 spots of leftover blank-line cruft** (up to 9 consecutive
blank lines in one place) — dead whitespace left behind where explanatory comments used to sit, from the
`a6aa840`/`bbbff1d` comment-strip passes, never trimmed afterward. Collapsed to single blank lines matching
the rest of the codebase's spacing; confirmed via `git log -p` on each spot that this was leftover cruft,
not intentional spacing, before touching it.

### Fixed (safe, non-revenue, applied directly)
- **ZoeAdmin `customerDataTableFetchPromise` dedup guard had a real gap**: the in-flight-promise guard added
  in `d7924f9` was checked before the promise was assigned, with an `await decryptLookupSecret(...)` in
  between when a header-secret lookup config is used — a second caller landing in that window could still
  start a duplicate fetch, and each duplicate's `finally` nulled the *shared* flag. Fixed by moving the whole
  header-building/decrypt step inside the async IIFE, so the guard assignment is synchronous with no gap.
- **ZoeAdmin auto-focus regression when lookup is enabled but misses**: `triggerScanAction()` only skipped
  the phone-input auto-focus when the lookup API was *disabled* — when it was enabled but a barcode simply
  had no match (cache miss, 404, timeout), the phone field was never focused at all, forcing a manual tap
  every time. Now focuses the phone field once the lookup settles, only if it's still empty and the same
  scan is still pending (guards against stealing focus from an autoSubmit-closed modal or a superseded scan).
- **`withTimeout()`'s timer-leak fix (landed in ZoeAdmin only, in `d7924f9`) mirrored to ZoeW, Zoescan,
  ZoeKeyGen** — each app's independently-duplicated `withTimeout` now also captures and clears its internal
  `setTimeout` once the wrapped promise settles, instead of leaving a dangling timer alive for the rest of
  the timeout window on every call that resolves early.
- **`waitForFirebaseSDK()`'s timeout `Error` now constructed synchronously at the call site in all 4 apps**
  — it was being built inside the `setTimeout` callback in all 4 (ZoeAdmin/ZoeW/ZoeKeyGen shared one shape,
  Zoescan a slightly different one), the exact same stack-trace-losing class of bug `withTimeout()` itself
  was fixed for in commit `4e03a3a` — every "Firebase SDK failed to load" Sentry report was collapsing to
  the same one-line stack with no caller info. This helper was apparently missed when that fix was applied.
- **ZoeW `executeRestoreItem` now preserves `callMark`/`callMarkTime`/`isCalled` on merge-restore**, mirroring
  ZoeAdmin's already-reviewed fix (from the first "final" audit round) that ZoeW's independently-duplicated
  copy of this function never received — confirmed via `git log -S` this logic never existed in ZoeW at any
  point. Without it, a call-mark ("no answer" etc.) silently vanished if the marked order later got merged
  back in from a restore, in ZoeW only.
- **Zoescan `findLockerOccupant()` false-positive-warned on every barcode of a multi-barcode order sharing a
  locker with its own sibling** — it only excluded the scanned barcode's own code, not the item/order it
  belongs to, so scanning the 2nd+ barcode of the same order into the same locker (the exact use case
  `barcodes[]` exists for) triggered the occupancy-warning modal every time. Now also excludes entries
  belonging to the same `itemId`.
- **Zoescan camera didn't auto-resume after backgrounding if a modal was open at the time**: the
  `visibilitychange` handler unconditionally cleared `cameraStoppedByVisibility` on resume, even when a
  modal (e.g. the locker-occupancy warning above) was blocking the immediate resume — once the modal later
  closed, nothing re-armed the camera. Now the flag survives while a modal is open, and `closeModal()`
  resumes the camera once the last modal closes, if it's still pending.
- Small Sentry-observability nits: two Zoescan `ZoeErrors.capture()` calls and one ZoeKeyGen call had empty
  `context: ''` (now `'assignLockerToEntry'`, `'initFirebase bootstrap'`, `'refreshKeyList'`); Zoescan's
  `requestCameraPermission()` catch didn't report unrecognized `getUserMedia` error types at all (only the
  3 known ones got a friendly toast) — now captures those too.
- **ZoeKeyGen**: the freshly-generated private key left in the "Generate New Keypair" modal's textarea
  survived closing the modal via Cancel or backdrop-click (only a subsequent generate/page-reload cleared
  it), contradicting the modal's own "will be lost forever" copy. `closeModal('keypairModal')` now clears
  it; the backdrop-click handler was switched to call `closeModal()` instead of toggling the CSS class
  directly, so both dismiss paths get the same cleanup.
- Doc nits: 3 READMEs (ZoeAdmin/ZoeW/Zoescan) described a forced-reload "update complete" toast that
  commit `96038fa` had already removed — updated to describe the actual apply-on-next-launch behavior.
  Zoescan's recovery toast quoted a ZoeAdmin button label ("Sync Scanner Lookup") that doesn't literally
  exist — corrected to the real label. ZoeKeyGen's README referenced a singular `PUBLIC_KEY_JWK` where the
  actual constant is the array `PUBLIC_KEYS_JWK`.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v12, zoew-v11, zoescan-v11, zoekeygen-v5) since all 4
  `app.js` got real behavior changes above. **No Firebase rules files were touched this round — nothing
  from this round needs manual publishing.**

### Initially proposed, then explicitly authorized by the user and implemented in the same session
The 6 items below were first written up as proposals (not applied), per this project's live-production
policy of not auto-applying revenue/data-integrity/high-blast-radius changes. The user's response was
"fix all 6, it's fine" — an explicit override for this specific batch — so all 6 were then implemented
directly in this same session. Recording both the original reasoning and what was actually built, since
items 2 and 3 involved real judgment calls worth understanding if something looks off later.

1. **[HIGH, FIXED] `claimAndCleanupItem`'s trash-write could permanently lose a parcel if retries were
   exhausted** (ZoeAdmin + ZoeW, identical gap in both). The Firebase transaction that removes/strips the
   item from `zoew_scan_history_cod_dod` commits *first*; only afterward does it try to save the removed
   data into `zoew_recently_deleted_cod_dod` via `retryAsync` (4 attempts, ~22.5s). If all 4 failed, the
   failure handler already correctly reversed the revenue delta and the optimistic local trash entry, but
   never wrote the removed data back to `zoew_scan_history_cod_dod` — the parcel was gone from both places.
   **Fix**: added `restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial)` in both apps — on
   exhausted trash-write retries, it runs a *second* `runTransaction` on the original item ref that either
   restores the whole claimed item (merging with whatever's there now, in case of concurrent changes) or
   merges the reclaimed stale-open barcodes back into the current remainder (partial-claim case), stripping
   `isDeducted` off them since they're live again, not in trash. Wrapped in `retryAsync` (3 attempts) too.
   If *that* also fails, there's no further automated recovery — captures to Sentry with full context and
   shows a `showToast` (not a blocking `alert`, since this fires from an unattended background sweep) telling
   staff to check the item manually. Also changed the outer `retryAsync(...).catch()` from fire-and-forget to
   `await`ed, so `cleanupInFlight` now stays held for the whole compensating chain (closes a pre-existing
   window where a second automatic sweep could re-enter the same item mid-recovery).
2. **[MEDIUM-HIGH, FIXED — judgment call] ZoeW reset `createdAt` on restoring a still-open item; ZoeAdmin
   never did.** Reasoned through rather than guessed: both apps already reset `closedAt` on restoring a
   *closed* item, deliberately giving it a fresh window before the 2h auto-cleanup can re-claim it — it would
   be inconsistent for the open-item case not to get the same treatment, and *not* resetting `createdAt` means
   an item restored from the 8-day stale-open ("ដក") trash flow (which by definition already has an
   `createdAt` older than 8 days) would almost immediately get re-flagged as stale and auto-abandoned again on
   the very next cleanup pass — defeating the entire point of a human choosing to restore it. **Fix**: mirrored
   ZoeW's `else { itemToRestore.createdAt = getServerNow(); }` into ZoeAdmin's `executeRestoreItem`, so both
   apps now always give a restored item (open or closed) a fresh retention clock as of restore time. If this
   isn't actually the intended behavior, flag it — it was a reasoned choice, not a certainty.
3. **[MEDIUM, FIXED] ZoeKeyGen's `license_keys` public-read node exposed more than intended** — `note`
   (free-text, README used to suggest employee names/locations) and `createdBy` (issuing admin's email) were
   stored at the same path any of the 3 business apps' end-user devices fetch unauthenticated on every routine
   license check. **Fix**: split the schema. `license_keys/{appCode}/{keyId}` now holds only `{expiresAt,
   revoked}` (all `checkOnline()` ever reads) and stays public-read. A new node, `license_keys_meta/{appCode}
   /{keyId}`, holds `{issuedAt, scope, note, createdBy, appPaths}` and is admin-read/write only. Updated
   `ZoeKeyGen/firebase-database.rules.json` accordingly (**needs manual publish — see below**),
   `generateLicenseKey()` now writes both nodes atomically per target app via one multi-path `fb.update()`
   (so the verification record and its metadata can never split), and `refreshKeyList()` now reads and merges
   both nodes. **Cannot migrate already-existing keys' data from this environment** (no live Firebase access,
   git-only session) — added a one-time "🔒 Migrate PII ចាស់" button in the Key List card
   (`migrateLegacyLicenseKeyMetadata()` in `ZoeKeyGen/app.js`) that the admin runs themselves, once, *after*
   publishing the new rules: it reads every existing `license_keys` record, copies any legacy `note`/
   `createdBy`/`issuedAt`/`scope`/`appPaths` fields into `license_keys_meta`, and nulls them out of the public
   node in one atomic multi-path update. README updated to describe the split and point at the button.
4. **[MEDIUM-HIGH narrow, FIXED — resolved as a side effect of #3] ZoeKeyGen's partial-ALL-coverage badge
   could fail to show in exactly the case it exists for** — `refreshKeyList()`'s old dedup picked whichever
   app-bucket (ADM→ZOW→SCN, fixed order) was iterated first that contained a given key ID, with a
   scope-derived fallback that silently assumed full 3-app coverage whenever `appPaths` was missing. The
   rewrite for #3 (reading `license_keys` per app-bucket to merge with the new meta node) naturally derives
   real coverage from the *true* union of buckets where the key actually, verifiably exists — `paths` is now
   always accurate regardless of whether the `appPaths` corrective tag ever landed. `renderKeyList()`'s badge
   condition was switched from checking `row.appPaths` to checking `row.paths`, so the badge can no longer
   silently fail to show due to a missing tag.
5. **[design decision, FIXED] All 4 apps lost their only "update available" signal when the PWA forced-reload
   mechanism was fully removed in `96038fa`.** **Fix**: added a passive, non-forcing update banner to all 4
   apps (`showUpdateAvailableBanner()`, same shape in each) — a fixed bottom bar with a "Refresh ឥឡូវនេះ"
   button and a dismiss "✕", built via plain DOM APIs with inline styles (no HTML/CSS file changes needed).
   Wired to `navigator.serviceWorker`'s `controllerchange` event, gated on `hadControllerAtLoad` (captured
   once per page load, before the listener attaches) so it only fires for a genuine mid-session update — not
   for the very first `controllerchange` a brand-new install fires when its service worker first takes
   control (there being no "update," just an initial claim, in that case). No auto-reload; the user decides
   when to refresh, same as the "apply on next natural launch" model already in place.
6. **[LOW, FIXED] ZoeKeyGen `generateLicenseKey()`'s 25s timeout didn't cancel the underlying `retryAsync`
   writes** — true cancellation isn't practical (the Firebase JS SDK has no abort support for RTDB writes), so
   the fix instead closes the *silent* half of the problem: the write promise is now captured before racing it
   against the timeout, and if the timeout fires first, a background `.then()` on that same promise is armed
   (via a `generateAlreadyTimedOut` flag) to show a toast and call `refreshKeyList()` if the writes eventually
   land anyway — so an admin who retried after a false "timed out" now finds out if the original attempt also
   succeeded, instead of a silent duplicate key with no explanation.

### Not yet done as of this handoff
All fixes above (both the original 16 and these 6) are committed, `node --check`-clean on every modified
`.js`, JSON-validated on both rules files, and comment-free grep re-verified repo-wide. `CACHE_VERSION` was
bumped a second time in all 4 `sw.js` (zoeadmin-v13, zoew-v12, zoescan-v12, zoekeygen-v6) to cover this
second batch of behavior changes. Nothing is mid-edit.

**RESOLVED 2026-08-19 (confirmed by user):** `ZoeKeyGen/firebase-database.rules.json`'s `license_keys_meta`
node has been manually published in the Firebase Console, and the one-time "🔒 Migrate PII ចាស់" button in
ZoeKeyGen's Key List card has been run successfully — user confirmed both the "✅ បាន Migrate Key ចំនួន X
ដោយជោគជ័យ!" success toast and, directly in the Firebase Console, that migrated `note`/`createdBy`/etc. now
live under `license_keys_meta` rather than the public `license_keys` path. All outstanding items from the
second audit round are now fully closed out. No other rules files changed this round.

## Third deep-audit pass (2026-08-19, branch `claude/deep-audit-final-tkeqbq`) — handoff notes

Requested as another confirmatory round after commit `184157f` ("Harden logout data-clearing across all 4
apps for shared-device use") landed on top of the second audit round without a dedicated review of its own.
Ran 5 parallel research agents again (one per app plus one cross-cutting infra pass), each re-checking every
bug class listed above for regressions and independently hunting for anything new, with explicit extra
scrutiny on `184157f` specifically. Agents were research-only (no edits); findings were triaged and applied
directly in this same session — all of them were completeness gaps in the shared-device logout hardening
itself, none touched Delete-vs-Remove, retention-window semantics, or live revenue math, so none required
the propose-first live-production exception.

### Fixed
- **Zoescan: camera could stay on indefinitely after logout (the most severe finding this round).**
  `forceExpireSession()` (the 4h auto-logout) never called `stopScanner()` — it just signed out — so an
  actively-scanning camera kept running completely unattended after a forced session expiry, decode loop and
  all. Separately, `184157f`'s new bulk modal-close loop in the sign-out branch could re-trigger `closeModal()`'s
  pre-existing "resume camera if the last modal just closed" side effect when a modal happened to be open at
  logout time (e.g. after backgrounding mid-scan with `locationWarningModal` up), turning the camera back on
  right after logging out. Fixed at the source: the sign-out branch of `onAuthStateChanged` now sets
  `cameraStoppedByVisibility = false` and calls `stopScanner()` unconditionally, before the modal bulk-close
  loop runs — covers both the forced-expiry gap and the modal-reopen side effect in one place.
- **ZoeAdmin/ZoeW: modal fields kept sensitive data in the live DOM after logout, only hidden via `display:
  none`.** `openViewListModal`, `openCallMarkModal`, `openEditBarcodePriceModal`, and the edit-phone flow all
  write phone numbers/barcode lists/prices directly into specific elements (`innerText`/`innerHTML`/`value`),
  and `closeModal()` never blanked them — so after logout on a shared device, the previous user's data was
  still readable via DevTools even though nothing was visible on screen. Added `clearSensitiveModalFields()`
  to both apps (called from `showLoginModalWithPrefill()`, so it fires on every sign-out path: explicit
  logout, 4h forced expiry, role-check failure) that blanks every known sensitive field plus the search boxes
  (`searchPhoneInput`, `hwScannerInput`, `customerDataTableSearchInput` in ZoeAdmin) and resets the stale
  `pendingRestoreId`/`pendingPermanentDeleteId`/`activeParentItemId` variables that the generic bulk-close
  loop doesn't reach (those are only nulled by the `data-close`-attributed cancel handlers, not by
  `closeModal()` itself).
- **All 4 apps: the just-typed login password was left sitting in the password input's DOM `value` after a
  login attempt**, retrievable via devtools or a "reveal password" control by whoever uses the device next.
  Now cleared in a `finally` block after every login attempt (success or failure) in ZoeAdmin, ZoeW, Zoescan,
  and ZoeKeyGen alike.
- **ZoeAdmin's customer-table fetch and ZoeKeyGen's key-list fetch could survive logout and silently
  repopulate the "cleared" cache/DOM** — two agents independently flagged the same race shape: `clearCustomer
  DataTableCache()`/`showLoginModalWithPrefill()`'s cache-clear didn't cancel an in-flight fetch, so a slow
  request (up to 15s) that was already running at logout time would resolve afterward and write its result
  back into the in-memory cache and visible table — worse for ZoeAdmin specifically, since it also refreshed
  `customerDataTableFetchedAt`, making the *next* login's fetch think the stale data was still fresh and skip
  re-fetching entirely. Fixed with a session-generation counter in both apps
  (`customerDataTableSessionGeneration` / `keyListSessionGeneration`, incremented on every clear): each fetch
  captures the generation at start and checks it before writing back results, so a stale fetch's response is
  silently discarded instead of clobbering a newer session's state.
- **ZoeKeyGen: duplicate "Signing Key cleared from memory" toast on role-check failure/timeout** (pre-existing,
  not introduced by `184157f`, purely cosmetic) — `verifyAdminRoleThenProceed`'s two failure branches called
  `fb.signOut(auth)` (which itself triggers `onAuthStateChanged(null)` → `showLoginModalWithPrefill()`) and
  then called `showLoginModalWithPrefill()` a second time explicitly right after. Removed the redundant
  explicit calls; the centralized `onAuthStateChanged` handler already covers it, matching the pattern
  ZoeAdmin/ZoeW already use (their equivalent double-call is harmless there since nothing in their version of
  `showLoginModalWithPrefill()` shows a toast, so it was never visibly a bug in those two apps — left as-is).
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v15, zoew-v14, zoescan-v14, zoekeygen-v8). **No Firebase
  rules files were touched this round — nothing from this round needs manual publishing.**

### Explicitly not auto-decided (flagged for the user, not fixed)
- **ZoeKeyGen: an involuntary logout (role-check timeout/failure, session expiry) silently destroys an
  unsaved, not-yet-copied private key with no distinct warning.** `showLoginModalWithPrefill()` force-closes
  every modal including `keypairModal`, whose `closeModal()` special-case wipes the generated-key textarea —
  correct behavior for the deliberate Cancel/backdrop-click case it was built for in the second audit round,
  but it now also fires silently on every *involuntary* auth-null transition, and only the unrelated "Signing
  Key cleared from memory" toast fires, not anything naming the lost key. This is a real security-vs-UX
  trade-off (arguably the right call given how catastrophic a leaked signing key would be) rather than a
  clear-cut bug, so it wasn't decided unilaterally — if a distinct warning or a "copy before this closes"
  confirmation is wanted, that's a product decision for the user to make.

### Not yet done as of this handoff
All fixes above are committed, `node --check`-clean on every modified `.js`, and comment-free grep
re-verified repo-wide. Nothing is mid-edit. No rules-file changes this round, so no manual-publish step is
needed from this round itself.

This round's PR (#9) was merged to `main` at the user's explicit request in this session.

**Second audit round's outstanding items are now fully resolved (confirmed 2026-08-19):** the
`license_keys_meta` rule was published in the Firebase Console, and the user ran "🔒 Migrate PII ចាស់" —
confirmed via the "✅ បាន Migrate Key ចំនួន X ដោយជោគជ័យ!" success toast and by inspecting the raw Firebase
data directly, where migrated `note`/`createdBy`/etc. now correctly live under `license_keys_meta` instead of
the public `license_keys` path. (Along the way, the user initially thought the migration hadn't worked
because the ZoeKeyGen Key List page still displayed note/email normally after clicking — that's expected,
not a bug: `refreshKeyList()` merges `license_keys` + `license_keys_meta` for the admin's own display
regardless of which node the data physically lives in, so the page was never going to visibly change. Worth
remembering if this same confusion comes up again after a future PII-handling change.) Nothing is
outstanding from either the second or third audit round as of this handoff.

## Fourth deep-audit pass (2026-08-19, branch `claude/detailed-audit-d0k07u`) — handoff notes

Requested by the user as one more meticulous, whole-project pass ("audit as thoroughly as possible, in
case anything isn't right — this is the final audit round before going public to 200-300 users") before
public rollout. Branch started exactly at `main` (commit `4a8e04e`), no carry-over from a prior unmerged
branch. Ran 5 parallel research-only agents again (one per app plus one cross-cutting infra/rules pass),
each re-checking every bug class documented above for regressions and independently hunting for anything
new, with explicit extra scrutiny on two ZoeAdmin commits that landed after the third round closed out and
were never reviewed on their own: `8b2293d` (customer-lookup timeout/retry hardening) and `4a8e04e`
(customer-lookup cooldown/TTL hardening, PR #12). Findings were triaged and safe ones applied directly in
this same session; nothing here touches Delete-vs-Remove, retention-window semantics, revenue transaction
math, or any Firebase rules file — so nothing from this round needs a manual rules publish.

### Fixed (safe, non-revenue, applied directly)
- **ZoeAdmin `attemptAutoLookup()`'s failure/success cooldown state had no session-generation guard**
  (`app.js`), unlike the sibling `fetchCustomerDataTableRows()` which already had one from a prior round.
  A per-barcode lookup that was still in flight (up to ~31.5s: 15s timeout + 1.5s backoff + 15s timeout)
  when a logout happened could write `autoLookupLastFailedAt` or fill stale lookup data into the phone
  modal for whichever *new* session was now active. Captured `myGeneration = customerDataTableSessionGeneration`
  at call start and guard both the success (data-fill) and failure (cooldown-write) branches on it, mirroring
  the existing pattern.
- **ZoeAdmin `clearSensitiveModalFields()` was missing `phoneModal`'s and `manualAdjustModal`'s fields** —
  the single most-used modal in the app (every new-parcel scan goes through `phoneModal`) left the last
  customer's phone number and COD/DOD amounts sitting in raw DOM `value` attributes after logout on a shared
  device, inspectable via DevTools, since `closeModal()` only does `display:none` and neither the modal's
  success path (`confirmPhone()`) nor logout ever blanked the inputs. Same threat model the third round's
  logout-hardening work was written to close for every *other* modal — this one was missed. Added
  `modalPhoneInput`, `modalLockerInput`, `modalCodInput`, `modalDodInput` (customer-facing) and
  `manualDateInput`, `manualCodChangeInput`, `manualDodChangeInput`, `manualCountChangeInput`
  (revenue-adjustment entry, lower sensitivity but same gap) to the blank-list.
- **ZoeAdmin/ZoeW: header auth button (`navAuthBtn`) never flipped to the "logout" state when a license was
  activated *after* login**, only when it was already active at login time — `updateAuthButton(true)` was
  called from `verifyWorkerRoleThenProceed`/its ZoeAdmin equivalent but never from `submitActivationKey()`'s
  success path in either app. A worker/admin who logged in with an expired license, then entered a valid
  activation key, ended up fully authenticated (scanning etc. all worked) but the header button still read
  "🔑 ចូល" and re-opened the login form instead of logging out. Added `updateAuthButton(true)` to both apps'
  `submitActivationKey()` success branch. UI-state only, no security impact (the session genuinely was valid).
- **ZoeAdmin PDF/print export footer timestamp used raw `new Date()` instead of `getServerNow()`**
  (`app.js`, the "នាំចេញនៅ" / "Exported at" line) — the only "now" display in the whole file that didn't,
  inconsistent with the other three. Cosmetic only (doesn't feed retention/revenue logic), fixed for
  consistency.
- **Zoescan: a rejected/invalid activation key was left sitting in the textarea**, only the success path
  cleared it. Low sensitivity (activation keys are meant to be shared over Telegram, not a real credential),
  but consistent with the shared-device-hardening theme — now cleared on the invalid-result path too.
- **ZoeKeyGen: a freshly-generated license key stayed visible (plaintext, with a working Copy button) in
  `#genResultBox` after logout**, readable and copyable by the next admin who logs into the same browser
  tab without a page reload — same bug class as the third round's `clearSensitiveModalFields()` work, just
  never extended to ZoeKeyGen's key-generation result box (a plain `&lt;div&gt;`, not a `.modal`, so the
  existing bulk modal-close sweep never touched it). `showLoginModalWithPrefill()` now also resets
  `lastGeneratedKey = ''` and blanks/hides `#genResultKey`/`#genResultBox`.
- **ZoeKeyGen `generateLicenseKey()`'s background timeout-recovery handler (the `writePromise.then(...)`
  that fires when a client-perceived-as-timed-out write actually lands late) had no session-generation
  guard**, unlike `refreshKeyList()` itself. If the original admin logged out and a second admin logged in
  within the ~25s+ window before the late write resolved, the second admin would see a toast naming the
  first admin's key ID/app-scope and an unrequested key-list refresh. Narrow, information-disclosure-only
  (key ID + app labels, not the signed key string), but same fix pattern as everywhere else — added a
  `myGeneration` check before acting.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v18, zoew-v15, zoescan-v15, zoekeygen-v9) since all 4
  `app.js` got real behavior changes above.

### Initially flagged for the user, then explicitly authorized and implemented in the same session
Two items were first written up as proposals rather than auto-fixed, since one is revenue/pickup-stat-commit
code and the other is physical-locker-assignment correctness — both categories this project's live-production
policy says should go to human review rather than being silently patched. The user's response was "ចំណុច 2
កែចុះ" (fix both), so both were implemented directly in this same session, immediately after the two items
above were first reported.

1. **[FIXED] Zoescan: client-side eventual-consistency race in the locker-occupancy warning.**
   `findLockerOccupant()` only consulted the local `barcodeIndex`, rebuilt exclusively from a debounced
   (120ms) Firebase `onValue` snapshot on `zoew_scanner_lookup` — nothing optimistically patched it right
   after a successful `assignLockerToEntry()` write, so scanning a second, different order into the same
   locker within that round-trip window produced no warning. **Fix**: `assignLockerToEntry()` now patches
   the matched `barcodeIndex` entry's `item` object in place (`.locker`/`.lockerUpdatedAt`/`.lockerUpdatedBy`,
   handling both the multi-barcode `barcodes[idx]` shape and the single-barcode/legacy shape) immediately
   after the primary `zoew_scanner_lookup` transaction commits, before the mirror-write step. Because
   `barcodeIndex[code].item` is the exact same object reference `historyData[itemId]` holds (not a copy),
   this closes the race for scans on the *same* device/session — the very next scan sees the just-assigned
   locker without waiting for the listener. This is safe even if a concurrent listener refresh replaced
   `barcodeIndex` mid-`await` (the patch would then land on an orphaned object no longer referenced by the
   live index — a harmless no-op, not a corruption risk). **Does not and cannot fully close the cross-device
   half of the race** — two different physical Zoescan sessions scanning into the same locker at the same
   instant still isn't something any client-side patch can prevent; that would need a server-side lock
   (Cloud Functions), which this project doesn't have. Reduces the practical window from "up to a few
   seconds, every scan" down to "only truly simultaneous scans from two different devices" — a real
   improvement, not a full close.
2. **[FIXED] ZoeAdmin/ZoeW: optimistic local revenue/pickup-stat caches weren't reverted on an outright
   `runTransaction` rejection** (as opposed to succeeding-but-clamped-to-0, which was already handled).
   `commitDailyRevenueDelta`/`commitMonthlyRevenueDelta`/`commitDailyPickupDelta`'s `.catch()` blocks now
   negate the exact delta back onto `dailyRevenueData[scanDateStr]`/`monthlyRevenueData[ymKey]`/
   `dailyPickupData[scanDateStr]` (same clamp-to-0 pattern as the forward path), then `commitDailyRevenueDelta`
   and `commitDailyPickupDelta` also call `applyCurrentFilter()` to refresh the always-visible summary stat
   cards immediately (monthly has no persistent on-screen display — it's read fresh from
   `monthlyRevenueData` whenever its modal is opened, so no explicit re-render call is needed there).
   **Race-safety**: each `commit*Delta` function captures `const recordRef = xData[key]` synchronously at
   its own start (before the `await`-yielding `fb.runTransaction` call), and the revert in `.catch()` only
   applies `if (xData[key] === recordRef)` — object-identity-checked. This matters because `dailyRevenueData`/
   `monthlyRevenueData`/`dailyPickupData` are each wholesale-replaced (not mutated) whenever their Firebase
   `onValue` listener fires; if a listener delivered a fresh authoritative snapshot while our failed
   transaction was still in flight, that snapshot already reflects reality (our delta never committed
   server-side), so blindly re-subtracting on top of it would double-count the failure. The identity check
   makes the revert a no-op in that case instead of a new bug — implemented this way specifically to avoid
   introducing the double-subtraction failure mode this project has repeatedly flagged as the thing to watch
   for around revenue math. Applied identically to both ZoeAdmin and ZoeW (byte-for-byte-mirrored logic, per
   this project's usual pattern for shared-shape functions across the two apps).

### Not yet done as of this handoff
All fixes above (both the original batch and these 2 follow-ups) are committed, `node --check`-clean on
every modified `.js`, and comment-free grep re-verified on every changed line. Nothing is mid-edit. No
Firebase rules files were touched this round, so no manual-publish step is needed. `CACHE_VERSION` was bumped
a second time in ZoeAdmin/ZoeW/Zoescan's `sw.js` (zoeadmin-v19, zoew-v16, zoescan-v16) to cover this follow-up
batch; ZoeKeyGen's `sw.js` was untouched this round (stays at zoekeygen-v9) since neither follow-up item
touches ZoeKeyGen.

This round's PR (#13) was merged to `main` at the user's explicit request in this session.

**RESOLVED 2026-08-19 (confirmed by user):** the long-open question about `license-verify.js`'s
`LICENSE_DB_URL` (`https://zoew-z1-default-rtdb.firebaseio.com`, byte-identical across all 4 apps) possibly
being a mixed-up copy of ZoeW's business DB URL — first flagged in the very first audit round, carried
forward unresolved through all four rounds since — is now closed. The user checked the Firebase Console
directly and confirmed it matches the dedicated `zoe-license`-equivalent project actually used for
license/activation data, not ZoeW's business database. The "zoew-z1" naming was just a misleading label, not
a real mix-up. No code or config change needed; nothing outstanding from this thread remains.

## Setup Link — Firebase Config provisioning helper (added 2026-08-19)

Added at the user's request after clarifying the deployment model: this system is not distributed as
source/self-hosted per client — the vendor (user) personally provisions a separate Firebase project per
client business and personally configures every one of that business's devices with a `zoew_firebase_config`
pointing at it. With 200-300 client businesses, manually pasting Config JSON into every single device was
identified as the biggest operational bottleneck (bigger than any code bug found in four audit rounds).

- **ZoeKeyGen** (vendor-only tool, never given to clients) gained a "🔗 បង្កើត Setup Link" card: paste a
  business's Firebase Config JSON once, pick which of the 3 business apps + its deployed Base URL (remembered
  per-app in `localStorage` for reuse across future links), and it produces a link shaped like
  `https://<app-site>/?setup=<base64-encoded-config>` plus a "Copy Link" button.
- **ZoeAdmin/ZoeW/Zoescan** each gained `applySetupLinkFromUrl()`, called once on boot (before
  `initFirebase()`, mirroring the existing `zoew_firebase_config`/`saveFirebaseConfig()` pattern in each app)
  — decodes the `?setup=` param, shows a native `confirm()` naming the target `projectId` before saving
  anything, writes to the same `zoew_firebase_config` localStorage key the manual Config modal already uses,
  and always strips the query string via `history.replaceState` immediately regardless of whether the user
  confirms or cancels, so the encoded config never lingers in the address bar/browser history.
- Firebase client config (`apiKey`/`databaseURL`/etc.) is not treated as a secret anywhere else in this
  codebase (protection is server-side Rules, not secrecy — same reasoning already applied to the existing
  plain-textarea Config modal), so embedding it in a URL introduces no new class of risk versus the status
  quo; the new card's own copy still tells the vendor to send the link privately (e.g. Telegram) rather than
  posting it publicly, consistent with how activation keys are already handled.
- **QR code generation was requested alongside the link.** Initially not implemented because this session's
  network egress policy rejects `unpkg.com` (confirmed via `$HTTPS_PROXY/__agentproxy/status`, showing a
  `connect_rejected`/403 for that host) — the same class of block noted in the first audit round's Firebase
  emulator-testing attempt — and a hand-written QR encoder was deliberately avoided rather than risk shipping
  a subtly-broken one with no way to test-scan it in this environment. **Resolved in the same session**: the
  user's first paste came from the exact `unpkg.com/qrcode-generator@1.4.4` URL originally suggested in
  chat — confirmed by downloading the real v1.4.4 npm tarball for comparison, which matched byte-for-byte
  except one line (`renderTo2dContext()`'s `fillRect` had `row`/`col` swapped, a genuine bug in that old
  version, fixed upstream by v2.0.4 — corrected here to match the current release). The user then ran
  `npm install qrcode-generator@2.0.4` themselves and uploaded the actual installed
  `node_modules/qrcode-generator/dist/qrcode.js` file directly, which was copied in as the final
  `ZoeKeyGen/qrcode.js` — **verified byte-for-byte identical (`diff`, zero output) against the real
  `qrcode-generator@2.0.4` tarball downloaded from `registry.npmjs.org` for comparison** (Kazuhiko Arase, MIT
  license — `registry.npmjs.org` is in this session's `noProxy` allowlist, so it was reachable directly even
  though `unpkg.com` is not). Loaded via a plain same-origin `<script src="./qrcode.js">` tag — no CDN, no
  CSP change needed. `generateSetupLink()` now also renders the
  link into a scannable QR (via `qrcode(0, 'M').createSvgTag(...)`, inline SVG into
  `#setupLinkQrContainer`, wrapped in try/catch so a failure degrades to link-only rather than breaking
  generation), and `showLoginModalWithPrefill()` clears the QR container on logout alongside the other
  Setup Link fields. Added to the service worker's `APP_SHELL` precache list and `CACHE_VERSION` bumped
  again (zoekeygen-v11). Note: `qrcode.js` is third-party vendored code, kept as-is including its own
  comments — the project's comment-free convention applies only to this codebase's own `app.js`/
  `license-verify.js`, not to vendored libraries.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v20, zoew-v17, zoescan-v17, zoekeygen-v11).

This round's PR (#15) was merged to `main` at the user's explicit request in this session.

## Firebase Backup Tool (added 2026-08-19)

Added at the user's request as a follow-up to the "what's missing before public launch" discussion — the
biggest unaddressed data-safety gap identified was that Firebase RTDB has no backup at all; losing a
client business's project (account issue, accidental deletion, quota problem) would be unrecoverable.

- New top-level `firebase-backup/` directory, **not part of any of the 4 deployed apps** — a standalone
  Node.js CLI tool the vendor runs themselves (locally or via a scheduled task), using `firebase-admin`
  with a per-business service account key (bypasses RTDB rules entirely, unlike the client SDK — the
  correct approach for a trusted, vendor-only backup script).
- `backup.js` reads `config.json` (gitignored, never committed — contains real business names +
  paths to real service-account key files) listing one entry per business (name, service account path,
  database URL), does a full root (`/`) export per business, gzips it to
  `backups/<business>/<ISO-timestamp>.json.gz`, and prunes older backups beyond `keepCount` (default 30).
  One business failing (bad credentials, missing file, network error) doesn't stop the others — each is
  independently try/caught and reported; the process exits non-zero only if *any* failed, so a scheduled
  task can alert on it.
- `config.example.json` is the committed template; `config.json`, `firebase-backup/secrets/` (where the
  downloaded service-account JSON keys go), and `firebase-backup/backups/` (the output) are all in
  `.gitignore` — service account keys are genuine credentials (unlike the client-side Firebase config used
  elsewhere in this project, which is intentionally not secret), so they must never be committed.
- **Verified working this session**: ran `npm install` (167 packages, no vulnerabilities), confirmed the
  missing-config error path, confirmed per-business failure isolation with a fake config (one missing file
  + one malformed service-account key — both failed independently with clear messages, exit code 1,
  neither crashed the process), and independently verified the gzip write/read round-trip and the
  prune-to-`keepCount` rotation logic with a standalone test (5 fake dated backups → correctly kept only
  the newest 3). **Not verified against a real Firebase project** — no live project/service-account key
  available in this session; the vendor should do one real end-to-end run after setup.
- README (`firebase-backup/README.md`, in Khmer) covers: getting a service-account key from the Firebase
  Console, `config.json` setup, manual run, Windows Task Scheduler + cron scheduling instructions, and a
  documented-but-not-built manual restore procedure (restore is deliberately not a one-command script,
  since it can overwrite live data — the README gives the few lines of code needed, for a human to run
  deliberately when actually needed).
- Root `.gitignore` updated: `node_modules/`, `firebase-backup/config.json`, `firebase-backup/secrets/`,
  `firebase-backup/backups/`, `firebase-backup/backup.log`.
- Does not touch any of the 4 apps, Firebase rules, or CACHE_VERSION — purely additive, isolated tooling.

## Config-modal QR scanner for Setup Link (added 2026-08-19)

Added at the user's request as a companion to the Setup Link feature — instead of the vendor reading the
generated link/QR out loud or the target device relying on an external system camera app to open the
Setup Link URL, ZoeAdmin/ZoeW/Zoescan's own Config modal now has a "📷 ស្កេន QR (Setup Link)" button that
scans the same QR with the device's own camera and auto-fills the Config textarea, so the human still
reviews and clicks the existing "Save" button — no new silent-save path.

**Explicit user constraint, honored by design**: the existing parcel/barcode-scanning feature (ZoeAdmin's
and Zoescan's `liveScanCodeReader`/`codeReader`, restricted to 1D barcode formats) must not be touched or
affected in any way. This is why the new scanner uses a **completely separate `ZXing.BrowserQRCodeReader`
instance** (a QR-only decoder class, structurally incapable of matching barcode formats — not the same
multi-format reader used for barcode scanning, and not achieved by broadening that reader's format hints)
with its own isolated variables (`configQrReader`, `configQrScanActive`), own camera stream (via ZXing's
own `decodeFromVideoDevice`), own video element (`#configQrVideo`), and own modal (`#configQrScanModal`).
Zero lines of the existing barcode-scanning code path were modified in any of the three apps.

- **Shared logic**: `decodeSetupPayload(setupParam)` (extracted as a small helper in all 3 apps, reused by
  both `applySetupLinkFromUrl()` and the new scanner) decodes+validates the same base64 payload the Setup
  Link URL already used — one already-reviewed decode path, not a second parallel implementation.
- **Flow**: `openConfigQrScanner()` opens `#configQrScanModal` on top of the already-open `#configModal`
  (both apps' existing `openModalHelper`/`closeModal` — or Zoescan's `openModal`/`closeModal` — already
  support multiple simultaneously-open `.modal` elements correctly, confirmed by reading their
  implementations rather than assumed) and starts the QR-only reader. On a successful decode,
  `handleConfigQrResult(text)` parses the scanned string as a URL, extracts the `?setup=` param, decodes it
  via the shared helper, stops the scanner, and — unlike the URL-param flow's `confirm()` dialog — simply
  **pretty-prints the config into the existing Config textarea** (`firebaseConfigInput` in ZoeAdmin/ZoeW,
  `configInput` in Zoescan) for the human to review and click the pre-existing Save button themselves. No
  new auto-save path was introduced; this reuses the same trusted, already-existing save/validate code
  every manual paste already goes through.
- **ZoeAdmin, Zoescan**: already had `@zxing/library@0.23.0` loaded (pinned version + SRI hash, for the
  barcode-scanning feature) and the necessary CSP (`unpkg.com` in `script-src`, `worker-src 'self' blob:`)
  and `Permissions-Policy: camera=(self)` — reused as-is, zero infra changes needed for these two apps.
- **ZoeW**: previously had **no camera capability at all** by design (`Permissions-Policy: camera=()`, no
  ZXing, no scan feature of any kind — deliberately, since ZoeW's role never needed a camera). Adding this
  feature there required, for the first time in ZoeW: loading the identical pinned `@zxing/library@0.23.0`
  script tag (same URL + SRI hash as ZoeAdmin, byte-for-byte, not a different version), adding `unpkg.com`
  to `script-src` and `worker-src 'self' blob:` to `netlify.toml`'s CSP, and changing
  `Permissions-Policy` from `camera=()` to `camera=(self)`. **This was confirmed explicitly with the user
  before implementing** (a real security-posture change, not something to silently decide) — they chose to
  add it to all 3 apps for consistency rather than skip ZoeW.
- Verified via `node --check` on all 3 apps' `app.js`, HTML tag-balance check on all 3 `index.html`, and the
  exact `ZXing.BrowserQRCodeReader`/`decodeFromVideoDevice`/`Result.getText()` API surface confirmed against
  the real `@zxing/library@0.23.0` TypeScript definitions (downloaded from `registry.npmjs.org` for
  inspection, matching the same verification-over-assumption approach used for the vendored `qrcode.js`) —
  **not verified against a real camera/device in this session** (no browser/camera available), so the
  vendor should test the actual scan-to-fill flow once after deploying.
- `CACHE_VERSION` bumped in the 3 affected apps' `sw.js` (zoeadmin-v21, zoew-v18, zoescan-v18); ZoeKeyGen
  untouched this round.

## Fifth deep-audit pass (2026-08-19, branch `claude/detailed-audit-pyi4gq`) — handoff notes

Requested by the user ahead of adding 2-3 new features in one batch, specifically worried something had
been missed by that point. Ran 5 parallel research-only agents again (one per app plus one cross-cutting
infra pass), each re-checking every documented bug class for regressions and independently hunting for
anything new, with explicit extra scrutiny on the Setup Link / Config-modal QR scanner / Firebase-backup-tool
work added at the end of the fourth round — all three were built and self-verified (`node --check`, tag-
balance, byte-diffs) in that same session but never actually reviewed by a fresh 5-agent audit pass of their
own, since they were added after that round's dedicated review had already run.

### Fixed (safe, non-revenue, applied directly)
- **Config-modal QR scanner: camera never released except via its own exact Cancel button — regression of
  the "camera stays on after logout" bug class already fixed once for Zoescan's main scanner in round 3.**
  All three agents covering ZoeAdmin/ZoeW/Zoescan independently found the identical gap (the feature was
  copied to all three apps in the same commit with the same omission): `closeConfigQrScanner()` was wired
  only to the modal's "បោះបង់" button, so backdrop-click, the Escape key, and logout/4h-forced-expiry/role-
  check-failure all left the QR camera stream running indefinitely and left `configQrScanActive` stuck
  `true` — permanently breaking the "📷 ស្កេន QR" button until a full page reload. A second, distinct bug
  compounded it: the Escape-key handler in all three apps picks the *first* open `.modal` in DOM order
  (`Array.from(...).find(...)` / `document.querySelector('.modal.open')`), and `configModal` (opened first,
  still open underneath) always precedes `configQrScanModal` in each app's HTML — so Escape was silently
  dismissing the wrong, invisible modal instead of the visible QR scanner. **Fix, mirrored identically across
  ZoeAdmin/ZoeW/Zoescan**: added `data-close="closeConfigQrScanner"` to each app's `#configQrScanModal` (same
  mechanism `restoreWarningModal`/`permanentDeleteWarningModal` already use), which correctly fixes backdrop-
  click since the click target naturally resolves to the topmost stacked modal; changed each app's Escape-key
  handler to pick the *last* open modal instead of the first (topmost/most-recently-opened, matching what a
  user actually sees and expects Escape to close — a small generically-correct fix, not QR-specific); and
  added an explicit `closeConfigQrScanner()` call to ZoeAdmin's/ZoeW's `showLoginModalWithPrefill()` and to
  Zoescan's `onAuthStateChanged` sign-out branch (both before their generic bulk modal-close loops, which
  call plain `closeModal()` and don't consult `data-close`), matching the exact pattern Zoescan's round-3
  camera fix already established for its main scanner.
- **QR scanner could open a second concurrent camera stream on top of the already-running main barcode
  scanner in ZoeAdmin and Zoescan** — untested on real hardware per the round-4 handoff notes, and flagged
  independently by both apps' agents as a real risk to the core scan-to-locker/scan-to-parcel workflow (a
  modal being open only pauses the main scanner's *decode loop*, not its underlying `getUserMedia` stream,
  so it stays live and reachable the whole time Settings/Config is open). Rather than attempt an unverified
  stop-then-auto-resume dance across two independent camera consumers, `openConfigQrScanner()` in both apps
  now simply refuses to open (with a clear toast asking the user to close the barcode scanner first) while
  `isCameraScanning`/`isCameraStarting` is true — guarantees only one `getUserMedia` stream is ever requested
  at a time, closing the risk entirely instead of hoping simultaneous streams behave. (ZoeW has no main
  scanner/camera capability of any other kind, so this guard doesn't apply there.)
- **`clearSensitiveModalFields()` gaps** (the shared-device logout-hardening sweep from rounds 3-4, found
  incomplete in a few more spots): ZoeAdmin's `lookupSecretKey` (the PIN-derived `CryptoKey` that decrypts the
  saved customer-lookup API secret) was never reset on logout — since the whole file is top-level script code
  with no wrapping IIFE, every function stays directly callable from DevTools for the rest of the page's life,
  so a PIN entered once during a shift kept unlocking authenticated lookup-API calls long after logout,
  defeating the PIN gate's own stated purpose. Also added to ZoeAdmin's blank-list: `lookupApiHeaderValueInput`
  (the lookup-API secret's own input field, left with a readable DOM value if the config modal was cancelled
  rather than saved) and `editModalBarcodeText` (the barcode label in the edit-phone modal). ZoeW got the same
  `editModalBarcodeText` fix (present with the identical omission — a gap shared by both apps since the field
  predates the hardening sweep, not a fix that landed in one sibling and not the other).
- **ZoeKeyGen `refreshKeyList()` had no partial-failure fallback**: it read `license_keys` and
  `license_keys_meta` via `Promise.all`, so a rejection on *either* read (a `license_keys_meta` permission
  hiccup right after a rules publish, a revoked `user_roles` entry mid-session, a network blip — this project
  has hit "rules not published yet" as a real recurring incident) blanked the *entire* key list, even though
  the publicly-readable `license_keys` node might have loaded fine. Switched to `Promise.allSettled`: the
  public node's data now renders unconditionally as long as that read itself succeeds, and only degrades
  gracefully (falling back to the existing no-meta-record derivation already used per-row) if the meta read
  specifically fails, which now also gets its own Sentry capture rather than surfacing only as a generic full-
  page failure.
- **ZoeKeyGen `clearSigningKey()` didn't null the derived `signingKeySessionKey` `CryptoKey` handle** — low
  real-world impact (the key is non-extractable, and its only use is decrypting the `sessionStorage` blob the
  same function already deletes), but for a variable that exists specifically to protect the system's highest-
  value secret, an explicit "clear from memory" action leaving a live derived-key handle behind was worth
  closing for defense-in-depth. Now set to `null` alongside `signingPrivateKeyJwk`.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v22, zoew-v19, zoescan-v19, zoekeygen-v12) since all 4
  `app.js` got real behavior changes above.

### Follow-up: user reviewed the 3 proposed items and said "fix all of them, make it secure, don't let it be
bypassable" — here's what was actually done for each
2 of the 3 were safely fixable and are now fixed; the 3rd was investigated further *while implementing* and
turned out to be unsafe to apply as originally proposed — it was reverted rather than shipped, since a broken
production app is worse than a narrow, already-partially-mitigated gap. Details below.

1. **NOT applied, reverted after investigation — Firebase rules gap on `zoew_scan_history_cod_dod/$itemId`'s
   top-level `cod`/`dod`/`price`.** The proposed fix (extend the same "admin OR not-yet-existing OR unchanged"
   pattern already used for the nested `barcodes/$idx/{cod,dod}` fields) was drafted and JSON-validated, but
   before committing it, traced every ZoeW (`worker`-role) code path that writes to this exact top-level field
   set on an *existing* record — and found three real, currently-shipping ones that legitimately need to:
   `claimAndCleanupItem`'s automatic 8-day stale-open partial-claim branch (`ZoeW/app.js` ~line 1056-1058,
   recomputes `updated.cod/dod/price` from the still-active barcodes and writes it via `runTransaction` on the
   live item), `restoreClaimedItemToScanHistory` (~line 1010-1012, the round-4 trash-write-failure recovery
   transaction that restores reclaimed barcodes back into the live record), and `executeRestoreItem`'s
   merge-into-existing-open-order branch (~line 2366-2368, the common "restore from trash while a matching open
   order already exists" case). All three run under the worker's own authenticated session and all three write
   a *recomputed sum* of `barcodes[].cod/dod` into these top-level fields on a record that already exists —
   exactly the write shape the proposed "admin OR unchanged" rule would reject. Applying the proposed rule as
   drafted would have silently broken the 8-day auto-cleanup, the trash-recovery safety net, and restore-merge
   for every ZoeW user, in exchange for closing a narrower gap (a compromised/malicious worker account crafting
   a raw REST write to fabricate these exact fields). The fundamental problem is that Firebase RTDB's rules
   language has no aggregate/sum function, so a rule can't verify "this new top-level value equals the sum of
   this record's own `barcodes[].cod/dod`" — the same "no declarative rule can verify a delta's history is
   honest — that fundamentally requires a trusted server (Cloud Functions), which this project doesn't have"
   conclusion the first "final" audit round already reached for the sibling problem (worker write access to
   the daily/monthly revenue nodes), and for the same reason. **Change reverted; `firebase-database.rules.json`
   is unchanged from before this round.** This is now a confirmed, deliberately-accepted limitation in the same
   category as that earlier "safe subset only" decision, not an oversight — revisit only if/when a trusted
   backend (Cloud Functions or similar) is ever added to this project.
2. **Fixed — ZoeAdmin `removeSingleBarcode`'s outer-catch snapshot revert.** Removed the wholesale
   `dailyRevenueData = dailySnapshot; monthlyRevenueData = monthlySnapshot;` reassignment (and the now-unused
   snapshot variables) from the failure-catch block. The existing `addRevenueToDailyAndMonthlyRecord(...)` call
   right above it already reverses the applied delta correctly and object-identity-safely via its own
   transaction — the wholesale reassignment was only ever redundant in the simple case and actively harmful
   under the race (discarding a fresher listener-delivered snapshot from a concurrent device). `scanHistory`/
   `deletedItems` snapshot-revert is untouched, since that wasn't part of the flagged finding. **Note for a
   future round**: the same snapshot-then-wholesale-revert shape also exists in the new-parcel-scan save flow
   (`ZoeAdmin/app.js` ~line 3286-3298, inside the phone-modal confirm handler) — not fixed this round since it
   wasn't part of what was audited/proposed, flagging for awareness only.
3. **Fixed — Setup Link's URL-param flow no longer bypasses the Security PIN gate**, in all 3 business apps.
   `applySetupLinkFromUrl()` no longer writes straight to `localStorage`; it now routes through the exact same
   PIN gate every other config change already uses:
   - **ZoeAdmin** already had a general-purpose `pinTargetAction` callback mechanism (`requestPinBeforeConfig
     (targetAction)`, already used elsewhere for the lookup-API config modal) — reused directly:
     `applySetupLinkFromUrl()` now calls `requestPinBeforeConfig(() => { openConfigModal(); <pre-fill textarea
     with the parsed config>; })`.
   - **ZoeW and Zoescan** had no such callback mechanism (`requestPinBeforeConfig()` always just opens
     `openConfigModal()` unconditionally after success), so both gained a small `pendingSetupLinkConfig`
     module-level variable instead: `applySetupLinkFromUrl()` stashes the parsed config there and calls the
     existing `requestPinBeforeConfig()`; `openConfigModal()` now checks it first (pre-filling and consuming
     it) before falling back to its old behavior of loading the saved config from `localStorage`.
   - In every app the old `window.confirm()` naming the `projectId` was dropped entirely — the PIN-gated Config
     modal itself, showing the actual JSON in a reviewable/editable textarea before the existing "រក្សាទុក"
     (Save) button is explicitly clicked, is a strictly stronger confirmation than a generic `confirm()` dialog
     ever was, and it's the exact same review step the already-correct QR-scan-to-textarea flow already uses.
   - **First-run devices are unaffected and not weakened**: `requestPinBeforeConfig()`/`checkPinAndOpenConfig()`
     already open `pinSetupModal` (create-a-new-PIN) when no PIN exists yet, so a brand-new device opening a
     Setup Link still gets the config pre-filled and still must set a PIN before it can ever be saved — strictly
     *more* secure than before (previously the URL flow saved with **zero** PIN involvement even on a fresh
     device), not a regression of the legitimate first-time-setup case the feature exists for.
   - Verified the boot-sequence interaction is safe: `applySetupLinkFromUrl()` still runs before `initFirebase()`
     on page load in all 3 apps; on a config-less first-run device, `initFirebase()`'s own `checkPinAndOpenConfig
     (true)` call (which doesn't touch `pinTargetAction`/`pendingSetupLinkConfig`) can also fire right after,
     redundantly reopening the same already-open `pinSetupModal` — harmless (idempotent) and doesn't clobber the
     Setup Link's pending config or callback.

### Not yet done as of this handoff — lower-priority items noted but not applied
- QR-scan camera-open failures always show the same generic "check camera permission" toast regardless of
  the actual error (ZoeAdmin/Zoescan) — misleading if the real cause is the now-blocked dual-stream conflict;
  `requestCameraPermission()`'s existing per-error-type messaging could be reused.
- No in-app-browser (Facebook/Instagram/Messenger/Line) warning before opening the QR scanner, unlike the
  main barcode scanner's `requestCameraPermission()`, which already warns proactively.
- `firebase-backup/backup.js` doesn't sanitize `business.name`/paths from the vendor-authored, gitignored
  `config.json` before using them as filesystem paths — low risk given the trusted-input design (no
  command-injection surface exists at all in that script), but worth a defensive `../`/absolute-path check.
- ZoeKeyGen's `persistSigningKeyForSession()` can silently no-op with zero user feedback if WebCrypto's
  `deriveKey` fails during first-time PIN setup — fails closed (no insecure storage), just confusing; rare.
- Zoescan's `lockerUpdatedBy` mirror-write could theoretically send `null` instead of a string if
  `currentUserEmail` were ever empty while authenticated, which the rules schema would reject — narrow/
  theoretical, `currentUserEmail` should never be empty for an authenticated session.
- ZoeW/ZoeAdmin's `renderHistory()` age/recall UI badges use raw `Date.now()` — purely cosmetic (24h "new/old"
  badge, 4h "call again" hint), doesn't feed retention or revenue decisions, arguably within the spirit of the
  existing cosmetic-timer exemption though not explicitly named there; flagged for awareness only.

All fixes above are committed, `node --check`-clean on every modified `.js`, and HTML div-tag-balance-checked
on every modified `.html`. Nothing is mid-edit. No Firebase rules files were touched by the fixes actually
applied this round.

## Sixth deep-audit pass (2026-08-19, branch `claude/deep-audit-bug-fixes-7f6izx`) — handoff notes

Requested as another meticulous final round: the user was explicitly not yet satisfied because *every
previous round kept finding new bugs*, and asked for a thorough, gap-free sweep plus a README tidy-up.
Branch started exactly at `main` (commit `aab9b03`, i.e. right after PR #17 merged), no carry-over.

**Method note (differs from rounds 1-5):** this round was run *inline, single-threaded*, not with 5 parallel
research agents — the session's operating rules forbade spawning subagents unless the user asks. Instead of
fan-out, coverage came from purpose-built static checkers written during the session (kept in the scratchpad,
worth rebuilding if useful):
- a **sibling-divergence differ** that extracts every top-level function from `ZoeAdmin/app.js` and
  `ZoeW/app.js` by name and diffs same-named pairs. At round start: 103 shared functions, 78 identical,
  25 different — this is what surfaced the `claimAndCleanupItem` and scanner-lookup findings below, and it is
  by far the highest-yield tool for this codebase's "independently duplicated logic" problem. Re-run it first
  in any future round.
- a **`getElementById` ↔ HTML `id=` cross-checker** (both directions) and an **inline-`on*=` handler ↔
  function-existence checker**, per app — all clean except the dynamically-created `zoeUpdateBanner`.
- a **`data-close` target checker** (every `data-close="fn"` resolves to a real global function).
- a **referenced-Firebase-path ↔ rules-file coverage** check (all paths covered).
- a **token-equivalence-proving whitespace trimmer** (acorn tokenize → strip → re-tokenize → refuse to write
  unless the token stream is byte-identical). Used it to safely strip 26 + 12 trailing-whitespace lines from
  ZoeAdmin/ZoeW `app.js` without risking a change inside a template literal.
- acorn comment scan across all 8 `app.js`/`license-verify.js` files: **0 comments** — convention still holds.

### Fixed (safe, non-revenue, applied directly)
- **Zoescan: the round-5 Setup-Link PIN gate was fully bypassable on a config-less device** (a real regression
  of that round's own fix, in Zoescan only). Boot order is `applySetupLinkFromUrl()` → `initFirebase()`, and
  Zoescan's `initFirebase()` called `openConfigModal()` **directly** when no config was saved (ZoeAdmin/ZoeW
  route the same case through `checkPinAndOpenConfig(true)`). Since `openConfigModal()` is the sole consumer of
  `pendingSetupLinkConfig`, the Setup Link's config got pre-filled into a Config modal that opened with **zero
  PIN involvement** — exactly what round 5 set out to prevent. Both of Zoescan's no-config early returns now
  call `requestPinBeforeConfig()` instead. Side effect worth knowing: a brand-new Zoescan device now sees
  `pinSetupModal` before the Config modal, matching ZoeAdmin/ZoeW's long-standing first-run behavior.
- **All 3 business apps: an abandoned Setup Link stayed armed indefinitely and could silently pre-fill
  *another business's* Firebase config into a later, unrelated Config open.** `pendingSetupLinkConfig`
  (ZoeW/Zoescan) and `pinTargetAction` (ZoeAdmin) were only ever consumed on success — cancelling the PIN
  prompt left them set. With the 200-300-client provisioning model this is a genuine mis-provisioning risk
  (a vendor opening Config to *check* the current config sees a different one pre-filled, and Save is one tap
  away). Added `cancelPinSetupFlow()`/`cancelPinEntryFlow()` in all 3 apps, wired to both the cancel buttons
  and (via `data-close=` on `pinModal`/`pinSetupModal`) the backdrop-click and Escape paths. ZoeAdmin's
  `checkPinAndOpenConfig()` also now resets `pinTargetAction` up front, since its no-PIN branch opens
  `pinSetupModal` directly and would otherwise inherit a stale callback.
- **ZoeAdmin + ZoeW: `claimAndCleanupItem` left `zoew_scanner_lookup` permanently desynced from
  `zoew_scan_history_cod_dod` whenever the trash write failed and the round-2 recovery restored the parcel.**
  Both apps updated the lookup node assuming the claim was final (ZoeAdmin before the trash write, ZoeW after),
  and `restoreClaimedItemToScanHistory()` put the parcel back without ever re-syncing it — so a restored parcel
  was invisible to Zoescan ("barcode not found", no locker assignable) with no error anywhere. Now both apps
  clear/sync immediately after the claim transaction commits (the narrower of the two windows) **and** re-sync
  from `restoreResult.snapshot.val()` when the recovery succeeds. Also renamed ZoeW's `claimedUpdatedRemainder`
  → `updatedRemainder`; **`claimAndCleanupItem` is now byte-identical across the two apps**, verified by the
  divergence differ.
- **ZoeAdmin/ZoeW: `buildScannerLookupPayload`, `syncScannerLookupEntry`, `clearScannerLookupEntry` had drifted
  apart** — ZoeW wrote `barcodes` as an index-keyed object skipping nulls (which for a sparse array can make
  RTDB return an object, and every consumer tests `Array.isArray`), ZoeAdmin wrote a dense array with
  placeholders; ZoeW validated the itemId with a regex and used `set(child)`, ZoeAdmin used
  `update(parent, {[id]: …})` with no id validation. Unified all three on the safer shape (dense array +
  itemId regex guard + `set`). All three are now identical across the apps.
- **ZoeAdmin/ZoeW/Zoescan: the Config QR scanner's camera was never released when the app was backgrounded.**
  Round 3 fixed exactly this bug class for Zoescan's main barcode scanner and round 5 fixed the QR scanner's
  logout/backdrop/Escape paths, but no app's `visibilitychange` handler knew about `configQrScanActive`
  (ZoeW had no camera visibility handler at all — it never had a camera before the QR feature). All three now
  call `closeConfigQrScanner()` when the document goes hidden.
- **ZoeAdmin/ZoeW: Escape dismissed the wrong modal when a stacked dialog sits *earlier* in DOM order.**
  Round 5 changed the Escape handler from "first open modal" to "last open modal in DOM order" to fix the
  `configModal`/`configQrScanModal` pair, but `editBarcodePriceModal` (inline `z-index: 1050`) is declared
  *before* `viewListModal` in ZoeAdmin's HTML while opening visually on top of it — so Escape closed the
  background list instead of the visible edit dialog. Replaced the DOM-order heuristic with a shared
  `topmostModal()` that ranks open modals by computed `z-index` and falls back to DOM order on ties (`>=`),
  which is correct for both pairs. Applied to all 3 apps.
- **ZoeAdmin/ZoeW: `runAutomaticDeletedCleanup()` released barcodes from `zoew_barcode_registry` in parallel
  with the trash-purge write instead of after it** — if the purge failed, the barcode was freed while its
  parcel was still sitting in (and restorable from) the trash, so the same barcode could be scanned in again as
  a duplicate. `executePermanentDelete()` already chained these correctly; the automatic sweep now does too.
- **`license-verify.js` (all 4 copies): `checkOnline()` skipped the server-clock sync on any non-OK HTTP
  response**, because the `!res.ok` early return sat above the `Date`-header capture — so exactly when the
  license DB was erroring (e.g. right after a rules change) `getStatus()` fell back to the raw device clock for
  its expiry/offline-grace decisions. Moved the header capture above the early return. Re-copied to all 4 apps;
  all still hash to one value (`md5sum` verified).
- **`firebase-backup/backup.js` hardening** (round 5 flagged the path handling and never fixed it): backups now
  write to a `.partial` temp file and `rename()` into place, so an interrupted run can't leave a truncated
  `.json.gz` that both looks like a valid backup and consumes a `keepCount` slot (pushing a good one out) —
  the worst failure mode a backup tool can have. `keepCount` is validated as an integer ≥ 1 (a negative value
  previously made the prune loop delete *everything*, including the backup just written). `business.name` is
  validated against `^[A-Za-z0-9._-]+$` before being used as a directory name, and a missing name is a clean
  per-business failure instead of a `path.join` crash. Failure/success lines now label a nameless entry `#N`
  rather than printing `undefined`. `main()` got a top-level `.catch`. **Verified by running it** against a
  stubbed `firebase-admin`: all four validation paths, per-business failure isolation, exit code 1 on any
  failure, rotation keeping exactly `keepCount`, zero `.partial` leftovers, and a gzip write/read round-trip.
- Small: ZoeAdmin/ZoeW now clear the activation-key textarea on the *invalid* path too (Zoescan already did,
  round 4); trailing-whitespace cruft stripped from ZoeAdmin/ZoeW `app.js` (token-equivalence proven).
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v24, zoew-v21, zoescan-v21, zoekeygen-v13) — ZoeKeyGen
  included because its `license-verify.js` copy changed. **No Firebase rules file was modified by any applied
  fix, so nothing from this round needs a manual publish.**

### README work (the second half of the request)
- **Root `README.md` rewritten/extended**: added the `firebase-backup/` tool to the app table, a full
  Firebase-path/reader table for the business DB, a "Provisioning" section documenting the Setup Link + QR flow
  end-to-end (including that both paths are PIN-gated and human-confirmed), and a backup section. Kept the
  existing architecture notes.
- **Fixed a genuinely broken doc reference**: `ZoeAdmin/README.md` pointed twice at `google-sheets-api/README.md`,
  a path that has **never existed in this repo** (confirmed via `git log --all`). Replaced with a new inline
  **"Lookup API"** section documenting the actual contract read out of the code — the `{barcode}` URL
  placeholder, the `?list=1` / `{rows:[…]}` list endpoint, the PIN-derived encryption of the header secret,
  the configurable nested field paths, the 15-minute cache, and the CSP `connect-src` constraint.
- Added Setup Link / QR bullets to all 3 business-app READMEs; documented Zoescan's locker-occupancy warning;
  documented that ZoeW now uses the camera (QR only) — a real security-posture change that was undocumented.
- Documented the backup tool's new `.partial`/rename behavior and `keepCount`/`name` validation.
- Added a link checker: every relative Markdown link in all 6 READMEs now resolves.

### Reported to the user, NOT applied (revenue / pickup-stat / rules — live-production policy)
Written up for human review rather than auto-applied, per "Project status" + point 5 of "When triaging".
1. **[pickup stat] `toggleCloseStatus` applies a ±1 customer delta unconditionally.** `desiredClosed` is
   computed from the pre-`confirm()` object, but `previousState` is re-read from `scanHistory` *after* the
   blocking dialog (the whole reason `freshItem` exists). If another device closed the order during the dialog,
   the package delta correctly computes 0 but the customer refCount still gets +1 — leaving a stale ref that
   keeps the phone in `pickedUpPhones` after all its orders are reopened. `toggleIndividualBarcodeClose` guards
   its *customer* delta on a real boundary crossing but has the same unguarded shape for its *package* delta.
   Proposed fix: derive both deltas from `previousState` vs. desired, not from `desiredClosed` alone.
2. **[revenue] `executeRestoreItem` never adds revenue back for a legacy item with no `barcodes[]` array**,
   even though the 8-day abandon sweep *did* subtract its top-level `cod`/`dod` (`claimAndCleanupItem` handles
   the no-`barcodes[]` case explicitly; the restore path only iterates `itemToRestore.barcodes`). Asymmetric —
   money is subtracted and never returned. Same in both apps.
3. **[revenue] `confirmPhone`'s wholesale `dailyRevenueData`/`monthlyRevenueData` snapshot revert** (the exact
   leftover round 5 flagged for a later round). Unlike `removeSingleBarcode`'s, it is *not* purely redundant:
   on the 15s `withTimeout` path `addOrUpdateEntry`'s own `revertRevenueOnSaveFailure` has not run yet. But
   `addOrUpdateEntry` owns the correct targeted revert and will apply it whenever the write actually settles,
   so the snapshot assignment can go — and should, because it discards a concurrent listener refresh from
   another device. `scanHistory = historySnapshot` in the same catch is load-bearing (nothing else undoes the
   local item) and should stay.
4. **[revenue, latent] `executeRestoreItem`'s merge branch buckets the add-back under `targetItem.scanDate`
   in ZoeAdmin but `itemToRestore.scanDate` in ZoeW.** The subtraction always used the trash item's scanDate,
   so ZoeW's is the symmetric one. Currently unreachable-in-practice (the merge match requires equal scanDates
   unless ids collide, which they shouldn't), but it is a latent cross-day revenue misallocation and the last
   remaining real divergence between the two `executeRestoreItem`s.
5. **[rules, ZoeKeyGen] `license_keys` is world-readable at the parent node**, so an unauthenticated
   `GET /license_keys.json` dumps every key id + `expiresAt` + `revoked` for every client. `checkOnline()` only
   ever reads `/license_keys/{appCode}/{keyId}.json`, so moving `.read: true` down to `$keyId` and granting
   admin `.read` at the parent (for `refreshKeyList()`) keeps both working while removing enumeration.
   Note `syncServerTime()` is unaffected — it deliberately ignores the response status and only reads the
   `Date` header. Needs a manual Console publish.
6. **[data integrity] Zoescan's mirror write addresses barcodes by array index.** `assignLockerToEntry()` takes
   `matchedBarcodeIdx` from the *lookup* node and writes
   `zoew_scan_history_cod_dod/{id}/barcodes/{idx}/locker`. If the two nodes desync (which finding 3 above could
   cause), the write lands on the wrong barcode — or, if the index is past the end, creates a sparse array so
   `barcodes` reads back as an **object**, and every `Array.isArray` consumer in ZoeAdmin/ZoeW silently drops
   the parcel's barcodes from the UI, revenue sums and `isClosed` recomputation. Robust fix is to match by
   `code` inside a transaction instead of by index; it touches the hot scan path, so it was not done unasked.
7. **[operational] ZoeKeyGen "Extend" updates only the server `expiresAt`, not the signed payload's `exp`.**
   Already-activated devices keep working (`getStatus` uses the server ceiling), but `activate()` →
   `verifyKeyString()` rejects on the *signed* expiry — so an extended key **cannot be re-activated on a reset
   or replacement device** once the original signed date passes. Design question (extend vs. reissue), flagged
   rather than changed.

### Confirmed clean this round (checked, no change needed — don't re-audit blind)
- `escapeForInlineJsAttr()` in ZoeAdmin/ZoeW is genuinely correct for the `onclick="fn('…')"` context
  (escapes `&` first, so `&#39;`-style entity smuggling can't reconstitute a quote after HTML decoding, and
  backslash before quote). It is **not** the ZoeKeyGen bug class that used plain HTML escaping in an `on*=`
  attribute — that one is still fixed.
- All `onValue(dbRefX, …)` calls in all 3 apps are `if (dbRefX)`-guarded (ZoeAdmin's history/deleted guards are
  just oddly indented, which makes them look unguarded in a quick grep).
- Raw `Date.now()`/`new Date()` audit re-run over all 4 `app.js` + `license-verify.js`: every remaining raw use
  is one of the intentionally-exempt cosmetic/local ones (PIN lockout, id salt, scan debounce, script-load
  deadline, lookup cache TTL/cooldowns, `renderHistory` badges).
- Every Firebase path the apps touch has a matching rules block; all `getElementById` IDs exist; all inline
  handlers and `data-close` targets resolve; Zoescan still has exactly 2 inline `onclick=` and both keep their
  `addEventListener` backups (its CSP still lacks `'unsafe-inline'`); no inline `<script>` blocks in Zoescan.
- `submitManualAdjustment()`'s `submitBtn.disabled = true` with no re-enable **is not a bug** —
  `openManualAdjustModal()` re-enables it on every open. (Looked like a real one at first; verified.)
- Service worker cache-cleanup filters are still each scoped to their own `<app>-` prefix.

### Not yet done as of this handoff
All applied fixes are committed, `node --check`-clean, JSON-validated, comment-free-verified, HTML
tag-balance- and wiring-checked, and the backup tool was executed end-to-end against a stub. Nothing is
mid-edit. No rules file changed, so no manual publish is needed for anything applied this round — items 5
above would need one *if* the user asks for it.

### Follow-up in the same session — per-barcode លុប/ដក marker + all 7 flagged items applied

The user restated the Delete-vs-Remove policy in their own words (confirming it is policy, not a bug),
added the missing business rationale, and then authorised fixing all 7 flagged items "so long as លុប/ដក
behaviour does not change". Two clarifications worth keeping:
- **"បិទ" = "យកហើយ"** — closed means the customer collected the parcel. Count and value stay in the
  daily/monthly stats permanently; the 2-hour auto-cleanup must never move them.
- **The 8-day window exists because an uncollected parcel is physically returned to the central branch.**
  That is why ដក subtracts *both* the money and the package count, and why restoring adds both back.
Windows stay 2h / 8d / 10d exactly as before.

**Per-barcode marker (the new part).** `isFromDeletion` already existed on each barcode, in both Firebase
schemas and in the rules, but was **dead**: only ever written `false` at creation, never set on any លុប
path, and never read. So a barcode inside a deleted (លុប) order read as `false`, i.e. indistinguishable
from a removed (ដក) one. It is now written on every path:
- លុប — `deleteSingleItem`, `clearHistory`, `claimAndCleanupItem` reason `'close'` → each barcode gets
  `isFromDeletion: true`, `isDeducted` untouched (stays `false`; no money moves).
- ដក — `claimAndCleanupItem` partial + whole-abandon, `removeSingleBarcode` → each barcode gets
  `isFromDeletion: false` alongside `isDeducted: true`.
- Restore — `executeRestoreItem` now clears `isFromDeletion` on every restored barcode (it is live again),
  next to the existing `isDeducted` reset.
- The `dbRefHistory` normalizer defaults a missing `isFromDeletion` to `false`, so pre-existing records
  backfill on their next full write.
`isDeducted` remains the *only* field that drives money — the marker is additive and nothing depends on it
for correctness, which matters because trash records already in production do not carry it.
**No Firebase rules change was needed** — `isFromDeletion` is already in both schemas, and every write is
to a brand-new trash record (`!data.exists()`), so the worker-role validate passes.

**Verified by executing the real code**: `scratchpad/policy-test.js` slices the actual
`claimAndCleanupItem` trash-construction block and `executeRestoreItem` revenue block out of both
`app.js` files, runs them in a `vm` context with stubbed helpers, and asserts 27 invariants per app —
លុប→restore→លុប→restore leaves the stats byte-identical; ដក→restore→ដក→restore subtracts and adds back
exactly; partial claims only move the claimed barcodes; legacy items behave symmetrically both ways.
Worth rebuilding in a future round; it is the only executable proof of the policy in the repo.

**The 7 flagged items — all now applied, none changing លុប/ដក semantics:**
1. `toggleCloseStatus`/`toggleIndividualBarcodeClose` now derive the pickup deltas from `previousState`
   (re-read after the blocking `confirm()`) instead of from `desiredClosed` alone, via
   `alreadyInDesiredState`. Closes the stale-dialog race that left a phantom customer refCount.
2. Legacy items with no `barcodes[]` now get their ដក value added back on restore, keyed off the
   item-level marker captured as `restoredWasRemoved` *before* `isFromDeletion` is deleted. Conservative:
   only an explicit `isFromDeletion === false` triggers the add-back, so an ancient record missing the
   field behaves exactly as it does today.
3. `confirmPhone`'s wholesale `dailyRevenueData`/`monthlyRevenueData` snapshot revert removed;
   `addOrUpdateEntry`'s `revertRevenueOnSaveFailure` owns that revert and is object-identity-safe.
   `scanHistory = historySnapshot` stays — nothing else undoes the local item.
4. Resolved as a side effect of hoisting: `executeRestoreItem`'s revenue block is now one shared block
   ahead of the merge/create branches, always keyed on `itemToRestore.scanDate`. **`executeRestoreItem`
   and `claimAndCleanupItem` are now byte-identical across ZoeAdmin and ZoeW** (verified by the differ;
   ZoeW's `restoredResultItem` renamed to ZoeAdmin's `resultingLiveItem`).
5. `ZoeKeyGen/firebase-database.rules.json`: `.read: true` moved down from `license_keys` to
   `license_keys/$appCode/$keyId`, with admin `.read` added at the parent for `refreshKeyList()`.
   `checkOnline()` reads one exact key path so it is unaffected; `syncServerTime()` ignores the response
   status entirely and only reads the `Date` header, so it is unaffected too.
   **This one needs a manual publish in the ZoeKeyGen Firebase Console.**
6. Zoescan's mirror write now also sends `barcodes/{idx}/code`. Because that field is scanner-locked to
   its existing value, Firebase itself rejects the write if the index no longer points at that barcode.
   A full fix (match by code inside a transaction) is **not possible**: a transaction requires read access
   to `zoew_scan_history_cod_dod`, which the scanner role deliberately does not have. Residual gap: an
   index past the end of the array still passes (`!data.exists()`) and creates a sparse entry. A rules
   guard (`barcodes/$idx` must have children `code`/`cod`/`dod`) would close it, but was **not** applied —
   it would permanently reject writes to any production barcode that happens to be missing `cod`/`dod`,
   which cannot be verified from here.
7. ZoeKeyGen's Extend modal now states plainly that extending moves the server ceiling only, and that
   after the key's original signed expiry it can no longer be activated on a new or reset device.
   Behaviour deliberately unchanged (re-signing would produce a different key string).

`CACHE_VERSION` bumped again for all 4 (zoeadmin-v26, zoew-v23, zoescan-v22, zoekeygen-v14).
`ZoeAdmin/README.md`'s Delete-vs-Remove section now documents the per-barcode marker table.

### Newly found this round, reported but NOT applied (needs a rules decision)
**ZoeW's automatic 8-day *partial* claim is rejected by the rules whenever the stale-open barcode is not
last in `barcodes[]`.** `claimAndCleanupItem` writes the compacted remainder, which shifts array indices;
the per-barcode `cod`/`dod`/`isDeducted`/`time`/`createdAt`/`isFromDeletion` validates are all
`admin || !data.exists() || unchanged`, so a shifted index makes an admin-locked field change value under
a `worker` session and the whole transaction is refused. ZoeAdmin (admin role) is unaffected, and the
sweep succeeds whenever an admin opens ZoeAdmin, which is presumably why this has never been noticed.
No declarative rule can express "this is a permutation of the same barcodes", so the options are: relax
those per-barcode locks for `worker`, or accept that partial 8-day cleanup is admin-only. Flagged for the
user rather than decided here.

### #6 fully closed — verified on a live Firebase RTDB emulator
The round-1/round-5 blocker ("emulator unreachable, rules reasoned through by hand") **no longer applies**:
`npm i firebase-tools` works, and the emulator jar runs directly with
`java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1`.
Two gotchas cost several attempts — the CLI's `emulators:start` cannot upload rules through this session's
proxy (use the jar directly), and **both** `.settings/rules.json` and any `auth_variable_override` request
need `-H "Authorization: Bearer owner"`, otherwise rules silently stay wide open and every test bogusly
passes. Always assert that a known-bad write is actually DENIED before trusting a rules test run.

Empirically settled: **a `.validate` on `barcodes/$idx` IS evaluated for a child-only write** (e.g.
`PATCH .../barcodes/9/locker`). So the guard now added to `zoew_scan_history_cod_dod/$itemId/barcodes/$idx`
— `root.child('user_roles').child(auth.uid).val() !== 'scanner' || data.exists()`, i.e. *a scanner may
modify an existing barcode but never create one* — blocks the out-of-range write that would otherwise
create a sparse array and make the whole parcel's `barcodes` read back as an object. Chosen over a
`hasChildren(['code','cod','dod'])` guard specifically because it does not depend on which fields legacy
production barcodes happen to carry. **Needs a manual publish** (root rules file).
Verified 7/7 against the real rules file: valid mirror write allowed, out-of-range denied, wrong-code
denied, legacy item-level locker allowed, admin adding a barcode allowed, worker closing a barcode allowed,
worker restoring a new item allowed.

The same run also **empirically confirmed the partial-claim finding**: a worker rewriting a compacted
`barcodes` remainder (index 0 becomes what used to be index 1) is DENIED. Still unfixed — it needs a
decision on relaxing the per-barcode admin locks for `worker`.

### #6 fully closed — verified on a live Firebase RTDB emulator
The round-1/round-5 blocker ("emulator unreachable, rules reasoned through by hand") **no longer applies**:
`npm i firebase-tools` works, and the emulator jar runs directly with
`java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1`.
Three gotchas cost several attempts and are worth remembering: the CLI's `emulators:start` cannot upload
rules through this session's proxy (run the jar directly); **both** `.settings/rules.json` and any
`auth_variable_override` request need `-H "Authorization: Bearer owner"`, otherwise rules silently stay
wide open and every test bogusly passes; and a stray `pkill -f firebase-database-emulator` matches the
tool's own shell command line and kills the session. Always assert a known-bad write is actually DENIED
before trusting a rules run — that check is what caught both false-pass rounds here.

Empirically settled: **a `.validate` on `barcodes/$idx` IS evaluated for a child-only write** (e.g.
`PATCH .../barcodes/9/locker`). So the guard now added to `zoew_scan_history_cod_dod/$itemId/barcodes/$idx`
— `root.child('user_roles').child(auth.uid).val() !== 'scanner' || data.exists()`, i.e. *a scanner may
modify an existing barcode but never create one* — blocks the out-of-range write that would otherwise
create a sparse array and make the whole parcel's `barcodes` read back as an object, silently dropping it
from every `Array.isArray` consumer. Chosen over a `hasChildren(['code','cod','dod'])` guard specifically
because it does not depend on which fields legacy production barcodes happen to carry.
**Needs a manual publish** (root rules file). Verified 7/7 against the real rules file: valid mirror write
allowed, out-of-range denied, wrong-code denied, legacy item-level locker allowed, admin adding a barcode
allowed, worker closing a barcode allowed, worker restoring a new item allowed.

The same run also **empirically confirmed the partial-claim finding**: a worker rewriting a compacted
`barcodes` remainder (index 0 becomes what used to be index 1) is DENIED by the existing per-barcode admin
locks. Still unfixed — it needs a decision on relaxing those locks for `worker`.
The harness lives at `scratchpad/emu/{real.sh,real.rules.json}`; rebuild it in any future rules round.

## Follow-up session (2026-08-19, branch `claude/deep-audit-bug-fixes-90pmhb`) — handoff notes

Not a new audit round. The user asked to read the START HERE block, then to "fix whatever is still not
done". Branch fast-forwarded from `claude/deep-audit-bug-fixes-7f6izx` (so it contains all of round 6),
plus the two commits below. Round 6's own findings were spot-checked in the code rather than trusted from
these notes — all 7 of the items it says it applied are genuinely applied (`alreadyInDesiredState`,
`restoredWasRemoved`, the removed `confirmPhone` snapshot revert, `executeRestoreItem`/
`claimAndCleanupItem`/`restoreClaimedItemToScanHistory`/`toggleCloseStatus` byte-identical across
ZoeAdmin/ZoeW per `audit-tools/extract.js`, the `license_keys/$appCode/$keyId` `.read` move, the
`barcodes/{idx}/code` mirror field, and the Extend modal's signed-expiry warning).

### The four low-priority items round 5 listed and never applied — all now applied
- **QR Setup Link scanner showed one generic "check camera permission" toast for every failure** in all
  3 business apps. Round 5 flagged this as misleading specifically because it also fires when the real
  cause is the dual-stream refusal it added in the same round. Added `describeCameraError(err)` (denied /
  no camera / in use by another app / overconstrained / non-HTTPS / unknown), identical in ZoeAdmin, ZoeW
  and Zoescan. Zoescan's main-scanner catch now also reports *unrecognised* `getUserMedia` error names to
  Sentry instead of silently showing a generic string for them.
- **No in-app-browser warning before opening the QR scanner**, unlike Zoescan's main barcode scanner which
  already warned proactively. Added `isInAppBrowser()` (same UA test, now shared) and a warning toast in
  all 3 apps' `openConfigQrScanner()`. Zoescan's main scanner now calls the same helper instead of its own
  inline copy of the regex.
- **ZoeKeyGen `persistSigningKeyForSession()` could no-op with zero feedback.** Root cause is one level up
  from where round 5 pointed: `deriveSigningKeySessionKey()` swallows its own exception and **returns
  null**, so `saveNewSecurityPin()`/`verifySecurityPin()` proceed normally, show "PIN saved", and then call
  `persistSigningKeyForSession()`, whose `!signingKeySessionKey` guard returns silently. The user ticked
  "remember this key", got a success toast, and nothing was remembered. Both that guard and the
  `encrypt`/`sessionStorage` catch now clear the `rememberSigningKeyCheckbox` and say so; the catch also
  captures to Sentry. Deliberately still fails closed — nothing is ever stored unencrypted.
- **Zoescan wrote `lockerUpdatedBy` as `null`** when `currentUserEmail` was empty, in the lookup
  transaction, the local entry, and the scan-history mirror. A null in a multi-path update *deletes* the
  child (`.validate` is skipped for deletes, so this was never a rules rejection — the round-5 note's
  guess about that was wrong), silently dropping who last set the locker. Now the field is simply omitted
  when there is no email, matching what `buildScannerLookupPayload()` in ZoeAdmin/ZoeW already did.

`CACHE_VERSION` bumped for all 4 (zoeadmin-v27, zoew-v24, zoescan-v23, zoekeygen-v15).

### The one open decision — resolved: worker may now rewrite a compacted `barcodes[]`
Round 6 left this for the user: ZoeW's automatic 8-day *partial* claim is rejected whenever compacting
`barcodes[]` shifts indices, because the per-barcode `cod`/`dod`/`isDeducted`/`isFromDeletion`/`time`/
`createdAt` validates read `admin || !data.exists() || unchanged`. Presented as three options (accept
admin-only and stop the retry noise / relax the locks for `worker` / delete-then-recreate the node in two
writes, which works under the current rules because `.validate` is skipped on a delete and `!data.exists()`
holds on the recreate). **The user chose relaxing the locks**, and made the argument that settled it:
*ZoeW has no UI that sets a barcode's `cod`/`dod` at all.* Verified — every `cod`/`dod` write in
`ZoeW/app.js` is a recomputed sum, a normalizer reading the existing value, or the legacy-shape migration
that builds `barcodes[]` from the item's own existing values; `openEditBarcodePriceModal`/
`saveEditedBarcodePrice`/`removeSingleBarcode` are ZoeAdmin-only.

Also found while weighing it, and worth remembering because it changes how much these per-barcode locks
were ever worth: **`zoew_daily_revenue_cod_dod` and `zoew_monthly_revenue_cod_dod` accept arbitrary
worker-written absolute values** (`.validate` is only `isNumber() && >= 0`) — the "explicitly NOT fixed"
item from the very first audit round. A malicious worker could already rewrite the day's revenue total
directly, so the per-barcode lock was never the boundary it looked like; it protects the source records
(the evidence trail), not the totals. The **trash node's** money locks (`zoew_recently_deleted_cod_dod`)
were deliberately left admin-only — that is where the restore add-back value is read from.

So the six fields now use `!== 'scanner'` instead of `=== 'admin'`, matching how `code`/`isClosed` in the
same block already treat a worker. **No app code changed** — `claimAndCleanupItem` was always correct;
only the rules refused it. `restoreClaimedItemToScanHistory` and `executeRestoreItem`'s merge branch both
*append* to `barcodes[]`, so existing indices keep their values and neither was ever affected.

**Verified on a live RTDB emulator against the real rules file**, not reasoned through by hand — new
suite `audit-tools/emu/partial-claim.sh`, 9/9:
- allowed: the compacted-remainder write (index 0 going from AAA to BBB), and creating the matching trash record
- still denied: scanner changing a barcode's `cod`, scanner changing an existing `code`, scanner creating
  a barcode out of range, worker rewriting an *existing* trash barcode's `cod`, worker rewriting the trash
  item-level `cod`, and an unauthenticated write
- asserted explicitly as the accepted cost: a worker *can* now edit a live barcode's `cod` directly
Re-ran the existing `real.sh` suite too (8/8). Confirmed the **previous** rules denied the same compacted
write, so the relaxation is provably what fixes it.

Two emulator gotchas beyond the three round 6 documented: `~/.cache/firebase/emulators/` is empty after a
plain `npm i firebase-tools` — run `firebase setup:emulators:database` to fetch the jar. And a request
carrying `-H "Authorization: Bearer owner"` *without* an `auth_variable_override` is treated as the project
owner and **bypasses rules entirely**, so an "unauthenticated write is denied" test written that way is a
false pass; send no Authorization header at all for that case.

**`firebase-database.rules.json` (root) needs a manual publish** in each business's Firebase Console —
same as it already did for round 6's scanner guard, which is still unpublished. No app-code change came
with this one, so no `CACHE_VERSION` bump for it.

### Round 3's open product decision — resolved: keep the wipe, stop it being silent
Round 3 flagged, and deliberately did not decide, that an involuntary logout silently destroys a
freshly-generated, not-yet-copied signing keypair. The user asked for a recommendation and then approved
it on the condition that it not weaken security. **The wipe itself is unchanged and still
unconditional** — `closeModal('keypairModal')` blanks `newPrivateKeyOutput` on every path, including the
bulk modal-close inside `showLoginModalWithPrefill()`, so no auth-null transition can leave a private
signing key in the DOM. Nothing was added that can cancel that.

What changed is only that the loss is now visible and, on deliberate paths, preventable:
- `keypairPrivateCopied` is set by `copyTextarea('newPrivateKeyOutput')` (both the clipboard-API and the
  `execCommand` fallback path, so a fallback copy counts too) and reset by `generateNewKeypair()` and by
  `showLoginModalWithPrefill()`. `hasUncopiedKeypair()` additionally requires the modal to be `active`
  and the textarea to be non-empty, so it can never fire on a fresh page load.
- The modal's "បិទ" button now calls a new `dismissKeypairModal()` that confirms first when the key is
  uncopied. This is the *only* deliberate dismiss path — ZoeKeyGen has no backdrop-click or Escape
  handling at all, unlike the 3 business apps (the round 2 note about a backdrop handler here does not
  match the current code). The confirm is deliberately **not** inside `closeModal()`: a blocking prompt on
  the forced-logout path would be wrong, and letting it be cancelled would weaken the wipe.
- `logoutApp()` confirms before signing out when a key is uncopied. Aborting a user-initiated logout is
  the user's own choice, so this changes no security boundary.
- Any involuntary path (role-check failure/timeout, auth session lost) still wipes with no prompt, but
  now raises a distinct `alert()` naming what was lost and why, fired after the login modal is shown. The
  pre-existing "បានសម្អាត Signing Key ចេញពីសតិ" toast is about the *loaded* key, which is why the loss
  used to read as unexplained.
- `kickUserOut()` (the devtools guard) is untouched and uncoverable by design — it replaces the document
  with `about:blank`, which destroys the key correctly and leaves nowhere to show a message.

Worth knowing if this comes up again: losing the key is costly but not unrecoverable. The generated pair
is not deployed yet, so regenerating costs nothing — unless the **public** half was already pasted into
all 4 apps' `license-verify.js` and shipped, in which case the re-deploy has to be redone. Previously
issued keys keep verifying either way, since `PUBLIC_KEYS_JWK` is an array.

`CACHE_VERSION` bumped to zoekeygen-v16.

### Call-mark feature work (asked for after the audit items were closed)
The user asked to check the phone call-marking and the "call again after 4 hours" prompt in ZoeAdmin and
ZoeW. `handleCallAction`, `openCallMarkModal`, `setCallMark` and `renderHistory` are byte-identical across
the two apps, and the recall logic itself was already written correctly — but two things made it unreliable:

- **Nothing ever woke it up.** `needsRecall` is computed only inside `renderHistory`, and `renderHistory`
  only runs on a data change or a filter/search change. There is no timer, and neither app's
  `visibilitychange` handler re-renders. On a busy day the live listener fires often enough that the
  highlight looked like it worked; on a quiet stretch, or with the app left open, it could be hours late.
  Added `sweepRecallHighlights()` (60s interval + on return to the foreground): it builds a signature of
  the ids whose 4 hours are up and re-renders only when that set changes, so an unchanged list costs one
  cheap loop a minute and no DOM work. It re-renders via `refreshCurrentHistoryView()`, which re-runs
  `searchByPhone()` when a phone search is active — a bare `applyCurrentFilter()` on a timer would have
  silently wiped the worker's search results every minute.
- **Mixed clocks.** `callMarkTime` is written with `getServerNow()` but `renderHistory` compared it against
  `Date.now()`, so a device clock off by N hours moved the reminder by N hours. Both now use
  `getServerNow()`, which was already in scope there. (This is the `renderHistory` raw-`Date.now()` use
  that round 5 listed as cosmetic — it stops being cosmetic once the 4-hour prompt is relied on.)

The blinking green/red recall style is **deliberately unchanged** — the user was asked and chose to keep it.

Also added, per the user: a row marked `wrong-number` shows an **edit-phone button in place of** the call
button (explicitly not in addition to it — the row must keep the same three controls so it does not
overflow a phone screen). `saveEditedPhone()` clears the `wrong-number` mark and resets `isCalled` when the
number actually changed, so the row returns to a fresh green call button; the mark, the time and `isCalled`
travel in the same `patchHistoryItemFields` call as the phone, so a failed write reverts all of it
together. Saving an unchanged number keeps the mark, since nothing was corrected. New `.fix-phone-btn`
style reuses the purple the `row-num-wrong-number` label already uses.

**Then decided by the user and applied:** `handleCallAction()` now also restarts the 4-hour clock
(`callMarkTime = getServerNow()`) when the item carries a `no-answer`/`no-connect` mark. The user's rule,
in their words: after calling again the button goes back to the normal colour, **the mark itself is not
deleted** so the row stays easy to recognise, and 4 hours later it blinks again. `callMark` is deliberately
untouched, so the row-number label keeps reading "ខល អត់លើក"/"ខល អត់ចូល" — only the timer moves. Both
fields travel in one `patchHistoryItemFields` call, so a failed write reverts them together. The re-render
is deferred with `setTimeout(..., 0)` on purpose: `handleCallAction` is the `onclick` of an
`<a href="tel:">`, and replacing the row's `innerHTML` synchronously inside that handler would tear out the
anchor before the browser follows the link. Marking again still restarts the clock too — `setCallMark`
rewrites `callMarkTime` unconditionally, including when the same mark is re-selected.

**Then also asked for:** closing a parcel now clears the call mark outright. The user's reasoning is that
a collected parcel means the customer was reached, so the mark is stale the moment it is closed. Applied in
both explicit toggle paths — `toggleCloseStatus` (whole order) and `toggleIndividualBarcodeClose` (a single
barcode, which the user asked for explicitly: any collected barcode clears that phone's mark) — in the
local optimistic update, in the `runTransaction` body, and restored in the failure revert, all four guarded
by `if (desiredClosed)` so reopening never clears anything. Reopening does not bring the mark back; it is
gone for good, which is what "សម្អាតដោយស្វ័យប្រវត្តិ" asks for. This also removes the "closed row keeps
blinking" case noted earlier, since there is no longer a mark to blink on. `claimAndCleanupItem`'s
automatic 2h/8d sweep is deliberately untouched, matching how pickup-stat crediting is scoped to the
explicit toggles only — those items are moving to trash anyway.

`CACHE_VERSION` bumped (zoeadmin-v32, zoew-v29).

### Two mechanisms from that work, refined on request
- **The bare `setTimeout(refreshCurrentHistoryView, 0)` in `handleCallAction` became
  `scheduleHistoryViewRefresh()`.** The deferral itself is load-bearing and stays — `handleCallAction` is
  the `onclick` of an `<a href="tel:">`, so re-rendering synchronously would tear the anchor out before the
  browser opens the dialer. What changed is that a named function documents that in a codebase that bans
  comments, and it now coalesces: a second call in the same tick is dropped, so a burst renders once.
- **`patchHistoryItemFields`'s failure revert re-rendered with `applyCurrentFilter()`**, which silently
  discarded an active phone search — at the worst possible moment, since the worker had just hit a save
  error and would lose the row they were looking at. It now uses `refreshCurrentHistoryView()`, which
  re-runs `searchByPhone()` when a search is active. `setCallMark` got the same change.

`saveEditedPhone` deliberately goes the other way, on the user's call: after a successful edit it **clears
the search box and calls `applyCurrentFilter()`**, so the view returns to the full day list. Keeping the
search would have hidden the row the worker just edited, since the new number no longer matches the old
query. The box is cleared rather than left populated so the state stays coherent — otherwise the next
background refresh (the 60s recall sweep, a Firebase update) would flip the table back to search results.
Its *failure* path still goes through the revert above and keeps the search, which is right: the write
failed, the old number is back, and it still matches the query. `saveEditedPhone` is now byte-identical
across the two apps (one leftover brace-style difference was aligned while editing it).

**Then finished, on the user's instruction** (they also confirmed they are currently the only person using
the system, so the propose-first caution does not apply for now): all the remaining `applyCurrentFilter()`
call sites were classified and 28 of them converted (19 ZoeAdmin, 9 ZoeW). The rule applied was **a repaint
caused by data changing preserves the current view; a repaint the user asked for by changing view does
not.** 12 sites keep `applyCurrentFilter()` on purpose: `filterDataByDate`, `filterDataByCustomDate`,
`searchByPhone`'s empty-query branch, `refreshCurrentHistoryView`'s own else branch, `setupAuthListener`
(fresh session) and `saveEditedPhone` (clears the box deliberately, see above).

The biggest one by far was **`debouncedRenderAfterHistorySync`** — the Firebase history listener's repaint,
which fires on every change from any device. A worker with a phone search open had it wiped every time
anyone anywhere scanned a parcel.

### Not yet done as of this handoff
Nothing is mid-edit. Every commit is `node --check`-clean on every modified `.js`, JSON-validated on the
rules file, comment-free-verified on every changed line, tag-balance- and wiring-checked on the one
modified `.html`, and the rules change is emulator-verified. The only outstanding work is the two manual
Console publishes listed in START HERE.
