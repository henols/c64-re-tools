---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
verified: 2026-09-13T00:00:00Z
status: passed
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
behavior_unverified_items:
  - truth: "The committed, purpose-built synthetic subject (`hazard-subject.prg`), run in VICE, shows the documented on-screen behaviour (sprite, custom glyph, colour split, border change) for the FULL, combined image that carries all four planted classes together."
    test: "Assemble `hazard-subject.a` (real ACME, already proven byte-identical via the reassembly test), load `hazard-subject.prg` into a real stock `x64sc`, run it to a settled screen, and look at the screen."
    expected: "A recognisable sprite, a recognisable custom glyph, a horizontal colour split from the raster routine, and a changed border colour, all visible together on the settled screen."
    why_human: "This is a claim about pixels on a rendered screen, which no automated check in this repository inspects. The phase's own `FIXTURE-DESIGN.md` records that the SETTLED, combined-image capture shows none of the four effects (plain `READY.` prompt) -- isolated single-construction builds DO show their own effect, and the disagreement was investigated (multiple load paths, an entry point that never returns to BASIC) rather than left as a single unexplained capture -- but the root cause of the reversion in the combined image was not pinned down. A human must judge whether this disclosed, investigated disagreement satisfies the roadmap's 'runs in VICE with visible on-screen behaviour' criterion for the delivered artifact, or whether it represents an unmet criterion requiring further work."
coincidental_reliance_items: []
---

# Phase 48: The Movement-Hazard Report and Its Purpose-Built Subject Verification Report

**Phase Goal:** One synthetic C64 program that deliberately carries all four movement-blocking classes, and a report that enumerates what blocks movement across those four classes — delivered and reviewed together against a non-vacuity bar so neither is written to match the other, and acting on nothing it finds.

**Verified:** 2026-09-13
**Status:** passed (human verification resolved 2026-09-13 via `48-UAT.md` test 1)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

These five truths are the ROADMAP's own Success Criteria for Phase 48 (`roadmap_truths`), merged
with the per-plan `must_haves` from all six PLAN.md frontmatter blocks (48-01 through 48-06).
Every plan-level truth cross-checked below rolled up cleanly into one of the five roadmap
criteria; none of the six plans' `must_haves` conflicted with or narrowed the roadmap contract.

| # | Truth (roadmap Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A committed, purpose-built synthetic subject assembles under real ACME and runs in VICE with visible on-screen behaviour, carrying (per class, documented, non-textbook) an indexed jump table with the RTS-trick idiom, self-modifying code, page-alignment dependence, and cycle-exact raster code, plus sprite/charset/level/music tables; a fixture design document states per class which variant was chosen, why it deviates from the textbook idiom, and shows the four classes are structurally different. | ⚠️ SPLIT — assembly and design document VERIFIED; on-screen behaviour for the FULL combined image is a disclosed, investigated disagreement, routed to human verification (see below) | Assembly: `VICE_REQUIRE_ACME=1 node --test hazard-subject-reassembly.test.ts` — 11/11 pass, including "the reassembled image is octet-identical to the committed subject image" and the negative working-directory control. `hazard-subject-fixture.test.ts` — 36/36 pass (byte-level proof of all four classes, the four data tables, the mis-aligned twin, mechanism-id disjointness). `FIXTURE-DESIGN.md` (360 lines) states per-class textbook idiom vs. planted variant vs. what the textbook alone would prove, for all four classes, plus a dedicated "why structurally different" section pointing at the mechanism-id-disjointness test, and two named deliberate exclusions. On-screen behaviour: `FIXTURE-DESIGN.md`'s own "On-screen observations" section records that the settled, COMBINED image shows the default `READY.` screen (none of the four predicted effects), while each construction shown ISOLATED (no raster present) does take visible effect; the disagreement was narrowed (multiple load paths, an entry-point that never returns to BASIC) but not root-caused. This is a genuine, disclosed finding, not a claimed pass — see `behavior_unverified_items`. |
| 2 | The hazard report enumerates findings across all four classes as a read-only computed query over existing tables — opens no new store table, writes nothing, removes/strips/drops/excludes nothing. A structural test observes it refusing a write path. | ✓ VERIFIED | `anno-hazard-report.ts` (1367 lines) contains zero matches for `writeFileSync`, `renameSync`, `appendFileSync`, `openStore`, `putXref`, `applyWrite`, `hostpath`, `containerpath` (independently re-grepped, not just trusted from the test). `anno-hazard-report.test.ts`'s "hazard read-only:" test reads `MODULE_PATH` (`join(HERE, "anno-hazard-report.ts")`) off disk at run time and asserts none of those forbidden strings appear — a genuine structural source-text test, not a convention. `node --test anno-hazard-report.test.ts` — 64/64 pass. |
| 3 | Each of the four classes fires on a non-canonical planted variant AND does not fire on a negative control; class 1 is the existing `scanIndirectDispatch()` imported (not reimplemented), asserted by a single-call-site-count test; `splitTableCandidates` carried through verbatim as the report's unproven/flagged bucket. | ✓ VERIFIED | `anno-hazard-report.test.ts`'s "hazard reuse:" test independently counts `scanIndirectDispatch(` declarations (must be 1, in `anno-coverage.ts`) and call sites (must be exactly 2: `buildCoverageReport()` and `buildHazardReport()`) — pass. `hazard subject:` tests in `hazard-subject-fixture.test.ts` prove the planted stack-return dispatch is found via the imported scanner's own result fields, the mixed-register decline survives only in `unprovenDispatchCandidates` (never in any proven collection), class-3 fires on the aligned build and not on the mis-aligned/negative-control builds, and class-4's signature fires per its structural definition. `CROSS-CHECK.md`'s 16-row table (independently re-derived, see below) shows zero false positives across all 16 rows. |
| 4 | Every finding carries a detection mechanism and confidence; the third `unclassified` outcome is reachable AND reached (never rendered as clean); a boolean clean/dirty shape is refused by test. | ✓ VERIFIED | `anno-hazard-report.test.ts`: "hazard shape: enumerating a real report's own keys finds no boolean field but truncated, and no key name reading clean/dirty/safe/ok/verdict/pass" — pass. "hazard shape: across the fixture corpus the suite reads, all three region-outcome tokens occur at least once" — pass (the `unclassified` outcome is empirically reached, not merely theoretically reachable, via the class-3 detector's deliberately-unrecognised read-modify-write construction in `hazard-subject-align.a`). "every undecided (unclassified) region ... carries a non-empty cause" — pass. |
| 5 | The detectors are cross-checked against independently-sourced committed fixtures (`tracer.prg`, `bank.prg`, `smc.prg`), each result recorded as detected/missed/false-positive; `anno_evid_exec` only ever strengthens a flag already raised by static evidence, never suppresses one; never-observed is never evidence of safety. | ✓ VERIFIED | `git log --follow` on `tracer.prg` (2026-09-04), `bank.prg` (2026-09-04), `smc.prg` (2026-08-31) confirms all three (plus the fourth, `charset-phantom.prg`, 2026-09-05) were committed 8-13 days before this phase's execution (2026-09-12/13), for unrelated questions — genuinely independent, not merely claimed. `CROSS-CHECK.md` records all 16 rows (4 fixtures × 4 classes) as three counts against an explicit denominator, with named addresses, no pass/fail/score/rate anywhere, and explicitly states that 2 of 4 classes (indexed-dispatch, cycle-exact-raster) have NO independent positive example — an honest limitation, not smoothed over. `anno-hazard-report.test.ts`'s "hazard evidence:" tests independently prove the strengthen-only asymmetry (identical finding sets with/without full observation coverage, differing only in strength token) and bar any never-observed arithmetic in the module's own source text. |

**Score:** 4/5 truths fully verified (1 split — see human verification below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-hazard-report.ts` | Pure, read-only, four-class hazard report module | ✓ VERIFIED | 1367 lines; no write/store/path-translation calls; 64/64 own tests pass |
| `src/mcp/vice/anno-hazard-report.test.ts` | Structural + behavioral test coverage | ✓ VERIFIED | 1161 lines, 64 tests, all pass |
| `src/mcp/vice/fixtures/hazard-subject/*.a` (5 source files) | Purpose-built subject planting all 4 classes | ✓ VERIFIED | `hazard-subject.a`, `-dispatch.a`, `-align.a`, `-align-misaligned.a`, `-raster.a`, `-smc.a` all present, non-trivial (2.8-7.4KB each) |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` / `-misaligned.prg` | Assembled, committed images | ✓ VERIFIED | Present; reassembly test proves both are a pure function of committed source |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json` | Committed store export/decomposition | ✓ VERIFIED | Present, 6423 bytes; imports cleanly, full byte coverage, 4 external_file ranges, 5 scopes, proven by `hazard-subject-fixture.test.ts` |
| `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` | Per-class design rationale document | ✓ VERIFIED | 360 lines; per-class textbook-vs-planted sections, structural-difference section, two deliberate exclusions, on-screen observations section |
| `src/mcp/vice/fixtures/hazard-subject/CROSS-CHECK.md` | Non-vacuity cross-check record | ✓ VERIFIED | 97 lines; 16-row table, provenance table, honest no-positive-example disclosure |
| `src/mcp/vice/hazard-subject-fixture.test.ts` | Byte-level fixture assertions | ✓ VERIFIED | 744 lines, 36 tests, all pass (with ACME present) |
| `src/mcp/vice/hazard-subject-reassembly.test.ts` | Full rebuild-path proof | ✓ VERIFIED | 299 lines, 11 tests, all pass (`VICE_REQUIRE_ACME=1`) |
| `src/mcp/vice/anno-tools.ts`, `anno-register.ts`, `anno-cli.ts` | MCP verb + CLI verb reaching the report | ✓ VERIFIED | `anno_hazard_report` registered; CLI verb floor raised to 6; both surfaces functionally tested end to end (`anno-cli.test.ts`, 99/99 pass) |
| `scripts/lib/anno-cli-verbs.mjs`, `src/skills/c64-program-recon/references/tool-selection.md` | Verb floor + skill routing entry | ✓ VERIFIED | `ANNO_CLI_VERB_FLOOR = 6`; skill reference names `anno hazard-report` explicitly |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `hazard-subject*.a` sources | `hazard-subject*.prg` images | `make-hazard-subject-fixtures.mjs`, real ACME | ✓ WIRED | Regenerator re-derivation test passes; images are a pure function of committed source |
| `hazard-subject.annostore.json` | reassembled tree | `exportAsmTree()`, real ACME, host-tool seam | ✓ WIRED | `hazard-subject-reassembly.test.ts` — octet-identical round trip, 11/11 pass |
| `decode()` | `scanIndirectDispatch()` | class-1 import (not re-derivation) | ✓ WIRED | Exact-count test: 1 declaration, 2 call sites, pass |
| `anno_hazard_report` MCP tool / `anno hazard-report` CLI verb | `buildHazardReport()` | pure function call from real store + image | ✓ WIRED | Both surfaces call the same function once; functionally tested (`anno-cli.test.ts` hazard-report tests, 6/6 pass) |
| `report.truncated` (module) | MCP/CLI response `truncated` field | CR-01 fix | ✓ WIRED (post-fix) | `truncated: report.truncated || report.findings.length > findings.length` in `anno-tools.ts`; hard-coded `truncated: false` removed from `anno-cli.ts`; regression tests added and passing |
| incoming `scopes[]` | target store's existing scopes | CR-02 fix, pre-write overlap check | ✓ WIRED (post-fix) | `listScopes(handle)` checked before any `set*`/`put*`/`insert*` call; regression test confirmed to fail pre-fix and pass post-fix |

### Behavioral Spot-Checks / Live Test Runs

| Behavior | Command | Result | Status |
|---|---|---|---|
| Hazard report module tests | `node --test anno-hazard-report.test.ts` | 64/64 pass | ✓ PASS |
| Fixture byte-level tests (real ACME) | `node --test hazard-subject-fixture.test.ts` | 36/36 pass | ✓ PASS |
| Reassembly / rebuild path (real ACME) | `VICE_REQUIRE_ACME=1 node --test hazard-subject-reassembly.test.ts` | 11/11 pass, no skips | ✓ PASS |
| Store export scope-import regression (CR-02) | `node --test anno-store-export.test.ts` | 12 pass / 1 opt-in skip (unrelated live tier) | ✓ PASS |
| CLI verb functional coverage (WR-01/CR-01/WR-03) | `node --test anno-cli.test.ts` | 99/99 pass, incl. 6 `hazard-report:` tests | ✓ PASS |
| Typecheck | `cd src/mcp/vice && npm run typecheck` | exits 0 | ✓ PASS |
| No debt markers in phase files | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all phase-touched files | zero blocking hits (two `XXXX` hits are unrelated placeholder-address notation in doc comments, not debt markers) | ✓ PASS |
| No planning-vocabulary leaks in shipped source/fixtures | `grep -a -rn -E "\.planning/\|/gsd-\|D-[0-9]\|BUILD-[0-9]\|Phase [0-9]"` across module + fixture files | zero hits (excluding the one declared `requirements: ["BUILD-04"]` data field) | ✓ PASS |
| Independent fixture provenance | `git log --follow` on `tracer.prg`, `bank.prg`, `smc.prg`, `charset-phantom.prg` | committed 2026-08-31 to 2026-09-05, 8-13 days before phase execution (2026-09-12/13) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| BUILD-04 | 48-01, 48-02, 48-03, 48-04, 48-05, 48-06 | Hazard report across four movement-blocking classes + purpose-built subject delivered in the same phase, non-vacuity reviewed | ✓ SATISFIED (with one item routed to human verification — see above) | REQUIREMENTS.md marks BUILD-04 Complete, mapped to Phase 48; no orphaned requirements found for Phase 48 (`grep "Phase 48" .planning/REQUIREMENTS.md` shows only BUILD-04 plus prose references) |

No orphaned requirements: cross-referencing REQUIREMENTS.md's Phase 48 mapping against the `requirements:` field of all six PLAN.md files shows only `BUILD-04`, consistently declared across all six plans.

### Code Review Disposition (48-REVIEW.md / 48-REVIEW-FIX.md)

- **CR-01** (truncated signal silently discarded at both CLI and MCP consumer surfaces) — **Fixed**, verified live: `anno-tools.ts` now ORs the scanner's own signal with the max-results slice check; `anno-cli.ts`'s hard-coded `truncated: false` was removed. New regression tests in `anno-cli.test.ts` trip `MAX_TABLE_ENTRIES` and assert `truncated: true` end to end, plus a non-vacuity control asserting `truncated: false` on an ordinary run. Independently re-run: 99/99 pass.
- **CR-02** (scope import could partially apply against a target store's pre-existing scopes) — **Fixed**, verified live: pre-write overlap check against `listScopes(handle)` added before the apply loop's first write. Regression test confirmed (per 48-REVIEW-FIX.md) to fail against the pre-fix code via `git stash` and pass post-fix. Independently re-run: 12/13 pass (1 unrelated opt-in live-tier skip).
- **WR-01** (no functional CLI test coverage for `hazard-report`) — **Fixed**: 4 new tests added, independently re-run and passing.
- **WR-02** (dead-weight `matched`/`returned` fields) — **Fixed** via explanatory comment (no behavior change needed).
- **WR-03** (`printHazardReport()`'s hand-rolled type diverges from real `HazardReport` shape) — **Fixed**: now imports the real type; `unprovenDispatchCandidates` now rendered under its own heading. Independently re-run: passes.
- **IN-01** (five near-identical CLI option parsers, no shared abstraction) — **Disposed, no code change**, per the reviewer's own "no action required for this phase" disposition. Acceptable — this is a forward-looking refactoring note, not a defect.
- A **real regression** was introduced during the fix pass (a stale `anno-cli.ts:446` line citation in `module-classification.ts`, shifted by the CR-01/WR-03 edits) and was found and repaired in a follow-up commit (`47ecd80a`), independently confirmed present in `git log`. `npm run typecheck` exits 0 on the current tree.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase touched (two incidental `XXXX` substrings in `anno-tools.ts`/`anno-cli.ts` doc comments are placeholder-address notation like `$XXXX`/`FUN_XXXX`, unrelated to debt markers). No hardcoded empty-data stub patterns found in the hazard-report module or its consumer surfaces (all consumer-surface issues identified by code review — CR-01/CR-02/WR-01/WR-02/WR-03 — were fixed and independently re-verified above).

### Human Verification Required

#### 1. On-screen behaviour of the FULL combined synthetic subject in a real emulator

**Test:** Load the committed `hazard-subject.prg` (all four hazard classes combined, exactly as delivered) into a real stock `x64sc`, run it, and observe the settled screen. Compare against the mis-aligned twin `hazard-subject-misaligned.prg`.

**Expected (per FIXTURE-DESIGN.md's own stated prediction):** A recognisable sprite, a recognisable custom character-set glyph, a horizontal raster colour split, and a changed border colour, all visible together on the settled screen for the aligned build; the mis-aligned twin showing the same behaviour except with a garbled/wrongly-shaped sprite and character.

**What was actually found (disclosed by the phase itself, not by this verifier):** The settled screen for BOTH the aligned and mis-aligned combined images shows the plain default `READY.` BASIC prompt — none of the four predicted effects are present. Isolating each construction individually (no raster construction present) shows the self-modification and alignment effects DO take hold and stay visible on a real screen. The moment the timer-stabilised raster construction is added back into the combination, all constructions' effects revert before a settled screen can be captured — reproduced across multiple load methods, including an entry point that never returns to BASIC (ruling out "returning to BASIC undoes the vector" as the explanation). The precise trigger for the reversion was not pinned down.

**Why human:** This is a claim about pixels on a rendered screen — no automated check in this repository's suite renders or inspects a screen. More importantly, this is exactly the item the phase's own artifacts flag as a genuine, investigated, disclosed disagreement between the roadmap's stated success criterion ("runs in VICE with visible on-screen behaviour") and what the delivered, committed image actually does when run as-is. The investigation was thorough (isolated constructions confirmed working individually; multiple load paths tried; a non-BASIC-return entry point tried) and the disagreement is recorded honestly rather than smoothed over or silently dropped — this is the correct executor behavior when something doesn't work as predicted. But whether "the combined image's on-screen effects revert before settling, root cause unknown" satisfies the roadmap's "runs in VICE with visible on-screen behaviour" criterion for the *delivered subject* (as opposed to its constructions individually) is a judgment call only a human reviewer should make. It may be judged sufficient (each construction is independently proven to work and to be visible; the interaction is a separate, disclosed follow-up item), or it may be judged as leaving Success Criterion 1 not fully met until the interaction is understood or the subject is revised so the full combination settles visibly.

### Gaps Summary

No FAILED must-haves, no MISSING/STUB artifacts, no NOT_WIRED key links, and no blocking anti-patterns were found. All code review findings (2 Critical, 3 Warning, 1 Info) were either fixed and independently re-verified, or disposed with an explicit, reviewer-sanctioned no-change rationale (IN-01). A regression introduced during the fix pass (a stale line citation) was independently confirmed found and repaired. All 111 phase-specific tests (64 + 36 + 11) plus the 99 CLI tests and 12 store-export tests independently re-run in this verification pass, all green; typecheck exits 0.

The one open item is not a code gap but a disclosed empirical finding: the full, combined synthetic subject does not show its predicted on-screen effects in a settled emulator capture, though each of its four constructions independently does. This is routed to human verification rather than scored as a pass or a fail, per the explicit instruction accompanying this verification task. Because this item exists, overall status is `human_needed` rather than `passed` — no other finding in this phase would have prevented a `passed` verdict.

### Human Verification Resolution — 2026-09-13

That open item was put to a human as `48-UAT.md` test 1 and **passed**. The reviewer judged
the disclosed, investigated disagreement sufficient against roadmap Success Criterion 1 for
the delivered subject: each of the four constructions is independently proven to take visible
effect, the combined-image reversion was narrowed rather than hand-waved, and it is recorded
in `FIXTURE-DESIGN.md` rather than smoothed away. Status is therefore `passed`.

The finding itself is **not** retracted by that judgment. The combined image still settles to
a plain `READY.` prompt and the root cause of the reversion is still unknown. What the human
decided is that this is an acceptable, honestly-disclosed limitation of the delivered artifact
— not that the artifact behaves as originally predicted. `behavior_unverified_items` above is
kept intact for that reason.

---

_Verified: 2026-09-13T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
