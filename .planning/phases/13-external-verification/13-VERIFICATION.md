---
phase: 13-external-verification
verified: 2026-08-22T01:05:16Z
status: gaps_found
score: 8/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The automated test gate (`npm run test:automated`) is green at the end of the phase, and the milestone's `docs-*.test.ts` guard set stays green (a must-have repeated in every one of this phase's five plans' `<verification>` blocks)."
    status: failed
    reason: >
      Re-running the gate right now (not trusting the orchestrator's earlier "0 fail" report) shows
      2091 tests / 2084 pass / 2 fail / 5 todo. Both failures trace to the SAME root cause: this
      phase's own code-review report, `13-REVIEW.md` (generated 2026-08-22T00:56:11Z, AFTER plan
      13-05's SUMMARY was written at 00:42:39Z), records 4 findings (WR-01, WR-02, IN-01, IN-02,
      `status: issues_found`) that have no disposition anywhere — no todo names them, no SUMMARY
      cites them as accepted, and no source fix addresses them. `docs-review-disposition.test.ts`
      (the project's own "AUDIT-01, self-applied" completeness guard) fails directly because of
      this. That failure then trips `audit-integrity.test.ts`'s D-12-02 guard — GATE-01, already
      recorded `Complete` from Phase 12 ("a milestone audit cannot record status: passed while any
      of the four docs-*.test.ts guards is red") — because `v0.3.0-MILESTONE-AUDIT.md` still
      declares `status: passed` while a docs guard is now red. This is not a pre-existing,
      carried-forward flake: the project's own established pattern (Phase 08/09/10/11's review
      findings were each filed as a pending todo naming the reason, e.g.
      `2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md`) was not applied here,
      because the code review ran after every plan in this phase (including 13-05, whose job was
      exactly this kind of ledger reconciliation) had already produced its SUMMARY. Nothing in the
      phase closes the loop the review itself opened.
    artifacts:
      - path: ".planning/phases/13-external-verification/13-REVIEW.md"
        issue: "4 findings (WR-01 shell-interpolated command check in probe-binmon.mjs; WR-02 probe-binmon.mjs six-concern file-size warning; IN-01 A3 polarity short-circuit; IN-02 backend-detect transcripts omitted from reviewed file list), `status: issues_found`, none dispositioned."
      - path: ".planning/STATE.md"
        issue: "Deferred Items section (updated by plan 13-05 at 00:42:39Z) predates the review (00:56:11Z) and therefore has no row for these 4 findings — the section that is supposed to be the single source of truth for 'every finding this phase surfaced' is silently missing this one."
    missing:
      - "File a todo dispositioning WR-01/WR-02/IN-01/IN-02 (or fix them at source — WR-01 in particular has a two-line fix already written in the review itself), matching the established pattern used for every prior phase's review findings."
      - "Add the corresponding row(s) to `STATE.md`'s Deferred Items table so `docs-deferred-ledger.test.ts` keeps reflecting the true pending-todo set."
      - "Re-run `npm run test:automated` and confirm 0 fail before treating the phase's automated-gate must-have as satisfied."
  - truth: "EXTV-03: 'any detail the binary contradicts is corrected at its source rather than noted' — REQUIREMENTS.md's own literal acceptance text for this requirement."
    status: partial
    reason: >
      A5 (AUTOSTART `fileIndex` with `runAfter=false`) came back CONTRADICTED per `13-PROBE-RESULTS.md`,
      but it was NOT corrected at its source — plan 13-04's Task 2 produced zero diff for A5 and
      instead invoked D-13-04's documented escape hatch (the contradiction is an advertised
      *tool-contract* problem — `vice_disk_attach`'s D-14 "attach without loading or running"
      promise — not a wire-encoding bug), filing
      `.planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`
      (priority: high) instead. This is a reasonable, deliberately-planned decision recorded in
      `13-CONTEXT.md` before any plan ran (verification phases should not silently absorb feature/
      contract redesign), and it is executed exactly as decided. But REQUIREMENTS.md's EXTV-03 text,
      as literally written, does not carve out that exception, and A5's `[ASSUMED]` label is a wire
      detail that stays on with the finding "noted" (filed as a todo) rather than "corrected at its
      source" — which is the literal reading of the checked-off requirement. This is a genuine
      wording/scope tension the phase's own design decision created, not a defect in what was built.
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "EXTV-03's checked-off ([x] Complete) text and the actual A5 disposition (escape-hatch todo, not a source correction) are in tension; no note in REQUIREMENTS.md acknowledges the D-13-04 carve-out."
    missing:
      - "A human decision: either amend EXTV-03's wording (or add a footnote) to acknowledge D-13-04's escape hatch as a legitimate closure path, or treat EXTV-03 as not-yet-fully-satisfied until the `vice_disk_attach` contract correction todo is closed."
human_verification: []
---

# Phase 13: External Verification Verification Report

**Phase Goal:** Replace *asserted* protocol/discriminator/assumption evidence with real-hardware
evidence for `VERIF-02`'s three binmon fixtures (EXTV-01), the `--help` backend discriminator
(EXTV-02), and Phase 3's four wire assumptions A1/A2/A3/A5 (EXTV-03) — honestly, with no
partially-stripped labels, no silently-absorbed findings, and no requirement closed on a document
edit alone.
**Verified:** 2026-08-22T01:05:16Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EXTV-01: three `VERIF-02` binmon fixtures are real captures, no sidecar still declares synthetic | ✓ VERIFIED | All three sidecars read back from disk: `synthetic: false`, exactly 5 keys, `capturedFrom: "fork:/usr/local/bin/x64sc"`, `viceVersion: "3.10.0.0"`. `13-CAPTURE-TRANSCRIPT.md` decodes every frame byte-by-byte; `checkpoint-list` terminator CONFIRMED (0x14, 4-byte u32LE count); `event-interleaved` order matches `docs/phase1-probe-results.md:248`. `binmon-fixtures.test.ts`, `stock-protocol.test.ts` green. |
| 2 | No document/module header/test still describes the three fixtures as synthetic | ✓ VERIFIED | `grep -c 'NOT currently real captures' binmon-fixtures.test.ts` = 0; `binmon-fixtures.ts` header states all six fixtures are real; `fixtures/binmon/README.md`'s table has zero synthetic rows; D-13-06 fork-vs-genuine mislabel corrected in prose. |
| 3 | EXTV-02: `--help` discriminator confirmed against both real stock and real fork `x64sc`, transcripts committed | ✓ VERIFIED | `fixtures/backend-detect/{stock,fork}-help-transcript.{txt,json}` committed, `capturedFrom: "real hardware"`, real binary paths/versions. `13-HELP-DISCRIMINATOR-EVIDENCE.md` records `probeBackend()` → `stock`/`fork` (never `unknown`) and `resolvedBackend()`'s cache round-trip (1 probe then 0). `backend-detect.test.ts` REAL HARDWARE block: 50/50 pass. |
| 4 | Fallback-ladder (`-help`/`-?`) honesty | ✓ VERIFIED | Recorded explicitly as "unexercised on this host," not confirmed — both real builds exit 0 with non-empty `--help` output, so the ladder's later branches are never reached. Matches `docs/phase2-backend-probe-evidence.md` §2's resolution text exactly. |
| 5 | EXTV-03: four wire assumptions (A1/A2/A3/A5) probed against a real binary, one verdict each | ✓ VERIFIED | `13-PROBE-RESULTS.md`: A1 CONFIRMED (real accepting listener, corroborated by `ss -ltnp`), A2 CONFIRMED (post-step PC == JSR+3, PC register id discovered dynamically), A3 INCONCLUSIVE (zero CIA1 delta across 5 single-bit rounds, 2 sessions), A5 CONTRADICTED (full reset+load despite `runAfter=false`). No checkpoint armed anywhere in the probe-assumptions code region (confirmed by source read). |
| 6 | EXTV-03: any CONTRADICTED detail is corrected at its source rather than noted | ⚠️ PARTIAL | A5 is the only CONTRADICTED verdict, and it was deliberately **not** corrected at source — D-13-04's escape hatch fired because the wrongness is `vice_disk_attach`'s advertised tool contract, not the wire encoder; a todo was filed instead. This is a reasoned, pre-planned decision (see `13-CONTEXT.md`), but it is in literal tension with REQUIREMENTS.md's own EXTV-03 wording. See gap #2 below. |
| 7 | Label discipline: A1/A2 labels removed everywhere; A3/A5 kept everywhere; never a partial strip | ✓ VERIFIED | `grep -rn '\[ASSUMED\]'` (excluding `resources/`, `*.test.*`) shows A1/A2 gone from `broker-launch.mts`/`stock-execution.ts`/`stock-protocol.ts:742`; A3 (`stock-input.ts:161,166`, `stock-protocol.ts:796`) and A5 (`stock-protocol.ts:852`) untouched. `assumption-label-discipline.test.ts`: 7/7 pass, including a planted-violation non-vacuity test that actually caught a real false-positive in the plan's own Task 1 edit (documented and fixed in 13-04-SUMMARY.md). |
| 8 | A4's `03-RESEARCH.md` row is byte-for-byte untouched (D-13-05) | ✓ VERIFIED | `git diff 1359ef7 -- .planning/phases/03-direct-tools/03-RESEARCH.md`: A4's row line is absent from the diff; A1/A2/A3/A5 rows each gained a "Post-probe status" sentence only. |
| 9 | Deferred ledger (`STATE.md` ↔ `.planning/todos/pending/`) stays reconciled in both directions | ✓ VERIFIED (in isolation) | `docs-deferred-ledger.test.ts` 4/4 pass standalone. Both finished todos `git mv`-moved to `completed/` with Resolution sections; probe-debt todo trimmed to A4-only; two new todos filed (`cpuhistory-get*` mislabel, `vice_disk_attach` contract). **However**, this reconciliation is now stale relative to the phase's own later-generated `13-REVIEW.md` findings — see gap #1. |
| 10 | `npm run test:automated` is green at phase close | ✗ FAILED | Re-run just now: 2091 tests / 2084 pass / **2 fail** / 5 todo. Both failures (`docs-review-disposition.test.ts`, `audit-integrity.test.ts`) trace to `13-REVIEW.md`'s 4 undispositioned findings. This directly contradicts the "0 fail" state reported to this verifier and every plan's own `<verification>` requirement. See gap #1. |

**Score:** 8/10 truths fully verified, 1 partial (EXTV-03 literal wording vs. the escape-hatch outcome), 1 failed (automated gate currently red). Rolled up to the must-haves count: 8/9 (truths 1–2, 3–4, 5, 7, 8, 9 collapse to distinct must-haves; 6 and 10 are the two flagged items).

### Deferred Items

None — no gap here is addressed by a later phase in the current roadmap. `GATE-02` (phase 15) is scoped to Phase 08/09/10/11's *already-known* review findings (`WR-04`..`WR-12`, `IN-01`..`IN-03`, `WR-13`, `02-REVIEW.md`'s `IN-05`); it does not mention or cover Phase 13's own `13-REVIEW.md` findings, which postdate GATE-02's scoping. Nothing in the roadmap currently owns closing this gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fixtures/binmon/{display-get,event-interleaved,checkpoint-list}.{bin,json}` | Real captures | ✓ VERIFIED | 5-key sidecars, `synthetic: false`, truthful `fork:` kind; `.bin` byte lengths match decoded frame totals exactly. |
| `13-CAPTURE-TRANSCRIPT.md` | Answers 6 numbered acceptance steps | ✓ VERIFIED | All 6 steps present, both verdict words (CONFIRMED / matches) stated explicitly. |
| `fixtures/backend-detect/{stock,fork}-help-transcript.{txt,json}`, `README.md` | Real-hardware transcripts + sidecars | ✓ VERIFIED | `capturedFrom: "real hardware"`, real paths/versions; directory README documents the cmp non-determinism finding honestly. |
| `13-HELP-DISCRIMINATOR-EVIDENCE.md` | Live-run record | ✓ VERIFIED | Enumeration, `probeBackend()`/`resolvedBackend()` verdicts, all 3 assumed sub-claims answered. |
| `probe-binmon.mjs` `--probe-assumptions` mode | 4 probes, offline-selftest-covered | ✓ VERIFIED | `--selftest` passes; `runAssumptionProbes`/`probeA{1,2,3,5}*` all present; no `CHECKPOINT_SET` in the probe region. |
| `13-PROBE-RESULTS.md` | 4 verdicts + `ss -ltnp` + Consequences section | ✓ VERIFIED | All present, A2/A3 explicitly state "accepted body necessary but not sufficient." |
| `assumption-label-discipline.test.ts` | Non-vacuous all-or-nothing guard | ✓ VERIFIED | 7/7 pass including planted-violation test; derives scan from directory read with a floor. |
| `.planning/todos/completed/2026-08-13-{re-record-binmon-fixtures,confirm-help-discriminator}...md` | Moved with Resolution sections | ✓ VERIFIED | Both present in `completed/`, absent from `pending/`, `git mv` (rename) confirmed. |
| `.planning/todos/pending/2026-08-22-{cpuhistory-get-sidecars-mislabel,vice-disk-attach-approximation}...md` | Newly filed findings | ✓ VERIFIED | Both exist, substantive (not stubs), name affected files/behavior precisely. |
| `13-REVIEW.md` | Code review disposition | ✗ **UNWIRED** | Exists with real, substantive findings (0 critical / 2 warning / 2 info) — but nothing in the phase closes the loop it opens; see gap #1. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `buildSidecar()` in `probe-binmon.mjs` | 3 new binmon sidecars | sole writer, no hand-typed fields | ✓ WIRED | Confirmed by matching key set/values exactly against `runCapture()`'s known output shape. |
| `13-PROBE-RESULTS.md`'s "Consequences for plan 13-04" | plan 13-04's label edits | sole authority, not re-derived | ✓ WIRED | 13-04-SUMMARY.md's grep inventory matches the consequences table's per-row disposition exactly (A1/A2 removed, A3/A5 kept). |
| `docs/phase2-backend-probe-evidence.md` §1/§2 | `13-CAPTURE-TRANSCRIPT.md` / `13-HELP-DISCRIMINATOR-EVIDENCE.md` | citation by path | ✓ WIRED | Both sections cite the artifact paths and state findings that match the artifacts' own content (spot-checked). |
| `.planning/todos/pending/` | `STATE.md`'s Deferred Items | `docs-deferred-ledger.test.ts` | ⚠️ STALE | Wired and passing in isolation, but the ledger predates `13-REVIEW.md` (generated after plan 13-05), so it does not yet reflect this phase's own newest undispositioned findings — not a wiring break, a timing gap. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Sidecar provenance round-trips through `loadCapturedFixture()` | `node -e '...loadCapturedFixture(c)...'` (binmon-fixtures.ts) | 3/3 report `synthetic: false` | ✓ PASS |
| `classifyHelpOutput()` correctly classifies both real transcripts | `node --test backend-detect.test.ts` | 50/50 pass | ✓ PASS |
| Label-discipline guard is non-vacuous | `node --test assumption-label-discipline.test.ts` | 7/7 pass, planted-violation rejected | ✓ PASS |
| Deferred ledger guard, standalone | `node --test docs-deferred-ledger.test.ts` | 4/4 pass | ✓ PASS |
| Full automated gate | `npm run test:automated` | 2091 tests / 2084 pass / **2 fail** / 5 todo | ✗ FAIL |
| `npx tsc --noEmit` | — | clean | ✓ PASS |

### Probe Execution

Not applicable in the formal `scripts/*/tests/probe-*.sh` sense — this phase's "probes" are the phase's own subject matter (`probe-binmon.mjs --probe-assumptions`, `probe-binmon.mjs --capture`), already executed and recorded as evidence documents (`13-CAPTURE-TRANSCRIPT.md`, `13-HELP-DISCRIMINATOR-EVIDENCE.md`, `13-PROBE-RESULTS.md`), each independently spot-checked above against the actual committed bytes/source rather than accepted on narrative alone.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| EXTV-01 | 13-01 | Real-capture the 3 binmon fixtures | ✓ SATISFIED | `13-CAPTURE-TRANSCRIPT.md`, sidecar read-back, `docs/phase2-backend-probe-evidence.md` §1 closure. |
| EXTV-02 | 13-02, 13-05 | Confirm `--help` discriminator against both real builds | ✓ SATISFIED | `13-HELP-DISCRIMINATOR-EVIDENCE.md`, `fixtures/backend-detect/`, `docs/phase2-backend-probe-evidence.md` §2 closure. |
| EXTV-03 | 13-03, 13-04, 13-05 | Probe 4 wire details, correct contradictions at source | ⚠️ PARTIALLY SATISFIED | 3 of 4 assumptions (A1 CONFIRMED, A2 CONFIRMED, A3 INCONCLUSIVE — correctly left `[ASSUMED]`) match the requirement's spirit; A5 (CONTRADICTED) was **not** corrected at source per REQUIREMENTS.md's literal text — see gap #2. No requirement in this phase's ID set is orphaned; all three map to a plan. |

No orphaned requirements found — `grep -E "Phase 13"` / the PLAN frontmatter `requirements:` fields for all 5 plans collectively cover exactly EXTV-01/02/03, matching REQUIREMENTS.md's phase-13 mapping.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `probe-binmon.mjs` | 1486-1489 | Shell-interpolated `sh -c` command construction in `checkCommandAvailable()` | ⚠️ Warning (already disclosed as `13-REVIEW.md` WR-01) | Dev-only probe script, single hardcoded call site today, not currently exploitable — but the pattern itself is the project's own named anti-pattern elsewhere in the same file. Undispositioned (part of gap #1). |
| `probe-binmon.mjs` | whole file, 2429 lines | File has grown to mix 5 distinct concerns (`13-REVIEW.md` WR-02) | ℹ️ Info | No correctness impact; maintainability note. Undispositioned (part of gap #1). |

No `TODO`/`FIXME`/`XXX`/`TBD` debt markers found in any file this phase touched (`probe-binmon.mjs`, `stock-protocol.ts`, `stock-input.ts`, `stock-execution.ts`, `broker-launch.mts`, `binmon-fixtures.ts`, `backend-detect.test.ts`, `assumption-label-discipline.test.ts`).

### Human Verification Required

None required for this report's own findings — both flagged items (gap #1, gap #2) are mechanically confirmed facts (a currently-red test suite; a literal-wording tension against a pre-planned, documented decision), not ambiguous or UI/runtime-only questions. Gap #2, specifically, needs a **human decision** (not verification): whether D-13-04's escape hatch is accepted as satisfying EXTV-03's letter, or whether EXTV-03 should be reopened pending the `vice_disk_attach` contract-correction todo's closure. That decision does not require re-running anything — it requires a maintainer call, which is why it is recorded as a `partial` gap rather than a `human_verification` entry.

### Gaps Summary

Phase 13 delivered exactly what it set out to deliver for EXTV-01 and EXTV-02: the evidence is real, the provenance is truthfully labelled (including the fork-vs-stock distinction CLAUDE.md and MEMORY.md both call out), the retired verdicts in `docs/phase2-backend-probe-evidence.md` are honestly closed with citations, and the milestone's own established discipline (label all-or-nothing, deferred-ledger reconciliation, todo-not-silent-absorption) was followed carefully and even caught its own bug once (the label-discipline guard's planted-violation test flagging a false positive in the plan's own comment, documented in 13-04-SUMMARY.md).

The phase's one real gap is procedural, not a defect in the evidence itself: **the code review that closes out the phase (`13-REVIEW.md`) ran after every plan's SUMMARY was already written, so its 4 findings were never dispositioned by anything** — no todo, no accepted-in-summary note, no fix. This leaves `npm run test:automated` red right now (2 failures), which in turn trips the already-closed GATE-01 invariant (a milestone audit currently reads `passed`/`tech_debt` while a `docs-*.test.ts` guard is red). This is exactly the failure mode GATE-01 and `docs-review-disposition.test.ts` exist to catch, and it is currently live. The fix is small and has a clear, already-used precedent (file a todo naming WR-01/WR-02/IN-01/IN-02, or fix WR-01 directly since the review already wrote the fix), but it has not happened, so the phase cannot be called fully closed yet.

The second, lower-severity item is a wording tension: EXTV-03's literal REQUIREMENTS.md text ("any detail the binary contradicts is corrected at its source rather than noted") does not anticipate D-13-04's escape hatch, which is exactly what fired for A5. The escape hatch is a reasonable, pre-planned decision recorded before any plan executed, and its outcome (a high-priority todo naming a real, evidenced tool-contract defect) is arguably a *better* outcome than a rushed in-phase contract redesign — but it is not what EXTV-03's own checked-off text says happened. This needs a maintainer decision, not more work.

---

*Verified: 2026-08-22T01:05:16Z*
*Verifier: Claude (gsd-verifier)*
