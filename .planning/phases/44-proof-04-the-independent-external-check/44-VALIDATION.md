---
phase: "44"
slug: "proof-04-the-independent-external-check"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-10"
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `44-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-subset selector, not a framework config |
| **Quick run command** | `cd src/mcp/vice && node --test evid-reconcile.test.ts evid-ingest.test.ts textmon-memmap.test.ts block-class.test.ts && npm run typecheck` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~120 seconds (automated subset) |

**Known-good baseline is NOT zero.** `test:automated`'s floor is **3 failures** in
`anno-register` / `anno-import` (one named bookkeeping cause) as of 2026-09-09. An
intermittent 4th failure is a `zz-scratch` ENOENT race, not a regression. Never pipe
`npm test` (the full, non-gated glob) into `tail` — it hangs forever on
`vice-proxy.test.ts`, and reporting `tail`'s exit code fakes a green baseline. Redirect
and read `$?` on the same line.

**A live VICE broker deterministically reddens `vice-proxy.test.ts` BACK-05.** Stop the
broker before trusting any suite reading, and record `BROKER_STATE: inactive` before and
after every live evidence run — the discipline every evidence plan in this milestone used.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test <touched>.test.ts && npm run typecheck`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full automated suite at its known 3-failure floor (not 0)
- **The live measurement is its own gate**, recorded in `evidence/proof04-*.md` with its
  derivation rule fixed **before** the run, independent of the unit suite
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Deliverable | Plan | Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|------|-------------|-----------|-------------------|-------------|--------|
| D1 — SCHEMA.md derivation rule fixed before any measurement | 01 | PROOF-04 | other (grep + commit-order) | `grep -ac 'not-exercised\|frame-exact-region\|narrowed' evidence/SCHEMA.md` + `git log` order vs. run transcripts | ✅ | ✅ green |
| D2 — two structurally-independent producers, closed import boundary | 01 | PROOF-04 | unit | `node --test evidence/proof04-independence.test.ts` | ✅ | ✅ green |
| D3 — join is the shipped `reconcileObservedExecution()`, one call site | 01 | PROOF-04 | unit | `node --test evidence/proof04-independence.test.ts` | ✅ | ✅ green |
| D4 — one live end-to-end pass at anchor depth 10 | 01 | PROOF-04 | manual_procedural | N/A by design — live measurement | ✅ (transcripts) | 🔵 manual-only |
| D1 — Run A, anchor hit 50, `frame-exact-region` | 02 | PROOF-04 | manual_procedural | N/A by design — live measurement | ✅ `proof04-run-a-hit50.md` | 🔵 manual-only |
| D2 — Run B, anchor hit 3000, `narrowed` | 02 | PROOF-04 | manual_procedural | N/A by design — live measurement | ✅ `proof04-run-b-narrowed.md` | 🔵 manual-only |
| D3 — neither run supersedes the other; every run attempted is recorded | 02 | PROOF-04 | other | transcript content assertion (both files carry the explicit sentence) | ✅ | ✅ green |
| D4 — no emulator left behind; no run on a contended machine | 02 | PROOF-04 | other | `pgrep -x x64sc` exits 1; `systemctl --user is-active vice-broker` reads `inactive` | ✅ | ✅ green |
| D1 — record states both counts beside PROOF-01's three figures, unreplaced | 03 | PROOF-04 | other | record census / scope / hygiene gates (Task 1 verify blocks) | ✅ | ✅ green |
| D2 — committed gate re-derives every stated number, proven non-vacuous | 03 | PROOF-04 | other | `node evidence/proof04-verify-record.mjs` | ✅ | ✅ green |
| D3 — automated subset at its documented floor, broker inactive | 03 | PROOF-04 | integration | `cd src/mcp/vice && npm run test:automated` | ✅ | ✅ green (floor 3) |
| D4 — doc-guards and this phase's structural gates all pass | 03 | PROOF-04 | unit | `node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts`; `node evidence/proof04-reconcile.mjs --self-check` | ✅ | ✅ green |
| D5 — three prose judgments a command cannot settle | 03 | PROOF-04 | manual_procedural | N/A — tone/framing judgment | ✅ (44-UAT.md test 1) | 🔵 manual-only — **signed off 2026-09-10** |

*Populated by `/gsd-validate-phase` 2026-09-10 from the three SUMMARY `coverage:` blocks. Deliverable ids are the `coverage:` ids, which are what this phase's plans actually emitted — the seeded `{N}-01-01` task-id shape was never used by these plans.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

### Requirement → test intent (from RESEARCH.md)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROOF-04 · Criterion 1 (count computed) | A live run against real cracked code produces a genuine `disagreementCount` / denominator pair with its positive class named | live evidence transcript — a **measurement**, not an assertion of a known number (the same shape `PROOF-01` and `EVID-06` used) | N/A by design — no CI assertion of a specific count | N/A by design |
| PROOF-04 · Criterion 2 (structural independence) | Neither producer script imports the other's domain; the oracle producer cannot read the classifier's output | unit / structural | `node --test evidence/proof04-independence.test.ts` | ❌ W0 — new file, following `textmon-memmap.ts`'s own import-purity test pattern |
| PROOF-04 · Criterion 2 (join purity) | `reconcileObservedExecution()` fetches nothing and mutates nothing | unit | `node --test evid-reconcile.test.ts` | ✅ already exists and passing (Phase 43) |
| PROOF-04 · Criterion 3 (shortfall / `not-exercised`) | The derivation rule is written before any run; a shortfall is recorded with its denominator rather than smoothed over | manual — evidence-document discipline, mirroring Phase 38's `proof02-computed-dispatch.md` | N/A — process discipline, not a test | ❌ W0 (the rule document) |
| PROOF-04 · Criterion 3 (EVID-06 bound respected) | Any run past anchor hit 50 is labelled `instrumented` / narrowed rather than claimed frame-exact | manual — live transcript review | N/A — a runtime depth choice recorded during the run, not assertable in advance | N/A by design |

---

## Wave 0 Requirements

- [x] `evidence/proof04-independence.test.ts` — delivered (plan 44-01, commit `d2dee305`).
      7/7 pass, including planted-violation controls in **both** directions (a forbidden
      specifier in a real import position IS flagged; the same token inside a comment is NOT).
- [x] `evidence/proof04-subject-dxa.mjs` — delivered (plan 44-01, commit `c62c261b`).
      Imports only `node:` builtins, the compiled `host-tool.mjs` seam and `dxa-run.ts`;
      never touches VICE.
- [x] `evidence/proof04-oracle-memmap.mjs` — delivered (plan 44-01, commit `c62c261b`).
      Imports only `node:` builtins, `probe-harness.mjs`, `text-protocol.ts`,
      `textmon-memmap.ts`, `stock-protocol.ts`, `evid-ingest.ts`; never reads the
      classifier's output.
- [x] The derivation-rule document — `evidence/SCHEMA.md`, committed at `c62c261b`
      (17:13:09), strictly before both run transcripts (`00450ac3` 17:28:40,
      `dd1517e8` 17:32:15). Amendment ledger §9 is empty.
- [x] No framework install needed — confirmed; `node --test` remained the runner and no
      dependency was added (both plans' `tech-stack.added` are empty).

**One deliverable beyond the seeded Wave 0 list** was produced and is also green:
`evidence/proof04-verify-record.mjs` (plan 44-03) — a committed gate re-deriving every
number the findings record states from the two transcripts alone, proven non-vacuous
against a planted altered `PROOF04_DENOMINATOR`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The false-positive measurement itself | PROOF-04 · C1 | The true count is not knowable in advance — this is a measurement, and a CI assertion of a specific number would be circular | Drive `/usr/bin/x64sc` (genuine stock 3.9; `-default` must precede `-binarymonitor`) via `probe-harness.mjs` at an anchor depth inside the proven window (≤ hit 50). Ingest the `memmapshow` reply under the real launch `argv`. Feed the shipped join. Record count, denominator and positive class beside `PROOF-01`'s `100.00 (24/24)` / fixture `72.39 (97/134)` / pivot `72.46 (100/138)`, never replacing them. |
| Depth / exactness labelling | PROOF-04 · C3 | Whether a given run stayed inside the frame-exact window is a fact about that run | Record the anchor hit depth reached. At ≤50, EVID-06 licenses `no-perturbation`. Past 50 (and certainly from 75, where the S3 sequence diverges), label the run `instrumented` and state any comparison against v0.8.0's frame-exact captures as **narrowed**, not assumed. |
| `not-exercised` closure | PROOF-04 · C3 | A measurement phase must be free to close on `not-exercised` without that reading as failure | If the check cannot be run, record `not-exercised` together with what was searched and at what depth — the shape Phase 38 recorded for `PROOF-02`. This is a legitimate phase outcome, not a gap. |

---

## Validation Sign-Off

- [x] All deliverables have an automated verify or a declared manual-only entry — 9 of 13
      automated and green, 4 manual-only **by design** (see below)
- [x] Sampling continuity: no 3 consecutive deliverables without automated verify
- [x] Wave 0 covers all MISSING references — every Wave 0 item delivered, none outstanding
- [x] No watch-mode flags
- [x] Feedback latency < 120s (phase-specific gates run in ~1s; full automated subset ~120s)
- [ ] `nyquist_compliant: true` — **deliberately NOT set.** See the note below.

### Why this phase closes PARTIAL and not compliant

`nyquist_compliant: true` would assert that every requirement has automated verification.
PROOF-04's Criterion 1 is a **measurement**, and the seeded strategy above already recorded
why it cannot be a CI assertion: "the true count is not knowable in advance — a CI assertion
of a specific number would be circular." The four manual-only entries are the two live runs,
the depth/exactness labelling, and the closing record's tone/framing judgment. Automating any
of them would either fabricate a known answer or assert a fact about one particular run.

This is the same shape PROOF-01 (Phase 38) and EVID-06 closed in. PARTIAL here is the
correct terminal state, not an outstanding gap — re-running `/gsd-validate-phase 44` will
reach the same conclusion.

**Approval:** validated 2026-09-10 — PARTIAL (9 automated / 4 manual-only, all 4 signed off)

---

## Validation Audit 2026-09-10

| Metric | Count |
|--------|-------|
| Deliverables audited | 13 |
| Automated + green | 9 |
| Manual-only (by design) | 4 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

No `gsd-nyquist-auditor` was spawned: gap analysis found nothing MISSING, so the workflow's
own "No gaps → skip to Step 6" path applied.

### Commands re-run during this audit (not merely cited)

Broker confirmed `inactive` and `pgrep -x x64sc` empty before the run, per the project's
standing evidence discipline.

| Command | Result |
|---------|--------|
| `node --test evidence/proof04-independence.test.ts` | 7/7 pass, exit 0 |
| `node evidence/proof04-reconcile.mjs --self-check` | `SELFCHECK_RESULT pass`, exit 0 |
| `node evidence/proof04-verify-record.mjs` | `RECORDGATE_RESULT pass`, 7/7 named assertions, exit 0 |
| `node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts` | 50/50 pass, exit 0 |
| `cd src/mcp/vice && npm run test:automated` | tests 4051, pass 4034, **fail 4**, skipped 8, exit 1 |

### On the suite's 4 failures — floor, not regression

The count differs from plan 44-03's recorded 3, so the **failure set** was compared rather
than the count (the count alone is not the signal):

- 3 failures in `anno-import.test.ts` / `anno-register.test.ts` — the documented STORE-06
  bookkeeping floor, unchanged.
- 1 failure in `check-skill-tool-coverage` — the known `zz-scratch` ENOENT race
  (`src/skills/acme-build/zz-scratch-7teBBr/zz-scratch-wr03-regression.md`, a scratch file
  removed by a concurrent test between the directory walk and the read). Intermittent,
  pre-existing, and unrelated to anything Phase 44 touched.

No failure is attributable to this phase, and no new failure was introduced. Deliverable
44-03 D3 holds as recorded.
