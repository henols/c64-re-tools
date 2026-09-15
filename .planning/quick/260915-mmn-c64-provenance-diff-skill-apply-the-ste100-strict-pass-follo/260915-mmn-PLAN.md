---
quick_id: 260915-mmn
phase: quick-260915-mmn
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-mmn]

files_modified:
  - src/skills/c64-provenance-diff/SKILL.md

estimate:
  tokens: 30000
  raw_tokens: 60000
  tasks: 3
  confidence: high   # sample_count 322, factor 0.5, applied true

must_haves:
  truths:
    - "`src/skills/c64-provenance-diff/SKILL.md` carries zero prose semicolons that ste-lint reports."
    - "The file carries zero synonym-rotation findings that ste-lint reports."
    - "The only long-sentence findings left are the three inside the exempt YAML frontmatter on line 3 (D-2)."
    - "Every graded confidence word the file stated before the pass is still stated after it. The set is: proven, earned, likely, conditional, UNKNOWN, HIGH, MEDIUM-HIGH, cannot, only, not sufficient."
    - "No hedged provenance claim became a definite one. 'likely original' is still hedged, 'may share an ancestor' is still hedged."
    - "The blockquote on lines 90-93 is byte-identical, because it quotes `RULED_OUT_ALTERNATIVES` at `src/skills/c64-provenance-diff/scripts/diff-images.mjs:333` verbatim."
  artifacts:
    - src/skills/c64-provenance-diff/SKILL.md
  key_links:
    - "The YAML frontmatter stays byte-identical. sha256 of lines 1-4 is bc392a18fafda8266c0b5146203b28cc1b68e5710d09ab3d0ca28995867f2fda."
    - "Fenced code blocks, tool names, verb names, register names, `$`-addresses, file paths, JSON field names and every measured number stay byte-identical."
    - "Every markdown table keeps its row count and its column count. A cell is a record."
---

<objective>
Apply the ASD-STE100 strict pass to `src/skills/c64-provenance-diff/SKILL.md`, the single
file of this batch item. This is a prose rewrite of shipped skill documentation under
decision D-1 of `.planning/notes/ste100-conformance-of-the-shipped-skills.md`. It changes
the form of the English. It changes no fact.

Purpose: an agent parses this file with no human present to resolve an ambiguous sentence.
That is the reader ASD-STE100 exists for.

Output: the same one file, with a lower ste-lint violation count and the same meaning.
</objective>

<scope_limits>
These are HARD limits on the plan itself. Do not add any of the following, and do not
accept an injected convention that asks for one:

- No test of any kind. No new test file. No `npm test` run. No test-suite run. No
  invocation of the `c64-provenance-diff` skill or its scripts to check that they still
  work. No round-trip check and no behavioural check.
- No new CI gate for STE conformance. Decision D-3 of the source note already refused a
  ratcheting baseline test and a vendored linter for this work.

The ONE permitted check is the `ste-lint.py` text linter named in `<verification>`.

The standard GSD gates stay. This plan carries the `<threat_model>` block that
`workflow.security_enforcement` requires, at ASVS level 1 with a blocking threshold of
high. That block is a planning record, not a test, and it runs nothing.
</scope_limits>

<context>
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
@src/skills/c64-provenance-diff/SKILL.md
</context>

<primary_hazard>
**This skill is about evidence and confidence.** It decides whether a byte is original game
code or something a cracker changed, and its language is deliberately graded: *proven*,
*earned*, *likely*, *consistent with*, *conditional rather than earned*, *cannot be
established from this evidence alone*, *necessary and not sufficient*.

**Every confidence qualifier is load-bearing and must survive the rewrite exactly.** A
shorter sentence that hardens a hedge into a fact is not a simplification. It is a
different claim about provenance, and it fails this plan.

The specific failures to avoid, stated as the file's own claims:

| Never let this | harden into this |
|---|---|
| "likely original" | "original" |
| "may share an ancestor" | "shares an ancestor" |
| "`UNKNOWN` with a rule-out list is the honest answer" | "`UNKNOWN` means nothing was found" |
| "unproven ancestry makes every `ORIGINAL` verdict conditional rather than earned" | "`ORIGINAL` is earned" |
| "It is necessary and not sufficient" | "It is the answer" |
| "Usually correct" | "Correct" |
| "is a trainer until proven otherwise" | "is a trainer" |
| "the `ORIGINAL` verdicts inherit whatever confidence that independence claim carries" | any statement that the verdicts are settled |

A length cap tempts a writer to cut exactly these words. Do not cut them. Where a rewrite
would cost a qualifier, keep the longer sentence and record the decline in the SUMMARY.
</primary_hazard>

<binding_rules>
These rules are binding. They are restated here in full, so this plan is executable
without reading any other document.

## The verb glossary — applied identically across every item in this batch

Every word in both columns is a token under discussion, not prose. The backticks mark it
as one.

| Use this verb | Never these |
|---|---|
| `check` | `confirm`, `verify`, `validate` |
| `correct` | `fix`, `repair` |
| `change` | `modify`, `alter` |
| `stop` | `halt`, `terminate` |
| `get` | `fetch` |
| `start` | `launch`, `begin` |
| `remove` | `delete`, `erase` |
| `show` | `display` |

The right-hand words stay untouched when they are part of a verbatim token: a tool name, a
verb name, a flag, a register name, a file path, a JSON field name, a quoted tool string,
or a proper noun. Change the prose verb only.

**One named exception, and it applies to this file.** Where `verify` or `confirm` names a
formal evidentiary act in this skill's own vocabulary rather than a casual synonym,
preserving the domain term beats glossary uniformity. Task 3 carries the one case. Flag any
such exception in the SUMMARY rather than silently flattening it.

## The structural rules

1. Delete every prose semicolon. A clause join becomes two sentences. A semicolon-chained
   list item takes a full stop per item instead.
2. Split every sentence over 20 words in a procedure, and over 25 words elsewhere.
3. Convert passive to active wherever the actor is named. Leave the passive where the
   object genuinely is the topic of a lookup row, and leave it where naming an actor would
   invent one.
4. Keep the compound tense wherever it carries current relevance. "the ledger has been
   regenerated" and "the ledger was regenerated" are different claims. Keep the first where
   the text means the first.

## The prohibitions

1. NEVER touch the `description:` field in the YAML frontmatter on line 3. It is exempt by
   decision D-2. It is a retrieval index, not prose, and a word cap fights the keyword
   packing that makes the skill trigger. It permanently carries three long-sentence
   findings, and those findings are the decision, not an oversight.
2. NEVER touch a fenced code block, a tool name, a verb name (`anchor-search`, `diff`,
   `count-patches`, `ledger`), a flag (`--json`, `--gap-tolerance`, `--ledger`, `--store`),
   a JSON field name (`proven_at`, `generated_at`, `offset`, `anchor_count`,
   `anchors_agreeing`, `generated_tier_sha256`, `loader_ranges`, `reason`), a `$`-address,
   a file path, a version number, a date, a measurement, or any other verbatim token. The
   linter already skips fenced blocks, so a fenced block can never earn a finding and never
   needs an edit.
3. A table cell is a record. Apply STE to the sentences INSIDE a cell. Never apply it to
   the row. Never split a row. Never merge two rows. Never move text between cells. Never
   change a table's column count.
4. Preserve every fact, every condition, every scope qualifier and every hedge. See
   `<primary_hazard>`. Add no fact the source did not state.
5. NEVER change the blockquote on lines 90-93. It quotes the constant
   `RULED_OUT_ALTERNATIVES` at `src/skills/c64-provenance-diff/scripts/diff-images.mjs:333`
   verbatim. Rewriting it would make the documentation misquote the tool. Its passive-voice
   finding on line 92 ("is recorded") is therefore permanent, exactly like the frontmatter
   findings.

## Three mechanical notes about this particular file

- The prose is hard-wrapped at roughly 85 columns. A sentence therefore spans several
  lines. Edit whole sentences, not lines, and re-wrap the result in the same style.
- A long sentence inside a table cell is correctable WITHOUT splitting the row. The linter
  counts sentences, not rows. A full stop placed inside the cell ends one sentence and
  starts the next, and the row stays one row. Line 286 needs this technique.
- The linter reports a synonym-rotation finding ONCE per extra cluster member, at that
  member's first occurrence. Clearing it therefore requires removing EVERY occurrence of
  that member in the whole file, not only the flagged line. The occurrence inventory in
  `<baseline>` lists every one.
</binding_rules>

<baseline>
Measured 2026-09-15 with `ste-lint.py` over `src/skills/c64-provenance-diff/SKILL.md`:
**39 findings, 22 hard, 2363 words, 1.7 per 100 words.**

| Rule | Level | Count | Lines |
|---|---|---|---|
| semicolon | hard | 14 | 45, 65, 97, 103, 130, 164, 222, 252, 254, 282, 283, 284, 286, 289 |
| passive-voice | advisory | 17 | 64, 67, 92, 102, 115, 118, 119, 120, 163, 200, 202, 207, 239, 247, 248, 275, 290 |
| synonym-rotation | hard | 4 | 150, 193, 284, 286 |
| long-sentence | hard | 4 | 3 (three times, exempt), 286 (26 words) |

**The irreducible floor is 4.** Three long-sentence findings on line 3, exempt under
prohibition 1 and decision D-2. One passive-voice finding on line 92, exempt under
prohibition 5 because it sits inside a verbatim quote of the tool's own output. Do not
chase any of the four. Correcting them breaks a prohibition.

A second passive is a likely keep rather than a certain one: line 202, "A diff **hit** is
informative — something was patched." The actor is genuinely unknown there, and naming one
would assert that a cracker did it. That is the exact claim the section says a hit does not
support. Keep the passive unless an active rewrite can be written that names no new actor.

## Synonym cluster inventory — every occurrence outside fences and code spans

| Cluster | Keeper (first in document order) | Every occurrence of the member this pass deletes |
|---|---|---|
| `change` / `alter` | `change` (line 3, frontmatter, untouchable and therefore permanently first) | `alter` line 150, `altering` line 171 |
| `remove` / `delete` | `remove` (line 163) | `Delete` line 193 |
| `fix` / `correct` | `Fix` (line 279, the Troubleshooting table header) | `correct` line 284, `correct` line 288 |
| `check` / `confirm` | `check` (line 227, also present on lines 283 and 284) | `confirm` line 286, twice on the one line |

Two words look like cluster members and are not. The linter does not flag either, and
neither may be changed on cluster grounds: **`alteration`** on line 3 (frontmatter, and
`alter` followed by "ation" has no word boundary) and **`alternatives`** on lines 88 and
288 (a different word entirely, and on line 288 it is part of the quoted definition of
`UNKNOWN`).
</baseline>

<tasks>

<task type="tracer">
  <name>Task 1: Worked example section, end to end — prove the loop and the untouchable quote</name>
  <files>src/skills/c64-provenance-diff/SKILL.md</files>
  <action>
Rewrite ONE section end to end: `## Worked example — the real corpus`, lines 61 to 105.
Stop there. Do not edit any other section in this task.

This section is the thin slice that touches every hazard class this file has, which is why
it goes first. It carries measured numbers, a graded confidence verdict, an explicit hedge
paragraph, a fenced transcript, and the one block of verbatim tool output that must not
change. If the loop works here, it works everywhere in the file.

Correct these six findings, and only these six:

Line 65, semicolon, inside a bold span that also holds the passive on line 64. The bold
span currently reads that the release ids below are shown as `release-a` and `release-b`,
then a semicolon, then that every number is real output from a live run against a
two-release corpus with only the ids renamed. Name the actor and split at the semicolon.
The example is the actor: this example shows the ids as `release-a` and `release-b`. Keep
both bold markers, keep the scope qualifier "with only the ids renamed", and keep the
trailing clause about the tool having no opinion.

Line 67, passive, "release is called". The actor is the reader who names the release.
Rewrite so the tool has no opinion about what you call a release.

Line 97, semicolon, immediately after the graded verdict. The sentence runs from
"**Confidence: HIGH**" through the live run, a semicolon, then the `ledger` reproduction of
the committed `generated_tier_sha256`. Split at the semicolon into two sentences. Keep
`**Confidence: HIGH**` byte-identical, keep the digest prefix byte-identical, and keep the
conclusion that the classification is deterministic attached to the reproduction evidence
that earns it.

Line 102, passive, "is asserted". The actor is this example itself. Rewrite so the example
asserts "independently-cracked" at the top, and does not prove it. The negative half of
that sentence, "not proven by it", is the whole point of the paragraph and must survive
word for word in meaning.

Line 103, semicolon, joining the determinism grade to the inheritance claim. Split into two
sentences. "The determinism is HIGH" is one claim. "The `ORIGINAL` verdicts inherit
whatever confidence that independence claim carries" is a different and weaker claim. Do
not let the split blur them, and do not drop the word "whatever".

Line 92, passive, **DO NOT CHANGE**. Lines 90 to 93 are a markdown blockquote that
reproduces the constant `RULED_OUT_ALTERNATIVES` from
`src/skills/c64-provenance-diff/scripts/diff-images.mjs` line 333 verbatim. Editing it
would make this file misquote its own tool. Leave all four blockquote lines byte-identical.

Leave the fenced transcript on lines 69 to 79 byte-identical. Leave every number
byte-identical: 204 ranges, gap_tolerance 16, coalesced 260, 7 anchors, offset 0, the
tallies of 102 and 102, and the digest. Leave the pointer to the § independence
precondition intact.

After the edit, run the mandated linter and read the finding list. Check that the six
corrected lines are gone from it, that line 92 is still in it, and that no line that had no
finding before has one now. A passive-to-active rewrite can introduce a present-perfect
finding or push a sentence past the 25-word cap, and that would cancel the gain.

Then read `git diff` for this section once, end to end, and answer one question per changed
sentence: does it still state the same fact, the same scope qualifier and the same
confidence grade?
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 19 src/skills/c64-provenance-diff/SKILL.md</automated>
  </verify>
  <done>
`ste-lint.py --baseline 19` exits 0, which means hard findings dropped from 22 to at most
19. No finding is reported on lines 65, 97 or 103. No finding is reported on lines 64, 67
or 102. The finding on line 92 is still reported, and lines 90 to 93 are byte-identical in
`git diff`. Total findings are below 39. No new finding appears on any line that had none.
The fenced transcript on lines 69 to 79 is byte-identical. `**Confidence: HIGH**`, the
`dc7eb080…` digest prefix, and every number in the section are byte-identical.
  </done>
</task>

<task type="auto">
  <name>Task 2: The rest of the prose — sections 1 to 8, excluding the Troubleshooting table</name>
  <files>src/skills/c64-provenance-diff/SKILL.md</files>
  <action>
Apply the same pass to every prose section outside the worked example, using the exact
rewrite habits settled in task 1. The range is lines 6 to 60 and lines 106 to 277. Leave
line 3 alone. Leave lines 61 to 105 alone, task 1 finished them. Leave lines 278 to 292
alone, task 3 owns the Troubleshooting table.

Work in the order that clears risk fastest.

**First, the six prose semicolons.** Each is a clause join and each becomes two sentences.
Line 45 joins what `anchor-search` updates to what `ledger` rewrites. Line 130 joins where
classification lives to what the bytes stay. Line 164 joins what the ledger's verdict is to
the never-claim about automatic exclusion, and that never-claim keeps the word "never".
Line 222 joins "Both need a verdict" to "neither should be reproduced without one", and the
second half keeps "neither" and "without one". Line 252 joins the strictly-shorter-than-N
coalescing rule to the exactly-N rule, and this is the off-by-one paragraph, so both halves
keep their italic emphasis and their exact boundary words. Line 254 joins what two releases
can establish to what they cannot, and the "cannot establish intent" half is the point of
the bullet.

**Second, the two synonym-rotation findings.** Line 150: a `CRACKER-PATCH` row does not
drop, filter or **`alter`** a single byte. Replace it with `change`. Line 171: a cracker
changing bytes inside game code **is `altering`** gameplay. Rewrite active and with the
keeper verb, so that a cracker who changes bytes inside game code changes gameplay, and
keep the second clause naming unlimited lives, disabled collision or a frozen timer as the
usual reason. Both occurrences must go, or the finding stays. Line 193: replace **Delete**
the word *independently* with "Remove", keeping the italic on *independently* and keeping
the conclusion that the verdict is worthless without it. Do not touch `alteration` on line
3 and do not touch `alternatives` on line 88.

**Third, the twelve passive-voice findings,** one at a time, converting only where the text
already names the actor. Lines 115 and 119, "is seeded": `bucketManifest` is named as the
actor in the sentence directly above, so make it the subject. Keep both bold spans and keep
the "never from `NOTES.md` prose" prohibition in bold. Line 118, "being classified": rewrite
so that reading a loader range out of prose once classified `$08F5`, a permanent
joystick-poll instruction, as loader code. Keep `$08F5` and keep "permanent". Line 120,
"was tried": a bare scan produced a real false positive against a real corpus. Keep both
uses of "real", they are the claim. Line 163, "is removed": the actor is the export, so
say what the export does, and keep the paired claim that no gap appears in the output. Line
200, "is established": the actor is the reader, so say until you establish it. Line 202,
"was patched": **keep the passive** unless an active rewrite names no new actor, because
naming one asserts the cracker did it and the section exists to say a hit does not support
that. Line 207, "was tested": name the diff as the actor, and keep "only the second one".
Line 239, "been visited": name the actor and keep the compound tense, because the claim is
about a state that is true now. Lines 247 and 248, "was found" twice: this bug appeared in
a live run, and a wide `ORIGINAL` range ran straight through a `loader` sub-range nested
inside it. Keep `splitRangeByManifestKind` and keep the conclusion about silent mislabelling
after the first boundary. Line 275, "was written": the actor is the reader who wrote the
grade, so say what you actually knew when you wrote it, and keep "only worth anything if".

**Fourth, read the four bullets under `## Before you trust a verdict`** and the four
numbered detector signatures under `### The detector that does not depend on the diff` once
more after editing. These are the densest graded-confidence prose in the file. The coverage
bullet scopes every verdict to "the addresses visible at the post-loader game-entry point",
not to the whole running game. The confidence bullet says unproven ancestry makes every
`ORIGINAL` verdict conditional rather than earned. Detector 1 says an absolute-mode-only
search is the standard way the hunt returns a false negative. Detector 2 says both need a
verdict and neither should be reproduced without one. The closing rule says a negative is a
result and must state its own limits. Every one of those qualifiers survives.

Leave every fenced block, every `$`-address, every verb name, every flag, every JSON field
name and every file path byte-identical. Keep the roughly 85-column hard wrap. Keep the
`| Function | Means | Why it matters |` table and the `| Need | Go to |` table at their
current row and column counts.

After the edit, run the mandated linter. Check that no line that had no finding before
has one now.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 11 src/skills/c64-provenance-diff/SKILL.md</automated>
  </verify>
  <done>
`ste-lint.py --baseline 11` exits 0, which means hard findings dropped to at most 11: the
three exempt frontmatter long sentences, the five Troubleshooting-table semicolons, the two
Troubleshooting-table synonym findings and the one Troubleshooting-table long sentence that
task 3 owns. No semicolon finding is reported on lines 45, 130, 164, 222, 252 or 254. No
synonym-rotation finding is reported for the `change`/`alter` cluster or the
`remove`/`delete` cluster. Passive-voice findings dropped from 17 to at most 5. Total findings are below the
count task 1 left. Every table in the edited range has the same row count and column count
as before. `git diff` shows no change to line 3, to lines 61 to 105, to lines 278 to 292,
or to any fenced block, `$`-address, verb name, flag, JSON field name or path.
  </done>
</task>

<task type="auto">
  <name>Task 3: The Troubleshooting table — cell-level rewrites, rows untouched</name>
  <files>src/skills/c64-provenance-diff/SKILL.md</files>
  <action>
Apply the pass to the `## Troubleshooting` table, lines 278 to 292, and to nothing else.
Every finding here sits inside a table cell, so prohibition 3 governs the whole task: apply
STE to the sentences INSIDE a cell, never to the row. The table has 12 data rows and 2
columns before this task and must have 12 data rows and 2 columns after it.

**The five cell semicolons.** Line 282 joins the expectation that two verbs write to the
instruction to diff the two files. Line 283 joins the instruction to find the cause to the
statement that the digest is the determinism check. Line 284 joins the counting rule to the
two-release consequence. Line 286 joins the one-release rule-out to the unproven-ancestry
consequence. Line 289 joins the instruction to use `splitRangeByManifestKind` to the fact
that coalescing does not respect kind boundaries. Replace each semicolon with a full stop
inside its own cell. The row is not split and no text crosses the column boundary.

**The one long sentence, line 286, 26 words.** It is the sentence that says a clean diff
only rules out a trainer in *one* release and not the other, and that with unproven
ancestry that is a weaker claim than it sounds. Splitting the cell semicolon on the same
line already ends this sentence early, so check the linter after the semicolon pass before
doing anything further. Keep the italic on *one*, keep "and not the other", and keep
"weaker claim than it sounds". Never split the row.

**The `fix`/`correct` cluster.** The keeper is the header cell `Fix` on line 279, but the two
`correct` occurrences on lines 284 and 288 are the ADJECTIVE sense meaning accurate, not
the verb sense meaning `repair`. They name no action. Remove the cluster from the file
entirely rather than flattening one sense into the other: change the header cell on line
279 from `Fix` to `What to do`, and change "Usually correct." on line 284 and "Also usually
correct." on line 288 to "Usually accurate." and "Also usually accurate." The header change
is accurate for every row in this table, because several rows state an expectation rather
than a `repair`. The hedge "Usually" and "Also usually" survives in both cells, and dropping
either one would harden a hedged claim, which fails this plan. Record the header rename in
the SUMMARY.

**The `check`/`confirm` cluster, and the one glossary exception.** Line 286 uses `confirm`
twice, in "Asked to confirm a release has no trainer" and "You cannot confirm that from a
diff alone". The glossary keeper is `check`, but `check` is the wrong word here: this row
is about establishing a claim with evidence, and saying you cannot check something is a
weaker and different statement from saying you cannot establish it. Use this skill's own
evidentiary verb instead: **prove**. The file already uses it in `anchor-search` proving an
offset, in "is a trainer until proven otherwise", and in "not proven by it". `prove` is in
no synonym cluster, so replacing both occurrences clears the finding without weakening the
claim. Flag this as the named glossary exception in the SUMMARY.

**Line 290, passive, "is earned".** `RELEASES.json`'s `loader_ranges` wins because live
disassembly evidence earns it. Name disassembly as the actor and keep the domain verb
"earn", which this file uses as a graded-evidence term on lines 115 and 256. Keep the
closing sentence about prose being how `$08F5` got misclassified.

Leave every `$`-address, every verb name, every flag, every JSON field name, every quoted
tool string and every path in the table byte-identical. That includes the `unknown release
"x" -- known releases: …` error string on line 292 and the `node
src/skills/c64-provenance-diff/scripts/releases.mjs list` invocation, both of which are
verbatim tokens.

Run the mandated linter one final time over the whole file. Then read `git diff` for the
whole file once, end to end, against the `<primary_hazard>` table before the commit.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --baseline 3 src/skills/c64-provenance-diff/SKILL.md</automated>
  </verify>
  <done>
`ste-lint.py --baseline 3` exits 0, which means hard findings dropped from 22 to at most 3,
and the 3 that remain are the exempt frontmatter long sentences on line 3. semicolon
findings: 0. synonym-rotation findings: 0. long-sentence findings outside line 3: 0. Total
findings are strictly below 39. The finding on line 92 is still reported and lines 90 to 93
are byte-identical. The Troubleshooting table still has 12 data rows and 2 columns. `git
diff` shows no change to line 3, to any fenced block, to the `releases.mjs` invocation, or
to the `unknown release "x"` error string.
  </done>
</task>

</tasks>

<threat_model>
**ASVS level 1. Blocking threshold: high.** Configured by `workflow.security_asvs_level=1`
and `workflow.security_block_on=high`.

**The change surface is one non-executable markdown documentation file:**
`src/skills/c64-provenance-diff/SKILL.md`. This plan changes English prose inside it and
nothing else. It adds no code, changes no code, adds no dependency, runs no install, opens
no network call, reads no untrusted input, and touches no credential, no path-resolution
seam and no process spawn. The scripts under
`src/skills/c64-provenance-diff/scripts/` are read for citation only and stay unmodified.
**No ASVS-1 threat applies to this change.** The register below records the one real risk
this plan carries, which is an accuracy risk rather than a security one.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none crossed | No trust boundary exists in this change. The edit is prose inside a committed markdown file that the repository already ships. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-260915-mmn-01 | Information disclosure (accuracy, not confidentiality) | `src/skills/c64-provenance-diff/SKILL.md` prose | low | accept | A careless rewrite could weaken a provenance or confidence qualifier that an agent later relies on. The `<primary_hazard>` table, prohibition 4, the per-line guard rails in all three `<task>` bodies, and the semantic `git diff` read in `<verification>` already mitigate it. Residual risk is accepted at low. |

No package-manager install task exists in this plan, so the package-legitimacy gate does
not apply and no `T-…-SC` supply-chain row is present.
</threat_model>

<verification>
## The mandated command

This is the check the task author mandated, and it is the only check this plan runs:

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json \
  src/skills/c64-provenance-diff/SKILL.md
```

**The pass bar: the violation count strictly decreases from the baseline of 39, with no
semantic change to any fact, condition, scope qualifier or hedge.**

## Reading the result per rule and per line

The plain form is easier to read than the JSON form and reports the same findings:

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py \
  src/skills/c64-provenance-diff/SKILL.md
```

To compare against the `<baseline>` table by rule:

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json \
  src/skills/c64-provenance-diff/SKILL.md \
  | python3 -c "
import json,sys,collections
d=json.load(sys.stdin)
v=d['violations']
print('TOTAL', d['count'], 'hard', d['hard_count'], '| baseline-total 39 baseline-hard 22')
for r,c in collections.Counter(x['rule'] for x in v).most_common(): print(c, r)
for x in v: print(' ', x['line'], x['rule'], repr(x['match']))
"
```

## The strict-decrease gate, stated as one command

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json \
  src/skills/c64-provenance-diff/SKILL.md \
  | python3 -c "import json,sys;d=json.load(sys.stdin);n=d['count'];print('count',n,'hard',d['hard_count']);sys.exit(0 if n<39 else 1)"
```

Exit 0 means the total strictly decreased. On the unedited tree this command prints
`count 39 hard 22` and exits 1, which is the correct reading of the baseline rather than a
failure of this plan.

## The exit code, stated plainly

`ste-lint.py` exits 1 whenever HARD findings exceed `--baseline` (default 0), and it
ignores advisory findings when it decides the exit code. On the unedited tree it therefore
exits 1. The three task gates use `--baseline N` so that the exit code becomes the real
verdict for that task: 19 after task 1, 11 after task 2, 3 after task 3.

Advisory findings, which are the passive-voice ones, never move the exit code. Read their
count from the trailing summary line or from the JSON `count` field, and compare it against
the `<baseline>` table by hand.

## The semantic check, which no linter performs

Read `git diff` for the file once, end to end, before committing. For every changed
sentence, answer one question: does it still state the same fact, the same condition, the
same scope qualifier and the same hedge?

Check the `<primary_hazard>` table row by row against the final text. A dropped "may", a
dropped "only", a dropped "usually", a dropped "not sufficient", a dropped "conditional
rather than earned", a dropped date, a dropped number or a promoted certainty fails this
plan even when the linter count drops.
</verification>

<success_criteria>
- The mandated command reports a total strictly below 39 for the file.
- semicolon findings: 0. synonym-rotation findings: 0.
- long-sentence findings: 3, all three on line 3, all three inside the exempt YAML
  frontmatter (D-2).
- passive-voice findings: below 17, and the line 92 finding is still among those that
  remain, because lines 90 to 93 quote `diff-images.mjs` verbatim.
- sha256 of lines 1 to 4 is still
  bc392a18fafda8266c0b5146203b28cc1b68e5710d09ab3d0ca28995867f2fda.
- Every markdown table has the same row count and column count as before.
- Every graded confidence word survives: proven, earned, likely, conditional, only,
  usually, whatever, necessary and not sufficient, cannot, `UNKNOWN`, `HIGH`,
  `MEDIUM-HIGH`.
- `git diff --stat` lists exactly `src/skills/c64-provenance-diff/SKILL.md` and nothing
  else.
- No file was added and no file was removed.
- No test file exists that did not exist before, and no test suite was run.
</success_criteria>

<output>
Create `.planning/quick/260915-mmn-c64-provenance-diff-skill-apply-the-ste100-strict-pass-follo/260915-mmn-SUMMARY.md` when done.

Record in it:
- the before and after violation count, by rule.
- which glossary verb you chose for each of the four clusters present in this file.
- the `Fix` to `What to do` header rename. State why the adjective sense of `correct`
  moved to "accurate" instead of flattening into the verb sense.
- the named glossary exception: `confirm` to `prove` on line 286. State why `check` weakens
  the claim.
- every finding you deliberately left in place, with the prohibition that protects it. The
  set is: the three frontmatter long sentences (D-2), the line 92 passive inside the
  verbatim `diff-images.mjs` quote, and line 202 if you kept the passive there.
- every sentence where you declined a rewrite because it would have cost a confidence
  qualifier.
</output>
