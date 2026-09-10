---
phase: "45"
slug: "decomposition-to-closure-disagreement-first"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-10"
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `45-RESEARCH.md` § Validation Architecture.
> The Per-Task Verification Map is filled by `/gsd-validate-phase` once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json`'s `node --test '*.test.*'` script |
| **Quick run command** | `node --test <the .test.ts/.test.mjs files this task touched>` (scope to touched files) |
| **Full suite command** | `cd src/mcp/vice && npm test` — **has a known pre-existing failure floor and can outlive a bash timeout** |
| **Estimated runtime** | ~5–60 seconds scoped; full suite is minutes and may hang |

**Two standing project measurement rules apply to every command in this phase and must not be
re-derived by an executor:**

1. The whole-glob `npm test` blocks indefinitely on `vice-proxy.test.ts`. Use `npm run test:automated`
   or a scoped `node --test` for a plan's own pass/fail evidence.
2. `npm run test:automated` skips twelve MANUAL_ONLY_TESTS and has a **non-zero stable failure floor**
   (3 as of 2026-09-09: anno-register / anno-import), plus named flakes outside those files.
   **Compare the failure set, never the count** — a green run is "the same named failures as the
   measured baseline", not "0 failed".
3. A **live broker reddens `BACK-05`** deterministically. Stop the broker before trusting any suite
   result taken in this phase.

---

## Sampling Rate

- **After every task commit:** the scoped `node --test` command for the file(s) that task touched.
- **After every plan wave:** `node --test src/mcp/vice/anno-*.test.ts src/mcp/vice/evid-*.test.ts src/skills/routine-queue-walker/scripts/*.test.mjs`
- **Before `/gsd-verify-work`:** `npm run test:automated` compared **as a failure set** against the
  measured baseline, with the broker stopped.
- **Max feedback latency:** 60 seconds for the scoped per-task command.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(pending — filled by `/gsd-validate-phase` after plans are written)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test intent (from RESEARCH.md, pre-plan)

| Req ID | Behavior | Test Type | Intended Automated Command | File Exists? |
|--------|----------|-----------|----------------------------|-------------|
| DECOMP-01 | Completeness report renders zero `Undefined`; **refuses to render** without the disagreement input; soundness asymmetry preserved in output | unit + **planted control observed RED** | `node --test src/skills/routine-queue-walker/scripts/completeness-report.test.mjs` | ❌ Wave 0 |
| DECOMP-02 | No auto-name survivor; every code entry point comment states function / inputs / outputs / side effects | unit (survivor regex) + per-entry-point presence check | same new test file | ❌ Wave 0 |
| DECOMP-03 | Every referenced non-hardware address named **or** carrying an explicit recorded decline | unit (decline persisted at the known path-dependent address in `bank-path-dependent.prg`) | same new test file | ❌ Wave 0 |
| DECOMP-04 | `$D011`/`$D018` render as OR-ed named constants + decoded comment, and **reassemble byte-identically** under real ACME | integration, real-ACME byte-diff oracle | `node --test src/mcp/vice/anno-export-asm.test.ts` (extended) | ✅ extend |
| D-07 guard | `REAL_VERBS` / verb-count floor raised in the same change as the fifth verb | unit | `node --test src/mcp/vice/anno-verb-coverage.test.ts` | ✅ edit |
| D-02 round trip | Store export → import reproduces the store exactly | unit, round-trip | `node --test src/mcp/vice/anno-store-export.test.ts` | ❌ Wave 0 |

---

## Wave 0 Requirements

- [ ] `src/skills/routine-queue-walker/scripts/` — directory does not exist; must be created
- [ ] `completeness-report.mjs` + `completeness-report.test.mjs` — the D-04 script and its test, net new
- [ ] `anno-store-export.ts` + `anno-store-export.test.ts` — the D-02 general JSON export/import module and its round-trip test
- [ ] **An empirical label-population measurement before the survivor regex is fixed**: derive ONE
      fixture (smallest: `dxa/tracer.prg`) through the existing dxa + Ghidra route into a fresh
      per-fixture `.annostore`, then read back the actual label population. RESEARCH.md Assumption A1
      records that **zero `.annostore` files exist in the repo today**, so the eleven-prefix
      `AUTO_NAME_PREFIX_RE`, dxa's `lNNNN` and Ghidra's `FUN_XXXX` are all candidate shapes and none
      is yet confirmed against a real store. Do not freeze the regex before this runs.
- [ ] **Measure the suite failure baseline** (broker stopped) so per-task results are compared against
      a real floor rather than an assumed zero.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Purpose-comment *content* (that it truly states function, inputs, outputs, side effects — not merely that a non-empty comment exists) | DECOMP-02 | Semantic quality is not mechanically checkable; presence and non-emptiness are | Per code entry point, read the stored comment and confirm all four elements are named. Checkable **per entry point**, not as an aggregate count (criterion 3's own wording). |
| A live execution run per D-13's executed subset | DECOMP-01 / DECOMP-02 | Requires a real emulator under Phase 33's reproducible-run protocol | Run each executed fixture, ingest `memmapshow`, cash its disagreements. `export-asm/smc.prg` **never halts** (infinite loop) and needs an explicit checkpoint bound. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Failure-set comparison (not count) used wherever the shared suite is run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
