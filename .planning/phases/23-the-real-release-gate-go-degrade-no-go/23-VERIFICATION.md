---
phase: 23-the-real-release-gate-go-degrade-no-go
verified: 2026-08-26T18:09:32Z
score: 2/5 must-haves verified + 3 accepted overrides = 5/5 accounted for (the 3 are accepted as NOT MET, not reclassified as met)
behavior_unverified: 0
overrides_applied: 3
overrides:
  - must_have: "dxa's data-recovery rate and false-positive count are readable as numbers against a named real release, printed beside the 279-byte fixture's claim"
    reason: "Blocked on a reproducible flat-64K capture, which is blocked on a frame-exact emulator stop that provably does not exist today (201 multi-bit divergences between two snapshot-derived danish runs, re-measured during verification). Recorded no-go under the pre-committed rule R1; re-scoping v0.6.0 is the milestone-level answer, not re-running this phase. A --gaps cycle would produce plans that cannot run, which is the substitution R1 exists to prevent."
    accepted_by: "henrik (asked at phase close and delegated the decision to the execute-phase orchestrator)"
    accepted_at: "2026-08-26T18:44:56Z"
  - must_have: "A computed-index indirect dispatch from real code is resolved by Ghidra with the target shown, or recorded as unresolved with its transcript"
    reason: "Same substrate blocker (D-03). Correctly recorded could-not-run rather than the flattering not-exercised, which the findings document states was never earned because no pre-committed inventory exists to earn it."
    accepted_by: "henrik (asked at phase close and delegated the decision to the execute-phase orchestrator)"
    accepted_at: "2026-08-26T18:44:56Z"
  - must_have: "The point at which a single forward-carried $01 value stops being correct is established rather than assumed"
    reason: "Same substrate blocker (D-03). AUTO-04/AUTO-05 are recorded unvalidated in the Phase 26 ROADMAP entry rather than silently narrowed."
    accepted_by: "henrik (asked at phase close and delegated the decision to the execute-phase orchestrator)"
    accepted_at: "2026-08-26T18:44:56Z"
override_note: |
  The three overridden must-haves are the "re-measure against real cracked releases" half of
  the phase goal. They are accepted as NOT MET, not reclassified as met. The other half -- a
  recorded verdict from a rule frozen before any number existed -- was delivered and is bound
  into Phases 24/25/26, STATE.md and REQUIREMENTS.md. PROOF-01/02/03 remain Pending in
  REQUIREMENTS.md and must not be flipped by this override.
  Verification warnings W1, W2 and W4 were closed before the override was applied
  (commit 9320279); W3 is left to the nyquist validate-phase step that owns 23-VALIDATION.md.
status: passed
decision_coverage:
  honored: 11
  total: 11
  not_honored: []
gaps:
  - truth: "SC1 — dxa's data-recovery rate and false-positive count are readable as numbers against a named real release, printed beside the 279-byte fixture's 72%-data / 0-false-positive claim, with the error direction re-measured"
    status: failed
    reason: "No criterion-1 measurement exists. `evidence/criterion1-dxa-classification.txt` is absent; plans 23-05, 23-06 and 23-07 were deliberately not dispatched because 23-03 could not produce the depacked flat-64K substrate (D-03). Recorded honestly as `could-not-run` in the findings frontmatter and as `Pending / not met` in REQUIREMENTS.md — but the number the phase goal names does not exist."
    artifacts:
      - path: ".planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion1-dxa-classification.txt"
        issue: "File does not exist. All three rule inputs it would carry (C1_ADJUDICATED_FRACTION, C1_DATA_RECOVERY_PCT, C1_FALSE_POSITIVES) are `could-not-run`."
    missing:
      - "A reproducible flat-64K capture of a real release (blocked on a frame-exact emulator stop)"
      - "A VICE-observed certain-code / certain-data inventory and measurement window W (23-05)"
      - "A cracker hold-out from the provenance diff (23-06)"
      - "The criterion-1 computation itself (23-07)"
  - truth: "SC2 — a computed-index indirect dispatch taken from real code is either resolved by Ghidra with the target shown, or recorded as unresolved with its transcript; a corpus containing none is reported as not-exercised"
    status: failed
    reason: "No criterion-2 measurement exists. `evidence/criterion2-ghidra-dispatch.txt` is absent; 23-08 was not dispatched for want of the capture substrate. Correctly recorded `could-not-run` and explicitly NOT `not-exercised` — `not-exercised` would have been a false claim about a corpus never analysed."
    artifacts:
      - path: ".planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion2-ghidra-dispatch.txt"
        issue: "File does not exist. C2_COMPUTED_DISPATCH is `could-not-run`."
    missing:
      - "A depacked capture to run Ghidra headless against"
      - "The independent runtime dispatch-site enumeration from 23-05 that criterion 2 checks Ghidra against"
  - truth: "SC3 — the point at which a single forward-carried `$01` value stops being correct is established rather than assumed, or its absence recorded as a fact about the corpus"
    status: failed
    reason: "No criterion-3 measurement exists. `evidence/criterion3-bank-divergence.txt` is absent; 23-09 was not dispatched. C3_BANK_DIVERGENCE is `could-not-run`. Consequence recorded in ROADMAP Phase 26: `AUTO-04`/`AUTO-05` are left **unvalidated** — the pre-mapped R7 narrowing was never reached under first-match-wins, so the highest-risk item on the pivot's own record carries neither validation nor a narrowed acceptance."
    artifacts:
      - path: ".planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/criterion3-bank-divergence.txt"
        issue: "File does not exist. C3_BANK_DIVERGENCE is `could-not-run`."
    missing:
      - "A depacked capture of real banking code"
      - "The `$01` timeline from the 23-05 runtime inventory"
      - "At least one address shown annotating differently under two bank states, or a recorded absence"
warnings:
  - id: W1
    item: "Code review finding CR-03 is recorded FIXED but its fix was not applied to the location the review itself named"
    detail: "`23-REVIEW.md:223` states `evidence/capture/CAPTURE-SUMMARY.txt:139 carries the same \"Four instants\" error and should be corrected in the same pass`. It was not. Lines 139-141 still read `Four instants are banked as VICE snapshots ... (danish_r1_handoff, danish_r2_handoff, saeger_r1_handoff) and each was proven faithful on reload` — a count of four naming three, plus a reload-faithfulness generalisation CR-03 narrowed to `danish` only. Both overstatements survive in the authoritative evidence file while the derived findings document is correct, inverting this tree's own provenance direction. Verified against `~/.config/vice/mcp_snapshots/`: exactly three handoff snapshots exist."
    severity: warning
    impact: "Does not touch C0_CORPUS, any outcome line, or the verdict. It does mislead the exact reader R1 hands the milestone to — the passage is CAPTURE-SUMMARY.txt's `What IS established, and what a re-run would not have to redo`."
  - id: W2
    item: "ROADMAP Phase 26 note restates the pivot's `0 false positives` as established fact, contradicted by this phase's own evidence"
    detail: "`.planning/ROADMAP.md:391` reads `dxa scored 0 false positives but 28% false negatives on the pivot fixture`. This phase measured `FIXTURE_FALSE_POSITIVES: 3` and `FIXTURE_REPRODUCED: no` (`evidence/fixture/fixture-baseline.txt:507-511`), and findings correction 5 records the published 141/138 partition as not source-derivable. Correction 5 was applied to `23-RESEARCH.md` and not to ROADMAP."
    severity: warning
    impact: "A Phase 26 planner reading its own phase notes gets the superseded figure. No verdict or outcome line affected."
  - id: W3
    item: "23-VALIDATION.md's per-requirement verification map was never closed out"
    detail: "All 11 rows still read `⬜ pending` and every Task ID reads `TBD`; the file's last commit is `cd40421`, from plan-phase, before any execution. Three rows are green today (verified independently in this report), five are permanently unmeasurable under this verdict."
    severity: warning
    impact: "Process-record staleness only. The substance is covered by the findings document and REQUIREMENTS.md."
  - id: W4
    item: "The frame-exact-stop blocker is named as 'the single gate' but no phase or todo owns fixing it"
    detail: "`ROADMAP.md:329` calls a frame-exact stop **the single gate** on `R1`'s `secure a corpus first` branch. The pending todo `2026-08-26-extract-flat-64k-from-vice-snapshots-...` explicitly leaves that second cause untouched. No ROADMAP phase and no pending todo owns it."
    severity: warning
    impact: "The named prerequisite for closing PROOF-01/02/03 has no owner. Escalated for a human decision."
info:
  - "RELEASES.json's `disk_image` values (`disks/danish.d64`, `disks/saeger.d64`) resolve nowhere — `~/.cache/c64-re-tools/phase23/disks/` does not exist; the images actually sit at `evidence/corpus/`. `dumps: []` is empty and correct (no captures exist). The load-bearing field — exactly one `canonical: true` — is verified."
  - "23-03's declared key-link pattern `C0_CORPUS: (pass|fail|could-not-run)` does not match the recorded `partial`. Substance holds: SCHEMA.md § 3 declares `pass | partial | could-not-run` and SCHEMA wins by an operator-confirmed phase-wide resolution recorded in `evidence/corpus/corpus-intake.txt` ACCEPTED LIMIT 2. R1 fires identically under either vocabulary."
  - "A 60,592-byte ELF executable (`evidence/tools/dxa`) is committed to the repository. Intentional per 23-02's must_haves (the pinned instrument must not live in tmpfs) and its sha256 matches the recorded provenance exactly, but it is an unreviewable binary now permanent in git history."
human_verification: []
---

# Phase 23: The Real-Release Gate (Go/Degrade/No-Go) — Verification Report

**Phase Goal:** The pivot's numbers are re-measured against real cracked releases rather than
one 279-byte self-authored fixture, and a recorded verdict says whether v0.6.0 proceeds as
scoped, degrades, or is reconsidered — produced before a line of engine or store code exists.

**Verified:** 2026-08-26T18:09:32Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Headline

The phase goal has two halves and they resolve differently.

**Half two is achieved, and achieved well.** The verdict exists, is machine-readable, derives
from a rule frozen before any measurement existed, is reproduced byte-identically in the
durable record, and is bound into Phases 24/25/26, STATE.md and REQUIREMENTS.md. I re-derived
every step independently and each one held. Zero product code was written.

**Half one is not achieved, and the phase says so.** Three of the five ROADMAP Success
Criteria — the three that ARE "re-measure the pivot's numbers against real cracked releases" —
are `could-not-run`. No number against a real release exists. That is a goal-level gap, and it
is a gap whether or not the reason for it is honourable.

**The reason is honourable, and the phase's handling of it is exemplary.** The negative verdict
is the gate working: R1 was written first, fired first, and was honoured rather than argued
around. The five undispatched plans are a recorded operator decision, not an omission — running
them on the self-authored fixture is precisely the defect PROOF-01 exists to remove. Nowhere in
this tree is a `could-not-run` dressed as a pass, and in two separate places the phase recorded
a result *worse* than the one it was instructed to record (`FIXTURE_REPRODUCED: no` against a
plan expecting reproduction; PROOF-01/02/03 left `Pending` against a plan instructing all five
be flipped to `Complete`).

So: `gaps_found`, with 2/5 verified. Not because the phase failed to do its job, but because
its job included measurements that could not be taken and the codebase must record that
plainly. This report recommends the gap be **closed by an override**, not by re-execution —
see *Escalation* below.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | dxa's data-recovery rate and FP count against a **named real release**, printed beside the fixture's claim, with error direction re-measured | ✗ FAILED | `evidence/criterion1-dxa-classification.txt` does not exist. `c1_adjudicated_fraction` / `c1_data_recovery_pct` / `c1_false_positives` all `could-not-run` in findings frontmatter. Fixture column is populated and honest (`72.39 (97/134)` / `3` FP / `FIXTURE_REPRODUCED: no`); release column is empty by construction |
| 2 | A **computed**-index indirect dispatch resolved by Ghidra with target shown, or recorded unresolved with transcript; a corpus with none reported *not exercised*, never as a pass | ✗ FAILED | `evidence/criterion2-ghidra-dispatch.txt` does not exist. `c2_computed_dispatch: could-not-run`. Correctly **not** recorded as `not-exercised` — findings § Summary table states `not-exercised` "was never earned: no pre-committed inventory exists to earn it" |
| 3 | The point where a single forward-carried `$01` stops being correct, **established rather than assumed**, or its absence recorded as a fact about the corpus | ✗ FAILED | `evidence/criterion3-bank-divergence.txt` does not exist. `c3_bank_divergence: could-not-run`. Neither branch of the criterion was reached — no divergence found, and no corpus-absence fact recorded either, because no corpus was ever analysed |
| 4 | A named list of concrete `analyzer.rs` capabilities, each matched to a replacement or accepted as lost with its cost, **derived from the real thing** | ✓ VERIFIED | Independently re-derived — see *Criterion 4 re-derivation* below. 26 audited = 23 `replaced-by` + 3 `lost-accepted` + 0 `lost-blocking`; all 7 top-level fns + `AnalysisResult` named with correct declaration lines against the real crate at `~/.cargo/registry/.../regenerator2000-core-0.9.20/src/analyzer.rs` |
| 5 | A machine-readable `go`/`degrade`/`no-go` verdict against rules **committed before the measurements**, read by Phase 24's planner as a precondition | ✓ VERIFIED | Fully re-derived — see *Criterion 5 re-derivation* below. Rule frozen at a single commit preceding every measurement path; `C0_CORPUS: partial` is the sole column-0 occurrence; R1 is first and fires; rule reproduced byte-identically; Phase 24/25/26 + STATE.md all bound with a resolvable path |

**Score:** 2/5 truths verified (0 present, behavior-unverified)

### Criterion 5 re-derivation (done independently, not read from SUMMARY)

Each step was executed against the repository rather than accepted from a claim.

| Check | Command / method | Result |
|---|---|---|
| The rule precedes every measurement | `git log --oneline -1 -- evidence/DECISION-RULE.md` vs `git log --oneline --reverse -- evidence \| head -1` | Both name `474c37c`. Identical |
| No measurement path existed at that commit | `git log --oneline 474c37c -- 'evidence/criterion*' 'evidence/inventory' 'evidence/capture'` | Empty output |
| The rule was never edited afterwards | `git log --oneline -- evidence/DECISION-RULE.md` | Exactly one commit. `SCHEMA.md` likewise — the freeze prohibition holds mechanically |
| R1 really is first | Read `DECISION-RULE.md` § *Rules, first match wins* | R1 is the first bullet; R9 (`go`) is last |
| R1's input is what the doc says it is | `grep -n '^C0_CORPUS:' evidence/capture/CAPTURE-SUMMARY.txt` | One column-0 occurrence, line 114, `C0_CORPUS: partial`. Final-occurrence-wins is satisfied trivially |
| R1 fires on it | `partial` ≠ `pass`; SCHEMA.md § 3 declares the domain `pass \| partial \| could-not-run` | R1's condition is true. Verdict `no-go` follows with no judgement step |
| The aggregation producing `partial` is re-derivable | Walked CAPTURE-SUMMARY.txt's own five conjuncts | 3 of 5 fail (`CAPTURE_SHA256`, `CAPTURE_SIZE` both `could-not-run`; `CAPTURE_EQUIVALENT: no` both). `could-not-run` correctly rejected — the emulator *was* driven to the handoff |
| The reproduced rule is byte-identical | Extracted the blockquote from findings:159+, stripped `> `, `diff` against `evidence/DECISION-RULE.md` | 183 lines each, **no differences** |
| The verdict is machine-readable | `grep -E '^verdict: (go\|degrade\|no-go)$'` and `grep -E '^verdict_rule_applied: R[0-9]+$'` | `verdict: no-go`, `verdict_rule_applied: R1` |
| A Phase 24 planner hits the gate | Read ROADMAP `### Phase 24` **Depends on** + Notes | Both name `docs/phase23-real-release-gate-findings.md` and the `verdict` / `verdict_rule_applied` fields. File exists; path resolves |

### Criterion 4 re-derivation

| Check | Method | Result |
|---|---|---|
| Every top-level entry point named with its line | `grep -nE '^(pub )?fn '` over the real `analyzer.rs` → 7 fns at 20/285/372/419/445/546/581, plus `AnalysisResult` at 8 | All 8 names and all 8 line numbers present in the audit |
| One disposition each, from the declared three | Counted dispositions in table rows only, excluding the legend rows at lines 10-11 | 23 `replaced-by`, 3 `lost-accepted` (E4 `promote_return_labels`, L11 `Return`, B5 `HiLoAddress`), **0** `lost-blocking` |
| The arithmetic closes | 23 + 3 = 26 | Matches `C4_CAPABILITIES_AUDITED: 26` / `C4_REPLACED: 23` / `C4_LOST_ACCEPTED: 3` |
| R8's input is right | `C4_UNREPLACED_CAPABILITIES: 0`; the six other `lost-blocking:` strings in the file are all prose/legend, none a disposition cell | Confirmed by line inspection (11, 31, 215, 217, 219, 247). R8 would not have fired |
| The audit is not credulous | Spot-checked correction 13 ("`flow_analyze` ignores `block_types` entirely") against source | Every `block_types` reference after line 581 is in a `#[cfg(test)]` setup, none in `flow_analyze`'s body. The claim holds |
| No regenerator2000 process was started | Prohibition check | Audit is text-derived; no r2000 invocation anywhere in the phase range |

### Required Artifacts

`gsd-tools query verify.artifacts` run against all six executed plans: **17/17 pass** (exists,
substantive, no missing patterns). Beyond the tool's checks:

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `evidence/DECISION-RULE.md` | Pre-committed R1..R9, inputs table, boundary + precision contracts | ✓ VERIFIED | 183 lines, single commit, first in the evidence tree, never edited |
| `evidence/SCHEMA.md` | Every outcome-line name + domain, declared before measurement | ✓ VERIFIED | Single commit alongside the rule. All 7 rule-input names declared; `verdict_rule_applied` declared before the findings document existed |
| `evidence/README.md` | Evidence conventions + ordering proof | ✓ VERIFIED | Ordering proof re-executed above; both facts reproduce |
| `evidence/tools/instrument-provenance.txt` | dxa/Ghidra pins with hashes | ✓ VERIFIED | `DXA_BINARY_SHA256: 0e2bf1a5…` matches `sha256sum evidence/tools/dxa` exactly. The pin is real, not asserted |
| `evidence/fixture/fixture-baseline.txt` | Reproduced fixture numbers | ✓ VERIFIED | Outcome lines present and **honest**: `FIXTURE_REPRODUCED: no`, `FIXTURE_FALSE_POSITIVES: 3` against a published `0` |
| `evidence/dxa-listing-parse.mjs` | The single listing parser | ✓ VERIFIED | Re-executed end-to-end; reproduces 179/100/279 (see spot-checks) |
| `evidence/FlatVolatile.java`, `ExportAnalysis23.java` | Ghidra pre-script and export | ✓ VERIFIED (present, unexercised on a corpus) | Rehearsed on the fixture only; no real-release run exists — consistent with SC1-3 failing |
| `evidence/corpus/corpus-intake.txt` | Per-release identity, sha256, d64 parse, canonical | ✓ VERIFIED | Two releases, both hashed, one canonical |
| `evidence/capture/capture-record-primary.md` / `-secondary.md` | Capture records with voiding verdicts | ✓ VERIFIED | Both runs of both releases voided under the template's own rule, recorded as voided, never promoted |
| `evidence/capture/CAPTURE-SUMMARY.txt` | C0_CORPUS + per-release lines | ⚠️ VERIFIED with W1 | Every outcome line correct and re-derivable. The prose "What IS established" block retains CR-03's uncorrected "Four instants … each was proven faithful on reload" |
| `evidence/capture/RELEASES.json` | Scratch registry, one canonical | ⚠️ VERIFIED with info | Exactly one `canonical: true`; `disk_image` paths dangle, `dumps: []` |
| `evidence/capture/snapshot-divergence.txt` | The 201-divergence measurement (CR-02) | ✓ VERIFIED | Re-ran the instrument; reproduces exactly |
| `evidence/criterion4-analyzer-audit.md` | Capability table + C4_* lines | ✓ VERIFIED | Fully re-derived above |
| `evidence/criterion1/2/3-*.txt` | The three measurements | ✗ MISSING | The three gaps. Absence is recorded as `could-not-run`, per DECISION-RULE § Inputs |
| `docs/phase23-real-release-gate-findings.md` | Verdict, re-derivation, verbatim rule, per-criterion sections | ✓ VERIFIED | 1000+ lines; rule reproduction byte-identical; 8 accepted limits and 15 corrections collected |
| `.planning/ROADMAP.md` / `STATE.md` / `REQUIREMENTS.md` | Verdict bound, traceability honest | ✓ VERIFIED | See key links |

### Key Link Verification

`gsd-tools query verify.key-links` reported 4/11 for a path-resolution reason, not a substantive
one: six plans wrote `from:` relative to the phase directory rather than the repo root, so the
handler could not open the source. Each was therefore verified by hand.

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `DECISION-RULE.md` | `SCHEMA.md` | every rule input names a SCHEMA-declared line | ✓ WIRED | All 7 input names present in SCHEMA.md |
| `SCHEMA.md` | findings doc | frontmatter keys declared before the doc existed | ✓ WIRED | `verdict_rule_applied` declared in SCHEMA.md; both files' commits ordered correctly |
| `instrument-provenance.txt` | `evidence/tools/dxa` | recorded sha256 of the built binary | ✓ WIRED | Hash recomputed and matches |
| `fixture-baseline.txt` | `dxa-listing-parse.mjs` | same parser criterion 1 would have used | ✓ WIRED | Re-executed; numbers reproduce |
| `CAPTURE-SUMMARY.txt` | `DECISION-RULE.md` | C0_CORPUS is R1's only input | ⚠️ PARTIAL | Substantively wired and re-derived. The plan's literal pattern `(pass\|fail\|could-not-run)` does not match `partial` — the recorded SCHEMA-wins deviation, R1 unaffected |
| `RELEASES.json` | `$HOME/.cache/c64-re-tools/phase23` | registry points at captures outside the checkout | ⚠️ PARTIAL | `canonical` present and correct; `dumps: []` (no captures exist — consistent); `disk_image` paths do not resolve |
| `criterion4-analyzer-audit.md` | `DECISION-RULE.md` | C4_UNREPLACED is R8's input | ✓ WIRED | `C4_UNREPLACED_CAPABILITIES: 0`, re-derived from the disposition cells |
| findings doc | `DECISION-RULE.md` | fired rule named + text reproduced | ✓ WIRED | Byte-identical reproduction confirmed by diff |
| findings doc | `CAPTURE-SUMMARY.txt` | corpus identity carried into frontmatter | ✓ WIRED | Both `file_sha256` values match `corpus-intake.txt` |
| `ROADMAP.md` | findings doc | Phase 24 **Depends on** names file + field | ✓ WIRED | Present at Phase 24, and again at Phases 25 and 26 |
| `STATE.md` | findings doc | Decisions entry with verdict, rule, literal path | ✓ WIRED | Present at STATE.md:85 and the Phase 23 decision entry |

### Data-Flow Trace (Level 4)

| Artifact | Value | Source | Produces real data | Status |
|---|---|---|---|---|
| findings frontmatter `verdict` | `no-go` | Derived from `C0_CORPUS:` in a named evidence file via R1 | Yes — re-derived independently | ✓ FLOWING |
| findings frontmatter `c0_corpus` | `partial` | `CAPTURE-SUMMARY.txt:114` | Yes | ✓ FLOWING |
| findings frontmatter `c4_unreplaced` | `0` | `criterion4-analyzer-audit.md:228`, itself derived from disposition cells | Yes — recounted from the cells | ✓ FLOWING |
| findings frontmatter `corpus[].file_sha256` | two 64-hex values | `corpus-intake.txt`, from `sha256sum` of operator-supplied images | Yes | ✓ FLOWING |
| findings frontmatter `tools.dxa` | built-binary sha256 | `instrument-provenance.txt`, verified against the committed binary | Yes | ✓ FLOWING |
| findings frontmatter `c1_*`, `c2_*`, `c3_*` | `could-not-run` | No source file exists | No — and correctly labelled as such, not defaulted, not blanked | ✓ FLOWING (as a declared absence) |

No value in the durable record terminates in a hardcoded literal or a paraphrase. The one class
of empty value is explicitly typed `could-not-run` with the reason named per input — which is
what DECISION-RULE § *Inputs* requires.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| The fixture measurement actually reproduces (CR-01's fix) | `acme -f cbm -o fixture.prg -l fixture.lbl fixture.a` then `evidence/tools/dxa -U -p all-nmos6502 -t detect-all -a dump fixture.prg` piped through `dxa-listing-parse.mjs … 279` | `PARSE_CODE_BYTES: 179`, `PARSE_DATA_BYTES: 100`, `PARSE_ACCOUNTED_BYTES: 279`, `PARSE_ADDRESS_RANGE: $0801-$0917` | ✓ PASS — matches the record exactly |
| The 201-divergence figure re-measures (CR-02's fix) | `node evidence/vsf-ram-extract.mjs …/danish_r1_handoff.vsf …/danish_r2_handoff.vsf` | `DIFF_TOTAL_BYTES: 350`, `DIFF_DRIFT_ONE_BIT: 149`, `DIFF_DIVERGENCE_MULTI_BIT: 201`, both snapshot sha256s identical to the transcript | ✓ PASS |
| The pinned dxa binary is the one recorded | `sha256sum evidence/tools/dxa` | `0e2bf1a5e…c8523` = `DXA_BINARY_SHA256` | ✓ PASS |
| The verdict is machine-readable as specified | `grep -E '^verdict: (go\|degrade\|no-go)$'` / `'^verdict_rule_applied: R[0-9]+$'` | `no-go` / `R1` | ✓ PASS |
| The ordering proof re-executes | the three git commands from findings § Criterion 5 | Commands 1 and 2 name the same commit; command 3 returns nothing | ✓ PASS |
| The rule reproduction has not drifted | blockquote extraction + `diff` | 183 vs 183 lines, no differences | ✓ PASS |
| Doc-integrity guards that consume `.planning/` and `docs/` are green | `node --test audit-integrity.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts docs-linerefs.test.ts docs-review-disposition.test.ts docs-core-value-decision.test.ts docs-fork-decision.test.ts docs-r2000-decisions.test.ts` | `# tests 85  # pass 85  # fail 0` | ✓ PASS |
| Snapshot inventory matches the corrected claim | `ls ~/.config/vice/mcp_snapshots/` | Exactly three handoff snapshots — confirms CR-03's correction and exposes W1 |  ✓ PASS (finding) |

Full `npm test` was **not** re-run: the phase changed nothing under `src/` (verified), and the
eight tests that do consume `.planning/`/`docs/` were run directly and are green. Broker is
`inactive`, so the known BACK-05 live-broker failure is not in play.

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no plan declares one. The phase's
runnable checks are the `evidence/tools/verify/task*-verify-as-planned.bash` scripts; the
substantive behaviours they cover were re-executed directly above rather than through the
wrapper. **Step 7c: N/A (no conventional probes; equivalent checks executed directly).**

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PROOF-01 | 23-01, 23-02, 23-03 (23-05/06/07 not dispatched) | dxa's data-recovery + FP measured on real cracked releases, stated beside the fixture claim | ✗ BLOCKED | `Pending — not met` in REQUIREMENTS.md:118 with the reason on the row. Criterion `could-not-run`. Correctly **not** marked Complete |
| PROOF-02 | 23-01, 23-02 (23-08 not dispatched) | Ghidra tested on a **computed** dispatch index | ✗ BLOCKED | `Pending — not met`, REQUIREMENTS.md:119, and the row explicitly records `could-not-run` (**not** `not-exercised`) |
| PROOF-03 | 23-01 (23-09 not dispatched) | The `memmap.json` join run against banking code; the `$01` break point established | ✗ BLOCKED | `Pending — not met`, REQUIREMENTS.md:120, noting `AUTO-04`/`AUTO-05` left unvalidated |
| PROOF-04 | 23-01, 23-04 | The dropped `analyzer.rs` work checked for anything dxa+Ghidra does not replace | ✓ SATISFIED | `Complete`, REQUIREMENTS.md:121. Re-derived from the real crate source in this report |
| PROOF-05 | 23-01, 23-10, 23-11 | Recorded go/degrade/no-go against named rules, before any engine or store code | ✓ SATISFIED | `Complete`, REQUIREMENTS.md:122. Re-derived end to end; zero product code confirmed |

**Orphan check:** `grep "Phase 23" .planning/REQUIREMENTS.md` maps exactly PROOF-01..05 to this
phase. All five are claimed by plan frontmatter (23-01 declares all five). **No orphaned
requirements.**

**Traceability honesty — checked adversarially, as instructed.** PROOF-01/02/03 are `Pending`
in the traceability table (line 118-120), unchecked (`- [ ]`) in the requirement list (lines
26-30), recorded in `WINDOWS.md` as ledger entry 14 (`unmet-truth`, open), and stated as "2 of
5 met" in the closing note. I found **no** location where any of the three is presented as
complete, met, satisfied, or passed.

### Decision Coverage

`gsd-tools query check.decision-coverage-verify` — **11 of 11** trackable CONTEXT.md decisions
honored by shipped artifacts. `not_honored: []`. Non-blocking gate; recorded for drift tracking.

### Prohibition Verification

Prohibitions are the must-NOT sibling of truths. All are `judgment`-tier here; each was checked
against the repository rather than accepted.

| Prohibition | Status | Evidence |
|---|---|---|
| The decision rule / schema / criterion-1 definitions must not be edited after the first measurement commit | ✓ HELD | Both files have exactly one commit each, `474c37c`, before every measurement path. Mechanically unfalsifiable |
| No fact used to judge dxa or Ghidra may be produced by dxa or Ghidra | ✓ HELD | The `$1BC2` handoff, the chip state and the divergence measurement all come from VICE observation; the criterion-4 audit from crate source. No dxa/Ghidra output feeds any judgement |
| A negative / partial / `could-not-run` outcome must not be softened, and `not-exercised` must never read as a pass | ✓ HELD — twice over | Not only is nothing softened, the phase twice recorded *worse* than instructed: `FIXTURE_REPRODUCED: no` against a plan expecting reproduction, and PROOF-01/02/03 left `Pending` against a plan instructing all five be flipped `Complete`. Findings § Summary table states outright "there is no pass count in this phase" |
| regenerator2000 must not be executed in any form | ✓ HELD | The criterion-4 audit is text-derived; no r2000 invocation in the phase range |
| Nothing under `src/` may be created or modified; no probe script added to any manifest | ✓ HELD | `git diff --name-only fd1093b..HEAD \| grep '^src/'` → empty. 63 changed paths, all under `.planning/` or `docs/` |
| The corpus image must never be committed | ✓ HELD | `git ls-files evidence/corpus/` returns only `.gitignore` and `corpus-intake.txt`. A defensive `.gitignore` covers seven binary extensions. The working-tree `.d64` files are untracked, and CR-04 corrected the document to say "never committed" rather than "not in this repository" |
| No Phase 24/25/26 plan may be written, amended or pre-empted | ✓ HELD | No plan file exists for 24/25/26. ROADMAP diff removes **zero** success-criteria lines; amendments are added as separate Notes bullets beside them, and each says the criteria stand "byte-identical" |
| The three power-cycling resources must not be set | ✓ HELD | No `MachineVideoStandard` / `VICIIModel` / `MachinePowerFrequency` set recorded in any capture transcript |
| Per-criterion values must not be restated in STATE.md or ROADMAP.md | ✓ HELD | Both point at the findings document and say explicitly that the values are not restated. Spot-checked: no `C1_*`/`C2_*`/`C3_*` values in either file |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `evidence/capture/CAPTURE-SUMMARY.txt` | 139-141 | Factual overstatement surviving a review fix that claimed to correct it (W1) | ⚠️ Warning | Misleads the re-scoping reader about recoverable capture instants; no outcome line or verdict affected |
| `.planning/ROADMAP.md` | 391 | Superseded claim (`dxa scored 0 false positives`) contradicted by this phase's own evidence (W2) | ⚠️ Warning | A Phase 26 planner reads the stale figure |
| `.planning/ROADMAP.md` | 323, 355, 383 | `**Plans**: TBD` | ℹ️ Info | Pre-existing and untouched by this phase; Phases 24-26 are unplanned **by prohibition**. Not phase debt |
| `.planning/phases/23-.../23-VALIDATION.md` | 73-83 | `TBD` task IDs, all rows `⬜ pending` (W3) | ⚠️ Warning | Plan-time artifact never closed out; last commit predates execution |
| `.planning/todos/pending/2026-08-26-run-vice-headless-…md` | 105 | `TBD in detail` | ℹ️ Info | Inside a formal pending todo — that *is* the tracked follow-up |
| `evidence/capture/RELEASES.json` | — | `disk_image` paths resolve nowhere; `dumps: []` | ℹ️ Info | Scratch registry; nothing downstream consumes it |
| `evidence/tools/dxa` | — | 60 KB ELF binary committed | ℹ️ Info | Intentional per 23-02 must_haves; hash-verified. Now permanent in history |

**Debt-marker gate:** no unreferenced `FIXME` or `XXX` anywhere in the phase's changed files.
Every `TBD` is either pre-existing-and-untouched, a GSD template placeholder in a plan-time
artifact, or inside a tracked todo. **No blocker under the debt-marker gate.**

### Deferred Items

**None.** I checked the three failed criteria against every later milestone phase per Step 9b
and deliberately declined to defer any of them:

- Phase 24's SC5 *consumes* "a cracked or packed release from Phase 23's corpus" — it does not
  re-measure PROOF-01's dxa error rates.
- Phase 26's ROADMAP note records `AUTO-04`/`AUTO-05` as **unvalidated rather than narrowed** —
  it explicitly does *not* take on PROOF-03's measurement.
- `R1`'s own consequence hands the decision back to milestone re-scoping rather than to a
  successor phase.

No later phase claims this work. Deferring these would be exactly the vague match Step 9b warns
against, so they stay recorded as real gaps.

### Human Verification Required

None. This is an evidence-and-decision phase with no user-facing surface, and every claim it
makes was verifiable programmatically — which I did rather than delegate. `human_verification`
is empty; the status is `gaps_found` on rule 1, not `human_needed`.

## Escalation — a decision for the developer

This is where the report stops reporting and asks.

**The gaps are real and correctly classified, but re-executing this phase cannot close them.**
Closing PROOF-01/02/03 requires a reproducible flat-64K capture; that requires a frame-exact
emulator stop; and the phase *proved* the fork's stopping exec checkpoint is not frame-exact
(201 multi-bit divergences between two snapshot-derived `danish` runs, which I re-measured). A
`/gsd-plan-phase --gaps` cycle would produce plans that cannot run, which is precisely the
substitution R1 exists to prevent.

**Recommended disposition: accept the three gaps by override, then act on W4.** If you agree,
add to this file's frontmatter and re-run verification:

```yaml
overrides:
  - must_have: "dxa's data-recovery rate and false-positive count are readable as numbers against a named real release, printed beside the 279-byte fixture's claim"
    reason: "Blocked on a reproducible flat-64K capture, which is blocked on a frame-exact emulator stop that provably does not exist today. Recorded no-go under the pre-committed rule R1; re-scoping v0.6.0 is the milestone-level answer, not re-running this phase."
    accepted_by: "henrik"
    accepted_at: "<ISO timestamp>"
  - must_have: "A computed-index indirect dispatch from real code is resolved by Ghidra with the target shown, or recorded as unresolved with its transcript"
    reason: "Same substrate blocker (D-03). Correctly recorded could-not-run rather than the flattering not-exercised."
    accepted_by: "henrik"
    accepted_at: "<ISO timestamp>"
  - must_have: "The point at which a single forward-carried $01 value stops being correct is established rather than assumed"
    reason: "Same substrate blocker (D-03). AUTO-04/AUTO-05 recorded unvalidated in the Phase 26 ROADMAP entry rather than silently narrowed."
    accepted_by: "henrik"
    accepted_at: "<ISO timestamp>"
```

**Three things worth doing regardless of that decision:**

1. **W4 is the one that matters.** The ROADMAP calls a frame-exact stop "the single gate", and
   nothing owns it — not a phase, not a todo. Everything else in this report is bookkeeping by
   comparison. Consider filing it before the context is cold.
2. **W1** is a two-line correction to `CAPTURE-SUMMARY.txt:139-141`, at a location the review
   already wrote the fix for.
3. **W2** is a one-line qualification to `ROADMAP.md:391`.

## Gaps Summary

Three of five ROADMAP Success Criteria — criteria 1, 2 and 3, which together *are* the
"re-measure against real cracked releases" half of the phase goal — have no measurement. The
evidence files that would carry them do not exist. The cause is a single, named, proven
technical blocker: no reproducible flat-64K capture could be produced, because the fork's
stopping exec checkpoint is neither instruction-exact nor frame-exact. Five plans (23-05..23-09)
were deliberately not dispatched rather than run against the 279-byte self-authored fixture,
which would have reproduced the exact defect PROOF-01 exists to remove. That was the right call
and it is recorded as an operator decision.

Criteria 4 and 5 are verified, and I verified them by re-deriving rather than by reading. The
decision-gate machinery is the strongest artifact here: a rule frozen at a single commit that
provably precedes every measurement path, a single unambiguous input, a first-match-wins
evaluation with no judgement step, a byte-identical reproduction in the durable record, and
bindings into Phases 24/25/26, STATE.md and REQUIREMENTS.md that a planner cannot route around.
Zero product code — 63 changed paths, none under `src/`.

The phase is honest to an unusual degree. It twice recorded a worse result than its own plan
instructed, and it refused to mark three requirements Complete when a plan told it to. Set
against that, W1 stands out precisely because it is uncharacteristic: a review finding recorded
FIXED whose fix was not applied to the second location the review itself named, leaving the
authoritative evidence file wrong where the derived document is right.

`gaps_found` is the correct status: three must-have truths are FAILED and the codebase says so.
But the gaps are not fixable by re-planning this phase, and the recommendation is to accept them
by override and escalate the frame-exact blocker (W4), which is the only thing standing between
this milestone and the measurements it wanted.

---

_Verified: 2026-08-26T18:09:32Z_
_Verifier: Claude (gsd-verifier)_
