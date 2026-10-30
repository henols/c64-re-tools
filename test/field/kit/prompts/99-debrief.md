# Debrief

Do this at the end of the session. Use the c64-field-debug skill.

First, find up to five parts of the skill text that changed what you did. Examples: a check that you did only because of the text, or a mistake that the text stopped. A workflow step that you followed does not count.

- Write one note for each part with `--kind quote --component <skill>`.
- Copy the words exactly from the skill. Copy four words or more.
- In `--effect`, say what you did or did not do because of the words.
- Write the part that had the largest effect first.

```
node .claude/skills/c64-field-debug/scripts/note.ts --kind quote --component <skill> --effect "<what you did or did not do>" "<the words from the skill>"
```

If no skill text changed what you did, write one quote note with the text `None.`.

Then, for each skill and each MCP tool that you used, write one note with `--kind thought --component <name>`. The text has four parts:

1. What worked.
2. What was confusing or wrong. Name the file or the field.
3. What you would change in its SKILL.md or its description, in one sentence.
4. A rating of the description, from 1 (I could not tell what it does) to 5 (I knew exactly when and how to use it). Put it at the start of the text as `rating: N`.

Last, write one note with `--component overall`. Name the three changes that would help you most.
