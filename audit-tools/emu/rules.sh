#!/bin/bash
# រត់ firebase-database.rules.json ពិត លើ RTDB emulator។
#
#   npm i firebase-tools
#   npx firebase setup:emulators:database
#   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
#   cp firebase-database.rules.json audit-tools/emu/real.rules.json
#   bash audit-tools/emu/rules.sh
#
# អន្ទាក់ដែលធ្លាប់ធ្វើឲ្យតេស្តជោគជ័យក្លែងក្លាយ៖
#   · `.settings/rules.json` និង `auth_variable_override` ត្រូវការ `Authorization: Bearer owner`
#     បើអត់ rules នៅបើកចំហ ហើយអ្វីៗជោគជ័យទាំងអស់។
#   · សំណើដែលមាន `Bearer owner` តែគ្មាន `auth_variable_override` = ម្ចាស់ project ➜ រំលង rules។
#     ដូច្នេះការតេស្ត "គ្មាន auth ត្រូវបដិសេធ" ត្រូវ **មិនផ្ញើ header នោះសោះ**។
cd "$(dirname "$0")" || exit 1

B="http://127.0.0.1:9000"
NS="ns=demo-zoe"
UID_A='auth_variable_override=%7B%22uid%22%3A%22userA%22%7D'
UID_B='auth_variable_override=%7B%22uid%22%3A%22userB%22%7D'

owner() { curl -s --noproxy '*' -H "Authorization: Bearer owner" "$@"; }
anon()  { curl -s --noproxy '*' "$@"; }

if [ ! -f real.rules.json ]; then
  echo "កង្វះ real.rules.json — រត់៖ cp firebase-database.rules.json audit-tools/emu/real.rules.json"
  exit 1
fi

LOAD=$(owner -X PUT "$B/.settings/rules.json?$NS" --data-binary @real.rules.json)
echo "load real rules: $LOAD"
case "$LOAD" in
  *'"status" : "ok"'*|*'"status":"ok"'*) ;;
  *) echo "❌ rules មិនបាន load ទេ — emulator នៅរក្សា rules ចាស់ ➜ លទ្ធផលទាំងអស់ជា false pass"; exit 1;;
esac

pass=0; fail=0
verdict() { case "$1" in *"Permission denied"*|*'"error"'*) echo DENIED;; *) echo ALLOWED;; esac; }
chk() { # name expected got
  local mark="FAIL"
  [ "$3" = "$2" ] && mark=" ok "
  [ "$3" = "$2" ] && pass=$((pass+1)) || fail=$((fail+1))
  printf '  %s  %-52s expect %-7s got %s\n' "$mark" "$1" "$2" "$3"
}
w() { chk "$1" "$2" "$(verdict "$(owner -X PATCH "$B/$4?$NS&$3" -d "$5")")"; }
fan() { chk "$1" "$2" "$(verdict "$(owner -X PATCH "$B/.json?$NS&$3" -d "$4")")"; }

seed() {
  owner -X PUT "$B/.json?$NS" -d '{}' > /dev/null
  owner -X PUT "$B/zoew_scan_history_cod_dod/it1.json?$NS" -d '{
    "id":"it1","phone":"012","scanDate":"2026-08-19","time":"t","createdAt":1000,
    "cod":12,"dod":3,"price":15,"count":2,"barcode":"AAA","isClosed":false,
    "barcodes":[
      {"code":"AAA","cod":5,"dod":1,"locker":"N/A","isClosed":false,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000},
      {"code":"BBB","cod":7,"dod":2,"locker":"L2","isClosed":true,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}
    ]}' > /dev/null
}
seed

echo
echo "== គ្មាន auth ➜ បដិសេធទាំងអាន ទាំងសរសេរ =="
chk "អានប្រវត្តិដោយគ្មាន auth" DENIED "$(verdict "$(anon "$B/zoew_scan_history_cod_dod.json?$NS")")"
chk "សរសេរប្រវត្តិដោយគ្មាន auth" DENIED "$(verdict "$(anon -X PATCH "$B/zoew_scan_history_cod_dod/it1.json?$NS" -d '{"phone":"099"}')")"

echo
echo "== អ្នកប្រើដែលចូលប្រព័ន្ធបាន ➜ សិទ្ធិដូចគ្នា (គ្មានតួនាទី) =="
chk "userA អានប្រវត្តិ" ALLOWED "$(verdict "$(owner "$B/zoew_scan_history_cod_dod.json?$NS&$UID_A")")"
chk "userB អានប្រវត្តិ" ALLOWED "$(verdict "$(owner "$B/zoew_scan_history_cod_dod.json?$NS&$UID_B")")"
w "userA កំណត់ទីតាំង Locker លើ barcode ដែលមានស្រាប់" ALLOWED "$UID_A" \
  "zoew_scan_history_cod_dod/it1/barcodes/0.json" '{"locker":"L7","lockerUpdatedAt":2000,"lockerUpdatedBy":"a@x.com"}'
w "userB ផ្លាស់ទីតាំងដដែលនោះម្តងទៀត" ALLOWED "$UID_B" \
  "zoew_scan_history_cod_dod/it1/barcodes/0.json" '{"locker":"L8","lockerUpdatedAt":3000,"lockerUpdatedBy":"b@x.com"}'
w "userA បិទ barcode" ALLOWED "$UID_A" \
  "zoew_scan_history_cod_dod/it1/barcodes/0.json" '{"isClosed":true}'
w "userA កែ COD របស់ barcode" ALLOWED "$UID_A" \
  "zoew_scan_history_cod_dod/it1/barcodes/0.json" '{"cod":9}'
fan "userA បង្កើតកញ្ចប់ថ្មី" ALLOWED "$UID_A" '{
 "zoew_scan_history_cod_dod/it2":{"id":"it2","phone":"013","scanDate":"2026-08-19","time":"t","createdAt":1000,
  "cod":5,"dod":1,"price":6,"count":1,"barcode":"ZZZ","isClosed":false,
  "barcodes":[{"code":"ZZZ","cod":5,"dod":1,"locker":"N/A","isClosed":false,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}]}}'
w "userA សរសេរតួលេខចំណូលប្រចាំថ្ងៃ" ALLOWED "$UID_A" \
  "zoew_daily_revenue_cod_dod/2026-08-19.json" '{"codDollar":12,"dodDollar":3,"totalCount":2}'
w "userA កក់ barcode ក្នុង registry" ALLOWED "$UID_A" \
  "zoew_barcode_registry.json" '{"QQQ":true}'

echo
echo "== schema validation នៅតែការពារដដែល =="
w "វាលចម្លែកលើ item ($other: false)" DENIED "$UID_A" \
  "zoew_scan_history_cod_dod/it1.json" '{"somethingWeird":1}'
w "cod ជា string" DENIED "$UID_A" \
  "zoew_scan_history_cod_dod/it1/barcodes/1.json" '{"cod":"abc"}'
w "cod អវិជ្ជមាន" DENIED "$UID_A" \
  "zoew_scan_history_cod_dod/it1/barcodes/1.json" '{"cod":-5}'
w "isClosed ជា string" DENIED "$UID_A" \
  "zoew_scan_history_cod_dod/it1.json" '{"isClosed":"true"}'
w "តួលេខចំណូលអវិជ្ជមាន" DENIED "$UID_A" \
  "zoew_daily_revenue_cod_dod/2026-08-19.json" '{"codDollar":-1}'
w "registry សរសេរ false" DENIED "$UID_A" \
  "zoew_barcode_registry.json" '{"RRR":false}'

echo
echo "== node ដែលលុបចោលរួច ➜ បិទ =="
chk "អាន user_roles" DENIED "$(verdict "$(owner "$B/user_roles.json?$NS&$UID_A")")"
w "សរសេរ zoew_scanner_lookup" DENIED "$UID_A" "zoew_scanner_lookup/it1.json" '{"barcode":"AAA"}'

echo
echo "== claim/witness fence នៅដដែល =="
w "witness Clear All ដោយគ្មាន claim ត្រូវគ្នា" DENIED "$UID_A" \
  "zoew_clear_history_finalizations.json" '{"it1":{"token":"bogus","finalizedAt":9}}'
w "witness Restore ដោយគ្មាន claim ត្រូវគ្នា" DENIED "$UID_A" \
  "zoew_restore_finalizations.json" '{"src1":{"token":"bogus","targetId":"it1"}}'

echo
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ] || exit 1
