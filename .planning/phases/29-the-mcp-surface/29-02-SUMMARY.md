---
phase: 29-the-mcp-surface
plan: 02
subsystem: testing
tags: [ci-gate, structural-guard, npm-pack, git-ls-files, planted-violation, attribution, cut-02, cut-03]

requires:
  - phase: 29-the-mcp-surface
    provides: "plan 29-01's anno-tools.ts and the moved registration-time guards, which the gate's scope predicate had to account for alongside the surviving r2000-* modules"
provides:
  - "scripts/check-no-regenerator2000.mjs — the removal gate: a whole-tree-minus-.planning scan unioned with the shipped installer tarball, with 8 exact-count exemption classes and a dated 49-entry temporary allow-list"
  - "packFiles() as an export of scripts/check-npm-packages.mjs, plus an entry-point guard so importing it does not run that script's whole driver"
  - "src/mcp/vice/removal-gate.test.ts — four planted evasion routes, the attribution false-positive control, and a behavioural binary-safety proof, all through the gate's own exported predicate"
  - "src/mcp/vice/fixtures/planted-removal-fixture.{ts,md}.txt — committed planted bodies, documented in fixtures/README.md"
  - ".planning/phases/29-the-mcp-surface/29-BASELINE.md — the measured pre-phase baseline: failing-file SET, corrected blast radius, and the corrected form of assumption A1"
affects: [29-05, 29-07, 29-09, 29-10, 29-11, 29-12]

actuals:
  tokens: 16825
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "scope predicate = (git ls-files minus a PREFIX) UNION packFiles(pkg) — tracked AND shipped, because a --cached predicate is blind to a gitignored-but-published tree"
    - "exported scan predicate + exported needle, so the planted-violation test drives the same rule the real scan runs"
    - "needle joined from two fragments at module scope, so a gate's own source needs no content exemption for itself"
    - "bidirectional block-count pin: deleting the prose an exemption protects TRIPS the gate rather than silencing it"
    - "entry-point guard on a CI script whose helper another script imports"

key-files:
  created:
    - scripts/check-no-regenerator2000.mjs
    - scripts/check-no-regenerator2000.d.mts
    - src/mcp/vice/removal-gate.test.ts
    - src/mcp/vice/fixtures/planted-removal-fixture.ts.txt
    - src/mcp/vice/fixtures/planted-removal-fixture.md.txt
    - .planning/phases/29-the-mcp-surface/29-BASELINE.md
  modified:
    - scripts/check-npm-packages.mjs
    - .github/workflows/ci.yml
    - src/mcp/vice/fixtures/README.md

key-decisions:
  - "The gate's own driver is guarded by an entry-point check, and so is check-npm-packages.mjs's — an imported helper must not pack two packages, run every assertion and process.exit(1) from inside an `import` statement."
  - "Two exemption classes the plan did not enumerate were required and added: `surviving-provenance` (10 files whose mentions are past-tense provenance or references to the upstream project, and which NO plan in this phase discharges) and `gate-self` (the gate, its declarations, its test, the fixtures README and the CI step). Without them those files would have had to sit in a temporary allow-list that plan 29-11 must be able to empty."
  - "Allow-list entries carry an EXACT hit count as well as a path and a discharging plan, because plans 29-10 and 29-12 are already written against that behaviour ('the gate asserts every allow-list class count EXACTLY')."
  - "The discharging-plan id set is DERIVED from the phase directory's own *-PLAN.md filenames, not typed, so 29-05 is accepted for exactly the reason 29-09/29-10/29-11 are."
  - "29-RESEARCH.md's step-5 plant (edit installer/skills/ directly) is unreachable by construction and was replaced with a strictly stronger one: an UNTRACKED file under src/skills/, which git ls-files cannot see, sync-skills.mjs copies and npm ships."
  - "Assumption A1 is corrected rather than confirmed: the full-glob run does not terminate — it blocks forever in vice-proxy.test.ts (25 min elapsed against 3 s of CPU) and must be bounded."

patterns-established:
  - "Baseline discipline: the phase gate compares the failing-file SET by name, never a count against zero; a name leaving the set must be EXPLAINED, not banked."
  - "Observed-red transcript: a structural guard ships with a recorded plant-run-revert transcript per evasion route plus a false-positive control, in the plan summary, before the deletion it guards."
  - "A guard whose planted violation no longer reddens has not been re-pointed — proven here by running each control rather than by inspecting the code."

requirements-completed: [CUT-02, CUT-03, MCP-05]

coverage:
  - id: D1
    description: "The removal gate exists, is green over the untouched tree, reports 395 scanned files and a per-class breakdown, and cannot pass vacuously (scanned-file floor, per-class exact counts, shipped-tree non-vacuity)."
    requirement: CUT-02
    verification:
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#the predicate scans the path as well as the content, and reports a path occurrence as the sentinel 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate bites on all four evasion routes — a src/mcp/vice/*.ts body, a docs/*.md body, a scripts/*.mjs body, and a SHIPPED installer/skills/** body that git ls-files cannot see — each reported with its line number."
    requirement: CUT-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#planted violation, route (a): a `src/mcp/vice/*.ts` module body is reported, with the line number"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#planted violation, route (b): a `docs/*.md` body outside the exemption set is reported, with the line number"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#planted violation, route (c): a `scripts/*.mjs` body is reported, with the line number"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#planted violation, route (d): a shipped `installer/skills/**/SKILL.md` body is reported, with the line number"
        status: pass
      - kind: manual_procedural
        ref: "29-02-SUMMARY.md ## The seven-step observed-red transcript, steps 2-5'"
        status: pass
    human_judgment: false
  - id: D3
    description: "CUT-03: deleting one attribution block from THIRD-PARTY-NOTICES.md TRIPS the gate, and with every attribution block untouched the gate exits 0."
    requirement: CUT-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#CUT-03 non-vacuity: deleting the attribution block turns its occurrences into unexempted ones"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#false-positive control: an occurrence inside a shape-matched attribution block is exempt, and one outside it is not"
        status: pass
      - kind: manual_procedural
        ref: "29-02-SUMMARY.md ## The seven-step observed-red transcript, steps 6 and 7"
        status: pass
    human_judgment: false
  - id: D4
    description: "The gate is binary-safe: it reads and decodes bytes in-process, so the one occurrence in the NUL-carrying memmap renderer at line 79 — which GNU grep refuses to read — is reported."
    requirement: CUT-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/removal-gate.test.ts#binary safety: the one occurrence in the NUL-carrying memmap renderer is reported, in-process"
        status: pass
      - kind: manual_procedural
        ref: "29-02-SUMMARY.md ## Control A — the binary-safety criterion, run with the exemption removed"
        status: pass
    human_judgment: false
  - id: D5
    description: "The dated temporary allow-list fails on an entry naming a path that is not on disk, on an entry naming a plan that is not one of this phase's, and on a count that moved without its pin."
    requirement: CUT-02
    verification:
      - kind: manual_procedural
        ref: "29-02-SUMMARY.md ## Controls B, C and E — the allow-list assertions"
        status: pass
    human_judgment: false
  - id: D6
    description: "packFiles() is exported from check-npm-packages.mjs and that script still exits 0; MCP-05's reuse-rather-than-reimplement constraint is satisfied."
    requirement: MCP-05
    verification:
      - kind: other
        ref: "node scripts/check-npm-packages.mjs"
        status: pass
      - kind: other
        ref: "grep -c 'export function packFiles(' scripts/check-npm-packages.mjs"
        status: pass
    human_judgment: false
  - id: D7
    description: "The pre-phase baseline is a recorded number and a recorded set of names, with the broker's state, the measured wall time, and the corrected blast radius."
    verification:
      - kind: other
        ref: "test -s .planning/phases/29-the-mcp-surface/29-BASELINE.md && grep -qE '^\\|?[^|]*full glob' ... && grep -qE 'fail(ing|ures)?:? *[0-9]+' ..."
        status: pass
    human_judgment: false

duration: 41 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 02: The Removal Gate, Observed Biting Before Anything Is Deleted Summary

**A CI gate whose scope is `(git ls-files − .planning/) ∪ packFiles("installer")` — 395 files, tracked AND shipped — with eight exact-count exemption classes, a dated 49-entry allow-list keyed to the plans that discharge it, and a recorded transcript of it going red on four evasion routes and on a deleted attribution block, all landed while every file it guards is still present.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-08-29T14:09Z
- **Completed:** 2026-08-29T14:50Z
- **Tasks:** 3 of 3
- **Files created/modified:** 9 (6 created, 3 modified)

## Accomplishments

- **The gate exists and is green, and its greenness is not vacuous.** It scans 395 files against a measured floor of 350, prints a per-class breakdown on success, and asserts an exact hit count per exemption class — a count that has *grown* is the shape of "an exemption used to hide a reintroduction" and fails.
- **The shipped-tree blind spot is closed, and the closure is proven.** `git ls-files installer/skills` returns **0** while 8 files there mentioning the subject (27 occurrences) are shipped in `@henols/c64-re-tools`. The `packFiles("installer")` half of the scope predicate supplies those 30 paths; the route-(d) plant fires on `installer/skills/…`, a path a `--cached` predicate cannot see at all.
- **CUT-03's failure mode is made impossible rather than merely discouraged.** Deleting one attribution block from `THIRD-PARTY-NOTICES.md` — the cheapest way to silence a false fire — drops both the file's pinned attribution-block count and its pinned hit count, and the gate reports *both*.
- **The gate is binary-safe by construction and by observation.** With only the memmap exemption removed it names `src/mcp/vice/r2000-memmap-render.ts:79`; `grep -c` on that file prints nothing and exits 1 while `grep -ac` prints 1. A grep-backed implementation exits 0 there and would have let a real occurrence survive its own removal check.
- **Assumption A1 is corrected, not confirmed.** The full-glob suite does **not** take ~660 s and then finish: it blocks forever in `vice-proxy.test.ts`. The baseline records the bounded procedure that produces a usable number, and the failing-file **set** the phase gate compares against.

## Task Commits

1. **Task 1: Record the pre-phase full-glob baseline** — `c0a91bc` (docs)
2. **Task 2: Build the removal gate — scope predicate, exemptions, non-vacuity counters** — `4bfafe4` (feat)
3. **Task 3: Observe the gate bite — four plants, exemption non-vacuity, false-positive control** — `0e31252` (test)

## Files Created/Modified

- `scripts/check-no-regenerator2000.mjs` — the gate. Exports `SUBJECT_NEEDLE` (joined from two fragments so its own source carries no contiguous literal), `subjectHits(relPath, text)` (the scan predicate — path **and** content, one entry per occurrence, `0` sentinel for a path hit), `attributionBlocks(text)` and `isInsideAttributionBlock(text, line)`. Driver guarded by an entry-point check.
- `scripts/check-no-regenerator2000.d.mts` — ambient declarations so the colocated test typechecks under `strict`, following the `scripts/lib/r2000-cli-verbs.d.mts` precedent.
- `src/mcp/vice/removal-gate.test.ts` — 8 tests: four planted routes, the path-half of the predicate, the attribution false-positive control, the CUT-03 block-deletion control, and the behavioural binary-safety proof. Imports the gate's predicates; never re-derives them; never writes the literal into its own source.
- `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` / `.md.txt` — the committed planted bodies for routes (a) and (b).
- `src/mcp/vice/fixtures/README.md` — new "Planted-violation fixtures" section naming both fixtures, the guard they belong to, and the prefix-exemption pin.
- `scripts/check-npm-packages.mjs` — `packFiles` exported; driver wrapped in an entry-point guard (two inserted lines, no reindentation).
- `.github/workflows/ci.yml` — the gate wired in beside the other `check-*.mjs` scripts.
- `.planning/phases/29-the-mcp-surface/29-BASELINE.md` — the measured baseline.

## What the gate reports on this tree

```
check-no-<subject>: OK -- scanned 395 files (365 tracked outside ".planning/"
  + 30 shipped-but-untracked installer paths, floor 350);
  118 occurrence(s) permanently exempt, 312 temporarily allow-listed across 49 entries.
  permanent exemptions (exact pins):
    gate-self                            5
    findings-docs                        47
    attribution-guard-test               12
    upstream-audit-manifest-provenance   3
    memmap-measurement-provenance        1
    surviving-provenance                 21
    planted-fixtures                     2
    notices-attribution-blocks           27
  temporary allow-list by discharging plan (opened 2026-08-29, must be EMPTY at phase close):
    29-05                                97
    29-09                                65
    29-10                                150
```

## The seven-step observed-red transcript

Recorded verbatim. This is a transcript artifact, not an assertion: the
project's convention is that a structural guard is proven by a planted
violation observed red and reverted, never by inspection.

### Step 1 — the gate is GREEN over the untouched tree

```
exit: 0
check-no-<subject>: OK -- scanned 395 files (365 tracked outside ".planning/" + 30 shipped-but-untracked installer paths, floor 350); 118 occurrence(s) permanently exempt, 312 temporarily allow-listed across 49 entries.
```

### Step 2 — PLANT 1 (`.ts`): `src/mcp/vice/anno-tools.ts`

```
exit: 1
check-no-<subject>: FAIL
  - src/mcp/vice/anno-tools.ts:397: the removed static-analysis integration is named here. It is neither covered by a permanent exemption nor by the dated temporary allow-list, so this is a reintroduction (CUT-02). If this mention is legitimate and permanent, add a path- or block-scoped exemption WITH an exact hit count; if it is discharged later in this phase, add a dated allow-list entry naming the plan that discharges it. Do not widen an existing exemption to cover it.
reverted; git status for that path: ''
```

### Step 3 — PLANT 2 (`docs/`): `docs/phase0-binmon-findings.md`

```
exit: 1
check-no-<subject>: FAIL
  - docs/phase0-binmon-findings.md:212: the removed static-analysis integration is named here. It is neither covered by a permanent exemption nor by the dated temporary allow-list, so this is a reintroduction (CUT-02). ...
reverted; git status for that path: ''
```

### Step 4 — PLANT 3 (`scripts/`): `scripts/audit-gate.mjs`

```
exit: 1
check-no-<subject>: FAIL
  - scripts/audit-gate.mjs:1220: the removed static-analysis integration is named here. It is neither covered by a permanent exemption nor by the dated temporary allow-list, so this is a reintroduction (CUT-02). ...
reverted; git status for that path: ''
```

### Step 5 — PLANT 4 as scripted: it CANNOT fire, and the reason is the design working

```
$ git ls-files installer/skills | wc -l  ->  0   (the plant a tracked-files predicate cannot see)
sync-skills: copied 7 skill(s) into .../installer/skills: acme-build, c64-memory-mapping, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage
   [plant appended to installer/skills/vice-wedge-triage/SKILL.md]
exit: 0
```

The gate's own scope acquisition calls `packFiles("installer")`, which runs
`npm pack --dry-run`, which runs the installer's `prepack` hook, which runs
`sync-skills.mjs` — and that **overwrites `installer/skills/` from
`src/skills/` before a single byte is read**. The property `29-RESEARCH.md`
wanted ("post-sync BY CONSTRUCTION — a 'remember to sync first' predicate can
forget; this one cannot") is exactly what erases an out-of-band plant in the
shipped tree. A plant the gate reverts before reading is not a violation the
gate can see — and it is also not a violation a **user** can receive.

### Step 5′ — the CORRECTED plant for the same route, observed red

The reintroduction that actually reaches a user through the shipped tree
originates in `src/skills/` and is **untracked**: `git ls-files` is blind to it,
`sync-skills.mjs` copies it, npm ships it. That is the exact blind spot the
`packFiles()` union exists to close.

```
$ git ls-files src/skills/vice-wedge-triage/references/planted-shipped-route.md  ->  ''   (untracked, invisible to a --cached predicate)
exit: 1
check-no-<subject>: FAIL
  - installer/skills/vice-wedge-triage/references/planted-shipped-route.md:3: the removed static-analysis integration is named here. It is neither covered by a permanent exemption nor by the dated temporary allow-list, so this is a reintroduction (CUT-02). ...
reverted (file removed, sync re-run); gate: exit 0
```

### Step 6 — EXEMPTION NON-VACUITY (CUT-03): one attribution block deleted

Deleting the `## Upstream MIT permission notice` section from the repo-root
`THIRD-PARTY-NOTICES.md`:

```
exit: 1
check-no-<subject>: FAIL
  - CUT-03: THIRD-PARTY-NOTICES.md carries 1 shape-matched attribution block(s), expected exactly 2. A LOWER count means an attribution block was deleted -- which is the cheapest way to silence a false fire and is exactly what this gate exists to make impossible. A HIGHER count means the exemption just widened.
  - CUT-03: THIRD-PARTY-NOTICES.md accounts for 1 exempted occurrence(s) inside its attribution blocks, expected exactly 3.
reverted; git status for that path: ''
```

### Step 7 — FALSE-POSITIVE CONTROL: every attribution block untouched

Step 6 without step 7 proves only that the gate is noisy.

```
exit: 0
check-no-<subject>: OK -- scanned 395 files ... 118 occurrence(s) permanently exempt, 312 temporarily allow-listed across 49 entries.
```

### Working-tree state afterwards

Every plant was reverted. `git status --porcelain`, restricted to tracked
paths, listed only this plan's own staged artifacts at the time of the
transcript, and is **empty** after the Task 3 commit:

```
$ git status --porcelain | grep -v '^??' | wc -l
0
```

*Caveat, stated rather than hidden:* the unrestricted `git status --porcelain`
is not empty — the repository carries a set of untracked, pre-existing
directories (`.claude/`, `.codex/`, `.gsd/`, `.agents/`, `skills-lock.json`,
three untracked `docs/*.md`) that were present before this plan began and were
not touched by it. No plant left anything behind.

## Additional controls run beyond the seven steps

### Control A — the binary-safety criterion, run with the exemption removed

With **only** the `memmap-measurement-provenance` exemption removed and nothing
else touched:

```
exit: 1
check-no-<subject>: FAIL
  - src/mcp/vice/r2000-memmap-render.ts:79: the removed static-analysis integration is named here. ...
```

and the grep blindness that makes this criterion meaningful:

```
$ grep -c  'regenerator2000' src/mcp/vice/r2000-memmap-render.ts   # (no output) exit 1
$ grep -ac 'regenerator2000' src/mcp/vice/r2000-memmap-render.ts   # 1           exit 0
```

Exemption restored → `exit 0`.

### Controls B, C and E — the allow-list assertions

**B — an entry naming a path that does not exist:**

```
exit: 1
  - temporary allow-list (opened 2026-08-29): src/mcp/vice/anno-cli.ts is allow-listed for plan 29-05 but is NOT on disk. Either the file was renamed -- in which case the plan that renamed it must re-point this entry in the same commit as the `git mv` -- or it was deleted and this entry must go with it.
  - temporary allow-list: src/mcp/vice/anno-cli.ts is pinned at 3 occurrence(s) for plan 29-05, got 0. ...
```

**C — an entry naming a plan that is not one of this phase's:**

```
exit: 1
  - temporary allow-list: CLAUDE.md names discharging plan "30-04", which is not one of this phase's plans (29-01, 29-02, 29-03, 29-04, 29-05, 29-06, 29-07, 29-08, 29-09, 29-10, 29-11, 29-12). Every temporary entry must have an owner.
```

That list is **derived from the phase directory's own `*-PLAN.md` filenames**,
which is why `29-05` is accepted for exactly the reason `29-09`, `29-10` and
`29-11` are.

**E — the allow-list emptied entirely:** 312 errors, firing on every class it
covers — the 29-05 rename set (`r2000-cli.ts`, `r2000-spawn-seam.test.ts`,
`docs-r2000-decisions.test.ts`, `module-classification.ts`, …), the 29-09 skill
set (`README.md`, `src/skills/**`, and the shipped `installer/skills/**`
mirrors), and the 29-10 deletion set (`r2000-launch.ts`, `r2000-tools.ts`,
`vice-proxy.ts`, `CLAUDE.md`, …).

## The exemption set, and why each member is permanent

| Class | Members | Pinned | Why it keeps the name forever |
|---|---|---|---|
| `gate-self` | the gate, its `.d.mts`, its test, `fixtures/README.md`, the CI step | 5 | carries the subject only as part of the gate's own **filename** |
| `findings-docs` | `docs/phase9-…-probe-findings.md` (44, incl. its path), `docs/phase23-real-release-gate-findings.md` (3) | 47 | dated records of a past investigation; true in the past tense |
| `attribution-guard-test` | `src/mcp/vice/skill-attribution.test.ts` | 12 | it must name the subject to police prose about the subject |
| `upstream-audit-manifest-provenance` | `src/mcp/vice/r2000-upstream-audit.test.ts` | 3 | names an **upstream project** that is not deleted, not an integration that is. **29-05 re-points this** |
| `memmap-measurement-provenance` | `src/mcp/vice/r2000-memmap-render.ts:79` | 1, at line 79 | records that three query result shapes were measured live against a real pinned-version child. **29-05 re-points this** |
| `surviving-provenance` | 10 files: `docs/stock-vice-parity.md`, `scripts/check-npm-packages.mjs`, `scripts/lib/skill-descriptions.mjs`, `acme-gate.ts`, `disasm-roundtrip.test.ts`, `docs-dangling-refs.test.ts`, `prg-image.ts`, `shipped-modules.ts`, `skill-acme-build-cli.test.ts`, `stock-symbols.ts` | 21 | past-tense provenance, or references to the upstream project rather than to this repo's integration. **No plan in this phase removes any of them** |
| `planted-fixtures` | `src/mcp/vice/fixtures/planted-*` | 2 | exist to be scanned by the test, not by the gate |
| `notices-attribution-blocks` | 3 notices trees, **block-scoped** | blocks 2/4/3, hits 3/17/7 | CUT-03's protected prose |

That is **18 files** that legitimately keep the word forever — matching
`29-RESEARCH.md`'s "~18" estimate exactly, arrived at independently.

## Decisions Made

1. **`check-npm-packages.mjs`'s driver gets an entry-point guard** (two inserted lines, no reindentation). The plan said "add `export` and change nothing else about it", but an unguarded import would pack both packages, run every assertion, and `process.exit(1)` from inside an `import` statement — which no caller can catch. Since plan 29-09's `<automated>` invokes the removal gate directly, an unrelated red in `check-npm-packages` would have surfaced as a *removal gate* failure three waves later. The gate got the same guard for the same reason: `removal-gate.test.ts` imports its predicates.
2. **Two exemption classes beyond the plan's enumeration.** `surviving-provenance` and `gate-self`. See "Deviations" below — this was forced, not preferred.
3. **Allow-list entries carry exact counts.** Plans 29-10 and 29-12 are already written against that behaviour ("the gate asserts every allow-list class count EXACTLY (29-02 Task 2)"), and every plan that touches an allow-listed file already carries the gate in its `files_modified`.
4. **The discharging-plan id set is derived from disk**, guarded by a "≥ 10 plan files while the allow-list is non-empty" non-vacuity assertion, so the acceptance is a fact about the phase rather than a typed list that can silently stop accepting a plan.
5. **The `.d.mts` follows the `scripts/lib/r2000-cli-verbs.d.mts` precedent** — a CI-only declaration file, out of `package.json`'s `files[]`, so the colocated test typechecks while importing a `.mjs`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocker] `packFiles` could not be imported without running the whole `check-npm-packages` driver**

- **Found during:** Task 2
- **Issue:** `scripts/check-npm-packages.mjs` executes its entire driver at module scope and calls `process.exit(1)` on failure. Adding only `export` — the plan's literal instruction — would have made the removal gate pack both npm packages, run every leak/closure/notices assertion, and die inside an `import` on any unrelated failure, misattributed to the gate.
- **Fix:** wrapped the driver in `if (IS_ENTRY_POINT) { … }` (two inserted lines, zero reindentation, block-identical body) and added `resolve` to the existing `node:path` import. The same guard was applied to the new gate for the same reason.
- **Files modified:** `scripts/check-npm-packages.mjs`, `scripts/check-no-regenerator2000.mjs`
- **Verification:** `node scripts/check-npm-packages.mjs` exits 0; `import('./scripts/check-npm-packages.mjs')` resolves with `packFiles` and no side effects; `import('./scripts/check-no-regenerator2000.mjs')` likewise.
- **Committed in:** `4bfafe4`

**2. [Rule 2 — Missing critical] The plan's exemption enumeration did not cover 10 files that no plan in this phase discharges**

- **Found during:** Task 2
- **Issue:** The plan lists six exemption classes and says everything else goes in the temporary allow-list, which "must be EMPTY at the phase's close" (asserted by 29-11). But 10 files carry mentions that are past-tense provenance or references to the **upstream project** rather than to this repo's integration — `docs/stock-vice-parity.md`, `scripts/check-npm-packages.mjs`, `scripts/lib/skill-descriptions.mjs`, `acme-gate.ts`, `disasm-roundtrip.test.ts`, `docs-dangling-refs.test.ts`, `prg-image.ts`, `shipped-modules.ts`, `skill-acme-build-cli.test.ts`, `stock-symbols.ts` — and **no plan in phase 29 touches or removes any of them**. Allow-listing them would have made 29-11's "block is empty" assertion unsatisfiable; omitting them would have made the gate red on the untouched tree.
- **Fix:** added a `surviving-provenance` exemption class (path-scoped, exact per-path counts, 21 occurrences) and a `gate-self` class (5) covering the gate, its declarations, its test, the fixtures README and the CI step — files whose only mention is the gate's own filename.
- **Files modified:** `scripts/check-no-regenerator2000.mjs`
- **Verification:** gate exits 0; the "emptied allow-list" control (E) still fires on all four discharge classes; the file total (18 permanently-exempt files) independently reproduces `29-RESEARCH.md`'s "~18 legitimately keep the word forever".
- **Committed in:** `4bfafe4`

**3. [Rule 1 — Bug in the plan's own procedure] Step 5's plant is unreachable by construction**

- **Found during:** Task 3
- **Issue:** `29-RESEARCH.md` step 5, restated in the plan, says: run `sync-skills.mjs`, plant in `installer/skills/<skill>/SKILL.md`, run the gate, record that it fires. It does **not** fire. The gate's scope acquisition itself runs `npm pack --dry-run`, whose `prepack` hook re-runs `sync-skills.mjs` and overwrites the plant before any byte is read. The very property that makes `packFiles` the right choice ("post-sync by construction") is what makes that plant invisible.
- **Fix:** replaced it with a strictly stronger plant for the same route — an **untracked** file under `src/skills/vice-wedge-triage/references/`, which `git ls-files` cannot see, `sync-skills.mjs` copies, and npm ships. The gate fires naming `installer/skills/vice-wedge-triage/references/planted-shipped-route.md:3`, a path no tracked-files predicate can reach. Both the failed original and the corrected plant are recorded in the transcript above, because "the plant did not fire" is the load-bearing finding.
- **Files modified:** none (procedure only; the plant was reverted)
- **Verification:** step 5′ in the transcript; gate returns to exit 0 after revert.
- **Committed in:** `0e31252` (the route-(d) unit test in `removal-gate.test.ts` encodes the same route permanently)

**4. [Rule 1 — Falsified assumption] Assumption A1's "~660 s" is wrong: the full glob does not terminate**

- **Found during:** Task 1
- **Issue:** `29-RESEARCH.md` A1 asked for exactly one re-measurement of the "~660 s, ~44-failure" figure carried from project memory. Measured: the run produces all its output in ~120 s and then blocks **forever** in `vice-proxy.test.ts` (25 minutes elapsed against 3 seconds of CPU — blocked, not spinning). It is one of the nine `MANUAL_ONLY_TESTS` and waits on a broker/emulator that is not present.
- **Fix:** recorded the corrected behaviour in `29-BASELINE.md` together with the bounded procedure that yields a usable number (background run → wait for output to go quiet → `kill -TERM` the blocked child → collect the summary), and flagged that `vice-proxy.test.ts`'s 41 failures are a **lower bound** because it was terminated part-way.
- **Files modified:** `.planning/phases/29-the-mcp-surface/29-BASELINE.md`
- **Verification:** measured wall time 1578 s with exit 1; failing-file set recorded by name.
- **Committed in:** `c0a91bc`

---

**Total deviations:** 4 auto-fixed (1× Rule 3 blocker, 1× Rule 2 missing-critical, 2× Rule 1 bug/falsified-assumption).
**Impact on plan:** No scope creep. Deviations 1 and 2 were required for the gate to be usable and green at all; 3 and 4 are corrections to procedures and figures the plan explicitly asked to be re-measured against this tree rather than copied from a research document — which is exactly the instruction that surfaced them.

## Issues Encountered

- **The full-glob suite blocks indefinitely** — see deviation 4. Resolved by bounding the run and killing the one blocked child. This is now documented in `29-BASELINE.md` as the standing procedure for this phase.
- **The measured blast radius differs from every prior figure.** `29-CONTEXT.md`/`CUT-02` say 291/55, `29-RESEARCH.md` says 339/61; measured at `c27922a` it is **347 files tracked / 59 outside `.planning/`, 396 occurrences**. Plan 29-01 landed between research and this measurement. `29-BASELINE.md` records the corrected figures and the measurement method.
- **Two pre-existing failing files are in the baseline, not regressions:** `audit-integrity.test.ts` (2 — census assertions pinning audit totals that legitimately grow per milestone) and `r2000-session.test.ts` (5 — load-sensitive FIFO-queue timing tests, and on plan 29-10's deletion set, so its 5 will leave the set *by construction*, which 29-10 must say rather than report as an improvement).

## Known Stubs

None. No stub, TODO, FIXME, skipped test or unrun `<verify>` was introduced by this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema at a trust boundary was introduced. The gate only `readFileSync()`s and matches; the one subprocess it causes (`npm pack --dry-run` via `packFiles`) already ran in `check-npm-packages.mjs` on every CI run, and the script `prepack` executes is first-party and tracked (`T-29-08`, disposition **accept**).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready.** Nothing has been deleted. Every downstream plan now has:

- a **green, non-vacuous gate in CI** that will red the moment a reintroduction lands, on any of four routes, tracked or shipped;
- a **recorded failing-file set** to compare against, so "is this green?" has a defined answer;
- a **staleness contract stated in the gate's own header**, so plan **29-05**'s executor finds the obligation — re-point every path-scoped entry (exemption *and* allow-list) in the same commit as the `git mv`, together with any hit count that moved with it — in the file it is already editing.

Obligations this plan hands forward, each already named in the gate's own text:

| Plan | Obligation |
|---|---|
| 29-05 | re-point 14 allow-list entries and the 2 permanent exemptions it renames, counts included, in the same commit as the `git mv` |
| 29-09 | discharge its 18 allow-list entries (10 `src/skills/`+`README`+`check-skill-fork-honesty`, 8 shipped mirrors) |
| 29-10 | discharge its 17 allow-list entries; explain `r2000-session.test.ts`'s 5 baseline failures leaving the set by deletion |
| 29-12 | move `anno-memmap-render.test.ts`'s allow-list count with its pin |
| 29-11 | assert the temporary allow-list block is **empty** |

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commit hashes
(`c0a91bc`, `4bfafe4`, `0e31252`) verified present in `git log`; the gate and
`removal-gate.test.ts` both re-run at exit 0 after the final commit.
