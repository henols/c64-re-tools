---
phase: "38"
slug: "proof-01-03-on-real-cracked-code"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-05"
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | — | T-38-02 | Corpus file's sha256 asserted before any measurement reads it | evidence schema | `grep -E '^PROOF0[123]_' .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/SCHEMA.md` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PROOF-01 | T-38-01 | Comparator resolves corpus paths through `confineToWorkspace()` only | unit | `cd src/mcp/vice && node --test <comparator>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PROOF-01 | T-38-02 | Release identity is name **plus** sha256 digest; mismatch refuses outright | evidence outcome-line | `grep -E '^(PROOF01_RELEASE_SHA256\|PROOF01_DATA_RECOVERY_PCT\|PROOF01_FALSE_POSITIVES\|FIXTURE_DATA_RECOVERY_PCT\|FIXTURE_FALSE_POSITIVES\|FIXTURE_REPRODUCED): ' .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-*.md` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PROOF-02 | T-38-03 | Ghidra reached only through the Phase 34 host-tool seam, never a direct spawn | evidence outcome-line | `grep -E '^PROOF02_(COMPUTED_DISPATCH\|SITES_ENUMERATED\|SEARCH_DEPTH): ' .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-*.md` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PROOF-02 | T-38-03 | Seam-bypass grep gate stays green and un-narrowed | source assertion | `cd src/mcp/vice && npm run test:automated 2>&1 \| tail -20` (SEAM-05 gate included) | ✅ | ⬜ pending |
| TBD | TBD | 1 | PROOF-03 | — | Bank-state model's planted-violation cases stay green | unit | `cd src/mcp/vice && node --test anno-bank.test.ts` | ✅ (18 cases, incl. 2 planted violations) | ⬜ pending |
| TBD | TBD | 1 | PROOF-03 | — | Both directions of the `$01` boundary recorded, whichever way each came out | evidence outcome-line | `grep -E '^PROOF03_' .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof03-*.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/SCHEMA.md` — the PROOF-01/02/03 outcome-line vocabulary, **committed before any measurement is taken**. This mirrors `GATE-01`'s "rules committed before measurement" discipline in lighter weight: it declares the key names, not a rule table.
- [ ] `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/README.md` — evidence conventions for this phase (mirror Phase 33's).
- [ ] Measure and record the `test:automated` floor **with the broker stopped**, before any code lands. The floor is a recorded baseline, never a gate (`evidence/DECISION-RULE.md` convention).
- [ ] The PROOF-01 comparator + its test file (does not exist anywhere today — it joins `dxa-partition.ts`'s byte-derived ground truth against `dxa-listing.ts`'s parsed output).
- [ ] Framework install: **none needed** — `node --test`, dxa 0.1.5, and Ghidra 12.1.3 are all present on this host.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The corpus `.d64` images (`danish.d64`, `saeger.d64`) are present and digest-correct | PROOF-01, PROOF-02 | Gitignored and operator-supplied — they are deliberately not committed, so no automated check can provision them. A fresh clone on another machine genuinely cannot run these measurements. | Confirm the images are on disk and their sha256 matches the value recorded in the Phase 33/35 gate frontmatter. A mismatch or absence must **fail loudly** — never silently substitute a synthetic image. |
| `$GHIDRA_HOME` is exported and points at a Ghidra with `6502:LE:16:nmos` installed | PROOF-02 | Host prerequisite, not vendored; it is **not exported by default** in this shell environment (Ghidra lives at a non-standard path — locate `analyzeHeadless`, never guess a prefix). | Every task that runs Ghidra sets `GHIDRA_HOME` explicitly and asserts the SLEIGH language is listed before relying on a result. |
| The judgement that a recorded measurement is stated *beside* the fixture figures rather than *instead of* them | PROOF-01 | The `grep` proves the fixture keys are present in the same file; it cannot prove the prose frames them honestly. | Read the evidence file and confirm both number sets appear, that the pivot's `72.46%` / `0 FP` appear only beside them, and that the non-reproduction cause is written as a **hypothesis**, not a finding. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `test:automated` floor measured with the broker stopped, and compared as a relation — never a pinned count
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
