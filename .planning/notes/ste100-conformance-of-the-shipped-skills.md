---
title: ASD-STE100 conformance of the nine shipped skills — one house style, two mechanical habits
date: 2026-09-15
context: /gsd-explore "use /asd-ste100 to investigate the skills in src/skills; tell me how they shall be changed to follow the standard"
confidence: MEASURED 2026-09-15 (ste-lint.py over every .md under src/skills/**, fenced code excluded by the linter)
---

# Question put

Do the nine reverse-engineering `SKILL.md` playbooks and their `references/` and
`templates/` files follow ASD-STE100? If not, what has to change?

The question is not cosmetic. These files are parsed by an agent with no human present
to resolve an ambiguous sentence, which is the exact reader ASD-STE100 exists for.

# What was measured

`ste-lint.py` (from the host-global `asd-ste100` skill, stdlib-only Python, skips fenced
code blocks) over every markdown file under `src/skills/`.

| Surface | Files | Words | Violations | Hard |
|---|---|---|---|---|
| `SKILL.md` | 9 | 25,684 | 424 | 234 |
| `references/` + `templates/` | 9 | 8,414 | 116 | 60 |
| **Total** | **18** | **34,098** | **540** | **294** |

Per-100-word rate by skill: `c64-disk-access` 2.5, `c64-program-recon` 1.8, `c64-petcat`
1.7, `c64-provenance-diff` 1.7, `vice-wedge-triage` 1.7, `acme-build` 1.6,
`routine-queue-walker` 1.6, `c64-memory-mapping` 1.5, `c64-ram-capture` 1.4.

**The finding is the uniformity, not the total.** A 1.4-to-2.5 spread across nine
independently written playbooks is one house style applied consistently. It is not nine
files of differing quality, so the remedy is a style rule, not a rewrite.

## Violations by rule (`SKILL.md` only)

| Rule | Count | Where it lives |
|---|---|---|
| `semicolon` (hard) | 168 | 111 prose, 40 table cells, 17 list items |
| `passive-voice` (advisory) | 180 | 139 prose, 24 list, 15 table, 2 headings |
| `synonym-rotation` (hard) | 34 | 18 distinct pairs, collapsing to 8 verb clusters |
| `long-sentence` (hard) | 32 | **16 in the `description:` frontmatter**, 16 in the body |
| `present-perfect` (advisory) | 10 | several carry current relevance and must stay |

Sixteen over-long sentences in 25,684 words of body prose is genuinely good. The volume
comes from two mechanical habits: the prose semicolon and the agentless passive.

## Four surfaces, not one

The linter reports a 72-word "sentence" at `src/skills/vice-wedge-triage/SKILL.md:235`.
It is an evidence-ledger table row, not a sentence. Splitting the row would destroy the
record. That single case shows the shape of the whole problem — four surfaces sit in
these files and they are not the same kind of text:

1. **Imperative procedure** — the numbered `## The order` steps, Do/Don't prose, the
   "Do" column of verdict tables. STE's target case exactly.
2. **Explanatory prose** — the rationale paragraphs that say why a rule exists.
3. **Evidence and provenance tables** — measurements and records, not instructions.
4. **`description:` frontmatter** — a retrieval index that decides whether the skill
   triggers at all.

## The 8 verb clusters that rotate

Measured across all 18 files (46 hits, 18 distinct pairs):

| Cluster | Hits |
|---|---|
| check / confirm / verify / validate | 14 |
| fix / correct / repair | 11 |
| change / modify / alter | 5 |
| halt / stop / terminate | 4 |
| fetch / get | 3 |
| launch / start / begin | 3 |
| delete / remove / erase | 3 |
| display / show | 2 |

# Decisions taken

**D-1: a full strict pass over surfaces 1, 2 and 3.** Imperative procedure, explanatory
prose, and the evidence tables all get strict STE, including the `references/` and
`templates/` files. Roughly 540 edits.

*Stated risk, accepted by the owner after it was raised:* surface 3 is the dense
evidence prose, where a strict pass can flatten a record into something shorter and
less exact. The operative rule when the pass runs: **a table cell is a record, and STE
applies to the sentences inside the cell — never to the row.** Split a multi-clause
cell, remove its semicolons, keep every measurement, every binary path, every verbatim
token, and never split or merge a row.

**D-2: `description:` frontmatter is exempt.** It is a retrieval index, not prose. It is
deliberately keyword-packed so the skill triggers, and a word cap fights that packing.
This permanently leaves 16 hard `long-sentence` violations on the books, recorded here
so a later reader does not treat them as an oversight. The exemption is the decision.

**D-3: no CI gate.** A one-off cleanup pass, with the style rule written down. No
ratcheting baseline test, no vendored linter. The rate will drift back over time and
that is accepted.

# What the changes are

1. **Delete every prose semicolon (168 in `SKILL.md`, 41 in references).** Purely
   mechanical, no meaning risk, the single biggest win. Two shapes appear:
   a clause join (`src/skills/acme-build/SKILL.md:28`) becomes two sentences; a
   semicolon-chained numbered list (`src/skills/c64-disk-access/SKILL.md:112-114`) takes
   a full stop per item instead.
2. **Split the 16 over-long body sentences.** 20 words in a procedure, 25 in a
   description. The frontmatter is out of scope per D-2.
3. **Pick one verb per cluster** from the table above and apply it everywhere.
4. **Convert passive to active wherever the actor is named** — `is refused` (16),
   `is written` (7), `is reported` (7). Leave the passive where the object genuinely is
   the topic of a lookup row.
5. **Leave most present-perfect alone.** The `asd-ste100` skill documents this exception
   itself: "the job has completed" and "the job completed" are different claims, and
   status text needs the first. Ten hits, decided case by case.

# Related

- `.planning/notes/skill-redundancy-audit.md` answered a different question over the same
  nine files — whether any skill or instruction is redundant. This note is about form,
  that one is about substance. Neither supersedes the other.
