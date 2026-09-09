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

---

## Live Evidence (Plan 42-09): all five formats, decoded from a reply produced live

Plans `42-01`–`42-07` proved the parsers against twelve committed captures from two real
binaries — the fixtures prove the SHAPE. This plan proves the PATH: a tool call reaching
genuine stock VICE on this host, the reply coming back through the framing transport, and the
owning parser turning it into structured data, for all five formats, in one opt-in run
(`src/mcp/vice/text-monitor-live.test.ts`), against genuine stock `/usr/bin/x64sc`.

**Binary:** `stock:/usr/bin/x64sc`, `x64sc (VICE 3.9)`. **Date:** 2026-09-09. **Harness:** a real
broker daemon (`resources/vice-broker.mjs`) launching a real, freshly cold-booted `x64sc`
instance; the live suite reports `tests 8, pass 8, fail 0` with zero skipped cases.

### Block 7 (measured): `memmapshow` — access map

- **Command dialed:** the bare frozen verb `memmapshow`, via the channel-lock wrapper.
- **Measured result:** 1565 decoded entries (VICE's own sparse emission — an address with no
  recorded access is skipped, never padded back to 65536 rows).
- **Capability classification:** `capable`, asserted before parsing.

**Label: MEASURED.**

### Block 8 (measured): `chis` — CPU history

- **Command dialed:** `chis 20`, rendered by `buildTextCommand("chis", 20)` — never a hand-built
  string.
- **Measured result:** 20 decoded entries; every entry's cycle count positive; the observed
  cycle range across the batch was 39245–39309.
- **Capability classification:** `capable`, asserted before parsing.

**Label: MEASURED.**

### Block 9 (measured): `prof flat` — flat profile

- **Command dialed:** `prof flat 20`, rendered by `buildTextCommand("prof flat", 20)`.
- **Measured result:** 3 decoded rows; the leading row: `totalCycles: 530709, totalPercent: 100,
  selfCycles: 530709, selfPercent: 100, address: 64848` (`$FD50`).
- **Capability classification:** `capable`, asserted before parsing.
- **A genuinely new live finding, not present in either committed fixture:** VICE's own flat
  profiler defaults to OFF. `prof flat` alone, on a freshly connected session that has never
  issued `prof on`, returns `"No profiling data available. Start profiling with \"prof on\"."`
  — not a build-time guard (VICE always compiles `prof flat` in), not a parser refusal either,
  simply an empty subsystem with nothing yet to report. `TEXT_COMMAND_ALLOWLIST` (`text-protocol.ts`)
  was widened by two entries, `prof on`/`prof off`, in this plan — a conscious, measured
  widening per that constant's own header comment, not a speculative one — so the live suite
  can toggle the profiler on, resume the CPU briefly through the binary channel so the profiler
  has genuine cycles to attribute, dial `prof flat`, then toggle it off again, leaving the
  instance as it was found. **No production handler in this tree issues `prof on` today** —
  `text-tools.ts`'s `handleProfileFlat` dials `prof flat` alone — so `vice_profile_flat`, as
  shipped, cannot yet produce real profile rows against a freshly launched instance in
  production use. This is a real, separately-tracked gap this live run surfaced; closing it
  (teaching `handleProfileFlat` to toggle profiling itself, and to classify the "No profiling
  data available" line as its own named state rather than an implicit capable-empty answer) is
  future work, not this plan's own declared scope.
- **A second genuinely new live finding:** VICE's flat profiler can emit a synthetic top-level
  pseudo-frame whose address FIELD is the literal text `ROOT`, not a hex address — cycles that
  elapsed outside any traced call (e.g. the idle-loop time between the profiler being enabled
  and the first `JSR` executed) are attributed there. Neither committed fixture happened to
  capture this row shape (both ran long enough that no cycles landed at the root). `textmon-profile.ts`
  is corrected in this plan: `FlatProfileEntry.address` widens from `number` to `number | "ROOT"`,
  the row parser recognises the literal `"ROOT"` token before the hex-digit shape check, and two
  new unit tests (`textmon-profile.test.ts`) cover a bare ROOT row and a ROOT row alongside an
  ordinary hex-address row, both asserting VICE's own emitted order is preserved.

**Label: MEASURED** (the row count, cycle values, and the ROOT pseudo-frame shape); the two
findings above are measured live facts about VICE's own runtime behavior, not source-traced.

### Block 10 (measured): `bt` — backtrace

- **Command dialed:** the bare frozen verb `bt`, via the channel-lock wrapper.
- **Measured result:** call-chain depth 2; current-PC frame at `$FD7C`.
- **Capability classification:** `capable`, asserted before parsing.

**Label: MEASURED.**

### Block 11 (measured): `io` — register decode

- **Command dialed:** `io $d020`, rendered by `buildTextCommand("io", 0xd020)` — matching
  `fixtures/textmon/register-decode-stock`'s own captured command.
- **Measured result:** one decoded section, chip `VIC-II`; decoded raster line 311; decoded
  border colour `$00`.
- **Capability classification:** `capable`, asserted before parsing.

**Label: MEASURED.**

### Block 12 (measured): the capability probe — all five commands, the real cache key

`probeTextCapability()` was run against all five commands' own live replies above, using the
identity `{ backend: "stock", binPath: "/usr/bin/x64sc", resolved: true }` (this test dialed the
binary directly by its own absolute path, so `resolved` is genuinely true, never asserted from
an unresolved bare name). Every verdict: `capable`. The cache key `textCapabilityCacheKey()`
produced, verbatim, for every one of the five commands: `"stock:/usr/bin/x64sc"` — D-42-2's own
property, observed live rather than only argued from the unit tests: **the key names the
resolved absolute path of the binary, never a bare name.**

**Label: MEASURED.**

### Block 13 (measured): the RAM-execute observation — a shortfall, recorded as one

The live access map (Block 7, 1565 entries) was searched in full for entries whose RAM column
has its execute bit set. **Result: 0 RAM-execute entries found, out of 1565 total entries
searched.** This is recorded as a shortfall, not smoothed into the RAM-execute-found outcome:
the freshly cold-launched instance's boot window, in this run, never executed code from RAM
before the live suite captured `memmapshow`'s reply. Criterion 1's RAM half of the access map's
execute claim therefore remains covered by the declared-synthetic case in `textmon-memmap.test.ts`
only — this live run did not add hardware evidence for that specific half. The IO and ROM
halves, and the RAM read/write halves, are unaffected by this shortfall.

**Label: MEASURED** (a real search, over a real live access map, with its full denominator).

### Block 14 (not a citation): the stock-only bound on this live run

The live half above is stock-only **by construction**, not by omission: `broker-launch.mjs`
appends the `-remotemonitor` text-channel launch flags on its stock launch branch only — a fork
instance the broker leases has no text channel at all to dial. A live run through the broker can
therefore exercise exactly one of the two binaries. This does **not** weaken PARSE-03's
two-binary requirement: that requirement is about FIXTURES, and both binaries' fixtures are
already committed under `fixtures/textmon/`, captured by launching each binary directly rather
than through the broker (`39-07`, `CHAN-01`). The two binaries and their versions, named for
the record: `stock:/usr/bin/x64sc` (`x64sc (VICE 3.9)`, this plan's own live half) and
`fork:/usr/local/bin/x64sc` (`x64sc (VICE 3.10)`, the fork half of the two-binary fixture
requirement, satisfied by the committed fork captures rather than by this plan's own live run).

### This plan's two remaining bounds, left standing

This live run does **not** close either of `42-VALIDATION.md`'s two manual-only verifications,
and states so rather than letting a green live run imply otherwise:

1. **A genuinely `--disable-cpuhistory` VICE build naming its missing capability (PARSE-04).** No
   such build exists on this host, and this plan does not build one. `CPUHISTORY_DISABLED_STUB`
   stays source-traced (`mon_memmap.c:422–459`), not live-observed.
2. **`io`'s two degradation strings (PARSE-04).** Both stay source-traced (`monitor.c:1980–2000`),
   not live-observed — this run's own `io $d020` dial (Block 11) hit VIC-II's normal register
   dump path, not either degradation string.

---

## Gap-Closure Round (Plans 42-10 through 42-14) — measured on the tree it ships

This section records what the round measured, not what its plans proposed. It transcribes the
verbatim refusal messages, manifest-check outputs, teardown observations and gate figures each
plan's own SUMMARY recorded, and adds this plan's own re-measurement on the final, post-round
tree. Following this document's own convention: a claim carrying a run is labelled **MEASURED**
and names the command; a claim read from source stays **source-traced**. Every block below is
MEASURED unless stated otherwise.

### Block 15 (measured, plan 42-10): CR-01 — the unchecked decoded-state cast

**What was wrong:** `decodeProseLines()` in `textmon-registers.ts` accumulated the `io` format's
six recognised decoded-prose fields into a `Partial<Record<keyof IoDecodedState, unknown>>` and
returned `state as IoDecodedState` with no check that all 19 required fields were actually
observed. A dropped, renamed, or emptied recognised line produced `ok: true` with `undefined`
silently typed as a required field — the exact "semantic drift, no syntax change" failure mode
Success Criterion 4 exists to prevent.

**What changed:** a required-keys completeness gate was inserted in `decodeProseLines()`
immediately before the former unchecked cast (`textmon-registers.ts:439-445`). It filters the new
exported `REQUIRED_IO_DECODED_KEYS` constant (`textmon-registers.ts:380`, 19 keys, `IoDecodedState`'s
own declaration order) against the accumulated state via the `in` operator and refuses by name,
listing every absent field, when any are missing.

**Symbol/refusal code introduced:** `"incomplete-decoded-state"`, the ninth member of
`IoRegistersRefusalCode` (`textmon-registers.ts:204`).

**Proving command and verbatim output** — `node --test textmon-registers.test.ts` (planted
control: the real `register-decode-stock` capture with its `Colors:` line removed):

```json
{
  "ok": false,
  "refusal": {
    "code": "incomplete-decoded-state",
    "message": "io: the decoded-prose block spanning lines 7-11 did not carry every required field -- absent: borderColor, backgroundColor -- never returned as a complete decode",
    "line": "",
    "lineNumber": 7
  }
}
```

A companion source census (`textmon-registers.test.ts`) reads `IoDecodedState`'s own declared
field names off this module's real source with `readFileSync` and asserts set-equality with
`REQUIRED_IO_DECODED_KEYS` in both directions — the guard cannot silently fall out of sync with
the interface it polices.

### Block 16 (measured, plan 42-11): WR-02/IN-01 — the chip gate

**What was wrong:** `parseIoRegisters()` unconditionally required a `Sprites:` header and the
`io` decoded-prose fields for every chip section, though `vice_io_registers`'s own advertised
schema accepts any address in `0-65535`. A CIA1, CIA2, or SID address — every one inside that
range — always refused with a message worded as if a malformed VIC-II reply had arrived, never
naming the real chip. Separately, `handleIoRegisters` computed a
`classifyTextCapabilityResponse("io", response)` result and discarded it (IN-01).

**What changed:** a chip gate in `parseIoRegisters()` (`textmon-registers.ts:648-657`), placed
after the dump-row validation (so the `default_memspace` contamination hazard still outranks it)
and before the blank-separator/sprite checks, refuses any non-VIC-II chip section by the chip's
own name, stating the dump read cleanly. `handleIoRegisters`'s parse-refusal branch in
`text-tools.ts` gained a second arm: `unsupported-chip` renders the parser's own message verbatim
under the tool name with no wrapper, while every other code keeps the existing
`io's response could not be parsed (...)` wrapper. IN-01's discarded classification call was
removed.

**Symbol/refusal code introduced:** `"unsupported-chip"`, plus the module constant
`VIC_II_CHIP_NAME = "VIC-II"` (`textmon-registers.ts:205`, `:270`).

**Proving command and verbatim output** — `node --test textmon-registers.test.ts` (planted
control: the real `register-decode-stock` capture with its header renamed `VIC-II:` -> `CIA1:`):

```json
{
  "ok": false,
  "refusal": {
    "code": "unsupported-chip",
    "message": "io: chip \"CIA1\" is not supported -- its register dump read cleanly (64 bytes at $d000), but only \"VIC-II\" sections carry the decoded display state and sprite table this parser models -- dial an address covered by the VIC-II chip for a decoded answer",
    "line": "CIA1:",
    "lineNumber": 1
  }
}
```

`vice_io_registers`'s published `description` in `tools-manifest.stock.json` discloses the
VIC-II-only decode bound; its `inputSchema` is proven byte-unchanged by a machine-readable check:
`{"min": 0, "max": 65535, "type": "integer", "required": ["address"], "props": ["address"], "discloses_vicii": true}`.

### Block 17 (measured, plan 42-13): G2 — the cold profiler reply

**What was wrong:** `handleProfileFlat`'s cold-profiler reply (VICE's own "No profiling data
available. Start profiling with \"prof on\".", correctly classified `capable` — not a build-time
gap) then failed `parseFlatProfile`'s `missing-header` check, surfacing as "prof flat's response
could not be parsed" — a message that reads exactly like a parser defect in this project rather
than "profiling is not running."

**What changed:** `textmon-profile.ts` gained a byte-for-byte-recognised cold-profiler sentence
(MEASURED live against genuine stock `x64sc (VICE 3.9)`, 2026-09-09) and a new named refusal
state recognised in `parseFlatProfile()` (`textmon-profile.ts:265-270`), placed after the
existing empty-response checks and before the header check. `handleProfileFlat`'s parse-refusal
branch in `text-tools.ts` gained a second arm mirroring plan 42-11's `handleIoRegisters` shape:
`profiling-not-started` renders the parser's own message verbatim under the tool name with no
wrapper; every other code keeps the wrapper.

**Symbol/refusal code introduced:** `"profiling-not-started"`, plus the exported constant
`PROFILING_NOT_STARTED_TEXT` (`textmon-profile.ts:111`, `:152`).

**Proving command and verbatim output** — `node --test textmon-profile.test.ts` / `text-tools.test.ts`:

```json
{
  "ok": false,
  "refusal": {
    "code": "profiling-not-started",
    "message": "prof flat: the connected machine replied: No profiling data available. Start profiling with \"prof on\". -- profiling is not currently running there, this is not a missing build capability, and it is not a failure to read the reply",
    "line": "No profiling data available. Start profiling with \"prof on\".",
    "lineNumber": 1
  }
}
```

### Block 18 (measured, plan 42-13): WR-01 — the dropped identity disagreement

**What was wrong:** `text-capability-probe.ts` computed `identityDisagreement` but
`textCapabilityRefusalMessage()` never read it — a genuine binary-identity mismatch on an
otherwise-`capable` verdict was silently dropped from the user-facing message, reaching nobody.

**What changed:** a new exported renderer, `textCapabilityIdentityWarning(identity,
brokerIdentity)` (`text-capability-probe.ts:288`), answers "what must the caller know about an
otherwise-fine answer" — kept structurally separate from the refusal-answering
`textCapabilityRefusalMessage()`, so an advisory can never silently escalate into a refusal. All
five text-tool handlers in `text-tools.ts` compute the warning once, immediately after identity
resolution and before any dial, and surface it on the success path (an optional `identityWarning`
field) and on every post-lease error path (appended after the existing message, refusal first).

**Symbol introduced:** `textCapabilityIdentityWarning()` (exported), and the published optional
`identityWarning` string property on all five text tools' `outputSchema` (in no `required` list).

**Proving command and verbatim output** — `node --test text-capability-probe.test.ts` (a
path-mismatch case, `stock:/usr/bin/x64sc` vs. broker-reported `fork:/usr/local/bin/x64sc`):

```
text-capability-probe: this answer's binary identity could not be confirmed -- identity disagreement -- the dispatch-resolved identity is "stock:/usr/bin/x64sc" but the broker reports "fork:/usr/local/bin/x64sc" -- refusing to cache an answer that may not be attributable to either binary with confidence
```

Manifest check's printed output, proving `identityWarning` is declared `type: string` on all five
tools and required on none:

```json
[{"n": "vice_memmap_show", "has": true, "type": "string", "in_required": false}, {"n": "vice_cpu_history", "has": true, "type": "string", "in_required": false}, {"n": "vice_profile_flat", "has": true, "type": "string", "in_required": false}, {"n": "vice_backtrace", "has": true, "type": "string", "in_required": false}, {"n": "vice_io_registers", "has": true, "type": "string", "in_required": false}]
```

### Block 19 (measured, plan 42-12): G5 — the harness's teardown assertion

**What was wrong:** `text-monitor-live.test.ts`'s teardown assertion (`pidsAliveAfterTeardown`)
only ever tracked recorded emulator pids, never the broker child process (`vice-broker.mjs`)
itself. A real broker daemon (PID 1753509) survived ~25 minutes past a run before the phase's own
verification independently found it — every prior "teardown verified" claim for this file was
untested against the process it actually needed to observe.

**What changed:** `HarnessReport` gained three fields — `brokerPid`, `strayPidsMatchingScratch`,
`scratchDirRemoved` (`text-monitor-live.test.ts:248, 254, 259`). The broker child's pid is
captured after `startBroker()` returns and, if still alive after teardown, joins the existing
`pidsAliveAfterTeardown` array — so all eight pre-existing empty-array assertions now cover the
broker with zero call-site edits. A new scratch-scoped sweep helper,
`pidsMatchingCommandLine(needle)` (`text-monitor-live.test.ts:289`), matches only against the
harness's own unique `mkdtempSync` scratch path — never a process name — so it can never
misreport an unrelated developer broker instance as this harness's own leak. Scratch-directory
removal is asserted via `existsSync()` after `rmSync()`, not assumed. `stopBroker()`'s return type
changed from `Promise<void>` to `Promise<boolean>`, verifying its own SIGKILL escalation instead
of returning immediately after sending it. An unskipped planted-violation control (no opt-in
guard, runs with no `VICE_LIVE_STOCK_BIN` set) spawns a marker-carrying process, proves the sweep
and `isAlive()` both observe it alive, reaps it, and proves both report it gone — proving the
teardown machinery this file relies on can actually fail.

**Proving command and output** — `env -u VICE_LIVE_STOCK_BIN node --test text-monitor-live.test.ts`
(the planted control, unskipped, no live dependency): `tests 9 | pass 1 | skipped 8 | fail 0`,
exit 0 — the one unskipped case is the teardown control itself.

### Block 20 (measured, this plan): the final automated-gate reading

**Command:** `pgrep -af '[v]ice-broker|[x]64sc'` printed nothing (exit 1) immediately before this
run — confirmed with the un-confounded `ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' | grep
-v grep` form as well (also empty), since the bare `pgrep` pattern self-matches a shell command
line that merely quotes the substring `x64sc` (the same false-positive plan 42-12 already
documented).

**Command:** `cd src/mcp/vice && npm run test:automated`

**Result:** `tests 3941 | suites 24 | pass 3927 | fail 3 | cancelled 0 | skipped 6`. Failing files:
`anno-import.test.ts`, `anno-register.test.ts` — exactly the documented pre-existing 3-failure
floor, no new failing file introduced by this round. (A first reading in this same session read
`fail 4` with `audit-root-args.test.ts` also failing; re-run alone —
`node --test audit-root-args.test.ts` — passed cleanly at `58/58`, confirming the documented
`zz-scratch` ENOENT race rather than a regression, and a second full-gate reading settled back at
exactly 3.)

**This figure is the documented floor, not a target.** A run reporting zero would mean the gate
was not exercising the gate this project actually has — the three `anno-*` failures are a
recorded pre-existing bookkeeping cause (a requirement id not declared in `.planning/REQUIREMENTS.md`,
unrelated to this phase and out of this round's scope to close), not something later work is
expected to silently make disappear.

### Block 21 (measured, this plan): the live re-run — all five formats, after every parser and handler change this round made

**Binary:** `stock:/usr/bin/x64sc`, `x64sc (VICE 3.9)`. **Date:** 2026-09-09. **Command:**
`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts`, run against the tree
as this round leaves it — after plans 42-10 through 42-13 changed the `io` parser's section
handling, the profile parser's recognition order, and all five handlers' answer shape. **Result:**
`tests 9 | pass 9 | fail 0 | skipped 0`, exit 0.

Per-format measured shape, this run:

| Format | Command dialed | Measured shape | Capability verdict |
|---|---|---|---|
| `memmapshow` | bare `memmapshow` | 1565 entries; RAM-execute count 0/1565 (still no hardware evidence for that half — see Block 13) | `capable` |
| `chis` | `chis 20` | 20 entries; cycle range 39245-39309 | `capable` |
| `prof flat` | `prof on` -> `prof flat 20` -> `prof off` | 3 rows; leading row `{"totalCycles":550366,"totalPercent":100,"selfCycles":550366,"selfPercent":100,"address":64848}` | `capable` |
| `bt` | bare `bt` | chain depth 2; current PC `$fd7c` | `capable` |
| `io` | `io $d020` | chip `VIC-II`; raster line 0; border colour `$00` | `capable` |

All five capability-probe verdicts key on `"stock:/usr/bin/x64sc"`.

**Teardown outcome, corrected method (plan 42-12):** broker child pid tracked and confirmed exited
via the harness's own `pidsAliveAfterTeardown` (empty in every one of the 9 cases); scratch-scoped
stray-process sweep (`strayPidsMatchingScratch`) reported empty in every case; scratch directory
removal (`scratchDirRemoved`) asserted `true` in every case. Independently cross-checked after the
run: `ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep` printed nothing, and
`ls -d /tmp/text-monitor-live-*` found no surviving directory.

### Closing block: what this round did NOT close — restated as still open

1. **The inability of any tool in this tree to start VICE's profiler.** `vice_profile_flat`
   still cannot produce real rows against a freshly launched instance in production — no shipped
   handler issues `prof on`. Still recorded open at `.planning/WINDOWS.md` #55. This round changed
   how the cold state is *described* (a named `profiling-not-started` refusal), not whether the
   capability to start it exists.
2. **The two manual-only verifications from `42-VALIDATION.md`.** Neither closed by this round:
   (a) no genuinely `--disable-cpuhistory` VICE build exists on this host to prove the capability
   probe names the missing capability live rather than from a source-traced stub string; (b)
   `io`'s two degradation strings (`"No details available."` / `"No I/O regs available"`) remain
   source-traced (`monitor.c:1980-2000`), not live-observed — this round's live `io $d020` dial hit
   VIC-II's normal register dump path, not either degradation string.
3. **The RAM-execute hardware evidence.** Still 0/1565 over the searched denominator (Block 13
   and Block 21 above), covered only by the declared-synthetic case in `textmon-memmap.test.ts`.
   Accepted scope, stated in plan 42-01's own must-haves — not something this round attempted to
   close.
4. **The behavioural half of the decimal-separator finding (IN-02).** Only the documentation half
   landed (plan 42-13 corrected `FlatProfile.decimalSeparator`'s doc comment to state it records
   the FIRST data row's separator only). A per-row separator-consistency check remains unbuilt —
   deliberately not taken, per plan 42-13's own recorded decision, since no committed capture and
   no known VICE behaviour exhibits the payload shape it would guard against.
5. **The phase validation artifact's (`42-VALIDATION.md`) own draft status.** It remains
   `status: draft`, `nyquist_compliant: false`, `wave_0_complete: false`, **Approval: pending** —
   unaffected by this round, and belongs to its own `/gsd-validate-phase 42` command, not folded
   in here.

**What this round did NOT need to do:** the verification's second frontmatter gap
("undispositioned review findings") was self-resolved by `42-VERIFICATION.md`'s own orchestrator
addendum before this round began — writing that report named all five finding ids (CR-01, WR-01,
WR-02, IN-01, IN-02) in the phase directory, which is exactly what `docs-review-disposition.test.ts`'s
substring scan checks for, so the guard the verifier measured red went green the moment its own
report landed and was re-measured green before this round's first plan started. No plan in this
round chased it, and this is stated here so a later reader does not re-open it as an oversight.
