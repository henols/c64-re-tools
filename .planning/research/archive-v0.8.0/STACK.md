# Stack Research

**Domain:** Deterministic emulator capture + offline 6502 static-analysis pipeline (additions to a mature Claude Code plugin)
**Milestone:** v0.8.0 — "Frame-Exact Capture and the Two Engines"
**Researched:** 2026-09-02
**Confidence:** HIGH for (a) and (c), HIGH for (b), MEDIUM for (d)

## How to read the evidence labels in this document

This project treats an unmeasured claim as a defect class, so every load-bearing
statement below carries one of four labels. Nothing here is recalled from model
memory; where I could not run it, I say so and name the probe.

| Label | Meaning |
|---|---|
| **MEASURED** | I ran it on this host during this research pass. The command and its output are reproduced or summarised verbatim. |
| **SOURCE** | Read directly out of VICE / Ghidra source or an installed artefact's own metadata on this host. |
| **PRIMARY (repo)** | This repository's own recorded transcript from a real run — Phase 23 `evidence/tools/instrument-provenance.txt` or `notes/text-monitor-channel-live-probe.md`. Carried forward, not re-derived. |
| **UNVERIFIED** | Not established. The probe that would settle it is named. |

**Instruments used.** Genuine unpatched stock **VICE 3.9** at `/usr/bin/x64sc`
(`x64sc (VICE 3.9)`, MEASURED); the fork at `/usr/local/bin/x64sc` is **VICE 3.10**
and shadows it on `PATH` (MEASURED). **Ghidra 12.1.3 PUBLIC** (build 2026-Aug-17)
at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`. **OpenJDK 21.0.12.1**
(Debian 13). **dxa 0.1.5** built from the pinned tarball during this pass.
`DISPLAY=:0` was available, so every VICE launch below was a real GUI-backed
`x64sc` process, not a stub.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **stock VICE `x64sc` text monitor** (`-remotemonitor`) | **≥ 3.9** — no higher floor | The monotonic cycle clock (`stopwatch`) and bulk instruction stepping (`step <n>`) that a frame-exact stop is built out of | It is the **only** route to a monotonic cycle counter on stock. `mon_register6502.c`'s 6510 register list has **no STOPWATCH entry** (SOURCE), so `REGISTERS_GET`/`REGISTERS_AVAILABLE` over the binary monitor cannot see it; `mon_stopwatch_show()` prints `*vice_interface->clk - stopwatch_start_time[mem]` as text only (SOURCE, `monitor.c:1508-1514`). The port is **already launched and allocated on every stock instance** and has never been dialed (PRIMARY, `broker-launch.mjs:165`, `broker-state.mts:117-137`). |
| **stock VICE binary monitor** (`-binarymonitor`) | **≥ 3.9** for the stop primitive; **≥ 3.10** only if `CPUHISTORY_GET` is wanted | Checkpoint arm/hit/stop, memory read, snapshot `DUMP` | The checkpoint stop is **instruction-exact** on stock — see the measurement below. This is the existing `vice.ts` transport; nothing changes. |
| **`-raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0`** | launch-time flags, **≥ 3.9** | Removes RAM-init nondeterminism | **This is the single highest-value finding in this document.** Without it, three cold boots stopped at a bit-identical cycle and still produced three different 64K images. With it, three cold boots produced **one identical sha256**. MEASURED. |
| **dxa** | **0.1.5** (pinned, `sha256 8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`) | Code/data discovery on a headerless 6502 image | Still the current and only release (MEASURED); vendored + built, never assumed on `$PATH`. Plain `make`, no dependencies beyond a C compiler. |
| **Ghidra** | **12.1.3 PUBLIC** (`ghidra_12.1.3_PUBLIC_20260817.zip`, published 2026-08-18) | Semantic recovery via `analyzeHeadless` + `DecompInterface` | **Confirmed the current latest release** as of 2026-09-02 — the same version Phase 23 probed, so the recorded command line and the two committed scripts are still valid against it. MEASURED via `gh api repos/NationalSecurityAgency/ghidra/releases/latest`. |
| **OpenJDK** | **≥ 21**, no upper bound | Ghidra runtime | `application.java.min=21`, `application.java.max=` (empty), `application.java.compiler=21` read straight out of the installed `application.properties` (SOURCE). Host has 21.0.12.1 from Debian 13. |
| **`support/sleigh`** | ships inside Ghidra 12.1.3 | Compiles `.slaspec` → `.sla` | A processor-language extension needs **no Gradle, no Ghidra source build, and no GUI install step**. MEASURED end to end (below). |
| **Node `node:sqlite` + `@mastra/mcp`** | unchanged | Store + MCP framing | **No new npm runtime dependency is needed for any of (a), (b), (c) or (d).** Everything new is either a launch flag, a vendored C program, a JVM already on the host, or plain-Node protocol code. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | — | Deliberate. Every capability below is reachable with Node builtins (`net`, `child_process`, `fs`, `crypto`) plus this repo's existing seams. Adding an interval-tree, a SQLite driver, or a listing-parser library is already Out of Scope per `milestones/v0.7.0-REQUIREMENTS.md` and nothing found here reopens that. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `gcc` + `make` | Build vendored dxa | `CFLAGS = -Wall -Wmissing-prototypes -O2`, six objects, no configure step (SOURCE, dxa `Makefile`). Reproducible: the built binary's sha256 matched Phase 23's `DXA_BINARY_SHA256` exactly (MEASURED). |
| `support/sleigh` | Compile the undocumented-opcode language | `sleigh <in.slaspec> <out.sla>`, or `sleigh -a <dir>` for a whole directory. Options include `-DNAME=VALUE`, `-i <options-file>`, `-n` (list NOP constructors), `-l` (pattern conflicts) — all MEASURED from `sleigh` with no arguments. |
| `support/analyzeHeadless` | Run the harness | Full option list MEASURED from `support/analyzeHeadlessREADME.md` — see § (c). |
| `ant` (optional) | Alternative sleigh driver | `Ghidra/Processors/6502/data/build.xml` drives `SleighCompile` under Ant. **Not needed** — `support/sleigh` is the direct route. |
| Gradle ≥ 8.5 | Only for extensions that ship **Java** | `application.gradle.min=8.5` (SOURCE). Not on this host's `PATH` (MEASURED) and **not required** for a language-only extension. |

---

## (a) The frame-exact emulator stop

### Verdict up front

**A frame-exact, cycle-exact, cross-run-reproducible stop is achievable on genuine
stock VICE 3.9, today, with no new dependency and no fork requirement.** It is
*not* built out of VICE's event record/replay machinery — that route is
unreachable programmatically. It is built out of three things stock already has:
a **deterministic RAM init**, an **instruction-exact checkpoint stop**, and the
**text monitor's monotonic cycle counter**.

### A.1 Event record / replay — RULED OUT, with source-level reasons

This was the obvious candidate and it does not survive contact with the source.

**What the machinery is.** `event.c` (1336 lines) records a linked list of typed
events, each stamped `list->current->clk = maincpu_clk` (SOURCE, `event.c:365`),
and replays them by `alarm_set(event_alarm, clk)` on the **main-CPU alarm
context** (SOURCE, `event.c:387-393`, `event_init()` at `:1330`). So a replay *is*
cycle-scheduled rather than wall-clock-scheduled — the determinism property is
real. Recorded event types are exactly: `RESETCPU`, `KEYBOARD_MATRIX`,
`KEYBOARD_RESTORE`, `KEYBOARD_DELAY`, `KEYBOARD_CLEAR`, `JOYSTICK_VALUE`,
`JOYSTICK_DELAY`, `DATASETTE`, `ATTACHDISK`, `ATTACHTAPE`, `ATTACHIMAGE`,
`RESOURCE`, `INITIAL`, `SYNC_TEST`, `TIMESTAMP`, `LIST_END` (SOURCE,
`event.c:342-358`, `:478-528`). It is an **input** log, not a state log: nothing
about RTC, CIA TOD seeding or drive-mechanism phase is captured. The *state* comes
from the paired snapshots — `event_record_start_trap()` writes `start.vsf`
(`EventStartSnapshot`) and `event_record_stop_trap()` writes `end.vsf`
(`EventEndSnapshot`), and **the event list is stored as a module inside `end.vsf`**,
not as a separate history file (SOURCE, `event.c:692-707`, `:777-788`,
`event_playback_start_trap()` at `:824-860` opens the *end* snapshot to read the
event module, then loads the *start* snapshot).

**Why it is unreachable.** Three independent blockers, each measured:

1. **There is no `-record` / `-recordevents` command-line option, on either
   binary.** `cmdline_options[]` in `event.c` registers exactly six options:
   `-playback`, `-eventsnapshotdir`, `-eventstartsnapshot`, `-eventendsnapshot`,
   `-eventstartmode`, `-eventimageinc`/`+eventimageinc` (SOURCE, `event.c:1289-1311`).
   Confirmed against both binaries: `/usr/bin/x64sc -record` → `Unknown option
   '-record'. Error parsing command-line options, bailing out.` exit 255
   (MEASURED); grepping `-help` for `^[-+](record|playback|event)` on the 3.10
   fork returns the same six (MEASURED). **Playback is launch-time; recording is not.**
2. **`event_record_start()` has no non-UI caller.** A GitHub code search over
   `VICE-Team/svn-mirror` returns exactly six files: `vice-event.h`, `event.c`,
   `debug.c` (under `#ifdef DEBUG`), `arch/gtk3/actions-snapshot.c`,
   `arch/sdl/actions-snapshot.c`, `arch/sdl/menu_snapshot.c` (MEASURED). It is
   reachable only as UI actions `ACTION_HISTORY_RECORD_START` /
   `_STOP` / `ACTION_HISTORY_PLAYBACK_START` / `_STOP` /
   `ACTION_HISTORY_MILESTONE_SET` / `_RESET` (SOURCE,
   `arch/gtk3/actions-snapshot.c:90,112,121,165-184`).
3. **No binary-monitor opcode addresses it, on any version.** The repo's own
   `enum t_binary_command` inventory has no event/history command (PRIMARY,
   `docs/phase0-binmon-findings.md` §5, mirrored in `probe-binmon.mjs`'s `CMD`
   table), and the text monitor has none either — see the trap below.

**A trap worth naming explicitly.** The stock text monitor's command list does
contain `playback (pb)` and `record (rec)` under the heading **"Command file
commands"** (MEASURED). `help record` returns: *"Syntax: record "<filename>" —
After this command, all commands entered are written to the specified file until
the STOP command is entered."* (MEASURED). This is **monitor-command scripting,
not event history**. Anything that plans against "the monitor has `record`" is
planning against the wrong feature.

**Does it work under `x64sc`?** `event.c` is machine-generic and compiled into
`x64sc`, and `-playback` is present in `x64sc -help` (MEASURED), so playback
almost certainly does. **Whether a `.vsf`+event-module pair produced by a GUI
recording replays cycle-identically is UNVERIFIED** — the probe would be: record
by hand in the GTK3 UI (History ▸ Start recording), stop, then relaunch twice with
`-eventstartmode 3 -playback -eventendsnapshot end.vsf` and compare the 64K at a
fixed cycle. It is not worth doing, because blocker 1 makes the *recording* half
unautomatable and this project needs a route a broker can drive.

### A.2 What binary-monitor / text-monitor facilities actually give you

Each row is either measured on stock 3.9 this pass, or carried from this repo's own
recorded live probe.

| Facility | Route | Floor | What it gives, measured |
|---|---|---|---|
| **Checkpoint stop** | binmon `CHECKPOINT_SET` (0x12) / text `break exec $addr` | 3.9 | **Instruction-exact.** Stopping at `$EA31` reported `#1 (Stop on  exec ea31)  116/$074,  30/$1e` and registers `.;ea31 …`, i.e. **PC == the checkpoint address, exactly**, in every one of nine runs (MEASURED). Contrast the fork's HTTP path, which the frame-exact todo records as pausing "roughly a frame later, at a wall-clock-determined instruction". |
| **`RL` / `CY` conditions** | text `break exec $a if (RL == $30)` / binmon `CONDITION_SET` (0x22) | 3.9 | Accepted and echoed back: `Setting checkpoint 1 condition to: ( RL == $30 )`; `break` then lists `Condition: ( RL == $30 )` (MEASURED). `help condition` confirms *"RL can be used to refer to the current rasterline, and CY refers to the current cycle in the line"* (MEASURED). CLAUDE.md's precedence and hex-literal warnings both still apply. |
| **`ignore <cp> <count>`** | text only | 3.9 | Machine-counted crossings. `help ignore`: *"Ignore a checkpoint a given number of crossings"* (MEASURED). **The count is parsed in the monitor's radix, i.e. hex by default** — see the `step` measurement below for the proof. This is the 3.9 substitute for the absent binmon `checkpoint_set_ignore_count` (PRIMARY: Phase 23 records 3.9 "lacks `vice_checkpoint_set_ignore_count`"). |
| **`ADVANCE_INSTRUCTIONS` (0x71)** | binmon | 3.9 | Works (PRIMARY, assumption A2 probe). **Count field is `uint16` → hard cap 65535 per call** (SOURCE, `probe-binmon.mjs:486-495`). |
| **`step [<count>]` / `z`** | text | 3.9 | The same primitive **without the 16-bit cap**: `z $854d0` → `Stepping through the next 546000 instruction(s)` (MEASURED). |
| **`stopwatch` / `sw`** | text only | 3.9 | **The monotonic cycle counter.** `help stopwatch`: *"Print the CPU cycle counter of the current device. 'reset' sets the counter to 0."* `stopwatch reset` → `Stopwatch reset to 0.`; then `z` (1 instruction) → `Stopwatch: 0`; then `z 100` (= 256 instructions) → `Stopwatch: 911` (MEASURED). Implementation is `clk − stopwatch_start_time[mem]` (SOURCE). |
| **`registers` / `r`** | text | 3.9 | Prints `LIN CYC  STOPWATCH` as a *text column* (SOURCE, `mon_register6502.c:202`). The STOPWATCH column is **not** a register in `mon_reg_list_6510[]` (SOURCE, `:57-71`), so `REGISTERS_GET` cannot return it. This is the mechanism behind CLAUDE.md's "no monotonic cycle register" — now with the exact reason. |
| **`CPUHISTORY_GET` (0x86)** | binmon | **3.10** | Absent on 3.9 (PRIMARY). But `chis <n>` over the **text** channel returns full history entries **with per-entry cycle counts on 3.9** (PRIMARY, text-monitor live probe). So the *capability* floor is 3.9; only the *opcode* floor is 3.10. |
| **`warp [on\|off]`** | text | 3.9 | Runtime warp, and it reports state (PRIMARY). The `-warp` launch flag also works (MEASURED — every probe run used it). |
| **`bsave "<f>" 0 <a1> <a2>`** | text | 3.9 | 64K dump straight to a host file: `bank ram` then `bsave "…" 0 0000 ffff` → `Saving file '…' from $0000 to $ffff`, 65536 bytes on disk (MEASURED). A second, independent capture route beside `.vsf` slicing. |
| **`dump` / `undump`** | text + binmon 0x41/0x42 | 3.9 | `.vsf` write/read, the input to the already-validated `C64MEM` slicing todo. |
| **`-limitcycles <n>`** | launch | 3.9 | *"Specify number of cycles to run before quitting with an error"* (MEASURED). **Not useful** — it quits, so there is nothing left to capture from. |
| **`-seed <value>`** | launch | 3.9 | *"Set random seed (for debugging)"* (MEASURED). VICE logs the seed it chose (`Main: random seed was: 0x6a97fb2c`, MEASURED). Present in every probe run's log; **not needed** once the three `raminit*` flags are set — see A.4. |

### A.3 Constructing a monotonic frame counter — the answer

CLAUDE.md is right that there is no monotonic cycle *register* and that `LIN`/`CYC`
are not monotonic. The frame counter is therefore **derived**, from two inputs:

- `clk`, read as text `stopwatch` — monotonic, 64-bit, rebasable to 0 at a chosen
  anchor.
- **cycles-per-frame**, a constant of the video standard. All four values read
  straight out of `src/c64/c64.h` (SOURCE):

| `MachineVideoStandard` | lines | cycles/line | **cycles/frame** | cycles/sec |
|---|---|---|---|---|
| PAL | 312 | 63 | **19656** | 985248 |
| NTSC | 263 | 65 | **17095** | 1022730 |
| NTSC-old | 262 | 64 | **16768** | 1022730 |
| PAL-N (Drean) | 312 | 65 | **20280** | 1023440 |

`frame = floor((clk − clk_anchor) / cyclesPerFrame)`, and "stop at frame F" becomes
"stop at the first instruction boundary at or after `clk_anchor + F·cyclesPerFrame`".

**The PAL constant was confirmed empirically, not just read.** Anchoring at `$E453`
and converging to exactly 50 × 19656 = 982800 cycles later landed at `LIN 260` in
every run — **the same raster line as the anchor's `LIN 260`**, differing only by
the 2-cycle instruction-boundary overshoot (`CYC 057` → `CYC 059`). If 19656 were
wrong the raster line would have drifted. MEASURED, three runs.

The other three standards are **UNVERIFIED on this host**; the probe is the same
recipe re-run under `-ntsc` / `-ntscold` / `-paln` asserting `LIN` equality across
a whole number of frames. Note CLAUDE.md's safety rule: `MachineVideoStandard` is
one of the three resources that **power-cycles the machine**, so this must be a
launch flag, never a runtime resource set.

### A.4 The measured recipe, and the two results that matter

Nine cold `x64sc` launches, three experiments. Every launch used
`/usr/bin/x64sc -default -remotemonitor -remotemonitoraddress ip4://127.0.0.1:<port>
-sounddev dummy -warp` and drove the text monitor over a plain Node `net` socket.

**The recipe:**

1. Launch with RAM-init randomness off: `-raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0`.
2. `device c:` — pin the default memspace (CLAUDE.md's `default_memspace` remedy).
3. `break exec $E453` — a **once-per-reset** KERNAL address.
4. `reset 1` (power cycle), then `g`, then **wait for the machine's own hit report**.
5. `stopwatch reset` — rebase the monotonic clock to 0 at that anchor.
6. Converge on `F · 19656`: read `stopwatch`, `step $<hex estimate>` using ~3.6
   cycles/instruction, repeat. **Converged in 6 rounds every time.**
7. Capture (`bank ram` + `bsave`, or `dump` a `.vsf`).

**Result 1 — the stop is exact, and the residual is RAM init.** Three runs with
default RAM init:

| run | anchor (`registers` at `$E453`) | stop | 64K sha256 |
|---|---|---|---|
| d1 | `.;e453 97 01 84 fd 2f 37 10100001 260 057    2060661` | `.;e5cd … 260 059     982802` | `20bd1f5c…` |
| d2 | *byte-identical* | *byte-identical* | `4ae4a1a5…` |
| d3 | *byte-identical* | *byte-identical* | `2d7988d1…` |

The **absolute** power-on-to-`$E453` cycle count is `2060661` in all three runs, and
the stop is `PC=$e5cd`, `LIN 260`, `CYC 059`, `clk 982802` in all three. The stop is
already frame-exact. **The images still differ — 1554 scattered single bytes,
1514 disjoint ranges, plus `$0000-$0001`** (MEASURED three-way diff). That is
uninitialised-RAM noise, not a stop defect.

**Result 2 — pinning RAM init closes it completely.** Three further runs, same
recipe plus the three flags:

| run | anchor | stop | 64K sha256 |
|---|---|---|---|
| e1 | `.;e453 … 260 057    2060661` | `.;e5cd … 260 059     982802` | `39a71b108cd6b59876647b391035d569d1361c04d9fb50c8bf259d965f19902b` |
| e2 | *identical* | *identical* | **same** |
| e3 | *identical* | *identical* | **same** |

**Bit-identical 64K across three independent cold boots.** This is the capability
the frame-exact-stop todo says nothing owns.

**Result 3 — the control, i.e. what wall-clock stopping actually costs.** Three
runs that anchored on a *wall-clock* moment instead (`reset 1`, sleep, then arm a
`$EA31` checkpoint with `ignore … $64`) produced identical `PC`, `A`, `X`, `Y`,
`SP` and flags — and `LIN` of **116, 223 and 267**, with `clk` of 3702666, 5065678
and 6149527. Same instruction, three different frames. MEASURED. This is the
negative control the go/degrade/no-go gate should reuse: it is observed *red*
without the fix.

### A.5 Five operational pitfalls, each measured

1. **Any monitor command halts the machine at a wall-clock-determined point.**
   After `g`, sending `registers` re-entered the monitor at `$fd70` with
   `clk 1336612` — a position nothing in the procedure chose (MEASURED). The
   text-monitor probe note already says the channel "halts the machine on command,
   exactly like the binary monitor"; the consequence for this milestone is sharper:
   **a stop is only deterministic if a checkpoint hit or a counted `step` caused
   it.** Never let a command race a running machine.
2. **`reset 1` from the monitor runs past the reset vector before returning
   control.** A breakpoint on `$FCE2` set *before* `reset 1` **never fires** — the
   prompt after `g` already reads `(C:$fd79)` (MEASURED, twice). Anchor on an
   address the reset sequence reaches *later*; `$E453` works.
3. **Integer arguments are hex by default, including step and ignore counts.**
   `z 100` printed `Stepping through the next 256 instruction(s)` (MEASURED). This
   is the same `monitor.c:1597` radix rule CLAUDE.md records for conditions, and it
   silently multiplies a step count by ~2.56. Always write `$`-prefixed literals.
4. **`step` overshoots the target by design.** The CPU cannot stop mid-instruction,
   so a convergence loop lands on the **first instruction boundary at or after**
   the target — `982802` for a target of `982800`, identically in all six runs
   (MEASURED). That is deterministic and fine; it must be *specified*, not treated
   as jitter.
5. **The text channel is a second channel with the same serialisation discipline.**
   `vice-sync.ts`'s invariants — exactly one resume per wait, poll on `hit_count`
   never on paused state — apply to it unchanged. Whether a text client and a
   binary client can be connected *simultaneously* without one's halt/resume
   corrupting the other's view remains **UNVERIFIED** (the text-monitor note's own
   "Not probed" item, and I did not close it: every probe here used the text channel
   alone). The probe: arm a checkpoint over binmon, drive `stopwatch` over text, and
   assert the binmon `STOPPED` PC equals the text `registers` PC.

### A.6 Version floors for (a)

| Mechanism | Floor | Consequence |
|---|---|---|
| Instruction-exact checkpoint stop | **3.9** | none |
| `RL` / `CY` checkpoint conditions | **3.9** | none |
| `ignore <cp> <count>` (text) | **3.9** | none |
| `step <count>` (text) / `ADVANCE_INSTRUCTIONS` (binmon) | **3.9** | binmon capped at 65535/call |
| `stopwatch` monotonic clock (text) | **3.9** | **text channel mandatory** |
| `raminit*` determinism flags | **3.9** | none |
| `warp` at runtime (text) | **3.9** | supersedes the launch-time-only assumption for warp specifically |
| `CPUHISTORY_GET` (0x86) | **3.10** | not needed — `chis` over text covers 3.9 |
| `DISPLAY_GET` (0x84) | **3.9**, api ≥ 2 | not needed for (a) |
| Event record/replay **recording** | **no version** | unreachable on every version |

**The whole of (a) therefore lands on a VICE 3.9 floor** — the version Debian
trixie/forky/sid and all current Ubuntu ship. No user is asked to upgrade, and no
part of it requires the fork.

### A.7 Integration points for (a)

- **`broker-launch.mjs`** must add the three `raminit*` flags to the **stock** argv.
  The `-default -drive8type 1541` ordering invariant and the memory-recorded rule
  that `-default` must precede `-binarymonitor` both stay. **The fork argv must
  stay byte-identical** — that is a standing regression gate, so this is a
  stock-only argv change, and `broker-launch.test.ts` will need the new pin.
  *Open scoping question the roadmap should decide, not this document: whether
  determinism flags are always on (changing every stock launch, including
  non-capture ones) or a launch-mode dimension like headless/warp — the latter
  reopens the warm-instance-per-mode complexity the warp todo already wrestles with.*
- **A text-monitor client is new code.** `monitorClient` needs the
  `channel: "binary" | "text"` discriminator Phase 3's banner already predicted.
  It is line-oriented ASCII with a `(C:$xxxx)` prompt — trivial protocol, but its
  halt semantics make it a first-class serialisation participant, not a side-channel.
- **`vice-sync.ts`** gains the convergence loop. Its two documented invariants are
  preserved by construction: the loop never resumes (it steps), and it polls the
  clock rather than a paused flag.
- **Capability registry / manifest.** A frame-exact-stop tool is **stock-capable and
  fork-degraded** — the inverse of the usual direction, and the first such entry.
  Worth stating loudly in `docs/tool-support.md`, because it contradicts the
  reasonable prior that the fork is the richer backend.

---

## (b) dxa — vendored and built at a pinned version

### B.1 Upstream state, re-verified 2026-09-02

| Fact | Value | Label |
|---|---|---|
| Tarball URL | `https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz` | MEASURED (fetched, HTTPS, exit 0) |
| Size | 37 987 bytes | MEASURED |
| sha256 | `8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799` | MEASURED — **matches Phase 23's pin byte-for-byte** |
| Current release | **0.1.5 is still the only one.** The dist directory lists exactly `dxa-0.1.5.tar.gz` and `xa-2.4.1.tar.gz` | MEASURED |
| Upstream activity | Still dormant: newest file in the tarball is dated 2022-03-26 | MEASURED |
| Signature / upstream checksum | **None.** No `.asc`, `.sig`, `.sha*` or `.md5` in the dist listing or inside the tarball | MEASURED |
| Debian packaging | None. `dpkg -L xa65` has no `dxa` | PRIMARY (Phase 23) |
| Corroboration for the pin | FreeBSD ports `devel/dxa65` distinfo only | PRIMARY (Phase 23) |
| Build | `make` → 6 objects → `dxa`, **exit 0, zero warnings shown**, binary sha256 `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` | MEASURED — **identical to Phase 23's `DXA_BINARY_SHA256`**, so the build is reproducible across a 7-day gap on this host |
| Self-described maturity | *"Please keep in mind this is still considered \"alpha\" software"* — in **`INSTALL`, not the man page** | MEASURED (Phase 23 recorded this citation correction; re-confirmed) |

**Licence — and a packaging gap to plan around.** GPL-2.0-or-later. **There is no
`LICENSE`, `COPYING` or `GPL` file anywhere in the tarball** (MEASURED, full `ls -a`).
The notice exists only as a per-file C comment header, e.g. `main.c:1-23`:

> `Based on d65 Copyright (C) 1993, 1994 Marko M\"akel\"a` /
> `Changes for dxa (C) 2005-2019 Cameron Kaiser` /
> *"…under the terms of the GNU General Public License … either version 2 of the
> License, or (at your option) any later version."*

Consequences for `THIRD-PARTY-NOTICES.md`: the notice must be **quoted from the
source headers** (there is no file to copy), and this project must supply the
GPL-2.0 licence text itself. Note the two-party copyright — Mäkelä 1993-94 for d65,
Kaiser 2005-2019 for dxa — and that the header says 2005-2019 while the tarball is
2022, an internal inconsistency worth reproducing rather than smoothing.

**`make` needs:** a C compiler and nothing else. No `configure`, no autotools, no
libraries. `Makefile` hardcodes `CC = gcc` and `CFLAGS = -Wall -Wmissing-prototypes -O2`
(SOURCE) — a vendored build should override `CC`/`CFLAGS` from the environment
rather than patch the file. `make test` exists (`tests/{Makefile,test01.t,test02.t}`)
and is worth wiring as a post-build gate. Optional `LONG_OPTIONS` in `options.h`
enables `--long-form` flags; **leave it off** — the short flags are always present,
and a build-time toggle that changes the CLI surface is exactly the kind of drift a
pinned vendored tool should not have.

### B.2 Output format — MEASURED, and it confirms a parser is mandatory

There is **no machine-readable output mode**. `-a` has three values only:
`disabled` (default), `enabled` (address prefix), `dump` (address + hexdump)
(MEASURED from the man page). `-a dump` is the richest and is what a parser should
consume. Real output, from `dxa -U -a dump -p all-nmos6502` on a 41-byte `.prg`
built for this pass:

```
              	.word $0801
              	* = $0801

; 12 byte BASIC header.
0801 0b 08 0a 	.byt $0b,$08,$0a
0804 00 9e 32 	.byt $00,$9e,$32
...
080d          l80d:
080d a9 00    	lda #$00
080f 8d 20 d0 	sta $d020
0814          l814:
0814 bd 30 08 	lda $0830,x
081b 10 f7    	bpl l814
0820 4c 0d 08 	jmp l80d
0823 48       	pha
0824 45 4c    	eor $4c
0826 4c 4f 00 	jmp $004f
```

Five line shapes, all present above:

| Shape | Grammar | Meaning |
|---|---|---|
| statement | `^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s*\t(.*)$` | address, 1-3 hex bytes, TAB, xa-syntax statement |
| label | `^([0-9a-f]{4})\s+(\S+):$` | label on its **own** line under `-a dump` |
| comment | `^; .*$` | e.g. `; 12 byte BASIC header.` |
| addressless pseudo-op | `^\s+\t(\.word\|\* =).*$` | the load-address preamble |
| blank | `^$` | separator |

Code-vs-data classification: `.byt` (three bytes per line) → data; `.word` → data,
and specifically an address-table entry under `-t detect-internal`; anything else →
code. **`;` comments are semantic, not decoration** (`; 12 byte BASIC header.` is
dxa telling you what `-U` decided).

**The false-positive direction is visible in that very sample.** The trailing
`"HELLO"` string at `$0823` decoded as `pha / eor $4c / jmp $004f` — data called
code, the dangerous direction, exactly as the roadmap records (`FIXTURE_FALSE_POSITIVES: 3`).
Forcing it with `-b '?0823-0828'` correctly re-emitted it as `.byt` (MEASURED). That
is the `AUTO-07` graphics-feedback loop in miniature and it demonstrably works.

**A refusal signal a parser can key on, and one it cannot.** `-v` writes a phase log
to **stderr** — `dxa: SYS 2061 found, marking as entry point` /
`dxa: BASIC text marked as dead through $080c` / `dxa: disassembling $0801-$0829` /
`dxa: scanning sure section $080d` / `dxa: Searching for address tables.` /
`dxa: Dumping the source code.` (MEASURED). That is a real progress/decision trace
worth capturing alongside the listing. But **`-d strict` did *not* exit non-zero** on
my fixture (`exit 0`, MEASURED) even though the man page says a consistency error
"will occur and disassembly will stop" — so `DXA-03`'s "refuses by name" gate must be
**this project's parser refusing**, not dxa's exit status. Whether `-d strict` ever
exits non-zero is **UNVERIFIED**; the probe is a deliberately inconsistent fixture
where a declared routine falls into illegal opcodes, asserting the exit code.

### B.3 The flags that matter

| Flag | Purpose | Note |
|---|---|---|
| **`-b xxxx-yyyy`** | Declare a data block (hex, inclusive) | Three strengths: bare, `!xxxx-yyyy` = *also no vectors in it*, `?xxxx-yyyy` = *completely unused, so no routine may reference into it*. `?` is the strong form and the man page warns it can misfire on real C64 code that legitimately references `$CFFF`, `$9FEA`/`$9FEB`, and `BIT`-skip addresses like `$1A9`/`$2A9`. |
| **`-B <file>`** | Data blocks from a file, one per line | **The programmatic route** for `AUTO-07`'s feedback from the store. Prefer over building a long argv. |
| `-r xxxx` / `-R <file>` | Declare a routine / routines from a file | The entry-point hint set. |
| `-l <file>` | Read labels in `xa -l` symbol-file format | A **second** already-existing bridge between the store and dxa, beside `-B`. |
| **`-p <set>`** | Instruction set | Six values: `standard-nmos6502` (default), `r65c02`, `all-nmos6502`, `rational-nmos6502`, `useful-nmos6502`, `traditional-nmos6502`. For cracked code use **`all-nmos6502`**. Note dxa's own five-way judgment taxonomy of illegal opcodes is a ready-made cross-check on the SLEIGH extension's coverage decisions. |
| **`-a dump`** | Address + hexdump prefix | Mandatory for the parser. |
| **`-G` / `-g xxxx`** | Auto start-address vs. explicit | `.prg` → `-G` (default, consumes the first two bytes). **Flat 64K → `-g0000`.** |
| `-q` / `-Q` | Suppress / emit the `.word` load address | Use `-q` for flat images to avoid a phantom `.word` at the top. |
| **`-U`** | Detect a BASIC header, parse `SYS`, mark the header dead | Works: MEASURED `SYS 2061 found`. Turns step 1 of `c64-program-recon` into a flag. Man page: likely to become the default upstream. |
| `-d <mode>` | Data-block detection: `poor` (default), `strict`, `skip-scanning` | `poor` maximises code; `skip-scanning` is the conservative setting for graphics-heavy images. |
| `-t <mode>` | Address tables: `ignore`, `detect-all`, `detect-internal` (default) | This is the dispatch-table discovery that feeds `PROOF-02`. |
| `-J` / `-j` | JSR may not return (PRIMM-style inline data) | `-J` matters for crack/loader code. |
| `-M`, `-W`, `-C`, `-O`, `-E` | jump-to-self valid; BRK as routine exit; obfuscated branches; one-byte routines; external labels | Each is a knob on the false-positive/negative tradeoff `PROOF-01` measures. |

**Hard limit:** files longer than 64K, or which extend past `$FFFF` given the load
address, are **truncated with a warning** (SOURCE, man page NOTES). A 65536-byte
flat image at `$0000` fits exactly. A 30 464-line listing came out of a random 64K
image in well under the 120 s timeout, exit 0 (MEASURED) — so runtime is not a
concern and the "megabyte-scale export" worry in (d) is about Ghidra, not dxa.

### B.4 Integration points for (b)

- Vendor the tarball, or the pinned URL + digest, and build with `make` behind a
  digest gate. The digest must be written **before** the fetch, as Phase 23 did.
- The listing parser is **owned code**, a new sibling module — never appended to
  `vice-proxy.ts`.
- Its output is a code/data map that lands in `.annostore` through the existing
  12-member type vocabulary. `.byt` → a data type; statements → code. Nothing new
  in the store schema.
- The `-B` and `-l` file inputs are the store→dxa direction and want a small
  emitter each, not a new protocol.
- **dxa never touches VICE.** Like the `anno_*` family it is backend-agnostic by
  construction — but unlike `anno_*` it is a **host binary**, so it is a (d) consumer.

---

## (c) Ghidra headless + a SLEIGH extension

Phase 23's evidence is primary and is **extended, not re-derived**: the recorded
command line (`-processor 6502:LE:16:default`, `-loader BinaryLoader`,
`-loader-baseAddr 0x0`, `-noanalysis`, `-preScript`, `-postScript`,
`-analysisTimeoutPerFile`, `-deleteProject`), the committed `ExportAnalysis23.java`
and `FlatVolatile.java` using `DecompInterface`, and its three operational
constraints (no dot-prefixed path element; **exit 0 even when a post-script throws**,
so the run log must be grepped for `ERROR REPORT SCRIPT ERROR`; block-total vs.
image-size line count on the `.prg` route) all stand.

### C.1 Versions, verified

| Item | Value | Label |
|---|---|---|
| Latest Ghidra release | **12.1.3**, tag `Ghidra_12.1.3_build`, published 2026-08-18 | MEASURED (`gh api …/releases/latest`) |
| Sole asset | `ghidra_12.1.3_PUBLIC_20260817.zip` | MEASURED |
| Zip size | **569 445 154 bytes (543 MiB)** | MEASURED |
| Zip sha256 | `93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54` | MEASURED (release digest field) |
| Unpacked size | **882 MiB** | MEASURED (`du -sh`) |
| Installed build metadata | `application.version=12.1.3`, `application.build.date=2026-Aug-17 1710 UTC`, `application.release.name=PUBLIC`, `application.revision.ghidra=8b4c91d4…` | SOURCE |
| JDK floor / ceiling | **min 21, no max**; compiler 21 | SOURCE (`application.properties`) |
| Host JDK | OpenJDK 21.0.12.1 (Debian 13) | MEASURED |
| Gradle floor | 8.5 — **only for Java-bearing extensions** | SOURCE |
| Licence | Apache-2.0 | recalled, and consistent with the shipped `LICENSE.txt` per processor module — the **full-tree licence audit is UNVERIFIED**; the probe is reading `$GHIDRA/licenses/` and the top-level `LICENSE`. |

**Phase 23 probed the version that is still current.** No Ghidra upgrade is pending
and no command-line drift has to be re-established.

### C.2 `analyzeHeadless` — the complete option surface

Read verbatim from `support/analyzeHeadlessREADME.md` (MEASURED):

```
analyzeHeadless <project_location> <project_name>[/<folder_path>] | ghidra://<server>[:<port>]/<repo>[/<folder>]
    [[-import [<directory>|<file>]+] | [-process [<project_file>]]]
    [-preScript <ScriptName> [<arg>]*]   [-postScript <ScriptName> [<arg>]*]
    [-scriptPath "<path1>[;<path2>...]"] [-propertiesPath "<path1>[;...]"]
    [-scriptlog <file>] [-log <file>] [-overwrite] [-recursive [<depth>]]
    [-readOnly] [-deleteProject] [-noanalysis]
    [-processor <languageID>] [-cspec <compilerSpecID>]
    [-analysisTimeoutPerFile <seconds>]
    [-keystore <path>] [-connect [<userID>]] [-p] [-commit ["<comment>"]]
    [-okToDelete] [-max-cpu <cores>] [-librarySearchPaths <path1>[;...]]
    [-loader <name>] [-loader-<argname> <argvalue>]
```

Options Phase 23 did not use that this milestone should weigh: **`-process`** (run
scripts against files already in a project, i.e. **no re-import**), **`-readOnly`**,
**`-log` / `-scriptlog`** (a *file* to grep instead of parsing stdout — directly
useful given the exit-0-on-throw defect), **`-max-cpu`**, **`-propertiesPath`**
(pass script arguments without stuffing them into argv), and `-recursive`.

### C.3 Two more operational constraints, found this pass

Both extend Phase 23's list of three.

4. **`analyzeHeadless` does not create the project *location* directory.** With a
   non-existent `<project_location>`: `ERROR Abort due to Headless analyzer error:
   Directory not found: /home/henrik/c64-re-tools-lang-probe … java.io.FileNotFoundException`,
   exit 1 (MEASURED). It creates the *project* inside an existing directory, not the
   directory. `mkdir -p` is a precondition, and it composes badly with constraint 1
   (no dot-prefixed element) — so the harness needs an explicit, non-hidden,
   pre-created scratch location.
5. **The `ZERO_PAGE` / `STACK` "Failed to add language defined memory block due to
   conflict" INFO lines are *not* specific to the flat-64K route.** Phase 23 recorded
   them as appearing "in the flat-64K route only". They also appear for a **4096-byte**
   image at `-loader-baseAddr 0x0` (MEASURED). The real trigger is "the image covers
   `$0000-$01FF`", not "the image is 64K". A harness that greps its log for a failure
   keyword must exempt them on *any* base-0 import, which is a slightly wider
   exemption than the recorded note implies.

### C.4 The SLEIGH extension — the drop-in route WORKS, and the committed source DOES NOT COMPILE

Two findings, one good and one that changes planning.

**Finding 1 — a 6502 language variant installs headlessly with no Ghidra build and
no Gradle. MEASURED end to end.** Minimum file set:

```
$GHIDRA/Ghidra/Extensions/<ModuleName>/
  Module.manifest            # may be EMPTY -- the shipped 6502 module's is zero-length (SOURCE)
  extension.properties       # name= description= author= createdOn= version=
  data/sleighArgs.txt        # may be empty
  data/languages/
    <name>.ldefs             # declares processor/endian/size/variant/version/slafile/processorspec/id
    <name>.slaspec           # @include "<path>/6502.slaspec"  +  @include "6502_undocumented.sinc"
    <name>.sla               # produced by support/sleigh
    6502.pspec  6502.cspec   # copied from Ghidra/Processors/6502/data/languages/
```

Built with `support/sleigh <name>.slaspec <name>.sla`, then:

```
analyzeHeadless <dir> langprobe -import tiny.bin \
  -processor 6502:LE:16:nmos -loader BinaryLoader -loader-baseAddr 0x0 -noanalysis -deleteProject
→ INFO  Using Language/Compiler: 6502:LE:16:nmos:default (ProgramLoader)
→ INFO  REPORT: Import succeeded (HeadlessAnalyzer)          [exit 0]
```

**No `gradle` on this host's `PATH`, and none needed.** `support/buildExtension.gradle`
and the Gradle ≥ 8.5 floor apply only to extensions that ship compiled Java.
The probe extension was removed afterwards, leaving the install as found.

The `.ldefs` used a **new `variant`** (`nmos`) under the existing `processor="6502"`,
giving language id `6502:LE:16:nmos`. That is the collision-free shape the
undocumented-opcode doc's `@include` layering already argues for: stock
`6502:LE:16:default` and `65C02:LE:16:default` are untouched, so the `65c02.slaspec`
opcode-byte collision the doc warns about cannot arise.

**Finding 2 — `docs/undocumented-opcodes-ghidra.md`'s extension source does not
compile under Ghidra 12.1.3. This contradicts the roadmap.** ROADMAP.md states
*"the extension source exists in full at `docs/undocumented-opcodes-ghidra.md`
(766 lines, all 105 bytes) … `OPC-01..03` integrate and verify it; they do not
write it."* Extracted verbatim from the fence (547 lines of `.sinc`), wrapped in
`@include "6502.slaspec"` + `@include "6502_undocumented.sinc"`, and compiled:

```
ERROR 6502_undocumented.sinc:217: ... Main section: Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:390: ...   (same)
ERROR 6502_undocumented.sinc:449: ...   (same)
ERROR 6502_undocumented.sinc:458: ...   (same)
ERROR 6502_undocumented.sinc:493: ...   (same)
ERROR 6502_undocumented.sinc:504: ...   (same)
ERROR 6502_undocumented.sinc:518: ...   (same)
ERROR 6502_undocumented.sinc:525: ...   (same)
WARN  2 NOP constructors found
ERROR No output produced
```

**8 failing constructors; no `.sla` emitted.** MEASURED.

**The control passed.** Stock `6502.slaspec`, compiled in the same scratch
directory with the same `sleigh` binary, produced a **5094-byte** `.sla` — byte-size
identical to the shipped `6502.sla` — with only benign warnings (`1 NOP constructors`,
`Unreferenced table: 'ADDR8'`). So the 8 errors are in the extension source, not in
the harness. That is a fix-observed-green / defect-observed-red pair, in the form
this project's standing constraints require.

**Root cause, one class for all 8.** Every failure is an **unsized value used where
SLEIGH needs an explicit size**, in two flavours:

- *Userop return has no intrinsic size* (lines 390, 458, 493, 504, 518, 525): all six
  `define pcodeop` calls — `unstableXAA`, `unstableLAXImmediate`, `unstableAHXStore`,
  `unstableTASStore`, `unstableSHXStore`, `unstableSHYStore` — are consumed as
  `local value:1 = unstableXXX(...)` or `A = unstableXAA(...)`.
- *Constant token field feeding a sized expression* (line 449): `undocSBC(imm8)`,
  whose macro body does `zext(value)` on an operand that carries no size.

Line 217 (`:NOP imm16 is op=0x0c` with `local ignored:1 = *:1 imm16;`) is the same
family. All are mechanically fixable; none suggests the *semantic modelling* is wrong.

**Consequence for the roadmap, stated plainly.** `OPC-01..03` must be planned as
**fix, compile, and verify**, not "integrate and verify". The good news is that the
gate is now cheap and objective: a green `support/sleigh` compile producing a `.sla`
is a mechanical pass/fail, and `sleigh -n` / `-l` / `-c` give conflict and NOP
diagnostics for free. Also carry forward from the doc's own accuracy notes: `XAA`
(`$8B`) and immediate `LAX/LXA` (`$AB`) stay black-box userops (electrically
unstable), and `AHX`/`TAS`/`SHX`/`SHY` keep the nominal effective address for
static references while the *stored value* is a userop — which is exactly why those
six declarations exist and why fixing them must not collapse them into deterministic
p-code.

### C.5 Vendoring vs. fetching Ghidra

**Recommendation: fetch at first use, never commit.** 543 MiB zip / 882 MiB unpacked
against a repo whose entire payload is ~155k lines of TypeScript. Apache-2.0 permits
redistribution, so this is a size and freshness decision, not a licence one.

- Ghidra becomes a **declared host prerequisite** alongside VICE and ACME, recorded
  by **version, never by install path** — the discipline Phase 23 already adopted
  because its probe install's own README disclaims being depended on.
- If a fetch step is wanted, the release digest is publishable and stable:
  `93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54`.
- What *is* committed: the harness scripts (`ExportAnalysis23.java`,
  `FlatVolatile.java` and their successors), the `.slaspec`/`.sinc`/`.ldefs`
  extension sources, and the `sleigh` invocation. Not the `.sla` — it is a build
  artefact of a specific Ghidra version, and this project already has the
  generated-but-committed pattern (`resources/*.mjs` + `resources-sync.test.ts`) if
  a committed `.sla` with a drift guard is preferred. **Decide deliberately**: a
  committed `.sla` pins the Ghidra version; a built one does not.

### C.6 Version floors for (c)

| Mechanism | Floor |
|---|---|
| `analyzeHeadless` + `BinaryLoader` + `-loader-baseAddr` | any modern Ghidra; **12.1.3 verified** |
| `DecompInterface` structural export | 12.1.3 verified (Phase 23) |
| `support/sleigh` standalone compile | 12.1.3 verified |
| Drop-in language extension, no Gradle | 12.1.3 verified |
| JDK | **21**, no upper bound |
| Gradle | 8.5 — **not required** |

---

## (d) The execution seam — running a JVM-scale host tool from a container-side skill

**Confidence MEDIUM.** This is the one section resting partly on survey rather than
measurement, and it is the section the roadmap should treat as a decision to make,
not a conclusion to adopt.

### D.1 The constraints, restated with numbers

- `seeds/host-tool-executor.md` is explicit that host binaries are reached over the
  broker's container-out seam and never `spawnSync`'d from a skill script — and it
  is framed around **stateless** tools (`c1541`, `petcat`, `cartconv`, `acme`) with
  short-lived open/send/close connections. **Ghidra is nowhere in that seed.**
- `MAX_LINE_BYTES = 65536`, confirmed in **both** the authored `broker-control.mts:242`
  and the compiled `resources/broker-control.mjs:42` (MEASURED). On overflow the socket
  is `destroy()`ed with no error frame — indistinguishable from a drop.
- `ControlRequestKind` is a closed 7-member union: `acquire | release | recycle |
  status | host_state | monitor_claim | monitor_release` (SOURCE). Nothing runs a
  host binary.
- **The broker's process fate is shared.** `broker-kill.mts:367-374` turns any
  unhandled throw into kill-and-exit. Running a JVM inline would make every live
  emulator hostage to a Ghidra bug. The seed already names this the decisive coupling.
- **JVM startup measured on this host: 12 591 ms and 17 386 ms** to reach
  `Headless startup complete` — before any import or analysis. This is the number
  that makes "one `analyzeHeadless` per request" untenable at interactive pace.

### D.2 What comparable projects do

Every implementation surveyed converges on the same shape: **one resident JVM
holding the project open, reached over a localhost socket, returning results
in-process** — explicitly because per-invocation JVM startup is prohibitive. Named:
**PyGhidra**, which is *in-tree* (`Ghidra/Features/PyGhidra/ghidra_scripts` appears
in `analyzeHeadless`'s own script-path list, MEASURED); **pyghidra-mcp**
(clearbluejar); **ghidra-headless-mcp** (mrphrazer); **ghidra-cli** (akiselev), which
connects a CLI to a Java bridge inside Ghidra's JVM via a `ServerSocket` on a dynamic
localhost port. Confidence MEDIUM (web survey, cross-corroborated across four
independent projects; none inspected at source level here).

That is a striking structural parallel: **it is the same design as this project's own
VICE broker** — a long-lived host daemon holding expensive state, a localhost control
socket, dynamic port allocation, leases.

### D.3 Three realistic options

| Option | Shape | Fits the seed? | Cost |
|---|---|---|---|
| **1. Namespaced job op on the existing broker port** — `ghidra_*` prefixed ops routed at the top of `handleLine` before any lease-bearing path, handed a deps object containing **none** of the seven VICE callbacks; work runs in a **child process**; the reply is a **job id**, and results are **files whose paths come back through `containerpath.ts`** | Extends the seed's own design rather than contradicting it: prefix routing (its "namespaced ops"), child-process isolation (its constraint 1's decisive answer), path-not-payload (its constraint 2's stated remedy) | The seed's "no lease, no session, no warm state" assumption breaks: a 12-17 s startup plus multi-minute analysis needs **async jobs**, which the broker has never had. It has leases, not jobs. That is genuinely new machinery. |
| **2. A second leased subsystem beside the VICE pool** — a resident Ghidra JVM with its own lease, its own port, supervised by the same broker | Matches what every surveyed project does, and matches the broker's own proven architecture | Most new code. Two pools to supervise, and the single-owner `inFlight` launch-guard discipline has to be replicated (or generalised) without weakening the one that exists — CLAUDE.md pins it as a synchronous check-and-set because of a real outage. |
| **3. Widen the stateless executor and eat the startup cost** — one `analyzeHeadless` per request, results as file paths | Smallest delta, closest to the seed as written | 12-17 s dead time per call, and the container-side client must hold a connection open for minutes against a 64 KiB-line protocol with no chunking and no heartbeat. Realistic **only** if Ghidra runs once per corpus item as a batch step, not per query. |

**Opinion.** For v0.8.0's actual need — a raw image in, a structural export out,
once per corpus item — **option 1 with a batch framing is the right size**, and
`-process` (run scripts against files already imported, no re-import) plus
`-log`/`-scriptlog` to a file makes one JVM invocation cover many post-scripts. The
`.asm`/`.c`/`.json` three-file idea from the pasted proposal fits this naturally:
they are **files**, which is exactly what the 64 KiB cap forces anyway.

Option 2 is the right end state if Ghidra ever becomes interactive (an agent asking
"decompile this function" mid-session), and the milestone should say which of those
two futures it is building toward rather than discovering it later.

**Open question this document does not settle, and neither does the todo:** whether
`program.json` should exist at all, or whether the Ghidra post-script should write
**directly into `.annostore`** through the `anno_*` verbs. The post-script runs
host-side inside a JVM; `.annostore` is a `node:sqlite` file behind a container-side
seam. Writing to it from Java would either duplicate the seam in a second language or
require the JVM to call back through the broker — both of which are worse than
emitting a file the container-side importer consumes. **Recommendation: emit files
host-side, import container-side through the existing seam.** That keeps
`STORE-*`'s single-seam property intact and keeps Java out of the store's schema.

### D.4 The retroactive migration this milestone inherits

The seed's retroactive scope means **acme-build's `spawnSync("acme", …)` PATH ladder
(`scripts/acme.mjs:124`) and `packer-finding.mjs:247,306` move behind the same seam**,
with a grep gate banning external-binary spawns in `src/skills/*/scripts/`. dxa
becomes a **third** consumer of that gate on day one. Whatever seam (d) chooses has
at least four callers immediately — which argues for building it properly rather than
bolting a Ghidra-shaped hole into the control plane.

---

## Installation

No npm changes. All of this is host prerequisites, launch flags and vendored source.

```bash
# (a) frame-exact stop -- nothing to install. Stock VICE >= 3.9 already suffices.
#     x64sc must be launched with BOTH monitors and the determinism flags:
x64sc -default \
      -binarymonitor -binarymonitoraddress ip4://127.0.0.1:$BINPORT \
      -remotemonitor -remotemonitoraddress ip4://127.0.0.1:$TXTPORT \
      -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 \
      -warp -sounddev dummy
#     (-default MUST precede -binarymonitor, and -drive8type 1541 ordering is pinned)

# (b) dxa 0.1.5 -- vendored, digest-gated, built
echo '8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799  dxa-0.1.5.tar.gz' > dxa-0.1.5.tar.gz.sha256
curl -fsSL -o dxa-0.1.5.tar.gz https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz
sha256sum -c dxa-0.1.5.tar.gz.sha256          # refuse the build if this fails
tar xzf dxa-0.1.5.tar.gz && cd dxa-0.1.5 && make && make test
# -> ./dxa, sha256 0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523

# (c) Ghidra 12.1.3 -- host prerequisite, fetched not committed
#     https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.3_build/ghidra_12.1.3_PUBLIC_20260817.zip
#     sha256 93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54  (543 MiB)
#     requires JDK >= 21 (Debian 13: apt install openjdk-21-jdk)
#
#     SLEIGH extension -- no Gradle, no Ghidra rebuild:
mkdir -p "$GHIDRA/Ghidra/Extensions/C64Nmos6502/data/languages"
: > "$GHIDRA/Ghidra/Extensions/C64Nmos6502/Module.manifest"     # empty is correct
: > "$GHIDRA/Ghidra/Extensions/C64Nmos6502/data/sleighArgs.txt"
# + extension.properties, *.ldefs (variant="nmos", id="6502:LE:16:nmos"),
#   *.slaspec, 6502.pspec, 6502.cspec
"$GHIDRA/support/sleigh" 6502_nmos.slaspec 6502_nmos.sla
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Text-monitor `stopwatch` for the monotonic clock | `CPUHISTORY_GET` (0x86) newest-entry cycle count over binmon | Only on VICE ≥ 3.10 *and* only if the text channel is unavailable. It forces a 3.10 floor that excludes every current Debian/Ubuntu — and `chis` over text gives the same data on 3.9. |
| Converge to a cycle target by counted `step` | Checkpoint condition on `(RL == N)` + `ignore <F-1>` | Better when the program *has* an address executed exactly once per frame (its own raster IRQ). Fewer round trips. But it is **not general**: `$EA31` is CIA-timer driven at ~60.4 Hz, not frame-locked, and my measurement shows it landing on `LIN` 116/223/267 across runs. Use it as a fast path with the cycle-target loop as the fallback. |
| `-raminit*` determinism flags | `-seed <value>` | `-seed` is a plausible-looking single lever and I did **not** establish that it alone fixes RAM init; the three `raminit*` flags demonstrably do. Prefer the flags. Setting `-seed` as well costs nothing and pins any other RNG consumer. |
| `bsave` 64K to a host file | `.vsf` `dump` + `C64MEM` slicing | `.vsf` is the already-validated route and carries chip state too; `bsave` is a cheap independent cross-check that the slicer is correct. Use both, at least once, as a two-instrument agreement test. |
| dxa `-B <file>` for data blocks | Long `-b` argv | `-b` for a handful of hand-authored ranges; `-B` for anything derived from the store. |
| Fetch Ghidra at first use | Vendor the 543 MiB zip | Vendor only if a hermetic offline build becomes a hard requirement. Apache-2.0 permits it; repo size does not. |
| Emit `.asm`/`.c`/`.json` files, import container-side | Ghidra post-script writes `.annostore` directly | Never, in my view — it duplicates the store seam in Java or forces a JVM→broker callback. |
| Option 1 (namespaced job op) for (d) | Option 2 (leased Ghidra subsystem) | When Ghidra becomes interactive rather than batch. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **VICE event record/replay** as the frame-exact mechanism | Recording has **no command-line option and no non-UI caller on any version** — `event_record_start()` is reachable only from GTK3/SDL UI actions (MEASURED + SOURCE). Playback is launch-time only. | The measured recipe in § A.4. |
| The text monitor's **`record` / `playback`** commands | They are **monitor-command file** scripting, not event history (MEASURED via `help record`). Mistaking them is a live trap. | Nothing — they are not relevant to determinism. |
| `-limitcycles` | Quits the emulator with an error at the cycle limit (MEASURED), so no capture survives. | The counted-`step` convergence loop. |
| Treating `LIN`/`CYC` as a frame counter | Not monotonic, and measurably drift across runs at the same instruction (`LIN` 116/223/267, MEASURED). | Derive frames from `stopwatch` / cycles-per-frame. |
| Expecting a `STOPWATCH` register over the binary monitor | `mon_reg_list_6510[]` has no such entry (SOURCE). It is a text-only print column. | Text channel. |
| Bare decimal literals in monitor commands | Hex by default: `z 100` steps **256** instructions (MEASURED). | `$`-prefixed literals everywhere, always. |
| A breakpoint on `$FCE2` as a post-`reset 1` anchor | `reset 1` runs past the reset vector before returning control; the breakpoint never fires (MEASURED, twice). | `$E453` or another later once-per-reset address. |
| Trusting `analyzeHeadless`'s exit status | **Exit 0 even when a post-script throws** (PRIMARY, Phase 23). | Grep the run log — now easier via `-log` / `-scriptlog` to a file. |
| Trusting `dxa -d strict`'s exit status | Exited **0** on my inconsistent fixture (MEASURED), contradicting the man page's "disassembly will stop". | The owned parser's own by-name refusal (`DXA-03`). |
| Planning `OPC-01..03` as "integrate the existing source" | **It does not compile** — 8 constructors, `No output produced`, with a passing control (MEASURED). | Plan fix→compile→verify, gated on a green `sleigh` run. |
| Gradle, or a Ghidra source build, for the SLEIGH extension | Neither is needed for a language-only extension (MEASURED end to end). | `support/sleigh` + a drop-in `Ghidra/Extensions/<Name>/` module. |
| A new npm runtime dependency (`better-sqlite3`, an interval tree, a parser combinator) | Already Out of Scope, and nothing here needs one. | Node builtins + owned code. |
| Running Ghidra inline in the broker process | `broker-kill.mts:367-374` makes any unhandled throw kill the whole VICE pool. | Child process, always. |
| Returning a Ghidra export inline over the control channel | 64 KiB line cap, and overflow `destroy()`s the socket with no error frame (MEASURED, both halves). | Write host-side, return a `containerpath.ts`-translated path. |
| `spawnSync` of any external binary from a skill script | The seed's rule, and a grep gate is planned. dxa would be the third violation. | The (d) seam. |

## Stack Patterns by Variant

**If the target is PAL (the C64 crack-scene default):**
- cyclesPerFrame = **19656**; confirmed empirically by `LIN` equality across 50 frames.

**If the target is NTSC / NTSC-old / PAL-N:**
- 17095 / 16768 / 20280 from `c64.h` (SOURCE), **UNVERIFIED on this host**.
- `MachineVideoStandard` is a **power-cycling** resource — set it at launch, never at runtime.

**If the backend is `stock`:**
- Everything in (a) works at a **3.9** floor. The text-monitor client is required.

**If the backend is `fork`:**
- The 3.10 fork has the same six event options and the same absent `-record` (MEASURED),
  so (a)'s recipe is *portable* — but the fork's HTTP-mediated stop is the thing the
  todo measured as non-frame-exact, so a frame-exact tool is **stock-first and
  fork-degraded**. Confirming (or refuting) that the fork's `-remotemonitor` text
  channel restores exactness is **UNVERIFIED**; the probe is `det5.mjs`'s recipe run
  against `/usr/local/bin/x64sc`.

**If a devcontainer is in play:**
- dxa, Ghidra, `acme`, `c1541`, `petcat` are all **host-side**. Nothing in (b) or (c)
  may be spawned from a skill script. Note there is **no devcontainer in this repo** —
  the seam is for consumers, so its correctness cannot be demonstrated here and must
  be asserted structurally, the way `hostpath-consumers.test.ts` already does.

## Version Compatibility

| Component | Compatible with | Notes |
|---|---|---|
| stock VICE 3.9 | the entire (a) recipe | MEASURED. No 3.10 requirement anywhere in (a). |
| stock VICE 3.9 | `CPUHISTORY_GET` (0x86) | **INCOMPATIBLE** — opcode absent. `chis` over text is the 3.9 route. |
| Ghidra 12.1.3 | JDK 21 (no max) | MEASURED (`application.java.min=21`, empty max). |
| Ghidra 12.1.3 | Gradle 8.5 | Only for Java-bearing extensions. Not needed here. |
| Ghidra 12.1.3 | Phase 23's recorded command line | Same version — no drift to re-establish. |
| Ghidra 12.1.3 `support/sleigh` | `docs/undocumented-opcodes-ghidra.md` | **INCOMPATIBLE as committed** — 8 errors, no output. Control (`6502.slaspec`) compiles clean. |
| dxa 0.1.5 | images > 64K or extending past `$FFFF` | Truncated with a warning (SOURCE). Segment first. |
| dxa 0.1.5 | `-p all-nmos6502` output → `xa` | Man page warns illegal-opcode output may be unintelligible to `xa`. This project reassembles with **ACME**, not `xa`, so it must not assume round-trip. |
| Node ≥ 24 | everything new | No change; `net` + `child_process` + `crypto` are builtins. |

## Sources

**MEASURED on this host, 2026-09-02** (HIGH confidence — primary):
- `/usr/bin/x64sc --version` → `x64sc (VICE 3.9)`; `/usr/local/bin/x64sc --version` → `x64sc (VICE 3.10)`
- `/usr/bin/x64sc -help` (1828 lines) — the six `event*` options, `-playback`, `-seed`, `-limitcycles`, the seven `-raminit*` options, absence of `-record`
- `/usr/bin/x64sc -record` → `Unknown option '-record'`, exit 255
- 9 cold `x64sc` launches driven over `-remotemonitor`: `help`, `help {reset,break,ignore,stopwatch,until,bsave,record,warp,cpuhistory,step,condition}`, `device c:`, `break exec`, `ignore`, `g`, `step`, `stopwatch [reset]`, `registers`, `bank ram`, `bsave`, `quit`. Transcripts and the six 64K dumps under `/home/henrik/.cache/c64-re-tools/frame-probe/`
- 3-way byte diff of `d1/d2/d3-ram.bin` → 1554 bytes / 1514 ranges; `e1/e2/e3-ram.bin` → identical sha256
- dxa: fetch + `sha256sum -c` + `make` + `make`-built binary digest + `man -l dxa.1` + `-a dump` / `-v` / `-d strict` / `-b '?…'` / flat-64K runs, under `/home/henrik/.cache/c64-re-tools/dxa-probe/`
- `https://www.floodgap.com/retrotech/xa/dists/` directory listing
- `gh api repos/NationalSecurityAgency/ghidra/releases/latest` → 12.1.3, asset name/size/sha256
- `support/sleigh` on the extracted `.sinc` (8 errors, no output) and on stock `6502.slaspec` (clean, 5094 bytes) — the control pair
- `support/analyzeHeadless` with `-processor 6502:LE:16:nmos` against a drop-in extension → `Using Language/Compiler: 6502:LE:16:nmos:default`, exit 0; and the `Directory not found` abort, exit 1
- `grep MAX_LINE_BYTES src/mcp/vice/broker-control.mts src/mcp/vice/resources/broker-control.mjs` → 65536 in both

**SOURCE — read directly** (HIGH confidence):
- VICE `src/event.c` (1336 lines), `src/monitor/mon_register6502.c`, `src/monitor/monitor.c`, `src/arch/gtk3/actions-snapshot.c`, `src/c64/c64.h`, `src/vicii/vicii-timing.{c,h}` — fetched from `raw.githubusercontent.com/VICE-Team/svn-mirror/main/`
- GitHub code search `event_record_start repo:VICE-Team/svn-mirror` → 6 files
- Ghidra 12.1.3 `application.properties`, `Ghidra/Processors/6502/{Module.manifest,data/languages/*,data/build.xml,data/sleighArgs.txt}`, `Extensions/Ghidra/Skeleton/*`, `support/analyzeHeadlessREADME.md`, `support/launch.properties`
- dxa 0.1.5 `Makefile`, `INSTALL`, `main.c` licence header, `dxa.1`
- This repo: `src/mcp/vice/probe-binmon.mjs` (`CMD` table, `advanceInstructionsBody`), `broker-control.mts:30,242`

**PRIMARY (repo)** (HIGH confidence — recorded real runs, carried not re-derived):
- `.planning/phases/23-…/evidence/tools/instrument-provenance.txt` — the dxa pin and build, Ghidra 12.1.3 + JDK 21, the `analyzeHeadless` command line, the dot-path abort, the exit-0-on-script-throw defect, `VICE_BACKEND: fork 3.10`
- `.planning/notes/text-monitor-channel-live-probe.md` — `sw`, `chis 4`, `warp`, `device c:`, `bt`, `prof`, `io`, `memmapshow` on stock 3.9, and the halt-on-command semantics
- `.planning/todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md` — the 201-vs-1 divergence measurement
- `.planning/seeds/host-tool-executor.md` — the container-out rule and its seven design constraints
- `CLAUDE.md` / `PROJECT.md` — the settled protocol and capability constraints. **Nothing here contradicts them.** Three are *scoped* by new evidence, none refuted: (i) "no monotonic cycle register" — true of registers; the text `stopwatch` is the remedy, and `mon_register6502.c` now explains why; (ii) "`CPUHISTORY_GET` requires 3.10" — true of the opcode, not the capability; (iii) "warp must be launch-time" — true of the resource, not the `warp` command.

**Web survey** (LOW→MEDIUM confidence — cross-corroborated across four independent projects, none inspected at source level):
- [ghidra-cli (akiselev)](https://github.com/akiselev/ghidra-cli), [ghidra-headless-mcp (mrphrazer)](https://github.com/mrphrazer/ghidra-headless-mcp), [pyghidra-mcp (clearbluejar)](https://clearbluejar.github.io/posts/pyghidra-mcp-headless-ghidra-mcp-server-for-project-wide-multi-binary-analysis/), [Ghidra PyGhidra README](https://www.ghidradocs.com/11.4_PUBLIC/Ghidra/Features/PyGhidra/pypkg/README.html), [Ghidra Tip 0x05: Headless execution](https://maxkersten.nl/2024/06/30/ghidra-tip-0x05-headless-execution/) — all converging on one resident JVM behind a localhost socket

**UNVERIFIED, each with its probe:**
1. NTSC / NTSC-old / PAL-N cycles-per-frame → re-run the § A.4 recipe under `-ntsc`/`-ntscold`/`-paln`, assert `LIN` equality across a whole number of frames.
2. Whether the recipe survives an **autostarted program** (the real use case, where drive timing enters) → autostart a `.prg`, anchor on its own entry, converge, compare 64K across two cold runs.
3. Whether a text client and a binary client can be connected **simultaneously** without one's halt/resume corrupting the other's view → arm a checkpoint over binmon, read `stopwatch` over text, assert the two report the same PC.
4. Whether the **fork** backend's text channel restores frame-exactness → same recipe against `/usr/local/bin/x64sc`.
5. Whether a GUI-recorded event history **replays** cycle-identically → hand-record in GTK3, relaunch twice with `-eventstartmode 3 -playback`, compare 64K at a fixed cycle. *Low value: the recording half is unautomatable regardless.*
6. Whether `dxa -d strict` **ever** exits non-zero → a fixture where a declared routine falls into illegal opcodes; assert the exit code.
7. Ghidra's **full-tree licence** position beyond the per-module `LICENSE.txt` → read `$GHIDRA/licenses/` and the top-level `LICENSE`.
8. The **RTC / CIA TOD** contribution to cross-run divergence → it did not surface, because with `raminit*` pinned the images were identical; it may resurface once a real program runs long enough to read TOD. Probe: extend the frame target by 100× and re-compare.

---
*Stack research for: deterministic emulator capture + offline 6502 static analysis*
*Researched: 2026-09-02*
