# G-64-1 live check — plan 64-11

The measured record of the one thing plans 64-08/64-09/64-10 could not prove offline:
the four migrated tools, live, through the real `vice-proxy.ts`, against a real broker
started as a systemd user unit spawning the absolute `/usr/bin/x64sc`. The run also
surfaced two genuine, previously-undiscovered live defects — neither touched by this
plan's own code (production edits are prohibited here by this plan's own frontmatter) —
recorded verbatim below, with the workaround this plan used to still reach the truth
G-64-1 names.

## Environment

| Item | Value |
|---|---|
| Host | `ho-laptop`, Linux 6.12.107+deb13-amd64 |
| `/usr/bin/x64sc --version` | `x64sc (VICE 3.9)` |
| `/usr/bin/c1541 --version` (via `-version`) | `c1541 (VICE 3.9)` |
| `/usr/bin/petcat --version` | `petcat (VICE 3.9)` |
| Node | `v24.20.0` |
| Absolute node path | `/home/henrik/.nvm/versions/node/v24.20.0/bin/node` |
| `systemctl --user` | usable |
| Pre-flight | `vice-broker.service`/`vice-broker-g641.service` both `inactive`; no `vice-cli.mjs broker|vice-broker|x64sc` process; no listener on 19510 or any 66xx port — all clear before this run started |

## The exact unit command

```
systemd-run --user --unit=vice-broker-g641 --collect \
  --working-directory=/home/henrik/dev/henrik/git/c64-re-tools \
  --setenv=VICE_BIN=/usr/bin/x64sc \
  --setenv=MASTRA_TELEMETRY_DISABLED=1 \
  -- /home/henrik/.nvm/versions/node/v24.20.0/bin/node \
     /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/vice-cli.mjs broker
```

No `--repo-root`, no `VICE_BROKER_HOME`, no `VICE_POOL_DIR` — the same code path
`npx -y @henols/vice-mcp broker` and both committed service definitions run
(`vice-cli.mjs`'s `broker` subcommand dispatches unchanged to `resources/vice-broker.mjs`),
executed directly against this checkout so the run exercises this phase's own fixes
rather than the last published tarball.

## Journal lines naming backend, binary, state directory

```
vice-broker: backend "stock" (binary: /usr/bin/x64sc)
vice-broker: bound control listener on: 127.0.0.1, 172.25.0.1, 172.17.0.1 (port 19510)
vice-broker: state directory: /home/henrik/.c64-re-tools/supervisor
vice-broker: wrote /home/henrik/.c64-re-tools/supervisor/broker.json (node v24.20.0 at
  /home/henrik/.nvm/versions/node/v24.20.0/bin/node); control listener bound on 127.0.0.1:19510
```

## Broker/client path agreement (plan 64-10's own fix, proven live)

A child `node` process, importing this checkout's `vice-broker-client.ts` with
`VICE_SKIP_RESOURCE_INSTALL=1` and `CLAUDE_PROJECT_DIR` pointed at the scratch client
project, printed:

```json
{
  "path": "/home/henrik/.c64-re-tools/supervisor/broker.json",
  "liveness": {
    "state": "alive",
    "pid": 3835444,
    "heartbeatAt": "2026-09-23T18:53:08.116Z",
    "path": "/home/henrik/.c64-re-tools/supervisor/broker.json"
  }
}
```

`pid` and `heartbeatAt` match the broker's own `broker.json` record exactly, and the path
matches the journal's own "state directory" line above — the same resolver, agreeing, with
nothing configured on either side (G-64-1's secondary root cause, closed by plan 64-10).

## Tracer

`systemctl --user is-active vice-broker-g641.service` → `active`. 19510 listening on
loopback and two private-network interfaces. Driver present, `node --check` exit 0. The
tracer's own smallest sequence (`vice_ping` alone) is where the first live defect below
was discovered — see "Live defect 1" before reading the tool-result table.

## Live defect 1 — a cold-launched instance's first relay attach races the real emulator's own startup, and the broker's kill-never-recycle release policy kills the still-booting process on that race's failure

**Measured, not guessed: 11 consecutive `vice_ping`/`vice_autostart`/`vice_memory_read`
calls against a freshly cold-started broker (no warm instance in the pool) failed
identically** — `"stock handshake failed (binary monitor connection closed/errored with 1
request(s) abandoned)"` — every one within roughly 15–40ms of the broker's own
`launching /usr/bin/x64sc ...` journal line, every one leaving that launch's own log file
under `~/.c64-re-tools/supervisor/6600/logs/` at exactly 0 bytes (the emulator had not
even written its own startup banner before the connection failed).

**The emulator itself is healthy — proven by isolating the two halves.** A direct,
attach-free probe (`session.acquire()` alone, then a tight `/proc/<pid>` existence poll,
no relay dial at all) found the SAME class of freshly cold-launched process alive
continuously from 4ms to past 3000ms after acquire returned — it would have gone on to
bind its binary-monitor port normally (a separate, standalone timing measurement using
the identical argv found the real bind completing in as little as 71ms in a favourable
case). The emulator was not what failed.

**What killed it: the client's own release path.** `handleRelease()`
(`src/mcp/vice/vice-broker.mts:1774`) is kill-never-recycle by design — "this instance is
gone for good" (comment at `vice-broker.mts:1834`) — `verifiedKill()`s the instance's
process unconditionally on every release. When the FIRST relay dial against a
just-spawned instance fails (see below), the client's own error handling releases that
grant, and `handleRelease()` kills the process that was, per the isolation proof above,
still mid-boot and would have become reachable shortly.

**Precisely traced, no code guessed at:**
- `handleAcquire()`'s cold-launch arm (`vice-broker.mts:824`) spawns the emulator and sets
  `record.state = "granted"` (`vice-broker.mts:943`) IMMEDIATELY, with no wait and no probe
  for the binary monitor to actually be listening, before returning the grant to the client.
- `handleMonitorClaim()` (`vice-broker.mts:1034`) mints a per-channel handle with no
  readiness check of any kind.
- `handleRelayAttach()` (`vice-broker.mts:1422`) dispatches straight to `spliceRelay()`
  with no readiness check either.
- `spliceRelay()` (`src/mcp/vice/broker-relay.mts:327-329`) dials
  `netConnect({ host, port })` to the freshly-spawned emulator's own binary-monitor port
  IMMEDIATELY, with no retry and no backoff of any kind.
- Against every existing test's stub TCP server (which binds synchronously, before the
  "spawn" call even resolves) this dial always wins the race. Against a REAL `x64sc` —
  which spends measurable time loading ROMs and initialising its GTK3/OpenGL window before
  it ever opens the binary-monitor listener — the dial almost always loses it, on this host,
  under this session's load.
- `vice-proxy.ts:797-810`'s own `brokerWarmingMessage()` comment states the INTENDED
  design explicitly: *"A cold x64sc launch plus boot plus readiness is seconds ... the
  correct next action is simply to retry the SAME call ... it should succeed once the
  instance finishes booting."* No code path in the current acquire→claim→attach chain
  actually implements that wait — a "warming" `deadline` outcome exists only for the
  control-plane's own request/response timeout (a different, narrower case), never for
  "the emulator process exists but has not yet opened its port." `vice-proxy.ts:862-870`'s
  own comment confirms this directly: *"stock has no equivalent probe-then-replace step at
  this proxy layer, and a dead lease surfaces through stockDispatch's own error handling
  instead."*
- Consequence: "retry the same call" (the documented, intended remedy) does NOT converge,
  because every retry cold-launches a BRAND NEW instance (the previous one was just killed
  by the failed retry's own release) and races the identical ~15–40ms window against the
  identical multi-hundred-millisecond boot time. On this host, under this session's load,
  it took roughly 3–46 retries (never fewer than 2) for one to land after the emulator had
  already finished booting by chance, not because retrying itself narrows the gap.

**This is out of this plan's own scope to fix** (frontmatter: "Never edit production code
in this plan. A defect found live is recorded in the evidence and returned, not patched
here.") It is unrelated to G-64-1's own two root causes (both already closed by plans
64-08/64-09/64-10) — this is a THIRD, independent gap, invisible to every existing test
because every existing test's own emulator stand-in binds its port before the broker's
"spawn" call even returns, which a real, slow-booting `x64sc` never does. A new pending
todo is filed alongside this evidence (see "Follow-ups filed" below).

**The workaround this run used, not a production fix:** the driver's own `pollTool()`
retried the SESSION'S FIRST stock tool call (bounded, 500ms interval, 60s ceiling) until
one attempt won the race; every later call in the SAME session reused the resulting held
connection and needed no further retry. The **same defect, and the same workaround, were
independently reproduced through a real, separate nested Claude Code session** — see
"Nested Claude Code session" below — so this is not an artifact of the driver's own
transport.

## Subject construction — a second finding, entirely mine, disclosed for completeness

The first subject build used `10 POKE 49152,201` and `petcat -w2` to tokenize it.
`petcat`'s `-w2` tokenizer is **case-sensitive** on the keyword: `POKE` (uppercase) is not
recognised as the token at all and is written as four literal high-bit-set character bytes,
which then LIST back as `goval` garbage — not a POKE, not any real BASIC-v2 keyword. Fixed
by using lowercase `poke` in the source (`10 poke 49152,201`), confirmed round-tripping
correctly (`petcat -2` lists it back as `10 poke 49152,201`, and the tokenized bytes are
the single canonical POKE token `0x97`). This is a `petcat` usage gotcha this run's own
subject-construction step made, not a defect in this project's own code, and is recorded
here only because it explains why an early attempt showed no load evidence.

## Tool-call table (the corrected, final scripted run)

All of the following ran in ONE real `vice-proxy.ts` session (`transcript-task2-FINAL.jsonl`
in this run's own scratch directory, not committed — the driver and this evidence file are
the two artifacts this plan commits).

| Call | isError | Notes |
|---|---|---|
| `vice_memory_read` (negative control, 49152) | `false` (2nd attempt) | `hex: "ff"` — distinct from the sentinel |
| `vice_autostart` (subject.d64, run:true) | **`false`** | |
| `vice_memory_read` (load poll) | `false` (2nd attempt) | `hex: "c9"` — matches sentinel `201` |
| `vice_snapshot_save` (`g641_final_snap`) | **`false`** | path under scratch client project's own `.c64-re-tools/snapshots/`, confirmed 193261 bytes on host |
| `vice_snapshot_load` (`g641_final_snap`) | **`false`** | |
| `vice_disk_attach` (unit 8, blank.d64) | **`false`** (1st attempt this run) | intermittent — see "Live defect 2" |
| `vice_keyboard_type` (SAVE, `petscii_upper:false`) | `false` | see "petscii_upper finding" below |
| `vice_keyboard_type` (LOAD"$",8 / LIST) | `false` | |
| `vice_warp_set` (true) | `false` | text-channel witness |
| `vice_warp_set` (false) | `false` | text-channel witness |

Every one of the four migrated tools this plan exists to prove — `vice_autostart`,
`vice_disk_attach`, `vice_snapshot_save`, `vice_snapshot_load` — returned `isError: false`
in this run, live, through the real proxy, against the real broker and the real
`/usr/bin/x64sc`.

## Leak scan — zero occurrences

Every raw result object above (recursively, every key and every nested value) was scanned
for `$HOME/.c64-re-tools/` (the broker's own machine root, including its staging
directory). **Zero occurrences in any of the four migrated tools' results.** (D-15, D-17.)

## Sentinel control and positive reads — which subject route loaded

Negative control (before autostart): `hex: "ff"`. After `vice_autostart` with `run: true`
against the disk image (never needed the bare-`.prg` fallback route — the disk-image
route loaded and ran on the first attempt once the subject's own tokenization was
corrected): `hex: "c9"` (`201` decimal), matched on the SECOND poll iteration. The
sentinel differs from the control before autostart and equals it after — the load
evidence is the memory read, never a screenshot.

**Related, documented VICE behaviour — not a defect:** `vice_run_until`'s own timeout
path always halts the emulated machine as its own cleanup side effect ("the cleanup
CHECKPOINT_DELETE sent after the timeout halted the emulated machine (on stock, any
inbound byte does)... Call vice_execution_run to resume" — the tool's own response text,
verbatim). This run's driver calls `vice_execution_run` after every `run_until` timeout,
matching that documented contract; omitting it (an earlier diagnostic pass in this same
session) left the machine halted for the remainder of a poll loop and produced a false
"never loads" reading — a driver-side mistake, not a project defect, corrected before the
final run above.

## Write-loss cycle

1. `vice_disk_attach` on the blank image, unit 8: `isError: false`. `writeLoss` field
   quoted verbatim: *"Writes the running program makes to this attached disk image are
   not preserved: the emulator writes to a copy staged on the broker for this session
   only, and that copy is deleted once the session closes. Any save made to this disk
   during the session is gone the next time it is attached."*
2. `vice_keyboard_type` typed `SAVE"TESTSAVE",8` (`petscii_upper: false` — see finding
   below) after letting the disk-attach's own machine reset settle (3s).
3. Screen RAM, read directly after the SAVE: raw screen-code bytes decode to `SAVING`
   then `TESTSAVE` then `READY` — the save completed inside the session, on the emulator's
   own screen, not merely claimed by the tool result.
4. `LOAD"$",8` + `LIST` typed next; a poll of screen RAM (1024+) for the exact screen-code
   sequence of `TESTSAVE` (`20,5,19,20,19,1,22,5`) matched on the FIRST attempt — the
   directory listing shows the file that was just saved, proving the write reached the
   attached image DURING the session (not merely that a SAVE command was sent).
5. Host-side, after the session closed: `sha256sum` of the local `blank.d64` —
   `689b21505d87af91c0e06b85fc2cc1afb698cbfa874caf659cf3807f1ac18ca9` — **byte-identical**
   to the value recorded before the run. The broker's staging directory
   (`~/.c64-re-tools/staging/`) held nothing for the closed session, confirmed by directory
   listing after teardown.
6. **Judgement on the wording, against what was just observed:** the wording says what
   happened to the save — it names the mechanism ("staged copy," "session only," "deleted
   once the session closes") and the consequence ("gone the next time it is attached") —
   and every clause held exactly as stated: the write reached the staged copy (step 3-4),
   and the local file is unchanged (step 5). The wording survives being read out of
   context (D-16): a reader who saw only this sentence, with no other context, would
   correctly predict this run's own observed outcome.

## Live defect 2 — an intermittent `vice_disk_attach` "condition syntax error" (0x8f), functionally distinct from live defect 1

Across this session's several attempts, `vice_disk_attach` returned `isError: true` with
`"the command failed inside the monitor with no further diagnostic (a condition syntax
error reports exactly this and nothing more) (binary monitor returned error code 0x8f for
response type 0x00)"` on roughly one attempt in three, always AFTER a `vice_snapshot_load`
and several `vice_run_until` calls earlier in the SAME session — never on the very first
disk-related call of a session. In one such failure, the SAME session's subsequent `SAVE`
and directory listing still succeeded, meaning the underlying attach had likely already
taken effect even though the tool call itself reported an error — suggesting a
wire-level/response-accuracy defect in `handleDiskAttach`'s own AUTOSTART-approximation
implementation (D-14) rather than a functional attach failure, plausibly a stale
checkpoint-condition left behind by an earlier `vice_run_until`/`vice_execution_run`
sequence in the same session colliding with a checkpoint `vice_disk_attach` sets
internally. **Not chased further or fixed here** — out of this plan's own scope (not one
of the two G-64-1 root causes, and production-code edits are prohibited in this plan) — a
bounded (3-attempt) retry in the driver's own orchestration script worked around it for
this run; the table above reports the attempt that succeeded. Filed as a follow-up (see
below).

## `petscii_upper` finding — recorded, not a G-64-1 root cause

`vice_keyboard_type`'s default (`petscii_upper: true`, undocumented behaviourally as
observed here) produced screen-RAM bytes for a typed `SAVE"TESTSAVE",8` command that did
NOT decode as readable uppercase text and did not execute as a BASIC command (`SYNTAX
ERROR`); `petscii_upper: false` produced the correct on-screen text and a successful SAVE.
This is `vice_keyboard_type` (an existing tool, untouched by Phase 64's own migration
work), reproduced live against real VICE only — recorded as a discovered finding for
whoever owns that tool next, not investigated further or fixed here.

## Text-channel witness

`vice_warp_set` completed both directions (`true` then `false`), each `isError: false`,
over the same session — the relay is proven live on both channels in the same run.

## Nested Claude Code session

`claude -p` ran successfully (`claude` 2.1.270, non-interactive, `--mcp-config` naming
this checkout's `vice-proxy.ts` with the absolute node path, `MASTRA_TELEMETRY_DISABLED=1`,
a second scratch `CLAUDE_PROJECT_DIR`), `--strict-mcp-config`,
`--allowedTools mcp__vice__vice_ping,mcp__vice__vice_autostart,mcp__vice__vice_disk_attach,mcp__vice__vice_snapshot_save,mcp__vice__vice_snapshot_load`,
`--output-format stream-json --verbose`. The prompt instructed the model to retry
`vice_ping` if it failed. **Read from the stream's own `tool_result` content blocks, not
the model's retelling:**

- `vice_ping` (attempt 1): `"vice_ping: stock handshake failed (binary monitor connection
  closed with 1 request(s) abandoned)."` — live defect 1, independently reproduced through
  a genuinely separate Claude Code process.
- `vice_ping` (attempt 2): `{"status":"ok","backend":"stock","viceVersion":"VICE
  3.9.0.0",...}`
- `vice_autostart`: `{"path":".../subject.d64","run":true,"index":0,"runState":"running"}`
  — `isError: false`
- `vice_disk_attach`: `{"unit":8,"path":".../blank.d64","approximation":"AUTOSTART
  (D-14)...","runState":"running"}` — `isError: false`
- `vice_snapshot_save`: `{"name":"nested_check","path":".../nested-client-project/.c64-re-tools/snapshots/nested_check.vsf",...,"metadataWritten":true}`
  — `isError: false`
- `vice_snapshot_load`: `{"name":"nested_check","path":"...","programCounter":58831,...}`
  — `isError: false`

Every path in every result is under the scratch `nested-client-project`'s own
`.c64-re-tools/`; a `grep -c` of the full raw stream for `.c64-re-tools/supervisor`,
`/staging`, `/config-scratch` and `/incidents` returned `0` — the leak scan holds for the
nested session too.

## Teardown

```
systemctl --user stop vice-broker-g641.service   # exit 0
```

| Check | Result |
|---|---|
| `systemctl --user is-active vice-broker-g641.service` | `inactive` |
| `ps -eo pid,args \| grep -E 'vice-cli\.mjs broker\|vice-broker\|x64sc'` | 0 matches |
| listener on 19510 | 0 |
| listener on any 66xx | 0 |

`systemctl --user list-units --all 'vice-broker-g641*'` → `0 loaded units listed` (the
`--collect` unit unloaded itself on stop). No `x64sc`/`vice-broker`/`repro*` unit or
process left running anywhere on the host.

## Full-glob suite (broker confirmed down before running)

```
npm test   # src/mcp/vice
```

Result: `4416 tests, 4332 pass, 0 fail, 84 skipped, duration_ms 71050` — exit 0. (An
intermediate run during this same session showed one failure,
`anno-durability.test.ts`'s "EVID-05 concurrent planting" — a concurrent-writer-SIGKILL
timing test, unrelated to any file this plan touches; re-run alone it passed 13/13, and
the immediately following full-glob re-run was clean at 4416/4332/0/84 — flakiness under
this session's own heavy `x64sc`-churn load, not a regression this plan caused.)

## Follow-ups filed

- `.planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md`
  — live defect 1 (the blocking one), full citations above.
- A `WINDOWS.md` `deviation` entry for live defect 2 (the intermittent `vice_disk_attach`
  0x8f) and for the `petscii_upper` finding.

## What this does not prove

- A bare host only, not a devcontainer — plan 64-10's own evidence covers the container
  case and its interim limitation.
- One VICE build (3.9, the absolute `/usr/bin/x64sc`) — this host also carries a 3.10 at
  `/usr/local/bin/x64sc` (also stock), not exercised here.
- The timing of live defect 1 is measured on THIS host, under THIS session's load, with
  the retry-until-success workaround this run used — it does not establish a bound on how
  many retries a quieter host would need, only that the race is real, reproducible, and
  currently unbounded by any code in the acquire→claim→attach chain.
- The nested Claude Code session exercised four of the five tools this plan names
  (`vice_ping` plus the four migrated tools) — it did not repeat the full write-loss cycle
  or the text-channel witness inside the nested session; those are proven only by the
  scripted driver run above.
