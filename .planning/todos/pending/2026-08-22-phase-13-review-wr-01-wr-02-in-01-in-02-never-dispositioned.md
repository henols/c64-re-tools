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
