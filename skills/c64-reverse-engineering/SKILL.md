---
name: c64-reverse-engineering
description: Reverse engineers a C64 program or a part of it, from an unknown disk image or file to documented understanding or a rebuilt program. It selects the next unknown to examine and the task that examines it. Use it when the user asks what a program does, for example "what does this game do", "find the main loop" or "understand $2100". Use it to rebuild a program from its original file, for example "rebuild this program". It does not do the specialist work of each task itself, and it does not add a feature to a program.
---

# C64 reverse engineering

## Purpose

Coordinate the reverse engineering of a C64 program. Select the next unknown to examine and the task that examines it.

Do the specialist work of each task as that task tells. Do not do it in another way.

## Inputs

- The subject: a disk image or a program file in the project, or a program that runs in the emulator.
- The scope: the question or the target. Examples:
  - identify the main loop
  - understand the routine at `$2100`
  - find the IRQ handler
  - reconstruct the input system
  - reverse engineer and rebuild the whole program
- The current project knowledge.

## Project rules

- One repository can hold several programs, with one project folder for each program. Work on one project at a time.
- Write all files in the project folder. Do not write files at the root of the repository.
- A subagent can have no emulator tools. Give it its experiments as test run files. Many test runs can go at the same time. The emulator tools are for the main session only.
- To name a large program with more agents at the same time, give each agent one range of addresses. Each agent writes a batch of knowledge changes with its owner range. Then join the batches of the agents, and write them to the project knowledge as one revision.
- Do not write a build script or a merge script. The generation of the source writes and assembles the loader. The project knowledge joins the batches.
- Do not write a script that makes a deliverable again, for example a capture, copy or replay script. Commit the deliverable.

## What a rebuild keeps

These rules apply to each rebuild:

- Do not keep a cracktro. A capture of a packed program starts at the last stage, so the code of a cracktro is not in the program. When the capture has data of a cracktro that the program does not read, capture again and exclude that range.
- Keep the start screen of the program, for example the loading picture of the publisher. Keep its bytes in the capture, and record the start screen in the project knowledge. The loader of the rebuild then shows it and waits for a key or a fire button. Do not keep a screen of a crack, for example a picture, an intro or a credit screen of a crack group.
- When the start screen is only in a stage of the loading, capture that stage while it shows the screen. Put the capture into the project knowledge in the space `loading`. Then record the start screen of that stage. Keep its tune: record the routine that starts the tune as the call of the start screen.
- A release can change the start screen, for example with the text of a crack. Then stop and ask the user how to deal with it. Do not decide alone.
- Keep all other bytes: unused bytes, dead code, old copies, texts and leftovers of the development. Record each one as a region with a comment. Do not remove them. The source keeps them, and the build of each release has them. The default build and the loader do not have them.
- Do not write a file of the rebuild by hand, for example a boot file, a packed picture or a script that changes bytes. Record each change in the project knowledge, and generate the source.
- Keep a copy protection in the source, off by default. Record a `protection` switch and its patches.
- Keep a trainer and a cheat in the source, off by default. Record a `trainer` or `cheat` switch and its patches.
- When two or more releases have different corrections, record each release and one `fix` switch for each correction. The switch names the releases that have the correction. The default build has all corrections.
- Record all switches in the project knowledge. Do not write a switch in a source file.
- When a crack removed a copy protection and no release has its bytes, write this in a comment and in the answer.

## Workflow

Select the path for the scope:

- A narrow scope, for example one routine, the IRQ handler or the input system: use the loop.
- A full rebuild of the program: use the stages.

### The loop

1. Write down the scope. Stop when the scope is complete.
2. Read the current project knowledge for the subject. Do not examine again what the knowledge already explains.
3. Find the next unknown or blocker. Do the task for it:

| Unknown | Task |
|---|---|
| The files on a disk image, or a file to extract | List the disk image. Extract the file into the project. |
| A BASIC program, and where it starts machine code | List the BASIC program. Find its SYS address. |
| A program that can be packed or crunched | Examine the program for a packer. Capture the unpacked program. |
| What the program does at run time: values, input, timing, screen | Run the program in the emulator. Read the values, give the input, measure the timing and capture the screen. |
| The routines, code, data and references of the program | Analyze the program statically. |
| The platform meaning of an address or a register | Find the address in the memory map of the C64. |
| Differences between releases of the program | Compare the releases. Record each release, switch and patch in the project knowledge. |
| Leftovers of the development, a crack or a recrack: texts, old copies, unused bytes, dead code | Find the leftovers in the program. |
| A routine that another program of the workspace has, for example a music driver | Match the program against the routine library of the workspace. |
| Source code from the knowledge | Generate the source from the project knowledge. |
| Source code to build | Assemble the source. |
| Proof that a rebuild behaves as the original | Test the rebuild against the original. |

4. Interpret the result. Keep observed facts apart from your conclusions.
5. Record each conclusion that the evidence supports in the project knowledge: names of routines and variables, data classifications, comments.
6. Go back to step 3 until the scope is complete.

### The stages of a full rebuild

Do the stages in this sequence. Go to the next stage only when its exit check is true, or when the user accepts an exception. Remember each exception for the answer of stage 12.

| Stage | Work | Exit check |
|---|---|---|
| 1. Acceptance | Ask the user for the criteria of the rebuild. Offer these criteria: identical source, a verified loader, passed test scenarios and passed replays of the recordings. Also offer a list of the code that no run executed, and documentation of the flows, tables, formats and graphics. | The user gave the criteria. |
| 2. Get | List the disk image. Extract the start file into `original/`. | The start file is in the project. |
| 3. Start | Find the SYS address of the BASIC start. | You have the entry address. |
| 4. Unpack | Examine the program for a packer. Trace it and find its stages. Capture a packed program into `.c64-re-tools/local/`. When a segment is the data of a cracktro and the program does not read it, capture again and exclude that range. Put the capture, or the PRG of a program without a packer, into the project knowledge. | The program in the project knowledge has the segments and the entry. |
| 5. Run | First, record. Ask the user to play each part that the scope names, in a recording session. Tell the user which parts. Record a part yourself only when the sessions of the user do not have it. Put the recordings in `tests/recordings/`. Then run the parts that a recording cannot have, in the emulator or as test runs. Write a coverage map for each part into `.c64-re-tools/local/`. Add the maps and the `coverage.bin` of each recording to the project knowledge. | The program in the project knowledge has a coverage map for each part that the scope names. |
| 6. Analyze | Analyze the program statically. The analysis reads the program and the coverage from the project knowledge. | No coverage conflict is open. |
| 7. Name | If the workspace has a routine library, match the program against it. Write the names of the matches to the project knowledge. Then name each routine in the scope and give it a comment. Find the platform addresses in the memory map of the C64. Record the modules. When the scope has hundreds of routines, ask the user which routines to name. The source gives the other routines an `l_xxxx` label. | Each routine that the user selected has a name and a comment. |
| 8. Releases and switches | For a capture, copy its folder to `original/<label>/` first, because git ignores `.c64-re-tools/local/`. Record the original file as the base release in the project knowledge. Record each other release. Compare the releases. Find the leftovers. Record a switch for each copy protection, trainer, cheat, crack change and correction. Record a patch for each range of a switch. Record each leftover as a region with a comment. | The project knowledge lists each switch. Each difference between the releases is in a patch, or the answer gives it as an exception. |
| 9. Generate | Generate the source from the project knowledge into `src`. For an unpacked program, also generate the loader. | The result of the generation is PASS. Each release with the result `layout differs` is a version with a project of its own, or an exception in the answer. See "Versions of one program". |
| 10. Build and test | Build the base release into `build/`, and compare it with the original. Build the default build. Run the test scenarios in `tests/`. Replay each recording on the rebuild. For each replay, give the checkpoint routine, the state and the random state with the names of stage 7. | The criteria of stage 1 are true. |
| 11. Document | When the criteria ask for documentation, generate it into `README.md` and `docs/`. For versions in a group folder, also write the shared pages of the group folder. Then link the pages. | The link check of the documentation gives PASS. |
| 12. Hand over | Find each file that you made outside `.c64-re-tools/local/` and that is not a deliverable. Move it into `.c64-re-tools/local/`. Then give the answer (below). | Each file that you made outside `.c64-re-tools/local/` is a deliverable. |

In stage 5, make the recordings before you change the program. A recording needs no names, and its coverage gives the analysis of stage 6 more code. If you cannot get to a part of the program, ask the user how to get to it. Do stages 7 to 9 again until the source is clear. Each generation writes the source again.

After stage 7, save each routine that other programs can have to the routine library of the workspace. Examples are a music driver, a decruncher and a loader. Ask the user before you make a library.

### Deliverables of a full rebuild

- `.c64-re-tools/knowledge/` with the program, its entry state, the coverage, the names, the regions, the comments, the modules, the releases, the switches and the patches
- the file of each release in `original/`
- the generated source
- the built program and the loader
- the test scenarios
- the recordings in `tests/recordings/`
- the documentation in `README.md` and `docs/`, when the criteria ask for it
- the runs in `runs/` that the knowledge gives as evidence
- the scripts in `tools/` for the formats of this program, when you wrote them.

All other files that you made are not deliverables. Keep them in `.c64-re-tools/local/`. Do not remove a file that the user made.

### The answer

Give the user a short answer at the end. Do not write a report file. Write a report file only when the user asks for it. The knowledge, `docs/` and the scenarios keep the durable results. The answer has:

1. Each criterion of stage 1 and its result, and each exception that the user accepted.
2. The count of the code ranges that no run executed. The ranges are in `.c64-re-tools/local/generated/src/not_executed.json` for the source in `src/`.
3. The switches: the name, the kind and the default of each, and the releases that have it on. Also a copy protection that a crack removed and that no release has.
4. Open questions: what the evidence does not explain.

Keep observed facts apart from your conclusions.

### Project layout

If the project has no layout, use this one. No script checks it. Each script takes the paths that you give.

```
original/      the disk image or the program as you got it
src/           the generated source
build/         the built programs. Do not commit them: each build writes them again.
tests/         the test scenarios, and the recordings in tests/recordings/
runs/          the runs that the knowledge gives as evidence
docs/          the documentation, with the reference in docs/reference/
tools/         scripts for the formats of this program only
README.md      the entry page of the documentation
```

Commit each folder of the layout other than `build/`, and `.c64-re-tools/knowledge/`. The knowledge holds the program, the entry state and the coverage, so the project needs no other folder for them. Put all other files that you make in `.c64-re-tools/local/`, also the captures and the coverage maps after you put them into the knowledge. Do not let git ignore a folder of the layout other than `build/`. Do not change the `.gitignore` files of the project.

If the project has a layout, use that layout.

A workspace with several projects keeps its routine library in `library/` beside the projects. The library is not a project folder.

### Versions of one program

Some releases of a program have a different layout. Their code is at different addresses, so patches cannot hold the differences. Each of these releases is a version of the program. Give each version a project of its own in a group folder:

```
<game>/          the group folder: not a project
  README.md      the shared entry page: the program, each version, and how the versions differ
  docs/          the shared pages: the development, the changes between the versions, the releases, the disk layout
  library/       the routine library of the versions
  tools/         the scripts for the formats of the program, for all versions
  v1/            the project of the first version, with the project layout
  v2/            the project of the second version, with the project layout
```

1. Make the group folder in the git repository. Do not put `.c64-re-tools/` in it.
2. Ask the user before you move a project folder. Then move the current project into `<game>/v1/`. The project knowledge keeps its paths relative to the project folder. Thus the knowledge stays valid after the move.
3. Make a project folder for the new version, for example `<game>/v2/`. Start at stage 2 with the file of that release. From the group folder, give `--project v2`. In the empty folder `v2/`, give `--project .`. The first write makes the project.
4. Keep the releases with the same layout in one version. Record them as releases with switches. For example, `v2` holds a base release and a second release from a different crack.
5. Save the routines of `v1` to the routine library in `<game>/library/`. Give `--library ../library`, because `--library` is relative to the project folder. In stage 7 of `v2`, match the program against that library. Then `v2` gets the names of `v1` for the same routines.
6. Use the same folders in each version, for example `src` and `docs/reference`.
7. From the group folder, give `--project v1` or `--project v2` to each script. A script can read a file of another version, for example `../v1/original/<file>`. Use this to compare the releases of two versions. Record each release only in the project of its version.
8. Write the facts that the versions share one time, in the pages of the group folder. The pages of each version tell only how that version works.

## Knowledge

Read:
- the knowledge for the addresses, ranges and routines in the scope
- the history of a conclusion that is surprising or that a person disputes.

Record durable conclusions in the project knowledge. Do not store:
- the state of the current investigation
- a name only because a routine needs a temporary name
- guesses.

## Result

A clear answer for the scope, with the durable conclusions in the project knowledge. For a full rebuild, the deliverables and the answer of stage 12, with the criteria of the user met or each exception in the answer.

## Failure and conflicts

- A task reports `installation-incomplete` or `machine-unavailable`: stop the whole task. Give the message to the user and wait for the user. Do not continue with other tasks.
- A tool gives a wrong result, and the exit check of a stage cannot be true. Tell the user the defect and the evidence, and wait for the user. Do not make a workaround, for example a change to a generated file. When the user accepts an exception, give the defect and the exception in the answer of stage 12.
- If the evidence does not support a conclusion, keep the unknown and get more evidence. Do not make up a meaning.
- Before you replace current knowledge from the user or the LLM, read its history and the evidence for it.
- A conflict from the static analysis: find the correct answer at run time in the emulator.
- A test that is INCONCLUSIVE does not show a defect. Find why the test could not compare.

## After the work

- To add a feature or a correction to the rebuilt program, develop it as a change of a rebuilt program.
- To start a new program from the rebuilt program, export the rebuilt program as a new project.
