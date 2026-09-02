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
> The per-task map below is requirement-scoped until plans exist; the executor
> fills Task ID / Plan / Wave columns as each plan lands.

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

- **After every task commit:** `cd src/mcp/vice && npm run typecheck` plus `node --test` on the touched file(s)
- **After every plan wave:** `cd src/mcp/vice && npm run test:automated`, compared against the measured 5-failure baseline
- **Phase gate (before `/gsd-verify-work`):** `test:automated` at or below the baseline, **plus** `node build.ts` clean with `resources/*.mjs` committed
- **Max feedback latency:** ~90 seconds
- **Precondition on every emulator-touching run:** stop the VICE broker first — a live broker reddens the `BACK-05` assertion deterministically, so a run measured against a live broker reads a false baseline

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | REPRO-01 | — | Stock argv carries the determinism block after `-default`; fork argv byte-identical; `-default` at index 0; `-console` at index 1 when headless | unit | `cd src/mcp/vice && node --test broker-launch.test.ts` | ✅ (5 stock whole-argv assertions to update, 3 ordering assertions to extend) | ⬜ pending |
| TBD | TBD | TBD | REPRO-01 | — | Divergence without the block; zero differing addresses with it | transcript (D-07) | — corpus-free, live emulator | ❌ W0 — evidence script under the phase dir | ⬜ pending |
| TBD | TBD | TBD | REPRO-02 | — | `reproducible` / `frame_anchor` accepted; unknown names still refused; the procedure is reached from exactly one call site | unit | `cd src/mcp/vice && node --test stock-reproducible-run.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REPRO-02 | — | Jitter 0 / 1500 / 4000 ms stop identically; reset-removed control observed red | transcript | — | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REPRO-03 | — | Oracle compares exactly `(PC, hit_count, (LIN, CYC))`; refuses on a non-main memspace | unit | `cd src/mcp/vice && node --test stock-reproducible-run.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REPRO-03 | — | `(LIN, CYC)` alone **passes** one frame apart; memspace assertion refuses after a drive hit | transcript | — | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REPRO-04 | — | Capture record carries the three Identity rows; argv digest is sha256 over NUL-joined argv | unit | `cd src/mcp/vice && node --test capture-predicate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | REPRO-05 | — | `profile` absent → byte-identical argv; `profile.warp` appends `-warp`; `profile.headless` puts `-console` at index 1; warm eligibility rejects a mismatched instance | unit | `cd src/mcp/vice && node --test broker-launch.test.ts broker-control.test.ts` | ✅ / ❌ W0 (new cases) | ⬜ pending |
| TBD | TBD | TBD | CAP-01 | — | Module walk finds `C64MEM` from offset 58; refuses a malformed header rather than resyncing; refuses a body below 65543; walk ends at file length | unit | `cd src/mcp/vice && node --test vsf-slice.test.ts` | ❌ W0 (needs `fixtures/vsf/`) | ⬜ pending |
| TBD | TBD | TBD | CAP-02 | — | Predicate fails on a byte planted outside the allow-list, including a **one-bit** plant (D-25, corpus-free) | unit | `cd src/mcp/vice && node --test capture-predicate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAP-02 | — | An allow-list over the committed cap voids the derivation; port normalisation uses `dir_read` / `data_read` | unit | `cd src/mcp/vice && node --test capture-predicate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAP-03 | — | Predicate module never imports the oracle module; oracle's compare takes no image buffer (`grep -a`-safe census) | unit | `cd src/mcp/vice && node --test capture-seam.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CAP-04 | — | Real release captured twice; pair satisfies CAP-02; wall-clock-anchoring control observed red | transcript (corpus-bound) | — | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GATE-01 | — | Verdict frontmatter parses; `verdict` ∈ `{go, degrade, no-go}`; all five inputs present; rules committed before any measurement | manual-only / doc | git-order proof via `git log` (D-01) | ❌ W0 | ⬜ pending |

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
