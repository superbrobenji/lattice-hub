#!/usr/bin/env bash
# Renders each compose stack and asserts every keyed service receives the
# API_KEY / ADMIN_KEY the caller supplied. Runs without a Docker daemon.
#
# Guards lattice-hub#122: the orchestrator used to be missing ADMIN_KEY in the
# real stack and had both keys hardcoded to "dev" in the stub overlay, so it
# disagreed with dashboard / artist-portal on what key to accept.
set -euo pipefail
cd "$(dirname "$0")/.."

PROBE_API=probe-api-key
PROBE_ADMIN=probe-admin-key

check_stack() {
  local label=$1; shift
  local rendered fail=0 svc key want got
  rendered=$(API_KEY=$PROBE_API ADMIN_KEY=$PROBE_ADMIN docker compose "$@" config --format json)

  for svc in orchestrator dashboard artist-portal; do
    for key in API_KEY ADMIN_KEY; do
      [ "$key" = API_KEY ] && want=$PROBE_API || want=$PROBE_ADMIN
      got=$(jq -r --arg s "$svc" --arg k "$key" '.services[$s].environment[$k] // "<unset>"' <<<"$rendered")
      if [ "$got" != "$want" ]; then
        echo "FAIL [$label] $svc.$key = $got (want $want)"
        fail=1
      fi
    done
  done

  got=$(jq -r '.services.sidecar.environment.ADMIN_KEY // "<unset>"' <<<"$rendered")
  if [ "$got" != "$PROBE_ADMIN" ]; then
    echo "FAIL [$label] sidecar.ADMIN_KEY = $got (want $PROBE_ADMIN)"
    fail=1
  fi

  [ $fail -eq 0 ] && echo "ok   [$label]"
  return $fail
}

rc=0
check_stack "real"      -f docker-compose.yml || rc=1
check_stack "stub"      -f docker-compose.yml -f docker-compose.stub.yml || rc=1
check_stack "stub-seed" -f docker-compose.yml -f docker-compose.stub.yml -f docker-compose.stub.seed.yml || rc=1
exit $rc
