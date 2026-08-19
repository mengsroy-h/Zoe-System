#!/bin/bash
# Exercises the REAL firebase-database.rules.json (with the candidate $idx guard)
# against the exact write shapes Zoescan / ZoeW / ZoeAdmin perform.
cd "$(dirname "$0")"
B="http://127.0.0.1:9000"; NS="ns=demo-zoe"
c() { curl -s --noproxy '*' -H "Authorization: Bearer owner" "$@"; }
SC='auth_variable_override=%7B%22uid%22%3A%22scanUid%22%7D'
WK='auth_variable_override=%7B%22uid%22%3A%22wrkUid%22%7D'
AD='auth_variable_override=%7B%22uid%22%3A%22admUid%22%7D'

echo "load real rules: $(c -X PUT "$B/.settings/rules.json?$NS" --data-binary @real.rules.json)"

seed() {
  c -X PUT "$B/user_roles.json?$NS" -d '{"scanUid":"scanner","admUid":"admin","wrkUid":"worker"}' > /dev/null
  c -X PUT "$B/zoew_scan_history_cod_dod/it1.json?$NS" -d '{
    "id":"it1","phone":"012","scanDate":"2026-08-19","time":"t","createdAt":1000,
    "cod":12,"dod":3,"price":15,"count":2,"barcode":"AAA","isClosed":false,
    "barcodes":[
      {"code":"AAA","cod":5,"dod":1,"locker":"L1","isClosed":false,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000},
      {"code":"BBB","cod":7,"dod":2,"locker":"L2","isClosed":true,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}
    ]}' > /dev/null
}
seed

pass=0; fail=0
t() { # label expected auth json-body
  local out; out=$(c -X PATCH "$B/.json?$NS&$3" -d "$4")
  local got=ALLOWED
  case "$out" in *"error"*) got=DENIED;; esac
  if [ "$got" = "$2" ]; then printf '   ok   %-52s %s\n' "$1" "$got"; pass=$((pass+1))
  else printf '  FAIL  %-52s expect %s got %s\n' "$1" "$2" "$got"; fail=$((fail+1)); fi
  seed
}

echo
echo "== Zoescan mirror write (root multi-path, exactly as assignLockerToEntry sends) =="
t "valid index 0, matching code" ALLOWED "$SC" '{
 "zoew_scan_history_cod_dod/it1/barcodes/0/code":"AAA",
 "zoew_scan_history_cod_dod/it1/barcodes/0/locker":"T7",
 "zoew_scan_history_cod_dod/it1/barcodes/0/lockerUpdatedAt":2000,
 "zoew_scan_history_cod_dod/it1/lockerUpdatedBy":"s@x.com"}'

t "OUT-OF-RANGE index 9 (sparse-array corruption)" DENIED "$SC" '{
 "zoew_scan_history_cod_dod/it1/barcodes/9/code":"AAA",
 "zoew_scan_history_cod_dod/it1/barcodes/9/locker":"T7",
 "zoew_scan_history_cod_dod/it1/barcodes/9/lockerUpdatedAt":2000,
 "zoew_scan_history_cod_dod/it1/lockerUpdatedBy":"s@x.com"}'

t "wrong code at index 1" DENIED "$SC" '{
 "zoew_scan_history_cod_dod/it1/barcodes/1/code":"AAA",
 "zoew_scan_history_cod_dod/it1/barcodes/1/locker":"T7",
 "zoew_scan_history_cod_dod/it1/barcodes/1/lockerUpdatedAt":2000}'

t "single-barcode legacy shape (item-level locker)" ALLOWED "$SC" '{
 "zoew_scan_history_cod_dod/it1/locker":"T7",
 "zoew_scan_history_cod_dod/it1/lockerUpdatedAt":2000,
 "zoew_scan_history_cod_dod/it1/lockerUpdatedBy":"s@x.com"}'

echo
echo "== ZoeAdmin / ZoeW legitimate writes must keep working =="
t "admin adds a NEW barcode at index 2" ALLOWED "$AD" '{
 "zoew_scan_history_cod_dod/it1/barcodes/2":{"code":"CCC","cod":1,"dod":0,"locker":"N/A","isClosed":false,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000},
 "zoew_scan_history_cod_dod/it1/count":3}'

t "worker closes a barcode (toggleIndividualBarcodeClose)" ALLOWED "$WK" '{
 "zoew_scan_history_cod_dod/it1/barcodes/0/isClosed":true,
 "zoew_scan_history_cod_dod/it1/isClosed":true,
 "zoew_scan_history_cod_dod/it1/closedAt":2000}'

t "worker restores a brand-new item with barcodes[]" ALLOWED "$WK" '{
 "zoew_scan_history_cod_dod/it2":{"id":"it2","phone":"013","scanDate":"2026-08-19","time":"t","createdAt":1000,"cod":5,"dod":1,"price":6,"count":1,"barcode":"ZZZ","isClosed":false,
  "barcodes":[{"code":"ZZZ","cod":5,"dod":1,"locker":"N/A","isClosed":false,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}]}}'

echo
echo "== the separately-flagged ZoeW partial-claim index shift =="
t "worker rewrites remainder, index 0 becomes BBB" ALLOWED "$WK" '{
 "zoew_scan_history_cod_dod/it1/barcodes":[{"code":"BBB","cod":7,"dod":2,"locker":"L2","isClosed":true,"isDeducted":false,"isFromDeletion":false,"time":"t","createdAt":1000}],
 "zoew_scan_history_cod_dod/it1/count":1,
 "zoew_scan_history_cod_dod/it1/cod":7,
 "zoew_scan_history_cod_dod/it1/dod":2,
 "zoew_scan_history_cod_dod/it1/price":9,
 "zoew_scan_history_cod_dod/it1/barcode":"BBB",
 "zoew_scan_history_cod_dod/it1/isClosed":true,
 "zoew_scan_history_cod_dod/it1/closedAt":2000}'

echo
echo "pass=$pass fail=$fail"
