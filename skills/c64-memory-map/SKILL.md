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
node <skill>/scripts/memory-map.ts at '$d020' '$0314' '$ffd2'
node <skill>/scripts/memory-map.ts decode '$d018' '$15' --bank '$97'
node <skill>/scripts/memory-map.ts list vic
node <skill>/scripts/memory-map.ts export --out src/hw.asm
```

| Command | Result |
|---|---|
| `at <address> ...` | For each address: `kind` (`platform` or `application`), the area, the name and the meaning. |
| `decode <register> <value>` | The meaning of the value. Use `--bank` with the value of `$DD00` to get the addresses for `$D018`. The decoders are for `$01`, `$D010`, `$D011`, `$D015` to `$D01F`, `$D016`, `$D018`, `$DC0D`, `$DD00` and `$DD0D`. |
| `list <vic\|sid\|cia1\|cia2\|kernal\|system>` | The entries of that group as a list: `count` and `listed`. `--max-listed` limits `listed`. The default is 50. |
| `export --out <file>` | Writes all platform names to a project file as an ACME include: one line for each name, with its meaning as a comment. A zero-page name is `NAME = $xx`. Other names are `NAME = $xxxx`. |

Write a value for `decode` and `--bank` as `$` and hex digits, as a decimal number, or as `%` and binary digits. Put a `$` value in single quotes in a shell.

`at` and `decode` also take a platform name, for example `SCROLY` or `CHROUT`, in upper or lower case. A platform name comes before a name of the knowledge. `list` and `export` show the platform names.

### Calling the script

- Call a script as `node <skill>/scripts/<script>.ts <command> [subjects] [options]`. The command comes first.
- `<script>.ts --help` lists the commands. `<script>.ts <command> --help` gives the subjects and the options of one command. The help is JSON: `{"text": "..."}`.
- An address is `$` and 1 to 4 hex digits, for example `'$c000'` or `'$fb'`, or a name. A name is a symbol, else an analyzer name that only one analyzer gives. Quote an address in a shell.
- A range is `<start>-<end>`, for example `'$c000-$cfff'`. In a JSON file, a range is `start` and `end`.
- Bytes in a JSON file are hex in a field `data`, for example `"data": "a900"`.
- The script examines each `--out` path before it starts work. It refuses a path in `.c64-re-tools/knowledge/` and the index of the knowledge, because only c64-knowledge writes them. It refuses a folder where the command writes a file, and a file where the command writes a folder.
- The result is one JSON object on one line. A file that the script writes shows as `{"out", "bytes", "sha256"}`. A list shows as `{"count", "listed"}`, and `rest` tells where to get the rest of a long list.
- An error is `{"error": {"code": "...", "message": "..."}}`. The message tells what is wrong and what to do.
- The exit status is 0 for done or PASS, 1 for FAIL, 2 for an error and 3 for INCONCLUSIVE.

### Project folder

- Paths are relative to the project folder. The project folder is the nearest folder at or above the working directory that holds `.c64-re-tools/`.
- If the working directory is not in a project and has projects below it, the script refuses and lists them. Then give `--project <folder>` to each script.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence test:<file>` or `--evidence file:<file>` of c64-knowledge. These two refuse a file in `.c64-re-tools/local/`.
- Do not move a coverage map after `coverage` of c64-knowledge imported it. `--evidence coverage:<map>` names the map by its path at the import. The knowledge keeps the coverage and the SHA-256 of the map, so the evidence stays valid.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A shell redirect (`>`) is relative to the working directory, not to the project folder. From the folder above the project, write `<folder>/.c64-re-tools/local/result.json`.

## Workflow

1. Run `at` for the addresses in the code or the question.
2. Read `kind`:
   - `platform`: the C64 gives the address a meaning. Read `name` and `meaning`.
   - `application`: the address has no platform meaning. The program decides its use. Find its use with the c64-static-analysis or c64-emulator skill.
3. For an I/O register, `mirrorOf` shows the register that a mirror address repeats. `visible` tells that an address in `$D000`-`$DFFF` is visible only when `$01` shows I/O at `$D000`. This area holds the chip registers, the color RAM and the cartridge I/O areas.
4. For a byte in a multi-byte entry, for example the high byte of a vector, `entryStart` gives the first address of the entry.
5. To understand a value in a register, run `decode`. For the memory configuration, decode the value of `$01`.
6. For source that you write by hand, run `export` and include the file with `!source`. The c64-source skill uses the same names without the file.

The decoders are for `$01`, `$D010`, `$D011`, `$D015` to `$D01F` (the sprite and interrupt bits), `$D016`, `$D018`, `$DC0D`, `$DD00` and `$DD0D`.

## Knowledge

Automatic write:
- none.

Platform facts are reference data. Do not store them as project knowledge.

A conclusion about the application can be project knowledge. For example: "the program writes its own IRQ handler address to `$0314`". Record it with the c64-knowledge skill.

## Result

The platform meaning of each address, or the decoded meaning of a register value. For `export`: the count of names in `names`, and the file as `{out, bytes, sha256}`.

## Failure and conflicts

- `kind: application`: this is not a failure. The address has no platform meaning.
- `invalid-input`: the address, the register or the value is not correct, or no decoder exists for the register. Read the message.

Some registers have a different meaning for a read and for a write, for example `$DC0D`. The decoded result shows both.

## Handoffs

- The value of an address at run time → c64-emulator
- A conclusion about the application → c64-knowledge
