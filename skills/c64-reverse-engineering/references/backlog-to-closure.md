# Working the backlog to closure

**Do not start to annotate whatever is in front of you.** The expensive failure here is not slow
work. It is a pass that *looks* finished while a hundred `p_XXXX` labels are still nameless, and
nobody wrote down which ones. Build the queue first, from data. Then walk it to the end.

This procedure answers *what is still undocumented in this program, and how do I finish*. It
assumes that you already know what the program is: its entry point, its live vector and its
regions. If you do not, work through "The order" in `SKILL.md` first. Every read and write here
goes through the `c64-annotations` skill.

## The one rule: one entry at a time

**Work the queue one entry at a time.** This is not a compromise on throughput. It is an accurate
model of the annotation project. The project has one writer at a time. Every write commits inside
its call, and a write can carry a revision check that refuses it when the project has moved past
that revision. So several writers on one project gain **zero** throughput and cost correctness.
The losers come back as stale-revision refusals, and you must derive and replay each one again.

Reading in parallel is fine. Several agents can *think* over answers they already have. The value
of that is reasoning bandwidth, never I/O.

## Before the queues

1. **Context.** Read the binary info. Keep `origin`, `size`, `system`, `filename`, `description`
   and `may_contain_undocumented_opcodes`. Every later step quotes them.
2. **Packed?** Do not annotate a packed image. You would document a decruncher, and every label is
   lost when you recover the real image. Check with `c64-unpacker`, and come back with the
   depacked image.
3. **Classified?** A routine candidate means something only when you know that the bytes around it
   are code. Do the classification pass ("Classifying every region" in `SKILL.md`) yourself, in one
   sitting. It is one long walk over the whole binary, not a queue of independent items.
4. **Measure the starting point.** Run the coverage measurement once now (see "Measure the pass").

## The routine queue

### Build the candidate list

A routine is **already documented** when its entry address has a line comment. That is the only
test. Do not guess from the label name.

1. List every label: user, system and external. Ask for more results than the program has labels.
   Keep the answer, because the symbol queue uses it again.
2. List every comment, again with a result ceiling above the count. Keep that too.
3. **Candidate source A: cross-references and code blocks. Check it FIRST, whatever the label list
   returned.** For every code-typed range, disassemble it and collect every `jsr` target address.
   Check that each target is a real routine. Get its full caller list, which also fills in "called
   from" when you write up the entry. Every one of these targets is a candidate, **whether or not
   it has a label.** A real derivation run (dxa disassembly, then a Ghidra import) found this. A
   project derived only by dxa and Ghidra has ZERO labels of any shape. Derivation writes typed
   ranges and cross-references, never names. A queue built only from source B finds nothing on
   such a project. It silently reports a clean, empty queue on a program that nobody named yet.
4. **Candidate source B: label prefixes, for a project that DOES have imported auto-names.** Keep a
   label as a candidate when any of these is true:
   - Its name starts with `s_` (an auto-generated subroutine label).
   - It is in a code region and at least one `JSR` cross-reference targets it.
   - It is a `p_XXXX` label **inside a code region**. These come from split lo/hi immediate loads
     and from address tables. They are almost always chained raster-IRQ handlers, hardware- or
     shadow-vector handlers, or jump-table and callback targets. Treat every one of them as a
     candidate. Do not pattern-match specific vector addresses.
   - It is the label named exactly `start`.
5. **Union sources A and B by address.** A routine that both sources reach counts once. A project
   can have either shape, or both, so neither source alone is sufficient.
6. Remove every candidate that already has a line comment.
7. What remains is the routine queue.
8. **Put `start` first** when it is in the queue. The entry point sets the context for every other
   routine.

### Walk it

Take **one** entry at a time, to completion, before you start the next. For each entry, run
"Documenting one routine, end to end" in `SKILL.md`, steps 1-7, at the entry's explicit address.
Its rules for bounds, tail calls, fall-through and long routines apply unchanged. Do not
paraphrase them here.

For the report, record per entry: the address, the old label, the new label, a one-line summary,
and any uncertainty.

### Refresh point

When the queue is empty, record the project revision. It is the checkpoint that you measure this
pass from. Run the coverage measurement again. Everything after this point reads the project
again, because the routine queue changed the label names that the symbol queue filters on.

## The symbol queue

### Build the candidate list

A symbol is **already documented** when it has a name that a human chose. A well-known system
address (hardware register, KERNAL entry point, OS variable) is also documented.

1. List the labels **again**. The routine queue renamed things.
2. **Candidate source A: cross-references and typed ranges. Check it FIRST, whatever labels
   exist.** Find every address that one half of a split lo/hi pair references. Find every address
   that an address table references (a lo/hi or hi/lo *address* table. The *word* forms produce no
   cross-references). Include every address that a code range references but that is not inside a
   code range. Every one of these is a candidate, **whether or not it has a label.** For the same
   reason as the routine queue, source B alone finds nothing on a project that nobody named yet.
3. **Candidate source B: label prefixes, for a project that DOES have imported auto-names.** Keep
   every label that still matches an auto-generated pattern. In the zero page, that is `zpp_XX`,
   `zpf_XX` or `zpa_XX`. Outside the zero page, that is `p_XXXX`, `f_XXXX`, `a_XXXX` or `e_XXXX`.
4. Exclude from BOTH sources:
   - `s_XXXX` (the routine queue handled those).
   - `b_XXXX` (branch targets, not data symbols).
   - Any `p_XXXX`-shaped or cross-reference-derived candidate inside a code region (also the
     routine queue's).
5. **Union sources A and B by address.** A symbol that both sources reach counts once.
6. What remains is the symbol queue.

### Walk it

Use the same discipline: an explicit address, one entry at a time, to completion. For each symbol,
run "Naming a symbol" in `SKILL.md`. A symbol's meaning is what its users do with it. Classify it
plainly: flag, counter, pointer, state variable, buffer, table.

**Do not stop early.** The symbol queue is routinely far larger than the routine queue. Fifty or a
hundred entries is normal. Do not truncate it. Do not skip "secondary" symbols. Do not stop because
it is long. The job is to feed the whole queue through. If you stop early and label the remainder
"skipped for review", the pass failed. The only exception is a remainder that you report
explicitly, in full, in the leftovers section of the report.

### Refresh point

Record the project revision again.

## The report

Record the project revision one last time and quote it in the report. It makes the pass
attributable to an exact project state. The report has four sections, and each one is mandatory.

**Regions.** How many regions you classified, grouped by kind, and anything notable: text at a
constant address, a jump table, a sprite block.

**Routines.**

| Address | Old label | New label | What it does |
| ------- | --------- | --------- | ------------ |
| `$C000` | `s_C000`  | `init_screen` | Clears screen RAM, sets the border colour |

**Symbols.**

| Address | Old label | New label | Classification |
| ------- | --------- | --------- | -------------- |
| `$02`   | `zpp_02`  | `zp_ptr_screen` | Zero-page indirect pointer |

**Leftovers: uncertain, skipped, or still unannotated.** This section is not optional. It must not
be empty when the queues were not emptied. List every routine and every symbol that you left
undone, with its address and the reason. Never report "no uncertain areas" or "nothing left" while
a single `f_XXXX` or `a_XXXX` label still has its auto-name, or a queued routine still has no
comment. List those by name, for a human to pick up.

## Measure the pass

A report that says "all routines documented" is a claim about the report, not about the program.
Measure it. `c64-annotations` runs the coverage measurement and the decomposition-completeness
gate. Run the coverage measurement three times: before the routine queue, at the routine queue's
refresh point, and at the end. The last run goes in the report.

**Read the three measures against each other. Never quote one alone.** There is no single "percent
documented" figure, because one combined number lets a weak measure hide behind a strong one.

- **A high user-label fraction next to a large unreached count means that you named the wrong
  things.** Every label has a human name, but no seed reached most of the image. You worked the
  visible part of the program, and nobody entered the rest. Go back and find more entry points
  (chained IRQ vectors, dispatch tables), not more labels.
- **A large divergence means that the project and the bytes disagree about what is code.** Bytes
  that the census reached as instructions, but that the project does not call code, are places
  where the classification is behind the real control flow. The reverse direction (the project
  calls it code, the census never reached it) is ordinary on an image with unreachable filler.
  Read it. Do not chase it.
- **A low distinct-comment ratio means that the comments are filler.** Fifty addresses with the
  same sentence count once, not fifty times. This measure catches a pass that renamed everything
  and explained nothing.

Put every address that the per-measure findings name in the leftovers section.

**The stop condition is a measured exit code, not a belief.** The walk ends for a program
when the completeness gate **exits 0**. It never ends because you believe that the queue is
empty. A non-zero exit names, by address, the measure that still fails:

- an Undefined byte → go back to classification.
- a surviving auto-name → go back to the queue that owns it.
- an entry point with no name, or with an incomplete purpose comment → go back to the routine
  queue.
- an unresolved referenced address → go back to the symbol queue.
- an unresolved disagreement between the block types and the runtime evidence → resolve it.

Close it, then run the gate again. Read the process exit code, not only the rendered text.

## When something fails

- A failed call is not a reason to drop a queue entry. Log the address, the call and the error.
  Put the entry back on the queue and continue with the next one. Report each of these in the
  leftovers section.
- A refused write is not silent, and you must not treat it as silent. These come back refused and
  named, with nothing written:
  - a stale-revision refusal (a revision that the project has moved past).
  - an illegal label name.
  - a scope that overlaps an existing one.

  Read again, derive again, and replay that one entry. Never widen the range or drop the revision
  check to make the refusal go away.
- Never invent an answer to make a queue entry go away. In the leftovers section, an honest "this
  looks like a table, callers unclear" is better than a confident wrong label. The next reader
  would have to un-learn that label.
- **A target that you cannot resolve gets a `DECLINED:` comment, never an invented name.** When
  the target of a referenced address depends on the path, or you cannot find it for another
  reason, write a comment that starts with the literal prefix `DECLINED:`. Name what is unknown
  and why. The importer already uses this same convention for bank-state declines. A confident
  wrong label is worse than no label.
- **An accepted disagreement gets a `DISAGREEMENT-ACCEPTED:` comment.** The completeness gate flags
  a byte that the block types call data but that the runtime evidence shows as executed. When a
  review finds the runtime evidence correct, or accepts the disagreement as a fact rather than a
  classification bug, write a comment that starts with the literal prefix
  `DISAGREEMENT-ACCEPTED:` and says why. The gate reads it as the resolution for that address.
