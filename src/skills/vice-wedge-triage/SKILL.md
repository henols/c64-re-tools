---
name: vice-wedge-triage
description: Decide whether a VICE emulator that has stopped responding is genuinely wedged, stopped itself at your own checkpoint, crashed and respawned, or merely paused — and what is safe to do about each. Use when asked why the emulator is stuck, frozen, hung, wedged, dead or not advancing, when a cycle bracket reads zero, when vice_ping says running but nothing happens, when a checkpoint never fires, when deciding whether to recycle or restart VICE, or when a run has to be voided and its evidence recorded.
---

# Triage a VICE that stopped moving

**Five states look identical from outside, and the intuitive correction destroys a healthy machine
in more than one of them.** Work the order below. Do not start with a remedy.

| State | Cheap tell | Safe action |
|---|---|---|
| **Merely paused** | Any state read pauses the machine and does not resume it | Resume once. Nothing is wrong |
| **Stopped itself at your checkpoint** | An armed *stopping* checkpoint on the live IRQ path | Delete/disable the checkpoint. **Never recycle** |
| **Crashed and respawned** | The proxy raises epoch drift on the next forwarded call | Void the run, reboot from scratch. Already handled for you |
| **Genuinely wedged** | Two consecutive cycle brackets read exactly `0` | `vice_recycle` with a reason, as a last resort |
| **Contended between the two channels** | Two brackets would read zero, but `evidence.channelContention.held` is true and `bracketsRun` is 0 | Wait for the other channel's operation to finish, or find its holder. **Never recycle** — the instance is healthy and is answering |
| **Monitor held elsewhere** | A second client already holds this instance's single binary-monitor socket | Find the other holder. **Never recycle** — the instance is healthy, just claimed elsewhere |

```
mcp__plugin_c64-re-tools_vice__vice_diagnose        # one call, no arguments, answers which state it is
```

`vice_diagnose`'s verdict vocabulary is `restarted`, `checkpoint_trap`, `wedged`,
`monitor_held_elsewhere`, `live`. The binary monitor services exactly one client, so a second
connection sits unserviced in the backlog with no reply and no EOF — a state that looks exactly
like a wedge unless `vice_diagnose` names it as `monitor_held_elsewhere`. Read the tool's own
schema for the exact contract: `tools/list`'s advertised schema is the real manifest entry.
`vice_diagnose` can also answer a `diagnosis_unavailable` outcome when no verdict could be
established at all. That is **not** a sixth verdict. See the table below.

## The order

1. **Call `vice_diagnose` first.** It runs the checks in the cheap-to-expensive order and stops at
   the first that fires: the epoch comparison costs zero emulator calls, the checkpoint-trap check
   costs three reads and **no resume**, and only then does it measure a cycle bracket.
2. **Read the verdict, not the vibe.** Each verdict has exactly one correct response — the table
   below. A verdict is not a suggestion to try things.
3. **`diagnose` leaves the machine paused** when it ran a bracket. Resuming is your own next call.
   Do not treat "still paused afterwards" as a symptom. Every established verdict also reports
   `machinePaused` plus `machinePausedSource` (07-15). These fields let you tell an actual
   observation from an inference. `observed` means a wire `stopped`/`resumed`/`jam` event directly
   reported the state. `structural` means the diagnosis inferred the state. It used the fact that
   every stock read stops the machine, not a specific event. `no_session` means no session was
   ever obtained — for example, the `monitor_held_elsewhere` verdict, or a `diagnosis_unavailable`
   acquisition failure. In that case, the answer makes no claim about pause state at all.
4. **If the verdict is `wedged`, capture evidence before recovering.** `vice_recycle` requires a
   `reason`. It writes that string verbatim into a permanent incident record under
   `.c64-re-tools/incidents/` **before the recycle kills anything**. That record is the evidence
   capture — there is no separate ritual to perform, and a lazy `reason` is a lost incident.
5. **Recycling changes the restart epoch.** Any run in flight is void. Resume from the last
   recorded milestone snapshot, never from where the wedge happened.

## Verdict → response

| Verdict | What it means | Do |
|---|---|---|
| `live` | Cycles advanced | Resume and carry on. Suspect your own checkpoint conditions, not the emulator — **unless `evidence.jamObserved` is true, or `evidence.channelContention.held` is true** (both below) |
| `checkpoint_trap` | The machine stopped **itself** at an armed checkpoint | `vice_checkpoint_delete` or `vice_checkpoint_toggle` it, or `vice_execution_step` past it, then re-run `diagnose`. **Recycling here destroys a healthy instance** |
| `restarted` | The epoch changed — a crash-and-respawn already happened | The run is void. `c64-ram-capture` § Void a run gives the artifact procedure. Reboot from `vice_disk_attach` |
| `monitor_held_elsewhere` | A different client already holds this instance's single binary-monitor slot | Release or identify the other holder. **Never a reason to recycle** — recycling here destroys an instance that is not even wedged |
| `wedged` | Two brackets, zero cycles, no epoch change | Last resort: `vice_recycle` with a real reason — **but check `evidence.jamObserved` first** (below). `wedged` is structurally unreachable while `evidence.channelContention.held` is true — reaching `wedged` at all means no monitor channel held halt authority when the brackets ran |
| `diagnosis_unavailable` **(non-verdict outcome — not one of the five)** | No verdict could be established at all; the message starts `vice_diagnose: diagnosis_unavailable (<reason>)`. The machine's state is **UNKNOWN**, not any of the five above | **Do not recycle on this answer alone.** Read the reason class in the message and act on it — see below |

### `evidence.jamObserved` — read it before acting on `wedged` *or* `live`

Every `vice_diagnose` verdict carries `evidence.jamObserved` (always present, never omitted).
It is `true` once a `JAM` (0x61) event has arrived on this instance's wire — the 6510 executed an
illegal opcode and **the CPU is dead regardless of the verdict above**. The flag latches: it stays
true for the rest of the session.

It cuts across two verdicts in opposite directions, which is exactly why it is separate evidence
rather than a sixth verdict:

| `jamaction` | What `vice_diagnose` answers | Why | What to actually do |
|---|---|---|---|
| `-jamaction 2` (Monitor) | `wedged` | The machine stopped, so both brackets read zero advance | **`vice_machine_reset`, not `vice_recycle`.** Recycling destroys an instance a reset recovers — the same trap as `checkpoint_trap` |
| default (continue) | `live` | The emulator keeps burning cycles refetching the same opcode, so both brackets **advance** | **`vice_machine_reset`.** "Cycles advanced" is true and irrelevant: the machine will never execute another instruction |

**`jamObserved: true` is never a reason to recycle.** A reset recovers a jam. The instance
itself is healthy. Treat a `live` verdict with `jamObserved: true` as a false negative on liveness,
and a `wedged` verdict with it as a false positive on wedging.

### `evidence.channelContention` — read it before acting on `wedged` or `live`

Every `vice_diagnose` verdict carries `evidence.channelContention` (always present, never
omitted). `held` is `true` when the **other** monitor channel — the binary monitor or the
`-remotemonitor` text channel, whichever this call is not — currently holds this instance's halt
authority. When `held` is `true` the verdict is always `live`, with `evidence.bracketsRun: 0` —
meaning **no cycle bracket ran at all**, not that a bracket ran and read zero. The four detail
fields name the holder: `channel` (`"binary"` or `"text"`), `operation`, `grantId`, and `heldMs` (a
non-negative whole-millisecond duration) — all four are `null` when `held` is `false`.

**`channelContention.held: true` is never a reason to call `vice_recycle`.** The instance is
healthy and is answering. The remedy is to wait for the other channel's operation to finish, or to
find its holder, exactly as the opening table's contention row says.

Deliberate asymmetry with `jamObserved`, worth stating so a later reader does not "correct" it:
`jamObserved` qualifies `wedged` in this prose above and still lets that verdict return — the caller
has to read the evidence and choose not to recycle. `vice_diagnose`'s own handler guards
`channelContention` in **code** and makes `wedged` structurally unreachable while a foreign hold is
live — the only route to `wedged` is through a liveness bracket, and a bracket only runs when this
instance's own diagnose call actually held the lock. The two are different on purpose: the cost of
being wrong about contention is a destructive recycle of a healthy instance, not merely a
misdiagnosis.

### `diagnosis_unavailable` — reason classes and response (07-15)

`diagnosis_unavailable` is what `vice_diagnose` answers, on the `isError:true` channel, when it
could not reach any of the five verdicts above — including a protocol-decode failure. It is
never added to the verdict enum and is never grounds to `vice_recycle` by itself: the message says
so explicitly. **Every** `isError:true` answer this tool can produce carries this prefix — there is
no unclassified no-verdict path left. Eight reason classes exist, each with
its own next move:

| Reason | What it means | Do |
|---|---|---|
| `connection_lost` | The socket died mid-session | Retry once. If it recurs, treat as a real transport problem, not a wedge |
| `request_timeout` | The wire went silent past the request bound | Retry once. If it recurs, fall to the manual cycle bracket below |
| `monitor_acquisition_timeout` | Another client holds the monitor and the wait bound expired | Wait for the current holder to release, then retry — this is the bounded sibling of `monitor_held_elsewhere`, not a wedge. **The abandoned acquisition is not cancelled**: a session may be established moments after this answer, so a later-appearing held session is not a ghost. Its real outcome is written to stderr |
| `session_refused` | The broker/lease itself refused the session | Read the raw detail in the message; this is a broker-level problem, not an emulator state |
| `protocol_decode_failure` | This build answered a frame the client cannot decode | Report it as a tool defect — check `docs/stock-vice-parity.md`'s `CPUHISTORY_GET` history for a known class of this — and fall back to the manual cycle bracket below |
| `evidence_gathering_failed` | A session was obtained but a read needed to build the verdict failed | `vice_execution_run` may be needed to unstick a stalled read path, then retry |
| `liveness_unmeasurable` | The liveness bracket could not be **measured at all** — no `CPUHISTORY_GET` (needs VICE ≥ 3.10) and no `LIN`/`CYC` enumerated. **The expected outcome on a stock 3.9-class build**, e.g. every current Debian/Ubuntu package | **Not a wedge and not a tool defect.** A bracket that cannot measure is not one that measured zero. Judge liveness from outside the monitor (screenshot, process state). Retrying will produce the same answer |
| `unknown` | None of the above classified the failure | Read the raw detail in the message; retry once before escalating |

## What is not recoverable

**A checkpoint trap may be the onset without being the whole story.** In the one recorded
incident of this kind, checkpoint delete, then a soft reset, then a hard reset, then an explicit single step **all** left
the machine frozen, in sequence. Deleting the checkpoint is not guaranteed to unfreeze anything.

If a bracket still reads zero after the checkpoint is gone, the verdict becomes `wedged` and
recycle is the fallback after all.

**A stalled session cannot be corrected from inside.** The instance is granted on the session's
first forwarded call and is that session's for its whole life, so a subagent inherits the same
stalled instance. Before `vice_recycle` existed, the only exit was abandoning the session. That
is still the exit if recycle itself cannot land.

## Two traps that read as a wedge and are not

**`vice_ping`'s `execution` field is not a liveness signal.** A stalled host VICE answers
`status: "ok", execution: "running"` continuously and indefinitely. So does a machine that stopped
at a checkpoint — VICE's flag flips before the trap fires. Checkpoint bookkeeping
(`vice_checkpoint_add`/`list`/`delete`) also keeps returning healthy, self-consistent responses
throughout a real wedge, so "the tools respond" proves nothing.

**A `vice_run_until` on an address that is never reached looks exactly like a wedge.** Its
`cycles` parameter is *"not yet implemented"*, and the tool REFUSES it rather than ignoring it —
including alongside `address`, where it used to be silently dropped while the answer still
reported `reached: true`. The tool refuses unexpected argument names by name too, so a
`timeoutMs`/`timeout_ms` typo can no longer run with the default bound in silence. **This is
bounded:** pass `timeout_ms` (default 30000, clamped to a ceiling of 600000). An unreachable
address returns an explicit, bounded `timedOut: true` answer — with the temporary checkpoint
already cleaned up — rather than looking like a wedge. **Two further behaviours:** every
non-error answer, hit or timeout, carries `machineHalted` plus a `machineHaltedNote` naming the
resume call — the tool halts the machine on every read and says so explicitly. **`machineHalted`
is `true` on a hit and on a timeout whose cleanup delete got an answer** (`cleanup: "deleted"` /
`"already_gone"`). **It is `false` when `cleanup: "delete_failed"` or the socket is already gone**
and the run-state projection does not say `"stopped"`. **Do not read `machineHalted: false` as
"still running"** — it means nothing here could establish the state, `machineHaltedNote` says so,
and the next call should be `vice_diagnose`, not `vice_execution_run` (which may not reach the
instance at all). And a timeout whose cleanup delete lands on an already-gone race no longer
asserts `reached: false` outright: it reads the program counter and resolves the race
(`raceResolved: "pc_at_address"` / `"pc_elsewhere"`), or, if the PC read itself fails, omits
`reached` entirely and reports `reachedUnknown: true` (`raceResolved: "unresolved"`). **An absent
`reached` is not "false"** — check `reachedUnknown` before assuming a miss. The underlying
judgement stays the same and is still the right first question: before concluding anything, check
whether you asked the machine to run to an address it cannot reach. **Confidence: HIGH for the
reach/timeout mechanism** — live-checked against genuine, unmodified `/usr/bin/x64sc` (VICE
3.9) and `/usr/local/bin/x64sc` (VICE 3.10): a real KERNAL address ($EA31) reached within its
timeout, an unreached one ($C000) timing out with the checkpoint deleted. **MEDIUM for the
honesty fields above** (`machineHalted`, `raceResolved`, `reachedUnknown`) — unit-proven
(`stock-run-until.test.ts`, 21/21) but not independently re-exercised against a real emulator.

**A second binary-monitor client is contention, not a wedge, and it has a cheap tell.** The
binary monitor services exactly one client. A second `connect()` sits
unserviced in the backlog with no reply and no EOF. The discriminator: a socket that *accepts* the
connection but never answers is contention, not a hung emulator — and the broker itself already
knows whether it holds a lease on that port, which is the thing a human or agent can actually go
check instead of guessing. Named causes, so a reader knows where to look: a hand-run `nc` session
left open against the port, a second Claude Code session driving the same instance, VICE's own
`-remotemonitor`, and any other 6502 debugger that dials in. **This plugin's own annotation route
can never be one of them:** the `anno_*` tool surface and the `anno` CLI are pure store-and-image
readers — they open a SQLite annotation store and decode bytes out of a file on disk, and there is
no emulator connection anywhere on that path to contend for the port. That is a structural
property of what those calls do, not a documented promise, so a user chasing a silent emulator can
rule this project's own annotation tooling out immediately rather than suspecting it. The standing
advice does not change: contention is **never** a reason to recycle — the instance is healthy,
merely claimed elsewhere.

## The manual fallback, when `vice_diagnose` cannot answer

`vice_diagnose` needs the host broker running. When it reports that no `broker.json` record
exists, that is a **host action for a human** — say so and stop. Nothing container-side may reach
the emulator by another route.

When the broker is up but you want the raw measurement, the cycle bracket is the only trustworthy
liveness test. There is no non-pausing call at all — any inbound byte halts the machine, so a
`vice_ping` poll during the wait would measure nothing. The procedure is four calls with **zero
calls during the wait**:

1. `vice_cycles_stopwatch` `{action: "reset"}`
2. `vice_execution_run`
3. A real wall-clock wait, with **no calls at all** during it
4. `vice_cycles_stopwatch` `{action: "read"}`

**Exactly `0`, twice in a row, is a wedge.** Cycles advancing but far below the expected rate for
a real wait is a third thing — merely slow, a separate documented hazard measured at ~6,000/s
when a loop polls without re-resuming instead of waiting clean. Never poll with a state read.
Those pause and do not resume.

`vice_diagnose` already runs exactly this bracket internally, so the manual fallback above is
only for when the broker itself is unreachable and `vice_diagnose` cannot be called at all.

**Enumerate your own checkpoints before running any bracket.** `vice_checkpoint_list`, then
resolve the live IRQ handler (`$0314/$0315`, or `$FFFE/$FFFF` when `$01` has the ROMs banked out).
An armed stopping checkpoint at or inside the live IRQ path, with the PC pinned at or just past
it, is the trap signature — and reaching that verdict needs **no `vice_execution_run`**, which
matters because `vice_execution_run` is this project's leading crash suspect (six outages in one
session, the last three all on that call).

## Provenance

| Claim | Evidence | Confidence |
|---|---|---|
| The wedge signature: zero cycles, `ping` says running, PC byte-identical across pause/resume/step | Four live incidents across two disk images and two sessions; three independent zero-cycle brackets in one | HIGH |
| `vice_ping`'s `execution` field is not liveness | Confirmed twice independently | HIGH |
| The cycle bracket is the only trustworthy liveness test | Measured both ways — 21,551,860 cycles on a healthy instance, exactly 0 twice on a stalled one | HIGH |
| Epoch drift is surfaced automatically, and self-heals on the next call | Live, twice; both incidents self-healed within the session | HIGH |
| Checkpoint delete / reset / step can all fail to recover | One recorded incident, all four attempts in sequence | HIGH, single incident |
| A checkpoint trap explains all three recorded "silent stalls" | Cross-read, 3/3 correlation, mechanism consistent with every symptom — **not reproduced** | MEDIUM |
| `vice_diagnose`'s five-verdict path behaves as its schema says | Schema read, and cross-checked against the tracked implementation's own report builders. **Not exercised end to end** | MEDIUM |
| Stock's five-verdict path (`restarted`, `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`) and its bounded `vice_run_until` | Unit-proven (40/40 `stock-diagnose.test.ts`, 21/21 `stock-run-until.test.ts`). **Live-proven** against genuine `/usr/bin/x64sc` (VICE 3.9) and `/usr/local/bin/x64sc` (VICE 3.10) for `live`, `checkpoint_trap`, `wedged` (confirmed on both capability routes — `frame_position` on 3.9, `cpu_history` on 3.10) and `restarted`. `monitor_held_elsewhere`'s **socket-level** contention bound is live-proven (~1501-1502ms against a 1500ms bound). **UPDATED 2026-08-18** (`stock-live-broker-monitor.test.ts`, command `VICE_LIVE_BROKER_BIN=/usr/bin/x64sc` (or `/usr/local/bin/x64sc`) `node --test stock-live-broker-monitor.test.ts`): both remaining unit-only residuals are now ALSO live-proven, on both binaries, in one real run — the **broker-mediated** `monitor_held_elsewhere` verdict (a real second `claimMonitor()` refusal from a genuine host broker daemon, naming the other real grant's id, settling in 1ms against the 10000ms bound) and the **broker-supervised** (not test-performed) `restarted` respawn (the host broker's OWN crash supervision relaunched the killed instance; `vice_diagnose` answered `restarted` with `baselineEpoch:1`/`currentEpoch:2` at zero-to-minimal emulator cost). `vice_run_until`'s reach/timeout mechanism is live-proven against both binaries; its honesty fields (`machineHalted`, `raceResolved`, `reachedUnknown`) remain unit-proven only — NOT re-exercised live, no blanket claim made here | HIGH for the five verdicts (including both the broker-mediated `monitor_held_elsewhere` path and the broker-supervised `restarted` path, both now live-proven) and the run_until reach/timeout mechanism; MEDIUM for the run_until honesty fields only, which stay unit-only |
| `evidence.channelContention`: always present, `wedged` unreachable while contended, verdict `live` with `bracketsRun:0` while a foreign hold is live | Unit-proven in `stock-diagnose.test.ts` (65/65) — the always-present field on every verdict including both `session === null` paths, the `live`-with-`bracketsRun:0` answer on a foreign hold, `wedged` never reached while contended, and the discriminating-power case where an uncontended double-zero still answers `wedged`. **Live-reproduced against genuine stock `/usr/bin/x64sc` (VICE 3.9) only** — 2026-09-09, command `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts`: with the text channel holding a real `device c:` command, a concurrent `vice_diagnose` answered `verdict=live, evidence={"bracketsRun":0,"jamObserved":false,"channelContention":{"held":true,"channel":"text","operation":"device c:","grantId":"unknown","heldMs":3499}}`; after release, the same call answered `verdict=live, evidence={"bracketsRun":1,...,"channelContention":{"held":false,"channel":null,"operation":null,"grantId":null,"heldMs":null}}`, confirming a real bracket ran once uncontended | **MEDIUM** — a single binary's basis: the text channel is a stock-backend-only capability, so it is proven where it ships (genuine stock `/usr/bin/x64sc`, VICE 3.9), not against a second binary the way the neighbouring HIGH row above is |

**Log a new incident in your own project notes at the moment you hit it**, graded the same way
(`Evidence:` and `Confidence:`). Promote a grade by re-logging, never by editing the old entry in
place. A defect in the `vice` MCP tools themselves is worth filing as a bug rather than working
around inline — the workaround outlives the memory of why it was needed.

## Which skill does what

This one owns "is the machine alive, and what may I do to it". It does not restate what the
others carry.

| Need | Go to |
|---|---|
| Every way a live *read* gives a wrong answer | `c64-program-recon` — `references/observation-hazards.md` |
| Which address to read next, and what the answer rules out | `c64-program-recon` |
| Voiding a capture, and the artifact rename procedure | `c64-ram-capture` — § Void a run |
| What a specific address or bit means | `c64-memory-mapping` |
| **Whether the emulator is wedged, and whether to recycle** | here |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `vice_diagnose` reports no `broker.json` record exists | The host broker was never started. A human must start it on the host. There is no container-side workaround |
| The machine is still paused after `vice_diagnose` | Expected — it leaves it paused after a bracket. Resume with `vice_execution_run` |
| `vice_ping` says `running`, nothing advances | Not liveness. Run a bracket, or call `vice_diagnose` |
| The checkpoint never fired | Most state reads pause the emulator. Resume exactly once after every read |
| Zero cycles, and a checkpoint is armed on the IRQ handler | `checkpoint_trap`, not a wedge. Do not recycle |
| Zero cycles, nothing armed, epoch unchanged | A wedge. `vice_recycle` with a reason that names the evidence |
| A run "survived a reset" | Distrust it. You cannot read the epoch to confirm — but an unintended respawn inside the bracket would have raised a drift error on the next forwarded call, so absence of that error is the only evidence available |
| `vice_recycle` refused for a missing reason | It is required, by design — the reason *is* the incident record |
| `vice_diagnose` answers `monitor_held_elsewhere`, or a call hangs with no reply and no EOF | Not a wedge. Find the other client holding this instance's single binary-monitor slot |
</content>
