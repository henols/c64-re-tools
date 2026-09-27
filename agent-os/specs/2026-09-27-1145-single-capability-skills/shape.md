# Single-Capability Skills — Shaping Notes

## Scope

The owner's call (2026-09-27): each skill covers exactly one capability, such
as the emulator, the assembler or the reverse-engineering method, and a skill
never mixes capabilities.

Today the eight skills in `skills/` fail that rule:

- `c64-program-recon` teaches the RE method and also the VICE tools, the
  annotation store, Ghidra import and BASIC tokens.
- `c64-memory-mapping` teaches address lookup and also region
  classification and symbol naming.
- `c64-ram-capture` teaches RAM capture and also holds the shared plumbing
  that six other skills load.
- The emulator, the annotation store, Ghidra/dxa and the project workspace
  have no skill of their own. Their guidance is copied into several skills
  (the anno-verb block six times, the read-region cap five times).

The result is 12 skills, listed in `plan.md`.

## Decisions

- **Names: the `c64-` prefix plus what the skill provides (owner).** The
  name says the capability, not the tool behind it: `c64-emulator`, not
  `vice`; `c64-assembler`, not `acme`.
- **Ghidra and dxa get a skill with a script (owner).** `ghidra-run.ts` and
  `dxa-run.ts` gain a CLI entry and are shipped in `dist/`. The
  `c64-disassembler` skill script reaches them through `resolveMcpModule()`.
- **Shared code lives in a `c64-project` skill (decided by me, the owner
  asked for one place for all shared scripts).** Every consumer already
  loads it through `sibling.ts`, so only the sibling name and import paths
  change. Moving the modules into `@henols/vice-mcp` would turn function
  imports into subprocess calls, and the cross-package-reach standard
  forbids a static import across that line. No plugin or agent rework is
  needed: the skills CLI finds any `skills/<name>/SKILL.md`, and the plugin
  bundles root `skills/`.
- **`routine-queue-walker` is merged (decided by me).** Its queue
  discipline is part of the RE method. Its script wraps anno report verbs,
  so it moves to `c64-annotations`.
- **Packer detection is its own skill, `c64-unpacker` (decided by me).**
  It was a step inside recon and the walker, and it has its own tool (the
  unp64 oracle).
- **`derive.ts` moves to `c64-memory-map` (decided by me).** It decodes
  register values (VIC bank, screen/charset address, sprite pointers,
  vectors), which is the "what does this value mean" capability.
- **No old-name stubs.** A renamed skill is gone under its old name. Users
  install again with `--skill '*'`.
- **The one-script rule is read as one capability.** Skills whose several
  scripts all serve their one capability (ram-capture, provenance,
  memory-map) keep them.

## Facts

- The skills CLI finds each `skills/<name>/SKILL.md` by itself. Nothing
  lists skill names, so adding and renaming folders is enough for
  discovery.
- The MCP server has no `instructions` string. VICE guidance lives only in
  the tool descriptions (`tools-manifest.stock.json`) and in the skills.
- `ghidra-run.ts` and `dxa-run.ts` have no CLI entry today. Their only
  callers are tests and `host-tool.mts`.

## Traps

- `node --test` silently skips a missing file. After the moves, compare the
  `test/skills/**` skip count with the baseline (220 tests, 6 skipped).
- NUL bytes hide some source files from grep. Use `grep -a`.
- `project-paths.ts` uses a different root scheme (a `.git` walk and
  `C64RE_*` variables) from `.c64-re-tools/`. This is out of scope and is
  not unified here.
- Scripts print their installed path (`.claude/skills/<name>/scripts/...`),
  and tests assert it. Every rename has to update both.
- `fixtures/upstream-procedure-manifest.json` names the old skills as a
  historical record. Leave it alone.

## Context

- **Visuals:** none.
- **References:** see `references.md`. `c64-petcat` (now `c64-basic`) is the
  pattern skill.
- **Product alignment:** honest capability. Each skill refuses and names
  what is missing, for example a missing `c64-project` sibling. No skill
  installs an external tool.

## Standards Applied

- skills/skill-md-shape: every new and rewritten SKILL.md.
- skills/cross-package-reach: the sibling move and the new disassembler
  script.
- skills/script-results: the new and moved scripts.
- skills/refuse-never-guess: the disassembler script never guesses the
  processor, entry points or image kind.
- global/module-header: every new and moved module.
