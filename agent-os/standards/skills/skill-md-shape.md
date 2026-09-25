# SKILL.md Shape

~~~markdown
---
name: c64-petcat
description: <what it does, one sentence>. Use when asked to <trigger>,
  <trigger>, or <trigger>.
---

# <Doing the thing>

**<The one rule whose violation is expensive.>** <Why, 1-2 lines.>

```bash
S=src/skills/c64-petcat/scripts/petcat.ts   # from the repo root
```

## <Task sections, in the order the work happens>
## Failure shape
## What this skill does NOT do
## Troubleshooting
~~~

- The description lists the phrases a user actually says. It is the
  only thing that triggers the skill.
- One script per skill, bound to a shell variable once and reused.
- Troubleshooting is a `Symptom | Correct` table. Symptom is the literal
  error text.
- No skill-map table, no dated history, no withdrawal notes. Link another
  skill inline only where the reader must go next.
