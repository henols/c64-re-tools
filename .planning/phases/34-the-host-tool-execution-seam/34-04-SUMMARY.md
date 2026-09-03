---
phase: 34-the-host-tool-execution-seam
plan: 04
subsystem: infra
tags: [broker, control-plane, acme, packer-oracle, host-tool, skill-migration]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host_tool control op and acme.build allowlist entry, plan 34-03's ghidra.analyze entry -- this plan extends host-tool.mts with oracle.probe/oracle.run and migrates the two container-side skill scripts onto all three"
provides:
  - "mcp-module.mjs: the ONE MCP-tree resolution ladder (resolveMcpModule()/refusalMessage()/TARGET_PACKAGE), extracted from vsf-slice.mjs's own copy, with three production consumers (vsf-slice.mjs, acme.mjs, packer-finding.mjs)"
  - "acme.mjs migrated onto the seam: no direct child-process spawn of `acme`, no container library-path probe -- both moved into host-tool.mts's acme.build allowlist entry"
  - "packer-finding.mjs migrated onto the seam: probeUnp64()/runUnp64() reach oracle.probe/oracle.run via a synchronous execFileSync of host-tool-client.ts's CLI, preserving their pre-existing synchronous, never-throw contract byte-for-byte"
  - "host-tool-client.ts gained the CLI entry point (`run --tool <id> --args <json> [--repo-root <path>]`) both migrated scripts invoke as a subprocess -- the plan's own read_first assumed this already existed; it did not"
affects: [34-05-PLAN, 34-06-PLAN]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "The MCP-tree resolution ladder exists in exactly one place (mcp-module.mjs), computed via an ancestor-walk from import.meta.url rather than a fixed '..' hop count -- three production consumers reach it, never a copy"
    - "A per-invocation workspace root (the smallest common ancestor of a build's own source/output paths, or a single file's own containing directory) lets the seam's workspace-relative path requirement coexist with legitimate out-of-tree invocations (this repo's own /tmp-based tests, CI's RUNNER_TEMP scaffold) without weakening resolveWorkspacePath()'s escape check"
    - "A migrated script that must stay SYNCHRONOUS for its own unmodified test suite (packer-finding.mjs) reaches the seam via execFileSync rather than async spawn -- the async work still happens inside the spawned subprocess, execFileSync merely blocks until it exits"
    - "A caller-renamed build output is reconciled by renaming the executor's source-basename-derived files after a successful run (a workspace file operation), never by duplicating argv construction client-side"

key-files:
  created:
    - src/skills/c64-ram-capture/scripts/mcp-module.mjs
    - src/skills/c64-ram-capture/scripts/mcp-module.test.mjs
  modified:
    - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
    - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs
    - src/skills/c64-ram-capture/scripts/derive-transients.test.mjs
    - src/skills/acme-build/scripts/acme.mjs
    - src/skills/acme-build/SKILL.md
    - src/skills/c64-program-recon/scripts/packer-finding.mjs
    - src/skills/c64-program-recon/SKILL.md
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool-client.ts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/acme-verify.test.ts
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "commonAncestorDir()/toRel() in acme.mjs, single-file toWorkspaceRelative() in packer-finding.mjs -- both root each seam invocation at the smallest directory that can express the paths involved, rather than the real project root, so a legitimate out-of-tree build (this repo's own /tmp-based tests, CI's RUNNER_TEMP scaffold check) keeps working under resolveWorkspacePath()'s escape check."
  - "packer-finding.mjs reaches the seam via execFileSync, not async spawn -- its colocated, unmodified test file calls probeUnp64()/runUnp64() synchronously (including at module scope), so converting them to Promise-returning functions would silently break every call site. acme.mjs uses async spawn instead, since its own governing suite spawns it as a subprocess and never imports its functions directly."
  - "The ACME library probe (findAcmeLib()) moved server-side into host-tool.mts entirely -- plan 34-01's acme.build entry never had one; extending it there (rather than keeping a client-side copy) was required by this plan's own action text and by the owner's rule that a container has no PATH to probe host library directories on."
  - "runHostToolFromContainer() now skips containerPath() translation entirely on the host route -- it was calling it unconditionally, which throws for any output path outside this project's own workspace root. Discovered live: the flat host route this plan's own must-haves require (an out-of-tree acme.mjs build) cannot work with that call in place."

requirements-completed: [SEAM-05]

coverage:
  - id: D1
    description: "The MCP-tree resolution ladder exists in exactly one place (mcp-module.mjs) with three production consumers, and the hop count is computed rather than hardcoded (SEAM-05)"
    requirement: "SEAM-05"
    verification:
      - kind: unit
        ref: "mcp-module.test.mjs (7 cases, fail 0)"
        status: pass
      - kind: unit
        ref: "vsf-slice.test.mjs (22 cases, fail 0, unchanged assertions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "acme.mjs no longer names the acme binary in a child-process call on any route, its CLI contract is byte-identical, and the flat broker-free host route CI depends on still produces a correct .prg (SEAM-05)"
    requirement: "SEAM-05"
    verification:
      - kind: integration
        ref: "skill-acme-build-cli.test.ts (15 cases under VICE_REQUIRE_ACME=1, fail 0, no assembling case skipped)"
        status: pass
      - kind: other
        ref: "manual FLAT_HOST_ROUTE_OK probe: acme.mjs new + build with no broker running, correct $0801 load address"
        status: pass
    human_judgment: false
  - id: D3
    description: "packer-finding.mjs's two former spawn sites reach the host binary only through the seam, every cap and never-throw path is intact, and the governing colocated suite passes unmodified with an absent oracle still a named skip (SEAM-05)"
    requirement: "SEAM-05"
    verification:
      - kind: unit
        ref: "packer-finding.test.mjs (16 pass, 1 named skip -- oracle genuinely absent on this host)"
        status: pass
      - kind: other
        ref: "direct-import contract check (probeUnp64/runUnp64 shapes and cap values unchanged) -- CONTRACTS_PRESERVED"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whole-tree test:automated failing-test count stays at the documented pre-existing baseline (2, both in anno-register.test.ts) after the migration"
    verification:
      - kind: other
        ref: "npm run test:automated: 3195 tests, 3187 pass, 2 fail -- unchanged from 34-03's own recorded baseline"
        status: pass
    human_judgment: false

duration: 59min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 04: The Host-Tool Execution Seam Migration (acme.mjs, packer-finding.mjs) Summary

**`acme.mjs` and `packer-finding.mjs` no longer spawn a host binary directly -- both reach `acme`/`unp64` only through `host-tool.mts`'s allowlist via a shared, extracted resolution ladder (`mcp-module.mjs`), with byte-identical CLI contracts proven by their unmodified governing test suites.**

## Performance

- **Duration:** ~59 min
- **Started:** 2026-09-03T16:21:22+02:00 (base commit)
- **Completed:** 2026-09-03T17:17:31+02:00
- **Tasks:** 3
- **Files modified:** 14 (2 created, 12 modified)

## Accomplishments

- `mcp-module.mjs`: the MCP-tree resolution ladder `vsf-slice.mjs` used to carry itself, extracted with `resolveMcpModule()`/`refusalMessage()`/`TARGET_PACKAGE`, computing its in-repo hop count via an ancestor-walk from `import.meta.url` rather than a fixed `".."` count. `vsf-slice.mjs` now imports it and behaves identically (22/22 tests pass, one test needed a one-line fix to also copy the new sibling into its isolation scratch dir).
- `acme.mjs`: `build()` sends a typed `acme.build` request through the seam (`resolveMcpModule` → `host-tool-client.ts`, invoked async with `process.execPath`) instead of spawning `acme` directly. Removed `findAcmeLib()`/`LIB_MARKER`/`ACME_LIB` and the four container library-path candidates entirely. A computed per-invocation workspace root (`commonAncestorDir()`) keeps out-of-tree builds working (this repo's own `/tmp`-based governing test, CI's `RUNNER_TEMP` scaffold check), and a caller-renamed output (`-o` with a different stem than the source) is reconciled by renaming the executor's source-basename-derived files afterward.
- `packer-finding.mjs`: `probeUnp64()`/`runUnp64()` reach `oracle.probe`/`oracle.run` via a **synchronous** `execFileSync` of `host-tool-client.ts`'s CLI -- kept synchronous specifically because the colocated, unmodified `packer-finding.test.mjs` calls both functions with no `await`, including at module scope (`const PROBED = probeUnp64();`). All caps, the packedness threshold, and both functions' never-throw contract are unchanged and asserted by a direct-import contract check.
- `host-tool.mts` gained the `oracle.probe`/`oracle.run` allowlist entries (async, reusing the one `spawnHostTool()` call site, now also capturing stdout) and the ACME library probe (`findAcmeLib()`, moved server-side -- plan 34-01's `acme.build` entry never had one) with the "for `<...>` includes, set `$ACME`..." diagnostic-note injection.
- `host-tool-client.ts` gained the CLI entry point (`run --tool <id> --args <json> [--repo-root <path>]`) both migrated scripts invoke as a subprocess -- required for the seam to be reachable from a different npm package at all, and not present despite the plan's own read_first assuming it existed (a genuine gap, fixed as Rule 3).
- `npm run test:automated`: 3195 tests, 3187 pass, 2 fail -- exactly the documented pre-existing baseline (`anno-register.test.ts`, unrelated to this plan), with a stopped broker throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: One resolution ladder, three consumers — extracted, not copied** - `2fa1515` (test)
2. **Task 2: `acme.mjs` migrated — same CLI, same output, no binary named** - `e6be912` (feat)
3. **Task 3: `packer-finding.mjs` migrated — both spawn sites gone, never-throw preserved** - `e12f098` (feat)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `src/skills/c64-ram-capture/scripts/mcp-module.mjs` - the one MCP-tree resolution ladder (`resolveMcpModule`/`refusalMessage`/`TARGET_PACKAGE`)
- `src/skills/c64-ram-capture/scripts/mcp-module.test.mjs` - 7 cases covering the ladder's behaviour
- `src/skills/c64-ram-capture/scripts/vsf-slice.mjs` - imports the extracted ladder, deletes its own `ladder()`/`resolveTarget()`
- `src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs` - one-line fix: the "no rung resolves" isolation test now also copies the sibling `mcp-module.mjs`
- `src/skills/c64-ram-capture/scripts/derive-transients.test.mjs` - one-line pointer comment naming `mcp-module.mjs` as the production copy
- `src/skills/acme-build/scripts/acme.mjs` - `build()` migrated onto the seam; no direct spawn, no library-path candidates
- `src/skills/acme-build/SKILL.md` - documents the seam route in place of the container library-path probe ladder
- `src/skills/c64-program-recon/scripts/packer-finding.mjs` - `probeUnp64()`/`runUnp64()` migrated onto the seam via synchronous `execFileSync`
- `src/skills/c64-program-recon/SKILL.md` - names the seam route where the playbook reaches the oracle
- `src/mcp/vice/host-tool.mts` - `oracle.probe`/`oracle.run` allowlist entries, ACME library probe, stdout capture in `spawnHostTool()`
- `src/mcp/vice/host-tool-client.ts` - new CLI entry point; fixed `runHostToolFromContainer()` to skip `containerPath()` on the host route
- `src/mcp/vice/resources/host-tool.mjs` - rebuilt artifact
- `src/mcp/vice/acme-verify.test.ts` - argv-agreement invariant repointed at `host-tool.mts`; "binary token" divergence discharged
- `src/mcp/vice/module-classification.ts` - repaired a prose line citation shifted by the SKILL.md edit

## Decisions Made

See `key-decisions` in frontmatter: the per-invocation workspace-root computation (`commonAncestorDir()`/`toRel()`/`toWorkspaceRelative()`), the sync-vs-async seam-invocation split between the two scripts, the server-side ACME library probe, and the `runHostToolFromContainer()` host-route translation fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `host-tool-client.ts` had no CLI entry point, despite the plan's own read_first assuming one existed**
- **Found during:** Task 2, before any migration code could be written
- **Issue:** The plan's read_first for Task 2 says to read "`host-tool-client.ts`'s ... CLI entry point" as prior art from plan 34-01. No such entry point exists in the file plan 34-01 actually produced -- it exports `runHostToolFromContainer()` and helpers only, with no `process.argv`-guarded CLI section. Without one, neither migrated script has any way to reach the seam from a different npm package (a static `import` cannot cross the `@henols/vice-mcp`/`@henols/c64-re-tools` package boundary).
- **Fix:** Added a CLI entry point (`run --tool <id> --args <json> [--repo-root <path>]`) mirroring `host-tool.mts`'s own `IS_ENTRY_POINT` pattern, printing the translated response as one JSON line and exiting 0/1 on `ok`.
- **Files modified:** `src/mcp/vice/host-tool-client.ts`
- **Verification:** Manual smoke test (`node host-tool-client.ts run --tool acme.build --args '{...}'`), then both migrated scripts' full governing suites.
- **Committed in:** `e6be912` (Task 2 commit)

**2. [Rule 1 - Bug] `runHostToolFromContainer()` called `containerPath()` unconditionally, breaking every out-of-tree host-route invocation**
- **Found during:** Task 2, first manual smoke test of the migrated `acme.mjs`
- **Issue:** `translateHostToolResponse()` ran on BOTH routes, but `containerPath()` throws for any host path outside this project's own workspace root (`hostRootCandidates()`). On the host route (no container, this repo's own environment), a build rooted anywhere outside the repo tree -- exactly this plan's own governing test's `/tmp`-based scratch directories, and CI's `RUNNER_TEMP`-rooted scaffold check -- would always fail with "does not match any known host root."
- **Fix:** `runHostToolFromContainer()` now only translates on the container route (`isInsideContainer()`); the host route returns the raw response unchanged, since host and container coordinates are the same filesystem when there is no container.
- **Files modified:** `src/mcp/vice/host-tool-client.ts`
- **Verification:** `skill-acme-build-cli.test.ts`'s full suite (all 4 `/tmp`-rooted build cases pass), manual `FLAT_HOST_ROUTE_OK` probe.
- **Committed in:** `e6be912` (Task 2 commit)

**3. [Rule 3 - Blocking] `host-tool.mts`'s `acme.build` entry (from plan 34-01) never had an ACME library probe at all**
- **Found during:** Task 2, reading `host-tool.mts`'s current `buildHostToolArgv()` for the acme.build branch
- **Issue:** The removed client-side `findAcmeLib()` set the `ACME` environment variable for angle-bracket includes and appended a diagnostic hint when ACME complained about it missing. Plan 34-01's tracer never implemented this server-side -- the acme.build entry spawned bare `acme` with the inherited broker environment, with no equivalent probe.
- **Fix:** Added `findAcmeLib()` server-side in `host-tool.mts` (same five candidates, same marker file), wired it to set the child's `ACME` env var, and appended the "for `<...>` includes, set `$ACME`..." note to `stderrTail` when ACME's own complaint appears -- reusing `parseDiagnostics()`'s existing "any non-MSVC line is a note" behaviour client-side, so `acme.mjs` needed no change to pick it up.
- **Files modified:** `src/mcp/vice/host-tool.mts`
- **Verification:** `host-tool.test.ts`'s full suite (including the real end-to-end ACME case) still passes; `skill-acme-build-cli.test.ts`'s library-free cases still pass with `ACME=""` propagated through both subprocess hops.
- **Committed in:** `e6be912` (Task 2 commit)

**4. [Rule 1 - Bug] `acme-verify.test.ts`'s argv-agreement invariant broke because `acme.mjs` no longer constructs argv**
- **Found during:** Task 3, full `npm run test:automated` regression pass after both migrations
- **Issue:** A pre-existing test compared `acme-verify.ts`'s own argv construction against `acme.mjs`'s `const args = [...]` array literal, extracted directly off disk, to catch drift between the two independently-maintained implementations. The migration removed that array from `acme.mjs` entirely (it moved to `host-tool.mts`'s `buildHostToolArgv()`), so the extraction found nothing meaningful.
- **Fix:** Repointed the comparison at `host-tool.mts`'s `const argv: string[] =` literal (the argv construction's new home) and updated the header comment's rationale. Separately, the test's OWN "binary token" declared divergence (skill spawns literal `"acme"`, verify spawns overridable `ACME_BIN`) is now discharged: `host-tool.mts` resolves the binary from `process.env.ACME_BIN` exactly like `acme-gate.ts` does, so both sides use the same overridable convention. Removed that divergence entry and rewrote the test that asserted it into one that asserts the discharge (per the original test's own anticipated wording: "should be removed rather than left standing").
- **Files modified:** `src/mcp/vice/acme-verify.test.ts`
- **Verification:** `acme-verify.test.ts`'s full suite (39/39 pass) under `VICE_REQUIRE_ACME=1`.
- **Committed in:** `e12f098` (Task 3 commit)

**5. [Rule 1 - Bug] `module-classification.ts`'s prose line citation into `c64-program-recon/SKILL.md` drifted**
- **Found during:** Task 3, same regression pass
- **Issue:** This plan's own SKILL.md edit (naming the seam route) shifted the file's line numbers, and `module-classification.ts` cites a specific line (`SKILL.md:347`) as evidence for a classification record. `module-classification.test.ts`'s own `DIRECTION 9b` gate caught the drift: the cited line was now blank.
- **Fix:** Updated the citation to the content's new line number (`:352`).
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `module-classification.test.ts`'s full suite (20/20 pass).
- **Committed in:** `e12f098` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (3 Rule 3 — blocking gaps in prior plans' own tracer scope that this migration's own action text required closing; 2 Rule 1 — genuine test regressions this plan's own in-scope code moves caused, both mechanical and fully verified).
**Impact on plan:** None of the five was scope creep -- all five are the mechanical, necessary consequences of the migration this plan's own text specifies (a CLI entry the seam needs to be reachable at all, a translation bug the flat host route's own governing test exposed, a probe the plan's own action text says to add if missing, and two stale cross-references this plan's own edits shifted). No design decision was made outside what the plan's text already called for.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Neither migrated script names a host binary in a child-process call, on any route -- `spawnSync`/`spawn`/`execFileSync` calls in both files target only `process.execPath` on an in-tree module. Plan 34-05's whole-tree grep gate can now be written against a clean tree.
- The MCP-tree resolution ladder has exactly three production consumers (`vsf-slice.mjs`, `acme.mjs`, `packer-finding.mjs`), all reaching `mcp-module.mjs`.
- `host-tool.mts` now has four allowlist entries (`acme.build`, `ghidra.analyze`, `oracle.probe`, `oracle.run`); plan 34-06's second prefix floor (SEAM-06) has a real, growing family to measure.
- No blockers.

## Self-Check: PASSED

- FOUND: src/skills/c64-ram-capture/scripts/mcp-module.mjs
- FOUND: src/skills/c64-ram-capture/scripts/mcp-module.test.mjs
- FOUND commit: 2fa1515
- FOUND commit: e6be912
- FOUND commit: e12f098
- `node --test mcp-module.test.mjs vsf-slice.test.mjs`: 29/29 pass
- `VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts`: 15/15 pass, no case skipped
- `node --test packer-finding.test.mjs`: 16 pass, 1 named skip (oracle genuinely absent)
- `npm run typecheck`: clean
- `npm run test:automated`: 3195 tests, 3187 pass, 2 fail -- unchanged from the documented pre-existing baseline
- `node scripts/check-npm-packages.mjs`: OK

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
