#!/usr/bin/env bash
# src/mcp/vice/resources/vice-launcher.sh
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
# --print-paths, and (new below) 4 when no interpreter this launcher is
# willing to exec into could be resolved -- distinct from 2/3 so a triage
# reader can tell "no usable interpreter" from "container guard refused"
# at a glance.
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
# location, `src/mcp/vice/resources/` -- four levels below the repo root,
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
#      `resources` (matching `<root>/src/mcp/vice/resources`),
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

# ---------------------------------------------------------------- interpreter resolution
#
# WHY THIS EXISTS: this launcher used to `exec node ...`, trusting whatever
# `node` a shell's PATH resolved first. On a development host with several
# Node majors installed side by side that is an accident waiting to happen,
# and a service environment (a systemd unit's own PATH, carrying no
# interactive-shell version-manager entry) resolves a DIFFERENT one than an
# interactive shell -- the same script started two different ways running
# two different interpreters, with no record of which. Nothing spawns this
# script (the broker never spawns itself; the only thing that ever prints
# this path is a message telling a HUMAN to run it), so there is no parent
# process whose own interpreter this launcher could inherit or receive as an
# argument -- the ladder below, plus a refusal, is the whole of it.
#
# NODE_FLOOR_MAJOR mirrors src/mcp/vice/package.json's `engines.node` --
# pinned to that single number by a test (host-scripts.test.ts) precisely so
# this floor cannot silently drift into a second, disagreeing number, which
# is the same failure class as the bare-interpreter exec this section
# replaces.
NODE_FLOOR_MAJOR=24

# probe_node_version <candidate-path>
#
# On success, sets NODE_RESOLVED_VERSION (the raw "vX.Y.Z" string) and
# NODE_RESOLVED_MAJOR (just the leading number) and returns 0. On any
# failure -- not executable, crashes, or prints something this launcher
# cannot parse as a version -- returns 1 and sets neither. Called only from
# inside an `if`, so a failure here becomes a named refusal downstream
# rather than aborting the whole script under `set -e`.
probe_node_version() {
  local candidate="$1" raw major
  if ! raw="$("$candidate" --version 2>/dev/null)"; then
    return 1
  fi
  case "$raw" in
    v[0-9]*) : ;;
    *) return 1 ;;
  esac
  major="${raw#v}"
  major="${major%%.*}"
  case "$major" in
    ''|*[!0-9]*) return 1 ;;
  esac
  NODE_RESOLVED_VERSION="$raw"
  NODE_RESOLVED_MAJOR="$major"
  return 0
}

# Resolution ladder -- exactly two rungs, then a refusal. There is no third
# rung to invent: see the WHY note above for why the broker's own
# interpreter can never be threaded in as a candidate.
#
#   1. VICE_BROKER_NODE, an absolute-path override, accepted only when it
#      names an executable file -- this is the rung that fixes a service
#      unit whose PATH carries no usable node at all: point it at one
#      directly instead of depending on PATH.
#   2. `node` as found on PATH.
NODE_BIN=""
NODE_VERSION=""
NODE_MAJOR=""
NODE_RESOLUTION_ERROR=""

if [ -n "${VICE_BROKER_NODE:-}" ]; then
  if [ -f "${VICE_BROKER_NODE}" ] && [ -x "${VICE_BROKER_NODE}" ]; then
    if probe_node_version "$VICE_BROKER_NODE"; then
      NODE_BIN="$VICE_BROKER_NODE"
      NODE_VERSION="$NODE_RESOLVED_VERSION"
      NODE_MAJOR="$NODE_RESOLVED_MAJOR"
    else
      NODE_RESOLUTION_ERROR="VICE_BROKER_NODE is set to '$VICE_BROKER_NODE', but running it with --version failed or produced output this launcher could not parse. Set VICE_BROKER_NODE to an absolute path to a working node executable, or unset it to fall back to node on PATH."
    fi
  else
    NODE_RESOLUTION_ERROR="VICE_BROKER_NODE is set to '$VICE_BROKER_NODE', which does not resolve to an executable file. Set VICE_BROKER_NODE to an absolute path to an executable node interpreter, or unset it to fall back to node on PATH."
  fi
else
  NODE_CANDIDATE="$(command -v node 2>/dev/null || true)"
  if [ -n "$NODE_CANDIDATE" ]; then
    if probe_node_version "$NODE_CANDIDATE"; then
      NODE_BIN="$NODE_CANDIDATE"
      NODE_VERSION="$NODE_RESOLVED_VERSION"
      NODE_MAJOR="$NODE_RESOLVED_MAJOR"
    else
      NODE_RESOLUTION_ERROR="Resolved 'node' on PATH at '$NODE_CANDIDATE', but running it with --version failed or produced output this launcher could not parse. Install a working Node >= v${NODE_FLOOR_MAJOR} and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one."
    fi
  else
    NODE_RESOLUTION_ERROR="No 'node' executable was found on PATH and VICE_BROKER_NODE is not set. Install Node >= v${NODE_FLOOR_MAJOR} and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one."
  fi
fi

# ---------------------------------------------------------------- --print-paths
#
# Prints already-resolved variables only -- writes no state and spawns
# nothing beyond the version probe above, so (like vice-broker.sh's own
# --print-paths) it needs no guard enforcement to report what this launcher
# would use. Checked BEFORE --check-container is forwarded, since
# --print-paths needs no guard verdict at all, and BEFORE the floor is
# enforced below: this diagnostic reports what it found, or reports it
# found nothing, but never refuses -- a diagnostic that dies exactly when
# the thing it diagnoses is broken is worthless.
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
  echo "node_bin=$NODE_BIN"
  echo "node_version=$NODE_VERSION"
  exit 0
fi

# ---------------------------------------------------------------- interpreter gate
#
# Refuses BEFORE exec, by name, with a remedy -- a below-floor or
# unresolvable interpreter must never reach the broker artifact, because
# once it does, whatever fails next presents as a wedge with no obvious
# cause. This project detects and refuses by name; it never installs
# anything and never shells out to a package manager.
if [ -z "$NODE_BIN" ]; then
  printf 'vice-launcher: refusing to start -- %s\n' "$NODE_RESOLUTION_ERROR" >&2
  exit 4
fi

if [ "$NODE_MAJOR" -lt "$NODE_FLOOR_MAJOR" ]; then
  printf 'vice-launcher: refusing to start -- resolved node interpreter %s reports %s, which is below the required floor v%s.x. Install a Node >= v%s and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one that satisfies the floor.\n' \
    "$NODE_BIN" "$NODE_VERSION" "$NODE_FLOOR_MAJOR" "$NODE_FLOOR_MAJOR" >&2
  exit 4
fi

# ---------------------------------------------------------------- exec
#
# The guard now runs INSIDE the Node entry point, at its own process
# startup, before any state is read or written and before anything is
# spawned -- both --check-container (exit 3, reporting) and the plain
# enforcement path (exit 2, refusal) are the broker's own job now. This
# launcher forwards every argument, including --repo-root, unchanged, and
# no longer inspects --check-container itself; the exit-code contract this
# launcher always exposed (2/3/0, now also 4) is preserved because the guard
# functions ported into container-guard.mts return the SAME codes
# container_guard_enforce()/container_guard_report() always did. Signal
# delivery still passes straight through to the broker process with no bash
# trap in between -- exec replaces the process image with the RESOLVED
# interpreter, never a bare command name, so the interpreter this launcher
# actually gated is the one that actually runs.
exec "$NODE_BIN" "$BROKER_ARTIFACT" --repo-root "$REPO_ROOT" "$@"
