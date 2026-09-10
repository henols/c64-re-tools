---
phase: 44-proof-04-the-independent-external-check
verified: 2026-09-10T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Read evidence/proof04-false-positives.md end to end and confirm three prose judgments a command cannot make: (1) the number is stated beside PROOF-01's figures rather than presented as replacing/correcting them; (2) no sentence anywhere reads as a clean bill of health for never-observed addresses; (3) the narrowed run's limits are stated as their own section rather than softened into a parenthetical."
    expected: "All three judgments hold (this verifier's own reading of the record, reported below, found all three to hold; a human reviewer should still independently confirm the tone/framing judgment, per this phase's own plan-emitted human-check block, harvested to end-of-phase per workflow.human_verify_mode=end-of-phase)."
    why_human: "Whether prose reads as 'beside, not replacing' versus a 'clean bill of health' is a tone/framing judgment, not a fact a grep can settle. This is a planner-emitted <human-check> block from plan 44-03's own <verify> section, harvested per project policy rather than a gap I am asserting independently."
---

# Phase 44: PROOF-04 — The Independent External Check — Verification Report

**Phase Goal:** `PROOF-01` gains the independent external check it shipped without. Its false-positive count becomes computable for the first time, on real cracked code, using observed execution as the oracle — closing the reversal condition stated verbatim at the v0.8.0 open ("a binary-monitor-reachable execution oracle, or a decision to open the text channel") by the second branch, deliberately and on the record.

**Verified:** 2026-09-10
**Status:** human_needed

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A false-positive count is computed and stated with its denominator and positive class; PROOF-01's `100.00 (24/24)`, fixture `72.39 (97/134)` and pivot `72.46 (100/138)` figures are stated beside the new number rather than replaced | ✓ VERIFIED | `evidence/proof04-false-positives.md` states `168/45072` (hit 50, `frame-exact-region`) and `434/45072` (hit 3000, `narrowed`), positive class `code`, tier `runtime-observed`. All three Phase 38 figures appear verbatim with source path `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md`, independently confirmed byte-for-byte against that source file by this verifier (`grep` on the source file returned the exact same three literal strings). A dedicated "Beside it, not instead of it" section states the two measurements point in different directions (recall vs. false-positive) so neither supersedes the other. |
| 2 | The check is genuinely independent of the thing it checks — asserted structurally, not promised | ✓ VERIFIED | Read both producer scripts directly (not from SUMMARY claims): `proof04-subject-dxa.mjs` imports only `node:` builtins, the compiled `host-tool.mjs` seam and `dxa-run.ts`; `proof04-oracle-memmap.mjs` imports only `node:` builtins, `probe-harness.mjs`, `text-protocol.ts`, `textmon-memmap.ts`, `stock-protocol.ts`, `evid-ingest.ts`. Neither script's own code (outside header-comment prose) names the other's domain or the other's output artifact basename. Ran `node --test evidence/proof04-independence.test.ts` myself: 7/7 pass, including two PLANTED-violation cases that (a) correctly flag a forbidden specifier in a real import position and (b) correctly do NOT flag the same token appearing only in a comment — proving the specifier-scoped checker has teeth in both directions, not merely a promise. The join driver (`proof04-reconcile.mjs`) contains exactly one call site to `reconcileObservedExecution()`, confirmed both by the passing test and by direct source reading; all four returned buckets and the denominator come from that single call's return value, never re-derived by hand. |
| 3 | A shortfall is recorded as a shortfall, absence is never converted into `data`; `not-exercised` is recorded with what was searched and at what depth when the check cannot run at all; EVID-06's frame-exactness bound governs what may be claimed at each depth | ✓ VERIFIED | Neither of this phase's two live runs was actually a shortfall (both reached their target depth exactly — Run A 50/50, Run B 3000/3000), so the shortfall path was not exercised on real hardware. However, the machinery for it is present and independently verified as correct: I read `deriveVerdict()` in `proof04-reconcile.mjs` directly — it selects `unresolved` when `blockAddressesObserved === 0` (stating `0 of <denominator>`) and `not-exercised` when `oracleDepthReached === 0`, `oracleParseRefusal !== "none"`, or `denominator === 0`, never converting either bucket into a class. I ran `proof04-reconcile.mjs --self-check` myself: all four synthetic cases pass, including `empty-observations` (asserts verdict is `unresolved`, never `resolved`, on zero observations) and `zero-denominator` (asserts verdict is `not-exercised`, no `%` character forms). `proof04-oracle-memmap.mjs`'s short-run branch (read directly) records `ORACLE_DEPTH_REACHED`/`ORACLE_SHORT_RUN` and continues to `memmapshow` rather than throwing — this specific continuation was not exercised live (both runs reached target), a narrower gap than the top-level claim. The `narrowed`/`frame-exact-region` depth-label rule (threshold 50) is correctly derived mechanically in both producer and record, cross-checked by the independently-run `proof04-verify-record.mjs` gate. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Prohibitions (judgment-tier, non-authoritative LLM assessment — flagged per ADR-550)

| # | Prohibition | Disposition |
|---|-------------|-------------|
| 1 | A run producing an inconvenient number must never be silently discarded and re-taken | No evidence of discarding. Both plans' SUMMARY files record exactly the runs attempted (2 in plan 44-01's tracer + subject/oracle, 2 in plan 44-02), no evidence of retries for a "better" number. **unverified — human review recommended** (judgment-tier, cannot be proven negative by inspection alone). |
| 2 | The derivation rule must never be amended after a measurement was taken | `SCHEMA.md`'s "Amendment ledger" (§9) is empty; git history confirms `SCHEMA.md` was committed (`c62c261b`, 17:13:09) strictly before both run transcripts (`00450ac3` 17:28:40, `dd1517e8` 17:32:15) and before the findings record (`61c3d220`, `2d9f89b3`). No amendment occurred. **resolved by direct evidence** — not merely judgment. |
| 3 | `not-exercised` must never be selected as a convenience | Neither run selected `not-exercised`; both are `resolved` on real coverage. No occasion for this prohibition to have been tested against real temptation in this run. **unverified — human review recommended** (judgment-tier). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `evidence/SCHEMA.md` | Derivation rule fixed before measurement | ✓ VERIFIED | Committed at `c62c261b` (2026-09-10 17:13:09), before both run transcripts. Declares all three verdict tokens and both depth labels; states in words "`not-exercised` is not a pass" (§8). |
| `evidence/proof04-subject-dxa.mjs` | Subject producer, closed import boundary | ✓ VERIFIED | Read directly; imports only `host-tool.mjs`/`dxa-run.ts`; asserts corpus and entry digests before use; writes `BlockEntry[]` in memory (no `.annostore`). |
| `evidence/proof04-oracle-memmap.mjs` | Oracle producer, closed import boundary | ✓ VERIFIED | Read directly; imports only `probe-harness.mjs`/`text-protocol.ts`/`textmon-memmap.ts`/`stock-protocol.ts`/`evid-ingest.ts`; never throws on short run; surfaces (never absorbs) a parse refusal. |
| `evidence/proof04-reconcile.mjs` | Join driver, single call site | ✓ VERIFIED | Read directly and test-confirmed; exactly one `reconcileObservedExecution()` call; `--self-check` mode runs and passes all four synthetic edge cases. |
| `evidence/proof04-independence.test.ts` | Non-vacuous structural independence proof | ✓ VERIFIED | Ran myself: 7/7 pass including both directions of the planted-violation control. |
| `evidence/proof04-run-a-hit50.md` | Licensed run transcript | ✓ VERIFIED | Exists, one `PROOF04_VERDICT resolved` line, `ORACLE_DEPTH_REACHED 50`, `ORACLE_DEPTH_LABEL frame-exact-region`, EVID-06/S3 quoted verbatim with source paths, `PROOF04_SELF_MODIFICATION_CAVEAT` present, `BROKER_STATE: inactive` before/after. |
| `evidence/proof04-run-b-narrowed.md` | Narrowed run transcript | ✓ VERIFIED | Exists, `PROOF04_VERDICT resolved`, `ORACLE_DEPTH_REACHED 3000`, `ORACLE_DEPTH_LABEL narrowed`, EVID-06 non-extension and hit-75 boundary stated (not softened), cites identical `SUBJECT_ARTIFACT_SHA256` to Run A. |
| `evidence/proof04-false-positives.md` | Closing findings record | ✓ VERIFIED | All 9 required sections present (8 + appended integrity section); Phase 38 figures transcribed verbatim and independently confirmed against source; `PROOF04_PHASE_VERDICT resolved`; `PROOF-03`/`ANNO-13`/`14`/`15` explicitly named as not closed. |
| `evidence/proof04-verify-record.mjs` | Non-vacuous consistency gate | ✓ VERIFIED | Ran myself against the committed record: `RECORDGATE_RESULT pass`, all 7 named assertions pass. Ran myself against a planted altered `PROOF04_DENOMINATOR`: exits non-zero, exactly the 3 tied assertions (`RUN_AGREEMENT`, `BUCKET_IDENTITY`, `PERCENTAGE_SHAPE`) fail as the record itself claims — confirmed non-vacuous by direct reproduction, not by trusting the SUMMARY's claim. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `proof04-subject-dxa.mjs` | `c1541.dir`/`c1541.read` host-tool seam | `runHostTool()` | ✓ WIRED | Confirmed by direct source read; no direct `child_process` spawn of `c1541` anywhere. |
| `proof04-subject-dxa.mjs` | `dxa-run.ts` | `runDxaDisassemble()` | ✓ WIRED | Confirmed by direct source read; no direct spawn of `dxa`. |
| `proof04-oracle-memmap.mjs` | `textmon-memmap.ts` → `evid-ingest.ts` | `parseAccessMap()` → `ingestAccessMap()` | ✓ WIRED | Confirmed by direct source read; parse refusal surfaced (not absorbed) per the script's own explicit branch. |
| `proof04-reconcile.mjs` | `evid-reconcile.ts` | `reconcileObservedExecution()`, called once | ✓ WIRED | Confirmed by both the passing structural test and direct source reading (single call site). |
| Both run transcripts | The single subject artifact | Shared `SUBJECT_ARTIFACT_SHA256` | ✓ WIRED | Confirmed identical hash (`db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a`) cited in both transcripts and re-derived independently by `proof04-verify-record.mjs`'s `SUBJECT_DIGEST` assertion, which I ran myself. |
| Findings record | Both run transcripts | `proof04-verify-record.mjs` re-derivation | ✓ WIRED | Confirmed by running the gate myself against the real committed files (pass) and against a planted violation (correctly fails). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PROOF-04 | 44-01, 44-02, 44-03 | Independent external check for PROOF-01's false-positive count | ✓ SATISFIED | Measured, gated, cross-checked as detailed above. `.planning/REQUIREMENTS.md` line 63 marks it `[x]` and its traceability row (line 143) reads `Complete`. No orphaned requirement IDs found for Phase 44 (only `PROOF-04` maps to it, matches PLAN frontmatter across all three plans). |

### Anti-Patterns Found

None. Scanned all evidence files under the phase directory for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and common "not yet implemented" phrasing — zero matches.

### Behavioral Spot-Checks / Live Reproduction (run by this verifier, not taken from SUMMARY claims)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Independence test | `node --test evidence/proof04-independence.test.ts` | 7/7 pass, incl. both planted-violation directions | ✓ PASS |
| Reconcile self-check | `node evidence/proof04-reconcile.mjs --self-check` | `SELFCHECK_RESULT pass`, all 4 cases pass | ✓ PASS |
| Record consistency gate (real record) | `node evidence/proof04-verify-record.mjs` | `RECORDGATE_RESULT pass`, 7/7 named assertions pass | ✓ PASS |
| Record consistency gate (planted violation) | same, `--record` pointed at a scratch copy with `PROOF04_DENOMINATOR` altered | Exit 1; exactly `RUN_AGREEMENT`/`BUCKET_IDENTITY`/`PERCENTAGE_SHAPE` fail | ✓ PASS (confirms non-vacuity independently) |
| Doc guards | `node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts` (from `src/mcp/vice`) | 50/50 pass | ✓ PASS |
| Scope containment | `git diff --name-only c62c261b~1..2d9f89b3 -- . ':!.planning/'` | 0 files | ✓ PASS |
| Automated-subset suite floor | `npm run test:automated` (broker confirmed `inactive` first) | `tests 4051 pass 4034 fail 4` at verification time | ⚠️ NOTE — see below |
| SCHEMA.md commit precedes measurement | `git log --diff-filter=A` on `SCHEMA.md` vs. the two run transcripts | `c62c261b` (17:13:09) precedes `00450ac3`/`dd1517e8` (17:28+) | ✓ PASS |
| Phase 38 restated figures | `grep` the three literal strings in `proof01-dxa-real-release.md` | All three found verbatim | ✓ PASS |

**Note on the suite floor:** at the time of this verification the automated-subset suite showed `fail=4`, one more than the `fail=3` the phase's own record captured at execution time. The fourth failure (`audit-root-args.test.ts:982`) is exactly the intermittent `zz-scratch` ENOENT race the project's own standing documentation (and this verifier's briefing) names as a known flake, not a regression, and is unrelated to any file this phase touched (confirmed: phase 44 changed zero files outside `.planning/`). Not counted as a gap.

### Human Verification Required

1 item carried forward from the plan's own end-of-phase-deferred human-check (see frontmatter `human_verification`). This verifier's own reading of `evidence/proof04-false-positives.md` found all three prose judgments (beside-not-replacing, no clean-bill-of-health, limits as their own section) to hold, but per this project's `workflow.human_verify_mode=end-of-phase` policy this is formally a human sign-off item, not something this verifier can close unilaterally.

### Gaps Summary

None found at the must-have level. Every roadmap success criterion is backed by evidence this verifier independently reproduced (ran the tests and gates myself; read the producer scripts directly; cross-checked the restated Phase 38 figures against their real source) rather than accepted from SUMMARY.md narrative. The one open item is the single planner-deferred, judgment-tier human-check already flagged above, which is a standard end-of-phase sign-off under this project's own workflow policy rather than a defect this verifier is asserting.

---

*Verified: 2026-09-10*
*Verifier: Claude (gsd-verifier)*
