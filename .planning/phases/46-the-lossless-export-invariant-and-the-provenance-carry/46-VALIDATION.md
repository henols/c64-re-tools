---
phase: "46"
slug: "the-lossless-export-invariant-and-the-provenance-carry"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-11"
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json`'s `test` / `test:automated` scripts, plus `test-gate.mjs` (the automated-file-list gate) |
| **Quick run command** | `cd src/mcp/vice && node --test anno-export-asm.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~15s quick · ~5–8 min full suite |

**Baseline is NOT zero.** MEASURED this phase's research session: 3898 passing, 4 pre-existing
named failures, none in `anno-export-asm.test.ts`. Green means **"no new failure names"**, never
"zero failures" — diff the failing-test-name SET against the baseline, never compare counts
(the floor has drifted from the count recorded in earlier sessions). Never pipe `npm test`
through `tail`: the pipeline reports tail's exit code and fakes a green baseline.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test anno-export-asm.test.ts` (plus the new ledger-reader test file, if it lands in its own module)
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`, compared against the baseline failing-name set above
- **Before `/gsd-verify-work`:** Full suite must show no new failure names vs. baseline
- **Max feedback latency:** ~15 seconds (quick command)

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this draft maps each success criterion to its
verification so no criterion can reach execution without an automated command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner) | 01 | 0 | BUILD-07 (crit. 1) | — | Synthetic ledger fixture + test-only filtering exporter variant exist; neither ships | unit | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD (planner) | 01 | 1 | BUILD-07 (crit. 1) | — | Planted control range survives export byte-for-byte; **observed red first** against the filtering variant | unit | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD (planner) | 01 | 1 | BUILD-07 (crit. 2) | T-46-02 | User-requested exclusion emitted as a recorded, marked range — never a silent hole; readable back | unit | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD (planner) | 01 | 1 | BUILD-05 (crit. 3) | T-46-01 | Every emitted block carries an inline verdict+confidence comment regardless of value; ledger free-text routed through `assertExportableCommentText()` | unit | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD (planner) | 01 | 1 | BUILD-05 (crit. 3) | — | **Structural** guard: exporter source reads no confidence threshold and takes no inclusion decision from a verdict (WR-07 source-text-scan idiom) | structural | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD (planner) | 01 | 1 | BUILD-05 (crit. 4) | T-46-03 | Verdict read from ledger, never re-derived; ledger absent → refusal **by name** with remedy, no invented verdict | unit | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| TBD (planner) | 01 | 1 | BUILD-07 | — | If an exclusion table lands: `SCHEMA_VERSION` bump doc-comment per the EVID-02 template, plus store coverage | unit | `cd src/mcp/vice && node --test anno-store.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A **synthetic ledger fixture builder** — built via `renderLedger()`'s pure, filesystem-free API (or an equivalent literal `generatedRanges` array). No real cracked-release corpus exists in this repo and none is required.
- [ ] A **deliberately-filtering exporter variant**, test-only and local to the test file, never shipped — exists solely to prove the planted control is *capable* of going red before its green result is trusted.
- [ ] The **ledger-reader** test file, if the reader lands in its own module rather than inside `anno-export-asm.ts`.
- [ ] If an exclusion table is added: `SCHEMA_VERSION` doc-comment block copied from the EVID-02 template (`anno-types.ts:186-259`) plus its `anno-store.test.ts` coverage.

*Framework install: none — `node --test` is already wired.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ACME round-trip assembly of an export carrying the new provenance comments | BUILD-05 | Needs the external ACME assembler on `$PATH`; `acme-gate.ts`'s `SKIP_REASON` skips it where absent (CI). ACME 0.97 "Zem" at `/home/henrik/.local/bin/acme` is present on this host (MEASURED), so it runs here but cannot be assumed everywhere. | `cd src/mcp/vice && node --test anno-export-asm.test.ts` — confirm the round-trip cases did not report `SKIP_REASON`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] Full-suite results compared as a failing-NAME set against the baseline, never as a count
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
