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
//   - Never keep a child alive between logical operations (D-17). The
//     lifecycle is spawn -> initialize -> call(s) -> (optional save) ->
//     stdin close -> exit, once per `withR2000Session()` call. There is no
//     long-lived child, no supervision, and no second wedge class to add to
//     this project's existing stock-VICE one.
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
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Spawns `regenerator2000 --mcp-server-stdio <projectPath>` (via
 * `buildMcpServerStdioArgs()`, so `assertNoViceFlag()`'s guard applies here
 * too, defense in depth even though this builder can never itself emit
 * `--vice`), performs the `initialize` handshake, invokes `fn` with a
 * `call(name, args)` function bound to this one session, then closes stdin
 * (ending the child's read loop per `mcp/stdio.rs:72`,
 * `while reader.read_line(...) > 0`), waits for exit, and resolves ONLY
 * after the exit code and captured stderr have been inspected (D-17: one
 * session per logical operation, never a long-lived child).
 *
 * Every failure mode below is a distinct named error class -- see the
 * class definitions above for what each one means and how it differs from
 * its neighbours.
 */
export async function withR2000Session<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>,
  opts: WithR2000SessionOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_R2000_CALL_TIMEOUT_MS;
  const bin = opts.bin ?? process.env.R2000_BIN ?? "regenerator2000";
  const argv = buildMcpServerStdioArgs({ projectPath });
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

  try {
    await request("initialize", {
      protocolVersion: R2000_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "vice-mcp", version: "0" },
    });
    // A notification, per MCP spec -- no id, no response expected.
    send({ jsonrpc: "2.0", method: "notifications/initialized" });

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

    let fnResult: T;
    try {
      fnResult = await fn(call);
    } finally {
      // Ends the child's read loop (mcp/stdio.rs:72) regardless of whether
      // fn() threw -- a session always tries to close cleanly.
      child.stdin.end();
      await Promise.race([exitPromise, killAfter(child, timeoutMs)]);
      rl.close();
    }

    // T-11-FALSESUCCESS's mirror image (D-17): every call succeeded, but if
    // the FINAL exit was non-zero, the whole session still fails.
    if (exitCode !== 0 && exitCode !== null) {
      throw new R2000SessionFailedError(
        `regenerator2000 exited ${exitCode} after an otherwise-successful call sequence -- stderr: ${stderrBuf || "(empty)"}`,
        { exitCode, stderr: stderrBuf }
      );
    }

    return fnResult;
  } catch (err) {
    // Make sure a thrown fn()/request() error still closes stdin and reaps
    // the child rather than leaking it -- the try/finally above already
    // covers the "fn() itself threw" path; this covers "initialize itself
    // threw", where the inner try/finally never ran.
    if (!childExited) {
      try {
        child.stdin.end();
      } catch {
        /* already closed */
      }
      await Promise.race([exitPromise, killAfter(child, timeoutMs)]);
    }
    rl.close();
    throw err;
  }
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
