---
phase: "64"
slug: "files-as-bytes-both-directions"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `64-RESEARCH.md` § Validation Architecture. Task-level
> rows are filled once `64-*-PLAN.md` exists; `/gsd-validate-phase` closes the file out.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner — `node --test` (`src/mcp/vice/package.json`, `"test": "node --test '*.test.*'"`). No separate framework to install. |
| **Config file** | none — convention is a colocated `*.test.ts` / `*.test.mts` beside the module under test |
| **Quick run command** | `cd src/mcp/vice && node --test --test-reporter=tap <file>.test.ts` |
| **Full suite command** | `npm --prefix src/mcp/vice test` |
| **Estimated runtime** | ~90 seconds (full suite, measured green at the v1.0.0 close) |

**Suite-command caveat (binding, from project memory):** `npm run test:automated` skips
twelve `MANUAL_ONLY_TESTS` and therefore hides CI failures — the phase gate below uses the
full-glob `npm test`, not `test:automated`. Never pipe the suite through `tail`/`head`: the
pipe reports the pager's exit code and fakes a green baseline. Redirect to a file and read
`$?` on the same line.

---

## Sampling Rate

- **After every task commit:** the specific new/changed `*.test.ts` file(s) for that task
- **After every plan wave:** `npm --prefix src/mcp/vice test` (full suite)
- **Before `/gsd-verify-work`:** full suite green **and** `npm --prefix src/mcp/vice run typecheck` clean
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs are assigned when `64-*-PLAN.md` lands. The planner MUST translate every row below
into at least one per-task row with a runnable `<automated>` command and its `<fails_when>`
sibling. Threat refs are the phase's own, from `64-RESEARCH.md` § Security Domain.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | XFER-01 | — | Produced bytes arrive over the socket; client writes under its own `.c64-re-tools/<kind>/`; result names only the local path | integration | `node --test <transfer-download>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-02 | Information Disclosure (D-14, accepted) | Consumed file read client-side from the caller's path and streamed to the broker | integration | `node --test <transfer-upload>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-03 | Tampering / EoP — path traversal | A broker-supplied destination name escaping the per-kind directory is **refused, not sanitised**: `../../etc/passwd`, `/etc/passwd`, `C:\`, NUL-embedded | unit (pure function, **no I/O**) | `node --test <transfer-paths>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-04 | EoP — handle guessing | Broker chooses its own staging path; client refers to it only by a `randomBytes`-derived opaque handle | unit + integration | `node --test broker-control.test.ts` (extend) + new staging test | ⚠️ partial — extend, don't replace | ⬜ pending |
| TBD | TBD | TBD | XFER-05 | — | Bytes survive byte-for-byte, including non-UTF-8, over a real loopback socket with a real multi-megabyte buffer | integration | `node --test <transfer-integrity>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-06 | DoS — declared-length lie | Cap enforced **independently at the receiver** from bytes actually observed; refusal message names the limit; backpressure proven with a receiver that deliberately stops reading | unit (cap) + integration (flow control) | `node --test <transfer-cap>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-06 | Tampering — partial file at final name | Temp-write then `renameSync`, only after length **and** digest verify | integration | `node --test <transfer-atomic>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-07 | — | Session-scoped staging removed on connection close; age-based sweep removes crash/vanish residue | integration | new test over the close path + a broker-restart sweep test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | XFER-08 | — | All four tools complete against disjoint client/broker roots; no broker-side path in any tool result or wire field | integration (disjoint temp dirs) | `node --test stock-machine.test.ts` (extend) or new phase-level integration test | ⚠️ unconfirmed — see Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Streaming hash+count `Transform` module + unit tests (cap enforcement, digest correctness) — **no existing file to extend**; a repo-wide grep for `Transform`/`createReadStream` outside tests returned zero hits
- [ ] Pure-function path-containment validator + fixture-string tests (D-13 / XFER-03) — **no existing file to extend**
- [ ] Transfer-dial function and its tests, mirroring `broker-endpoint.test.ts`'s existing structure for `dialMonitorRelay()`
- [ ] New `ControlRequestKind` arm + dispatch tests in `broker-control.mts` / `broker-control.test.ts`, mirroring the existing `attach` arm's coverage
- [ ] **Confirm whether `stock-machine.test.ts` exists and what it covers** before planning XFER-08's disjoint-roots proof — the research pass did not open that file
- [ ] **Read `broker-kill.mts`** before planning D-08's sweep-trigger task — the research pass did not open it

**Scratch-fixture rule (binding):** every fixture directory is a fresh `mkdtempSync` per test,
never a fixed path inside the repository tree. The suite already has three sites that race on
repo-tree scratch files, one of which leaks a gitignored directory and then fails
deterministically until it is deleted by hand. Do not add a fourth. `/tmp` on this host is a
16 GB tmpfs with aging disabled — clean up what you create.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The four tools driving a real emulator end to end over a relayed session | XFER-08 | Needs a live stock VICE host process; the automated disjoint-roots proof covers the path/wire assertions but not real `x64sc` behaviour | Start the broker as its systemd unit, run each of `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save`, `vice_snapshot_load` against the absolute `/usr/bin/x64sc` (3.9), confirm no broker-side path appears in any result, then stop the unit |
| A staged disk image's lost writes being reported to the caller | XFER-07 (D-16, accepted loss) | The loss is a stock-imposed behaviour, not a code branch — what is testable is the wording of the result, which a human reads | Attach a disk, let the program write to it, close the session, confirm the tool result stated the write would not persist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` sibling naming an observable failure signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
