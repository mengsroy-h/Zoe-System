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
    echo "   (ការត្រួតពិនិត្យ ៤ នឹងត្រូវរំលង)"
    NO_ACORN=1
fi

pass=0; fail=0; skip=0
run() {
    local label="$1"; shift
    printf '  %-32s ' "$label"
    if out=$("$@" 2>&1); then
        n=$(printf '%s' "$out" | grep -cE 'ok    ')
        [ "$n" -gt 0 ] && echo "PASS  ($n)" || echo "PASS"
        pass=$((pass+1))
    else
        echo "*** FAIL ***"; printf '%s\n' "$out" | tail -12 | sed 's/^/      /'
        fail=$((fail+1))
    fi
}
skipm() { printf '  %-32s SKIPPED (no acorn)\n' "$1"; skip=$((skip+1)); }

echo "== តេស្តឥរិយាបថ (រត់កូដពិតចេញពី app.js) =="
for t in policy-test lookup-closed-test auth-recovery-test keylist-consistency-test \
         license-grace-test phone-suggest-test zoescan-list-test keygen-pin-flow-test \
         barcode-shape-test setup-link-logout-test phone-search-swipe-test \
         raw-read-shape-test; do
    run "$t" node "audit-tools/$t.js"
done

echo
echo "== ការត្រួតពិនិត្យរចនាសម្ព័ន្ធ =="
run "extract.js (ZoeAdmin vs ZoeW)" node audit-tools/extract.js /tmp/zoe-fns
for t in shared-fns wiring dom-hygiene state-hygiene comments payload-schema; do
    [ -n "$NO_ACORN" ] && { skipm "$t"; continue; }
    run "$t" node "audit-tools/$t.js"
done
run "css-classes" node audit-tools/css-classes.js
run "boot-runtime (browser ពិត)" node audit-tools/boot-runtime.js

echo
echo "== ទម្លាប់គម្រោង =="
printf '  %-32s ' "node --check លើ app.js ទាំង ៤"
if for a in ZoeAdmin ZoeW Zoescan ZoeKeyGen; do node --check "$a/app.js" || exit 1; done; then
    echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi

printf '  %-32s ' "rules JSON valid"
if python3 -c "import json;json.load(open('firebase-database.rules.json'));json.load(open('ZoeKeyGen/firebase-database.rules.json'))" 2>/dev/null; then
    echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi

for f in license-verify.js error-reporting.js; do
    printf '  %-32s ' "$f byte-identical ×4"
    if [ "$(md5sum ZoeAdmin/$f ZoeW/$f Zoescan/$f ZoeKeyGen/$f | awk '{print $1}' | sort -u | wc -l)" = "1" ]; then
        echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi
done

printf '  %-32s ' "គ្មាន trailing whitespace"
if [ "$(cat ZoeAdmin/app.js ZoeW/app.js Zoescan/app.js ZoeKeyGen/app.js | grep -c '[[:space:]]$')" = "0" ]; then
    echo "PASS"; pass=$((pass+1)); else echo "*** FAIL ***"; fail=$((fail+1)); fi

printf '  %-32s ' "CACHE_VERSION"
grep -h CACHE_VERSION ZoeAdmin/sw.js ZoeW/sw.js Zoescan/sw.js ZoeKeyGen/sw.js | grep -o "'[a-z]*-v[0-9]*'" | tr '\n' ' '; echo

if [ -n "$BASE" ] && [ -d "$BASE" ]; then
    echo
    echo "== បញ្ជាក់ថាតេស្តមិនទទេ (រត់លើ $BASE) =="
    echo "   ខាងក្រោមនេះ *គួរតែធ្លាក់* — បើវាជោគជ័យ នោះតេស្តមិនចាប់អ្វីទេ"
    BARCODE_APP_DIR="$BASE" node audit-tools/barcode-shape-test.js 2>&1 | tail -1 | sed 's/^/   barcode-shape:   /'
    RAWREAD_APP_DIR="$BASE" node audit-tools/raw-read-shape-test.js 2>&1 | tail -1 | sed 's/^/   raw-read-shape:  /'
    SETUP_APP_DIR="$BASE"   node audit-tools/setup-link-logout-test.js 2>&1 | tail -1 | sed 's/^/   setup-link:      /'
    SWIPE_APP_DIR="$BASE"   node audit-tools/phone-search-swipe-test.js 2>&1 | tail -1 | sed 's/^/   phone-swipe:     /'
fi

echo
echo "==================================="
if [ "$fail" -eq 0 ]; then
    echo "✅ ជោគជ័យទាំងអស់  ($pass ការត្រួតពិនិត្យ, រំលង $skip)"
else
    echo "❌ ធ្លាក់ $fail  (ជោគជ័យ $pass, រំលង $skip)"
fi
exit "$fail"
