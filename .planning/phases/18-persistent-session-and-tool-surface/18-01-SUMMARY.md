---
phase: 18-persistent-session-and-tool-surface
plan: 01
subsystem: architecture-governance
tags: [architecture-decision-record, regenerator2000, r2000, decision-log, planted-violation-guard]

# Dependency graph
requires: []
provides:
  - "A dated Architecture Change Record in .planning/ARCHITECTURE.md executing the six-step Architecture Change Procedure for the D-17/D-18 reversal"
  - "Rule A21 stating the post-reversal one-long-lived-child invariant"
  - "D-36 in .planning/PROJECT.md's Key Decisions table, superseding D-32 with a client-side composition verdict and a named issue-#42 reversal trigger"
  - "src/mcp/vice/docs-r2000-decisions.test.ts pinning both records, proven non-vacuous by three live planted-violation probes"
affects: ["18-03 (first implementing plan of the D-17/D-18 reversal)", "18-05 (executes D-36's client-side composition)", "18-06", "18-07"]

# Actuals (#2632)
actuals:
  tokens: 22000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Planted-violation non-vacuity proof against the REAL committed documents (not synthetic fixtures embedded in the test file) — temporarily mutate ARCHITECTURE.md/PROJECT.md, observe the named test go RED, restore byte-for-byte via checksum-verified backup, observe GREEN"
    - "docs-*.test.ts guard family membership: a new guard file must extend scripts/audit-gate.mjs's EXPECTED_DOCS_GUARD_NAMES/DOCS_GUARD_FLOOR and audit-integrity.test.ts's mirrored assertion list in the SAME commit, per their own header instructions and the registry-drift detector (CR-02) they added"

key-files:
  created:
    - src/mcp/vice/docs-r2000-decisions.test.ts
  modified:
    - .planning/ARCHITECTURE.md
    - .planning/PROJECT.md
    - scripts/audit-gate.mjs
    - src/mcp/vice/audit-integrity.test.ts

key-decisions:
  - "Ran the six-step Architecture Change Procedure for the D-17/D-18 reversal in full, in ARCHITECTURE.md, before any implementing code lands (D18-36) — this plan sits ahead of every code plan in the phase for exactly that reason."
  - "Allocated D-36 as the next project-wide decision id (D-35 was the prior max), superseding D-32, with the client-side composition verdict and the upstream issue #42 reversal trigger."
  - "Reworded the D-36 row's phrasing from a literal 'FORK-01's row states its own trigger' to a paraphrase, after discovering the literal substring made docs-fork-decision.test.ts's exactly-one-FORK-01-row assertion match two rows instead of one."
  - "Extended scripts/audit-gate.mjs's EXPECTED_DOCS_GUARD_NAMES (6 -> 7 entries) and DOCS_GUARD_FLOOR (6 -> 7), plus audit-integrity.test.ts's mirrored EXPECTED_GUARD_NAMES_FOR_ASSERTION, in the same commit as the new guard file — required by those files' own header instructions and caught immediately by the registry-drift detector (CR-02) they added in Phase 17."

requirements-completed: [SESS-01, SURF-02]

coverage:
  - id: D1
    description: "ARCHITECTURE.md carries a dated Architecture Change Record naming D-17/D-18 by id and walking all six steps of the Architecture Change Procedure"
    requirement: SESS-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-r2000-decisions.test.ts#2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "ARCHITECTURE.md carries a new Rule A21 stating the post-reversal one-long-lived-child-per-project-path invariant in four checkable sentences"
    requirement: SESS-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-r2000-decisions.test.ts#3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and r2000-mcp-client.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "PROJECT.md's Key Decisions table carries a dated D-36 row stating supersession of D-32 and naming the upstream issue #42 fix as its reversal trigger"
    requirement: SURF-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-r2000-decisions.test.ts#4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs-r2000-decisions.test.ts fails when the reversal record, Rule A21, or the D-36 row is removed, undated, or stripped of its reversal trigger — demonstrated by a planted violation before the guard is accepted"
    verification:
      - kind: unit
        ref: "manual live probe: three planted violations (heading rename x2, reversal-trigger sentence removal), each observed RED then restored byte-for-byte to observed GREEN — transcripts in this SUMMARY's 'Non-Vacuity Proof' section"
        status: pass
    human_judgment: false
  - id: D5
    description: "The D-36 record states that r2000_get_address_details is composed client-side from r2000_get_symbols, r2000_get_comments, r2000_get_blocks and r2000_get_cross_references and never calls upstream's same-named tool"
    requirement: SURF-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-r2000-decisions.test.ts#4 (same test as D3 — asserts the row's composition text alongside its supersession/trigger content)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-24
status: complete
---

# Phase 18 Plan 01: D-17/D-18 Reversal Record and D-36 Allocation Summary

**Ran the Architecture Change Procedure's six steps in full for the D-17/D-18 per-call-lifecycle reversal, allocated D-36 superseding D-32's `r2000_get_address_details` exclusion, and pinned both with `docs-r2000-decisions.test.ts`, proven non-vacuous by three live red-then-green planted-violation probes against the real committed documents.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-24T08:01:28Z (first commit)
- **Completed:** 2026-08-24T08:21:20Z (last commit); verification/SUMMARY work continued after
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `.planning/ARCHITECTURE.md` gained a dated `## Architecture Change Record` (2026-08-24) naming D-17/D-18 by id, quoting `r2000-mcp-client.ts`'s own reversed lifecycle statement, naming SESS-01 as the unservable requirement, naming D18-08's save-per-mutation invariant as the durability-preserving alternative, pointing at `18-CONTEXT.md`'s D18-01..D18-36 and `PROJECT.md`'s Key Decisions table as the decision history, naming `r2000-session.test.ts`/`r2000-spawn-seam.test.ts` as the landing guards, and naming plan 18-03 as the first implementing plan — six numbered steps, none empty.
- A new `### Rule A21 — One long-lived regenerator2000 child per project path, per proxy process` was added directly after Rule A20 (before `## Dependency Direction`), stating the single-slot, lazy-open, kill-by-handle, sole-spawn-site invariant in four sentences, with Rules A1-A20 left byte-for-byte untouched (confirmed via `git diff -U0` showing zero deletion lines).
- `.planning/PROJECT.md`'s Key Decisions table gained exactly one new row: **D-36**, dated 2026-08-24, stating that `r2000_get_address_details` is superseded from D-32's exclusion into a client-side composition of `r2000_get_symbols`/`r2000_get_comments`/`r2000_get_blocks`/`r2000_get_cross_references`, citing `handler.rs:1894`'s `u16` overflow, and naming the upstream regenerator2000 issue #42 fix as the reversal trigger. The matching Active-requirements bullet and the v0.5.0 Target Features bullet were both updated to point at D-36 rather than leaving a stale D-32-only reference.
- `src/mcp/vice/docs-r2000-decisions.test.ts` lands as a fifth `docs-*.test.ts` sibling, modelled on `docs-core-value-decision.test.ts` and `docs-fork-decision.test.ts`, with 5 named tests (non-vacuity self-check, the ARCHITECTURE.md record check, the Rule A21 check, the D-36 row check, and a cross-document D-32/D-36 consistency check) — all green, and deliberately kept out of `package.json`'s `files[]`.
- All 5 tests were proven non-vacuous by three separate live probes against the real, committed documents (not synthetic fixtures): each probe planted a real violation, ran the guard, observed the named test go RED, restored the document byte-for-byte (checksum-verified), and observed GREEN again. See "Non-Vacuity Proof" below for the transcribed assertion messages.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the D-17/D-18 Architecture Change Record and Rule A21 into ARCHITECTURE.md** — `57a5171` (docs)
2. **Task 2: Allocate D-36 in PROJECT.md, superseding D-32, with a named reversal trigger** — `dd1fcfc` (docs)
3. **Task 3: Land docs-r2000-decisions.test.ts and prove it non-vacuous** — `d60f925` (test) — includes the two knock-on registry fixes described in Deviations below

_No TDD tasks in this plan; each task's tests/checks were run before its own commit._

## Files Created/Modified
- `.planning/ARCHITECTURE.md` — new `## Architecture Change Record` section (six steps) and `### Rule A21` (positioned after Rule A20, before `## Dependency Direction`)
- `.planning/PROJECT.md` — new D-36 Key Decisions row; updated Active-requirements bullet (line 153) and v0.5.0 Target Features bullet (line 508) to cite D-36
- `src/mcp/vice/docs-r2000-decisions.test.ts` — new guard, 5 tests, line-based section isolators handling the "last section in the file" edge case a naive `(?=\n## |$)` regex mishandles under the `m` flag
- `scripts/audit-gate.mjs` — `EXPECTED_DOCS_GUARD_NAMES` extended to include `docs-r2000-decisions.test.ts`; `DOCS_GUARD_FLOOR` raised 6 → 7
- `src/mcp/vice/audit-integrity.test.ts` — `EXPECTED_GUARD_NAMES_FOR_ASSERTION` extended to match

## Decisions Made
See `key-decisions` in frontmatter. The two most consequential: (1) the D-36 row's prose could not literally repeat "FORK-01's row" without breaking `docs-fork-decision.test.ts`'s exactly-one-row assertion, so it was reworded to describe the pattern without the literal token; (2) the audit-gate registry files are outside this plan's declared `files_modified` but had to be touched in the same commit as the new guard file, per their own documented convention and the registry-drift detector they ship — treated as a Rule 3 blocking-issue auto-fix, not scope creep.

## Non-Vacuity Proof (Task 3 acceptance criterion)

Three live planted-violation probes were run against the real, committed `.planning/ARCHITECTURE.md` and `.planning/PROJECT.md` (backed up first, restored via `cp` from backup and re-verified by `md5sum` match after each probe — no planted state was committed):

**Probe 1 (test 2 — Architecture Change Record heading renamed):**
```
could not locate ARCHITECTURE.md's '## Architecture Change Record' heading
```
Restored; `md5sum` matched pre-probe checksum; full suite green again.

**Probe 2 (test 3 — Rule A21 heading renamed):**
```
could not locate ARCHITECTURE.md's '### Rule A21' heading
```
Restored; `md5sum` matched pre-probe checksum; full suite green again.

**Probe 3 (test 4 — D-36 row's reversal-trigger sentence removed):**
```
the D-36 row contains none of the named reversal-trigger phrases (reverses if, would reverse,
reversal criteria) -- a row with no stated reversal condition is a status-quo restatement, not
the dated decision D-36 requires
```
Restored; `md5sum` matched pre-probe checksum; full suite green again.

`git status --porcelain .planning/` was clean of any planted-violation residue after all three probes (the only pending changes were the orchestrator-owned `STATE.md` and an unrelated `.planning/milestone.lock`, neither touched by the probes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-36 row's prose collided with docs-fork-decision.test.ts's FORK-01 row lookup**
- **Found during:** Task 3, first full-suite run after adding the new guard
- **Issue:** The D-36 row's rationale text said "the same way FORK-01's row states its own trigger", which put the literal substring `FORK-01` inside PROJECT.md's `## Key Decisions` section on a non-FORK-01 row. `docs-fork-decision.test.ts`'s `findForkRow()` filters rows by `row.includes("FORK-01")` and asserts exactly one match; with two rows matching, tests 2-5 of that guard failed.
- **Fix:** Reworded the sentence to describe the pattern ("this project's other retain-with-reversal-criteria decisions... see the fork-backend retention row above") without repeating the literal token.
- **Files modified:** `.planning/PROJECT.md`
- **Verification:** `node --test docs-fork-decision.test.ts` returns to 6/6 passing; `grep` confirms exactly one `FORK-01` occurrence inside the Key Decisions section's line range.
- **Committed in:** `d60f925`

**2. [Rule 3 - Blocking] audit-gate.mjs's docs-guard registry and its mirrored test-file copy were one guard behind**
- **Found during:** Task 3, first full-suite run after adding `docs-r2000-decisions.test.ts`
- **Issue:** `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` (6 entries) and `DOCS_GUARD_FLOOR` (6), plus `audit-integrity.test.ts`'s mirrored `EXPECTED_GUARD_NAMES_FOR_ASSERTION`, did not know about the new 7th `docs-*.test.ts` file. The registry-drift detector those same files added in Phase 17 (CR-02, "the runtime registry names every guard the disk-derived set carries") correctly failed the instant the new guard landed, along with two other audit-integrity assertions that compare against the same lists.
- **Fix:** Extended `EXPECTED_DOCS_GUARD_NAMES` and `EXPECTED_GUARD_NAMES_FOR_ASSERTION` to include `docs-r2000-decisions.test.ts`; raised `DOCS_GUARD_FLOOR` from 6 to 7 — exactly what each file's own header comment instructs "in the same commit that adds ... a docs-*.test.ts guard file."
- **Files modified:** `scripts/audit-gate.mjs`, `src/mcp/vice/audit-integrity.test.ts`
- **Verification:** `node --test audit-integrity.test.ts` returns to 44/44 passing; full `npm test` returns to 2400/2400 non-skipped-non-todo tests passing (2356 pass, 0 fail, 39 skipped, 5 todo).
- **Committed in:** `d60f925`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug fix, 1 Rule 3 blocking-issue fix)
**Impact on plan:** Both fixes were necessary knock-on consequences of adding a 7th `docs-*.test.ts` guard file to a repo whose own conventions require exactly these companion updates. Neither is scope creep — both are required for the plan's own stated verification ("`cd src/mcp/vice && npm test` exits 0 (full suite)") to hold. The plan's third `<verification>` bullet ("`git diff --stat` touches exactly `.planning/ARCHITECTURE.md`, `.planning/PROJECT.md`, and the one new test file") did not anticipate this cascading requirement and is therefore not fully met as literally written — the cumulative diff (`git diff --stat 0ea0edb..HEAD`) touches 5 files, not 3. This is recorded here rather than silently satisfied by a narrower interpretation.

## Issues Encountered
None beyond the two deviations above, both resolved within this plan.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The D-17/D-18 reversal is now a recorded architectural decision (ARCHITECTURE.md's Architecture Change Record + Rule A21), so plan 18-03 (the first implementing plan, per step 6 of the procedure) can proceed without re-litigating the architectural question.
- D-36 is allocated and pinned, so plan 18-05 (which executes the client-side composition) can cite it directly rather than deciding it inline.
- `docs-r2000-decisions.test.ts` is live in the suite from this commit forward — any future edit that silently drifts either record will be caught the same way the three planted-violation probes demonstrated.
- No blockers for the rest of the phase's wave-1/wave-2 plans.

---
*Phase: 18-persistent-session-and-tool-surface*
*Completed: 2026-08-24*

## Self-Check: PASSED

- `[ -f src/mcp/vice/docs-r2000-decisions.test.ts ]` → FOUND
- `[ -f .planning/ARCHITECTURE.md ]` → FOUND (contains `## Architecture Change Record` and `### Rule A21`)
- `[ -f .planning/PROJECT.md ]` → FOUND (contains D-36 row)
- `git log --oneline --all | grep -q 57a5171` → FOUND
- `git log --oneline --all | grep -q dd1fcfc` → FOUND
- `git log --oneline --all | grep -q d60f925` → FOUND
- `cd src/mcp/vice && node --test docs-r2000-decisions.test.ts` → 5/5 pass
- `cd src/mcp/vice && npm test` (full suite) → 2400 tests, 2356 pass, 0 fail, 39 skipped, 5 todo
- `node scripts/check-skill-tool-coverage.mjs` → exit 0
