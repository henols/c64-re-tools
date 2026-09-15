---
quick_id: 260915-mmn
phase: quick-260915-mmn
plan: 01
status: complete
subsystem: docs
tags: [ste100, skill-docs, c64-provenance-diff]
key-files:
  modified:
    - src/skills/c64-provenance-diff/SKILL.md
metrics:
  duration: ~45m
  completed: 2026-09-15
actuals:
  tokens: 15000
  tasks: 3
  commits: 3
---

# Quick 260915-mmn: c64-provenance-diff SKILL.md STE100 pass Summary

Applied the ASD-STE100 strict pass to `src/skills/c64-provenance-diff/SKILL.md`,
across three tracer/auto tasks (worked example, remaining prose, Troubleshooting
table), dropping the ste-lint violation count from 39 to 5 with no change to any
fact, confidence grade, or hedge.

## Before/after violation count, by rule

| Rule | Before | After | Notes |
|---|---|---|---|
| semicolon | 14 (hard) | 0 | All 14 prose/cell semicolons split into separate sentences. |
| synonym-rotation | 4 (hard) | 0 | `alter`→`change` (x2 occurrences), `Delete`→`Remove`, `correct`(verb sense)/`fix` cluster removed by renaming the header cell. |
| long-sentence | 4 (hard: 3 exempt + 1 fixed) | 3 (all exempt) | Line 3's three findings are the exempt YAML `description:` field (D-2). The line-286 26-word finding was resolved as a side effect of splitting its cell semicolon. |
| passive-voice | 17 (advisory) | 2 (advisory) | Converted 15 of 17. Kept line 92 (verbatim quote of `RULED_OUT_ALTERNATIVES`) and line 202 (naming an actor would assert the cracker did it, which the section exists to withhold). |
| **Total** | **39 (22 hard)** | **5 (3 hard)** | Strictly below the 39 pass bar. All 3 remaining hard findings are the exempt frontmatter. |

Mandated command result: `count 5 hard 3` (was `count 39 hard 22`), exit 0.

## Glossary verb chosen per cluster

- `change` / `alter` → kept **`change`** (frontmatter's untouchable `change` on line 3
  was already first. `alter` on line 150 and `altering` on line 171 both became
  `change`/`changes`).
- `remove` / `delete` → kept **`remove`** (line 163's `remove`/`removed` already
  matched. Line 193's `Delete` became `Remove`, italic on *independently* preserved).
- `fix` / `correct` → **removed from the file entirely** rather than flattening one
  sense into the other. See header-rename note below.
- `check` / `confirm` → kept **`check`** everywhere except one named exception. See
  below.

## The `Fix` → `What to do` header rename

The Troubleshooting table's header cell `Fix` (line 279) became `What to do`.
Lines 284 and 288 each used an **adjective** meaning accurate, not a **verb**
meaning to mend a defect — several rows in the table state an expectation
("this reading is accurate") rather than a mend action, so the adjective was
never really the same cluster member the glossary targets. Under a `Fix`
header the adjective still triggered a synonym-rotation finding. Renaming the
header to `What to do` (a description of the cell's purpose, not a verb) let
both occurrences become `accurate` — the adjective they already meant —
without contradicting the header or inventing an action nothing in the row
supports. `Usually` and `Also usually` survive unchanged in both cells. The
hedge is the whole point of those rows, since `count-patches` reporting 0 or
`UNKNOWN` covering everything is usually but not always the right read.

## Named glossary exception: `confirm` → `prove` on line 286

Line 286 (the "Asked to prove a release has no trainer" row) used `confirm` twice.
The batch glossary keeper for this cluster is `check`, but `check` is the wrong word
in this row: the row is about **establishing a claim with evidence**, and "you
cannot check that from a diff alone" is a weaker and different statement from "you
cannot establish that from a diff alone." This skill already has its own evidentiary
verb for exactly this act — `prove` — used on lines 20 (`anchor-search` proving an
offset), 102 (worked example), and 167 ("is a trainer until proven otherwise"/"not
proven by it"). `prove` sits in no synonym cluster the linter tracks, so replacing
both occurrences (the Symptom cell and the first sentence of the What-to-do cell)
cleared the finding without weakening the claim. Recorded here per the plan's
named-exception instruction.

## Findings deliberately left in place

| Location | Finding | Why kept | Protected by |
|---|---|---|---|
| Line 3 (x3) | long-sentence | The `description:` field is a retrieval index, not prose — a word cap fights the keyword packing that makes the skill trigger. | Prohibition 1, decision D-2 |
| Line 92 | passive-voice ("is recorded") | Inside the verbatim blockquote (lines 90-93) quoting `RULED_OUT_ALTERNATIVES` from `scripts/diff-images.mjs:333`. Editing it would make the doc misquote its own tool. | Prohibition 5 |
| Line 202 | passive-voice ("was patched") | "A diff **hit** is informative — something was patched." The actor is genuinely unknown here, and naming one (e.g. "a cracker patched something") would assert the cracker did it — the exact claim this section says a hit does not support. | Plan's line-202 guidance (likely-keep list) |

No sentence was declined a rewrite solely to save a confidence qualifier — every
graded word (`proven`, `earned`, `likely`, `conditional`, `UNKNOWN`, `HIGH`,
`MEDIUM-HIGH`, `cannot`, `only`, `not sufficient`, `whatever`) survived the pass
intact. Re-reading `git diff` against the `<primary_hazard>` table after each
task checked this.

## Verification

- Frontmatter (lines 1-4) sha256: `bc392a18fafda8266c0b5146203b28cc1b68e5710d09ab3d0ca28995867f2fda`
  — matches the plan's recorded value, byte-identical.
- Blockquote (lines 90-93) verified byte-identical against `git diff`.
- Troubleshooting table: 12 data rows, 2 columns before and after (verified with an
  `awk -F'|'` field-count check).
- `git diff --stat` across all three commits touches only
  `src/skills/c64-provenance-diff/SKILL.md`.
- No test file created, no test suite run, the skill and its scripts were not
  invoked.

## Deviations from Plan

None — plan executed exactly as written, task by task, in the order given.

## Self-Check: PASSED

- FOUND: `src/skills/c64-provenance-diff/SKILL.md`
- FOUND commit `9beea261` (task 1)
- FOUND commit `6e542d02` (task 2)
- FOUND commit `5d104d75` (task 3)
