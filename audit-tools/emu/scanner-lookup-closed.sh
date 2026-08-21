#!/bin/bash
# Verifies the zoew_scanner_lookup isClosed field against the REAL
# firebase-database.rules.json — the field Zoescan's locker-occupancy
# exemption reads, and which the schema previously rejected outright.
cd "$(dirname "$0")"
B="http://127.0.0.1:9000"; NS="ns=demo-zoe"
c() { curl -s --noproxy '*' -H "Authorization: Bearer owner" "$@"; }
SC='auth_variable_override=%7B%22uid%22%3A%22scanUid%22%7D'
WK='auth_variable_override=%7B%22uid%22%3A%22wrkUid%22%7D'
AD='auth_variable_override=%7B%22uid%22%3A%22admUid%22%7D'

echo "load real rules: $(c -X PUT "$B/.settings/rules.json?$NS" --data-binary @real.rules.json)"

seed() {
  c -X PUT "$B/user_roles.json?$NS" -d '{"scanUid":"scanner","admUid":"admin","wrkUid":"worker"}' > /dev/null
  c -X PUT "$B/zoew_scanner_lookup/it1.json?$NS" -d '{
    "id":"it1","phone":"012","barcode":"AAA","locker":"L1","isClosed":false,
    "barcodes":[
      {"code":"AAA","locker":"L1","isClosed":false},
      {"code":"BBB","locker":"L2","isClosed":true}
    ]}' > /dev/null
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
tnoauth() { # label expected json-body
  local out; out=$(curl -s --noproxy '*' -X PATCH "$B/.json?$NS" -d "$3")
  local got=ALLOWED
  case "$out" in *"error"*) got=DENIED;; esac
  if [ "$got" = "$2" ]; then printf '   ok   %-56s %s\n' "$1" "$got"; pass=$((pass+1))
  else printf '  FAIL  %-56s expect %s got %s\n' "$1" "$2" "$got"; fail=$((fail+1)); fi
  seed
}

echo
echo "== the new isClosed field on zoew_scanner_lookup =="
t "worker writes full payload WITH isClosed (set)" ALLOWED "$WK" '{
 "zoew_scanner_lookup/it1":{"id":"it1","phone":"012","barcode":"AAA","locker":"L1","isClosed":true,
  "barcodes":[{"code":"AAA","locker":"L1","isClosed":true},{"code":"BBB","locker":"L2","isClosed":true}]}}'

t "admin writes full payload WITH isClosed (set)" ALLOWED "$AD" '{
 "zoew_scanner_lookup/it1":{"id":"it1","phone":"012","barcode":"AAA","locker":"L1","isClosed":true,
  "barcodes":[{"code":"AAA","locker":"L1","isClosed":true},{"code":"BBB","locker":"L2","isClosed":true}]}}'

t "worker writes payload WITHOUT isClosed (fallback)" ALLOWED "$WK" '{
 "zoew_scanner_lookup/it1":{"id":"it1","phone":"012","barcode":"AAA","locker":"L1",
  "barcodes":[{"code":"AAA","locker":"L1"},{"code":"BBB","locker":"L2"}]}}'

t "scanner direct locker write without reservation/mirror" DENIED "$SC" '{
 "zoew_scanner_lookup/it1":{"id":"it1","phone":"012","barcode":"AAA","locker":"L1","isClosed":false,
  "barcodes":[{"code":"AAA","locker":"T7","lockerUpdatedAt":2000,"isClosed":false},{"code":"BBB","locker":"L2","isClosed":true}],
  "lockerUpdatedBy":"s@x.com"}}'

echo
echo "== known-bad writes must still be DENIED (guards against a false pass) =="
t "scanner FLIPS item-level isClosed" DENIED "$SC" '{
 "zoew_scanner_lookup/it1/isClosed":true}'

t "scanner FLIPS a barcode isClosed" DENIED "$SC" '{
 "zoew_scanner_lookup/it1/barcodes/0/isClosed":true}'

t "isClosed as a string, not a boolean" DENIED "$WK" '{
 "zoew_scanner_lookup/it1/isClosed":"yes"}'

t "unknown field still rejected by \$other" DENIED "$WK" '{
 "zoew_scanner_lookup/it1/isDeducted":true}'

t "unknown barcode field still rejected by \$other" DENIED "$WK" '{
 "zoew_scanner_lookup/it1/barcodes/0/cod":5}'

tnoauth "unauthenticated write" DENIED '{
 "zoew_scanner_lookup/it1/isClosed":true}'

echo
echo "pass=$pass fail=$fail"
