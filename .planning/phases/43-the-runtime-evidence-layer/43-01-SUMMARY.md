---
phase: 43-the-runtime-evidence-layer
plan: 01
subsystem: testing
tags: [vice, text-monitor, memmap, capture-predicate, evidence-layer, stock-vice]

# Dependency graph
requires:
  - phase: 41-the-text-channel-its-serialization-authority-and-the-content
    provides: TextMonitorClient, TEXT_COMMAND_ALLOWLIST, withTextChannelLock() (text-protocol.ts)
  - phase: 42-parsers-parsers-parsers
    provides: parseAccessMap()/AccessMap (textmon-memmap.ts)
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: the S3 AUTOSTART/anchor sequence, capture-predicate.ts's compareCaptures()/normalisePorts()/argvDigest(), vsf-slice.mjs CLI
provides:
  - "memmapzap on the shipped TEXT_COMMAND_ALLOWLIST (eleventh entry), proven dialable live through TextMonitorClient"
  - "EVID-06 answered by a live A/B: no-perturbation at anchor hit depths 10 and 50"
  - "the run-identity schema decision (no-change: the bare (binary sha256, argv digest, seed) triple stays primary, no run_class column) recorded for plan 43-02 to read"
affects: [43-02, 43-03, 43-04, 43-05, 43-06, 43-07]

# Actuals (#2632)
actuals:
  tokens: 10528
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evidence A/B scripts drive the shipped S3 sequence directly (no broker), reusing probe-harness.mjs (phase 39) and capture-predicate.ts (phase 33) verbatim rather than re-deriving any of them"
    - "A control-of-the-control (two un-instrumented runs compared to each other) gates whether a treatment comparison is interpretable, before the treatment verdict is trusted"

key-files:
  created:
    - .planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs
    - docs/phase43-instrumentation-perturbation-ab.md
  modified:
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts
    - .planning/phases/43-the-runtime-evidence-layer/43-RESEARCH.md

key-decisions:
  - "EVID-06 verdict: no-perturbation (both anchor hit depths 10 and 50 compared byte-identical, empty allow-list, control-of-the-control passing first at both depths)"
  - "Assumption-delta decision: no-change -- the evidence table's run-identity columns stay the bare (binary_sha256, argv_digest, seed) triple; no run_class discriminator column is added"
  - "memmapzap added as the TEXT_COMMAND_ALLOWLIST's eleventh entry; memmapsave stays excluded (file-touching verb)"

patterns-established:
  - "Pattern: an evidence A/B's header states its pass/fail rule, both conditions, and its mandatory control-of-the-control in prose BEFORE any executable code, so the rule is provably fixed before the measurement rather than inferred from the code that runs it"

requirements-completed: [EVID-06]

coverage:
  - id: D1
    description: "memmapzap is dialable end-to-end through the shipped TextMonitorClient against genuine stock VICE 3.9, with a memmapshow reply parsing through the shipped parseAccessMap() with a non-zero entry count"
    requirement: "EVID-06"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#TEXT_COMMAND_ALLOWLIST: every entry is exactly one of the eleven named verbs, never a file-touching monitor verb (T-41-02)"
        status: pass
      - kind: integration
        ref: "evid06-instrumentation-ab.mjs --tracer (live, genuine stock VICE 3.9): TRACER_ZAP_OK true, TRACER_SHOW_PARSED true, TRACER_ENTRIES 42734"
        status: pass
    human_judgment: false
  - id: D2
    description: "EVID-06 is answered by a live A/B against a rule fixed before the measurement, with its control-of-the-control passing first at both anchor hit depths (10 and 50)"
    requirement: "EVID-06"
    verification:
      - kind: integration
        ref: "evid06-instrumentation-ab.mjs (live, genuine stock VICE 3.9): AB_CONTROL_VERDICT equivalent at both depths, AB_TREATMENT_VERDICT equivalent at both depths, DERIVED_EVID06_VERDICT no-perturbation"
        status: pass
    human_judgment: false
  - id: D3
    description: "The verdict, its rule, its two depths, its narrowed licensing, and the schema decision it selects are recorded in one findings document; documentation guards stay green"
    requirement: "EVID-06"
    verification:
      - kind: unit
        ref: "docs-dangling-refs.test.ts + docs-linerefs.test.ts (21/21 pass)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-10
status: complete
---

# Phase 43 Plan 1: The EVID-06 Instrumentation-Perturbation A/B Summary

**Live A/B against genuine stock VICE 3.9 at anchor hit depths 10 and 50 answers EVID-06 as `no-perturbation`, keeping the runtime-evidence table's run identity at the bare `(binary sha256, argv digest, seed)` triple with no `run_class` column.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-10T06:28:00Z (approx.)
- **Completed:** 2026-09-10T07:23:24Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `memmapzap` shipped as the eleventh `TEXT_COMMAND_ALLOWLIST` entry, live-proven dialable through the shipped `TextMonitorClient` against genuine stock VICE 3.9, with the follow-up `memmapshow` reply parsing through the shipped `parseAccessMap()` (a real live run observed 42,734 entries, 1,004 with `execute` set).
- The full EVID-06 A/B ran at anchor hit depths 10 and 50, each with a mandatory control-of-the-control (two un-instrumented runs compared to each other) gating an instrumented treatment run. Both depths' controls and treatments compared byte-identical (0 differing bytes, empty allow-list) — verdict `no-perturbation`.
- The schema consequence is recorded and selected before any DDL exists: `no-change` — the evidence table's run identity stays the bare triple, and plan 43-02 is pointed at this exact decision row rather than left to retrofit a column later.
- A real, previously-undocumented text/binary channel coexistence wrinkle was found and fixed on the first live A/B run: any monitor command on either channel while the machine is halted (including a plain `REGISTERS_GET` on an already-halted machine) pushes an unsolicited status line to the text console, which can race a text command dialed immediately afterward before `TextMonitorClient`'s own quiescence-window drain settles. A fixed 300ms settle before the `memmapshow` dial removed the race; the shipped drain logic itself needed no change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dial memmapzap end to end against genuine stock VICE through the shipped client** - `c5222c30` (feat)
2. **Task 2: Run the A/B at two depths with its control-of-the-control** - `f506cc04` (feat)
3. **Task 3: Record the verdict and the decision it selects in the findings document** - `ad42d2a2` (docs)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `src/mcp/vice/text-protocol.ts` - added `memmapzap` as the eleventh `TEXT_COMMAND_ALLOWLIST` entry, with its own doc-comment paragraph explaining why the file-writing sibling `memmapsave` is excluded
- `src/mcp/vice/text-protocol.test.ts` - widened the allowlist membership test to eleven verbs
- `.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs` - the tracer (Task 1) plus the full instrumentation-perturbation A/B (Task 2): header states the pass/fail rule before any code, drives the S3 sequence via `probe-harness.mjs`/`stock-protocol.ts`/`capture-predicate.ts`, derives the verdict in code from `compareCaptures()`
- `docs/phase43-instrumentation-perturbation-ab.md` - the findings document: the rule, what was run, the control-of-the-control, the VERDICT, its licensing limits, and the selected schema decision
- `.planning/phases/43-the-runtime-evidence-layer/43-RESEARCH.md` - Open Question 2 pointed at the now-measured answer

## Decisions Made
- **EVID-06 verdict: `no-perturbation`.** Both anchor hit depths (10 and 50) compared byte-identical between the instrumented and un-instrumented captures, under the same empty allow-list plan 33-03 already validated at these exact hit counts, with the control-of-the-control passing first at both depths.
- **Assumption-delta decision: `no-change`.** The evidence table's run-identity columns stay `(binary_sha256, argv_digest, seed)` — no `run_class` discriminator is added. Accepted debt, named rather than hidden: a later phase discovering a different perturbation source faces the one-way schema bump this phase's own EVID-02 checkpoint already weighs.
- **`memmapzap` added, `memmapsave` excluded.** The clear-verb is added to the allowlist; the file-writing sibling is deliberately kept out, matching the allowlist's own load/save membership test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a text/binary channel coexistence race in the A/B script's own `memmapshow` dial**
- **Found during:** Task 2 (first live run of the full A/B)
- **Issue:** The first live run's instrumented captures both failed: `memmapshow`'s reply parsed as a header mismatch, because a residual unsolicited status line (pushed to the text console by the immediately-preceding `REGISTERS_GET` binary command, on an already-halted machine) was still settling in `TextMonitorClient`'s own D-13(b) passive-banner-drain quiescence window when the script's own `memmapshow` write landed, so the residual text was captured as line 1 of the "reply" instead of being drained separately.
- **Fix:** Added a fixed 300ms settle (`TEXT_SETTLE_MS`, six times the shipped 50ms quiescence window) between `REGISTERS_GET` and the `memmapshow` dial, giving the already-correct shipped drain logic time to finish before a new text command is issued. No change to `text-protocol.ts` itself — the fix is entirely in the evidence script's own sequencing.
- **Files modified:** `.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs`
- **Verification:** Re-ran the full A/B live; both depths' instrumented runs then parsed `memmapshow` cleanly (43,355 entries each) and both compared byte-identical to their un-instrumented counterparts.
- **Committed in:** `f506cc04` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix was necessary to obtain any real EVID-06 verdict at all rather than reporting `not-exercised`; it does not touch shipped production code (`text-protocol.ts`'s own drain logic was already correct) and does not change the plan's scope. No scope creep.

## Issues Encountered
None beyond the deviation above (which is the real substance of what this plan's live measurement found).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 43-02 can now write the evidence table's `CREATE TABLE` DDL from this plan's recorded `no-change` decision — the bare `(binary_sha256, argv_digest, seed)` triple, no `run_class` column — without retrofitting anything.
- `memmapzap` is live-proven dialable through the shipped text client, so plan 43-02's ingestion verb has a working bracket-reset primitive to build on.
- The text/binary coexistence finding (any monitor command on either channel echoes an unsolicited status line to the text console while halted) is worth carrying into later plans that dial text commands immediately after a binary read on an already-halted machine — this plan's fix (a fixed settle window) is a pragmatic mitigation in a one-off evidence script, not a claim that the shipped `text-tools.ts` handlers need the same treatment (those go through the broker's own claim/textConnect() sequencing, a different code path this plan did not touch).

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All key-files (created + modified) confirmed present on disk with `[ -f ]`.
- All three task commit hashes (`c5222c30`, `f506cc04`, `ad42d2a2`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `text-protocol.test.ts` (34/34), `npm run typecheck` (clean), the tracer's live run (`TRACER_ZAP_OK true`, `TRACER_SHOW_PARSED true`, `TRACER_ENTRIES 42734`), the full A/B's live run (exactly one `DERIVED_EVID06_VERDICT no-perturbation` line, one `DERIVED_ASSUMPTION_DELTA_DECISION no-change` line), `docs-dangling-refs.test.ts` + `docs-linerefs.test.ts` (21/21), `pgrep -x x64sc` empty and no `.vsf` remaining under the plan's cache directory.
- `npm run test:automated`: first run showed 5 failures (the documented 3-failure floor plus 2 extra in `audit-root-args.test.ts:982`); an immediate re-run came back at exactly the documented 3-failure floor (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`), confirming the extra 2 were the known intermittent `zz-scratch`-adjacent race in that file, not a regression introduced by this plan.
