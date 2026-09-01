---
created: 2026-09-01
source: phase-32 code review round 4 (32-REVIEW.md at de598f2), the nine finding ids that
  round 4 raised and no earlier round dispositioned — CR-07, WR-37, WR-38, WR-39, WR-40,
  IN-16, IN-17, IN-18, IN-19. None fixed. Recorded here so every id has a disposition and
  none is silently lost. CR-07 is a Critical and is a REPEAT deferral, not a new finding —
  see "The CR-07 record" below.
severity: blocker
resolves_phase:
---

# Phase 32 review round 4 — 9 findings, disposition: OPEN, not fixed

## Why this file exists

`/gsd-execute-phase 32 --gaps-only` ran its required `execute:post` code-review gate after
gap-closure round 3 (plans 32-20 and 32-21) merged. The review is advisory by contract and
does not block the phase, but `docs-review-disposition.test.ts` went red the moment the
round-4 `32-REVIEW.md` was written:

```
finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): CR-07
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): IN-16
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): IN-17
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): IN-18
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): IN-19
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): WR-37
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): WR-38
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): WR-39
  32-REVIEW.md (32-the-deletion-and-the-grep-gate): WR-40
```

`audit-integrity.test.ts:234` ("no milestone audit declares a gated status while any docs
guard is red", D-12-02) fails as a **downstream consequence of the same single red** —
`scripts/audit-gate.mjs` reports all nine `docs-*.test.ts` guards as red when its one
invocation exits non-zero. Measured individually at de598f2, with the broker `inactive`:

| guard | exit | pass | fail |
|---|---|---|---|
| `docs-absorbed-decisions` | 0 | 5 | 0 |
| `docs-core-value-decision` | 0 | 6 | 0 |
| `docs-dangling-refs` | 0 | 8 | 0 |
| `docs-deferred-ledger` | 0 | 6 | 0 |
| `docs-fork-decision` | 0 | 6 | 0 |
| `docs-linerefs` | 0 | 12 | 0 |
| `docs-uat-abstention` | 0 | 8 | 0 |
| `docs-worktree-isolation` | 0 | 5 | 0 |
| `docs-review-disposition` | **1** | 6 | **1** |

So: **one root cause, two failing tests.** The eight green guards are green; the cascade in
`audit-gate.mjs`'s message is an attribution artefact, not nine defects.

They are dispositioned **here**, not by editing a SUMMARY or `32-VERIFICATION.md`, for the
reason `2026-08-31-phase-32-review-twenty-five-open-findings.md` already gives: those files
are evidence written by the agent that did the work, and editing them from the orchestrator
seat to turn a guard green is fact-laundering. A todo is the guard's own documented
alternative and survives re-verification.

**This is a tracking record, not a fix.** Full evidence — every reproduction driven through
the production code, with verbatim output — is in
`.planning/phases/32-the-deletion-and-the-grep-gate/32-REVIEW.md`. Do not re-derive it here;
read it there.

## The CR-07 record — a repeat deferral that briefly vanished

CR-07 is a **Critical**, and the round-4 report describes it as "carried forward from round 3,
untouched". That is not quite right, and the correction matters more than the finding does.
Traced through every revision of `32-REVIEW.md`:

| commit | round | CR-07 present? |
|---|---|---|
| `203fb6d` | (round 1) | no |
| `05ca6c6` | 2 | **yes** — "`audit-root-args.test.ts` deletes and repopulates `installer/skills/` five times while four other test files read it, under a parallel test runner" |
| `e35af74` | 3 | **no** — dropped, not closed |
| `de598f2` | 4 | **yes** — re-raised and re-verified live |

CR-07 was raised in round 2, was **absent from round 3's report without ever being fixed or
dispositioned**, and is back in round 4. Nothing in the phase closed it; round 3's report
simply did not carry it. That omission is also *why the disposition guard was green between
`e35af74` and `de598f2`* — an unresolved Critical stopped being counted because it stopped
being written down.

That is precisely the failure mode this phase's own criterion 1 exists against. It is recorded
here so the next reader sees the gap in the record rather than inheriting it. **CR-07 has now
been open and unaddressed across three review rounds.**

## Disposition: OPEN, out of scope for the round that produced them

All nine were found *by* the review that runs at the tail of `/gsd-execute-phase`, after both
round-3 plans (32-20, 32-21) had merged, so no plan in this round could have addressed them.
Closing them is a further gap-closure round (`/gsd-plan-phase 32 --gaps` →
`/gsd-execute-phase 32 --gaps-only`), not a repair belonging to the waves just executed.

### The findings

**CR-07 (Critical) — `audit-root-args.test.ts:928-948`, `check-skill-cli-invocations.mjs:266-271`,
`installer/scripts/sync-skills.mjs:74-80`.** The adjacency-accept loop spawns the CLI-invocations
gate five times per run; each spawn takes the `P.root === DEFAULT_ROOT` branch and drives an
`rmSync(DEST, {recursive:true, force:true})` + `cpSync` rebuild of `installer/skills/`, while
`ci-suite-coverage`, `anno-verb-coverage`, `skill-attribution` and `removal-gate` read that
same tree under a ~120-file concurrent runner. `installer/skills/` is gitignored, so no
porcelain assertion in the suite — `attributablePorcelainDelta()` included — can see it. Not
observed failing (the suite was green twice on 2026-09-01), so it is a latent scheduling
hazard rather than a broken build.

**WR-38 — `audit-harness-restore.test.ts:1209-1215`.** The assertion labelled "the one that must
never change" passes with containment removed entirely. A guard that cannot be made to fail has
not been re-pointed — this phase's own success criterion, self-applied and currently unmet at
this one site. Rank this above the other warnings when a round 4 is planned.

**WR-37 — `audit-mutation-harness.mjs:543-560`, `:761`, `:808`.** Plan 32-15's deliverable was
that one bad descriptor is reported against its row instead of aborting the sweep. The
containment was built around `plant()` only, so a bad `guard.cwd`, a bad `guard.argv` or a
missing `guard` still aborts the whole sweep and leaves every later row unmeasured and
unreported — the exact defect the comment at `:779-792` claims was fixed.

**WR-39 — `audit-harness-restore.test.ts:217-305, 462-464`.** `attributablePorcelainDelta()`'s
docblock claims it proves "the harness did not write outside the scratch root it was pointed
at". It reads porcelain *after* the child exits, by which point the restore handler has undone
every capture, so what it actually proves is "no write escaped the scratch root **and survived
restoration**". The stated claim is wider than the measurement.

**WR-40 — `audit-harness-restore.test.ts:331-489` vs `:642-813`, third partial copy at `:933-998`.**
`runDisarmAttempt()` is a ~110-line near-duplicate of `runAttempt()`; the WR-28 fix already had
to be written twice. The docblock argues the split is deliberate and its reason holds for the
attempt-log assertions, but not for the shared spawn/poll/compare scaffolding.

**IN-16 — `plant-contract-driver.mjs:246-254`.** The comment claims the
`bytesAtMatchIndexBase64`/`recordedReplacementBase64` pair detects "the harness writing bytes
the row does not record". Both sides go through the same truncating `latin1` encode, so for a
non-latin1 descriptor they truncate identically and compare equal. Measured: with the CR-11
refusal deleted, `non-latin1-refused` reports `planted=true`, `bytesEq=true`. The pair does
discriminate the `$&` class it is actually used for.

**IN-17 — `audit-harness-restore.test.ts:1027-1117`.** The driver's contract states
`pendingRestoreCount()` is 1 after an accepted plant and 0 after a refused one. Five refused
cases assert the 0 half; none of the three accepted cases asserts the 1 half, so an accepted
plant that failed to register its original for restoration would pass.

**IN-18 — `audit-mutation-harness.mjs:1171-1175`.** `--out` is resolved outside any try/catch and
*after* the registry write-back, so a bad value surfaces as a bare `uncaughtException` with no
`REFUSED --` prefix, after the registry has already been rewritten. Separately
`join(root, "/tmp/x")` silently reinterprets an absolute `--out` as root-relative.

**IN-19 — `audit-mutation-harness.mjs:397-405`.** `text.split(find).length - 1` counts
non-overlapping matches, so a self-overlapping `find` reports 1 where a hand scan finds 2,
contradicting the refusal text's ambiguity claim. Measured: 0 of 35 committed `find` strings
self-overlap, so nothing is currently mis-planted.

## What the review did not find

Bounding how much of round 3 this calls into question: the round-4 report confirms CR-09,
CR-10, CR-11, WR-27, WR-28, WR-29, WR-34 and WR-36 — the eight ids plans 32-20 and 32-21 were
written to close — and the post-merge gate on the merged tree was green (`typecheck` exit 0;
`test:automated` 3021 pass / 0 fail, broker `inactive`) *before* this review report existed.
Both round-3 plans' own bite proofs were captured RED and GREEN. The nine findings here are
additions to the backlog, not a retraction of round 3.
