#!/bin/bash
# Proves the ZoeW 8-day partial-claim relaxation does exactly what it should:
# the compacted-remainder write becomes ALLOWED for a worker, while the scanner
# guards and the trash-side money locks stay DENIED.
# Run the emulator first, then:  bash audit-tools/emu/partial-claim.sh
cd "$(dirname "$0")"
B="http://127.0.0.1:9000"; NS="ns=demo-zoe"
c() { curl -s --noproxy '*' -H "Authorization: Bearer owner" "$@"; }
SC='auth_variable_override=%7B%22uid%22%3A%22scanUid%22%7D'
WK='auth_variable_override=%7B%22uid%22%3A%22wrkUid%22%7D'

seed() {
  c -X PUT "$B/user_roles.json?$NS" -d '{"scanUid":"scanner","admUid":"admin","wrkUid":"worker"}' > /dev/null
  c -X PUT "$B/zoew_scan_history_cod_dod/it1.json?$NS" -d '{
    "id":"it1","phone":"012","scanDate":"2026-08-19","time":"t","createdAt":1000,
    "cod":12,"dod":3,"price":15,"count":2,"barcode":"AAA","isClosed":false,
    "barcodes":[
      {"code":"AAA","cod":5,"dod":1,"locker":"L1","isClosed":false,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000},
      {"code":"BBB","cod":7,"dod":2,"locker":"L2","isClosed":true,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}
    ]}' > /dev/null
  c -X PUT "$B/zoew_recently_deleted_cod_dod/tr1.json?$NS" -d '{
    "id":"tr1","phone":"012","scanDate":"2026-08-19","time":"t","createdAt":1000,"deletedAt":2000,
    "cod":5,"dod":1,"price":6,"count":1,"barcode":"AAA","isClosed":false,"isFromDeletion":false,
    "barcodes":[{"code":"AAA","cod":5,"dod":1,"locker":"L1","isClosed":false,"isDeducted":true,"isFromDeletion":false,"time":"t","createdAt":1000}]}' > /dev/null
}
seed

pass=0; fail=0
t() { # label expected auth json-body
  local out; out=$(c -X PATCH "$B/.json?$NS&$3" -d "$4")
  local got=ALLOWED
  case "$out" in *"error"*) got=DENIED;; esac
  if [ "$got" = "$2" ]; then printf '   ok   %-56s %s\n' "$1" "$got"; pass=$((pass+1))
  else printf '  FAIL  %-56s expect %s got %s\n' "$1" "$2" "$got"; fail=$((fail+1)); fi
  seed
}

echo "load rules: $(c -X PUT "$B/.settings/rules.json?$NS" --data-binary @real.rules.json)"
echo
echo "== what the relaxation is FOR: ZoeW claimAndCleanupItem partial branch =="
t "worker writes compacted remainder (index 0 AAA->BBB)" ALLOWED "$WK" '{
 "zoew_scan_history_cod_dod/it1/barcodes":[{"code":"BBB","cod":7,"dod":2,"locker":"L2","isClosed":true,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}],
 "zoew_scan_history_cod_dod/it1/count":1,"zoew_scan_history_cod_dod/it1/cod":7,"zoew_scan_history_cod_dod/it1/dod":2,
 "zoew_scan_history_cod_dod/it1/price":9,"zoew_scan_history_cod_dod/it1/barcode":"BBB",
 "zoew_scan_history_cod_dod/it1/isClosed":true,"zoew_scan_history_cod_dod/it1/closedAt":2000}'

t "worker creates the matching trash record" ALLOWED "$WK" '{
 "zoew_recently_deleted_cod_dod/tr2":{"id":"tr2","phone":"012","scanDate":"2026-08-19","time":"t","createdAt":1000,"deletedAt":2000,
  "cod":5,"dod":1,"price":6,"count":1,"barcode":"AAA","isClosed":false,"isFromDeletion":false,
  "barcodes":[{"code":"AAA","cod":5,"dod":1,"locker":"L1","isClosed":false,"isDeducted":true,"isFromDeletion":false,"time":"t","createdAt":1000}]}}'

echo
echo "== what must STILL be denied =="
t "scanner changes a barcode cod" DENIED "$SC" '{
 "zoew_scan_history_cod_dod/it1/barcodes/0/cod":999}'

t "scanner creates a barcode out of range" DENIED "$SC" '{
 "zoew_scan_history_cod_dod/it1/barcodes/9/code":"AAA",
 "zoew_scan_history_cod_dod/it1/barcodes/9/locker":"T7"}'

t "scanner changes an existing barcode code" DENIED "$SC" '{
 "zoew_scan_history_cod_dod/it1/barcodes/0/code":"XXX"}'

t "worker rewrites an EXISTING trash barcode cod (restore add-back)" DENIED "$WK" '{
 "zoew_recently_deleted_cod_dod/tr1/barcodes/0/cod":999}'

t "worker rewrites an EXISTING trash item-level cod" DENIED "$WK" '{
 "zoew_recently_deleted_cod_dod/tr1/cod":999}'

# no Bearer token at all: sending one makes the emulator treat the request as
# the project owner, which bypasses rules and turns this into a false pass.
noauth_out=$(curl -s --noproxy '*' -X PATCH "$B/.json?$NS" -d '{"zoew_scan_history_cod_dod/it1/barcodes/0/locker":"T7"}')
case "$noauth_out" in
  *error*) printf '   ok   %-56s %s\n' "unauthenticated write to scan history" DENIED; pass=$((pass+1));;
  *)       printf '  FAIL  %-56s expect DENIED got ALLOWED\n' "unauthenticated write to scan history"; fail=$((fail+1));;
esac
seed

echo
echo "== accepted cost of this change (documented, not a bug) =="
t "worker edits a live barcode cod directly" ALLOWED "$WK" '{
 "zoew_scan_history_cod_dod/it1/barcodes/0/cod":999}'

echo
echo "pass=$pass fail=$fail"
[ "$fail" = 0 ]
