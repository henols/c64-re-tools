---
phase: 34-the-host-tool-execution-seam
plan: 11
subsystem: host-tool-execution-seam
tags: [docs, decision-record, deferred-items-ledger, todo-lifecycle, gap-closure, host-tool]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-10's ancestor-realpath walk closing CR-05, its A-15/A-16 decisions, and its commits ae8d7e1/790c731/b3b4238"
provides:
  - "docs/phase34-host-tool-seam-decisions.md Part 4 — an appended, dated CR-05 correction (what was wrong / what changed / what did NOT change / what is still NOT closed), following the same four-section shape as the 34-09 correction"
  - "docs/phase34-host-tool-seam-decisions.md's A-NN table gains A-15 (the walk is local, host-bound-module constraint) and A-16 (real-path return, container-translation limit), both dated 2026-09-04 and pointing at 34-10-PLAN.md"
  - "CR-05 todo closed: moved from .planning/todos/pending/ to .planning/todos/completed/ with a Resolution section and re-derived host-tool.mts line citations"
  - ".planning/STATE.md's Deferred Items ledger reconciled: CR-05 row removed, open-pending figure corrected 9 -> 8, WR-03's row and todo left untouched"
affects: ["any future host-tool.mts path-argument work", "the next Phase 34 gap-closure round, should WR-03 be picked up"]

actuals:
  tokens: 4782
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Gate-before-bookkeeping: Task 2 ran the full verification gate (module-family suites, ledger+confinement guards, typecheck, repo-level gates, full automated suite) and quoted its measured output BEFORE touching any todo file or ledger row, per the plan's own must_haves and this phase's prior SEAM-02 lesson."
    - "Two-directional ledger atomicity: the todo file move (git mv) and the STATE.md row removal landed in ONE commit, so docs-deferred-ledger.test.ts never observed a half state in either direction."

key-files:
  created: []
  modified:
    - docs/phase34-host-tool-seam-decisions.md
    - .planning/todos/completed/2026-09-03-cr-05-resolveworkspacepath-is-symlink-blind.md
    - .planning/STATE.md

key-decisions:
  - "A-15 and A-16 recorded as added 2026-09-04 pointing at 34-10-PLAN.md, not backdated to appear contemporaneous with A-01..A-14 — a decision record that misdates when something was known is itself a defect this document's own convention exists to avoid."
  - "The CR-05 todo's Resolution states plainly that the fix took the LOCAL-walk route, not the todo's own preferred 'export and reuse realpathOfNearestExisting() from anno-types.ts' route, and names the structural reason (host-tool.mts is host-bound, anno-types.ts is not) rather than presenting the deviation as equivalent to what was asked for."
  - "SEAM-02's Complete marking in REQUIREMENTS.md was left untouched in both directions, per 34-VERIFICATION.md's own written ruling that the requirement's literal text is met independent of CR-05 — this plan does not re-score it."
  - "WR-03's ledger row and todo file were deliberately left exactly as they were (still Pending, still in todos/pending/) — closing CR-05 is not closing WR-03, and the two share only a filed-against file."

requirements-completed: []

coverage:
  - id: D1
    description: "docs/phase34-host-tool-seam-decisions.md gains an appended, dated CR-05 correction (Part 4) covering what was wrong, what changed, what did NOT change, and what is still NOT closed, with the original text above it left legible."
    verification:
      - kind: unit
        ref: "git diff --numstat docs/phase34-host-tool-seam-decisions.md reports 0 deletions across both commits"
        status: pass
      - kind: unit
        ref: "grep -a -c '^| A-1[56] |' docs/phase34-host-tool-seam-decisions.md == 2"
        status: pass
      - kind: unit
        ref: "grep -a -o -E 'CR-05|WR-01|WR-02|WR-03|MAXSYMLINKS' docs/phase34-host-tool-seam-decisions.md | sort -u -- all five tokens present"
        status: pass
    human_judgment: false
  - id: D2
    description: "A-15 and A-16 added to the A-NN decision table, each with the table's four columns, rated Costly, and marked as added this round rather than backdated."
    verification:
      - kind: unit
        ref: "manual inspection of the two new table rows and their 'Added 2026-09-04, 34-10-PLAN.md' prefix"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate ran BEFORE any bookkeeping edit, with its measured output (module-family suites, ledger guards, typecheck/repo-level gates, full automated suite) quoted in this SUMMARY and in the moved todo's Resolution."
    verification:
      - kind: unit
        ref: "node --test host-tool.test.ts host-tool-transport.test.ts ghidra-project.test.ts resources-sync.test.ts hostpath-consumers.test.ts spawn-seam.test.ts -- tests 158 / pass 158 / fail 0"
        status: pass
      - kind: unit
        ref: "node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts anno-confinement.test.ts anno-seam.test.ts -- tests 55 / pass 55 / fail 0"
        status: pass
      - kind: unit
        ref: "npm run test:automated -- tests 3278 / suites 24 / pass 3270 / fail 2 / skipped 1 / todo 5 (both failures in anno-register.test.ts, the measured 2-in-1-file floor)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CR-05 todo is in .planning/todos/completed/ with a Resolution section naming the closing plan, the commits, the two new assumptions, and the residuals the fix does NOT close; its stale host-tool.mts line citations are re-derived against the post-fix source."
    verification:
      - kind: unit
        ref: "ls .planning/todos/pending .planning/todos/completed | grep -c cr-05-resolveworkspacepath -- 0 pending, 1 completed"
        status: pass
      - kind: manual_procedural
        ref: "human-check per the plan's own verify block: the Resolution reads as a closure naming the plan/commits, the route decision and why, an answer to each of the three Constraints, and the three residuals without softening"
        status: pass
    human_judgment: true
    rationale: "The plan's own <verify> block for Task 2 specifies this as a <human-check> item, not an automated assertion — whether prose 'reads as a closure rather than a claim' is a judgment call by design."
  - id: D5
    description: "STATE.md's Deferred Items table no longer carries a Pending row for the CR-05 todo, still carries WR-03's row, and the stated open-pending figure (9 -> 8) matches the table's own row count -- with the file move and the STATE.md edit landing in ONE commit."
    verification:
      - kind: unit
        ref: "ls .planning/todos/pending | grep -c wr-03-host-tool-never-throws -- 1 (untouched)"
        status: pass
      - kind: unit
        ref: "git diff --numstat .planning/STATE.md -- 3 insertions, 4 deletions (within the plan's at-most-3/at-most-4 bound)"
        status: pass
      - kind: unit
        ref: "git show --stat HEAD -- lists .planning/STATE.md and the todos/{pending=>completed} rename together in one commit"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 34 Plan 11: The record and the debt ledger agree with 34-10's code, gate-first

**Appended a dated CR-05 correction plus A-15/A-16 to the decision record, then ran the full verification gate and only after it passed closed the CR-05 todo and reconciled STATE.md's Deferred Items ledger in one commit.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-04
- **Tasks:** 2
- **Files modified:** 3 (`docs/phase34-host-tool-seam-decisions.md`, `.planning/todos/completed/2026-09-03-cr-05-resolveworkspacepath-is-symlink-blind.md` (moved from `pending/`), `.planning/STATE.md`)

## Accomplishments

- `docs/phase34-host-tool-seam-decisions.md` gained an appended Part 4: a dated CR-05 correction in the same four-section shape (what was wrong / what changed / what did NOT change / what is still NOT closed) the `34-09` correction established, citing `34-VERIFICATION.md` gap 3 and `34-REVIEW.md` CR-05 by name, naming the live reproduction the verifier ran, and naming all three carried warnings (`WR-01`, `WR-02`, `WR-03`) plus the check-then-open window and the Unicode-normalisation divergence as still open.
- Two new rows added to the `A-NN` decision table — `A-15` (the ancestor-realpath walk is reimplemented locally in `host-tool.mts` because it is host-bound and `anno-types.ts` is not; the equivalence test is the price) and `A-16` (the seam returns the real path; a symlinked workspace root becomes a recorded, accepted limit rather than a widened `hostpath.ts` consumer set) — both rated `Costly` and both explicitly dated as added this round rather than backdated to `A-01`..`A-14`.
- The full verification gate ran FIRST, before any todo or ledger edit: module-family suites (158/158), ledger+confinement guards (55/55), `typecheck`/`check-npm-packages`/`check-no-skill-external-spawn` (all clean), and the full `test:automated` suite (3278 tests / 3270 pass / 2 fail, both in `anno-register.test.ts` at the measured 2-in-1-file floor, no regression) — with no VICE broker running.
- The CR-05 todo was `git mv`'d to `.planning/todos/completed/` with a `## Resolution` section naming plan `34-10`'s three commits, the `A-15` route decision (LOCAL walk, not the todo's own preferred "reuse `realpathOfNearestExisting()`" route) and why, an explicit answer to each of the todo's three Constraints, and the three residuals the fix does not close. Its `files:` line citations for `host-tool.mts` were re-derived against the post-fix source (`:370-386` → `:563-586`, `:780-843` → `:979-1032`, `:1013-1017` → `:1213-1217`).
- `.planning/STATE.md`'s Deferred Items table lost its CR-05 row (WR-03's row directly below it left untouched) and its stated open-pending figure was corrected from 9 to 8 — both edits in the same commit as the todo file move, so `docs-deferred-ledger.test.ts` never observed a half state in either direction.

## Task Commits

Each task was committed atomically:

1. **Task 1: The decision record gains a dated CR-05 correction and the two assumptions `34-10` had to make** — `9c8f8b9` (docs)
2. **Task 2: The gate runs, then the debt ledger and the todo tree agree with the code — in one commit** — `3f506ae` (docs)

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified

- `docs/phase34-host-tool-seam-decisions.md` — appended Part 4 (the CR-05 correction) and two new `A-NN` table rows (`A-15`, `A-16`); zero deletions (`git diff --numstat` confirms) — append-only, per this document's own convention.
- `.planning/todos/completed/2026-09-03-cr-05-resolveworkspacepath-is-symlink-blind.md` — moved from `.planning/todos/pending/`; frontmatter `files:` line citations re-derived; `## Resolution` section appended.
- `.planning/STATE.md` — one Deferred Items table row removed (CR-05), the stated open-pending figure corrected (9 → 8); WR-03's row, `REQUIREMENTS.md`, and `ROADMAP.md` untouched.

## Decisions Made

- `A-15`/`A-16` recorded as added 2026-09-04, pointing at `34-10-PLAN.md`, never presented as contemporaneous with `A-01`..`A-14` — a backdated assumption would be a record that lies about when it was known.
- The CR-05 Resolution states plainly that the fix took the LOCAL-walk route rather than the todo's own preferred "export and reuse `realpathOfNearestExisting()`" route, and names the structural reason (`host-tool.mts` is host-bound and compiles to a `.mjs` that cannot import a container-side `.ts`).
- `SEAM-02`'s `Complete` marking in `.planning/REQUIREMENTS.md` was left untouched in both directions — the verifier ruled in writing that its literal text is met independent of CR-05, and this plan does not re-score it.
- WR-03's ledger row and todo file were deliberately left exactly as they were (still Pending, still in `.planning/todos/pending/`) — closing CR-05 is not closing WR-03; the three-way todo count (`0`, `1`, `1`) asserts this by construction.

## Deviations from Plan

None — plan executed exactly as written. One mechanical note: the plan's own regex for the `A-15`/`A-16` verify check (`^| A-1[56] |`) requires the ID cell to contain nothing but the bare ID before the next pipe; the "added this round" dating was therefore placed at the start of the Decision-column prose (`*Added 2026-09-04, \`34-10-PLAN.md\`...*`) rather than appended to the ID cell itself, which is where a first draft placed it. No behavioral or scope change — same information, same row, corrected cell boundary.

## Issues Encountered

None. All verify-block commands passed after that one correction; the gate in Task 2 was green on its first run.

## Measured Gate Results (recorded per Task 2's own instruction, run BEFORE any bookkeeping edit)

- `node build.ts && node --test host-tool.test.ts host-tool-transport.test.ts ghidra-project.test.ts resources-sync.test.ts hostpath-consumers.test.ts spawn-seam.test.ts`: `tests 158 / pass 158 / fail 0`.
- `node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts anno-confinement.test.ts anno-seam.test.ts`: `tests 55 / pass 55 / fail 0`.
- `npm run typecheck`: clean (`tsc --noEmit` exit 0). `node scripts/check-npm-packages.mjs`: `check-npm-packages: OK` (86 files / 38 files, 7 skills). `node scripts/check-no-skill-external-spawn.mjs`: `check-no-skill-external-spawn: OK — tracked-tree 16 files, packed-tarball 15 files`.
- `npm run test:automated` (VICE broker confirmed inactive): `tests 3278 / suites 24 / pass 3270 / fail 2 / cancelled 0 / skipped 1 / todo 5` — both failures in `anno-register.test.ts` (`:385` "DIRECTION 5 (basis integrity)", `:479` "planted violation (the negative control)") — exactly the measured 2-in-1-file floor recorded 2026-09-03 (out-of-phase `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` residue), no regression introduced by this plan.
- Post-edit re-check: `node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts`: `tests 13 / pass 13 / fail 0` — both ledger directions and the disposition guard green after the todo move and the STATE.md edit.
- Three-way todo count (`ls .planning/todos/pending/` cr-05 / `ls .planning/todos/completed/` cr-05 / `ls .planning/todos/pending/` wr-03): `0`, `1`, `1` — the move landed, and WR-03 was not touched.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `docs/phase34-host-tool-seam-decisions.md` now describes the seam that actually exists after `34-10`, with `A-15`/`A-16` recorded as newly made and the check-then-open window, the normalisation divergence, and all three carried warnings named as still open.
- `.planning/STATE.md`'s Deferred Items ledger carries no Pending row for a defect that no longer exists (CR-05), still carries WR-03's, and its stated open figure (8) matches its own table row count.
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are untouched by this plan; SEAM-02's marking is unchanged.
- Remaining open items against `host-tool.mts` after this plan: `WR-01` (spawn-gate detector evadable by aliasing), `WR-02` (no admission control / concurrent-JVM ceiling), `WR-03` (unguarded `mkdirSync` in `runOracleRun()` and the CLI entry point's missing `.catch()`) — all deliberately out of this plan's scope and named, not silently dropped.
- No blockers for whatever picks up `WR-03` or the two long-standing deferred-by-decision warnings next.

## Self-Check: PASSED

- FOUND: docs/phase34-host-tool-seam-decisions.md
- FOUND: .planning/todos/completed/2026-09-03-cr-05-resolveworkspacepath-is-symlink-blind.md
- MISSING (expected — moved): .planning/todos/pending/2026-09-03-cr-05-resolveworkspacepath-is-symlink-blind.md
- FOUND: commit 9c8f8b9 (Task 1)
- FOUND: commit 3f506ae (Task 2)

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-04*
