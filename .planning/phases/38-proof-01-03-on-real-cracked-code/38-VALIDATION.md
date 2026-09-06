---
phase: "38"
slug: "proof-01-03-on-real-cracked-code"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-05"
validated: "2026-09-06"
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **This is a measurement phase, not a feature phase.** Most requirements are
> verified by asserting on *outcome lines* in committed evidence files (the
> Phase 33 `GATE-01` pattern — a `grep` over named `KEY: value` lines in a
> committed `.md`), not by conventional unit tests. Where this phase ships real
> code (the PROOF-01 comparator), that code carries ordinary `node --test`
> coverage in addition.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`); colocated `src/mcp/vice/*.test.ts` / `*.test.mjs` |
| **Config file** | none — `test-gate.mjs`'s `automatedTestFiles()` / `MANUAL_ONLY_TESTS` is the one governing list |
| **Quick run command** | `cd src/mcp/vice && node --test <the touched test file>` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` — **never `npm test`**, whose whole-glob run does not terminate unaided (standing project baseline, `CLAUDE.md`) |
| **Estimated runtime** | ~90 seconds for `test:automated`; a single `node --test <file>` is a few seconds |

**Two standing baselines bind every suite result in this phase:**

1. **Stop the broker first.** A live VICE broker reddens `BACK-05` deterministically. `pgrep -f vice-broker` must be empty before any `test:automated` result is trusted.
2. **The floor is not zero.** `test:automated` currently reads `tests 3519 / pass 3517 / fail 2` (Phase 37's closing baseline; the 2 are pre-existing `anno-register.test.ts` bookkeeping failures unrelated to this phase). Measure the floor at Wave 0 and compare against it — do **not** adopt "0 failures" as this phase's acceptance bar, and do not pin the literal numbers above into an assertion.

---

## Sampling Rate

- **After every task commit:** the relevant evidence-file outcome-line `grep`, plus `node --test <touched test file>` if any shipped module changed.
- **After every plan wave:** `npm run test:automated` (broker stopped) + `npm run typecheck`.
- **Before `/gsd-verify-work`:** `test:automated` at or below its measured Wave 0 floor; `typecheck` clean.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is seeded at the **requirement**
level and must be expanded to one row per task during planning.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 38-01 T1 | 38-01 | 0 | — | T-38-02 | Outcome-line vocabulary committed before any measurement reads the corpus | evidence schema | `cd src/mcp/vice && node --test proof-evidence-integrity.test.ts` (case a derives the declared name set from `SCHEMA.md` at runtime) | ✅ 14/14 |
| 38-01 T2 | 38-01 | 1 | PROOF-01 | T-38-01 | Comparator never reads the filesystem and never spawns a process | unit | `cd src/mcp/vice && node --test dxa-proof01-compare.test.ts` | ✅ 6/6 |
| 38-01 T2 | 38-01 | 1 | PROOF-01 | T-38-02 | `PROOF01_FALSE_POSITIVES` stays the refusal string, never a bare `0`; the real number sits *beside* the fixture keys, not instead of them | evidence integrity | `cd src/mcp/vice && node --test proof-evidence-integrity.test.ts` (cases c, d) | ✅ 14/14 |
| 38-01 T2 | 38-01 | 1 | PROOF-01 | — | SEAM-06 host-tool family floor re-derived deliberately after the comparator joined the `dxa-*` glob | source assertion | `cd src/mcp/vice && node --test hostpath-consumers.test.ts` | ✅ 22/22 |
| 38-03 T1 | 38-03 | 2 | PROOF-02 | T-38-03 | The `$6C` site classifier actually discriminates `computed-index` from `immediate-index` — without this, `not-exercised` is vacuous | unit | `cd src/mcp/vice && node --test proof02-enumerate-sites.test.ts` | ✅ 12/12 **(added by this audit — G1)** |
| 38-03 T2 | 38-03 | 2 | PROOF-02 | T-38-03 | Verdicts stay inside their declared domain; D-06 circularity ordering (enumeration before Ghidra) holds | evidence integrity | `cd src/mcp/vice && node --test proof-evidence-integrity.test.ts` (cases b, f) | ✅ 14/14 **(added by this audit — G2)** |
| 38-03 T2 | 38-03 | 2 | PROOF-02 | T-38-03 | Seam-bypass grep gate stays green and un-narrowed | source assertion | `cd src/mcp/vice && npm run test:automated` (SEAM-05 gate included) | ✅ |
| 38-04 T2 | 38-04 | 3 | PROOF-02 | T-38-03 | The roll-up derivation rule precedes its own value line | evidence integrity | `cd src/mcp/vice && node --test proof-evidence-integrity.test.ts` (case f) | ✅ 14/14 |
| 38-02 T1 | 38-02 | 2 | PROOF-03 | — | Bank-state model's planted-violation cases stay green | unit | `cd src/mcp/vice && node --test anno-bank.test.ts` | ✅ 18/18 (incl. 2 planted violations) |
| 38-02 T2 | 38-02 | 2 | PROOF-03 | — | Both `$01` boundary directions recorded, and every `PROOF03_*` key emitted is a declared name | evidence integrity | `cd src/mcp/vice && node --test proof-evidence-integrity.test.ts` (case a) | ✅ 14/14 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `evidence/SCHEMA.md` — the PROOF-01/02/03 outcome-line vocabulary, **committed before any measurement is taken** (commit `bf1a0a17`, the phase's first). Declares **55** names.
      **Corrected command (G3).** This row previously read `grep -E '^PROOF0[123]_' … SCHEMA.md`, which returns **0**: `SCHEMA.md` declares its names in *backticks*, not at column 0, so the command was stale from the day it was written and never validated anything. The working form is:
      `grep -aoE '\`(PROOF0[123]|FIXTURE|PIVOT)_[A-Z_0-9]+\`' .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/SCHEMA.md | sort -u | wc -l` → `55`.
      This is now also asserted automatically, and derived rather than hardcoded, by `proof-evidence-integrity.test.ts` case (a).
- [x] `evidence/README.md` — evidence conventions for this phase (mirror Phase 33's).
- [x] `test:automated` floor measured **with the broker stopped**, before any code landed: `TEST_AUTOMATED_BASELINE: tests 3519 / pass 3506 / fail 2`. Recorded as a baseline, never a gate. The line's *shape* is now guarded by `proof-evidence-integrity.test.ts` case (e); its **counts are deliberately not pinned** in any assertion.
- [x] The PROOF-01 comparator + its test file — shipped as `src/mcp/vice/dxa-proof01-compare.ts` / `.test.ts` (6 cases).
- [x] Framework install: **none needed** — `node --test`, dxa 0.1.5, and Ghidra 12.1.3 were all present on this host.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The corpus `.d64` images (`danish.d64`, `saeger.d64`) are present and digest-correct | PROOF-01, PROOF-02 | Gitignored and operator-supplied — they are deliberately not committed, so no automated check can provision them. A fresh clone on another machine genuinely cannot run these measurements. | Confirm the images are on disk and their sha256 matches the value recorded in the Phase 33/35 gate frontmatter. A mismatch or absence must **fail loudly** — never silently substitute a synthetic image. |
| `$GHIDRA_HOME` is exported and points at a Ghidra with `6502:LE:16:nmos` installed | PROOF-02 | Host prerequisite, not vendored; it is **not exported by default** in this shell environment (Ghidra lives at a non-standard path — locate `analyzeHeadless`, never guess a prefix). | Every task that runs Ghidra sets `GHIDRA_HOME` explicitly and asserts the SLEIGH language is listed before relying on a result. |
| The judgement that a recorded measurement is stated *beside* the fixture figures rather than *instead of* them | PROOF-01 | The `grep` proves the fixture keys are present in the same file; it cannot prove the prose frames them honestly. | Read the evidence file and confirm both number sets appear, that the pivot's `72.46%` / `0 FP` appear only beside them, and that the non-reproduction cause is written as a **hypothesis**, not a finding. |
| The four `human_judgment: true` coverage claims across plans 38-01..38-04 | PROOF-01, PROOF-02, PROOF-03 | Each plan's own `<verify>` reserved these for a human reader, and this audit did **not** overturn that. `proof-evidence-integrity.test.ts` now mechanises the *structural* half each one leaned on (keys present, verdicts in domain, ordering correct); the residue is genuinely a prose-honesty judgment and no test can close it. | Read `proof01-dxa-real-release.md`, `proof02-loader-stage.md`, `proof02-depacked-capture.md`, `proof02-computed-dispatch.md` and `proof03-bank-boundary.md` and confirm each frames a `not-exercised` verdict as a statement about the depths actually searched — never a clean bill of health — and that the flat64k run's zero decompiled functions is disclosed rather than smoothed over. |
| The PROOF-02 verdict's *external* validity — that no computed dispatch exists in the release at a depth nobody searched | PROOF-02 | Structurally uncomputable, in the same way `PROOF01_FALSE_POSITIVES` is. `proof02-enumerate-sites.test.ts` now proves the classifier can *tell the two shapes apart* (so `not-exercised` is not vacuous), but no test can prove the search depth was sufficient. | Treat `PROOF02_COMPUTED_DISPATCH: not-exercised` as scoped to the loader and depacked depths named in `proof02-computed-dispatch.md`, and nothing wider. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a recorded manual-only entry
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (each new file runs in well under 1s standalone)
- [x] `test:automated` floor measured with the broker stopped, and compared as a relation — never a pinned count
- [ ] `nyquist_compliant: true` — **not set.** Four verifications remain genuinely manual (gitignored corpus, Ghidra host prerequisite, and two prose-honesty judgments that are uncomputable rather than merely unwritten). This phase is `validated / PARTIAL` by design, not by omission.

**Approval:** validated (partial) — 2026-09-06

---

## Validation Audit 2026-09-06

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

**Gaps and disposition**

| ID | Requirement | Gap | Resolution |
|----|-------------|-----|------------|
| G1 | PROOF-02 | MISSING — `evidence/proof02-enumerate-sites.mjs` carried a 256-entry NMOS length table, a four-bucket classifier and a backward-realignment walk with **zero** automated tests, while being the sole basis of the `not-exercised` verdict and reused unchanged by plan 38-04. | `src/mcp/vice/proof02-enumerate-sites.test.ts`, 12 cases, green. The load-bearing one is the `computed-index` vs `immediate-index` discrimination: a classifier that could only ever answer `immediate-index`/`unknown` would make `not-exercised` vacuous, and nothing before this audit tested that. |
| G2 | PROOF-01, PROOF-02, PROOF-03 | MISSING — evidence outcome-line integrity was checked once by hand-typed `grep`s during execution; nothing re-ran them, so drift in a committed evidence file was undetected. | `src/mcp/vice/proof-evidence-integrity.test.ts`, 14 cases, green. Derives the declared name set from `SCHEMA.md` at runtime rather than hardcoding 55 names. Shape follows `absorbed-answer-key.test.ts`, the established precedent for an automated test reading committed `.planning` phase evidence. |
| G3 | — | PARTIAL — this file's own Wave 0 command `grep -E '^PROOF0[123]_' … SCHEMA.md` returned **0**: `SCHEMA.md` declares names in backticks, not at column 0. Stale since it was written pre-execution; it had never validated anything. | Corrected in the Wave 0 section above, and superseded by G2's case (a), which derives the same set programmatically. |

**Naming decision.** G2's guard was written as `docs-proof-evidence.test.ts` and is committed as **`proof-evidence-integrity.test.ts`**. The `docs-*.test.ts` basename matches `scripts/audit-gate.mjs`'s glob, which enrols a file in the *milestone-audit governance registry* — it reddened three `audit-integrity.test.ts` assertions on sight, and clearing them would have meant churning both `EXPECTED_DOCS_GUARD_NAMES` and the synthetic-tree fixture list to give a phase-scoped evidence guard project-wide gating weight it should not carry. `DOCS_GUARD_FLOOR` was left at `7`: it is a `>=` non-vacuity minimum (`audit-gate.mjs:450`), not a census, and raising it to match a file count is exactly what turns a shrink-detector into an assertion that reddens on a correct tree. `scripts/audit-gate.mjs` is unmodified by this audit.

**Suite state at sign-off** — broker confirmed inactive (`pgrep -x vice-broker`, `pgrep -x x64sc` both empty):

- `test:automated` reads `tests 3551 / pass 3536 / fail 4` and, on a repeat run, `pass 3534 / fail 6`. The run-to-run difference is the known repo-tree scratch-file race (`audit-root-args.test.ts`, `check-skill-fork-honesty`), not a regression.
- The **stable** failures are four, and **none is attributable to this audit** — neither new file appears in any failing-test attribution:
  1. `anno-register.test.ts` DIRECTION 5 — the documented pre-existing baseline failure (`STORE-01` undeclared in `REQUIREMENTS.md`).
  2. `anno-register.test.ts` planted-violation negative control — the second half of that same documented baseline.
  3. `docs-review-disposition.test.ts` — `38-REVIEW.md`'s `WR-01`/`WR-02`/`WR-03` carry no recorded disposition. **Pre-existing Phase 38 condition**, committed 2026-09-05, before this audit ran.
  4. `audit-integrity.test.ts` D-12-02 — a *cascade* of (3): a red docs guard while five milestone audits declare a gated status. Proven pre-existing by removing both new test files and re-running: still `43/44` with the identical single failure.
- The recorded baseline was 2; it is now 4. **The delta is (3) and its cascade (4), not this audit.** Closing it is a `/gsd-code-review --fix --all` task on `38-REVIEW.md`, out of scope for validation.
