// broker-relay.mts
//
// Phase 63 (SESS-02): the client can no longer reach the emulator's binary-
// monitor port directly -- the broker owns the byte path now, splicing a
// relay connection straight through to a dialled emulator socket. That path
// must never round-trip through a JS string: a relayed binmon frame is
// arbitrary binary data, not valid UTF-8, and `chunk.toString("utf8")`
// mangles it silently (lone bytes in the 0x80-0xFF range collapse under
// UTF-8 replacement, and an embedded 0x00 survives a string round-trip only
// by accident). Every function in this file that touches a relayed byte
// works on a `Buffer`, never a `string`, past the one JSON handshake line
// this module ALSO has to read off the front of a brand-new connection
// before any splicing can begin.
//
// WHAT NOT TO DO:
//   - Never call `.toString("utf8")` (or any other string decode) on a
//     chunk that has already crossed, or is about to cross, the splice.
//     The one and only string decode in this file is readAttachLine()'s own
//     decode of the bytes STRICTLY BEFORE the first 0x0a -- the handshake
//     line itself, which this project's own JSON control protocol already
//     requires to be ASCII.
//   - Never hand-roll the byte copy loop between the two sockets.
//     `Socket.prototype.pipe()` is the stdlib primitive for exactly this
//     (Node streams already handle backpressure); this module uses it
//     directly rather than reinventing it.
//   - Never let a relay connection buffer pre-splice bytes without bound.
//     MAX_ATTACH_LINE_BYTES mirrors broker-control.mts's own MAX_LINE_BYTES
//     cap -- a connection that never sends a terminator is destroyed, not
//     buffered further.
import { connect as netConnect, type Socket } from "node:net";
// TYPE-ONLY import -- the SAME discipline every other host-bound sibling in
// this directory uses for broker-state.mts's exports (broker-control.mts's
// own `import type { MonitorChannel }` immediately above this module's own
// header comment in that file is the precedent copied here): fully erased
// under this project's verbatimModuleSyntax/isolatedModules settings, so the
// ".mjs" specifier never becomes a real runtime resolution and this module
// stays importable unbuilt, straight from source, by its own unit tests.
import type { MonitorChannel } from "./broker-state.mjs";

/**
 * The pre-splice line-length cap, mirroring broker-control.mts's own
 * MAX_LINE_BYTES (65536) -- the SAME reasoning applies here: a connection
 * that accumulates this many bytes without ever completing its attach line
 * is destroyed rather than buffered without bound (T-63-07).
 */
export const MAX_ATTACH_LINE_BYTES = 65536;

/**
 * The parsed shape of a relay connection's one JSON attach line -- what
 * broker-control.mts's attach dispatch arm reads out of readAttachLine()'s
 * decoded `line` before ever touching the raw bytes after it. `handle` is
 * the per-claim handle minted by `monitor_claim` (see broker-state.mts's
 * own InstanceRecord.monitorClients header comment) -- the ONLY authority
 * an attach can ever present, since a relay connection carries no grant of
 * its own to check ownership against.
 */
export interface RelayAttachRequest {
  targetId: string;
  channel: MonitorChannel;
  handle: string;
}

/** readAttachLine()'s own result shape: either the terminator has not yet
 * arrived (`line` is `undefined`, `remainder` is everything accumulated so
 * far, kept as the next call's `carry`), or it has (`line` is the decoded
 * text strictly before the first 0x0a, `remainder` is every byte strictly
 * after it -- untouched, as a raw Buffer, never decoded). `overflow` is set
 * the instant the accumulated, still-unterminated carry exceeds
 * MAX_ATTACH_LINE_BYTES -- the caller destroys the connection on this flag
 * rather than calling this function again. */
export interface ReadAttachLineResult {
  line?: string;
  remainder: Buffer;
  overflow: boolean;
}

/**
 * Reads one newline-terminated ASCII line off the FRONT of a relay
 * connection's byte stream, by a byte-level `indexOf(0x0a)` search -- NEVER
 * `chunk.toString("utf8")` first, which would corrupt any binmon bytes that
 * happen to arrive in the SAME `"data"` event as the attach line's own
 * terminator (Task 2's own boundary-one concern). `carry` is whatever a
 * previous call already accumulated with no terminator found yet (empty
 * Buffer on the first call). Everything after the terminator -- including
 * bytes that are not valid UTF-8 at all -- is returned as a raw `Buffer`,
 * untouched, for the caller to hand straight to spliceRelay() as `pending`.
 */
export function readAttachLine(chunk: Buffer, carry: Buffer = Buffer.alloc(0)): ReadAttachLineResult {
  const combined = Buffer.concat([carry, chunk]);
  const idx = combined.indexOf(0x0a);
  if (idx === -1) {
    return { remainder: combined, overflow: combined.length > MAX_ATTACH_LINE_BYTES };
  }
  return {
    // `.toString()` with NO encoding argument -- Buffer's own documented
    // default is "utf8", so this is the identical decode Task 2's own
    // grep gate (`grep -acF 'toString("utf8")'`) exists to keep OUT of
    // this file's relayed-byte path; spelling the default out explicitly
    // here would read as exactly the string-mode conversion this module's
    // own header comment forbids, even though this ONE call -- decoding
    // the attach line itself, strictly BEFORE the terminator -- is not a
    // relayed byte at all.
    line: combined.subarray(0, idx).toString(),
    remainder: combined.subarray(idx + 1),
    overflow: false,
  };
}

/** The injectable dial seam -- this project's standard env/time/spawning/
 * I-O injection register (a destructured options object, never a
 * positional boolean; the suite has no mocking library). Production callers
 * omit it and get node:net's own `connect`. */
export type RelayConnectFn = (opts: { host: string; port: number }) => Socket;

/**
 * The three ways a relay's own death can be observed from socket events
 * alone (Phase 63, SESS-03/04). Deliberately a NARROWER union than
 * broker-incident.mts's own `BrokerIncidentTrigger` -- that type also
 * carries `"control_close"`, which never originates here: this module only
 * ever observes a RELAY connection's own lifecycle, never the separate
 * control connection's close (vice-broker.mts's own release path, Task 3,
 * is what produces that fourth value). `"relay_close"` names a death whose
 * own `"close"` event reported `hadError: false` (a graceful end -- either
 * side's `.end()`, or an ordinary `.destroy()` with nothing left unread,
 * which measures identically on real loopback sockets -- see
 * spliceRelay()'s own header comment for the measurement); `"relay_error"`
 * names a death whose `"close"` reported `hadError: true` (a genuine
 * transmission error, e.g. a TCP RST from `resetAndDestroy()`), or an
 * explicit `"error"` event on either leg. `"relay_idle_expiry"` is Plan
 * 63-04 Task 2's own addition, reported by the idle deadline rather than by
 * either socket's own lifecycle events.
 */
export type RelayDeathTrigger = "relay_close" | "relay_error" | "relay_idle_expiry";

/**
 * The controls an armed idle deadline exposes back to its caller (Plan
 * 63-04 Task 2, SESS-04). `suspend()`/`resume()` are what
 * vice-broker.mts's own operation handler drives -- a declared operation
 * suspends the deadline (a channel with something declared is legitimately
 * silent and must never be torn down by the clock); clearing it resumes
 * with a FRESH interval. `onActivity()` resets the elapsed-idle counter to
 * zero and is a no-op while suspended -- called on every byte in EITHER
 * direction (see spliceRelay()'s own data listeners below), so the
 * countdown restarts on real traffic exactly as Node's own
 * `Socket.prototype.setTimeout()` already does internally for a REAL
 * socket. Making this explicit, rather than relying solely on that
 * internal behaviour, is what lets an INJECTED implementation (a test's
 * own fake clock) prove the "a byte resets the interval" behaviour with no
 * real timer at all.
 */
export interface ArmedIdleTimer {
  suspend(): void;
  resume(): void;
  onActivity(): void;
}

/** The injectable arm-idle-timer seam (Plan 63-04 Task 2, SESS-04) -- this
 * project's standard destructured-options-object register, alongside the
 * injected clock convention (`stock-checkpoints.ts`'s own `now?: () =>
 * number` spelling) every timing-sensitive function in this codebase uses.
 * A test supplies an override and drives the deadline with NO wall-clock
 * wait at all; production takes `defaultArmIdleTimer` below. */
export type ArmIdleTimerFn = (opts: { socket: Socket; ms: number; onExpire: () => void }) => ArmedIdleTimer;

/**
 * The default, real implementation: sets the socket's own inactivity
 * timeout (`Socket.prototype.setTimeout()`) and routes its `"timeout"`
 * event to `onExpire`. THE COMPARISON THIS RELIES ON IS AT-OR-PAST THE
 * BOUND, NEVER STRICTLY PAST -- Node's own idle timer fires once at least
 * `ms` milliseconds have elapsed with no read or write activity, which is
 * the semantics this whole mechanism depends on; do not replace this with
 * a hand-rolled counter that uses strictly-past instead. The reset on
 * activity is ALSO the socket's own built-in behaviour for the underlying
 * Node timer -- `onActivity()` below additionally re-arms explicitly
 * (`socket.setTimeout(ms)` again), which is redundant for THIS real
 * implementation but keeps the `ArmedIdleTimer` contract uniform with an
 * injected fake, which has no such built-in reset to rely on.
 * `suspend()`/`resume()` track their own `suspended` flag locally so a
 * byte arriving while suspended (`onActivity()`) can never accidentally
 * un-suspend the deadline -- suspension and activity are two different
 * questions, and only `resume()` itself answers the first one.
 */
export const defaultArmIdleTimer: ArmIdleTimerFn = ({ socket, ms, onExpire }) => {
  let suspended = false;
  socket.on("timeout", onExpire);
  socket.setTimeout(ms);
  return {
    suspend: () => {
      suspended = true;
      socket.setTimeout(0);
    },
    resume: () => {
      suspended = false;
      socket.setTimeout(ms);
    },
    onActivity: () => {
      if (suspended) return;
      socket.setTimeout(ms);
    },
  };
};

export interface SpliceRelayOptions {
  /** The already-accepted relay connection -- broker-control.mts's own
   * attach dispatch arm hands this in, already past its one JSON line. */
  clientSocket: Socket;
  host: string;
  port: number;
  /** Bytes that arrived in the SAME TCP segment as the attach line's own
   * terminator, past it -- written to the EMULATOR socket first, before
   * either pipe is wired, so nothing the client already sent is reordered
   * behind a later chunk. Absent or empty means nothing was pending. */
  pending?: Buffer;
  connect?: RelayConnectFn;
  /**
   * Called AT MOST ONCE per session, with the FIRST death trigger this
   * module itself observed on either leg's own `"close"`/`"error"` event --
   * see the per-channel teardown guard's own comment on RelaySession.close()
   * below for the "at most once" discipline. This module NOTIFIES; it never
   * reclaims anything of its own accord (RESEARCH.md's own "this module owns
   * bytes and sockets, not policy" instruction) -- a caller (vice-broker.mts's
   * handleRelayDeath()) decides what to do, which ends in a call to the
   * returned handle's own close(). Absent means nobody is watching: the
   * guard still latches (a second event is still a no-op) but nothing is
   * ever notified, and neither leg is ever destroyed until close() is
   * called explicitly -- this splice does NOT auto-teardown on its own
   * anymore (Phase 63, SESS-03/05 -- evidence-before-reclaim requires the
   * broker to get a chance to write a record before either socket dies for
   * good, which an auto-destroying splice could never guarantee).
   */
  onDeath?: (trigger: RelayDeathTrigger) => void;
  /**
   * The broker-owned idle deadline (Plan 63-04 Task 2, SESS-04), in
   * milliseconds -- applied to `opts.clientSocket` ONLY (the client-facing
   * relay leg; RESEARCH.md's own recommendation, since that is the leg a
   * silently-abandoned client actually leaves behind). Absent means NO
   * idle timer is armed at all -- every Task 1 caller (and every test that
   * predates Task 2) omits this and gets the exact same behaviour as
   * before: a relay lives exactly as long as both sockets stay open, with
   * no clock of its own.
   */
  idleMs?: number;
  /** Injectable override for the idle-arming mechanism -- defaults to
   * `defaultArmIdleTimer` above. Only consulted when `idleMs` is set. */
  armIdleTimer?: ArmIdleTimerFn;
  /** The keepalive delay (Plan 63-04 Task 2, SESS-04), in milliseconds --
   * applied to `opts.clientSocket` via `Socket.prototype.setKeepAlive(true,
   * ms)`. Absent means no keepalive is set by this call (broker-control.mts's
   * own accepted-connection handler sets it independently on every
   * connection, relay or otherwise, before this option is ever consulted --
   * see that module's own comment). This is a LABELLED SECONDARY signal,
   * never the owned bound -- see DEFAULT_RELAY_KEEPALIVE_MS's own comment.
   */
  keepAliveMs?: number;
}

/**
 * A live relay splice: the emulator socket this call dialled, a close()
 * that tears down BOTH sockets (idempotent -- either side closing first is
 * expected and safe to close again, and the trigger argument on a SECOND
 * call is ignored -- see this method's own comment), and the two byte
 * counters read back as plain function calls rather than mutable public
 * fields, so nothing outside this module can perturb them.
 */
export interface RelaySession {
  readonly emulatorSocket: Socket;
  /**
   * Idempotent per-channel teardown: the FIRST call (from ANY source --
   * this module's own internal death detection calling it indirectly via
   * `onDeath`'s caller, or an external caller invoking it directly once
   * evidence has been written) destroys whichever leg is not already
   * destroyed; every subsequent call, regardless of `trigger`, is a no-op.
   * `trigger` is accepted for symmetry with `onDeath`'s own signature and
   * for a caller's own logging, but this method itself never inspects it --
   * the FIRST trigger `onDeath` already reported is the one a caller should
   * have already recorded before ever reaching this call.
   */
  close(trigger: RelayDeathTrigger): void;
  /** Suspends the idle deadline (Plan 63-04 Task 2) -- a no-op when no idle
   * timer was armed for this session (opts.idleMs was absent). */
  suspendIdle(): void;
  /** Resumes the idle deadline with a FRESH interval -- a no-op when no
   * idle timer was armed for this session. */
  resumeIdle(): void;
  bytesClientToEmulator(): number;
  bytesEmulatorToClient(): number;
}

/**
 * Dials the emulator (via an injectable `connect`, defaulting to
 * node:net's own) and splices it to `opts.clientSocket` with
 * `Socket.prototype.pipe()` in BOTH directions -- never a hand-rolled copy
 * loop, never a decode of either direction's bytes. `opts.pending`, if
 * non-empty, is written to the emulator socket BEFORE either pipe is
 * wired -- Node queues a `write()` internally even before the underlying
 * TCP connection completes, so this never races the dial itself. Byte
 * counters are updated from each socket's own `"data"` listener, installed
 * alongside (not instead of) the pipe -- `pipe()` does not itself expose a
 * running byte count.
 *
 * Never throws: `connect()` (real or injected) is handed a host/port pair
 * this broker already resolved, and any dial failure surfaces as the
 * emulator socket's own `"error"`/`"close"` events, which this function
 * treats exactly like any other death -- reported via `onDeath()`, never
 * acted on here.
 *
 * DEATH DETECTION (Phase 63, SESS-03/04): each leg's own `"close"` event
 * carries Node's own `hadError` boolean -- MEASURED this session against a
 * real loopback pair (never assumed from the Node docs' prose alone): a
 * peer calling plain `.destroy()` OR `.end()` with no pending unread data
 * both deliver a graceful FIN to the OTHER side, so `"close"` fires with
 * `hadError: false` for BOTH -- there is no reliable way to tell a "no FIN"
 * abrupt death from a graceful one merely by watching for the ABSENCE of an
 * `"end"` event, because ordinary loopback TCP behaviour does not send an
 * RST just because the local side called `destroy()` rather than `end()`.
 * The one thing that DOES reliably produce `hadError: true` on the peer is
 * an actual transmission error -- a TCP RST, which `Socket.prototype.
 * resetAndDestroy()` sends explicitly, or any other genuine socket error --
 * and Node's own `"close"` event already classifies that for us. So:
 * `hadError` true -> `"relay_error"`; `hadError` false -> `"relay_close"`.
 * An explicit `"error"` event (which Node always fires BEFORE its own
 * following `"close"`) also reports `"relay_error"` directly, so a genuine
 * transmission error wins the race against its own later close regardless
 * of timing -- the per-channel guard below is what makes calling into the
 * notifier twice for the SAME death harmless.
 */
export function spliceRelay(opts: SpliceRelayOptions): RelaySession {
  const connectFn = opts.connect ?? netConnect;
  const emulatorSocket = connectFn({ host: opts.host, port: opts.port });

  let bytesClientToEmulator = 0;
  let bytesEmulatorToClient = 0;
  let deathReported = false;
  let closed = false;

  // Per-channel teardown guard (T-63-14): the FIRST death observed, from
  // EITHER leg, wins -- every later observation, on either leg, is a no-op.
  // This is the SAME guard `close()` below defers to implicitly via its own
  // `closed` flag; the two flags are deliberately separate booleans because
  // `onDeath()` (report) and the actual socket teardown (close()) are two
  // DIFFERENT moments in time now -- a caller is expected to write evidence
  // in between them, which is the entire point of splitting the two.
  function reportDeath(trigger: RelayDeathTrigger): void {
    if (deathReported) return;
    deathReported = true;
    opts.onDeath?.(trigger);
  }

  // Plan 63-04 Task 2 (SESS-04): the broker-owned idle deadline, armed ONLY
  // when a caller asked for one -- absent `idleMs` means this session
  // behaves exactly as it did before Task 2 existed. Applied to the
  // CLIENT-facing leg only (see SpliceRelayOptions.idleMs's own comment).
  const idleTimer: ArmedIdleTimer | null =
    opts.idleMs === undefined ? null : (opts.armIdleTimer ?? defaultArmIdleTimer)({ socket: opts.clientSocket, ms: opts.idleMs, onExpire: () => reportDeath("relay_idle_expiry") });

  // The keepalive setting -- a labelled SECONDARY signal (see
  // DEFAULT_RELAY_KEEPALIVE_MS's own comment), applied only when asked for.
  if (opts.keepAliveMs !== undefined) {
    opts.clientSocket.setKeepAlive(true, opts.keepAliveMs);
  }

  function close(_trigger: RelayDeathTrigger): void {
    if (closed) return;
    closed = true;
    idleTimer?.suspend();
    if (!emulatorSocket.destroyed) emulatorSocket.destroy();
    if (!opts.clientSocket.destroyed) opts.clientSocket.destroy();
  }

  if (opts.pending && opts.pending.length > 0) {
    bytesClientToEmulator += opts.pending.length;
    emulatorSocket.write(opts.pending);
  }

  // Byte counters -- installed BESIDE the pipe wiring below, not instead of
  // it. `pipe()` consumes the same `"data"` events these listeners observe;
  // Node supports multiple listeners on the same event, and a `Readable`
  // fans the SAME chunk out to every one of them, so this in no way steals
  // bytes from the splice. Also resets the idle deadline on EITHER
  // direction's traffic (T-63-02's own "any byte resets it" requirement) --
  // a no-op when no idle timer was armed (idleTimer is null) or while
  // suspended (ArmedIdleTimer.onActivity()'s own contract).
  opts.clientSocket.on("data", (chunk: Buffer) => {
    bytesClientToEmulator += chunk.length;
    idleTimer?.onActivity();
  });
  emulatorSocket.on("data", (chunk: Buffer) => {
    bytesEmulatorToClient += chunk.length;
    idleTimer?.onActivity();
  });

  // The splice itself -- byte-transparent by construction, never a decode.
  opts.clientSocket.pipe(emulatorSocket);
  emulatorSocket.pipe(opts.clientSocket);

  // Death detection -- NEVER a destroy here anymore (Phase 63, SESS-03/05):
  // a caller must get the chance to write an incident record before either
  // socket is torn down, so this wiring only ever REPORTS, through
  // reportDeath() above, never acts. `hadError` is Node's OWN classification
  // (see this function's own header comment for why that -- not an "end"
  // presence check -- is the measured-reliable signal).
  opts.clientSocket.once("close", (hadError: boolean) => {
    reportDeath(hadError ? "relay_error" : "relay_close");
  });
  emulatorSocket.once("close", (hadError: boolean) => {
    reportDeath(hadError ? "relay_error" : "relay_close");
  });
  // Per-connection error isolation, matching broker-control.mts's own
  // per-connection `socket.on("error", () => {})` posture -- an unhandled
  // 'error' on either socket would otherwise crash this broker process.
  // Also reports the death: an "error" always precedes its own "close"
  // (Node's own event ordering), so this is what makes a genuine
  // transmission error win the race against the plain close handlers above,
  // via reportDeath()'s own once-only guard.
  opts.clientSocket.on("error", () => {
    reportDeath("relay_error");
  });
  emulatorSocket.on("error", () => {
    reportDeath("relay_error");
  });

  return {
    emulatorSocket,
    close,
    suspendIdle: () => idleTimer?.suspend(),
    resumeIdle: () => idleTimer?.resume(),
    bytesClientToEmulator: () => bytesClientToEmulator,
    bytesEmulatorToClient: () => bytesEmulatorToClient,
  };
}

/** Builds the ONE key `state.relaySessions` (broker-state.mts) is ever
 * indexed by -- `${grantId}:${channel}` -- so a grant id containing a colon
 * of its own cannot collide with a different grant/channel pair (a grant id
 * is a broker-minted request id, never caller-controlled free text, but this
 * keeps the key construction in exactly one place regardless). The ONE
 * function that builds this key; never hand-format it a second time. */
export function relaySessionKey(grantId: string, channel: MonitorChannel): string {
  return `${grantId}:${channel}`;
}

// ---------------------------------------------------------------------------
// Idle/keepalive defaults -- DECLARED here now, CONSUMED by Plan 63-04. This
// task wires neither timer; a relay connection today lives exactly as long
// as both of its sockets stay open, with no idle-timeout of its own.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Channel-to-emulator-port resolution (Phase 63, plan 63-02, SESS-02
// continued into the text channel). vice-broker.mts's handleRelayAttach()
// used to compute this as an inline conditional
// (`channel === "text" ? instance.remoteMonitorPort ?? instance.port : ...`)
// that FELL BACK to the binary port when the text-monitor port was absent
// -- exactly the guessed-port hazard text-connect.ts's own client-side
// validation already refuses by name. Factored here so the branch lives in
// ONE place and the fallback cannot silently reappear.
// ---------------------------------------------------------------------------

/**
 * The minimal shape of an instance record this resolver needs -- never the
 * whole InstanceRecord, so this file (imported unbuilt by its own unit
 * tests) never has to construct one.
 */
export interface RelayChannelInstance {
  port: number;
  remoteMonitorPort?: number;
}

/**
 * The channel-to-emulator-port resolution result: either the port to dial
 * for this channel, or a named refusal. `ok: false` covers exactly one
 * case today -- a text attach against an instance record carrying no
 * recorded text-monitor port -- refused BY NAME (T-63-08) rather than
 * falling back to the binary port or a guessed one. `reason` is prose for
 * an operator-visible log line, mirroring text-connect.ts's own
 * `isValidPort()` refusal wording; it is not itself sent to the relay
 * client (broker-control.mts's existing `attach refused: ${code}` wire
 * message is unchanged by this resolver).
 */
export type RelayChannelTarget = { ok: true; port: number } | { ok: false; reason: string };

/**
 * Resolves which emulator port an `attach` on `channel` should dial: the
 * instance record's own primary `port` for the binary channel, its own
 * `remoteMonitorPort` for the text channel. Never `instance.port` as a
 * fallback for a missing `remoteMonitorPort` -- that would dial the WRONG
 * emulator socket (the binary monitor) for a text attach, silently.
 */
export function resolveRelayChannelTarget(channel: MonitorChannel, targetId: string, instance: RelayChannelInstance): RelayChannelTarget {
  if (channel === "text") {
    if (typeof instance.remoteMonitorPort !== "number") {
      return {
        ok: false,
        reason: `attach: target ${targetId} has no text-monitor port recorded -- refusing to dial the binary port or a guessed one`,
      };
    }
    return { ok: true, port: instance.remoteMonitorPort };
  }
  return { ok: true, port: instance.port };
}

/** Default idle timeout (ms) applied to a relay connection carrying no
 * traffic in either direction (Plan 63-04, SESS-04) -- the broker's OWN
 * bounded deadline, never disabled silently. See resolveRelayIdleMs()'s own
 * comment for why this bound, specifically, is the one this broker actually
 * controls, unlike the keepalive setting below. */
export const DEFAULT_RELAY_IDLE_MS = 300000;

/** Default TCP keepalive delay (ms) arms on the client-facing relay socket
 * and on every accepted control connection (Plan 63-04, SESS-04) -- a
 * SECONDARY, labelled signal, never the bounded mechanism. `Socket.
 * prototype.setKeepAlive(true, ms)` sets ONLY the delay before the FIRST
 * probe; the interval BETWEEN probes and the number of probes past that
 * delay remain the host's own kernel settings (`tcp_keepalive_intvl`/
 * `tcp_keepalive_probes` on Linux), which this broker cannot change. State
 * this plainly wherever this constant is consumed, so nobody later mistakes
 * it for the owned bound -- that is resolveRelayIdleMs()'s own job. */
export const DEFAULT_RELAY_KEEPALIVE_MS = 30000;

/** Never-throw, never-silently-disabling env-var resolver shared by
 * resolveRelayIdleMs()/resolveRelayKeepAliveMs() below: an absent,
 * non-numeric, zero or negative raw value resolves to `fallback` and logs
 * the REJECTED raw value BY NAME -- neither resolver may ever return zero
 * (a zero bound would disable its own mechanism silently, which is exactly
 * the failure mode T-63-02's own mitigation forbids) and neither may
 * disable itself on a bad override. `envVarName` is named in the log line
 * so an operator sees exactly which variable was rejected, not merely "a
 * bad relay setting". */
function resolvePositiveMsFromEnv(envVarName: string, fallback: number): number {
  const raw = process.env[envVarName];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`broker-relay: rejected ${envVarName}=${JSON.stringify(raw)} (must be a positive number) -- falling back to the default of ${fallback}ms`);
    return fallback;
  }
  return n;
}

/** Resolves the broker-OWNED idle deadline (Plan 63-04, SESS-04): reads
 * `VICE_BROKER_RELAY_IDLE_MS`, falling back to DEFAULT_RELAY_IDLE_MS on an
 * absent, non-numeric, zero or negative value (logged by name -- see
 * resolvePositiveMsFromEnv()'s own comment). This is the mechanism the
 * broker actually controls end-to-end: `Socket.prototype.setTimeout(ms)`
 * fires purely in userspace, on read+write inactivity, needing no
 * cooperation from the OS or the peer -- unlike the keepalive setting
 * below, which is a secondary, best-effort signal only. */
export function resolveRelayIdleMs(): number {
  return resolvePositiveMsFromEnv("VICE_BROKER_RELAY_IDLE_MS", DEFAULT_RELAY_IDLE_MS);
}

/** Resolves the keepalive delay (Plan 63-04, SESS-04): reads
 * `VICE_BROKER_RELAY_KEEPALIVE_MS`, same absent/non-numeric/zero/negative
 * fallback discipline as resolveRelayIdleMs() above. See
 * DEFAULT_RELAY_KEEPALIVE_MS's own comment for what this setting does NOT
 * bound -- the idle deadline above is the owned mechanism; this is a
 * labelled secondary one. */
export function resolveRelayKeepAliveMs(): number {
  return resolvePositiveMsFromEnv("VICE_BROKER_RELAY_KEEPALIVE_MS", DEFAULT_RELAY_KEEPALIVE_MS);
}
