---
phase: 23-the-real-release-gate-go-degrade-no-go
plan: 03
subsystem: testing
tags: [vice, c64, capture, corpus, provenance, checkpoint, reproducibility, bruce-lee]

requires:
  - phase: 23-the-real-release-gate-go-degrade-no-go
    provides: "23-01's frozen DECISION-RULE.md and SCHEMA.md — the pre-committed rule R1 and the outcome-line vocabulary this plan emits into"
provides:
  - "Two named, hashed, independently-cracked releases of Bruce Lee (Datasoft, 1984) on this host, identified by release id plus sha256, neither committed (D-04)"
  - "The loader/game handoff address $1BC2, found by disassembling the running machine and re-verified per release on that release's own fresh machine (D-06 satisfied by construction)"
  - "Per-release chip state at the handoff instant, read in one paused window: $01=$35, $DD00=$C1, $D018=$33 -> vic_bank 2 / screen_base $8C00 / charset_base $8800, sprite pointers, PAL raster 311"
  - "C0_CORPUS: partial — rule R1's only input, on disk with the aggregation rule reproduced above it"
  - "A measured diagnosis of the single blocking defect: the fork's stopping exec checkpoint is neither instruction-exact nor frame-exact"
  - "Three VICE snapshots of the handoff instants, outside the checkout, each proven faithful on reload"
affects: [23-05 inventory, 23-06 provenance, 23-07 criterion1, 23-08 criterion2, 23-09 criterion3, 23-10 findings]

actuals:
  tokens: 27000
  tasks: 3
  commits: 10

tech-stack:
  added: []
  patterns:
    - "Poll a checkpoint's hit_count, never paused state — and on this backend resume EXPLICITLY whenever hit_count reads zero, because every read call leaves the machine paused and only vice_ping reports it"
    - "Bank a reached instant as a VICE snapshot before doing anything else with it, then prove the snapshot faithful by re-reading two known bytes after reload"
    - "Prove or disprove capture equivalence with vice_memory_compare mode=snapshot when the .bin route is unavailable, and apply compare.mjs's published region-then-bit-count rule to its verbatim output rather than judging by eye"
    - "Disassemble a keypress gate before choosing the keypress route: a $DC01 poller needs vice_keyboard_matrix, a KERNAL GETIN spinner needs vice_keyboard_petscii"

key-files:
  created:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/corpus-intake.txt
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/RELEASES.json
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/handoff-identification.txt
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/capture-record-primary.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/capture-record-secondary.md
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/capture/CAPTURE-SUMMARY.txt
  modified:
    - .planning/phases/23-the-real-release-gate-go-degrade-no-go/deferred-items.md

key-decisions:
  - "C0_CORPUS is partial, not pass: no flat 64K capture was assembled and neither release's two runs compare as equivalent, so three of the aggregation rule's five conjuncts fail. R1 fires and the phase verdict is no-go — the pre-committed rule doing exactly what it was written for."
  - "SCHEMA.md's frozen value vocabulary wins over 23-03-PLAN.md's verify regex, continuing the phase-wide resolution recorded in corpus-intake.txt ACCEPTED LIMIT 2 and applied by 23-02: C0_CORPUS: partial and CAPTURE_EQUIVALENT: no are written, and the plan's regex mismatch is logged as a deviation rather than the evidence being bent to satisfy it."
  - "The capture instant is the FIRST execution of $1BC2 after a cold autostart, pinned by hit_count == 1. That definition is what makes two runs comparable in principle; the instrument's inability to honour it is what makes them incomparable in fact."
  - "Neither release's image was transcribed to a .bin: re-emitting 64K of hex through the agent truncated once outright and once silently dropped 10 characters, and nothing available catches a substituted character. Producing an unverifiable substrate was judged worse than recording the gap."
  - "Requirements PROOF-01, PROOF-02 and PROOF-03 are NOT marked complete. PROOF-01 explicitly requires the depacked flat 64K capture, and no capture exists."

patterns-established:
  - "Void records live in the transcript when there is no artifact to rename: c64-ram-capture's voiding rule names the artifact-less case, and four runs were voided that way across this plan"
  - "Separate two candidate causes by finding a corpus where only one of them is present — danish (different frames) vs saeger (same frame) isolates frame-index nondeterminism from intra-frame position"

requirements-completed: []

coverage:
  - id: D1
    description: "Two independently-cracked releases of Bruce Lee (Datasoft, 1984) on this host, identified by operator-stated release id plus sha256, directory- and BAM-parsed before booting, with exactly one flagged canonical; neither image committed"
    requirement: "PROOF-01"
    verification:
      - kind: other
        ref: "node src/skills/c64-ram-capture/scripts/compare.mjs digest <both images> (transcript in evidence/corpus/corpus-intake.txt § 1)"
        status: pass
      - kind: other
        ref: "node src/skills/c64-ram-capture/scripts/d64-parse.mjs directory|bam --json (transcript in evidence/corpus/corpus-intake.txt § 2)"
        status: pass
      - kind: other
        ref: "git status --porcelain | grep -E '\\.(bin|d64|prg|t64|crt)$' -> none"
        status: pass
    human_judgment: false
  - id: D2
    description: "The loader/game handoff is $1BC2, the head of the game's own frame loop, identified by emulator observation only and re-verified per release on that release's own fresh machine"
    requirement: "PROOF-01"
    verification:
      - kind: other
        ref: "mcp vice_disassemble $1BC2 on danish run 1 and on saeger run 1, both returning LDA #$03 / STA $48 (capture records)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-release machine state at the handoff instant, read in the same paused window as everything else: $01, $00, $DD00, $D018, sprite pointers, VIC-II state, sprites, registers"
    requirement: "PROOF-03"
    verification:
      - kind: other
        ref: "mcp vice_memory_read / vice_vicii_get_state / vice_sprite_get / vice_registers_get at each instant (capture records, Machine state tables)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A verified, reproducible flat 64K depacked capture per release, sized 65536 and hashed, proven equivalent across two runs"
    requirement: "PROOF-01"
    verification:
      - kind: other
        ref: "dump-artifacts.mjs assemble / write-set — NOT REACHED; see capture-record-primary.md § ACCEPTED LIMIT 1"
        status: fail
    human_judgment: true
    rationale: "Not delivered. The 64K image was never assembled, so CAPTURE_SHA256 and CAPTURE_SIZE are could-not-run and both releases' runs are voided as captures. Two of the plan's acceptance criteria are therefore unmet and a human must decide whether the recorded diagnosis is a sufficient substitute or the plan must be re-run with a frame-exact stop."
  - id: D5
    description: "C0_CORPUS on disk as rule R1's only input, with the aggregation rule reproduced above it and walked through the recorded values"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "grep -cE '^C0_CORPUS: (pass|partial|could-not-run)$' evidence/capture/CAPTURE-SUMMARY.txt -> 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "A measured diagnosis of why the captures are not reproducible: the fork's stopping exec checkpoint is neither instruction-exact nor frame-exact, and frame-index nondeterminism is the dominant cause"
    verification:
      - kind: other
        ref: "danish: hit_count 1 vs 2, 100 non-volatile multi-bit differences. saeger: hit_count 1 vs 1, exactly one ($00F6). Both vice_memory_compare outputs verbatim in the capture records."
        status: pass
    human_judgment: false
  - id: D7
    description: "Four voided runs recorded rather than summarised away: epoch drift, broker death, a run that blew past the instant into attract mode, and both releases' capture runs"
    verification:
      - kind: other
        ref: "handoff-identification.txt § 2 and § 2b; capture-record-primary.md Calibration run C and Run 1 attempt 1; both records' Verdict sections"
        status: pass
    human_judgment: false

duration: 1h 55m
completed: 2026-08-26
status: complete
---

# Phase 23 Plan 03: Corpus, Capture and the Gate Input Summary

**Two independently-cracked Bruce Lee releases secured and driven to the same `$1BC2` frame-loop handoff, where the fork's stopping checkpoint proved neither instruction- nor frame-exact — so `C0_CORPUS: partial`, R1 fires, and the defect is measured rather than guessed.**

## Performance

- **Duration:** 1h 55m (this session; the plan also consumed two earlier interrupted sessions, both voided)
- **Started:** 2026-08-26T13:00Z (continuation dispatch)
- **Completed:** 2026-08-26T14:55Z
- **Tasks:** 3 of 3
- **Files created/modified:** 7

## Accomplishments

- **The corpus is secured and identified without entering the repository.** Two operator-supplied, independently-cracked releases of Bruce Lee (Datasoft, 1984) — `danish` and `saeger` — hashed with `compare.mjs digest`, directory- and BAM-parsed with `d64-parse.mjs` before anything booted, registered in a scratch `RELEASES.json` with exactly one `canonical: true`, and neither image committed (D-04). The canonical designation was fixed by a rule stated before any measurement existed.
- **The handoff is established as a fact, not an assumption.** `$1BC2` is the head of the game's own frame loop, found by disassembling the running machine (`$1C36`'s unconditional `JMP $1BC2` closes the loop, `$1BC4`'s frame-counter reload opens it) and **re-verified by disassembly on each release's own fresh machine**. No fact used here came from dxa or Ghidra (D-06).
- **Both releases were driven to that handoff and read in one paused window each.** `$01 = $35` on both — BASIC *and* KERNAL banked out, so the live vector pair is the RAM one, which is precisely the field criterion 3 needs. `$DD00 = $C1` and `$D018 = $33` on both, giving `vic_bank 2`, `screen_base $8C00`, `charset_base $8800`, identical sprite-pointer bytes, and PAL raster 311. Two releases with different disk layouts and different keypress mechanisms arrive at the same game state at the same handoff.
- **The blocking defect is measured, and its cause isolated.** The fork's stopping exec checkpoint reports the hit but pauses roughly a frame of work later, at a wall-clock-determined instruction, and can straddle a frame boundary. `vice_run_until` inherits the same mechanism; `vice_execution_step` advances nothing observable. `danish`'s two runs landed in *different* frames and diverge at 100 non-volatile multi-bit addresses; `saeger`'s both landed in frame 1 and diverge at exactly **one** — `$00F6`, the KERNAL's keyboard-decode-table pointer. That contrast separates frame-index nondeterminism (structural, dominant) from intra-frame position (41 one-bit drifts, all passing).
- **`C0_CORPUS: partial` is on disk with its aggregation rule reproduced and walked through**, so a reader re-derives the value instead of taking it on trust. Rule R1 fires; the phase verdict is `no-go`, which is the pre-committed rule doing what it was written for.
- **Four voided runs are recorded, none summarised away**: epoch drift, broker death, a run that blew past the instant into attract mode, and both releases' capture runs.

## Task Commits

1. **Task 1: operator places both releases and names the canonical one** — `checkpoint:human-action`, `blocking-human`. Answered before this session; no commit of its own, transcribed verbatim into `corpus-intake.txt`.
2. **Task 2: intake — identity, hashes, directory parse, scratch registry** — `be44890` (docs)
3. **Task 3: depack by running, capture, prove reproducibility** — nine commits, banked incrementally per the crash discipline:
   - `b7742a1` — identify the handoff at `$1BC2` by disassembly
   - `5005c6f` — record the broker-death void as `handoff-identification.txt` § 2b
   - `2fb7736` — the checkpoint-stop imprecision calibration
   - `9df632f` — void danish run 1 and record the procedure correction
   - `6c8d5e8` — danish runs 1 and 2 at the handoff
   - `308c566` — complete the danish record: comparison, verdict, accepted limits
   - `e18c809` — the saeger record, and the separation of the two failure causes
   - `a09959b` — emit `C0_CORPUS`
   - `4075cd5` — log the load-sensitive `npm test` flake set as deferred

## Files Created/Modified

- `evidence/corpus/corpus-intake.txt` — per-release identity, sha256, verbatim `d64-parse.mjs` output, the canonical rule, the independence claim at the strength the evidence supports, and the scratch-registry rationale
- `evidence/capture/RELEASES.json` — the scratch release registry; `canonical` true on exactly one of two entries
- `evidence/capture/handoff-identification.txt` — how `$1BC2` was found, plus the two pre-capture voids (§ 2 epoch drift, § 2b broker death)
- `evidence/capture/capture-record-primary.md` — `danish`: calibration run, voided run, runs 1 and 2, the verbatim comparison, the resolved verdict checklist, and both accepted limits
- `evidence/capture/capture-record-secondary.md` — `saeger`: the GETIN gate discovery, runs 1 and 2, the one-byte divergence, and the single disarm-and-resume record for the plan
- `evidence/capture/CAPTURE-SUMMARY.txt` — every outcome line plus `C0_CORPUS`
- `deferred-items.md` — item 3, the load-sensitive `npm test` flake set

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one: **the 64K images were not transcribed.** The plan's route requires the agent to re-emit every byte it fetched, because the MCP surface returns text and only text. That re-emission failed twice in seven attempts — one 32 KB write truncated mid-payload, one 8 KB write silently lost 10 characters and was caught only by an explicit length assertion. Nothing available catches a *substituted* character. Four images are 32-64 such writes, and one undetected substitution would put a wrong byte into the substrate every later criterion is measured on — displacing `dump-artifacts.mjs`'s own assertions one step upstream to where they cannot see it. Recording the gap was judged strictly better than shipping an unverifiable substrate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Every read call leaves this backend paused, and only `vice_ping` reports it**
- **Found during:** Task 3, danish run 1 attempt 2
- **Issue:** `vice_checkpoint_list` and `vice_display_screenshot` leave the machine paused and nothing resumes it. A "wait and poll" loop therefore *stops* the emulator instead of observing it — the machine sat paused for three minutes while the transcript recorded `hit_count 0` and a black screen. This also explains run 1 attempt 1's failure, where the unimpeded machine blew past the instant into attract mode.
- **Fix:** the poll loop was rewritten to read `hit_count` first and resume **explicitly** whenever it reads zero — which is safe precisely because the hit count says the instant has not arrived. The documented invariant ("poll on hit_count, never on paused state") is preserved and made operable.
- **Files modified:** `capture-record-primary.md` (the correction is recorded in the transcript where it was found)
- **Verification:** every subsequent run reached `hit_count >= 1`; four of four.
- **Committed in:** `6c8d5e8`

**2. [Rule 3 - Blocking] The two releases need different keypress routes**
- **Found during:** Task 3, saeger run 1
- **Issue:** `vice_keyboard_matrix` — which works on danish — did not advance the saeger intro.
- **Fix:** the wait loop was disassembled rather than retried blind: `$08F0-$08FB` banks the KERNAL in and spins on `JSR $FFE4` (GETIN) comparing against `#$20`, so it reads the KERNAL buffer, not the matrix. Driven with `vice_keyboard_petscii [32]`.
- **Files modified:** `capture-record-secondary.md`
- **Verification:** both saeger runs reached `hit_count == 1` after the PETSCII feed.
- **Committed in:** `e18c809`

**3. [Rule 3 - Blocking] `dist/` used as the screenshot staging path**
- **Found during:** Task 3, danish calibration run
- **Issue:** the `vice` surface refuses absolute paths outside the mounted workspace, so a screenshot cannot be written straight to `PROBE_DIR`; a previous session had left a stray `shot.png` in `evidence/corpus/`, which that directory's `.gitignore` does not cover.
- **Fix:** screenshots written to the repository-root-gitignored `dist/` (`git check-ignore -v dist/shot.png` → `.gitignore:38:dist/`) and moved to `PROBE_DIR` immediately; `dist/` removed at the end.
- **Verification:** `git status --porcelain` carries no image under the phase directory.
- **Committed in:** `6c8d5e8` (recorded in the transcript)

### Accepted limits recorded rather than worked around

- **`C0_CORPUS`/`CAPTURE_EQUIVALENT` vocabulary.** The plan's automated `<verify>` regex encodes `(pass|fail|could-not-run)` for both lines; `SCHEMA.md` § 3 declares `pass|partial|could-not-run` and `yes|no|could-not-run`, frozen before any measurement existed, and the plan's own regex would reject the schema-legal `yes`. The phase-wide resolution (operator-confirmed, recorded in `corpus-intake.txt` ACCEPTED LIMIT 2, already applied by 23-02 to four divergences of the same kind) is that **SCHEMA.md wins**. Consequence: **the plan's `<verify>` block does not pass as written.** No rule input is affected — R1 fires on "`c0_corpus` is not `pass`", identical under either vocabulary.
- **`WarpMode` cannot be set.** `vice_machine_config_set` declares `resources` as a JSON string in its own schema while the host server requires a JSON object. Every run was real-time: ~110 s to the intro gate and ~30-90 s more to the handoff, across seven boots. No `x64sc` was invoked by hand and none of the three power-cycling resources was set at any point.
- **The 64K image could not be assembled.** See `capture-record-primary.md` § ACCEPTED LIMIT 1 for the per-attempt table.

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking), 3 accepted limits recorded.
**Impact on plan:** the three auto-fixes were each necessary to reach the handoff at all and each was found by observation rather than by retrying blind. The accepted limits are the plan's negative result, and the plan's own prohibition — *"A negative, partial or could-not-run outcome must NOT be summarised away"* — is what they satisfy.

## Issues Encountered

**Two acceptance criteria are not met, and neither is glossed:**

1. *"Every release has a `CAPTURE_SIZE:` line ending in 65536, a 64-hex `CAPTURE_SHA256:` …"* — **not met.** Both are written `could-not-run`. `CAPTURE_HANDOFF_PC` (`$1BC2`) and `CAPTURE_PORT01` (`$35`) *are* met, for both releases.
2. *"The comparison between the two runs of each release is present verbatim, and `CAPTURE_EQUIVALENT` matches the comparison tool's own result"* — **met in substance, not in tool.** Both comparisons are present verbatim and both values are a comparison tool's own result, but the tool is `vice_memory_compare mode=snapshot`, not `compare.mjs compare`, because the latter needs the two `.bin` files that were never written. `compare.mjs`'s published region-then-bit-count rule was applied to that output without reclassifying any difference into a class it does not belong to.

**The regression gate is not clean, and it is not this plan's doing.** The full `npm test` was run four times: fail counts 1, 4, 1, 1, with 2592/2638 passing every run and the *identity* of the failures changing between runs (`159`, `916`, `2408`, `2410` observed). That is the flake signature, logged as `deferred-items.md` item 3. This plan touches only `.planning/`, so no failure can be attributed to it. The Phase 18 evidence file the suite rewrites was restored with `git checkout --` per the documented hazard.

**Requirements are deliberately left unmarked.** `PROOF-01` explicitly requires *"the named real release … and its depacked flat 64K capture"*. No capture exists, so `requirements-completed` is empty and `requirements.mark-complete` was not called. Marking them would put a false `Complete` into REQUIREMENTS.md ahead of phase verification, which is the exact failure the shared-ID gate exists to prevent.

## Next Phase Readiness

**Rule R1's input is on disk and the phase can be verdicted right now.** `C0_CORPUS: partial` → R1 matches → `no-go`. R1's own text names the consequence, and this plan does not narrow or re-scope anything: `DECISION-RULE.md` is frozen and 23-10 owns the findings document.

**What the downstream measuring plans should know.** Criteria 1, 2 and 3 all read the depacked capture as their substrate (D-03), and no capture exists — so 23-06 through 23-09 have no substrate to measure. They should not be dispatched against a fixture in its place; that substitution is the defect `PROOF-01` exists to remove.

**What a re-run would not have to redo**, all recorded in `CAPTURE-SUMMARY.txt`: the corpus identity and hashes, the `$1BC2` handoff and its per-release verification, the chip state at the instant, the two distinct keypress routes, and three faithful snapshots of the handoff instants (`danish_r1_handoff`, `danish_r2_handoff`, `saeger_r1_handoff`).

**The one thing that must change.** A frame-exact stop. Candidates, none of them tried here because none is reachable from this surface as it stands: `CPUHISTORY_GET`-backed cycle-exact positioning, a snapshot-assisted binary search over `vice_execution_step` (which currently advances nothing observable), or an instant chosen where the game is quiescent rather than mid-frame. Until one exists, two independent runs of an animating title screen cannot be captured at the same instant, and `compare.mjs compare` cannot pass on this corpus.

---
*Phase: 23-the-real-release-gate-go-degrade-no-go*
*Completed: 2026-08-26*

## Self-Check: PASSED (with two declared gaps)

All seven `key-files` exist on disk, and all eleven commits are in history:

```
FOUND: evidence/corpus/corpus-intake.txt            FOUND: be44890  FOUND: 308c566
FOUND: evidence/capture/RELEASES.json               FOUND: b7742a1  FOUND: e18c809
FOUND: evidence/capture/handoff-identification.txt  FOUND: 5005c6f  FOUND: a09959b
FOUND: evidence/capture/capture-record-primary.md   FOUND: 2fb7736  FOUND: 4075cd5
FOUND: evidence/capture/capture-record-secondary.md FOUND: 9df632f  FOUND: 99edd30
FOUND: evidence/capture/CAPTURE-SUMMARY.txt         FOUND: 6c8d5e8
FOUND: 23-03-SUMMARY.md
```

`must_haves.artifacts` minimum line counts, all exceeded:
`corpus-intake.txt` 1090 (min 30), `capture-record-primary.md` 662 (min 40),
`capture-record-secondary.md` 293 (min 40), `CAPTURE-SUMMARY.txt` 152 (min 20).

Prohibition checks:
- `grep -cE '^C0_CORPUS: (pass|partial|could-not-run)$'` → **1** (exactly one line).
- `git status --porcelain | grep -E '\.(bin|d64|prg|t64|crt)$'` → **none**. No image and
  no capture is committed or staged.
- `git diff --name-only` across this plan's commits touches only `.planning/`.
- Nothing under `src/` was created or modified; the three skill scripts were invoked
  as they stand and never edited.

**Declared gap 1 — the plan's own Task 3 `<verify>` does not pass.** Its regex requires
`^C0_CORPUS: (pass|fail|could-not-run)$` and `^CAPTURE_EQUIVALENT: .+ (pass|fail|could-not-run)$`;
the file carries the SCHEMA.md-legal `partial` and `no`. This is the phase-wide vocabulary
resolution, not an oversight — see `## Deviations` and `corpus-intake.txt` ACCEPTED LIMIT 2.

**Declared gap 2 — two acceptance criteria are unmet**, as set out under
`## Issues Encountered`: no 64-hex `CAPTURE_SHA256` / `CAPTURE_SIZE: 65536`, and the
two-run comparison ran through `vice_memory_compare` rather than `compare.mjs compare`.
