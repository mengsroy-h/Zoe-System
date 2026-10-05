#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
SERVICES=(audit-1 audit-2 audit-3 audit-4)
docker compose version >/dev/null
docker image inspect zoe-actions-runner:local >/dev/null
read -rsp 'បញ្ចូល registration token ពី GitHub Settings > Actions > Runners: ' ZOE_REG_TOKEN
printf '\n'
test -n "$ZOE_REG_TOKEN"
trap 'unset ZOE_REG_TOKEN' EXIT
for SERVICE in "${SERVICES[@]}"; do
  printf 'ចុះឈ្មោះ %s\n' "$SERVICE"
  printf '%s\n' "$ZOE_REG_TOKEN" | docker compose run --rm -T --no-deps \
    --entrypoint /bin/bash "$SERVICE" -c '
      set -euo pipefail
      if [ -f .runner ]; then
        echo "runner នេះមាន config រួចហើយ។"
        exit 0
      fi
      IFS= read -r token
      ./config.sh --unattended \
        --url https://github.com/mengsroy-h/Zoe-System \
        --token "$token" --name "$RUNNER_NAME" \
        --labels "$RUNNER_LABELS" --work _work
      unset token
    '
done
