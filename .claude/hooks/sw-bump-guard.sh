#!/bin/bash
# Ship rule (CLAUDE.md): every index.html change ships with a sw.js CACHE_NAME bump.
# Runs as a Stop hook (turn may not end in violation) and as a PreToolUse gate on git push.
input=$(cat)
[[ $(printf '%s' "$input" | jq -r '.stop_hook_active // false') == "true" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
BASE=HEAD
git rev-parse --verify -q '@{u}' >/dev/null 2>&1 && BASE='@{u}'

# index.html untouched since last push → nothing to guard.
git diff --quiet "$BASE" -- index.html 2>/dev/null && exit 0
# CACHE_NAME line changed alongside it → bump present, pass.
git diff "$BASE" -- sw.js 2>/dev/null | grep -q '^[+-].*CACHE_NAME' && exit 0

. "$HOME/.leandro-os/bin/caja.sh" 2>/dev/null || caja() { :; }
CAJA_SRC="archivo"
caja guard.block '{"rule":"sw-cache-bump"}' error
echo "SHIP RULE VIOLATION: index.html changed (vs $BASE) but sw.js CACHE_NAME is unbumped — clients will pin the old shell (Jul 10 incident). If you made the index.html change: bump CACHE_NAME now (e.g. archivo-v17 -> archivo-v18), then retry. If the change predates your turn (Leandro's own in-progress edit): do NOT bump; flag it to him instead." >&2
exit 2
