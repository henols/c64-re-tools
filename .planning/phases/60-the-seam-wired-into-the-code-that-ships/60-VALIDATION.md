---
phase: "60"
slug: "the-seam-wired-into-the-code-that-ships"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-18"
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `60-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework (`src/mcp/vice/package.json:132-133`) |
| **Config file** | none — colocated `*.test.ts` / `*.test.mts` beside the module under test |
| **Quick run command** | `cd src/mcp/vice && node --test --test-reporter=tap <touched>.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm test` (`node --test '*.test.*'`) |
| **Estimated runtime** | ~180 seconds for the full glob; targeted runs are seconds |

**Two standing facts bind every command above.**

1. **`npm run test:automated` is not the gate.** It skips `MANUAL_ONLY_TESTS` and
   therefore cannot support any `LOC-03` "nothing changed" claim. Only the full
   `npm test` glob counts for that claim.
2. **A live `vice-broker` process deterministically reddens the suite.** Stop the
   broker before trusting any `npm test` result; a red run with a broker up is not
   evidence of a regression.

Piping the suite hides its exit code (`| tail` reports tail's `0`). Redirect to a
file and read `$?` on the same line.

---

## Sampling Rate

- **After every task commit:** the targeted `node --test <touched-file>.test.ts` for whatever was just edited.
- **After every plan wave:** full `npm test`, with no live broker process running.
- **Before `/gsd-verify-work`:** full `npm test` green, **plus** `node build.ts` run and
  `resources-sync.test.ts` green against **regenerated and committed** `resources/*.mjs`
  for every `HOST_BOUND_ARTIFACTS` entry this phase actually touched
  (at minimum `resources/backend-detect.mjs`, `resources/host-tool.mjs`).
- **Max feedback latency:** ~30 seconds for a targeted run; ~180 seconds for the full gate.

---

## Per-Task Verification Map

Filled by the planner as tasks are authored; each row must name a real
`<automated>` command from the corresponding PLAN.md task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 60-01-01 | 01 | 1 | LOC-02 | — | N/A | structural | `node --test --test-reporter=tap <env-var-consumers>.test.ts` | ❌ W0 | ⬜ pending |
| 60-01-02 | 01 | 1 | LOC-01 | T-60-01 | A `tools.json` value never reaches a shell string; argv-array spawn only | integration | `node --test --test-reporter=tap broker-launch.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-02-01 | 02 | 2 | LOC-04 | T-60-02 | Tool-id lookup by array membership, never bracket access | unit | `node --test --test-reporter=tap host-tool.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-02-02 | 02 | 2 | DECL-03 | — | Refusal text tracks the declaration, not a re-authored literal | unit | `node --test --test-reporter=tap host-tool.test.ts prerequisites.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-03-01 | 03 | 3 | LOC-03 | — | N/A | regression | `npm test` full glob, pass/fail SET diffed against the pre-change baseline | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs above are placeholders seeded from the research's requirement→test map;
the planner replaces them with the real plan/task numbering.*

---

## Wave 0 Requirements

- [ ] A structural **closed-consumer-set** test for the four env-var names
      (`VICE_BIN`, `ACME_BIN`, `ACME`, `GHIDRA_HOME`), mirroring the
      `hostpath-consumers.test.ts` idiom — covers `LOC-02`.
- [ ] New `host-tool.test.ts` cases for `c1541` / `petcat` resolving via a scratch
      `tools.json`, and still resolving as siblings when the file says nothing —
      covers `LOC-04`.
- [ ] New `host-tool.test.ts` / `prerequisites.test.ts` cases proving a refusal
      message **tracks a mutated declaration string** (mutate the remedy text in a
      scratch copy, confirm the live refusal changes to match) — covers `DECL-03`
      and supplies the non-vacuity proof `ENGINEERING_RULES.md` §6 requires of a
      refusal test.
- [ ] A pre-and-post-rewiring full-suite **baseline SET diff** — a verification
      procedure, not a new test file — covers `LOC-03`.

Every structural scan in the above must use `grep -a`:
`src/mcp/vice/anno-memmap-render.ts` and `src/mcp/vice/prerequisites.test.ts`
contain NUL bytes and plain `grep` skips them without warning.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real `x64sc` recorded in `tools.json` is the binary the broker actually spawns | LOC-01 | Needs a genuine stock VICE on the host and a real broker launch; the automated integration test asserts the resolved path is threaded through, not that the process started | Record `/usr/bin/x64sc` in `.c64-re-tools/tools.json`, start the broker as its systemd unit, confirm via `vice_ping` / process args that the spawned binary is the recorded path, then stop the broker |
| A missing ACME surfaces the declaration's remedy rather than a raw `ENOENT` | DECL-03 | Requires removing/renaming a real ACME install on the host | Temporarily point `ACME_BIN` at a nonexistent path, invoke the acme-build route, confirm the refusal names the tool and carries the declaration's remedy text verbatim |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] Full `npm test` run with **no live broker**, exit code read directly (not through a pipe)
- [ ] `resources/*.mjs` regenerated **and committed**; `resources-sync.test.ts` green
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
