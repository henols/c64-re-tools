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
import { dirname, join } from "node:path";
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

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`hostToolOverControlPlane: no response within ${CONTROL_CONNECT_TIMEOUT_MS}ms`));
    }, CONTROL_CONNECT_TIMEOUT_MS);
    if (typeof timer.unref === "function") timer.unref();

    socket.on("connect", () => {
      const requestId = newRequestId();
      socket.write(`${JSON.stringify({ op: "host_tool", id: requestId, token, tool, args })}\n`);
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
        clearTimeout(timer);
        socket.destroy();
        reject(new Error("hostToolOverControlPlane: malformed response line"));
        return;
      }
      if (!isPlainObject(parsed)) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error("hostToolOverControlPlane: response line is not a JSON object"));
        return;
      }

      settled = true;
      clearTimeout(timer);
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
      clearTimeout(timer);
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
  const raw = isInsideContainer()
    ? await hostToolOverControlPlane(opts.dir ?? brokerRootDir(), tool, args)
    : await hostToolOverHostRoute(opts.repoRoot ?? repoRoot({ from: HERE }), tool, args);
  return translateHostToolResponse(raw);
}
