#!/usr/bin/env bash
# ខ្ចប់ ZoeW React ជា zip ដែលរួចរាល់សម្រាប់ប្រគល់។
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
NAME="${1:-zoew-next}"
OUT="${OUT_DIR:-$ROOT/..}"

echo "១/៣  build"
npm run build:only >/dev/null

echo "២/៣  ខ្ចប់កូដប្រភព + ឯកសារ + dist"
rm -f "$OUT/$NAME.zip" "$OUT/$NAME-full.zip"
zip -rq "$OUT/$NAME.zip" . \
    -x 'node_modules/*' -x 'dist-audit/*' -x '.git/*' -x 'tools/_*' -x '*.DS_Store'

echo "៣/៣  ខ្ចប់រួមទាំង node_modules"
# ⛔ `-y` ចាំបាច់ ៖ គ្មានវា zip **ដើរតាម symlink** រួចរក្សាមាតិកាឯកសារ
#    គោលដៅជំនួស ➜ shim ក្នុង `node_modules/.bin` ក្លាយជាច្បាប់ចម្លងដែល
#    ដោះស្រាយផ្លូវទាក់ទងមិនកើត ➜ `npx vitest` ធ្លាក់ `ERR_MODULE_NOT_FOUND`
#    លើម៉ាស៊ីនអ្នកទទួល ខណៈវាដើរលើម៉ាស៊ីនដែលខ្ចប់។
zip -ryq "$OUT/$NAME-full.zip" . \
    -x 'dist-audit/*' -x '.git/*' -x 'tools/_*' -x '*.DS_Store'

ls -lh "$OUT/$NAME.zip" "$OUT/$NAME-full.zip"
