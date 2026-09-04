---
phase: 36-the-sleigh-language-and-the-ghidra-harness
verified: 2026-09-04T21:31:24Z
status: gaps_found
score: 4/5 roadmap success criteria fully verified; 1 criterion partially verified with a live-reproducible regression
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC4 (ROADMAP): 'A loader-owned block at the same address has the flag set on the existing block and is proven not to fall back to non-volatile through a swallowed MemoryConflictException.' The committed test proving this (ghidra-live.test.ts, 'VOLATILE forced conflict (flat64k route)') must run to completion and assert the exception is genuinely a MemoryConflictException with the export still carrying its zero-function/no-completed-assertion evidence."
    status: failed
    reason: >-
      MEASURED (2026-09-04, live rerun against real Ghidra 12.1.3, GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC):
      this test currently throws an uncaught rejection and fails. Root cause: CR-01 (a code-review
      fix applied AFTER plan 36-05 completed and committed this test) changed `runGhidraAnalyze()`
      to reject whenever the run log carries a thrown-script signal. The 36-04 "GATE 1" test case
      was updated in the same CR-01 commit (f8ed2bab) to expect this rejection via `assert.rejects`,
      but the 36-05 "forced conflict" test at ghidra-live.test.ts:887-943 was NOT updated -- it still
      calls `runGhidraAnalyze()` with no try/catch/`assert.rejects`, expecting a normal return, then
      manually re-parses the run log to check `scriptThrew === true`. Because `runGhidraAnalyze()`
      now throws before returning, none of that test's own assertions (the exit-status check, the
      `MemoryConflictException` message match, the export-completion check, the zero-function check)
      ever execute -- the test fails on the unhandled rejection instead. This is a genuine, deterministic
      regression, not a flake (reproduced twice in isolation with `--test-name-pattern`). It is invisible
      to `npm run test:automated` because `ghidra-live.test.ts` is in `MANUAL_ONLY_TESTS`, and
      `36-REVIEW-FIX.md`'s own verification did not re-run this file's full live suite after CR-01
      (only the GATE 1 case, plus non-live suites and the automated-suite baseline) -- so the SUMMARY/
      REVIEW-FIX "all green" claims do not cover this file, and this regression was never observed
      or disclosed anywhere in the phase's own artifacts.
    artifacts:
      - path: "src/mcp/vice/ghidra-live.test.ts"
        issue: "Lines 887-943 ('VOLATILE forced conflict (flat64k route)') do not account for CR-01's runGhidraAnalyze() now rejecting on scriptThrew; the test fails with an unhandled rejection rather than exercising its own assertions."
    missing:
      - "Wrap the `runGhidraAnalyze(...)` call in this test with `await assert.rejects(...)` (mirroring the fix already applied to the GATE 1 case in the same file), asserting the rejection message names the thrown-script signal."
      - "Move the remaining assertions (MemoryConflictException text match, export existence, `## UNRESOLVED_DISPATCH` presence, `DECOMPILE_ZERO_FUNCTIONS true`) to read the run log and export from a deterministically reconstructed path (runId + GHIDRA_RUNS_DIR_NAME, the same technique CR-01's own GATE 1 fix used), since a thrown call yields no `GhidraRunResult` to read `runLogPath` from."
      - "Re-run `GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test --test-name-pattern='forced conflict' ghidra-live.test.ts` and confirm it passes before closing this gap."
deferred: []
---

# Phase 36: The SLEIGH Language and the Ghidra Harness Verification Report

**Phase Goal:** Ghidra headless recovers structure from a real C64 image under this
project's own committed harness — all 105 undocumented opcode bytes decodable
under an extension installed as its own language, hardware writes surviving the
decompiler, and structural facts exported through `DecompInterface`.
**Verified:** 2026-09-04T21:31:24Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Method

This report is built from (a) reading all 7 plans, 7 summaries, `36-REVIEW.md`,
`36-REVIEW-FIX.md`, `docs/phase36-sleigh-language-and-harness-findings.md`, and every
evidence file under `evidence/`, and (b) **independently re-running every live-Ghidra
suite this phase added**, directly against the real Ghidra 12.1.3 installation
(`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`), rather than trusting
the recorded transcripts alone. Re-run suites: `sleigh-compile-gate.test.ts` (9/9),
`ghidra-live.test.ts` (13/16, 2 skipped, **1 genuine failure**, see gap above),
`ghidra-opcode-live.test.ts` including the corpus case (11/11 non-corpus + 1/1 corpus =
12/12, all passing), `host-tool.test.ts`/`ghidra-project.test.ts`/`hostpath-consumers.test.ts`/
`ghidra-harness-gates.test.ts` (166/166), `resources-sync.test.ts` (clean, no drift),
`docs-linerefs.test.ts`/`docs-dangling-refs.test.ts`/`ci-suite-coverage.test.ts`/`test-gate.test.ts`
(34/34). Also re-ran `npm run typecheck` (clean) and `npm run test:automated`
(3409 tests, 3396 pass, 2 fail — both pre-existing `anno-register.test.ts` failures named in the
environment notes, out of scope, no regression).

The live re-run's digests, byte lengths and counts (export sha256
`c38c5eb368d704b802dff1126f2879309c11ad9afaa0388db4dfccea66f21466`, 553832 bytes; accounting
`{attempted:10, decompiled:10, timedOut:0, failed:0}`; control `{composite:0, definedData:14}`;
corpus `{changed:103, attributed:32}`) match the committed evidence files' own recorded numbers
exactly — the evidence files are genuine, reproducible measurements, not fabricated transcripts.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Run log names the language used; extension installed as its own `.ldefs` id; `-processor` change in the same commit; acceptance run under `6502:LE:16:default` observed FAILING the 105-byte assertion | ✓ VERIFIED | Independently re-confirmed live: `6502_nmos.ldefs` declares `6502:LE:16:nmos` only, stock `6502.ldefs` untouched; `ghidra-opcode-live SEED` and `SWEEP (stock default)` both pass live, the latter observing the 105-byte assertion FAIL under `6502:LE:16:default` exactly as required. `evidence/36-01-language-used.md`. |
| 2 | `sleigh` compile gate observed red before fix, green after (earliest task); all 105 bytes decode; `65c02.slaspec` keeps its own meanings; unstable ops read as declared unknowns; exercised against real illegal-opcode code | ✓ VERIFIED | Independently re-ran `sleigh-compile-gate.test.ts` live: 9/9 pass including the PLANTED VIOLATION (red) case. Independently re-ran `ghidra-opcode-live.test.ts` live (all 12 cases incl. corpus): 105-byte sweep decodes under `nmos`, fails under `default`; 6 unstable bytes decode to named opaque userops; 15 shared bytes keep 65C02 meaning; corpus (`danish.d64`) before/after difference recorded (103 changed, 32 attributed to illegal bytes). `evidence/36-01-sleigh-gate-red.md`, `evidence/36-06-opcode-decode.md`, `evidence/36-07-corpus-before-after.md`. |
| 3 | Each of the harness's three gates observed firing: wrong count fires exact literal `ERROR REPORT SCRIPT ERROR` with exit 0; classification count is block total (not image size) on both routes; reproducible from committed script, Ghidra a declared host prerequisite by version | ✓ VERIFIED | Independently re-ran `ghidra-live.test.ts` live: GATE 1 (both cases, including the CR-01-updated rejection case), GATE 2 on both routes (572 `.prg` vs 65536 `flat64k`, differing as required), GATE 3 (byte-identical reproducibility + version assertion) all pass. `evidence/36-04-three-gates.md`. |
| 4 | Volatile-I/O carve proven by disappearance on both import routes; loader-owned block gets flag set on the EXISTING block; proven not to fall back to non-volatile through a swallowed `MemoryConflictException` | ⚠️ PARTIALLY VERIFIED — see gap | Disappearance on both routes: ✓ independently re-confirmed live (4 VOLATILE with/without-flag cases pass on both routes). Loader-owned existing-block handling: ✓ independently re-confirmed live (the "companion" case passes). **Not-fall-back-through-swallowed-exception: ✗ the committed test proving this currently fails live** (see gaps section) — a genuine, reproducible regression introduced by the post-hoc CR-01 code-review fix, undetected by the phase's own SUMMARY/REVIEW-FIX verification because the affected file is manual-only and was not re-run in full after that fix. Separately, disclosed and judged acceptable on its own terms (see Human Verification below): this forced-conflict proof was only ever exercised on the `flat64k` route, not `.prg`, because the `.prg` fixture (`bank.prg`) is too small to reach the I/O page at its default load address — `36-05-SUMMARY.md`'s own Traceability note. |
| 5 | Structural facts exported through `DecompInterface` (array bound, split-pointer idiom, record stride, ≥1 resolved computed jump, ≥1 self-modifying write target) with typed cross-references, accounting identity, denominator-free unresolved-dispatch reporting; `DataTypeManager` control on the same image returns essentially nothing | ⚠️ PARTIALLY VERIFIED — see Human Verification | Independently re-confirmed live on the real corpus (`danish.d64`): `SPLIT_POINTER` (found, via literal `CONCAT11(` text) and `SELF_MODIFYING_WRITE` (found) ✓; accounting identity `10 = 10+0+0` under ceiling 5 ✓; typed references present for `READ`/`WRITE`/`READ_WRITE` (no `COMPUTED_JUMP` reference exists on this image — see below) ✓; unresolved dispatch reported as count+list with no denominator (2 sites, no ratio anywhere) ✓; `DataTypeManager` control returns `COMPOSITE_TYPES=0`/`DEFINED_DATA=14` vs. the acceptance route's 183 decompiled-text lines (~13x) ✓. **`ARRAY_BOUND`, `RECORD_STRIDE`, and — most materially — a *resolved* `COMPUTED_JUMP` are NOT present on this real binary at the five entry points this run reaches** — confirmed independently live, matching the committed evidence exactly. The absence is disclosed, well-reasoned (every computed transfer reachable is the "BRK trick" through the unresolvable hardware IRQ vector, correctly routed to `## UNRESOLVED_DISPATCH` instead), and cross-verified against a second, independently-cracked release of the same game (`saeger.d64`). This is a literal shortfall against the ROADMAP's own wording ("at least one resolved computed jump"), not a harness defect — see Human Verification. |

**Score:** 3/5 criteria fully, independently re-verified with no reservations (1, 2, 3). 2/5
criteria (4, 5) have their core mechanism independently confirmed working, each with one
disclosed shortfall requiring a decision — SC4 additionally carries one undisclosed,
live-reproduced regression that is a genuine gap (not a judgment call).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/vendor/ghidra-ext/` (Module.manifest, extension.properties, data/languages/*, data/sleighArgs.txt) | Vendored SLEIGH extension source, compiles clean, new `.ldefs` id | ✓ VERIFIED | 105 unique `op=0x..` constraints confirmed by direct grep; `6502_nmos.ldefs` declares only `6502:LE:16:nmos`; compiles live to a `.sla` (never committed, per `.gitignore` — confirmed `git ls-files -- '*.sla'` is 0). |
| `src/mcp/vice/ghidra-run.ts` | Container-side orchestrator + run-log classifier | ✓ VERIFIED (post-fix) | `runGhidraAnalyze()` now checks `verdict.scriptThrew` (CR-01 fix), confirmed present in the file at the point it's called, before the language checks. |
| `src/mcp/vice/host-tool.mts`, `ghidra-project.mts` (+ `resources/*.mjs` siblings) | `ghidra.analyze`'s full argv surface, preflight, `ghidra.installExtension` | ✓ VERIFIED | 166/166 combined tests pass live; `resources-sync.test.ts` confirms no drift between `.mts` source and compiled `.mjs`. |
| `src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java`, `GhidraStructExport.java` | Volatile carve + structural-fact export via `DecompInterface` | ✓ VERIFIED | Independently exercised live against real Ghidra; produces the exact digests/counts recorded in evidence. |
| `src/mcp/vice/ghidra-live.test.ts`, `ghidra-opcode-live.test.ts` | Registered `MANUAL_ONLY_TESTS`, both gates and both opcode suites | ⚠️ ORPHANED-BY-REGRESSION (one case) | Registered correctly (`test-gate.test.ts`'s `TWELVE_OK` gate passes); one case inside `ghidra-live.test.ts` (forced-conflict) currently fails live — see gap. |
| `docs/phase36-sleigh-language-and-harness-findings.md` | Consolidated findings doc | ✓ VERIFIED | Present, substantive (8 parts), and its own content cross-checked against independently re-run live output — numbers match exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `-processor 6502:LE:16:nmos` wire field | `ghidra-run.ts`'s `classifyGhidraRunLog()` | byte-exact, case-sensitive comparison against the run log's own `Using Language/Compiler:` line | ✓ WIRED | Confirmed live: mismatched processor is rejected, matching processor accepted. |
| A thrown post-script (`ERROR REPORT SCRIPT ERROR`) | `runGhidraAnalyze()`'s return contract | `verdict.scriptThrew` check (CR-01) | ✓ WIRED for GATE 1's case; ⚠️ the 36-05 forced-conflict case has NOT been updated to expect this same wiring — see gap | Confirmed live both ways. |
| `importRoute` → loader base address → which memory blocks exist | `VolatileCarve.java`'s `mem.getBlock()` branch | existing-block vs. create-block path | ✓ WIRED | Confirmed live on both routes (with-flag cases) and the companion existing-block case. |
| `DecompInterface` walk | `GhidraStructExport.java`'s `## STRUCTURAL_FACTS`/`## REFERENCES`/`## DECOMPILE_ACCOUNTING` sections | direct decompiler walk, never `DataTypeManager` in default mode | ✓ WIRED | Confirmed live; `DataTypeManager` control mode is a separate, explicit invocation path returning near-zero counts on the identical image. |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (`n/a` — this phase has no UI). The equivalent trace
for this phase (real Ghidra installation → `analyzeHeadless` → run log/export file → parsed
counts/digests in the test) was exercised directly above and confirmed to flow from a real
tool invocation rather than a static/mock return, at every re-run.

### Behavioral Spot-Checks / Probe Execution

All of this phase's "probes" are its own live Ghidra test suites, already covered above under
Method and the Observable Truths table — run directly against the real, declared-prerequisite
Ghidra 12.1.3 installation rather than accepted from SUMMARY.md narration, per the required
Step 7c discipline for this kind of phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| OPC-01 | 36-01, 36-06 | ✓ SATISFIED | Compile gate red→green independently re-confirmed; 105-byte decode independently re-confirmed. |
| OPC-02 | 36-06 | ✓ SATISFIED | Six unstable/page-crossing bytes independently re-confirmed decoding to named opaque userops, never plausible arithmetic. |
| OPC-03 | 36-07 | ✓ SATISFIED | Real-corpus (`danish.d64`) before/after difference independently re-confirmed (103 changed, 32 attributed), sequenced after the compile gate and language assertion per the commit order in `36-07-SUMMARY.md`. |
| OPC-04 | 36-01, 36-04, 36-06 | ✓ SATISFIED | Separate `.ldefs` id independently re-confirmed; run-log-names-language independently re-confirmed both directions. |
| GHID-01 | 36-01, 36-02, 36-03, 36-04 | ✓ SATISFIED | All three harness gates independently re-confirmed firing, both import routes for gate 2. |
| GHID-02 | 36-03, 36-05 | ✓ SATISFIED | Disappearance-on-both-routes independently re-confirmed. |
| GHID-03 | 36-03, 36-05 | ⚠️ SATISFIED WITH DISCLOSED NARROWING + LIVE REGRESSION | `REQUIREMENTS.md`'s own AMENDED text requires the swallowed-`MemoryConflictException` control "observed red on both import routes, not one." As executed, it was only ever exercised on `flat64k` (disclosed, reasoned: `bank.prg` cannot reach the I/O page at the `.prg` route's default base). Independently of that disclosed scope, the one route that WAS exercised now fails live due to the undisclosed CR-01 regression (gap above) — so at this moment neither route's forced-conflict proof is in a passing, committed state. |
| GHID-04 | 36-03, 36-07 | ⚠️ SATISFIED WITH DISCLOSED SHORTFALL | `DecompInterface`-sourced export, accounting identity, and `DataTypeManager` control all independently re-confirmed. `ARRAY_BOUND` and `RECORD_STRIDE` are confirmed absent on the real corpus at the entry points reached (disclosed, corpus-specific, not a code defect). |
| GHID-05 | 36-03, 36-07 | ⚠️ SATISFIED WITH DISCLOSED SHORTFALL | Typed cross-references (`READ`/`WRITE`/`READ_WRITE`) independently re-confirmed printing and parsing correctly. A resolved `COMPUTED_JUMP` reference is confirmed absent from this corpus image (cross-verified against a second release) — the kind is correctly *reportable* by the export format, but no real instance exists to report on this evidence. |

No orphaned requirements: `REQUIREMENTS.md`'s traceability table maps exactly these 9 ids to
Phase 36, and all 9 appear in at least one plan's declared `requirements` field.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase created
or modified. No stub return patterns found in the vendored SLEIGH source, the two Ghidra
scripts, or the TypeScript seam files.

## Human Verification Required

### 1. GHID-03: is the `.prg`-route forced-conflict control's absence acceptable, or must the fixture be widened?

**Test:** Decide whether `GHID-03`'s AMENDED requirement text ("observed red on both import
routes, not one") is satisfied by exercising the swallowed-`MemoryConflictException` control on
the `flat64k` route only, given `bank.prg` cannot reach the I/O page at the `.prg` route's
default load address.
**Expected:** Either (a) accept this as an intentional, disclosed, unavoidable-with-this-fixture
narrowing (an override), or (b) require a larger/differently-based `.prg` fixture so the same
forced-conflict control can also be observed red on the `.prg` route.
**Why human:** This is a scope-interpretation decision about a requirement's literal wording
against a measured fixture limitation, not a fact a script can resolve. ROADMAP criterion 4's
own "both routes" qualifier is textually scoped to the *disappearance* proof, not explicitly
restated for the loader-owned-block/conflict clause — so there is a real, reasoned argument that
the ROADMAP itself does not require this specific control on both routes even though
`REQUIREMENTS.md`'s AMENDED `GHID-03` text says so more strongly.

### 2. Criterion 5 / GHID-04 / GHID-05: is "at least one resolved computed jump" met by a disclosed, cross-verified absence?

**Test:** Decide whether ROADMAP criterion 5's literal wording ("at least one resolved computed
jump" as one of five structural facts to be exported "from a real binary") is satisfied when the
only real corpus available demonstrably contains no such construct at the entry points reached —
every computed transfer is the "BRK trick" through the unresolvable hardware IRQ vector, correctly
captured in `## UNRESOLVED_DISPATCH` instead, and this absence was independently confirmed against
a second, unrelated crack of the same game.
**Expected:** Either (a) accept the disclosed absence as the milestone's own established pattern
for computed-dispatch measurements (Phase 23's criterion 2 and Phase 38's criterion 2 both treat
"a corpus containing no computed dispatch" as a reportable fact rather than a failure, though
neither Phase 36's ROADMAP text nor `GHID-04`/`GHID-05`'s REQUIREMENTS.md text contains that same
explicit escape clause), or (b) require a corpus search deep enough to reach the game's own
(currently-packed) code before this criterion can close, since the depacked game code — where a
genuine resolved computed jump might exist — was never reached by this phase's five entry points.
**Why human:** Same class of judgment as item 1 — a literal-wording-vs-measured-reality gap the
executor disclosed rather than hid, requiring an owner decision (or an override) rather than a
mechanical re-check. `ARRAY_BOUND` and `RECORD_STRIDE` being similarly absent on this corpus is
noted for the same decision, though the environment notes single out the computed-jump case as
the one requiring explicit judgment.

**This looks intentional and well-evidenced.** To accept either or both of the above as resolved
deviations, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "GHID-03: the swallowed-MemoryConflictException control is observed red on both import routes"
    reason: "bank.prg is too small to reach the I/O page at the .prg route's default load address; flat64k is the only route on which a loader-owned-block conflict is naturally reachable with this fixture"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
  - must_have: "ROADMAP SC5: at least one resolved computed jump is exported from a real binary"
    reason: "The only real corpus available (danish.d64, cross-verified against saeger.d64) contains no resolved computed jump at the entry points this phase's harness reaches; every computed transfer is the BRK trick through the unresolvable hardware IRQ vector, correctly reported as unresolved dispatch instead"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

## Gaps Summary

**One genuine, live-reproducible regression (BLOCKER):** `ghidra-live.test.ts`'s "VOLATILE forced
conflict (flat64k route)" test — one of this phase's own committed proofs for `GHID-02`/`GHID-03`'s
"a memory conflict must be loud, never a silent fall-back" invariant — currently fails when run
live against real Ghidra 12.1.3. The cause is a code-review fix (`CR-01`, `f8ed2bab`) that
correctly hardened `runGhidraAnalyze()` to reject on a thrown script, applied *after* plan 36-05
committed this test, which updated the sibling GATE 1 case in the same file but not this one. This
is invisible to `npm run test:automated` (the file is `MANUAL_ONLY_TESTS`) and was not caught by
`36-REVIEW-FIX.md`'s own verification (which ran GATE 1 live but not this file's full suite) — so
neither SUMMARY.md nor REVIEW-FIX.md's "all green" claims cover it, and no phase artifact discloses
it. The fix is small and precise (see the gap's `missing` list above); this is not evidence the
underlying volatile-carve mechanism is broken — if anything, CR-01 made the real failure mode
*louder* — but the specific committed test proving that fact needs a matching one-line-of-reasoning
update before this phase can be called done.

**Two disclosed, well-evidenced shortfalls against literal ROADMAP/REQUIREMENTS wording,
requiring an owner decision rather than a mechanical fix:** `GHID-03`'s forced-conflict control
was only ever exercised on one route (a fixture-size limitation, not a code defect), and ROADMAP
criterion 5's "at least one resolved computed jump" is genuinely absent from the only real corpus
available at the depth this phase's entry points reach (a corpus/depth limitation, cross-verified
against a second release, not a code defect). Both are honestly and specifically disclosed in the
phase's own `SUMMARY.md`/findings-doc artifacts — exactly the behavior this verification process
exists to reward rather than penalize — and are surfaced here as human-verification items with a
ready-to-accept override block rather than scored as blocking gaps.

Once the one regression above is fixed (or, if the fix reveals something worse, re-investigated),
and the two disclosed items are either overridden or given a follow-up plan, this phase's goal is
substantively achieved: the independently re-verified evidence shows a real, working SLEIGH
extension covering all 105 undocumented opcode bytes under its own installed language, a harness
whose three gates genuinely fire, a volatile carve genuinely proven by disappearance on both
routes, and structural facts genuinely sourced from `DecompInterface` rather than
`DataTypeManager` on a real binary.

---

_Verified: 2026-09-04T21:31:24Z_
_Verifier: Claude (gsd-verifier)_
