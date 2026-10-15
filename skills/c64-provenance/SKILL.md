---
name: c64-provenance
description: Use this skill to compare two or more releases of a C64 program, for example cracked versions from different groups. It finds the bytes where the releases differ and shows which releases agree there. It can run each release and tell how the program uses each difference. With one release, it gives evidence for each range: the unpack stage, the access, and the code that the entry does not reach. Use the result to separate the content of the application from changes that a release added. Do not use it to analyze the code.
---

# c64-provenance

## Purpose

Compare releases of a C64 program. Find the bytes where they differ and which releases agree. Use this to find which bytes are probably the original application and which are changes of one release.

This skill does not change project knowledge.

## Inputs

- Two or more releases, relative to the project directory. A release is a PRG file or an `image.json` from c64-unpacker capture. Extract releases from disk images with the c64-disk skill. Unpack packed releases with the c64-unpacker skill first.
- Optional: an address range to compare.
- Optional: a shift for a release that loads at a different address.
- Optional: a number of frames to run each release, and a steps file.
- For one release: the release, coverage files, and the knowledge of the project.

## Tools / execution path

The script compares the files locally. Only `--run` uses the host runtime: each release runs in its own emulator.

```
node <skill>/scripts/provenance.ts releases/a.prg releases/b.prg releases/c.prg
node <skill>/scripts/provenance.ts releases/a.prg releases/b.prg --shift 2:-256 --from '$0900' --to '$09ff'
node <skill>/scripts/provenance.ts releases/a.prg unpacked/b/image.json --run 600 --steps steps/start-game.json
node <skill>/scripts/provenance.ts separate unpacked/image.json --coverage coverage/attract.bin --coverage coverage/level1.bin --out notes/separate.json
```

| Option | Meaning |
|---|---|
| `--shift 2:-256` | Move release 2 (the first release is 1) by -256 bytes. Use it again for more releases. |
| `--from '$0900'` | Compare from this address. |
| `--to '$09ff'` | Compare up to this address. |
| `--run 600` | Run each release for this many frames, and give each listed difference its runtime evidence. |
| `--steps steps/start-game.json` | With `--run`: the action steps of the c64-unpacker steps file to run before the frames, for example a key to start the game. |

The script puts each PRG at its load address. An image has bytes only in its segments. The script compares the addresses where all releases have bytes. It prints one JSON object.

With `--shift`, the addresses of `segments`, `common` and `differences` are the release addresses plus the `shift` of the release. The `start` and `end` of `runtime` are the addresses in the release itself, without the shift.

With `--run`, a PRG starts with autostart and RUN. An image starts from its bytes: the script writes the segments and the entry state from `entry_state.json` into the emulator, and starts at the entry. Watchpoints on each difference stop the run at its first access.

## Workflow

1. Run the script on the releases.
2. Read `identicalShare`. If it is low and `suggestedShifts` is present, the releases are at different addresses. Run the script again with a `--shift` of `suggestedShifts`. `shiftsNotSuggested` tells why a found shift does not fit in `$0000-$ffff`.

   `suggestedShifts` has at most 3 shifts for each release. The shift with the most `matchingSequences` is first. Data that did not move and code that moved give different shifts. Try each shift. `current: true` marks the shift of this run.
3. Read `differences`. Each one has an address range, the bytes of each release, and `groups`: the releases that have the same bytes there.
4. To know how the program uses the differences, run the script again with `--run` and the frames that get the program to the part you examine. Read `runtime` of each difference:
   - `first`: the first access in that release: `read`, `write`, `execute` or `none`. An instruction that reads and then writes the same byte, for example INC, counts as `read`. The operand bytes of an executed instruction count as `execute`, for example the value of `LDA #$03`.
   - `changed`: `true` when the bytes at the end of the run are not the bytes of the release.
   - A range that each release writes before it reads is probably runtime state, not a difference of the releases.
   - A range with `none` in each release is not used in this run. Run more frames or other steps before you decide.
   - `run.skipped`: the releases have no differences, so no release ran.
5. Examine each important difference:
   - Disassemble the bytes of each release with the c64-emulator skill, or analyze them with the c64-static-analysis skill.
   - Find what the change does, for example a trainer, a removed copy protection, or a changed text.
6. Decide which bytes are probably the original application. Use more than the byte comparison: the code, the text, and the history of the releases.
7. Record the conclusion as a comment or a region with the c64-knowledge skill.

## One release

Use `separate` when you have only one release. It gives evidence, not a decision:

- `ranges`: the image in ranges with the same stage and access. `stage` is the last unpack stage that wrote the range. In `image.json`, the last stage is the program. An earlier stage is a depacker, an intro or a loader. Only an image from c64-unpacker `capture` has stages. For an image from `loads`, `noStages` tells this.
- `access`: from the joined `--coverage` files: `executed`, `read`, `written`, `read-written` or `untouched`. `untouched` bytes did not take part in the runs.
- `codeRegions.total`: the number of code regions in the knowledge.
- `codeRegions.unreachable`: code regions of the knowledge that no chain of call and jump references reaches from the entry. Run c64-static-analysis first, so that the knowledge has the code regions and the references.
- `outside`: RAM outside the image that the program `read` or `executed` but did not write, and code it `generated`. A loader or an earlier stage put the bytes that the program did not write. A `generated` range can have gaps of two bytes or less: these are operand bytes.

Each list has `count` and `listed`. `listed` has the first ranges, at most `--max-listed`. `--out` writes all of them. Run more coverage runs for parts that are `untouched` before you decide.

## Knowledge

Automatic write:
- none.

Record a confirmed conclusion as a normal comment, region or symbol with the c64-knowledge skill. Do not record the full comparison.

## Result

The differing ranges with the bytes of each release and the groups that agree, and the share of identical bytes. `common` gives the ranges where all releases have bytes. `releases` gives the segments and the `shift` of each release. With `--run`, each difference also has `runtime`, and `run` tells if each release started, or why not.

The runtime evidence is evidence only. The script does not decide which bytes are original.

The exit status is 0 for a result. The exit status is 1 for an error. The exit status is 2 for a wrong argument.

## Failure and conflicts

- Do not call releases independent when you do not know their relation. Two cracks can come from the same source.
- Do not call a byte original only because one release has it. A majority of releases is also not proof.
- `common` is empty: the releases do not cover the same addresses. Use `--shift`, or compare a range that all releases cover.
- `run.releases` shows `started: false`: a PRG without a BASIC start, or an image without `entry_state.json`. The reason tells which. The other releases still give evidence.
- `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the task. Give the message to the user and wait for the user. The message gives the remedy. Do not make a replacement for the tool or the host runtime, for example your own emulator script.
- `moreDifferences: true`: the script shows only the first differences. Use `--from` and `--to` to see the others.
- `not-found`: the project has no file at that path.
- `invalid-input`: a file, an address or a shift is wrong. A path that goes out of the project directory is also wrong, also through a link. Read the message.

## Handoffs

- Get releases from disk images → c64-disk
- Unpack a packed release → c64-unpacker
- Run or examine the different code → c64-emulator
- Analyze the different code → c64-static-analysis
- Record a conclusion → c64-knowledge
