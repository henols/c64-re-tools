#!/usr/bin/env bash
# Provision the VICE MCP server's npm dependencies on session start.
#
# The MCP server (src/mcp/vice) has real runtime dependencies (@mastra/mcp,
# @mastra/core). A plugin ships no node_modules, so they must be installed on
# the consumer's machine before the server is first launched. Because the
# server is ESM ("type": "module"), Node resolves bare specifiers by walking up
# from the importing file -- NODE_PATH is NOT consulted for ESM -- so the
# modules have to live next to the source, i.e. in
# `${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/node_modules`, not in a side dir.
#
# We install there, and gate the (slow) `npm ci` on a lockfile hash stamped
# into ${CLAUDE_PLUGIN_DATA} (which survives plugin updates), so a normal
# session start is a cheap hash compare and only a changed lockfile or a wiped
# node_modules triggers a reinstall.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
MCP_DIR="$PLUGIN_ROOT/src/mcp/vice"
LOCK="$MCP_DIR/package-lock.json"

if [ ! -f "$LOCK" ]; then
	echo "ensure-mcp-deps: no package-lock.json at $MCP_DIR -- nothing to install." >&2
	exit 0
fi

# Moved 2026-09-08 (D-33): when CLAUDE_PLUGIN_DATA is unset, the stamp used to
# be written BESIDE the MCP package ($MCP_DIR) -- which, for an installed
# plugin, is the plugin's OWN install directory, not the consumer's project.
# It now lands under the single tool-written root's "cache" subdirectory at
# the CONSUMER's project root (CLAUDE_PROJECT_DIR, the same signal
# repo-root.ts's own branch 0 honours first; PLUGIN_ROOT is the fallback for
# the in-repo, non-plugin dev layout where the two coincide).
# CLAUDE_PLUGIN_DATA still wins over this default when set.
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$PLUGIN_ROOT}"
STAMP_DIR="${CLAUDE_PLUGIN_DATA:-$PROJECT_ROOT/.c64-re-tools/cache}"
mkdir -p "$STAMP_DIR"
STAMP="$STAMP_DIR/mcp-deps.lock.sha256"

want="$(sha256sum "$LOCK" | cut -d' ' -f1)"
have=""
[ -f "$STAMP" ] && have="$(cat "$STAMP" 2>/dev/null || true)"

if [ -d "$MCP_DIR/node_modules" ] && [ "$have" = "$want" ]; then
	exit 0
fi

echo "ensure-mcp-deps: installing VICE MCP dependencies into $MCP_DIR ..." >&2
if ( cd "$MCP_DIR" && npm ci --no-audit --no-fund ); then
	printf '%s' "$want" > "$STAMP"
	echo "ensure-mcp-deps: done." >&2
else
	# Leave no stamp so the next session retries; never block the session.
	rm -f "$STAMP"
	echo "ensure-mcp-deps: npm ci failed -- mcp__plugin_c64-re-tools_vice__* tools will be unavailable until it succeeds." >&2
fi
exit 0
