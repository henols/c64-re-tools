---
phase: 59-the-tool-location-seam-and-its-precedence-order
plan: 01
subsystem: infra
tags: [tool-location, path-resolution, build-pipeline, host-bound-module]

# Dependency graph
requires:
  - phase: 58-one-declaration-four-places-that-can-no-longer-disagree
    provides: "prerequisites.json, the single declaration of all eight tool ids, with schemaVersion 1"
provides:
  - "tool-location.mts: resolveTool(id, deps) and resolveOnPath(bin, env), the one module that walks env -> tools.json -> $PATH for a declared tool id"
  - "x64sc's location block (envVar VICE_BIN, fileOverridable true) and kind (executable) on prerequisites.json, proving the shape the other seven records take in plan 59-02"
  - "the compiled resources/tool-location.mjs artifact, proven to find prerequisites.json from its own deeper location"
  - "the D-12 tools.json bare-string value format, locked as a one-way human decision"
affects: [60-rewire-every-live-resolution-path-through-the-seam, 61-the-doctor, 59-02, 59-03, 59-04, 59-05]

# Actuals (#2632)
actuals:
  tokens: 10445
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-candidate first-existing-wins join for a compiled artifact's data-file lookup (mirrors findDxaBinary())"
    - "{ path, tried } widened with layer/mechanism, matching the four existing probes' own result shape"
    - "Path normalisation confined to the file layer only (D-08); env/probe layers stay existsSync-only"

key-files:
  created:
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/resources/tool-location.mjs
    - .planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md
  modified:
    - src/mcp/vice/prerequisites.json
    - src/mcp/vice/build.ts
    - src/mcp/vice/tsconfig.build.json

key-decisions:
  - "D-12 (human, one-way): tools.json entries are bare strings -- {\"x64sc\": \"/opt/vice/bin/x64sc\"}, never the object form. Locked at the Task 1 checkpoint; the user selected `bare-string`, the recommended option. The reserved-key rule (D-11) rides with it: a key beginning `_` is reserved for prose, is skipped before the unknown-key check runs, and is never reported as an unknown key."

requirements-completed: [LOC-06]

coverage:
  - id: D1
    description: "One host-bound module (tool-location.mts) resolves a declared tool id through environment, then tools.json, then $PATH, and reports which layer and mechanism answered"
    requirement: "LOC-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#environment layer wins over a competing tools.json entry"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#file layer answers when the environment variable is unset"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#$PATH probe answers when neither the environment nor tools.json do"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#nothing answers: path/layer/mechanism are null and tried lists the environment candidate first, PATH candidates last"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#an undeclared tool id is refused by name, and tools.json is never touched to answer it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The compiled artifact under resources/ finds prerequisites.json and answers correctly, not only the unbuilt source"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#compiled artifact: the same three layers answer from resources/tool-location.mjs, not only from the unbuilt source"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/resources-sync.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tools.json value's ~ expansion, relative-to-projectRoot resolution, non-ASCII byte-preservation and trailing-separator equivalence, all confined to the file layer"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a tools.json value beginning ~/ expands against the injected HOME and resolves absolute"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a bare ~ with no separator is joined against projectRoot rather than expanded"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a relative tools.json value resolves against projectRoot, not toolsDir and not process cwd"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a non-ASCII tools.json path segment round-trips byte-identically"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#a directory-kind candidate with a trailing separator resolves to the same path as one without"
        status: pass
    human_judgment: false
  - id: D4
    description: "The seam caches nothing: a binary appearing on disk between two calls is found by the very next call, and many concurrent calls each match a solo call"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#no cache: a binary appearing on the injected PATH between two calls is found by the second call"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#many concurrent resolveTool calls against one scratch tree each match the same call made alone"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-12 tools.json value shape (bare string) and its reserved-key rule locked as a human, one-way decision"
    verification: []
    human_judgment: true
    rationale: "A user-facing file-format decision made via checkpoint:decision -- no automated test proves a design choice was the right one, only that it was made and recorded."

duration: unknown (continuation dispatch; see Issues Encountered)
completed: 2026-09-18
status: complete
---

# Phase 59 Plan 01: The Tool-Location Seam, End to End on One Tool Summary

**`tool-location.mts` resolves x64sc through env var, then `.c64-re-tools/tools.json` (with tilde/project-root normalisation), then `$PATH`, proven from both the unbuilt source and the compiled `resources/tool-location.mjs` artifact, and cached nowhere.**

## Performance

- **Duration:** unknown — this SUMMARY closes out a plan whose Task 2 was implemented and committed by an earlier continuation agent (see Issues Encountered); this dispatch re-verified Task 2 and executed Task 3.
- **Completed:** 2026-09-18T09:51:31Z
- **Tasks:** 3 (1 checkpoint:decision, already answered before this dispatch; 2 execution tasks)
- **Files modified:** 6 declared in the plan, plus one deferred-items note

## Accomplishments
- `resolveTool(id, deps)` walks environment -> `.c64-re-tools/tools.json` -> `$PATH`, in that order, for one declared tool id, and reports `path`, `tried`, `layer`, `mechanism`, `refusal` — proven against `x64sc`.
- The module compiles into `resources/tool-location.mjs` via the existing `build.ts` pipeline (new `HOST_BOUND_ARTIFACTS` + `tsconfig.build.json` entries), and the compiled copy is proven — not merely assumed — to find `prerequisites.json` from its own, one-directory-deeper location.
- File-layer path normalisation: a leading `~/` expands against the injected `HOME`, a bare `~` is left alone and joined against `projectRoot` like any other relative value, and `node:path`'s own `resolve` is the only normalisation applied — no case folding, no Unicode normalisation, a non-ASCII segment and a trailing separator both round-trip identically. The environment and probe layers are untouched (D-08).
- The seam is proven to cache nothing: a binary appearing on the injected `PATH` between two calls is found by the very next call with no reset hatch, and twenty concurrent calls against one scratch tree each match a solo call byte-for-byte.
- `x64sc`'s `prerequisites.json` record gained a `location` block (`envVar: VICE_BIN`, `fileOverridable: true`) and `kind: executable`, with `schemaVersion` unchanged at `1` and every pre-existing `prerequisites.test.ts` assertion still passing.
- D-12 (the `tools.json` bare-string value format) and its riding reserved-key rule (D-11) locked as a human, one-way decision at the Task 1 checkpoint.

## Task Commits

1. **Task 1: Lock the `tools.json` file format** — checkpoint:decision, no commit (decision recorded in this SUMMARY and in the plan's own D-12/D-11 prose)
2. **Task 2: One tool, end to end** — `7dcd8ee5` (feat)
3. **Task 3: Path handling, the full result shape, no-cache proof** — `fa4ba778` (test, RED), `74e5ce05` (feat, GREEN)

**Plan metadata:** commit hash recorded below after this file and STATE/ROADMAP/REQUIREMENTS are committed.

_Note: Task 3 carried `tdd="true"`. RED was confirmed before implementation: 4 target tests (tilde expansion, bare-tilde, relative-to-projectRoot, trailing-separator) failed on their planned assertions against the pre-Task-3 implementation, while 3 tests (non-ASCII round-trip, no-cache, concurrency) already passed — proving those invariants held with no implementation change needed. No REFACTOR commit was needed; the GREEN implementation required no further cleanup._

## Files Created/Modified
- `src/mcp/vice/tool-location.mts` - The seam: `resolveTool()`, `resolveOnPath()`, and the locked result/deps types
- `src/mcp/vice/tool-location.test.ts` - 13 colocated tests covering both Task 2's three-layer wiring and Task 3's path normalisation/no-state proofs
- `src/mcp/vice/resources/tool-location.mjs` - Compiled artifact, committed, regenerated after Task 3's edit
- `src/mcp/vice/prerequisites.json` - `x64sc` gains `location`/`kind`; `schemaVersion` stays `1`
- `src/mcp/vice/build.ts` - `HOST_BOUND_ARTIFACTS` gains `"tool-location.mjs"`
- `src/mcp/vice/tsconfig.build.json` - `include[]` gains `"tool-location.mts"`
- `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md` - Records the pre-existing, out-of-scope citation-ledger drift found while running the full gate (see Issues Encountered)

## Decisions Made
- **D-12 (human, one-way):** `tools.json` values are bare strings, not objects. Selected at the Task 1 checkpoint before this dispatch; recorded here as the locked, human-made decision this plan's continuation protocol required.
- Everything else followed the plan as written: D-01 through D-17 as recorded in `59-CONTEXT.md` and this plan's own "Decisions this plan records" section, none reopened.

## Deviations from Plan

None - plan executed exactly as written. Task 2's implementation (written and verified green by an earlier continuation agent, per this dispatch's own re-verification) matched the plan's acceptance criteria exactly; Task 3 was implemented following the plan's RED-GREEN cycle with no scope changes.

## Issues Encountered

**Continuation history.** This plan reached this dispatch as a "second continuation": Task 1's decision was answered, Task 2 was implemented and verified by a prior agent but left uncommitted (blocked on a since-resolved pre-commit HEAD safety check), and Task 3 had not started. This dispatch: (1) re-read and re-ran every one of Task 2's verification commands rather than trusting the prior agent's claim, confirmed all green, and committed Task 2's six files exactly as staged; (2) executed Task 3 via a genuine RED-GREEN cycle (confirmed 4 tests failing on their planned assertions before implementing, then all 13 passing after); (3) closed out the plan. Because Task 2's actual wall-clock work happened in an earlier, separate dispatch, this SUMMARY cannot report a single accurate `Duration` for the whole plan — the frontmatter's `duration: unknown` reflects that honestly rather than fabricating a number.

**Pre-existing, out-of-scope test failure found during the full gate run.** `npm run test:automated` reports one failure unrelated to this plan's files: `phase58-citation-ledger.test.ts`'s "the committed provenance document's citation ledger is complete and every anchor resolves" fails because a citation in `docs/phase58-declaration-provenance.md` points at `.planning/ROADMAP.md:1980-1983` for the anchor text "a user missing ACME learns that", but that text now lives at `ROADMAP.md:1989` — a line-shift caused by an unrelated ROADMAP.md edit (most likely phase 59/60 planning inserting a "Depends on" paragraph ahead of the cited block). Neither `ROADMAP.md` nor `phase58-citation-ledger.test.ts` nor `docs/phase58-declaration-provenance.md` is in this plan's `files_modified`, and the failure reproduces identically with none of this plan's changes present. Per the Scope Boundary deviation rule and ENGINEERING_RULES.md's Scope Discipline, this was NOT fixed here — fixing it would itself violate "no unrelated files changed." It is logged in `.planning/phases/59-the-tool-location-seam-and-its-precedence-order/deferred-items.md` and appended to `.planning/WINDOWS.md` (entry 68, kind `deviation`) so it stays visible at ship time. All of this plan's own tests (`tool-location.test.ts`, `resources-sync.test.ts`, `prerequisites.test.ts`) pass with zero failures.

## Known Stubs

None — no stub patterns (hardcoded empty values flowing to UI, placeholder text, unwired components) apply to this plan; it ships a pure resolution module with no rendering surface, and nothing calls it yet by design (D-01).

## Threat Flags

None beyond what the plan's own `<threat_model>` already scoped (T-59-01 through T-59-04, T-59-SC) — no new surface was introduced outside that register.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `tool-location.mts` exists, is compiled, and resolves `x64sc` through all three layers correctly from both source and compiled forms — the foundation plan 59-02 needs to extend `location`/`kind` to the other seven tool ids.
- Nothing calls this seam yet, which is correct per D-01 — Phase 60 owns wiring it into a live resolution path.
- No blockers. The one open item is the pre-existing, unrelated citation-ledger drift documented above and in `WINDOWS.md` entry 68 — not a blocker for 59-02 through 59-05, but should be swept up whenever `ROADMAP.md`'s "Phase 61" section is next touched with intent (plan 59-05 already touches `phase58-citation-ledger.test.ts` for a different reason and could fold in the line-range fix then).

## Self-Check: PASSED

- All 5 key-files (created + deferred-items.md) verified present on disk with `[ -f ]`.
- All 3 commit hashes (`7dcd8ee5`, `fa4ba778`, `74e5ce05`) verified present via `git log --oneline --all`.
- Re-ran `node --test tool-location.test.ts` (13/13 pass), `node --test resources-sync.test.ts` (pass), `node --test prerequisites.test.ts` (pass) immediately before writing this section.
- The one known-failing test in the full gate (`phase58-citation-ledger.test.ts`) is pre-existing and unrelated to this plan's files; documented above under Issues Encountered and in `deferred-items.md` / `WINDOWS.md` entry 68, not silently omitted.

---
*Phase: 59-the-tool-location-seam-and-its-precedence-order*
*Completed: 2026-09-18*
