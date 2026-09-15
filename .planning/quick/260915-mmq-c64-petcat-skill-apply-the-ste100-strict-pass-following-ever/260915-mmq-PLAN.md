---
quick_id: 260915-mmq
phase: quick-260915-mmq
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260915-mmq]

files_modified:
  - src/skills/c64-petcat/SKILL.md

# This plan removes no file. `files_deleted` is therefore absent by
# measurement, not by omission.

estimate:
  tokens: 18000       # raw_tokens x factor 0.5
  raw_tokens: 36000
  tasks: 3
  confidence: high    # sample_count 322, factor 0.5, applied true

must_haves:
  truths:
    - "`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-petcat/SKILL.md` reports a `count` below the baseline of 9."
    - "The same report holds zero `semicolon` violations."
    - "Every remaining `long-sentence` violation sits on line 3, the exempt `description:` field."
    - "The `description:` field in the YAML frontmatter is byte-identical to its state before this plan."
    - "Every fenced code block is byte-identical to its state before this plan."
    - "Every fact, condition, scope qualifier and hedge in the file survives the rewrite."
  artifacts:
    - src/skills/c64-petcat/SKILL.md
  key_links:
    - "The `entrypoint` / `entrypointReason` contract still states that BOTH fields are present on every `ok: true` response."
    - "The failure section still states that `petcat`'s own exit code is not the success signal, and that the seam's classifier decides success."
    - "The `## The BASIC dialect` section still carries the held-constant sense of the word `fixed`, never the repair sense."
    - "The `## What this skill does NOT do` section still carries all three prohibitions with their scope words intact."
---

<objective>
Apply the ASD-STE100 strict pass to one file: `src/skills/c64-petcat/SKILL.md`.

Purpose: an agent parses this playbook with no human present to resolve an
ambiguous sentence. That is the exact reader ASD-STE100 exists for. The file
carries a measured 9 linter violations. Two of them are permanently exempt.
Seven are addressable.

Output: one rewritten `SKILL.md` with fewer violations and zero semantic
change. No other file changes. No test changes. No new file.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@src/skills/c64-petcat/SKILL.md
@.planning/ste100-batch-rules.md
@.planning/notes/ste100-conformance-of-the-shipped-skills.md
</context>

<scope_fence>
This plan is a prose rewrite of shipped skill documentation. It is NOT a code
change.

**Do NOT do any of the following. Each one is out of scope by instruction, not
by oversight.**

- Do NOT run `npm test`, `npm run test:automated`, `tsc`, or any test file.
- Do NOT write a test file, a fixture, or a snapshot.
- Do NOT invoke the `c64-petcat` skill, run `petcat`, run `node
  src/skills/c64-petcat/scripts/petcat.mjs`, or start an emulator, to see
  whether the skill still works. No round-trip check. No behavioural check.
- Do NOT add a repository CI gate, a ratcheting baseline, or a vendored
  linter. Decision D-3 in
  `.planning/notes/ste100-conformance-of-the-shipped-skills.md` refused a CI
  gate for this work. This bullet is about the repository's own CI. It does
  NOT touch this plan's `<threat_model>` or its `<verify>` blocks, which are
  standard GSD plan machinery and stay.
- Do NOT touch any file other than `src/skills/c64-petcat/SKILL.md`.
- Do NOT add, remove, reorder or rename a heading. Do NOT add, remove or
  reorder a bullet. Do NOT add a new fact, a new caveat or a new example.

The ONE command this plan runs against the skill file is the text linter named
in `<the_one_check>` below. Normal GSD plan machinery stays: the
`<threat_model>` block, the `<verify>` blocks and the SUMMARY are standard and
are not tests of the skill.
</scope_fence>

<the_one_check>
This is the only check this plan runs. Run it read-only, as often as you want.

`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-petcat/SKILL.md`

**Pass bar:** the `count` field decreases strictly from the baseline of 9, with
NO semantic change to any fact, condition, scope qualifier or hedge.

**The linter exits 1 while any violation remains.** Two violations are
permanently exempt (see `<exempt_violations>`), so this file will keep exiting
1 after a perfect pass. EXPECT exit code 1 here. It does NOT mean failure.
Read the `count` field of the JSON. Never treat the exit code as the verdict,
and never "correct" the pipelines in `<verify>` that swallow it on purpose.
</the_one_check>

<measured_baseline>
The planner measured every fact below read-only on 2026-09-15, on `main` at
`ca02a89c`, with `src/skills/c64-petcat/SKILL.md` clean in `git status`.

| # | Fact | How the planner measured it |
|---|------|------------------------------|
| B1 | The linter reports `count` 9, `hard_count` 5, `words` 541, `per_100_words` 1.7. | `ste-lint.py --json` over the file |
| B2 | The file is 4074 bytes, 87 newlines, and ends with one newline. | Python read of the raw bytes |
| B3 | The only non-ASCII character in the file is the em-dash. It occurs 13 times. | Python character census over the decoded text |
| B4 | The file holds no banned-synonym hit for confirm, verify, validate, repair, modify, alter, halt, terminate, fetch, launch, begin, delete, erase or display. | `grep -n -iE` over the file, exit 1 |
| B5 | The file holds no present-perfect construction. | `grep -n -iE '\b(has\|have\|had) [a-z]+ed\b'` over the file, no output |
| B6 | The word `fix` appears twice, on lines 64 and 65, both in the held-constant sense. | `grep -n -iE '\bfix(es\|ed\|ing)?\b'` over the file |
| B7 | The linter reports zero `long-sentence` violations in the body. Both `long-sentence` hits sit on line 3. | The `violations` array of B1 |

B4 and B5 mean this pass has no verb-glossary work and no compound-tense work
to do. The glossary and the compound-tense rule still bind every sentence you
write (see `<binding_rules>`), so a rewrite must not introduce a banned
synonym that is absent today.

**The 9 baseline violations, each addressed by a task below:**

| # | Line | Rule | Match | Owner |
|---|------|------|-------|-------|
| V1 | 3 | long-sentence (37 words) | `description:` frontmatter | EXEMPT — nobody |
| V2 | 3 | long-sentence (31 words) | `description:` frontmatter | EXEMPT — nobody |
| V3 | 17 | semicolon | `;` after `` `--image` is required `` | Task 1 |
| V4 | 73 | semicolon | `;` after `even on garbage input` | Task 1 |
| V5 | 78 | semicolon | `;` after `` `petcat` runs host-side `` | Task 1 |
| V6 | 17 | passive-voice | `is required` | Task 2 |
| V7 | 19 | passive-voice | `are resolved` | Task 2 |
| V8 | 65 | passive-voice | `is fixed` | Task 2 |
| V9 | 71 | passive-voice | `is reported` | Task 2 |

Line numbers are the baseline numbers. They move as you edit. Re-run the
linter to get current numbers rather than trusting this table after Task 1.
</measured_baseline>

<exempt_violations>
V1 and V2 sit on the `description:` field of the YAML frontmatter, line 3.

**Decision D-2 exempts that field permanently.** It is a retrieval index, not
prose. It is deliberately keyword-packed so the skill triggers at all, and a
word cap fights that packing. Do NOT touch it. Do NOT split it. Do NOT
shorten it. It must come out of this plan byte-identical.

The floor for this file is therefore `count` 2, not 0. A report of `count` 2
is a perfect result, not an unfinished one.
</exempt_violations>

<binding_rules>
These rules bind every edit in this plan. This plan restates them in full so
you do not have to open another file to obey them.

1. **Fixed verb glossary.** Use exactly one verb per cluster: **check** (not
   confirm, verify, validate), **correct** (not fix, repair), **change** (not
   modify, alter), **stop** (not halt, terminate), **get** (not fetch),
   **start** (not launch, begin), **remove** (not delete, erase), **show**
   (not display).
2. **Delete every prose semicolon.** A clause join becomes two sentences. A
   semicolon-chained list item takes a full stop.
3. **Split sentences over 20 words in a procedure, over 25 elsewhere.** The
   linter's own splitter is the authority on what counts as one sentence, and
   its cap is 25. It reports zero body hits today (B7), so the 20-word
   procedure cap is the only length work left, and it applies by hand.
4. **Convert passive to active wherever the actor is named.** Leave the
   passive where the object genuinely is the topic of a lookup row, or where
   no actor exists to name.
5. **Keep the compound tense where it carries current relevance.** "the job
   has completed" and "the job completed" are different claims.
6. **Never touch the `description:` field in the YAML frontmatter.** Exempt by
   decision D-2.
7. **Never touch a fenced code block, a tool name, a register name, a binary
   path, a version number, or any verbatim token.**
8. **A table cell is a record.** Apply STE to the sentences inside a cell,
   never to the row. Never split a row. Never merge two rows.
9. **Preserve every fact, condition, scope qualifier and hedge.** "may have
   failed" never becomes "failed". A rewrite that drops "always", "never",
   "only", "at all", "no matter how short it is", or "or otherwise
   unresolvable" has failed, even if the linter count drops.

Use the globally available `asd-ste100` skill for the rewrite itself. It is
the authority on the wording. These nine rules are the authority on scope.
</binding_rules>

<verbatim_tokens>
**SPECIAL HAZARD for this file.** It documents PETSCII/ASCII conversion,
`petcat`'s own flag spellings, and how to read the machine-code handover
address out of a BASIC startup line. Every flag, every numeric address and
every character-encoding token is verbatim and must survive byte-identical.

Never "improve" a PETSCII example, a flag spelling, an address or a JSON
field name — not for clarity, not for consistency, not for length.

**Byte-identical set (non-exhaustive — when in doubt, do not touch it):**

- The whole YAML frontmatter block, lines 1 to 4, including `name:` and
  `description:`.
- Both fenced blocks: the `bash` block holding `S=src/skills/c64-petcat/scripts/petcat.mjs`,
  `node $S decode --image path/to/program.prg` and
  `node $S decode --image game.prg --json`, and the `json` block holding the
  full `petcat.decode` response sample.
- The flag-list line `Options: `--image PATH` `--out-dir DIR` `--json`.` It is
  a token list, not a sentence. Leave it byte-identical.
- Encoding and format tokens: `PETSCII`, `ASCII`, `.prg`, `.bas.txt`.
- Tool and path tokens: `petcat`, `petcat.decode`, `acme-build`,
  `c64-disk-access`, `VICE`.
- Flag tokens: `--image`, `--out-dir`, `--json`, `PATH`, `DIR`.
- Wire and field tokens: `entrypoint`, `entrypointReason`, `results[0].path`,
  `ok: true`, `{"ok":false,"message":"..."}`, `null`, `SYS`, `sys2064`.
- Numeric and version tokens: `2064`, `0`, `C64 BASIC V2.0`, `BASIC line 10`.
- The 13 em-dashes. Keep the em-dash character where it already is. Do not
  swap it for a hyphen and do not introduce a new one.
</verbatim_tokens>

<tasks>

<task type="auto">
  <name>Task 1: Remove the three prose semicolons</name>
  <files>src/skills/c64-petcat/SKILL.md</files>
  <action>
Remove V3, V4 and V5. The note behind this batch calls this edit purely
mechanical with no meaning risk, and it is the single biggest win. Treat it as
mechanical: split the clause join into two sentences and change nothing else
in the sentence.

V3, baseline line 17. The clause is the one that states `--image` is required
and `--out-dir` is optional. Split it at the semicolon into two sentences.
Leave the passive `is required` alone for now — Task 2 owns it. Leave the
`--out-dir` default clause and its stated parallel with `acme-build`'s own
`--out-dir` default intact.

V4, baseline line 73. The clause states that `petcat` itself exits `0` even on
garbage input, and that the seam's own classifier, not the exit code, is what
decides success here. Split it at the semicolon into two sentences. The
contrast is the whole point of the sentence and must survive: the exit code is
NOT the success signal, the seam's classifier is. Keep the word `itself` and
keep the phrase `even on garbage input`.

V5, baseline line 78, inside the `**No direct binary spawn.**` bullet. The
clause states that `petcat` runs host-side, and that this script only ever
constructs a typed request and reads the produced listing file back off the
shared workspace tree. Split it at the semicolon into two sentences. Keep the
scope limiter `only ever`. Keep the closing em-dash clause that names the
host-tool execution seam as the only route.

Add no word beyond the subject a split sentence needs. Do not reorder the
clauses. Do not merge a bullet into its neighbour.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-petcat/SKILL.md | python3 -c 'import json,sys; d=json.load(sys.stdin); s=[x for x in d["violations"] if x["rule"]=="semicolon"]; print("count",d["count"],"semicolons",len(s)); sys.exit(1 if (d["count"] > 6 or s) else 0)'</automated>
  </verify>
  <done>
The linter reports `count` 6 and zero `semicolon` violations. The three
sentences that carried a semicolon now read as six sentences. Those three
sentences keep every fact, every scope limiter and every verbatim token.
  </done>
</task>

<task type="auto">
  <name>Task 2: Convert the four flagged passives, and hold the two that must stay passive</name>
  <files>src/skills/c64-petcat/SKILL.md</files>
  <action>
Address V6, V7, V8 and V9. Rule 4 converts a passive to active only where the
actor is named. Two of these four have a named actor and convert cleanly. Two
carry a hazard. Work them one at a time and re-run the linter after each.

V6, `is required`, in the sentence Task 1 split. The actor is the script. The
script requires `--image`. State it actively. Invariants that must survive:
`--image` is mandatory, `--out-dir` is optional, the `--out-dir` default is
the image's own directory, and the text still calls that default exactly the
same default `acme-build` takes for its own `--out-dir`.

V7, `are resolved`, baseline line 19, the sentence beginning `Both are
resolved`. The actor is the script, and the sentence itself says the
resolution happens before the request ever reaches the seam. State it
actively. This sentence runs 26 words, so split it as well. Four invariants
must survive: `Both` means `--image` and `--out-dir`, the anchor is the
smallest ancestor directory containing both, the resolution happens BEFORE the
request reaches the seam, and it is the SAME resolution `acme-build` and
`c64-disk-access` already go through. Keep the `**workspace-relative**`
emphasis exactly as it is.

V8, `is fixed`, baseline line 65, in the `## The BASIC dialect` section.
HAZARD — the word here means held constant and unchangeable. It does NOT mean
repaired. The glossary entry `correct (not fix, repair)` therefore does NOT
apply to it. Never write `corrected server-side`. Never write `the target is
corrected to C64 BASIC V2.0`. That would invent a false claim. You have two
acceptable moves and both are correct outcomes. Either state the constancy
actively with a verb that carries the held-constant sense, or keep the passive
under rule 4 because no actor is named and the dialect is the topic of the
row. If you keep it, say so in the SUMMARY with that reason. Six invariants
must survive whichever move you take: the choice lives server-side, it is not
a flag on this script, it is not a field on the wire, the target is `C64 BASIC
V2.0`, that target is already project-wide, and `acme-build` takes the same
posture for its own assembler target. Leave the opening fragment `Fixed
server-side` carrying its held-constant sense too.

V9, `is reported`, baseline line 71, in the `## Failure shape` section. The
actor is the seam. State it actively. This sentence runs 37 words with an
em-dash aside, so split it as well. Four invariants must survive: the trigger
is a file `petcat` does not recognise as a BASIC program at all, that trigger
INCLUDES a missing file, the output is the `{"ok":false,"message":"..."}`
envelope with a non-zero exit code, and the negative clause stating it is
never a success envelope carrying an empty or guessed verdict.

Do NOT chase a passive the linter did not flag. Two of them sit in the
`## What this skill does NOT do` bullets and in the `entrypointReason` bullet.
They do not move the count, and converting them risks the scope words
`always`, `never a fallback value` and `never an inline listing scan`. Leave
them, unless a conversion keeps every one of those words.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-petcat/SKILL.md | python3 -c 'import json,sys; d=json.load(sys.stdin); s=[x for x in d["violations"] if x["rule"]=="semicolon"]; print("count",d["count"],"semicolons",len(s)); sys.exit(1 if (d["count"] > 6 or s) else 0)'</automated>
  </verify>
  <done>
The linter reports `count` between 2 and 6 inclusive, and zero `semicolon`
violations. `count` 2 means every convertible passive converted. A `count`
above 2 is acceptable only when each remaining passive is one you deliberately
held under rule 4, with the reason recorded for the SUMMARY. No sentence
claims `petcat`'s dialect target was repaired.
  </done>
</task>

<task type="auto">
  <name>Task 3: Audit the whole diff for token drift and meaning drift</name>
  <files>src/skills/c64-petcat/SKILL.md</files>
  <action>
Read the complete `git diff -- src/skills/c64-petcat/SKILL.md` line by line
and check it against `<verbatim_tokens>` and `<binding_rules>`. This is a read
and repair pass, not a second rewrite pass.

Check each of these and correct any drift you find in the rewritten prose:

- The YAML frontmatter block shows no diff at all. Both `name:` and
  `description:` are untouched.
- Neither fenced block shows a diff. The `bash` block and the `petcat.decode`
  JSON sample are byte-identical.
- The `Options:` flag-list line shows no diff.
- Every token in the `<verbatim_tokens>` byte-identical set still appears with
  the same spelling, the same capitalisation and the same backticks. A
  removed backtick counts as drift.
- No em-dash became a hyphen, and no new em-dash appeared.
- No sentence gained a word from a banned synonym cluster. Baseline fact B4
  says the file had none. It must still have none.
- Every markdown heading, bullet marker, bold span and blank line that existed
  before still exists, in the same order.
- The file still ends with exactly one newline.

Then re-read the rewritten prose against the source and check that these four
claims still read the way they read before. Each one is a claim a downstream
reader acts on:

1. BOTH `entrypoint` and `entrypointReason` are present on EVERY `ok: true`
   response, and `entrypointReason` is ALWAYS a string.
2. A `null` entrypoint is NOT a failure. It is a resolved no. The reason given
   for never guessing an address still reads as the cost paid downstream by a
   disassembler that then has nothing real to work from.
3. `petcat`'s own exit code is not the success signal for the failure shape.
   The seam's classifier decides.
4. All three prohibitions under `## What this skill does NOT do` survive with
   their scope words, including `only ever`, `always`, `never a fallback
   value`, `never an inline listing scan`, `no VICE emulator tool at all` and
   `by construction`.

Correct anything that drifted. Run no other command than the linter.
  </action>
  <verify>
    <automated>python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-petcat/SKILL.md | python3 -c 'import json,sys; d=json.load(sys.stdin); v=d["violations"]; s=[x for x in v if x["rule"]=="semicolon"]; b=[x for x in v if x["rule"]=="long-sentence" and x["line"]!=3]; print("count",d["count"],"semicolons",len(s),"body-long",len(b)); sys.exit(1 if (d["count"] > 6 or s or b) else 0)'</automated>
  </verify>
  <done>
The linter reports a `count` of 6 or lower, zero `semicolon` violations, and
zero `long-sentence` violations outside line 3. The diff touches prose only.
The frontmatter, both fenced blocks and the `Options:` line show no diff. The
four downstream claims listed in the action still read as they read before.
  </done>
</task>

</tasks>

<threat_model>
**Configured posture:** `workflow.security_enforcement` is `true`. OWASP ASVS
level 1. Blocking threshold `high`.

**Change surface.** This plan changes one file:
`src/skills/c64-petcat/SKILL.md`. That file is non-executable markdown
documentation. The plan changes no script, no `package.json`, no lockfile, no
CI workflow, no MCP tool surface and no request path. It runs no package
manager. Nothing in the resulting diff can execute.

**ASVS level 1 applicability.** The ASVS-1 chapters all address executable
behaviour on a request path — authentication, session management, access
control, input validation, cryptography, error handling and logging, data
protection, file handling, and API behaviour. This change surface has no
request path and no executable code. **No ASVS-1 requirement applies to this
change.** That statement is the finding. This plan does not invent a threat to
fill the table.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repository → future agent | The playbook text is instruction input a future Claude session reads and acts on. It is the only boundary this change touches. The text crosses no network, no process and no privilege boundary. |
| (no other boundary) | The plan adds no untrusted input path, no new caller and no new callee. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mmq-01 | Tampering | Prose of `src/skills/c64-petcat/SKILL.md` | low | mitigate | A rewrite that drifts a flag, a path, a numeric address or a JSON field name would make a future agent act on a wrong command. Task 3 audits the whole `git diff` against the byte-identical token set in `<verbatim_tokens>` and corrects any drift. |
| T-mmq-02 | Repudiation | The rewrite's own record | low | mitigate | The SUMMARY records the final linter `count` and one line per remaining violation with its reason, so a later reader can tell a deliberate hold from an unfinished edit. |
| T-mmq-03 | Information disclosure | Same file | low | accept | The file holds no credential, no token and no host path outside the repository. The rewrite adds no new fact, so it can disclose nothing the file did not already state. |
| T-mmq-04 | Elevation of privilege | Build and runtime | low | accept | Markdown is non-executable. The diff reaches no code path, no build step and no CI job. |
| T-mmq-SC | Tampering | npm/pip/cargo installs | low | accept | Not applicable, by measurement: this plan has no package-manager install task. No dependency is added, removed or upgraded, so the package-legitimacy gate has nothing to gate. |

No threat reaches the `high` blocking threshold. Nothing here blocks
execution.
</threat_model>

<verification>
Run the one permitted check a final time and read the whole report:

`python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json src/skills/c64-petcat/SKILL.md`

Read `count`. It started at 9. It must end below 9. The floor is 2, which is
V1 and V2 on the exempt `description:` field.

Every violation still in the report must be one of two kinds:
1. A `long-sentence` hit on line 3. Exempt by decision D-2.
2. A `passive-voice` hit you deliberately held under binding rule 4, with the
   reason written into the SUMMARY.

Any other remaining violation is unfinished work.

The linter exits 1 while V1 and V2 remain. That exit code is expected. It is
not a failure.
</verification>

<success_criteria>
- `src/skills/c64-petcat/SKILL.md` is the only file this plan changed.
- The linter `count` is strictly below the baseline of 9.
- The linter reports zero `semicolon` violations.
- Every remaining `long-sentence` violation sits on line 3.
- The YAML frontmatter, both fenced code blocks and the `Options:` flag line
  are byte-identical to their state before this plan.
- Every fact, condition, scope qualifier and hedge in the file survives.
- No test ran. No gate was added. No other file changed.
</success_criteria>

<output>
Create `.planning/quick/260915-mmq-c64-petcat-skill-apply-the-ste100-strict-pass-following-ever/260915-mmq-SUMMARY.md` when done.

The SUMMARY must record the final linter `count`, and one line per violation
that remains, naming why it remains.
</output>
