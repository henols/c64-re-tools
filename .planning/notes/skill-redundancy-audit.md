---
title: Skill redundancy audit — the arbitration exists, but only one side honours it
date: 2026-09-11
context: /gsd-explore "are skills or skill instructions redundant; do all skills bring real value"
confidence: MEASURED 2026-09-11 (line counts, duplicate-line census, hazard-coverage greps over src/skills/**)
---

# Question put

Are any of the nine shipped skills, or any of their instructions, redundant enough to remove?
Does each bring real value to reverse-engineering work?

# Headline: textual redundancy is near zero; the defect is a LOSSY COPY

**12 duplicated lines across 11,040 shipped skill lines** (SKILL.md + references/, lines >= 60
chars, appearing in 2+ skills). The "delegate rather than restate" discipline is working at the
sentence level. Nothing here argues for deleting a skill.

The real defect is one skill carrying a paraphrase of another's procedure that has **silently
dropped that procedure's hazards**. See "The lossy copy" below. That is worse than duplication,
because a dedupe check cannot see it and the two versions do not obviously conflict — one is
simply missing things.

# Surface, measured

    skill                  SKILL.md   references          scripts
    acme-build                 257    0                     340 (1)
    c64-disk-access            156    0                     900 (1)
    c64-memory-mapping         623    0                     553 (1)
    c64-petcat                  87    0                     345 (1)
    c64-program-recon          699    675 (6 files)        1378 (2)
    c64-provenance-diff        292    0                    2064 (2)
    c64-ram-capture            423    0                    3719 (8)
    routine-queue-walker       366    0                    1023 (1)
    vice-wedge-triage          289    0                       0 (0)

Cross-skill delegation is dense and healthy: `c64-program-recon` names all eight others; every
skill names at least one other. This is not a set of isolated pages.

# The declared arbitration

`c64-program-recon` SKILL.md:414-419 states a three-way contract in so many words:

> **Scope, so three skills do not fight over the same job.** This procedure handles **one
> routine, at one explicit address**. Building the backlog of every undocumented routine in a
> project and draining it to closure is `routine-queue-walker`'s job — **it calls into this
> procedure once per queue entry**. Classifying the *regions* around the routine, and naming the
> data symbols it touches, is the absorbed pair in `c64-memory-mapping`.

So a first reading of "three skills each carry a document-one-unit procedure" as triplication is
WRONG, and this note corrects it. The split is deliberate:

    c64-program-recon      ONE routine at ONE explicit address (the procedure itself)
    routine-queue-walker   the BACKLOG — calls into that procedure per entry
    c64-memory-mapping     the REGIONS around it, and the DATA SYMBOLS it touches

**`c64-memory-mapping` honours it.** SKILL.md:448-449 delegates the comment-block format back:
*"follow the absorbed routine procedure in `src/skills/c64-program-recon/SKILL.md`."* Its
§474-612 "What a symbol in the store actually represents" covers data symbols, which the contract
assigns to it. Not duplication — its half of the split.

# The lossy copy

**`routine-queue-walker` does not honour the contract.** `c64-program-recon` asserts it "calls
into this procedure once per queue entry"; it never does. Its only two references to that skill
are orientation (SKILL.md:16, run recon first) and packer-finding (:53). Neither is the per-entry
delegation. §2.2 "Walk it" instead carries a compressed paraphrase.

Hazard coverage, MEASURED as case-insensitive ERE hit counts per SKILL.md:

    hazard                          recon   memmap   routine-queue-walker
    4096-byte anno_read_region cap      5        5        0
    tail call / falls through           4        0        0
    view omitted (the default)          1        0        0
    RTS/RTI bounds                     12        8        7
    cross-references step               4        4        5
    anno_get_binary_info context        3        2        2

Two concrete failures for an agent driving a backlog from `routine-queue-walker` alone:

1. **The cap.** §2.2 says to "read the routine's bytes with `anno_read_region` over the explicit
   range" and never mentions that the combined byte count is capped at 4096 and a request above
   it is REFUSED BY NAME rather than truncated. `c64-program-recon` §3 additionally says to read
   a longer routine as consecutive ranges and warns not to raise the cap. The queue walker has
   none of it, and long routines (decrunchers, level builders) are exactly what a backlog
   contains.
2. **The bounds.** §2.2 says "always work from an explicit address" but never says how to find
   the END. The two hard shapes — a `JMP shared_epilogue` tail call still ENDS the routine, and a
   routine with no return may FALL THROUGH into the next — appear ONLY in `c64-program-recon`.
   A queue walker will mis-bound precisely the routines whose bounds are hard.

**This is the argument against self-containment.** The self-contained copy decayed: it kept the
shape and lost the hazards, and nothing detects that. Fixing it is small — make §2.2/§3.2
delegate, as the contract already claims they do. Captured as
`.planning/todos/pending/routine-queue-walker-restates-instead-of-delegating.md`.

# Checked and found NOT redundant

- **`c64-petcat` vs `c64-program-recon`'s BASIC token tables.** Looks like a contradiction —
  recon §573 says "detokenize with c64-petcat, don't hand-decode it" and then supplies line
  anatomy and a BASIC V2 keyword table. It was already audited and deliberately narrowed to
  *"what `c64-petcat` does NOT do — write the tokenized bytes' typed ranges and comments into
  this project's annotation store"*, with a correction note attached about an earlier wrong
  claim. Resolved, not accidental. (It does admit most sessions never reach that section, so it
  is a size question, not a correctness one.)
- **`vice-wedge-triage` vs `vice_diagnose`.** The tool's own response text already carries
  guidance (`stock-diagnose.ts:280` "This is a self-inflicted stop, not a wedge"; `:524`
  "Recycling on this answer alone is wrong"). But the skill adds what the tool does not: the
  `-jamaction` mapping, where a JAMmed machine wants `vice_machine_reset` and NOT
  `vice_recycle`, and `evidence.jamObserved` cutting across two verdicts in opposite directions.
  Not a restatement. Keep.

# On "does every skill bring real value" — what I could NOT measure

Mentions in `.planning/STATE.md` / `RETROSPECTIVE.md` / `docs/` were counted and are reported
here only to be dismissed: `vice-wedge-triage` scores 0/0/3 and `c64-ram-capture` 8/0/4. **This
is not a usage signal.** Those files record planning history, so a skill built early and left
stable scores low for a good reason, and a skill that caused trouble scores high. No skill should
be cut on it. Answering the value question properly needs session evidence this repository does
not hold.

# The separable finding

`c64-memory-mapping`'s SKILL.md is 623 lines covering three jobs — published-address lookup
(§24-226), region classification (§227-473), per-symbol documentation (§474-612) — under a
frontmatter description promising essentially the first. That is a trigger-surface mis-scope and
survives whatever is decided about the delegation defect. Captured as
`.planning/todos/pending/c64-memory-mapping-is-three-skills.md`.

Related: [[fork-removal-reversal-basis]] — `c64-program-recon` (13 fork references) and
`vice-wedge-triage` (12) must be rewritten for Phase 52 regardless, which is the cheapest moment
to land skill fixes.
