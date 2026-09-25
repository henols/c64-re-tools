// host-tool-endpoint.mts
//
// Phase 65 (SEAM-01, tracer; SEAM-03, plan 65-03): the CONTAINER-side driver
// for a host tool run over the fixed endpoint -- one file in, one result
// back, with NO shared filesystem between this process and the broker.
// `runHostToolOverEndpoint()` is the one function that stages every declared
// local input (a single file, or -- plan 65-03 -- a whole directory TREE),
// uploads it, asks the broker to run the tool against its own per-request
// scratch copy, downloads every declared result, and writes it under the
// CALLER's own `<toolsRoot>/<kind>/` directory -- the first live producer of
// `validateContainedDestination()` (D-07, XFER-03).
//
// THIS FILE MUST STAY A LEAF with respect to the legacy host-tool seam. It
// imports ONLY `broker-endpoint.ts`, `transfer-client.mts`, `transfer-hash.mts`
// and node built-ins -- never `host-tool-client.ts` (the legacy, token-gated
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
//   - Never parse ACME source (or any other tool's source) on this side to
//     decide what to upload (D-04). `walkUploadTree()` below uploads a whole
//     directory tree wholesale -- the directory IS the unit, never a
//     directive scan.
//   - Never follow a symlink out of an uploaded tree by sanitising it.
//     `walkUploadTree()` refuses the WHOLE call by name when a symlink's
//     real target lies outside the tree (D-05) -- there is no partial/best-
//     effort upload.
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";

import { dialHostToolSession, DEFAULT_HOST_TOOL_STAGE_REPLY_TIMEOUT_MS, type DialHostToolSessionOptions, type HostToolSession, type HostToolStageFileSpec, type BrokerEndpointConnectFn } from "./broker-endpoint.ts";
import { transferFileOverEndpoint, validateContainedDestination } from "./transfer-client.mts";
import { TRANSFER_MAX_BYTES } from "./transfer-hash.mts";

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
// seam) must accept as a FILE handle -- the two tables are independently
// declared (this module never imports host-tool.mts, a host-bound sibling)
// but must agree in practice; host-tool-endpoint.test.ts's own acme.build
// case is the first live proof that they do, and host-tool.test.ts's own
// both-directions census (Phase 65, plan 65-03) is what proves it for every
// tool id, in both directions.
//
// `acme.build`'s `source` stays a member of THIS table even though plan
// 65-03 changes how it is staged (see `stageManifestForTool()` below): it is
// still bound to a single FILE handle server-side -- the difference is that
// the file it names now sits inside a whole uploaded directory TREE (its own
// dirname), never uploaded alone.
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

/** Phase 65 (plan 65-03, D-04): the frozen per-tool table of path-bearing
 * keys this route uploads as a whole DIRECTORY TREE rather than a single
 * file -- `acme.build`'s `includes` (an ARRAY of `-I` directories, one tree
 * per entry) and `ghidra.analyze`'s `scriptPath` (Ghidra's own `-scriptPath`
 * flag names a directory). Mirrors `host-tool.mts`'s own
 * `HOST_TOOL_TREE_ARG_KEYS` (the SERVER side of this same seam) -- the two
 * tables are independently declared but must agree in practice;
 * `host-tool.test.ts`'s own both-directions census proves they do. */
export const HOST_TOOL_TREE_INPUT_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "acme.build": Object.freeze(["includes"]),
  "ghidra.analyze": Object.freeze(["scriptPath"]),
});

/** Phase 65 (plan 65-03, D-03): the frozen per-tool table of path-bearing
 * keys that carry NO upload at all -- a bare OUTPUT NAME the tool WRITES,
 * never reads. `ghidra.analyze`'s `exportPath` is the one member: the
 * caller's own local destination path for the classification export, whose
 * `basename()` is what actually rides the wire (the whole local path never
 * does -- D-10). Mirrors `host-tool.mts`'s own `HOST_TOOL_OUTPUT_NAME_ARG_KEYS`. */
export const HOST_TOOL_OUTPUT_NAME_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "ghidra.analyze": Object.freeze(["exportPath"]),
});

/** Phase 65 (plan 65-03, D-11/RESEARCH Pitfall in the plan's own "A tree can
 * exceed the broker's line cap before it exceeds the byte cap" constraint):
 * the client-side JSON-line budget a `host_tool_stage` manifest line must
 * stay under, BEFORE any dial -- kept at or under
 * `broker-control.mts`'s own exported `MAX_LINE_BYTES` (65536) by
 * `host-tool-transport.test.ts`'s own relation case, which imports both
 * modules and asserts the inequality directly rather than trusting this
 * comment. Deliberately duplicated, never imported: `broker-control.mts` is
 * a host-bound sibling, and this module must stay a leaf with respect to
 * the whole host-bound seam (this file's own header). */
export const HOST_TOOL_STAGE_LINE_MAX_BYTES = 65536;

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
  /** Test-only injection point (Phase 65, plan 65-03, RESEARCH Pitfall 4):
   * overrides `dialHostToolSession()` itself so a case can record the wait
   * values this function passes into `session.stage()`/`session.run()` with
   * no real socket. No production caller ever supplies this -- every
   * production call site keeps dialing through `dialHostToolSession()`
   * unchanged (the default). */
  dialSession?: typeof dialHostToolSession;
  /** Test-only injection point, mirroring `dialSession` above -- overrides
   * `transferFileOverEndpoint()` itself, the SEPARATE connection every
   * upload/download rides (never the `dialSession`-injected session
   * connection, which carries only the `host_tool_stage`/`host_tool_run`
   * round trips). Without this, a `dialSession`-only override still opens a
   * REAL transfer socket for every staged file -- this project's standard
   * env/time/spawning/I-O injection register (CLAUDE.md's own Injection
   * convention). No production caller ever supplies this. */
  transferFile?: typeof transferFileOverEndpoint;
}

/** One walked upload-tree entry: `rel` is the forward-slash-joined path
 * relative to the tree's own root (Phase 65, plan 65-03, D-04/D-05); `abs`
 * is the local absolute path to read the bytes from; `size` is its byte
 * length (`statSync`'s own `.size`, following a symlink to its target). */
export interface WalkedUploadEntry {
  rel: string;
  abs: string;
  size: number;
}

export type WalkUploadTreeResult = { ok: true; entries: WalkedUploadEntry[] } | { ok: false; message: string };

/**
 * Walks `root` (a local directory) and returns every FILE beneath it, in a
 * stable SORTED order (D-05's own "SEAM-03/ordering" must-have: two runs
 * over the same tree produce byte-identical entries), skipping every
 * dot-prefixed entry -- file or directory alike (D-05). Never parses a
 * file's own contents to decide what to upload (D-04): the directory is the
 * unit.
 *
 * A symlink is followed ONLY when its REAL target's real path equals the
 * tree's own real root, or lies inside it (a separator-appended prefix
 * comparison, never a lexical `startsWith` on the un-realpathed strings --
 * the same precedent `host-tool.mts`'s own `resolveWorkspacePath()` uses,
 * per this module's own header). A symlink whose real target escapes the
 * tree -- including a sibling directory that merely shares the root's own
 * name as a lexical PREFIX -- refuses the WHOLE walk by name, naming both
 * the link's own path and its real target (D-05, T-65-01). A symlinked
 * directory cycle terminates via a real-path `visited` set: a directory
 * whose OWN real path has already been walked is never walked twice.
 *
 * Returns `{ ok: false, message }` rather than throwing on any filesystem
 * error (an unreadable directory, a broken symlink, a permission fault),
 * naming the offending path.
 */
export function walkUploadTree(root: string): WalkUploadTreeResult {
  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch (e) {
    return { ok: false, message: `walkUploadTree: cannot resolve the tree root ${JSON.stringify(root)}: ${(e as Error).message}` };
  }
  const requiredPrefix = realRoot === sep ? realRoot : realRoot + sep;

  const entries: WalkedUploadEntry[] = [];
  const visitedRealDirs = new Set<string>();

  function isContained(real: string): boolean {
    return real === realRoot || real.startsWith(requiredPrefix);
  }

  function walk(dirAbs: string, dirReal: string, relPrefix: string): { ok: true } | { ok: false; message: string } {
    if (visitedRealDirs.has(dirReal)) return { ok: true };
    visitedRealDirs.add(dirReal);

    let names: string[];
    try {
      names = readdirSync(dirAbs).sort();
    } catch (e) {
      return { ok: false, message: `walkUploadTree: cannot read directory ${JSON.stringify(dirAbs)}: ${(e as Error).message}` };
    }

    for (const name of names) {
      if (name.startsWith(".")) continue;
      const entryAbs = join(dirAbs, name);
      const entryRel = relPrefix === "" ? name : `${relPrefix}/${name}`;

      let lst;
      try {
        lst = lstatSync(entryAbs);
      } catch (e) {
        return { ok: false, message: `walkUploadTree: cannot stat ${JSON.stringify(entryAbs)}: ${(e as Error).message}` };
      }

      if (lst.isSymbolicLink()) {
        let real: string;
        try {
          real = realpathSync(entryAbs);
        } catch (e) {
          return { ok: false, message: `walkUploadTree: cannot resolve the symbolic link ${JSON.stringify(entryAbs)}: ${(e as Error).message}` };
        }
        if (!isContained(real)) {
          return {
            ok: false,
            message: `walkUploadTree: refuses a symbolic link that escapes the uploaded tree: ${JSON.stringify(entryAbs)} resolves to ${JSON.stringify(real)}, outside ${JSON.stringify(realRoot)}`,
          };
        }
        let targetStat;
        try {
          targetStat = statSync(entryAbs);
        } catch (e) {
          return { ok: false, message: `walkUploadTree: cannot stat the target of symbolic link ${JSON.stringify(entryAbs)}: ${(e as Error).message}` };
        }
        if (targetStat.isDirectory()) {
          const sub = walk(entryAbs, real, entryRel);
          if (!sub.ok) return sub;
        } else if (targetStat.isFile()) {
          entries.push({ rel: entryRel, abs: entryAbs, size: targetStat.size });
        }
        // Neither a file nor a directory (device, socket, FIFO) -- skipped,
        // never uploaded and never refused.
        continue;
      }

      if (lst.isDirectory()) {
        const sub = walk(entryAbs, entryAbs, entryRel);
        if (!sub.ok) return sub;
        continue;
      }

      if (lst.isFile()) {
        entries.push({ rel: entryRel, abs: entryAbs, size: lst.size });
      }
    }
    return { ok: true };
  }

  const rootWalk = walk(root, realRoot, "");
  if (!rootWalk.ok) return { ok: false, message: rootWalk.message };
  return { ok: true, entries };
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
  const dial = options.dialSession ?? dialHostToolSession;
  const transfer = options.transferFile ?? transferFileOverEndpoint;

  let session: HostToolSession | null = null;
  try {
    const resolveLocal = (value: string): string => (isAbsolute(value) ? value : join(baseDir, value));

    const fileInputKeys = HOST_TOOL_FILE_INPUT_KEYS[tool] ?? [];
    const treeInputKeys = HOST_TOOL_TREE_INPUT_KEYS[tool] ?? [];
    const outputNameKeys = HOST_TOOL_OUTPUT_NAME_KEYS[tool] ?? [];

    const manifest: HostToolStageFileSpec[] = [];
    const uploadLocalPaths: string[] = [];
    let treeIndex = 0;
    let declaredAggregate = 0;

    const fileBindings: { key: string; manifestIndex: number }[] = [];
    const treeBindings: { key: string; treeIndex: number }[] = [];
    const treeArrayBindings: { key: string; treeIndices: number[] }[] = [];
    const outputNameBindings: { key: string; base: string }[] = [];

    function pushManifestEntry(tree: number, rel: string, localPath: string, byteLength: number): { ok: true; index: number } | { ok: false; message: string } {
      if (byteLength > TRANSFER_MAX_BYTES) {
        return { ok: false, message: `runHostToolOverEndpoint: ${JSON.stringify(localPath)} is ${byteLength} bytes, exceeding the ${TRANSFER_MAX_BYTES} byte cap (16777216)` };
      }
      declaredAggregate += byteLength;
      if (declaredAggregate > TRANSFER_MAX_BYTES) {
        return {
          ok: false,
          message: `runHostToolOverEndpoint: this request's upload aggregate reaches ${declaredAggregate} bytes, exceeding the ${TRANSFER_MAX_BYTES} byte cap (16777216)`,
        };
      }
      const index = manifest.length;
      manifest.push({ tree, rel, byteLength });
      uploadLocalPaths.push(localPath);
      return { ok: true, index };
    }

    function stageTree(rootPath: string): { ok: true; tree: number } | { ok: false; message: string } {
      const walked = walkUploadTree(rootPath);
      if (!walked.ok) return { ok: false, message: `runHostToolOverEndpoint: ${walked.message}` };
      const tree = treeIndex;
      treeIndex += 1;
      for (const entry of walked.entries) {
        const pushed = pushManifestEntry(tree, entry.rel, entry.abs, entry.size);
        if (!pushed.ok) return pushed;
      }
      return { ok: true, tree };
    }

    // acme.build's own `source` is a file WITHIN its own directory tree
    // (D-04): the whole `dirname(source)` uploads as tree 0, and `source`'s
    // OWN upload handle -- not a tree handle -- is what binds to the wire
    // field, found among tree 0's own manifest entries.
    if (tool === "acme.build" && typeof args.source === "string" && args.source !== "") {
      const sourceLocal = resolveLocal(args.source);
      let sourceExists: boolean;
      try {
        sourceExists = statSync(sourceLocal).isFile();
      } catch (e) {
        return { ok: false, message: `runHostToolOverEndpoint: cannot read "source" at ${sourceLocal}: ${(e as Error).message}` };
      }
      if (!sourceExists) {
        return { ok: false, message: `runHostToolOverEndpoint: "source" at ${sourceLocal} is not a regular file` };
      }
      const sourceDir = dirname(sourceLocal);
      const walked = walkUploadTree(sourceDir);
      if (!walked.ok) return { ok: false, message: `runHostToolOverEndpoint: ${walked.message}` };
      const tree = treeIndex;
      treeIndex += 1;
      let sourceManifestIndex: number | undefined;
      for (const entry of walked.entries) {
        const pushed = pushManifestEntry(tree, entry.rel, entry.abs, entry.size);
        if (!pushed.ok) return pushed;
        if (entry.abs === sourceLocal) sourceManifestIndex = pushed.index;
      }
      if (sourceManifestIndex === undefined) {
        return {
          ok: false,
          message: `runHostToolOverEndpoint: "source" at ${sourceLocal} was not found in its own uploaded directory tree -- a dot-prefixed source name is refused, per D-05`,
        };
      }
      fileBindings.push({ key: "source", manifestIndex: sourceManifestIndex });
    } else if (tool === "acme.build" && args.source !== undefined) {
      return { ok: false, message: `runHostToolOverEndpoint: "source" must be a non-empty string path; got ${JSON.stringify(args.source)}` };
    }

    for (const key of fileInputKeys) {
      if (tool === "acme.build" && key === "source") continue; // handled above
      const value = args[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || value === "") {
        return { ok: false, message: `runHostToolOverEndpoint: "${key}" must be a non-empty string path; got ${JSON.stringify(value)}` };
      }
      const localPath = resolveLocal(value);
      let byteLength: number;
      try {
        byteLength = statSync(localPath).size;
      } catch (e) {
        return { ok: false, message: `runHostToolOverEndpoint: cannot read "${key}" at ${localPath}: ${(e as Error).message}` };
      }
      const tree = treeIndex;
      treeIndex += 1;
      const pushed = pushManifestEntry(tree, basename(localPath), localPath, byteLength);
      if (!pushed.ok) return pushed;
      fileBindings.push({ key, manifestIndex: pushed.index });
    }

    for (const key of treeInputKeys) {
      const value = args[key];
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        const indices: number[] = [];
        for (const element of value) {
          if (typeof element !== "string" || element === "") {
            return { ok: false, message: `runHostToolOverEndpoint: each entry of "${key}" must be a non-empty string directory path; got ${JSON.stringify(element)}` };
          }
          const staged = stageTree(resolveLocal(element));
          if (!staged.ok) return staged;
          indices.push(staged.tree);
        }
        treeArrayBindings.push({ key, treeIndices: indices });
      } else {
        if (typeof value !== "string" || value === "") {
          return { ok: false, message: `runHostToolOverEndpoint: "${key}" must be a non-empty string directory path; got ${JSON.stringify(value)}` };
        }
        const staged = stageTree(resolveLocal(value));
        if (!staged.ok) return staged;
        treeBindings.push({ key, treeIndex: staged.tree });
      }
    }

    for (const key of outputNameKeys) {
      const value = args[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || value === "") {
        return { ok: false, message: `runHostToolOverEndpoint: "${key}" must be a non-empty string path; got ${JSON.stringify(value)}` };
      }
      const base = basename(value);
      if (base === "") {
        return { ok: false, message: `runHostToolOverEndpoint: "${key}" resolves to an empty basename; got ${JSON.stringify(value)}` };
      }
      outputNameBindings.push({ key, base });
    }

    // D-11 (Task 2): the mirrored stage-line budget, checked client-side
    // before any dial -- kept at or under broker-control.mts's own
    // MAX_LINE_BYTES (host-tool-transport.test.ts's own relation case).
    const stageLine = JSON.stringify({ op: "host_tool_stage", files: manifest });
    if (Buffer.byteLength(stageLine, "utf8") + 1 > HOST_TOOL_STAGE_LINE_MAX_BYTES) {
      return {
        ok: false,
        message: `runHostToolOverEndpoint: this request's own host_tool_stage manifest line would exceed the ${HOST_TOOL_STAGE_LINE_MAX_BYTES} byte budget -- too many files or paths too long for one request`,
      };
    }

    const dialResult = await dial(dialOptions);
    if (!dialResult.ok) return { ok: false, message: dialResult.reason };
    session = dialResult.session;

    const stageResult = await session.stage(manifest, DEFAULT_HOST_TOOL_STAGE_REPLY_TIMEOUT_MS);
    if (!stageResult.ok) return { ok: false, message: stageResult.reason };

    for (let i = 0; i < manifest.length; i++) {
      const handle = stageResult.files[i];
      if (handle === undefined) {
        return { ok: false, message: `runHostToolOverEndpoint: host_tool_stage reply is missing a file handle for manifest entry ${i}` };
      }
      const uploadResult = await transfer({ direction: "upload", handle, sourcePath: uploadLocalPaths[i]! }, dialOptions);
      if (!uploadResult.ok) return { ok: false, message: uploadResult.reason };
    }

    const boundArgs: Record<string, unknown> = { ...args };
    for (const { key, manifestIndex } of fileBindings) {
      const handle = stageResult.files[manifestIndex];
      if (handle === undefined) {
        return { ok: false, message: `runHostToolOverEndpoint: host_tool_stage reply is missing a handle for "${key}"` };
      }
      boundArgs[key] = handle;
    }
    for (const { key, treeIndex: idx } of treeBindings) {
      const handle = stageResult.trees[idx];
      if (handle === undefined) {
        return { ok: false, message: `runHostToolOverEndpoint: host_tool_stage reply is missing a tree handle for "${key}"` };
      }
      boundArgs[key] = handle;
    }
    for (const { key, treeIndices } of treeArrayBindings) {
      const handles: string[] = [];
      for (const idx of treeIndices) {
        const handle = stageResult.trees[idx];
        if (handle === undefined) {
          return { ok: false, message: `runHostToolOverEndpoint: host_tool_stage reply is missing a tree handle for "${key}"` };
        }
        handles.push(handle);
      }
      boundArgs[key] = handles;
    }
    for (const { key, base } of outputNameBindings) {
      boundArgs[key] = base;
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
      const downloadResult = await transfer({ direction: "download", handle: result.handle, destPath: validated.resolved }, dialOptions);
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
