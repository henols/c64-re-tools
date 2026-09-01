# D18-16: stdio request-multiplexing measurement

**Plan:** 19-01, task 3
**Date:** 2026-08-24
**Binary:** `the external analyser` at `/home/henrik/.cargo/bin/analyser`
**`--version` output:** `the external analyser 0.9.20`
**Upstream pin for the source citations:** `an upstream repository` @ `493f840418f1450a342bb220c2fe3d2585dd0525` (v0.9.20, 2026-07-11)

## Question

`anno-session.ts`'s concurrency model is a **coarse FIFO mutex**: exactly one
logical operation per session is in flight at a time, and contention is
answered by a bounded FIFO wait rather than a refuse-while-busy error (decided
in Phase 18, plan 18-06). D18-16 recorded a **reader-writer upgrade** of that
seam as *deferred, not rejected* — concurrent reads, exclusive writes — with an
explicit precondition attached:

> A reader-writer upgrade remains deferred pending measurement of whether
> the external analyser's stdio handler actually multiplexes concurrent requests
> rather than reading stdin serially. Before considering any concurrent-read /
> exclusive-write lock, Phase 19 must run and record that measurement as
> evidence, the same way Phase 18 recorded the stdin-EOF measurement.

So: **when two requests are sitting in the child's stdin pipe at the same
time, does `analyser --mcp-server-stdio` work on them concurrently, or
does it finish the first before it even looks at the second?**

That is the whole question. A reader-writer lock is only worth building if the
answer is "concurrently" — if the child re-serialises the work a moment later,
a finer-grained lock at this project's seam buys nothing and costs a harder-to-
reason-about invariant. This is answered here by measurement against the real
binary, not assumed either way.

## Method

The measurement isolates the **child's** behaviour at the OS level, not this
project's, so it goes nowhere near `vice-proxy.ts` or `anno-session.ts`:

1. Synthesize a scratch `.regen2000proj` with the real, shipped
   `synthesizeProject()` from `src/mcp/vice/anno-project.ts` — 8192 bytes of
   `$EA` NOPs terminated by `$60 RTS`, origin `$0810`. Using the shipped
   writer rather than a hand-built project file means the child is analysing
   exactly the shape this project really produces.
2. Spawn `analyser --mcp-server-stdio <project>` with
   `stdio: ["pipe", "pipe", "pipe"]` — the same three-pipe shape
   `openAnnoSession()` uses. The binary is spawned with an argv **array**,
   never a shell string.
3. Perform the `initialize` handshake, send `notifications/initialized`, then
   wait a fixed 400ms settle so the measurement is not racing the child's own
   startup.
4. Write **ONE burst** — a single `write()` carrying two newline-terminated
   requests back to back:
   - `id: "SLOW-BATCH"` — `anno_batch_execute` with N × `anno_set_comment`.
     Each inner call triggers a re-analysis inside the child, so the batch
     takes seconds.
   - `id: "FAST-INFO"` — `anno_get_binary_info`, which does essentially no
     work.

   **Why one burst is the thing that isolates the child.** Writing request A,
   awaiting its reply, then writing request B would measure *this client's*
   serialism and prove nothing. Concatenating both into a single write means
   both lines are sitting in the child's own stdin buffer before it has
   answered either — the child's dispatch is then the only thing that can
   decide the order and the timing.
5. Timestamp every response line's arrival relative to spawn, and compute how
   long the trivial request waited from the moment the burst was written.

**If the handler multiplexed, `FAST-INFO` would come back in single-digit
milliseconds while `SLOW-BATCH` was still running. If it is serial, `FAST-INFO`
cannot come back until `SLOW-BATCH` has finished.** Same-millisecond arrival is
scored as *serial*, not as multiplexing — it is the trivial request being
handled the instant the batch ahead of it completes.

Every wait in the driver is explicitly bounded (15s for the handshake, 180s for
the burst); nothing polls unbounded, and a missing response exits non-zero with
a reason rather than recording an assumed result.

### The source proof that makes this general

The measurement alone would be one machine's timing. The upstream source at the
pin says the same thing by construction, which is what makes the answer
general:

`src/main.rs:388` dispatches the flag to the loop:

```rust
regeneratoanno_core::mcp::stdio::run_headless_stdio_loop(app_state, view_state).await;
```

and `crates/external-analyser-core/src/mcp/stdio.rs:67-98`:

```rust
pub async fn run_headless_stdio_loop(mut app_state: AppState, mut view_state: CoreViewState) {
    let stdin = io::stdin();
    let mut reader = stdin.lock();
    let mut line = String::new();

    while reader.read_line(&mut line).unwrap_or(0) > 0 {
        …
            let response = handle_request(&request, &mut app_state, &mut view_state);
```

One blocking `read_line` at a time, and `handle_request` called
**synchronously in the loop body** on `&mut AppState`. There is no
`tokio::spawn`, no `select!`, no join anywhere in the loop. Rust's borrow rules
make concurrent handling of a `&mut AppState` impossible by construction, so
this is not a scheduling accident that a faster machine or a different load
could change. Responses are emitted with `println!` plus an explicit flush, so
they always leave in arrival order.

Two incidental hazards from the same read, worth recording for session
robustness: a line that fails `serde_json::from_str` is silently `continue`d
with **no response at all** (`stdio.rs:73-77`), as is a request with no
`method` field — a malformed request hangs a naive client forever rather than
erroring. And requests must be **single-line** JSON, because `read_line` cannot
span a pretty-printed payload.

## Exact command sequence

```bash
The external analyser --version
# the external analyser 0.9.20

cd /home/henrik/dev/henrik/git/c64-re-tools
node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs
node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs
ANNO_MEASURE_INNER_CALLS=6000 node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs

# and the failure path, to confirm an unusable binary cannot record a result:
ANNO_BIN=/nonexistent-binary node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs
# {"ok":false,"reason":"cannot spawn \"/nonexistent-binary --version\": spawnSync /nonexistent-binary ENOENT","bin":"/nonexistent-binary"}
# exit=1
```

## Observed outcome

Three runs, two batch sizes:

| Run | N inner calls | Burst written at | `SLOW-BATCH` reply | `FAST-INFO` reply | FAST waited | FAST − SLOW | Verdict |
|-----|---------------|------------------|--------------------|-------------------|-------------|-------------|---------|
| 1 | 3000 | 414ms | 6351ms | **6352ms** | 5938ms | +1ms | serial |
| 2 | 3000 | 416ms | 6364ms | **6365ms** | 5949ms | +1ms | serial |
| 3 | 6000 | 420ms | 13457ms | **13460ms** | 13040ms | +3ms | serial |

The trivial `anno_get_binary_info` — a call that does essentially no work, and
which had been sitting in the child's stdin pipe since roughly t=415ms —
received no reply until **1–3 milliseconds after** the batch ahead of it
finished, every time. Doubling the batch size doubled the wait: the trivial
request's latency tracks the *queued work in front of it*, not its own cost.
That is the signature of a serial queue, and it leaves no room for a
multiplexing interpretation.

Raw JSON from run 1 (representative), exactly as the driver printed it:

```json
{"ok":true,"bin":"the external analyser","version":"the external analyser 0.9.20","innerCalls":3000,"origin":2064,"payloadBytes":8192,"settleMs":400,"burstBoundMs":180000,"burstWrittenAtMs":414,"responses":[{"id":"SLOW-BATCH","arrivedAtMs":6351,"isError":false},{"id":"FAST-INFO","arrivedAtMs":6352,"isError":false}],"fastWaitedMs":5938,"fastMinusSlowMs":1,"multiplexes":false,"verdict":"serial-one-request-at-a-time","date":"2026-08-24T15:55:22.358Z"}
```

And run 3, the doubled batch:

```json
{"ok":true,"bin":"the external analyser","version":"the external analyser 0.9.20","innerCalls":6000,"origin":2064,"payloadBytes":8192,"settleMs":400,"burstBoundMs":180000,"burstWrittenAtMs":420,"responses":[{"id":"SLOW-BATCH","arrivedAtMs":13457,"isError":false},{"id":"FAST-INFO","arrivedAtMs":13460,"isError":false}],"fastWaitedMs":13040,"fastMinusSlowMs":3,"multiplexes":false,"verdict":"serial-one-request-at-a-time","date":"2026-08-24T15:55:48.909Z"}
```

**Conclusion, HIGH confidence — two independent methods agreeing:**
`the external analyser 0.9.20`'s `--mcp-server-stdio` handler reads stdin serially
and processes exactly one request at a time, in arrival order. **It does not
multiplex.**

## Decision

**D18-16 is CLOSED by measurement, not re-deferred.** The precondition the
deferral named has been met, and the answer removes the motivation:

1. **The child does not multiplex.** Measured three times, corroborated by the
   upstream source, where it is true by construction rather than by scheduling.
2. **A reader-writer upgrade at `anno-session.ts` would buy exactly zero
   parallelism.** Concurrent readers admitted at this project's seam would
   re-serialise inside the child microseconds later. The only thing gained
   would be a more complicated invariant to hold and a harder-to-read failure
   when it broke.
3. **The coarse FIFO mutex is not a compromise — it is an exact model of the
   child's own behaviour.** One logical operation in flight at a time is what
   the child does; the seam simply says so honestly. The bounded-FIFO-wait
   contention answer is likewise the right shape: a refuse-while-busy error
   would surface the child's serialism as a caller-visible failure for no
   benefit whatsoever.
4. **Read-only fan-out remains the sanctioned orchestration pattern, and its
   value is agent reasoning concurrency — explicitly NOT throughput at the
   session.** Several agents may usefully think in parallel over answers
   already fetched. Fanning several *writers* at the session buys nothing.
   Absorbed procedure text must not promise otherwise: upstream's
   `analyze-program` prescribes a parallel subagent fan-out with a fixed
   slot count, and this measurement is why `src/skills/routine-queue-walker/`
   walks its queue one entry at a time instead, with that deviation named in
   its attribution header.

**What would reopen it:** a change to upstream's stdio dispatch — specifically,
`run_headless_stdio_loop()` in `crates/external-analyser-core/src/mcp/stdio.rs`
gaining a `tokio::spawn`, a `select!`, or any other route that stops calling
`handle_request` synchronously on `&mut AppState` in the loop body. That is a
structural change to the function cited above, visible in a source diff, and it
is the only thing that could make a finer-grained lock at this project's seam
worth anything. Re-run this driver after any such change; the ABS-04 re-sync
triggers already require reading the upstream diff before an upgrade past
0.9.20.

## Reproducing this measurement

```bash
cd /home/henrik/dev/henrik/git/c64-re-tools
node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs
```

Requires `the external analyser` on `PATH` (or `ANNO_BIN` pointing at it).
`ANNO_MEASURE_INNER_CALLS` sets the slow batch's size (default 3000); raising
it should raise `fastWaitedMs` proportionally, which is itself a check that the
measurement is measuring what it claims to.

The driver prints exactly one JSON line and exits with a non-zero status and a
`{"ok": false, "reason": ...}` line if the binary cannot be spawned or a
response never arrives — this document's verdict is not to be recorded from an
assumed result if that happens on a future re-run.
