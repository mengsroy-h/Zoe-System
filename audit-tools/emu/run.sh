#!/bin/bash
cd "$(dirname "$0")"
B="http://127.0.0.1:9000"
NS="ns=demo-zoe"
c() { curl -s --noproxy '*' -H "Authorization: Bearer owner" "$@"; }
n() { curl -s --noproxy '*' -H "Authorization: Bearer owner" "$@"; }

echo "load rules: $(c -X PUT "$B/.settings/rules.json?$NS" --data-binary @test.rules.json)"
c -X PUT "$B/user_roles.json?$NS" -d '{"scanUid":"scanner","admUid":"admin"}' > /dev/null
c -X PUT "$B/items/it1.json?$NS" -d '{"barcodes":[{"code":"AAA","cod":5,"locker":"L1"},{"code":"BBB","cod":7,"locker":"L2"}]}' > /dev/null
echo "seeded: $(c "$B/items/it1/barcodes.json?$NS")"

SC='auth_variable_override=%7B%22uid%22%3A%22scanUid%22%7D'
AD='auth_variable_override=%7B%22uid%22%3A%22admUid%22%7D'

t() { # name expected url data
  local out
  out=$(n -X PATCH "$3" -d "$4")
  local got="ALLOWED"
  case "$out" in *"Permission denied"*|*"error"*) got="DENIED";; esac
  local mark="FAIL"
  [ "$got" = "$2" ] && mark=" ok "
  printf '  %s  %-46s expect %-7s got %s\n' "$mark" "$1" "$2" "$got"
}

echo
echo "== does a .validate on barcodes/\$idx run for a child-only write? =="
t "scanner ➜ locker on existing idx0"   ALLOWED "$B/items/it1/barcodes/0.json?$NS&$SC" '{"locker":"L9"}'
t "scanner ➜ OUT-OF-RANGE idx5"         DENIED  "$B/items/it1/barcodes/5.json?$NS&$SC" '{"code":"CCC","locker":"L9"}'
t "scanner ➜ WRONG code at idx1"        DENIED  "$B/items/it1/barcodes/1.json?$NS&$SC" '{"code":"AAA","locker":"L9"}'
t "scanner ➜ correct code at idx1"      ALLOWED "$B/items/it1/barcodes/1.json?$NS&$SC" '{"code":"BBB","locker":"L8"}'
t "admin   ➜ NEW barcode at idx2"       ALLOWED "$B/items/it1/barcodes/2.json?$NS&$AD" '{"code":"CCC","cod":9,"locker":"L3"}'

echo
echo "FINAL: $(c "$B/items/it1/barcodes.json?$NS")"
