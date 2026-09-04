---
phase: 35-dxa-vendored-and-parsed
plan: 01
subsystem: infra
tags: [dxa, host-tool-seam, gpl-vendoring, licensing, disassembler]

# Dependency graph
requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "the typed host-tool allowlist (host-tool.mts), resolveWorkspacePath(), runHostToolFromContainer() (host-tool-client.ts), and the acme.build/ghidra.analyze precedent this plan's dxa.disassemble branch mirrors"
provides:
  - "dxa.disassemble, the fifth HostToolId, wired end to end: typed allowlist entry, deterministic argv construction (imageKind-derived -g 0000), stdout-to-file capture, and digest response"
  - "src/mcp/vice/vendor/dxa/ -- the pinned, digest-verified, locally-buildable dxa 0.1.5 source tree and build.bash"
  - "src/mcp/vice/dxa-listing.ts -- parseDumpListing(), A-04's window-contract parser for dxa's -a dump output"
  - "src/mcp/vice/dxa-run.ts -- container-side orchestration reaching the seam exclusively through runHostToolFromContainer()"
  - "an honest THIRD-PARTY-NOTICES.md acknowledging the incorporated GPL-2.0-or-later dxa source"
  - "the phase's opening test-suite floor, measured and recorded (evidence/35-baseline.md)"
affects: [35-02-dxa-listing-parser-hardening, 35-03-dxa-partition, 35-04-dxa-blocks, 35-05-phase-verification]

# Actuals (#2632)
actuals:
  tokens: 67849
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendor a pinned third-party GPL source tree with a pin-file-before-fetch discipline, a digest-gated build.bash (never trusting a spawned command's exit status alone), and a two-candidate binary-path probe (findDxaBinary) covering both unbuilt-source and compiled-resources/ execution of the SAME host-bound module."
    - "A tool with no output-file option (stdout only) crosses the host-tool seam by capturing stdout server-side and writing it to a file, then digesting the FILE -- never the tool's own exit status, never an inline payload on the wire."
    - "A window-contract listing parser: the ONE refusal predicate is a distinct-address-set size mismatch against a declared window, never a running emission count -- immune to a tool's own overlapping/wraparound quirks that a naive running total cannot represent."

key-files:
  created:
    - src/mcp/vice/vendor/dxa/ (20 files: 17 pinned upstream + build.bash + pin file + README.md)
    - src/mcp/vice/dxa-listing.ts
    - src/mcp/vice/dxa-run.ts
    - src/mcp/vice/dxa-live.test.ts
    - src/mcp/vice/dxa-build-gate.test.ts
    - src/mcp/vice/dxa-seam.test.ts
    - src/mcp/vice/fixtures/dxa/ (tracer.prg, tracer.entrypoints, README.md)
    - .planning/phases/35-dxa-vendored-and-parsed/evidence/35-baseline.md
  modified:
    - src/mcp/vice/host-tool.mts (fifth HostToolId, dxa.disassemble's argv branch, findDxaBinary(), runHostTool() dispatch)
    - src/mcp/vice/resources/host-tool.mjs (rebuilt artifact)
    - src/mcp/vice/host-tool.test.ts (census literals: HOST_TOOL_ARG_KEYS_REMAINDER, HOST_TOOL_MINIMAL_VALID_ARGS, declared-path-key total 7->12)
    - src/mcp/vice/hostpath-consumers.test.ts (HOST_TOOL_FAMILY_FLOOR 2+1 -> 2+1+2)
    - src/mcp/vice/test-gate.mjs / test-gate.test.ts (MANUAL_ONLY_TESTS 9 -> 10, dxa-live.test.ts)
    - src/mcp/vice/THIRD-PARTY-NOTICES.md (dxa GPL-2.0-or-later section)
    - .gitignore (vendor/dxa/dxa, vendor/dxa/*.o)

key-decisions:
  - "The plan's own item 9 said the declared path-key census total moves 7 -> 11; the actual correct total given dxa.disassemble's five explicitly enumerated path keys is 12. Used 12 (the value that makes the census assertions internally consistent), documented as a Rule 1 fix to the plan's arithmetic."
  - "buildHostToolArgv()'s dxa binary path resolution needed a two-candidate probe (same-directory, then parent-directory) rather than a single import.meta.url-relative join, because host-tool.mts executes as two different artifacts (unbuilt source at src/mcp/vice/, compiled resources/host-tool.mjs) whose relationship to the sibling vendor/dxa/ directory differs -- ghidra-project.mjs's own precedent works only because IT is also compiled into resources/ alongside host-tool.mjs, which vendor/dxa/dxa (a real, gitignored binary, never copied by build.ts) is not."
  - "build.bash gained an optional DXA_BUILD_CACHE_DIR test-seam override so dxa-build-gate.test.ts can be genuinely hermetic (a scratch cache it fully controls) without ever reaching the network or the developer's own global cache; the default (unset) behavior is unchanged."
  - "GPL-2.0 licence text and main.c's verbatim header were extracted into THIRD-PARTY-NOTICES.md via shell commands (sed against the real source file, cat against /usr/share/common-licenses/GPL-2) rather than retyped, per this retry's content-filter mitigation."

requirements-completed: []  # DXA-01 and DXA-02 are shared with sibling plans 35-02/35-05, not yet complete (shared-ID gate) -- see Next Phase Readiness.

coverage:
  - id: D1
    description: "A .prg on disk becomes a byte-level code/data map through a dxa this project vendored, digest-verified and built -- never one found on $PATH."
    requirement: "DXA-01"
    verification:
      - kind: integration
        ref: "dxa-live.test.ts#dxa-live END TO END: runDxaDisassemble against fixtures/dxa/tracer.prg produces the MEASURED byte-level code/data map"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pin is committed before the fetch, re-verified byte-for-byte, and the build reproduces the pinned binary digest."
    requirement: "DXA-01"
    verification:
      - kind: integration
        ref: "bash vendor/dxa/build.bash verify && bash vendor/dxa/build.bash build (task 1 <verify>)"
        status: pass
      - kind: unit
        ref: "dxa-build-gate.test.ts (10 hermetic digest-gate and notices cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "THIRD-PARTY-NOTICES.md states the truth about incorporated GPL source in the same commit that incorporated it."
    requirement: "DXA-01"
    verification:
      - kind: unit
        ref: "dxa-build-gate.test.ts (4 notices structural cases: retired sentence absent, GPL section present, per-file variance recorded, every vendored .c swept for a header)"
        status: pass
    human_judgment: false
  - id: D4
    description: "dxa.disassemble is the fifth HostToolId with all seven synchronized edits and a green census."
    requirement: "DXA-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts (83 tests, including the both-directions path-key census)"
        status: pass
      - kind: unit
        ref: "dxa-seam.test.ts (9 hermetic typed-allowlist cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "dxa-listing.ts and dxa-run.ts exist, import no hostpath.ts, and the host-tool family floor moved with them."
    requirement: "DXA-02"
    verification:
      - kind: unit
        ref: "hostpath-consumers.test.ts (22 tests, SEAM-06 family floor and absence checks)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The phase's opening test-suite floor is measured and recorded, not assumed."
    verification:
      - kind: other
        ref: "npm run test:automated, recorded in evidence/35-baseline.md (3297 tests, 3288 pass, 3 fail across 2 pre-existing unrelated files)"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min
completed: 2026-09-04
status: complete
---

# Phase 35 Plan 1: dxa Vendored, Wired and Wired Through the Seam Summary

**A raw `.prg` now becomes a byte-level code/data map through a pinned, digest-verified, locally-built `dxa` 0.1.5 binary spawned via `host-tool.mts`'s new `dxa.disassemble` tool id, with `THIRD-PARTY-NOTICES.md` telling the truth about the incorporated GPL-2.0-or-later source in the same commit that landed it.**

## Performance

- **Duration:** ~55 min (retry continuation of an attempt terminated mid-task by an API-level content filter; the vendored tree and `build.bash`/`README.md` from that attempt were reviewed, verified against the plan, and reused rather than redone)
- **Started:** 2026-09-04T~11:10Z (approximate; retry continuation, no fresh `record_start_time` baseline)
- **Completed:** 2026-09-04T10:05:34Z
- **Tasks:** 3 (all completed)
- **Files modified:** 37 (excluding `.planning/STATE.md`/`state.json`, which the orchestrator owns)

## Accomplishments

- Vendored the pinned, upstream-unmodified dxa 0.1.5 source tree (17 tarball files) at `src/mcp/vice/vendor/dxa/`, with a sha256 pin committed before any fetch and `build.bash`'s two digest-gated verbs (`verify`/`build`) reproducing the pinned binary digest `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` exactly.
- Wired `dxa.disassemble` as the fifth `HostToolId` through `host-tool.mts`: a typed `imageKind: "prg" | "flat64k"` field derives dxa's `-g 0000` flag rather than leaving it to caller convention (a flat-64K image without it silently re-bases and discards ~50K); the binary is resolved at a fixed, computed path via a two-candidate probe that covers both the unbuilt `.mts` source and the compiled `resources/host-tool.mjs` artifact; dxa's stdout (it has no `-o` option) is captured and written to a listing file, then digested.
- Ported the Phase 23 evidence parser into `dxa-listing.ts` with A-04's corrected window contract: the one refusal predicate is a distinct-in-window-address-set-size mismatch, never a running emission count — the prior predicate refused a perfectly good full-64K listing on dxa's own top-of-memory dump-column wraparound.
- `dxa-run.ts` provides container-side orchestration reaching the seam exclusively through `runHostToolFromContainer()`, computing the parser's window from the image file itself (never the listing).
- Proved the whole path end to end against a hand-built 23-byte `tracer.prg` fixture: 21 accounted bytes, 6 code, 15 data, 8 matched lines, zero out-of-window — asserted as literals in the opt-in `dxa-live.test.ts` (the tenth `MANUAL_ONLY_TESTS` entry).
- Added two hermetic gate suites (`dxa-build-gate.test.ts`, `dxa-seam.test.ts`, 19 tests) proving the digest-honesty and typed-allowlist claims with no network access and no built binary required.
- Corrected `THIRD-PARTY-NOTICES.md`: the retired "no GPL material" sentence is gone, replaced with a section naming the incorporated GPL-2.0-or-later source, `main.c`'s header quoted verbatim, the per-file copyright variance recorded, and the full GPL-2.0 text supplied (the tarball ships none).
- Measured and recorded the phase's opening `npm run test:automated` floor (3297 tests, 3288 pass, 3 fail across 2 pre-existing, phase-35-unrelated files).

## Task Commits

Each task was committed atomically (this retry additionally split Task 1's vendoring half into its own durable commit before continuing, per the orchestrator's explicit guidance):

1. **Task 1a: vendor the pinned dxa source and build.bash** — `9dc73a2` (feat)
2. **Task 1b: wire dxa.disassemble through the host-tool seam end to end** — `1c27631` (feat)
3. **Task 2: hermetic digest and seam honesty gates** — `91c1e05` (test)
4. **Task 3: packaging decision confirmation and opening baseline** — `48c37fd` (docs)

## Files Created/Modified

See `key-files` in frontmatter for the full list. Highlights:
- `src/mcp/vice/vendor/dxa/` — pinned upstream source (17 files) + `build.bash` + pin file + `README.md`.
- `src/mcp/vice/host-tool.mts` / `resources/host-tool.mjs` — the fifth `HostToolId`.
- `src/mcp/vice/dxa-listing.ts`, `dxa-run.ts` — the parser and container-side orchestration.
- `src/mcp/vice/dxa-live.test.ts`, `dxa-build-gate.test.ts`, `dxa-seam.test.ts` — live, digest-gate, and seam-gate test suites.
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` — corrected licensing statement.
- `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-baseline.md` — the opening test-suite floor.

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the declared path-key census total (plan said 7 -> 11; actual is 7 -> 12)**
- **Found during:** Task 1, item 9 (`host-tool.test.ts` census literal update)
- **Issue:** The plan's own text said "raise the pinned declared-path-key total from 7 to 11", but its own explicit enumeration of `dxa.disassemble`'s path keys two paragraphs earlier lists FIVE keys (`image`, `entrypointsPath`, `datablocksPath`, `labelsPath`, `outDir`). 7 + 5 = 12, not 11. Using 11 would have made the census assertions (which compute the total from the actual `HOST_TOOL_PATH_ARG_KEYS` table) fail against the plan's own literal.
- **Fix:** Used 12, matching the actual key count, in both `host-tool.test.ts` assertion sites and their messages.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** `node --test host-tool.test.ts` — 83/83 pass.
- **Committed in:** `1c27631` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed the vendored-binary path resolution for the compiled artifact**
- **Found during:** Task 1, manual end-to-end verification (`runDxaDisassemble` against the real fixture)
- **Issue:** `buildHostToolArgv()`'s dxa branch computed the binary path as `vendor/dxa/dxa` relative to `import.meta.url`, per the plan's A-01 text ("exactly as ghidra-project.mts is reached from host-tool.mts's own directory"). This works for `ghidra-project.mjs` only because BOTH it and `host-tool.mjs` are compiled into `resources/` together (siblings there). `vendor/dxa/dxa` is a real, gitignored binary `build.ts` never copies anywhere — it always stays at `src/mcp/vice/vendor/dxa/dxa`, a SIBLING of `resources/`, not a child of it. Running the compiled `resources/host-tool.mjs` therefore looked for `resources/vendor/dxa/dxa`, which never exists, and every `dxa.disassemble` request failed with "binary does not exist" even after a successful `build.bash build`.
- **Fix:** Added `findDxaBinary()`, a two-candidate probe (same-directory, then parent-directory of `HERE`) mirroring `findAcmeLib()`'s own "candidate list, first existing wins" idiom already in the same file.
- **Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs` (rebuilt)
- **Verification:** Manual end-to-end run against `fixtures/dxa/tracer.prg` via the compiled artifact, then `dxa-live.test.ts` (opt-in) asserting the exact MEASURED map.
- **Committed in:** `1c27631` (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added a test-only cache-directory override to build.bash**
- **Found during:** Task 2 (writing `dxa-build-gate.test.ts`)
- **Issue:** The plan requires hermetic tests driving `build.bash` against synthetic scratch trees, but `build.bash`'s `CACHE_DIR` was a hardcoded `${HOME}/.cache/...` path with no override — a hermetic test could not control what tarball `verify`/`build` would see without either touching the real network or the developer's own global cache.
- **Fix:** Added `DXA_BUILD_CACHE_DIR` as an optional environment override, defaulting to the pre-existing hardcoded path unchanged. `dxa-build-gate.test.ts` points it at a per-test scratch cache directory.
- **Files modified:** `src/mcp/vice/vendor/dxa/build.bash`
- **Verification:** `bash vendor/dxa/build.bash verify` with the variable unset still resolves the real cache path and passes (re-verified after the change); `dxa-build-gate.test.ts`'s 4 digest-gate cases that need real tarball bytes pass using only the scratch cache.
- **Committed in:** `91c1e05` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical functionality).
**Impact on plan:** All three were necessary for the plan's own acceptance criteria to actually pass (a wrong census literal, a binary the seam could never find once compiled, and a test suite that could not be hermetic without the override). No scope creep — nothing beyond what the plan's own `<verify>` and `<acceptance_criteria>` blocks required.

## Issues Encountered

None beyond the two auto-fixed bugs and one auto-fixed missing-functionality gap documented above. The previous attempt's content-filter termination (while composing `THIRD-PARTY-NOTICES.md`) was avoided this session by extracting all verbatim upstream/licence text via shell commands (`sed`, `cat`) rather than retyping it through generated output — no filter trip occurred.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `DXA-01` and `DXA-02` are declared by this plan AND by sibling plan `35-05` (both), and `DXA-02` is additionally declared by `35-02`. Per the shared-ID gate, neither requirement is marked `Complete` in `REQUIREMENTS.md` yet — `gsd-tools requirements ready-ids` confirms `0/2 ready` at this plan's completion. They will flip to `Complete` when the LAST plan declaring each (`35-02` for `DXA-02`, `35-05` for both) finishes.
- The architecture is proven end to end on one image; plans `35-02` (parser hardening), `35-03` (partitioning), and `35-04` (data blocks/labels) build on `dxa-listing.ts`/`dxa-run.ts` directly, with no further seam changes expected.
- The opening test-suite floor (`evidence/35-baseline.md`) is ready for plan `35-05`'s closing-reading comparison.
- No blockers.

## Self-Check: PASSED

All 9 claimed key files confirmed present on disk; all 4 claimed commit hashes confirmed in
`git log`. All task-level `<acceptance_criteria>` and the plan-level `<verification>` block
re-ran green immediately before this SUMMARY was written (combined suite: 143/143 tests pass
across `dxa-build-gate.test.ts`, `dxa-seam.test.ts`, `host-tool.test.ts`,
`hostpath-consumers.test.ts`, `test-gate.test.ts`, `host-scripts.test.ts`,
`ci-suite-coverage.test.ts`, `resources-sync.test.ts`; `dxa-live.test.ts` opt-in run: 1/1
pass with zero skips; `npm run typecheck` and `node scripts/check-npm-packages.mjs` both
clean).

---
*Phase: 35-dxa-vendored-and-parsed*
*Completed: 2026-09-04*
