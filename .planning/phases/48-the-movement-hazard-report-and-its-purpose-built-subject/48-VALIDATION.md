---
phase: "48"
slug: "the-movement-hazard-report-and-its-purpose-built-subject"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-12"
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`), no separate framework |
| **Config file** | none — colocated `*.test.ts` files; `package.json`'s `"test"` script is `node --test '*.test.*'` |
| **Quick run command** | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` (once Wave 0 creates it) |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~10s quick · ~120s full suite |

**Do not use the bare full glob.** `npm test` blocks indefinitely on
`vice-proxy.test.ts`; `npm run test:automated` (`node test-gate.mjs`) is the
runnable suite. Never pipe it — `| tail` reports tail's exit code and fakes a
green baseline; redirect and read `$?` on the same line.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test anno-hazard-report.test.ts`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full suite must be green, or its skip floor explicitly compared as a SET (never a count)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*Task IDs are filled in by the planner; the rows below bind each phase
criterion to the automated command that proves it.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | BUILD-04 (crit. 1) | — | N/A | integration | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | BUILD-04 (crit. 2) | — | Report refuses a write path | unit (structural) | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | BUILD-04 (crit. 3) | — | N/A | unit | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | BUILD-04 (crit. 4) | — | Undecided never renders as clean | unit | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | BUILD-04 (crit. 5) | — | Never-observed never reads as safe | unit (fixture-driven) | `cd src/mcp/vice && node --test anno-hazard-report.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/anno-hazard-report.ts` — the new pure, read-only module (final name is the planner's choice)
- [ ] `src/mcp/vice/anno-hazard-report.test.ts` — structural no-write test, per-class fire/decline tests, three-fixture cross-check
- [ ] `src/mcp/vice/fixtures/hazard-subject/` — committed ACME source, assembled `.prg`, and `.annostore.json` export
- [ ] The fixture design document criterion 1 requires — per-class variant choice and why it is not the textbook idiom
- [ ] Registration sites for the report's own verb: `anno-tools.ts`, `anno-cli.ts`, `anno-register.ts`, plus skill-doc routing (precedent: Phase 46's `anno_exclude_range`/`anno_include_range`)
- Framework install: none — `node --test` is already wired

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Subject shows visible on-screen behaviour in VICE | BUILD-04 (crit. 1) | "Visible on screen" is a human observation; the emulator-driving tests live in the MANUAL_ONLY set and are excluded from `test:automated` | Launch the subject `.prg` under stock `x64sc` via the broker, observe the documented on-screen effect, record the observation in the fixture design document |
| Mis-aligned negative control fails visibly | BUILD-04 (crit. 1, class 3) | Same — the VIC-II reading wrong bytes is an on-screen artifact, not an error signal the emulator reports | Assemble the deliberately mis-aligned variant, run it, confirm the garbled sprite/charset, record it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
