# Zoe-System

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

### Not yet done as of this handoff
- Nothing critical is mid-edit. All changes described above are complete, syntax-checked
  (`node --check` on every modified `.js`, JSON-validated on both rules files), and either
  committed or about to be committed in the same push as this note.
- Two rules files changed this session (`firebase-database.rules.json` at repo root, and
  `ZoeKeyGen/firebase-database.rules.json`) both need **manual publishing** in their respective
  Firebase Consoles — this repo's rules JSON is never auto-deployed by Netlify.
