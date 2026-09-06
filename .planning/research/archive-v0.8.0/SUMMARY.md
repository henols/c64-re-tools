# Project Research Summary

**Project:** c64-re-tools — milestone v0.8.0 "Frame-Exact Capture and the Two Engines"
**Domain:** Deterministic emulator capture + offline 6502 static-analysis pipeline, added to a mature container-in / host-out MCP plugin
**Researched:** 2026-09-02
**Confidence:** HIGH on the capture protocol and the tool facts (live probes on this host); MEDIUM on the Ghidra execution seam (one section is survey, not measurement); LOW on comparable-tool ecosystem claims

> **This is a reconciliation, not a merge.** The four researchers disagree on load-bearing
> points, and one owner decision (the `stopwatch` exclusion, 2026-09-02) landed after two of
> them had finished. Every disagreement below names the survivor and the evidence. Provenance
> labels (**MEASURED** / **SOURCE** / **READ-IN-SOURCE** / **PRIMARY (repo)** / **RECALLED** /
> **UNVERIFIED**) are carried through unchanged; this project treats an unmeasured claim
> presented as measured as a defect class, so nothing here is upgraded by summarising.

---

## Executive Summary

The milestone was opened on the belief that a frame-exact emulator stop is the hard, unowned
capability at its centre and that VICE's event record/replay might supply it. **Both halves of
that belief are now measurably wrong, in opposite directions.** Event record/replay is
unreachable — there is no `-record` command-line option on any version, `event_record_start()`
has no non-UI caller, and no binary-monitor opcode addresses it (STACK.md, MEASURED + SOURCE).
And the stop does not need a new mechanism at all: **stock VICE's emulation is
cycle-deterministic from a monitor-issued hard reset, and a monitor checkpoint stop is
instruction- and cycle-exact.** Three runs with 0 / 1500 / 4000 ms of deliberate pre-protocol
jitter — a 6.7-million-cycle spread of pre-reset noise — landed byte-identically at the 1st and
10th hit of `$EA31`, including raster line and raster cycle (PITFALLS.md, MEASURED). The residual
divergence was never the stop: it was **host-clock-seeded RAM initialisation**, worth ~1,000
addresses of pure false divergence per capture pair, and pinning it closed the gap completely —
three independent cold boots produced one identical 64K sha256 (STACK.md, MEASURED).

So the recommended approach is a **protocol, not a mechanism**: pin the launch nondeterminism,
take the machine from a monitor-issued hard reset as the run's first act (never from whatever the
broker's warm floor handed out), set the checkpoint while halted, resume exactly once, wait
event-driven on that checkpoint's own `CHECKPOINT_INFO`, and record the stop as the triple
**`(PC, hit_count, (LIN, CYC))`** — all three binary-monitor native at the VICE **3.9** floor, with
a second *frame-anchor* checkpoint on a once-per-frame site so `hit_count` is genuinely a frame
index. The 64K image comes from slicing a `.vsf` `C64MEM` module body, and the equivalence
predicate is an explicitly enumerated per-address allow-list (measured honest size: **3 addresses
of 1024**), never a range. The frame-exact stop is therefore **smaller than the milestone
assumed** — all three of STACK, ARCHITECTURE and PITFALLS reached that conclusion independently —
while the *protocol, the capture record schema and the equivalence oracle around it* are the real
deliverable and are new.

The analysis half moves the other way. Two carried premises are falsified. **The SLEIGH extension
source in `docs/undocumented-opcodes-ghidra.md` does not compile** — 8 failing constructors,
`ERROR No output produced`, exit 2, reproduced independently by two researchers each with a
passing control — so `OPC-01..03` must be planned as *fix, compile, integrate and verify*, not
"integrate and verify". And the prerequisite set is larger than "the frame-exact stop is the single
gate": **dxa is not installed anywhere on this host**, and Ghidra 12.1.3 exists only as an
unpinned out-of-tree probe unpack. The dominant risks are all *silent*: a failed `sleigh` leaves
the pre-shipped stock `6502.sla` in place so an unchecked build yields a green run on a language
decoding none of the 105 bytes; `analyzeHeadless` exits 0 when a post-script throws; a
non-volatile I/O range makes the decompiler delete every hardware write; and a >64 KiB inline
return destroys the broker socket with no error frame, indistinguishable from a wedge. Every one
of those is defended only by a control **observed red** — PITFALLS.md enumerates **18** such
controls across the milestone, and that count is a plannable figure, not a slogan.

---

## Key Findings

### Recommended Stack

Nothing new is added to `package.json`. Every capability is a launch flag, a vendored C program, a
JVM already on the host, or plain-Node protocol code over existing seams (STACK.md).

**Core technologies:**

- **stock VICE `x64sc` binary monitor, floor 3.9** — checkpoint arm/hit/stop (instruction-exact,
  MEASURED nine runs), `REGISTERS_GET` (0x31), `CHECKPOINT_INFO` (0x11), `RESET` (0xcc),
  `MEMORY_GET` (0x01), `.vsf` `DUMP`/`UNDUMP` (0x41/0x42), `ADVANCE_INSTRUCTIONS` (0x71). The
  whole capture half lands on 3.9 — the version Debian trixie/forky/sid and all current Ubuntu
  ship. No user is asked to upgrade and no part requires the fork.
- **Launch-time determinism flags** — `-raminitstartrandom 0 -raminitrepeatrandom 0
  -raminitrandomchance 0` (STACK.md: three differing cold-boot 64K images → one identical
  sha256, MEASURED) and `-seed <fixed>` (PITFALLS.md: 67 of 4080 bytes differing across cold
  boots → 0 with `-seed 4242`, MEASURED). Set **both**; see Reconciliation 1 for why neither
  researcher's lever alone carries full-64K evidence.
- **dxa 0.1.5**, pinned `sha256 8e40ed77…6799`, vendored and built (`make`, no dependencies).
  Reproducible: the built binary's sha256 matched Phase 23's pin exactly across a 7-day gap
  (MEASURED). Still the only release; upstream dormant since 2022-03.
- **Ghidra 12.1.3 PUBLIC** + **OpenJDK >= 21, no upper bound** (`application.java.min=21`,
  `application.java.max=` empty, SOURCE). Confirmed the current latest release, i.e. the same
  version Phase 23 probed — Phase 23's recorded command line has no drift to re-establish.
  **Fetch at first use, never commit** (543 MiB zip / 882 MiB unpacked); declare it as a host
  prerequisite **by version, never by install path**.
- **`support/sleigh`**, shipped inside Ghidra — a drop-in processor-language extension needs
  **no Gradle and no Ghidra rebuild**. MEASURED end to end: `-processor 6502:LE:16:nmos` ran
  headless to exit 0 against a hand-built `Ghidra/Extensions/<Name>/` module.
- **Node >= 24, `node:sqlite`, `@mastra/mcp`** — unchanged. No new runtime dependency for any
  part of this milestone.

**Critical version boundary.** Absolute cycle count has **no route on VICE 3.9**.
`CPUHISTORY_GET` (0x86) carries a per-entry uint64 absolute clock but requires **>= 3.10**, and
`stock-timing.ts`'s `readCycleBaseline()` Route A depends on it. Record absolute cycle as an
*optional 3.10-only strengthening naming that opcode and field* — never as a requirement.

### Expected Features

**Must have (table stakes):**

- Depacked flat 64K capture with no transcription step, by slicing the `.vsf` `C64MEM` module
  body (4 bytes port/PLA + exactly 65536 bytes RAM). Method already validated in-repo.
- A capture manifest beside every image: sha256, size, and the **stop coordinates**.
- An equivalence **predicate** with a named, enumerated divergence allow-list — not a hash compare.
- A machine-readable code/data map from a vendored, pinned dxa, plus **a listing parser that
  refuses by name** (dxa has no structured output at all).
- Ghidra headless from a committed script, handed dxa's map as hints — Ghidra alone on a
  headerless 6502 image produced **0 functions and 0 code bytes** (MEASURED, repo). The map is
  not an optimisation.
- The volatile-I/O carve on `$0000-$0001` and `$D000-$DFFF` before `analyzeAll()`.
- Structural facts through `DecompInterface`, **never** `DataTypeManager`.
- Cross-references carrying their access kind (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`).
- Machine-address auto-annotation: narrowest-range-wins, in-image skip, bank-before-address,
  **decline where path-dependent**.
- All 105 opcode bytes stock `6502.slaspec` omits, decoding **under a separately-identified
  language**.
- `--json` on stdout, rendered *from the store*.

**Should have (competitive):**

- Declining rather than annotating where bank state is path-dependent. **No comparable tool
  declines** — SVD-Loader, radare2's SVD import and IDA's device `.cfg` all annotate
  unconditionally (RECALLED, LOW). Consequence: no prior art to copy *and none to validate
  against*, which is the strongest argument for the control-observed-red discipline.
- The VIC-DMA graphics map fed back to both engines — the containment for the pipeline's worst
  failure (phantom labels minted inside a charset, promoted to Ghidra functions, emerging as
  confident wrong comments the next pass treats as established).
- Provenance-per-assertion in the store: which engine, which `memmapSha256`, which bank state.
- Launch-time `-warp` corpus sweeps. MEASURED behaviour-neutral: identical raster line, raster
  cycle and absolute cycle with and without it.

**Defer (v2+):**

- `program.c` emission as labelled derived evidence. Zero value until the five structural facts
  land from real code, and hand-written 6502 was never compiled from C, so there is no original
  C shape to recover.
- The withdrawn VICE `.lbl` symbol round trip (`ANNO-14`/`ANNO-15`) — a Validated capability
  with no route and no owning phase. Better value than any new interchange format, but out of
  this milestone by decision.
- Unbounded dxa <-> Ghidra convergence (`max_passes: 10`). Build pass 1 -> pass 2 as a *single*
  feedback step and measure whether pass 3 changes anything.
- Event-history replay as a determinism route — see Reconciliation 3.

**Excluded by decision or by evidence:** the `da65 .info` generator (Reconciliation 10); a
persisted `program.json` as a fourth model; float confidences merged by noisy-OR; `-limitcycles`
as a capture stop (it *quits*); `bsave`/`save` as the capture route; freezer-cartridge freeze; a
packer-specific unpacker; a GUI/TUI; a second machine map; hedged optimistic annotations; the
text-monitor client and the runtime-evidence layer (owner, 2026-09-02).

### Architecture Approach

The two new subsystems attach at two established seams and one new one. The capture work lives
**entirely inside the existing stock family** — no new tool name, no manifest change, no launch
flag — and the analysis work lives **host-side behind a child-process execution seam** whose
results cross back as *paths*, never payloads.

**Major components:**

1. **The reproducible-run protocol** — a named, single-seam procedure in the stock family, next
   to `stock-run-until.ts` (which already resumes exactly once and waits event-driven on
   `CHECKPOINT_INFO`, and is the precedent to copy). Exposed as an **optional argument on the
   existing `vice_run_until`**, which SKILL-01 permits and `manifest-arg-compat.test.ts` guards —
   avoiding the `=== 38` tool-count assertions three ways and the order-sensitive
   `BACKEND_SEAM_BYPASS_KEYS` speed bump.
2. **The `.vsf` `C64MEM` slicer** — pure, container-side, no emulator. Independent of the stop;
   **can be built in parallel**.
3. **The capture record + equivalence oracle** — schema, reproducibility key
   (`(binary sha256, argv digest, seed)`), enumerated allow-list with a committed size cap.
4. **The host-tool execution seam** — a namespaced, typed op on the existing broker control
   channel (`ControlRequestKind`), routed *before* any lease-bearing path and handed a deps
   object containing none of the seven VICE callbacks; work runs in a **child process, never the
   broker's own**; the reply is short and the artifact is a file.
5. **dxa** — `vendor/dxa/` at a pinned version, digest-gated build, plus an owned listing parser
   producing a code/data map that lands in the store's existing 12-member type vocabulary.
   Nothing new in the store schema.
6. **The Ghidra harness** — committed pre/post-script `.java` under `resources/` (auto-deployed
   host-side by `install-resources.ts`'s recursive walk and outside `resources-sync.test.ts`'s
   `.mjs`-only comparison — an existing, tested delivery channel with no new mechanism), plus the
   SLEIGH extension as its own Ghidra language.
7. **A container-side importer** — reads the export, greps the run log for the literal
   `ERROR REPORT SCRIPT ERROR`, preserves xref access kinds, and writes through the one store
   seam. Adding `anno_*` tools is the one surface that is extensible without a guard fight
   (`ANNO_TOOL_DEFINITIONS.length` is deliberately unpinned at `> 0`).

### Critical Pitfalls

1. **Host-clock-seeded RAM initialisation — the false-divergence generator nobody was looking
   at.** VICE prints a monotonically increasing `time()`-derived seed per launch; ~1.6% of a
   never-written window differs between cold boots, extrapolating to ~1,000 addresses of pure
   false divergence per capture pair *before the program executes an instruction*. Prevent with
   the determinism flag block in `buildViceArgs()`; the control is two cold boots without the
   flags differing and with them differing by **exactly zero**.
2. **Building the stop on an acquired warm instance — structurally unfixable.** The broker's warm
   floor defaults to 1 and `selectWarmInstance()` runs *first* on the acquire path, so a capture
   run's emulator was launched at an arbitrary earlier moment and has been executing ever since
   (6.7M cycles of measured phase spread). Prevent by making a monitor-issued hard reset the
   run's first act — strictly cheaper than making acquire mode-aware, because it needs no
   wire-format change and does not perturb the single-owner `inFlight` guard.
3. **Conflating instruction-exact with frame-exact with cycle-exact.** Three runs at the same
   instruction were byte-identical in PC, A, X, Y, SP, `$00`, `$01` and flags, and sat at raster
   lines **119 / 110 / 190**. A PC-only assertion passes on three runs in three different frames.
   `(LIN, CYC)` alone is blind to frame index — two stops one frame apart have *identical*
   `(LIN, CYC)`. Prevent with the triple plus the frame-anchor checkpoint.
4. **A failed SLEIGH compile leaves the stock `.sla` in place, and no `.ldefs` entry makes the
   extension inert.** `6502.ldefs` declares exactly two language ids and every existing repo
   artifact names `6502:LE:16:default`. The highest-probability outcome of a naive `OPC-*`
   implementation is a compiled extension, a green harness, and a decode that never used it.
   Prevent by emitting a **new** language id, changing `-processor` in the **same commit**,
   asserting on the language the log says it used, and checking `sleigh`'s exit code **and** the
   `.sla`'s existence **and** its mtime against every input spec.
5. **Silent success everywhere in the Ghidra path.** `analyzeHeadless` exits 0 when a post-script
   throws; the obvious log grep for `error`/`fail` false-fires on the flat-64K route's benign
   `Failed to add language defined memory block` INFO lines; `DataTypeManager` returns *empty,
   not an error*; `DecompInterface` timeouts yield no facts and no error; a >64 KiB inline return
   destroys the socket with no error frame. Prevent with three independent gates on every run
   (exit status, the exact literal `ERROR REPORT SCRIPT ERROR`, and a positive printed
   self-check), path-not-payload transport, and per-function attempted/decompiled/timedOut
   accounting under a committed ceiling.

---

## The Reconciliations

### 1. The `stopwatch` exclusion versus both measured recipes

**Binding decision.** The owner ruled out the text monitor's `stopwatch` by name on 2026-09-02
("stopwatch is nothing i want"); the text-monitor client and the runtime-evidence layer were
already out of scope. This is a decision, not a hypothesis.

**What it takes with it.** STACK.md's working frame-exact recipe converged on `F * 19656` cycles
by `stopwatch reset` plus counted `step` — the convergence loop, its instrument and its readout
are all on the excluded channel. PITFALLS.md has already been revised for this: it confirms its
own absolute-cycle figures (`2,076,872`, `2,224,669`, `23,999,976`, `17,874,837` and the rest)
came from the `STOPWATCH` column of the text monitor's register dump obtained by `r` over
`-remotemonitor`, **withdraws** its `stopwatch`-based proposal, and re-points every prevention
that rested on it. That provenance correction is preserved here rather than smoothed: the
*evidence* for the cycle-exactness finding used the excluded route, and it is recorded as a fact
about the apparatus.

**The one recipe that survives — assembled from both researchers' measured parts.**

```
1. Launch stock x64sc with the determinism block, after -default:
     -seed <fixed>  -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0
   (-default must still precede -binarymonitor; -drive8type 1541 ordering stays pinned;
    the fork argv stays byte-identical -- this is a stock-only argv change)
2. Connect ONE binary-monitor client. Set the target checkpoint WHILE HALTED
     -- CHECKPOINT_SET (0x12)
3. Set a second FRAME-ANCHOR checkpoint on a once-per-frame site
     (the raster IRQ vector, or a $D012-compare site)
4. Issue a monitor hard reset -- RESET (0xcc) -- as the run's FIRST act
5. Assert the main-CPU memspace: read registers with an explicit 0x00 memspace byte and
   confirm the PC advances under a single ADVANCE_INSTRUCTIONS. One round trip; converts an
   invisible drive-side poisoning into a named refusal
6. Resume EXACTLY ONCE; wait event-driven on THAT checkpoint's own CHECKPOINT_INFO (0x11),
   keyed on request-id-first demux. Never poll paused state
7. Record the stop as (PC, hit_count, (LIN, CYC)) -- REGISTERS_GET (0x31) for PC/LIN/CYC,
   CHECKPOINT_INFO (0x11) for both hit counts
8. Capture via .vsf DUMP + the C64MEM slice; normalise the $0000/$0001 port overlay IN CODE
9. Write the capture record: image sha256 + size + the triple + BOTH hit counts +
   (emulator binary sha256, argv digest, seed)
```

**Channel-independent, and therefore surviving intact:**

| Finding | Source | Label |
|---|---|---|
| `-raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0` -> three cold boots, one identical 64K sha256 (`39a71b10…`) | STACK.md A.4 result 2 | MEASURED |
| `-seed 4242` -> 67/4080 differing becomes 0/4080; `-raminitrandomchance 0` alone also 0/4080 | PITFALLS.md Pitfall 1 | MEASURED |
| The reproducibility key is `(binary sha256, argv digest, seed)` — same seed, two argv *orders*, 76 differing bytes | PITFALLS.md Pitfall 2 | MEASURED |
| `-seed` before `-default` still works (`-default` does not clobber it) | PITFALLS.md Pitfall 2 | MEASURED |
| The checkpoint stop is instruction-exact — PC == the checkpoint address in nine of nine runs | STACK.md A.2 | MEASURED |
| A monitor-issued hard reset erases 6.7M cycles of pre-connect phase noise; byte-identical stops under 0/1500/4000 ms jitter | PITFALLS.md Pitfall 4 | MEASURED (text instrument; the register/raster terms are binmon-native) |
| Warp is behaviour-neutral: identical raster line, raster cycle and absolute cycle with and without `-warp` | PITFALLS.md Pitfall 8 | MEASURED |
| `LIN`/`CYC` **are** returned by `REGISTERS_GET` (0x31) | `docs/phase0-binmon-findings.md` §1 | READ-IN-SOURCE |
| The honest transient set is 3 addresses of 1024 (`$00A2` TIME, `$00CD` BLNCT, `$01F2` above SP), and it is an **upper bound** measured under frame-divergent conditions | PITFALLS.md Pitfall 6 | MEASURED |
| The method (N >= 3 runs, union of differing addresses, size cap, plant a byte outside and observe red) is what carries forward — **not** the three addresses, which must be re-derived per release | PITFALLS.md | MEASURED + reasoning |
| `reset 1` runs past the reset vector, so `$FCE2` never fires as a post-reset anchor; `$E453` works | STACK.md A.5 | MEASURED |
| `-limitcycles` quits the process, destroying the machine | both | MEASURED |

**What must be re-implemented on the binary monitor:**

- **The cycle readout.** Replaced by the triple `(PC, hit_count, (LIN, CYC))`. `hit_count`
  supplies the frame-index term that `(LIN, CYC)` is structurally blind to, and it is already how
  this project detected the `danish` divergence. It is a frame counter **only** on a once-per-frame
  site — hence the mandatory frame anchor; without it the triple silently degrades to
  `(PC, (LIN, CYC))`.
- **The convergence loop.** Deleted, not ported. "Stop at frame F" over a counted `step` against
  a monotonic clock has no 3.9 binary-monitor equivalent. What replaces it is `hit_count` on the
  frame anchor. `ADVANCE_INSTRUCTIONS` (0x71) remains available as a *step* (never a resume, so
  invariant 1 survives by construction) but any alignment loop built on it needs an absolute cycle
  to align *to*, which is 3.10-only.
- **Do NOT revive phase 0's Route B cycle reconstruction.** Phase 0 already decided to drop it,
  and PITFALLS.md adds an independent reason: an incidental measurement came out at 39,314 cycles
  over two frames = **19,657 per frame** against phase 0's documented PAL **19,656** — a
  one-cycle-per-frame accumulating error, exactly the error a reconstructed clock accumulates.
  Note this also **withdraws STACK.md's empirical confirmation of 19656**, which was obtained by
  `stopwatch` convergence: the cycles-per-frame constants revert to **SOURCE-read from
  `src/c64/c64.h`**, unconfirmed on the binary monitor.

**Status of the surviving recipe: PARTLY UNVERIFIED, and say so.** The protocol is
binary-monitor-*expressible* — every term has a named opcode at the 3.9 floor — but it has never
been *executed* over the binary monitor. Every probe that established its jitter-immunity used
the text channel as its instrument. **The probe that closes the gap, and it is cheap:** run the
full protocol end to end over `-binarymonitor` against `/usr/bin/x64sc` under 0 / 1500 / 4000 ms
jitter — `CHECKPOINT_SET`, a frame anchor, `RESET`, one resume, `REGISTERS_GET` asserting `LIN`
and `CYC` are present in the returned register list, `CHECKPOINT_INFO` hit counts — and compare
the `.vsf`-sliced 64K across N >= 3 cold runs. This should be the **gate phase's opening task**.

### 2. Is a text-monitor client needed at all this milestone? — NO. Scope boundary.

FEATURES.md calls the text-monitor client "the keystone", ranks it **P1** and "sequence it
first", and treats `stopwatch` as *the* mechanism for the frame-exact stop. STACK.md used the
text channel as its instrument throughout and lists it as a hard integration point ("a
text-monitor client is new code"). PITFALLS.md, post-revision, **inverts its own
integration-gotcha row to "do not dial it this milestone"**.

**Resolved against the owner decision: PITFALLS.md's position governs.** The scope boundary a
roadmapper can act on:

- **No text-monitor client is built.** No `channel: "binary" | "text"` discriminator on
  `monitorClient`. The `-remotemonitor` port stays **allocated on every stock launch and
  undialed**, as it has been since Phase 3. Leave it that way.
- **Everything reached only through that channel is out:** `stopwatch` (column and command),
  `step <n>` without the 16-bit cap, `ignore <cp> <count>`, `chis` on 3.9, `memmapshow` /
  `memmapzap` / `memmapsave`, `prof`, `bsave`, runtime `warp on`/`warp off`.
- **Warp is a launch-time dimension again** — `-warp` / `InitialWarpMode`, chosen per instance,
  which puts it back inside the warm-instance-eligibility problem.
- **FEATURES.md's four unblocked features are each re-routed or dropped:** the frame counter ->
  `hit_count` on a frame anchor; the `memmapshow` execution map -> **out of scope** (see the gap
  this creates, below); runtime warp -> launch-time; `chis` cycle history -> the 3.10-only
  `CPUHISTORY_GET` strengthening.
- **A consequence the roadmapper must see.** Two PITFALLS.md preventions name "a VICE runtime
  inventory of which addresses actually executed" as the external oracle — for the dxa
  ground-truth partition (Pitfall 9) and for `C2_SITES_ENUMERATED`, the non-Ghidra denominator
  in the unresolved-dispatch join (Pitfall 17). FEATURES.md names the same thing as the missing
  external oracle for `AUTO-04`. **That oracle is `memmapshow`, and it is excluded.** Neither
  researcher noticed the collision. The affected requirement text must be amended to name a
  binary-monitor-reachable enumerator (checkpoint sweeps on `hit_count`, or `CPUHISTORY_GET` on
  >= 3.10) or to state the oracle as absent — see the amendment list.

### 3. Event record/replay — the scope decision stands, its named mechanism does not exist

The milestone was opened with the seed's "reproducible-runs half" IN scope *specifically on the
strength of event record/replay as a candidate mechanism*.

**Consequence, stated plainly: the scope decision stands and is now better served, but the
mechanism it was justified by is unreachable.** STACK.md rules it out on three independent
grounds, each measured:

1. **No `-record` / `-recordevents` option on any version, on either binary.** `cmdline_options[]`
   in `event.c` registers exactly six: `-playback`, `-eventsnapshotdir`, `-eventstartsnapshot`,
   `-eventendsnapshot`, `-eventstartmode`, `-eventimageinc` (SOURCE). `/usr/bin/x64sc -record` ->
   `Unknown option '-record'`, exit 255 (MEASURED). **Playback is launch-time; recording is not.**
2. **`event_record_start()` has no non-UI caller** — a GitHub code search over the VICE mirror
   returns six files, and it is reachable only as GTK3/SDL UI actions (MEASURED + SOURCE).
3. **No binary-monitor opcode addresses it, on any version** (PRIMARY, this repo's own
   `enum t_binary_command` inventory).

FEATURES.md adds two independent reasons to keep it excluded even if it were reachable: VICE's own
manual disclaims replay accuracy ("may not be 100% accurate even with all the recommended
settings", and acknowledges a differing playback session as a real outcome), and it records **user
input** — joystick, keyboard, reset, image attach, datasette — not a depack path, which needs no
input at all.

**The replacement is the reset + RAM-init-pinning protocol** of Reconciliation 1, which is
cheaper, needs no launch-mode field on the acquire frame, and does not have to be retrofitted to a
warm instance. ARCHITECTURE.md's independent cost analysis agrees: record/replay is launch-time,
so it drags in a mode field, mode-aware warm-instance eligibility, an `InstanceRecord` launch-mode
field, and a decision about what `maintainWarmFloor()` pre-warms — and `selectWarmInstance()`
would silently hand a replay-requesting caller a plain interactive instance, the one outcome the
headless todo says to rule out.

**The trap that makes the wrong belief plausible, named explicitly:** the stock text monitor's
command list *does* contain `playback (pb)` and `record (rec)` — under the heading **"Command
file commands"**. `help record` returns *"After this command, all commands entered are written to
the specified file until the STOP command is entered"* (MEASURED). **That is monitor-command file
scripting, not event history.** Anything planning against "the monitor has `record`" is planning
against the wrong feature. PITFALLS.md's warning sign stands: *a plan whose first task is
"evaluate event record/replay"*.

### 4. The frame-exact stop's actual size — reusable at 3.9 vs 3.10-only vs new

All three of STACK, ARCHITECTURE and PITFALLS conclude independently that the stop is **smaller
than the milestone assumed and is not a research phase**. They disagree on what already exists.

**Genuinely reusable at the VICE 3.9 floor:**

- `stock-run-until.ts` — `handleRunUntil()`, `waitForCheckpointHit()`: already arms a stopping
  exec checkpoint, resumes **exactly once**, waits **event-driven** on that checkpoint's own
  `CHECKPOINT_INFO`, and takes a *different* cleanup action on each of three paths (hit / timeout /
  restarted). This is the precedent, and it already satisfies both `vice-sync.ts` invariants —
  invariant 2 *a fortiori*, since it never polls at all.
- `stock-timing.ts`'s `resolveVideoStandard()` and `VIDEO_STANDARDS` (`cyclesPerLine` /
  `screenLines` per standard) as **SOURCE-read constants**, and `positionWithinFrame()`.
- The `ADVANCE_INSTRUCTIONS` (0x71) wire op — encoder and handler both exist. Note it is a
  *step*, not a resume.
- `REGISTERS_GET` (0x31) returning `LIN`/`CYC`; `CHECKPOINT_INFO` (0x11) `hit_count`;
  `RESET` (0xcc); the `.vsf` `DUMP`/`UNDUMP` route.

**3.10-only, and this host runs 3.9:**

- `stock-timing.ts`'s `readCycleBaseline()` **Route A** — it reads `CPUHISTORY_GET`'s newest
  entry's monotonic uint64 `cycle`, and that opcode does not exist on 3.9. ARCHITECTURE.md
  presented the frame arithmetic as "already built"; it is built **on a route this host cannot
  take**. On 3.9 the honest answer for absolute cycle is a **named refusal** in the
  `capability-registry.ts` idiom, not a degraded guess.
- Route B (reconstruct from `LIN`/`CYC`) is exact only *within* one frame and refuses across a
  proven boundary — which is precisely the measurement a frame-exact stop needs. **Do not revive
  it** (PITFALLS.md's 19,657-vs-19,656 measurement; `stock-timing.ts:30-31` already forbids
  guessing a `+ k * cyclesPerFrame` correction by name).

**New:**

- The reproducible-run protocol as a **named single-seam procedure** with the reset inside it.
- The frame-anchor checkpoint and the two-hit-count capture record.
- The determinism argv block in `buildViceArgs()` (stock branch only) and the reproducibility key.
- The main-CPU memspace assertion after reset.
- The equivalence predicate, the enumerated allow-list, its size cap, and the
  `$0000`/`$0001` normalisation **in code**.
- The pre-committed gate's own rules, input domains and rule ordering.

**Net.** The *mechanism* is roughly ARCHITECTURE.md's "~1 new function" plus a handful of
existing calls. The *protocol, record schema, oracle and gate* around it are the phase, and they
are a real phase. Reconciled verdict: **not a research phase; a protocol-and-oracle phase, whose
first task is the binary-monitor re-instrumentation probe from Reconciliation 1.**

### 5. ARCHITECTURE.md finding 4 versus the milestone's founding measurement

Finding 4 claims: the 201-divergence `danish` measurement is **fork** evidence; the fork's stop is
asynchronous ("reports its hit but pauses roughly a frame later, at a wall-clock-determined
instruction") while stock's checkpoint fires **synchronously from inside the CPU loop**
(`mon_breakpoint.c:557-562`); therefore **no measurement of the stock stop's frame reproducibility
existed in this repository**, and step zero of the phase is a re-measurement on stock.

**Verdict: the recommendation is DISCHARGED; the reasoning is CONFIRMED and should be carried.**
PITFALLS.md and STACK.md have both since produced exactly such measurements on genuine stock 3.9 —
the instruction-exact stop across nine runs, and the byte-identical reset-protocol stop under
0/1500/4000 ms jitter. Finding 4's *explanation* is the right one and explains why every prior
observation looked nondeterministic: fork stop + warm instance + unpinned seed, three
nondeterminism sources superimposed.

**What the gate phase's opening measurement should be instead** — three things, in order, none of
which any researcher has run:

1. **Re-instrument the protocol on the non-excluded channel.** The whole probe suite ran over
   `-remotemonitor`. Re-run it over `-binarymonitor` (Reconciliation 1's probe). Until this is
   done the surviving recipe is PARTLY UNVERIFIED.
2. **Run it on an autostarted real cracked release, not the KERNAL `READY` prompt.** Every
   measurement to date sat at the prompt. The transient allow-list *will* be different on a real
   release (the program's own frame counters, RNG state, sprite positions, music-player pointers)
   and must be re-derived per release under the protocol. And true drive emulation enters the loop
   for the first time — an open question, below.
3. **Observe the negative control red.** STACK.md's result 3 is the ready-made one: three runs
   anchored on a wall-clock moment produced identical PC/A/X/Y/SP/flags and `LIN` of **116, 223
   and 267**. Same instruction, three different frames, observed red without the fix.

### 6. The SLEIGH source — the diagnosis converges, and the carried claim is FALSIFIED

**Both researchers compiled the committed source in `docs/undocumented-opcodes-ghidra.md` against
real Ghidra 12.1.3 `support/sleigh` and both got the identical result:** 8 failing constructors,
all `Could not resolve at least 1 variable size`, `ERROR No output produced`, exit 2, **no `.sla`
written** — each with a passing control (stock `6502.slaspec` compiled clean in the same scratch
directory with the same binary, producing a 5094-byte `.sla`, byte-size identical to the shipped
one). That is a defect-observed-red / control-observed-green pair in the exact form this project's
standing constraints require.

**Reconciled diagnosis — one root-cause class, no conflict between the two accounts.** SLEIGH
cannot infer a size for a token field used directly as a `define pcodeop` argument or as a
dereference address. STACK.md's two flavours and PITFALLS.md's per-line table describe the same
eight constructors:

| `.sinc` line | doc line | constructor | flavour |
|---|---|---|---|
| 217 | 220 | `:NOP imm16 is op=0x0c` (`local ignored:1 = *:1 imm16;`) | unsized deref address |
| 390 | 393 | `:LAX "#"imm8 is op=0xab` (`unstableLAXImmediate`) | userop arg/return has no intrinsic size |
| 449 | 452 | `:SBC "#"imm8 is op=0xeb` (`undocSBC(imm8)` -> `zext(value)`) | constant token field feeding a sized expression |
| 458 | 461 | `:XAA "#"imm8 is op=0x8b` (`unstableXAA`) | userop |
| 493 | 496 | `:AHX imm16,Y is op=0x9f` (`unstableAHXStore`) | userop |
| 504 | 507 | `:TAS imm16,Y is op=0x9b` (`unstableTASStore`) | userop |
| 518 | 521 | `:SHY imm16,X is op=0x9c` (`unstableSHYStore`) | userop |
| 525 | 528 | `:SHX imm16,Y is op=0x9e` (`unstableSHXStore`) | userop |

**The fix, and PITFALLS.md is strictly stronger here because it ran it.** Introducing explicitly
sized locals for the token fields inside each affected constructor —
`local i8:1 = imm8;` then pass `i8`; `local a16:2 = imm16;` then pass `a16` and deref `*:1 a16` —
compiles the **entire** file clean: `t.sla` produced (8,423 bytes), **zero errors**, only warnings
(`2 NOP constructors found`, `5 operations wrote to temporaries that were not read`, plus one
inherited from stock). MEASURED. STACK.md's independent read of the root cause agrees and adds the
constraint that fixing them must **not** collapse the six userops into deterministic p-code: `XAA`
(`$8B`) and immediate `LAX`/`LXA` (`$AB`) are electrically unstable and stay black-box, and
`AHX`/`TAS`/`SHX`/`SHY` keep the nominal effective address for static references while the
*stored value* stays a userop. The declared-unknown modelling is conceptually right and
syntactically incomplete — the worst combination, because it reads correct.

**Consequence for `OPC-01..03`, unambiguously.** This **FALSIFIES** the carried
ROADMAP/PROJECT.md claim that *"the extension source exists in full … `OPC-01..03` integrate and
verify it; they do not write it."* The requirement text must be re-scoped to **fix, compile,
integrate and verify**, and corrected **at source** rather than annotated — this project's own
convention. PITFALLS.md records it as the **seventh** instance of its "asserting the fix instead
of observing red" defect class, one level up: a stale premise restated confidently across at least
three planning artifacts, found by *running* the thing rather than reading about it.

**The silent-failure risk both researchers identify, carried forward.** `6502.ldefs` declares
exactly **two** language ids (`6502:LE:16:default` -> `6502.sla`, `65C02:LE:16:default` ->
`65c02.sla`); every existing repo artifact — Phase 23's recorded command line, its
`instrument-provenance.txt`, the wrapper-proposal todo — names the **stock** id; and a failed
`sleigh` leaves the pre-shipped `6502.sla` in place. So an unchecked build yields a **GREEN run on
a language that decodes none of the 105 bytes**. Three cheap checks, because each fails
differently: `sleigh`'s exit code, the `.sla`'s existence, and its mtime against every
`.slaspec`/`.sinc` input. Plus: never write the compiled `.sla` over a stock language's file, so a
failed compile leaves the pipeline pointing at a language that *does not exist* and refuses
loudly. And the control that must be observed red — run the acceptance image under
`-processor 6502:LE:16:default` and observe the 105-byte assertion **fail**; two runs, one flag
apart. (Related trap: stock `6502.slaspec` itself emits `WARN … Unreferenced table: 'ADDR8'`, so a
gate treating any `WARN` as failure reddens on Ghidra's own shipped language.)

**STACK.md's measured good news, alongside it.** A drop-in language extension needs **no Gradle
and no Ghidra rebuild** — the minimum file set is a `Ghidra/Extensions/<Name>/` module with a
possibly-empty `Module.manifest`, `extension.properties`, `data/sleighArgs.txt`, and
`data/languages/` holding the `.ldefs`, `.slaspec`, `.sla` and copied `6502.pspec`/`6502.cspec`;
built with `support/sleigh`, then `-processor 6502:LE:16:nmos` ran headless to **exit 0** with
`Using Language/Compiler: 6502:LE:16:nmos:default`. MEASURED end to end, and the probe extension
was removed afterwards. **This also supplies the clean answer to the `65c02.slaspec` collision:**
a new `variant` under the existing `processor="6502"` gives the extension **its own language id**,
leaving stock `6502:LE:16:default` and `65C02:LE:16:default` untouched — so the opcode-byte
collision the doc warns about cannot arise, and FEATURES.md's "the extension needs a THIRD
slaspec" is satisfied by construction. MEASURED confirmation that the layering itself is sound:
the `@include "6502.slaspec"` wrap produced **no byte-value collision error at all**.

**Do not commit the `.sla`.** Build it and guard the build. A committed `.sla` is a binary blob
whose staleness is undetectable by review, tied to a Ghidra version the repo does not pin. (If a
committed one is ever preferred, the repo already has the generated-but-committed pattern with a
drift guard — decide deliberately, and note it *pins* the Ghidra version.)

### 7. The Ghidra execution seam — one recommendation, dissent recorded, ordering constraint

All four documents touch it. The positions:

- **STACK.md (MEDIUM confidence, survey):** JVM startup measured at **12,591 ms and 17,386 ms**
  to reach `Headless startup complete`, before any import. Every comparable project surveyed
  converges on **one resident JVM holding the project open, reached over a localhost socket** —
  PyGhidra (in-tree), pyghidra-mcp, ghidra-headless-mcp, ghidra-cli — explicitly because
  per-invocation startup is prohibitive. Notes the striking parallel: *that is the same design as
  this project's own VICE broker*. Its own opinion, though, is **option 1 with a batch framing**
  (a namespaced job op, child process, results as files), with the leased subsystem as "the right
  end state if Ghidra ever becomes interactive".
- **ARCHITECTURE.md:** **B3 for the artifact, B1's namespace for the control message** — a
  filesystem handoff for the export plus one short typed op on the existing control channel — and
  **REJECTS the leased subsystem (B2) now**, because the lease has no subject: Phase 23's own
  command line used `-deleteProject`, so with one project directory per run there is no cross-call
  state to lease. It records the **reversal condition** in the style of the project's own Rule A21:
  reintroduce a leased warm JVM only if per-run JVM startup is *measured* to dominate a real
  analysis session.
- **PITFALLS.md:** does not choose, but constrains hard — the 64 KiB cap with a silent
  `destroy()`; the broker's shared process fate (`broker-kill.mts:367-374` turns any unhandled
  throw into kill-and-exit for the **entire VICE pool**); PID reuse over a minutes-long window
  (use `verifiedKill()` by identity, never `kill(pid)`); the lease model's mismatch (connection-is-
  the-lease means a client dying mid-analysis either orphans a writer or throws away a
  multi-minute run — **decide and record, do not default**); and the concurrency hazard being the
  same *shape* as the 2026-08-01 triple-launch outage with three worse properties.
- **FEATURES.md:** the decision must be made **BEFORE the post-script is written**, because it
  determines the transfer mechanism, which determines the post-script's output format.

**Reconciled recommendation (adopt):**

> A **typed, namespaced op on the existing broker control channel** (`ghidra.*` / `dxa.*`, routed
> at the top of `handleLine()` before any lease-bearing path, handed a deps object containing
> none of the seven VICE callbacks, never argv passthrough), executing in a **child process,
> never the broker's own**, with **batch framing** (`-process` plus `-log`/`-scriptlog` to a file
> so one JVM invocation covers many post-scripts), **one project directory per run id** under a
> controlled non-dot-prefixed root with `-deleteProject`, and the artifact returned as a
> **path + sha256 + byte length**, translated through `containerpath.ts`. The JVM's lifetime
> binding to the connection is a **recorded decision either way**, not a default.

One project dir per run id makes the single-owner guard **unnecessary rather than cheap** — which
is strictly better than a lock, and is what Phase 23 already did by accident. If a persistent
project is later wanted for incremental re-analysis, build the guard by copying `inFlight`'s shape
(a synchronous check-and-set with **no `await` between**), plus what `inFlight` did not need: a
recorded holder identity, a stale-holder timeout, and a "who holds it and why" answer for the
waiter.

**Dissent recorded.** STACK.md's resident-JVM survey is the strongest evidence *for* B2 and it is
MEDIUM-confidence web survey across four projects, none inspected at source level. Its 12–17 s
measurement is real and is the reason batch framing (not per-query invocation) is mandatory. The
resident JVM is the **named reversal target**, and the milestone should state which of the two
futures it is building toward rather than discovering it later.

**One unexpectedly clean delivery channel, verified (ARCHITECTURE.md).**
`install-resources.ts` deploys `resources/` to `<root>/tools` by a **recursive walk**, explicitly
so a later-added file deploys with no code change, and `resources-sync.test.ts` scopes its
byte-identity comparison to `.mjs` only. So a committed `.java` post-script or a `.slaspec` under
`resources/` is **auto-deployed host-side and outside resources-sync's scope** — an existing,
tested container->host file-delivery channel with no new mechanism. Caveat: a `.sh` there **is**
caught, by `host-scripts.test.ts`'s repo-wide 5-entry set.

**Phase-ordering constraint, stated for the roadmapper:**

> **The execution-seam decision is a PRECONDITION, and it must be its own phase between the
> capture work and the engine work.** It gates (i) the post-script's output format (FEATURES.md),
> (ii) any skill script reaching for Ghidra or dxa (PROJECT.md's own open question), and (iii) the
> retroactive migration of `acme.mjs`'s `spawnSync("acme", …)` PATH ladder and
> `packer-finding.mjs` — because the grep gate banning external-binary spawns in
> `src/skills/*/scripts/` **can only be written once nothing violates it**. dxa becomes the third
> consumer on day one; the seam has at least four callers immediately. Building it after the
> engines means writing the violation twice and migrating it.

### 8. Where recovered facts land — converged, and the role assignment

**ARCHITECTURE.md and FEATURES.md reached the same place independently, and the answer is
confirmed: the Ghidra post-script does NOT write into the store.**

ARCHITECTURE.md finds option (ii) **structurally unavailable** on this project's own rules:
`anno-seam.test.ts` asserts `node:sqlite` is named by **exactly one** module of the shipped set
(`THE_ONE_SEAM = "anno-store.ts"`), with a second declared list for test files precisely because
"outside the scope of the guard is how a dependency spreads unnoticed" — so **a Java SQLite writer
is outside every guard's scope entirely: not a violation the guard catches, a violation it cannot
see.** It would also have to re-implement `openStore()`'s confinement refusal (whose escape hatch
is deliberately named `unconfinedModuleDerivedPath` so a grep finds it, and against which a real
symlink escape is recorded), the narrowest-range-wins paint index (proven exact at all 65,536
addresses against an independent oracle), and the revert journal — and it inverts the
container-in / host-out split, making the store's `SIGKILL`-proven durability a claim about two
processes in two languages on two sides of a mount.

FEATURES.md adds **unanimous prior art**: 6502bench SourceGen's `.dis65` stores *only metadata*;
Ghidra keeps its project database plus a separate analysis log; Mesen's NES CDL is a pure
per-byte execution-evidence file deliberately *not* the annotation model. The unanimous pattern is
**one model, generated views, and evidence files kept strictly outside the model.**

**Role assignment per artifact:**

| Artifact | Role | Rule |
|---|---|---|
| dxa listing (`-a dump`) + its `-v` stderr phase log | **Evidence** of one discovery run | Parsed once by the owned refusing parser; never a model |
| Ghidra export (`program.json` / classification / structural facts) | **Transient evidence** of one run, with a recorded content hash | Consumed by the container-side importer and **never read after import**. Not a deliverable, not a model — so nothing can drift *from* it |
| `.annostore` | **The one authoritative model** | Every accepted fact becomes a store row, through the one seam |
| `program.asm` | A **rendering** of the store, via the already-shipped `anno export-asm` under a real-ACME byte-diff oracle | Derived on demand; do not re-scope |
| `program.c` | **Labelled derived evidence** behind each structural fact | Never an input to the store; never one of three co-equal deliverables. Accept the pass on the five structural facts, never on the C's readability |
| `--json` on stdout | A **rendering** from the store | Table stakes as a rendering; anti-feature as a persisted fourth artifact |

**One residual tension, resolved.** FEATURES.md wants the transfer file "consumed and deleted
within the same command"; ARCHITECTURE.md wants it kept in the evidence tree with a content hash.
Both are right at different times: **keep it as committed evidence during the gate and `PROOF-*`
phases** (the measurement needs it, and the digest is the reproducibility key's other half), and
treat deletion as the steady-state default afterwards. The durable rule is the invariant both
agree on: **never a model, never read back as input.**

**Two obligations the importer inherits**, both from Phase 23's measured evidence: it must grep
the run log for the exact literal `ERROR REPORT SCRIPT ERROR` (container-side, in the importer —
not in the post-script), and cross-references must carry their access kind
(`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`) — the pivot's three decisive facts are all
kind-bearing, and `STORE-06`'s union must not flatten kind out on the way in. The importer is the
one surface extensible without a guard fight: `ANNO_TOOL_DEFINITIONS.length` is asserted only
`> 0`, and adding tools flows through the single existing registration loop, so it adds **no**
entry to `BACKEND_SEAM_BYPASS_KEYS` and keeps MCP-02 satisfied by construction.

### 9. The corrected prerequisite set

`ROADMAP.md` calls the frame-exact stop "the single gate". **It is the single gate on
*measurement*, and it is not the only missing input.** FEATURES.md measured the host this session:

- **dxa is NOT installed anywhere** under `/home`, `/opt` or `/usr/local`. MEASURED.
- **Ghidra 12.1.3 exists only as an out-of-tree probe unpack** at
  `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` — **not pinned, not vendored, not on
  `$PATH`**, and that install's own README disclaims being depended on. MEASURED.

**Corrected prerequisite set, all five items real work rather than a setup footnote:**

1. **The reproducible-run protocol + frame-exact stop** (the gate on measurement).
2. **The `.vsf` `C64MEM` slicer** — the *other* capture blocker; independent of (1), can run in
   parallel. Removes the transcription route that lost a 32 KB write to truncation and an 8 KB
   write to ten dropped characters.
3. **A vendored, digest-gated, built dxa** at 0.1.5, with `make test` wired as a post-build gate.
   Override `CC`/`CFLAGS` from the environment rather than patching the `Makefile`; leave
   `LONG_OPTIONS` off (a build-time toggle that changes the CLI surface is exactly the drift a
   pinned vendored tool should not have).
4. **Ghidra as a declared host prerequisite recorded by version**, inside a committed harness
   "reproducible by a second run from a clean project". Fetch at first use; the release digest is
   publishable and stable (`93a5d11a…fd54`, 543 MiB). JDK >= 21 is already present.
5. **The host-tool execution seam** (Reconciliation 7) — a precondition for 3 and 4 both.

**dxa's packaging gap, carried from STACK.md (MEASURED).** GPL-2.0-or-later, but **there is no
`LICENSE`, `COPYING` or `GPL` file anywhere in the tarball** (full `ls -a`). The notice exists
only as a per-file C comment header (`main.c:1-23`), with a **two-party copyright** — Marko
Makela 1993-94 for d65, Cameron Kaiser 2005-2019 for dxa — and the header says 2005-2019 while the
tarball is dated 2022, an internal inconsistency **worth reproducing rather than smoothing**.
There is also **no upstream signature or checksum** of any kind (no `.asc`/`.sig`/`.sha*`/`.md5`);
the only corroboration for the pin is FreeBSD ports `devel/dxa65`'s distinfo. Consequences for
`THIRD-PARTY-NOTICES.md`: the notice must be **quoted from the source headers** (there is no file
to copy) and this project must **supply the GPL-2.0 licence text itself**. Also: dxa's own
`INSTALL` (not the man page) says *"this is still considered \"alpha\" software"*.

### 10. The `da65 .info` anti-feature — a decided exclusion, with its evidence

FEATURES.md rejects it on **six grounds, five measured this session against installed
`da65 V2.18 - Debian 2.19-2`**. Carried as a decided exclusion because an **untracked** design
note in the repo — `docs/dissambler-workflow.md` — proposes it as its whole back half, and will be
re-proposed.

1. **No split, struct, pointer-pair or record type.** The complete `RANGE TYPE` vocabulary is
   exactly nine values (`ADDRTABLE BYTETABLE CODE DBYTETABLE DWORDTABLE RTSTABLE SKIP TEXTTABLE
   WORDTABLE`); `grep -iE 'struct|split|pointer|ptrtable'` over the binary's strings returns
   **zero** (MEASURED). Verified behaviourally the same session: given `tab_lo`/`tab_hi` as two
   `BYTETABLE` ranges, da65 emitted two unrelated `.byte` runs and left the `jmp (ptr)` target
   unresolved. The store's frozen vocabulary has **12** members *with the four split layouts as
   first-class members* — the milestone's one irreversible decision. Exporting through `.info`
   throws away exactly the members that cost the most to get right.
2. **A comment cannot exist without a symbol.** `LABEL { ADDR $1005; COMMENT "…"; }` with no
   `NAME` is a hard error — `c.info(4): Error: Label name is missing`, exit 1 (MEASURED). The
   auto-annotation feature's *entire output* is comments on machine addresses, so rendering them
   through `.info` would force a minted label per annotated address, corrupting the symbol
   namespace to carry comment text.
3. **`TYPE SKIP` emits nothing at all**, so the byte-for-byte rebuild the back half exists to
   enable is **silently wrong**. MEASURED: no `.res`/`.org`/`.segment` in da65's output; **ca65 +
   ld65 assembled cleanly and produced a WRONG binary** — differing at byte 2, the 18-byte hole
   collapsed, `lda tab_lo,x` re-assembled as `$100E` instead of `$1020`. A clean assemble over a
   wrong binary is this project's canonical failure shape.
4. **`PARAMSIZE` — the one construct the note names it for — did not fire.** Present in the
   V2.18 binary and parses without error, with or without a covering `TYPE Code` range (MEASURED,
   repo 2026-08-24).
5. **Wrong assembler.** It emits ca65; this project's toolchain, shipped exporter and only
   real-assembler oracle are all ACME, and multi-assembler output is **already Out of Scope by
   owner decision**.
6. **Wrong goal.** `.info` -> `da65` -> `ca65`/`ld65` -> `cmp` serves byte-for-byte reconstruction,
   which the pivot decision explicitly rejected as the goal and which v0.6.0's research showed is
   structurally *undefinable* here — there is no canonical original binary, only a
   provenance-graded composite with ranges honestly `UNKNOWN`.

**Where to point the impulse instead.** If the underlying wish is a third-party-readable
interchange artifact, `.info` fails on expressiveness alone. The interchange gap that actually has
users is the **withdrawn VICE `.lbl` symbol round trip** (`ANNO-14`/`ANNO-15`) — a Validated
capability with no route and no owning phase. Better value for the same effort, and it closes a
known regression. (Out of scope this milestone by the 2026-08-26 "no parity is owed" decision.)

---

## Cost Inventory the Roadmapper Needs

### The guard-breakage inventory (~18 committed guards will go red)

**Reviewed decisions — the guard exists to force an argument; papering over it is the defect:**

| Guard | Trips on | Note |
|---|---|---|
| `ControlRequestKind` byte-exact declaration (`broker-control.test.ts`) | **Any** new control-plane op — `ghidra.*`, `dxa.*`, `tool.*` | Unavoidable in every execution-seam option; not a discriminator between them |
| `BACKEND_SEAM_BYPASS_KEYS` — 2 entries, order-sensitive `deepEqual` (`stock-dispatch.test.ts`) | A third proxy-local tool family via `buildViceTool()` | Its own comment: "A THIRD entry collides here rather than being absorbed into a superset." **Avoid by extending `ANNO_TOOL_DEFINITIONS` instead of adding a family** |
| `EXPECTED_IMPORTERS` — 5-member host-path consumer set (`hostpath-consumers.test.ts`) | Any new module importing `hostpath.ts` — i.e. anything translating a Ghidra/dxa artifact path | Header: "Widening the five-member list below is a REVIEWED DECISION, not a mechanical fix for a failing test" |
| `EXPECTED_EMULATOR_SPAWN_SITES` — exactly 1 (`spawn-seam.test.ts`) | **A trap:** the discovery predicate matches `\bbinPath\b`, so a host-tool executor writing `spawnSync(binPath, […])` for **Ghidra** is counted as an *emulator* spawn site and reds the `=== 1` assertion | Avoid by naming the local `toolPath` / `ghidraPath`, or widen the set deliberately |
| `MANUAL_ONLY_TESTS` — exactly nine files (`test-gate.test.ts`) | A new live suite (live Ghidra, live frame-exact) not added to the list | Consequence: it silently runs in `test:automated` and fails on any machine without Ghidra |

**Mechanical, but easy to miss:** the three whole-argv `assert.deepEqual` assertions in
`broker-launch.test.ts` (**avoidable** — an optional field defaulting to absent keeps all three
green, and the ordering assertions were written to survive additions); the fork argv byte-identity
promise (a Validated v0.2.0 requirement, not just a test); `build.ts`'s `HOST_BOUND_ARTIFACTS`
exact emitted set (`build()` **throws**, and `resources-sync.test.ts` fails in **both**
directions — a differing committed file *and* a missing one a fresh build produces);
`EXPECTED_TRACKED_SHELL_SCRIPTS` (repo-wide `git ls-files -- *.sh`, 5 entries — **any** new `.sh`
anywhere, a dxa `build.sh`, an `analyzeHeadless` wrapper); `anno-verb-coverage.test.ts`'s
`REAL_VERBS`, scanning **both** `src/skills/` and `installer/skills/`;
`check-skill-tool-coverage.mjs` (allowlists designed to "SHRINK BY FAILING");
`check-skill-cli-invocations.mjs`; `shippedTsModules()` throwing on a `files[]` entry missing from
disk; `check-npm-packages.mjs`'s leak checks (`node_modules/`, `*.test.*`, `fixtures/` — note
vendored C under `vendor/` is **not** caught, so decide `files[]` membership deliberately);
`ci-suite-coverage.test.ts` (a committed test file in a directory with no matching `ci.yml` step —
a new `vendor/dxa/` or Ghidra script test dir needs a CI step in the same commit);
`docs-deferred-ledger.test.ts` (fails in **both** directions on resolving the frame-exact /
headless / vsf / Ghidra-proposal todos without moving their `STATE.md` rows);
`docs-linerefs.test.ts` (verified correct at HEAD: `:3050` / `:2985` / `:1529` / `:1505` — but
adding an interception near `forwardToVice()` shifts all four, and these citations were stale
twice before); `docs-dangling-refs.test.ts` (**rename `ExportAnalysis23.java` / `FlatVolatile.java`
on promotion out of `.planning/phases/`**); `absorbed-answer-key.test.ts`;
`audit-integrity.test.ts` (cites `vice-sync.ts`'s untested waits by name).

**PITFALLS.md adds the blind spot that no guard catches.** `hostpath-consumers.test.ts`'s
non-vacuity floor is `ANNO_MODULE_FLOOR = 16 + 1`, **pinned deliberately over the `anno-*`
prefix**, with a comment that "THE FLOOR MUST NEVER BE DERIVED FROM DISK." A new
`ghidra-*` / `dxa-*` family is **outside its scan entirely** — adding forty such modules does not
move it and does not trip it. And the "exactly five declared modules" assertion *will* fire when
the new family imports `hostpath.ts`, but the natural repair — adding the module to the declared
list — **converts a closed set into an open one, one entry per milestone.** Two obligations
follow: prefer **not to become a consumer** (put the path translation in **one** new declared-
consumer module and have the rest of the family reach it through that, turning "N new consumers"
into "one" — the `anno_*` by-construction precedent), and when the family lands, **add a second
floor for its prefix**, pinned as a literal, with a **real** unclassified module created on disk
as a positive control observed red (the technique `SEAM-02` used).

**Two more guarded surfaces this milestone creates.** The compiled `.sla` (recommendation: build,
don't commit) and the Ghidra pre/post scripts — moving them to `src/` makes them shipped code that
must be reachable from `-scriptPath` **after** package installation and **after** path
translation. Note the standing blind spot: `installer/skills/` is gitignored yet shipped
(`git ls-files installer/skills` returns 0), so **any gate whose subject is what a user gets must
read the `npm pack` file list** via `scripts/check-npm-packages.mjs`, never `git ls-files`.

**Two known-red baselines to establish before trusting any run.** Stop the broker first — a live
broker reddens the BACK-05 assertion deterministically, and a phase measuring against a
live-broker run reads a false baseline. And use `npm run test:automated`, not `npm test` — the
whole-glob run does not terminate unaided. The clean floor for `test:automated` is **0** failures.

### The "worthless as an assertion" count

**PITFALLS.md enumerates 18 criteria across this milestone that are worthless unless paired with a
control observed RED.** The full table with each control is at
`.planning/research/PITFALLS.md` § *Pitfall 23*. Summary by phase: 8 belong to the capture/gate
phase (RAM-init determinism, reproducible-run protocol, capture equivalence oracle,
`default_memspace`, warp-safe waits, plus the three allow-list controls), 2 to the execution seam
(64 KiB cap, new-prefix floor), 6 to the two-engines work (SLEIGH compile, SLEIGH language
selection, harness log check, volatile carve **on both import routes**, `DataTypeManager`
control, dxa parser refusal), and 6 to the annotation join (narrowest-range-wins, tie-break,
in-image skip, bank-before-address, path-dependent decline, graphics feedback) — with overlap
where a control serves two phases.

**Plannable shape, and this is the actionable part:** for each row, the plan's task list contains
**a task whose deliverable is the red transcript, separate from the task that implements the
fix**, and the red transcript is committed. This project already does this well; the risk is
**scale** — eighteen red observations is a lot, and the temptation to batch them into "the
controls are in place" is exactly the failure. PITFALLS.md's warning sign: *a criterion whose
verification sentence contains "is present", "is set", "is configured" or "is marked"; a phase
closing with a controls count but no transcripts.*

### Two stale-prose corrections found in passing

1. **`ANNO_TOOL_DEFINITIONS.length` reads 19 at HEAD, while `PROJECT.md` says 18.** Not a guard
   failure — nothing pins it (`> 0` only) — so it is stale prose in a normative document.
   FEATURES.md repeats the 18 figure from PROJECT.md; ARCHITECTURE.md counted the actual length.
2. **The warp claim, and its net position must be stated carefully — do not just apply the older
   refutation.** `capability-registry.ts` states, inside `vice_machine_config_set`'s reason, that
   "warp on stock is a launch-time flag, not a resource that can be toggled while running", and
   `docs/tool-support.md` reproduces the sentence **verbatim because it is generated** from the
   registry under a byte-identity drift guard (`tool-support-table.test.mjs`). ARCHITECTURE.md
   reports the claim was **refuted live on 2026-08-27** (`warp` / `warp on` / `warp off` all
   answered on stock 3.9's text monitor) and treats warp as a runtime operation. **But
   PITFALLS.md's revision pushes warp BACK to launch-time for a different reason:** runtime
   `warp on`/`warp off` live on the OWNER-EXCLUDED text channel, so this milestone may not take
   that route.
   **Net position:** the registry sentence is **factually wrong about VICE** and
   **operationally correct for this milestone**. The correction is therefore *not* "warp is a
   runtime resource" — it is a sentence that says both things: runtime warp exists but only over
   the text monitor, which this project does not dial, so on the supported binary-monitor route
   warp is chosen at launch (`-warp` / `InitialWarpMode`). Practical consequence the roadmapper
   must carry: **warp is a per-instance property**, which puts it back inside the
   warm-instance-eligibility problem — a warm interactive instance cannot be retro-warped. The
   correction is one commit touching two files (registry text + regenerated table); skipping the
   regeneration reds the drift guard.

---

## Implications for Roadmap

Phase numbering starts at **33**. Numbers 24 and 26 stay retired; their *requirement text* carries
forward under new numbers.

The four researchers proposed structures that converge in shape and differ in granularity:
PITFALLS.md proposed **four** phases (33 stop/gate, 34 execution seam, 35 two engines, 36
auto-annotation); ARCHITECTURE.md proposed a **ten-node** dependency graph (P-A…P-J);
FEATURES.md proposed an MVP checklist with a P1/P2/P3 matrix rather than phases; STACK.md
proposed none, but supplied the version floors and integration points that fix the ordering.
**The recommendation below is six phases** — PITFALLS.md's count with its two-engines phase split,
because the SLEIGH compile gate and the Ghidra harness carry independent gates and the dxa->Ghidra
edge is the strongest in the graph. ARCHITECTURE.md's finer nodes are absorbed as **plans** inside
these phases, including its parallel edge.

### Phase 33: The Reproducible-Run Protocol, the Frame-Exact Stop, and the Capture Substrate (gate)

**Rationale:** It is the gate on measurement, and PITFALLS.md's pitfalls 1, 3 and 4 make it
*smaller as a mechanism and larger as a protocol* than the milestone assumed. The pre-committed
gate pattern is reused deliberately — rules committed to git **before** any measurement, no
judgement step, the authority to narrow every phase after it.
**Delivers:** the determinism argv block (stock branch only, `-seed` + the three `raminit*` flags,
after `-default`, fork argv byte-identical); the reproducible-run protocol as a named single-seam
procedure with the monitor-issued hard reset inside it, riding an **optional argument on
`vice_run_until`**; the frame-anchor checkpoint; the main-CPU memspace assertion; the `.vsf`
`C64MEM` slicer (**parallel plan**, independent of the stop); the capture record schema and the
`(binary sha256, argv digest, seed)` reproducibility key; the equivalence predicate with an
enumerated allow-list and a committed size cap; the real-corpus capture as the final plan.
**Opening task (not an implementation):** the binary-monitor re-instrumentation probe of
Reconciliation 1, on an **autostarted real release**, with STACK.md's wall-clock control observed
red.
**Addresses:** the `.vsf` slice, capture manifest and equivalence predicate table-stakes rows;
launch-time warp.
**Avoids:** pitfalls 1-8 and 27 (RAM init, argv key, warm instance, "the emulator is
nondeterministic", instruction-vs-frame-vs-cycle, range-shaped allow-lists, `default_memspace` via
the drive, warp-invalidated wall-clock waits, gate rule-ordering and input domains).
**Also promote here:** the existing headless/warp launch-knob todo, rather than leaving it
unowned.

### Phase 34: The Host-Tool Execution Seam

**Rationale:** A **precondition**, not a plan inside another phase — PITFALLS.md, ARCHITECTURE.md
and FEATURES.md all say so, for three different reasons (it gates the post-script's output format;
it gates any skill script reaching for a host binary; and the grep gate banning `spawnSync` can
only be written once nothing violates it).
**Delivers:** the typed namespaced control op routed before any lease-bearing path; the
child-process executor; the typed per-tool allowlist (never argv passthrough); token discovery for
skill scripts, solved once in the seam; path+digest+length returns through `containerpath.ts`; the
no-dot project-path refusal **in code**; one project directory per run id with `-deleteProject`;
the recorded JVM-lifetime binding decision; the retroactive migration of `acme.mjs` and
`packer-finding.mjs` plus the grep gate; the new module-prefix floor with a real on-disk positive
control.
**Uses:** the existing `resources/` recursive-walk delivery channel for committed `.java` /
`.slaspec`; `verifiedKill()` by identity.
**Avoids:** pitfalls 19-21 and 25-26.

### Phase 35: dxa, Vendored and Parsed (carries Phase 24's `DXA-*` text)

**Rationale:** dxa's map is what makes Ghidra work at all — Ghidra alone with zero hints produced
**0 functions and 0 code bytes**. The strongest edge in the graph, and dxa is not installed.
**Delivers:** `vendor/dxa/` at 0.1.5 behind a digest gate written **before** the fetch, built with
`make` + `make test`; the `THIRD-PARTY-NOTICES.md` entry quoting the source headers and supplying
the GPL-2.0 text; the owned listing parser over the five measured line shapes of `-a dump`, with a
by-name refusal (dxa's own `-d strict` exited **0** on an inconsistent fixture, so the refusal must
be the parser's); the ground-truth partition derivation committed **as a script, before the tool
runs**; the code/data map landing in the store's existing 12-member vocabulary; the `-B` / `-l`
store->dxa emitters.
**Avoids:** pitfalls 9 (accepting a published benchmark — print re-measured figures **beside** the
published ones with RC-1 attached, and every rate with its denominator) and 10 (6502 constructs;
overlapping decodes -> **unclassified with a stated reason**, never a winner).

### Phase 36: The SLEIGH Language and the Ghidra Harness (carries `OPC-*` and `GHID-*` text)

**Rationale:** The SLEIGH compile gate must be the **earliest task in the phase**, because nothing
downstream is meaningful without it, and it must precede the acceptance run because crack and
packer code is exactly where the 105-byte gap bites.
**Delivers:** the eight sized-local fixes; a `sleigh` compile gate in CI asserting exit 0 **and**
a produced `.sla` **and** mtime newer than every input; the extension as its own Ghidra language
with a new `.ldefs` `id` and the `-processor` change **in the same commit**; the harness with three
independent gates per run; the volatile carve via `getBlock` + `setVolatile(true)` verified on
**both** import routes by the reference dump; the `DecompInterface` export with per-function
attempted/decompiled/timedOut accounting under a committed ceiling and a `DataTypeManager` control
on the **same image**; access-kinded cross-references; the unresolved-dispatch join reported as a
count **and** a list.
**Avoids:** pitfalls 11-18.

### Phase 37: The Importer and the Automatic Annotation Join (carries Phase 26's `AUTO-*` text)

**Rationale:** `AUTO-01`'s criterion reads annotations back **out of the store**, so the importer
must exist first; and the volatile carve gates the join by a hard dependency (no volatile -> no
recovered `$01` literals -> no bank state).
**Delivers:** the container-side importer (log grep on the exact literal, access kinds preserved,
one store seam) and 1-3 new `ANNO_TOOL_DEFINITIONS` entries; the join — narrowest-range-wins,
`sym` tie-break, in-image skip, bank-before-address, decline-with-reason; `memmapSha256` on every
derived row; the synthetic **two-caller path-dependent `$01` fixture** built rather than waited
for; the VIC-DMA graphics map fed back to dxa `-b` and to Ghidra, with phantom labels shown
**present before and absent after**; counts reported; `--json` rendered from the store.
**Avoids:** pitfall 22 and pitfall 10's feedback half.

### Phase 38: `PROOF-01..03` on Real Cracked Code

**Rationale:** The milestone's point. `PROOF-*` are "real measurements on real cracked code rather
than `could-not-run`", and they need the corpus (33), both engines (35, 36) and the join (37).
**Delivers:** the real-release numbers stated **beside** the fixture re-measurement
(`FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39`, `FIXTURE_REPRODUCED: no`)
rather than silently replacing them, each with its denominator and positive class; `PROOF-03`
measured in **both** directions for the first time.

### Phase Ordering Rationale

- **33 -> 35/36 -> 38.** `PROOF-*` need a reproducible corpus; the corpus needs the protocol.
- **33's two halves are parallel.** The `.vsf` slicer touches no emulator and is independent of
  the stop (ARCHITECTURE.md's P-A || P-B). Run them as concurrent plans.
- **34 before 35 and 36, never after.** The grep gate banning external-binary spawns can only be
  written once nothing violates it, and two skill scripts already violate it. Inlining
  `spawnSync("dxa", …)` "just for the measurement phase" means writing the violation twice.
- **35 -> 36.** Load-bearing and the strongest edge: zero hints = zero output.
- **SLEIGH before the Ghidra acceptance run**, inside 36, with the compile gate as the phase's
  earliest task and the language-selection assertion as its **first criterion** — the difference
  between the phase delivering and the phase reporting delivery.
- **36 -> 37 -> 38.** Nothing to import until the export exists; the join reads back out of the
  store; the proofs read the join.
- **Where they disagreed:** PITFALLS.md folded dxa + SLEIGH + Ghidra into one phase (35);
  ARCHITECTURE.md split them three ways (P-E, P-F, P-G) and additionally split corpus capture
  (P-C) and the importer (P-H) into their own nodes. The six-phase recommendation splits the
  engines (independent gates, and 35's parser has nothing to do with 36's `.ldefs`) but folds
  corpus capture into 33 and the importer into 37 (each is one plan, and each is meaningless
  without its neighbour).

### Research Flags

**Phases likely needing deeper research during planning:**

- **Phase 34 (the execution seam)** — the one section of this research resting on survey rather
  than measurement (STACK.md § (d), MEDIUM). Two live questions: whether batch framing with
  `-process` actually amortises the measured 12-17 s JVM startup across a corpus item, and the
  cost of installing Ghidra + a JVM in GitHub Actions (**nothing probed**, ARCHITECTURE.md's own
  LOW-confidence declaration). `/gsd-plan-phase --research-phase 34` is warranted.
- **Phase 33 (the protocol), narrowly** — not the mechanism, but the two untested preconditions:
  autostart determinism with true drive emulation in the loop, and whether the transient allow-list
  method holds on a real release. These are *probes inside the phase*, not a research pass.

**Phases with standard patterns (skip `--research-phase`):**

- **Phase 35 (dxa)** — the flag set, the five output line shapes, the build, the licence position
  and the false-positive direction are all measured. It is implementation.
- **Phase 36 (SLEIGH + harness)** — the compile failure, its root cause, the verified fix, the
  `.ldefs` shape, the drop-in extension route and Phase 23's whole recorded harness are measured.
  It is implementation against a green control.
- **Phase 37 (join)** — the three selection rules, their failure modes and the 18/18 PoC are
  measured in-repo. Note there is **no prior art to validate against** (no comparable tool
  declines), which is a reason for controls, not for research.
- **Phase 38 (proofs)** — measurement, not design.

### Requirement ids needing their text AMENDED rather than carried byte-identically

`PROJECT.md` says Phase 24's and Phase 26's content carry forward **byte-identical**. That is no
longer honest for the following, given the falsified SLEIGH premise, the corrected prerequisite
set and the `stopwatch` exclusion. Both the roadmapper and the requirements step need this list.

| Requirement | Amendment needed | Why |
|---|---|---|
| **`OPC-01`..`OPC-03`** | Re-scope from *"integrate and verify"* to **"fix, compile, integrate and verify"**. Add: a `sleigh` compile gate (exit 0 + `.sla` produced + mtime newer than every input) as the earliest task; a **new `.ldefs` language id** with the `-processor` change in the same commit; the criterion asserting **the language the run log says it used**; the `65C02` non-collision check in the same installation; the declared-unknown check (`XAA` `$8b`, immediate `LAX`/`LXA` `$ab`, `AHX`/`TAS`/`SHX`/`SHY` render as opaque userops, not plausible p-code) | The source does not compile — 8 constructors, `No output produced`, exit 2, two independent measurements with passing controls. And `6502.ldefs` has only two ids, so the naive implementation ships an inert extension under a green harness |
| **`DXA-01`** | State the vendored build as **real work, not setup**: dxa is not installed anywhere on this host. Add the packaging gap — no `LICENSE`/`COPYING` in the tarball, GPL-2.0-or-later only in C headers, two-party copyright, no upstream signature — so the notice is **quoted from source headers** and this project supplies the GPL-2.0 text | MEASURED host inventory + MEASURED tarball contents |
| **`DXA-03`** | The refusal must be **this project's parser refusing by name**, not dxa's exit status (`-d strict` exited **0** on an inconsistent fixture). Add: the refusal must be provoked by a **real unknown listing form from an actual run**, not only a hand-planted malformed line; and overlapping decodes (`jsr` into mid-instruction) yield **unclassified with a stated reason** | MEASURED; and a byte-per-address map structurally cannot represent overlapping decodes |
| **`GHID-01`** | Add Ghidra as a **declared host prerequisite by version** (currently an unpinned out-of-tree probe unpack) and the execution seam as a dependency. Add the three independent gates; the **exact literal** `ERROR REPORT SCRIPT ERROR`; the classification count as the **block total, not the image size**, asserted on **both** routes; the no-dot project-path refusal in code | MEASURED; and the naive `error`/`fail` grep false-fires on the flat-64K route's benign INFO lines |
| **`GHID-03`** | The volatile carve's control observed red on **both** import routes, not one — the conflict path differs, and a pre-script tested on the `.prg` fixture and shipped for the flat-64K corpus hits a conflict the test never saw | MEASURED route-dependence |
| **`GHID-04`** | Add per-function **attempted / decompiled / timedOut** accounting with `attempted == decompiled + timedOut` and a committed timeout ceiling; run the `DataTypeManager` control on the **same image** as the acceptance run. **And re-source the unresolved-dispatch denominator:** the specified `C2_SITES_ENUMERATED` "from the VICE runtime inventory" depends on `memmapshow`, which is **owner-excluded**. Name a binary-monitor-reachable enumerator, or state the oracle as absent | A timed-out function yields no facts and no error, short in the same shape as the `DataTypeManager` failure; and the named oracle is out of scope |
| **`GHID-05`** | Make the `65C02` non-collision assertion contingent on the extension being a **separate language** — it is only meaningful because of that, and could not pass under an in-place `6502.slaspec` edit | READ-IN-SOURCE `65c02.slaspec:1` is `@include "6502.slaspec"` |
| **`AUTO-04`** / **`AUTO-05`** | Record them as **unvalidated, not narrowed** (`R1` fired under first-match-wins, so `R7`'s narrowing was never evaluated). Add the **synthetic two-caller path-dependent `$01` fixture** as an early task — the existing `bank.a` fixture has no path-dependent site, so "the join declines on the fixture" is not a usable control. **Remove the `memmapshow` external oracle** | MEASURED absence; and the oracle is excluded |
| **`AUTO-07`** | Add the graphics-map feedback **before/after** ordering explicitly: phantom labels shown present before the feedback and absent after. This is the containment, and it must be *exercised*, not just built | MEASURED phantom-label mechanism |
| **`PROOF-01`** | Keep the "beside, not instead of" wording (already decided) and add: every rate carries its **denominator and positive class**; the published `72.46%` / `0 FP` may appear only beside the source-derived `72.39 (97/134)` / `3` with **RC-1 attached** as a hypothesis | MEASURED non-reproduction, with the error flattering the tool exactly at the headline |
| **`PROOF-03`** | State it as **unmeasured in BOTH directions** and name the fixture that will measure it. Nothing is known about where a single forward-carried `$01` value stops being correct | MEASURED absence |
| **The frame-exact-stop requirement text itself (new ids)** | Must **not** name `stopwatch`, a constructed monotonic cycle counter, or event record/replay. The stop is the **reset protocol**; the oracle is the triple `(PC, hit_count, (LIN, CYC))` plus a frame anchor; absolute cycle is an **optional 3.10-only strengthening via `CPUHISTORY_GET` (0x86)'s uint64 clock field**, never a requirement | Owner decision 2026-09-02 + the 3.9 floor |
| **New ids the milestone needs** | A determinism-argv / reproducibility-key requirement; a capture-record + equivalence-oracle requirement (with the allow-list size cap and the `$0000`/`$0001` normalisation **in code**); and an execution-seam requirement (typed allowlist, child process, path-not-payload, project-dir-per-run, recorded JVM lifetime binding, new prefix floor) | None of the three is covered by carried text, and all three are gates on later phases |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Nine cold `x64sc` launches on genuine stock 3.9 with `DISPLAY=:0` (real GUI-backed processes, not stubs); dxa fetched, digest-verified, built, and its binary sha256 matched a 7-day-old pin; Ghidra release metadata fetched via `gh api`; `support/sleigh` run with a control pair; VICE and Ghidra source read directly. Drops to **MEDIUM** for § (d), the execution seam — a four-project web survey with none inspected at source level |
| Features | **HIGH** on the two pasted proposals' assessment and on the da65/dxa/Ghidra capability facts (measured or primary-source this session, including behavioural da65 runs on a purpose-built fixture); **MEDIUM** on capture practice; **LOW** on comparable-tool ecosystem claims (single-tier web) | The comparables section is explicitly RECALLED and load-bearing only for the *negative* claim that no comparable tool declines — used to argue for controls, not to design anything |
| Architecture | **HIGH** on integration points and guard breakage (every `file:line` read at HEAD `36f8c7c`, with a 50-row citation ledger); **MEDIUM** on the frame-exact mechanism (reasoned from settled constraints, **not probed**); **LOW** on Ghidra-in-CI cost (**nothing probed**) | Its MEDIUM section is the one this synthesis had to correct: `readCycleBaseline()` Route A is 3.10-only, and its finding 4 has since been discharged by two other researchers' probes |
| Pitfalls | **HIGH** for everything labelled MEASURED (live probes on this host, or transcribed outcome lines from this repo's committed evidence); **MEDIUM** for READ-IN-SOURCE; **LOW** for RECALLED | It carries its own mid-research provenance correction (the absolute-cycle figures) rather than leaving it for a reader to discover, and re-points every prevention that rested on the excluded channel |

**Overall confidence: HIGH for the capture half and the tool facts; MEDIUM for the execution seam.**
The capture half is unusually well evidenced for a research pass — measured against real binaries
rather than documented — and it is the reason this research is able to *contradict* four carried
planning claims rather than restate them. No external documentation provider was consulted for
PITFALLS.md; every question was answerable from primary local evidence or a live probe, which is
strictly stronger.

### Gaps to Address

Carried forward as open, **not resolved by inference**. Each names its probe.

1. **Autostart determinism with true drive emulation in the loop — UNTESTED, and it is a
   precondition for a real cracked release.** Every determinism measurement was taken at the
   KERNAL `READY` prompt. `buildViceArgs()` emits `-drive8type 1541` unconditionally on stock, so
   drive emulation is always live, and a cracked release's loader *is* fastloader code talking to
   the drive. *Probe:* autostart a `.prg` and then a real `.d64`, anchor on the program's own
   entry, run the protocol, compare 64K across two cold runs. Handle in Phase 33 as a gate input.
2. **Simultaneous text + binary monitor clients — this repo's long-standing "not probed" item,
   and NOT closed by any researcher.** STACK.md explicitly declined to close it (every probe used
   the text channel alone). Adjacent MEASURED negative from FEATURES.md: a `/dev/tcp` readiness
   probe appears to have **consumed the monitor's single client slot**, and stock's monitor
   services exactly one client — a second `connect()` sits unserviced with no reply and no EOF,
   indistinguishable from a wedge. *Probe:* arm a checkpoint over binmon, read over text, assert
   both report the same PC. **Lower priority now** that the text client is out of scope, but the
   single-client-slot hazard applies to readiness probing on the binary channel too.
3. **The >64 KiB control-channel disconnect — READ-IN-SOURCE, not observed.** `MAX_LINE_BYTES =
   65536` in both the authored `.mts` and the compiled `.mjs`, enforced with a bare `destroy()`.
   *Probe:* attempt an inline >64 KiB return and observe the client see a bare disconnect with no
   error frame. This is one of the 18 controls; once observed, nobody will be tempted to "just
   try it for the small case."
4. **NTSC / NTSC-old / PAL-N frame constants — SOURCE-read from `src/c64/c64.h`, not measured**
   (17095 / 16768 / 20280). And note the PAL 19656 confirmation was withdrawn with the
   `stopwatch` exclusion, with an incidental contradicting 19,657. *Probe:* re-run the protocol
   under `-ntsc` / `-ntscold` / `-paln`, asserting `LIN` equality across a whole number of frames.
   `MachineVideoStandard` **power-cycles the machine** — launch flag only, never a runtime set.
5. **The `$DD00` second VIC banking axis** under path-dependent state, and **sprite bitmap
   locations** (pointer values are program data usually written at runtime, so not register
   values Ghidra recovers). Also: one graphics map per **program point**, not per program — a
   program switching charset per raster split has several valid maps and a single derived map is
   wrong for all but one. No plan should quietly promise any of these.
6. **`PROOF-03` is unmeasured in BOTH directions.** Nothing is known about where a single
   forward-carried `$01` value stops being correct. *Probe:* the synthetic two-caller fixture,
   built rather than waited for.
7. **The runtime-inventory oracle is excluded, and two preventions depend on it** (the dxa
   ground-truth partition, and the non-Ghidra denominator for unresolved dispatch). Unflagged by
   any researcher. Resolve at requirements time by naming a binmon-reachable enumerator or by
   stating the oracle as absent — see the amendment list.
8. **Smaller, each with its probe named in STACK.md:** whether `dxa -d strict` ever exits
   non-zero; Ghidra's full-tree licence position beyond the per-module `LICENSE.txt`; the RTC /
   CIA TOD contribution to cross-run divergence (did not surface under pinned RAM init, may
   resurface once a real program runs long enough to read TOD); whether the **fork** backend's
   text channel restores frame-exactness; whether a GUI-recorded event history replays
   cycle-identically (low value — the recording half is unautomatable regardless); and the cost of
   Ghidra + a JVM in GitHub Actions (nothing probed).
9. **Line-number citation drift.** This milestone will produce many new source citations, and
   `docs-linerefs.test.ts` guards a **very narrow** subject — two documents, one bullet, one
   regex. Everything else is unguarded, and the guard's own history is a warning. Prefer a
   **symbol name** to a line number wherever the citation's purpose is "find this code"; where a
   line number carries information, extend the guard rather than adding an unguarded citation;
   and never cite Ghidra or VICE upstream lines without recording the version.

---

## Sources

### Primary — MEASURED on this host, 2026-09-02 (HIGH confidence)

- **Genuine unpatched stock VICE 3.9** at `/usr/bin/x64sc` (the fork at `/usr/local/bin/x64sc` is
  3.10 and shadows it on `PATH`; every probe used the absolute path deliberately). Across the two
  researchers: `--version`; `-help` (~1,825 lines, grepped for determinism/event/warp/raminit
  flags); `-record` -> `Unknown option`, exit 255; the startup seed line across 6+ launches;
  23+ cold launches driven over the monitor; `$C000-$CFEF` RAM digests across 12 cold boots under
  four flag combinations; a 3-way byte diff of three 64K dumps (1554 bytes / 1514 ranges) and of
  three pinned ones (identical sha256); the halt-first reset protocol under 0/1500/4000 ms
  jitter; warp-vs-no-warp stop identity; a three-run transient enumeration over `$0000-$03FF`
- **Ghidra 12.1.3 PUBLIC** at `/home/henrik/dev/_ghidra-probe/`, OpenJDK 21.0.12.1:
  `support/sleigh` on the committed extension source (exit 2, 8 errors, no output) and on stock
  `6502.slaspec` (clean, 5094 bytes) — **the control pair**; the sized-local-corrected variant
  (`t.sla`, 8,423 bytes, zero errors); `support/analyzeHeadless` with `-processor
  6502:LE:16:nmos` against a hand-built drop-in extension -> exit 0; the `Directory not found`
  abort, exit 1; JVM startup timings 12,591 ms / 17,386 ms
- **dxa 0.1.5**: fetch (37,987 bytes), `sha256sum -c` against Phase 23's pin, `make` (6 objects,
  binary digest identical to Phase 23's), `man -l dxa.1`, and `-a dump` / `-v` / `-d strict` /
  `-b '?…'` / flat-64K runs
- **`da65 V2.18 - Debian 2.19-2`**: `-V`, an exact-line `strings` scan, and behavioural runs on a
  purpose-built 44-byte split-pointer fixture (split rendering, `LABEL` without `NAME` -> error
  exit 1, `TYPE SKIP` emitting no directive, and the ca65+ld65 rebuild differing at byte 2)
- `gh api repos/NationalSecurityAgency/ghidra/releases/latest`; the floodgap dist directory
  listing; `grep MAX_LINE_BYTES` across both halves of the broker control plane
- Host tool inventory: **dxa absent** under `/home`, `/opt`, `/usr/local`; Ghidra out-of-tree only

### Primary — SOURCE / READ-IN-SOURCE (HIGH confidence)

- VICE `src/event.c` (1336 lines), `src/monitor/mon_register6502.c`, `src/monitor/monitor.c`,
  `src/arch/gtk3/actions-snapshot.c`, `src/c64/c64.h`, `src/vicii/vicii-timing.{c,h}`; a GitHub
  code search for `event_record_start` (6 files)
- Ghidra 12.1.3 `application.properties`, `Ghidra/Processors/6502/data/languages/*` (including
  `6502.ldefs`'s two ids and the shipped `.sla` inventory), `support/analyzeHeadlessREADME.md`
- dxa `Makefile`, `INSTALL`, `main.c` licence header, `dxa.1`
- This repo at HEAD `36f8c7c`, with a 50-row citation ledger: `vice-proxy.ts`, `vice.ts`,
  `broker-launch.mts`, `broker-control.mts`, `broker-kill.mts`, `vice-broker.mts`,
  `broker-state.mts`, `vice-sync.ts`, `stock-run-until.ts`, `stock-timing.ts`,
  `stock-protocol.ts`, `stock-execution.ts`, `anno-store.ts`, `install-resources.ts`,
  `build.ts`, `shipped-modules.ts`, `probe-binmon.mjs`, and the guard suites named in the
  breakage inventory
- `docs/phase0-binmon-findings.md` §1 (`REGISTERS_GET` does return `LIN`/`CYC`) and §5 (the
  opcode set)

### Primary — repo evidence, recorded real runs (HIGH confidence, carried not re-derived)

- `.planning/phases/23-…/evidence/tools/instrument-provenance.txt` — the dot-path abort;
  `analyzeHeadless` exit 0 on a thrown post-script; the 4887-vs-279 classification count; the
  flat-64K `Failed to add language defined memory block` INFO lines; the volatility-proven
  reference dump; the 721,030-byte export; the dxa pin and build; `VICE_BACKEND: fork 3.10`
- `docs/phase23-real-release-gate-findings.md` — the fixture re-measurement
  (`72.39 (97/134)`, 3 FP, `FIXTURE_REPRODUCED: no`, RC-1, the strict-denominator variant);
  criterion 2's unresolved-is-invisible design; criterion 3's `could-not-run`; the
  `could-not-run` vs `not-exercised` distinction
- `.planning/notes/` — `dxa-ghidra-pivot.md` (the four-tool table; Ghidra alone = 0 functions,
  0 code bytes); `ghidra-volatile-io-and-banking.md`; `auto-annotation-from-ghidra-xrefs.md`
  (18/18, three rules); `text-monitor-channel-live-probe.md`; `dxa-ghidra-pivot-evidence/`
- `.planning/todos/pending/` — the frame-exact stop (the 201-vs-1 divergence table), the `.vsf`
  `C64MEM` extraction, the headless/warp launch mode, the Ghidra wrapper proposal
- `.planning/seeds/host-tool-executor.md`; `ROADMAP.md` Standing Constraints; `PROJECT.md`;
  `CLAUDE.md`

### Secondary — READ-IN-SOURCE, vendor documentation (MEDIUM confidence)

- da65 Users Guide (the nine `RANGE TYPE` values, `PARAMSIZE`); dxa(1) man page; VICE Manual
  ch. 2 / 9 / 11 / 12 (`-limitcycles`, snapshots, event history and its accuracy caveat, the
  monitor's `memmapshow` mask `ioRWXrwx`, `save`/`bsave`, `stopwatch`, `cpuhistory`)

### Tertiary — RECALLED / web survey (LOW->MEDIUM, needs validation)

- Four independent Ghidra-automation projects converging on one resident JVM behind a localhost
  socket: PyGhidra, pyghidra-mcp, ghidra-headless-mcp, ghidra-cli. **None inspected at source
  level.** This is the sole basis for Reconciliation 7's dissent
- Peripheral-annotation practice (SVD-Loader and its RP2040 fork, radare2's 8051 notes, IDA
  device definitions) — the basis for the *negative* claim that no comparable tool declines
- 6502bench SourceGen's metadata-only `.dis65` model; Mesen's NES CDL; 6502 decompiler-quality
  reports; UNP64 / Restore 64 as emulating-unpacker practice

---
*Research completed: 2026-09-02*
*Reconciliations performed: 10. Carried planning claims falsified: 4 (the SLEIGH compile premise, the event-record/replay mechanism, "the frame-exact stop is the single gate", and the warp registry text). Provenance corrections preserved: 1 (the absolute-cycle figures).*
*Ready for roadmap: yes*
