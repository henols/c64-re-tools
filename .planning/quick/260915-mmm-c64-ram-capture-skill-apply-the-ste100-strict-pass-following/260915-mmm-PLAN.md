---
quick_id: 260915-mmm
phase: quick-260915-mmm
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-mmm]

estimate:
  tokens: 35000
  raw_tokens: 70000
  tasks: 3
  confidence: high   # sample_count 322, factor 0.5, applied true

files_modified:
  - src/skills/c64-ram-capture/SKILL.md
  - src/skills/c64-ram-capture/templates/capture-record.template.md
  - src/skills/c64-ram-capture/transients/README.md

# This plan deletes nothing. It therefore carries no `files_deleted` key.

must_haves:
  truths:
    - "`ste-lint.py` reports fewer than 46 violations for `src/skills/c64-ram-capture/SKILL.md`."
    - "`ste-lint.py` reports fewer than 12 violations for `src/skills/c64-ram-capture/templates/capture-record.template.md`."
    - "`ste-lint.py` reports fewer than 10 violations for `src/skills/c64-ram-capture/transients/README.md`."
    - "Every fact, condition, scope qualifier and hedge in the three files survives the rewrite unchanged in meaning."
    - "The `description:` field of `SKILL.md`'s YAML frontmatter is byte-identical to its pre-change state."
    - "Every heading, table header, table row count, field name and placeholder token in `templates/capture-record.template.md` is byte-identical to its pre-change state."
  artifacts:
    - src/skills/c64-ram-capture/SKILL.md
    - src/skills/c64-ram-capture/templates/capture-record.template.md
    - src/skills/c64-ram-capture/transients/README.md
  key_links:
    - "The glossary verb chosen for a cluster must be the only member of that cluster left in the file. See `<binding_rules>` — `How the linter counts synonym rotation`."
---

<objective>
Apply the ASD-STE100 strict pass to the three markdown files of the
`c64-ram-capture` skill. This is a prose rewrite. It changes how the English reads.
It changes no fact, no condition, no scope qualifier, no hedge, no token and no
file structure.

Purpose: an agent parses these files with no human present to resolve an
ambiguous sentence. That is the exact reader ASD-STE100 exists for.

Output: the same three files, with a lower `ste-lint.py` violation count and the
same meaning.

This plan is documentation-only. It adds no test, runs no test suite, and carries
no gate of any kind.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
@src/skills/c64-ram-capture/SKILL.md
@src/skills/c64-ram-capture/templates/capture-record.template.md
@src/skills/c64-ram-capture/transients/README.md

Read `~/.claude/skills/asd-ste100/SKILL.md` before the first rewrite. It is the
authority on the rewrite itself. Use its **Strict** mode. Everything below is the
project-level ruling that sits on top of it.
</context>

<binding_rules>

These rules are binding on every task in this plan. This section restates them in full,
so that you do not have to open another document to obey them.

## The shared batch rules (verbatim)

- Fixed verb glossary, apply identically: **check** (not confirm/verify/validate),
  **correct** (not fix/repair), **change** (not modify/alter), **stop** (not
  halt/terminate), **get** (not fetch), **start** (not launch/begin), **remove**
  (not delete/erase), **show** (not display).
- Delete every prose semicolon. A clause join becomes two sentences. A
  semicolon-chained list item takes a full stop.
- Split sentences over 20 words in a procedure, over 25 elsewhere.
- Convert passive to active wherever the actor is named. Leave passive where the
  object is the topic of a lookup row.
- Keep the compound tense where it carries current relevance.
- DO NOT touch the `description:` field in the YAML frontmatter. It is exempt by
  decision D-2.
- DO NOT touch fenced code blocks, tool names, register names, binary paths,
  version numbers or any verbatim token.
- A table cell is a record. Apply STE to the sentences inside a cell, never to the
  row. Never split or merge a row.
- Preserve every fact, condition, scope qualifier and hedge. "may have failed"
  never becomes "failed".

## Meaning preservation outranks the glossary

Where applying a glossary verb would change a term of art, a measured record or a
named constant, keep the original wording and record the exception in the summary.
A lower violation count that costs a fact is a failed pass.

Two specific words in these files are terms of art and stay: the adjective
**verified** (as in "a verified capture", "a verified 64K image") and the noun
**launch** where it names a spawn event. Neither is the verb form the glossary
governs. The linter also cannot see them — see the next section.

## How the linter counts, and why it matters

Four mechanics of `ste-lint.py` decide whether an edit lowers the count:

1. **The linter skips every fenced code block.** Anything between triple backticks
   is invisible to the linter, and it must stay untouched anyway.
2. **The linter strips inline code before it matches.** A token inside single
   backticks never produces a violation, and it never needs a change.
3. **The linter reads each table cell on its own**, not each row. You may split a
   long sentence *inside* a cell, and that lowers the count. Never split the row.
4. **Synonym rotation flags every group member after the FIRST in document order.**
   The per-file count for one cluster is (distinct members present − 1). The count
   therefore falls only when you remove the rival members from the file. Adding the
   glossary verb while a rival survives lowers nothing.

Consequence of mechanic 4: **introducing a glossary verb into a file that already
contains a rival CREATES a new violation.** The per-file safe lists are in the
tasks below. Obey them.

The linter's word pattern is the base word plus an optional `s`/`es`/`ed`/`d`/`ing`
ending. "verified" does not match the base "verify", which is why the term of art
above is invisible to it.

## Never create a new violation

Every rewrite can introduce one. Splitting a long sentence can produce a passive.
Naming an actor can introduce a rival synonym. Re-run the linter after each file
and read the new violation list, not only the count.

## The check

The single permitted check is the text linter:

`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-ram-capture/SKILL.md src/skills/c64-ram-capture/templates/capture-record.template.md src/skills/c64-ram-capture/transients/README.md`

Pass bar: the violation count strictly decreases from the baseline, with NO
semantic change to any fact, condition, scope qualifier or hedge.

**Per-file baselines, measured 2026-09-15:**

| File | Baseline violations |
|---|---|
| `src/skills/c64-ram-capture/SKILL.md` | 46 |
| `src/skills/c64-ram-capture/templates/capture-record.template.md` | 12 |
| `src/skills/c64-ram-capture/transients/README.md` | 10 |
| **Total** | **68** |

**The linter's own exit code is NOT the gate.** `ste-lint.py` exits 1 at any
violation count above its `--baseline` (which defaults to 0), so it exits 1 at the
baseline and it exits 1 after a successful pass. The gate is the count comparison,
which each task's `<verify>` performs by reading the JSON `count` field and
comparing it to that file's baseline. Never read a bare non-zero linter exit as a
failed pass.

Do not add a test. Do not run a test suite. Do not invoke the skill. The linter is
the whole of the verification.

</binding_rules>

<tasks>

<task type="auto">
  <name>Task 1: STE100 strict pass over SKILL.md</name>
  <files>src/skills/c64-ram-capture/SKILL.md</files>
  <precondition>The linter exists and runs: `python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --help` exits 0. If it does not, stop and report the missing path.</precondition>
  <action>
Rewrite the prose of `src/skills/c64-ram-capture/SKILL.md` under every rule in
`<binding_rules>`. Baseline is 46 violations: 23 semicolon, 15 passive-voice,
4 synonym-rotation, 3 long-sentence, 1 present-perfect.

Work from the linter's own violation list, then read the whole file once more for
sentences the linter cannot see.

**Do not touch line 3, the `description:` frontmatter field.** It is exempt by D-2.
Leave it byte-identical.

**Semicolons (23).** Each becomes a full stop and a new sentence, or a comma where
the join is a simple list. The four at lines 93 and 94 chain the `raw.json` key
definitions. Give each key its own sentence. Keep every backticked key name and
every `$XXXX` address exactly as written. The semicolons inside table cells (lines
425, 443, 459, 462, 465, 466, 472) become full stops inside the same cell. The row
stays one row.

**Synonym rotation (4 flags, 3 clusters).** The count falls only when one member of
each cluster survives in the file:
- check cluster: `confirm` appears first, then `check`, then `validated`. Keep
  **check**. Replace `confirm` / `Confirm` at the four procedure sites and replace
  `validated` with an active clause naming the renderer as the actor. Leave the
  adjective `verified` alone — it is a term of art and the linter cannot see it.
- start cluster: `launch` appears first (the broker sets the drive type at launch),
  then `start`. Keep **start**. Reword the `launch` occurrence so that the broker is
  the actor and the verb is `starts`.
- correct cluster: `fixed` appears first (the `raw.json` keys "are fixed"), then
  `correct`, then the Troubleshooting column header `Fix`, then `Fixed 2026-08-04`.
  Keep **correct**. The first of these is an adjective meaning unchanging, and
  rewriting it as an active statement that the keys never change removes both this
  flag and a passive-voice flag at the same site. Renaming the Troubleshooting
  column header and restating the dated note as "Corrected 2026-08-04" preserves
  both facts. If any of these three edits would cost a fact, keep the original and
  record the exception.

**Passive voice (15).** Name the actor and use an active verb wherever the actor is
in the sentence or in the paragraph: the proxy guards the capture identity,
`compare-cross-binary.mjs` refuses an entry and prints byte-identity, `derive`
refuses fewer than three images and refuses a re-derivation without `--force`.
Leave the passive where the object is the topic of a lookup row — the "Whether the
emulator is wedged" cell and the "no address set is inherited between releases"
cell are lookup rows and stay.

**Long sentences (3).** All three are cells of the `## References` table, at 27, 27
and 28 words. Split each into two sentences inside its own cell. Do not split the
row and do not merge cells.

**Present perfect (1).** "the program counter has moved" carries current relevance:
the point is that the counter now differs from the recorded one. Keep the compound
tense and say so in the summary.

Preserve every measured number, every `$XXXX` address, every date, every
`Confidence:` grade, every `MEASURED` claim, every hedge ("unexplained", "an open
question", "graded MEDIUM"), every tool name and every file path.

Before you finish, read the full `git diff` for this file and check each hunk
against the fact-preservation rule.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-ram-capture/SKILL.md | python3 -c "import json,sys;c=json.load(sys.stdin)['count'];print('count',c,'baseline',46);sys.exit(0 if c<46 else 1)"</automated>
  </verify>
  <done>The reported `count` for `SKILL.md` is below 46. The `description:` frontmatter field is byte-identical. No fenced code block changed. Every fact, number, address, date, grade and hedge survives.</done>
</task>

<task type="auto">
  <name>Task 2: STE100 strict pass over the capture-record template</name>
  <files>src/skills/c64-ram-capture/templates/capture-record.template.md</files>
  <action>
Rewrite the prose of `src/skills/c64-ram-capture/templates/capture-record.template.md`
under every rule in `<binding_rules>`. Baseline is 12 violations: 9 passive-voice,
2 long-sentence, 1 semicolon.

**HAZARD — this file is a TEMPLATE.** Its placeholder tokens, field names, headings
and fill-in slots are a machine-consumed contract, not prose. Five prohibitions
apply to this file and only relax for genuine prose sentences:

1. Never rename a field. `image path`, `size`, `sha256`, `binary sha256`,
   `argv digest`, `seed`, `capture route`, `checkpoint / trigger address`,
   `release` and `run` stay spelled exactly as they are.
2. Never change a placeholder's spelling. `<release>`, `<checkpoint>`, `<N>`,
   `<total>`, `<name>`, `<64 hex chars>`, `$____`, `$__`, `%________`,
   `memory-read`, `snapshot`, `PAL`, `NTSC`, `none`, `0` and
   `.VOID-<UTC timestamp>` stay exactly as they are.
3. Never reorder or retitle a section. Every `#`, `##` and `###` heading keeps its
   exact text and its exact position.
4. Never change the template's structure. Every table keeps its header row, its
   column order, its column count and its row count. Every checklist keeps its item
   count and its item order.
5. Rewrite only genuine prose sentences: the two intro paragraphs, the prose inside
   the "How obtained" and "Source" cells, the `### The reproducibility key is the
   triple, not the seed` body, the checklist item text, the void paragraph, the
   drift-floor paragraph, the prose inside the two `$D000-$DFFF` rule cells, and
   the closing paragraph.

**Semicolon (1).** In the `size` row's third cell. Replace it with a full stop
inside the same cell.

**Passive voice (9).** Name the actor where the sentence or paragraph names one:
the reader records every field and resumes the machine, five rows use the
shorthand, `vice_memory_read` reads the range on the memory-read route. Leave the
passive where the object is the topic of a lookup row.

**Long sentences (2).** Both are cells of the `$D000-$DFFF` route table, at 38 and
44 words. These are the two densest records in the file. Split each into shorter
sentences inside its own cell and carry every clause across: the `$40` repeat
interval for the VIC across `$D000-$D3FF`, the SID across `$D400-$D7FF`, the
`C64MEM` array, `mem_ram[]`, "RAM *under* I/O and not the register read view", and
the 4096-address count. Do not split the row.

**Do not introduce `start` or `get` into this file.** The rivals `launch` and
`obtained` are already present, and adding a glossary verb beside a surviving rival
creates a new synonym-rotation violation. `check`, `correct`, `change`, `stop`,
`remove` and `show` are safe to introduce here.

Preserve the reproducibility-key triple as a triple, the MEASURED 76-byte claim,
the order-sensitivity statement, the `STOCK_DETERMINISM_SEED` constant name, the
`4242` value, every source path and every hedge.

Before you finish, read the full `git diff` for this file. Check that the heading
set, the field-name set, the placeholder set and every table's row count are
unchanged.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-ram-capture/templates/capture-record.template.md | python3 -c "import json,sys;c=json.load(sys.stdin)['count'];print('count',c,'baseline',12);sys.exit(0 if c<12 else 1)"</automated>
  </verify>
  <done>The reported `count` for the template is below 12. Every heading, field name, placeholder token, table header, column order and row count is byte-identical. Only prose sentences changed.</done>
</task>

<task type="auto">
  <name>Task 3: STE100 strict pass over transients/README.md, then the combined check</name>
  <files>src/skills/c64-ram-capture/transients/README.md</files>
  <action>
Rewrite the prose of `src/skills/c64-ram-capture/transients/README.md` under every
rule in `<binding_rules>`. Baseline is 10 violations: 8 passive-voice, 2 semicolon.

**Semicolons (2).** One in the enumerated-list rule about `parseAllowList()`, one in
the cap paragraph about the script default. Each becomes a full stop and a new
sentence.

**Passive voice (8).** Name the actor where the sentence or paragraph names one:
`derive` refuses fewer than three runs, `derive` refuses a re-derivation without
`--force`, `parseAllowList()` refuses range-shaped keys, a test asserts the script
default equal to the committed cap, `normalisePorts()` normalises the 6510 port
overlay in code, this project committed the `.gitignore` before the first
derivation existed. Leave the passive where the object is the topic of a lookup row
or where the actor is genuinely unknown — the "has already been measured" sentence
is a measurement record and may stay passive if naming an actor would invent one.

**Do not introduce `correct`, `fix`, `delete`, `erase`, `launch`, `begin`, `halt`
or `terminate` into this file.** The rivals `repair` (the noun in "no cheap
repair"), `remove`, `start` and `stop` are already present, and adding a glossary
verb beside a surviving rival creates a new synonym-rotation violation. `check`,
`change`, `show` and `get` are safe to introduce here.

Preserve the four measured reference points and their table exactly: 0 at a
frame-exact `READY` stop, 66 at a frame-anchored autostarted stop at jitter 4000 ms
with the 48 parenthetical for the jitter-0/2500 pair, 300 at a wall-clock
autostarted stop, 1242 at a wall-clock `READY` stop with the determinism block
applied. Preserve `TRANSIENT_ALLOW_LIST_CAP = 64`, the N >= 3 minimum, the
N(N-1)/2 pairing count, the `2 over` / `4.7x` / `19x` multipliers, the JSON shape
block (a fenced block, untouched) and the npm-tarball statement about the nested
`.gitignore`.

Then run the combined check over all three files of this plan and record both the
per-file counts and the total in the summary, against the baselines 46 / 12 / 10
and the total 68.

Before you finish, read the full `git diff` for all three files of this plan. Check
each hunk against the fact-preservation rule. Report any place where you kept the
original wording on purpose, and why.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-ram-capture/transients/README.md | python3 -c "import json,sys;c=json.load(sys.stdin)['count'];print('count',c,'baseline',10);sys.exit(0 if c<10 else 1)"</automated>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-ram-capture/SKILL.md src/skills/c64-ram-capture/templates/capture-record.template.md src/skills/c64-ram-capture/transients/README.md | python3 -c "import json,sys;c=json.load(sys.stdin)['count'];print('count',c,'baseline',68);sys.exit(0 if c<68 else 1)"</automated>
  </verify>
  <done>The reported `count` for `transients/README.md` is below 10, and the combined `count` over the three files is below 68. Every measured number, cap, multiplier and fenced block survives.</done>
</task>

</tasks>

<threat_model>
ASVS level 1. Blocking threshold: high. `workflow.security_enforcement` is `true`
in this project, so this block is present.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none in scope | This plan changes three non-executable markdown documentation files. No code path, no network listener, no file-system writer, no path-translation seam and no process spawn changes. No trust boundary in this project moves, opens or closes. |

## STRIDE Threat Register

**The change surface is non-executable markdown documentation. No ASVS level 1
threat applies to it.** The register below records that finding and the one
correctness risk the change surface genuinely carries, rather than inventing an
ASVS-1 threat that this change cannot produce.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260915mmm-01 | Tampering | the three markdown files under `src/skills/c64-ram-capture/` | low | mitigate | A rewrite that changes a documented operating rule tampers with an instruction an agent later obeys. This is a correctness risk, not an ASVS-1 control. Three controls mitigate it. The fact-preservation rule in `<binding_rules>` binds every task. Each task must read the full `git diff` before it finishes. The summary must record every deliberate exception. Below the blocking threshold of high. |
| T-260915mmm-SC | Tampering | npm / pip / cargo installs | n/a | accept | Not applicable. This plan runs no package-manager command and adds no dependency to any manifest or lockfile. The package-legitimacy gate has nothing to audit. This plan needs no RESEARCH.md `## Package Legitimacy Audit` table. |

No threat in this register reaches the blocking threshold of high. This plan
therefore carries no blocking human checkpoint.
</threat_model>

<verification>
One check, run over the three files of this plan:

`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-ram-capture/SKILL.md src/skills/c64-ram-capture/templates/capture-record.template.md src/skills/c64-ram-capture/transients/README.md`

Read the JSON `count` field. It must be below 68. Read the `violations` array as
well, not only the count — a rewrite that removes two violations and creates one
is a worse pass than the number alone reports.

The linter exits 1 at any violation count above `--baseline`, so it exits 1 both
before and after this pass. Gate on the `count` comparison, never on that exit
code. Each task's `<verify>` already pipes the JSON through that comparison and
exits 0 only on a strict decrease.

The second half of the pass bar is not machine-checkable. Check it by reading the
`git diff`: no fact, condition, scope qualifier or hedge changed meaning.

No other check runs. This plan creates no test file. No test suite runs. Nothing
invokes the skill.
</verification>

<success_criteria>
- The combined `ste-lint.py` violation count over the three files is below 68.
- Each file's own count is below its baseline: SKILL.md below 46, the template
  below 12, `transients/README.md` below 10.
- `SKILL.md`'s `description:` frontmatter field is byte-identical.
- No fenced code block changed in any of the three files.
- The template's headings, field names, placeholder tokens, table headers, column
  orders and row counts are byte-identical.
- Every fact, measured number, address, date, `Confidence:` grade, `MEASURED`
  claim, scope qualifier and hedge survives with its meaning unchanged.
- The summary names every place where you did not apply the glossary, with the
  fact that applying it would have cost.
</success_criteria>

<output>
Create `.planning/quick/260915-mmm-c64-ram-capture-skill-apply-the-ste100-strict-pass-following/260915-mmm-SUMMARY.md` when done.

Record in it: the per-file before and after counts, the combined before and after
counts, the per-rule breakdown of what you removed, every deliberate exception with
its reason, and any new violation the pass introduced.
</output>
