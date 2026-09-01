---
created: 2026-08-21T00:00:00.000Z
title: Phase 08's WR-04 through WR-12 (08-REVIEW.md) were never fixed, filed, or recorded anywhere
area: testing
files:
  - scripts/generate-tool-support-table.mjs
  - scripts/check-skill-tool-coverage.mjs
  - .claude/mcp/vice/capability-registry.test.ts
  - .claude/mcp/vice/tool-support-table.test.mjs
  - scripts/check-skill-fork-honesty.mjs
resolves_phase: 15
---

## Problem

Found while plan 11.1-07's Task 4 (`docs-review-disposition.test.ts`, the AUDIT-01
completeness guard) scanned every `*-REVIEW.md` in `.planning/phases/`, not just Phase
10/11's. `08-REVIEW.md` (`08-capability-honesty-and-the-install-story`, v0.2.0's Phase 8)
reported 2 Critical + 14 Warning findings. `08-VERIFICATION.md` only ever named CR-01,
CR-02, WR-01, WR-02, WR-03, WR-13 and WR-14. The v0.2.0 milestone audit's `tech_debt`
block for this phase (`.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`) names WR-01,
WR-03, WR-13 and WR-14 — the same subset, restated. **WR-04 through WR-12 (9 findings)
appear in no VERIFICATION.md, no todo, no milestone audit, no `*-REVIEW-FIX.md`** (this
phase has none) — exactly AUDIT-01's "no disposition anywhere" pattern, one milestone
earlier than the audit that named it.

Spot-checked directly against current source (not assumed): **all three checked are
still unfixed.**

- **WR-04** — `scripts/generate-tool-support-table.mjs` still interpolates
  `row.note`/`row.name` straight into a `| ... |` markdown row with no `|`/newline
  escaping (no `cell()`-shaped helper present at the emission point).
- **WR-08** — `generate-tool-support-table.mjs:118`'s `discoverSyntheticToolNames()`
  declaration regex is unchanged: `[\s\S]*?` is still unbounded past the declaration's
  own closing brace.
- **WR-12** — no `scripts/lib/skill-corpus.mjs` (or equivalent) exists; `ls scripts/lib/`
  shows only `anno-cli-verbs.*` and `skill-honesty-checks.*`.
  `check-skill-fork-honesty.mjs` and `check-skill-tool-coverage.mjs` still each carry
  their own copy of `walkSkills()`/`MCP_PREFIX_RE`/`TOOL_NAME_RE`.

WR-05, WR-06, WR-07, WR-09, WR-10, WR-11 were not individually re-verified against
current source in this pass (time-boxed); given the consistent pattern above and the
total absence of any disposition trail, treat them as still open too until re-checked.

## Why it was deferred

`08-capability-honesty-and-the-install-story` is a v0.2.0 phase (this milestone's
Phase 8, closed 2026-08-19) — entirely outside plan 11.1-07's stated scope (the
`anno-*`/analyser family) and outside this milestone's (`v0.3.0`) three phases.
Filing rather than fixing keeps this closure phase's diff to what it was scoped for.

## What to do

Re-verify WR-05 through WR-11 against current source the way WR-04/08/12 were checked
above, then apply each finding's own suggested fix from `08-REVIEW.md`
(`scripts/generate-tool-support-table.mjs:330-660`, roughly). Several are genuinely
small (WR-04's `cell()` escaping, WR-06's tautology removal); WR-12's shared-module
extraction (`scripts/lib/skill-corpus.mjs`) is the largest.

**Verify:** `node --test capability-registry.test.ts tool-support-table.test.mjs`,
`node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`
all stay green; add the non-vacuity/cell-count assertions each finding's own `Fix:`
section suggests.

## Resolution

Closed 2026-08-22 by Phase 15 plans 15-02 and 15-03, which between them fixed all ten of
`08-REVIEW.md`'s `WR-04` through `WR-13` (this todo's own title undercounts by one — `WR-13`
is 08-REVIEW.md's tenth open finding, named separately by the ROADMAP and landed by plan
15-03; the Resolution below covers all ten). Every commit cited resolves
(`git cat-file -e`, re-confirmed at closure time).

| Id | Verdict | Landed at (file:line) | Evidence |
|----|---------|------------------------|----------|
| WR-04 | Fixed | `scripts/generate-tool-support-table.mjs:74` (`cell()` helper), applied at the row-emission point `:270` | Commit `f868d51`. Non-vacuity: a cell-count invariant test in `tool-support-table.test.mjs`, split on a pipe not preceded by the escape backslash (`line.split(/(?<!\\)\|/)`) so an escaped `\|` is not miscounted as a column boundary. Planted-violation probe: a literal `\|` inserted into `capability-registry.ts`'s `vice_sid_get_state.reason` stayed green with `cell()` active (escaped, 4 cells) and failed (`5 !== 4`) with `cell()` replaced by an identity function; both reverted byte-clean. |
| WR-05 | Fixed already (cited, not re-implemented) | `.claude/mcp/vice/capability-registry.test.ts:158-198` | Commit `21a42cbb8635cac414f70179f934ae95e0c68b83` (`refactor(08): derive SYNTHETIC from vice-proxy.ts instead of hardcoding it`), landed 2026-08-18, before this phase ran — found via `git log -S` on the distinctive fragment `"expected at least 3 proxy-local synthetic tools"`. The review's own suggested import route (`import { discoverSyntheticToolNames } from "../../../scripts/generate-tool-support-table.mjs"`) was **not** the route taken: `tsconfig.json`'s `allowJs: false` (`:11`) makes a `.ts` test importing a repo-root `.mjs` fail `tsc --noEmit` with TS7016 — the commit instead reimplemented the two-hop discovery independently in TypeScript. Non-vacuity: the existing cardinality/name assertions at `:158-198` are exercised by the full suite; no new assertion was needed since the fix predates this phase. |
| WR-06 | Fixed | `scripts/check-skill-tool-coverage.mjs:298-304` | Commit `71bc692`. Non-vacuity: the two tautological `need()` calls that re-asserted the exact filter predicate they were checking (`category === "hardware" && providedBy === "fork"`) replaced with a cardinality assertion against an independently-computed registry count (verified at **6** against `capability-registry.ts` before being asserted). Planted-violation probe: retagging `vice_sid_get_state`'s `category` from `"hardware"` to `"software"` failed with `got 5 of 5, expected >= 6`; reverted byte-clean, script passes again. |
| WR-07 | Fixed, with a documented limitation | `scripts/check-skill-tool-coverage.mjs:349-366` | Commit `71bc692`. Allowlist narrowed to `FORK_ONLY_UNRECOVERABLE.filter(([n]) => extracted.has(n))`, exactly as `08-REVIEW.md`'s own fix snippet specifies; the third hand-maintained `EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS` list deleted. Non-vacuity attempted and its result recorded honestly: a planted bare mention of the previously-unreferenced `vice_keyboard_chord` did **not** fail the script, because `extracted` is recomputed from the on-disk corpus (including the just-added mention) in the same pass the filter runs — an architectural property of a single-execution script, not an implementation gap. This closes WR-07 for the current, committed corpus (none of the three keyboard names is referenced today, so none is allowlisted today) but does not add a mechanism that would catch a future stealth mention the moment it appears; see `15-02-SUMMARY.md`'s Deviations for the full reasoning. |
| WR-08 | Fixed | Three sites: `scripts/generate-tool-support-table.mjs:104-160`, `.claude/mcp/vice/tool-support-table.test.mjs:56-113`, `.claude/mcp/vice/capability-registry.test.ts:158-197` | Commit `98f0531`. Non-vacuity: each of the three independent `ToolDefinition` declaration scans now bounds its search to the declaration's own body via a genuinely different technique (character-offset search to the next top-level keyword; brace-depth counting; line-oriented scanning). Planted-violation probe: a `BOGUS_TOOL: ToolDefinition = { description: ... }` with no `name` field, inserted ahead of the real declarations in `vice-proxy.ts`, made all three scans throw naming `BOGUS_TOOL` rather than silently borrowing the next real declaration's name; reverted byte-clean. |
| WR-09 | Fixed | `scripts/check-skill-fork-honesty.mjs:158-198` | Commit `f2eea29`. Non-vacuity: the stale-forward-reference lint rewritten from same-line to `splitParagraphs()`-delimited paragraph scope, with a new `PHASE_CITATION_RE` stripping a recognized `"(Phase N, ID-NN)"` citation shape before testing the widened pattern (so `tool-selection.md`'s legitimate `"(Phase 7, D-02)"` citation stays a non-match). Planted-violation probe: a phase-9 deferral hard-wrapped across two physical lines in `observation-hazards.md` failed, naming the paragraph's start line; reverted byte-clean. |
| WR-10 | Fixed | `scripts/check-skill-fork-honesty.mjs:218-273` | Commit `f2eea29`. Non-vacuity: annotation compliance decided per distinct fork-only tool name via a bidirectional 200-character windowed match (`nearName`), replacing section-wide compliance; `ANNOTATION_RE` drops the two loose alternatives (`"fork backend"`, `"VICE_BACKEND"`). The literal whole-file `grep -c 'VICE_BACKEND'` acceptance criterion is satisfied for its actual intent (removed from the annotation predicate); an unrelated, pre-existing, legitimate `REQUIRED_README_SUBSTRINGS` check that also names that string was deliberately left untouched (deleting it to satisfy an unrelated grep would itself be the "weaken a check to force a pass" this phase's own prohibitions forbid — see `15-02-SUMMARY.md`'s Deviations). Planted-violation probe below (shared with WR-11). |
| WR-11 | Fixed | `scripts/check-skill-fork-honesty.mjs:266-269` | Commit `f2eea29`. Non-vacuity: per-name error line numbers now computed from that specific name's own first mention in the section, not the section's first fork-only mention of any name. Planted-violation probe (WR-10/WR-11 shared): a bare mention of `vice_keyboard_chord` inserted into `observation-hazards.md`'s already-`vice_sid_get_state`-annotated section failed, naming `vice_keyboard_chord` at its own exact line while `vice_sid_get_state` stayed compliant; reverted byte-clean. |
| WR-12 | Fixed | `scripts/lib/skill-corpus.mjs` (new), imported by both `scripts/check-skill-tool-coverage.mjs` and `scripts/check-skill-fork-honesty.mjs` | Commit `9118089`. `walkSkills()`, `MCP_PREFIX_RE`, `TOOL_NAME_RE`, `extractToolNames()`, `topLevelSkillDirs()` extracted verbatim (byte-equivalent behavior) from the coverage script's original implementation; neither script retains a local copy or the stale "Copied from..." provenance comment. Non-vacuity: no dedicated planted-violation probe was run for this extraction (it is a refactor, not a new predicate) — each script's own pre-existing non-vacuity block (directory/file-read counts) is exercised unchanged, and both scripts still report a non-zero directory/file count after the extraction (`37 distinct vice_* names ... 6 skill directories`; `11 fork-only mentions ... 6 skill directories`). |
| WR-13 | Fixed | `.claude/mcp/vice/stock-dispatch.ts:735-751` | Commit `e9fa737`. `dispatchStock()`'s miss branch now calls `capabilityRefusalMessage(name, "stock")` instead of a locally-composed wording that hardcoded "the fork backend provides this tool" (false for a stock-only-gain name) and used the "wait for a later phase" framing `capability-registry.ts` explicitly forbids for a hardware loss; falls back to a distinct internal-inconsistency message only when the registry has no entry at all. Non-vacuity: two new invariant tests scan every shipped `.ts`/`.mts` module (via `shippedTsModules()`, derived from `package.json`'s `files[]`) for either forbidden shape, outside `capability-registry.ts` itself. Planted-violation probe: both forbidden shapes appended to `stock-memory.ts` (a shipped module unrelated to this fix) made both invariant tests fail, naming that file and quoting the offending line; reverted byte-clean. The fallback path is exercised by a real name (`vice_snapshot_list`, absent from both manifests, not merely a one-backend divergence), not left as untested dead code. |

**Non-vacuity assertions the todo's own "What to do" asked for confirming they exist:** all ten
rows above name a non-vacuity mechanism (a planted-violation probe reverted byte-clean, or —
for WR-05 and WR-12 — an explicit statement of why no new probe was needed: WR-05 predates this
phase and needed no new assertion, WR-12 is a refactor exercised by each script's existing
directory/file-count non-vacuity block). None of the ten is asserted "fixed" on a bare green run
alone.

No finding was recorded `superseded` — all ten were confirmed either genuinely still open (and
fixed) or already fixed at a cited prior commit (WR-05). `docs/tool-support.md` and
`tools-manifest.json` are confirmed byte-stable after these fixes (verified by plans 15-02/15-03
and re-confirmed at this closure).
