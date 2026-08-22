---
phase: 16-packaging-and-repo-shape
plan: 02
subsystem: infra
tags: [security, threat-model, broker, control-plane, planning-record]

requires:
  - phase: 14-backend-decision
    provides: "FORK-01's Key Decisions row shape (dated decision, rationale, reversible outcome) used as the template for this row"
  - phase: 15-tech-debt-and-quality
    provides: "the docs-*.test.ts guard family and QUAL-03's original requirement wording this plan inherits as PKG-04"
provides:
  - "A dated PROJECT.md Key Decisions row recording the broker control-plane listener's 0.0.0.0 bind default as an accepted, reasoned, reversible risk"
  - "16-PKG04-EVIDENCE.md — every factual claim in that row traced to a file:line citation read this session or to captured live output"
  - "A named smart-default control-plane bind follow-on in REQUIREMENTS.md, sized by whether container-guard.mts is consulted at the bind decision today (it is not)"
affects: [future-broker-control-plane-work, future-PKG-04-revisits]

actuals:
  tokens: 5776
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["accepted-risk planning record with dated reversal criteria, mirroring FORK-01's row shape"]

key-files:
  created:
    - .planning/phases/16-packaging-and-repo-shape/16-PKG04-EVIDENCE.md
  modified:
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Accept the broker control-plane listener's 0.0.0.0 bind default (PKG-04) rather than narrowing it, per the research draft's D-16-05 recommendation — narrowing would reverse a 2026-08-03 blocking checkpoint decision without the live container-reachability evidence that decision rests on."
  - "Corrected the research draft's 'token not persisted' characterisation against source: the 256-bit capability token IS written into a mode-0600 broker.json for the broker's entire running lifetime, confirmed live by inspecting a real broker.json this session."
  - "Recorded the smart-default (loopback-unless-container) alternative as a named follow-on rather than building it, since it is new behaviour excluded by this milestone's Out of Scope table, and confirmed it is a real design change (container-guard.mts is not consulted at the bind decision today) rather than small wiring."

requirements-completed: [PKG-04]

coverage:
  - id: D1
    description: "16-PKG04-EVIDENCE.md grounds every factual claim (bind-default sites, token lifecycle, comparison primitive, container-detector consultation, live bind observation) in source citations read this session or captured live output"
    verification:
      - kind: other
        ref: "task 1 acceptance_criteria: grep for timingSafeEqual/0600/randomBytes(32)/broker.json, resources/ citation count >=1, git diff --quiet -- .claude/mcp/vice"
        status: pass
    human_judgment: false
  - id: D2
    description: "PROJECT.md carries exactly one three-column PKG-04 Key Decisions row containing all required literals, the rejected narrow branch, and the revisit glyph; REQUIREMENTS.md names the smart-default follow-on; no other row or checkbox changed"
    verification:
      - kind: other
        ref: "task 2 automated verify script (node one-liner asserting row count/columns/literals) + git diff -U0 grep checks for zero row/checkbox mutation"
        status: pass
      - kind: other
        ref: "cd .claude/mcp/vice && npm run test:automated (2107 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "cd .claude/mcp/vice && VICE_REQUIRE_ACME=1 npm test (2248 pass, 0 fail, 39 skipped, 5 todo)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-22
status: complete
---

# Phase 16 Plan 02: PKG-04 Accepted-Risk Record Summary

**Recorded the broker control-plane listener's `0.0.0.0` bind as a dated, evidence-grounded accepted risk in PROJECT.md, correcting a research draft's "token not persisted" error against live source.**

## Performance

- **Duration:** ~25 min
- **Started:** ~2026-08-22T21:30:00Z
- **Completed:** 2026-08-22T21:53:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Verified, against source read this session and a live broker start on this host, every claim the PKG-04 accepted-risk record makes: the `0.0.0.0` bind default across five sites (two authored code sites, one authored doc-comment site, two compiled `resources/*.mjs` twins), the corrected token-persistence lifecycle, the `timingSafeEqual` comparison primitive, and that `container-guard.mts`'s detector is not consulted at the bind decision today.
- Started a real broker (`node resources/vice-broker.mjs --dry-run`) and captured `ss -tln` output showing the control port bound `0.0.0.0:19510` and the fork's `-mcpserver` port bound `0.0.0.0:6645`; inspected the written `broker.json` directly and confirmed mode `0600` and a persisted 64-hex-character `control_token`.
- Wrote the evidence to `.planning/phases/16-packaging-and-repo-shape/16-PKG04-EVIDENCE.md`, correcting the research draft's "per-boot, not persisted" token characterisation on the record.
- Appended one three-column row to PROJECT.md's Key Decisions table (matching FORK-01's shape and tone), recording the accepted risk, its rationale, the rejected narrow branch, and a concrete reversal condition.
- Recorded the smart-default (loopback-unless-container) alternative as a named follow-on in REQUIREMENTS.md's Future Requirements, sized by the evidence's finding that it is a real design change, not small wiring.
- No file under `.claude/mcp/vice` was edited across either task; both broker-launch.mts and broker-control.mts remained byte-identical throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify every claim the accepted-risk record will make, against source and against a live listener** — `db678c3` (docs)
2. **Task 2: Write the accepted-risk decision row and the named follow-on** — `27c4ac4` (docs)

**Plan metadata:** committed alongside this SUMMARY (see final commit hash in repository history)

## Files Created/Modified
- `.planning/phases/16-packaging-and-repo-shape/16-PKG04-EVIDENCE.md` - every factual claim for the PROJECT.md row, grounded in `file:line` citations and live output
- `.planning/PROJECT.md` - one new Key Decisions row (PKG-04, dated 2026-08-22)
- `.planning/REQUIREMENTS.md` - one new Future Requirements subsection (Control-Plane Bind Follow-on)

## Decisions Made
- Chose the accepted-risk branch over narrowing, per the plan's D-16-05 pre-decision: the `0.0.0.0` default exists specifically so a containerised consumer dialing `host.docker.internal` (which resolves to the Docker bridge gateway on Linux, not loopback) can reach the broker; narrowing without replacing that reachability would be a regression dressed as hardening.
- Corrected the research draft's token-persistence claim against source rather than propagating it — the token is written into a mode-0600 `broker.json` for the broker's entire lifetime, not "per-boot, not persisted."
- Left the PKG-04 requirement checkbox in REQUIREMENTS.md's "Packaging and Repo Shape" checklist untouched, per the plan's explicit instruction that requirement-completion bookkeeping is a phase-close step, not this plan's — verified by `git diff -U0 .planning/REQUIREMENTS.md | grep -cE '^[-+]- \[[ x]\] \*\*'` returning 0 across both task commits.

## Deviations from Plan

None - plan executed exactly as written. The plan's own read_first citations for `broker-control.mts` and `vice-broker.mts` line ranges were approximate pointers into a large file; exact line numbers were re-derived via `grep -n` this session and used in the evidence document instead of the plan's approximate ranges, which is exactly the "verify against source, not against research prose" instruction the plan itself gives — not a deviation from the plan's intent.

## Issues Encountered

None. The live broker start required using the compiled `resources/vice-broker.mjs` entry point rather than the authored `.mts` source directly (the authored `.mts` imports sibling `.mjs` files that only exist under `resources/`, by this project's own container/host build-step architecture) — resolved on the first retry, no lasting issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PKG-04 is disposed on the accepted-risk branch with a fully evidence-grounded record; the requirement checkbox itself remains unchecked pending phase 16's close-out bookkeeping, as the plan directs.
- The smart-default control-plane bind follow-on is filed and sized for whichever future milestone next opens this decision.
- No broker source file was touched; `broker-launch.mts` and `broker-control.mts` remain exactly as they were before this plan, confirmed by `git diff --quiet -- .claude/mcp/vice` after both task commits.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-22*

## Self-Check: PASSED

- FOUND: `.planning/phases/16-packaging-and-repo-shape/16-PKG04-EVIDENCE.md`
- FOUND: commit `db678c3` (Task 1)
- FOUND: commit `27c4ac4` (Task 2)
- Confirmed: PROJECT.md contains a PKG-04 Key Decisions row
- Confirmed: REQUIREMENTS.md contains the PKG-04 follow-on reference
- Confirmed: `git diff --quiet -- .claude/mcp/vice` exits 0 (no broker source touched)
- Confirmed: `cd .claude/mcp/vice && npm run test:automated` — 2107 pass, 0 fail
- Confirmed: `cd .claude/mcp/vice && VICE_REQUIRE_ACME=1 npm test` — 2248 pass, 0 fail
