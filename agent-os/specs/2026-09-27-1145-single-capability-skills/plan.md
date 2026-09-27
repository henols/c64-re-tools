# Single-capability skills

## Context

The eight skills in `skills/` mix capabilities. `c64-program-recon` (706
lines) teaches the RE method and also the VICE tools, the annotation store,
Ghidra import and BASIC tokens. `c64-memory-mapping` (641 lines) teaches
address lookup and also region classification and symbol naming. The
"How to run an anno verb" block is copied six times. The 4096-byte
`anno_read_region` cap is restated five times. VICE driving, the annotation
store, Ghidra/dxa and the broker plumbing have no skill of their own. The
shared plumbing (`mcp-module.ts`, `project-paths.ts`, `releases.ts`) lives
inside `c64-ram-capture`, and six skills load it from there as a sibling.

Owner decision: each skill covers one capability and does not mix. Names
use the `c64-` prefix plus the capability they provide, not the tool behind
it (for example `c64-emulator`, not `vice`).

Outcome: 12 skills, each teaching one thing and linking inline to the next
skill only where the reader must go next. Ghidra and dxa become usable from
a skill for the first time.

## Target skill set

| New skill | From | Capability | Scripts |
|---|---|---|---|
| `c64-emulator` | new (recon refs, ram-capture boot/epoch) | Drive the running C64 via `vice_*` MCP tools: tool map, boot a disk, checkpoints, input, observation hazards, epoch | none (MCP tools) |
| `c64-assembler` | `acme-build` | Assemble 6510 source to a .prg, scaffold, used-symbols list | `acme.ts`, `template.a` |
| `c64-disk` | `c64-disk-access` | Read a .d64: directory, BAM, chains, file bytes, audit | `c1541.ts` |
| `c64-basic` | `c64-petcat` (+ recon's BASIC token section) | Detokenize BASIC, PETSCII to/from ASCII, SYS handover | `petcat.ts` |
| `c64-disassembler` | new | Disassemble a .prg or flat image (Ghidra analysis + export, dxa listing) | new `disassemble.ts` |
| `c64-unpacker` | recon step 0.5, walker phase 0 | Detect a packed binary, name the packer with the unp64 oracle, and depack by running past the decrunch | `packer-finding.ts` |
| `c64-memory-map` | `c64-memory-mapping` (lookup parts only) | What an address or register value means; annotate a listing | `driver.ts`, `derive.ts`, `memmap.json` |
| `c64-annotations` | new (anno content from 5 skills + `tool-selection.md`) | The annotation project: `anno_*` tools, `anno` CLI verbs, `export-asm`, `render-memmap`, Ghidra-export import, enums, coverage reports | `completeness-report.ts` |
| `c64-ram-capture` | `c64-ram-capture` (capture parts only) | Capture 64K RAM, compare captures, transients, vsf slice, load watch | capture scripts |
| `c64-provenance` | `c64-provenance-diff` | Diff cracked releases, decide original vs. cracker bytes | `diff-images.ts`, `recovery-schema.ts` |
| `c64-reverse-engineering` | `c64-program-recon` method + `routine-queue-walker` method + memory-mapping's classification/naming method | The RE method: recon order, document a routine, classify regions, name symbols, drive the backlog to closure | none (method, `references/` for depth) |
| `c64-project` | shared modules from `c64-ram-capture` | The RE project workspace: layout, release registry, broker and host-tool connection | `mcp-module.ts`, `project-paths.ts`, `releases.ts` |

`routine-queue-walker` disappears. Its method is part of the RE method, and
its script calls anno report verbs, so it goes to `c64-annotations`.

**Shared code: a `c64-project` skill, not the npm package.** Every skill
script that needs shared code already loads it through `scripts/sibling.ts`.
Only `SIBLING_SKILL` and the import paths change. The alternative, moving
the modules into `@henols/vice-mcp`, would turn every direct function import
into a subprocess call and add compiled `dist/` roots, and the
cross-package-reach standard forbids static imports across that line. No
plugin or agent rework is needed: the skills CLI finds every
`skills/<name>/SKILL.md` on its own, and the plugin bundles root `skills/`.

**No old-name stubs.** A renamed skill is gone under its old name. Users run
`npx skills add henols/c64-re-tools --skill '*'` again.

## Task 1: Save spec documentation

Create `agent-os/specs/2026-09-27-1145-single-capability-skills/` with
`plan.md` (this plan), `shape.md` (scope, owner decisions: prefixed
capability names, Ghidra/dxa get scripts, shared code decided by me as
`c64-project`, walker merged, no stubs; plus facts and traps below),
`standards.md` (the five standards, short note form),
`references.md` (`c64-petcat` as the pattern skill, `sibling.ts`,
`mcp-module.ts`, `ghidra-run.ts`, `dxa-run.ts`). No `visuals/`. Add an
"In progress" block to `agent-os/product/roadmap.md`.

## Task 2: `c64-project` and the sibling move

- `git mv` `mcp-module.ts`, `project-paths.ts`, `releases.ts`,
  `RELEASES.json.example` from `c64-ram-capture/scripts/` to
  `skills/c64-project/scripts/`.
- `addrNum`/`hex4` (from `watch-loads.ts`, used by `diff-images.ts`): move
  them into `c64-project` too, so provenance does not depend on
  ram-capture. `watch-loads.ts` imports them from there.
- Every `sibling.ts`: `SIBLING_SKILL = "c64-project"`, install hint updated.
  `c64-ram-capture` gets a `sibling.ts` too, because it now consumes
  `c64-project`. All copies stay byte-identical.
- Fix `mcp-module.ts`'s in-repo lookup of `src/mcp/vice` (it walks up to
  `skills/`, so the depth does not change, but verify it).
- `c64-project/SKILL.md`: project layout (`.c64-re-tools/` committed, `local/`
  machine-local), release registry shape (from ram-capture 412-432), the
  broker requirement for host tools, `releases.ts list`.
- Move `test/skills/c64-ram-capture/*` tests for the three moved modules to
  `test/skills/c64-project/`. Update `test/skills/sibling.test.ts` `CASES`.

## Task 3: Renames that keep one capability

`git mv` each folder and its `test/skills/<name>/` folder:
`acme-build` to `c64-assembler`, `c64-disk-access` to `c64-disk`,
`c64-petcat` to `c64-basic`, `c64-memory-mapping` to `c64-memory-map`,
`c64-provenance-diff` to `c64-provenance`. Then update every dependent
found in exploration:
- `name:` in each frontmatter and the `S=`/`A=`/`D=` script path lines.
- Paths the scripts print (`.claude/skills/<name>/scripts/...` in
  `diff-images.ts`, `watch-loads.ts` and the `acme.ts` scaffold `; Build:`
  line) and the tests that assert them.
- `memmap.json` path: `src/mcp/vice/build.ts` `SERVER_DATA_FILES`,
  `memmap-lookup.mts:57`, `anno-regbits-gen.mts:62`, and the six tests that
  read it directly.
- `src/mcp/vice/skill-*-cli.test.ts`, `anno-decomp-closure.test.ts`,
  `reassembly-gate-modified-run.test.ts`, `anno-export-asm.test.ts`,
  `anno-provenance-ledger.test.ts`, `stock-memory-search.ts:289` + test,
  `no-handwritten-mjs.test.ts:47`.
- `prerequisites.json` `unblocks.skills` and its `SKILL.md:<line>`
  citations, then regenerate `resources/` and the README table.
- `.github/workflows/ci.yml:111` step name and test file.
- Leave `fixtures/upstream-procedure-manifest.json` alone (history).

## Task 4: `c64-emulator` (new)

SKILL.md only. Built from `c64-program-recon/references/observation-hazards.md`
and `tool-selection.md` (VICE tool map part), recon's "Before you touch the
emulator", and ram-capture's "Boot a disk" and "Prove the machine did not
change". One copy each of the `vice_keyboard_matrix` limit and the
"emulator looks dead, check your checkpoints" advice. Delete those sections
from the source skills. `references/` for per-chip state reading
(graphics, sound-and-input VICE parts).

## Task 5: `c64-annotations` (new)

One home for the annotation store, consolidated from recon 171-349 and
351-399, memory-mapping 190-233 and the tool parts of 242-490, walker 33-48
and 246-365, acme-build 140-201, provenance-diff 132-174, and
`tool-selection.md` 26-64. It holds the only copy of: how to run an anno
verb, `annotations.db` location, the `image` argument rule, the read-region
cap, confidence prefixes, `export-asm` (current state only, no withdrawal
history), `render-memmap` + `templates/memory-map.template.md`, Ghidra
export import, `anno_join_memmap`, enums (including the undocumented
`anno_update_project_enum`), evid/hazard verbs. `git mv`
`routine-queue-walker/scripts/completeness-report.ts` here with its test.

## Task 6: `c64-unpacker` (new)

`git mv` `c64-program-recon/scripts/packer-finding.ts` + test. SKILL.md from
recon step 0.5 and walker phase 0 (one entropy threshold, one gate).

## Task 7: `c64-disassembler` (new, with script)

- Add a CLI entry to `src/mcp/vice/ghidra-run.ts` and `dxa-run.ts` (a
  guarded `main` that prints one `{ok,...}` JSON line), and add both to
  `SERVER_ROOTS` in `build.ts` so `dist/` ships them.
- `skills/c64-disassembler/scripts/disassemble.ts`: verbs `analyze` (Ghidra,
  produces the export) and `listing` (dxa). It resolves the module with
  `resolveMcpModule()` from `c64-project` and runs it with
  `process.execPath`. It requires `--image`, and never guesses the processor,
  the entry points or the image kind.
- SKILL.md: when to use which, the Ghidra extension install
  (`ghidra.installExtension`), undocumented opcodes
  (`docs/undocumented-opcodes-ghidra.md`), then an inline link to
  `c64-annotations` for importing the export.
- Tests in `test/skills/c64-disassembler/` with the seam faked through
  injectable deps. `prerequisites.json`: `ghidra` and `dxa` unblock
  `c64-disassembler`.

## Task 8: `c64-reverse-engineering` (method only)

`git mv c64-program-recon c64-reverse-engineering`. Keep the order, scoping
step, worked example and "Documenting one routine". Add memory-mapping's
"Classifying every region" and "What a symbol represents" as method, and
walker's queue discipline (phases 2-4, failure handling) as
`references/backlog-to-closure.md`. Every tool step becomes an inline link
("use `c64-annotations` to write it"), not a copied instruction. Move
`derive.ts` to `c64-memory-map`. Delete `routine-queue-walker/`.

## Task 9: Strip and align every SKILL.md

- Remove all four "Which skill does what" tables and the repeated
  "Record findings" boilerplate (skill-md-shape forbids skill-map tables).
- Each skill ends with "What this skill does NOT do", naming the skill
  that does it.
- Fix the stale claims found in exploration: `.claude/CLAUDE.md § Emulator
  Access` citations (file does not exist), recon's "no .d64 extraction",
  recon's "No broker is involved", acme's "the emulator skills",
  `tool-selection.md:81`.
- Descriptions: triggers only for the skill's own capability, so two skills
  never compete for one phrase.

## Task 10: Docs

`README.md` skill list and counts ("eight" to "twelve", four places), the
sibling note, the regenerated prerequisites table; `agent-os/product/mission.md`
skill list; `tech-stack.md:57`; `CLAUDE.md` template path
(`skills/c64-assembler/template.a`); `.claude-plugin/*` descriptions.

## Facts and traps

- `node --test` silently skips a missing file. After the moves, run the full
  `test/skills/**` glob and compare the skip count with the recorded
  baseline (220 tests, 6 skipped); a higher count means a broken path.
- NUL bytes hide some files from grep. Use `grep -a` when finding old
  skill names.
- `project-paths.ts` uses a different root scheme (`.git` walk, `C64RE_*`)
  from `.c64-re-tools/`. Out of scope. Record it in shape.md and do not
  unify it here.
- The one-script rule in skill-md-shape is read as one capability:
  ram-capture, provenance and memory-map keep several scripts that all serve
  their one capability.

## Verification

1. `npx skills add ./ --list` lists exactly the 12 new names, and none of
   the old ones.
2. `npx skills add ./ --skill c64-basic --copy` into a scratch dir without
   `c64-project`: running `petcat.ts` refuses, naming `c64-project`
   (sibling test covers this for every consumer).
3. `grep -a -rn` for each old skill name over the repo returns only the
   historical spec folders and the upstream-procedure fixture.
4. `tsc --noEmit -p src/mcp/vice`, `node src/mcp/vice/build.ts` (dist has
   `memmap.json`, `ghidra-run.js`, `dxa-run.js`), `resources-sync` and
   `prereq-readme-gen` tests green.
5. Full test run with the output redirected to a file and `$?` read on the
   same line. Compare the failing set, never the count.
6. Live: `disassemble.ts analyze` and `listing` on a fixture .prg against a
   hand-started broker, with Ghidra at its non-standard path. Stop the
   broker afterwards.
