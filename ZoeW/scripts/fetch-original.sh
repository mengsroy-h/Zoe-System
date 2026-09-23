#!/usr/bin/env bash
# ទាញ ZoeW ដើម (vanilla JS) ពី git ចូល `.original/ZoeW` — អ្នកសម្រេចនៃការវាស់ parity។
# ⛔ លំនាំដើមជា commit ចុងក្រោយដែល `ZoeW/app.js` មាន (មុនការជំនួសដោយ React)
#    ➜ បើផ្តល់ ref ផ្ទាល់ ត្រូវតែជា ref ដែល ZoeW នៅជា vanilla JS។
set -euo pipefail
cd "$(dirname "$0")/.."
TOP="$(git rev-parse --show-toplevel)"
REF="${1:-}"
if [ -z "$REF" ]; then
    # commit ចុងក្រោយដែលប៉ះ ZoeW/app.js ៖ បើវាលុប app.js (ការជំនួស) ➜ យកមេរបស់វា
    LAST="$(git -C "$TOP" log -1 --format=%H -- ZoeW/app.js)"
    if [ -z "$LAST" ]; then echo "⛔ រកប្រវត្តិ ZoeW/app.js ក្នុង git មិនឃើញ" >&2; exit 2; fi
    if git -C "$TOP" cat-file -e "$LAST":ZoeW/app.js 2>/dev/null; then REF="$LAST"; else REF="$LAST^"; fi
fi
if ! git -C "$TOP" cat-file -e "$REF":ZoeW/app.js 2>/dev/null; then
    echo "⛔ ref «$REF» គ្មាន ZoeW/app.js (មិនមែន ZoeW vanilla JS)" >&2
    exit 2
fi
rm -rf .original
mkdir -p .original
git -C "$TOP" archive "$REF" ZoeW | tar -x -C .original
echo "✅ ZoeW ដើម ➜ .original/ZoeW (ref $(git -C "$TOP" rev-parse --short "$REF"))"
