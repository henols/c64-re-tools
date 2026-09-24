---
phase: "64"
slug: "files-as-bytes-both-directions"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-23"
audited: "2026-09-24"
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

Task IDs are assigned when `64-*-PLAN.md` lands. Rows 64-08 to 64-16 are gap-closure plans, added at the 2026-09-24 audit; their Threat Ref column is `—` because each closes a named gap (G-64-1, G-64-3 to G-64-6), not a RESEARCH threat. The planner MUST translate every row below
into at least one per-task row with a runnable `<automated>` command and its `<fails_when>`
sibling. Threat refs are the phase's own, from `64-RESEARCH.md` § Security Domain.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 64-01-T1 | 64-01 | 1 | XFER-02, XFER-05 | T-64-04, T-64-06 | One JSON header line then exactly N raw bytes cross a real socket; nothing past the header is string-decoded; `pipeline()` owns backpressure | integration (tracer, real loopback socket) | `node --test --test-reporter=tap transfer-hash.test.mts broker-transfer.test.mts resources-sync.test.ts` | ✅ created | ✅ green |
| 64-01-T2 | 64-01 | 1 | XFER-06 | T-64-01, T-64-02 | Cap enforced at BOTH ends, independently at the receiver from observed bytes; mid-stream abort unwinds the temp file; refusal names 16777216 | unit (cap) + integration (flow control) | `node --test --test-reporter=tap transfer-hash.test.mts broker-transfer.test.mts` | ✅ from T1 | ✅ green |
| 64-01-T3 | 64-01 | 1 | XFER-03 | T-64-03 | `../../etc/passwd`, `/etc/passwd`, `C:\`, NUL-embedded, empty, `.` and `..` all REFUSED, not sanitised | unit (pure function, **no I/O**) | `node --test --test-reporter=tap transfer-paths.test.ts stock-paths.test.ts stock-machine.test.ts stock-dispatch.test.ts` | ✅ created | ✅ green |
| 64-02-T1 | 64-02 | 2 | XFER-04 | T-64-07, T-64-08, T-64-09 | `stage_file` gated by `ownsTarget()`; `transfer` authorised by the minted handle alone | unit (real listener, ephemeral port) | `node --test --test-reporter=tap broker-control.test.ts resources-sync.test.ts` | ✅ extended | ✅ green |
| 64-02-T2 | 64-02 | 2 | XFER-01, XFER-02 | T-64-10 | Two-candidate hello race, byte-level reply read, payload bytes in the same TCP segment carried out as a raw Buffer | unit (real listener) | `node --test --test-reporter=tap broker-endpoint.test.ts` | ✅ extended | ✅ green |
| 64-02-T3 | 64-02 | 2 | XFER-04 | T-64-07 | `stageFile()` rides the existing control session; a missing handle is a protocol failure, never fabricated | unit | `node --test --test-reporter=tap vice-broker-client.test.ts broker-endpoint.test.ts broker-control.test.ts` | ✅ extended | ✅ green |
| 64-03-T1 | 64-03 | 3 | XFER-04, XFER-07 | T-64-12, T-64-13, T-64-14 | Broker chooses the staging path; `randomBytes` handle; slot supersession deletes the previous file; session dir removed in one recursive delete | unit (fresh `mkdtempSync` broker root) | `node --test --test-reporter=tap broker-transfer.test.mts broker-home.test.ts` | ✅ from 64-01 | ✅ green |
| 64-03-T2 | 64-03 | 3 | XFER-04, XFER-07 | T-64-16, T-64-17 | Upload published only after length+digest verify; second transfer on an in-flight handle refused; staging gone at session close | integration (real listener + real files) | `node --test --test-reporter=tap vice-broker-staging.test.ts resources-sync.test.ts` | ✅ created | ✅ green |
| 64-03-T3 | 64-03 | 3 | (wave gate) | — | Full-glob suite failing SET unchanged from baseline; typecheck clean; no leaked scratch | suite gate | `npm --prefix src/mcp/vice test` | ✅ | ✅ green |
| 64-04-T1 | 64-04 | 4 | XFER-01 | T-64-18, T-64-19, T-64-20 | Produced bytes arrive over the socket; client writes under its own `.c64-re-tools/snapshots/`; result names only the local path and the handle | unit (DI stub session) | `node --test --test-reporter=tap stock-machine.test.ts stock-paths.test.ts transfer-paths.test.ts` | ✅ extended | ✅ green |
| 64-04-T2 | 64-04 | 4 | XFER-02 | T-64-18 | Consumed file read client-side from the caller's name and streamed to the broker; missing `.vsf` refuses before any dial | unit | `node --test --test-reporter=tap stock-machine.test.ts` | ✅ extended | ✅ green |
| 64-04-T3 | 64-04 | 4 | XFER-05 | — | Bytes survive byte-for-byte through the full handler path, over a real listener and disjoint roots | integration | `node --test --test-reporter=tap stock-machine.test.ts vice-broker-staging.test.ts` | ✅ | ✅ green |
| 64-05-T1 | 64-05 | 4 | XFER-07 | T-64-24 | Per-launch emulator config scratch lands under the machine-level broker root, with a pid record beside it | unit (fresh broker root) | `node --test --test-reporter=tap broker-launch.test.ts broker-home.test.ts resources-sync.test.ts` | ✅ extended | ✅ green |
| 64-05-T2 | 64-05 | 4 | XFER-07 | T-64-22, T-64-23 | Live-pid-guarded config reap; unconditional staging sweep; zero-case logging; one bad entry never aborts a pass | unit (injected liveness/removal) | `node --test --test-reporter=tap broker-kill.test.ts resources-sync.test.ts` | ✅ extended | ✅ green |
| 64-05-T3 | 64-05 | 4 | XFER-07 | T-64-25 | Both sweeps run at startup, before the bind; no repeating timer anywhere | integration | `node --test --test-reporter=tap vice-broker-staging.test.ts broker-kill.test.ts resources-sync.test.ts` | ✅ | ✅ green |
| 64-06-T1 | 64-06 | 5 | XFER-02, XFER-08 | T-64-26 | `path` stays unrestricted (D-14, accepted); an absolute path outside the project root is uploaded | unit | `node --test --test-reporter=tap stock-machine.test.ts` | ✅ extended | ✅ green |
| 64-06-T2 | 64-06 | 5 | XFER-08 | T-64-27, T-64-29 | Disk write-loss stated in its own exported constant; distinct staging slots per tool | unit (pinning test off the constant) | `node --test --test-reporter=tap stock-machine.test.ts` | ✅ extended | ✅ green |
| 64-06-T3 | 64-06 | 5 | XFER-08 | — | Zero `stock-paths.ts` imports and zero translation calls in `stock-machine.ts`; out-of-scope surfaces untouched | source assertion + suite gate | `npm --prefix src/mcp/vice test` | ✅ | ✅ green |
| 64-07-T1 | 64-07 | 6 | XFER-08, XFER-05 | T-64-31, T-64-32 | All four tools complete against disjoint roots; every result key walked recursively for a broker path; staging empty after close | integration (disjoint temp dirs) | `node --test --test-reporter=tap transfer-disjoint-roots.test.ts vice-broker-staging.test.ts stock-machine.test.ts` | ✅ created | ✅ green |
| 64-07-T2 | 64-07 | 6 | XFER-01 | T-64-33, T-64-34 | Convergence metric measured and recorded with its command and named importers; `docs/` untouched | evidence + source measurement | `git ls-files` presence check plus the recorded importer grep | ✅ created | ✅ green |
| 64-07-T3 | 64-07 | 6 | XFER-08 | — | Declared boundaries confirmed by a check, not assumed; the four known-failing result-chunking tests not retired | evidence + suite gate | `npm --prefix src/mcp/vice test` | ✅ | ✅ green |
| 64-08-T1 | 64-08 | 1 | XFER-04, XFER-08 (G-64-1) | — | vice_ping through the real proxy reaches a handle-authenticated relay attach end to end | tracer (real proxy) | `node --test --test-name-pattern="G-64-1 tracer" vice-proxy.test.ts` + `broker-endpoint/broker-control/broker-relay/resources-sync` + typecheck | ✅ | ✅ green |
| 64-08-T2 | 64-08 | 1 | XFER-04, XFER-08 (G-64-1) | — | `transfer` joins `attach` ahead of the gate, proven at the wire and through the real proxy in both directions | integration | `node --test broker-control.test.ts vice-proxy.test.ts transfer-disjoint-roots.test.ts vice-broker-staging.test.ts resources-sync.test.ts` | ✅ | ✅ green |
| 64-08-T3 | 64-08 | 1 | XFER-04, XFER-08 (G-64-1) | — | Text channel through the real proxy; T-63-01 reversal on record | integration + evidence | `node --test --test-name-pattern="G-64-1" vice-proxy.test.ts` + `evidence/64-g641-handle-only-authority.md` keys | ✅ | ✅ green |
| 64-09-T1 | 64-09 | 2 | XFER-04, XFER-08 (G-64-1) | — | Production dials stop declaring, reading or sending a credential | tracer (unit, real listeners) | `node --test broker-endpoint stock-connect text-connect text-tools stock-dispatch stock-machine broker-relay broker-relay-text` (.test.ts) + typecheck | ✅ | ✅ green |
| 64-09-T2 | 64-09 | 2 | XFER-04, XFER-08 (G-64-1) | — | Every caller follows and the wire itself is pinned | unit + suite gate | `node --test broker-endpoint broker-relay broker-relay-text stock-machine transfer-disjoint-roots vice-proxy` (.test.ts) + `npm test` | ✅ | ✅ green |
| 64-10-T1 | 64-10 | 2 | XFER-08 (G-64-1) | — | One real broker per documented route writes broker.json exactly where the client looks | tracer (spawned real broker) | `node --test vice-broker-launch repo-root resources-sync vice-broker-client broker-home` (.test.ts) + typecheck | ✅ | ✅ green |
| 64-10-T2 | 64-10 | 2 | XFER-08 (G-64-1) | — | The suite stays out of the real home; the npm tarball ships every module it imports | unit + pack check | `node --test vice-proxy.test.ts resources-sync.test.ts broker-home.test.ts` + `npm pack` import-closure check | ✅ | ✅ green |
| 64-10-T3 | 64-10 | 2 | XFER-08 (G-64-1) | — | State-directory decision on record, stale instruction corrected | evidence | `evidence/64-g641-state-dir-agreement.md` keys present | ✅ | ✅ green |
| 64-11-T1 | 64-11 | 3 | XFER-01, XFER-02, XFER-08 (G-64-1) | — | Clean host, live subjects, systemd-unit broker the unconfigured client finds | live (manual-only) | `evidence/64-g641-live-driver.mjs` (`node --check`) + unit/journal checks | ✅ | ✅ green |
| 64-11-T2 | 64-11 | 3 | XFER-01, XFER-02, XFER-08 (G-64-1) | — | Four tools, text channel and write-loss cycle, scripted then through a real Claude Code session | live (manual-only) | `evidence/64-g641-live-check.md` | ✅ | ✅ green |
| 64-11-T3 | 64-11 | 3 | XFER-01, XFER-02, XFER-08 (G-64-1) | — | Teardown leaves nothing; full suite clean; live record written | live + suite gate | teardown checks + `npm test` + evidence keys | ✅ | ✅ green |
| 64-12-T1 | 64-12 | 1 | XFER-08 (G-64-4) | — | A binary attach sent before the emulator binds waits for the bind; the first PING is answered | tracer (unit) | `node --test broker-relay broker-control vice-broker-launch resources-sync` (.test.ts) + build + typecheck | ✅ | ✅ green |
| 64-12-T2 | 64-12 | 1 | XFER-08 (G-64-4) | — | The never-connecting dial, the abandoned dial and the emulator that speaks first each get a named outcome | unit | `node --test broker-relay.test.ts resources-sync.test.ts` | ✅ | ✅ green |
| 64-12-T3 | 64-12 | 1 | XFER-08 (G-64-4) | — | Client waits longer than the broker; text channel covered; handshake-failure text tells the truth | unit + suite gate | `node --test broker-relay broker-relay-text stock-handler broker-endpoint text-connect stock-connect` (.test.ts) + `npm test` | ✅ | ✅ green |
| 64-13-T1 | 64-13 | 2 | XFER-02, XFER-06, XFER-08 (G-64-3) | — | The production upload resolves only after the broker's publish, even when the publish lands late | tracer (unit) | `node --test stock-connect.test.ts broker-transfer.test.mts vice-proxy.test.ts resources-sync.test.ts` + typecheck | ✅ | ✅ green |
| 64-13-T2 | 64-13 | 2 | XFER-02, XFER-06, XFER-08 (G-64-3) | — | No upload consumer or stub absorbs the publish race | unit + source assertion | `node --test stock-machine transfer-disjoint-roots vice-broker-staging broker-endpoint` (.test.ts) + `ACCEPTED RISK`/stub-poll counts = 0 | ✅ | ✅ green |
| 64-13-T3 | 64-13 | 2 | XFER-02, XFER-06, XFER-08 (G-64-3) | — | 0x8f names what VICE could not do with a file-carrying command's file | unit + suite gate | `node --test stock-handler.test.ts stock-machine.test.ts stock-dispatch.test.ts` + `npm test` | ✅ | ✅ green |
| 64-14-T1 | 64-14 | 3 | XFER-02, XFER-08 (G-64-3, G-64-4) | — | Cold sessions' first call works on a systemd-unit broker | live (manual-only) | `evidence/64-g643-g644-live-run.mjs` (`node --check`) + journal checks | ✅ | ✅ green |
| 64-14-T2 | 64-14 | 3 | XFER-02, XFER-08 (G-64-3, G-64-4) | — | Recycle's first attach and the save → load → attach loop with zero 0x8f | live (manual-only) | `evidence/64-g643-g644-live-check.md` | ✅ | ✅ green |
| 64-14-T3 | 64-14 | 3 | XFER-02, XFER-08 (G-64-3, G-64-4) | — | Teardown leaves nothing; full suite clean; live record written | live + suite gate | teardown checks + `npm test` + evidence keys | ✅ | ✅ green |
| 64-15-T1 | 64-15 | 1 | XFER-06, XFER-08 (G-64-5) | — | A real rename failure reaches the tool result with the errno code and no broker-side path | tracer (unit, real fs failure) | `node --test broker-transfer.test.mts stock-machine vice-broker-staging stock-connect transfer-disjoint-roots resources-sync` + source counts | ✅ | ✅ green |
| 64-15-T2 | 64-15 | 1 | XFER-06, XFER-08 (G-64-5) | — | Receive-pipeline and pre-publish branches go path-free; cap refusal still names the limit; raw wire line pinned | unit + source assertion + suite gate | `node --test broker-transfer.test.mts transfer-hash.test.mts vice-broker-staging stock-machine stock-connect transfer-disjoint-roots broker-endpoint vice-proxy resources-sync` + `npm run test:automated` | ✅ | ✅ green |
| 64-16-T1 | 64-16 | 1 | XFER-07 (G-64-6) | — | A losing second broker leaves a live broker's staging in place; the winning broker still sweeps crash residue | tracer (spawned real brokers) | `node --test broker-control broker-kill vice-broker-staging resources-sync` (.test.ts) + single-sweep-call-site check | ✅ | ✅ green |
| 64-16-T2 | 64-16 | 1 | XFER-07 (G-64-6) | — | Sweep contract states its bind-winner precondition; crash-sweep guard proven non-vacuous by mutation | unit + mutation check + suite gate | `node --test broker-kill vice-broker-staging broker-control resources-sync` (.test.ts) + delete-sweep-call mutation REDs + `npm run test:automated` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Streaming hash+count `Transform` module + unit tests — **owned by 64-01 task 1** (`transfer-hash.mts` / `transfer-hash.test.mts`), cap enforcement and digest correctness in 64-01 task 2
- [x] Pure-function path-containment validator + fixture-string tests (D-13 / XFER-03) — **owned by 64-01 task 3** (`transfer-paths.ts` / `transfer-paths.test.ts`)
- [x] Transfer-dial function and its tests — **owned by 64-02 task 2** (`dialFileTransfer()` in `broker-endpoint.ts`, extending `broker-endpoint.test.ts`'s existing `dialMonitorRelay()` structure)
- [x] New `ControlRequestKind` arms + dispatch tests — **owned by 64-02 task 1** (`stage_file` and `transfer`, extending `broker-control.test.ts`'s existing `attach` coverage)
- [x] **`stock-machine.test.ts` confirmed to exist** (about 16.7 KB, covers all four migrating handlers with a DI stub session) — resolved during pattern mapping; 64-04 and 64-06 EXTEND it rather than replacing it, and 64-06 task 3 drops its now-dangling container stub
- [x] **`broker-kill.mts` read** — `reapOrphanedInstances()` and `verifiedKill()` are the concrete analogs for both D-08's live-pid-guarded reap and XFER-07's startup staging sweep; 64-05 tasks 2 and 3 own them

**Scratch-fixture rule (binding):** every fixture directory is a fresh `mkdtempSync` per test,
never a fixed path inside the repository tree. The suite already has three sites that race on
repo-tree scratch files, one of which leaks a gitignored directory and then fails
deterministically until it is deleted by hand. Do not add a fourth. `/tmp` on this host is a
16 GB tmpfs with aging disabled — clean up what you create.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The four tools driving a real emulator end to end over a relayed session | XFER-08 | Needs a live stock VICE host process; the automated disjoint-roots proof covers the path/wire assertions but not real `x64sc` behaviour | Start the broker as its systemd unit, run each of `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save`, `vice_snapshot_load` against the absolute `/usr/bin/x64sc` (3.9), confirm no broker-side path appears in any result, then stop the unit. **Performed by plan 64-11: `evidence/64-g641-live-check.md`.** |
| A staged disk image's lost writes being reported to the caller | XFER-07 (D-16, accepted loss) | The loss is a stock-imposed behaviour, not a code branch — what is testable is the wording of the result, which a human reads | Attach a disk, let the program write to it, close the session, confirm the tool result stated the write would not persist |
| A cold session's first call and the save → load → attach loop through a real Claude Code session, zero 0x8f | XFER-02, XFER-08 (G-64-3, G-64-4) | Needs a live broker plus a real MCP session; the relay-attach timing and the publish race only show against real `x64sc` | Start the broker as its systemd unit with `VICE_BIN=/usr/bin/x64sc`, make the session's first call `vice_ping`, run `vice_snapshot_save`/`vice_snapshot_load`/`vice_disk_attach` several times, stop the unit, confirm no process or 19510/66xx listener remains. **Performed 2026-09-24: 12/12 calls clean, recorded in `64-UAT.md` test 1.** Scripted precursor: `evidence/64-g643-g644-live-check.md` (135/135). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Every runnable `<automated>` command has a `<fails_when>` sibling naming an observable failure signal
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-24 (`/gsd-validate-phase 64`, run as the verify:post step of `/gsd-verify-work 64`)

---

## Validation Audit 2026-09-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Seven of the 16 plans (64-01 to 64-07) already had map rows. The audit added 24 task rows for gap-closure plans 64-08 to 64-16. Every automated
task's test files ran green in one full-glob run: `npm --prefix src/mcp/vice test` read 4452 tests, 4368 pass, 0 fail,
84 skipped, exit 0. `npm run typecheck` exited 0. No broker was running. None of the 84 skips is a phase-64 test: all 27
`G-64` test cases ran and passed, and the skips are opt-in live suites such as `ghidra-opcode-live`. Six live tasks (64-11 T1–T3,
64-14 T1–T3) are manual-only by nature. Their evidence files exist, and the owner's in-session re-run passed (`64-UAT.md` test 1).
