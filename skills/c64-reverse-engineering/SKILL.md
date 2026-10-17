---
name: c64-reverse-engineering
description: Use this skill to reverse engineer a C64 program or a part of it. The work goes from an unknown disk or file to documented understanding or a rebuilt program. It decides what to learn next and which specialist skill does that work. Use it for questions such as "what does this game do", "find the main loop", "understand $2100" or "rebuild this program".
---

# c64-reverse-engineering

## Purpose

Coordinate the reverse engineering of a C64 program. Decide the next unknown to examine and the specialist skill that examines it.

This skill does not do the specialist work itself.

## Inputs

- The subject: a disk image or a program file in the project, or a program that runs in the emulator.
- The scope: the question or the target. Examples:
  - identify the main loop
  - understand the routine at `$2100`
  - find the IRQ handler
  - reconstruct the input system
  - reverse engineer and rebuild the whole program
- The current project knowledge.

## Tools / execution path

This skill uses the other skills. It does not use the host runtime or the emulator directly.

### Project folder

One repository can hold several programs, with one project folder for each program. A project folder holds `.c64-re-tools/`. Work on one project at a time:

- From the root of the repository, give `--project <folder>` to each skill script, and `project` to each emulator tool with a path.
- Write all files in the project folder. Do not write files at the root of the repository.
- Write each file that you make for your work in `.c64-re-tools/local/` of the project. Git ignores that folder. Examples are results, batches, step files, runs, snapshots and memory dumps.
- Move a file out of `.c64-re-tools/local/` only when it is the evidence for a finding. Move it before you give it to `--evidence` of c64-knowledge. `--evidence` refuses a file in `.c64-re-tools/local/`.
- Put a run that is evidence in `runs/<name>/`, with its run file, its results and the snapshot files that it uses. Change the paths in the run file to the new paths. Then git keeps them, and another person can do the run again.
- A subagent can have no emulator tools. Give it its experiments as run files of the c64-testing skill. Each run starts its own emulator, so many runs can go at the same time. The emulator of the emulator tools is one machine, for the main session.
- To name a large program with more agents at the same time, give each agent one range of addresses. Each agent writes a batch with its owner range. Then join the batches with `join` of the c64-knowledge skill, and apply the result one time.
- Do not write a build script or a merge script. c64-source writes and assembles the loader with `--loader`, and `join` of c64-knowledge joins the batches.
- Do not write a script that makes a deliverable again, for example a capture, copy or replay script. Commit the deliverable.
- Write the knowledge only with the c64-knowledge script. Do not write or edit the files in `.c64-re-tools/knowledge/` yourself.

## Workflow

Select the path for the scope:

- A narrow scope, for example one routine, the IRQ handler or the input system: use the loop.
- A full rebuild of the program: use the stages.

### The loop

1. Write down the scope. Stop when the scope is complete.
2. Read the current knowledge for the subject with the c64-knowledge skill. Do not examine again what the knowledge already explains.
3. Find the next unknown or blocker, and use the specialist for it:

| Unknown | Skill |
|---|---|
| The files on a disk image, or a file to extract | c64-disk |
| A BASIC program, and where it starts machine code | c64-basic |
| A program that can be packed or crunched | c64-unpacker |
| What the program does at run time: values, input, timing, screen | c64-emulator |
| The routines, code, data and references of the program | c64-static-analysis |
| The platform meaning of an address or a register | c64-memory-map |
| Differences between releases of the program | c64-provenance |
| Leftovers of the development, a crack or a recrack: texts, old copies, unused bytes, dead code | c64-provenance `leftovers` |
| A routine that another program of the workspace has, for example a music driver | c64-provenance, with the library |
| Source code from the knowledge | c64-source |
| Source code to build | c64-assembler |
| Proof that a rebuild behaves as the original | c64-testing |

4. Interpret the result. Keep observed facts apart from your conclusions.
5. Record each conclusion that the evidence supports with the c64-knowledge skill: names of routines and variables, data classifications, comments.
6. Go back to step 3 until the scope is complete.

### The stages of a full rebuild

Do the stages in this sequence. Go to the next stage only when its exit check is true, or when the user accepts an exception. Remember each exception for the answer of stage 11.

| Stage | Work | Exit check |
|---|---|---|
| 1. Acceptance | Ask the user for the criteria of the rebuild. Offer these: identical source, a verified loader, passed c64-testing scenarios, passed replays of the recordings, and a list of the code that no run executed. Also offer documentation of the flows, tables, formats and graphics. | The user gave the criteria. |
| 2. Get | c64-disk: list the disk. Extract the start file into `original/`. | The start file is in the project. |
| 3. Start | c64-basic: find the SYS address of the BASIC start. | You have the entry address. |
| 4. Unpack | c64-unpacker: examine the program. Capture a packed program into `.c64-re-tools/local/`. Then c64-knowledge: put the capture, or the PRG of a program without a packer, into the knowledge with `image`. | `program` of c64-knowledge shows the segments and the entry. |
| 5. Run | First record: ask the user to play each part that the scope names, with `testing.ts record --play` of c64-testing. Tell the user which parts. Record a part yourself only when the sessions of the user do not have it. Put the recordings in `tests/recordings/`. Then c64-emulator and the run of c64-testing for the parts that a recording cannot have. Write a coverage map for each part into `.c64-re-tools/local/`. Then c64-knowledge: add the maps and the `coverage.bin` of each recording with `coverage`. | `program` of c64-knowledge lists a coverage map for each part that the scope names. |
| 6. Analyze | c64-static-analysis. It reads the program and the coverage from the knowledge. | No coverage conflict is open. |
| 7. Name | c64-provenance: if the workspace has a library, find its routines with `match` and apply the batch. Then c64-knowledge and c64-memory-map: name each routine in the scope and give it a comment. Record the modules. When the scope has hundreds of routines, ask the user which routines to name. The source gives the other routines an `l_xxxx` label. | Each routine that the user selected has a name and a comment. |
| 8. Generate | c64-source into `src/`. For an unpacked program, add `--loader`. | `check.identical` is true. For an unpacked program, `loader.verified` is true. |
| 9. Build and test | c64-assembler with `--compare` into `build/`. c64-testing scenarios in `tests/`. Replay each recording on the rebuild with `testing.ts replay`: give the checkpoint routine, the state and the random state (`--pin`) with the names of stage 7. | The criteria of stage 1 are true. |
| 10. Document | When the criteria ask for documentation: c64-docs into `README.md` and `docs/`. | `docs.ts link --check` of c64-docs gives no problem. |
| 11. Hand over | Find each file that you made outside `.c64-re-tools/local/` and that is not a deliverable. Move it into `.c64-re-tools/local/`. Then give the answer (below). | Each file that you made outside `.c64-re-tools/local/` is a deliverable. |

In stage 5, make the recordings before you change the program. A recording needs no names, and its coverage gives the analysis of stage 6 more code. If you cannot get to a part of the program, ask the user how to get to it. Do stages 7 and 8 again until the source is clear. Each run of c64-source writes the source again.

After stage 7, save each routine that other programs can have to the library with c64-provenance `routine`. Examples are a music driver, a decruncher and a loader. Ask the user before you make a library.

### Deliverables of a full rebuild

- `.c64-re-tools/knowledge/` with the program, its entry state, the coverage, the names, the regions, the comments and the modules
- the generated source
- the built program and the loader
- the c64-testing scenarios
- the c64-testing recordings in `tests/recordings/`
- the documentation in `README.md` and `docs/`, when the criteria ask for it
- the runs in `runs/` that the knowledge gives as evidence
- the scripts in `tools/` for the formats of this program, when you wrote them.

All other files that you made are not deliverables. Keep them in `.c64-re-tools/local/`. Do not delete a file that the user made.

### The answer

Give the user a short answer at the end. Do not write a report file. Write a report file only when the user asks for it. The knowledge, `docs/` and the scenarios keep the durable results. The answer has:

1. Each criterion of stage 1 and its result, and each exception that the user accepted.
2. The count of the code ranges that no run executed. The ranges are in the `not_executed.json` file of c64-source.
3. Open questions: what the evidence does not explain.

Keep observed facts apart from your conclusions.

### Project layout

If the project has no layout, use this one. No script checks it. Each script takes the paths that you give.

```
original/      the disk image or the program as you got it
src/           the generated source from c64-source
build/         programs from c64-assembler
tests/         c64-testing scenarios, and the recordings in tests/recordings/
runs/          the runs that the knowledge gives as evidence
docs/          the documentation from c64-docs, with the reference in docs/reference/
tools/         scripts for the formats of this program only
README.md      the entry page of the documentation from c64-docs
```

Commit each folder of the layout and `.c64-re-tools/knowledge/`. The knowledge holds the program, the entry state and the coverage, so the project needs no other folder for them. Put all other files that you make in `.c64-re-tools/local/`, also the captures and the coverage maps after you put them into the knowledge. Do not let git ignore a folder of the layout. Do not change the `.gitignore` files of the project.

If the project has a layout, use that layout.

A workspace with several projects keeps its library of routines in `library/` beside the projects. The library is not a project folder.

## Knowledge

Read:
- the knowledge for the addresses, ranges and routines in the scope
- the history of a conclusion that is surprising or that a person disputes.

Automatic write:
- none directly.

Record durable conclusions with the c64-knowledge skill. Do not store:
- the state of the current investigation
- a name only because a routine needs a temporary name
- guesses.

## Result

A clear answer for the scope, with the durable conclusions in the project knowledge. For a full rebuild, the deliverables and the answer of stage 11, with the criteria of the user met or each exception in the answer.

## Failure and conflicts

- A skill reports `installation-incomplete`, or `machine-unavailable` with a message that the host runtime does not run: stop the whole task. Give the message to the user and wait for the user. Do not continue with other skills. Do not make a replacement for the tool or the host runtime, for example your own disk parser, disassembler or emulator script.
- A tool gives a wrong result, and the exit check of a stage cannot be true. Tell the user the defect and the evidence, and wait for the user. Do not make a workaround, for example a change to a generated file. When the user accepts an exception, give the defect and the exception in the answer of stage 11.
- If the evidence does not support a conclusion, keep the unknown and get more evidence. Do not make up a meaning.
- Before you replace current knowledge from the user or the LLM, read its history and the evidence for it.
- A conflict from the static analysis: find the correct answer at run time with the c64-emulator skill.
- A test that is INCONCLUSIVE does not show a defect. Find why the test could not compare.

## Handoffs

All specialist skills in the table above.
