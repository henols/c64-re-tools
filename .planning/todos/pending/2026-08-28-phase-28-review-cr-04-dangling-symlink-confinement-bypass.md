---
created: 2026-08-28
source: phase-28 code review (28-REVIEW.md), finding CR-04 — the one id
  docs-review-disposition.test.ts reported undispositioned in all five of the
  sources it accepts
severity: critical
---

# Phase 28 review, CR-04 — disposition

## Why this file exists

`docs-review-disposition.test.ts` (the self-applied AUDIT-01 guard) reported, standalone at
`HEAD` immediately after `28-REVIEW.md` was regenerated over the gap-closure commits:

```
finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:
  28-REVIEW.md (28-the-store-core): CR-04
```

One id, one phase. Every other finding in that review — `CR-01` through `CR-03`, `WR-01`
through `WR-11`, `IN-01` through `IN-04` — is named in a phase-28 `*-SUMMARY.md` or in
`28-VERIFICATION.md` and is therefore already dispositioned. `CR-04` is not, because it did
not exist until the re-review: it is a **new** finding raised against the very code that
plan 28-09 wrote to close verification gap 3.

This file is that disposition. It records the finding as **open and unfixed**, with the
reason, so the guard reports a deliberate state rather than silence.

## What CR-04 is

`storePathWithinWorkspace`'s new real-path comparison walks to the deepest *existing*
ancestor using `existsSync`. `existsSync` follows symlinks and returns `false` for a
**dangling** one, so the walk steps straight *past* a dangling symlink instead of stopping
at it and resolving it. The confinement check then compares a path the filesystem will
later resolve somewhere else entirely.

Reproduced by the reviewer against committed code:

```
A) confinement ACCEPTED
A) file created OUTSIDE workspace: true
```

That is the same class of escape the verifier originally logged as gap 3 / `CR-03`: a store
file created outside the workspace root with no refusal. Plan 28-09 closed the **live**
symlink half — all six cases in `anno-confinement.test.ts` plant live links — and left the
dangling half open. So gap 3 is **partially**, not fully, closed.

## Why it is not fixed here

It was found by the `execute:post` code-review gate, which runs *after* every plan in the
phase has been executed and summarised. Fixing it inside this run would mean editing shipped
source with no plan, no planted-red control and no `<verify>` block — precisely the
unplanned-edit shape this project's workflow exists to prevent, and a poor trade for a
one-line-looking fix whose test surface (dangling links, broken chains, links whose target
appears between the check and the open) is the part that actually needs designing.

## What resolving it requires

- `realpathOfNearestExisting` must stop at a path entry that **is** a symlink, dangling or
  not, rather than at the first path entry that fails `existsSync`. `lstatSync` distinguishes
  the two; `existsSync` cannot.
- `anno-confinement.test.ts` needs the dangling-link case added alongside its six live-link
  cases, with the planted red observed — the current suite passes against the broken code,
  which is why this shipped.
- The over-refusal control must be kept: an inside-pointing link, live or dangling, must
  still be followed.

Track alongside the other three blockers the same review raised (`CR-01` two stores sharing
one snapshot ring, `CR-02` the reconciliation sweep deleting a concurrent writer's published
snapshot, `CR-03` the absolute `anno_snapshot.path`). All four are in `28-REVIEW.md` with
reproductions.
