#!/usr/bin/env bash
# ផលិត `src/` ឡើងវិញពី ZoeW `app.js` ដើម (vanilla JS)។
#
# ⛔⛔ ឧបករណ៍នេះ **សរសេរជាន់** `src/` ទាំងមូល។ ចាប់ពីពេល ZoeW ក្លាយជា App React
#    `src/` គឺជា **ប្រភពការពិត** ➜ ការកែណាមួយក្នុង `src/` ដែលមិននៅក្នុង
#    `tools/fixups.cjs` នឹង **បាត់ស្ងាត់ៗ**។ ដូច្នេះវាត្រូវចាក់សោ ៖ រត់បានតែពេល
#    ដឹងច្បាស់ ហើយ `ALLOW_REGENERATE=1`។
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${ALLOW_REGENERATE:-}" != "1" ]; then
    echo "⛔ generate ត្រូវចាក់សោ ៖ វាសរសេរជាន់ src/ ទាំងមូល (ការកែដោយដៃនឹងបាត់)។" >&2
    echo "   បើពិតជាចង់ផលិតឡើងវិញពី ZoeW ដើម ៖" >&2
    echo "     npm run original:fetch && ALLOW_REGENERATE=1 npm run generate" >&2
    exit 2
fi
SRC_FILE="${SRC_FILE:-.original/ZoeW/app.js}"
if [ ! -f "$SRC_FILE" ]; then
    echo "⛔ រក $SRC_FILE មិនឃើញ — រត់ npm run original:fetch ជាមុន" >&2
    exit 2
fi
export SRC_FILE

echo "១/៤  បំបែក app.js ➜ module"
node tools/codemod.cjs
echo "២/៤  ផលិតឃ្លាំង state"
node tools/gen-state.cjs
echo "៣/៤  ជួសជុល type"
node tools/fixups.cjs
echo "៤/៤  ពិនិត្យ type"
npx tsc -p tsconfig.app.json --noEmit
echo "✅ រួចរាល់"
