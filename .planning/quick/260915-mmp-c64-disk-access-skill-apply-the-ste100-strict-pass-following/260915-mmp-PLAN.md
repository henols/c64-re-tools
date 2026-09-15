---
quick_id: 260915-mmp
phase: quick-260915-mmp
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-mmp]

files_modified:
  - src/skills/c64-disk-access/SKILL.md

estimate:
  tokens: 6300
  raw_tokens: 30000
  tasks: 2
  confidence: high   # sample_count 322, factor 0.209, applied true

must_haves:
  truths:
    - "`ste-lint.py --json` over `src/skills/c64-disk-access/SKILL.md` reports fewer than 22 violations. The measured baseline is 22."
    - "The lint output holds zero `semicolon` rule hits."
    - "The lint output holds zero `synonym-rotation` rule hits."
    - "The lint output holds exactly two `long-sentence` hits. Both sit on line 3. Line 3 is the `description:` frontmatter, which decision D-2 makes permanently exempt."
    - "Every c1541 verb, every command-line flag, every JSON field name, every track number, every sector number and every byte count survives byte-identical."
    - "Every hedge survives at its original strength."
    - "The audit section still states that a flag is a signal to investigate, not a verdict."
    - "Every fenced code block survives byte-identical."
    - "The file's six capability names and their argument rules read as they read before."
  artifacts:
    - "src/skills/c64-disk-access/SKILL.md"
  key_links:
    - "The three numbered flag criteria in the audit section keep their exact conditions after each semicolon becomes a full stop. Criterion 3 keeps the bold `**sector**` and keeps the reason clause that says the per-sector map is available."
    - "`-format`, `-write`, `-bwrite` and `-delete` stay spelled as c1541 spells them. The verb glossary rule that prefers `remove` over `delete` never reaches a c1541 flag name."
    - "The `audit` paragraph keeps `no seventh host_tool id` and keeps `three existing capabilities composed client-side` after the semicolon on that line becomes a full stop."
---

<objective>
Apply the ASD-STE100 strict pass to `src/skills/c64-disk-access/SKILL.md`, and
change no fact.

Purpose: an agent parses this playbook, with no human present to resolve an
ambiguous sentence. The file measures 2.5 violations per 100 words, the worst
rate of the nine shipped skills. The violations come from two mechanical habits:
the prose semicolon and the agentless passive.

Output: one rewritten file. The lint count falls from 22. No fact, condition,
scope qualifier or hedge changes.

Scope note: this plan rewrites prose in one documentation file. It adds no test,
runs no test suite, and exercises no skill. The ste-lint text linter is the only
check this plan runs.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@src/skills/c64-disk-access/SKILL.md
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
</context>

<binding_rules>

These rules are binding. This plan restates them in full. You do not have to open
another file to obey them.

## The fixed verb glossary

Apply one verb per cluster, identically, everywhere in the body prose:

| Use this verb | Never use these |
|---|---|
| check | confirm, verify, validate |
| correct | fix, repair |
| change | modify, alter |
| stop | halt, terminate |
| get | fetch |
| start | launch, begin |
| remove | delete, erase |
| show | display |

The glossary governs PROSE VERBS ONLY. It never governs a verbatim token. The
c1541 flag `-delete` is a verbatim token and keeps its exact spelling. The same
holds for `-format`, `-write` and `-bwrite`.

## The mechanical rules

1. Delete every prose semicolon. A clause join becomes two sentences. A
   semicolon-chained list item takes a full stop.
2. Split a sentence over 20 words in a procedure. Split a sentence over 25 words
   elsewhere. The linter's own cap is 25, so the linter does not report every
   over-length procedure sentence. Apply the 20-word procedure cap by hand.
3. Convert passive to active wherever the source names the actor. Leave the
   passive where the object is the topic of a lookup row. Never invent an actor
   that the source does not state.
4. Keep the compound tense where it carries current relevance. "the job has
   completed" and "the job completed" are different claims.

## The prohibitions

- NEVER touch the `description:` field in the YAML frontmatter. Decision D-2
  makes it permanently exempt. It is a retrieval index, not prose. It carries
  both of the file's `long-sentence` violations on line 3, and both must remain.
- NEVER touch a fenced code block, a tool name, a register name, a binary path,
  a version number, or any other verbatim token.
- A table cell is a record. Apply STE to the sentences inside a cell. Never
  apply it to the row. Never split a row. Never merge a row.
- Preserve every fact, every condition, every scope qualifier and every hedge.
  "may have failed" never becomes "failed".

## The special hazard in THIS file

This file is dense with disk-geometry facts and with hedged diagnostic language.

**Verbatim tokens that must survive byte-identical.** Every track number, every
sector number, every numeric offset, every byte count and every c1541 command
spelling: `c1541`, `-dir`, `-format`, `-write`, `-bwrite`, `-delete`, `--image`,
`--name`, `--out-dir`, `--json`, the six capability names `bam`, `dir`, `entry`,
`chain`, `read` and `audit`, `host_tool`, `results[0].path`, `sha256`,
`byteLength`, `exitStatus`, `stderrTail`, `firstTrack`, `firstSector`,
`first_track`, `first_sector`, `suspicious`, `suspicious_reasons`, `chain_error`,
the `T/S: <t>/<s>, <n> blocks` summary line, the `Error - ...` line shape, the
`{"ok":false,"message":"..."}` envelope, and the phrase `raw 32-byte directory
record`.

**Counting facts that must survive.** The file states six capabilities in total.
It states that the `read` capability differs from `the other four capabilities`.
It states that `audit` composes `three existing capabilities` and adds
`no seventh host_tool id`. It states `the six read-only capabilities above`.
Each of these numbers is load-bearing and exact. Do not round one, drop one, or
restate one as "several".

**Hedged diagnostic language that must NOT harden.** The audit section
deliberately reports a signal rather than a verdict:

- `A flag is a signal to investigate, not a verdict.` keeps its bold and its
  full force.
- A fabricated entry, a genuinely corrupted image, and `(rarely)` an
  `unusual-but-legitimate disk layout` `can all produce a flag`. The word
  `rarely` stays. `can all produce` never hardens into "produce" or "means".
- `meaning the file cannot really start there` keeps `cannot really`.
- `a chain error on one entry never hides another entry's own independent flag`
  keeps `never`.
- Nothing in this file may turn "may indicate a cracker-fabricated filename"
  into "is a cracker-fabricated filename". No sentence loses a hedge in either
  direction.

</binding_rules>

<tasks>

<task type="tracer">
  <name>Task 1: Delete every prose semicolon and close the show/display verb rotation</name>
  <files>src/skills/c64-disk-access/SKILL.md</files>
  <read_first>
    - src/skills/c64-disk-access/SKILL.md (read the whole file once, 157 lines)
    - The `binding_rules` section of this plan
  </read_first>
  <action>
Edit `src/skills/c64-disk-access/SKILL.md` in place. This task is the mechanical,
zero-meaning-risk half of the pass. It also proves the edit-then-lint loop
end-to-end before the judgement-heavy half runs.

Do two things, and nothing else.

FIRST: remove all ten prose semicolons. The measured sites are lines 23, 35, 60,
84, 107, 112, 114, 135, 144 and 152 of the current file. Line numbers move as you
edit, so work top-down and re-read as needed. Each site takes one of two shapes.

A clause join becomes two sentences. Worked example from line 152: the source
reads that c1541 runs host-side, then joins a second independent clause about
what the script constructs. Write the first clause as one sentence with a full
stop, then write the second clause as its own sentence. Both sentences keep every
word of their original content, including the closing em-dash clause about the
host-tool execution seam being the only route.

A semicolon-chained numbered list takes a full stop per item. The three numbered
flag criteria in the audit section (lines 112 to 118) end with a semicolon, a
semicolon and a full stop. Give each item its own full stop. Change nothing else
inside the items. Criterion 1 keeps `its block count is 0`. Criterion 2 keeps both
halves of its geometry condition, the missing track and the missing sector on that
track. Criterion 3 keeps the bold `**sector**`, keeps `not merely its whole track`,
keeps `meaning the file cannot really start there`, and keeps the following
sentence that explains the criterion is sharper because the per-sector map is
available.

The remaining eight sites are clause joins. Handle each the same way. Two of them
sit inside sentences that Task 2 also shortens. That overlap is correct. Leave
the length work to Task 2 and only split the clause here.

SECOND: close the one synonym-rotation hit. The file uses two members of the
show/display cluster. Line 73 carries the noun phrase `purely for display`. Line
83 carries the verb `shows`. The glossary keeps `show`, so rewrite line 73's
phrase to a show-based wording and leave line 83 untouched. The sentence at lines
71 to 74 states that the script also parses the summary line back and adds
`firstTrack` and `firstSector` as numeric fields on the JSON response, for one
narrow reason, and that the file itself is still the authoritative source. Keep
all three of those claims. Keep the word `ALSO` in its original emphatic form or
lower-case it to `also` — either is acceptable, but keep the fact that the parse
is an addition on top of the file the seam wrote.

Do NOT touch the frontmatter. Do NOT touch any fenced code block. Do NOT start
the passive-to-active work yet — that is Task 2.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-disk-access/SKILL.md | python3 -c "import json,sys; d=json.load(sys.stdin); r=[x['rule'] for x in d['violations']]; assert r.count('semicolon')==0, r; assert r.count('synonym-rotation')==0, r; assert 22 > d['count'], d['count']; print('OK count', d['count'], 'of baseline 22')"</automated>
  </verify>
  <done>The lint reports zero `semicolon` hits, zero `synonym-rotation` hits, and a
total under 22. `git diff` for the file shows no changed line inside the
frontmatter and no changed line inside any fenced code block.</done>
</task>

<task type="auto">
  <name>Task 2: Convert the named-actor passives, split the over-length sentences, and check every hedge</name>
  <files>src/skills/c64-disk-access/SKILL.md</files>
  <read_first>
    - src/skills/c64-disk-access/SKILL.md (as Task 1 left it)
    - The `binding_rules` section of this plan, in particular "The special hazard in THIS file"
  </read_first>
  <action>
Continue editing `src/skills/c64-disk-access/SKILL.md` in place.

FIRST: convert passive to active wherever the source names the actor. The nine
measured hits in the original file were `is passed` and `is refused` and
`is spawned` in the options paragraph, `is flagged` in the audit criteria lead-in,
`is reported` in criterion 3, `being treated` and `is reported` in the cyclic-chain
paragraph, `is reported` in the failure-shape paragraph, and `are exposed` in the
"No mutating verb" bullet.

For each one, apply rule 3. Convert it only when the source itself names the actor
or states the actor unambiguously in the same sentence or the sentence before.
Examples of a named actor already present in this file: the seam refuses a value
that begins with a hyphen, the seam spawns the child process, the allocation map
reports the sector free, the `audit` command flags the entry, this skill exposes
the six read-only capabilities. Where the source names no actor, leave the passive
alone. An unconverted advisory passive is an acceptable outcome. An invented actor
is not.

Two conversions need care:

- The audit criteria lead-in applies the flag `suspicious` to a directory entry,
  with named reasons and never a bare boolean, on any of three conditions. The
  bold span `**named reasons, never a bare boolean**` must survive intact. The
  lead-in must still govern all three numbered criteria that follow it.
- The cyclic-chain paragraph carries a 53-word sentence with two passives. Its
  content is a list of conditions (two entries claiming the same first
  track/sector, or a next-directory pointer that refers back to a sector already
  seen, including the directory's own starting sector) and two consequences (the
  command stops treating that as new information, and it reports a top-level
  `chain_error` naming the repeated pointer instead of looping). Split it into
  separate sentences. Every condition and both consequences must survive, and
  `rather than looping` must keep its meaning that the command does not loop.

SECOND: split the over-length sentences. Use the 20-word cap for the procedure
prose (the six capability sections, the options paragraph, and the numbered audit
criteria) and the 25-word cap for the explanatory prose (the closing rationale
paragraphs and the "What this skill does NOT do" bullets). The linter caps at 25,
so it will not report the procedure sentences between 21 and 25 words. Find them
by hand.

The measured over-length sentences in the original file, by opening line, are:
line 22 (23 words), line 30 (30 words and 38 words), line 60 (26 words), line 70
(24 words and 30 words), line 82 (26 words), line 93 (24 words), line 103 (52
words), line 112 (22 words and 24 words), line 120 (53 words and 21 words), line
132 (55 words), line 140 (34 words and 33 words), and line 149 (29 words, 36
words and 26 words). Task 1 already split several of these at their semicolon.
Re-measure after Task 1 rather than trusting this list as the remaining work.

The 52-word `audit` composition sentence needs the most care. It lists exactly
what `audit` composes: `dir` for names and block counts, `bam` for the per-sector
allocation map, and one `entry` call per name for each file's own claimed first
track and sector plus its directory sector's next-directory pointer. It then
states three negatives: no `-format` verb, no `-write` verb, no mutating verb, and
no seventh `host_tool` id. It closes by stating that this is three existing
capabilities composed client-side. Every one of those items survives the split.

THIRD: read `git diff -- src/skills/c64-disk-access/SKILL.md` end to end and
satisfy yourself of four things before you finish.

1. No line inside the YAML frontmatter changed. The `description:` field is
   byte-identical.
2. No line inside a fenced code block changed. The file holds nine fenced blocks.
3. Every verbatim token listed in this plan's `binding_rules` still appears with
   its exact spelling. You changed none of the c1541 flags `-format`, `-write`,
   `-bwrite` and `-delete`. You changed none of the counting facts (six
   capabilities, the other four capabilities, three existing capabilities, no
   seventh `host_tool` id, the six read-only capabilities).
4. Every hedge reads at its original strength. `A flag is a signal to investigate,
   not a verdict.` still stands. `(rarely)` still stands. `can all produce a flag`
   still stands and has not hardened. `cannot really start there` still stands.
   `never hides another entry's own independent flag` still stands.

If any of the four is wrong, correct the file and read the diff again.

Add no test. Run no test suite. Do not invoke the skill or its script.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-disk-access/SKILL.md | python3 -c "import json,sys; d=json.load(sys.stdin); v=d['violations']; r=[x['rule'] for x in v]; ls=[x['line'] for x in v if x['rule']=='long-sentence']; assert r.count('semicolon')==0, r; assert r.count('synonym-rotation')==0, r; assert ls==[3,3], ls; assert 22 > d['count'], d['count']; print('FINAL count', d['count'], 'of baseline 22')"</automated>
  </verify>
  <done>The lint reports a total under 22, zero `semicolon` hits, zero
`synonym-rotation` hits, and exactly two `long-sentence` hits that both sit on
line 3. Line 3 is the exempt `description:` frontmatter, so those two hits
prove the exemption held rather than showing a defect. The diff review in step
THREE passed on all four points.</done>
</task>

</tasks>

<threat_model>
ASVS level 1. Blocking threshold: high. `workflow.security_enforcement` is on in
this project, so this block is present even though the change surface is small.

**The change surface is one non-executable markdown file.** This plan edits prose
in `src/skills/c64-disk-access/SKILL.md`. It adds no code, no dependency, no
configuration key, no network call and no file-system write outside that one
file. It runs no package-manager install, so the package legitimacy gate has no
package to audit and no `[ASSUMED]` or `[SUS]` entry can arise. **No ASVS-1
requirement applies to this change.** The rows below record the one real risk
that a prose rewrite of THIS file carries, rather than inventing a threat to
fill the table.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| author to reading agent | An agent reads this playbook and acts on it. The prose is the only thing that crosses. No untrusted input, no process, and no privilege crosses here. |
| (none added) | This plan creates no new trust boundary. It changes no existing one. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mmp-01 | Tampering | The read-only claims in `src/skills/c64-disk-access/SKILL.md` | low | mitigate | A careless rewrite could weaken the text that says this skill never reaches a mutating c1541 verb. An agent could then believe a write path exists. Task 2 step THREE reads the whole diff. It checks that `-format`, `-write`, `-bwrite` and `-delete` keep their exact spelling. It also checks that they keep their "never reachable" framing. The script enforces read-only on its own, apart from this prose. That holds the severity at low. |
| T-mmp-02 | Information Disclosure | The audit section's hedged diagnostic language | low | mitigate | A hardened hedge could turn a reported signal into a stated verdict about a disk. A reader could then publish a false claim about a release. Task 2 step THREE checks every named hedge. The `binding_rules` section lists each one by its exact wording. |
| T-mmp-SC | Tampering | npm/pip/cargo installs | low | accept | This plan runs no package-manager install. It adds no dependency. No package exists to audit here, so this plan needs no legitimacy checkpoint. |
</threat_model>

<verification>
One check runs in this plan, and it is the check the task author mandated:

```
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-disk-access/SKILL.md
```

Pass bar: the violation count falls strictly below the measured baseline of 22,
and no fact, condition, scope qualifier or hedge changes.

Measured baseline, 2026-09-15, 863 words, 2.5 violations per 100 words:

| Rule | Count | Reducible |
|---|---|---|
| `semicolon` | 10 | yes, to zero |
| `passive-voice` | 9 | partly — only where the source names the actor |
| `long-sentence` | 2 | NO. Both sit on line 3, the exempt `description:` field |
| `synonym-rotation` | 1 | yes, to zero |
| **Total** | **22** | floor is 2 |

The floor is 2, not 0. Decision D-2 exempts the `description:` frontmatter
permanently, so a run that reports 2 is a complete pass and not an oversight.
</verification>

<success_criteria>
- `ste-lint.py --json` over the file reports fewer than 22 violations.
- Zero `semicolon` rule hits remain.
- Zero `synonym-rotation` rule hits remain.
- Exactly two `long-sentence` hits remain, both on line 3.
- The YAML frontmatter is byte-identical.
- All nine fenced code blocks are byte-identical.
- Every c1541 verb, flag, JSON field name, track number, sector number and byte
  count is byte-identical.
- Every hedge in the audit section reads at its original strength.
- This plan adds no test file. No test suite ran. Nothing invoked the skill.
</success_criteria>

<output>
Create `.planning/quick/260915-mmp-c64-disk-access-skill-apply-the-ste100-strict-pass-following/260915-mmp-SUMMARY.md` when done.
</output>
