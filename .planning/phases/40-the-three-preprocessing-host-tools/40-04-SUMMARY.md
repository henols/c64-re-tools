---
phase: 40-the-three-preprocessing-host-tools
plan: 04
subsystem: host-tool-seam
tags: [host-tool-seam, c1541, petcat, non-vacuity, fakery-detector, d64, vice-mcp, skill]

requires:
  - phase: 40-02
    provides: "Five c1541.* HostToolIds, HostToolOutputClassifier oracle, findSiblingBinary(), the c64-disk-access skill"
  - phase: 40-03
    provides: "petcat.decode's classifier and handover verdict, HOST_TOOL_OUTPUT_CLASSIFIERS table pattern"
provides:
  - "host-tool-oracle.test.ts -- one dedicated file proving, for all six host_tool ids, that the real classifier and a deliberately-wrong exit-status-only predicate reach OPPOSITE verdicts on a committed planted-failure fixture (PREP-04 non-vacuity)"
  - "c64-disk-access's audit subcommand -- the ported d64-parse.mjs fakery detector (three named-reason signatures, one sharper via the per-sector BAM) composed from the existing dir/bam/entry capabilities, plus a chain guard over next-directory pointers and claimed first track/sectors"
  - "Three new committed fixtures: fixtures/c1541/not-a-disk.d64, fixtures/petcat/not-basic.prg (planted failures), fixtures/c1541/synthetic-corrupt.d64 (byte-patched, out-of-geometry + self-referential chain)"
  - "One live-gated cross-validation against Phase 23's real, independently-produced danish.d64 corpus image (D-25 mitigation)"
affects: [40-05, 40-06, 40-07]

actuals:
  tokens: 17936
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Non-vacuity test file pattern: a dedicated *.test.ts asserting a real classifier and a deliberately-wrong test-local predicate DISAGREE over identical captured output, with the wrong predicate's name grep-banned from production source"
    - "Composed detector over an existing seam: audit a disk's directory by calling three ALREADY-SHIPPED host_tool capabilities (dir/bam/entry) rather than adding a seventh tool id, with a pure detector-core function fully unit-testable without the seam or the real binary"

key-files:
  created:
    - src/mcp/vice/host-tool-oracle.test.ts
    - src/mcp/vice/fixtures/c1541/not-a-disk.d64
    - src/mcp/vice/fixtures/c1541/synthetic-corrupt.d64
    - src/mcp/vice/fixtures/petcat/not-basic.prg
    - src/skills/c64-disk-access/scripts/c1541.test.mjs
  modified:
    - src/mcp/vice/fixtures/c1541/README.md
    - src/mcp/vice/fixtures/petcat/README.md
    - src/skills/c64-disk-access/scripts/c1541.mjs
    - src/skills/c64-disk-access/SKILL.md
    - CLAUDE.md

key-decisions:
  - "Live re-measurement this session found c1541's own exit code on a genuine failure is NOT uniform across subcommands on this host's resolved (fork) binary: -dir/-entry exit 0 on every failure input tried (nonexistent path, the committed not-a-disk.d64, a valid attach with an unresolvable name), genuinely non-vacuous against the real binary; -bam/-chain/-read exit 1 on the SAME inputs, which would make a naive exit-status check ALSO refuse -- an agreeing, vacuous pair. This contradicts host-tool.mts's own general D-11 header comment (written from a -dir-only measurement during 40-02). Resolved by using controllable fake stand-in binaries for all six ids, reproducing the documented general \"exit 0 even on failure\" shape D-09's own measured_inputs section states -- the worst case the classifier exists to guard against, and the one a different VICE build (or a future version of this one) could realise for -bam/-chain/-read too. This also keeps the suite hermetic and CI-safe (CI has neither c1541 nor petcat installed)."
  - "Fixed a real, pre-existing bug discovered mid-execution: c1541.mjs had no entry-point guard around its CLI dispatch, so importing it (as the new colocated test does, for its pure auditEntries()/parseDirListing()/etc. functions) executed the dispatch with the test runner's own process.argv and called process.exit(0) before a single test() call registered. Guarded to match d64-parse.mjs's own convention (Rule 3, blocking)."
  - "c1541 -entry on an out-of-geometry first track/sector FAILS OUTRIGHT (no T/S: line at all, exit 0) rather than reporting the invalid value -- MEASURED live against the corrupt fixture. salvageFirstTsFromRefusal() recovers the claimed track/sector from the seam's own refusal message's captured-output tail, so the audit still names the offending track/sector even though the composed c1541.entry call itself came back ok:false."
  - "The audit's outer loop walks a FIXED, already-known list of names (from -dir's own listing), never a raw track/sector-following walk the way the replaced d64-parse.mjs parser did -- so this composed design cannot loop forever by construction, regardless of the chain guard. The chain guard is therefore a DETECTION signal here, not a hang preventer, and it deliberately keeps auditing every remaining name after the first chain_error is recorded rather than aborting -- a corrupt disk's first file revealing a cycle must not hide a later file's own independent flag."
  - "The self-referential directory-chain corruption is planted at the SECTOR level (the directory sector's own \"next directory T/S\" header, shared by every entry in that sector), not per individual directory entry -- this is the structurally correct location for that field, matching d64-parse.mjs's own convention."

patterns-established:
  - "Dedicated non-vacuity test file per phase-level oracle requirement, findable as one unit"
  - "Composed skill-level detector over pre-existing host_tool capabilities, with a pure/unit-testable detector core decoupled from the live seam"

requirements-completed: [PREP-04]

coverage:
  - id: D1
    description: "Six two-directional non-vacuous controls (one per host_tool id: c1541.bam/dir/entry/chain/read, petcat.decode), each asserting the real classifier and a deliberately-wrong exit-status-only predicate reach OPPOSITE verdicts on a committed planted-failure fixture"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "host-tool-oracle.test.ts (13 tests: 6 two-directional + 6 zero-byte + 1 completeness, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A zero-byte captured output is refused by every one of the six classifiers, each with its own named reason"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "host-tool-oracle.test.ts (six dedicated zero-byte cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The exit-status-only predicate is defined only inside the test file, never exported, never imported from production code"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "grep -al 'exitStatusOnly' *.ts *.mts | grep -v '\\.test\\.ts$' | wc -l -- 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The classifier table (HOST_TOOL_OUTPUT_CLASSIFIERS) carries exactly one own property per HOST_TOOL_IDS member, in both directions"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "host-tool-oracle.test.ts#HOST_TOOL_OUTPUT_CLASSIFIERS completeness case"
        status: pass
    human_judgment: false
  - id: D5
    description: "The ported fakery detector (audit subcommand): block count 0, first track/sector outside the image's geometry, and first SECTOR reported free by the allocation map (sharper than a whole-track check) are each flagged with named reasons; a clean entry is never flagged (false-positive control); a cyclic/self-referential directory chain produces a named chain_error rather than hanging"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "c1541.test.mjs (Tier 1, 14 pure tests over parsers and auditEntries(), no seam/binary dependency)"
        status: pass
      - kind: manual_procedural
        ref: "LIVE audit against both committed fixtures (clean: no flags; corrupt: out-of-geometry flag + chain_error), run against the real c1541 binary this session"
        status: pass
    human_judgment: false
  - id: D6
    description: "One assertion cross-validates the directory listing, an entry's own claimed first track/sector, and that entry's independently-walked sector chain against a real, independently-produced release image (Phase 23's danish.d64), gated on the corpus image's presence"
    requirement: PREP-01
    verification:
      - kind: manual_procedural
        ref: "c1541.test.mjs LIVE corpus case, run against the real danish.d64 this session (0 skipped, since the corpus is present on this host)"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 04: PREP-04's Non-Vacuous Controls and the Ported Fakery Detector Summary

**A dedicated `host-tool-oracle.test.ts` proves, for all six `host_tool` ids, that the real positive-shape classifier and a deliberately-wrong exit-status-only predicate DISAGREE on a planted-failure fixture; the `c64-disk-access` skill's new `audit` subcommand ports `d64-parse.mjs`'s fakery detector onto the seam with a sharper per-sector allocation check and a chain guard, cross-validated against a real, independently-produced release image.**

## Performance

- **Duration:** 50 min
- **Started:** ~2026-09-08T10:15:00Z
- **Completed:** 2026-09-08T11:03:31Z
- **Tasks:** 3
- **Files modified:** 10 (across 3 commits)

## Accomplishments

- `host-tool-oracle.test.ts` (Task 1): six two-directional controls, one per `host_tool` id, each asserting the real classifier and a test-local `exitStatusOnly()` predicate reach opposite verdicts over identical captured output; six dedicated zero-byte-captured-output cases; one classifier-table completeness case (both directions). 13 tests, 0 failures. Two new committed planted-failure fixtures (`fixtures/c1541/not-a-disk.d64`, `fixtures/petcat/not-basic.prg`).
- Live re-measurement this session found `c1541`'s own exit code on a genuine failure is **not uniform across subcommands** on this host's resolved binary — `-dir`/`-entry` exit 0 (genuinely non-vacuous against the real binary), `-bam`/`-chain`/`-read` exit 1 (would make a naive exit-status check agree with the classifier, a vacuous pair) — contradicting `host-tool.mts`'s own general D-11 comment. All six controls use fake stand-in binaries reproducing the documented worst-case shape instead, staying hermetic and CI-safe.
- `c64-disk-access`'s new `audit` subcommand (Task 2): composes the existing `dir`/`bam`/`entry` capabilities (no seventh `host_tool` id) into a ported detector carrying `d64-parse.mjs`'s three named-reason signatures — block count 0; first track/sector outside the image's geometry; first **sector** (not merely the whole track) reported free by the allocation map — plus a visited-set chain guard over both claimed first track/sectors and observed next-directory pointers. A new `synthetic-corrupt.d64` fixture (out-of-geometry first track + self-referential directory-sector pointer) proves the detector fires; the clean fixture proves it does not false-positive.
- **Deviation fix, discovered mid-execution:** `c1541.mjs` had no entry-point guard, so importing it for its pure functions (as the new colocated test does) executed the CLI dispatch with the test runner's own `argv` and called `process.exit(0)` before any test registered. Fixed to match `d64-parse.mjs`'s own convention.
- `c1541.test.mjs` (Tasks 2-3): 17 tests — 14 pure (parsers + `auditEntries()`, no seam dependency, always run under CI) plus 3 LIVE (gated on `c1541` being resolvable / the real corpus being present): audit against the clean fixture (no flags), audit against the corrupt fixture (flag + chain error, bounded), and one cross-validation against Phase 23's real `danish.d64` corpus image (Task 3, D-25's stated circularity mitigation) — the directory listing's block-count trailer, an entry's own claimed first track/sector, and that entry's independently-walked sector chain all agree on real, independently-produced data.

## Task Commits

1. **Task 1: Six two-directional non-vacuous controls, one per tool id** - `c30cd4d5` (test)
2. **Task 2: Port the fakery detector onto the seam's inputs, with a chain guard** - `c426f5a7` (feat)
3. **Task 3: One live-gated assertion against a real, independently-produced release image** - `6b563ee4` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `src/mcp/vice/host-tool-oracle.test.ts` - new dedicated non-vacuity test file (13 tests)
- `src/mcp/vice/fixtures/c1541/not-a-disk.d64` - planted-failure fixture (plain text, wrong extension)
- `src/mcp/vice/fixtures/c1541/synthetic-corrupt.d64` - byte-patched corrupt fixture
- `src/mcp/vice/fixtures/petcat/not-basic.prg` - planted-failure fixture (64 deterministic non-BASIC bytes)
- `src/mcp/vice/fixtures/c1541/README.md`, `fixtures/petcat/README.md` - provenance, measured findings, D-25 mitigation note
- `src/skills/c64-disk-access/scripts/c1541.mjs` - `audit` subcommand, the ported detector, entry-point guard fix
- `src/skills/c64-disk-access/scripts/c1541.test.mjs` - new colocated skill test (17 tests)
- `src/skills/c64-disk-access/SKILL.md`, `CLAUDE.md` - `audit` documentation, re-cut description ("five" -> "six" capabilities)

## Decisions Made

See `key-decisions` in the frontmatter. Most consequential: using fake stand-in binaries for all six non-vacuity controls rather than the real, per-subcommand-inconsistent binary — a live measurement genuinely contradicted the plan's and the production code's own general assumption, and this was the honest, CI-safe resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, discovered during measurement] `c1541`'s exit code on failure is not uniform across subcommands, contradicting the plan's measured_inputs and host-tool.mts's own D-11 comment**
- **Found during:** Task 1, live re-verification of the plan's own measured_inputs claims against both installed VICE builds
- **Issue:** The plan states "a nonexistent image, any read verb -> ... exits 0" as a valid planted-failure input for all five `c1541.*` ids. Live measurement found `-dir`/`-entry` exit 0 on every failure input tried, but `-bam`/`-chain`/`-read` exit 1 on the SAME inputs (on this host's resolved fork build; the stock build additionally segfaults on `-entry`/`-chain`/`-read` against an unopenable image, an unrelated crash outside this plan's scope).
- **Fix:** All six controls use fake, controllable stand-in binaries reproducing the documented "exit 0 even on failure" shape, rather than the real, per-subcommand-inconsistent binary. Fully documented in both fixtures READMEs and the test file's own header.
- **Files modified:** `src/mcp/vice/host-tool-oracle.test.ts`, `src/mcp/vice/fixtures/c1541/README.md`, `src/mcp/vice/fixtures/petcat/README.md`
- **Verification:** 13/13 tests pass; the real, installed binaries' own split exit codes are recorded as a measured fact, not silently absorbed.
- **Committed in:** `c30cd4d5`

**2. [Rule 3 - Blocking] `c1541.mjs` had no entry-point guard around its CLI dispatch**
- **Found during:** Task 2, first attempt to import `c1541.mjs`'s pure functions from the new colocated test file
- **Issue:** The bottom of `c1541.mjs` ran `const [cmd, ...rest] = process.argv.slice(2); ...; await VERBS[cmd](rest);` unconditionally at module scope (a pre-existing state since 40-02, latent until something imported this file as a library). Importing the module for its exported functions executed this section with the TEST RUNNER's own `process.argv`, printed the usage banner, and called `process.exit(0)` before a single `test()` call in the importing file ever registered — silently truncating the whole suite to a false "1 test passed."
- **Fix:** Wrapped the CLI dispatch in an entry-point guard (`process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)`), matching `d64-parse.mjs`'s own existing convention exactly.
- **Files modified:** `src/skills/c64-disk-access/scripts/c1541.mjs`
- **Verification:** The CLI still runs identically stand-alone (`node c1541.mjs audit ...` verified against both fixtures); `c1541.test.mjs`'s 17 tests all register and pass.
- **Committed in:** `c426f5a7`

---

**Total deviations:** 2 auto-fixed (1 measured-assumption correction, 1 blocking bug fix). **Impact:** both were necessary for this plan's own tasks to complete honestly; neither changes the plan's declared scope. No scope creep.

## Issues Encountered

- `npm run test:automated` settles at **4 failures**, not the 2-3 documented by prior plans' own SUMMARYs. Three are consistently in `anno-register.test.ts` (`annoRegisterEntryFor`, `DIRECTION 5 (basis integrity)`, the planted-violation negative control — all citing requirement ids not declared in `.planning/REQUIREMENTS.md`); the fourth alternates between `audit-root-args.test.ts`'s `check-skill-fork-honesty` spelling case and its `30-REVIEW WR-11` shipped-skill-tree-identical case, consistent with this project's own documented scratch-file race. **Confirmed pre-existing and unrelated to this plan** by direct measurement: checked out `9a3ee17f` (the exact 40-03 tip, before any of this plan's commits) into the SAME working tree with the SAME `node_modules`, and ran `npm run test:automated` there — identical 4-failure result (3 in `anno-register.test.ts`, 1 alternating). Not fixed (out of scope, and demonstrably not caused by this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `40-05`'s skill-surface re-cut and stale skill-count prose can now account for `c64-disk-access`'s sixth capability (`audit`).
- `40-06`'s deletion of `d64-parse.mjs`/`anno-d64.ts` is unblocked by this plan: the fakery detector it carried is now ported and proven (clean + corrupt fixtures, plus a real-corpus cross-check).
- `PREP-04` is now Complete in `REQUIREMENTS.md` (both declaring plans, 40-01 and 40-04, have finished). `PREP-01` stays Pending — it is also declared by 40-05, 40-06 and 40-07, none of which have run yet (the shared-ID gate correctly keeps it open).
- No blockers for `40-05`.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/mcp/vice/host-tool-oracle.test.ts
- FOUND: src/mcp/vice/fixtures/c1541/not-a-disk.d64
- FOUND: src/mcp/vice/fixtures/c1541/synthetic-corrupt.d64
- FOUND: src/mcp/vice/fixtures/petcat/not-basic.prg
- FOUND: src/skills/c64-disk-access/scripts/c1541.test.mjs
- FOUND: src/skills/c64-disk-access/scripts/c1541.mjs (audit subcommand + entry-point guard)
- FOUND: src/skills/c64-disk-access/SKILL.md (audit section)
- FOUND commit: c30cd4d5
- FOUND commit: c426f5a7
- FOUND commit: 6b563ee4
- Acceptance criteria re-verified: `npm run typecheck` exits 0; `node --test host-tool-oracle.test.ts` reports 13/13 pass; `node --test src/skills/c64-disk-access/scripts/c1541.test.mjs` reports 17/17 pass, 0 skipped; `git ls-files -- src/mcp/vice/fixtures/c1541/not-a-disk.d64 src/mcp/vice/fixtures/petcat/not-basic.prg` reports 2; `git ls-files -- 'src/mcp/vice/fixtures/c1541/*.d64'` reports 3; `grep -al 'exitStatusOnly' *.ts *.mts | grep -v '\.test\.ts$' | wc -l` reports 0; `grep -ac spawnSync src/skills/c64-disk-access/scripts/c1541.mjs` reports 0; `node build.ts` leaves `git status --porcelain resources/` empty; `npm run test:automated` settles at 4 failing, confirmed pre-existing and unrelated to this plan via direct baseline comparison (see Issues Encountered).
