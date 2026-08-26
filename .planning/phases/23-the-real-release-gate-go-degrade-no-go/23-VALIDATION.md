---
phase: 23
slug: the-real-release-gate-go-degrade-no-go
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Unusual shape, deliberately.** This phase ships **no product code** (ROADMAP:
"Nothing here builds product… the Phase 9 shape exactly, 8 plans, zero product
code"). There is nothing to unit-test. As in Phase 9, the validation contract
closes on **evidence integrity** — grep-checkable outcome lines and git-ordering
facts — plus a plain regression gate proving the repo's behaviour did not move.

Source: `23-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json` `test` script: `node --test '*.test.*'` |
| **Quick run command** | `cd src/mcp/vice && npm test` |
| **Full suite command** | `cd src/mcp/vice && npm test` |
| **Estimated runtime** | ~60–120 seconds |

**Do not substitute `npm run test:automated`.** That subset skips
`MANUAL_ONLY_TESTS` and hides CI failures; the phase gate is the full `npm test`.

**Phase-gate role: regression only.** No new test belongs to this phase. The
suite must simply stay green, because the phase touches no source.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && npm test`
- **After every evidence commit:** Run that evidence artifact's grep assertion
  from the map below
- **After every plan wave:** Run `cd src/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** Full suite green **and** every outcome line
  below present
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs are assigned at planning time; rows here are keyed by requirement and
are the contract each plan's tasks must satisfy. `Threat Ref` is `—` throughout:
the phase writes no code and exposes no surface (see § Security Domain in
`23-RESEARCH.md`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 23-01 | 1 | PROOF-05 (ordering) | — | N/A | evidence | `git log --oneline --reverse -- .planning/phases/23-*/ \| head -1` names 23-01 | ✅ git | ⬜ pending |
| TBD | closing | — | PROOF-05 (verdict) | — | N/A | evidence | `grep -E '^verdict: (go\|degrade\|no-go)$' docs/phase23-*-findings.md` | ✅ grep | ⬜ pending |
| TBD | closing | — | PROOF-05 (rule cited) | — | N/A | evidence | `grep -E '^verdict_rule_applied: R[0-9]+$' docs/phase23-*-findings.md` **and** the fired rule's text reproduced in the body | ✅ grep | ⬜ pending |
| TBD | TBD | — | PROOF-01 | — | N/A | evidence | outcome lines `C1_DATA_RECOVERY_PCT:`, `C1_FALSE_POSITIVES:`, `C1_FALSE_NEGATIVES:`, `C1_ADJUDICATED_FRACTION:`, `C1_WINDOW:` all present in `evidence/criterion1-*.txt` | ❌ W0 (schema fixed in 23-01) | ⬜ pending |
| TBD | TBD | — | PROOF-01 (corpus identity) | — | N/A | evidence | `corpus.file_sha256` and `corpus.capture_sha256` present and non-empty in the findings frontmatter | ❌ W0 | ⬜ pending |
| TBD | TBD | — | PROOF-02 | — | N/A | evidence | `C2_COMPUTED_DISPATCH:` ∈ {`resolved`,`unresolved`,`not-exercised`}; if `resolved`, a target address is shown; otherwise a transcript path is cited | ❌ W0 | ⬜ pending |
| TBD | TBD | — | PROOF-03 | — | N/A | evidence | `C3_BANK_DIVERGENCE:` ∈ {`found`,`not-exercised`}; if `found`, address + two `$01` values + two resolutions shown | ❌ W0 | ⬜ pending |
| TBD | TBD | — | PROOF-04 | — | N/A | evidence | every row in `evidence/criterion4-*.md` matches `replaced-by:\|lost-accepted:\|lost-blocking:` | ❌ W0 | ⬜ pending |
| TBD | 23-01 | 1 | Inventory pre-commitment (D-05) | — | N/A | evidence | the inventory commit precedes the first `criterion[123]` evidence commit in `git log` | ✅ git | ⬜ pending |
| TBD | all | — | Repo integrity (no product code) | — | N/A | evidence | `git diff --name-only <phase-base>..HEAD` touches only `.planning/` and `docs/` — nothing under `src/` | ✅ git | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **The outcome-line schema itself** — every `❌ W0` row above is blocked on
      plan 23-01 fixing the exact literal outcome-line names
      (`C1_DATA_RECOVERY_PCT:` etc.), the measurement window, and the dxa flag
      set. This is not a test file to write; it is a pre-commitment to make, and
      it is the single highest-leverage item in the phase. A number whose window
      and flags were chosen after seeing the capture is exactly as unfalsifiable
      as a rule written after the measurement.
- [ ] **`evidence/` directory** under the phase dir, with the Phase 9
      `<evidence_conventions>` block restated: transcribe outcome lines from raw
      tool output, never from a summary's paraphrase; a `could-not-run` is
      written up as fully as a pass.
- [ ] No new test framework, fixture, or test file is needed. **Do not add one.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator supplies the corpus image | PROOF-01 | D-04: the corpus is operator-supplied (`.d64` or `.prg`); the phase does not fetch it | Operator places the image on the host and records its `sha256`; the phase records name/id + hash in the findings frontmatter |
| Depack-by-running capture | PROOF-01, PROOF-02, PROOF-03 | D-03: requires autostarting in a live VICE and breaking past the loader; timing is release-specific and cannot be scripted blind | Follow `src/skills/c64-ram-capture/SKILL.md`; prove capture equivalence between two runs before measuring |
| Verdict adjudication | PROOF-05 | Walking the actual outcome values through the pre-committed `R1..Rn` rule is a human read of evidence, exactly as Phase 9's `09-VERIFICATION.md` did it | Reproduce the fired rule in the findings body and show the outcome values that select it, so a reader re-derives rather than trusts |

---

## Validation Sign-Off

- [ ] All tasks have an evidence assertion or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated check
- [ ] Wave 0 covers all MISSING references (the outcome-line schema above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] Full `npm test` green (not `test:automated`)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
