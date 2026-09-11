---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
plan: 01
subsystem: annotation-export
tags: [acme, provenance, cli, markdown-parser, byte-diff-verification]

# Dependency graph
requires: []
provides:
  - "anno-provenance-ledger.ts: a pure reader over renderLedger()'s generated-tier Markdown table (readProvenanceLedger, provenanceForRange, ProvenanceLedgerRow/ProvenanceLedger/ProvenanceLedgerError)"
  - "anno-export-asm.ts: optional ExportAsmOptions.ledgerPath, PROVENANCE_MARKER_PREFIX / PROVENANCE_AMBIGUITY_MARKER_PREFIX, per-block provenance annotation with no verdict-keyed conditional"
  - "anno export-asm --ledger FILE: the live CLI route, confined through storePathWithinWorkspace(), argument-checked by scripts/lib/anno-cli-invocations.mjs"
affects: [46-02, 46-03, 46-04, 46-05, 46-06]

# Actuals (#2632)
actuals:
  tokens: 15484
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ledger reader is a pure, filesystem-reading-only text parser matched exactly against renderLedger()'s own emitted format -- no Markdown-table library, no recomputation of verdicts."
    - "Provenance annotation is a comment-only side channel: the exporter's block-construction .map() and per-block emission loop are untouched in shape; a ledger row is looked up and its cells interpolated into a fixed-prefix comment line, never used in any conditional."
    - "Multiplicity is recorded, never resolved: more than one ledger row overlapping a block emits every row plus an explicit ambiguity marker line, mirroring ALIAS_MARKER_PREFIX's existing convention for colliding labels."

key-files:
  created:
    - src/mcp/vice/anno-provenance-ledger.ts
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/package.json
    - scripts/lib/anno-cli-invocations.mjs
    - src/skills/c64-provenance-diff/SKILL.md
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "The ledger reader carries BOTH Verdict and Confidence into the emitted comment (assumption A3's superset reading), since the ROADMAP's own wording conflated a Confidence value (HIGH) with two Verdict values (UNKNOWN, CRACKER-PATCH) -- carrying both fields is a strict superset of either single-field reading."
  - "Provenance annotation is opt-in via an optional ledgerPath (assumption A1): a no-ledger export is byte-identical to v0.9.0, and 'ledger absent' is only a distinguishable, refusable state because invoking ledger mode is itself an explicit caller action."
  - "The marker spelling '; PROVENANCE LEDGER:' was chosen deliberately distinct from diff-images.mjs's unrelated, unwired '; PROVENANCE:' prose mention (RESEARCH.md Pitfall 6) -- inheriting that spelling would attribute intent to a sentence that names no writer, reader or format."
  - "readProvenanceLedger() defers zero-data-row, non-ascending/overlapping-row and full-$0000-$FFFF-coverage refusals to plan 46-02, since this tracer's own fixtures do not need them to prove the carry end to end -- the three refusals it DOES implement (file unreadable, no matching header, a row not splitting into seven cells) are exactly the three the tracer's own fixtures exercise."

requirements-completed: [BUILD-05]

coverage:
  - id: D1
    description: "A new shipped module (anno-provenance-ledger.ts) parses recovery/PROVENANCE.md's generated tier into typed rows and joins them to an address range, importing nothing from src/skills/ or the host/container path-translation modules."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#PROVENANCE CARRY Test 1: a ledger-mode export carries the ledger's CRACKER-PATCH verdict and confidence, verbatim, inside the block it overlaps"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#PROVENANCE CARRY Test 6: a block the ledger leaves uncovered is refused BY NAME, never emitted unannotated or with an invented verdict"
        status: pass
    human_judgment: false
  - id: D2
    description: "exportAsm({ ledgerPath }) annotates every emitted block with the overlapping ledger row's Verdict and Confidence, verbatim; omitting ledgerPath is byte-identical to before; real ACME still reassembles the annotated source octet-for-octet."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#PROVENANCE CARRY Test 2: EVERY block carries a provenance marker, not only the CRACKER-PATCH one"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#PROVENANCE CARRY Test 4: real ACME still reassembles the ledger-annotated export byte-identically"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#PROVENANCE CARRY Test 5: omitting ledgerPath emits no PROVENANCE LEDGER text at all, and blocks.length is unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno export-asm <image> --store FILE --ledger FILE is a live, argument-checked CLI route: --ledger is optional, confined through the same seam as every other input, refused by name when missing or nonexistent, and never lets its own output land on any of its three inputs."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-cli.test.ts#export-asm: --ledger FILE annotates the output with the ledger's verdict, and the run still exits 0"
        status: pass
      - kind: unit
        ref: "anno-cli.test.ts#export-asm: a nonexistent --ledger is refused by name, and no output file is written"
        status: pass
      - kind: unit
        ref: "anno-cli.test.ts#export-asm: --out landing on --ledger is refused, and --force does NOT lift it (WR-05, extended to the third input)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-cli-invocations.mjs"
        status: pass
    human_judgment: false
  - id: D4
    description: "src/skills/c64-provenance-diff/SKILL.md documents the route from a recorded verdict to its point of use, with a runnable --ledger invocation, stating plainly that the flag makes the verdict visible and decides nothing."
    requirement: "BUILD-05"
    verification: []
    human_judgment: true
    rationale: "Documentation prose quality and voice-consistency is a human judgment call; check-skill-cli-invocations.mjs mechanically proves the one embedded invocation is argument-valid, but does not evaluate the surrounding prose."

duration: 86min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 01: The End-to-End Provenance Carry Summary

**A new pure Markdown-table reader over `c64-provenance-diff`'s generated `recovery/PROVENANCE.md`, wired into `anno-export-asm.ts` as an optional `ledgerPath` that annotates every emitted block with its ledger row's Verdict and Confidence verbatim, exposed through a new `anno export-asm --ledger FILE` CLI flag, all proven against real ACME 0.97.**

## Performance

- **Duration:** 86 min (with a mid-execution session pause for a provider quota reset; wall-clock active work was shorter)
- **Started:** 2026-09-11T15:39:36+02:00
- **Completed:** 2026-09-11T17:05:16+02:00
- **Tasks:** 2
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments
- `anno-provenance-ledger.ts`: a new shipped, pure, filesystem-reading-only parser for `renderLedger()`'s generated-tier Markdown table, exporting `readProvenanceLedger()` and the address-range join `provenanceForRange()`. Imports nothing from `src/skills/`, `hostpath.ts` or `containerpath.ts`.
- `anno-export-asm.ts`'s `exportAsm()` gained an optional `ledgerPath` that, when supplied, annotates every emitted block with a `; PROVENANCE LEDGER: ` comment line carrying the overlapping ledger row's Verdict and Confidence verbatim, refuses (by name) a block the ledger leaves uncovered, and records (never resolves) multiplicity when more than one row overlaps a block. No conditional anywhere in the change reads a Verdict, Confidence or Kind value.
- Six new tests in `anno-export-asm.test.ts` prove the carry end to end against a synthetic ledger built through `renderLedger()`'s own pure API: the CRACKER-PATCH verdict and confidence appear verbatim inside the block it overlaps, every block gets a marker, an ORIGINAL/HIGH row and an UNKNOWN/LOW row are both annotated with their own cells, real ACME reproduces `expectedBytes` octet for octet, omitting the ledger is byte-identical to before, and an uncovered block is refused by name (96 tests total in the file, 0 fail, 0 skipped -- 89 pre-existing plus 7 new/non-vacuity).
- `anno export-asm <image> --store FILE [--out FILE] [--ledger FILE] [--force]`: `--ledger` is optional, closed-option-set checked, confined through `storePathWithinWorkspace()` in the same block and same order as `<image>` and `--store`, refused by name when missing a value or nonexistent, and the output-must-not-land-on-an-input refusal now covers all three inputs.
- `src/skills/c64-provenance-diff/SKILL.md` documents the route from a recorded verdict to its point of use, with a runnable `anno export-asm game.prg --store game.annostore --ledger recovery/PROVENANCE.md` invocation, mechanically validated by `scripts/check-skill-cli-invocations.mjs`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "the ledger's verdict appears inside an emitted block"** - `357667b6` (feat)
2. **Task 2: The user-facing entry point -- `anno export-asm --ledger FILE`** - `cbf62d70` (feat, includes three deviation fixes discovered during its own full-suite verification pass)

**Deviation fix (Rule 1):** `b4b92474` (fix) -- removed a stray control byte from `anno-provenance-ledger.ts`'s source.

_Note: Task 2's commit also carries the CLI_PATH_ARGUMENTS/ANNO_MODULE_FLOOR/prose-citation fixes described below under Deviations, since they were discovered and fixed together during that task's own verification loop before the commit was made._

## Files Created/Modified
- `src/mcp/vice/anno-provenance-ledger.ts` - new: the ledger reader (`readProvenanceLedger`, `provenanceForRange`, `ProvenanceLedgerRow`/`ProvenanceLedger`/`ProvenanceLedgerError`, `PROVENANCE_LEDGER_HEADER_CELLS`)
- `src/mcp/vice/anno-export-asm.ts` - optional `ledgerPath`, `PROVENANCE_MARKER_PREFIX`/`PROVENANCE_AMBIGUITY_MARKER_PREFIX`, per-block annotation and uncovered-block refusal
- `src/mcp/vice/anno-export-asm.test.ts` - six new PROVENANCE CARRY tests plus a non-vacuity precondition test
- `src/mcp/vice/anno-cli.ts` - `--ledger FILE` flag on `export-asm`: parsing, confinement, existence refusal, USAGE text, output-collision refusal
- `src/mcp/vice/anno-cli.test.ts` - seven new tests for `--ledger`'s parsing, confinement, existence and pass-through
- `src/mcp/vice/package.json` - `anno-provenance-ledger.ts` added to `files[]`
- `scripts/lib/anno-cli-invocations.mjs` - `FLAG_KINDS["export-asm"]["--ledger"] = [".md"]`
- `src/skills/c64-provenance-diff/SKILL.md` - new "Carrying the verdict into the rebuild" section
- `src/mcp/vice/anno-cli-path-consumers.test.ts` - `--ledger` added to `CLI_PATH_ARGUMENTS`; `CLI_PATH_ARGUMENT_FLOOR` raised 13 -> 14
- `src/mcp/vice/hostpath-consumers.test.ts` - `ANNO_MODULE_FLOOR` raised 21 -> 22 for the new module
- `src/mcp/vice/module-classification.ts` - a prose line citation (`anno-cli.ts:399` -> `:409`) corrected after this plan's edits shifted the cited function's line number

## Decisions Made
See `key-decisions` in the frontmatter above (A1/A2 assumption confirmations, the marker-spelling choice, and the plan-46-02 deferral of the ledger reader's remaining refusals).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `--ledger` was missing from `CLI_PATH_ARGUMENTS`, reddening a structural CLI audit**
- **Found during:** Task 2's own full-suite (`npm run test:automated`) verification pass, after the CLI flag landed
- **Issue:** `anno-cli-path-consumers.test.ts`'s "every VERB_OPTIONS entry that is not an explicitly-declared non-path option is named in CLI_PATH_ARGUMENTS" test failed: `--ledger` is a real caller-supplied path this verb confines, but the hand-declared inventory didn't know about it yet.
- **Fix:** Added `{ verb: "export-asm", argument: "--ledger", kind: "flag" }` to `CLI_PATH_ARGUMENTS`, and raised `CLI_PATH_ARGUMENT_FLOOR` from 13 to 14 with a dated, named paragraph following the file's own raise-history convention.
- **Files modified:** `src/mcp/vice/anno-cli-path-consumers.test.ts`
- **Verification:** `node --test anno-cli-path-consumers.test.ts` green
- **Committed in:** `cbf62d70` (Task 2 commit)

**2. [Rule 3 - Blocking] The hand-pinned annotation-module floor (`ANNO_MODULE_FLOOR`) was stale after Task 1 landed a new `anno-*.ts` module**
- **Found during:** Task 2's full-suite verification pass
- **Issue:** `hostpath-consumers.test.ts`'s MCP-05 test asserts the pinned floor equals the measured on-disk count; `anno-provenance-ledger.ts` (Task 1) raised the real count to 22 while the pinned literal stayed at 21.
- **Fix:** Raised `ANNO_MODULE_FLOOR` from 21 to 22 with a dated, named raise-history paragraph citing this plan.
- **Files modified:** `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `node --test hostpath-consumers.test.ts` green
- **Committed in:** `cbf62d70` (Task 2 commit)

**3. [Rule 1 - Bug] A prose line citation drifted after this plan's edits shifted `anno-cli.ts`'s line numbers**
- **Found during:** Task 2's full-suite verification pass
- **Issue:** `module-classification.ts`'s DIRECTION 9b structural test failed: it cites `anno-cli.ts:399` for `checkAcceptedOptions`, but this plan's edits (widening `cmdExportAsm()`, its doc-comment and `parseExportAsmArgs()`) shifted that function to line 409.
- **Fix:** Corrected the citation to `anno-cli.ts:409`.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` green (DIRECTION 9b passes)
- **Committed in:** `cbf62d70` (Task 2 commit)

**4. [Rule 1 - Bug] A literal control byte (NUL) in `anno-provenance-ledger.ts`'s own source text**
- **Found during:** Post-Task-1 review (flagged externally, then independently confirmed byte-for-byte)
- **Issue:** `splitTableRow()`'s `PLACEHOLDER` constant was a raw NUL byte embedded directly in the file rather than a runtime-constructed value. This made `git show` on the introducing commit render as `Bin 0 -> N bytes` with no line-level diff, and would hide the module from a plain (non `-a`) `grep` census -- the same hazard class `anno-memmap-render.ts` already carries elsewhere in this tree. The first attempted fix (typing the ` ` escape sequence through this session's own tool-call pipeline) reproduced the identical raw-byte defect a second time, and a second attempt using a plain space broke parsing outright (ordinary ledger cell text like `"Agreeing releases"` legitimately contains spaces, so restoring a space-shaped placeholder back to `|` corrupted every cell containing one -- reproduced as a real test failure, not merely reasoned about).
- **Fix:** `PLACEHOLDER` is now built at runtime with `String.fromCharCode(0)`, which produces the identical runtime character while keeping every byte of the source file printable ASCII and carrying no backslash-escape spelling of its own to collapse back into a raw byte.
- **Files modified:** `src/mcp/vice/anno-provenance-ledger.ts`
- **Verification:** `readFileSync(...).indexOf(0) === -1`; `git diff -a` on the fix commit alone renders as a normal two-line text change; `node --test anno-export-asm.test.ts` reports 96/96 passing, 0 skipped.
- **Committed in:** `b4b92474` (its own commit, separate from both task commits)

---

**Total deviations:** 4 auto-fixed (3 Rule 3/blocking structural-audit staleness, 1 Rule 1 bug)
**Impact on plan:** All four are corrections to this plan's own edits (line-shift/count-shift bookkeeping and one genuine source-hygiene bug), not scope creep. No behavior, test coverage or requirement text changed as a result.

## Issues Encountered

**Known, disclosed limitation (not fixed, not fixable without a forbidden history rewrite):** the commit that introduced `anno-provenance-ledger.ts` (`357667b6`) permanently carries the raw NUL byte in its committed blob. Git's binary-detection heuristic keys on either side of a diff, so `git show 357667b6` and any diff comparing directly against that specific commit will always render as `Bin 0 -> N bytes` rather than a line-level diff. This does not affect the file's actual on-disk bytes at `HEAD` (verified NUL-free), nor any diff that does not touch that specific historical commit. Fixing it would require amending or rebasing history, which this project's git safety rules forbid.

## User Setup Required

None - no external service configuration required. No `user_setup` block in the plan's frontmatter.

## Next Phase Readiness
- `anno-provenance-ledger.ts` and `ExportAsmOptions.ledgerPath` are the shipped foundation plans 46-02 through 46-06 build on: 46-02 adds the ledger reader's remaining refusals (zero data rows, non-ascending/overlapping rows, full `$0000-$FFFF` coverage), 46-03 adds the exclusion table, 46-04 adds the `anno_exclude_range`/`anno_include_range` MCP tool pair, 46-05 wires exclusions into the exporter, and 46-06 adds the test-only deliberately-filtering variant proving the planted control.
- The full `npm run test:automated` suite's failing-name set is exactly the four (of five documented) baseline names present this run -- `annoRegisterEntryFor()`, `DIRECTION 5 (basis integrity)`, `planted violation (the negative control)`, and `check-skill-fork-honesty` -- with `SEAM-05, non-vacuity` (the fifth, documented flake) passing this run. No new failures anywhere in the suite.
- No blockers for 46-02.

## Self-Check: PASSED

- `[ -f src/mcp/vice/anno-provenance-ledger.ts ]` - FOUND
- `[ -f src/mcp/vice/anno-export-asm.ts ]` - FOUND (modified)
- `[ -f src/mcp/vice/anno-cli.ts ]` - FOUND (modified)
- `git log --oneline --all --grep="46-01"` returns 3 commits: `357667b6`, `cbf62d70`, `b4b92474` - FOUND
- Re-ran every task's `<verify>` command and every plan-level `<verification>` command: `npm run typecheck` clean; `node --test anno-export-asm.test.ts` 96/96, 0 skipped; `node --test anno-cli.test.ts anno-cli-invocations.test.ts` 135/135; `node scripts/check-npm-packages.mjs` exit=0; `node scripts/check-skill-cli-invocations.mjs` exit=0 (22 invocations, up from 20 before this plan); `node scripts/check-skill-tool-coverage.mjs` exit=0; `npm run test:automated` failing-name set matches the documented baseline (4 of 5 names present, the fifth a documented flake that passed this run) - PASSED

---
*Phase: 46-the-lossless-export-invariant-and-the-provenance-carry*
*Completed: 2026-09-11*
