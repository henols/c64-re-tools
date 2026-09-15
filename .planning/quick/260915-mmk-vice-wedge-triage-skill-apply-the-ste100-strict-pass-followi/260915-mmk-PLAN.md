---
quick_id: 260915-mmk
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/skills/vice-wedge-triage/SKILL.md
autonomous: true
requirements: [QB-260915-mmk]

estimate:
  tokens: 16000
  raw_tokens: 45000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "ste-lint reports strictly fewer than 56 violations for src/skills/vice-wedge-triage/SKILL.md"
    - "Every fact, condition, scope qualifier and hedge in the file survives the pass unchanged in meaning — no 'may have failed' became 'failed'"
    - "The file still has exactly 59 table-row lines, and no row was split, merged, added or removed"
    - "The description: field in the YAML frontmatter is byte-identical to its pre-pass state (exempt by decision D-2)"
    - "Every backticked verbatim token still appears in the file. Tool names, register names, binary paths, version numbers and field names all survived the pass"
    - "The single fenced code block is byte-identical to its pre-pass state"
    - "A reader of the SUMMARY can see which violations remain and why each one stays"
  artifacts:
    - path: "src/skills/vice-wedge-triage/SKILL.md"
      provides: "the STE100-conformant triage playbook, same content, same records, fewer violations"
      contains: "vice_diagnose"
    - path: ".planning/quick/260915-mmk-vice-wedge-triage-skill-apply-the-ste100-strict-pass-followi/260915-mmk-SUMMARY.md"
      provides: "final violation count, the residual list, and every glossary exception taken"
  key_links:
    - "Each rewritten sentence inside a table cell stays inside that cell — the cell is the record"
    - "Prose that explains a verbatim field name keeps the field name's own vocabulary, so the prose and the field still describe the same thing"
---

<objective>
Apply the STE100 strict pass to `src/skills/vice-wedge-triage/SKILL.md`, one file, no other file.

Purpose: an agent parses this playbook, with no human present to resolve an ambiguous
sentence. That is the exact reader ASD-STE100 exists for. The pass removes prose semicolons,
splits over-long sentences, converts named-actor passives to active, and applies one fixed verb
per synonym cluster — while changing no fact.

Output: the same file, same records, same meaning, with an ste-lint violation count strictly
below the measured baseline of 56.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
@src/skills/vice-wedge-triage/SKILL.md

Use the globally available `asd-ste100` skill for the rewrite itself. It is the authority on
what a conformant sentence looks like. Invoke it with the Skill tool before you start editing.
</context>

<scope_fence>
This plan is a prose rewrite of shipped skill documentation. It changes one markdown file and
nothing else.

**No test of the skill, in any form.** Do NOT write a test file. Do NOT run `npm test` or any
test suite. Do NOT invoke the skill to see whether it still works. Do NOT perform a round-trip
or behavioural check of any kind.

The ONE permitted automated check is the ste-lint text linter, named in every task below. You
establish everything else by reading your own `git diff`.
</scope_fence>

<binding_rules>
These rules bind you. This plan restates them in full, because you have not read the batch
prompt. The source is `.planning/ste100-batch-rules.md`.

**R1 — Fixed verb glossary.** Apply identically, everywhere the rewrite touches. The preferred
verb comes first on each line, and the words after it are the ones it replaces.

- check, in place of confirm, verify, validate
- correct, in place of fix, repair
- change, in place of modify, alter
- stop, in place of halt, terminate
- get, in place of fetch
- start, in place of launch, begin
- remove, in place of delete, erase
- show, in place of display

**R2 — Delete every prose semicolon.** A clause join becomes two sentences. A semicolon-chained
list item takes a full stop.

**R3 — Split sentences over 20 words in a procedure, over 25 elsewhere.**

**R4 — Convert passive to active wherever the actor is named.** Leave the passive where the
object genuinely is the topic of a lookup row.

**R5 — Keep the compound tense where it carries current relevance.** "the flag has latched" and
"the flag latched" are different claims.

**R6 — Never touch the `description:` field in the YAML frontmatter.** It is a retrieval index,
not prose, and it is exempt by decision D-2. It is deliberately keyword-packed so the skill
triggers at all. It carries 3 permanent violations that stay on the books.

**R7 — Never touch fenced code blocks, tool names, register names, binary paths, version
numbers, field names, test file names, measured numbers, dates, or any other verbatim token.**

**R8 — A table cell is a record.** Apply STE to the sentences inside a cell, never to the row.
Never split a row. Never merge a row. Never add or remove a row or a column.

**R9 — Preserve every fact, condition, scope qualifier and hedge.** "may have failed" never
becomes "failed".
</binding_rules>

<primary_hazard>
**This file holds the evidence-ledger tables that rule R8 exists for.** The batch rule about
cells comes from this file. Rows 235 and 236 of the Provenance table are single-cell records.
Each one states what the project measured, on which binary, on which date, with which command,
and at which confidence. The linter reports a 72-word "sentence" at line 235. It is not a
sentence. It is a record.

Inside such a cell you MAY split a long sentence into two short ones, delete a semicolon, and
make a named-actor passive active. You MAY NOT turn one row into two rows, fold two rows into
one, drop a measurement, drop a binary path, drop a date, drop a command string, or soften a
confidence grade. If a cell cannot be shortened without losing a fact, leave the cell alone and
record it as a deliberate residual.

**Second hazard, equal weight: this is triage documentation, and its hedges are load-bearing.**
The whole file exists to stop a reader from acting on a confident-sounding wrong diagnosis.
"may be wedged", "might have crashed", "appears paused", "is not guaranteed to unfreeze
anything", "not reproduced", "MEDIUM", "single incident" — every one of these is the content,
not the packaging. A hedge that hardens into a claim turns a diagnostic aid into a false
assertion. Never let that happen.
</primary_hazard>

<baseline>
Measured on the pre-pass file, which is the blob at commit `ca02a89c`:

- 56 violations total, 34 of them hard, over 3,375 words, a rate of 1.7 per 100 words.
- By rule: passive-voice 20, semicolon 20, long-sentence 10, synonym-rotation 4,
  present-perfect 2.
- Line 3 is the `description:` frontmatter. It carries 3 of the 56 — two long-sentence
  (34 words, 53 words) and one present-perfect ("has stopped"). All three are exempt under R6
  and stay. **The floor for this file is therefore 53, not 0.**
- 53 violations are addressable. 30 sit in body prose. 23 sit inside table cells.

Structural facts of the pre-pass file, to compare your diff against:
- 59 lines begin with a pipe character, which is every table row and every table separator.
- 132 distinct backticked spans.
- 1 fenced code block.
- Hedge census: "may" 6, "might" 0, "never" 22, "cannot" 8, "unless" 2.
</baseline>

<tasks>

<task type="auto">
  <name>Task 1: STE100 pass over the body prose, outside every table</name>
  <files>src/skills/vice-wedge-triage/SKILL.md</files>
  <action>
Invoke the `asd-ste100` skill first. Then rewrite the body prose of the file — every paragraph,
heading and numbered step that is NOT a table row and NOT inside the fenced code block. Leave
every table row for Task 2. Leave the YAML frontmatter alone entirely (R6).

The 30 addressable prose violations sit at these lines in the pre-pass file. Work them all.

Semicolons (R2), 11 of them, at lines 30, 43, 44, 80, 95, 138, 154, 160, 178, 211 and 239. Each
becomes a full stop and a second sentence. This is mechanical and carries no meaning risk.

Named-actor passives (R4), 14 of them: line 27 "is named", line 43 "was inferred", line 46
"being made", line 48 "is written", line 49 "is killed", line 80 "is recovered", line 90 "was
run", line 100 "is guarded", line 136 "is granted", line 150 "is REFUSED", line 152 "are
refused", line 159 "was answered", line 169 "is unchanged", line 241 "was needed". Convert the
ones whose actor the sentence already names. Where the actor is genuinely unknown or is the
tool itself acting on the caller, keep the passive and say so in the SUMMARY. Note that line
150's "is REFUSED" carries emphasis capitalisation that is doing work — the point is that the
tool refuses rather than ignores. Keep that force whichever voice you choose.

Synonym rotation (R1), 4 sites: line 37 "correct", line 43 "halts", line 136 "repaired", line
171 "confirmed". The glossary picks "correct", "stop" and "check". So line 136's "repaired"
becomes a form of "correct", line 171's "confirmed" becomes a form of "check", and line 37's
"correct" is already the preferred term and only needs the competing "fix" spellings removed.
"fix" also appears at line 8 and line 98 and as the Troubleshooting column header at line 258 —
line 258 is a table cell and belongs to Task 2.

**The linter reports only the first occurrence of a rotating pair.** If you change the flagged
line and leave a later occurrence of the same non-preferred word, the count does not drop, it
just moves. So change every occurrence of the non-preferred word, or knowingly leave the pair
in place and record why.

**Named exception, expected, and the reason to read carefully before applying R1 here.** The
glossary picks "stop" over "halt". This file uses "stopped" as the name of a wire event
(`stopped`, `resumed`, `jam`), as the name of a machine state, and as the verdict vocabulary a
reader matches against. It also uses "halt" inside the verbatim field names `machineHalted` and
`machineHaltedNote`, and in the phrase "halt authority" at lines 62 and 88, which names the
monitor lock. Where prose describes what a verbatim field reports, changing the prose verb
divorces the prose from the field it explains. Preserve technical accuracy over glossary
uniformity wherever the two conflict, and record every such exception in the SUMMARY. The same
judgement applies to "delete": the glossary picks "remove", but "delete" here names
`vice_checkpoint_delete`, the `cleanup: "deleted"` and `"delete_failed"` values, and the
checkpoint action a reader performs. Renaming those to "remove" would break the mapping to the
tool and would likely create a new rotation pair rather than close one.

Present perfect (R5), 1 site: line 68, "once a `JAM` (0x61) event has arrived". The next
sentence says the flag latches and stays true for the rest of the session. That is exactly the
current relevance R5 protects. Keep it, and record it as a deliberate residual.

Line 3 is the `description:` frontmatter and is out of scope under R6. Do not edit it.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/vice-wedge-triage/SKILL.md | python3 -c "import json,sys; d=json.load(sys.stdin); print('count', d['count'], 'hard', d['hard_count']); sys.exit(0 if d['count'] &lt;= 45 else 1)"</automated>
  </verify>
  <done>
The linter reports 45 or fewer violations. Removing the 11 prose semicolons alone reaches 45,
so this bar is met by the mandatory mechanical edits and leaves the judgement calls free.

Reading your own `git diff` for this task shows four things. No line beginning with a pipe
character changed. The fenced block still matches its pre-pass bytes. The `description:` line
still matches its pre-pass bytes. The file kept every backticked token and every hedge that the
rewritten prose carried before.
  </done>
</task>

<task type="auto">
  <name>Task 2: STE100 pass inside table cells only, one cell at a time</name>
  <files>src/skills/vice-wedge-triage/SKILL.md</files>
  <action>
Rewrite the sentences INSIDE table cells. Rule R8 governs this task completely: the cell is the
record, the row is never touched as a unit. Work one cell at a time. After each cell, confirm
the row still has the same number of pipe characters it started with.

The 23 addressable in-cell violations sit at these lines in the pre-pass file.

Semicolons (R2), 9 of them: line 63, line 121, line 125, line 228, line 231, three on line 235,
and one on line 236. Each becomes a full stop inside the same cell.

Named-actor passives (R4), 6 of them: line 120 "is written", line 123 "was obtained", line 231
"is surfaced", line 254 "is wedged", line 264 "is armed", line 267 "is required". Lines 254,
264 and 267 are lookup rows whose subject is the object of the lookup — "Whether the emulator
is wedged", "a checkpoint is armed on the IRQ handler", "It is required, by design". R4's own
exception covers these: leave the passive where the object genuinely is the topic of the row.
Convert only where the sentence already names the actor and the conversion reads at least as
clearly.

Long sentences (R3), 8 of them, and every single one is inside a table cell — line 122 (26
words), three on line 235 (72, 26, 32 words), three on line 236 (35, 37, 38 words), and line
266 (36 words).

Lines 235 and 236 are the Provenance ledger's two densest records. They are the reason the
batch author wrote the cell rule around this file. Before editing either, list every fact the cell
carries: each binary path, each VICE version, each test file name, each pass ratio, each
millisecond bound, each date, each command string, each verdict name, each JSON fragment, and
the confidence grade with its stated basis. Split the prose that joins those facts. Move none
of the facts, drop none of them, and merge neither row into the other. The 72-word span on line
235 may end up as four or five sentences inside the one cell. That is the correct outcome. One
row in, one row out.

Line 236's confidence cell reads "**MEDIUM** — a single binary's basis". That qualifier is the
record. It says the claim is proven where the capability ships and NOT against a second binary
the way the row above it is. Splitting that sentence is fine. Weakening it is not.

Line 266 is the "A run survived a reset" Troubleshooting row. Its cell says you cannot read the
epoch to confirm, and that absence of a drift error is the only evidence available. Both halves
are hedges. Split the sentence and keep both.

Line 258 is the Troubleshooting header row. Its second column carries the heading "Fix", and R1
prefers "correct". A header cell's word is a cell-level edit, so R8 permits the change. Check
first whether the change closes a rotation pair or opens a new one. Leave the heading as it
stands if the answer is unclear. Never add or remove a column either way.

Line 3 is the `description:` frontmatter and is out of scope under R6. Do not edit it.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/vice-wedge-triage/SKILL.md | python3 -c "import json,sys; d=json.load(sys.stdin); print('count', d['count'], 'hard', d['hard_count']); sys.exit(0 if d['count'] &lt;= 36 else 1)"</automated>
  </verify>
  <done>
The linter reports 36 or fewer violations. Removing the 9 in-cell semicolons on top of Task 1's
result reaches 36, so this bar is met by the mandatory mechanical edits alone.

Reading your own `git diff` for this task: the count of lines beginning with a pipe character
is still 59, and every changed row has the same pipe count it had before. No measurement, no
binary path, no version number, no test file name, no date, no command string and no confidence
grade left the file.
  </done>
</task>

<task type="auto">
  <name>Task 3: Whole-file semantic audit and the residual record</name>
  <files>src/skills/vice-wedge-triage/SKILL.md</files>
  <action>
Read the complete diff of this file against its pre-pass state, which is the blob at commit
`ca02a89c`. Read it as the agent who will later use this playbook to decide whether to destroy
a running emulator.

Check these six things by reading, not by running a test.

One: every fact, condition, scope qualifier and hedge survived. Walk the hedge census from the
baseline — "may" 6, "might" 0, "never" 22, "cannot" 8, "unless" 2. If any of those counts fell,
find the sentence that lost it and satisfy yourself that the meaning is identical. The 22
occurrences of "never" are this file's prohibition vocabulary. Losing one is a real regression.

Two: 59 lines still begin with a pipe character, and no row was split, merged, added or
removed.

Three: the 132 distinct backticked spans are all still present. Tool names, register names,
binary paths, version numbers, field names, JSON fragments and test file names are verbatim
tokens under R7.

Four: the single fenced code block is byte-identical.

Five: the `description:` line in the YAML frontmatter is byte-identical, per R6.

Six: no sentence that hedged now asserts. Specifically re-read the five-state opening table, the
Verdict-to-response table, the `jamObserved` and `channelContention` sections, the
`diagnosis_unavailable` reason classes, "What is not recoverable", and the two traps section.
Each of those tells a reader when NOT to recycle. Every one of those prohibitions must read at
least as strongly as it did before.

If any check fails, correct the file and read the diff again.

Then write the SUMMARY. It must record these five things, explicitly.

- The final violation count against the baseline of 56.
- The 3 permanent line-3 frontmatter violations that stay under decision D-2, and why.
- Every other violation still on the books, with the reason each one stays.
- Every glossary exception you took under R1. Name each place where you kept "halt", "stopped"
  or "delete" because a verbatim field name, a wire event name or a tool name uses that word.
- Every table cell you left alone because shortening it would have cost a fact.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/vice-wedge-triage/SKILL.md | python3 -c "import json,sys; d=json.load(sys.stdin); v=d['violations']; fm=[x for x in v if x['line']==3]; print('final', d['count'], 'hard', d['hard_count'], 'baseline 56'); print('D-2 frontmatter residual:', len(fm)); sys.exit(0 if d['count'] &lt; 56 else 1)"</automated>
  </verify>
  <done>
The linter reports strictly fewer than 56 violations, which is the contractual pass bar.

The SUMMARY exists and records the final count, the D-2 residual, every remaining violation with
its reason, every glossary exception, and every cell deliberately left alone.

No fact, condition, scope qualifier or hedge changed meaning anywhere in the file.
  </done>
</task>

</tasks>

<threat_model>
Configured level: OWASP ASVS Level 1. Blocking threshold: high.

**The change surface is one non-executable markdown file.** The pass adds no code, no
dependency, no package-manager install, no network call, no input parser and no new data path.
No task in this plan installs an npm, pip or cargo package, so the package-legitimacy gate does
not apply and no supply-chain threat row belongs here. **No ASVS Level 1 threat applies to this
change surface.** The register below records the one real risk this pass carries, which is a
correctness risk in agent-facing instructions rather than an ASVS control failure. Stating it
here is honest disclosure, not an invented threat.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plan author → skill file | Rewritten prose enters a file that later instructs an agent |
| skill file → future agent | An agent reads this file and decides whether to destroy a running emulator instance |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mmk-01 | Tampering | `src/skills/vice-wedge-triage/SKILL.md` prose | medium | mitigate | A rewrite could harden a hedge into a claim, so a later agent recycles a healthy emulator on a false diagnosis. Task 3 reads the whole diff against the `ca02a89c` blob and checks the hedge census and every "never recycle" prohibition before the plan closes |
| T-mmk-02 | Tampering | Provenance and Troubleshooting table cells | medium | mitigate | A rewrite could drop a measurement, a binary path, a date or a confidence grade from an evidence record. Rule R8 and Task 2 forbid row-level edits, and Task 3 checks the 59 row lines and the 132 backticked tokens |
| T-mmk-03 | Information disclosure | The file's content | low | accept | The file is already public in a published npm package and a public plugin marketplace. This pass adds no new content, so it discloses nothing new |
| T-mmk-04 | Elevation of privilege | Execution surface | low | accept | Markdown is not executable and the plan runs no installer and no build. There is no privilege to elevate |

No threat reaches the configured blocking threshold of high. Nothing here blocks execution.
</threat_model>

<verification>
The one permitted automated check, run against the finished file:

`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/vice-wedge-triage/SKILL.md`

Pass bar, both halves required. The reported violation count falls strictly below the baseline
of 56. AND the pass changed no fact, no condition, no scope qualifier and no hedge.

The linter cannot measure the second half. You establish it by reading the diff, which is Task
3's whole job. A lower count with a hardened hedge is a FAILED pass, not a passed one.

No test file. No test-suite run. No invocation of the skill. No behavioural check.
</verification>

<success_criteria>
- ste-lint reports fewer than 56 violations for `src/skills/vice-wedge-triage/SKILL.md`.
- The file still has 59 table-row lines, and no row was split, merged, added or removed.
- The `description:` frontmatter field is byte-identical to its pre-pass state.
- The fenced code block is byte-identical to its pre-pass state.
- Every backticked verbatim token present before the pass is present after it.
- Every hedge reads at least as tentatively as it did before, and every prohibition at least as
  strongly.
- No file other than `src/skills/vice-wedge-triage/SKILL.md` and the SUMMARY changed.
</success_criteria>

<output>
Create `.planning/quick/260915-mmk-vice-wedge-triage-skill-apply-the-ste100-strict-pass-followi/260915-mmk-SUMMARY.md` when done.

In the SUMMARY, record explicitly:
- Final ste-lint count against the baseline of 56, and the hard count against the baseline of 34.
- The 3 line-3 `description:` violations that remain permanently under decision D-2.
- Every other remaining violation, with the reason it stays.
- Every glossary exception taken under R1, each with the verbatim token that forced it.
- Every table cell left untouched because shortening it would have cost a fact.
</output>
