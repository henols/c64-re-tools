---
status: partial
phase: 03-direct-tools
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md
started: 2026-08-15T06:28:31Z
updated: 2026-08-15T08:05:00Z
---

## Current Test

[testing paused -- 9 items outstanding, all blocked on live-emulator validation]

## Tests

### 1. Cold Start Smoke Test
expected: From a clean tree, typecheck is clean, the full test suite passes, `node build.ts` produces zero drift in `resources/*.mjs`, and both manifests parse with stock=25 / fork=62 tools.
result: issue
reported: "npm test never terminates on a bare host (hangs indefinitely after the last test of vice-proxy.test.ts); 1 genuine structural test failure (1017) red since Phase 02; CI has not run for 214 commits"
severity: major
detail: |
  Verified green: `npx tsc --noEmit` clean; `node build.ts` -> zero git drift in
  `resources/*.mjs`; `tools-manifest.stock.json` = 25 tools; `tools-manifest.json` = 62 tools.

  Verified red, three distinct problems:

  (a) HANG. `npm test` on a bare host runs all 1090 tests then never exits.
      Reproduced twice, stopping at the same point (subtest 1068, the final test
      in vice-proxy.test.ts). `ss` showed an orphaned LISTEN socket on fd 21
      (192.168.5.106:35847) keeping the event loop alive.
      Root cause: vice-proxy.test.ts:2830-2845 calls startStandInServer() +
      listenOn(server, eth0) BEFORE its try/finally, then asserts
      `hostPath()` actually translates. Outside a container that assertion throws,
      so the `finally { server.close() }` never runs and the listener leaks.
      Any failure of that precondition converts into an infinite hang with no
      diagnostic output.

  (b) ENV-GATED FAILURES (9). Running with CI's own env vars
      (CONTAINER_WORKSPACE_PATH / HOST_WORKSPACE_PATH, per .github/workflows/ci.yml:22-23)
      drops the failure count from 10 to 1, AND the suite exits on its own in
      129 seconds instead of hanging forever -- confirming (a)'s diagnosis.
      Clean-env result: 1090 tests, 1084 pass, 1 fail, 0 skipped, 5 todo, exit 1.
      The 9 env-gated failures were: 976, 977, 997, 1031 (path translation) and
      120, 935, 936, 938, 939 (container guard).
      These are not defects, but nothing tells a developer that `npm test`
      needs those vars -- the failure mode is a silent infinite hang.

  (c) REAL FAILURE (1). Test 1017 "structural: no agent-visible template literal
      begins with the vice-proxy: prefix" fails in BOTH environments.
      vice-proxy.ts:3275-3276 contains two `vice-proxy:` template literals.
      They are inside a console.error() call, but commit 1c87d16 (Phase 02,
      plan 02-10) rewrote that call into a multi-line ternary, and the detector
      (vice-proxy.test.ts:3734-3750) only accepts a literal immediately preceded
      by `console.error(` within 40 chars. Red since Phase 02, not Phase 03.

  (d) NO CI COVERAGE. Local `main` is 214 commits ahead of `origin/main`.
      Last CI run: 2026-08-11 (commit 68b0a79), before any Phase 01/02/03 work.
      Phase 3's own tests (stock-*.test.ts) all pass.

### 2. Stock Tool Surface Is Advertised
expected: `tools-manifest.stock.json` advertises 25 tools — vice_ping plus 24 Phase 3 tools across memory (3), registers (3), checkpoints/watchpoints (6), execution (4), machine (5), input (3). Every entry has an `outputSchema` whose `runState` is an enum of `["running","stopped","unknown"]`, and every shared argument name/shape matches the fork counterpart.
result: pass
evidence: |
  Verified by direct inspection of tools-manifest.stock.json: 25 entries; family split is
  exactly memory 3 / registers 3 / checkpoints+watch 6 / execution 4 / machine 5 / input 3
  plus vice_ping. Zero entries missing an outputSchema. All 25 declare a runState enum of
  ["running","stopped","unknown"]. Zero required-argument mismatches against the fork
  counterpart (D-03). The only stock-only tools are vice_registers_available and
  vice_execution_until_return -- both the documented additions.
  Corroborated in the clean test run by ok 492 and the 25 D-02 conformance cases (e.g. ok 562).

### 3. Fork Surface Unchanged (BACK-02 gate)
expected: `tools-manifest.json` advertises exactly 62 tools, `vice_snapshot_list` is gone, and the fork launch argv is byte-identical to v0.1.x — a fork-backend session behaves exactly as before Phase 3.
result: pass
evidence: |
  tools-manifest.json parses with exactly 62 entries and contains no vice_snapshot_list.
  Confirmed in the clean test run by ok 287 (length exactly 62, D-16), ok 288 (no such entry),
  ok 289 (zero occurrences of vice_snapshot_list / snapshot.list in the file text),
  ok 223 (fork backend returns the exact byte-identical pre-Phase-2 argv),
  ok 224 (VICE_ARGS override unchanged for both backends), and
  ok 228 (stock backend without a remoteMonitorPort returns byte-identical pre-plan argv, D-13).

### 4. Memory Read/Write on Stock Backend (DIRECT-01, DIRECT-09)
expected: Against a stock (`-binarymonitor`) instance, `vice_memory_read` returns the requested bytes, `vice_memory_write` writes them back readably, a default read of an I/O register like $D019 does NOT trigger side effects (sidefx byte 0x00), and `vice_memory_banks` enumerates the connected build's real bank list.
result: blocked
blocked_by: other
reason: "Requires a live stock (-binarymonitor) emulator instance; live emulator validation not authorized this session."

### 5. Registers on Stock Backend (DIRECT-02, DIRECT-09)
expected: `vice_registers_available` lists the build's real register names, `vice_registers_get` returns name→value pairs, and `vice_registers_set` writes a register and echoes back the value the emulator confirmed. Asking to set an individual flag bit (N/V/B/D/I/Z/C) is refused with a message naming the build's actual status-register name.
result: blocked
blocked_by: other
reason: "Requires a live stock (-binarymonitor) emulator instance; live emulator validation not authorized this session."

### 6. Checkpoints, Watchpoints and Conditions on Stock (DIRECT-03)
expected: `vice_checkpoint_add` sets a breakpoint that fires, `vice_checkpoint_list` reports it, `vice_watch_add` sets a watchpoint, `vice_checkpoint_set_condition` accepts both a string (`RL == $64`) and a structured object and produces a condition VICE actually accepts. `stop:false` is refused without `acknowledgeTraceRisk:true`. A hot non-stopping checkpoint auto-disables itself after ~20 hits/second instead of stalling the emulator.
result: blocked
blocked_by: other
reason: "Requires a live stock (-binarymonitor) emulator instance; live emulator validation not authorized this session."

### 7. Execution Control on Stock (DIRECT-04, DIRECT-05)
expected: `vice_execution_pause` halts the machine and `vice_execution_run` resumes it; calling either when already in that state does nothing (no wire traffic) rather than erroring. `vice_execution_step` and `vice_execution_until_return` advance the CPU, and both refuse with a clear next-action message when the run state is still unknown. No other tool ever resumes the machine on its own.
result: blocked
blocked_by: other
reason: "Requires a live stock (-binarymonitor) emulator instance; live emulator validation not authorized this session."

### 8. Machine Control on Stock (DIRECT-06 partial, DIRECT-08)
expected: `vice_machine_reset` soft/hard resets without resuming by default, `vice_autostart` loads and runs a .prg from a host path, `vice_disk_attach` attaches a .d64 to unit 8 (units 9–11 refused, naming the protocol limit), and `vice_snapshot_save` / `vice_snapshot_load` round-trip a .vsf inside the workspace. Disk *detach* is deliberately absent — deferred to Phase 7.
result: blocked
blocked_by: other
reason: "Requires a live stock (-binarymonitor) emulator instance plus a real .prg/.d64 fixture; live emulator validation not authorized this session."

### 9. Keyboard and Joystick on Stock (DIRECT-07)
expected: `vice_keyboard_type` types ASCII text into the running machine with correct PETSCII case handling, `vice_keyboard_petscii` sends raw bytes, and `vice_joystick_set` moves/fires in a game. Unmappable characters are refused naming the offending index rather than silently mangled. The machine stays halted after each until explicitly resumed.
result: blocked
blocked_by: other
reason: "Requires a live stock (-binarymonitor) emulator instance running a program to observe input against; live emulator validation not authorized this session."

### 10. Every Stock Answer Carries runState (D-06)
expected: Every stock tool answer includes a `runState` field of `"running"`, `"stopped"` or `"unknown"` that actually reflects the machine — so an agent never has to guess whether the emulator is halted after a read.
result: blocked
blocked_by: other
reason: "Requires a live stock instance to confirm runState tracks the real machine. Static half is already green: all 25 manifest entries declare the runState enum and the 25 D-02 conformance cases assert runState on every real dispatchStock() answer."

### 11. Second Monitor Port Survives Respawn and Teardown (D-13)
expected: A stock instance launches with `-remotemonitor` on a second broker-allocated port. After a crash-respawn or `vice_recycle`, the replacement instance still launches with stock argv (`-binarymonitor`, not `-mcpserver`) and still carries its `-remotemonitor` port. Repeatedly recycling does not permanently exhaust the port band.
result: blocked
blocked_by: other
reason: "Requires launching, crashing and recycling real stock instances through the broker; live emulator validation not authorized this session."

### 12. Backend Switch Is Per-Project and Reversible
expected: Selecting the stock backend for a project makes Claude Code see only the 25 stock tools; switching back to the fork restores the full 62-tool surface, with no leftover state from the other backend.
result: blocked
blocked_by: other
reason: "Requires two live Claude Code MCP sessions (one per backend) to observe the advertised tool list change; live emulator validation not authorized this session."

## Summary

total: 12
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 9

## Gaps

- truth: "The full test suite runs to completion and passes from a clean tree"
  status: failed
  reason: "User reported: npm test never terminates on a bare host -- runs all 1090 tests then hangs indefinitely with no diagnostic"
  severity: major
  test: 1
  root_cause: "vice-proxy.test.ts:2830-2845 opens a stand-in server via startStandInServer()/listenOn() BEFORE its try/finally, then asserts hostPath() actually translates. Outside a container that precondition assertion throws, the finally{server.close()} never runs, the LISTEN socket leaks, and node's event loop never drains."
  artifacts:
    - path: ".claude/mcp/vice/vice-proxy.test.ts"
      issue: "line 2834-2835: startStandInServer()/listenOn() called outside the try block, so a throwing precondition assertion at line 2845 leaks the listener and hangs the process forever"
    - path: ".claude/mcp/vice/vice-proxy.test.ts"
      issue: "line 2775 (sibling test) has the same open-before-try shape and the same latent hang"
  missing:
    - "Move startStandInServer()/listenOn() inside the try, or register the close in a t.after() hook so a failing precondition still tears the listener down"
    - "Audit every startStandInServer()/startProxy() call site in vice-proxy.test.ts for the same open-before-try shape"

- truth: "Every agent-visible message in vice-proxy.ts uses the 'vice:' identity, enforced by a structural test"
  status: failed
  reason: "Test 1017 fails in both host and CI-env runs -- two `vice-proxy:` template literals at vice-proxy.ts:3275-3276"
  severity: minor
  test: 1
  root_cause: "Commit 1c87d16 (Phase 02, plan 02-10) rewrote a single-line console.error(`vice-proxy: ready...`) into a multi-line ternary. The detector at vice-proxy.test.ts:3734-3750 only exempts a literal immediately preceded by `console.error(` within 40 chars, so the ternary arms are flagged."
  artifacts:
    - path: ".claude/mcp/vice/vice-proxy.ts"
      issue: "lines 3275-3276: two `vice-proxy:` template literals inside a ternary passed to console.error()"
    - path: ".claude/mcp/vice/vice-proxy.test.ts"
      issue: "lines 3734-3750: detector's console.error adjacency heuristic cannot see through a multi-line ternary argument"
  missing:
    - "Decide which side is wrong: either switch the two literals to the 'vice:' identity, or widen the detector to recognise a literal anywhere inside a console.error() argument list"

- truth: "CI validates the tree before a phase is verified"
  status: failed
  reason: "Local main is 214 commits ahead of origin/main; last CI run was 2026-08-11 (commit 68b0a79), predating all Phase 01/02/03 work"
  severity: major
  test: 1
  root_cause: "No push to origin since Phase 0. Every green-CI signal available predates the entire milestone, so CI provides no evidence about the current tree."
  artifacts:
    - path: ".github/workflows/ci.yml"
      issue: "workflow is sound but has not executed against any Phase 01/02/03 commit"
  missing:
    - "Push main (or open a PR) so CI actually exercises the milestone before Phase 03 is marked verified"
