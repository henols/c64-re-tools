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
| 60-01-T1 | 01 | 1 | LOC-01, LOC-02, LOC-03 | T-60-01, T-60-05 | A `tools.json` value never reaches a shell string; argv-array spawn only; no seam call inside the `inFlight` guard | integration | `node --test --test-reporter=tap vice-broker-acquire.test.ts backend-detect.test.ts broker-launch.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-01-T2 | 01 | 1 | LOC-02 | T-60-04 | Reporting fields consume the once-resolved value, never a second read | unit | `node --test --test-reporter=tap vice-broker-acquire.test.ts vice-proxy.test.ts broker-control.test.ts` | ✅ | ⬜ pending |
| 60-01-T3 | 01 | 1 | LOC-03 | — | N/A | regression | `node build.ts` then `node --test --test-reporter=tap resources-sync.test.ts` | ✅ | ⬜ pending |
| 60-02-T1 | 02 | 1 | DECL-03 | T-60-06 | Remedy prose is returned, never executed; the seam imports no child-process API | unit | `node --test --test-reporter=tap tool-location.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-02-T2 | 02 | 1 | DECL-03 | T-60-06, T-60-07 | A structured-argv remedy field is reported by a named validator | structural | `node --test --test-reporter=tap prerequisites.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-03-T1 | 03 | 2 | LOC-01, DECL-03 | T-60-08 | Pre-spawn existence check refuses by name and installs nothing | integration | `node --test --test-reporter=tap host-tool.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-03-T2 | 03 | 2 | LOC-01, LOC-03, DECL-03 | T-60-02, T-60-03 | Tool-id lookup by array membership; no new path normalisation at a callsite | unit | `node --test --test-reporter=tap host-tool.test.ts dxa-seam.test.ts acme-verify.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-03-T3 | 03 | 2 | LOC-03 | — | N/A | regression | `node build.ts` then `node --test --test-reporter=tap resources-sync.test.ts` | ✅ | ⬜ pending |
| 60-04-T1 | 04 | 3 | LOC-04, DECL-03 | T-60-09 | The `$PATH`-shadowing warning survives; a file hit is never warned about | unit | `node --test --test-reporter=tap host-tool.test.ts` | ✅ (new cases) | ⬜ pending |
| 60-04-T2 | 04 | 3 | LOC-02 | T-60-10 | No comment asserts a guard that is not on disk | structural | `node --test --test-reporter=tap host-tool.test.ts host-tool-transport.test.ts acme-verify.test.ts` | ✅ | ⬜ pending |
| 60-04-T3 | 04 | 3 | LOC-03 | — | N/A | regression | `node build.ts` then `node --test --test-reporter=tap resources-sync.test.ts` | ✅ | ⬜ pending |
| 60-05-T1 | 05 | 4 | LOC-02 | T-60-11 | A vacuous scan cannot report a clean tree — three planted shapes plus a module-list floor | structural | `node --test --test-reporter=tap tool-location-consumers.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 60-05-T2 | 05 | 4 | LOC-03 | T-60-12, T-60-13 | Full glob, no live broker, exit status read directly, SET comparison not totals | regression | `npm test` in both trees, failing SETs compared with `comm` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*`❌ W0` marks the one file this phase creates: `src/mcp/vice/tool-location-consumers.test.ts`,
delivered by 60-05-T1. Every other row runs against a file that already exists, with cases
added by the task itself.*

---

## Wave 0 Requirements

- [ ] A structural **closed-consumer-set** test for the four env-var names
      (`VICE_BIN`, `ACME_BIN`, `ACME`, `GHIDRA_HOME`), mirroring the
      `hostpath-consumers.test.ts` idiom — covers `LOC-02`.
      **Assigned to 60-05-T1** as `src/mcp/vice/tool-location-consumers.test.ts`.
      It lands in wave 4 rather than wave 0 because it asserts the POST-rewiring
      state: authored earlier it would sit red in the committed suite for three
      waves. Each rewiring plan carries its own narrower source scan in its
      task verify blocks so nothing is unguarded in the meantime.
- [ ] New `host-tool.test.ts` cases for `c1541` / `petcat` resolving via a scratch
      `tools.json`, and still resolving as siblings when the file says nothing —
      covers `LOC-04`. **Assigned to 60-04-T1** (seven behavioural cases).
- [ ] New `host-tool.test.ts` / `prerequisites.test.ts` cases proving a refusal
      message **tracks a mutated declaration string** (mutate the remedy text in a
      scratch copy, confirm the live refusal changes to match) — covers `DECL-03`
      and supplies the non-vacuity proof `ENGINEERING_RULES.md` §6 requires of a
      refusal test. **Assigned to 60-02-T1** (the reader itself), **60-03-T1 and
      60-03-T2** (`acme`, `ghidra`, `dxa` refusals) and **60-04-T1** (`c1541`,
      `petcat` refusals).
- [ ] A pre-and-post-rewiring full-suite **baseline SET diff** — a verification
      procedure, not a new test file — covers `LOC-03`. **Assigned to 60-05-T2**,
      against the tree at commit `884e68c8` (the last commit touching
      `src/mcp/vice/` before this phase began).

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
