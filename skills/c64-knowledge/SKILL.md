---
name: c64-knowledge
description: Use this skill to read, write, correct and review the durable knowledge of a C64 project in .c64-re-tools/knowledge.db. It gives the knowledge at an address, and it names symbols, classifies memory regions, sets comments and records references. It also shows the history of each change, and it can revert to an earlier revision. Do not use it for live emulator state or for static analysis.
---

# c64-knowledge

## Purpose

Read, write, correct and review the durable understanding of a C64 project. The knowledge is in `.c64-re-tools/knowledge.db` in the project directory. Git can version that file.

This skill is the only write path for conclusions of the user and the LLM. It does not run an emulator or an analyzer.

## Inputs

One of these:

- an address, a range or a symbol name to look up
- text to search for
- a change to a symbol, a region, a comment or a reference, with a short reason
- a request to see the history or a revision.

## Tools / execution path

Run the script in the project directory. The project directory is the directory that the harness started in.

```
node <skill>/scripts/knowledge.ts <command> [arguments] [options]
```

The script prints one JSON object. An error prints `{"error": {"code": ..., "message": ...}}`. Addresses are `$` and four hex digits. Quote them in a shell, for example `'$2100'`.

| Need | Command |
|---|---|
| Everything known at one address | `at '$2100'` |
| Find names and comment text | `search player` |
| Lists in a range | `symbols`, `regions`, `comments`, `references` with `--start` and `--end` |
| Name the symbol at an address | `rename '$2100' update_player --kind routine` |
| Remove a symbol | `remove-symbol '$2100'` |
| Classify memory | `classify '$3000' '$303f' sprite` |
| Make memory unknown again | `unclassify '$3000' '$303f'` |
| Set or remove a comment | `comment '$2100' line Reads joystick 2.` / `uncomment '$2100' line` |
| Add or remove a reference | `reference '$2000' '$2100' call` / `unreference ...` |
| History | `history '$2100'`, `history --name update_player`, `revisions`, `revision 12` |
| Go back to an earlier state | `revert 12` |

Symbol kinds are `label`, `routine`, `variable`, `data` and `vector`. Region types are `code`, `bytes`, `words`, `addresses`, `addresses-split`, `petscii`, `screen`, `bitmap` and `sprite`. Reference kinds are `call`, `jump`, `read`, `write` and `reference`.

## Workflow

Read:

1. Use `at` for the addresses in the question before other work.
2. Use `history` when the current knowledge is surprising or disputed.

Write:

1. Read the current value with `at`. Note the `revision` in the result.
2. Decide the change. Keep observed facts apart from your conclusions.
3. Write it with `--reason` and `--expect-revision` set to the revision you read.
4. Read the result. A `revision` of `null` means that nothing changed.

Each write is one revision. A classification inside a region splits that region, so regions never overlap.

## Knowledge

Write after interpretation:

- a symbol name that tells what a routine or a variable does
- a region type that the evidence supports
- a comment that explains behavior that a name cannot show
- a reference that the evidence supports.

Do not store:

- temporary investigation state
- a guess, only because a routine needs a temporary name
- confidence or status words in comment text.

The script records the origin `llm`. Use `--origin user` only when the user decides the change.

## Result

For a read: the current or historical knowledge in compact JSON.

For a write: the new revision and the current value after the write. If the write replaces a symbol or a region of a different origin, `previous` gives that row as it was before the write. For example, an `llm` write over a `user` name gives `previous`. Read `previous` and tell the user about the change.

The exit status is 0 for a result. The exit status is 1 for an error from the knowledge, for example `conflict`. The exit status is 2 for a wrong argument.

## Failure and conflicts

- `conflict`: the change contradicts current knowledge. For example, the name belongs to another address. Read that address and its history, then decide.
- `stale-revision`: the knowledge changed after you read it. Read it again, then decide again.
- `not-found`: there is nothing to remove or no such revision.
- `invalid-database` or `unsupported-schema`: tell the user the message. Do not edit the file.

A revert makes a new revision. The history stays complete.

## Handoffs

- Runtime evidence → c64-emulator
- Static evidence → c64-static-analysis
