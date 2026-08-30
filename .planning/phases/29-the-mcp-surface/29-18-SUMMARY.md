---
phase: 29-the-mcp-surface
plan: 18
subsystem: api
tags: [annotation-store, memory-map, drift-gate, path-confinement, node-path, determinism]

requires:
  - phase: 29-the-mcp-surface
    provides: "29-12's store-backed `render-memmap` verb and its `--check` drift gate; 29-14's confinement of `--provenance` through `storePathWithinWorkspace()`"
provides:
  - "`workspaceRelativePath()` in `anno-types.ts` -- the one definition of a workspace-relative, POSIX-separated path spelling, sharing `realpathOfNearestExisting()` with the confinement seam and refusing an escaping path by name"
  - "A memory-map banner whose every byte is a function of content and workspace-RELATIVE location, never of the checkout's absolute path"
  - "A cross-root regression test (render under root A, check the identical bytes under root B, expect in-sync) that could not exist before"
  - "Two corrected in-file statements of the drift semantics, enumerating the causes the code has and stating the negative: relocating the checkout is not drift"
  - "A four-test control set for the new seam in `anno-confinement.test.ts`, observed red before green"
affects: [29-20, memory-map, render-memmap, skills-copy-forward-template]

actuals:
  tokens: 48042
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A spelling that enters a COMPARED artifact gets a named seam, not an inline call at its one call site"
    - "Both sides of a path relation resolve through the same private resolver, so two seams agree by construction rather than by a second rule"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-memmap-render.ts
    - src/mcp/vice/anno-memmap-render.test.ts
    - src/mcp/vice/anno-confinement.test.ts

key-decisions:
  - "`RENDERER_VERSION` stays at \"3\": no digest input moved, and bumping would bury a one-line banner correction inside a digest change in every previously rendered file"
  - "The escape case throws `AnnoStorePathError` rather than returning a `../…` spelling -- a relative spelling that escapes the root encodes where the checkout sits and is the same machine-dependence under a different spelling"
  - "`module-classification.ts` is deliberately UNCHANGED: every citation into a file this plan edits was re-measured and none moved. A no-op here is a finding, not an omission"
  - "The golden fixture's `workspaceRoot` moved to the fixture's own temp tree, which makes the two banner lines stable literal strings instead of an interpolated absolute path -- but the plan's stated CAUSE for that move (an escape refusal) does not reproduce, and is corrected below rather than repeated"
  - "The tracer feedback gate was taken on its autonomous branch (re-run the verify, continue on green) rather than emitting a mid-flight checkpoint, because this project sets `workflow.human_verify_mode: end-of-phase`, `mode: yolo`, and the plan is `autonomous: true` with zero checkpoint tasks"

patterns-established:
  - "Cross-root regression shape: build one tree, COPY it (never build twice -- a store is SQLite and two creations are not byte-equal), render under root A, copy the rendered bytes to the same relative location under root B, assert in-sync there AND that a real hand edit at root B is still caught"
  - "A refusal control is not proven until it has been observed red: disable the refusal branch, capture the failing transcript, revert, capture the passing one"

requirements-completed: [REPOINT-01, REPOINT-02]
# NOTE: these two IDs are DECLARED by this plan but were deliberately NOT marked
# Complete in REQUIREMENTS.md. `gsd-tools query requirements.ready-ids` returned
# "0/2 requirement(s) ready to mark complete" -- sibling plans 29-19, 29-20 and
# 29-21 also declare them and have no SUMMARY yet, so the shared-ID gate (#2388)
# blocks both. They become ready when the last declaring plan finishes.

coverage:
  - id: D1
    description: "The memory-map banner records workspace-relative locations, so two byte-identical checkouts of one tree at different absolute paths render a byte-identical file"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line"
        status: pass
    human_judgment: false
  - id: D2
    description: "End to end through the shipped CLI: render under root A, copy the bytes to root B, `--check` under root B reports in-sync and exits 0, with an identical render_digest in both runs"
    requirement: "REPOINT-02"
    verification:
      - kind: e2e
        ref: "CLAUDE_PROJECT_DIR=<B> node src/mcp/vice/vice-proxy.ts anno render-memmap <B>/game.annostore --provenance <B>/sidecar.json --check"
        status: pass
    human_judgment: false
  - id: D3
    description: "`workspaceRelativePath()` -- one definition of the spelling, sharing the confinement seam's root resolution, normalising to POSIX `/`, spelling `.` at the root, and refusing an escaping path by name"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#16. workspaceRelativePath: the root itself spells `.`, one segment below spells that segment, and a deep nest spells the whole path"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#17. workspaceRelativePath: the spelling is separator-NORMALISED to POSIX `/`"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#18. workspaceRelativePath: a path OUTSIDE the root is refused BY NAME rather than spelled with `..`"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#19. workspaceRelativePath: a symlinked workspace ROOT does not make an in-workspace store look foreign"
        status: pass
    human_judgment: false
  - id: D4
    description: "The suite asserts the ABSENCE of the absolute paths from the rendered markdown; it no longer asserts their presence"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line"
        status: pass
      - kind: other
        ref: "grep -n 'includes(storePath)|includes(provenancePath)' src/mcp/vice/anno-memmap-render.test.ts -- both hits are NEGATED"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two probe-authored edge predicates that land in this file: an empty store renders as a RESULT and cross-root checks in-sync; `--check` names the lowest differing line, stably"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-memmap-render.test.ts#--check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line"
        status: pass
    human_judgment: false
  - id: D6
    description: "`anno-memmap-render.ts`'s two in-file statements of the drift semantics name the causes the code actually has and state the negative -- the in-file half of the 29-14 prohibition's count (1)"
    verification: []
    human_judgment: true
    rationale: "Prose truthfulness against an enumerated cause set is a judgment call: no test asserts that the enumeration is EXHAUSTIVE, only that the code behaves as each clause says. A human must read the two blocks against `renderMemoryMap()`'s inputs and confirm nothing is claimed that the code does not provide -- which is the prohibition being discharged."

duration: 25 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 18: The path-independent drift gate Summary

**`render-memmap`'s banner now records workspace-relative locations through a new `workspaceRelativePath()` seam, so the identical tree at a different absolute path renders byte-identical markdown and `--check` exits 0 where it previously reported `drifted` at line 3 while printing the same `render_digest`.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-30T15:56Z
- **Completed:** 2026-08-30T16:21Z
- **Tasks:** 2 (3 commits — the tracer ran RED → GREEN)
- **Files modified:** 4

## Accomplishments

- The drift gate no longer contradicts its own artifact. `computeRenderDigest()` and `checkRenderedMemoryMap()` now measure the same thing: every compared byte is a function of the store rows, the sidecar bytes, `RENDERER_VERSION` and the workspace-RELATIVE locations, and nothing in them is a function of where the checkout sits.
- `workspaceRelativePath(path, workspaceRoot)` in `anno-types.ts` gives "the spelling that goes into a compared artifact" exactly one definition, placed immediately after `storePathWithinWorkspace()` and resolving **both** sides through the same private `realpathOfNearestExisting()`, so the relative spelling and the confinement verdict agree by construction. An escaping path is refused by name rather than spelled with `../` segments.
- The cross-root regression that could not exist before is committed, and the suite that **pinned** the defect now asserts its **absence**.
- Both in-file statements of the drift semantics were rewritten from the false two-cause claim to the causes the code has, each stating the negative this gap is about.
- A carrying benefit recorded rather than claimed silently (threat T-29-18-01): the banner no longer writes the rendering machine's absolute filesystem layout — usernames, home directories, worktree ids — into a file meant to be committed and published.

## Task Commits

1. **Task 1 (tracer), RED: failing cross-root test** — `97f8c02` (test)
2. **Task 1 (tracer), GREEN: the seam, the banner, the two prose sites, the golden re-point** — `88a95a5` (feat)
3. **Task 2: the absence assertion, the edge controls, the citation re-measurement** — `99333b8` (test)

_The tracer task carries two commits (RED → GREEN) per its `tdd="true"` marking; the plan's requirement that the golden re-point land "in the same commit as the production change" is satisfied by `88a95a5`._

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — new exported `workspaceRelativePath()`; `relative`/`isAbsolute` added to the existing `node:path` import. `realpathOfNearestExisting()` stays private, as required.
- `src/mcp/vice/anno-memmap-render.ts` — the `store:`/`sidecar:` banner lines call the seam; the banner prose beneath `render_digest:` and `checkRenderedMemoryMap()`'s doc comment rewritten. `computeRenderDigest()` and `RENDERER_VERSION` untouched.
- `src/mcp/vice/anno-memmap-render.test.ts` — `buildStoreFixture()` extracted from `withRenderFixture()`; the cross-root test; the empty-store test; the lowest-line test; the golden fixture re-pointed and given the absence assertion.
- `src/mcp/vice/anno-confinement.test.ts` — tests 16–19, the control set for the new seam.
- `src/mcp/vice/module-classification.ts` — **deliberately unchanged**; see Evidence below.

## Evidence

### 1. The two-root end-to-end run through the shipped CLI

Two temp trees `wsA/` and `wsB/`, each with a real `.annostore` and a real sidecar at the same relative location; `diff -r wsA wsB` reported no differences before each run.

**Before the fix** (at base `6715a75`):

```
render under root A   -> wrote .../wsA/memory-map.md (1 row(s), 0 [unknown],
                         digest d945a7fb3c40e5c739496b7d36fd4fcc4ba034af8cc6b8cac6847dcb6fe93944)
                         EXIT 0
check  under root A   -> in sync                                            EXIT 0
copy   A -> B         -> byte-identical copy
check  under root B   -> drifted at line 3
  expected:   store: .../wsB/game.annostore
  actual:     store: .../wsA/game.annostore                                 EXIT 1
render under root B   -> digest d945a7fb…3944  (THE SAME DIGEST)            EXIT 0
```

**After the fix** (at `88a95a5`):

```
render under root A   -> digest d945a7fb3c40e5c739496b7d36fd4fcc4ba034af8cc6b8cac6847dcb6fe93944  EXIT 0
check  under root A   -> in sync                                            EXIT 0
copy   A -> B         -> byte-identical copy
check  under root B   -> in sync (.../wsB/memory-map.md)                    EXIT 0
render under root B   -> digest d945a7fb3c40e5c739496b7d36fd4fcc4ba034af8cc6b8cac6847dcb6fe93944  EXIT 0
banner in BOTH trees:
  store: game.annostore
  sidecar: sidecar.json
cmp wsA/memory-map.md wsB/memory-map.md -> RENDERED-FILES-BYTE-IDENTICAL-ACROSS-ROOTS
```

`render_digest` is `d945a7fb3c40e5c739496b7d36fd4fcc4ba034af8cc6b8cac6847dcb6fe93944` in all four renders — equal before and after, which is the point: the digest was never the wrong half.

### 2. Test counts, before and after

| File | Before | After | Δ |
|---|---|---|---|
| `anno-memmap-render.test.ts` | 23 tests / 23 pass | 26 tests / 26 pass | +3 |
| `anno-confinement.test.ts` | 15 tests / 15 pass | 19 tests / 19 pass | +4 |

The intermediate RED state at `97f8c02` was 24 tests / 23 pass / **1 fail** — the new cross-root test, failing on the markdown byte-equality assertion.

### 3. The escape control, observed red then green

With the refusal branch in `workspaceRelativePath()` temporarily disabled (`if (false && …)`):

```
ok 16 - ...
ok 17 - ...
not ok 18 - 18. workspaceRelativePath: a path OUTSIDE the root is refused BY NAME
            rather than spelled with `..`, while a `..` that normalises back INSIDE is accepted
  error: 'the refusal must be an AnnoStorePathError, got AssertionError [ERR_ASSERTION]:
          expected a refusal, got the spelling "../outside/game.annostore"'
ok 19 - ...
# tests 19 / # pass 18 / # fail 1
```

That is precisely the alternative implementation the fix rejects. After reverting the one-token change:

```
ok 18 - 18. workspaceRelativePath: a path OUTSIDE the root is refused BY NAME ...
# tests 19 / # pass 19 / # fail 0
```

`git diff -- src/mcp/vice/anno-types.ts` was empty afterwards, so the file is byte-identical to its committed state.

### 4. Guarded citations — every one re-measured, none moved

`grep -n 'anno-memmap-render\|anno-types\|anno-confinement' src/mcp/vice/module-classification.ts`:

```
351:        { path: "src/mcp/vice/anno-memmap-render.test.ts", symbol: "formatConfidenceComment", line: 42 },
460:    module: "anno-memmap-render.ts",
465:      to: "anno-memmap-render.ts",
474:        { path: "src/mcp/vice/anno-memmap-render.test.ts", symbol: "renderMemoryMap" },
```

| Citation | Cited line's actual content | Verdict |
|---|---|---|
| `anno-memmap-render.test.ts:42` → `formatConfidenceComment` | `import { formatConfidenceComment, CONFIDENCE_GRADES } from "./anno-confidence.ts";` | **holds** — no line was inserted or removed above 42; the only edit in that region replaced an existing import line in place |
| `anno-cli.ts:94` → `renderMemoryMap` (grep hit at `:473`) | `import { renderMemoryMap, checkRenderedMemoryMap } from "./anno-memmap-render.ts";` | **holds** — `anno-cli.ts` is not touched by this plan |
| `anno-memmap-render.test.ts` → `renderMemoryMap` (no `line`) | n/a | **holds** — nothing to re-measure |
| `:460` / `:465` | `module:` / `to:` record fields, not path citations | n/a |

A separate grep for prose `path:NN` citations into the three edited files (`anno-memmap-render*:N`, `anno-types*:N`, `anno-confinement*:N`) returned **no matches**, so DIRECTION 9b has nothing to re-resolve either. `module-classification.ts` is therefore unchanged — and, per the plan, that no-op is reported as a finding rather than left silent. `node --test module-classification.test.ts` exits 0 (35 tests with `anno-confinement.test.ts`; 65 pass across the plan's three named files).

### 5. Gates

| Gate | Result |
|---|---|
| `node --test anno-memmap-render.test.ts anno-confinement.test.ts module-classification.test.ts` | 65 tests, 65 pass, 0 fail — exit 0 |
| `npm --prefix src/mcp/vice run typecheck` | exit 0 |
| `npm --prefix src/mcp/vice run test:automated` | 2741 tests, **2734 pass, 1 fail**, 1 skipped, 5 todo |
| `node scripts/check-no-regenerator2000.mjs` | exit 0, 392 files scanned, **0 temporarily allow-listed across 0 entries** |
| `grep -a -n 'store: \|sidecar: ' anno-memmap-render.ts` | `474: lines.push(\`  store: ${storeLocation}\`)` / `475: lines.push(\`  sidecar: ${sidecarLocation}\`)` — neither interpolates a raw path |
| `git diff -- anno-memmap-render.ts \| grep -a '^[-+].*RENDERER_VERSION'` | two hits, **both prose** (` * ` doc-comment lines); no changed code line. `computeRenderDigest` returns nothing at all |

**`test:automated` failing-file set: `{ repo-root.test.ts }`** — one assertion, `path agreement (D-3, D-6, …)`, failing with *"the agreed directory must not sit under .claude -- got …/.claude/worktrees/agent-ad62c886062531dfa/.vice-supervisor"*. That is verbatim `deferred-items.md` item 2: every GSD worktree lives under `.claude/worktrees/`, so `repoRoot()` legitimately resolves there. It is a worktree-location artifact, is reported by name rather than banked as a new failure, and this plan touches none of the files involved. Against the orchestrator's pre-dispatch baseline of 2734 tests / 2728 pass / 0 fail in the main checkout, the arithmetic reconciles exactly: `2734 + 7 new tests = 2741`, and `2728 + 7 - 1 = 2734` passing.

## Decisions Made

- **`RENDERER_VERSION` stays `"3"`.** No digest input moved. Both assertions that pin it (`RENDERER_VERSION === "3"` and the `/RENDERER_VERSION.{0,400}"2" -> "3"/s` source assertion) are green — tests 14 and 20.
- **The escape case throws.** `workspaceRelativePath()` refuses by name rather than returning `../…`; the number of `..` hops would itself encode where the checkout sits.
- **`workspaceRelativePath()` is not a confinement check**, and both its own doc comment and the banner's say so. `RenderMemoryMapOptions.provenancePath`'s "THIS MODULE PERFORMS NO CONFINEMENT OF ITS OWN" remains true.
- **The tracer feedback gate was taken autonomously.** Config has `workflow.human_verify_mode: "end-of-phase"` (this project explicitly turned mid-flight human-verify halts off), `mode: "yolo"`, `auto_advance: false`, `_auto_chain_active: false`; the plan is `autonomous: true` and contains zero `checkpoint:*` tasks. Emitting a mid-flight `checkpoint:human-verify` would contradict the project's own configured mode, so the tracer's `<verify>` was re-run end to end instead (24/24 pass at that point) and expansion proceeded. Recorded here because it is a judgment call, not a default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` absent in the worktree**

- **Found during:** Task 1, at the first end-to-end CLI run.
- **Issue:** `node src/mcp/vice/vice-proxy.ts` failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@mastra/mcp'`. `node_modules/` is gitignored and provisioned by a `SessionStart` hook that runs in the main checkout, not in a worktree — so criterion 1, the tracer's whole point, could not run at all.
- **Fix:** Provisioned from the main checkout's already-installed tree **without running any package manager**: `cmp` confirmed the two `package-lock.json` files are byte-identical, then a real `node_modules/` directory was created in the worktree containing one symlink per entry (213) into the main checkout's tree. A single top-level symlink was tried first and rejected — `.gitignore`'s `node_modules/` pattern matches directories only, so a symlink of that name showed up as untracked; the per-entry form keeps `git status` clean.
- **Why this is not the excluded case:** the executor's Rule 3 exclusion covers `npm install <pkg>` of a *named* package, because a failed install may signal a slopsquatted name. No install ran, no name was resolved, no registry was contacted, and no dependency was added — `src/mcp/vice/package.json` is unchanged.
- **Files modified:** none. The provisioning is filesystem-only, gitignored, and not part of any commit.
- **Verification:** `git status --short` empty afterwards; the CLI then ran and reproduced the defect.

**2. [Rule 1 - Bug, in the plan's stated premise rather than in the code] The golden fixture does not sit outside the workspace root**

- **Found during:** Task 1, step 5.
- **Issue:** The plan's `<tracer_greenness_decision>` and step 5 site 1 both assert that the golden test "passes `workspaceRoot: HERE` while writing its store and sidecar into a temp `dir`, so from the seam's point of view that store sits **outside** the root and `workspaceRelativePath()` will refuse it by name". That does not reproduce. `withRenderFixture()` builds its directory with `mkdtempSync(join(HERE, …))` — **inside** `HERE` — and the helper's own doc comment says so in terms: *"both under THIS directory -- which is inside the workspace root, so `openStore()`'s confinement accepts it and a system tmpdir would (correctly) be refused"*. No escape occurs and the seam never throws for that fixture.
- **Fix:** Site 1 was still applied, on its own merits rather than the stated one: passing the fixture's own temp tree as `workspaceRoot` makes the two banner lines the stable literals `probe.annostore` and `capture.provenance.json` instead of an interpolated random `mkdtemp` name, which is a strictly better pin for the property under test and matches how `cmdRenderMemmap()` arranges things. Sites 2 and 3 were required regardless: the golden test went red purely because the two banner lines changed spelling, which is exactly the re-point `29-VERIFICATION.md` asks for. The production refusal was not touched, and `git diff` on `anno-types.ts` confirms it.
- **Files modified:** `src/mcp/vice/anno-memmap-render.test.ts`.
- **Verification:** the golden test — `renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line` — was observed **green** at the end of task 1 (test 21 of 24) and remains green at 26/26.
- **Committed in:** `88a95a5`.

**3. [Rule 2 - Missing critical] A third negative in the golden test**

- **Found during:** Task 2, step 1.
- **Issue:** Asserting the absence of `storePath` and `provenancePath` alone would still pass if the banner leaked the fixture's containing directory by some other route.
- **Fix:** Added `assert.ok(!result.markdown.includes(dir), …)` alongside the two the plan names, under the same `CR-01` failure message.
- **Files modified:** `src/mcp/vice/anno-memmap-render.test.ts`.
- **Committed in:** `99333b8`.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug-in-premise, 1 missing critical)
**Impact on plan:** None on scope. Deviation 1 was required to run the plan's own acceptance criterion 1 and changed no tracked file. Deviation 2 corrects a factual claim in the plan text while still performing the edit the plan asked for. Deviation 3 is one additional assertion inside the concern task 2 already owns. No file outside `files_modified` was touched, and `module-classification.ts` — which IS in `files_modified` — was deliberately left alone on measurement.

## Issues Encountered

- **`repo-root.test.ts` fails inside a GSD worktree.** Pre-existing and documented (`deferred-items.md` item 2); reported by name, not fixed, and not caused by this plan. Everything else in `test:automated` is green.
- **The plan's `<scope_verification>` and `<stopping_rule>` were left exactly as written.** Nothing in this plan touched any OPEN-AS-WARNING id, any deferred finding, or `anno-cli.ts` / the skill trees / the copy-forward template — all of which belong to plan 29-20.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or unwired component was introduced. The one zero-valued behaviour added (an empty store rendering `rowCount: 0`) is a deliberate, tested **result** rather than a stub — test `a store with ZERO ranges, labels and comments renders a banner and a digest…` asserts it is reached without a throw or a refusal.

## Handoff to Plan 29-20

Recorded here so it is not lost between the two plans, per the plan's `<renderer_version_decision>`:

**A memory map rendered before 2026-08-30 will report `drifted` on its first `--check` after this change, exactly once**, because the banner's `store:` and `sidecar:` lines moved from absolute to workspace-relative spellings. The remedy is one step: re-run the generator and commit the new banner. In **this** repository that regresses nothing — `git ls-files` shows no committed rendered `memory-map.md`, only the template — but a consuming project that already rendered one will see it. **Plan 29-20 task 2 owns writing that sentence into both copy-forward texts, in both skill trees.** This plan does not own those files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 29-20 (wave 2) can proceed: the corrected code its prose must describe is landed, and the three shipped texts it owns (`anno-cli.ts` USAGE, `templates/memory-map.template.md`, `c64-program-recon/SKILL.md`) can now be written against behaviour that actually holds.
- `REPOINT-01` / `REPOINT-02` remain unmarked in `REQUIREMENTS.md` pending the shared-ID gate; they become ready when 29-19, 29-20 and 29-21 have SUMMARYs.
- No blockers introduced.

## Self-Check: PASSED

- All four `key-files.modified` entries exist on disk (`ls -1` returned every one).
- All three task commits resolve in `git log`: `97f8c02`, `88a95a5`, `99333b8`, plus the plan-metadata commit for this file.
- `git status --short` is empty — nothing uncommitted, nothing untracked, no stray fixture left behind (the two-root CLI trees were built under the session scratchpad and removed).
- No commit in this plan deleted a tracked file (`git diff --diff-filter=D` empty for each).
- `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified — the orchestrator owns those writes after the wave merges.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*
