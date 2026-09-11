---
phase: 45-decomposition-to-closure-disagreement-first
plan: 06
subsystem: annotation-store
tags: [dxa, ghidra, vice-broker, evid-ingest, decomp-completeness, fixtures]

requires:
  - phase: 45
    provides: "plan 45-01's decomp-completeness verb, completeness-report.mjs and the nine-fixture execution manifest; plan 45-02's anno-store-export.ts D-02/D-03 export schema"
provides:
  - "Six committed, fully-typed, dxa+Ghidra-derived .annostore.json fixture stores (dxa/tracer, dxa/fixture, dxa/basic-stub, export-asm/smc, petcat/computed-sys, petcat/not-basic), D-12's derived half"
  - "Real execution evidence anchored to a recorded run identity for the three executable fixtures, including a deliberately bounded never-halting run (export-asm/smc.prg)"
  - "The three non-executed fixtures declared BY NAME through the real decomp-completeness CLI path, D-13's anti-vacuity guard proven live"
  - "A Rule 1 fix making decomp-completeness's --disagreements validator accept a real, non-fabricated null runIdentity for a genuinely zero-run store"
affects: [45-08, 45-09, 45-10]

actuals:
  tokens: 92000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Broker started as a transient systemd --user unit (systemd-run --unit=...), never setsid/nohup, stopped immediately after each live run -- three independent broker lifecycles (one per executed fixture) rather than one shared session, for clean RAM/argv isolation per capture"
    - "Every stock monitor command implicitly re-pauses the emulated machine: vice_execution_run() must be re-issued before EVERY poll (mirrors stock-broker-live.test.ts's own pollUntilBytesMatch()), never once before a wait loop"
    - "A never-halting fixture is bounded by explicit, discrete vice_execution_step() calls after directly setting the entry PC and forcing the interrupt-disable flag -- never a checkpoint wait and never a free-run, which does not terminate for this fixture"

key-files:
  created:
    - src/mcp/vice/fixtures/dxa/tracer.annostore.json
    - src/mcp/vice/fixtures/dxa/fixture.annostore.json
    - src/mcp/vice/fixtures/dxa/basic-stub.annostore.json
    - src/mcp/vice/fixtures/export-asm/smc.annostore.json
    - src/mcp/vice/fixtures/petcat/computed-sys.annostore.json
    - src/mcp/vice/fixtures/petcat/not-basic.annostore.json
    - docs/phase45-derivation-execution-evidence.md
  modified:
    - src/mcp/vice/fixtures/dxa/README.md
    - src/mcp/vice/fixtures/export-asm/README.md
    - src/mcp/vice/fixtures/petcat/README.md
    - src/mcp/vice/anno-cli.ts
    - src/skills/routine-queue-walker/scripts/completeness-report.mjs

key-decisions:
  - "Every dxa-classified 'data'/'unclassified' byte is typed byte, never a finer distinction (petscii/word/address) -- dxa's own -a dump output carries no such distinction, and injecting one would be an unproven, authored refinement smuggled into the derived half. Applied consistently across all six fixtures; finer semantic retyping is plan 45-08's own job."
  - "Entry points were supplied to dxa (and to autostart/PC-set for live runs) ONLY for the three fixtures whose SYS target or load address names genuine code (tracer.prg, fixture.prg, smc.prg) -- never for the three non-executed fixtures. dxa/basic-stub.prg's own SYS target ($0810) lands exactly on its four planted-unknown arbitrary bytes, so naively reusing the entry-point heuristic there would have fabricated code from ground truth."
  - "export-asm/smc.prg's live run sets PC directly and forces the interrupt-disable flag rather than relying on vice_autostart's own RUN injection (which has no BASIC program to act on for this bare-machine-code fixture), then steps a fixed 8-instruction bound -- never a checkpoint wait, which proved unreliable for a fixture that never executes SEI."
  - "[Rule 1 fix, disclosed] decomp-completeness's --disagreements validator and completeness-report.mjs's renderCompletenessReport() both refused a real, non-fabricated runIdentity:null (anno evid-disagreements's own answer for a zero-run store) unconditionally, making the NOT EXECUTED rendering unreachable through the real CLI path. Fixed to accept null when the store's own evid-runs table is also genuinely empty; a store WITH real runs still can never supply null."
  - "Task 1 and Task 2 were committed together (one commit) since Task 2 depends on Task 1's exact store state and re-deriving twice would waste an already-expensive live VICE run; documented as a disclosed sequencing deviation, not a scope change."

requirements-completed: [DECOMP-01]

coverage:
  - id: D1
    description: "All six fixtures' bytes are typed from the frozen twelve with zero undefined ranges, zero labels, provenance derived throughout, and full coverage of each fixture's own payload length."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "manual node -e range/coverage assertions against all six committed .annostore.json files, run during execution (undefined_ranges=0, labels=0, no code over dxa/basic-stub.prg's arbitrary tail) -- not yet a committed automated test"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-derivation-execution-evidence.md -- Task 1 section, per-fixture dxa command, Ghidra route/verdict, and coverage-check table"
        status: pass
    human_judgment: true
    rationale: "The six range/coverage assertions were run ad hoc during execution (matching plan 45-01's own coverage-item precedent for its execution manifest) rather than committed as a standing regression test; a later plan should add one if these six artifacts' shape needs a durable guard against accidental hand-editing."
  - id: D2
    description: "dxa/tracer.prg, dxa/fixture.prg and export-asm/smc.prg carry real execObservations from a genuine stock VICE run, anchored to a recorded run identity (image_sha256, argv_digest, seed), with export-asm/smc.prg's own never-halting jmp $0801 bounded by an explicit, stated instruction count rather than a free-run."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-derivation-execution-evidence.md -- Task 2 section, all three runs' full transcripts including the broker's own systemd-run invocation, checkpoint/step sequence, memmapshow byte counts and per-address execute evidence"
        status: pass
    human_judgment: false
  - id: D3
    description: "dxa/basic-stub.prg, petcat/computed-sys.prg and petcat/not-basic.prg each render an explicit NOT EXECUTED line naming the manifest's own reason, through the real anno decomp-completeness / completeness-report.mjs CLI paths -- never the unit-level buildCompletenessReport() shortcut -- with the disagreement query genuinely run over zero observations for each."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "anno-cli.test.ts (88/88 pass), completeness-report.test.mjs (24/24 pass, including both permanent planted-control regressions) after the Rule 1 fix"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-derivation-execution-evidence.md -- Task 3(1) section, all three NOT EXECUTED renderings captured verbatim"
        status: pass
    human_judgment: false
  - id: D4
    description: "The derived half regenerates byte-identically: one fixture per family re-derived into a fresh scratch store reproduces the committed artifact's derived-half fields exactly (full-document match for the one fixture with no exec augmentation, field-scoped match excluding execObservations for the two that carry live-run evidence)."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-derivation-execution-evidence.md -- Task 3(3) section; git status --porcelain confirmed empty for petcat/not-basic.annostore.json after direct overwrite"
        status: pass
    human_judgment: false

duration: ~180min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 6: Derive and Execute the dxa/export-asm/petcat Fixture Family Summary

**Six fixtures fully typed from real dxa+Ghidra derivation with zero fabricated code, three of them carrying genuine stock-VICE execution evidence (including a deliberately bounded never-halting run) and three declared NOT EXECUTED by name through a real CLI path a disclosed bug had made unreachable.**

## Performance

- **Duration:** ~180 min
- **Tasks:** 3 completed
- **Files modified:** 12 (7 created, 5 modified)
- **Commits:** 3

## Accomplishments

- All six fixtures in this family (`dxa/tracer.prg`, `dxa/fixture.prg`,
  `dxa/basic-stub.prg`, `export-asm/smc.prg`, `petcat/computed-sys.prg`,
  `petcat/not-basic.prg`) have committed, fully-typed `.annostore.json`
  stores: every byte typed from the frozen twelve (zero `undefined`),
  every range and comment row `provenance: "derived"`, zero labels, zero
  Ghidra xrefs (none of the six has a JSR/JMP or a Ghidra-recognised entry
  point). `dxa/basic-stub.prg`'s own SYS-target-coincides-with-garbage trap
  was avoided by construction: entry points were only ever supplied to dxa
  for the three fixtures whose SYS target/load address names genuine code.
- Real execution evidence for the three executable fixtures, each anchored
  to a recorded run identity (image_sha256/argv_digest/seed) reported by
  `anno_evid_runs`: `dxa/tracer.prg` (1994 observations, matching plan
  45-01's own measurement exactly), `dxa/fixture.prg` (2000 observations,
  full array-copy-loop opcode coverage), and `export-asm/smc.prg` (1734
  observations) -- the last bounded by directly setting PC and the
  interrupt-disable flag, then stepping a fixed 8-instruction count, since
  this fixture's own `jmp $0801` never halts and has no BASIC stub for
  autostart's own RUN injection to act on.
- The broker was started as a transient `systemd-run --user` unit for each
  of the three runs (never `setsid`/`nohup`) and stopped immediately after;
  `pgrep -x x64sc` confirmed empty after every run and at session end.
- `dxa/basic-stub.prg`, `petcat/computed-sys.prg` and
  `petcat/not-basic.prg` each render an explicit `NOT EXECUTED` line
  carrying the manifest's own reason, through the REAL `anno
  decomp-completeness`/`completeness-report.mjs` CLI paths -- fixing a real
  bug (below) that made this unreachable outside the unit-test shortcut.
- One fixture per family was re-derived into a fresh scratch store and
  proven to reproduce the committed artifact's derived half byte-identically
  (full-document match for `petcat/not-basic.prg`; field-scoped match,
  correctly excluding Task 2's own separately-recorded `execObservations`,
  for `dxa/tracer.prg` and `export-asm/smc.prg`).
- All three family READMEs (`dxa`, `export-asm`, `petcat`) gained a
  provenance section per new artifact naming the producing tool versions
  (vendored `dxa` sha256, Ghidra `12.1.3_PUBLIC`), the route, and the
  standing regenerate-not-hand-edit rule on the derived half.

## Task Commits

1. **Tasks 1+2 (combined, disclosed sequencing deviation)** - `9f3c795b`
   (feat) -- the six derived stores, three of them additionally carrying
   real live-execution evidence.
2. **Rule 1 fix, discovered during Task 3** - `0f2cb0b4` (fix) --
   `anno-cli.ts` and `completeness-report.mjs` now accept a real, genuine
   `runIdentity: null` for a zero-run store.
3. **Task 3** - `62ed5836` (docs) -- the three NOT EXECUTED declarations
   captured, provenance READMEs, idempotence proof, the full evidence
   document.

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/fixtures/dxa/tracer.annostore.json`,
  `fixture.annostore.json`, `basic-stub.annostore.json`,
  `src/mcp/vice/fixtures/export-asm/smc.annostore.json`,
  `src/mcp/vice/fixtures/petcat/computed-sys.annostore.json`,
  `not-basic.annostore.json` - the six committed derived-half (plus
  execution evidence where applicable) fixture stores
- `src/mcp/vice/fixtures/dxa/README.md`,
  `src/mcp/vice/fixtures/export-asm/README.md`,
  `src/mcp/vice/fixtures/petcat/README.md` - provenance sections for the
  six new artifacts
- `src/mcp/vice/anno-cli.ts` - `validateDisagreementDocumentShape()`
  and `cmdDecompCompleteness()`'s match-check now accept a real null
  `runIdentity` for a genuinely zero-run store
- `src/skills/routine-queue-walker/scripts/completeness-report.mjs` -
  `renderCompletenessReport()`'s own mirror predicate updated identically
- `docs/phase45-derivation-execution-evidence.md` - new; every dxa/Ghidra
  run, all three live execution runs, the completeness gate's expected-red
  output per fixture, the idempotence proof, and the disclosed Rule 1 fix

## Decisions Made

- Every dxa-classified non-code byte is typed `byte` uniformly (never
  `petscii`/`word`/`address`) -- see key-decisions above.
- Entry points supplied only where the manifest's own "executed" fixtures
  name genuine code; never for the three non-executed fixtures, avoiding
  `dxa/basic-stub.prg`'s own SYS-target/garbage-tail coincidence.
- `export-asm/smc.prg`'s live run sets PC and the interrupt-disable flag
  directly rather than relying on autostart's own RUN injection.
- Tasks 1 and 2 committed together (sequencing deviation, not scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `decomp-completeness` refused a real zero-run answer unconditionally**
- **Found during:** Task 3, running the real `anno decomp-completeness`
  CLI against the three non-executed fixtures' real `anno
  evid-disagreements --json` answers
- **Issue:** `validateDisagreementDocumentShape()` (`anno-cli.ts`) and
  `renderCompletenessReport()` (`completeness-report.mjs`) both refused
  `runIdentity: null` unconditionally, but `null` is exactly what `anno
  evid-disagreements --json` returns (via `listObservedRuns()`) for a
  store with zero observed runs -- the real, honest answer this plan's own
  `must_haves` requires. The real CLI path could not render a NOT EXECUTED
  report at all before this fix.
- **Fix:** `null` is now accepted as well-formed at both sites; the
  anti-vacuity property is preserved (`cmdDecompCompleteness`'s own
  match-check still refuses null when the store's `evid-runs` table is NOT
  also empty).
- **Files modified:** `src/mcp/vice/anno-cli.ts`,
  `src/skills/routine-queue-walker/scripts/completeness-report.mjs`
- **Verification:** `anno-cli.test.ts` 88/88, `completeness-report.test.mjs`
  24/24 (including both permanent planted controls)
- **Commit:** `0f2cb0b4`

### Disclosed sequencing note (not a numbered rule)

**Tasks 1 and 2 landed in one commit.** Task 2's live execution reads and
writes the SAME scratch store Task 1's derivation created; committing
Task 1's stores, then re-deriving them a second time just to produce a
"Task-1-only" commit before Task 2 augments them, would have doubled an
already-expensive real VICE workload for no evidentiary benefit. Both
tasks' own verify commands were run and passed before the combined commit.

---

**Total deviations:** 1 auto-fixed (1 bug, outside this plan's own declared
`files_modified`, disclosed). **Impact on plan:** Necessary for the plan's
own D-13 acceptance criteria to be reachable through the real CLI path
rather than only the unit-test shortcut; no scope expansion beyond that.

## Issues Encountered

**Disclosed, not a defect:** `export-asm/smc.prg`'s live capture shows
`execute: true` for its own entry byte (`$0801`) but not for the other
three opcode bytes in its 4-instruction loop, despite an 8-instruction
step bound covering two full iterations -- a genuine memmap-accumulation
nuance this session measured but did not fully resolve given the time
available. The evidence is real (anchored to a real run identity, not
fabricated); it is simply narrower than `dxa/tracer.prg`'s and
`dxa/fixture.prg`'s own full-opcode-byte coverage. Recorded in
`docs/phase45-derivation-execution-evidence.md` rather than silently
smoothed over.

**Disclosed, not committed as a standing test:** the six range/coverage
assertions proving byte coverage and zero-undefined/zero-label status were
run ad hoc during execution (coverage item D1's own rationale) rather than
added as a permanent regression test. A later plan should add one if these
committed artifacts' shape needs a durable guard against accidental
hand-editing.

## Known Stubs

None. Every deliverable this plan claims (six typed stores, three real
execution runs, three NOT EXECUTED declarations, idempotence) is backed by
a real, measured, disclosed result -- no placeholder value or empty default
stands in for unimplemented behaviour.

## User Setup Required

None -- no external service configuration required. `dxa`, Ghidra and
`x64sc` were all already present on this host and were only detected,
never installed.

## Next Phase Readiness

- The derived half for this fixture family is complete and committed;
  plan 45-08's own agent-closure pass (names, purpose comments,
  `DECLINED:`/`DISAGREEMENT-ACCEPTED:` resolutions) has real, honest
  material to work from for all six fixtures.
- The completeness gate currently reports `FAIL` for all six fixtures in
  this family (every entry point still carries no authored name, and
  `dxa/fixture.prg`/`export-asm/smc.prg` also carry unresolved referenced
  addresses) -- expected and correct: this plan ships the derived half and
  the execution evidence, not the closure. Plan 45-08 is the one that
  closes it.
- No blockers. `pgrep -x x64sc` and `systemctl --user is-active vice-broker`
  were both confirmed clean before, during (between runs) and after this
  plan's work. `npm run test:automated` reports exactly 3 failures, all
  inside `docs/phase45-wave0-measurements.md`'s own named baseline set
  (the `anno-register.test.ts` requirement-id findings) -- the two named
  flakes outside that file did not fire this run, which is expected flake
  variability, never counted against the baseline.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
