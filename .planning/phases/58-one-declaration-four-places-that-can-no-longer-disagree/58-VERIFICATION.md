---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
verified: 2026-09-17T21:00:00Z
status: passed
score: 5/5 roadmap success criteria verified
behavior_unverified: 0
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-01-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-01-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-02-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-02-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-03-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-03-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-REVIEW.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-SECURITY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-UAT.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-VALIDATION.md"
  - "README.md"
  - "docs/phase58-declaration-provenance.md"
  - "src/mcp/vice/package.json"
  - "src/mcp/vice/phase58-citation-ledger.test.ts"
  - "src/mcp/vice/prerequisites.json"
  - "src/mcp/vice/prerequisites.test.ts"
covered_digest: "v1:sha256:c7e22f5394d32f4da05b75bb206b03f9794aedb78ec45757c6335862aa1f449d"
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5 roadmap success criteria verified
  gaps_closed:
    - "SC5 — both wrong file:line citations (REQUIREMENTS.md:88→85/86, ci.yml:70-72→80-81) corrected by live re-derivation and independently re-confirmed against source; a mechanical citation-ledger guard (phase58-citation-ledger.test.ts, 10/10 passing) now enforces resolution, completeness, no-orphans and non-vacuity for all 25 citations inside npm run test:automated"
  gaps_remaining: []
  regressions: []
  rounds:
    - round: 1
      previous_status: gaps_found
      previous_score: 3/5 roadmap success criteria verified
      status: human_needed
      score: 4/5 roadmap success criteria verified
      note: >-
        Gap-closure plan 58-03 corrected both wrong citations and shipped the
        citation-ledger guard. One item (SC2's real-runner CI execution) was
        left routed to human verification because 58-03-PLAN.md explicitly
        forbade pushing to origin as part of that closure.
    - round: 2
      previous_status: human_needed
      previous_score: 4/5 roadmap success criteria verified
      status: passed
      score: 5/5 roadmap success criteria verified
      note: >-
        The phase 58 commits were pushed to origin/main (2026-09-17T20:21Z),
        CI run 35270271098 executed, and job decl-02-node18-proof completed
        green in 12s with the exact expected output line. Independently
        re-confirmed in this round via `gh run view --job ... --log`, not
        accepted from 58-UAT.md's narrative alone. This discharges the sole
        remaining behavior_unverified item; no other criterion regressed.
        This round's own covered_digest changed for a purely mechanical
        reason: verify:post's validate-phase step rewrote 58-VALIDATION.md
        after the prior report was written, so the file set and digest were
        recomputed against the current tree (58-UAT.md and 58-SECURITY.md,
        both newly created this round, are added to covered_files for the
        same reason).
advisory:
  - finding: "The citation-ledger audit function (phase58-citation-ledger.test.ts) has two code-review CRITICAL findings against its own robustness against future/adversarial ledger content: a symlink inside the repo root can defeat the path-containment check and let the audit read (and silently 'verify') a file outside the repository (CR-01); a citation resolving to a directory crashes the whole test run with an uncaught EISDIR instead of a graceful failure string (CR-02). Two WARNING findings also apply: an empty-string anchor trivially 'verifies' any cited range (WR-01), and an off-by-one in the end-of-file line count admits one phantom trailing line (WR-02)."
    category: other
    reason: >-
      Confirmed via 58-REVIEW.md (issues_found, 2 critical/2 warning/1 info) and independently
      re-checked in this round: no commit since 681b364f (the review commit) touches
      phase58-citation-ledger.test.ts or docs/phase58-declaration-provenance.md, so all four
      findings are unchanged and still unfixed. None of the four is triggered by content present
      in the committed ledger today — the review itself confirmed by direct inspection that "all
      25 body citations have exactly one matching, resolving ledger entry today, so the shipped
      document is currently self-consistent." Each requires a future ledger-JSON edit (a symlinked
      path, a directory citation, an empty anchor, or an EOF-adjacent line number) to trigger. None
      of the 58-03-PLAN.md must-haves required adversarial robustness against a symlinked or
      directory-valued citation path. This is real follow-on hardening work on the new guard, not
      a defect in today's provenance content, and does not bear on whether Phase 58's own success
      criteria are met.
    evidence_status: "confirmed by code review + independent re-read both rounds; not fixed as of the last commit touching either file (681b364f)"
  - finding: ".planning/REQUIREMENTS.md's Phase 58 traceability table still marks DECL-02 unchecked (`[ ]`) with status \"Gaps Found\" (lines 28, 117), even though SC2/DECL-02 is now verified green on a real CI runner in this round."
    category: other
    reason: >-
      This is a stale bookkeeping artifact, not a functional gap: no task in any of the three
      plans (or the UAT step that performed the push) included updating REQUIREMENTS.md's
      traceability table after a real-runner CI result became available, since 58-03-PLAN.md
      explicitly forbade the push itself. The underlying capability (DECL-02) is independently
      verified against the actual CI run in this report. Recorded so a future pass (e.g.
      /gsd-ship or the next phase.complete) corrects the checkbox and status column rather than
      leaving REQUIREMENTS.md understating what was actually achieved.
    evidence_status: "observed directly this round via grep of .planning/REQUIREMENTS.md lines 28 and 117; not present in the prior verification round because the underlying CI result did not yet exist"
human_verification: []
---

# Phase 58: One Declaration, Four Places That Can No Longer Disagree — Verification Report

**Phase Goal:** Every prerequisite described once — what it unblocks and the remedy per platform
— in plain JSON a Node too old to run the server can still parse, and present in the published
package.
**Verified:** 2026-09-17
**Status:** passed
**Re-verification:** Yes — second round, after human UAT closed the sole remaining
behavior-unverified item from the first re-verification round (which itself followed
gap-closure plan 58-03)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the authoritative contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — One committed declaration names every prerequisite in the closed set (x64sc, c1541, petcat, ACME binary, ACME lib, Ghidra, dxa, Node), each with id/unblocks/remedies-per-platform (DECL-01) | ✓ VERIFIED | `src/mcp/vice/prerequisites.json` contains exactly these eight keys; `prerequisites.test.ts` re-run live this round (30/30 pass, combined with the ledger suite) asserts id-equals-key, closed unblocks vocabularies, platform-key closure, and remedy field completeness. Unchanged since the last round; regression-checked only. |
| 2 | SC2 — Plain JSON, no new runtime dependency, proven to parse under the oldest Node the doctor must start on via a dedicated CI job (DECL-02) | ✓ VERIFIED | **Discharged this round.** Independently confirmed via `gh run view 35270271098 --job 105367530978` and `gh run view --job 105367530978 --log`: job `decl-02-node18-proof` ran on `ubuntu-latest`, `actions/setup-node@v4` logged `Acquiring 18.20.8 - x64` then `node: v18.20.8` (a real interpreter genuinely acquired, not merely declared), the run step emitted the exact expected line `prerequisites.json parsed on Node 18 -- 8 tool record(s)`, and the job concluded **success** in 12s. Sibling `build` job on the same run also passed (2m37s). This is a live re-check against the actual GitHub API/CLI output, not acceptance of 58-UAT.md's narrative. |
| 3 | SC3 — Node is the only record carrying a version floor, non-vacuously tested (DECL-04) | ✓ VERIFIED | Re-run live: `tools.node.versionFloor` (`>=24.0.0`) is the only `versionFloor` key across all 8 records; `prerequisites.test.ts` passes, including the planted-violation case. Unchanged since the last round. |
| 4 | SC4 — Declaration ships in the published tarball, proven via the tarball's own file list (DECL-05) | ✓ VERIFIED | `prerequisites.json` still present in `package.json`'s `files[]` (line 68, re-read live); packaging subtest re-run live, passes, reads the packed tarball list rather than `existsSync`. Unchanged since the last round. |
| 5 | SC5 — No remedy text is invented at authoring time; every disagreement between two sources is recorded with which one was chosen and why, and every citation names an artifact that actually says what is claimed | ✓ VERIFIED | Both previously-wrong citations remain corrected (re-read live this round); `phase58-citation-ledger.test.ts` re-run live (10/10 pass), enforcing resolution/completeness/no-orphans/non-vacuity over all 25 body citations, and runs inside `npm run test:automated` (still absent from `test-gate.mjs`'s `MANUAL_ONLY_TESTS`). No commit since the review (681b364f) touched either the ledger doc or the guard, so this criterion's status is unchanged and re-confirmed, not re-derived from scratch. |

**Score:** 5/5 roadmap success criteria verified (0 present-but-behavior-unverified)

### What changed this round

Two things, both confirmed directly against evidence rather than accepted from narrative:

1. **SC2 discharged.** The prior report's sole open item — "the job has never executed on a real
   runner" — required a push to `origin/main`, which 58-03-PLAN.md explicitly forbade as part of
   that closure. The push has since happened as a human-verification action (recorded in
   `58-UAT.md`), and the job ran and passed. This verifier independently queried GitHub via `gh`
   rather than trusting the UAT record: `gh run list --branch main` confirms run `35270271098` on
   commit `589e56e0` succeeded in 2m42s, and `gh run view --job 105367530978 --log` shows the exact
   expected `node: v18.20.8` and `prerequisites.json parsed on Node 18 -- 8 tool record(s)` lines,
   with the job itself concluding success. This satisfies the must-have's evidentiary bar: a
   dedicated CI job run on a real GitHub Actions runner, not merely correct YAML shape or a local
   Node 18 parse.

2. **Mechanical restaleness of `covered_digest`, not a semantic regression.** The prior report's
   `covered_files` included `58-VALIDATION.md`; the `validate-phase` step of `verify:post` rewrote
   that file afterward (binding placeholder task IDs, correcting a stale reference, setting
   `status: validated` / `nyquist_compliant: true`), invalidating the old digest with no change to
   any of the phase's actual deliverables. This round's `covered_files` list adds `58-UAT.md` and
   `58-SECURITY.md` (both newly created since the last report) and recomputes the digest honestly
   against the current tree via `verification.fingerprint`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DECL-01 | 58-01, 58-02, 58-03 | One declaration names every prerequisite, with unblocks + remedies + provenance reasoning | ✓ SATISFIED | JSON structure and full test suite sound; the provenance doc's citation ledger is complete and mechanically guarded. `.planning/REQUIREMENTS.md` marks `DECL-01` `[x]` / "Complete" — matches. |
| DECL-02 | 58-01, 58-03 | Plain JSON, parses under the oldest Node floor, proven by CI | ✓ SATISFIED | Independently re-confirmed via `gh` against the real GitHub Actions run this round (see above). **Note:** `.planning/REQUIREMENTS.md` still marks `DECL-02` `[ ]` / "Gaps Found" (lines 28, 117) — this is stale bookkeeping, not a functional gap; see advisory item below. Nothing in this phase's own plans included a task to update that table after a post-closure human push, since the push itself was explicitly deferred out of plan scope. |
| DECL-04 | 58-01 | Node is the only version-floor record, non-vacuously guarded | ✓ SATISFIED | Re-confirmed live this round; `.planning/REQUIREMENTS.md` marks `[x]` / "Complete" — matches. |
| DECL-05 | 58-01 | Declaration ships in the published tarball | ✓ SATISFIED | Re-confirmed live this round; `.planning/REQUIREMENTS.md` marks `[x]` / "Complete" — matches. |

No orphaned requirements: REQUIREMENTS.md's Phase 58 traceability row lists exactly these four IDs, matching all three plans' `requirements:` frontmatter.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/prerequisites.json` | Eight-record declaration | ✓ VERIFIED | Unchanged this round; re-confirmed live |
| `src/mcp/vice/prerequisites.test.ts` | Structural gate | ✓ VERIFIED | Re-run live alongside the ledger suite, all pass |
| `src/mcp/vice/package.json` | `files[]` includes `prerequisites.json` | ✓ VERIFIED | Confirmed at line 68 |
| `.github/workflows/ci.yml` | `decl-02-node18-proof` job present, now proven to execute green | ✓ VERIFIED | Job present at lines 277-296 (unchanged shape); **executed and green on a real runner** this round (run 35270271098, job 105367530978) |
| `docs/phase58-declaration-provenance.md` | Corrected citations + total citation ledger + Case six | ✓ VERIFIED | Unchanged since last round; both prior wrong citations remain corrected; ledger section present (25 entries); Case six section present |
| `src/mcp/vice/phase58-citation-ledger.test.ts` | Structural guard over the provenance doc's citations | ✓ VERIFIED | Re-run live, all 10 pass, discovered by the automated gate. Unfixed known robustness gaps (CR-01/CR-02/WR-01/WR-02) carried forward as advisory. |
| `.planning/REQUIREMENTS.md` | `DECL-F3` recorded, Phase 58 traceability accurate | ⚠️ STALE (advisory) | `DECL-F3` present and correct; DECL-02's checkbox/status column has not been updated to reflect this round's CI result — see advisory |
| `58-UAT.md` | Human verification of SC2 recorded | ✓ VERIFIED (new this round) | `status: complete`, 1/1 passed, evidence block matches this verifier's own independent `gh` check byte-for-byte on the job id, run id, and output line |
| `58-VALIDATION.md` | Nyquist validation strategy | ✓ VERIFIED (updated this round) | `status: validated`, `nyquist_compliant: true`; task IDs bound to the three executed plans |
| `58-SECURITY.md` | Threat register verification | ✓ VERIFIED (new this round) | `threats_open: 0`, 13/13 threats closed or accepted with rationale; re-spot-checked T-58-02's argv-array/no-existsSync shape and T-58-09's exactly-two-keys rejection live |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `decl-02-node18-proof` CI job | A real GitHub Actions runner execution | push to origin, `gh run view` | ✓ WIRED | Independently confirmed this round — not present in the prior round |
| Provenance doc citations | The files/lines they claim to quote | `file:line` pointers, live-re-derived | ✓ WIRED | All 25 citations resolve; unchanged since last round |
| `phase58-citation-ledger.test.ts` | `test-gate.mjs`'s `automatedTestFiles()` | Directory-scan discovery, no list edit | ✓ WIRED | Confirmed via source read; file absent from `MANUAL_ONLY_TESTS` |
| `.planning/REQUIREMENTS.md` `DECL-F3` | `docs/phase58-declaration-provenance.md` "Case six" | Two halves of one deferral record | ✓ WIRED | Both sides present and cross-consistent |
| `tools.node.versionFloor` | `package.json`'s `engines.node` | Byte-equality test | ✓ WIRED | Re-confirmed live, unchanged |
| `package.json` `files[]` | Packed tarball's own file list | `npm pack --dry-run --json` | ✓ WIRED | Re-confirmed live, unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Citation-ledger + prerequisites suites pass together | `node --test --test-reporter=tap prerequisites.test.ts phase58-citation-ledger.test.ts` | `# pass 30`, `# fail 0` | ✓ PASS |
| Real-runner CI execution of `decl-02-node18-proof` | `gh run view 35270271098 --job 105367530978` | job `success`, 12s, expected output line present | ✓ PASS (this round's key new evidence) |
| Job log contains the exact expected proof line | `gh run view --job 105367530978 --log \| grep ...` | `prerequisites.json parsed on Node 18 -- 8 tool record(s)` | ✓ PASS |
| Sibling `build` job on the same run also green | `gh run list --branch main --limit 5` | run `35270271098` status `success`, 2m42s | ✓ PASS |
| REQUIREMENTS.md citation resolves | `sed -n '86p' .planning/REQUIREMENTS.md` | Contains "No shipped tool refuses on one." | ✓ PASS |
| ci.yml citation resolves | `awk 'NR==80||NR==81'` | Contains the banner tee/grep lines | ✓ PASS |
| package.json / README unchanged (regression) | `grep -n prerequisites.json src/mcp/vice/package.json`, `grep -n declaration README.md` | line 68 present; declaration referenced at line 125 | ✓ PASS |

### Anti-Patterns Found

None of TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in the three new/updated files covered this
round (`58-UAT.md`, `58-VALIDATION.md`, `58-SECURITY.md`), scanned live. No debt-marker gate
triggered.

### Code Review Findings (58-REVIEW.md) — Assessed for Goal Relevance

Unchanged since the last round. `58-REVIEW.md`'s five findings (2 critical, 2 warning, 1 info)
target only the new audit function's handling of hypothetical *future* adversarial ledger content
— none is triggered by anything in the committed ledger today, confirmed again this round by the
absence of any commit touching either file since the review. Carried forward as advisory, not a
gap.

### Human Verification Required

None. The sole item from the prior round — pushing to origin and confirming the CI job runs
green — has been completed and independently re-verified in this round via direct GitHub API/CLI
inspection, not accepted from `58-UAT.md`'s narrative alone.

### Gaps Summary

No gaps remain. Both substantive issues raised across the two prior verification rounds are now
resolved:

- The citation-drift gap (prior `gaps_found` round) was closed by plan 58-03 and independently
  re-confirmed in the first re-verification round.
- The sole remaining `behavior_unverified` item (SC2's real-CI-runner execution) is now
  discharged: the branch was pushed, CI run `35270271098` executed, and job
  `decl-02-node18-proof` completed green with the exact expected output, all independently
  re-checked against GitHub in this session via `gh`, not taken from `58-UAT.md` on trust.

Two items remain as advisory (non-blocking) rather than gaps: the four unfixed code-review
findings against the new citation-ledger guard's handling of hypothetical future adversarial
content (real follow-on hardening, not a defect in today's shipped content), and a stale
`DECL-02` checkbox/status cell in `.planning/REQUIREMENTS.md` that has not yet been updated to
reflect this round's CI result (a bookkeeping lag, not a functional gap — the underlying
capability is independently verified above). Neither affects the phase goal, which is achieved:
every prerequisite is described once, in plain JSON a Node 18 interpreter can parse (now proven on
a real runner), and the declaration ships in the published tarball.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
