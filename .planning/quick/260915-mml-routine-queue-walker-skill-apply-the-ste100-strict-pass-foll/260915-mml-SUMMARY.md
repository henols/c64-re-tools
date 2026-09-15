---
quick_id: 260915-mml
status: complete
one_liner: ASD-STE100 strict pass on routine-queue-walker SKILL.md — removed all prose semicolons and synonym rotation, split every over-long sentence, preserved every fact and hedge
---

# Quick 260915-mml: STE100 strict pass on routine-queue-walker SKILL.md — Summary

Applied the ASD-STE100 strict pass to `src/skills/routine-queue-walker/SKILL.md` across
three tasks. ste-lint's total violation count dropped from a baseline of 50 to a final
15, with `semicolon` and `synonym-rotation` both at 0 and no fact, condition, scope
qualifier or hedge changed.

## Per-rule counts, before and after

| Rule | Baseline | After Task 1 | After Task 2 | Final (Task 3) |
|---|---|---|---|---|
| `semicolon` | 19 | 0 | 0 | 0 |
| `synonym-rotation` | 4 | 4 | 0 | 0 |
| `passive-voice` (advisory) | 22 | 22 | 9 | 10 |
| `present-perfect` (advisory) | 3 | 3 | 3 | 3 |
| `long-sentence` | 2 (both line 3) | 2 | 2 | 2 (both line 3) |
| **Total** | **50** | **31** | **14** | **15** |

The total ticked up by one from Task 2 to Task 3 (14 -> 15) because splitting a
run-on sentence in Task 3 exposed a `max_results` **is REQUIRED** specification
clause as its own sentence, which the passive-voice regex now matches on its own
line (it did not surface as a separate match while buried inside the original
47-word sentence). This is expected and accepted: the plan's pass bar is a total
strictly below the baseline of 50 with the specific hard-zero rules satisfied, not
a monotonic per-rule decrease every task. Final total (15) is comfortably below 50
and inside the plan's own expected range ("near 15").

## Tasks executed

1. **Task 1 — Remove all 19 prose semicolons.** Every semicolon is gone: 11
   clause-join semicolons split into two sentences, and semicolon-chained list
   items (bullets and a three-item serial list) converted to full stops or a
   proper bulleted list. Commit `fd44147d`.
2. **Task 2 — Collapse the four rotating verb clusters and convert named-actor
   passives.** Applied the fixed verb glossary (`confirm`->`check`, `halt`->`stop`,
   `fix`->`correct` on the one adjective occurrence, `fetch`->`get`). This
   resolved all 4 synonym-rotation violations. Converted 13 passive
   constructions to active where the actor was the reader or otherwise named.
   Left every LEAVE-listed passive (unknown actor, heading, specification
   statement, compound-tense current-relevance case) untouched. Commit
   `60fe8998`.
3. **Task 3 — Split the over-long sentences the linter cannot see.** The linter
   measures sentence length per hard-wrapped line and never saw most of these
   violations (only the two exempt line-3 hits). Read the whole file end to end
   and split every procedure sentence over 20 words and every other sentence over
   25 words, preserving order, conditions, scope qualifiers and hedges. Several
   long enumerations became bulleted sub-lists (mirroring a pattern the file
   already used elsewhere), without reordering, merging, or renumbering any
   procedure step. Commit `b5ed3c54`.

## Deviations from Plan

None. All three tasks executed as specified, with the same check commands and
pass bars the plan defined.

## Kept as-is (rules deliberately not applied, with reason)

**D-2 `description:` exemption (line 3).** Both `long-sentence` violations remain
on line 3, untouched, per decision D-2 (it is a retrieval index, deliberately
keyword-packed). Checked byte-identical to HEAD.

**3 kept compound tenses (present-perfect), unchanged throughout:**
- "...a program nothing **has been named** in yet." (appears twice: once in
  section 2.1's Candidate source A step, once in section 3.1's Candidate source A
  step) — current relevance is the point: the store's present naming state is
  exactly what the sentence is about.
- "a `base_revision` that the store **has moved past**" (in "When something
  fails," the refused-write bullet) — same reasoning: the store's current
  revision state governs whether a write is refused right now.

**Kept passives (10 final, all deliberate):**
- `was recorded` (line 40) — the actor is genuinely unknown. That is the point.
- `are classified` (line 62) — inside a `##` heading. Headings do not change.
- `is REQUIRED` (lines 81 and 247) — specification statements about a tool's own
  contract (`max_results`, `--store`). The object is the topic, not an actor's
  action.
- `has been named` x2 (lines 100, 171) — the present-perfect KEEPs above, which
  the linter also matches as passive-voice hits.
- `is truncated` (line 267) — a state of the file, not an action by an actor.
- `are REQUIRED` / `is derived` (line 331, same sentence) — a specification
  statement about the three CLI arguments' contract.
- `were declared` (line 337) — describes what the committed manifest itself
  records. Naming an actor here would add a fact the source does not state.

**Sentences a verbatim token limited (could not shorten further):** the
`anno decomp-completeness` stop-condition sentence carries a single very long
inline-code command (`node .../completeness-report.mjs --store ... --disagreements
... --manifest ...`) that cannot be split or paraphrased. The surrounding prose
was still split around it (into "...finishes for a fixture when `<command>`
**exits 0**. It never finishes just because..."), but the command itself stayed
byte-identical.

## Verification (self-check)

- `git diff --stat` across all three commits: only
  `src/skills/routine-queue-walker/SKILL.md` changed. Checked via
  `git diff HEAD~3 HEAD --stat`.
- Line 3 (`description:`) byte-identical to HEAD: checked, no diff hunk touches
  it in any of the three commits.
- Every fenced code block byte-identical to HEAD: checked, no diff hunk
  contains a `node ...` command line or a ` ``` ` fence marker.
- No `##`/`###` heading text changed: checked via `git diff | grep -E '^[+-]#'`
  returning nothing.
- Numbered procedure step sequences (`1.` .. `8.` per section) are identical
  between HEAD~3 and the final state. No step was reordered, merged, renumbered,
  or dropped. Checked by extracting and diffing the numbered-item sequence.
- No table row (`| ... |`) appears in any diff hunk — the four Phase 4 tables are
  untouched.
- Final ste-lint run: total 15 (baseline 50, strictly lower), `semicolon` 0,
  `synonym-rotation` 0, `long-sentence` 2 (both on line 3), `present-perfect` 3,
  `passive-voice` 10.

## Self-Check: PASSED

- FOUND: `src/skills/routine-queue-walker/SKILL.md`
- FOUND: commit `fd44147d` (Task 1)
- FOUND: commit `60fe8998` (Task 2)
- FOUND: commit `b5ed3c54` (Task 3)

## actuals

```yaml
actuals:
  tasks: 3
  commits: 3
```
