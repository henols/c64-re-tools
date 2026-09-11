---
phase: 45-decomposition-to-closure-disagreement-first
plan: 04
subsystem: annotation-store
tags: [anno-cli, decomp-completeness, completeness-report, evid-reconcile, routine-queue-walker, gate, d-09, d-10, d-11]

requires:
  - phase: 45
    provides: "plan 45-01's decomp-completeness verb and completeness-report.mjs skeleton, plan 45-02's anno-store-export.ts comment-prefix constants, plan 45-03's decomposeRegisterValue() (unaffected by this plan)"
provides:
  - "The full decomposition-completeness measure set: rangeProvenance (D-10), entryPoints, referencedAddresses (criterion 4/DECOMP-03), disagreementResolution (D-09's gate-vs-bulletin distinction)"
  - "The GATE: completeness-report.mjs's own process exit code is 0 only when every measure clears its own bar -- D-08's numeric stop condition for routine-queue-walker"
  - "Three planted controls proving the disagreement input is load-bearing, observed RED against a real derived store and recorded verbatim"
  - "routine-queue-walker's routine/symbol queue reworked to fire on a purely dxa/Ghidra-derived (zero-label) store"
affects: [45-05, 45-06, 45-07, 45-08, 45-09, 45-10]

actuals:
  tokens: 25972
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Mirrored pure predicate, verb-authoritative: typedByFor()/isSurvivorName() live twice (anno-cli.ts's real computation, completeness-report.mjs's testable mirror), same discipline plan 45-01 established for the survivor regex"
    - "Gate lives in the consumer, not the producer: the CLI verb's --json answer always exits 0 on a successfully-computed report (data, not a verdict); the skill script's own main() computes the pass/fail verdict and exit code from that data -- D-08's stop condition belongs to the script routine-queue-walker actually runs"
    - "In-process real-store fixtures for CI-safe planted controls: a permanent regression test builds a fresh node:sqlite-backed annotation store via anno-store.ts's own openStore()/setDataType() inside a workspace-confined temp dir, needing no VICE, no broker and no persisted host-specific scratch state"

key-files:
  created:
    - docs/phase45-planted-control-evidence.md
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/anno-enum-gen.ts
    - src/skills/routine-queue-walker/scripts/completeness-report.mjs
    - src/skills/routine-queue-walker/scripts/completeness-report.test.mjs
    - src/skills/routine-queue-walker/SKILL.md

key-decisions:
  - "Hardware-register classification for referencedAddresses (criterion 4/DECOMP-03) unions anno-regbits.json's own keys (read directly, since anno-enum-gen.ts's loadRegBits() is private) with four hand-named memmap.json chip bands (VIC-II/SID/CIA#1/CIA#2) -- Color RAM and the two generic I/O Area bands are deliberately excluded since neither holds a chip register the curated table names."
  - "entryPoints/referencedAddresses read bytes from the manifest's own fixtures-relative path (`fixtures/<manifestEntry.path>`), never a new --image CLI flag -- VERB_OPTIONS' declared decomp-completeness option set (--store/--disagreements/--manifest/--json) stays exactly as plan 45-01 froze it."
  - "disagreementResolution's `resolved` field is identical to `accepted` today (the DISAGREEMENT_ACCEPTED_COMMENT_PREFIX comment is the only resolution mechanism this gate recognises) -- kept as two fields per the plan's own named shape rather than collapsed to one, so a future second resolution mechanism has somewhere to land without a schema change."
  - "byteCensus gained a new `undefinedRanges` field (byte-range gaps between typed ranges) so the gate can name an Undefined byte's address, not only its count -- required by Task 1's own Test 1 ('renders that byte's address')."
  - "Planted control 2's permanent test builds its own real, fresh, in-process annotation store (via anno-store.ts, in a workspace-confined temp dir) rather than depending on the Wave-0-derived tracer.annostore under the gitignored .c64-re-tools/ tree -- a store with zero recorded runs makes any complete-but-unmatched runIdentity a genuine, CI-safe anti-vacuity refusal, needing no VICE and no host-specific scratch state to survive between sessions."

requirements-completed: [DECOMP-01, DECOMP-02, DECOMP-03]

coverage:
  - id: D1
    description: "The completeness report's full measure set (byte census with named Undefined-byte ranges, survivors, per-range provenance with D-11's table naming and D-10's typedBy precedence, entry-point purpose-comment census, referenced non-hardware address census, disagreement resolution) is computed on the verb side and rendered under its own heading on the script side, with an explicit denominator on every count and zero percentage characters anywhere."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "src/skills/routine-queue-walker/scripts/completeness-report.test.mjs -- Tests 1 through 9 (all nine plan-specified behaviours), plus the carried-over D-09 refusal tier: 24/24 pass"
        status: pass
      - kind: manual_procedural
        ref: "node vice-proxy.ts anno decomp-completeness --store <real tracer.annostore> --disagreements <real evid-disagreements.json> --manifest fixtures/decomp-execution-manifest.json --json, and the same through completeness-report.mjs -- both render the full measure set end to end against the real dxa+Ghidra-derived, live-executed store"
        status: pass
    human_judgment: false
  - id: D2
    description: "The report's process exit code is a real gate: 0 only when the byte census, survivors, entry points, referenced addresses and disagreement resolution all clear their own bar; 1 the instant any one does not, naming the failing address by name."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "completeness-report.test.mjs -- computeGateFailures() asserted for each of the five failing measures individually (Tests 1, 8, 8b, 9, and the combined 'full survivor list...' test), plus a fully-clean report asserted to have zero failures and render GATE: PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "The disagreement input is proven load-bearing by three controls made to fail and observed RED against the real store, two of them pinned as permanent, CI-safe regression tests that do not depend on VICE or persisted host scratch state."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-planted-control-evidence.md -- three OBSERVED RED sections with verbatim captured output and exit codes, against the real dxa/tracer.prg store"
        status: pass
      - kind: unit
        ref: "completeness-report.test.mjs -- 'PLANTED CONTROL 1' and 'PLANTED CONTROL 2' tests, deliberately not derived from the code path they test"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every code entry point's authored-name and four-purpose-comment-element status is measured and gates the exit code; DATA_TYPES stays the frozen twelve and anno-coverage.ts is untouched."
    requirement: DECOMP-02
    verification:
      - kind: unit
        ref: "completeness-report.test.mjs Tests 8/8b; node --test anno-types.test.ts (DATA_TYPES pin, green); git status --porcelain src/mcp/vice/anno-coverage.ts (empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every non-hardware address referenced from code is censused as resolved (authored name), declined (DECLINED: comment) or unresolved, against an explicit denominator, and a zero-referenced-address fixture renders 0 of 0 rather than an unqualified pass."
    requirement: DECOMP-03
    verification:
      - kind: unit
        ref: "completeness-report.test.mjs Test 6b"
        status: pass
      - kind: manual_procedural
        ref: "the real tracer.annostore run above -- referencedAddresses.denominator: 0 for this 21-byte fixture, rendered with the explicit non-pass sentence rather than silently omitted"
        status: pass
    human_judgment: false
  - id: D6
    description: "routine-queue-walker's routine and symbol queues gain an xref/block-derived candidate source that fires independently of label population, above the legacy label-prefix path, so the walk has entries on a purely dxa/Ghidra-derived (measured zero-label) store; Phase 5 states the gate's exit code as the numeric stop condition; the existing anno coverage invocation is untouched."
    requirement: null
    verification:
      - kind: other
        ref: "git diff shows the anno coverage code block and its surrounding paragraph byte-for-byte unchanged; all four skill guard scripts (check-skill-cli-invocations, check-skill-tool-coverage, check-skill-description-overlap, check-skill-fork-honesty) exit 0"
        status: pass
    human_judgment: false

duration: 165min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 4: The Decomposition-Completeness Gate and Its Planted Control Summary

**The decomp-completeness verb and its skill script gained the full measure set (per-range provenance, entry-point purpose census, referenced-address census, disagreement resolution) and a real process-exit-code gate, proven non-vacuous by three planted controls observed going RED against a real derived-and-executed store, plus a reworked routine-queue-walker candidate queue that fires on a zero-label derivation.**

## Performance

- **Duration:** ~165 min
- **Tasks:** 3 completed
- **Files modified:** 9 (1 created, 8 modified)
- **Commits:** 5

## Accomplishments

- `anno-cli.ts`'s `decomp-completeness --json` answer now carries the
  complete measure set the roadmap's success criteria name:
  `rangeProvenance` (D-10 mechanism 2's fixed observed-executing >
  authored > byte-derived precedence, and D-11's `table` naming for the
  four `SPLIT_DATA_TYPES` layouts, read from `isSplitDataType()` and never
  restated as a literal), `entryPoints` (JSR-referenced code addresses plus
  the image's own load origin, each carrying `hasName` and the four
  `function:`/`inputs:`/`outputs:`/`side effects:` purpose-comment
  elements), `referencedAddresses` (every non-hardware address code
  references, censused resolved/declined/unresolved), and
  `disagreementResolution` (every supplied disagreement's
  `DISAGREEMENT-ACCEPTED:` resolution, with `unresolvedCount` beside its
  own `denominator`).
- `completeness-report.mjs` renders every new measure under its own
  heading and, via `computeGateFailures()`/`main()`, makes the script's
  own process exit code the real GATE D-08 names as routine-queue-walker's
  numeric stop condition -- 0 only when all five measures clear their own
  bar, 1 the instant any one does not, naming the failing address.
- 24 tests in `completeness-report.test.mjs` cover all nine plan-specified
  behaviours (undefined-byte gating, the aggregate/per-range soundness
  asymmetry, adjacent-range non-merging, render determinism, zero-entry
  and zero-referenced-address non-vacuity, D-11's `table` naming, entry-
  point and disagreement gating) plus the carried-over D-09 refusal tier.
- Three D-09 planted controls were run for real against the real
  `dxa/tracer.prg` store plan 45-01 derived and live-executed, each
  captured verbatim and reverted, recorded in
  `docs/phase45-planted-control-evidence.md`. Controls 1 and 2 are pinned
  as permanent, CI-safe regression tests -- control 2's own test builds a
  fresh in-process store via `anno-store.ts`, needing no VICE and no
  persisted host scratch state to survive between sessions.
- `routine-queue-walker/SKILL.md`'s Phase 2.1 and Phase 3.1 each gained an
  xref/block-derived candidate source, checked FIRST and independently of
  label population, above the existing label-prefix path -- closing the
  silent-vacuous-queue gap `docs/phase45-wave0-measurements.md`'s
  MEASUREMENT A found (a purely dxa/Ghidra-derived store carries zero
  labels of any shape). Phase 5 gained D-08's numeric stop condition
  (the gate's own exit code) beside the existing, byte-for-byte-unchanged
  `anno coverage` invocation, and "When something fails" gained the
  `DECLINED:`/`DISAGREEMENT-ACCEPTED:` comment conventions.
- Two pre-existing, uncaught regressions from plan 45-02
  (`anno-store-export.ts` missing from `package.json`'s `files[]` and from
  `hostpath-consumers.test.ts`'s `ANNO_MODULE_FLOOR`) and six drifted line
  citations in `module-classification.ts` (three inherited from plan
  45-03's own growth of `anno-enum-gen.ts`, three newly introduced by this
  plan's own edits to `anno-cli.ts`) were found and repaired while
  diffing this plan's own `npm run test:automated` run against the Wave 0
  baseline.

## Task Commits

1. **Mandatory pre-work: reword three shipped phase-number literals
   (FLOW-02)** - `e294a588` (fix) -- `anno-cli.ts` USAGE/EXECUTED text,
   `anno-enum-gen.ts`'s generated-enum description.
2. **Disclosed deviation: repair plan 45-02's uncaught module-registration
   drift** - `45451661` (fix) -- `package.json` files[], `ANNO_MODULE_FLOOR`.
3. **Task 1: the full measure set and the gate semantics** - `4dadef7a`
   (feat) -- `anno-cli.ts`, `completeness-report.mjs`,
   `completeness-report.test.mjs` (also carries Task 2's two permanent
   planted-control tests -- see Deviations), `module-classification.ts`'s
   line-citation repair.
4. **Task 2: the planted control, observed RED and recorded** - `98cb38e4`
   (docs) -- `docs/phase45-planted-control-evidence.md`.
5. **Task 3: rework routine-queue-walker's queue** - `ffb6ef35` (feat) --
   `SKILL.md`.

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` - the full measure set on `decomp-
  completeness`'s `--json` answer, its rendered-text counterpart, and the
  hardware-register/entry-point/referenced-address/disagreement-resolution
  helper functions
- `src/mcp/vice/module-classification.ts` - six repaired line citations
  (three pre-existing, three from this plan's own `anno-cli.ts` edits)
- `src/mcp/vice/hostpath-consumers.test.ts` - `ANNO_MODULE_FLOOR` 20 -> 21
  (plan 45-02's own missed raise)
- `src/mcp/vice/package.json` - `anno-store-export.ts` added to `files[]`
  (plan 45-02's own missed addition)
- `src/mcp/vice/anno-enum-gen.ts` - one phase-number literal reworded
  (mandatory pre-work, disclosed deviation from `files_modified`)
- `src/skills/routine-queue-walker/scripts/completeness-report.mjs` - the
  full measure set renderer and the real gate (`computeGateFailures()`,
  `main()`'s own exit code)
- `src/skills/routine-queue-walker/scripts/completeness-report.test.mjs` -
  24 tests: the nine plan-specified behaviours, the carried-over D-09
  refusal tier, and the two permanent planted-control regression tests
- `src/skills/routine-queue-walker/SKILL.md` - Phase 2.1/3.1's new
  candidate sources, Phase 5's numeric stop condition, the
  `DECLINED:`/`DISAGREEMENT-ACCEPTED:` conventions
- `docs/phase45-planted-control-evidence.md` - new; the three OBSERVED RED
  transcripts

## Decisions Made

- Hardware-register classification for `referencedAddresses` unions
  `anno-regbits.json`'s own keys (read directly, since `anno-enum-gen.ts`'s
  `loadRegBits()` is private) with four hand-named memmap.json chip bands
  (VIC-II/SID/CIA#1/CIA#2); Color RAM and the two generic I/O Area bands
  are deliberately excluded.
- `entryPoints`/`referencedAddresses` read bytes from the manifest's own
  fixtures-relative path, never a new `--image` flag -- `VERB_OPTIONS`'
  declared option set for `decomp-completeness` is unchanged from plan
  45-01's freeze.
- `disagreementResolution.resolved` is identical to `.accepted` today (the
  only resolution mechanism this gate recognises); kept as two fields per
  the plan's own named shape so a future second mechanism has somewhere to
  land without a schema change.
- `byteCensus` gained `undefinedRanges` (byte-range gaps between typed
  ranges) so the gate can name an Undefined byte's address, not only its
  count -- required by Task 1's own Test 1.
- Planted control 2's permanent test builds its own fresh, in-process
  annotation store rather than depending on the Wave-0-derived
  `tracer.annostore` under the gitignored `.c64-re-tools/` tree -- CI-safe,
  no VICE, no host-specific scratch state required to survive between
  sessions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Mandatory pre-work, disclosed] Reworded a phase-number literal in
`anno-enum-gen.ts`, outside this plan's declared `files_modified`**
- **Found during:** pre-work, running `docs-dangling-refs.test.ts` as
  instructed before starting this plan's own tasks
- **Issue:** plan 45-03 introduced `"Generated by anno-enum-gen.ts (Phase
  45, D-15) from ..."`, a shipped string literal naming a phase number
  (FLOW-02, D-11.1-01) -- `docs-dangling-refs.test.ts` read 2 failures
  before this session
- **Fix:** reworded to `"Generated by anno-enum-gen.ts (D-15) from ..."`,
  keeping the decision id and dropping the phase reference; also reworded
  `anno-cli.ts`'s two own FLOW-02 violations (USAGE text, EXECUTED line)
- **Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-enum-gen.ts`
- **Verification:** `docs-dangling-refs.test.ts` 8/8 green, including the
  planted-violation control requiring the corrected wording to NOT be
  flagged
- **Committed in:** `e294a588`

**2. [Rule 1 - Bug, disclosed] Repaired plan 45-02's uncaught module-
registration drift**
- **Found during:** diffing this plan's own `npm run test:automated` run
  against `docs/phase45-wave0-measurements.md`'s named baseline
- **Issue:** `anno-store-export.ts` (plan 45-02) was never added to
  `package.json`'s `files[]` or to `hostpath-consumers.test.ts`'s
  `ANNO_MODULE_FLOOR` -- both plans' own narrowly-scoped `<verify>` blocks
  never ran the tests that would have caught it
- **Fix:** added the entry to `files[]`; raised `ANNO_MODULE_FLOOR` 20 -> 21
  with a comment block naming plan 45-02, matching D-13's own
  "raised, recorded as a relation" discipline
- **Files modified:** `src/mcp/vice/package.json`,
  `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `anno-seam.test.ts` and `hostpath-consumers.test.ts`
  both green
- **Committed in:** `45451661`

**3. [Rule 1 - Bug] Repaired six drifted line citations in
`module-classification.ts`**
- **Found during:** Task 1, running `npm run test:automated` after
  widening `anno-cli.ts`
- **Issue:** `DIRECTION 9`/`9b` failed: `module-classification.ts` cites
  fixed line numbers for `MAX_ACME_IDENTIFIER_LENGTH`/`RegBitsTable`/
  `REGBITS_PATH` (in `anno-enum-gen.ts`) and `buildCoverageReport`/
  `renderMemoryMap`/`checkAcceptedOptions` (in `anno-cli.ts`). Three of
  the six were ALREADY drifted before this plan started (plan 45-03 grew
  `anno-enum-gen.ts` without updating the citations); this plan's own
  import/helper additions to `anno-cli.ts` drifted the other three further
- **Fix:** re-pointed all six citations to their current, verified-by-
  containment line numbers
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `module-classification.test.ts` 20/20 green
- **Committed in:** `4dadef7a` (part of the Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 mandatory pre-work carried into an
out-of-scope file, 2 pre-existing-regression repairs). **Impact on plan:**
All three were necessary to reach a genuinely clean baseline comparison for
this plan's own verification; none expands this plan's own deliverable
scope. Deviation 1's `anno-enum-gen.ts` edit and deviations 2/3's files sit
outside this plan's declared `files_modified` -- each is disclosed here
exactly as the mandatory pre-work instructions and CLAUDE.md's deviation
rules require.

### Task/file overlap note (not a numbered deviation)

Task 2's two permanent planted-control tests (`PLANTED CONTROL 1`/`PLANTED
CONTROL 2`) physically landed in the Task 1 commit (`4dadef7a`) rather than
a separate Task 2 code commit, because both tasks edit the SAME file
(`completeness-report.test.mjs`) and the edits were made in sequence within
one working session before either was committed. Task 2's own dedicated
commit (`98cb38e4`) therefore carries only its docs deliverable
(`docs/phase45-planted-control-evidence.md`), which is where the plan's own
task boundary places the bulk of Task 2's distinct content. Both tests are
present, both pass, and both are traceable to Task 2 in this SUMMARY and in
the evidence document's own "Summary" table.

## Issues Encountered

None beyond the deviations recorded above. `docs-dangling-refs.test.ts`
(8/8), `anno-cli.test.ts` (111 combined with `anno-types.test.ts`),
`anno-store-export.test.ts`, `anno-enum-gen.test.ts`, `hostpath-
consumers.test.ts`, `anno-seam.test.ts`, `module-classification.test.ts`
(226 combined, 1 opt-in live test skipped as expected) and
`completeness-report.test.mjs` (24) are all green. `npm run test:automated`
from `src/mcp/vice` reports exactly 4 failures, all inside
`docs/phase45-wave0-measurements.md`'s own named baseline set (the 3
`anno-register.test.ts` requirement-id findings plus the
`audit-root-args.test.ts` `/tmp`-scratch race; the `anno-tools.test.ts`
TOCTOU flake did not fire this run, which is expected flake variability,
never counted against the baseline). No `x64sc` process and no VICE broker
were running before or after this plan's work
(`pgrep -x x64sc` empty, `systemctl --user is-active vice-broker` ->
`inactive`).

## Known Stubs

None. Every deliverable this plan claims (the full measure set, the gate,
the three planted controls, the reworked skill) is backed by real,
executed, measured behaviour against a real derived-and-executed store --
no placeholder value or empty default stands in for unimplemented
behaviour.

## User Setup Required

None -- no external service configuration required. No host tool (VICE,
ACME, dxa, Ghidra) was newly needed for this plan's own work; the real
`tracer.annostore` and its sidecar `--disagreements` documents plan 45-01
derived and left under the gitignored `.c64-re-tools/phase45-scratch/`
tree were reused for the planted-control evidence collection, and were
only read, never re-derived.

## Next Phase Readiness

- The decomp-completeness gate is now the phase's real closure bar: every
  field the roadmap's five success criteria name is measured, gated, and
  reported by address on failure.
- `routine-queue-walker`'s queue now has a mechanism to find candidates on
  every derived store shape this project's own v0.8.0 derivation route
  produces, not only one that happens to carry externally-imported names.
- The gate currently reports FAIL for the real `dxa/tracer.prg` store
  (one entry point -- the image's own load address -- carries no name and
  no purpose comment), which is expected and correct: this plan ships the
  bar, not the closure of every fixture against it. Plans 45-05 through
  45-10 (and any later routine-queue-walker pass against the committed
  fixtures) are the ones that close it.
- No blockers.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
