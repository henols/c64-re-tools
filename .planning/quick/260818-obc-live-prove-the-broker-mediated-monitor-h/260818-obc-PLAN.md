---
phase: quick-260818-obc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .claude/mcp/vice/stock-live-broker-monitor.test.ts
  - .claude/mcp/vice/stock-diagnose.test.ts
  - .claude/mcp/vice/test-gate.mjs
  - .claude/mcp/vice/test-gate.test.ts
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
  - .planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md
  - .planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md
  - .planning/phases/07-cycle-timing-and-wedge-triage/07-UAT.md
  - .planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md
  - .claude/skills/vice-wedge-triage/SKILL.md
autonomous: true
requirements: [TIME-04]
must_haves:
  truths:
    - "A real host broker daemon, launched from resources/vice-broker.mjs with VICE_BACKEND=stock and a real stock x64sc, hands out two independent leases that both resolve to the SAME live instance"
    - "The lease whose claimMonitor() is refused by that real broker gets vice_diagnose verdict:\"monitor_held_elsewhere\" (never diagnosis_unavailable), carrying the OTHER grant's real id, a non-zero claimedAt, and the instance's real port"
    - "The proof settles well inside DEFAULT_DIAGNOSE_SESSION_TIMEOUT_MS (10000ms, stock-diagnose.ts:347) and the elapsed figure is recorded"
    - "`node test-gate.mjs` stays green, does NOT run the new suite, and reds first if the monitor_held_elsewhere evidence shape is widened"
    - "No x64sc and no vice-broker.mjs process survives the run, including when an assertion throws"
    - "TIME-04 is marked complete ONLY on a genuine live pass; otherwise it stays open with the observed transcript recorded"
  artifacts:
    - path: ".claude/mcp/vice/stock-live-broker-monitor.test.ts"
      provides: "opt-in live proof of the broker-mediated monitor_held_elsewhere verdict through a real broker control plane"
      contains: "monitor_held_elsewhere"
    - path: ".claude/mcp/vice/stock-diagnose.test.ts"
      provides: "automated shape oracle pinning the monitor_held_elsewhere evidence key set (standing rule mirror)"
      contains: "holderGrantId"
    - path: ".claude/mcp/vice/test-gate.mjs"
      provides: "sixth MANUAL_ONLY_TESTS entry"
      contains: "stock-live-broker-monitor.test.ts"
  key_links:
    - from: ".claude/mcp/vice/stock-live-broker-monitor.test.ts"
      to: ".claude/mcp/vice/resources/vice-broker.mjs"
      via: "spawn of the emitted host artifact with VICE_BACKEND=stock"
      pattern: "resources.*vice-broker\\.mjs"
    - from: ".claude/mcp/vice/stock-live-broker-monitor.test.ts"
      to: ".claude/mcp/vice/vice-broker-client.ts"
      via: "openBrokerControl() -> session.acquire() -> a real HeldLease whose brokerControl is the real session"
      pattern: "openBrokerControl\\("
    - from: ".claude/mcp/vice/test-gate.test.ts"
      to: ".claude/mcp/vice/test-gate.mjs"
      via: "exact-contents drift guard over MANUAL_ONLY_TESTS"
      pattern: "stock-live-broker-monitor\\.test\\.ts"
---

<objective>
Live-prove the ONE Phase 07 item that three documents name identically and that has
never run end to end: `vice_diagnose`'s **broker-mediated** `monitor_held_elsewhere`
verdict — a real second `claimMonitor()` refusal from a genuine host broker control
plane, not the unit-injected `MonitorOwnershipError` and not `stock-live.test.ts`
Task 3's socket-level contention case (which correctly answers the honest non-verdict
`diagnosis_unavailable (monitor_acquisition_timeout)` and must NOT be duplicated here).

Purpose: 07-VERIFICATION.md's `human_verification` item, 07-UAT.md test 9's scope note
and 07-VALIDATION.md's last open Manual-Only row (`nyquist_compliant: false`) are the
same gap. Closing it with a real transcript is what lets `TIME-04` move; NOT closing it
honestly is this phase's signature failure mode and is the one outcome this plan
forbids.

Output: a new opt-in `stock-live-broker-monitor.test.ts`, its gate registration plus the
standing-rule automated mirror, a recorded live transcript, and record corrections that
follow the transcript rather than the hope.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md
@.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md
@.claude/mcp/vice/broker-e2e.test.ts
@.claude/mcp/vice/stock-live-triage.test.ts
@.claude/mcp/vice/stock-diagnose.ts
@.claude/mcp/vice/vice-broker-client.ts
@.claude/mcp/vice/vice-broker.mts
@.claude/mcp/vice/broker-control.mts
@.claude/mcp/vice/broker-launch.mts
@.claude/mcp/vice/test-gate.mjs
</context>

<reachability_analysis>
READ THIS BEFORE WRITING ANY CODE. The naive harness ("two acquires, second one's
claim is refused") CANNOT work, and knowing why is what makes the test writable. Source
facts, each verified against the tree at plan time (treat a line-number mismatch as
drift to re-verify, not as evidence the fact changed):

1. `broker-control.mts`'s `ownsTarget()` (defined ~line 428, gated at the `monitor_claim`
   branch ~line 606, CR-03) refuses any `target_id` that is not the grant THIS connection
   holds. So session B can never name session A's grant. A `monitor_owned` refusal
   therefore requires **two live grants whose `grant.port` is the SAME port** —
   `handleMonitorClaim()` (`vice-broker.mts` ~666-705) resolves target -> grant -> port ->
   instance and compares `instance.monitorClient.grantId` against the asking grant id.
2. Two plain acquires can never produce that: `handleAcquire()` (`vice-broker.mts` ~562+)
   only ever grants a record in state `"ready"` (via `selectWarmInstance()`, ~462) or a
   freshly cold-launched one, and flips it to `"granted"`; `handleRelease()` (~904) clears
   the monitor client, deletes the grant AND deletes+kills the instance record.
3. The ONE reachable route is a **crash respawn**. `handleExit()` (`broker-launch.mts`
   ~1057) on a NON-deliberate exit clears `record.monitorClient` (~1082) and calls
   `launchSupervised()` (~1156), which reuses the SAME port, bumps the epoch
   (`nextEpochFor` + `writeEpochRecord`) and installs a BRAND NEW `InstanceRecord` in state
   `"launching"`. Grant A stays in `state.grants` at that port (only the *recycle* branch,
   ~1101-1116, re-marks the respawn `"granted"` and syncs grant pids — the crash branch
   does neither, and `handleMonitorClaim()` resolves by port only, never by pid). The
   periodic pass then promotes `"launching"` -> `"ready"` (`maintainWarmFloor()`,
   `broker-launch.mts` ~821-835), after which a SECOND connection's acquire can be served
   that same instance -> **grant B on port P**. Whichever of A/B claims second is refused
   `monitor_owned` naming the other.
   This is not a contrived state: it is "the emulator crashed, another session picked up
   the respawn, and the original session asks what happened" — exactly what
   `vice-wedge-triage` exists for.
4. Consequence for the test: kill the emulator **externally** (SIGKILL the pid). Do NOT use
   the broker's `recycle` op — the deliberate-kill branch keeps the respawn `"granted"` and
   it never becomes warm-selectable.
5. Direction is not fixed. Assert that the REFUSED session's verdict names **the other
   grant's real id**; never hardcode "session 2 is the one refused".
</reachability_analysis>

<tasks>

<task type="auto">
  <name>Task 1: Write the opt-in broker-mediated live proof, register it in the gate, and mirror its payload shape in the automated set</name>
  <files>.claude/mcp/vice/stock-live-broker-monitor.test.ts, .claude/mcp/vice/test-gate.mjs, .claude/mcp/vice/test-gate.test.ts, .claude/mcp/vice/stock-diagnose.test.ts</files>
  <action>
Create `.claude/mcp/vice/stock-live-broker-monitor.test.ts`. Header comment must state, in
this file's own words: what it proves (the BROKER-mediated `monitor_held_elsewhere`
verdict), what it deliberately does NOT duplicate (`stock-live.test.ts` Task 3's
socket-level contention bound, which answers the honest non-verdict
`diagnosis_unavailable (monitor_acquisition_timeout)`), the reachability chain from
`<reachability_analysis>` above (points 1-4, so a future reader does not "simplify" the
crash step away), and that it is registered as MANUAL_ONLY_TESTS' sixth entry.

Opt-in gate, copying `stock-live-triage.test.ts:96-115`'s discipline exactly: env var
`VICE_LIVE_BROKER_BIN` (absolute path to a genuinely unpatched stock x64sc; note in the
comment that a bare `x64sc` on PATH resolves to the fork build). Compute `SKIP_REASON`
ONCE and pass it through `node:test`'s own `{ skip }` option on EVERY test — never a
hand-rolled early return (that reports a false PASS). Also skip with a named reason when
the resolved path does not exist.

Harness — ONE `withBrokerHarness(fn)` wrapper, everything acquired inside its `try`,
everything torn down in its `finally`:
  - `mkdtempSync(join(tmpdir(), "vice-broker-monitor-"))` scratch; state dir `<scratch>/state`.
  - Call `build()` from `./build.ts` first (broker-e2e.test.ts's precedent) so the spawned
    artifact is not stale, then spawn `join(HERE, "resources", "vice-broker.mjs")` under
    `process.execPath` with argv `["--repo-root", scratch, "--state-dir", stateDir]`.
    Capture its stderr into the handle for failure messages.
  - Broker env (each one load-bearing):
      `VICE_BACKEND=stock`   — backend-detect.mts's only override (D-01); without it the
                               daemon builds the FORK's `-mcpserver` argv.
      `VICE_BIN=<resolved VICE_LIVE_BROKER_BIN>`
      `VICE_ARGS` MUST be deleted from the child env — a non-empty value is a FULL argv
                               override in `buildViceArgs()` (`broker-launch.mts:158-161`)
                               and would drop `-binarymonitoraddress ip4://127.0.0.1:<port>`.
                               Use broker-e2e.test.ts's `key: undefined` unset idiom.
      `VICE_BROKER_CONTROL_PORT=0`  — kernel-chosen port, no collision with a real broker.
      `VICE_BROKER_WARM_FLOOR=0`, `VICE_BROKER_MAX=1` — the ceiling is what forces the
                               second acquire onto the SAME instance: a cold launch is
                               refused `at_capacity`, so the only grantable record is the
                               respawned one at port P.
      `VICE_BROKER_POLL_MS=250`, `VICE_RESTART_BACKOFF_S=1` — keeps promotion/respawn brisk.
      `XDG_CONFIG_HOME=<scratch>` — no persisted vicerc exists there, so the 3.9-vs-3.10
                               "Configuration file version mismatch" dialog cannot appear.
                               This is WHY the broker's stock argv lacking `-default` is
                               safe here; say so in the comment (see the `-default` note in
                               `stock-live-triage.test.ts`'s header).
      Inherit `DISPLAY`. Do NOT set `VICE_SUPERVISOR_ALLOW_CONTAINER` — this runs on the
      host and the container guard must pass on its own.
  - Client side, at module scope: `process.env.VICE_BROKER_CONTROL_DIAL_HOST = "127.0.0.1"`
    (broker-e2e.test.ts:46's precedent — broker.json's `control_host` is a BIND address,
    never a dial target), and make sure that key is unset in the spawned broker's env.
  - Wait for `<stateDir>/broker.json` to exist and parse before dialling.

Two independent leases, both real:
  - `openBrokerControl(stateDir)` TWICE — two separate calls, two TCP sessions, two leases
    (the connection IS the lease). Never share one session.
  - `session.acquire()` -> `{ ok:true, grant:{ id, port, url, epoch_file, supervisor_dir } }`.
  - Build a REAL `HeldLease` per session, production-shaped per `vice-proxy.ts:2198`:
    `{ host:"127.0.0.1", port: grant.port, targetId: grant.id, brokerControl: <the real
    session>, epochFile: grant.epoch_file, supervisorDir: stateDir }`. There must be NO
    stubbed broker control anywhere in this file — that stub
    (`CONFORMANCE_BROKER_CONTROL` in stock-live-triage.test.ts) is precisely the thing this
    proof exists to remove.
  - `StockDispatchDeps` per session: `ensureLease` returning that lease, plus `connect`/
    `reconnect` thin pass-throughs to the real `stockConnect`/`stockReconnect` that capture
    the session (same shape as `stock-live-triage.test.ts:316-337`). Call
    `clearHeldStockSession()` before and after each test.

Proof sequence, asserting against the broker's own `status` op between steps
(`session.status()`; `handleStatus()` reports per-instance `state` and `hasMonitorClient`):
  1. Session 1 acquires -> grant A on port P. `await dispatchStock("vice_diagnose", {},
     deps1)` so the REAL `stockConnect()` runs a REAL `claimMonitor(A)`. Assert the
     instance at P now reports `hasMonitorClient: true`.
  2. SIGKILL the emulator pid externally (read it from `<stateDir>/<P>/epoch.json`, or from
     `status`/the launch log — whichever this tree actually exposes; do not shell out to
     pgrep patterns that could match an unrelated x64sc). Never use the broker `recycle`
     op — see `<reachability_analysis>` point 4.
  3. Poll `status` (bounded, ~30s, 250ms interval) until an instance at port P reports
     `state: "ready"` and `hasMonitorClient: false` — i.e. the crash respawn happened and
     was promoted. On timeout, FAIL with the last `status` payload plus the broker's
     captured stderr.
  4. BONUS, free with this harness, and TIME-04's *second* named residual: before session 2
     claims, call `dispatchStock("vice_diagnose", {}, deps1)` once and RECORD what it
     answers. If it answers `verdict:"restarted"` with a real `baselineEpoch`/`currentEpoch`
     pair, that is the **broker-supervised** (not test-performed) respawn proof — assert it.
     If it answers anything else, record the exact answer in the assertion message and let
     that sub-assertion be the only thing that fails; do NOT stub, force, or reinterpret it,
     and do NOT let it mask step 6.
  5. Session 2 acquires. Assert `grantB.port === P`. If it is a different port, the
     reachability premise did not hold on this build — FAIL loudly with both ports and the
     `status` payload (never skip, never soften). Then `dispatchStock("vice_diagnose", {},
     deps2)` so grant B performs a real claim; assert `hasMonitorClient: true` again.
  6. The session whose claim came SECOND calls `dispatchStock("vice_diagnose", {}, deps)`.
     Wrap it in `Date.now()` bracketing and assert ALL of:
       - `verdict === "monitor_held_elsewhere"` (and explicitly NOT
         `"diagnosis_unavailable"`, asserted by name so a regression to the honest
         non-verdict is a visible failure);
       - `evidence.holderGrantId === <the other grant's real id>` (compare to the captured
         grant id — never a literal);
       - `evidence.holderClaimedAt` is a finite number > 0;
       - `evidence.port === P`;
       - elapsed < `10000` (`DEFAULT_DIAGNOSE_SESSION_TIMEOUT_MS`, `stock-diagnose.ts:347`),
         and print the measured elapsed so the SUMMARY can quote a real figure.
     Assert evidence keys additively-tolerantly (presence of the three keys above, absence
     of cost-bearing liveness keys) — the exact key set is pinned by the automated oracle
     below, per test-gate.mjs's standing rule. Do NOT re-assert an exact key set here; that
     is the trap quick task 260818-nh5 fixed.

Teardown in `finally`, assertion-safe and in this order: release both control sessions
(`session.release()` destroys the socket = the whole release); SIGTERM the broker child and
wait for exit, escalating to SIGKILL after ~3s (broker-e2e.test.ts's `stopBroker()`
precedent); then sweep every emulator pid this harness ever recorded (collect them as they
appear — at grant time and after each respawn — into a Set, never discovered by a global
process scan) with a best-effort `process.kill(pid, "SIGKILL")` and confirm death via
`process.kill(pid, 0)`; finally `rmSync(scratch, { recursive: true, force: true })`. Add a
last assertion at the end of the file's own final test that every recorded pid is gone, so
a leak fails as a test rather than as a stray process. WHAT NOT TO DO: never acquire a
child process, socket or temp dir outside `withBrokerHarness()`'s try/finally.

Gate registration, in THIS task (the guard and the list must never drift apart):
  - `test-gate.mjs`: add `"stock-live-broker-monitor.test.ts"` as the SIXTH
    `MANUAL_ONLY_TESTS` entry and update the header prose that currently says "exact five"
    / "five test files" to six, naming why this one qualifies (spawns a real broker daemon
    AND a real emulator, default-SKIP, never hangs).
  - `test-gate.test.ts`: add the new filename to the exact-contents `assert.deepEqual`
    array and rename that test from "...exactly the five dispositioned files" to six.
  - `stock-diagnose.test.ts`: add the standing-rule mirror — an automated shape oracle,
    modeled directly on the existing `test("handleDiagnoseStock (shape oracle): both
    restarted branches carry EXACTLY {baselineEpoch, currentEpoch, jamObserved}", ...)` at
    ~line 687 — asserting the `monitor_held_elsewhere` branch's evidence is EXACTLY
    `{holderGrantId, holderClaimedAt, port}` via a sorted `Object.keys` comparison, with a
    comment stating it exists so an additive widening reds HERE (zero emulator cost) before
    it can silently red the manual-only live suite.
  </action>
  <verify>
    <automated>cd .claude/mcp/vice && npx tsc --noEmit</automated>
    <automated>cd .claude/mcp/vice && node test-gate.mjs 2>&1 | tail -20   # 0 fail; the new suite must NOT appear in the run</automated>
    <automated>cd .claude/mcp/vice && node --test test-gate.test.ts stock-diagnose.test.ts 2>&1 | tail -15   # guard + new oracle green</automated>
    <automated>cd .claude/mcp/vice && node --test stock-live-broker-monitor.test.ts 2>&1 | tail -10   # default-skip: 0 fail, tests reported as skipped</automated>
    <automated>cd .claude/mcp/vice && grep -v '^//' test-gate.mjs | grep -c 'stock-live-broker-monitor.test.ts'   # must be >= 1 (code, not comment)</automated>
  </verify>
  <done>
`stock-live-broker-monitor.test.ts` exists, typechecks, default-skips with a named reason,
and contains no stubbed broker-control object. `test-gate.mjs` lists it sixth,
`test-gate.test.ts`'s exact-contents guard agrees, `node test-gate.mjs` is green and does
not execute it, and `stock-diagnose.test.ts` carries an exact-key-set oracle for the
`monitor_held_elsewhere` evidence.
  </done>
</task>

<task type="auto">
  <name>Task 2: Run the live proof on both real stock binaries and record the honest transcript</name>
  <files>.planning/quick/260818-obc-live-prove-the-broker-mediated-monitor-h/260818-obc-SUMMARY.md</files>
  <action>
Run the opt-in suite against BOTH genuine stock binaries, fresh, capturing full TAP output
plus the broker's stderr on any failure:
  - VICE 3.9:  `VICE_LIVE_BROKER_BIN=/usr/bin/x64sc`
  - VICE 3.10: `VICE_LIVE_BROKER_BIN=/usr/local/bin/x64sc`

Iterate on the harness (Task 1's file) until it either passes or is proven unable to. Only
these are legitimate reasons to change an ASSERTION rather than the harness: the observed
broker behaviour genuinely differs from `<reachability_analysis>` (record the source
evidence), or the refusal direction is the opposite one (which the test already tolerates
by design). Never weaken an assertion to make a run go green.

Record in the SUMMARY, verbatim: the measured elapsed ms for the refused `vice_diagnose`
call on each binary, the real `holderGrantId` observed and which grant it belonged to, the
port, the `status` payload showing both grants on the same port, and the step-4 answer
(whether the broker-supervised `restarted` half was proven too, or exactly what it answered
instead). Also record `ps` / `pgrep` evidence that nothing survived.

HONESTY GATE — the whole point of this task. If the run does not produce
`verdict:"monitor_held_elsewhere"` with the other grant's real id on at least one genuine
stock binary, STOP HERE. Do not start Task 3. Write the SUMMARY with the observed
transcript, the exact blocking reason, and the source evidence for it, and leave every
record document claiming the gap is still open. A document recording a pass that did not
happen is the failure this phase has already committed repeatedly; an honest recorded
failure is a successful outcome of this task.
  </action>
  <verify>
    <automated>cd .claude/mcp/vice && VICE_LIVE_BROKER_BIN=/usr/bin/x64sc node --test stock-live-broker-monitor.test.ts</automated>
    <automated>cd .claude/mcp/vice && VICE_LIVE_BROKER_BIN=/usr/local/bin/x64sc node --test stock-live-broker-monitor.test.ts</automated>
    <automated>pgrep -af '[x]64sc' ; pgrep -af 'vice-broker\.mjs' ; echo "sweep-exit=$?"   # both listings must be empty</automated>
    <automated>cd .claude/mcp/vice && node test-gate.mjs 2>&1 | tail -5   # still green after any harness iteration</automated>
  </verify>
  <done>
Either (a) both binaries report the broker-mediated `monitor_held_elsewhere` verdict with
the other grant's real evidence inside the 10000ms bound, no stray processes, and the
measured figures are written into the SUMMARY; or (b) the proof is recorded as NOT achieved
with its transcript and blocking reason, Task 3 is skipped entirely, and no record document
is edited to claim otherwise.
  </done>
</task>

<task type="auto">
  <name>Task 3: Correct the stale records — TIME-04, 07-REVIEW status, STATE.md — strictly following Task 2's transcript</name>
  <files>.planning/REQUIREMENTS.md, .planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md, .planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md, .planning/phases/07-cycle-timing-and-wedge-triage/07-UAT.md, .planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md, .planning/STATE.md, .claude/skills/vice-wedge-triage/SKILL.md</files>
  <action>
Gate: perform the TIME-04 edits ONLY if Task 2 recorded a genuine pass. The two
record-hygiene edits at the end (07-REVIEW status, STATE.md) are unconditional — they
correct facts already established independently of this proof.

TIME-04 (explicit scope decision, do not silently drop half of it). TIME-04's text names
TWO unit-only residuals: the broker-mediated `monitor_held_elsewhere` verdict AND a
broker-supervised (vs. test-performed) `restarted` respawn. Both are covered by this
harness (step 6 and step 4 respectively). Therefore:
  - BOTH proven in the same run -> flip `.planning/REQUIREMENTS.md` line ~94 to `[x]` and
    the coverage row at line ~220 to `Complete (07-15, 07-16, 07-17, quick-260818-obc)`,
    citing the measured evidence (elapsed ms, real holder grant id, both epochs). Then fix
    the counts that reference TIME-04 as open — the open-item line at ~240 and the
    per-phase open count at ~252 ("Phase 7: **1** (`TIME-04` only ...)") — do not leave a
    stale figure behind, which is the exact defect those lines already carry a correction
    note about.
  - ONLY the `monitor_held_elsewhere` half proven -> TIME-04 stays `[ ]` / `Partial`, with
    its text NARROWED to name the single surviving residual (broker-supervised `restarted`)
    and the newly-closed half cited. Say plainly in the SUMMARY that this is a deliberate
    decision, not an oversight.

`07-VALIDATION.md`: update the Manual-Only row at line ~131 with the measured broker-
mediated result (keep its existing socket-level ~1501-1502ms history — append, never
overwrite). Re-read the whole Manual-Only table plus the checklist lines ~145/~150/~163;
set `nyquist_compliant: true` in the frontmatter ONLY if this was genuinely the last open
row and nothing else in that table is still PARTIAL. If anything else is open, leave it
`false` and say which row holds it.

`07-VERIFICATION.md`: move the `human_verification` item into `gaps_closed` (or add a dated
resolution note beside it) with the real transcript, and update `status:`/`score:`
accordingly. Preserve the existing narrative including the stale-evidence reproduction note
— append history, never erase it. Update truth 3's row and the Live Verification table with
the new command and figures.

`07-UAT.md` test 9 (~line 157): append the broker-mediated result to its scope note, keeping
the distinction between the socket-level bound (already proven) and the verdict (now
proven) explicit.

`.claude/skills/vice-wedge-triage/SKILL.md`: update the Provenance row at ~line 213 —
upgrade the confidence grade for whichever paths are now live-proven, naming the new
command and binaries, and keep the honest MEDIUM/unit-only wording for anything still
unproven (the run_until honesty fields stay unit-only regardless). No blanket claim.

`07-REVIEW.md` (unconditional): line 48 `status: issues_found` -> `status: issues_resolved`,
adding adjacent frontmatter keys `previous_status: issues_found` and
`resolved_by: 07-REVIEW-FIX.md (all_fixed, 20/20)`. Do not delete or reword any finding
body — history is preserved, only the status verdict changes. Cite the two independently
verified fixes: `CAPABILITY_SCHEMA_VERSION = 2` (`backend-detect.mts:224`) and the
wire-vs-`decode_failure` discrimination (`stock-connect.ts:164`).

`.planning/STATE.md` (unconditional): rewrite `last_activity` so it no longer implies an
open code-review blocker (that blocker is resolved per 07-REVIEW-FIX.md), state this quick
task's real outcome, and add the `260818-obc` row to the Quick Tasks Completed table with
its commit. Leave the genuinely-still-open Blockers/Concerns entries alone.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && grep -n 'TIME-04' .planning/REQUIREMENTS.md   # checklist + coverage row agree with each other and with the transcript</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && grep -n '^status:\|^previous_status:\|^resolved_by:' .planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && grep -n 'nyquist_compliant' .planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md</automated>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && grep -n 'last_activity' .planning/STATE.md</automated>
    <automated>cd .claude/mcp/vice && node test-gate.mjs 2>&1 | tail -5 && npx tsc --noEmit</automated>
  </verify>
  <done>
Every record document's claim about the broker-mediated `monitor_held_elsewhere` verdict
matches Task 2's actual transcript — no document claims more than was observed, and none
still claims the gap is open if it was closed. `TIME-04`'s marking, `nyquist_compliant`, the
SKILL.md provenance grade and the REQUIREMENTS open-counts are mutually consistent.
07-REVIEW.md's status reads resolved with its history intact, and STATE.md no longer implies
an open code-review blocker.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> broker control plane (TCP) | Token-gated newline JSON; this test is a real client of it |
| broker -> spawned x64sc | Unauthenticated binary monitor = full machine control |
| harness -> host process table | The harness sends real SIGKILL/SIGTERM signals |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-obc-01 | Tampering | binmon/control bind address | mitigate | 127.0.0.1 only — `VICE_BROKER_BINMON_HOST` left at its default, `VICE_BROKER_CONTROL_PORT=0` on loopback; never 0.0.0.0 |
| T-obc-02 | Denial of Service | host process table | mitigate | Only pids this harness itself recorded are signalled, collected into a Set at grant/respawn time; never a pattern-matched global process scan that could kill a developer's own x64sc |
| T-obc-03 | Denial of Service | real project state dir | mitigate | Broker runs with `--state-dir <mkdtemp>` and `XDG_CONFIG_HOME=<mkdtemp>`; the real `.vice-supervisor/` and the shared `vicerc` are never read or written |
| T-obc-04 | Repudiation | phase records | mitigate | Task 2's honesty gate: no record edit without a transcript; Task 3 is gated on it |
| T-obc-05 | Denial of Service | leaked processes on assertion failure | mitigate | Single `withBrokerHarness()` try/finally owns every child and socket; final test asserts every recorded pid is dead |
| T-obc-SC | Tampering | npm/pip/cargo installs | mitigate | No new dependencies are installed by this plan; nothing to audit |
</threat_model>

<verification>
- `cd .claude/mcp/vice && npx tsc --noEmit` -> exit 0
- `cd .claude/mcp/vice && node test-gate.mjs` -> 0 fail, new suite absent from the run
- `cd .claude/mcp/vice && node --test stock-live-broker-monitor.test.ts` -> default-skip, 0 fail
- `cd .claude/mcp/vice && VICE_LIVE_BROKER_BIN=/usr/bin/x64sc node --test stock-live-broker-monitor.test.ts`
- `cd .claude/mcp/vice && VICE_LIVE_BROKER_BIN=/usr/local/bin/x64sc node --test stock-live-broker-monitor.test.ts`
- `pgrep -af '[x]64sc'` and `pgrep -af 'vice-broker\.mjs'` -> both empty after every run
</verification>

<success_criteria>
- The broker-mediated `monitor_held_elsewhere` verdict is either live-proven with a real
  transcript (holder grant id, claimedAt, port, elapsed < 10000ms) on genuine stock VICE,
  or honestly recorded as not achieved with its blocking reason.
- No record document claims more than the transcript shows.
- `node test-gate.mjs` and `npx tsc --noEmit` stay green; the gate's list and its drift
  guard agree; the new suite's payload shape has an automated mirror.
- Zero stray `x64sc` or `vice-broker.mjs` processes, including on assertion failure.
</success_criteria>

<output>
Create `.planning/quick/260818-obc-live-prove-the-broker-mediated-monitor-h/260818-obc-SUMMARY.md` when done
</output>
