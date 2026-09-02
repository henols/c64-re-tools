# Pitfalls Research

**Domain:** Frame-exact emulator capture + a vendored-dxa / Ghidra-headless 6502 analysis pipeline, added to a mature Claude Code plugin that already owns a VICE MCP surface, a host broker pool, and a `node:sqlite` annotation store
**Researched:** 2026-09-02
**Confidence:** HIGH for everything labelled MEASURED (live probes on this host, or primary evidence committed in this repo); MEDIUM for READ-IN-SOURCE; LOW for RECALLED

## How to read this document

Every claim carries one of three labels:

- **MEASURED** — observed this session against a real binary on this host, with the command and the output reproducible from `## Sources`; or transcribed from an outcome line in this repo's own committed evidence.
- **READ-IN-SOURCE** — read directly out of this repo's source, or out of Ghidra's / VICE's shipped data files, this session.
- **RECALLED** — general knowledge or inference, not verified this session. Treated as a hypothesis.

**Emulator version probed:** genuine unpatched stock VICE **3.9** at `/usr/bin/x64sc` (`x64sc --version` → `x64sc (VICE 3.9)`). Note `which x64sc` resolves to `/usr/local/bin/x64sc`, the **fork** — every probe below invoked the absolute path `/usr/bin/x64sc` deliberately.
**Ghidra version probed:** `12.1.3 PUBLIC` at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`, JDK 21.0.12.1 — the same install Phase 23 used.

This document **extends** CLAUDE.md's settled constraints and ROADMAP.md's Standing Constraints rather than restating them. Where a pitfall below is a *sharpening* of an existing constraint, it says which one and what is new.

---

## Provenance of the absolute-cycle figure, and the VICE 3.9 equivalence oracle

*Added 2026-09-02, in answer to a coordinator provenance check. Nothing in this
section is a new measurement — it is a correction of attribution plus a
recommendation that follows from it.*

### Where `2076872` came from: the text monitor. Stated plainly.

**The absolute-cycle figures in Pitfalls 3, 4, 5 and 8 (`2,076,872`, `2,224,669`,
`23,999,976`, `17,874,837`, and the rest) are text-monitor readouts.** They are
the `STOPWATCH` column of the text monitor's register dump, obtained by issuing
`r` over the `-remotemonitor` TCP channel and parsing the `.;`-prefixed line:

```
  ADDR A  X  Y  SP 00 01 NV-BDIZC LIN CYC  STOPWATCH
.;fd75 55 00 a7 fd 2f 37 00100101 000 003      39315
```

Verified against the probe sources this session: `det8.mjs:13,18,21`,
`det4.mjs` and `det7.mjs:15` all read the figure from `cmd("r")`. Exactly one
probe script (`det.mjs:62`) ever issued a bare `stopwatch` **command**, and that
call returned empty output and contributed to no reported figure. So the column,
not the command — but both live on the same channel.

**Consequence, not softened: the *evidence* for the cycle-exactness finding used
the route the owner excluded on 2026-09-02.** That is a fact about the
measurement apparatus and it is recorded here rather than left for a reader to
discover.

**What the finding itself does and does not depend on.** The finding is *"a
monitor checkpoint stop is cycle-exact and jitter-immune under a monitor-issued
hard reset."* Of the quantities that establish it, **all but one are
binary-monitor native**, so the finding survives the exclusion:

| quantity | binary-monitor route | on the 3.9 floor |
|---|---|---|
| PC, A, X, Y, SP, `$00`, `$01`, flags | `REGISTERS_GET` (0x31) | yes |
| `LIN`, `CYC` | **`REGISTERS_GET` (0x31)** — READ-IN-SOURCE, `docs/phase0-binmon-findings.md` §1: *"`REGISTERS_GET` (0x31) does return `LIN`/`CYC`. Both are present in [the register list]"* | **yes** |
| hard reset | `RESET` (0xcc) | yes |
| checkpoint set / hit count | `CHECKPOINT_SET` (0x12) / `CHECKPOINT_INFO` (0x11) | yes |
| 64K RAM | `MEMORY_GET` (0x01), or the `.vsf` `C64MEM` slice | yes |
| **absolute cycle count** | **none on 3.9.** `CPUHISTORY_GET` (0x86) carries a per-entry **uint64 absolute clock** (`write_uint64(current->cycle, …)`) but **requires VICE ≥ 3.10** and does not exist on this host's 3.9 | **no** |

So the protocol is fully expressible on the binary monitor; only the
absolute-cycle *column* is not. That matches CLAUDE.md's settled constraint
exactly — *"absolute cycles must be reconstructed or read from the text
monitor's stopwatch"* — and the route I used was the second of those two.

**And the reconstruction route should not be revived.** Phase 0 records Route B
for sub-3.10 hosts as `cycles = frames * 19656 (PAL) + Δ(LIN * 63 + CYC)`, and
records that phase's own decision to **drop** building a frame-counter stopwatch
from it. One incidental measurement this session supports that decision: the
pre-connect drift between two runs came out at **39,314 cycles over two frames =
19,657 per frame**, against phase 0's documented PAL constant of **19,656**. A
one-cycle-per-frame discrepancy is exactly the error a reconstructed absolute
clock accumulates, and it is independent reason not to build one on the 3.9
floor.

### `stopwatch` is OWNER-EXCLUDED (2026-09-02)

The text monitor's `stopwatch` — column or command — is **excluded by owner
decision** and is not available to this milestone as a capability. The
text-monitor client and the runtime-evidence layer were already out of scope;
this makes the readout explicitly excluded too. Every prevention and control in
this document that originally rested on it has been re-pointed below and is
marked **OWNER-EXCLUDED** at the point of use.

One consequence worth naming, because it is a real loss and not a wash: the
`warp on` / `warp off` runtime commands live on the same excluded channel. Warp
therefore reverts to a **launch-time** dimension on stock (`-warp` /
`InitialWarpMode`), which is what CLAUDE.md's settled constraint said before the
2026-08-28 correction. The correction stands as a fact about VICE; it is no
longer a route this milestone may take. Pitfall 8's prevention is re-pointed
accordingly.

### The recommended equivalence oracle on a VICE 3.9 floor

**Confirming and sharpening the coordinator's working assumption.** The
assumption — raster line + raster cycle + the 64K capture comparison, with
absolute cycle demoted to a 3.10-only strengthening — is right in its demotion
and **incomplete in its discriminating power**. Two corrections:

**1. `(LIN, CYC)` alone cannot distinguish two stops in different frames. It is
structurally blind to frame index.** `LIN` is the raster line and `CYC` is the
cycle within that line, so the pair is a position *modulo the frame*. Two stops
exactly one frame apart have **identical** `(LIN, CYC)` and are ~19,656 cycles
apart. That is not a corner case — it is the dominant divergence term this
project already measured: `danish` r1-vs-r2 landed on `hit_count` **1 and 2**
(→ 201 divergences) while `saeger` r1-vs-r2 both landed on `hit_count` 1 (→ 1
divergence). An oracle built on `(LIN, CYC)` and the capture alone would call
the `danish` pair's *stop* identical and then be unable to explain the 201
divergences it reports.

**2. The 64K capture comparison cannot be part of the stop-identity oracle,
because it is the dependent variable.** A diverging capture is the symptom being
explained. Using it to certify the stop is circular; it belongs on the other
side of the equation.

**The frame-index term that replaces absolute cycle is `hit_count`, and it costs
nothing new.** It is binary-monitor native, it is already how this project
detected the `danish` divergence, and CLAUDE.md's *"poll on `hit_count`, never on
paused state"* invariant already makes it load-bearing. So:

> **Recommended 3.9-floor stop-identity oracle — the triple `(PC, hit_count, (LIN, CYC))`, all three from `REGISTERS_GET` (0x31) and `CHECKPOINT_INFO` (0x11).** The 64K capture comparison, under the enumerated transient allow-list, is the *dependent variable* certified by it — never a conjunct of it.

| term | discriminates | granularity | fails to see |
|---|---|---|---|
| `PC` | instruction identity | exact | frame, and intra-frame phase (MEASURED: identical PC across three stops at raster 119 / 110 / 190) |
| `hit_count` | **frame index** | one frame | intra-frame phase; and it is only a frame counter if the checkpoint site is hit once per frame |
| `(LIN, CYC)` | intra-frame phase | one cycle | frame index — see correction 1 |

**One design constraint this imposes, and it is cheap.** `hit_count` is a frame
counter only on a **once-per-frame** checkpoint site. A checkpoint on a game
routine hit a variable number of times per frame gives a hit count that is not a
frame index. So the protocol records **two** checkpoints: a *frame anchor* on a
once-per-frame site (the raster IRQ vector, or a `$D012`-compare site), and the
*target* checkpoint — with both hit counts in the capture record. Without the
anchor, the triple silently degrades to `(PC, (LIN, CYC))`, which is correction 1
all over again.

**Absolute cycle, correctly demoted — and here is precisely what is lost.** Its
unique detection power over the triple is a run that reaches the same
`hit_count` and the same `(LIN, CYC)` having consumed a *different* number of
cycles — a path difference that reconverges to the same phase. Under a
deterministic reset that should not occur, and if it did, the capture comparison
surfaces it. So absolute cycle is **redundant with the triple under the reset
protocol**, which is why demoting it costs little. Record it as an *optional
strengthening on VICE ≥ 3.10 via `CPUHISTORY_GET` (0x86)'s uint64 clock field* —
a named opcode and field, not a vague future — and never as a requirement.

### Does the ~3-address transient allow-list survive the removal?

**Yes, and it is conservative rather than optimistic — for a reason worth
stating.** The list (`$00A2`, `$00CD`, `$01F2`; 3 of 1024) was measured on three
runs that stopped at the same *instruction* but in **different frames** — those
runs did not use the reset protocol, and their `(LIN, CYC)` were 119/036,
110/015 and 190/016. So the list is the divergence set under
**frame-divergent** conditions, i.e. an **upper bound**. Under the reset protocol
(same frame, same cycle) the set should be empty or smaller.

Two further points:

- **The list is a property of the RAM comparison, not of the cycle readout.**
  Removing absolute cycle from the *record* does not change which addresses
  differ. Nothing about the allow-list depended on `STOPWATCH`.
- **`$01F2`'s structural exclusion is 3.9-native.** It is excluded as "above the
  recorded SP", and `SP` comes from `REGISTERS_GET` (0x31). No text channel
  needed.

**The caveat that does bite, restated because it matters more than the numbers.**
Those three runs sat at the KERNAL `READY` prompt, not inside a real release. On
a real release the transient set will be *different* — the program's own frame
counters, RNG state, sprite positions and music-player pointers — and it must be
**re-derived per release under the protocol**. What carries forward is the
**method** (N ≥ 3 runs, take the union of differing addresses, cap the size,
plant a byte outside the list and observe red), not the three addresses. Treating
`$00A2`/`$00CD`/`$01F2` as *the* allow-list for a real release would be the same
category of error as quoting a fixture's data-recovery rate as a release result.

---

## Critical Pitfalls

The ordering is deliberate: silent failures first, and within those, the ones this milestone will hit earliest.

---

### Pitfall 1: Host-clock-seeded RAM initialisation — the false-divergence generator nobody is looking at

**What goes wrong:**
Two runs of the same release, stopped at the same point, produce captures that differ at ~1.6% of never-written addresses. The practitioner attributes it to the stop not being frame-exact, invests the milestone in the stop, and the divergence stays.

**MEASURED.** Stock VICE prints its own seed at startup and it is host-clock-derived:

```
Main: random seed was: 0x6a97f77d      (run 1)
Main: random seed was: 0x6a97f781      (run 2)
Main: random seed was: 0x6a97f785      (run 3)
```

Monotonically increasing across launches seconds apart — i.e. `time()`-derived. Consequence, measured over the untouched RAM window `$C000-$CFEF` (4080 bytes read out through the text monitor), three cold boots:

| launch args | run-to-run differing bytes in `$C000-$CFEF` |
|---|---|
| `-default … -warp` (no seed) | **67 / 4080 (1.6%)** — and a different 67 each pair |
| `-default -seed 4242 … -warp` | **0 / 4080** |
| `-default -raminitrandomchance 0 … -warp` (seed left free) | **0 / 4080** |

Extrapolated across 64K that is on the order of **1,000 addresses of pure false divergence per capture pair**, before the program has executed a single instruction.

**Why it happens:**
`buildViceArgs()` (READ-IN-SOURCE, `src/mcp/vice/broker-launch.mts:153`) emits exactly `["-default", "-drive8type", "1541", "-binarymonitor", "-binarymonitoraddress", …]` for stock and `["-mcpserver", …]` for the fork. **Neither shape carries `-seed` or any `-raminit*` flag.** Nothing in the tree has ever needed reproducible power-on RAM, so nothing pins it. The fork is a patched VICE and inherits the same seeding, so the project's measured 201-divergence `danish` pair was taken under an unpinned seed.

**How to avoid:**
Add a determinism flag block to `buildViceArgs()`, **after** `-default` (see Pitfall 3 for why order still matters). Prefer `-seed <fixed>` over `-raminitrandomchance 0`: the latter removes the randomness by flattening the power-on pattern, which changes what a program that reads uninitialised RAM sees; `-seed` keeps the hardware-realistic pattern and makes it repeatable. Record the seed in the capture record next to `CAPTURE_SHA256`.

**The control that must be observed red:** two cold boots with the seed flag *removed* must produce a non-zero differing-byte count over a never-written window, and the same two boots with it present must produce **exactly zero**. That control is cheap, deterministic and already demonstrated above — there is no excuse for asserting the flag's presence instead.

**Warning signs:**
- A capture-comparison report whose divergence count is a *different number every time you re-run the pair*.
- Divergences clustered in regions the program never writes (`$C000-$CFFF` under a program loaded at `$0801-$9FFF` is the classic).
- The capture record names a stop point but no seed.
- `VICE_ARGS` used as the escape hatch — it is a **full argv override** (READ-IN-SOURCE, `broker-launch.mts:163`) that replaces the monitor flags too, so it cannot be used as an "add two flags" knob.

**Phase to address:**
The frame-exact-stop gate phase (first phase of this milestone, ~33). This must land *before* any frame-exactness measurement, or every number that phase produces is contaminated by it.

---

### Pitfall 2: Pinning the seed but not the argv — reproducibility keyed on the wrong thing

**What goes wrong:**
The seed is pinned, the capture is reproducible, and then someone adds `-warp` or reorders a flag and the RAM image changes. The capture record still says `seed: 4242`, so the record reads as though the two runs were comparable.

**MEASURED.** Same seed, two different flag positions, same 4080-byte window:

| argv | seed printed | differing vs `pre-1.bin` |
|---|---|---|
| `-seed 4242 -default -remotemonitor … -warp` (`pre-1`, `pre-2`) | `0x1092` | `pre-1` vs `pre-2` = **0** |
| `-default -remotemonitor … -warp -seed 4242` (`seeded-1`) | `0x1092` | `pre-1` vs `seeded-1` = **76** |

Both runs report the identical seed `0x1092` and both are internally reproducible, yet the two argv orders yield RAM images differing at 76 bytes. Something between the two flag positions draws from the RNG, so the number of draws consumed before RAM initialisation is argv-order-dependent.

Secondary MEASURED result from the same table: `-seed` placed **before** `-default` still works (`pre-1` vs `pre-2` = 0 differing) — `-default` does not clobber it. That is worth knowing precisely because this project has a recorded scar about `-default` clobbering everything before it (`-drive8type`), and the natural assumption would be that `-seed` needs the same treatment. It does not. Place it after `-default` anyway, for one reason only: consistency with the existing rule, so no reviewer has to re-derive the exception.

**Why it happens:**
"Deterministic" gets recorded as a property of the seed rather than of the (binary, argv, seed) triple. It is the same class of mistake as recording a benchmark without its denominator (Pitfall 12).

**How to avoid:**
The reproducibility key is the **sha256 of the exact argv vector plus the emulator binary's own sha256 plus the seed**, written into the capture record. Two captures are comparable only when all three match. `buildViceArgs()` is already the single seam that constructs argv, so the digest has exactly one honest source.

**Warning signs:** a capture record naming a seed but not an argv digest; a `VICE_ARGS` override in play; a comparison across two captures taken on different days without checking whether `buildViceArgs()` changed in between.

**Phase to address:** the frame-exact-stop gate phase (~33), in the same plan as Pitfall 1.

---

### Pitfall 3: Building the frame-exact stop on top of an acquired **warm** instance — structurally unfixable

**What goes wrong:**
The stop is made instruction-exact, the seed is pinned, the argv is digested — and two runs still land in different frames. Because the emulator has been running, at wall-clock rate, since the broker's warm floor launched it, and the acquire handed out that already-running process. No stop, however exact, recovers a phase that was lost before the client ever spoke.

**MEASURED.** Three runs, each with a fixed `-seed 4242`, each connecting to the text monitor after a different deliberate delay. Machine state at the moment of connect:

| pre-connect jitter | PC at connect | absolute cycles at connect (text-monitor `STOPWATCH` column — **OWNER-EXCLUDED route**, see the Provenance section; the finding does not depend on it) |
|---|---|---|
| 0 ms | `$e5d1` | 23,999,976 |
| 1500 ms | `$e5d1` | 28,481,544 |
| 4000 ms | `$e5d4` | 30,702,674 |

A spread of **6.7 million cycles** — roughly 340 PAL frames — attributable to nothing but when the client's `connect()` happened. Earlier, unjittered runs landed at 10.3M / 10.9M / 11.0M / 15.1M / 17.1M / 17.9M / 24.0M — the value is a pure function of host scheduling.

**And this is exactly what the broker's warm floor does.** READ-IN-SOURCE, and already written down in this project's own pending todo (`2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md`): the warm floor defaults to **1** (`vice-broker.mts:169`, `broker-launch.mts:850`), `maintainWarmFloor()` (`broker-launch.mts:953`) keeps an `x64sc` alive *before any request exists*, and `selectWarmInstance()` (`vice-broker.mts:473`) runs **first** on the acquire path. So a capture run's emulator was launched at an arbitrary earlier moment and has been executing ever since.

That todo frames this as a *launch-mode* problem (headless vs interactive). It is also, and more importantly, a **determinism** problem, and that framing is not yet written down anywhere.

**Why it happens:**
The warm floor is a latency optimisation whose correctness argument is "an emulator is an emulator." That is true for every existing consumer — read memory, set a checkpoint, inspect a chip — because none of them cares what cycle the machine is on. A reproducible-capture consumer is the first one that does, and the pool has no way to express it.

**How to avoid:**
Make the capture run's *first* action a monitor-issued hard reset, and treat the pre-reset state as garbage by construction (see Pitfall 4 for the measured protocol). This is strictly better than making the acquire mode-aware, because it needs no wire-format change, no warm-instance eligibility rule, and no perturbation of the single-owner `inFlight` launch guard — all three of which that todo correctly identifies as expensive.

If a capture run *must* have a virgin instance (e.g. because a hard reset is not acceptable for the release under test), then the honest options are the two that todo names: launch mode becomes part of warm-instance eligibility, or the warm floor is bypassed for that acquire. **Silently downgrading the caller to whatever was already warm is the one outcome to rule out**, and it is the current behaviour.

**The control that must be observed red:** the reproducible-run protocol, executed against a warm instance **without** the reset step, must produce differing stop phases across runs; with the reset step it must produce identical ones. Measured numbers for both halves are in Pitfall 4.

**Warning signs:**
- A capture plan that begins with `acquire` and proceeds straight to `checkpoint_set`.
- Two capture runs whose recorded stop `hit_count` differ (this is precisely the project's own `danish` r1-vs-r2 signature: `hit_count` 1 and 2).
- Any reasoning of the form "the stop is exact now, so the runs must match."

**Phase to address:**
The frame-exact-stop gate phase (~33). This is the phase's *central* finding, not a side constraint — the milestone goal statement should be re-read in the light of it.

---

### Pitfall 4: Concluding the emulator is inherently nondeterministic, and building a heavier mechanism than the problem needs

**What goes wrong:**
The measured 201-divergence `danish` pair and the "stops roughly a frame later, at a wall-clock-determined instruction" finding get read as *the emulator is nondeterministic*. That conclusion licenses an expensive mechanism — VICE event record/replay, a constructed frame counter, a patched stop — when the emulator is in fact cycle-exact and a four-command protocol gets you there.

**MEASURED, and this is the single most consequential finding in this document.** Protocol under test: connect to the text monitor → set the checkpoint **while halted** → issue a hard reset from the monitor (`reset 1`) → resume once. Three runs, fixed `-seed 4242`, deliberate pre-protocol jitter of 0 / 1500 / 4000 ms:

| jitter | state at connect (abs. cycles) | 1st hit of `$EA31` | 10th hit of `$EA31` |
|---|---|---|---|
| 0 ms | 23,999,976 | `.;ea31 00 e6 15 e6 2f 37 00100111 206 014 2076872` | `.;ea31 00 ed 0a ed 2f 37 00100110 056 013 2224669` |
| 1500 ms | 28,481,544 | `.;ea31 00 e6 15 e6 2f 37 00100111 206 014 2076872` | `.;ea31 00 ed 0a ed 2f 37 00100110 056 013 2224669` |
| 4000 ms | 30,702,674 | `.;ea31 00 e6 15 e6 2f 37 00100111 206 014 2076872` | `.;ea31 00 ed 0a ed 2f 37 00100110 056 013 2224669` |

The stop is **byte-identical across all three runs including the raster line (206), the raster cycle (014) and the absolute cycle count (2,076,872 — a text-monitor readout on an OWNER-EXCLUDED route; the raster line and cycle are binary-monitor native, so the finding stands without it)** — and the same at the 10th hit (raster 056, cycle 013, 2,224,669). The pre-reset column, spanning 6.7M cycles, is the noise the reset erases.

So, stated precisely: **stock VICE's emulation is cycle-deterministic from a monitor-issued hard reset, and a monitor checkpoint stop is cycle-exact.** Frame-exactness on the stock backend is reachable **today, with no emulator patch**, from three ingredients this project already has: a pinned seed (Pitfall 1), a monitor-controlled hard reset, and a deterministic hit count.

**Why it happens:**
Every prior observation was taken against the fork, on an acquired warm instance, with an unpinned seed. Three independent nondeterminism sources were superimposed; attributing all of it to the stop is a reasonable first inference and a wrong one.

**How to avoid:**
Write the reproducible-run protocol down as a **named, single-seam procedure** with the reset inside it, and make the frame-exact-stop phase's first criterion the protocol's own jitter-immunity, measured as above. Only *then* ask whether a further mechanism is needed. The candidates then reduce to: does the release under test tolerate a hard reset (a cracked release autostarted from disk generally does), and does the drive path stay deterministic (Pitfall 8 — untested).

**Do not reach for event record/replay first.** MEASURED from `-help` on stock 3.9: `-playback`, `-eventstartsnapshot`, `-eventendsnapshot`, `-eventstartmode <0: file save, 1: file load, 2: reset, 3: playback>`, `-eventsnapshotdir`, `-eventimageinc` all exist, so it is available. But replay is a *whole-run* mechanism whose start point is itself a snapshot, whose desync failure mode is silent (the replayed run simply diverges and keeps going), and which adds a second reproducibility key. It is a fallback for the case where the reset protocol is shown insufficient, not the opening move.

**Also do not reach for `-limitcycles`.** MEASURED from `-help`: *"Specify number of cycles to run before quitting with an error."* It is genuinely cycle-exact and it **quits**, destroying the machine — so it cannot produce a snapshot at that cycle. It is a negative-control tool (prove a run reached exactly N cycles), not a capture route.

**Warning signs:** a plan whose first task is "evaluate event record/replay"; a criterion phrased as "the stop lands within one frame" rather than "the stop lands on the same cycle"; a frame counter being constructed before the reset protocol has been measured.

**Phase to address:** the frame-exact-stop gate phase (~33), as criterion 1. The pre-committed gate's rules should be written such that "the reset protocol is jitter-immune" is a **`go`** input, because it is measurable before any corpus work.

---

### Pitfall 5: Conflating "stops at the same instruction" with "stops in the same frame" with "stops at the same cycle"

**What goes wrong:**
A stop is verified by asserting the PC, the assertion passes, and the captures still diverge. Because instruction-exactness is a strictly weaker property than frame-exactness, and frame-exactness is strictly weaker than cycle-exactness — and a capture comparison is sensitive to all three.

**MEASURED.** Three runs, fixed `-seed 4242`, each stopped at the **same instruction** `$EA31` — but *without* the reset protocol, i.e. connecting to an already-running machine:

| run | registers at the stop | raster line | raster cycle | absolute cycles |
|---|---|---|---|---|
| 1 | `ea31 00 ed 0a ed 2f 37 00100110` | 119 | 036 | 17,874,837 |
| 2 | `ea31 00 ed 0a ed 2f 37 00100110` | 110 | 015 | 15,083,097 |
| 3 | `ea31 00 ed 0a ed 2f 37 00100110` | 190 | 016 | 17,053,738 |

**PC, A, X, Y, SP, `$00`, `$01` and the status flags are byte-identical in all three.** The raster position and the absolute cycle count are not, and differ by up to 2.8 million cycles. An assertion on the PC — or on the whole register file *except* `LIN`/`CYC` — passes cleanly on three runs that are in three different frames.

Corroborating the same distinction from the other side: the project's own measurement (RECALLED from `todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`) that `danish` r1-vs-r2 landed on `hit_count` 1 and 2 → 201 divergences, while `saeger` r1-vs-r2 both landed on `hit_count` 1 → 1 divergence. Frame index is the dominant term; the register file cannot see it.

**Why it happens:**
`LIN` and `CYC` are the only registers that carry frame phase, and CLAUDE.md already records that they are **not monotonic** — which is true, and which makes it easy to conclude they are not useful. They are not useful as a *clock*; they are exactly what you want as a *stop-phase fingerprint*.

**How to avoid:**
The stop's identity is a **triple**: `(PC, hit_count, (LIN, CYC))` — all three binary-monitor native, `REGISTERS_GET` (0x31) for the registers and `LIN`/`CYC`, `CHECKPOINT_INFO` (0x11) for the hit count. Record all three in the capture record and compare them across runs, and set a **frame-anchor checkpoint** on a once-per-frame site alongside the target checkpoint so `hit_count` is genuinely a frame index.

**`STOPWATCH` is OWNER-EXCLUDED (2026-09-02) and is not the substrate here.** An earlier draft of this pitfall proposed it; that proposal is withdrawn. The absolute-cycle figures quoted in the table above are text-monitor readouts — see `## Provenance of the absolute-cycle figure` — and absolute cycle has **no binary-monitor route on this host's VICE 3.9** (`CPUHISTORY_GET` (0x86) supplies it only on ≥ 3.10). It is demoted to an optional 3.10-only strengthening, and the triple above is what the record actually carries.

**Warning signs:**
- A stop-verification assertion that names the PC and nothing else.
- A capture record with no `LIN`/`CYC`/`hit_count` fields, or one carrying `hit_count` from a checkpoint that is not a once-per-frame site.
- A criterion using the words "frame-exact" whose test only checks the PC.

**Phase to address:** the frame-exact-stop gate phase (~33). The capture record's schema is the deliverable here.

---

### Pitfall 6: Tolerating capture divergence with a **range-shaped** allow-list

**What goes wrong:**
The comparison is made to pass by tolerating "the zero page" or "`$0100-$01FF`", because that is where the transients were seen. The allow-list then swallows genuine divergences — including a cracker's patch to a zero-page variable, which is precisely the class `c64-provenance-diff` exists to detect — and the comparison reports equivalence over a real difference.

**MEASURED, and this answers the "what class of address is a legitimate transient" question directly.** Three runs, same fixed seed, all stopped at the same instruction `$EA31`, comparing every byte of `$0000-$03FF` (1024 addresses). Exactly **3** addresses differed:

| address | values across the 3 runs | what it is |
|---|---|---|
| `$00A2` | `c3` / `19` / `91` | low byte of the KERNAL jiffy clock `TIME` (`$A0-$A2`) — increments every jiffy, wall-clock-proportional |
| `$00CD` | `04` / `0e` / `0e` | `BLNCT`, the cursor-blink countdown — IRQ-driven phase |
| `$01F2` | `cd` / `cd` / `d4` | stack page, **above** SP (`SP=$ED` → live stack at `$01ED`) — already-popped return-address garbage |

The transient class is therefore, precisely:

1. **KERNAL IRQ-driven counters whose value encodes elapsed wall time.** `$A0-$A2` (TIME), `$CD` (BLNCT), and — the project's own measured instance — `$F5-$F6`, the keyboard-decode-table pointer, whose value depends on which matrix row the scan happened to be on. `saeger`'s single divergence at `$00F6` is exactly this class, which is the useful confirmation: two independent measurements, one on the fork at a real release, one on stock at the KERNAL prompt, found the same *class*.
2. **Stack bytes above the current SP** — dead by definition, and *not* a contiguous range, because SP moves.
3. **The snapshot-vs-CPU-view overlay at `$0000`/`$0001`** — RECALLED from `todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`, measured there: a `.vsf`-derived image holds the RAM *underneath* the 6510 processor port, a `vice_memory_read` transcript holds the port. This is a **systematic 2-byte difference between two extraction methods**, not a transient, and must be *explained and normalised*, never tolerated.

Note what the measurement also says: three addresses out of 1024, i.e. the honest tolerance set is **tiny**. A rule that tolerates a whole page is over-wide by three orders of magnitude.

**Why it happens:**
Ranges are easier to write than address lists, and the first divergence you see happens to be in the zero page, so the zero page becomes the rule.

**How to avoid:**
- The tolerance set is an **explicitly enumerated, committed, per-address list**, each entry carrying a one-line justification naming the KERNAL variable or the mechanism. Never a range. Never `$0100-$01FF`.
- Derive it by running the reproducible protocol **N times** (N ≥ 3) and taking the union of differing addresses — the method used above. That is how practitioners decide, and it is mechanical rather than a judgement call.
- Cap it. A committed upper bound on the list's size (say 32) turns "the allow-list grew to make the test pass" into a failing assertion rather than a diff nobody reads.
- Stack transients get handled by **SP**, not by address: bytes above the recorded SP at the stop are excluded structurally. That is both narrower and more correct than any range.

**Controls that must be observed red:**
1. Plant a single differing byte at an address **outside** the list and observe the comparison fail. Without this, an over-wide list is invisible.
2. Plant a differing byte **inside** the list and observe it pass. Without this, the list might be inert.
3. Assert the list's size against the cap. Without this, growth is silent.

The first control is the load-bearing one and is the direct analogue of the roadmap's already-committed narrowest-range-wins control.

**Warning signs:**
- Any range in the tolerance set.
- A tolerance set that grew between two commits without a re-measured union.
- A comparison that reports "equivalent" on a pair the practitioner has not eyeballed at least once.
- `$0000`/`$0001` appearing in the tolerance set rather than in the extraction-normalisation step.

**Phase to address:** the frame-exact-stop gate phase (~33). This *is* the equivalence oracle the milestone's first Active requirement asks for ("their captures compare as equivalent"), so it cannot be deferred to the phase that consumes captures.

---

### Pitfall 7: `default_memspace` contamination reached through the drive, on a path the capture run cannot avoid

**What goes wrong:**
A capture run autostarts a `.d64` with true drive emulation on. Something — a drive checkpoint, a drive-side stop, or an unrelated earlier diagnostic in the same session — sets `default_memspace` to a drive. From then on `ADVANCE_INSTRUCTIONS` steps the **1541's** CPU while the harness believes it is stepping the C64, `@bank:` conditions fail outright, and there is **no command that resets it**.

CLAUDE.md already records the mechanism (`monitor.c:3393-3396`, no remedy over the binary monitor). What is new here is **why this milestone specifically walks into it**: this is the first milestone whose central deliverable steps the CPU deterministically, and the first that autostarts real cracked releases from disk images — and a cracked release's loader is *fastloader code talking to the drive*, which is where drive-side stops naturally get set during triage.

**Why it happens:**
The contamination is invisible: `ADVANCE_INSTRUCTIONS` returns success, the drive CPU advances, and the main CPU's PC does not move. To a harness polling the main PC, that is indistinguishable from a stalled emulator — and this project's own `vice-wedge-triage` skill will then be invoked on a machine that is not wedged.

**How to avoid:**
- Make the reproducible-run protocol's **first** command after reset an explicit memspace assertion: read the main CPU's registers with an explicit `0x00` memspace byte and confirm the PC advances under a single `ADVANCE_INSTRUCTIONS`. That is one round trip and it converts an invisible poisoning into a named refusal.
- Treat contamination as **unrecoverable within the instance**: the honest response is to release-and-recycle, not to attempt a reset. `handleRelease()`'s existing kill-never-recycle path (`vice-broker.mts:929`, READ-IN-SOURCE) is the right hammer.
- Never set a drive-side checkpoint in an instance that will later be used for a capture. Make that a property of the instance's recorded state, not a discipline.

**The control that must be observed red:** set a drive checkpoint, let it hit, then run the protocol's memspace assertion and observe it **refuse**. Then run the same assertion on a clean instance and observe it pass. Without the red half, the assertion could be checking nothing.

**Warning signs:**
- A capture run that reports the main CPU "not advancing" while the emulator is plainly alive.
- Any `@bank:`-qualified checkpoint condition returning a syntax error mid-run when it parsed fine earlier.
- A wedge-triage invocation during a capture sweep.

**Phase to address:** the frame-exact-stop gate phase (~33). It is a precondition of the protocol, not a downstream concern.

---

### Pitfall 8: Assuming warp mode changes behaviour — and missing the thing it actually breaks

**What goes wrong (the assumed version):**
Warp is avoided for capture runs on the theory that speeding up the emulator changes what it computes. Runs then take real time, corpus sweeps become impractical, and the milestone's measurement budget is spent on wall clock.

**What goes wrong (the real version):**
Warp is enabled and it silently invalidates every **host-side** timeout that was tuned against real-time emulation.

**MEASURED.** Two runs under the reset protocol, fixed `-seed 4242`, identical in every respect except `-warp`:

| launch | 1st `$EA31` hit | 10th `$EA31` hit |
|---|---|---|
| with `-warp` | `ea31 … 206 014 2076872` | `ea31 … 056 013 2224669` |
| without `-warp` | `ea31 … 206 014 2076872` | `ea31 … 056 013 2224669` |

Byte-identical, including raster line, raster cycle and absolute cycle count. **Warp changes wall-clock rate and nothing observable about the emulation.** (Caveat, stated rather than glossed: both probes ran `-sounddev dummy`. A real audio device with sound-driven speed adjustment was not tested, and remains RECALLED-only as a possible confound.)

What warp *does* break is on this side of the socket, and this project's own pending todo already names it: `probeReady`, `VICE_MCP_TIMEOUT_MS` (default 30000), and `vice-sync.ts`'s checkpoint-wait poll loops are all wall-clock. Sharper than that todo puts it: because warp is a **runtime** operation over the text monitor on stock (`warp on` / `warp off`, live-confirmed in this repo on 2026-08-27 against this same 3.9 binary), the cycle-to-wall-clock ratio can change **mid-bracket** — so a checkpoint wait that starts unwarped and ends warped is a real, reachable state, not a hypothetical.

**How to avoid:**
- Use warp for capture and corpus sweeps. It is free.
- Express every wait as a bracket over an **emulated** quantity, with the wall-clock timeout as a backstop rather than the primary bound. On the 3.9 floor that quantity is **`hit_count` on a once-per-frame anchor checkpoint** — which is not an extension of `vice-sync.ts`'s documented invariant but *literally it*: "poll on `hit_count`, never on paused state." **A `STOPWATCH`-based cycle bracket is OWNER-EXCLUDED (2026-09-02)** and an earlier draft's proposal of one is withdrawn; on ≥ 3.10 a `CPUHISTORY_GET` (0x86) clock bracket is the optional strengthening.
- **Warp is a launch-time dimension again.** The runtime `warp on` / `warp off` commands live on the excluded text channel, so stock warp control reverts to `-warp` / `InitialWarpMode` per CLAUDE.md's settled constraint. Practical effect: warp is chosen per *instance*, which puts it back inside the warm-instance-eligibility problem Pitfall 3 describes — a warm interactive instance cannot be retro-warped.
- Do not flip warp inside a bracket. If a phase needs it, make the flip a bracket boundary.

**The control that must be observed red:** a checkpoint-wait bracket, warped, whose wall-clock timeout is set to the un-warped tuning, must be shown to **time out spuriously** — then shown to pass on the cycle-bracket implementation. This is the only honest way to prove the wait was reimplemented rather than merely re-tuned.

**Warning signs:** a wait implemented as `setTimeout`; a timeout constant tuned by trial; `warp on` issued from inside a checkpoint-wait helper.

**Phase to address:** the frame-exact-stop gate phase (~33), as part of the protocol; the warp/headless launch knob itself is the existing pending todo's scope and should be promoted into this phase rather than left unowned.

---

### Pitfall 9: Accepting any published disassembler benchmark — including one from a source you already trust

**What goes wrong:**
A published figure ("72.46% data recovery, 0 false positives") is quoted, planned against, and becomes the baseline a later phase compares to. It does not reproduce, and the direction of the error is *flattering to the tool exactly where the headline lives*.

**MEASURED, by this project, and it is the strongest lesson in the input set.** From `docs/phase23-real-release-gate-findings.md` criterion 1, re-derived byte by byte from the fixture's own assembler report:

| quantity | reproduced (source-derived) | as published by the pivot |
|---|---|---|
| ground-truth partition | 145 code / 131 data / 3 pad → **145/134** | 141 code / 138 data |
| data-recovery rate | **72.39 (97/134)** | 72.46% (100/138) |
| false positives | **3** | **0** |
| false negatives | **27.61 (37/134)** | 27.5% (38/138) |
| `FIXTURE_REPRODUCED` | **no** | — |

The published 141/138 partition **is not recoverable from `fixture.a` under any padding treatment**. All four published figures *are* exactly reproducible under a four-byte reclassification (`$0869-$086b`, `$08a6`) — but that reclassification was **fitted to make the numbers agree**, so it is recorded as a hypothesis (RC-1), not a baseline. And the three bytes dxa got wrong — it typed a live `JSR` as data — are counted as *data* in the published ground truth, so they score as successes instead of as three false positives. The partition was more generous to the tool than the source is, precisely at the "0 false positives" claim.

A third figure, recorded and deliberately not the baseline: under a strict denominator, **71.76 (94/131) recovery, 6 false positives, 28.24 (37/131) false negatives.** Same tool, same fixture, same run — three defensible number sets depending on the denominator.

**What that tells you about accepting ANY published benchmark for a disassembler:**
A code/data classification benchmark is only as good as its **ground-truth partition**, and a partition is almost never published in a form you can re-derive. The number is therefore not a measurement of the tool; it is a measurement of the tool *joined against an unpublished judgement*. Treat every published disassembler figure as a claim about an artifact you do not have.

The operational rule: **a benchmark you cannot re-derive from source is not evidence, it is a hypothesis.** And a benchmark whose partition was fitted is worse than no benchmark, because it points the wrong way with confidence.

**How to avoid:**
- Derive the partition from something the tool cannot see and you did not choose after seeing the tool's answer — for this project, a **VICE runtime inventory** of which addresses actually executed. Commit the derivation before running the tool.
- Publish the **denominator and the positive class** beside every rate, always. `72.39` and `71.76` differ only in whether three assembler-pad bytes count as data.
- Print re-measured figures **beside** the published ones with the non-reproduction attached, never instead of them. This project already decided that (`PROOF-01`'s wording) and it should stay decided.
- **Never fit the ground truth.** If a reclassification makes the numbers agree, that is a finding about the published number, recorded as a hypothesis — as RC-1 was.

**Warning signs:**
- A plan that quotes `72.46%` / `0 FP` without RC-1 attached. Two of this milestone's own carried notes already had to be corrected for exactly this (ROADMAP.md Phase 26 note, verification warning W2).
- A rate with no denominator.
- A ground-truth partition whose derivation is a paragraph of prose rather than a script.
- A criterion comparing a new number to a published one and calling it apples-to-apples.

**Phase to address:** the two-engines phase (carrying Phase 24's `DXA-01..03` text). The partition derivation is a **precondition** of the discovery-rate criterion and should be its own task, sequenced before the tool runs.

---

### Pitfall 10: 6502 constructs that break linear and recursive-descent discovery — and which of them run the dangerous way

**What goes wrong:**
dxa's classification is accepted as a map, and a region it typed as code is graphics data. That mints phantom labels indistinguishable in form from genuine ones (`zpp_02`, `zpa_06`, `f_1B1A`), which get promoted to Ghidra functions, yield phantom xrefs, feed the annotation join, and emerge as confident wrong comments the next pass treats as established.

**MEASURED direction of error** (Phase 23, criterion 1): on the fixture, false negatives materially exceed false positives — `27.61%` data-called-code against 3 bytes the other way. **The errors run the dangerous way.** MEASURED absence: the error direction against a real release is `could-not-run` and remains unknown, so whether the graphics-feedback containment is sufficient or load-bearing is an open question this milestone must answer, not inherit.

**READ-IN-SOURCE, from this project's own check** (ROADMAP.md Standing Constraints): `grep -in bank` over all 3,417 lines of dxa 0.1.5 returns **zero**, its entire C64-specific knowledge is eight lines testing whether the load address looks like a BASIC start, and it has **no machine-readable output**. It is a discovery engine and nothing more.

**The specific constructs, and what each does to a linear or recursive-descent pass** (RECALLED for the mechanisms, MEASURED where noted):

| construct | what breaks | direction of error |
|---|---|---|
| **jump tables** (`jmp (table,X)` / `lda tbl,x : sta $fb : jmp ($fb)`) | targets are computed, so recursive descent never reaches them; the table itself is `.word` data that looks like plausible code | **both** — table decoded as code (dangerous), targets left as data (missed code) |
| **`rts`-based dispatch** (push hi/lo, `rts`) | the "call" is a `pha`/`pha`/`rts` sequence with no `jsr`; the callee has no inbound reference at all | missed code — and Ghidra reports **nothing** when it fails to resolve this (see Pitfall 17) |
| **self-modifying code** | the byte at analysis time is not the byte at execution time; a `sta $xxxx` into the code stream re-types an operand | silently wrong semantics, no marker |
| **illegal opcodes used deliberately** (crackers, crunchers) | stock decoders emit `.byte` and **resynchronise on the wrong boundary**, so the next N instructions are garbage that still looks like instructions | dangerous — a decode desync produces a run of plausible wrong code |
| **packed / crunched code** | pre-depack, essentially all of it is data; the depacker is the only real code | dangerous if analysed pre-depack — this is why the capture half gates the analysis half |
| **data interleaved in the code stream** (inline tables after a `jsr`, `bit $xxxx` skips) | linear decode walks straight into the table | dangerous |
| **`jsr` into the middle of an instruction** | two valid decodes of the same bytes exist; a single classification per byte cannot express it | dangerous, and **not representable** in a flat byte→class map at all |

That last row is a structural point worth pulling out: **a byte-per-address classification cannot represent overlapping decodes**, and cracked code uses them. The store's twelve-member per-range vocabulary is a range model, so the honest answer when two decodes overlap is a **refusal to classify**, not a winner.

**How to avoid:**
- **Name known-data ranges before discovery, not after.** The roadmap's `DXA-01` criterion already requires that naming a known-data range excludes those bytes. Extend it: the VIC-derived graphics map (Phase 26's criterion 5 — screen matrix, charset/bitmap, sprite pointers derived from `$DD00` bits 0-1 inverted, `$D018`, `$D011` bit 5, screen + `$3F8`) must be fed **back into dxa as `-b` data blocks** and into Ghidra as data, and the phantom labels a graphics region mints must be shown **present before the feedback and absent after**. That ordering is the containment.
- The listing parser's refusal must be provoked by a **real dxa listing form it does not know** — a construct from an actual run — not only by a hand-planted malformed line. A hand-planted line tests the refusal path; a real unknown form tests the *coverage* of the refusal, which is what actually bites.
- Classify overlapping decodes as **unclassified with a stated reason**, never as the longer or first match.

**Warning signs:**
- A label of the auto-generated shape (`zpp_*`, `zpa_*`, `f_*`) inside a range the graphics map says is a charset.
- dxa's code total exceeding the runtime inventory's executed-byte total. That inequality is checkable and one-directional: discovery may miss executed code, it may never *exceed* it by much.
- A code/data map with 100% coverage and no unclassified bytes. On real cracked code that is a symptom, not an achievement.
- A classification map with no representation for "two decodes here."

**Phase to address:**
The two-engines phase (Phase 24's text) owns the parser and the refusal. The **feedback loop** — graphics map → dxa `-b` → re-run — belongs to the auto-annotation phase (Phase 26's text), and the two must be sequenced so the feedback is exercised, not just built.

---

### Pitfall 11: `analyzeHeadless` exits 0 when the post-script throws — and the obvious log grep false-fires

**What goes wrong:**
The harness checks `analyzeHeadless`'s exit status, sees 0, and records the export as valid. The post-script threw and wrote a short or partial file.

**MEASURED, in this repo's own committed evidence** (`.planning/phases/23-…/evidence/tools/instrument-provenance.txt` § 4b):

```
ERROR REPORT SCRIPT ERROR:  (HeadlessAnalyzer) java.lang.IllegalStateException: ExportAnalysis23: exported 4887 classification lines but the image is 279 bytes. Refusing a short export. classification_lines=4887 expected=279
[exit 0]
```

The evidence file's own note: *"NOTE THE EXIT CODE ON THE FAILING RUN: analyzeHeadless returned 0 even though the post-script threw. A later plan must grep its run log for `ERROR REPORT SCRIPT ERROR` and must NOT trust analyzeHeadless's exit status."*

**And the obvious grep is wrong in the other direction.** MEASURED, same evidence file § 3b: on the **flat-64K** import route the 6502 language emits two lines reading `Failed to add language defined memory block due to conflict` for `ZERO_PAGE` and `STACK`, because the flat image already occupies `$0000-$01FF`. These are **INFO lines on a correct run**, and they appear only on the flat-64K route — the `.prg` route at `$0801` does not produce them. A harness greping for `Failed`, `error` or `conflict` reddens on every correct capture-route run.

**Why it happens:**
Both halves are the same mistake: the harness's success predicate is inherited from the tool rather than derived from what the run was supposed to produce.

**How to avoid:**
Three independent gates, all of them, on every run:
1. **Exit status** — necessary, not sufficient.
2. **A grep for the exact literal `ERROR REPORT SCRIPT ERROR`** — anchored on that literal, not on `error`/`ERROR`/`fail`.
3. **A positive output assertion the script itself makes and prints** — the pattern Phase 23 already established: `EXPORT_CLASSIFICATION_ASSERTED: yes (65536 lines == 65536 bytes)`.

**The control that must be observed red:** run the export with a deliberately wrong expected count and observe gate 2 fire *while the exit code is 0*. Phase 23 already ran exactly this and recorded both outcomes — reuse the transcript, do not re-derive it.

**Warning signs:** a harness whose only check is `$?`; a grep pattern containing bare `error` or `fail`; a run log check that has never been observed firing.

**Phase to address:** the two-engines phase (Phase 24's `GHID-01` harness). This is the harness's first criterion.

---

### Pitfall 12: The classification line count is the block total, not the image size — and the difference is route-dependent

**What goes wrong:**
The export's completeness assertion is written as `lines == imageSize`. It passes on the flat-64K route and fires spuriously on the `.prg` route, so someone weakens it to `lines > 0` and the completeness check stops existing.

**MEASURED**, same evidence file:

| route | classification lines | image bytes | why |
|---|---|---|---|
| `.prg` at `$0801` (fixture) | **4887** | 279 | the 6502 language contributes `ZERO_PAGE` and `STACK` blocks, and `FlatVolatile` adds `VOL_d000`, so the address ranges the export walks total 4887 |
| flat 64K raw at `$0000` | **65536** | 65536 | the blocks tile `$0000-$ffff` exactly, so the count *is* the image size |

The evidence file's own note: *"A later plan must pass the total across all blocks, not the image size, or the assertion fires on a correct export."*

**How to avoid:**
The expected count is **computed by the script from `mem.getBlocks()`** and printed, and the *harness* asserts the printed count equals the printed expectation — i.e. the assertion is internal and self-consistent, with the harness checking that it ran and passed, not recomputing it. That is why `EXPORT_CLASSIFICATION_ASSERTED: yes (N lines == N bytes)` is the right shape.

**Warning signs:** a hard-coded `65536` in the harness; a completeness check of the form `> 0`; a route change (`.prg` ↔ flat) accompanied by an assertion edit.

**Phase to address:** the two-engines phase (Phase 24's `GHID-01`).

---

### Pitfall 13: `MemoryConflictException` on the volatile carve — the whole run silently falls back to non-volatile

**What goes wrong:**
The pre-script calls `createUninitializedBlock` for the I/O range, the loader already owns a block there, the call throws, the script's `catch` logs and continues (or the throw is swallowed by the harness's exit-0 blindness — Pitfall 11), and `analyzeAll()` runs with `$D000-$DFFF` as ordinary RAM. Every hardware write is then eliminated as a dead store.

The base hazard is already a Standing Constraint. **What is new here is the interaction**: the conflict route is *route-dependent in exactly the same way as Pitfall 12*. MEASURED: the flat-64K import already occupies `$0000-$01FF`, and the language's own `ZERO_PAGE`/`STACK` blocks fail to be added *because of that conflict* — so on the capture route, the flat image owns `$0000-$0001` and a naive `createUninitializedBlock` for the processor port **will** conflict. On the `.prg` route it may not. A pre-script tested on the fixture (`.prg`) and shipped for the corpus (flat 64K) hits a conflict the test never saw.

**How to avoid:**
- `mem.getBlock(addr)` **first**, `setVolatile(true)` on the existing block, and `createUninitializedBlock` only when `getBlock` returns null. Standing Constraint already says this; what to add is that the pre-script must be exercised on **both routes** and the volatility verified on both.
- The verification is not "the script printed that it set the flag." It is **the reference dump**: MEASURED, Phase 23's flat-64K run shows `4002 -> d020 WRITE`, `4007 -> d020 WRITE`, `400a -> 0001 READ`, `400e -> 0001 WRITE` surviving — two consecutive `$D020` writes with no read between, which is exactly the dead store the decompiler eliminates when the range is not volatile. That dump is the proof the carve *did something*.
- Never `catch` around the carve. A failed carve is a failed run.

**The control that must be observed red:** remove the volatile flag and observe the hardware writes **disappear** from the reference dump — on **both** routes. Phase 24's criterion 3 already requires this for one; require it for both, because the conflict path differs.

**Warning signs:** a `try`/`catch` in the pre-script; a volatility assertion that reads the script's own log line rather than the export; a pre-script tested only against the `.prg` fixture.

**Phase to address:** the two-engines phase (Phase 24's criterion 3), with the two-route requirement added.

---

### Pitfall 14: The SLEIGH extension source **does not compile** — and the eight failures are exactly the declared unknowns

**What goes wrong:**
The milestone plans `OPC-01..03` as pure integration on the strength of a recorded note that *"the SLEIGH source already exists in full — 766 lines, all 105 bytes, unstable instructions modelled as black-box userops, the `@include` layering already written."* The plan is written, the phase opens, and the source does not build.

**MEASURED, this session, against the real Ghidra 12.1.3 SLEIGH compiler.** Extracted the fenced block from `docs/undocumented-opcodes-ghidra.md` (doc lines 4-550 → a 547-line `.sinc`), wrapped it exactly as the file's own header prescribes:

```
@include "6502.slaspec"
@include "6502_undocumented.sinc"
```

and ran `support/sleigh`:

```
ERROR 6502_undocumented.sinc:217: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:390: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:449: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:458: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:493: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:504: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:518: … Could not resolve at least 1 variable size
ERROR 6502_undocumented.sinc:525: … Could not resolve at least 1 variable size
ERROR No output produced (SleighCompile)
exit code 2, no .sla written
```

**Eight failures, and every one is a black-box-userop or unsized-token-field constructor** — i.e. precisely the instructions `OPC-03` is about:

| `.sinc` line | doc line | constructor |
|---|---|---|
| 217 | 220 | `:NOP imm16 is op=0x0c` — `local ignored:1 = *:1 imm16;` |
| 390 | 393 | `:LAX "#"imm8 is op=0xab` — `unstableLAXImmediate(A, imm8)` |
| 449 | 452 | `:SBC "#"imm8 is op=0xeb` — `undocSBC(imm8)` |
| 458 | 461 | `:XAA "#"imm8 is op=0x8b` — `unstableXAA(A, X, imm8)` |
| 493 | 496 | `:AHX imm16,Y is op=0x9f` — `unstableAHXStore(A, X, imm16, Y)` |
| 504 | 507 | `:TAS imm16,Y is op=0x9b` — `unstableTASStore(…)` |
| 518 | 521 | `:SHY imm16,X is op=0x9c` — `unstableSHYStore(Y, imm16, X)` |
| 525 | 528 | `:SHX imm16,Y is op=0x9e` — `unstableSHXStore(X, imm16, Y)` |

**Why it happens:**
SLEIGH cannot infer a size for a token field used directly as a `define pcodeop` argument or as a dereference address. The declared-unknown modelling is *conceptually* right and *syntactically* incomplete — which is the worst combination, because it reads correct.

**The fix is small and was verified to work.** MEASURED: introducing explicitly sized locals for the token fields inside each affected constructor —

```
local i8:1  = imm8;      # then pass i8 to the userop
local a16:2 = imm16;     # then pass a16, and deref *:1 a16
```

— compiles the **entire** file clean: `t.sla` produced (8,423 bytes), **zero errors**, and only warnings (`2 NOP constructors found`, `5 operations wrote to temporaries that were not read`, plus one inherited from stock — see Pitfall 16).

**Also MEASURED, and this is the reassuring half:** the `@include "6502.slaspec"` layering produced **no byte-value collision error at all**. The extension's collision design is sound; it is the p-code that needs work.

**How to avoid:**
- **Re-scope `OPC-01..03` from "integrate and verify" to "fix, integrate and verify."** The roadmap note is now measurably wrong as a compile claim and should be corrected at source rather than annotated — this project's own convention.
- Put a `sleigh` compile in CI, on the committed extension source, asserting exit 0 **and** a produced `.sla`. That is a five-second gate that would have caught this before a plan was written.
- Sequence the compile gate **first** in the phase, ahead of any decompiler-output comparison, because nothing downstream is meaningful without it.

**The control that must be observed red:** revert one of the eight sized-local fixes and observe the compile gate fail with a `Could not resolve at least 1 variable size` naming that line. Eight red observations available for free.

**Warning signs:**
- Any plan text asserting the source "already exists in full" without a compile transcript.
- A `.sla` in the tree with no recorded compiler invocation.
- `OPC-*` criteria that only compare decompiler output, with no build step asserted.

**Phase to address:** the two-engines phase (Phase 24's `OPC-01..03`). Add the compile gate as the phase's earliest task.

---

### Pitfall 15: A failed SLEIGH compile leaves the **stock** `.sla` in place, so the pipeline runs on stock and says nothing

**What goes wrong:**
The extension fails to compile (Pitfall 14), the build script does not check the exit code, and `analyzeHeadless` runs happily — on Ghidra's **pre-shipped** `6502.sla`. Illegal opcodes decode as bad bytes, the decode desynchronises, the export looks structurally normal, and cracked code is silently mis-read. This is the exact failure `OPC-*` exists to prevent, arriving through the build system instead of through the language.

**MEASURED, both halves.** `support/sleigh` on the failing source: **exit code 2, and `6502_nmos.sla` does not exist**. And READ-IN-SOURCE, the Ghidra install ships **precompiled** `.sla` files beside the specs:

```
Ghidra/Processors/6502/data/languages/
  6502.sla    5094 bytes   6502.slaspec
  65c02.sla   7060 bytes   65c02.slaspec
```

So the "no output produced" case is not an empty-language case — it is a **stale-but-present** case. The good news, and the contrast worth recording: unlike `analyzeHeadless`, **`sleigh` is honest about failure** (exit 2). The bad news is that its honesty is only useful if someone reads it.

**How to avoid:**
- The build step checks `sleigh`'s exit code **and** asserts the `.sla` exists **and** asserts its mtime is newer than every `.slaspec`/`.sinc` input. Three cheap checks, because each fails differently.
- Never write the compiled `.sla` over a stock language's file. Emit a **new** language (Pitfall 16), so a failed compile leaves the pipeline pointing at a language that does not exist and refuses loudly, rather than at a stock language that works wrongly.

**Warning signs:** a build script whose `sleigh` invocation is not followed by `if [ $? -ne 0 ]`; a `.sla` whose mtime predates its spec; the extension's `.sla` living in the Ghidra install's own `6502/data/languages/`.

**Phase to address:** the two-engines phase (`OPC-01`), same task as Pitfall 14's compile gate.

---

### Pitfall 16: No `.ldefs` entry — the extension compiles, ships, and is **never loaded**

**What goes wrong (and this is the quietest failure in the whole milestone):**
The extension compiles. The `.sla` is committed. The harness runs the command line Phase 23 recorded and proved works:

```
analyzeHeadless … -processor 6502:LE:16:default -loader BinaryLoader …
```

Everything succeeds. The extension is **inert**, because `6502:LE:16:default` is the stock language.

**MEASURED / READ-IN-SOURCE.** `Ghidra/Processors/6502/data/languages/6502.ldefs` declares exactly two languages:

| `id` | `slafile` |
|---|---|
| `6502:LE:16:default` | `6502.sla` |
| `65C02:LE:16:default` | `65c02.sla` |

There is **no** NMOS/undocumented variant. A `6502_nmos.slaspec` compiled to `6502_nmos.sla` is not reachable from any `-processor` argument until a **new `<language>` element with a new `id`** exists in an `.ldefs` Ghidra loads. Every existing artifact in this repo — Phase 23's recorded command line, its `instrument-provenance.txt`, the wrapper-proposal todo — names `6502:LE:16:default`.

So the highest-probability outcome of a naive `OPC-*` implementation is: a compiled extension, a green harness, and a decode that never used it.

**Why it happens:**
The extension's own header (correctly) forbids including it from `6502.slaspec`, because `65c02.slaspec` includes `6502.slaspec` and reuses many of the same opcode bytes. So the extension *must* be a separate language. And "a separate language" is a `.ldefs` change, which is a file nobody edits and no criterion mentions.

**How to avoid:**
- Ship the extension as a **Ghidra extension module** with its own `.ldefs`, declaring `id="6502:LE:16:nmos"` (or similar), and **change the harness's `-processor` argument in the same commit**. One commit, both halves, or the split is the defect.
- Make the criterion's assertion about the **language actually used**, not about the extension's existence. `analyzeHeadless` logs the language; assert on that log line.
- The `65c02` non-collision criterion (Phase 24 criterion 5) then becomes genuinely checkable: load `65C02:LE:16:default` in the same installation and confirm the shared bytes still read as their documented 65C02 meanings. That criterion is only meaningful *because* the extension is a separate language — under an in-place `6502.slaspec` edit it could not pass.

**The control that must be observed red:** run the acceptance image with `-processor 6502:LE:16:default` and observe the illegal-opcode assertions **fail**; run it with the extension's id and observe them pass. Two runs, one flag apart. Without the red half, "all 105 bytes decode" is provable by a stock language that decodes none of them, if the assertion is loose enough.

**A related trap on the same surface (MEASURED):** stock `6502.slaspec` itself emits `WARN 6502.slaspec:119: Unreferenced table: 'ADDR8'`. A build gate that treats any `WARN` from `sleigh` as failure reddens on Ghidra's own shipped language.

**Phase to address:** the two-engines phase (Phase 24's `OPC-01`/`OPC-02`). This should be the phase's first *criterion*, not just its first task — it is the difference between the phase delivering and the phase reporting delivery.

---

### Pitfall 17: Unresolved is invisible — Ghidra reports nothing when it fails to resolve a dispatch

**What goes wrong:**
The computed-dispatch criterion is verified by looking for resolved targets in Ghidra's export, finding some, and recording success. The sites Ghidra failed on are absent from the export with no error, no diagnostic and no "unresolved" record — so the criterion degrades to *"Ghidra resolved the dispatch that Ghidra found."*

**MEASURED**, from `docs/phase23-real-release-gate-findings.md` criterion 2: *"Ghidra **reports nothing when it fails to resolve a dispatch** — there is no error, no diagnostic and no 'unresolved' record in its export. Unresolved is therefore detectable only as the **absence of a reference from a site that was independently enumerated by something other than Ghidra**."*

Which is why `C2_SITES_ENUMERATED` is specified to come from the **VICE runtime inventory** and never from Ghidra, and why a site counts as *computed* only if it dispatches through two or more distinct values at the same program address across an observed run.

**MEASURED trap adjacent to it, worth naming because it is the natural thing to reach for:** the pivot's Ghidra dump records one `COMPUTED_JUMP` (`082e -> 089a`) on the 279-byte fixture — but the fixture's dispatch index was an immediate `ldx #$02`, the easy case, and Phase 23's own evidence says so in as many words: *"Its presence here proves the EXPORT works … and nothing whatever about Ghidra's dispatch resolution. A later plan that reads this section as evidence for `C2_COMPUTED_DISPATCH: resolved` has misread it."* That warning exists because the misreading is available.

**How to avoid:**
- The site enumeration is produced by the runtime inventory, committed **before** Ghidra runs, and the criterion is a **join**: enumerated sites minus Ghidra-resolved sites = unresolved, reported as a count and a list.
- Distinguish `could-not-run` from `not-exercised` with the same rigour Phase 23 did. `not-exercised` is a claim about the **corpus** (the construct was not present) and is earned only by the pre-committed inventory showing it absent. `could-not-run` is a claim about **execution**. Both may fire the same rule; they say opposite things about what is known, and conflating them is the softening the gate exists to forbid.
- Never accept an immediate-index dispatch as evidence about computed dispatch.

**Warning signs:** a dispatch criterion whose denominator comes from Ghidra; a resolved-target count with no unresolved count beside it; a `not-exercised` verdict with no inventory behind it.

**Phase to address:** the two-engines phase (Phase 24's `GHID-04`), with the inventory as a precondition owned by the capture phase (~33) — the inventory needs a reproducible run, which is the frame-exact stop.

---

### Pitfall 18: The structural export written against `DataTypeManager` — "the single most expensive mistake available in this design"

Already a Standing Constraint and already carrying a control in Phase 24's criterion 4. **What to add:**

The constraint says `getAllComposites()` and `getDefinedData()` return essentially nothing and every structural export goes through `DecompInterface`. The symptom is an **empty result, not an error** — which is why it is expensive. Two extensions worth writing down:

1. **`DecompInterface` has its own silent-partial mode: the decompiler timeout.** `analyzeHeadless` takes `-analysisTimeoutPerFile` (READ-IN-SOURCE, used in Phase 23's runs), and a per-function `decompileFunction` call takes a timeout too. On a real cracked release — thousands of functions, some of them phantom functions inside graphics data (Pitfall 10) — timeouts are expected, not exceptional. A timed-out function yields **no structural facts and no error**, so the export is short in exactly the same shape as the `DataTypeManager` failure. The classification-count assertion (Pitfall 12) catches a short *classification*; it does **not** catch a short *structural* export.
   **Prevention:** the script counts functions attempted, functions decompiled, and functions timed out, prints all three, and the harness asserts `attempted == decompiled + timedOut` **and** that `timedOut` is below a committed ceiling. A rising timeout count is the early warning that the phantom-function problem is out of hand.
2. **The `DataTypeManager` control must be run against the *real* export, not a reduced one.** Criterion 4 already requires a control asserting the `DataTypeManager` route returns essentially nothing. Make it run on the same image as the acceptance run, in the same harness invocation, so the two cannot drift apart.

**Warning signs:** a structural export with no per-function accounting; a decompile loop with a bare `catch`; a `DataTypeManager` control run on the 279-byte fixture while the acceptance runs on a 64K image.

**Phase to address:** the two-engines phase (Phase 24's `GHID-04`).

---

### Pitfall 19: The dot-prefixed project path, and the four paths that cross the container boundary

**What goes wrong:**
The Ghidra project directory is placed somewhere natural — `.planning/…`, `$HOME/.cache/…`, `.vice-supervisor/…` — and `analyzeHeadless` aborts with a message that names neither the directory nor the offending element.

**MEASURED**, this repo's own evidence:

```
ERROR Abort due to Headless analyzer error: Path element starting with '.' is not permitted (HeadlessAnalyzer)
  java.lang.IllegalArgumentException: Path element starting with '.' is not permitted
    at ghidra.util.NamingUtilities.checkName(NamingUtilities.java:108)
    at ghidra.framework.protocol.ghidra.GhidraURL.checkValidProjectPath(GhidraURL.java:440)
[exit 1]
```

Phase 23 worked around it by putting the project at `$HOME/c64-re-tools-phase23-ghidra` with `-deleteProject`.

**What to add.** This project's default state directories are *all* dot-prefixed (`.planning/`, `.vice-supervisor/`, `.annostore`), and its state-dir overrides (`VICE_POOL_DIR`, `VICE_SUPERVISOR_DIR`) point at dot-prefixed paths by default. So the collision is not incidental — the natural placement is the forbidden one, in three independent directories.

And a Ghidra run crosses the container boundary at **four** distinct paths, each needing translation in a deliberately placed call (never inherited — CLAUDE.md's derived-tool constraint):

| path | direction | note |
|---|---|---|
| the input image | container → host | the capture, produced container-side or host-side depending on the extraction seam |
| the script path (`-scriptPath`) | container → host | the committed `.java` files ship inside the package |
| the project directory | host-only | **must not be dot-prefixed**, and must not be a bind-mounted container path |
| the export output | host → container | and it is large (Pitfall 20) |

**How to avoid:**
- One seam owns the Ghidra project directory's location, with the no-dot rule asserted **in code** and a test that a dot-prefixed candidate is rejected before `analyzeHeadless` sees it. The abort message is useless; the refusal must be local and named.
- `-deleteProject` on every run, so the project is scratch and never a cross-run artifact. Phase 23 established this; keep it.
- The four paths get four explicit translation calls, and a test enumerating them — the same shape as `hostpath-consumers.test.ts`'s closed-consumer assertion (see Pitfall 25).

**Warning signs:** a project path derived from `repoRoot()` or `supervisorDir()`; a `analyzeHeadless` invocation with a relative project path; any of the four paths passed through without a translation call.

**Phase to address:** the Ghidra execution-seam decision (see Pitfall 20) — it is a precondition for the two-engines phase, and the milestone context already flags it as undecided.

---

### Pitfall 20: The 64 KiB line cap versus a megabyte export — and the socket is destroyed with no error frame

**What goes wrong:**
The Ghidra export is returned inline over the broker's control channel. The line exceeds the cap, the socket is destroyed, and from the client it is **indistinguishable from a connection drop** — i.e. indistinguishable from a wedge, on a project whose whole recovery machinery is built around telling those apart.

**READ-IN-SOURCE.** `const MAX_LINE_BYTES = 65536;` (`src/mcp/vice/broker-control.mts:242`), enforced at `:376`, and the module's own doc comment at `:668` records that *"a connection exceeding MAX_LINE_BYTES without a newline is destroyed rather than …"*. The `host-tool-executor` seed already states the consequence: *"Bulk results must be written to a file host-side and returned as a path (translated back through `containerpath.ts`), or the channel needs chunked framing. Choose deliberately — inheriting the cap silently is how this fails in production on the first large image."*

**MEASURED size data.** Phase 23's flat-64K classification export was **721,030 bytes** — 11× the cap, and that is the *classification* export only, on a synthetic image, with four-hex-digit addresses making each line ~11 bytes. A real release's structural export plus per-function decompiled C is materially larger. (Worth recording: 721 KB is *less* than the ~1.5 MB Phase 23's own research had estimated, so the estimate was pessimistic — but still 11× the cap.)

**How to avoid:**
Return a **path, never a payload**. The export is written host-side, its sha256 and byte length are returned inline, and the container side reads it through the translated path. This has three independent virtues: it fits the cap, it gives the run a content digest for free (which the reproducibility key wants anyway), and it makes a truncated export detectable by length mismatch rather than by silence.

**The control that must be observed red:** attempt an inline return of a >64 KiB payload and observe the client see a bare disconnect with no error frame. Once observed, nobody will be tempted to "just try it for the small case."

**Warning signs:** an op whose response shape contains the export; a response-size assertion absent from the protocol tests; a client-side `catch` treating disconnect as retryable.

**Phase to address:** the Ghidra execution-seam decision — which the milestone context correctly identifies as **undecided and a precondition**. It should be its own phase or the first plan of the two-engines phase, and it must be settled before any skill script reaches for Ghidra.

---

### Pitfall 21: The equivalent of the 2026-08-01 triple-launch outage — a Ghidra project directory is a single-writer resource with no lock you control

**What goes wrong:**
Two analyses start against the same Ghidra project directory. Ghidra's own project locking either blocks one (looking like a hang, on a multi-minute operation where a hang is indistinguishable from progress) or — with `-deleteProject` in play — one run deletes the project the other is using. The observable result is a partially-written export with a plausible shape.

**The structural analogy is exact.** CLAUDE.md records the broker's single-owner `inFlight` launch guard as *a synchronous check-and-set with no `await` between*, existing because of the 2026-08-01 triple-launch outage and regression-tested. READ-IN-SOURCE, `broker-launch.mts:78` (`let inFlight = false;`), `:373-378` (`if (inFlight) return null; inFlight = true; … inFlight = false;`), `:452` (the waiter path logging which reason holds the slot).

**The Ghidra hazard has the same shape and three worse properties:**

| | VICE launch | Ghidra analysis |
|---|---|---|
| duration of the critical section | ~seconds (launch + `probeReady`) | **minutes** |
| what a second entrant does | launches a duplicate emulator | corrupts or deletes a project directory mid-write |
| observable on failure | extra process, detectable | a short export that looks complete |
| existing guard | `inFlight`, tested | **none** |

So the guard this milestone needs is the same *mechanism* — a synchronous check-and-set with no `await` between, keyed on the project directory — with a much longer hold time, which means it also needs the things `inFlight` did not: a recorded holder identity, a stale-holder timeout, and a "who holds it and why" answer for the waiter (which `inFlightReason` at `:88` already models).

**Two further hazards on the same surface:**

1. **PID reuse on kill.** A multi-minute JVM that must be killed on lease loss is a much bigger PID-reuse window than a fast emulator launch. This project already has the right answer — `verifiedKill()` checks identity before killing — and the Ghidra subsystem must reuse it rather than `kill(pid)`.
2. **The broker's process fate is shared.** READ-IN-SOURCE via the `host-tool-executor` seed: `broker-kill.mts:367-374` registers `uncaughtException`/`unhandledRejection` handlers that log and then take the **kill-and-exit** path. Correct for a supervisor — never orphan emulators — but it means *any* unhandled throw anywhere in the broker process **tears down the entire VICE pool**. Running Ghidra inline makes every live emulator hostage to a JVM wrapper bug. The seed's answer stands and is non-negotiable: host-tool work runs in a **child process, never the broker's own**, and a failure there is a failed response frame, not a broker fault.

**And the lease model does not fit.** The seed states *"the connection itself IS the lease"* — connection close is the release, including on the client's own `SIGKILL`. For a short open/send/close host-tool call that is exactly right. For a multi-minute Ghidra run it means a client that dies mid-analysis releases the lease while the JVM keeps running and keeps writing to the project directory. **Either the JVM's lifetime is bound to the connection (kill on close, which throws away a multi-minute run on a transient disconnect) or it is not (which orphans a writer).** Neither is free; the choice must be recorded, not defaulted into.

**How to avoid:**
- One project directory **per run**, named by a run id, with `-deleteProject`. Concurrency then needs no lock at all — which is strictly better than a lock, and is what Phase 23 already did by accident.
- If a persistent project is later wanted (incremental re-analysis), *then* the single-owner guard becomes necessary, and it should be built by copying `inFlight`'s shape rather than re-deriving a lighter version — the same instruction the Standing Constraint gives for session lifecycle.
- Bind the JVM's lifetime explicitly and write the decision down.

**Warning signs:**
- A shared project directory path with a run-independent name.
- `await` between the guard's read and its write. (This is the specific thing the existing regression test protects; a new guard needs its own.)
- `kill(pid)` anywhere in the Ghidra path.
- Any JVM spawn in the broker's own process.
- Timeouts: `VICE_MCP_TIMEOUT_MS` defaults to **30000** and `.mcp.json` sets the server timeout to **150000** (READ-IN-SOURCE). A Ghidra run on a 64K image exceeds the first and can approach the second. A multi-minute operation reached through a millisecond-tuned transport is a timeout defect waiting to be diagnosed as a wedge.

**Phase to address:** the Ghidra execution-seam decision (precondition to the two-engines phase).

---

### Pitfall 22: The narrowest-range-wins `memmap.json` join, and the three ways it fails silently

The base hazard is a Standing Constraint with controls already specified in Phase 26's criteria 2, 3 and 4. **What to add — three sharpenings, each of which the existing criteria do not quite cover:**

1. **The tie-break is load-bearing and untested in the criteria.** The rule is "smallest containing range, breaking ties toward the entry carrying a `sym`." The `$D020` control proves smallest-wins against the 4096-byte I/O entry. It does **not** prove the tie-break, because `$D020` has no tie. A separate control needs an address where two entries of *equal* width contend, one with a `sym` and one without, and must go red if the tie-break is reversed. Without it, "ties resolve toward `sym`" is an assertion.
2. **`memmapSha256` is the join's real input and must be in the reproducibility key.** RECALLED from this project's own record: `memmap.json` (959 entries, 4 published sources) is already pinned by `memmapSha256` upstream of the enum path. After the pivot it *moves from a skill an agent invokes to a data source a pipeline stage joins against* — so a `memmap.json` edit silently changes every annotation the pipeline has ever produced, with no signal. The annotation rows must record the `memmapSha256` they were derived under, and a re-run under a different digest must be a **detectable re-derivation**, not an invisible overwrite.
3. **"Decline where bank state is path-dependent" needs a *positive* control, and there is currently no evidence about where the line is.** MEASURED absence: `AUTO-04`/`AUTO-05` are **unvalidated rather than narrowed** — rule `R1` fired first under first-match-wins, so `R7`'s pre-mapped narrowing was never evaluated, and Phase 23's criterion 3 was `could-not-run`. *Nothing is known about where a single forward-carried `$01` value stops being correct, in either direction.* The `bank.a` fixture sets `$01` from immediate literals in straight-line code; real code computes it, or sets it inside a routine reached from several banking contexts. So the control cannot be "the join declines on the fixture" — the fixture has no path-dependent site. It must be: a **committed synthetic program with a genuine path-dependent `$01`** (one routine, two callers, two bank states), on which the join is observed to **decline and say why**, and which goes red if the decline is replaced by a forward-carried value. Build that fixture; do not wait for a real release to supply one.

**Warning signs:** an annotation row with no `memmapSha256`; a decline count of zero on a real release; a tie-break with no test.

**Phase to address:** the auto-annotation phase (Phase 26's text), with the path-dependence fixture as its own early task.

---

### Pitfall 23: Asserting the fix instead of observing a control go red — enumerated for this milestone specifically

This project's stated position, and it has been taught the general form **six times** (Phase 2's green suites hiding 7 defects; Phase 3's fixtures stubbing the code's own assumption; Phase 4's independently-derived opcode table still shipping 14 wrong entries; Phase 5's registry unable to defend against a wrong bank address; Phase 8.1's one unwitnessed claim being *falsified* when run; Phase 13's four wire details, one refuted outright). Plus the sharper form: **twice in v0.4.0 a closure plan re-read its own premise and found it false.**

**This document adds a seventh instance, measured this session:** the roadmap's note that the SLEIGH source *"already exists in full … this phase integrates and verifies it; it does not write it"* is a stale premise, restated confidently across at least three planning artifacts, and it is false as a compile claim (Pitfall 14). That is the same defect class one level up, and it was found by *running* the thing rather than reading about it.

**The full list of this milestone's criteria that are worthless as assertions and need a red observation.** Every row is a silent failure mode; the "control" column is what must be *observed*, not written:

| criterion subject | control that must be observed red |
|---|---|
| RAM-init determinism (new) | two cold boots without `-seed` differ; with it, zero differ |
| reproducible-run protocol (new) | the protocol without the reset step produces differing stop phases |
| capture equivalence oracle (new) | a byte planted outside the transient allow-list fails the comparison |
| `default_memspace` (new) | the memspace assertion refuses after a drive checkpoint hit |
| warp-safe waits (new) | the wall-clock-tuned bracket times out spuriously under warp |
| SLEIGH compile (new) | reverting one sized-local fix reddens the compile gate |
| SLEIGH language selection (new) | the acceptance run under `6502:LE:16:default` fails the 105-byte assertion |
| Ghidra harness log check | a wrong expected count fires `ERROR REPORT SCRIPT ERROR` while exit is 0 |
| volatile I/O carve | hardware writes disappear from the reference dump — **on both import routes** |
| `DataTypeManager` vs `DecompInterface` | the `DataTypeManager` route returns essentially nothing, on the same image |
| dxa listing parser refusal | a **real** unknown listing form provokes the refusal |
| narrowest-range-wins | `$D020` annotates as the 1-byte entry; first-match or longest-description reddens it |
| the tie-break (new) | equal-width contenders resolve toward `sym`; reversing it reddens |
| in-image skip | removing the image-range check reddens |
| bank-before-address | the `$01` decode bypass reddens the `$34`/`$33` flip |
| path-dependent decline (new) | a forward-carried value replaces the decline and reddens |
| graphics feedback | phantom labels present before the feedback, absent after |
| 64 KiB cap (new) | an inline >64 KiB return produces a bare disconnect with no error frame |

**How to avoid:** for each row, the plan's task list contains a *task whose deliverable is the red transcript*, separate from the task that implements the fix, and the red transcript is committed. This project already does this well; the risk is scale — eighteen rows is a lot of red observations, and the temptation to batch them into "the controls are in place" is exactly the failure.

**Warning signs:** a criterion whose verification sentence contains "is present", "is set", "is configured" or "is marked"; a phase closing with a controls count but no transcripts; a control that has never been observed failing.

**Phase to address:** every phase. It belongs in each phase's success criteria, not in a separate quality phase.

---

### Pitfall 24: Line-number citations drifting, in citations nothing guards

**What goes wrong:**
This milestone will produce a great many new source citations — `broker-control.mts:242`, `broker-launch.mts:153`, `monitor.c:3393-3396`, `NamingUtilities.java:108` — in planning documents, notes and skill playbooks. They drift. A future reader treats a mismatch as evidence the constraint changed.

**READ-IN-SOURCE, and this is the part worth knowing:** `docs-linerefs.test.ts` guards a **very narrow** subject. It scans exactly two documents (`CLAUDE.md`, `.planning/PROJECT.md`), finds the single bullet mentioning `rewriteArguments()`, and pins citations matching `/vice-proxy\.ts:(\d+)/g` in that bullet. **Every other line citation in every other document is unguarded.** And the guard's own history is a warning: it read only `CLAUDE.md` and not `PROJECT.md` until the v0.7.0 open, during which PROJECT.md's copy was stale at four different figures.

**Verified current this session** (so the drift is not already present): `rewriteArguments` at `vice-proxy.ts:3050`, `forwardToVice` at `:2985`, `gatherWedgeEvidence`'s call at `:1529`, the function at `:1505` — all four matching CLAUDE.md. `MAX_LINE_BYTES = 65536` at `broker-control.mts:242`. `buildViceArgs(` at `broker-launch.mts:153`. All good today.

**How to avoid:**
- Prefer a **symbol name** to a line number wherever the citation's purpose is "find this code" — `buildViceArgs()` in `broker-launch.mts` is greppable and stable; `broker-launch.mts:153` is not.
- Where a line number genuinely carries information (a specific statement in a large function), extend `docs-linerefs.test.ts`'s pattern rather than adding an unguarded citation. Its structure — a document list, a bullet selector, a citation regex — generalises; the cost is one regex per cited file.
- **Do not cite line numbers in the Ghidra or VICE upstream source** without also recording the version. `NamingUtilities.java:108` is a Ghidra 12.1.3 fact and will move.

**Warning signs:** a new `foo.ts:NNN` citation in a planning document with no corresponding guard entry; a citation to a file outside this repo with no version; a mismatch discovered during a phase and "fixed" by editing the number without checking whether the constraint still holds.

**Phase to address:** every phase; the guard extension itself belongs to whichever phase first adds a citation it wants pinned.

---

### Pitfall 25: The closed consumer set is **structurally blind** to a new module prefix

**What goes wrong:**
A new `ghidra-*.ts` or `dxa-*.ts` family translates host paths — it must, because the project directory, the script path, the image and the export all cross the boundary (Pitfall 19). It becomes a new consumer of `hostpath.ts`. The "closed consumer set" discipline is supposed to catch that. **It does not**, because the guard's scan is scoped to a prefix the new family does not carry.

**READ-IN-SOURCE.** `hostpath-consumers.test.ts` opens with *"node:test coverage of the CLOSED consumer set for host-path logic"* and asserts *"hostpath.ts's production consumer set is exactly the five declared modules"* over a `readdirSync`-derived module set. Its non-vacuity floor is `const ANNO_MODULE_FLOOR = 16 + 1;` — **pinned deliberately, and pinned over the `anno-*` prefix**, with a long comment explaining that *"THE FLOOR MUST NEVER BE DERIVED FROM DISK."*

Two consequences, both silent:

1. A new module family with a **different prefix** is outside the floor's scan entirely. The floor asserts ≥17 `anno-*.ts` production modules exist; adding forty `ghidra-*.ts` modules does not move it, and does not trip it.
2. The "exactly five declared modules" assertion *will* fire if the new family imports `hostpath.ts` — which is the guard working. But the natural repair when it fires is to **add the new module to the declared list**, which converts a closed set into an open one, one entry at a time. That is the mechanism by which the discipline decays.

And ROADMAP.md's own Standing Constraint names the general form: *"A guard 'repaired' by lowering its floor becomes permanently green, and its subject becomes undefended. … **If you cannot make it fail, you have not re-pointed it.**"* It lists `hostpath-consumers.test.ts` (`ANNO_MODULE_FLOOR`) as having exactly this shape.

**How to avoid:**
- Prefer **not to become a consumer**. The `anno_*` family's precedent is the model: it registers proxy-locally via `buildViceTool()` and never reaches `forwardToVice()`, so CLAUDE.md's derived-tool constraint is satisfied *by construction* rather than by an interception. The Ghidra path translation should live in **one** new module that is a declared consumer, with the rest of the family reaching it through that module — turning "N new consumers" into "one".
- When the new family is added, **add a second floor for its prefix**, derived deliberately and pinned as a literal, with a real unclassified-module positive control created on disk (the technique Phase 27's `SEAM-02` used: *a **real** unclassified `anno-*.ts` was created on disk and Direction 1 went red naming it*).
- The repair when the "exactly five" assertion fires is a **decision recorded in the plan**, not an edit to a list.

**Warning signs:**
- A commit adding a module to the declared consumer list with no accompanying rationale.
- A new module-prefix family with no floor of its own.
- `ANNO_MODULE_FLOOR` unchanged across a milestone that added a new module family (correct in itself — but it should be accompanied by a *new* floor, and its absence is the signal).

**Phase to address:** the Ghidra execution-seam decision, as part of the seam's design; the floor addition belongs to the same phase.

---

### Pitfall 26: Generated-but-committed artifacts, now with two new generators

**What goes wrong:**
A new host-side launcher is authored as `.mts`, and either (a) it is never added to `build.ts`'s asserted output set, so the compiled `.mjs` is missing from `resources/` and the host cannot run it, or (b) it is added and the committed `.mjs` drifts from its source.

**READ-IN-SOURCE.** `resources-sync.test.ts` asserts `resources/` is **byte-identical to a fresh build of its TypeScript source**, and fails in both directions: a committed file that differs, and a committed file that is *missing* while a fresh build produces it (`assert.fail("committed resources/${rel} is missing but a fresh build produces it -- rebuild and commit")`). `build.ts` additionally *"asserts the emitted file set exactly matches"* its expected list. So the machinery is good — and the failure mode is **forgetting to author the host half as `.mts` at all**, which no guard covers because a plain `.mjs` written by hand is indistinguishable from a compiled one except by the banner.

**This milestone adds two new generated-artifact classes with no existing guard:**

1. **The compiled SLEIGH `.sla`.** It is generated from committed `.slaspec`/`.sinc` sources by a Ghidra-version-specific compiler. Committing it makes the tree self-contained and makes it drift; not committing it makes every run depend on a `sleigh` invocation. **Recommendation: do not commit the `.sla`.** Build it, and guard the build (Pitfall 15) — because a committed `.sla` is a binary blob whose staleness is undetectable by review, and its correctness is tied to a Ghidra version the repo does not control.
2. **The Ghidra pre/post scripts.** Phase 23's `FlatVolatile.java` and `ExportAnalysis23.java` currently live under `.planning/phases/23-…/evidence/` and are cited by sha256 in the evidence file. Moving them to `src/` makes them shipped code that must be reachable from `-scriptPath` **after** package installation and **after** path translation. A script that exists in the repo and not in the tarball fails only for users — and this project already has the Standing Constraint for exactly that blind spot: **`installer/skills/` is gitignored yet shipped, so any gate implemented over tracked files is structurally blind to what users actually receive.** `git ls-files installer/skills` returns 0 and that tree ships. A `-scriptPath` gate written over `git ls-files` would be green while the shipped copy has no scripts.

**How to avoid:**
- Any host-bound launcher is authored `.mts` and added to `build.ts`'s asserted set **in the same commit**.
- The `.sla` is built, not committed, and the build's exit code is checked.
- Any gate whose subject is *what a user gets* reads the **`npm pack` file list**, via the existing `scripts/check-npm-packages.mjs` seam — never `git ls-files`. Add the Ghidra scripts to that validator's expected file set.

**Warning signs:** a hand-written `.mjs` under `resources/` without the generated banner; a `.sla` in `git status`; a `-scriptPath` that resolves in the repo and not in a `npm pack` extraction; a new shipped file absent from `check-npm-packages.mjs`'s expectations.

**Phase to address:** the Ghidra execution-seam decision (script placement and packaging); the two-engines phase (the `.sla` build).

---

### Pitfall 27: The pre-committed gate, re-used — two ways it becomes theatre

The milestone deliberately reuses the Phase 23 pattern: rules committed to git **before** any measurement, no judgement step, and the authority to narrow every phase after it. That pattern worked — it fired `no-go` for real, and this project's own Key Decisions record honouring the verdict rather than overriding it, because *"overriding it would have made every future gate advisory."*

**Two failure modes, both observed on Phase 23 itself:**

1. **First-match-wins ordering silently discards the narrowings.** MEASURED: `R1` matched on `c0_corpus: partial`, the derivation stopped there, and six of seven criteria were never evaluated. `R6` and `R7` carried the pre-mapped per-requirement narrowings; `R1` carries none. Net effect: `AUTO-04`/`AUTO-05` came out **unvalidated rather than narrowed** — the gate produced a verdict but not the scope guidance it was designed to produce. **Prevention:** either evaluate *all* rules and combine, or order the rules so the ones carrying narrowings are evaluated even when a milestone-level rule fires. Rule ordering is a design decision with consequences, not a formality.
2. **A rule input whose value domain is wrong makes the rule unwritable.** MEASURED, from `instrument-provenance.txt`: the planned verify script grepped for `DXA_TARBALL_SHA256_VERIFIED: pass` where the schema's domain for that field is `yes`/`no`, and the check had to be corrected to `: yes`. Small, and it is the shape of the problem: a gate is a program, and its inputs need declared domains checked mechanically.

**A third, specific to this milestone:** the gate's `go` inputs should include the things that are measurable **before** any corpus exists — the reset protocol's jitter-immunity and the seed's effect (Pitfalls 1 and 4 are both measurable today, on a synthetic boot). A gate whose every input requires a corpus can only ever produce `could-not-run`, which is how the last one ended.

**Warning signs:** a decision rule with no declared input domains; a rule list where the narrowing rules sit after a milestone-level rule under first-match-wins; every gate input requiring a real release.

**Phase to address:** the frame-exact-stop gate phase (~33) — the gate's own design.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Take captures from an acquired warm instance, skip the reset | No protocol work; the existing acquire path just works | Every capture is unreproducible and the reason is invisible; ~6.7M cycles of phase noise (MEASURED) | **Never.** It voids the milestone's first requirement |
| Tolerate a whole page (`$00xx`, `$01xx`) in the capture comparison | The comparison passes today | Swallows genuine divergence including cracker patches — the exact class `c64-provenance-diff` exists to find; honest set is 3 addresses of 1024 (MEASURED) | **Never** as a range. Enumerate |
| Commit the compiled `.sla` | Self-contained tree, no `sleigh` in CI | Staleness is invisible to review and tied to a Ghidra version the repo does not pin | Only with an mtime/digest guard against every input spec |
| Return the Ghidra export inline and "handle large ones later" | One less path translation | First real image produces a bare socket disconnect indistinguishable from a wedge (READ-IN-SOURCE, cap at `broker-control.mts:242`) | **Never.** The cap is 64 KiB; the measured export is 721 KB |
| Run the JVM in the broker's own process | No child-process plumbing | Any unhandled throw takes down the whole VICE pool via `broker-kill.mts`'s exit path (READ-IN-SOURCE) | **Never** |
| Add the new module family to the declared hostpath consumer list | The red guard goes green in one line | Converts a closed set into an open one, one entry per milestone | Only as a recorded decision with a new prefix floor added in the same commit |
| Quote the pivot's `72.46%` / `0 FP` as a baseline | A number to plan against | It does not reproduce, and the error is flattering to the tool at the headline (MEASURED) | Only printed **beside** the source-derived `72.39` / `3` with RC-1 attached |
| Treat `OPC-01..03` as integration-only | Smaller phase | The source does not compile; eight errors, all on the declared-unknown instructions (MEASURED) | **Never**, now that this is measured |
| Reuse `-processor 6502:LE:16:default` because Phase 23 proved it works | No `.ldefs` work | The extension is inert and every run reports success (MEASURED: only two language ids exist) | **Never** |
| `try`/`catch` around the volatile carve so the run "degrades gracefully" | Fewer failed runs | Silent fallback to non-volatile; the decompiler deletes every hardware write | **Never** |
| Skip the path-dependent-`$01` fixture and wait for a real release to supply one | Less fixture work | Nothing is known about where the model breaks, in either direction (MEASURED absence); the decline path stays untested | **Never** — build the synthetic two-caller fixture |
| Grep the Ghidra run log for `error`/`fail` | One-line check | False-fires on the flat-64K route's `Failed to add language defined memory block` INFO lines (MEASURED) | **Never.** Anchor on `ERROR REPORT SCRIPT ERROR` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stock VICE launch | No determinism flags; `VICE_ARGS` used as an "add a flag" knob | `-seed <fixed>` after `-default`; record the argv digest + binary sha256 + seed as the reproducibility key. `VICE_ARGS` is a **full override** (READ-IN-SOURCE `broker-launch.mts:163`) |
| Broker acquire | Accept whatever the warm floor hands out | Take the machine from a monitor-issued hard reset as the run's first act, or make launch mode part of warm-instance eligibility. **Never** silently downgrade the caller |
| Stock text monitor | Reaching for it. It is where `stopwatch` and runtime `warp on`/`off` live — and **both are OWNER-EXCLUDED (2026-09-02)**, along with the text-monitor client itself | Do not dial it this milestone. The port is still allocated and still unused (READ-IN-SOURCE `broker-launch.mjs:165`, `broker-state.mts:139`); leave it that way. Frame index comes from `hit_count`, warp from `-warp` at launch |
| Binary monitor `REGISTERS_GET` (0x31) | Assume `LIN`/`CYC` are unavailable, or that absolute cycles are | `LIN`/`CYC` **are** returned (READ-IN-SOURCE `docs/phase0-binmon-findings.md` §1). Absolute cycles are **not**, on 3.9 — `CPUHISTORY_GET` (0x86)'s uint64 clock needs ≥ 3.10. Do not reconstruct one; phase 0 dropped that route and a measured 19,657-vs-19,656 per-frame discrepancy says why |
| Binary monitor + drive | Set a drive checkpoint in an instance later used for capture | Assert main-CPU memspace after reset; treat contamination as unrecoverable and recycle |
| `analyzeHeadless` | Trust the exit code | Check exit **and** grep the exact literal `ERROR REPORT SCRIPT ERROR` **and** assert a positive printed self-check |
| `analyzeHeadless` project dir | Place it under `.planning/`, `.cache/`, `.vice-supervisor/` | No dot-prefixed path element (MEASURED abort). One seam owns the location; `-deleteProject`; one dir per run id |
| `support/sleigh` | Ignore the exit code | Exit 2 on failure with **no** `.sla` written, while the stock `6502.sla` remains in place (MEASURED). Check exit, existence, and mtime-vs-inputs |
| Ghidra language selection | `-processor 6502:LE:16:default` | A new `<language>` element in an `.ldefs` with a new `id`, and the `-processor` change in the **same commit**. Assert on the language the log says it used |
| Ghidra structural export | `DataTypeManager.getAllComposites()` / `getDefinedData()` | `DecompInterface`, with per-function attempted/decompiled/timedOut accounting and a committed timeout ceiling |
| Broker control channel | Return bulk output inline | Write host-side, return path + sha256 + length; the container reads through `containerpath.ts` |
| Broker control channel | Reuse the connection-is-the-lease model for a multi-minute run | Decide and record the JVM lifetime binding explicitly; run in a child process, never the broker's own |
| Broker control channel | A generic run-host-command op | Typed allowlist per named tool; the executor constructs the argv (the `DENY_LIST` discipline) |
| Broker control channel | Skill scripts do not read the capability token today | Token discovery from a container-side skill script is its own design problem — solve it in the seam, once |
| Skill scripts | `spawnSync` an external binary | Everything goes through the container-out seam; two known-broken paths already exist (`acme.mjs`, `packer-finding.mjs`) |
| dxa | Ask it about banking, VIC, sprites, charsets | Discovery engine only: zero `bank` matches in 3,417 lines, eight lines of C64 knowledge, no machine-readable output (this project's own check) |
| `memmap.json` | Flat, first-match lookup | Bank-parameterised, narrowest-range-wins, `sym` tie-break, in-image skip, decline on path-dependence; record `memmapSha256` on every derived row |
| `.vsf` snapshot extraction | Compare a snapshot-derived image against a `vice_memory_read` transcript byte-for-byte | `$0000`/`$0001` differ systematically — the snapshot holds RAM under the processor port. Normalise, do not tolerate |
| Package validation | Gate over `git ls-files` | Gate over the `npm pack` file list (`scripts/check-npm-packages.mjs`); `installer/skills/` is gitignored yet shipped |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Real-time emulation for corpus sweeps | Multi-minute captures; sweeps become impractical | Launch-time `-warp`. MEASURED behaviour-neutral (identical raster line, raster cycle and absolute cycle with and without it). Runtime `warp on` is **OWNER-EXCLUDED**, so this is a per-instance choice | Immediately, at >1 release |
| Wall-clock waits under warp | Spurious timeouts, or waits that pass by luck | Brackets over `hit_count` on a once-per-frame anchor (`STOPWATCH` brackets are **OWNER-EXCLUDED**); wall clock as backstop only | The first warped run. The mid-bracket variant is now unreachable, since runtime warp toggling is excluded — warp is fixed for an instance's lifetime |
| Inline bulk transport | Bare socket disconnect, no error frame | Path + digest, never payload | At 64 KiB. Measured export: 721,030 bytes on a *synthetic* 64K image |
| Whole-image classification export uncompressed | Large files everywhere; slow reads | Store compressed — Phase 23's own note says so | ~721 KB per 64K image, before per-function C |
| Per-function decompilation on a real release | Runs stretch to many minutes; timeouts appear | Timeout ceiling + attempted/decompiled/timedOut accounting; phantom functions inside graphics data multiply the count | The first real release; worsens as false-positive code regions grow |
| Non-stopping checkpoint on a hot address | Emulator thread stalls | Already a settled constraint: `CHECKPOINT_INFO` is emitted per hit synchronously from inside the CPU loop. Poll `hit_count`, never paused state | Any hot address |
| Synchronous host-tool spawn in the broker | Acquires, warm floor and monitor claims all stall | Async spawn, child process | Any run longer than an acquire timeout |
| `CPUHISTORY_GET` count ≥ 65536 | Silent wrap (uint32 read into uint16) | Clamp client-side to 65535 (settled constraint) | 65536 |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| A generic "run host command" op on the control channel | Remote code execution on the host, reachable from anything on the local segment (the listener binds `0.0.0.0` by accepted decision, token-gated) | Typed allowlist per named tool; the executor constructs argv; one checked seam, the `DENY_LIST` pattern |
| Passing a caller-supplied path straight to `analyzeHeadless` | Arbitrary host file read/write under the broker's uid | Validate against the workspace root (`PathOutOfWorkspaceError` already exists); translate through the one seam |
| Ghidra project directory left behind | Analysis artifacts of a user's binaries persist outside the workspace | `-deleteProject` on every run; one dir per run id under a controlled root |
| Capability token read by skill scripts from a new location | Token sprawl; a token in a log or an error message | Discovery through one seam; never logged, never in an error message (the existing rule) |
| A JVM child that outlives its lease | An orphaned writer with the broker's privileges | `verifiedKill()` by identity, never `kill(pid)`; PID reuse window is minutes here, not seconds |
| Executing untrusted `.slaspec`/script content | SLEIGH and Ghidra scripts are code | Only committed, reviewed scripts reach `-scriptPath`/`-preScript`/`-postScript`; never a caller-supplied script name |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| A pipeline that reports success on a wrong answer | The user builds on confident wrong comments the next pass treats as established | Decline with a stated reason. The join's containment is `AUTO-07`, not a review step |
| A capture comparison reporting "equivalent" over a tolerated real difference | A cracker's patch is silently classified as original | Enumerated allow-list; planted-byte control outside it |
| A phantom label indistinguishable in form from a genuine one | The user cannot tell derived-and-wrong from derived-and-right | Provenance on every row: which engine, which `memmapSha256`, which bank state, which confidence |
| A shipped verb claiming verification it does not perform | Trust in every other claim erodes | The `anno export-asm` precedent: say in the verb's own output what it did **not** do |
| A skill playbook naming a route that needs a host tool the user does not have | Dead-end mid-task | Name the prerequisite at the point of use, the `SKILL-01` pattern; and Ghidra + a pinned dxa build are heavier prerequisites than ACME |
| A multi-minute Ghidra run with no progress signal | Indistinguishable from a wedge, on a project whose whole triage machinery is about telling those apart | Progress frames or a documented expected duration; and a `vice-wedge-triage` note that Ghidra runs are not VICE wedges |

---

## "Looks Done But Isn't" Checklist

- [ ] **Frame-exact stop:** often missing the **seed pin** — verify two cold boots without `-seed` differ over a never-written window and with it differ by exactly zero
- [ ] **Frame-exact stop:** often missing the **reset step**, because it works on a fresh cold launch and fails on a warm one — verify with deliberate pre-protocol jitter (0 / 1500 / 4000 ms) and identical `(PC, hit_count, (LIN, CYC))`
- [ ] **Frame-exact stop:** often verified on the **PC alone** — verify `hit_count`, `LIN` and `CYC` are in the capture record and compared, all three from the binary monitor
- [ ] **Frame-exact stop:** often missing the **frame-anchor checkpoint** — verify `hit_count` comes from a once-per-frame site, or the triple silently degrades to `(PC, (LIN, CYC))`, which is blind to frame index
- [ ] **Capture equivalence:** often missing the **planted-byte-outside-the-list** control — verify it fails
- [ ] **Capture equivalence:** often missing the **`$0000`/`$0001` normalisation** — verify the snapshot-vs-CPU-view overlay is explained in code, not in the tolerance set
- [ ] **Capture equivalence:** often missing the **allow-list size cap** — verify the cap is asserted
- [ ] **Warp:** often missing the **cycle-bracket rewrite** of the waits — verify the wall-clock-tuned bracket was observed timing out under warp
- [ ] **`default_memspace`:** often missing the **post-reset memspace assertion** — verify it refuses after a drive checkpoint hit
- [ ] **dxa integration:** often missing the **ground-truth partition derivation committed before the run** — verify it is a script, not prose
- [ ] **dxa integration:** often missing the **denominator** beside every rate — verify `72.39 (97/134)` shape, not `72%`
- [ ] **dxa integration:** often missing a **refusal provoked by a real unknown listing form** — verify a hand-planted malformed line is not the only case
- [ ] **dxa integration:** often missing the **overlapping-decode refusal** — verify `jsr` into mid-instruction yields unclassified, not a winner
- [ ] **Ghidra harness:** often missing the **`ERROR REPORT SCRIPT ERROR` grep** — verify it was observed firing on an exit-0 run
- [ ] **Ghidra harness:** often missing the **block-total (not image-size) count** — verify on both `.prg` and flat-64K routes
- [ ] **Ghidra harness:** often missing the **volatile carve on the flat-64K route** — verify the reference dump shows both consecutive `$D020` writes surviving, on that route
- [ ] **Ghidra harness:** often missing **per-function decompile accounting** — verify `attempted == decompiled + timedOut` and a timeout ceiling
- [ ] **Ghidra harness:** often missing the **`DataTypeManager` control on the same image** as the acceptance run
- [ ] **Ghidra harness:** often missing the **no-dot project-path refusal in code** — verify a dot-prefixed candidate is rejected before `analyzeHeadless` sees it
- [ ] **SLEIGH:** often missing the **compile gate** — verify `sleigh` exit 0, `.sla` produced, mtime newer than every input
- [ ] **SLEIGH:** often missing the **`.ldefs` entry and the matching `-processor` change** — verify the acceptance run under `6502:LE:16:default` **fails**
- [ ] **SLEIGH:** often missing the **`65C02` non-collision check in the same installation** — verify the shared bytes still read as 65C02 meanings
- [ ] **SLEIGH:** often missing the **declared-unknown check in the output** — verify `XAA` `$8b`, immediate `LAX`/`LXA` `$ab` and `AHX`/`TAS`/`SHX`/`SHY` render as opaque userops, not plausible p-code
- [ ] **Ghidra execution seam:** often missing the **>64 KiB inline refusal observation** — verify the bare disconnect was seen
- [ ] **Ghidra execution seam:** often missing the **single-owner guard on the project directory** — or better, verify one directory per run id makes it unnecessary
- [ ] **Ghidra execution seam:** often missing the **JVM lifetime binding decision** — verify it is written down, either way
- [ ] **Ghidra execution seam:** often missing the **scripts in the `npm pack` file list** — verify against the tarball, never `git ls-files`
- [ ] **Auto-annotation:** often missing the **tie-break control** (equal-width contenders, `sym` wins)
- [ ] **Auto-annotation:** often missing **`memmapSha256` on every derived row**
- [ ] **Auto-annotation:** often missing the **path-dependent-`$01` fixture** — verify the decline is observed and that a forward-carried value reddens it
- [ ] **Auto-annotation:** often missing the **graphics-feedback before/after** — verify phantom labels present before and absent after
- [ ] **New module family:** often missing its **own non-vacuity floor** — verify a real unclassified module created on disk turns it red

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Captures taken without a pinned seed | LOW | Add the flag, re-capture. Cheap because captures are reproducible by construction once the protocol exists |
| Captures taken from a warm instance | LOW | Same — re-capture under the protocol. Void the old captures explicitly (the `vice-wedge-triage` void-a-run pattern) rather than reinterpreting them |
| An over-wide tolerance allow-list already used to pass a comparison | MEDIUM | Re-derive the union from N runs; re-run every comparison; **treat every prior "equivalent" verdict as unverified**, not as confirmed |
| Annotations written under a wrong `memmap.json` join | MEDIUM | Recoverable *only if* rows carry `memmapSha256` and the engine that wrote them. Without provenance this is a full re-derivation, and stale rows are indistinguishable from fresh ones — which is why the provenance field is not optional |
| Annotations written from phantom labels | HIGH | The store's revert covers a single edit, not a pass. Recovery means identifying every row derived from a range the graphics map now says is data — feasible with provenance, archaeology without it |
| SLEIGH extension shipped inert (no `.ldefs`) | LOW | Add the language, change `-processor`, re-run. Every export produced before must be **re-run**, not re-read: illegal opcodes decoded as bad bytes desynchronise the decode, so the error is not localised |
| Volatile carve silently failed on one route | MEDIUM | Re-run; and re-run everything downstream, since deleted hardware writes propagate into the structural export and the join |
| Ghidra project directory corrupted by concurrent runs | LOW | `-deleteProject` + one dir per run id makes this unreachable. If it happened, discard and re-run |
| A guard repaired by lowering its floor | MEDIUM | Re-point the glob, **raise** the floor to the measured new count, replace the positive control with real new names, and **re-run the planted violation against the new subject.** If you cannot make it fail, you have not re-pointed it |
| A stale premise restated confidently in planning documents | LOW, if caught | Correct at source, keep the dated record of what was believed and why it was wrong — this project's own convention, and the reason the SLEIGH finding above is expressible at all |

---

## Pitfall-to-Phase Mapping

Phase numbers start at **33** this milestone; 24 and 26 stay retired while their requirement text carries forward. Rows below name the phase by content with a suggested number.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Host-clock-seeded RAM init | ~33 The Frame-Exact Stop (gate) | Two cold boots, no `-seed`: differing > 0. With `-seed`: differing == 0 |
| 2. Reproducibility keyed on the seed alone | ~33 | Capture record carries argv digest + binary sha256 + seed; two runs with reordered argv are refused as incomparable |
| 3. Frame-exactness on a warm instance | ~33 | The protocol without the reset step produces differing stop phases; with it, identical under 0/1500/4000 ms jitter |
| 4. "The emulator is nondeterministic" | ~33 | The protocol's jitter-immunity measured, and recorded as a `go` input of the gate |
| 5. Instruction- vs frame- vs cycle-exact | ~33 | `(PC, hit_count, (LIN, CYC))` present in the record and compared, all binary-monitor sourced; a frame anchor set; a PC-only assertion shown to pass on three different frames; a `(LIN, CYC)`-only assertion shown to pass on two stops one frame apart |
| 6. Range-shaped tolerance allow-list | ~33 | Planted byte outside the list fails; inside passes; list size under a committed cap |
| 7. `default_memspace` via the drive | ~33 | Memspace assertion refuses after a drive checkpoint hit; passes clean |
| 8. Warp assumed behaviour-changing; wall-clock waits | ~33 (plus promote the existing headless/warp todo here) | Warp-vs-no-warp stop identity measured; the wall-clock bracket observed timing out under warp |
| 27. Gate design (rule ordering, input domains) | ~33 | Rules and input domains committed to git before any measurement; all narrowing rules reachable |
| — Snapshot `.vsf` extraction (`C64MEM` slice) | ~33 | 65536-byte image, stable sha256, `$0000`/`$0001` overlay normalised in code |
| 19. Dot-prefixed project path; four boundary paths | ~34 The Ghidra Execution Seam | Dot-prefixed candidate refused locally, before `analyzeHeadless`; four translation calls enumerated by a test |
| 20. 64 KiB cap vs megabyte export | ~34 | Inline >64 KiB attempt observed producing a bare disconnect; path+digest route works |
| 21. Concurrency / lease / PID reuse / broker process fate | ~34 | One project dir per run id; JVM in a child process; `verifiedKill()` by identity; lifetime binding recorded |
| 25. Closed consumer set blind to a new prefix | ~34 | New prefix floor added and observed red against a real unclassified module on disk |
| 26. Generated-but-committed; shipped-vs-tracked | ~34 | Scripts present in the `npm pack` file list; any `.mts` in `build.ts`'s asserted set |
| 9. Accepting a published benchmark | ~35 The Two Engines (Phase 24's text) | Partition derivation committed as a script before the run; re-measured figures printed beside published ones with RC-1 |
| 10. 6502 constructs / data-called-code | ~35 (parser, refusal) + ~36 (feedback) | Refusal provoked by a real unknown listing form; overlapping decode → unclassified; dxa code total ≤ runtime inventory |
| 11. `analyzeHeadless` exit 0; log-grep false fire | ~35 | `ERROR REPORT SCRIPT ERROR` observed firing on an exit-0 run; the flat-64K INFO lines shown not to redden |
| 12. Block total vs image size | ~35 | Script computes and prints the expectation; asserted on both routes |
| 13. `MemoryConflictException` → non-volatile fallback | ~35 | Volatile removed → hardware writes disappear from the reference dump, **on both routes** |
| 14. SLEIGH source does not compile | ~35 (earliest task) | `sleigh` exit 0, `.sla` produced; reverting one sized-local fix reddens the gate |
| 15. Failed compile leaves the stock `.sla` | ~35 | Exit code + existence + mtime checked; extension emitted as a new language, never over a stock file |
| 16. No `.ldefs` entry — extension inert | ~35 (as a criterion) | Acceptance run under `6502:LE:16:default` **fails**; under the extension id passes; `65C02` still yields 65C02 meanings |
| 17. Unresolved dispatch is invisible | ~35, with the inventory from ~33 | Enumerated-minus-resolved reported as a count and a list; `could-not-run` vs `not-exercised` kept distinct |
| 18. `DataTypeManager`; decompiler timeouts | ~35 | `DataTypeManager` control on the same image; attempted == decompiled + timedOut, timeouts under a ceiling |
| 22. `memmap.json` join (tie-break, digest, path-dependence) | ~36 Automatic Annotation (Phase 26's text) | Tie-break control; `memmapSha256` on every row; synthetic two-caller `$01` fixture declines, and reddens if forward-carried |
| 23. Asserting the fix vs observing red | every phase | Each of the 18 enumerated controls has a committed red transcript, produced by a task separate from the fix |
| 24. Drifting line citations | every phase | New pinned citations added to `docs-linerefs.test.ts`'s pattern; upstream citations carry a version |

**Ordering consequence.** Pitfalls 1, 3 and 4 make the frame-exact-stop phase's scope *smaller* than the milestone assumed, and Pitfalls 14 and 16 make the two-engines phase's `OPC-*` scope *larger*. Pitfalls 19-21 and 25-26 are a **precondition** — the Ghidra execution seam is undecided and gates any skill script reaching for Ghidra — so a distinct phase between the capture work and the engine work is the honest structure, not a plan inside the engine phase.

---

## Sources

**Live measurements taken this session** (all reproducible; scripts under the session scratchpad, commands quoted inline above):

- `/usr/bin/x64sc` — genuine unpatched stock VICE **3.9**. Probes: `--version`; `-help` (1,824 lines, grepped for determinism/event/warp/raminit flags); startup seed line across 6+ launches; `$C000-$CFEF` RAM digests across 12 cold boots under four flag combinations; text-monitor `r` / `m` / `break` / `reset 1` / `x` sequences across 14 runs (**the instrument was the `-remotemonitor` text channel throughout** — an apparatus choice, now OWNER-EXCLUDED as a capability; see the Provenance section for which readouts are binary-monitor native and which are not); the halt-first reset protocol under 0 / 1500 / 4000 ms jitter; warp-vs-no-warp stop identity; three-run transient enumeration over `$0000-$03FF`.
- `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` — `support/sleigh` compile of `docs/undocumented-opcodes-ghidra.md`'s extension source (failing, exit 2, 8 errors), and of a sized-local-corrected variant (passing, `t.sla` 8,423 bytes); `Ghidra/Processors/6502/data/languages/6502.ldefs` and the shipped `.sla` inventory.

**Primary evidence committed in this repository** (transcribed, not paraphrased):

- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/tools/instrument-provenance.txt` — the dot-prefixed project-path abort; `analyzeHeadless` exit 0 on a thrown post-script; the 4887-vs-279 classification count; the flat-64K `Failed to add language defined memory block` INFO lines; the volatility-proven reference dump; the 721,030-byte export.
- `docs/phase23-real-release-gate-findings.md` — the fixture re-measurement (`72.39 (97/134)`, `3` FP, `FIXTURE_REPRODUCED: no`, RC-1, the strict-denominator variant); criterion 2's unresolved-is-invisible design; criterion 3's `could-not-run`; the `could-not-run` vs `not-exercised` distinction.
- `.planning/notes/ghidra-volatile-io-and-banking.md` — the `bank.a` fixture, dead-store elimination, `MemoryConflictException`, and the recovered-`$01` bank state.
- `.planning/todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md` — the `danish` 201-divergence / `saeger` `$00F6` pair.
- `.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md` — the `C64MEM` slice and the `$0000`/`$0001` overlay.
- `.planning/todos/pending/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md` — the warm-floor / `selectWarmInstance()` / acquire-frame analysis, and the 2026-08-27 live `warp on` confirmation.
- `.planning/todos/pending/2026-09-01-ghidra-headless-one-command-6502-decompile-wrapper-proposal.md` — the three-output contract and the execution-seam open question.
- `.planning/seeds/host-tool-executor.md` — `MAX_LINE_BYTES`, the shared-process-fate argument, the token-consumer problem, the typed-allowlist rule.
- `.planning/ROADMAP.md` Standing Constraints; `.planning/PROJECT.md` Constraints / Engineering Governance / Key Decisions / Current Milestone; `CLAUDE.md` Constraints.

**Source read this session:** `src/mcp/vice/broker-launch.mts` (`buildViceArgs`, `inFlight`, warm floor), `broker-control.mts` (`MAX_LINE_BYTES`), `vice-proxy.ts` (the four cited offsets, all current), `hostpath-consumers.test.ts` (closed set, `ANNO_MODULE_FLOOR`), `resources-sync.test.ts`, `docs-linerefs.test.ts` (scanned-document list and citation regex).

**No external provider was consulted.** Every question in the brief was answerable from primary local evidence or a live probe against a real binary, which is a strictly stronger source than any documentation lookup would have been — and it is the reason this document is able to contradict two carried planning claims rather than restate them.

---
*Pitfalls research for: frame-exact C64 emulator capture + dxa/Ghidra-headless 6502 analysis, added to an existing VICE MCP plugin with a host broker pool and an owned SQLite annotation store*
*Researched: 2026-09-02*
