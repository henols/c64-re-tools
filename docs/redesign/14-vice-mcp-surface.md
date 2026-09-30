# 14 — VICE MCP surface

## 1. Purpose

Define the public MCP surface for the one live VICE machine owned by an MCP process.

The MCP exposes C64 machine operations the LLM can use to inspect, control, debug or measure that machine. VICE monitor mechanics and infrastructure diagnostics remain internal.

## 2. Public-surface rule

A capability belongs in the MCP only when it directly helps the LLM reason about or control the live C64 machine.

Do not expose:

- VICE version/path information;
- capability matrices;
- monitor channel selection;
- broker/session/request identifiers;
- register/bank enumeration used only by the implementation;
- monitor default-device workarounds;
- raw monitor commands;
- MCP-side symbol-table management;
- transport/package compatibility details.

The Host Runtime resolves those details internally.

## 3. Session machine profile

Each MCP session starts with one fixed C64 machine profile.

Initially support:

~~~text
C64 PAL
C64 NTSC
~~~

PAL is the normal/default profile.

The profile is fixed for the lifetime of the MCP/VICE session. Changing PAL/NTSC means starting a fresh session rather than mutating timing assumptions mid-investigation.

The LLM may see the active machine profile because it materially affects timing and equivalence reasoning.

## 4. CPU/memory spaces

Low-level debugging supports explicit machine spaces:

~~~text
c64
drive8
~~~

This preserves the ability to reverse engineer fast loaders, custom drive code and copy protection.

All VICE-specific default-memspace handling stays internal. The LLM selects the intended logical CPU/memory space; it never repairs monitor state itself.

Further drive units are not added without a concrete requirement.

## 5. Address inputs

MCP operations accept resolved addresses, not project semantic symbol names.

Semantic resolution happens before the MCP call:

~~~text
project knowledge/source symbol
        ↓
resolved address
        ↓
MCP operation
~~~

This keeps project knowledge ownership outside the MCP.

## 6. Proposed tool families

The exact schemas are defined separately during implementation, but the intended public responsibilities are:

### Machine

~~~text
c64_status
c64_reset
c64_warp
~~~

### Execution

~~~text
c64_execution
c64_run_until
~~~

c64_execution covers stateful execution primitives such as:

~~~text
pause
resume
step
next
until-return
advance-frames
~~~

advance-frames is a C64-domain operation. How VICE/raster state implements it is internal.

### Debug

~~~text
c64_breakpoint
c64_watchpoint
c64_cpu_history
c64_backtrace
c64_profile
c64_memmap
c64_timing
~~~

Breakpoint/watchpoint tools may group create/list/enable/disable/remove operations rather than expose one MCP tool per CRUD verb.

### Memory/CPU

~~~text
c64_memory_read
c64_memory_write
c64_memory_search
c64_memory_compare
c64_registers
~~~

These support an explicit space such as c64 or drive8 where the operation is meaningful.

### Video/I/O

~~~text
c64_screen
c64_observe
c64_vicii
c64_sprite
c64_cia
~~~

### User input

~~~text
c64_keyboard
c64_joystick
~~~

### Media/state

~~~text
c64_autostart
c64_program_load
c64_disk_attach
c64_snapshot
~~~

The goal is a compact domain surface, not a one-to-one mirror of every VICE monitor command.

## 7. Screen capture and comparison

Visual testing is first-class.

c64_screen owns temporary session-local visual baselines.

Conceptual actions:

~~~text
capture
compare
discard
~~~

Example:

~~~text
capture baseline original-game-start
...
compare current screen against original-game-start
~~~

The implementation should capture a canonical emulator-rendered C64 frame rather than a desktop/window screenshot.

A comparison can return useful domain-level information such as:

- exact match;
- mismatching pixel count;
- mismatch percentage;
- difference bounds;
- optional difference image/artifact when useful.

Explicit threshold/mask policy comes from the test scenario.

Baseline images are temporary MCP-session state. They do not belong in knowledge.db.

## 8. Atomic composite observation

c64_observe captures a selected group of observations from one halted machine moment.

Possible requested components include:

~~~text
CPU registers
selected memory ranges
VIC-II state
sprites
CIA state
screen
timing/raster position
~~~

The operation exists because separately issuing several MCP calls can allow the machine state or observation moment to drift between reads.

The caller chooses only the domain observations it needs; the result must remain bounded.

This operation is especially valuable at functional-test checkpoints.

## 9. Frame advancement

Testing/gameplay workflows need deterministic frame-relative input.

The MCP therefore supports advancing a requested number of emulated frames while preserving a clear final stopped state.

Example:

~~~text
hold joystick LEFT
advance 20 frames
release joystick
capture observation
~~~

The public API does not expose the VICE/raster/checkpoint mechanism used to achieve the frame boundary.

## 10. Stateful visual/testing data

Temporary baselines and other transient comparison material belong to the MCP session, not the project.

They disappear when the session closes or VICE state is lost.

The LLM should refer to them through short caller-chosen names rather than receiving/re-sending large encoded images solely for machine comparison.

## 11. Result design

Every MCP result contains only information useful for machine-level reasoning or the requested action.

Examples of useful results:

~~~text
machine stopped at $2100
breakpoint hit by execution
sprite 0 x = 145
screen differs in one rectangle
20 frames advanced
VICE state was lost and a fresh machine was started
~~~

Do not expose implementation-only data such as:

~~~text
monitor request id
binary/text monitor route
resolved executable path
protocol version
broker grant
temporary host path
raw monitor command
~~~

## 12. Recovery

If VICE crashes:

- fail the current operation;
- report that emulator state and temporary baselines were lost;
- the Host Runtime may create a fresh VICE for the same MCP connection;
- never replay a potentially state-changing operation automatically.

## 13. Relationship to testing

The testing skill composes MCP primitives rather than adding a second emulator API.

Typical checkpoint flow:

~~~text
establish/load state
    ↓
provide input
    ↓
run_until / advance-frames
    ↓
c64_observe
    ↓
screen/state comparison
~~~

Original and rebuild normally run sequentially through the same MCP session.

## 14. Next design step

Freeze the exact input/output schemas for these tool families, with particular attention to:

- execution/run-until stop reasons;
- breakpoint/watchpoint conditions;
- screen baseline/compare representation;
- bounded composite observations;
- drive8 space semantics;
- snapshot naming/lifetime;
- state-changing versus read-only behavior.
