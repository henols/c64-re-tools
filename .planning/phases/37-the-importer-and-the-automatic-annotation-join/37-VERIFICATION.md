---
phase: 37-the-importer-and-the-automatic-annotation-join
verified: 2026-09-05T12:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 37: The Importer and the Automatic Annotation Join Verification Report

**Phase Goal:** Machine addresses annotate themselves into the owned store — the
join runs mechanically with no agent, no queue walk and no skill in the loop,
resolves bank state before address, and declines with a reason rather than
emitting a confident wrong comment wherever it cannot be sure.
**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Adversarial re-check of the reviewer-flagged critical gap (CR-01)

The review (`37-REVIEW.md`) found that `AUTO-04` through `AUTO-07`'s bank-state
and graphics machinery was built and unit-tested but **unreachable** from the
shipped `anno_join_memmap`/`anno_import_ghidra_export` tool surface —
`dispatchJoinMemmap()` never supplied `runMemmapJoin()`'s `constWrites`
argument, and `importGhidraExport()` never called `parseConstWrites()` before
deleting the one artifact (the transfer file) that carried the facts. A fixer
reported this closed (commits `990b0b5e`, `5c27580b`). Independently re-traced
rather than trusted:

- `anno-tools.ts:1969-1986` (`dispatchJoinMemmap()`): now calls
  `assertConstWritesArg()`/`assertGraphicsMapIndexArg()` and threads both,
  when present, into `runMemmapJoin()`'s existing `constWrites`/
  `graphicsMapIndex` parameters — confirmed by reading the current source
  directly, not the SUMMARY's prose.
- `anno_join_memmap`'s `inputSchema` (`anno-tools.ts:1004-1027`) now declares
  `const_writes`/`graphics_map_index` properties — confirmed present.
- `anno-import.ts:438,492` (`importGhidraExport()`): calls `parseConstWrites(doc)`
  on the same parsed document, before the transfer-file delete at line ~470,
  and returns the facts as `ImportCounts.constWrites` — confirmed present in
  the return object.
- Ran `node --test anno-tools.test.ts` directly (61/61 pass), including the
  specific regression case that proves the wiring is real rather than merely
  validated-and-dropped: `WR-01: anno_join_memmap's const_writes argument
  reaches runMemmapJoin() through the dispatch layer -- an all-RAM
  processor-port value ($34) changes $d020's own label away from border
  colour (CR-01)` — passed independently in this session.
- CR-02 (`DataRangeSeed.java`'s `$FFFF`-boundary throw): re-read the fixed
  loop (`while (true) { ...; if (cur.equals(endAddr)) break; cur =
  cur.add(1); }`) — matches the reviewer's proposed fix exactly, mirroring
  `GhidraStructExport.java`'s own boundary handling.
- WR-01 (dispatch-layer test coverage), WR-02 (dead-code `parseConstWrites`),
  IN-01 (`readDataRanges()` I/O-abort) — each independently re-read in the
  current source and confirmed present (`try`/`catch (java.io.IOException e)`
  wrapping `Files.readAllLines()` in `DataRangeSeed.java`).

**Verdict on CR-01's scope decision:** the fixer explicitly chose to round-trip
`constWrites` through the two-call tool surface (caller passes the import
call's own returned array into the join call) rather than persisting it in the
store's reserved `bank` column. Checked against `REQUIREMENTS.md`'s own Out of
Scope table (line 390): "Bank-qualified addressing as a modelled store
feature ... `STORE-05` reserves the field; nothing interprets it" is
explicitly listed as **out of scope** for this milestone. The chosen fix does
not contradict that boundary — it makes the requirement reachable without
touching it. Accepted.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | One mechanical pipeline (import then join) writes machine-address annotations into the store with no agent/queue/skill in the loop, reports counts, reads annotations back out of the store; the container-side importer consumes-and-deletes a digested transfer file in the same call | ✓ VERIFIED | `anno-import.ts` (`importGhidraExport()`, single `unlinkSync` after commit), `anno-join.ts` (`runMemmapJoin()`), `anno-join.test.ts`'s structural no-agent/no-queue/no-skill scan (`SCANNED_MODULES`, now covering all 4 join-graph siblings), `anno-tools.test.ts` 61/61 pass incl. end-to-end store read-back cases |
| 2 | Narrowest-range-wins and its `sym` tie-break each observed red (first-match, longest-description, reversed tie-break) | ✓ VERIFIED | `memmap-lookup.ts`'s three-step `narrowestWidthSurvivors`/`symbolSurvivors`/`orderWinner`; `memmap-lookup-controls.test.ts` (3/3 pass); `evidence/37-04-narrowest-first-match-red.md`, `-narrowest-longest-desc-red.md`, `-symtiebreak-reversed-red.md` (94-129 lines each, real committed `memmap.json` numbers) |
| 3 | The in-image skip observed red (guard removal reddens ordinary program addresses) | ✓ VERIFIED | `anno-join.ts`'s single early-return guard + injectable `selectEntry` counting-spy seam; `join-image-controls.test.ts` (pass); `evidence/37-05-in-image-skip-red.md` |
| 4 | Bank state resolved before the address, proven by a flip (two `$01` values → two different labels) and a decline (disagreeing/absent values → no annotation, named reason), on a purpose-built synthetic fixture | ✓ VERIFIED | `anno-bank.ts` (`decodeBankState()` bit arithmetic independently cross-checked against real C64 bank-switching semantics: `$37`→io_area, `$34`→ram, `$33`→character_rom, all correct); `anno-bank.test.ts` (real-capture flip + decline cases); `evidence/37-06-bank-decode-bypass-red.md`, `-path-dependent-decline-red.md`; **and, after CR-01's fix, reachable through the real `anno_join_memmap` verb** (independently confirmed via `anno-tools.test.ts`'s CR-01 regression case) |
| 5 | Graphics ranges derived from VIC pointers (not cross-references), and the dxa/Ghidra feedback is exercised: phantom labels present before, absent after | ✓ VERIFIED | `anno-graphics.ts` (`deriveGraphicsRanges()`, arithmetic cross-checked against `stock-vicii.ts`/`stock-sprites.ts`); `DataRangeSeed.java` (boundary bug fixed, CR-02); `evidence/37-08-phantom-labels-before-after.md` (512 phantom labels before, 0 after, real Ghidra 12.1.3 run); hermetic `anno-join.test.ts` "AUTO-07 hermetic gate" cases in the automated suite (not only the `MANUAL_ONLY_TESTS`-gated `ghidra-live.test.ts`) |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/mcp/vice/anno-import.ts` | Ghidra transfer-file importer, digest+delete discipline, `parseConstWrites()` wired in | ✓ VERIFIED | Read directly; `constWrites` computed before delete, returned in `ImportCounts` |
| `src/mcp/vice/anno-join.ts` | Mechanical join, three-step selection, in-image guard, bank-state block, graphics write-back | ✓ VERIFIED | Read directly; all blocks present and gated correctly |
| `src/mcp/vice/anno-bank.ts` | `$01` bit decode, region resolution | ✓ VERIFIED | Bit arithmetic independently checked against real hardware semantics |
| `src/mcp/vice/anno-graphics.ts` | VIC-register-driven range derivation | ✓ VERIFIED | Arithmetic matches cited cross-check modules |
| `src/mcp/vice/memmap-lookup.ts` | Narrowest-range + sym tie-break + stated order | ✓ VERIFIED | Three named steps, no `sort()` |
| `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` | `## CONST_WRITES` section | ✓ VERIFIED (via committed capture + hermetic parse) | |
| `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java` | Mark-as-data pre-script | ✓ VERIFIED | `$FFFF` boundary bug fixed (CR-02), I/O-abort bug fixed (IN-01) |
| `anno-tools.ts` dispatch layer | `dispatchJoinMemmap()`/`dispatchImportGhidraExport()` reachable and tested | ✓ VERIFIED | `anno-tools.test.ts` 61/61 pass, including new WR-01 cases |
| 7 evidence transcripts under `evidence/` | Observed-red / before-after proofs | ✓ VERIFIED | All present, substantive (94-140 lines), all six required controls + 1 extra + AUTO-07's before/after |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `anno_join_memmap` (tool call) | `runMemmapJoin({constWrites, graphicsMapIndex})` | `dispatchJoinMemmap()` | ✓ WIRED | Independently re-traced in source; end-to-end test passes |
| `anno_import_ghidra_export` (tool call) | `ImportCounts.constWrites` | `importGhidraExport()` → `parseConstWrites(doc)` | ✓ WIRED | Confirmed in source; computed before delete |
| `runMemmapJoin()`'s bank-conditional block | `selectMemmapEntry()`'s entries array | `regionAdmitsEntry()` pre-filter | ✓ WIRED | Confirmed: candidate constraint runs before selection, not a post-filter |
| `deriveGraphicsRanges()` output | disassembler data blocks | `dxa-blocks.ts`'s existing `emitDataBlocks()`/`emitLabels()` (no second emitter) | ✓ WIRED | `RangeRow` shape matches `KnownDataRow`; confirmed via SUMMARY + hermetic tests |
| `DataRangeSeed.java` | Ghidra pre-analysis data marking | `dataRangesPath` wire field, always-first `-preScript` | ✓ WIRED | Live-measured 512→0 phantom labels |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| `const_writes` genuinely reaches `runMemmapJoin()` through the dispatch layer | `node --test anno-tools.test.ts` | 61/61 pass, incl. the CR-01 regression case | ✓ PASS |
| Phase-37 module cluster is internally consistent and at the documented floor | `node --test anno-import.test.ts anno-join.test.ts anno-bank.test.ts anno-graphics.test.ts memmap-lookup.test.ts memmap-lookup-controls.test.ts join-image-controls.test.ts anno-confinement.test.ts anno-register.test.ts anno-seam.test.ts hostpath-consumers.test.ts` | 178/180 pass, 2 fail (both pre-existing, `anno-register.test.ts`) | ✓ PASS |
| Typecheck clean | `npm run typecheck` | clean | ✓ PASS |
| Full automated suite at documented floor, no regression from this phase | `npm run test:automated` (broker confirmed stopped) | 3519 tests, 3506 pass, 2 fail (both the documented pre-existing `anno-register.test.ts` pair) | ✓ PASS |
| No debt markers (TBD/FIXME/XXX) in phase-touched production files | `grep -n -E "TBD|FIXME|XXX" <files>` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
| ----------- | --------------- | ------ | -------- |
| IMP-01 | 37-01 | ✓ SATISFIED | Container-side importer, `putXref()`, read back out of store |
| IMP-02 | 37-01 | ✓ SATISFIED | Digest, delete-after-commit, refusal cases |
| AUTO-01 | 37-01 | ✓ SATISFIED | Structural no-agent/no-queue/no-skill scan; store read-back |
| AUTO-02 | 37-03, 37-04 | ✓ SATISFIED | Three-step order + 3 observed-red controls |
| AUTO-03 | 37-03, 37-05 | ✓ SATISFIED | In-image guard + injectable spy + observed-red control |
| AUTO-04 | 37-02, 37-06 | ✓ SATISFIED | Bit decode, region resolution, real-capture flip, CR-01 makes it reachable via the real verb |
| AUTO-05 | 37-06 | ✓ SATISFIED | Decline-with-reason, observed-red control |
| AUTO-06 | 37-07 | ✓ SATISFIED | Pure VIC-register arithmetic, cross-reference-independence proof |
| AUTO-07 | 37-08 | ✓ SATISFIED | Real 512→0 phantom-label measurement, hermetic automated gate, dxa/Ghidra feedback wired |
| AUTO-08 | 37-01, 37-03, 37-05 | ✓ SATISFIED | Provenance token, observed-red drift control |

No orphaned requirements: all 10 IDs the phase declares (`IMP-01, IMP-02, AUTO-01..08`) are covered by at least one plan's `requirements:` frontmatter field, and REQUIREMENTS.md marks all 10 `[x]` Complete — independently judged earned by the code, not merely claimed.

### Anti-Patterns Found

None found in the phase's touched production files (`anno-import.ts`, `anno-join.ts`, `anno-bank.ts`, `anno-graphics.ts`, `memmap-lookup.ts`, `anno-tools.ts`, `anno-register.ts`, `GhidraStructExport.java`, `DataRangeSeed.java`, `ghidra-run.ts`, `ghidra-project.mts`, `host-tool.mts`) — no `TBD`/`FIXME`/`XXX` markers, no placeholder returns.

**Minor (non-blocking) documentation gap noted:** `src/skills/c64-program-recon/SKILL.md`'s
description of the import-then-join pipeline (lines 314-335) still does not mention the
`const_writes`/`graphics_map_index` round-trip that CR-01's fix made reachable — it documents
only the pre-CR-01 unconstrained shape. This was not touched by either commit fixing CR-01
(`990b0b5e`, `5c27580b`). It does not block any must-have: the tool's own `inputSchema`
descriptions on `anno_import_ghidra_export`/`anno_join_memmap` (read by any MCP client via
`tools/list`) already document the round-trip in full, so a caller is not misled about what the
tools do — the gap is purely in the human-facing skill playbook prose. Recommend a follow-up
doc update; not treated as a phase gap.

### Human Verification Required

None. Every truth resolved to VERIFIED through direct source inspection, independent test
execution, and the committed evidence transcripts — no visual, real-time, or external-service
behavior remains unverified.

### Gaps Summary

None. The phase goal — machine addresses annotate themselves into the owned store, mechanically,
resolving bank state before address, and declining with a reason where uncertain — is achieved and
independently confirmed at the code level, not merely claimed by SUMMARY.md. The one critical
integration gap the code review found (CR-01: bank-state/graphics machinery built but unreachable
from the shipped tool surface) was independently re-traced in this verification and confirmed
genuinely fixed, with a passing end-to-end regression test proving the wiring rather than merely
asserting it.

---

_Verified: 2026-09-05_
_Verifier: Claude (gsd-verifier)_
