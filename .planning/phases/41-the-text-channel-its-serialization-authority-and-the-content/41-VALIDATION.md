---
phase: "41"
slug: "the-text-channel-its-serialization-authority-and-the-content"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-08"
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `41-RESEARCH.md` § *Validation Architecture*. The Per-Task
> Verification Map is filled once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`), no separate library — `src/mcp/vice/package.json:121-123` |
| **Config file** | none — colocated `*.test.ts` files next to the module under test |
| **Quick run command** | `cd src/mcp/vice && npm run test:automated` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` (the same command — see the note below) |
| **Estimated runtime** | ~60-120 seconds |

**Why the full-suite command is not `node --test '*.test.*'`:** the whole-glob run
does not terminate unaided in this repo, and `npm run test:automated` (which drives
`test-gate.mjs`) is the only run that ends. `test:automated` deliberately excludes the
twelve `MANUAL_ONLY_TESTS` files, so a green `test:automated` is not a green whole
suite — the excluded live tests are run by hand per D-08/D-12 discipline.

**Baseline is 2 failing tests, not 0.** `anno-register.test.ts` carries a documented
2-failure floor. Assert the floor is *unchanged*; never assert zero failures.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && npm run test:automated`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated` plus `npm run typecheck`
- **Before `/gsd-verify-work`:** `test:automated` green with the 2-failure `anno-register.test.ts`
  baseline unchanged; live tests run manually (broker stopped) and their result recorded in
  `src/skills/vice-wedge-triage/SKILL.md`'s provenance table
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

Task IDs do not exist until PLAN.md files are written. The requirement-level map below
is the seed; `/gsd-validate-phase` expands it per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CHAN-02 | — | Port is surfaced only to the lease holder | unit | `cd src/mcp/vice && node --test broker-control.test.ts vice-broker-client.test.ts` | ✅ both exist — extend | ⬜ pending |
| TBD | TBD | TBD | CHAN-03 | — | Framing never truncates or merges a response | unit | `cd src/mcp/vice && node --test text-protocol.test.ts` | ❌ W0 — new file | ⬜ pending |
| TBD | TBD | TBD | CHAN-03 | — | Split-segment + prompt-shaped-output controls against real VICE | live (manual) | added to `MANUAL_ONLY_TESTS` | ❌ W0 — new file | ⬜ pending |
| TBD | TBD | TBD | CHAN-04 | — | FIFO ordering, timeout, holder record | unit | `cd src/mcp/vice && node --test channel-lock.test.ts` | ❌ W0 — new file | ⬜ pending |
| TBD | TBD | TBD | CHAN-04 | — | Identical checkpoint-state visibility from both channels | live (manual) | added to `MANUAL_ONLY_TESTS` | ❌ W0 — new file | ⬜ pending |
| TBD | TBD | TBD | CHAN-05 | — | Contention evidence present; `wedged` unreachable while contended | unit | `cd src/mcp/vice && node --test stock-diagnose.test.ts` | ✅ exists (55 tests) — extend | ⬜ pending |
| TBD | TBD | TBD | CHAN-05 | — | Contention signature reproduced on genuine stock VICE | live (manual) | added to `MANUAL_ONLY_TESTS` | ❌ W0 — new file | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/text-protocol.test.ts` — framing state machine: split-segment prompt,
      banner drain, prompt-shaped-output collision, all as planted controls (CHAN-03)
- [ ] `src/mcp/vice/text-connect.test.ts` — claim / connect / release lifecycle (CHAN-02)
- [ ] `src/mcp/vice/channel-lock.test.ts` — FIFO ordering, timeout expiry, release-on-throw,
      holder-record contents (CHAN-04, D-08)
- [ ] One new live test file (name at the planner's discretion) covering CHAN-03's two planted
      controls against real VICE, CHAN-04's identical-checkpoint-state-visibility assertion, and
      CHAN-05's contention signature. It must be added to `MANUAL_ONLY_TESTS` **and** to
      `test-gate.test.ts`'s count assertion **in the same commit** — D-08's two-directional gate.
      `test-gate.test.ts` pins twelve entries today; the count moves with the addition.
- [ ] Extensions (not new files) to the existing per-module test files this phase edits, for
      D-14 / D-15 / D-16's wire-shape changes. Confirm each name via `ls src/mcp/vice/*.test.ts`
      before assuming it: `stock-diagnose.test.ts`, `stock-connect.test.ts`,
      `stock-dispatch.test.ts`, `broker-control.test.ts`, `vice-broker-client.test.ts`,
      `broker-launch.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prompt framing against real VICE (split segment, prompt-shaped output, banner drain) | CHAN-03 | Needs a live `x64sc` with `-remotemonitor` bound; TCP segmentation is not reproducible in-process | Stop the broker first (a live broker reddens BACK-05 and voids captures). Run the live test file directly with `node --test <file>`. Record the result. |
| Identical checkpoint-state visibility from both channels | CHAN-04 | Requires both monitor channels connected to one real instance simultaneously | Stop the broker. Launch `x64sc` with `-default` preceding `-binarymonitor` and `-remotemonitor` (flag order is load-bearing — `-default` must come first or the monitor never binds). Assert the same checkpoint state from each channel. |
| Contention signature (two cycle brackets reading zero while a text hold is live) | CHAN-05 | The signature only exists against a real emulator under a real two-channel hold | Stop the broker. Reproduce live on genuine stock `x64sc` (`/usr/bin/x64sc` is unpatched stock; the fork shadows it on `$PATH`). Record the observation and its confidence in `src/skills/vice-wedge-triage/SKILL.md`'s provenance table. |
| `default_memspace` remedy (`device c:` over the text channel) | CHAN-05 (SC 5) | Contaminating `default_memspace` needs a real drive checkpoint hit | Stop the broker. Contaminate via a drive checkpoint, confirm main-CPU stepping is broken, issue `device c:` (the colon is required — `device c` is a syntax error), confirm stepping is restored. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
