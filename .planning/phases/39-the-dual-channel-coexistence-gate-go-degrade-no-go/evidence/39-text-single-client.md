# Phase 39, plan 39-06 — `TEXT_SINGLE_CLIENT` (Task 2)

Owned by `39-06`. Measures the last of the phase's seven gate inputs, per
`SCHEMA.md` §2.7's frozen derivation, and settles the milestone's **other**
blocking UNVERIFIED item. Follows the evidence conventions in `README.md`
§ *Evidence conventions*, binding on this plan.

**`DECISION-RULE.md`'s `## Never a gate` section for this input** (lines
~267-274) was read before this measurement, and is quoted here in full so
this file states plainly what the result does and does not change:

> - **`TEXT_SINGLE_CLIENT` (D-08).** It constrains Phase 41's connection
>   management to one text client per instance — the same rule the broker
>   already enforces for the binary monitor — but says nothing about
>   whether one text and one binary client can coexist, which is the only
>   question this gate asks. `TSC_INDEPENDENCE: holds` in the walk's output
>   proves this mechanically rather than promising it.

`39-totality.md`'s own recorded output additionally proves, over all 1,296
tuple groups differing only in this input, that `TEXT_SINGLE_CLIENT` never
narrows which of `R1`..`R14` fires, and reaches `go` (`R15`) at all three of
its possible values — so nothing measured below changes the verdict path;
it is recorded as a fact for Phase 41's connection management, exactly as
`DECISION-RULE.md` states.

**The load-bearing trap this experiment is built to avoid**, quoted from
`CLAUDE.md`'s own project constraints (§ *Concurrency*):

> Stock VICE's binary monitor services **exactly one client**. A second
> `connect()` sits unserviced in the backlog with no reply and no EOF —
> indistinguishable from a hang. The broker must guarantee
> single-client-per-instance and must not diagnose this state as a hang.

And the precedent for how this codebase's own shipped client already
handles a single-client server, quoted from `src/mcp/vice/stock-protocol.ts`
(lines 2006-2020) — the **binary**-channel client's own refusal to
reconnect over a live socket:

```
  connect(host: string, port: number, { timeoutMs = 5000 }: ConnectOptions = {}): Promise<void> {
    // WR-13(b): refuse to connect over a socket that is still live. Before this,
    // a second connect() simply OVERWROTE #socket, leaking the previous socket
    // and its three listeners with nothing left to remove them, while
    // #closed/#pending/#settledRing were reset inconsistently around it. Route
    // a reconnect through disconnect() first -- which is what stock-connect.ts's
    // stockReconnect() already does by building a fresh client -- rather than
    // letting this method silently accumulate sockets against an emulator that
    // services exactly one binmon client.
    if (this.#socket != null && !this.#socket.destroyed) {
      return Promise.reject(
        new ViceError(
          `connect to ${host}:${port} refused: this client already holds a live socket to port ${this.#port} -- call disconnect() first (stock VICE services exactly one binmon client)`,
        ),
      );
    }
```

That is this project's own **client-side** guard against opening a second
socket to the same binary-monitor port. It says nothing about what the
**server** (the emulator's own monitor implementation) does when a second,
genuinely independent TCP client dials in anyway — which is exactly what
this experiment measures, on the **text** port, with no client-side guard
of any kind interposed (connection B is a bare, unwrapped socket).

---

## Precondition check (D-16), taken immediately before every run below

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc
(no output, exit 1 -- no genuine x64sc process alive)
```

Broker `inactive`, zero alive `x64sc` processes. `preflight()` in
`probe-harness.mjs` re-asserts this same pair in code, immediately before
every spawn, and throws rather than warns if either is violated (confirmed
by every run below: `PREFLIGHT_BROKER inactive` / `PREFLIGHT_X64SC (none)`).

---

## The probe's own sequencing (read literally from the plan's own step ordering)

The plan's own step 3 requires waiting out the **full** 60-second budget on
connection B "without sending anything" — a purely passive observation
window recording every `connect`/`data`/`end`/`error`/`close` event,
timestamped. Only **after** that window is over does this probe send ONE
confirming command on B, and only if a banner was observed sometime during
the passive window — mirroring this phase's own established "capture before
trusting" discipline (`D-13`), extended here to the second connection. A
budget expiry with no banner ever observed is classified directly as
`accepted-then-silent` without any confirming send, per the frozen rule's
own explicit instruction that a timeout on B is `single`, never `not-taken`.

---

## Run — both repetitions, one live spawn each

```
$ node text-single-client-probe.mjs
PROBE text-single-client-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T22:52:08.077Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
=== RUN 1 of 2 ===
RUN_1_BINARY_PORT 43927
RUN_1_TEXT_PORT 34555
RUN_1_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:43927","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:34555"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
RUN_1_CLIENT_A_TIME_TO_BIND_MS 155
CLIENT_A_BANNER_RUN_1: bytes=0 matchedPromptRe=false hex=
CLIENT_A_COMMAND_REPLY_RUN_1: matchedPromptRe=true replyLen=10 text="(C:$e5d1) "
CONNECTION_B_PASSIVE_WINDOW_RUN_1: reason=budget-expired connectFired=true gotBanner=false
CONNECTION_B_EVENT_LOG_RUN_1: [{"tMs":1,"type":"connect"}]
TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent
TEXT_SINGLE_CLIENT: single
CLIENT_A_POST_CLOSE_RECHECK_RUN_1: matchedPromptRe=true text="  ADDR A  X  Y  SP 00 01 NV-BDIZC LIN CYC  STOPWATCH\n.;e5d1 00 00 0a f3 2f 37 00100010 000 000    8864856\n(C:$e5d1) "
RUN_1_OUTCOME: observation=accepted-then-silent value=single
=== RUN 2 of 2 ===
RUN_2_BINARY_PORT 41933
RUN_2_TEXT_PORT 34663
RUN_2_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:41933","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:34663"]
RUN_2_CLIENT_A_TIME_TO_BIND_MS 152
CLIENT_A_BANNER_RUN_2: bytes=0 matchedPromptRe=false hex=
CLIENT_A_COMMAND_REPLY_RUN_2: matchedPromptRe=true replyLen=126 text="(C:$e5d4)   ADDR A  X  Y  SP 00 01 NV-BDIZC LIN CYC  STOPWATCH\n.;e5d4 00 00 0a f3 2f 37 00100010 000 001    8904169\n(C:$e5d4) "
CONNECTION_B_PASSIVE_WINDOW_RUN_2: reason=budget-expired connectFired=true gotBanner=false
CONNECTION_B_EVENT_LOG_RUN_2: [{"tMs":1,"type":"connect"}]
TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent
TEXT_SINGLE_CLIENT: single
CLIENT_A_POST_CLOSE_RECHECK_RUN_2: matchedPromptRe=true text="  ADDR A  X  Y  SP 00 01 NV-BDIZC LIN CYC  STOPWATCH\n.;e5d4 00 00 0a f3 2f 37 00100010 000 001    8904169\n(C:$e5d4) "
RUN_2_OUTCOME: observation=accepted-then-silent value=single
TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent
TEXT_SINGLE_CLIENT: single
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/text-single-client-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

No probe defect was found and no run needed correction — both repetitions
of the sequence ran clean on the first live attempt.

---

## Client A: demonstrably served, both repetitions, before B was ever opened

Confirming client A's own establishment BEFORE connection B is opened is
the plan's own precondition ("a second-connection result means nothing
unless the first connection is demonstrably being served"):

| | Run 1 | Run 2 |
|---|---|---|
| Client A time-to-bind | 155ms | 152ms |
| Banner (bytes) | 0 | 0 |
| First `r` command | `matchedPromptRe=true`, 10 bytes | `matchedPromptRe=true`, 126 bytes |
| Post-close re-check `r` | `matchedPromptRe=true`, full register table | `matchedPromptRe=true`, full register table |

Client A's own banner is empty (0 bytes) in both runs — consistent with
`39-03`'s own recorded finding (`IDLE_TEXT_CLIENT_HALTS`/no greeting on
connect: the text monitor sends nothing until the first command). A framed
reply (a `matchedPromptRe=true` response, ending in the `(C:$xxxx) `
terminator) was received in both runs, which is exactly what "served"
requires under `SCHEMA.md` §2.7 — client A is established as served in
both repetitions.

**A genuine, disclosed nuance, not a defect affecting this gate's
derivation:** Run 1's first `r` reply was only the bare 10-byte prompt with
no register table printed ahead of it, while Run 2's first `r` reply
included the full table immediately. Both are framed replies
(`matchedPromptRe=true`), which is all "served" requires — the content
difference does not change whether client A was served, only how much of
it printed on the very first entry into the monitor. The post-close
re-check's second `r` command shows the full table in **both** runs,
including Run 1 — so whatever caused the first reply's shorter content in
Run 1 was a one-time, first-entry artifact, not a persistent framing defect
in this probe or a sign that client A stopped being served. Recorded here
per this phase's "disclosed rather than smoothed over" convention
(mirroring `39-05-SUMMARY.md`'s own disclosed framing ambiguity), not
investigated further since it does not touch this gate's own derivation.

---

## Connection B: accepted at the socket level, never serviced at the application level

Both repetitions show the identical pattern: the bare TCP `connect()` event
fires almost immediately (`tMs=1` in both runs — the OS-level three-way
handshake completes, meaning the connection was accepted into the listen
backlog), and then **nothing else happens at all** for the remaining
~60 seconds of the budget — no banner, no data, no end-of-file, no error,
no close:

```
Run 1: [{"tMs":1,"type":"connect"}]
Run 2: [{"tMs":1,"type":"connect"}]
```

This is the load-bearing trap the plan documents at length, now measured
rather than assumed: a second connection to the text-monitor port is
accepted at the kernel/socket level and then left completely silent for
the whole budget, at the **application** level — the emulator's own
monitor-service loop never reads from it, never writes a banner to it, and
never closes it. Per `SCHEMA.md`'s own explicit rule, this maps to
`accepted-then-silent`, which maps to `single` — **not** `not-taken`, and
the budget expiring is exactly what this rule anticipates rather than an
untakeable experiment. No confirming send was attempted on B in either run
(per the probe's own sequencing above: a confirming send is only attempted
if a banner was observed during the passive window, and none was), so
`acceptedLimit` was never invoked either.

**This is the text-side analogue of `CLAUDE.md`'s documented binary-side
behaviour, now confirmed measured rather than assumed for the text port
too**: a stock VICE monitor server, of either kind, accepts a second TCP
connection at the OS level and then never services it, indistinguishable
from a hang under a short budget — exactly the reason this plan's own
60-second budget and this file's explicit `accepted-then-silent`->`single`
mapping exist.

Because `TEXT_SECOND_CONNECT_OBSERVATION` never reached
`accepted-and-served` in either run, the plan's step 6 interleaving check
(does each of two concurrent clients' replies route to the connection that
asked) was never exercised — recorded here as a fact this run's own
observation makes moot, not an omission.

---

## Client A after B closes: still served, no lasting effect

Both runs closed connection B (via `sock.destroy()` in the
`accepted-then-silent` branch) and then re-issued `r` on client A,
confirming a framed reply in both cases (see the table above — the
post-close re-check line in each run's transcript). A spurious, unserviced
second connection has **no lasting effect** on the already-served client in
either run.

---

## Derivation

Per `SCHEMA.md` §2.7's frozen rule:

- **`accepted-and-served`** (B receives a banner and a command reply) maps
  to **`multi`**.
- **`accepted-then-silent`** (connect succeeds, no banner, no EOF within the
  budget) maps to **`single`**.
- **`refused-outright`** (connection refused or reset) maps to **`single`**.
- A timeout on B is `single` via `accepted-then-silent`, **never**
  `not-taken` — `not-taken` is reachable only if client A itself could not
  be established, and it was, in both runs.

Both runs observed `accepted-then-silent`, mapping to `single`, and agree
with each other:

```
TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent
TEXT_SINGLE_CLIENT: single
```

No disagreement between runs to resolve, and no worse-value resolution was
needed.

**This measurement settles the milestone's other blocking UNVERIFIED item.**
Per the `## Never a gate` reasoning quoted at the top of this file, this
result constrains Phase 41's connection management to one text client per
instance — the same rule the broker already enforces for the binary
monitor — but says **nothing** about whether one text and one binary client
can coexist, which is the only question `CHAN-01`'s gate actually asks.
This value appears in no rule antecedent in `DECISION-RULE.md`, and
`39-totality.md`'s own recorded `TSC_INDEPENDENCE: holds` proves that
mechanically over all 1,296 tuple groups differing only in this input.

---

## Column-0 outcome and provenance lines (final occurrence wins)

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent
TEXT_SINGLE_CLIENT: single
