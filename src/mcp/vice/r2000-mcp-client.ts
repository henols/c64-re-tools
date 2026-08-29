#!/usr/bin/env node
// r2000-mcp-client.ts -- the ONE authoritative place in this repo that
// speaks MCP as a CLIENT.
//
// WHY THIS MODULE EXISTS (D-16): every prior phase made this repo an MCP
// *server*, answering `tools/call` from Claude Code. Phase 11's `r2000_*`
// surface requires the opposite role for the first time -- this repo must
// spawn `regenerator2000 --mcp-server-stdio`, send it JSON-RPC requests, and
// trust (or refuse to trust) its answers. That reversal is why this module
// gets the phase's most explicit failure handling: every `r2000_*` tool,
// the enum generator, the memory-map renderer and both symbol-round-trip
// legs all run through this one seam, so a bug here is not local to one
// tool -- it is the phase's single point of failure.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: spawning
// `regenerator2000 --mcp-server-stdio`, framing/parsing its newline-
// delimited JSON-RPC messages, correlating requests by id, and translating
// every one of its failure modes into a named, typed error. No other
// module may spawn `--mcp-server-stdio` or parse a JSON-RPC frame --
// `r2000-tools.ts` (plan 11-05) knows tool NAMES and the curated allow-list,
// never the protocol; the enum generator (11-06) and memory-map renderer
// (11-08) call through `callR2000()`/`withR2000Session()`, never around them.
//
// CLIENT-SHAPE VERDICT (measured in r2000-mcp-client.test.ts against the
// installed `@mastra/mcp` 1.15.0, Task 2 of this plan): of the five required
// properties (bounded-time failure on an unanswered call, a mid-call exit
// distinct from a timeout, a named ENOENT spawn failure, the spawned
// child's exit code reachable after its session closes, and its stderr
// reachable and attributable to the call), FOUR measured `satisfied` and
// ONE did not. The deciding property is **exit-code reachability**:
// `MCPClient`'s entire public prototype (reflected at test time, not merely
// read from its `.d.ts`) exposes no member for retrieving a spawned child's
// exit status once its session has closed. Per the plan's decision rule
// (use `MCPClient` if and only if ALL FIVE measure `satisfied`), this
// module is therefore a hand-rolled newline-delimited JSON-RPC client, not
// a wrapper over `MCPClient` -- exactly because a lying zero-exit-plus-
// success-text transcript is `r2000-verify.ts`'s own founding incident
// (D-10), and this module's `saveAndVerify()` below exists specifically to
// never repeat it.
//
// WHAT NOT TO DO, named concretely:
//   - Never keep a child alive outside these two sanctioned primitives. This
//     module exposes exactly two: the one-shot `withR2000Session()` (CLI
//     verbs -- `r2000-cli.ts`, the enum generator, the memory-map renderer)
//     and the long-lived `openR2000Session()` (the `r2000_*` MCP tool
//     surface, via `r2000-session.ts`'s single-slot lifecycle owner). The
//     PRIOR rule -- exactly one session per logical operation, no long-lived
//     child at all, spawn -> initialize -> call(s) -> (optional save) ->
//     stdin close -> exit every time -- was `D-17`/`D-18` (Phase 11) and was
//     REVERSED by Phase 18; see `.planning/ARCHITECTURE.md`'s "## Architecture
//     Change Record" for the full six-step justification rather than
//     restating it here. The rule that SURVIVES the reversal, unchanged:
//     this module remains the ONLY place in this repo that spawns the
//     stdio server or parses a JSON-RPC frame, and the durability contract
//     -- every mutating call is still followed by its own save, over the
//     SAME session, before that call resolves to its caller (D18-08) -- is
//     unchanged and owned by `r2000-tools.ts`, never by this module.
//   - Never import the underlying MCP TypeScript SDK package directly. It
//     is reachable today only as an undeclared transitive dependency of
//     `@mastra/mcp` (hoisted into this project's own `node_modules` by
//     npm's current dedup pass, not declared in package.json) -- a direct
//     import here would be an ENGINEERING_RULES.md §4 phantom-dependency
//     violation waiting for a dedup change to break it with no
//     package.json line to explain why.
//   - Never import the host/container path-boundary modules here.
//     regenerator2000 runs container-side (D-R4, same side as the MCP
//     proxy, Rule A16), so no path translation ever applies to any
//     argument passed to it -- translating one would be the mirror image
//     of the DERIV-07 screenshot-path trap, where a client-side-derived
//     path was wrongly translated a second time. This absence is asserted
//     structurally by the closed host-path consumer-set test (D-08), not
//     merely stated here.
//   - Never report `r2000_save_project` as persisted on the strength of its
//     own text response (`{"content":[{"type":"text","text":"Project saved
//     to <path>"}]}` is a string, not a checksum). `saveAndVerify()` below
//     proves persistence independently, by re-reading the project file's
//     own content hash from disk before and after -- never by trusting what
//     the child said about itself.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { buildMcpServerStdioArgs, assertNoViceFlag } from "./r2000-launch.ts";

/** The MCP protocol version regenerator2000's stdio handler hardcodes
 * server-side (`handler.rs:16`, confirmed by direct call and by
 * RESEARCH.md's live reproduction). Not negotiated; sent verbatim on every
 * `initialize` request. */
export const R2000_PROTOCOL_VERSION = "2024-11-05";

/** The single named constant every per-call timeout in this module derives
 * from -- never a magic number at a call site. Overridable per call via
 * `WithR2000SessionOptions.timeoutMs`. 30s matches this repo's own
 * documented "the one call that can be slow" caveat
 * (`r2000_search_disassembly` on a large program, plan objective). */
export const DEFAULT_R2000_CALL_TIMEOUT_MS = 30_000;

// -- Error classes -----------------------------------------------------
//
// Every failure mode this module can produce is a DISTINCT, named class,
// mirroring `vice.ts`'s `ViceError`/`MachineRestartedError` pattern. A
// caller (or a test) must be able to tell these apart by `instanceof`, not
// by parsing message text.

export interface R2000ClientErrorOptions {
  cause?: unknown;
}

/** Base class for every error this module throws. Never thrown directly --
 * always one of the named subclasses below. */
export class R2000ClientError extends Error {
  constructor(message: string, { cause }: R2000ClientErrorOptions = {}) {
    super(message);
    this.name = "R2000ClientError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/** Thrown when spawning `regenerator2000` itself fails, most commonly
 * `ENOENT` (not installed / not on `$PATH`). Mirrors `runR2000()`'s own
 * message shape (`r2000-launch.ts`) so both spawn call sites in this repo
 * give a caller the identical remediation text. */
export class R2000SpawnError extends R2000ClientError {
  constructor(message: string, opts: R2000ClientErrorOptions = {}) {
    super(message, opts);
    this.name = "R2000SpawnError";
  }
}

export interface R2000ProtocolErrorOptions extends R2000ClientErrorOptions {
  code: number;
  data?: unknown;
}

/** Thrown when regenerator2000's own response carries a JSON-RPC `error`
 * object, OR a `tools/call` response's `CallToolResult.isError` is `true`.
 * Surfaces `code` and `message` verbatim -- never flattened into a generic
 * failure -- so a caller can distinguish "unknown tool" from "invalid
 * arguments" from "internal error" without re-parsing this module's own
 * error message. */
export class R2000ProtocolError extends R2000ClientError {
  code: number;
  data?: unknown;

  constructor(message: string, { code, data, ...rest }: R2000ProtocolErrorOptions) {
    super(message, rest);
    this.name = "R2000ProtocolError";
    this.code = code;
    this.data = data;
  }
}

export interface R2000TimeoutErrorOptions extends R2000ClientErrorOptions {
  timeoutMs: number;
}

/** Thrown when a request receives no response within `timeoutMs` --
 * BOUNDED, never an indefinite hang. Distinct from `R2000ChildExitError`:
 * this class means "the child is still alive but never answered"; that one
 * means "the child is gone". A caller must never need to parse message text
 * to tell the two apart. */
export class R2000TimeoutError extends R2000ClientError {
  timeoutMs: number;

  constructor(message: string, { timeoutMs, ...rest }: R2000TimeoutErrorOptions) {
    super(message, rest);
    this.name = "R2000TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export interface R2000ChildExitErrorOptions extends R2000ClientErrorOptions {
  exitCode: number | null;
  stderr: string;
}

/** Thrown when the child process exits while one or more requests are
 * still pending an answer -- distinct from `R2000TimeoutError` (which means
 * the child is still alive) and from `R2000SessionFailedError` (which means
 * every call already succeeded and ONLY the final exit was bad). Carries
 * both the exit code and everything captured on stderr, so a caller never
 * has to re-derive "why did it die" from a bare non-zero number. */
export class R2000ChildExitError extends R2000ClientError {
  exitCode: number | null;
  stderr: string;

  constructor(message: string, { exitCode, stderr, ...rest }: R2000ChildExitErrorOptions) {
    super(message, rest);
    this.name = "R2000ChildExitError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export interface R2000SessionFailedErrorOptions extends R2000ClientErrorOptions {
  exitCode: number | null;
  stderr: string;
}

/**
 * Thrown when every call inside a `withR2000Session()` block succeeded, but
 * the child's FINAL exit code (after stdin was closed) was non-zero. The
 * whole session fails in this case -- never just a warning -- because
 * `r2000-verify.ts`'s own founding incident (D-10) is the exact opposite
 * shape of lie: a zero exit code alongside content that should have failed.
 * This class is the mirror image, refusing to let an otherwise-clean
 * transcript hide a bad exit.
 */
export class R2000SessionFailedError extends R2000ClientError {
  exitCode: number | null;
  stderr: string;

  constructor(message: string, { exitCode, stderr, ...rest }: R2000SessionFailedErrorOptions) {
    super(message, rest);
    this.name = "R2000SessionFailedError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export interface R2000SaveNotPersistedErrorOptions extends R2000ClientErrorOptions {
  projectPath: string;
  beforeHash: string | null;
  afterHash: string | null;
}

/**
 * Thrown by `saveAndVerify()` when `r2000_save_project` returns successfully
 * but the project file's own content hash, re-read from disk, did not
 * change. This is the module's highest-value refusal (T-11-FALSESUCCESS):
 * `r2000_save_project`'s success text
 * (`{"content":[{"type":"text","text":"Project saved to <path>"}]}`) is a
 * string, not a checksum, and this class is what stands between that string
 * and a caller believing the save actually happened.
 */
export class R2000SaveNotPersistedError extends R2000ClientError {
  projectPath: string;
  beforeHash: string | null;
  afterHash: string | null;

  constructor(message: string, { projectPath, beforeHash, afterHash, ...rest }: R2000SaveNotPersistedErrorOptions) {
    super(message, rest);
    this.name = "R2000SaveNotPersistedError";
    this.projectPath = projectPath;
    this.beforeHash = beforeHash;
    this.afterHash = afterHash;
  }
}

export interface R2000RestartBudgetExhaustedErrorOptions extends R2000ClientErrorOptions {
  crashCount: number;
  limit: number;
}

/**
 * Thrown by `r2000-session.ts`'s `runInR2000Session()` when a project path's
 * held session has crashed more times than `DEFAULT_R2000_RESTART_BUDGET` (or
 * its `R2000_RESTART_BUDGET` override) tolerates within one working session
 * (D18-14). `crashCount` and `limit` are dedicated PUBLIC fields precisely so
 * a caller -- or a test -- can read the observed count and the configured
 * bound programmatically, without parsing this error's message text. Exists
 * to turn an invisible respawn loop (a genuinely broken project or binary
 * that dies, is transparently respawned, dies again, forever) into a loud,
 * attributable refusal instead of something that merely reads as slowness.
 */
export class R2000RestartBudgetExhaustedError extends R2000ClientError {
  crashCount: number;
  limit: number;

  constructor(message: string, { crashCount, limit, ...rest }: R2000RestartBudgetExhaustedErrorOptions) {
    super(message, rest);
    this.name = "R2000RestartBudgetExhaustedError";
    this.crashCount = crashCount;
    this.limit = limit;
  }
}

export interface R2000SessionBusyErrorOptions extends R2000ClientErrorOptions {
  waitedMs: number;
  holder: string;
}

/**
 * Thrown by `r2000-session.ts`'s coarse FIFO mutex (D18-15) when a caller's
 * turn never arrives within `DEFAULT_R2000_QUEUE_WAIT_MS` (or its
 * `R2000_QUEUE_WAIT_MS` override) -- SESS-04 criterion 4's named answer to
 * contention, which is a BOUNDED queue-and-wait, never a refusal-while-busy
 * (D18-17). `waitedMs`/`holder` are dedicated PUBLIC fields -- the caller's
 * own observed wait and a short description of whichever caller currently
 * holds the slot -- so a caller (or a test) can read both programmatically
 * rather than parsing this error's message text. The queued turn this error
 * is thrown for is removed from the mutex's queue at the same moment, so it
 * is never granted late against a session this caller has already given up
 * on.
 */
export class R2000SessionBusyError extends R2000ClientError {
  waitedMs: number;
  holder: string;

  constructor(message: string, { waitedMs, holder, ...rest }: R2000SessionBusyErrorOptions) {
    super(message, rest);
    this.name = "R2000SessionBusyError";
    this.waitedMs = waitedMs;
    this.holder = holder;
  }
}

// -- The wire shape ---------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface CallToolResultShape {
  content?: unknown;
  isError?: boolean;
  structuredContent?: unknown;
}

/** The function a caller receives inside `withR2000Session()`'s callback to
 * invoke a single `tools/call` against the live session. */
export type R2000Call = (name: string, args?: Record<string, unknown>) => Promise<unknown>;

export interface WithR2000SessionOptions {
  /** Per-request timeout, overriding `DEFAULT_R2000_CALL_TIMEOUT_MS`. */
  timeoutMs?: number;
  /**
   * Overrides the regenerator2000 binary to spawn for this call only.
   * Mirrors `r2000-launch.ts`'s own `R2000_BIN` env-var override
   * convention, but resolved FRESH on every `withR2000Session()` call
   * (`process.env.R2000_BIN` is read at call time here, deliberately never
   * imported as a frozen module-level constant the way `r2000-launch.ts`'s
   * own `R2000_BIN` export is) -- this repo's own test files are all
   * co-located in one `node:test` process per file, sharing one module
   * cache, and a stub-server test suite needs to point several different
   * stub behaviours at the same spawn call within that one process without
   * restarting it. Defaults to `process.env.R2000_BIN ?? "regenerator2000"`,
   * the exact same default `r2000-launch.ts` uses.
   */
  bin?: string;
  /**
   * Overrides the argv this session spawns with, in place of
   * `buildMcpServerStdioArgs({ projectPath })`. Added for 11-08's
   * `anno-symbols.ts` `importLabels()` (D-28): its argv is
   * `buildImportLblArgs({ projectPath, lblPath })` --
   * `["--import_lbl", lblPath, "--mcp-server-stdio", projectPath]` -- which
   * this module's own default argv cannot express (it is fixed to plain
   * `--mcp-server-stdio`). A caller-supplied `argv` MUST come from one of
   * `r2000-launch.ts`'s fixed builders, never be hand-built at the call site
   * (D-07) -- still passed through `assertNoViceFlag()` below like every
   * other argv this module builds, so the guard applies regardless of which
   * builder produced it. Omitted (the default, every OTHER caller in this
   * repo) preserves the original plain-session behaviour exactly.
   */
  argv?: readonly string[];
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * A long-lived regenerator2000 session -- the primitive `r2000-session.ts`'s
 * single-slot lifecycle owner (D18-01) holds across many `r2000_*` tool
 * calls, promoted out of what used to be `withR2000Session()`'s own
 * one-shot-only setup. `call` may be invoked any number of times before
 * `close()`; `pid`/`exited` are live getters over the underlying child, not
 * snapshots taken at open time.
 */
export interface R2000Session {
  readonly projectPath: string;
  readonly pid: number | undefined;
  call: R2000Call;
  readonly exited: boolean;
  close(): Promise<void>;
  killSync(): void;
  /**
   * Registers `listener` to fire exactly once, whenever this session's
   * child exits, for ANY reason -- between calls with nothing pending, or
   * mid-call with a request still unanswered alike (D18-10). A single
   * listener is enough: there is exactly one owner per session
   * (`r2000-session.ts`'s single-slot lifecycle). Registering a second
   * listener replaces the first, mirroring `EventEmitter.once()`'s own
   * fire-at-most-once shape without pulling in a second dependency for it.
   */
  onExit(listener: (info: { code: number | null; stderr: string }) => void): void;
}

/**
 * Spawns `regenerator2000 --mcp-server-stdio <projectPath>` (via
 * `buildMcpServerStdioArgs()`, so `assertNoViceFlag()`'s guard applies here
 * too, defense in depth even though this builder can never itself emit
 * `--vice`), performs the `initialize` handshake, and returns a long-lived
 * `R2000Session` a caller may issue many `tools/call`s against before
 * eventually calling `close()`.
 *
 * Every failure mode below is a distinct named error class -- see the class
 * definitions above for what each one means and how it differs from its
 * neighbours. A failure during `initialize` tears the spawned child down
 * before rethrowing -- there is no half-open session to leak.
 */
/** Drops a child stdio pipe's standing claim on the event loop. With
 * `stdio: ["pipe","pipe","pipe"]` these are `net.Socket`s at runtime and do
 * have `unref()`, but `ChildProcessWithoutNullStreams` types them as the
 * narrower `Writable`/`Readable`, which do not declare it. Narrowed to the
 * one method actually needed rather than asserting a whole `Socket` type, so
 * this degrades to a no-op instead of throwing if Node ever changes the
 * stdio stream type. */
function unrefStream(stream: unknown): void {
  (stream as { unref?: () => void }).unref?.();
}

export async function openR2000Session(
  projectPath: string,
  opts: WithR2000SessionOptions = {}
): Promise<R2000Session> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_R2000_CALL_TIMEOUT_MS;
  const bin = opts.bin ?? process.env.R2000_BIN ?? "regenerator2000";
  const argv = opts.argv ?? buildMcpServerStdioArgs({ projectPath });
  assertNoViceFlag(argv);

  const child = spawn(bin, argv, { stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;

  await waitForSpawn(child);

  let stderrBuf = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString("utf8");
  });

  const pending = new Map<number, PendingRequest>();
  let nextId = 1;
  let childExited = false;
  let exitCode: number | null = null;
  let exitListener: ((info: { code: number | null; stderr: string }) => void) | null = null;

  const exitPromise = new Promise<void>((resolve) => {
    child.once("exit", (code) => {
      childExited = true;
      exitCode = code;
      // Any request still awaiting an answer at this point died with the
      // child -- distinct from a timeout, since the child (not the clock)
      // is what ended it.
      for (const [, p] of pending) {
        p.reject(
          new R2000ChildExitError(
            `regenerator2000 exited (code ${code}) with a request still pending an answer -- stderr: ${stderrBuf || "(empty)"}`,
            { exitCode: code, stderr: stderrBuf }
          )
        );
      }
      pending.clear();
      // Surfaced to the session owner AFTER the pending-request rejections
      // above, so a mid-call caller's own rejection is always settled
      // before the owner (r2000-session.ts) learns about the exit and
      // updates its crash bookkeeping (D18-10) -- a between-calls exit has
      // no pending requests to reject, so this is the only notification
      // that ever fires for that case.
      exitListener?.({ code, stderr: stderrBuf });
      resolve();
    });
  });

  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(line) as JsonRpcResponse;
    } catch {
      // A non-JSON line from regenerator2000's stdout has never been
      // observed (RESEARCH.md's live reproduction: exactly one JSON message
      // per line, both directions) -- ignored rather than crashing the
      // session over stray output, but never mistaken for a response.
      return;
    }
    if (msg.id === undefined || msg.id === null) return; // a notification, not a response we're waiting on
    const p = pending.get(msg.id);
    if (!p) return; // D-08/CLAUDE.md: an id with no matching pending request is REFUSED, never resolved
    pending.delete(msg.id);
    if (msg.error) {
      p.reject(
        new R2000ProtocolError(`r2000 JSON-RPC error ${msg.error.code}: ${msg.error.message}`, {
          code: msg.error.code,
          data: msg.error.data,
        })
      );
    } else {
      p.resolve(msg.result);
    }
  });

  function send(req: JsonRpcRequest): void {
    child.stdin.write(`${JSON.stringify(req)}\n`);
  }

  function request(method: string, params?: unknown): Promise<unknown> {
    if (childExited) {
      return Promise.reject(
        new R2000ChildExitError(`regenerator2000 has already exited (code ${exitCode}) -- cannot send "${method}"`, {
          exitCode,
          stderr: stderrBuf,
        })
      );
    }
    const id = nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new R2000TimeoutError(`r2000 "${method}" received no response within ${timeoutMs}ms`, { timeoutMs })
        );
      }, timeoutMs);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  /** Ends the child's read loop (mcp/stdio.rs:72), waits for it to exit (or
   * force-kills it after `timeoutMs`), and closes the readline interface.
   * Safe to call whether or not the child has already exited -- `stdin.end()`
   * is guarded, and racing an already-resolved `exitPromise` settles
   * immediately. Used by both the initialize-failure path below and by
   * `close()`. */
  async function teardown(): Promise<void> {
    try {
      child.stdin.end();
    } catch {
      /* already closed */
    }
    await Promise.race([exitPromise, killAfter(child, timeoutMs)]);
    rl.close();
  }

  try {
    await request("initialize", {
      protocolVersion: R2000_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "vice-mcp", version: "0" },
    });
    // A notification, per MCP spec -- no id, no response expected.
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
  } catch (err) {
    await teardown();
    throw err;
  }

  // A HELD SESSION MUST NEVER BE THE REASON ITS HOST PROCESS STAYS ALIVE.
  //
  // WHY (found by plan 18-03's own post-wave gate, not by reasoning): once
  // `r2000-tools.ts`'s `runR2000Tool()` was rewired through
  // `r2000-session.ts`'s HELD single slot, the child handle and its three
  // stdio pipes -- all ref'd libuv handles -- kept the event loop alive in
  // every host that is not `vice-proxy.ts`. `r2000-cli.test.ts`'s WR-09 test
  // calls `runR2000Tool("r2000_disassemble", ...)` once, and its `node --test`
  // worker then printed all 64 `ok` lines and hung forever, never reaching the
  // `1..64` summary. Three sibling test files hung the same way. The hazard is
  // NOT test-only: any CLI verb or one-shot host that reaches `runR2000Tool()`
  // once would likewise never exit, because nothing outside `vice-proxy.ts`
  // owns a teardown hook that calls `closeR2000SessionSync()`.
  //
  // WHY UNREF IS SAFE, not a race: every `request()` above arms a ref'd
  // `setTimeout(timer, timeoutMs)` and clears it only on answer/timeout, and
  // `teardown()` races `exitPromise` against `killAfter()`'s own timer. So
  // for the whole duration of any in-flight call or close, a ref'd timer --
  // not the child handle -- is what holds the loop open, and events still
  // arrive normally. Unref only removes the child's standing claim on the
  // loop BETWEEN calls, which is exactly the claim that must not exist.
  //
  // WHAT THIS DOES NOT DO: it does not close the child, shorten the session,
  // or add an idle timeout (D18-05's deliberate absence stands). A host that
  // exits with a session still held orphans that child until it observes
  // stdin EOF -- measuring and bounding that is plan 18-04's charter
  // (`18-STDIN-EOF-EVIDENCE.md`, plus the synchronous `vice-proxy.ts`
  // teardown region that calls `closeR2000SessionSync()`). This unref is the
  // complement that keeps every OTHER host exitable, not a substitute for it.
  // All four are load-bearing, verified by removing them: `child.unref()`
  // ALONE still hung `r2000-cli.test.ts` (the three pipes are separate ref'd
  // libuv handles), so this is not defensive over-unreffing.
  child.unref();
  unrefStream(child.stdin);
  unrefStream(child.stdout);
  unrefStream(child.stderr);

  const call: R2000Call = async (name, args = {}) => {
    const result = (await request("tools/call", { name, arguments: args })) as CallToolResultShape;
    if (result && result.isError) {
      throw new R2000ProtocolError(
        `r2000 tool "${name}" reported isError: true -- ${JSON.stringify(result.content ?? null)}`,
        { code: -1 }
      );
    }
    return result;
  };

  async function close(): Promise<void> {
    await teardown();
    // T-11-FALSESUCCESS's mirror image (D18-08, formerly D-17): every call
    // may have succeeded, but if the FINAL exit was non-zero, the whole
    // session still fails.
    if (exitCode !== 0 && exitCode !== null) {
      throw new R2000SessionFailedError(
        `regenerator2000 exited ${exitCode} after an otherwise-successful call sequence -- stderr: ${stderrBuf || "(empty)"}`,
        { exitCode, stderr: stderrBuf }
      );
    }
  }

  /** Kills only through this retained `ChildProcess` handle -- never a
   * bare pid (D18-21). Synchronous, takes no arguments, awaits nothing,
   * mirroring `killAfter()`'s own kill call. */
  function killSync(): void {
    if (!child.killed) child.kill("SIGKILL");
  }

  return {
    projectPath,
    get pid() {
      return child.pid;
    },
    call,
    get exited() {
      return childExited;
    },
    close,
    killSync,
    onExit(listener) {
      exitListener = listener;
    },
  };
}

/**
 * The one-shot contract every CLI-verb caller still uses (D18-07:
 * `r2000-cli.ts`, the enum generator, the memory-map renderer). A thin
 * wrapper over `openR2000Session()`: open, run `fn(session.call)`, and on
 * the success path `close()` the session so a non-zero final exit still
 * surfaces exactly as it always has; on the throwing path, close without
 * letting a close failure mask the original error, then rethrow. Its
 * exported signature, generic parameter, options type and observable
 * failure modes are unchanged from before this module gained a second,
 * long-lived primitive.
 */
export async function withR2000Session<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>,
  opts: WithR2000SessionOptions = {}
): Promise<T> {
  const session = await openR2000Session(projectPath, opts);
  let result: T;
  try {
    result = await fn(session.call);
  } catch (err) {
    try {
      await session.close();
    } catch {
      // Never let a close failure mask fn()'s own error.
    }
    throw err;
  }
  await session.close();
  return result;
}

/** Waits for either a successful spawn (`"spawn"` event, Node >= 15) or a
 * spawn failure (`"error"` event), translating `ENOENT` into the same
 * remediation text `runR2000()` uses (`r2000-launch.ts`) so both spawn call
 * sites in this repo give identical advice. */
function waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSpawn = () => {
      child.removeListener("error", onError);
      resolve();
    };
    const onError = (err: NodeJS.ErrnoException) => {
      child.removeListener("spawn", onSpawn);
      if (err.code === "ENOENT") {
        reject(
          new R2000SpawnError(
            `regenerator2000 was not found on PATH -- install it with \`cargo install regenerator2000\` and ` +
              `ensure \`regenerator2000\` is on $PATH (or set R2000_BIN to its full path).`,
            { cause: err }
          )
        );
      } else {
        reject(new R2000SpawnError(`failed to spawn regenerator2000: ${err.message}`, { cause: err }));
      }
    };
    child.once("spawn", onSpawn);
    child.once("error", onError);
  });
}

/** Resolves after `ms` and force-kills `child` -- the bound on "wait for
 * exit after closing stdin", so a child that never exits cannot hang a
 * session forever. Races against the real exit event in both call sites
 * above via `Promise.race`. */
function killAfter(child: ChildProcessWithoutNullStreams, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
      resolve();
    }, ms);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * The single-call convenience wrapper over `withR2000Session()` -- spawns a
 * session, makes exactly one `tools/call`, and closes it. Most `r2000_*`
 * tool implementations (plan 11-05) need only this; `withR2000Session()`
 * itself is for the enum-generation and symbol-round-trip flows that need
 * multiple calls (or a save) inside one session.
 */
export async function callR2000(
  projectPath: string,
  name: string,
  args: Record<string, unknown> = {},
  opts: WithR2000SessionOptions = {}
): Promise<unknown> {
  return withR2000Session(projectPath, (call) => call(name, args), opts);
}

/** SHA-256 hex digest of a file's current bytes, or `null` if the file does
 * not exist (a save's very first call has no "before" state to compare
 * against). Never mtime/size -- RESEARCH.md's own D-17 wording is explicit
 * that "size + mtime change is not enough". */
function hashFileOrNull(path: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export interface SaveAndVerifyResult {
  /** The project file's content hash after the save, independently
   * re-read from disk. */
  hash: string;
}

/**
 * Calls `r2000_save_project` over the given live session, then proves
 * persistence independently by re-reading `projectPath`'s own content hash
 * from disk before and after -- NEVER by trusting `r2000_save_project`'s own
 * text response (`{"content":[{"type":"text","text":"Project saved to
 * <path>"}]}` is a string, not a checksum). Throws
 * `R2000SaveNotPersistedError` (naming `projectPath`) when the hash did not
 * change, rather than returning a `{ saved: false }` result a caller could
 * accidentally ignore -- this IS the phase's highest-value client
 * refusal (T-11-FALSESUCCESS), so it fails loudly, not quietly.
 */
export async function saveAndVerify(projectPath: string, call: R2000Call): Promise<SaveAndVerifyResult> {
  const beforeHash = hashFileOrNull(projectPath);
  await call("r2000_save_project", {});
  const afterHash = hashFileOrNull(projectPath);

  if (afterHash === beforeHash) {
    throw new R2000SaveNotPersistedError(
      `r2000_save_project reported success for "${projectPath}" but its content hash on disk is ` +
        `unchanged (still ${afterHash ?? "absent -- file does not exist"}) -- refusing to report success ` +
        `on the strength of the child's own text response.`,
      { projectPath, beforeHash, afterHash }
    );
  }

  return { hash: afterHash! };
}
