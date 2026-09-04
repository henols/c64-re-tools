---
phase: 35-dxa-vendored-and-parsed
source: 35-REVIEW.md
applied: 2026-09-04
applied_by: orchestrator (execute-phase code-review gate)
findings_total: 3
findings_fixed: 2
findings_accepted: 1
---

# Phase 35 — code review dispositions

Every finding id in `35-REVIEW.md` is dispositioned below. Two were fixed in
commit `756d4a41`; one is accepted-as-is with its reason stated.

The fixes were applied from the orchestrator seat at the phase's code-review
gate rather than by a plan executor, because the gate runs after the last
plan closed. Both are recorded here rather than edited into any plan's
SUMMARY, so a later reader is never misled about which seat produced them.

## CR-01 — BLOCKER — FIXED

**Finding:** `src/mcp/vice/dxa-run.ts` performed local filesystem I/O with no
workspace confinement — `readLocalImageBytes()` (read) and the
`knownDataRows` `-B`/`-l` write path — via a bare `join(root, …)`. The
reviewer reproduced both an arbitrary read (`image: "../sibling/secret.prg"`)
and an arbitrary write (`outDir: "../sibling-dir"`).

**Why the finding is correct, and why it was not caught earlier.** The module
sends workspace-relative strings on the wire and correctly defers *wire* path
resolution to `host-tool.mts`'s `resolveWorkspacePath()` — its header says so
explicitly, and that part is right. What the header does not account for is
that the module ALSO does its own local I/O, which the seam never sees: it
reads the image to compute the parser's window (deliberately, per A-04, so the
window is not inferred from the listing being validated), and it writes the
emitted block/label files. Deferring wire resolution to the seam gave no
protection to either.

**Fix (commit `756d4a41`):** a local `confineToWorkspace()` — resolve against
the root, lexical containment check, canonicalise both sides, re-check, and
return the checked path. Applied at both sites.

The guard is deliberately LOCAL, not a call into an existing seam:
- `dxa-run.ts` must never import `hostpath.ts` (its own header rule — that is
  container↔host *translation*, the wrong concern entirely).
- `resolveWorkspacePath()` lives in host-bound `host-tool.mts`; a
  container-side module must not import it.
- `anno-types.ts`'s `storePathWithinWorkspace()` is the right *mechanism* but
  the wrong *identity* — it throws `AnnoStorePathError` and its message calls
  the path a "store path", which would misreport a dxa image.
- `anno-types.ts`'s `realpathOfNearestExisting()` is not exported.

So the fix follows `stock-symbols.ts`'s `resolveLabelFilePath()`, which is this
repository's own established pattern for precisely this case — a container-side
module, forbidden from `hostpath.ts`, doing its own containment — including its
two documented rules:
- **WR-05:** canonicalise BOTH sides before comparing. Comparing a canonical
  path against a possibly-symlinked root refuses every path in a workspace
  whose own path contains a symlinked component (a bind mount, `/tmp` on
  macOS, a symlinked `$HOME`).
- **WR-08:** return and open the CHECKED path, never the pre-canonical
  spelling — otherwise the check is advisory, since `readFileSync` /
  `writeFileSync` re-traverse symlinks independently of it.

This is therefore not a second copy of a cross-cutting seam (the project's
named anti-pattern); it is the third instance of an already-established local
pattern, chosen after checking all four alternatives above.

**Verification:** both traversal directions now refuse by name, re-reproduced
with standalone scripts (`../sibling/secret.prg` and
`outDir: "../../../../tmp/…/escaped-dxa"`), and nothing was written outside
the workspace. All 5 opt-in live tests pass against the real pinned binary —
every one flows through `readLocalImageBytes()`, so the legitimate read path
is intact.

## WR-01 — WARNING — FIXED

**Finding:** `src/mcp/vice/dxa-blocks.ts`'s `assertRowShape()` never called
`Number.isInteger()` on `start`/`endInclusive`, so a `NaN` or fractional
address passed every range and inversion check and produced a corrupted
`-B` line (`"0NaN-0NaN\n"`) with no refusal.

**Why the finding is correct:** `NaN < 0`, `NaN > 0xffff` and `NaN < NaN` are
all false, so a `NaN` defeats each existing comparison individually. This
contradicts the module's own stated "refused BY NAME, never silently"
discipline, and a `-B` file dxa cannot parse is the exact failure mode the
module exists to prevent — worse, dxa would ignore it silently, which is
indistinguishable from a working emitter. Every sibling numeric boundary check
added in this phase (`dxa-partition.ts`, `dxa-listing.ts`) already calls
`Number.isInteger()`; this one did not.

**Fix (commit `756d4a41`):** integrality checked FIRST, before the comparisons
it defeats. `emitLabels()` is covered too, since it shares `assertRowShape()`.

**Verification:** `NaN` and fractional addresses now refuse by name in both
`emitDataBlocks()` and `emitLabels()`; no file is written; a well-formed row
still emits (`rangesCount=1`).

## IN-01 — INFO — ACCEPTED, NOT FIXED

**Finding:** `hasDotPrefixedSegment` is imported but unused in
`src/mcp/vice/host-tool.mts:93` and its compiled artifact
`src/mcp/vice/resources/host-tool.mjs:99`.

**Disposition: accepted as-is, deliberately not fixed.** The finding is
accurate — the import is genuinely unused. It is left alone because:

1. **It is not this phase's code.** The reviewer states it is pre-existing from
   Phase 34 (the host-tool execution seam). Phase 35 added the
   `dxa.disassemble` branch to that file; it did not introduce this import.
2. **It is cosmetic.** An unused import has no runtime effect. TypeScript
   `noUnusedLocals` is not enabled for this project, and typecheck is clean.
3. **The change is not free.** `host-tool.mts` is host-bound, so touching it
   requires re-running `build.ts` and committing a regenerated
   `resources/host-tool.mjs`, which `resources-sync.test.ts` gates. Rebuilding
   a shipped artifact to delete one cosmetic line, at a phase gate, is a worse
   trade than leaving it.

**Route:** left for whichever pass next touches `host-tool.mts` for a
substantive reason and will rebuild `resources/host-tool.mjs` anyway.
