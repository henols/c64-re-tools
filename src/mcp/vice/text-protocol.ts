#!/usr/bin/env node
// text-protocol.ts
//
// THE ONE place that frames the `-remotemonitor` TEXT-monitor wire's bytes --
// nothing else in this tree decodes text-monitor bytes. This is the text-wire
// sibling of stock-protocol.ts's ViceMonitorClient (the binary-monitor
// client): same private-field shape (#socket, #buffer, bound
// #onData/#onClose/#onError handlers, a `connected` getter), same
// concat-then-decode-once discipline, same "never leak a live socket on a
// second connect()" rule -- but the text wire has NO length-prefixed frame,
// NO request-id multiplexing, and NO api_version byte. One command is
// outstanding at a time; the reply is framed by a literal, human-readable
// prompt string VICE writes when it is ready for the next command. Because
// of that, this class deliberately DROPS stock-protocol.ts's
// #pending/#nextRequestId/#settledRing/#settledSet machinery entirely --
// there is nothing to correlate a reply against beyond "is a command
// outstanding right now".
//
// Plan 41-01: Task 1 shipped the happy path plus a quiescence window pulled
// forward from Task 2's original scope -- this task's own live acceptance
// criterion (a real `device c:` round trip against genuine stock VICE) was
// MEASURED to fail without it. A fresh connection's very FIRST command reply
// can arrive as TWO separate TCP chunks: a residual leading prompt
// (`(C:$xxxx) `) with no command output yet attached, then the real output.
// A resolve-on-first-tail-match design mistakes the first chunk alone for a
// complete (empty) response -- exactly the shape Control 2 (a tail match
// that is not really final) exists to catch, occurring naturally rather than
// needing to be planted. See the plan SUMMARY for the measured repro. Task 2
// adds: the passive banner drain (D-13(b)) for bytes arriving with no
// command outstanding, enforcement of TEXT_MAX_BUFFERED_LEN, and the full
// deterministic test suite (including a controlled RED/GREEN demonstration
// of both planted controls).
//
// WHAT NOT TO DO:
//   - Never re-implement text-wire framing in a dispatcher, a tool handler,
//     or channel-lock.ts -- this module is the ONE place it happens.
//   - Never call command() outside withTextChannelLock() (plan 41-02,
//     CHAN-04) -- command() itself refuses when channel-lock.ts's mutex is
//     not currently held by the text channel, so a call site that bypasses
//     withTextChannelLock() is refused, not silently allowed through.
//   - Never widen stock-protocol.ts to also speak text. The binary and text
//     wires are structurally different protocols (length-prefixed frames
//     with a request-id demux vs. a free-text prompt terminator with no
//     multiplexing at all) and belong in separate modules, mirroring this
//     project's existing binary/text file split.
//   - Never accept a caller-supplied, free-text command string anywhere in
//     this module's public surface. VICE's text monitor accepts arbitrary
//     monitor commands and is UNAUTHENTICATED -- it can `load` and `save`
//     host files, exactly like the security caveat broker-launch.mts's own
//     bind-widening warning already states for this same channel. Every
//     outbound command must come from TEXT_COMMAND_ALLOWLIST below;
//     command() refuses anything else BY NAME, before a single byte reaches
//     the socket (D-01).
//   - Never frame a response by a timeout, a byte count, or any fallback
//     that hands back a plausible-looking partial payload. A response that
//     cannot be honestly framed refuses by name (TextFramingError), naming
//     what was actually observed -- never a guess.
import { EventEmitter } from "node:events";
import net from "node:net";

import { ViceError } from "./vice.ts";
import { acquireChannelLock, currentChannelLockHolder } from "./channel-lock.ts";

// ---------------------------------------------------------------------------
// The prompt terminator and the closed command allowlist.
// ---------------------------------------------------------------------------

/**
 * Matches the trailing `(C:$xxxx) ` prompt VICE's text monitor writes once it
 * has finished producing a command's output and is ready for the next one.
 * Anchored at the buffer's TAIL ($) deliberately: a command whose own output
 * happens to CONTAIN prompt-shaped text partway through (the second planted
 * control this phase's criterion names) must never be mistaken for the real
 * terminator merely because the pattern occurs somewhere in the stream --
 * only a match at the true end counts.
 */
export const PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

/**
 * The closed set of verb strings this project may send over the text
 * channel (D-01/D-02). `device c:` and `warp on`/`warp off` reach `tools/
 * list` as their own MCP tools; the remaining five (`memmapshow`,
 * `prof flat`, `chis`, `bt`, `io`) are reachable ONLY in-process through this
 * allowlist -- covered by this file's own framing controls, but not yet
 * exposed as tools -- until a later plan lands their owning text-format
 * parsers. Frozen: a ninth entry is a conscious edit here, never a
 * speculative widening, and never a free-text field accepting anything
 * outside this list.
 */
export const TEXT_COMMAND_ALLOWLIST = Object.freeze([
  "device c:",
  "warp on",
  "warp off",
  "memmapshow",
  "prof flat",
  "chis",
  "bt",
  "io",
] as const);

export type TextCommand = (typeof TEXT_COMMAND_ALLOWLIST)[number];

/** Type-narrowing predicate over TEXT_COMMAND_ALLOWLIST -- the ONE place a
 * string is checked against the closed command set. */
export function isAllowlistedTextCommand(cmd: string): cmd is TextCommand {
  return (TEXT_COMMAND_ALLOWLIST as readonly string[]).includes(cmd);
}

/** Any carriage return, line feed, or other C0 control character. Defense in
 * depth: every TEXT_COMMAND_ALLOWLIST entry above is already a fixed literal
 * with none of these, so this can never actually fire against an
 * allowlisted command today -- it exists so a FUTURE allowlist entry, or a
 * bug in isAllowlistedTextCommand() itself, cannot smuggle a second command
 * onto the wire via an embedded line terminator (canon-referral breadcrumb:
 * generic command injection is `/gsd-secure-phase` canon, not re-litigated
 * here). */
const FORBIDDEN_COMMAND_CHARS_RE = /[\r\n\x00-\x1f]/;

/**
 * Thrown when a text-monitor response cannot be honestly framed -- an
 * accumulated buffer that exceeded TEXT_MAX_BUFFERED_LEN with no prompt in
 * sight (Task 2 enforces this; the type ships now so Task 2 needs no new
 * export). Never thrown for a byte-count or timeout reason alone; always
 * names what was actually observed. A subclass of ViceError, not a bare
 * Error, so callers already switching on ViceError's shape keep working.
 */
export interface TextFramingErrorOptions {
  observedBytes?: number;
  outstandingCommand?: string | null;
}

export class TextFramingError extends ViceError {
  observedBytes?: number;
  outstandingCommand?: string | null;

  constructor(message: string, { observedBytes, outstandingCommand }: TextFramingErrorOptions = {}) {
    super(message);
    this.name = "TextFramingError";
    this.observedBytes = observedBytes;
    this.outstandingCommand = outstandingCommand ?? null;
  }
}

// ---------------------------------------------------------------------------
// Accumulation cap and quiescence window (constants ship now; Task 2 wires
// enforcement of both into TextMonitorClient's data handler).
// ---------------------------------------------------------------------------

/**
 * Upper bound on accumulated-but-not-yet-framed bytes for a single
 * outstanding command. Re-derived from real captured text-monitor output
 * rather than copied from stock-protocol.ts's MAX_BUFFERED_LEN, which bounds
 * a DIFFERENT wire (length-prefixed binary frames) with a different worst
 * case: the largest real fixture committed under fixtures/textmon/
 * (`access-map-stock.txt`, `memmapshow`'s own output) is ~1.62 MiB. 4 MiB
 * gives generous headroom above that measured ceiling while still refusing
 * genuinely unbounded accumulation (the DoS shape this cap exists to bound)
 * -- see text-protocol.test.ts's own assertion (Task 2) that this constant
 * is strictly greater than the largest fixture found on disk, so it can
 * never be tightened below real observed output without going red.
 */
export const TEXT_MAX_BUFFERED_LEN = 4 * 1024 * 1024;

/**
 * How long a buffer must stay silent, after a tail match against PROMPT_RE,
 * before that match is accepted as the real terminator rather than
 * prompt-shaped text occurring mid-stream (the second planted control this
 * phase's criterion names, wired in Task 2). VICE writes the real prompt as
 * the very last thing it sends for a completed command, so a genuine
 * terminator is never immediately followed by more command-output bytes --
 * 50ms is comfortably above ordinary same-host loopback latency while
 * staying well under the per-command cost every caller of this class
 * already accepts. Overridable via VICE_TEXT_QUIESCENCE_MS for a slower host
 * or a deliberately stressed test. Residual risk, stated rather than
 * hidden: a response written in bursts with wire-level backpressure longer
 * than this window would be accepted early, and no measurement on file
 * covers inter-chunk timing on a response near TEXT_MAX_BUFFERED_LEN's own
 * ceiling.
 */
export const TEXT_QUIESCENCE_MS: number = (() => {
  const raw = process.env.VICE_TEXT_QUIESCENCE_MS;
  if (raw === undefined || raw === "") return 50;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 50;
})();

/** Byte-safe tail scan for the prompt terminator. Deliberately decodes only a
 * short, fixed-size tail window through `latin1` (a 1-byte-to-1-code-unit
 * mapping that never throws and never depends on where a multi-byte UTF-8
 * sequence happens to be split) -- the prompt itself is pure ASCII, so this
 * can never miss a real terminator and can never be confused by a UTF-8
 * continuation byte living in the tail window. The AUTHORITATIVE decode of
 * the full payload still happens exactly once, with `utf8`, on the complete
 * assembled buffer, after a match is accepted as final -- see
 * #finishPending() below. */
function bufferEndsWithPrompt(buf: Buffer): boolean {
  const windowLen = Math.min(buf.length, 32);
  const tail = buf.subarray(buf.length - windowLen).toString("latin1");
  return PROMPT_RE.test(tail);
}

// ---------------------------------------------------------------------------
// withTextChannelLock() -- the text channel's ONE acquire seam for
// channel-lock.ts's mutex (plan 41-02, CHAN-04, D-07).
// ---------------------------------------------------------------------------

export interface WithTextChannelLockOptions {
  /** Test-only override of channel-lock.ts's acquire bound. Production call
   * sites never set this -- they always take channel-lock.ts's own
   * CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS default. */
  timeoutMs?: number;
}

/**
 * The text channel's ONE acquire seam for channel-lock.ts's mutex. Acquires
 * `channel: "text"`, runs `fn`, and releases in a `finally` so a throwing
 * `fn` still releases -- matching stock-dispatch.ts's `withChannelLockHeld()`
 * on the binary side exactly, and satisfying D-07's requirement that
 * `text-protocol.ts` and `stock-dispatch.ts` both import the one primitive.
 *
 * Every real text-monitor command MUST be issued from inside this function:
 * `command()` below refuses, by name, whenever channel-lock.ts's mutex is
 * not currently held by the text channel -- so a call site that forgets to
 * acquire is refused rather than silently bypassing the authority (D-07's
 * "cannot be silently bypassed" requirement).
 */
export async function withTextChannelLock<T>(operation: string, fn: () => Promise<T>, opts: WithTextChannelLockOptions = {}): Promise<T> {
  const handle = await acquireChannelLock({ channel: "text", operation, timeoutMs: opts.timeoutMs });
  try {
    return await fn();
  } finally {
    handle.release();
  }
}

interface PendingTextCommand {
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
  command: TextCommand;
}

export interface TextMonitorClientOptions {
  /** Test-only override of the quiescence window, taking precedence over
   * both the module-level TEXT_QUIESCENCE_MS constant and its own
   * VICE_TEXT_QUIESCENCE_MS env override -- lets a test exercise the
   * mid-stream-prompt case (Control 2) without waiting out a real-world
   * window or mutating process.env. */
  quiescenceMs?: number;
}

export interface TextConnectSocketOptions {
  timeoutMs?: number;
}

export interface TextCommandOptions {
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// TextMonitorClient
// ---------------------------------------------------------------------------

/**
 * Raw text-monitor socket client: connect/disconnect and a single
 * outstanding command() at a time, framed by PROMPT_RE plus a quiescence
 * window -- accumulate raw Buffers (never decode per chunk), and accept a
 * tail match against PROMPT_RE as final only once no further bytes arrive
 * within the quiescence window (see TEXT_QUIESCENCE_MS's own header comment
 * for why this is not optional even for the plain happy path). Task 2 adds
 * the passive banner drain (D-13(b)) and the accumulation cap on top of this
 * shape without changing it structurally.
 *
 * D-13(a): connect() never reads or waits for a connect banner -- stock's
 * text monitor sends ZERO bytes on connect, so there is nothing to frame or
 * race. Waiting would hang for the full connect timeout on every single
 * connection.
 */
export class TextMonitorClient extends EventEmitter {
  #socket: net.Socket | null = null;
  #buffer: Buffer = Buffer.alloc(0);
  #port: number | null = null;
  #closed = false;
  #pending: PendingTextCommand | null = null;
  #quiescenceTimer: NodeJS.Timeout | null = null;
  #quiescenceMs: number;
  /** Task 2 (D-13(b)): incremented every time a passively-arriving,
   * no-command-outstanding banner is drained -- never used to resolve a
   * later command's promise, only counted and emitted on `banner`. */
  bannerFramesDrained = 0;
  #onDataBound = (chunk: Buffer) => this.#onData(chunk);
  #onCloseBound = () => this.#onClose();
  #onErrorBound = (err: Error) => this.#onError(err);

  constructor({ quiescenceMs }: TextMonitorClientOptions = {}) {
    super();
    this.#quiescenceMs = quiescenceMs ?? TEXT_QUIESCENCE_MS;
  }

  get connected(): boolean {
    return this.#socket != null && !this.#socket.destroyed;
  }

  /** Whether a command is currently outstanding on this connection -- exposed
   * so text-connect.ts and any future channel-lock integration can observe
   * idle-vs-busy state without reaching into a private field. */
  get hasOutstandingCommand(): boolean {
    return this.#pending !== null;
  }

  connect(host: string, port: number, { timeoutMs = 5000 }: TextConnectSocketOptions = {}): Promise<void> {
    // Mirrors stock-protocol.ts's WR-13(b) fix: refuse to connect over a
    // socket that is still live, rather than silently overwriting #socket
    // and leaking the previous socket and its listeners. A reconnect must go
    // through disconnect() first.
    if (this.#socket != null && !this.#socket.destroyed) {
      return Promise.reject(
        new ViceError(
          `connect to ${host}:${port} refused: this client already holds a live socket to port ${this.#port} -- ` +
            `call disconnect() first (stock VICE services exactly one text-monitor client)`,
        ),
      );
    }

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });

      const onConnect = () => {
        clearTimeout(timer);
        socket.removeListener("error", onConnectError);
        this.#socket = socket;
        this.#buffer = Buffer.alloc(0);
        this.#port = port;
        this.#closed = false;
        socket.on("data", this.#onDataBound);
        socket.on("close", this.#onCloseBound);
        socket.on("error", this.#onErrorBound);
        // D-13(a): resolve immediately -- never read or wait for a connect
        // banner. Stock's text monitor sends zero bytes on connect.
        resolve();
      };
      const onConnectError = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };
      const timer = setTimeout(() => {
        socket.removeListener("connect", onConnect);
        socket.removeListener("error", onConnectError);
        // Mirrors stock-protocol.ts's WR-13(a) fix: destroy() can itself
        // deliver an 'error' for this socket. Both prior listeners are
        // already removed, so a no-op listener is attached for the socket's
        // remaining lifetime -- this socket is abandoned, nothing left to
        // report, but the event still needs somewhere to land.
        socket.on("error", () => {
          /* abandoned socket -- swallow */
        });
        socket.destroy();
        reject(new ViceError(`connect to ${host}:${port} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.once("connect", onConnect);
      socket.once("error", onConnectError);
    });
  }

  /**
   * Issue exactly one text-monitor command and resolve with its complete,
   * prompt-framed response (the prompt itself stripped). Refuses any
   * argument that is not in TEXT_COMMAND_ALLOWLIST, and refuses any argument
   * containing a CR, LF, or C0 control character, BY NAME, before a single
   * byte is written (D-01). Only one command may be outstanding at a time --
   * the text protocol is not multiplexed.
   */
  command(cmd: string, _opts: TextCommandOptions = {}): Promise<string> {
    // Checked BEFORE the allowlist membership check, deliberately: every
    // TEXT_COMMAND_ALLOWLIST entry is already clean of these characters, so
    // ordering it first makes this refusal reachable and testable in its own
    // right (a string carrying an embedded control character is refused
    // BY THAT REASON, not merely folded into the generic non-allowlisted
    // refusal) while changing nothing about which strings are ultimately
    // accepted.
    if (FORBIDDEN_COMMAND_CHARS_RE.test(cmd)) {
      return Promise.reject(
        new ViceError(`text-protocol: refusing command ${JSON.stringify(cmd)} containing a CR, LF, or C0 control character`),
      );
    }
    if (!isAllowlistedTextCommand(cmd)) {
      return Promise.reject(
        new ViceError(
          `text-protocol: refusing non-allowlisted command ${JSON.stringify(cmd)} -- every outbound text-monitor ` +
            `command must come from TEXT_COMMAND_ALLOWLIST (D-01)`,
        ),
      );
    }
    // D-07 (plan 41-02, CHAN-04): a text command issued without the text
    // channel holding channel-lock.ts's mutex is a defect, not a variant --
    // refusing it BY NAME is what keeps the serialization authority from
    // being silently bypassable by a call site that forgot to route through
    // withTextChannelLock(). Checked before the connection-state checks
    // below: holding halt authority is a prerequisite for issuing ANY
    // command, independent of whether a socket happens to be connected.
    const lockHolder = currentChannelLockHolder();
    if (lockHolder === null || lockHolder.channel !== "text") {
      return Promise.reject(
        new ViceError(
          `text-protocol: refusing command ${JSON.stringify(cmd)} -- the text channel does not currently hold ` +
            `channel-lock.ts's halt authority; every text-monitor command must be issued from inside ` +
            `withTextChannelLock()`,
        ),
      );
    }
    if (this.#closed || !this.connected || !this.#socket) {
      return Promise.reject(new ViceError("text-protocol: cannot send, the text-monitor connection is not open"));
    }
    if (this.#pending) {
      return Promise.reject(new ViceError("text-protocol: a command is already outstanding on this connection"));
    }

    const socket = this.#socket;
    return new Promise<string>((resolve, reject) => {
      this.#pending = { resolve, reject, command: cmd };
      socket.write(`${cmd}\n`);
    });
  }

  /** Tears down the socket and removes the bound listeners. Any outstanding
   * command is rejected rather than left to hang. A second disconnect() on
   * an already-torn-down client is a harmless no-op. */
  disconnect(): Promise<void> {
    if (this.#quiescenceTimer) {
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }
    const pending = this.#pending;
    this.#pending = null;
    if (pending) {
      pending.reject(new ViceError("text-protocol: connection closed while a command was outstanding"));
    }

    const socket = this.#socket;
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    this.#closed = true;
    if (!socket) {
      return Promise.resolve();
    }
    socket.removeListener("data", this.#onDataBound);
    socket.removeListener("close", this.#onCloseBound);
    socket.removeListener("error", this.#onErrorBound);
    return new Promise((resolve) => {
      socket.once("close", () => resolve());
      socket.destroy();
    });
  }

  #onData(chunk: Buffer): void {
    // Concat raw Buffers, never decode per chunk -- this alone is what
    // survives a prompt split across two socket chunks (Control 1):
    // matching happens against the TAIL of the accumulated buffer, which is
    // agnostic to where the chunk boundary fell.
    this.#buffer = Buffer.concat([this.#buffer, chunk]);

    if (this.#quiescenceTimer) {
      // More bytes arrived before the quiescence window elapsed for a
      // PREVIOUS tail match -- that match was not really final (Control 2's
      // own shape: prompt-shaped text mid-stream, or -- as measured live --
      // a residual leading prompt arriving as its own chunk ahead of the
      // real output). Cancel the timer and re-evaluate from scratch below
      // against the now-larger buffer.
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }

    if (!this.#pending) {
      // D-13(b): a passively-arriving banner (e.g. a binary-owned
      // checkpoint-hit notification pushed to this same text console) with
      // no command outstanding. WR-01: this path must apply the SAME
      // quiescence discipline as the pending-command branch below --
      // prompt-shaped text can occur mid-banner exactly as it can
      // mid-command-response (Control 2's own shape), and draining
      // immediately on the first tail match risks splitting one logical
      // banner into two events, or -- worse -- leaking a banner's true
      // trailing bytes into an unrelated command's response buffer if a
      // command is issued in the narrow window between the false match and
      // the banner's real tail arriving. Arm the quiescence window and only
      // drain once a tail match SURVIVES it with no further bytes arriving.
      if (bufferEndsWithPrompt(this.#buffer)) {
        this.#quiescenceTimer = setTimeout(() => {
          this.#quiescenceTimer = null;
          this.#finishBanner();
        }, this.#quiescenceMs);
        if (typeof this.#quiescenceTimer.unref === "function") this.#quiescenceTimer.unref();
        return;
      }
      this.#checkCap();
      return;
    }

    if (bufferEndsWithPrompt(this.#buffer)) {
      // A tail match. Arm the quiescence window rather than resolving
      // immediately: only a match that SURVIVES the window (no further
      // bytes arrive) is accepted as the genuine terminator.
      this.#quiescenceTimer = setTimeout(() => {
        this.#quiescenceTimer = null;
        this.#finishPending();
      }, this.#quiescenceMs);
      if (typeof this.#quiescenceTimer.unref === "function") this.#quiescenceTimer.unref();
      return;
    }

    this.#checkCap();
  }

  /** Finalizes the currently outstanding command against the buffer accrued
   * so far: decodes the ENTIRE assembled buffer with `utf8` exactly once
   * (never per chunk -- the encoding-split control depends on this), strips
   * the trailing prompt, and resolves. */
  #finishPending(): void {
    const pending = this.#pending;
    if (!pending) return;
    this.#pending = null;
    const raw = this.#buffer;
    this.#buffer = Buffer.alloc(0);
    const decoded = raw.toString("utf8");
    const payload = decoded.replace(PROMPT_RE, "");
    pending.resolve(payload);
  }

  /** Finalizes a passively-drained banner (D-13(b)) against the buffer
   * accrued so far, mirroring #finishPending()'s discipline for the
   * pending-command path: only invoked after a tail match has survived the
   * quiescence window with no further bytes arriving in between (WR-01) --
   * never on the first tail match alone. Never resolves or touches
   * #pending; a banner is passive output, not a command reply. */
  #finishBanner(): void {
    const raw = this.#buffer;
    this.#buffer = Buffer.alloc(0);
    this.bannerFramesDrained += 1;
    this.emit("banner", raw.toString("utf8"));
  }

  /** Enforces TEXT_MAX_BUFFERED_LEN against accumulated-but-not-yet-framed
   * bytes, whether a command is outstanding or a banner is being drained.
   * Exceeding the cap with no prompt in sight is a refusal (TextFramingError
   * naming the byte count and the outstanding command, if any) -- never a
   * truncated payload handed back as if it were complete. */
  #checkCap(): void {
    if (this.#buffer.length <= TEXT_MAX_BUFFERED_LEN) return;
    const observedBytes = this.#buffer.length;
    const outstandingCommand = this.#pending?.command ?? null;
    this.#buffer = Buffer.alloc(0);
    const err = new TextFramingError(
      `text-protocol: accumulated buffer exceeded TEXT_MAX_BUFFERED_LEN (${TEXT_MAX_BUFFERED_LEN}) with no prompt in sight` +
        (outstandingCommand ? ` while "${outstandingCommand}" was outstanding` : " while draining a banner"),
      { observedBytes, outstandingCommand },
    );
    const pending = this.#pending;
    this.#pending = null;
    if (pending) {
      pending.reject(err);
    } else {
      // IN-01: no command is outstanding when this fires, so there is no
      // promise to reject -- "desync" is the only signal. This deliberately
      // mirrors stock-protocol.ts's own "desync" convention for its binary
      // ViceMonitorClient: neither of this class's two current production
      // consumers (text-connect.ts, text-tools.ts) attach a listener, exactly
      // like the binary client's own production call sites today. That is a
      // known diagnosability gap (a genuinely desynced text channel produces
      // no operator-visible signal until the next real command is issued
      // against it), not an oversight -- left unconsumed BY DESIGN, pending a
      // future plan that exposes the banner/desync stream to a caller. A
      // fix that wires a listener onto only this class, asymmetric with the
      // binary client's identical convention, is explicitly NOT wanted here.
      this.emit("desync", err);
    }
  }

  #onClose(): void {
    if (this.#quiescenceTimer) {
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }
    const pending = this.#pending;
    this.#pending = null;
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    this.#closed = true;
    if (pending) {
      pending.reject(new ViceError("text-protocol: connection closed while a command was outstanding"));
    }
    this.emit("close");
  }

  #onError(err: Error): void {
    if (this.#quiescenceTimer) {
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }
    const pending = this.#pending;
    this.#pending = null;
    this.#closed = true;
    if (pending) {
      pending.reject(err);
    }
    this.emit("transport-error", err);
  }
}
