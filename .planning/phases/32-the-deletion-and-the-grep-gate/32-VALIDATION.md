---
phase: 32
slug: the-deletion-and-the-grep-gate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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

*Not yet derivable — PLAN.md tasks do not exist at seed time. `/gsd-validate-phase`
fills this table from the executed plans. The requirement→behaviour map below is the
contract those rows must satisfy.*

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| CUT-04 | Every audited-set member has a fate row | unit | the fate guard, invoked as its own file name (`D-16`) | ❌ Wave 0 |
| CUT-04 | The fate guard is itself non-vacuous (delete a row → red) | unit | `cd src/mcp/vice && node --test <fate-guard>.test.ts` | ❌ Wave 0 |
| CUT-04 | Each re-pointed guard observed red against its **new** subject | instrument | the mutation harness, run by hand (`D-17` — never in CI) | ❌ Wave 0 |
| CUT-06 | `PROJECT.md`'s `vice-proxy.ts` citations are correct and mechanically checked | unit | `cd src/mcp/vice && node --test docs-linerefs.test.ts` | ✅ exists, needs widening (`D-10`) |
| CUT-06 | No living document points a user at a deleted route | unit | `node scripts/check-no-regenerator2000.mjs` | ✅ exists, green |
| CUT-06 | Close gate re-run | suite | research §7.4's recipe | ✅ exists |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] The fate-registry guard — its own file name, its own named CI step, **out of** `src/mcp/vice/package.json`'s `scripts` block (`D-16`, `audit-gate.mjs` `D-12-11`)
- [ ] The guard's own non-vacuity test (deleting a row must red it)
- [ ] The fate registry itself — derive-from-disk, no hand-typed second list (`D-01`, `D-12-07`)
- [ ] The mutation harness (`D-04`, `D-17`) with a restore-on-exit handler that cannot leave the tree dirty
- [ ] `.github/workflows/ci.yml` — one new named step alongside the existing six
- [ ] `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/` — `D-15`'s close-gate record

**Two blocking hazards the plan must design around (research §2, §4.3):**

1. `scripts/check-no-regenerator2000.mjs` asserts **exact hit counts with `===`** per
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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Broker state asserted and recorded for every gate run (`D-13`)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
