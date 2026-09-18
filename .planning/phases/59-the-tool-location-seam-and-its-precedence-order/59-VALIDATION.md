---
phase: "59"
slug: "the-tool-location-seam-and-its-precedence-order"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-18"
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `59-RESEARCH.md` § Validation Architecture.
> The Per-Task Verification Map is filled once `59-*-PLAN.md` exists.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate test library |
| **Config file** | none — `src/mcp/vice/package.json`'s `test` script is `node --test '*.test.*'` |
| **Quick run command** | `cd src/mcp/vice && node --test <seam>.test.ts prerequisites.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run typecheck && npm test` |
| **Estimated runtime** | ~5s quick · full suite minutes (3800+ tests) |

**Suite hazards that bind this phase's commands:**
- Piping `npm test` into `tail`/`head` reports the pipe's exit code, not the suite's. Redirect to a file and read `$?` on the same line.
- A live `vice-broker` reddens the BACK-05 test deterministically. Assert no broker is running before trusting any suite result.
- `node --test` exits 0 for a filename that does not exist. Verify the file is present before treating a green run as coverage.
- `prerequisites.test.ts` contains a real NUL byte — any content census against it must use `grep -a`.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && node --test <seam>.test.ts prerequisites.test.ts`
- **After every plan wave:** `cd src/mcp/vice && npm run typecheck && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, measured with the exit code read directly (no pipe)
- **Max feedback latency:** ~10 seconds for the per-task command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *pending* | *pending* | *pending* | `LOC-05` | — | A `dxa` key in `tools.json` is refused by name, quoting the vendored-and-built reason | unit | `cd src/mcp/vice && node --test <seam>.test.ts` | ❌ W0 | ⬜ pending |
| *pending* | *pending* | *pending* | `LOC-06` | — | A `tools.json` path that is absent, not executable, or the wrong `kind` is refused by name, and the refusal states the file supplied it | unit | `cd src/mcp/vice && node --test <seam>.test.ts` | ❌ W0 | ⬜ pending |
| *pending* | *pending* | *pending* | `LOC-07` | — | A `node` key in `tools.json` is refused, quoting the `VICE_BROKER_NODE`/bash-reads-it-first reason | unit | `cd src/mcp/vice && node --test <seam>.test.ts` | ❌ W0 | ⬜ pending |
| *pending* | *pending* | *pending* | Success Criterion 1 (structural) | — | The new host-bound module is compiled into `resources/` byte-identically by `build.ts` | unit (existing gate) | `cd src/mcp/vice && node --test resources-sync.test.ts` | ✅ exists | ⬜ pending |
| *pending* | *pending* | *pending* | D-05 / D-07 (structural) | — | New `prerequisites.json` location fields are well-formed | unit (existing gate, extended) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs, plan numbers and waves are filled from `59-*-PLAN.md` once planning completes.*

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/<seam>.mts` and its colocated `<seam>.test.ts` — entirely new; no existing file covers this seam's behaviour
- [ ] `prerequisites.test.ts` extension — the file exists but does not yet validate the `location` / `kind` / `marker` fields this phase adds
- [ ] Planted-violation control per refusal test (`ENGINEERING_RULES.md` §6) — a malformed entry, a `dxa` key, a `node` key and a wrong-`kind` entry, each observed failing before the fix and passing after, matching `prerequisites.test.ts`'s existing "real document and planted violation run the same code" idiom

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| *(none identified)* | — | — | — |

*All phase behaviors identified in `59-RESEARCH.md` have automated verification. This seam is pure host-side path resolution with no emulator interaction, so nothing here needs a live VICE run.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for the per-task command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
