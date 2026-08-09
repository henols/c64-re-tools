#!/usr/bin/env bash
# .claude/mcp/vice/resources/vice-launcher.sh
#
# HAND-AUTHORED -- not generated. It lives beside the generated vice-broker.mjs
# purely because install-resources.mjs deploys the whole resources/ directory
# as a unit; this is the one file in this directory a maintainer edits
# directly (see ./.claude/CLAUDE.md's Emulator Access three-tier rule).
#
# HOST-ONLY. Phase 01.6.2: the container guard no longer lives in bash here
# -- it ported to TypeScript (container-guard.mts, PD-03) and now runs at
# the BROKER PROCESS's own startup, closing the invocation-scoped hole
# recorded in RE-FINDINGS.md (running the compiled broker directly, bypassing
# this launcher, was previously unguarded). This launcher no longer sources
# the bash guard module or calls its enforce/report functions itself --
# --check-container is now forwarded through to the Node entry point, which
# answers it, preserving the exact same exit-code contract this launcher
# always had: 2 when the guard refuses, 3 for the report path, 0 for
# --print-paths.
#
# Copies vice-broker.sh's own opening shape: SELF_PATH/SELF_DIR resolution,
# resolve_repo_root(). Plan 11 INLINES resolve_repo_root() here (it used to
# live in a small sourced-only library under resources/lib/, one function and
# nothing else) in the same commit that deletes that library directory
# wholesale, the retiring bash broker, the retiring per-instance supervisor,
# and the retiring bash container guard's own sourced module -- the shell
# must resolve its own root before it can construct the command that starts
# the broker, so by the time a Node process exists there is nothing left to
# decide. This is the ONLY place that logic lives now.
set -euo pipefail

SELF_PATH="${BASH_SOURCE[0]}"
SELF_DIR="$(cd "$(dirname "$SELF_PATH")" && pwd)"

# resolve_repo_root() -- inlined from the former sourced-only repo-root
# library (deleted alongside this inline), mirroring repo-root.ts's
# documented ladder (D-2) so the shell and Node halves of this tree can
# never resolve to two different `.vice-supervisor` directories.
#
# WHY THIS FUNCTION EXISTS AT ALL: a fixed `".."` hop (`REPO_ROOT="$(cd
# "$(dirname "$SELF_PATH")/.." && pwd)"`) is wrong from this launcher's own
# location, `.claude/mcp/vice/resources/` -- four levels below the repo root,
# not one. NOTHING would error on a wrong fixed hop count: the script would
# just read a permanently-empty `.vice-supervisor` state directory forever,
# and restart detection would quietly stop working while every command kept
# "succeeding". See repo-root.ts's own header comment for the Node-side
# telling of the same failure class this function exists to prevent.
#
# One-time stderr notes, so a long process (or a test driving this function
# repeatedly) does not spam stderr -- mirrors repo-root.ts's
# warnedEnvOutsideFrom / warnedNoMarkerFound module-level latches.
_REPO_ROOT_WARNED_ENV_OUTSIDE=0
_REPO_ROOT_WARNED_NO_MARKER=0

# resolve_repo_root <absolute-dir>
#
# Prints the resolved repo root for a script whose own directory is
# <absolute-dir>. Precedence, in order (mirrors repo-root.ts's repoRoot()):
#
#   1. CONTAINER_WORKSPACE_PATH, when set AND <absolute-dir> resolves inside
#      it -- this devcontainer sets it, and it is the most explicit signal
#      available.
#   2. Otherwise, walk up from <absolute-dir> toward the filesystem root,
#      returning the first directory containing a `.git` entry (tested with
#      `-e`, so a worktree's `.git` FILE matches just as well as a real
#      `.git` DIRECTORY). This is what keeps the script correct once exported
#      into a project that sets no such variable at all -- the ONLY branch
#      that ever runs on the real host, which sets no such env var.
#   3. Otherwise, CONTAINER_WORKSPACE_PATH if it is set at all (just not
#      containing <absolute-dir> -- an exported copy of this skill living
#      outside the mounted workspace the variable names). Silence here would
#      be exactly the quiet-wrong-answer failure class this function exists
#      to prevent, so this path emits a one-time stderr note naming both
#      paths.
#   4. Otherwise, a location-shaped last resort, also with a one-time stderr
#      note: FOUR levels up when <absolute-dir>'s own directory is named
#      `resources` (matching `<root>/.claude/mcp/vice/resources`),
#      ONE level up otherwise.
resolve_repo_root() {
  local from="$1" dir parent base

  if [ -n "${CONTAINER_WORKSPACE_PATH:-}" ]; then
    case "$from" in
      "$CONTAINER_WORKSPACE_PATH" | "$CONTAINER_WORKSPACE_PATH"/*)
        printf '%s\n' "$CONTAINER_WORKSPACE_PATH"
        return 0
        ;;
    esac
  fi

  dir="$from"
  while :; do
    if [ -e "$dir/.git" ]; then
      printf '%s\n' "$dir"
      return 0
    fi
    parent="$(dirname "$dir")"
    if [ "$parent" = "$dir" ]; then
      break # reached the filesystem root -- no .git found anywhere above $from
    fi
    dir="$parent"
  done

  if [ -n "${CONTAINER_WORKSPACE_PATH:-}" ]; then
    if [ "$_REPO_ROOT_WARNED_ENV_OUTSIDE" -eq 0 ]; then
      _REPO_ROOT_WARNED_ENV_OUTSIDE=1
      echo "warn: CONTAINER_WORKSPACE_PATH is set ($CONTAINER_WORKSPACE_PATH) but does not contain $from, and no .git ancestor was found either -- falling back to CONTAINER_WORKSPACE_PATH itself as the repo root. This is expected for an exported copy of this skill living outside its mounted workspace; if that is not the situation here, the repo root this resolved to may be wrong." >&2
    fi
    printf '%s\n' "$CONTAINER_WORKSPACE_PATH"
    return 0
  fi

  base="$(basename "$from")"
  if [ "$base" = "resources" ]; then
    dir="$(cd "$from/../../../.." && pwd)"
  else
    dir="$(cd "$from/.." && pwd)"
  fi

  if [ "$_REPO_ROOT_WARNED_NO_MARKER" -eq 0 ]; then
    _REPO_ROOT_WARNED_NO_MARKER=1
    echo "warn: could not find a .git ancestor above $from and CONTAINER_WORKSPACE_PATH is not set -- falling back to a location-shaped last resort ($dir). This is a last resort; if it's wrong, set CONTAINER_WORKSPACE_PATH or run from inside a git repo." >&2
  fi
  printf '%s\n' "$dir"
}

REPO_ROOT="$(resolve_repo_root "$SELF_DIR")"

# Resolved as a SIBLING of this running script ($SELF_DIR), matching
# vice-broker.sh's own supervisor-resolution rationale: a launcher run from
# resources/ must launch the resources/ copy, not silently reach across to a
# deployed tools/ copy that may be stale or hand-edited.
BROKER_ARTIFACT="$SELF_DIR/vice-broker.mjs"

# ---------------------------------------------------------------- --print-paths
#
# Prints already-resolved variables only -- writes no state, spawns nothing,
# so (like vice-broker.sh's own --print-paths) it needs no guard enforcement
# to report what this launcher would use. Checked BEFORE --check-container is
# forwarded, since --print-paths needs no guard verdict at all.
PRINT_PATHS=0
for arg in "$@"; do
  case "$arg" in
    --print-paths)
      PRINT_PATHS=1
      ;;
  esac
done

if [ "$PRINT_PATHS" -eq 1 ]; then
  echo "repo_root=$REPO_ROOT"
  echo "self_dir=$SELF_DIR"
  echo "broker_artifact=$BROKER_ARTIFACT"
  exit 0
fi

# ---------------------------------------------------------------- exec
#
# The guard now runs INSIDE the Node entry point, at its own process
# startup, before any state is read or written and before anything is
# spawned -- both --check-container (exit 3, reporting) and the plain
# enforcement path (exit 2, refusal) are the broker's own job now. This
# launcher forwards every argument, including --repo-root, unchanged, and
# no longer inspects --check-container itself; the exit-code contract this
# launcher always exposed (2/3/0) is preserved because the guard functions
# ported into container-guard.mts return the SAME codes
# container_guard_enforce()/container_guard_report() always did. Signal
# delivery still passes straight through to the broker process with no bash
# trap in between.
exec node "$BROKER_ARTIFACT" --repo-root "$REPO_ROOT" "$@"
