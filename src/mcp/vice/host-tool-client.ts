#!/usr/bin/env node
// host-tool-client.ts
//
// Phase 34, plan 34-01 (SEAM-01..SEAM-03, tracer): the CONTAINER-side half of
// the host-tool execution seam. Mirrors vice-broker-client.ts's
// acquireOverControlPlane() shape exactly: read broker.json ONCE, resolve the
// dial target, open ONE connection, write ONE JSON line, await ONE response
// line, then close -- session-less and short-lived, no lease held. That is
// SEAM-01's "consumes no emulator lease" satisfied by construction: this
// module never writes an `acquire` line, never holds a socket open past one
// request/response pair, and the broker's own host_tool dispatch branch
// (broker-control.mts) never calls any of the seven VICE callbacks for it.
//
// TWO ROUTES, chosen by isInsideContainer() -- the project's ONE container
// detector -- and NEVER by whether a broker happens to be reachable:
//   - inside a container, the ONLY route is the control op
//     (hostToolOverControlPlane(), below), dialled at the broker's control
//     port exactly like acquireOverControlPlane() already is;
//   - on the host, the ONLY route is a direct `spawn` of
//     `resources/host-tool.mjs` under `process.execPath`, carrying the same
//     typed request on argv.
// WHY THE HOST ROUTE EXISTS, AND WHY IT IS NOT A SECOND EXECUTOR:
// `.github/workflows/ci.yml` invokes `acme.mjs build` on a flat GitHub
// Actions runner with no container and no broker -- removing the host route
// would DELETE a working route rather than migrate it. Both routes reach the
// SAME executor module (host-tool.mts, compiled to resources/host-tool.mjs),
// the same allowlist, the same argv construction and the same digest -- there
// is exactly one place a binary is ever spawned; this file only ever decides
// HOW to reach it.
//
// Every response `path` is translated through containerPath()
// (containerpath.ts) before it is handed back to a caller -- never through
// hostpath.ts, which this file must NEVER import (A-03): a `host_tool`
// request never carries a host-absolute path in the first place (every path
// argument is workspace-relative, resolved server-side by
// host-tool.mts's resolveWorkspacePath()), so only the RESULT direction
// (host -> container) ever needs translation here, and containerpath.ts is
// already a declared consumer of hostpath.ts's own closed set
// (hostpath-consumers.test.ts) -- reaching it through containerpath.ts keeps
// this new family off that five-member list entirely, by construction.
//
// Do not write the tokens `binPath`, `viceBin`, `VICE_BIN` or `x64sc`
// anywhere in this file -- it ships (package.json `files[]`) and is scanned
// by spawn-seam.test.ts, which would misclassify a bare identifier match as
// an emulator spawn site.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { brokerRootDir, brokerJsonPath, newRequestId, resolveControlTarget, CONTROL_CONNECT_TIMEOUT_MS } from "./vice-broker-client.ts";
import { containerPath } from "./containerpath.ts";
import { isInsideContainer } from "./container-guard.mts";
import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** True iff `value` is a well-formed, generic JSON object -- not null, not an
 * array. A local copy of vice-broker-client.ts's own isPlainObject(), which
 * is not exported -- this file's own untrusted-input parsing needs the exact
 * same shape check, not a re-export of an internal helper. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads and parses `path` as JSON, returning `null` (never throwing) on any
 * failure -- absent file, unreadable, malformed JSON, or a non-object
 * result. Mirrors vice-broker-client.ts's own never-throw posture toward
 * broker.json. */
function readJsonMaybe(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface HostToolFileResult {
  path: string;
  sha256: string;
  byteLength: number;
}

/** 34-09 (CR-04): the per-tool CLIENT-side request-deadline table, declared
 * in THIS file (never in vice-broker-client.ts, whose export list is pinned
 * by exact set equality -- vice-broker-client.test.ts:1208 -- this file has
 * no such census). Bounds the REQUEST phase only, the phase AFTER the
 * connect timer below has already been cleared -- mirroring
 * openBrokerControl()'s own connect-then-request split
 * (vice-broker-client.ts). Every entry here MUST be strictly greater than
 * host-tool.mts's own HOST_TOOL_TIMEOUT_MS entry for the SAME tool id: the
 * side that owns the budget (the host-bound executor) must be the side that
 * reports the verdict, or a caller sees an opaque transport timeout instead
 * of the host's own diagnosable refusal. This ordering is asserted by
 * host-tool.test.ts's own cross-seam ordering case, which imports BOTH
 * sides and iterates every tool id -- the anti-drift mechanism for two
 * numbers that deliberately live in two files (two processes, one
 * container-side and one host-bound). `ghidra.analyze`'s entry (660_000ms)
 * exceeds the server-side Ghidra budget (600_000ms, host-tool.mts) by 60
 * seconds -- comfortably larger without being needlessly slack. */
export const HOST_TOOL_REQUEST_TIMEOUT_MS: Readonly<Record<string, number>> = Object.freeze({
  "ghidra.analyze": 660_000,
});

/** Fallback request-deadline for a tool id absent from the table above --
 * strictly greater than host-tool.mts's own DEFAULT_HOST_TOOL_TIMEOUT_MS
 * (20_000ms), the server-side fallback for the same tools. */
export const DEFAULT_HOST_TOOL_REQUEST_TIMEOUT_MS = 30_000;

/** The resolver: an exact table entry wins, else the default above. Mirrors
 * host-tool.mts's own hostToolTimeoutMs() shape on the OTHER side of the
 * seam -- deliberately duplicated, never imported: the two sides run in
 * different processes (this file is container-side, host-tool.mts is
 * host-bound), so there is nothing to import across that boundary. The
 * cross-seam ordering test is what keeps the two numbers from drifting
 * apart, not a shared value. */
export function hostToolRequestTimeoutMs(tool: string): number {
  return HOST_TOOL_REQUEST_TIMEOUT_MS[tool] ?? DEFAULT_HOST_TOOL_REQUEST_TIMEOUT_MS;
}

/** The wire shape host-tool.mts's runHostTool() produces, mirrored here
 * rather than imported as a value -- this file only ever receives this shape
 * as untrusted JSON off a socket or a child process's stdout, never as a
 * same-process function call. */
export type HostToolClientResult =
  | { ok: true; tool: string; exitStatus: number | null; results: HostToolFileResult[]; stderrTail: string }
  | { ok: false; message: string };

/** Dials the broker's control plane, sends ONE `host_tool` request line, and
 * resolves with the raw (untranslated) response -- never rejects on an
 * application-level refusal (`{ ok: false, message }` from host-tool.mts's
 * own allowlist), only on a transport/protocol failure: unreadable
 * broker.json, a connection error, a malformed response line, a
 * control-plane-level `error` response (unauthorized/bad_request/internal --
 * distinct from the tool's OWN refusal shape), or a timeout. `dir` defaults
 * to brokerRootDir(), exactly as acquireOverControlPlane() does, so a test
 * can point it at a scratch directory. */
export function hostToolOverControlPlane(
  dir: string = brokerRootDir(),
  tool: string,
  args: Record<string, unknown>,
): Promise<HostToolClientResult> {
  return new Promise((resolvePromise, reject) => {
    const broker = readJsonMaybe(brokerJsonPath(dir));
    if (broker === null) {
      reject(new Error("hostToolOverControlPlane: broker.json not present or unreadable"));
      return;
    }
    const port = typeof broker.control_port === "number" ? broker.control_port : null;
    const token = typeof broker.control_token === "string" ? broker.control_token : null;
    if (port === null || token === null) {
      reject(new Error("hostToolOverControlPlane: broker.json missing control_port/control_token"));
      return;
    }

    const targetResult = resolveControlTarget(broker, port);
    if (!targetResult.ok) {
      reject(new Error(targetResult.message));
      return;
    }
    const { host } = targetResult.target;

    const socket = connect({ host, port });
    let buffer = "";
    let settled = false;

    // 34-09 (CR-04): TWO timers, mirroring openBrokerControl()'s own
    // connect-then-request split (vice-broker-client.ts). Before this plan a
    // SINGLE timer bounded the CONNECT phase AND the tool's entire
    // execution -- a ghidra.analyze run that legitimately outlives the
    // TCP-connect budget could never complete over this route at all. The
    // connect timer bounds ONLY the TCP handshake and is cleared the moment
    // `connect` fires; the request-deadline timer then bounds the actual
    // tool execution, sized per tool by hostToolRequestTimeoutMs() above.
    let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`hostToolOverControlPlane: no connection within ${CONTROL_CONNECT_TIMEOUT_MS}ms (connect phase)`));
    }, CONTROL_CONNECT_TIMEOUT_MS);
    if (typeof connectTimer.unref === "function") connectTimer.unref();

    let requestTimer: ReturnType<typeof setTimeout> | null = null;

    socket.on("connect", () => {
      if (settled) return;
      // Clear the connect timer THE MOMENT the request line is written --
      // exactly where openBrokerControl()'s own onConnect() clears its
      // connect timer before sendAndAwaitLine()'s separate per-request
      // deadline takes over.
      if (connectTimer !== null) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      const requestId = newRequestId();
      socket.write(`${JSON.stringify({ op: "host_tool", id: requestId, token, tool, args })}\n`);

      const requestTimeoutMs = hostToolRequestTimeoutMs(tool);
      requestTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(new Error(`hostToolOverControlPlane: no response within ${requestTimeoutMs}ms (request deadline)`));
      }, requestTimeoutMs);
      if (typeof requestTimer.unref === "function") requestTimer.unref();
    });

    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      const newlineIdx = buffer.indexOf("\n");
      if (newlineIdx === -1) return;
      const line = buffer.slice(0, newlineIdx);

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        settled = true;
        if (requestTimer !== null) clearTimeout(requestTimer);
        socket.destroy();
        reject(new Error("hostToolOverControlPlane: malformed response line"));
        return;
      }
      if (!isPlainObject(parsed)) {
        settled = true;
        if (requestTimer !== null) clearTimeout(requestTimer);
        socket.destroy();
        reject(new Error("hostToolOverControlPlane: response line is not a JSON object"));
        return;
      }

      settled = true;
      if (requestTimer !== null) clearTimeout(requestTimer);
      socket.destroy();

      // A control-plane-level error (unauthorized/bad_request/internal) is a
      // DIFFERENT failure from the tool's own `{ ok: false, message }`
      // refusal -- only THIS shape rejects; the tool's own refusal resolves
      // normally so a caller can inspect `message` without a try/catch.
      if (parsed.kind === "error") {
        reject(new Error(`hostToolOverControlPlane: ${String(parsed.code)}: ${String(parsed.message)}`));
        return;
      }
      resolvePromise(parsed as unknown as HostToolClientResult);
    });

    socket.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (connectTimer !== null) clearTimeout(connectTimer);
      if (requestTimer !== null) clearTimeout(requestTimer);
      reject(err);
    });
  });
}

/** The host-local route: spawns resources/host-tool.mjs directly, under
 * `process.execPath`, with the same typed request passed on argv -- the same
 * executor, the same allowlist, the same argv construction, the same digest.
 * Never rejects on the tool's OWN refusal (a non-zero exit still prints one
 * JSON response line, which this function parses and resolves); rejects only
 * on a transport failure -- the child could not be spawned, or its stdout
 * did not end in a parseable JSON line. */
function hostToolOverHostRoute(repoRootPath: string, tool: string, args: Record<string, unknown>): Promise<HostToolClientResult> {
  return new Promise((resolvePromise, reject) => {
    const scriptPath = join(HERE, "resources", "host-tool.mjs");
    const requestJson = JSON.stringify({ tool, args });
    let child;
    try {
      child = spawn(process.execPath, [scriptPath, "run", "--repo-root", repoRootPath, "--request", requestJson], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", () => {
      const lines = stdout.split("\n").filter((line) => line.trim() !== "");
      const lastLine = lines[lines.length - 1];
      if (lastLine === undefined) {
        reject(new Error(`hostToolOverHostRoute: host-tool.mjs produced no output on stdout${stderr ? ` (stderr: ${stderr})` : ""}`));
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(lastLine);
      } catch {
        reject(new Error(`hostToolOverHostRoute: host-tool.mjs's stdout is not a parseable JSON line: ${lastLine}`));
        return;
      }
      if (!isPlainObject(parsed)) {
        reject(new Error("hostToolOverHostRoute: host-tool.mjs's response line is not a JSON object"));
        return;
      }
      resolvePromise(parsed as unknown as HostToolClientResult);
    });
  });
}

// Translates every response `path` through containerPath() -- never the
// sibling host-to-container translation module this file must never import
// (A-03, see this file's own header). A refusal (`{ ok: false }`) carries no
// `path` field at all, so it passes through unchanged.
function translateHostToolResponse(response: HostToolClientResult): HostToolClientResult {
  if (!response.ok) return response;
  return {
    ...response,
    results: response.results.map((result) => ({ ...result, path: containerPath(result.path) })),
  };
}

export interface RunHostToolFromContainerOptions {
  /** Control-plane state directory override (test seam) -- only consulted on
   * the container route; ignored on the host route. */
  dir?: string;
  /** Repo root override for the host route (test seam); defaults to
   * repoRoot()'s own ladder. Ignored on the container route -- the broker's
   * own `--repo-root` is authoritative there. */
  repoRoot?: string;
}

/** The single route-selecting entry point. Transport is chosen by
 * isInsideContainer() -- the project's ONE container detector -- and NOT by
 * whether a broker happens to be reachable. */
export async function runHostToolFromContainer(
  tool: string,
  args: Record<string, unknown>,
  opts: RunHostToolFromContainerOptions = {},
): Promise<HostToolClientResult> {
  if (isInsideContainer()) {
    const raw = await hostToolOverControlPlane(opts.dir ?? brokerRootDir(), tool, args);
    return translateHostToolResponse(raw);
  }
  // Host route (34-04, SEAM-05): host and container coordinates are the
  // SAME filesystem here -- there is no container to translate across --
  // so the raw host-absolute paths in the response are already correct for
  // the calling process. Skip containerPath() entirely rather than call it
  // unconditionally: containerPath() only resolves a path that falls under
  // THIS project's own workspace root (hostRootCandidates()), which a
  // legitimate host-route invocation need not be under at all -- e.g. a
  // build rooted at a scratch directory outside the repo (this project's own
  // skill-acme-build-cli.test.ts, and CI's RUNNER_TEMP-rooted scaffold
  // check, both build entirely outside the repo tree).
  return hostToolOverHostRoute(opts.repoRoot ?? repoRoot({ from: HERE }), tool, args);
}

// ---------------------------------------------------------------------------
// CLI entry point (Phase 34, plan 34-04, SEAM-05).
//
// The migrated skill scripts (acme.mjs, packer-finding.mjs) live in a
// DIFFERENT npm package than this file (@henols/c64-re-tools vs.
// @henols/vice-mcp), so a static `import` of runHostToolFromContainer()
// resolves on neither npm-installer distribution route -- exactly the
// cross-package constraint vsf-slice.mjs's own header already records for a
// different module. Those scripts instead LOCATE this file on disk (via
// mcp-module.mjs's resolveMcpModule() ladder) and invoke it as a subprocess:
// `process.execPath <resolved-path> run --tool <id> --args <json> [--repo-root <path>]`.
// This is the interpreter already running the calling script, spawned on an
// in-tree module -- not an external host binary, and not a second executor:
// it is the SAME route selection (isInsideContainer()) and the SAME
// runHostToolFromContainer() this file already exposes as a value import for
// same-package (src/mcp/vice/**) callers.
//
// Prints exactly ONE line of JSON on stdout (the translated
// HostToolClientResult) and exits 0 when it carries `ok: true`, 1 otherwise
// -- including a transport-level failure (rejected promise), which is
// reported in the SAME `{ ok: false, message }` shape a tool's own refusal
// uses, so a caller never needs to distinguish "the seam refused" from "the
// seam was unreachable" by inspecting anything but `ok`/`message`.
function parseRunCliArgs(argv: string[]): { tool?: string; args?: string; repoRoot?: string } {
  let tool: string | undefined;
  let args: string | undefined;
  let repoRoot: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tool") {
      tool = argv[++i];
    } else if (argv[i] === "--args") {
      args = argv[++i];
    } else if (argv[i] === "--repo-root") {
      repoRoot = argv[++i];
    }
  }
  return { tool, args, repoRoot };
}

const IS_ENTRY_POINT = process.argv[1] !== undefined && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_ENTRY_POINT) {
  const USAGE = "usage: host-tool-client.ts run --tool <tool> --args <json> [--repo-root <path>]\n";
  const [, , cliCommand, ...cliRest] = process.argv;
  if (cliCommand !== "run") {
    process.stderr.write(USAGE);
    process.exitCode = 1;
  } else {
    const { tool, args, repoRoot: repoRootArg } = parseRunCliArgs(cliRest);
    if (!tool || args === undefined) {
      process.stderr.write(USAGE);
      process.exitCode = 1;
    } else {
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(args);
      } catch {
        parsedArgs = null;
      }
      const argsObj = isPlainObject(parsedArgs) ? parsedArgs : {};
      runHostToolFromContainer(tool, argsObj, repoRootArg ? { repoRoot: repoRootArg } : {})
        .then((response) => {
          process.stdout.write(`${JSON.stringify(response)}\n`);
          process.exitCode = response.ok ? 0 : 1;
        })
        .catch((err: unknown) => {
          process.stdout.write(`${JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) })}\n`);
          process.exitCode = 1;
        });
    }
  }
}
