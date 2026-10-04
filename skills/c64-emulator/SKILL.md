---
name: c64-emulator
description: Use this skill to operate and debug the live C64 emulator through the c64-re-tools MCP tools, whose names start with c64_. It loads programs and disks, controls and steps the CPU, and sets breakpoints and watchpoints. It reads and writes memory and registers, types keys, moves a joystick, advances frames and captures the screen. Do not use it for static analysis, project knowledge, assembly or disk inspection.
---

# c64-emulator

## Purpose

Operate and debug the one live C64 that belongs to this MCP session. Get runtime evidence and runtime state from it.

This skill does not analyse code statically. It does not write project knowledge. It does not assemble source code.

## Inputs

- The machine action or the runtime question.
- The target address, state or condition, when the question needs one.
- The project path of the program or disk to load, when the question needs one.

Addresses are four hex digits after a dollar sign, for example `$c000`. Resolve a symbol name to its address before you use a tool. The c64-knowledge skill gives the address of a known symbol.

## Tools / execution path

Use only the MCP tools. Each MCP session has its own C64. Nothing else can change that C64.

| Need | Tool |
|---|---|
| Run state, video standard, warp mode | `c64_status` |
| Reset, power cycle | `c64_reset` |
| Fast emulation | `c64_warp` |
| Stop, start, step, step over, step out, exact frames | `c64_execution` |
| Run until an address, a memory value or a raster position | `c64_run_until` |
| Stop on an instruction address | `c64_breakpoint` |
| Stop on a memory read or write | `c64_watchpoint` |
| Memory | `c64_memory_read`, `c64_memory_write`, `c64_memory_search`, `c64_memory_compare` |
| CPU registers | `c64_registers` |
| Code as it is in memory now | `c64_disassemble` |
| Executed instructions, call chain | `c64_cpu_history`, `c64_backtrace` |
| Where the CPU spends cycles, which memory it uses | `c64_profile`, `c64_memmap` |
| Cycle count between two points | `c64_timing` |
| Video chip, sprites, CIAs, sound chip | `c64_vicii`, `c64_sprite`, `c64_cia`, `c64_sid` |
| Screen image, screen compare | `c64_screen` |
| Several of these from one moment | `c64_observe` |
| Keys, joystick | `c64_keyboard`, `c64_joystick` |
| Program and disk media | `c64_autostart`, `c64_program_load`, `c64_disk_attach` |
| Machine state to go back to | `c64_snapshot` |

Each memory and register tool has a `space`. Use `c64` for the computer. Use `drive8` for the CPU of the 1541 disk drive. The memory `view` is `cpu` or `ram`. With `cpu`, you see what the CPU sees now, with ROM and I/O where the memory configuration puts them. With `ram`, you see the RAM under them.

## Workflow

1. Read the project knowledge for the addresses in the question. Use the c64-knowledge skill.
2. Get the machine state with `c64_status`.
3. Load the subject if it is not loaded. Use `c64_autostart` to start it as a user does. Use `c64_program_load` to put a PRG in memory with no start.
4. Set the stop condition. Use a breakpoint, a watchpoint or a `c64_run_until` target. Add a typed condition when the stop must occur only in one state.
5. Run, step or give input. Prefer `c64_run_until` and `advance-frames` to waits. They stop at the same emulated time on every run.
6. Read only the state that answers the question. To read several things from one moment, use `c64_observe`.
7. Interpret the evidence. Keep the observed facts apart from your conclusions.

Write operations need a stopped CPU. Stop the CPU with `c64_execution` action `pause` first.

Step, next and until-return work only in space `c64`. The emulator cannot stop the disk drive CPU after one instruction. To find when the drive executes an address, use `c64_run_until` with an address target in space `drive8`, or a breakpoint in space `drive8`. The drive can execute a few more instructions before it stops. The `pc` in the result is the drive address where it stopped.

Before a risky experiment, save the state with `c64_snapshot`. Restore it to try again from the same point.

A read does not change the run state. A running machine continues to run after a read.

## Knowledge

Read:
- the current knowledge for each address and range that the question touches.

Automatic write:
- none.

Write after interpretation:
- a symbol, a region or a comment that the runtime evidence justifies. Record it with the c64-knowledge skill.

Do not store:
- breakpoints or watchpoints
- memory reads
- temporary machine state
- a screen capture, unless the user asks for it as an artifact

## Result

The result is the runtime state or evidence that the question asks for.

If you cannot get the machine into the necessary state, say which state you could not get. Say what you tried.

## Failure and conflicts

- `machine-state-lost`: the emulator stopped and its state is gone. Do not continue with results from before. Tell the user to restart the MCP server.
- `machine-unavailable`: the host runtime does not run, or it does not answer. Tell the user to start `c64-re-tools-host`.
- `machine-running`: stop the CPU first, then try again.
- `installation-incomplete`: tell the user the message. Do not try to repair the installation.
- `c64_run_until` with `stopReason` `timeout`: the target did not occur in the frame limit. This is evidence too. Report it.
- `c64_run_until` with `stopReason` `jam`: the CPU executed a JAM opcode and stopped. Report the address.

If the runtime evidence does not agree with the current knowledge, do not change the knowledge. Report the conflict and hand it to c64-knowledge.

## Handoffs

- Static explanation of code → c64-static-analysis
- Durable conclusion or a knowledge conflict → c64-knowledge
- Comparison or assertion between runs → c64-testing
- Meaning of a C64 address or register → c64-memory-map
