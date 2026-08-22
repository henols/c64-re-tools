---
created: 2026-08-22T01:20:00.000Z
title: Phase 13's 13-REVIEW.md WR-01, WR-02, IN-01, IN-02 were never dispositioned
area: planning
priority: low
files:
  - .planning/phases/13-external-verification/13-REVIEW.md
  - .claude/mcp/vice/probe-binmon.mjs
  - .claude/mcp/vice/docs-review-disposition.test.ts
  - .claude/gsd-core/workflows/code-review.md
resolves_phase: 15
---

## Problem

Four findings in `13-REVIEW.md` — `WR-01`, `WR-02` (Warning) and `IN-01`, `IN-02` (Info)
— have no disposition beyond `13-VERIFICATION.md` naming them as a gap. No todo covered
them, no SUMMARY cited them as accepted, and no source fix addressed them.

**This is structural, not an oversight by any plan.** The code-review gate runs *after*
every plan in the phase has produced its SUMMARY — including plan 13-05, whose entire job
was ledger reconciliation (`13-REVIEW.md` is timestamped 00:56:11Z; 13-05's SUMMARY was
written at 00:42:39Z). A phase therefore cannot, by construction, disposition findings
that do not exist until after it has closed. The same shape produced
`2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned` and
`2026-08-21-phase-09-review-in-01-in-03-never-dispositioned`; this is the third instance,
which makes the pattern itself the more interesting half of this todo (see below).

Note on the guard's state: `docs-review-disposition.test.ts` went red the moment
`13-REVIEW.md` was committed with four undispositioned ids, and went green again when
`13-VERIFICATION.md` was written naming all four — a phase's own `*-VERIFICATION.md` is
one of the guard's five recognised disposition sources. So the guard is green today, but
via "the verifier noticed", not via a recorded decision. That is exactly the silence the
guard exists to catch, one level up.

## The four findings

- **`WR-01`** — `checkCommandAvailable()` in `probe-binmon.mjs:1486-1489` interpolates its
  argument into a shell string (`spawnSync("sh", ["-c", \`command -v ${cmd}\`])`). Not
  exploitable today: one call site, hardcoded literal (`checkCommandAvailable("c1541")`).
  But it is the shell-interpolation anti-pattern this file avoids everywhere else
  (`spawnSync("c1541", [...])` with an argv array two functions below), and widening the
  helper to a caller-derived binary name would silently create a real injection surface.
  **The review contains the two-line fix already** — argv-array spawn, no shell.
- **`WR-02`** — `probe-binmon.mjs` is now 2429 lines across five usage modes (wire
  builders/parsers, offline `--selftest`, the 13-check live probe, `--capture`, and this
  phase's new `--probe-assumptions`); phase 13 alone added ~860 lines. Correctness is
  unaffected (typechecks, selftest passes, suite green) but a sixth probe lands in the
  same file by default. Suggested split: `probe-assumptions.mjs`, mirroring the existing
  `binmon-fixtures.ts` extraction.
- **`IN-01`** — `probeA3JoyportBits()` (`probe-binmon.mjs:1454-1477`) short-circuits on
  `clearedInDc00 || clearedInDc01`, so a bit clearing correctly in one CIA1 port while a
  conflicting signal appears in the other would report a clean match and never surface in
  `polarityNotes`. A3's verdict was INCONCLUSIVE, so this ambiguity may already be
  present unnamed in the raw data. Diagnostic tooling, not shipped logic.
- **`IN-02`** — `fixtures/backend-detect/{fork,stock}-help-transcript.txt` were part of
  the phase diff (1920 and 1828 added lines) and are the byte-for-byte evidence the
  reviewed `.json` sidecars and `backend-detect.test.ts` depend on, but were omitted from
  the `files:` list the review was scoped to. The reviewer read them anyway and confirmed
  the `-mcpserver`/`-binarymonitor` counts match both sidecars and `13-PROBE-RESULTS.md`,
  so this review's conclusions stand — but a future invocation trusting `files:` literally
  would review sidecars without reading the transcripts they describe.

## Recommended disposition

- **`WR-01`: fix at source.** The fix is written, the file is not shipped runtime code
  (`probe-binmon.mjs` is evidence tooling), and it removes a latent injection pattern
  rather than documenting one. Cheapest of the four by a wide margin.
- **`WR-02`: defer with intent.** A split is right, but doing it now would rewrite the
  file that produced this phase's committed probe transcripts — the same evidence-immutability
  argument that governs `2026-08-21-phase-09-review-in-01-in-03-never-dispositioned`. Best
  done when a sixth mode is actually added, which is the moment the cost becomes real.
- **`IN-01`: fix only if A3 is re-probed.** A3 is the one assumption still carrying its
  `[ASSUMED]` label (INCONCLUSIVE), so a re-probe is plausible; tighten
  `polarityNotes` to report both ports independently *before* that re-run, not after,
  or the same ambiguity recurs in the new evidence.
- **`IN-02`: fix in the workflow, not the phase.** The scoping omission is in
  `code-review.md`'s file-list derivation, not in anything phase 13 built. Matched
  `.txt`/`.json` evidence pairs should be scoped as a unit.

## The transferable half

Three phases have now filed the same todo. The gate ordering guarantees it: `execute-phase`
runs `code_review_gate` after the last plan's SUMMARY, so no plan can ever disposition its
own phase's review findings. Either the review gate should move earlier (before the final
ledger-reconciling plan), or `execute-phase` should file this todo automatically when
`REVIEW.md` lands with `status: issues_found` and no disposition source names its ids —
turning a recurring manual catch into the mechanical step the disposition guard already
assumes exists. That is the actual fix; this todo is the third symptom.

## Resolution

Phase 15 plan 15-05 executed this todo's own four per-finding recommendations exactly.

**`WR-01`: already fixed at source — confirmed, not re-implemented.** Direct source
inspection (`probe-binmon.mjs:1493-1496`, current line numbers) shows `checkCommandAvailable()`
passes the binary name as a positional shell argument (`spawnSync("sh", ["-c", 'command -v
"$1"', "sh", cmd], ...)`), never spliced into the command line, with a comment at the fix
site forbidding the reversion. Landed in commit `f73d0fa` (`fix(13): close 13-REVIEW.md WR-01
— drop shell interpolation from checkCommandAvailable`), which predates this plan and was
verified live at plan time — 15-RESEARCH.md's row calling for a two-line fix here was stale.
`probe-binmon.mjs` was not touched by this plan (`git diff --stat` over it is empty across
every commit). Pinned durably: a new derived source-level gate in `stock-connect.test.ts`
("13-REVIEW.md WR-01 pin...") scans every top-level production `.ts`/`.mjs` file in
`.claude/mcp/vice` (`readdirSync`-derived, not hand-typed) for the forbidden shape — a `"-c"`
shell argument followed by a template literal containing `${` — so the class of defect fails
the test suite, not only a future code review. Confirmed non-vacuous: a scratch `.mjs`
containing the interpolated form was added to `.claude/mcp/vice`, `node --test
stock-connect.test.ts` failed naming that exact file and snippet, and the scratch file was
then deleted and the suite reconfirmed green (39/39).

**`WR-02`: deferred with intent, per the todo's own recommendation.** `probe-binmon.mjs` is
currently 2435 lines (was 2429 when this todo was filed — grown by 6, not shrunk) across the
same five usage modes. Splitting it now would rewrite the file that produced Phase 13's
committed probe transcripts, the same evidence-immutability argument governing
`2026-08-21-phase-09-review-in-01-in-03-never-dispositioned`. Reopen trigger, stated
precisely: do the `probe-assumptions.mjs` split when a sixth probe mode is actually added —
not before.

**`IN-01`: wont-fix for now, with a named trigger.** Confirmed live: `probeA3JoyportBits()`
(`probe-binmon.mjs:1465`) still short-circuits on `clearedInDc00 || clearedInDc01`. This
matters only if A3 is re-probed, and A3 is `INCONCLUSIVE` today with its `[ASSUMED]` label
still on `stock-input.ts`'s `JOYPORT_BITS` (confirmed: `13-PROBE-RESULTS.md` records A3
INCONCLUSIVE, "the `[ASSUMED]` label must stay on"). Reopen trigger, stated precisely: tighten
`polarityNotes` to report both CIA1 ports independently *before* any A3 re-probe is run, not
after, or the same ambiguity recurs unnamed in the new evidence.

**`IN-02`: promoted out of this repo, with a named owner.** Confirmed: the scoping omission is
in `.claude/gsd-core/workflows/code-review.md`'s `files:` derivation (the review-target file
list), not in anything Phase 13 built — this project's source is not the place to fix it.
Matched `.txt`/`.json` evidence pairs should be scoped as a unit in that workflow's file-list
derivation. Owner: **plan 15-12**, which records this promotion in `REQUIREMENTS.md` -> Future
Requirements; this todo's job ends at stating the verdict and handing it over by name.

| Id | Verdict | Evidence or trigger | Owner |
|----|---------|----------------------|-------|
| WR-01 | fixed (already landed, now pinned) | Commit `f73d0fa`; positional-argument form confirmed live at `probe-binmon.mjs:1493-1496`; pinned by `stock-connect.test.ts`'s derived `readdirSync` gate, proven non-vacuous by a planted scratch-file violation | — |
| WR-02 | deferred with intent | Reopens when a sixth probe mode is added to `probe-binmon.mjs` (currently 2435 lines, five modes) | — |
| IN-01 | wont-fix for now | Reopens if A3 is re-probed — tighten `polarityNotes` to report both CIA1 ports independently *before* that re-probe runs | — |
| IN-02 | promoted out of this repo | GSD tooling fix, not a phase-13/this-repo fix | plan 15-12 (`REQUIREMENTS.md` -> Future Requirements) |
