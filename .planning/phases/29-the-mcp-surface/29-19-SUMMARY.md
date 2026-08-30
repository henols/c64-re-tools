---
phase: 29-the-mcp-surface
plan: 19
subsystem: testing
tags: [ci-gates, anno-cli, skills, required-flags, typescript-declarations, wr-01]

requires:
  - phase: 29-the-mcp-surface
    provides: "29-16's invocation gate (scripts/check-skill-cli-invocations.mjs + scripts/lib/anno-cli-invocations.mjs) and its committed proof test — this plan repairs the axis that gate was blind on"
  - phase: 29-the-mcp-surface
    provides: "anno-cli.ts's VERB_OPTIONS and its two REQUIRED-flag refusal branches, read as the source of every REQUIRED_FLAGS value"
provides:
  - "`REQUIRED_FLAGS` — a per-verb required-flag table whose every value is read off the CLI's own refusal branch, quoted beside it"
  - "`checkInvocation()`'s third check: a documented command missing a REQUIRED flag is reported by name and exits the gate non-zero"
  - "`POSITIONAL_KINDS` moved out of the import-time-executing gate script into the import-safe lib, so the committed test asserts against the table CI runs"
  - "`PROBLEM_ORDER` — a declared, asserted problem-report order (unknown-verb short-circuit, then flag membership, then positional kinds, then required flags)"
  - "a structural control that fails if the gate script ever re-declares either table locally"
  - "the hand-written .d.mts declaration in step with the four-parameter signature, observed red-then-green"
affects: [phase-29-plan-20, phase-30-anno-export-asm, phase-32-skill-sweep, any-future-anno-verb]

actuals:
  tokens: 12983
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "declaration tables live in the import-safe lib, not in a gate script that runs at import time — one definition, two callers (the gate and its test), so a fixture copy cannot drift from the shipped map"
    - "a required-parameter .d.mts declaration as a compile-time gate: making the fourth parameter optional would have removed the check the plan existed to add"
    - "an exported PROBLEM_ORDER constant the ordering test asserts against, so a refactor that reorders the control flow is caught rather than silently accepted"

key-files:
  created: []
  modified:
    - scripts/lib/anno-cli-invocations.mjs
    - scripts/lib/anno-cli-invocations.d.mts
    - scripts/check-skill-cli-invocations.mjs
    - src/mcp/vice/anno-cli-invocations.test.ts

key-decisions:
  - "The two declaration tables moved into scripts/lib/anno-cli-invocations.mjs rather than being added to the gate script, per <table_location_decision>. No fallback branch was considered — its precondition was already false and the plan recorded it dead."
  - "REQUIRED_FLAGS carries only values visible as a refusal branch in anno-cli.ts; a verb with no such branch would get [] explicitly. Both current verbs have one, so neither entry is empty."
  - "The fourth parameter is declared REQUIRED in the .d.mts, not optional — an optional parameter would let a caller silently skip the presence check."
  - "No second placeholder rule was invented for required flags: presence is a property of the flag TOKEN, so a synopsis spelling `--provenance FILE` is present by construction and isPlaceholder() keeps its single job."
  - "Task 2 committed no code. Both planted shapes were already covered by committed controls, and the plan permits a test addition only if a plant revealed a case they did not cover."
  - "REQUIREMENTS.md deliberately NOT touched — see 'Requirements' below."

patterns-established:
  - "A gate's declaration tables belong wherever its own committed test can import them; a table in a script that self-executes on import is a table the test can only copy"
  - "Prove a type declaration is load-bearing by reverting it alone and quoting the compiler error, rather than asserting it is in the program"

requirements-completed: []

coverage:
  - id: D1
    description: "A documented `anno` command missing a REQUIRED flag fails a gate rather than a review — the gate reports the flag by name and exits non-zero"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#WR-01: an omitted REQUIRED flag is reported by name"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#WR-01: render-memmap's own required flag is checked too, both directions"
        status: pass
      - kind: integration
        ref: "node scripts/check-skill-cli-invocations.mjs with `anno coverage game.prg` planted at routine-queue-walker/SKILL.md:241 — exit 1, names --store in both trees"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate's declaration tables are the ones its committed test asserts against — one definition in the import-safe lib, imported by both the gate and the test"
    requirement: "REPOINT-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#one definition, two callers: the CI gate imports the shipped tables instead of declaring its own"
        status: pass
      - kind: other
        ref: "grep -c 'POSITIONAL_KINDS = Object.freeze' scripts/check-skill-cli-invocations.mjs => 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The new check has been observed both firing and not firing, on two different planted shapes in the live corpus"
    requirement: "REPOINT-01"
    verification:
      - kind: manual_procedural
        ref: "task 2 transcripts 2 and 4 — omitted-flag plant exits 1 naming --store; wrong-positional plant (required flag present) exits 1 naming ONLY the positional"
        status: pass
    human_judgment: false
  - id: D4
    description: "No skill playbook is left changed, in either tree — including the gitignored installer/skills/ twin"
    verification:
      - kind: other
        ref: "git status --porcelain -- src/skills installer/skills => empty; diff -r src/skills/routine-queue-walker installer/skills/routine-queue-walker => exit 0 after re-running sync-skills.mjs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The hand-written .d.mts declaration is in step with the four-parameter signature and all three exported tables, proven by a typecheck observed red-then-green"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck — exit 1 (TS2554 x4, TS2305 x3) with the .d.mts reverted alone; exit 0 restored"
        status: pass
    human_judgment: false
  - id: D6
    description: "REPOINT-01 probe/ordering — an invocation with more than one problem reports all of them in a declared stable order"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#multiple problems are reported in the declared order, stably across runs"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#the unknown-verb case SHORT-CIRCUITS: it is reported alone, never alongside the other three"
        status: pass
    human_judgment: false
  - id: D7
    description: "Non-vacuity in the other direction — every verb in the CLI's own VERB_OPTIONS has a REQUIRED_FLAGS entry, so a verb added later cannot join the gate with its required flags undeclared"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-invocations.test.ts#non-vacuity, the other direction: every VERB_OPTIONS verb has a REQUIRED_FLAGS entry, even an empty one"
        status: pass
    human_judgment: false

duration: 13 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 19: The Invocation Gate Learns to See an Omitted REQUIRED Flag Summary

**`checkInvocation()` gained a third check and a fourth parameter, and the two per-verb declaration tables moved into the import-safe lib — so the gate that reported `OK`, exit 0, for a documented command that exits 1 now names `--store` and exits 1, against tables its own committed test imports from the same module CI does.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-30T16:00:49Z
- **Completed:** 2026-08-30T16:14:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- **WR-01 closed at the cause, not the symptom.** The missing `if` was one line; the reason it was missing is that the gate's declaration tables lived in a script that runs its whole check at import time, so the committed test could only keep a private copy. `POSITIONAL_KINDS` moved into `scripts/lib/anno-cli-invocations.mjs` (carrying its whole CR-04 comment block), `REQUIRED_FLAGS` was added beside it, and the gate and the test now import the same definition.
- **The verifier's exact plant was reproduced and observed biting.** `anno coverage game.prg` at `routine-queue-walker/SKILL.md:241` — the command that returned `OK`, exit 0 — now exits 1 naming `--store`, in both skill trees.
- **A discrimination control proves the check does not fire on everything.** A wrong positional extension with the required flag *present* reports the positional problem only.
- **The `.d.mts` moved in the same commit as the signature, and was proven load-bearing** by reverting it alone and quoting the compiler.
- **Test count 16 → 25**, gate counts unchanged (10 invocations, 20 of 60 files, 2 trees).

## Task Commits

1. **Task 1 (RED): failing controls for an omitted REQUIRED flag** — `f23bd6e` (test)
2. **Task 1 (GREEN): the third check, the moved tables, the declaration** — `0b84ff5` (feat)

Task 2 produced **no commit**: its product is evidence, and its two plants were reverted within the task. Per its step 7 the test file may be changed only if a plant revealed a case the committed controls do not already cover — neither did (the omission is covered by the WR-01 control, the discrimination shape by the existing adjacency control, which asserts exactly one problem while the required flag is present).

_No REFACTOR commit: the GREEN implementation needed no cleanup._

## Files Created/Modified

- `scripts/lib/anno-cli-invocations.mjs` — gained `POSITIONAL_KINDS` (moved), `REQUIRED_FLAGS` (new), `PROBLEM_ORDER` (new), `checkInvocation()`'s fourth parameter and third check; the doc comment's "checks TWO things and only two" became three, enumerated, plus the two things it still does *not* check.
- `scripts/lib/anno-cli-invocations.d.mts` — fourth parameter declared **required**, all three tables declared, header extended with the measurement that makes its own claim a gate.
- `scripts/check-skill-cli-invocations.mjs` — local `POSITIONAL_KINDS` deleted, both tables imported from the lib, fourth argument passed; header and report line corrected to state three checks rather than two.
- `src/mcp/vice/anno-cli-invocations.test.ts` — private `POSITIONAL_KINDS` deleted, shipped tables imported, all four `checkInvocation` call sites re-pointed, nine tests added.

## The `REQUIRED_FLAGS` values and where each was read from

Neither value was guessed. Both are quoted in the table's own comment block:

| Verb | Required flag | Source, quoted from `src/mcp/vice/anno-cli.ts` |
|---|---|---|
| `coverage` | `--store` | `:874` — `"coverage: --store FILE is required -- the annotation store holds the labels, comments and typed ranges, and this verb will not derive its path from <project>."` |
| `render-memmap` | `--provenance` | `:396` — `"render-memmap: --provenance FILE is required"` |

A verb with no visible refusal branch would get `[]` explicitly; both current verbs have one, so neither entry is empty. The committed non-vacuity test asserts every `VERB_OPTIONS` key appears here, and that every flag named as required is one the verb actually accepts.

## Counts, before and after

| Measurement | Before | After |
|---|---|---|
| `node scripts/check-skill-cli-invocations.mjs` exit code | 0 | 0 |
| documented invocations extracted | 10 | 10 |
| skill files with fences / scanned | 20 of 60 | 20 of 60 |
| trees | 2 | 2 |
| verbs covered | 2 (coverage, render-memmap) | 2 (coverage, render-memmap) |
| `node --test src/mcp/vice/anno-cli-invocations.test.ts` | 16 pass / 0 fail, exit 0 | 25 pass / 0 fail, exit 0 |
| `npm --prefix src/mcp/vice run typecheck` | exit 0 | exit **0** |

## Task 1 — the typecheck observed red, then green

**Criterion 7.** After the task was otherwise complete, `scripts/lib/anno-cli-invocations.d.mts` was reverted **alone** to its pre-task content (`git show 6715a75:scripts/lib/anno-cli-invocations.d.mts`):

```
> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json

anno-cli-invocations.test.ts(28,3): error TS2305: Module '"../../../scripts/lib/anno-cli-invocations.mjs"' has no exported member 'POSITIONAL_KINDS'.
anno-cli-invocations.test.ts(29,3): error TS2305: Module '"../../../scripts/lib/anno-cli-invocations.mjs"' has no exported member 'REQUIRED_FLAGS'.
anno-cli-invocations.test.ts(30,3): error TS2305: Module '"../../../scripts/lib/anno-cli-invocations.mjs"' has no exported member 'PROBLEM_ORDER'.
anno-cli-invocations.test.ts(99,77): error TS2554: Expected 3 arguments, but got 4.
anno-cli-invocations.test.ts(128,64): error TS2554: Expected 3 arguments, but got 4.
anno-cli-invocations.test.ts(248,74): error TS2554: Expected 3 arguments, but got 4.
anno-cli-invocations.test.ts(290,64): error TS2554: Expected 3 arguments, but got 4.
anno-cli-invocations.test.ts(359,27): error TS7006: Parameter 'kind' implicitly has an 'any' type.
anno-cli-invocations.test.ts(388,24): error TS18046: 'required' is of type 'unknown'.
```

Exit **1**. Restored, immediately:

```
> @henols/vice-mcp@0.0.0-dev typecheck
> tsc --noEmit -p tsconfig.json
```

Exit **0**.

The plan predicted `TS2554: Expected 4 arguments, but got 3` three times. The realized shape is the mirror image and is **stronger**: because the reverted declaration is the *old* one, the arity error reads `Expected 3 arguments, but got 4` and appears at **four** call sites rather than three (the fourth being the new required-table control at `:290`), and three `TS2305` missing-export errors join it because the declaration file is also what makes the moved tables importable. The plan's measurement was taken mid-edit, before the test's call sites were re-pointed; this one is taken from the finished state. Both establish the same fact — the declaration is genuinely in the typecheck program.

An intermediate observation confirms the plan's exact predicted shape as well. With the `.d.mts` updated but **before** step 4 re-pointed the call sites, typecheck exited 1 with precisely:

```
anno-cli-invocations.test.ts(99,24): error TS2554: Expected 4 arguments, but got 3.
anno-cli-invocations.test.ts(128,10): error TS2554: Expected 4 arguments, but got 3.
anno-cli-invocations.test.ts(248,20): error TS2554: Expected 4 arguments, but got 3.
```

— the three call sites the plan named, at `:99`, `:128` and `:248`. The plan's instruction was that a typecheck exiting 0 at that moment would mean the declaration was not being consulted; it did not exit 0.

## Task 2 — the four transcripts, verbatim

Noise lines from the MCP resource installer and the SQLite experimental warning are elided where marked; nothing else is edited.

### Transcript 1 — baseline, clean tree, gate fixed

```
$ node scripts/check-skill-cli-invocations.mjs
check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) extracted from 20 of 60 skill file(s) across 2 trees (src/skills, installer/skills); 2 verb(s) covered (coverage, render-memmap); every flag checked against anno-cli.ts's own VERB_OPTIONS, every positional against the kinds its loader reads, and every REQUIRED flag for its presence.
EXIT=0
```

### Transcript 2 — the verifier's plant, `anno coverage game.prg` at `routine-queue-walker/SKILL.md:241`

The line `node src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore` was replaced by the verifier's exact spelling, `anno coverage game.prg`.

```
$ node scripts/check-skill-cli-invocations.mjs
check-skill-cli-invocations: FAIL
  - src/skills/routine-queue-walker/SKILL.md: anno coverage: --store is required and is missing -- the command exits non-zero at runtime without it (in: anno coverage game.prg)
  - installer/skills/routine-queue-walker/SKILL.md: anno coverage: --store is required and is missing -- the command exits non-zero at runtime without it (in: anno coverage game.prg)
EXIT=1
```

**This is the exact command that returned `check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) …`, exit 0, for the verifier.** It is now refused by name, and in *both* trees — the gitignored `installer/skills/` twin is regenerated before the scan, so the plant propagated and was caught there too.

### Transcript 3 — reverted, both trees proven clean

```
$ node installer/scripts/sync-skills.mjs
SYNC_EXIT=0
$ diff -r src/skills/routine-queue-walker installer/skills/routine-queue-walker
DIFF_EXIT=0
$ git status --porcelain -- src/skills installer/skills
(empty)
$ node scripts/check-skill-cli-invocations.mjs
check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) extracted from 20 of 60 skill file(s) across 2 trees (src/skills, installer/skills); 2 verb(s) covered (coverage, render-memmap); every flag checked against anno-cli.ts's own VERB_OPTIONS, every positional against the kinds its loader reads, and every REQUIRED flag for its presence.
EXIT=0
```

Invocation count **10**, identical to the transcript-1 baseline.

### Transcript 4 — the discrimination control: required flag PRESENT, positional extension wrong

Planted `node src/mcp/vice/vice-proxy.ts anno coverage game.regen2000proj --store game.annostore` at the same site.

```
$ node scripts/check-skill-cli-invocations.mjs
check-skill-cli-invocations: FAIL
  - src/skills/routine-queue-walker/SKILL.md: anno coverage: positional game.regen2000proj has extension .regen2000proj, which is not one this verb reads (.prg, .raw, .bin) (in: node src/mcp/vice/vice-proxy.ts anno coverage game.regen2000proj --store game.annostore)
  - installer/skills/routine-queue-walker/SKILL.md: anno coverage: positional game.regen2000proj has extension .regen2000proj, which is not one this verb reads (.prg, .raw, .bin) (in: node src/mcp/vice/vice-proxy.ts anno coverage game.regen2000proj --store game.annostore)
EXIT=1
```

**The positional problem only. No spurious required-flag problem** — the new check discriminates rather than firing on everything. Reverted the same way; `diff -r` exit 0, `git status --porcelain -- src/skills installer/skills` empty, gate back to exit 0 / 10 invocations.

## The committed test asserts against the shipped tables

Confirmed, as the `<output>` block requires. `src/mcp/vice/anno-cli-invocations.test.ts` now imports `POSITIONAL_KINDS`, `REQUIRED_FLAGS` and `PROBLEM_ORDER` from `scripts/lib/anno-cli-invocations.mjs` — the same module `scripts/check-skill-cli-invocations.mjs` imports them from — and its private `POSITIONAL_KINDS` declaration is gone. There is no branch to record: `<table_location_decision>`'s fallback was measured dead before execution and deleted, and nothing in execution contradicted that measurement (the import worked on first run).

A **deliberately-wrong local table survives, and only** in `the required-flag check reads the table it is GIVEN, not a hard-coded pair of flag names`, which hands the predicate `{ coverage: ["--out"] }` and asserts `--out` is what gets reported — proving the predicate stayed parameterised — then asserts the same line is sound under the shipped table.

A new structural control, `one definition, two callers`, reads the gate script's source and fails if it ever re-declares either table locally or stops passing `REQUIRED_FLAGS`. Without it, a re-introduced copy would restore exactly the drift this move removed with every behavioural test still green.

## `test:automated` — counts and the failing-file set by name

```
$ npm --prefix src/mcp/vice run test:automated
# tests 2743
# pass 2736
# fail 1
# skipped 1
# todo 5
EXIT=1
```

**Failing-file set: `repo-root.test.ts`, and nothing else.**

```
not ok 1276 - path agreement (D-3, D-6, THE regression this task exists to catch): ...
  location: '.../src/mcp/vice/repo-root.test.ts:178:1'
  error: 'the agreed directory must not sit under .claude -- got
          /home/henrik/.../.claude/worktrees/agent-a2157a9ef86b2f933/.vice-supervisor
          (the exact regression a naive move would introduce)'
```

This is **exactly** the artifact `deferred-items.md` item 2 records, verbatim down to the assertion text: every GSD worktree in this repo is created under `.claude/worktrees/`, so `repoRoot()` legitimately resolves there and the assertion cannot distinguish that from the regression it guards. The plan's own criterion 5 predicts it (*"`repo-root.test.ts` only, per `deferred-items.md` item 2, inside a worktree"*). `repo-root.test.ts` is not among this plan's four modified files.

**On the dispatch brief's "any failure you see is yours" instruction:** the orchestrator's pre-dispatch baseline of 0 failures was measured in the main checkout, where this test is green (deferred-items item 2 records it 6/6 there). The count arithmetic is consistent with the failure being pre-existing and the delta being entirely mine: 2743 − 2734 = **9** new tests, and this plan's test file went 16 → 25 = **+9**. Nothing else moved.

## Other verification gates

| Gate | Result |
|---|---|
| `node scripts/check-skill-tool-coverage.mjs` | exit **0** — 37 vice_* names, 2/2 anno CLI verbs resolved |
| `node scripts/check-npm-packages.mjs` | exit **0** — `@henols/vice-mcp` 78 files, `@henols/c64-re-tools` 34 files / 7 skills |
| `git status --porcelain` (whole tree) | empty |

The two package gates confirm the plan's claim that it changes *what the invocation gate checks*, not *what ships*: both tables live under `scripts/lib/`, which stays out of `src/mcp/vice/package.json`'s `files[]`.

## Decisions Made

- **The tables moved into the lib, unconditionally.** `<table_location_decision>` recorded the fallback as dead by construction and deleted it; execution found the import working on first run, so nothing contradicted that measurement and no fallback was invented.
- **The fourth parameter is declared REQUIRED, not optional.** Making it optional to spare a call site would have removed the check the plan is about. The revert experiment above is what proves the declaration bites.
- **No second placeholder rule.** Presence is a property of the flag *token*, so a synopsis spelling `--provenance FILE` is present by construction; `isPlaceholder()` keeps its single job on positionals. Pinned by the synopsis test.
- **The gate's report line and header were corrected to say three checks.** Leaving them at two would have breached the live 29-14 prohibition inside the plan discharging it — the same reason the lib's `"checks TWO things and only two"` sentence was rewritten rather than commented around.
- **The rewritten doc comment names what it still does not check** — a flag's *value* and a verb's argument *arity* — so it does not acquire a fresh false guarantee the moment it stops being a list of two.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/mcp/vice/node_modules` absent in the worktree, so `tsc` could not run**

- **Found during:** Task 1, recording the pre-task typecheck baseline
- **Issue:** `npm --prefix src/mcp/vice run typecheck` exited **127** with `sh: 1: tsc: not found`. `node_modules/` is gitignored and provisioned by a `SessionStart` hook that never ran for this worktree. Criteria 6 and 7 are unrunnable without it.
- **Fix:** Mirrored the main checkout's already-provisioned tree with `cp -rs` (a directory of symlinks, not a symlinked directory — a bare symlink shows as `?? src/mcp/vice/node_modules` in `git status` because `.gitignore`'s `node_modules/` pattern matches directories, whereas the mirrored directory is ignored cleanly). Verified first that both `package-lock.json` and `package.json` are **byte-identical** between the two checkouts (sha256 `e573bfaf…` and `ac8f4f4f…`), so this installs nothing and resolves exactly what the committed lockfile pins.
- **Not a package-manager install:** no package was added, fetched or substituted, so the plan's `T-29-19-SC` row and the executor's package-legitimacy checkpoint are not engaged.
- **Files modified:** none tracked. `git status --porcelain` is empty.
- **Verification:** typecheck exit 0 immediately afterwards; `git status --porcelain` empty.
- **Committed in:** nothing — environment provisioning, outside the repository.

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** None on scope or content. The fix was required to run two of task 1's acceptance criteria at all, and left no tracked change.

## Issues Encountered

- **The plan's predicted revert-experiment error shape did not match literally, and the difference is reported rather than smoothed over.** The plan predicted `TS2554: Expected 4 arguments, but got 3` three times; the finished-state revert produces the mirror-image arity error at four sites plus three `TS2305`s. Both transcripts are quoted above with the reason, and the plan's exact predicted shape was *also* observed, at the intermediate step where it was originally measured. No criterion is weakened: criterion 7 asks for a non-zero exit naming `checkInvocation`'s call sites, which is what happened.
- **`test:automated` exits 1 in this worktree** on the documented `repo-root.test.ts` artifact. Analysed above; not introduced here, and not banked as a regression.

## Requirements

`requirements-completed` is deliberately **empty**, and `.planning/REQUIREMENTS.md` was deliberately **not** modified.

`REPOINT-01` and `REPOINT-02` are recorded ⚠️ PARTIAL against gap 1, which lists **four** `missing` items. This plan closes exactly **one** of them — `missing[3]`, WR-01. The other three (the path-independent banner, the root-A/root-B `--check` test, and the three user-facing drift-semantics texts) belong to CR-01 and are not this plan's scope. Marking either requirement Complete here would move a status row ahead of the sentence that scores it — precisely the shape the live 29-17 prohibition names. The wave's remaining plans and the next verification round own that call.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for plan 29-20 (wave 2).** This plan read `src/mcp/vice/anno-cli.ts` and never edited it; it is absent from the whole-task diff, so 29-20 owns it uncontested. The four files touched here are disjoint from 29-20's.
- **The gate is green over both skill trees**, verified by running it rather than by reasoning about it, and the invocation count is unchanged — no currently-documented invocation omits a required flag.
- **A future verb inherits the check by construction.** The non-vacuity test fails if a verb joins `VERB_OPTIONS` without a `REQUIRED_FLAGS` entry, so the hole WR-01 found cannot silently reopen for the next verb; an empty array remains a legitimate, explicit answer.
- **Residual, stated rather than implied:** the gate still does not check a flag's *value* or a verb's argument *arity*. Both are named in the predicate's own doc comment so the header does not read as a guarantee it cannot make.

## Self-Check: PASSED

- `scripts/lib/anno-cli-invocations.mjs` — FOUND
- `scripts/lib/anno-cli-invocations.d.mts` — FOUND
- `scripts/check-skill-cli-invocations.mjs` — FOUND
- `src/mcp/vice/anno-cli-invocations.test.ts` — FOUND
- commit `f23bd6e` — FOUND
- commit `0b84ff5` — FOUND
- All 8 of task 1's acceptance criteria re-run and passing; both of task 2's plants re-run, reverted and the tree proven clean in both skill trees.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*
