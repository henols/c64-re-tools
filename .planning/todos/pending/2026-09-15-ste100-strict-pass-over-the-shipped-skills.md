---
title: Run a strict ASD-STE100 pass over all 18 markdown files under src/skills
date: 2026-09-15
priority: medium
audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

# Task

Apply ASD-STE100 strict mode to the nine `SKILL.md` playbooks and their nine
`references/`/`templates/` files. Scope, decisions and measured baseline are in
`.planning/notes/ste100-conformance-of-the-shipped-skills.md`.

Baseline at 2026-09-15: 540 violations (294 hard) over 34,098 words, 18 files.

# In scope

1. Delete every prose semicolon — 168 in `SKILL.md`, 41 in references.
2. Split the 16 over-long body sentences. 20 words in a procedure, 25 elsewhere.
3. Collapse the 8 rotating verb clusters to one verb each
   (check/confirm/verify/validate, fix/correct/repair, change/modify/alter,
   halt/stop/terminate, fetch/get, launch/start/begin, delete/remove/erase,
   display/show).
4. Convert passive to active wherever the actor is named — `is refused` (16),
   `is written` (7), `is reported` (7).
5. Decide the 10 present-perfect hits case by case. Keep the compound form where it
   carries current relevance.

# Out of scope

- **The `description:` frontmatter of all nine skills.** Exempt by decision D-2: it is a
  retrieval index that decides whether the skill triggers, not prose. This leaves 16 hard
  `long-sentence` violations permanently. Do not "fix" them.
- Fenced code blocks, verbatim tokens, tool names, register names, binary paths.
- A CI lint gate. Decision D-3 is a one-off pass, not a ratchet.

# Rule for the evidence tables

A table cell is a record. STE applies to the sentences **inside** a cell, never to the
row. Split a multi-clause cell and remove its semicolons. Keep every measurement, path,
version number and verbatim token. Never split or merge a row.
`src/skills/vice-wedge-triage/SKILL.md:235` is the case this rule exists for.

# How to check progress

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py --json $(find src/skills -name '*.md')
```

The linter is host-global, outside this repo, and is not vendored. It skips fenced code
blocks. Hedges and modality are never flagged by design.

# Guard

Preserve every fact, condition, scope qualifier and hedge. A shorter sentence that turns
"may have failed" into "failed" is a different claim, not a simplification. Where a
rewrite would cost precision, keep the longer phrasing.
