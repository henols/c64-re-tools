---
phase: "49"
slug: "the-reassembly-gate-committed-before-the-phase-it-gates"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-13"
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `49-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node:test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the driver, not a config file |
| **Quick run command** | `cd src/mcp/vice && node --test acme-verify.test.ts anno-export-asm.test.ts anno-hazard-report.test.ts` (extend with this phase's new test file once named) |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~30-90 seconds (quick), full suite longer |

**Traps this phase must not fall into** (recorded, not hypothetical):

- `npm test` on the full unfiltered glob **hangs** — it blocks forever on `vice-proxy.test.ts`. Use `npm run test:automated`.
- `test:automated` **skips** the `MANUAL_ONLY_TESTS` set (`test-gate.mjs:125-146`). Compare the skip **set**, never the count.
- **Never pipe the test command** through `tail`/`head`/`grep` and read the exit code — the pipeline reports the last stage's status, faking a green baseline. Redirect to a file and read `$?` on the same line.
- A **live VICE broker reddens** at least one test deterministically. Stop the broker before trusting any suite result.

---

## Sampling Rate

- **After every task commit:** the quick run command, scoped to the files that task touched.
- **After every plan wave:** `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** full suite green (exit code read directly, not via a pipe), **and** the gate itself run for real — green, or explicitly acknowledged per criterion 5.
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Populated by the planner/executor once PLAN.md task IDs exist. Requirement for every
> row: an `<automated>` command with a stated `<fails_when>` failing direction.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | BUILD-06 | T-49-xx / — | N/A (CI/dev-time gate, no shipped runtime surface) | unit | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → criterion coverage (from RESEARCH.md)

| Criterion | Behavior | Test type | Exists? |
|-----------|----------|-----------|---------|
| 1 | Decision rules + outcome vocabulary committed **before** any measurement; `git log` proves the ordering | structural (git history inspection) | ❌ Wave 0 |
| 2 | Verdict is a byte-diff against `expectedBytes`; no exit-status / aggregate-line / stale-path shortcut; **extends** `acme-verify.ts`'s three-outcome oracle rather than minting a second | unit | ✅ file to extend; ❌ new tests |
| 3 | Gate observed **RED** on three planted controls: wrong-byte rebuild, stale output path, hazard-adjacent range outside diff scope | unit (planted violation, mirroring `acme-verify.test.ts`'s MANDATORY RED pattern) | ❌ Wave 0 |
| 4 | Movement exercised on **every** run; same-address-only round trip refused; half-moved split hi/lo table caught | unit + real ACME (`{ skip: SKIP_REASON }`) | ❌ Wave 0 — no relocation mechanism exists |
| 5 | Non-clean hazard report blocks, or passes only with per-finding acknowledgement visible in the verdict artifact | unit | ❌ Wave 0 — no acknowledgement mechanism exists |

---

## Wave 0 Requirements

- [ ] `SCHEMA.md` — outcome-line vocabulary + verdict-artifact frontmatter shape, committed **first**
- [ ] `DECISION-RULE.md` — the first-match-wins rule table, committed alongside `SCHEMA.md`, **before any measurement**
- [ ] A tree-aware extension to `acme-verify.ts` (`cwd`-aware, so bare-filename `!source` lines resolve) plus its unit tests
- [ ] A new gate test file carrying the three planted RED controls from criterion 3
- [ ] A movement/relocation mechanism and its tests — genuinely new, no prior art
- [ ] A hazard-finding acknowledgement mechanism and its tests — genuinely new, `HazardFinding` has no stable `id`
- [ ] `docs/phase49-*-findings.md` — the committed, machine-readable verdict artifact Phase 50 reads

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rules-before-measurement ordering (criterion 1) | BUILD-06 | The property is about **git commit order**, which no in-suite assertion can observe from the working tree alone | `git log --diff-filter=A --format="%ad %h %s" -- <evidence dir>/DECISION-RULE.md <evidence dir>/SCHEMA.md <verdict artifact>` — the rules' add-commit must precede the verdict's |
| Real-ACME rebuild green (phase exit condition) | BUILD-06 | Requires ACME installed on the host; the project **never auto-installs** external tools | Install ACME per `README.md`, then run the gate's real-ACME test path (not the `skip`ped one) and confirm a byte-clean verdict or a recorded acknowledgement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` naming an observable failure signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Test command exit code read directly, never through a pipe
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
