---
name: c64-field-debug
description: Use this skill during a field test of c64-re-tools, in every step that uses a c64 skill or a c64_ MCP tool. Write a note each time you must guess which tool to use, or get a failure or a result you did not expect. Write one when a description is unclear, when you use a workaround, and when you complete a workflow step. Also use it when the user writes a message that starts with "note:". The notes go to field-test/notes.jsonl and come back to the c64-re-tools project as a debug report.
---

# c64-field-debug

## Purpose

Record what you think while you work with the c64-re-tools skills and MCP tools. The notes tell the developer of the toolkit what did not work, what was unclear, and where you had to guess. The transcript shows what you did. The notes show why.

This skill is for a field test only. It is not part of c64-re-tools.

## Tools / execution path

```
node .claude/skills/c64-field-debug/scripts/note.ts --kind <kind> --component <name> [options] "<text>"
```

| Option | Meaning |
|---|---|
| `--kind` | `bug`, `confusion`, `doc`, `missing`, `workaround`, `thought`, `comprehension` or `praise`. |
| `--component` | The skill, the script or the MCP tool. Examples: `c64-emulator`, `assemble.ts`, `c64_screen`. Default: `general`. |
| `--severity` | `low`, `medium` or `high`. Default: `medium`. |
| `--by` | `llm` (default) or `user`. |
| `--intent` | What you wanted to do. |
| `--choice` | Which skill or tool you chose, and why. |
| `--expected` | What you expected. |
| `--actual` | What you got. |

The script appends one JSON line to `field-test/notes.jsonl` in the project root. It prints the file and the line number. The exit status is 0 for a note and 2 for a wrong argument.

## When to write a note

Write the note at once, before you continue. Write one when:

1. You must guess which skill or tool to use. Kind: `confusion`. Give `--choice`.
2. A tool, a script or the emulator fails, or gives a result you did not expect. Kind: `bug`. Give `--expected` and `--actual`. Copy the error code and the message into the text.
3. A SKILL.md, a tool description or a result field is unclear or wrong. Kind: `doc`. Name the file or the tool.
4. A tool or an option that you need does not exist. Kind: `missing`.
5. You find another way around a problem. Kind: `workaround`. Say what you did instead.
6. You complete a workflow step. Kind: `thought`. Say what you did, what was hard, and how many tool calls it took.
7. Something works well. Kind: `praise`. Keep it short.

Write the note in your own words. Do not make a problem smaller than it is. A note that says "I was not sure" is more useful than a note that says "it worked".

When you must read the source of a script or the MCP server to find out how to use it, write a `doc` note first. Say what the documentation lacks.

## The notes of the user

When the user writes a message that starts with `note:`, save the text after `note:` without a change, with `--by user` and the kind that fits (default: `bug`). Then add a note of your own with `--kind thought` on the same problem: what you saw on your side, and what you think the cause is. Then continue the work.

## Kinds

| Kind | Use |
|---|---|
| `comprehension` | What you think a skill or a tool does, before you use it. The session starts with these. |
| `confusion` | You had to guess. |
| `bug` | A failure, or a result you did not expect. |
| `doc` | A description that is unclear or wrong. |
| `missing` | A tool or an option that does not exist. |
| `workaround` | What you did instead. |
| `thought` | A step is complete, or a reflection on a problem. |
| `praise` | Something that worked well. |

## Rules

- A note is short: one to five sentences.
- One problem per note.
- Name the tool or the skill as the project names it.
- Do not edit the files under `.claude/skills/c64-*` to get past a problem. Write a note instead.
