#!/usr/bin/env bash
# រត់ការត្រួតពិនិត្យ audit ទាំងអស់ដោយមិនចាំបាច់ប្រើ AI ។
#   bash audit-tools/run-all.sh
# ប្រៀបធៀបនឹង tree ផ្សេង (ឧ. មុនកែ) ដើម្បីបញ្ជាក់ថាតេស្តមិនទទេ៖
#   bash audit-tools/run-all.sh /path/to/baseline
# ការរត់ស្របគ្នា · state ដែលបន្តបាន (ពន្យល់ពេញក្នុង audit-tools/README.md ផ្នែក «run-all.sh») ៖
#   RUNALL_JOBS=N          lane ស្របគ្នា (លំនាំដើម = ចំនួន CPU ក្នុងព្រំដែន 2–6 · 1 = ជាជួរ)
#   RUNALL_BROWSER_JOBS=N  checker browser ស្របគ្នាអតិបរមា
#   RUNALL_STATE=<ផ្លូវ>   ឯកសារលទ្ធផល (លំនាំដើម <git-dir>/zoe-runall-state.tsv · ទទេ = បិទ)
#   RUNALL_RESUME=1        រត់តែ checker ដែលធ្លាក់ ឬមិនទាន់មានលទ្ធផល លើ tree ដដែល
#   RUNALL_ONLY=a,b        រត់តែ checker ដែលមានឈ្មោះ (ស្លាក ឬ audit-tools/<ឈ្មោះ>.js)
RUNALL_CALLER_PWD="$PWD"
cd "$(dirname "$0")/.." || exit 1
BASE="$1"

# ── ZoeW React ៖ checker វាស់ «root វាស់» មិនមែនប្រភព ─────────────────────────
# ZoeW ជា React (`ZoeW/src/**` ➜ Vite)។ checker ស្រង់ function ពី `ZoeW/app.js` · អាន markup ពី
# `ZoeW/index.html` · បើក App ក្នុង browser ➜ ទាំងនោះរស់នៅ **build វាស់** (`ZoeW/scripts/build-audit.mjs`
# ➜ `ZoeW/dist-audit/ZoeW` ៖ ទិដ្ឋភាពអត្ថបទនៃ src ពិត + bundle Vite ពិត + prerender)។ ដូច្នេះ run-all ៖
#   ១. build វាស់ពីប្រភពពិត (ធ្លាក់ ➜ FAIL មិនមែនវាស់ build ចាស់)
#   ២. ផ្គុំ root វាស់ ៖ ឯកសារ repo ទាំងអស់ លើកលែង ZoeW/ ដែលជំនួសដោយ build វាស់
#   ៣. រត់ខ្លួនឯងឡើងវិញក្នុង root នោះ ➜ checker ទាំងអស់ (និង checker-coverage) ឃើញ tree តែមួយ
# ⛔ checker ដែលវាស់ **repo** (git · ប្រភព) ចង្អុលទៅ repo ពិតតាម env ខាងក្រោម។
# ⛔ `$BASE` (tree មុនកែ) ដែលជា React ក៏ត្រូវ build វាស់ដែរ; tree vanilla រត់ត្រង់ៗដូចមុន។
zoe_measure_root() {  # <src root> <dst> <copy-mode: git|tar>
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
}
# hash របស់ tree សម្រាប់ RUNALL_STATE/RUNALL_RESUME ៖ មាតិកាឯកសារដែល git ឃើញ (tracked + untracked មិន ignore)
# · rules ចម្លងរបស់ emulator · ទង់ *_STRICT ។ ⛔ ទង់ STRICT ប្តូរសាលក្រម (SKIP ➜ FAIL) ➜ ការរត់ដោយទង់ខុសគ្នា
# មិនមែន «tree ដដែល» ទេ។ tree គ្មាន git (root វាស់ · git archive) ➜ ដើរថតពិត។
runall_tree_hash() {  # <root>
    (
        cd "$1" || exit 1
        if [ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ]; then
            git ls-files -z --cached --others --exclude-standard
        else
            find . \( -name node_modules -o -name .git -o -name dist-audit \) -prune -o -type f -print0 | sed -z 's|^\./||'
        fi | LC_ALL=C sort -zu | xargs -0r sha1sum 2>/dev/null
        [ -f audit-tools/emu/real.rules.json ] && sha1sum audit-tools/emu/real.rules.json
        env | grep -E '^[A-Z0-9_]+_STRICT=' | LC_ALL=C sort
    ) | sha1sum | cut -c1-16
}
zoe_build_audit() {  # <src root>
    local log
    [ -e "$1/ZoeW/node_modules" ] || ln -s "$ZOE_NODE_MODULES" "$1/ZoeW/node_modules"
    if ! log=$( (cd "$1/ZoeW" && node scripts/build-audit.mjs) 2>&1 ); then
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
    echo "== ZoeW React ៖ build វាស់ពីប្រភពពិត (ZoeW/dist-audit) =="
    zoe_build_audit "$REPO" || exit 1
    MEASURE="$REPO/ZoeW/dist-audit/measure-root"
    zoe_measure_root "$REPO" "$MEASURE" git || { echo "*** FAIL *** ផ្គុំ root វាស់មិនបាន"; exit 1; }
    BASE_MEASURE=""
    if [ "${BASE:+set}" = set ] && [ -d "$BASE" ]; then
        BASE="$(cd "$BASE" && pwd)"
        if [ -f "$BASE/ZoeW/src/main.tsx" ] && [ ! -f "$BASE/ZoeW/app.js" ]; then
            zoe_build_audit "$BASE" || exit 1
            BASE_MEASURE="$BASE/ZoeW/dist-audit/measure-root"
            zoe_measure_root "$BASE" "$BASE_MEASURE" tar || { echo "*** FAIL *** ផ្គុំ root វាស់របស់ baseline មិនបាន"; exit 1; }
        else
            BASE_MEASURE="$BASE"
        fi
    fi
    echo "   root វាស់ ៖ $MEASURE"
    # state ៖ លំនាំដើមរស់ក្នុង git-dir (មិនដែល commit · build វាស់មិនលុប) · ផ្លូវទាក់ទងគិតពី cwd របស់អ្នកហៅ
    # ⛔ hash គណនាលើ **repo** មិនមែន root វាស់ ៖ zoew-suite · version-bump-scope វាស់ repo ដោយផ្ទាល់
    if [ -z "${RUNALL_STATE+set}" ]; then
        RUNALL_STATE="$(git rev-parse --absolute-git-dir 2>/dev/null)"
        if [ -n "$RUNALL_STATE" ]; then RUNALL_STATE="$RUNALL_STATE/zoe-runall-state.tsv"
        else RUNALL_STATE="${TMPDIR:-/tmp}/zoe-runall-state-$(printf '%s' "$REPO" | cksum | cut -d' ' -f1).tsv"; fi
    fi
    case "$RUNALL_STATE" in /*|'') ;; *) RUNALL_STATE="$RUNALL_CALLER_PWD/$RUNALL_STATE" ;; esac
    [ -n "$RUNALL_STATE" ] && RUNALL_TREE_HASH="$(runall_tree_hash "$REPO")"
    export RUNALL_STATE RUNALL_TREE_HASH
    # ⛔ `ZOE_MEASURE_ONLY=1` ៖ ផ្គុំ root វាស់ហើយឈប់ (បន្ទាត់ចុងក្រោយ = ផ្លូវ) ➜ job ដែលរត់ checker
    #    ជាក់លាក់ (ឧ. `emu/*` ក្នុង `.github/workflows/audit.yml`) វាស់ tree ដដែលនឹង run-all
    if [ "$ZOE_MEASURE_ONLY" = 1 ]; then printf '%s\n' "$MEASURE"; exit 0; fi
    export ZOE_MEASURE_ROOT="$MEASURE" ZOE_REPO_ROOT="$REPO" NODE_PATH="$ZOE_NODE_MODULES"
    # checker កម្រិត repo ៖ git · ប្រភព React
    export ZOEWSUITE_APP_DIR="${ZOEWSUITE_APP_DIR:-$REPO}" REPOCOVER_APP_DIR="${REPOCOVER_APP_DIR:-$REPO}" \
        VERSIONSCOPE_GIT_DIR="${VERSIONSCOPE_GIT_DIR:-$REPO}"
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
CHECKER_TIMEOUT="${CHECKER_TIMEOUT:-300}"
if command -v timeout >/dev/null 2>&1; then
    HAS_TIMEOUT=1
else
    HAS_TIMEOUT=0
    echo "⚠️  គ្មាន \`timeout\` — checker ដែលព្យួរនឹងព្យួររហូត"
fi

#@runner-begin
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
    if declare -F runall_tree_hash >/dev/null; then RUNALL_TREE_HASH="$(runall_tree_hash .)"
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

# ⛔ lane ដេរីវេពីឯកសារ checker ពិត លើកលែង ២ ក្រុមដែលមានហេតុផល (runall-runner-test ផ្ទៀងវាទល់នឹងប្រភព) ៖
#   excl    ៖ រត់ម្នាក់ឯង (គ្មាន checker ផ្សេងរត់ជាមួយ) ៖ checker-coverage · exit-code-integrity **សរសេរ ហើយបោស**
#             ឯកសារស្រមោល `.tmp-poison-*` ក្នុង audit-tools/ (ការបោសរបស់មួយ លុបស្រមោលដែលមួយទៀតកំពុងរត់)
#             ហើយ fan out ខាងក្នុងរួចស្រាប់ (probe ស្របគ្នា · ការរត់ checker ពុលរួម emu/* លើ emulator ដដែល)
#   emu     ៖ ម្តងមួយ ៖ RTDB emulator តែមួយ (127.0.0.1:9000) · money-guardian រត់អ្នកយាម emu/* ខាងក្នុង
#   browser ៖ ប្រភពមាន `chromium.launch(` ➜ ពិដាន RUNALL_BROWSER_JOBS
#   any     ៖ ផ្សេងៗ (ពិដានរួម RUNALL_JOBS អនុវត្តលើគ្រប់ lane)
runall_script_of() {
    local a
    for a in "$@"; do case "$a" in audit-tools/*.js|zto-import/*.js) printf '%s' "$a"; return ;; esac; done
}
runall_lane() {
    local s; s="$(runall_script_of "$@")"
    case "$s" in
        audit-tools/checker-coverage.js|audit-tools/exit-code-integrity.js) printf excl ;;
        audit-tools/emu/*|audit-tools/money-guardian-test.js) printf emu ;;
        *) if [ -n "$s" ] && grep -q 'chromium\.launch(' "$s" 2>/dev/null; then printf browser; else printf any; fi ;;
    esac
}

J_KIND=(); J_LABEL=(); J_CMD=(); J_LANE=(); J_ID=()
J_ST=(); J_V=(); J_TEXT=(); J_MS=(); J_SHOW=(); J_SPID=()
declare -A RS_V=() RS_TEXT=() RS_MS=()
runall_add() { J_KIND+=("$1"); J_LABEL+=("$2"); J_CMD+=("$3"); J_LANE+=("$4"); J_ID+=("$5"); }
section() { runall_add hdr "$1" '' '' ''; }
skipm() { runall_add skip "$1" '' '' ''; }
run() {
    local label="$1"; shift
    local s; s="$(runall_script_of "$@")"
    s="${s#audit-tools/}"
    runall_add job "$label" "$(printf '%q ' "$@")" "$(runall_lane "$@")" "${s%.js}"
}

runall_exec() {  # <i> — រត់ក្នុង subshell ៖ output ➜ <i>.out · pid ➜ <i>.pid · «rc ms» ➜ <i>.rc (atomic)
    local i="$1" rc=0 t0 pid
    eval "set -- ${J_CMD[$i]}"
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
    [ -f "$RUNALL_DIR/$i.rc" ] && read -r rc ms < "$RUNALL_DIR/$i.rc"
    out="$(cat "$RUNALL_DIR/$i.out" 2>/dev/null)"
    J_MS[$i]="$ms"; J_SHOW[$i]=0; J_ST[$i]=done
    if [ -z "$rc" ]; then
        J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL *** (ម៉ាស៊ីនរត់ ៖ checker ស្លាប់ដោយគ្មានលទ្ធផល)"; J_SHOW[$i]=1
    elif [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
        J_V[$i]=FAIL; J_TEXT[$i]="*** FAIL *** (ព្យួរ — លើសពិដាន ${CHECKER_TIMEOUT}s)"; J_SHOW[$i]=1
    elif [ "$rc" -eq 0 ]; then
        n=$(printf '%s\n' "$out" | grep -cE 'ok    ')
        skip_line=$(printf '%s\n' "$out" | grep -m1 '^SKIP' || true)
        if [ -n "$skip_line" ]; then
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
    if [ "$resume" = 1 ]; then
        if [ -z "$RUNALL_STATE" ]; then echo "*** FAIL *** RUNALL_RESUME=1 តែ RUNALL_STATE ទទេ (បិទ)"; return 2; fi
        if ! runall_state_read; then
            echo "*** FAIL *** RUNALL_RESUME=1 ៖ គ្មាន state ($RUNALL_STATE) ➜ រត់ម្តងដោយគ្មាន RUNALL_RESUME"
            return 2
        fi
        if [ "$RS_HASHES" != "$RUNALL_TREE_HASH" ]; then
            echo "*** FAIL *** RUNALL_RESUME=1 បដិសេធ ៖ state ជារបស់ tree ${RS_HASHES:-?} តែ tree ឥឡូវជា $RUNALL_TREE_HASH"
            echo "      (កូដ · ឯកសារ · ឬទង់ *_STRICT ប្រែ ➜ លទ្ធផលចាស់មិនមែនភស្តុតាងរបស់ tree នេះ ➜ រត់ពេញម្តងទៀត)"
            return 2
        fi
        append=1
    else
        runall_state_read
        [ -n "${RUNALL_ONLY:-}" ] && [ "$RS_HASHES" = "$RUNALL_TREE_HASH" ] && append=1
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
        if [ -n "${RUNALL_ONLY:-}" ] && [ -z "${RUNALL_WANT[$i]:-}" ]; then
            J_ST[$i]=off
            [ "$resume" = 1 ] && [ -n "${RS_V[$label]:-}" ] && J_ST[$i]=carried
        elif [ "$resume" = 1 ] && case "${RS_V[$label]:-}" in PASS|PARTIAL|SKIPPED) true ;; *) false ;; esac; then
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

# ⛔ ពេលប្រហែល (វិ.) របស់ checker យឺតជាងគេ ៖ ប្រើតែពេល state គ្មានពេលរបស់វា (session ថ្មីចាប់ផ្តើមពី clone ស្អាត ➜ គ្មាន
#    `<git-dir>/zoe-runall-state.tsv`)។ ប៉ះតែ **លំដាប់រត់** (យូរ ➜ មុន ➜ កន្ទុយខ្លី) មិនដែលប៉ះសាលក្រម ➜ លេខចាស់ = យឺតជាងបន្តិច
#    មិនខុស។ ឈ្មោះ = id ឯកសារ (audit-tools/<id>.js) · runall-runner-test ផ្ទៀងថាគ្មានឈ្មោះខ្មោច។ វាស់ ៖ ការរត់ជាជួរ 2026-09-28។
RUNALL_HINTS="money-guardian-test:165 zoew-suite-test:130 revenue-fuzz-test:125 app-lock-test:100 ui-flow-test:95
    collected-mirror-fuzz-test:50 write-stall-guard-test:40 gesture-test:35 fluid-type-focus-test:32 layout-check:30
    sheet-import-test:30 cleanup-interrupt-atomicity-test:24 ledger-clamp-symmetry-test:24 late-commit-test:20 ios-panel-glide-test:20"
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
            [ -z "$hint" ] && [ -n "${J_ID[$i]}" ] && hint="${hints[${J_ID[$i]}]:-}"
            if [ -z "$hint" ]; then case "${J_LANE[$i]}" in emu) hint=15000 ;; browser) hint=12000 ;; *) hint=2000 ;; esac; fi
            printf '%s\t%s\t%s\n' "$rank" "$hint" "$i"
        done | LC_ALL=C sort -t "$(printf '\t')" -k1,1n -k2,2nr -k3,3n)
}

runall_start() {  # <j>
    local j="$1"
    J_ST[$j]=running
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
runall_reap() {  # រង់ចាំ checker ណាមួយចប់ ➜ សាលក្រមភ្លាម (state) · មិនទាន់បោះពុម្ព
    local j keep=()
    if [ "$RUNALL_ACTIVE" -eq 1 ]; then wait "${J_SPID[${RUNALL_RUNNING[0]}]}" 2>/dev/null
    else wait -n 2>/dev/null; fi
    for j in "${RUNALL_RUNNING[@]}"; do
        if [ -f "$RUNALL_DIR/$j.rc" ] || ! kill -0 "${J_SPID[$j]}" 2>/dev/null; then
            wait "${J_SPID[$j]}" 2>/dev/null
            runall_judge "$j"
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
    [ "${J_SHOW[$i]}" = 1 ] && sed 's/^/      /' "$RUNALL_DIR/$i.out"
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
    runall_order
    echo "   (lane ${RUNALL_JOBS} · browser ≤ ${RUNALL_BROWSER_JOBS} · emu ≤ 1 · meta ម្នាក់ឯង · ពិដាន ${CHECKER_TIMEOUT}s/checker)"
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
        echo "⚠️  មិនពេញលេញ ៖ វាស់ $((total - off))/${total} checker (RUNALL_ONLY) — នេះមិនមែនភស្តុតាងថា tree បៃតងទេ"
        if [ "$fail" -eq 0 ]; then
            echo "✅ ជោគជ័យលើ checker ដែលបានវាស់ (មិនពេញលេញ)  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
        else
            echo "❌ ធ្លាក់ $fail  (ជោគជ័យ $pass, មួយផ្នែក $partial, រំលង $skip · មិនពេញលេញ)"
        fi
    elif [ "$fail" -eq 0 ]; then
        echo "✅ ជោគជ័យទាំងអស់  ($pass ពេញលេញ, $partial មួយផ្នែក, រំលង $skip)"
    else
        echo "❌ ធ្លាក់ $fail  (ជោគជ័យ $pass, មួយផ្នែក $partial, រំលង $skip)"
    fi
}
#@runner-end

section "== តេស្តឥរិយាបថ (រត់កូដពិតចេញពី app.js) =="
for t in policy-test auth-recovery-test keylist-consistency-test \
         license-grace-test license-clock-trust-test \
         license-clock-rollback-test license-record-race-test license-seat-test \
         cleanup-clock-guard-test expired-trash-retention-test khmer-timezone-test monotonic-gate-test \
         phone-suggest-test phone-search-swipe-test \
         pin-prompt-test biometric-unlock-test keygen-pin-flow-test \
         keygen-session-security-test keygen-notice-test \
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

section "== ការត្រួតពិនិត្យរចនាសម្ព័ន្ធ =="
for t in shared-fns wiring action-binding-test function-surface-test code-duplication-test dom-hygiene state-hygiene comments payload-schema compensation-order stale-write storage-guard secret-hygiene html-sink-escaping clock-hygiene clock-basis-test doc-scope-test adaptive-link-test version-check; do
    [ -n "$NO_ACORN" ] && { skipm "$t"; continue; }
    run "$t" node "audit-tools/$t.js"
done
# ⛔ meta-checker៖ តើ checker ខ្លួនវាពិតជាមើលកូដមែនទេ? (រត់វាមុនគេក្នុងក្រុមនេះ)
run "checker-coverage (meta)" node audit-tools/checker-coverage.js
run "hang-guard (meta)" node audit-tools/hang-guard.js
run "runall-runner (meta)" node audit-tools/runall-runner-test.js
run "exit-code-integrity (meta)" node audit-tools/exit-code-integrity.js
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
# ⛔ «សំណុំបៃតង» មិនមែនភស្តុតាង — ឧបករណ៍នេះបំបែកតក្កវិជ្ជាលុយដោយចេតនា
# រួចទាមទារថា **អ្នកយាមយ៉ាងតិច ១ ត្រូវក្រហម**។ បើអ្នកយាមចុងក្រោយងងឹត
# វាធ្លាក់ **មុន** កំហុសលុយបន្ទាប់ ship។
run "money-guardian" node audit-tools/money-guardian-test.js
run "money-reality" node audit-tools/money-reality-test.js
run "repository-file-coverage" node audit-tools/repository-file-coverage.js
run "repository-contract" node audit-tools/repository-contract-test.js
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
run "zoew-suite (ZoeW React ៖ tsc · lint · vitest · native · android)" node audit-tools/zoew-suite-test.js
run "zoew-parity (ZoeW React ៖ DOM · layout · live · deep ធៀប ZoeW ដើម)" node audit-tools/zoew-suite-test.js --parity

section "== ខ្សែសង្វាក់នាំចូល (zto-import) =="
# ⚠️ វាធ្លាប់នៅ **ក្រៅ** ឯកសារនេះ ដោយហេតុផលថា «មិនមែនជាផ្នែករបស់ App»។
# ការទុកវាក្រៅមានន័យថា assertion ៥០ រត់តែពេលមាននរណាម្នាក់ចាំវាយដោយដៃ។
# ⛔ ចំណាំ ៖ `zto-import` ជាខាង **server** នៃមុខងារ «នាំចូល Excel ទៅ Sheet»
# ដែលរស់នៅក្នុង ZoeW តាំងពីកំណែ 2.21.0 (App `ZoeImport` ត្រូវលុបចេញហើយ) ➜
# វាកាន់តែសំខាន់ជាងមុន។ ខាង client ចាក់សោដោយ `sheet-import-test.js`។
run "zto-import/test.js" node zto-import/test.js

section "== ឧបករណ៍បង្កើតអតិថិជនថ្មី (tools/firebase-provision) =="
# ⛔ CLI ពិត + firebase-tools ពិត (កំណែ pin) ទល់ Google ក្លែងលើ HTTPS ➜ `npm ci --prefix tools/firebase-provision` + openssl
#    គ្មាន dependency ➜ SKIP · `FBPROVISION_STRICT=1` ➜ FAIL (ដូច emu/*)
run "firebase-provision (CLI + firebase-tools ពិត · mutation)" node audit-tools/firebase-provision-test.js

section "== ទម្លាប់គម្រោង =="
run "node --check លើ app.js ទាំង ២" bash -c 'for a in ZoeW ZoeKeyGen; do node --check "$a/app.js" || exit 1; done'
run "rules JSON valid" node -e "const fs=require('fs');JSON.parse(fs.readFileSync('firebase-database.rules.json','utf8'));JSON.parse(fs.readFileSync('ZoeKeyGen/firebase-database.rules.json','utf8'));"
run "license-verify.js byte-identical ×2" bash -c '[ "$(md5sum ZoeW/license-verify.js ZoeKeyGen/license-verify.js | cut -d" " -f1 | sort -u | wc -l)" = 1 ]'
run "error-reporting.js byte-identical ×2" bash -c '[ "$(md5sum ZoeW/error-reporting.js ZoeKeyGen/error-reporting.js | cut -d" " -f1 | sort -u | wc -l)" = 1 ]'
run "គ្មាន trailing whitespace" bash -c '[ "$(cat ZoeW/app.js ZoeKeyGen/app.js | grep -c "[[:space:]]$")" = 0 ]'

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
    SWWIRE_APP_DIR="$BASE" node audit-tools/sw-client-wiring-test.js 2>&1 | tail -1 | sed 's/^/   sw-wiring:       /'
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
    FBPROVISION_APP_DIR="$BASE" node audit-tools/firebase-provision-test.js 2>&1 | tail -1 | sed 's/^/   fb-provision:    /'
    CRUDFLOW_APP_DIR="$BASE" node audit-tools/emu/crud-rules-flow.js 2>&1 | tail -1 | sed 's/^/   emu-crud-flow:   /'
    DEADLOCK_APP_DIR="$BASE" node audit-tools/emu/restore-deadlock-test.js 2>&1 | tail -1 | sed 's/^/   emu-deadlock:    /'
    LEDGEREMU_APP_DIR="$BASE" node audit-tools/emu/ledger-revert-emu-test.js 2>&1 | tail -1 | sed 's/^/   emu-ledger-rev:  /'
    RESTOREMUTATION_APP_DIR="$BASE" node audit-tools/emu/restore-mutation-emu-test.js 2>&1 | tail -1 | sed 's/^/   restore-mutation:/'
    MONEYGUARD_APP_DIR="$BASE" node audit-tools/money-guardian-test.js 2>&1 | tail -1 | sed 's/^/   money-guardian:  /'
    MONEYREALTEST_APP_DIR="$BASE" node audit-tools/money-reality-test.js 2>&1 | tail -1 | sed 's/^/   money-reality:   /'
    REPOCOVER_APP_DIR="$BASE" node audit-tools/repository-file-coverage.js 2>&1 | tail -1 | sed 's/^/   file-coverage:   /'
    REPOCONTRACT_APP_DIR="$BASE" node audit-tools/repository-contract-test.js 2>&1 | tail -1 | sed 's/^/   repo-contract:   /'
    HANGGUARD_APP_DIR="$BASE" node audit-tools/hang-guard.js 2>&1 | tail -1 | sed 's/^/   hang-guard:      /'
    RUNALLRUNNER_APP_DIR="$BASE" node audit-tools/runall-runner-test.js 2>&1 | tail -1 | sed 's/^/   runall-runner:   /'
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
    KEYGEN_APP_DIR="$BASE" node audit-tools/keygen-session-security-test.js 2>&1 | tail -1 | sed 's/^/   keygen-session:  /'
    KEYGEN_APP_DIR="$BASE" node audit-tools/keygen-notice-test.js 2>&1 | tail -1 | sed 's/^/   keygen-notice:   /'
    KEYLIST_APP_DIR="$BASE" node audit-tools/keylist-consistency-test.js 2>&1 | tail -1 | sed 's/^/   keylist-consistency:/'
    LICGRACE_APP_DIR="$BASE" node audit-tools/license-grace-test.js 2>&1 | tail -1 | sed 's/^/   license-grace:   /'
    LICROLLBACK_APP_DIR="$BASE" node audit-tools/license-clock-rollback-test.js 2>&1 | tail -1 | sed 's/^/   license-rollback:/'
    LICRACE_APP_DIR="$BASE" node audit-tools/license-record-race-test.js 2>&1 | tail -1 | sed 's/^/   license-race:    /'
    LICSEAT_APP_DIR="$BASE" node audit-tools/license-seat-test.js 2>&1 | tail -1 | sed 's/^/   license-seat:    /'
    LICSEATEMU_APP_DIR="$BASE" node audit-tools/emu/license-seat-rules-test.js 2>&1 | tail -1 | sed 's/^/   license-seat-emu:/'
    TXEMU_APP_DIR="$BASE" node audit-tools/emu/tx-disconnect-emu-test.js 2>&1 | tail -1 | sed 's/^/   tx-disconnect-emu:/'
    APPWRITES_APP_DIR="$BASE" node audit-tools/emu/app-writes-rules-test.js 2>&1 | tail -1 | sed 's/^/   app-writes-emu:  /'
    NETE2E_APP_DIR="$BASE" node audit-tools/emu/app-network-e2e-test.js 2>&1 | tail -1 | sed 's/^/   app-network-e2e: /'
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
    ZTO_IMPORT_APP_DIR="$BASE/zto-import" node zto-import/test.js 2>&1 | tail -1 | sed 's/^/   zto-import:      /'
    APPLOCK_APP_DIR="$BASE" node audit-tools/app-lock-test.js 2>&1 | tail -1 | sed 's/^/   app-lock:        /'
    LEAK_APP_DIR="$BASE" node audit-tools/listener-leak-test.js 2>&1 | tail -1 | sed 's/^/   listener-leak:   /'
    STALLGUARD_APP_DIR="$BASE" node audit-tools/stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   stall-guard:     /'
    STORAGEBOOT_APP_DIR="$BASE" node audit-tools/storage-blocked-boot-test.js 2>&1 | tail -1 | sed 's/^/   storage-boot:    /'
    DBSTALL_APP_DIR="$BASE" node audit-tools/db-stall-guard-test.js 2>&1 | tail -1 | sed 's/^/   db-stall-guard:  /'
fi

runall_summary
exit "$fail"
