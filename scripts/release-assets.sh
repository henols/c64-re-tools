#!/usr/bin/env bash
# The ONE seam that stamps the plugin manifests, builds the installable zip,
# and attaches it to a GitHub Release (D-1).
#
# WHY THIS EXISTS: v0.2.0 shipped with `{"assets": []}`. The `release` job
# that used to own this work is gated `startsWith(github.ref, 'refs/tags/v')`,
# but `release-on-merge` creates its tag with a `GITHUB_TOKEN`, which by
# GitHub's design does NOT re-trigger workflows -- so on the merge path
# `release` can never run. Both release paths need the same three steps
# (stamp manifests -> build zip -> attach assets); this script is the one
# place that does them, called by both (quick-260819-vie D-1).
#
# WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: stamping the six R-2 derived
# version strings, building `dist/<name>-<version>.zip` from a committed ref,
# and uploading it (+ its .sha256 sidecar) to the matching GitHub Release.
#
# WHAT NOT TO DO:
#   - Do not copy these three steps back into a CI job. That is exactly the
#     "re-deriving a cross-cutting seam locally" anti-pattern CLAUDE.md names.
#   - Do not read the version from GITHUB_REF_NAME, GITHUB_SHA or VERSION
#     inside this script (D-2) -- it always arrives as an explicit argument.
#   - Do not stamp in the caller's own working tree -- this script stamps
#     inside a throwaway detached worktree and never touches the caller's
#     HEAD, index or working tree.
#   - Do not upload with a `dist/*.zip` glob -- a local `dist/` accumulates
#     other versions (this checkout's held 0.0.0-dev, 0.1.1 and 9.9.9 zips
#     during planning); always compute and upload the exact filename.
set -euo pipefail

fail() { echo "release-assets: ERROR: $*" >&2; exit 1; }
note() { echo "release-assets: $*"; }

usage() {
  cat >&2 <<'USAGE'
usage: release-assets.sh <version> [<ref>] [--dry-run]

  <version>   REQUIRED, bare semver, no leading "v" (e.g. 0.2.0).
  <ref>       OPTIONAL git ref to build from (default: HEAD).
  --dry-run   Build and self-verify, print what would be uploaded, and exit
              0 without calling `gh` at all.
USAGE
}

# --- 1. Arg scan ----------------------------------------------------------
DRY_RUN=0
POSITIONALS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    --*)
      usage
      fail "unknown flag: $arg"
      ;;
    *)
      POSITIONALS+=("$arg")
      ;;
  esac
done

if [ "${#POSITIONALS[@]}" -gt 2 ]; then
  usage
  fail "too many positional arguments: ${POSITIONALS[*]}"
fi

VERSION="${POSITIONALS[0]:-}"
REF="${POSITIONALS[1]:-HEAD}"

# --- 2. Validate VERSION ----------------------------------------------------
if [ -z "$VERSION" ]; then
  usage
  fail "VERSION is required"
fi
if [[ "$VERSION" == v* ]]; then
  fail "pass 0.2.0, not v0.2.0 -- the tag is derived from the version (got: $VERSION)"
fi
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  fail "VERSION must be a bare semver like 0.2.0 (got: $VERSION)"
fi
TAG="v$VERSION"

# --- 3. Preflight tool availability ----------------------------------------
for tool in git node unzip sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is required"
done
if [ "$DRY_RUN" -eq 0 ]; then
  command -v gh >/dev/null 2>&1 || fail "gh is required (or pass --dry-run)"
fi

# --- 4. Resolve root + ref ---------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git work tree"
git rev-parse --verify "${REF}^{commit}" >/dev/null 2>&1 || fail "ref does not resolve to a commit: $REF"

# --- 5. Throwaway detached worktree, with an EXIT trap that always cleans up
#        (this is what keeps a local run from leaving a worktree registration
#        or a stray commit behind, per design decision 2) -----------------
TMPROOT="$(mktemp -d)"
WT="$TMPROOT/wt"

cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  git -C "$ROOT" worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMPROOT"
}
trap cleanup EXIT

git worktree add --detach "$WT" "$REF" >/dev/null

# --- 6. Stamp the worktree's own copy of the manifests ----------------------
node "$WT/scripts/version.mjs" stamp "$VERSION"

# --- 7. Empty-commit guard (Q2a): `git commit -am` exits non-zero when there
#        is nothing staged, which under `set -e` would abort the seam AFTER
#        stamping and BEFORE zipping for a state that is actually correct --
#        <ref>'s six derived strings already equalled <version>. Guard it
#        explicitly instead of letting `set -e` treat "nothing to commit" as
#        a hard failure. -------------------------------------------------
if git -C "$WT" diff --quiet; then
  note "manifests at $REF already read $VERSION -- nothing to commit"
else
  git -C "$WT" \
    -c user.name="github-actions[bot]" \
    -c user.email="github-actions[bot]@users.noreply.github.com" \
    commit -am "chore: stamp v$VERSION into plugin manifests (ephemeral, never pushed)" >/dev/null
fi

# --- 8. Build the zip from the worktree's own package.sh --------------------
bash "$WT/scripts/package.sh"

# --- 9. Locate the built artifact by exact name, never a glob (a local
#        dist/ accumulates other versions) ---------------------------------
NAME="$(node -p "require('$WT/.claude-plugin/plugin.json').name")"
ZIP="$WT/dist/${NAME}-${VERSION}.zip"
[ -f "$ZIP" ] || fail "expected artifact not found: $ZIP"
[ -f "$ZIP.sha256" ] || fail "expected sidecar not found: $ZIP.sha256"

# --- 10. Fail-closed self-check -- the defect class this task exists to kill:
#         prove the artifact's OWN internal manifests read $VERSION, not just
#         that the filename does. ------------------------------------------
PLUGIN_JSON_VERSION="$(unzip -p "$ZIP" "${NAME}-${VERSION}/.claude-plugin/plugin.json" | node -e '
  const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(j.version);
')"
if [ "$PLUGIN_JSON_VERSION" != "$VERSION" ]; then
  fail "zip's .claude-plugin/plugin.json version is '$PLUGIN_JSON_VERSION', expected '$VERSION'"
fi

MARKETPLACE_CHECK="$(unzip -p "$ZIP" "${NAME}-${VERSION}/.claude-plugin/marketplace.json" | node -e '
  const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(j.version + " " + (j.plugins && j.plugins[0] && j.plugins[0].version));
')"
MARKETPLACE_VERSION="${MARKETPLACE_CHECK%% *}"
MARKETPLACE_PLUGIN0_VERSION="${MARKETPLACE_CHECK##* }"
if [ "$MARKETPLACE_VERSION" != "$VERSION" ]; then
  fail "zip's .claude-plugin/marketplace.json .version is '$MARKETPLACE_VERSION', expected '$VERSION'"
fi
if [ "$MARKETPLACE_PLUGIN0_VERSION" != "$VERSION" ]; then
  fail "zip's .claude-plugin/marketplace.json .plugins[0].version is '$MARKETPLACE_PLUGIN0_VERSION', expected '$VERSION'"
fi
note "self-check OK: plugin.json and marketplace.json inside the zip both read $VERSION"

# --- 11. Copy into the caller's dist/ so the artifact survives the EXIT trap
mkdir -p "$ROOT/dist"
cp "$ZIP" "$ROOT/dist/"
cp "$ZIP.sha256" "$ROOT/dist/"
ZIP="$ROOT/dist/${NAME}-${VERSION}.zip"

SHA256="$(cut -d' ' -f1 "$ZIP.sha256")"

# --- 12. Dry run stops here --------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  note "dry-run: would attach to release $TAG:"
  note "  artifact : $ZIP"
  note "  sidecar  : $ZIP.sha256"
  note "  sha256   : $SHA256"
  note "no gh call was made (--dry-run)"
  exit 0
fi

# --- 13. D-3 verbatim: create-or-upload, no new branching -------------------
if gh release view "$TAG" >/dev/null 2>&1; then
  note "attaching to existing release $TAG"
  gh release upload "$TAG" "$ZIP" "$ZIP.sha256" --clobber
else
  note "creating release $TAG"
  gh release create "$TAG" "$ZIP" "$ZIP.sha256" --generate-notes --title "$TAG"
fi
