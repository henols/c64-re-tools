# Context (from DOC-class sources)

Synthesized by `gsd-doc-synthesizer`. Sole DOC-class source is
`docs/stock-vice-parity.md` — a two-way gap analysis grounded in
`tools-manifest.json` and VICE source (`monitor_binary.c`, `mon_register.c`).
Recorded verbatim in substance with source attribution.

**Precedence note:** DOC is normally the lowest tier and decision-input only.
By user resolution W1 (2026-08-11), this document is **authoritative on chip-state
read-back** (§A.1 SID, §A.6 VIC-II/CIA) and supersedes the ADR on that scope. The
rest of the file remains decision-input, not contract.

---

## Topic: net parity assessment

- **source:** `docs/stock-vice-parity.md` (header)
- ~85–90% of the tool surface ports cleanly or reimplements client-side.
- Genuinely **lost**: SID state read-back, low-level/matrix keyboard.
- Genuinely **gained**: CPU-history tracing, 1541 drive-CPU debugging.

## Topic: capability losses (ranked by impact)

- **source:** `docs/stock-vice-parity.md` §A

1. **SID state read-back — `vice_sid_get_state` → hard loss.** SID registers
   `$D400–$D418` are **write-only in hardware**, so a memory read won't return
   what was written. The current server reads VICE's *internal* SID struct; the
   binary monitor has no SID command and can't read write-only registers. Voice
   frequency/waveform/ADSR/filter/volume are **unrecoverable** from memory (only
   `$D419–$D41C` — paddles, OSC3, ENV3 — are readable). `set` still works. Partial
   mitigation: the client can *shadow* the writes it issues, but never the writes
   the running program makes.
   **AUTHORITATIVE (user resolution W1, 2026-08-11).** This position governs.
   `docs/roadmap-stock-vice.md` group B, which listed SID state as a
   memory-mapped client-side derivation, is **superseded on this scope**. The
   write-shadowing mitigation is explicitly a mitigation, not parity, and must not
   be presented as a restored `vice_sid_get_state`. Binding form:
   `CON-sid-readback-hard-loss` in `constraints.md`.

2. **Low-level keyboard — `matrix`, `chord`, `key_press/release`, `restore` →
   loss.** `KEYBOARD_FEED` (`0x72`) only injects PETSCII **text into the buffer**.
   It cannot hold keys down, drive the raw matrix (games that scan the keyboard
   directly), press chords for N frames, or pulse the RESTORE/**NMI** line.
   `type`/`petscii` survive. Fragile workaround: poke CIA matrix registers / the
   KERNAL buffer via `MEM_SET` — not equivalent for matrix-scanning games.

3. **On-demand pause — `vice_execution_pause` → approximate.** No "stop now"
   opcode. Halting happens only on a checkpoint hit (or a JAM). Emulate with a
   temporary checkpoint on the next instruction — works, but isn't a clean
   "freeze at this instant."

4. **`vice_run_until` "for N cycles" → approximate.** Run-until-*address* is exact
   (checkpoint). Stopping after *exactly* N cycles is not native — you can detect
   crossing N via the CPU-history clock but can't halt precisely at N.

5. **`vice_cycles_stopwatch` → conditional + non-atomic.** Feasible via
   CPU-history's absolute clock, but (a) requires CPU history compiled into the
   build, and (b) there is no hardware reset, so "atomic reset_and_read" becomes
   client-side baseline math. Functionally close *if* CPU history is on.

6. **`vice_vicii_get_state` ("internal") / `vice_cia_get_state` (timers) → partial
   loss.** Memory-mapped bits read fine — and `MEM_GET` can read **without side
   effects**, so it won't clear collision/latch registers. But truly *internal*
   state (raster-IRQ latch, timer **latch** vs. current count, internal
   flip-flops) isn't in the register map and can't be read. Current CIA timer
   *counts* are readable; their latches aren't.
   **AUTHORITATIVE (user resolution W1, 2026-08-11).** VIC-II / CIA read-back is
   PARTIAL — only the readable register map is available. Supersedes the ADR's
   group-B claim on this scope. Binding form: `CON-chip-internal-state-partial`
   in `constraints.md`.

7. **Reproducible but not byte-identical (reimplementation, not lost
   capability):** `vice_disassemble` (client 6502 disassembler; formatting and
   illegal opcodes won't match VICE exactly) · `vice_display_screenshot`
   (INDEXED8 framebuffer + `PALETTE_GET` → PNG client-side) ·
   `vice_disk_read_sector` (parse the `.d64` file, not the live drive) ·
   `vice_snapshot_save` metadata / `mcp_snapshots/` (DUMP writes state; JSON
   metadata + list is client bookkeeping) · `checkpoint_set_ignore_count` (no
   native ignore — client counts hits and auto-resumes; a round-trip per ignored
   hit, not in-core).

## Topic: capability gains (stock features worth exposing)

- **source:** `docs/stock-vice-parity.md` §B — present in the binary monitor,
  absent from today's tool surface.

1. **CPU instruction-history trace (`CPUHISTORY_GET` `0x86`)** — a ring buffer of
   the last N executed instructions *with registers and cycle timestamps*.
   Reconstruct what ran before a hang/IRQ, do timing analysis, trace-through. The
   standout new capability.
2. **1541 drive-CPU debugging** — the monitor addresses drive CPUs (8–11) as
   separate *memspaces*: checkpoints, registers, and memory on the drive's own
   6502. Valuable for fastloader / copy-protection / disk-routine RE. Current
   tooling is main-CPU only.
3. **Full resource get/set (`RESOURCE_GET/SET` `0x51`/`0x52`)** —
   `machine_config` today is a whitelisted subset; the monitor reaches **every**
   VICE resource (drive true-emulation, all video/SID/filter knobs, joystick
   mapping, …).
4. **Raster/cycle-precise checkpoint conditions** — conditions can reference the
   raster-line / cycle-in-line pseudo-registers → break at an exact raster
   position (demo / raster-effect RE).
5. **`PALETTE_GET` (`0x91`)** — the exact emulator palette, for faithful color
   reproduction/analysis.
6. **`USERPORT_SET` (`0xb2`)** — inject userport state, beyond joystick.
7. **`VICE_INFO` (`0x85`)** — detect build/version so the client degrades
   gracefully (e.g., auto-detect CPU-history support).
8. **No-side-effect memory reads** — `MEM_GET` can read I/O without triggering
   side effects; cleaner introspection than a naive peek.

## Topic: the MCP layer's value-add (what must be ported)

- **source:** `docs/stock-vice-parity.md` §C
- The MCP's worth isn't new emulator power — it's **ergonomics layered on
  primitives**: decoded chip/sprite state, disassembly + symbol resolution, sprite
  ASCII rendering, memory search/compare/fill, named checkpoint groups, backtrace,
  ready-to-use PNG screenshots, snapshot metadata — plus the broker/multi-instance
  management and the MCP protocol surface Claude talks to. Stock gives the
  primitives; the MCP gives the convenience. Going stock means porting all of this
  into a client, and accepting the A-list losses (chiefly SID read-back and
  low-level keyboard).

---

## Background: existing codebase intel (read-only, not ingested docs)

Not part of this ingest. Present at `.planning/codebase/` — `CONVENTIONS.md`,
`INTEGRATIONS.md`, `STACK.md`. Treated as background on the current
implementation, not as locked planning decisions.
