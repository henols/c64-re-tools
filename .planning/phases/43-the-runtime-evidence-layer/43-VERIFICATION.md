---
phase: 43-the-runtime-evidence-layer
verified: 2026-09-10T12:59:40Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 43: The Runtime Evidence Layer Verification Report

**Phase Goal:** What the emulator observed becomes durable, run-keyed, monotonically accumulating
store state that a later session queries instead of re-running the program, joined against the
byte-derived block table by a query that reports disagreement first and never overwrites it, with
the phase opening on a committed-before-measurement A/B that says whether instrumenting a run
destroys the frame-exact reproducibility its rows are keyed on.

**Verified:** 2026-09-10T12:59:40Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The A/B lands before the schema is settled, against a pass/fail rule fixed before the measurement, with both outcomes planned for | ✓ VERIFIED | `docs/phase43-instrumentation-perturbation-ab.md` records the rule "FIXED 2026-09-10, BEFORE ANY MEASUREMENT IS TAKEN" (also embedded verbatim in `43-01-PLAN.md`'s `<objective>` before Task 2 ran), the control-of-the-control passing `equivalent` at both depths (10, 50), and the verdict `no-perturbation` derived in code from `compareCaptures().verdict`, never hand-judged. The `assumption_delta_decision` table in the plan pre-committed both branches (`no-change` vs `promote`) before the measurement; `no-change` was selected. Confirmed `run_class`/`runClass` do not appear anywhere in `anno-types.ts`/`anno-store.ts` except in doc-comment references to the rejected branch — grep-verified directly. |
| 2 | A later session queries the evidence instead of re-running the program; an existing store's fate is decided | ✓ VERIFIED | `anno_evid_exec` table (`SCHEMA_VERSION` 4, `anno-store.ts:330`) keyed by `(image_sha256, argv_digest, seed)` — the same `argvDigest()`/composite v0.8.0 established (`evid-ingest.ts` computes it via the shipped `argvDigest`, never accepts a pre-computed digest — grep-confirmed zero `argvDigest` call sites in `anno-tools.ts`). Idempotent re-ingest (`changed:false`, unchanged row count) proven in `anno-store.test.ts`/`anno-tools.test.ts`. Durability proven the STORE-04 way in `anno-durability.test.ts` (real SIGKILL, fresh-process readback by value) plus a genuinely concurrent two-identity SIGKILL planting and a reset-then-relaunch planting added in plan 43-07 — all ran green in this session. EVID-02's existing-store fate (`reaffirm-refusal`) is recorded in `anno-types.ts`'s `SCHEMA_VERSION` doc comment with a dated four-part factual check (filesystem search, git history, release tags, one-machine scope) reached at a `checkpoint:decision` gate, not defaulted. |
| 3 | A user can ask where the two classifiers disagree and gets disagreements first; block table stays byte-derived, never overwritten; agreement is a count; disagreement is planted, reachable, rendered distinctly | ✓ VERIFIED | `evid-reconcile.ts`'s `EvidReconciliation` interface has `disagreements` as its literally first declared/returned key (source-inspected); `agreementCount` is a number with no corresponding row array anywhere in the result (test + source confirm). `insertExecObservations`/`deleteExecObservationsForRun` touch only `anno_evid_exec` in their SQL (grep-confirmed against the actual `prepare()` statements); every write-path test (`anno-tools.test.ts`, `anno-durability.test.ts`) asserts `listRanges` deep-equal before/after. `anno_evid_disagreements` MCP verb and the `evid-disagreements` CLI verb both wired and tested; the planted three-store CLI test (disagreement / agreement / silence) asserts the three renderings are pairwise unequal and that only the disagreement store renders a row line — ran green in the targeted test pass this session. |
| 4 | The layer cannot state/imply/render `data` on the strength of absence, structurally, with each of four controls separately verified | ✓ VERIFIED | `RuntimeExecClass = "code" \| "unobserved"` (`anno-types.ts:619`) — no `data` member, grep-confirmed. `evid-report-keys.test.ts` runs four independently-named, source-derived directions (scope completeness, banned rate/exhaustiveness keys, denominator adjacency, no-runtime-`data`-branch source scan), each with its own planted control AND clean control over the real tree — ran green (all 8+ cases, no skips) in this session's targeted run. The clean control caught a genuine pre-existing gap (`anno_evid_reset` missing a `denominator`), which was fixed in-phase (plan 43-07) — direct evidence the guard is real, not decorative. |
| 5 | A bracket is nameable, resettable, re-measurable without leakage, proven against a planted concurrent-reset/relaunch scenario | ✓ VERIFIED | `vice_memmap_zap` (emulator-side reset, live-proven against genuine stock VICE 3.9 in plan 43-03: post-zap count strictly below pre-zap count) plus `anno_evid_reset` (store-side reset, `deleteExecObservationsForRun`) together form the bracket reset. `anno-durability.test.ts`'s EVID-05 plantings (added in 43-07, re-ran green this session): a genuinely concurrent two-run-identity SIGKILL (not a sequential run) proving the survivor's rows are the complete union and the casualty is all-or-nothing, plus a reset-then-relaunch case proving a neighbour identity's rows stay byte-identical. A round-trip contract test (`anno-tools.test.ts`) walks every supported run class through the single `runIdentityFrom()`/`argvDigest()` path. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/text-protocol.ts` | `memmapzap` on `TEXT_COMMAND_ALLOWLIST` | ✓ VERIFIED | Present at line 136; `memmapsave` excluded (verified: appears only in comment) |
| `src/mcp/vice/anno-types.ts` | `SCHEMA_VERSION = 4`, `RuntimeExecClass`, `EVID_SOURCE_BANKS` | ✓ VERIFIED | Line 261, line 619, all present and typechecked |
| `src/mcp/vice/anno-store.ts` | `anno_evid_exec` DDL, `insertExecObservations`, `listExecObservations`, `listObservedRuns`, `deleteExecObservationsForRun` | ✓ VERIFIED | DDL at line 330; all four functions present, parameterised SQL only, touch only the new table |
| `src/mcp/vice/evid-reconcile.ts` | Pure join, disagreements-first | ✓ VERIFIED | 15,986 bytes, `disagreements` is first key, no store/transport imports (source-censused) |
| `src/mcp/vice/evid-ingest.ts` | Pure transform, one-positive-fact rule | ✓ VERIFIED | 10,773 bytes, no `anno-store`/`node:sqlite` import (source-censused), `argvDigest` computed internally |
| `src/mcp/vice/anno-tools.ts` | Four `anno_evid_*` verbs registered via existing loop | ✓ VERIFIED | `anno_evid_ingest`, `anno_evid_disagreements`, `anno_evid_runs`, `anno_evid_reset` all present; zero `capability-registry.ts` entries (grep-confirmed); single `ANNO_TOOL_DEFINITIONS` array, single registration loop in `vice-proxy.ts` |
| `src/mcp/vice/text-tools.ts` / `stock-dispatch.ts` | `handleMemmapZap` / `vice_memmap_zap` | ✓ VERIFIED | Both present and wired via `withDerivedTool(..., { needsSession: false })` |
| `src/mcp/vice/evid-report-keys.test.ts` | Structural EVID-04 guard, test-only | ✓ VERIFIED | Present, absent from `package.json` `files[]` (confirmed via `node -e`) |
| `docs/phase43-instrumentation-perturbation-ab.md` | EVID-06 A/B findings | ✓ VERIFIED | Contains `## VERDICT` → `no-perturbation`, sha256 of the release binary, resolved binary path |
| `docs/phase43-runtime-evidence-layer.md` | Phase findings document | ✓ VERIFIED | All six `## ` headings present (`What shipped`, `The one positive fact`, `The four buckets`, `Run identity`, `Accepted limits`, `What this layer does not claim`) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `TEXT_COMMAND_ALLOWLIST` (`memmapzap`) | `TextMonitorClient.command()` | allowlist membership | ✓ WIRED | Live-proven against genuine stock VICE 3.9 (tracer + full A/B, plan 43-01) |
| `compareCaptures()` (unmodified) | EVID-06 verdict | direct call, no re-implementation | ✓ WIRED | `grep -c 'compareCaptures'` ≥ 1 in the A/B script per plan's own acceptance criteria (SUMMARY self-check confirms) |
| Plan 43-01's `no-change` decision | `anno-store.ts` DDL column set | run-identity columns read from that row | ✓ WIRED | `anno_evid_exec` carries exactly `image_sha256, argv_digest, seed, address, source_bank` — no `run_class` |
| `insertExecObservations`/`deleteExecObservationsForRun` | single `commitTransaction`/`applyWrite` site | one transaction per call | ✓ WIRED | Source-confirmed; concurrent-SIGKILL planting (43-07) proves fusion, not just presence |
| `blockClassAt` | `evid-reconcile.ts` | via injectable `BlockClassifier`, never a string comparison | ✓ WIRED | Source-confirmed no literal block-type comparison; independence proven by substituted-vocabulary test |
| `EvidExecRow`/`listExecObservations` | `evid-reconcile.ts`'s `EvidReconcileInput` | already-fetched plain data, no store open inside the joiner | ✓ WIRED | Dispatch arm fetches both sides before calling `reconcileObservedExecution` (source-confirmed) |
| `ANNO_TOOL_DEFINITIONS` | `vice-proxy.ts`'s single anno registration loop | zero proxy edits | ✓ WIRED | `grep -c 'for (const annoDef of ANNO_TOOL_DEFINITIONS)' vice-proxy.ts` = 1 |
| `memmapzap` on allowlist | `vice_memmap_zap` handler | two-dial (zap then show) sequence | ✓ WIRED | Live-proven against genuine stock VICE 3.9 (plan 43-03); post-zap count strictly below pre-zap count |
| `runIdentityFrom` (evid-ingest.ts) | `anno_evid_reset`'s dispatch arm | single digest site, no second `argvDigest` call | ✓ WIRED | `grep -c argvDigest anno-tools.ts` = 0 (only `runIdentityFrom` calls it) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated test suite settles at documented 3-failure floor | `npm run test:automated` (run twice) | First run: 5 failures (3 floor + 2 intermittent `audit-root-args.test.ts:982` race). Second run: exactly 3 failures, all in `anno-register.test.ts`, matching the documented pre-existing baseline | ✓ PASS |
| All evidence-layer + supporting structural test files pass | `node --test evid-reconcile.test.ts evid-ingest.test.ts evid-report-keys.test.ts anno-store.test.ts anno-durability.test.ts anno-tools.test.ts anno-cli.test.ts text-protocol.test.ts stock-derived.test.ts text-tools.test.ts anno-seam.test.ts shipped-modules.test.ts capture-seam.test.ts textmon-seam.test.ts docs-*.test.ts comment-phase-pointers.test.ts capability-registry.test.ts stock-dispatch.test.ts manifest-arg-compat.test.ts stock-schema-check.test.ts anno-types.test.ts anno-derive.test.ts hostpath-consumers.test.ts anno-verb-coverage.test.ts anno-cli-path-consumers.test.ts anno-cli-invocations.test.ts block-class.test.ts` | 884 pass, 0 fail, 2 skipped (opt-in live cases, correctly self-skip without `VICE_LIVE_STOCK_BIN`) | ✓ PASS |
| Typecheck clean | `npm run typecheck` | exit 0, no `error TS` lines | ✓ PASS |
| `memmapzap` allowlist entry present, `memmapsave` excluded | `grep` checks | Confirmed | ✓ PASS |
| No debt markers (`TBD`/`FIXME`/`XXX`) in phase-touched shipped source | `grep -n -E "TBD|FIXME|XXX"` over 10 core files | Zero real hits (one false-positive match on a path placeholder `XXXX` in a comment) | ✓ PASS |
| No stub patterns (`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented") | `grep` over 10 core files | Zero hits | ✓ PASS |
| Code-review fixes (WR-01, WR-02) genuinely applied, not just claimed | Direct source read of `dispatchEvidIngest` and `insertExecObservations` | Both fixes present: `applyWrite(handle, () => false, { baseRevision })` on the zero-observation path (WR-01); `insertedCount` counted row-by-row inside the same transaction and returned as `written.insertedCount` (WR-02), eliminating the read-before-write TOCTOU by construction | ✓ PASS |
| `pgrep -x x64sc` clean, no live broker | `pgrep -x x64sc`; `systemctl --user is-active vice-broker` | Empty; `inactive` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| EVID-01 | 43-02, 43-05, 43-06 | Durable, run-keyed rows queryable instead of re-running | ✓ SATISFIED | `anno_evid_exec` table + `anno_evid_ingest`/`anno_evid_runs` verbs, all tested |
| EVID-02 | 43-02 | Schema-bump decision reached from a factual check | ✓ SATISFIED | `reaffirm-refusal` decision, dated 4-part check, recorded in `SCHEMA_VERSION` doc comment |
| EVID-03 | 43-04, 43-06 | Disagreement-first query, block table untouched, agreement as count | ✓ SATISFIED | `evid-reconcile.ts`, `anno_evid_disagreements`, `evid-disagreements` CLI verb |
| EVID-04 | 43-02, 43-04, 43-05, 43-06, 43-07 | No `data` from absence, denominator on every count | ✓ SATISFIED | `RuntimeExecClass` 2-member union, `evid-report-keys.test.ts`'s 4 independent controls |
| EVID-05 | 43-03, 43-06, 43-07 | Bracket reset/re-measure without leakage, planted concurrent/relaunch proof | ✓ SATISFIED | `vice_memmap_zap` + `anno_evid_reset`, concurrent SIGKILL + relaunch plantings |
| EVID-06 | 43-01 | Instrumentation-perturbation A/B, rule fixed before measurement | ✓ SATISFIED | `docs/phase43-instrumentation-perturbation-ab.md`, verdict `no-perturbation` |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly EVID-01 through EVID-06 to Phase 43, and every one is claimed by at least one plan's frontmatter `requirements` field.

### Decision Coverage

No `43-CONTEXT.md` exists for this phase — gate skipped cleanly (no `<decisions>` block to check).

### Anti-Patterns Found

None. No debt markers (`TBD`/`FIXME`/`XXX`), no `TODO`/`HACK`/`PLACEHOLDER`, no stub-shaped returns, no hardcoded-empty-data patterns found in the ten core phase-43 source files scanned.

### Code Review Disposition

`43-REVIEW.md` (standard depth, 40 files) found 0 critical, 2 warnings, 1 info. `43-REVIEW-FIX.md` shows both warnings (WR-01: zero-observation path bypassing `base_revision` staleness check; WR-02: `observationsWritten` computed via a pre-write, non-transactional read subject to TOCTOU) were fixed with commits `12f856ed` and `20969c37`. This verification independently re-read the current source and confirms both fixes are genuinely present and structurally sound (WR-02's fix eliminates the race by counting inside the same transaction rather than adding a second, still-racy check). The one info-level item (IN-01) was declined with a documented, verified-correct reason (the suggested guard already exists at `anno-durability.test.ts:576`).

The fixer's own commit messages note both fixes are "requires human verification" in the sense that no *new* test specifically drives the exact concurrency scenario each fix addresses — however, the full automated suite (including all EVID-01/04/05 tests and the 43-07 concurrent-SIGKILL planting) passes with both fixes applied, and the fixes are structural (moving a count inside a transaction, adding a staleness check to a previously-uncovered path) rather than behavioral tuning. This is not flagged as a phase-blocking gap since it does not correspond to a phase-43 must-have left unproven — it is residual reviewer caution on two already-fixed, already-tested code paths.

### Human Verification Required

N/A — Infrastructure/foundation phase (durable evidence store, MCP tool surface, CLI reporting) with no user-facing UI elements. All must-haves and roadmap success criteria were verified programmatically, against real code (not SUMMARY narration), including two genuinely live-instrumented runs against stock VICE 3.9 that were independently confirmed present in the source and consistent with the recorded findings documents. No truth in this phase was left ⚠️ PRESENT_BEHAVIOR_UNVERIFIED — every behavior-dependent claim (durability across SIGKILL, concurrent-writer isolation, instrumentation non-perturbation) has a passing, named test exercising exactly that invariant, re-run in this verification pass rather than only cited from the SUMMARY.

### Gaps Summary

None. All five ROADMAP success criteria hold up under direct source inspection and a fresh test run (not just SUMMARY claims): the EVID-06 A/B was measured before the schema was written and the schema demonstrably reflects its `no-change` verdict; the evidence table is durable, idempotent, and proven against real process death (including a genuinely concurrent two-writer SIGKILL scenario added in the phase's final plan); the disagreement query reports disagreements first with agreement as a count and the block table structurally untouched; the "no data from absence" discipline is enforced by a type-level union plus a four-direction structural test with planted and clean controls (which caught and fixed a real gap during the phase); and the bracket reset (both emulator-side and store-side) is proven against planted concurrent-reset and relaunch scenarios, not merely sequential runs. The test suite settles at its pre-existing, documented 3-failure floor (all in `anno-register.test.ts`, unrelated to this phase), typecheck is clean, and both code-review warnings were fixed with structurally sound corrections that this verification independently confirmed in the current source.

---

_Verified: 2026-09-10T12:59:40Z_
_Verifier: Claude (gsd-verifier)_
