---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 07
subsystem: packaging
tags: [npm-publish, licensing, packaging-gate, node-test, docs]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 01)
    provides: "disasm-opcodes.ts's zlib provenance header (cc65 commit/date) this plan attributes in the notices file"
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 02)
    provides: "stock-derived.ts's files[] entry, re-asserted here as a regression guard"
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 05)
    provides: "stock-disassemble.ts + the three disasm-*.ts files[] entries, re-asserted here as a regression guard"
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 06)
    provides: "the final acmeExpressible !byte substitution set (35 opcodes) and the ACME version the round-trip ran against, both copied verbatim into docs/stock-vice-parity.md"
provides:
  - "THIRD-PARTY-NOTICES.md (canonical, .claude/mcp/vice/, plus a repo-root pointer): cc65's zlib provenance, the no-GPL-material disclaimer, ACME's test-only-subprocess statement, and the fluffy-6502/VICE not-a-source notes"
  - "scripts/check-npm-packages.mjs's extended gate: notices-file presence, the five Phase 4 module entries, a transitive-closure walk from vice-proxy.ts (Rule 2 generalised into a mechanical check), and a runtime-dependency-set assertion (DISASM-07)"
  - "docs/stock-vice-parity.md's four Phase 4 disassembler-divergence bullets (D-09/D-13/D-12/D-14) for Phase 8's VERIF-03 parity harness"
affects: [phase-8-parity-harness, npm-publish-ci]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Packaging gate over prose claim: every new assertion reads npm pack --dry-run --json's own file list (vice.files), never existsSync() against a repo path -- the one exception (the repo-root pointer) is explicitly reasoned about rather than assumed"
    - "Transitive-closure walk generalising Phase 3's Rule 2: a BFS/DFS over relative imports starting from vice-proxy.ts, asserting every reachable local module resolves inside the packed tarball's files[] list"
    - "Prove-the-gate-fails-first discipline: every new assertion was verified to actually trip (wrong module removed, wrong file removed, dummy dependency added) before being trusted, then restored byte-identically"

key-files:
  created:
    - .claude/mcp/vice/THIRD-PARTY-NOTICES.md
    - THIRD-PARTY-NOTICES.md
  modified:
    - .claude/mcp/vice/package.json
    - scripts/check-npm-packages.mjs
    - docs/stock-vice-parity.md

key-decisions:
  - "Notices file placement follows the plan's own Option 2 (canonical file inside .claude/mcp/vice/, repo-root file as a licence-text-free pointer) -- npm's files[] cannot reach outside the package.json directory, confirmed empirically by the repo's own root LICENSE being absent from the packed tarball today"
  - "Phase 4's parity-doc decision IDs (D-09/D-13/D-12/D-14) are written as 'Phase 4 D-09' etc. throughout, because docs/stock-vice-parity.md already uses the bare labels D-13 and D-14 for two unrelated Phase 3 decisions (disk detach, disk-attach AUTOSTART approximation) earlier in the same document -- the 'Phase 4' prefix is load-bearing disambiguation, not decoration"
  - "The five Phase 4 module files[] entries (stock-derived.ts, stock-disassemble.ts, disasm-opcodes.ts, disasm-decoder.ts, disasm-renderer.ts) were verified present BEFORE editing package.json in this plan -- confirmed via direct grep against files[] -- so no earlier-wave packaging defect exists to record"

requirements-completed: [DISASM-07]

# Metrics
duration: ~40min
completed: 2026-08-17
---

# Phase 04 Plan 07: Packaging Gate and Third-Party Notices Summary

**Closes criterion 5 with a packaging check, not a prose claim: `@henols/vice-mcp` now fails to publish without `THIRD-PARTY-NOTICES.md` actually in the packed tarball, a transitive-closure walk from `vice-proxy.ts` makes Rule 2 mechanical for every future phase, and `docs/stock-vice-parity.md` gets the four enumerated Phase 4 divergences Phase 8's parity harness needs.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 completed, plus 1 deviation fix
- **Files modified/created:** 5 (2 created, 3 modified)

## Accomplishments

- **`THIRD-PARTY-NOTICES.md` (canonical + root pointer):** the canonical file
  (`.claude/mcp/vice/THIRD-PARTY-NOTICES.md`) attributes cc65's zlib-licensed
  opcode table with the exact commit/date recorded by 04-01
  (`547d923588d870aacf0b0016c67d0f6a92a70f83`, fetch date 2026-07-11; table
  last touched upstream `02e79d35d73efd31522b5eab986d1919e3560bba`,
  2025-06-19), reproduces the full three-clause zlib licence text, states
  plainly that no GPL-licensed material is incorporated, states that ACME is
  invoked as a test-only subprocess (never shipped), and records
  `fluffy-6502` as an unavailable, not-cited source per 04-01's own finding.
  The repo-root `THIRD-PARTY-NOTICES.md` is a 6-line pointer with no licence
  text and a relative link to the canonical file.
- **Packaging gate (`scripts/check-npm-packages.mjs`):** extended with four
  assertion groups, all reading `vice.files` (the packed tarball's own list)
  except the one legitimate repo-root pointer check:
  1. `THIRD-PARTY-NOTICES.md` must be in the tarball (criterion 5).
  2. The five Phase 4 module entries (`stock-derived.ts`,
     `stock-disassemble.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`,
     `disasm-renderer.ts`) are re-asserted by name — a regression guard, not
     the first listing (04-02/04-05 added them under Phase 3's Rule 2).
  3. **The transitive-closure check** — walks every relative import reachable
     from `vice-proxy.ts` and fails naming the importer if any target is not
     in the packed tarball. Verified clean at **32 modules**.
  4. **DISASM-07's dependency gate** — asserts `dependencies` is exactly
     `@mastra/mcp` + `@mastra/core` by key set and count.
  `package.json`'s `files[]` grew by exactly one entry (39, up from 38 — the
  five Phase 4 module entries were already present, confirmed by direct
  inspection before editing anything, so there is no earlier-wave packaging
  defect to record here).
- **Non-vacuity proven for every new gate, then restored byte-identically:**
  - Removing `stock-derived.ts` from `files[]` → script exits 1, names
    `stock-derived.ts is imported by stock-dispatch.ts but is not in the
    published tarball`.
  - Removing `THIRD-PARTY-NOTICES.md` from `files[]` → script exits 1, names
    "criterion 5 requires the opcode table's zlib provenance to ship".
  - Adding a dummy `left-pad` dependency → script exits 1, names DISASM-07
    and lists the actual vs. expected dependency sets.
  - `diff` against a pre-edit backup of `package.json` confirmed byte-identical
    restoration after all three trials.
- **`docs/stock-vice-parity.md`:** item 7 gains four bullets — Phase 4 D-09
  (the exact 35-opcode `!byte` substitution set copied verbatim from
  04-06-SUMMARY.md, plus the D-11 forced-16-bit note), Phase 4 D-13 (the
  `outputSchema`-declared answer shape with no fork equivalent, 100-instruction
  bound), Phase 4 D-12 (the `end`/`count` mutual-exclusion refusal and the
  over-read-by-two rule), and Phase 4 D-14 (`show_symbols`'s no-op behaviour
  with no symbol store). A cross-reference was added under item 6's existing
  `vice_disassemble` mention. Section numbering (A/B/C, items 1-7) is
  unchanged.
- **Confirmed, not guessed:** `scripts/package.sh` needed no edit (it
  validates only a handful of fixed plugin paths, not a per-module list) —
  ran it twice (before and after this plan's edits) and it exits 0 both
  times. No `.mts` file was added anywhere in this phase and no
  `resources/*.mjs` file changed — confirmed via `git diff --stat` against
  the phase-start commit, which shows exactly the five files this plan
  touched (two new `.md` files, `package.json`, `check-npm-packages.mjs`,
  `stock-vice-parity.md`).
- Full regression: `npm run typecheck` exits 0; `npm run test:automated`
  shows 1187/1193 passing, 5 `todo`, and the one failure being the
  pre-existing, already-logged worktree-path `repo-root.test.ts` case
  (confirmed unrelated — no reference to `disasm`/`disassemble`/`THIRD-PARTY`/
  `check-npm-packages` anywhere in that file); `npm run smoke` exits 0,
  advertising 61 tools; `bash scripts/package.sh` exits 0.

## Task Commits

1. **Task 1: Create THIRD-PARTY-NOTICES.md (canonical plus root pointer)** - `910566e` (docs)
2. **Task 2: Ship the new modules and gate publication on the notices file** - `1bf7595` (feat)
3. **Task 3: Record Phase 4's divergences in docs/stock-vice-parity.md** - `ec90a98` (docs)

Additional commit (deviation fix, not a plan task):
- `8d7685a` (fix) - corrected the GPL-disclaimer sentence's case and line-wrap so it matches the plan's own top-level `<verification>` grep

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` - canonical notices: cc65 zlib provenance, no-GPL disclaimer, ACME test-only-subprocess statement, VICE/fluffy-6502 not-a-source notes, existing runtime dependencies
- `THIRD-PARTY-NOTICES.md` - repo-root pointer (6 lines, no licence text)
- `.claude/mcp/vice/package.json` - `files[]` gains `THIRD-PARTY-NOTICES.md` (39 entries)
- `scripts/check-npm-packages.mjs` - notices-file assertion, five-module regression guard, transitive-closure walk, DISASM-07 dependency gate, repo-root pointer check
- `docs/stock-vice-parity.md` - four new item-7 bullets (Phase 4 D-09/D-13/D-12/D-14) plus a cross-reference under item 6

## Decisions Made

- **Notices placement (Option 2 with a root pointer)**, per the plan's own research correction: npm's `files[]` cannot reach outside `.claude/mcp/vice/`, demonstrated today by the repo's own root `LICENSE` being absent from the packed tarball. The canonical file lives inside the package directory; the root file is a pointer with no licence text to drift from.
- **"Phase 4" decision-ID prefix is load-bearing.** `docs/stock-vice-parity.md` already uses bare `D-13` and `D-14` for two unrelated Phase 3 decisions earlier in the same document (disk detach at D-13, disk-attach AUTOSTART approximation at D-14). Writing Phase 4's own D-13/D-14 without the phase prefix would have created an ambiguous in-document collision; every new bullet is written "Phase 4 D-0X" throughout.
- **Verified before editing, not assumed:** all five Phase 4 module `files[]` entries were confirmed present by direct inspection of `package.json` before this plan changed anything, so this plan's only `files[]` edit is the single `THIRD-PARTY-NOTICES.md` addition — no earlier-wave packaging defect exists to fix or record.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GPL-disclaimer sentence did not match the plan's own top-level verification grep**
- **Found during:** running the plan's own `<verification>` block (`grep -q 'no GPL-licensed material' .claude/mcp/vice/THIRD-PARTY-NOTICES.md`) after all three tasks were committed
- **Issue:** Task 1's notices file wrote the disclaimer as a capitalized, sentence-initial "**No GPL-licensed material** is incorporated...", and a soft line-wrap in the markdown source split the phrase across two lines ("no GPL-licensed" / "material appears..."). `grep` is case-sensitive and line-scoped, so neither the case nor the line boundary matched the plan's literal lowercase, single-line expected string.
- **Fix:** Reworded the sentence onto a single unwrapped line and added the exact lowercase phrase ("no GPL-licensed material appears anywhere...") alongside the sentence-initial capitalized form, without weakening the claim itself.
- **Files modified:** `.claude/mcp/vice/THIRD-PARTY-NOTICES.md`
- **Verification:** `grep -q 'no GPL-licensed material' .claude/mcp/vice/THIRD-PARTY-NOTICES.md` now exits 0; re-ran task 1's own full acceptance-criteria grep set (opc6502x.c, fluffy-6502, the three zlib clauses) — all still pass; re-ran `node scripts/check-npm-packages.mjs` — still exits 0.
- **Committed in:** `8d7685a` (fix)

---

**Total deviations:** 1 auto-fixed (Rule 1, a wording/formatting fix caught by the plan's own top-level verification block, not a task-level acceptance criterion — none of task 1's own three per-task acceptance greps required this exact case/line-boundary, so it slipped through per-task verification and was caught only when running the plan's aggregate `<verification>` section)
**Impact on plan:** Wording-only fix to this plan's own new file; no behavioural change, no scope creep.

## Plan Defect Watch

No tautological-check pattern (a check whose expected value is read from the same source that produced its input) was found in this plan. The two candidates considered:
- **The transitive-closure check** derives its expected-shipped set from `vice.files` (the packed tarball's own list, from `npm pack --dry-run --json`) and its actual-imports set from parsing `vice-proxy.ts`'s source independently — two genuinely different sources, not one feeding the other. Proven non-vacuous by deliberately removing `stock-derived.ts` from `files[]` and watching the check name the correct importer.
- **The DISASM-07 dependency gate** reads `package.json`'s `dependencies` directly (not derived from any test fixture) and compares against a literal, hand-written expected set. Proven non-vacuous by adding a dummy dependency and watching it fail.

## Issues Encountered

None blocking. `node_modules/` was not present at the start of this plan's execution (provisioned by the `SessionStart` hook, gated on a lockfile hash); ran `npm ci` once in `.claude/mcp/vice` so `npm run typecheck` and `npm run test:automated` could run. No `package.json`/`package-lock.json` dependency changes resulted from that install.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `@henols/vice-mcp`'s packaging gate is now a permanent regression guard: any future phase that imports a new local module from `vice-proxy.ts`'s transitive closure without adding it to `files[]` will fail `scripts/check-npm-packages.mjs` by name, not silently ship a broken tarball.
- `docs/stock-vice-parity.md`'s four new bullets give Phase 8's VERIF-03 parity harness the specific, enumerated disassembler divergence list it needs, rather than the generic §A.7 licence already granted.
- Phase 4 is now closed out: all 7 plans complete (opcode table, derived-tool seam, decoder, renderer, stock tool registration, real-ACME round-trip, packaging/parity docs).
- No blockers for Phase 5.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/THIRD-PARTY-NOTICES.md`
- FOUND: `THIRD-PARTY-NOTICES.md`
- FOUND: `.claude/mcp/vice/package.json` (modified, 39 `files[]` entries)
- FOUND: `scripts/check-npm-packages.mjs` (modified)
- FOUND: `docs/stock-vice-parity.md` (modified)
- FOUND commit `910566e` (Task 1)
- FOUND commit `1bf7595` (Task 2)
- FOUND commit `ec90a98` (Task 3)
- FOUND commit `8d7685a` (deviation fix)

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*
