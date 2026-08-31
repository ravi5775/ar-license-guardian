#!/usr/bin/env bash
# Shared helpers for the Aether AR evidence-gated audit pipeline (P00-P20).
#
# Contract every stage script honours:
#   exit 0 = PASS · exit 1 = FAIL · exit 2 = NOT_VERIFIED
#
# A stage may only report PASS when a real tool ran and produced evidence.
# Missing tool/credential => NOT_VERIFIED, never a fabricated PASS.

set -uo pipefail

AUDIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ARTIFACT_DIR:-$AUDIT_ROOT/artifacts}"
mkdir -p "$ARTIFACT_DIR"

STAGE_ID=""
STAGE_NAME=""
STAGE_START_MS=0
declare -a STAGE_METRICS=()
declare -a STAGE_BLOCKERS=()
declare -a STAGE_ARTIFACTS=()

now_ms() { date +%s%3N 2>/dev/null || echo $(( $(date +%s) * 1000 )); }

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

# jq if present, otherwise the bundled node polyfill.
jqc() {
  if command -v jq >/dev/null 2>&1; then jq "$@"; else
    node "$AUDIT_ROOT/scripts/audit/jq-compat.mjs" "$@"
  fi
}

stage_init() {
  STAGE_ID="$1"; STAGE_NAME="$2"; STAGE_START_MS="$(now_ms)"
  STAGE_METRICS=(); STAGE_BLOCKERS=(); STAGE_ARTIFACTS=()
  echo "── ${STAGE_ID} · ${STAGE_NAME}"
}

# metric <key> <json-value>
metric() { STAGE_METRICS+=("$(json_escape "$1"):$2"); }
# metric_str <key> <string>
metric_str() { STAGE_METRICS+=("$(json_escape "$1"):$(json_escape "$2")"); }
blocker() { STAGE_BLOCKERS+=("$(json_escape "$1")"); echo "   ✗ $1"; }
artifact() { STAGE_ARTIFACTS+=("$(json_escape "$1")"); }
note() { echo "   · $1"; }

join_by() { local IFS="$1"; shift; echo "$*"; }

# emit <PASS|FAIL|NOT_VERIFIED>
emit() {
  local status="$1"
  local commit; commit="$(git -C "$AUDIT_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
  local dur=$(( $(now_ms) - STAGE_START_MS ))
  local out="$ARTIFACT_DIR/${STAGE_ID}-result.json"
  {
    printf '{\n'
    printf '  "stage": %s,\n' "$(json_escape "$STAGE_ID")"
    printf '  "name": %s,\n' "$(json_escape "$STAGE_NAME")"
    printf '  "status": %s,\n' "$(json_escape "$status")"
    printf '  "commit": %s,\n' "$(json_escape "$commit")"
    printf '  "startedAt": %s,\n' "$(json_escape "$(date -u -d "@$((STAGE_START_MS/1000))" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)")"
    printf '  "durationMs": %s,\n' "$dur"
    printf '  "metrics": {%s},\n' "$(join_by , "${STAGE_METRICS[@]:-}")"
    printf '  "blockers": [%s],\n' "$(join_by , "${STAGE_BLOCKERS[@]:-}")"
    printf '  "artifacts": [%s]\n' "$(join_by , "${STAGE_ARTIFACTS[@]:-}")"
    printf '}\n'
  } > "$out"
  echo "   → $status  ($out)"
  case "$status" in
    PASS) exit 0 ;;
    FAIL) exit 1 ;;
    *)    exit 2 ;;
  esac
}

# not_verified "<reason>" — the only correct outcome for a missing tool/credential.
not_verified() { blocker "$1"; emit NOT_VERIFIED; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || not_verified "required tool not installed: $1 ($2)"
}

require_env() {
  local name="$1"
  [ -n "${!name:-}" ] || not_verified "required environment variable not set: $name ($2)"
}
