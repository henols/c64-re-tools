---
name: c64-memory-map
description: Use this skill to find what a C64 address means on the platform. Examples are a VIC-II, SID or CIA register, a KERNAL routine, a vector or a system variable. It also decodes the value of a hardware register, for example the memory configuration in $01 or the screen address in $D018. It tells you when an address has no platform meaning and belongs to the application.
---

# c64-memory-map

## Purpose

Give the C64 platform meaning of an address or of a register value.

This skill does not read the emulator and does not change project knowledge.

## Inputs

- One or more addresses.
- Or a register and a value to decode.

## Tools / execution path

The script looks up local reference data. It does not use the host runtime.

```
node <skill>/scripts/memmap.ts at '$d020' '$0314' '$ffd2'
node <skill>/scripts/memmap.ts decode '$d018' '$15' --bank '$97'
node <skill>/scripts/memmap.ts list vic
```

| Command | Result |
|---|---|
| `at <address> ...` | For each address: `kind` (`platform` or `application`), the area, the name and the meaning. |
| `decode <register> <value>` | The meaning of the value. Use `--bank` with the value of `$DD00` to get the addresses for `$D018`. |
| `list <vic\|sid\|cia1\|cia2\|kernal\|system>` | All entries of that group. |

Write an address or a value as `$` and hex digits, as a decimal number, or as `%` and binary digits. Put a `$` value in single quotes in a shell.

The script prints one JSON object.

## Workflow

1. Run `at` for the addresses in the code or the question.
2. Read `kind`:
   - `platform`: the C64 gives the address a meaning. Read `name` and `meaning`.
   - `application`: the address has no platform meaning. The program decides its use. Find its use with the c64-static-analysis or c64-emulator skill.
3. For an I/O register, `mirrorOf` shows the register that a mirror address repeats. `visible` tells that the register is visible only when `$01` shows I/O at `$D000`.
4. For a byte in a multi-byte entry, for example the high byte of a vector, `entryStart` gives the first address of the entry.
5. To understand a value in a register, run `decode`. For the memory configuration, decode the value of `$01`.

The decoders are for `$01`, `$D010`, `$D011`, `$D015` to `$D01F` (the sprite and interrupt bits), `$D016`, `$D018`, `$DC0D`, `$DD00` and `$DD0D`.

## Knowledge

Automatic write:
- none.

Platform facts are reference data. Do not store them as project knowledge.

A conclusion about the application can be project knowledge. For example: "the program writes its own IRQ handler address to `$0314`". Record it with the c64-knowledge skill.

## Result

The platform meaning of each address, or the decoded meaning of a register value.

## Failure and conflicts

- `kind: application`: this is not a failure. The address has no platform meaning.
- `invalid-input`: the address, the register or the value is not correct, or no decoder exists for the register. Read the message.

Some registers have a different meaning for a read and for a write, for example `$DC0D`. The decoded result shows both.

## Handoffs

- The value of an address at run time → c64-emulator
- A conclusion about the application → c64-knowledge
