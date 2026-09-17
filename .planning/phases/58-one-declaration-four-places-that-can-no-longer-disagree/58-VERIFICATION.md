---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
verified: 2026-09-17T00:00:00Z
status: human_needed
score: 4/5 roadmap success criteria verified
behavior_unverified: 1
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
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-VALIDATION.md"
  - "README.md"
  - "docs/phase58-declaration-provenance.md"
  - "src/mcp/vice/package.json"
  - "src/mcp/vice/phase58-citation-ledger.test.ts"
  - "src/mcp/vice/prerequisites.json"
  - "src/mcp/vice/prerequisites.test.ts"
covered_digest: "v1:sha256:1fbe8fe34d71a309456c05292f0c515dc2a441c09431922d3f9c2890401627e2"
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5 roadmap success criteria verified
  gaps_closed:
    - "SC5 — both wrong file:line citations (REQUIREMENTS.md:88→85/86, ci.yml:70-72→80-81) corrected by live re-derivation and independently re-confirmed against source in this run; a mechanical citation-ledger guard (phase58-citation-ledger.test.ts, 10/10 passing) now enforces resolution, completeness, no-orphans and non-vacuity for all 25 citations inside npm run test:automated"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "The new citation-ledger audit function (phase58-citation-ledger.test.ts) has two code-review CRITICAL findings against its own robustness against future/adversarial ledger content: a symlink inside the repo root can defeat the path-containment check and let the audit read (and silently 'verify') a file outside the repository (CR-01); a citation resolving to a directory crashes the whole test run with an uncaught EISDIR instead of a graceful failure string (CR-02). Two WARNING findings also apply: an empty-string anchor trivially 'verifies' any cited range (WR-01), and an off-by-one in the end-of-file line count admits one phantom trailing line (WR-02)."
    category: other
    reason: >-
      Confirmed via 58-REVIEW.md (issues_found, 2 critical/2 warning/1 info) and independently
      re-read against the cited line ranges in this run. None of the four is triggered by content
      present in the committed ledger today — the review itself confirmed by direct inspection
      that "all 25 body citations have exactly one matching, resolving ledger entry today, so the
      shipped document is currently self-consistent." Each requires a future ledger-JSON edit
      (a symlinked path, a directory citation, an empty anchor, or an EOF-adjacent line number) to
      trigger. None of the 58-03-PLAN.md must-haves required adversarial robustness against a
      symlinked or directory-valued citation path — the stated must-have ("a ledger citation whose
      path resolves outside the repository root is reported ... ") is tested and passes for the
      literal `..`-escape case the must-have's own T-58-06 probe describes. This is real follow-on
      hardening work on the new guard, not a defect in today's provenance content, and does not
      bear on whether Phase 58's own success criteria are met.
    evidence_status: "confirmed by code review + independent re-read; not fixed as of the last commit (681b364f)"
behavior_unverified_items:
  - truth: "SC2 — the declaration is proven to parse under the oldest Node the doctor must start on, by a dedicated CI job (decl-02-node18-proof) on a real GitHub Actions runner"
    test: "Push this branch's commits to origin (currently 21 commits ahead of origin/main, none pushed — re-confirmed live this run) and open the Actions run for the push; confirm the decl-02-node18-proof job appears and completes green."
    expected: "The job resolves Node 18 via actions/setup-node@v4 with no package-manager install, and its run step reports 'prerequisites.json parsed on Node 18 -- 8 tool record(s)' with exit 0."
    why_human: "This is a real-runner execution outcome, not something a local process can observe. 58-03-PLAN.md explicitly forbids any task in this closure from pushing to origin ('No task may push to origin. The unpushed decl-02-node18-proof runner execution is carried as human verification, not closed by this plan.') and confirms no push was made. A local Node 18 binary parsing the file and the YAML job shape being correct are necessary but not sufficient evidence that the runner itself executes the job green."
human_verification:
  - test: "Push the phase 58 commits to origin and confirm the new decl-02-node18-proof CI job runs and passes on a real GitHub Actions runner."
    expected: "Job completes with exit 0 and the console output contains 'prerequisites.json parsed on Node 18 -- 8 tool record(s)'."
    why_human: "No GitHub Actions runner is reachable from this verification session; this is the one piece of DECL-02's evidence chain that only a real push can produce. This is unchanged from the prior verification round — 58-03 deliberately did not touch it."
---

# Phase 58: One Declaration, Four Places That Can No Longer Disagree — Verification Report

**Phase Goal:** Every prerequisite described once — what it unblocks and the remedy per platform
— in plain JSON a Node too old to run the server can still parse, and present in the published
package.
**Verified:** 2026-09-17
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 58-03)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the authoritative contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — One committed declaration names every prerequisite in the closed set (x64sc, c1541, petcat, ACME binary, ACME lib, Ghidra, dxa, Node), each with id/unblocks/remedies-per-platform (DECL-01) | ✓ VERIFIED | `src/mcp/vice/prerequisites.json` contains exactly these eight keys; `prerequisites.test.ts` re-run live (20/20 pass) asserts id-equals-key, closed unblocks vocabularies, platform-key closure, and remedy field completeness. Unchanged by 58-03 (not in its `files_modified`); regression-checked only. |
| 2 | SC2 — Plain JSON, no new runtime dependency, proven to parse under the oldest Node the doctor must start on via a dedicated CI job (DECL-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `decl-02-node18-proof` job present and correctly shaped in `.github/workflows/ci.yml` (re-read live, lines 277-296). Branch is 21 commits ahead of `origin/main`, still nothing pushed (`git log --oneline HEAD ^origin/main`, re-run live). The job has never executed on a real runner. 58-03-PLAN.md explicitly prohibits this closure from pushing, and its SUMMARY confirms no push occurred. |
| 3 | SC3 — Node is the only record carrying a version floor, non-vacuously tested (DECL-04) | ✓ VERIFIED | Re-run live: `tools.node.versionFloor` (`>=24.0.0`) is the only `versionFloor` key across all 8 records (`Object.entries(doc.tools).filter(v=>v.versionFloor)` → `['node']`); `prerequisites.test.ts` 20/20 pass, including the planted-violation case. Unchanged by 58-03. |
| 4 | SC4 — Declaration ships in the published tarball, proven via the tarball's own file list (DECL-05) | ✓ VERIFIED | `prerequisites.json` still present in `package.json`'s `files[]` (line 68, re-read live); subtest 20 ("packaging (DECL-05)") re-run live, passes, reads the packed tarball list rather than `existsSync`. Unchanged by 58-03. |
| 5 | SC5 — No remedy text is invented at authoring time; every disagreement between two sources is recorded with which one was chosen and why, and every citation names an artifact that actually says what is claimed | ✓ VERIFIED | Both previously-wrong citations independently re-verified against live source in this run: `REQUIREMENTS.md:86` now contains "No shipped tool refuses on one." (the sentence quoted); `ci.yml:80-81` now contains the actual `tee .../acme-banner.txt` / `grep -qi acme` banner check (not the `retry_apt` failure branch it previously cited). A new `src/mcp/vice/phase58-citation-ledger.test.ts` mechanically enforces resolution/completeness/no-orphans/non-vacuity over all 25 body citations, re-run live (10/10 pass), and runs inside `npm run test:automated` (confirmed not present in `test-gate.mjs`'s `MANUAL_ONLY_TESTS`). |

**Score:** 4/5 roadmap success criteria verified (1 present-but-behavior-unverified)

### Gap Closure Detail (Plan 58-03)

All fourteen `must_haves.truths` from `58-03-PLAN.md` were checked against the live codebase, not just the SUMMARY's narrative:

| Must-have | Status | Evidence |
|---|---|---|
| REQUIREMENTS.md citation re-derived, not copied | ✓ VERIFIED | Live `sed`/`grep` confirms line 86 is the cited sentence today |
| ci.yml citation re-derived | ✓ VERIFIED | Live `awk` confirms lines 80-81 are the tee/grep banner step |
| Every citation has a ledger entry with a resolving anchor | ✓ VERIFIED | Independent regex count over the live document body finds 25 distinct citations; `phase58-citation-ledger.test.ts` subtest "the committed provenance document's citation ledger is complete and every anchor resolves" passes live |
| Shifted-anchor case reported (non-vacuity) | ✓ VERIFIED | Subtest present and passing; SUMMARY's captured before/after TAP output for the real historical defect (WR-01) and the DECL-F3 self-inflicted line shift both show the guard rejecting, then accepting, matching the plan's own evidence requirement |
| Body citation missing from ledger reported | ✓ VERIFIED | Subtest present, passing |
| Ledger entry missing from body reported (no-orphans) | ✓ VERIFIED | Subtest present, passing |
| Empty/absent/unparseable ledger fails non-vacuously | ✓ VERIFIED | Subtest present, passing |
| Inclusive range semantics, malformed range rejected | ✓ VERIFIED | Subtest present, passing |
| Raw substring anchor match, multi-byte case | ✓ VERIFIED | Subtest present, passing |
| Deterministic failure ordering | ✓ VERIFIED | Subtest present, passing |
| Path-escape (`..`) refused, file never read | ✓ VERIFIED (narrower than ideal — see advisory) | Subtest present, passing for the literal `..` case the must-have's T-58-06 describes; code review found the check does not additionally cover a symlink-mediated escape (CR-01), which the must-have text did not ask for |
| Guard runs inside `npm run test:automated` with no `test-gate.mjs` edit | ✓ VERIFIED | `automatedTestFiles()` discovers the file by directory scan; grep of `MANUAL_ONLY_TESTS` finds no reference to it |
| unp64's omission recorded as an owned deferral | ✓ VERIFIED | `.planning/REQUIREMENTS.md` now has `DECL-F3` under Future Requirements > Declaration (re-read live); `docs/phase58-declaration-provenance.md` has a new "Case six" section (lines 285-336) naming the reason, the requirement, and Phase 61 as downstream owner |
| Existing 20 `prerequisites.test.ts` cases still pass; no `prerequisites.json`/`package.json`/CI job altered | ✓ VERIFIED | Re-run live: 20/20 pass; `prerequisites.json`, `package.json` `files[]`, and `ci.yml`'s pre-existing jobs are outside 58-03's `files_modified` and confirmed unchanged |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DECL-01 | 58-01, 58-02, 58-03 | One declaration names every prerequisite, with unblocks + remedies + provenance reasoning | ✓ SATISFIED | JSON structure and 20-case suite sound (unchanged); the provenance doc's citation defects (the prior gap) are now corrected and mechanically guarded. `.planning/REQUIREMENTS.md` marks `DECL-01` `[x]` / "Complete" in the traceability table — matches. |
| DECL-02 | 58-01, 58-03 | Plain JSON, parses under the oldest Node floor, proven by CI | ⚠️ PARTIAL (human-verification pending) | Local Node 18 parse and CI job wiring verified live; real-runner green execution still unobserved (branch unpushed, 21 commits ahead). `.planning/REQUIREMENTS.md` correctly marks `DECL-02` `[ ]` / "Gaps Found" — the written record is honest about this, not overstated. |
| DECL-04 | 58-01 | Node is the only version-floor record, non-vacuously guarded | ✓ SATISFIED | Re-confirmed live this run; `.planning/REQUIREMENTS.md` marks `[x]` / "Complete" — matches. |
| DECL-05 | 58-01 | Declaration ships in the published tarball | ✓ SATISFIED | Re-confirmed live this run; `.planning/REQUIREMENTS.md` marks `[x]` / "Complete" — matches. |

No orphaned requirements: REQUIREMENTS.md's Phase 58 traceability row lists exactly these four IDs, matching all three plans' `requirements:` frontmatter (58-01 and 58-03 carry all four for honesty/traceability; 58-02 carries the two it actually advanced).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/prerequisites.json` | Eight-record declaration | ✓ VERIFIED | Unchanged this round; re-confirmed live |
| `src/mcp/vice/prerequisites.test.ts` | Structural gate, 20 cases | ✓ VERIFIED | Re-run live, 20/20 pass |
| `src/mcp/vice/package.json` | `files[]` includes `prerequisites.json` | ✓ VERIFIED | Confirmed at line 68 |
| `.github/workflows/ci.yml` | `decl-02-node18-proof` job present, untouched otherwise | ✓ VERIFIED | Re-read live; job present at lines 277-296; not modified by 58-03 |
| `docs/phase58-declaration-provenance.md` | Corrected citations + total citation ledger + Case six | ✓ VERIFIED | Both prior wrong citations corrected and independently re-checked; ledger section present (25 entries); Case six section present (lines 285-336) |
| `src/mcp/vice/phase58-citation-ledger.test.ts` | New structural guard over the provenance doc's citations | ✓ VERIFIED | 608 lines, 10 test cases, re-run live, all pass; discovered by the automated gate |
| `.planning/REQUIREMENTS.md` | `DECL-F3` recorded, Phase 58 traceability accurate | ✓ VERIFIED | `DECL-F3` present under Future Requirements; traceability table matches checkbox states exactly |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Provenance doc citations | The files/lines they claim to quote | `file:line` pointers, live-re-derived | ✓ WIRED | All 25 spot-checked citations resolve; the two previously-wrong ones independently re-confirmed corrected |
| `phase58-citation-ledger.test.ts` | `test-gate.mjs`'s `automatedTestFiles()` | Directory-scan discovery, no list edit | ✓ WIRED | Confirmed via source read of `test-gate.mjs`; file absent from `MANUAL_ONLY_TESTS` |
| `.planning/REQUIREMENTS.md` `DECL-F3` | `docs/phase58-declaration-provenance.md` "Case six" | Two halves of one deferral record | ✓ WIRED | Both sides present and cross-consistent (reason, requirement id, downstream phase 61) |
| `tools.node.versionFloor` | `package.json`'s `engines.node` | Byte-equality test | ✓ WIRED | Re-confirmed live, unchanged |
| `package.json` `files[]` | Packed tarball's own file list | `npm pack --dry-run --json` | ✓ WIRED | Re-confirmed live via subtest 20, unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Citation-ledger guard passes on live content | `node --test --test-reporter=tap phase58-citation-ledger.test.ts` | `# pass 10`, `# fail 0` | ✓ PASS |
| Prerequisites structural suite still passes | `node --test --test-reporter=tap prerequisites.test.ts` | `# pass 20`, `# fail 0` | ✓ PASS |
| REQUIREMENTS.md citation resolves | `sed -n '86p' .planning/REQUIREMENTS.md` | Contains "No shipped tool refuses on one." | ✓ PASS |
| ci.yml citation resolves | `awk 'NR==80||NR==81'` | Contains the banner tee/grep lines | ✓ PASS |
| Full automated suite (orchestrator-run, relied on per instructions) | `npm run test:automated` (run twice) | 3713 tests / 3704 pass / 0 fail / 9 skipped, identical both runs | ✓ PASS |
| Typecheck (orchestrator-run) | `npm run typecheck` | exit 0 | ✓ PASS |
| CI job real-runner execution | N/A — branch unpushed, no runner reachable | not run | ? SKIP (routed to human verification, unchanged from prior round) |

### Anti-Patterns Found

None of TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in the phase's modified files (`phase58-citation-ledger.test.ts`, `docs/phase58-declaration-provenance.md`, `.planning/REQUIREMENTS.md`), re-scanned live this round. No debt-marker gate triggered.

### Code Review Findings (58-REVIEW.md) — Assessed for Goal Relevance

The 58-REVIEW.md review (issues_found: 2 critical, 2 warning, 1 info) targets only the two files this closure changed. All five findings are against the new audit function's handling of hypothetical *future* ledger content (a symlinked path, a directory citation, an empty anchor, an EOF-adjacent line count) — none is triggered by anything in the committed ledger today, and the review independently confirmed by direct inspection that all 25 current citations resolve correctly. None of these findings falsifies a 58-03-PLAN.md must-have as literally stated. They are recorded as an `advisory` (not a gap) because they are genuine follow-on hardening work on a newly-introduced guard, not evidence that this phase's own success criteria remain unmet.

### Human Verification Required

1. **CI job real-runner execution** — push the phase 58 commits and confirm `decl-02-node18-proof` runs green on GitHub Actions. Expected: exit 0, output containing `prerequisites.json parsed on Node 18 -- 8 tool record(s)`. Why human: no runner reachable from this session; 58-03-PLAN.md explicitly forbids this closure from pushing, so the gap is structurally deferred to a human action, not a planning omission.

The prior round's second human-verification item (whether to add `unp64` as a ninth record or record an explicit deferral) is now resolved in writing — `DECL-F3` plus the provenance doc's "Case six" section constitute the deferral record the prior verification asked for. Judged independently against source, this is a complete written record (reason, owning requirement, named downstream phase), not merely a claim of one; it no longer needs a separate human decision to close the loop, though the owner may still choose to revisit the underlying scope call at any time.

### Gaps Summary

The one substantive gap from the prior verification round — two wrong `file:line` citations in `docs/phase58-declaration-provenance.md` — is closed. Both corrections were independently re-derived and re-checked against live source in this run, not accepted from the SUMMARY's narrative, and a new mechanical guard (`phase58-citation-ledger.test.ts`, 10/10 passing, wired into the automated gate) now prevents a future citation from drifting undetected the same way. DECL-01, DECL-04 and DECL-05 are fully satisfied. The one remaining item, DECL-02's real-GitHub-Actions-runner execution, is unchanged from the prior round: the branch is still unpushed (21 commits ahead of `origin/main`), and 58-03-PLAN.md's own prohibitions correctly forbid this closure from pushing to close it. This is genuine human verification, not a planning or execution gap — the phase's own written record (`.planning/REQUIREMENTS.md` marking `DECL-02` "Gaps Found" rather than "Complete") is honest about this rather than overclaiming. The code review's five findings against the new guard's edge-case robustness are real and worth fixing but are follow-on hardening, not evidence the phase goal is unmet — recorded as advisory.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
