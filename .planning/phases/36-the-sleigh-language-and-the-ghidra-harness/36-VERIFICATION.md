---
phase: 36-the-sleigh-language-and-the-ghidra-harness
verified: 2026-09-04T22:00:43Z
status: passed
score: 5/5 roadmap success criteria satisfied — 3/5 fully verified with no reservations; 2/5 core mechanism verified and closed by accepted owner overrides (see `overrides` below)
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "GHID-03: the swallowed-MemoryConflictException control is observed red on both import routes"
    reason: "bank.prg is too small to reach the I/O page at the .prg route's default load address; flat64k is the only route on which a loader-owned-block conflict is naturally reachable with this fixture"
    accepted_by: "Henrik Olsson"
    accepted_at: "2026-09-05T00:00:00Z"
  - must_have: "ROADMAP SC5: at least one resolved computed jump is exported from a real binary"
    reason: "The only real corpus available (danish.d64, cross-verified against saeger.d64) contains no resolved computed jump at the entry points this phase's harness reaches; every computed transfer is the BRK trick through the unresolvable hardware IRQ vector, correctly reported as unresolved dispatch instead"
    accepted_by: "Henrik Olsson"
    accepted_at: "2026-09-05T00:00:00Z"
re_verification:
  previous_status: gaps_found
  previous_score: "4/5 roadmap success criteria fully verified; 1 criterion partially verified with a live-reproducible regression"
  gaps_closed:
    - "SC4 (ROADMAP)/GHID-03: ghidra-live.test.ts's 'VOLATILE forced conflict (flat64k route)' test no longer throws an unhandled rejection -- it is now wrapped in `await assert.rejects(...)`, mirroring the GATE 1 fix, and re-runs green live against real Ghidra 12.1.3."
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 36: The SLEIGH Language and the Ghidra Harness Verification Report

**Phase Goal:** Ghidra headless recovers structure from a real C64 image under this
project's own committed harness — all 105 undocumented opcode bytes decodable
under an extension installed as its own language, hardware writes surviving the
decompiler, and structural facts exported through `DecompInterface`.
**Verified:** 2026-09-04T22:00:43Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (commit `59f72d02`, following the initial
verification pass committed at `42263435`)

## What changed since the last pass

The previous pass (`42263435`) returned `gaps_found` with exactly one blocking gap: CR-01's
fix to `runGhidraAnalyze()` (reject when the run log carries a thrown-script signal) was
applied to the sibling "GATE 1" test case but not to plan 36-05's "VOLATILE forced conflict
(flat64k route)" test, which still called `runGhidraAnalyze()` expecting a normal return —
so it died on an unhandled rejection before any of its own assertions ran.

Commit `59f72d02` closed that gap by wrapping the call in `await assert.rejects(...)`,
mirroring the GATE 1 fix exactly. This pass **did not take that claim on trust** — it
independently re-ran the repaired test (and the full live suite around it) directly against
real Ghidra 12.1.3, plus the full automated suite and typecheck, from scratch.

**Result: the gap is closed, cleanly, with no regression.** Full re-verification below.

### Fix quality — the three things this pass was told to satisfy itself of

1. **Does the repaired test genuinely exercise its assertions, or pass vacuously?**
   Genuinely exercises them. Live re-run (`GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test
   --test-name-pattern='forced conflict' ghidra-live.test.ts`) shows both cases passing
   (`✔ ... forced conflict (flat64k route) ...`, `✔ ... forced conflict, companion ...`).
   The `assert.rejects` callback independently checks two substrings in the rejection
   message (`scriptThrew|a script threw during this run` and `exit status \(0\)`) before
   returning `true`; a vacuous pass would require both regexes to match trivially, which
   they do not (they anchor to the exact literal `runGhidraAnalyze()` emits). After the
   rejects assertion, the test still independently reads the run log from a reconstructed
   path and re-asserts `classifyGhidraRunLog(logText).scriptThrew === true` and a
   `MemoryConflictException` text match, then reads the export file and re-asserts
   `## UNRESOLVED_DISPATCH` presence and `DECOMPILE_ZERO_FUNCTIONS true`. All of the
   original test's assertions are present, just reading from a reconstructed path instead
   of a return value that no longer exists once the call throws.
2. **Was the gate weakened — does it still prove a conflict is LOUD, not a silent
   fall-back, and that export completion proves nothing about the carve?** No, if
   anything the proof is now *stronger*: the original (pre-CR-01) version merely
   inspected a normally-returned result's fields; the fixed version requires the call
   itself to *reject* — a caller who does nothing but `await` the call now gets an
   exception thrown at them, not a result they have to remember to check. The test's own
   comments (unchanged in substance from the pre-fix version, carried into the new code)
   still explicitly state the export completes normally with zero functions and that
   "export completion proves nothing about the carve — the thrown-script literal in the
   run log is the only reliable signal." This invariant is unchanged and, if anything,
   now enforced one layer earlier (at the API boundary rather than only in the log text).
3. **Is the `exitStatus` substitution honest and equivalent, or a real reduction in what
   the test proves?** Honest and equivalent. The original asserted
   `assert.equal(result.exitStatus, 0, ...)` against a returned field. Since a thrown call
   yields no `GhidraRunResult`, the fix instead asserts `/exit status \(0\)/` against the
   rejection's own message. Read `ghidra-run.ts:239-244` directly: the thrown `Error`'s
   message template is `` `...) -- analyzeHeadless's own exit status (${response.exitStatus})
   carries no information...` ``, i.e. the exact numeric value is interpolated into the
   message by the same code path the original test exercised. A wrong exit status (e.g. a
   non-zero value) would produce `exit status (N)` for N ≠ 0 and fail the regex — so the
   substitution preserves discriminating power, it does not degrade to a tautology. The
   test's own comment discloses this substitution and cites the exact line
   (`ghidra-run.ts:242`), which I confirmed still matches at that exact line number.

**Regression check on other call sites:** `grep -n "scriptThrew"` across the test files
confirms only two call sites ever expect `scriptThrew === true` (GATE 1, already fixed
before this round; forced-conflict, fixed by `59f72d02`). Every other `runGhidraAnalyze()`
call in `ghidra-live.test.ts` and `ghidra-opcode-live.test.ts` asserts `scriptThrew ===
false` and is unaffected by CR-01 (the call still returns normally). Independently
confirmed by running every one of them live below — all pass.

## Method

Independently re-ran, from a clean shell, directly against real Ghidra 12.1.3
(`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`):

- `node --test --test-name-pattern='forced conflict' ghidra-live.test.ts` — 2/2 pass
  (the specific repaired test plus its companion).
- `node --test ghidra-live.test.ts` (full file, corpus cases excluded by default) —
  **14/16 pass, 2 skipped** (corpus cases, opt-in via `VICE_LIVE_GHIDRA_CORPUS=1`), **0
  fail** — up from the previous pass's 13/16-with-1-fail.
- `VICE_LIVE_GHIDRA_CORPUS=1 node --test --test-name-pattern='forced conflict|acceptance'
  ghidra-live.test.ts` — 5/5 pass, including the acceptance run and its `DataTypeManager`
  control on the real corpus. Digests/counts (export sha256
  `c38c5eb368d704b802dff1126f2879309c11ad9afaa0388db4dfccea66f21466`, 553832 bytes;
  accounting `{attempted:10, decompiled:10, timedOut:0, failed:0}`; control
  `{composite:0, definedData:14}`; unresolved dispatch `["a665 BRK","b74c BRK"]`; found
  kinds `SELF_MODIFYING_WRITE,SPLIT_POINTER`) match the previous pass's and the committed
  evidence files' recorded numbers exactly.
- `VICE_LIVE_GHIDRA=1 VICE_LIVE_GHIDRA_CORPUS=1 node --test ghidra-opcode-live.test.ts
  sleigh-compile-gate.test.ts` — 21/21 pass, including the corpus before/after case
  (103 changed, 32 attributed) and the PLANTED VIOLATION red case.
- `node --test host-tool.test.ts ghidra-project.test.ts hostpath-consumers.test.ts
  ghidra-harness-gates.test.ts resources-sync.test.ts docs-linerefs.test.ts
  docs-dangling-refs.test.ts ci-suite-coverage.test.ts test-gate.test.ts` — 202/202 pass.
- `npm run typecheck` — clean, zero errors.
- `npm run test:automated` — **3409 tests, 3396 pass, 2 fail, 6 skipped.** The 2 failures
  are both in `anno-register.test.ts` ("DIRECTION 5 (basis integrity)" and "planted
  violation (the negative control)"), the exact pre-existing, out-of-scope pair named in
  the environment notes — confirmed by name, not just count. No regression introduced by
  `59f72d02`.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Run log names the language used; extension installed as its own `.ldefs` id; `-processor` change in the same commit; acceptance run under `6502:LE:16:default` observed FAILING the 105-byte assertion | ✓ VERIFIED | Unchanged since previous pass. Re-confirmed live: `6502_nmos.ldefs` declares `6502:LE:16:nmos` only; `SEED` and `SWEEP (stock default)` pass, the latter observing the 105-byte assertion FAIL under `6502:LE:16:default`. |
| 2 | `sleigh` compile gate observed red before fix, green after (earliest task); all 105 bytes decode; `65c02.slaspec` keeps its own meanings; unstable ops read as declared unknowns; exercised against real illegal-opcode code | ✓ VERIFIED | Unchanged since previous pass. Re-ran `sleigh-compile-gate.test.ts` (9/9, incl. PLANTED VIOLATION red case) and `ghidra-opcode-live.test.ts` (21/21 incl. corpus) live — all match. |
| 3 | Each of the harness's three gates observed firing: wrong count fires exact literal `ERROR REPORT SCRIPT ERROR` with exit 0; classification count is block total (not image size) on both routes; reproducible from committed script, Ghidra a declared host prerequisite by version | ✓ VERIFIED | Unchanged since previous pass. GATE 1 (both cases), GATE 2 (both routes), GATE 3 (reproducibility + version) all pass live. |
| 4 | Volatile-I/O carve proven by disappearance on both import routes; loader-owned block gets flag set on the EXISTING block; proven not to fall back to non-volatile through a swallowed `MemoryConflictException` | ✓ VERIFIED (mechanism); scope question open — see Human Verification | **The regression is fixed.** The forced-conflict test now passes live, genuinely rejecting via `assert.rejects` and re-confirming `MemoryConflictException`, the exact-literal `scriptThrew` signal, and that export completion carries zero decompiled functions and proves nothing about the carve. Disappearance-on-both-routes and loader-owned existing-block handling remain independently confirmed as before. The disclosed scope narrowing (forced-conflict control exercised on `flat64k` only, not `.prg`, because `bank.prg` cannot reach the I/O page at the `.prg` route's default base) is unchanged and still requires a human decision (carried forward, item 1 below). |
| 5 | Structural facts exported through `DecompInterface` (array bound, split-pointer idiom, record stride, ≥1 resolved computed jump, ≥1 self-modifying write target) with typed cross-references, accounting identity, denominator-free unresolved-dispatch reporting; `DataTypeManager` control on the same image returns essentially nothing | ⚠️ PARTIALLY VERIFIED — see Human Verification | Unchanged since previous pass. Re-confirmed live on the real corpus: `SPLIT_POINTER` and `SELF_MODIFYING_WRITE` found; accounting identity `10 = 10+0+0` under ceiling 5; typed `READ`/`WRITE`/`READ_WRITE` references present; unresolved dispatch reported as count+list with no denominator (2 sites); `DataTypeManager` control returns near-nothing (`COMPOSITE_TYPES=0`, `DEFINED_DATA=14`) vs. 183 decompiled-text lines on the acceptance route. `ARRAY_BOUND`, `RECORD_STRIDE`, and a *resolved* `COMPUTED_JUMP` remain absent from this real binary at the entry points reached — disclosed, cross-verified against a second independently-cracked release, not a code defect. This is a literal shortfall against the ROADMAP's own "at least one resolved computed jump" wording — carried forward, item 2 below. |

**Score:** 3/5 criteria (1, 2, 3) fully, independently re-verified with no reservations.
2/5 criteria (4, 5) have their core mechanism independently confirmed working — criterion 4
no longer carries any regression, only its previously-disclosed route-scope question — each
gated on one open human scope decision, not a code defect.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/vendor/ghidra-ext/` (Module.manifest, extension.properties, data/languages/*, data/sleighArgs.txt) | Vendored SLEIGH extension source, compiles clean, new `.ldefs` id | ✓ VERIFIED | 105 unique `op=0x..` constraints confirmed by direct grep; `6502_nmos.ldefs` declares only `6502:LE:16:nmos`; compiles live; no `.sla` committed (`git ls-files -- '*.sla'` is empty). |
| `src/mcp/vice/ghidra-run.ts` | Container-side orchestrator + run-log classifier | ✓ VERIFIED | `runGhidraAnalyze()` checks `verdict.scriptThrew` and throws with the exact message format (`ghidra-run.ts:239-244`) both test call sites now correctly expect. |
| `src/mcp/vice/host-tool.mts`, `ghidra-project.mts` (+ `resources/*.mjs` siblings) | `ghidra.analyze`'s full argv surface, preflight, `ghidra.installExtension` | ✓ VERIFIED | 202/202 combined tests pass live; `resources-sync.test.ts` confirms no drift between `.mts` source and compiled `.mjs`. |
| `src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java`, `GhidraStructExport.java` | Volatile carve + structural-fact export via `DecompInterface` | ✓ VERIFIED | Independently exercised live against real Ghidra; produces the exact digests/counts recorded in evidence. |
| `src/mcp/vice/ghidra-live.test.ts`, `ghidra-opcode-live.test.ts` | Registered `MANUAL_ONLY_TESTS`, both gates and both opcode suites | ✓ VERIFIED | **No longer orphaned.** `test-gate.test.ts`'s `TWELVE_OK` gate passes; every case in `ghidra-live.test.ts` (14/16 run, 2 corpus cases opt-in) and `ghidra-opcode-live.test.ts` (21/21) passes live, including the previously-failing forced-conflict case. |
| `docs/phase36-sleigh-language-and-harness-findings.md` | Consolidated findings doc | ✓ VERIFIED | Present, substantive, content cross-checked against independently re-run live output — numbers match exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `-processor 6502:LE:16:nmos` wire field | `ghidra-run.ts`'s `classifyGhidraRunLog()` | byte-exact, case-sensitive comparison against the run log's own `Using Language/Compiler:` line | ✓ WIRED | Confirmed live: mismatched processor rejected, matching processor accepted. |
| A thrown script (`ERROR REPORT SCRIPT ERROR`) | `runGhidraAnalyze()`'s return contract | `verdict.scriptThrew` check | ✓ WIRED, both test call sites | Confirmed live for GATE 1 and the 36-05 forced-conflict case (the previous gap) — both now correctly expect and observe the rejection. |
| `importRoute` → loader base address → which memory blocks exist | `VolatileCarve.java`'s `mem.getBlock()` branch | existing-block vs. create-block path | ✓ WIRED | Confirmed live on both routes and the companion existing-block case. |
| `DecompInterface` walk | `GhidraStructExport.java`'s `## STRUCTURAL_FACTS`/`## REFERENCES`/`## DECOMPILE_ACCOUNTING` sections | direct decompiler walk, never `DataTypeManager` in default mode | ✓ WIRED | Confirmed live; `DataTypeManager` control mode is a separate, explicit invocation path returning near-zero counts on the identical image. |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (`n/a` — this phase has no UI). The equivalent
trace (real Ghidra installation → `analyzeHeadless` → run log/export file → parsed
counts/digests in the test) was exercised directly above, from a real tool invocation, not
a static/mock return, at every re-run in this pass.

### Behavioral Spot-Checks / Probe Execution

This phase's "probes" are its own live Ghidra test suites, covered above under Method and
the Observable Truths table — run directly against the real, declared-prerequisite Ghidra
12.1.3 installation rather than accepted from SUMMARY.md/fix-report narration.

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| OPC-01 | 36-01, 36-06 | ✓ SATISFIED | Compile gate red→green re-confirmed; 105-byte decode re-confirmed. |
| OPC-02 | 36-06 | ✓ SATISFIED | Six unstable/page-crossing bytes re-confirmed decoding to named opaque userops. |
| OPC-03 | 36-07 | ✓ SATISFIED | Real-corpus (`danish.d64`) before/after difference re-confirmed (103 changed, 32 attributed). |
| OPC-04 | 36-01, 36-04, 36-06 | ✓ SATISFIED | Separate `.ldefs` id re-confirmed; run-log-names-language re-confirmed both directions. |
| GHID-01 | 36-01, 36-02, 36-03, 36-04 | ✓ SATISFIED | All three harness gates re-confirmed firing, both import routes for gate 2. |
| GHID-02 | 36-03, 36-05 | ✓ SATISFIED | Disappearance-on-both-routes re-confirmed. |
| GHID-03 | 36-03, 36-05 | ⚠️ SATISFIED WITH DISCLOSED NARROWING (regression closed) | The forced-conflict control now passes live on the `flat64k` route (the previous live regression is fixed and re-confirmed). The `.prg`-route narrowing disclosed in `36-05-SUMMARY.md` remains open as a human scope decision (item 1 below); this is the only outstanding item for this requirement. |
| GHID-04 | 36-03, 36-07 | ⚠️ SATISFIED WITH DISCLOSED SHORTFALL | `DecompInterface`-sourced export, accounting identity, and `DataTypeManager` control all re-confirmed. `ARRAY_BOUND`/`RECORD_STRIDE` confirmed absent on the real corpus at the entry points reached (disclosed, corpus-specific). |
| GHID-05 | 36-03, 36-07 | ⚠️ SATISFIED WITH DISCLOSED SHORTFALL | Typed cross-references re-confirmed. A resolved `COMPUTED_JUMP` reference is confirmed absent from this corpus image (cross-verified against a second release). |

No orphaned requirements: `REQUIREMENTS.md`'s traceability table maps exactly these 9 ids
to Phase 36, and all 9 appear in at least one plan's declared `requirements` field.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase
created or modified, including the gap-closure diff itself. No stub return patterns.

## Human Verification Required — RESOLVED: both accepted as overrides

**Owner decision, 2026-09-05 (Henrik Olsson): both items below were reviewed and accepted as
overrides.** The `overrides:` block in this file's frontmatter carries the accepted wording
verbatim, and `overrides_applied: 2`. Neither item was a code defect; both are measured,
cross-verified limitations of the available fixture and corpus, disclosed by the executors
in their own SUMMARYs rather than discovered afterwards.

What each override commits the project to stating, plainly:

- **Item 1** — `GHID-03`'s swallowed-`MemoryConflictException` control is proven on the
  `flat64k` route only, not on `.prg`.
- **Item 2** — Criterion 5 ships with four of its five structural facts recovered from real
  code; the fifth (a resolved computed jump), together with `ARRAY_BOUND` and
  `RECORD_STRIDE`, is recorded as **absent from the corpus reached**, not as exported.

The two items' original analysis is retained below, unedited, as the record of what was
decided and on what evidence.

Both items below are **carried forward unchanged** from the previous pass — the gap closure
did not touch either, and my judgement on each is unchanged.

### 1. GHID-03: is the `.prg`-route forced-conflict control's absence acceptable, or must the fixture be widened?

**Test:** Decide whether `GHID-03`'s AMENDED requirement text ("observed red on both import
routes, not one") is satisfied by exercising the swallowed-`MemoryConflictException` control
on the `flat64k` route only, given `bank.prg` cannot reach the I/O page at the `.prg`
route's default load address.
**Expected:** Either (a) accept this as an intentional, disclosed, unavoidable-with-this-
fixture narrowing (an override), or (b) require a larger/differently-based `.prg` fixture so
the same forced-conflict control can also be observed red on the `.prg` route.
**Why human:** A scope-interpretation decision about a requirement's literal wording against
a measured fixture limitation, not a fact a script can resolve. ROADMAP criterion 4's own
"both routes" qualifier is textually scoped to the *disappearance* proof, not explicitly
restated for the loader-owned-block/conflict clause — so there is a real, reasoned argument
that the ROADMAP itself does not require this specific control on both routes even though
`REQUIREMENTS.md`'s AMENDED `GHID-03` text says so more strongly.
**Judgement:** Unmet against `REQUIREMENTS.md`'s literal AMENDED text (only `flat64k` was
ever exercised); arguably met against the ROADMAP's narrower "both routes" scoping. Disclosed
honestly in `36-05-SUMMARY.md`. Requires an owner decision, not a fix.

### 2. Criterion 5 / GHID-04 / GHID-05: is "at least one resolved computed jump" met by a disclosed, cross-verified absence?

**Test:** Decide whether ROADMAP criterion 5's literal wording ("at least one resolved
computed jump" as one of five structural facts to be exported "from a real binary") is
satisfied when the only real corpus available demonstrably contains no such construct at the
entry points reached — every computed transfer is the "BRK trick" through the unresolvable
hardware IRQ vector, correctly captured in `## UNRESOLVED_DISPATCH` instead, independently
confirmed against a second, unrelated crack of the same game.
**Expected:** Either (a) accept the disclosed absence as the milestone's own established
pattern for computed-dispatch measurements (Phase 23's criterion 2 and Phase 38's criterion 2
both treat "a corpus containing no computed dispatch" as a reportable fact rather than a
failure, though neither Phase 36's ROADMAP text nor `GHID-04`/`GHID-05`'s REQUIREMENTS.md text
contains that same explicit escape clause), or (b) require a corpus search deep enough to
reach the game's own (currently-packed) code before this criterion can close.
**Why human:** Same class of judgment as item 1 — a literal-wording-vs-measured-reality gap
the executor disclosed rather than hid, requiring an owner decision (or an override) rather
than a mechanical re-check. `ARRAY_BOUND` and `RECORD_STRIDE` being similarly absent on this
corpus is noted for the same decision.
**Judgement:** Unmet against the ROADMAP's literal "at least one resolved computed jump"
wording — no such fact was exported because no such fact exists on the corpus reached. The
harness's *capability* to export one is not in question (the format and reference-kind
`COMPUTED_JUMP` exist and are correctly reportable); only a real instance is absent. Requires
an owner decision, not a fix.

**This looks intentional and well-evidenced.** To accept either or both of the above as
resolved deviations, add to this file's frontmatter:

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

**No remaining gaps.** The single blocking gap from the previous pass — `ghidra-live.test.ts`'s
"VOLATILE forced conflict (flat64k route)" test failing live with an unhandled rejection — is
closed by commit `59f72d02`, independently re-verified in this pass: the test now correctly
expects and observes `runGhidraAnalyze()`'s rejection, re-asserts the genuine
`MemoryConflictException`, the exact-literal thrown-script signal, and the disclosed
"export completes with zero functions and proves nothing about the carve" finding. No other
call site in either live test file was broken by the same CR-01 change (confirmed by grep and
by a full live re-run of both files — 14/16 + 2 skipped, and 21/21 respectively, 0 failures).
The full automated suite (3409 tests, 3396 pass, 2 fail, 6 skipped) shows no regression — the
2 failures are the pre-existing, out-of-scope `anno-register.test.ts` pair.

**Two disclosed, well-evidenced shortfalls against literal ROADMAP/REQUIREMENTS wording,
unchanged from the previous pass, requiring an owner decision rather than a mechanical fix:**
`GHID-03`'s forced-conflict control was only ever exercised on one route (a fixture-size
limitation, not a code defect), and ROADMAP criterion 5's "at least one resolved computed
jump" is genuinely absent from the only real corpus available at the depth this phase's entry
points reach (a corpus/depth limitation, cross-verified against a second release, not a code
defect). Both remain honestly disclosed in the phase's own artifacts and are surfaced here as
human-verification items with a ready-to-accept override block, which is why overall status
is `human_needed` rather than `passed` — not because of any remaining code defect.

With the regression closed, this phase's goal is now substantively and fully achieved at the
mechanism level: the independently re-verified evidence shows a real, working SLEIGH extension
covering all 105 undocumented opcode bytes under its own installed language, a harness whose
three gates genuinely fire, a volatile carve genuinely proven by disappearance on both routes
and by a loud (never swallowed) conflict, and structural facts genuinely sourced from
`DecompInterface` rather than `DataTypeManager` on a real binary. What remains is a scope
decision on two literal-wording-vs-measured-corpus questions, not further engineering.

---

_Verified: 2026-09-04T22:00:43Z_
_Verifier: Claude (gsd-verifier)_
