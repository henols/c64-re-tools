---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
verified: 2026-09-03T02:12:35Z
status: passed
score: 4/5 must-haves verified (criterion 2 closed live 2026-09-03; criterion 3 remains PARTLY MET, dispositioned)
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  note: "Initial verification — no prior 33-VERIFICATION.md existed"
partly_met:
  - truth: "Criterion 3 — the frame term of the stop-identity oracle is proven necessary rather than argued"
    status: partial
    reason: >-
      The criterion's central clause is NOT satisfied and the phase says so: a control showing
      `(LIN, CYC)` alone PASSING on two stops EXACTLY one frame apart does not exist, because it is
      unbuildable on this hardware (60 Hz KERNAL IRQ at `$ea31` against a 50.125 Hz PAL frame;
      240 anchor hits gave 240 distinct `(LIN, CYC)`, 0 of 239 consecutive pairs equal;
      smallest reachable equal-raster separation is 2 frames). Recorded as
      `ORACLE_NECESSITY: unproven` at column 0 of `evidence/33-repro03-frame-anchor.md:752` and
      consumed by the pre-committed rule set as `R6 -> degrade`. The other two clauses ARE met:
      `MEMSPACE_ASSERTION: refuses` (`evidence/33-memspace-refusal.md:195`) and the CAP-03
      structural bar (two assertions in `capture-seam.test.ts`).
    unclosable: true
    human_decision_requested: >-
      This clause cannot be closed by re-planning — the separation is a hardware fact and
      `DECISION-RULE.md` is frozen. The pre-committed gate already absorbed it and produced the
      `degrade` narrowing. Accept via an `overrides:` entry, or decide the criterion text should be
      amended in ROADMAP.md. Do NOT dispatch a gap-closure plan against it.
behavior_unverified_items:
  - truth: "Criterion 2 — the reproducible-run protocol is one named single-seam procedure reached through an optional argument on `vice_run_until`, and two runs with deliberate pre-protocol jitter stop identically UNDER IT"
    test: >-
      Call `vice_run_until` with `reproducible: true` and a `frame_anchor` against a real stock
      VICE instance, twice at different pre-protocol jitter (0 / 1500 / 4000 ms), and confirm the
      four-term stop identity and the sliced 64K sha256 agree — i.e. reproduce
      `evidence/33-repro02-reset-removed.md`'s positive arm THROUGH the shipped seam rather than
      through an evidence script driving its pieces.
    expected: >-
      One identical 64K sha256 and identical `(PC, hit_count, LIN, CYC)` across the triple, matching
      `TRIPLE_DISTINCT_SHA256 1` / `TRIPLE_ANY_STOP_TERM_DIFFERS no` at
      `evidence/33-repro02-reset-removed.md:482,487`. Additionally confirm the three post-review
      refusal paths fire correctly against real monitor emission order: CR-02's zero-hit refusal,
      WR-01's anchor-stopped-first adjacency gate, WR-02's anchor cleanup on a live-socket resume
      failure.
    why_human: >-
      NO live-emulator run anywhere in Phase 33 called `runReproducible()`. All five evidence probes
      (`reset-removed-probe.mjs`, `frame-anchor-probe.mjs`, `determinism-probe.mjs`,
      `autostart-probe.mjs`, `capture-pair.mjs`) import `stock-protocol.ts` / `broker-launch.mts`
      and drive the protocol's pieces directly; none imports `stock-reproducible-run.ts`. The seam's
      only coverage is 30 unit tests against scripted fake clients (30/30 pass, re-run by this
      verifier). Worse for ordering: `stock-reproducible-run.ts` was modified by THREE review-fix
      commits — `edb5d7f` (CR-02), `f00446b` (WR-01), `d49a8ce` (WR-02) — all landing AFTER every
      live run in the phase (`2b40040`, `1fff362`, `678da05`, `01cfae9`). The code that was
      live-measured is not the code that ships. Wait/refusal/cleanup ordering against a real
      emulator's `CHECKPOINT_INFO` emission order is exactly the class CLAUDE.md's `vice-sync.ts`
      exemption declares unprovable by unit test ("their correctness only means anything against a
      real emulator's timing"), and the fixer disclosed that WR-01's adjacency claim rests on
      reading `mon_breakpoint.c`, not on measurement.
human_verification:
  - test: >-
      Decide the disposition of criterion 3's unclosable clause (see `partly_met` above) — accept as
      an override, or amend the ROADMAP criterion text.
    expected: "A recorded decision; NOT a gap-closure plan (the pre-commitment is frozen and the separation is a hardware fact)"
    why_human: "Requires an owner scope decision against a frozen pre-commitment"
  - test: >-
      Exercise `vice_run_until` with `reproducible: true` + `frame_anchor` against real stock VICE
      (see `behavior_unverified_items` above)
    expected: "One sha256 and one four-term stop identity across the 0/1500/4000 ms jitter triple, through the shipped seam"
    why_human: "Needs a live emulator; the seam has zero live coverage and changed after all measurement"
  - test: >-
      Correct the three factually wrong sentences in `src/mcp/vice/capture-predicate.ts`'s
      CONSUMER STATUS header (added by WR-08 fix `d7e6b8f`)
    expected: >-
      The header stops claiming the module is "imported by nothing outside its own tests and
      derive-transients.test.mjs", stops claiming `normalisePorts()` "has never run against a real
      capture", and stops claiming the only runnable equivalence check is
      `derive-transients.mjs`. All three are false — see W1.
    why_human: "A judgement call on wording in a header whose whole purpose is to be the accurate status record"
gaps: []
deferred: []
coincidental_reliance_items:
  - truth: "Criterion 4 — the equivalence predicate is proven able to fail (as applied to the real capture pair)"
    reason: fixture-only
    harden: >-
      The `C0_CAPTURE_PAIR: pass` verdict's `equivalent` outcome is established by an allow-list
      derived from three runs two of which ARE the reported pair, so the pair's 28 differing
      addresses are inside the 49-entry list by construction. The phase states this itself
      (`evidence/33-capture-pair.md` ACCEPTED LIMIT item 1: "The pair comparison is not an
      independent test of the pair; it is a restatement of 'the union fitted under the cap'").
      Advisory only — criterion 4's own claims are independently verified (see T4), the cap is a
      real pre-commitment, and the one-bit plant at `$C000` proves non-vacuity. The hardening is a
      held-out fourth run whose image never enters the derivation.
---

# Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) — Verification Report

**Phase Goal:** Two runs of the same real cracked release stop in the same frame and their 64K
captures compare as equivalent, produced without a transcription step anywhere — and a recorded
verdict, against rules committed to git before any measurement exists, says whether v0.8.0 proceeds
as scoped, narrows, or is reconsidered.

**Verified:** 2026-09-03T02:12:35Z (HEAD `06e034a`)
**Status:** passed (UAT closed 2026-09-03 — see § UAT Closure at the end of this report)
**Re-verification:** No — initial verification

---

## The Gate — verified mechanically, first

This phase's distinguishing deliverable is a pre-committed decision gate, so these four checks
matter more than any narrative. All four pass.

### 1. The ordering proof — HOLDS

| Assertion | Command | Result | Status |
|---|---|---|---|
| `2a8ef95` is the only commit reachable from itself touching the evidence dir | `git rev-list --count 2a8ef95 -- <evidence>` | `1` | ✓ |
| `DECISION-RULE.md` is exactly one commit, ever | `git rev-list --all --count -- <evidence>/DECISION-RULE.md` | `1` | ✓ |
| `SCHEMA.md` is exactly one commit, ever | same | `1` | ✓ |
| `README.md` is exactly one commit, ever | same | `1` | ✓ |
| all three unmodified in the working tree | `git status --porcelain` | empty | ✓ |
| `2a8ef95`'s parent is the phase-start commit | `git log -1 --format=%P` | `543522c` | ✓ |
| `2a8ef95` precedes every measurement commit | `git log --all --reverse -- <evidence>` | `2a8ef95` first of 12 | ✓ |

Commit date `2026-09-02 19:16:09 +0200`; the twelve later evidence commits all follow it. The
phase's central claim is intact: **the rules were committed before any measurement existed, and
have not moved since.**

### 2. The five gate inputs — all present at column 0, all in domain

Read with `grep -a` (the NUL-byte guard this project requires).

| Input | Declared source file | Line | Value | In declared domain |
|---|---|---|---|---|
| `SLICER` | `evidence/33-slicer-validation.md` | `:288` | `validated` | ✓ |
| `SEED_EFFECT` | `evidence/33-repro01-determinism.md` | `:428` | `pinned` | ✓ |
| `JITTER_IMMUNITY` | `evidence/33-repro02-reset-removed.md` | `:690` | `immune` | ✓ |
| `C0_CAPTURE_PAIR` | `evidence/33-capture-pair.md` | `:631` | `pass` | ✓ |
| `ORACLE_NECESSITY` | `evidence/33-repro03-frame-anchor.md` | `:752` | `unproven` | ✓ |

Each appears exactly once at column 0 in its single declared file — no duplicate, so the
"final occurrence wins" rule is not load-bearing here. No gate input is absent.

### 3. The verdict is derived, not judged — CONFIRMED by independent walk

I walked `DECISION-RULE.md`'s `R1`..`R9` against the five values myself, without reading the
findings document's own walk first:

| Rule | Antecedent | Actual value | Matches? |
|---|---|---|---|
| `R1` | `SLICER: failed` | `validated` | no |
| `R2` | `SEED_EFFECT: unpinned` | `pinned` | no |
| `R3` | `JITTER_IMMUNITY: not-immune` | `immune` | no |
| `R4` | `C0_CAPTURE_PAIR: fail` | `pass` | no |
| `R5` | `C0_CAPTURE_PAIR: not-obtained` | `pass` | no |
| `R6` | `ORACLE_NECESSITY: unproven` | `unproven` | **YES — first match** |

`R6` is genuinely the first match. `docs/phase33-reproducible-run-gate-findings.md` frontmatter
carries `verdict: degrade` and `verdict_rule_applied: R6`, and names `R7`/`R8`/`R9` as
**NOT EVALUATED** rather than leaving them blank. **The verdict follows from the recorded inputs.**

The totality arithmetic also checks out independently: 3×3×2×2×3 = **108** tuples;
54+18+12+8+8+4+2+1+1 = **108**; 54+18+12 = **84** `no-go`, 8+8+4+2+1 = **23** `degrade`, **1** `go`.
`R9` carries no antecedent, so `could-not-run` is structurally unemittable — the defect Phase 23's
gate carried and hit is removed by arithmetic, not by promise.

### 4. `R6`'s narrowing is the pre-mapped one — CONFIRMED

The findings document's § *Narrowing* reproduces `D-04`'s pre-mapped text **verbatim** from
`DECISION-RULE.md` (byte-compared): the oracle narrows to the two-term `(PC, hit_count)` form with
the frame term recorded but not asserted. It is labelled as written before the answer was known and
is not re-authored. The narrowing is bound into **each** of Phases 34-38's own ROADMAP Notes with a
per-phase statement of what it does and does not narrow — including the load-bearing negative for
Phase 38 (`R5` did not fire, so its denominator is not narrowed and `could-not-run` is no longer
reportable there). A `STATE.md` pointer exists at `:183`. Per `D-06` no test guard was added, and
the reason is kept visible.

**One observation, not a defect:** the *shipped* `compareStopIdentity()` still asserts all four
terms and returns `frameTermAsserted: true`. Nothing in the artifacts claims otherwise — the
narrowing binds downstream *records* (what may be claimed), not this phase's code, and a
stricter-than-permitted comparison is the safe direction. A Phase 35+ implementer should note that
calling the shipped oracle yields a four-term verdict while its record must state a two-term
assertion.

### 5. No unsourced numbers — spot-checks all PASS

Every number I spot-checked in the findings document and the ROADMAP's five OUTCOME annotations
traces to a literal column-0 or transcript line in a committed evidence file:

| Claimed number | Cited/found at | Status |
|---|---|---|
| `57` of 4080 without block, `0` with | `33-repro01-determinism.md:277,285,308,309` | ✓ |
| `NOSEED_DIFF_TOTAL_64K 1028` / `BLOCK_DIFF_TOTAL_64K 0` | same `:310,311` | ✓ |
| `TRIPLE_PAIRWISE_DIFF_TOTAL 0`, one sha256 `0999713e…` | `33-repro02-reset-removed.md:482,486` | ✓ |
| three distinct sha256, `line`/`cycle` differ on every noreset pair | same `:613`, `NORESET_DIFFERING_TERMS_UNION` | ✓ |
| contrast `0` vs `401` differing bytes | same, `CONTRAST_*` lines | ✓ |
| 240 anchor hits, 240 distinct `(LIN, CYC)`, 0 consecutive repeats | `33-repro03-frame-anchor.md:88,89,398,399` | ✓ |
| variant pair differs at `3` bytes, oracle names `hitCount` | same `:700`, `VARIANT_FOUR_TERM_IDENTITY` | ✓ |
| `TRANSIENT_COUNT: 49` against cap `64`; `DERIVATION: void` absent | `33-transient-derivation.md:80,97`; absent confirmed | ✓ |
| 48 of 49 from one pairing | same, `PAIR … vs pair-j4000: 48 differing addresses` | ✓ |
| `33-03` measured `66`, over cap | `33-autostart-sequencing.md:407,543,548` | ✓ |
| one-bit plant at `$C000` fails | `33-transient-derivation.md:260-264` | ✓ |
| `1.76×` overshoot, `~1.97×` warp, timeout instance `not-red` | `33-wallclock-control.md:350,290,178` | ✓ |
| `LIN` 154 vs 159, `CYC` 11 vs 47, `diffs=48` at 400 hits | `33-autostart-sequencing.md:383,389,393` | ✓ |
| `LIN` 274 vs 193 at hit 75 | same `:263,265,278` | ✓ |
| `3155` / `2385` ms max bind, `1000` ms budget | `33-probeready-warp-console.md:325,327,90,323`; `broker-launch.mts:783` | ✓ |
| 108 tuples / 84 / 23 / 1 | recomputed independently | ✓ |

**No number with no transcript behind it was found.** The prohibition recorded by plan 33-01 and
carried by 33-03, 33-10, 33-11 and 33-12 holds across the findings document and all five OUTCOME
annotations.

---

## Goal Achievement

### Observable Truths (the five ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Launch nondeterminism is proven pinned by divergence, not by a flag's presence | ✓ VERIFIED | `SEED_EFFECT: pinned` (`33-repro01-determinism.md:428`), derived correctly under `SCHEMA.md` § 2.1 — **both** halves hold (`57 of 4080` without, `0 of 4080` with). Determinism block stock-only and fork argv byte-identical **confirmed behaviorally by this verifier** calling `buildViceArgs()` for all four backend/profile combinations. Three-field reproducibility key present in `capture-record.template.md:21-23` with a checklist gate at `:60`. |
| 2 | The reset step inside the protocol is proven load-bearing, via one named single-seam procedure reached through an optional argument on `vice_run_until` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **The measured half is decisive:** `JITTER_IMMUNITY: immune` (`:690`), `RESET_REMOVED_CONTROL: red` (`:696`), 0 vs 401 differing bytes, 1 vs 3 distinct sha256, plus a `PREHALT` method control that caught a false `no-go`. **The seam half is present + wired + unit-tested but never live:** `runReproducible()` exists (`stock-reproducible-run.ts:442`), is wired `vice-proxy.ts:182` → `stock-dispatch.ts:713` → `stock-run-until.ts:321`, both manifest keys declared, 30/30 unit tests pass (re-run here) — but **no evidence probe in the phase imports it**, and it was changed by three review-fix commits after all live measurement. See `behavior_unverified_items`. |
| 3 | The frame term of the stop-identity oracle is proven necessary rather than argued | ✗ PARTLY MET | Central clause NOT satisfied and honestly recorded: `ORACLE_NECESSITY: unproven` (`33-repro03-frame-anchor.md:752`). Memspace half MET (`MEMSPACE_ASSERTION: refuses`, `33-memspace-refusal.md:195`) but on the `@bank:` symptom alone — a memspace-less `ADVANCE_INSTRUCTIONS` still stepped the main CPU (`:122`), contradicting `P10`'s first symptom, and the evidence says so. `CAP-03` structural bar MET by two assertions, verified independently (see below). Unclosable — see `partly_met`. |
| 4 | A depacked flat 64K image comes out of a snapshot slice with no transcription step anywhere, and the equivalence predicate is proven able to fail | ✓ VERIFIED | `SLICER: validated` (`33-slicer-validation.md:288`). **Both declared suites independently re-run by this verifier: `vsf-slice.test.ts` 36/36 `fail 0`; `capture-predicate.test.ts capture-seam.test.ts` 42/42 `fail 0`.** Allow-list enumerated and under cap (`TRANSIENT_COUNT: 49` / 64, `DERIVATION: void` correctly absent); one-bit plant at `$C000` outside the 49 fails. `normalisePorts()` overlays in code. `D-21`/`D-24` riders present in `33-CONTEXT.md:300,354` dated 2026-09-02. |
| 5 | A machine-readable go/degrade/no-go verdict is recorded against rules committed before any measurement, with no judgement step, and it cannot return `could-not-run` | ✓ VERIFIED | Verdict `degrade` / `R6` in machine-readable frontmatter; derivation re-walked independently (above); `could-not-run` structurally unemittable by arithmetic; ordering proof re-asserted post-measurement. Opening measurement on an autostarted real release with true drive emulation (`AUTOSTART_SEQUENCE: S3`, `Drive8TrueEmulation=1 Drive8Type=1541` read back per run). Both wall-clock controls `red`. Shortfall named accurately (see W4 for a **second**, criterion-level-undisclosed shortfall). |

**Score:** 3/5 truths verified (1 present-but-behavior-unverified, 1 partly met)

### What the phase disclosed as short — disclosure accuracy check

Every self-reported shortfall in my brief was checked for accuracy. All are accurate; two are
**incompletely propagated** (W3, W4).

| Disclosed shortfall | Accurate? | Note |
|---|---|---|
| Criterion 3 PARTLY MET, fired the gate; `ORACLE_NECESSITY: unproven`; 240/240/0; variant at 2-frame separation; strict reading chosen deliberately; 33-12 declined the override | ✓ accurate and complete | Both records exist and agree. 33-11's `ACCEPTED LIMIT` names the flattering alternative reading explicitly; STATE.md `:1002` records the declined override on four stated grounds. Exemplary. |
| Criterion 5 `WARP_BRACKET_CONTROL: red` by region overshoot, not the spurious timeout the criterion names; the timeout instance came out `not-red` and was reported | ✓ accurate and complete | `33-wallclock-control.md:178` labels instance 1 `not-red` and keeps it; findings § *Accepted limits* item 4 propagates it; criterion 5's OUTCOME names it. |
| `AUTOSTART_FRAME_EXACT: not-achieved` and `CAPTURE_FRAME_EXACT: no` beside the `pass` | ✓ accurate | Both at column 0 (`:451`, `:633`), both in the OUTCOME. Mechanism (1541 rotational phase on the un-reset absolute clock) measured in isolation by the `PREHALT` arm. |
| The `pass` is weak by construction — allow-list from three runs two of which are the pair; all power in the cap; plant outside the list still fails | ✓ accurate | `33-capture-pair.md` ACCEPTED LIMIT items 1-3, stated in the phase's own words. Logged advisory as `coincidental_reliance_items`. |
| The cap straddle: 49 vs 64 here, 66 over cap on a directly launched instance; earlier claim withdrawn | ✓ accurate | `33-autostart-sequencing.md:543` `OVER`; the withdrawal is explicit at `:200` and in criterion 4's OUTCOME. |
| Two decisions falsified by measurement carry dated riders in `33-CONTEXT.md` | ✓ accurate | `D-21` `:300`, `D-24` `:354`, both `AMENDED 2026-09-02`. |
| Requirement IDs were deliberately NOT marked complete; shared-ID gate blocked seven | ✗ **INACCURATE** | Git contradicts this. **All ten ids are `[x]` Complete**, marked by the owning plans: `7c2954a` (CAP-01), `f3f9eb5` (CAP-03), `1242132` (REPRO-04), `52dbe0a` (CAP-02, CAP-04), `be0e416` (REPRO-01/02/03/05), `341a622` (GATE-01). Not an artifact defect — a brief/orchestrator inaccuracy — but it makes W3 sharper: they are marked, and **none carries a rider**. |

### Required Artifacts

All 12 plans' declared artifacts verified. `verify.artifacts` returned `all_passed: true` for 11
plans; 33-04 errored on a directory artifact and was verified manually.

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `evidence/DECISION-RULE.md` / `SCHEMA.md` / `README.md` | frozen pre-commitment | ✓ VERIFIED | one commit each, unmodified, `2a8ef95` |
| `src/mcp/vice/vsf-slice.ts` | strict module walk + `C64MEM` slice | ✓ VERIFIED | 637 lines; all 5 declared exports present; no path-seam import; reached from skill CLI and exercised on real snapshots |
| `src/mcp/vice/vsf-slice.test.ts` | fixtures + refusals + structural | ✓ VERIFIED | 644 lines, 36/36 `fail 0` |
| `src/mcp/vice/fixtures/vsf/` | 4 fixtures + sidecars | ✓ VERIFIED | 4 `.vsf` + 4 `.json` provenance sidecars + generator (9 entries) |
| `src/mcp/vice/capture-predicate.ts` | the equivalence predicate | ⚠️ VERIFIED, header inaccurate | all 6 declared exports present; 42/42 `fail 0`; **no production consumer** (WR-08 accepted) but four committed evidence scripts DO import it — see W1 |
| `src/mcp/vice/stop-oracle.ts` | 4-term comparison, no image param | ✓ VERIFIED | `compareStopIdentity(a: StopIdentity, b: StopIdentity)` — no buffer parameter; symmetric; `ORACLE_TERMS` drives the walk |
| `src/mcp/vice/capture-seam.test.ts` | CAP-03 structural bar | ✓ VERIFIED | planted positive controls + 3 non-vacuity floors, including "a census asked to scan a set that omits its module THROWS rather than reporting clean" |
| `src/mcp/vice/stock-reproducible-run.ts` | `runReproducible()` seam | ⚠️ WIRED, behavior unverified | exports present; single non-test call site; **zero live coverage** — see `behavior_unverified_items` |
| `src/mcp/vice/stock-run-until.ts` + `tools-manifest.stock.json` | the two optional keys | ✓ VERIFIED | `reproducible` (boolean) and `frame_anchor` (string) declared with substantive descriptions; single guarded call site |
| `src/mcp/vice/broker-launch.mts` + `resources/broker-launch.mjs` | determinism block + profile | ✓ VERIFIED | verified behaviorally (see T1); `.mjs` regenerated in the same commit, `resources-sync.test.ts` green |
| `src/skills/c64-ram-capture/scripts/derive-transients.mjs` | N≥3 derivation under a voiding cap | ✓ VERIFIED | 41/41 `fail 0` (with `vsf-slice.test.mjs`), 0 skipped |
| `src/skills/c64-ram-capture/transients/{README.md,.gitignore}` | method not address set | ✓ VERIFIED | `.gitignore` refuses image byte forms; `danish.json` tracked in-repo but excluded from the tarball (CR-01) |
| `docs/phase33-reproducible-run-gate-findings.md` | the verdict artifact | ✓ VERIFIED | 944 lines; frontmatter keys exactly `SCHEMA.md` § 5's order; rule reproduced verbatim; one section per input; 8 accepted limits collected |
| `.planning/ROADMAP.md` / `STATE.md` | criteria annotated, verdict bound | ✓ VERIFIED | five OUTCOME annotations; per-phase bindings in 34-38; STATE.md pointer `:183` |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `DECISION-RULE.md` | findings doc | `verdict_rule_applied` | ✓ WIRED |
| `SCHEMA.md` | `33-capture-pair.md` | `C0_CAPTURE_PAIR:` at column 0 | ✓ WIRED |
| `33-CONTEXT.md` | `vsf-slice.ts` | the amended `D-21` length rule (`65543`) | ✓ WIRED (tool reported "pattern not a usable string" — numeric pattern; verified by hand: `65543` present in both) |
| `broker-launch.mts` | `resources/broker-launch.mjs` | `node build.ts`, same commit | ✓ WIRED |
| `capability-registry.ts` | `docs/tool-support.md` | byte-identity drift guard | ✓ WIRED |
| `vice-broker-client.ts` | `broker-control.mts` | `profile` on the acquire line, **both** write sites | ✓ WIRED |
| `vice-broker.mts` | `broker-launch.mts` | granted profile → `buildViceArgs` at cold launch | ✓ WIRED |
| `stock-run-until.ts` | `stock-reproducible-run.ts` | exactly one guarded call site | ✓ WIRED |
| `stock-reproducible-run.ts` | `stop-oracle.ts` | `compareStopIdentity` over scalars only | ✓ WIRED |
| `capture-predicate.ts` | `vsf-slice.ts` | `dirRead`/`dataRead` feed `normalisePorts` | ✓ WIRED |
| `skills/…/vsf-slice.mjs` | `vsf-slice.ts` | resolution ladder ending in a named refusal | ✓ WIRED |
| `capture-predicate.ts` | any production caller | — | ⚠️ ORPHANED (WR-08 accepted; disclosed) |
| `AcquireProfileOptions.profile` | any production caller / MCP tool | — | ⚠️ ORPHANED (W4) |

25/27 links wired. The two orphans are the WR-08-accepted substrate; both are disclosed in code
headers, one incompletely at the criterion level.

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data? | Status |
|---|---|---|---|---|
| `vsf-slice.ts` | 64K RAM array | real `.vsf` snapshots of `danish.d64` (`size=193261`, `c64mem_body=65555`, minor 1) | yes | ✓ FLOWING |
| `capture-predicate.ts` `normalisePorts` | `$0000`/`$0001` overlay | real snapshots' own `dirRead=47` / `dataRead=55` | yes | ✓ FLOWING (contra its own header — W1) |
| `capture-predicate.ts` `compareCaptures` | the `C0_CAPTURE_PAIR` verdict | two real normalised captures + the 49-entry derived list | yes | ✓ FLOWING |
| `stop-oracle.ts` `compareStopIdentity` | four-term stop identity | real `REGISTERS_GET` + `CHECKPOINT_INFO` replies | yes | ✓ FLOWING |
| `broker-launch.mts` `buildViceArgs` | spawn argv | real `x64sc` launches; argv read back over `RESOURCE_GET` | yes | ✓ FLOWING |
| `stock-reproducible-run.ts` `runReproducible` | stop identity | scripted fake clients only | **no live path** | ⚠️ HOLLOW — wired, never fed real data |
| `AcquireProfileOptions.profile` | launch profile | no production caller | no | ⚠️ HOLLOW_PROP |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| SLICER derivation half 1 | `node --test vsf-slice.test.ts` | `tests 36 / pass 36 / fail 0` | ✓ PASS |
| SLICER derivation half 2 | `node --test capture-predicate.test.ts capture-seam.test.ts` | `tests 42 / pass 42 / fail 0` | ✓ PASS |
| skill-side route + derivation agreement | `node --test derive-transients.test.mjs vsf-slice.test.mjs` | `tests 41 / pass 41 / fail 0 / skipped 0` | ✓ PASS |
| the protocol seam's unit contract | `node --test stock-reproducible-run.test.ts` | `tests 30 / pass 30 / fail 0` | ✓ PASS |
| CR-02's zero-hit refusal (single named test) | `node --test --test-name-pattern='vacuous\|even once'` | 1/1 pass; asserts `/vacuous/` in the message | ✓ PASS |
| determinism block stock-only, fork byte-identical | `buildViceArgs()` × 4 combos | `-default` idx 0; block on stock only; fork identical with/without profile | ✓ PASS |
| additive launch knobs | same | `-console` idx 1, `-warp` immediately before `-binarymonitor`, neither displaces the other | ✓ PASS |
| tarball leanness (CR-01) | `npm pack --dry-run --json` in `installer/` | ships `transients/README.md`, **no** `.json` | ✓ PASS |
| package closure | `node scripts/check-npm-packages.mjs` | exit 0, "OK" — 83 + 37 files | ✓ PASS |
| `vice_run_until` reproducible run against real stock VICE | — | needs a live emulator | ? SKIP → human |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository; this phase's probes are the committed
`evidence/*.mjs` scripts, which require a live emulator and a gitignored corpus and are therefore
not re-runnable here. Their transcripts were verified instead: `BROKER_STATE: inactive` on every
live-run file, `TEST_AUTOMATED_BASELINE` recorded on every one, and voided runs recorded rather
than discarded (notably `33-autostart-sequencing.md:194-196`, where the **voided pair agreed at 0
differing bytes** and was voided anyway on the `D-11` rule — discarding the flattering result).

**Broker state at verification time:** `systemctl --user is-active vice-broker` → `inactive`,
`pgrep -x x64sc` → no output. So the suite numbers below are not false-baseline readings.

### Requirements Coverage

All ten declared IDs are accounted for. None is orphaned; `REQUIREMENTS.md`'s traceability table
maps exactly these ten to Phase 33 and no others.

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| REPRO-01 | 33-05, 33-11 | ✓ SATISFIED | `SEED_EFFECT: pinned`; block stock-only; fork byte-identical (verified behaviorally) |
| REPRO-02 | 33-09, 33-11 | ⚠️ SATISFIED with an evidence gap | reset proven load-bearing by measurement; the named seam has zero live coverage and changed post-measurement |
| REPRO-03 | 33-07, 33-09, 33-11 | ⚠️ PARTLY SATISFIED | the triple oracle ships and is wired; **the requirement's own second sentence** ("A control asserts that `(LIN, CYC)` alone **passes** on two stops exactly one frame apart") is exactly what `ORACLE_NECESSITY: unproven` records as unobserved. Marked `[x]` Complete with no rider — W3 |
| REPRO-04 | 33-08 | ✓ SATISFIED | three-field key in the template with a checklist gate; `argvDigest` order-sensitive, refuses empty argv |
| REPRO-05 | 33-05, 33-06, 33-11 | ⚠️ SATISFIED at the library seam only | additive argv verified behaviorally; `probeReady` re-checked under warp and console (`PROBEREADY_BUDGET: short`, honestly recorded); **no run can actually request the profile** — W4 |
| CAP-01 | 33-04 | ✓ SATISFIED | slice with no transcription; 36/36 `fail 0`; exercised on real snapshots |
| CAP-02 | 33-07, 33-08, 33-10 | ✓ SATISFIED | enumerated list under a voiding cap; one-bit plant fails; overlay in code |
| CAP-03 | 33-07 | ✓ SATISFIED | structural bar by import census + parameter-type assertion, both with planted positive controls; derived-scalar route prose-only (disclosed) |
| CAP-04 | 33-03, 33-10 | ✓ SATISFIED | real release autostarted with true drive emulation, captured twice, pair compared under the committed predicate |
| GATE-01 | 33-01, 33-12 | ✓ SATISFIED | pre-committed rules, ordering proof, derived verdict, downstream binding |

### Decision Coverage

`check.decision-coverage-verify`: **29 / 29 trackable `33-CONTEXT.md` decisions honored**,
`not_honored: []`. Non-blocking gate, recorded for drift tracking. Two decisions were falsified by
measurement (`D-21`, `D-24`) and both carry dated `AMENDED 2026-09-02` riders rather than being
quietly dropped.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---|---|---|---|---|
| `vsf-slice.test.ts` | CAP-01 | 36 | 0 | no | Value + Behavioral | ✓ |
| `capture-predicate.test.ts` + `capture-seam.test.ts` | CAP-02, CAP-03 | 42 | 0 | no | Value + Behavioral, with planted controls | ✓ |
| `stock-reproducible-run.test.ts` | REPRO-02, REPRO-03 | 30 | 0 | no | Behavioral vs **scripted clients** | ⚠️ no live path |
| `derive-transients.test.mjs` + `vsf-slice.test.mjs` | CAP-02, REPRO-04 | 41 | 0 | no | Value, cross-implementation agreement | ✓ |
| `broker-launch.test.ts` (+ broker suites) | REPRO-01, REPRO-05 | — | 0 | no | Value (`assert.deepEqual` on whole argv, ×5) | ✓ |

- **Disabled tests on requirements:** 0. The `{ skip: … }` guards in the skill-side suites are
  conditional on module resolution and measured **0 skipped** in practice.
- **Circular patterns:** 1, **disclosed by the phase itself and non-vacuous.** The
  `C0_CAPTURE_PAIR: pass` verdict's allow-list derives from three runs two of which are the reported
  pair, so `equivalent` is a restatement of "the union fitted under the cap". The phase states this
  in its own words and proves non-vacuity with a one-bit plant at `$C000`. Logged as
  `coincidental_reliance_items` (advisory), **not** as a gap.
- **Insufficient assertions:** 0.
- **Expected-value provenance:** VALID throughout — the fixtures carry generator sidecars, and the
  measured values come from real `x64sc` 3.9 launches, not from the system under test.
- **MANUAL_ONLY_TESTS** remains exactly nine files, and the two-directional gate
  (`automated ∪ manual == on-disk`, no overlap) passes. No live frame-exact suite was added
  silently.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` in any of the 48 phase-modified files | — | **none found** |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **none found** |
| `skills/c64-ram-capture/scripts/vsf-slice.mjs` | 127 | `return null` | ℹ️ Info | documented "no rung resolved" sentinel feeding a named refusal — not a stub |

Debt-marker gate: **PASS**. Zero unreferenced markers.

### Suite Baseline

`npm run test:automated` (broker stopped): **`tests 3127 / pass 3119 / fail 2 / skipped 1 / todo 5`**.
Both failures are `anno-register.test.ts` DIRECTION 5 and its negative control, from the single
out-of-phase root cause (`STORE-01`, `STORE-04`, `STORE-06`, `MCP-04` cited by the anno register but
dropped from `REQUIREMENTS.md` at the v0.8.0 open). **Exactly the disclosed pre-existing baseline —
no Phase 33 regression.** Legitimately noted as an open cross-cutting item with that provenance.

### Code Review Dispositions

15/15 dispositioned (14 fixed, 1 accepted, 0 won't-fix) across 16 atomic commits. Both Criticals
independently re-verified as genuinely fixed:

- **CR-01** — `npm pack --dry-run` on `installer/` now ships `transients/README.md` and **no**
  `.json`; `assertLeanTarball()` exists at `check-npm-packages.mjs:91` and runs from inside
  `packFiles()` at `:143`. `danish.json` still tracked in-repo. ✓
- **CR-02** — the `anchorHitCount === 0` refusal is explicit at `stock-reproducible-run.ts:708`
  with a 20-line WHY block; the observing test at `stock-reproducible-run.test.ts:486` asserts the
  message matches `/vacuous/` and passes. ✓

The three not-applied-as-written dispositions are **reasoned, not dismissive**. WR-01 in particular
records a concrete regression the suggested patch would have caused (`frameAnchor === address`, where
one stop emits two `CHECKPOINT_INFO` frames at a single address) and the fix was adapted rather than
declined. The `Invariants held` section names seven load-bearing invariants and states each was
checked, including the frozen-evidence assertion — which I re-ran and confirmed.

**On the disclosed limitation** (CR-02/WR-01/WR-02 are refusal-path logic with no live coverage,
resting on reading `mon_breakpoint.c`): under this project's own `vice-sync.ts` exemption —
"their correctness only means anything against a real emulator's timing" — this is **not** acceptable
as a substitute for measurement, and the fixer was right to disclose it. It is the substance of
`behavior_unverified_items` and it is why this phase is `human_needed` rather than `passed`. It is
not a blocker: the refusals are strictly safer than the prior behaviour (they refuse where the code
previously proceeded), so the failure mode is a false refusal, not a false pass.

---

## Findings

### WARNINGS

**W1 — `capture-predicate.ts`'s CONSUMER STATUS header is factually wrong on three counts.**
Added by the WR-08 disposition (`d7e6b8f`) specifically to be the accurate status record. It says:

- "this module is imported by nothing outside its own tests and `derive-transients.test.mjs`" —
  **false.** Four committed evidence scripts dynamically import it:
  `evidence/capture-pair.mjs:120`, `evidence/reset-removed-probe.mjs:103`,
  `evidence/frame-anchor-probe.mjs:86`, `evidence/determinism-probe.mjs:78`.
- "`normalisePorts()` … has never run against a real capture" — **false.** It ran on three real
  captures of `danish.d64` at `capture-pair.mjs:680`, and the transcript records the inputs
  (`dirRead=47`, `dataRead=55` on all three snapshots).
- "the only RUNNABLE equivalence check in the phase is the deliberate second implementation in
  `derive-transients.mjs`" — **false.** `capture-pair.mjs:776` calls `predicate.compareCaptures()`
  directly, and **that call IS the `C0_CAPTURE_PAIR` verdict**. It also uses `argvDigest` (`:567`),
  `parseAllowList` (`:769`), `hex4` and `formatComparison` (`:779-781`).

The error direction is *self-deprecating*, not flattering — the module is better exercised than its
header claims — so this is not a truth-inflation finding. But the narrow WR-08 claim it was written
to record ("no *shipped runtime* consumer") is true and would have been accurate; the header
overshot into absolute claims that the phase's own gate input contradicts. A Phase 34-38
implementer reading it would be told the port overlay is unvalidated against reality when in fact
it produced the milestone's headline number.

**W2 — the protocol seam has zero live-emulator coverage, and shipped code differs
from measured code.** Not a fresh discovery — it is disclosed piecewise
(`33-repro02-reset-removed.md:61`, `33-capture-pair.md:129-152`, findings § *Accepted limits* 3) —
but never consolidated into the one sentence a reader needs: **no live run in Phase 33 executed
`runReproducible()`.** Compounding it, three review-fix commits changed that module *after* all
live measurement (`edb5d7f`, `f00446b`, `d49a8ce` vs `2b40040`/`678da05`/`01cfae9`). Neither
criterion 2's OUTCOME nor `REQUIREMENTS.md`'s REPRO-02 says so. Routed to human verification.

**W3 — all ten requirement IDs are `[x]` Complete with no riders, while the fired verdict narrows
one of them and another is PARTLY MET.** `REPRO-03`'s own second sentence is precisely what
`ORACLE_NECESSITY: unproven` records as unobserved, and `R6`'s narrowing drops the frame term
`REPRO-03`'s first sentence asserts ("certified identical by the triple … **and by nothing else**").
Phase 23 set this project's precedent for exactly this situation — `AUTO-02`/`AUTO-05` carry
`**AMENDED** — recorded as **unvalidated, not narrowed**` riders at `REQUIREMENTS.md:289,298`.
Phase 33 did not follow it. The full record exists in `STATE.md` and the findings document, so
nothing is hidden; the ledger a later planner reads first is what is out of step.

**W4 — criterion 5's second shortfall is disclosed only in a code header.** REPRO-05 says warp and
headless are "launch knobs **a run can request**". The *additive* property is verified (I confirmed
it behaviorally). But **no MCP tool declares `warp`, `headless` or `profile`** (checked across the
whole stock manifest) and **no production site passes one** — `acquireOverControlPlane` is never
called with `opts.profile`. So `-warp` and `-console` are unreachable from any shipped route today.
This is honestly recorded in `vice-broker-client.ts:355-364` and in the WR-08 disposition, but it
appears nowhere in criterion 5's OUTCOME annotation, `REQUIREMENTS.md`, `STATE.md` or the findings
document — all of which name only the warp-bracket shortfall.

**W5 — `deferred-items.md` D1 is stale.** It records `scripts/check-npm-packages.mjs` as RED with a
"Why it is not fixed here" rationale. It **was** fixed, two plans later, by `fc199e7`
("the package closure walk must not treat `import type` as a runtime edge"), and the checker now
exits 0. The deferred item carries no resolution note.

**W6 — criterion 4's OUTCOME cites test counts that no longer match the tree.** It says
`vsf-slice.test.ts` 34/34 and `capture-predicate.test.ts capture-seam.test.ts` 39/39. Current tree:
**36** and **42** (the review fixes added tests, notably WR-05's three template-literal census
cases). The evidence transcript is a correct historical record and the *derivation condition*
(`fail 0` on both) still holds — I re-ran both suites — so `SLICER: validated` is unaffected. Noted
only so a future reader does not read the drift as a falsification.

**W7 — minor: `33-capture-pair.md`'s title overstates its own route.** "one real cracked release,
captured twice **through the shipped route**", while its own `ACCEPTED LIMIT` 128 lines down records
that the shipped protocol seam is *not* on that route and cannot be. The route did use shipped
components (broker client, `stock-protocol.ts`, the `vsf-slice` CLI, the predicate, the oracle) —
just not `runReproducible()`. Self-corrected in the same file; flagged because titles travel further
than accepted limits.

### BLOCKERS

**None.** The gate is mechanically sound, the verdict is derived, the ordering proof holds, no
artifact is missing or stubbed, no debt marker is unreferenced, and the suite is at its disclosed
pre-existing baseline.

---

## Human Verification Required

### 1. Dispose of criterion 3's unclosable clause

**Test:** Decide whether `ORACLE_NECESSITY: unproven` is accepted as-is.
**Expected:** A recorded decision — an `overrides:` entry in this file, or an amendment to
criterion 3's ROADMAP text.
**Why human:** The clause requires two stops **exactly one frame apart** on a machine where the
anchor is a 60 Hz KERNAL IRQ and the frame is 50.125 Hz PAL. That is arithmetic, not a bug: 240
anchor hits gave 240 distinct `(LIN, CYC)` and 0 consecutive repeats, and the smallest reachable
equal-raster separation is 2 frames. `DECISION-RULE.md` is frozen and already mapped this value to
`R6 → degrade` with a pre-written narrowing. **Do not dispatch a gap-closure plan against it** — the
phase already did the right thing, twice (33-11 chose the unflattering reading deliberately because
`proven` was the flattering one; 33-12 declined the available override on four recorded grounds).

Suggested override, if accepted:

```yaml
overrides:
  - must_have: "The frame term of the stop-identity oracle is proven necessary rather than argued — a control shows (LIN, CYC) alone PASSING on two stops exactly one frame apart"
    reason: "Unbuildable on this hardware (60 Hz KERNAL IRQ vs 50.125 Hz PAL frame; 240 anchor hits, 240 distinct (LIN, CYC), 0 consecutive repeats; minimum equal-raster separation 2 frames). Recorded as ORACLE_NECESSITY: unproven and consumed by the frozen pre-commitment as R6 -> degrade, with a pre-mapped narrowing. Closing it would require editing a frozen pre-commitment."
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

### 2. Exercise `vice_run_until` with `reproducible: true` against real stock VICE

**Test:** Two runs at different pre-protocol jitter through the shipped seam, plus the three
post-review refusal paths (CR-02 zero-hit, WR-01 anchor-stopped-first adjacency, WR-02 anchor
cleanup on a live-socket resume failure).
**Expected:** One 64K sha256 and one identical `(PC, hit_count, LIN, CYC)` across the triple —
reproducing `TRIPLE_DISTINCT_SHA256 1` / `TRIPLE_ANY_STOP_TERM_DIFFERS no` through the seam rather
than through its pieces.
**Why human:** Needs a live emulator. No probe in the phase called `runReproducible()`, and the
module changed after all measurement. Per CLAUDE.md, checkpoint-wait ordering "only means anything
against a real emulator's timing".

### 3. Correct `capture-predicate.ts`'s CONSUMER STATUS header

**Test:** Reconcile the header with W1's three counter-examples.
**Expected:** The narrow, true claim ("no shipped *runtime* consumer; exercised on real captures by
four committed evidence scripts, including the one that produced `C0_CAPTURE_PAIR: pass`") replaces
the three absolute claims.
**Why human:** Wording judgement in a header whose entire purpose is to be the accurate status
record.

### 4. Optional bookkeeping (W3, W4, W5, W6, W7)

Add `AMENDED` riders to `REPRO-03` (and, if you agree, `REPRO-05`) in `REQUIREMENTS.md` following
Phase 23's precedent; add W4's shortfall to criterion 5's OUTCOME; add a resolution note to
`deferred-items.md` D1. None of these changes a measurement or a verdict.

---

## Gaps Summary

**There are no gaps in the sense the workflow means it** — nothing is missing, stubbed, unwired by
accident, or claimed without evidence. This is one of the more rigorously evidenced phases in the
project: the pre-commitment held mechanically under adversarial checking, the verdict is genuinely
derived (I re-walked `R1`..`R9` independently and `R6` is the first match), the totality arithmetic
is correct, and I could not find a single number in the findings document or the five OUTCOME
annotations without a transcript behind it. Two moments stand out as evidence that the honesty is
structural rather than performed: 33-11 chose `unproven` when `proven` was available and flattering,
and 33-03 voided a pair that had *agreed at 0 differing bytes* because the `D-11` rule said to.

What holds the phase back from `passed` is two things, in this order:

1. **The shipped protocol seam has never met a real emulator.** `runReproducible()` — the artifact
   REPRO-02 exists to deliver — is present, wired through to `vice_run_until`, and covered by 30
   passing unit tests against scripted clients. No live run in the phase invoked it, and three
   review-fix commits changed its refusal and cleanup paths *after* every live run ended. The
   measured half of criterion 2 (the reset is load-bearing) is decisive and stands on its own; what
   is unproven is that the assembled seam behaves as its pieces did. Under this project's own
   `vice-sync.ts` reasoning, that is exactly the class of correctness a unit test cannot establish.

2. **Criterion 3's central clause is not satisfied, and cannot be.** That is the gate working as
   designed — the value fired `R6` and produced a pre-written narrowing — but it is a shortfall in
   the criterion as written, and it needs an owner's disposition rather than a re-plan.

The phase goal's own first clause is worth reading precisely, because the artifacts do: **"two runs
… stop in the same frame"** is *not* delivered on an autostarted release. `AUTOSTART_FRAME_EXACT:
not-achieved` and `CAPTURE_FRAME_EXACT: no` sit at column 0 beside the `pass`, frame-exactness holds
only through anchor hit 50 and is lost from 75, and the mechanism (the 1541's rotational phase
riding an absolute clock that `AUTOSTART` does not reset) was isolated and measured. The second
clause — **"their 64K captures compare as equivalent, produced without a transcription step
anywhere"** — is delivered, with the honest caveat that the equivalence verdict's discriminating
power sits entirely in the pre-committed cap. The third clause — **the recorded verdict** — is
delivered in full and is the strongest part of the phase.

Four disclosure defects (W1, W3, W4, W7) share one shape: the accurate statement exists somewhere,
but not in the artifact a later reader reaches first. None of them changes a measurement. W1 is the
one worth fixing promptly, because it is wrong in a header written expressly to be right, and it
understates the validation of the code that produced the milestone's headline number.

---

_Verified: 2026-09-03T02:12:35Z_
_Verifier: Claude (gsd-verifier)_

---

## UAT Closure — 2026-09-03

`33-UAT.md` completed: **3 tests, 3 passed, 0 issues, 0 gaps.** Status moved
`human_needed → passed`. The Gaps Summary above named exactly two things holding the
phase back. Both are now resolved, and neither needed a gap-closure plan.

### 1. "The shipped protocol seam has never met a real emulator" — CLOSED

`evidence/reproducible-seam-probe.mjs` and `evidence/refusal-paths-probe.mjs` drive
`handleRunUntil` (`stock-run-until.ts`) — the shipped entry point, and the only non-test
caller of `runReproducible()` — against genuine stock VICE 3.9 at `/usr/bin/x64sc`.

| The item asked for | Measured |
|---|---|
| `TRIPLE_DISTINCT_SHA256 1` through the shipped seam | **1** — `bf083cb3…5c7438`, identical across jitter 0/1500/4000 ms **and** across two independent invocations (6 cold boots) |
| `TRIPLE_ANY_STOP_TERM_DIFFERS no` | **no** — one identity, `PC=$ea31 hit_count=1 LIN=257 CYC=57`, matching the module header's own claim byte for byte |
| CR-02's zero-hit refusal, live | **fires**, with its own wording, against real KERNAL reset ordering (target `$fda3` reached before the `$ea31` anchor runs) |
| WR-01's anchor-stopped-first gate, live | **fires** — `anchorStoppedFirst: true`, settled in 6370 ms of a 15000 ms deadline, **no oracle term emitted** |
| WR-02's anchor cleanup on a live-socket resume failure | **NOT closed live.** Needs fault injection no real emulator produces on demand; stays unit-covered in `stock-reproducible-run.test.ts` and is recorded as such rather than claimed |

`resumes: 1` on every run — `vice-sync.ts`'s "exactly one resume per wait" invariant,
observed live rather than asserted. `compareCaptures()` with an **empty** allow-list
reports `differing: 0` on all three pairwise comparisons; the 64-address transient budget
was not needed.

**One new finding, recorded rather than filed as a gap.** The probe's first run spawned
`x64sc` directly and omitted `STOCK_DETERMINISM_FLAGS`. The four-term stop identity still
reproduced *perfectly* while the 64K sha256 differed on all three runs — 1032 single-bit
flips confined to RAM (`$0100-$9FFF`, `$C000-$CFFF`), the signature of randomised power-on
RAM init. **The stop identity cannot detect this condition.** The shipped broker emits the
block unconditionally, so the shipped route is never in that state — but this is a measured
argument for that unconditionality, and it is the same drift `T-33-36` names, arrived at
from the opposite direction. Full detail: `evidence/33-uat-shipped-seam.md`.

### 2. "Criterion 3's central clause … needs an owner's disposition" — DISPOSITIONED

Owner decision, 2026-09-03: **accept the `degrade` verdict as it stands.** No `overrides:`
entry is written, `DECISION-RULE.md`'s rule text does not move, and the ROADMAP criterion
text is left untouched. `ORACLE_NECESSITY: unproven` and `R6 → degrade` stand exactly as
`33-11` recorded them, and R6's narrowing is already pre-mapped by D-04 and bound into
Phases 34-38.

`partly_met` is therefore **left in place**: criterion 3 is still partial, and this closure
does not promote it. `overrides_applied` stays `0`, which is the truthful count — the
disposition was to decline the override, not to apply one.

### 3. W1 (the `capture-predicate.ts` CONSUMER STATUS header) — FIXED

Fixed in commit `9c8de68`, before this session, after independently confirming all three
sentences were false. The header now states what is genuinely not-yet-wired (no shipped MCP
tool or production caller reaches the module) rather than claiming it is unimported and
unvalidated.

### What did NOT change

- `behavior_unverified` moved `1 → 0`; `partly_met` is untouched; `gaps: []` and
  `deferred: []` were already empty and stay empty.
- `score` moved `3/5 → 4/5` **only** because criterion 2's behaviour is now verified live.
  Criterion 3 is not counted as met.
- Criterion 4's `coincidental_reliance` entry (the allow-list derived from runs that include
  the reported pair) is **advisory and remains open as written**. Its stated hardening — a
  held-out fourth run whose image never enters the derivation — was not performed here and
  is not claimed.

_UAT closed: 2026-09-03 · `/gsd-verify-work 33`_
