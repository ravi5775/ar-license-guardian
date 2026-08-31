#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p00 "Repository Integrity"
cd "$AUDIT_ROOT"
fail=0
tracked_env=$(git ls-files | grep -E '(^|/)\.env$' || true)
[ -z "$tracked_env" ] || { blocker "a .env file is tracked in git: $tracked_env"; fail=1; }
grep -qE '^\.env$|^\.env(\s|$)|^\*\*/\.env$' .gitignore 2>/dev/null || { blocker ".env is not listed in .gitignore"; fail=1; }
big=$(git ls-files -z | xargs -0 -I{} du -k "{}" 2>/dev/null | awk '$1>5120{print $2}' | head -5)
[ -z "$big" ] || note "large tracked files (>5MB): $(echo "$big" | tr '\n' ' ')"
dirty=$(git status --porcelain | wc -l | tr -d ' ')
metric trackedFiles "$(git ls-files | wc -l | tr -d ' ')"
metric dirtyPaths "$dirty"
metric_str branch "$(git rev-parse --abbrev-ref HEAD)"
metric largeFiles "$(echo "$big" | grep -c . || echo 0)"
[ "$fail" -eq 0 ] && emit PASS || emit FAIL
