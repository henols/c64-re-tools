---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 01
subsystem: testing
tags: [skills, licensing, attribution, third-party-notices, npm-packaging, regenerator2000, stdio, measurement]

# Dependency graph
requires:
  - phase: 18-persistent-session-and-tool-surface
    provides: "the coarse FIFO mutex at r2000-session.ts (18-06) whose deferred reader-writer upgrade this plan measures and closes; the evidence-artifact template (18-STDIN-EOF-EVIDENCE.md) and driver shape this plan's measurement copies"
  - phase: 11-r2000-annotation-surface
    provides: "CURATED_R2000_TOOLS / R2000_TOOL_DEFINITIONS in r2000-tools.ts, the curated surface every absorbed tool reference is checked against; the D-11 live-gate pattern in r2000-test-gate.ts"
provides:
  - "src/skills/routine-queue-walker/ — the seventh skill, absorbed from regenerator2000's r2000-analyze-program at a verified 40-hex pin, attributed, curated-tools-only, carrying none of upstream's parallel fan-out"
  - "The installer skill count asserted as a RELATION against topLevelSkillDirs(src/skills) plus a >=6 floor — adding an eighth skill no longer turns CI red"
  - "Truthful notices in both THIRD-PARTY-NOTICES.md files: a new Incorporated-material section for the five pinned procedures (paths, digests, byte counts, MIT election) and the narrowed not-incorporated claim"
  - "skill-attribution.test.ts — the frozen-registry attribution guard plans 19-02 and 19-03 add rows to"
  - "A sharpened r2000-upstream-audit.test.ts plus a manifest carrying per-call justifications, cited upstream lines, and three re-sync triggers with mechanisms"
  - "19-STDIO-MULTIPLEXING-EVIDENCE.md — D18-16 closed by measurement"
affects: [19-02, 19-03, 19-04, 19-05, phase-20-decompilation, phase-21-rebuild]

actuals:
  tokens: 31834
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Frozen registry with a proven-to-bite absence predicate (skill-consumer-paths.test.ts discipline) applied to licence attribution"
    - "Live-gated third-party-source re-hash: SKIP without R2000_UPSTREAM_CLONE, hard FAIL under VICE_REQUIRE_R2000_UPSTREAM (D-11 shape)"
    - "Census assertions as relations against a shared corpus primitive rather than literals"

key-files:
  created:
    - src/skills/routine-queue-walker/SKILL.md
    - src/mcp/vice/skill-attribution.test.ts
    - scripts/lib/skill-corpus.d.mts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-STDIO-MULTIPLEXING-EVIDENCE.md
  modified:
    - scripts/check-npm-packages.mjs
    - src/mcp/vice/THIRD-PARTY-NOTICES.md
    - THIRD-PARTY-NOTICES.md
    - CLAUDE.md
    - src/mcp/vice/r2000-upstream-audit.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json

key-decisions:
  - "This project elects MIT from regenerator2000's dual MIT OR Apache-2.0 for all absorbed prose — it matches this repository's own licence, so incorporated text and host carry identical terms, and the Apache-2.0 §4(b) modification notice is discharged anyway by every per-file header's ADAPTED, NOT VERBATIM statement plus its named deviations"
  - "The attribution header names its upstream source WITHOUT the literal `.agent/skills` path, because ABS-01's absence guard is a plain token grep over src/skills/ — the full upstream path is recorded once, in the manifest under .planning/, which is not scanned"
  - "The notices table carries a per-path 'Incorporated as of this commit' column rather than claiming all five are absorbed, so the section is true at every intermediate commit of the phase rather than only at the end"
  - "The installer skill-count pin became a relation plus a >=6 floor, not a 6→7 bump: a bump would go red again on the eighth skill, which is exactly the failure it was fixing"
  - "D18-16 is CLOSED, not re-deferred: three measured runs plus the upstream source (handle_request called synchronously on &mut AppState in stdio.rs's read_line loop) show the child does not multiplex, so a reader-writer upgrade would buy zero parallelism and the coarse FIFO mutex is an exact model of the child rather than a compromise"
  - "The stdio measurement scores same-millisecond arrival as SERIAL, not as multiplexing — a trivial request answered 1ms after the batch ahead of it is a queue draining, not concurrency"

patterns-established:
  - "Per-file licence attribution as an HTML comment immediately after the frontmatter: six named provenance fields plus an explicit adaptation statement and named deviations, mechanically checked against the pinned manifest"
  - "Absence guards proven non-vacuous against a planted violation held IN MEMORY, never written into src/skills/ — the working tree is never left dirty between runs"
  - "A .d.mts declaration sibling is what lets a src/mcp/vice/*.test.ts import a scripts/lib/*.mjs helper under strict mode (third instance of the pattern)"

requirements-completed: [ABS-01, ABS-02, ABS-04]

coverage:
  - id: D1
    description: "The seventh skill src/skills/routine-queue-walker/SKILL.md exists, absorbed from a verified pinned upstream commit, references only curated r2000_* tools, names no upstream agent-skills path, and carries none of upstream's parallel fan-out"
    requirement: ABS-01
    verification:
      - kind: integration
        ref: "node scripts/check-skill-tool-coverage.mjs (OK — 7 skill directories, 13 distinct r2000_* names, all curated)"
        status: pass
      - kind: integration
        ref: "node scripts/check-skill-fork-honesty.mjs (OK — 31 files in 7 skill directories, all section-scoped-compliant)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#no file under src/skills/ tells a reader to read an upstream agent-skills path"
        status: pass
    human_judgment: false
  - id: D2
    description: "The installer skill count is asserted as a relation against src/skills/, with a non-vacuity floor, so a growing skill inventory no longer turns packaging CI red"
    requirement: ABS-01
    verification:
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs (OK — @henols/c64-re-tools 32 files, 7 skills)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both THIRD-PARTY-NOTICES.md files are true after absorption: a new Incorporated-material section names the repository, the 40-hex pin, all five source paths with digests and byte counts, the dual licence and the MIT election; the blanket not-incorporated claim is narrowed to the binary's own implementation"
    requirement: ABS-02
    verification:
      - kind: other
        ref: "grep -c 'No regenerator2000 source' src/mcp/vice/THIRD-PARTY-NOTICES.md == 0; grep -c 'MIT OR Apache-2.0' >= 1; all five upstream source paths present; landed in the SAME commit (f59459c) as the first absorbed SKILL.md"
        status: pass
    human_judgment: true
    rationale: "A licence election published in two npm tarballs is a legal claim, not a test outcome. The mechanical checks prove the strings are present and the falsified claim is gone; whether the election and the adaptation statement are the right ones to publish is a human call."
  - id: D4
    description: "skill-attribution.test.ts holds the attribution chain shut: per-row six-field presence, header-vs-manifest commit and digest equality, the adaptation statement, corpus-wide absence of upstream agent-skills paths, and its own registry asserted non-empty"
    requirement: ABS-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts (6 tests, all pass; emptying ABSORBED_FILES demonstrated to exit non-zero, then restored)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The manifest carries a cited justification per non-curated upstream call and named re-sync triggers with mechanisms; r2000-upstream-audit.test.ts rejects an abbreviated or floating ref and re-hashes the five sources when a clone is reachable"
    requirement: ABS-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-upstream-audit.test.ts (5 tests; abbreviating the manifest commit to 7 chars demonstrated to exit non-zero, then restored)"
        status: pass
      - kind: integration
        ref: "R2000_UPSTREAM_CLONE=~/.cache/c64-re-tools/regenerator2000-pin VICE_REQUIRE_R2000_UPSTREAM=1 node --experimental-strip-types --test r2000-upstream-audit.test.ts (5/5 pass, 0 skipped — five digests re-hashed byte-exact); with a nonexistent clone and the same opt-in, exit 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "D18-16's deferred measurement executed against the real binary and recorded with its command sequence, run table, raw JSON and the upstream source citation"
    verification:
      - kind: integration
        ref: "node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs — 3 runs, all verdict serial-one-request-at-a-time; R2000_BIN=/nonexistent-binary exits 1 with a non-empty reason"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-24
status: complete
---

# Phase 19 Plan 01: Absorbed Procedures — the First Procedure End to End Summary

**The seventh skill `routine-queue-walker` lands absorbed from regenerator2000 @`493f840…` with a six-field attribution header, the packaging guard now asserts a relation instead of the literal six, both notices files are true in the same commit, two mechanical guards hold the attribution chain shut (each proven to fire), and D18-16 is answered by a three-run measurement showing the stdio child does not multiplex.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-24T15:30Z (approx.)
- **Completed:** 2026-08-24T16:13Z
- **Tasks:** 3 of 3
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments

- **One absorbed procedure, end to end.** `src/skills/routine-queue-walker/SKILL.md` (218 lines) absorbs upstream's `r2000-analyze-program` *sequencing* — queue construction, the two refresh points, the no-premature-halting rule, the 7.5 entropy gate citing the curated `entropy` field, the explicit-address discipline — and **none** of its concurrency. All three of upstream's runtime instructions to read a file inside its own excluded agent-skills directory are rewritten to this project's skill paths; the cursor-based entry route is replaced by explicit address input plus `r2000_read_region`; the destructive unpack step is re-routed to `c64-ram-capture` plus the packer finding. Every `r2000_*` name in the file is curated.
- **The packaging pin became a relation.** `scripts/check-npm-packages.mjs` no longer pins `skillMds.length` to a literal; it computes the set of `src/skills/` subdirectories carrying a `SKILL.md` via the shared `topLevelSkillDirs()` primitive and asserts tarball-count == set-size, with a separate `>= 6` floor so a broken directory read cannot make the equality vacuously true on two zeros.
- **Both notices files are true, in the same commit as the first absorbed file.** A new `## Incorporated material — regenerator2000 analysis procedures (MIT OR Apache-2.0)` section names the repository, the 40-hex pin with its date and the `.cargo_vcs_info.json` corroboration, all five source paths with sha256 digests and byte counts, the 53,392-byte total, the ADAPTED-NOT-VERBATIM statement, and the MIT election with its reasoning. The old blanket "No regenerator2000 source … is included" claim is narrowed to the binary's own implementation and scoped explicitly.
- **Two mechanical guards, each demonstrated to fire.** `skill-attribution.test.ts` (new, frozen registry) and a sharpened `r2000-upstream-audit.test.ts`. Abbreviating the manifest commit to 7 characters turns the audit red; emptying the registry turns the attribution suite red. Both were restored.
- **D18-16 closed by measurement.** Three runs at two batch sizes: a trivial `r2000_get_binary_info` sitting in the child's stdin pipe alongside a slow batch waited 5938ms, 5949ms and 13040ms, arriving 1–3ms **after** the batch ahead of it. Doubling the batch doubled the wait. Corroborated by the upstream source, where `handle_request` is called synchronously on `&mut AppState` inside `read_line`'s loop body.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end — the seventh skill lands attributed, curated, packaged, and green** — `f59459c` (feat)
2. **Task 2: Mechanical guards — attribution headers, absent upstream runtime reads, and a sharpened audit** — `f645485` (test)
3. **Task 3: Measure and record the stdio-multiplexing answer that closes D18-16** — `5545800` (docs)

## Files Created/Modified

**Created**
- `src/skills/routine-queue-walker/SKILL.md` — the absorbed routine/symbol-queue-walking playbook, attributed, serialised, curated-tools-only
- `src/mcp/vice/skill-attribution.test.ts` — frozen-registry attribution guard, presence + absence, absence proven to bite
- `scripts/lib/skill-corpus.d.mts` — declarations so the new test can import `walkSkills()` under strict mode
- `.planning/phases/19-.../evidence/measure-stdio-multiplexing.mjs` — the re-runnable one-burst measurement driver
- `.planning/phases/19-.../19-STDIO-MULTIPLEXING-EVIDENCE.md` — the D18-16 measurement of record

**Modified**
- `scripts/check-npm-packages.mjs` — skill count as a relation + floor; header extended with why this is the second legitimate repo-path filesystem check
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` — new incorporated-material section; opening enumeration widened; not-incorporated claim narrowed
- `THIRD-PARTY-NOTICES.md` — pointer now names the incorporated skill prose as well as the MCP package
- `CLAUDE.md` — `routine-queue-walker` row added to the Project Skills table
- `src/mcp/vice/r2000-upstream-audit.test.ts` — 40-hex pin, disposition/justification/citation assertions, resync-trigger assertions, licence-election assertion, live-gated re-hash
- `.planning/phases/19-.../upstream-procedure-manifest.json` — full SHA, licence facts, per-procedure bytes, `disposition_rationale`, `resync_triggers`

## Decisions Made

1. **MIT elected from the dual licence.** It matches this repository's own LICENSE, so incorporated prose and host carry identical terms and a downstream consumer inherits one obligation set rather than two. The Apache-2.0 §4(b) modification notice is discharged regardless by every per-file header's adaptation statement, so the election costs nothing in disclosure.
2. **The attribution header does not spell the literal upstream `.agent/skills` path.** ABS-01's absence guard is a plain token grep over `src/skills/`, so a prefixed path in a header would fail CI even inside a provenance note. The full path is recorded once, in the manifest under `.planning/`, which is not scanned. The header names the file and states that it sits in the upstream repository's excluded agent-skills directory. RESEARCH §5.4's example header spelled the literal path; the plan's own acceptance criterion (`grep -c '\.agent/skills' … returns 0`) is the one that governs, and this is how both are satisfied.
3. **The notices table carries a per-path "Incorporated as of this commit" column.** Listing all five paths satisfies the acceptance criterion; the status column keeps the section from claiming incorporation that has not happened yet, so it is true at *every* intermediate commit of the phase, not merely at the end. Plans 19-02 and 19-03 flip their own rows.
4. **Relation + floor, not a 6→7 bump.** A bump goes red again on the eighth skill — the exact failure being fixed. The floor exists because an equality between two zeros is a vacuous pass.
5. **Same-millisecond arrival scores as serial.** The driver's `multiplexes` verdict is `fastArrival < slowArrival`, strictly. A trivial request answered 1ms after the batch ahead of it is a queue draining, not concurrency, and scoring it generously would have been the one way this measurement could have produced a wrong "yes".
6. **D18-16 closed rather than re-deferred.** The deferral named measurement as its precondition; the precondition is met and the answer removes the motivation. What would reopen it is named concretely in the evidence artifact: a `tokio::spawn`/`select!` appearing in upstream's `run_headless_stdio_loop()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `scripts/lib/skill-corpus.d.mts`**
- **Found during:** Task 2 (skill-attribution.test.ts)
- **Issue:** `tsc --noEmit` failed with TS7016 — `scripts/lib/skill-corpus.mjs` had no declaration sibling, so importing `walkSkills()` from a strict-mode `.ts` test was an implicit `any`. The plan's own verify step requires `tsc --noEmit` to exit 0.
- **Fix:** Added the `.d.mts` declaration file, mirroring the two that already exist for `skill-honesty-checks.mjs` and `r2000-cli-verbs.mjs`. No runtime change; CI-only helper, deliberately outside `package.json`'s `files[]` like its `.mjs` sibling.
- **Files modified:** `scripts/lib/skill-corpus.d.mts` (new)
- **Verification:** `tsc --noEmit -p tsconfig.json` exits 0
- **Committed in:** `f645485` (Task 2 commit)

**2. [Rule 1 - Bug] Two acceptance greps still matched after the first edit pass**
- **Found during:** Task 1
- **Issue:** `grep -c '=== 6' scripts/check-npm-packages.mjs` returned 1 (the new *header comment* quoted the old assertion verbatim) and `grep -c 'No regenerator2000 source' src/mcp/vice/THIRD-PARTY-NOTICES.md` returned 1 (the narrowed sentence still opened with that exact substring). Both are the acceptance criterion's point: the falsified claim's *text* must be gone, not merely qualified.
- **Fix:** Reworded the header comment to describe the old pin in prose, and reworded the narrowed claim to "Nothing from regenerator2000's own implementation — no source code, no data table, no captured program output — is included …".
- **Files modified:** `scripts/check-npm-packages.mjs`, `src/mcp/vice/THIRD-PARTY-NOTICES.md`
- **Verification:** both greps return 0; `node scripts/check-npm-packages.mjs` exits 0
- **Committed in:** `f59459c` (Task 1 commit)

**3. [Rule 1 - Bug] One cited upstream line in the manifest was wrong**
- **Found during:** Task 2 (writing `disposition_rationale`)
- **Issue:** The `r2000_unpack_binary` entry listed `.agent/skills/r2000-analyze-program/SKILL.md:33` among its sites, but line 33 does not contain the token. An audit record whose citations do not check out is worse than none.
- **Fix:** Verified every cited line with `grep -nE` against the pinned clone and dropped `:33`. All remaining citations were confirmed present at the cited line.
- **Files modified:** `.planning/phases/19-.../upstream-procedure-manifest.json`
- **Verification:** `grep -nE 'r2000_(toggle_splitter|undo|set_immediate_format|unpack_binary|get_disassembly_cursor)'` over all five upstream files
- **Committed in:** `f645485` (Task 2 commit)

**4. [Rule 3 - Blocking] The upstream clone was re-established outside `/tmp`**
- **Found during:** Task 1 precondition
- **Issue:** The only clone at the pin lived at `/tmp/regenerator2000-phase19`; `/tmp` is a RAM-backed tmpfs on this host and does not survive a reboot. The plan's own precondition names this.
- **Fix:** Cloned to `~/.cache/c64-re-tools/regenerator2000-pin`, checked out `493f840418f1450a342bb220c2fe3d2585dd0525`, and confirmed all five `sha256sum` digests and all five byte counts against the manifest before absorbing anything.
- **Files modified:** none (out-of-tree)
- **Verification:** `git rev-parse HEAD` = the full pin; five digests byte-exact; the same path drives the audit test's live-gated re-hash
- **Committed in:** n/a (environment setup)

**5. [Rule 2 - Missing Critical] Rolled ABS-01 and ABS-02 back to Pending in REQUIREMENTS.md**
- **Found during:** State updates, after `requirements.mark-complete ABS-01 ABS-02 ABS-04`
- **Issue:** The executor protocol marks every ID in the plan's `requirements:` frontmatter complete. ABS-01 reads "**The five** upstream analyze procedures are absorbed"; this plan absorbs **one**. ABS-02 covers attribution for all five. Both are co-owned by plan 19-02, which absorbs the remaining four. Leaving them checked would put a claim in the project's own traceability record that the tree falsifies today — the same defect class this plan's prohibitions name for shipped docs.
- **Fix:** Reverted the ABS-01 and ABS-02 checkboxes and their traceability rows to `Pending`; 19-02 marks them when the claim becomes true. **ABS-04 stays Complete** — "a dated decision with a named re-sync trigger" is fully satisfied by the manifest's three `resync_triggers`, each with a mechanism, and by the audit test that holds them non-empty. The SUMMARY's `requirements-completed` frontmatter still lists all three, per the field's contract of copying the plan's `requirements:` list.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `grep -n 'ABS-0' .planning/REQUIREMENTS.md` — ABS-01/02/03 unchecked, ABS-04 checked, traceability rows agree
- **Committed in:** the plan-metadata commit

---

**Total deviations:** 5 auto-fixed (2 bugs, 2 blocking, 1 missing critical)
**Impact on plan:** Four were necessary to satisfy the plan's own acceptance criteria or preconditions; the fifth keeps the traceability record honest between this plan and 19-02. No scope creep; nothing was added that the plan did not ask for.

## Issues Encountered

- **One unreproduced test flake.** The first full `npm test` after Task 3 reported `# fail 1` with 2470 tests. Three consecutive re-runs reported `# fail 0` (2470 tests / 2425 pass / 40 skipped / 5 todo), and the failing subtest name was not captured before the output scrolled. The likely cause is a timing-sensitive live test racing the `regenerator2000` children the measurement driver had just been spawning and killing. **Recorded rather than dismissed**, and logged to `.planning/WINDOWS.md` as a `deviation` entry: if it recurs in a later plan of this phase, the name should be captured with `npm test 2>&1 | tee` rather than a pipeline that discards it.
- The `tsc` implicit-`any` on the `scripts/lib` import (deviation 1) was the only genuine blocker; everything else in the plan's verification chain was green first time.

## Baseline vs. final test counts

| | Tests | Pass | Fail | Skipped | Todo |
|---|---|---|---|---|---|
| Pre-phase baseline | 2460 | 2416 | 0 | 39 | 5 |
| After this plan | 2470 | 2425 | 0 | 40 | 5 |

The +10 tests are the 6 in `skill-attribution.test.ts` and the 4 added to
`r2000-upstream-audit.test.ts`; the +1 skipped is the live-gated upstream
re-hash, which SKIPs by design when `R2000_UPSTREAM_CLONE` is unset (and was
run separately, green, against the real clone).

## Known Stubs

None. The absorbed skill is complete prose with no placeholder sections, the
two guards assert real predicates over real files, and the measurement driver
runs against the real binary. The one deliberate forward reference — the
absorbed playbook points at "the packer-identity finding in
`c64-program-recon`", which plan 19-05 adds — is prose naming a documented
future step in the same phase, not an unwired code path.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema at a
trust boundary was introduced. The three surfaces this plan touches are all
covered by the plan's own `<threat_model>`: the pinned upstream fetch (T-19-01,
mitigated — 40-hex object, five digests verified before absorbing, audit test
tightened to reject a floating ref), the attribution claim travelling into two
tarballs (T-19-02, mitigated — header-vs-manifest agreement asserted, registry
asserted non-empty), and the measurement driver's child process (T-19-05,
mitigated — argv array never a shell string, every wait bounded, non-zero exit
with a reason rather than an unbounded poll).

## User Setup Required

None — no external service configuration required. The optional
`R2000_UPSTREAM_CLONE` env var (a local clone of the upstream repository at the
pin) enables the audit test's live re-hash; its absence is an expected SKIP by
design, exactly like `regenerator2000` itself under D-11.

## Next Phase Readiness

- **19-02 and 19-03** (the remaining four procedures) inherit a working chain:
  add a row to `ABSORBED_FILES` in `skill-attribution.test.ts`, flip the
  matching row in the notices table's final column, and the guards do the rest.
  The packaging relation absorbs new skill directories without edits.
- **19-04** (ABS-03 description overlap) has a seventh description to measure,
  and the `routine-queue-walker` / `c64-program-recon` pair is the known
  trigger fight — the two descriptions were deliberately written to separate
  "walk the backlog to closure" from "work out how the program is structured".
- **19-05** (SURF-03 packer finding) is already named as a destination from the
  absorbed playbook's packed-binary gate.
- **Phase 20/21** inherit two now-justified future-surface proposals recorded in
  the manifest: `toggle_splitter` (criterion: DECOMP-01, also BUILD-02) and
  `set_immediate_format` (criterion: BUILD-03). Neither is built here.
- **No blockers.**

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 5 created files exist on disk; all 3 task commits resolve in `git log`.
