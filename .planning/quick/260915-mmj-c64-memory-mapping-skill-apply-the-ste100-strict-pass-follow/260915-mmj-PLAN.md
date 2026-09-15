---
phase: quick-260915-mmj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: ["src/skills/c64-memory-mapping/SKILL.md"]
autonomous: true
must_haves:
  truths:
    - "The ste-lint violation count for src/skills/c64-memory-mapping/SKILL.md is strictly below the baseline of 71."
    - "No fact, condition, scope qualifier, hedge, measurement, date, address or verbatim token changed meaning."
    - "The description: field in the YAML frontmatter is byte-identical to its committed form."
    - "Every fenced code block is byte-identical to its committed form."
  artifacts:
    - "src/skills/c64-memory-mapping/SKILL.md"
  key_links:
    - "The whole file uses the fixed verb glossary identically, apart from the two named domain-term keeps."
---

<objective>
Apply the ASD-STE100 strict pass to `src/skills/c64-memory-mapping/SKILL.md`.

Purpose: an agent parses this playbook with no human present to resolve an
ambiguous sentence. Prose semicolons, rotated synonyms and agentless passives are
the three habits that make it easy to misparse.

Output: one modified file, `src/skills/c64-memory-mapping/SKILL.md`, with a
strictly lower ste-lint violation count and no semantic change of any kind.

This plan is a prose rewrite only. It adds no test, it runs no test suite, it
invokes nothing in the skill, and it creates no new file.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ste100-batch-rules.md
@src/skills/c64-memory-mapping/SKILL.md
@/home/henrik/.claude/skills/asd-ste100/SKILL.md
</context>

<binding_rules>

These rules are binding. This plan restates them in full, so you can run it without
reading any other document.

**The fixed verb glossary. Apply it identically across the whole file.**

| Use this word | Never these |
|---|---|
| check | confirm, verify, validate |
| correct | fix, repair |
| change | modify, alter |
| stop | halt, terminate |
| get | fetch |
| start | launch, begin |
| remove | delete, erase |
| show | display |

**The structural rules.**

1. Delete every prose semicolon. A clause join becomes two sentences. A
   semicolon-chained list item takes a full stop.
2. Split any sentence over 20 words in a procedure, over 25 elsewhere.
3. Convert passive to active wherever the actor is named or obvious from the
   sentence. Leave the passive where the object is the topic of a lookup row or a
   symptom row.
4. Keep the compound tense wherever it carries current relevance.
5. A table cell is a record. Apply STE to the sentences INSIDE a cell. Never split
   a row, never merge two rows, never move a cell to another column. This file is
   dense with per-bit register tables and address lookup rows, so this rule is
   load-bearing here.

**The preservation rules. A breach of any one of these fails the plan even if the
violation count drops.**

- Preserve every fact, condition, scope qualifier and hedge. "may have failed"
  never becomes "failed". "may appear", "is likely to be", "probably", "usually",
  "almost always" and "can silently" all stay exactly as written.
- Preserve every measurement, byte count, address, line citation (`driver.mjs:270`),
  date and version number exactly.
- Never touch the `description:` field on line 3 of the YAML frontmatter. It is
  exempt by decision D-2 of the source note. It is a retrieval index, not prose.
- Never touch a fenced code block, a tool name, a register name, a binary path, a
  command string or any other verbatim token.

</binding_rules>

<traps>

These are the specific places in THIS file where a mechanical pass produces a wrong
edit. The planner checked each one against the file before writing this plan. Do
not edit any of them.

| Site | What it is | Rule |
|---|---|---|
| Line 3, the `description:` field | Retrieval index, exempt by D-2 | Never touch. Its two `long-sentence` hits (37 words, 33 words) are permanent. Expect both of them in the final count. |
| Fenced blocks at lines 11-18, 31-50, 57-59, 66-78, 104-106, 108-118, 139-145 (indented by 2 spaces), 358-365 | Sample command lines and sample tool output | Never touch. The linter already skips them. |
| Line 515, `**Read-modify-write**` | A 6502 term of art | Never write "read-change-write". The `synonym-rotation` hit on this line is a DELIBERATE KEEP. |
| Line 186, `which are read-only` | `read-only` is an adjective | A false `passive-voice` positive. Never rewrite it. |
| Line 408, `terminated by `$00`, `$0D`, or a high-bit sentinel` | String termination, not the halt sense | Never write "stopped by". The glossary's stop/terminate rule does not reach this word. |
| Lines 541, 571, 572, 574, 581, 583, the words `prefix` and `prefixed` | The substring "fix" inside an unrelated word | Never rewrite. The only real glossary hit for this cluster is the table header `Fix` on line 622. |
| Lines 184, 629, 630, `git checkout` | A verbatim command | Never touch. The substring "check" inside it is not a glossary hit. |
| Line 629, the literal `` `no memmap.json; run: node driver.mjs memmap` `` | The program's own error string, inside backticks | Never touch that semicolon. It is not one of the 36 prose semicolons. The linter skips inline code, and the only semicolon it flags on line 629 is the prose one after "rather than rebuilding". |
| Lines 33 and 45, the words `display` and `Display` | Inside a fenced sample-output block | Never touch. |
| Line 464, `a report that stopped looking` | Already uses the approved verb | Leave as written. |

</traps>

<tasks>

<task type="auto">
  <name>Task 1: Delete all 36 prose semicolons</name>
  <files>src/skills/c64-memory-mapping/SKILL.md</files>
  <read_first>
    Read `src/skills/c64-memory-mapping/SKILL.md` once, in full, before editing.
    Read the `<binding_rules>` and `<traps>` sections of this plan first.
  </read_first>
  <action>
Delete every prose semicolon in the file. The linter reports 36 of them. They sit
on these lines in the committed file: 173, 194, 195, 211, 232, 245, 282, 294, 312,
322, 340, 342, 353, 386, 387, 388 (two on this line), 389, 393, 396, 407, 408, 411,
419, 425, 446, 474, 543, 550, 562, 624, 625, 627, 628, 629, 630.

Line numbers shift as edits land. Re-run the linter to re-locate the remaining
sites rather than trusting a stale number.

Two shapes appear, and each takes a different edit.

A clause join becomes two sentences. Example, lines 177-180 in the committed file:
"One of the four sources ... is fetched over plain HTTP with no TLS, and the only
guard against a bad rebuild is a per-source emptiness check plus a 600-entry floor
across all sources combined (driver.mjs:262, 268) — so a partially-reachable or
partially-changed source set can silently replace good tracked data with less of
it." Task 2 rewrites the verb here. The semicolon work in this task is the clause
split itself.

A semicolon-chained list takes a full stop per item. Lines 386-389 and 396 and
407-408 and 411 are the "Recognising each kind" paragraphs, where a semicolon
separates each recognition cue. Give each cue its own sentence. Keep every cue,
every byte count, every address range and every instruction mnemonic exactly as
written. Do not compress two cues into one.

Table-cell semicolons sit on lines 474, 624, 625, 627, 628, 629 and 630. Split the
prose INSIDE the cell into two or more sentences. The row keeps its pipes, its
column count and its column order.

Line 627 carries the file's only addressable `long-sentence` hit (29 words) in the
same cell as a semicolon. Split it into three sentences, which clears both hits at
once: "Nothing in the four tables names that address." / "This answer is normal for
the game's own code." / "Take the region and name the address from what the code
does with it."

Line 419 carries a semicolon and two passive hits in one sentence. Task 3 handles
the passives. Splitting the sentence here is enough for this task.

On line 629, delete ONLY the prose semicolon after "rather than rebuilding". The
semicolon inside the backticked error string on the same line is the program's own
output and stays byte-identical.

After editing, read your own `git diff` for this file. Confirm that no fenced code
block appears in the diff and that line 3 does not appear in the diff.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-memory-mapping/SKILL.md | python3 -c 'import json,sys; n=json.load(sys.stdin)["count"]; print("STE100 violations:", n, "- baseline 71, gate 38"); sys.exit(0 if n in range(39) else 1)'</automated>
  </verify>
  <done>
The linter reports zero `semicolon` violations for the file. The total count is 38
or lower, down from 71. The `git diff` touches no fenced code block and no line of
the YAML frontmatter. Every fact, hedge, measurement and verbatim token on every
edited line reads exactly as it did before.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply the fixed verb glossary and split the over-long sentence</name>
  <files>src/skills/c64-memory-mapping/SKILL.md</files>
  <read_first>
    Re-read the `<binding_rules>` verb glossary table and the `<traps>` table of
    this plan. Re-run the linter to get the current line numbers.
  </read_first>
  <action>
Apply the fixed verb glossary across the whole file. The linter flags six
`synonym-rotation` hits. Five are addressable and one is a deliberate keep.

check / confirm / verify cluster — use `check` everywhere:
- `confirm` at committed lines 131, 157, 177 and 352 becomes `check`.
- `verify` at committed line 135 becomes `check`.
- `verified` at committed lines 286, 328 and 371 becomes `checked`.
- `Checked` at committed line 150 already uses the approved word. Leave it.
- Where a sentence states a proof bar, keep the proof-bar wording around the verb
  intact. "concrete proof that it executes" (line 256) and "A region earns the Code
  type only when at least one of these holds" (line 258) are conditions, not verbs.
  Do not weaken or reword them.

correct / repair cluster — use `correct` everywhere:
- `repairing` at committed line 203 becomes `correcting`.
- `corrected` at committed line 213 already uses the approved word.
- `correction` at committed lines 173 and 184 already uses the approved noun.

remove / delete cluster — use `remove`:
- `deleted` at committed line 214 becomes `removing`, inside the Task 3 rewrite of
  that sentence. If Task 3 runs after this task, make the word change here and let
  Task 3 keep it.

get / fetch cluster — use `get`:
- `fetched` at committed line 179 becomes `gets`, in an active recast that also
  clears the `passive-voice` hit on the same line. Worked example, and the meaning
  it must preserve exactly:

  Before: "One of the four sources (`http://unusedino.de/…`, driver.mjs:33) is
  fetched over plain HTTP with no TLS, and the only guard against a bad rebuild is
  a per-source emptiness check plus a 600-entry floor across all sources combined
  (driver.mjs:262, 268) — so a partially-reachable or partially-changed source set
  can silently replace good tracked data with less of it."

  After: "`memmap` gets one of the four sources (`http://unusedino.de/…`,
  driver.mjs:33) over plain HTTP with no TLS. The only guard against a bad rebuild
  is a per-source emptiness check plus a 600-entry floor across all sources
  combined (driver.mjs:262, 268). A partially-reachable or partially-changed source
  set can therefore silently replace good tracked data with less of it."

  The hedge "can silently", both `driver.mjs` citations, the 600-entry floor and
  the URL all survive unchanged.

correct / fix cluster — the Troubleshooting table header:
- Committed line 622, `| Symptom | Fix |`, becomes `| Symptom | Correction |`. This
  edits one header cell. It does not change the column count or the row.

change / modify cluster — DELIBERATE KEEP:
- `**Read-modify-write**` at committed line 515 is a 6502 term of art. Leave it
  exactly as written. Its `synonym-rotation` hit stays on the books. Do not clear
  it by renaming `changing` or `changes` elsewhere in the file to `modify` — that
  would break the glossary in the other direction.

show / display cluster:
- The only `display` occurrences are on committed lines 33 and 45, inside a fenced
  sample-output block. Leave them. `show` and `shows` elsewhere are already the
  approved word.

Sentence length. Committed line 627 is the file's only addressable `long-sentence`
hit outside the exempt frontmatter. Task 1 splits it. If it is still flagged after
Task 1, split it here as described in Task 1.

The two `long-sentence` hits on line 3 are permanent. Do not touch line 3.

After editing, read your own `git diff` for this file and confirm the same two
things Task 1 confirmed: no fenced block in the diff, no frontmatter line in the
diff.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-memory-mapping/SKILL.md | python3 -c 'import json,sys; n=json.load(sys.stdin)["count"]; print("STE100 violations:", n, "- baseline 71, gate 33"); sys.exit(0 if n in range(34) else 1)'</automated>
  </verify>
  <done>
The linter reports at most one `synonym-rotation` violation, and that one is the
`Read-modify-write` keep on the deliberate-keep list. It reports at most two
`long-sentence` violations, and both are on line 3 in the exempt `description:`
field. The total count is 33 or lower.
  </done>
</task>

<task type="auto">
  <name>Task 3: Convert the named passives to active voice</name>
  <files>src/skills/c64-memory-mapping/SKILL.md</files>
  <read_first>
    Re-read the `<traps>` table of this plan. Re-run the linter to get the current
    line numbers for the remaining `passive-voice` hits.
  </read_first>
  <action>
Convert a passive to active ONLY where the actor is named in the sentence or is
obvious from the surrounding text. Leave the passive where the object is the topic
of a lookup row or a symptom row. The linter treats `passive-voice` as advisory, so
a residual hit is acceptable. A wrong rewrite is not.

Convert these. The actor is named or obvious in every one. Committed line numbers:

- 81, "is prepended" — `annotate` is the actor. "`annotate` prepends a header block
  that lists every referenced address with its full description, symbol and region
  (elided above)." Keep the measurement clause that follows as its own sentence,
  with the 23-line, 25-line, eleven-line, nine-line and "a little over 2x" figures
  exactly as written.
- 95 and 625, "are held" and "are capped" — `annotate` is the actor. "`annotate`
  holds flow instructions (`JMP`, `JSR`, branches, `RTS`, `RTI`) to 2 bytes
  regardless of `--max-span`." Line 625 is a table cell. Rewrite the sentence
  inside the cell only.
- 213, "is corrected" — the notice is the actor. "This notice corrects that forecast
  rather than removing it." Keep the preceding sentences about the withdrawn
  `gen-enums` verb and the 2026-08-31 ACME export route exactly as written.
- 232, "is invoked" — the reader is the actor. "You do not invoke either one as a
  job on its own."
- 318, "is capped" — the tool is the actor. "`anno_read_region` caps the combined
  byte count at **4096 bytes** per call (`ANNO_READ_REGION_MAX_BYTES`)."
- 319, "is refused" — the same actor. "It refuses a request above the cap by name
  rather than truncating it." Keep the "so walk a large binary in consecutive
  ranges" instruction.
- 329, "is classified" — `anno_disassemble` is the actor. "`anno_disassemble`
  performs no write, so it classifies nothing until you say so."
- 354, "is returned" — the read is the actor. "That read returns the true match
  count beside the list."
- 419 and 420, "is copied" and "is passed" — the program is the actor. "If the
  program copies it to `$0400`, it is screencode. If the program passes it to
  CHROUT, it is PETSCII." Keep the following sentence about garbage rendering
  exactly as written.
- 467, "is pinned" — the act of quoting is the actor. "Quoting the revision pins the
  report to an exact store state rather than to 'after the pass'."
- 488, "was decided" — the actor is named in the sentence itself, "by the program's
  code". "No table can tell you, because the program's code decided the meaning."
- 510, "is touched" — "returns every site that touches it."
- 615, "was renamed" and "was commented" — the reader is the actor. "what you
  renamed, what you commented".

Leave these alone. Each is either a false positive or a case where the object is
the topic:

- 186, "are read" — `read-only` is an adjective. False positive. Never touch.
- 128, "is banked" — "wherever ROM is banked in" is the C64 idiom. The actor is
  irrelevant.
- 293, "is left" — "**Whatever is left**" is a noun phrase and a list heading.
- 477, "is misplaced" — a symptom table cell. The half boundary is the topic.
- Optional, in every case. Convert one only if the recast reads cleanly and changes
  no fact. The four sites are 172, "is committed", 312 and 353, "is REQUIRED", 423,
  "was closed", and 520, "is reached". If you convert 312 or 353, keep the
  uppercase `REQUIRED` emphasis and keep "with no default" / "has no default"
  intact.

Keep every compound tense that carries current relevance. "CLOSED 2026-08-29 when
the store changed underneath it", "the ACME export route did come back on
2026-08-31" and "that verb is WITHDRAWN from this surface" all state a state that
holds now. Leave them.

After editing, read your own `git diff` for the whole file one last time. Walk it
hunk by hunk and confirm three things: no fenced code block changed, line 3 did not
change, and no fact, condition, scope qualifier, hedge, measurement, date, address,
tool name, register name or command string changed meaning anywhere.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-memory-mapping/SKILL.md | python3 -c 'import json,sys; n=json.load(sys.stdin)["count"]; print("STE100 violations:", n, "- baseline 71, gate 27"); sys.exit(0 if n in range(28) else 1)'</automated>
  </verify>
  <done>
The total ste-lint violation count is 27 or lower, strictly below the baseline of
71. The residual hits are only these three kinds: the two permanent
`long-sentence` hits in the exempt `description:` field, the one deliberate
`Read-modify-write` keep, and the `passive-voice` hits on the leave-alone list. The
`git diff` shows no change to any fenced code block, to line 3, or to the meaning
of any fact, condition, scope qualifier or hedge.
  </done>
</task>

</tasks>

<threat_model>
ASVS level 1. Blocking threshold: high.

**The change surface is one non-executable markdown file.** This plan edits prose in
`src/skills/c64-memory-mapping/SKILL.md`. It adds no code, no dependency, no
package-manager install, no network call, no file read at runtime and no new
executable path. The plan explicitly forbids any change to a fenced code block, a
command string, a binary path or any other verbatim token, so no command a reader
copies out of this file can change either.

**No ASVS-1 threat applies to this change.** The register below records that
conclusion rather than inventing a threat to fill the table.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| author → shipped skill text | Prose an agent later reads as instructions. Nothing crosses this boundary at runtime, and the boundary carries no data, no credential and no command execution. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260915-mmj-01 | Tampering | `src/skills/c64-memory-mapping/SKILL.md` prose | low | accept | A rewrite could in principle change a documented command or a safety warning into a harmful one. The plan removes this by construction. It forbids every change to a fenced code block, a command string, a binary path, a register name and any other verbatim token. It also names each such site individually in the traps table. No ASVS-1 control applies to non-executable documentation. |
| T-260915-mmj-02 | Information disclosure | same file | low | accept | The file carries no secret, no credential and no private host path. The plan adds none. |
| T-260915-mmj-SC | Tampering | npm/pip/cargo installs | low | accept | This plan runs no package-manager install and adds no dependency. No package-legitimacy audit is required, and no legitimacy checkpoint is needed. |

**Safety-warning preservation, recorded here because it is the only real risk.**
This file carries operational warnings that a careless rewrite could weaken — that
`memmap` overwrites tracked data in place with no backup and no diff, that one of
its four sources travels over plain HTTP with no TLS, and that `lookup` and
`annotate` are read-only while `memmap` is not. Every task in this plan forbids any
change to a fact, condition, scope qualifier or hedge, and Task 2 carries the
`memmap`/HTTP sentence as a worked before-and-after example so the warning survives
the recast word for word.
</threat_model>

<verification>
One command, the one the task author mandated:

```
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-memory-mapping/SKILL.md
```

Pass bar: the violation count is strictly below the baseline of 71, with no
semantic change to any fact, condition, scope qualifier or hedge.

Baseline, measured 2026-09-15 on the committed file: 71 total. 36 `semicolon`, 26
`passive-voice`, 6 `synonym-rotation`, 3 `long-sentence`. 45 hard, 26 advisory.

Expected residual after the pass: about 20, made of the 2 permanent frontmatter
`long-sentence` hits, the 1 `Read-modify-write` keep, and the leave-alone
`passive-voice` hits.

Run no other check. This plan adds no test file, runs no test suite, and invokes
nothing in the skill.
</verification>

<success_criteria>
- `src/skills/c64-memory-mapping/SKILL.md` is the only file changed.
- The ste-lint violation count is strictly below 71.
- Zero `semicolon` violations remain.
- At most one `synonym-rotation` violation remains, and it is the
  `Read-modify-write` keep.
- At most two `long-sentence` violations remain, and both are on line 3.
- The `description:` field and every fenced code block are byte-identical to their
  committed form.
- No fact, condition, scope qualifier, hedge, measurement, date, address, tool
  name, register name, command string or other verbatim token changed meaning.
- No table row was split, merged or reordered.
</success_criteria>

<output>
Create `.planning/quick/260915-mmj-c64-memory-mapping-skill-apply-the-ste100-strict-pass-follow/260915-mmj-SUMMARY.md` when done.

Record in it: the final violation count, the per-rule residual breakdown, and a
"Kept as-is" list naming every violation left on the books on purpose with the
reason for each.
</output>
