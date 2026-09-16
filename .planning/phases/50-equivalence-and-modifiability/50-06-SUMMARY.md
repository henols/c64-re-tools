---
phase: 50-equivalence-and-modifiability
plan: 06
subsystem: vice-mcp
tags: [green-comparison, rebuild, modifiability, allowlist, cross-binary-comparison, stock-vice, two-session-execution]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability (plan 50-01)
    provides: compare-cross-binary.mjs, the narrowed volatile mask (compare-cross-binary-mask-v1) and the allowlist mechanism
  - phase: 50-equivalence-and-modifiability (plan 50-02)
    provides: hazard-subject-modified.prg and hazard-subject-align-nosprite.a, the one-removed / one-added subject
  - phase: 50-equivalence-and-modifiability (plan 50-03)
    provides: the PRE-REGISTERED allowlist (hazard-subject-modified.allowlist.json, committed in ca02a89c before any capture of this subject existed) and docs/phase50-modifiability-findings.md, the gate record
  - phase: 50-equivalence-and-modifiability (plan 50-04)
    provides: the capture procedure, capture-run.mjs, make-sidecar.mjs, the snapshot route and the calibrated mask
  - phase: 50-equivalence-and-modifiability (plan 50-05)
    provides: the red control (VERDICT FAIL, exit 1), committed before any green result, and the closed id -> path load table
provides:
  - "A rebuild of the committed subject produced from its own committed annotation store through importStoreDocument() -> exportAsmTree() -> verifyAcmeAssemblesTree(), with REBUILD.md recording its provenance and byte-identity as a subordinate extra"
  - "The equivalence transcript's green section: original against rebuild, VERDICT PASS, exit status 0, an EMPTY difference set, under the same mask and command shape as the red control"
  - "A committed 64K capture of the modified subject at hazard_raster_entry on genuine unpatched stock /usr/bin/x64sc (VICE 3.9), with its chip-state sidecar"
  - "docs/phase50-modifiability-transcript.md: both behaviour changes observed in a real capture, each cross-referenced to a named committed hazard finding, and the pre-registered allowlist shown carrying 32 real differences that are DIVERGENCE rows without it"
  - "A load table row that can name a path OUTSIDE the fixture directory, so a build artifact under the phase evidence directory is loadable without widening what a caller may name"
affects: ["50-07"]

# Actuals (#2632)
actuals:
  tokens: 39000   # chars/4 over the realized TEXT diff of 5046482d..HEAD (156279 chars).
                  # Excludes three binary artifacts the same diff carries: rebuild.bin and
                  # modified.bin (65536 bytes each) and hazard-subject-rebuild.prg (2281 bytes).
                  # Machine-written JSON (sidecars, run bundles, run logs: 2052 lines) dominates
                  # the text total; authored prose and code are roughly a third of it.
  tasks: 3
  commits: 4      # MEASURED: git rev-list --count 5046482d..HEAD reported 4 at SUMMARY-write
                  # time -- the three task commits plus Task 2's enabling change. The same
                  # command reports 5 after this SUMMARY's own docs commit lands.
plan_head_before: 5046482d4c1120b0d5c2224c376ee586bc3255c9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A rebuild driver that adds NO process launch of its own: make-rebuild.mjs reaches the assembler only through verifyAcmeAssemblesTree(), the one sanctioned entry point, which is also the byte-diff oracle"
    - "A .prg load-address header DERIVED from min(exportAsmTree().blocks[].start) and cross-checked against ACME's own -v2 per-segment lines, refusing rather than guessing on disagreement"
    - "A closed load table whose rows carry the WHOLE repo-relative path as reviewed segments, with the basename table derived from it rather than spelled a second time"
    - "Two comparison runs differing in exactly one flag as the proof that an allowlist is not vacuous"

key-files:
  created:
    - .planning/phases/50-equivalence-and-modifiability/evidence/REBUILD.md
    - .planning/phases/50-equivalence-and-modifiability/evidence/hazard-subject-rebuild.prg
    - .planning/phases/50-equivalence-and-modifiability/evidence/make-rebuild.mjs
    - .planning/phases/50-equivalence-and-modifiability/evidence/rebuild-run.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/rebuild.bin
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/rebuild.state.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-rebuild.bundle.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-rebuild.log.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/modified.bin
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/modified.state.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-modified.bundle.json
    - .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-modified.log.json
    - docs/phase50-modifiability-transcript.md
  modified:
    - docs/phase50-equivalence-transcript.md
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/tools-manifest.stock.json

key-decisions:
  - "The rebuild is produced by walking the real export-and-assemble path, never by copying the committed image. The committed image is read only as exportAsmTree()'s imagePath, which is where the oracle's expectedBytes come from -- built from the image, never from the exported text."
  - "Byte-identity is recorded in a subordinate `## Optional extra: byte-identity` section that states, in the same breath, that it is NOT the acceptance criterion and names behavioural equivalence with a committed transcript as what is. A reader who stops there cannot mistake it for the verdict."
  - "The load table row now carries the whole repo-relative path as reviewed segments rather than a basename plus a fixed fixture directory, because Task 1's rebuild .prg lands under the phase evidence directory. Nothing about the closure changed: the caller still supplies no path, basename, directory or fragment of one."
  - "The modified subject's checkpoint was re-resolved from ITS OWN ACME symbol list even though it turned out to be unchanged, and the MEASURED reason it is unchanged is recorded rather than left looking like luck: the modification lives inside the alignment routine's own range, which the subject pads to $1000, so it changes how much of that range is code and how much is fill and nothing about where the range ends."
  - "Two figures in the modifiability transcript were corrected against a fresh re-run before the commit rather than after it. Under this phase's evidence protocol a value that no run produces is a fabrication, however small."
  - "EQUIV-03 is deliberately WITHHELD over one clause (see requirements-completed). This follows 50-04's and the orchestrator's own pattern in this phase: hold the id rather than claim a clause no run exercised."

patterns-established:
  - "Prove an allowlist is carrying real work by running the same pair twice with exactly one flag different, and report the bucket counts from both runs side by side. 32 allowlisted rows in one run are 32 DIVERGENCE rows in the other."
  - "Attribute every reported difference to the allowlist entry that covers it, and report the per-entry row counts, so a reader can see both that nothing was left over AND that no entry sat idle."
  - "When an evidence document's claim and a re-run disagree, fix the document and name the correction in the commit message. The correction is cheaper than the doubt it prevents."

# ----------------------------------------------------------------------------
# Requirements
# ----------------------------------------------------------------------------
# CLAIMED: EQUIV-01 and EQUIV-02. WITHHELD: EQUIV-03.
#
# The plan frontmatter declares `requirements: [EQUIV-02, EQUIV-03]`. That says
# what this plan CONTRIBUTES TO, not what it completes, and it is not inherited.
#
# EQUIV-01 -- CLAIMED. Its four clauses, each against a run:
#   1. original-versus-different-binary mode: run three times live in this phase
#      (50-05's regressed twin; this plan's rebuild and modified subject).
#   2. narrowed volatile mask so a real $D020/$D015/$D018 regression cannot hide:
#      proven by 50-05's red control, which caught all three, and re-verified by
#      the orchestrator from the committed captures.
#   3. an allowlist for intentional differences: THIS is the clause the
#      orchestrator withheld the id over on 2026-09-15, and this plan is what
#      exercises it -- on a real capture pair, in BOTH directions (coverage C4).
#   4. per-binary logical checkpoints: exercised on five live captures, each
#      address read from its own binary's symbol list, that symbol list proven by
#      byte-identity to describe the committed .prg. STATED LIMITATION: all five
#      resolved to $108F, so no LIVE pair has ever carried two DIFFERENT
#      addresses. That case is covered by a synthetic unit test
#      (compare-cross-binary.test.mjs, $10C2 vs $10C5, asserting the run succeeds
#      and prints each capture's own address), and the module matches on the
#      logical NAME and never requires equal addresses. The mechanism is
#      exercised; it is not stressed. See the P3 note below.
#
# EQUIV-02 -- CLAIMED. "Behavioural equivalence between the original and the
#   rebuild is demonstrated in VICE, with a committed transcript as the artifact
#   of record rather than a described walkthrough." A rebuild now exists and came
#   from the committed annotation store through the export-and-assemble path
#   (coverage C1); it was captured live on genuine stock VICE and compared
#   against the original under the unchanged mask with no allowlist, returning
#   VERDICT PASS, exit 0, with an EMPTY difference set (coverage C2); the
#   transcript's green section is committed in 41c34e42, after the red control in
#   e5d84960. Every clause is evidenced. This is the id 50-05 could not claim
#   because no rebuild existed then.
#
# EQUIV-03 -- WITHHELD. Exactly one clause is unproven, and it is named here so
#   the orchestrator can settle it rather than re-derive it:
#     THE CLAUSE: "one behaviour removed and one added IN THE REBUILT SOURCE".
#     WHAT WAS DONE: the two behaviour changes live in
#       src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a,
#       swapped into a synthesized root by make-hazard-subject-fixtures.mjs and
#       assembled by ACME. That is the subject's own HAND-WRITTEN fixture source
#       family. It is NOT the tree exportAsmTree() emits (root.a, scope_0825.a,
#       scope_087a.a and nine siblings). No run in this phase edited an EXPORTED
#       file and reassembled it.
#     WHY IT IS ARGUABLE EITHER WAY: Task 1 measured the rebuild BYTE-IDENTICAL
#       to the committed subject, so the two source texts are byte-equivalent
#       sources of the same image; and ROADMAP criterion 4's own rider ("so the
#       demonstration touches decomposed and rebuilt code rather than an
#       already-easy already-symbolised constant") is satisfied -- both changes
#       are anchored to committed hazard findings at $088B and $0825. Under that
#       reading the id is already complete and needs no further run. Under the
#       literal reading it needs one edit made in the exported tree.
#     EVERY OTHER CLAUSE IS PROVEN: reassembled through Phase 49's gate (50-03,
#       reassembly-gate-modified-run.test.ts); both observed taking effect in
#       VICE (coverage C3); transcript committed (b37a7a34).
#     This is a judgement about what the wording means, not about missing
#     evidence, and it is the orchestrator's to make. A withheld id is cheap.
requirements-completed: [EQUIV-01, EQUIV-02]

coverage:
  - id: C1
    description: "A rebuild of the committed subject is produced from its committed annotation store through the export-and-assemble path -- importStoreDocument() into a fresh throwaway store, exportAsmTree() into a throwaway directory, verifyAcmeAssemblesTree() as the single assembler launch and the single byte-diff oracle -- and never by copying the committed image"
    requirement: EQUIV-02
    verification:
      - kind: other
        ref: "evidence/rebuild-run.json verdict block: outcome \"ok\", exit_status 0, byte_diff.equal true, 2279 bytes across 16 segments; ACME release 0.97 \"Zem\""
        status: pass
      - kind: other
        ref: "grep census over make-rebuild.mjs non-comment lines for spawn/spawnSync/exec/execFile -> 0"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts + hazard-subject-reassembly.test.ts (fail 0) -- acme-verify.ts still holds exactly one real assembler launch"
        status: pass
    human_judgment: false
  - id: C2
    description: "The original and the rebuild are captured at the same logical checkpoint by the same route and compared under the unchanged mask with no allowlist: VERDICT PASS, exit status 0, and the complete difference set is EMPTY -- volatile 0, allowlisted 0, DIVERGENCE 0, total 0"
    requirement: EQUIV-02
    verification:
      - kind: other
        ref: "node compare-cross-binary.mjs cross original-a.bin rebuild.bin --state original-a.state.json rebuild.state.json --checkpoint hazard_raster_entry --limit 0 -> VERDICT PASS, exit 0 (re-run independently 2026-09-16)"
        status: pass
      - kind: other
        ref: "test \"$(stat -c %s .../captures/rebuild.bin)\" = \"65536\"; rebuild.state.json carries route snapshot, checkpoint_name hazard_raster_entry, checkpoint_address 4239 -- the same as original-a.state.json"
        status: pass
      - kind: other
        ref: "git log: the red section landed in e5d84960, the green section in 41c34e42 -- the order ROADMAP criterion 2 requires, in history"
        status: pass
    human_judgment: false
  - id: C3
    description: "The modified subject is captured live at its own re-resolved logical checkpoint, and BOTH behaviour changes are observed in the capture: the removed sprite construction ($07F8 $41->$00, $D015 $01->$00, $D000/$D001 $64->$00, the four stores NOP'd across $0895-$08A2) and the added self-modifying construction (jsr $0839 present, smc2_operand_addr $0834 rewritten $04->$05, runtime pointer $FC/$FD = $0834, $D020 $F2->$F5). Each is cross-referenced to a named committed finding -- $088B page-alignment and $0825 self-modifying-code, both in docs/phase50-modifiability-findings.md"
    requirement: EQUIV-03   # evidences the id; the id itself is WITHHELD, see the note above
    verification:
      - kind: other
        ref: "byte reads from the two committed 64K images and their sidecars, re-derived independently 2026-09-16: $07F8 $41->$00, $0834 $04->$05, $00FC/$00FD $00/$00->$34/$08, $D015 1->0, $D020 242->245, $D000/$D001 100->0"
        status: pass
      - kind: other
        ref: "the run logs' own decoded answers agree: spriteEnabled[0] true->false, borderColour 2->5; CPU A 0->5 at the checkpoint"
        status: pass
      - kind: other
        ref: "test \"$(stat -c %s .../captures/modified.bin)\" = \"65536\"; modified.state.json checkpoint_address 4239 read from the modified binary's own symbol list, that list proven by sha256 to describe hazard-subject-modified.prg"
        status: pass
    human_judgment: false
  - id: C4
    description: "The allowlist clause of EQUIV-01 is exercised on a real capture pair in BOTH directions. The same pair, with exactly one flag different, returns VERDICT PASS / exit 0 (volatile 3, allowlisted 32, DIVERGENCE 0) with the PRE-REGISTERED allowlist and VERDICT FAIL / exit 1 (volatile 3, allowlisted 0, DIVERGENCE 32) without it. The allowlist is therefore not vacuous, and it was committed by plan 50-03 in ca02a89c before any capture of this subject existed"
    requirement: EQUIV-01
    verification:
      - kind: other
        ref: "node compare-cross-binary.mjs cross original-a.bin modified.bin --state ... --allowlist hazard-subject-modified.allowlist.json --checkpoint hazard_raster_entry --limit 0 -> exit 0 (re-run independently 2026-09-16)"
        status: pass
      - kind: other
        ref: "the same command with --no-allowlist -> exit 1, DIVERGENCE 32 (re-run independently 2026-09-16)"
        status: pass
      - kind: other
        ref: "all 32 rows attributed to their covering entry, per-entry counts measured: code range 2170..4095 -> 24, $07F8 -> 1, $FC-$FD -> 2, $0834 -> 1, $D000-$D001 -> 2, $D015 -> 1, $D020 -> 1. Nothing left over and no entry idle. No entry carries added_after_measurement, because none was added"
        status: pass
    human_judgment: false
  - id: C5
    description: "Per-binary logical checkpoint resolution is run for two further binaries (the rebuild, from its own exported tree's fresh symbol list; the modified subject, from its own synthesized root's symbol list), each proven by byte-identity against the .prg actually loaded"
    requirement: EQUIV-01
    verification:
      - kind: other
        ref: "sha256 of the freshly assembled m2.prg equals hazard-subject-modified.prg (fd16c6c1...); the rebuild's -f cbm symbol run is byte-identical to the .prg loaded, which also confirms Task 1's DERIVED load-address header"
        status: pass
      - kind: unit
        ref: "compare-cross-binary.test.mjs: two sidecars carrying DIFFERENT checkpoint addresses ($10C2 / $10C5) under one logical name succeed and print each address -- the differing-address case no live pair has produced"
        status: pass
    human_judgment: false
  - id: C6
    description: "The closed id -> path load table reaches a build artifact outside the fixture directory without widening what a caller may name: whole repo-relative paths as reviewed segments, the basename table derived from them, and the closure guards unchanged"
    requirement: EQUIV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-protocol.test.ts + text-tools.test.ts (fail 0); the save-refusal test and both no-string-parameter-kind tests pass unmodified; hazard-subject-misaligned.prg still NOT dialable"
        status: pass
    human_judgment: false
  - id: C7
    description: "The whole automated gate is green with the emulator unit stopped, after every change this plan made"
    verification:
      - kind: unit
        ref: "cd src/mcp/vice && npm run test:automated -> tests 3673, pass 3664, fail 0, skipped 9 (the known floor), exit 0, broker inactive and no x64sc process"
        status: pass
    human_judgment: false

# Metrics
duration: 100 min (across two sessions)
completed: 2026-09-16
status: complete
---

# Phase 50 Plan 06: Equivalence and Modifiability, Observed Summary

**The rebuild produced from the committed annotation store behaves identically to the original in genuine stock VICE — `VERDICT: PASS`, exit 0, and an EMPTY difference set under the same mask the red control failed against — while the modified subject's removed sprite construction and added self-modifying construction are both visible in a real 64K capture, passing only under a pre-registered allowlist that turns 32 DIVERGENCE rows into 32 allowlisted ones.**

## Performance

- **Duration:** roughly 100 min of executor time, **across two sessions**
- **Session 1 (2026-09-15):** Tasks 1 and 2 committed (`66c13f64`, `724ca605`, `41c34e42`, the last at 21:54:45+02:00), then Task 3's live capture taken (capture commands clocked 19:49:51Z–19:51:49Z; broker stopped at 19:51:17Z per the unit's own journal). **The session then ended at a rate limit, after the capture and before its commit.** Five files were left on disk, untracked.
- **Session 2 (2026-09-16):** every figure in the capture and the drafted transcript re-derived from the committed artifacts, two figures corrected, Task 3 committed (`b37a7a34` at 07:04:19+02:00), this SUMMARY written. **Nothing was re-captured and no emulator was started** — all of session 2's work is offline against committed bytes.
- **Tasks:** 3 completed
- **Files:** 18 (13 created, 5 modified)

## Accomplishments

- **The rebuild is a rebuild, not a copy.** `importStoreDocument()` → `exportAsmTree()` → `verifyAcmeAssemblesTree()`, with the committed image read only as the oracle's `imagePath`. The assembler's own verdict: `outcome "ok"`, `byte_diff.equal true`, 2279 bytes across 16 segments, exit 0, on ACME release 0.97 "Zem". No second assembler call site and no second byte comparison were added anywhere.
- **The green comparison is empty, and the transcript says so plainly.** `volatile 0, allowlisted 0, DIVERGENCE 0, total differing addresses 0, VERDICT: PASS`, exit 0, `MASK_NARROWED_AT: compare-cross-binary-mask-v1`. Nothing was absorbed because there was nothing to absorb — and that result is evidence only because `e5d84960`'s red control failed first, under the same mask, with no flag differing.
- **Byte-identity is recorded where it cannot be mistaken for the verdict.** `REBUILD.md`'s `## Optional extra: byte-identity` states the result, then states in the same section that it is not the acceptance criterion, then names behavioural equivalence with a committed transcript as what is, then says what byte-identity does and does not buy.
- **Both behaviour changes are observed, not predicted.** Removed: `$07F8` `$41`→`$00`, `$D015` `$01`→`$00`, `$D000`/`$D001` `$64`→`$00`, and the four removed stores visible as `$EA` fill across `$0895`–`$08A2`. Added: `jsr $0839` present at `$088E`, the operand byte at `smc2_operand_addr` (`$0834`) rewritten in place `$04`→`$05`, the runtime-built pointer at `$FC`/`$FD` reading `$0834`, and `$D020` `$F2`→`$F5`. Each cross-referenced to a committed finding anchor (`$088B`, `$0825`).
- **The allowlist earned its place in the only way that means anything.** The same pair, one flag apart: PASS with it, FAIL with 32 DIVERGENCE rows and exit 1 without it. All 32 rows are attributed to their covering entry with per-entry counts, and **no entry carries `added_after_measurement`, because none was added** — plan 50-03's pre-registration covered every reported difference.

## Task Commits

1. **Task 1: Produce the rebuild, and record byte-identity as an extra** — `66c13f64` (feat)
2. **Enabling change for Task 2 (a load-table row outside the fixture directory)** — `724ca605` (feat)
3. **Task 2: The green comparison, original against rebuild** — `41c34e42` (test)
4. **Task 3: The modifiability observation, one behaviour removed, one added, both seen** — `b37a7a34` (test, session 2)

## Files Created/Modified

- `evidence/REBUILD.md` — provenance: store digest `7dab6664…`, the three entry points, the exported 12-file / 16-block tree, ACME's banner and verdict, the derived `$01 $08` load-address header and how it was cross-checked, and the subordinate byte-identity section
- `evidence/hazard-subject-rebuild.prg` — 2281 bytes, sha256 `89846d48…`, identical to the committed subject's
- `evidence/make-rebuild.mjs`, `evidence/rebuild-run.json` — the driver and its own machine-written record
- `evidence/captures/rebuild.{bin,state.json}`, `run-rebuild.{bundle,log}.json` — the rebuild's 64K capture, sidecar and raw run record
- `evidence/captures/modified.{bin,state.json}`, `run-modified.{bundle,log}.json` — the modified subject's 64K capture (sha256 `72269fd1…`), sidecar (`route: snapshot`, `checkpoint_name: hazard_raster_entry`, `checkpoint_address: 4239`, post-deletion checkpoint count `0`) and raw run record
- `docs/phase50-equivalence-transcript.md` — the `## Green: the rebuild behaves like the original` section
- `docs/phase50-modifiability-transcript.md` — 511 lines: frontmatter with `allowlist_path`, the re-resolved checkpoint, the capture, `## The removed behaviour, observed`, `## The added behaviour, observed`, `## The allowlist earns its place`, the volatile bucket named rather than skipped, and a closing section stating what the document does and does not establish
- `src/mcp/vice/text-protocol.ts` / `.test.ts`, `text-tools.ts`, `tools-manifest.stock.json` — `HAZARD_SUBJECT_PRG_RELPATHS` and the derived basename table

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one for a reader of the evidence: **the two comparison runs in Task 3 differ in exactly one flag.** Same mask, same checkpoint, same row limit, same image paths, same sidecars, same module. That is what makes "the allowlist is carrying real work" a measurement rather than an assertion — and it is the same discipline that made the red/green pair mean something in Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] A transcript claim that no run supports, corrected before commit**

- **Found during:** Task 3, session 2's pre-commit re-derivation
- **Issue:** The drafted transcript read "Two of the allowlist's seven entries produced no row of their own". Re-running the comparison and mapping every reported row to its covering entry shows **all seven entries produced at least one row**: code range `2170..4095` → 24, `$07F8` → 1, `$FC`–`$FD` → 2, `$0834` → 1, `$D000`–`$D001` → 2, `$D015` → 1, `$D020` → 1, summing to exactly the 32 reported.
- **Fix:** Replaced the paragraph with the measured per-entry counts, keeping the "nothing left over" statement and adding "no entry sat idle". No run was changed.
- **Files modified:** `docs/phase50-modifiability-transcript.md`
- **Verification:** the two comparison commands re-run 2026-09-16, with the rows parsed and attributed programmatically
- **Committed in:** `b37a7a34` (named in the commit message)

**2. [Rule 1 - Correctness] A line the comparison prints was missing from both quoted output blocks**

- **Found during:** Task 3, session 2's pre-commit re-derivation
- **Issue:** Both quoted run outputs showed `BYTE_IDENTICAL: no` without the annotation line the module actually prints under it — `  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)`. The equivalence transcript carries that line in all three of its own quoted blocks, so the modifiability transcript was both incomplete against the run and inconsistent with its sibling — in the one place where a reader is most likely to mistake `BYTE_IDENTICAL` for the verdict.
- **Fix:** Inserted the line in both blocks, verbatim from the run.
- **Files modified:** `docs/phase50-modifiability-transcript.md`
- **Verification:** `grep -n 'a recorded extra' docs/phase50-modifiability-transcript.md` → lines 328 and 354; the same string at three places in `docs/phase50-equivalence-transcript.md`
- **Committed in:** `b37a7a34` (named in the commit message)

**3. [Rule 2 - Missing critical record] Flagged assumption P3 was not resolved, and the transcript now says so**

- **Found during:** Task 3, session 2
- **Issue:** P3 assumed the modified subject's differing layout would make its logical checkpoint resolve to its own address, and the plan called that run "the run that actually exercises per-binary checkpoint resolution". It resolved to `$108F` — the same address as the original, the rebuild and the regressed twin. Every live capture in this phase shares one checkpoint address.
- **Fix:** Added a closing bullet stating that the mechanism was **exercised but not stressed**, that the differing-address case exists only as a synthetic unit test, and that **P3 remains unresolved rather than tested**. The transcript already recorded the measured reason the address does not move (the modification lives inside a range the subject pads to `$1000`).
- **Files modified:** `docs/phase50-modifiability-transcript.md`
- **Verification:** all five committed sidecars read: every `checkpoint_address` is 4239
- **Committed in:** `b37a7a34`

**4. [Rule 3 - Blocking] The closed load table could not name a path outside the fixture directory**

- **Found during:** Task 2 (session 1)
- **Issue:** Plan 50-05's `HAZARD_SUBJECT_PRG_BASENAMES` spelled each row as a bare basename joined onto one fixed fixture directory. Task 1's rebuild `.prg` lands under the phase evidence directory, which such a row cannot spell — and that table's own comment anticipated exactly this case.
- **Fix:** The row now carries the whole repo-relative path as an array of reviewed segments (`HAZARD_SUBJECT_PRG_RELPATHS`), with the basename table **derived** from it rather than spelled twice, and `hazardSubjectPrgPath()` joining `repoRoot()` onto the row.
- **Files modified:** `text-protocol.ts`, `text-protocol.test.ts`, `text-tools.ts`, `tools-manifest.stock.json`
- **Verification:** `text-protocol.test.ts` + `text-tools.test.ts` fail 0; the closure guards pass unmodified
- **Committed in:** `724ca605`

### Process deviations

**5. [Process] The plan was executed across two sessions, and the first ended at a rate limit**

- Session 1 completed Tasks 1 and 2, committed them, and took Task 3's live capture — then **terminated at a session rate limit before committing it**. `modified.bin`, `modified.state.json`, `run-modified.bundle.json`, `run-modified.log.json` and `docs/phase50-modifiability-transcript.md` sat untracked in the working tree until session 2.
- Session 2 re-derived every figure in the capture and the transcript from the committed bytes, found and fixed two of them, and committed exactly those five files. **No capture was repeated and no emulator was started.** The `route: snapshot`, `checkpoint_name: hazard_raster_entry` and `checkpoint_address: 4239` the sidecar carries are the session-1 values, unchanged.
- **Why this is recorded rather than smoothed over:** live evidence that survives a session boundary as untracked files is one power cut away from being lost, and a later reader comparing the transcript's `probe_date` (2026-09-15) against the commit date (2026-09-16) deserves the real reason for the gap rather than an inference.

**6. [Process] Four commits rather than three**

The enabling change for Task 2 was committed separately from the capture it enables, so the production-code change is reviewable on its own and a revert of either does not drag the other along. Same shape as plan 50-05's three-for-two.

---

**Total deviations:** 6 (3 Rule 1 correctness, 1 Rule 2 missing record, 1 Rule 3 blocking, 2 process — the last two carry no code impact).
**Impact on plan:** none on scope. The mask, the allowlist document, the comparison module and the capture procedure are all untouched by this plan. Every correction made a document match a run; none made a run match a document.

## Issues Encountered

**None that blocked.** Four worth carrying forward:

1. **The rebuild driver's first run failed, and the failure is recorded rather than quietly fixed.** `verifyAcmeAssemblesTree()` refused because ACME's per-segment result lines follow **file-inclusion order** while `result.blocks` is ascending by start, and this subject's lowest block (`$0801`) is exported **last** (`unscoped.a`). The project already had `blocksInTreeSourceOrder()` for exactly this. `REBUILD.md` records it because anyone re-running the path will hit it.
2. **ACME emitted 46 warnings, all `Wrong type - expected address.`** A warning never fails the oracle (verdict rule 5), and the measured reason is that ACME 0.97 warns on a raw-number operand under `-Wtype-mismatch` while assembling exactly the right bytes. Every diagnostic line is preserved verbatim in `rebuild-run.json`.
3. **Three stack-page bytes (`$01F8`–`$01FA`) differ between the original and modified captures** and fall in the volatile bucket. They are consistent with the added `jsr` pushing a different return address, but **the transcript does not claim that as a measurement** — the mask excluded them before anything examined them. Named, not passed over.
4. **`$D020`'s upper nibble reads `$F` in both captures**, because the VIC-II colour registers decode four bits and the high nibble reads open bus — the same detail 50-05 recorded. The patched value is visible in the low nibble (`2` → `5`) and in the decoded `borderColour: 5`.

## Flagged Assumptions — status after this plan

| # | Status | What the runs showed |
|---|---|---|
| P2 (the narrowed mask's edges are correct) | **still unresolved** | Unchanged by this plan. The mask was not touched; `MASK_NARROWED_AT: compare-cross-binary-mask-v1` printed in every run. The green comparison found zero differences in every bucket, which exercises no edge. |
| P3 (checkpoint alignment; the modified binary's layout stresses per-binary resolution) | **unresolved — the probe did not fire** | The modified subject resolved to `$108F`, the same address as every other live capture in this phase. The mechanism ran per binary and is unit-tested for differing addresses, but no live pair has ever carried two. Recorded in the transcript's closing section. |
| P4 (both behaviours observable at this one checkpoint) | **RESOLVED — both observable** | Both are visible at `hazard_raster_entry`, in RAM bytes, in chip registers and in the CPU's own `A` register. No workaround and no checkpoint move was needed. |

## User Setup Required

None. No package was installed and no external service was configured. The emulator unit was already stopped when session 2 began and was never started.

## Next Phase Readiness

**Ready for 50-07** (the CI boundary, the transcript freshness guard, and a broken step observed reddening CI). Specifically, 50-07 now has:

- **Two committed transcripts to guard for freshness**, each with subject `.prg` digests in its own frontmatter — `docs/phase50-equivalence-transcript.md` (calibration, red control, green comparison) and `docs/phase50-modifiability-transcript.md` (both behaviour changes, both allowlist runs).
- **Five committed 64K captures with sidecars**, every one carrying its subject's digest, so a stale transcript can be caught by comparing a fixture hash against what the transcript claims.
- **A clean statement of the emulator-dependent boundary**: the store → export → assemble → gate → byte-diff segment is what `make-rebuild.mjs` exercises with no emulator at all; everything downstream of a capture is the named manual step.
- **One open judgement for the orchestrator**, stated above rather than buried: whether EQUIV-03's "in the rebuilt source" is satisfied by a modification made in the subject's byte-equivalent hand-written source family. If it is, the id is complete today; if it is not, it needs one edit made in an exported file, reassembled and captured.

## Self-Check: PASSED

Every artifact this SUMMARY names exists on disk, and every commit hash it cites
exists in git:

- 9 files checked (`50-06-SUMMARY.md`, `REBUILD.md`, `hazard-subject-rebuild.prg`,
  `make-rebuild.mjs`, `rebuild-run.json`, `rebuild.bin`, `modified.bin`, both
  transcripts) — all FOUND.
- 6 commits checked (`66c13f64`, `724ca605`, `41c34e42`, `b37a7a34`, plus the
  cited `e5d84960` red control and `ca02a89c` allowlist pre-registration) — all
  FOUND.
- Every bucket count, exit status and byte value quoted above was **re-derived in
  session 2** from the committed captures, not transcribed from session 1's notes.
- `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were deliberately **not** touched
  by this executor; the orchestrator updates them centrally.
