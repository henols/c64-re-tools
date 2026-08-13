---
phase: 02-stock-backend-connection
fixed_at: 2026-08-13T13:05:00Z
review_path: .planning/phases/02-stock-backend-connection/02-REVIEW.md
iteration: 1
findings_in_scope: 20
fixed: 20
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-08-13T13:05:00Z
**Source review:** `.planning/phases/02-stock-backend-connection/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 20 (7 Critical + 13 Warning; the 5 Info findings are outside `fix_scope: critical_warning`)
- Fixed: 20
- Skipped: 0

Every finding was verified against the source before being fixed; none was applied
blind. Two of the review's own claims turned out to be inaccurate in detail and are
corrected below (WR-12's "writeUInt32LE(NaN) throws", and one test I wrote against a
type-violating stub) — the findings themselves were still real.

**Verification** (all in the isolated worktree, then re-confirmed on `main` after
the fast-forward):

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `node build.ts` | no `resources/` drift |
| `npm run test:automated` | **557 tests, 552 pass, 0 fail** (baseline before these fixes: 470 tests, 0 fail) |
| `node scripts/check-npm-packages.mjs` | exit 0 (30 / 35 files, 6 skills) |
| `tools-manifest.json` | byte-identical to `main` — the fork's advertised list is unchanged |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | untouched |

Net **+87 tests**, zero regressions. Every fix is its own commit; 20 commits,
`e0ae0b6..312088f`.

## Fixed Issues

### CR-01: `parseResponse()` reads wire-controlled offsets unchecked

**Files modified:** `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
**Commit:** `e0ae0b6`
**Applied fix:** Added a `need()` bounds guard and a preceding call for every offset
read in every `case`, so `parseResponse()` is provably total and a short body raises
the documented `StockFramingError` instead of a `RangeError`. `DISPLAY_GET` validates
`info_len` and `buflen` against the real body length. `parseBuffer()` no longer
re-throws an undocumented error either — it logs the defect loudly on stderr and
reports it through the same channel, consuming the frame so the same bytes cannot
re-raise on every chunk. 15 new tests cover all four reproduced shapes plus five
more, and one asserts a short frame no longer destroys a valid frame beside it.

### CR-02: the stock handshake halts the emulated machine and never resumes it

**Files modified:** `.claude/mcp/vice/stock-connect.ts`, `.claude/mcp/vice/stock-connect.test.ts`
**Commit:** `7f038f4`
**Applied fix:** The handshake now ends with `EXIT` (0xaa), after the capability
probe, **inside the try** — a handshake that cannot prove it resumed the machine is a
failed handshake, not a success with a frozen C64. The failure path best-effort
resumes too, guarded by a `resumeAttempted` flag so a resume that already failed is
not retried into a second timeout. The `RESUMED` (0x63) event is deliberately left to
the request-id-first demux's `event` channel and not awaited.

The stub responder gained an `EXIT` arm modelling both the reply and the unsolicited
`RESUMED` — without it the stub encoded an emulator that never resumes, i.e. the
defect. Per the orchestrator's instruction, the tests assert on **bytes that reached
the wire**: exactly one `EXIT`, sent last, after the probe; present on the
capability-cache-hit path too; and a handshake whose `EXIT` goes unanswered fails
rather than returning a session.

### CR-03: `monitor_claim`/`monitor_release` accept any `target_id`

**Files modified:** `.claude/mcp/vice/broker-control.mts`, `.claude/mcp/vice/resources/broker-control.mjs`, `.claude/mcp/vice/broker-control.test.ts`, `.claude/mcp/vice/vice-broker-client.ts`, `.claude/mcp/vice/vice-broker-client.test.ts`
**Commit:** `0592b5a`
**Applied fix:** All three target-naming ops (`recycle`, `monitor_claim`,
`monitor_release`) now share one `ownsTarget()` predicate, so they cannot drift apart
again. `claimMonitor()` also carries `"denied"` as its own reason rather than
collapsing it into `"internal"`, so a wiring bug stays distinguishable from a broker
fault.

**Tests that encoded the defect (updated, not weakened):** `broker-control.test.ts`
had six cases that sent a `target_id` over a connection which had never acquired
anything and were served — the spoofable shape, asserted as the contract. They now
acquire first (the production sequence). `vice-broker-client.test.ts` had four more
with the same shape; two of them (`monitor_owned`, `denied`) would otherwise have kept
passing while silently no longer testing the broker-side refusal they name. New
coverage: claim B / release B while holding A, no grant at all, and after an explicit
`release` — each asserting the broker callback never runs, so `instance.monitorClient`
is provably unmutated.

### CR-04: the startup reap kills a recorded pid with an always-matching guard

**Files modified:** `.claude/mcp/vice/broker-kill.mts`, `.claude/mcp/vice/resources/broker-kill.mjs`, `.claude/mcp/vice/broker-kill.test.ts`
**Commit:** `18120ee`
**Applied fix:** Both layers refuse, deliberately (removing either leaves the other
standing). `verifiedKill()` returns `identity_refused` for an empty identity *before
it even reads the argv*; `reapOrphanedInstances()` does not treat such a record as a
kill candidate at all — not counted in `found`, kill dep never invoked, skip logged by
port. The epoch bump still runs, so a registry-free restart still voids every in-band
directory. A test spawns a real `/bin/sleep`, records its pid with `vice_bin: ""`, and
asserts the process survives and the kill dep was never called.

### CR-05: a replaced lease drops a live binmon session without disconnecting it

**Files modified:** `.claude/mcp/vice/stock-dispatch.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`
**Commit:** `ff4f2df`
**Applied fix:** The replaced session goes through `stockDisconnect()` — the one
teardown that disconnects the socket *and* releases the monitor claim together. The
holder is cleared first, and a teardown failure on the outgoing session is logged
rather than failing the replacement handshake. The fake session's client gained a real
`disconnect()` so the tests can tell a teardown from a dereference; they assert the
stale client ends up disconnected and exactly one `releaseMonitor` names the **old**
`targetId`.

### CR-06: `StockConnectDeps` is never wired in production

**Files modified:** `.claude/mcp/vice/stock-dispatch.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`, `.claude/mcp/vice/vice-broker-client.ts`, `.claude/mcp/vice/vice-proxy.ts`
**Commit:** `f07ba5a`
**Applied fix:** `HeldLease` gained `epochFile` and `supervisorDir` as **required**
fields, so the one production construction site cannot silently omit them again.

One deviation from the review's suggested fix, deliberately: it proposed taking
`supervisorDir` from the grant's own `supervisor_dir`. That is the **per-instance**
directory (`<stateDir>/<port>`, where `epoch.json` lives), while `backend.json` lives
in the **top-level** `.vice-supervisor`. Using the grant's field would have pointed
`readCapabilityRecord()`/`writeCapabilityRecord()` at a directory that never has a
record in it — a silent permanent cache miss, i.e. the finding unfixed. It is resolved
through `brokerRootDir()` instead, the same resolver `broker.json` is read from.

Per the environment constraint, tests stay on stubs — except one that drives the
**real** `stockConnect` through `ensureStockSession()` against a loopback binmon stub
and asserts `baselineEpoch === 7`, because the defect was precisely that the real
function never received `deps`, so a fully stubbed `connect` cannot see it.

### CR-07: `vice_diagnose` is advertised on stock but dispatches through the fork's HTTP transport

**Files modified:** `.claude/mcp/vice/vice-proxy.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`
**Commit:** `b5b6c61`
**Applied fix:** **Premise verified before changing dispatch**, as instructed. All
three synthetic tools are in *neither* manifest, so the manifest loop's backend-aware
choice never covered them; they were registered unconditionally after it; `tools/list`
is served from that same object. `handleDiagnose()` reaches `ensureViceSession()` /
`gatherCheckpointTrapEvidence()` / `gatherBracketEvidence()`. The finding is real —
and broader than stated: **`vice_recycle` has the same defect** via
`gatherWedgeEvidence()`, and is fixed with it.

Both now register through one `buildBackendAwareTool()` seam, so on stock they are
answered or refused **by name** through `dispatchStock` — and there is still exactly
**one** `dispatchStock(` call site. `vice_result_continue` stays backend-independent:
`handleResultContinue()` reads only the proxy's own `CONTINUATION_STORE` and opens no
socket. That exception is now asserted by name rather than left to judgement.

**Test that encoded the defect (replaced):** the old structural oracle only checked
that no code *line* pairs the string `"stock"` with `forwardToVice` — which the
defective arrangement satisfied while still reaching that transport. It is replaced by
assertions on the registration seam itself: every registration whose runner can touch a
transport goes through `buildBackendAwareTool`, exactly one bypasses it, and that one's
handler body contains no transport reference.

### WR-01: stock instances can never be promoted to `ready`

**Files modified:** `.claude/mcp/vice/broker-launch.mts`, `.claude/mcp/vice/vice-broker.mts`, `.claude/mcp/vice/resources/broker-launch.mjs`, `.claude/mcp/vice/resources/vice-broker.mjs`, `.claude/mcp/vice/broker-launch.test.ts`
**Commit:** `c39c744`
**Applied fix:** `probeReady()` takes `backend`, threaded from the same single
`resolvedBackend()` verdict `buildViceArgs()` already receives. On stock it opens the
binmon socket, sends one `PING` and requires a **well-formed** 0x81 reply (STX,
api_version, response type, error code, and its own request id), then sends `EXIT` and
closes with `socket.end()` so the bytes are actually delivered — the `PING` itself
halts the machine, so a probe that left every warm instance "ready and frozen" would
be worse than the defect. The socket is always released (one client slot).

The fork arm is byte-identical, including the omitted-backend default, asserted
directly. The wire bytes are hand-built in `broker-launch.mts` because a host-bound
`.mts` cannot value-import a `.ts` module (TS5097); the probe decodes no bodies and
correlates no ids, so it is not a second demux — the constraint and the reason are
documented at the code. 12 new tests drive the real probe against a loopback stub:
ready, silent accept, wrong error code, wrong response type, wrong request id, wrong
api_version, nothing listening, and the client slot being released afterwards.

### WR-02: a timed-out or write-failed request is not marked settled

**Files modified:** `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
**Commit:** `3bbc6c1`
**Applied fix:** Both abandonment paths go through one named `#abandonPending()`
(delete + `#markSettled()`), so neither can drift back into a bare delete. A late reply
for a timed-out request now increments `counters.duplicateReplies` and emits no
`event`.

### WR-03: `MAX_BODY_LEN` doubles as the buffered-byte cap

**Files modified:** `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
**Commit:** `abb3d5f`
**Applied fix:** Introduced `MAX_BUFFERED_LEN` (header + max body + slack) for the
accumulation check, which only trips when the remainder does **not** begin with a
plausible in-progress frame header. Both buffer-reset paths now reject in-flight
requests with the `StockDesyncError` through a new `#rejectAllPending()` that
deliberately does **not** latch `#closed` the way `#failAllPending()` does — a desync
leaves the socket usable.

**Test that encoded the defect (replaced):** the existing test required a
`StockDesyncError` for a legitimate frame declaring a `MAX_BODY_LEN` body delivered in
pieces. That is the defect stated as the contract. The same stream must now be
reassembled and parsed exactly once with zero desync bytes.

### WR-04: the proxy's local backend verdict can silently disagree with the broker's

**Files modified:** `.claude/mcp/vice/broker-control.mts`, `.claude/mcp/vice/vice-broker.mts`, `.claude/mcp/vice/vice-broker-client.ts`, `.claude/mcp/vice/vice-proxy.ts`, `.claude/mcp/vice/resources/*.mjs`, four test files
**Commit:** `312088f`
**Applied fix:** `host_state` now carries the broker's own verdict — the authoritative
one, since it is what the emulator was launched with — narrowed at the client boundary
to the two known values or `null`. `ensureBrokerLease()` reads it on a freshly opened
control session, **before** the acquire, and refuses a definite mismatch with a message
naming both verdicts, both binaries, which protocol would be spoken at which endpoint,
why the broker wins, and that `VICE_BACKEND` must be set for **both** processes. The
session is released rather than leaked. Absent evidence is not disagreement: an older
broker, an unrecognised value, or a failed `hostState()` logs and proceeds.

This is the finding's **"at minimum"** option, not its preferred one. See
*Deliberately not done* below for what is left standing and why.

### WR-05: `binPath` is the unresolved command name

**Files modified:** `.claude/mcp/vice/backend-detect.mts`, `.claude/mcp/vice/resources/backend-detect.mjs`, `.claude/mcp/vice/backend-detect.test.ts`, `.claude/mcp/vice/stock-dispatch.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`, `.claude/mcp/vice/vice-proxy.ts`
**Commit:** `eff4f18`
**Applied fix:** `binPath` is now the resolved absolute path whenever the binary can be
resolved, derived in one place (`binPathFields()`) so the four return paths cannot
disagree. The override path resolves too — resolution is a filesystem lookup, never a
spawn, so it keeps its "answered fresh, spawns nothing" property (asserted).
`probeBackend()` deliberately still receives the **unresolved** name so the OS's own
PATH search happens as it would for a real invocation; that distinction is asserted
rather than left implicit. Rather than silently redefining the field, the answer also
carries `binPathResolved` → `vice_ping`'s `resolvedBinaryPathIsResolved`, defaulting to
`false`. Both misleading doc comments are corrected.

### WR-06: the default stock binmon bind is unreachable, with no diagnostic

**Files modified:** `.claude/mcp/vice/stock-dispatch.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`, `.claude/mcp/vice/vice-proxy.ts`
**Commit:** `5285db7`
**Applied fix:** `convertHandshakeError()` special-cases a connect refusal (also
`EHOSTUNREACH`/`ENETUNREACH`), still quoting the underlying error verbatim, and names
`VICE_BROKER_BINMON_HOST`, the loopback default, *why* the default is loopback, and
that the broker must be restarted for a new bind address to take effect. A non-connect
failure keeps the plain wording, so the advice is not sprayed over unrelated causes.
Separately, the IPv6 bracket form is stripped where the dial host is derived; the URL
quirk itself is asserted for real against the same parser.

### WR-07: the cleanup path can replace the original failure

**Files modified:** `.claude/mcp/vice/stock-connect.ts`, `.claude/mcp/vice/stock-connect.test.ts`
**Commit:** `9fe70b7`
**Applied fix:** Both release outcomes (`{ ok: false }` and a throw) are reported on
stderr naming the target, and neither can displace the original error. Tests drive both
and assert the caller still sees the `StockFramingError` carrying the observed
api_version.

### WR-08: a malformed `holder` payload downgrades `monitor_owned` to `internal`

**Files modified:** `.claude/mcp/vice/vice-broker-client.ts`, `.claude/mcp/vice/vice-broker-client.test.ts`, `.claude/mcp/vice/broker-control.mts`, `.claude/mcp/vice/resources/broker-control.mjs`
**Commit:** `85462fd`
**Applied fix:** The `monitor_owned` reason survives an unusable holder, with fields
defaulted to `unknown`/`0`/`null` — admitted as unknown, never fabricated as a
plausible grant id, and never coerced from a truthy non-boolean.

**Found while testing this, and fixed with it:** the broker's `monitor_owned` writer
dereferenced `outcome.holder` unguarded inside `socket.on("data")` with no `try/catch`
above it, so a producer that ever omitted the (type-required) field would throw a
`TypeError` out of the control listener and take the broker process with it. A type
contract is not a runtime guarantee at a wire boundary.

### WR-09: `REGISTER_INFO` parsed with a hardcoded 4-byte stride

**Files modified:** `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
**Commit:** `d9a6c37`
**Applied fix:** Both register cases now read the stride from the wire's own
`item_size`. Tests cover the ordinary 3-byte item, items declaring a larger
`item_size` (the shape the hardcoded stride got wrong), the two cases agreeing on the
stride rule, and a body truncated mid-item being a returned `StockFramingError` rather
than a partial array.

### WR-10: `binmon-fixtures.ts` claims the three fixtures are real captures

**Files modified:** `.claude/mcp/vice/binmon-fixtures.ts`, `.claude/mcp/vice/binmon-fixtures.test.ts`
**Commit:** `f5c4645`
**Applied fix:** The header states the actual provenance (spec-synthesized under the
2026-08-13 D-19 override) and points at the re-capture todo. `loadCapturedFixture()`
returns `synthetic` as a real boolean — opt-in, never coerced from a truthy
non-boolean, so no default can quietly promote a synthetic fixture to a recorded one.
A corrupt or non-object sidecar now raises the same named `MissingFixtureError`
(naming the regenerate command) as an absent or incomplete one. **No fixture was
relabelled as recorded**, per the environment constraint.

### WR-11: `probe-binmon.mjs`'s sidecar selftest is vacuous

**Files modified:** `.claude/mcp/vice/probe-binmon.mjs`
**Commit:** `3060c00`
**Applied fix:** The construction is extracted as a pure
`buildSidecar({ capturedFrom, viceVersion, caseName, now })`, which `runCapture()` now
calls, and the selftest asserts on **its** output. It also asserts the impossible cases
are impossible: an unknown case name and an empty `capturedFrom` both throw at
construction rather than writing a sidecar with `command: undefined`, which survives
`JSON.stringify` and then fails `loadCapturedFixture()` much later, in another process,
against a `.bin` that looks fine. `node probe-binmon.mjs --selftest` passes.

### WR-12: `clampCpuHistoryCount()` has no lower or NaN bound

**Files modified:** `.claude/mcp/vice/stock-connect.ts`, `.claude/mcp/vice/stock-connect.test.ts`
**Commit:** `9be0648`
**Applied fix:** Bounded across the whole numeric domain: non-finite → 0, floor 0,
ceiling 65535, fractional truncated. Exported, so the guard its own doc comment
advertises for "any future caller of this same request shape" is reachable rather than
a private clamp a second call site would re-derive. One test asserts every clamped
value across the hostile corpus is a legal `writeUInt32LE` argument.

**Correction to the finding:** it states `body.writeUInt32LE(NaN, 1)` throws. On this
Node (v22.22.0) it does **not** — it silently writes 0. The genuinely throwing input is
a *negative* count. Both behaviours are now asserted so the reason for the guard is
recorded accurately: NaN's hazard is a silent coercion nobody chose, not an exception.
The finding is still real; only its stated mechanism was wrong.

### WR-13: `connect()` timeout path and silent socket replacement

**Files modified:** `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
**Commit:** `09d762d`
**Applied fix:** (a) A no-op `error` listener stays attached to the abandoned socket
for its remaining lifetime, so a post-`destroy()` `error` lands somewhere instead of
reaching the proxy's never-throw global handler as an unexplained stderr incident.
(b) A `connect()` over a live socket is refused, naming the port already held and
directing the caller to `disconnect()` first; after a `disconnect()`, `connect()` is
permitted again. The unhandled-`error` half is asserted with a real
`uncaughtException` listener against a non-routable TEST-NET-3 address.

## Notes and residual risk

### Project constraints upheld
- Demux still keys on request id first; no case inspects response type before id.
- `JAM` (0x61) still parses a zero-length body to `programCounter: null`.
- `CPUHISTORY_GET` counts clamped to 65535 (and now also at the lower bound).
- The single-client binmon invariant is now *better* protected in three places
  (CR-05's teardown, WR-13's connect refusal, WR-01's probe releasing its slot).
- D-09 holds: exactly one `dispatchStock(` call site; nothing on the stock path
  reaches `forwardToVice()`.
- The fork path is unchanged and `tools-manifest.json` is byte-identical to `main`.
- The broker's `inFlight` guard was not touched; nothing was added inside it.
- No `enum` introduced; no `.mts` value-imports a `.ts`.
- Every changed `.mts` was recompiled with `node build.ts`; `resources-sync.test.ts`
  passes with no drift.

### Coverage limitation (as instructed)
`vice-proxy.test.ts` **hangs in this environment** and is outside the automated gate,
so it was not run. Four findings changed `vice-proxy.ts` (CR-06, CR-07, WR-04, WR-06).
Each is covered by assertions inside `stock-dispatch.test.ts`'s structural section,
which *is* in the gate — following the precedent 02-10 set. Those cover:
`buildHeldLease()`'s two threaded directories and the IPv6 bracket strip; the
registration seam and every runner that can touch a transport; and
`ensureBrokerLease()`'s mismatch check running before the acquire and releasing the
session. One `vice-proxy.test.ts` stub was updated for the new required
`HostStateFields.backend` (typecheck-verified only, not executed).

### Deliberately not done, recorded rather than dropped
- **WR-04's preferred fix** — having the proxy *learn* its backend from the broker
  rather than probing locally — would require an async control-plane round trip before
  `tools/list` is built at module scope, ahead of `startStdio()`. That is a
  startup-architecture change, not a review fix, and it would touch the zero-await
  window the proxy's own comments call load-bearing. The "at minimum" refusal was
  implemented instead.
- **WR-04's secondary point** — up to three blocking 5 s `spawnSync` probes during
  stdio-server module init — is left standing. Removing local detection would trade a
  working capability (host-native auto-detection) for startup latency, and the
  mismatch check now catches the case that latency was buying.
- **WR-03's reset branch is unreachable by construction** now that the cap is correct:
  `parseBuffer()`'s remainder is always either under 12 bytes or a plausible
  in-progress frame, so it can never exceed `MAX_BUFFERED_LEN`. The branch and its
  `#rejectAllPending()` call are retained as a defensive backstop and are therefore
  covered only indirectly; the same rejection *is* wired to the reachable
  unexpected-throw backstop in `#onData()`.
- **No live validation.** Per the user's ruling, nothing here was run against a real
  emulator: no `x64sc` was spawned, no real binmon port dialled. Every new test uses a
  loopback stub or an injected stub. The synthetic fixtures were **not** relabelled;
  WR-10 moved their documentation in the opposite direction.

### Test-environment note
Fixes were made in an isolated worktree under `/tmp`, where two `containerpath.test.ts`
cases fail for location reasons (`hostRootCandidates()` finds no workspace marker
there). Confirmed pre-existing and environmental: they pass in the repo before and
after these changes. The gate on `main` after the fast-forward is **557 tests, 552
pass, 0 fail**.

---

_Fixed: 2026-08-13T13:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
