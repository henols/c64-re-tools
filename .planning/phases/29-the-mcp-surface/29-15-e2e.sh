#!/usr/bin/env bash
# ===========================================================================
# 29-15-e2e.sh -- proof that the `render-memmap` line DOCUMENTED in
# src/skills/c64-program-recon/SKILL.md actually RUNS.
# ===========================================================================
#
# WHY THIS EXISTS: phase 29 verification gap 2 / 29-REVIEW.md CR-04. Both
# shipped playbooks documented `anno render-memmap game.regen2000proj`, a
# positional the store opener plan 29-12 gave this verb refuses with exit 1 --
# and `scripts/check-skill-tool-coverage.mjs` exited 0 the whole time, because
# it resolves tool and verb NAMES and never an invocation's ARGUMENTS. A
# name-only gate cannot tell a live command from a dead one, so the property
# has to be established by RUNNING the documented text.
#
# WHAT IT IS THE ONE AUTHORITATIVE PLACE FOR: the end-to-end liveness of the
# documented invocation. It EXTRACTS the command from SKILL.md rather than
# restating it -- a restated command proves only that this script's author can
# type a working one.
#
# WHAT NOT TO DO:
#   1. Do not retype the invocation here. The property under test is that the
#      DOCUMENTED text runs.
#   2. Do not run the `npx` route: it would fetch from the registry. The
#      in-repo `node .../vice-proxy.ts` route is the same command.
#   3. Do not use a system tmpdir for the fixture. `storePathWithinWorkspace()`
#      against `repoRoot()` refuses one BY DESIGN (T-29-28); that refusal is the
#      mitigation, not an inconvenience to route around. `anno-cli.test.ts`'s
#      `withWorkspaceTempDir()` uses `mkdtempSync(join(HERE, ".anno-cli-test-"))`
#      for the same reason -- this copies that placement.
#   4. Do not let the extraction fail silently. An extraction that matches
#      nothing yields the empty string and STILL exits 0 through a pipeline, so
#      the script would run a degenerate command and report its failure as "the
#      documented command does not work" -- a wrong diagnosis of the exact
#      property this script exists to establish, reached by a route that looks
#      like a real red. The EXTRACTION ASSERTION below fires before anything is
#      run, and names the count, the file and the two match terms. Step 4's
#      row-count and digest assertions BACKSTOP it; they do not substitute for
#      it, because they fire late and name the wrong cause.
#
# LOCATION: this file lives under `.planning/`, deliberately. It greps for the
# retired vocabulary by name, and `scripts/check-no-regenerator2000.mjs`'s
# scope is `git ls-files` minus the `.planning/` PREFIX -- so no allow-list
# entry is needed and that gate's "temporary allow-list is empty" assertion
# stays true. Its `phasePlanIds()` reader of this directory filters
# `^29-\d{2}-PLAN\.md$`, so this file is invisible to that too. Promoting this
# script into the scanned tree would require an allow-list entry.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SKILL="src/skills/c64-program-recon/SKILL.md"
TEMPLATE="src/skills/c64-program-recon/templates/memory-map.template.md"

FIXTURE_DIR=""
DEPS_LINK=""
cleanup() {
  if [ -n "$FIXTURE_DIR" ] && [ -d "$FIXTURE_DIR" ]; then
    rm -rf "$FIXTURE_DIR"
  fi
  # Only ever removes a symlink THIS script created (see the deps bootstrap
  # below); never a real, populated node_modules directory.
  if [ -n "$DEPS_LINK" ] && [ -L "$DEPS_LINK" ]; then
    rm -f "$DEPS_LINK"
  fi
}
trap cleanup EXIT INT TERM

# --- 0. Dependency bootstrap. ----------------------------------------------
# `vice-proxy.ts` static-imports `@mastra/mcp` at module scope, ABOVE the
# `process.argv[2] === "anno"` dispatch, so the CLI route needs the MCP
# package's node_modules present even though the CLI itself never touches
# Mastra. `src/mcp/vice/node_modules` is gitignored and provisioned by
# `scripts/ensure-mcp-deps.sh` on SessionStart -- which means it is ABSENT in a
# freshly-created git worktree, and the documented command would then fail with
# ERR_MODULE_NOT_FOUND for a reason that has nothing to do with the invocation
# under test. Borrow the main checkout's tree rather than running any
# package-manager install (a network fetch, and explicitly not an auto-fixable
# step), and remove the borrowed link again on exit so the worktree is left
# exactly as found.
#
# TWO DETAILS THAT LOOK LIKE OVER-ENGINEERING AND ARE NOT:
#   - The probe is for `@mastra/mcp` ITSELF, never for the node_modules
#     DIRECTORY. `npm run` creates a bare `src/mcp/vice/node_modules/.cache`
#     (and `.bin`) as a side effect, so a directory-existence probe reports
#     "deps present" over a tree with no packages in it at all -- which is the
#     exact false-green this bootstrap exists to avoid.
#   - The link goes at the WORKTREE ROOT, not over `src/mcp/vice/node_modules`.
#     Node's resolver walks EVERY ancestor's node_modules, so a root-level link
#     is found after the (possibly npm-stubbed) package-local one misses --
#     and nothing that already exists has to be moved aside or restored.
MAIN_ROOT="$(cd "$(dirname "$(git rev-parse --git-common-dir)")" && pwd)"
if [ ! -d "src/mcp/vice/node_modules/@mastra/mcp" ] && [ ! -d "node_modules/@mastra/mcp" ]; then
  if [ -d "$MAIN_ROOT/src/mcp/vice/node_modules/@mastra/mcp" ]; then
    ln -s "$MAIN_ROOT/src/mcp/vice/node_modules" "node_modules"
    DEPS_LINK="node_modules"
    echo "29-15-e2e: borrowed node_modules from ${MAIN_ROOT}/src/mcp/vice (temporary root-level symlink)"
  else
    echo "29-15-e2e: FAIL -- @mastra/mcp is not installed here and no main-checkout copy was found at" >&2
    echo "29-15-e2e:   ${MAIN_ROOT}/src/mcp/vice/node_modules/@mastra/mcp" >&2
    echo "29-15-e2e: Run scripts/ensure-mcp-deps.sh (or 'npm ci' in src/mcp/vice) first." >&2
    echo "29-15-e2e: This is the BOOTSTRAP being incomplete, NOT the documented command failing." >&2
    exit 4
  fi
fi

# --- 1. In-tree fixture directory (see WHAT NOT TO DO #3). -----------------
FIXTURE_DIR="$(mktemp -d "$PWD/src/mcp/vice/.anno-e2e-XXXXXX")"
FIXTURE_REL="${FIXTURE_DIR#"$PWD"/}"
STORE_REL="$FIXTURE_REL/game.annostore"
SIDECAR_REL="$FIXTURE_REL/sidecar.json"

# --- 2. A REAL annotation store and a REAL provenance sidecar. -------------
# The store is built the way anno-cli.test.ts builds one: openStore() with an
# explicit workspaceRoot, then closeStore() in a `finally`.
node --input-type=module -e "
import { openStore, closeStore, setLabel, setComment, setDataType } from './src/mcp/vice/anno-store.ts';
import { repoRoot } from './src/mcp/vice/repo-root.ts';
const handle = openStore('${STORE_REL}', { workspaceRoot: repoRoot() });
try {
  setDataType(handle, { start: 0x1000, endInclusive: 0x10ff, dataType: 'code' });
  setLabel(handle, { address: 0x1000, name: 'irq_handler', kind: 'User' });
  setComment(handle, { address: 0x1000, commentType: 'line', text: '[confirmed-code] raster IRQ entry, observed live' });
  setDataType(handle, { start: 0x2000, endInclusive: 0x20ff, dataType: 'byte' });
  setLabel(handle, { address: 0x2000, name: 'sprite_table', kind: 'User' });
  setComment(handle, { address: 0x2000, commentType: 'line', text: '[probable-data] indexed-load target' });
} finally {
  closeStore(handle);
}
"

# The sidecar's shape is the schema documented in the copy-forward template;
# the values are that template's own filled example.
cat > "$SIDECAR_REL" <<'JSON'
{
  "capturePath": "captures/game.raw",
  "captureSha256": "3f8a1c9e2b7d4a6f0c5e8b2d9a1f4c7e6b3d0a9c8f5e2b1d4a7c0f3e6b9d2a5c",
  "port01": "$40",
  "dd00": "$06",
  "vicBank": "1 ($4000-$7FFF)",
  "screenRam": "$0400",
  "charsetOrBitmap": "$1000 (ROM shadow)",
  "mode": "text, multicolor off",
  "videoStandard": "PAL",
  "liveVectorPair": "$FFFE/$FFFF",
  "vectorHandler": "$1103",
  "rasterPositions": ["$F8", "$00"]
}
JSON

# --- 3. EXTRACT the documented in-repo invocation, and ASSERT the ----------
#        extraction BEFORE anything runs (see WHAT NOT TO DO #4).
MATCH_A="vice-proxy.ts"
MATCH_B="render-memmap"
EXTRACTED="$(grep -F "$MATCH_A" "$SKILL" | grep -F "$MATCH_B" | grep -v '^[[:space:]]*$' || true)"
EXTRACTED_COUNT="$(printf '%s' "$EXTRACTED" | grep -c . || true)"

if [ "$EXTRACTED_COUNT" -ne 1 ]; then
  echo "29-15-e2e: EXTRACTION FAILED -- expected exactly 1 non-empty line, found ${EXTRACTED_COUNT}." >&2
  echo "29-15-e2e:   file searched: ${SKILL}" >&2
  echo "29-15-e2e:   match terms:   '${MATCH_A}' AND '${MATCH_B}'" >&2
  echo "29-15-e2e: This is the EXTRACTOR being broken, NOT the documented command failing." >&2
  echo "29-15-e2e: Do not read this as 'render-memmap does not work'." >&2
  exit 3
fi

# Substitute only the plugin-root placeholder and the two argument paths. The
# verb, the subcommand and the flag names come from the playbook verbatim.
CMD="${EXTRACTED//<plugin-root>/.}"
CMD="${CMD//game.annostore/$STORE_REL}"
CMD="${CMD//sidecar.json/$SIDECAR_REL}"

echo "29-15-e2e: extracted from ${SKILL}:"
echo "29-15-e2e:   ${EXTRACTED}"
echo "29-15-e2e: running:"
echo "29-15-e2e:   ${CMD}"

# --- 4. Run it. Exit 0 plus three INDEPENDENT transcript assertions. -------
set +e
OUTPUT="$(eval "$CMD" 2>&1)"
STATUS=$?
set -e
echo "29-15-e2e: transcript:"
echo "${OUTPUT}"

if [ "$STATUS" -ne 0 ]; then
  echo "29-15-e2e: FAIL -- the DOCUMENTED command exited ${STATUS}" >&2
  exit 1
fi
echo "$OUTPUT" | grep -Eq 'row\(s\)'            || { echo "29-15-e2e: FAIL -- transcript carries no row count" >&2; exit 1; }
echo "$OUTPUT" | grep -Fq '[unknown]'           || { echo "29-15-e2e: FAIL -- transcript carries no [unknown] count" >&2; exit 1; }
echo "$OUTPUT" | grep -Eq 'digest [0-9a-f]+'    || { echo "29-15-e2e: FAIL -- transcript carries no render digest" >&2; exit 1; }
echo "29-15-e2e: PASS -- the documented invocation ran end to end."

# --- 5. Corroborating checks, in this same script. -------------------------
if grep -rq 'regen2000proj' src/skills/; then
  echo "29-15-e2e: FAIL -- the retired project-file extension survives under src/skills/" >&2
  grep -rn 'regen2000proj' src/skills/ >&2
  exit 1
fi
echo "29-15-e2e: src/skills/ carries no 'regen2000proj' occurrence."

grep -c 'annostore' "$SKILL" "$TEMPLATE"

node scripts/check-skill-tool-coverage.mjs
node scripts/check-skill-description-overlap.mjs
( cd src/mcp/vice && node --test module-classification.test.ts >/dev/null )
echo "29-15-e2e: module-classification.test.ts green."

echo "29-15-e2e: ALL CHECKS PASSED."
