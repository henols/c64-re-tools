# Phase 1: Corrected Ground Truth - Research

**Researched:** 2026-08-12
**Domain:** Documentation correctness for a VICE binary-monitor protocol spec, plus an empirical protocol probe run against real `x64sc` builds
**Confidence:** HIGH (all four errors and their corrections are already source-cited in-repo; the open items are execution mechanics, not unknowns)

## Summary

Phase 1 has two independent halves. The first is textual: `docs/phase0-binmon-findings.md`
(normative by ingest resolution W2) and `docs/stock-vice-parity.md` contain four verified
factual errors about the VICE binary-monitor protocol, and `.planning/intel/constraints.md`
inherited three of them. All four corrections already exist, fully source-cited against
`VICE-Team/svn-mirror @ e50d42c`, in
`.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`
(errors 1–3) and `.planning/research/GAINS-PROTOCOL.md` §B.6 / "Cross-group corrections"
(error 4, the `RL`/`CY` vs `LIN`/`CYC` mixup). This phase does not need new investigation to
know *what* to write — it needs a plan that applies these already-drafted corrections to the
right files, in the right sections, without missing a repetition.

The second half is empirical: `.claude/mcp/vice/probe-binmon.mjs` exists (10,279 bytes, six
checks: PING, VICE_INFO, REGISTERS_AVAILABLE, CPUHISTORY_GET, DISPLAY_GET, async-event demux
via `ADVANCE_INSTRUCTIONS`) but has never been run against a real emulator. The environment
this research ran in has **both** a stock VICE 3.9 build (`/usr/bin/x64sc`) and the fork's
VICE 3.10 build (`/usr/local/bin/x64sc`) installed on the host, with `DISPLAY=:0` and Wayland
available — the roadmap's "external prerequisite" blocker is resolved for this environment.
Both binaries support `-binarymonitor`/`-binarymonitoraddress`. This gives a real
CPUHISTORY_GET differential (expect failure on 3.9, success on 3.10) but **not** a true
stock-3.10 data point — the only 3.10 available is the fork build, which is a risk the
planner must record, not paper over (see "Fork-as-3.10 caveat" below).

The current probe script covers success criterion 3's api-version/VICE-version/CPUHISTORY_GET
checks adequately but has **zero coverage** of `PALETTE_GET`, `CONDITION_SET`/`RL`/`CY`,
`CHECKPOINT_SET` with a memspace byte, `Drive8TrueEmulation`, or `MEM_SET` into drive ROM —
i.e. it currently answers 0 of the 5 items research flagged UNVERIFIED. All 5 need new probe
code, not just an execution run.

**Primary recommendation:** Two independent plans (doc-correction and probe-execution+recording),
each self-contained, no ordering dependency, matching the roadmap's own "Parallel" note.

## Architectural Responsibility Map

This phase touches no runtime code, so tiers in the usual sense (browser/API/DB) don't apply.
Mapped instead onto this project's own layers:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Correcting protocol facts in normative docs | Documentation (`docs/`) | Planning intel (`.planning/intel/constraints.md`) | `docs/phase0-binmon-findings.md` is normative per W2; constraints.md is a derived synthesis that must track it |
| Running the empirical probe | Host-side tooling (`.claude/mcp/vice/probe-binmon.mjs`) | — | Script already lives in the correct location; it is a standalone Node script with no server/broker involvement |
| Recording probe results | Documentation (`docs/`) | Planning intel (`.planning/intel/constraints.md` — resolve `CON-probe-outstanding`) | New artifact; no existing convention, see "Where to record probe output" below |
| Resolving the 5 UNVERIFIED items | Host-side tooling (probe additions) + Documentation (accepted-unknowns record) | — | Some are answerable empirically now (real 3.9/3.10 hardware available); others must be recorded as accepted unknowns per criterion 4 |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | `phase0-binmon-findings.md` no longer asserts pause-on-demand needs a checkpoint, that `REGISTERS_GET` can't source a stopwatch, or that CPU history's compile flag is the risk — names VICE ≥ 3.10 as the real gate | Error Inventory items 2, 3, 4 below give exact current text, location, and cited replacement text |
| DOC-02 | Both docs name `RL`/`CY` as the condition-parser pseudo-registers | Error Inventory item 1 below; corrected text and citations already drafted in `.planning/research/GAINS-PROTOCOL.md` §B.6 |
| DOC-03 | `constraints.md` reflects the corrections; `CON-stopwatch-via-cpuhistory` no longer PROVISIONAL | "Constraints.md edit" section below gives the exact current block and the required replacement |
| VERIF-01 | The binary-monitor probe has been run against a real stock VICE build and results recorded | "Probe Execution Plan" section: environment confirmed available, script gap analysis, recommended recording location |
| VERIF-04 | The five UNVERIFIED items are resolved empirically or recorded as accepted unknowns | "The Five UNVERIFIED Items" section: each named, sourced, and assessed for probe-answerability |
</phase_requirements>

## Error Inventory (the four verified errors, located precisely)

All four are already corrected, with VICE-source citations, in
`.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`
(errors 1–3, dated 2026-08-11, verified against `VICE-Team/svn-mirror @ e50d42c`) and
`.planning/research/GAINS-PROTOCOL.md` §B.6 / "Cross-group corrections" (error 4, `e50d42c`,
configure.ac vice_version 3.10.0). Both are `[CITED: internal source-verified research artifacts]`.
The planner should treat these as drafted replacement text, not as an open drafting task.

### Error (a) — `LIN`/`CYC` named instead of `RL`/`CY` as condition pseudo-registers

- **Where it's wrong:** `docs/phase0-binmon-findings.md` §1 does not itself name any
  condition-syntax token — it only says `e_Cycle`/`e_Rasterline` "are not real registers…
  for the conditionals" (lines 11-15). **The error is an omission, not a false statement**:
  the doc never tells the reader that conditions require `RL`/`CY` and that `LIN`/`CYC`
  (the register-list names) are rejected by the condition lexer. A reader who correctly
  learns `LIN`/`CYC` from `REGISTERS_GET` and then tries to *condition* on them gets `0x8f`
  with the parser giving no socket-side diagnostic (`.planning/research/GAINS-PROTOCOL.md`
  §B.6, `mon_lex.l:559-567`).
- **`docs/stock-vice-parity.md` §A.4** ("Extra stock features") says only "conditions can
  reference the raster-line / cycle-in-line pseudo-registers" — no register names given at
  all, same omission.
- **Correction text (drafted, HIGH confidence, source `mon_lex.l:559-560`):**
  > Checkpoint *conditions* use the pseudo-registers `RL` (raster line) and `CY` (cycle
  > within line), **uppercase only** — not the `REGISTERS_GET` names `LIN`/`CYC`, which lex
  > as `BANKNAME` in `COND_MODE` and produce a syntax error (`0x8f`, no diagnostic body).
  > Conditions have no operator precedence (`mon_parse.y:168`): `RL == $64 && CY == $14`
  > parses as `(((RL==$64) && CY) == $14)` and is always false — parenthesise every
  > comparison. Bare integer literals are hex by default (`monitor.c:1597`), so `RL == 100`
  > means line 256, not 100.
- **Action for planner:** add this as new prose in `phase0-binmon-findings.md` §1 (near the
  existing `LIN`/`CYC` register discussion) and in `stock-vice-parity.md` §A.4 (replacing the
  vague "pseudo-registers" mention with the two named tokens). This exact text already
  exists, word-for-word close, in `CLAUDE.md`'s Constraints section and `.planning/PROJECT.md`
  line 125 — those two files can be used as the copy-source since they were already
  user-approved.

### Error (b) — claim that pause-on-demand requires a checkpoint

- **Where it's wrong:** `docs/phase0-binmon-findings.md` §4, lines 49-51 (exact current text):
  > "`EXIT` (0xaa) resumes the emulator. There is **no "pause now" opcode** — to stop a
  > free-running machine on demand, set a temporary checkpoint (or open the monitor). This
  > is the one real ergonomic wrinkle for `vice_execution_pause`."
- **Also repeated in `docs/stock-vice-parity.md` §A.3** (loss #3, lines 33-36): "On-demand
  pause — `vice_execution_pause` → approximate. No 'stop now' opcode. Halting happens only
  on a checkpoint hit (or a JAM). Emulate with a temporary checkpoint on the next
  instruction — works, but isn't a clean 'freeze at this instant.'"
- **Correction (drafted, source `monitor_binary.c:281`, `monitor.c:395`):**
  > `monitor_check_binary()` calls `monitor_startup_trap()` on **any inbound byte**
  > (`monitor_binary.c:281`), invoked every vsync from `monitor_vsync_hook`
  > (`monitor.c:395`). A bare `PING` (0x81) therefore halts the machine within ~1 frame and
  > emits `STOPPED` (0x62) — **no temporary checkpoint is required.** If there is no vsync
  > (host UI paused/hung), the command times out, which is itself a useful
  > `vice-wedge-triage` diagnostic. Parity-doc loss #3 **dissolves** — this is not a
  > degraded tool on stock VICE.
- **Action for planner:** replace both quoted blocks. In `stock-vice-parity.md` §A, this
  moves loss #3 out of the "can't be replicated exactly" list entirely (it is not a loss),
  which likely also requires renumbering losses #4-7 or explicitly noting the list is no
  longer contiguous — flag this as a plan action, not just a text swap.

### Error (c) — claim that `REGISTERS_GET` cannot source a stopwatch

- **Where it's wrong:** `docs/phase0-binmon-findings.md` §1, line 15 (exact current text):
  > "`e_Cycle` is the cycle **within the current raster line**, for checkpoint conditions —
  > not elapsed time. So `REGISTERS_GET` (0x31) cannot be a stopwatch."
- **Correction (drafted, source `mon_register6502.c:57`):**
  > `LIN` and `CYC` **are** present in `mon_reg_list_6510` and `REGISTERS_GET` (0x31)
  > returns them. The underlying point survives — neither is monotonic; `CYC` is
  > cycle-within-raster-line — but "cannot be a stopwatch" is too strong. Absolute cycles
  > **can** be reconstructed without CPU history:
  > `cycles = frames × 19656 (PAL) + Δ(LIN × 63 + CYC)`, with frame count from a
  > **non-stopping** exec checkpoint at `$EA31`, reading `hit_count` from bytes 13-16 of the
  > `CHECKPOINT_GET`/`CHECKPOINT_INFO` (0x11) response. Warning to carry into the corrected
  > text: do **not** place a non-stopping checkpoint over a wide range to do this — every
  > hit fires a synchronous `CHECKPOINT_INFO` event from inside the CPU loop
  > (`mon_breakpoint.c:439-535`); this reconstruction route is revisited and partly
  > rejected on cost grounds in Phase 7 (see `.planning/notes/stock-vice-migration-revised-loss-ledger.md`) —
  > the Phase 1 doc correction should state the fact (`REGISTERS_GET` *can* source cycle
  > data) without re-litigating Phase 7's routing decision.
- **`docs/stock-vice-parity.md` §A.5** (loss #5, "conditional + non-atomic") also needs its
  premise updated: it currently frames the loss as conditional on CPU-history-compiled-in;
  the correction changes the condition to "conditional on VICE ≥ 3.10 for the *CPU-history*
  route," while noting a *second*, always-available route now exists via `LIN`/`CYC` +
  frame-count reconstruction.
- **Action for planner:** correct the false conclusion in §1 without overclaiming that this
  makes the CPU-history stopwatch (Error d) unnecessary — the two are complementary, not a
  replacement for each other. This is subtle text; the planner should have a task-level
  review step, not just a find-replace.

### Error (d) — claim that CPU history's compile flag is the availability risk, not VICE ≥ 3.10

- **Where it's wrong:** `docs/phase0-binmon-findings.md` §1, lines 20-24 (exact current text):
  > "**VERIFY:** CPU history is a *compile-time* feature. If the target `x64sc` wasn't built
  > with it, `CPUHISTORY_GET` returns an error or zero entries and the stopwatch is
  > unavailable. The probe checks this on the real build. Fallbacks if absent: derive cycles
  > by summing per-instruction costs while single-stepping (slow), or fall back to
  > wall-clock timing."
- **Also `docs/stock-vice-parity.md` §B.1** ("CPU instruction-history trace") does not
  mention the version gate at all — presents it as an unconditional new capability. This is
  the same class of error even though it isn't phrased as a "risk" — it's a missing caveat
  that produces the wrong mental model.
- **Correction (drafted, two-part, sources `vice/configure.ac:120,521`, VICE manual §13,
  Debian `debian/rules`, Homebrew formula, `.github/workflows/make-release.yml:440`,
  `build-main-on-push.yml:482,585`):**
  > Part A — the compile flag is a non-issue: `--enable-cpuhistory` is on by default
  > (`configure.ac`), and Debian/Ubuntu, Homebrew, and official CI all build with it
  > explicitly. Part B — the real gate is the VICE **version**: `e_MON_CMD_CPUHISTORY_GET =
  > 0x86` exists only in **VICE ≥ 3.10** (manual §13, "Minimum VICE version: 3.10"). Debian
  > trixie/forky/sid and all current Ubuntu ship **3.9**, whose `monitor_binary.c` has no
  > `0x86` case at all — the standout new capability is unavailable on the most common
  > `apt install vice` path. When the opcode is absent on a build ≥ 3.10 for some other
  > reason, the stub returns `CMD_FAILURE` (0x8f); when the opcode is unrecognised entirely
  > (VICE < 3.10), expect `INVALID_TYPE` (0x83) — these are distinguishable and the probe
  > should record which. Detect capability via `VICE_INFO` (0x85)'s version quad, never the
  > SVN revision field (zero in distro builds).
- **Action for planner:** this is the highest-value correction — it changes the milestone's
  own framing (`.planning/STATE.md` already independently states "Graceful degradation is
  required, not optional" for this reason, so GAIN-01/GAIN-02 in Phase 6 already assume the
  corrected fact — Phase 1 is catching the *documentation* up to a fact the roadmap already
  encodes elsewhere).

## Constraints.md edit (DOC-03, exact)

**Current block** (`.planning/intel/constraints.md` lines 92-105):

```markdown
## CON-stopwatch-via-cpuhistory

- **source:** `docs/phase0-binmon-findings.md` §1
- **type:** protocol
- **status:** PROVISIONAL — depends on build-time feature
- **constraint:** `CPUHISTORY_GET` (`0x86`) is the stopwatch. Each history entry
  ends with a uint64 absolute clock (`write_uint64(current->cycle, …)` in
  `monitor_binary.c`). Read the newest entry's cycle before and after a run; the
  difference is a cycle-accurate elapsed count.
- **VERIFY:** CPU history is a **compile-time** feature. If the target `x64sc`
  wasn't built with it, `CPUHISTORY_GET` returns an error or zero entries and the
  stopwatch is unavailable. Fallbacks: sum per-instruction costs while
  single-stepping (slow), or fall back to wall-clock timing. Detect via
  `VICE_INFO` (`0x85`) / probe.
```

**Required edit:** change `status:` from `PROVISIONAL — depends on build-time feature` to
`SETTLED — depends on VICE version, not build flag`, and replace the `VERIFY:` bullet with the
version-gate fact (Error d correction above). Recommended replacement:

```markdown
## CON-stopwatch-via-cpuhistory

- **source:** `docs/phase0-binmon-findings.md` §1 (corrected 2026-08-12, Phase 1)
- **type:** protocol
- **status:** SETTLED — gated by VICE version, not a build-time compile flag
- **constraint:** `CPUHISTORY_GET` (`0x86`) is the stopwatch. Each history entry
  ends with a uint64 absolute clock (`write_uint64(current->cycle, …)` in
  `monitor_binary.c`). Read the newest entry's cycle before and after a run; the
  difference is a cycle-accurate elapsed count.
- **VERSION GATE:** `e_MON_CMD_CPUHISTORY_GET` (`0x86`) requires **VICE ≥ 3.10**.
  `--enable-cpuhistory` is on by default and universally set in distro/CI builds —
  the compile flag is not the risk. Debian/Ubuntu ship VICE 3.9 and lack the
  opcode entirely (`INVALID_TYPE` `0x83`); on ≥3.10 with the feature genuinely
  disabled, expect `CMD_FAILURE` (`0x8f`). Detect via `VICE_INFO` (`0x85`)'s
  version quad. Fallbacks on 3.9: reconstruct via `LIN`/`CYC` + a non-stopping
  frame-count checkpoint (see `CON-no-monotonic-cycle-register`), or wall-clock.
```

Also touch, in the same file, `CON-no-monotonic-cycle-register` (lines 81-90) and
`CON-no-pause-now-opcode` (lines 137-143) — both currently state the *pre-correction*
facts verbatim (they're direct quotes of the wrong doc text) and DOC-03's own wording
("`.planning/intel/constraints.md` agrees") implies these two must be reconciled too, not
just the one item literally named. `CON-no-pause-now-opcode`'s constraint text is Error (b)
verbatim and must be rewritten or retired; `CON-no-monotonic-cycle-register`'s closing
sentence ("`REGISTERS_GET` therefore cannot serve as a stopwatch") is Error (c) verbatim.

## The Five UNVERIFIED Items (VERIF-04)

Sourced from `.planning/research/GAINS-PROTOCOL.md`, which states up front (line 17): "the
`GAINS-PROTOCOL` probe should confirm the **three highest-risk items** flagged in the
implementation notes" — these three carry an explicit inline `**UNVERIFIED**` tag — plus two
further open "Probe items" call-outs in sections B and C that are equally unresolved but not
inline-tagged. Together these five are what the roadmap's "five items ... route to VERIF-01"
and "five items the research flagged UNVERIFIED" (success criterion 4) refer to.

| # | Item | Source | Probe-answerable? | If left as accepted unknown, what breaks |
|---|------|--------|--------------------|-------------------------------------------|
| 1 | Whether a 9-byte `CHECKPOINT_SET` (with the optional memspace byte, `command->length >= 9`) is accepted rather than rejected on length by a given build | `GAINS-PROTOCOL.md` line 25 (table), confirmed as probe target at line 577-578 | **Yes** — both 3.9 and 3.10 binaries are on this host; send an 8-byte and a 9-byte `CHECKPOINT_SET` to each and compare `errCode` | GAIN-03 (drive checkpoints) would ship an unverified assumption that older VICE ignores byte 8 gracefully instead of rejecting the whole command; if wrong, drive checkpoint creation silently fails on some builds |
| 2 | Whether `Drive8TrueEmulation` exists under that exact per-unit name on VICE 3.9 (vs. only on 3.10+, with `DriveTrueEmulation` as a hypothetical older fallback) | `GAINS-PROTOCOL.md` lines 285-291 (inline `**UNVERIFIED**` at 288) | **Yes** — `RESOURCE_GET Drive8TrueEmulation` against the real 3.9 build on this host | GAIN-04 (TDE precondition reporting) would probe the wrong resource name on 3.9, always getting `OBJECT_MISSING` and reporting "TDE off" even when it's on — a false-negative precondition failure |
| 3 | Whether `MEM_SET` into drive ROM (`$C000-$FFFF`) is a safe no-op or something worse (`NULL` store-function-pointer dereference) | `GAINS-PROTOCOL.md` lines 534-539 (inline `**UNVERIFIED**` at 536) | **Yes, but destructively** — must be tried against a real drive memspace with true drive emulation on; test on 3.9 first (lower blast radius: worst case is a single emulator crash, not data loss, since it's an emulator) | If untested and the store pointer actually is `NULL` (not a no-op stub), a future GAIN-03 client that lets a user write to drive ROM crashes the emulator instance instead of silently no-op'ing — must be verified before Phase 6 ships write access to that memspace, or the tool must refuse writes to that range unconditionally without the probe answer |
| 4 | Whether `(RL == $64) && (CY == $14)`-style parenthesised conditions actually fire as expected on real hardware, and the phase relationship between `RL`/`CY` and the raster position a running program reads at `$D012` | `GAINS-PROTOCOL.md` lines 1027-1028 (§B "Probe items" #10) | **Partially** — firing behavior is directly testable (`CONDITION_SET` + run + observe `CHECKPOINT_INFO`); the `$D012` phase-offset relationship needs a running program with a known raster interrupt to compare against, which is more setup than the other four items | If the phase offset is wrong, GAIN-06 (raster-precise conditions) tools that promise "break at the exact line a program sees at `$D012`" are systematically off by a fixed cycle count — silently wrong demo/raster-effect RE results, not a crash |
| 5 | Whether `PALETTE_GET` returns exactly 16 entries on a real `x64sc`, and whether one `DISPLAY_GET` pixel's palette index matches the known VIC-II colour at that screen position | `GAINS-PROTOCOL.md` lines 1497-1499 (§C "Probe items" #12) | **Yes** — both are direct, single-round-trip checks against either build; the pixel check needs the boot screen's known border/background colour (e.g. VICE default light-blue/blue at $D020/$D021 on cold boot) as the reference | If entry count differs from 16 or index-to-RGB mapping is off-by-one, Phase 5's screenshot PNG encoding silently produces wrong colours — a visually-detectable but not protocol-error-producing bug, expensive to root-cause later |

**Assessment:** all 5 are probe-answerable given the confirmed dual-VICE-version host
environment; item 3 (`MEM_SET` into drive ROM) is the only one carrying real risk to the
probe run itself (possible emulator crash) and should be sequenced last / run against a
disposable instance. None of the 5 currently has *any* code path in `probe-binmon.mjs` — all
require new probe additions, not just an execution run. If the plan chooses not to attempt
item 4's `$D012` phase-offset half (the most setup-heavy), it must be recorded as an accepted
unknown per criterion 4, with the "what breaks" column above copied verbatim into that record.

**Relationship to the ROADMAP's "probe additions" note:** the roadmap's own Notes section
("Probe additions worth folding in") lists: 9-byte `CHECKPOINT_SET` against 3.9 (= item 1
above), `Drive8TrueEmulation` naming on 3.9 (= item 2), `MEM_SET` into drive ROM (= item 3),
whether `ADVANCE_INSTRUCTIONS` emits a `RESUMED`/`STOPPED` pair (**new, not one of the 5
UNVERIFIED items** — it's a criterion-3 "observed unsolicited event sequence" data point),
and one `DISPLAY_GET` pixel check (= item 5's second half). The planner should implement all
of items 1-5 above **plus** the `ADVANCE_INSTRUCTIONS` event-pair check as a sixth, separate
probe addition satisfying criterion 3 rather than criterion 4.

## Probe Execution Plan

### Environment (confirmed available, not hypothetical)

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| Stock VICE (`x64sc`) | VERIF-01 primary target | Yes | 3.9 (`/usr/bin/x64sc`) | Debian-packaged; unmodified; supports `-binarymonitor -binarymonitoraddress` |
| Fork VICE (`x64sc`) | Secondary/differential | Yes | 3.10 (`/usr/local/bin/x64sc`) | barryw fork; also supports `-binarymonitor`; **not stock 3.10**, see caveat below |
| Display | Emulator window (both builds run a real window even with `-binarymonitor`) | Yes | `DISPLAY=:0`, Wayland (`WAYLAND_DISPLAY=wayland-0`) | Not headless; a real window opens |
| Node.js | Runs `probe-binmon.mjs` | Yes | v22.22.0 | Meets project's `>=22.18` floor; no deps needed (probe uses only `node:net`) |
| Container | N/A for this run | N/A — this session is **not** in a container (`/.dockerenv` absent) | — | The roadmap's stated blocker ("this repo's container has no VICE and no display") does not apply here |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — both required builds are present.

### Fork-as-3.10 caveat (planner must record this explicitly)

The only VICE ≥ 3.10 available in this environment is the **barryw fork**, not a stock 3.10
build. The fork is ~17k lines of C patched into upstream VICE specifically to add
`-mcpserver`/HTTP; it also happens to be built from a 3.10-era upstream tree and exposes
`-binarymonitor` unmodified (confirmed: `--help` lists `-binarymonitor`/`-binarymonitoraddress`
identically on both binaries). There is no source-level reason to expect the fork's patches
touch `monitor_binary.c`'s `CPUHISTORY_GET` handling — the fork's own purpose (per
`./CLAUDE.md` and `PROJECT.md`) is adding the HTTP `/mcp` surface, not modifying the binary
monitor. But this is an **inference, not a verified fact**, and the phase's own goal is "facts
that match what the emulator actually does" — using unverified inference to validate the
≥3.10 gate would be circular.

**Recommendation:** probing the fork's binary monitor for `CPUHISTORY_GET` success is
**acceptable corroborating evidence** (it demonstrates the opcode exists and returns sane
data on a 3.10-vintage tree) but **must be recorded as an accepted unknown, not upgraded to
VERIFIED, for the specific claim "stock VICE 3.10 behaves identically."** The probe results
doc should carry both results side by side with an explicit caveat line, e.g.: "3.10 result
obtained from the barryw fork build, not a stock 3.10 binary; the fork's own patch set is not
known to touch `monitor_binary.c`'s CPUHISTORY_GET path, but this has not been diffed against
upstream to confirm." This satisfies VERIF-04's "recorded as an accepted unknown that states
what breaks if the assumption is wrong": if the fork *did* patch this path, downstream code
gated on "≥3.10 works" would be validated against fork-only behavior and could fail against a
genuine stock 3.10 (e.g. Homebrew or official release binary).

### `probe-binmon.mjs` — what it does today vs. what's needed

Current script (`.claude/mcp/vice/probe-binmon.mjs`, read in full):

| # | Check | Present today | Meets criterion 3/4? |
|---|-------|----------------|------------------------|
| 1 | `PING` connectivity | Yes | — |
| 2 | `VICE_INFO` → version string | Yes, parses `[len][major,minor,build,revision]` as dot-joined string | Partially — criterion 3 wants "the VICE version quad" explicitly; current output is a joined string, which is the quad, but doesn't also report the API-version byte from the response header itself (only ever assumes `API=0x02` on send) |
| 3 | `REGISTERS_AVAILABLE` | Yes (main memspace only) | Not required by criterion 3, informational |
| 4 | `CPUHISTORY_GET` success/fail | Yes, prints `ERR_NAME` (would print `INVALID_TYPE` or `CMD_FAILURE` if present in the map — both already in `ERR_NAME`) | **Yes, meets "0x83 vs 0x8f" ask** — the error-name table already has both, just needs the run |
| 5 | `DISPLAY_GET` geometry | Yes — debug w/h, inner w/h, bpp | Partially — doesn't print inner x/y offset (`xo`/`yo`), only inner w/h; criterion 3 says "geometry" which this covers adequately |
| 6 | Async event demux via one `ADVANCE_INSTRUCTIONS` | Yes, logs event names as they arrive | Partially — only captures events during a 150ms window around one step; doesn't capture the initial connection's implicit event (if any) or the final `EXIT`'s `RESUMED` (sent after the summary is printed, socket closes immediately after) |
| — | `PALETTE_GET` entry count | **Absent** | **Gap — required by criterion 3, must be added** |
| — | `CONDITION_SET` / `RL`/`CY` firing | **Absent** | Gap — required for UNVERIFIED item 4 |
| — | `CHECKPOINT_SET` (8 vs 9 byte) | **Absent** | Gap — required for UNVERIFIED item 1 |
| — | `Drive8TrueEmulation` resource probe | **Absent** | Gap — required for UNVERIFIED item 2 |
| — | `MEM_SET` into drive ROM | **Absent** | Gap — required for UNVERIFIED item 3 |
| — | `DISPLAY_GET` pixel-vs-known-colour check | **Absent** | Gap — required for UNVERIFIED item 5 (second half) |

**Conclusion:** criterion 3 is roughly 70% covered by the existing script (connectivity,
version, CPU-history success/fail-code, display geometry, event demux are all present in some
form) but `PALETTE_GET` entry count is a hard gap that must be added before any run counts as
satisfying the criterion. Criterion 4 (the five UNVERIFIED items) is **0% covered** — every
one of the five needs new probe code. The planner should treat "extend probe-binmon.mjs" and
"run probe-binmon.mjs" as two ordered tasks within one plan, not "run the existing script"
as a single task.

**Practical sequencing note for the plan:** run the extended probe against 3.9 first (lower
risk — no fork-specific behavior to worry about, and it's the version distro users will
actually have), then against the fork's 3.10 for the CPUHISTORY_GET differential and the
explicit caveat above. The `MEM_SET`-into-drive-ROM check (UNVERIFIED item 3) should run last
against each build, since a crash ends that build's probe session.

### Where to record probe output

No existing convention in this repo for recording an empirical hardware/emulator verification
run. Checked: `.planning/intel/` (constraints/decisions/context/requirements — all synthesis,
not raw run output), `docs/` (three protocol docs, no results file), `.planning/notes/`
(analysis notes, not run logs), GSD's own artifact taxonomy (`artifact-types.md` — no "probe
result" or "verification run" artifact type defined; the closest is `SPIKE.md`, which is a
different lifecycle — pre-planning investigation, not post-planning empirical confirmation of
an already-normative spec).

**Recommendation:** create `docs/phase1-probe-results.md`, sitting alongside
`phase0-binmon-findings.md` and `stock-vice-parity.md` since it directly confirms/refutes
claims in both. Recommended shape:

```markdown
# Phase 1 — binary-monitor probe results

**Run date:** <date>
**Host:** <uname -a summary>
**Builds tested:** stock VICE 3.9 (`/usr/bin/x64sc`), fork VICE 3.10 (`/usr/local/bin/x64sc`, see caveat)

## Summary table (success criterion 3)
| Item | Stock 3.9 | Fork 3.10 (caveat: not stock) |
|---|---|---|
| api_version (response header) | | |
| VICE version quad | | |
| CPUHISTORY_GET | 0x83 expected | success expected |
| DISPLAY_GET geometry | | |
| PALETTE_GET entry count | | |
| Observed unsolicited event sequence | | |

## The five UNVERIFIED items (success criterion 4)
<one subsection per item, each stating: probed / accepted-unknown, result, and — if
accepted-unknown — the "what breaks if wrong" text from this research's table>

## Raw probe output
<pasted console output, both runs, for auditability>
```

Then: (1) update `docs/phase0-binmon-findings.md`'s "The one empirical step left" section to
say the probe has run and link to this file, replacing its outstanding-question framing; (2)
resolve `.planning/intel/constraints.md`'s `CON-probe-outstanding` from `status: OUTSTANDING`
to `status: RESOLVED — see docs/phase1-probe-results.md`.

## Other Repetitions of the Errors Found in the Repo (beyond the two named docs)

Grep swept the whole repo (excluding `node_modules`) for the four errors' characteristic
phrases. Findings beyond `phase0-binmon-findings.md` and `stock-vice-parity.md`:

1. **`docs/roadmap-stock-vice.md` repeats Error (b)** (pause-on-demand needing a checkpoint)
   at three locations: line 61-62 ("Explicit pause-now: binary monitor stop/continue is
   monitor-entry/checkpoint driven; 'pause on demand' needs a workaround"), line 86 (Phase-0
   probe scope: "(b) the pause/continue model"), and line 111 ("Phase-0 probe result (cycle
   count + pause model) recorded before further work"). This file is an ADR marked `Status:
   proposed`, and per `.planning/intel/constraints.md`'s header, "the ADR's looser paraphrase
   is superseded" by the SPEC — so it is not literally in scope for DOC-01/02/03 (which name
   only `phase0-binmon-findings.md`, `stock-vice-parity.md`, and `constraints.md`). **However**
   it is a fourth file a future reader could consult and be misled by, and the phase's stated
   goal ("every downstream plan reads protocol facts that match what the emulator actually
   does") is broader than the literal criteria text. Recommend the planner add a low-cost
   task: either a one-line "superseded, see phase0-binmon-findings.md §4" erratum note at the
   top of `docs/roadmap-stock-vice.md`, or an explicit decision to leave it as historical/ADR
   record and rely on its already-documented supersession status. Do not silently skip this —
   record the choice.
2. **`.planning/intel/decisions.md` line 66** lists "explicit pause-now" among capability
   losses in a decision record — same status as the ADR: historical record of a
   since-corrected understanding, not itself normative. Lower priority than
   `roadmap-stock-vice.md` since `decisions.md` is explicitly a synthesis artifact, not a
   document engineers read for protocol facts.
3. **No other file repeats Errors (a), (c), or (d).** `CLAUDE.md` and `.planning/PROJECT.md`
   already assert the *corrected* facts for Error (a) (RL/CY) and Error (d) (VICE ≥ 3.10) —
   these two files are not part of the problem, they are available copy-sources for the fix
   (see Error (a) and Error (d) sections above).
4. **A related, non-enumerated gap in the same section as Error (b):** `docs/phase0-binmon-findings.md`
   §4 names only **three** unsolicited event types (`STOPPED`, `RESUMED`, `JAM`). `CLAUDE.md`'s
   Constraints section and `.planning/PROJECT.md` both state there are **five**
   (`CHECKPOINT_INFO` 0x11 and `REGISTER_INFO` 0x31 are the other two, and critically they
   *share a response type with a legitimate command reply* — the exact hazard Phase 2's
   PROTO-03 is built to handle). This is not one of the four named errors and is not required
   by DOC-01/02, but leaving it uncorrected means Phase 2's plan would derive its event-demux
   design from a doc that still undercounts event types by 40%. **Recommend folding this into
   the same doc-correction plan as a fifth, bonus correction** — it is directly adjacent to
   Error (b)'s section and the corrected text is already fully drafted in `CLAUDE.md`/`PROJECT.md`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Determining what the corrected doc text should say | A fresh source-code re-read of VICE's monitor code | The already-cited corrections in `.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md` and `.planning/research/GAINS-PROTOCOL.md` | Both are already source-line-cited against the same VICE commit (`e50d42c`); re-deriving from scratch risks introducing a fifth error or losing a citation |
| A binary-monitor client for the probe | A new framing/reassembly implementation | The existing `probe-binmon.mjs`'s `BinMon` class (11/12-byte header framing, request-id correlation, event demux already implemented correctly for STOPPED/RESUMED/JAM) | It already handles the exact wire format this phase is trying to verify; extending it is strictly less risky than writing new socket code for a one-off probe |

## Common Pitfalls

### Pitfall 1: Treating "correct the docs" as a single find-and-replace task
**What goes wrong:** Errors (b) and (c) both require rewriting a *conclusion*, not just a
fact — e.g. Error (c)'s fix must add the `LIN`/`CYC`+frame-count reconstruction formula while
*not* implying it replaces the CPU-history stopwatch (the two routes coexist and are chosen
between in Phase 7).
**Why it happens:** The corrections read like isolated facts in the todo/research files but
are actually load-bearing for later phases' framing (Phase 7 explicitly revisits both
stopwatch routes with cost data).
**How to avoid:** Task-level review comparing corrected text against Phase 7's routing
decision text in `ROADMAP.md`, not just against the source citation.
**Warning signs:** Corrected doc text that reads as "CPU history is unnecessary now" — this
would be a fifth error introduced by an overcorrection.

### Pitfall 2: Running the probe against only one VICE version
**What goes wrong:** A single-build run cannot produce the `0x83`-vs-`0x8f` differential
criterion 3 explicitly asks for — that differential only exists *because* two version tiers
(< 3.10 and ≥ 3.10) are being compared.
**Why it happens:** The roadmap's own notes were written assuming only the container
(neither build available) or a single external machine; this environment's dual-build
availability is new information this research surfaced.
**How to avoid:** The plan must explicitly run the probe against both `/usr/bin/x64sc` and
`/usr/local/bin/x64sc`, on different ports, and record both.
**Warning signs:** A probe-results doc with only one "builds tested" row.

### Pitfall 3: Presenting the fork's 3.10 result as stock-3.10-equivalent
**What goes wrong:** Silently treats fork-3.10 evidence as if it were upstream-3.10 evidence,
producing an overclaimed VERIFIED tag on a claim about stock VICE.
**Why it happens:** It's the only ≥3.10 binary on hand, and it's tempting to skip the caveat
under time pressure.
**How to avoid:** Explicit "accepted unknown" framing per the Fork-as-3.10 caveat section
above, in the probe-results doc itself, not just in this research file.
**Warning signs:** Probe-results doc says "confirmed on VICE 3.10" without naming which build.

## Code Examples

### Existing wire-framing code to extend (from `probe-binmon.mjs`, already correct)
```javascript
// Source: .claude/mcp/vice/probe-binmon.mjs (this repo, read in full during research)
function encode(requestId, commandType, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(11);
  header[0] = STX;
  header[1] = API;
  header.writeUInt32LE(body.length >>> 0, 2);
  header.writeUInt32LE(requestId >>> 0, 6);
  header[10] = commandType;
  return Buffer.concat([header, body]);
}
```
This matches `CON-wire-request-header` in `constraints.md` exactly (11-byte header, LE
fields, same offsets) — safe to build new probe commands (`CONDITION_SET` 0x22,
`CHECKPOINT_SET` 0x12, `RESOURCE_GET` 0x51, `MEM_SET` 0x02, `PALETTE_GET` 0x91) on top of this
helper without re-deriving the framing.

### `CHECKPOINT_SET` body to add for UNVERIFIED item 1 (8-byte vs 9-byte)
```javascript
// Source: derived from .planning/research/GAINS-PROTOCOL.md §"CHECKPOINT_SET (0x12) request
// body — monitor_binary.c:561-598" (this research), cross-checked against constraints.md
// CON-command-opcode-set (0x12 confirmed).
function checkpointSetBody({ start, end, stop = 1, enabled = 1, ops = 0x04, temporary = 1, memspace }) {
  const withMemspace = memspace !== undefined;
  const body = Buffer.alloc(withMemspace ? 9 : 8);
  body.writeUInt16LE(start, 0);
  body.writeUInt16LE(end, 2);
  body[4] = stop;
  body[5] = enabled;
  body[6] = ops; // e_exec = 0x04
  body[7] = temporary;
  if (withMemspace) body[8] = memspace; // 0x00 main, 0x01-0x04 units 8-11
  return body;
}
```

### `CONDITION_SET` body to add for UNVERIFIED item 4
```javascript
// Source: .planning/research/GAINS-PROTOCOL.md §B.1 "CONDITION_SET (0x22) body layout —
// monitor_binary.c:665-708".
function conditionSetBody(checkpointNum, expr) {
  const exprBuf = Buffer.from(expr, "ascii"); // NOT NUL-terminated, max 255 bytes
  const body = Buffer.alloc(5 + exprBuf.length);
  body.writeUInt32LE(checkpointNum, 0);
  body[4] = exprBuf.length;
  exprBuf.copy(body, 5);
  return body;
}
// Example condition, correctly parenthesised and hex-literal, per CLAUDE.md's constraint:
// conditionSetBody(cpNum, "(RL == $64) && (CY == $14)")
```

## State of the Art

| Old Approach (doc's current text) | Current Approach (corrected) | When Changed | Impact |
|---|---|---|---|
| "No pause-now opcode; use a temporary checkpoint" | Bare `PING` triggers `monitor_startup_trap()` on any inbound byte, halting within ~1 frame | Correction drafted 2026-08-11 in the pending todo, not yet applied to docs | `vice_execution_pause` is not a degraded/approximate tool on stock — removes a whole "loss" row from `stock-vice-parity.md` |
| "CPU history availability risk = compile flag" | Availability risk = VICE version (≥3.10); compile flag is on by default everywhere | Same | Changes Phase 6's GAIN-01/02 framing from "detect a build flag" to "detect a version," which the roadmap already independently assumes (`STATE.md`: "Debian and all current Ubuntu ship 3.9... Graceful degradation is required") |
| "`REGISTERS_GET` cannot be a stopwatch" | `LIN`/`CYC` + frame-count reconstruction is a second, always-available stopwatch route (with real synchronous-event-traffic costs, weighed against CPU-history in Phase 7) | Same | Broadens Phase 7's design space; must not be conflated with removing the CPU-history route |
| Condition pseudo-registers left unnamed / implied same as register-list names | `RL`/`CY`, uppercase, distinct token set from `LIN`/`CYC` | Already correctly stated in `CLAUDE.md`/`PROJECT.md`, not yet in the two protocol docs | Directly prevents the `0x8f`-with-no-diagnostic failure mode the whole phase exists to close |

**Deprecated/outdated:** `docs/roadmap-stock-vice.md`'s pause-model framing (§"What changes") is
superseded per W2 resolution but not yet marked as such in the file itself — see "Other
Repetitions" item 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The fork's 3.10 binary's binary-monitor implementation is unmodified from stock upstream 3.10 (no source diff performed in this research session) | Fork-as-3.10 caveat | If the fork patches `monitor_binary.c`, probe results attributed to "3.10 generally" could be fork-specific; mitigated by recording as accepted unknown, not by treating as false |
| A2 | VICE's cold-boot border/background colour at $D020/$D021 is a stable, known reference value suitable for the `DISPLAY_GET` pixel-vs-known-colour check (UNVERIFIED item 5) | Probe Execution Plan, item 5 in "Five UNVERIFIED Items" table | If the default colour differs by model/PAL-NTSC/skin, the pixel check could produce a false failure; the executing plan should read the actual default from a fresh `x64sc` launch rather than hardcoding a value from training knowledge |
| A3 | Sending a malformed 9th byte to `CHECKPOINT_SET` on VICE 3.9 (which per source only reads bytes 0-7 when `length < 9`) is safe and will not desync the stream | "The Five UNVERIFIED Items" #1 | If 3.9's length check behaves differently than the cited `command->length >= 9` guard implies (e.g. an off-by-one), a 9-byte send could produce an unexpected error code rather than a clean "ignored" — low risk since it's a read-length gate, not a write-past-buffer risk, but not independently confirmed in this session |

**If this table were empty:** it is not — three items above need the probe run itself to
resolve; none of them undermine the Error Inventory (a)-(d), which are all confirmed by direct
citation to VICE source line numbers already present in this repo.

## Open Questions

1. **Should `docs/roadmap-stock-vice.md` be corrected too, even though DOC-01/02/03 don't name it?**
   - What we know: it repeats Error (b) in three places; it's marked `Status: proposed` and
     already noted as superseded by W2 resolution at the constraints-synthesis level.
   - What's unclear: whether "every downstream plan reads protocol facts that match what the
     emulator actually does" (the phase goal) implies fixing every file, or whether the ADR's
     already-documented supersession status is sufficient.
   - Recommendation: add a one-line erratum/pointer at the top of the ADR rather than a full
     rewrite — cheap, closes the goal-vs-criteria gap, and preserves the ADR as a historical
     record (which several `.planning/intel/*.md` files already treat it as).

2. **Should the corrected §4 also fix the 3-vs-5 unsolicited-event-types undercount?**
   - What we know: `CLAUDE.md`/`PROJECT.md` already state 5 types correctly; the doc states 3.
   - What's unclear: whether this belongs to DOC-01 (implicitly, since it's in the same
     section as Error (b)) or is out of this phase's literal scope.
   - Recommendation: fold it in as a fifth, low-cost correction in the same task — Phase 2
     directly depends on the corrected event count (PROTO-03) and there's no reason to leave
     the doc that generated Phase 2's requirements internally inconsistent with those
     requirements.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stock `x64sc` | VERIF-01 | ✓ | 3.9 | — |
| Fork `x64sc` | VERIF-01 differential + Fork-as-3.10 caveat | ✓ | 3.10 | — (not a stock-3.10 substitute; see caveat) |
| Display (X11/Wayland) | Both emulator builds open a window even under `-binarymonitor` | ✓ | Wayland via `WAYLAND_DISPLAY=wayland-0`, `DISPLAY=:0` | — |
| Node.js | Runs `probe-binmon.mjs` | ✓ | v22.22.0 | — |
| Real stock VICE ≥ 3.10 (non-fork) | Full confidence on the ≥3.10 gate | ✗ | — | Accepted unknown per Fork-as-3.10 caveat; Homebrew/official-release builds would resolve this in a future session if ever needed |

**Missing dependencies with no fallback:** none block this phase from proceeding.
**Missing dependencies with fallback:** a genuine stock 3.10 build is missing; fallback is the
documented accepted-unknown treatment of the fork's 3.10 result.

## Validation Architecture

This phase produces no application code; its "tests" are (a) content assertions against
corrected markdown files and (b) a one-time empirical probe run whose output is recorded, not
re-run automatically. `workflow.nyquist_validation` is enabled in `.planning/config.json`, so
this section is included per the template, adapted to a docs+probe phase.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (project-wide, `.claude/mcp/vice/package.json`); **not directly applicable to this phase's own deliverables**, which are markdown files and a manual probe run |
| Config file | none — this phase adds no `*.test.*` files |
| Quick run command | `grep`-based content assertions (see Req Map below); no automated test file needed |
| Full suite command | `cd .claude/mcp/vice && npm test` — run as a **regression** check only, to confirm this phase's doc-only changes did not accidentally touch any `.ts`/`.mts` file |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| DOC-01 | `phase0-binmon-findings.md` no longer contains the pause-checkpoint claim, the "cannot be a stopwatch" claim, or the compile-flag framing | content-assertion | `grep -c "no real ergonomic wrinkle\|cannot be a stopwatch\|compile-time \*feature\*" docs/phase0-binmon-findings.md` (expect `0`) | ❌ Wave 0 — write as a plan verification step, not a persisted test file |
| DOC-01 | `constraints.md` names VICE ≥ 3.10 as the CPUHISTORY_GET gate | content-assertion | `grep -c "VICE ≥ 3.10\|VICE >= 3.10" .planning/intel/constraints.md` (expect `>=1`) | ❌ Wave 0 |
| DOC-02 | Both docs name `RL`/`CY` as condition tokens | content-assertion | `grep -l "RL.*CY\|pseudo-registers \`RL\`" docs/phase0-binmon-findings.md docs/stock-vice-parity.md` (expect both files listed) | ❌ Wave 0 |
| DOC-03 | `CON-stopwatch-via-cpuhistory` status is not `PROVISIONAL` | content-assertion | `grep -A2 "CON-stopwatch-via-cpuhistory" .planning/intel/constraints.md \| grep -c PROVISIONAL` (expect `0`) | ❌ Wave 0 |
| VERIF-01 | Probe has been run and recorded | artifact-existence | `test -f docs/phase1-probe-results.md && grep -c "PALETTE_GET" docs/phase1-probe-results.md` (expect file exists, `>=1`) | ❌ Wave 0 — new file |
| VERIF-04 | Each of the 5 UNVERIFIED items appears in the probe-results doc, resolved or as an accepted unknown | content-assertion | `grep -c "^## " docs/phase1-probe-results.md` under the "five UNVERIFIED items" heading (manual count = 5) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** run the relevant `grep` assertion(s) above for the file(s) just edited.
- **Per wave merge:** run all six assertions together, plus `cd .claude/mcp/vice && npm test` as a non-regression check (this phase should not touch any `.ts`/`.mts` file, so the existing suite should be unaffected — a failure here would indicate scope creep).
- **Phase gate:** all six assertions pass, `npm test` is green (as a no-op confirmation), before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] No `tests/` fixtures needed — this phase's verification is grep-based content assertion, not unit tests. Recommend the plan embed the six `grep` commands above directly as verification steps on the relevant tasks, rather than writing a throwaway shell script.
- [ ] `docs/phase1-probe-results.md` does not exist yet — the probe-execution plan must create it (see "Where to record probe output").

*(No gaps beyond the above — existing `node --test` infrastructure is used only as a
regression backstop, not as this phase's primary verification mechanism.)*

## Security Domain

`security_enforcement` is enabled (`security_asvs_level: 1`) in `.planning/config.json`.
This phase is documentation-editing plus a local TCP probe script talking to a
locally-launched emulator process — it introduces no new network-facing surface, no new
user input handling, and no new dependency.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Marginal | `probe-binmon.mjs`'s new commands (`CONDITION_SET`, `CHECKPOINT_SET`, `MEM_SET`) construct wire bodies from probe-author-supplied constants, not external/untrusted input — standard bounds-checking (e.g. `expr.length <= 255` for `CONDITION_SET`) should still be asserted defensively, matching the existing style of hardcoded, reviewed buffers in the script |
| V6 Cryptography | No | The binary-monitor TCP connection is unauthenticated and unencrypted by VICE's own design (documented project-wide as an accepted risk — see Deferred Items QUAL-03, "emulator control-plane network exposure," explicitly deferred out of this milestone); this phase does not change that posture, only reads from it |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Malformed/oversized `CONDITION_SET` expression string sent to the probe's own outbound command (self-inflicted, not attacker-controlled) | N/A (probe is a manual dev tool, not a network service) | Assert `expr.length <= 255` before encoding, per the wire format's uint8 length field, to fail fast locally rather than send a truncated/misencoded frame |
| Emulator crash from `MEM_SET` into drive ROM (UNVERIFIED item 3) | Denial of Service (self-inflicted, local process only) | Run against a disposable, non-broker-managed emulator instance; this is a probe run, not production code, so a crash has no blast radius beyond restarting the test binary |

This is a low-risk phase from a security-review standpoint; the one item worth explicit note
for future phases is that QUAL-03 (network exposure of the control plane) remains deferred —
Phase 1's probe work does not change that posture and should not be read as addressing it.

## Sources

### Primary (HIGH confidence — direct file reads, this repo, this session)
- `.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md` — full text, errors 1-3 with VICE source citations
- `.planning/research/GAINS-PROTOCOL.md` — full sections read: header/scope, §A.3/A.9 (drive), §B.1/B.6 (conditions, `RL`/`CY`), §C (resources/palette), "Cross-group corrections," all "Probe items" call-outs
- `docs/phase0-binmon-findings.md` — full text
- `docs/stock-vice-parity.md` — full text
- `docs/roadmap-stock-vice.md` — targeted read (pause/stopwatch sections)
- `.planning/intel/constraints.md` — full text
- `.planning/intel/SYNTHESIS.md` — targeted read (precedence, W1/W2 resolutions)
- `.planning/INGEST-CONFLICTS.md` — targeted read (I4 note on pause-model consistency)
- `.claude/mcp/vice/probe-binmon.mjs` — full text
- `CLAUDE.md` (project instructions) — Constraints section, cross-checked verbatim against `.planning/PROJECT.md`
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — full/targeted reads for phase scope and requirement text
- `.claude/skills/vice-wedge-triage/SKILL.md` — grepped for protocol-fact repetition (none found)
- Live environment probes this session: `/usr/bin/x64sc --version`, `/usr/local/bin/x64sc --version`, `--help` output for both, `node --version`, `$DISPLAY`/`$WAYLAND_DISPLAY`, absence of `/.dockerenv`

### Secondary (MEDIUM confidence)
- None used — all claims in this research trace to a primary source read in this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Error inventory (a)-(d) and their corrections: HIGH — all four are pre-existing, source-cited
  research artifacts in this repo, cross-verified across two independent documents
  (`todos/pending/...` and `GAINS-PROTOCOL.md`) that agree on the underlying VICE source lines.
- Five UNVERIFIED items and their sourcing: HIGH — directly enumerated and located in
  `GAINS-PROTOCOL.md` with line numbers.
- Probe-answerability assessment: MEDIUM — reasoned from source citations and confirmed binary
  availability, but not yet executed; actual results could surface a sixth issue.
- Fork-as-3.10 equivalence: LOW, explicitly flagged as an accepted unknown (A1) — this is the
  one claim in this research that should not be treated as settled.
- Recording-location recommendation: MEDIUM — no existing repo convention found, so this is a
  reasoned proposal, not a discovered pattern.

**Research date:** 2026-08-12
**Valid until:** Until the probe is actually run (the empirical half of this research is a
plan, not a result) — recommend treating this research as valid through Phase 1's completion,
not beyond, since Phase 1's own output (the probe-results doc) supersedes parts of it.
