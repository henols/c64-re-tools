---
phase: "47"
slug: "multi-file-rebuildable-source"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-12"
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json`'s `test` / `test:automated` scripts drive it |
| **Quick run command** | `cd src/mcp/vice && node --test anno-export-asm.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~15s targeted; ~3–6 min for `test:automated` |

**Do not run the bare full glob.** `npm test` (`node --test '*.test.*'`) hangs
indefinitely on `vice-proxy.test.ts` in this environment. `test:automated`
(via `test-gate.mjs`) is the command this project's `.planning/config.json`
names as `workflow.test_command` and is the one to use for phase gating.
`test:automated` skips the MANUAL_ONLY_TESTS set, so compare the skip **set**,
never the count, when reading its output.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test anno-export-asm.test.ts` (add `host-tool.test.ts` when that file was touched)
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full suite green **plus** `cd src/mcp/vice && npm run typecheck`
- **Max feedback latency:** 20 seconds for the per-task command

---

## Per-Task Verification Map

Task IDs are seeded at requirement level; `/gsd-validate-phase` fills per-task
rows once PLAN.md task numbering exists.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-TBD | TBD | TBD | BUILD-01 | — | Export refuses rather than writing outside the chosen output directory | integration (real ACME spawn) | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| 47-TBD | TBD | TBD | BUILD-01 (cwd plumbing) | — | `cwd` is a spawn option, never interpolated into generated source | unit | `cd src/mcp/vice && node --test host-tool.test.ts` | ❌ W0 | ⬜ pending |
| 47-TBD | TBD | TBD | BUILD-01 (determinism) | — | Re-export is a reviewable diff, not full-tree churn | unit (walk-and-diff, modeled on `resources-sync.test.ts`) | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| 47-TBD | TBD | TBD | BUILD-02 | — | `!binary` target is a bare filename; no host path reaches generated source | integration (real ACME spawn) | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |
| 47-TBD | TBD | TBD | BUILD-03 | — | An unresolved cross-reference refuses by name rather than falling back to raw hex | unit + integration | `cd src/mcp/vice && node --test anno-export-asm.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases in `src/mcp/vice/anno-export-asm.test.ts` (or a new sibling test file) covering scope partitioning, `external_file` / `!binary` emission, cross-file symbol resolution, and the determinism drift guard
- [ ] New test cases in `src/mcp/vice/host-tool.test.ts` for the `cwd` parameter's plumbing through the `acme.build` spawn path
- [ ] No new test framework or fixture-generation tool — `buildStore()` / `buildStoreOverImage()` (`anno-export-asm.test.ts:214` / `:243`) already exist and are the idiom to extend

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real ACME assembles the emitted tree | BUILD-01 | Requires the ACME cross-assembler installed on the host; the project never auto-installs external tools, so a machine without ACME must skip rather than fail | Install ACME per `README.md`, then run `cd src/mcp/vice && node --test anno-export-asm.test.ts` and confirm the ACME-spawning cases run rather than skip |
| `.rep` listing shows the two-byte zero-page encoding | BUILD-03 | Reading an ACME report listing is an observation of assembler output, gateable in-test but worth one human read on first landing | Export a tree with a zero-page symbol, assemble with ACME's report flag, confirm the two-byte form for a known zero-page reference and the three-byte form when the sourcing order is deliberately broken |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
