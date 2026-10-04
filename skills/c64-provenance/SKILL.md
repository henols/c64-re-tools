---
name: c64-provenance
description: Use this skill to compare two or more releases of a C64 program, for example cracked versions from different groups. It finds the bytes where the releases differ and shows which releases agree there. Use the result to separate the content of the application from changes that a release added. Do not use it to run or analyze the code.
---

# c64-provenance

## Purpose

Compare releases of a C64 program. Find the bytes where they differ and which releases agree. Use this to find which bytes are probably the original application and which are changes of one release.

This skill does not change project knowledge.

## Inputs

- Two or more releases: PRG files, relative to the project directory. Extract them from disk images with the c64-disk skill. Unpack packed releases with the c64-unpacker skill first.
- Optional: an address range to compare.
- Optional: a shift for a release that loads at a different address.

## Tools / execution path

The script compares the files locally. It does not use the host runtime.

```
node <skill>/scripts/provenance.ts releases/a.prg releases/b.prg releases/c.prg
node <skill>/scripts/provenance.ts releases/a.prg releases/b.prg --shift 2:-256 --from '$0900' --to '$09ff'
```

| Option | Meaning |
|---|---|
| `--shift 2:-256` | Move release 2 (the first release is 1) by -256 bytes. Use it again for more releases. |
| `--from '$0900'` | Compare from this address. |
| `--to '$09ff'` | Compare up to this address. |

The script puts each release at its load address and compares the addresses that all releases cover. It prints one JSON object.

## Workflow

1. Run the script on the releases.
2. Read `identicalShare`. If it is low and `suggestedShifts` is present, the releases are at different addresses. Run the script again with `--shift`.
3. Read `differences`. Each one has an address range, the bytes of each release, and `groups`: the releases that have the same bytes there.
4. Examine each important difference:
   - Disassemble the bytes of each release with the c64-emulator skill, or analyze them with the c64-static-analysis skill.
   - Find what the change does, for example a trainer, a removed copy protection, or a changed text.
5. Decide which bytes are probably the original application. Use more than the byte comparison: the code, the text, and the history of the releases.
6. Record the conclusion as a comment or a region with the c64-knowledge skill.

## Knowledge

Automatic write:
- none.

Record a confirmed conclusion as a normal comment, region or symbol with the c64-knowledge skill. Do not record the full comparison.

## Result

The differing ranges with the bytes of each release and the groups that agree, and the share of identical bytes.

## Failure and conflicts

- Do not call releases independent when you do not know their relation. Two cracks can come from the same source.
- Do not call a byte original only because one release has it. A majority of releases is also not proof.
- `common: null`: the releases do not cover the same addresses. Use `--shift`, or compare a range that all releases cover.
- `moreDifferences: true`: the script shows only the first differences. Use `--from` and `--to` to see the others.
- `invalid-input`: a file, an address or a shift is wrong. Read the message.

## Handoffs

- Get releases from disk images → c64-disk
- Unpack a packed release → c64-unpacker
- Run or examine the different code → c64-emulator
- Analyze the different code → c64-static-analysis
- Record a conclusion → c64-knowledge
