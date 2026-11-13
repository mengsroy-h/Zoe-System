#!/usr/bin/env bash
# រត់ការត្រួតពិនិត្យ audit ទាំងអស់ដោយមិនចាំបាច់ប្រើ AI ។
#   bash audit-tools/run-all.sh
# ប្រៀបធៀបនឹង tree ផ្សេង (ឧ. មុនកែ) ដើម្បីបញ្ជាក់ថាតេស្តមិនទទេ៖
#   bash audit-tools/run-all.sh /path/to/baseline
# ការរត់ស្របគ្នា · state ដែលបន្តបាន (ពន្យល់ពេញក្នុង audit-tools/README.md ផ្នែក «run-all.sh») ៖
#   RUNALL_JOBS=N          lane ស្របគ្នា (លំនាំដើម = ចំនួន CPU ក្នុងព្រំដែន 2–6 · 1 = ជាជួរ)
#   RUNALL_PROGRESS=0      បិទបន្ទាត់ចាប់ផ្តើម/ចប់ភ្លាម (លំនាំដើមបើក; លទ្ធផលលម្អិតនៅតាមលំដាប់)
#   RUNALL_BROWSER_JOBS=N  checker browser ស្របគ្នាអតិបរមា
#   RUNALL_STATE=<ផ្លូវ>   ឯកសារលទ្ធផល (លំនាំដើម <git-dir>/zoe-runall-state.tsv · ទទេ = បិទ)
#   RUNALL_RESUME=1        រត់ checker ដែលមិនទាន់ PASS ពេញលេញ លើ tree ដដែល
#   RUNALL_ONLY=a,b        រត់តែ checker ដែលមានឈ្មោះ (ស្លាក ឬ audit-tools/<ឈ្មោះ>.js)
#   RUNALL_SHARD=k/n       រត់តែផ្នែកទី k ក្នុង n (CI ៖ job ស្របគ្នាលើ runner ច្រើន · ផ្នែកទាំង n រួមគ្នា = បញ្ជីពេញ)
#   CHECKER_TIMEOUT=N     កំណត់ដោយផ្ទាល់សម្រាប់គ្រប់ checker; លំនាំដើម 300s, money matrix RTDB 2400s / Supabase 3000s
RUNALL_CALLER_PWD="$PWD"
BASE="${1:-}"
if [ "$#" -gt 0 ]; then
    case "$BASE" in ''|/*) ;; *) BASE="$RUNALL_CALLER_PWD/$BASE" ;; esac
    if [ -z "$BASE" ] || [ ! -d "$BASE" ] || ! BASE="$(cd -- "$BASE" 2>/dev/null && pwd -P)"; then
        echo "*** FAIL *** baseline ត្រូវជាថតដែលមានពិត និងអាចចូលបានពីថតអ្នកហៅ"
        exit 2
    fi
fi
cd "$(dirname "$0")/.." || exit 1
IMPORTPAIRED_BASE_SOURCE="${IMPORTPAIRED_BASE_SOURCE:-$BASE}"

# ── ZoeW React ៖ checker វាស់ «root វាស់» មិនមែនប្រភព ─────────────────────────
# ZoeW ជា React (`ZoeW/src/**` ➜ Vite)។ checker ស្រង់ function ពី `ZoeW/app.js` · អាន markup ពី
# `ZoeW/index.html` · បើក App ក្នុង browser ➜ ទាំងនោះរស់នៅ **build វាស់** (`audit-tools/zoew/scripts/build-audit.mjs`
# ➜ `ZoeW/dist-audit/ZoeW` ៖ ទិដ្ឋភាពអត្ថបទនៃ src ពិត + bundle Vite ពិត + prerender)។ ដូច្នេះ run-all ៖
#   ១. build វាស់ពីប្រភពពិត (ធ្លាក់ ➜ FAIL មិនមែនវាស់ build ចាស់)
#   ២. ផ្គុំ root វាស់ ៖ ឯកសារ repo ទាំងអស់ លើកលែង ZoeW/ ដែលជំនួសដោយ build វាស់
#   ៣. រត់ខ្លួនឯងឡើងវិញក្នុង root នោះ ➜ checker ទាំងអស់ (និង checker-coverage) ឃើញ tree តែមួយ
# ⛔ checker ដែលវាស់ **repo** (git · ប្រភព) ចង្អុលទៅ repo ពិតតាម env ខាងក្រោម។
# ⛔ `$BASE` (tree មុនកែ) ដែលជា React ក៏ត្រូវ build វាស់ដែរ; tree vanilla រត់ត្រង់ៗដូចមុន។
zoe_measure_root() (  # <src root> <dst> <copy-mode: git|tar>
    set -o pipefail
    local src="$1" dst="$2" mode="$3"
    rm -rf "$dst" && mkdir -p "$dst" || return 1
    if [ "$mode" = git ]; then
        (cd "$src" && git ls-files -z --cached --others --exclude-standard | grep -zv '^ZoeW/' \
            | tar --null -T - -cf -) | tar -xf - -C "$dst" || return 1
        [ -f "$src/audit-tools/emu/real.rules.json" ] && cp "$src/audit-tools/emu/real.rules.json" "$dst/audit-tools/emu/"
    else
        tar -C "$src" --exclude=./ZoeW --exclude=./node_modules --exclude=./.git -cf - . | tar -xf - -C "$dst" || return 1
    fi
    cp -r "$src/ZoeW/dist-audit/ZoeW" "$dst/ZoeW" || return 1
    ln -s "$ZOE_NODE_MODULES" "$dst/node_modules"
)
# hash របស់ tree សម្រាប់ RUNALL_STATE/RUNALL_RESUME ៖ មាតិកាឯកសារដែល git ឃើញ (tracked + untracked មិន ignore)
# · rules ចម្លងរបស់ emulator · ទង់ *_STRICT ។ ⛔ ទង់ STRICT ប្តូរសាលក្រម (SKIP ➜ FAIL) ➜ ការរត់ដោយទង់ខុសគ្នា
# មិនមែន «tree ដដែល» ទេ។ tree គ្មាន git (root វាស់ · git archive) ➜ ដើរថតពិត។
runall_tree_hash() (  # <root>
    set -o pipefail
    (
        cd "$1" || exit 1
        if [ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ]; then
            git ls-files -z --cached --others --exclude-standard
        else
            find . \( -name node_modules -o -name .git -o -name dist-audit \) -prune -o -type f -print0 | sed -z 's|^\./||'
        fi | LC_ALL=C sort -zu | xargs -0r sha1sum 2>/dev/null || exit 1
        [ -f audit-tools/emu/real.rules.json ] && sha1sum audit-tools/emu/real.rules.json
        # ⛔ v2 ៖ ភស្តុតាងរួមមានជម្រើសដែលប្តូរករណីវាស់ មិនមែនតែ source និង STRICT។
        printf 'zoe-runall-evidence-v2\0'
        command -v node || exit 1
        node --version || exit 1
        local key external=0
        while IFS= read -r key; do
            case "$key" in
                *_STRICT|APPWRITES_OPS|APPWRITES_RUNS|CFUZZ_RUN0|CFUZZ_RUNS|CONNFUZZ_OPS|CONNFUZZ_RUN0|CONNFUZZ_RUNS|\
                FUZZ_APPS|FUZZ_OPS|FUZZ_RUN0|FUZZ_RUNS|MFUZZ_OPS|MFUZZ_RUN0|MFUZZ_RUNS|ZTOBANNER_FUZZ_RUNS|\
                MONEYMD_DEVICES|MONEYMD_OPS|MONEYMD_RUN0|MONEYMD_RUNS|SBMONEY_DEVICES|SBMONEY_OPS|SBMONEY_RUN0|SBMONEY_SHOPS|\
                SBPARITY_OPS|SBPARITY_RUNS|SBPARITY_SEED|SBPARITY_POLICY_ONLY|SBPARITY_PROBE_ONLY|\
                FBPROVISION_MUTATIONS|SBDATA_MUTATIONS|SCANREMOVE_STATIC_ONLY|SCANSDK_MONTH_WIRE|SCANRULES_BACKEND|\
                MONEYGUARD_NO_EMU|CRUD_FLOW_MIN_ASSERTS|IMPORTPAIRED_CI_CASE|IMPORTPAIRED_CI_PROVIDER|\
                F03_RUN_NATIVE_ENGINE|F03_TIMING_ORDER|F09_RUN_NATIVE_ENGINE|SUPABASE_RESET_PAIRED_CASE|\
                PANELMOTION_ORDERS|PERF_ORDERS|KHMERTZ_PROBE|EXITCODE_CHILD|CI|GITHUB_ACTIONS|RUNNER_ENVIRONMENT|NODE_ENV|\
                CHECKER_TIMEOUT|EXITCODE_TIMEOUT_MS|ZOEWSUITE_STEP_TIMEOUT_MS)
                    printf '%s\0%s\0' "$key" "${!key}" ;;
                *_APP_DIR|*_CHROME|*_PORT|ZOE_REPO_ROOT|VERSIONSCOPE_BASE|VERSIONSCOPE_GIT_DIR|SUPABASE_MIGRATION_BASE|\
                KEYLIST_APP_JS|LICENSE_JS|SCANRULES_RULES_FILE|PURITY_SRC|SLOTCHECK_SRC|NOTICE_FILE|DIST_DIR|\
                ANDROIDCHECK_ROOT|ZOEW_HISTORY_TEST_DIST|SUPABASE_ADMIN_SESSION_BASELINE|SUPABASE_RESET_BASELINE|\
                NODE_OPTIONS|NODE_PATH|FBPROVISION_DEPS_DIR|SUPABASE_DEPS_DIR|SUPABASE_PG_BIN|\
                ZOEW_TEST_BROWSER|CHROMIUM_PATH|PLAYWRIGHT_BROWSERS_PATH|ZOE_RTDB_JAR|\
                F03_NATIVE_EMULATOR_URL|FIREBASE_DATABASE_EMULATOR_HOST|IMPORTPAIRED_BASE_SOURCE)
                    external=1 ;;
                ZOE_NODE_MODULES)
                    [ "${!key}" = "$PWD/ZoeW/node_modules" ] || external=1 ;;
            esac
        done < <(compgen -e | LC_ALL=C sort)
        # ⛔ path/ref ដដែលអាចមានមាតិកាថ្មី៖ មិនរក្សា PASS ពីការរត់មុន ហើយមិនអាន secret។
        if [ "$external" = 1 ]; then
            printf 'external-input-no-reuse\0%s\0' "$BASHPID:$RANDOM:$RANDOM"
        fi
    ) | sha1sum | cut -c1-16
)
zoe_build_audit() {  # <src root>
    local log
    [ -e "$1/ZoeW/node_modules" ] || ln -s "$ZOE_NODE_MODULES" "$1/ZoeW/node_modules"
    if ! log=$( (cd "$1/ZoeW" && {
        if [ -f ../audit-tools/zoew/scripts/build-audit.mjs ]; then
            node ../audit-tools/zoew/prepare-dependencies.mjs && node ../audit-tools/zoew/scripts/build-audit.mjs
        else
            # baseline មុនការផ្ទេរថត រក្សាផ្លូវ build ដើមរបស់ commit នោះ។
            node scripts/build-audit.mjs
        fi
    }) 2>&1 ); then
        echo "*** FAIL *** build វាស់ធ្លាក់ ($1)"; printf '%s\n' "$log" | tail -20 | sed 's/^/      /'
        return 1
    fi
}
if [ -z "$ZOE_MEASURE_ROOT" ] && [ -f ZoeW/src/main.tsx ] && [ ! -f ZoeW/app.js ]; then
    REPO="$(pwd)"
    export ZOE_NODE_MODULES="$REPO/ZoeW/node_modules"
    if [ ! -d "$ZOE_NODE_MODULES/vite" ] || [ ! -d "$ZOE_NODE_MODULES/playwright-core" ]; then
        echo "*** FAIL *** ត្រូវការ dependency របស់ ZoeW (vite · acorn · playwright-core) — រត់ ៖ npm ci --prefix ZoeW"
        exit 1
    fi
    # ⛔ root វាស់ (`ZoeW/dist-audit`) ចែករំលែកក្នុងមួយ repo ៖ build ទី ២ (run-all ឬ `ZOE_MEASURE_ONLY=1`) **លុបវា**
    #    ពីក្រោម checker ដែលកំពុងរត់ ➜ ការធ្លាក់ចៃដន្យ ➜ សោក្នុង git-dir កាន់ពេញការរត់ (fd 9 ឆ្លង `exec`)
    RUNALL_LOCK="$(git rev-parse --absolute-git-dir 2>/dev/null || printf '%s' "${TMPDIR:-/tmp}")/zoe-runall-measure.lock"
    if command -v flock >/dev/null 2>&1 && exec 9>"$RUNALL_LOCK"; then
        if ! flock -n 9; then
            echo "*** FAIL *** run-all.sh ឬ ZOE_MEASURE_ONLY កំពុងរត់លើ repo នេះរួចហើយ — build វាស់ម្តងទៀតនឹងលុប root វាស់ពីក្រោមវា"
            echo "    ➜ រង់ចាំវាចប់ ឬរត់លើច្បាប់ចម្លង repo (សោ ៖ $RUNALL_LOCK)"
            exit 2
        fi
    fi
    echo "== ZoeW React ៖ build វាស់ពីប្រភពពិត (ZoeW/dist-audit) =="
    zoe_build_audit "$REPO" || exit 1
    MEASURE="$REPO/ZoeW/dist-audit/measure-root"
    zoe_measure_root "$REPO" "$MEASURE" git || { echo "*** FAIL *** ផ្គុំ root វាស់មិនបាន"; exit 1; }
    BASE_MEASURE=""
    IMPORTPAIRED_BASE_SOURCE=""
    if [ "${BASE:+set}" = set ] && [ -d "$BASE" ]; then
        BASE="$(cd "$BASE" && pwd)"
        IMPORTPAIRED_BASE_SOURCE="$BASE"
        if [ -f "$BASE/ZoeW/src/main.tsx" ] && [ ! -f "$BASE/ZoeW/app.js" ]; then
            zoe_build_audit "$BASE" || exit 1
            BASE_MEASURE="$BASE/ZoeW/dist-audit/measure-root"
            zoe_measure_root "$BASE" "$BASE_MEASURE" tar || { echo "*** FAIL *** ផ្គុំ root វាស់របស់ baseline មិនបាន"; exit 1; }
        else
            BASE_MEASURE="$BASE"
        fi
    fi
    echo "   root វាស់ ៖ $MEASURE"
    echo "   ZoeW/src/** = ប្រភព React ពិត · ZoeW/dist-audit/ZoeW/app.js = ឯកសារវាស់ដែល build បង្កើត (មិនមែន source) · App ពិតរត់ build Vite (ZoeW/dist)"
    # state ៖ លំនាំដើមរស់ក្នុង git-dir (មិនដែល commit · build វាស់មិនលុប) · ផ្លូវទាក់ទងគិតពី cwd របស់អ្នកហៅ
    # ⛔ hash គណនាលើ **repo** មិនមែន root វាស់ ៖ zoew-suite · version-bump-scope វាស់ repo ដោយផ្ទាល់
    if [ -z "${RUNALL_STATE+set}" ]; then
        RUNALL_STATE="$(git rev-parse --absolute-git-dir 2>/dev/null)"
        if [ -n "$RUNALL_STATE" ]; then RUNALL_STATE="$RUNALL_STATE/zoe-runall-state.tsv"
        else RUNALL_STATE="${TMPDIR:-/tmp}/zoe-runall-state-$(printf '%s' "$REPO" | cksum | cut -d' ' -f1).tsv"; fi
    fi
    case "$RUNALL_STATE" in /*|'') ;; *) RUNALL_STATE="$RUNALL_CALLER_PWD/$RUNALL_STATE" ;; esac
    if [ -n "$RUNALL_STATE" ]; then
        RUNALL_TREE_HASH="$(runall_tree_hash "$REPO")" || { echo "*** FAIL *** hash របស់ tree មិនពេញលេញ"; exit 1; }
    fi
    export RUNALL_STATE RUNALL_TREE_HASH
    # ⛔ `ZOE_MEASURE_ONLY=1` ៖ ផ្គុំ root វាស់ហើយឈប់ (បន្ទាត់ចុងក្រោយ = ផ្លូវ) ➜ job ដែលរត់ checker
    #    ជាក់លាក់ (ឧ. `emu/*` ក្នុង `.github/workflows/audit.yml`) វាស់ tree ដដែលនឹង run-all
    if [ "$ZOE_MEASURE_ONLY" = 1 ]; then printf '%s\n' "$MEASURE"; exit 0; fi
    export ZOE_MEASURE_ROOT="$MEASURE" ZOE_REPO_ROOT="$REPO" NODE_PATH="$ZOE_NODE_MODULES" IMPORTPAIRED_BASE_SOURCE
    # checker កម្រិត repo ៖ git · ប្រភព React
    export ZOEWSUITE_APP_DIR="${ZOEWSUITE_APP_DIR:-$REPO}" REPOCOVER_APP_DIR="${REPOCOVER_APP_DIR:-$REPO}" \
        VERSIONSCOPE_GIT_DIR="${VERSIONSCOPE_GIT_DIR:-$REPO}" DOCSCACHE_APP_DIR="${DOCSCACHE_APP_DIR:-$REPO}" \
        SECURITYGUARD_APP_DIR="${SECURITYGUARD_APP_DIR:-$REPO}"
    exec bash "$MEASURE/audit-tools/run-all.sh" ${BASE_MEASURE:+"$BASE_MEASURE"}
fi

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
if command -v timeout >/dev/null 2>&1; then
    HAS_TIMEOUT=1
else
    HAS_TIMEOUT=0
    echo "⚠️  គ្មាន \`timeout\` — checker ដែលព្យួរនឹងព្យួររហូត"
fi

#@runner-begin
RUNALL_TIMEOUT_OVERRIDE="${CHECKER_TIMEOUT:-}"
CHECKER_TIMEOUT="${CHECKER_TIMEOUT:-300}"
# ── ម៉ាស៊ីនរត់ checker ៖ lane ស្របគ្នា · លទ្ធផលតាមលំដាប់បញ្ជី · state ដែលបន្តបាន ─────────────────────
# `run` · `section` · `skipm` **មិនរត់អ្វីភ្លាមទេ** — ពួកវាចុះបញ្ជី ➜ `runall_drain` រត់ checker ក្នុង lane ស្របគ្នា
# ហើយបោះពុម្ពលទ្ធផល **តាមលំដាប់បញ្ជីជានិច្ច** (output របស់ checker នីមួយៗទុកក្នុងឯកសារដាច់ ➜ មិនលាយគ្នា)។
# មូលហេតុ ៖ ការរត់ពេញជាជួរចំណាយ ~២៤ នាទី (វាស់ 2026-09-28) ហើយ session ដែលអស់កូតាកណ្តាលទី បាត់លទ្ធផល
# ទាំងមូល ➜ រាល់ checker ដែលចប់ ត្រូវសរសេរចូល RUNALL_STATE **ភ្លាម** (មិនរង់ចាំលំដាប់បោះពុម្ព)។
# ⛔ ទម្រង់ `run "<ស្លាក>" node audit-tools/<x>.js` និង `for t in …; do run "$t" node "audit-tools/$t.js"`
#    ត្រូវនៅដដែល ៖ checker-coverage · exit-code-integrity · repository-file-coverage · doc-scope ស្រង់បញ្ជីពីវា។
# ⛔ ម៉ាស៊ីននេះរស់ចន្លោះសញ្ញា `#@runner-begin` / `#@runner-end` ➜ hang-guard និង runall-runner-test ស្រង់វា
#    ទៅរត់ជាមួយ checker ក្លែង (ព្យួរ · ដេក · ធ្លាក់) ➜ ការវាស់ឥរិយាបថពិត មិនមែន grep។
RUNALL_BASH_OK=0
if [ "${BASH_VERSINFO[0]}" -gt 4 ] || { [ "${BASH_VERSINFO[0]}" -eq 4 ] && [ "${BASH_VERSINFO[1]}" -ge 3 ]; }; then
    RUNALL_BASH_OK=1
fi
runall_int() {  # <ឈ្មោះ> <តម្លៃ> <លំនាំដើម> <អប្បបរមា> <អតិបរមា> ➜ ចំនួនគត់ក្នុងព្រំដែន (តម្លៃខុស ➜ ព្រមាន + លំនាំដើម)
    local v="$2"
    case "$v" in
        '') v="$3" ;;
        *[!0-9]*) echo "⚠️  $1=$v មិនមែនចំនួនគត់ ➜ ប្រើ $3" >&2; v="$3" ;;
    esac
    v=$((10#$v))
    [ "$v" -lt "$4" ] && v="$4"
    [ "$v" -gt "$5" ] && v="$5"
    printf '%s' "$v"
}
RUNALL_CPUS="$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
RUNALL_JOBS="$(runall_int RUNALL_JOBS "${RUNALL_JOBS:-}" "$(runall_int nproc "$RUNALL_CPUS" 2 2 6)" 1 32)"
RUNALL_BROWSER_JOBS="$(runall_int RUNALL_BROWSER_JOBS "${RUNALL_BROWSER_JOBS:-}" "$RUNALL_JOBS" 1 "$RUNALL_JOBS")"
RUNALL_STATE="${RUNALL_STATE-}"
RUNALL_TREE_HASH="${RUNALL_TREE_HASH:-}"
if [ -n "$RUNALL_STATE" ] && [ -z "$RUNALL_TREE_HASH" ]; then
    if declare -F runall_tree_hash >/dev/null; then RUNALL_TREE_HASH="$(runall_tree_hash .)" || { echo "*** FAIL *** hash របស់ tree មិនពេញលេញ"; exit 1; }
    else echo "⚠️  គ្មាន hash របស់ tree ➜ បិទ RUNALL_STATE" >&2; RUNALL_STATE=''; fi
fi

runall_now_ms() {
    local t="${EPOCHREALTIME:-}"
    if [ -n "$t" ]; then t="${t//[!0-9]/}"; printf '%s' "$(( 10#$t / 1000 ))"; return; fi
    t="$(date +%s%N 2>/dev/null)"
    case "$t" in ''|*[!0-9]*) printf '%s' "$(( $(date +%s) * 1000 ))" ;; *) printf '%s' "$(( 10#$t / 1000000 ))" ;; esac
}
runall_fmt_ms() {  # <ms> ➜ «12.3s» · មិនមែនលេខ ➜ «—»
    case "$1" in ''|*[!0-9]*) printf '—' ;; *) printf '%d.%ds' "$(( $1 / 1000 ))" "$(( $1 % 1000 / 100 ))" ;; esac
}

# ⛔ lane ដេរីវេពីឯកសារ checker ពិត លើកលែងក្រុមដែលមានហេតុផល (runall-runner-test ផ្ទៀងវាទល់នឹងប្រភព) ៖
#   excl    ៖ រត់ម្នាក់ឯង (គ្មាន checker ផ្សេងរត់ជាមួយ) ៖ checker-coverage · exit-code-integrity **សរសេរ ហើយបោស**
#             ឯកសារស្រមោល `.tmp-poison-*` ក្នុង audit-tools/ (ការបោសរបស់មួយ លុបស្រមោលដែលមួយទៀតកំពុងរត់)
#             ហើយ fan out ខាងក្នុងរួចស្រាប់ (probe ស្របគ្នា · ការរត់ checker ពុលរួម emu/* លើ emulator ដដែល)
#             registry-purge-atomic-sdk វាស់ deadline ១៥ វិ. លើ JVM ផ្ទាល់ ➜ មិនចែក CPU ជាមួយ checker ផ្សេង។
#             zoew-suite បើក Vitest workers និង browser ក្នុង child scripts ➜ រត់ម្នាក់ឯង ដោយរក្សាពិដាន 240s/step និង 300s/checker។
#             money-guardian មាន mutation child pool ផ្ទាល់ខ្លួន ➜ មិនចែក CPU ជាមួយ browser/Postgres ដោយរក្សា matrix និងពិដានដដែល។
#             modal-keyboard-device ផ្នែក 3/4 និង 4/4 វាស់ស៊ុម live ➜ មិនចែក CPU; ផ្នែក geometry 1/4 និង 2/4 នៅ lane browser។
#   emu     ៖ ម្តងមួយ ៖ RTDB emulator តែមួយ (127.0.0.1:9000)
#             money-checker-truthfulness អាន/ស្រង់ emulator harness៖ ដាក់ serial ដោយប្រុងប្រយ័ត្ន ទោះ VM probe ខ្លួនវាមិនបើក emulator។
#   browser ៖ ប្រភពមាន `chromium.launch(` ➜ ពិដាន RUNALL_BROWSER_JOBS
#   any     ៖ ផ្សេងៗ (ពិដានរួម RUNALL_JOBS អនុវត្តលើគ្រប់ lane)
runall_script_of() {
    local a
    for a in "$@"; do case "$a" in audit-tools/*.js|zto-import/*.js) printf '%s' "$a"; return ;; esac; done
}
RUNALL_OWNED_DIR=''
runall_needs_rtdb() {
    case "$(runall_script_of "$@")" in
        audit-tools/emu/import-paired-ci-runner.js) return 1 ;; # runner owns an RTDB scope per profile
        audit-tools/emu/*|audit-tools/scan-month-fixture-date-test.js|audit-tools/money-guardian-test.js|audit-tools/supabase-scan-rules-test.js|audit-tools/money-checker-truthfulness-test.js|audit-tools/checker-coverage.js|audit-tools/exit-code-integrity.js) return 0 ;;
        *) return 1 ;;
    esac
}
runall_owned_init() {
    [ -n "$RUNALL_OWNED_DIR" ] && return 0
    RUNALL_OWNED_DIR="$(mktemp -d "${TMPDIR:-/tmp}/zoe-runall-owned.XXXXXX")"
}
runall_prepare_command() {
    RUNALL_COMMAND=("$@")
    if runall_needs_rtdb "$@"; then
        RUNALL_COMMAND=(node audit-tools/owned-rtdb-command.js --state "$RUNALL_OWNED_DIR" -- "$@")
    elif [ "$(runall_script_of "$@")" = audit-tools/emu/import-paired-ci-runner.js ]; then
        # Runner owns the emulator; share the existing scheduler fence, never an outer owner.
        RUNALL_COMMAND=(env "IMPORTPAIRED_OWNER_STATE=$RUNALL_OWNED_DIR" "$@")
    fi
}
runall_owned() {
    runall_owned_init || return 1
    runall_prepare_command "$@"
    "${RUNALL_COMMAND[@]}"
}
runall_cleanup_owned() {
    [ -n "$RUNALL_OWNED_DIR" ] && [ -d "$RUNALL_OWNED_DIR" ] || return 0
    if [ -d "$RUNALL_OWNED_DIR/active" ] || [ -f "$RUNALL_OWNED_DIR/blocked.json" ]; then
        echo "FAIL owned RTDB cleanup unproven; evidence retained: $RUNALL_OWNED_DIR"
        return 1
    elif [ -f "$RUNALL_OWNED_DIR/failed.json" ] || [ -f "$RUNALL_OWNED_DIR/prototype-evidence.json" ]; then
        echo "   owned RTDB evidence retained: $RUNALL_OWNED_DIR"
    else
        rm -rf "$RUNALL_OWNED_DIR"
    fi
}
runall_timeout_for() {
    if [ -n "$RUNALL_TIMEOUT_OVERRIDE" ]; then printf '%s' "$RUNALL_TIMEOUT_OVERRIDE"; return; fi
    case "$(runall_script_of "$@")" in
        audit-tools/emu/money-multidevice-emu-test.js) printf 2400 ;;
        audit-tools/supabase-money-multishop-test.js) printf 3000 ;;
        *) printf '%s' "$CHECKER_TIMEOUT" ;;
    esac
}
runall_lane() {
    local s; s="$(runall_script_of "$@")"
    case "$s" in
        audit-tools/checker-coverage.js|audit-tools/exit-code-integrity.js|audit-tools/emu/registry-purge-atomic-sdk-test.js|audit-tools/zoew-suite-test.js|audit-tools/money-guardian-test.js) printf excl ;;
        audit-tools/modal-keyboard-device-test.js)
            local part='' a
            for a in "$@"; do case "$a" in --part*) part="$a"; break ;; esac; done
            case "$part" in --part=1/4|--part=2/4) printf browser ;; *) printf excl ;; esac ;;
        audit-tools/import-paired-ci-runner-test.js|audit-tools/scan-month-fixture-date-test.js|audit-tools/emu/*|audit-tools/supabase-scan-rules-test.js|audit-tools/money-checker-truthfulness-test.js) printf emu ;;
        *) if [ -n "$s" ] && grep -q 'chromium\.launch(' "$s" 2>/dev/null; then printf browser; else printf any; fi ;;
    esac
}

J_KIND=(); J_LABEL=(); J_CMD=(); J_LANE=(); J_ID=(); J_TIMEOUT=()
J_ST=(); J_V=(); J_TEXT=(); J_MS=(); J_SHOW=(); J_SPID=()
declare -A RS_V=() RS_TEXT=() RS_MS=()
runall_add() { J_KIND+=("$1"); J_LABEL+=("$2"); J_CMD+=("$3"); J_LANE+=("$4"); J_ID+=("$5"); J_TIMEOUT+=("${6:-}"); }
section() { runall_add hdr "$1" '' '' ''; }
skipm() {
    run "$1" node "audit-tools/$1.js"
    J_KIND[$(( ${#J_KIND[@]} - 1 ))]=skip
}
run() {
    local label="$1"; shift
    local s; s="$(runall_script_of "$@")"
    s="${s#audit-tools/}"
    runall_add job "$label" "$(printf '%q ' "$@")" "$(runall_lane "$@")" "${s%.js}" "$(runall_timeout_for "$@")"
}

# ⛔ កិច្ចសន្យា exit ៖ job `node …` នីមួយៗ preload `runall-exit-guard.cjs` ➜ exit code ចាប់ផ្តើម «មិនទាន់សម្រេច» ហើយ
#    តែសេចក្តីសង្ខេបរបស់ checker (`process.exitCode = 0` · `process.exit(0)`) ទេដែលបន្ថយវា ➜ checker ដែល `await` promise
#    ដែលមិនដែល settle (event loop ហូរអស់ ➜ Node ចេញ 0 ដោយការអះអាងមិនបានរត់) ក្លាយជា FAIL មិនមែន PASS។
#    ⛔ ផ្លូវដាច់ខាត (មិនមែន `audit-tools/*.js`) ➜ `runall_script_of` · lane · owned scope នៅឃើញ checker ដដែល ·
#    ឯកសារបាត់ ➜ node បរាជ័យ ➜ FAIL (មិនដែលរត់ដោយគ្មានកិច្ចសន្យាស្ងាត់ៗ)។
#    `RUNALL_JOB_TIMEOUT` (ពិដាន job នេះ · DURATION ដូច `timeout`) + `RUNALL_JOB_STARTED_MS` (ពេលចាប់ផ្តើម ms) ➜ meta-checker ដែលបើក
#    កូនច្រើន (exit-code-integrity) ចែកពេលរបស់ខ្លួនតាម deadline ពិត ជំនួសថវិកាថេរ។
RUNALL_EXIT_GUARD="$PWD/audit-tools/runall-exit-guard.cjs"
runall_exec() {  # <i> — រត់ក្នុង subshell ៖ output ➜ <i>.out · pid ➜ <i>.pid · «rc ms» ➜ <i>.rc (atomic)
    local i="$1" rc=0 t0 pid
    local CHECKER_TIMEOUT="${J_TIMEOUT[$i]}"
    eval "set -- ${J_CMD[$i]}"
    if [ "${1:-}" = node ]; then
        shift
        set -- node --require "$RUNALL_EXIT_GUARD" "$@"
        export ZOE_RUNALL_EXIT_GUARD=1
    fi
    export RUNALL_JOB_TIMEOUT="$CHECKER_TIMEOUT" RUNALL_JOB_STARTED_MS="$(runall_now_ms)"
    runall_prepare_command "$@"
    set -- "${RUNALL_COMMAND[@]}"
    t0="$(runall_now_ms)"
    if [ "$HAS_TIMEOUT" = 1 ]; then
        timeout -k 10 "$CHECKER_TIMEOUT" "$@" > "$RUNALL_DIR/$i.out" 2>&1 < /dev/null &
    else
        "$@" > "$RUNALL_DIR/$i.out" 2>&1 < /dev/null &
    fi
    pid=$!
    printf '%s\n' "$pid" > "$RUNALL_DIR/$i.pid"
    wait "$pid" || rc=$?
    printf '%s %s\n' "$rc" "$(( $(runall_now_ms) - t0 ))" > "$RUNALL_DIR/$i.rc.tmp"
    mv "$RUNALL_DIR/$i.rc.tmp" "$RUNALL_DIR/$i.rc"
}

runall_judge() {  # <i> — សាលក្រមដូច run() ជាជួរជំនាន់មុនបេះបិទ ៖ PASS · PARTIAL · SKIPPED · FAIL · ព្យួរ
    local i="$1" rc='' ms='' n skip_line out
    out="$RUNALL_DIR/$i.out"
    [ -f "$RUNALL_DIR/$i.rc" ] && read -r rc ms < "$RUNALL_DIR/$i.rc"
    # ⛔ អានជាឯកសារដោយ grep/sed/tr (ពេលលីនេអ៊ែរ) — កុំផ្ទុក output ចូលអថេរ bash ៖ `${out//[[:space:]]/}` លើ output ធំ
    #    (របាយការណ៍ JSON ច្រើន MB) ក្នុង locale UTF-8 ប្រើពេល quadratic ➜ shell មេរវល់ ១០០% CPU · មិន reap · មិនចាប់ផ្តើម
    #    checker ថ្មី · trap TERM រង់ចាំ expansion ចប់ (runall-runner-test «output ១ MB»)។
    J_MS[$i]="$ms"; J_SHOW[$i]=0; J_ST[$i]=done
    if [ -z "$rc" ]; then
        J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL *** (ម៉ាស៊ីនរត់ ៖ checker ស្លាប់ដោយគ្មានលទ្ធផល)"; J_SHOW[$i]=1
    elif [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
        J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL *** (ព្យួរ — លើសពិដាន ${J_TIMEOUT[$i]}s)"; J_SHOW[$i]=1
    elif [ "$rc" -eq 0 ] && [ "${J_ID[$i]}" = emu/import-paired-ci-runner ] && ! runall_native_summary "$RUNALL_DIR/$i.out" "${J_LABEL[$i]}" >/dev/null; then
        J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL *** (native result missing or invalid)"; J_SHOW[$i]=0
    elif [ "$rc" -eq 0 ]; then
        n=$(grep -cE 'ok    ' "$out" 2>/dev/null); n="${n:-0}"
        skip_line=$(sed -n '/^[[:space:]]*\(SKIP\|PARTIAL PASS\)/ { s/^[[:space:]]*//; p; q; }' "$out" 2>/dev/null)
        if [ "$(LC_ALL=C tr -d '\000[:space:]' < "$out" 2>/dev/null | head -c 1 | wc -c)" -eq 0 ] \
            || grep -qE '^[[:space:]]*(FAIL[[:space:]]|❌[[:space:]]|\*\*\* FAIL \*\*\*)' "$out" 2>/dev/null; then
            J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL *** (exit 0 តែ output ទទេ ឬរាយ FAIL)"; J_SHOW[$i]=1
        elif [ -n "$skip_line" ]; then
            if [ "$n" -gt 0 ]; then J_V[$i]=PARTIAL; J_TEXT[$i]="PARTIAL PASS ($n; $skip_line)"
            else J_V[$i]=SKIPPED; J_TEXT[$i]="SKIPPED (${skip_line#SKIP })"; fi
        else
            J_V[$i]=PASS
            if [ "$n" -gt 0 ]; then J_TEXT[$i]="PASS  ($n)"; else J_TEXT[$i]="PASS"; fi
        fi
    else
        J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL ***"; J_SHOW[$i]=1
    fi
    runall_state_put "$i"
}

# ── RUNALL_STATE ៖ ១ បន្ទាត់/checker ៖ ស្លាក · សាលក្រម · វិនាទី · hash របស់ tree · អត្ថបទសាលក្រម (TSV) ───────
runall_secs() {  # <ms> ➜ «12.345» · មិនមែនលេខ ➜ «-»
    case "$1" in ''|*[!0-9]*) printf -- '-' ;; *) printf '%d.%03d' "$(( $1 / 1000 ))" "$(( $1 % 1000 ))" ;; esac
}
runall_state_put() {
    [ -n "$RUNALL_STATE" ] || return 0
    local i="$1" text="${J_TEXT[$1]}"
    text="${text//$'\t'/ }"; text="${text//$'\n'/ }"
    printf '%s\t%s\t%s\t%s\t%s\n' "${J_LABEL[$i]}" "${J_V[$i]}" "$(runall_secs "${J_MS[$i]}")" \
        "$RUNALL_TREE_HASH" "${text:--}" >> "$RUNALL_STATE" 2>/dev/null
}
runall_state_read() {  # ➜ RS_V/RS_TEXT/RS_MS[ស្លាក] (បន្ទាត់ក្រោយឈ្នះ) · RS_HASHES (hash ទាំងអស់ដែលលេច)
    RS_V=(); RS_TEXT=(); RS_MS=(); RS_HASHES=''
    [ -n "$RUNALL_STATE" ] && [ -f "$RUNALL_STATE" ] || return 1
    local label v secs hash text ms
    while IFS=$'\t' read -r label v secs hash text; do
        case "$label" in
            '# zoe-runall-state'*) hash="${label##*tree=}"; hash="${hash%% *}" ;;
            ''|'#'*) continue ;;
            *) ms="${secs//./}"
               case "$ms" in ''|*[!0-9]*) ms='' ;; *) ms=$((10#$ms)) ;; esac
               RS_V[$label]="$v"; RS_TEXT[$label]="$text"; RS_MS[$label]="$ms" ;;
        esac
        case " $RS_HASHES " in *" $hash "*) ;; *) RS_HASHES="${RS_HASHES:+$RS_HASHES }$hash" ;; esac
    done < "$RUNALL_STATE"
    return 0
}

runall_match() {  # <ឈ្មោះ> ➜ សម្គាល់ job ដែលស្លាក ឬ id (audit-tools/<id>.js) ស្មើ · រកមិនឃើញ ➜ 1
    local tok="$1" id i found=1
    id="${tok#audit-tools/}"; id="${id%.js}"
    for ((i = 0; i < ${#J_KIND[@]}; i++)); do
        [ "${J_KIND[$i]}" = hdr ] && continue
        if [ "${J_LABEL[$i]}" = "$tok" ]; then RUNALL_WANT[$i]=1; found=0
        elif [ -n "${J_ID[$i]}" ] && [ "${J_ID[$i]}" = "$id" ]; then RUNALL_WANT[$i]=1; found=0; fi
    done
    return "$found"
}
runall_select() {  # RUNALL_ONLY · RUNALL_RESUME ➜ J_ST[i] = hdr | queue | done | carried | off
    local n=${#J_KIND[@]} i tok part bad=() toks=() resume=0 append=0 label
    [ "${RUNALL_RESUME:-}" = 1 ] && resume=1
    RUNALL_WANT=()
    if [ -n "${RUNALL_ONLY:-}" ]; then
        IFS=',' read -ra toks <<< "$RUNALL_ONLY"
        for tok in "${toks[@]}"; do
            tok="${tok#"${tok%%[![:space:]]*}"}"; tok="${tok%"${tok##*[![:space:]]}"}"
            [ -z "$tok" ] && continue
            runall_match "$tok" && continue
            for part in $tok; do runall_match "$part" || bad+=("$part"); done
        done
        if [ "${#bad[@]}" -gt 0 ] || [ "${#RUNALL_WANT[@]}" -eq 0 ]; then
            echo "*** FAIL *** RUNALL_ONLY ៖ រកមិនឃើញ checker ឈ្មោះ ៖ ${bad[*]:-(ទទេ)}"
            echo "      (ប្រើស្លាកដូចក្នុង output ឬឈ្មោះឯកសារ ឧ. money-guardian-test · emu/ledger-revert-emu-test · បំបែកដោយ ,)"
            return 2
        fi
    fi
    RUNALL_MINE=()
    if [ -n "${RUNALL_SHARD:-}" ]; then runall_shard_pick || return 2; fi
    if [ "$resume" = 1 ]; then
        if [ -z "$RUNALL_STATE" ]; then echo "*** FAIL *** RUNALL_RESUME=1 តែ RUNALL_STATE ទទេ (បិទ)"; return 2; fi
        if ! runall_state_read; then
            echo "*** FAIL *** RUNALL_RESUME=1 ៖ គ្មាន state ($RUNALL_STATE) ➜ រត់ម្តងដោយគ្មាន RUNALL_RESUME"
            return 2
        fi
        if [ "$RS_HASHES" != "$RUNALL_TREE_HASH" ]; then
            echo "*** FAIL *** RUNALL_RESUME=1 បដិសេធ ៖ state ជារបស់ tree ${RS_HASHES:-?} តែ tree ឥឡូវជា $RUNALL_TREE_HASH"
            echo "      (កូដ · ការកំណត់ · runtime ប្រែ ឬមាន input ខាងក្រៅដែលមិនអាចប្រើឡើងវិញ ➜ លទ្ធផលចាស់មិនមែនភស្តុតាងថ្មី ➜ រត់ម្តងទៀតដោយគ្មាន RUNALL_RESUME)"
            return 2
        fi
        append=1
    else
        runall_state_read
        [ -n "${RUNALL_ONLY:-}${RUNALL_SHARD:-}" ] && [ "$RS_HASHES" = "$RUNALL_TREE_HASH" ] && append=1
    fi
    if [ -n "$RUNALL_STATE" ] && [ "$append" = 0 ]; then
        mkdir -p "$(dirname "$RUNALL_STATE")" 2>/dev/null
        if ! printf '# zoe-runall-state v1 tree=%s\n' "$RUNALL_TREE_HASH" > "$RUNALL_STATE" 2>/dev/null; then
            echo "⚠️  សរសេរ RUNALL_STATE មិនបាន ($RUNALL_STATE) ➜ បិទ state" >&2
            RUNALL_STATE=''
        fi
    fi
    for ((i = 0; i < n; i++)); do
        label="${J_LABEL[$i]}"
        if [ "${J_KIND[$i]}" = hdr ]; then J_ST[$i]=hdr; continue; fi
        if { [ -n "${RUNALL_ONLY:-}" ] && [ -z "${RUNALL_WANT[$i]:-}" ]; } || { [ -n "${RUNALL_SHARD:-}" ] && [ -z "${RUNALL_MINE[$i]:-}" ]; }; then
            J_ST[$i]=off
            [ "$resume" = 1 ] && [ -n "${RS_V[$label]:-}" ] && J_ST[$i]=carried
        elif [ "$resume" = 1 ] && [ "${RS_V[$label]:-}" = PASS ]; then
            J_ST[$i]=carried
        elif [ "${J_KIND[$i]}" = skip ]; then
            J_ST[$i]=done; J_V[$i]=SKIPPED; J_TEXT[$i]="SKIPPED (no acorn)"; J_MS[$i]=''; J_SHOW[$i]=0
            runall_state_put "$i"
        else
            J_ST[$i]=queue
        fi
        if [ "${J_ST[$i]}" = carried ]; then
            J_V[$i]="${RS_V[$label]}"; J_TEXT[$i]="${RS_TEXT[$label]}"; J_MS[$i]="${RS_MS[$label]}"; J_SHOW[$i]=0
        fi
    done
    return 0
}

# ⛔ ពេលប្រហែល (វិ.) របស់ checker យឺតជាងគេ ៖ ប្រើ (១) ក្នុង `runall_order` តែពេល state គ្មានពេលរបស់វា (session ថ្មីចាប់ផ្តើមពី
#    clone ស្អាត ➜ គ្មាន `<git-dir>/zoe-runall-state.tsv`) និង (២) ជាពេលសម្រាប់ `RUNALL_SHARD` (sub-suite មានពេលតាមស្លាកខាងក្រោម)។ ប៉ះតែលំដាប់ ·
#    ការបែងចែក មិនដែលប៉ះសាលក្រម ➜ លេខចាស់ = យឺតជាងបន្តិច មិនខុស។ ឈ្មោះ = id ឯកសារ (audit-tools/<id>.js) · runall-runner-test
#    ផ្ទៀងថាគ្មានឈ្មោះខ្មោច។ ប្រើ median នៃ PASS លើ CPU ២ ហើយបង្គត់ឡើងទៅវិ.; ប្រភព និងព្រំដែននៅ docs/HISTORY.md។
RUNALL_HINTS="emu/money-multidevice-emu-test:534 supabase-money-multishop-test:491 money-guardian-test:292 zoew-suite-test:224 modal-keyboard-device-test:207
    layout-check:202 revenue-fuzz-test:199 exit-code-integrity:196 supabase-data-tools-test:193 emu/app-writes-rules-test:192
    supabase-app-network-e2e-test:180 emu/supabase-rules-parity-test:147 supabase-rls-test:131 modal-keyboard-test:125 supabase-datastore-test:124
    app-lock-test:105 checker-coverage:104 sw-install-integrity-test:99 ui-flow-test:98 firebase-provision-test:94
    emu/app-network-e2e-test:91 perf-check:75 runall-runner-test:74 gesture-test:66 emu/registry-purge-atomic-sdk-test:64
    panel-motion-test:62 tx-outcome-test:61 write-stall-guard-test:59 collected-mirror-fuzz-test:44 emu/supabase-adapter-parity-test:42
    fluid-type-focus-test:41 ios-panel-glide-test:36 keygen-modal-scroll-test:36 emu/scan-month-coordination-sdk-test:35 supabase-functions-test:32
    sheet-import-test:31 emu/import-paired-ci-runner:28 emu/restore-mutation-emu-test:28 late-commit-test:27 ledger-clamp-symmetry-test:27
    setup-link-browser-test:26 cleanup-interrupt-atomicity-test:25 collected-value-fuzz-test:23 emu/crud-rules-flow:22 hang-guard:22
    storage-blocked-boot-test:22 license-time-cors-browser-test:21 repository-contract-test:21 stale-clear-claim-test:19 connection-recovery-test:18
    emu/cleanup-consumed-sdk-test:18 emu/scan-operation-rules-test:18 zto-budget-test:18 slow-write-test:16 supabase-scan-rules-test:16
    lookup-burst-test:15 sdk-offline-boot-test:15 collected-mirror-lifecycle-test:14 sw-client-wiring-test:14 item-money-integrity-test:13
    listener-leak-test:13 db-stall-guard-test:12 emu/trash-generation-sdk-test:12 history-menu-dismiss-test:12 lookup-failure-identity-test:12
    lookup-prefetch-test:12 page-nav-test:12 emu/pickup-reset-applied-sdk-test:11 emu/tx-disconnect-emu-test:11 license-seat-test:11
    scan-engine-test:11 scan-remove-mode-test:11 toast-action-truth-test:11 boot-runtime:10 emu/empty-delete-sdk-test:10
    emu/scan-operation-sdk-test:10 health-check-test:10 registry-release-test:10 sw-backend-chunk-test:10 zto-list-sync-test:10
    csp-enforced-test:9 field-shape-test:9 network-pressure-test:9 emu/license-seat-rules-test:8 raw-read-shape-test:8
    zto-sync-banner-test:8 duplicate-money-test:7 empty-state-truth-test:7 emu/restore-deadlock-test:7 sentry-load-race-test:7
    zto-cookie-store-test:7 daily-collected-test:6 doc-scope-test:6 duplicate-scan-test:6 emu/ledger-revert-emu-test:6
    import-paired-ci-runner-test:6 inline-handler-xss-test:6 keygen-supabase-admin-test:6 network-timeout-test:6 periodic-network-guard-test:6
    phone-search-swipe-test:6 supabase-docs-cache-test:6 sw-revalidate-pressure-test:6 toast-truth-test:6 zto-cookie-session-test:6
    boot-animation-test:5 firebase-backup-test:5 money-checker-truthfulness-test:5 sw-cache-key-test:5 zto-proxy-test:5
    history-patch-retry-test:4 html-sink-escaping:4 layout-thrash:4 ledger-count-integrity-test:4 lookup-freshness-test:4
    money-reality-test:4 panel-snap-ownership-test:4 price-edit-abort-test:4 scan-month-fixture-date-test:4 stats-collected-truth-test:4
    sw-shell-latency-test:4 clock-basis-test:3 code-duplication-test:3 comments:3 csp-lazy-resource-test:3
    license-clock-trust-test:3 license-network-pressure-test:3 loop-termination-test:3 offline-shell-test:3 payload-schema:3
    pickup-barcode-identity-test:3 security-guard-test:3 stall-lock-release-test:3 action-binding-test:2 biometric-unlock-test:2
    camera-resume-test:2 clock-hygiene:2 function-surface-test:2 listener-pending-key-test:2 monotonic-gate-test:2
    partial-pickup-cleanup-test:2 registry-orphan-list-test:2 shared-fns:2 stale-write:2 stats-measurable-gate-test:2
    stats-screen-agreement-test:2 storage-guard:2 version-check:2 wiring:2 adaptive-link-test:1
    animation-cost:1 auth-recovery-test:1 barcode-shape-test:1 cleanup-clock-guard-test:1 clear-history-claim-test:1
    clear-history-finalization-fence-test:1 compensation-order:1 concurrent-scan-test:1 connection-state-fuzz-test:1 css-classes:1
    css-media-override:1 css-var-test:1 dependency-security-test:1 devtools-guard-test:1 dom-hygiene:1
    export-cells-test:1 firebase-config-paste-test:1 google-sheets-cache-test:1 keygen-biometric-test:1 keygen-notice-test:1
    keygen-pin-flow-test:1 keygen-session-security-test:1 keylist-consistency-test:1 khmer-timezone-test:1 ledger-failed-apply-revert-test:1
    license-app-code-test:1 license-clock-rollback-test:1 license-grace-test:1 license-record-race-test:1 license-time-endpoint-test:1
    license-time-json-test:1 locker-claim-guard-test:1 lookup-config-secret-test:1 module-runtime-scope-test:1 monthly-ledger-agreement-test:1
    monthly-report-test:1 netlify-config-scope-test:1 phone-suggest-test:1 pickup-ledger-test:1 pickup-reset-test:1
    pin-prompt-test:1 policy-test:1 reconnect-ladder-test:1 repository-file-coverage:1 restore-finalization-fence-test:1
    restore-marker-hygiene-test:1 restore-race-test:1 returned-trash-retention-test:1 revenue-rules-clamp-test:1 rules-duplicate-keys:1
    scan-month-orchestration-test:1 sdk-surface:1 secret-hygiene:1 semantic-ui-color-test:1 setup-link-logout-test:1
    setup-link-roundtrip-test:1 stall-guard-test:1 state-hygiene:1 sw-abort-propagation-test:1 sw-cache-failure-test:1
    trash-modal-test:1 user-guide-test:1 version-bump-scope:1 zto-cookie-capture-test:1 zto-cookie-sync-test:1
    zto-import/test:1 zto-negative-cache-test:1 zto-network-boundaries-test:1 zto-signed-status-test:1"

# checker ដដែលដែលរត់ជា sub-suite មានពេលខុសគ្នា ៖ ស្លាកពេញជាកូនសោដូច RUNALL_STATE។
declare -A RUNALL_LABEL_HINTS=(
    ["node syntax ៖ ZoeW module view · ZoeKeyGen/app.js"]=1
    ["rules JSON valid"]=1
    ["license-verify.js byte-identical ×2"]=1
    ["error-reporting.js byte-identical ×2"]=1
    ["គ្មាន trailing whitespace"]=1
    ["server-time-function-test"]=1
    ["emu/import-native-I100-cookie-unsigned"]=23
    ["emu/import-native-I100-cookie-signed"]=28
    ["emu/import-native-I100-cookie-mixed"]=25
    ["emu/import-native-I100-cookie-mixed-same-group"]=28
    ["emu/import-native-I100-palm-unsigned"]=20
    ["emu/import-native-I100-palm-signed"]=27
    ["emu/import-native-I100-palm-mixed"]=17
    ["emu/import-native-I100-palm-mixed-same-group"]=17
    ["emu/scan-operation-sdk"]=10
    ["exit-code-integrity 1/4 (meta)"]=100
    ["exit-code-integrity 2/4 (meta)"]=93
    ["exit-code-integrity 3/4 (meta)"]=169
    ["exit-code-integrity 4/4 (meta)"]=196
    ["emu/scan-month-coordination-sdk"]=35
    ["emu/scan-month-delay-sdk"]=7
    ["emu/scan-month-reconnect-sdk"]=7
    ["modal-keyboard 1/3 (browser ពិត ៖ ទូរស័ព្ទ ៤ ទំហំ)"]=125
    ["modal-keyboard 2/3 (browser ពិត ៖ ទូរស័ព្ទផ្តេក · iPad)"]=98
    ["modal-keyboard 3/3 (browser ពិត ៖ រំកិល · APK · ចុច · toast · សុវត្ថិភាព)"]=120
    ["modal-keyboard-device 1/4 (browser ពិត · Android APK/PWA · iPhone · iPad ៖ ប្រអប់)"]=196
    ["modal-keyboard-device 2/4 (browser ពិត · keyboard លេខ · ចុចកន្លែងវាយ Barcode · ម៉ាស៊ីនស្កេន · zoom)"]=207
    ["modal-keyboard-device 3/4 (browser ពិត · ប្រអប់រអិលតាម keyboard ៖ ស៊ុមម្តងៗ)"]=184
    ["modal-keyboard-device 4/4 (browser ពិត · iPhone ៖ ចុច + keyboard លោតហួស ➜ រអិលតែម្តង · ∨/∧ មិនរំកិលទំព័រ · keyboard លោត ➜ មិនទាញ document · ស្កេនដក ➜ លើក #appPages)"]=206
    # ពេលបែងចែកនៃផ្នែក mutation នីមួយៗ មិនមែនពិដាន checker។
    # ផ្នែកថ្មីយកទម្ងន់ ២៤២ វិ. ពីគំរូ CPU ពីរ រួមបម្រុង ៣០ វិ.; ត្រូវវាស់ពិតមុនអះអាងល្បឿន។
    ["money-guardian 1/6"]=242
    ["money-guardian 2/6"]=242
    ["money-guardian 3/6"]=242
    ["money-guardian 4/6"]=242
    ["money-guardian 5/6"]=242
    ["money-guardian 6/6"]=242
    ["zoew-suite 1/5 (ZoeW React ៖ tsc · lint · vitest 1/4 · android)"]=176
    ["zoew-suite 2/5 (ZoeW React ៖ build · sw · smoke · native · rules)"]=224
    ["zoew-suite 3/5 (ZoeW React ៖ vitest 2/4)"]=130
    ["zoew-suite 4/5 (ZoeW React ៖ vitest 3/4)"]=136
    ["zoew-suite 5/5 (ZoeW React ៖ vitest 4/4)"]=159
)
# ── RUNALL_SHARD=k/n ៖ បែងចែក checker តាមពេលវាស់ មិនមែនតាមចំនួន ───────────────────────
# ⛔ បញ្ជី + hints ថេរ (script និងស្លាក sub-suite) ជា input តែមួយ ៖ មិនប្រើ state · nproc · RUNALL_JOBS។
# គំរូ lane CI ២/browser ១/emu ១/excl ម្នាក់ឯង រៀប checker យឺតមុនទៅ shard ដែលបញ្ចប់មុន។
# ពេលប៉ាន់ស្មានមិនមែនពេលដែលបានវាស់លើការបែងចែកថ្មីទេ; CI បៃតងត្រូវការផ្នែកទាំង n បៃតង។
runall_shard_pick() {  # RUNALL_SHARD ➜ RUNALL_MINE[i] · RUNALL_SHARD_LOAD (ពេល wall ប៉ាន់ស្មាន វិ.)
    local k n i w h plan shard load index
    local -A hints=()
    if ! [[ "$RUNALL_SHARD" =~ ^([0-9]+)/([0-9]+)$ ]]; then
        echo "*** FAIL *** RUNALL_SHARD ត្រូវជា k/n (1 ≤ k ≤ n ≤ 32) — ទទួល «${RUNALL_SHARD}»"
        return 1
    fi
    k="${BASH_REMATCH[1]}"; n="${BASH_REMATCH[2]}"
    if [ "${#k}" -gt 2 ] || [ "${#n}" -gt 2 ]; then
        echo "*** FAIL *** RUNALL_SHARD ៖ លេខលើសព្រំដែន 1..32"
        return 1
    fi
    k=$((10#$k)); n=$((10#$n))
    if [ "$n" -lt 1 ] || [ "$n" -gt 32 ] || [ "$k" -lt 1 ] || [ "$k" -gt "$n" ]; then
        echo "*** FAIL *** RUNALL_SHARD ត្រូវជា k/n (1 ≤ k ≤ n ≤ 32) — ទទួល «${RUNALL_SHARD}»"
        return 1
    fi
    for h in $RUNALL_HINTS; do hints[${h%%:*}]="${h##*:}"; done
    # គំរូ CI ថេរ ៖ lane ២ · browser ១ · emu ១ · excl ម្នាក់ឯង។ មិនអាន state/CPU/env របស់ runner។
    # ប៉ាន់ស្មានការបញ្ចប់តាមលំដាប់ runall_order ជំនួសផលបូកដែលមិនឃើញ browser/emu រង់ចាំគ្នា។
    if ! plan=$(set -o pipefail
        for ((i = 0; i < ${#J_KIND[@]}; i++)); do
            [ "${J_KIND[$i]}" = hdr ] && continue
            w="${RUNALL_LABEL_HINTS[${J_LABEL[$i]}]:-}"
            [ -z "$w" ] && [ -n "${J_ID[$i]}" ] && w="${hints[${J_ID[$i]}]:-}"
            if [ -z "$w" ]; then case "${J_LANE[$i]}" in emu) w=15 ;; browser) w=12 ;; *) w=2 ;; esac; fi
            printf '%s\t%s\t%s\n' "$i" "${J_LANE[$i]:-any}" "$w"
        done | node -e '
const fs = require("fs");
const count = Number(process.argv[1]);
const rows = fs.readFileSync(0, "utf8").trim();
const jobs = rows ? rows.split("\n").map(line => {
    const [index, lane, duration] = line.split("\t");
    const job = {index: Number(index), lane, duration: Number(duration)};
    if (!Number.isSafeInteger(job.duration) || job.duration < 1 || !Number.isSafeInteger(job.index)) throw Error("RUNALL_HINTS");
    return job;
}) : [];
function wall(items) {
    const queue = items.slice().sort((a, b) => (a.lane !== "excl") - (b.lane !== "excl") || b.duration - a.duration || a.index - b.index);
    let active = [], time = 0;
    while (queue.length || active.length) {
        for (let i = 0; i < queue.length;) {
            const job = queue[i];
            if (active.some(x => x.job.lane === "excl")) break;
            if (job.lane === "excl") {
                if (!active.length) { active.push({job, end: time + job.duration}); queue.splice(i, 1); }
                break;
            }
            if (active.length >= 2) break;
            if (["browser", "emu"].includes(job.lane) && active.some(x => x.job.lane === job.lane)) { i++; continue; }
            active.push({job, end: time + job.duration}); queue.splice(i, 1);
        }
        if (!active.length) throw Error("RUNALL_SHARD");
        time = Math.min(...active.map(x => x.end));
        active = active.filter(x => x.end > time);
    }
    return time;
}
const shards = Array.from({length: count}, () => ({jobs: [], work: 0}));
const weight = job => job.duration * (job.lane === "excl" ? 2 : 1);
jobs.sort((a, b) => weight(b) - weight(a) || a.index - b.index);
for (const job of jobs) {
    let best = 0, finish = Infinity;
    for (let s = 0; s < count; s++) {
        const projected = wall([...shards[s].jobs, job]);
        if (projected < finish || (projected === finish && shards[s].work < shards[best].work)) { best = s; finish = projected; }
    }
    shards[best].jobs.push(job); shards[best].work += job.duration;
}
for (let s = 0; s < count; s++) {
    const load = wall(shards[s].jobs);
    console.log([s + 1, load, "-"].join("\t"));
    for (const job of shards[s].jobs) console.log([s + 1, load, job.index].join("\t"));
}
' "$n"); then
        echo "*** FAIL *** RUNALL_SHARD ៖ គណនាបញ្ជីមិនបាន"
        return 1
    fi
    RUNALL_MINE=(); RUNALL_SHARD_LOAD=0
    while IFS=$'\t' read -r shard load index; do
        [ "$shard" = "$k" ] || continue
        RUNALL_SHARD_LOAD="$load"
        [ "$index" = - ] || RUNALL_MINE[$index]=1
    done <<< "$plan"
    RUNALL_SHARD_K="$k"; RUNALL_SHARD_N="$n"
    return 0
}
runall_order() {  # ➜ RUNALL_ORDER ៖ excl មុន (រត់ម្នាក់ឯងពេលគ្មានអ្វីរត់) រួចយូរ ➜ មុន (state មុន · RUNALL_HINTS · lane) · ស្មើ ➜ លំដាប់បញ្ជី
    local i rank hint h
    local -A hints=()
    for h in $RUNALL_HINTS; do hints[${h%%:*}]=$(( ${h##*:} * 1000 )); done
    RUNALL_ORDER=()
    if [ "$RUNALL_JOBS" -le 1 ]; then
        for ((i = 0; i < ${#J_KIND[@]}; i++)); do [ "${J_ST[$i]}" = queue ] && RUNALL_ORDER+=("$i"); done
        return
    fi
    while IFS=$'\t' read -r rank hint i; do RUNALL_ORDER+=("$i"); done < <(
        for ((i = 0; i < ${#J_KIND[@]}; i++)); do
            [ "${J_ST[$i]}" = queue ] || continue
            rank=1; [ "${J_LANE[$i]}" = excl ] && rank=0
            hint="${RS_MS[${J_LABEL[$i]}]:-}"
            [ -z "$hint" ] && [ -n "${RUNALL_LABEL_HINTS[${J_LABEL[$i]}]:-}" ] && hint=$(( ${RUNALL_LABEL_HINTS[${J_LABEL[$i]}]} * 1000 ))
            [ -z "$hint" ] && [ -n "${J_ID[$i]}" ] && hint="${hints[${J_ID[$i]}]:-}"
            if [ -z "$hint" ]; then case "${J_LANE[$i]}" in emu) hint=15000 ;; browser) hint=12000 ;; *) hint=2000 ;; esac; fi
            printf '%s\t%s\t%s\n' "$rank" "$hint" "$i"
        done | LC_ALL=C sort -t "$(printf '\t')" -k1,1n -k2,2nr -k3,3n)
}

runall_start() {  # <j>
    local j="$1"
    J_ST[$j]=running
    if [ "${RUNALL_PROGRESS:-1}" = 1 ]; then printf '▶ ចាប់ផ្តើម ៖ %s\n' "${J_LABEL[$j]}"; fi
    runall_exec "$j" &
    J_SPID[$j]=$!
    RUNALL_RUNNING+=("$j")
    RUNALL_ACTIVE=$((RUNALL_ACTIVE + 1))
    case "${J_LANE[$j]}" in
        excl) RUNALL_N_EXCL=$((RUNALL_N_EXCL + 1)) ;;
        emu) RUNALL_N_EMU=$((RUNALL_N_EMU + 1)) ;;
        browser) RUNALL_N_BROWSER=$((RUNALL_N_BROWSER + 1)) ;;
    esac
}
runall_reap() {  # រង់ចាំ checker ណាមួយចប់ ➜ សាលក្រម/state/progress ភ្លាម · លទ្ធផលលម្អិតនៅតាមលំដាប់
    local j keep=()
    if [ "$RUNALL_ACTIVE" -eq 1 ]; then wait "${J_SPID[${RUNALL_RUNNING[0]}]}" 2>/dev/null
    else wait -n 2>/dev/null; fi
    for j in "${RUNALL_RUNNING[@]}"; do
        if [ -f "$RUNALL_DIR/$j.rc" ] || ! kill -0 "${J_SPID[$j]}" 2>/dev/null; then
            wait "${J_SPID[$j]}" 2>/dev/null
            runall_judge "$j"
            RUNALL_COMPLETED=$((RUNALL_COMPLETED + 1))
            if [ "${RUNALL_PROGRESS:-1}" = 1 ]; then
                printf '● ចប់ [%s/%s] ៖ %s · %s · %s\n' "$RUNALL_COMPLETED" "$RUNALL_PROGRESS_TOTAL" \
                    "${J_LABEL[$j]}" "${J_V[$j]}" "$(runall_fmt_ms "${J_MS[$j]}")"
            fi
            RUNALL_ACTIVE=$((RUNALL_ACTIVE - 1))
            case "${J_LANE[$j]}" in
                excl) RUNALL_N_EXCL=$((RUNALL_N_EXCL - 1)) ;;
                emu) RUNALL_N_EMU=$((RUNALL_N_EMU - 1)) ;;
                browser) RUNALL_N_BROWSER=$((RUNALL_N_BROWSER - 1)) ;;
            esac
        else
            keep+=("$j")
        fi
    done
    RUNALL_RUNNING=("${keep[@]}")
}
# Print only reconstructed, allowlisted native summary fields; never replay raw stdout.
runall_native_summary() { # <output-file> <label>
    node -e '
const fs=require("fs");
(function(){try {
  const [file,label]=process.argv.slice(1), m=/^emu\/import-native-(I100-(?:cookie|palm)-(?:unsigned|signed|mixed|mixed-same-group))$/.exec(label);
  if(!m){process.exitCode=1;return;}
  const st=fs.statSync(file);if(!st.isFile()||st.size>65536){process.exitCode=1;return;}
  const prefix="IMPORT_PAIRED_CI_RESULT ", rows=fs.readFileSync(file,"utf8").split(/\r?\n/).filter(Boolean);
  if(rows.length!==1||!rows[0].startsWith(prefix)){process.exitCode=1;return;}
  const r=JSON.parse(rows[0].slice(prefix.length)), p=r?.profiles;
  if(Object.keys(r).sort().join(",")!=="batchSha256,crossProviderParity,emulatorJarHashStatus,emulatorJarSHA256,nativeRulesHashStatus,nativeRulesSha256,profiles,scope,sourceHashes,sql,status"||r.status!=="PASS"||r.scope!=="NATIVE_ONLY"||r.sql!=="UNRUN"||r.crossProviderParity!=="UNRUN_SINGLE_PROVIDER"||!Array.isArray(p)||p.length!==1||p[0]?.id!==m[1]||Object.keys(p[0]).sort().join(",")!=="category,childDiagnostic,id,outcome,output,ownerDiagnostic,phase,status"||p[0].status!=="PASS"||p[0].outcome!=="PROVEN"||p[0].phase!==null||p[0].category!==null||p[0].ownerDiagnostic!==null||p[0].childDiagnostic!==null){process.exitCode=1;return;}
  const o=p[0].output, zero=["stderrBytes","unexpectedLines","failureLines","skipLines","warningLines","vmWarnings","vmErrors","vmUnsupported"];
  if(!o||typeof o!=="object"||!Number.isSafeInteger(o.stdoutBytes)||o.stdoutBytes<1||zero.some(k=>o[k]!==0)||o.vmCountStatus!=="FINAL"||o.overflow!==false||o.streamCountsComplete!==true||o.countsComplete!==true){process.exitCode=1;return;}
  const isHash=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);if(r.nativeRulesHashStatus!=="VERIFIED_AFTER"||r.emulatorJarHashStatus!=="REPORTED_BY_OWNER"||!isHash(r.sourceHashes?.raw)||!isHash(r.sourceHashes?.instrumented)||!isHash(r.nativeRulesSha256)||!isHash(r.emulatorJarSHA256)||!isHash(r.batchSha256)){process.exitCode=1;return;}
  console.log("      native-result: "+JSON.stringify({case:m[1],status:"PASS",scope:"NATIVE_ONLY",sql:"UNRUN",crossProviderParity:"UNRUN_SINGLE_PROVIDER",sourceHashes:{raw:r.sourceHashes.raw,instrumented:r.sourceHashes.instrumented},nativeRulesSha256:r.nativeRulesSha256,nativeRulesHashStatus:"VERIFIED_AFTER",emulatorJarSHA256:r.emulatorJarSHA256,emulatorJarHashStatus:"REPORTED_BY_OWNER",batchSha256:r.batchSha256}));
}catch(_){process.exitCode=1;}})();' "$1" "$2"
}
# A failure projection never changes the exit verdict or asserts business failure.
runall_native_failure_summary() { # <output-file> <label>
    node -e '
const fs=require("fs");
(function(){try {
 const [file,label]=process.argv.slice(1),m=/^emu\/import-native-(I100-(?:cookie|palm)-(?:unsigned|signed|mixed|mixed-same-group))$/.exec(label);
 if(!m){process.exitCode=1;return;}
 const st=fs.statSync(file);if(!st.isFile()||st.size>65536){process.exitCode=1;return;}
 const prefix="IMPORT_PAIRED_CI_RESULT ",lines=fs.readFileSync(file,"utf8").split(/\r?\n/).filter(Boolean);
 const rows=lines.filter(x=>x.startsWith(prefix)),fixed=new Set(["FAIL native import case; evidence retained","FAIL paired import runner"]);
 if(rows.length!==1||lines.some(x=>!x.startsWith(prefix)&&!fixed.has(x))){process.exitCode=1;return;}
 const r=JSON.parse(rows[0].slice(prefix.length)),p=r?.profiles;
 const keys="batchSha256,crossProviderParity,emulatorJarHashStatus,emulatorJarSHA256,nativeRulesHashStatus,nativeRulesSha256,profiles,scope,sourceHashes,sql,status";
 if(!r||Object.keys(r).sort().join(",")!==keys||r.status!=="FAIL"||r.scope!=="NATIVE_ONLY"||r.sql!=="UNRUN"||r.crossProviderParity!=="UNRUN_SINGLE_PROVIDER"||!Array.isArray(p)||p.length!==1||p[0]?.id!==m[1]||Object.keys(p[0]).sort().join(",")!=="category,childDiagnostic,id,outcome,output,ownerDiagnostic,phase,status"||p[0].status!=="FAIL"||p[0].outcome!=="UNKNOWN"){process.exitCode=1;return;}
 const phases=new Set(["PREFLIGHT","DISK","RULE_IDENTITY","CAPTURE_SETUP","INITIAL_RECEIPT","OWNED_WRAPPER","CHILD_OUTPUT","NATIVE_SNAPSHOT","CHILD_EVIDENCE"]),categories=new Set(["PREFLIGHT_FAILED","ASSERTION_FAILED","SYNTAX_ERROR","TYPE_ERROR","ERROR"]);
 if(!phases.has(p[0].phase)||!(p[0].category===null||categories.has(p[0].category))){process.exitCode=1;return;}
 let output=null;
 if(p[0].output!==null){
  const v=p[0].output, fields=["stdoutBytes","stderrBytes","unexpectedLines","failureLines","skipLines","warningLines","vmWarnings","vmErrors","vmUnsupported","vmCountStatus","overflow","streamCountsComplete","countsComplete"];
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!==fields.slice().sort().join(",")){process.exitCode=1;return;}
  const count=["stdoutBytes","stderrBytes","unexpectedLines","failureLines","skipLines","warningLines"],vm=["vmWarnings","vmErrors","vmUnsupported"];
  if(count.some(k=>!Number.isSafeInteger(v[k])||v[k]<0)||!["UNKNOWN","LOWER_BOUND","FINAL"].includes(v.vmCountStatus)||["overflow","streamCountsComplete","countsComplete"].some(k=>typeof v[k]!=="boolean")){process.exitCode=1;return;}
  if(vm.some(k=>v.vmCountStatus==="UNKNOWN"?v[k]!==null:!Number.isSafeInteger(v[k])||v[k]<0)||v.countsComplete!==(v.vmCountStatus==="FINAL")||(v.countsComplete&&!v.streamCountsComplete)||(v.overflow&&v.streamCountsComplete)){process.exitCode=1;return;}
  output=Object.fromEntries(fields.map(k=>[k,v[k]]));
 }
 // Only fixed projections may leave this process; never copy raw diagnostics.
 const own=p[0].ownerDiagnostic,child=p[0].childDiagnostic;
 const boolOrNull=v=>v===null||typeof v==="boolean";
 let ownerDiagnostic=null,childDiagnostic=null;
 if(own!==null){
  const fields=["status","cleanup","commandStarted","commandCompleted","childCode","childSignal","outputPresent","failureLine","skipLine","snapshot","snapshotReason"];
  const reasons=["MARKER_UNREADABLE","MARKER_INVALID","MARKER_MISMATCH","OWNER_UNPROVEN","READ_ERROR","SNAPSHOT_TIMEOUT","RECEIPT_TIMEOUT","RECEIPT_WRITE_FAILED","ROOT_INVALID","ROOT_UNREADABLE","ROOT_TOO_LARGE","NON_SYNTHETIC_CONTENT","SENSITIVE_CONTENT","ROOT_LIMIT","STATE_DIRECTORY_INVALID","STATE_DIRECTORY_UNREADABLE"];
  if(!own||typeof own!=="object"||Array.isArray(own)||Object.keys(own).sort().join(",")!==fields.slice().sort().join(",")||!["PASS","FAIL","UNRUN","UNKNOWN"].includes(own.status)||!["WRAPPER_CONFIRMED","UNKNOWN"].includes(own.cleanup)||["commandStarted","commandCompleted","outputPresent","failureLine","skipLine"].some(k=>!boolOrNull(own[k]))||!(own.childCode===null||Number.isInteger(own.childCode)&&own.childCode>=0&&own.childCode<=255)||!["NONE","SIGTERM","SIGKILL","SIGINT","OTHER","UNKNOWN"].includes(own.childSignal)||!["OBSERVED_POINT_IN_TIME_ONLY","UNREADABLE","NOT_ATTEMPTED","UNKNOWN"].includes(own.snapshot)||!(own.snapshotReason===null||reasons.includes(own.snapshotReason))){process.exitCode=1;return;}
  ownerDiagnostic=Object.fromEntries(fields.map(k=>[k,own[k]]));
 }
 if(child!==null){
  const fields=["evidence","ledger","category","wait","location","aggregate"],newFields=[...fields,"assertionDiagnostic"],waits=["AUTHORITATIVE_100","ORIGINS_ACK_FENCE","AUTHORITATIVE_LISTENERS","FIRST_ACK_QUIESCENCE","FIRST_STATUS_QUIESCENCE","FIRST_POST_STATUS_ACK","REPEAT_ACK_QUIESCENCE","REPEAT_STATUS_QUIESCENCE","REPEAT_POST_STATUS_ACK","NATIVE_TRANSPORT_QUIESCENCE","BACKGROUND_QUIESCENCE"];
  if(!child||typeof child!=="object"||Array.isArray(child)||![fields,newFields].some(keys=>Object.keys(child).sort().join(",")===keys.slice().sort().join(","))||child.evidence!=="PRIVATE_CHILD_REPORTED"||!["FAIL","UNRUN","IN_PROGRESS","UNKNOWN"].includes(child.ledger)||!["WAIT_TIMEOUT_REPORTED","ASSERTION_REPORTED","OTHER_REPORTED","UNKNOWN"].includes(child.category)||!(child.wait===null||waits.includes(child.wait))||(child.category==="WAIT_TIMEOUT_REPORTED")!==(child.wait!==null)||!ownerDiagnostic||ownerDiagnostic.status!=="FAIL"||ownerDiagnostic.cleanup!=="WRAPPER_CONFIRMED"||ownerDiagnostic.commandStarted!==true||ownerDiagnostic.commandCompleted!==true||!Number.isInteger(ownerDiagnostic.childCode)||ownerDiagnostic.childCode<=0||ownerDiagnostic.childSignal!=="NONE"){process.exitCode=1;return;}
  let location=null;if(child.location!==null){const l=child.location;if(!l||typeof l!=="object"||Array.isArray(l)||Object.keys(l).sort().join(",")!=="file,function"||l.file!=="import-paired-sdk-test.js"||!["until","runCore","nativeBackend","ready","main"].includes(l.function)){process.exitCode=1;return;}location={file:l.file,function:l.function};}
  let assertionDiagnostic=null;
  if(Object.prototype.hasOwnProperty.call(child,"assertionDiagnostic")&&child.assertionDiagnostic!==null){
   const d=child.assertionDiagnostic,allowed={FIRST_ORACLE:["core.oracle","core.codes-phones","core.prices-incarnations","core.prices-incarnations.mirrors","core.pending-empty","core.same-batch"],SAME_BATCH_REPEAT:["core.repeat-unchanged","core.effects-unchanged","core.upstream","core.no-outbound","core.journals-empty","core.no-source-errors"]};
   if(child.ledger!=="FAIL"||child.category!=="ASSERTION_REPORTED"||child.wait!==null||!d||typeof d!=="object"||Array.isArray(d)||!["assertionId,phase","assertionId,eventCounts,phase"].includes(Object.keys(d).sort().join(","))||!Object.prototype.hasOwnProperty.call(allowed,d.phase)||!allowed[d.phase].includes(d.assertionId)){process.exitCode=1;return;}
   assertionDiagnostic={phase:d.phase,assertionId:d.assertionId};
   if(Object.prototype.hasOwnProperty.call(d,"eventCounts")){const c=d.eventCounts,keys=["SCAN_EVIDENCE_PENDING","LIST_PICKUP","LISTENER","SUBSCRIPTION","TRANSPORT","SWEEP","CALLBACK","CONSOLE","HISTORY_MERGE","HISTORY_SAVE","HISTORY_PATCH","PICKUP_COLLECTED","PICKUP_RECOVERY","CLEANUP_COLLECTED","CLEANUP_RECOVERY","SCAN_LEDGER","SCAN_OUTCOME","TX_OUTCOME","OTHER"],codes=["PERMISSION","PENDING","JOURNAL_UNAVAILABLE","EVIDENCE_UNAVAILABLE","SDK_UNAVAILABLE","TRANSPORT","SCOPE_CHANGED","OTHER"];const valid=(obj,ks)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&Object.keys(obj).sort().join(",")===ks.slice().sort().join(",")&&ks.every(k=>Number.isSafeInteger(obj[k])&&obj[k]>=0&&obj[k]<=10000);if(d.phase!=="SAME_BATCH_REPEAT"||d.assertionId!=="core.no-source-errors"||!c||typeof c!=="object"||Array.isArray(c)||Object.keys(c).sort().join(",")!=="categories,codes,overflow"||typeof c.overflow!=="boolean"||!valid(c.categories,keys)||!valid(c.codes,codes)){process.exitCode=1;return;}const total=keys.reduce((n,k)=>n+c.categories[k],0),codeTotal=codes.reduce((n,k)=>n+c.codes[k],0);if(total<1||total>10000||codeTotal!==total){process.exitCode=1;return;}assertionDiagnostic.eventCounts={categories:Object.fromEntries(keys.map(k=>[k,c.categories[k]])),codes:Object.fromEntries(codes.map(k=>[k,c.codes[k]])),overflow:c.overflow};}

  }
  let aggregate=null;
  if(child.aggregate!==null){
   const a=child.aggregate,keys=["schema","evidence","availability","consistency","case","phase","error","counts"],fields=["historyGroups","historyBarcodes","historyUniqueBarcodes","registryEntries","operationsAdmitted","operationsPrepared","operationsCommitted","operationsCancelled","operationsOther","journalStorageKeys","capturedEvents","pendingJournalOperations"];
   const unsigned=m[1]==="I100-cookie-unsigned"&&child.wait==="AUTHORITATIVE_100"&&a?.case===m[1]&&a?.error==="AUTHORITATIVE_100_TIMEOUT",origin=m[1]==="I100-cookie-mixed-same-group"&&child.wait==="ORIGINS_ACK_FENCE"&&a?.case===m[1]&&a?.error==="ORIGINS_ACK_FENCE_TIMEOUT";
   if(origin)fields.push("originsMatched","originsMissingOrOther");
   if(!a||typeof a!=="object"||Array.isArray(a)||Object.keys(a).sort().join(",")!==keys.slice().sort().join(",")||!(unsigned||origin)||child.ledger!=="FAIL"||child.category!=="WAIT_TIMEOUT_REPORTED"||a.schema!==1||a.evidence!=="PRIVATE_CHILD_REPORTED"||!["AVAILABLE","UNAVAILABLE"].includes(a.availability)||a.consistency!=="POST_TIMEOUT_NONATOMIC"||a.phase!=="FIRST_IMPORT"||!a.counts||typeof a.counts!=="object"||Array.isArray(a.counts)||Object.keys(a.counts).sort().join(",")!==fields.slice().sort().join(",")){process.exitCode=1;return;}
   for(const key of fields){const n=a.counts[key];if(a.availability==="UNAVAILABLE"||key==="pendingJournalOperations"){if(n!==null){process.exitCode=1;return;}}else if(!Number.isSafeInteger(n)||n<0||n>10000){process.exitCode=1;return;}}
   if(a.availability==="AVAILABLE"&&(a.counts.operationsOther!==0||a.counts.historyUniqueBarcodes>100||a.counts.registryEntries>100||a.counts.historyUniqueBarcodes>a.counts.historyBarcodes||(a.counts.historyBarcodes>0&&(a.counts.historyGroups===0||a.counts.historyUniqueBarcodes===0))||a.counts.operationsAdmitted+a.counts.operationsPrepared+a.counts.operationsCommitted+a.counts.operationsCancelled>10000)){process.exitCode=1;return;}
   if(origin&&a.availability==="AVAILABLE"&&a.counts.originsMatched+a.counts.originsMissingOrOther!==a.counts.historyBarcodes){process.exitCode=1;return;}
   aggregate={schema:1,evidence:"PRIVATE_CHILD_REPORTED",availability:a.availability,consistency:"POST_TIMEOUT_NONATOMIC",case:m[1],phase:"FIRST_IMPORT",error:origin?"ORIGINS_ACK_FENCE_TIMEOUT":"AUTHORITATIVE_100_TIMEOUT",counts:Object.fromEntries(fields.map(k=>[k,a.counts[k]]))};
  }
  childDiagnostic={evidence:"PRIVATE_CHILD_REPORTED",ledger:child.ledger,category:child.category,wait:child.wait,location,assertionDiagnostic,aggregate};
 }
 const isHash=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
 if(!(r.sourceHashes===null||(r.sourceHashes&&Object.keys(r.sourceHashes).sort().join(",")==="instrumented,raw"&&isHash(r.sourceHashes.raw)&&isHash(r.sourceHashes.instrumented)))){process.exitCode=1;return;}
 if(!(r.batchSha256===null||isHash(r.batchSha256))){process.exitCode=1;return;}
 if(!((r.nativeRulesSha256===null&&r.nativeRulesHashStatus==="UNAVAILABLE")||(isHash(r.nativeRulesSha256)&&["OBSERVED_PRECHECK","VERIFIED_AFTER"].includes(r.nativeRulesHashStatus)))){process.exitCode=1;return;}
 if(!((r.emulatorJarSHA256===null&&r.emulatorJarHashStatus==="UNAVAILABLE")||(isHash(r.emulatorJarSHA256)&&r.emulatorJarHashStatus==="REPORTED_BY_OWNER"))){process.exitCode=1;return;}
 console.log("      native-failure: "+JSON.stringify({case:m[1],status:"FAIL",outcome:"UNKNOWN",scope:"NATIVE_ONLY",sql:"UNRUN",crossProviderParity:"UNRUN_SINGLE_PROVIDER",phase:p[0].phase,category:p[0].category,ownerDiagnostic,childDiagnostic,output,sourceHashes:r.sourceHashes,nativeRulesSha256:r.nativeRulesSha256,nativeRulesHashStatus:r.nativeRulesHashStatus,emulatorJarSHA256:r.emulatorJarSHA256,emulatorJarHashStatus:r.emulatorJarHashStatus,batchSha256:r.batchSha256}));
}catch(_){process.exitCode=1;}})();' "$1" "$2"
}
runall_emit() {  # <i> — បោះពុម្ពតាមលំដាប់បញ្ជី + រាប់ + ចងចាំឈ្មោះសម្រាប់សេចក្តីសង្ខេប
    local i="$1" mark=''
    case "${J_ST[$i]}" in
        hdr) RUNALL_HDR="${J_LABEL[$i]}"; return ;;
        off) return ;;
        carried) mark='  ↺ ពី state' ;;
    esac
    if [ -n "$RUNALL_HDR" ]; then
        [ "$RUNALL_PRINTED" = 1 ] && echo
        printf '%s\n' "$RUNALL_HDR"
        RUNALL_HDR=''
    fi
    RUNALL_PRINTED=1
    printf '  %-32s %7s  %s%s\n' "${J_LABEL[$i]}" "$(runall_fmt_ms "${J_MS[$i]}")" "${J_TEXT[$i]}" "$mark"
    if [ "${J_ID[$i]}" = emu/import-paired-ci-runner ] && [ "${J_ST[$i]}" = done ]; then
        if [ "${J_V[$i]}" = PASS ]; then
            runall_native_summary "$RUNALL_DIR/$i.out" "${J_LABEL[$i]}"
        else
            local native_rc=''
            [ -f "$RUNALL_DIR/$i.rc" ] && read -r native_rc _ < "$RUNALL_DIR/$i.rc"
            if [ -z "$native_rc" ] || [ "$native_rc" = 0 ] || [ "$native_rc" = 124 ] || [ "$native_rc" = 137 ] || ! runall_native_failure_summary "$RUNALL_DIR/$i.out" "${J_LABEL[$i]}"; then
                echo '      native outcome UNKNOWN; SQL/parity UNRUN'
            fi
        fi
    fi
    if [ "${J_SHOW[$i]}" = 1 ] && [ "${J_ID[$i]}" != emu/import-paired-ci-runner ]; then
        sed 's/^/      /' "$RUNALL_DIR/$i.out"
    fi
    case "${J_V[$i]}" in
        PASS) pass=$((pass + 1)) ;;
        PARTIAL) partial=$((partial + 1)); RUNALL_PARTIAL_NAMES+=("${J_LABEL[$i]}") ;;
        SKIPPED) skip=$((skip + 1)); RUNALL_SKIP_NAMES+=("${J_LABEL[$i]}") ;;
        *) fail=$((fail + 1)); RUNALL_FAIL_NAMES+=("${J_LABEL[$i]}") ;;
    esac
    if [ "${J_ST[$i]}" = carried ]; then RUNALL_CARRIED=$((RUNALL_CARRIED + 1)); else RUNALL_RAN=$((RUNALL_RAN + 1)); fi
}
runall_abort() {  # INT · TERM · HUP ➜ បញ្ឈប់ checker ដែលកំពុងរត់ (ក្រុម process របស់ timeout) · រក្សា state
    trap - INT TERM HUP
    local j p tries
    echo
    echo "⛔ run-all ត្រូវរំខាន ➜ បញ្ឈប់ checker ដែលកំពុងរត់ ${#RUNALL_RUNNING[@]}"
    for j in "${RUNALL_RUNNING[@]}"; do
        p="$(cat "$RUNALL_DIR/$j.pid" 2>/dev/null)"
        [ -n "$p" ] && { kill -TERM -- "-$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null; }
    done
    for tries in 1 2 3 4 5; do
        p=''
        for j in "${RUNALL_RUNNING[@]}"; do kill -0 "${J_SPID[$j]}" 2>/dev/null && p=1; done
        [ -z "$p" ] && break
        sleep 1
    done
    for j in "${RUNALL_RUNNING[@]}"; do
        p="$(cat "$RUNALL_DIR/$j.pid" 2>/dev/null)"
        [ -n "$p" ] && { kill -KILL -- "-$p" 2>/dev/null || kill -KILL "$p" 2>/dev/null; }
    done
    [ -n "$RUNALL_STATE" ] && echo "   លទ្ធផលដែលចប់រួចនៅក្នុង $RUNALL_STATE ➜ បន្ត ៖ RUNALL_RESUME=1 bash audit-tools/run-all.sh"
    rm -rf "$RUNALL_DIR"
    runall_cleanup_owned
    exit 130
}
runall_drain() {  # រត់បញ្ជីទាំងមូល ➜ 0 · បដិសេធ (RUNALL_ONLY/RESUME) ➜ 2 · គ្មាន bash ថ្មីគ្រប់ ➜ 1
    local n=${#J_KIND[@]} j next=0 queued
    RUNALL_RUNNING=(); RUNALL_FAIL_NAMES=(); RUNALL_PARTIAL_NAMES=(); RUNALL_SKIP_NAMES=()
    RUNALL_ACTIVE=0; RUNALL_N_EXCL=0; RUNALL_N_EMU=0; RUNALL_N_BROWSER=0
    RUNALL_RAN=0; RUNALL_CARRIED=0; RUNALL_HDR=''; RUNALL_PRINTED=0
    RUNALL_T0="$(runall_now_ms)"
    if [ "$RUNALL_BASH_OK" != 1 ]; then
        echo "*** FAIL *** ម៉ាស៊ីនរត់ត្រូវការ bash >= 4.3 (\`wait -n\` · associative array) — ឥឡូវ ${BASH_VERSION}"
        fail=$((fail + 1)); return 1
    fi
    RUNALL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/zoe-runall.XXXXXX")" || { echo "*** FAIL *** mktemp"; fail=$((fail + 1)); return 1; }
    runall_select || { rm -rf "$RUNALL_DIR"; return 2; }
    runall_owned_init || { rm -rf "$RUNALL_DIR"; return 1; }
    # ⛔ ការជ្រើស (SHARD · ONLY · RESUME) ជារបស់ run-all នេះតែប៉ុណ្ណោះ ៖ checker កូនដែលរត់ម៉ាស៊ីននេះខាងក្នុង (hang-guard ·
    #    runall-runner-test) ទទួលវា ➜ fixture ត្រូវបែងចែកចោល ➜ ធ្លាក់តែលើ CI ជាផ្នែក (runall-runner-test ៧ខ)
    export -n RUNALL_SHARD RUNALL_ONLY RUNALL_RESUME
    runall_order
    RUNALL_COMPLETED=0; RUNALL_PROGRESS_TOTAL=${#RUNALL_ORDER[@]}
    local timeout_note="${CHECKER_TIMEOUT}s/checker"
    if [ -z "$RUNALL_TIMEOUT_OVERRIDE" ]; then timeout_note="$timeout_note · money RTDB 2400s / Supabase 3000s"; fi
    echo "   (រត់ស្របគ្នា ${RUNALL_JOBS} checker · browser អតិបរមា ${RUNALL_BROWSER_JOBS} · emulator អតិបរមា 1 · checker ប្រភេទ meta រត់ដាច់តែឯង · ពិដាន $timeout_note)"
    trap 'runall_abort' INT TERM HUP
    while :; do
        for j in "${RUNALL_ORDER[@]}"; do
            [ "${J_ST[$j]}" = queue ] || continue
            [ "$RUNALL_N_EXCL" -gt 0 ] && break
            if [ "${J_LANE[$j]}" = excl ]; then
                [ "$RUNALL_ACTIVE" -eq 0 ] && runall_start "$j"
                break
            fi
            [ "$RUNALL_ACTIVE" -ge "$RUNALL_JOBS" ] && break
            case "${J_LANE[$j]}" in
                emu) [ "$RUNALL_N_EMU" -ge 1 ] && continue ;;
                browser) [ "$RUNALL_N_BROWSER" -ge "$RUNALL_BROWSER_JOBS" ] && continue ;;
            esac
            runall_start "$j"
        done
        while [ "$next" -lt "$n" ]; do
            case "${J_ST[$next]}" in queue|running) break ;; esac
            runall_emit "$next"
            next=$((next + 1))
        done
        if [ "$RUNALL_ACTIVE" -eq 0 ]; then
            queued=0
            for j in "${RUNALL_ORDER[@]}"; do [ "${J_ST[$j]}" = queue ] && queued=1; done
            [ "$queued" = 0 ] && break
            echo "*** FAIL *** ម៉ាស៊ីនរត់ជាប់ ៖ មាន checker រង់ចាំ តែគ្មានអ្វីអាចចាប់ផ្តើម"
            fail=$((fail + 1)); break
        fi
        runall_reap
    done
    trap - INT TERM HUP
    RUNALL_WALL=$(( $(runall_now_ms) - RUNALL_T0 ))
    rm -rf "$RUNALL_DIR"
    return 0
}
runall_exit_status() {
    # ⛔ exit 256 = 0 ក្នុង shell; CI មិនអាចបៃតងពេលមាន FAIL ឬវាស់មិនពេញ។
    if [ "$fail" -gt 0 ]; then [ "$fail" -lt 256 ] && return "$fail"; return 1; fi
    if [ "${RUNALL_STRICT:-0}" = 1 ] && { [ "$skip" -gt 0 ] || [ "$partial" -gt 0 ]; }; then return 1; fi
    return 0
}
runall_names() {  # <ចំណងជើង> <ឈ្មោះ…>
    local title="$1"; shift
    if [ "$#" -eq 0 ]; then printf '   %s (0)\n' "$title"; return; fi
    printf '   %s (%d) ៖ ' "$title" "$#"
    local first=1 x
    for x in "$@"; do [ "$first" = 1 ] || printf ' · '; printf '%s' "$x"; first=0; done
    printf '\n'
}
runall_summary() {  # សេចក្តីសង្ខេប ៖ ពេល · FAIL/PARTIAL/SKIPPED តាមឈ្មោះ · ១០ យឺតជាងគេ · បន្ទាត់ចុងក្រោយដូចមុន
    local i sum=0 total=0 off=0 line
    for ((i = 0; i < ${#J_KIND[@]}; i++)); do
        [ "${J_KIND[$i]}" = hdr ] && continue
        total=$((total + 1))
        [ "${J_ST[$i]}" = off ] && off=$((off + 1))
        [ "${J_ST[$i]}" = done ] && case "${J_MS[$i]}" in ''|*[!0-9]*) ;; *) sum=$((sum + J_MS[$i])) ;; esac
    done
    echo
    echo "==================================="
    echo "⏱  ពេលរត់ $(runall_fmt_ms "${RUNALL_WALL:-}") · ផលបូកពេល checker $(runall_fmt_ms "$sum") · lane ${RUNALL_JOBS} (browser ≤ ${RUNALL_BROWSER_JOBS})"
    [ -n "$RUNALL_STATE" ] && echo "   state ៖ $RUNALL_STATE (tree $RUNALL_TREE_HASH)"
    [ "${RUNALL_CARRIED:-0}" -gt 0 ] && echo "   ↺ យកពី state មុន ${RUNALL_CARRIED} · រត់ក្នុងជុំនេះ ${RUNALL_RAN}"
    runall_names "❌ ធ្លាក់" "${RUNALL_FAIL_NAMES[@]}"
    runall_names "◐ មួយផ្នែក" "${RUNALL_PARTIAL_NAMES[@]}"
    runall_names "⊘ រំលង" "${RUNALL_SKIP_NAMES[@]}"
    echo "   🐢 យឺតជាងគេ ១០ ៖"
    for ((i = 0; i < ${#J_KIND[@]}; i++)); do
        case "${J_ST[$i]}" in done|carried) ;; *) continue ;; esac
        case "${J_MS[$i]}" in ''|*[!0-9]*) continue ;; esac
        printf '%s\t%s\t%s\n' "${J_MS[$i]}" "${J_LABEL[$i]}" "$([ "${J_ST[$i]}" = carried ] && printf '  ↺')"
    done | LC_ALL=C sort -t "$(printf '\t')" -k1,1nr | head -10 | while IFS=$'\t' read -r i line mark; do
        printf '      %8s  %s%s\n' "$(runall_fmt_ms "$i")" "$line" "$mark"
    done
    if [ "$off" -gt 0 ]; then
        if [ -n "${RUNALL_SHARD_N:-}" ]; then
            echo "⚠️  មិនពេញលេញ ៖ វាស់ $((total - off))/${total} checker (RUNALL_SHARD ${RUNALL_SHARD_K}/${RUNALL_SHARD_N} · ទម្ងន់ ~${RUNALL_SHARD_LOAD}s${RUNALL_ONLY:+ · RUNALL_ONLY}) — tree បៃតងតែពេលផ្នែកទាំង ${RUNALL_SHARD_N} បៃតង"
        else
            echo "⚠️  មិនពេញលេញ ៖ វាស់ $((total - off))/${total} checker (RUNALL_ONLY) — នេះមិនមែនភស្តុតាងថា tree បៃតងទេ"
        fi
        if [ "$fail" -eq 0 ] && { [ "$partial" -gt 0 ] || [ "$skip" -gt 0 ]; }; then
            echo "⚠️  មិនពេញលេញ ៖ មាន checker មិនទាន់វាស់ពេញ  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
        elif [ "$fail" -eq 0 ]; then
            echo "✅ ជោគជ័យលើ checker ដែលបានវាស់ (មិនពេញលេញ)  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
        else
            echo "❌ ធ្លាក់ $fail  (ជោគជ័យ $pass, មួយផ្នែក $partial, រំលង $skip · មិនពេញលេញ)"
        fi
    elif [ "$fail" -eq 0 ] && { [ "$partial" -gt 0 ] || [ "$skip" -gt 0 ]; }; then
        echo "⚠️  មិនពេញលេញ ៖ មាន checker មិនទាន់វាស់ពេញ  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
    elif [ "$fail" -eq 0 ]; then
        echo "✅ ជោគជ័យទាំងអស់  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
    else
        echo "❌ ធ្លាក់ $fail  (ជោគជ័យ $pass, មួយផ្នែក $partial, រំលង $skip)"
    fi
}
#@runner-end

section "== តេស្តឥរិយាបថ (រត់កូដពិត ៖ ZoeW/src តាម audit build · ZoeKeyGen/app.js) =="
for t in policy-test auth-recovery-test keylist-consistency-test \
         license-grace-test license-clock-trust-test license-time-endpoint-test scan-month-fixture-date-test scan-month-orchestration-test \
         license-clock-rollback-test license-record-race-test license-seat-test \
         cleanup-clock-guard-test returned-trash-retention-test khmer-timezone-test monotonic-gate-test \
         phone-suggest-test phone-search-swipe-test \
         pin-prompt-test biometric-unlock-test keygen-pin-flow-test \
         keygen-session-security-test keygen-notice-test keygen-biometric-test \
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
         pickup-ledger-test pickup-reset-test pickup-barcode-identity-test \
         revenue-rules-clamp-test price-edit-abort-test registry-release-test late-commit-test \
         listener-pending-key-test history-patch-retry-test lookup-prefetch-test \
         lookup-freshness-test zto-proxy-test zto-budget-test zto-negative-cache-test zto-cookie-sync-test zto-cookie-store-test lookup-failure-identity-test \
         lookup-burst-test health-check-test monthly-report-test zto-network-boundaries-test \
         zto-cookie-session-test zto-cookie-capture-test zto-signed-status-test \
         zto-list-sync-test; do
    run "$t" node "audit-tools/$t.js"
done

# JSON endpoint tests target the source checkout, including Netlify function sources.
run "license-time-json-test" node audit-tools/license-time-json-test.js
run "server-time-function-test" node audit-tools/server-time-function-test.mjs
run "license-time-cors-browser-test (browser CORS)" node audit-tools/license-time-cors-browser-test.js

section "== ការត្រួតពិនិត្យរចនាសម្ព័ន្ធ =="
for t in shared-fns wiring action-binding-test function-surface-test code-duplication-test dom-hygiene state-hygiene comments payload-schema compensation-order stale-write storage-guard secret-hygiene html-sink-escaping clock-hygiene clock-basis-test doc-scope-test adaptive-link-test version-check; do
    [ -n "$NO_ACORN" ] && { skipm "$t"; continue; }
    run "$t" node "audit-tools/$t.js"
done
# ⛔ meta-checker៖ តើ checker ខ្លួនវាពិតជាមើលកូដមែនទេ? (រត់វាមុនគេក្នុងក្រុមនេះ)
run "checker-coverage (meta)" node audit-tools/checker-coverage.js
run "hang-guard (meta)" node audit-tools/hang-guard.js
run "runall-runner (meta)" node audit-tools/runall-runner-test.js
run "exit-code-integrity 1/4 (meta)" node audit-tools/exit-code-integrity.js --part=1/4
run "exit-code-integrity 2/4 (meta)" node audit-tools/exit-code-integrity.js --part=2/4
run "exit-code-integrity 3/4 (meta)" node audit-tools/exit-code-integrity.js --part=3/4
run "exit-code-integrity 4/4 (meta)" node audit-tools/exit-code-integrity.js --part=4/4
run "test-placement" node audit-tools/test-placement-test.js
run "version-bump-scope" node audit-tools/version-bump-scope.js
run "semantic-ui-color" node audit-tools/semantic-ui-color-test.js
run "user-guide" node audit-tools/user-guide-test.js
run "sdk-surface" node audit-tools/sdk-surface.js
run "rules-duplicate-keys" node audit-tools/rules-duplicate-keys.js
run "license-app-code" node audit-tools/license-app-code-test.js
run "connection-state-fuzz" node audit-tools/connection-state-fuzz-test.js
run "ledger-count-integrity" node audit-tools/ledger-count-integrity-test.js
run "cleanup-interrupt-atomicity" node audit-tools/cleanup-interrupt-atomicity-test.js
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
run "emu/license-seat-rules" node audit-tools/emu/license-seat-rules-test.js
run "emu/tx-disconnect" node audit-tools/emu/tx-disconnect-emu-test.js
run "emu/app-writes-rules" node audit-tools/emu/app-writes-rules-test.js
run "emu/app-network-e2e" node audit-tools/emu/app-network-e2e-test.js
run "money-checker-truthfulness" node audit-tools/money-checker-truthfulness-test.js
run "emu/money-multidevice" node audit-tools/emu/money-multidevice-emu-test.js
run "emu/supabase-rules-parity" node audit-tools/emu/supabase-rules-parity-test.js
run "emu/scan-operation-rules" node audit-tools/emu/scan-operation-rules-test.js
run "emu/scan-operation-sdk" node audit-tools/emu/scan-operation-sdk-test.js
run "emu/scan-month-coordination-sdk" node audit-tools/emu/scan-month-coordination-sdk-test.js
run "emu/scan-month-delay-sdk" node audit-tools/emu/scan-operation-sdk-test.js --month-wire=delay
run "emu/scan-month-reconnect-sdk" node audit-tools/emu/scan-operation-sdk-test.js --month-wire=reconnect
run "emu/trash-generation-sdk" node audit-tools/emu/trash-generation-sdk-test.js
run "emu/cleanup-consumed-sdk" node audit-tools/emu/cleanup-consumed-sdk-test.js
run "emu/empty-delete-sdk" node audit-tools/emu/empty-delete-sdk-test.js
run "emu/registry-purge-atomic-sdk" node audit-tools/emu/registry-purge-atomic-sdk-test.js
run "emu/pickup-reset-applied-sdk" node audit-tools/emu/pickup-reset-applied-sdk-test.js
run "emu/import-native-I100-cookie-unsigned" node audit-tools/emu/import-paired-ci-runner.js --case=I100-cookie-unsigned --provider=native
run "emu/import-native-I100-cookie-signed" node audit-tools/emu/import-paired-ci-runner.js --case=I100-cookie-signed --provider=native
run "emu/import-native-I100-cookie-mixed" node audit-tools/emu/import-paired-ci-runner.js --case=I100-cookie-mixed --provider=native
run "emu/import-native-I100-cookie-mixed-same-group" node audit-tools/emu/import-paired-ci-runner.js --case=I100-cookie-mixed-same-group --provider=native
run "emu/import-native-I100-palm-unsigned" node audit-tools/emu/import-paired-ci-runner.js --case=I100-palm-unsigned --provider=native
run "emu/import-native-I100-palm-signed" node audit-tools/emu/import-paired-ci-runner.js --case=I100-palm-signed --provider=native
run "emu/import-native-I100-palm-mixed" node audit-tools/emu/import-paired-ci-runner.js --case=I100-palm-mixed --provider=native
run "emu/import-native-I100-palm-mixed-same-group" node audit-tools/emu/import-paired-ci-runner.js --case=I100-palm-mixed-same-group --provider=native
run "import-paired-ci-runner-test" node audit-tools/import-paired-ci-runner-test.js
run "emu/supabase-adapter-parity" node audit-tools/emu/supabase-adapter-parity-test.js
# ⛔ «សំណុំបៃតង» មិនមែនភស្តុតាង — ឧបករណ៍នេះបំបែកតក្កវិជ្ជាលុយដោយចេតនា
# រួចទាមទារថា **អ្នកយាមយ៉ាងតិច ១ ត្រូវក្រហម**។ បើអ្នកយាមចុងក្រោយងងឹត
# វាធ្លាក់ **មុន** កំហុសលុយបន្ទាប់ ship។
run "money-guardian 1/6" node audit-tools/money-guardian-test.js --part=1/6
run "money-guardian 2/6" node audit-tools/money-guardian-test.js --part=2/6
run "money-guardian 3/6" node audit-tools/money-guardian-test.js --part=3/6
run "money-guardian 4/6" node audit-tools/money-guardian-test.js --part=4/6
run "money-guardian 5/6" node audit-tools/money-guardian-test.js --part=5/6
run "money-guardian 6/6" node audit-tools/money-guardian-test.js --part=6/6
run "money-reality" node audit-tools/money-reality-test.js
run "repository-file-coverage" node audit-tools/repository-file-coverage.js
run "module-runtime-scope" node audit-tools/module-runtime-scope-test.js
run "repository-contract" node audit-tools/repository-contract-test.js
run "security-guard (repo public · bundle ផលិតកម្ម · APK)" node audit-tools/security-guard-test.js
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
run "tx-outcome" node audit-tools/tx-outcome-test.js
run "ledger-clamp-symmetry (browser ពិត)" node audit-tools/ledger-clamp-symmetry-test.js
run "monthly-ledger-agreement" node audit-tools/monthly-ledger-agreement-test.js
run "stats-screen-agreement" node audit-tools/stats-screen-agreement-test.js
run "stats-measurable-gate" node audit-tools/stats-measurable-gate-test.js
run "collected-value-fuzz" node audit-tools/collected-value-fuzz-test.js
run "empty-state-truth" node audit-tools/empty-state-truth-test.js
run "daily-collected" node audit-tools/daily-collected-test.js
run "collected-mirror-lifecycle" node audit-tools/collected-mirror-lifecycle-test.js
run "collected-mirror-fuzz" node audit-tools/collected-mirror-fuzz-test.js
run "loop-termination" node audit-tools/loop-termination-test.js
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
run "sw-client-wiring (browser ពិត)" node audit-tools/sw-client-wiring-test.js
run "sentry-load-race (browser ពិត)" node audit-tools/sentry-load-race-test.js
run "sw-shell-latency (browser ពិត)" node audit-tools/sw-shell-latency-test.js
run "sw-backend-chunk (browser ពិត)" node audit-tools/sw-backend-chunk-test.js
run "network-pressure (browser ពិត)" node audit-tools/network-pressure-test.js
run "license-net-pressure (browser ពិត)" node audit-tools/license-network-pressure-test.js
run "sw-revalidate-pressure (browser ពិត)" node audit-tools/sw-revalidate-pressure-test.js
run "boot-animation (browser ពិត)" node audit-tools/boot-animation-test.js
run "inline-handler-xss (browser ពិត)" node audit-tools/inline-handler-xss-test.js
run "csp-enforced (browser ពិត)" node audit-tools/csp-enforced-test.js
run "fluid-type-focus (browser ពិត)" node audit-tools/fluid-type-focus-test.js
run "keygen-modal-scroll (browser ពិត)" node audit-tools/keygen-modal-scroll-test.js
run "modal-keyboard 1/3 (browser ពិត ៖ ទូរស័ព្ទ ៤ ទំហំ)" node audit-tools/modal-keyboard-test.js --part=1/3
run "modal-keyboard 2/3 (browser ពិត ៖ ទូរស័ព្ទផ្តេក · iPad)" node audit-tools/modal-keyboard-test.js --part=2/3
run "modal-keyboard 3/3 (browser ពិត ៖ រំកិល · APK · ចុច · toast · សុវត្ថិភាព)" node audit-tools/modal-keyboard-test.js --part=3/3
run "modal-keyboard-device 1/4 (browser ពិត · Android APK/PWA · iPhone · iPad ៖ ប្រអប់)" node audit-tools/modal-keyboard-device-test.js --part=1/4
run "modal-keyboard-device 2/4 (browser ពិត · keyboard លេខ · ចុចកន្លែងវាយ Barcode · ម៉ាស៊ីនស្កេន · zoom)" node audit-tools/modal-keyboard-device-test.js --part=2/4
run "modal-keyboard-device 3/4 (browser ពិត · ប្រអប់រអិលតាម keyboard ៖ ស៊ុមម្តងៗ)" node audit-tools/modal-keyboard-device-test.js --part=3/4
run "modal-keyboard-device 4/4 (browser ពិត · iPhone ៖ ចុច + keyboard លោតហួស ➜ រអិលតែម្តង · ∨/∧ មិនរំកិលទំព័រ · keyboard លោត ➜ មិនទាញ document · ស្កេនដក ➜ លើក #appPages)" node audit-tools/modal-keyboard-device-test.js --part=4/4
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
run "zoew-suite 1/5 (ZoeW React ៖ tsc · lint · vitest 1/4 · android)" node audit-tools/zoew-suite-test.js --part=1/5
run "zoew-suite 2/5 (ZoeW React ៖ build · sw · smoke · native · rules)" node audit-tools/zoew-suite-test.js --part=2/5
run "zoew-suite 3/5 (ZoeW React ៖ vitest 2/4)" node audit-tools/zoew-suite-test.js --part=3/5
run "zoew-suite 4/5 (ZoeW React ៖ vitest 3/4)" node audit-tools/zoew-suite-test.js --part=4/5
run "zoew-suite 5/5 (ZoeW React ៖ vitest 4/4)" node audit-tools/zoew-suite-test.js --part=5/5

section "== ខ្សែសង្វាក់នាំចូល (zto-import) =="
# ⚠️ វាធ្លាប់នៅ **ក្រៅ** ឯកសារនេះ ដោយហេតុផលថា «មិនមែនជាផ្នែករបស់ App»។
# ការទុកវាក្រៅមានន័យថា assertion ៥០ រត់តែពេលមាននរណាម្នាក់ចាំវាយដោយដៃ។
# ⛔ ចំណាំ ៖ `zto-import` ជាខាង **server** នៃមុខងារ «នាំចូល Excel ទៅ Sheet»
# ដែលរស់នៅក្នុង ZoeW តាំងពីកំណែ 2.21.0 (App `ZoeImport` ត្រូវលុបចេញហើយ) ➜
# វាកាន់តែសំខាន់ជាងមុន។ ខាង client ចាក់សោដោយ `sheet-import-test.js`។
run "audit-tools/zto-import/test.js" node audit-tools/zto-import/test.js

section "== Supabase (Project តែមួយ ៖ tenant · RLS · ឃ្លាំងទិន្នន័យ · Edge Functions) =="
# ⛔ Postgres ពិត (major ពី supabase/config.toml) + supabase-js ពិត ➜ `npm ci --prefix supabase`
#    គ្មាន dependency ➜ SKIP/PARTIAL · `SUPABASE_STRICT=1` ➜ FAIL (ដូច emu/*)
#    ភាពដូច RTDB នៃ rules ៖ `emu/supabase-rules-parity` (RTDB emulator ជា oracle) ក្នុងផ្នែក emulator ខាងលើ
run "supabase-rls (Postgres ពិត)" node audit-tools/supabase-rls-test.js
run "supabase-datastore (Postgres ពិត)" node audit-tools/supabase-datastore-test.js
run "supabase-scan-rules (Postgres ពិត)" node audit-tools/supabase-scan-rules-test.js
run "supabase-functions" node audit-tools/supabase-functions-test.js
run "keygen-supabase-admin (Postgres ពិត)" node audit-tools/keygen-supabase-admin-test.js
run "supabase-data-tools (backup ហាង · CLI ផ្ទេរ · Postgres ពិត)" node audit-tools/supabase-data-tools-test.js
run "supabase-docs-cache (IndexedDB ពិត · ថ្នេរ adapter)" node audit-tools/supabase-docs-cache-test.js
run "supabase-app-network-e2e (App ពិត · adapter · Postgres ពិត · បណ្តាញខូច)" node audit-tools/supabase-app-network-e2e-test.js
run "supabase-money-multishop (ហាងច្រើន × ឧបករណ៍ ៣ · App ពិត · Postgres ពិត · លុយស្របគ្នា)" node audit-tools/supabase-money-multishop-test.js

section "== ឧបករណ៍បង្កើតអតិថិជនថ្មី (tools/firebase-provision) =="
# ⛔ CLI ពិត + firebase-tools ពិត (កំណែ pin) ទល់ Google ក្លែងលើ HTTPS ➜ `npm ci --prefix tools/firebase-provision` + openssl
#    គ្មាន dependency ➜ SKIP · `FBPROVISION_STRICT=1` ➜ FAIL (ដូច emu/*)
run "firebase-provision (CLI + firebase-tools ពិត · mutation)" node audit-tools/firebase-provision-test.js

section "== ទម្លាប់គម្រោង =="
run "node syntax ៖ ZoeW module view · ZoeKeyGen/app.js" node -e 'const fs=require("fs"),vm=require("vm"),{auditModuleSources}=require("./audit-tools/react-view"); for(const a of ["ZoeW","ZoeKeyGen"]){const source=fs.readFileSync(a+"/app.js","utf8");for(const part of auditModuleSources(a,source))new vm.Script(part,{filename:a+"/app.js"});} console.log("  ok    syntax ត្រឹមត្រូវទាំង ២"); process.exitCode=0;'
run "rules JSON valid" node -e "const fs=require('fs');JSON.parse(fs.readFileSync('firebase-database.rules.json','utf8'));JSON.parse(fs.readFileSync('ZoeKeyGen/firebase-database.rules.json','utf8'));console.log('  ok    rules JSON ត្រឹមត្រូវទាំង ២');process.exitCode=0;"
run "license-verify.js byte-identical ×2" bash -c 'cmp -s ZoeW/license-verify.js ZoeKeyGen/license-verify.js && printf "  ok    license-verify.js ដូចគ្នាទាំង ២\n"'
run "error-reporting.js byte-identical ×2" bash -c 'cmp -s ZoeW/error-reporting.js ZoeKeyGen/error-reporting.js && printf "  ok    error-reporting.js ដូចគ្នាទាំង ២\n"'
run "គ្មាន trailing whitespace" bash -c 'grep -l "[[:space:]]$" ZoeW/app.js ZoeKeyGen/app.js; [ "$?" -eq 1 ] && printf "  ok    គ្មាន trailing whitespace\n"'

# ⛔ ត្រង់នេះ ទើបបញ្ជីខាងលើត្រូវរត់ពិត (lane ស្របគ្នា · បោះពុម្ពតាមលំដាប់ · សរសេរ RUNALL_STATE)
runall_drain || exit $?

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
    KEYGEN_MODAL_APP_DIR="$BASE" node audit-tools/keygen-modal-scroll-test.js 2>&1 | tail -1 | sed 's/^/   keygen-modal:    /'
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
    ZOEWSUITE_APP_DIR="$BASE" node audit-tools/zoew-suite-test.js 2>&1 | tail -1 | sed 's/^/   zoew-suite:      /'
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
    TXOUTCOME_APP_DIR="$BASE" node audit-tools/tx-outcome-test.js 2>&1 | tail -1 | sed 's/^/   tx-outcome:     /'
    CLAMPSYM_APP_DIR="$BASE" node audit-tools/ledger-clamp-symmetry-test.js 2>&1 | tail -1 | sed 's/^/   clamp-symmetry:  /'
    MONTHLYAGREE_APP_DIR="$BASE" node audit-tools/monthly-ledger-agreement-test.js 2>&1 | tail -1 | sed 's/^/   monthly-agree:   /'
    STATSAGREE_APP_DIR="$BASE" node audit-tools/stats-screen-agreement-test.js 2>&1 | tail -1 | sed 's/^/   stats-agree:     /'
    STATSGATE_APP_DIR="$BASE" node audit-tools/stats-measurable-gate-test.js 2>&1 | tail -1 | sed 's/^/   stats-gate:      /'
    COLLECTFUZZ_APP_DIR="$BASE" node audit-tools/collected-value-fuzz-test.js 2>&1 | tail -1 | sed 's/^/   collect-fuzz:    /'
    EMPTYSTATE_APP_DIR="$BASE" node audit-tools/empty-state-truth-test.js 2>&1 | tail -1 | sed 's/^/   empty-state:     /'
    COLLECTED_APP_DIR="$BASE" node audit-tools/daily-collected-test.js 2>&1 | tail -1 | sed 's/^/   daily-collected: /'
    COLLECTEDMIRROR_APP_DIR="$BASE" node audit-tools/collected-mirror-lifecycle-test.js 2>&1 | tail -1 | sed 's/^/   collected-mirror: /'
    MIRRORFUZZ_APP_DIR="$BASE" node audit-tools/collected-mirror-fuzz-test.js 2>&1 | tail -1 | sed 's/^/   mirror-fuzz:     /'
    LOOPTERM_APP_DIR="$BASE" node audit-tools/loop-termination-test.js 2>&1 | tail -1 | sed 's/^/   loop-termination:/'
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
    SCANMONTHORCH_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" node audit-tools/scan-month-orchestration-test.js 2>&1 | tail -1 | sed 's/^/   scan-month-orch: /'
    SCANMONTHDATE_APP_DIR="$BASE" node audit-tools/scan-month-fixture-date-test.js 2>&1 | tail -1 | sed 's/^/   scan-month-date: /'
    LICENSETIME_APP_DIR="$BASE" node audit-tools/license-time-endpoint-test.js 2>&1 | tail -1 | sed 's/^/   license-time:    /'
    LICENSETIME_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" node audit-tools/license-time-json-test.js 2>&1 | tail -10 | sed 's/^/   license-json:    /'
    LICENSETIME_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" node audit-tools/server-time-function-test.mjs 2>&1 | tail -10 | sed 's/^/   server-function: /'
    LICENSETIME_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" node audit-tools/license-time-cors-browser-test.js 2>&1 | tail -1 | sed 's/^/   license-cors:    /'

    CLEANUPCLOCK_APP_DIR="$BASE" node audit-tools/cleanup-clock-guard-test.js 2>&1 | tail -1 | sed 's/^/   cleanup-clock:   /'
    RETURNEDTRASH_APP_DIR="$BASE" node audit-tools/returned-trash-retention-test.js 2>&1 | tail -1 | sed 's/^/   returned-trash:  /'
    MONOGATE_APP_DIR="$BASE" node audit-tools/monotonic-gate-test.js 2>&1 | tail -1 | sed 's/^/   monotonic-gate:  /'
    KHMERTZ_APP_DIR="$BASE" node audit-tools/khmer-timezone-test.js 2>&1 | tail -1 | sed 's/^/   khmer-tz:        /'
    SENTRYRACE_APP_DIR="$BASE" node audit-tools/sentry-load-race-test.js 2>&1 | tail -1 | sed 's/^/   sentry-race:     /'
    SWLATENCY_APP_DIR="$BASE" node audit-tools/sw-shell-latency-test.js 2>&1 | tail -1 | sed 's/^/   sw-shell-latency:/'
    SWBACKEND_APP_DIR="$BASE" node audit-tools/sw-backend-chunk-test.js 2>&1 | tail -1 | sed 's/^/   sw-backend-chunk:/'
    NETPRESSURE_APP_DIR="$BASE" node audit-tools/network-pressure-test.js 2>&1 | tail -1 | sed 's/^/   network-pressure:/'
    LICPRESSURE_APP_DIR="$BASE" node audit-tools/license-network-pressure-test.js 2>&1 | tail -1 | sed 's/^/   license-pressure:/'
    ADAPTIVE_APP_DIR="$BASE" node audit-tools/adaptive-link-test.js 2>&1 | tail -1 | sed 's/^/   adaptive-link:   /'
    SWREVAL_APP_DIR="$BASE" node audit-tools/sw-revalidate-pressure-test.js 2>&1 | tail -1 | sed 's/^/   sw-revalidate:   /'
    SWFAIL_APP_DIR="$BASE"  node audit-tools/sw-cache-failure-test.js 2>&1 | tail -1 | sed 's/^/   sw-cache-failure:/'
    SWABORT_APP_DIR="$BASE" node audit-tools/sw-abort-propagation-test.js 2>&1 | tail -1 | sed 's/^/   sw-abort:        /'
    SWWIRE_APP_DIR="$BASE" node audit-tools/sw-client-wiring-test.js 2>&1 | tail -1 | sed 's/^/   sw-wiring:       /'
    PERIODICGUARD_APP_DIR="$BASE" node audit-tools/periodic-network-guard-test.js 2>&1 | tail -1 | sed 's/^/   periodic-guard:   /'
    PICKUP_APP_DIR="$BASE"  node audit-tools/pickup-ledger-test.js 2>&1 | tail -1 | sed 's/^/   pickup-ledger:   /'
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
    FBPROVISION_APP_DIR="$BASE" node audit-tools/firebase-provision-test.js 2>&1 | tail -1 | sed 's/^/   fb-provision:    /'
    CRUDFLOW_APP_DIR="$BASE" runall_owned node audit-tools/emu/crud-rules-flow.js 2>&1 | tail -1 | sed 's/^/   emu-crud-flow:   /'
    DEADLOCK_APP_DIR="$BASE" runall_owned node audit-tools/emu/restore-deadlock-test.js 2>&1 | tail -1 | sed 's/^/   emu-deadlock:    /'
    LEDGEREMU_APP_DIR="$BASE" runall_owned node audit-tools/emu/ledger-revert-emu-test.js 2>&1 | tail -1 | sed 's/^/   emu-ledger-rev:  /'
    RESTOREMUTATION_APP_DIR="$BASE" runall_owned node audit-tools/emu/restore-mutation-emu-test.js 2>&1 | tail -1 | sed 's/^/   restore-mutation:/'
    MONEYGUARD_APP_DIR="$BASE" runall_owned node audit-tools/money-guardian-test.js 2>&1 | tail -1 | sed 's/^/   money-guardian:  /'
    MONEYREALTEST_APP_DIR="$BASE" node audit-tools/money-reality-test.js 2>&1 | tail -1 | sed 's/^/   money-reality:   /'
    REPOCOVER_APP_DIR="$BASE" node audit-tools/repository-file-coverage.js 2>&1 | tail -1 | sed 's/^/   file-coverage:   /'
    MODULE_RUNTIME_SCOPE_APP_DIR="$BASE" node audit-tools/module-runtime-scope-test.js 2>&1 | tail -1 | sed 's/^/   module-runtime:  /'
    REPOCONTRACT_APP_DIR="$BASE" node audit-tools/repository-contract-test.js 2>&1 | tail -1 | sed 's/^/   repo-contract:   /'
    SECURITYGUARD_APP_DIR="$BASE" node audit-tools/security-guard-test.js 2>&1 | tail -1 | sed 's/^/   security-guard:  /'
    HANGGUARD_APP_DIR="$BASE" node audit-tools/hang-guard.js 2>&1 | tail -1 | sed 's/^/   hang-guard:      /'
    RUNALLRUNNER_APP_DIR="$BASE" node audit-tools/runall-runner-test.js 2>&1 | tail -1 | sed 's/^/   runall-runner:   /'
    EXITCODE_APP_DIR="$BASE" runall_owned node audit-tools/exit-code-integrity.js 2>&1 | tail -1 | sed 's/^/   exit-code:       /'
    TESTPLACEMENT_APP_DIR="$BASE" node audit-tools/test-placement-test.js
    VERSIONSCOPE_APP_DIR="$BASE" node audit-tools/version-bump-scope.js 2>&1 | tail -1 | sed 's/^/   version-scope:   /'
    BOOTANIM_APP_DIR="$BASE" node audit-tools/boot-animation-test.js 2>&1 | tail -1 | sed 's/^/   boot-animation:  /'
    INLINEXSS_APP_DIR="$BASE" node audit-tools/inline-handler-xss-test.js 2>&1 | tail -1 | sed 's/^/   inline-xss:      /'
    CSP_APP_DIR="$BASE" node audit-tools/csp-enforced-test.js 2>&1 | tail -1 | sed 's/^/   csp-enforced:    /'
    FLUIDTYPE_APP_DIR="$BASE" node audit-tools/fluid-type-focus-test.js 2>&1 | tail -1 | sed 's/^/   fluid-type:      /'
    MODALKB_APP_DIR="$BASE" node audit-tools/modal-keyboard-test.js 2>&1 | tail -1 | sed 's/^/   modal-keyboard:  /'
    MODALKB_DEVICE_APP_DIR="$BASE" node audit-tools/modal-keyboard-device-test.js 2>&1 | tail -1 | sed 's/^/   modalkb-device:  /'
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
    KEYGEN_APP_DIR="$BASE" node audit-tools/keygen-session-security-test.js 2>&1 | tail -1 | sed 's/^/   keygen-session:  /'
    KEYGEN_APP_DIR="$BASE" node audit-tools/keygen-notice-test.js 2>&1 | tail -1 | sed 's/^/   keygen-notice:   /'
    KEYGEN_APP_DIR="$BASE" node audit-tools/keygen-biometric-test.js 2>&1 | tail -1 | sed 's/^/   keygen-bio:      /'
    KEYLIST_APP_DIR="$BASE" node audit-tools/keylist-consistency-test.js 2>&1 | tail -1 | sed 's/^/   keylist-consistency:/'
    LICGRACE_APP_DIR="$BASE" node audit-tools/license-grace-test.js 2>&1 | tail -1 | sed 's/^/   license-grace:   /'
    LICROLLBACK_APP_DIR="$BASE" node audit-tools/license-clock-rollback-test.js 2>&1 | tail -1 | sed 's/^/   license-rollback:/'
    LICRACE_APP_DIR="$BASE" node audit-tools/license-record-race-test.js 2>&1 | tail -1 | sed 's/^/   license-race:    /'
    LICSEAT_APP_DIR="$BASE" node audit-tools/license-seat-test.js 2>&1 | tail -1 | sed 's/^/   license-seat:    /'
    LICSEATEMU_APP_DIR="$BASE" runall_owned node audit-tools/emu/license-seat-rules-test.js 2>&1 | tail -1 | sed 's/^/   license-seat-emu:/'
    TXEMU_APP_DIR="$BASE" runall_owned node audit-tools/emu/tx-disconnect-emu-test.js 2>&1 | tail -1 | sed 's/^/   tx-disconnect-emu:/'
    APPWRITES_APP_DIR="$BASE" runall_owned node audit-tools/emu/app-writes-rules-test.js 2>&1 | tail -1 | sed 's/^/   app-writes-emu:  /'
    NETE2E_APP_DIR="$BASE" runall_owned node audit-tools/emu/app-network-e2e-test.js 2>&1 | tail -1 | sed 's/^/   app-network-e2e: /'
    MONEYTRUTH_APP_DIR="$BASE" runall_owned node audit-tools/money-checker-truthfulness-test.js 2>&1 | tail -1 | sed 's/^/   money-truth:     /'
    MONEYMD_APP_DIR="$BASE" runall_owned node audit-tools/emu/money-multidevice-emu-test.js 2>&1 | tail -1 | sed 's/^/   money-multidev:  /'
    SBPARITY_APP_DIR="$BASE" runall_owned node audit-tools/emu/supabase-rules-parity-test.js 2>&1 | tail -1 | sed 's/^/   sb-rules-parity: /'
    SCANRULES_APP_DIR="$BASE" runall_owned node audit-tools/emu/scan-operation-rules-test.js 2>&1 | tail -1 | sed 's/^/   scan-rules:     /'
    # ⛔ checker SDK ទាំងនេះ build `ZoeW/src` ➜ ចង្អុលទៅប្រភព baseline (root វាស់ `$BASE` គ្មាន `ZoeW/src`)
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/scan-operation-sdk-test.js 2>&1 | tail -1 | sed 's/^/   scan-sdk:        /'
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/scan-operation-sdk-test.js --month-wire=delay 2>&1 | tail -1 | sed 's/^/   scan-month-delay: /'
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/scan-operation-sdk-test.js --month-wire=reconnect 2>&1 | tail -1 | sed 's/^/   scan-month-reconnect: /'
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/scan-month-coordination-sdk-test.js 2>&1 | tail -1 | sed 's/^/   scan-month-coord: /'
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/trash-generation-sdk-test.js 2>&1 | tail -1 | sed 's/^/   trash-generation: /'
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/cleanup-consumed-sdk-test.js 2>&1 | tail -1 | sed 's/^/   cleanup-consumed: /'
    SCANSDK_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" runall_owned node audit-tools/emu/empty-delete-sdk-test.js 2>&1 | tail -1 | sed 's/^/   empty-delete:    /'
    SBADAPTER_APP_DIR="$BASE" runall_owned node audit-tools/emu/supabase-adapter-parity-test.js 2>&1 | tail -1 | sed 's/^/   sb-adapter-parity: /'
    F03_APP_DIR="$BASE" runall_owned node audit-tools/emu/registry-purge-atomic-sdk-test.js 2>&1 | tail -1 | sed 's/^/   registry-purge-sdk: /'
    PICKUPRESET_APP_DIR="$BASE" runall_owned node audit-tools/emu/pickup-reset-applied-sdk-test.js 2>&1 | tail -1 | sed 's/^/   pickup-reset-sdk: /'
    if [ -n "$IMPORTPAIRED_BASE_SOURCE" ] && [ -f "$IMPORTPAIRED_BASE_SOURCE/ZoeW/src/main.tsx" ]; then
        # BASE is a diagnostic single native profile, not eight-profile or SQL coverage.
        {
            IMPORTPAIRED_OWNER_STATE="$RUNALL_OWNED_DIR" IMPORTPAIRED_APP_DIR="$IMPORTPAIRED_BASE_SOURCE" node audit-tools/emu/import-paired-ci-runner.js --case=I100-cookie-unsigned --provider=native > "$RUNALL_OWNED_DIR/import-native-base.out" 2>&1
        } 2>/dev/null
        PAIRED_BASE_RC=$?
        if [ "$PAIRED_BASE_RC" -ne 0 ]; then
            printf '   import-native-BASE: FAIL (BASE exit %s)\n' "$PAIRED_BASE_RC"
            if [ "$PAIRED_BASE_RC" = 124 ] || [ "$PAIRED_BASE_RC" = 137 ] || ! runall_native_failure_summary "$RUNALL_OWNED_DIR/import-native-base.out" emu/import-native-I100-cookie-unsigned; then
                echo '      native outcome UNKNOWN; SQL/parity UNRUN'
            fi
        elif ! runall_native_summary "$RUNALL_OWNED_DIR/import-native-base.out" emu/import-native-I100-cookie-unsigned; then
            echo '   import-native-BASE: FAIL (invalid native result; one case, SQL UNRUN)'
            echo '      native outcome UNKNOWN; SQL/parity UNRUN'
        fi
    else
        echo '   import-native-BASE: FAIL (BASE source unavailable; SQL UNRUN)'
    fi
    SUPABASE_APP_DIR="$BASE" node audit-tools/supabase-rls-test.js 2>&1 | tail -1 | sed 's/^/   supabase-rls:    /'
    if runall_owned_init 2>/dev/null; then
        {
            IMPORTPAIRED_RUNNER_TEST_APP_DIR="$BASE" node audit-tools/import-paired-ci-runner-test.js > "$RUNALL_OWNED_DIR/import-paired-runner-base.out" 2>&1
        } 2>/dev/null
        PAIRED_RUNNER_BASE_RC=$?
        PAIRED_RUNNER_OUTPUT_RC=1
        if [ "$PAIRED_RUNNER_BASE_RC" -eq 0 ]; then
            node -e '
              const fs=require("fs");
              try {
                const file=process.argv[1], st=fs.statSync(file);
                if (!st.isFile() || st.size > 65536) throw Error("invalid summary file");
                const expected=[
                  {status:"PASS",nativeOnlySynthetic:25,scope:"fake owner and private evidence, no backend"},
                  {status:"PASS",cases:60,mutants:4,scope:"actual owned wrapper with fake process/HTTP adapters; no backend, network or real signals; synthetic files retained"},
                  {status:"PASS",cases:48,scope:"synthetic runner and actual owner/CLI entry with fake adapters; no backend, network or real process signals"}
                ].map(x=>JSON.stringify(x)).join("\n")+"\n";
                if (fs.readFileSync(file,"utf8")!==expected) process.exitCode=1;
              } catch (_) { process.exitCode=1; }
            ' "$RUNALL_OWNED_DIR/import-paired-runner-base.out" > /dev/null 2>&1
            PAIRED_RUNNER_OUTPUT_RC=$?
        fi
        if [ "$PAIRED_RUNNER_BASE_RC" -eq 0 ] && [ "$PAIRED_RUNNER_OUTPUT_RC" -eq 0 ]; then
            echo '   import-paired-runner-test: PASS'
        else
            printf '   import-paired-runner-test: FAIL (BASE exit %s)\n' "$PAIRED_RUNNER_BASE_RC"
        fi
    else
        echo '   import-paired-runner-test: FAIL (private output unavailable)'
    fi
    SUPABASE_DS_APP_DIR="$BASE" node audit-tools/supabase-datastore-test.js 2>&1 | tail -1 | sed 's/^/   supabase-ds:     /'
    SBSCAN_APP_DIR="$BASE" runall_owned node audit-tools/supabase-scan-rules-test.js 2>&1 | tail -1 | sed 's/^/   sb-scan-rules:   /'
    SUPABASE_FN_APP_DIR="$BASE" node audit-tools/supabase-functions-test.js 2>&1 | tail -1 | sed 's/^/   supabase-fn:     /'
    KEYGEN_SBADMIN_APP_DIR="$BASE" node audit-tools/keygen-supabase-admin-test.js 2>&1 | tail -1 | sed 's/^/   keygen-sbadmin:  /'
    SBDATA_APP_DIR="$BASE" node audit-tools/supabase-data-tools-test.js 2>&1 | tail -1 | sed 's/^/   supabase-data:   /'
    DOCSCACHE_APP_DIR="$BASE" node audit-tools/supabase-docs-cache-test.js 2>&1 | tail -1 | sed 's/^/   sb-docs-cache:   /'
    SBNETE2E_APP_DIR="$BASE" node audit-tools/supabase-app-network-e2e-test.js 2>&1 | tail -1 | sed 's/^/   sb-app-network:  /'
    SBMONEY_APP_DIR="$BASE" node audit-tools/supabase-money-multishop-test.js 2>&1 | tail -1 | sed 's/^/   sb-money-multishop:/'
    LOOKUPSEC_APP_DIR="$BASE" node audit-tools/lookup-config-secret-test.js 2>&1 | tail -1 | sed 's/^/   lookup-config-secret:/'
    PAYLOAD_APP_DIR="$BASE" node audit-tools/payload-schema.js 2>&1 | tail -1 | sed 's/^/   payload-schema:  /'
    PHONE_APP_DIR="$BASE" node audit-tools/phone-suggest-test.js 2>&1 | tail -1 | sed 's/^/   phone-suggest:   /'
    RESTOREFENCE_APP_DIR="$BASE" node audit-tools/restore-finalization-fence-test.js 2>&1 | tail -1 | sed 's/^/   restore-finalization-fence:/'
    RESTORERACE_APP_DIR="$BASE" node audit-tools/restore-race-test.js 2>&1 | tail -1 | sed 's/^/   restore-race:    /'
    FUZZ_APP_DIR="$BASE" node audit-tools/revenue-fuzz-test.js 2>&1 | tail -1 | sed 's/^/   revenue-fuzz:    /'
    RULESDUP_APP_DIR="$BASE" node audit-tools/rules-duplicate-keys.js 2>&1 | tail -1 | sed 's/^/   rules-duplicate-keys:/'
    APPCODE_APP_DIR="$BASE" node audit-tools/license-app-code-test.js 2>&1 | tail -1 | sed 's/^/   license-app-code:/'
    CONNFUZZ_APP_DIR="$BASE" node audit-tools/connection-state-fuzz-test.js 2>&1 | tail -1 | sed 's/^/   connection-state-fuzz:/'
    LEDGERCOUNT_APP_DIR="$BASE" node audit-tools/ledger-count-integrity-test.js 2>&1 | tail -1 | sed 's/^/   ledger-count-integrity:/'
    CLEANUPATOMIC_APP_DIR="$BASE" node audit-tools/cleanup-interrupt-atomicity-test.js 2>&1 | tail -1 | sed 's/^/   cleanup-interrupt-atomicity:/'
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
    ACTIONBIND_APP_DIR="$BASE" node audit-tools/action-binding-test.js 2>&1 | tail -1 | sed 's/^/   action-binding:  /'
    FNSURFACE_APP_DIR="$BASE" node audit-tools/function-surface-test.js 2>&1 | tail -1 | sed 's/^/   function-surface: /'
    DUPCODE_APP_DIR="$BASE" node audit-tools/code-duplication-test.js 2>&1 | tail -1 | sed 's/^/   code-duplication: /'
    SHEETIMPORT_APP_DIR="$BASE" node audit-tools/sheet-import-test.js 2>&1 | tail -1 | sed 's/^/   sheet-import:    /'
    ZTO_IMPORT_APP_DIR="$BASE/zto-import" node audit-tools/zto-import/test.js 2>&1 | tail -1 | sed 's/^/   zto-import:      /'
    APPLOCK_APP_DIR="$BASE" node audit-tools/app-lock-test.js 2>&1 | tail -1 | sed 's/^/   app-lock:        /'
    LEAK_APP_DIR="$BASE" node audit-tools/listener-leak-test.js 2>&1 | tail -1 | sed 's/^/   listener-leak:   /'
    STALLGUARD_APP_DIR="$BASE" node audit-tools/stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   stall-guard:     /'
    STORAGEBOOT_APP_DIR="$BASE" node audit-tools/storage-blocked-boot-test.js 2>&1 | tail -1 | sed 's/^/   storage-boot:    /'
    DBSTALL_APP_DIR="$BASE" node audit-tools/db-stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   db-stall-guard:  /'
fi

runall_summary
runall_exit_status
RUNALL_RESULT=$?
if ! runall_cleanup_owned; then [ "$RUNALL_RESULT" -ne 0 ] || RUNALL_RESULT=1; fi
exit "$RUNALL_RESULT"
