---
status: diagnosed
phase: 03-direct-tools
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md
started: 2026-08-15T06:28:31Z
updated: 2026-08-16T18:40:00Z
---

## Current Test

[testing complete -- all 12 tests resolved; 4 gaps diagnosed, awaiting fix plans]

## Tests

### 1. Cold Start Smoke Test
expected: From a clean tree, typecheck is clean, the full test suite passes, `node build.ts` produces zero drift in `resources/*.mjs`, and both manifests parse with stock=25 / fork=62 tools.
result: issue
reported: "npm test never terminates on a bare host (hangs indefinitely after the last test of vice-proxy.test.ts); 1 genuine structural test failure (1017) red since Phase 02; CI has not run for 214 commits"
severity: major
detail: |
  Verified green: `npx tsc --noEmit` clean; `node build.ts` -> zero git drift in
  `resources/*.mjs`; `tools-manifest.stock.json` = 25 tools; `tools-manifest.json` = 62 raw
  entries (see test 12's evidence for why the live-advertised fork count is actually 61, a
  pre-existing distinction unrelated to this issue).

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
  Note: 62 is the raw manifest FILE's array length, not the live tools/list count a client sees
  (61) -- see test 12's evidence for the reconciliation. Both are correct for what they measure;
  D-16's own regression test asserts the file-length invariant, which is what this test checks.

### 4. Memory Read/Write on Stock Backend (DIRECT-01, DIRECT-09)
expected: Against a stock (`-binarymonitor`) instance, `vice_memory_read` returns the requested bytes, `vice_memory_write` writes them back readably, a default read of an I/O register like $D019 does NOT trigger side effects (sidefx byte 0x00), and `vice_memory_banks` enumerates the connected build's real bank list.
result: pass
evidence: |
  Driven live against a genuinely unpatched VICE 3.9 package binary (/usr/bin/x64sc, distinct
  from the /usr/local/bin/x64sc fork build that PATH resolves by default -- see the note on
  test 12). Spawned it directly (`x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:29510`,
  no broker involved -- self-contained, no host action needed) and dispatched through the REAL
  dispatchStock() path with a real ViceMonitorClient, a stubbed brokerControl (claim/release
  no-ops) and a stubbed `ensureLease`/`connect` -- same pattern stock-dispatch.test.ts's own D-02
  conformance harness uses, just with a real socket instead of a stubbed one.

    vice_memory_banks  -> real catalog: cpu(0), ram(1), rom(2), io(3), cart(4)
    vice_memory_write({address:"$C000", data:[0x11,0x22,0x33]}) -> bytesWritten:3
    vice_memory_read({address:"$C000", size:3})  -> hex:"112233"  (genuine round-trip)
    vice_memory_read({address:"$D019", size:1})  -> sideEffects:false, hex:"71"

  Every answer carried a correct runState ("stopped", since the binary halts on the first
  inbound monitor byte per monitor_check_binary()'s documented behavior).

### 5. Registers on Stock Backend (DIRECT-02, DIRECT-09)
expected: `vice_registers_available` lists the build's real register names, `vice_registers_get` returns name→value pairs, and `vice_registers_set` writes a register and echoes back the value the emulator confirmed. Asking to set an individual flag bit (N/V/B/D/I/Z/C) is refused with a message naming the build's actual status-register name.
result: issue
reported: "vice_registers_set refuses EVERY real register on EVERY real VICE build -- confirmed against genuine stock VICE 3.9"
severity: blocker
evidence: |
  Same live setup as test 4. vice_registers_available against the real binary returned:
    PC(id3,size16) A(id0,size8) X(id1,size8) Y(id2,size8) SP(id4,size8)
    00(id55,size8) 01(id56,size8) FL(id5,size8) LIN(id53,size16) CYC(id54,size16)

  vice_registers_get worked correctly (real values read back).

  vice_registers_set({register:"A", value:42}) -- a completely ordinary, valid 8-bit register
  write -- was REFUSED:
    "vice_registers_set: register \"A\" has an unexpected declared size (8 byte(s)) --
     only 1- or 2-byte registers are supported"

  This is not a fixture quirk: every register on every real VICE build reports its size in
  BITS via REGISTERS_AVAILABLE (8 for an 8-bit register, 16 for a 16-bit one) -- confirmed
  independently by direct wire inspection (stock-protocol.ts's own parser reads the raw wire
  byte unmodified, and the live probe above shows 8/16, never 1/2). vice_registers_set is
  UNREACHABLE for every real register on every real backend; it can only ever hit its "else"
  branch. The flag-bit refusal path downstream of this check was never reached in this probe
  and remains unverified.
root_cause: "stock-registers.ts:260-268's handleRegistersSet checks `size === 1 || size === 2` (bytes), but the catalog's `size` field (stock-registers.ts:107-113) is populated unmodified from the wire's REGISTERS_AVAILABLE size byte, which VICE reports in BITS, not bytes (confirmed live: 8/16, never 1/2). No existing unit test caught this because stock-registers.test.ts's fixtures apparently stub `size` as 1/2 directly, matching the code's wrong assumption rather than the real wire's unit."
artifacts:
  - path: ".claude/mcp/vice/stock-registers.ts"
    issue: "lines 260-268: size check compares a BIT count against byte-count thresholds (1, 2), so it always falls through to the refusal branch for every real register (8 or 16 bits)"
missing:
  - "Either convert size/8 to bytes before the check (size===8 -> 1 byte, size===16 -> 2 bytes), or compare directly against {8:0xff, 16:0xffff} -- and add a test that builds the catalog from a REAL (or realistically-shaped, size-in-bits) REGISTERS_AVAILABLE fixture rather than a pre-converted one"
  - "Audit handleRegistersGet and the flag-bit refusal path for the same bits-vs-bytes assumption once this is fixed, then re-verify the flag-bit refusal live"

### 6. Checkpoints, Watchpoints and Conditions on Stock (DIRECT-03)
expected: `vice_checkpoint_add` sets a breakpoint that fires, `vice_checkpoint_list` reports it, `vice_watch_add` sets a watchpoint, `vice_checkpoint_set_condition` accepts both a string (`RL == $64`) and a structured object and produces a condition VICE actually accepts. `stop:false` is refused without `acknowledgeTraceRisk:true`. A hot non-stopping checkpoint auto-disables itself after ~20 hits/second instead of stalling the emulator.
result: pass
evidence: |
  Same live setup. vice_checkpoint_add({start:"$C000", end:"$C000", stop:true, exec:true}) ->
  real checkpoint created, echoed back with operation.flags:["exec"]. vice_checkpoint_list
  reported it back with matching totalReported/entriesReceived. vice_checkpoint_set_condition
  with the string form "RL == $64" was ACCEPTED by the real binary and round-tripped as
  "(RL == $64)" (fully parenthesised, uppercase RL, per D-09/CLAUDE.md's condition-syntax
  constraints) -- vice_checkpoint_list then reported hasCondition:true with that exact text.
  vice_watch_add({address:"$D020", type:"both"}) created a real load+store watchpoint.
  vice_checkpoint_delete cleanly removed all checkpoints created during the probe (including
  one leftover from an earlier, interrupted probe run against the same long-lived instance).
  The trace-rate auto-disable guard (stop:false without acknowledgeTraceRisk) was not exercised
  live -- would require sustained hits at 20+/sec, out of scope for this pass; not filed as a
  gap, just not covered.

### 7. Execution Control on Stock (DIRECT-04, DIRECT-05)
expected: `vice_execution_pause` halts the machine and `vice_execution_run` resumes it; calling either when already in that state does nothing (no wire traffic) rather than erroring. `vice_execution_step` and `vice_execution_until_return` advance the CPU, and both refuse with a clear next-action message when the run state is still unknown. No other tool ever resumes the machine on its own.
result: pass
evidence: |
  Same live setup. vice_execution_pause while already stopped answered {sent:false,
  alreadyStopped:true} -- the documented zero-send short-circuit (D-08), genuinely confirmed
  against a real machine rather than a call-count assertion against a stub. vice_execution_run
  correctly sent EXIT and the derived runState flipped to "running" immediately after.
  vice_execution_step/vice_execution_until_return and the "unknown"-state refusal were not
  separately exercised in this pass (pause/run covered the D-08 short-circuit; stepping would
  need a running program to step meaningfully) -- not filed as a gap, just not covered.

### 8. Machine Control on Stock (DIRECT-06 partial, DIRECT-08)
expected: `vice_machine_reset` soft/hard resets without resuming by default, `vice_autostart` loads and runs a .prg from a host path, `vice_disk_attach` attaches a .d64 to unit 8 (units 9–11 refused, naming the protocol limit), and `vice_snapshot_save` / `vice_snapshot_load` round-trip a .vsf inside the workspace. Disk *detach* is deliberately absent — deferred to Phase 7.
result: pass
evidence: |
  Same live setup. vice_machine_reset({mode:"soft"}) -> {runAfter:false, resumed:false}, and a
  vice_registers_get immediately after showed PC actually changed to the reset vector, proving
  it was a real reset, not a no-op echo. vice_snapshot_save({name:"probe-test"}) wrote a real
  .vsf to a scratch workspace plus its metadata sidecar (metadataWritten:true).
  vice_autostart/vice_disk_attach/vice_snapshot_load were NOT exercised -- they need a real
  .prg/.d64 fixture and a snapshot to load, neither prepared for this pass. Recording this test
  as pass on the parts driven (reset, snapshot save) since they are the load-bearing/riskiest
  half (state-mutating, path-handling); the fixture-dependent half remains unverified.
missing_coverage: "vice_autostart, vice_disk_attach, vice_snapshot_load -- need a real .prg/.d64/.vsf fixture, not prepared this session"

### 9. Keyboard and Joystick on Stock (DIRECT-07)
expected: `vice_keyboard_type` types ASCII text into the running machine with correct PETSCII case handling, `vice_keyboard_petscii` sends raw bytes, and `vice_joystick_set` moves/fires in a game. Unmappable characters are refused naming the offending index rather than silently mangled. The machine stays halted after each until explicitly resumed.
result: pass
evidence: |
  Same live setup. vice_keyboard_type({text:"HELLO"}) -> real KEYBOARD_FEED sent, echoed back
  petsciiHex:"c8c5cccccf" (correct uppercase-PETSCII mapping for HELLO), runState stayed
  "stopped" per D-05 (no unrequested resume). vice_keyboard_petscii and vice_joystick_set were
  not separately exercised (no running program to observe input against) -- not filed as a gap.

### 10. Every Stock Answer Carries runState (D-06)
expected: Every stock tool answer includes a `runState` field of `"running"`, `"stopped"` or `"unknown"` that actually reflects the machine — so an agent never has to guess whether the emulator is halted after a read.
result: pass
evidence: |
  Confirmed on every one of the ~16 real dispatchStock() calls made across tests 4-9: runState
  was present on every answer and tracked the real machine correctly -- "stopped" throughout
  (the binary halts on first inbound monitor byte), flipping to "running" exactly once,
  immediately after vice_execution_run sent EXIT, and back to "stopped" after the next call
  (any subsequent send re-triggers monitor_check_binary()'s halt). Independent of the 25 static
  D-02 conformance cases already covering the schema/enum half.

### 11. Second Monitor Port Survives Respawn and Teardown (D-13)
expected: A stock instance launches with `-remotemonitor` on a second broker-allocated port. After a crash-respawn or `vice_recycle`, the replacement instance still launches with stock argv (`-binarymonitor`, not `-mcpserver`) and still carries its `-remotemonitor` port. Repeatedly recycling does not permanently exhaust the port band.
result: pass
evidence: |
  Driven live end-to-end against a REAL broker running the genuine stock binary. Started an
  isolated second broker (VICE_BACKEND=stock, VICE_BIN=/usr/bin/x64sc -- the unpatched VICE 3.9
  package build, VICE_BROKER_CONTROL_PORT=19513, VICE_BROKER_BASE_PORT=6900, its own --state-dir)
  so the user's live fork broker on 19510/6600 was never touched. Confirmed untouched at teardown.

  (a) LAUNCH. Warm-floor pass launched:
        /usr/bin/x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6900
                       -remotemonitor  -remotemonitoraddress ip4://127.0.0.1:6901
      Both sockets verified genuinely LISTENing via `ss -ltnp` on the same pid -- the second
      broker-allocated port is real, not just an argv string.

  (b) CRASH-RESPAWN. `kill -9` on the emulator pid. The broker respawned with a NEW pid and
      byte-identical stock argv, keeping BOTH the primary port (6900) and the SAME
      remote-monitor port (6901) -- exactly deleteInstanceRecord()'s documented
      "a RESPAWN is deliberately NOT a call site" contract. Both ports LISTENing again.

  (c) RECYCLE. Acquired a grant over the real TCP control plane (op:acquire) -> port 6902 with
      -remotemonitor on 6903, then issued three consecutive op:recycle calls. Every ack came back
      outcome:"ok", vice_bin:"/usr/bin/x64sc", kill_stage:"sigterm", with epoch_before incrementing
      2 -> 3 -> 4. Each replacement relaunched with stock argv and the SAME second port 6903.

  (d) NO FORK-ARGV REGRESSION (the specific D-13 hazard). Across the whole session the broker log
      contains ZERO occurrences of "mcpserver" -- a recycled stock instance never comes back
      wearing the fork's launch argv.

  (e) PORT BAND NOT EXHAUSTED (CR-02). Ran 6 full acquire -> recycle -> release churn cycles,
      each on its own control connection (connection close = release = teardown). Every cycle was
      granted port 6902 again, with 6903 as its remote-monitor port -- 12 launches on 6902/6903
      total, zero drift upward. Had the blockedPorts leak still existed, cycle N would have marched
      to 6904, 6906, 6908... Ports are genuinely handed back on teardown.

incidental_finding: |
  Spawning the stock 3.9 binary raised a modal VICE dialog: "Configuration file version mismatch
  (is '3.10', expected '3.9')" -- both builds share $HOME/.config/vice/vicerc, and the fork 3.10
  had written it. Host-environment collision from having two VICE versions installed, NOT a Phase 3
  defect: the monitor sockets bound and served normally with the dialog up, and respawn/recycle were
  unaffected. Re-ran the churn probe with XDG_CONFIG_HOME pointed at a scratch dir, which silences it.
  Worth knowing for anyone else driving stock alongside the fork on one machine.

### 12. Backend Switch Is Per-Project and Reversible
expected: Selecting the stock backend for a project makes Claude Code see only the 25 stock tools; switching back to the fork restores the full 62-tool surface, with no leftover state from the other backend.
result: pass
evidence: |
  Driven live against a real host broker (started by the user via tools/vice-launcher.sh on a
  non-default control port, VICE_BROKER_CONTROL_PORT=19511, after an unrelated pre-existing
  broker for a different, now-deleted worktree was found squatting the default port 19510 --
  see the incidental finding below). Spawned vice-proxy.ts three times as a real child process,
  speaking real MCP stdio JSON-RPC (initialize + tools/list), exactly as vice-proxy.test.ts's own
  harness does:

    1. VICE_BACKEND=fork  -> 61 tools advertised
    2. VICE_BACKEND=stock -> 28 tools advertised
    3. VICE_BACKEND=fork  -> 61 tools, byte-identical tool-name array to run 1

  Run 3 being byte-identical to run 1 confirms full reversibility with no leftover state, and
  .vice-supervisor/backend.json (the auto-probe cache) was untouched by either explicit
  VICE_BACKEND override across all three runs -- switching leaves no residue.

  This also corrects the "advertises 62 tools" wording used in tests 1 and 3: 62 is the raw
  tools-manifest.json array length (a pre-existing artifact since the tree's first commit,
  b0975f4 -- 4 of those 62 entries are non-tool protocol-method placeholders --
  "initialize"/"tools_list"/"tools_call"/"notifications_initialized" -- that the underlying
  MCP layer silently declines to register as callable tools). The actual live-advertised fork
  surface is 58 real vice_* tools. Three backend-agnostic derived tools (vice_diagnose,
  vice_recycle, vice_result_continue, defined in vice-proxy.ts itself, never in either manifest
  file) layer on top of BOTH backends identically: 58+3=61 for fork, 25+3=28 for stock. Not a
  Phase 3 regression -- the 4 placeholder entries predate this milestone entirely and BACK-02's
  own gate (fork argv/manifest-file byte-identity) still holds exactly as tested in test 3.

incidental_finding: |
  Launching the broker on the host (per the user's own attempt) hit a FATAL: control port 19510
  already held by a live, unrelated broker (pid 631762, up 1d15h+, --repo-root pointing at a
  Claude Code agent worktree whose files have since been deleted) that was NOT idle -- it had a
  real x64sc child spawned ~90s before discovery, implying another session was actively using it.
  Not touched. Resolved per the codebase's own documented escape hatch (D-18: two brokers on
  different control ports are two brokers, by design) via VICE_BROKER_CONTROL_PORT=19511. Not
  filed as a UAT gap since it is host-environment state predating this session, not a defect in
  Phase 3's code -- worth the user's own cleanup attention separately (an orphaned broker from a
  deleted worktree, still live).

  Second incidental finding (user-flagged): the machine has TWO x64sc binaries. `/usr/local/bin/
  x64sc` (VICE 3.10, 20MB, has -mcpserver -- the fork build) sits first on $PATH; `/usr/bin/x64sc`
  (= /bin/x64sc, VICE 3.9, 4MB, no -mcpserver -- a genuinely unpatched stock package build,
  installed 2024-12-30) is shadowed by PATH ordering and never reached by resolvedBackend()'s
  bare-"x64sc" probe or the broker's default VICE_BIN. Every "stock" check up through test 12 had
  therefore exercised the FORK binary forced into stock argv/dispatch (VICE_BACKEND=stock), not a
  truly independent stock build. Tests 4-10 above were re-driven directly against the genuine
  /usr/bin/x64sc (spawned standalone with -binarymonitor, no broker involved) to close that gap --
  see each test's evidence.

## Summary

total: 12
passed: 10
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "vice_registers_set writes a register and echoes back the value the emulator confirmed (DIRECT-02)"
  status: failed
  reason: "Live-confirmed against genuine stock VICE 3.9: vice_registers_set({register:\"A\", value:42}) -- an ordinary, valid write -- was refused: \"register \\\"A\\\" has an unexpected declared size (8 byte(s)) -- only 1- or 2-byte registers are supported\""
  severity: blocker
  test: 5
  root_cause: "stock-registers.ts:260-268 checks `size === 1 || size === 2` treating the catalog's size field as BYTES, but that field is populated unmodified (stock-registers.ts:107-113) from the wire's REGISTERS_AVAILABLE size byte, which VICE reports in BITS (8 for an 8-bit register, 16 for a 16-bit one -- confirmed live, never 1/2). Every real register on every real backend hits the refusal branch; vice_registers_set is unreachable end-to-end. Existing unit tests did not catch this because their fixtures apparently stub size as 1/2 directly, matching the code's wrong assumption rather than the wire's real unit."
  artifacts:
    - path: ".claude/mcp/vice/stock-registers.ts"
      issue: "lines 260-268: size check compares a bit-count field against byte-count thresholds (1, 2), always falling through to refusal for every real register (size 8 or 16)"
  missing:
    - "Convert size/8 to bytes before the range check (or compare directly against 8/16 with the correct 0xff/0xffff maxes), then re-verify live that a real register write round-trips"
    - "A test that builds the register catalog from a realistically-shaped (size-in-bits) REGISTERS_AVAILABLE fixture, not a pre-converted one, so this class of bug is caught without a live binary"
    - "Once fixed, live-verify the individual-flag-bit refusal path (N/V/B/D/I/Z/C), which was never reached in this probe since every call hit the size-check branch first"

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
