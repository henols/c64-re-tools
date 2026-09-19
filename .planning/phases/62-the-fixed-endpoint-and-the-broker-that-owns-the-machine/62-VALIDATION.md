---
phase: "62"
slug: "the-fixed-endpoint-and-the-broker-that-owns-the-machine"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-19"
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no third-party runner (`src/mcp/vice/package.json:132-134`) |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-suite *selector*, not a framework config |
| **Quick run command** | `node --test <edited>.test.ts` from `src/mcp/vice/` |
| **Full suite command** | `npm --prefix src/mcp/vice test` (`node --test '*.test.*'` — runs everything, including the 12 `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~180 seconds full glob; a single file is seconds |

**Gate-composition fact this phase turns on.** `npm run test:automated` runs
`automatedTestFiles()`, which excludes the frozen 12-member `MANUAL_ONLY_TESTS`
array (`src/mcp/vice/test-gate.mjs:141-155`). **`broker-e2e.test.ts` and
`vice-broker-launch.test.ts` — the two files D-12 says this phase reddens — are
both on that list.** CI's automated gate structurally cannot see either
assertion. Every task touching them must run `node --test` on the file by name,
or the full `npm test`; `test:automated` alone is not evidence for this phase.

**Two suite traps that fake a green reading.** `node --test` silently skips a
missing or mistyped filename and still exits 0 — `ls` the file before trusting a
run. Piping `npm test` reports the *pipe's* exit code — redirect to a file and
read `$?` on the same line.

---

## Sampling Rate

- **After every task commit:** `node --test <the file(s) that task edited>` — by name, never `test:automated` as a stand-in when the edited file is manual-only.
- **After every plan wave:** `npm --prefix src/mcp/vice test` (full glob), plus `npm --prefix src/mcp/vice run typecheck`.
- **Before `/gsd-verify-work`:** full `npm test` green — not `test:automated`, for the reason stated above.
- **Max feedback latency:** ~180 seconds (full glob); seconds for a single file.

**Port discipline, mandatory for every test this phase writes.** Phase 62 makes
port 19510 a persistent machine-wide fixture, so a live broker is now the
*expected* state rather than an accident. Every test that binds or dials a
control port allocates dynamically (`VICE_BROKER_CONTROL_PORT: "0"`, the shape
`broker-e2e.test.ts` already uses) or refuses by name when an unexpected
listener answers. No test may assume 19510 is free.

**Scratch discipline.** This suite has a recorded history of races on scratch
files written into the repo tree. Write scratch under `mkdtemp` in the OS temp
dir and reap it in a `try/finally`; never into the repo. Note `/tmp` on this
host is a tmpfs whose aging is disabled — leaked scratch is leaked RAM.

---

## Per-Task Verification Map

*Filled by plan-phase, 2026-09-19. One row per task across the five plans.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 62-01-T1 (tracer) | 62-01 | 1 | ENDPOINT-01, ENDPOINT-03 | T-62-01, T-62-02, T-62-05 | Handshake answered ahead of the token gate; reply key set frozen to four fields; the eight existing ops still refuse without a token | integration (end to end) | `node --test broker-endpoint.test.ts broker-control.test.ts resources-sync.test.ts` | ❌ W0 — task creates `broker-endpoint.test.ts` | ⬜ pending |
| 62-01-T2 | 62-01 | 1 | ENDPOINT-01, ENDPOINT-02 | T-62-03, T-62-04 | Per-candidate timeouts; never-throw parse of an unknown listener's bytes; no leaked socket or timer | unit + integration | `node --test broker-endpoint.test.ts` | ✅ after T1 | ⬜ pending |
| 62-01-T3 | 62-01 | 1 | ENDPOINT-04, ENDPOINT-05 | T-62-01 | Four ranked refusals; version skew names both packages and both versions; rootless line gated on a dial observation and carrying its provenance | unit | `node --test broker-endpoint.test.ts` + start-command single-definition count | ✅ after T1 | ⬜ pending |
| 62-02-T1 | 62-02 | 1 | BROKER-06 | T-62-07, T-62-08, T-62-09 | Broker-owned paths absolutised and outside every project root; idempotent recursive creation | unit | `node --test broker-home.test.ts resources-sync.test.ts build-atomic.test.ts` | ❌ W0 — task creates `broker-home.test.ts` | ⬜ pending |
| 62-02-T2 | 62-02 | 1 | BROKER-03 (guidance only; D-11) | T-62-10 | Three client-side comment sites stop teaching the reversed bind rule; the wildcard-bind classifier's own guard is proven intact | structural (grep gate) | negative + positive greps on the three files, then `npm run test:automated` | ✅ (files exist) | ⬜ pending |
| 62-03-T1 | 62-03 | 2 | BROKER-03 | T-62-11, T-62-12 | Bind set from the live interface list through an injectable seam; name allowlist excludes the machine's own local-network interfaces; one shared acquire queue | unit | `node --test broker-control.test.ts resources-sync.test.ts` | ✅ (file exists, new cases) | ⬜ pending |
| 62-03-T2 | 62-03 | 2 | BROKER-03, BROKER-04 | T-62-13, T-62-14, T-62-15, T-62-16 | Explicit wildcard request refused by name; loopback bind failure fatal, bridge failure not; bound set printed for audit | integration (manual-only files — run by name) | `node --test vice-broker-launch.test.ts broker-e2e.test.ts` | ✅ (files exist, assertions updated) | ⬜ pending |
| 62-04-T1 | 62-04 | 3 | BROKER-02 (start command), BROKER-06 | T-62-17, T-62-18, T-62-20, T-62-SC | Floor refusal runs before any import; argument rewrite limited to the subcommand token; dispatch is exact string equality | unit + child-process | `node --test vice-cli.test.ts` + manifest retarget check | ❌ W0 — task creates `vice-cli.test.ts` | ⬜ pending |
| 62-04-T2 | 62-04 | 3 | BROKER-01, BROKER-06 | T-62-19 | One broker's state inside neither of two project roots; three pre-existing precedence steps unchanged | integration (manual-only file — run by name) | `node --test broker-e2e.test.ts vice-broker-launch.test.ts` | ✅ (file exists, new cases) | ⬜ pending |
| 62-05-T1 | 62-05 | 4 | BROKER-05, BROKER-02 | T-62-22, T-62-23, T-62-24, T-62-26 | User-scoped definitions only; no module invokes a service manager; no production module spawns the broker; gate proven to bite on a planted violation | structural (tree scan) | `node --test service-no-invoke.test.ts` | ❌ W0 — task creates `service-no-invoke.test.ts` | ⬜ pending |
| 62-05-T2 | 62-05 | 4 | BROKER-05 | T-62-25, T-62-27 | One start-command spelling everywhere; no hand edit inside a generated region | structural (generator idempotence + grep) | `npm --prefix src/mcp/vice run generate:readme` then `git diff --quiet -- README.md` | ✅ (file exists) | ⬜ pending |

**Sampling continuity check.** No three consecutive tasks lack an automated verify —
every one of the eleven rows carries one. Four rows depend on a Wave 0 file the same
task creates as its first act; each of those tasks' verify command opens with an
explicit `test -f` presence guard, because `node --test` silently skips a missing or
mistyped filename and still exits 0.

### Requirement → evidence map (from `62-RESEARCH.md` § Validation Architecture)

| Req ID | Behaviour that must be proven | Test type | File |
|--------|-------------------------------|-----------|------|
| ENDPOINT-01 | Both candidates dialled; first *completed* handshake wins; nothing read from disk | unit/integration | new cases, client dial module |
| ENDPOINT-02 | Per-candidate independent timeout — a stub that accepts and never replies on candidate 1 does not prevent candidate 2 | integration | same file |
| ENDPOINT-03 | `hello` separates genuine broker / foreign listener / stale pre-v2.0.0 broker | unit | `broker-control.test.ts` + client classification cases |
| ENDPOINT-04 | The no-broker refusal contains the start command verbatim | unit | assert against the single exported constant |
| ENDPOINT-05 | Skew refusal names *which side* to update — both package names and both versions | unit | stubbed `hello` reply, mismatched major |
| BROKER-01 | One broker serves two unrelated project roots at once | integration | `broker-e2e.test.ts` (manual-only — run by name) |
| BROKER-02 | No client module ever spawns the broker | structural | extend the existing route-gate pattern |
| BROKER-03 | Bind set enumerated from the live interface list; loopback + allowlisted bridges only; never `0.0.0.0` | unit + integration | injectable `os.networkInterfaces()` override |
| BROKER-04 | Port already held → refuse by name at startup, not a race | integration | mirror the existing singleton-collision test shape |
| BROKER-05 | Service definitions committed; no module invokes `systemctl`/`launchctl` | structural | new grep gate (must use `grep -a`) |
| BROKER-06 | Broker-owned state lands under the machine-level root, not inside either project's `.c64-re-tools/` | unit | assert the resolved path is under neither of two temp project roots |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each gap below is closed by the first task of the plan named beside it, before any
expansion depends on it.

- [ ] `hello`-op cases in `src/mcp/vice/broker-control.test.ts` — no existing case exercises a ninth op, nor dispatch ahead of the token gate. **Closed by 62-01 Task 1.**
- [ ] Two-candidate dial cases with per-candidate timeouts — new file `src/mcp/vice/broker-endpoint.test.ts`, colocated with the new module that owns dialling. **Created by 62-01 Task 1, expanded by Task 2.**
- [ ] Machine-level root precedence and two-project isolation cases — new file `src/mcp/vice/broker-home.test.ts`. **Created by 62-02 Task 1.**
- [ ] Interface-enumeration cases with an injectable interface-listing override (this repo's standing injection convention for anything touching env, time, spawning or I/O) — new cases in `src/mcp/vice/broker-control.test.ts`. **Closed by 62-03 Task 1.**
- [ ] Entry-point floor and dispatch cases — new file `src/mcp/vice/vice-cli.test.ts`. **Created by 62-04 Task 1.**
- [ ] A structural gate asserting no module invokes a service manager and no production module spawns the broker — new file `src/mcp/vice/service-no-invoke.test.ts`. It must read candidate files as BYTES with a filesystem read rather than shelling out to `grep`, because four source files under `src/mcp/vice/` contain NUL bytes (`anno-memmap-render.ts`, `anno-store-export.ts`, `prereq-readme-gen.ts`, `prerequisites.test.ts`) and a shell text search skips them silently. Where a shell check is used in a plan's `<verify>` block instead, it uses `grep -a`. **Created by 62-05 Task 1.**
- [ ] Framework install: none needed — `node:test` is already wired.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two unrelated project directories served by one live broker | BROKER-01 | `broker-e2e.test.ts` is on the frozen `MANUAL_ONLY_TESTS` list; it spawns a real broker | `cd src/mcp/vice && node --test broker-e2e.test.ts` |
| The narrowed control-host default | BROKER-03, D-12 | Both asserting files (`broker-e2e.test.ts`, `vice-broker-launch.test.ts`) are manual-only | `cd src/mcp/vice && node --test broker-e2e.test.ts vice-broker-launch.test.ts` |
| A systemd `--user` unit / launchd plist actually starting the broker | BROKER-05 | Requires a real service manager and is never auto-applied by design | Documented copy-paste steps in README; the user runs them |
| macOS bridge enumeration yielding an empty bridge set | BROKER-03 | No macOS host available here; an empty bridge set on macOS is correct, not a failure | Run the broker on macOS; confirm it binds loopback and does not refuse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] Every control-port test allocates dynamically or refuses an unexpected listener
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
