---
status: complete
quick_id: 260917-cfx
date: 2026-09-17
commits:
  - 6f856111
  - b406de46
files_modified:
  - CLAUDE.md
---

# Quick Task 260917-cfx — Summary

Corrected seven verified factual errors in `CLAUDE.md` and replaced the two
truncated GSD-generated blocks. `CLAUDE.md` went from 329 to 240 lines.

## Task 1 — factual corrections (commit `6f856111`)

| # | Claim in CLAUDE.md | Reality | Fix |
|---|---|---|---|
| C1 | The set of modules that spawn the emulator is "currently empty" | `broker-launch.mts` spawns it. Its own comment at line 482 names the `spawn(viceBin, viceArgs)` call | Set now states one member and keeps the argv-array rule |
| C2 | `HOST_BOUND_ARTIFACTS` has 7 members | It has 10. `backend-detect`, `host-tool` and `ghidra-project` were missing | All ten listed |
| C3 | ACME prefixes live in `acme-build/SKILL.md:181-186` | They live in `findAcmeLib()` in `host-tool.mts`. That SKILL.md range is an unrelated topic | Both citations repointed at the function |
| C4 | "six" C64 skills, twice | There are nine | Nine, in both places |
| C5 | "~63 tools" | 76: 47 manifest plus 29 registered directly | 76, with the split stated |
| C6 | Three line anchors: `package.json:29`, `:58`, `installer/package.json:11` | All three point at `files[]` entries. The facts were correct | Anchors replaced by field names |
| C6d | `@mastra/mcp` at `package.json:64` | Line 64 is `"anno-cli.ts"`. The dep is at line 139 | Anchor replaced by field name |

C6d was found by the planner and pulled into scope by the orchestrator. It is
the same defect class as C6. Line numbers were replaced by field names rather
than by fresh numbers, because a fresh number rots the same way.

## Task 2 — block replacement (commit `b406de46`)

The two blocks held 70 bullets cut off mid-sentence, 10 headings with no
content, and an empty code fence.

The source documents are healthy: `.planning/codebase/CONVENTIONS.md` is 253
lines and `ARCHITECTURE.md` is 583 lines. The loss came from the CLAUDE.md
sync step, which keeps only the first physical line of each source bullet.
**Regenerating with `/gsd-map-codebase` would reproduce the damage.** The fix
was a hand-written condensation, recovered from the complete sources.

Rewritten under ASD-STE100 (Strict mode), because CLAUDE.md is instruction
text an agent parses with no human to resolve ambiguity: short active
sentences, no semicolons, one instruction per sentence, no truncated bullets.

147 lines to 57. Marker comments and the Component Responsibilities table
kept. The table cells were STE-rewritten in place, so the row count is
unchanged at 17.

## Verification

All assertions are mechanical greps, run against the tree and reported as run.

- Task 1: 20 assertions, all pass. Nine negative greps on the stale strings,
  seven positive greps on the replacements, one `awk` conjunction proving a
  single bullet names all ten host-bound modules, one exact-count check that
  `findAcmeLib()` is cited exactly twice.
- Task 2: 11 assertions, all pass. Markers balanced and ordered, combined
  size 57 (window 35-60), 17 pipe lines, 0 truncated bullets, 0 empty
  headings, fence gone, both source pointers present, 0 semicolons.
- `ste-lint.py`: 4 findings, then 1. Three were fixed (two passive-voice, one
  28-word sentence). The last is a false positive on a quoted example.

## Kept as-is

One `ste-lint` finding was not acted on. It flags `launch` and `start` as
synonym rotation inside the house-style comment example, "a second broker
launch raced the first and killed a live capture". That string is quoted
verbatim from `CONVENTIONS.md` as the project's own model of a good comment.
`launch` is a noun there. Rewriting a quoted example would damage it.

## Corrected during the pass

`CONVENTIONS.md` names `shipped-modules.ts` as the owner of a seam. Phase 56
deleted that file. The claim was not carried into the replacement.

## Deferred

`src/mcp/vice/vice-proxy.ts:1588-1589` explains the `anno_*` exemption by
reference to `refresh-manifest.ts` regenerating `tools-manifest.json`. Neither
file exists. The CLAUDE.md table row is the correct side. The source comment
is the stale one. Out of scope here.
