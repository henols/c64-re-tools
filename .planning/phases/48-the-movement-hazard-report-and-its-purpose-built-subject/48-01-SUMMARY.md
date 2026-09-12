---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
plan: 01
subsystem: analysis
tags: [hazard-report, self-modifying-code, disasm, anno-store, cli, mcp-tool, acme]

requires:
  - phase: 45-decomposition-to-closure-disagreement-first
    provides: the runtime evidence layer (anno_evid_exec) whose rows can strengthen a hazard finding's detection strength
provides:
  - a purpose-built ACME source subject with a planted opcode-byte self-modification, assembled and committed through a deterministic real-ACME regenerator
  - anno-hazard-report.ts, a pure, read-only movement-hazard report module with a class-2 (self-modifying-code) detector
  - the anno_hazard_report MCP tool and the `anno hazard-report` CLI verb, both reaching the same pure function from a real store and image
  - an ANNO_VERB_REGISTER entry, a raised CLI verb floor (5 -> 6), and a skill routing entry proving the whole slice end to end
affects: [48-02, 48-03, 48-04, 48-05, 48-06]

actuals:
  tokens: 22393
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure read-only report module: every input arrives as an already-fetched argument (bytes/origin/ranges/labels/comments/xrefs/execObservations); the module never opens a store, a file, a child process, or a path-translation module. Structurally asserted by a test reading the module's own source text for a list of forbidden call concepts."
    - "A second, deliberately separate small vocabulary (three detection-strength tokens) kept apart from the existing five-grade confidence vocabulary by spelling and by axis, recorded as a departure in the module's own header rather than silently duplicating a rule."
    - "Three-outcome region disposition (hazard-reported / no-signal / unclassified) with no boolean anywhere and always-emitted named limits stating that absence of a finding is never evidence of safety."
    - "A read-only MCP verb and CLI verb both fetch their own inputs and call the identical pure function once, following the existing observed-execution disagreement query's shape exactly (lazy `anno-cli.ts` import from anno-tools.ts to keep MCP startup cost unchanged)."

key-files:
  created:
    - src/mcp/vice/anno-hazard-report.ts
    - src/mcp/vice/anno-hazard-report.test.ts
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-smc.a
    - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-register.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/package.json
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/lib/anno-cli-invocations.mjs
    - src/mcp/vice/anno-verb-coverage.test.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/module-classification.ts
    - src/skills/c64-program-recon/references/tool-selection.md

key-decisions:
  - "anchorAddress names the HOST instruction whose bytes get overwritten (not the writer instruction), and blockedAddress names the exact byte written to. This lets two different writers hitting the same host's opcode byte and operand byte both anchor at the same address with different mechanisms, and lets execution-observation strengthening ask 'was the modified code actually observed running' rather than 'did the writer run' -- the more meaningful corroboration question."
  - "The literal-target detector only reads absolute/absolute-indexed/zeropage/zeropage-indexed addressing modes; indirect and indirect-indexed modes are excluded by construction and the miss is named as a permanent limit rather than attempted."
  - "The planted class-2 construction is an opcode-byte patch (a self-arming loop that stores the RTS opcode over its own host instruction's first byte), deliberately NOT the operand-byte idiom the existing export-asm smc.a fixture already carries, per the plan's own instruction to prove the harder, control-flow-changing case."
  - "The plan's two literal <verify> CLI invocations named `--store src/mcp/vice/fixtures/export-asm/smc.annostore.json`, which is a JSON export sidecar, not a real SQLite annotation store -- openStore() correctly refuses it as 'not an annotation store'. Verified instead against a freshly created, real, empty .annostore file with the same image, which is what the verb's own read-only contract expects; the finding and mechanism strings match exactly what the plan's <verify> checks for."

requirements-completed: [BUILD-04]

coverage:
  - id: D1
    description: "One hazard class proven end to end: a committed synthetic subject assembles under real ACME 0.97, a planted opcode-byte self-modification is found by the class-2 detector from decoded bytes alone, and a negative control (the committed tracer.prg) produces no finding of that class."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-2: the committed smc.prg bytes produce exactly one finding, mechanism store-target-in-instruction-operand-byte"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-2: the committed tracer.prg bytes yield zero class-2 findings (negative control)"
        status: pass
      - kind: e2e
        ref: "CLI: node src/mcp/vice/vice-proxy.ts anno hazard-report --store <empty .annostore> --image src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg | grep -c store-target-in-instruction-opcode-byte"
        status: pass
    human_judgment: false
  - id: D2
    description: "The report module is structurally read-only: no synchronous file-write call, no store-open entry point, no cross-reference-write entry point, no apply-write entry point, no live-session import, no path-translation module name anywhere in its own source text."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard read-only: the module contains no file-write call, no store-open call, no cross-reference write call, no apply-write call, no live-session import and no path-translation import"
        status: pass
    human_judgment: false
  - id: D3
    description: "The report is reachable from a real store on disk through both the MCP verb (anno_hazard_report) and the CLI verb (anno hazard-report), and neither opens a second store handle or re-derives the RangeRow -> BlockEntry mapping."
    requirement: BUILD-04
    verification:
      - kind: integration
        ref: "anno-tools.test.ts, anno-cli.test.ts, anno-cli-invocations.test.ts (full suite run, no new failures beyond the six-name measured baseline)"
        status: pass
      - kind: e2e
        ref: "CLI live invocation against smc.prg and hazard-subject.prg"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two findings sharing an address but differing in class or mechanism both survive; two findings identical in class/anchor/mechanism are emitted once. Output is sorted by anchor address, then hazard class, then mechanism."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard shape: two findings at the same anchor address with different mechanisms both survive; identical triples appear once"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard order: calling the builder twice on the same input returns deeply equal results, and findings are non-decreasing by anchor address"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty and single-element inputs are answered, never thrown on, and never answered as clean: a zero-range store returns a zero denominator with empty findings/regions, and a no-signal region's rendered text states plainly that no detection is not evidence of safety."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard shape: an empty input returns a zero denominator, empty findings and empty regions, never throws, never reads as 'no hazards'"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard shape: a single-range store over an image with zero findings reports that range as no-signal, and the limits state that no detection is not evidence of safety"
        status: pass
    human_judgment: false
  - id: D6
    description: "The CLI printer never prints a percentage, rate, ratio or single combined verdict; every region-outcome heading and the findings heading print their own count against the report's own denominator."
    requirement: BUILD-04
    verification: []
    human_judgment: true
    rationale: "This is a rendering-format property (absence of a specific class of output across a hand-written printer function) that no automated test in this plan's own suite asserts directly -- confirmed by code inspection and by the live CLI runs above, but a human reviewing the printed output is the stronger check for 'never reads as a combined verdict.'"

duration: 38min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 01: The Movement-Hazard Report and Its Purpose-Built Subject Summary

**A purpose-built ACME subject with a planted opcode-byte self-modification, a pure read-only hazard-report module that finds it (and the pre-existing export-asm operand-byte case) from decoded bytes alone, reached from a real store through both an MCP tool and a CLI verb.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-12T20:14:00Z
- **Completed:** 2026-09-12T20:52:40Z
- **Tasks:** 3
- **Files modified:** 18 (6 created, 12 modified)

## Accomplishments

- A committed, purpose-built C64 program (`hazard-subject.a` / `hazard-subject-smc.a`) that genuinely self-modifies via an opcode-byte patch (a self-arming loop that stores the RTS opcode over its own host instruction), assembled by a deterministic, refuse-before-write regenerator against real ACME 0.97
- `anno-hazard-report.ts`: a pure, read-only movement-hazard report module with a class-2 (self-modifying-code) detector, its own three-token detection-strength vocabulary kept structurally separate from the existing five-grade confidence vocabulary, a three-outcome region disposition with no boolean anywhere, and always-emitted named limits (the indirect-indexed miss, and "no finding is not evidence of safety")
- The `anno_hazard_report` MCP tool and the `anno hazard-report` CLI verb, both fetching their own inputs and calling `buildHazardReport()` exactly once against a real annotation store and a real image
- An `ANNO_VERB_REGISTER` entry, the CLI verb floor raised 5 -> 6, and a skill routing entry in `c64-program-recon`'s tool-selection reference

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — one planted self-modification, found from bytes alone, on one path** - `8755f34a` (feat)
2. **Task 2: The pure read-only report module, the class-2 detector, and the detection-strength vocabulary** - `bf040815` (feat)
3. **Task 3: Reach the report from a real store — the MCP verb, the CLI verb, the registry entry and the verb floor** - `455b638f` (feat)

## Files Created/Modified

- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.a` - root ACME source, BASIC stub + single `!source` line
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-smc.a` - the planted opcode-byte self-modification
- `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` - deterministic, refuse-before-write regenerator
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` - committed real-ACME-assembled image
- `src/mcp/vice/anno-hazard-report.ts` - the pure report module and its class-2 detector
- `src/mcp/vice/anno-hazard-report.test.ts` - 17 tests covering detection, shape, order, and read-only structure
- `src/mcp/vice/anno-tools.ts` - `anno_hazard_report` tool definition, assertion, dispatch arm, read-only registration
- `src/mcp/vice/anno-register.ts` - registry entry for `anno_hazard_report`
- `src/mcp/vice/anno-cli.ts` - the `hazard-report` CLI verb (parser, printer, command function)
- `src/mcp/vice/package.json` - ships `anno-hazard-report.ts`
- `scripts/lib/anno-cli-verbs.mjs`, `src/mcp/vice/anno-verb-coverage.test.ts` - verb floor 5 -> 6
- `scripts/lib/anno-cli-invocations.mjs` - REQUIRED_FLAGS/FLAG_KINDS entries for `hazard-report`
- `src/skills/c64-program-recon/references/tool-selection.md` - routing entry naming `anno hazard-report`
- `src/mcp/vice/anno-cli.test.ts`, `anno-cli-path-consumers.test.ts`, `hostpath-consumers.test.ts`, `module-classification.ts` - regression repairs for hand-pinned counts and a line citation this change's insertions shifted (see Deviations)

## Decisions Made

- `anchorAddress` names the modified (host) instruction, not the writer instruction, and `blockedAddress` names the exact overwritten byte -- this lets two independent writers hitting the same host's opcode and operand bytes both anchor at one address with two distinct, both-surviving mechanisms, and lets execution-observation strengthening ask the more meaningful question ("was the modified code observed running") rather than "did the writer run."
- The literal-target detector reads only absolute/absolute-indexed/zeropage/zeropage-indexed addressing; indirect and indirect-indexed modes are excluded by construction, and the miss is a permanent, named limit (D-48-C in the plan's own vocabulary, not repeated here) rather than an attempted heuristic.
- The planted construction is an opcode-byte patch, not the operand-byte idiom the pre-existing `export-asm/smc.a` fixture already carries, so the two constructions are structurally distinct and the detector is proven against both shapes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3's two literal CLI `<verify>` commands named a JSON export sidecar as `--store`, which `openStore()` correctly refuses**
- **Found during:** Task 3, final verification
- **Issue:** The plan's `<verify>` block invokes `node src/mcp/vice/anno-cli.ts hazard-report --store src/mcp/vice/fixtures/export-asm/smc.annostore.json --image ...`. `smc.annostore.json` is a committed JSON export document (Phase 45's derived-half export), not a SQLite annotation store, and `openStore()` refuses it by name ("not an annotation store (file is not a database)"). Separately, `anno-cli.ts` has no direct CLI entry point at all -- the real invocation route is `node src/mcp/vice/vice-proxy.ts anno <verb> ...` (confirmed against `vice-proxy.ts`'s own `process.argv[2] === "anno"` dispatch), so the literal command as written produces no output either way.
- **Fix:** Verified the same acceptance criteria (a real store + a real image producing the expected finding and mechanism string, no "clean"/"no hazards" wording) using the correct `vice-proxy.ts anno hazard-report` invocation form against a freshly created, real, empty `.annostore` file (created via `openStore(..., { mustExist: false })`, never committed) alongside both `smc.prg` and `hazard-subject.prg`. Both runs produced the exact mechanism strings the plan's `<fails_when>` clauses check for.
- **Files modified:** None (verification-only; no fixture or source file needed to change for this fix)
- **Verification:** Live run: `node src/mcp/vice/vice-proxy.ts anno hazard-report --store <empty .annostore> --image src/mcp/vice/fixtures/export-asm/smc.prg` prints `store-target-in-instruction-operand-byte` and no "clean"/"no hazards" wording; the same command against `hazard-subject.prg` reports `store-target-in-instruction-opcode-byte` at least once.
- **Committed in:** Not applicable (no code change) -- documented here per the deviation protocol

**2. [Rule 3 - Blocking] Task 3's own edits shifted line numbers and surface/module counts that four unrelated, pre-existing guards hand-pin**
- **Found during:** Task 3, full-suite regression check after wiring the MCP/CLI surface
- **Issue:** Adding the new tool definition, CLI verb, and imports to `anno-cli.ts` and `anno-tools.ts` (a) shifted `checkAcceptedOptions`'s line number past a hand-pinned advisory citation in `module-classification.ts`; (b) added two new caller-supplied path arguments (`hazard-report --store`/`--image`) that `anno-cli-path-consumers.test.ts`'s `CLI_PATH_ARGUMENTS` inventory and its hand-pinned floor did not yet know about; (c) added a new `anno-*.ts` production module (`anno-hazard-report.ts`) that `hostpath-consumers.test.ts`'s hand-pinned `ANNO_MODULE_FLOOR` did not yet count; and (d) left three hard-coded verb-count/verb-list literals in `anno-cli.test.ts` and `scripts/lib/anno-cli-invocations.mjs` (a stale `5`, a stale `REQUIRED_FLAGS`/`FLAG_KINDS` table, and a stale `SURVIVING_VERBS` array) unaware of the sixth verb.
- **Fix:** Re-pointed the `module-classification.ts` citation to `checkAcceptedOptions`'s new line; added `hazard-report`'s two path arguments to `CLI_PATH_ARGUMENTS` and raised its floor 14 -> 16; raised `ANNO_MODULE_FLOOR` 22 -> 23 with a recorded RELATION paragraph; added `hazard-report` to `SURVIVING_VERBS`, `REQUIRED_FLAGS`, and `FLAG_KINDS`, and updated the two stale `5`/`FIVE` literals to `6`/`SIX`.
- **Files modified:** `src/mcp/vice/module-classification.ts`, `src/mcp/vice/anno-cli-path-consumers.test.ts`, `src/mcp/vice/hostpath-consumers.test.ts`, `src/mcp/vice/anno-cli.test.ts`, `scripts/lib/anno-cli-invocations.mjs`
- **Verification:** Full `npm run test:automated` run shows exactly the same six pre-existing failing test names the plan's own measured baseline records, and no others.
- **Committed in:** `455b638f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — corrected verify invocation, 1 blocking — four hand-pinned-count/citation repairs across five files)
**Impact on plan:** Both were necessary to make the plan's own acceptance bar (the measured six-failure baseline, and a working live CLI proof) actually hold. No scope creep: no new capability was added beyond what Task 3 already specified, and no pre-existing guard's *intent* was weakened -- each hand-pinned number was raised to match a real, deliberate change, exactly the discipline those guards' own headers already document for every prior raise.

## Issues Encountered

None beyond the deviations above, which are the normal "a new surface member requires updating every guard that counts surface members" cost this codebase's own hand-pinned-floor convention accepts by design.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 48-02 can append `hazard-subject-dispatch.a` and `hazard-subject-align.a` to the same root via a one-line `!source` append, per `hazard-subject.a`'s own structure.
- `HAZARD_CLASSES`, `HAZARD_DETECTION_STRENGTHS`, `HAZARD_REGION_OUTCOMES`, and `HAZARD_LIMITS` are all in place for plan 48-03 to extend with the class-1 (indexed-dispatch) and class-3 (page-alignment) detectors.
- No blockers. The end-to-end tracer slice (fixture -> real ACME -> committed image -> pure detector -> MCP verb -> CLI verb -> registry -> skill routing) is proven and committed.

---
*Phase: 48-the-movement-hazard-report-and-its-purpose-built-subject*
*Completed: 2026-09-12*

## Self-Check: PASSED

- All 6 created files found on disk (`src/mcp/vice/anno-hazard-report.ts`, `anno-hazard-report.test.ts`, `fixtures/hazard-subject/hazard-subject.a`, `hazard-subject-smc.a`, `make-hazard-subject-fixtures.mjs`, `hazard-subject.prg`).
- All 3 task commits found in git log (`8755f34a`, `bf040815`, `455b638f`).
- `npm run typecheck` exits 0.
- `npm run test:automated` shows exactly the same 6 pre-existing failing test names the plan's measured baseline records, and no others.
- Live CLI runs against `smc.prg` and `hazard-subject.prg` (via a freshly created empty `.annostore`, see Deviations) report `store-target-in-instruction-operand-byte` and `store-target-in-instruction-opcode-byte` respectively, with no "clean"/"no hazards" wording.
- `node scripts/check-npm-packages.mjs` and `node scripts/check-skill-tool-coverage.mjs` both exit 0.
- Full diff scan for planning vocabulary (`.planning/` paths, `/gsd-` names, `D-NN`/`DNN-X` decision ids, `BUILD-NN` ids, `Phase N`) across every `src/**` line this plan added returns exactly one hit: the `requirements: ["BUILD-04"]` data field in `anno-register.ts`, the single exemption the plan itself records.
