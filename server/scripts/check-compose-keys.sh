#!/usr/bin/env bash
# Renders each compose stack and asserts every keyed service receives the
# API_KEY / ADMIN_KEY the caller supplied. Runs without a Docker daemon.
#
# Guards lattice-hub#122: the orchestrator used to be missing ADMIN_KEY in the
# real stack and had both keys hardcoded to "dev" in the stub overlay, so it
# disagreed with dashboard / artist-portal on what key to accept.
#
# Also checks the native-orchestrator overlay (docker-compose.native.yml) still
# points dashboard / artist-portal at the host and no longer waits on the
# orchestrator container.
set -euo pipefail
cd "$(dirname "$0")/.."

PROBE_API=probe-api-key
PROBE_ADMIN=probe-admin-key

render() {
  API_KEY=$PROBE_API ADMIN_KEY=$PROBE_ADMIN docker compose "$@" config --format json
}

# check_keys LABEL RENDERED SERVICE... — every listed service must carry both
# probe keys; sidecar (admin-only) is always checked.
check_keys() {
  local label=$1 rendered=$2 fail=0 svc key want got
  shift 2
  for svc in "$@"; do
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
  return $fail
}

check_stack() {
  local label=$1 rendered
  shift
  rendered=$(render "$@") || { echo "FAIL [$label] compose config did not render"; return 1; }
  check_keys "$label" "$rendered" orchestrator dashboard artist-portal || return 1
  echo "ok   [$label]"
}

check_native() {
  local label=native rendered fail=0 svc got
  rendered=$(render -f docker-compose.yml -f docker-compose.native.yml) \
    || { echo "FAIL [$label] compose config did not render"; return 1; }
  check_keys "$label" "$rendered" dashboard artist-portal || fail=1
  for svc in dashboard artist-portal; do
    # compose normalises extra_hosts to a "host=target" list
    got=$(jq -r --arg s "$svc" '.services[$s].extra_hosts // [] | index("orchestrator=host-gateway") // "missing"' <<<"$rendered")
    if [ "$got" = "missing" ]; then
      echo "FAIL [$label] $svc.extra_hosts lacks orchestrator=host-gateway"
      fail=1
    fi
  done
  got=$(jq -r '.services.dashboard.depends_on // {} | length' <<<"$rendered")
  if [ "$got" != "0" ]; then
    echo "FAIL [$label] dashboard.depends_on has $got entries (want 0: the orchestrator container never becomes healthy here)"
    fail=1
  fi
  # A profiled-out service is dropped from the rendered config entirely.
  got=$(jq -r '.services | has("orchestrator")' <<<"$rendered")
  if [ "$got" != "false" ]; then
    echo "FAIL [$label] orchestrator container would still start (want it behind a profile so plain \`up\` skips it)"
    fail=1
  fi
  [ $fail -eq 0 ] && echo "ok   [$label]"
  return $fail
}

rc=0
check_stack "real"      -f docker-compose.yml || rc=1
check_stack "stub"      -f docker-compose.yml -f docker-compose.stub.yml || rc=1
check_stack "stub-seed" -f docker-compose.yml -f docker-compose.stub.yml -f docker-compose.stub.seed.yml || rc=1
check_native || rc=1
exit $rc
