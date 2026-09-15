# STE100 strict pass — one item per skill

Shared rules for EVERY item (from .planning/notes/ste100-conformance-of-the-shipped-skills.md):

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
  python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json <the files for this item>

1. Apply the STE100 strict pass to src/skills/c64-program-recon/SKILL.md and its six
   references/*.md and templates/*.md files. Baseline 108 violations in SKILL.md.
2. Apply the STE100 strict pass to src/skills/c64-memory-mapping/SKILL.md. Baseline 71.
3. Apply the STE100 strict pass to src/skills/vice-wedge-triage/SKILL.md. Baseline 56.
   This file holds the evidence-ledger tables the cell-not-row rule exists for.
4. Apply the STE100 strict pass to src/skills/routine-queue-walker/SKILL.md. Baseline 50.
5. Apply the STE100 strict pass to src/skills/c64-ram-capture/SKILL.md, its
   templates/capture-record.template.md and transients/README.md. Baseline 46 in SKILL.md.
6. Apply the STE100 strict pass to src/skills/c64-provenance-diff/SKILL.md. Baseline 39.
7. Apply the STE100 strict pass to src/skills/acme-build/SKILL.md. Baseline 23.
8. Apply the STE100 strict pass to src/skills/c64-disk-access/SKILL.md. Baseline 22.
9. Apply the STE100 strict pass to src/skills/c64-petcat/SKILL.md. Baseline 9.
