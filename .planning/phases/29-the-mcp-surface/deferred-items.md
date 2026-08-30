# Phase 29 — deferred items

Out-of-scope discoveries logged rather than fixed, per `execute-plan.md`'s scope
boundary. Nothing here was introduced by this phase's changes.

## 1. `STORE-03`'s traceability status contradicts its own prose (Phase 28, pre-existing)

Found by plan 29-11 while cross-checking `.planning/REQUIREMENTS.md`'s
traceability table against `ROADMAP.md`'s per-phase `**Requirements**:` lines.

- The table row reads `| STORE-03 | Phase 28 | Complete |`.
- The paragraph three screens below it — the round-6 verifier's own authorising
  sentences — reads *"`STORE-03` STAYS `Gaps Found`, and its blocker is now
  `CR-10` rather than `CR-09`"*, and quotes the verifier: *"The third does not:
  the partial-overwrite behaviour for the four split members is pinned to an
  outcome that discards every recorded target."*

One of the two is wrong. Plan 29-11 did **not** change it: the row predates this
phase, belongs to Phase 28, and per prohibition 28-18 P2 a row moves only on a
verification verdict — which is exactly the rule that would be broken by an
executor of a different phase editing it on its own reading. Route it to a Phase
28 verification pass or a milestone audit.

*Logged 2026-08-30 by plan 29-11.*

## 2. `repo-root.test.ts`'s "not under `.claude`" assertion fails inside a GSD worktree

Found by plan 29-14 while running `npm run test:automated`. **Not caused by
this plan** — it touches none of the five files 29-14 changed.

`repo-root.test.ts:178` ("path agreement (D-3, D-6, THE regression this task
exists to catch)") asserts the agreed supervisor directory does not sit under
`.claude`. Every GSD worktree in this repo is created at
`.claude/worktrees/agent-<id>/`, so `repoRoot()` legitimately resolves there and
the assertion fails:

```
the agreed directory must not sit under .claude -- got
/home/henrik/.../.claude/worktrees/agent-a09c6a143211b29cb/.vice-supervisor
(the exact regression a naive move would introduce)
```

Confirmed to be a worktree-location artifact rather than a defect: the same file
run in the MAIN checkout is **6/6 green**. The assertion is guarding against a
real regression (a supervisor dir landing under a config directory) and its
wording is correct for a normal checkout — it simply cannot distinguish "the
supervisor dir moved under `.claude`" from "the whole worktree is under
`.claude`". Any fix belongs to whoever owns `repo-root.test.ts`, not to a plan
about CLI path confinement; a plausible shape is to exempt a path whose
`.claude` segment is followed by `worktrees/`.

Consequence for this phase's gate: the `test:automated` failing-file **set**
inside a worktree is `repo-root.test.ts` where `29-BASELINE.md` records
`audit-integrity.test.ts` + `r2000-session.test.ts`. See 29-14's summary for the
full reconciliation of all three names.

*Logged 2026-08-30 by plan 29-14.*
