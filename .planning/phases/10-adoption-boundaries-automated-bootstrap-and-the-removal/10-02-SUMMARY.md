---
phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
plan: 02
subsystem: infra
tags: [regenerator2000, gzip, base64, node-zlib, node-test, acme, illegal-opcodes]

# Dependency graph
requires:
  - phase: 09-regenerator2000-assumption-probe
    provides: "Verified regenerator2000 0.9.20 install, D-01/D-04/D-05 decisions, .vsf machine-type limit finding"
provides:
  - "synthesizeProject(bytes, opts) -- pure Node .regen2000proj synthesiser, no I/O"
  - "parsePrg / flatImageOrigin -- .prg and flat-64K input parsing"
  - "decodeRawData -- the gzip+base64 inverse, for round-trip proof"
  - "First-hand crate-source verification of ProjectState's exact JSON shape (evidence file)"
affects: [10-03, 10-04, 10-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-transform module with no filesystem/network I/O, mirroring d64-parse.mjs's documented-scope-limit-inline convention"
    - "SKIP_REASON computed once at module scope, node:test's { skip } option, never a hand-rolled early return (mirrors disasm-roundtrip.test.ts's D-08/D-11 gate shape)"

key-files:
  created:
    - .claude/mcp/vice/r2000-project.ts
    - .claude/mcp/vice/r2000-project.test.ts
    - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-environment-recheck.txt
  modified: []

key-decisions:
  - "Confirmed DRIFT: none -- installed regenerator2000 0.9.20 and all seven load-bearing flags match RESEARCH.md's 2026-08-20 capture exactly"
  - "Re-verified Assumption A1 first-hand against the crate source (project.rs/settings.rs/types.rs) rather than trusting CONTEXT.md's paraphrase -- no corrections needed, every predicted field name/type/literal matched"
  - "settings.use_illegal_opcodes and settings.system are unconditionally forced with no override parameter, matching D-05; the synthesised object has exactly four top-level keys, matching D-04's minimality strategy"

patterns-established:
  - "A future .regen2000proj writer imports synthesizeProject from r2000-project.ts rather than hand-building the shape -- this module is now the one authoritative place"

requirements-completed: [R2000-09]

# Metrics
duration: 17min
completed: 2026-08-20
---

# Phase 10 Plan 02: regenerator2000 project bootstrap synthesiser Summary

**Pure Node `.regen2000proj` synthesiser (gzip+base64+minimal JSON) that a real regenerator2000 0.9.20 loads and exports ACME source from, with a forced `use_illegal_opcodes`/`system` pair pinned by planted-violation-verified tests.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-20T15:08:26Z
- **Completed:** 2026-08-20T15:25:44Z
- **Tasks:** 3/3 completed
- **Files modified:** 3 (all new)

## Accomplishments
- Confirmed the installed regenerator2000 (0.9.20) exactly matches the CLI surface every D-01/D-04/D-05/D-09/D-10/D-11 decision in this phase was measured against, with a first-hand (not paraphrased) crate-source re-verification of `ProjectState`'s exact JSON shape
- Built `synthesizeProject()`, an I/O-free transform that turns raw bytes into a `.regen2000proj` file with exactly four top-level keys -- no version pin, no allow-list, matching D-04's minimality strategy
- Proved the whole bootstrap end-to-end against the real binary: a Node-synthesised project containing an illegal opcode (`lax` zeropage) loaded and exported real ACME source via `regenerator2000 --headless --export_asm --assembler acme`, with the exported text containing `lax`, proving `use_illegal_opcodes: true` was actually honoured -- not merely written
- Ran the ENGINEERING_RULES §6 planted-violation check twice (omitting `use_illegal_opcodes`; hardcoding a wrong `system` literal) and watched both fail RED before reverting to GREEN, so the D-05 forced-settings assertions are proven non-vacuous rather than assumed

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-check the environment against RESEARCH.md's capture, and re-read ProjectState from the crate source** - `b98d632` (docs)
2. **Task 2: r2000-project.ts -- the minimal, forced-settings `.regen2000proj` synthesiser** - `a2beb78` (feat)
3. **Task 3: r2000-project.test.ts -- shape unit tests plus a gated real-regenerator2000 load** - `6734c2d` (test)

**Plan metadata:** committed alongside this summary (docs)

## Files Created/Modified
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-environment-recheck.txt` - Execution-time re-check of regenerator2000's version/flags against RESEARCH.md's capture (`DRIFT: none`), plus first-hand crate-source citations for `ProjectState`'s exact shape
- `.claude/mcp/vice/r2000-project.ts` - Pure `.regen2000proj` synthesiser: `synthesizeProject`, `parsePrg`, `flatImageOrigin`, `decodeRawData`, `R2000_SYSTEM_C64`
- `.claude/mcp/vice/r2000-project.test.ts` - 11 always-run unit tests pinning the exact JSON shape, plus a gated integration test (`R2000_BIN`/`VICE_REQUIRE_R2000`) that runs a real regenerator2000 against a synthesised project

## Decisions Made
- Re-verified Assumption A1 directly against `regenerator2000-core-0.9.20`'s source rather than trusting CONTEXT.md's citation, per Task 1's explicit instruction -- confirmed the three no-default `ProjectState` fields are exactly `origin`/`raw_data_base64`/`blocks`, `origin` is a plain JSON number (`Addr` is `#[serde(transparent)]` over `u16`), and `System::C64` is the exact literal `Commodore 64` (`#[serde(transparent)]` over `String`). One item noted for completeness but not requiring a synthesis change: `ProjectState.settings` itself carries its own `#[serde(default)]`, so an entirely-absent `settings` object would still parse -- the two forced fields are forced by this module's own choice to always write `settings`, not because the schema requires the object's presence. This sharpens, but does not contradict, D-05.
- Kept `settings.use_illegal_opcodes` and `settings.system` with zero override path (no parameter, no flag) per D-05, verified non-vacuous by the planted-violation check below.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3/4 auto-fixes were needed; the crate source matched every prediction in the plan and RESEARCH.md exactly.

## Issues Encountered

**Planted-violation check outcomes (ENGINEERING_RULES §6), as required by Task 3's acceptance criteria:**

1. Temporarily omitted `settings.use_illegal_opcodes` from the synthesised object.
   - RED: `not ok 2 - synthesizeProject: exact settings key set, forced values (D-05, pinned)` (diff showed the missing key) and `not ok 13` (the gated integration test's exported-`.a`-contains-`lax` assertion also failed, since regenerator2000 no longer decoded the illegal opcode without the forced setting).
   - Reverted; re-ran: GREEN, 13/13 pass, file byte-identical to the committed version (confirmed via `diff`).
2. Temporarily hardcoded `settings.system` to `"PLANTED-WRONG-SYSTEM"` instead of honouring the caller-supplied `system` parameter.
   - RED: `not ok 2` (settings shape assertion) and `not ok 3 - synthesizeProject: explicit system is written verbatim, never inferred` (both showed the planted literal instead of the expected value).
   - Reverted; re-ran: GREEN, 13/13 pass, file byte-identical to the committed version.

**Full test-suite run (`npm test`, all 1884 tests including manual-only live suites) surfaced one pre-existing failure unrelated to this plan's files:** `repo-root.test.ts:152`'s "path agreement... the agreed directory must not sit under .claude" assertion fails in this environment because the worktree itself is checked out at `.../.claude/worktrees/agent-ad5354c1c17d11bab/...` -- a path that structurally contains `.claude` regardless of any code this plan touched. Confirmed out of scope: neither `r2000-project.ts` nor `r2000-project.test.ts` is imported by or related to `repo-root.test.ts`, and the same single failure reproduces identically under `npm run test:automated` (1711 pass / 1 fail / 5 todo, vs. `npm test`'s 1848 pass / 1 fail / 30 skip / 5 todo -- the extra skips being the live/manual suites `test:automated` excludes). Per the scope boundary rule, this is not fixed here; noted for whichever wave/orchestrator context has visibility into worktree-path assumptions in `repo-root.test.ts`.

## User Setup Required

None - no external service configuration required. `regenerator2000` and `acme` were already installed on this host per Phase 9/RESEARCH.md.

## Next Phase Readiness

`synthesizeProject()` is ready for `r2000-launch.ts` (plan 10-04's argv-builder/spawn seam) to call directly -- it needs only raw bytes plus an `origin`, and optionally a `system` override for non-C64 targets. `parsePrg`/`flatImageOrigin` cover the `.prg` and flat-64K input paths named in D-03; `.d64` named-entry extraction (also D-03/D-02) is explicitly out of this plan's scope and belongs to plan 10-03 (`d64-parse.mjs` sibling). No blockers.

## TDD Gate Compliance

Not applicable -- this plan's frontmatter is `type: execute`, not `type: tdd`; Task 3 (test) is a standard `auto` task, not marked `tdd="true"`. The planted-violation check above is ENGINEERING_RULES §6's own non-vacuous-verification requirement, run manually against the committed code (not a RED/GREEN/REFACTOR commit sequence), and both outcomes are recorded above rather than as separate commits.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/r2000-project.ts`
- FOUND: `.claude/mcp/vice/r2000-project.test.ts`
- FOUND: `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-environment-recheck.txt`
- FOUND: commit `b98d632` (Task 1)
- FOUND: commit `a2beb78` (Task 2)
- FOUND: commit `6734c2d` (Task 3)

---
*Phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal*
*Completed: 2026-08-20*
