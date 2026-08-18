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
per-day node, `zoew_daily_pickup_cod_dod/{date}` → `{customersPickedUp, packagesPickedUp}`,
written via `addPickupToDailyRecord()`/`commitDailyPickupDelta()` (mirrors
`addRevenueToDailyAndMonthlyRecord()`/`commitDailyRevenueDelta()` — `runTransaction`,
clamp-to-0 safety net; no monthly bucket, since only the daily stat card needed this). A
second line, `todayPackagesPickedUpCount`, now sits under the customer count in the same
stat card in both `ZoeAdmin/index.html` and `ZoeW/index.html`, showing total packages
picked up (distinct from customer count since one order can have multiple barcodes).

Increment/decrement hooks live in `toggleCloseStatus(id)` and
`toggleIndividualBarcodeClose(itemId, barcodeCode)` in **both** `ZoeAdmin/app.js` and
`ZoeW/app.js`, firing only on the transition into/out of fully-closed (not on every toggle
call), with the delta reversed in the existing revert-on-Firebase-failure catch block.
`claimAndCleanupItem()`'s automatic 2h/8d sweep was deliberately left untouched — it never
calls the toggle functions, so it can't move this counter, same as revenue's `'close'`
reason already didn't. Resolved open design question (confirmed with user): explicitly
re-opening a closed item **does** decrement the counter back down (symmetric with revenue's
"explicit corrections adjust, automatic cleanup never does" precedent). Deleting (លុប) or
restoring a closed item does not touch this counter either, for the same reason it doesn't
touch revenue — delete/restore never calls the toggle functions, so no hook was needed
there.

**Known, intentionally-uncounted edge case (confirmed with user 2026-08-18):** if a
multi-barcode item has only *some* barcodes closed when the other(s) go stale and get
auto-abandoned after 8 days (`claimAndCleanupItem(id, 'abandon')`), the remainder's
`isClosed` flips to `true` as a side effect of that transaction (all *remaining* barcodes
happen to be closed) — but since this flip never passes through `toggleCloseStatus`/
`toggleIndividualBarcodeClose`, it is never added to the pickup count, and the item then
silently ages into the normal 2h close→trash sweep the same way. Net effect: a customer
who picked up part of a multi-barcode order, where the rest went stale and got abandoned,
is never counted in "អតិថិជនយក" for any of it. Confirmed intentional, not a bug to fix —
per the user, an uncollected barcode in this scenario gets physically returned to the
central branch rather than picked up, so it isn't a real pickup event and correctly falls
under the same "automatic cleanup never touches this stat" rule as everything else here.

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
   review over auto-applying anything non-trivial.
