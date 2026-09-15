---
quick_id: 260915-mmi
phase: quick-260915-mmi
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-mmi]

files_modified:
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-program-recon/references/control-flow.md
  - src/skills/c64-program-recon/references/graphics.md
  - src/skills/c64-program-recon/references/observation-hazards.md
  - src/skills/c64-program-recon/references/reconstruction.md
  - src/skills/c64-program-recon/references/sound-and-input.md
  - src/skills/c64-program-recon/references/tool-selection.md
  - src/skills/c64-program-recon/templates/memory-map.template.md

estimate:
  tokens: 55000
  raw_tokens: 110000
  tasks: 3
  confidence: high   # sample_count 322, factor 0.5, applied true

must_haves:
  truths:
    - "The eight files carry zero prose semicolons that ste-lint reports."
    - "The eight files carry zero synonym-rotation findings that ste-lint reports."
    - "The only long-sentence findings left are the two inside the exempt YAML frontmatter of SKILL.md."
    - "Every fact, condition, scope qualifier and hedge that the eight files stated before the pass is still stated after it."
  artifacts:
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/references/control-flow.md
    - src/skills/c64-program-recon/references/graphics.md
    - src/skills/c64-program-recon/references/observation-hazards.md
    - src/skills/c64-program-recon/references/reconstruction.md
    - src/skills/c64-program-recon/references/sound-and-input.md
    - src/skills/c64-program-recon/references/tool-selection.md
    - src/skills/c64-program-recon/templates/memory-map.template.md
  key_links:
    - "The YAML frontmatter of SKILL.md stays byte-identical. sha256 of lines 1-4 is dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17."
    - "Fenced code blocks, tool names, register names, binary paths and version numbers stay byte-identical in all eight files."
---

<objective>
Apply the ASD-STE100 strict pass to the eight markdown files of the `c64-program-recon`
skill. This is a prose rewrite of shipped skill documentation. It changes the form of the
English. It changes no fact.

Purpose: these files are parsed by an agent with no human present to resolve an ambiguous
sentence. That is the reader ASD-STE100 exists for.

Output: the same eight files, with a lower ste-lint violation count and the same meaning.
</objective>

<scope_limits>
This plan rewrites prose. It is not a code change and it is not a behaviour change.

**No test of the skill, of any kind.** This is a HARD limit on the plan itself. Do not add
a new test file. Do not run `npm test`. Do not run a test suite. Do not invoke the
`c64-program-recon` skill to see whether it still works. Do not add a round-trip check and
do not add a behavioural check.

The ONE permitted check is the `ste-lint.py` text linter named in `<verification>`.

The standard GSD gates apply to this plan as normal. `<threat_model>` below carries the
STRIDE register at the configured ASVS level. The limit above is a limit on TESTS, not a
limit on gates.
</scope_limits>

<context>
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
@src/skills/c64-program-recon/SKILL.md
</context>

<binding_rules>
These rules are binding. They are restated here in full, so this plan is executable
without reading any other document.

## The fixed verb glossary — apply identically across all eight files

| Use this verb | Never these |
|---|---|
| check | confirm, verify, validate |
| correct | fix, repair |
| change | modify, alter |
| stop | halt, terminate |
| get | fetch |
| start | launch, begin |
| remove | delete, erase |
| show | display |

The right-hand words stay untouched when they are part of a verbatim token: a tool name,
a flag, a register name, a file path, a quoted error string, or a proper noun. Change the
prose verb only.

## The structural rules

1. Delete every prose semicolon. A clause join becomes two sentences. A
   semicolon-chained list item takes a full stop per item instead.
2. Split every sentence over 20 words in a procedure, and over 25 words elsewhere.
3. Convert passive to active wherever the actor is named. Leave the passive where the
   object genuinely is the topic of a lookup row.
4. Keep the compound tense wherever it carries current relevance. "This project has been
   burned" and "this project was burned" are different claims. Keep the first where the
   text means the first.

## The prohibitions

1. NEVER touch the `description:` field in the YAML frontmatter of SKILL.md. It is exempt
   by decision D-2. It is a retrieval index, not prose, and a word cap fights the keyword
   packing that makes the skill trigger. It permanently carries two long-sentence findings
   and one passive-voice finding, and those findings are the decision, not an oversight.
   Only `src/skills/c64-program-recon/SKILL.md` has YAML frontmatter. The other seven files
   have none.
2. NEVER touch a fenced code block, a tool name, a register name, a binary path, a version
   number, a date, a measurement, or any other verbatim token. The linter already skips
   fenced blocks, so a fenced block can never earn a finding and never needs an edit.
3. A table cell is a record. Apply STE to the sentences INSIDE a cell. Never apply it to
   the row. Never split a row. Never merge two rows. Never move text between cells.
4. Preserve every fact, every condition, every scope qualifier and every hedge. "may have
   failed" never becomes "failed". "undecided or unflagged" never becomes "safe". A
   shorter sentence that upgrades a hedge into a fact is not a simplification. It is a
   different claim, and it fails this plan.
5. Add no fact the source did not state. A rewrite that reads better because it supplies a
   cause, a frequency or a mechanism has stopped being a rewrite.

## Two mechanical notes about these particular files

- The prose is hard-wrapped at roughly 100 columns. A sentence therefore spans several
  lines. Edit whole sentences, not lines, and re-wrap the result in the same style.
- A long sentence inside a table cell is fixable WITHOUT splitting the row. The linter
  counts sentences, not rows. A full stop placed inside the cell ends one sentence and
  starts the next, and the row stays one row. `references/tool-selection.md` needs this
  technique for all five of its long-sentence findings, and `SKILL.md` needs it for both
  of its body long-sentence findings at line 201.
</binding_rules>

<baselines>
Measured 2026-09-15 with `ste-lint.py` over the eight files. Total 202 findings, of which
106 are hard (semicolon, synonym-rotation, long-sentence) and 96 are advisory
(passive-voice, present-perfect).

| File | Total | semicolon | synonym-rotation | long-sentence | passive-voice | present-perfect | hard |
|---|---|---|---|---|---|---|---|
| `SKILL.md` | 108 | 38 | 9 | 4 | 53 | 4 | 51 |
| `references/control-flow.md` | 17 | 7 | 2 | 0 | 8 | 0 | 9 |
| `references/graphics.md` | 8 | 3 | 1 | 0 | 3 | 1 | 4 |
| `references/observation-hazards.md` | 16 | 6 | 1 | 0 | 8 | 1 | 7 |
| `references/reconstruction.md` | 8 | 3 | 2 | 0 | 3 | 0 | 5 |
| `references/sound-and-input.md` | 11 | 7 | 1 | 0 | 3 | 0 | 8 |
| `references/tool-selection.md` | 22 | 6 | 2 | 5 | 9 | 0 | 13 |
| `templates/memory-map.template.md` | 12 | 6 | 3 | 0 | 3 | 0 | 9 |
| **Total** | **202** | **76** | **21** | **9** | **90** | **6** | **106** |

**The irreducible floor is 3, and all 3 sit in the exempt frontmatter of `SKILL.md`**: two
long-sentence findings (32 words, 49 words) and one passive-voice finding ("is
structured"), all on line 3. Do not chase them. Correcting them breaks prohibition 1.
</baselines>

<tasks>

<task type="auto">
  <name>Task 1: STE100 strict pass over SKILL.md — and settle the house style</name>
  <files>src/skills/c64-program-recon/SKILL.md</files>
  <action>
Rewrite the prose of this file under every rule in the `binding_rules` section above. This
is the largest surface of the eight (702 lines, 7,181 words, 108 findings) and it is the
file that settles the verb choices the other seven then reuse, so do it first and record
which glossary verb you picked wherever the file offered a choice.

Work in the order that removes risk fastest. First delete all 38 prose semicolons: a
clause join becomes two sentences, and a semicolon-chained list item takes a full stop.
This is mechanical and carries no meaning risk. Second, settle the 9 synonym-rotation
findings against the fixed verb glossary. The clusters present in this file are
check/confirm/verify/validate, correct/fix, change/modify, stop/halt/terminate, get/fetch,
start/begin, remove/delete/erase and show/display. Third, correct the two body
long-sentence findings at line 201. Both sit inside the `anno_batch_execute` cell of a
markdown table, so split them into separate sentences INSIDE the cell and leave the row
intact. Fourth, walk the 53 passive-voice findings one at a time and convert to active
only where the actor is named in the text. Leave the passive where the object is the topic
of a lookup row — several of the verdict-table and tool-table rows are exactly that case,
and forcing an actor into them invents one. Fifth, read the 4 present-perfect findings and
keep every one that carries current relevance. Line 69 ("this project has been burned in
both directions") states a condition that is true now, and it stays.

Leave the YAML frontmatter on lines 1 to 4 byte-identical. Leave every fenced code block,
every `$`-prefixed address, every `anno_*` and `vice_*` tool name, every date and every
measurement byte-identical. Keep the roughly 100-column hard wrap.

Preserve every hedge. This file is dense with graded-confidence language, and the
confidence grade is the content. Sentences that say a report leaves a region "undecided or
unflagged, never certified safe to move" must still say exactly that after the rewrite.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools; test "$(sed -n '1,4p' src/skills/c64-program-recon/SKILL.md | sha256sum | cut -d' ' -f1)" = dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17; echo "frontmatter-intact=$?"; python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 2 src/skills/c64-program-recon/SKILL.md; echo "lint-gate=$?"</automated>
  </verify>
  <done>
`ste-lint.py --baseline 2 src/skills/c64-program-recon/SKILL.md` exits 0. That means hard
findings dropped from 51 to at most 2, and the 2 that remain are the exempt frontmatter
long sentences. semicolon is 0. synonym-rotation is 0. long-sentence outside lines 1 to 4
is 0. Total findings are below 108 and passive-voice is below 53. The sha256 of lines 1 to
4 still reads dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17. `git diff`
shows no change to any fenced block, tool name, register name, path, date or measurement.
  </done>
</task>

<task type="auto">
  <name>Task 2: STE100 strict pass over the six reference files</name>
  <files>src/skills/c64-program-recon/references/control-flow.md, src/skills/c64-program-recon/references/graphics.md, src/skills/c64-program-recon/references/observation-hazards.md, src/skills/c64-program-recon/references/reconstruction.md, src/skills/c64-program-recon/references/sound-and-input.md, src/skills/c64-program-recon/references/tool-selection.md</files>
  <action>
Apply the same pass to the six reference files, reusing the exact verb choices settled in
task 1. The six carry 82 findings between them: 32 semicolon, 9 synonym-rotation, 5
long-sentence, 34 passive-voice, 2 present-perfect. None of these six files has YAML
frontmatter, so none of them carries an exempt finding and every finding in them is
correctable.

Two files need particular care. `tool-selection.md` holds all 5 long-sentence findings
(lines 20, 32, 38, 46 twice), and every one of them sits inside a markdown table cell in a
"Question / Call" lookup table. Split each into separate sentences inside its own cell.
Never split the row, never merge two rows, and never move text between the Question column
and the Call column. Those cells carry withdrawal dates, return dates, byte caps and
detection-strength language that must survive the split word for word. `observation-hazards.md`
is a hazard document, so its conditions and its hedges are the whole point of the file:
a sentence that says an observation "may have" a property keeps "may have".

These are reference files, which the `asd-ste100` skill treats as explanatory prose and
lookup rows rather than pure procedure. Use the 25-word cap for explanation and the
20-word cap for the numbered procedure steps inside `control-flow.md`. Leave the passive
where the object is the topic of a lookup row — the "Where the entry point is" and
"Situation" columns are lookup rows, not instructions.

Leave every fenced code block, every `$`-prefixed address, every `node derive.mjs`
invocation, every confidence grade and every date byte-identical. Keep the existing hard
wrap.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools; python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 0 src/skills/c64-program-recon/references/control-flow.md src/skills/c64-program-recon/references/graphics.md src/skills/c64-program-recon/references/observation-hazards.md src/skills/c64-program-recon/references/reconstruction.md src/skills/c64-program-recon/references/sound-and-input.md src/skills/c64-program-recon/references/tool-selection.md; echo "lint-gate=$?"</automated>
  </verify>
  <done>
`ste-lint.py --baseline 0` over the six reference files exits 0. Hard findings dropped from
46 to 0 across the six: semicolon 0, synonym-rotation 0, long-sentence 0. Total findings
for the six dropped below 82, and each file is below its own baseline (control-flow 17,
graphics 8, observation-hazards 16, reconstruction 8, sound-and-input 11, tool-selection
22). Every table in `tool-selection.md` has the same number of rows and the same column
count as before. `git diff` shows no change to any fenced block, address, date or
confidence grade.
  </done>
</task>

<task type="auto">
  <name>Task 3: STE100 strict pass over the memory-map template</name>
  <files>src/skills/c64-program-recon/templates/memory-map.template.md</files>
  <action>
Apply the same pass to the template, reusing the verb choices settled in task 1. It carries
12 findings: 6 semicolon, 3 synonym-rotation, 3 passive-voice, and no long-sentence and no
present-perfect. It has no YAML frontmatter.

This file is a schema and a generator instruction, not a fill-in document, so its prose is
procedure. Use the 20-word cap. The paragraph that enumerates what counts as drift is a
semicolon-chained list inside prose: each drift cause takes a full stop, or the list
becomes a real bulleted list, and every one of the listed causes survives the change. The
paragraph about the one-time 2026-08-30 banner correction states a date, a direction of
change and a self-clearing property — keep all three.

Leave every fenced code block byte-identical, including the two generator invocations.
Leave `--check`, `--provenance`, every path and every date byte-identical. Leave any
placeholder token the template defines for its filler exactly as written.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools; python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 0 src/skills/c64-program-recon/templates/memory-map.template.md; echo "lint-gate=$?"</automated>
  </verify>
  <done>
`ste-lint.py --baseline 0 src/skills/c64-program-recon/templates/memory-map.template.md`
exits 0. Hard findings dropped from 9 to 0: semicolon 0, synonym-rotation 0. Total findings
are below 12. `git diff` shows no change to the two fenced generator invocations, to
`--check`, to `--provenance`, to any path or to any date.
  </done>
</task>

</tasks>

<threat_model>
`workflow.security_enforcement` is `true`, so this block is required and is present.
Configured ASVS level: **1** (`workflow.security_asvs_level`). Blocking threshold:
**high** (`workflow.security_block_on`). No threat below reaches high, so no threat in this
register blocks execution.

## Change surface, measured

All eight files this plan touches are non-executable UTF-8 markdown. Measured 2026-09-15:
`file` reports "Unicode text, UTF-8 text" for all eight, and `find src/skills/c64-program-recon
-name '*.md' -perm -u+x` returns 0. The plan adds no file and removes no file. It runs no
package-manager install: a grep of the plan body for npm, pip, cargo and yarn install verbs
returns 0 matches. Nothing in this change is compiled, linked, or run by a shell.

## Trust Boundaries

| Boundary | Description |
|---|---|
| None in the ASVS sense | **No ASVS-1 requirement is in scope for this change surface.** A markdown document has no authentication path and no session. It makes no access-control decision. It has no input-validation point, no cryptography and no data processing. No untrusted input crosses this change. |
| Author to agent reader (real, but not an ASVS boundary) | The eight files are instructions a downstream agent reads and acts on against a real emulator and a user's files. This is a documentation-integrity boundary. It is recorded here rather than omitted, because a prose rewrite is exactly the operation that can damage it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260915-mmi-01 | Tampering | The prose of the eight files, read by a downstream agent as instructions | medium | mitigate | Semantic drift during the rewrite. `binding_rules` prohibition 4 forbids dropping any fact, condition, scope qualifier or hedge, and names the exact failure ("may have failed" becoming "failed", "undecided or unflagged" becoming "safe"). `binding_rules` prohibition 5 forbids adding a fact the source did not state. `<verification>` requires an end-to-end read of `git diff` for the eight files before commit, answering one question per changed sentence. Each task's `<done>` repeats the check for its own files. |
| T-260915-mmi-02 | Tampering | Verbatim tokens inside the eight files: tool names, register names, addresses, binary paths, flags, dates, measurements | medium | mitigate | A silent change to `$D018`, to an `anno_*` or `vice_*` tool name, or to a path would make a downstream agent act on a wrong address or invoke a wrong tool. `binding_rules` prohibition 2 forbids touching any verbatim token and any fenced code block. Task 1's `<automated>` pins the sha256 of SKILL.md lines 1 to 4 at `dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17`. All three tasks carry a `git diff` criterion in `<done>` naming fenced blocks, tool names, register names, paths, dates and measurements. The linter skips fenced blocks, so a fenced block can never earn a finding that tempts an edit. |
| T-260915-mmi-SC | Tampering | Package-manager installs | n/a | n/a | **Not applicable, by measurement rather than by omission.** This plan runs zero npm, pip, cargo and yarn installs, so no package-legitimacy gate and no legitimacy checkpoint is required. RESEARCH.md's `## Package Legitimacy Audit` is therefore not a precondition for this plan. |

**STRIDE categories with no applicable threat on this change surface:** Spoofing,
Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege. A
non-executable markdown edit reaches none of them.

**Why both threats take `mitigate` rather than `accept`.** ASVS L1 permits `accept` with a
documented rationale for a medium-severity threat that does not sit on a primary trust
boundary, and neither of these sits on one. Both mitigations are already the core
discipline of this plan and cost nothing extra to state, so `mitigate` is the cheaper and
more exact call.
</threat_model>

<verification>
## The mandated command

This is the check the task author mandated, and it is the only check this plan runs:

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json \
  src/skills/c64-program-recon/SKILL.md \
  src/skills/c64-program-recon/references/control-flow.md \
  src/skills/c64-program-recon/references/graphics.md \
  src/skills/c64-program-recon/references/observation-hazards.md \
  src/skills/c64-program-recon/references/reconstruction.md \
  src/skills/c64-program-recon/references/sound-and-input.md \
  src/skills/c64-program-recon/references/tool-selection.md \
  src/skills/c64-program-recon/templates/memory-map.template.md
```

**The pass bar: the violation count strictly decreases from the baseline of 202, with no
semantic change to any fact, condition, scope qualifier or hedge.**

## Reading the result per file and per rule

The `--json` form prints one JSON object on stdout with a `violations` array, a `count`, a
`hard_count` and a `words` count. To compare against the per-file baselines in the
`<baselines>` table, pipe it:

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json <the eight files> \
  | python3 -c "
import json,sys,collections
d=json.load(sys.stdin)
v=d['violations']
print('TOTAL', d['count'], 'hard', d['hard_count'], 'baseline-total 202 baseline-hard 106')
for f,c in sorted(collections.Counter(x['file'] for x in v).items()): print(c, f)
for r,c in collections.Counter(x['rule'] for x in v).most_common(): print(c, r)
"
```

## The exit code, stated plainly

`ste-lint.py` exits 1 whenever hard findings exceed `--baseline` (default 0). On the
unedited tree it therefore exits 1, and that is expected rather than a failure of this
plan. The three task gates use `--baseline N` so that the exit code becomes the real
verdict: 0 means hard findings are at or below the target for those files.

In the piped `--json` form above, the shell reports the exit status of the LAST command in
the pipeline, which is the python reader, not the linter. That is deliberate here: the
piped form is for reading the numbers, and the `--baseline` form in each task's
`<automated>` block is the gate.

## Final whole-item check

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 2 \
  src/skills/c64-program-recon/SKILL.md \
  src/skills/c64-program-recon/references/*.md \
  src/skills/c64-program-recon/templates/memory-map.template.md
```

Exit 0 means the whole item is done: 2 hard findings remain across all eight files, and
both are the exempt frontmatter long sentences of `SKILL.md`.

## The semantic check, which no linter performs

Read `git diff` for the eight files once, end to end, before committing. For every changed
sentence, answer one question: does it still state the same fact, the same condition, the
same scope qualifier and the same hedge? A dropped "may", a dropped "only", a dropped
"except", a dropped date or a promoted certainty fails this plan even when the linter count
drops to zero.
</verification>

<success_criteria>
- The mandated `--json` command reports a total below 202 over the eight files.
- semicolon findings: 0. synonym-rotation findings: 0.
- long-sentence findings: 2, both on line 3 of `SKILL.md`, both inside the exempt YAML
  frontmatter.
- passive-voice findings: below 90, with at least the frontmatter one remaining.
- present-perfect findings: kept wherever the compound tense carries current relevance.
- sha256 of `SKILL.md` lines 1 to 4 is still
  dc82536137e2a8f97e7c22a05694540fd383d563c975c631d23ee00849e82d17.
- `git diff --stat` lists exactly the eight files in `files_modified` and nothing else.
- No file was added and no file was removed.
- No test file exists that did not exist before, and no test suite was run.
</success_criteria>

<output>
Create `.planning/quick/260915-mmi-c64-program-recon-skill-apply-the-ste100-strict-pass-followi/260915-mmi-SUMMARY.md` when done.

Record in it: the before and after violation count per file, which glossary verb was
chosen for each of the eight clusters, every present-perfect the pass kept and why, and
every sentence where a rewrite was declined because it would have cost precision.
</output>
