---
name: retro-emulator
description: Operates and debugs the live emulator through the MCP tools of the machine server. It loads programs and disks, controls and steps the CPU, and sets breakpoints and watchpoints. It reads and writes memory and registers, gives keyboard and joystick input, advances frames and captures the screen. Use it to get runtime evidence or runtime state from the machine. Use it when the user must play or look at the program in a window. It does not analyze code statically, change the project knowledge, assemble source or list the files on a disk image.
---

# emulator

## Purpose

Operate and debug the one live machine that belongs to this MCP session. Get runtime evidence and runtime state from it.

This skill does not analyse code statically. It does not write project knowledge. It does not assemble source code.

The MCP server knows the machine and the emulator. Its instructions, its tool descriptions, its result fields and its error messages give the facts of the machine and the known flaws of the emulator. This skill tells how to use the tools for a task. If this skill and a tool description do not agree, obey the tool description.

## Inputs

- The machine action or the runtime question.
- The target address, state or condition, when the question needs one.
- The project path of the program or the media to load, when the question needs one.

A tool takes addresses, not names. The server instructions give the address format. Get the address of a name from the project knowledge.

## Tools

Use only the MCP tools. Each MCP session has its own machine. Nothing else can change that machine.

| Need | Tool |
|---|---|
| Reset, power cycle | `reset` |
| Fast emulation | `warp` |
| Show the machine to the user in a window, hide it again | `window` |
| Stop, start, step, step over, step out, exact frames | `execution` |
| Run until an address, a memory value or a beam position | `run_until` |
| Run to a place and read the machine there in one call | `run_until` with `observe` and `history` |
| Each access or routine entry over many frames | `trace` |
| Stop on an instruction address, stop on a memory access | `breakpoint`, `watchpoint` |
| Memory | `memory_read`, `memory_write`, `memory_search`, `memory_compare` |
| CPU registers | `registers` |
| Code as it is in memory now | `disassemble` |
| Executed instructions, call chain | `cpu_history`, `backtrace` |
| Cycles of each routine, memory use, cycles between two points | `profile`, `memmap`, `timing` |
| Chips of the machine | `vicii`, `sprite`, `cia`, `sid` |
| Screen image, screen compare | `screen` |
| Several of these from one moment | `observe` |
| Keyboard, joystick | `keyboard`, `press`, `joystick` |
| Program and disk media | `autostart`, `program_load`, `media_attach` |
| Machine state to go back to, also in a later session | `snapshot` |

Read the description of a tool before you use it for the first time. It gives the limits of the tool and the facts of the machine that change the result.

A result field `emulatorFlaw` names a known flaw of the emulator. Tell the user about the flaw. Do not use a result that the flaw can make wrong as a fact.

For a large result, give `out`. Write a file that is only for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. When a tool needs `project`, give the same folder as the `--project` of the skill scripts.

To keep a coverage run:

1. Clear the memory map with `memmap` action `clear`.
2. Run the part of the program that you want to keep.
3. Read the map with `memmap` action `read` and `out`, for example to `.c64-re-tools/local/attract.bin`.
4. Add the file to the coverage of the project knowledge.

## Workflow

1. Read the project knowledge for the addresses in the question.
2. Load the subject if it is not loaded. Use `autostart` to start it as a user does. Use `program_load` to put a program in memory with no start.
3. Set the stop condition. Use a breakpoint, a watchpoint or a `run_until` target. Add a condition when the stop must occur only in one state.
4. Run, step or give input. Prefer `run_until` and `advance-frames` to waits. They stop at the same emulated time on every run.
5. Read only the state that answers the question. To read several things from one moment, use `observe`.
6. Interpret the evidence. Keep the observed facts apart from your conclusions.

Before a risky experiment, save the state with `snapshot`. Restore it to try again from the same point.

### Input that the tools cannot give

Some programs read input in a way that the input tools cannot give. The tool description tells when. Then open the window and ask the user to give the input.

Do not change the program to make it accept the input.

### The window

The emulator has no window. When the user must type, play or look at the machine, do these steps:

1. Open the window with `window` action `open`.
2. Tell the user that the window is open and what to do in it.
3. Wait until the user tells you that they finished.
4. Close the window with `window` action `close`.

The result field `notCarried` names the data that the open or the close cleared.

## Knowledge

Read:
- the current knowledge for each address and range that the question touches.

Automatic write:
- none.

Write after interpretation:
- a symbol, a region or a comment that the runtime evidence justifies. Record it in the project knowledge.

Do not store:
- breakpoints or watchpoints
- memory reads
- temporary machine state
- a screen capture, unless the user asks for it as an artifact

## Result

The result is the runtime state or evidence that the question asks for.

If you cannot get the machine into the necessary state, say which state you could not get. Say what you tried.

## Failure and conflicts

An error is `{"error": {"code": "...", "message": "..."}}`. The message tells what is wrong and what to do. Obey the message. These rules also apply:

- `installation-incomplete` or `machine-unavailable`: stop the task. Give the message to the user and wait for the user. Do not install, start or change a tool yourself. Do not make a replacement for the tool, for example your own disk parser, disassembler or emulator script.
- `not-implemented`: the tool does not work in this setup. Give the message to the user. Do not use that tool or step again in this task.
- `machine-unavailable` with a message that names a pause or a dialog in the window: do not send more operations. Give the message to the user. When the user tells you that the emulator runs again, do the operation again.
- `machine-unavailable` for a different cause: wait a few seconds. Then do the operation again one time. If you get the same error again, stop the task. Tell the user to restart the c64-re-tools MCP server, and wait for the user.
- `machine-state-lost`: do not use results from before the error. Do what the message tells. Then read the machine state again.
- `stopReason` `timeout` or `jam`: this is evidence too. Report it. For `jam`, report the address.
- A different code: the message names the cause. Change the call, or report the cause.

If the runtime evidence does not agree with the current knowledge, do not change the knowledge. Report the conflict with the runtime evidence. Then resolve the conflict in the project knowledge.

## Other tasks

- To explain code without a run, analyze the program statically.
- Record a durable conclusion in the project knowledge.
- To compare runs or to assert values in a run, write a test run file.
- To find the meaning of a C64 address or register, read the memory map of the C64.
