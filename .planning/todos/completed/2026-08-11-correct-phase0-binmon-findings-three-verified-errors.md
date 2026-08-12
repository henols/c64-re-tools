---
title: Correct three verified errors in phase0-binmon-findings.md (and derived constraints)
date: 2026-08-11
priority: high
resolves_phase: 1
source: /gsd-explore — "pros and cons of switching from the VICE MCP fork to stock VICE"
---

> **Superseded in scope by DOC-01..03 (Phase 1).** A fourth error was found after this
> todo was written: checkpoint *conditions* use the pseudo-registers `RL`/`CY`, not the
> register-list names `LIN`/`CYC` — those lex as `BANKNAME` and fail with `0x8f`
> (`mon_lex.l:559-560`). See `.planning/research/GAINS-PROTOCOL.md` §B.6 and
> `.planning/REQUIREMENTS.md` DOC-02.

# Correct three verified errors in the Phase-0 binary-monitor findings

`docs/phase0-binmon-findings.md` is **normative** on the binary-monitor wire format
by user resolution W2 (2026-08-11, see `.planning/INGEST-CONFLICTS.md`). Three of its
factual claims are wrong. Because the doc is normative, `.planning/intel/constraints.md`
inherited the errors, and any Phase-1 client design derived from it will inherit them too.

All corrections verified against `VICE-Team/svn-mirror` master @ `e50d42c` (2026-08-09).

## Error 1 — "no pause-now" is wrong; pause on demand is solved

**Current text (§4):** "There is **no 'pause now' opcode** — to stop a free-running
machine on demand, set a temporary checkpoint (or open the monitor). This is the one
real ergonomic wrinkle for `vice_execution_pause`."

**Correction:** `monitor_check_binary()` calls `monitor_startup_trap()` on **any
inbound byte** (`vice/src/monitor/monitor_binary.c:281`), invoked from
`monitor_vsync_hook` (`vice/src/monitor/monitor.c:395`). A bare `PING` (0x81)
therefore halts the machine within ~1 frame and emits `STOPPED` (0x62). No
temporary checkpoint is required.

Failure mode: if there is no vsync (host UI paused or hung), the command times out —
which is itself a useful diagnostic signal for `vice-wedge-triage`.

Consequence: parity-doc loss #3 (`vice_execution_pause` → "approximate") **dissolves**.
It is not a degraded tool on stock VICE.

Secondary note: if a checkpoint *is* used for some other purpose, `CHECKPOINT_SET` is
**0x12** and supports an inclusive start/end address range, so exec `$0000-$ffff`
temporary + stop hits at the next instruction.

## Error 2 — `LIN`/`CYC` are readable via `REGISTERS_GET`

**Current text (§1):** "`e_Cycle` (0x36) and `e_Rasterline` (0x35) are *not real
registers* … So `REGISTERS_GET` (0x31) cannot be a stopwatch."

**Correction:** `LIN` and `CYC` **are** present in `mon_reg_list_6510`
(`vice/src/monitor/mon_register6502.c:57`), and `REGISTERS_GET` (0x31) returns them.
The doc's underlying point is still true — neither is monotonic; `CYC` is
cycle-within-raster-line — but the conclusion drawn from it is too strong.

Absolute cycles can be reconstructed **without CPU history**:

    cycles = frames × 19656 (PAL) + Δ(LIN × 63 + CYC)

with the frame count taken from a **non-stopping** exec checkpoint at `$EA31`, reading
`hit_count` from bytes 13–16 of the `CHECKPOINT_GET` (0x11) response
(`monitor_binary.c:493`).

**Do not** place a non-stopping checkpoint over all of memory to do this: every hit
fires `mon_breakpoint_event()` → one 0x11 event per instruction
(`vice/src/monitor/mon_breakpoint.c:439-535`).

## Error 3 — the CPU-history worry is inverted; the real gate is VICE version

**Current text (§1):** "**VERIFY:** CPU history is a *compile-time* feature. If the
target `x64sc` wasn't built with it, `CPUHISTORY_GET` returns an error or zero
entries and the stopwatch is unavailable."

**Correction, part A — the flag is on by default.**
`VICE_ARG_ENABLE_LIST(cpuhistory, [--disable-cpuhistory ...])` +
`AS_IF([test x"$enable_cpuhistory" != "xno"], AC_DEFINE(FEATURE_CPUMEMHISTORY))`
(`vice/configure.ac:120,521`). Debian/Ubuntu `debian/rules`, the Homebrew formula, and
official CI (`.github/workflows/make-release.yml:440`,
`build-main-on-push.yml:482,585`) all pass `--enable-cpuhistory` explicitly. The
compile flag is a non-issue.

**Correction, part B — the actual blocker is the VICE version, and it is worse.**
`e_MON_CMD_CPUHISTORY_GET = 0x86` exists only in **VICE ≥ 3.10** (manual §13:
"Minimum VICE version: 3.10"). Debian trixie/forky/sid and every current Ubuntu ship
**3.9**, whose `src/monitor/monitor_binary.c` contains no `0x86` at all.

So the capability the parity doc calls "the standout new capability" is **unavailable
on the most common Linux install path** — the same `apt install vice` that motivates
the migration. Homebrew ships 3.10 (fine); official VICE binary releases are fine.

When the opcode is absent but the build is ≥3.10, the stub returns
`e_MON_ERR_CMD_FAILURE` (0x8f). Detect capability with `VICE_INFO` (0x85) plus a
trial `0x86`.

## Also worth recording while editing

Stock VICE's **text** monitor has a true `stopwatch`/`sw` command
(`vice/src/monitor/monitor.c:1421-1435`) — a raw `clk` delta with no compile-time
flag and no 3.10 requirement. And `-binarymonitor` and `-remotemonitor` **can run
concurrently** on one instance: separate `BinaryMonitorServer`
(`monitor_binary.c:2068`) and `MonitorServer` (`monitor_network.c:334`) resources,
both polled unconditionally in `monitor_vsync_hook` (`monitor.c:406-407`).

That combination gives a cycle stopwatch on any stock VICE version, which matters for
`vice-wedge-triage`.

## Acceptance

- [ ] `docs/phase0-binmon-findings.md` §1 and §4 corrected, with source citations
- [ ] `docs/stock-vice-parity.md` §A losses #3 and #5 downgraded/removed accordingly
- [ ] `.planning/intel/constraints.md`: `CON-stopwatch-via-cpuhistory` (currently
      PROVISIONAL) rewritten — no longer CPU-history-dependent; `no-pause-now` and
      `no-monotonic-cycle-register` constraints revised
- [ ] New constraint recorded: **VICE ≥ 3.10 required for `CPUHISTORY_GET`**, with
      graceful degradation on 3.9
- [ ] `.planning/intel/SYNTHESIS.md` W2 note updated to reflect the corrected normative text

See also: `.planning/notes/stock-vice-migration-revised-loss-ledger.md`
