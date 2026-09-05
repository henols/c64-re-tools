---
phase: 37-the-importer-and-the-automatic-annotation-join
fixed_at: 2026-09-05T10:07:17Z
review_path: .planning/phases/37-the-importer-and-the-automatic-annotation-join/37-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 37: Code Review Fix Report

**Fixed at:** 2026-09-05T10:07:17Z
**Source review:** .planning/phases/37-the-importer-and-the-automatic-annotation-join/37-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 critical, 2 warning, 1 info -- `--all` scope, Info included)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: AUTO-04 through AUTO-07 are unreachable from the shipped `anno_*` tool surface

**Files modified:** `src/mcp/vice/anno-import.ts`, `src/mcp/vice/anno-tools.ts`
**Commit:** `990b0b5e`
**Applied fix:** Implemented Fix option (a) from REVIEW.md, scoped to what is genuinely a
fix rather than a new design decision (per the `<cr01_note>` guidance):

- `importGhidraExport()` now calls `parseConstWrites()` on the SAME parsed document
  BEFORE the transfer file is deleted, and returns the facts as a new, always-present
  `ImportCounts.constWrites` field. This is the one artifact that carries them, so a
  caller now gets them back in the tool's own result before they are gone.
- `anno_join_memmap` gains two new optional arguments on its input schema:
  `const_writes` (an array of `{store_address, target_address, value}`, validated by a
  new `assertConstWritesArg()`/`assertConstWriteFactArg()` pair) and `graphics_map_index`
  (validated by `assertGraphicsMapIndexArg()`). `dispatchJoinMemmap()` now threads both,
  when present, straight into `runMemmapJoin()`'s own pre-existing `constWrites`/
  `graphicsMapIndex` parameters -- which were already fully implemented and tested by
  plans 37-06/37-07/37-08; only the dispatch layer had never supplied them.

**What this makes true now:** a real caller can call `anno_import_ghidra_export`, take the
`constWrites` array from its result, and pass that SAME array unchanged into a following
`anno_join_memmap` call's `const_writes` argument to get bank-state resolution
(AUTO-04/AUTO-05) and VIC-register graphics-range derivation/write-back (AUTO-06/AUTO-07)
for that image. This closes the CR-01 gap: `AUTO-04` through `AUTO-07` are now genuinely
reachable through the shipped `anno_*` tool surface, not merely unit-tested.

**Scope boundary, stated explicitly (per the `<cr01_note>`/`<requirements_note>`
instructions):** the const-write facts are threaded through the TWO-CALL TOOL SURFACE
(round-tripped by the caller), not persisted durably inside the store. Durable
persistence (e.g. interpreting the store's reserved `bank` column) remains explicitly
out of scope per `REQUIREMENTS.md`'s own "Bank-qualified addressing as a modelled store
feature" entry ("`STORE-05` reserves the field; nothing interprets it") -- populating
that column would itself be a new design decision this phase's plans did not settle, not
a fix to the reviewed defect. The chosen fix does not need it: the caller already holds
the facts (they came back from the import call moments before), and handing them
straight to the join call is the same "no agent call, no queue walk" shape `AUTO-01`
already requires of this pipeline.

Verified end-to-end (not merely unit-tested) by four of the new `anno-tools.test.ts`
cases below (WR-01), including one that supplies `const_writes` through `runAnnoTool()`
and observes `$d020`'s own label change away from the unconstrained border-colour
annotation -- proof the argument reaches `runMemmapJoin()`, not merely validated and
dropped.

**Requirements note (as instructed, stated plainly, `REQUIREMENTS.md` NOT edited):**
`AUTO-04`..`AUTO-07` are marked Complete in `REQUIREMENTS.md`'s traceability table. Before
this fix, that status was **not honest** for the shipped tool surface: the machinery was
correct and unit-tested, but no real caller could ever activate it through
`anno_import_ghidra_export`/`anno_join_memmap` as documented, which is exactly the gap
CR-01 identified. After this fix, a real caller genuinely can activate it, through the
two-call round trip described above. The orchestrator's phase verification should treat
this as the fix that makes the existing Complete status honest, not as evidence the
status was already correct -- I have not touched `REQUIREMENTS.md` myself, per
instruction.

### CR-02: `DataRangeSeed.java`'s per-byte seed loop throws when a derived range ends at `$FFFF`

**Files modified:** `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java`
**Commits:** `2c01132c` (fix), `68b127cf` (regression test)
**Applied fix:** Exactly the fix REVIEW.md proposed: the per-byte seed loop now checks
`cur.equals(endAddr)` and breaks BEFORE calling `cur.add(1)` again, instead of advancing
unconditionally after every `createData()` call -- mirroring `GhidraStructExport.java`'s
own classification loop at the identical boundary.

**Verification performed (stronger than the 3-tier default, since this is a `.java` file
node's own syntax tools cannot check):**
- Real compilation against the actual vendored Ghidra 12.1.3 jars
  (`javac -cp <every Ghidra jar> DataRangeSeed.java`) -- succeeds cleanly, no errors.
- A new live (`VICE_LIVE_GHIDRA=1`) regression case in `ghidra-live.test.ts` seeds
  `$fff8-$ffff` (the sprite-pointer range boundary REVIEW.md's own finding named as a
  real, legitimately-derivable case) over the flat-64K route and asserts
  `DATARANGE-OK: fff8-ffff`, no `DATARANGE-FAILED`, and `DATARANGE-SEED-COUNT: 1`. Ran
  live: **passes** against the fixed source.
- **Observed-red control, run live:** reverted `DataRangeSeed.java` to its exact
  pre-fix state (`git show b432d522:...`), re-ran the SAME new test case, and it
  reproduces the reported bug VERBATIM: `DATARANGE-FAILED: fff8-ffff -- Address Overflow
  in add: ffff 0x1` / `DATARANGE-SEED-COUNT: 0`. Restored the fixed file (`git status`
  confirmed byte-identical to the committed fix afterward), then re-ran the case again
  to confirm it passes once more.
- Full `ghidra-live.test.ts` suite re-run live after the fix (`VICE_LIVE_GHIDRA=1
  GHIDRA_HOME=...`): 19 pass / 0 fail / 2 skipped (opt-in corpus cases) -- identical to
  the documented pre-existing baseline (37-08-SUMMARY.md), no regression.

### WR-01: no dispatch-layer test coverage for `anno_import_ghidra_export`/`anno_join_memmap`

**Files modified:** `src/mcp/vice/anno-tools.test.ts`
**Commit:** `5c27580b`
**Applied fix:** Added eight new cases to `anno-tools.test.ts`, mirroring the pattern
every other verb in that file already uses (`runAnnoTool()` end to end):
- a successful `anno_import_ghidra_export` call, asserting the full `ImportCounts` shape
  including CR-01's new `constWrites` field;
- a stale `base_revision` refusal for `anno_import_ghidra_export`, confirming nothing
  was written and the transfer file was not deleted;
- a successful `anno_join_memmap` call, asserting the full `JoinCounts`/`decisions`
  shape (the body is `{ counts, decisions, graphics? }`, NOT flattened -- confirmed by
  reading `runAnnoTool()`'s own `JSON.stringify(await dispatch(...))` serialization
  rather than assumed);
- a `const_writes`-supplied call proving the argument reaches `runMemmapJoin()` (the
  regression test for CR-01's own fix -- `$d020`'s label changes away from the
  unconstrained border-colour annotation under an all-RAM processor-port value, matching
  `anno-bank.test.ts`'s own established real-capture case);
- a malformed `const_writes` element refusal, named by field;
- a stale `base_revision` refusal for `anno_join_memmap`;
- `loadImage()`'s missing-image and wrong-extension/shape error paths, reached and named
  through `anno_join_memmap`.

All eight pass. `npm run typecheck` clean.

### WR-02: `parseConstWrites()` is dead code from the shipped importer's perspective

**Files modified:** `src/mcp/vice/anno-import.ts` (same lines as CR-01)
**Commit:** `990b0b5e` (shared with CR-01 -- see note below)
**Applied fix:** Same fix as CR-01, as REVIEW.md's own Fix section for WR-02 states
("Same fix as CR-01(a)"). `importGhidraExport()` now calls `parseConstWrites()`, making
it reachable from production code, not only from test code.

**Note on why this shares a commit with CR-01:** the fix for WR-02 is the identical two
lines of `anno-import.ts` that fix CR-01's importer half (parsing `constWrites` and
returning it) -- there is no way to commit one without the other, since they are the
same edit. Splitting them into two commits would mean one commit intentionally left the
code in a half-broken state (parsing the facts but not returning them, or vice versa).
Both finding ids are named in that commit's message.

## Skipped Issues

None -- all five in-scope findings (including `IN-01`, included per the `--all` scope
this invocation was given) were fixed. See below for the disposition of the one finding
whose verification stopped short of a dedicated live regression test.

### IN-01: `DataRangeSeed.java`'s `readDataRanges()` can abort the whole script on an I/O error

**Files modified:** `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java`
**Commit:** `317cda35`
**Applied fix:** Exactly the fix REVIEW.md proposed: `Files.readAllLines()` is now
wrapped in its own `try`/`catch (java.io.IOException e)`, printing a
`DATARANGE-SEED-REASON`-style diagnostic naming the I/O failure and returning an empty
range list, rather than letting the exception propagate out of `run()` (which has no
surrounding `try`/`catch`) and abort the whole script.

**Verification performed:** real compilation against the vendored Ghidra 12.1.3 jars
succeeds cleanly (same method as CR-02). The full `ghidra-live.test.ts` suite (19
pass / 0 fail / 2 skip) confirms no regression to any existing path that reaches
`readDataRanges()`.

**Honestly disclosed limitation:** no dedicated live test was added to observe this
specific I/O-failure branch actually firing. The project's own test-authoring notes
record that inducing a real read-time I/O failure deterministically (e.g. via a
read-only directory) does not reliably work when the test process runs as root, which is
exactly the reason `anno-import.ts`'s own `ImportGhidraExportArgs.deleteFile` injection
point exists for its analogous case. Reproducing that same injection-point pattern for
this Java script was judged disproportionate to an Info-severity finding relative to the
two mandatory syntax/compile-verification tiers already performed, which are sufficient
to confirm the fix's control flow is correct by inspection and does not regress any
passing path. Flagged here for a human to judge whether a dedicated live case is still
wanted; not treated as a reason to leave the finding unfixed.

---

_Fixed: 2026-09-05T10:07:17Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
