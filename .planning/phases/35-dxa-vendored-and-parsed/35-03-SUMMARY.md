---
phase: 35-dxa-vendored-and-parsed
plan: 03
subsystem: infra
tags: [dxa, ground-truth, partition, basic-tokenizer, disassembler]

# Dependency graph
requires:
  - phase: 35-dxa-vendored-and-parsed
    provides: "plan 35-01's vendored dxa and its Phase-23-derived fixture-baseline transcript this plan's source-derived tier ports and reproduces; the HOST_TOOL_FAMILY_FLOOR/HOST_TOOL_FAMILY_RE seam plan 35-01 established, which this plan's dxa-partition.ts joins"
provides:
  - "dxa-partition.ts -- the ONE producer of a ground-truth code/data partition in this project, with two tiers (source-derived, byte-derived) that never import dxa-listing.ts and never see dxa's own output"
  - "partitionSourceDerived() -- reproduces Phase 23's independently re-derived 145 code / 131 data / 3 pad bytes exactly, from a committed ACME -r report, before dxa runs"
  - "partitionByteDerived() -- decides exactly two facts from bytes alone (the .prg header exclusion, and a cleanly-parsed BASIC-stub's certain-data bytes at $0801), reporting everything else unknown"
  - "renderPartitionReport() -- always names both PARTITION_SOURCE_DERIVED and PARTITION_BYTE_DERIVED, states POSITIVE_CLASS: data, and states the abstention explicitly"
  - "a CLI entry point (node dxa-partition.ts <tier> <inputs...>) making the script runnable standalone, before dxa is ever invoked"
  - "fixtures/dxa/fixture.a, fixture.rep, fixture.prg, basic-stub.prg -- committed, hermetic fixtures for both tiers"
  - "HOST_TOOL_FAMILY_FLOOR raised to 2 + 1 + 2 + 1 for dxa-partition.ts joining the dxa- family"
affects: [38-real-release-recovery-rate-measurement]

# Actuals (#2632)
actuals:
  tokens: 18334
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-tier ground truth, both always named in the output: a fixture-class tier (source + assembler report) and a real-release-class tier (bytes alone), with the inapplicable tier printing a stated reason rather than being omitted -- so a tier can never be silently chosen after seeing which one flatters a result."
    - "A byte grammar walked to REFUSE the whole structure on any parse failure, never a partial classification: the BASIC-stub walker validates a link address against the position the terminator scan actually finds (not merely 'forward and in-bounds'), so a wrong-but-plausible link is caught as 'points to a non-existent line' rather than silently accepted."
    - "A rate function (formatPercent) that computes half-up rounding via pure integer arithmetic (numerator*10000/denominator, remainder-doubling tie test) rather than Number.prototype.toFixed, whose binary-representation quirks do not guarantee half-up (1.005.toFixed(2) famously renders \"1.00\")."
    - "A composition rate (data as a fraction of what a tier itself can prove) replaces a comparison-to-an-external-tool rate everywhere neither ground-truth tier is permitted to see that tool's output -- the denominator discipline (numerator/denominator/positive-class on every line, zero denominator refused by name) is preserved without needing the forbidden import."

key-files:
  created:
    - src/mcp/vice/dxa-partition.ts
    - src/mcp/vice/dxa-partition.test.ts
    - src/mcp/vice/fixtures/dxa/fixture.a
    - src/mcp/vice/fixtures/dxa/fixture.rep
    - src/mcp/vice/fixtures/dxa/fixture.prg
    - src/mcp/vice/fixtures/dxa/basic-stub.prg
    - .planning/phases/35-dxa-vendored-and-parsed/deferred-items.md
  modified:
    - src/mcp/vice/fixtures/dxa/README.md
    - src/mcp/vice/hostpath-consumers.test.ts

key-decisions:
  - "The BASIC-stub link-address check validates the link against the address the terminator scan ACTUALLY finds (origin + terminatorOffset + 1), not merely 'forward and within the image' -- a plausible-looking but wrong link (e.g. off by one) is caught as 'does not point to the next line's actual start' rather than silently accepted as a valid (wrong) boundary. This is stricter than the minimum the plan's <behavior> text states and was chosen because the alternative (accept any forward in-bounds link) would let a corrupted stub still 'succeed' with a wrong certain-data span."
  - "Both ground-truth tiers print a self-referential COMPOSITION rate (certain-data as a fraction of what the tier itself can prove: certain-code + certain-data) rather than any comparison to dxa's own classification -- neither tier module imports dxa-listing.ts (T-35-13), so no data-recovery-rate against dxa is possible or printed anywhere in this plan; that comparison is explicitly Phase 38's to make."
  - "The four negative BASIC-stub test cases (backwards link, out-of-range link, non-line-start link, missing terminator) mutate the working fixture's bytes directly in the test file rather than adding four more committed .prg fixtures -- the plan's own text requires 'one field mutated' per case, and a synthetic Uint8Array literal makes the single mutated byte visible at the call site rather than hidden inside a fourth binary file."
  - "The single dxa-partition.ts file was implemented once, then split into three git-history stages (task1: shared range/rate helpers + source-derived tier; task2 adds byte-derived tier; task3 adds renderPartitionReport()+CLI) so each of the three per-task commits is independently green (tests pass, typecheck clean) rather than one commit containing all three tasks' code -- honors the plan's per-task atomic-commit requirement without re-deriving already-verified logic from scratch three times."

requirements-completed: [DXA-04]

coverage:
  - id: D1
    description: "A committed script (dxa-partition.ts) derives a ground-truth code/data partition from image bytes and, for a fixture-class input, the assembler's own report -- before dxa is ever invoked, with no execution oracle anywhere in the loop."
    requirement: "DXA-04"
    verification:
      - kind: unit
        ref: "dxa-partition.test.ts (34 tests across all three tasks, all hermetic -- no ACME, no dxa, no VICE)"
        status: pass
      - kind: unit
        ref: "hostpath-consumers.test.ts (SEAM-06 family-floor and absence checks at HOST_TOOL_FAMILY_FLOOR = 2+1+2+1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The source-derived tier reproduces Phase 23's independently re-derived 145 code / 131 data / 3 pad bytes exactly (90 emissions, 4 truncated columns recovered), and records the published 141/138 figures only as a stated non-match."
    requirement: "DXA-04"
    verification:
      - kind: unit
        ref: "dxa-partition.test.ts#task1: partitionSourceDerived reproduces Phase 23's re-derived 145/131/3/90/4 exactly, from the committed fixture"
        status: pass
      - kind: integration
        ref: "node dxa-partition.ts source-derived fixtures/dxa/fixture.rep fixtures/dxa/fixture.prg (task-3 CLI verify)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The byte-derived tier decides exactly the .prg header exclusion and a cleanly-parsed BASIC stub's certain-data bytes at $0801; any parse failure refuses the WHOLE stub with a stated reason; everything else is unknown, with no $0400/$1000 convention-based guess anywhere."
    requirement: "DXA-04"
    verification:
      - kind: unit
        ref: "dxa-partition.test.ts#task2 (18 cases: clean stub, header exclusion, 4 named parse-failure modes, truncation-before-marker, boundary/adjacency, degenerate 0/1/2-byte inputs, rounding, no-$0400/$1000 source check)"
        status: pass
      - kind: integration
        ref: "node dxa-partition.ts byte-derived fixtures/dxa/basic-stub.prg (task-3 CLI verify)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every run always names both PARTITION_SOURCE_DERIVED and PARTITION_BYTE_DERIVED, states POSITIVE_CLASS: data, and states an explicit abstention -- with no PROOF-01 claim and no data-recovery-rate claim about dxa on real cracked code anywhere in the rendered output or the source."
    requirement: "DXA-04"
    verification:
      - kind: unit
        ref: "dxa-partition.test.ts#task3 (8 cases: both tier names always present, inapplicable-tier reason, non-empty abstention for both single-tier runs, idempotency, no-PROOF-01/data-recovery-rate check, 3 CLI subprocess cases)"
        status: pass
      - kind: integration
        ref: "npm run typecheck; node --test hostpath-consumers.test.ts ci-suite-coverage.test.ts test-gate.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-09-04
status: complete
---

# Phase 35 Plan 3: dxa Vendored and Parsed Summary

**`dxa-partition.ts` gives this project a ground truth it derived itself: a source-derived tier that reproduces Phase 23's independently re-derived 145/131/3 partition exactly from a committed ACME report, and a byte-derived tier that classifies exactly a `.prg` header exclusion plus a cleanly-parsed BASIC stub at `$0801` as certain-data, reporting everything else `unknown` -- both tiers always named, every rate carrying its numerator, denominator and positive class, and neither tier ever importing `dxa-listing.ts` or seeing dxa's own output.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-04T~10:50Z
- **Completed:** 2026-09-04T~11:45Z
- **Tasks:** 3 (all completed)
- **Files modified:** 8 (6 created, 2 modified) plus this SUMMARY and one deferred-items note

## Accomplishments

- `partitionSourceDerived()` ports `fixture-baseline.mjs`'s four-step ground-truth derivation (report emission parsing, truncated-byte-column recovery from the directive itself, data-pseudo-op classification, third-category assembler padding) unchanged, and reproduces Phase 23's re-derivation exactly: 145 code bytes, 131 strict data bytes, 3 pad bytes, 90 emissions, 4 truncated columns recovered, over the committed 279-byte fixture. The published 141/138 pivot figures are recorded only as a stated non-match, never as ground truth.
- `partitionByteDerived()` implements the C64 BASIC tokenised-program byte grammar (link-address word, line-number word, tokens, `$00` terminator, `$00 $00` program-end marker) as a walk that refuses the WHOLE stub on any parse failure -- backwards link, out-of-range link, a link that doesn't match where the terminator scan actually lands ("non-line-start"), or a missing/truncated terminator -- never a partial classification. The `.prg` header's two bytes are excluded from the partition entirely, never classified and absent from every denominator.
- `formatPercent()` renders the `72.39 (97/134)` shape via pure-integer half-up rounding (never `toFixed`, whose binary-representation quirks do not guarantee half-up) and refuses a zero denominator by name.
- `renderPartitionReport()` always prints both `PARTITION_SOURCE_DERIVED` and `PARTITION_BYTE_DERIVED` section headers regardless of which tier actually ran, states `POSITIVE_CLASS: data` in every run's header, and closes with an explicit abstention section -- what the run could not decide, in its own words, without spelling the milestone proof requirement's identifier or the phrase this project's own gate greps for.
- A CLI (`node dxa-partition.ts <source-derived|byte-derived> <inputs...>`) makes the script runnable standalone, exiting non-zero with a usage message on a missing argument.
- Committed four hermetic fixtures: `fixture.a` (copied unchanged from the Phase 23 evidence dir), `fixture.rep`/`fixture.prg` (generated once via a real, verified ACME 0.97 run -- `fixture.prg`'s sha256 is byte-identical to Phase 23's own), and `basic-stub.prg` (18 bytes, hand-built via `printf`, never retyped).
- Raised `HOST_TOOL_FAMILY_FLOOR` to `2 + 1 + 2 + 1` in the same commit that landed `dxa-partition.ts`, and updated the SEAM-06 positive control to name it.
- 34 new tests in `dxa-partition.test.ts`, all green, all hermetic (no ACME, no dxa, no VICE broker) -- the three task-3 CLI cases are the only ones that spawn a subprocess, and they spawn `dxa-partition.ts` itself via `process.execPath`.

## Task Commits

Each task was committed atomically. The full module was implemented once, verified, then its git history was split into three independently-green stages so each task's commit stands on its own (source-derived tier code+tests only; then +byte-derived; then +report/CLI):

1. **Task 1: The source-derived tier -- reproduce Phase 23's 145/131/3 exactly** - `1d62c19` (feat)
2. **Task 2: The byte-derived tier -- two certainties, everything else `unknown`** - `cec1eec` (feat)
3. **Task 3: The report -- both tiers named, every rate carrying its denominator** - `5f745d8` (feat)
4. **Deviation fix: spawn the CLI via `process.execPath`, not a bare `"node"`** - `e8a2fdb` (fix)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/dxa-partition.ts` -- the two-tier ground-truth partition producer, `renderPartitionReport()`, and CLI entry point.
- `src/mcp/vice/dxa-partition.test.ts` -- 34 tests across all three tasks.
- `src/mcp/vice/fixtures/dxa/fixture.a`, `fixture.rep`, `fixture.prg` -- the source-derived tier's committed, hermetic fixture.
- `src/mcp/vice/fixtures/dxa/basic-stub.prg` -- the byte-derived tier's committed fixture (18 bytes: header + clean stub + non-BASIC tail).
- `src/mcp/vice/fixtures/dxa/README.md` -- provenance for both new fixture groups (exact ACME command, version, date, per-file sha256; the hand-built stub's byte layout).
- `src/mcp/vice/hostpath-consumers.test.ts` -- `HOST_TOOL_FAMILY_FLOOR` raised to `2 + 1 + 2 + 1`; SEAM-06 positive control now names `dxa-partition.ts`.
- `.planning/phases/35-dxa-vendored-and-parsed/deferred-items.md` -- one out-of-scope, pre-existing, non-deterministic test flake logged rather than fixed (see Deviations below).

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `dxa-partition.test.ts`'s CLI test cases spawned a bare `"node"` instead of `process.execPath`**
- **Found during:** post-task-3 full `npm run test:automated` regression sweep (not caught by the task-scoped `<verify>` commands, which only run `dxa-partition.test.ts` in isolation)
- **Issue:** The three task-3 `[CLI]` test cases used `spawnSync("node", ...)`, which resolves through `$PATH` and need not be the Node build (>= 22.18, this repo requires >= 24) that can type-strip `.ts` sources. `anno-cli-path-consumers.test.ts`'s WR-20 structural gate scans every `.test.ts` file for exactly this pattern and failed, naming both offending lines.
- **Fix:** Changed all three `spawnSync("node", ...)` calls to `spawnSync(process.execPath, ...)`.
- **Files modified:** `src/mcp/vice/dxa-partition.test.ts`
- **Verification:** `node --test dxa-partition.test.ts anno-cli-path-consumers.test.ts` -- 46/46 pass; full `npm run test:automated` re-run afterward shows no WR-20 failure.
- **Committed in:** `e8a2fdb`

---

**Total deviations:** 1 auto-fixed (1 bug: a project-wide structural gate the task-scoped verify commands don't cover, caught by the mandatory post-wave full-suite regression sweep).
**Impact on plan:** Necessary for `npm run test:automated` to stay at the phase's recorded floor. No scope creep -- the fix touched only the three offending `spawnSync` call sites.

## Issues Encountered

One pre-existing, non-deterministic test flake was observed twice during this session's `npm run test:automated` runs and once more explicitly ruled unrelated to this plan's own changes: `host-scripts.test.ts`'s `.gitignore`/`resourceEntries()` two-way-parity test intermittently reports `.gitignore is missing /tools/vendor/dxa/dxa`, even though `src/mcp/vice/resources/` holds no `dxa` file at rest and this plan's own commits touch neither `install-resources.ts` nor `resources/`. Confirmed non-deterministic: it FAILED on the very first `npm run test:automated` invocation of this session (before any 35-03 code existed) and PASSED on an immediate full re-run with no code change in between, and PASSED again on the closing-floor measurement after all four commits landed. Logged to `deferred-items.md` per the scope-boundary rule rather than fixed -- out of scope for this plan.

The two `anno-register.test.ts` failures (`STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` requirements-bookkeeping drift) recorded as this phase's floor by plan 35-02 are present, unchanged, in every full-suite run taken during this session.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `DXA-04` is declared by this plan alone and is now marked complete.
- `dxa-partition.ts` is the ONE producer of a ground-truth partition in this project; `dxa-listing.ts` (plan 35-02) produces dxa's own claim. Neither module imports the other, and a rate comparing the two is always a caller's own computation, naming both -- exactly the seam Phase 38's real-release recovery-rate measurement needs to build on.
- No `PROOF-01` claim and no data-recovery-rate claim about dxa on real cracked code appears anywhere in this plan's code, tests, or rendered output -- confirmed by both a runtime grep (the task-3 CLI verify) and a source-level review of every file this plan wrote.
- One pre-existing, non-deterministic test flake (unrelated to this plan) is logged in `deferred-items.md` for a future maintenance pass.
- No blockers.

## Self-Check: PASSED

All 7 claimed created files confirmed present on disk (`src/mcp/vice/dxa-partition.ts`,
`dxa-partition.test.ts`, `fixtures/dxa/fixture.a`, `fixture.rep`, `fixture.prg`,
`basic-stub.prg`, `.planning/phases/35-dxa-vendored-and-parsed/deferred-items.md`). All 4
claimed commit hashes (`1d62c19`, `cec1eec`, `5f745d8`, `e8a2fdb`) confirmed in `git log`.
All task-level `<acceptance_criteria>` and the plan-level `<verification>` block re-ran green
immediately before this SUMMARY was written: `node --test dxa-partition.test.ts` -- 34/34 pass
(with 145/131/3/90/4 asserted as literals against `fixture-baseline.txt`); `node --test
hostpath-consumers.test.ts` -- green with `HOST_TOOL_FAMILY_FLOOR` at `2 + 1 + 2 + 1`; `node
dxa-partition.ts byte-derived fixtures/dxa/basic-stub.prg` prints both tier names, the
positive class, and no rate about dxa on real code; `npm run typecheck`, `node --test
ci-suite-coverage.test.ts test-gate.test.ts` -- both green. Full `npm run test:automated`
closing-floor run: exactly the two pre-existing `anno-register.test.ts` failures recorded as
this phase's floor by plan 35-02 -- no regression from this plan.

---
*Phase: 35-dxa-vendored-and-parsed*
*Completed: 2026-09-04*
