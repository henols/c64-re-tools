---
name: routine-queue-walker
description: Drive an existing regenerator2000 annotation project's backlog of undocumented routines and auto-named symbols to closure — build the candidate queue from labels and comments, work it one entry at a time against explicit addresses, rebuild it after every pass, and report every leftover. Use when asked to annotate every remaining routine in a project, document all undocumented subroutines left in an annotation project, rename the leftover auto-generated labels, clear a backlog of unnamed symbols, drive an annotation pass to completion, or list what is still unannotated after a pass.
---

<!--
ATTRIBUTION (ABS-02)
Adapted from regenerator2000.
  Source repository: https://github.com/ricardoquesada/regenerator2000
  Source path:       r2000-analyze-program/SKILL.md — held under the upstream
                     repository's excluded agent-skills directory, which the
                     published crate does not ship. The full upstream path is
                     recorded once, in
                     .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json
  Pinned commit:     493f840418f1450a342bb220c2fe3d2585dd0525  (v0.9.20, 2026-07-11)
  Source sha256:     2d1c91bcc612c00ce71b7def08917b59ca7e495aa61f9075cbb0795e935f6955
  Upstream licence:  MIT OR Apache-2.0 — Copyright (c) 2026 Ricardo Quesada
  This project elects: MIT

  ADAPTED, NOT VERBATIM. Named deviations, each one a real change to what the
  upstream text instructs:
    - Upstream prescribes a parallel subagent fan-out with a fixed slot count
      and a refill-on-completion window. That is NOT carried. This project
      walks the queue one entry at a time (Phase 18 criterion 4: the session
      seam is a coarse FIFO mutex), because the child process was measured to
      read its stdin serially and process exactly one request at a time — see
      .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-STDIO-MULTIPLEXING-EVIDENCE.md
    - Upstream's three instructions to read a file inside its own excluded
      agent-skills directory at runtime are replaced with this project's own
      skill names and paths. Those upstream files do not exist for anyone who
      installed regenerator2000 from the crate.
    - Upstream's cursor-based entry route is replaced by explicit address
      input plus `r2000_read_region`. Upstream's own text already forbids the
      cursor route in this situation; this project has no editor cursor at all.
    - Upstream's `set_immediate_format` step is omitted — this project does not
      expose it. Upstream's `unpack_binary` step is omitted as destructive and
      re-routed to this project's own run-and-capture route. The per-call
      disposition record, with justifications, is in the manifest named above.

  Re-sync trigger: see ABS-04's dated decision and the manifest's
  `resync_triggers`.
  See THIRD-PARTY-NOTICES.md.
-->

# Walking the routine and symbol queue to closure

**Do not start annotating whatever is in front of you.** The expensive failure
here is not slow work — it is a pass that *looks* finished while a hundred
`p_XXXX` labels are still nameless and nobody wrote down which ones. Build the
queue first, from data, then walk it to the end.

This playbook assumes block classification has already happened and an
annotation project already exists. If you do not yet know what the program is —
where it starts, which vector is live, which regions are code — stop and run
`c64-program-recon` first. That skill answers *what is this program*; this one
answers *what is still undocumented in it, and how do I finish*.

## The one rule that makes this different from upstream's version

**Work the queue one entry at a time.** Not as a throughput compromise — as an
accurate model of the machine underneath. The regenerator2000 child reads its
standard input serially and handles exactly one request at a time; this was
measured, not assumed (`19-STDIO-MULTIPLEXING-EVIDENCE.md`). Fanning several
writers at the session buys **zero** extra throughput: they re-serialise inside
the child a moment later, and the only thing gained is a harder-to-read
failure. Reading fan-out — several agents *thinking* over already-fetched
answers — is fine, and its value is reasoning bandwidth, never I/O.

## Phase 0 — context, and the packed-binary gate

1. Call `r2000_get_binary_info`. Keep `origin`, `size`, `system`, `filename`,
   `description` and `may_contain_undocumented_opcodes` — every later step
   quotes them.
2. Read the returned `entropy` against the threshold of **7.5** carried in that
   tool's own description. At or above it, the bytes are very likely packed.
3. If the binary looks packed, **stop and say so.** Do not annotate a packed
   image: you would be documenting a decruncher, and every label you write is
   thrown away the moment the real image is recovered. This project's route to
   an unpacked image is `c64-ram-capture` — run the program in the emulator and
   capture RAM at a checkpoint past the decrunch — plus the packer-identity
   finding in `c64-program-recon`, which names the packer when an oracle can.
   Come back with the captured image and start again at Phase 0.

Upstream's in-place `unpack_binary` step is deliberately not carried: it is
destructive (it clears the comments, labels and blocks already in the project)
and this project has a non-destructive route to the same answer.

## Phase 1 — make sure blocks are classified

Region classification is a prerequisite for everything below: a routine
candidate is only meaningful once the bytes around it are known to be code.

1. Follow `src/skills/c64-memory-mapping/SKILL.md` for the classification pass
   and for what each region type means.
2. Do that pass yourself, in one sitting. It is a single long walk over the
   whole binary, not a queue of independent items.

## Phase 2 — the routine queue

### 2.1 Build the candidate list

A routine counts as **already documented** when its entry address carries a
line comment. That is the only test; do not guess from the label name.

1. Call `r2000_get_symbols` for all labels — user, system and external. Keep
   the answer; Phase 3 reuses it.
2. Call `r2000_get_comments`. Keep that too.
3. Keep a label as a routine candidate when any of these holds:
   - its name starts with `s_` (an auto-generated subroutine label);
   - it sits in a code region and is the target of at least one `JSR`
     cross-reference (`r2000_get_cross_references`);
   - it is a `p_XXXX` label sitting **inside a code region**. These come from
     split lo/hi immediate loads and from address tables, and they are almost
     always chained raster-IRQ handlers, hardware- or shadow-vector handlers,
     or jump-table and callback targets. Treat every one of them as a
     candidate rather than pattern-matching specific vector addresses;
   - it is the label named exactly `start`.
4. Drop every candidate that already carries a line comment.
5. What is left is the routine queue.
6. **Order it with `start` first** when `start` is in it. The entry point sets
   the context every other routine is read against.

### 2.2 Walk it

- **Always work from an explicit address** — `$XXXX`, or the decimal
  equivalent. Never from "wherever we are"; there is no editor cursor in this
  project's route, and upstream's own text forbids relying on one anyway. Read
  the routine's bytes with `r2000_read_region` over the explicit range.
- Take **one** entry at a time, to completion, before starting the next.
- For each entry, do the full job: rename the label (`r2000_set_label_name`),
  add a header line comment describing what the routine does and what it
  leaves in the registers and memory, add side comments on the instructions
  that carry the meaning (`r2000_set_comment`), and record anything you are
  unsure about rather than smoothing it over.
- Record per entry: the address, the old label, the new label, a one-line
  summary, and any uncertainty. That record is the report in Phase 4.

### 2.3 Refresh point

When the queue is empty, call `r2000_save_project`. Everything after this point
re-reads the store, because Phase 2 has just changed the label names Phase 3
filters on.

## Phase 3 — the symbol queue

### 3.1 Build the candidate list

A symbol counts as **already documented** when it has a name a human chose, or
when it is a well-known system address (hardware register, KERNAL entry point,
OS variable).

1. Call `r2000_get_symbols` **again** — Phase 2 renamed things.
2. Keep every label whose name still matches an auto-generated pattern:
   `zpp_XX`, `zpf_XX`, `zpa_XX` in the zero page; `p_XXXX`, `f_XXXX`, `a_XXXX`
   and `e_XXXX` outside it.
3. Exclude: `s_XXXX` (Phase 2 handled those), `b_XXXX` (branch targets, not
   data symbols), and any `p_XXXX` inside a code region (also Phase 2's).
4. What is left is the symbol queue.

### 3.2 Walk it

Same discipline as Phase 2: explicit address, one entry at a time, to
completion. For each symbol, use `r2000_get_cross_references` to find who
touches it — a symbol's meaning is what its callers do with it — then rename it
and comment it. Classify it plainly: flag, counter, pointer, state variable,
buffer, table.

**No premature halting.** The symbol queue is routinely far larger than the
routine queue — fifty, a hundred entries is normal. Do not truncate it, do not
skip "secondary" symbols, and do not stop early because it is long. Feeding the
whole queue through is the job. Stopping early and labelling the remainder
"skipped for review" is a failed pass, not a completed one — unless the
remainder is reported explicitly, in full, under Phase 4's leftovers table.

For naming conventions and for what any given hardware or KERNAL address
means, follow `src/skills/c64-memory-mapping/SKILL.md` rather than guessing.

### 3.3 Refresh point

Call `r2000_save_project`.

## Phase 4 — save and report

1. Call `r2000_save_project` one last time.
2. Write the report. Four sections, all of them required:

**Regions.** How many regions are classified, grouped by type, plus anything
notable — text at a fixed address, a jump table, a sprite block.

**Routines.**

| Address | Old label | New label | What it does |
| ------- | --------- | --------- | ------------ |
| `$C000` | `s_C000`  | `init_screen` | Clears screen RAM, sets the border colour |

**Symbols.**

| Address | Old label | New label | Classification |
| ------- | --------- | --------- | -------------- |
| `$02`   | `zpp_02`  | `ptr_screen` | Zero-page indirect pointer |

**Leftovers — uncertain, skipped, or still unannotated.** This section is not
optional and it is not allowed to be empty when the queues were not emptied.
List every routine and every symbol that was left undone, with its address and
the reason. Never report "no uncertain areas" or "nothing left" while a single
`f_XXXX` or `a_XXXX` label is still auto-named or a queued routine is still
uncommented — those must be listed by name for a human to pick up.

## Phase 5 — measure the pass instead of asserting it finished

A report that says "all routines documented" is a claim about the report, not
about the program. Measure it. From the repository root:

```
node src/mcp/vice/vice-proxy.ts r2000 coverage <project>.regen2000proj
```

Add `--out coverage.json` to keep the machine-readable report, `--force` to
overwrite one, and `--sample N` to widen the reproducibility sample. The verb
reads the store through the same session everything else in this playbook uses
and exits **0 even when the numbers are bad** — a low measurement is a result,
not a failure. Non-zero means it could not read the project at all.

**Run it three times:** once before Phase 2, so the pass has a starting point
to be compared against; once at Phase 2.3's refresh point; and once at the end,
after Phase 4's final save. The last run is what goes in the report.

**Read the three numbers against each other. Never quote one of them alone.**
There is deliberately no single "percent documented" figure, because one
combined number lets a weak measure hide behind a strong one and makes the
claim unfalsifiable:

- **A high user fraction beside a large unreached count means the wrong things
  were named.** Every label got a human name, but most of the image was never
  reached by the descent walk from any seed — the queue was worked over the
  easily-visible part of the program and the rest was never entered. Go back to
  Phase 0 and find more entry points (chained IRQ vectors, dispatch tables),
  not more labels.
- **A large divergence means the store and the bytes disagree about what is
  code.** Bytes the census reached as instructions that the store does not call
  `Code` are places where Phase 1's classification is behind the actual control
  flow. The reverse direction (the store calls it `Code`, the census never
  reached it) is ordinary on an image with unreachable filler — read it, do not
  chase it.
- **A low distinct-comment ratio means the comments are filler.** Fifty
  addresses carrying the same sentence counts once, not fifty times. That is
  the number that catches a pass which renamed everything and explained
  nothing.

Anything the per-measure findings list names belongs in Phase 4's leftovers
table, by address. A finding is a named defect in one named measure — it is
never a rating, and there is no number to report as "the coverage".

## When something fails

- A failed call is not a reason to drop a queue entry. Log the address, the
  call and the error, put the entry back on the queue, and carry on with the
  next one. Report every one of those in the leftovers table.
- If `r2000_save_project` fails, say so immediately and stop — the work since
  the last refresh point is not persisted, and continuing widens the loss.
- Never invent an answer to make a queue entry go away. An honest "this looks
  like a table, callers unclear" in the leftovers table is worth more than a
  confident wrong label that the next reader has to un-learn.
