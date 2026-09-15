# STE100 strict pass — shared rules for every batch item

Source of truth: `.planning/notes/ste100-conformance-of-the-shipped-skills.md`.
Every item in the STE100 batch obeys ALL of the rules below, identically.

- Fixed verb glossary, apply identically in all items: check (not confirm/verify/validate),
  correct (not fix/repair), change (not modify/alter), stop (not halt/terminate),
  get (not fetch), start (not launch/begin), remove (not delete/erase), show (not display).
- Delete every prose semicolon. A clause join becomes two sentences. A semicolon-chained
  list item takes a full stop.
- Split sentences over 20 words in a procedure, over 25 elsewhere.
- Convert passive to active wherever the actor is named. Leave passive where the object is
  the topic of a lookup row.
- Keep the compound tense where it carries current relevance.
- DO NOT touch the `description:` field in the YAML frontmatter. It is exempt by decision D-2.
- DO NOT touch fenced code blocks, tool names, register names, binary paths, version numbers
  or any verbatim token.
- A table cell is a record. Apply STE to the sentences inside a cell, never to the row.
  Never split or merge a row.
- Preserve every fact, condition, scope qualifier and hedge. "may have failed" never becomes
  "failed".
- Check progress with:
  `python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json <the files for this item>`
