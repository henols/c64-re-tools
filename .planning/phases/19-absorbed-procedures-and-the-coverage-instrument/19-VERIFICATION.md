---
phase: 19-absorbed-procedures-and-the-coverage-instrument
verified: 2026-08-25T05:55:58Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  previous_verified: 2026-08-24T18:46:48Z
  gaps_closed:
    - "SC2 / ABS-02 — the elected MIT licence's permission notice now ships, byte-exactly, in all three notices files, and the sentence the same commit falsified is gone. Confirmed against the real upstream repository over the network, not against the project's own manifest."
    - "SC4 clause C, route 1 — `namesACaller()` is anchored on a hex-token and identifier boundary; the NC4-plus-colliding-hex gaming attempt no longer buys a clean verdict, and a both-directions control is committed."
  gaps_remaining:
    - "SC4 / COV-02 — the census-inflation route. Narrowed by 19-08's gate, NOT closed: `hasDispatchContext()`'s third accepted shape is an ordinary 16-bit zero-page pointer construction, which is not dispatch evidence. Reproduced at report level against HEAD."
  regressions:
    - "The full test suite went RED (2 failures) at commit `80c544b` — this phase's own second code-review report added five findings (CR-04, WR-13, WR-14, WR-15, IN-05) with no recorded disposition. `docs-review-disposition.test.ts` (AUDIT-01) fails; `audit-integrity.test.ts` (D-12-02) cascades. The tree was 0-fail immediately before that commit."
gaps:
  - truth: "SC4 — Running the coverage tool against a binary reports three distinct numbers — structural completeness, the Auto-versus-User label ratio, and a sampled independent-reproducibility result ... (phase goal: 'a coverage instrument ... that resists being gamed')"
    status: partial
    reason: >-
      Clauses A (three separately-addressable numbers, never one aggregate), B (a mechanically
      auto-labelled or "handles data" binary visibly fails) and C (the multi-caller
      cross-reference rule) now all hold — C was genuinely fixed by 19-06 and is held down by a
      both-directions control. What does NOT hold is the goal's own qualifier: the structural
      completeness number, which is one of the three numbers SC4 mandates, is still
      manufacturable out of ordinary data. 19-08 gated the class-3 split-table scan, but
      `hasDispatchContext()` (`src/mcp/vice/r2000-coverage.ts:644-662`) accepts, as one of three
      sufficient shapes, "two stores into consecutive zero-page addresses". That is the
      construction of ANY 16-bit pointer — `lda ($fb),y` builds the identical thing — not of a
      dispatch. The predicate never looks at what CONSUMES the vector it saw being built.
      REPRODUCED INDEPENDENTLY, at report level, through the shipped `buildCoverageReport()`,
      against HEAD `80c544b`: two 64-byte payloads at `$0810` containing 17 bytes of real code and
      47 bytes of ordinary data, identical except for the addressing mode of two loads, and
      neither containing a `jmp ($nnnn)` opcode (`0x6c`) or a single `pha` anywhere in the image:

        INDEXED  (zp vector built, consumed by `lda ($fb),y`):
          reached=25  tableEntry=16  unreached=23  splitTables=1  splitTableCandidates=0
        IMMEDIATE twin:
          reached=17  tableEntry=0   unreached=47  splitTables=0  splitTableCandidates=0

      41 of 64 bytes claimed as code-or-table on a program with 17 bytes of code, and
      `classAt(census, 0x0840)` returns `reached-as-instruction` for what is a cleared data
      buffer. `provenDispatchTargets()` — the module's declared single seam, whose own doc
      comment reads "ADDING A SOURCE HERE IS THE DECISION TO TREAT THAT SOURCE AS PROOF OF CODE"
      — returns all eight reconstructed values. That decision is being made by accident, one
      level down, inside `hasDispatchContext`.

      The prior verification's own remediation text named exactly three admissible gates —
      "a following indexed indirect jump, a pha/pha/rts idiom, or a corroborating
      cross-reference". The shipped gate adds a fourth shape that is outside that enumeration and
      is not dispatch evidence.

      This also violates 19-08's and 19-09's shared prohibition, verbatim: "MUST NOT let a control
      fixture's incidental text stand in for an enforced rule — a heuristic with a positive
      control and no negative one is not evidence that it declines anything." The two committed
      false-positive controls (FP1 `fp1-indexed-copy-loop`, FP1b `fp1b-immediate-copy-loop`, and
      the in-suite `ORDINARY_INDEXED_COPY`) carry NO zero-page store at all, and the positive
      control `SPLIT_TABLE` carries a real `jmp ($00fb)`. The two bracket the OUTSIDE of the gate.
      Nothing exercises its interior — a vector that is built and then consumed by something
      other than a jump — which is why a 2517-passing suite conceals it.

      Blocking rather than cosmetic: the phase goal says "before any decomposition work runs under
      it", and ROADMAP Phase 20 ("Decomposition to Closure") both depends on this instrument and
      is instructed to "Run Phase 19's coverage instrument throughout this phase". A structural
      completeness number that inflates on the single most ordinary 6502 idiom (indirect-indexed
      data access) cannot gate that sweep.
    artifacts:
      - path: "src/mcp/vice/r2000-coverage.ts"
        issue: "`hasDispatchContext()` at :644-662 accepts two consecutive zero-page stores as proof of dispatch. Condition (c) also contributes almost nothing over (d): `resolveSplitOrientation()` at :679-712 already requires the same two consecutive zero-page store consumers, so in the ordinary tight-pointer case the very same two instructions satisfy both."
      - path: "src/mcp/vice/r2000-coverage.test.ts"
        issue: "Test adequacy. `dispatch class 3 DECLINES an ordinary two-table indexed read loop` (:781) and `an ordinary indexed copy loop does not inflate the census over its immediate twin` (:808) are both built on payloads with no zero-page store. The gate's interior has no control."
      - path: "src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/store.json"
        issue: "FP1/FP1b prove the census declines a pairing with no vector construction. They cannot prove it declines a pairing whose vector is built and then consumed by a data read."
      - path: ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md"
        issue: "CR-04 records this defect and has no disposition anywhere, which is itself what turns the test suite red (see the second gap)."
    missing:
      - "Require the CONSUMER, not the construction: a zero-page vector may count only when an indirect-jump opcode within reach dispatches through the vector that was actually built (match `insn.operand.value` of the `0x6c` against the lower of the two consecutive zero-page store targets). `19-REVIEW.md` CR-04 carries a ready patch."
      - "Add the interior control the gate has never had — the payload above, asserting `splitTables === []`, `provenDispatchTargets(scan) === []` and `classAt(census, 0x0840) === \"unreached\"`; ideally as a third generated fixture (`fp2-zeropage-data-pointer`) so the statement lands at report level, where the gap is actually phrased."
      - "Apply the same treatment to the class-4 stack-return scan (WR-14): it pours into `provenDispatchTargets()` with no index-register match, no target-decodability check and a guessed entry count, and has no negative control at all. Its committed positive fixture already proves a mid-instruction address ($c006, the third byte of `lda $c013,x`)."
      - "Re-check REQUIREMENTS.md line 59 / line 135 — COV-02 correctly remains unchecked and `Gaps Found`; keep it that way until the gate holds."
  - truth: "The phase's own artifacts leave the workspace test suite RED — `cd src/mcp/vice && npm test` reports 2 failures"
    status: failed
    reason: >-
      Independently confirmed on the full suite (never `test:automated`): `# tests 2564,
      # pass 2517, # fail 2`, exit 1, 95.8s.
      (1) `docs-review-disposition.test.ts:338` — "every REVIEW.md finding id anywhere in
      .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)" fails naming five ids,
      all in this phase's `19-REVIEW.md`: CR-04, IN-05, WR-13, WR-14, WR-15.
      (2) `audit-integrity.test.ts:225` — D-12-02, "no milestone audit declares a gated status
      while any docs guard is red", cascades from it while five milestone audits declare a gated
      status. Its message names seven red guards, but six of the seven
      (`docs-core-value-decision`, `docs-dangling-refs`, `docs-deferred-ledger`,
      `docs-fork-decision`, `docs-linerefs`, `docs-r2000-decisions`) pass when run standalone —
      spot-checked three, all exit 0 — so exactly one guard is genuinely red, and it is (1).
      This is a documentation-ledger gap rather than a code regression, but the tree IS red and
      the phase cannot be called complete over it. `deferred-items.md` declared both conditions
      "clears when the last gap-closure plan (19-09) lands its SUMMARY"; 19-09 landed and they did
      not clear, because the second review pass added five new undispositioned findings after it.
    artifacts:
      - path: ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md"
        issue: "CR-04, WR-13, WR-14, WR-15, IN-05 have no disposition in any of the guard's five accepted sources."
      - path: ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md"
        issue: "Both deferred conditions are recorded as clearing when 19-09 lands. 19-09 has landed; neither cleared. The ledger now understates the state."
    missing:
      - "Fix CR-04 in code and cite the plan/SUMMARY that did it (it must not be dispositioned as accepted — it is the defect SC4 turns on)."
      - "Record a disposition for WR-13, WR-14, WR-15 and IN-05 — fixed-and-cited, or a filed todo naming the reason."
      - "Re-run the full suite to 0 failures before the phase is closed; the `[skip release]` hold's lifting condition is a no-gaps re-verification, and a red tree is a gap."
deferred:
  - truth: "Human review of the coverage report's `flat-three` schema (`COVERAGE_SCHEMA_VERSION`, `COVERAGE_REPORT_KEYS`) before it is depended on"
    addressed_in: "Phase 20"
    evidence: "ROADMAP Phase 20 notes: 'The coverage report's `flat-three` schema was auto-selected under `yolo` mode and never reviewed by a human (19-DECISIONS.md, closing note). This phase's first use of the report is the moment to confirm or revise it, before Phase 21 hardens the commitment.' Carried forward from the prior verification's human item 2; note the schema has since moved to version 2 (19-08) with the same nine top-level keys."
coincidental_reliance_items:
  - truth: "SC2 — the notices guard proves every file that claims incorporation reproduces the permission notice"
    reason: fixture-only
    harden: "The guard's obligation is keyed on INCORPORATION_CLAIM_PATTERN, derived from the incorporated-material heading's shared phrase. That is deliberately NOT the notice heading (19-07 records the reasoning: keying on the notice section would make the test tautological). The residual reliance is that a future notices file could incorporate the prose while phrasing its claim differently and so owe nothing. Advisory only — the claim phrase is currently identical across all three files and is itself asserted."
---

# Phase 19: Absorbed Procedures and the Coverage Instrument — Verification Report

**Phase Goal:** Upstream's five analyze procedures become this project's own skills — absorbed, attributed, and diffed against the curated surface — and a coverage instrument exists that resists being gamed, before any decomposition work runs under it.

**Verified:** 2026-08-25T05:55:58Z (HEAD `80c544b`)
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plans 19-06 … 19-09

## Goal Achievement

The goal has two halves joined by "and". **The absorption half is now fully achieved** — the one
outstanding defect against it (the licence-inclusion claim) was genuinely and carefully fixed, and
I confirmed the fix against the real upstream repository over the network rather than against the
project's own manifest. **The instrument half is still not.** The goal's qualifier is "a coverage
instrument … that **resists being gamed**", and one of the two gaming routes the prior
verification reproduced is still open at HEAD. It was narrowed, not closed: where the pre-19-08
code accepted any two indexed loads, the post-19-08 code additionally requires a zero-page pointer
construction — which is a *lower* bar than it sounds, because indirect-indexed **data** access is
one of the most common shapes in 6502 code and builds the identical vector. I reproduced the
inflation at report level, through `buildCoverageReport()`, before ruling on it.

The trailing clause "before any decomposition work runs under it" is what makes this blocking
rather than cosmetic. Phase 20 is *Decomposition to Closure*, depends on this phase by name, and
is instructed by ROADMAP to run this instrument *throughout* rather than once at the end.

Separately, the phase leaves the workspace test suite red, from its own review ledger.

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Five procedures absorbed at a pinned commit into `c64-program-recon`/`c64-memory-mapping` + a new routine-queue-walker; every tool call diffed against the curated `r2000_*` surface; zero runtime dependency on `.agent/skills/` | ✓ VERIFIED | Regression-clean. 5 `ATTRIBUTION (ABS-02)` blocks across exactly three destinations (routine-queue-walker ×1, c64-memory-mapping ×2, c64-program-recon ×2), each naming the pin `493f8404…` (5 occurrences). `check-skill-tool-coverage.mjs` exit 0 — 37 distinct `vice_*` names across 33 files / 7 skill dirs, 31 resolved on the stock manifest, every non-resolved one classified; `r2000_*`: 17 distinct names, **all curated**; 8/8 r2000 CLI verbs named by at least one skill file. `grep -rn "\.agent/skills" src/skills/` → **0 hits**. |
| 2 | Per-file attribution header naming source repo, file path, pinned commit; `THIRD-PARTY-NOTICES.md` records the true dual `MIT OR Apache-2.0` for the absorbed text specifically | ✓ VERIFIED | **Gap closed, confirmed against upstream.** Fetched `LICENSE-MIT` from `ricardoquesada/regenerator2000` at `493f840418f1450a342bb220c2fe3d2585dd0525`: 1072 bytes, sha256 `e2579ce7…4973b`. Extracted the reproduced block from each of the three notices files — root, `installer/`, `src/mcp/vice/` — all three are **1072 bytes, sha256 `e2579ce7…4973b`**: byte-exact, identical, upstream-matching. The falsified sentence at `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117` is gone, replaced by an accurate statement (":124-128") that this package "packs no skill file at all (compare the two `files[]` lists), which is precisely why the notice is reproduced in this document". Verified true: `check-npm-packages.mjs` exit 0 — `@henols/vice-mcp` 75 files, `@henols/c64-re-tools` 34 files / **7 skills**. Guard added with a planted-violation control (`skill-attribution.test.ts:624`, `:692` alters one word and asserts the digest no longer matches, `:717` forbids the deleted claim with whitespace normalisation). The legal judgement the prior verification routed to a human was taken at 19-07's checkpoint — option `approve-wording-release-on-reverification` — so it is resolved, not re-raised. |
| 3 | No two skills contend for the same trigger; a pairwise description check runs clean across all of them | ✓ VERIFIED | Regression-clean. `check-skill-description-overlap.mjs` exit 0: 7 skills, **21 pairs** (= n(n−1)/2 for n=7), observed maximum **0.250** (`c64-program-recon` :: `c64-provenance-diff`) against an inclusive threshold of 0.35, **allowlist size 0**, and CLAUDE.md's project-skills table byte-identical to all 7 SKILL.md descriptions. No skill removed, no exemption added, threshold unchanged. |
| 4 | Three distinct numbers, never one aggregate; a mechanically auto-labelled or "handles data" binary visibly fails; any label reached from >1 call site requires cross-reference-backed documentation to count | ✗ FAILED | Clauses A, B and C all hold — C was genuinely fixed. The **goal qualifier fails**: CR-04 reproduced at report level against HEAD. See Gaps and Behavioural Spot-Checks. |
| 5 | Packer identity surfaced as a recon finding; the snapshot-versus-drift trade is a dated decision naming its own re-sync trigger | ✓ VERIFIED | Regression-clean. `packer-finding.mjs` present (26,302 bytes) and wired — `c64-program-recon/SKILL.md:88-89` names it from the repo root with both an ordinary and an `--entropy` invocation. `19-DECISIONS.md` Decision 1 is dated **2026-08-24**, states the snapshot trade explicitly ("no live link back to upstream and no automatic notification"), pins 53,392 bytes across five paths with per-file sha256, and names a re-sync trigger whose mechanism is a hash comparison against `manifest.resync_triggers` — checkable, not aspirational. |

**Score: 4/5 truths verified** (0 present-but-behaviour-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Human review of the `flat-three` coverage report schema before it is depended on | Phase 20 | ROADMAP Phase 20 note names it verbatim: "This phase's first use of the report is the moment to confirm or revise it, before Phase 21 hardens the commitment." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `THIRD-PARTY-NOTICES.md` (×3) | Reproduce the upstream MIT permission notice byte-exactly; record the dual licence for the absorbed text | ✓ VERIFIED | All three carry a 1072-byte block with sha256 `e2579ce7…4973b`, equal to the fetched upstream file at the pin |
| `src/mcp/vice/skill-attribution.test.ts` | Guard the notice claim, with a planted-violation control | ✓ VERIFIED | `:624` presence-and-digest test over every file claiming incorporation; `:692` one-word-alteration control; `:717` forbidden-claim check |
| `scripts/check-npm-packages.mjs` | Assert a packed notices file reproduces the notice | ✓ VERIFIED | `:95-112`, exit 0 on the real tree |
| `src/mcp/vice/r2000-coverage.ts` | The dispatch-context gate, the advisory split-table class, the single proven-target seam | ⚠️ WIRED BUT DEFEATABLE | `COVERAGE_SCHEMA_VERSION` = 2; `COVERAGE_REPORT_KEYS` still the same nine keys; `splitTableCandidates` exists as an advisory sibling and is never read by `provenDispatchTargets()`; `buildCoverageReport()` seeds from `provenDispatchTargets()` only (`:1659`). The gate itself (`:644-662`) admits an ordinary data-pointer construction — see Gaps |
| `src/mcp/vice/fixtures/coverage/fp1{,b}-*` | Generated false-positive census control pair | ⚠️ PRESENT, INSUFFICIENT | 8 fixture dirs total; generator idempotent (two consecutive regenerations leave `git status --porcelain src/mcp/vice/fixtures/coverage` empty). Neither payload carries a zero-page store, so neither reaches the gate's interior |
| `.planning/…/19-VALIDATION.md` | Extended, not replaced | ✓ VERIFIED | `git diff` over 19-09's commit: 85 insertions, **1 deletion**, and the single deleted line is the frontmatter field `closed_by: 19-05` — zero table rows removed |
| `.planning/…/19-REVIEW.md` | Second-pass review with dispositions | ✗ INCOMPLETE | 24 findings; 5 (CR-04, WR-13, WR-14, WR-15, IN-05) have no disposition, which fails AUDIT-01 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `buildCoverageReport()` | `computeStructuralCensus()` | `extraSeeds: provenDispatchTargets(dispatch)` | ✓ WIRED | `r2000-coverage.ts:1656-1659`; never `discoveredTargets`, never `splitTableCandidates` — confirmed by reading, and by my repro reproducing the identical numbers through the public entry point |
| `hasDispatchContext()` | `provenDispatchTargets()` | gate at `:871`, `:907-911` deciding `splitTables` membership | ⚠️ WIRED, WRONG PREDICATE | The link exists and functions; the predicate admits non-dispatch evidence, so the seam's stated contract ("proof of code") is not upheld |
| `c64-program-recon/SKILL.md` | `packer-finding.mjs` | named script path from the repo root | ✓ WIRED | `:88-89` |
| notices files | absorbed skill prose | `INCORPORATION_CLAIM_PATTERN` on the shared claim phrase | ✓ WIRED | Deliberately not keyed on the notice heading, so the presence test is not tautological |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `buildCoverageReport()` | `structural.reachedAsInstruction` | recursive descent from `seeds` ∪ `provenDispatchTargets(dispatch)` | Yes, but **over-produces** | ⚠️ INFLATED — 25 reported on a 17-byte-code payload |
| `buildCoverageReport()` | `structural.tableEntry` | `dispatch.tableEntryAddresses` | Yes, but over-produces | ⚠️ INFLATED — 16 bytes claimed from an unproven pairing |
| `buildCoverageReport()` | `labels.kindRatio` | `computeLabelRatio(symbols, …)` over the store | Yes | ✓ FLOWING |
| `buildCoverageReport()` | `reproducibility.multiCallerUndocumented` | `crossReferences` + anchored `namesACaller()` | Yes | ✓ FLOWING |
| `buildCoverageReport()` | `commentVacuity` / `divergence` | store comments / blocks | Yes | ✓ FLOWING |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Full workspace suite (once, never `test:automated`) | `cd src/mcp/vice && npm test` | `# tests 2564  # pass 2517  # fail 2`, exit 1, 95.8s | ✗ FAIL |
| Are the six cascaded guards genuinely red? | `node --test docs-core-value-decision.test.ts` etc. | 3/3 spot-checked PASS standalone | ✓ PASS (cascade confirmed spurious; the seventh is real) |
| Upstream MIT licence matches the reproduced notice | `curl …/493f8404…/LICENSE-MIT \| sha256sum` vs the block in each of 3 notices files | 1072 bytes / `e2579ce7…4973b` — all four identical | ✓ PASS |
| Package contents match the notices claim | `node scripts/check-npm-packages.mjs` | exit 0; `@henols/vice-mcp` 75 files (0 skills), `@henols/c64-re-tools` 34 files / 7 skills | ✓ PASS |
| Pairwise trigger uniqueness | `node scripts/check-skill-description-overlap.mjs` | exit 0; 21 pairs, max 0.250, allowlist 0 | ✓ PASS |
| Curated-surface tool diff | `node scripts/check-skill-tool-coverage.mjs` | exit 0; 17 `r2000_*` names, all curated | ✓ PASS |
| Fixture generator idempotency | run `make-coverage-fixtures.mjs` twice, then `git status --porcelain` | empty | ✓ PASS |
| **CR-04 interior of the dispatch gate** (scan level) | custom 64-byte payload, no `0x6c`, no `pha`; `scanIndirectDispatch` + `computeStructuralCensus` | `splitTables=1`, `provenDispatchTargets=[$0840…$0847]`, `tableEntryAddresses=16`, reached 17→25, `classAt($0840)`: `unreached` → `reached-as-instruction` | ✗ FAIL |
| **CR-04 through the shipped entry point** (report level) | `buildCoverageReport()` on the indexed payload and its immediate twin | indexed `reached=25 tableEntry=16 unreached=23 splitTables=1`; immediate `reached=17 tableEntry=0 unreached=47 splitTables=0` — 17 real code bytes in both | ✗ FAIL |
| SC4 clause C anchoring (the fixed route) | in-suite `ANCHORING: a colliding longer hex …` (`r2000-coverage.test.ts:556`) and the identifier-boundary control (`:608`) | both pass in the green run; NC4+`$8106` still `{count:1,addresses:[0x0820]}` and non-clean, NC5 still clean | ✓ PASS |
| SC4 clauses A/B (negative controls) | NC1, NC1b, NC2, NC3, NC5 in the green run | NC1/NC1b name `labels`, NC2 names `commentVacuity`, NC3 names `divergence`, NC5 clean; NC1b and NC3 "earns its place" tests pass | ✓ PASS |

### Probe Execution

No probes declared or discoverable — `find scripts -path '*/tests/probe-*.sh'` returns nothing and
no PLAN references one. Step 7c: **N/A**.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| ABS-01 | 19-01, 19-02 | Five procedures absorbed at a pinned commit, tool calls diffed, no `.agent/skills/` runtime dependency | ✓ SATISFIED | Truth 1. REQUIREMENTS.md line 46 correctly still unchecked pending this verification |
| ABS-02 | 19-01, 19-02, 19-07 | Per-file + notices attribution under the true dual licence | ✓ SATISFIED | Truth 2. **The `[x]` at line 48 and `Complete` at line 131 were set by 19-07's own metadata commit `354bbfa`, not earned by verification — I treated the box as unearned and decided on evidence. The evidence supports it independently.** |
| ABS-03 | 19-05 | Pairwise trigger uniqueness across the whole inventory | ✓ SATISFIED | Truth 3 |
| ABS-04 | 19-01, 19-05 | Dated snapshot-versus-drift decision with a named re-sync trigger | ✓ SATISFIED | Truth 5 |
| COV-01 | 19-03, 19-04, 19-08, 19-09 | Three distinct numbers, never one aggregate | ⚠️ PARTIAL | The separation holds (nine top-level keys, no combined figure, advisory class never summed) — but one of the three numbers is not trustworthy (Gap 1) |
| COV-02 | 19-03, 19-06, 19-08, 19-09 | A vacuous pass is detectable; multi-caller labels need cross-reference-backed documentation | ✗ BLOCKED | Multi-caller rule now holds; the anti-gaming property does not (Gap 1). REQUIREMENTS.md line 59 unchecked and line 135 `Gaps Found` — correct, and 19-09 truth 4 required exactly this |
| SURF-03 | 19-04 | Packer identity surfaced as a recon finding | ✓ SATISFIED | Truth 5 |

No orphaned requirements: all seven IDs mapped to Phase 19 in REQUIREMENTS.md lines 129-135 are
claimed by at least one plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` across all 22 non-planning files this phase touched | — | **None found.** Debt-marker gate clean |
| `src/mcp/vice/r2000-coverage.test.ts` | 781, 808 | Positive-control-only bracketing — negative controls that cannot reach the predicate they claim to constrain | 🛑 Blocker | Directly violates the phase's own written prohibition; the reason a 2517-passing suite conceals CR-04 |
| `.planning/…/19-REVIEW.md` | — | 5 findings with no disposition | 🛑 Blocker | Turns AUDIT-01 red and cascades D-12-02 |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---|---|---|---|---|
| `r2000-coverage.test.ts` | COV-01, COV-02 | yes | none in-scope | No — fixtures are generated from declared payloads, and the generator asserts its own shared-program invariant | Value / behavioural (report-level `deepEqual` on `multiCallerUndocumented`, census counts) | ⚠️ **INSUFFICIENT for COV-02's anti-gaming clause.** Every split-table negative control is constructed so it cannot reach `hasDispatchContext`'s third branch. Strong assertions over an unreachable region |
| `skill-attribution.test.ts` | ABS-02 | yes | none | No — the digest is pinned against a network-fetched upstream file, and a planted one-word alteration is asserted NOT to match | Value (byte count + sha256) + planted-violation | ✓ ADEQUATE |
| `skill-description-overlap.test.ts` | ABS-03 | yes | none | No | Value + boundary + emptied-corpus control | ✓ ADEQUATE |
| `packer-finding.test.mjs` | SURF-03 | 16 | 1 (visible live-oracle gate) | No | Value + throws-on-empty | ✓ ADEQUATE (the skip is not the only test for any clause) |

**Disabled tests on requirements:** 1 visible, non-exclusive skip → not a blocker.
**Circular patterns detected:** 0.
**Insufficient assertions:** 1 → 🛑 Blocker, because the requirement it is insufficient for (COV-02's anti-gaming clause) is the one this phase turns on.

### Decision Coverage

`19-DECISIONS.md` carries five dated decisions. Decision 1 (snapshot/re-sync) and Decision 2
(the two proposed tools, carried into ROADMAP Phase 20's notes by name) are both traceable into
shipped artifacts. Non-blocking; no drift observed.

### Human Verification Required

None outstanding. The prior verification's two human items are both resolved or deferred:

1. **Licence election and notice sufficiency** — taken at 19-07's checkpoint, option
   `approve-wording-release-on-reverification`. Recorded verbatim in `19-07-SUMMARY.md:100-110`.
   Not re-raised.
2. **`flat-three` schema review** — deferred to Phase 20 by ROADMAP's own note (see Deferred
   Items). Note the schema moved to version 2 during gap closure with the same nine top-level
   keys, so the deferral is still well-posed.

### Release Hold

19-07's checkpoint conditioned lifting `[skip release]` on exactly: *"Phase 19 re-verification
returns no gaps."* This re-verification **returns gaps**. The hold therefore stands; nothing may
be published on the strength of this report. All 14 gap-closure commits correctly carry
`[skip release]`, and nothing has been published.

### Gaps Summary

Two of the prior run's three concerns are genuinely closed, and closed well. The licence work
(19-07) is the strongest artifact in the phase: the notice is byte-exact against upstream in all
three files, the false sentence is replaced with a statement that is true of the actual tarball
contents, and the guard is held down by a planted-violation control that would catch a one-word
transcription drift. The multi-caller anchoring (19-06) is likewise real, and its control tests
both directions in one commit so an over-tightened rule cannot pass silently.

What remains is the same defect the prior run named, one level deeper. 19-08 was asked to gate the
class-3 split-table scan on real dispatch context and enumerated three admissible gates; it shipped
four, and the fourth — two stores into consecutive zero-page addresses — is not dispatch evidence.
It is how every 16-bit pointer on a 6502 is built, including the ones that are then read through
with `lda ($fb),y`. I reproduced the consequence at report level through the shipped
`buildCoverageReport()`: a 64-byte program with 17 bytes of code reports 25 bytes reached as
instruction and 16 more claimed as table entries, against an immediate-addressing twin that
reports the truthful 17. The instrument's headline number can still be talked into a better answer
by ordinary data, which is precisely the property the phase goal names, and Phase 20 is instructed
to run under this number continuously.

The second gap is smaller but has the same shape: the phase's own review report carries five
findings with no disposition, which leaves the workspace suite red at 2 failures. `deferred-items.md`
predicted both would clear when 19-09 landed; 19-09 landed and they did not, because the second
review pass arrived after it. A red tree cannot satisfy a lifting condition phrased as "returns no
gaps".

Both gaps trace to one root cause worth naming for the closure plan: **a heuristic's negative
control was built from the outside of the predicate it constrains.** The fix for CR-04 is small
(match the indirect-jump operand against the vector that was built); the fix that matters is the
control that reaches the gate's interior, because without it the next tightening will be verified
the same way.

---

_Verified: 2026-08-25T05:55:58Z_
_Verifier: Claude (gsd-verifier)_
