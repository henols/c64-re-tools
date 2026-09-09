# Phase 42: Text-Format Drift Citations — Evidence Record

This is Phase 42's own citation record, in the shape `docs/phase41-text-channel-live-evidence.md`
established: one claim per block, each carrying a file path, a line number, the raw quoted
line, which tree it was read in, and an honest label — measured or source-traced.

`42-RESEARCH.md`'s own drift-citation section re-read two full VICE source/NEWS trees this
phase's plans have relied on, and named line numbers for each claim. This record does not
merely repeat those citations — every one of them was independently re-verified against the
actual files during this plan (`sed -n`/`grep -n` against the live trees, not a re-read of the
research document's own prose), and two of the research document's own line-number citations
were themselves wrong in a way this record corrects (see Block 1 and Block 4 below). A citation
recorded without independent verification is exactly the failure mode this record exists to
close.

**Both source trees are HOST-LOCAL, not part of this repository:**

- `vice-3.8` (upstream, unmodified): `/home/henrik/Downloads/vice-3.8/` — a host-local path,
  present on this host only, not committed anywhere in this repository.
- `vice-fork` (this project's fork source, host-local checkout): `/home/henrik/dev/henrik/git/vice-mcp/vice/`
  — a host-local sibling checkout, also not part of this repository. Its version header confirms
  the build this project targets:
  - **Citation:** `/home/henrik/dev/henrik/git/vice-mcp/vice/src/version.h:34` (host-local, vice-fork tree) —
    raw quoted line: `#define VICE_VERSION_MAJOR 3`
  - **Citation:** `/home/henrik/dev/henrik/git/vice-mcp/vice/src/version.h:38` (host-local, vice-fork tree) —
    raw quoted line: `#define VICE_VERSION_MINOR 10`
  - Label: source-traced.

Every citation below was read directly from these two trees during this plan's own execution,
2026-09-09.

---

## Block 1: The cycle-column change (`chis`)

**Corrected claim:** the cycle count on `chis` is not one event at a single version. It is
three separate events across three releases: the cycle count's first appearance (3.5), the
column's later widening to twelve digits (3.6), and a subsequent correctness fix to the value
itself (3.7) — a fix, not a further widening, and must not be merged into the widening event by
a future reader.

**Correction to the research document's own citation.** `42-RESEARCH.md` cited these three
events at `NEWS:1185`, `NEWS:780`, and `NEWS:334` in the vice-3.8 tree. Independently
re-verified this plan: those three line numbers are each a SECTION HEADER line (`* Changes in
Vice 3.5`, `* Changes in Vice 3.6`, `* Changes in Vice 3.7` respectively), not the content line
itself. The actual content lines, located by `grep -n` for `chis`/`cycle` within each section's
line range, are at 1393, 1060, and 462. Corrected citations below.

- **Event 1 — first appearance (VICE 3.5).**
  - **Citation:** `/home/henrik/Downloads/vice-3.8/NEWS:1393` (host-local, vice-3.8 tree), inside
    the `* Changes in Vice 3.5` section (header confirmed at `NEWS:1185` in the same tree) —
    raw quoted line: `` - `chis` shows the cycle count as well now ``
- **Event 2 — the widening (VICE 3.6).**
  - **Citation:** `/home/henrik/Downloads/vice-3.8/NEWS:1060` (host-local, vice-3.8 tree), inside
    the `* Changes in Vice 3.6` section (header confirmed at `NEWS:780` in the same tree) —
    raw quoted line: `- 'chis' command now prints a 12 digit cycle counter.`
- **Event 3 — the adjacent correctness fix, NOT a further widening (VICE 3.7).**
  - **Citation:** `/home/henrik/Downloads/vice-3.8/NEWS:462` (host-local, vice-3.8 tree), inside
    the `* Changes in Vice 3.7` section (header confirmed at `NEWS:334` in the same tree) —
    raw quoted line: `- Fix cycle count stored into the cpu history (only x64sc)`

**Corrected attribution:** the cycle-column change belongs to the pair of releases **3.5 and
3.6**, not the "3.0" the ROADMAP and REQUIREMENTS previously stated. No occurrence of `chis` or
`cycle` appears anywhere inside the VICE 3.0 section of either tree — re-confirmed this plan by
`grep -n "chis\|cycle" NEWS` scoped to that section's own line range in the vice-3.8 tree, zero
matches.

**Label: source-traced.** Not observed live against a binary predating VICE 3.5 — no such
binary exists on this host, and building one is out of scope; `42-VALIDATION.md` already
records the equivalent live check as manual-only.

---

## Block 2: The access-class addition (`memmapshow`)

**Corrected claim:** the `(uninitialized read)`/`(uninitialized exec)` access-class annotation
was added at **VICE 3.9/3.10**, not the "3.5" the ROADMAP and REQUIREMENTS previously stated.

- **Citation (the real event, fork tree).** `/home/henrik/dev/henrik/git/vice-mcp/vice/NEWS:413`
  (host-local, vice-fork tree), inside the `* Changes in Vice 3.10` section (header confirmed
  at `NEWS:26` in the same tree — this tree carries no separate `3.9` section header at all,
  confirmed this plan by `grep -n "^\* Changes in Vice 3\.9$"`, zero matches) — raw quoted line:
  `- memmap extension: show reads of non initialized ram.`

  This is the real upstream event behind the `(uninitialized read)`/`(uninitialized exec)`
  annotations `mon_memmap.c` emits (see below); it exists and is real, but at 3.9/3.10, not 3.5.

- **Citation (the OLDER, unrelated event the earlier "3.5" attribution conflated with the
  above).** `/home/henrik/Downloads/vice-3.8/NEWS:3642` through `:3643` (host-local, vice-3.8
  tree), inside the `* Changes in VICE 2.0` section (header confirmed at `NEWS:3479` in the same
  tree) — raw quoted lines:
  ```
  - New memmap feature which allows tracking of memory accesses,
    activated by the configure option --enable-memmap.
  ```
  This is the feature's original birth at VICE 2.0 — a much older, different event (the feature
  coming into existence at all, not an access-class widening within it). Conflating this
  citation with the 3.9/3.10 access-class addition above is exactly what produced the earlier
  wrong "3.5" attribution: no occurrence of "memmap" appears anywhere inside the VICE 3.5 section
  of either tree at all — re-confirmed this plan, zero matches by `grep -n "memmap" NEWS` scoped
  to that section's line range in both trees.

- **Annotation strings the fork's own print function emits.** `mon_memmap.c` in the fork tree
  emits three annotation suffixes for `memmapshow` lines. Per plan `42-01`'s own measured
  finding (`42-01-SUMMARY.md`, Deviation 2), only ONE of the three appears in either committed
  capture: `(dummy)` appears 677 times in each of `access-map-stock.txt`/`access-map-fork.txt`;
  `(uninitialized read)` appears 39,937 times in EACH of the two real committed captures — this
  corrects `42-RESEARCH.md`'s own separate premise (repeated in `42-01`'s plan text) that this
  annotation was synthetic-only, a correction plan `42-01` already made and is restated here so
  this record is internally consistent with it; `(uninitialized exec)` appears in NEITHER
  committed capture (genuinely absent from both, synthetic-only in this batch).

**Label: source-traced** for the NEWS-file attribution and the annotation-string source. The
39,937-occurrence count is a distinct, already-**measured** fact (plan `42-01`'s own direct
`grep -c` against the real fixture files, not this plan's re-derivation) — carried forward here
with its own provenance rather than re-labelled.

---

## Block 3: The glyph inversion (`mc`/`ms`) — CONFIRMED, not corrected

**Confirmed claim:** VICE 3.4 inverted the meaning of the `mc`/`ms` commands' glyphs (asterisk
now means 1, dot now means 0 — the opposite of the pre-3.4 polarity) with no syntax or layout
change to signal it. The identical line appears in both trees, inside each tree's own `* Changes
in Vice 3.4` section.

- **Citation 1 (vice-3.8 tree, upstream).** `/home/henrik/Downloads/vice-3.8/NEWS:1768` through
  `:1769` (host-local, vice-3.8 tree), inside the `* Changes in Vice 3.4` section (header
  confirmed at `NEWS:1638` in the same tree) — raw quoted lines:
  ```
  - in mc/ms commands show asterisk for 1s and dots for 0s, not the other way
    around
  ```
- **Citation 2 (vice-fork tree — an INDEPENDENT WITNESS, not a copy of Citation 1).**
  `/home/henrik/dev/henrik/git/vice-mcp/vice/NEWS:2213` through `:2214` (host-local, vice-fork
  tree) — a separately maintained NEWS file in a different checkout, whose own `* Changes in
  Vice 3.4` section header (confirmed at `NEWS:2083` in the same tree) independently carries the
  identical wording — raw quoted lines:
  ```
  - in mc/ms commands show asterisk for 1s and dots for 0s, not the other way
    around
  ```

Both citations were read from two independently checked-out trees, one unmodified upstream and
one this project's own fork checkout; the second is not a copy-paste of the first but a
separate read of a separate file that happens to preserve the identical historical NEWS entry —
independent confirmation that the 3.4 attribution is correct as originally stated. No correction
needed for this claim.

**Label: source-traced.** This is a NEWS-file textual claim, not a live-observed behavior; no
binary spanning both sides of the 3.4 boundary was run this session.

---

## Block 4: The build guards — corrected shape, not "each command has its own"

**Corrected claim:** the five text-monitor commands this phase parses do **not** each carry
their own separate build-time guard. The actual shape, verified against the vice-3.8 source
tree this plan (independently re-verifying `42-RESEARCH.md`'s own citations, one of which was
wrong — see the correction note on the conditional's closing line below): **two share one guard
and print one identical stub string, two carry no build-time guard at all, and the fifth
degrades with its own two runtime text messages instead of refusing.**

**`memmapshow` and `chis` — share ONE guard, print the SAME string.**
`/home/henrik/Downloads/vice-3.8/src/monitor/mon_memmap.c:52` opens `#ifdef
FEATURE_CPUMEMHISTORY` — raw quoted line: `#ifdef FEATURE_CPUMEMHISTORY`. The disabled branch
(`#else`) opens at line 422 and the whole conditional closes at line 459 — raw quoted lines:
`#else /* !FEATURE_CPUMEMHISTORY */` (line 422) and `#endif` (line 459).

**Correction to the research document's own citation.** `42-RESEARCH.md` stated this
conditional "clos[es]" at line 330. Independently re-verified this plan by listing every
`#if`/`#else`/`#endif` line in the file (`grep -n "^#if\|^#else\|^#endif" mon_memmap.c`): line
330 closes an unrelated NESTED `#if 0` dead-code block (opened at line 323, inside the
FEATURE_CPUMEMHISTORY-enabled branch), not the top-level `FEATURE_CPUMEMHISTORY` conditional
itself. The top-level conditional's own structure is `#ifdef` at line 52, `#else` at line 422,
`#endif` at line 459 — the disabled stub branch this block cites is lines 422–459.

Inside that disabled branch, the shared stub function and its one string:
- **Citation (the stub function, lines 425–428):** raw quoted lines:
  ```
  static void mon_memmap_stub(void)
  {
      mon_out("Disabled. configure with --enable-cpuhistory and recompile.\n");
  }
  ```
- The disabled-build implementations of BOTH commands call this same function:
  `mon_cpuhistory()` (backs `chis`, defined at line 430, body calls `mon_memmap_stub();` at line
  433) and `mon_memmap_show()` (backs `memmapshow`, defined at line 441, body calls
  `mon_memmap_stub();` at line 443). The stub function's own body (quoted above) is this
  record's one and only quotation of the shared disabled-stub string — both disabled-build
  commands reach it by calling the same function, never by each carrying their own copy.

**The build flag is opt-OUT by default (confirmed, not merely asserted).**
- **Citation:** `/home/henrik/Downloads/vice-3.8/configure.ac:120` — raw quoted line:
  `VICE_ARG_ENABLE_LIST(cpuhistory,            [  --disable-cpuhistory    disable the 65xx cpu history feature])`
- **Citation:** `/home/henrik/Downloads/vice-3.8/configure.ac:521` — raw quoted line:
  `AS_IF([test x"$enable_cpuhistory" != "xno"],`

  Together: the feature compiles IN unless the builder explicitly passes `--disable-cpuhistory`
  — the opposite polarity to the `CPUHISTORY_GET` (0x86) binary-monitor opcode's own `>= 3.10`
  version floor, which CLAUDE.md's existing constraint already states and this record traces to
  the exact macro (`FEATURE_CPUMEMHISTORY`) and configure flag (`--disable-cpuhistory`).

**`bt` (backtrace) — NO build-time guard.**
- **Citation:** `/home/henrik/Downloads/vice-3.8/src/monitor/monitor.c:1156` — raw quoted line:
  `void mon_backtrace(void)`. No `#ifdef`/`#if` line appears anywhere near this definition
  (confirmed this plan: `grep -n "^#if" monitor.c` shows no match adjacent to line 1156).
- It reads from state defined unconditionally in `profiler.c`:
  - **Citation:** `/home/henrik/Downloads/vice-3.8/src/profiler.c:49` — raw quoted line:
    `uint16_t callstack_pc_dst[MAX_CALLSTACK_SIZE];`
  - **Citation:** `/home/henrik/Downloads/vice-3.8/src/profiler.c:50` — raw quoted line:
    `uint16_t callstack_pc_src[MAX_CALLSTACK_SIZE];`
  - **Citation:** `/home/henrik/Downloads/vice-3.8/src/profiler.c:51` — raw quoted line:
    `uint8_t  callstack_sp[MAX_CALLSTACK_SIZE];`
  - **Citation:** `/home/henrik/Downloads/vice-3.8/src/profiler.c:53` — raw quoted line:
    `unsigned callstack_size = 0;`
  - None of these four declarations sits inside any `#ifdef` — the file's only `#if` line
    (confirmed this plan: `grep -n "^#if" profiler.c`) is at line 92, `#if 0 /* unused */`, an
    unrelated dead-code block nowhere near these declarations.

**`prof flat` — NO build-time guard.**
- **Citation:** `/home/henrik/Downloads/vice-3.8/src/monitor/mon_profile.c` — confirmed this
  plan by `grep -n "^#if" mon_profile.c` over the file's full 1,141 lines: **zero matches**. The
  file contains no conditional compilation at all.

**`io` (register decode) — NO build-time guard; degrades with its OWN TWO runtime text
messages instead of refusing.**
- **Citation (unconditional registration):** `/home/henrik/Downloads/vice-3.8/src/monitor/mon_command.c:502`
  — raw quoted line: `{ "io", "",`
- **Citation (degradation message 1, two call sites):**
  `/home/henrik/Downloads/vice-3.8/src/monitor/monitor.c:1983` and `:1986` — raw quoted line
  (identical at both sites): `mon_out("No details available.\n");` — fires when a specific
  register has no dump function, or its dump function returns an error.
- **Citation (degradation message 2):** `/home/henrik/Downloads/vice-3.8/src/monitor/monitor.c:1998`
  — raw quoted line: `mon_out("No I/O regs available\n");` — fires when the register list itself
  is empty for the current bank.

These two strings are a CHIP-LEVEL runtime fact (a register has nothing to show, or the current
bank has no register list), never a build-capability gap — no `#ifdef` surrounds either message
or the `io` command's registration. Plan `42-05`'s already-landed `text-capability-probe.ts`
independently reaches this same conclusion in its own implementation: `io`'s two degradation
strings are treated as "a RENDER-TIME distinction over an otherwise-capable io verdict, not a
fourth TextCapabilityOutcome member" (`42-05-SUMMARY.md`, Decisions Made) — this evidence record
and that already-shipped code agree.

**The corrected shape, stated plainly:** the affected commands do **not** each carry their own
separate guard. The shape is **two-share-one** (`memmapshow`/`chis`, one macro, one stub
string), **two-have-none** (`bt`, `prof flat`, always compiled, nothing to probe for a missing
build capability), **one-degrades-differently** (`io`, always compiled, degrades per-chip at
runtime with its own two fixed strings rather than a build-time refusal).

**PARSE-04's per-command probing requirement is UNAFFECTED by this correction.** The probe
still asks about each of the five commands independently, on its own binary — the correction is
that a `memmapshow`-missing answer and a `chis`-missing answer, when both occur on the same
binary, can be reported with ONE remedy sentence naming both commands (since they share the
identical underlying gap), not that the probe stops checking either command independently.
Plan `42-05`'s already-shipped `text-capability-probe.ts` implements exactly this: each of the
five commands is probed and cached on its own (`probeTextCapability()`, per-command cache
entries confirmed by dedicated tests), while `textCapabilityRefusalMessage()` merges two
missing verdicts sharing the stub string into one remedy sentence naming both commands
(`42-05-SUMMARY.md`, coverage `D1`/`D2`). This record's correction and that already-landed code
agree; neither weakens the per-command probing design PARSE-04 states, which remains the only
design correct under all three shapes the source actually shows.

**Label: source-traced.** None of the four commands' guard behaviors above was observed live
against a binary genuinely built without `--enable-cpuhistory` — no such binary exists on this
host, and building one is out of scope for this plan. `42-VALIDATION.md` already records that
live check as a manual-only verification item with its own instructions.

---

## Block 5 (measured): No command in the fixture batch refused, on either binary

**This is the one genuinely MEASURED claim in this record — not source-traced.**
`src/mcp/vice/fixtures/textmon/README.md`'s own "Unsupported commands (D-20)" section states:

> `FIXTURE_UNSUPPORTED: none` in this batch — every command in the set answered successfully on
> both binaries; no refusal fired.

- **Binaries:** `stock:/usr/bin/x64sc` (`x64sc (VICE 3.9)`) and `fork:/usr/local/bin/x64sc`
  (`x64sc (VICE 3.10)`) — per the same README's own fixture table, both present on this host.
- **Date:** 2026-09-07 (`capturedAt`, per every sidecar in the batch — the same README notes
  this timestamp is run-level, stamped once for the whole batch, not per-capture).
- **Provenance:** twelve real captures (six command groups × two binaries), captured by
  `.planning/phases/39-.../evidence/fixture-capture.mjs` (plan `39-07`, `CHAN-01`) and committed
  under `src/mcp/vice/fixtures/textmon/`.

**Label: measured** — twelve real captures, two named binaries with their reported versions, one
recorded capture date. This is the only claim in this record carrying that label; every other
block above is source-traced.

---

## Block 6 (not a citation): The skill-placement finding

Two shipped skills would naturally call the five commands this phase's parsers cover:

- **`c64-program-recon`** — wants the code-versus-data map (`memmapshow`'s access map), the
  reconstructed call chain (`bt`), and CPU history (`chis`) to find an entry point and a main
  loop, per its own frontmatter description ("find the main loop, entry point or IRQ handler...
  identify a game state machine, work out which memory regions are code versus data").
- **`vice-wedge-triage`** — wants the call chain (`bt`) and CPU history (`chis`) as evidence
  that the machine is or is not advancing, per its own frontmatter description ("decide whether
  a VICE emulator that has stopped responding is genuinely wedged... or merely paused").

**No skill text changes in this phase, and this is deliberate, not an oversight.** These five
tools exist on the stock backend only (this project's own `vice_memmap_show`/`vice_bt`/`vice_chis`/
`vice_prof_flat`/`vice_io_registers` are `STOCK_DERIVED_TOOLS` entries, unreachable on the fork
backend). CLAUDE.md's own compatibility constraint states that a skill written against the full
fork surface BREAKS rather than degrades on stock, and the reverse is equally true for a skill
whose playbook assumes tools that exist on stock only — the honest fix is a skill edit that
explicitly names the stock route or the fork requirement, not a silent assumption either way.
That is a skill-text decision that belongs with whichever future phase gives one of these two
playbooks an actual reason to call these tools in its own worked examples, not with the phase
that builds the tools themselves.
