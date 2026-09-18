---
phase: 59-the-tool-location-seam-and-its-precedence-order
verified: 2026-09-18T00:00:00Z
status: passed
score: 12/12 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-SUMMARY.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-02-PLAN.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-02-SUMMARY.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-03-PLAN.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-03-SUMMARY.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-04-PLAN.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-04-SUMMARY.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-05-PLAN.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-05-SUMMARY.md", ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-REVIEW.md", "docs/phase59-tool-location-placement.md", "src/mcp/vice/build.ts", "src/mcp/vice/phase58-citation-ledger.test.ts", "src/mcp/vice/prerequisites.json", "src/mcp/vice/prerequisites.test.ts", "src/mcp/vice/resources/tool-location.mjs", "src/mcp/vice/tool-location.mts", "src/mcp/vice/tool-location.test.ts", "src/mcp/vice/tsconfig.build.json"]
covered_digest: "v1:sha256:592e99524f9333d74408152c3548e0666e8c9f0e2af6f3d799c1d2aade291af9"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "12/12 (at commit 8fd9fa32)"
  gaps_closed:
    - "WR-02 (code review): resolveTool()'s id lookup and the tools.json value lookup now use exact array membership, not bracket access — an Object.prototype-shaped id (constructor, toString, valueOf, hasOwnProperty) is refused as unknown, never resolved through a planted tools.json entry."
    - "WR-01 (code review): a malformed tools.json (unparseable JSON, non-object top level, or a non-string/empty value for the requested id) is now refused by name at the file layer, terminal for that id, instead of silently falling through to $PATH."
  gaps_remaining: []
  regressions: []
---

# Phase 59: The Tool-Location Seam and Its Precedence Order — Verification Report

**Phase Goal:** One module answers *where is this tool*, in one order — environment
variable, then `.c64-re-tools/tools.json`, then `$PATH` or sibling probe — and
says which of the three answered. A bad entry in the file is refused by name
rather than falling through silently, and the two deliberate exclusions are
refused and documented rather than quietly ignored.

**Verified:** 2026-09-18
**Status:** passed
**Re-verification:** Yes — re-verified at the current tip after four further
commits landed on top of the previously-verified `8fd9fa32` (whole-phase diff
range `613571e5..HEAD`, 24 commits total)

## What Changed Since the Prior Verification

The prior verification (score 12/12, `covered_digest` for tree state at
`8fd9fa32`) is superseded by this report because four commits landed after
it, closing two CONFIRMED findings from the phase's own code review
(`59-REVIEW.md`):

| Commit | Role | Finding closed |
|--------|------|-----------------|
| `f8283ea1` | RED | Plants a failing regression test for WR-02 (Object.prototype id bypass) |
| `cf3be534` | GREEN | Guards `resolveTool()`'s id lookups with array membership, not bracket access |
| `ab137c2b` | RED | Plants a failing regression test for WR-01 (malformed-tools.json fall-through) |
| `884e68c8` | GREEN | Refuses a malformed `tools.json` entry instead of falling through to `$PATH` |

Files touched by these four commits: `src/mcp/vice/tool-location.mts`,
`src/mcp/vice/tool-location.test.ts`, `src/mcp/vice/resources/tool-location.mjs`.

This report re-runs everything the prior verification established (source
read in full again, all commands re-executed directly, not taken on faith
from the addendum previously appended to the superseded report) and adds
direct evidence for the two closed findings and for the regression surface
named in the task brief.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, verbatim)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | One module owns the order — resolves any declared tool, returns path/source/what-it-tried, compiled into `resources/` by existing `build.ts` pipeline | ✓ VERIFIED | `src/mcp/vice/tool-location.mts` exports `resolveTool`, `resolveOnPath`, `validateToolsFile`, `toolsFileTemplate` (confirmed by direct `grep -n "^export "`). `node build.ts` run directly by this verification reproduces `resources/tool-location.mjs` byte-identically (`git status --short src/mcp/vice/resources/` empty after rebuild). `node --test resources-sync.test.ts` passes. |
| 2 | A bad entry is refused by name, and the refusal says where the path came from (LOC-06) | ✓ VERIFIED | `resolveTool()`'s file layer (`tool-location.mts:558-651`) and `validateToolsFile()` (lines 334-423) both refuse an absent/wrong-kind/markerless-directory/non-executable/malformed entry naming the tool id and the sentence "tools.json supplied this path" or the file path itself. Directly re-ran the full `tool-location.test.ts` suite (60/60 pass) plus 8 targeted regression tests filtered by name (all pass, see Behavioral Spot-Checks). |
| 3 | dxa is refused, not ignored (LOC-05) | ✓ VERIFIED | `resolveTool("dxa", …)` short-circuits before any layer (`tool-location.mts:477-486`), `tried: []`, quoting `prerequisites.json`'s `dxa.location.reason` verbatim. Re-ran `resolveTool("dxa", …) refuses through every layer…` directly — passes, asserting `tried` deep-equals `[]` even when tools.json/env/PATH all name real files. |
| 4 | `VICE_BROKER_NODE` stays environment-only, documented in the template and the seam's own documentation (LOC-07) | ✓ VERIFIED | Same short-circuit path for `node`; `toolsFileTemplate()` emits `_viceBrokerNode` quoting the reason and naming the env var (`tool-location.mts:713`). Re-ran `resolveTool("node", …) refuses through every layer…` directly — passes, `tried: []`. No `tools.json.example` committed (`git ls-files` confirms, unchanged from prior verification). |
| 5 | The open placement question is answered in writing — which shape the seam took and what it costs Phase 60 | ✓ VERIFIED | `docs/phase59-tool-location-placement.md` unchanged since prior verification (not touched by the four new commits — confirmed by `git diff --stat` scoped to the fix commits). Re-ran its citation-ledger case directly: `node --test --test-name-pattern="phase59" phase58-citation-ledger.test.ts` → 1/1 pass. |

### Cross-Cutting Constraints

| # | Constraint | Status | Evidence |
|---|------------|--------|----------|
| C1 | Never called from inside `broker-launch.mts`'s `inFlight` guard | ✓ VERIFIED | `grep -n "tool-location" src/mcp/vice/broker-launch.mts` returns nothing (re-run at current tip). `git diff --stat 613571e5..HEAD -- src/mcp/vice/broker-launch.mts` is empty. |
| C2 | Path handling lives in the seam; a resolved path is never interpolated into a shell string | ✓ VERIFIED | `tool-location.mts` (660→726 lines after the fixes, read in full) imports only `node:fs`, `node:path`, `node:url`. No `node:child_process` import, no `exec`/`spawn`/`execSync` anywhere in the module. |
| C3 | No static import of `repo-root.ts` | ✓ VERIFIED | `grep -n "repo-root" src/mcp/vice/tool-location.mts` finds only the module-header comment naming the prohibition (line 55) — no import statement. `ResolveToolDeps`/`ValidateToolsFileDeps` still require `toolsDir`/`projectRoot` as caller-supplied strings. |

**Score:** 5/5 ROADMAP success criteria verified, 3/3 cross-cutting constraints verified — 8/8 primary must-haves. Extending to the plan-level must_haves layer below for full artifact/link/requirement coverage.

### Regression Surface Named in the Verification Brief (all re-run directly against the current tip)

| Behavior to re-check | Test | Result |
|-----------------------|------|--------|
| Absent `tools.json` still falls through silently | `resolveTool: an absent tools.json, a zero-byte one, and a bare {} one each keep falling through silently with no refusal` | ✓ PASS — `refusal: null`, resolves via `$PATH` |
| Zero-byte `tools.json` still falls through silently | same test | ✓ PASS |
| Bare `{}` still falls through silently | same test | ✓ PASS |
| One bad entry refuses only its own tool; sibling well-formed entry still resolves | `one non-string acme entry refuses acme by name; a well-formed x64sc entry in the same file still resolves (one-bad-entry blast radius)` | ✓ PASS |
| File-layer refusal is terminal (never falls through to `$PATH` afterwards) | `resolveTool("x64sc", …) refuses a whole-file JSON parse failure by name, naming the file, and never falls through to $PATH for it` — asserts `tried` excludes any `$PATH` candidate | ✓ PASS |
| `dxa` exclusion still short-circuits with `tried: []` and its own reason | `resolveTool("dxa", …) refuses through every layer with the declared reason…` | ✓ PASS |
| `node` exclusion still short-circuits with `tried: []` and its own reason | `resolveTool("node", …) refuses through every layer with the declared reason…` | ✓ PASS |
| WR-02 fix: Object.prototype-shaped id refused, not resolved, even when tools.json genuinely names that key | `an id shaped like an inherited Object.prototype member is refused by name like any other undeclared id…` | ✓ PASS |
| Compiled `resources/tool-location.mjs` still byte-identical to a fresh build | `node build.ts` + `git status --short resources/` (run directly, this verification) | ✓ PASS — no diff |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/tool-location.mts` | The seam module | ✓ VERIFIED | Read in full at current tip (726 lines, grew from 660 with the two fixes). Exports exactly `resolveTool`, `resolveOnPath`, `validateToolsFile`, `toolsFileTemplate` plus types. Both id lookups (declaration and tools.json value) now use `Array.includes` against the relevant object's own keys (lines 457-458, 623), closing WR-02. The file layer now refuses a JSON parse failure (lines 596-605), a non-object top level (607-616), and a present-but-not-a-non-empty-string value (624-634), closing WR-01. |
| `src/mcp/vice/tool-location.test.ts` | Colocated test suite | ✓ VERIFIED | Read/grepped at current tip: 60 tests (up from 54), all pass. New tests directly exercise both fixes with planted-violation + clean-control pairs. |
| `src/mcp/vice/resources/tool-location.mjs` | Compiled artifact, committed | ✓ VERIFIED | Present, begins with the generated banner. `node build.ts` run directly by this verification reproduces it byte-identically — `git status --short` clean. |
| `src/mcp/vice/prerequisites.json` | All 8 records carry `location`/`kind`(/`marker`) | ✓ VERIFIED | Unchanged by the four fix commits (confirmed via `git diff --stat`); previously verified content stands. |
| `src/mcp/vice/prerequisites.test.ts` | Extended structural gate | ✓ VERIFIED | Unchanged by the fix commits; re-ran directly: 39/39 pass (task brief lists 37 as a slightly stale baseline; this verification's own re-run is the authoritative count). |
| `docs/phase59-tool-location-placement.md` | Criterion-5 placement record | ✓ VERIFIED | Unchanged by the fix commits; its citation-ledger case re-run directly, passes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `build.ts`'s `HOST_BOUND_ARTIFACTS` | `tsconfig.build.json`'s `include[]` | hand-synchronised lists | ✓ WIRED | Both still carry the entry; rebuild did not throw. |
| `resources/tool-location.mjs` | `prerequisites.json` | two-candidate first-existing-wins join | ✓ WIRED | The compiled-artifact test (`compiled artifact: the same three layers answer from resources/tool-location.mjs…`) re-run directly, passes; a second compiled-artifact test now also covers `toolsFileTemplate` (line 1189). |
| Declared `location.envVar` names | Real read sites (`backend-detect.mts:312`, `host-tool.mts:1292/2234/1348`) | manual cross-check | ✓ WIRED | `prerequisites.json` untouched by the fix commits; previously-verified match stands. |
| `tool-location.test.ts` | `test-gate.mjs`'s `automatedTestFiles()` | inclusive-by-default | ✓ WIRED | Still not listed in `MANUAL_ONLY_TESTS`; ran as part of the full-suite pass below. |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOC-05 | 59-02, 59-03, 59-04, 59-05 | dxa refused by name, un-overridable | ✓ SATISFIED | `REQUIREMENTS.md:39` marks `[x]` Complete; `REQUIREMENTS.md:120` table row Complete; re-verified directly against code and tests above. |
| LOC-06 | 59-01, 59-02, 59-03, 59-04 | A `tools.json` entry naming an absent/non-executable/wrong-kind path is refused by name, naming the file as source | ✓ SATISFIED | `REQUIREMENTS.md:40` Complete; the amended triad plus the now-closed malformed-file fall-through (WR-01) both re-verified directly. |
| LOC-07 | 59-02, 59-03, 59-04, 59-05 | `VICE_BROKER_NODE` stays environment-only, documented | ✓ SATISFIED | `REQUIREMENTS.md:41` Complete; re-verified directly. |

No orphaned requirements: `REQUIREMENTS.md`'s Phase 59 row still lists exactly LOC-05/06/07, matching the union of all five plans' `requirements:` frontmatter fields.

### Anti-Patterns Found

None. Re-scanned `tool-location.mts` (full 726 lines), `tool-location.test.ts` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, empty-return stubs, and hardcoded-empty-data patterns at the current tip — none found. The two fix commits added real refusal branches and real array-membership guards, not stubs.

### Outstanding, Deliberately-Not-Fixed Review Items (not phase gaps)

`59-REVIEW.md` recorded 6 warnings and 1 info item. Two (WR-01, WR-02) are
now closed by the four commits this re-verification covers. The remaining
five are latent observations on a module with no live caller yet
(`tool-location.mts`'s own header: "Nothing calls this module today") and
were deliberately left open — recorded here as outstanding for Phase 60's
attention, not as Phase 59 gaps, because none of them contradicts a ROADMAP
success criterion or cross-cutting constraint for Phase 59:

- **WR-03** — `toolsFileTemplate()`'s two reserved-key exclusions are hardcoded by literal id name (`node`, `dxa`) rather than derived generically from every `fileOverridable: false` record; a future third exclusion would silently vanish from the template with no test catching it.
- **WR-04** — `~/` expansion silently degrades to a relative-path guess against `projectRoot` when `HOME` is unset, with no signal that the tilde failed to expand.
- **WR-05** — the `$PATH` probe layer performs a raw `existsSync` check with no kind or executable-bit validation, unlike the env and file layers.
- **WR-06** — the "many concurrent resolveTool calls" tests exercise no genuine concurrency (fully synchronous interleaving); the `isParseRefusal` branch they allow for is dead code in the test and, per WR-01's prior behavior, would not have matched the implementation anyway (moot now that WR-01 refuses with a string, not `null`, but the test's synchronicity gap itself is unaddressed).
- **IN-01** — `resolveOnPath()` has no direct unit test; only exercised indirectly through `resolveTool()`'s `$PATH` layer, so its separator-containing-name branch (`bin.includes("/")`) is never reached by any test.

None of these five were touched by the four commits landing after the prior
verification. They remain correctly out of Phase 59's must-have scope and
are flagged here for Phase 60, which the ROADMAP already schedules to
collapse the three duplicate `$PATH`-walk implementations (directly bearing
on WR-05 and IN-01).

### Behavioral Spot-Checks / Direct Re-Execution

All of the following were re-run directly by this verification, at the
current tip (commit `884e68c8`), not taken from any SUMMARY, REVIEW, or the
superseded prior report's addendum:

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Typecheck | `npm run typecheck` | exit 0, no output | ✓ PASS |
| Seam's own suite | `node --test tool-location.test.ts` | 60/60 pass | ✓ PASS |
| Targeted regression filter | `node --test --test-name-pattern=… tool-location.test.ts` (8 named cases covering the two fixes plus the fall-through/terminal/exclusion invariants) | 8/8 pass | ✓ PASS |
| Prerequisites + resources-sync gate | `node --test prerequisites.test.ts resources-sync.test.ts` | 39/39 pass | ✓ PASS |
| Build reproducibility | `node build.ts` then `git status --short src/mcp/vice/resources/` | no diff | ✓ PASS |
| Export surface | `grep -n "^export " tool-location.mts` | 4 functions/interfaces, no extra | ✓ PASS |
| `repo-root` static import | `grep -n "repo-root" tool-location.mts` | comment only, no import | ✓ PASS |
| `broker-launch.mts` call | `grep -n "tool-location" broker-launch.mts` | none | ✓ PASS |
| Diff scope check | `git diff --stat 613571e5..HEAD -- broker-launch.mts backend-detect.mts host-tool.mts` | empty | ✓ PASS |
| Full suite (run once) | `npm test` | 3866 pass / 1 fail / 81 skipped | ✓ MATCHES documented baseline exactly |
| Citation ledger (phase 59 doc) | `node --test --test-name-pattern="phase59" phase58-citation-ledger.test.ts` | 1/1 pass | ✓ PASS |

### Pre-Existing, Out-of-Scope Failure (Not Fixed by This Phase)

`phase58-citation-ledger.test.ts`'s `"the committed provenance document's
citation ledger is complete and every anchor resolves"` (the **Phase 58**
document's own case) fails: a citation in `docs/phase58-declaration-provenance.md`
points at `.planning/ROADMAP.md:1980-1983` for the anchor text `"a user
missing ACME learns that"`, but that range now reads `"`DOCTOR-05`,
`DOCTOR-06`, `DOCTOR-07`, `DOCTOR-08`, `DOCTOR-09`."` and onward (line drift
from unrelated ROADMAP.md growth in Phase 59/60 planning). Independently
confirmed pre-existing at commit `613571e5`, before any Phase 59 work; logged
in `deferred-items.md` and `WINDOWS.md` entry 68. This is the sole failure in
this verification's own full-suite run (3866 pass / 1 fail / 81 skipped,
matching the task brief's documented baseline exactly). None of the three
files it touches (`ROADMAP.md`, that test's case, `docs/phase58-declaration-provenance.md`)
is in any Phase 59 plan's `files_modified`. Not a Phase 59 gap.

`broker-e2e.test.ts`'s "wired disconnect-while-queued" intermittent load
flake, documented in the task brief, did not reproduce in this verification's
own full-suite run — Phase 59 touches no broker code (confirmed by the empty
diff on `broker-launch.mts`/`backend-detect.mts`/`host-tool.mts` above).

### Deferred Items

None applicable to Phase 59's own must-haves. WR-03 through WR-06 and IN-01
(listed above under "Outstanding, Deliberately-Not-Fixed Review Items") are
latent-code observations on a not-yet-wired module, correctly left to Phase
60's attention rather than counted as a Phase 59 gap or a formal deferred
item against a specific later ROADMAP success criterion.

### Human Verification Required

None. Every must-have in this phase is a code-level, mechanically-verifiable
property (resolution order, refusal wording, compiled-artifact behavior,
documentation presence) and every one was re-run directly against the
codebase at the current tip, including the two fixes landed after the prior
verification.

### Gaps Summary

No gaps found. All five ROADMAP success criteria and all three cross-cutting
constraints remain independently verified at the current tip — re-read in
full, re-run directly, not inferred from the superseded prior report or its
addendum. The two code-review findings closed by the four new commits
(WR-01, WR-02) were each reproduced failing (RED commit) and confirmed
passing (GREEN commit) by their own commit history, and this verification
independently re-ran the closing tests plus the full regression surface
named in the verification brief (absent/zero-byte/`{}` fall-through, one-bad-
entry blast radius, terminal refusal, both exclusions' `tried: []`, build
reproducibility) with no regression found. The single failing test in the
full suite is the same pre-existing, independently-confirmed, out-of-scope
citation-ledger drift recorded by the prior verification — unchanged, and
still not a Phase 59 gap.

---
_Verified: 2026-09-18_
_Verifier: Claude (gsd-verifier)_
