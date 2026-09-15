---
quick_id: 260915-mml
phase: quick-260915-mml
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-mml]

files_modified:
  - src/skills/routine-queue-walker/SKILL.md

must_haves:
  truths:
    - "ste-lint reports fewer than 50 violations for src/skills/routine-queue-walker/SKILL.md."
    - "ste-lint reports zero `semicolon` violations for that file."
    - "ste-lint reports zero `synonym-rotation` violations for that file."
    - "The two remaining `long-sentence` violations both sit on line 3 (the exempt `description:` field)."
    - "Every fact, condition, scope qualifier and hedge in the file reads the same as before the pass."
  artifacts:
    - src/skills/routine-queue-walker/SKILL.md
  key_links:
    - "Line 3 (`description:` frontmatter) is byte-identical to HEAD — decision D-2 exempts it."
    - "Every fenced code block is byte-identical to HEAD."
    - "Procedure step numbering and step order in Phases 0-5 are unchanged."
---

<objective>
Apply the ASD-STE100 strict pass to one file: `src/skills/routine-queue-walker/SKILL.md`.

Purpose: an agent parses this playbook, with no human present to resolve an ambiguous
sentence. This pass removes the two mechanical habits that make it ambiguous — the
prose semicolon and the rotating verb. It also splits the over-long procedure
sentences. It changes no fact the playbook states.

Output: the same file, with a strictly lower ste-lint violation count and identical
meaning. No other file changes.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/home/henrik/dev/henrik/git/c64-re-tools/src/skills/routine-queue-walker/SKILL.md
@/home/henrik/dev/henrik/git/c64-re-tools/.planning/ste100-batch-rules.md
@/home/henrik/dev/henrik/git/c64-re-tools/.planning/notes/ste100-conformance-of-the-shipped-skills.md

The authority on the rewrite itself is the host-global `asd-ste100` skill at
`~/.claude/skills/asd-ste100/SKILL.md`. Read it before editing. Its linter is
`~/.claude/skills/asd-ste100/scripts/ste-lint.py` (stdlib-only Python, skips fenced
code blocks and inline code spans).
</context>

<binding_rules>
This plan states these rules in full. Do not follow a summary of them from anywhere
else. They bind every edit in every task below.

**The verb glossary. One word per action, everywhere in the file:**
check (never confirm / verify / validate), correct (never fix / repair),
change (never modify / alter), stop (never halt / terminate), get (never fetch),
start (never launch / begin), remove (never delete / erase), show (never display).

**The mechanical rules:**
- Delete every prose semicolon. A clause join becomes two sentences. A
  semicolon-chained list item takes a full stop.
- Split sentences over 20 words in a procedure, over 25 elsewhere.
- Convert passive to active wherever the actor is named. Leave the passive where the
  object genuinely is the topic of a lookup row or of a specification statement.
- Keep the compound tense where it carries current relevance.

**The prohibitions. Each one is hard:**
- NEVER touch the `description:` field in the YAML frontmatter (line 3). Decision D-2
  exempts it permanently: it is a retrieval index, deliberately keyword-packed, and a
  word cap fights that packing. Its two `long-sentence` violations stay on the books.
- NEVER touch a fenced code block, a tool name, a register name, a binary path, a
  version number, or any other verbatim token.
- A table cell is a record. Apply STE to the sentences inside a cell. Never split a
  row, never merge two rows, never change a row's columns.
- Preserve every fact, every condition, every scope qualifier and every hedge.
  "may have failed" never becomes "failed". "almost always" never becomes "always".
  "very likely packed" never becomes "packed".
- Do not reorder, merge, renumber or re-nest a procedure step. Step ORDER is
  load-bearing in this playbook. Splitting one step's sentence into two sentences is
  correct. Splitting one step into two numbered steps is not.
- Do not change a `##` or `###` heading's text. Other files and this file's own prose
  cite these headings by name ("Phase 2.3's refresh point", "Phase 4's leftovers
  table").
- Change nothing outside `src/skills/routine-queue-walker/SKILL.md`.

**What this plan does NOT do.** It runs no test suite, adds no test file, invokes no
skill, and runs no behavioural or round-trip check. The one permitted check is the
ste-lint text linter named in each task's verify block.

**The linter's exit code is 1 even on a good result.** `ste-lint.py` exits 1 while any
hard violation remains above its baseline, and the two exempt `long-sentence`
violations on line 3 never go away. Judge every task by the parsed `count` fields in
the JSON, never by the exit status.

**Line numbers drift.** Every line number below comes from the baseline file at HEAD.
Each edit moves the lines under it. Re-run the linter to get fresh line numbers rather
than trusting a stale number from this plan.
</binding_rules>

<baseline>
Measured 2026-09-15 against HEAD, `python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/routine-queue-walker/SKILL.md`:

| Rule | Level | Count |
|---|---|---|
| `semicolon` | hard | 19 |
| `passive-voice` | advisory | 22 |
| `synonym-rotation` | hard | 4 |
| `present-perfect` | advisory | 3 |
| `long-sentence` | hard | 2 (both on line 3, both exempt under D-2) |
| **total** | | **50** |

3116 words, 1.6 violations per 100 words.
</baseline>

<tasks>

<task type="auto">
  <name>Task 1: Delete all 19 prose semicolons</name>
  <files>src/skills/routine-queue-walker/SKILL.md</files>
  <read_first>
    `~/.claude/skills/asd-ste100/SKILL.md` — the rewrite authority.
    The whole of `src/skills/routine-queue-walker/SKILL.md`. Read it end to end before
    the first edit. This is a procedure-heavy playbook and a sentence in one phase
    often states a condition another phase depends on.
  </read_first>
  <action>
Remove every prose semicolon from the file. Two shapes appear and they take different
treatments.

**Shape 1 — a clause join inside a sentence. It becomes two sentences.** Baseline
locations, with the joining semicolon named:
line 16 (`answers *what is this program*; this one answers`),
line 75 (`That is the only test; do not guess`),
line 80 (`Keep the answer; Phase 3 reuses it`),
line 127 (`still ends the routine; no return may mean fall-through`),
line 170 (`in the zero page; \`p_XXXX\`, \`f_XXXX\` ... outside it`),
line 199 (`No write is performed; the writes already landed`),
line 239 (`the load origin; \`--store\` names the`),
line 250 (`no producer left in this repo**; it is still accepted`),
line 257 (`the capture is truncated; re-capture it`),
line 316 (`names the annotation store; \`--disagreements\` names`),
line 318 (`wrote for THIS store's own run; \`--manifest\` names`),
line 332 (`an unresolved disagreement); go back to the`),
line 345 (`replay that one entry; never widen the range`),
line 365 (`neither is a new mechanism`).

**Shape 2 — a semicolon-chained list. Each item takes a full stop.** Baseline
locations: the bullet list at lines 102, 104 and 109 (the Candidate source B bullets
in section 2.1, step 4), and the three-item serial list on line 268 (`once before
Phase 2 ...; once at Phase 2.3's refresh point; and once at the end`). For line 268,
keep all three runs and keep their order — the sentence states when to run the
measurement three times, and each occasion is a separate fact.

**Preservation rules for this task:**
- Line 170 carries a real distinction — `zpp_XX`/`zpf_XX`/`zpa_XX` are the zero-page
  patterns and `p_XXXX`/`f_XXXX`/`a_XXXX`/`e_XXXX` are the patterns outside the zero
  page. Whatever replaces the semicolon must keep both halves and keep which pattern
  set belongs to which region.
- Line 127's two clauses are two different bound rules (a `JMP shared_epilogue` still
  ends the routine, AND no return may mean fall-through). Keep the hedge "may mean".
- Line 332's clause after the semicolon is an instruction that follows a
  parenthesised list. Keep the list intact and make the instruction its own sentence.
- Line 345's `never widen the range or drop the \`base_revision\`` is a prohibition.
  It stays a prohibition, with both of its objects.
- Do not touch a semicolon inside a fenced code block or inside an inline code span.
  The linter already ignores those, so a change there can only do harm.
- Keep the file's existing hard wrap (roughly 76 columns). Re-wrap only the paragraph
  or list item you edited.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/routine-queue-walker/SKILL.md > /tmp/ste-260915-mml-t1.json ; python3 -c "import json,collections,sys; d=json.load(open('/tmp/ste-260915-mml-t1.json')); c=collections.Counter(v['rule'] for v in d['violations']); print('total',d['count'],dict(c)); sys.exit(0 if c['semicolon']==0 and 31 >= d['count'] else 1)"</automated>
  </verify>
  <done>
    The linter reports zero `semicolon` violations and a total of 31 or fewer.
    `git diff` shows changes only inside `src/skills/routine-queue-walker/SKILL.md`,
    only outside fenced code blocks, and never on line 3.
    Every numbered step keeps its number, its position and its nesting.
  </done>
</task>

<task type="auto">
  <name>Task 2: Collapse the four rotating verb clusters and convert the named-actor passives</name>
  <files>src/skills/routine-queue-walker/SKILL.md</files>
  <read_first>
    The file as Task 1 left it. Re-run the linter first to get current line numbers.
  </read_first>
  <action>
**Part A — the four rotating verb clusters (4 hard violations).** The linter records
the FIRST member of a cluster it meets in the file as the keeper and flags every other
member. A cluster clears only when one single member of it remains anywhere in the
file. The glossary above decides which member survives, not document order.

1. **check / confirm.** Keep `check`. Baseline line 88 reads `For each candidate
   target, confirm it and gather its full caller list`. Baseline line 360 reads `and
   review confirms the runtime evidence is correct`. Both `confirm` words must go.
   Line 88 means "establish that the target really is a routine" — a bare "check it"
   loses that, so write the fuller form, for example `check that it is a real routine`.
   Line 360 states a CONDITION that has already been met (the review found the
   evidence correct), not an action to perform. Do not write "review checks", which
   would turn a met condition into a pending action. Use a verb outside every cluster,
   for example `and a review finds the runtime evidence correct`.
2. **stop / halt.** Keep `stop`. Baseline line 186 reads `**No premature halting.**`.
   Rewrite it to use `stop`, for example `**No premature stopping.**`. `stop` already
   appears at baseline lines 15, 48, 188 and 324 and those stay as they are.
3. **correct / fix.** Keep `correct`. The only `fix`-cluster word in the body is
   `fixed` at baseline line 208, inside `text at a fixed address, a jump table, a
   sprite block`. It is an adjective there. Replace it with a word in no cluster that
   states the same fact — the address does not move — for example `text at a constant
   address`. Do NOT change `correct` at baseline line 245 (`is now correct against the
   shipped verb`), which is the glossary keeper. `correctness` on line 27 is a
   different word, matches no pattern, and stays.
4. **get / fetch.** Keep `get`. The only `fetch` word is `already-fetched` at baseline
   line 29, inside `several agents *thinking* over already-fetched answers`. Rewrite
   it with `get`, for example `over answers they already got`. Do not reach for
   `obtain` or `retrieve` — both sit in the same cluster and would re-open it. Do NOT
   change `get` at baseline line 257 (`If you get that refusal`).

Before finishing Part A, re-read the whole file for any other cluster word the
baseline did not flag, and keep the glossary word everywhere.

**Part B — passive voice (22 advisory violations).** Convert only where the actor is
named or is unambiguously the reader ("you"). Leave the rest. This plan sets the
disposition of every baseline hit below. Follow it.

CONVERT to active:
- line 50 `the moment the real image is recovered` — the reader recovers it.
- line 63 `once the bytes around it are known to be code` — the reader knows it.
- line 90 `when the entry is written up in Phase 2.2` — the reader writes it up.
- line 115 `What is left is the routine queue` — use `What remains is the routine
  queue`. Same fact, no actor invented.
- line 117 `the context every other routine is read against` — the reader reads it.
- line 139 `the checkpoint this pass is measured from` — the reader measures from it.
- line 176 `What is left is the symbol queue` — same treatment as line 115.
- line 191 `unless the remainder is reported explicitly, in full` — the reader reports
  it. Keep all three qualifiers: explicitly, in full, and under Phase 4's leftovers
  table.
- line 207 `How many regions are classified, grouped by type` — the reader classified
  them.
- line 224 `every symbol that was left undone` — the reader left it undone.
- line 277 `means the wrong things were named` — the reader named them. This is a
  finding statement in a bolded lead-in. Keep it as a finding, do not soften it.
- line 278 `the queue was worked over the easily-visible part of the program` — the
  reader worked it.
- line 325 `The walk described in Phases 2-4 above is finished for a fixture when ...
  exits 0` — make the walk the subject of an active verb, for example `finishes`. The
  clause `never when the agent believes the queue is empty` stays word for word.

LEAVE the passive (do not edit these):
- line 38 `whatever was recorded last` — the actor is unknown and that is the point.
- line 60 `## Phase 1 — make sure blocks are classified` — a heading. Headings do not
  change.
- line 97 and line 166 `on a program nothing has been named in yet` — the object is
  the topic, and the compound tense carries current relevance.
- line 238 `**\`--store\` is REQUIRED and is a second path ...**` and line 315 `All
  three arguments are REQUIRED, and none is derived from another` — specification
  statements about the tool's own contract. The emphasis and the word REQUIRED are
  verbatim.
- line 257 `the capture is truncated` — a state of the file, not an action by an actor.
- line 320 `which were declared not-executed and why` — this describes what the
  committed manifest records. Leave it unless you can name the actor without adding a
  fact the file does not state.

**Part C — present perfect (3 advisory violations). Change none of them.** Baseline
lines 97 and 166 (`nothing has been named in yet`) and line 342 (`a \`base_revision\`
that the store has moved past`) all carry current relevance: the store's state right
now is the whole point of each sentence. The rules keep the compound tense in exactly
this case. These three violations stay in the final count on purpose.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/routine-queue-walker/SKILL.md > /tmp/ste-260915-mml-t2.json ; python3 -c "import json,collections,sys; d=json.load(open('/tmp/ste-260915-mml-t2.json')); c=collections.Counter(v['rule'] for v in d['violations']); pp=c['present-perfect']; print('total',d['count'],dict(c)); sys.exit(0 if c['semicolon']==0 and c['synonym-rotation']==0 and 14 >= c['passive-voice'] and pp==3 and 20 >= d['count'] else 1)"</automated>
  </verify>
  <done>
    The linter reports zero `semicolon` violations, zero `synonym-rotation`
    violations, 14 or fewer `passive-voice` violations, exactly 3 `present-perfect`
    violations, and a total of 20 or fewer.
    Every LEAVE-listed passive above is still present, unedited.
    No heading text changed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Split the over-long sentences the linter cannot see, then check the whole diff for meaning</name>
  <files>src/skills/routine-queue-walker/SKILL.md</files>
  <read_first>
    The file as Task 2 left it, end to end.
  </read_first>
  <action>
**Why this task cannot be driven by the linter.** `ste-lint.py` measures sentence
length per LINE, and this file is hard-wrapped at roughly 76 columns. A sentence that
runs across three wrapped lines is therefore never measured, and the linter reports
only two `long-sentence` violations — both on the exempt line 3. Apply the word caps
by reading, not by the linter. This task will not move the linter count much. Expect
that.

**The caps.** Count the words of each real sentence across its wrapped lines.
- 20 words maximum inside a procedure: the numbered steps of Phase 0, Phase 1, Phase
  2.1, Phase 3.1 and Phase 4, the bullets under section 2.1 step 4 and section 3.1
  step 3, the instruction bullets under `## When something fails`, and the imperative
  prose of sections 2.2, 2.3, 3.2, 3.3 and the two gate paragraphs in Phase 5.
- 25 words maximum everywhere else: the explanatory paragraphs, the rationale under
  `## The one rule that makes this different from upstream's version`, and the three
  interpretation bullets under Phase 5.

**How to split.** One idea per sentence. Keep the original order of the ideas. Put the
condition before the instruction it governs. Prefer breaking at a coordinating
conjunction or at an em-dash aside, so each half already stands on its own.

**Guard rails, in force for every split:**
- Splitting a sentence must never split a numbered step into two numbered steps, and
  never renumber, reorder or re-nest anything.
- Never drop the conditional word that makes a sentence conditional: `when`, `unless`,
  `if`, `while`, `only`, `regardless of whether`, `rather than`.
- Never drop a scope qualifier: `in a code region`, `outside it`, `non-hardware`,
  `from BOTH sources`, `by address`, `for THIS store's own run`, `at all`.
- Never drop or weaken a hedge: `almost always`, `very likely`, `may mean`, `looks
  like`, `routinely`, `plausible`, `is normal`.
- Never weaken a requirement: `REQUIRED`, `must`, `never`, `do not`, `not optional`,
  `deliberately`, `zero`. A bolded word stays bolded.
- Leave every table row alone. The four tables in Phase 4 are records.
- Leave every fenced code block byte-identical.

**Then check the whole pass for meaning.** Read `git diff
src/skills/routine-queue-walker/SKILL.md` hunk by hunk. For each hunk, state to
yourself what fact, condition, scope qualifier or hedge the old text carried, and
check the new text carries the same one. Revert any hunk you cannot justify that way —
a smaller violation reduction with intact meaning is the correct outcome, and a
reduction that loses a condition is a failed pass.

Finally, check these three invariants by reading the diff:
1. Line 3 (`description:`) does not appear in the diff at all.
2. No line inside a fenced code block appears in the diff.
3. No `##` or `###` heading line appears in the diff.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/routine-queue-walker/SKILL.md > /tmp/ste-260915-mml-final.json ; python3 -c "import json,collections,sys; d=json.load(open('/tmp/ste-260915-mml-final.json')); c=collections.Counter(v['rule'] for v in d['violations']); ls=[v['line'] for v in d['violations'] if v['rule']=='long-sentence']; print('total',d['count'],dict(c),'long-sentence lines',ls); sys.exit(0 if c['semicolon']==0 and c['synonym-rotation']==0 and ls==[3,3] and 49 >= d['count'] else 1)"</automated>
  </verify>
  <done>
    The linter reports a total strictly below the baseline of 50, zero `semicolon`
    violations, zero `synonym-rotation` violations, and exactly two `long-sentence`
    violations, both on line 3.
    Every sentence in a numbered procedure step is 20 words or fewer, and every other
    prose sentence is 25 words or fewer, except where a verbatim token or a table row
    makes the split impossible.
    The diff touches no heading, no fenced code block, and not line 3.
    Every hunk in the diff preserves the fact, condition, scope qualifier and hedge of
    the text it replaces.
  </done>
</task>

</tasks>

<threat_model>
ASVS level 1. Blocking threshold: high. No threat in this register reaches that
threshold, so nothing here blocks execution.

**The change surface is one non-executable markdown file** —
`src/skills/routine-queue-walker/SKILL.md`. This plan changes prose only. It adds no
code, no dependency, no network call, no file read or write at run time, no shell
command that ships, and no new input path. Nothing in the file executes. Saying this
plainly is the honest finding. Inventing an ASVS-1 threat for a prose edit would be
noise, and noise is what makes a threat register stop being read.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none crossed) | The plan reads and rewrites one file already inside the repository. No untrusted input crosses any boundary, at edit time or at run time. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mml-01 | Tampering | `src/skills/routine-queue-walker/SKILL.md` prose | low | mitigate | A careless rewrite could weaken an instruction an agent later follows — for example drop a `never`, a `REQUIRED`, or the `DECLINED:` / `DISAGREEMENT-ACCEPTED:` literal prefix. Task 3 mitigates this: it reads the whole diff hunk by hunk and reverts any hunk whose fact, condition, scope qualifier or hedge changed. The binding rules forbid touching a verbatim token, a fenced code block or a heading. |
| T-mml-02 | Information Disclosure | the same file | low | accept | The file carries no secret, no credential and no host path outside the repository. The pass adds none. Nothing to disclose. |
| T-mml-03 | Elevation of Privilege | the same file | low | accept | Markdown is not executable and this plan adds no executable content. There is no privilege to elevate. |

**Package legitimacy gate: not applicable.** This plan runs no `npm`, `pip` or `cargo`
install, adds no dependency to any manifest, and needs no `T-mml-SC` row. Its one tool,
`ste-lint.py`, is already installed on the host as part of the `asd-ste100` skill. Per
the project's standing constraint, do not install anything to run it — if it is
missing, refuse by name and report that, rather than fetching it.
</threat_model>

<verification>
One check only, the one the task author mandated:

```
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/routine-queue-walker/SKILL.md
```

Read the parsed `count` from its JSON, not its exit status. The command exits 1 while
any hard violation remains above the baseline, and the two exempt `long-sentence`
violations on line 3 never go away, so exit 1 is the expected result of a successful
pass.

Pass bar: the violation count decreases strictly from the baseline of 50, with no
semantic change to any fact, condition, scope qualifier or hedge.

Expected shape of the final result: `semicolon` 0, `synonym-rotation` 0,
`present-perfect` 3, `long-sentence` 2 (both line 3, both exempt), `passive-voice`
around 8-12. Total near 15. A higher total still passes if the count decreased and
meaning is intact.

Run no test suite. Add no test file. Invoke the skill for nothing.
</verification>

<success_criteria>
- `src/skills/routine-queue-walker/SKILL.md` is the only changed file.
- ste-lint total is strictly below 50.
- ste-lint `semicolon` count is 0.
- ste-lint `synonym-rotation` count is 0.
- ste-lint `long-sentence` count is 2, both on line 3.
- Line 3 is byte-identical to HEAD.
- Every fenced code block is byte-identical to HEAD.
- Every heading is byte-identical to HEAD.
- Procedure step numbering, order and nesting are unchanged.
- No fact, condition, scope qualifier or hedge changed meaning.
</success_criteria>

<output>
Create `.planning/quick/260915-mml-routine-queue-walker-skill-apply-the-ste100-strict-pass-foll/260915-mml-SUMMARY.md` when done.

Record in it: the baseline count (50), the final count, the per-rule counts before and
after, and every place where a rule was deliberately not applied, with the reason
(the D-2 `description:` exemption, the three kept compound tenses, the kept passives,
and any sentence a verbatim token stopped you from splitting).
</output>
