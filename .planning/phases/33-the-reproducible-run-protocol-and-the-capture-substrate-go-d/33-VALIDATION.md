---
phase: "33"
slug: "the-reproducible-run-protocol-and-the-capture-substrate-go-d"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-02"
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `33-RESEARCH.md` § Validation Architecture.
> **Task ID / Plan / Wave are bound** (2026-09-02) — all twelve plans exist, so
> every requirement row below names the plan and task that satisfies it and the
> wave it lands in. The executor now only advances the `Status` column.
> `status: draft` and `wave_0_complete: false` stay as seeded: `validated` is set
> by `validate-phase` §6, not by planning.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no third-party framework |
| **Config file** | `src/mcp/vice/test-gate.mjs` — single source of truth for `MANUAL_ONLY_TESTS` and `automatedTestFiles()` |
| **Quick run command** | `cd src/mcp/vice && node --test <file>.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Typecheck** | `cd src/mcp/vice && npm run typecheck` |
| **Estimated runtime** | ~90 seconds for `test:automated` |

**Never `npm test`.** The whole-glob run does not terminate unaided (it blocks
forever on `vice-proxy.test.ts`). Only `npm run test:automated` is a usable
suite command.

**Measured baseline is 5 failures in 3 files, not 0.** `33-RESEARCH.md` § P8
measured `EXIT=1` with five failing tests from two root causes Phase 33 did not
create: four v0.7.0 requirement ids dropped by the v0.8.0 REQUIREMENTS rewrite,
and two completed todos still listed `Pending` in `STATE.md`. Every acceptance
criterion in this phase compares against **that baseline**, never against zero.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && npm run typecheck` plus `node --test` on the touched file(s). This is the per-task gate, and it is the ONLY suite-shaped command any plan's `<verify>` block carries — measured in seconds, well inside the advisory latency threshold
- **After every plan wave:** `cd src/mcp/vice && npm run test:automated` (~90 s), run ONCE per wave rather than once per task, compared against the recorded baseline. The baseline at phase open is **5 failing tests in 3 files** (`docs-deferred-ledger.test.ts` x2, the `audit-integrity.test.ts` cascade, and `anno-register.test.ts` x2). `33-02` repairs three of them, so from wave 1 onward the comparison figure is **2 failing tests in `anno-register.test.ts` alone**. A non-zero exit is **never** the failure signal — the signals are a count above the current figure, or a file name outside the recorded set
- **The one exception:** `33-02` runs the suite at task scope, because there the suite result *is* the deliverable rather than a regression check — Task 2 exists to move the number from 5-in-3 to 2-in-1, and every later wave gate compares against the figure that plan produces
- **Phase gate (before `/gsd-verify-work`):** `test:automated` at or below the then-current recorded figure, **plus** `node build.ts` clean with `resources/*.mjs` committed
- **Max feedback latency:** seconds per task (targeted `node --test`); ~90 seconds per wave (full suite)
- **Precondition on every emulator-touching run:** stop the VICE broker first — a live broker reddens the `BACK-05` assertion deterministically, so a run measured against a live broker reads a false baseline

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| `33-05` T1+T2 | `33-05` | 2 | REPRO-01 | — | Stock argv carries the determinism block after `-default`; fork argv byte-identical; `-default` at index 0; `-console` at index 1 when headless | unit | `cd src/mcp/vice && node --test broker-launch.test.ts` | ✅ (5 stock whole-argv assertions to update, 3 ordering assertions to extend) | ⬜ pending |
| `33-11` T1 | `33-11` | 6 | REPRO-01 | — | Divergence without the block; zero differing addresses with it | transcript (D-07) | — live emulator, corpus-free: `evidence/determinism-probe.mjs` → grep gates over `evidence/33-repro01-determinism.md` | ❌ W0 — evidence script under the phase dir | ⬜ pending |
| `33-09` T1+T2 | `33-09` | 4 | REPRO-02 | — | `reproducible` / `frame_anchor` accepted; unknown names still refused; the procedure is reached from exactly one call site | unit | `cd src/mcp/vice && node --test stock-reproducible-run.test.ts` | ❌ W0 | ⬜ pending |
| `33-11` T2 | `33-11` | 6 | REPRO-02 | — | Jitter 0 / 1500 / 4000 ms stop identically; reset-removed control observed red | transcript | — live emulator: `evidence/reset-removed-probe.mjs` → grep gates over `evidence/33-repro02-reset-removed.md` | ❌ W0 | ⬜ pending |
| `33-07` T1 (compare) + `33-09` T2 (memspace refusal) | `33-07`, `33-09` | 3, 4 | REPRO-03 | — | Oracle compares exactly `(PC, hit_count, (LIN, CYC))`; refuses on a non-main memspace | unit | `cd src/mcp/vice && node --test capture-predicate.test.ts stock-reproducible-run.test.ts` | ❌ W0 — `stop-oracle.ts` is created by `33-07` T1 and consumed by `33-09` | ⬜ pending |
| `33-11` T2 (frame anchor) + `33-10` T3 (drive hit) | `33-11`, `33-10` | 6, 5 | REPRO-03 | — | `(LIN, CYC)` alone **passes** one frame apart; memspace assertion refuses after a drive hit | transcript | — live emulator: `evidence/frame-anchor-probe.mjs` → `evidence/33-repro03-frame-anchor.md`; drive-hit refusal → `evidence/33-memspace-refusal.md` | ❌ W0 | ⬜ pending |
| `33-08` T2 | `33-08` | 4 | REPRO-04 | — | Capture record carries the three Identity rows; argv digest is sha256 over NUL-joined argv | unit | `node --test 'src/skills/c64-ram-capture/scripts/*.test.mjs'` plus the template grep gate on `binary sha256` / `argv digest` | ❌ W0 | ⬜ pending |
| `33-05` T2 (argv) + `33-06` T1+T2 (eligibility) | `33-05`, `33-06` | 2, 3 | REPRO-05 | — | `profile` absent → byte-identical argv; `profile.warp` appends `-warp`; `profile.headless` puts `-console` at index 1; warm eligibility rejects a mismatched instance | unit | `cd src/mcp/vice && node --test broker-launch.test.ts broker-control.test.ts broker-state.test.ts vice-broker-acquire.test.ts` | ✅ / ❌ W0 (new cases) | ⬜ pending |
| `33-04` T1+T2 | `33-04` | 2 | CAP-01 | — | Module walk finds `C64MEM` from offset 58; refuses a malformed header rather than resyncing; refuses a body below 65543; walk ends at file length | unit | `cd src/mcp/vice && node --test vsf-slice.test.ts` | ❌ W0 (needs `fixtures/vsf/`) | ⬜ pending |
| `33-07` T2 | `33-07` | 3 | CAP-02 | — | Predicate fails on a byte planted outside the allow-list, including a **one-bit** plant (D-25, corpus-free) | unit | `cd src/mcp/vice && node --test capture-predicate.test.ts` | ❌ W0 | ⬜ pending |
| `33-07` T1 (normalisation) + `33-08` T1 (cap void) | `33-07`, `33-08` | 3, 4 | CAP-02 | — | An allow-list over the committed cap voids the derivation; port normalisation uses `dir_read` / `data_read` | unit | `cd src/mcp/vice && node --test capture-predicate.test.ts` and `node --test 'src/skills/c64-ram-capture/scripts/derive-transients.test.mjs'` (65 addresses void it) | ❌ W0 | ⬜ pending |
| `33-07` T3 | `33-07` | 3 | CAP-03 | — | Predicate module never imports the oracle module; oracle's compare takes no image buffer (`grep -a`-safe census) | unit | `cd src/mcp/vice && node --test capture-seam.test.ts` | ❌ W0 | ⬜ pending |
| `33-10` T1 (pair) + `33-03` T2 (wall-clock control) | `33-10`, `33-03` | 5, 2 | CAP-04 | — | Real release captured twice; pair satisfies CAP-02; wall-clock-anchoring control observed red | transcript (corpus-bound) | — live emulator + corpus: `evidence/capture-pair.mjs` → `evidence/33-capture-pair.md`; control → `evidence/33-wallclock-control.md` | ❌ W0 | ⬜ pending |
| `33-01` T2 (rules + order proof) + `33-12` T1 (verdict) | `33-01`, `33-12` | 1, 7 | GATE-01 | — | Verdict frontmatter parses; `verdict` ∈ `{go, degrade, no-go}`; all five inputs present; rules committed before any measurement | manual-only / doc | `git rev-list --count` order proof that the rules commit precedes every measurement commit (D-01), plus a frontmatter parse of `docs/phase33-reproducible-run-gate-findings.md` | ❌ W0 | ⬜ pending |
| `33-02` T1+T2 | `33-02` | 1 | CAP-01, CAP-02 | T-33-14, T-33-15, T-33-16 | Each falsified decision text carries a dated rider beside its measured counter-value and the superseded sentence stays greppable; the Deferred Items table matches the pending-todo tree in both directions | doc-guard + unit | `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts audit-integrity.test.ts`, plus the `RECONCILED_OK` / `ORIGINALS_INTACT` grep gates over `33-CONTEXT.md` and the `LEDGER_ROWS_OK` + `git diff --numstat` gate over `STATE.md`; this is also the one plan that runs `npm run test:automated` at task scope, because the 5-in-3 → 2-in-1 move **is** its deliverable | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/vsf-slice.test.ts` — stubs for CAP-01
- [ ] `src/mcp/vice/fixtures/vsf/` — synthetic `.vsf` fixtures: one well-formed, one with a malformed module header, one with a short `C64MEM` body, one at snapshot minor 0 (body 65543)
- [ ] `src/mcp/vice/capture-predicate.test.ts` — stubs for CAP-02 (D-25) and REPRO-04
- [ ] `src/mcp/vice/capture-seam.test.ts` — stubs for CAP-03 (D-26)
- [ ] `src/mcp/vice/stock-reproducible-run.test.ts` — stubs for the unit-testable parts of REPRO-02 / REPRO-03
- [ ] New cases in `src/mcp/vice/broker-launch.test.ts` and `src/mcp/vice/broker-control.test.ts` — REPRO-01 / REPRO-05
- [ ] Evidence scripts under `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/` for the five transcripts (D-07, D-10)
- [ ] Framework install: **none needed** — Node's built-in runner is already the harness

**D-08 compliance.** Every file above is corpus-free and terminates, so
`MANUAL_ONLY_TESTS` stays at exactly nine and the nine-file `assert.deepEqual`
in `test-gate.test.ts` is untouched. That is D-08's stated default expectation,
and this test map is designed to hold it. A live frame-exact suite that is
*not* corpus-free must be added to `MANUAL_ONLY_TESTS` in the same commit that
introduces it, or it runs inside `test:automated` and fails on any machine
without the corpus.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Divergence-then-zero over an untouched window | REPRO-01 | Needs a live emulator; the observation is the artifact, recorded as a committed transcript | Run the phase's evidence script twice without the determinism block (expect differing addresses, red), then twice with it (expect zero differing addresses) |
| Jitter-immunity and the reset-removed control | REPRO-02 | Live emulator; the control's red is the proof the reset step is load-bearing | Run the protocol at jitter 0 / 1500 / 4000 ms (expect byte-identical), then run the committed reset-removed control (expect differing stop phases, red) |
| `(LIN, CYC)`-alone passing one frame apart; memspace refusal after a drive hit | REPRO-03 | Live emulator plus true drive emulation; both are observations, not assertions | Stop twice exactly one frame apart and run the frame-anchor-free comparison (expect PASS, proving the anchor necessary); hit a drive checkpoint, then run the main-CPU memspace assertion (expect refusal) |
| Real release captured twice; wall-clock control red | CAP-04 | Corpus-bound — needs the gitignored `.d64` images | Autostart the release, reach the frame-exact stop twice, compare under CAP-02's predicate; separately run the wall-clock-anchored bracket (expect spurious timeout / differing `LIN`, red) |
| Rules committed before any measurement exists | GATE-01 | Provable only from git history order, not from file content | `git log` proof that the verdict-rules commit precedes every measurement commit it scores (D-01) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] Every suite acceptance criterion states the baseline as **5 failures in 3 files**, never 0
- [ ] `MANUAL_ONLY_TESTS` still exactly nine files, or a corpus-bound addition justified in the same commit
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
