If by **VICE remote protocol** you mean the **Binary Monitor Protocol**, it gives you enough control to build an external debugger, automated test runner, reverse-engineering tool, or even an AI-controlled C64 environment.

Start VICE with, for example:

```bash
x64sc \
  -binarymonitor \
  -binarymonitoraddress ip4://127.0.0.1:6502
```

The protocol is binary over TCP and uses request IDs, so a client can correlate commands with responses. VICE also sends unsolicited events such as breakpoint hits, stops/resumes, and CPU jams. ([vice-emu.sourceforge.io][1])

| Area                      | What you can do                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **Memory**                | Read and write arbitrary memory                                                          |
| **Memory banks**          | Select RAM/ROM/I/O banks and discover available banks                                    |
| **1541 drives**           | Read/write memory and registers of drive CPUs 8–11                                       |
| **CPU registers**         | Read and modify PC, A, X, Y, SP, flags, etc.                                             |
| **Breakpoints**           | Break on execution                                                                       |
| **Watchpoints**           | Break on memory reads/writes                                                             |
| **Conditional breaks**    | Conditions involving registers and expressions                                           |
| **Temporary breakpoints** | Automatically disappear after being hit                                                  |
| **Execution control**     | Step instructions, step over subroutines, continue                                       |
| **Return stepping**       | Run until the next RTS/RTI                                                               |
| **Snapshots**             | Save and restore complete emulator state                                                 |
| **VICE settings**         | Read/write emulator resources                                                            |
| **Keyboard**              | Feed PETSCII text into the C64 keyboard buffer                                           |
| **Joystick**              | Programmatically manipulate joystick ports                                               |
| **User port**             | Set simulated user-port input                                                            |
| **Screen**                | Retrieve the actual rendered framebuffer                                                 |
| **Palette**               | Retrieve current VICE palette                                                            |
| **Reset**                 | Reset C64, power-cycle it, or reset drives                                               |
| **Programs/images**       | Autoload/autostart PRG/disk/etc.                                                         |
| **VICE info**             | Query emulator version                                                                   |
| **CPU history**           | Retrieve execution history on current VICE trunk when CPU-history support is compiled in |
| **Process control**       | Ping or terminate VICE                                                                   |

The published protocol documents memory commands `0x01/0x02`, checkpoints `0x11–0x15`, conditions `0x22`, registers `0x31/0x32`, snapshots `0x41/0x42`, resources `0x51/0x52`, execution control `0x71–0x73`, display `0x84`, palette `0x91`, joystick `0xa2`, user port `0xb2`, reset `0xcc`, and autostart `0xdd`. ([vice-emu.sourceforge.io][1]) Current VICE trunk also contains `CPUHISTORY_GET = 0x86`, which is newer than the published manual.

### The particularly powerful parts

For reverse engineering, **checkpoints/watchpoints** are probably the most useful feature. A checkpoint can trigger on:

```text
LOAD
STORE
EXECUTE
```

and on an address range. You can then add a condition such as a register expression. VICE's monitor conditions can reference things such as `A`, `X`, `Y`, `PC`, `SP`, flags, raster line `RL`, and raster cycle `CY`. ([vice-emu.sourceforge.io][1])

That lets an external program do things such as:

```text
Run game
    ↓
Break when $D020 is written
    ↓
Read PC/registers
    ↓
Read surrounding code
    ↓
Continue
    ↓
Break when $D020 changes again
```

Or:

```text
Watch $0400-$07e7 for writes
```

to determine what code is updating screen memory.

You can do the same thing with drive memory. The protocol explicitly understands separate memory spaces for the main machine and drives 8–11. ([vice-emu.sourceforge.io][1])

### You can modify the machine while it runs

Because you have both memory and register writes, your external tool can change execution:

```text
PC = $C000
A  = $00

write $EA to $8123
write $EA to $8124
write $EA to $8125
```

So you can patch instructions, change variables, alter VIC/SID/CIA registers, inject code, change the stack, or redirect execution.

This makes the protocol useful not only for debugging your own program but also for **dynamic analysis of existing C64 software**.

### Screen capture is built into the protocol

`DISPLAY_GET (0x84)` gives you the VICE framebuffer, including dimensions, offsets and indexed pixel data. `PALETTE_GET (0x91)` gives you the RGB values required to interpret it. ([vice-emu.sourceforge.io][1])

So an external process can effectively do:

```text
run 100 ms
↓
capture screen
↓
inspect state
↓
press joystick
↓
run
↓
capture screen
```

This is particularly interesting for automated game testing or an AI agent.

### You can control VICE configuration

This is one of the less obvious but very powerful capabilities:

```text
RESOURCE_GET   0x51
RESOURCE_SET   0x52
```

These commands expose VICE's normal resource system. ([vice-emu.sourceforge.io][1])

For example, resources include things such as:

```text
Speed
Sound
VICIIVideoCache
Drive8Type
TrueDriveEmulation
SIDModel
...
```

So you can modify a surprisingly large portion of VICE's configuration remotely.

And this connects to the **warp-mode question we discussed earlier**.

VICE defines:

```text
Speed = 100
```

as normal maximum 100% emulation speed, while:

```text
Speed = 0
```

means **no speed limit**. ([vice-emu.sourceforge.io][1])

Therefore you can remotely send approximately:

```text
RESOURCE_SET("Speed", 0)
```

and later:

```text
RESOURCE_SET("Speed", 100)
```

to switch between unlimited and normal speed.

There is an important distinction, though: **VICE's true Warp Mode is more than `Speed=0`**. Warp also disables sound output and reduces screen refresh activity to maximize emulator performance. The documented resource is `InitialWarpMode`; there isn't a stock binary-monitor `WARP_ON/WARP_OFF` opcode. ([vice-emu.sourceforge.io][1])

You can approximate warp remotely with resources such as:

```text
Speed = 0
Sound = 0
```

and restore them afterward. `Sound` is itself a VICE resource. 

### CPU execution history is especially interesting

The current VICE source has added:

```text
0x86 CPUHISTORY_GET
```

behind `FEATURE_CPUMEMHISTORY`.

That means that on a suitable build you don't necessarily have to single-step everything. You can let the game run and then retrieve recent CPU execution history.

For reverse engineering, this could be extremely valuable:

```text
Breakpoint hit at $A742

CPU history:
$A712 ...
$A715 ...
$A719 JSR $B340
...
$A742 STA $D020
```

Combine that with watchpoints and you've essentially got a **dynamic trace engine**.

### One protocol detail you need to design around

Sending commands to the binary monitor causes VICE to enter monitor state, i.e. execution stops while you inspect it. To resume execution, you send `EXIT (0xaa)`. VICE subsequently emits a `RESUMED` event; when it later hits a checkpoint it emits checkpoint/stopped events asynchronously. ([vice-emu.sourceforge.io][1])

That lends itself very naturally to:

```text
                   ┌───────────────┐
                   │ Your program  │
                   │ TypeScript    │
                   └───────┬───────┘
                           │ TCP :6502
                           ▼
                  ┌─────────────────┐
                  │ VICE binmonitor │
                  └────────┬────────┘
                           │
             ┌─────────────┴──────────────┐
             │                            │
        inspect/debug                execution
             │                            │
      memory/registers              EXIT / resume
      checkpoints                         │
      CPU history                         ▼
      framebuffer                  C64 runs at
             │                     maximum speed
             └──────── breakpoint ────────┘
```

For what you've been discussing around **automatically reverse-engineering C64 programs**, I would treat VICE's binary monitor as the **dynamic-analysis half** of the system. Ghidra/da65/dxa can perform static analysis, while VICE supplies runtime evidence: actual execution paths, memory accesses, self-modifying code, unpacked/decrunched code, register state, and screenshots. That combination is considerably more powerful than using any of the disassemblers alone.

[1]: https://vice-emu.sourceforge.io/manual/vice.pdf "https://vice-emu.sourceforge.io/manual/vice.pdf"

---
Yes. The **text remote monitor** is much more interesting than my previous answer implied.

The important distinction is that VICE’s text remote monitor is essentially **the full built-in VICE monitor exposed over TCP**. It is not a small separate API. Therefore, almost every command you can type in the VICE monitor window can also be sent remotely. VICE documents the default text-monitor address as `ip4://127.0.0.1:6510`. ([vice-emu.sourceforge.io][1])

Start it with:

```bash
x64sc \
  -remotemonitor \
  -remotemonitoraddress ip4://127.0.0.1:6510
```

You can then connect interactively:

```bash
telnet 127.0.0.1 6510
```

or send commands programmatically over TCP/netcat. ([sourceforge.net][2])

## And importantly: you can control warp mode directly

This is the answer to your earlier VICE speed-control question.

The text monitor has an actual:

```text
warp on
warp off
warp toggle
warp
```

command.

`warp` without an argument reports the current state. This is a proper VICE warp-mode command, not the approximation using `Speed=0` that I described for the binary protocol. ([vice-emu.sourceforge.io][3])

So externally you can simply do something like:

```bash
printf 'warp on\n' | nc 127.0.0.1 6510
```

and later:

```bash
printf 'warp off\n' | nc 127.0.0.1 6510
```

That makes the **text remote monitor particularly useful for automated C64 runs**.

## What else you can control

The text protocol gives you these major capability groups:

| Capability              | Example monitor commands     |
| ----------------------- | ---------------------------- |
| Run/continue            | `x`, `g`                     |
| Warp                    | `warp on`, `warp off`        |
| Single step             | `z`, `step`                  |
| Step over               | `n`, `next`                  |
| Step out                | `ret`, `return`              |
| CPU registers           | `r`, `registers`             |
| Change PC               | `g $c000`                    |
| Memory read             | `m $c000 $c0ff`              |
| Memory write            | `> $c000 ea ea ea`           |
| Fill/move/compare       | `f`, `t`, `c`                |
| Disassemble             | `d $c000 $c100`              |
| Assemble                | `a $c000 ...`                |
| Breakpoints             | `break $c000`                |
| Watchpoints             | `watch store $d020`          |
| Tracepoints             | `trace ...`                  |
| Conditional breakpoints | `break $c000 if A == $01`    |
| CPU history             | `chis 100`                   |
| Call stack              | `bt`                         |
| I/O decoding            | `io`                         |
| Screen contents         | `screen`                     |
| Keyboard buffer         | `keybuf "RUN\x0d"`           |
| Reset                   | `reset`                      |
| Snapshot                | `dump`, `undump`             |
| Autostart               | `autostart "game.prg"`       |
| Attach disk             | `attach "disk.d64" 8`        |
| Disk directory          | `list 8`                     |
| Disk sectors            | `block_read`, `block_write`  |
| Screenshot              | `screenshot "screen.png" 2`  |
| Labels                  | `load_labels`, `add_label`   |
| Profiling               | `profile ...`                |
| Resources               | `resourceget`, `resourceset` |
| Quit VICE               | `quit`                       |

These aren't just theoretical categories; they're commands in the current monitor documentation. ([vice-emu.sourceforge.io][3])

### Memory and dynamic analysis

For example:

```text
m $0800 $08ff
```

reads memory.

```text
> $d020 02
```

changes the border colour.

You can remotely patch executable code:

```text
> $c123 ea ea ea
```

or inspect and disassemble it:

```text
d $c000 $c100
```

The monitor even has its own assembler:

```text
a $c000 lda #$00
```

The current manual explicitly exposes both assembly and disassembly through the text monitor. ([vice-emu.sourceforge.io][3])

## Breakpoints are considerably more capable than simple PC breaks

You can do:

```text
break $c000
```

but also:

```text
watch store $d020
```

to find out **who writes the VIC-II border register**.

Or:

```text
watch store $0400 $07e7
```

to find code writing screen RAM.

And conditions can refer to registers, raster position and memory:

```text
break $c000 if A == $01
```

or conditions involving VIC memory:

```text
if @io:$d020 == $0f
```

VICE exposes `A`, `X`, `Y`, `PC`, `SP`, flags, raster line `RL`, raster cycle `CY`, memory dereferencing and even registers belonging to other emulated CPUs. ([vice-emu.sourceforge.io][3])

This is extremely useful for reverse engineering.

## You can even execute commands automatically when a breakpoint hits

There is an interesting feature:

```text
command <checkpoint-number> "<command>"
```

For example conceptually:

```text
break $c000
command 1 "r"
```

The attached command is executed when the checkpoint triggers. ([vice-emu.sourceforge.io][3])

That means you can use VICE itself to perform some instrumentation rather than constantly round-tripping over TCP.

## CPU history

If VICE was built with CPU-history support:

```text
chis 100
```

or:

```text
cpuhistory 100
```

shows the last 100 executed instructions.

You can even request histories for the computer and drive CPUs:

```text
chis 100 c: 8:
```

VICE documents CPU history for up to the computer plus drives 8–11. ([vice-emu.sourceforge.io][3])

For reverse engineering this gives you:

```text
program runs
       ↓
interesting event occurs
       ↓
watchpoint hits
       ↓
chis 100
       ↓
see how execution arrived there
```

That can be much more efficient than single-stepping.

## Built-in profiling is potentially even more useful

The text monitor exposes a whole profiler:

```text
profile on
profile off
profile flat
profile graph
profile func <function>
profile disass <function>
```

For example:

```text
profile on
x
```

let the game run, stop it later, and:

```text
profile flat 30
```

to identify the most heavily executed functions.

Or:

```text
profile graph
```

to obtain a call graph.

And:

```text
profile disass .gameLoop
```

can show **per-instruction profiling** for a function. ([vice-emu.sourceforge.io][3])

For your C64 reverse-engineering workflow, this is a significant capability.

## It understands symbols

You can remotely load labels:

```text
load_labels "game.lbl"
```

VICE supports its own command-format labels, cc65 labels, and ACME-style label files. Once loaded, symbols can be used in other monitor commands and appear in disassembly. ([vice-emu.sourceforge.io][3])

So instead of:

```text
break $8f31
```

you can potentially use:

```text
break .gameLoop
```

and:

```text
d .gameLoop
```

This is useful when combining VICE with Ghidra/ACME/da65 output.

## It can interact with disks at a low level

The text monitor is actually stronger than the binary protocol in several areas.

You can:

```text
attach "game.d64" 8
list 8
```

and access sectors:

```text
block_read 18 0
block_write 18 0 $c000
```

You can also switch the monitor itself to the 1541 CPU:

```text
device 8:
```

then inspect drive memory/registers/code. ([vice-emu.sourceforge.io][3])

That is particularly valuable for analyzing custom loaders.

## You can inject keyboard input

The monitor has:

```text
keybuf <string>
```

For example:

```text
keybuf "RUN\x0d"
```

places the characters directly in the machine's keyboard buffer. ([vice-emu.sourceforge.io][3])

So an automation could do:

```text
reset
keybuf "LOAD\"*\",8,1\x0d"
x
```

although `autostart` is usually easier.

## Screenshots and screen inspection

There are actually **two** interesting commands:

```text
screen
```

displays the C64 screen contents textually, while:

```text
screenshot "screen.png" 2
```

writes a PNG screenshot on the VICE host filesystem. ([vice-emu.sourceforge.io][3])

The limitation compared with the binary monitor is that the text protocol doesn't return the raw framebuffer as a structured binary image. `screenshot` writes a file.

## Resources

You can also manipulate VICE's resource system:

```text
resourceget "Speed"
resourceset "Speed" "0"
```

and many other emulator settings. ([vice-emu.sourceforge.io][3])

But for warp you don't need that workaround, because:

```text
warp on
```

exists directly.

---

### Text monitor vs binary monitor

There is an interesting trade-off:

|                             | Text remote monitor | Binary monitor      |
| --------------------------- | ------------------- | ------------------- |
| Human readable              | **Excellent**       | Poor                |
| Easy to test with telnet/nc | **Yes**             | No                  |
| Full VICE monitor CLI       | **Yes**             | No                  |
| Warp command                | **Yes**             | No dedicated opcode |
| Assemble/disassemble        | **Yes**             | No                  |
| Profiling                   | **Yes**             | No equivalent API   |
| Labels                      | **Yes**             | Limited/no          |
| Disk/block commands         | **Yes**             | Limited             |
| File-system commands        | **Yes**             | Limited             |
| CPU history                 | **Yes**             | Yes in newer builds |
| Structured responses        | No                  | **Yes**             |
| Request IDs                 | No                  | **Yes**             |
| Raw framebuffer             | No                  | **Yes**             |
| Robust machine parsing      | Harder              | **Much better**     |
| Async event handling        | Text output parsing | **Structured**      |

So for an automated reverse-engineering system, I would **not choose one exclusively**.

A very powerful architecture would be:

```text
                     Your TypeScript tool
                            │
             ┌──────────────┴──────────────┐
             │                             │
       TCP 6510                       TCP 6502
             │                             │
             ▼                             ▼
     TEXT REMOTE MONITOR            BINARY MONITOR
             │                             │
      warp on/off                     memory access
      disassembly                     registers
      profiling                       breakpoints
      labels                          framebuffer
      CPU history                     structured events
      disk commands                   snapshots
      monitor expressions
             │                             │
             └──────────────┬──────────────┘
                            │
                           VICE
```

**The text monitor has capabilities that the binary protocol simply does not expose**, particularly `warp`, profiling, sophisticated monitor expressions, labels, disassembly/assembly, disk commands and the richer debugging CLI.

For the C64 reverse-engineering tooling you've been working on, I think the text protocol deserves to be a **first-class interface alongside the binary protocol**, rather than treating it as the old/obsolete interface.

[1]: https://vice-emu.sourceforge.io/vice_6.html?utm_source=chatgpt.com "VICE Manual - 6 Settings and resources"
[2]: https://sourceforge.net/p/vice-emu/mailman/message/37778112/?utm_source=chatgpt.com "Re: [Vice-emu-mail] VICE - Binary Monitor Interface | VICE"
[3]: https://vice-emu.sourceforge.io/vice_12.html "VICE Manual - 12 Monitor"


---
Yes. For an automated C64 debugging/reverse-engineering system, I would **use both**, but not equally.

The binary monitor should be your **primary transport** because it is structured, faster to parse, has request IDs, and produces structured asynchronous stop/checkpoint events. The text monitor should be a **secondary “power tools” interface** for VICE functionality that the binary protocol does not expose cleanly. VICE exposes the two as separate servers by default: binary on port 6502 and text remote monitor on 6510. ([vice-emu.sourceforge.io][1])

### Recommended division

| Operation                   | Use                      | Reason                                 |
| --------------------------- | ------------------------ | -------------------------------------- |
| Read memory                 | **Binary**               | Structured bytes, no hex-text parsing  |
| Write memory                | **Binary**               | Fast/direct                            |
| Read registers              | **Binary**               | Structured values                      |
| Write registers             | **Binary**               | Structured values                      |
| Breakpoints                 | **Binary**               | Structured checkpoint API              |
| Watchpoints                 | **Binary**               | Same checkpoint API                    |
| Conditional checkpoints     | **Binary**               | Supported by checkpoint/condition API  |
| Breakpoint-hit notification | **Binary**               | Structured asynchronous events         |
| Continue                    | **Binary**               | Clean execution control                |
| Step into                   | **Binary**               | Structured                             |
| Step over                   | **Binary**               | Structured                             |
| Step out                    | **Binary**               | Structured                             |
| Snapshot save/restore       | **Binary**               | Structured                             |
| Reset                       | **Binary**               | Structured                             |
| Autostart PRG/D64 etc.      | **Binary**               | Structured                             |
| Keyboard injection          | **Binary**               | No text-output parsing                 |
| Joystick control            | **Binary**               | Direct API                             |
| Screen/framebuffer capture  | **Binary**               | Raw indexed framebuffer                |
| Palette                     | **Binary**               | Structured RGB data                    |
| VICE resources              | **Binary** normally      | Structured GET/SET                     |
| CPU history                 | **Binary**, if supported | Structured history                     |
| **Warp mode**               | **Text**                 | `warp on/off` is direct                |
| **Profiler**                | **Text**                 | Only rich monitor interface has it     |
| **Execution memmap**        | **Text**                 | Powerful built-in analysis             |
| **Backtrace**               | **Text**                 | VICE already reconstructs JSR chain    |
| **I/O decoding**            | **Text**                 | VICE understands VIC/CIA/SID registers |
| **Labels/symbols**          | **Text**                 | Load/use/save symbol files             |
| **VICE disassembler**       | **Text**                 | Useful for label/bank-aware inspection |
| **VICE assembler**          | **Text**                 | Useful for quick patches               |
| **Expression evaluator**    | **Text**                 | Powerful monitor expressions           |
| Disk-sector/file operations | **Text**                 | Richer monitor commands                |
| Human diagnostic dump       | **Text**                 | Already formatted for humans           |

The binary protocol combines breakpoints, watchpoints and tracepoints under its checkpoint mechanism and provides typed command/response packets. ([vice-emu.sourceforge.io][2]) The text monitor, in contrast, exposes VICE's higher-level debugger features such as `warp`, `backtrace`, `memmapshow`, labels and profiling. ([vice-emu.sourceforge.io][3])

## 1. Binary should handle the hot path

For anything happening hundreds or thousands of times, use binary.

For example, don't do this through the text monitor:

```text
m $c000 $cfff
```

and then parse:

```text
>C:c000  a9 00 8d 20 d0 ...
>C:c010  ...
```

Instead:

```text
MEM_GET($c000, $cfff)
       ↓
Uint8Array
```

The same applies to registers.

Instead of parsing:

```text
ADDR AC XR YR SP 00 01 NV-BDIZC
;c123 00 01 02 f8 2f 37 00100101
```

use the binary register response and get something equivalent to:

```ts
{
    pc: 0xc123,
    a: 0x00,
    x: 0x01,
    y: 0x02,
    sp: 0xf8,
    flags: 0x25
}
```

That is where the binary protocol gives you the largest efficiency improvement.

---

# 2. Use binary checkpoints as your event engine

This is probably the most important architectural choice.

Suppose you're trying to identify code manipulating sprites.

Set binary watchpoints on:

```text
$d000-$d02e
```

Then:

```text
VICE running at warp
        │
        │ STA $D000
        ▼
binary checkpoint fires
        │
        ├── PC
        ├── registers
        └── checkpoint ID
```

Your controller now knows something interesting happened.

Then it can decide whether more expensive analysis is necessary.

For example:

```text
checkpoint hit
    ↓
Binary:
    registers
    memory around PC
    CPU history
    ↓
Interesting?
    │
    ├── no → continue
    │
    └── yes
         ↓
       Text:
         bt
         io
         profile func ...
```

This is much better than continuously issuing text-monitor commands.

---

# 3. Text monitor: use it for semantic analysis

This is where the text monitor becomes extremely valuable.

For example:

```text
io $d000
```

isn't merely a memory read.

VICE understands that `$D000` belongs to the VIC-II and can provide semantic information about the device.

Similarly:

```text
bt
```

does considerably more work than reading the stack. VICE tries to reconstruct the JSR call chain. ([vice-emu.sourceforge.io][3])

You could reproduce those algorithms yourself, but there is little reason to.

So I would expose something like:

```ts
vice.analysis.backtrace()

vice.analysis.io("$d000")

vice.analysis.profileFlat()

vice.analysis.memmap()
```

implemented internally through the text interface.

---

# 4. Profiling should definitely come from text

This is one of the strongest reasons to keep the text connection.

VICE can do:

```text
profile on
```

Run the game for a while:

```text
warp on
x
```

then:

```text
profile off
profile flat 50
```

VICE can also produce:

```text
profile graph
profile func <function>
profile disass <function>
```

including per-instruction profiling and caller/callee relationships. ([vice-emu.sourceforge.io][2])

For automated reverse engineering, that gives you a very useful first-pass question:

> **What code actually matters?**

Suppose you've loaded a 60 KB game but runtime profiling shows:

```text
$8100-$83ff    42%
$a210-$a48f    24%
$9c00-$9cff    11%
...
```

You immediately know which areas deserve static analysis.

I would not try to reconstruct this functionality from binary stepping.

---

# 5. Use the text `memmap` feature

Another feature I would definitely take from the text monitor is VICE's execution/access map.

VICE can record whether addresses have been:

```text
RAM read
RAM write
RAM execute

ROM read
ROM write
ROM execute

I/O read
I/O write
```

and expose that through:

```text
memmapshow
memmapzap
```

CPU history/memmap support needs a VICE build with CPU-history enabled, and the VICE manual warns that this can have a performance cost. ([vice-emu.sourceforge.io][3])

This is extremely useful for disassembly.

Suppose static analysis sees:

```text
$8000-$bfff
```

and doesn't know which bytes are code.

Run the game and obtain:

```text
8000-82ff EXEC
8300-87ff READ
8800-8cff EXEC
8d00-91ff READ
```

Now your disassembler has strong runtime evidence that:

```text
$8000-$82ff → code
$8300-$87ff → likely data
$8800-$8cff → code
$8d00-$91ff → likely data
```

That's exactly the kind of information you'd want to feed into Ghidra/da65.

---

# 6. CPU history: prefer binary

This one has changed from older versions.

The text interface gives you:

```text
chis 1000
```

which is useful interactively. ([vice-emu.sourceforge.io][3])

But newer VICE code also has binary:

```text
CPUHISTORY_GET
0x86
```

when CPU-memory-history support is compiled in.

For software, I would choose:

```text
Binary CPU history
```

because you get actual structured records rather than having to parse hundreds of lines like:

```text
.C:c000  A9 00       LDA #$00
.C:c002  8D 20 D0    STA $D020
...
```

The text form is great for humans.

The binary form is better for:

```ts
interface HistoryEntry {
    address: number;
    opcode: number;
    operands: number[];
    registers: {
        a: number;
        x: number;
        y: number;
        sp: number;
    };
}
```

---

# 7. Screen capture: definitely binary

Don't use:

```text
screen
```

for machine vision.

The binary monitor's `DISPLAY_GET` gives you actual indexed pixel data. The binary protocol explicitly exposes display retrieval as a typed command. ([vice-emu.sourceforge.io][4])

That lets you build:

```text
DISPLAY_GET
    ↓
framebuffer
    ↓
PNG / image
    ↓
AI vision
```

or simply compare frames:

```text
frame A
   ↓
XOR/difference
   ↓
frame B
```

This is extremely useful for automated game exploration.

---

# 8. Warp: text

For actual runtime warp control I would use:

```text
warp on
warp off
```

rather than trying to manipulate related VICE resources.

The monitor has an explicit runtime warp command. ([vice-emu.sourceforge.io][3])

So your controller could do:

```ts
await vice.text.warp(true);

await vice.binary.resume();

await vice.binary.waitForCheckpoint();

await vice.text.warp(false);
```

That's a very good combination.

---

# 9. Labels should live in the text side

VICE's monitor already understands labels and can load ACME/cc65-style mappings:

```text
load_labels "game.lbl"
show_labels
add_label $c123 .UpdateSprites
```

Labels can subsequently be used wherever an address is expected, and VICE includes them in its disassembly. ([vice-emu.sourceforge.io][3])

So if your reverse-engineering process identifies:

```text
$c123 → UpdateSprites
$a830 → MusicIRQ
$9432 → DecodeMap
```

you can push those back into VICE.

Then:

```text
d .UpdateSprites
break .MusicIRQ
```

becomes possible.

That produces a useful feedback loop:

```text
VICE runtime evidence
       ↓
analysis
       ↓
discover function
       ↓
name function
       ↓
load label into VICE
       ↓
future debugging becomes semantic
```

---

# 10. Don't use VICE's text disassembler for bulk disassembly

This is one place I would **not** automatically use a feature just because it's available.

VICE can do:

```text
d $8000 $bfff
```

but for your automated reverse-engineering pipeline I'd rather use:

```text
Ghidra
da65
dxa
your own 6502 decoder
```

for bulk analysis.

Use VICE disassembly only for things like:

```text
checkpoint at $A831
        ↓
d $A800 $A880
```

because that gives a quick, bank-aware, runtime-context-aware view.

So:

```text
bulk static analysis → external disassembler
runtime local inspection → VICE text disassembler
```

---

# The architecture I would build

I'd expose **one API to the rest of your application** and hide the existence of two VICE protocols underneath it:

```text
                     C64 Analysis API
                           │
            ┌──────────────┴──────────────┐
            │                             │
       Machine API                  Analysis API
            │                             │
         BINARY                          TEXT
            │                             │
   readMemory()                    setWarp()
   writeMemory()                   getBacktrace()
   getRegisters()                  getMemmap()
   setRegisters()                  startProfiler()
   setBreakpoint()                 getProfile()
   setWatchpoint()                 loadLabels()
   step()                          inspectIO()
   resume()                        disassembleLocal()
   getFramebuffer()
   getCpuHistory()
   joystick()
            │                             │
            └─────────────┬───────────────┘
                          │
                         VICE
```

And importantly, I would put **one scheduler/controller in front of both connections**. Don't let arbitrary parts of the application issue binary and text monitor commands concurrently, because both manipulate the same emulator/monitor state.

Something like:

```ts
class ViceController {
    binary: ViceBinaryClient;
    monitor: ViceTextClient;

    executionState:
        | "running"
        | "stopped"
        | "transitioning";
}
```

The VICE settings expose the text and binary monitor as separate servers and separate addresses, so running both interfaces is a natural configuration. ([vice-emu.sourceforge.io][1])

## My preferred split in percentages

For an automated reverse-engineering/debugging system, I'd expect roughly:

```text
Binary protocol
████████████████████████████████████░░░░
~85% of runtime communication

Text monitor
██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
~15%
```

But that 15% contains some of the **highest-value analysis operations**:

```text
TEXT
 ├── warp
 ├── profiling
 ├── memmap
 ├── symbols
 ├── backtrace
 ├── semantic I/O inspection
 └── occasional contextual disassembly

BINARY
 ├── memory
 ├── registers
 ├── execution
 ├── checkpoints/watchpoints
 ├── CPU history
 ├── framebuffer
 ├── input
 └── events
```

For the C64 reverse-engineering workflow we've been discussing, **profiling + memmap + binary watchpoints + binary CPU history** is probably the most valuable combination of all. It lets you move from *“here is a 64 KB memory image”* to *“these exact functions execute, these addresses are data, this routine wrote this VIC register, and these were the 100 instructions leading to it.”*

[1]: https://vice-emu.sourceforge.io/vice_6.html?utm_source=chatgpt.com "VICE Manual - 6 Settings and resources"
[2]: https://vice-emu.sourceforge.io/manual/vice.pdf?utm_source=chatgpt.com "Chapter 12: Binary monitor                                                                 262"
[3]: https://vice-emu.sourceforge.io/vice_12.html?utm_source=chatgpt.com "VICE Manual - 12 Monitor"
[4]: https://vice-emu.sourceforge.io/vice_13.html?utm_source=chatgpt.com "VICE Manual - 13 Binary monitor"
---

Yes. For your C64 reverse-engineering workflow, there are several VICE components worth using in addition to the two monitor protocols.

The **three real standalone utilities officially shipped/documented with VICE are `c1541`, `cartconv`, and `petcat`**. VICE also includes other emulator executables such as `x64`, `x64sc`, and `vsid`, plus useful built-in facilities like event recording, snapshots, debug tracing, and screenshots. ([vice-emu.sourceforge.io][1])

### Most interesting ones for your use case

| Tool / facility        | Value for reverse engineering                            | Priority |
| ---------------------- | -------------------------------------------------------- | -------: |
| **c1541**              | Disk structure, extract PRGs, sectors, block chains, BAM |    ★★★★★ |
| **petcat**             | Detect/decode BASIC loaders and SYS stubs                |    ★★★★☆ |
| **cartconv**           | Cartridge identification, banks, CRT → BIN/PRG           |    ★★★★☆ |
| **x64 vs x64sc**       | Fast exploration vs accurate execution                   |    ★★★★★ |
| **Event history**      | Deterministic replay of game/input sequences             |    ★★★★☆ |
| **Snapshots**          | Instant reproducible analysis checkpoints                |    ★★★★★ |
| **vsid**               | SID/music-specific analysis                              |    ★★★☆☆ |
| **Debug/IEC tracing**  | Loader and 1541 analysis                                 |    ★★★★☆ |
| Exit screenshots/media | Automated regression/state comparison                    |    ★★★☆☆ |

## 1. `c1541` — probably the most useful extra tool

This is much more than a D64 file extractor.

VICE describes `c1541` as its complete standalone disk-image maintenance utility. It can work with two images simultaneously and supports batch operation, making it easy to automate. ([vice-emu.sourceforge.io][2])

Basic examination:

```bash
c1541 game.d64 -list
```

Extract everything:

```bash
c1541 game.d64 -extract
```

But the interesting reverse-engineering functions are lower-level.

### Examine the BAM

```text
bam
```

This shows which sectors are allocated.

### Examine arbitrary sectors

```text
block 18 0
```

or individual bytes:

```text
bpeek 18 0 0 255
```

You can even patch them:

```text
bpoke 18 0 42 $ff
```

VICE explicitly exposes `block`, `bpeek`, `bpoke`, `bread`, `bwrite`, `bcopy`, and `bfill`. ([vice-emu.sourceforge.io][2])

### Follow a file's sector chain

This one is particularly interesting:

```text
chain "GAME"
```

It shows the actual disk blocks making up a file. ([vice-emu.sourceforge.io][2])

That lets you distinguish:

```text
normal PRG
    ↓
sector chain

versus

custom loader
    ↓
apparently unused sectors
    ↓
loader accesses sectors directly
```

This is very useful when analyzing games with fastloaders or copy protection.

### It supports G64 too

`c1541` can create and manipulate several image formats including:

```text
D64
G64
D71
G71
D81
D80
D82
D90
```

among others. ([vice-emu.sourceforge.io][2])

So I would definitely integrate `c1541` into your preprocessing stage.

---

# 2. `petcat` — excellent for automatically recognizing loaders

`petcat` converts between:

```text
tokenized BASIC
PETSCII
ASCII
```

and supports a surprising number of BASIC dialects. ([vice-emu.sourceforge.io][3])

For a normal C64 BASIC V2 PRG:

```bash
petcat -2 -o listing.txt -- loader.prg
```

Suppose your extracted PRG contains:

```basic
10 SYS 2061
```

Now your tooling immediately learns:

```text
PRG
 │
 ├── BASIC stub
 │
 └── SYS 2061
        ↓
      $080D
        ↓
 actual machine-code entry point
```

That's exactly the sort of information an automated reverse-engineering pipeline should consume before running a generic disassembler.

It also handles things like:

* Simons' BASIC
* Final Cartridge III BASIC
* Supergrafik
* various extended BASIC dialects
* C128 BASIC 7
* PET BASIC
* VIC-20 variants

The current tool has a long list of supported dialects. ([vice-emu.sourceforge.io][3])

So I would use `petcat` automatically on any PRG that appears to have a BASIC load address such as `$0801`.

---

# 3. `cartconv` — very useful for cartridge reverse engineering

If you ever analyze CRT files, this should absolutely be part of the pipeline.

First inspect the cartridge:

```bash
cartconv -f game.crt
```

It can identify cartridge metadata and structure.

Validate one:

```bash
cartconv -c game.crt
```

Convert CRT → raw binary:

```bash
cartconv -i game.crt -o game.bin
```

or produce PRG output where appropriate.

VICE currently supports a large number of cartridge architectures including Action Replay, EasyFlash, Ocean, Magic Desk, Final Cartridge, Retro Replay, RGCD, GMod2/GMod3 and many others. ([vice-emu.sourceforge.io][4])

This matters because cartridge binaries aren't necessarily simply:

```text
$8000-$9fff ROM
```

You can have:

```text
bank 0
bank 1
bank 2
...
        ↑
bank switching through $DE00/$DF00
```

So `cartconv` can give your analysis system a much better starting representation.

---

# 4. Use both `x64` and `x64sc`

This is particularly relevant to your automated workflow.

VICE currently provides both:

```text
x64
```

the faster C64 emulator, and:

```text
x64sc
```

the accurate C64 emulator. ([vice-emu.sourceforge.io][5])

I would use them differently.

### Normal automated analysis

```text
x64
```

where maximum throughput matters.

For example:

```text
start
warp
run until checkpoint
inspect
continue
```

thousands of times.

### Switch to `x64sc` when necessary

Use:

```text
x64sc
```

when you're dealing with:

* raster timing
* cycle-exact VIC-II effects
* unusual loaders
* copy protection
* timing-sensitive drive communication
* undocumented CPU behaviour interacting with timing

So your orchestration layer could actually have:

```ts
mode: "fast" | "accurate"
```

and automatically rerun suspicious findings under `x64sc`.

---

# 5. VICE Event History

This one is easy to overlook.

VICE can record an entire interaction session and later replay it. It records things including keyboard input, joystick actions, resets, image attach/detach events and datasette actions. ([vice-emu.sourceforge.io][6])

Conceptually:

```text
snapshot
   ↓
START GAME
   ↓
joystick right
fire
right
right
up
...
   ↓
interesting level
```

can become reproducible.

For reverse engineering, that's useful because you could create scenarios such as:

```text
boot.game
reach.title
start.game
reach.level1
die
reach.highscore
```

Then repeatedly replay exactly the same input sequence while changing breakpoints or instrumentation.

That's potentially extremely valuable.

For example:

```text
Replay: reach_level_2

experiment 1:
    watch $D000-$D02E

experiment 2:
    watch $0400-$07FF

experiment 3:
    profile execution

experiment 4:
    collect CPU history
```

All four experiments can follow essentially the same execution path.

---

# 6. Snapshots deserve to become a core feature

You already have snapshot access via the binary protocol, so this isn't another executable, but I would use it heavily.

Imagine maintaining:

```text
snapshots/
    booted.vsf
    title-screen.vsf
    game-start.vsf
    level1.vsf
    boss1.vsf
```

Then analysis doesn't repeatedly have to:

```text
boot disk
↓
load
↓
decrunch
↓
title
↓
press fire
↓
wait
↓
play
```

You jump straight to:

```text
boss1.vsf
```

and run the experiment.

This becomes especially powerful with your binary monitor:

```text
load snapshot
↓
install watchpoints
↓
warp
↓
checkpoint
↓
CPU history
↓
analyze
```

---

# 7. Debug builds can expose CPU/IEC tracing

VICE has additional debug facilities when compiled appropriately.

The documented debug resources include CPU traces for the main CPU and drives and bus tracing such as:

```text
MainCPU_TRACE
Drive0CPU_TRACE
Drive1CPU_TRACE

IEC_TRACE
IEEE_TRACE
```

Some are only present in DEBUG builds. ([vice-emu.sourceforge.io][7])

**IEC trace is particularly interesting for you.**

For custom disk loaders:

```text
C64 CPU
   │
   │ IEC
   ▼
1541
   │
   ▼
drive CPU
```

you potentially have three useful observation points:

```text
C64 execution trace
IEC communication trace
1541 execution trace
```

Combined with VICE's ability to monitor the drive CPU, this could make fastloader reverse engineering significantly easier.

---

# 8. Debug cartridge/test harness

VICE also has a special:

```bash
-debugcart
```

facility used by its own test suite. The documented `DebugCartEnable` resource enables a debug cartridge intended for automated testing. ([vice-emu.sourceforge.io][7])

This is more relevant when **developing your own C64 code** than when reverse engineering an untouched game.

It gives C64-side test programs a way of communicating test status to the host/test infrastructure.

I wouldn't prioritize this initially, but it could be useful later for your automated validation environment.

---

# 9. `vsid`

VICE also ships:

```bash
vsid
```

which is a dedicated SID player. ([vice-emu.sourceforge.io][5])

It's interesting if your reverse-engineering system extracts music routines.

For example:

```text
Game
 │
 ├── gameplay code
 ├── graphics
 └── SID player
       ↓
       identify
       ↓
       extract
       ↓
      VSID
```

VICE's SID subsystem also has options for different SID models, extra SIDs and even raw reSID output. ([vice-emu.sourceforge.io][8])

Not central to general reverse engineering, but useful for music-specific analysis.

---

# 10. Exit screenshots and media recording

VICE has a surprisingly useful command-line option:

```bash
-exitscreenshot result.png
```

which writes a screenshot when the emulator exits. ([vice-emu.sourceforge.io][5])

For your automation this could give you simple regression tests:

```text
run game for scenario X
        ↓
exit
        ↓
result.png
        ↓
compare against expected image
```

Although because the binary monitor already gives you `DISPLAY_GET`, I'd normally use that instead.

VICE also includes screenshot/audio/video recording facilities. ([vice-emu.sourceforge.io][9])

---

# What I'd actually integrate

For the system we've been discussing, I would expand the architecture to:

```text
                         C64 RE TOOL
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
     PREPROCESSING         DYNAMIC             STATIC
          │                ANALYSIS            ANALYSIS
          │                   │                    │
       c1541              VICE x64/x64sc          Ghidra
          │                   │                    │
       petcat             Binary monitor          da65
          │                   │                    │
      cartconv             Text monitor            dxa
          │                   │
          │               CPU history
          │               profiler
          │               memmap
          │               watchpoints
          │               snapshots
               event replay
          │               IEC trace
          │
          └───────────────────┼─────────────────────
                              ↓
                       accumulated knowledge
                              ↓
                     symbols / code / data
```

And I would add these **first**, in this order:

1. **`c1541`** — inspect/extract disk contents and sector layout.
2. **`petcat`** — automatically identify BASIC bootstraps and `SYS` entry points.
3. **Snapshot manager** — reproducible runtime analysis points.
4. **VICE event replay** — repeat exactly the same gameplay scenarios.
5. **`cartconv`** — automatically handle CRT/banked cartridges.
6. **x64 ↔ x64sc switching** — fast initial analysis, accurate verification.
7. **IEC + drive CPU tracing** — when the analyzer detects a custom loader.

The combination of **`c1541` + dynamic VICE analysis** is especially valuable: `c1541` tells you what the disk *claims* is a file, while monitoring the actual 1541 execution tells you what sectors the game *really reads*. That difference is exactly where many loaders, protections and hidden data structures become visible. ([vice-emu.sourceforge.io][2])

[1]: https://vice-emu.sourceforge.io/vice_toc.html "VICE Manual - Table of Contents"
[2]: https://vice-emu.sourceforge.io/vice_14.html "VICE Manual - 14 c1541"
[3]: https://vice-emu.sourceforge.io/vice_16.html "VICE Manual - 16 petcat"
[4]: https://vice-emu.sourceforge.io/vice_15.html "VICE Manual - 15 cartconv"
[5]: https://vice-emu.sourceforge.io/vice_2.html?utm_source=chatgpt.com "VICE Manual - 2 Invoking the emulators"
[6]: https://vice-emu.sourceforge.io/vice_11.html?utm_source=chatgpt.com "VICE Manual - 11 Event history"
[7]: https://vice-emu.sourceforge.io/vice_6.html?utm_source=chatgpt.com "VICE Manual - 6 Settings and resources"
[8]: https://vice-emu.sourceforge.io/vice_7.html?utm_source=chatgpt.com "VICE Manual - 7 Machine-specific features"
[9]: https://vice-emu.sourceforge.io/vice_3.html?utm_source=chatgpt.com "VICE Manual - 3 System files"
