---
title: Stock VICE migration — revised loss ledger, version constraint, and dual-backend recommendation
date: 2026-08-11
context: /gsd-explore — "what are the pros and cons to switch from the vice MCP to the stock vice"
supersedes_on_scope: docs/stock-vice-parity.md §A losses #3 and #5; docs/phase0-binmon-findings.md §1, §4
---

# Stock VICE migration: revised ledger

Outcome of an exploration session that researched the three "load-bearing" capability
losses against VICE source. All findings verified against `VICE-Team/svn-mirror`
master @ `e50d42c` (2026-08-09). The corrective edits are tracked as a todo:
`.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`.

## What the fork actually is

The load-bearing dependency is [barryw/vice-mcp](https://github.com/barryw/vice-mcp):
a fork of VICE with **~17,000 lines of C** compiled into the emulator core as a
first-class subsystem, GPL-2, MCP work on an `mcp-server` branch tracking upstream
`main`. Stated goal is eventual upstreaming.

- **It does ship prebuilt releases** — Linux x86_64 (GUI + headless), macOS arm64
  (GUI + headless), Windows x86_64 (**headless only**). So "only Henrik can run this"
  is false; people can download it.
- **But:** single maintainer, 4 stars, 2 forks. 17k lines of C riding a project with
  36k upstream commits.
- **Platform holes stock closes for free:** no Windows GUI, no macOS x86_64, no Linux ARM.
- **This repo never mentions it.** Zero references to `barryw` or the fork anywhere
  outside `node_modules`. A user running `npx @henols/c64-re-tools` gets no instruction
  on where to obtain a working emulator. (Not captured as a todo this session —
  worth fixing regardless of migration outcome.)

## Correction to an earlier framing: the single-connection "con" is not a con

An initial pass listed "the binary monitor is a single stateful TCP connection" as a
cost. It isn't. The current HTTP-MCP endpoint is **already** one stateful session per
emulator (session header, `activeUrl`, `beginSession()`/`assertSameMachine()` in
`.claude/mcp/vice/vice.ts`), and the broker's lease/epoch/instance model exists
precisely because one emulator serves one stateful connection. Swapping HTTP for TCP
is the same topology on a different port; the per-instance concurrency model carries
over intact.

The one genuine protocol difference is narrower: HTTP correlates each response by its
own `fetch`, whereas the binary monitor interleaves solicited responses with
**unsolicited** `STOPPED` (0x62) / `RESUMED` (0x63) / `JAM` (0x61) events at request-id
`0xffffffff`. That needs a demuxer plus a request-id correlation table — local to the
new client behind the `call()` seam, not a broker redesign.

This makes the migration **cheaper than `docs/roadmap-stock-vice.md` implies**. Its
"Costs" bullet claiming "the broker/concurrency model needs review" overstates the work.

## Revised loss ledger

| # | Loss (per `stock-vice-parity.md` §A) | Revised status |
|---|---|---|
| 1 | SID state read-back | **Hard loss.** Unchanged. `$D400–$D418` write-only in hardware; no SID command in the monitor. Only `$D419–$D41C` readable. Client write-shadowing catches only writes *we* issue, never the program's |
| 2 | Low-level / matrix keyboard | **Hard loss, source-confirmed.** See below |
| 3 | On-demand pause | **DISSOLVED.** `PING` (0x81) halts within ~1 frame — any inbound byte triggers `monitor_startup_trap()` (`monitor_binary.c:281` ← `monitor.c:395`) |
| 4 | run-until-N-cycles | Still approximate. Run-until-*address* exact via checkpoint |
| 5 | Cycle stopwatch | **LARGELY DISSOLVED.** No CPU-history dependency — see below |
| 6 | VIC-II / CIA *internal* state | Partial. Unchanged. But side-effect-free `MEM_GET` satisfies the *reason* the skills prefer whole-chip reads (read hazards), so the practical gap is smaller than the tool list suggests |

**Net: two genuine losses remain, not four.**

### Loss 2 — matrix keyboard: not recoverable, and the workaround is dead

Every avenue checked and closed:

- Binary monitor has exactly one keyboard opcode, `KEYBOARD_FEED` (0x72) →
  `mon_keyboard_feed()` → `kbdbuf_feed()`. Buffer only. (`monitor_binary.c:106,744`)
- Text remote monitor adds nothing — its `keybuf` (`mon_command.c:298`) is the same
  `kbdbuf` path.
- No resource touches matrix state; only `KbdStatusbar` and `KbdbufDelay` exist.
  `RESOURCE_SET` (0x52) is useless here.
- `keyboard_set_keyarr`/`_any` (`keyboard.c:367,896`) has exactly two callers tree-wide
  — `arch/sdl/vkbd.c` and host-gamepad→key mapping in `joyport/joystick.c:2947`.
  Unreachable from any monitor interface.
- **The CIA-poke workaround cannot work,** for a sharper reason than "fragile":
  `read_ciapb()` (`c64/c64cia1.c:365-420`) recomputes the returned byte live from
  `keyarr`/`rev_keyarr` on **every read**, so a `MEM_SET` to `$DC01` cannot persist.
  Checkpoint-substitution also fails — `monitor_check_watchpoints` fires at the
  *instruction boundary* (`6510core.c:517-521`), i.e. **after** `LDA $DC01` has already
  loaded the accumulator. Faking it would mean `REGISTERS_SET` (0x32) on the
  destination register, which is opcode-dependent (LDA/AND/CMP), with the emulator
  halting per hit: 1–8 reads/frame × 50 fps = 50–400 stop/round-trip/resume cycles
  per second. Not realtime.
- No third-party project drives the matrix on stock builds (pyvicemon, c64vice,
  viceremote, IceBroLite, c64-debug-mcp all use `KEYBOARD_FEED` or joyport).

**Mitigation that actually works:** `JOYPORT_SET` (0xa2) — joyport pins *are* honored
inside `read_ciapa`/`read_ciapb` (`c64cia1.c:301,383`), so games reading the joystick
work normally. The residual gap narrows to true keyboard-matrix cases: "press any key"
gates, chords, RESTORE/NMI.

**The real fix is ~60 lines upstream:** a `KEYBOARD_MATRIX_SET` opcode in
`monitor_binary.c` calling `keyboard_set_keyarr_any`. This reframes the
"wait for upstreaming" argument — closing the hardest gap does not require the fork's
17,000 lines to be accepted, only ~60 targeted ones.

### Loss 5 — stopwatch: available on every stock version

Two independent routes, neither needing CPU history or VICE 3.10:

1. **Reconstruct from `LIN`/`CYC`** — both are in `mon_reg_list_6510`
   (`mon_register6502.c:57`) and returned by `REGISTERS_GET` (0x31), contra
   `phase0-binmon-findings.md`. `cycles = frames × 19656 (PAL) + Δ(LIN × 63 + CYC)`,
   frame count from a non-stopping exec checkpoint at `$EA31` via `hit_count`
   (`CHECKPOINT_GET` 0x11 response bytes 13–16, `monitor_binary.c:493`). Do **not**
   span a non-stopping checkpoint over all memory — one 0x11 event per instruction
   (`mon_breakpoint.c:439-535`).
2. **Text monitor's real `stopwatch`/`sw`** (`monitor.c:1421-1435`) — raw `clk` delta,
   no compile flag. Usable because `-binarymonitor` and `-remotemonitor` **coexist**:
   separate `BinaryMonitorServer` (`monitor_binary.c:2068`) and `MonitorServer`
   (`monitor_network.c:334`) resources, both polled unconditionally in
   `monitor_vsync_hook` (`monitor.c:406-407`).

Worst option, for the record: summing per-instruction costs via `ADVANCE_INSTRUCTIONS`
(0x71) — one trap + round-trip per step, no cycle field in the response, client needs
its own opcode table. Ballpark ≥100× slower than realtime (rate unverified).

> **CONFLICT, 2026-08-12 — route 1's frame counter is undermined by a later finding.**
> Route 1 above proposes a *non-stopping* exec checkpoint at `$EA31` to source the frame
> count. Subsequent research (`.planning/research/PRIOR-CLIENTS.md`) established from
> `mon_breakpoint.c:557-562` that `mon_breakpoint_event(cp)` is called **before**
> `cp->stop` is checked — so a non-stopping checkpoint emits a `CHECKPOINT_INFO` (0x11)
> frame **per hit, synchronously, over the blocking socket, from inside the CPU loop**.
> At `$EA31` that is ~50–60 frames/second of unsolicited traffic for as long as the
> stopwatch exists, and the general mechanism can stall the emulator thread on a hotter
> address.
>
> This does not kill route 1 — 50/sec is probably tolerable and the earlier warning
> against spanning all of memory was already recorded — but the cost was not accounted
> for, and the "do not span all memory" warning turns out to be a specific case of a
> general hazard rather than an isolated quirk. **Resolve during timing-tool planning:**
> prefer route 2 (text-monitor `stopwatch` over a concurrent `-remotemonitor`) if the
> dual-interface path is taken, or measure route 1's actual socket load against a real
> build before committing to it. Do not treat route 1 as free.

**For the `vice-wedge-triage` diagnostic specifically:** `REGISTERS_GET` (0x31) →
`EXIT` (0xaa) → wait → repeat. `(LIN,CYC)` changed ⇒ emulation is advancing
(false-identical odds ~1/19656, killed by two samples). Add `MEM_GET` (0x01) of the
jiffy clock `$A0-$A2`: advancing + jiffy frozen ⇒ IRQs off or wedged; PC identical ⇒
tight loop. Prefer registers over `$D012`, which wraps every frame. Both samples must
straddle an `EXIT` or the values are frozen.

## The new con: VICE ≥ 3.10 required for the flagship gain

`CPUHISTORY_GET` (0x86) exists only in **VICE ≥ 3.10** (manual §13). Debian
trixie/forky/sid and every current Ubuntu ship **3.9**, which has no `0x86` at all.

The compile flag is *not* the problem — `--enable-cpuhistory` is on by default
(`configure.ac:120,521`) and Debian, Homebrew, and official CI all pass it explicitly.
The **version** is the problem.

So CPU-history tracing — called "the standout new capability" in
`stock-vice-parity.md` §B.1 — is unavailable on the most common Linux install path,
i.e. the very `apt install vice` that motivates the migration. Homebrew (3.10) and
official binary releases are fine.

**Implication:** the migration's headline gain is deferred on Linux until trixie+1.
Probe with `VICE_INFO` (0x85) + a trial `0x86` and degrade gracefully on 3.9.
This belongs in requirements as a hard version constraint, not as context.

## Why the losses matter more than "~10–15% of tools" suggests

The lost capabilities sit on documented critical paths in **3 of 6 skills**, not in
rarely-used corners:

- `.claude/skills/c64-program-recon/SKILL.md:171` — "`vice_keyboard_type` does nothing
  → use `vice_keyboard_matrix`", and `references/sound-and-input.md:57` states direct
  `$DC00`/`$DC01` polling **is the norm — assume it until shown otherwise**
- `.claude/skills/c64-ram-capture/SKILL.md:158` — matrix keyboard is step 1 of passing
  a "hit any key" gate
- `.claude/skills/vice-wedge-triage/SKILL.md:89-93` — the wedge bracket is
  `cycles_stopwatch` reset → … → read (now recoverable, see Loss 5)
- `.claude/skills/c64-program-recon/references/tool-selection.md:17` — "**prefer**
  whole-chip `vicii`/`sid`/`cia_get_state` over raw register reads" (the hazard
  rationale is satisfied by side-effect-free `MEM_GET`; the SID *content* is not)

So the honest cost framing is "3 of 6 skills need methodology revision", not
"~10–15% of the tool surface" — though after the Loss 3 and 5 dissolutions, the
revision needed is much smaller than it first appeared.

## Recommendation: dual backend, not replacement

Build the binary-monitor client as a **second backend behind the existing `call()`
seam**, keeping the fork path supported rather than deleting it.

- `vice.ts` already isolates the transport to one function — by design, per its own
  header comment, so that the handshake shape can change in one place.
- The incremental cost of retaining the fork backend is near zero: it is already
  written and tested.
- Stock becomes the default for portability and reach; the fork remains available for
  SID read-back and matrix-keyboard work.
- This removes the project's single-point-of-failure bet without paying for the two
  hard losses.

Framing that matters for the decision: **staying on the fork is not the low-risk
option, it is the deferred-risk option.** The migration is the exit route. If the fork
stalls, this work happens anyway — later, under pressure, instead of now by choice.

Accompanying decisions to record when requirements are written:

1. VICE **≥ 3.10** for full capability; graceful degradation on 3.9 via `VICE_INFO` probe
2. `JOYPORT_SET` (0xa2) as the primary in-game input path, `KEYBOARD_FEED` for KERNAL prompts
3. SID read-back accepted as permanently lost on the stock backend
4. Consider upstreaming `KEYBOARD_MATRIX_SET` (~60 lines) to close Loss 2 for everyone
