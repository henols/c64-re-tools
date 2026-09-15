---
phase: quick
plan: 260915-mmk
subsystem: docs
tags: [ste100, skill-docs, vice-wedge-triage]
dependency-graph:
  requires: []
  provides: ["STE100-conformant src/skills/vice-wedge-triage/SKILL.md"]
  affects: ["src/skills/vice-wedge-triage/SKILL.md"]
tech-stack:
  added: []
  patterns: ["ASD-STE100 strict pass", "cell-is-the-record table editing (R8)"]
key-files:
  created: []
  modified:
    - src/skills/vice-wedge-triage/SKILL.md
decisions:
  - "Kept 'halt authority' (lines 62, 88), 'machineHalted'/'machineHaltedNote', and every checkpoint-delete verbatim token unchanged, per R1's named-field exception"
  - "Left `is granted`, `is surfaced`, `were checked`, `was needed`, `is wedged`, `is armed`, `is required` passive-voice advisories unconverted where naming an actor would invent unstated specificity or break a lookup-row's object-as-topic phrasing"
  - "Caught and corrected a scope-narrowing rewrite slip in the Provenance table's five-verdict row before committing: an early draft merged `restarted` into the same list as `live`/`checkpoint_trap`/`wedged`, making the 'checked on both capability routes' claim look like it covered `restarted` too, when the source explicitly scoped that claim to the first three only"
metrics:
  duration: "~55 minutes"
  completed: 2026-09-15
actuals:
  tokens: 22000
  tasks: 3
  commits: 2
  plan_head_before: 4bff0cb271e2a1e9b2b4e95e6d4a7c8a9c5f6a11
status: complete
---

# Quick 260915-mmk: STE100 strict pass over vice-wedge-triage/SKILL.md Summary

Applied the ASD-STE100 strict pass to `src/skills/vice-wedge-triage/SKILL.md` only — deleted
prose and in-cell semicolons, split over-long sentences (including the two densest Provenance
records), converted named-actor passives to active voice where safe, and closed the
check/confirm, delete/correct, and stop/halt synonym-rotation clusters — while leaving every
fact, hedge, table row, and verbatim token exactly as the source stated them.

## Final count

ste-lint reports **12 violations** against the baseline of 56 (78.6% reduction), with a **hard
count of 3** against the baseline of 34. Both halves of the pass bar are met: the count fell
strictly below 56, and Task 3's full-diff read (below) found no hedge softened, no prohibition
weakened, and no fact dropped.

```
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/vice-wedge-triage/SKILL.md
→ count: 12, hard_count: 3
```

## The 3 permanent line-3 `description:` violations (decision D-2)

Line 3 is the YAML frontmatter `description:` field — exempt under R6/D-2 because it is a
retrieval index, not prose, and is deliberately keyword-packed so the skill triggers at all. It
was never edited. Its 3 violations stay on the books permanently:

1. `long-sentence` — 34 words (the first sentence, "Decide whether a VICE emulator...").
2. `long-sentence` — 53 words (the second sentence, "Use when asked why...").
3. `present-perfect` — "has stopped" ("a VICE emulator that has stopped responding").

## Every other remaining violation, and why it stays

| Line | Rule | Match | Why it stays |
|---|---|---|---|
| 62 | synonym-rotation | `halt` | "halt authority" (also at line 88) is a named phrase for the monitor lock, not the ordinary halt/stop verb. Converting `43`'s "halts" → "stops" (an ordinary verb use) left this phrase as the sole `halt` survivor, which is the exact named exception the plan warned about — glossary uniformity loses to technical accuracy here. |
| 68 | present-perfect | `has arrived` | R5 residual, kept deliberately. The very next sentence says the flag latches and "stays true for the rest of the session" — that is current relevance the simple past cannot carry ("arrived" would drop the fact that the state persists). |
| 136 | passive-voice | `is granted` | "The instance is granted on the session's first forwarded call" — no actor is named in the source sentence, and the codebase doesn't give this file a single safe noun for "whoever grants it" without inventing detail the source never stated. Left passive per R4's own-actor-unnamed exception. |
| 231 | passive-voice | `is surfaced` | Provenance table, Claim column: "Epoch drift is surfaced automatically...". Every sibling Claim-column entry in the same table uses this same abstract, actor-less claim phrasing ("The cycle bracket is the only trustworthy liveness test", "`vice_ping`'s `execution` field is not liveness"). Naming "the proxy" here would break that column's stylistic parallelism for no lint gain (passive-voice is advisory only). |
| 235 | passive-voice | `were checked` | Provenance table, Evidence cell: "The first three were checked on both capability routes...". No actor is named in the source for the original "(confirmed on both capability routes...)" parenthetical either; inventing one (e.g. "the test suite") would be adding specificity the record does not make. |
| 241 | passive-voice | `was needed` | "...the workaround outlives the memory of why it was needed." Genuinely impersonal — nothing in the sentence names who needed it. |
| 254 | passive-voice | `is wedged` | "**Whether the emulator is wedged, and whether to recycle**" — a lookup-row heading in the "Which skill does what" table. R4's own exception: the object ("the emulator['s wedged state]") is the topic of the row, not something with a hidden actor. |
| 264 | passive-voice | `is armed` | "Zero cycles, and a checkpoint is armed on the IRQ handler" — Troubleshooting table, Symptom column. Same R4 lookup-row exception: the checkpoint's armed state is the topic being matched against, not an action someone performed. |
| 267 | passive-voice | `is required` | "It is required, by design — the reason *is* the incident record" — Troubleshooting table, Correct column. Same R4 exception; the sentence is defining a requirement, not describing an actor's action. |

## Glossary exceptions taken under R1

- **`halt` / "halt authority"** (lines 62, 88) — kept. Names the monitor lock specifically; not
  the ordinary halt/stop verb the glossary's `stop` entry targets. The ordinary verb use at
  (original) line 43 — "every stock read halts the machine" — *was* converted to "stops".
- **`halt` in `machineHalted` / `machineHaltedNote`** (throughout the `vice_run_until` section) —
  kept everywhere. These are verbatim JSON field names the tool actually returns; renaming the
  prose word here would divorce the explanation from the field it explains.
- **`delete` in `vice_checkpoint_delete`, `cleanup: "deleted"` / `"delete_failed"`, and the
  general checkpoint-delete action** — kept everywhere. Per the plan's explicit instruction,
  renaming these to "remove" would break the mapping to the verbatim tool name and JSON values
  and would likely open a new rotation pair rather than close one.
- **`stopped` as the wire-event name, machine-state name, and verdict-vocabulary word** — never
  touched. It already *is* the glossary's preferred `stop`-family spelling, so there was no
  conflict to resolve.
- **`fix` → `correct`** (3 sites, closed rather than left as an exception): line 8's "the
  intuitive fix" → "the intuitive correction", line 98's quoted "fix" it → "correct" it, and the
  Troubleshooting table header "Fix" → "Correct". All three were the only remaining
  correct/fix-family outliers once line 37's "correct" (already the preferred spelling) was left
  in place; closing them eliminated the synonym-rotation flag instead of just moving it.
- **`confirm`/`Confirmed` → `check`/`Checked`** (3 sites, closed): line 171's "live-confirmed" →
  "live-checked", line 229's "Confirmed twice independently" → "Checked twice independently", and
  line 266's "to confirm" → "to check". `check` was already the file's established preferred verb
  (used repeatedly elsewhere, e.g. "check `evidence.jamObserved`"), so all three were changed
  rather than left as a rotating pair.
- **`gets reached` avoided** — mid-edit, a rewrite of row 236 introduced "never gets reached",
  which collided with the file's existing `get`-cluster word "obtained" (row 123) under the
  linter's `get/retrieve/fetch/obtain` synonym group. Reworded to "is never reached" (closer to
  the original "never reached" anyway) rather than renaming the established "obtained".

## Table cells left alone because shortening would cost a fact

- **Line 254** (`is the machine alive, and what may I do to it` lookup row) and **lines 264, 267**
  (Troubleshooting Symptom/Correct column lookup rows) — left both structure and passive voice
  untouched. Converting any of these to active voice would require inventing an actor the row
  never names, for a lookup-row style where the object genuinely is the topic (R4's own stated
  exception).
- **Lines 235 and 236** (the two Provenance ledger records the cell rule exists for) — every
  fact was kept: every binary path (`/usr/bin/x64sc`, `/usr/local/bin/x64sc`), every VICE version
  (3.9, 3.10), every test file name (`stock-diagnose.test.ts`, `stock-run-until.test.ts`,
  `stock-live-broker-monitor.test.ts`, `text-monitor-live.test.ts`), every pass ratio (40/40,
  21/21, 65/65), every millisecond bound (1ms/10000ms, ~1501-1502ms/1500ms, 3499ms), every date
  (2026-08-18, 2026-09-09), every command string, every JSON evidence fragment, every verdict
  name, and both confidence grades with their stated bases. Only the sentence joins changed (72
  words → 5 shorter sentences on line 235; three 26-38 word spans → shorter sentences on both
  rows), never the row/column count.

## Self-check on structural invariants

- **59 lines** begin with a pipe character before and after the pass — unchanged. No row was
  split, merged, added, or removed.
- **132 distinct backticked spans** before and after the pass — the exact same set (verified by
  `comm` on sorted-unique backtick-span lists; zero additions, zero removals).
- **The `description:` frontmatter line is byte-identical** before and after (`diff` confirms).
- **The single fenced code block is byte-identical** before and after (`diff` confirms).
- **Hedge census unchanged**: "may" 6, "might" 0, "never" 22, "cannot" 8, "unless" 2 — all five
  counts match the pre-pass baseline exactly.
- **Bold-marker (`**`) count**: 144 → 146 (+2, i.e. exactly one new balanced pair), from the one
  deliberate split of the `machineHalted` true/false bold span into two separate bold claims
  (line 159-160). No other bold span was broken.
- Full unified diff against the pre-pass blob (`ca02a89c`) is 1:1 line-for-line: 48 lines removed,
  48 lines added, 0 net line-count change (269 → 269 lines).

## Deviations from Plan

### Auto-fixed issues

**1. [Task 3 audit] Scope-narrowing rewrite slip in the Provenance table, caught before commit**
- **Found during:** Task 3's whole-diff semantic audit, before the Task 2 commit was made.
- **Issue:** An intermediate rewrite of row 235 (the five-verdict Provenance record) merged
  `restarted` into the same list as `live`/`checkpoint_trap`/`wedged`, before the "checked on both
  capability routes" sentence. That made the capability-routes claim read as if it covered all
  four verdicts, when the source explicitly scoped it to the first three only (`restarted` sat
  outside the original parenthetical, joined by "and").
- **Fix:** Reworded to "for `live`, `checkpoint_trap`, and `wedged`, and also for `restarted`. The
  first three were checked on both capability routes...", restoring the original scope.
- **Files modified:** `src/skills/vice-wedge-triage/SKILL.md`
- **Commit:** `91a44acc` (folded into the Task 2 table-cells commit, since the slip was introduced
  and caught within the same working session before that commit landed).

No other deviations. The plan's `<primary_hazard>` and `<binding_rules>` were followed as
written; no Rule 4 (architectural) situation arose.

## Self-Check: PASSED

- `src/skills/vice-wedge-triage/SKILL.md` — FOUND, modified as described.
- Commit `00f41c09` — FOUND in `git log`.
- Commit `91a44acc` — FOUND in `git log`.
- ste-lint final count 12 < 56 — PASSED.
- 59 pipe-rows, 132 distinct backticks, byte-identical description/fenced-block, unchanged hedge
  census — all PASSED (see Self-check section above).
