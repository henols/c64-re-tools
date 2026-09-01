---
phase: 32-the-deletion-and-the-grep-gate
plan: 01
subsystem: testing
tags: [ci-guards, audit, git-object-store, mutation-testing, non-vacuity, node-test]

requires:
  - phase: 29-the-mcp-surface
    provides: "the re-pointed guard set this phase audits, the removal gate, and 29-21-SUMMARY.md's commit-level record of the outright removals"
provides:
  - "scripts/check-guard-fates.mjs — a derive-from-disk fate guard over two pinned commits plus the ROADMAP's deferred-fates note; no hand-typed member list anywhere"
  - "scripts/lib/audit-root.mjs — resolveContainedRoot(), the segment-boundary --root containment refusal these audit scripts had no seam for"
  - "scripts/audit-mutation-harness.mjs — a committed, re-runnable instrument: green control -> plant -> run one guard -> assert non-zero -> revert -> write raw evidence"
  - "the fate registry, seeded with one machine-measured tracer row"
  - "D-02's audited-set reconciliation, with three inherited figures corrected against re-run commands"
affects: [32-02, 32-05, 32-06, 32-07, 32-08, 32-09]

actuals:
  tokens: 34531
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Derive-from-disk membership over PINNED git commits, with a fail-closed presence assertion that names `fetch-depth: 0` rather than degrading to a cached list"
    - "Mechanical forward map (git rename detection, then a name-descendant fallback) as the adjacency-subtraction source — never the registry's own newSubject fields, which would make the derived set shrink as rows are added"
    - "Pure predicate + injected `exists` callback, so the colocated test drives the REAL rule instead of a re-implementation"
    - "Green false-positive control before every plant: a red with no green control is recorded UNMEASURABLE, never as evidence"
    - "Byte-preserving plant/revert via a latin1 round-trip plus idempotent restore-on-exit registered on finally, exit, SIGINT, SIGTERM and uncaughtException"

key-files:
  created:
    - scripts/check-guard-fates.mjs
    - scripts/check-guard-fates.d.mts
    - scripts/lib/audit-root.mjs
    - scripts/lib/audit-root.d.mts
    - scripts/audit-mutation-harness.mjs
    - src/mcp/vice/guard-fates.test.ts
    - .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-tracer-observed-red.md
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-audited-set-reconciliation.md
    - .planning/phases/32-the-deletion-and-the-grep-gate/deferred-items.md
  modified: []

key-decisions:
  - "SET_B_FLOOR is the MEASURED 16 and TOTAL_FLOOR the measured 61, not the plan's predicted 15/60 — the plan subtracted 7 already-claimed successors from 22 raw set-B candidates, but one of those 7 (scripts/lib/anno-cli-verbs.d.mts) carries no mention of the subject at 345d5c4 and so was never among the 22. 22 - 6 = 16."
  - "The adjacency subtraction derives the already-claimed successors MECHANICALLY (git rename detection + a name-descendant fallback), not from the registry's newSubject fields. A registry-driven subtraction would report a different set size at every stage of the sweep, so no floor could ever hold."
  - "checkGuardFates() takes `exists` as a REQUIRED injected callback rather than defaulting it. A permissive default would silently pass every working-tree assertion; a missing one is reported as an error."
  - "Set C is parsed out of ROADMAP.md and resolved against `git ls-files`, requiring exactly one match per token and exactly SET_C_FLOOR tokens. A reworded note throws and quotes the note rather than yielding a smaller set C."
  - "deriveAuditedSet() takes an optional `roadmapText` test seam. It is unreachable from the CLI and every value it can take either leaves the derivation unchanged or makes resolveSetC THROW — it cannot turn a red run green, so it is not a relaxation hatch."
  - "The harness's default --out is the tracer evidence file, so the plan's bare verify command produces the required artifact; every sweep plan passes its own --out."
  - "observedRed records the ROOT-RELATIVE cwd. An absolute path pins the artifact to the machine that produced it, and this evidence must stay re-runnable from any clone."

patterns-established:
  - "Floor comments in DOCS_GUARD_FLOOR's idiom: state what a HIGHER count means AND what a LOWER count means, in the message itself, and record that a floor moves only in the commit that changes its derivation."
  - "A plant asserts its `find` string occurs EXACTLY once. Zero occurrences means the guard's green proved nothing; more than one means the plant is ambiguous about what it proved."
  - "A refusal and a typo exit with the same code, so they are separated by their message: --root outside the repo says REFUSED and names both paths; --root inside the repo but nonexistent says TYPO."

requirements-completed: []  # CUT-04 is deliberately NOT marked complete — see "Requirement status" below.

coverage:
  - id: D1
    description: "One real audited-set member driven end to end: derived from the object store, named in the registry, planted against its new subject, guard observed exiting non-zero with a green control, tree restored byte-identical, raw evidence on disk"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/audit-mutation-harness.mjs --row src/mcp/vice/anno-verb-coverage.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fate guard derives 43 set-A + 16 set-B + 2 set-C = 61 members from two pinned commits and one committed document, with no hand-typed member list, and refuses an out-of-repository --root"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/check-guard-fates.mjs (prints setA=43 setB=16 setC=2 total=61 rows=1, exits 1 — the pre-declared red)"
        status: pass
      - kind: integration
        ref: "node scripts/check-guard-fates.mjs --root /tmp (REFUSED, names /tmp and the repo root)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fate guard's own non-vacuity proof: 21 planted violations driving the real exported predicates"
    requirement: "CUT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/guard-fates.test.ts (21/21 pass)"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && npm run typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-02's audited-set reconciliation — the historical 43 against the settled tree, every addition and removal reasoned, every figure carrying its command"
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-audited-set-reconciliation.md"
        status: pass
    human_judgment: true
    rationale: "The document's value is whether a later reader can re-derive the set from it alone and whether each stated reason is a reason rather than a restatement. The mechanical parts (both commits named, all 43 + 16 + 2 paths enumerated, the four floors matching the guard's constants) are checkable and were checked; the sufficiency of the prose reasoning is not."
  - id: D5
    description: "SET_B_FLOOR/TOTAL_FLOOR corrected from the plan's predicted 15/60 to the measured 16/61, with the disproving command recorded"
    verification:
      - kind: integration
        ref: "git show 345d5c4:scripts/lib/anno-cli-verbs.d.mts | grep -aoi anno | wc -l  -> 0, while the same path IS in git diff --diff-filter=A 0394cbc 345d5c4"
        status: pass
    human_judgment: true
    rationale: "The measurement is unambiguous, but the DECISION to move a floor away from the number three later plans (32-06/07/08) were written against needs a human to confirm rather than an executor to assume. Nothing downstream is broken by it — those plans add rows, they do not pin the total — but the arithmetic they inherit changed."

duration: 42min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 01: Tracer — the Fate-Audit Machine Summary

**One audited guard proven end to end — the guard derives it from the object store at `0394cbc`, the registry names it, the harness plants `ANNO_CLI_VERB_FLOOR = 3` → `4`, `anno-verb-coverage.test.ts` is captured exiting 1 against a green control that exited 0, and the tree comes back byte-identical.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-08-31T15:21Z (approx — first task commit at 15:50Z)
- **Completed:** 2026-08-31T16:03Z
- **Tasks:** 3
- **Files created:** 10 (0 modified)

## Accomplishments

- **The tracer closed.** `node scripts/audit-mutation-harness.mjs --row src/mcp/vice/anno-verb-coverage.test.ts` exits 0 having recorded the guard's own exit status as **1**, with a **green false-positive control at exit 0** captured before the plant, and `git status --porcelain` byte-identical before and after. The full raw capture — both halves, TAP transcripts included — is at `evidence/32-tracer-observed-red.md`.
- **The audited set derives, and reproduces the requirement's figures.** `setA=43` (19 name-carrying + 13 content-only test files = 32, plus 11 `scripts/` files) — exactly `CUT-04`'s two historical figures, re-measured. `setB=16`, `setC=2`, `total=61`. No member path is typed by hand anywhere in the guard (`grep -c 'src/mcp/vice/anno' scripts/check-guard-fates.mjs` is 0).
- **The pre-declared red is real and specific.** The guard exits non-zero naming **60** members with no row — one per line, individually. A green here would have meant the membership check was vacuous.
- **The guard carries its own non-vacuity proof.** 21 tests in `src/mcp/vice/guard-fates.test.ts`, every one driving the REAL exported predicate: a deleted row, a stranger row, duplicate `historicalPath`, duplicate `newSubject`, an empty registry, an empty derived set, a zero-exit `observedRed`, a red with no green control, a missing `removalTrigger`, an unrecognised verdict, a load-bearing `exists` injection, three set-C parse failures, and the segment-wise `--root` boundary (`<repoRoot>-evil` is refused).
- **Three inherited figures were re-measured and corrected**, each with the command that disproves it — see Deviations.

## Task Commits

1. **Task 1 (tracer): one audited-set member, end to end** — `371750e` (feat)
2. **Task 2 RED: the fate guard's non-vacuity proof** — `8963964` (test)
3. **Task 2 GREEN: ambient declarations** — `eadba0b` (feat)
4. **Task 3: D-02's audited-set reconciliation** — `7cf922e` (docs)

## Files Created

- `scripts/lib/audit-root.mjs` — `resolveContainedRoot()`. Segment-boundary containment (`resolved === base || resolved.startsWith(base + sep)`), so `/repo-evil` cannot pass as inside `/repo`. Written new: research cited `audit-gate.mjs:1147-1151` as the check to copy, and that code is the WR-03 typo try/catch — there is no containment check anywhere in that file, exactly as `32-PATTERNS.md` measured.
- `scripts/check-guard-fates.mjs` — the fate guard. Two pinned commits asserted present before any derivation (absence names `fetch-depth: 0`); set A over `git ls-tree --full-tree` at `0394cbc`; a mechanical forward map; set B over `git diff --diff-filter=A` with the adjacency subtraction; set C parsed out of `ROADMAP.md`; four floors; `checkGuardFates()` pure with injected `exists`; `--root`; `IS_ENTRY_POINT`; a tail report printing the measured numbers rather than the word OK.
- `scripts/check-guard-fates.d.mts`, `scripts/lib/audit-root.d.mts` — ambient declarations in the two existing siblings' header formula. Neither is in `src/mcp/vice/package.json`'s `files[]` (`grep -c 'guard-fates' src/mcp/vice/package.json` is 0).
- `scripts/audit-mutation-harness.mjs` — the phase instrument. `--row` / `--rows` / `--all` (exactly one required), `--root`, `--out`. Per row: baseline tree check → green control → plant → run one guard → assert non-zero → revert → tree check. In **no** CI `run:` line and **no** `package.json` script.
- `src/mcp/vice/guard-fates.test.ts` — 21 planted violations, colocated so CI's existing `npm test` step already covers it.
- `.planning/…/guard-fates.json` — the registry: header pins, `derivationNote`, and the tracer row with its harness-written `observedRed`.
- `.planning/…/evidence/32-tracer-observed-red.md` — raw command, raw output, exit statuses, `git status --porcelain` before and after, commit measured.
- `.planning/…/evidence/32-audited-set-reconciliation.md` — D-02, 593 lines, every figure with its command.
- `.planning/…/deferred-items.md` — one out-of-scope discovery (below).

## Requirement status

`requirements-completed` is **empty on purpose**. The plan's frontmatter names `CUT-04`, but `CUT-04` asks for a recorded, non-vacuously-verified fate for **every** audited guard, and the registry carries **1 of 61**. The guard's own pre-declared red is the standing evidence that the requirement is open. Marking it complete here would be exactly the kind of claim this phase exists to make impossible. `CUT-04` becomes markable when plan `32-08` completes the registry and the guard goes green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `SET_B_FLOOR` is 16 and `TOTAL_FLOOR` is 61, not the planned 15 and 60**

- **Found during:** Task 1, while deriving set B before writing the guard.
- **Issue:** the plan states "22 raw set-B candidates minus 7 already-claimed `newSubject`s = 15", and specifies `SET_B_FLOOR = 15`, `TOTAL_FLOOR = 60`. The raw candidate count **22 reproduces exactly**. The subtraction does not: only **6** of the 22 are already-claimed successors. The 7th path the plan subtracted, `scripts/lib/anno-cli-verbs.d.mts`, is a set-A member's successor but is **not among the 22** — it is an addition between the two commits, yet its content at `345d5c4` carries no mention of the subject, so the set-B content predicate never admits it and there is nothing to subtract it from.
- **Fix:** the floors carry the measured figures, `SET_B_FLOOR = 16` and `TOTAL_FLOOR = 61`, each with the correction and its disproving command recorded in the constant's own comment. `evidence/32-audited-set-reconciliation.md` §7.1 records the full arithmetic.
- **Disproving commands:**
  ```
  $ git diff --name-only --diff-filter=A 0394cbc 345d5c4 | grep -x 'scripts/lib/anno-cli-verbs.d.mts'
  scripts/lib/anno-cli-verbs.d.mts          # it IS an addition
  $ git show 345d5c4:scripts/lib/anno-cli-verbs.d.mts | grep -aoi anno | wc -l
  0                                          # but it fails the content predicate
  ```
- **Why not write 15 anyway:** the guard asserts `setB.length !== SET_B_FLOOR` as an error, so a floor of 15 against a derivation of 16 would red the guard permanently, on a fabricated number, in the one file whose entire purpose is refusing fabricated evidence. The plan's own instruction — "no figure is copied … without re-running its command" — points the same way.
- **Files modified:** `scripts/check-guard-fates.mjs`, `.planning/…/guard-fates.json`, `evidence/32-audited-set-reconciliation.md`.
- **Commits:** `371750e`, `7cf922e`.

**2. [Rule 1 — Bug] The forward map is 21 same-path / 15 renamed / 7 gone, not 21 / 16 / 6**

- **Found during:** Task 1 (measured), documented in Task 3.
- **Issue:** the plan's §4 states 21 / 16 / 6. Measured, **seven** set-A paths absent from `345d5c4` have no mechanically derivable successor — no git-detected rename and no name-descendant existing at `AUDIT_END`: `anno-launch`, `anno-mcp-client`, `anno-project`, `anno-session`, `anno-symbol-roundtrip`, `anno-upstream-audit`, `anno-verify` (all `.test.ts`). Calling any of them "renamed" would need a hand-typed map, which the guard forbids.
- **Fix:** recorded as 21 / 15 / 7 with all three groups enumerated in the reconciliation §4.1-4.3. No floor depends on the split — it is descriptive. Related: the plan names **five** renames git's `-M` heuristic misses; measured **seven** (adding `scripts/lib/anno-cli-verbs.d.mts` and `src/mcp/vice/spawn-seam.test.ts`), and the name-descendant predicate is recorded as authoritative over git's output.
- **Commits:** `371750e`, `7cf922e`.

**3. [Rule 1 — Bug] `.planning/research/PITFALLS.md:36`'s "21 `anno-*.test.ts` files" is 19**

- **Found during:** Task 3.
- **Issue:** measured 19; `CUT-04`'s own "19 `anno-`named" is the figure that reproduces. (36 is the count of all `anno-`prefixed files under `src/mcp/vice/`, tests and non-tests together.)
- **Fix:** corrected in the reconciliation §2.4 with both commands. Nothing depends on the 21 — `SET_A_FLOOR` is built on 19 + 13 + 11. Separately, `PITFALLS.md:36`'s 13 per-file counts turned out to match this document's **lines-with-a-hit** column for **all 13 files**, so the two documents differ only by counting definition; §2.3 states which definition each uses rather than leaving them contradicting.
- **Commit:** `7cf922e`.

**4. [Rule 2 — Missing Critical] A NUL byte was written into `scripts/check-guard-fates.mjs` and removed**

- **Found during:** Task 1, immediately after the first write, when a plain `grep -n` on the file returned nothing.
- **Issue:** a comment about NUL handling accidentally embedded a literal NUL, which makes `grep` treat the whole source file as binary and silently print no matches. That is precisely the failure this repo has already hit once (`anno-memmap-render.ts` needs `grep -a`) — and it would have made every future `grep`-based census of this guard silently skip it.
- **Fix:** `perl -i -pe 's/\x00//g'`, and the comment now says `U+0000`. The reconciliation document carries an explicit `grep -a` warning for the same reason.
- **Commit:** `371750e`.

**5. [Rule 3 — Blocking] `src/mcp/vice/node_modules` was absent in the worktree**

- **Found during:** Task 2, at the first `npm run typecheck` (`tsc: not found`).
- **Issue:** `node_modules/` is gitignored and provisioned by a SessionStart hook that had only run against the main checkout, so no worktree executor has it.
- **Fix:** `npm ci --no-audit --no-fund` from the **committed** lockfile, after verifying with `cmp` that the worktree's `package-lock.json` is byte-identical to the main checkout's. 237 packages, 6s. No new package was named or installed. (A symlink was tried first and rejected: `.gitignore`'s `node_modules/` is a directory-only pattern, so a symlink shows up as untracked and would have dirtied the harness's tree baseline.)
- **Files modified:** none tracked.

**6. [Scope] Verification commands re-anchored to the worktree root**

- Every `<automated>` block in the plan hardcodes `cd /home/henrik/dev/henrik/git/c64-re-tools`, which is the **orchestrator's** checkout and does not contain these commits. All checks were run from `$(git rev-parse --show-toplevel)` = `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e` instead. The exact commands run are quoted in "Verification results" below.
- Task 1's verify additionally diffs `git status --porcelain` against a hardcoded four-file list (`docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`). **None of those four exists in this worktree** — they are untracked scratch files in the orchestrator's checkout only. The harness compares against a baseline captured at its own process start, which is the check that actually matters, and it reported `tree: restored byte-identical to the baseline`.

---

**Total deviations:** 6 — 4 auto-fixed measured-figure corrections and defects (3 × Rule 1, 1 × Rule 2), 1 blocking fix (Rule 3), 1 scope re-anchoring.
**Impact on plan:** the three figure corrections change three numbers and no architecture. The registry, the guard and the harness are exactly the artifacts the plan specifies. Downstream plans `32-06`/`32-07`/`32-08` inherit `43 / 16 / 2 = 61` instead of `43 / 15 / 2 = 60`; they add rows and do not pin the total, so nothing in them breaks, but the arithmetic they quote should be updated from this document rather than from the plan.

## Verification results (all re-anchored to the worktree root)

| Check | Command | Result |
|---|---|---|
| Tracer | `node scripts/audit-mutation-harness.mjs --row src/mcp/vice/anno-verb-coverage.test.ts` | exit **0**; guard status **1**; control status **0**; `tree: restored byte-identical to the baseline` |
| Plant reverted | `git diff --stat -- scripts/lib/anno-cli-verbs.mjs` | empty |
| Fate guard | `node scripts/check-guard-fates.mjs` | `FAIL -- setA=43 setB=16 setC=2 total=61 rows=1`, 60 named orphans — **the pre-declared red** |
| `--root` refusal | `node scripts/check-guard-fates.mjs --root /tmp` | `REFUSED`, names `/tmp` and the repo root, exit 1 |
| `--root` typo | `node scripts/check-guard-fates.mjs --root ./nonexistent-inside-typo` | `TYPO, not a containment refusal`, exit 1 (no ENOENT stack) |
| Selector: none | `node scripts/audit-mutation-harness.mjs` | `USAGE … got 0`, exit 2 |
| Selector: two | `… --all --row <p>` | `USAGE … got 2`, exit 2 |
| Selector: unknown | `… --rows src/mcp/vice/not-in-registry.test.ts` | `matched 0 registry row(s)`, names the entry, exit 1 |
| Selector: `--rows` | `… --rows src/mcp/vice/anno-verb-coverage.test.ts --out <scratch>` | `measured 1 row(s)`, observed red |
| ASVS greps | `grep -c 'NODE_TEST_' … ; grep -c 'shell: *true' … ; grep -c 'execSync' …` | **4** / **0** / **0** |
| Subject discipline | `grep -ac 'the external analyser'` on all four in-scope new files + both `.d.mts` | **0** each |
| Floors present | `grep -Ec 'SET_A_FLOOR\|SET_B_FLOOR\|SET_C_FLOOR\|TOTAL_FLOOR' scripts/check-guard-fates.mjs` | **27** (≥ 4) |
| No typed members | `grep -c 'src/mcp/vice/anno' scripts/check-guard-fates.mjs` | **0** |
| Non-vacuity test | `cd src/mcp/vice && node --test guard-fates.test.ts` | **21/21 pass** |
| Typecheck | `cd src/mcp/vice && npm run typecheck` | exit 0 |
| No new CI step needed | `cd src/mcp/vice && node --test ci-suite-coverage.test.ts` | 10/10 pass |
| Removal gate | `node scripts/check-no-analyser.mjs` | `OK -- scanned 406 files (376 tracked … floor 350)`; every exact exemption pin unmoved |
| Audit gate | `node scripts/audit-gate.mjs --json` | `allowed: true redGuards: [] structuralErrors: [] guards: 9` |
| Other CI checks | `check-npm-packages`, `check-skill-tool-coverage`, `check-skill-fork-honesty`, `check-skill-description-overlap`, `check-skill-cli-invocations` | all `OK` |
| Harness not in CI | `grep -n 'audit-mutation-harness' .github/workflows/ci.yml src/mcp/vice/package.json` | no match |
| Not in `files[]` | `grep -c 'guard-fates' src/mcp/vice/package.json` | **0** |
| Task 3 checks | `git ls-tree -r --name-only 0394cbc -- src/mcp/vice scripts \| wc -l` = **273**; `grep -c '0394cbc' <doc>` = **19**; `grep -c '345d5c4' <doc>` = **18**; `grep -c 'src/mcp/vice/' <doc>` = **92** | all pass |
| Suite | `cd src/mcp/vice && npm run test:automated` | 2941 tests, **2934 pass / 1 fail / 1 skipped / 5 todo** — the single failure is environment-bound, see below |

## Issues Encountered

**`npm run test:automated` reports one failure, and it is the worktree, not this plan.**

```
not ok 1472 - path agreement (D-3, D-6, THE regression this task exists to catch):
  … and the agreed path is not under .claude
```

`src/mcp/vice/repo-root.test.ts:248-251` asserts `!supervisorDir().includes(".claude")`. A GSD worktree's repository root **is** `<repo>/.claude/worktrees/agent-*`, measured directly:

```
repoRoot:       …/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e
supervisorDir:  …/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/.vice-supervisor
includes .claude: true
```

The assertion is structurally unsatisfiable in any worktree at that path, and nothing in this plan touches `repo-root.ts`, `vice.ts`, `install-resources.ts` or the launcher. Per the executor scope boundary it was **logged, not fixed**, at `.planning/phases/32-the-deletion-and-the-grep-gate/deferred-items.md`, with attribution, the measurement, why loosening the assertion inside a phase about guard vacuity would be the wrong trade, and two suggested owners. **Every phase-32 worktree executor will see this same single failure.** Re-run the suite from the merged main checkout to confirm the zero-failure floor.

**TDD note (Task 2).** The runtime tests passed on the first run because the predicate they exercise landed with the **tracer** in Task 1 — that is the tracer pattern working as designed, not a skipped RED. The genuine RED for Task 2 was `npm run typecheck` failing with `TS7016` for both `.mjs` imports, which is what commit `8963964` records and what `eadba0b` turns green.

## Known Stubs

None. Every artifact this plan created is wired and exercised: the guard runs and reports measured numbers, the harness has produced real evidence, the registry's one row carries a machine-captured `observedRed`, and the test drives the real predicate.

The guard's pre-declared **red** is not a stub — it is the plan's stated design (`<objective>`: "EXPECTED to exit non-zero from this commit until plan 32-08 completes the registry"), and it is deliberately absent from CI until `32-09` wires it, in the wave after the registry goes green.

`plant.kind` currently implements only `"worktree"`; an unrecognised kind is a named hard failure, not a silent skip. The synthetic-fixture (`--root`) route lands with `32-06`/`32-07`, the plans whose rows need it.

## Threat Flags

None. The plan's `<threat_model>` mitigations are all in place and grep-verified: argv arrays only with no `shell: true` and no `execSync` (T-32-01), `resolveContainedRoot()` on every `--root` and every plant target (T-32-02), byte-preserving capture plus idempotent restore-on-exit and a baseline tree comparison (T-32-03), `observedRed` written only from a captured `spawnSync` result with a non-zero-integer `exitStatus` and a zero-exit control required (T-32-04), and every `NODE_TEST_*` key stripped from the child env with a 15s `SIGKILL` timeout and fail-closed `result.error` mapping (T-32-05). No package manager was invoked to add a dependency (T-32-SC) — `npm ci` reinstalled the committed lockfile unchanged.

## Next Phase Readiness

- **Ready.** The machine works, and every later plan in this phase drives it rather than re-deriving it: add rows to `guard-fates.json`, then `node scripts/audit-mutation-harness.mjs --rows <the rows that plan owns> --out <that plan's evidence file>`.
- **Blockers / must-knows for the sweep plans:**
  1. The arithmetic is **43 / 16 / 2 = 61**, not 43 / 15 / 2 = 60. Read it from `evidence/32-audited-set-reconciliation.md` §9 or from the guard's own constants, not from `32-01-PLAN.md`.
  2. **`32-08` must add `fetch-depth: 0`** to `.github/workflows/ci.yml`'s `actions/checkout@v4` step in or before the commit that wires this guard into CI. Without it neither pinned commit exists on the runner and the guard fails closed — correctly, but for the wrong reason.
  3. The 7 members with no mechanically derivable successor (Deviation 2) need a per-row `deleted`-vs-`superseded` judgement against `29-21-SUMMARY.md:176-259`.
  4. `deferred-items.md` explains the one suite failure every worktree executor in this phase will hit.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*

## Self-Check: PASSED

All 11 created files verified present on disk (6 source, 5 planning artifacts). All 5 commits verified present in `git log`: `371750e`, `8963964`, `eadba0b`, `7cf922e`, `d4b5f06`. No `.planning/STATE.md` or `.planning/ROADMAP.md` modification (worktree mode — the orchestrator owns those writes).
