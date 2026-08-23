# Pitfalls Research

**Domain:** Binary-to-rebuildable-source pipeline for a mature C64 reverse-engineering
toolchain (v0.5.0 "The rebuild half — absorbed playbooks, modifiable source")
**Researched:** 2026-08-23
**Confidence:** HIGH for 6502/C64 hardware facts, this project's own documented incidents,
and regenerator2000 0.9.20 source behavior (all verified directly against the installed
crate this session). MEDIUM for the persistent-session daemon's exact failure surface,
since that architecture does not exist yet — those pitfalls are inferred from this
project's own broker precedent plus regenerator2000's confirmed process model, not
observed live.

This document assumes the reader has `.planning/PROJECT.md`, `CLAUDE.md`,
`.planning/RETROSPECTIVE.md`, `docs/phase9-regenerator2000-probe-findings.md`, and
`src/skills/c64-ram-capture/{SKILL.md,scripts/compare.mjs}` open. It does not restate
their content; it extends it.

## Critical Pitfalls

### Pitfall 1: Data references to code addresses that no tool marks as addresses

**What goes wrong:**
Every `JSR`/`JMP` operand is trivially symbolisable once the target is a known label.
The hazard is the opposite case: a 16-bit value that *is* a code address but sits inside
a data byte stream — a pointer stored in a table, an address pushed by hand, a value
computed as `base + offset` at runtime — where nothing marks the bytes as `Address`
type. regenerator2000's own cross-reference builder only resolves `JMP ($xxxx)` when the
*pointer location itself* is already typed `BlockType::Address`
(`analyzer.rs:504-511`, verified against the installed 0.9.20 source this session); an
untyped pointer is invisible to it. After relocation, every address baked into an
unmarked data byte is stale and nothing reassembles wrong — it just silently jumps or
reads garbage at runtime.

**Why it happens:**
"The disassembler symbolised it" and "the value is symbol-safe" are different claims.
Regenerator2000's auto-analysis only symbolises what its own heuristics recognize as
address-shaped in a place it already expects an address (an instruction operand, or a
block a human has already typed `Address`/`LoHiAddress`/`HiLoAddress`). A raw `!byte`
pair that happens to decode to a valid in-range 16-bit value is never promoted
automatically.

**How to avoid:**
Before allowing any region to be declared relocatable, scan every `DataByte`/`DataWord`
block for byte-pairs that decode to an in-range address AND have at least one incoming
cross-reference elsewhere in the binary (a strong signal it is read as a pointer, not
coincidentally address-shaped). Require an explicit human/agent decision — mark it
`Address`-typed and symbolise it, or record it as a confirmed non-pointer — before the
byte range it lives in is treated as safe to move.

**Warning signs:**
ACME reassembles clean (every *known* label resolves) but behavior diverges after a
purely cosmetic file reorganization — the tell that a value the source treats as a
number was actually consumed as an address at runtime.

**Phase to address:**
The relocation-hazard-report phase (before "every branch, JSR/JMP and data reference
goes through a symbol" is claimed done).

---

### Pitfall 2: Indexed jump tables (`lda table,x` / split lo-hi dispatch) are NOT auto-resolved

**What goes wrong:**
Two extremely common C64 dispatch idioms are structurally invisible to
regenerator2000's own jump-table follower:

- **Operand-patch dispatch:** `ldx state / lda joblo,x / sta $c001 / lda jobhi,x / sta
  $c002 / jmp $c000` — the JMP target is *computed and written* before the JMP executes.
  This is simultaneously a jump table *and* self-modifying code (Pitfall 3).
- **RTS-trick dispatch:** `lda hi,x / pha / lda lo,x / pha / rts` — the table stores each
  target **minus one**, because RTS pops PC and adds 1. Relocating without accounting for
  the bias produces a symbol that is byte-plausible and reassembles clean, but executes
  one byte into the wrong instruction at runtime.

Verified directly against 0.9.20's `follow_indirect_jumps`
(`regenerator2000-core-0.9.20/src/analyzer.rs:445-528`): it resolves exactly one thing —
a literal `JMP ($xxxx)` opcode (`0x6C`) whose 16-bit pointer location is already typed
`Address`, reading **one** fixed target. It has no code path that walks an N-entry table
indexed by a register, and no way to discover N (table length is implicit, usually
bounded by a compare/mask instruction elsewhere, never a sentinel value).

**Why especially dangerous to relocate:**
The table's entry count is never stated anywhere in the binary. Moving any one of the N
target routines, or moving the table itself, requires updating *every* entry by hand;
missing one is silent until that specific index is exercised at runtime. Because the
tool provides zero automatic enumeration, "I symbolised the jump table" is a claim that
must be checked against the actual index range (found from the bounding compare), not
against what the tool auto-labeled.

**How to avoid:**
Treat every `lda table,x` immediately followed by (a) a store into an instruction
operand, or (b) two PLA-then-RTS, as a jump-table candidate requiring manual boundary
determination from the bounding compare/mask instruction. For RTS-trick tables, always
record the target as `entry_value + 1` in the relocation-hazard report and say so
explicitly — do not let anyone treat the raw table bytes as ordinary pointers. Mark the
whole table `LoHiAddress`/`HiLoAddress` (the block types 0.9.20 already ships for exactly
this idiom) only after every entry is accounted for, not after the first one is found.

**Warning signs:**
Reassembly succeeds and the program boots, but one specific state/enemy-type/menu-item
is glitched or crashes — the signature of exactly one un-updated table entry.

**Phase to address:**
Relocation-hazard-report phase for detection and enumeration; the functional-equivalence
phase must specifically exercise every dispatch index, not just the default path, since a
byte-level diff of the table itself won't show a wrong-by-one RTS-trick entry unless the
affected branch actually runs.

---

### Pitfall 3: Self-modifying code defeats symbolisation by definition, and nothing detects it automatically

**What goes wrong:**
Common idioms: patching an instruction's operand byte at runtime (`sta $c001` where
`$c001` is another instruction's low operand byte — loop-unroll speed hacks,
self-relocating loaders, IRQ-handler polymorphism); patching a JMP/JSR target (Pitfall
2's operand-patch variant); an `INC`/`DEC` on an address that is itself an opcode or
operand byte. Verified: `regenerator2000-core-0.9.20`'s entire source tree has **zero**
matches for `self-modif`/`smc` — its analyzer has no SMC detection or flagging of any
kind.

**Why it happens (and why it defeats symbolisation):**
A symbol names *an address*, not *a moment*. Self-modifying code means the byte at that
address has two identities depending on when you look — an instruction, and a mutable
data cell written by something else. Disassembling it once produces a single fixed
reading that is a lie about at least one point in execution. Relocating the code changes
the physical distance between the writer and the write target; if the writer computes its
target as a literal absolute address rather than via a relocatable label, or if the two
are separated across source files without preserving their relationship, the patch either
misses its mark or corrupts an unrelated byte after the move.

**How to avoid:**
This is mechanically detectable even though regenerator2000 does not do it: query every
`STA`/`STX`/`STY`/`INC`/`DEC` instruction's absolute target address and check whether that
address falls inside a block currently typed `Code` (this is a straightforward script
against the annotation store's own cross-reference/block-type data — build it as a
first-class detector, not a manual review step). Every hit must be pulled into an
explicitly labeled "patch point," symbolised so the writer targets a label rather than a
literal address, and — where the milestone's modifiability goal doesn't require
preserving the exact patching mechanism — considered for rewriting to a variable/indirect
form that survives relocation cleanly.

**Warning signs:**
A routine behaves correctly on its first invocation after reset but wrong on repeats (or
the reverse) — the classic signature of an unrestored patched operand or a
self-decrementing counter embedded directly in an instruction stream.

**Phase to address:**
Relocation-hazard-report phase; needs its own detector built and run before any
region is declared move-safe, not discovered by inspection.

---

### Pitfall 4: Page-alignment and cycle-timing dependence are invisible to the assembler

**What goes wrong, three distinct mechanisms:**

1. **Table page-alignment.** Some tables are deliberately kept within one page (so a
   loop's index math can't wrap awkwardly) or page-aligned so only the high byte needs
   patching (halving a hot patch's instruction count). Relocating the table into a new
   source file with no explicit `!align`/origin control silently drops this property —
   ACME has no way to know it mattered, and the code that assumed high-byte-only patching
   stays wrong forever, corrupting an adjacent byte at runtime with no assembly error.
2. **Branch range (`bne`/`beq`/etc., -128..+127 signed byte from the instruction after
   the branch).** Reordering routines into separate files changes inter-routine
   distances. ACME will refuse to assemble an out-of-range branch — a *loud*, safe
   failure — but a branch-plus-trampoline pair already present in the original code to
   work around this exact limit is easy to remove incorrectly when "cleaning up" during
   the rebuild.
3. **Extra-cycle-on-page-cross.** Indexed addressing (`lda $c0f0,x`, `lda ($f0),y`) costs
   one extra cycle when the effective address's high byte differs from the base's high
   byte. Cycle-exact code is written assuming a *fixed* number of these crossings per
   iteration. Relocating a table changes its base address and therefore which indices
   cross a page — with **zero change to instruction count or source bytes** — silently
   adding or removing a cycle from a hot loop.

**Why it happens:**
None of the three is visible to ACME, to a symbol-resolution check, or to a byte-level
reassembly diff. They are properties of *where in the 64K address space* something ends
up, not properties of the source text.

**How to avoid:**
Record page-alignment and addressing-mode-per-table requirements as first-class entries
in the relocation-hazard report, keyed to the specific tables/buffers involved. Any table
feeding a cycle-exact loop must either be pinned to its original page or have its
page-crossing pattern re-proven for every index used after the move. Verify post-move
with a live VICE run comparing raster/CIA timing (Pitfall 5), not just a memory diff —
this class of bug is invisible to `compare.mjs` by construction, since final RAM content
can be identical while *when* it got written differs.

**Warning signs:**
A visual glitch (flicker line, mistimed color split) appears after a rebuild that touched
files unrelated to graphics, with a clean assembly and an unremarkable instruction-count
diff.

**Phase to address:**
Relocation-hazard-report phase for detection; the functional-equivalence-in-VICE phase
for the only check that can actually catch it (a timing property, not a byte property).

---

### Pitfall 5: Cycle-exact raster code — correctness by every static measure, wrong on screen

**What goes wrong:**
Stable raster IRQs depend on an exact, known cycle count from interrupt entry through the
`$D012`/`$D011` bit-8 comparison-and-adjustment logic, through any NOP-slide used to line
up a border/background write to a specific horizontal position, through sprite
multiplexing tables that must complete inside one scanline's budget. Every hazard above
(branch range, SMC, page-crossing) compounds here: one byte inserted *anywhere* in the
interrupt-to-effect chain — even in an unrelated routine on a different page, if it
shifts something's page alignment — can change the cycle count enough to roll the raster
line, shift a color split by a pixel column, or desync the sprite multiplexer.

**Why it happens — and why "one byte breaks the display, not just the layout":**
ACME has no cycle-accounting mode at all. A relocation can be 100% correct by symbol
resolution, address correctness, and opcode equivalence, and still be functionally wrong
to a human watching the screen, because none of those measures says anything about *when*
an instruction executes relative to the raster beam.

**How to avoid:**
Treat the entire interrupt-entry-to-effect chain (register save, comparison logic, NOP
padding, the write itself) as one atomic, page-and-cycle-pinned unit in the
relocation-hazard report. "One file per subsystem" is fine for organization; the
constraint is on not changing anything that shifts the chain's trigger-to-effect cycle
count, regardless of which file it lives in. This cannot be verified by reassembly or by
a RAM diff at a single checkpoint — it requires observing `$D012`/border color/screen
content across a live VICE run.

**Warning signs:**
Any visual difference observed only via video capture or a live `$D012` trace, with the
underlying RAM comparison (per `compare.mjs`) reporting PASS — the two checks answer
different questions and a PASS on one says nothing about the other.

**Phase to address:**
Relocation-hazard-report phase for flagging cycle-exact chains by name; the
functional-equivalence-in-VICE phase is the *only* place that can actually detect a
regression here.

---

### Pitfall 6: Illegal-opcode handling that reassembles clean but silently forecloses editability

**What goes wrong:**
This project's own disassembler already round-trips 221/256 opcodes through real ACME
0.97 — that is not the risk here. The risk is specific to the **rebuild** pipeline and
regenerator2000's own confirmed defect: a `.regen2000proj` bootstrapped without
`settings.use_illegal_opcodes = true` degrades every real illegal opcode to a raw
`!byte $xx ; Invalid or partial instruction` fallback. This still reassembles
byte-identical (nothing fails), which means the degradation is **silent** — the export
looks complete and passes `--verify`, while every illegal-opcode instruction the rebuild
was supposed to make editable is now an opaque byte blob instead. For a milestone whose
value proposition is "modifiable source," this is the failure mode that costs the most
without tripping any existing gate.

**Why it happens:**
Auto-analysis never flips the setting (confirmed false by direct testing in the Phase 9
probe); it must be forced explicitly, and that forcing was previously scoped only to the
original project-synthesis path (`R2000-09`'s synthesiser), not to every project a
persistent session might open or re-open for this milestone's rebuild work.

**How to avoid:**
Force `use_illegal_opcodes: true` on every regenerator2000 project touched by this
milestone's pipeline, not only ones freshly synthesised — verify the setting at the start
of any persistent session that will annotate or export code, the same way the existing
synthesiser already forces it at creation time. Separately, define an explicit convention
for the ~35 opcodes this project's own disassembler still cannot express as ACME
mnemonics, so a `!byte` fallback inside an otherwise-named region has a documented status
(neither silently "covered" nor silently "Undefined") for the coverage metric in
Pitfall/Section 6. Name VICE's own illegal-opcode emulation as the explicit oracle for any
equivalence claim that depends on one of the less-standardized illegal opcodes
(`ANE`/`XAA`-class instructions have documented cross-implementation variance) — do not
imply hardware-accuracy beyond what was actually checked.

**Warning signs:**
`--export_asm` output containing `!byte` fallback lines inside an otherwise densely
named/labeled region — the signature of a silently-degraded illegal opcode.

**Phase to address:**
The annotate/export pipeline phase (force the setting on every session, not just at
synthesis) and the coverage-measurement phase (define the fallback convention explicitly).

---

### Pitfall 7: Overlapping instruction streams and code/data interleaving without a boundary marker

**What goes wrong:**
Two related hazards: (a) literal data (a sprite, a table) placed immediately after code
with the boundary implied only by the code's own fall-through/RTS, so a linear or
recursive-descent disassembler mis-classifies the data as more code or vice versa unless
a human sets the block boundary explicitly; (b) genuinely overlapping instruction streams
— the same bytes decoding to two different instruction sequences depending on entry
point — which is common in packers, self-decrypting loaders, and cracker-added
anti-disassembly tricks, and is exactly the class of thing `c64-provenance-diff` already
exists to identify as non-original.

**How often, and what to do:**
Overlap load-bearing for *original* game logic is rare but not impossible; it is far more
common in loader/cracktro regions this milestone's own provenance-awareness requirement
should already exclude before rebuild is attempted. The practical answer is not "detect
automatically" — any linear or recursive-descent disassembler, including
regenerator2000's own auto-analyzer, can get this wrong the same way a human can. The
practical answer is to treat every routine-boundary claim as a checkable hypothesis: run
a cross-reference check per routine — does any jump target land strictly inside this
routine's already-decoded byte range, other than at its declared start? — before treating
boundaries as final, and route anything flagged through `c64-provenance-diff` first,
since a rebuild-as-source goal only makes sense for confirmed-original code.

**Warning signs:**
The same address receives two conflicting block-type or label assignments across two
analysis passes, or a symbol's decoded meaning changes depending on which entry point was
walked to reach it first.

**Phase to address:**
The coverage-measurement phase (cross-reference-based boundary verification is directly a
coverage-integrity question) and the provenance-aware rebuild phase (excluding
cracker-added overlap before attempting to rebuild it as source).

---

### Pitfall 8: `compare.mjs`'s drift floor answers a different question than "is the rebuild behaviorally equivalent"

**What goes wrong:**
`compare.mjs` (`src/skills/c64-ram-capture/scripts/compare.mjs`) was built and proven for
*one binary, multiple captures, proving reproducibility* — its own header says so, and its
volatile mask (`$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, `$D000-$DFFF`) and one-bit
"drift"/two-or-more-bit "divergence" heuristic were tuned against that use case's actual
nondeterminism signature (counter-LSB flips, live I/O register sampling). This milestone
needs *two different binaries, compared for behavioral equivalence* — a use case this
comparator has never been exercised against, and several of its design choices produce
the wrong verdict there:

- **False PASS:** the whole `$D000-$DFFF` mask is volatile-and-excluded. That correctly
  hides genuinely unstable state (SID envelope/oscillator internals, VIC raster-position
  read-back) but *also* hides a real regression in registers the program's own logic
  controls and that should match between original and rebuild — border/background color
  (`$D020`/`$D021`), sprite enable (`$D015`), sprite position bytes, VIC bank/screen-base
  bits of `$D018`. A genuine color or sprite-position bug is currently invisible to this
  comparator by construction.
- **False FAIL:** the milestone explicitly wants "one behaviour removed and one added,
  reassembled, both observed taking effect in VICE" — i.e., some differences are the
  *expected signal*, not error. Run as-is, `compare.mjs` has no allowlist mechanism for an
  intentional change; the demo's own success condition (a visible behavioral difference)
  will register as DIVERGENCE and FAIL under the existing verdict logic.
- **False PASS/FAIL from checkpoint misalignment:** the tool assumes both captures are
  taken at directly comparable moments. Once code is relocated, a checkpoint keyed to a
  raw PC literal or cycle count will not land at the same *logical* moment in both
  binaries — everything downstream will look "wrong" even when behavior is correct, or
  (worse) will coincidentally look "right" while comparing unrelated moments.
- **False PASS/FAIL from unpinned nondeterminism sources** not covered by the existing
  volatile mask at all: VICE's power-on RAM fill pattern (configurable, and only
  meaningful as "noise" if the same across both launches); reuse of a warm-floor broker
  instance carrying state from a prior session into what looks like a "fresh" capture
  (this project's own broker architecture makes "did this really start clean" non-obvious
  — reuse the existing epoch-drift detection from `c64-ram-capture`'s "Prove the machine
  did not change under you," applied independently to *each* of the two machines being
  compared, not just one); drive-emulation timing jitter on any checkpoint reached via a
  disk `LOAD`; and keyboard/joystick input delivered on a wall-clock schedule rather than
  a frame/cycle-synchronized one, which can land the same logical input on different
  frames between two runs purely as a test-harness artifact.
- **Structurally uncheckable today:** SID state is (correctly) excluded from RAM
  comparison because it's write-only and non-reproducible — but that also means a broken
  sound routine is entirely invisible to this comparator. The only way to catch it is a
  register-write trace/call log for `$D400-$D418` (and other write-only hardware), not a
  final-state read. `compare.mjs` has no tracing capability at all — only end-state
  snapshots.

**How to avoid / what "the same" should legitimately mean:**
Build on `compare.mjs`, do not replace it: keep its bit-count classification (it is
sound where the underlying assumption holds — same-address, same-binary), but (1) narrow
the volatile mask specifically for the original-vs-rebuild use case so that
program-controlled hardware register *choices* are compared while genuinely unstable
internal state stays excluded; (2) add an explicit, per-comparison allowlist for
declared intentional differences, so the modifiability demo's own expected change doesn't
register as a failure; (3) key checkpoints to a logical/behavioral event resolved
per-binary from its own symbol table, never a raw literal shared across both; (4) add a
register-write-trace comparison for write-only hardware ranges, distinct from the
RAM-snapshot comparison; (5) explicitly pin/verify power-on RAM pattern and force a clean
machine (fresh launch or verified reset, not a reused warm-floor instance) for both sides
of any equivalence run; (6) compare screen content ($0400-$07E7 / $D800-$DBFF) as its own
named check, since it's the actual user-visible surface and can diverge without any
underlying data table changing (e.g., a late-arriving sprite from a desynced multiplexer).

**Warning signs:**
A PASS verdict on a rebuild that a human watching the screen can see is wrong (raster
glitch, wrong color, missing sprite) — the surest sign the comparison is checking the
wrong thing for this use case.

**Phase to address:**
The functional-equivalence-in-VICE phase. This is the single highest-risk gap in the
whole milestone: the existing tool's own documentation already states "Full-64K identity
is impossible in principle," which this milestone correctly does not fight — but nothing
in the existing tool has been validated against *two different binaries*, and several of
its design choices (whole-`$D000-$DFFF` exclusion, no allowlist, literal-checkpoint
assumption) are wrong for exactly that comparison. Do not treat `compare.mjs` as
"already solved, just call it" — treat extending it as first-class scoped work.

---

### Pitfall 9: The persistent regenerator2000 session inherits every session-model lesson this project already paid for once — solving each one twice, slightly differently, is worse than reusing the broker

**What goes wrong (six distinct failure modes, one root cause):**

1. **Unsaved-annotation loss on crash.** `r2000_save_project` is an explicit, separate
   verb (confirmed in the Phase 9 probe transcripts) — a long-lived session accumulates
   many annotation writes between explicit saves. A crash or a forced kill of a wedged
   session loses everything since the last save, and the blast radius is now the whole
   working session's worth of work, not one call's worth.
2. **A wedged child that looks alive.** regenerator2000's HTTP MCP mode can accept a TCP
   connection while its own event loop is blocked on something else (the Phase 9 probe
   hit exactly this shape of surprise: an unanticipated "Import Context Setup" modal
   holding focus before the bootstrap could proceed). A naive "can I connect" liveness
   check will report healthy while every real query hangs — the identical shape of
   problem `vice-wedge-triage` and `vice-probe.ts`'s deliberately-fragile, no-retry
   liveness check already exist to solve for VICE.
3. **Fixed `:3000` port collision.** Confirmed, no workaround upstream (`R2000-04`'s
   scope note: no `--mcp-port`/`--mcp-bind`). Two projects open at once on one host
   collide outright. Under spawn-per-call this was rare enough to document rather than
   detect (v0.3.0's explicit cut rationale); under a persistent session it becomes routine
   (two terminals, two worktrees, one dev) and the cut decision's premise no longer holds.
4. **Zombie processes across Claude Code session restarts.** Spawn-per-call means every
   process naturally exits; a daemon means a Claude Code context reset, crash, or `/clear`
   leaves an orphaned process bound to port 3000 with nothing tracking it, and the next
   session cannot tell "is this mine, stale, or someone else's" without an identity file.
5. **Concurrent access from parallel subagents to ONE session.** Upstream's own
   orchestration fans out to 7 concurrent subagents against what is, in this project's
   adoption, a single mutable, non-transactional `AppState` behind one project file. Two
   subagents both reading "no label here" and both writing one is a lost-update race with
   no visible conflict signal in the tool surface; nothing found in the source suggests
   any locking or per-record versioning.
6. **Stale in-memory state after an external `.regen2000proj` edit.** This project's own
   `.regen2000proj` synthesiser directly edits the project file as JSON to force
   `use_illegal_opcodes`/`system`. If a live session has that file open when an external
   edit happens, the live in-memory state silently diverges, and the next
   `r2000_save_project` from the live session **overwrites the external edit** — silently
   reverting exactly the forced settings Phase 9's own Accepted Limits say are required
   for correct illegal-opcode reassembly (Pitfall 6).

**The concrete prior incident that generalizes directly:** Phase 9's criterion 3(4) found
that splitting `vice_memory_write` and `vice_snapshot_save` across three separate MCP
client connections produced a `.vsf` that did **not** contain the written bytes, even
though a same-connection read-back looked correct moments earlier. The lesson —
"every causally-related mutate-then-read sequence must happen within one connection" —
was learned about VICE and is not yet applied to the new regenerator2000 session model,
where the entire point of persistence is that MANY more mutate-then-read sequences will
now span a longer-lived, shared connection.

**Why it happens:**
Every one of these six is a session/process-lifecycle problem this project has already
solved once, for a structurally identical situation (an external process, on-demand,
single-owner, crash-recoverable) in the VICE broker: `vice-broker.mts`'s single-owner
`inFlight` guard (built after the real 2026-08-01 triple-launch outage), its verified-kill
pattern (PID plus argv/identity check, not a bare signal), its epoch-based restart
detection, and its capability-token-gated control plane. Re-deriving a *different*,
lighter version of each of these for regenerator2000 is very likely to reproduce a subset
of the same bugs the broker's design already closes, with none of the broker's own
regression tests protecting the new code.

**How to avoid:**
Explicitly reuse the broker's patterns rather than re-deriving them: a synchronous
single-owner acquire guard for launching/attaching to a session; PID+identity-verified
kill before any recycle; a persisted identity/lease file the next Claude Code session can
read to decide reuse-vs-recycle; a fragile, short-timeout, no-retry liveness probe
distinct from the resilient query path; and, for the concurrency question specifically,
default to **serializing every write** through one owner and restricting concurrent
subagent fan-out to read-only queries — do not adopt upstream's 7-way concurrent-write
orchestration model unchanged (see Pitfall 11). For the external-edit hazard, force
settings only at bootstrap time (before a session opens the file) or through the live
session's own tool surface, never by direct JSON edit once a session owns the file.

**Warning signs:**
Any skill or procedure written for the persistent session that issues a write and later
reads it back without explicitly stating "same session" as a precondition — this is
exactly the assumption Phase 9 found broken once already, in the sibling system.

**Phase to address:**
The persistent-session phase, first — before absorbing procedures that will run against
it (Pitfall 11 is downstream of getting this right).

---

### Pitfall 10: Absorbing procedure text is a different obligation than depending on the binary, and the installed crate does not even contain what's being absorbed

**What goes wrong:**
Verified this session: `regenerator2000`'s `Cargo.toml` explicitly `exclude`s
`.agent/**/*` from the published crate. The `cargo install regenerator2000` binary this
project already depends on (0.9.20) **does not ship the five `.agent/skills/` procedures
at all** — they can only be fetched from the upstream GitHub repository directly, at
whatever commit `main` (or a tag) happens to be at fetch time. This decouples the
absorbed *text* from the installed *binary* in a way the existing `THIRD-PARTY-NOTICES.md`
entry (written for "depends on this binary, dual `MIT OR Apache-2.0`") does not anticipate:

- **Licence/attribution scope.** A repo-wide notice that a binary dependency exists under
  a given licence is a different, and probably insufficient, obligation than copying
  substantial original authored prose into this project's own skill files — MIT's licence
  notice is generally understood to need to travel with copies of the covered material
  specifically, not just be recorded once for the whole dependency.
- **Snapshot/version drift.** Whatever commit the absorbed text is pulled from is not
  mechanically tied to the 0.9.20 binary actually installed and run. A procedure
  describing tool behavior from a newer or older regenerator2000 than 0.9.20 will read as
  correct and fail silently or subtly when actually driven against 0.9.20.
- **Tool-surface mismatch.** Upstream's playbooks are written against upstream's *full*
  MCP surface and (implicitly) upstream's session model. This project exposes a
  deliberately curated 17-tool subset, cut by the same "does a shipped skill call it"
  test used twice before (v0.2.0's manifest cut, v0.3.0's R2000 cut). An absorbed
  procedure calling a tool outside the curated 17 (or one of the items already cut as
  surplus, e.g. HTML export) will fail or need re-scoping — and per this project's own
  explicit v0.5.0 requirement, that gap-finding is *expected*, not a sign something went
  wrong.

**Why it happens:**
It is tempting to treat "install the tool" and "read its docs" as the same trust
boundary. They are not: one is a pinned dependency with a recorded version and licence;
the other is prose fetched from a moving target with no version pin implied by anything
in this project's existing dependency-tracking machinery.

**How to avoid:**
Attribute at the point of use — a header in each absorbed skill file naming the source
repo, file path, and the specific commit/tag it was fetched from, plus the licence —
rather than relying on the existing repo-wide notice to cover it. Pin the fetch to a
commit/tag verified compatible with the installed 0.9.20 (or note the mismatch
explicitly if none is available). Extract every tool call each absorbed procedure makes
and diff it against the curated 17 *before* trusting the procedure, widening the surface
only for calls with a real, demonstrated caller — the same measured-caller discipline
this project has already used twice, applied to a new candidate set.

**Warning signs:**
An absorbed procedure step that calls a tool name not present in this project's own
`tools-manifest.json`/curated `r2000_*` list — a mechanically checkable, not a
judgment-call, signal.

**Phase to address:**
The absorption phase itself, as an explicit task (fetch-and-pin, diff-tool-calls,
attribute), not a byproduct of copying files.

---

### Pitfall 11: Upstream's 7-way concurrent-subagent orchestration is being absorbed at the exact moment the session model it assumes is being replaced

**What goes wrong:**
Upstream's own orchestration fans out to 7 concurrent subagents. Whatever concurrency
guarantees make that safe upstream were validated against upstream's *own* execution
model — most plausibly either per-subagent ephemeral sessions, or a session/tool
implementation with locking this project hasn't inspected. This milestone is
simultaneously (a) absorbing that orchestration structure and (b) moving from
spawn-per-call to one shared persistent session (Pitfall 9's point 5: one mutable
`AppState`, no visible locking). Copying the orchestration model unchanged compounds two
changes that might individually be fine into an interaction nobody has tested: N
subagents issuing writes concurrently against the one process this milestone is
deliberately keeping alive specifically so state persists across the session.

**Why it happens:**
Absorbing a tested, working procedure feels lower-risk than writing one from scratch —
but "tested" upstream is silent about what it was tested *against*, and this project has
direct, dated evidence (the three-separate-connections `.vsf` incident, Phase 9) that its
own regenerator2000 integration does not tolerate uncoordinated multi-connection access
to shared state.

**How to avoid:**
Treat "absorb the 5 analyze procedures" and "adopt 7-way concurrent orchestration" as
separable decisions. Default to **not** adopting the concurrency model as-authored:
serialize every write-capable call through one owner (mirroring the broker's
single-owner `inFlight` pattern), and if concurrent fan-out is wanted at all, restrict it
to read-only queries, proven safe against a live persistent session before trusting it —
not accepted on the strength of upstream's own docs.

**Warning signs:**
Any absorbed procedure step described as "N subagents in parallel" without a
corresponding statement of which of those N calls are read-only versus write-capable
against the shared session.

**Phase to address:**
The absorption phase, as an explicit go/no-go question on the concurrency model,
answered before the orchestration structure is copied — not discovered after two
subagents corrupt one annotation store.

---

### Pitfall 12: Recurrence of "an internal check standing in for an external one" — the lesson this project has been taught six times

**How this specifically recurs in v0.5.0:**
- The relocation-hazard detectors (jump tables, SMC, page-alignment) being validated only
  against synthetic fixtures the same pass wrote proves the detector finds what it was
  told to look for, not that it finds a *real* idiom in a *real* binary. Same defect class
  as Phase 4's independently-derived-but-still-14-wrong opcode table.
- The functional-equivalence comparator (Pitfall 8) being trusted after only running
  against two captures of the *same* binary — which proves reproducibility, not that it
  distinguishes a real regression in an actually-different rebuilt binary. This is not
  hypothetical: `compare.mjs` has never been run in original-vs-different-binary mode, and
  that is exactly the mode this milestone needs.
- The coverage-measurement tool (Pitfall 13) being validated against its own author's
  already-well-annotated fixture rather than a real, messy, partially-annotated binary.

**Prevention, concrete for this milestone:**
Gate all three of the above on a **real** fixture the tool wasn't tuned against — this
project already has the pattern (`d64-parse.test.mjs`'s corpus sweep over whatever real
`.d64` images exist). Apply the identical idea to hazard detection and coverage
measurement. Most importantly: the milestone's own mandatory "modifiability demonstrated"
step (one behavior removed, one added, both observed in VICE) **is** the first real,
non-synthetic exercise of the equivalence comparator — do not treat it as a separate demo
disconnected from validating the verification instrument itself; run the comparator
extension against it and record whether it caught the right things, not just whether the
demo "worked."

**Phase to address:**
Every phase that builds a verification instrument (hazard detector, comparator extension,
coverage tool) must include "run against a real, unseen fixture" as an explicit
success criterion, not an implicit assumption.

---

### Pitfall 13: Recurrence of "a verification instrument built after the work it should gate"

**How this specifically recurs in v0.5.0:**
If the relocation-hazard detector, the functional-equivalence comparator extension, or
the coverage-measurement tool are built in a *later* phase than the decomposition/rebuild
work they're meant to gate, every finding they would have produced arrives too late to
change how that work was done — gating nothing retroactively. This is precisely the shape
of the mistake `4f048bb` made at the v0.3.0 close (a red guard nobody was forced to read
before declaring success), inverted to design time instead of close time.

**Prevention, concrete for this milestone:**
Sequence the relocation-hazard detector and the coverage-measurement tool as early
phases — before substantial decomposition/annotation work happens against the target
binary — mirroring the gate-first sequencing this project's own retrospective names as
its single highest-leverage v0.4.0 choice (Phase 12 before everything else). A binary
partially decomposed under a hazard detector that doesn't exist yet cannot be
retroactively checked cheaply; it has to be re-walked.

**Phase to address:**
Roadmap ordering itself — this is a sequencing pitfall, not a within-phase one.

---

### Pitfall 14: Recurrence of "a guard whose scope is narrower than its subject reports clean for the wrong reason"

**How this specifically recurs in v0.5.0:**
A coverage checker that only walks addresses regenerator2000's *own* block-type table has
already assigned will silently treat bytes outside that scan as "not applicable" rather
than "unclassified" — reporting 100% coverage while genuinely undocumented bytes exist.
Concretely, and now confirmed by this session's source reading: a "does every referenced
address resolve to a label" check that trusts regenerator2000's own `follow_indirect_jumps`
cross-reference output will report clean while an entire indexed jump table's N-1
untraveled entries (Pitfall 2 — the tool literally cannot enumerate them) are never even
in scope to check. This is the *exact* shape of the 119-vs-150 finding
(`docs-review-disposition.test.ts`'s level-3-colon-only parser) one level up: the tool's
own notion of "everything I've looked at" is being mistaken for "everything there is."

**Prevention, concrete for this milestone:**
Build the coverage/reference scanner to walk the raw byte range and instruction stream
independently of what the annotation tool claims it has already classified — a
derived-from-bytes census, not a report generated from the store's own bookkeeping. Widen
it specifically to cover the address space regenerator2000's indirect-jump follower does
not walk (multi-entry indexed dispatch tables), since that gap is now a confirmed,
specific fact about this dependency rather than a hypothetical.

**Phase to address:**
The coverage-measurement phase, as the design constraint on the scanner itself.

---

### Pitfall 15: Recurrence of "claiming a capability with no measured caller"

**How this specifically recurs in v0.5.0:**
Two Active requirements are exactly the shape of claim this project has been burned by
asserting without measuring: "the curated `r2000_*` surface covers what the absorbed
analyze procedures actually call" is true only if someone extracts every tool call the
five absorbed procedures make and diffs it against the 17-tool list — writing the sentence
because it sounds plausible is the same substitution as Phase 9's "8 predicted, 27 found"
and v0.4.0's four-wire-details-one-refuted. Likewise "modifiability is demonstrated" must
be an actual committed VICE transcript with before/after evidence, not a description of a
walkthrough — precisely Phase 8.1's prior mistake, in a new guise.

**Prevention, concrete for this milestone:**
For every capability claim in this milestone's Active requirements, name the specific
artifact (a diff file, a transcript, a committed evidence directory) that must exist as
proof *before* the requirement moves to Validated — the same discipline `FORK-01`/
`CORE-01`'s decision provenance already established as this project's own standard.

**Phase to address:**
Every phase closing a requirement with an empirical claim; enforced the way
`docs-*.test.ts` guards already enforce planning-document claims elsewhere.

---

### Pitfall 16: The "well documented" coverage criteria are vacuously satisfiable, and this project's own tooling already provides the honest alternative

**How each structural criterion can be gamed:**

- **"Nothing `Undefined`"** is satisfiable by mechanically retyping every `Undefined`
  block to `Code`/`DataByte` with an auto-generated label (`sub_C3A2`) and a templated
  comment ("handles data"). This satisfies a state-machine property of the annotation
  store while adding zero understanding, and a coverage script counting
  `block_type != Undefined` over total bytes reads 100% either way.
- **"Every referenced address documented"** degenerates to "has a non-null comment
  field" — regenerator2000 already auto-generates comments/labels for every reference it
  finds (confirmed: `LabelKind::Auto` exists as a distinct, tracked kind alongside
  `LabelKind::User` in the installed source, `types.rs:353-357`). A script that treats
  presence of *any* comment as "documented" cannot distinguish a genuinely authored
  explanation from the tool's own template.
- **"Hardware writes as named enums"** is already satisfied automatically today by the
  v0.3.0 `memmap.json` generation, for every write — that mechanism documents what the
  *hardware register* does generically, never why *this program* sets it here. A coverage
  metric counting "percentage of hardware writes resolving to a named constant rather
  than a magic number" is satisfied by the existing generator alone, with nobody having
  read the surrounding code.

**What makes a coverage metric resistant to this — concrete, not "measure it properly":**

1. **Report the Auto/User label ratio as its own number**, not folded into a single
   coverage percentage. `LabelKind::Auto` vs `LabelKind::User` is already a real,
   mechanically available distinction in the tool this project depends on
   (`types.rs:353-357`) — use it. "X% of labels in this region are still Auto-kind" is a
   non-vacuous, currently-unused signal.
2. **Require cross-reference-backed documentation** for any label reached from more than
   one call/jump site — if two callers reach the same routine and its documentation
   doesn't distinguish or reconcile their different intents, that's evidence of
   templated, not authored, coverage.
3. **Sample-audit, don't trust the aggregate.** Apply this project's own proven
   falsifiability pattern — Phase 11's sealed-question, genuinely-separate-session test —
   to coverage *quality*, not just store persistence: periodically pull a random sample of
   "covered" addresses and require an independent pass (no access to the existing
   annotations) to reproduce the same understanding from raw bytes alone.
4. **Tie coverage to reassembly-plus-behavior for at least the modifiability demo's own
   region.** A region whose documentation is accurate can typically be modified in a
   small, controlled way and re-verified in VICE; a region whose documentation is
   template-vacuous will typically fail exactly that kind of edit, because nobody
   understood what changing it would do. This reuses evidence the milestone is already
   producing (the modifiability demo) rather than inventing a separate audit.

Measured, not asserted, coverage for this milestone = structural completeness (no
`Undefined`) **AND** the Auto/User ratio surfaced **AND** a sampled independent
reproducibility check **AND** the specific region touched by the modifiability demo
independently re-verified — not a single percentage.

**Warning signs:**
A coverage report reading 100% with an Auto-label ratio near 100% is not "well
documented" — it is "well typed." Treat the two numbers as answering different
questions and report both.

**Phase to address:**
The coverage-measurement phase — this pitfall *is* that phase's design brief, not a
caveat on it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Trusting regenerator2000's auto-generated cross-refs as "the" reference graph | Fast, zero extra code | Misses every indexed jump table (Pitfall 2) and any pointer not already `Address`-typed (Pitfall 1); coverage claims built on it are vacuous (Pitfall 14/16) | Never as the sole source for a coverage or relocation-safety claim; fine as a starting seed for human/agent review |
| Symbolising every label the moment it's created (auto or user) without distinguishing kind in reporting | Simple 100%-labeled output | Hides the Auto/User ratio that is the one cheap, honest coverage-quality signal this dependency already exposes | Never for the milestone's coverage measurement; acceptable for a quick interim disassembly listing not claimed as "well documented" |
| Reusing a warm-floor VICE instance for both sides of an equivalence comparison | Faster test cycles | Leaked prior-session state masquerades as a "fresh" capture, producing a false PASS or FAIL with no error (Pitfall 8) | Never for an equivalence run; fine for exploratory, non-recorded manual poking |
| Copying upstream's 7-subagent orchestration structure verbatim | Ships absorption faster, reuses tested prose | Corrupts the one shared persistent session under concurrent writes with no error surfaced (Pitfall 9/11) | Never as shipped; acceptable only after the concurrency model is independently proven safe against the persistent session |
| Treating "reassembles clean" as proof a relocation is safe | Cheap, mechanical, always available | Silently misses every hazard in this document except plain branch-range overflow — SMC, jump tables, page-crossing timing, and cycle-exact chains all reassemble clean while being wrong | Acceptable as a *necessary* gate, never as the *sufficient* one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|-------------------|
| regenerator2000 persistent session (this milestone's core change) | Assuming spawn-per-call session-safety habits (single connection, single writer) still hold once the process stays up | Re-derive session-safety explicitly for the persistent model; reuse the VICE broker's single-owner/verified-kill/epoch patterns rather than inventing lighter equivalents (Pitfall 9) |
| `.regen2000proj` direct JSON edits (the existing synthesiser's own technique) | Editing the project file while a live session has it open | Force settings only at bootstrap, before a session opens the file, or via the live session's own tool surface (Pitfall 9, point 6) |
| Upstream `.agent/skills/` absorption | Treating "read the GitHub repo" as equivalent to "the installed crate documents this" | The installed 0.9.20 crate does not ship `.agent/skills/` at all (`exclude`d from the package) — fetch and pin a specific commit/tag independently, and verify compatibility with 0.9.20 (Pitfall 10) |
| `c64-ram-capture`'s `compare.mjs` reused for behavioral equivalence | Calling it unmodified and trusting a PASS/FAIL verdict tuned for same-binary reproducibility | Extend its volatile mask, add an intentional-difference allowlist, and add a write-trace comparison before trusting a verdict on two different binaries (Pitfall 8) |
| `c64-memory-mapping`'s generated enum names | Treating an auto-generated register-name substitution as evidence a write is "documented" | Enum substitution answers "what does this hardware register do," never "why does this program do it here" — require both (Pitfall 16) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Full-64K byte-level comparison as the *only* equivalence check | Comparator run time grows with capture count; genuine equivalence buried under a wall of expected-but-unclassified differences | Layer the check: structural (RAM outside the revised volatile mask), behavioral (screen content, hardware write trace), and only then eyeball raw byte counts | Once more than a handful of intentional differences exist per comparison, a flat byte-diff becomes unreadable and gets rubber-stamped instead of read |
| Re-parsing/re-loading a `.regen2000proj` on every tool call (today's model) | Slow per-call latency motivating the persistent-session move in the first place | This milestone's own persistent-session work is the fix — but see Pitfall 9 for what it must not break to get there | Already breaking today at whatever call volume motivated this milestone |
| Cross-reference/hazard-detector scans re-run from scratch on every incremental annotation | Slows down interactively as the binary's annotation grows | Cache/derive incrementally where the store supports it, but never skip a full re-scan before a phase's final gate (Pitfall 12's "run against real fixture" applies to the final answer, not every intermediate one) | Once binaries exceed a full 64K with dense annotation, from experience with this project's own `vice-proxy.ts`-scale files |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Binding the persistent regenerator2000 HTTP MCP session on `0.0.0.0` (its likely default, unverified this session) without the broker's capability-token discipline | Any host on the local network segment could read or mutate the analysis session for a binary being reverse-engineered | Apply the same token-gated, `timingSafeEqual`-compared control-plane pattern the VICE broker's control listener already uses, rather than trusting a bare port bind (mirrors `PKG-04`'s accepted-risk analysis — do the analysis explicitly rather than skip it because "it's just a disassembler") |
| Treating a `.regen2000proj` or absorbed-skill file as trusted input because it's "just documentation" | An externally-fetched skill file or project file could carry a prompt-injection payload interpreted as instructions by a session reading it via a Read/agent flow | Apply the standard untrusted-input boundary discipline to anything fetched from upstream's GitHub repo during absorption, the same as any other external content ingested into an agent's context |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| A coverage report showing one aggregate percentage | Looks authoritative, hides whether coverage is genuine or templated (Pitfall 16) | Report structural completeness, Auto/User ratio, and sample-audit result as three distinct numbers |
| A relocation-hazard report that lists hazards without enumerating table lengths/bounding conditions for jump tables | A user "fixes" the reported hazard by symbolising the one entry the tool found and ships with N-1 silently wrong | Require the report to state, for every jump table, how its length/index range was established, not just that a table exists |
| An equivalence-check verdict of PASS/FAIL with no distinction between "expected intentional difference" and "no difference at all" | A modifiability demo that correctly changed behavior looks identical, in the tool's own output, to total silent failure to build | Surface the allowlist match explicitly in the verdict output: "N intentional differences matched, 0 unexplained" |

## "Looks Done But Isn't" Checklist

- [ ] **"Nothing left Undefined"**: verify the Auto/User label ratio, not just the
      absence of the `Undefined` block type — a fully auto-renamed binary satisfies the
      literal wording (Pitfall 16).
- [ ] **"Every referenced address documented"**: verify the reference graph the coverage
      check walks includes multi-entry indexed jump tables, which regenerator2000's own
      cross-reference builder does not enumerate (Pitfall 2, Pitfall 14).
- [ ] **"Every branch, JSR/JMP and data reference goes through a symbol"**: verify data
      byte-pairs that decode to in-range addresses with incoming cross-references were
      scanned, not just instruction operands (Pitfall 1).
- [ ] **"A relocation-hazard report enumerates what blocks movement"**: verify it names
      *table lengths* for jump tables (not just "a jump table exists here"), and names
      SMC write-target-in-Code-block hits from an actual scan, not from manual review
      (Pitfall 2, Pitfall 3).
- [ ] **"Behavioural equivalence in VICE via `compare.mjs` is the milestone's final bar"**:
      verify the volatile mask and checkpoint-alignment logic were actually extended for
      two-different-binaries comparison — the shipped tool has only ever been run
      same-binary (Pitfall 8).
- [ ] **"Modifiability is demonstrated"**: verify a committed VICE transcript exists
      showing the before/after difference actually observed, not a described walkthrough
      (Pitfall 15, echoing Phase 8.1).
- [ ] **"Upstream's five analyze procedures are absorbed"**: verify each absorbed file
      carries a specific source commit/tag and licence header, and that its tool calls
      were diffed against the curated 17 (Pitfall 10).
- [ ] **"A regenerator2000 project stays open across a whole working session"**: verify a
      crash/kill mid-session was actually exercised and the resulting state-loss/recovery
      behavior observed, not merely that the happy path was demoed (Pitfall 9).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| A relocation shipped that turns out to have broken a jump table or SMC site | MEDIUM | Bisect via `c64-provenance-diff`-style anchor comparison against the pre-relocation binary at the affected address range; the original `.d64`/binary stays the ground truth to diff against, per this project's existing provenance workflow |
| A persistent regenerator2000 session crashes with unsaved annotations | LOW–HIGH depending on save discipline | If autosave/frequent-save discipline (Pitfall 9) was followed, reload from the last save; if not, the loss is total for that session — this is the argument for building the save discipline before relying on the persistent model at all |
| `compare.mjs`-based equivalence check reports a false FAIL on an intentional change | LOW | Add the difference to the run's explicit allowlist (once built, per Pitfall 8) and re-verify; do not silently accept a manual "looks fine to me" override without recording why |
| Absorbed procedure text found to reference an unavailable tool mid-use | LOW | Fall back to the curated 17-tool surface's nearest equivalent, or file the gap as a scope-widening candidate per the measured-caller test, rather than patching the absorbed prose ad hoc |
| Coverage report later found to have been gamed by templated auto-labels | HIGH | Requires an actual second-pass annotation effort against the flagged Auto-ratio regions — there is no mechanical shortcut once vacuous coverage has been recorded as complete, which is exactly why Pitfall 16's prevention must run *before* the milestone is declared done, not after |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1 — unmarked data-as-address | Relocation-hazard-report phase | Scanner output lists every in-range byte-pair with an incoming xref; each has a recorded human/agent disposition |
| 2 — indexed jump tables | Relocation-hazard-report phase | Every table's index range is documented from its bounding compare/mask, and every entry is individually exercised in the equivalence-verification phase |
| 3 — self-modifying code | Relocation-hazard-report phase | A STA/STX/STY/INC/DEC-target-in-Code-block scan exists and its output is reviewed, not manually derived |
| 4 — page-alignment / cycle timing | Relocation-hazard-report phase (flag) + functional-equivalence phase (verify) | Live VICE raster/CIA trace confirms unchanged cycle count for every flagged chain |
| 5 — cycle-exact raster code | Same as above | Video/`$D012` comparison, not RAM diff alone |
| 6 — illegal-opcode degradation | Annotate/export pipeline phase | Grep exported `.a` sources for `!byte` fallback lines inside labeled regions; `use_illegal_opcodes` verified set on every session, not just synthesis |
| 7 — overlapping/interleaved code-data | Coverage-measurement phase + provenance-aware rebuild phase | Cross-reference boundary check run per routine; provenance-diff run before rebuild attempted on flagged regions |
| 8 — equivalence comparator scope gap | Functional-equivalence-in-VICE phase | Comparator demonstrably run original-vs-different-binary at least once (the modifiability demo) with the extended mask/allowlist/trace, not only same-binary |
| 9 — persistent-session lifecycle | Persistent-session phase (first, before absorption work depends on it) | Crash/kill/reconnect scenario actually exercised, not only the happy path |
| 10 — absorption licence/version/tool-surface | Absorption phase | Attribution header per file with pinned commit; tool-call diff against curated 17 committed as evidence |
| 11 — 7-way concurrency model | Absorption phase (go/no-go on the concurrency question specifically) | A concurrent-write test against the persistent session either passes with evidence or the model is explicitly not adopted |
| 12 — internal-check-standing-for-external (6th+ instance) | Every phase building a verification instrument | Instrument's own validation includes a real, previously-unseen fixture, cited as evidence |
| 13 — instrument built after the work it gates | Roadmap sequencing | Hazard detector and coverage tool ship before substantial decomposition work, not after |
| 14 — guard narrower than its subject | Coverage-measurement phase | Scanner walks raw bytes/instructions independently of the store's own classification bookkeeping |
| 15 — capability claimed with no measured caller | Every phase closing an empirical requirement | Named artifact (diff, transcript, evidence directory) exists before Validated status is recorded |
| 16 — vacuous "well documented" | Coverage-measurement phase | Auto/User ratio, sampled independent reproducibility check, and modifiability-demo region re-verification all reported alongside structural completeness |

## Sources

- `.planning/PROJECT.md` — Active requirements, Context, Constraints, Key Decisions
  (v0.4.0 close, v0.5.0 scope opened 2026-08-23).
- `CLAUDE.md` — project constraint list, encoding prior hard-won protocol/architecture
  findings.
- `.planning/RETROSPECTIVE.md` — cross-milestone lessons, especially "an internal check
  does not substitute for an external one" (verified across three milestones, eight
  instances) and "a guard's scope is itself a claim to be checked."
- `.planning/codebase/CONCERNS.md` — broker fragility, the 2026-08-01 triple-launch
  outage, and the single-owner `inFlight` guard it produced.
- `docs/phase9-regenerator2000-probe-findings.md` — the go/no-go probe against real
  regenerator2000 0.9.20; source of the confirmed `.vsf` cross-connection incident, the
  `use_illegal_opcodes` default defect, and the `.vsf` machine-type auto-detection
  limitation.
- `src/skills/c64-ram-capture/SKILL.md` and `scripts/compare.mjs` — the existing drift
  floor and difference-classification machinery this milestone must extend, read in full
  this session.
- `regenerator2000-core-0.9.20/src/analyzer.rs`, `state/types.rs`
  (`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`) — read directly this
  session to confirm `follow_indirect_jumps`'s single-fixed-target limitation (no
  indexed-jump-table enumeration), the absence of any self-modifying-code detection
  anywhere in the crate, and the `LabelKind::Auto`/`User`/`System` and `BlockType`
  (including `LoHiAddress`/`HiLoAddress`) enum shapes.
- `regenerator2000-0.9.20/Cargo.toml` — confirmed `.agent/**/*` is excluded from the
  published crate, meaning the installed binary does not carry the skills text this
  milestone absorbs.
- General NMOS 6502/6510 hardware facts (relative branch range, indexed-addressing
  page-crossing cycle penalty, RTS-trick calling convention, raster-IRQ cycle-exactness) —
  standard, well-established 6502/C64 domain knowledge, cross-checked against this
  project's own documented C64-specific findings rather than restated from a generic
  source.

---
*Pitfalls research for: c64-re-tools v0.5.0 (binary-to-rebuildable-source pipeline)*
*Researched: 2026-08-23*
