---
phase: 40-the-three-preprocessing-host-tools
plan: 02
subsystem: host-tool-seam
tags: [c1541, host-tool-seam, d64, disk-image, vice-mcp, skill]

requires:
  - phase: 40-01
    provides: "toolsDir() single owning root under .c64-re-tools/; WR-03's two never-throw holes closed in host-tool.mts"
provides:
  - "Five c1541.* HostToolIds (bam/dir/entry/chain/read), each with all seven synchronized edit sites and a declared success-shape classifier"
  - "findSiblingBinary() -- resolves a host tool as a sibling of whichever x64sc backend-detect.mts already resolved, with a logged $PATH fallback and no version probe"
  - "The HostToolOutputClassifier oracle and the HOST_TOOL_OUTPUT_CLASSIFIERS total table, run host-side inside runHostTool() immediately after the digest loop"
  - "TOOLS_WHOSE_OUTPUT_IS_STDOUT, generalising the stdout-capture condition dxa.disassemble used to own alone"
  - "The c64-disk-access skill (SKILL.md + scripts/c1541.mjs) -- five read-only capabilities over the seam, no spawnSync anywhere in the skill tree"
  - "A committed synthetic.d64 fixture (basicstub + tracer) with measured per-capability output shapes recorded in its own README"
affects: [40-03, 40-04, 40-06]

actuals:
  tokens: 19400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "HostToolOutputClassifier oracle: a host-side declared-success-shape check, run immediately after the digest loop and before the response envelope -- absence of the declared shape IS the failure, exit status is never consulted"
    - "Sibling-binary resolution: resolve a host tool as a sibling of an already-resolved reference binary (never a bare-name spawn), with a logged $PATH-fallback warning and no configurable override"

key-files:
  created:
    - src/mcp/vice/fixtures/c1541/synthetic.d64
    - src/mcp/vice/fixtures/c1541/README.md
    - src/skills/c64-disk-access/SKILL.md
    - src/skills/c64-disk-access/scripts/c1541.mjs
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/host-tool.test.ts
    - CLAUDE.md

key-decisions:
  - "Fixed a resolveWorkspacePath() edge case where a workspace root that resolves to the filesystem root (\"/\") was always refused as \"escaping\" itself -- a double-separator prefix-check bug (walkedRoot.path + sep produced \"//\"). Discovered because this plan's own literal Task 1 verify command (a committed in-repo fixture, an out-of-repo /tmp scratch --out-dir) is exactly the shape whose smallest common ancestor is \"/\". Fixed once, in the one shared resolver every tool uses, rather than routed around in c1541.mjs."
  - "classifyC1541ChainOutput() matches \"at least one (track,sector) ->\" rather than the RESEARCH.md illustrative \"(t,s) -> (t,s)\" tuple-on-both-sides shape -- MEASURED: a single-sector file's real -chain output ends the arrow chain with a plain integer (bytes used in the final sector), not a second tuple. Both committed fixture files are single-sector, so this is the shape the committed fixture actually produces; the two-tuple shape is recorded in the fixture README as separately measured against a scratch two-block file, never committed."
  - "c1541.mjs's entry subcommand parses its own listing file's T/S line into firstTrack/firstSector fields on the reported JSON -- a client-side display convenience over the already-decided response, never a second oracle and never a seam contract change (the wire response shape is unchanged: {ok, tool, exitStatus, results, stderrTail})."
  - "resolvedBackend() is called with no supervisorDir override from host-tool.mts -- skips the on-disk backend-detect.mts cache entirely, relying purely on that module's own in-process memo. Keeps buildHostToolArgv() free of a repoRoot-derived cache-path computation; the cost is a fresh --help probe per broker-process lifetime (already the accepted, pre-existing cost of vice-broker.mts's own startup call), not per c1541.* request."
  - "Testing the sibling-resolution branch required redirecting VICE_BACKEND=fork + VICE_BIN to a throwaway path, since c1541 has NO env-var override of its own (D-13/D-14/D-15 forbid one) -- the override branch of resolvedBackend() is deliberately un-memoised and re-reads VICE_BIN fresh every call, which is what lets a single shared fake survive backend-detect.mts's own module-level memo for the whole test file."

patterns-established:
  - "HostToolOutputClassifier oracle pattern for future host_tool ids whose exit status is not the pass/fail signal"

requirements-completed: [PREP-01]

coverage:
  - id: D1
    description: "Five c1541.* HostToolIds (bam/dir/entry/chain/read) wired end-to-end over the host-tool seam, each with all seven synchronized edit sites, a declared success-shape classifier, and a response whose own key set is exactly the five documented fields"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS census (both-directions, total 27); host-tool.test.ts#HOST_TOOL_OUTPUT_CLASSIFIERS completeness (both directions); host-tool.test.ts#c1541.* response-shape case"
        status: pass
      - kind: manual_procedural
        ref: "node src/skills/c64-disk-access/scripts/c1541.mjs {bam,dir,entry,chain,read} against the committed fixture, and the c1541.read round-trip sha256 match against fixtures/dxa/basic-stub.prg -- run live against the real c1541 binary during execution, not persisted as an automated test since CI has no c1541 install"
        status: pass
    human_judgment: false
  - id: D2
    description: "c1541 resolved as a sibling of whichever x64sc backend-detect.mts already resolved, never a bare-name spawn, with no version probe"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "host-tool.test.ts#c1541.* response-shape case (exercises the sibling-resolution branch via a fake x64sc/c1541 pair)"
        status: pass
    human_judgment: true
    rationale: "The sibling-resolution branch itself is proven by an automated test. The $PATH-FALLBACK branch (used only when the sibling candidate is absent) and its logged warning are implemented and manually reasoned through, but findSiblingBinary() is a private, unexported function (mirrors findDxaBinary()/findAcmeLib()'s own convention) and this plan did not add a dedicated unit test exercising that specific sub-branch -- flagged for a human to accept the code-review-level confidence or ask for a follow-up test."
  - id: D3
    description: "A hyphen-leading CBM name is refused BY NAME on entry/chain/read, before any child process is spawned"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "host-tool.test.ts#c1541.chain: args.name beginning with \"-\" is refused BY NAME, and no child process is ever spawned"
        status: pass
    human_judgment: false
  - id: D4
    description: "A committed synthetic.d64 fixture (basicstub + tracer, built once with c1541 outside the seam) with measured per-capability output shapes recorded in its own README"
    requirement: PREP-01
    verification:
      - kind: manual_procedural
        ref: "c1541 -attach fixtures/c1541/synthetic.d64 -dir/-bam/-entry/-chain/-read, run live this session; sha256 of the image and both source .prg fixtures recorded in fixtures/c1541/README.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "The c64-disk-access skill (SKILL.md + scripts/c1541.mjs) exposes five read-only capabilities over the seam with no spawnSync anywhere in the skill tree, and CLAUDE.md's project-skills row is byte-identical to the SKILL.md frontmatter description"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "grep -ac spawnSync src/skills/c64-disk-access/scripts/c1541.mjs (0); skill-description-overlap.test.ts#CLAUDE.md's project-skills table is byte-identical to every SKILL.md frontmatter description"
        status: pass
    human_judgment: false

duration: 76min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 02: c1541 Over the Host-Tool Seam Summary

**Five per-capability `c1541.*` tool ids (bam/dir/entry/chain/read) reach VICE's own disk-image utility from a new `c64-disk-access` skill, entirely through the existing `host_tool` execution seam, with a new declared-success-shape classifier oracle and sibling-of-`x64sc` binary resolution.**

## Performance

- **Duration:** 76 min (approx.)
- **Started:** ~2026-09-08T08:20:00Z
- **Completed:** ~2026-09-08T09:34:24Z
- **Tasks:** 3
- **Files modified:** 8 (across 3 commits)

## Accomplishments

- `c1541.dir` wired end-to-end (tracer, Task 1): a new `HostToolId`, its argv/path/timeout/classifier table entries, a request-normalisation branch, and a container-side skill script reaching it through `invokeSeam()` -- proven against a committed fixture and a nonexistent-image refusal case before any expansion.
- `findSiblingBinary()`: resolves `c1541` (and, by the same mechanism, any future sibling binary) from the directory of whichever `x64sc` `backend-detect.mts` already resolved, memoised per binary name for the process lifetime, with a logged `$PATH`-fallback warning and no version probe (D-14, overruled by the owner 2026-09-08).
- `HostToolOutputClassifier` and the total `HOST_TOOL_OUTPUT_CLASSIFIERS` table: the first host-side declared-success-shape oracle in this module, run immediately after the digest loop -- exit status stays recorded in the log line only and is never consulted for pass/fail (D-11, MEASURED: `c1541` exits 0 even on a genuine `Error - Cannot open file ...`).
- Task 2 expanded to `c1541.bam`/`c1541.entry`/`c1541.chain`/`c1541.read`, each with its own classifier; a CBM name beginning with a hyphen is refused by name before any child is spawned; `c1541.read` mirrors `extractEntry()` one-for-one and round-trips a committed `.prg` byte-identically.
- Task 3 recomputed the both-directions census (declared path-key total 17 -> 27), added a bidirectional completeness gate for `HOST_TOOL_OUTPUT_CLASSIFIERS`, and added coverage for the five ids' response shape and the hyphen-refusal case, reaching a real fake-`c1541` stand-in via `VICE_BACKEND`/`VICE_BIN` redirection since `c1541` itself has no env-var override.
- New `c64-disk-access` skill (`SKILL.md` + `scripts/c1541.mjs`): five read-only subcommands, no `spawnSync` anywhere in the skill tree, and a `CLAUDE.md` row byte-identical to the `SKILL.md` frontmatter description.

## Task Commits

1. **Task 1: End-to-end "a skill script gets a .d64's directory out of c1541" -- one path only (tracer)** - `0b32f21f` (feat)
2. **Task 2: Expand to the remaining four c1541 capabilities** - `ec517e7f` (feat)
3. **Task 3: Recompute the both-directions census and cover the new ids in host-tool.test.ts** - `5b5a8673` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - five new `HostToolId`s, `findSiblingBinary()`, the `HostToolOutputClassifier` oracle, `HOST_TOOL_OUTPUT_CLASSIFIERS`, `TOOLS_WHOSE_OUTPUT_IS_STDOUT`, all seven synchronized edit sites per id, and the `resolveWorkspacePath()` root-is-"/" bug fix
- `src/mcp/vice/resources/host-tool.mjs` - regenerated via `node build.ts`
- `src/mcp/vice/host-tool.test.ts` - recomputed census (17 -> 27), classifier completeness gate, response-shape and hyphen-refusal coverage
- `src/mcp/vice/fixtures/c1541/synthetic.d64`, `README.md` - new committed fixture and its provenance
- `src/skills/c64-disk-access/SKILL.md`, `scripts/c1541.mjs` - new skill, five subcommands
- `CLAUDE.md` - one new project-skills table row

## Decisions Made

See `key-decisions` in the frontmatter. Most consequential: the `resolveWorkspacePath()` fix, since it is a change to code every pre-existing `host_tool` id (`acme.build`, `ghidra.analyze`, `oracle.run`, `dxa.disassemble`, `ghidra.installExtension`) also depends on -- verified against the full `host-tool.test.ts`/`dxa-seam.test.ts` suite (138 tests, 0 failures) to confirm no existing behaviour changed for a non-"/" root.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, discovered mid-execution] `resolveWorkspacePath()` refused every candidate under a workspace root that resolves to the filesystem root ("/")**
- **Found during:** Task 1, running this plan's own literal verify command (`--image` inside the repo, `--out-dir /tmp/claude-1000/c1541-tracer` outside it)
- **Issue:** `c1541.mjs`'s `commonAncestorDir()` (mirroring `acme.mjs`'s own) computed `repoRoot = "/"` for this combination -- the smallest ancestor containing both an in-repo fixture and an out-of-repo scratch directory. `resolveWorkspacePath()`'s prefix check then compared against `walkedRoot.path + sep`, which for `walkedRoot.path === "/"` produces `"//"` -- a prefix no real absolute path (`resolvePath()`/`realpathSync()` always normalise to one leading separator) ever starts with, so EVERY candidate under root `"/"` was wrongly refused as "escaping" a root that in fact contained it.
- **Fix:** `requiredPrefix = walkedRoot.path === sep ? walkedRoot.path : walkedRoot.path + sep`, used in place of the unconditional `walkedRoot.path + sep`.
- **Files modified:** `src/mcp/vice/host-tool.mts`
- **Verification:** The plan's own Task 1 verify command now returns `ok: true` with one result; the full `host-tool.test.ts`/`dxa-seam.test.ts` suite (138 tests) stays green, confirming no regression for any pre-existing tool's non-"/" root.
- **Committed in:** `0b32f21f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix). **Impact:** necessary for this plan's own literal verify command to pass at all; the fix is in a shared resolver every `host_tool` id depends on, and the full existing test suite confirms it does not change behaviour for any non-"/" root. No scope creep.

## Issues Encountered

- `npm run test:automated` reports exactly 3 pre-existing failures, confirmed unrelated to this plan: 2 in `anno-register.test.ts` and 1 in `anno-import.test.ts`, all citing requirement ids archived out of `.planning/REQUIREMENTS.md` at the v0.8.0 milestone close (the same floor 40-01's own SUMMARY recorded). Not fixed (out of scope). A separate, transient run during the same session ALSO hit `audit-root-args.test.ts`'s documented `zz-scratch` ENOENT race (a known, pre-existing test-suite race unrelated to this plan's changes, per this project's own memory note on the subject) -- a stable re-run settled back to exactly the 3 confirmed failures above.
- `anno-verb-coverage.test.ts`'s shipped-skill-tree parity check failed once, transiently, mid-suite: the new `c64-disk-access` skill had not yet propagated into the gitignored `installer/skills/` mirror. Self-healed by a LATER test file in the same `test:automated` run (`audit-root-args.test.ts`'s own `check-skill-cli-invocations.mjs` spawns, which regenerate that mirror on drift) before this executor's own manual `node installer/scripts/sync-skills.mjs` invocation -- which reported "already in sync." No production or test-file edit was needed; this is expected, self-correcting behaviour of the existing sync machinery, not a defect this plan introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `40-03` (petcat) builds directly on this plan's pattern: `findSiblingBinary()` is already generalised to accept any binary name, and `HostToolOutputClassifier`/`HOST_TOOL_OUTPUT_CLASSIFIERS` are ready for a `petcat.decode` entry.
- `40-04`'s real-corpus assertion is the recorded mitigation for this plan's own acknowledged mild circularity (the fixture's format-correctness claim rests on `c1541` agreeing with itself) -- see `fixtures/c1541/README.md`.
- `40-06`'s three live tests re-point onto `c1541.read`, whose signature mirrors `extractEntry(image, entryName)` one-for-one by design.
- One flagged gap for a human to weigh: `findSiblingBinary()`'s `$PATH`-fallback branch (used only when the binary is absent alongside the resolved `x64sc`) has no dedicated automated test -- see coverage `D2`'s `human_judgment: true` entry.
- No blockers for `40-03`.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/mcp/vice/host-tool.mts
- FOUND: src/mcp/vice/resources/host-tool.mjs
- FOUND: src/mcp/vice/host-tool.test.ts
- FOUND: src/mcp/vice/fixtures/c1541/synthetic.d64
- FOUND: src/mcp/vice/fixtures/c1541/README.md
- FOUND: src/skills/c64-disk-access/SKILL.md
- FOUND: src/skills/c64-disk-access/scripts/c1541.mjs
- FOUND: CLAUDE.md (new c64-disk-access row)
- FOUND commit: 0b32f21f
- FOUND commit: ec517e7f
- FOUND commit: 5b5a8673
- Acceptance criteria re-verified: `npm run typecheck` exits 0; `node --test host-tool.test.ts dxa-seam.test.ts resources-sync.test.ts skill-description-overlap.test.ts` reports 138/138 pass; `grep -ac spawnSync src/skills/c64-disk-access/scripts/c1541.mjs` is 0; `grep -ac 'totalDeclared, 27' host-tool.test.ts` is 2; `node build.ts` leaves `git status --porcelain resources/` empty; `npm run test:automated` settles at 3 failing (2 in anno-register.test.ts, 1 in anno-import.test.ts), the confirmed pre-existing floor per 40-01's own SUMMARY.
