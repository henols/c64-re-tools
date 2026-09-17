---
phase: 53-operator-owned-docs
plan: 04
subsystem: infra
tags: [docs, git-mv, roadmap, evidence-tree, phase50-guards]

requires:
  - phase: 53-operator-owned-docs (plans 01-03)
    provides: "Zero remaining `docs/phase` citations in src/ and scripts/ — the precondition this plan re-verified before moving anything"
provides:
  - "27 evidence documents relocated from docs/ into their phase directories' evidence/ convention, with git history intact"
  - "The two functional (non-comment) readers of the old docs/ location repointed to the phase-50 evidence directory in the same commit as the move"
  - "The orphan-destination decision (three pre-roadmap documents) recorded in ROADMAP.md with its evidence"
  - "DOCS-04 recorded as SUPERSEDED with no successor guard, CI check, lint rule, or note added"
affects: [operator-owned-docs, phase-51-guard-widening, phase-50-guard-tests]

actuals:
  tokens: 5444
  tasks: 2
  commits: 2
plan_head_before: 632c852579e6aca4b38c9e57a42f1e18d6afde0d

tech-stack:
  added: []
  patterns: ["git mv for evidence relocation (never copy+delete) to preserve provenance history"]

key-files:
  created:
    - .planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md
    - .planning/phases/01-corrected-ground-truth/evidence/phase1-probe-results.md
    - .planning/phases/02-stock-backend-connection/evidence/phase2-backend-probe-evidence.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/phase50-ci-boundary.md
  modified:
    - src/mcp/vice/phase50-findings-contract.test.ts
    - src/mcp/vice/phase50-transcript-freshness.test.ts
    - .planning/ROADMAP.md

key-decisions:
  - "The three pre-roadmap orphan documents (phase0, phase1, phase2) were placed by the evidence of which plan authored them, not by the number in their filename: phase0/phase1 per phase 01-04's own files_modified frontmatter, phase2 per its own opening paragraph naming phase 02's context document"
  - "DOCS-04 (the permanent recurrence guard) closes as SUPERSEDED, not met — no guard, CI check, lint rule, note, seed, or todo was added, per the 2026-09-17 withdrawal already recorded in ROADMAP criterion 6"
  - "Four 2026-09-13 roadmap notes marked OBSOLETE rather than deleted, each with its measurement date, since RESEARCH.md re-measured them all as no longer describing reality"

patterns-established:
  - "Evidence documents move with git mv, never cp+rm, to keep the commit chain that makes a document evidence of a measured run"

requirements-completed: [DOCS-01, DOCS-02, DOCS-03, DOCS-04]

coverage:
  - id: D1
    description: "27 evidence documents relocated from docs/ into .planning/phases/*/evidence/ via git mv, with docs/ left holding only operator-authored documents and no new subfolder"
    requirement: "DOCS-01"
    verification:
      - kind: unit
        ref: "shell: ls docs/ | grep -c '^phase' -> 0; find docs -mindepth 1 -type d -> 0; find .planning/phases -path '*/evidence/phase*.md' -type f -> 27"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three pre-roadmap orphan documents' destinations decided by direct evidence and recorded in ROADMAP.md"
    requirement: "DOCS-02"
    verification:
      - kind: unit
        ref: "shell: awk Phase-53-section grep -c for phase0-binmon-findings.md, phase1-probe-results.md, phase2-backend-probe-evidence.md -> each >=1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both phase-50 guard tests repointed to the new evidence directory in the same commit as the move, and both pass"
    requirement: "DOCS-03"
    verification:
      - kind: unit
        ref: "node --test src/mcp/vice/phase50-findings-contract.test.ts src/mcp/vice/phase50-transcript-freshness.test.ts -> 19/19 pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "DOCS-04 recorded as SUPERSEDED in ROADMAP.md with no guard, CI check, lint rule, or successor note built"
    requirement: "DOCS-04"
    verification:
      - kind: unit
        ref: "shell: awk Phase-53-section grep -c SUPERSEDED -> 1; diff numstat additions(48) > deletions(35)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-17
status: complete
---

# Phase 53 Plan 04: Relocate 27 Evidence Documents, Repoint Guards, Record Decisions Summary

**Moved all 27 `docs/phase*.md` evidence documents into their phase directories' `evidence/` convention with `git mv`, repointed the two phase-50 guard tests that actually read them in the same commit, and recorded the orphan-destination decision plus DOCS-04's superseded disposition in ROADMAP.md.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-17T12:08:00Z (approx.)
- **Completed:** 2026-09-17T12:07:55Z (231c1cda commit timestamp, local +02:00)
- **Tasks:** 2/2 completed
- **Files modified:** 30 (27 relocated documents + 2 repointed test files + ROADMAP.md)

## Accomplishments

- All 27 `docs/phase*.md` documents moved via `git mv` into `.planning/phases/NN-*/evidence/`, preserving commit history (verified with `git log --follow` — see below).
- Created the six missing `evidence/` directories (phases 01, 02, 40, 41, 42, 45).
- `docs/` now holds only operator-authored documents: `dissambler-workflow.md`, `roadmap-stock-vice.md`, `stock-hard-losses.md`, `stock-vice-parity.md`, `undocumented-opcodes-ghidra.md`, `vice-mcp-ideas.md`. No `phase*`-named file and no subfolder remain.
- Both functional (non-comment) readers of the old location — `phase50-findings-contract.test.ts` and `phase50-transcript-freshness.test.ts` — repointed their `DOCS_DIR` constant to `.planning/phases/50-equivalence-and-modifiability/evidence/` in the SAME commit as the move, plus fixed the surrounding prose (a comment naming sibling documents, a parameter doc-comment, and two test titles) that described the old location.
- The three pre-roadmap orphan documents' destinations were re-verified against RESEARCH.md's evidence (phase 01-04's `files_modified` frontmatter for the first two, phase2's own opening paragraph for the third) before moving, then recorded in ROADMAP.md.
- ROADMAP.md's Phase 53 section updated: orphan-destination decision recorded with evidence, four 2026-09-13 notes marked OBSOLETE (with measurement dates) rather than deleted, and DOCS-04 confirmed as SUPERSEDED with no successor guard proposed.

## Task Commits

1. **Task 1: Create the six missing evidence directories, `git mv` all 27 documents, and repoint both guard tests in the same commit** - `ccdc58da` (feat)
2. **Task 2: Record the orphan-destination decision and DOCS-04's superseded disposition in the roadmap** - `231c1cda` (docs)

_Both commits landed directly on `main` per this plan's explicit sequential/no-worktree instruction (USE_WORKTREES_FOR_PLAN: false)._

## Source-to-Destination Table (all 27 documents)

| # | Source (`docs/`) | Destination |
|---|---|---|
| 1 | `phase0-binmon-findings.md` | `.planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md` |
| 2 | `phase1-probe-results.md` | `.planning/phases/01-corrected-ground-truth/evidence/phase1-probe-results.md` |
| 3 | `phase2-backend-probe-evidence.md` | `.planning/phases/02-stock-backend-connection/evidence/phase2-backend-probe-evidence.md` |
| 4 | `phase23-real-release-gate-findings.md` | `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/phase23-real-release-gate-findings.md` |
| 5 | `phase33-reproducible-run-gate-findings.md` | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/phase33-reproducible-run-gate-findings.md` |
| 6 | `phase34-host-tool-seam-decisions.md` | `.planning/phases/34-the-host-tool-execution-seam/evidence/phase34-host-tool-seam-decisions.md` |
| 7 | `phase36-sleigh-language-and-harness-findings.md` | `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/phase36-sleigh-language-and-harness-findings.md` |
| 8 | `phase39-dual-channel-coexistence-gate-findings.md` | `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/phase39-dual-channel-coexistence-gate-findings.md` |
| 9 | `phase40-preprocessing-tools-decisions.md` | `.planning/phases/40-the-three-preprocessing-host-tools/evidence/phase40-preprocessing-tools-decisions.md` |
| 10 | `phase41-text-channel-live-evidence.md` | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md` |
| 11 | `phase42-text-format-drift-citations.md` | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/evidence/phase42-text-format-drift-citations.md` |
| 12 | `phase43-instrumentation-perturbation-ab.md` | `.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-instrumentation-perturbation-ab.md` |
| 13 | `phase43-runtime-evidence-layer.md` | `.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-runtime-evidence-layer.md` |
| 14 | `phase45-closure-dxa-family.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-closure-dxa-family.md` |
| 15 | `phase45-closure-gate.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-closure-gate.md` |
| 16 | `phase45-closure-ghidra-family.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-closure-ghidra-family.md` |
| 17 | `phase45-derivation-execution-evidence.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-derivation-execution-evidence.md` |
| 18 | `phase45-ghidra-derivation-evidence.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-ghidra-derivation-evidence.md` |
| 19 | `phase45-planted-control-evidence.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-planted-control-evidence.md` |
| 20 | `phase45-wave0-measurements.md` | `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-wave0-measurements.md` |
| 21 | `phase49-the-reassembly-gate-findings.md` | `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/phase49-the-reassembly-gate-findings.md` |
| 22 | `phase50-ci-boundary.md` | `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-ci-boundary.md` |
| 23 | `phase50-equivalence-transcript.md` | `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-equivalence-transcript.md` |
| 24 | `phase50-exported-edit-findings.md` | `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-exported-edit-findings.md` |
| 25 | `phase50-exported-modifiability-transcript.md` | `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-exported-modifiability-transcript.md` |
| 26 | `phase50-modifiability-findings.md` | `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-modifiability-findings.md` |
| 27 | `phase50-modifiability-transcript.md` | `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-modifiability-transcript.md` |

All 27 moves registered as 100%-similarity renames in `git show --stat ccdc58da`.

## `git log --follow` Proof of History Survival

**Phase 01 document (oldest group — history reaches back to the very first commit that added it, 2026-08-11):**
```
ccdc58da feat(53-04): relocate 27 evidence documents into their phase evidence/ dirs
29aec398 docs(16-05): sweep README and docs/ path pointers to relocated src/ trees
e65cc69f fix(07): WR-08 correct the normative CPUHISTORY_GET layout in phase0-binmon-findings
f22bd530 docs(07-04): mark frame-counter stopwatch fallback SUPERSEDED in phase0-binmon-findings.md sec1
28af91cc docs(01-04): close probe-outstanding references and sign off 01-VALIDATION.md
2005fcec docs(01-01): correct section 4 of phase0-binmon-findings.md
e9d7caef docs(01-01): correct section 1 of phase0-binmon-findings.md
68b0a799 Add Phase 0 binary-monitor de-risk findings and probe to main
```
(`.planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md`, 8 commits)

**Phase 50 document (newest group):**
```
ccdc58da feat(53-04): relocate 27 evidence documents into their phase evidence/ dirs
9bbf53a8 docs(50): close three requirements, record the EQUIV-04 decline, queue 50-08
cfb6f5fc docs(50-07): a broken step, observed going red and reverted
1a91061a docs(50-07): state the CI boundary rather than blurring it
```
(`.planning/phases/50-equivalence-and-modifiability/evidence/phase50-ci-boundary.md`, 4 commits)

## Guard-Test Path Constant Before/After

**`src/mcp/vice/phase50-findings-contract.test.ts`:**
```ts
// BEFORE
const DOCS_DIR = join(REPO_ROOT, "docs");

// AFTER
/** These findings documents are committed evidence artifacts of phase 50, so
 * they live under that phase's own `evidence/` directory rather than the
 * repository's operator-owned `docs/` -- moved there in phase 53. Renaming
 * or archiving this phase directory will break this guard; it reads a
 * committed artifact by path the same way `anno-derivation.test.ts` and
 * `host-scripts.test.ts` already do. */
const DOCS_DIR = join(REPO_ROOT, ".planning/phases/50-equivalence-and-modifiability/evidence");
```
Also renamed the test titled `"the committed docs/ directory really does hold exactly the expected phase-50 findings documents"` to `"the committed phase-50 evidence directory really does hold exactly the expected phase-50 findings documents"`.

**`src/mcp/vice/phase50-transcript-freshness.test.ts`:**
```ts
// BEFORE
const DOCS_DIR = join(REPO_ROOT, "docs");

// AFTER
/** These transcripts are committed evidence artifacts of phase 50, so they
 * live under that phase's own `evidence/` directory rather than the
 * repository's operator-owned `docs/` -- moved there in phase 53. Renaming
 * or archiving this phase directory will break this guard; it reads a
 * committed artifact by path the same way `anno-derivation.test.ts` and
 * `host-scripts.test.ts` already do. */
const DOCS_DIR = join(REPO_ROOT, ".planning/phases/50-equivalence-and-modifiability/evidence");
```
Also fixed the header-comment prose naming what "`docs/` also holds", the `docsDir` parameter doc-comment describing the discovery directory, and renamed the test titled `"the committed docs/ directory really does hold at least two phase-50 transcripts"` to `"the committed phase-50 evidence directory really does hold at least two phase-50 transcripts"`. All temporary-directory fixtures inside both files (`mkdtempSync`-based scratch trees used by the negative-case tests) were left untouched, as instructed.

## Test Results

**Guard tests, run directly (both before and after the commit):**
```
node --test phase50-findings-contract.test.ts phase50-transcript-freshness.test.ts
tests 19
pass 19
fail 0
```

**Typecheck:** `npm run typecheck` — clean, no errors.

**`npm run test:automated` (post-commit, no broker/emulator running):**
```
tests 3701
pass 3692
fail 0
skipped 9
```
Fully green.

**Full `npm test` (pre-commit, includes MANUAL_ONLY live-emulator tests):** 3858 tests, 3776 pass, 1 fail, 81 skipped. The one failure — `broker-e2e.test.ts`'s "wired disconnect-while-queued" test — is a pre-existing timing-sensitive e2e flake spawning real `x64sc` instances; it is unrelated to this plan's changes (no broker/emulator code touched) and passed cleanly when re-run in isolation (`node --test broker-e2e.test.ts` → 12/12 pass). Logged as out of scope per the deviation-rules scope boundary, not fixed.

## Files Created/Modified

- 27 evidence documents relocated (see table above) — `git mv`, no content changes.
- `src/mcp/vice/phase50-findings-contract.test.ts` - repointed `DOCS_DIR`, renamed one test title.
- `src/mcp/vice/phase50-transcript-freshness.test.ts` - repointed `DOCS_DIR`, fixed three prose mentions, renamed one test title.
- `.planning/ROADMAP.md` - recorded orphan-destination decision, marked four notes obsolete, confirmed DOCS-04 SUPERSEDED.

## Decisions Made

- The three pre-roadmap orphan documents were placed by the evidence of which plan authored them (RESEARCH.md Q1), re-verified live before moving: phase 01-04's own `files_modified` frontmatter for `phase0`/`phase1`, and `phase2`'s own opening paragraph naming phase 02's context document.
- DOCS-04 closes as SUPERSEDED, not met — no guard, CI check, lint rule, note, seed, or todo was built, per the standing 2026-09-17 withdrawal already in ROADMAP criterion 6.
- Four stale 2026-09-13 roadmap notes marked OBSOLETE with their measurement date rather than deleted, preserving the historical record for a reader who meets them later.

## Deviations from Plan

None — plan executed exactly as written. The pre-existing `broker-e2e.test.ts` flake noted above is a scope-boundary observation (out-of-scope, pre-existing, unrelated to this plan's changes), not a deviation from this plan's own actions.

## Issues Encountered

None affecting this plan's deliverables. The one pre-existing test flake is documented above under Test Results and is out of this plan's scope per the deviation-rules scope boundary (only auto-fix issues directly caused by the current task's changes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/` is now operator-owned; the 27 evidence documents live in the phase artifact tree with their history intact.
- Phase 51's guard-widening work can proceed on a clean pattern (no `docs/phase*` occurrences remain to inherit into a widened guard).
- The recurrence risk (nothing mechanical stops a future plan writing evidence to `docs/` again) is accepted and recorded, not mitigated — this is an explicit, owner-made decision, not an oversight.

## Self-Check: PASSED

All 7 listed created/modified files confirmed present on disk; both commit hashes (`ccdc58da`, `231c1cda`) confirmed present in `git log --oneline --all`.

---
*Phase: 53-operator-owned-docs*
*Completed: 2026-09-17*
