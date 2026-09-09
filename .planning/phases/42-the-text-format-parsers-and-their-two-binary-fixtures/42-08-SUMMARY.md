---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 08
subsystem: testing
tags: [structural-guard, single-seam, text-monitor-parsers, PARSE-03, node-test]

# Dependency graph
requires:
  - phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
    provides: "the five owning parser modules (textmon-memmap.ts, textmon-cpuhistory.ts, textmon-backtrace.ts, textmon-profile.ts, textmon-registers.ts) and the fixture loader (textmon-fixtures.ts) from plans 42-01/42-02/42-03"
provides:
  - "a mechanical, structural assertion of PARSE-03's third clause: each text format has exactly one owning module, asserted as an injective relation over a hand-pinned, non-vacuous family floor"
  - "a byte-safe census reader proven against this tree's own NUL-byte-containing module (anno-memmap-render.ts), so the guard cannot silently shrink its scanned set"
  - "a shared violation predicate exercised by both the real full-tree scan and planted-violation controls, proving the guard is capable of failing"
affects: [text-tools.ts, stock-dispatch.ts, capability-registry.ts]

# Actuals (#2632)
actuals:
  tokens: 9354
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "single-owning-module structural guard, fifth instance of the tree's own pattern (family floor + pinned-equals-measured companion, declared map asserted against disk, named-absence-before-existence, planted-violation control through the real predicate)"
    - "two deliberately different census rules in one file: a literal census that does NOT strip comments (structural knowledge in a comment still counts) and an import census that IS statement-anchored (a specifier merely quoted in a comment does not count)"

key-files:
  created:
    - src/mcp/vice/textmon-seam.test.ts
  modified: []

key-decisions:
  - "The access map's (memmap's) declared literal-consumer set has FOUR extra entries beyond the owner and its own test file, not the ONE the plan's decision record anticipated (the fixture loader's own test). Measured against this tree at plan time, the header text 'addr: IO  ROM RAM' is also genuinely present in text-tools.test.ts, stock-dispatch.test.ts and text-capability-probe.test.ts -- each a legitimate test exercising the declared handler module or a downstream probe/conformance layer with a realistic memmapshow stub, each carrying its own stated reason in the data. Declaring a narrower set to match the plan's prose would have made the guard red against a codebase that has done nothing wrong."
  - "For the CPU history and flat profile formats, the declared literal-consumer set does NOT include the parser's own test file -- measured, not assumed. NV-BDIZC (cpuhistory's flag-print order) and the \\u202f escape (profile's thousands-separator spelling) appear ONLY in their respective owner modules; neither test file references the literal itself. A uniform 'owner plus its own test file' template would have been wrong for two of the five formats."
  - "This guard's own file (textmon-seam.test.ts) is declared as a literal consumer of all five formats, mirroring anno-seam.test.ts's own TEST_FILES_NAMING_SQLITE precedent: the file necessarily spells every format's literal as data (once in the owner map, again in every planted-violation fixture), which is knowledge OF the literal for comparison purposes, never a reader of a live format reply."
  - "The import-consumer declarations for CPU history, backtrace, flat profile and IO registers currently list ONLY each parser's own test file, not text-tools.ts. Measured in this worktree (forked before the sibling wave-3 plan that wires those four handlers through text-tools.ts has merged), text-tools.ts imports only textmon-memmap.ts today. This is the guard's own 'grows only through a deliberate edit' philosophy working as intended: when the sibling plan's wiring lands, text-tools.ts becoming a second importer for those four parsers is expected to redden this file until a deliberate follow-up names the plan that added it -- not a defect in this deliverable."
  - "The registers format's distinctive literal is the fixed row marker '>C:' (DUMP_ROW_PREFIX_RE/DUMP_ROW_RE's anchor), chosen after measuring that a candidate literal drawn from the sprite-table header ('Sprites: ') collides with an unrelated TypeScript type annotation elsewhere in the tree ('allSprites: Record<...>') -- a false positive a substring census cannot distinguish from a real reference."

requirements-completed: [PARSE-03]

coverage:
  - id: D1
    description: "Family floor (TEXTMON_MODULE_FLOOR) with pinned-equals-measured companion over the textmon- module family"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-seam.test.ts#the hand-pinned TEXTMON_MODULE_FLOOR equals the measured textmon- family count"
        status: pass
    human_judgment: false
  - id: D2
    description: "Injective owner map: one module per format, one format per module, both directions asserted"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-seam.test.ts#the owner map is injective in both directions"
        status: pass
    human_judgment: false
  - id: D3
    description: "Byte-safe census proven against the tree's own NUL-byte module (anno-memmap-render.ts)"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-seam.test.ts#the scanned module set includes the NUL-byte-containing module by name"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-format closed literal-consumer set equality, measured against the real tree with individually stated reasons"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-seam.test.ts#(access map|CPU history|backtrace|flat profile|IO registers): the measured literal-consumer set equals the declared set exactly"
        status: pass
    human_judgment: false
  - id: D5
    description: "Statement-anchored per-format import-consumer set equality"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-seam.test.ts#(access map|CPU history|backtrace|flat profile|IO registers): the measured import-consumer set equals the declared set exactly"
        status: pass
    human_judgment: false
  - id: D6
    description: "Shared violation predicate exercised by the real full-tree scan and four planted-violation controls with three clean counterparts"
    verification:
      - kind: unit
        ref: "src/mcp/vice/textmon-seam.test.ts#planted violation 1-4 / clean counterpart 1-3"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 08: Structural Single-Owning-Module Guard for the Five Text Formats Summary

**A fifth structural-guard test file, `textmon-seam.test.ts`, mechanically enforces that each of the five text-monitor formats (access map, CPU history, backtrace, flat profile, IO registers) has exactly one owning parser module and a closed, measured set of legitimate raw-text and import consumers -- with the declared sets measured against the real tree rather than assumed from the plan's own prose.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-09
- **Tasks:** 2
- **Files created:** 1

## Accomplishments

- `TEXTMON_MODULE_FLOOR = 5 + 1` (five parsers plus the pre-existing fixture loader) with a pinned-equals-measured companion, so both a shrinking and a growing `textmon-` family fail deliberately.
- A 5-entry owner map, asserted injective in both directions (no module owns two formats, no format is owned by two modules), with every module and test file asserted present on disk.
- A distinctive structural literal chosen from each owner's REAL source, verified by direct measurement rather than trusted from the plan's prose: the access map's `addr: IO  ROM RAM` header, CPU history's `NV-BDIZC` flag-print order, backtrace's `[SP +` stack-pointer field opener, flat profile's `\u202f` thousands-separator escape (matched case-insensitively for its trailing hex digit), and IO registers' `>C:` hex-dump row marker.
- A byte-safe census reader (`readFileSync().toString("utf8")`), proven against this tree's own NUL-byte-containing shipped module, `anno-memmap-render.ts` -- measured that a plain `grep` (without `-a`) silently skips this file (`file(1)` classifies it as binary data, exit code 1 on a real match), and that this guard's reader does not.
- Per-format closed literal-consumer set equality (measured set == declared set, neither a subset nor a superset), each declared entry outside the bare owner carrying its own stated reason in the data.
- A statement-anchored import census per parser module, mirroring `load-order.test.ts`'s own `IMPORT_REPO_ROOT_PATTERN` discipline: a specifier quoted only inside a comment is never counted as an import, proven by a dedicated regression case and by clean counterpart 3.
- A shared `checkViolations()` predicate called by both the real full-tree scan (one test per format) and four planted-violation cases (literal in code, literal in a comment, an import from an undeclared module, a type-only import from an undeclared module) plus three clean counterparts -- proving the guard is capable of failing, not merely present.
- A closing test stating the guard's own scope: it checks WHERE format knowledge lives, never WHETHER a parser decodes correctly -- built by concatenating each parser's exported function name with a runtime-constructed open-paren, so the file's own text never contains a call-shaped token that would trip its own scope check.

## Task Commits

Both tasks landed in a single commit, since Task 2 builds directly on Task 1's data structures inside the same file and the two verify gates were run together as the file was completed -- there is no separate production module for a RED/GREEN split to apply to; this is a pure structural-guard test file, the same shape `hostpath-consumers.test.ts` and `anno-seam.test.ts` take.

1. **Task 1 + Task 2: family floor, owner map, byte-safe census, literal-consumer equality, import census, planted-violation controls, closing scope case** - `c9dc8a9e` (test)

**Plan metadata:** committed separately (this SUMMARY.md).

## Files Created/Modified

- `src/mcp/vice/textmon-seam.test.ts` - the structural single-owning-module guard for the five text-monitor formats (687 lines, 33 test cases, all green)

## Decisions Made

See `key-decisions` in the frontmatter above. In short: every declared consumer set in this file was MEASURED against the real tree at execution time rather than assumed from the plan's own prose, which undercounted the access map's legitimate extra consumers (four, not one) and overcounted two other formats' test-file consumers (CPU history and flat profile's own test files do not reference their format's literal at all). The registers literal was chosen after discovering a candidate ('Sprites: ') collides with an unrelated TypeScript type annotation elsewhere in the tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The declared literal-consumer sets in the plan's own decision record did not match the measured tree**

- **Found during:** Task 1, while building the per-format literal-consumer census
- **Issue:** The plan's decision record states the access map's header text "appears in exactly one existing place with a legitimate reason" beyond its owner and owner test (the fixture loader's own test). Measured against this tree, it is ALSO genuinely present in `text-tools.test.ts`, `stock-dispatch.test.ts` and `text-capability-probe.test.ts`. Declaring the narrower set the plan anticipated would have made the equality assertion fail against a codebase that has done nothing wrong -- these are real, legitimate consumers (each exercising a different layer: the handler's own test, a dispatch-level conformance test, and PARSE-04's capability probe), not a defect to fix.
- **Fix:** Declared all six real consumers (owner, owner test, and four legitimate extras) with individually stated reasons, matching the guard's own "each declared entry outside the owner carries its own stated reason" rule rather than the plan's "one extra entry" prose.
- **Files modified:** `src/mcp/vice/textmon-seam.test.ts`
- **Verification:** `node --test textmon-seam.test.ts` reports the access map's literal-consumer-set equality test passing (measured == declared, six entries).
- **Committed in:** `c9dc8a9e`

**2. [Rule 1 - Bug] This guard's own file self-triggered its own literal and scope-boundary checks**

- **Found during:** Task 1/2, first test run
- **Issue:** Because `FORMAT_OWNERS` necessarily declares each format's literal as a plain string (`">C:"`, `"\u202f"`, etc.) and the header comments discussed each literal by name, `textmon-seam.test.ts` itself contained every format's literal and was flagged as an undeclared consumer of its own data -- and a header-comment mention of `parseAccessMap()` (with the closing paren) tripped the guard's own "never call a parser function" scope check.
- **Fix:** Declared `textmon-seam.test.ts` as a literal consumer of all five formats (mirroring `anno-seam.test.ts`'s own `TEST_FILES_NAMING_SQLITE` self-declaration precedent, with a single shared `SELF_DECLARATION_REASON` constant), and rewrote the scope-check comment to describe the parser functions without concatenating their name directly against an open-paren in this file's own source text.
- **Files modified:** `src/mcp/vice/textmon-seam.test.ts`
- **Verification:** `node --test textmon-seam.test.ts` — 33/33 passing, `npm run typecheck` clean.
- **Committed in:** `c9dc8a9e`

---

**Total deviations:** 2 auto-fixed (both Rule 1 -- measured-reality corrections to the guard's own data and to its self-reference handling). **Impact:** Neither changes the guard's discipline; both make it correctly reflect the tree it actually scans, which is the entire point of a structural assertion.

## Known Stubs

None. This plan adds only a test file with no production code and no placeholder data.

## Issues Encountered

- **Baseline measurement required `npm ci` first.** This worktree had no `node_modules/` (the SessionStart hook that provisions it had not run for this worktree). Ran `npm ci --no-audit --no-fund` per this project's own documented "provisioning this package's own node_modules via npm ci is not covered by the never-auto-install ban" carve-out, then measured the baseline.
- **Measured `npm run test:automated` baseline: exit 1, 8 failing tests** at plan start -- `anno-register.test.ts` (2: `annoRegisterEntryFor()`, `DIRECTION 5 basis integrity`), `anno-import.test.ts` (1: `planted violation (the negative control)`), `dxa-seam.test.ts` (4: all `dxa.disassemble` argv cases, vendored dxa unbuilt), `build-atomic.test.ts` (1: `path agreement`). All four are named in this project's own standing notes as worktree-location artifacts, not caused by this plan.
- **Two subsequent full-suite runs measured 9 and 10 failures respectively**, each time due to a DIFFERENT environmental flake (a timing-sensitive `text-protocol.test.ts` quiescence-window control on one run, a `skill-honesty-checks.test.ts` scratch-file race on another) -- both confirmed to pass in isolation (`node --test text-protocol.test.ts`: 34/34 green). `textmon-seam.test.ts` and its five sibling parser test files never appeared among the failing tests in any run. Per this project's own note ("Suite races on repo-tree scratch files": an intermittent failing run is a known race, not a regression), these are pre-existing environmental noise, not new failures introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `textmon-seam.test.ts` mechanically enforces PARSE-03's single-owning-module clause for all five text formats today, against the tree as it exists at this wave.
- **Known, expected follow-up:** the sibling wave-3 plan (42-07, running concurrently in its own worktree) wires `text-tools.ts` to import `textmon-cpuhistory.ts`, `textmon-backtrace.ts`, `textmon-profile.ts` and `textmon-registers.ts` in addition to `textmon-memmap.ts`. Once that lands, this guard's per-format import-consumer-set equality tests for those four formats will go red (a new, undeclared importer appearing) -- this is the guard doing its job, not a defect. A deliberate follow-up edit to this file's `importConsumers` arrays, naming plan 42-07, is expected and should add `text-tools.ts` to those four formats' declared importer sets once the wiring is verified correct.
- No blockers for phase completion from this plan's own deliverable.

## Self-Check: PASSED

- `[ -f src/mcp/vice/textmon-seam.test.ts ]` → FOUND
- `git log --oneline --all | grep -q c9dc8a9e` → FOUND
- `node --test textmon-seam.test.ts` → 33/33 pass
- `node --test textmon-seam.test.ts textmon-memmap.test.ts textmon-cpuhistory.test.ts textmon-backtrace.test.ts textmon-profile.test.ts textmon-registers.test.ts` → 143/143 pass
- `npm run typecheck` → clean, no `error TS`
- `grep -ac "TEXTMON_MODULE_FLOOR" textmon-seam.test.ts` → 6 (>= 3 required)
- File is 687 lines (>= 160 min_lines required)
- 0 NUL bytes in this SUMMARY.md and in textmon-seam.test.ts

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
