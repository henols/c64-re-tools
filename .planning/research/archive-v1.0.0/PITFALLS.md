# Pitfalls Research: Adding the Rebuild Half to c64-re-tools

**Domain:** Decomposition-to-closure, rebuildable multi-file ACME source, movement-hazard
detection, reassembly gate, behavioural-equivalence/modifiability proof — added to an existing
C64 reverse-engineering toolchain (dxa + Ghidra decode, owned `.annostore`, real-ACME oracle,
runtime execution-evidence layer). Milestone v1.0.0.
**Researched:** 2026-09-10
**Confidence:** HIGH for anything citing a measurement already recorded in this repo's
`PROJECT.md`/`ENGINEERING_RULES.md`/source; MEDIUM for general 6502/ACME domain facts corroborated
by external sources; LOW is flagged inline where a claim is inference rather than measurement.

This document assumes the reader has `.planning/PROJECT.md` → `## Current Milestone: v1.0.0`,
`.planning/milestones/v0.5.0-REQUIREMENTS.md` (the un-re-scoped base text for `DECOMP-*`/
`BUILD-*`/`EQUIV-*`), and `.planning/ENGINEERING_RULES.md` open. Nothing below repeats generic
reverse-engineering advice that isn't specific to *this* system's shape.

---

## Critical Pitfalls

### Pitfall 1: Deriving the reassembly verdict from exit status or an aggregate summary line

**What goes wrong:**
A rebuild "passes" because the assembler exited 0, or because a printed aggregate line
("Saving N bytes...") looks like a clean summary, while the actual bytes produced are wrong. This
project has already measured this exact failure once, on a different route: the `da65`+ca65/ld65
pivot recorded as an anti-feature — a `TYPE SKIP` hole collapsed and the rebuild **assembled
cleanly to a wrong binary**. The general form is broader than that one incident: ACME 0.97 itself
demonstrates it — `lda #$00` and `lda #$01` both assemble and both exit 0 while their bytes
differ, so exit status structurally cannot see a wrong byte.

**Why it happens:**
Exit status and summary lines are cheap, always-present signals; a byte-diff requires deriving
the expected bytes independently and keeping that derivation out of the same code path that
produced the source. Under time pressure, the cheap signal gets wired up first and never
replaced, because it is green on every happy-path run during development.

**How to avoid:**
Follow the pattern this project already built for `acme export-asm`'s oracle
(`src/mcp/vice/acme-verify.ts`) rather than reinventing verification for the rebuild gate: the
verdict is a **byte-diff of the file this run created against bytes the caller derived from the
image**, exit status is recorded but consulted by nothing, the aggregate summary line is recorded
but consulted by nothing, and a spawn that never ran gets its own `"skipped"` outcome distinct
from both pass and byte-level fail. Any new reassembly gate for `BUILD-06` must reuse or mirror
this three-outcome design, not build a second, weaker oracle beside it.

**Warning signs:**
The gate's implementation reads `child.status === 0` (or greps for a "Saving" line) anywhere on
the path to a pass/fail verdict. A gate that has never been observed to fail on a real bad rebuild
in this codebase's test history.

**Phase to address:**
The rebuildable-source / reassembly-gate phase (`BUILD-06`), before any phase downstream depends
on "reassembles cleanly" meaning anything.

---

### Pitfall 2: Byte-diff against a stale or fixed output path

**What goes wrong:**
The gate diffs a `.prg` at a fixed path across invocations. A prior successful build's bytes are
still sitting there from yesterday; the current run's assembler invocation fails silently (spawn
error, wrong argv) and the stale, unrelated bytes are diffed and reported as a pass.

**Why it happens:**
Reusing a fixed output path is the path of least resistance when wiring a verifier quickly, and it
works fine in every manual test where the developer already knows the file is fresh.

**How to avoid:**
`acme-verify.ts` already states the rule for this exact hazard: "ACME leaves a PRE-EXISTING
output file completely untouched when it fails" — use a fresh `mkdtempSync` per invocation and
assert the output path was **absent before the spawn**, so "did THIS run create it" is the
property being checked, not merely "does a file exist at this path now." Reuse that exact
mechanism for the rebuild gate rather than re-deriving a weaker one.

**Warning signs:**
The gate's output directory is a fixed, reused path (e.g. `build/rebuild.prg`) rather than a
fresh temp directory per run.

**Phase to address:**
The reassembly-gate phase (`BUILD-06`).

---

### Pitfall 3: Reassembly verified only at the original layout, never after movement

**What goes wrong:**
The gate re-assembles the exported source and diffs it against the *original* image at the
*original* addresses — proving the symbol table round-trips, but never actually exercising
`BUILD-03`'s claim ("every branch, JSR/JMP and data reference goes through a symbol, so code can
move"). A rebuild that never moves anything can pass a byte-diff gate trivially even with broken
symbolisation, because unresolved or wrong symbols that happen to still evaluate to the original
addresses produce the original bytes.

**Why it happens:**
"Reassemble and byte-diff" is the natural first gate to build, and it is genuinely necessary. But
it answers a narrower question (did the printer round-trip this decode) than the one the
milestone needs answered (can this source actually be relocated). Movement is a second,
independent property that a same-address round trip cannot exercise.

**How to avoid:**
Run the reassembly gate in **two** modes, not one: (1) same-address round trip against the
original image (a necessary sanity floor — this is the "narrower, optional pre-modification
byte-identical sanity check" the v0.5.0 requirements explicitly leave room for), and (2) a
relocated build where at least one hazard-free block is moved to a different address and the gate
confirms the moved build still assembles *and* that every reference the store believes is
symbolic actually re-resolved rather than having been emitted as a literal address that happened
to match. `EQUIV-01`'s "original-versus-different-binary mode ... a mode it has never been run in"
is the direct precedent for "we built the harness but never actually ran the mode that matters" —
don't let the reassembly gate repeat it.

**Warning signs:**
`BUILD-06`'s gate always assembles at `*=` equal to the original load address; no plan or test
ever moves a symbol's home address and reassembles.

**Phase to address:**
The reassembly-gate phase (`BUILD-06`) — build the movement-mode check in the same phase that
builds the gate, not deferred to the equivalence phase, since a movement-blind gate would let
`EQUIV-03`'s modifiability proof start on an unverified foundation.

---

### Pitfall 4: Hazard-adjacent ranges silently excluded from the byte-diff scope

**What goes wrong:**
The reassembly gate reports "clean" because it only diffs the ranges the decomposition confidently
typed, quietly excluding ranges the pipeline was unsure about (declined bank-state-dependent
bytes, `unclassified` dxa/Ghidra overlaps, self-modifying-code targets). The gate is vacuously
green because it never looked at the bytes most likely to be wrong.

**Why it happens:**
It's tempting to scope the diff to "what we're confident about" during development, and that scope
never gets widened back out once the gate is green.

**How to avoid:**
This directly threatens the milestone's own new invariant, `BUILD-07`: "the export path is
lossless by default — no range dropped, filtered or omitted on the tool's own judgement." Reuse
its already-specified control for the reassembly gate too — a planted control where a heuristic
*would* want to exclude a range from the diff, and the range still gets diffed. The gate's scope
must be **the whole image**, derived the same way `BUILD-07`'s lossless-export check derives its
scope, not a second, independently-maintained range list.

**Warning signs:**
The gate's diff loop iterates over `annostore` block ranges with a `type !== "unclassified"`
filter, or similar, before comparing bytes.

**Phase to address:**
The reassembly-gate phase (`BUILD-06`), sharing its scope-derivation code with `BUILD-07`'s
lossless-export control rather than parallel-building it.

---

### Pitfall 5: Bank-state-dependent code/data decisions collapse to a single wrong guess

**What goes wrong:**
Any range whose meaning depends on the CPU port (`$01`) or VIC banking state at the moment it's
touched — code visible under one memory configuration, ROM/RAM/I-O under another — gets
classified once, confidently, and wrong for the configuration that actually applies at that
program point. `PROOF-03` already measured this exact failure mode structurally: the same
`$D020` annotates differently under `$34` and `$33`, and a scratch-mutated "forward carry"
annotator produces a confident wrong answer at `PROOF03_FORWARD_CARRY_WRONG_AT`, while the
committed branch declines with a reason naming both values.

**Why it happens:**
Static disassemblers (dxa, Ghidra without hints) have no notion of the 6510's memory-mapping
state machine; a byte at `$A000` is either BASIC ROM or cartridge/RAM depending on `$01`, and a
single fixed disassembly pass has to pick one.

**How to avoid:**
Preserve the AUTO-01..08 precedent for the new decomposition/export work: **decline with a
reason** rather than emit a comment for any address whose bank state is path-dependent, and
surface that decline in `DECOMP-03`'s "every referenced non-hardware address is named and
documented" as an explicit `unresolved-bank-state` entry, not silence. Do not let the rebuild
pipeline invent a plausible-looking symbol name for a bank-ambiguous byte just because
`DECOMP-01`'s "nothing left Undefined" bar is pushing toward 100% coverage — a wrong confident
name is worse than an honestly incomplete one, and this is the project's own stated standard.

**Warning signs:**
`DECOMP-01`'s "every byte is code/byte/word/address/..." census reaches 100% with zero
`unresolved-bank-state` (or equivalent) entries on a fixture that deliberately exercises bank
switching — that is the sign the decliner was bypassed, not that the problem doesn't exist on this
fixture.

**Phase to address:**
The decomposition phase (`DECOMP-01`..`04`) for the census discipline; the synthetic-fixture
phase should deliberately include a bank-state-dependent range to make this checkable at all.

---

### Pitfall 6: Static reachability misses code the runtime evidence layer already knows about

**What goes wrong:**
The decomposition pipeline relies on dxa/Ghidra's static recursive-descent reachability to decide
what's code. Anything reached only through an indirect jump table, a computed dispatch, or a path
a static walk doesn't take gets typed as data (or left `Undefined`), even though this project
already has an independent, structurally-separate fact source that would catch it:
`anno_evid_exec`'s runtime evidence layer, whose whole `EVID-*`/`PROOF-04` design exists
specifically to report **disagreement** between what the bytes imply and what the machine was
observed doing.

**Why it happens:**
The decomposition work and the runtime-evidence work were built in different milestones
(`v0.8.0` static engines vs. `v0.9.0` runtime evidence), so it is easy to run the rebuild pipeline
purely off the static block table and never re-query the evidence layer that was built to catch
exactly this class of miss.

**How to avoid:**
Before declaring `DECOMP-01` satisfied on any fixture that has been executed under the emulator
(which the synthetic fixture will be, for `EQUIV-02`/`EQUIV-03`), run
`anno_evid_disagreements` and treat every disagreement as a decomposition defect to resolve, not
as an unrelated finding. This is the one integration point in this milestone where "upstream of
the rebuild half" (the v0.8.0-close dependency note, now discharged per PROJECT.md's v1.0.0-open
text) actually pays for itself — use it, don't leave it sitting unused beside a purely
byte-derived census.

**Warning signs:**
`DECOMP-01`'s completeness census is computed and reported without any query against
`anno_evid_disagreements` in the same evidence trail; the decomposition phase's plans never call
the runtime-evidence tools at all.

**Phase to address:**
The decomposition phase (`DECOMP-01`), gated on the synthetic fixture already having been executed
and captured (an ordering dependency the roadmap should make explicit: capture-and-execute the
fixture before or interleaved with decomposition, not only for `EQUIV-02` afterward).

---

### Pitfall 7: A "clean hazard report" that never saw the RTS-trick variant it wasn't written to expect

**What goes wrong:**
The movement-hazard detector's RTS-trick check pattern-matches the canonical idiom (push
low byte, push high byte, `rts` to fall into the target) and misses functionally-equivalent
variants — an index computed by combining two bytes, a table selected via `x` in one place and
`y` in another, a target pushed by two separate `pha` sequences on different branches. The report
comes back clean; `BUILD-06`'s gate passes; the range gets moved; the game jumps into garbage at
runtime, discovered only if someone happens to exercise that exact code path in `EQUIV-02`/`03`,
and possibly not even then.

**Why it happens:**
RTS-trick detection is inherently a pattern-match over a family of idioms, not a single fixed
opcode sequence, and the fixture used to validate the detector is written by the same person (or
same design document) that wrote the detector — see Pitfall 15 for why that specifically produces
this failure.

**How to avoid:**
A hazard detector that can miss a hazard is worse than none, because the report is then trusted.
Treat the RTS-trick detector's precision claim the same way this project treats every other
non-vacuous-verification claim (`ENGINEERING_RULES.md` §6): it must be observed **catching** a
planted instance it was not specifically pattern-matched against, not merely passing on the one
canonical instance it was built to catch. Where the detector cannot prove generality, it must
report `unclassified — indirect control flow, manual review required` rather than "clean" —
mirroring the coverage instrument's own precedent of an honest gap over a confident wrong number
(`COV-02`).

**Warning signs:**
The RTS-trick detector's test suite contains exactly the fixture instance it was designed against
and no structurally-different variant; "clean" is the detector's *only* output value (no
"unclassified, needs review" outcome exists at all).

**Phase to address:**
The rebuildable-source phase (`BUILD-04`), with the non-vacuity control specifically required
before `BUILD-06`'s gate is allowed to consume the hazard report as a green light.

---

### Pitfall 8: Self-modifying-code detection that only watches the SMC's own file, not every write site

**What goes wrong:**
The self-modifying-code hazard check looks for a `STA`/`STX`/`STY` whose target literally falls
inside a range the store already typed as `Code` — the pattern this project's own Ghidra probe
proved works ("flagged the self-modifying write landing inside a Code block"). It misses SMC where
the write's target address is computed at runtime (indirect via a zero-page pointer, or an
indexed store where the index varies across calls) and therefore is never a literal match against
a code range during static analysis, even though the runtime evidence layer would show the code
range's bytes differing between two captures at the same address.

**Why it happens:**
Ghidra's own SMC detection (as measured in this project) operates on the **decompiler** layer, not
the listing's data types — a write with a computed target doesn't decompile to an obviously
code-target store, so it's invisible at that layer too. The gap is structural, not an
implementation oversight in either engine.

**How to avoid:**
Treat static SMC detection as a first-pass heuristic only, and add a second, independent line of
defense this project already has the substrate for: compare two runtime `anno_evid_exec` captures
of the same subject taken at different points and flag any address whose **observed bytes**
differ across captures, or whose class flips from `unobserved` to `code` mid-run in a way a static
Code/Data assignment didn't predict. Report both signals in `BUILD-04`'s hazard report as
independently-sourced findings rather than merging them into one boolean.

**Warning signs:**
The hazard report's self-modifying-code class has exactly one detection mechanism (static
write-target-in-Code-range) and the runtime evidence layer is never consulted for it.

**Phase to address:**
The rebuildable-source phase (`BUILD-04`), reusing the runtime-evidence-layer integration point
named in Pitfall 6.

---

### Pitfall 9: Page-alignment dependence detected only as a literal `!align` directive

**What goes wrong:**
The alignment-hazard detector looks for the presence of an explicit alignment marker in the
generated source and declares anything without one "safe to move." It misses the far more common
implicit forms: a table sized to exactly 256 bytes so that an `INX`/wraparound indexing scheme
depends on it starting at offset 0 of a page; a bitmask like `AND #$3F` applied to an index that
only stays in range because the table's base address's low byte is `$00`; a `,X`-indexed store
whose target crosses a page boundary and therefore costs an extra cycle only at its *current*
address. None of these show up as a directive to grep for — they are properties of the address's
low byte, not of syntax.

**Why it happens:**
Alignment dependence in real 6502 code is almost always implicit — an artifact of how the
programmer laid the table out, not a declared constraint — so a detector built to check "is there
an alignment pragma" checks a signal that mostly doesn't exist in the input it needs to protect
against.

**How to avoid:**
Detect page-alignment dependence structurally rather than syntactically: flag any table whose
current base address's low byte is `$00` (or any other suspicious round value) together with an
indexing pattern that masks or wraps the index (`AND` with a page-aligned mask, `INX`/`INY` used
as a modulo-256 counter against that table), and flag it as a hazard **regardless of whether the
source contains an alignment directive today** — the current alignment is itself the fact to
preserve or explicitly break. Cross-check with the cycle-exact class (Pitfall 10): a page-crossing
indexed store changes cycle count when the base moves, independent of alignment.

**Warning signs:**
The hazard report's page-alignment class only fires on fixtures containing an explicit `!align`,
and returns clean on a table that merely *happens* to sit at a round address today with
index-masking logic that assumes it.

**Phase to address:**
The rebuildable-source phase (`BUILD-04`); the synthetic fixture (see Pitfall 16) must include the
implicit form, not only an explicit `!align`.

---

### Pitfall 10: Cycle-exact raster code symbolised correctly but timed wrong after movement

**What goes wrong:**
`BUILD-03` symbolises every branch and reference so code "can move." For raster-synchronised code
(an IRQ handler racing the beam, code gated on `$D012`/`$D011`), correct addressing after a move
does not imply correct *timing* after a move — moving code changes its absolute position relative
to a page boundary, which changes whether an indexed instruction pays a page-crossing cycle
penalty even when every address it touches is still symbolically correct. A rebuild can be
byte-plausible and reference-correct and still desync raster-critical code the moment anything
upstream of it in the same routine shifts by even one byte.

**Why it happens:**
Symbol resolution operates on addresses; cycle cost is a property of the *specific* encoded
instruction at its *specific* address (branch-across-page, indexed-store-across-page). Nothing in
a symbolic rebuild pipeline tracks cycle count as a first-class property, because until this
milestone nothing in the pipeline needed to.

**How to avoid:**
Do not attempt to make the hazard *detector* prove cycle-exactness statically — that is exactly
the kind of "automatic relocation or rebasing" the v0.5.0 requirements already rule out as an
unsolved general problem. Instead, make the hazard report's cycle-exact-raster class a **coarse,
conservative** flag: any code reachable from an IRQ vector, or any code that reads/writes
`$D012`/`$D011`/`$D019`/`$D01A` (raster/latch registers), is flagged hazard-class regardless of
whether it "looks" timing-sensitive by pattern, and the flag is a standing instruction to verify
by the only oracle capable of it — a live run, per `EQUIV-01`/`EQUIV-02`. Do not let a clean static
hazard report substitute for that live check; the whole reason `EQUIV-01`'s narrowed volatile mask
explicitly protects `$D011`/`$D015`/`$D018` from being hidden is that this class of regression is
only observable by actually running the rebuild.

**Warning signs:**
The cycle-exact-raster hazard class is implemented as a pattern match over specific idioms (e.g.
"looks for a `bit $d012`/loop") rather than a broad reachability flag from every IRQ entry point
and raster-register touch; `EQUIV-01`'s volatile mask is reused unchanged from the earlier
same-binary frame-exact-capture work without being re-narrowed for this milestone's purpose.

**Phase to address:**
The rebuildable-source phase (`BUILD-04`) for the conservative flag; the equivalence phase
(`EQUIV-01`/`EQUIV-02`) for the only check that can actually confirm timing survived a move.

---

### Pitfall 11: Split hi/lo address tables symbolised per-byte instead of as one structured type

**What goes wrong:**
A table pair like `lda tableLo,x` / `lda tableHi,x` combined at runtime into a 16-bit address gets
symbolised naively — each byte in `tableLo`/`tableHi` treated as an independent data value and
given its own auto-name — instead of being recognised as one split-pointer construct whose two
halves must move, re-export, and reassemble together. Rename or move one half without the other
and the rebuild still assembles (each half is independently valid `!byte` data) but computes wrong
addresses at runtime — a silent, "looks clean" wrongness of exactly the same shape as the
`TYPE SKIP` failure this project already measured on the retired `da65` route, which was explicitly
called out as **structurally unable to express a split-address table** (`da65`'s `RANGE TYPE`
vocabulary), which is why that route was abandoned.

**Why it happens:**
Byte-level typing is the natural default for a linear disassembler; recognising the *relationship*
between two separate ranges (same stride, same index register, combined by the caller into one
address) requires structural knowledge the store's twelve-member type vocabulary was deliberately
extended to carry (`STORE-01`'s four split layouts), but the export/symbolisation code has to
actually consult that structure rather than falling back to per-byte defaults.

**How to avoid:**
Export split-pointer tables as ONE named symbol pair with the low/high relationship preserved in
the generated ACME source (e.g. two parallel `!byte` blocks under names that make the pairing
explicit, generated from the store's split-layout type rather than from independent per-byte
labels). Verify with a reassembly-gate control that specifically moves one half of a split table
without the other and confirms the gate — or an explicit consistency check — catches it, rather
than trusting that "it reassembled" proves the pairing survived.

**Warning signs:**
The exporter's symbol-naming code has no special case for the store's split-layout types and
treats every `DATA`-typed range identically regardless of its narrower type.

**Phase to address:**
The decomposition phase (`DECOMP-03`, "every referenced non-hardware address is named") and the
rebuildable-source phase (`BUILD-01`/`BUILD-03`) together — this is exactly the seam between "the
store knows the structure" and "the exporter uses it."

---

### Pitfall 12: Fabricating a target symbol for a zero-page-indirect address that is genuinely path-dependent

**What goes wrong:**
`lda ($xx),y` / `sta ($xx,x)` targets a runtime-computed address held in a zero-page pointer. A
symbolisation pass that tries to resolve "the" target of every indirect access, in order to hit
`DECOMP-03`'s "every referenced non-hardware address is named" bar, invents a single plausible
target name for an access whose real target varies by call site or by program state — producing
a confident, wrong, and unmaintainable symbol (renaming it "fixes" only the call sites that
happened to share that runtime value).

**Why it happens:**
The completeness pressure from `DECOMP-01`/`DECOMP-03` ("nothing left Undefined", "every
referenced address named") pushes toward resolving everything, and a zero-page-indirect access
*looks* like it should resolve to something.

**How to avoid:**
Symbolise the **zero-page pointer itself** as a named variable (this is legitimate and always
correct — the pointer location doesn't move) and explicitly decline to synthesize a "resolved
target" symbol unless the pointer is provably constant across every observed and reachable write
site (checkable against the runtime evidence layer's per-address facts, not asserted from a single
code reading). This is the same "decline with a reason" discipline `AUTO-01`..`08` already
established for `$01` bank-state-dependent addresses — indirect-target resolution is the same
category of problem and should get the same treatment, not a separate, weaker one invented for
this milestone.

**Warning signs:**
Every `($xx),y` site in the decomposition ends up with a named target symbol, with zero declines
recorded, on a fixture that deliberately varies the pointer at runtime (the synthetic fixture
should include this case specifically to make the check possible).

**Phase to address:**
The decomposition phase (`DECOMP-03`).

---

### Pitfall 13: An address typed as data in one place and used as a jump target in another gets two conflicting symbols

**What goes wrong:**
The narrowest-range-wins paint index assigns one type per address, but a real program can use the
same address both as a table *entry value* referencing elsewhere and, separately, as something the
program also jumps to directly at another point (e.g. a default-case fallthrough that's also
listed in a dispatch table). If the exporter renders "data" ranges as literal bytes and separately
renders "code" cross-reference targets as labels without checking for this overlap, the generated
source ends up with a JMP/JSR to a raw hex address in one place and a `!byte`-only table entry in
another that should have referenced the *same* label — reassembles fine (both are individually
legal ACME), but a later human edit that moves the target breaks the un-symbolised reference
silently.

**Why it happens:**
Cross-reference resolution (`STORE-06`) and per-range typing (`STORE-01`) are two different
subsystems answering two different questions; nothing forces every cross-reference target found
by one to be checked against a label existing from the other before the exporter emits source.

**How to avoid:**
Before export, require every entry in the cross-reference union (`STORE-06`'s decoded code +
typed ADDRESS tables + stored non-derivable rows) to resolve to exactly one already-assigned
symbol name, and treat an unresolvable cross-reference (a target with no assigned symbol at
export time) as an export-time hard error, not a raw hex fallback. This makes the failure loud at
generation time instead of silent in the assembled bytes.

**Warning signs:**
The exporter contains a fallback branch that emits a literal hex address "when no symbol is
found," rather than refusing to export until the symbol exists.

**Phase to address:**
The rebuildable-source phase (`BUILD-01`/`BUILD-03`).

---

### Pitfall 14: A mid-instruction label's scope doesn't follow its instruction when the routine is split into a different file

**What goes wrong:**
This project already has a route for the `=*+$01` mid-instruction label case in the export path.
Decomposition-to-closure and file-splitting are new work layered on top of that: when a routine
containing a mid-instruction label is split into its own `!source`d file under a new zone, the
label's own zone/scope assignment must move with it. If the splitter derives file/zone membership
from one property (e.g. the store's scope field) while the mid-instruction label machinery derives
its own name from a different rule (`AUTO_NAME_PREFIX_RE`'s prefix set), the two can disagree about
which file a given label belongs in — producing a label reference across a zone boundary that
either fails to resolve (loud, safe) or, worse, silently resolves to a *different* same-named
label ACME's zone system permits to exist per-zone (quiet, wrong).

**Why it happens:**
The two mechanisms were built independently, in different phases, for different purposes, and
nothing in this milestone's plan yet forces them through one shared "what file/zone does this
address's label live in" resolver.

**How to avoid:**
Derive file/zone membership for every label — mid-instruction or otherwise — from exactly one
function, called by both the splitter and the label-naming code, and add a reassembly-gate control
that specifically exercises a mid-instruction label whose containing instruction sits at a
file/zone boundary the splitter chose.

**Warning signs:**
Two different modules independently compute "which output file does address X belong in."

**Phase to address:**
The rebuildable-source phase (`BUILD-01`, one file per scope).

---

### Pitfall 15: The synthetic fixture is written to match the hazard detector's own pattern list

**What goes wrong:**
The fixture carrying "all four `BUILD-04` hazard classes deliberately" is written by looking at
what the detector checks for, so every hazard instance in the fixture is the textbook idiom the
detector was literally built to recognise. The detector passes with 100% precision and recall —
against itself. This is the classic form of a test that validates its own assumptions rather than
the property it claims to check, and it is a documented risk this project has hit before in a
different instrument: the coverage census (`COV-01`) went through **four verification cycles**,
each finding the completeness number inflatable by a new shape, before a fifth round closed the
gap — evidence that "the detector and its own test fixture were designed together" is a real,
repeated failure mode in this codebase's own history, not a hypothetical.

**Why it happens:**
Writing a fixture and writing a detector are usually done by the same reasoning process in the
same short window, so both encode the same mental model of "what an RTS-trick / SMC / alignment /
raster hazard looks like" — any gap in that mental model is invisible to both at once.

**How to avoid:**
Apply the `COV-02` playbook (five planted defects, each caught by a NAMED measure, plus a
both-directions control) to the hazard detector specifically: for each of the four classes, plant
at least one instance in a *structurally different* form from the canonical idiom the detector's
implementation was written against (see Pitfalls 7, 8, 9, 10 for the specific variant per class),
and require the detector to either catch it via the general rule or explicitly report
`unclassified` rather than `clean`. Additionally, run the finished detector against the
already-committed measured fixtures that were captured for *unrelated* purposes and were never
written with this detector in mind — `fixtures/dxa/tracer.prg` (the 279-byte fixture already
proven to contain an RTS-trick dispatch and self-modifying code, per the dxa+Ghidra pivot record)
and `fixtures/ghidra/bank.prg` / `fixtures/export-asm/smc.prg`. Agreement with those independently-
sourced fixtures' known-correct classifications is real non-vacuity evidence; agreement with the
purpose-built fixture alone is not.

**Warning signs:**
The hazard detector's test suite contains only the new synthetic fixture; no plan cross-checks the
detector against `tracer.prg`/`bank.prg`/`smc.prg`, which this project already has committed and
already knows the ground truth for.

**Phase to address:**
The enabling-deliverable phase that builds the synthetic fixture, paired explicitly with the
rebuildable-source phase (`BUILD-04`) rather than sequenced strictly before it — write the fixture
and the cross-check against old fixtures together, not the fixture alone first.

---

### Pitfall 16: The fixture's "hazard classes" are structurally identical to each other, only reskinned

**What goes wrong:**
"All four hazard classes present" is satisfied by, say, one RTS-trick table, one SMC write, one
`!align`-marked table, and one raster-polling loop — each the single simplest possible instance of
its class, none combined with another, none in the implicit/computed form a real cracked game
would actually contain (see Pitfalls 9 and 10 for the implicit forms). The fixture technically
satisfies a checklist ("four classes present") while being no harder for the detector than four
independent unit tests, and the modifiability demonstration (`EQUIV-03`) never has to touch
hazard-adjacent code because the "behaviour to add/remove" was placed in ordinary, un-hazardous
code for convenience.

**Why it happens:**
A checklist framing ("does the fixture contain class 1, 2, 3, 4? yes/yes/yes/yes") is satisfied by
the shallowest possible instance of each, and nobody re-reads the fixture asking whether its
*presence* actually stresses the pipeline being validated.

**How to avoid:**
Require the fixture's design doc to state, for each hazard class, which specific *variant* it
uses (canonical vs. implicit/computed) and require at least one class to be combined with another
in the same routine (e.g. a page-aligned table accessed through an RTS-trick dispatch). Route
`EQUIV-03`'s modifiability demonstration's added/removed behaviour through code adjacent to at
least one hazard, not through a freestanding routine untouched by decomposition's harder cases —
otherwise the modifiability proof only shows that ACME itself still works, which was never in
question.

**Warning signs:**
The fixture design lists four hazard "instances" with no cross-reference to which is canonical vs.
implicit; `EQUIV-03`'s behaviour change touches a routine with no hazard annotations anywhere near
it.

**Phase to address:**
The enabling-deliverable (synthetic-fixture) phase, reviewed against `BUILD-04`'s and `EQUIV-03`'s
success criteria before the fixture is declared final.

---

### Pitfall 17: "Behavioural equivalence demonstrated" without ever observing the check fail first

**What goes wrong:**
`EQUIV-02` is satisfied by a transcript showing the original and the rebuild producing matching
output in VICE. Nothing in that transcript proves the comparison mechanism (`compare.mjs` in
original-versus-different-binary mode — explicitly a mode it has **never been run in**, per the
v0.5.0 base text) is actually capable of detecting a real difference; a comparison tool that is
silently vacuous (e.g. its volatile mask over-masks, or its checkpoint set never actually reaches
the code that changed) would produce an identical-looking "match" transcript whether or not the
rebuild is correct.

**Why it happens:**
It's natural to build the comparison, run it once, see it pass, and stop — passing is the goal,
so a passing run looks like done. Proving the harness *can* fail requires deliberately building
and running a broken case, which feels like extra, unrewarded work.

**How to avoid:**
This project's own stated preference is explicit and should be treated as a hard requirement, not
a nicety: observe the control go RED before trusting it green. Before accepting `EQUIV-02`'s
"match" transcript as evidence, commit a transcript of the *same* comparison run against a
deliberately-broken rebuild (e.g., before the hazard report's fixes are applied, or with one
symbol intentionally left unresolved) and show `compare.mjs` actually reports the difference —
specifically exercising the narrowed volatile mask requirement from `EQUIV-01`
(a real `$D020`/`$D015`/`$D018` regression must not be maskable). Only then is the subsequent
"match" transcript meaningful.

**Warning signs:**
`EQUIV-02`'s deliverable is a single transcript showing a pass, with no paired transcript anywhere
in the phase's evidence showing the same mechanism catching an injected difference.

**Phase to address:**
The equivalence-and-modifiability phase (`EQUIV-01`/`EQUIV-02`), and specifically before
`EQUIV-01`'s narrowed volatile mask is accepted as correct.

---

### Pitfall 18: Modifiability proven with a trivial, decoupled change that never touches decomposed/rebuilt code

**What goes wrong:**
`EQUIV-03` is satisfied by changing something maximally easy and already fully symbolised — a
border-colour enum value, already resolved to a clean `#VIC_BORDER_...` constant by the existing
enum-generation heuristics — rather than a change routed through code that decomposition and
symbolisation actually had to work hard on (a moved routine, a hazard-adjacent range, a split
table). The demonstration proves ACME assembles a one-line edit, which was never in doubt; it does
not prove this milestone's actual deliverable (rebuildable, decomposed, moved source) is
modifiable in the way that matters.

**Why it happens:**
An easy, guaranteed-to-work change is the path of least resistance to close out a checklist item,
especially under schedule pressure at the end of a milestone.

**How to avoid:**
Choose the removed/added behaviour specifically so it requires touching at least one range the
hazard report flagged (see Pitfall 16) or at least one range that was moved for `BUILD-03`'s
symbolisation proof — e.g., changing the *destination* of an RTS-trick dispatch entry, or the
condition gating a raster-synced effect. That is the only choice that actually stresses
"modifiable" rather than "ACME still works."

**Warning signs:**
The behaviour changed in `EQUIV-03` has no cross-reference to any entry in `BUILD-04`'s hazard
report or any moved range from `BUILD-01`/`BUILD-03`.

**Phase to address:**
The equivalence-and-modifiability phase (`EQUIV-03`).

---

### Pitfall 19: Zero-page labels declared out of file order silently degrade to absolute addressing

**What goes wrong:**
ACME requires zero-page labels to be visible to the assembler by the time it first encounters a
zero-page-addressable use of them; if the multi-file generator emits the zero-page constant
definitions into a file that is `!source`d *after* a file that uses one in a zero-page addressing
mode, ACME does not error — it falls back to absolute (3-byte) addressing for that instruction
instead of zero-page (2-byte) addressing. The rebuild still assembles and the program still runs
correctly (the semantics are identical), but silently grows in size and, more importantly for this
milestone, silently changes the **cycle count** of every affected instruction — which is exactly
the kind of change `EQUIV-01`'s narrowed volatile mask and the cycle-exact-raster hazard class
(Pitfall 10) exist to catch, but only if the comparison is actually run and the mask doesn't hide
it.

**Why it happens:**
The generator's natural file-ordering rule is derived from the annotation store's scopes (one file
per scope, per `BUILD-01`), which has no inherent relationship to "which file must be assembled
first for zero-page visibility" — a purely ACME-toolchain constraint the store's scoping model was
never designed around.

**How to avoid:**
Emit all zero-page constant/variable definitions the export touches into a dedicated file that is
always `!source`d **first**, regardless of which annotation-store scope they logically belong to,
and add a reassembly-gate control that specifically checks the assembled instruction encoding
length for a known zero-page reference (2 bytes, not 3) rather than only checking that assembly
succeeded — encoding-length drift is exactly the kind of thing that "reassembles cleanly" does not
catch (see Pitfall 1's general lesson applied to this specific case).

**Warning signs:**
The generator's `!source` ordering is derived purely from the store's scope list or directory
listing order, with no special-casing for zero-page declarations; the `.rep` listing for a known
zero-page symbol shows a 3-byte encoding.

**Phase to address:**
The rebuildable-source phase (`BUILD-01`).

---

### Pitfall 20: Subzone label isolation silently orphans a reference that used to be an implicit local label

**What goes wrong:**
ACME's zone system nests, but a subzone does **not** inherit the local labels of an enclosing
zone — it is closer to an "interrupting zone" than a lexical child scope. A single-file decode
that used bare local labels (relying on the file's one implicit "Zone `<untitled>`", visible in
this project's own diagnostic output) works today. Once decomposition splits that file into
multiple `!source`d files each opening its own zone (per `BUILD-01`), any reference across what
used to be an implicit single-zone boundary either fails to resolve (loud) or, if both zones
happen to define a same-named local label independently, silently resolves to the *wrong* same-
named label in the referencing zone rather than the one originally intended (quiet, wrong — the
same class of failure as Pitfall 14's mid-instruction case, but for ordinary local labels).

**Why it happens:**
Splitting a decode into per-scope files is a natural, mechanical transformation from the store's
scope model, but "does this label reference cross a zone boundary" is an ACME-specific fact the
store's scope model doesn't track at all.

**How to avoid:**
Before splitting, classify every label as **global** (referenced across scopes; promote to
`!zone`-global / a project-wide name, matching this project's own eleven-member
`AUTO_NAME_PREFIX_RE` naming convention so global names stay visually distinguishable) or
genuinely **scope-local** (referenced only within its own scope's file), and do this classification
from the cross-reference union (`STORE-06`) rather than from label naming convention alone. Never
let a cross-scope reference remain a bare local label after the split.

**Warning signs:**
The generator emits `!source` files whose local labels are given no explicit global/local
disposition — every label is emitted the same way regardless of whether `STORE-06`'s
cross-reference data shows it referenced from another scope's file.

**Phase to address:**
The rebuildable-source phase (`BUILD-01`/`BUILD-03`).

---

### Pitfall 21: Non-deterministic file ordering makes every re-export an unreviewable full-tree diff

**What goes wrong:**
Regenerating the multi-file export after a single label rename or a single comment edit produces
a diff touching every generated file, because file splitting, zone assignment, and per-file label
ordering are all re-derived together from a computation whose ordering isn't pinned (e.g.
insertion order into an intermediate map, or a directory listing). This defeats human review of
the rebuild — exactly the property `DECOMP-02`'s purpose-comment requirement and this milestone's
whole "rebuildable, human-modifiable source" goal depend on — and makes it impossible to tell a
real hazard regression apart from export-generator noise in a code review.

**Why it happens:**
It's easy to derive file/label ordering from whatever order a `Map` or SQL query happens to
return rows in, which is not guaranteed stable across two otherwise-identical exports.

**How to avoid:**
Apply this project's own standing convention for generated artifacts
(`ENGINEERING_RULES.md` §11 — generator is authoritative, drift-checked, minimal expected delta)
to the multi-file export specifically: order files and labels deterministically by address (not
insertion order or directory listing), and add a drift guard that re-exports from an unchanged
store and asserts byte-identical output — the same scratch-generation-plus-byte-diff pattern
already used for `docs/tool-support.md` and other generated documentation in this codebase.

**Warning signs:**
Two consecutive exports from the same unmodified store produce a non-empty diff; no drift guard
exists asserting export determinism.

**Phase to address:**
The rebuildable-source phase (`BUILD-01`).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Reassembly gate checks only same-address round trip, never a moved build | Ships `BUILD-06` faster | `BUILD-03`'s "code can move" claim is unverified; a real move can silently break at the first real use | Never as the final state; acceptable as an interim milestone-internal checkpoint if explicitly labelled partial |
| Hazard detector ships with "clean" as its only outcome (no `unclassified`) | Simpler report shape, easier UI | A miss reads as a guarantee; false confidence is explicitly worse than no detector per this milestone's own framing | Never |
| Zero-page declarations emitted in scope order, not forced-first order | No special-casing needed in the generator | Silent absolute-addressing fallback, size/cycle drift invisible to the reassembly gate | Never once any hazard class references cycle timing; acceptable only for a fixture proven to contain zero zero-page-addressed instructions |
| Modifiability demo (`EQUIV-03`) uses an easy, already-symbolised constant | Fast to demonstrate, low risk of the demo itself failing | Proves ACME works, not that decomposition/rebuild is modifiable — the actual claim goes unverified | Never as the sole modifiability evidence; fine as an additional, easy first example alongside a hazard-adjacent one |
| Fixture and detector for `BUILD-04` written in the same pass by the same author | Fast to build, immediately "passes" | Self-validating; this project already paid this exact cost once on `COV-01` (four verification rounds) | Never — cross-check against `tracer.prg`/`bank.prg`/`smc.prg` from the start |

## Integration Gotchas

Specific to wiring the new export path against the existing store, ACME oracle, host-tool seam,
and runtime evidence layer.

| Integration | Common Mistake | Correct Approach |
|--------------|-----------------|-------------------|
| Multi-file export vs. `.annostore`'s narrowest-range-wins index | Deriving file/scope membership from a fresh re-scan of ranges instead of the store's own paint index, producing a different split than what `anno_*` tools would report for the same address | Derive every file/scope decision from the same paint-index queries the rest of the `anno_*` surface uses — one source of truth, not a parallel re-derivation |
| Reassembly gate vs. `acme-verify.ts`'s existing byte-diff oracle | Building a second, independent verify path for the rebuild gate instead of extending the existing test-only oracle module | Extend `acme-verify.ts`'s three-outcome (`ok`/`failed`/`skipped`) design; keep it test-only and absent from the published package exactly as today, since `BUILD-06`'s gate is a CI/dev-time gate, not a shipped runtime verb |
| Host-tool seam (`acme`, `dxa`, `analyzeHeadless`) vs. a new "reassemble the export" verb | Adding a fourth `spawnSync` site for the rebuild's own ACME invocation, bypassing the typed `host_tool` control op | Route the rebuild's ACME invocation through the same `host_tool` op as the existing `acme-build` skill; run `scripts/check-no-skill-external-spawn.mjs` against any new script before considering the phase done |
| Runtime evidence layer vs. decomposition completeness | Treating `DECOMP-01`'s byte census and `anno_evid_disagreements` as two unrelated reports, never cross-checked | Query disagreements as part of the decomposition completeness gate on any fixture that has been executed; a disagreement is a decomposition defect, not a separate finding |
| Provenance verdict (`c64-provenance-diff`) vs. export path | Re-implementing "which ranges are cracker patches" inside the exporter instead of reading `c64-provenance-diff`'s existing verdict | `BUILD-05` carries the existing verdict to point of use (comments/metadata in the export); it must not re-derive provenance independently, and must never use the verdict to drop a range (`BUILD-07`) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Hazard report lists every flagged range with no severity/confidence distinction | Operator can't tell "definitely unsafe to move" from "possibly fine, low-confidence pattern match" and either ignores the whole report or blocks on everything | Carry each finding's detection mechanism and confidence alongside the range, so the operator (who owns the "what gets reverse-engineered" decision per this milestone's owner-decided scoping) can actually decide rather than face an undifferentiated wall of flags |
| Provenance verdict surfaced but the export defaults to including everything with no visual distinction | Operator can't easily see, at point of use, which lines the tool is uncertain are original code | Render the provenance verdict inline (a comment or metadata annotation per this milestone's `BUILD-05` rewording), not only in a separate report the operator has to cross-reference by address |

## "Looks Done But Isn't" Checklist

- [ ] **Reassembly gate (`BUILD-06`):** Often missing a movement-mode run — verify it has actually
  assembled a build with at least one relocated symbol, not only a same-address round trip.
- [ ] **Hazard report (`BUILD-04`):** Often missing an `unclassified`/low-confidence outcome —
  verify the detector's output type isn't boolean clean/unclean with no third state.
- [ ] **Lossless export (`BUILD-07`):** Often missing the planted-heuristic-would-drop-this control
  — verify a specific range that a "helpful" filter would exclude survives export.
- [ ] **Decomposition completeness (`DECOMP-01`):** Often missing a cross-check against
  `anno_evid_disagreements` — verify the census isn't purely byte-derived with the runtime
  evidence layer never consulted.
- [ ] **Symbol resolution (`BUILD-03`):** Often missing split hi/lo table handling — verify at
  least one split-address table round-trips as a pair, not as independent bytes.
- [ ] **Behavioural equivalence (`EQUIV-02`):** Often missing a paired failing-case transcript —
  verify a committed transcript exists showing the SAME comparison mechanism catching a
  deliberately broken rebuild, not only the passing case.
- [ ] **Modifiability (`EQUIV-03`):** Often missing a hazard-adjacent target — verify the
  added/removed behaviour touches code the hazard report or the movement work actually flagged or
  moved, not an isolated easy routine.
- [ ] **Synthetic fixture:** Often missing variant coverage — verify each of the four hazard
  classes appears in at least one non-canonical (implicit/computed/combined) form, and that the
  fixture's ground truth is cross-checked against `tracer.prg`/`bank.prg`/`smc.prg`, not only
  self-consistent.
- [ ] **Multi-file export determinism:** Often missing a drift guard — verify two exports from an
  unchanged store are byte-identical.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Reassembly gate found to be exit-status-derived after other phases already depend on "green" | HIGH | Freeze consumers, retrofit the byte-diff oracle pattern from `acme-verify.ts`, re-run every prior "passing" rebuild through the corrected gate before trusting any of them |
| Hazard detector found to miss a real variant after the synthetic fixture was declared final | MEDIUM | Add the missed variant to the fixture (or a sibling fixture), re-run detection, and re-open `BUILD-06`'s gate history for anything moved on the strength of the earlier, incomplete report |
| Multi-file export found non-deterministic after several manual edits already made to generated files | MEDIUM | Re-derive a canonical ordering, regenerate once, and diff by hand against the manually-edited files to recover any edits before the drift guard is turned on |
| Zero-page ordering bug found after `EQUIV-01` already ran and reported "match" under a mask that hid the cycle drift | HIGH | Re-run `EQUIV-01`/`EQUIV-02` with the corrected file ordering and the narrowed mask from Pitfall 17's red-first control; do not trust the earlier "match" transcript |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1, 2 (gate vacuity: exit status, stale path) | Rebuildable-source / reassembly-gate phase (`BUILD-06`) | Gate observed failing on a planted wrong-byte rebuild and on a stale-output-path scenario |
| 3 (movement never exercised) | Reassembly-gate phase (`BUILD-06`) | At least one CI/test run reassembles a build with a symbol relocated from its original address |
| 4 (scope-excluded ranges) | Reassembly-gate phase (`BUILD-06`), shared with `BUILD-07` | Planted heuristic-would-drop-this control passes |
| 5 (bank-state misclassification) | Decomposition phase (`DECOMP-01`..`03`) | Fixture with a bank-dependent range shows an explicit decline, not a guess |
| 6 (static reachability misses runtime-observed code) | Decomposition phase (`DECOMP-01`) | `anno_evid_disagreements` queried and zero unresolved disagreements remain on the executed fixture |
| 7, 8, 9, 10 (hazard classes: RTS-trick, SMC, alignment, raster) | Rebuildable-source phase (`BUILD-04`) | Each class observed catching a non-canonical planted variant, not only the textbook idiom |
| 11 (split hi/lo tables) | Decomposition + rebuildable-source phases (`DECOMP-03`, `BUILD-01`/`03`) | Moving one half of a split table without the other is caught |
| 12 (fabricated indirect targets) | Decomposition phase (`DECOMP-03`) | Fixture with a runtime-varying ZP pointer produces an explicit decline |
| 13 (data/code target conflict) | Rebuildable-source phase (`BUILD-01`/`03`) | Export refuses rather than emits a raw-hex fallback for an unresolved cross-reference |
| 14, 20 (zone/scope label breakage) | Rebuildable-source phase (`BUILD-01`) | Cross-zone reference resolves correctly after the split; single shared resolver used by both splitter and label-naming code |
| 15, 16 (fixture written to match detector; shallow variants) | Enabling-deliverable (synthetic-fixture) phase, paired with `BUILD-04` | Detector cross-checked against `tracer.prg`/`bank.prg`/`smc.prg`; fixture design doc states variant per class |
| 17 (equivalence never observed failing) | Equivalence phase (`EQUIV-01`/`02`) | Paired red/green transcripts exist for the same comparison mechanism |
| 18 (trivial modifiability demo) | Equivalence phase (`EQUIV-03`) | Changed behaviour cross-referenced to a hazard-report entry or a moved range |
| 19 (zero-page ordering) | Rebuildable-source phase (`BUILD-01`) | `.rep` listing shows correct (2-byte) encoding length for a known zero-page reference |
| 21 (non-deterministic export) | Rebuildable-source phase (`BUILD-01`) | Two exports from an unchanged store are byte-identical (drift guard) |

## Sources

- **This repository, measured/committed (HIGH confidence):** `.planning/PROJECT.md` §"Out of
  Scope" (the `da65`/ca65/ld65 anti-feature, five of six grounds measured, `TYPE SKIP` collapse to
  a wrong binary), §"Phase 20-22... Cut on 2026-08-25" (the dxa+Ghidra pivot measurement on the
  279-byte fixture: RTS-trick dispatch, split pointer tables, self-modifying code, `COMPUTED_JUMP`
  resolution in the decompiler layer only), §Validated entries for `STORE-01`/`STORE-04`/
  `STORE-06`/`AUTO-01`..`08`/`EVID-01`..`06`/`PROOF-01`..`04`/`EXPORT-01`..`03`/`GHID-01`..`05`/
  `OPC-01`..`04`, §"Active" (v1.0.0 scoping, `BUILD-05`/`BUILD-07` rewording, the synthetic-fixture
  enabling deliverable); `.planning/milestones/v0.5.0-REQUIREMENTS.md` (`DECOMP-*`/`BUILD-*`/
  `EQUIV-*` base text, "Out of Scope" table); `.planning/ENGINEERING_RULES.md` §6 (Non-Vacuous
  Verification), §7 (Independent Oracle Rule), §11 (Generated Artifacts); `src/mcp/vice/
  acme-verify.ts` header comment (the recorded false-pass mechanisms and the three-outcome verdict
  design); `src/skills/acme-build/SKILL.md` (project's own ACME invocation conventions, `-I`
  workspace-relative resolution, `AUTO_NAME_PREFIX_RE`'s eleven-prefix naming convention).
- **External, general 6502/ACME domain corroboration (MEDIUM confidence, dated 2026-09):**
  [ACME QuickRef / zone and pseudopc semantics](https://github.com/martinpiper/ACME/blob/master/docs/QuickRef.txt),
  [A Tour of 6502 Cross-Assemblers](https://bumbershootsoft.wordpress.com/2016/01/31/a-tour-of-6502-cross-assemblers/)
  (zero-page label declaration order affecting zero-page vs. absolute addressing; subzones not
  inheriting an enclosing zone's local labels), [On Disassembly](https://6502disassembly.com/on-disassembly.html)
  and [About Disassembly — SourceGen Tutorial](https://6502bench.com/sgtutorial/about-disasm.html)
  (code/data separation as a fundamentally hard problem on 6502, jump tables and alignment bytes
  causing silent disassembly failure), [The Lost Art of Assembly Programming: Self-modifying Code](https://tibleiz.net/blog/2024-04-30-self-modifying-code.html)
  and [Disassembly of Executable Code Revisited](https://www.academia.edu/8582967/Disassembly_of_Executable_Code_Revisited)
  (self-modifying code requiring re-analysis on write, not merely detection at read time).

---
*Pitfalls research for: c64-re-tools v1.0.0 — the rebuild half*
*Researched: 2026-09-10*
