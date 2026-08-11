# Stock VICE parity: what changes for the tool surface

A two-way gap analysis for the migration from the custom `x64sc -mcpserver` to
stock VICE's binary monitor (see `docs/roadmap-stock-vice.md`). Grounded in the
current tool descriptions (`tools-manifest.json`) and VICE's own source
(`VICE-Team/svn-mirror`: `monitor_binary.c`, `mon_register.c`).

**Net:** ~85–90% of the surface ports cleanly or reimplements client-side. The two
things genuinely **lost** are **SID state read-back** and **low-level/matrix
keyboard**; the two things genuinely **gained** are **CPU-history tracing** and
**1541 drive-CPU debugging**.

## A. What can't be replicated exactly (losses)

Ranked by impact.

1. **SID state read-back — `vice_sid_get_state` (voices, filter) → hard loss.**
   SID registers `$D400–$D418` are **write-only in hardware**, so a memory read
   won't return what was written. The current server reads VICE's *internal* SID
   struct; the binary monitor has no SID command and can't read write-only
   registers. Current voice frequency/waveform/ADSR/filter/volume are
   **unrecoverable** from memory (only `$D419–$D41C` — paddles, OSC3, ENV3 — are
   readable). `set` still works. Partial mitigation: the client can *shadow* the
   writes it issues, but never the writes the running program makes.

2. **Low-level keyboard — `matrix`, `chord`, `key_press/release`, `restore` → loss.**
   `KEYBOARD_FEED` (0x72) only injects PETSCII **text into the buffer**. It cannot
   hold keys down, drive the raw matrix (games that scan the keyboard directly),
   press chords for N frames, or pulse the RESTORE/**NMI** line. `type`/`petscii`
   survive. Fragile workaround: poke CIA matrix registers / the KERNAL buffer via
   `MEM_SET` — not equivalent for matrix-scanning games.

3. **On-demand pause — `vice_execution_pause` → approximate.**
   No "stop now" opcode. Halting happens only on a checkpoint hit (or a JAM).
   Emulate with a temporary checkpoint on the next instruction — works, but isn't
   a clean "freeze at this instant."

4. **`vice_run_until` "for N cycles" → approximate.**
   Run-until-*address* is exact (checkpoint). Stopping after *exactly* N cycles is
   not native — you can detect crossing N via the CPU-history clock but can't halt
   precisely at N.

5. **`vice_cycles_stopwatch` → conditional + non-atomic.**
   Feasible via CPU-history's absolute clock, but (a) requires CPU history compiled
   into the build, and (b) there is no hardware reset, so "atomic reset_and_read"
   becomes client-side baseline math. Functionally close *if* CPU history is on.

6. **`vice_vicii_get_state` ("internal") / `vice_cia_get_state` (timers) → partial loss.**
   Memory-mapped bits read fine — and `MEM_GET` can read **without side effects**,
   so it won't clear collision/latch registers. But truly *internal* state
   (raster-IRQ latch, timer **latch** vs. current count, internal flip-flops) isn't
   in the register map and can't be read. Current CIA timer *counts* are readable;
   their latches aren't.

7. **Reproducible but not byte-identical (reimplementation, not lost capability):**
   `vice_disassemble` (ship a client 6502 disassembler; formatting/illegal opcodes
   won't match VICE's exactly) · `vice_display_screenshot` (INDEXED8 framebuffer +
   `PALETTE_GET` → encode PNG client-side) · `vice_disk_read_sector` (parse the
   `.d64` file, not the live drive) · `vice_snapshot_save` metadata/`mcp_snapshots/`
   (DUMP writes state; JSON metadata + list is client bookkeeping) ·
   `checkpoint_set_ignore_count` (no native ignore — client counts hits and
   auto-resumes; a round-trip per ignored hit, not in-core).

## B. Extra stock features worth exposing (things stock does *more*)

Present in the binary monitor, absent from today's tool surface — genuine upside.

1. **CPU instruction-history trace (`CPUHISTORY_GET` 0x86)** — a ring buffer of the
   last N executed instructions *with registers and cycle timestamps*.
   Reconstruct what ran before a hang/IRQ, do timing analysis, trace-through. The
   standout new capability.
2. **1541 drive-CPU debugging** — the monitor addresses drive CPUs (8–11) as
   separate *memspaces*: checkpoints, registers, and memory on the drive's own
   6502. Gold for fastloader / copy-protection / disk-routine RE. Current tooling
   is main-CPU only.
3. **Full resource get/set (`RESOURCE_GET/SET` 0x51/0x52)** — `machine_config` today
   is a whitelisted subset; the monitor reaches **every** VICE resource (drive
   true-emulation, all video/SID/filter knobs, joystick mapping, …).
4. **Raster/cycle-precise checkpoint conditions** — conditions can reference the
   raster-line / cycle-in-line pseudo-registers → break at an exact raster position
   (demo/raster-effect RE).
5. **`PALETTE_GET` (0x91)** — the exact emulator palette, for faithful color
   reproduction/analysis.
6. **`USERPORT_SET` (0xb2)** — inject userport state, beyond joystick.
7. **`VICE_INFO` (0x85)** — detect build/version so the client degrades gracefully
   (e.g., auto-detect CPU-history support).
8. **No-side-effect memory reads** — `MEM_GET` can read I/O without triggering side
   effects; cleaner introspection than a naive peek.

## C. What the VICE MCP does *more than raw stock* (the value-add to port)

The MCP's worth isn't new emulator power — it's **ergonomics layered on
primitives**: decoded chip/sprite state, disassembly + symbol resolution, sprite
ASCII rendering, memory search/compare/fill, named checkpoint groups, backtrace,
ready-to-use PNG screenshots, snapshot metadata — plus the broker/multi-instance
management and the MCP protocol surface Claude talks to. Stock gives the
primitives; the MCP gives the convenience. Going stock means porting all of this
into a client, and accepting the A-list losses (chiefly SID read-back and
low-level keyboard).
