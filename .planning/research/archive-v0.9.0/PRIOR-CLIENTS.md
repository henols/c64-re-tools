# Prior VICE Binary-Monitor Clients — What They Teach

**Researched:** 2026-08-12
**Mode:** Pitfalls / prior-art review for `vice-binmon.ts`
**Overall confidence:** HIGH for anything traced to VICE source or read client source; flagged inline otherwise.

## Method and Sources

Every finding below comes from reading source, not READMEs. Clones and file/line references:

| Source | What it is | Rev / date read |
|---|---|---|
| `VICE-Team/svn-mirror` `src/monitor/monitor_binary.c` (2184 lines), `mon_breakpoint.c`, `mon_util.c`, `monitor.c` | **The authoritative server side.** Already present at `.../scratchpad/vice-src` | master `e50d42c` |
| `empathicqubit/vscode-cc65-debugger` `src/dbg/abstract-grip.ts` (501), `src/dbg/binary-dto.ts` (1193) | VS Code debug adapter, TypeScript, 41 stars — the most feature-complete TS client | last push 2025-02-10 |
| `henols/c64-debug-mcp` `src/vice-protocol.ts` (747), `src/session.ts` (3057) | **The user's own prior MCP server.** TypeScript, MIT, published to npm as `c64-debug-mcp@1.0.14` | last push 2026-04-04 |
| `chrisgleissner/c64bridge` `src/vice/viceClient.ts` (636) | MCP server, TypeScript, 33 stars, actively maintained | last push 2026-08-07 |
| `Sakrac/IceBroLite` `src/ViceInterface.cpp` (1047), `src/ViceBinInterface.h` (407) | Full C++ GUI debugger | HEAD |
| `Galfodo/pyvicemon` `vice_monitor.py` (40 KB) | Python interactive monitor | HEAD |
| `simen/vice-mcp` `src/protocol/client.ts` (801) | MCP server, TypeScript, 1 star | last push 2025-12-30 |
| `coolbutuseless/c64vice` `R/requests.R` | R package, synchronous | HEAD |
| `micheldebree/viceremote` `src/main/java/.../Connection.java` | **Not a binary-monitor client** — text monitor on port 6510 | HEAD |
| npm registry (live query) | Searched for a reusable client library | 2026-08-12 |

**Negative results worth recording:**
- **VICE ships no example or test client for the binary monitor.** Searched the whole tree for `.py`/`.sh`/`.md` referencing `binarymonitor` or opcode `0x81` — zero hits. `src/monitor/` contains only emulator-side code. There is nothing official to copy from.
- **No VICE binary-monitor client library exists on npm.** Verified live: `vice-monitor`, `vice-binary-monitor`, `node-vice`, `viceclient`, `vice-binmon` all 404. Keyword search for "vice emulator monitor" returns only unrelated packages. `c64-debug-mcp` and `c64bridge` are published but as **executables only** (see §7).
- `VICE-Team/svn-mirror` GitHub issue search for "binary monitor" returns 0 issues (they use SourceForge for bug tracking; the GitHub mirror has issues effectively unused). No client-side bug corpus available there.
- `vscode-cc65-debugger` has only 5 issues mentioning the protocol, none about framing. The bugs in that codebase (§1, §6) are ones I found by reading it, **not** ones its maintainers documented. Flagged as my analysis, not their admission.
- `viceremote` is irrelevant to this milestone. It opens port 6510, writes an ASCII command, and does `in.readFully(new byte[10])` — a fixed 10-byte read of a variable-length text reply. Only value: a reminder that "read exactly N bytes" is always wrong on a stream.

---

## Scorecard

| Client | Buffers until full frame? | Correlation | Event demux | Run/stop model | Verdict |
|---|---|---|---|---|---|
| **c64bridge** | Yes, correct | `Map<reqId, pending>`, skips `0xffffffff` on wrap | Explicit `reqId === 0xffffffff` branch first | Minimal | **Cleanest transport. Reference implementation.** |
| **c64-debug-mcp** (user's own) | Yes, correct | `Map<reqId>` + promise chain | Explicit broadcast-id branch first | Rich: `explicitPauseActive`, idle auto-resume, cooldowns | **Best state machine. Two real bugs.** |
| **cc65-debugger** | **No — broken reassembly** | Monotonic id capped at `0x8fffffff`, EventEmitter keyed by hex id | Emitter channel `"ffffffff"` | `waitForStop(pc range, continueIfUnmatched)` | Best ideas, worst framing |
| **IceBroLite** | Yes, but no desync recovery | Dispatch by **response type**, id only cancels a timeout | Checks `id != 0xffffffff` before touching timeouts | `stopped` flag driven only by events; commands gated on it | Best discipline on state, fully async |
| **pyvicemon** | Yes, correct | Global counter + queue scan by id | Silently **drops** RESUMED by default | None | Correct framing, hangs on disconnect |
| **simen/vice-mcp** | Yes, resyncs on bad STX | **`reqId & 0xff` — wraps at 256** | **Resolves pending promises with events** | `state.running` bool | Instructive anti-pattern |
| **c64vice** (R) | No — sleep 0.2 s then one big read | Random id per request, new socket per request | N/A | None | Toy; useful only for screenshot cropping |

---

## 1. Framing and Correlation

### The correct shape, and who has it

`c64bridge/src/vice/viceClient.ts:155-172` is the model to copy:

```
buffer = concat(buffer, chunk)
while (buffer.length >= 12):
    bodyLen = buffer.readUInt32LE(2)
    if (buffer.length < 12 + bodyLen) break        // wait for more
    frame = buffer.subarray(0, 12 + bodyLen)
    buffer = buffer.subarray(12 + bodyLen)
    dispatch(frame)
```

`c64-debug-mcp/src/vice-protocol.ts:224-248` (`parseBuffer`) is the same algorithm returning `{responses, remainder}`. Both are correct. **Body length excludes the header in both directions** — confirmed on the server side at `monitor_binary.c:341-357` (writes a 12-byte header then `length` body bytes) and `monitor_binary.c:1954` (`command_size = 1 + 1 + 4 + 5 + body_length + 1`), and independently in `IceBroLite/src/ViceBinInterface.h:67,85` where `GetSize() { return GetLength() + sizeof(VICEBinHeader); }`.

### The classic TCP bug, in the wild

`cc65-debugger/src/dbg/abstract-grip.ts:29-95` has it, and it is worth studying because the failure is *intermittent*:

```ts
if(this._nextResponseLength == -1) {
    this._responseByteCount = 0;
    this._nextResponseLength = d.readUInt32LE(2) + header_size;   // reads from the CHUNK, not the accumulator
```

Two distinct defects:

1. **The length is read out of the arriving chunk `d`, not out of the accumulated buffer.** If a chunk arrives with fewer than 6 bytes, `readUInt32LE(2)` throws `RangeError`, which the surrounding `try/catch` at line 92 swallows into `console.error`. The bytes are lost and the stream is desynced silently and permanently.
2. **The saved partial header is discarded.** At lines 81-88, leftover trailing bytes are handled by recursing *only if* `sliced.length >= 12`. For a 1-11 byte tail it copies them to the accumulator and sets `_responseByteCount = sliced.length`, but leaves `_nextResponseLength = -1`. The next chunk then hits the branch above, which **resets `_responseByteCount` to 0**, throwing away the stashed partial header, and reads the length from the wrong offset.

Why it survives in a 41-star extension: VICE writes header and body in two separate `vice_network_send()` calls (`monitor_binary.c:352-356`), so for small replies the reads usually line up one-frame-per-chunk. It breaks under `DISPLAY_GET` (100 KB+, guaranteed segmentation) and under event bursts.

**Warning sign:** works in manual testing, corrupts after a screenshot or under a checkpoint storm; `console.error` noise about `RangeError` / "out of range".
**Prevention:** never index into the arriving chunk. Append to a single accumulator and only ever parse from offset 0 of that accumulator. Unit-test the parser by feeding a known multi-frame byte stream one byte at a time and asserting frame-for-frame equality with a whole-buffer parse.
**Phase:** transport/framing.

### Desync recovery: three different answers, one right one

| Client | On a byte that is not `0x02` |
|---|---|
| `c64-debug-mcp:229-231` | **`throw`** from inside the `'data'` handler. The bad bytes are never removed from `#buffer` (the throw precedes the reassignment at line 667), so every subsequent chunk re-throws. Permanent, unrecoverable wedge — and an exception out of a socket callback. |
| `IceBroLite:640` | Loop condition is `while (bufferRead >= 12 && recvBuf[0] == 2)`. On desync the loop just exits and `bufferRead` never decreases; `recv()` is then called with a shrinking length until it is 0. Silent hang, no diagnostic, plus an `assert` at line 608 that only fires in debug builds. |
| `simen/vice-mcp:176-181` | `this.responseBuffer = this.responseBuffer.subarray(1); continue;` — skip one byte and retry. |

**simen's is the right behaviour**, and it matches what the server does: `monitor_binary.c:1929-1931` is literally `if (buffer[0] != ASC_STX) { continue; }`. VICE resyncs byte-by-byte; the client should too, but should *also* emit a loud diagnostic, because a desync means a parser bug or a length-field misread, and silently recovering hides it.

**Prevention:** on non-STX, drop one byte, increment a `desyncBytes` counter, log at warn level, and fail the connection if the counter exceeds a small threshold (say 64) — a genuine desync will not resolve itself in 64 bytes.

### Correlation strategies

- **`Map<requestId, pending>` with a monotonic counter** — `c64bridge:95,218`, `c64-debug-mcp:370,637`, `cc65-debugger:352-356`. Correct.
- **Request-id range discipline.** `cc65-debugger:352-355` wraps at `0x8fffffff`; `c64bridge:218` has the comment *"Reserved for unsolicited events (see onData above); skip it on wraparound"* and skips `0xffffffff`. Both deliberately avoid ever minting the event id. `c64-debug-mcp` starts at 1 and never wraps (a 32-bit counter at MCP call rates will not).
- **`simen/vice-mcp:162-165` is the counterexample:** `this.requestId = (this.requestId + 1) & 0xff`. Ids repeat every 256 commands. Combined with a `Map` keyed by id and a timeout that deletes entries, a late reply from command *n* can resolve command *n+256*. The comment at line 319 (`// Request ID is 4 bytes!`) is a scar from an earlier version that under-sized the field.
- **Dispatch by response *type* instead of id** — `IceBroLite:668-710`. This is a legitimate architecture for a fully asynchronous UI (it never awaits a specific reply; it just folds every inbound message into state), and it makes the "event arrives mid-request" problem structurally impossible. It costs you the ability to have a promise-returning API. **Not appropriate here** — the MCP surface is request/response — but the underlying insight is: the fewer places you assume "the next message is mine", the fewer bugs.

---

## 2. Async Event Demultiplexing

### Ground truth from the server

There are **five** unsolicited message types, not three. The milestone's settled-facts list names only STOPPED/RESUMED/JAM; that is incomplete.

`monitor_binary.c:292` `#define MON_EVENT_ID 0xffffffff`. Emitters:

| Response type | When | Body | Source |
|---|---|---|---|
| `CHECKPOINT_INFO` 0x11 | **every hit of every enabled checkpoint** | 23 bytes, `hit=1` | `mon_breakpoint.c:459-465`, called from `mon_breakpoint_check_checkpoint` at line 557 |
| `REGISTER_INFO` 0x31 | every time the monitor opens | full register list | `monitor_binary.c:491-496` |
| `STOPPED` 0x62 | every time the monitor opens, right after the above | 2 bytes (PC) | `monitor_binary.c:494`, `364-372` |
| `RESUMED` 0x63 | every time the monitor closes | 2 bytes (PC) | `monitor_binary.c:498-500`, `374-382` |
| `JAM` 0x61 | CPU jam | **0 bytes** — see §5 | `monitor_binary.c:384-394` |

Note `monitor_binary_response_stopped(uint32_t request_id)` **ignores its own parameter** and hardcodes `MON_EVENT_ID`. So the invariant is absolute: these never carry a real request id. You can key the entire demux on `requestId === 0xffffffff` and be correct.

The exact ordering on a stopping checkpoint hit, traced through `mon_breakpoint.c:557` → `monitor_startup_trap` → `monitor.c:3213` `mon_event_opened()`:

```
CHECKPOINT_INFO (0x11, id=ffffffff, hit=1)
REGISTER_INFO   (0x31, id=ffffffff)
STOPPED         (0x62, id=ffffffff, pc)
```

Three unsolicited frames, and **two of them share a response type with a legitimate command reply** (`CHECKPOINT_GET` also answers 0x11; `REGISTERS_GET` also answers 0x31).

### The gotcha, and the codebase that demonstrates it

**Yes, an event can arrive between your request and its reply — and it routinely does.** Any command sent while the machine is running triggers monitor entry, so the *normal* sequence for e.g. `MEM_GET` on a running machine is:

```
you send:  MEM_GET (id=42)
you get:   REGISTER_INFO (id=ffffffff)   <- not yours
           STOPPED       (id=ffffffff)   <- not yours
           MEM_GET       (id=42)         <- yours
```

`simen/vice-mcp/src/protocol/client.ts:239-263` is what happens if you get this wrong. Its comment says the quiet part out loud:

```ts
// VICE sends async events with ReqID=0xffffffff
// For these, we match by response type to the oldest pending request expecting that type
if (response.requestId === 0xffffffff) {
    for (const [reqId, pending] of this.pendingRequests) {
        if (pending.expectedResponseType === response.responseType) {
            this.pendingRequests.delete(reqId);
            pending.resolve(response);      // resolves a request with an EVENT
```

Consequences, in order of nastiness:
- A pending `REGISTERS_GET` is resolved by the unsolicited monitor-open `REGISTER_INFO`. This **appears to work** — the register values are genuinely correct — which is exactly why the bug is still there. The real reply then arrives with no pending entry and is dropped.
- A pending `CHECKPOINT_GET` is resolved by an unrelated trace watchpoint's `CHECKPOINT_INFO`, returning **a different checkpoint's data**. Silent wrong answer, no error.
- Any code that awaits `STOPPED` as if it were a reply gets resolved by a spontaneous stop from an unrelated checkpoint.

**Warning sign:** register/checkpoint reads that are subtly stale or belong to the wrong object; `"No pending request matched async response type"` in logs; one dropped reply per monitor entry.
**Prevention:** branch on `requestId === 0xffffffff` **before** any type-based logic, and route to an event bus that can never resolve a pending promise. `c64-debug-mcp:671-675` and `c64bridge:174-178` both do exactly this. Assert in tests that a synthetic STOPPED injected between a request and its reply leaves the pending map untouched.
**Phase:** transport/framing (the demux), run-stop state machine (the consumers).

### One request, many replies

`CHECKPOINT_LIST` (0x14) is not 1:1. `monitor_binary.c:624-641`:

```c
for(i = 0; i < len; i++) {
    monitor_binary_response_checkpoint_info(request_id, checkpts[i], 0);   // N frames, YOUR request_id
}
monitor_binary_response(4, e_MON_RESPONSE_CHECKPOINT_LIST, ..., request_id, response);  // terminator with count
```

So *N* `CHECKPOINT_INFO` frames bearing your request id, then a terminal `CHECKPOINT_LIST` frame with the count. A naive "delete from pending on first id match" resolves on the first checkpoint and drops the rest, or worse resolves with a `CHECKPOINT_INFO` typed as a list.

Two solutions in the wild, and the general one is better:

- **Specific** — `c64-debug-mcp:651,683-708`: a `linkedCheckpointInfo` array allocated only when `commandType === CheckpointList`, accumulating 0x11 frames until the 0x14 arrives. Works, but hardcodes the one known case.
- **General** — `cc65-debugger:373-388`: each command declares an expected terminal `responseType`; any frame on the same request id whose type differs is pushed onto a `related[]` array and does **not** resolve. Only the declared type resolves, and it carries `related` with it. This handles `CHECKPOINT_LIST` and any future one-to-many command for free.

Adopt the general form. It also gives you the natural place to handle the *other* type mismatches in §5.

---

## 3. The Run/Stop State Machine

This is where the real pain is, and the prior art is unambiguous about the shape of the solution.

### 3.1 The structural facts that make this hard

**Any inbound byte halts the machine.** `monitor.c:407` calls `monitor_check_binary()` from the vsync hook; `monitor_binary.c:281-286` is `if (monitor_binary_data_available()) monitor_startup_trap();`. It does not inspect the byte. Consequences:

- There is **no "stop" opcode**. `IceBroLite`'s `ViceBreak()` (`ViceInterface.cpp:229-234`) pauses the emulator by sending a `RegistersGet`. That is the idiom: to halt, send anything.
- There is **no way to observe the run/stop state without changing it.** Every query halts the machine. `c64-debug-mcp` never queries; it derives state purely from the event stream (`session.ts:2776-2790`) and reports `runtimeKnown: false` until the first event arrives. This is the only honest model.
- After a command-induced halt the machine stays halted until you send `EXIT` (0xaa) — `monitor_binary.c:1031-1036` sets `exit_mon = exit_mon_continue`, and `monitor_binary_get_command_line:1974-1976` returns, closing the monitor, which fires `RESUMED`. **A resume is a distinct round trip, not implicit.** Every prior client treats "resume" as `EXIT`.

So the failure mode the project has already lived through — *six outages, three on the resume call* — has a structural cause: reads halt, resumes are separate, and a wrapper that reads-then-resumes in a loop generates two round trips and one monitor open/close cycle per iteration.

### 3.2 The deadlock I did not expect to find

`mon_breakpoint.c:557-562`:

```c
cp->hit_count++;
mon_breakpoint_event(cp);          /* unconditional — fires for NON-stopping checkpoints too */
if (cp->stop) { must_stop = TRUE; ... } else { action_str = "Trace"; }
```

`mon_breakpoint_event` → `monitor_binary_response_checkpoint_info(0xffffffff, cp, 1)` → `monitor_binary_response` → `monitor_binary_transmit` → `vice_network_send` on a **blocking** socket, called **from inside the CPU emulation loop**.

A non-stopping checkpoint or watchpoint on a hot address therefore emits one 35-byte frame per access — potentially tens of thousands per second at 1 MHz. If the client does not drain the socket fast enough, VICE's `send()` blocks with a full kernel send buffer and **the entire emulator thread stalls inside the CPU loop**. The client is then waiting for a command reply that cannot come, because the emulator is blocked writing an event. Neither side times out at the TCP level.

This is a genuine mutual deadlock in stock VICE, reachable with a single well-intentioned `checkpoint_set(stop: false)` on, say, `$D012` or a screen address. I have not seen it documented anywhere.

**Warning sign:** the VICE window goes unresponsive (not crashed) while the client's request times out; on Linux, `ss -tmi` on the monitor port shows a non-draining send queue on the emulator side; the client's read buffer grows monotonically.
**Prevention (four layers, all cheap):**
1. Run the reader unconditionally and continuously — a `'data'` handler that always drains, never a "read only while a request is pending" loop. All the TS clients get this right by construction; `pyvicemon` does not (§4).
2. Treat `stop: false` checkpoints as a dangerous capability. Require an explicit opt-in, cap how many can be enabled at once, and refuse them on known-hot ranges (`$D000-$D030`, `$0400-$07FF`, `$D800-$DBFF`) unless forced.
3. Rate-limit: count inbound `CHECKPOINT_INFO` events per second; above a threshold, disable the offending checkpoint by id (you have the id in every frame at body offset 0) and surface a warning.
4. Prefer `hit_count` polling to trace events — which is exactly what `vice-sync.ts`'s existing "poll on `hit_count`, never on paused state" invariant already does. This finding is an independent, source-level justification for keeping that invariant.
**Phase:** run-stop state machine, and the checkpoint/watchpoint tool phase.

### 3.3 `STOPPED` does not tell you why

`STOPPED`'s body is 2 bytes: the PC. Nothing else. `c64-debug-mcp/src/session.ts:2792-2858` shows the full correlation dance required to answer "why did we stop?":

1. Buffer the most recent `CHECKPOINT_INFO(hit=1)` as `#pendingCheckpointHit` with a timestamp.
2. On `STOPPED`, if a pending hit was observed within `CHECKPOINT_HIT_SETTLE_MS` (1000 ms), attribute the stop to that checkpoint and map its `operation` byte to breakpoint / watchpoint-read / watchpoint-write.
3. Otherwise fall back to `#lastExecutionIntent` — what *you* asked for (step, pause, resume).
4. If the intent is also unknown, `#scheduleCheckpointHitQuery()`: wait 200 ms for a late `CHECKPOINT_INFO`, then issue `CHECKPOINT_LIST` and look for `currentlyHit` (body offset 4) to identify the stop retroactively.

That fallback exists because the correlation is genuinely racy. It is worth having, but note step 4 sends a command — which is safe here only because the machine is already halted.

**Prevention:** model stop *reason* as a separate, best-effort attribution layer over the event stream, with an explicit `unknown` value. Do not let a tool's contract require a reason that cannot always be determined.

### 3.4 Client-side state, derived only from events

Every client that works does the same thing: **the run/stop flag is a projection of the event stream, never of the commands you sent.**

- `IceBroLite:858-864` — `stopped` is set true only by `VICE_Stopped`/`VICE_JAM` and false only by `VICE_Resumed`, all inside the receive handler. Nothing else writes it.
- `c64-debug-mcp:2780` — `executionState = runtimeKnown && lastEventType === 'resumed' ? 'running' : runtimeKnown ? 'stopped' : 'unknown'`. The tri-state with `unknown` is important: after a fresh connect you genuinely do not know.

And then commands are **gated** on that flag. `IceBroLite` guards `ViceStep`, `ViceStepOver`, `ViceStepOut`, `ViceGo` with `viceCon->isStopped()` (lines 250, 261, 272, 240) and `ViceBreak` with `!isStopped()` (line 231). A resume cannot be issued twice because the second call sees `stopped == false` and is a no-op. **That single guard is the cheapest possible defence against the resume storm.**

`c64-debug-mcp` went further, and the commit message is the interesting artifact — `02153d0 "feat: make pause/resume idempotent and add auto-resume for input tools"`:

> - execute(pause) when already stopped → success (no error)
> - execute(resume) when already running → success (no error)
> - Matches universal debugger/media player behavior
> - Simplifies AI assistant logic

The diff adds, at the top of `continueExecution()`, an early return when `#executionState === 'running'` that reports success **without sending `EXIT`**. This is precisely the right lever for an LLM-driven surface: an agent that gets an error from `resume` will retry, and each retry is a round trip that halts the machine again. Idempotence converts a retry loop into a no-op.

**Prevention triad, all three cheap and all three in prior art:**
- Track `stopped` from events only, with an `unknown` state.
- Make `resume` and `pause` idempotent no-ops when already in the target state.
- Never let a helper issue more than one `EXIT` per logical wait — the existing `vice-sync.ts` "exactly one resume per wait" invariant, restated.

### 3.5 Reentrancy: commands issued from inside the receive handler

`IceBroLite:862-877` issues **four** commands from inside `handleStopResume` on every `STOPPED`: two `MEM_GET`s, a `CHECKPOINT_LIST`, and a `DISPLAY_GET`. This is a defensible "refresh the UI on stop" design, but it means an event burst multiplies into a command burst. Its accidental saviour is that the send path (line 726-737, with `SEND_IMMEDIATE` undefined) pops exactly **one** message from `toSend` per receive-loop iteration — an implicit rate limiter.

`c64-debug-mcp` has a related hazard: `#scheduleIdleAutoResume` is called from `#syncMonitorRuntimeState`, which is called from the event path, and it schedules a timer that will later send `EXIT`. So an event indirectly causes a command. It is bounded by the 20-second timer, but the pattern — event handler enqueues command — is the one to be careful with.

**Prevention:** do not send from the event handler. Post to a queue drained by a single serialized writer, so an event storm cannot become a command storm, and so `await` inside an event handler cannot interleave with the next event.

### 3.6 Locking: per-command serialization is not enough

Three designs, increasing in power:

1. **Promise chain** — `c64-debug-mcp:623-630`: every `send()` links onto `#chain`, so exactly one command is in flight. Prevents interleaved writes. Does **not** prevent a second tool call from injecting a `resume` between your `checkpoint_set` and your `EXIT`.
2. **Batched single write** — `cc65-debugger:349-402` (`multiExecBinary`): register all response listeners, then `conn.write(Buffer.concat(frags))` once. Multiple commands cross the wire atomically from the client's perspective, and VICE processes them in order in its `while (monitor_binary_data_available())` loop (`monitor_binary.c:1908`). This is the right tool for `[checkpoint_set, exit]` — nothing can interleave.
3. **Caller-visible mutex** — `cc65-debugger:123-136` exposes `public async lock<T>(fn)`, so a caller can hold a critical section across several round trips (set checkpoint → resume → wait for stop → read memory).

Design 3 is necessary for this project — `runToCheckpoint()` is exactly such a critical section. **But do not copy cc65's implementation, which is broken:**

```ts
public async lock<T>(fn: () => Promise<T>) : Promise<T> {
    this._lockChain = new Promise<void>((res, rej) => {
        const timeout = setTimeout(rej, 5000);
        this._lockChain.then(t => { clearTimeout(timeout); res(t); },
                             err => { clearTimeout(timeout); rej(err); });
    }).then(fn, fn);          // <-- fn runs on BOTH settle paths
    return this._lockChain;
}
```

`setTimeout(rej, 5000)` rejects the gate after 5 s, and `.then(fn, fn)` runs `fn` on rejection too. So the "lock timeout" does not abort — **it runs the critical section anyway, concurrently with the holder that is still running.** Under any operation slower than 5 s (autostart, a long `runToCheckpoint`) the mutex silently degrades into no mutex.

**Warning sign:** two logical operations interleave only under slow conditions; a resume appears in the middle of another wait.
**Prevention:** a real async mutex whose timeout **rejects the waiter** rather than admitting it, with the reason surfaced to the caller. Given this project already uses a synchronous check-and-set `inFlight` guard in the broker for the same class of bug, use the same discipline: acquire and release must be unambiguous, and timeout must mean failure, not entry.
**Phase:** run-stop state machine.

### 3.7 The anti-wedge watchdog

Because every command halts the machine and nothing resumes it automatically, the dominant real-world failure is **the emulator left halted forever**. `c64-debug-mcp` solves this with an idle auto-resume (`session.ts:2860-2909`):

- `#explicitPauseActive` distinguishes "the user asked to pause" from "we incidentally halted it by reading memory". Auto-resume only applies to the latter.
- `STOPPED_IDLE_TIMEOUT_MS = 20_000`: if stopped and not explicitly paused for 20 s, send one `EXIT` "to stay responsive".
- Timer is rescheduled on every state sync and cleared whenever the state is not `stopped`.

And in the other direction, **resume cooldowns** prevent the storm (`session.ts:572-586`): `BOOTSTRAP_RESUME_COOLDOWN_MS = 500`, `PROGRAM_LOAD_RESUME_COOLDOWN_MS = 500`, `DISPLAY_RESUME_COOLDOWN_MS = 250`, `INPUT_RESUME_COOLDOWN_MS = 250`. Every settle loop is guarded by `Date.now() - lastResumeAt >= COOLDOWN` before it will send another `EXIT`. That is a rate limiter on precisely the call that caused this project's outages.

`waitForState` (`session.ts:1841-1883`) adds a **stability requirement**: the target state must hold for `stableMs` (750 ms for input, 3000 ms at bootstrap) before it counts as reached. Without it, the transient `running` between two rapid halts satisfies a naive check and the next command fires into a machine that is about to stop again.

**IceBroLite's variant** for a different symptom (`ViceInterface.cpp:952-983`): every request is registered in `sMessageTimeouts`; a `Tick()` increments all counters and, if any exceeds 100 ticks, sends a **`PING`** and resets all counters. The original request is **never retransmitted**. This is exactly right for this protocol — a `PING` re-triggers `monitor_startup_trap` and unsticks a monitor that is not pumping its command loop, whereas retransmitting a command would double its side effects.

**Prevention summary for the resume-storm problem, all borrowed:**
| Mechanism | Source | Effect |
|---|---|---|
| Idempotent resume | `c64-debug-mcp` `02153d0` | agent retries become free |
| `stopped`-gated commands | `IceBroLite:240,250,261,272` | a second `EXIT` cannot be sent |
| Resume cooldown (250-500 ms) | `c64-debug-mcp:572-586` | bounds resumes/second |
| Stability window before "running" | `c64-debug-mcp:1841-1883` | no firing into a flapping state |
| `explicitPauseActive` + 20 s idle auto-resume | `c64-debug-mcp:2860-2909` | never left wedged |
| `PING` (not retransmit) as the unstick | `IceBroLite:963-982` | no duplicated side effects |
| Batch `[cmd, EXIT]` in one write | `cc65-debugger:349-402` | nothing interleaves |
| Arm the event listener **before** sending | `c64-debug-mcp:1094-1095` | the event cannot be missed |

That last one deserves emphasis. `session.ts:1094-1095`:
```ts
const executionEvent = this.#waitForExecutionEvent(1000);   // subscribe FIRST
await this.#client.continueExecution();                     // then send
```
`RESUMED` can be on the wire before `EXIT`'s own reply is processed. Subscribe, then send, then await. Getting this backwards produces a 1000 ms timeout on every resume — and a client that then retries the resume, which is how storms start.

---

## 4. Reconnect and Error Recovery

### Server-side behaviour you must design around

- **VICE closes the connection on any read error or EOF.** `monitor_binary_receive` (`monitor_binary.c:233-261`) calls `monitor_binary_quit()` — which closes the socket — whenever `vice_network_receive` returns `<= 0`. Likewise `monitor_binary_get_command_line:1921-1927`. So a half-written command, or a client that disconnects mid-frame, drops the whole session.
- **A malformed `api_version` is unrecoverable and silent.** `monitor_binary.c:1948-1952`: if `api_version` is not 1 or 2, VICE `continue`s the outer loop **without consuming the body and without replying**. Your body bytes are then reinterpreted as a fresh command stream, and any `0x02` inside them becomes a false STX. One bad header byte permanently corrupts the server's parser for the life of the connection.
- **Exactly one client at a time.** `connected_socket` is a single global; `monitor_binary_data_available()` (`:263-279`) only calls `vice_network_accept` when `connected_socket == NULL`. A second `connect()` succeeds at the TCP level (it sits in the listen backlog) and is **never serviced** — its writes vanish into a socket buffer, and it sees neither a reply nor an EOF. It is picked up only after the first client disconnects. This has a direct consequence for the broker: a "connect to the monitor port to check liveness" probe against an already-owned emulator looks exactly like a wedged emulator. `c64bridge/src/vice/process.ts` and `c64-debug-mcp`'s `waitForMonitor` both use a connect-probe for readiness — safe only before the real client attaches. **Exclusive per-instance ownership must be enforced by the broker, not hoped for.**

### Client-side recovery in prior art

`c64-debug-mcp/src/session.ts:1968-1999`, `#scheduleRecovery()`:
- **Single-flight** via a `#recoveryPromise` that concurrent callers await rather than duplicating — the same shape as this project's broker `inFlight` guard.
- Distinguishes **socket dead but process alive** (reconnect to the same host/port, then `#hydrateExecutionState()`) from **process dead** (relaunch via `#launchManagedEmulator('restart')`).
- Relaunch resets the whole derived-state block explicitly (`:2385-2400`): `executionState = 'unknown'`, `explicitPauseActive = false`, `pendingCheckpointHit = null`, `lastCheckpointHit = null`, `lastRuntimeEventType = 'unknown'`, and `breakpointLabels.clear()`. **This is the epoch discipline in practice** — not a counter, but an exhaustive invalidation of everything that was true of the old emulator.

There is no epoch/generation counter in any client I read. Nothing detects "the emulator restarted underneath me" other than by observing the socket close. For this project that is a real gap worth closing: checkpoint ids, bank ids, and register ids are all per-instance, and a silent restart (VICE crashed and the broker relaunched on the same port) would leave the client holding stale ids that now refer to different objects — or to nothing, yielding `0x01 OBJECT_MISSING`. **Recommendation:** stamp a client-side epoch, bump it on every connect, tag cached checkpoint ids with it, and reject any tool call carrying a stale epoch with a clear "the emulator restarted" message. This is new work, not borrowed.

### The crash that motivated a real fix

`c64-debug-mcp` commit `76372ff "feat: add nuclear reset mode and improve crash resilience"`:

> Fix critical stability issues when VICE is killed externally:
> - Add transport-error handler to prevent unhandled event crashes
> - Add error handling to all recovery calls to prevent unhandled promise rejections
> - Add error handlers for log streams to prevent crashes on write errors

The client emits `transport-error` on socket error (`vice-protocol.ts:414-420`). With no listener registered, Node's `EventEmitter` **throws**, killing the MCP server process when VICE is killed externally. The diff adds the listener plus `.catch()` on every `void this.#scheduleRecovery()`. Two generic-but-earned lessons: every `EventEmitter` error channel needs a listener from the moment it can fire, and every fire-and-forget `void promise` in a recovery path needs a `.catch`.

The same commit adds a **"nuclear" reset mode**: a full VICE process restart that preserves breakpoints and pause state across the relaunch, for "unrecoverable states (stuck keys, corrupted registers)". Worth having as an explicit escalation tier, and it maps cleanly onto this project's existing broker recycle.

### `pyvicemon`'s disconnect hang

`vice_monitor.py:493-513` + `556-565`. `await_response()` does `resp = get_socket().recv(...)`. On peer close, `recv` returns `b''` — not an exception. `parse_response(b'')` yields `None` immediately, so zero packages are queued and the function returns normally. `roundtrip_command` then raises `ResponseNotFound`, catches it with `pass`, and loops:

```python
while blocking:
    try:
        await_response()
        return pop_response(request_id)
    except ResponseNotFound:
        pass
```

`recv()` on a closed socket returns `b''` immediately and forever. **Result: a 100%-CPU infinite loop that never terminates when VICE exits.** The 5-second `settimeout` does not help, because there is no exception — the read succeeds with zero bytes.

**Warning sign:** client pegs a core and never returns after the emulator quits.
**Prevention:** treat a zero-length read / `'close'` / `'end'` as a terminal condition that rejects every pending request. `c64-debug-mcp:714-729` (`#onClose`) does this correctly. In Node this is mostly free, but the bounded-retry principle still applies: any `while (true)` around a read needs both an EOF exit and a deadline.

### Error-code handling

`monitor_binary_error` (`monitor_binary.c:359-362`) is `monitor_binary_response(0, 0, errorcode, request_id, NULL)` — **response type `0x00`**, not the command's type, with an empty body. Three clients get the ordering right by checking the error code *before* validating the response type: `cc65-debugger:375-380`, `c64bridge:185-190`, `c64-debug-mcp:691-700`. Any client that validates "response type must equal expected" first will report a spurious type mismatch instead of the real error. Note `0x01 OBJECT_MISSING` is a *normal* answer for "no such checkpoint" — throwing on it (as `cc65-debugger` does uniformly) forces callers into try/catch for ordinary control flow.

---

## 5. Protocol Quirks and Version Differences

### 5.1 `JAM` carries no PC — and three independent clients get it wrong

`monitor_binary.c:384-394`:

```c
ui_jam_action_t monitor_binary_ui_jam_dialog(const char *format, ...)
{
    unsigned char response[2];
    uint16_t addr = ...mon_register_get_val(e_comp_space, e_PC);
    write_uint16(addr, response);
    monitor_binary_response(0, e_MON_RESPONSE_JAM, e_MON_ERR_OK, MON_EVENT_ID, response);
```

The PC is computed into `response`, and then **`length` is passed as `0`**. `monitor_binary_response` writes the 12-byte header with `length = 0` and calls `monitor_binary_transmit(body, 0)`, which sends nothing. So `STOPPED` and `RESUMED` have a 2-byte PC body, and `JAM` has an **empty** body. Almost certainly a VICE bug (the arg should be `2`), but it is the behaviour on master `e50d42c` and must be coded against.

Every client I read assumes JAM is shaped like STOPPED:

| Client | Code | Effect on a JAM |
|---|---|---|
| `c64-debug-mcp` | `vice-protocol.ts:357-358` `body.readUInt16LE(0)` | `RangeError` thrown from inside `#onData`. And because the throw precedes `this.#buffer = remainder` (line 667), the JAM frame stays in the buffer, so **every subsequent chunk re-throws**. Unrecoverable, and it takes the MCP server down. |
| `cc65-debugger` | `binary-dto.ts:975-982` `body.readUInt16LE(0)` | `RangeError` swallowed by the `try/catch` at `abstract-grip.ts:92`; the frame is dropped and the reassembler is left desynced. |
| `IceBroLite` | `ViceBinInterface.h:336-341` + `ViceInterface.cpp:695-701` | No bounds check in C++. `GetPC()` reads bytes 12-13 of the buffer, i.e. **the first two bytes of the next message's header**, and assigns that garbage to `cpu->regs.PC`. |

A CPU jam is exactly what happens when you point the PC at data during reverse engineering — i.e. the single most likely event in this project's workload.

**Warning sign:** the client dies or desyncs the moment a program jams; a PC of `$0202` (which is `STX`,`api_version`) appearing after a crash.
**Prevention:** parse event bodies defensively by declared length, not by assumed shape: `programCounter: body.length >= 2 ? body.readUInt16LE(0) : null`. Wrap the whole parse loop in a try/catch that **advances past the offending frame** before rethrowing, so one bad frame cannot poison the buffer forever. Add a JAM fixture with a zero-length body to the parser test suite.
**Phase:** transport/framing. This is a must-fix before anything else, and it is a one-line difference between "handles a jam" and "dies on a jam".

### 5.2 Response type ≠ command type

Verified in source:

| Command | Response type | Source |
|---|---|---|
| `CHECKPOINT_SET` 0x12 | `CHECKPOINT_INFO` **0x11** | `monitor_binary.c:599` |
| `REGISTERS_SET` 0x32 | `REGISTER_INFO` **0x31** | `monitor_binary.c:862` |
| `CHECKPOINT_LIST` 0x14 | N × **0x11**, then 0x14 | `monitor_binary.c:632-637` |
| any error | **0x00** | `monitor_binary.c:359-362` |

`c64bridge` handles this with an explicit per-call override (`viceClient.ts:408`: `this.send(0x32, ..., { responseType: 0x31 })`) on top of a default assumption that response type equals command type. Encode the full mapping as data rather than defaulting, so a future opcode cannot silently mismatch.

### 5.3 `DISPLAY_GET` body layout changed between api_version 1 and 2

`cc65-debugger/src/dbg/binary-dto.ts:863-880` branches on `res.apiVersion < 0x02`: the v1 response embeds a **TARGA-encoded** image that must be stripped (`body.length - (12 + body.readUInt32LE(4))`, then slice off the header) with field offsets at 12/14/16/18/20/22/23; the v2 response is raw INDEXED8 with a different offset layout. The api_version is echoed in response byte 1, so it is detectable per frame.

The project already fixes api_version 2 and `INDEXED8`. The lesson is narrower: **assert `response[1] === 2` on the first frame and fail with a clear "this VICE is too old" message**, rather than mis-parsing a v1 display response into garbage pixels. VICE only accepts api_version 1 or 2 (`monitor_binary.c:1770,1948`), so a v1-only build is real and will not error out on its own.

### 5.4 Version and capability detection

`VICE_INFO` (0x85) at `monitor_binary.c:1439-1451` returns a fixed 10-byte body: `[4, v0, v1, v2, v3, 4, s0, s1, s2, s3]`. The SVN revision is written **only under `#ifdef USE_SVN_REVISION`**, which `configure.ac:745` defaults to false. Distro and release-tarball builds therefore report an SVN revision of **all zeros**. Use the 4-byte version quad for the "VICE ≥ 3.10" gate, never the SVN number.

`CPUHISTORY_GET` (0x86) gives a clean three-way probe:

| Build | Reply | Source |
|---|---|---|
| VICE < 3.10 (opcode absent) | error **0x83** `CMD_INVALID_TYPE` | `monitor_binary.c:1860-1866` (the `else` fallthrough) |
| VICE ≥ 3.10, compiled **without** `FEATURE_CPUMEMHISTORY` | error **0x8f** `CMD_FAILURE` | `monitor_binary.c:1623-1627` |
| VICE ≥ 3.10 with the feature | success | `monitor_binary.c:1618` |

So `CPUHISTORY_GET` is **compile-time optional even on 3.10+** — the version check alone is insufficient, and the two failure modes are distinguishable by error code. Probe once at connect, cache the result, and degrade with a message that names which of the two cases applies.

### 5.5 Smaller traps

- **`CHECKPOINT_INFO` body is 23 bytes**, and byte **22 is the memspace** (`monitor_binary.c:534`). `c64-debug-mcp:294-309` parses only through byte 21 and drops it; harmless today, but it matters for the planned 1541 drive-CPU work, where the memspace is the whole point. (Whether byte 22 exists in older VICE builds is **unverified** — treat it as present only when `body.length >= 23`.)
- **Count fields are ignored by the most experienced client.** `cc65-debugger:824,846` comments out `const count = body.readUInt16LE(0)` for both `BANKS_AVAILABLE` and `REGISTERS_AVAILABLE`, walking `while (cursor < body.length)` with `cursor += item_size + 1` instead. Item size does not include its own byte. Safer: walk to the end of the body and cross-check against the count, warning on mismatch rather than trusting either blindly.
- **VICE validates `ADVANCE_INSTRUCTIONS` after dereferencing it.** `monitor_binary.c:713-720` reads `command->body[0]` and `body[1..2]` and only then checks `if (command->length < 3)`. Harmless for a well-behaved client, but it means malformed commands can make VICE read past the body. Another reason never to send a short body.
- **Endianness is uniform little-endian, hand-rolled on both sides.** `monitor_binary.c:295-339` writes and reads byte-by-byte. `IceBroLite` mirrors this with `uint8_t length[4]` arrays rather than a `uint32_t` field (`ViceBinInterface.h:36-40`) — deliberately, because a packed struct with a `uint32_t` would be padded to 12 bytes and break the 11-byte request header. Not a hazard in TypeScript with `DataView`/`Buffer.writeUInt32LE`, but it explains why the reference C code looks the way it does.
- **The `0x02` STX collides with real data.** `api_version` is also `0x02`, so a corrupted stream will find plausible false frame starts easily. Do not rely on STX alone to validate a frame boundary; also require `buffer[offset+1] === 2` before trusting the length field.
- **Screenshot cropping.** `c64vice/R/helpers.R:12-50` documents that `DISPLAY_GET` returns a large debug area and the `xoff`/`yoff`/`width`/`height` fields describe only the borderless screen; it uses `border_width = 31`, `border_height = 35` to reconstruct a bordered image. Useful concrete numbers for the client-side screenshot phase. Confidence MEDIUM — one source, empirically derived, PAL-specific.

---

## 6. What NOT To Do

Every item below is a concrete pattern present in a real codebase, with the file reference.

1. **Do not read the frame length out of the arriving chunk.** `cc65-debugger/src/dbg/abstract-grip.ts:32-34`. Parse only from offset 0 of a single accumulator.
2. **Do not reset the accumulated byte count when starting a new frame.** Same file, lines 33 and 82-88 — it discards a stashed partial header.
3. **Do not throw from the parse loop before advancing past the bad frame.** `c64-debug-mcp/src/vice-protocol.ts:229-231, 664-667`. A single unparseable frame becomes a permanent crash loop.
4. **Do not assume all three events share a body shape.** `JAM` has none. Three of three clients read a PC that isn't there (§5.1).
5. **Do not resolve a pending request with a `0xffffffff` event.** `simen/vice-mcp/src/protocol/client.ts:239-263`. It is wrong *and* it mostly works, which is the worst combination.
6. **Do not truncate the request id.** `simen/vice-mcp:162-165` (`& 0xff`). Keep it a full uint32, and never mint `0xffffffff`.
7. **Do not assume one reply per request.** `CHECKPOINT_LIST` sends N+1 (§2).
8. **Do not validate response type before error code.** Error replies are type `0x00` (§4).
9. **Do not return pooled/shared parsed objects to async consumers.** `cc65-debugger/src/dbg/binary-dto.ts:604-636` reuses module-level `cache.abstract` / `cache.checkpointInfo` singletons and returns the shared `cache.checkpointInfo` **by reference** for unsolicited checkpoint frames. Its own comment at line 614-615 admits it: *"Special case for checkpoint info since we use it a lot / This will break if not carefully handled in async situations."* Two checkpoint frames in one tick alias each other.
10. **Do not build a mutex whose timeout admits the waiter.** `cc65-debugger/src/dbg/abstract-grip.ts:123-136` — `.then(fn, fn)` runs the critical section on the timeout path too (§3.6).
11. **Do not `await` a stop event with no deadline.** `cc65-debugger:240-256` (`waitForStop`) never rejects, and only removes its listener on a match — a non-matching stop with `continueIfUnmatched` falsy leaks the listener and hangs the promise forever.
12. **Do not gate reads on being paused.** `c64-debug-mcp` commit `37b01ec "fix: allow memory reads while running"` replaced `#ensurePausedForDebug('memory_read')` with `#ensureReady()`. The old version forced a pause/resume round trip per read; `MEM_GET` works regardless and halts for the duration anyway. Every unnecessary pause is an unnecessary resume.
13. **Do not error on a redundant resume/pause.** `c64-debug-mcp` commit `02153d0`. An error makes an LLM retry; a retry is another halt (§3.4).
14. **Do not spin on a read without EOF detection.** `pyvicemon/vice_monitor.py:493-513, 556-565` — infinite busy loop on disconnect (§4).
15. **Do not silently drop `RESUMED`.** `pyvicemon:510-511` — `await_response(ignore_resumed=True)` discards them by default, making run/stop state unknowable.
16. **Do not register an `EventEmitter` error channel without a listener.** `c64-debug-mcp` commit `76372ff` — the process died when VICE was killed externally (§4).
17. **Do not install non-stopping checkpoints casually.** They emit one frame per hit from inside the CPU loop over a blocking socket (§3.2).
18. **Do not connect a second client "just to probe".** VICE accepts only when it has no client; the second connection sits unserviced in the backlog and looks like a wedge (§4).
19. **Do not send anything with an `api_version` outside 1-2, or a short/split header.** VICE replies with nothing and permanently desyncs its own parser (§4).
20. **Do not send from inside the event handler.** `IceBroLite:862-877` turns one stop into four commands; it survives only because its writer is accidentally rate-limited to one message per loop (§3.5).
21. **Do not open a socket per request.** `c64vice/R/requests.R:1401-1406` opens a connection, writes, `Sys.sleep(0.2)`, reads up to 600000 bytes, closes. Each request costs a monitor open/close cycle, the sleep is a guess, and a large `DISPLAY_GET` races the fixed delay.
22. **Do not `readFully(new byte[N])` on a stream.** `viceremote/.../Connection.java:38-43`.

---

## 7. Reuse Assessment

### npm — verified live, 2026-08-12

**There is no reusable VICE binary-monitor client library on npm.** `vice-monitor`, `vice-binary-monitor`, `node-vice`, `viceclient`, `vice-binmon` → all HTTP 404. Registry keyword search for "vice emulator monitor" returns nothing relevant (`romdev-core-vice` is a libretro WASM core, unrelated).

Published, but not libraries:

| Package | Version | License | Reusable as a dependency? |
|---|---|---|---|
| `c64-debug-mcp` | 1.0.14 | MIT | **No.** `package.json` has `bin` only — no `main`, no `exports`. `files` ships `dist/**/*`, so the compiled protocol client is physically present but not part of any public API contract. |
| `c64bridge` | published | — | No. MCP server application. |
| `@henols/vice-mcp` | published | — | This project's own package. |

### c64-debug-mcp — the honest assessment

`henols/c64-debug-mcp` is **the user's own prior project** (author `henrik@predictly.se`, MIT, last touched 2026-04-04). It overlaps this milestone almost exactly: a TypeScript binary-monitor client plus an MCP server that launches VICE with `-binarymonitor -binarymonitoraddress` (`session.ts:2029`).

**Recommendation: vendor `src/vice-protocol.ts` as the starting point for `vice-binmon.ts`, and mine `src/session.ts` for the state machine. Do not depend on the npm package.**

Reasoning:
- Depending on it is not an option — it exposes no importable entry point, and adding one would make this milestone's foundational module hostage to a separate repo's release cycle. That directly conflicts with the constraint that the backend swap live behind `vice.ts`'s `call()` seam.
- Vendoring is unusually clean here: same author, MIT, same language, same runtime target, ESM, no dependencies beyond `node:net` and `node:events`. There is no licence or provenance friction.
- The transport is already ~85% correct: correct frame accumulation (`:224-248`), a `Map`-keyed pending table (`:370`), correct `0xffffffff`-first demux (`:671-675`), full opcode and error-code enums (`:16-83`), and body encoders/decoders for essentially every opcode this milestone needs including `DISPLAY_GET` and `PALETTE_GET`.
- The two defects are known and one-line each: the JAM zero-length body (§5.1) and the throw-on-bad-STX with no resync and no buffer advance (§1). Both must be fixed on the way in, not after.
- The gaps to fill: generalize the `CheckpointList`-specific `linkedCheckpointInfo` hack into cc65's `related[]` mechanism (§2); add the response-type mapping table (§5.2); add an epoch counter (§4); add the `api_version === 2` assertion (§5.3); add the desync counter.
- `session.ts` is where the genuinely expensive knowledge lives — the cooldowns, the stability windows, `explicitPauseActive`, the idle auto-resume, the stop-reason correlation with retroactive `CHECKPOINT_LIST` fallback. **Do not copy that file** (3057 lines, and its concerns belong in this project's existing `vice-sync.ts` / broker layers). Copy the *mechanisms and constants* and reconcile them with the invariants already documented at the top of `vice-sync.ts`, which were derived independently against the fork backend and agree.

### Worth vendoring or transcribing from elsewhere

| Artifact | Source | Why |
|---|---|---|
| `related[]` multi-response accumulation | `cc65-debugger/src/dbg/abstract-grip.ts:373-388` | The general solution to one-request-N-replies. ~15 lines. |
| Batched single-write pipelining | `cc65-debugger:349-402` | Makes `[checkpoint_set, exit]` atomic. |
| `waitForStop(pcRange, continueIfUnmatched)` **concept** | `cc65-debugger:240-256` | The right primitive for "resume and wait for *my* stop", but reimplement with a deadline and guaranteed listener cleanup. |
| Request-id wrap discipline + comment | `c64bridge/src/vice/viceClient.ts:218` | 3 lines, prevents a class of collision. |
| `PING`-as-unstick on request timeout | `IceBroLite/src/ViceInterface.cpp:963-982` | Recovery that does not duplicate side effects. |
| Full opcode/response/error enums | `c64-debug-mcp/src/vice-protocol.ts:16-83` or `cc65-debugger/src/dbg/binary-dto.ts` | Cross-check both against `monitor_binary.c:100-200`; they are the two most complete. |
| Border constants 31 / 35 for display cropping | `c64vice/R/helpers.R:34-48` | Screenshot phase. MEDIUM confidence. |

**Ignore:** `viceremote` (text monitor, fixed-length reads), `c64vice` (synchronous, socket-per-request — except the crop constants), `simen/vice-mcp` (valuable only as the worked example of the event-resolves-a-promise bug), `pyvicemon` (Python, but its `parse_response` generator is a clean statement of the framing algorithm if a second reference is wanted).

**The single most valuable source is not a client at all**: `src/monitor/monitor_binary.c`. Every quirk in §5 came from reading it, and three of them (JAM's empty body, error type `0x00`, the unconditional trace-event emission) are invisible from any client's README and are wrong or missing in the clients themselves. Budget time in the framing phase to read it directly rather than trusting any client's model of it.

---

## Pitfall Register

Ordered by cost of getting it wrong. "Phase" refers to the implementation phase that should own the mitigation.

| # | Pitfall | Warning sign | Prevention | Phase |
|---|---|---|---|---|
| P1 | `JAM` has a **zero-length** body; clients read a PC that isn't there | Client dies or desyncs the instant a program jams; PC reads as `$0202` | Parse event bodies by declared length; `body.length >= 2 ? readUInt16LE(0) : null`; JAM fixture in parser tests | Framing |
| P2 | Trace (`stop:false`) checkpoints emit a frame per hit from the CPU loop over a **blocking** socket → mutual deadlock | VICE window unresponsive but alive; client read buffer grows; send-Q non-draining on the emulator side | Always-on reader; gate `stop:false` behind explicit opt-in; hot-range refusal list; per-second event rate limit that auto-disables the offending id; prefer `hit_count` polling | Run-stop, checkpoints |
| P3 | A `0xffffffff` event resolves a pending request | Subtly stale register/checkpoint answers; one dropped reply per monitor entry | Branch on `requestId === 0xffffffff` **first**, into an event bus that cannot resolve promises; test with an injected mid-request STOPPED | Framing |
| P4 | Reading the frame length from the arriving chunk / discarding a partial header | Fine in manual tests, corrupts after a screenshot or event burst | Single accumulator, parse from offset 0 only; byte-at-a-time parser test | Framing |
| P5 | Every command halts the machine; resume is a separate `EXIT`; retries multiply | Repeated `resume` calls in logs; emulator instability under agent retry loops | Idempotent resume/pause; `stopped`-gated commands; 250-500 ms resume cooldown; one `EXIT` per logical wait | Run-stop |
| P6 | Emulator left halted forever (nothing auto-resumes) | Machine frozen after a tool call that read state; no `RESUMED` in the event log | `explicitPauseActive` flag + ~20 s idle auto-resume for incidental halts only | Run-stop |
| P7 | Throwing from the parse loop without advancing past the bad frame | One malformed frame → permanent crash loop | Advance the buffer before rethrowing; desync counter; resync by dropping one byte, loudly | Framing |
| P8 | `CHECKPOINT_LIST` returns N+1 frames on one request id | Only the first checkpoint returned, or a count of 0 with data present | Generalized `related[]` accumulation keyed on a declared terminal response type | Framing |
| P9 | Response type ≠ command type (`0x12→0x11`, `0x32→0x31`, errors `→0x00`) | Spurious "mismatched response type" instead of the real error | Explicit command→expected-response table; check error code before type | Framing |
| P10 | `STOPPED` carries no reason | Stops attributed to the wrong cause, or reason reported as a guess | Buffer the preceding `CHECKPOINT_INFO(hit=1)` with a ~1 s settle window; retroactive `CHECKPOINT_LIST` / `currentlyHit` fallback; expose an honest `unknown` | Run-stop |
| P11 | Awaiting an event *after* sending the command that causes it | Resume/step times out ~every time, then gets retried | Subscribe, then send, then await (`session.ts:1094-1095`) | Run-stop |
| P12 | Per-command serialization without caller-level critical sections | A concurrent tool call injects a resume mid-wait | Real async mutex (timeout ⇒ reject, never admit) plus batched single-write for `[cmd, EXIT]` | Run-stop |
| P13 | VICE services **exactly one** client; extras sit unserviced in the backlog | A liveness probe hangs with no reply and no EOF; looks identical to a wedge | Broker enforces exclusive ownership per instance; connect-probes only before the real client attaches | Broker integration |
| P14 | Silent, permanent server-side desync from a bad `api_version` or split header | Requests stop being answered entirely, no error | Never send `api_version` other than 2; write each command in a single `write()`; assert response byte 1 === 2 on connect | Framing |
| P15 | No epoch — a silent emulator restart leaves stale checkpoint/bank ids | Sudden `0x01 OBJECT_MISSING` on ids that worked a moment ago | Client-side epoch bumped on every connect; tag cached ids; invalidate the full derived-state block on reconnect | Reconnect/broker |
| P16 | No EOF detection around a read loop | 100% CPU, never returns, after VICE exits | Treat zero-length read / `'close'` as terminal; reject all pending; bounded retries with a deadline | Framing |
| P17 | `CPUHISTORY_GET` is compile-time optional even on VICE ≥ 3.10; SVN revision is zeros in distro builds | Version says 3.10 but the opcode fails | Probe once and branch on the error code: `0x83` = too old, `0x8f` = feature not compiled in, success = available. Gate on the 4-byte version quad, never the SVN number | Capability detection |
| P18 | Pooled/shared mutable parsed objects returned to async consumers | Two events in one tick alias each other | Return fresh objects from the parser; no module-level caches | Framing |
| P19 | Gating reads on a paused state | Twice the round trips per read, and an extra resume each time | `MEM_GET` needs no pause; do not add one | Direct tools |
| P20 | `EventEmitter` error channels without listeners; `void promise` without `.catch` | MCP server process dies when VICE is killed externally | Register `error`/`transport-error`/`close` listeners at construction; `.catch()` every fire-and-forget recovery call | Framing, reconnect |

---

## Gaps and Unverified Items

- **Whether `CHECKPOINT_INFO` byte 22 (memspace) exists in VICE 3.7/3.8.** Present on master `e50d42c`. `c64-debug-mcp` ignores it, so nothing in the prior art confirms its history. Treat as present only when `body.length >= 23`. Matters for the 1541 drive-CPU work.
- **The exact 3.7 → 3.8 → 3.9 → 3.10 delta.** Only two version-sensitive facts are source-verified: the `DISPLAY_GET` api_version 1 vs 2 layout change (from `cc65-debugger`'s branch) and `CPUHISTORY_GET`'s 3.10 requirement plus its `FEATURE_CPUMEMHISTORY` compile guard. A full per-version opcode matrix would need building each release, which the milestone's empirical-probe requirement should cover.
- **Whether `monitor_binary_transmit`'s short-write path (`monitor_binary.c:210-225`) can truncate a large `DISPLAY_GET`.** It returns `-1` without retrying if `vice_network_send` returns fewer bytes than requested. On a blocking socket this should not happen, but I did not read `vice_network_send`. If it can, a truncated body would desync the client — another reason the parser must survive and report desync rather than assume it cannot occur. **Unverified; low probability, high impact.**
- **`sResumeMeansStopped` in `IceBroLite/src/ViceInterface.cpp:117`** is declared, cleared in `handleStopResume:882`, and every site that would set it (lines 254, 265, 276, after step/step-over/step-out) is **commented out**. Someone tried to model "after a step, the `RESUMED` you receive actually means it stopped" and abandoned it. I could not recover the reasoning — the clone is shallow and the history is not in the tree. Worth a targeted look at whether `ADVANCE_INSTRUCTIONS` produces a `RESUMED`/`STOPPED` pair, since the empirical probe can answer it directly.
- **No client anywhere handles the unsolicited `REGISTER_INFO` on monitor open as a *gift*.** All of them either ignore it or (in simen's case) mis-resolve a request with it. It contains a full, free register snapshot at the moment of every halt. Using it would remove a `REGISTERS_GET` round trip from every stop-and-inspect cycle — a small performance win nobody has taken.
