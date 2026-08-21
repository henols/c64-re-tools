---
phase: 13
slug: external-verification
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase 13 --research` from `13-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no third-party framework, no mocking library |
| **Config file** | none — `.claude/mcp/vice/package.json` `scripts.test` is `node --test '*.test.*'` |
| **Quick run command** | `cd .claude/mcp/vice && node --test binmon-fixtures.test.ts stock-protocol.test.ts backend-detect.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`; excludes the manual-only live-emulator suites) |
| **Estimated runtime** | ~10 seconds quick, ~60 seconds full (offline; no emulator) |

**CI note:** CI runs the broader bare `npm test` glob, not `test:automated`
(`.github/workflows/ci.yml:115-122`). A new offline test file is picked up
automatically by both as long as it matches `*.test.*` and is NOT added to
`test-gate.mjs`'s `MANUAL_ONLY_TESTS` array.

---

## Sampling Rate

- **After every task commit:** Run `node --test binmon-fixtures.test.ts stock-protocol.test.ts backend-detect.test.ts`
- **After every plan wave:** Run `npm run test:automated`
- **Before `/gsd-verify-work`:** `npm test` (CI's actual command) must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are seeded at requirement
granularity and refined to per-task rows during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | EXTV-01 | — | Sidecar `capturedFrom` names the real binary it was captured from; `synthetic: false` only when bytes are real | unit (fixture-driven) | `node --test binmon-fixtures.test.ts` | ✅ existing, edits required | ⬜ pending |
| TBD | TBD | 1 | EXTV-01 | — | Re-recorded frames decompose and correlate under the real request-id sequence, not the synthetic one | unit (fixture-driven) | `node --test stock-protocol.test.ts` | ✅ existing, edits required | ⬜ pending |
| TBD | TBD | 1 | EXTV-02 | — | `classifyHelpOutput()` classifies real stock and real fork transcripts correctly; real-hardware fixtures stay separate from ASSUMED ones | unit (fixture-driven) | `node --test backend-detect.test.ts` | ✅ existing file; ❌ W0 new real-hardware fixtures | ⬜ pending |
| TBD | TBD | 1 | EXTV-03 | — | A corrected encoder still rejects out-of-range input via `StockEncodingError` before writing bytes | manual/script (live emulator) per D-13-07 | `node probe-binmon.mjs` (extended) | script only — no committed test needs an emulator | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.claude/mcp/vice/fixtures/backend-detect/` (recommended location) — real-hardware
      `--help` transcript files + sidecar for EXTV-02, per D-13-03. Must be labelled
      `capturedFrom: "real hardware"` and kept separate from the existing ASSUMED
      fixtures in `backend-detect.test.ts`.
- [ ] No framework or config gap — `node:test` is already wired and
      `automatedTestFiles()` auto-discovers new `*.test.ts` files.

---

## Manual-Only Verifications

Per **D-13-07**, everything that needs a reachable emulator stays in
`probe-binmon.mjs` (a script) and is deliberately NOT a committed test. Only the
offline, fixture-driven assertions enter the automated gate.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three binmon frames captured from a real binary | EXTV-01 | Needs a launched `x64sc` with a bound binary monitor | `cd .claude/mcp/vice && node probe-binmon.mjs --capture display-get,event-interleaved,checkpoint-list` — `-default` must precede `-binarymonitor` or the monitor never binds |
| `--help` transcripts from both real binaries | EXTV-02 | Needs both real builds present on the host | Run `--help` against stock and fork `x64sc` by path (the one sub-item where D-13-01's first-in-PATH rule does not apply) and commit both transcripts verbatim |
| A1 `-remotemonitoraddress` port actually binds | EXTV-03 | Needs a launched emulator plus `ss` to observe the listening socket | Launch with the stock branch's flags, confirm the port is listening via `ss` |
| A2 step-over runtime semantic | EXTV-03 | Behavioural claim — a wire-level "accepted" does not confirm it (Pitfall 6) | Step over a real `JSR` and observe where the PC lands |
| A3 joystick bit mapping | EXTV-03 | Behavioural claim — needs observable input state after `JOYPORT_SET` | Set each bit individually and read back the observable effect |
| A5 autostart `fileIndex` | EXTV-03 | Needs a real autostart of a multi-file image | Autostart with a non-zero `fileIndex` and confirm which file ran |
| A4 `stop:false` rate limiter under a real `CHECKPOINT_INFO` flood | — | **OUT OF SCOPE (D-13-05)** — arming a `stop:false` checkpoint on a hot address can stall the emulator thread; stays open in its own todo | not run this phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the real-hardware `backend-detect` fixtures)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
