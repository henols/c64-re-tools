---
phase: 09-the-assumption-probe-go-no-go
verified: 2026-08-20T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 9: The Assumption Probe (Go/No-Go) Verification Report

**Phase Goal:** The five load-bearing assumptions are answered against a real regenerator2000
build, and a recorded verdict says whether v0.3.0 proceeds as scoped, degrades, or should be
reconsidered.
**Verified:** 2026-08-20
**Status:** passed
**Re-verification:** No — initial verification

## What This Phase Is

A probe/gate phase. It deliberately produces no product code — evidence transcripts under
`evidence/`, one durable findings document (`docs/phase9-regenerator2000-probe-findings.md`),
and a machine-readable verdict. Absence of source changes and new tests is by design and is not
treated as a gap.

## Goal Achievement

### Observable Truths (ROADMAP § Phase 9 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A real regenerator2000 build is present, version recorded, container-side toolchain cost measured rather than estimated | VERIFIED | `evidence/criterion1-install-and-version.txt:186` `INSTALLED_VERSION: regenerator2000 0.9.20`; `evidence/criterion1-container-toolchain-cost.txt:344,346` `SINGLE_STAGE_BYTES: 1256576420`, `MULTI_STAGE_BYTES: 250820636` (both numeric, both measured, not estimated) |
| 2 | The pty question is answered by running it, with the Save-As bootstrap outcome recorded with its transcript | VERIFIED | `evidence/criterion2-pty-transcript.txt`: `PTY_TOLERANCE: pass`, `BOOTSTRAP_AUTOMATABLE: pass` — a real tmux pty session drove Alt+S, confirmed the resulting `.regen2000proj` loads in a **separate, freshly-started, non-pty** `--headless` invocation (exit 0, label export succeeded) |
| 3 | The three downstream assumptions (reassembly, `--export_lbl`, `.vsf` load) are each answered against real artifacts | VERIFIED | `evidence/criterion3-reassembly.txt:395` `REASSEMBLY: pass`; `evidence/criterion3-export-lbl.txt:630` `EXPORT_LBL: pass`; `evidence/criterion4-vsf-load.txt:862` `VSF_LOAD: partial` — a genuine mixed result, recorded honestly rather than rounded up |
| 4 | Every answer recorded as re-readable evidence; every failure recorded as an accepted limit naming what it breaks | VERIFIED | `docs/phase9-regenerator2000-probe-findings.md` `## Accepted limits` (line 436) names two live limits, each tied to a specific requirement/criterion (`R2000-09`/Phase 10 criterion 4 for the illegal-opcode default; Phase 10 criterion 3 + the ROADMAP's `.vsf`-over-`.raw` constraint for the machine-type default) |
| 5 | A go/no-go verdict is recorded naming one of proceed/degrade/reconsider, machine-readable, at a stated location | VERIFIED (see adjudication below) | `docs/phase9-regenerator2000-probe-findings.md` frontmatter `verdict: degrade`, `verdict_rule_applied: R4`; discoverable from `.planning/STATE.md:137` and `.planning/ROADMAP.md` Phase 9/10/11 Notes |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/phase9-regenerator2000-probe-findings.md` | Durable findings doc, verdict in frontmatter, ≥90 lines, cites ≥5 evidence files | VERIFIED | 606 lines; frontmatter has `verdict`, `verdict_rule_applied`, seven `criteria:` keys; body has `## Verdict` (first section), `### Scope amendments`, `## Accepted limits`, `## Corrections to prior documents`, `## Reproducing this`; cites all six `evidence/criterion*` files |
| `.planning/phases/09-the-assumption-probe-go-no-go/09-VALIDATION.md` | Signed off, `nyquist_compliant: true` | VERIFIED | Frontmatter `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true`; sign-off checklist fully checked with evidence citations per line |
| `evidence/criterion{0,1,2,3,4}*.txt` (6 transcripts) + harness scripts | Raw evidence for every criterion | VERIFIED | All six transcripts present and readable; outcome lines match what the findings document and 09-07-SUMMARY report |
| `.planning/STATE.md` decision entry | Points at the findings doc, disambiguates the verdict | VERIFIED | Line 137: verdict + rule + triggering input + path. Line 40-45 "Current Position" explicitly states "not a documented manual bootstrap step, since criteria 2a/2b both passed cleanly" |
| `.planning/ROADMAP.md` Phase 9/10/11 pointers | Verdict discoverable, amendments named beside (not over) existing criteria | VERIFIED | Phase 9 Notes (line 274), Phase 10 Notes (lines ~299-315) name the verdict, the rule, and the two live amendments against specific criteria; Phase 10/11 success-criteria text itself is left unmodified per the plan's explicit anti-scope-drift instruction |
| `.planning/phases/09-the-assumption-probe-go-no-go/09-RESEARCH.md` corrections | Every contradicted claim corrected inline | VERIFIED | `[CORRECTED]`/`[CLOSED]` markers present on Assumptions A1-A4, Open Questions 1-3, per 09-07-SUMMARY and grep confirmation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `docs/phase9-…-findings.md` | `evidence/` transcripts | relative-path citation per criterion section | WIRED | Confirmed — every criterion section cites its `evidence/criterion*` file; at least 6 distinct paths cited |
| `docs/phase9-…-findings.md` frontmatter | Phase 10's planner | `verdict:` key, referenced from STATE.md and ROADMAP.md | WIRED | Both STATE.md and ROADMAP.md point at the literal filename and quote the verdict value; no restatement of the seven per-criterion outcomes (avoiding drift) |
| 09-07's decision rule (written pre-run) | the recorded verdict | first-match-wins evaluation, reproduced verbatim in the findings doc | WIRED | The findings document's `## Verdict` section reproduces the full rule and walks through why R1/R2/R3 did not fire and R4 did, using the actual outcome-line values — mechanically re-derivable by a reader, not asserted |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|--------------|--------|----------|
| R2000-16 | 09-01 through 09-08 (all eight) | Five load-bearing assumptions checked against a real build before further planning, evidence recorded, failures as accepted limits | SATISFIED | All five sub-parts (1)-(5) have recorded, evidence-backed outcomes; verdict recorded and discoverable per criteria above |

No orphaned requirements: REQUIREMENTS.md maps only `R2000-16` to Phase 9, and all eight plans declare `requirements: [R2000-16]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `evidence/mcp-harness.mjs:18-25`, `evidence/vice-tool-harness.mjs:28-33` | — | `withTimeout()`'s losing timer never cleared (from 09-REVIEW.md WR-01) | Info (throwaway evidence script, not shipped code) | Could make a re-run of the harness appear to hang past actual completion; does not affect the correctness of already-captured evidence |
| `evidence/vice-tool-harness.mjs:74-82` | — | Orphaned child process on connect timeout (09-REVIEW.md WR-02) | Info (throwaway evidence script) | Same class of issue the project's own wedge-triage skill targets, self-inflicted in disposable tooling only |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers were found in any delivered artifact (findings doc, VALIDATION.md, STATE.md, ROADMAP.md, evidence transcripts). The only `TBD` occurrences in the phase directory are (a) 09-07-PLAN.md's own description of a value the *plan* required to be literal `TBD` mid-task before Task 2 filled it, and (b) Phase 10/11's still-unwritten `**Plans**: TBD` lines in ROADMAP.md, which are correctly left as `TBD` because those phases have not been planned yet — not unresolved debt from this phase.

### Regression Check

Full project test suite (`node --test '*.test.*'` in `.claude/mcp/vice`) run directly by this
verifier: **1871 tests, 1836 pass, 0 fail, 30 skipped, 5 todo.** No regression — consistent with
this being a docs/evidence-only phase that touched nothing under `.claude/mcp/vice/`.

### Human Verification Required

None. Every truth above is verifiable from committed evidence transcripts and documents; no
runtime/visual/UX behavior is in scope for this phase.

## Adjudication: The `degrade` / bootstrap Vocabulary Conflict

**Question:** Is Success Criterion 5 satisfied, given that ROADMAP.md's own gloss defines
`degrade` as "bootstrap becomes a documented one-time interactive step," but the recorded
`degrade` verdict fired for an unrelated reason (`R4`, on `c3_4_vsf_load: partial`) while the
bootstrap criteria (`c2a`, `c2b`) both passed?

**Finding: the conflict is real, but it originates in the ROADMAP's own criterion-5 wording
(written at milestone-planning time, before this phase ran), not in a shortcut taken during
this phase's execution — and this phase's own artifacts identify and correct it explicitly, in
three independent places:**

1. **The findings document itself** (`docs/phase9-regenerator2000-probe-findings.md`, `## Verdict`)
   quotes the ROADMAP's exact words for `degrade`, then states directly: *"except this phase's
   own `R4` (not `R3`) is what fired: the bootstrap itself (criteria 2a/2b) passed cleanly, so
   the 'documented one-time interactive step' half of that ROADMAP sentence does **not** apply
   here."* This is not a passing paraphrase — it is a dedicated, unambiguous correction sitting
   in the first body section, exactly where a reader looking for the verdict will land.
2. **ROADMAP.md's own Phase 10 Notes** (added by 09-08, beside — not over — Phase 10's
   unmodified success criteria) state: *"The bootstrap itself is **not** affected: criteria 2a/2b
   ... both passed cleanly, so criterion 3 above proceeds as scoped, a real automated bootstrap,
   not a documented manual step."*
3. **STATE.md's Current Position** states the same thing in the words a session opens first:
   *"Next step: Phase 10 as scoped, with the two named scope amendments ... — not a documented
   manual bootstrap step, since criteria 2a/2b both passed cleanly."*

**Residual issue (real, but not blocking):** Phase 10's success criterion 3 in ROADMAP.md still
carries its original literal text — *"or, if Phase 9's verdict was degrade, it is a documented
one-time interactive step"* — unmodified, by the deliberate design choice (stated in 09-08-PLAN.md)
not to quietly reword a phase's success criteria mid-milestone, since a criterion silently
reworded to match an outcome is an unauditable scope reduction. Read in total isolation — the
bare criterion-3 sentence with no other context — this text is misleading given the actual,
recorded trigger. It is not misleading in context: no reader who opens the Notes immediately
below it, or STATE.md, or the findings document's own `## Verdict` section, can come away with
the wrong conclusion, and all three are one scroll or one click away.

**Answers to the three questions posed:**

1. **Is criterion 5 satisfied?** Yes. The verdict is recorded, machine-readable, at a stated
   location, mechanically re-derivable from a pre-written rule, and names one of the three
   ROADMAP-defined routes. The requirement is that a verdict be recorded and discoverable — not
   that every possible reading path through the ROADMAP, in isolation from its own adjacent
   Notes, be unambiguous. It is satisfied.
2. **Is the mitigation adequate?** Yes, with one gap. Three of four places a reader might land
   (findings doc, STATE.md, ROADMAP Phase 10 Notes) are unambiguous. The fourth — Phase 10's
   criterion 3 sentence, read completely alone — is not, and was left that way by design rather
   than by oversight.
3. **Gap requiring a fix, or accepted documentation-clarity issue?** **Accepted
   documentation-clarity issue**, logged here as a WARNING rather than a BLOCKER, for the
   following reason: fixing it would require either (a) rewording Phase 10's criterion 3 text
   in place — which 09-08's own threat model (T-09-08-B) correctly identifies as a scope-audit
   risk this phase was designed to avoid — or (b) adding yet a fourth pointer, which does not
   change the fact that a reader who deliberately reads only one sentence in isolation, skipping
   every adjacent Note, evidence document, and STATE.md, will always be able to misread
   something in a project of this documentation density. Phase 10's own dependency line already
   says "its recorded go/no-go verdict shapes criterion 3," which is itself an instruction to go
   read the verdict rather than trust the criterion's literal conditional at face value.

**Recommendation (non-blocking):** When Phase 10 is planned, its planner should be pointed at
this adjudication, and consider a light-touch fix at that time — e.g., appending "(see Phase 9
findings: this run's `degrade` was **not** bootstrap-related)" directly onto criterion 3's
sentence rather than only in the Notes below it. This does not need to happen before Phase 9 is
considered closed.

## Gaps Summary

None blocking. Phase 9's goal — five assumptions answered against a real build, with a recorded,
discoverable, machine-readable verdict — is achieved. The one documentation-precision issue
identified above (Phase 10 criterion 3's literal conditional, read in isolation) is recorded as
a WARNING for Phase 10's planner and does not block this phase's closure.

---

_Verified: 2026-08-20_
_Verifier: Claude (gsd-verifier)_
