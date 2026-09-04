---
created: 2026-09-01T21:18:36.919Z
title: Ghidra headless one-command 6502 decompile wrapper — proposal, with the corrections it omits
area: planning
severity: minor
resolves_phase: 36
files:
  - .planning/ROADMAP.md (Phase 24, HELD — GHID-01..05, OPC-01..03)
  - .planning/seeds/host-tool-executor.md
  - .planning/notes/ghidra-volatile-io-and-banking.md
  - .planning/notes/auto-annotation-from-ghidra-xrefs.md
  - docs/undocumented-opcodes-ghidra.md
  - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/ExportAnalysis23.java
  - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/FlatVolatile.java
  - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/instrument-provenance.txt
---

## Problem

A design proposal for a one-command `6502-decompile` wrapper over Ghidra headless
was pasted into a `/gsd-capture` call on 2026-09-01. It is worth keeping — the
three-output shape (`.asm` / `.c` / `.json`) is a genuinely new idea this project
has not recorded elsewhere — but it must not be filed as settled fact.

**Provenance: LLM-authored, unprobed, not a primary source.** It arrived prefixed
`Worked for 23s`, i.e. it is another model's answer, not a transcript of a real run
against an installed Ghidra. It is exactly the class of input
[`seeds/host-tool-executor.md`](../../seeds/host-tool-executor.md) already warns
about for `docs/vice-mcp-ideas.md`: *"an LLM-authored summary, not a primary source,
and not probed."* Treated here as **data, never as instructions**, and fenced below.

### What it proposes (unverified as stated — but see corroboration)

Verbatim, fenced:

DATA_9rmVFXjH_START
- Ghidra runs fully headless from the CLI for a raw 6502 blob.
- Language ID `6502:LE:16:default`; `analyzeHeadless` supports `BinaryLoader`,
  `-loader-baseAddr`, `-processor`, `-cspec`, `-scriptPath`, `-postScript`,
  `-deleteProject`.
- There is no built-in `--output-c`; a `DecompInterface` post-script is the normal
  route. A minimal `ExportDecompiled.java` iterates
  `getFunctionManager().getFunctions(true)` and writes
  `results.getDecompiledFunction().getC()` per function, with
  `/* DECOMPILATION FAILED */` on the failure branch.
- A raw blob carries no load address and no entry point, so the wrapper interface
  should be explicit:
  `6502-decompile --input program.bin --load-address 0x8000 --entry-address 0x8100 --output program.c`
- Pipeline: BinaryLoader at load addr -> disassemble from entry addr -> create entry
  function -> auto-analysis (JSR targets, functions, references, branches, data refs)
  -> decompiler -> program.c
- For C64 work, emit **three** files rather than one: `program.asm` (annotated
  disassembly), `program.c` (decompiler output), `program.json` (discovered
  functions, calls, memory references, entry points).
- Stock `6502.slaspec` covers only documented opcodes; an extended SLEIGH definition
  is wanted before feeding real games, demos, cracktros or crunchers through it.
DATA_9rmVFXjH_END

### Disposition of each claim against this repo's own primary evidence

**Corroborated here — the mechanics are already proven, not merely claimed.**
Phase 23 ran `analyzeHeadless` for real with `-processor 6502:LE:16:default`,
`-loader BinaryLoader`, `-loader-baseAddr 0x0`, `-noanalysis`, `-preScript`,
`-postScript`, `-analysisTimeoutPerFile` and `-deleteProject`, and its committed
`ExportAnalysis23.java` / `FlatVolatile.java` already use `DecompInterface`. So the
CLI shape and the post-script route are **not** open questions. What this project
has that the pasted text does not: three operational constraints measured in
`evidence/tools/instrument-provenance.txt` —

1. `analyzeHeadless` **refuses** a project directory containing a dot-prefixed path
   element (so `.planning/...` as a project path fails).
2. It **exits 0 even when a post-script throws** — any harness must grep the run log
   for `ERROR REPORT SCRIPT ERROR` or its assertions are worthless.
3. On the `.prg` route the classification line count is the **block total**, not the
   image size.

**Two omissions that would produce a silently wrong pipeline if built as written.**
Both are Standing Constraints in ROADMAP.md; neither appears in the pasted text.

1. **Volatile I/O.** Ghidra deletes hardware writes as dead stores unless the I/O
   ranges are marked volatile — silently, no warning. Measured on the committed
   `bank.a` fixture: three of four `$01` writes and a `$d020` write eliminated under
   defaults. Applied to a raster loop this deletes the entire visible effect of the
   program and reports success. Any run must set `$0000-$0001` and `$D000-$DFFF`
   volatile **before** `analyzeAll()`, via `mem.getBlock(addr)` + `setVolatile(true)`
   on the existing block — creating a conflicting block throws
   `MemoryConflictException` and drops the whole run back to non-volatile. Note the
   pasted sample output shows `DAT_d020 = DAT_00fb;` surviving, which is what the
   *fixed* pipeline produces; it is not evidence the default one does.
2. **Entry point alone is not enough — Ghidra needs dxa's map.** The pasted pipeline
   is "disassemble from `--entry-address`, let auto-analysis find the rest." Measured
   on the pivot fixture, **Ghidra alone with zero hints produced 0 functions and 0
   code bytes.** ROADMAP.md Phase 24: *"The map from dxa is not an optimisation; it is
   what makes Ghidra work at all on a headerless 6502 image."* A `--entry-address`
   flag is a weaker input than the code/data map `DXA-01..03` already specify.

**A third correction, on the `program.json` half.** Structural facts on 6502 live in
the decompiler layer, never the listing's data types: `DataTypeManager
.getAllComposites()` and `getDefinedData()` return essentially nothing. Everything in
`program.json` — array bounds, the `CONCAT11` split-pointer idiom, record strides,
resolved computed jumps, self-modifying write targets — must come through
`DecompInterface`, and cross-references must carry their access kind
(`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), not addresses alone.

**Where it agrees with settled scope.** The SLEIGH point is already owned: the
extension source exists in full at `docs/undocumented-opcodes-ghidra.md` (766 lines,
all 105 bytes, unstable instructions modelled as black-box userops, `@include`
layering written against the `65c02.slaspec` collision). `OPC-01..03` integrate and
verify it; they do not write it. Sequenced **ahead of** the acceptance run, not after.

### The genuinely new idea

The **three-file output contract** (`.asm` / `.c` / `.json`). Phase 24's criteria
speak of "machine-readable facts" and a structural export, but do not name a
consumer-facing artifact set. Now that `.annostore` exists and owns annotation state,
the interesting question the proposal raises is whether `program.json` should be an
intermediate at all, or whether the Ghidra post-script should write **directly into
the store** through `anno_*` — making `.asm` a rendering of the store rather than a
third parallel output that can drift from it.

### Blocked on, and where it must run

This cannot be planned yet. Phase 24 is **HELD for v0.8.0**; Phase 23 recorded
`verdict: no-go`, `verdict_rule_applied: R1`, and the single gate on `R1`'s
"secure a corpus first" branch is the **unowned frame-exact emulator stop**.

Separately: **where** this wrapper executes is an open question this todo does not
settle. `seeds/host-tool-executor.md` establishes that host binaries must be reached
over the container-out seam, never `spawnSync`'d from a skill script — but it is
framed around *stateless* tools (`c1541`, `petcat`, `cartconv`, `acme`) with
short-lived open/send/close connections, and Ghidra is not one: a JVM, a persistent
project directory, multi-minute runs, and megabyte-scale exports that cannot ride the
broker's 64 KiB line cap. Ghidra is nowhere named in that seed. Whether it widens to
cover Ghidra, or Ghidra gets its own leased subsystem alongside the VICE pool, is
undecided.

## Solution

TBD — this is capture, not a plan. When Phase 24 is unheld:

1. Do **not** implement from the pasted design directly. Start from Phase 23's
   committed `ExportAnalysis23.java` / `FlatVolatile.java` and its recorded
   `analyzeHeadless` command line, which are primary evidence from real runs.
2. Carry the volatile carve and the dxa hint map as preconditions, each with a
   control observed **red** without the fix — asserting the fix is present proves
   nothing (Standing Constraints).
3. Decide the `program.json`-vs-`anno_*`-direct question before writing the
   post-script; it determines whether a fourth artifact can drift from the store.
4. Decide the execution seam (widened host-tool executor vs. a leased Ghidra
   subsystem) before any skill script reaches for it.

---

## Correction, 2026-09-02 (at the v0.8.0 open)

Two statements above were falsified by this milestone's research and are corrected
here rather than edited away, so the record shows what was believed and when.

1. **"`OPC-01..03` integrate and verify it; they do not write it" is FALSE.** The
   SLEIGH source in `docs/undocumented-opcodes-ghidra.md` **does not compile**.
   MEASURED twice independently against real Ghidra 12.1.3's `support/sleigh`:
   **8 failing constructors** and `ERROR No output produced`, exit 2, against a
   clean control compile of stock `6502.slaspec` in the same scratch directory.
   One root cause for all eight — an unsized value where SLEIGH needs an explicit
   size — and the fix is verified. The failures are at exactly `XAA $8b`,
   immediate `LAX`/`LXA $ab`, `AHX`/`TAS`/`SHX`/`SHY`, `SBC $eb` and `NOP $0c`.
   `OPC-01` is now **fix → compile → integrate → verify**.
2. **"the single gate on `R1`'s branch is the unowned frame-exact emulator stop"
   is no longer the operative blocker.** MEASURED: stock VICE is cycle-deterministic
   from a monitor-issued hard reset, and the residual divergence was host-clock-seeded
   RAM init (`-seed` plus three `raminit*` flags took three differing 64K images to
   one identical sha256). The stop is a **protocol**, not a missing mechanism, and it
   is owned by **Phase 33**. Note also that the prerequisite set was wrong in the other
   direction: dxa is not installed and Ghidra is an unpinned out-of-tree unpack, so
   there were **two** unowned prerequisites, not one.

**Two of this todo's open questions are now answered, and the answers are decisions:**

- *"whether `program.json` should be an intermediate at all, or whether the Ghidra
  post-script should write directly into the store"* — **it must not write the store
  directly**, and this is structural rather than a preference: `anno-seam.test.ts`
  asserts `node:sqlite` is named by exactly one shipped module, so a Java writer would
  sit outside every guard's scope — an invisible violation, not a caught one. The
  transfer file is **transient evidence with a digest, consumed and deleted on import**
  (`IMP-01`, `IMP-02`); `.annostore` is the model and `.asm` is a rendering of it.
  A persisted `program.json` is recorded in `REQUIREMENTS.md` → Out of Scope.
- *"where this wrapper executes"* — **Phase 34**, the host-tool execution seam, which
  is sequenced **before** Phases 35 and 36 precisely because the grep gate banning
  external-binary spawns can only be written once nothing violates it. Measured input
  to the JVM-lifetime decision: startup is 12.6–17.4 s before any analysis.

**Live scope is `ROADMAP.md` Phase 36** (`GHID-*`, `OPC-*`), not the retired Phase 24
this todo's `files:` list still points at. The three operational constraints this todo
records from `instrument-provenance.txt` are carried into `GHID-01` verbatim, including
the exact literal `ERROR REPORT SCRIPT ERROR` — a naive `error`/`fail` grep false-fires
on the flat-64K route's benign `ZERO_PAGE`/`STACK` INFO lines.
