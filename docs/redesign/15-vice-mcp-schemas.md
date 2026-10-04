# 15 — VICE MCP schemas

## 1. Status

This document freezes the v1 LLM-facing schema baseline for the VICE MCP.

Implementation may change internal protocol, VICE adapter, parser or broker details without changing this contract.

The MCP exposes no project knowledge, no host-tool operations and no infrastructure/version information.

## 2. General result rules

Successful tools return their domain result directly.

Do not wrap normal results in generic objects such as:

~~~text
ok
operation
result
request_id
~~~

MCP/tool failure carries an actionable domain error.

Normal results never expose:

- broker/session/request IDs;
- VICE executable paths or versions;
- protocol/package/schema versions;
- monitor route/command;
- staging paths;
- stack traces.

## 3. Canonical shared types

### Address

Canonical output:

~~~text
$0000 .. $ffff
~~~

Input accepts upper/lower hex digits but always requires the dollar-prefixed four-digit form.

Conceptual validation:

~~~text
^\$[0-9a-fA-F]{4}$
~~~

Outputs normalize hex digits to lowercase.

Semantic names such as update_player are not MCP addresses. Skills resolve project/source symbols before calling MCP.

### Byte

JSON integer:

~~~text
0 .. 255
~~~

### HexData

Binary data returned as a compact even-length lowercase hexadecimal string without separators or prefix.

Example:

~~~text
a9008d20d0
~~~

### Space

~~~text
c64
drive8
~~~

Default where applicable:

~~~text
c64
~~~

### MemoryView

~~~text
cpu
ram
~~~

Default:

~~~text
cpu
~~~

ram is initially valid only for space=c64.

### RunState

~~~text
running
stopped
~~~

There is no public unknown state. If the runtime cannot establish machine state, the operation fails.

### VideoStandard

~~~text
pal
ntsc
~~~

PAL is the normal/default session profile.

### Named transient object

Visual baselines and snapshots use caller-chosen names:

~~~text
1..64 characters
letters, digits, dot, underscore, hyphen
~~~

They are session-local and are lost when the session ends or emulator state is lost.

## 4. Execution-state semantics

Read-only observation operations preserve the machine's prior running/stopped state unless their documented purpose is execution control.

This includes:

- memory/register reads;
- search/compare/disassemble;
- screen capture/compare;
- VIC-II/CIA/SID/sprite reads;
- history/profile/backtrace/memmap reads;
- c64_observe.

The implementation may pause internally to obtain a coherent observation and then restore the prior state.

Direct CPU-state mutation is intentionally stricter:

- c64_memory_write requires the selected CPU to be stopped;
- c64_registers action=set requires the selected CPU to be stopped.

They leave it stopped.

Execution, reset, autostart, program load and snapshot restore have their own explicit state semantics.

## 5. Error contract

Tool errors expose a stable actionable code plus a short message.

Initial public codes:

~~~text
invalid-input
machine-running
machine-unavailable
machine-state-lost
not-found
media-error
limit-exceeded
unsupported-in-space
installation-incomplete
operation-failed
~~~

Exact infrastructure causes remain in logs/human diagnostics.

Timeout while waiting for a run target is not a tool error; it is a normal c64_run_until result with stopReason=timeout.

## 6. Typed condition

There is no generic expression language and no VICE monitor condition string in the public API.

A condition is exactly one of these forms.

### Register condition

~~~json
{
  "kind": "register",
  "register": "a",
  "operator": "eq",
  "value": 66
}
~~~

register:

~~~text
a
x
y
sp
~~~

operator:

~~~text
eq
ne
lt
lte
gt
gte
~~~

value: Byte.

### Memory condition

~~~json
{
  "kind": "memory",
  "address": "$c020",
  "operator": "eq",
  "value": 3,
  "space": "c64",
  "view": "cpu"
}
~~~

operator uses the same comparison enum.

For a write watchpoint, a memory condition observes post-write memory state.

### Raster condition

~~~json
{
  "kind": "raster",
  "line": 100,
  "cycle": 20
}
~~~

cycle is optional.

The runtime validates line/cycle against the session's PAL/NTSC profile.

No compound all/any/not conditions are part of v1.

## 7. c64_status

Input:

~~~json
{}
~~~

Output:

~~~json
{
  "state": "stopped",
  "videoStandard": "pal",
  "warp": false,
  "window": false,
  "pc": "$2100"
}
~~~

pc is present only when the C64 CPU is stopped. window is true while the c64_window window is open (D20 in docs/plan.md).

## 8. c64_reset

Input:

~~~json
{
  "mode": "hard",
  "run": false
}
~~~

mode:

~~~text
soft
hard
~~~

run defaults to false.

Output:

~~~json
{
  "state": "stopped",
  "pc": "$fce2"
}
~~~

pc is the reset vector and is present only when run is false (D21 in docs/plan.md).

Reset invalidates transient machine-derived state that cannot survive reset. Visual baselines remain usable only if explicitly defined as screen images rather than machine-state handles.

## 9. c64_warp

Input:

~~~json
{
  "enabled": true
}
~~~

Output:

~~~json
{
  "enabled": true
}
~~~

The operation preserves the prior run state.

### 9a. c64_window

Added by D20 in docs/plan.md. VICE runs headless; open moves the machine into a VICE with a window, close moves it back.

Input:

~~~json
{
  "action": "open"
}
~~~

action:

~~~text
open
close
~~~

Output:

~~~json
{
  "window": true,
  "state": "running",
  "notCarried": ["cpu history", "memory map", "profile", "keyboard input not yet typed"]
}
~~~

The move keeps the machine (disk in drive 8 included), breakpoint and watchpoint ids, joysticks, warp, the c64_timing stopwatch and the run state. notCarried names what the move cleared. A request for the current mode changes nothing and returns an empty notCarried. If the window closes without close, the next operation fails once with machine-state-lost and the machine is headless in the state of when the window opened.

## 10. c64_execution

Input:

~~~json
{
  "action": "step",
  "count": 1,
  "space": "c64"
}
~~~

action:

~~~text
pause
resume
step
next
until-return
advance-frames
~~~

count:

- required for advance-frames;
- optional/default 1 for step and next;
- omitted for pause, resume and until-return;
- integer 1..10000.

space defaults to c64 and applies to step/next/until-return. advance-frames is a C64-machine operation and uses the C64 timing domain.

Representative outputs:

pause:

~~~json
{
  "state": "stopped",
  "pc": "$2100"
}
~~~

resume:

~~~json
{
  "state": "running"
}
~~~

step/next:

~~~json
{
  "state": "stopped",
  "pc": "$2102",
  "executed": 1
}
~~~

until-return:

~~~json
{
  "state": "stopped",
  "pc": "$1980"
}
~~~

advance-frames:

~~~json
{
  "state": "stopped",
  "pc": "$2137",
  "advancedFrames": 20
}
~~~

advance-frames always finishes stopped.

## 11. c64_run_until

Input uses one target.

### Address target

~~~json
{
  "target": {
    "kind": "address",
    "address": "$2100",
    "space": "c64",
    "condition": {
      "kind": "register",
      "register": "a",
      "operator": "eq",
      "value": 66
    }
  },
  "timeoutFrames": 3000
}
~~~

condition is optional.

### Memory target

Stops when a write causes the requested memory predicate to become true.

~~~json
{
  "target": {
    "kind": "memory",
    "address": "$c020",
    "operator": "eq",
    "value": 3,
    "space": "c64",
    "view": "cpu"
  },
  "timeoutFrames": 3000
}
~~~

### Raster target

~~~json
{
  "target": {
    "kind": "raster",
    "line": 100,
    "cycle": 20
  },
  "timeoutFrames": 3000
}
~~~

timeoutFrames:

~~~text
1 .. 30000
default 3000
~~~

Output:

~~~json
{
  "reached": true,
  "stopReason": "target",
  "state": "stopped",
  "pc": "$2100"
}
~~~

stopReason:

~~~text
target
breakpoint
watchpoint
jam
timeout
~~~

Every normal return leaves the C64 CPU stopped.

## 12. c64_breakpoint

One tool owns breakpoint lifecycle.

action:

~~~text
add
remove
enable
disable
list
~~~

Add:

~~~json
{
  "action": "add",
  "address": "$2100",
  "space": "c64",
  "condition": {
    "kind": "register",
    "register": "a",
    "operator": "eq",
    "value": 66
  }
}
~~~

condition is optional.

Output:

~~~json
{
  "id": 4,
  "address": "$2100",
  "space": "c64",
  "enabled": true
}
~~~

Remove/enable/disable use:

~~~json
{
  "action": "disable",
  "id": 4
}
~~~

List input:

~~~json
{
  "action": "list"
}
~~~

List output:

~~~json
{
  "breakpoints": [
    {
      "id": 4,
      "address": "$2100",
      "space": "c64",
      "enabled": true
    }
  ]
}
~~~

IDs are positive session-local integers.

A breakpoint added with a condition carries that condition in every output, in the input form with addresses as `$xxxx` (D21 in docs/plan.md).

## 13. c64_watchpoint

action:

~~~text
add
remove
enable
disable
list
~~~

Add:

~~~json
{
  "action": "add",
  "address": "$c020",
  "size": 2,
  "access": "write",
  "space": "c64",
  "condition": {
    "kind": "memory",
    "address": "$c020",
    "operator": "eq",
    "value": 3,
    "space": "c64",
    "view": "cpu"
  }
}
~~~

size:

~~~text
1 .. 256
default 1
~~~

access:

~~~text
read
write
read-write
~~~

condition is optional.

Output:

~~~json
{
  "id": 7,
  "address": "$c020",
  "size": 2,
  "access": "write",
  "space": "c64",
  "enabled": true
}
~~~

Lifecycle actions mirror c64_breakpoint. A watchpoint added with a condition carries it in every output, as a breakpoint does (D21).

## 14. c64_memory_read

Input:

~~~json
{
  "address": "$2000",
  "size": 32,
  "space": "c64",
  "view": "cpu"
}
~~~

size:

~~~text
1 .. 4096
~~~

Output:

~~~json
{
  "address": "$2000",
  "size": 32,
  "data": "a9008d20d0..."
}
~~~

No encoding selector exists.

## 15. c64_memory_write

Input:

~~~json
{
  "address": "$2000",
  "data": "a9008d20d0",
  "space": "c64",
  "view": "cpu"
}
~~~

Maximum data length: 4096 bytes.

Requires the selected CPU to be stopped.

Output:

~~~json
{
  "address": "$2000",
  "bytesWritten": 5
}
~~~

## 16. c64_memory_search

Input:

~~~json
{
  "start": "$0800",
  "end": "$ffff",
  "pattern": "a9 ?? 8d 20 d0",
  "space": "c64",
  "view": "cpu",
  "maxResults": 100
}
~~~

pattern is a sequence of byte tokens:

~~~text
00..ff
??
~~~

Maximum pattern length: 256 bytes.

maxResults:

~~~text
1 .. 1000
default 100
~~~

Output:

~~~json
{
  "matches": [
    "$2100",
    "$37a0"
  ]
}
~~~

## 17. c64_memory_compare

Input:

~~~json
{
  "left": {
    "address": "$2000",
    "space": "c64",
    "view": "cpu"
  },
  "right": {
    "address": "$3000",
    "space": "c64",
    "view": "cpu"
  },
  "size": 256
}
~~~

size:

~~~text
1 .. 4096
~~~

Output:

~~~json
{
  "equal": false,
  "differentBytes": 3,
  "firstDifferences": [
    {
      "offset": 12,
      "left": 4,
      "right": 5
    }
  ]
}
~~~

firstDifferences is capped at 32 entries.

## 18. c64_registers

### Get

Input:

~~~json
{
  "action": "get",
  "space": "c64"
}
~~~

Output:

~~~json
{
  "pc": "$2100",
  "a": 66,
  "x": 3,
  "y": 0,
  "sp": 249,
  "flags": {
    "n": false,
    "v": false,
    "b": false,
    "d": false,
    "i": true,
    "z": false,
    "c": true
  }
}
~~~

### Set

Input:

~~~json
{
  "action": "set",
  "space": "c64",
  "values": {
    "pc": "$2100",
    "a": 66,
    "x": 3
  }
}
~~~

values may contain any subset of:

~~~text
pc
a
x
y
sp
flags
~~~

flags may contain any subset of n/v/b/d/i/z/c booleans.

Requires selected CPU stopped.

Output is the complete post-write register state using the same shape as get.

## 19. c64_disassemble

This is live-machine disassembly, not DXA/Ghidra static analysis.

Input:

~~~json
{
  "address": "$2100",
  "count": 12,
  "space": "c64",
  "view": "cpu"
}
~~~

count:

~~~text
1 .. 256
~~~

Output:

~~~json
{
  "instructions": [
    {
      "address": "$2100",
      "bytes": "a900",
      "text": "LDA #$00"
    }
  ]
}
~~~

Self-modified/unpacked live RAM is therefore inspectable without routing through static-analysis skills.

## 20. c64_cpu_history

Input:

~~~json
{
  "limit": 50,
  "space": "c64"
}
~~~

limit:

~~~text
1 .. 200
default 50
~~~

Output:

~~~json
{
  "entries": [
    {
      "address": "$2100",
      "bytes": "a900",
      "text": "LDA #$00",
      "a": 0,
      "x": 3,
      "y": 0,
      "sp": 249,
      "rasterLine": 100,
      "rasterCycle": 20
    }
  ]
}
~~~

## 21. c64_backtrace

Input:

~~~json
{
  "depth": 16,
  "space": "c64"
}
~~~

depth:

~~~text
1 .. 64
default 16
~~~

Output:

~~~json
{
  "frames": [
    {
      "address": "$2100",
      "returnAddress": "$1980"
    }
  ]
}
~~~

returnAddress may be absent for a frame where no reliable return location can be reconstructed.

## 22. c64_profile

C64 CPU only in v1.

Input:

~~~json
{
  "limit": 20
}
~~~

limit:

~~~text
1 .. 100
default 20
~~~

Output:

~~~json
{
  "entries": [
    {
      "address": "$2100",
      "totalCycles": "125000",
      "selfCycles": "82000",
      "percent": 17.4
    }
  ]
}
~~~

Cycle counts are decimal strings to avoid integer-width ambiguity.

## 23. c64_memmap

C64 CPU only in v1.

Read:

~~~json
{
  "action": "read",
  "start": "$0800",
  "end": "$ffff",
  "maxRanges": 256
}
~~~

start/end are optional.

maxRanges:

~~~text
1 .. 1000
default 256
~~~

Output:

~~~json
{
  "ranges": [
    {
      "start": "$2100",
      "end": "$213f",
      "execute": true,
      "read": true,
      "write": false
    }
  ]
}
~~~

Clear:

~~~json
{
  "action": "clear"
}
~~~

Output:

~~~json
{
  "cleared": true
}
~~~

## 24. c64_timing

One session-local stopwatch.

Start:

~~~json
{
  "action": "start"
}
~~~

Output:

~~~json
{
  "started": true
}
~~~

Read:

~~~json
{
  "action": "read"
}
~~~

Output:

~~~json
{
  "cycles": "1234"
}
~~~

cycles is a decimal string.

## 25. c64_vicii

Input:

~~~json
{}
~~~

Output:

~~~json
{
  "rasterLine": 100,
  "mode": "multicolor-text",
  "screenAddress": "$0400",
  "graphicsAddress": "$2000",
  "scrollX": 0,
  "scrollY": 3,
  "borderColor": 6,
  "backgroundColors": [14, 0, 0, 0]
}
~~~

mode:

~~~text
text
multicolor-text
extended-color-text
bitmap
multicolor-bitmap
invalid
~~~

## 26. c64_sprite

Input:

~~~json
{
  "sprites": [0, 1]
}
~~~

sprites is optional; omission means all eight.

Output:

~~~json
{
  "sprites": [
    {
      "index": 0,
      "x": 145,
      "y": 96,
      "enabled": true,
      "color": 1,
      "multicolor": false,
      "expandX": false,
      "expandY": false,
      "behindBackground": false,
      "dataAddress": "$3000"
    }
  ]
}
~~~

## 27. c64_cia

Input:

~~~json
{
  "cia": "both"
}
~~~

cia:

~~~text
1
2
both
~~~

Output:

~~~json
{
  "chips": [
    {
      "id": 1,
      "portA": 255,
      "portB": 127,
      "ddrA": 0,
      "ddrB": 255,
      "timerA": 65535,
      "timerB": 65535,
      "controlA": 0,
      "controlB": 0,
      "interruptStatus": 0,
      "tod": {
        "hours": 12,
        "minutes": 34,
        "seconds": 56,
        "tenths": 7
      }
    }
  ]
}
~~~

## 28. c64_sid

Input:

~~~json
{}
~~~

Output:

~~~json
{
  "voices": [
    {
      "index": 1,
      "frequency": 8192,
      "pulseWidth": 2048,
      "control": 17,
      "attackDecay": 34,
      "sustainRelease": 248
    }
  ],
  "filter": {
    "cutoff": 1024,
    "resonance": 8,
    "routing": 7,
    "mode": 5
  },
  "volume": 15
}
~~~

The tool exposes register-derived SID state, not perceptual audio analysis.

## 29. c64_screen

action:

~~~text
capture
compare
list
discard
~~~

### Capture

~~~json
{
  "action": "capture",
  "baseline": "title-original"
}
~~~

baseline is optional. When present, the captured frame is retained under that session-local name.

Structured output:

~~~json
{
  "width": 384,
  "height": 272,
  "baseline": "title-original"
}
~~~

The tool also returns an MCP image content block for human/LLM inspection.

### Compare

~~~json
{
  "action": "compare",
  "baseline": "title-original",
  "maxMismatchRatio": 0,
  "mask": [
    {
      "x": 250,
      "y": 20,
      "width": 80,
      "height": 16
    }
  ],
  "includeDiff": false
}
~~~

maxMismatchRatio:

~~~text
0.0 .. 1.0
default 0
~~~

mask is optional rectangular exclusion regions.

Output:

~~~json
{
  "match": false,
  "mismatchingPixels": 42,
  "mismatchRatio": 0.000402,
  "bounds": {
    "x": 112,
    "y": 84,
    "width": 18,
    "height": 21
  }
}
~~~

bounds is absent when there are no mismatching pixels.

When includeDiff=true, a difference image content block is also returned.

### List

~~~json
{
  "action": "list"
}
~~~

Output:

~~~json
{
  "baselines": [
    "title-original"
  ]
}
~~~

### Discard

~~~json
{
  "action": "discard",
  "baseline": "title-original"
}
~~~

Output:

~~~json
{
  "discarded": true
}
~~~

## 30. c64_observe

Captures selected observations at one coherent halted machine moment, then restores the prior run state.

Input:

~~~json
{
  "registers": "c64",
  "memory": [
    {
      "address": "$c020",
      "size": 2,
      "space": "c64",
      "view": "cpu"
    }
  ],
  "vicii": true,
  "sprites": [0, 1],
  "cia": "both",
  "sid": true,
  "screen": true,
  "timing": true
}
~~~

All fields are optional but at least one observation must be requested.

Bounds:

- at most 16 memory ranges;
- at most 4096 memory bytes total;
- sprites contains unique indices 0..7;
- one screen per call.

Output contains only requested sections:

~~~json
{
  "registers": {
    "pc": "$2100",
    "a": 12,
    "x": 0,
    "y": 4,
    "sp": 247,
    "flags": {
      "n": false,
      "v": false,
      "b": false,
      "d": false,
      "i": true,
      "z": false,
      "c": false
    }
  },
  "memory": [
    {
      "address": "$c020",
      "data": "9160"
    }
  ],
  "timing": {
    "rasterLine": 100,
    "rasterCycle": 20
  }
}
~~~

If screen=true, an image content block is also returned.

## 31. c64_keyboard

Input:

~~~json
{
  "mode": "text",
  "text": "RUN\n"
}
~~~

or:

~~~json
{
  "mode": "petscii",
  "bytes": [82, 85, 78, 13]
}
~~~

mode:

~~~text
text
petscii
~~~

Maximum queued input: 1024 bytes.

The operation preserves the prior run state.

Output:

~~~json
{
  "queuedBytes": 4
}
~~~

## 32. c64_joystick

Input:

~~~json
{
  "port": 2,
  "direction": "left",
  "fire": false
}
~~~

port:

~~~text
1
2
~~~

direction:

~~~text
center
up
down
left
right
up-left
up-right
down-left
down-right
~~~

fire defaults false.

The selected state remains held until changed.

Output echoes the logical state:

~~~json
{
  "port": 2,
  "direction": "left",
  "fire": false
}
~~~

## 33. c64_autostart

Input:

~~~json
{
  "path": "original/game.d64",
  "index": 0,
  "run": true
}
~~~

path is project-relative in the MCP/client environment and is transferred as bytes. The host never relies on the client filesystem path.

index defaults 0.

run defaults true.

Output:

~~~json
{
  "state": "running"
}
~~~

## 34. c64_program_load

Loads a PRG without reset or automatic execution.

Input:

~~~json
{
  "path": "build/game.prg",
  "address": "$2000"
}
~~~

address is optional; omission uses the PRG load address.

The operation finishes stopped.

Output:

~~~json
{
  "state": "stopped",
  "loadAddress": "$2000",
  "size": 8192
}
~~~

## 35. c64_disk_attach

Attaches a disk image to drive 8.

Input:

~~~json
{
  "path": "original/game.d64"
}
~~~

The operation preserves prior C64 run state.

Output:

~~~json
{
  "attached": true
}
~~~

No unit selector exists in v1.

## 36. c64_snapshot

action:

~~~text
save
restore
list
discard
~~~

### Save

~~~json
{
  "action": "save",
  "name": "before-boss"
}
~~~

Output:

~~~json
{
  "saved": true,
  "name": "before-boss"
}
~~~

### Restore

~~~json
{
  "action": "restore",
  "name": "before-boss"
}
~~~

Output:

~~~json
{
  "restored": true,
  "state": "stopped"
}
~~~

A restored snapshot is normalized to stopped state for deterministic follow-up.

### List

~~~json
{
  "action": "list"
}
~~~

Output:

~~~json
{
  "snapshots": [
    "before-boss"
  ]
}
~~~

### Discard

~~~json
{
  "action": "discard",
  "name": "before-boss"
}
~~~

Output:

~~~json
{
  "discarded": true
}
~~~

Snapshots are session-local; filesystem snapshot paths are never exposed.

## 37. Public MCP tool list

The frozen v1 public list, with c64_window added by D20 in docs/plan.md, is:

~~~text
c64_status
c64_reset
c64_warp
c64_window

c64_execution
c64_run_until

c64_breakpoint
c64_watchpoint
c64_cpu_history
c64_backtrace
c64_profile
c64_memmap
c64_timing

c64_memory_read
c64_memory_write
c64_memory_search
c64_memory_compare
c64_registers
c64_disassemble

c64_vicii
c64_sprite
c64_cia
c64_sid
c64_screen
c64_observe

c64_keyboard
c64_joystick

c64_autostart
c64_program_load
c64_disk_attach
c64_snapshot
~~~

This list is intentionally C64-domain-oriented and does not mirror VICE's command vocabulary.

## 38. What is deliberately absent

No v1 public tool for:

- VICE capabilities/version/path;
- bank/register enumeration;
- symbol load/lookup;
- raw monitor commands;
- monitor device/memspace repair;
- generic host-tool execution;
- Ghidra/DXA/ACME/c1541/petcat;
- knowledge DB operations;
- project discovery;
- protocol diagnostics.

Those belong below the LLM-facing boundary or in other skill execution surfaces.
