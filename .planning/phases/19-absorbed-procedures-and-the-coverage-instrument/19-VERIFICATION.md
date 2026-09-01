---
phase: 19-absorbed-procedures-and-the-coverage-instrument
verified: 2026-08-25T14:32:03Z
status: passed
score: 5/5 must-haves verified (1 override)
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "SC4 — the coverage instrument reports three distinct numbers and (phase goal) resists being gamed, before any decomposition work runs under it"
    reason: >-
      Superseded by owner decision, not closed by a fourth verification. Rounds 1-3 each closed
      the shape they were shown and were then defeated by a different shape in the same function.
      The fourth gap-closure round (plans 19-15, 19-16, 19-17, 19-18, 19-20, 19-19) was scoped by
      DEFECT CLASS rather than by finding id and did land against this gap's named instance: the
      D2 payload recorded in `superseded_gaps` below — 15 code bytes, no `0x6c` anywhere, measured
      at `reachedAsInstruction=31 / tableEntry=16 / splitTables=1 / provenDispatchTargets=8` — now
      reports `15 / 0 / 0 / []` with `classAt($0840) = "unreached"`, and WR-03's louder route
      (`64 / 0 / 4` on a 94%-garbage image) reports `4 / 60 / 4`. That measurement is the
      EXECUTORS' own, taken on their own work; no independent verifier re-ruled on it, because the
      owner directed that anno testing stop. Henrik has a separate plan for the coverage
      instrument that supersedes further gap-closure rounds against it, and accepted the residual
      risk explicitly. COV-01 is therefore accepted as an override rather than claimed as verified.
      What would reopen it: the replacement plan landing, or Phase 20's first real use of the
      instrument surfacing an inflated structural number.
    accepted_by: "henrik"
    accepted_at: "2026-08-25T14:32:03Z"
gaps: []
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  previous_verified: 2026-08-25T09:47:08Z
  round_4_disposition: >-
    Six plans executed (19-15, 19-16, 19-17, 19-18, 19-20, 19-19), 40 commits. Orchestrator-measured
    at HEAD: full `npm test` in `src/mcp/vice` 2638 tests / 2593 pass / 0 fail / exit 0; typecheck,
    installer suite (18/0), skill-script tests, `check-npm-packages`, `check-skill-tool-coverage`,
    `check-skill-fork-honesty`, `check-skill-description-overlap` and `npm run smoke` (80 tools) all
    exit 0; schema-drift and ui safety gates clean; codebase-drift advisory-warn only. The
    `code-review` capability gate was deliberately NOT invoked — every plan in the round prohibits
    regenerating `19-REVIEW.md`, whose finding ids plan 19-13's disposition ledger keys off; it
    remains byte-unchanged at `80c544b`. No independent verifier ran on the round's substance.
  gaps_closed_prior_round:
    - "SC4 / CR-04 — the census-inflation route via the zero-page pointer CONSTRUCTION is closed at its root. `hasDispatchContext()` now requires the CONSUMER (a `0x6c` operand equal to the lower of two consecutive zero-page store targets); the bare-`0x6c`-within-reach branch was removed. Reproduced INDEPENDENTLY at report level against HEAD `13cb5e1` on a payload I wrote from scratch, not the committed fixture: 18 declared code bytes report `reachedAsInstruction=18, tableEntry=0, splitTables=0, provenDispatchTargets=[]`, against the prior run's measured `25 / 16 / 1 / 8`. The pairing is still REPORTED as one advisory candidate, so it demonstrably reached the gate and was declined rather than never being examined."
    - "The workspace test suite is no longer red from this phase's own artifacts. `19-REVIEW-FIX.md` dispositions all 24 finding ids `19-REVIEW.md` declares (set equality re-derived mechanically with the guard's own regex, 24/24, zero missing). `docs-review-disposition.test.ts` 7/7 exit 0 and `audit-integrity.test.ts` 44/44 exit 0, both standalone. `19-REVIEW.md` is byte-unchanged across the whole run (0 files in `git diff --name-only a756b17..HEAD`), so finding-id continuity is preserved; `19-VALIDATION.md` and `deferred-items.md` are purely additive (93/0 and 135/0 insertions/deletions)."
  gaps_remaining_prior_round:
    - "SC4 / COV-01 — the structural-completeness number is still inflatable, by a DIFFERENT shape than the one just closed. `hasDispatchContext()`'s FIRST branch (`stack-return-push-idiom`) is reachable from the class-3 pass outside any class-4 window, and accepts. Reproduced at report level on a payload with 15 code bytes and no `jmp` opcode anywhere: `reachedAsInstruction=31, tableEntry=16, splitTables=1, provenDispatchTargets=8`, `classAt($0840)=reached-as-instruction` on a cleared buffer, while class 4 itself DECLINES the same window (`stackReturnDispatch=0`)."
  regressions: []
# Retained verbatim as history. This was the round-3 open gap; it is now carried as the
# `overrides` entry above (accepted by the owner, superseded rather than re-verified), so it
# is no longer an open gap and is not counted against the score. Kept in full because its
# measurements are the baseline the round-4 work was judged against.
superseded_gaps:
  - truth: "SC4 — the coverage instrument reports three distinct numbers and (phase goal) 'resists being gamed', before any decomposition work runs under it"
    status: superseded-by-override
    reason: >-
      Clauses A (three separately-addressable numbers, never one aggregate), B (a mechanically
      auto-labelled or "handles data" binary visibly fails) and C (the multi-caller
      cross-reference rule) all hold and are all now held down by controls with teeth. CR-04 —
      the route the prior run blocked on — is genuinely CLOSED, and I confirmed it by writing my
      own payload rather than reading the committed fixture.

      What still does not hold is the same goal qualifier, one shape over. `DISPATCH_CONTEXT_SHAPES`
      declares TWO sufficient shapes. 19-10 fixed the second (`zeropage-vector-jumped-through`) and
      gave it a real interior negative control. The FIRST (`stack-return-push-idiom`) was left as
      it was, on a documented rationale that my measurement falsifies. `anno-coverage.ts:672-678`
      states: "After the Class-4 pass runs FIRST and claims its windows, a pairing inside such a
      window is skipped outright rather than promoted here; the condition is kept so this function
      reads as a COMPLETE statement of what counts as dispatch context". That rationale covers only
      the case where class 4 *does* claim the window. When class 4 declines — because the payload
      is not its exact five-instruction shape — the pairing is NOT skipped, and this branch
      promotes it.

      REPRODUCED at report level through the shipped `buildCoverageReport()` against HEAD
      `13cb5e1`, on a 64-byte image at `$0810` containing 15 bytes of code, NO `jmp` opcode
      (`0x6c`) anywhere, and a lo/hi table pair that nothing dispatches through:

        D2  lda $0830,x / sta $fb / lda $0838,x / sta $fc / pha / txa / pha / tya / rts
              reachedAsInstruction=31  tableEntry=16  unreached=17  linearSweepDecodable=60
              splitTables=1  stackReturnDispatch=0  provenDispatchTargets=8 ($0840..$0847)
              classAt($0840) = "reached-as-instruction"   (a cleared nop buffer)

        D3  the identical payload with `rts` ONE instruction further out (past the 8-instruction
            window), which is the control proving D2 is INSIDE the predicate and not outside it:
              reachedAsInstruction=16  tableEntry=0  splitTables=0  provenDispatchTargets=0
              classAt($0840) = "unreached"

      47 of 64 bytes claimed as code-or-table on a 15-byte program, and eight fabricated "proven"
      entry points written into the JSON Phase 20 consumes. There is no contradicting sibling
      figure to give the reader a tell — `linearSweepDecodable=60` agrees — so this is a SILENT
      inflation, the same character as CR-04 and unlike the loud WR-03 route below.

      THE ROOT CAUSE IS THE NEW MECHANISM'S OWN HOLE, WHICH IS WHY THIS IS NOT MERELY "ONE MORE
      BUG". 19-10's headline deliverable was a mechanism that reds the suite BY NAME when a
      sufficient shape is admitted without a negative control reaching its interior
      (`DISPATCH_CONTEXT_SHAPES` / `GATE_INTERIOR_DECLARATIONS` / `reachesGateInterior()`). That
      mechanism passes over this hole because `reachesGateInterior()`
      (`anno-coverage.test.ts:2016-2062`) defines `stack-return-push-idiom`'s interior as a
      DISJUNCTION — the class-4 five-instruction window OR the class-3 pairing-plus-`pha`/`pha`/`rts`
      — and a control satisfying only the first disjunct is accepted as claiming the whole shape.
      All three declared interior negative rows for this shape satisfy only that first disjunct:
      `STACK_RETURN` is the exact class-4 shape (its own row says class 3 declines it "because
      class 4 runs first and claims the window"), and `STACK_RETURN_MIXED_REGISTERS` /
      `STACK_RETURN_IMPLAUSIBLE_TARGET` are class-4 controls that class 3 declines on a DIFFERENT
      condition (`sameIndexRegister`), never on the push idiom. Nothing in the suite asserts that
      class 3 declines a same-register pairing whose only dispatch evidence is a `pha`/`pha`/`rts`
      that class 4 refused to call a dispatch. That is CR-04's exact defect shape — a control
      built from the outside of the region the predicate is load-bearing in — displaced one shape
      over rather than removed.

      Blocking rather than cosmetic, for the reason the goal states: "before any decomposition
      work runs under it". ROADMAP Phase 20 depends on Phase 19 by name and is instructed to "Run
      Phase 19's coverage instrument throughout this phase, not only once at the end".
    artifacts:
      - path: "src/mcp/vice/anno-coverage.ts"
        issue: "`hasDispatchContext()` :694-722 — the `stack-return-push-idiom` branch (`if (insn.opcode === 0x60 && sawPha >= 2) return true;`) fires for the class-3 pass whenever a `pha`/`pha`/`rts` sits within `SPLIT_TABLE_WINDOW` of the leading load, regardless of whether class 4 claimed the window. The doc comment at :672-678 asserts the opposite."
      - path: "src/mcp/vice/anno-coverage.test.ts"
        issue: "`reachesGateInterior()` :2016-2062 accepts a class-4-window-only payload as reaching `stack-return-push-idiom`'s interior, so the shape-coverage test at :2244-2256 is satisfied without any control reaching the class-3 route. `GATE_INTERIOR_DECLARATIONS` :2152-2175 — all three rows for this shape are class-4 controls."
      - path: "src/mcp/vice/fixtures/coverage/"
        issue: "10 committed control fixtures, none of which carries a same-register indexed pairing with consecutive zero-page stores and a `pha`/`pha`/`rts` that class 4 declines. The FP2 pair covers the other shape only."
    missing:
      - "Close the class-3 route into `stack-return-push-idiom`. The cheapest correct fix is to make the branch mean what its comment already says: class 4 owns that idiom and now gates it properly (WR-14), so the class-3 pass should require class-4-window membership for this shape — or the branch should be deleted and `DISPATCH_CONTEXT_SHAPES` reduced to one entry, which the mechanical branch-count test will enforce."
      - "Split `reachesGateInterior()`'s disjunction. A shape whose interior is reachable by two different routes needs a negative control per route, or the disjunction lets one route's control vouch for the other. Either give the shape two ids, or make the witness require the class-3 route specifically when that is the route under test."
      - "Commit the missing interior control at report level, the way FP2 was committed: the D2 payload above, asserting `splitTables === []`, `provenDispatchTargets(scan) === []`, `tableEntryAddresses.length === 0` and `classAt(census, 0x0840) === \"unreached\"`, with the D3 window-edge twin as its measured baseline so the assertion is a bound and not a snapshot."
      - "DECIDE ON WR-03, which is currently dispositioned `deferred-with-owner` and which I measured as a second, LOUDER inflation route on the same number: 4 bytes of code followed by 60 bytes of `0x02` (JAM) reports `reachedAsInstruction=64, unreached=0, linearSweepDecodable=4` — 100% structural completeness on a 94%-garbage image. Unlike D2 the report contradicts itself visibly (64 vs 4), and the deferral's reason (the fix is gated on `use_illegal_opcodes` and needs its own dated decision) is legitimate. This is a human call, not a defect I am re-filing: promote it into this closure round, or record that Phase 20's first use of the instrument accepts it with the contradiction as the tell."
      - "Keep COV-01 unchecked and `Gaps Found` in REQUIREMENTS.md until the class-3 route is closed. COV-02's own text (vacuity detection + the multi-caller rule) IS now earned — see Requirements Coverage; the residual is attributable to COV-01's structural number, which is a narrower and more accurate attribution than the prior run's."
deferred:
  - truth: "Human review of the coverage report's `flat-three` schema (`COVERAGE_SCHEMA_VERSION` = 2, the nine `COVERAGE_REPORT_KEYS`) before it is depended on"
    addressed_in: "Phase 20"
    evidence: "ROADMAP Phase 20 notes, verbatim: 'The coverage report's `flat-three` schema was auto-selected under `yolo` mode and never reviewed by a human (19-DECISIONS.md, closing note). This phase's first use of the report is the moment to confirm or revise it, before Phase 21 hardens the commitment.' Carried forward unchanged; the schema is still version 2 with the same nine top-level keys, re-read from the module at HEAD."
coincidental_reliance_items:
  - truth: "SC2 — the notices guard proves every file that claims incorporation reproduces the permission notice"
    reason: fixture-only
    harden: "The guard's obligation is keyed on INCORPORATION_CLAIM_PATTERN, derived from the incorporated-material heading's shared phrase rather than the notice heading (19-07's reasoning: keying on the notice section would make the test tautological). The residual reliance is that a future notices file could incorporate the prose while phrasing its claim differently and so owe nothing. Advisory only, and weakened further this run: I re-fetched the upstream file over the network and the three reproduced blocks match it byte-for-byte, so the current state does not rest on the guard at all. Carried forward from the prior verification."
  - truth: "SC1 — the five absorbed procedures are pinned at a real upstream commit with true source digests"
    reason: fixture-only
    harden: "`anno-derivation.test.ts` test 5 — 'live: the five source digests re-hash to the manifest's values' — SKIPS by default unless `ANNO_UPSTREAM_CLONE` is set, so in every ordinary run the manifest's digests are checked only against themselves. I discharged it manually this run (all five re-fetched from GitHub at the pin; byte counts and sha256 exact, 5/5), but the suite still proves the pin only against the project's own file. Hardening: set `VICE_REQUIRE_ANNO_UPSTREAM=1` in CI, or commit the five upstream files' digests to a second independent location."
---

# Phase 19: Absorbed Procedures and the Coverage Instrument — Verification Report

**Phase Goal:** Upstream's five analyze procedures become this project's own skills — absorbed, attributed, and diffed against the curated surface — and a coverage instrument exists that resists being gamed, before any decomposition work runs under it.

**Status:** passed (5/5, one override) — closed 2026-08-25T14:32:03Z at HEAD `8c48c9b`
**Last independent verification:** 2026-08-25T09:47:08Z (HEAD `13cb5e1`) — returned `gaps_found`, 4/5
**Re-verification:** third gap-closure round (plans 19-10 … 19-14) was the last round a verifier ruled on

> **Read this before the analysis below.** Everything from "Goal Achievement" down to
> "Gaps Summary" is the **round-3 verdict**, preserved verbatim. It is the last independent
> verification this phase received, and its one open gap was later **accepted as an override by
> the project owner rather than re-verified** — a fourth gap-closure round (plans 19-15, 19-16,
> 19-17, 19-18, 19-20, 19-19) executed against it, but no verifier ruled on that work. The
> disposition, what the round measured, and what would reopen it are in
> **"Round 4 — Disposition"** at the end of this document and in the `overrides` frontmatter key.
> Where the text below says the instrument half "is still not achieved", read it as the state at
> HEAD `13cb5e1`, not at close.

## Goal Achievement

Both of the prior run's gaps are genuinely closed, and one of them was closed unusually well.

**The red tree is fixed for a real reason, not by rewriting a ledger.** `19-REVIEW-FIX.md`
dispositions all 24 finding ids the review declares — I re-derived the id set with the guard's own
regex and checked containment one id at a time (24/24, zero missing) rather than trusting the
frontmatter count. `19-REVIEW.md` is byte-unchanged across the entire run, so no finding id was
minted or orphaned, and the two documents that were extended (`19-VALIDATION.md`,
`deferred-items.md`) are purely additive with zero deletions. The decision not to re-invoke
`gsd-code-review` was correct: regenerating that file would have orphaned all 24 dispositions and
re-reddened AUDIT-01, and the ledger now owns the green independently of any other document
continuing to mention any id — which is the exact failure mode 19-13 diagnosed and closed.

**CR-04 is closed at its root.** I did not read the committed fixture and agree with it; I wrote my
own 64-byte payload implementing the same attack and ran it through the shipped
`buildCoverageReport()`. It reports the truthful `reachedAsInstruction=18` against 18 declared code
bytes, with `splitTables=0` and `provenDispatchTargets=[]`, and it still surfaces the pairing as one
advisory candidate — so the gate demonstrably examined and declined it rather than never seeing it.
The positive control (the same payload with a real `jmp ($00fb)`) still proves, so the fix is not
an over-tightening.

**The instrument half is still not achieved, for the same reason at a different address.** The goal
qualifier is "resists being gamed". `DISPATCH_CONTEXT_SHAPES` declares two sufficient shapes; 19-10
fixed and controlled the second and left the first standing on a rationale that says class 4 claims
those windows first. I measured a payload where class 4 *declines* the window — it is not class 4's
five-instruction shape — and the class-3 pass promoted it anyway, on the strength of a
`pha`/`pha`/`rts` that class 4 itself refused to call a dispatch. 15 bytes of code, no `jmp` opcode
in the image, and the report claims 31 bytes reached plus 16 table-entry bytes and eight fabricated
proven entry points, with a cleared buffer classed `reached-as-instruction`. There is no
contradicting sibling figure, so it is silent.

What makes this blocking rather than a nitpick is that the phase's own new anti-regression mechanism
passes over it. 19-10's stated deliverable was that admitting a shape without an interior negative
control reds the suite BY NAME. It does not, because `reachesGateInterior()` defines this shape's
interior as a disjunction and all three of its declared negative rows satisfy only the class-4
disjunct. That is CR-04's defect verbatim — "a negative control built from the outside of the
predicate it constrains is not a control" — displaced one shape over. The prior run named the root
cause and predicted this exact recurrence: *"without it the next tightening will be verified the
same way."*

## Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Five procedures absorbed at a pinned commit into `c64-program-recon`/`c64-memory-mapping` + a new routine-queue-walker; every tool call diffed against the curated `anno_*` surface; zero runtime dependency on `.agent/skills/` | ✓ VERIFIED | **Strengthened beyond the prior run by discharging the suite's skipped live oracle myself.** All five upstream files re-fetched from `an upstream repository` at `493f8404…`: byte counts `4457 / 14674 / 15308 / 9248 / 9705` and sha256 digests all EXACT against `upstream-procedure-manifest.json`. Independently diffed the tool surface at source: 20 distinct `anno_*` names appear in the upstream text, 5 of them are outside `CURATED_ANNO_TOOLS` (19 entries) — `anno_get_disassembly_cursor`, `anno_set_immediate_format`, `anno_toggle_splitter`, `anno_undo`, `anno_unpack_binary` — each is recorded with a justification in the manifest (3–6 mentions apiece) and each appears **zero times** anywhere in `src/skills/`. 5 `ATTRIBUTION (ABS-02)` blocks across exactly three destinations (routine-queue-walker ×1, c64-memory-mapping ×2, c64-program-recon ×2), 5 occurrences of the pin. `check-skill-tool-coverage.mjs` exit 0 — 37 `vice_*` names over 33 files / 7 skill dirs, `anno_*` 17 distinct, all curated, 8/8 CLI verbs named. `grep -rn "\.agent/skills" src/skills/` → 0 hits. |
| 2 | Per-file attribution header naming source repo, file path, pinned commit; `THIRD-PARTY-NOTICES.md` records the true dual `MIT OR Apache-2.0` for the absorbed text specifically | ✓ VERIFIED | Regression-clean, re-confirmed against the network rather than against the project. Fetched `LICENSE-MIT` at the pin: 1072 bytes, sha256 `e2579ce7…4973b`. Extracted the fenced block from each of the three notices files (root, `installer/`, `src/mcp/vice/`) — all three 1072 bytes, all three sha256 `e2579ce7…4973b`: four identical artefacts. Dual licence recorded for the absorbed text specifically (`THIRD-PARTY-NOTICES.md:14`, "the external analyser analysis procedures (`MIT OR Apache-2.0` …)"). `skill-attribution.test.ts` 12/12 exit 0; `check-npm-packages.mjs` exit 0 — `@henols/vice-mcp` 75 files, `@henols/c64-re-tools` 34 files / 7 skills, so the mcp package's claim that it packs no skill file remains true of the real tarball. |
| 3 | No two skills contend for the same trigger; a pairwise description check runs clean across all of them | ✓ VERIFIED | Regression-clean. `check-skill-description-overlap.mjs` exit 0: 7 skills, **21 pairs** (= n(n−1)/2 for n=7), observed maximum **0.250** (`c64-program-recon` :: `c64-provenance-diff`) against an inclusive 0.35 threshold, **allowlist size 0**, and CLAUDE.md's project-skills table 7 rows all byte-identical to their SKILL.md. `skill-description-overlap.test.ts` 32/32. No skill removed, no exemption added, threshold unchanged. |
| 4 | Three distinct numbers, never one aggregate; a mechanically auto-labelled or "handles data" binary visibly fails; any label reached from >1 call site requires cross-reference-backed documentation | ✗ FAILED | Clauses A, B and C all hold; CR-04 is closed and independently re-measured. The **goal qualifier fails**: the class-3 route into `stack-return-push-idiom` is uncontrolled and silently inflates the structural number (D2 above). See Gaps and Behavioural Spot-Checks. |
| 5 | Packer identity surfaced as a recon finding; the snapshot-versus-drift trade is a dated decision naming its own re-sync trigger | ✓ VERIFIED | Regression-clean. `packer-finding.mjs` present (26,302 bytes) and wired — `c64-program-recon/SKILL.md:88-89` names it from the repo root with both an ordinary and an `--entropy` invocation. `19-DECISIONS.md` Decision 1 dated **2026-08-24**, states the snapshot trade explicitly, and names a re-sync trigger whose mechanism is a hash comparison against `manifest.resync_triggers`; `anno-derivation.test.ts` test 3 ("ABS-04's re-sync triggers are named and each carries a mechanism") passes. |

**Score: 4/5 truths verified** (0 present-but-behaviour-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Human review of the `flat-three` coverage report schema before it is depended on | Phase 20 | ROADMAP Phase 20 note names it verbatim: "This phase's first use of the report is the moment to confirm or revise it, before Phase 21 hardens the commitment." Schema re-read at HEAD: version 2, nine keys, unchanged. |

WR-03 is deliberately **not** filed here. Step 9b requires clear, specific evidence in a later
phase's roadmap section, and Phase 20's "Run Phase 19's coverage instrument throughout" is generic;
the "Phase 20's first use of the instrument" owner is the ledger's own assignment, not roadmap text.
It is surfaced inside the SC4 gap as a human decision instead.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-coverage.ts` | Consumer-matched dispatch gate; one derived `effectiveEnd`; shared `isPlausibleEntryPoint()`; reference-demanding `citesCallerByName()` | ⚠️ WIRED, ONE BRANCH STILL DEFEATABLE | `DISPATCH_CONTEXT_SHAPES` = 2 entries; the bare-`0x6c` branch is gone and the surviving zero-page shape matches `insn.operand.value` against the lower of two consecutive zp store targets (`:717-722`) — verified by reading and by report-level repro. `effectiveEnd = Math.min(safeOrigin + size, 0x10000)` defined once at `:793` and read at `:795`, `:816`, `:860`, `:954`, `:1066`. `isPlausibleEntryPoint()` `:815-819` read by class 4's (d) at `:962` and class 3's (e) at `:1075`. `CALLER_CITATION_WORDS` frozen at `:1504`. Residual: the `stack-return-push-idiom` branch at `:707` — see Gaps |
| `src/mcp/vice/fixtures/coverage/fp2-zeropage-data-pointer` + `fp2b-immediate-data-pointer` | The gate's first interior negative control and its measured immediate twin | ✓ VERIFIED | Both committed; `COMMITTED_CONTROL_FIXTURES = 10` matches `ls -d fixtures/coverage/*/` = 10. FP2's store declares `code_size: 17`, `expect_clean: false`, and its purpose field states the pre-fix numbers it was observed RED against. Asserted at report level through `reportFor()` at `:1820-1850`, including `classAt($0840) === "unreached"` and the advisory-candidate count of 1 |
| `DISPATCH_CONTEXT_SHAPES` / `GATE_INTERIOR_DECLARATIONS` / `reachesGateInterior()` | A mechanism that reds the suite by name when a shape is admitted without an interior control | ⚠️ PRESENT, HOLE IN ONE SHAPE | The branch-count test (source-text parse of `hasDispatchContext()`'s true-returning sites vs the array length) is real and would catch a fourth branch. The interior-declaration witness is real and throws on an unknown id. But its `stack-return-push-idiom` predicate is a disjunction, so a class-4-only control claims the whole shape — the mechanism passes over the very region the branch is load-bearing in |
| `.planning/…/19-REVIEW-FIX.md` | Durable disposition ledger covering every declared finding id | ✓ VERIFIED | 24 ids derived with the guard's own regex from `19-REVIEW.md`; all 24 word-matched in the ledger (0 missing). Frontmatter `fixed: 10 / rejected: 1 / deferred: 13` reconciles with the table. Records that `IN-06` is cited in the review's prose but declared nowhere, so nothing is dispositioned against a non-existent id. Names 19-09's un-honoured deferral of IN-02 against itself rather than glossing it |
| `.planning/…/19-REVIEW.md` | Byte-unchanged, finding-id continuity preserved | ✓ VERIFIED | `git diff --name-only a756b17..HEAD -- 19-REVIEW.md` → 0 files |
| `.planning/…/19-VALIDATION.md`, `deferred-items.md` | Extended, not replaced | ✓ VERIFIED | `git diff --numstat a756b17..HEAD` → `93 0` and `135 0`. Zero deletions in either |
| `THIRD-PARTY-NOTICES.md` (×3) | Upstream MIT permission notice byte-exact; dual licence for the absorbed text | ✓ VERIFIED | 1072 bytes / sha256 `e2579ce7…4973b` in all three, equal to the file fetched from upstream at the pin |
| `src/skills/routine-queue-walker/SKILL.md` | The new skill nothing previously owned | ✓ VERIFIED | Present with an `ATTRIBUTION (ABS-02)` block naming repo, upstream path, pin, source sha256 and the dual licence; the source digest re-hashes against upstream |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `buildCoverageReport()` | `computeStructuralCensus()` | `extraSeeds: provenDispatchTargets(dispatch)` | ✓ WIRED | `anno-coverage.ts:1934-1938`; never `discoveredTargets`, never `splitTableCandidates`. Confirmed by reading and by my repro reproducing seed sets through the public entry point |
| `hasDispatchContext()` | `provenDispatchTargets()` | class-3 gate condition (c) at `:1042`, deciding `splitTables` membership at `:1077-1084` | ⚠️ WIRED, ONE BRANCH ADMITS NON-DISPATCH EVIDENCE | The zero-page shape now upholds the seam's "proof of code" contract. The push-idiom shape does not, when class 4 has declined the window |
| `isPlausibleEntryPoint()` | class 4 (d) and class 3 (e) | one closure at `:815`, called at `:962` and `:1075` | ✓ WIRED | WR-14's "two halves of one seam held to different standards" is genuinely resolved — one definition, two readers, verified by grep and by the class-4 negative controls |
| `citesCallerByName()` | `reproducibility.multiCallerUndocumented` | `:1622` inside the documented-label test | ✓ WIRED | `CALLER_CITATION_WORDS` frozen at `:1504`; `nc4` still caught by name, `nc5` still clean, in the green 71/71 run |
| `c64-program-recon/SKILL.md` | `packer-finding.mjs` | named script path from the repo root | ✓ WIRED | `:88-89`, both invocations |
| shipped skill prose | `.planning/phases/19-…/*` | provenance citations | ⚠️ PRESENT, DANGLING AT ARCHIVAL | 7 citations across 3 SKILL.md files. Inspected in context: all are provenance statements inside attribution blocks ("The full upstream path is recorded once, in …"), **not** runtime read instructions, so SC1's no-runtime-dependency clause is unaffected. They will dangle once GSD archives the phase directory — WR-11, deferred with a named owner |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `buildCoverageReport()` | `structural.reachedAsInstruction` | recursive descent from `seeds` ∪ `provenDispatchTargets(dispatch)` | Yes, and now truthful on the CR-04 shape — but still **over-produces** on the push-idiom shape and on illegal-opcode runs | ⚠️ INFLATED — 31 reported on a 15-byte-code payload (D2); 64 reported on a 4-byte-code payload (WR-03) |
| `buildCoverageReport()` | `structural.tableEntry` | `dispatch.tableEntryAddresses` | Yes, over-produces on the same shape | ⚠️ INFLATED — 16 bytes claimed from an unproven pairing (D2); correctly 0 on the CR-04 shape |
| `buildCoverageReport()` | `labels.kindRatio` | `computeLabelRatio(symbols, …)` over the store, excluding multi-caller addresses | Yes | ✓ FLOWING |
| `buildCoverageReport()` | `reproducibility.multiCallerUndocumented` | `crossReferences` + anchored `namesACaller()` + `citesCallerByName()` | Yes | ✓ FLOWING |
| `buildCoverageReport()` | `commentVacuity` / `divergence` | store comments / blocks | Yes | ✓ FLOWING |
| `buildCoverageReport()` | `reproducibility` cross-reference bound | `MAX_COVERAGE_CROSS_REFERENCE_LOOKUPS` = 512 | Applied, but **never recorded in the JSON** | ⚠️ UNREPORTED — WR-04, deferred. The review's own words: "precisely COV-02's 'a measure computed over less than the whole population must say so', violated on the machine-readable side" — and Phase 20 consumes the JSON, not the printed NOTE |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Full workspace suite, run **once** (never `test:automated`) | `cd src/mcp/vice && npm test` | `# tests 2580  # pass 2534  # fail 1`, exit 1, 219s. The single failure is `not ok 858 — stub: a child that answers nothing within the call timeout …`, i.e. deferred item 3's known load-sensitive flake, at the same test index it was last observed at | ⚠️ ONE KNOWN FLAKE (see Warnings) |
| Is that failure the documented flake and not a regression? | `node --test anno-session.test.ts` standalone | `# tests 25  # pass 25  # fail 0`, exit 0 | ✓ PASS |
| Typecheck | `npx tsc --noEmit` in `src/mcp/vice` | exit 0 | ✓ PASS |
| Disposition guard (AUDIT-01) | `node --test docs-review-disposition.test.ts` | 7/7, exit 0 | ✓ PASS |
| D-12-02 cascade resolved | `node --test audit-integrity.test.ts` | 44/44, exit 0 | ✓ PASS |
| Coverage instrument suite | `node --test anno-coverage.test.ts` | 71/71, exit 0 | ✓ PASS |
| Ledger covers every declared id | derive ids with the guard's own regex, then word-match each into `19-REVIEW-FIX.md` | 24 ids derived, **0 missing** | ✓ PASS |
| Upstream procedure digests (the oracle the suite SKIPS) | fetch all five `.agent/skills/*/SKILL.md` at `493f8404…`, compare bytes + sha256 to the manifest | 5/5 exact | ✓ PASS |
| Upstream MIT notice vs the three reproduced blocks | fetch `LICENSE-MIT` at the pin; extract each fenced block; sha256 | four identical 1072-byte artefacts, `e2579ce7…4973b` | ✓ PASS |
| No absorbed step calls an uncurated tool | extract `anno_*` from the five fetched upstream files; diff against `CURATED_ANNO_TOOLS`; grep the 5 non-curated names across `src/skills/` | 5 non-curated upstream names, all justified in the manifest, **0 occurrences** in shipped skills | ✓ PASS |
| Pairwise trigger uniqueness | `node scripts/check-skill-description-overlap.mjs` | exit 0; 21 pairs, max 0.250, allowlist 0 | ✓ PASS |
| Curated-surface tool diff over shipped skills | `node scripts/check-skill-tool-coverage.mjs` | exit 0; 17 `anno_*`, all curated | ✓ PASS |
| Package contents match the notices claim | `node scripts/check-npm-packages.mjs` | exit 0; 75 files / 34 files + 7 skills | ✓ PASS |
| Clause A — three separately-addressable numbers, no aggregate | read `COVERAGE_SCHEMA_VERSION` and `COVERAGE_REPORT_KEYS` from the module | version 2; keys `schemaVersion, generatedAt, project, structural, dispatch, labels, commentVacuity, reproducibility, divergence` — three number groups, no combined figure | ✓ PASS |
| **CR-04 closed — my own payload, report level** | 64-byte image, 18 code bytes, zp vector consumed by `lda ($fb),y`, no `0x6c`, no `pha`; `buildCoverageReport()` | `reached=18  tableEntry=0  unreached=44  splitTables=0  proven=0  candidates=1`; immediate twin `reached=16 / 0 / 48 / 0 / 0`. Prior run measured `25 / 16 / 23 / 1 / 8` pre-fix | ✓ PASS |
| CR-04 fix is not an over-tightening | same payload with a real `jmp ($00fb)` through the built vector | `splitTables=1`, 8 proven targets `$0840..$0847`, `tableEntry=16` — genuine dispatch still proves | ✓ PASS |
| **D2 — class-3 route into `stack-return-push-idiom`** | 15 code bytes, no `0x6c` anywhere, `pha`/`txa`/`pha`/`tya`/`rts` within the 8-instruction window; `buildCoverageReport()` | `reached=31  tableEntry=16  unreached=17  splitTables=1  stackReturn=0  proven=8`; `classAt($0840)="reached-as-instruction"` on a cleared buffer | ✗ FAIL |
| D3 — the window-edge control proving D2 is *inside* the predicate | identical payload, `rts` one instruction beyond `SPLIT_TABLE_WINDOW` | `reached=16  tableEntry=0  splitTables=0  proven=0`; `classAt($0840)="unreached"` | ✓ PASS (boundary discriminates) |
| **WR-03 — illegal-opcode inflation (deferred finding, measured)** | 4 code bytes then 60 bytes of `0x02` (JAM); `buildCoverageReport()` | `reached=64  unreached=0  linearSweepDecodable=4` — 100% structural completeness, and the two contrasted figures disagree 16× | ⚠️ FAIL (loud, deferred with owner) |

### Probe Execution

No probes declared or discoverable — `find scripts -path '*/tests/probe-*.sh'` returns nothing and
no PLAN references one. Step 7c: **N/A**.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| ABS-01 | 19-01, 19-02 | Five procedures absorbed at a pinned commit, tool calls diffed, no `.agent/skills/` runtime dependency | ✓ SATISFIED | Truth 1, now with the upstream oracle discharged by hand. Ready to tick |
| ABS-02 | 19-01, 19-02, 19-07 | Per-file + notices attribution under the true dual licence | ✓ SATISFIED | Truth 2, confirmed against the network. Ready to tick |
| ABS-03 | 19-05 | Pairwise trigger uniqueness across the whole inventory | ✓ SATISFIED | Truth 3. Ready to tick |
| ABS-04 | 19-01, 19-05 | Dated snapshot-versus-drift decision with a named re-sync trigger | ✓ SATISFIED | Truth 5. Ready to tick |
| SURF-03 | 19-04 | Packer identity surfaced as a recon finding | ✓ SATISFIED | Truth 5. Ready to tick |
| COV-01 | 19-03, 19-04, 19-08, 19-09, 19-10, 19-11, 19-12 | Coverage reported as three distinct numbers, never one aggregate | ✗ BLOCKED | The separation holds (nine keys, no combined figure, `splitTableCandidates` advisory and never summed) — but one of the three numbers is still manufacturable (Gap 1: D2 silently, WR-03 loudly). Keep unchecked / `Gaps Found` |
| COV-02 | 19-03, 19-06, 19-08, 19-09, 19-12 | A vacuous pass is detectable; multi-caller labels need cross-reference-backed documentation | ✓ SATISFIED | **Attribution corrected from the prior run.** COV-02's literal text is vacuity detection plus the multi-caller rule. Both hold and both are controlled: NC1/NC1b name `labels`, NC2 names `commentVacuity`, NC3 names `divergence`, NC5 clean, NC4 still caught by `reproducibility` by name, and WR-13 closed the "an ordinary English word happens to be a caller's name" hole with `CALLER_CITATION_WORDS` frozen. The residual anti-gaming defect is on the *structural* number, which is COV-01's, not COV-02's. Ready to tick — with the caveat that WR-04 leaves the cross-reference bound out of the JSON, which the review itself calls a COV-02-adjacent violation on the machine-readable side (deferred, Phase 20) |

No orphaned requirements: all seven IDs mapped to Phase 19 in REQUIREMENTS.md lines 129-135 are
claimed by at least one plan. All seven rows are currently unchecked and `Gaps Found`, and
correctly so — commit `0315d9c` reverted the premature ticks and the three plans that declined to
set them were right to. Five are now earned on evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` (debt-marker gate) | — | **None found** across every non-planning file changed in the range. Gate clean |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **None found**. Gate clean |
| `src/mcp/vice/anno-coverage.ts` | 672-678 | A doc comment asserting a property the code does not have ("a pairing inside such a window is skipped outright rather than promoted here") | 🛑 Blocker | The rationale that justifies leaving the push-idiom branch unfixed is false whenever class 4 declines the window. A false WHY comment in a file whose whole convention is documented WHYs is worse than none |
| `src/mcp/vice/anno-coverage.test.ts` | 2016-2062, 2152-2175 | Interior-control declaration satisfied by a control on the wrong side of the region under test — the same outside-bracketing pattern CR-04 turned on | 🛑 Blocker | Why a 2534-passing suite conceals D2 |
| `src/mcp/vice/anno-coverage.ts` | 437 vs 473 | Descent and linear sweep apply different rules to `illegal` opcodes | ⚠️ Warning | WR-03, deferred with owner. Measured: 100% structural completeness on a 94%-garbage image |
| `src/skills/*/SKILL.md` | 7 citations | Hard-coded `.planning/phases/19-…` paths in shipped prose | ⚠️ Warning | WR-11, deferred. Verified to be provenance text, not runtime instructions, so SC1 is unaffected; they dangle once the phase is archived |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---|---|---|---|---|
| `anno-coverage.test.ts` | COV-01, COV-02 | 71 | none in scope | No — fixtures are generated from declared payloads; the generator asserts its own shared-program invariant; the FP2 store declares its own `code_size` bound so the test does not type in the expected number | Value / behavioural (report-level `deepEqual`, census counts, `classAt` classes) | ⚠️ **INSUFFICIENT for one of the two declared dispatch shapes.** `stack-return-push-idiom` has three declared interior negative rows and all three are class-4 controls; nothing asserts the class-3 decline. Strong assertions over a region, with an adjacent region uncovered and a mechanism that reports it as covered |
| `skill-attribution.test.ts` | ABS-02 | 12 | none | No — the digest is pinned against a network-fetchable upstream file and a planted one-word alteration is asserted NOT to match | Value (byte count + sha256) + planted-violation | ✓ ADEQUATE |
| `skill-description-overlap.test.ts` | ABS-03 | 32 | none | No | Value + boundary + emptied-corpus control | ✓ ADEQUATE |
| `anno-derivation.test.ts` | ABS-01, ABS-04 | 4 | 1 (the live digest oracle) | The skip makes the manifest's digests self-referential in an ordinary run | Value + justification/citation coverage | ⚠️ ADEQUATE WITH A CAVEAT — the skip is non-exclusive for the classification claims but IS the only check of the digests. Discharged by hand this run (5/5 against upstream); recorded as a coincidental-reliance item |
| `packer-finding.test.mjs` | SURF-03 | 16 | 1 (visible live-oracle gate) | No | Value + throws-on-empty | ✓ ADEQUATE |

**Disabled tests on requirements:** 2 visible live-oracle skips, both non-exclusive for their
requirement's classification claims; one (the upstream digest oracle) is the sole check of a
sub-claim and is flagged rather than absorbed. Not a blocker.
**Circular patterns detected:** 0.
**Insufficient assertions:** 1 → 🛑 Blocker, because the region it leaves uncovered is the one the
phase goal's qualifier turns on.

### Decision Coverage

No `*-CONTEXT.md` exists for this phase, so the `check.decision-coverage-verify` gate is skipped
cleanly. Read informally instead: `19-DECISIONS.md` carries five decisions, all dated 2026-08-24.
Decision 1 (snapshot / re-sync trigger) is traceable into
`upstream-procedure-manifest.json`'s `resync_triggers`, which a passing test asserts carries a
mechanism per trigger. Decision 2 (the two proposed tools) is carried into ROADMAP Phase 20's notes
by name, with an explicit withdrawal condition. Non-blocking; no drift observed.

### Warnings (non-blocking, human awareness)

1. **A live flake fired in my run.** The full suite came back `# fail 1` on
   `anno-session.test.ts`'s `stub: a child that answers nothing within the call timeout …`
   (`not ok 858`) — deferred item 3, a real spawned child against a 200 ms wall-clock budget while
   `node --test` runs files concurrently across 12 cores. Standalone it passed 25/25 immediately
   afterwards, and `git log a756b17..HEAD -- anno-session.*` is empty, so it is not this phase's
   regression. But the running tally is now **3 red in 7 full-suite runs** on 2026-08-25 against
   **0 red in 5 standalone runs**: a green full-suite observation for this phase is probabilistic,
   not proof, and no plan in this run could own the fix. Owner unchanged: a plan that owns
   `anno-session.ts`.
2. **WR-04 leaves a bounded measure unlabelled in the machine-readable report.** The
   cross-reference cap prints a NOTE but never reaches the JSON. Phase 20 reads the JSON.
3. **WR-03 is a second, louder inflation route on the same number** (measured above). Deferred with
   a legitimate reason; promoted here to a human decision rather than re-filed as a defect.
4. **WR-11's shipped-prose planning-path citations** will dangle at the next archive. Confirmed
   harmless to SC1 (provenance text, not runtime reads).

### Human Verification Required

None outstanding. Every prior human item is resolved or deferred:

1. **Licence election and notice sufficiency** — taken at 19-07's checkpoint
   (`approve-wording-release-on-reverification`). Not re-raised; the artefact is byte-verified
   against upstream.
2. **`flat-three` schema review** — deferred to Phase 20 by ROADMAP's own note (see Deferred
   Items).

The one *new* judgment call — whether WR-03 is promoted into this closure round — is filed inside
Gap 1's `missing` list rather than as a separate human item, because it is actionable by the
closure plan either way.

### Release Hold

19-07's checkpoint conditioned lifting `[skip release]` on exactly: *"Phase 19 re-verification
returns no gaps."* This re-verification **returns one gap**. The hold therefore stands. All 19
commits in this phase carry `[skip release]` and nothing has been published.

### Gaps Summary

Both of the prior run's gaps are closed, and the work that closed them is the best in the phase.
The disposition ledger is a genuine structural fix rather than a green-making edit: it takes
ownership of the guard away from nine documents that happened to quote an id, it names the
`19-REVIEW.md` byte-identity it depends on, and it records the one deferral a previous plan failed
to honour against itself instead of glossing it. The CR-04 fix is likewise real — I reproduced it
from my own payload through the shipped entry point, and I confirmed the positive control still
proves, so it was not bought with an over-tightening.

The remaining gap is the same sentence the prior run closed with, and it came true. 19-10 built a
mechanism whose stated job was to make "a sufficient shape admitted without an interior negative
control" red the suite by name, then fixed one of the two shapes that mechanism governs. The other
shape kept a rationale — class 4 claims those windows first — that is only true when class 4's exact
five-instruction pattern matches. I wrote a payload where it does not match, and class 3 promoted
the pairing anyway: 15 bytes of code, no `jmp` opcode in the image, 31 bytes reported reached, 16
more claimed as table entries, eight fabricated proven entry points, and a cleared buffer classed
`reached-as-instruction`. The window-edge twin declines, which is what proves the payload is inside
the predicate rather than beside it.

The mechanism does not catch this because `reachesGateInterior()` defines that shape's interior as a
disjunction and every control declared against it satisfies only the class-4 half. So the fix has
two parts and the second matters more than the first: close the class-3 route (deleting the branch
is defensible — class 4 owns the idiom and now gates it properly), and split the witness so a shape
reachable by two routes owes a control per route. Otherwise the next tightening is verified the same
way for the third time.

Separately, and for the human rather than the planner: the structural number has a second inflation
route that nobody has closed and everybody has seen. Four bytes of code followed by sixty bytes of
`$02` reports 100% structural completeness with `unreached=0`. That one is at least loud — the
sibling `linearSweepDecodable=4` contradicts it 16× on the same report — and its deferral reason is
sound. But Phase 20 is instructed to run *under* this number continuously, so someone should decide
it rather than inherit it.

---

## Round 4 — Disposition

**This section was written by the execute-phase orchestrator, not by a verifier.** No independent
verification ran on the round-4 work. That is the single most important fact about this closure and
it is stated first deliberately.

### What happened

The round-3 gap above — SC4's goal qualifier, requirement COV-01 — was the fourth consecutive
verification to find the structural-completeness number inflatable, each time by a different shape
in the same function. A fourth gap-closure round was planned and executed against it, scoped by
**defect class** rather than by finding id (`19-CONTEXT.md` D-01), with the stated acceptance bar
(D-07) that every new gate be *demonstrated to fail* when its control is removed.

Six plans landed across six waves, 40 commits:

| Plan | What it changed |
|---|---|
| 19-15 | `hasDispatchContext()` branch A requires a proven push link tied to the pairing under test |
| 19-16 | Branch B compares against `pairing.oriented.vectorLow`; source-derived pin asserts every `return true` site's depth-1 guard chain names `pairing` |
| 19-17 | `anno-coverage-grammar.test.ts` — 2000-payload composed corpus, computed oracle, one set-equality property in both directions |
| 19-18 | Control identity re-keyed from *shape* to *(shape, route)*; route set derived from source; four source pins |
| 19-20 | WR-03 closed — `isDecodableAsInstruction()`, one predicate, three consumers |
| 19-19 | Seven-gate consolidation in `19-VALIDATION.md`; full-suite gate |

Against this gap's own two named payloads, the executors measured:

- **D2** (15 code bytes, no `0x6c` in the image): `31 / 16 / 1 / 8` → **`15 / 0 / 0 / []`**, `classAt($0840)` now `unreached`
- **WR-03** (4 code bytes + 60 × `$02`): `64 / 0 / 4` → **`4 / 60 / 4`**; the `$ea`-filled twin still `64 / 0 / 64`

### Why it is an override and not a pass

Those numbers are the executors' measurements of their own work. The mechanism that converts an
executor's claim into a verdict is a verifier run, and the project owner directed that anno testing
stop — a separate plan supersedes further gap-closure rounds against this instrument. Closing the
phase on `passed` without saying so would misrepresent the evidence, so the gap is carried as an
`overrides` entry: accepted, attributed, dated, with its reopen condition named.

### Orchestrator-measured at HEAD `8c48c9b`

These are independent of the executors:

- Full `npm test` in `src/mcp/vice`: **2638 tests, 2593 pass, 0 fail, 0 `not ok`, exit 0**
- `npm run typecheck` exit 0 · installer `npm test` 18/0 · `node --test 'src/skills/*/scripts/*.test.mjs'` exit 0
- `check-npm-packages.mjs`, `check-skill-tool-coverage.mjs`, `check-skill-fork-honesty.mjs`, `check-skill-description-overlap.mjs` all exit 0 · `npm run smoke` OK (80 tools)
- Capability gates: schema-drift clean, ui safety-gate clean, codebase-drift **advisory-warn only** (`.planning/codebase/` map stale against `src`, `LICENSE`, `THIRD-PARTY-NOTICES.md`, `VERSION`, `.gitignore`)
- The two known contention flakes (`vice-proxy.test.ts` `:1594`/`:2260`, `anno-session.test.ts`'s 200 ms budget) did **not** reproduce; both remain open in `deferred-items.md`

### Gates deliberately not run

- **Code review.** `workflow.code_review` is on, but all six plans prohibit regenerating
  `19-REVIEW.md`, whose 24 finding ids plan 19-13's disposition ledger keys off. Regenerating would
  orphan them and re-redden AUDIT-01 — the exact failure mode 19-13 closed. Left byte-unchanged at
  `80c544b`. The gate is advisory and never blocking.
- **Licensing / ABS-02 scrutiny.** The project owner has accepted all licensing and attribution
  risk in this repository and directed that it stop being treated as a concern. Not re-examined.

### What would reopen this

The replacement plan for the coverage instrument landing, or Phase 20's first real use of the
instrument surfacing an inflated structural number. Phase 20 is instructed to run *under* this
number continuously, so that use is the natural checkpoint.

---

_Round-3 verification: 2026-08-25T09:47:08Z — Claude (gsd-verifier)_
_Round-4 disposition: 2026-08-25T14:32:03Z — Claude (execute-phase orchestrator), override accepted by henrik_
