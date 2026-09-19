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

*Seeded by plan-phase; the planner fills one row per task as plans are written.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ENDPOINT-01 | — | N/A | unit | TBD | ❌ W0 | ⬜ pending |

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

- [ ] `hello`-op cases in `src/mcp/vice/broker-control.test.ts` — no existing case exercises a ninth op, nor dispatch ahead of the token gate.
- [ ] Two-candidate dial cases with per-candidate timeouts — colocated with whichever module owns dialling.
- [ ] Interface-enumeration cases with an injectable `os.networkInterfaces()` override (this repo's standing injection convention for anything touching env, time, spawning or I/O).
- [ ] A structural gate asserting no module invokes `systemctl` or `launchctl` — must scan with `grep -a`, because four source files under `src/mcp/vice/` contain NUL bytes (`anno-memmap-render.ts`, `anno-store-export.ts`, `prereq-readme-gen.ts`, `prerequisites.test.ts`) and plain `grep` skips them silently.
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
