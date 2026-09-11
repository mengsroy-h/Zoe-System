#!/usr/bin/env bash
# រត់ការត្រួតពិនិត្យ audit ទាំងអស់ដោយមិនចាំបាច់ប្រើ AI ។
#   bash audit-tools/run-all.sh
# ប្រៀបធៀបនឹង tree ផ្សេង (ឧ. មុនកែ) ដើម្បីបញ្ជាក់ថាតេស្តមិនទទេ៖
#   bash audit-tools/run-all.sh /path/to/baseline
cd "$(dirname "$0")/.." || exit 1
BASE="$1"

for d in node_modules audit-tools/node_modules "$HOME/node_modules" /tmp/claude-*/*/*/scratchpad/node_modules; do
    [ -d "$d/acorn" ] && export NODE_PATH="$d" && break
done
if ! node -e "require('acorn')" 2>/dev/null; then
    echo "⚠️  ត្រូវការ acorn — រត់៖  npm i acorn"
    echo "   (ការត្រួតពិនិត្យ ១១ នឹងត្រូវរំលង)"
    NO_ACORN=1
fi

pass=0; fail=0; skip=0; partial=0

# ⛔ ពិដានពេលវេលាក្នុងមួយ checker។
# មូលហេតុ៖ checker ដែល **ព្យួរ** មិនធ្វើឲ្យ CI ក្រហមដែលអានបានទេ — វាធ្វើឲ្យ
# GitHub **cancel job ទាំងមូល** នៅនាទីទី ៣០ ដោយបន្សល់ log ដែលឈប់ត្រឹមកណ្តាល
# គ្មានឈ្មោះ checker ដែលខូចសោះ។ វាកើតឡើងពិត ២ ដង៖ `main` (`a465af9`,
# 2026-08-26) និង PR #96 (2026-08-27) — ទាំង ២ ដងឈប់ត្រង់កន្លែងតែមួយ
# (`sw-install-integrity-test.js`) ដោយ `await navigator.serviceWorker.ready`
# គ្មានពិដាន។ ការស្តារនៅកម្រិត checker នីមួយៗមិនគ្រប់គ្រាន់ទេ — ថ្នាក់នេះ
# ត្រូវបិទ **តាមរចនាសម្ព័ន្ធ** ត្រង់នេះ ដើម្បីឲ្យការព្យួរថ្មីណាមួយក្នុង
# អនាគត ក្លាយជា «*** FAIL *** (ព្យួរ)» ដែលមានឈ្មោះ ជំនួសការស្ងាត់។
CHECKER_TIMEOUT="${CHECKER_TIMEOUT:-300}"
if command -v timeout >/dev/null 2>&1; then
    HAS_TIMEOUT=1
else
    HAS_TIMEOUT=0
    echo "⚠️  គ្មាន \`timeout\` — checker ដែលព្យួរនឹងព្យួររហូត"
fi

run() {
    local label="$1"; shift
    printf '  %-32s ' "$label"
    local rc=0
    if [ "$HAS_TIMEOUT" = 1 ]; then
        out=$(timeout -k 10 "$CHECKER_TIMEOUT" "$@" 2>&1) || rc=$?
    else
        out=$("$@" 2>&1) || rc=$?
    fi
    if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
        echo "*** FAIL *** (ព្យួរ — លើសពិដាន ${CHECKER_TIMEOUT}s)"
        printf '%s\n' "$out" | sed 's/^/      /'
        fail=$((fail+1))
        return
    fi
    if [ "$rc" -eq 0 ]; then
        n=$(printf '%s\n' "$out" | grep -cE 'ok    ')
        skip_line=$(printf '%s\n' "$out" | grep -m1 '^SKIP' || true)
        if [ -n "$skip_line" ]; then
            if [ "$n" -gt 0 ]; then
                echo "PARTIAL PASS ($n; $skip_line)"
                partial=$((partial+1))
            else
                echo "SKIPPED (${skip_line#SKIP })"
                skip=$((skip+1))
            fi
        else
            [ "$n" -gt 0 ] && echo "PASS  ($n)" || echo "PASS"
            pass=$((pass+1))
        fi
    else
        echo "*** FAIL ***"; printf '%s\n' "$out" | sed 's/^/      /'
        fail=$((fail+1))
    fi
}
skipm() { printf '  %-32s SKIPPED (no acorn)\n' "$1"; skip=$((skip+1)); }

echo "== តេស្តឥរិយាបថ (រត់កូដពិតចេញពី app.js) =="
for t in policy-test auth-recovery-test keylist-consistency-test \
         license-grace-test license-clock-trust-test \
         license-clock-rollback-test license-record-race-test \
         cleanup-clock-guard-test expired-trash-retention-test khmer-timezone-test monotonic-gate-test \
         phone-suggest-test phone-search-swipe-test \
         pin-prompt-test biometric-unlock-test keygen-pin-flow-test \
         keygen-session-security-test \
         barcode-shape-test setup-link-logout-test \
         raw-read-shape-test devtools-guard-test concurrent-scan-test \
         restore-finalization-fence-test \
         restore-race-test clear-history-claim-test google-sheets-cache-test \
         lookup-config-secret-test \
         clear-history-finalization-fence-test \
         setup-link-roundtrip-test export-cells-test dependency-security-test firebase-backup-test camera-resume-test \
         trash-modal-test partial-pickup-cleanup-test restore-marker-hygiene-test \
         firebase-config-paste-test \
         connection-recovery-test reconnect-ladder-test sw-cache-failure-test \
         sw-abort-propagation-test \
         stall-guard-test \
         periodic-network-guard-test \
         pickup-ledger-test pickup-repair-test pickup-reset-test pickup-barcode-identity-test \
         revenue-rules-clamp-test price-edit-abort-test registry-release-test late-commit-test \
         listener-pending-key-test history-patch-retry-test lookup-prefetch-test \
         lookup-freshness-test zto-proxy-test zto-budget-test zto-negative-cache-test zto-cookie-sync-test zto-cookie-store-test lookup-failure-identity-test \
         lookup-burst-test health-check-test monthly-report-test zto-network-boundaries-test \
         zto-cookie-session-test zto-cookie-capture-test zto-signed-status-test \
         zto-list-sync-test; do
    run "$t" node "audit-tools/$t.js"
done

echo
echo "== ការត្រួតពិនិត្យរចនាសម្ព័ន្ធ =="
for t in shared-fns wiring function-surface-test code-duplication-test dom-hygiene state-hygiene comments payload-schema compensation-order stale-write storage-guard secret-hygiene html-sink-escaping clock-hygiene clock-basis-test doc-scope-test adaptive-link-test version-check; do
    [ -n "$NO_ACORN" ] && { skipm "$t"; continue; }
    run "$t" node "audit-tools/$t.js"
done
# ⛔ meta-checker៖ តើ checker ខ្លួនវាពិតជាមើលកូដមែនទេ? (រត់វាមុនគេក្នុងក្រុមនេះ)
run "checker-coverage (meta)" node audit-tools/checker-coverage.js
run "hang-guard (meta)" node audit-tools/hang-guard.js
run "exit-code-integrity (meta)" node audit-tools/exit-code-integrity.js
run "version-bump-scope" node audit-tools/version-bump-scope.js
run "semantic-ui-color" node audit-tools/semantic-ui-color-test.js
run "user-guide" node audit-tools/user-guide-test.js
run "sdk-surface" node audit-tools/sdk-surface.js
run "rules-duplicate-keys" node audit-tools/rules-duplicate-keys.js
run "netlify-config-scope" node audit-tools/netlify-config-scope-test.js
# ⛔ តេស្ត emulator ៖ CI រត់ពួកវា ដូច្នេះ `run-all.sh` ត្រូវរត់ពួកវាដែរ។
# មុនកំណែ 2.20.1 ពួកវា **រត់តែក្នុង CI** ➜ ការប្តូរ `app.js` ដែលធ្វើឲ្យ
# sandbox របស់វាខូច បង្ហាញជាបៃតងនៅមូលដ្ឋាន រួចក្រហមនៅ CI ក្រោយ push។
# គ្មាន emulator ➜ SKIP ស្អាត (CI ដាក់ `CRUD_FLOW_STRICT=1` ដែលធ្វើឲ្យ
# SKIP នោះក្លាយជាការធ្លាក់ ➜ CI មិនបៃតងក្លែងក្លាយទេ)។
run "emu/crud-rules-flow" node audit-tools/emu/crud-rules-flow.js
run "emu/restore-deadlock" node audit-tools/emu/restore-deadlock-test.js
run "emu/ledger-revert" node audit-tools/emu/ledger-revert-emu-test.js
run "emu/restore-mutation" node audit-tools/emu/restore-mutation-emu-test.js
# ⛔ «សំណុំបៃតង» មិនមែនភស្តុតាង — ឧបករណ៍នេះបំបែកតក្កវិជ្ជាលុយដោយចេតនា
# រួចទាមទារថា **អ្នកយាមយ៉ាងតិច ១ ត្រូវក្រហម**។ បើអ្នកយាមចុងក្រោយងងឹត
# វាធ្លាក់ **មុន** កំហុសលុយបន្ទាប់ ship។
run "money-guardian" node audit-tools/money-guardian-test.js
run "css-classes" node audit-tools/css-classes.js
run "css-media-override" node audit-tools/css-media-override.js
run "css-var" node audit-tools/css-var-test.js
run "animation-cost" node audit-tools/animation-cost.js
run "layout-thrash (browser ពិត)" node audit-tools/layout-thrash.js
run "panel-motion (browser ពិត)" node audit-tools/panel-motion-test.js
run "ios-panel-glide (browser ពិត)" node audit-tools/ios-panel-glide-test.js
run "panel-snap-ownership" node audit-tools/panel-snap-ownership-test.js
run "boot-runtime (browser ពិត)" node audit-tools/boot-runtime.js
run "sdk-offline-boot (browser ពិត)" node audit-tools/sdk-offline-boot-test.js
run "setup-link (browser ពិត)" node audit-tools/setup-link-browser-test.js
run "ui-flow (browser ពិត)"    node audit-tools/ui-flow-test.js
run "page-nav (browser ពិត)"   node audit-tools/page-nav-test.js
run "gesture (browser ពិត)"    node audit-tools/gesture-test.js
run "history-menu (browser ពិត)" node audit-tools/history-menu-dismiss-test.js
run "zto-sync-banner (browser ពិត)" node audit-tools/zto-sync-banner-test.js
run "scan-engine (browser ពិត)" node audit-tools/scan-engine-test.js
run "duplicate-scan (browser ពិត)" node audit-tools/duplicate-scan-test.js
run "scan-remove (browser ពិត)" node audit-tools/scan-remove-mode-test.js
run "duplicate-money (browser ពិត)" node audit-tools/duplicate-money-test.js
run "item-money (browser ពិត)" node audit-tools/item-money-integrity-test.js
run "stats-truth (browser ពិត)" node audit-tools/stats-collected-truth-test.js
run "ledger-failed-apply-revert" node audit-tools/ledger-failed-apply-revert-test.js
run "ledger-clamp-symmetry (browser ពិត)" node audit-tools/ledger-clamp-symmetry-test.js
run "monthly-ledger-agreement" node audit-tools/monthly-ledger-agreement-test.js
run "stats-screen-agreement" node audit-tools/stats-screen-agreement-test.js
run "stats-measurable-gate" node audit-tools/stats-measurable-gate-test.js
run "collected-value-fuzz" node audit-tools/collected-value-fuzz-test.js
run "empty-state-truth" node audit-tools/empty-state-truth-test.js
run "registry-orphan-list" node audit-tools/registry-orphan-list-test.js
run "layout (browser ពិត)"     node audit-tools/layout-check.js
run "field-shape (browser ពិត)" node audit-tools/field-shape-test.js
run "slow-write (browser ពិត)"  node audit-tools/slow-write-test.js
run "revenue-fuzz (browser ពិត)" node audit-tools/revenue-fuzz-test.js
run "perf (browser ពិត)"       node audit-tools/perf-check.js
run "offline-shell (browser ពិត)" node audit-tools/offline-shell-test.js
run "sw-install-integrity (browser ពិត)" node audit-tools/sw-install-integrity-test.js
run "network-timeout (browser ពិត)" node audit-tools/network-timeout-test.js
run "sw-cache-key (browser ពិត)" node audit-tools/sw-cache-key-test.js
run "sentry-load-race (browser ពិត)" node audit-tools/sentry-load-race-test.js
run "sw-shell-latency (browser ពិត)" node audit-tools/sw-shell-latency-test.js
run "network-pressure (browser ពិត)" node audit-tools/network-pressure-test.js
run "license-net-pressure (browser ពិត)" node audit-tools/license-network-pressure-test.js
run "sw-revalidate-pressure (browser ពិត)" node audit-tools/sw-revalidate-pressure-test.js
run "boot-animation (browser ពិត)" node audit-tools/boot-animation-test.js
run "inline-handler-xss (browser ពិត)" node audit-tools/inline-handler-xss-test.js
run "csp-enforced (browser ពិត)" node audit-tools/csp-enforced-test.js
run "fluid-type-focus (browser ពិត)" node audit-tools/fluid-type-focus-test.js
run "toast-truth (browser ពិត)" node audit-tools/toast-truth-test.js
run "toast-action-truth (browser ពិត)" node audit-tools/toast-action-truth-test.js
run "csp-lazy-resource (browser ពិត)" node audit-tools/csp-lazy-resource-test.js
run "sheet-import (browser ពិត)" node audit-tools/sheet-import-test.js
run "app-lock (browser ពិត)" node audit-tools/app-lock-test.js
run "listener-leak (browser ពិត)" node audit-tools/listener-leak-test.js
run "storage-blocked-boot (browser ពិត)" node audit-tools/storage-blocked-boot-test.js
run "db-stall-guard" node audit-tools/db-stall-guard-test.js
run "write-stall-guard" node audit-tools/write-stall-guard-test.js
run "stall-lock-release" node audit-tools/stall-lock-release-test.js
run "locker-claim-guard" node audit-tools/locker-claim-guard-test.js
run "stale-clear-claim" node audit-tools/stale-clear-claim-test.js

echo
echo
echo "== ខ្សែសង្វាក់នាំចូល (zto-import) =="
# ⚠️ វាធ្លាប់នៅ **ក្រៅ** ឯកសារនេះ ដោយហេតុផលថា «មិនមែនជាផ្នែករបស់ App»។
# ការទុកវាក្រៅមានន័យថា assertion ៥០ រត់តែពេលមាននរណាម្នាក់ចាំវាយដោយដៃ។
# ⛔ ចំណាំ ៖ `zto-import` ជាខាង **server** នៃមុខងារ «នាំចូល Excel ទៅ Sheet»
# ដែលរស់នៅក្នុង ZoeW តាំងពីកំណែ 2.21.0 (App `ZoeImport` ត្រូវលុបចេញហើយ) ➜
# វាកាន់តែសំខាន់ជាងមុន។ ខាង client ចាក់សោដោយ `sheet-import-test.js`។
run "zto-import/test.js" node zto-import/test.js

echo "== ទម្លាប់គម្រោង =="
printf '  %-32s ' "node --check លើ app.js ទាំង ២"
if for a in ZoeW ZoeKeyGen; do node --check "$a/app.js" || exit 1; done; then
    echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi

printf '  %-32s ' "rules JSON valid"
if node -e "const fs=require('fs');JSON.parse(fs.readFileSync('firebase-database.rules.json','utf8'));JSON.parse(fs.readFileSync('ZoeKeyGen/firebase-database.rules.json','utf8'));" 2>/dev/null; then
    echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi

for f in license-verify.js error-reporting.js; do
    printf '  %-32s ' "$f byte-identical ×2"
    if [ "$(md5sum ZoeW/$f ZoeKeyGen/$f | awk '{print $1}' | sort -u | wc -l)" = "1" ]; then
        echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi
done

printf '  %-32s ' "គ្មាន trailing whitespace"
if [ "$(cat ZoeW/app.js ZoeKeyGen/app.js | grep -c '[[:space:]]$')" = "0" ]; then
    echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi

printf '  %-32s ' "CACHE_VERSION"
grep -h CACHE_VERSION ZoeW/sw.js ZoeKeyGen/sw.js | grep -o "'[a-z]*-v[0-9]*'" | tr '\n' ' '; echo

if [ -n "$BASE" ] && [ -d "$BASE" ]; then
    echo
    echo "== បញ្ជាក់ថាតេស្តមិនទទេ (រត់លើ $BASE) =="
    echo "   ខាងក្រោមនេះ *គួរតែធ្លាក់* — បើវាជោគជ័យ នោះតេស្តមិនចាប់អ្វីទេ"
    BARCODE_APP_DIR="$BASE" node audit-tools/barcode-shape-test.js 2>&1 | tail -1 | sed 's/^/   barcode-shape:   /'
    RAWREAD_APP_DIR="$BASE" node audit-tools/raw-read-shape-test.js 2>&1 | tail -1 | sed 's/^/   raw-read-shape:  /'
    DEVGUARD_APP_DIR="$BASE" node audit-tools/devtools-guard-test.js 2>&1 | tail -1 | sed 's/^/   devtools-guard:  /'
    CONCSCAN_APP_DIR="$BASE" node audit-tools/concurrent-scan-test.js 2>&1 | tail -1 | sed 's/^/   concurrent-scan: /'
    SETUPLINK_APP_DIR="$BASE" node audit-tools/setup-link-browser-test.js 2>&1 | tail -1 | sed 's/^/   setup-link:      /'
    UIFLOW_APP_DIR="$BASE" node audit-tools/ui-flow-test.js 2>&1 | tail -1 | sed 's/^/   ui-flow:         /'
    LAYOUT_APP_DIR="$BASE" node audit-tools/layout-check.js 2>&1 | tail -1 | sed 's/^/   layout:          /'
    FIELDSHAPE_APP_DIR="$BASE" node audit-tools/field-shape-test.js 2>&1 | tail -1 | sed 's/^/   field-shape:     /'
    SLOWWRITE_APP_DIR="$BASE" node audit-tools/slow-write-test.js 2>&1 | tail -1 | sed 's/^/   slow-write:      /'
    COMP_APP_DIR="$BASE" node audit-tools/compensation-order.js 2>&1 | tail -1 | sed 's/^/   compensation:    /'
    STALEWRITE_APP_DIR="$BASE" node audit-tools/stale-write.js 2>&1 | tail -1 | sed 's/^/   stale-write:     /'
    VERSION_APP_DIR="$BASE" node audit-tools/version-check.js 2>&1 | tail -1 | sed 's/^/   version-check:   /'
    SEMANTIC_UI_APP_DIR="$BASE" node audit-tools/semantic-ui-color-test.js 2>&1 | tail -1 | sed 's/^/   semantic-color:  /'
    USER_GUIDE_APP_DIR="$BASE" node audit-tools/user-guide-test.js 2>&1 | tail -1 | sed 's/^/   user-guide:      /'
    PERF_APP_DIR="$BASE" node audit-tools/perf-check.js 2>&1 | tail -1 | sed 's/^/   perf:            /'
    SETUP_APP_DIR="$BASE"   node audit-tools/setup-link-logout-test.js 2>&1 | tail -1 | sed 's/^/   setup-link:      /'
    PAGENAV_APP_DIR="$BASE" node audit-tools/page-nav-test.js 2>&1 | tail -1 | sed 's/^/   page-nav:        /'
    ZTOBANNER_APP_DIR="$BASE" node audit-tools/zto-sync-banner-test.js 2>&1 | tail -1 | sed 's/^/   zto-banner:      /'
    SWIPE_APP_DIR="$BASE" node audit-tools/phone-search-swipe-test.js 2>&1 | tail -1 | sed 's/^/   swipe-pullup:    /'
    PINPROMPT_APP_DIR="$BASE" node audit-tools/pin-prompt-test.js 2>&1 | tail -1 | sed 's/^/   pin-prompt:      /'
    CSSMEDIA_APP_DIR="$BASE" node audit-tools/css-media-override.js 2>&1 | tail -1 | sed 's/^/   css-media:       /'
    ANIM_APP_DIR="$BASE"    node audit-tools/animation-cost.js 2>&1 | tail -1 | sed 's/^/   animation-cost:  /'
    THRASH_APP_DIR="$BASE"  node audit-tools/layout-thrash.js 2>&1 | tail -1 | sed 's/^/   layout-thrash:   /'
    PANELMOTION_APP_DIR="$BASE" node audit-tools/panel-motion-test.js 2>&1 | tail -1 | sed 's/^/   panel-motion:    /'
    BIOMETRIC_APP_DIR="$BASE" node audit-tools/biometric-unlock-test.js 2>&1 | tail -1 | sed 's/^/   biometric:       /'
    POLICY_APP_DIR="$BASE"  node audit-tools/policy-test.js 2>&1 | tail -1 | sed 's/^/   policy:          /'
    PARTIAL_APP_DIR="$BASE" node audit-tools/partial-pickup-cleanup-test.js 2>&1 | tail -1 | sed 's/^/   partial-pickup:  /'
    LATECOMMIT_APP_DIR="$BASE" node audit-tools/late-commit-test.js 2>&1 | tail -1 | sed 's/^/   late-commit:     /'
    WRITESTALL_APP_DIR="$BASE" node audit-tools/write-stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   write-stall:     /'
    STALLLOCK_APP_DIR="$BASE" node audit-tools/stall-lock-release-test.js 2>&1 | tail -1 | sed 's/^/   stall-lock:      /'
    LOCKERCLAIM_APP_DIR="$BASE" node audit-tools/locker-claim-guard-test.js 2>&1 | tail -1 | sed 's/^/   locker-claim:    /'
    STALECLAIM_APP_DIR="$BASE" node audit-tools/stale-clear-claim-test.js 2>&1 | tail -1 | sed 's/^/   stale-clear:     /'
    MARKER_APP_DIR="$BASE" node audit-tools/restore-marker-hygiene-test.js 2>&1 | tail -1 | sed 's/^/   marker-hygiene:  /'
    GESTURE_APP_DIR="$BASE" node audit-tools/gesture-test.js 2>&1 | tail -1 | sed 's/^/   gesture:         /'
    HISTORYMENU_APP_DIR="$BASE" node audit-tools/history-menu-dismiss-test.js 2>&1 | tail -1 | sed 's/^/   history-menu:    /'
    SCAN_APP_DIR="$BASE"    node audit-tools/scan-engine-test.js 2>&1 | tail -1 | sed 's/^/   scan-engine:     /'
    CAMERA_APP_DIR="$BASE"  node audit-tools/camera-resume-test.js 2>&1 | tail -1 | sed 's/^/   camera-resume:   /'
    DUP_APP_DIR="$BASE"     node audit-tools/duplicate-scan-test.js 2>&1 | tail -1 | sed 's/^/   duplicate-scan:  /'
    SCANREMOVE_APP_DIR="$BASE" node audit-tools/scan-remove-mode-test.js 2>&1 | tail -1 | sed 's/^/   scan-remove:     /'
    DUPMONEY_APP_DIR="$BASE" node audit-tools/duplicate-money-test.js 2>&1 | tail -1 | sed 's/^/   duplicate-money: /'
    ITEMMONEY_APP_DIR="$BASE" node audit-tools/item-money-integrity-test.js 2>&1 | tail -1 | sed 's/^/   item-money:      /'
    STATSTRUTH_APP_DIR="$BASE" node audit-tools/stats-collected-truth-test.js 2>&1 | tail -1 | sed 's/^/   stats-truth:     /'
    LEDGERFAIL_APP_DIR="$BASE" node audit-tools/ledger-failed-apply-revert-test.js 2>&1 | tail -1 | sed 's/^/   ledger-failfirst:/'
    CLAMPSYM_APP_DIR="$BASE" node audit-tools/ledger-clamp-symmetry-test.js 2>&1 | tail -1 | sed 's/^/   clamp-symmetry:  /'
    MONTHLYAGREE_APP_DIR="$BASE" node audit-tools/monthly-ledger-agreement-test.js 2>&1 | tail -1 | sed 's/^/   monthly-agree:   /'
    STATSAGREE_APP_DIR="$BASE" node audit-tools/stats-screen-agreement-test.js 2>&1 | tail -1 | sed 's/^/   stats-agree:     /'
    STATSGATE_APP_DIR="$BASE" node audit-tools/stats-measurable-gate-test.js 2>&1 | tail -1 | sed 's/^/   stats-gate:      /'
    COLLECTFUZZ_APP_DIR="$BASE" node audit-tools/collected-value-fuzz-test.js 2>&1 | tail -1 | sed 's/^/   collect-fuzz:    /'
    EMPTYSTATE_APP_DIR="$BASE" node audit-tools/empty-state-truth-test.js 2>&1 | tail -1 | sed 's/^/   empty-state:     /'
    REGORPHANTEST_APP_DIR="$BASE" node audit-tools/registry-orphan-list-test.js 2>&1 | tail -1 | sed 's/^/   reg-orphan:      /'
    OFFLINE_APP_DIR="$BASE" node audit-tools/offline-shell-test.js 2>&1 | tail -1 | sed 's/^/   offline-shell:   /'
    SWINTEG_APP_DIR="$BASE" node audit-tools/sw-install-integrity-test.js 2>&1 | tail -1 | sed 's/^/   sw-install:      /'
    IOSGLIDE_APP_DIR="$BASE" node audit-tools/ios-panel-glide-test.js 2>&1 | tail -1 | sed 's/^/   ios-panel-glide: /'
    PANELSNAP_APP_DIR="$BASE" node audit-tools/panel-snap-ownership-test.js 2>&1 | tail -1 | sed 's/^/   panel-snap:     /'
    NETTIMEOUT_APP_DIR="$BASE" node audit-tools/network-timeout-test.js 2>&1 | tail -1 | sed 's/^/   network-timeout: /'
    SWKEY_APP_DIR="$BASE"   node audit-tools/sw-cache-key-test.js 2>&1 | tail -1 | sed 's/^/   sw-cache-key:    /'
    CONNRECOVERY_APP_DIR="$BASE" node audit-tools/connection-recovery-test.js 2>&1 | tail -1 | sed 's/^/   conn-recovery:   /'
    LADDER_APP_DIR="$BASE" node audit-tools/reconnect-ladder-test.js 2>&1 | tail -1 | sed 's/^/   reconnect-ladder:/'
    LICENSECLOCK_APP_DIR="$BASE" node audit-tools/license-clock-trust-test.js 2>&1 | tail -1 | sed 's/^/   license-clock:   /'
    CLEANUPCLOCK_APP_DIR="$BASE" node audit-tools/cleanup-clock-guard-test.js 2>&1 | tail -1 | sed 's/^/   cleanup-clock:   /'
    EXPIREDTRASH_APP_DIR="$BASE" node audit-tools/expired-trash-retention-test.js 2>&1 | tail -1 | sed 's/^/   expired-trash:   /'
    MONOGATE_APP_DIR="$BASE" node audit-tools/monotonic-gate-test.js 2>&1 | tail -1 | sed 's/^/   monotonic-gate:  /'
    KHMERTZ_APP_DIR="$BASE" node audit-tools/khmer-timezone-test.js 2>&1 | tail -1 | sed 's/^/   khmer-tz:        /'
    SENTRYRACE_APP_DIR="$BASE" node audit-tools/sentry-load-race-test.js 2>&1 | tail -1 | sed 's/^/   sentry-race:     /'
    SWLATENCY_APP_DIR="$BASE" node audit-tools/sw-shell-latency-test.js 2>&1 | tail -1 | sed 's/^/   sw-shell-latency:/'
    NETPRESSURE_APP_DIR="$BASE" node audit-tools/network-pressure-test.js 2>&1 | tail -1 | sed 's/^/   network-pressure:/'
    LICPRESSURE_APP_DIR="$BASE" node audit-tools/license-network-pressure-test.js 2>&1 | tail -1 | sed 's/^/   license-pressure:/'
    ADAPTIVE_APP_DIR="$BASE" node audit-tools/adaptive-link-test.js 2>&1 | tail -1 | sed 's/^/   adaptive-link:   /'
    SWREVAL_APP_DIR="$BASE" node audit-tools/sw-revalidate-pressure-test.js 2>&1 | tail -1 | sed 's/^/   sw-revalidate:   /'
    SWFAIL_APP_DIR="$BASE"  node audit-tools/sw-cache-failure-test.js 2>&1 | tail -1 | sed 's/^/   sw-cache-failure:/'
    SWABORT_APP_DIR="$BASE" node audit-tools/sw-abort-propagation-test.js 2>&1 | tail -1 | sed 's/^/   sw-abort:        /'
    PERIODICGUARD_APP_DIR="$BASE" node audit-tools/periodic-network-guard-test.js 2>&1 | tail -1 | sed 's/^/   periodic-guard:   /'
    PICKUP_APP_DIR="$BASE"  node audit-tools/pickup-ledger-test.js 2>&1 | tail -1 | sed 's/^/   pickup-ledger:   /'
    PICKUPREPAIR_APP_DIR="$BASE" node audit-tools/pickup-repair-test.js 2>&1 | tail -1 | sed 's/^/   pickup-repair:   /'
    PICKUPRESET_APP_DIR="$BASE" node audit-tools/pickup-reset-test.js 2>&1 | tail -1 | sed 's/^/   pickup-reset:    /'
    PICKUPID_APP_DIR="$BASE" node audit-tools/pickup-barcode-identity-test.js 2>&1 | tail -1 | sed 's/^/   pickup-identity: /'
    REVCLAMP_APP_DIR="$BASE" node audit-tools/revenue-rules-clamp-test.js 2>&1 | tail -1 | sed 's/^/   revenue-clamp:   /'
    PRICEABORT_APP_DIR="$BASE" node audit-tools/price-edit-abort-test.js 2>&1 | tail -1 | sed 's/^/   price-edit-abort:/'
    REGISTRY_APP_DIR="$BASE" node audit-tools/registry-release-test.js 2>&1 | tail -1 | sed 's/^/   registry-rel:    /'
    PENDINGKEY_APP_DIR="$BASE" node audit-tools/listener-pending-key-test.js 2>&1 | tail -1 | sed 's/^/   pending-key:     /'
    HISTPATCH_APP_DIR="$BASE" node audit-tools/history-patch-retry-test.js 2>&1 | tail -1 | sed 's/^/   history-patch:   /'
    LOOKUPPREFETCH_APP_DIR="$BASE" node audit-tools/lookup-prefetch-test.js 2>&1 | tail -1 | sed 's/^/   lookup-prefetch: /'
    LOOKUPFRESH_APP_DIR="$BASE" node audit-tools/lookup-freshness-test.js 2>&1 | tail -1 | sed 's/^/   lookup-freshness:/'
    LOOKUPFAILURE_APP_DIR="$BASE" node audit-tools/lookup-failure-identity-test.js 2>&1 | tail -1 | sed 's/^/   lookup-failure-identity:/'
    LOOKUPBURST_APP_DIR="$BASE" node audit-tools/lookup-burst-test.js 2>&1 | tail -1 | sed 's/^/   lookup-burst:  /'
    HEALTH_APP_DIR="$BASE" node audit-tools/health-check-test.js 2>&1 | tail -1 | sed 's/^/   health-check:  /'
    ZTOPROXY_APP_DIR="$BASE" node audit-tools/zto-proxy-test.js 2>&1 | tail -1 | sed 's/^/   zto-proxy:       /'
    ZTOBUDGET_APP_DIR="$BASE" node audit-tools/zto-budget-test.js 2>&1 | tail -1 | sed 's/^/   zto-budget:      /'
    ZTONEG_APP_DIR="$BASE" node audit-tools/zto-negative-cache-test.js 2>&1 | tail -1 | sed 's/^/   zto-neg-cache:   /'
    ZTO_SYNC_APP_DIR="$BASE" node audit-tools/zto-cookie-sync-test.js 2>&1 | tail -1 | sed 's/^/   zto-cookie-sync: /'
    ZTO_BOUNDARIES_APP_DIR="$BASE" node audit-tools/zto-network-boundaries-test.js 2>&1 | tail -1 | sed 's/^/   zto-boundaries:  /'
    ZTO_SESSION_APP_DIR="$BASE" node audit-tools/zto-cookie-session-test.js 2>&1 | tail -1 | sed 's/^/   zto-session:     /'
    ZTO_CAPTURE_APP_DIR="$BASE" node audit-tools/zto-cookie-capture-test.js 2>&1 | tail -1 | sed 's/^/   zto-capture:     /'
    ZTOSTORE_APP_DIR="$BASE" node audit-tools/zto-cookie-store-test.js 2>&1 | tail -1 | sed 's/^/   zto-cookie-store:/'
    ZTOSIGNED_APP_DIR="$BASE" node audit-tools/zto-signed-status-test.js 2>&1 | tail -1 | sed 's/^/   zto-signed:      /'
    ZTOLIST_APP_DIR="$BASE" node audit-tools/zto-list-sync-test.js 2>&1 | tail -1 | sed 's/^/   zto-list-sync:   /'
    DEPSEC_APP_DIR="$BASE" node audit-tools/dependency-security-test.js 2>&1 | tail -1 | sed 's/^/   dependency-sec:  /'
    FBACKUP_APP_DIR="$BASE" node audit-tools/firebase-backup-test.js 2>&1 | tail -1 | sed 's/^/   firebase-backup: /'
    CRUDFLOW_APP_DIR="$BASE" node audit-tools/emu/crud-rules-flow.js 2>&1 | tail -1 | sed 's/^/   emu-crud-flow:   /'
    DEADLOCK_APP_DIR="$BASE" node audit-tools/emu/restore-deadlock-test.js 2>&1 | tail -1 | sed 's/^/   emu-deadlock:    /'
    LEDGEREMU_APP_DIR="$BASE" node audit-tools/emu/ledger-revert-emu-test.js 2>&1 | tail -1 | sed 's/^/   emu-ledger-rev:  /'
    RESTOREMUTATION_APP_DIR="$BASE" node audit-tools/emu/restore-mutation-emu-test.js 2>&1 | tail -1 | sed 's/^/   restore-mutation:/'
    MONEYGUARD_APP_DIR="$BASE" node audit-tools/money-guardian-test.js 2>&1 | tail -1 | sed 's/^/   money-guardian:  /'
    HANGGUARD_APP_DIR="$BASE" node audit-tools/hang-guard.js 2>&1 | tail -1 | sed 's/^/   hang-guard:      /'
    EXITCODE_APP_DIR="$BASE" node audit-tools/exit-code-integrity.js 2>&1 | tail -1 | sed 's/^/   exit-code:       /'
    VERSIONSCOPE_APP_DIR="$BASE" node audit-tools/version-bump-scope.js 2>&1 | tail -1 | sed 's/^/   version-scope:   /'
    BOOTANIM_APP_DIR="$BASE" node audit-tools/boot-animation-test.js 2>&1 | tail -1 | sed 's/^/   boot-animation:  /'
    INLINEXSS_APP_DIR="$BASE" node audit-tools/inline-handler-xss-test.js 2>&1 | tail -1 | sed 's/^/   inline-xss:      /'
    CSP_APP_DIR="$BASE" node audit-tools/csp-enforced-test.js 2>&1 | tail -1 | sed 's/^/   csp-enforced:    /'
    FLUIDTYPE_APP_DIR="$BASE" node audit-tools/fluid-type-focus-test.js 2>&1 | tail -1 | sed 's/^/   fluid-type:      /'
    TOAST_APP_DIR="$BASE" node audit-tools/toast-truth-test.js 2>&1 | tail -1 | sed 's/^/   toast-truth:     /'
    TOAST_ACTION_APP_DIR="$BASE" node audit-tools/toast-action-truth-test.js 2>&1 | tail -1 | sed 's/^/   toast-actions:   /'
    CSPLAZY_APP_DIR="$BASE" node audit-tools/csp-lazy-resource-test.js 2>&1 | tail -1 | sed 's/^/   csp-lazy:        /'
    AUTH_APP_DIR="$BASE" node audit-tools/auth-recovery-test.js 2>&1 | tail -1 | sed 's/^/   auth-recovery:   /'
    BOOT_APP_DIR="$BASE" node audit-tools/boot-runtime.js 2>&1 | tail -1 | sed 's/^/   boot-runtime:    /'
    CLEARCLAIM_APP_DIR="$BASE" node audit-tools/clear-history-claim-test.js 2>&1 | tail -1 | sed 's/^/   clear-history-claim:/'
    CLEARFENCE_APP_DIR="$BASE" node audit-tools/clear-history-finalization-fence-test.js 2>&1 | tail -1 | sed 's/^/   clear-history-finalization-fence:/'
    CLOCK_APP_DIR="$BASE" node audit-tools/clock-hygiene.js 2>&1 | tail -1 | sed 's/^/   clock-hygiene:   /'
    CLOCKBASIS_APP_DIR="$BASE" node audit-tools/clock-basis-test.js 2>&1 | tail -1 | sed 's/^/   clock-basis:     /'
    DOCSCOPE_APP_DIR="$BASE" node audit-tools/doc-scope-test.js 2>&1 | tail -1 | sed 's/^/   doc-scope:       /'
    COMMENTS_APP_DIR="$BASE" node audit-tools/comments.js 2>&1 | tail -1 | sed 's/^/   comments:        /'
    CSSCLASS_APP_DIR="$BASE" node audit-tools/css-classes.js 2>&1 | tail -1 | sed 's/^/   css-classes:     /'
    CSSVAR_APP_DIR="$BASE" node audit-tools/css-var-test.js 2>&1 | tail -1 | sed 's/^/   css-var:         /'
    DOMHYG_APP_DIR="$BASE" node audit-tools/dom-hygiene.js 2>&1 | tail -1 | sed 's/^/   dom-hygiene:     /'
    EXPORT_APP_DIR="$BASE" node audit-tools/export-cells-test.js 2>&1 | tail -1 | sed 's/^/   export-cells:    /'
    MREPORT_APP_DIR="$BASE" node audit-tools/monthly-report-test.js 2>&1 | tail -1 | sed 's/^/   monthly-report:  /'
    CFGPASTE_APP_DIR="$BASE" node audit-tools/firebase-config-paste-test.js 2>&1 | tail -1 | sed 's/^/   firebase-config-paste:/'
    SHEETCACHE_APP_DIR="$BASE" node audit-tools/google-sheets-cache-test.js 2>&1 | tail -1 | sed 's/^/   google-sheets-cache:/'
    SINK_APP_DIR="$BASE" node audit-tools/html-sink-escaping.js 2>&1 | tail -1 | sed 's/^/   html-sink-escaping:/'
    KEYGEN_APP_DIR="$BASE" node audit-tools/keygen-pin-flow-test.js 2>&1 | tail -1 | sed 's/^/   keygen-pin-flow: /'
    KEYLIST_APP_DIR="$BASE" node audit-tools/keylist-consistency-test.js 2>&1 | tail -1 | sed 's/^/   keylist-consistency:/'
    LICGRACE_APP_DIR="$BASE" node audit-tools/license-grace-test.js 2>&1 | tail -1 | sed 's/^/   license-grace:   /'
    LICROLLBACK_APP_DIR="$BASE" node audit-tools/license-clock-rollback-test.js 2>&1 | tail -1 | sed 's/^/   license-rollback:/'
    LICRACE_APP_DIR="$BASE" node audit-tools/license-record-race-test.js 2>&1 | tail -1 | sed 's/^/   license-race:    /'
    LOOKUPSEC_APP_DIR="$BASE" node audit-tools/lookup-config-secret-test.js 2>&1 | tail -1 | sed 's/^/   lookup-config-secret:/'
    PAYLOAD_APP_DIR="$BASE" node audit-tools/payload-schema.js 2>&1 | tail -1 | sed 's/^/   payload-schema:  /'
    PHONE_APP_DIR="$BASE" node audit-tools/phone-suggest-test.js 2>&1 | tail -1 | sed 's/^/   phone-suggest:   /'
    RESTOREFENCE_APP_DIR="$BASE" node audit-tools/restore-finalization-fence-test.js 2>&1 | tail -1 | sed 's/^/   restore-finalization-fence:/'
    RESTORERACE_APP_DIR="$BASE" node audit-tools/restore-race-test.js 2>&1 | tail -1 | sed 's/^/   restore-race:    /'
    FUZZ_APP_DIR="$BASE" node audit-tools/revenue-fuzz-test.js 2>&1 | tail -1 | sed 's/^/   revenue-fuzz:    /'
    RULESDUP_APP_DIR="$BASE" node audit-tools/rules-duplicate-keys.js 2>&1 | tail -1 | sed 's/^/   rules-duplicate-keys:/'
    NETLIFYSCOPE_APP_DIR="$BASE" node audit-tools/netlify-config-scope-test.js 2>&1 | tail -1 | sed 's/^/   netlify-config-scope:/'
    SDKBOOT_APP_DIR="$BASE" node audit-tools/sdk-offline-boot-test.js 2>&1 | tail -1 | sed 's/^/   sdk-offline-boot:/'
    SDKSURFACE_APP_DIR="$BASE" node audit-tools/sdk-surface.js 2>&1 | tail -1 | sed 's/^/   sdk-surface:     /'
    SECRET_APP_DIR="$BASE" node audit-tools/secret-hygiene.js 2>&1 | tail -1 | sed 's/^/   secret-hygiene:  /'
    SETUPRT_APP_DIR="$BASE" node audit-tools/setup-link-roundtrip-test.js 2>&1 | tail -1 | sed 's/^/   setup-link-roundtrip:/'
    SHAREDFNS_APP_DIR="$BASE" node audit-tools/shared-fns.js 2>&1 | tail -1 | sed 's/^/   shared-fns:      /'
    STATEHYG_APP_DIR="$BASE" node audit-tools/state-hygiene.js 2>&1 | tail -1 | sed 's/^/   state-hygiene:   /'
    STORAGE_APP_DIR="$BASE" node audit-tools/storage-guard.js 2>&1 | tail -1 | sed 's/^/   storage-guard:   /'
    TRASH_APP_DIR="$BASE" node audit-tools/trash-modal-test.js 2>&1 | tail -1 | sed 's/^/   trash-modal-test:/'
    WIRING_APP_DIR="$BASE" node audit-tools/wiring.js 2>&1 | tail -1 | sed 's/^/   wiring:          /'
    FNSURFACE_APP_DIR="$BASE" node audit-tools/function-surface-test.js 2>&1 | tail -1 | sed 's/^/   function-surface: /'
    DUPCODE_APP_DIR="$BASE" node audit-tools/code-duplication-test.js 2>&1 | tail -1 | sed 's/^/   code-duplication: /'
    SHEETIMPORT_APP_DIR="$BASE" node audit-tools/sheet-import-test.js 2>&1 | tail -1 | sed 's/^/   sheet-import:    /'
    ZTO_IMPORT_APP_DIR="$BASE/zto-import" node zto-import/test.js 2>&1 | tail -1 | sed 's/^/   zto-import:      /'
    APPLOCK_APP_DIR="$BASE" node audit-tools/app-lock-test.js 2>&1 | tail -1 | sed 's/^/   app-lock:        /'
    LEAK_APP_DIR="$BASE" node audit-tools/listener-leak-test.js 2>&1 | tail -1 | sed 's/^/   listener-leak:   /'
    STALLGUARD_APP_DIR="$BASE" node audit-tools/stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   stall-guard:     /'
    STORAGEBOOT_APP_DIR="$BASE" node audit-tools/storage-blocked-boot-test.js 2>&1 | tail -1 | sed 's/^/   storage-boot:    /'
    DBSTALL_APP_DIR="$BASE" node audit-tools/db-stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   db-stall-guard:  /'
fi

echo
echo "==================================="
if [ "$fail" -eq 0 ]; then
    echo "✅ ជោគជ័យទាំងអស់  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
else
    echo "❌ ធ្លាក់ $fail  (ជោគជ័យ $pass, មួយផ្នែក $partial, រំលង $skip)"
fi
exit "$fail"
