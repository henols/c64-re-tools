---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 08
subsystem: external-analyser-integration
tags: [the external analyser, vice-symbols, cli, mcp-client, stock-symbols, anno]

# Dependency graph
requires:
  - phase: 11-05
    provides: "anno-tools.ts's curated anno_* surface (runAnnoTool, resolveStorePath) and its D-17 per-call auto-save discipline"
  - phase: 11-04
    provides: "anno-launch.ts's fixed argv builders (buildExportLblArgs/buildImportLblArgs) and anno-mcp-client.ts's withAnnoSession/saveAndVerify seam"
  - phase: 11-06
    provides: "anno-cli.ts's gen-enums verb shape, extended here rather than overwritten"
provides:
  - "anno-symbols.ts: exportLabels()/importLabels()/regenerateAndReload() -- the Rule A20 adapter closing ANNO-14/ANNO-15"
  - "export-lbl/import-lbl CLI verbs, ready for plan 11-11's live walkthrough"
  - "a CI-runnable closed-loop test (anno-symbol-roundtrip.test.ts) proving the round trip is a loop, not two one-way dumps"
  - "the D-28 discard trap pinned live against a real analyser 0.9.20"
affects: [11-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union result types (ImportLabelsResult) to force a caller to distinguish a disk-verified outcome from a no-error one"
    - "Reuse an existing parser via a minimal targeted export rather than adding a second copy (stock-symbols.ts's parseViceLabelFile)"
    - "Session-argv override on an existing single-seam client (anno-mcp-client.ts's WithAnnoSessionOptions.argv) instead of opening a second spawn path"

key-files:
  created:
    - .claude/mcp/vice/anno-symbols.ts
    - .claude/mcp/vice/anno-symbol-roundtrip.test.ts
  modified:
    - .claude/mcp/vice/anno-cli.ts
    - .claude/mcp/vice/anno-cli.test.ts
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/stock-symbols.ts
    - .claude/mcp/vice/anno-mcp-client.ts

key-decisions:
  - "Reused stock-symbols.ts's existing parseViceLabelFile() rather than adding a third al C:xxxx .Name parser -- exported it (plus MAX_LABEL_FILE_BYTES and SymbolTable) from stock-symbols.ts specifically for this reuse (Rule A20)."
  - "Extended anno-mcp-client.ts's WithAnnoSessionOptions with an optional argv override so importLabels() can spawn buildImportLblArgs()'s argv through the existing single session seam, rather than opening a second child-spawn path outside that module."
  - "export-lbl/import-lbl are CLI verbs, not MCP tools (plan's own decisions_you_own #2): --export_lbl/--import_lbl are argv flags on the external analyser child, not tools in its MCP surface, and both write/consume a file on disk, already this CLI's job."
  - "ImportLabelsResult is a discriminated union (diskVerified: true|false) rather than a boolean flag plus optional fields, so a caller cannot read importedNames and mistake a no-error call for a disk-verified one."

patterns-established:
  - "A module that needs another module's parser/constant exports it minimally rather than duplicating logic, even when the importing plan's own files_modified list omitted the exporting file."

requirements-completed: [ANNO-14, ANNO-15]

# Metrics
duration: ~50min
completed: 2026-08-20
---

# Phase 11 Plan 08: Symbol Round Trip Summary

**`anno-symbols.ts` closes the ANNO-14/ANNO-15 symbol loop: `exportLabels()`/`importLabels()` reuse `stock-symbols.ts`'s one label parser, prove import persistence twice (hash-verified save plus an independent fresh re-export from a brand-new process), and two new `export-lbl`/`import-lbl` CLI verbs plus a committed-fixture closed-loop test pin the whole mechanism against a real analyser 0.9.20.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-20
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `anno-symbols.ts` -- the Rule A20 adapter: `exportLabels()` (export leg, read-back validated through `stock-symbols.ts`'s existing parser), `importLabels()` (import leg, the D-28 `--import_lbl` + `--mcp-server-stdio` + `saveAndVerify()` path, with a SECOND independent persistence proof via a fresh export in a brand-new process), and `regenerateAndReload()` (D-29: write-then-regenerate-whole-file, returning the path for the caller to hand `vice_symbols_load` exactly once).
- `anno-symbol-roundtrip.test.ts` -- ONE ordered closed-loop test against the committed `probe-illegal.prg` fixture (D-31), with the load-bearing "absent before" assertion sitting between the export and discovery-import legs. Also pins the D-28 discard trap live (a hand-built `--import_lbl --headless` argv provably does not persist) and two ceiling-refusal tests that need no live binary.
- `export-lbl`/`import-lbl` CLI verbs in `anno-cli.ts`, with closed option sets (WR-08 posture: an unknown flag or a missing/flag-shaped `--out` value is refused, never silently accepted).

## Task Commits

1. **Task 1: anno-symbols.ts -- the export leg, the import leg, and verified persistence** - `65e84a2` (feat)
2. **Task 2: the committed-fixture closed loop, with the absent-before assertion and the discard-trap regression** - `5c0c7d4` (test)
3. **Task 3: the `export-lbl` and `import-lbl` verbs** - `c2ff4af` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `.claude/mcp/vice/anno-symbols.ts` - New. The Rule A20 adapter: `exportLabels`, `importLabels`, `regenerateAndReload`.
- `.claude/mcp/vice/anno-symbol-roundtrip.test.ts` - New. The committed-fixture closed-loop test (criterion 4), the discard-trap regression, and two ceiling-refusal tests.
- `.claude/mcp/vice/anno-cli.ts` - Added `export-lbl`/`import-lbl` verbs, their option parsers, and USAGE text.
- `.claude/mcp/vice/anno-cli.test.ts` - Added tests for both new verbs (option refusals, missing files, ceiling refusal, and a live-gated happy-path round trip).
- `.claude/mcp/vice/package.json` - Added `anno-symbols.ts` to `files[]`.
- `.claude/mcp/vice/stock-symbols.ts` - Exported `parseViceLabelFile`, `MAX_LABEL_FILE_BYTES`, and `SymbolTable` (see Deviations).
- `.claude/mcp/vice/anno-mcp-client.ts` - Added an optional `argv` override to `WithAnnoSessionOptions` (see Deviations).

## The loop-vs-two-dumps ordering invariant (for plan 11-11)

Criterion 4's own wording is explicit that a passing export test plus a passing import test does not, by itself, prove a closed loop -- the two could just be independent one-way dumps that happen to share a file format. The invariant that makes it an actual LOOP, reusable verbatim by plan 11-11 against a real emulator, is:

1. Write a user label into the store and export it. Assert the export contains exactly that label.
2. **Assert the to-be-discovered name is ABSENT** from BOTH the store (a fresh `anno_get_symbols` call) AND the just-exported `.lbl` file -- this is the assertion that anchors "before" against the SAME store instance the loop will later mutate. Skipping this step is exactly what would let two independent dumps masquerade as a loop.
3. Simulate the external discovery by appending one `al C:xxxx .Name` line to the exported file (11-11's real analogue: `vice_symbols_lookup`/a live watch discovers a name against the running machine and the operator/skill appends the same line).
4. Import that file back into the SAME project via the D-28 path (`--import_lbl` + `--mcp-server-stdio` + an explicit `anno_save_project`), proving persistence independently of the import session's own success text.
5. **Re-open the project in a FRESH process** and assert `anno_get_symbols` now contains BOTH names -- proving the mutation actually reached disk, not just the in-memory session that performed it.
6. Export again from that fresh state and feed the result to `stock-symbols.ts`'s own `vice_symbols_load`/`vice_symbols_lookup`, resolving both names to their addresses.

Step 2 is the one a shortened version of this test could omit and still look green -- it is the entire reason this is a loop rather than two dumps. Plan 11-11, driving the same shape against a real `x64sc`, must keep an equivalent "assert absent in the live emulator's own symbol resolution before the live discovery step" assertion, or its own closed-loop claim will rest on the same unproven assumption this test exists to eliminate.

## Decisions Made

- **Reused `stock-symbols.ts`'s parser rather than adding a third copy.** `parseViceLabelFile()` (plus `MAX_LABEL_FILE_BYTES` and the `SymbolTable` type it returns) is now exported from `stock-symbols.ts` specifically so `anno-symbols.ts` can validate a produced/consumed `.lbl` file through the SAME parser `vice_symbols_load` uses, per Rule A20 and the plan's own acceptance criterion (`grep -c 'al\s' anno-symbols.ts` returns 0).
- **`importLabels()`'s return type is a discriminated union** (`{ diskVerified: true; ...; exported }` vs `{ diskVerified: false; ...; missingNames; reason }`), not a boolean flag with optional fields, so a caller structurally cannot read `importedNames` off a non-verified result and mistake it for success.
- **`export-lbl`/`import-lbl` are CLI verbs, not MCP tools** -- recorded per the plan's own `decisions_you_own #2`: the underlying flags are child argv, not the child's own MCP tool surface, and both already fit this CLI's existing file-in/file-out shape (`bootstrap`, `export-asm`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2/3 - extends an existing seam] Exported `parseViceLabelFile`/`MAX_LABEL_FILE_BYTES`/`SymbolTable` from `stock-symbols.ts`**
- **Found during:** Task 1
- **Issue:** The plan's acceptance criteria require `exportLabels()`/`importLabels()` to validate a `.lbl` file through `stock-symbols.ts`'s existing parser with zero label-line regexes of its own -- but `stock-symbols.ts` was not in this plan's declared `files_modified` list, and its parser (`parseViceLabelFile`) was a private, unexported function. Reusing it via the full `handleSymbolsLoad` MCP-handler path was rejected: that handler installs the parsed table into `stock-address.ts`'s single live symbol resolver as a side effect (via `setSymbolResolver()`), which would make every `exportLabels()`/`importLabels()` validation call silently mutate global, in-process symbol-resolution state used by the live stock VICE tool surface -- a surprising and undocumented coupling for what is meant to be a pure read-back validation step.
- **Fix:** Exported the existing `parseViceLabelFile()` function, its `SymbolTable` return-type interface, and the `MAX_LABEL_FILE_BYTES` ceiling constant from `stock-symbols.ts`, each with a one-paragraph comment explaining why the export exists (11-08 reuse, Rule A20). No existing behavior changed; `parseViceLabelFile`'s body, `MAX_LABEL_FILE_LINES`, and `MAX_SYMBOLS` are untouched and still enforced identically for `handleSymbolsLoad`.
- **Files modified:** `.claude/mcp/vice/stock-symbols.ts`
- **Verification:** `node --test stock-symbols.test.ts` -- all 32 pre-existing tests still pass unchanged; `npx tsc --noEmit -p tsconfig.json` clean.
- **Committed in:** `65e84a2` (Task 1 commit)

**2. [Rule 3 - blocking issue] Added an `argv` override to `anno-mcp-client.ts`'s `WithAnnoSessionOptions`**
- **Found during:** Task 1
- **Issue:** `importLabels()` must spawn `the external analyser` with `buildImportLblArgs()`'s argv (`["--import_lbl", lblPath, "--mcp-server-stdio", projectPath]`), but `anno-mcp-client.ts`'s `withAnnoSession()` -- the ONE seam this repo's own module headers require every `--mcp-server-stdio` spawn to go through -- always built its argv from `buildMcpServerStdioArgs({ projectPath })` with no way to substitute a different, still-builder-produced argv. `anno-mcp-client.ts` was also not in this plan's declared `files_modified` list. Without this change, `importLabels()` would have had to open a second, ad hoc `--mcp-server-stdio` spawn path outside `anno-mcp-client.ts`, directly violating that module's own "no other module may spawn `--mcp-server-stdio`" rule.
- **Fix:** Added an optional `argv?: readonly string[]` field to `WithAnnoSessionOptions`. When supplied, `withAnnoSession()` uses it in place of `buildMcpServerStdioArgs({ projectPath })`; `assertNoViceFlag()` still runs against whichever argv is actually used, in both cases. Every existing caller (all of `anno-tools.ts`, `anno-enum-gen.ts`) omits the new option and is byte-for-byte unaffected.
- **Files modified:** `.claude/mcp/vice/anno-mcp-client.ts`
- **Verification:** `node --test anno-mcp-client.test.ts` -- all 44 pre-existing tests (including the D-16 client-shape decision record and the five stub-server property measurements) still pass unchanged; the live symbol-round-trip test (`anno-symbol-roundtrip.test.ts`) exercises the new option end to end against a real analyser 0.9.20 child.
- **Committed in:** `65e84a2` (Task 1 commit)

**3. [Rule 1 - bug, self-caught during authoring] Removed a vacuous unit test before it was committed**
- **Found during:** Task 2, while writing `anno-symbol-roundtrip.test.ts`
- **Issue:** An initial draft test tried to prove `exportLabels()` throws `AnnoSymbolsError` on a non-zero the external analyser exit by pointing a spy binary at `process.env.ANNO_BIN` mid-test. It passed -- but only because `anno-launch.ts`'s own `ANNO_BIN` is a module-level constant resolved ONCE at import time (`process.env.ANNO_BIN ?? "the external analyser"`); mutating `process.env.ANNO_BIN` after that module has already loaded has no effect on `runAnno()`'s target binary. The test's apparent "pass" was actually a REAL the external analyser invocation against a nonexistent project path failing for an unrelated reason (a real, but different, non-zero exit) -- exactly the "test proves less than it looks like it does" failure class this codebase's own history repeatedly documents.
- **Fix:** Deleted the test rather than keep a coincidentally-passing one; a comment in its place explains why a spy-binary substitution cannot work here given `anno-launch.ts`'s current design, so a future author does not reintroduce the same shape. `exportLabels()`'s non-zero-exit and missing-output-file branches are still exercised live by the gated closed-loop/discard-trap tests against a real binary.
- **Files modified:** `.claude/mcp/vice/anno-symbol-roundtrip.test.ts` (never committed with the vacuous test present)
- **Verification:** `VICE_REQUIRE_ANNO=1 node --test anno-symbol-roundtrip.test.ts` -- 7/7 pass.
- **Committed in:** `5c0c7d4` (Task 2 commit; the vacuous test was removed before this commit was made)

---

**Total deviations:** 3 auto-fixed (2 seam extensions to files outside the plan's declared scope, 1 self-caught test-integrity fix)
**Impact on plan:** All three were necessary to satisfy the plan's own acceptance criteria (Rule A20 reuse, the D-28 argv path) or to keep the test suite honest. No scope creep beyond what the plan's own action text already required; no unrelated files touched.

## Residual Finding (Threat Flags)

| Flag | File | Description |
|------|------|-------------|
| threat_flag: unvalidated-identifier | `.claude/mcp/vice/anno-symbols.ts`, `.claude/mcp/vice/anno-tools.ts` | T-11-NAME-INJECT's disposition in this plan's own threat model names `anno_set_label_name`'s curated surface plus plan 11-06's `assertLegalAcmeIdentifier()` as the mitigation. Checked directly: `assertLegalAcmeIdentifier()` lives in `anno-enum-gen.ts` and is called ONLY on enum names/variant names -- it is never called on a LABEL name, whether set via `anno_set_label_name` (whose schema only type-checks `name: string`, no format constraint) or via `importLabels()`'s path (`stock-symbols.ts`'s `VICE_LABEL_LINE_RE` accepts any `\S+` after the dot -- far looser than a legal ACME identifier). **A label name is NOT validated on the way in, by either route.** A discovered name containing characters ACME does not accept as a bare identifier (whitespace via a crafted `.lbl` line, `;`, `=`, etc.) would flow unchanged into the store and later into `--export_asm`'s generated ACME source, where it could break reassembly or, in the worst case, alter the meaning of a generated line rather than merely fail loudly. This is a residual gap in the current surface, recorded per the plan's own explicit instruction rather than assumed covered by the enum-side control. Not fixed here: doing so would mean deciding a refusal policy (reject vs. sanitize vs. quote) for label names project-wide, which is a scope decision beyond this plan's own file list. |

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. `the external analyser` (already a required prerequisite for this milestone) and, for `anno-cli.test.ts`'s criterion-3 test, real ACME, are both used live in this session's verification and were both present.

## Next Phase Readiness

- Plan 11-11 has a concrete mechanism to walk through live: `export-lbl`/`import-lbl` plus `anno-symbols.ts`'s `exportLabels()`/`importLabels()`/`regenerateAndReload()` are all ready to drive against a real `x64sc`, with the ordering invariant above stated explicitly for reuse.
- One pre-existing, worktree-only test failure was observed and is NOT caused by this plan: `repo-root.test.ts`'s "path agreement (D-3, D-6)" assertion fails inside this worktree because the worktree's own checkout path lives under `.claude/`, and passes on the main tree (documented in this plan's own prior-wave context). `node test-gate.mjs`: 1891/1897 pass, 1 pre-existing worktree-only failure, 5 todo (unrelated), 0 caused by this plan's changes.
- The T-11-NAME-INJECT residual finding above (label names unvalidated on the way in) is real and open; it is not a blocker for 11-11's live walkthrough (which uses ordinary, well-formed discovered names) but should be weighed if a future plan hardens the label-name surface.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/anno-symbols.ts`
- FOUND: `.claude/mcp/vice/anno-symbol-roundtrip.test.ts`
- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/11-08-SUMMARY.md`
- FOUND commit `65e84a2` (Task 1)
- FOUND commit `5c0c7d4` (Task 2)
- FOUND commit `c2ff4af` (Task 3)

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*
