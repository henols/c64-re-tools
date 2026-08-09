---
name: vice-wedge-triage
description: Decide whether a VICE emulator that has stopped responding is genuinely wedged, stopped itself at your own checkpoint, crashed and respawned, or merely paused — and what is safe to do about each. Use when asked why the emulator is stuck, frozen, hung, wedged, dead or not advancing, when a cycle bracket reads zero, when vice_ping says running but nothing happens, when a checkpoint never fires, when deciding whether to recycle or restart VICE, or when a run has to be voided and its evidence recorded.
---

# Triage a VICE that stopped moving

**Four states look identical from outside, and the intuitive fix destroys a healthy machine in
one of them.** Work the order below. Do not start with a remedy.

| State | Cheap tell | Safe action |
|---|---|---|
| **Merely paused** | Any state read pauses the machine and does not resume it | Resume once. Nothing is wrong |
| **Stopped itself at your checkpoint** | An armed *stopping* checkpoint on the live IRQ path | Delete/disable the checkpoint. **Never recycle** |
| **Crashed and respawned** | The proxy raises epoch drift on the next forwarded call | Void the run, reboot from scratch. Already handled for you |
| **Genuinely wedged** | Two consecutive cycle brackets read exactly `0` | `vice_recycle` with a reason, as a last resort |

```
mcp__plugin_c64-re-tools_vice__vice_diagnose        # one call, no arguments, answers which of the five it is
```

`vice_diagnose` returns a closed five-verdict vocabulary — `restarted`, `checkpoint_trap`,
`wedged`, `stale_read_path`, `live` — with the evidence that produced it. Read its schema for the
contract; this skill is the judgement around it.

## The order

1. **Call `vice_diagnose` first.** It runs the checks in the cheap-to-expensive order and stops at
   the first that fires: the epoch comparison costs zero emulator calls, the checkpoint-trap check
   costs three reads and **no resume**, and only then does it measure a cycle bracket.
2. **Read the verdict, not the vibe.** Each verdict has exactly one correct response — the table
   below. A verdict is not a suggestion to try things.
3. **`diagnose` leaves the machine paused** when it ran a bracket. Resuming is your own next call.
   Do not treat "still paused afterwards" as a symptom.
4. **If the verdict is `wedged`, capture evidence before recovering.** `vice_recycle` requires a
   `reason`, and that string is written verbatim into a permanent, repo-tracked incident record
   under `.planning/incidents/` **before anything is killed**. That record is the evidence
   capture — there is no separate ritual to perform, and a lazy `reason` is a lost incident.
5. **Recycling changes the restart epoch.** Any run in flight is void. Resume from the last
   recorded milestone snapshot, never from where the wedge happened.

## Verdict → response

| Verdict | What it means | Do |
|---|---|---|
| `live` | Cycles advanced | Resume and carry on. Suspect your own checkpoint conditions, not the emulator |
| `checkpoint_trap` | The machine stopped **itself** at an armed checkpoint | `vice_checkpoint_delete` or `vice_checkpoint_toggle` it, or `vice_execution_step` past it, then re-run `diagnose`. **Recycling here destroys a healthy instance** |
| `restarted` | The epoch changed — a crash-and-respawn already happened | The run is void. `c64-ram-capture` § Void a run gives the artifact procedure. Reboot from `vice_disk_attach` |
| `stale_read_path` | Some reads move while others do not | Do not trust any measurement taken across the boundary. Treat as void and re-derive |
| `wedged` | Two brackets, zero cycles, no epoch change | Last resort: `vice_recycle` with a real reason |

## What is not recoverable

**A checkpoint trap may be the onset without being the whole story.** In the recorded incident
(`.planning/todos/pending/2026-08-01-vice-registers-frozen-after-reset-during-01-04-task2.md`)
checkpoint delete, then a soft reset, then a hard reset, then an explicit single step **all** left
the machine frozen, in sequence. Deleting the checkpoint is not guaranteed to unfreeze anything.

If a bracket still reads zero after the checkpoint is gone, the verdict becomes `wedged` and
recycle is the fallback after all.

**A stalled session cannot be repaired from inside.** The instance is granted on the session's
first forwarded call and is that session's for its whole life, so a subagent inherits the same
stalled instance. Before `vice_recycle` existed, the only exit was abandoning the session; that is
still the exit if recycle itself cannot land.

## Two traps that read as a wedge and are not

**`vice_ping`'s `execution` field is not a liveness signal.** A stalled host VICE answers
`status: "ok", execution: "running"` continuously and indefinitely. So does a machine that stopped
at a checkpoint — VICE's flag flips before the trap fires. Checkpoint bookkeeping
(`vice_checkpoint_add`/`list`/`delete`) also keeps returning healthy, self-consistent responses
throughout a real wedge, so "the tools respond" proves nothing.

**A `vice_run_until` on an address that is never reached looks exactly like a wedge.** Its `cycles`
parameter is documented in its own schema as *"not yet implemented"*, so there is no working
timeout to bound it. Before concluding anything, check whether you asked the machine to run to an
address it cannot reach. **Confidence: MEDIUM** — read off the tool schema, not reproduced.

## The manual fallback, when `vice_diagnose` cannot answer

`vice_diagnose` needs the host broker running. When it reports that no `broker.json` record
exists, that is a **host action for a human** — say so and stop. Nothing container-side may reach
the emulator by another route.

When the broker is up but you want the raw measurement, the cycle bracket is the only trustworthy
liveness test, and it is four calls:

1. `vice_cycles_stopwatch` `{action: "reset"}`
2. `vice_execution_run`
3. `vice_ping` ×3 — the one call measured non-pausing (986,693 cycles/s while polling vs 991,569
   fully quiet). Never poll with a state read; those pause and do not resume
4. `vice_cycles_stopwatch` `{action: "read"}`

**Exactly `0`, twice in a row, is a wedge.** Cycles advancing but far below ~991,000/s is a third
thing — merely slow, a separate documented hazard measured at ~6,000/s when a loop polls without
re-resuming. Read all state first, poll with `vice_ping`, resume exactly once at the end.

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
| `vice_run_until` has no working timeout | Its schema says `cycles` is "not yet implemented" | MEDIUM |

Full provenance in `.planning/RE-FINDINGS.md`. **Log a new incident there at the moment you hit
it**, graded with `Evidence:` and `Confidence:`; promote by re-logging, never by editing a grade.
VICE MCP defects go to `.planning/todos/pending/` rather than being fixed inline. File-changing
work enters through a GSD command (`/gsd-quick`).

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
</content>
