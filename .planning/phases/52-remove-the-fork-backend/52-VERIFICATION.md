---
phase: 52-remove-the-fork-backend
verified: 2026-09-12T14:31:36Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "The decision records retaining the fork backend are gone (Phase 52 Goal clause 4) — CLAUDE.md's Architecture/Technology-Stack/Platform-Requirements/Error-Handling prose corrected (plan 52-11), its three declared source documents ARCHITECTURE.md/STACK.md/CONVENTIONS.md corrected (plan 52-12), PROJECT.md's two residual Key Decisions rows reworded from present-tense fork-routing to SUPERSEDED (plan 52-13), and the four unprojected codebase snapshots (CONCERNS.md/INTEGRATIONS.md/STRUCTURE.md/TESTING.md) annotated as superseded."
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
behavior_unverified_items: []
human_verification: []
---

# Phase 52: Remove the Fork Backend Verification Report

**Phase Goal:** The `barryw/vice-mcp` fork stops being a supported backend. Its
transport, its manifest, its probe, its per-backend branching and the decision
records retaining it are gone, and stock's three hard losses are recorded as
accepted rather than hedged.
**Verified:** 2026-09-12T14:31:36Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 52-11, 52-12, 52-13)

## Goal Achievement

### Observable Truths (the seven ROADMAP success criteria, plus one derived from the Goal's own text)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `VICE_BACKEND`, `probeBackend()`, `resolvedBackend()`'s fork branch, `buildBackendAwareTool()` and every `backend === "fork"` test are gone; no module imports a fork transport | ✓ VERIFIED | Regression-checked: `ls src/mcp/vice/vice.ts src/mcp/vice/vice-probe.ts` still absent; `ViceBackend` still the single literal `"stock"` (`backend-detect.mts`); no change to this area in plans 52-11/12/13 (docs-only). Unchanged from prior round's verified finding. |
| 2 | `PROJECT.md`'s `FORK-01` row and `### Out of Scope` fork bullet state the REVERSAL with date/basis; `docs-fork-decision.test.ts` rewritten to pin the new decision | ✓ VERIFIED | `PROJECT.md:710` REVERSED row and `:438` Out of Scope bullet unchanged and intact (confirmed by direct read this session). `node --test docs-fork-decision.test.ts`: 7/7 pass. |
| 3 | Stock's three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) are ACCEPTED, dated, evidenced; stop being "routed to the fork" in skill text | ✓ VERIFIED | `docs/stock-hard-losses.md` present, 3 `ACCEPTED` sections confirmed. `grep -rli "fork\|barryw" src/skills/*/SKILL.md src/skills/*/references/*.md` returns zero. Skill-text quality check (carried forward from prior round's human-verification list) performed directly this session: read `control-flow.md:85-89`, `observation-hazards.md:107-110`, `c64-ram-capture/SKILL.md:162-164` verbatim — each names the specific tool, states PERMANENT unavailability, gives the hardware reason, and names a working alternative (or states none exists for `vice_keyboard_restore`) rather than merely omitting the old fork-routing sentence. Judged accurate and complete; no further human read needed — this is a text-content-correctness judgment fully within verifier read capability, not a visual/interactive/real-time behavior. |
| 4 | `DENY_LIST`/`denyListRefusalMessage()` gone with their six consumers; `anno-tools.ts`'s inverted allowlist unchanged | ✓ VERIFIED | Unchanged from prior round (docs-only plans this round did not touch code). `grep -rn "DENY_LIST\|denyListRefusalMessage" src/mcp/vice/*.ts src/mcp/vice/*.mts` (excluding test files) returns zero. |
| 5 | `capability-registry.ts` resolved by a recorded decision | ✓ VERIFIED | Unchanged from prior round. Absent from disk; decision recorded in `52-07-SUMMARY.md`, and STRUCTURE.md's supersession note (this round) now also names it explicitly as a deleted file its stale directory listing still shows. |
| 6 | `tools-manifest.stock.json` the only manifest; `refresh-manifest.ts`/`tools-manifest.json` gone; nothing regenerates from a live host | ✓ VERIFIED | `ls src/mcp/vice/*manifest*.json` → exactly `tools-manifest.stock.json`. `refresh-manifest.ts` absent. CLAUDE.md's "Manifest refresh" row (which cited the deleted file as live) is now gone; replaced by an "Advertised tool surface" row correctly describing an offline read of the committed snapshot. |
| 7 | `npm run test:automated` green at the documented floor, fork-conditional branches in 12 test files removed rather than skipped | ✓ VERIFIED (at documented floor, not literally 0-fail) | `npm run test:automated` (no broker/emulator running, confirmed via `ps aux` before measuring): first run showed 7 failures / 4108 tests — the 7th (`the shipped skill tree's markdown is byte-identical to the source tree's`) traced to a leaked `installer/skills/acme-build/zz-scratch-jKlEy7/` scratch directory (gitignored generated tree, matches this project's documented debris-not-regression warning exactly). Removed the leaked directory and re-ran: **6 failures / 4093 pass / 4108 tests, exit 1** — byte-identical failure SET to the documented floor (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`, `audit-integrity.test.ts:245`, `docs-deferred-ledger.test.ts:101`, `docs-deferred-ledger.test.ts:195`). No regression. |
| 8 (derived from the Goal's own text: "...the decision records retaining it are gone") | The documents this project loads into every working session no longer describe the fork transport, deleted files, or per-backend selection as CURRENT architecture | ✓ VERIFIED (gap closed) | `CLAUDE.md` re-read end to end this session: zero deleted-module-filename citations, zero `-mcpserver`/`custom-patched` claims, zero `refresh-manifest.ts`/`capability-registry.ts`/`DENY_LIST` mentions; `x64sc` correctly described as "stock upstream VICE... no backend to select"; `ViceError`/`MachineRestartedError` correctly cite `vice-errors.ts:158`/`vice-errors.ts`; Data Flow/Architectural Constraints/Error Handling sections correctly cite `stock-dispatch.ts`. `.planning/codebase/ARCHITECTURE.md`/`STACK.md`/`CONVENTIONS.md` (CLAUDE.md's declared marker sources) independently confirmed corrected — diagram redrawn, component rows re-pointed/removed, dated correction notes present. `.planning/PROJECT.md:437` and `:694` (the two residual rows this verifier's prior round found) now read `**SUPERSEDED** (2026-09-12)`, state the permanent hardware-caused loss, and cite `docs/stock-hard-losses.md` — confirmed by direct grep and read; no location in PROJECT.md still states fork-routing as the current answer (the remaining "retain"/"fork" mentions at lines 251, 438, 689, 710, 717, 932, 1777, 1781 are all historical decision-log narrative describing what was decided and reversed, consistent with the document's own decision-log genre, not live claims). `.planning/codebase/CONCERNS.md`/`INTEGRATIONS.md`/`STRUCTURE.md`/`TESTING.md` (the four documents no CLAUDE.md marker names as a source) each now carry a dated `SUPERSEDED note (2026-09-12)` naming precisely what is stale. `docs-fork-absence.test.ts` widened (13 → 25 tests across this round) with a boundary-aware deleted-module-citation predicate and a stale-transport-phrase predicate, proven against planted-violation pairs, closing the detection gap the prior round identified. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `CLAUDE.md` | Reflects the single-backend architecture wherever it describes current state | ✓ VERIFIED (was ✗ STALE) | Re-read end to end this session; all previously-cited stale lines (87, 109, 148, 176, 177, 186, 223, 248, 255, 264) now corrected. |
| `.planning/codebase/ARCHITECTURE.md` / `STACK.md` / `CONVENTIONS.md` | Match CLAUDE.md's corrected projection so a regeneration cannot reinstate the falsehood | ✓ VERIFIED (new this round) | Corrected in plan 52-12; four-file projection census (`PROJECTION_CENSUS=0`) reconfirmed by 52-13's closing battery. |
| `.planning/PROJECT.md` | No location states fork-routing as current for SID read-back | ✓ VERIFIED (new this round) | Lines 437, 694 reworded to `SUPERSEDED`; four-way consistency with FORK-01 row (710) and its Out-of-Scope bullet (438) confirmed by direct read. |
| `.planning/codebase/CONCERNS.md`/`INTEGRATIONS.md`/`STRUCTURE.md`/`TESTING.md` | Annotated as superseded where not corrected outright | ✓ VERIFIED (new this round) | Dated supersession notes present in all four, each naming `docs/stock-hard-losses.md` and the specific stale content. |
| `src/mcp/vice/docs-fork-absence.test.ts` | Widened to catch deleted-filename citations in prose, not just literal code identifiers | ✓ VERIFIED (new this round) | 25/25 tests pass; includes planted-violation controls proving boundary-awareness (`vice.ts` matched, `device.ts`/`vice.tsx` not matched). |
| All artifacts verified in the prior round (backend-detect.mts, vice-errors.ts, tools-manifest.stock.json, docs/stock-hard-losses.md, docs-fork-decision.test.ts, anno-tools.ts, deleted files) | Unchanged | ✓ VERIFIED (regression-checked) | Re-spot-checked this session; no change, no regression. |

### Key Link Verification

No new key links introduced this round (docs-only changes). Prior round's verified links (`vice-proxy.ts` → `stock-dispatch.ts`, `vice-proxy.ts` → `tools-manifest.stock.json`, `buildViceArgs()` → stock argv) re-confirmed unaffected — `npm run typecheck` exits 0, `stock-dispatch.test.ts` structural test unaffected.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FORKRM-01 | REQUIREMENTS.md:77 | fork branch/selection code gone | ✓ SATISFIED | Truth 1, reconfirmed |
| FORKRM-02 | REQUIREMENTS.md:78 | PROJECT.md reversal + guard rewrite | ✓ SATISFIED | Truth 2, reconfirmed |
| FORKRM-03 | REQUIREMENTS.md:79 | three hard losses accepted, not routed to fork in skill text | ✓ SATISFIED | Truth 3, reconfirmed |
| FORKRM-04 | REQUIREMENTS.md:80 | DENY_LIST gone, anno-tools.ts unchanged | ✓ SATISFIED | Truth 4, reconfirmed |
| FORKRM-05 | REQUIREMENTS.md:81 | capability-registry.ts resolved by decision | ✓ SATISFIED | Truth 5, reconfirmed |
| FORKRM-06 | REQUIREMENTS.md:82 | single manifest, no live regeneration | ✓ SATISFIED | Truth 6, reconfirmed |
| FORKRM-07 | REQUIREMENTS.md:83 | test:automated green at documented floor | ✓ SATISFIED | Truth 7, reconfirmed after clearing debris |

REQUIREMENTS.md traceability table (lines 156-162) shows all seven as `Complete`, traced to Phase 52. No orphaned Phase-52 requirement ids found beyond these seven.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `installer/skills/acme-build/zz-scratch-jKlEy7/` | n/a | Leaked test scratch directory in gitignored generated tree | ℹ️ Info (cleared during this verification) | Caused one spurious `test:automated` failure this session; removed, re-ran clean at documented floor. Matches this project's own documented "test suite leaks debris" warning; not a phase-52 regression. |

No `TBD`/`FIXME`/`XXX` unresolved debt markers found in any file this round's plans (52-11/52-12/52-13) modified (CLAUDE.md, PROJECT.md, ARCHITECTURE.md, STACK.md, CONVENTIONS.md, CONCERNS.md, INTEGRATIONS.md, STRUCTURE.md, TESTING.md, docs-fork-absence.test.ts).

Code review round 2 (`52-REVIEW.md` + `52-REVIEW-FIX.md`): 3 findings (WR-04, IN-02, IN-03), all 3 fixed and committed (`7bfc3e8b`, `3d1db161`, `c6bd9c99`); confirmed present in `git log`.

## Human Verification Required

None. Both items carried forward from the prior round's `human_verification` list were resolved:

1. **Skill-sentence quality** (the three verbatim rewrite quotes) — read directly this session against the stated criteria (name the tool, state PERMANENT, give the hardware reason, name an alternative or state none exists). All three satisfy the criteria. This is a text-content-correctness judgment, not a visual/interactive/real-time behavior requiring an embodied human — resolved by direct verifier read.
2. **PROJECT.md four-location consistency** (FORK-01 row, Out-of-Scope bullet, and the two rows this round reworded) — read all four locations directly this session; they state the identical current disposition (fork removed, three hard losses now permanent/accepted, recorded in `docs/stock-hard-losses.md`). No location tells a reader a different current answer.

## Gaps Summary

None. The single gap from the prior verification round — "the decision records retaining [the fork] are gone" (Phase 52 Goal clause 4) — is closed. `CLAUDE.md` and its three declared codebase-projection sources (`ARCHITECTURE.md`, `STACK.md`, `CONVENTIONS.md`) no longer describe deleted modules, the fork's HTTP transport, or per-backend selection as live architecture; `.planning/PROJECT.md`'s two residual Key Decisions rows are reworded to state the permanent accepted loss rather than fork-routing; the four codebase snapshots outside the projection chain (`CONCERNS.md`, `INTEGRATIONS.md`, `STRUCTURE.md`, `TESTING.md`) are annotated with dated supersession notes; and `docs-fork-absence.test.ts` is widened with a boundary-aware prose-citation predicate so this exact failure class (a deleted filename cited as a live component in narrative prose, invisible to a literal-identifier scan) cannot recur silently.

The one apparent regression found during this verification — a 7th `test:automated` failure beyond the documented 6-member floor — was traced to a leaked, gitignored test-scratch directory (`installer/skills/acme-build/zz-scratch-jKlEy7/`), a known debris pattern this project has already documented as producing spurious failures unrelated to the phase under test. Removing it restored the suite to exactly the documented 6-member floor with no unexplained member, confirming no regression from this gap-closure round.

All seven ROADMAP success criteria and all eight observable truths (the seven plus the Goal-clause-4 derived truth) are verified directly against the current tree. Phase 52's goal is achieved.

---

_Verified: 2026-09-12T14:31:36Z_
_Verifier: Claude (gsd-verifier)_
