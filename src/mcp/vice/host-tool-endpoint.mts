// host-tool-endpoint.mts
//
// Phase 65 (SEAM-01, tracer): the CONTAINER-side driver for a host tool run
// over the fixed endpoint -- one file in, one result back, with NO shared
// filesystem between this process and the broker. `runHostToolOverEndpoint()`
// is the one function that stages a local input file, uploads it, asks the
// broker to run the tool against its own per-request scratch copy,
// downloads the declared result, and writes it under the CALLER's own
// `<toolsRoot>/<kind>/` directory -- the first live producer of
// `validateContainedDestination()` (D-07, XFER-03).
//
// THIS FILE MUST STAY A LEAF with respect to the legacy host-tool seam. It
// imports ONLY `broker-endpoint.ts`, `transfer-client.mts` and node
// built-ins -- never `host-tool-client.ts` (the legacy, token-gated
// control-plane/host-spawn seam this route runs alongside, not through),
// never `repo-root.ts` (this module never resolves THIS project's own
// workspace root -- every path it writes is relative to a CALLER-supplied
// `toolsRoot`, per the assumption_delta_decision this plan records), and
// never `containerpath.ts` (there is no host/container path translation on
// this route at all -- every byte crosses as a payload, never a shared-
// filesystem path).
//
// WHAT NOT TO DO:
//   - Never write a broker-side path anywhere the caller can see it. Every
//     result crosses back as `{ name, handle, sha256, byteLength }`
//     (`vice-broker.mts`'s own `handleHostToolRun()`), and this module turns
//     `name` into a LOCAL destination via `validateContainedDestination()`
//     BEFORE ever downloading a byte -- a name that fails is refused, never
//     sanitised (D-07).
//   - Never trust the broker's declared `byteLength`/`sha256` on a
//     downloaded result without re-checking it against the DOWNLOAD's own
//     observed values (`transferFileOverEndpoint()`'s own D-11 posture,
//     applied here a second time at the whole-result level).
//   - Never open a second endpoint dialer. Every connection this module
//     opens goes through `dialHostToolSession()`/`transferFileOverEndpoint()`
//     (both `broker-endpoint.ts`/`transfer-client.mts`); this module carries
//     no socket code of its own.
import { basename, isAbsolute, join } from "node:path";
import { statSync } from "node:fs";

import { dialHostToolSession, type DialHostToolSessionOptions, type HostToolSession, type HostToolStageFileSpec, type BrokerEndpointConnectFn } from "./broker-endpoint.ts";
import { transferFileOverEndpoint, validateContainedDestination } from "./transfer-client.mts";

// ---------------------------------------------------------------------------
// Moved here verbatim from host-tool-client.ts (Phase 65, SEAM-01) --
// host-tool-client.ts re-exports all five unchanged, so
// host-tool.test.ts's own cross-seam ordering case still imports them from
// there.
// ---------------------------------------------------------------------------

export interface HostToolFileResult {
  path: string;
  sha256: string;
  byteLength: number;
}

/** The per-tool CLIENT-side request-deadline table. Bounds the REQUEST
 * phase only, mirroring `openBrokerControl()`'s own connect-then-request
 * split. Every entry here MUST be strictly greater than `host-tool.mts`'s
 * own `HOST_TOOL_TIMEOUT_MS` entry for the SAME tool id -- the side that
 * owns the budget (the host-bound executor) must be the side that reports
 * the verdict, or a caller sees an opaque transport timeout instead of the
 * host's own diagnosable refusal. This ordering is asserted by
 * host-tool.test.ts's own cross-seam ordering case, which imports BOTH
 * sides and iterates every tool id. */
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
 * different processes. */
export function hostToolRequestTimeoutMs(tool: string): number {
  return HOST_TOOL_REQUEST_TIMEOUT_MS[tool] ?? DEFAULT_HOST_TOOL_REQUEST_TIMEOUT_MS;
}

/** The wire shape host-tool.mts's runHostTool() produces, mirrored here
 * rather than imported as a value -- this file only ever receives this
 * shape as untrusted JSON off a socket, never as a same-process function
 * call. */
export type HostToolClientResult =
  | { ok: true; tool: string; exitStatus: number | null; results: HostToolFileResult[]; stderrTail: string }
  | { ok: false; message: string };

// ---------------------------------------------------------------------------
// The frozen per-tool kind table (Discretion item, this plan's objective) --
// where a result lands under the caller's own toolsRoot. A tool id absent
// from this table (e.g. `ghidra.installExtension`, `oracle.probe`,
// `oracle.run`) has no declared kind directory; a result for such a tool
// lands directly under `toolsRoot` itself.
// ---------------------------------------------------------------------------

export const HOST_TOOL_KIND_DIR: Readonly<Record<string, string>> = Object.freeze({
  "acme.build": "builds",
  "dxa.disassemble": "dxa",
  "c1541.bam": "c1541",
  "c1541.dir": "c1541",
  "c1541.entry": "c1541",
  "c1541.chain": "c1541",
  "c1541.read": "c1541",
  "petcat.decode": "petcat",
  "ghidra.analyze": "runs/ghidra",
});

// ---------------------------------------------------------------------------
// HOST_TOOL_FILE_INPUT_KEYS -- the frozen per-tool table of single-file
// input keys this route stages and uploads. A key here is what
// `host-tool.mts`'s own `bindStagedInputs()` (the SERVER side of this same
// seam) must accept as a handle -- the two tables are independently
// declared (this module never imports host-tool.mts, a host-bound sibling)
// but must agree in practice; host-tool-endpoint.test.ts's own acme.build
// case is the first live proof that they do.
// ---------------------------------------------------------------------------

export const HOST_TOOL_FILE_INPUT_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "acme.build": Object.freeze(["source"]),
  "ghidra.analyze": Object.freeze(["importPath", "preScript", "postScript", "entrypointsPath", "dataRangesPath"]),
  "oracle.run": Object.freeze(["source"]),
  "dxa.disassemble": Object.freeze(["image", "entrypointsPath", "datablocksPath", "labelsPath"]),
  "c1541.bam": Object.freeze(["image"]),
  "c1541.dir": Object.freeze(["image"]),
  "c1541.entry": Object.freeze(["image"]),
  "c1541.chain": Object.freeze(["image"]),
  "c1541.read": Object.freeze(["image"]),
  "petcat.decode": Object.freeze(["image"]),
});

export interface RunHostToolOverEndpointOptions {
  /** The caller's own local directory a result is written under -- REQUIRED.
   * A result's own `HOST_TOOL_KIND_DIR[tool]` subdirectory (or `toolsRoot`
   * itself, for a tool absent from that table) is created if it does not
   * already exist -- `transferFileOverEndpoint()`'s own download branch
   * `mkdirSync(..., { recursive: true })`s it. */
  toolsRoot: string;
  /** Every relative file-input path in `args` resolves against this
   * directory -- defaults to `process.cwd()`. */
  baseDir?: string;
  port?: number;
  candidates?: readonly string[];
  connect?: BrokerEndpointConnectFn;
  clientVersion?: string;
}

/** One local file input this call stages: `key` names the wire field it
 * came from, `localPath` is the already-resolved absolute local path,
 * `rel` is the manifest entry's own basename -- the staged filename on the
 * broker side. */
interface PendingFileInput {
  key: string;
  localPath: string;
  rel: string;
}

/**
 * Runs a host tool through the fixed endpoint end to end: stages every
 * declared file-input key present on `args` (per `HOST_TOOL_FILE_INPUT_KEYS`),
 * uploads each in manifest order, runs the tool with the upload handles
 * substituted for the original local paths, validates and downloads every
 * declared result under `options.toolsRoot`, and closes the session in a
 * `finally` on every path. Never throws: every failure resolves
 * `{ ok: false, message }`.
 */
export async function runHostToolOverEndpoint(tool: string, args: Record<string, unknown>, options: RunHostToolOverEndpointOptions): Promise<HostToolClientResult> {
  const baseDir = options.baseDir ?? process.cwd();
  const dialOptions: DialHostToolSessionOptions = {
    port: options.port,
    candidates: options.candidates,
    connect: options.connect,
    clientVersion: options.clientVersion,
  };

  let session: HostToolSession | null = null;
  try {
    const fileInputKeys = HOST_TOOL_FILE_INPUT_KEYS[tool] ?? [];
    const pendingInputs: PendingFileInput[] = [];
    const manifest: HostToolStageFileSpec[] = [];
    let treeIndex = 0;
    for (const key of fileInputKeys) {
      const value = args[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || value === "") {
        return { ok: false, message: `runHostToolOverEndpoint: "${key}" must be a non-empty string path; got ${JSON.stringify(value)}` };
      }
      const localPath = isAbsolute(value) ? value : join(baseDir, value);
      let byteLength: number;
      try {
        byteLength = statSync(localPath).size;
      } catch (e) {
        return { ok: false, message: `runHostToolOverEndpoint: cannot read "${key}" at ${localPath}: ${(e as Error).message}` };
      }
      const rel = basename(localPath);
      manifest.push({ tree: treeIndex, rel, byteLength });
      pendingInputs.push({ key, localPath, rel });
      treeIndex += 1;
    }

    const dialResult = await dialHostToolSession(dialOptions);
    if (!dialResult.ok) return { ok: false, message: dialResult.reason };
    session = dialResult.session;

    const stageResult = await session.stage(manifest);
    if (!stageResult.ok) return { ok: false, message: stageResult.reason };

    const boundArgs: Record<string, unknown> = { ...args };
    for (let i = 0; i < pendingInputs.length; i++) {
      const input = pendingInputs[i]!;
      const handle = stageResult.files[i];
      if (handle === undefined) {
        return { ok: false, message: `runHostToolOverEndpoint: host_tool_stage reply is missing a handle for "${input.key}"` };
      }
      const uploadResult = await transferFileOverEndpoint({ direction: "upload", handle, sourcePath: input.localPath }, dialOptions);
      if (!uploadResult.ok) return { ok: false, message: uploadResult.reason };
      boundArgs[input.key] = handle;
    }

    const replyTimeoutMs = hostToolRequestTimeoutMs(tool);
    const runResult = await session.run(tool, boundArgs, stageResult.request, replyTimeoutMs);
    if (!runResult.ok) return { ok: false, message: runResult.reason };

    const response = runResult.response as Record<string, unknown>;
    if (response.ok !== true) {
      const message = typeof response.message === "string" ? response.message : "runHostToolOverEndpoint: the host tool refused";
      return { ok: false, message };
    }

    const kind = HOST_TOOL_KIND_DIR[tool];
    const destDir = kind !== undefined ? join(options.toolsRoot, kind) : options.toolsRoot;
    const rawResults = Array.isArray(response.results) ? (response.results as { name: string; handle: string; sha256: string; byteLength: number }[]) : [];
    const downloadedResults: HostToolFileResult[] = [];
    for (const result of rawResults) {
      const validated = validateContainedDestination(result.name, destDir);
      if (!validated.ok) {
        return { ok: false, message: `runHostToolOverEndpoint: refusing result name ${JSON.stringify(result.name)}: ${validated.reason}` };
      }
      const downloadResult = await transferFileOverEndpoint({ direction: "download", handle: result.handle, destPath: validated.resolved }, dialOptions);
      if (!downloadResult.ok) return { ok: false, message: downloadResult.reason };
      if (downloadResult.byteLength !== result.byteLength || downloadResult.sha256 !== result.sha256) {
        return {
          ok: false,
          message: `runHostToolOverEndpoint: downloaded ${validated.resolved} does not match the run reply's declared byteLength/sha256 (declared ${result.byteLength}/${result.sha256}, observed ${downloadResult.byteLength}/${downloadResult.sha256})`,
        };
      }
      downloadedResults.push({ path: validated.resolved, sha256: downloadResult.sha256, byteLength: downloadResult.byteLength });
    }

    const rewritten: Record<string, unknown> = { ...response, results: downloadedResults };
    return rewritten as unknown as HostToolClientResult;
  } finally {
    session?.close();
  }
}
