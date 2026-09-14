---
phase: "56"
slug: "remove-shipped-modules-ts-and-its-embedded-source-scans"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-14"
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — plain `node --test '*.test.*'` glob, narrowed by `test-gate.mjs` |
| **Quick run command** | `node --test --test-reporter=tap <one-file>.test.ts` (D-15's own mechanism) |
| **Full suite command** | `npm run test:automated` (from `src/mcp/vice`) |
| **Estimated runtime** | ~14 s per large file; full automated set measured green 2026-09-14 |

**Do NOT use the bare `npm test` glob.** It blocks forever on `vice-proxy.test.ts`.
`test:automated` (`node test-gate.mjs`) is the only whole-suite command for this phase.

**Never pipe a suite run to `tail`/`head`** — that reports the pager's exit code and fakes a
green baseline. Redirect to a file and read `$?` on the same line.

---

## Sampling Rate

- **After every file edit:** `node --test --test-reporter=tap <file>` (capture the name SET)
  and `npm run typecheck`
- **After every plan wave:** `npm run test:automated`
- **Before `/gsd-verify-work`:** `npm run test:automated` and `npm run typecheck` both green
- **Max feedback latency:** ~14 seconds (per-file); the full automated set is the wave gate

Per-file TAP runs are cheap enough (largest measured at 13.5 s) to run after **every file**,
not batched to the end of a wave.

---

## Per-Task Verification Map

This phase declares no upstream REQ-IDs (`TBD -- declare at planning time`). Its requirements
ARE the five ROADMAP success criteria, which are already mechanically checkable. The planner
maps tasks onto these five; `/gsd-validate-phase` fills the per-task rows after plans exist.

| Criterion | Behavior proven | Test Type | Automated Command | File Exists | Status |
|-----------|-----------------|-----------|-------------------|-------------|--------|
| SC-1 | `shipped-modules.ts` gone; zero import sites remain | structural grep | `grep -rl 'from "./shipped-modules.ts"' src/mcp/vice --include='*.ts'` returns nothing | ✅ grep gate | ⬜ pending |
| SC-2 | Every non-scanning case in a touched file survives | per-file SET diff | `node --test --test-reporter=tap <file>` before/after, diffed | ✅ D-15, proven working | ⬜ pending |
| SC-3 | Suite green, typecheck 0, drop reconciled case-by-case | full suite | `npm run test:automated`; `npm run typecheck` | ✅ both green at baseline | ⬜ pending |
| SC-4 | No touched file left empty or setup-only | per-file case count | post-cut TAP set is non-empty and every survivor carries an assertion | ✅ D-02 applied at case level | ⬜ pending |
| SC-5 | `anno-seam.test.ts` WR-25 survives byte-for-byte | per-file SET diff | named case present in the post-cut TAP set | ✅ locked by D-07 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Measured Baseline (the floor to return to at EVERY checkpoint)

Measured 2026-09-14, before any Phase 56 edit:

```
npm run test:automated  →  EXIT=0   tests 3753  pass 3744  fail 0  skipped 9
npm run typecheck       →  EXIT=0
```

**Compare SETS, never counts. Never pin a count in an assertion.** The expected test-count drop
is an outcome to reconcile case-by-case (criterion 3), not a number to assert against.

---

## Wave 0 Requirements

*Existing infrastructure covers all phase verification.* No new test file, fixture, or
framework install is required — this phase only removes test code. The one new mechanism
(D-14's scoping scan) is a throwaway scratch script that is **never committed** and is proven
against a planted violation before its output is trusted; it narrows the read and is never the
authority for a cut.

---

## Manual-Only Verifications

| Behavior | Criterion | Why Manual | Test Instructions |
|----------|-----------|------------|-------------------|
| A case qualifies as "its entire subject is source text" | SC-2 | No AST exists in this repo to scope it mechanically; a symbol-anchored scanner has a measured two-level helper-indirection blind spot | Hand-read every candidate case before removing it. The scanner narrows the read; it never authorises the cut |
| D-02 exemption judgement on a genuinely mixed case | SC-2, SC-4 | Requires judging whether the remainder still exercises production behaviour | Strip scanning assertions, keep survivors byte-for-byte, rename the case to what it now proves (D-03) |
| Un-flagged cases that scan source with zero `shipped-modules` symbol in their call chain | SC-2 | The scanner is symbol-anchored by construction and cannot find these | Skim each touched file's un-flagged case names for source-reading prose ("STRUCTURAL", "non-vacuity", "imports nothing") |

The twelve `MANUAL_ONLY_TESTS` files in `test-gate.mjs` contain **none** of the 17 affected
files, so `test:automated` exercises all 17 directly. Do not write a second copy of that list
anywhere — `test-gate.test.ts` fails the build if a file escapes both lists.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
