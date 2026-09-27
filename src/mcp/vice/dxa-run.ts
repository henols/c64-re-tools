#!/usr/bin/env node
// dxa-run.ts
//
// WHY THIS FILE EXISTS: the client side of the `dxa.disassemble` host tool.
// runDxaDisassemble() sends one typed request through the broker's fixed
// endpoint (`runHostToolOverEndpoint()`, host-tool-endpoint.mts), reads the
// downloaded `-a dump` listing, and parses it into a byte-level code/data
// map (dxa-listing.ts). Run as a script, this file is the CLI that the
// c64-disassembler skill spawns with `process.execPath`: it parses flags,
// calls runDxaDisassemble() and prints one JSON line (see the CLI section at
// the bottom).
//
// The endpoint client uploads every input by bytes and downloads the listing
// under the caller's tools root, so the listing path is a local path, read
// as given.
//
// The parser's window comes from the IMAGE FILE, never from the listing:
// deriving the window from the text being checked against it would make the
// check vacuous. For `imageKind: "prg"` the window is parsePrg()'s origin
// and a body of `fileSize - 2`; for `imageKind: "flat64k"` it is origin 0
// and the file's own size (flatImageOrigin(), prg-image.mts, refuses any
// size but 65536).
//
// `knownDataRows` is an alternative to caller-written `datablocksPath`/
// `labelsPath` files: this module writes the rows to per-run `-B`/`-l` files
// with dxa-blocks.ts's emitDataBlocks()/emitLabels() and removes them when
// the run ends.
//
// WHAT NOT TO DO:
//   - Never import `node:child_process` here or spawn dxa. Every run goes
//     through the one host-tool route; dxa lives on the host.
//   - Never read the image from outside the project root. The local read
//     that computes the window goes through confineToWorkspace().
//   - Never default `--image-kind` on the CLI. The kind is required and is
//     never guessed from the file name or size.
//   - Never print anything to stdout from the CLI except the one JSON line.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join, sep, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { runHostToolOverEndpoint, type HostToolClientResult, type RunHostToolOverEndpointOptions } from "./host-tool-endpoint.mts";
import { repoRoot, toolsDirUnder } from "./repo-root.ts";
import { ensureLocalDir } from "./project-local.mts";
import { parsePrg, flatImageOrigin } from "./prg-image.mts";
import { parseDumpListing, type DumpListingMap } from "./dxa-listing.ts";
import { emitDataBlocks, emitLabels, type KnownDataRow } from "./dxa-blocks.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The one wire-shaped request this module ever sends -- mirrors
 * `DxaDisassembleArgs` (host-tool.mts) field-for-field. `image` and every
 * optional path are workspace-relative strings; resolution against the
 * workspace root happens host-side, at `host-tool.mts`'s own
 * `resolveWorkspacePath()` site -- never re-derived here. */
export interface DxaRunArgs {
  image: string;
  imageKind: "prg" | "flat64k";
  entrypointsPath?: string;
  datablocksPath?: string;
  labelsPath?: string;
  /** Phase 35, plan 35-04 (DXA-03). AN ALTERNATIVE to supplying
   * `datablocksPath`/`labelsPath` directly: this module emits `knownDataRows`
   * to per-invocation `-B`/`-l` files (`dxa-blocks.ts`'s `emitDataBlocks()`/
   * `emitLabels()`) in a per-run input directory under the tools root
   * (removed when the run ends), and wires
   * the resulting paths into the wire request in their place. Mutually
   * exclusive with `datablocksPath`/`labelsPath` -- supplying both throws,
   * naming which pair collided, rather than silently preferring one. When
   * the emitters select zero ranges/labels, the corresponding wire argument
   * is OMITTED entirely (never a path to a file that was never written) --
   * `dxa-blocks.ts`'s own zero-rows contract, propagated rather than
   * re-decided here. */
  knownDataRows?: readonly KnownDataRow[];
}

/** The function shape `runHostToolOverEndpoint()` itself has. */
export type DxaRunFn = (tool: string, args: Record<string, unknown>, opts: RunHostToolOverEndpointOptions) => Promise<HostToolClientResult>;

export interface DxaRunOptions {
  /** Test seam, mirroring `HostToolDeps`'s own injectable shape
   * (host-tool.mts): an injectable runner, defaulting to
   * `runHostToolOverEndpoint()`. Lets a hermetic test drive this module
   * with no broker at all. */
  run?: DxaRunFn;
  /** The local root: relative paths in the args resolve against it, and
   * every result downloads under `<repoRoot>/.c64-re-tools/`. Defaults to
   * this checkout's own root. */
  repoRoot?: string;
  /** Where results download; defaults to `<repoRoot>/.c64-re-tools`. */
  toolsRoot?: string;
  /** The broker endpoint port; defaults to the endpoint client's own. */
  port?: number;
  /** Test seam: injected image bytes, bypassing the filesystem read this
   * module otherwise performs to compute the parser's window. */
  imageBytes?: Uint8Array;
  /** Test seam: injected listing text, bypassing the filesystem read of the
   * response's listing path. */
  listingText?: string;
}

export interface DxaRunResult {
  /** The parsed byte-level code/data map. */
  map: DumpListingMap;
  /** The listing file's own sha256, as reported by the seam. */
  sha256: string;
  /** The listing file's own byte length, as reported by the seam. */
  byteLength: number;
  /** Convenience alias of `map.outOfWindow` -- surfaced at this level too so
   * a caller need not reach into the map for the one field PLAN.md names
   * explicitly. */
  outOfWindow: string[];
  /** The listing path the seam reported (already container-translated when
   * applicable). */
  listingPath: string;
}

/** Reads `relativePath` (workspace-relative, the SAME string this module
 * also sends on the wire) from the local filesystem, resolved against
 * `root`. Used only to compute the parser's window locally -- never sent
 * anywhere, never re-derived from the listing. */
function isContained(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

/** Canonicalises `p`, or -- when `p` does not exist yet (the write path:
 * a `-B`/`-l` file this module is about to create) -- the deepest ancestor
 * of `p` that does exist, with the non-existent tail re-appended. Mirrors
 * `anno-types.mts`'s own `realpathOfNearestExisting()`, which is not
 * exported, and `host-tool.mts`'s, which is host-bound and must not be
 * imported from this container-side module. */
function realpathOfNearestExisting(p: string): string {
  const resolved = resolvePath(p);
  const tail: string[] = [];
  let current = resolved;
  for (;;) {
    try {
      return tail.length === 0 ? realpathSync(current) : join(realpathSync(current), ...tail);
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolved;
      tail.unshift(basename(current));
      current = parent;
    }
  }
}

/**
 * Resolves a workspace-relative `relative` against `root` and refuses
 * anything that escapes the workspace, directly (`../`, or an absolute
 * path) or via a symlink. Returns the canonical, containment-checked
 * absolute path.
 *
 * WHY THIS EXISTS, AND WHY IT IS LOCAL (`35-REVIEW.md` CR-01). This module
 * sends workspace-relative strings on the wire and correctly leaves WIRE
 * path resolution to `host-tool.mts`'s `resolveWorkspacePath()` -- but it
 * ALSO performs its own local filesystem I/O that never crosses the seam:
 * it reads the image to compute the parser's window, and writes the
 * `-B`/`-l` files for `knownDataRows`. That local I/O had no confinement at
 * all, so `image: "../sibling/secret.prg"` read outside the workspace and
 * `outDir: "../sibling-dir"` wrote outside it -- both reproduced. The check
 * is local because `resolveWorkspacePath()` is host-bound `.mts`; this is the
 * same shape, and the same stated rules, as `stock-symbols.ts`'s own
 * `resolveLabelFilePath()`, which is this repository's established pattern
 * for exactly this situation rather than a second copy of a seam.
 *
 * WR-05: both sides are canonicalised before comparison -- comparing a
 * canonical path against a possibly-symlinked `root` refuses every path in
 * a workspace whose own path contains a symlinked component.
 * WR-08: the returned path is the CHECKED path, never the pre-canonical
 * spelling -- returning the latter makes the check advisory, because
 * `readFileSync`/`writeFileSync` re-traverse symlinks independently.
 */
function confineToWorkspace(root: string, relative: string, what: string): string {
  if (typeof relative !== "string" || relative.trim() === "") {
    throw new Error(
      `runDxaDisassemble: ${what} must be a non-empty workspace-relative string, got ${typeof relative === "string" ? "an empty/whitespace-only string" : typeof relative}`,
    );
  }

  const resolved = resolvePath(root, relative.trim());
  if (!isContained(resolved, root)) {
    throw new Error(
      `runDxaDisassemble: ${what} ${JSON.stringify(relative)} resolves to ${JSON.stringify(resolved)}, which is outside the workspace root (${root}) -- refusing`,
    );
  }

  const real = realpathOfNearestExisting(resolved);
  const realRoot = realpathOfNearestExisting(root);
  if (!isContained(real, realRoot)) {
    throw new Error(
      `runDxaDisassemble: ${what} ${JSON.stringify(relative)} resolves (via symlink) to ${JSON.stringify(real)}, which is outside the workspace root (${realRoot === root ? realRoot : `${root}, canonically ${realRoot}`}) -- refusing`,
    );
  }

  return real;
}

function readLocalImageBytes(root: string, relativePath: string): Uint8Array {
  return readFileSync(confineToWorkspace(root, relativePath, "image"));
}

/**
 * Runs `dxa.disassemble` end to end: computes the parser's window from the
 * image file, calls the host-tool seam, reads the resulting listing, and
 * returns the parsed byte-level code/data map.
 *
 * @throws {Error} when the seam refuses the request, or when
 *   `parseDumpListing()`'s own window predicate refuses the listing.
 */
export async function runDxaDisassemble(args: DxaRunArgs, opts: DxaRunOptions = {}): Promise<DxaRunResult> {
  const root = opts.repoRoot ?? repoRoot({ from: HERE });

  const imageBytes = opts.imageBytes ?? readLocalImageBytes(root, args.image);
  let origin: number;
  let imageSize: number;
  if (args.imageKind === "prg") {
    const { origin: prgOrigin, body } = parsePrg(imageBytes);
    origin = prgOrigin;
    imageSize = body.length;
  } else {
    origin = flatImageOrigin(imageBytes);
    imageSize = imageBytes.length;
  }

  // Phase 35, plan 35-04 (DXA-03): knownDataRows is mutually exclusive with a
  // caller-supplied datablocksPath/labelsPath -- refuse BY NAME rather than
  // silently letting one win, exactly like host-tool.mts's own "first
  // refusal wins" discipline for its resolved paths.
  let datablocksPath = args.datablocksPath;
  let labelsPath = args.labelsPath;
  // Host-tool output is regenerable, so it lands in the project's local/.
  const toolsRoot = opts.toolsRoot ?? ensureLocalDir(toolsDirUnder(root));
  let inputsDir: string | undefined;
  if (args.knownDataRows !== undefined) {
    if (datablocksPath !== undefined || labelsPath !== undefined) {
      throw new Error(
        "runDxaDisassemble: knownDataRows is mutually exclusive with datablocksPath/labelsPath -- supply the rows OR pre-written paths, never both",
      );
    }
    // Per-run input files, written under the tools root and uploaded by the
    // endpoint client like any other input; the directory is removed when
    // the run ends.
    mkdirSync(join(toolsRoot, "runs"), { recursive: true });
    inputsDir = mkdtempSync(join(toolsRoot, "runs", "dxa-inputs-"));
    const imageStem = basename(args.image).replace(/\.[^./]+$/, "");
    const blocksAbs = join(inputsDir, `${imageStem}.dxa-blocks.txt`);
    const labelsAbs = join(inputsDir, `${imageStem}.dxa-labels.lbl`);

    const blocksResult = emitDataBlocks(args.knownDataRows, blocksAbs);
    if (blocksResult.path !== undefined) datablocksPath = blocksAbs;

    const labelsResult = emitLabels(args.knownDataRows, labelsAbs);
    if (labelsResult.path !== undefined) labelsPath = labelsAbs;
  }

  const run = opts.run ?? runHostToolOverEndpoint;
  const wireArgs: Record<string, unknown> = { image: args.image, imageKind: args.imageKind };
  if (args.entrypointsPath !== undefined) wireArgs.entrypointsPath = args.entrypointsPath;
  if (datablocksPath !== undefined) wireArgs.datablocksPath = datablocksPath;
  if (labelsPath !== undefined) wireArgs.labelsPath = labelsPath;

  const runOpts: RunHostToolOverEndpointOptions = { baseDir: root, toolsRoot };
  if (opts.port !== undefined) runOpts.port = opts.port;

  let response: HostToolClientResult;
  try {
    response = await run("dxa.disassemble", wireArgs, runOpts);
  } finally {
    if (inputsDir !== undefined) rmSync(inputsDir, { recursive: true, force: true });
  }
  if (!response.ok) {
    throw new Error(`runDxaDisassemble: dxa.disassemble refused: ${response.message}`);
  }
  const listingResult = response.results[0];
  if (listingResult === undefined) {
    throw new Error("runDxaDisassemble: dxa.disassemble reported no listing output");
  }

  // Read at the path the response returns, AS GIVEN -- a local download.
  const text = opts.listingText ?? readFileSync(resolvePath(listingResult.path), "utf8");
  const map = parseDumpListing(text, { origin, imageSize });

  return {
    map,
    sha256: listingResult.sha256,
    byteLength: listingResult.byteLength,
    outOfWindow: map.outOfWindow,
    listingPath: listingResult.path,
  };
}

// ---------------------------------------------------------------------------
// CLI. The c64-disassembler skill locates this file with resolveMcpModule()
// and spawns it with `process.execPath` -- the skill never imports it. The
// last (and only) stdout line is `{ "ok": true, ... }` or
// `{ "ok": false, "message": "..." }`; the exit code is 0 or 1 to match.
// ---------------------------------------------------------------------------

/** `$xxxx`, the address form every CLI field below uses. */
function hexAddr(n: number): string {
  return `$${n.toString(16).padStart(4, "0")}`;
}

/** What the CLI prints: the listing's own file facts plus a summary of the
 * parsed map. The per-line detail stays in the listing file. */
export type DxaCliResult =
  | {
      ok: true;
      listingPath: string;
      sha256: string;
      byteLength: number;
      codeBytes: number;
      dataBytes: number;
      matchedLines: number;
      firstAddress: string | null;
      lastAddress: string | null;
      ranges: { class: "code" | "data" | "unclassified"; start: string; end: string }[];
      unclassified: { address: string; reason: string }[];
      outOfWindow: string[];
    }
  | { ok: false; message: string };

export const DXA_CLI_USAGE =
  "usage: node dxa-run.ts --image FILE --image-kind prg|flat64k\n" +
  "  [--entrypoints-path FILE] [--datablocks-path FILE] [--labels-path FILE] [--known-data-rows FILE.json]\n" +
  "  [--project-root DIR] [--tools-root DIR] [--port N]";

/** Reads a `--known-data-rows` file: a JSON array of KnownDataRow objects
 * (`{ start, endInclusive, dataType, sym? }`, integer addresses).
 * emitDataBlocks()/emitLabels() check each row's range; this checks only
 * the outer shape. */
function readKnownDataRows(path: string): { ok: true; rows: KnownDataRow[] } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { ok: false, message: `dxa-run: cannot read --known-data-rows ${JSON.stringify(path)}: ${(e as Error).message}` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: `dxa-run: --known-data-rows ${JSON.stringify(path)} must hold a JSON array of { start, endInclusive, dataType, sym? } rows` };
  }
  for (const [i, row] of parsed.entries()) {
    if (typeof row !== "object" || row === null || typeof row.dataType !== "string") {
      return { ok: false, message: `dxa-run: --known-data-rows row ${i} is not a { start, endInclusive, dataType, sym? } object: ${JSON.stringify(row)}` };
    }
  }
  return { ok: true, rows: parsed as KnownDataRow[] };
}

/** Parses the CLI flags into runDxaDisassemble()'s two arguments. Relative
 * paths resolve against `cwd`. */
export function parseDxaCli(argv: string[], cwd: string = process.cwd()): { ok: true; args: DxaRunArgs; opts: DxaRunOptions } | { ok: false; message: string } {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        image: { type: "string" },
        "image-kind": { type: "string" },
        "entrypoints-path": { type: "string" },
        "datablocks-path": { type: "string" },
        "labels-path": { type: "string" },
        "known-data-rows": { type: "string" },
        "project-root": { type: "string" },
        "tools-root": { type: "string" },
        port: { type: "string" },
      },
    }));
  } catch (e) {
    return { ok: false, message: `dxa-run: ${(e as Error).message}\n${DXA_CLI_USAGE}` };
  }

  for (const required of ["image", "image-kind"] as const) {
    if (values[required] === undefined || values[required] === "") {
      return { ok: false, message: `dxa-run: --${required} is required and has no default\n${DXA_CLI_USAGE}` };
    }
  }
  const kind = values["image-kind"];
  if (kind !== "prg" && kind !== "flat64k") {
    return { ok: false, message: `dxa-run: --image-kind must be "prg" or "flat64k"; got ${JSON.stringify(kind)}` };
  }

  const abs = (p: string): string => resolvePath(cwd, p);
  const args: DxaRunArgs = { image: abs(values.image!), imageKind: kind };
  if (values["entrypoints-path"] !== undefined) args.entrypointsPath = abs(values["entrypoints-path"]);
  if (values["datablocks-path"] !== undefined) args.datablocksPath = abs(values["datablocks-path"]);
  if (values["labels-path"] !== undefined) args.labelsPath = abs(values["labels-path"]);
  if (values["known-data-rows"] !== undefined) {
    const rows = readKnownDataRows(abs(values["known-data-rows"]));
    if (!rows.ok) return rows;
    args.knownDataRows = rows.rows;
  }

  const opts: DxaRunOptions = {};
  if (values["project-root"] !== undefined) opts.repoRoot = abs(values["project-root"]);
  if (values["tools-root"] !== undefined) opts.toolsRoot = abs(values["tools-root"]);
  if (values.port !== undefined) {
    if (!/^\d+$/.test(values.port)) return { ok: false, message: `dxa-run: --port must be an integer; got ${JSON.stringify(values.port)}` };
    opts.port = Number(values.port);
  }
  return { ok: true, args, opts };
}

/** The whole CLI as a function: parse, run, summarise, and turn every throw
 * into a refusal. `seams` carries the test seams of DxaRunOptions (`run`,
 * `imageBytes`, `listingText`) so a test drives this with no broker. Never
 * rejects. */
export async function runDxaCli(
  argv: string[],
  seams: Pick<DxaRunOptions, "run" | "imageBytes" | "listingText"> = {},
  cwd: string = process.cwd(),
): Promise<DxaCliResult> {
  const parsed = parseDxaCli(argv, cwd);
  if (!parsed.ok) return parsed;
  try {
    const r = await runDxaDisassemble(parsed.args, { ...parsed.opts, ...seams });
    return {
      ok: true,
      listingPath: r.listingPath,
      sha256: r.sha256,
      byteLength: r.byteLength,
      codeBytes: r.map.codeBytes,
      dataBytes: r.map.dataBytes,
      matchedLines: r.map.matchedLines,
      firstAddress: r.map.firstAddress === null ? null : hexAddr(r.map.firstAddress),
      lastAddress: r.map.lastAddress === null ? null : hexAddr(r.map.lastAddress),
      ranges: r.map.ranges.map((range) => ({ class: range.class, start: hexAddr(range.start), end: hexAddr(range.end) })),
      unclassified: [...r.map.unclassified.values()].map((u) => ({ address: hexAddr(u.address), reason: u.reason })),
      outOfWindow: r.outOfWindow,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runDxaCli(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.ok ? 0 : 1;
}
