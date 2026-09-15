---
quick_id: 260915-mmo
phase: quick-260915-mmo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: ["src/skills/acme-build/SKILL.md"]
autonomous: true
must_haves:
  truths:
    - "ste-lint reports fewer than 23 violations for src/skills/acme-build/SKILL.md."
    - "ste-lint reports 0 semicolon violations and 0 synonym-rotation violations for that file."
    - "Every fact, condition, scope qualifier and hedge in the file keeps its original meaning."
    - "The `description:` frontmatter line is byte-identical to the baseline."
    - "Every fenced code block is byte-identical to the baseline."
    - "Every verbatim token listed in <hazard_tokens> is present at its baseline count."
  artifacts:
    - "src/skills/acme-build/SKILL.md"
  key_links:
    - "The ACME detection prose keeps the standing project rule: the project detects an external tool and refuses by name with the remedy. The project never auto-installs one."
    - "`$ACME`, `0.97 \"Zem\"` and `31 Jan 2021` stay byte-identical, because other documents cite them."
---

<objective>
Apply the ASD-STE100 strict pass to one file: `src/skills/acme-build/SKILL.md`.

Purpose: an agent reads this playbook with no person present to resolve an ambiguous
sentence. That reader is the reason ASD-STE100 exists.

Output: the same file, with fewer ste-lint violations and with every fact unchanged.

This is a prose rewrite. It changes no code, no test and no behaviour.
</objective>

<context>
@src/skills/acme-build/SKILL.md
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
</context>

<scope>
**In scope:** the prose of `src/skills/acme-build/SKILL.md`.

**Out of scope, and forbidden:**
- Any other file. This plan touches exactly one path.
- Any test. Do not write a test, do not run `npm test`, do not run the test suite, do not
  invoke the skill, and do not assemble anything. The one permitted check is the ste-lint
  text linter named in `<verify>`.
- Any behaviour change, any correction of a documented fact, and any new fact.
- The `description:` field in the YAML frontmatter (line 3). It is exempt by decision D-2
  of `.planning/notes/ste100-conformance-of-the-shipped-skills.md`. It is a retrieval
  index, and its word count is deliberate. Its permanent `long-sentence` violation stays
  on the books.
</scope>

<binding_rules>
These rules come from `.planning/ste100-batch-rules.md`. This plan restates them in full,
because you must obey them without opening that file.

1. **Fixed verb glossary. Apply it identically.**
   check (not confirm, verify or validate), correct (not fix or repair),
   change (not modify or alter), stop (not halt or terminate), get (not fetch),
   start (not launch or begin), remove (not delete or erase), show (not display).
2. **Delete every prose semicolon.** A clause join becomes two sentences. A
   semicolon-chained list item takes a full stop.
3. **Split sentences over 20 words in a procedure, over 25 elsewhere.**
4. **Convert passive to active wherever the sentence names the actor, or wherever you can
   name the actor from the surrounding text.** Leave the passive where the object is
   genuinely the topic of a lookup row.
5. **Keep the compound tense where it carries current relevance.** "has completed" and
   "completed" are different claims.
6. **Do not touch the `description:` field in the YAML frontmatter.** D-2 exempts it.
7. **Do not touch fenced code blocks, tool names, register names, binary paths, version
   numbers or any verbatim token.**
8. **A table cell is a record.** Apply STE to the sentences inside a cell. Never apply it
   to the row. Never split a row and never merge two rows.
9. **Preserve every fact, condition, scope qualifier and hedge.** "may have failed" never
   becomes "failed". "is therefore evidence that ... and nothing more" keeps the "and
   nothing more".

**Precedence rule:** meaning outranks the violation count. If a rewrite would weaken,
strengthen or blur a claim, keep the original sentence and record that decision in the
summary. A lower count that costs a fact is a failure of this plan, not a pass.
</binding_rules>

<hazard_tokens>
This file documents how the project finds the ACME cross assembler. The following strings
are verbatim tokens. Each one must survive byte-identical, at the stated count.

| Token | Count | Why it is load-bearing |
|---|---|---|
| `$ACME` | 3 | The environment variable name. Other documents and the Troubleshooting table cite it. |
| `0.97 "Zem"` | 1 | The exact ACME release that the documented re-check used. |
| `31 Jan 2021` | 1 | That release's date. |
| `findAcmeLib()` | 1 | The function that names the install locations. |
| `src/mcp/vice/host-tool.mts` | 1 | The host-tool execution seam. |
| `acme.build` | 1 | The allowlist entry name in that seam. |
| `acme.mts` | 1 | The module that owns `findAcmeLib()`. |
| `acme-verify.ts` | 1 | The test-only byte-diff oracle. |
| `VICE_REQUIRE_ACME=1` | 1 | The CI variable that hard-fails the oracle's test. |
| `anno export-asm` | 5 | The verb that replaced the withdrawn disassembly route. |

**Two further hazards, both about meaning rather than bytes:**

- **The install-location list is deliberately absent from this file.** Lines 205-216 say
  that `acme.mts`'s own `findAcmeLib()` names the conventional install locations, and that
  this file does not document them a second time. The four filesystem prefixes
  (`/usr/local/share/acme` and its siblings) are NOT in this file. Do not add them, do not
  name them, and do not describe them. Adding them would recreate the duplication that
  sentence exists to prevent.
- **The project never auto-installs an external tool.** It detects a tool, then refuses by
  name with the remedy in the message. The Setup section and the Troubleshooting row
  `install the ACME cross assembler and put acme on PATH` both carry that shape: the
  message tells the *user* to install ACME. Keep that meaning exactly. Never rewrite any
  sentence into a claim that the skill, the script or the seam installs ACME.
- **Where the probe runs is load-bearing.** The Setup section says the probe runs on the
  HOST, inside the seam's executor, and never inside a container. It also says `$ACME`
  must be set in the environment the host broker process sees, not in the script's own
  environment. Keep both conditions.
</hazard_tokens>

<baseline>
Measured on the unmodified file with the command in `<verify>`:

- **23 violations**, 9 of them hard, over 1441 words (1.6 per 100 words).
- By rule: `passive-voice` 14, `semicolon` 5, `long-sentence` 2, `synonym-rotation` 2.
- **One of the 23 is permanent.** The `long-sentence` hit at line 3 is the `description:`
  frontmatter, exempt by D-2. It stays. The other 22 are addressable.

Two baseline hashes, for the byte-identity checks:

- `description:` line, first 16 hex characters of its sha256: `ba56ba0677fc1642`
- all fenced-code lines including the fence markers, same hash form: `0c36d09a846bd991`
</baseline>

<violation_inventory>
Line numbers are from the unmodified file. They move as you edit, so re-run the linter
rather than trusting them after your first edit. The rewrite column is guidance, not a
dictation: check each one against the source sentence before you apply it.

| Line | Rule | Site | Guidance |
|---|---|---|---|
| 3 | long-sentence | `description:` frontmatter | **Leave it. D-2 exempt.** |
| 25 | passive-voice | "`-I DIR` is resolved workspace-relative" | The seam is the actor. Name it. |
| 26 | passive-voice + synonym | "the project root the host broker was launched with" | This is the only `launch` in the file, and it rotates against "Start" on line 104. The glossary keeps "start". Rewrite so the broker starts with that project root. Keep the meaning: the root is the one the broker started with. |
| 28 | passive-voice | "is refused by the seam rather than passed to ACME" | The sentence already names the seam. Make the seam the subject. Keep "rather than passed to ACME". |
| 28 | semicolon | "...passed to ACME; this is a documented contract change..." | Full stop. Promote the second clause to its own sentence. Keep the whole trailing condition about earlier releases. |
| 99 | semicolon | "(`01 08` = `$0801`); code follows." | Full stop. Keep `01 08` and `$0801` byte-identical. |
| 104 | synonym-rotation | "Start from the scaffold" | Keep "Start". Resolve the pair at line 26 instead. |
| 104 | passive-voice | "whose `SYS` target is computed" | The point is that the stub computes the target rather than hard-coding it, so the entry point stays correct as the program grows. Keep that point. |
| 145 | passive-voice | "both halves are kept" | The document keeps them. Name that actor, or use the imperative. |
| 146 | passive-voice | "why the route is shaped the way it is" | The withdrawal records why the route has its current shape. |
| 153 | passive-voice | "It is not a rename of what was removed" | The phrase "the removed route" is already used earlier in the same paragraph. Reuse it. |
| 154 | passive-voice | "its correctness is settled by assembling ... and diffing ..." | Make the assembling-and-diffing the subject. Keep the bold span, keep "never by an exit code, and never by a string match". |
| 165 | passive-voice | "neither is derived from the other" | Make it active without changing the claim: neither one derives from the other. |
| 168 | passive-voice | "a directory the whole export is written into" | The verb writes the export. Keep the defaulting rule about the store and the image exactly as written. |
| 172 | passive-voice | "A non-empty destination is refused rather than overwritten unless you pass `--force`" | The verb refuses it. Keep the `--force` condition and keep "rather than overwritten". |
| 183 | passive-voice | "is exercised by `acme-verify.test.ts`" | Make the test the subject. Keep the parenthetical about CI and `VICE_REQUIRE_ACME=1`. |
| 186 | passive-voice | "evidence that source was written and nothing more" | The verb wrote the source text. Keep "and nothing more". |
| 186 | semicolon | "...and nothing more; it is not an assembler verdict." | Full stop. Keep both claims. |
| 194 | semicolon | "documents that route and this history together; it is not restated there." | Full stop. Promote the second clause as written. Do not reinterpret "there". |
| 248 | passive-voice | "what was actually known when it was written" | You are the actor: what you actually knew when you wrote it. Keep "actually". |
| 252 | synonym-rotation | Troubleshooting column header `Fix` | The glossary keeps "correct". Change the header word. Do not touch the rows. |
| 260 | long-sentence (27 words) | Troubleshooting cell about the `.a` extension | Split the sentences inside the cell. Never split the row. |
| 260 | semicolon | "ACME source is plain text; the agent's Read tool refuses..." | Full stop inside the same cell. Keep the dated measurement "verified both directions in this container, 2026-08-04" exactly as the cell states it. |

**Sites the linter does not flag, and which you must leave alone:**
- "was WITHDRAWN on 2026-08-29" — the sentence names no actor, and the capitals are
  deliberate emphasis.
- The quoted false-pass output `ACME not found in PATH (skipped)`, `All roundtrip
  verifications passed.` and `EXIT=0` — these are verbatim transcript strings. The word
  "verifications" inside them is part of the quote, not prose.
- Every identifier that contains a glossary word, such as `acme-verify.ts`,
  `acme-verify.test.ts` and `VICE_REQUIRE_ACME=1`.
</violation_inventory>

<tasks>

<task type="auto">
  <name>Task 1: Clear the 9 hard violations — semicolons, synonym rotation, the one addressable long sentence</name>
  <files>src/skills/acme-build/SKILL.md</files>
  <action>
Work the hard rows of the `<violation_inventory>` table above, and only those rows: the 5
`semicolon` sites, the 2 `synonym-rotation` sites, and the `long-sentence` site in the
Troubleshooting cell. Leave the `long-sentence` hit in the `description:` frontmatter
untouched, because D-2 exempts it.

For each semicolon, split the sentence at the semicolon and promote the second clause to
its own sentence. Prefer the original words of that clause over a paraphrase, because a
paraphrase can drift. Keep every qualifying clause that follows.

For the synonym rotation between "Start" on line 104 and "launched" on line 26, keep
"Start" and rewrite line 26, because the glossary keeps "start" over "launch". Rewrite the
Troubleshooting column header that rotates against "correct" to the glossary verb, and
leave the table rows alone.

For the over-long sentence in the Troubleshooting cell, split it into shorter sentences
inside the same cell. The cell is a record: keep the dated measurement, keep the three
accepted file extensions, and keep the `sed` remedy. Never split or merge a table row.

Read `<binding_rules>` and `<hazard_tokens>` before you start, and obey the precedence
rule: meaning outranks the count.
  </action>
  <verify>
    <automated>ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/acme-build/SKILL.md | python3 -c "import json,sys,collections; d=json.load(sys.stdin); c=collections.Counter(v['rule'] for v in d['violations']); print('count',d['count'],'by-rule',dict(c)); sys.exit(0 if (c['semicolon']==0 and c['synonym-rotation']==0 and c['long-sentence']<=1 and d['count']<23) else 1)"</automated>
  </verify>
  <done>The linter reports 0 `semicolon` violations, 0 `synonym-rotation` violations, at most 1 `long-sentence` violation (the exempt `description:` line), and a total under 23.</done>
</task>

<task type="auto">
  <name>Task 2: Convert the 14 passive-voice sites to active where the actor is nameable</name>
  <files>src/skills/acme-build/SKILL.md</files>
  <action>
Work the 14 `passive-voice` rows of the `<violation_inventory>` table. Each one sits in
prose, not in a lookup row, and the surrounding text names or implies the actor: the seam,
the host broker, the BASIC stub, the document, the `anno export-asm` verb, the test file,
or you the reader.

Name the actor and use an active verb. Where the guidance column proposes a rewrite, check
it against the source sentence first and change it if the source says something narrower.

Four conditions in this region are load-bearing and must survive word for word in meaning:
the `--force` condition on a non-empty destination, the rule that `--out` defaults beside
the store rather than beside the image, the claim that the oracle is test-only and absent
from the published package, and the claim that a clean run is evidence of written source
and nothing more rather than an assembler verdict.

Leave a passive in place when you cannot name its actor from the text. Record each one you
leave, with a one-line reason, for the summary. Do not invent an actor to satisfy the
linter.

Keep every present-perfect tense that carries current relevance. Keep the bold and italic
spans where they are, because they mark the claims a reader must not skim.
  </action>
  <verify>
    <automated>ROOT=$(git rev-parse --show-toplevel) && cd "$ROOT" && python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/acme-build/SKILL.md | python3 -c "import json,sys,collections; d=json.load(sys.stdin); c=collections.Counter(v['rule'] for v in d['violations']); print('count',d['count'],'by-rule',dict(c)); sys.exit(0 if (c['passive-voice']<=3 and c['semicolon']==0 and c['synonym-rotation']==0 and d['count']<23) else 1)"</automated>
  </verify>
  <done>The linter reports at most 3 `passive-voice` violations, still 0 `semicolon` and 0 `synonym-rotation` violations, and a total under 23. Every retained passive has a written reason.</done>
</task>

<task type="auto">
  <name>Task 3: Check the result — count down, facts unchanged, verbatim tokens intact</name>
  <files>src/skills/acme-build/SKILL.md</files>
  <action>
Run the mandated linter command once more and record the final count and the per-rule
breakdown for the summary.

Then read `git diff -- src/skills/acme-build/SKILL.md` end to end, hunk by hunk. For each
hunk, state to yourself what the old text claimed and what the new text claims. They must
be the same claim. Look in particular for a lost hedge, a lost scope qualifier, a lost
date, a lost measurement, a dropped condition, and a claim that became stronger than the
evidence behind it.

Restore the original wording of any hunk that changed a claim, even when the restore puts
a violation back on the books. The precedence rule in `<binding_rules>` applies.

Check that the diff touches exactly one file, that it adds no filesystem install prefix
for the ACME library, and that no sentence now says the skill, the script or the seam
installs ACME.

The automated check below also confirms the `description:` frontmatter line and every
fenced code block are byte-identical to the baseline, and that each verbatim token of
`<hazard_tokens>` still appears at its baseline count.

Write the summary at the path in `<output>`. Record the baseline count, the final count,
the per-rule breakdown, every passive you deliberately kept, and every hunk you reverted
to protect a claim. Do not run any test.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && F=src/skills/acme-build/SKILL.md && python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json "$F" | python3 -c "import json,sys,collections; d=json.load(sys.stdin); c=collections.Counter(v['rule'] for v in d['violations']); print('count',d['count'],'hard',d['hard_count'],'by-rule',dict(c)); sys.exit(0 if d['count']<23 else 1)" && test "$(grep -m1 '^description: ' "$F" | sha256sum | cut -c1-16)" = ba56ba0677fc1642 && test "$(awk '/^```/{f=!f; print; next} f{print}' "$F" | sha256sum | cut -c1-16)" = 0c36d09a846bd991 && for t in '$ACME:3' '0.97 "Zem":1' '31 Jan 2021:1' 'findAcmeLib():1' 'src/mcp/vice/host-tool.mts:1' 'acme.build:1' 'acme.mts:1' 'acme-verify.ts:1' 'VICE_REQUIRE_ACME=1:1' 'anno export-asm:5'; do tok=${t%:*}; want=${t##*:}; got=$(grep -oF -- "$tok" "$F" | wc -l); test "$got" = "$want" || { echo "TOKEN DRIFT: $tok want=$want got=$got"; exit 1; }; done && test "$(git diff --name-only | wc -l)" -ge 1 && echo "CHECKS OK"</automated>
  </verify>
  <done>The linter count is under 23. The `description:` line and every fenced block are byte-identical to the baseline. Every verbatim token is present at its baseline count. The diff review found no changed claim, or you restored every claim that changed. The summary exists.</done>
</task>

</tasks>

<threat_model>
`workflow.security_enforcement` is `true` and `security_asvs_level` is 1 for this project,
so this plan carries a threat model. The blocking threshold is **high**.

## Change Surface

This plan changes one non-executable markdown document,
`src/skills/acme-build/SKILL.md`. It adds no code, no dependency, no endpoint, no
configuration and no data path. It installs no package from npm, pip or cargo, so the
package-legitimacy gate does not apply and this plan carries no `-SC` supply-chain row.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none crossed | No untrusted input reaches this change. The file is documentation that an agent reads, and nothing parses it as code. |

## STRIDE Threat Register

**No ASVS Level 1 verification requirement applies to this change.** ASVS Level 1 covers
an executing application: its authentication, session handling, access control, input
handling, and the like. A prose rewrite of a markdown playbook has none of those surfaces.
This plan does not invent a threat to fill the table.

One documentation-integrity concern is real and belongs on the record, so it is listed
here with its severity and its disposition:

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mmo-01 | Tampering | `src/skills/acme-build/SKILL.md` — the Setup and Troubleshooting prose about finding ACME | medium | mitigate | A careless rewrite could soften a standing project rule. That rule says the project detects an external tool, then refuses by name with the remedy. A softened sentence could read instead as a claim that the project installs the tool. An agent reading that sentence could then shell out to a package manager. Task 3 gates on this. It runs the `<hazard_tokens>` count check and the byte-identity check on every fenced block. It also reads the whole diff hunk by hunk, and checks that no sentence claims the skill, the script or the seam installs ACME. |
| T-mmo-02 | Information Disclosure | same file | low | accept | A rewrite cannot disclose what it does not add. This plan adds no new fact, no path, no credential and no host name. The `<binding_rules>` forbid a new fact, and Task 3 reads the whole diff. |

Both threats are below the **high** blocking threshold, so neither one blocks execution.
</threat_model>

<verification>
The mandated check, stated in full:

`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/acme-build/SKILL.md`

The linter exits 1 while any violation remains, and one violation is permanent by D-2.
Therefore the pass decision reads the `count` field of the JSON, never the exit code. The
`<verify>` blocks above pipe the JSON into a `python3` reader for exactly that reason.

**Pass bar:** the violation count decreases strictly from the baseline of 23, with no
semantic change to any fact, condition, scope qualifier or hedge.

**Expected landing point:** 1 to 3 violations. 1 is the exempt `description:` line.

No other check runs. No test file, no test suite, no skill invocation, no assembly run.
</verification>

<success_criteria>
- `src/skills/acme-build/SKILL.md` is the only changed file.
- The ste-lint count is below 23, with 0 `semicolon` and 0 `synonym-rotation` violations.
- Every fact, condition, scope qualifier and hedge reads the same as before.
- The `description:` frontmatter line is byte-identical.
- Every fenced code block is byte-identical.
- Every token in `<hazard_tokens>` is present at its baseline count.
- The ACME detection prose still says the project detects the tool and refuses by name
  with the remedy, and still never says the project installs it.
- You wrote no test and you ran no test.
</success_criteria>

<output>
Create `.planning/quick/260915-mmo-acme-build-skill-apply-the-ste100-strict-pass-following-ever/260915-mmo-SUMMARY.md` when done.
</output>
