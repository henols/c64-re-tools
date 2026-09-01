---
phase: 15-debt-and-review-disposition
plan: 03
subsystem: testing
tags: [markdown-escaping, regex, static-analysis, capability-registry, stock-dispatch]

requires:
  - phase: 15-01
    provides: "The widened docs-review-disposition.test.ts guard (150 findings discovered) that this plan's fixes are dispositioned against."
provides:
  - "cell() escaping at generate-tool-support-table.mjs's single markdown-row emission point, plus a cell-count invariant test that survives an escaped pipe (WR-04)"
  - "Three independently-bounded ToolDefinition declaration scans (generator, tool-support-table.test.mjs, capability-registry.test.ts), each throwing by identifier name on a planted no-name: declaration instead of borrowing a later declaration's name (WR-08)"
  - "WR-05's already-landed fix (commit 21a42cb) cited with its current line range and the TS7016/allowJs:false reason the review's own suggested import route was not taken"
  - "dispatchStock()'s miss branch routed through capabilityRefusalMessage(), with an internal-inconsistency fallback for names absent from the registry entirely, and two invariant tests pinning no shipped module outside capability-registry.ts carries a competing refusal wording (WR-13)"
affects: [15-12]

actuals:
  tokens: 5917
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Escape-at-the-single-emission-point: markdown cell prose is escaped once, at the row.push() call, never at each field's origin"
    - "Cell-count split respecting an escape backslash: line.split(/(?<!\\\\)\\|/) rather than a naive line.split(\"|\"), so an escaped `\\|` inside prose is not miscounted as a column boundary"
    - "Three-independent-witnesses bounding: the same declaration-scan bug class is guarded by three DIFFERENT bounding techniques (character-offset search+next-keyword, brace-depth counting, line-oriented scanning) rather than one shared helper, so a bug in one technique cannot pass silently in the others"
    - "Registry-derived refusal fallback: a dispatch miss branch calls the registry's renderer first, falling back to an internal-inconsistency message ONLY when the registry itself has no entry -- never a locally hardcoded backend claim"
    - "Shipped-module invariant via package.json files[]: the same shippedTsModules() idiom spawn-seam.test.ts established, reused here to scan for a competing capability-refusal wording"

key-files:
  created: []
  modified:
    - scripts/generate-tool-support-table.mjs
    - docs/tool-support.md
    - .claude/mcp/vice/tool-support-table.test.mjs
    - .claude/mcp/vice/capability-registry.test.ts
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-dispatch.test.ts

key-decisions:
  - "WR-05 required no code change: capability-registry.test.ts's synthetic-tool set was already derived mechanically from vice-proxy.ts (commit 21a42cb, 'refactor(08): derive SYNTHETIC from vice-proxy.ts instead of hardcoding it'), landed before this plan ran. Cited the commit and current line range (capability-registry.test.ts:158-198) rather than re-implementing the review's own suggested fix, and recorded explicitly that the review's suggested import route (importing discoverSyntheticToolNames from the .mjs generator) was NOT the route taken, because tsconfig.json's allowJs:false makes a .ts test importing a repo-root .mjs fail tsc --noEmit with TS7016 -- the review's own parenthetical anticipated this."
  - "The cell-count invariant test (WR-04) could not use the review's own suggested naive `line.split(\"|\").length - 2` verbatim: an escaped pipe (`\\|`) still contains a literal `|` character, so a naive split miscounts it as a fifth cell even when cell() is correctly escaping. Implemented instead as `line.split(/(?<!\\\\)\\|/)` -- splitting only on a pipe NOT preceded by the escape backslash -- verified by the planted-pipe probe: this version stays GREEN with cell() active and turns RED when cell() is disabled, which is the actual acceptance-criteria intent (a test that is vacuously green regardless of the fix would not satisfy 'prove it non-vacuous')."
  - "The three WR-08 bounding expressions were written with three genuinely different algorithms, not merely renamed variables of the same technique: the generator uses a character-offset search stopping at the next top-level const/function/export keyword; tool-support-table.test.mjs uses brace-depth counting from the opening brace; capability-registry.test.ts uses line-oriented scanning (split on \\n, stop at the first line matching /^(?:const|function|export)\\s/). All three independently throw by identifier name on the same planted no-name: declaration."
  - "dispatchStock()'s internal-inconsistency fallback path (WR-13) is not purely theoretical: vice_snapshot_list -- one of the eight DELIBERATELY_ABSENT_TOOL_NAMES this plan's test file already exercised -- has no capability-registry.ts entry at all (absent from BOTH manifests, not a one-backend divergence), so it is the one name in that list that now hits the fallback rather than a rendered capabilityRefusalMessage(). Added a dedicated test for this path rather than leaving it implicitly covered by the loop test."

patterns-established:
  - "A dispatch miss branch's refusal text is never a second copy of registry prose -- it calls the registry's own renderer and falls back to a distinct internal-inconsistency wording only when the registry has no opinion at all, never a hardcoded backend name."

requirements-completed: []

coverage:
  - id: D1
    description: "generate-tool-support-table.mjs's markdown row emission escapes registry prose (tool name, note) via a single cell() helper; docs/tool-support.md regenerated byte-identical; a cell-count invariant test (respecting the escape backslash) added to tool-support-table.test.mjs (WR-04)"
    requirement: null
    verification:
      - kind: unit
        ref: ".claude/mcp/vice/tool-support-table.test.mjs#every table row has exactly 4 cells -- no registry prose can split a row (WR-04)"
        status: pass
      - kind: other
        ref: "git diff --quiet docs/tool-support.md after a fresh generator run"
        status: pass
      - kind: other
        ref: "Planted-pipe probe: green with cell() active, red with cell() disabled (both reverted byte-clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "All three independent ToolDefinition declaration scans (generator's discoverSyntheticToolNames, tool-support-table.test.mjs's independentlyDiscoverSyntheticNames, capability-registry.test.ts's inline scan) bound their search to the declaration's own body via three different techniques, throwing by identifier name on a declaration with no name: field instead of borrowing a later declaration's name (WR-08)"
    requirement: null
    verification:
      - kind: unit
        ref: "node --test tool-support-table.test.mjs capability-registry.test.ts (20 and 20/141 combined pass)"
        status: pass
      - kind: other
        ref: "Planted a BOGUS_TOOL: ToolDefinition = { description: ... } (no name field) in vice-proxy.ts ahead of the real declarations; all three scans threw naming BOGUS_TOOL rather than resolving to vice_result_continue; reverted byte-clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-05 cited as already fixed at capability-registry.test.ts:158-198, commit 21a42cb, with the TS7016/allowJs:false reason the review's suggested import route was not taken"
    requirement: null
    verification:
      - kind: other
        ref: "git cat-file -e 21a42cbb8635cac414f70179f934ae95e0c68b83"
        status: pass
    human_judgment: false
  - id: D4
    description: "dispatchStock()'s miss branch routes through capabilityRefusalMessage(name, \"stock\"), falling back to an internal-inconsistency message only when the registry has no entry; the local fork-provides/wait-for-a-later-phase wording is deleted with no commented-out remnant; two invariant tests pin no other shipped module carries either forbidden shape (WR-13)"
    requirement: null
    verification:
      - kind: unit
        ref: "stock-dispatch.test.ts#invariant (WR-13): no shipped module outside capability-registry.ts hardcodes a fork-provides refusal claim"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#invariant (WR-13): no shipped module outside capability-registry.ts pairs future-phase framing with a VICE_BACKEND selection instruction"
        status: pass
      - kind: other
        ref: "Planted both forbidden shapes into stock-memory.ts; both invariant tests failed naming that file; reverted byte-clean"
        status: pass
      - kind: integration
        ref: "npm run test:automated (.claude/mcp/vice): 2101 pass, 0 fail, 5 pre-existing todo"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 3: Close Phase 08's Remaining Findings Outside the Two Skill-Lint Scripts Summary

**Escaped markdown-cell emission with a non-vacuous cell-count invariant (WR-04), bounded all three independent `ToolDefinition` declaration scans with three deliberately different techniques (WR-08), cited WR-05's already-landed fix with its commit sha, and routed `dispatchStock()`'s miss branch through `capabilityRefusalMessage()` with two shipped-module-wide invariant tests against a competing refusal wording (WR-13).**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-22T14:24:38Z (approx., immediately following 15-02)
- **Completed:** 2026-08-22T14:43:30Z
- **Tasks:** 3 completed
- **Files modified:** 6 (0 created, 6 modified; `docs/tool-support.md` regenerated byte-identical, not committed as a diff)

## Accomplishments

- **WR-04** (`scripts/generate-tool-support-table.mjs:74`): added a `cell()` helper (collapses CR/LF to a space, backslash-escapes pipes), applied at the ONE row-emission point (`:270`) to `row.name` and `row.note`. `docs/tool-support.md` regenerated byte-identical today (no current `capability-registry.ts` entry contains a pipe or newline). Added a cell-count invariant test to `.claude/mcp/vice/tool-support-table.test.mjs` that splits on a pipe NOT preceded by the escape backslash (`line.split(/(?<!\\)\|/)`) — a naive `split("|")` still counts an escaped `\|` as a boundary, which would have made the review's own suggested test vacuous against a correctly-escaped cell.
- **WR-08** (three sites): `generate-tool-support-table.mjs:104-160`'s `discoverSyntheticToolNames()`, `.claude/mcp/vice/tool-support-table.test.mjs:56-113`'s `independentlyDiscoverSyntheticNames()`, and `.claude/mcp/vice/capability-registry.test.ts:158-197`'s inline scan each now bound the search to the declaration's own body before extracting `name:` — via three genuinely different algorithms (character-offset search stopping at the next top-level `const`/`function`/`export`; brace-depth counting; line-oriented scanning), each carrying a comment explaining why the three must stay independent and not be deduplicated.
- **WR-05** (`.claude/mcp/vice/capability-registry.test.ts:158-198`): already fixed. `git log -S` on the distinctive fragment `"expected at least 3 proxy-local synthetic tools"` identifies commit **`21a42cbb8635cac414f70179f934ae95e0c68b83`** ("refactor(08): derive SYNTHETIC from vice-proxy.ts instead of hardcoding it (WR-05)"), landed 2026-08-18, before this plan ran. The review's own suggested fix (`import { discoverSyntheticToolNames } from "../../../scripts/generate-tool-support-table.mjs"`) was NOT the route taken — `tsconfig.json`'s `allowJs: false` (confirmed at `.claude/mcp/vice/tsconfig.json:11`) makes a `.ts` test importing a repo-root `.mjs` fail `tsc --noEmit` with TS7016, the same constraint `tool-support-table.test.mjs`'s own header documents. The commit instead reimplemented the two-hop discovery independently in TypeScript.
- **WR-13** (`.claude/mcp/vice/stock-dispatch.ts:735-751`): `dispatchStock()`'s miss branch now calls `capabilityRefusalMessage(name, "stock")` instead of a locally-composed wording that hardcoded "the fork backend provides this tool" (false for a stock-only-gain name) and used the "wait for a later phase" framing `capability-registry.ts:335-346` explicitly forbids for a hardware loss. Falls back to a distinct internal-inconsistency message ONLY when the registry has no entry at all for the name — this path is not merely theoretical: `vice_snapshot_list` (absent from both manifests, not a one-backend divergence) is exactly such a name, confirmed live and given its own dedicated test. Two new invariant tests in `stock-dispatch.test.ts` scan every shipped `.ts`/`.mts` module (discovered from `package.json`'s `files[]`, the same `shippedTsModules()` idiom `spawn-seam.test.ts` established) for either forbidden shape, outside `capability-registry.ts` itself.
- Re-measured the "unreachable today" claim rather than inheriting it: all **38** tools on `tools-manifest.stock.json` have a `stockHandlerFor()` entry — `dispatchStock()`'s miss branch is still latent, not live.
- `npm run typecheck` and `npm run test:automated` (`.claude/mcp/vice`) both exit 0 after every task: 2101 pass, 0 fail, 5 pre-existing todo (up from 15-02's 2097/0/5 — 4 new tests added this plan, all passing net of the temporary planted-violation probes described below).

## Planted-Violation Evidence (before/after, all reverted)

**WR-04 non-vacuity** — planted a `|` into `capability-registry.ts`'s `vice_sid_get_state.reason`:
- With `cell()` active: `tool-support-table.test.mjs` test 6 ("every table row has exactly 4 cells") stayed `ok`, generated row read `... SID's $D400-$D418 \| registers ...` (escaped, 4 cells via the escape-aware split).
- With `cell()` temporarily replaced by an identity function: the same test failed — `error: row has the wrong cell count ... 5 !== 4`.
- Both `capability-registry.ts` and `scripts/generate-tool-support-table.mjs` diffed byte-identical against pre-mutation backups after revert.

**WR-08 non-vacuity** — planted `const BOGUS_TOOL: ToolDefinition = { description: "probe only, no name field" };` plus its own `tools[BOGUS_TOOL.name] = ...` registration, inserted ahead of the real `RESULT_CONTINUE_TOOL` declaration in `vice-proxy.ts`:
- Generator: `THROWN: generate-tool-support-table: "BOGUS_TOOL"'s own declaration body (bounded up to the next top-level const/function/export) has no \`name: "..."\` field -- refusing to borrow a later declaration's name.`
- `tool-support-table.test.mjs`'s independent brace-depth scan: `independentlyDiscoverSyntheticNames: "BOGUS_TOOL"'s own declaration body has no name: field -- refusing to borrow a later declaration's name` (surfaced as a test failure in the "derived-union equality" test).
- `capability-registry.test.ts`'s independent line-oriented scan: `"BOGUS_TOOL"'s own declaration body (bounded to its own lines, stopping before the next top-level const/function/export) has no name: field -- refusing to borrow a later declaration's name.` (surfaced as a test failure in "mechanical completeness").
- All three threw naming `BOGUS_TOOL` — none resolved to `vice_result_continue` (the real declaration immediately following). `vice-proxy.ts` diffed byte-identical against a pre-mutation backup after revert.

**WR-13 non-vacuity** — appended `export const __WR13_PROBE__ = "the fork backend provides this tool. Set VICE_BACKEND=fork, or wait for a later phase to extend the stock dispatch table.";` to `stock-memory.ts` (a shipped module unrelated to this plan's own edits):
- `invariant (WR-13): ... hardcodes a fork-provides refusal claim` failed, naming `stock-memory.ts` and quoting the offending line.
- `invariant (WR-13): ... pairs future-phase framing with a VICE_BACKEND selection instruction` failed, naming `stock-memory.ts:~line 263` and quoting the offending line.
- `stock-memory.ts` diffed byte-identical against a pre-mutation backup after revert; both invariant tests returned to `ok`.

## Human-Check Confirmation

Per the plan's `<human-check>`: read `docs/tool-support.md`'s `vice_machine_config_set` row after the escaping change —

```
| vice_machine_config_set | ✅ | — | not yet built (descoped): Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist subset that never shipped on stock. |
```

No visible backslash; the escaping is invisible in the rendered document (this row's `reason`/`alternative` text contains no pipe or newline today, so `cell()` is a no-op on it). Flagging for the user per the plan's own instruction since plan 15-09 edits this same row's text next.

## Task Commits

Each task was committed atomically:

1. **Task 1: Escape registry prose at the single markdown emission point and assert the cell-count invariant (WR-04)** - `f868d51` (fix)
2. **Task 2: Bound all three ToolDefinition declaration scans, and cite WR-05 as already fixed (WR-08, WR-05)** - `98f0531` (fix)
3. **Task 3: Route dispatchStock()'s miss branch through the registry's single refusal renderer (WR-13)** - `e9fa737` (fix)

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `scripts/generate-tool-support-table.mjs` - added `cell()` escaping helper applied at the single row-emission point; bounded `discoverSyntheticToolNames()`'s declaration scan to the declaration's own body (character-offset technique)
- `docs/tool-support.md` - regenerated; byte-identical to the pre-plan committed version (no diff)
- `.claude/mcp/vice/tool-support-table.test.mjs` - added the cell-count invariant test (escape-aware split); bounded `independentlyDiscoverSyntheticNames()`'s declaration scan (brace-depth-counting technique)
- `.claude/mcp/vice/capability-registry.test.ts` - bounded the inline declaration scan (line-oriented-scanning technique); no change needed for WR-05 (already fixed)
- `.claude/mcp/vice/stock-dispatch.ts` - `dispatchStock()`'s miss branch now calls `capabilityRefusalMessage()`, with an internal-inconsistency fallback for a name absent from the registry entirely; imports `capabilityRefusalMessage` from `capability-registry.ts`
- `.claude/mcp/vice/stock-dispatch.test.ts` - updated miss-branch assertions to derive expectations from `capabilityRefusalMessage()` via a new `expectedStockMissMessage()` helper rather than a re-typed literal; added a dedicated fallback-path test (`vice_snapshot_list`); added two shipped-module-wide invariant tests (`shippedTsModules()`, `nonCommentLines()`)

## Decisions Made

See `key-decisions` in frontmatter: (1) WR-05 required no code change, cited with its landing commit and the TS7016 reason the review's suggested route was not taken; (2) the cell-count invariant test uses an escape-aware split rather than the review's literal naive-split suggestion, because the naive version is vacuous against a correctly-escaped pipe; (3) the three WR-08 bounding expressions use three genuinely different algorithms, not renamed copies of one technique; (4) WR-13's internal-inconsistency fallback path is exercised by a real, currently-absent-from-both-manifests tool name (`vice_snapshot_list`), not left as untested dead code.

## Deviations from Plan

None - plan executed exactly as written. The plan's own action text for Task 1 anticipated needing to verify the cell-count test's non-vacuity carefully ("Prove it non-vacuous rather than asserting it") — the naive-split issue surfaced during that very verification step and was resolved within the same task, before commit, rather than being a deviation from an already-committed implementation.

## Issues Encountered

None beyond the naive-split correction documented above, which was caught and fixed during Task 1's own verification loop before any commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All four of Phase 08's remaining findings outside the two CI-gating skill-lint scripts (`WR-04`, `WR-05`, `WR-08`, `WR-13`) are now closed with citable evidence: three via a landed fix in this plan (each proven non-vacuous by a reverted planted violation), one via a citation to a prior commit. Combined with plan 15-02's six findings, all ten of `08-REVIEW.md`'s Warning findings referenced by `.planning/todos/pending/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md` are now fixed at source. Per the plan's own `<output>` instruction, that pending todo is left in place (not moved or closed) — plan 15-12 closes it once every plan referencing it has landed. `docs/tool-support.md` stays byte-stable and structurally guarded; `dispatchStock()` has exactly one refusal-wording source, now enforced by two invariant tests across the shipped module set. No blockers.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All modified files confirmed present on disk (`scripts/generate-tool-support-table.mjs`, `docs/tool-support.md`, `.claude/mcp/vice/tool-support-table.test.mjs`, `.claude/mcp/vice/capability-registry.test.ts`, `.claude/mcp/vice/stock-dispatch.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`, this SUMMARY). All three task commits confirmed in `git log` (`f868d51`, `98f0531`, `e9fa737`). Plan-level `<verification>` re-run clean from the current working tree: `npm run typecheck` exits 0; `npm run test:automated` (`.claude/mcp/vice`) exits 0 (2101 pass, 0 fail, 5 pre-existing todo); `git diff --quiet docs/tool-support.md` after a fresh generator run confirms byte-stability; no shipped module outside `capability-registry.ts` carries a capability-refusal wording (both new invariant tests pass); no `capability-registry.ts` or `vice-proxy.ts` or `stock-memory.ts` file left in a mutated state (all planted-violation probes reverted and diff-confirmed clean against pre-mutation backups before this check).
