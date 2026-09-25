# Phase 65 Plan 02 evidence: the anno_* surface census

Written 2026-09-25 as the replacement for the deleted `scripts/check-skill-tool-coverage.mjs`
structural guard, per the plan's own note (that guard was deleted in commit `e4759250`,
`ci(260914-poo): drop the four text-scanning skill checkers ...`, and 260914-poo D-1 bans a
test that asserts on document text, so this plan does not rebuild it). This document is the
measure-don't-assert proof in its place -- the same shape 64 D-18 chose.

## Reproducible commands

Four tracked source files in this project's own `src/mcp/vice/*.ts` tree carry a NUL byte
(measured 2026-09-19: `anno-memmap-render.ts`, `anno-store-export.ts`,
`prereq-readme-gen.ts`/`.mjs` equivalents, `prerequisites.test.ts` -- see CLAUDE.md's own
"Conventions" section). Plain `grep` silently truncates a NUL-bearing file's matches to
whatever precedes the first NUL. None of the commands below touch those four files (this
census scans `src/skills/`, not `src/mcp/vice/`), but `grep -a` is used throughout anyway --
matching this project's own standing discipline rather than assuming today's scan is immune to
tomorrow's file.

```bash
# Every remaining anno_ occurrence under src/skills/
for f in $(find src/skills -name "*.md" | sort); do
  grep -a -n "anno_" "$f" | sed "s|^|$f:|"
done

# The npx -y anno form -- must be zero
grep -a -rn 'npx -y @henols/vice-mcp anno' src/skills

# The "anno_* MCP" phrase -- must be zero
grep -a -rn 'anno_\* MCP\|anno_\*` MCP' src/skills
```

## Measured tools/list count

MEASURED 2026-09-25 by spawning the real `vice-proxy.ts` over stdio (no emulator, no
broker -- `initialize` then `tools/list`), both before Task 2's registration-loop deletion
(read from git history) and after (read live from the working tree at Task 2's own commit,
`f0bba850`):

| | Count | Composition |
|---|---|---|
| **Before** (`c4ac2a0c`, the 65-01 close, last commit before this plan) | 76 | 47 from the `vice_*` manifest (including `vice_recycle`/`vice_diagnose`) + 1 synthetic (`vice_result_continue`) + 28 `anno_*` (`CURATED_ANNO_TOOLS.length`, MEASURED -- not the plan's own estimated 25) |
| **After** (`f0bba850`, this plan's Task 2 commit) | 48 | 47 from the `vice_*` manifest (unchanged) + 1 synthetic (`vice_result_continue`). Zero `anno_` names. |

The "before" figure (76) matches CLAUDE.md's own PRE-EXISTING count exactly (76 = 47 + 29,
where 29 = 28 `anno_*` + 1 `vice_result_continue`) -- confirming CLAUDE.md's original number
was accurate at the time, and only the plan's own working estimate of "25" (stated in this
plan's own objective and D-13) undercounted. `CURATED_ANNO_TOOLS` is derived from
`ANNO_TOOL_DEFINITIONS` (`anno-tools.ts`), and this plan's Task 1 measured it directly rather
than trusting the estimate -- see 65-02-SUMMARY.md's Deviations section for where the stale
"25"/"19" figures were corrected in-flight (anno-cli.ts's own header, this project's
`.planning/codebase/*.md`).

## Every remaining `anno_` occurrence under `src/skills/`

120 occurrences across 9 files. Disposition computed per line: `in an anno call step` (the
line itself contains `anno call anno_<name>`, satisfying the plan's must-have that every
remaining name sits inside, or is defined by, an `anno call` invocation), `prose (...)` for a
line that names a verb without a literal `anno call` prefix on that SAME line but is
unambiguously defined by the file's own preceding "How to run an anno verb" block or a
`--args-file`/wildcard mention, and the one KNOWN RESIDUAL this plan deliberately does not
touch.

| File:Line | Disposition |
|---|---|
| `src/skills/acme-build/SKILL.md:146` | prose (names the verb inside the file's own how-to-run block) |
| `src/skills/acme-build/SKILL.md:198` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:227` | prose (names the verb inside the file's own how-to-run block) |
| `src/skills/c64-memory-mapping/SKILL.md:231` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:269` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:293` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:294` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:295` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:307` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:319` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:322` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:326` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:335` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:336` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:337` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:340` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:342` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:343` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:346` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:360` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:366` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:370` | prose (pseudo-verb name inside a code fence the preceding text maps to `anno call`) |
| `src/skills/c64-memory-mapping/SKILL.md:371` | prose (pseudo-verb name inside a code fence the preceding text maps to `anno call`) |
| `src/skills/c64-memory-mapping/SKILL.md:372` | prose (pseudo-verb name inside a code fence the preceding text maps to `anno call`) |
| `src/skills/c64-memory-mapping/SKILL.md:373` | prose (pseudo-verb name inside a code fence the preceding text maps to `anno call`) |
| `src/skills/c64-memory-mapping/SKILL.md:374` | prose (pseudo-verb name inside a code fence the preceding text maps to `anno call`) |
| `src/skills/c64-memory-mapping/SKILL.md:375` | prose (pseudo-verb name inside a code fence the preceding text maps to `anno call`) |
| `src/skills/c64-memory-mapping/SKILL.md:382` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:444` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:455` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:463` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:464` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:476` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:508` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:511` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:520` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:564` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:565` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:597` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:601` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:603` | in an `anno call` step |
| `src/skills/c64-memory-mapping/SKILL.md:628` | in an `anno call` step |
| `src/skills/c64-program-recon/references/reconstruction.md:132` | in an `anno call` step |
| `src/skills/c64-program-recon/references/tool-selection.md:31` | prose (names the verb inside the file's own how-to-run block) |
| `src/skills/c64-program-recon/references/tool-selection.md:34` | prose (wildcard reference to the family, not a specific verb) |
| `src/skills/c64-program-recon/references/tool-selection.md:42` | in an `anno call` step |
| `src/skills/c64-program-recon/references/tool-selection.md:48` | in an `anno call` step |
| `src/skills/c64-program-recon/references/tool-selection.md:49` | in an `anno call` step |
| `src/skills/c64-program-recon/references/tool-selection.md:50` | in an `anno call` step |
| `src/skills/c64-program-recon/references/tool-selection.md:56` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:102` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:181` | prose (names the verb inside the file's own how-to-run block) |
| `src/skills/c64-program-recon/SKILL.md:185` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:186` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:190` | prose (wildcard reference to the family, not a specific verb) |
| `src/skills/c64-program-recon/SKILL.md:193` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:194` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:203` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:204` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:205` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:206` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:207` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:217` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:220` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:221` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:222` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:233` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:236` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:237` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:240` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:262` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:338` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:345` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:390` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:437` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:467` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:498` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:515` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:522` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:523` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:545` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:546` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:618` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:654` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:656` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:657` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:658` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:660` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:666` | in an `anno call` step |
| `src/skills/c64-program-recon/SKILL.md:680` | in an `anno call` step |
| `src/skills/c64-program-recon/templates/memory-map.template.md:4` | in an `anno call` step |
| `src/skills/c64-program-recon/templates/memory-map.template.md:85` | in an `anno call` step |
| `src/skills/c64-program-recon/templates/memory-map.template.md:101` | in an `anno call` step |
| `src/skills/c64-provenance-diff/SKILL.md:159` | prose (names the verb inside the file's own how-to-run block) |
| `src/skills/c64-provenance-diff/SKILL.md:166` | in an `anno call` step |
| `src/skills/c64-provenance-diff/SKILL.md:168` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:37` | prose (names the verb inside the file's own how-to-run block) |
| `src/skills/routine-queue-walker/SKILL.md:43` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:44` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:45` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:51` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:86` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:90` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:94` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:95` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:96` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:98` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:114` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:135` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:146` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:163` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:166` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:167` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:196` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:214` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:219` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:388` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:397` | in an `anno call` step |
| `src/skills/routine-queue-walker/SKILL.md:400` | in an `anno call` step |
| `src/skills/vice-wedge-triage/SKILL.md:185` | KNOWN RESIDUAL -- out of scope, file not edited this plan |


**Summary by file:**

| File | Total | `anno call` step | Prose (defined by context) | Residual |
|---|---|---|---|---|
| `acme-build/SKILL.md` | 2 | 1 | 1 | 0 |
| `c64-memory-mapping/SKILL.md` | 40 | 33 | 7 | 0 |
| `c64-program-recon/references/reconstruction.md` | 1 | 1 | 0 | 0 |
| `c64-program-recon/references/tool-selection.md` | 7 | 5 | 2 | 0 |
| `c64-program-recon/SKILL.md` | 40 | 38 | 2 | 0 |
| `c64-program-recon/templates/memory-map.template.md` | 3 | 3 | 0 | 0 |
| `c64-provenance-diff/SKILL.md` | 3 | 2 | 1 | 0 |
| `routine-queue-walker/SKILL.md` | 23 | 22 | 1 | 0 |
| `vice-wedge-triage/SKILL.md` | 1 | 0 | 0 | 1 |
| **Total** | **120** | **105** | **14** | **1** |

The "prose" rows are never a caller-facing invocation on their own -- each sits inside a
sentence or table row that follows the file's own "How to run an anno verb" block, or is the
`--args-file <path> ... such as anno_batch_execute's` example line that block itself carries,
or (in `c64-memory-mapping/SKILL.md`'s pseudocode batch example and `tool-selection.md`'s two
wildcard references) is explicitly introduced by adjacent prose stating the mapping to
`anno call <name>`. None of the 120 names the npm package's `npx -y` form, and none calls a
verb an MCP tool.

## The `vice-wedge-triage` residual

`src/skills/vice-wedge-triage/SKILL.md:185` reads:

> "...can never be one of them:** the `anno_*` tool surface and the `anno` CLI are pure
> store-and-image..."

This line still calls the family a "tool surface" distinct from "the `anno` CLI" -- both
halves of that framing predate D-12/D-13 and are now imprecise (there is no separate "tool
surface" any more; the CLI is the only surface). **This plan deliberately does not edit this
file.** The main working tree carries uncommitted owner edits to
`src/skills/vice-wedge-triage/SKILL.md` that are not this phase's work (see this plan's
`<run_context>`), and merging a branch that touches the same file would collide with those
edits. Fix once the owner commits their own changes to this file.

## Why this census replaces `check-skill-tool-coverage.mjs`

That guard used to assert, by scanning skill source text, that a skill never claimed a tool
the server does not advertise. It was deleted whole in commit `e4759250`
(`ci(260914-poo): drop the four text-scanning skill checkers ...`), because 260914-poo
decision D-1 banned any test that asserts on document text going forward -- a source-text
assertion is exactly the shape that guard was. This project's Phase 64 (D-18) established the
replacement discipline for exactly this situation: MEASURE the property in phase evidence
(this document) rather than encode it as a new source-scanning test. This document is that
measurement for D-13's own claim ("no skill teaches an anno tool call; every anno instruction
names a CLI form that runs today").
