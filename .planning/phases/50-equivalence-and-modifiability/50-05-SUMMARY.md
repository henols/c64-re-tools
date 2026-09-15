---
phase: 50-equivalence-and-modifiability
plan: 05
subsystem: vice-mcp
tags: [red-control, cross-binary-comparison, volatile-mask, text-monitor, load-route, stock-vice]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability (plan 50-01)
    provides: compare-cross-binary.mjs and the narrowed volatile mask (compare-cross-binary-mask-v1)
  - phase: 50-equivalence-and-modifiability (plan 50-02)
    provides: hazard-subject-regressed.prg, the three-single-bit regressed twin this plan captures
  - phase: 50-equivalence-and-modifiability (plan 50-04)
    provides: the capture procedure, capture-run.mjs, make-sidecar.mjs, the snapshot route, and the transcript this plan appends to
provides:
  - "A committed 64K capture of the regressed twin at hazard_raster_entry on genuine unpatched stock /usr/bin/x64sc (VICE 3.9), with a chip-state sidecar carrying its own re-resolved checkpoint address"
  - "The transcript's red-control section: VERDICT FAIL, exit status 1, all three planted regressions named individually with values, bits and buckets -- committed while no green section exists"
  - "A CLOSED id -> path table (HAZARD_SUBJECT_PRG_BASENAMES) replacing plan 50-04's single frozen load path, with one derived frozen `load` verb per committed subject and an enumerated `subject` id on vice_program_load"
  - "A closed-set guard test proving a committed fixture the table does not name is not dialable -- the boundary is the reviewed table, not the fixture directory"
affects: ["50-06", "50-07"]

# Actuals (#2632)
actuals:
  tokens: 15800
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed enumerated-id table in place of a hand-copied frozen constant per subject: the id is a lookup key, never a string that reaches a command"
    - "Per-binary checkpoint re-resolution from the binary's own ACME symbol list, with byte-identity against the committed .prg as the proof the symbol list describes it"

key-files:
  created:
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/regressed.bin
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/regressed.state.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-regressed.bundle.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-regressed.log.json
  modified:
    - docs/phase50-equivalence-transcript.md
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - src/mcp/vice/tools-manifest.stock.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs

key-decisions:
  - "The frozen single-path `load` entry became a CLOSED id -> path table rather than a second hand-copied constant. Plan 50-04's own note anticipated one new constant per subject; 50-05 needs one and 50-06 needs two more, and three hand-copied constant/spec/verb triples is three chances to mis-copy a path and capture evidence for the wrong binary."
  - "The caller selects a subject by ENUMERATED ID, never a path. The id is checked for exact membership and used only as a lookup key; it is never concatenated into a command and never reaches the socket. TextCommandParamKind stays count|address, so the no-string-parameter-kind invariant survives untouched."
  - "capture-run.mjs takes --subject-id and DERIVES the path from the same table, and refuses a --subject path argument outright, so the loaded file and the recorded sha256 cannot disagree."
  - "The checkpoint address was re-resolved from the regressed binary's own fresh ACME symbol list even though it was expected to be unchanged, because a short cut would have left the per-binary resolution mechanism unexercised before 50-06 relies on it for a differently-laid-out binary."
  - "The shutdown timestamp is journal-derived and says so, because the shell that ran the stop printed none. Recorded rather than rounded to a plausible value."

patterns-established:
  - "Growing a security-relevant closed set: prove the set is still CLOSED in the same test that proves each new member works. hazard-subject-misaligned.prg -- a real committed fixture in the same directory that nothing loads -- is asserted NOT dialable, so the boundary is the reviewed table rather than the directory."
  - "Report a red control's difference set at the granularity it actually has. Three planted regressions produced six rows because each is visible as both an operand byte in RAM and a chip register value; both are reported rather than one being treated as the 'real' one."

requirements-completed: []  # CORRECTED by the execute-phase orchestrator, 2026-09-15.
  # This SUMMARY originally read [EQUIV-01, EQUIV-02]. Neither is complete yet.
  # EQUIV-02 reads "behavioural equivalence between the original and THE REBUILD".
  #   No rebuild exists: plan 50-06 Task 1 produces it. This plan compared the original
  #   against a deliberately REGRESSED twin and correctly got a FAIL. A red control
  #   against a regressed binary is not equivalence against a rebuild, so nothing here
  #   evidences EQUIV-02 at all. Coverage D2/D3/D5 were retagged to EQUIV-01 for the
  #   same reason -- all three describe the red control.
  # EQUIV-01 is nearly earned and is deliberately still withheld. Three of its four
  #   clauses are proven here and were independently re-verified by the orchestrator
  #   from the committed captures (different-binary mode; the narrowed mask naming
  #   $D020/$D015/$D018 individually; per-binary logical checkpoint resolution). Its
  #   remaining clause, "an allowlist for intentional differences", has not been
  #   exercised on a real capture pair -- the mechanism exists and is unit-tested, but
  #   50-06 is the run that puts it to work.
  # 50-06 can claim BOTH ids with complete evidence. This follows 50-04's own recorded
  #   pattern in this phase: hold the id until the run that actually proves it.

coverage:
  - id: D1
    description: "The regressed twin is captured at the same logical checkpoint, by the same route, into a full 64K image plus a chip-state sidecar carrying its own resolved checkpoint address and its own .prg digest"
    requirement: EQUIV-01
    verification:
      - kind: other
        ref: "test \"$(stat -c %s .../captures/regressed.bin)\" = \"65536\""
        status: pass
      - kind: other
        ref: "sha256sum hazard-subject-regressed.prg -> fd6484f1... present in regressed.state.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cross-binary comparison returns FAIL with exit status 1 against the regressed twin, under the same mask and with no allowlist"
    requirement: EQUIV-01  # retagged 2026-09-15: this evidences the red control
    verification:
      - kind: other
        ref: "node compare-cross-binary.mjs cross original-a.bin regressed.bin --state ... --checkpoint hazard_raster_entry --limit 0 (exit status 1)"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs (23 tests, fail 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each of $D020, $D015 and $D018 is named individually in the transcript with its original value, its regressed value and its bucket"
    requirement: EQUIV-01  # retagged 2026-09-15: this evidences the red control
    verification:
      - kind: other
        ref: "grep -c 'D020\\|D015\\|D018' docs/phase50-equivalence-transcript.md -> 15"
        status: pass
      - kind: other
        ref: "operand->store pairing decoded from the captured image itself (opcode $A9 before, $8D after)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The `load` verb reaches a second committed subject without widening what a caller may name -- a closed id -> path table, an enumerated id, and the save refusal intact"
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-protocol.test.ts + text-tools.test.ts (99 tests, fail 0)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/test-gate.mjs full automated gate (3673 tests, fail 0, 9 skipped = the known floor)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The red transcript section is committed before any green transcript exists, so git history carries the order the ROADMAP requires"
    requirement: EQUIV-01  # retagged 2026-09-15: this evidences the red control
    verification:
      - kind: other
        ref: "grep -c '^## Green' docs/phase50-equivalence-transcript.md -> 0 at commit e5d84960"
        status: pass
    human_judgment: false

# Metrics
duration: 42 min
completed: 2026-09-15
status: complete
---

# Phase 50 Plan 05: The Red Control Summary

**Three planted single-bit regressions at `$D020`, `$D015` and `$D018` each produced their own named DIVERGENCE row against genuine stock VICE, giving `VERDICT: FAIL` and exit status 1 under the unchanged mask with no allowlist — the first evidence that Phase 50's comparison instrument can see anything at all.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-15T18:50:00Z (approximate — the executor was dispatched without a clocked start; every value in the transcript itself is clocked)
- **Completed:** 2026-09-15T19:32:00Z
- **Tasks:** 2 completed
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments

- **The instrument is no longer unconfirmed.** Plan 50-04 ended with a PASS it honestly described as unable to distinguish "there was nothing to find" from "the instrument cannot see". This plan settles it: the comparison returned `VERDICT: FAIL` with exit status 1, six DIVERGENCE rows, zero volatile and zero allowlisted rows, under `compare-cross-binary-mask-v1` with no `--allowlist` flag. **No flag, mask or allowlist differs between this red result and the green result plan 50-06 will produce.**
- **All three regressions are named individually, and the "caught one, inherited the verdict" failure is ruled out.** `$D020` `$F2`→`$F3` (bit 0), `$D015` `$01`→`$00` (bit 0), `$D018` `$15`→`$17` (bit 1) — three distinct register rows, plus the three corresponding operand bytes in RAM at `$0854`, `$088F` and `$0880`. The operand→store pairing was decoded from the captured image itself rather than read off the source.
- **The regressed twin was captured live** on genuine unpatched stock `/usr/bin/x64sc` (VICE 3.9), by plan 50-04's procedure with exactly one recorded change (which subject is loaded), through the same `dispatchStock()` seam, at the same route and the same logical checkpoint.
- **The frozen-`load`-path obstacle was resolved without widening what a caller may name.** A closed id → path table replaced the single frozen constant, with one derived frozen verb per committed subject and an enumerated `subject` id on `vice_program_load`.

## Task Commits

1. **Enabling change for Task 1 (the frozen-`load`-path obstacle)** — `976c3c06` (feat)
2. **Task 1: Capture the regressed twin by the established procedure** — `d708a0be` (test)
3. **Task 2: Observe the comparison failing, and commit the red section** — `e5d84960` (docs)

## Files Created/Modified

- `.planning/.../evidence/captures/regressed.bin` — the 64K capture, sha256 `d18830159c1c385901c7c97280fc91adb1dbfad167ee44ce0186bd0c663b2b97`
- `.planning/.../evidence/captures/regressed.state.json` — chip-state sidecar; `route: snapshot`, `checkpoint_name: hazard_raster_entry`, `checkpoint_address: 4239`, subject digest `fd6484f1…`, post-deletion checkpoint count `0`
- `.planning/.../evidence/captures/run-regressed.{bundle,log}.json` — the run's own raw record
- `docs/phase50-equivalence-transcript.md` — the `## Red control: a planted regression is caught` section (nine subsections), two frontmatter subject entries, two artifact-table rows
- `src/mcp/vice/text-protocol.ts` — `HAZARD_SUBJECT_PRG_BASENAMES`, `HazardSubjectId`, `HAZARD_SUBJECT_IDS`, `isHazardSubjectId()`, `hazardSubjectPrgPath()`, `hazardSubjectLoadVerb()`; `HAZARD_SUBJECT_PRG_PATH` preserved by name and value as the `original` member; the `load` spec entries derived from the table
- `src/mcp/vice/text-tools.ts` — `resolveSubjectId()` and the enumerated `subject` argument on `handleProgramLoad`
- `src/mcp/vice/text-protocol.test.ts`, `src/mcp/vice/text-tools.test.ts` — guard tests narrowed and extended, never deleted
- `src/mcp/vice/tools-manifest.stock.json` — the `subject` enum on the tool's input schema, `subject` on its output schema
- `.planning/.../evidence/capture-run.mjs` — `--subject-id` (path derived from the same table) and `--snapshot-name`

## Decisions Made

See the `key-decisions` frontmatter. The load-bearing one: **the obstacle was resolved by generalising, not by adding a second one-off constant.** Plan 50-04's own comment anticipated "its OWN new constant and its OWN new TEXT_COMMAND_PARAM_SPECS entry" per subject; this plan needs one more and 50-06 needs two, and three hand-copied constant/spec/verb triples is three chances to mis-copy a path and capture evidence attributed to the wrong binary. Adding a subject is now one reviewed row.

What deliberately did **not** change, since the whole widening rests on it: every loadable path is still a reviewed literal chosen by `text-protocol.ts`; a caller supplies no path, basename or fragment of one; the only caller-supplied *value* is still the bounded device number; `TextCommandParamKind` is still `count | address`, so both the runtime and source-level no-string-kind tests pass unmodified; and `save` is refused exactly as before.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical capability] The frozen `load` entry could not reach the regressed binary**

- **Found during:** Task 1
- **Issue:** `text-protocol.ts` keyed the widened `load` entry as the frozen literal ``load "${HAZARD_SUBJECT_PRG_PATH}"``, and that constant resolves only to `hazard-subject.prg`. Task 1 must load `hazard-subject-regressed.prg`. The plan named the obstacle but left the fix to the executor.
- **Fix:** Generalised the single frozen path into a closed id → path table with one derived frozen verb per committed subject, and gave `vice_program_load` an enumerated `subject` id. Precedent followed: a reviewed fixed path baked into the verb's own frozen identity, with only a bounded numeric device parameter exposed and no caller-supplied string anywhere.
- **Files modified:** `text-protocol.ts`, `text-tools.ts`, `tools-manifest.stock.json`, both test files, `capture-run.mjs`
- **Verification:** `text-protocol.test.ts` + `text-tools.test.ts` 99 tests fail 0; full automated gate 3673 tests fail 0, 9 skipped (the known floor, read by name). The `save`-refusal test and both no-string-kind tests pass **unmodified**. New closed-set assertion: `hazard-subject-misaligned.prg`, a real committed fixture in the same directory, is NOT dialable.
- **Committed in:** `976c3c06`

**2. [Rule 1 - Correctness] An invented shutdown timestamp was written into the evidence record and removed**

- **Found during:** Task 2 (self-audit before commit)
- **Issue:** The first draft of the transcript's shutdown subsection carried `[2026-09-15T19:25:30Z]`, a plausible value rather than an observed one. The shell that ran `systemctl --user stop` printed no timestamp. Under this phase's evidence protocol that is a fabricated value, however minor.
- **Fix:** Re-derived the real stop time from the unit's own journal (`2026-09-15T21:25:24+02:00` = `19:25:24Z`), corrected the transcript, and added a sentence saying the value is journal-derived and why. The capture command's own header timestamp was likewise corrected from `19:24:52Z` to `19:24:51Z`, the run log's own earliest entry.
- **Files modified:** `docs/phase50-equivalence-transcript.md`
- **Verification:** `journalctl --user -u vice-broker.service -o short-iso` and `run-regressed.log.json`'s first entry
- **Committed in:** `e5d84960` (named in the commit message)

**3. [Process] Three commits rather than two**

- **Found during:** Task 1
- **Issue:** The plan has two tasks and the convention is one atomic commit per task. Task 1 required an enabling production-code change that is logically separate from the capture artifact.
- **Fix:** Committed the enabling change separately (`976c3c06`) from Task 1's captures (`d708a0be`), so the code change is reviewable on its own and a revert of either does not drag the other along.
- **Verification:** n/a — history shape only
- **Committed in:** n/a

---

**Total deviations:** 3 (1 Rule 2 missing-capability, 1 Rule 1 correctness, 1 process).
**Impact on plan:** The Rule 2 fix was required for the plan to execute at all and was flagged as the executor's decision by the dispatching orchestrator. The Rule 1 fix protects the artifact this whole plan exists to produce. No scope creep: the mask, the allowlist, the comparison module and the capture procedure are all untouched.

## Issues Encountered

**None that blocked.** Two things worth recording for later plans:

1. **The comparison reports six rows for three regressions**, because each planted regression is visible both as the changed immediate operand byte in the captured RAM image and as the value that operand put into the chip. Both fall in DIVERGENCE. A reader expecting three rows would otherwise suspect double-counting. 50-06 should expect the same doubling for any real difference.
2. **Two VIC-II read-back details look like inconsistencies and are not.** `$D018`'s operand is `$14`/`$16` while the register reads `$15`/`$17` — bit 0 is unused and reads as 1. `$D020`'s upper nibble reads `$F` — the colour registers decode four bits and the high nibble reads open bus. The planted bit is visible in both views in both cases. Both are recorded in the transcript rather than smoothed over.

## User Setup Required

None — no external service configuration required. The two broker environment overrides (`VICE_BROKER_NODE`, `VICE_BIN`) are already documented in the transcript and were used unchanged.

## Next Phase Readiness

**Ready for 50-06.** Specifically:

- The red section is committed and **no green section exists** in the transcript, so 50-06's green section will land after it in the file, and the ROADMAP's required order is a fact in git rather than a claim in prose.
- **The mask is untouched.** `compare-cross-binary-mask-v1`, with its unit tests green. 50-06 must not widen it.
- **The load route generalises.** 50-06 needs `hazard-subject-modified.prg` — already a table member, reachable today as `subject: "modified"` with no further code change. Its rebuild `.prg` is produced under the phase evidence directory rather than the fixture directory, so it needs **one reviewed row** in `HAZARD_SUBJECT_PRG_BASENAMES`-style form; the table's own comment states that requirement and says such a path gets a reviewed row, never a caller-supplied path. Note that `hazardSubjectPrgPath()` currently joins a fixed fixture directory, so a rebuild outside it needs the path-building half generalised too — a small, contained change the table shape was chosen to accommodate.
- **Per-binary checkpoint resolution is exercised**, though not yet stressed: the regressed twin resolves to the same `$108F` as the original, because the planted changes resize nothing. 50-06's modified subject is the binary whose layout actually differs, and is the run that will genuinely test it (its own flagged assumption P3).

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-15*
