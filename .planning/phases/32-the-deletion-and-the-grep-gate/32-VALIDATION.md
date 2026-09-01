---
phase: 32
slug: the-deletion-and-the-grep-gate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
validated: 2026-09-01
created: 2026-08-31
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `32-RESEARCH.md` § Validation Architecture (lines 795-860).
> The Per-Task Verification Map is filled once PLAN.md tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no third-party framework |
| **Config file** | none; `src/mcp/vice/package.json` `scripts` block + `src/mcp/vice/test-gate.mjs` |
| **Quick run command** | `cd src/mcp/vice && npm run test:automated` |
| **Full suite command** | `test:automated` + `test:manual` worked file-by-file (`D-12`); the union is the whole glob |
| **Estimated runtime** | ~50 seconds (measured: 2920 tests, 0 fail, broker inactive) |

**Measured baseline (research §7.2): `test:automated` exits 0 today.** The historical
44-, 7- and 5-failure baselines are superseded; the clean floor is **0**.

**Landmine (research §7.5, `D-13`):** a **live broker** makes the BACK-05 D-G ordering
test red deterministically. Broker-down is an asserted, recorded precondition of any
gate run — never a scripted kill (the broker is a systemd unit here).

**Landmine:** `npm test` over the full glob hangs locally on `vice-proxy.test.ts`.
Run it last, under an explicit timeout.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && npm run test:automated` + the six `check-*.mjs` CI scripts
- **After every plan wave:** add `node scripts/audit-gate.mjs --json` and `cd src/mcp/vice && npm run typecheck`
- **Before `/gsd-verify-work`:** research §7.4's recipe in full, recorded per `D-15`
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

*Filled by `/gsd-validate-phase` on 2026-09-01 from the 21 executed plans. Every row below
was re-run at HEAD `88f16c9` with the broker `inactive` — statuses are measured, not carried
over from the plans' own SUMMARY claims.*

| Req | Behavior | Test Type | Automated Command | Status |
|-----|----------|-----------|-------------------|--------|
| CUT-04 | Every audited-set member has a fate row | unit | `node scripts/check-guard-fates.mjs` — its own file name (`D-16`), its own CI step `ci.yml:258` ("Validate every audited guard has a recorded, non-vacuous fate (CUT-04)"), and **absent** from `src/mcp/vice/package.json` `scripts` (grep count 0) | ✅ green — exit 0, `setA=43 setB=16 setC=2 total=61`, `rows=61` |
| CUT-04 | The fate guard is itself non-vacuous (delete a row → red) | unit | `cd src/mcp/vice && node --test guard-fates.test.ts` | ✅ green — 21/21, 0 fail |
| CUT-04 | Each re-pointed guard observed red against its **new** subject | instrument | `node scripts/audit-mutation-harness.mjs --all` — run by hand; `D-17` keeps it out of CI (`ci.yml` grep 0) and out of `package.json` `scripts` (grep 0) | ✅ manual-only **by decision**, satisfied — 61 registry rows; last full sweep 35 OBSERVED RED / 26 SKIPPED / 0 UNMEASURABLE, tree restored byte-identical (`evidence/32-gap1-overlap-and-writeback.md`) |
| CUT-06 | `PROJECT.md`'s `vice-proxy.ts` citations are correct and mechanically checked | unit | `cd src/mcp/vice && node --test docs-linerefs.test.ts` | ✅ green — 12/12, widened per `D-10` |
| CUT-06 | No living document points a user at a deleted route | unit | `node scripts/check-no-analyser.mjs` | ✅ green — exit 0, every pinned exact count unmoved |
| CUT-06 | Close gate re-run | suite | research §7.4's recipe, recorded per `D-15` | ✅ green — `evidence/32-close-gate.md`, plus 18 further evidence records |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Gap analysis result: 0 MISSING, 0 PARTIAL.** The three Wave-0 `❌` rows in the seeded
version of this table are now all delivered and green. The one row that is not automated —
the mutation harness — is manual-only *by decision* `D-17`, not by omission, and is recorded
in the Manual-Only Verifications table rather than counted as a gap. No `gsd-nyquist-auditor` run was
needed and no tests were generated.

---

## Wave 0 Requirements

All six delivered and verified at HEAD `88f16c9`.

- [x] The fate-registry guard — its own file name, its own named CI step, **out of** `src/mcp/vice/package.json`'s `scripts` block (`D-16`, `audit-gate.mjs` `D-12-11`) — `scripts/check-guard-fates.mjs`; CI step at `ci.yml:258`; `scripts` grep count 0
- [x] The guard's own non-vacuity test (deleting a row must red it) — `src/mcp/vice/guard-fates.test.ts`, 21/21
- [x] The fate registry itself — derive-from-disk, no hand-typed second list (`D-01`, `D-12-07`) — `SET_A_FLOOR`/`SET_B_FLOOR`/`SET_C_FLOOR`/`TOTAL_FLOOR` at `:115-136`; `resolveSetC()` `:430-454` throws unless exactly `SET_C_FLOOR` tokens each resolve to exactly one tracked path
- [x] The mutation harness (`D-04`, `D-17`) with a restore-on-exit handler that cannot leave the tree dirty — `scripts/audit-mutation-harness.mjs`; `restoreAll()` `:171-184` with handlers on `exit`/`SIGINT`/`SIGTERM`/`uncaughtException` `:235-248`, idempotent solely via `originals.clear()` `:183`
- [x] `.github/workflows/ci.yml` — one new named step alongside the existing six, carrying no occurrence of the subject literal (`grep -ac` on the file stays at exactly 1, the pre-existing line 209)
- [x] `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/` — `D-15`'s close-gate record, plus 18 further evidence documents

**Both blocking hazards held:** the removal gate exits 0 at HEAD (no exact count moved by the
new CI step or the registry file), and the harness strips every `NODE_TEST_*` key from the
child env before spawning (`:563-567`), so no planted red is recorded as a green.

**Two blocking hazards the plan must design around (research §2, §4.3):**

1. `scripts/check-no-analyser.mjs` asserts **exact hit counts with `===`** per
   exemption, and `.github/workflows/ci.yml` is pinned at exactly **1**. A new CI step
   or registry file carrying the literal **reds the gate on the landing commit**.
2. `audit-gate.mjs`'s `runGuardsLive()` **strips every `NODE_TEST_*` key** before
   spawning. A harness that omits this records every planted red as a green — a fully
   vacuous audit, which is precisely the failure `CUT-04` exists to catch.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The mutation harness's per-row observed red | CUT-04 | `D-17` makes it a committed **phase instrument, not a CI job** — it mutates files and drives the whole guard set, the wrong shape for every-push CI, and its output is an audit measurement rather than a pass/fail contract | Run the harness on a clean tree with the broker down; capture raw command + raw output per row into `evidence/` (`D-15`) |
| The nine `MANUAL_ONLY_TESTS` legs of the close gate | CUT-06 | Six want a live emulator; one (`vice-proxy.test.ts`) hangs locally | Work file-by-file per research §7.1/§7.4; `vice-proxy.test.ts` last, under an explicit timeout |
| CI's whole-glob green | CUT-06 | It proves the nine manual-only files **did not fail**, not that they exercised anything (`D-14`) | Cite the CI run **and** the local legs; state the SKIP nuance in words (`D-14`) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — all six delivered
- [x] No watch-mode flags — zero `--watch` in any `src/mcp/vice/package.json` script
- [x] Feedback latency < 60s — `test:automated` measured ~50s
- [x] Broker state asserted and recorded for every gate run (`D-13`) — `systemctl --user is-active vice-broker` = `inactive` at this audit
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-01

---

## Validation Audit 2026-09-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (none to resolve) |
| Escalated | 0 |

Input state **A** (existing seeded `VALIDATION.md`, `status: draft`). Six requirement rows
re-measured at HEAD `88f16c9`, broker `inactive`: all six green, three of them the Wave-0 rows
that were `❌` at seed time. One row (the mutation harness) is manual-only by decision `D-17`
and is recorded as such, not as a gap. No auditor spawned, no test files generated, no
implementation file touched.

**Coverage honesty note (`D-14`).** CI's whole-glob green proves the nine `MANUAL_ONLY_TESTS`
files **did not fail** — not that they exercised anything. The Manual-Only Verifications table above states
that in words and is the reason this phase is `nyquist_compliant: true` while still carrying
three manual-only verifications.
