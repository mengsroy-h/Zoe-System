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
touches ZoeKeyGen. The long-open question about `license-verify.js`'s `LICENSE_DB_URL` possibly being a
mixed-up copy of ZoeW's business DB URL (first flagged in the very first audit round) remains unresolved and
cannot be checked from a git-only session — still needs the user's direct confirmation in the Firebase
console.
