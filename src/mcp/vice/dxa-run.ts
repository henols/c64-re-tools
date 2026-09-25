#!/usr/bin/env node
// dxa-run.ts
//
// Phase 35, plan 35-01 (DXA-02): client-side orchestration ONLY for the
// `dxa.disassemble` host tool. Reaches dxa through the broker's fixed
// endpoint (`runHostToolOverEndpoint("dxa.disassemble", …)`,
// host-tool-endpoint.mts) and NEVER `node:child_process` -- SEAM-05's
// `BANNED_COMMAND_SHAPES` already names `dxa`, so a direct spawn here is a
// caught violation, not an invisible one.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts`. The endpoint client uploads
// every input by bytes and downloads the listing under this module's own
// tools root, so the listing's path is a local path read AS GIVEN.
//
// The parser's window is computed from the IMAGE FILE, never from the
// listing itself (A-04's own boundary: inferring the window from the same
// text being validated against it would make the validation vacuous). For
// `imageKind: "prg"` this module uses `parsePrg()`'s own origin and a body
// length of `fileSize - 2`; for `imageKind: "flat64k"` it uses origin `0`
// and the file's own size (`flatImageOrigin()` from prg-image.ts refuses
// anything that is not exactly 65536 bytes).
//
// Phase 35, plan 35-04 (DXA-03): `DxaRunArgs.knownDataRows` is an
// ALTERNATIVE to a caller-supplied `datablocksPath`/`labelsPath` -- see that
// field's own doc comment below. This module calls `dxa-blocks.ts`'s
// `emitDataBlocks()`/`emitLabels()` to write the files and wires the
// resulting paths into the wire request; it adds no new
// `HostToolId` argument key (plan 35-01 already landed all five path keys on
// `dxa.disassemble`) and touches no allowlist table.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join, sep, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { runHostToolOverEndpoint, type HostToolClientResult, type RunHostToolOverEndpointOptions } from "./host-tool-endpoint.mts";
import { repoRoot } from "./repo-root.ts";
import { parsePrg, flatImageOrigin } from "./prg-image.ts";
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
 * `anno-types.ts`'s own `realpathOfNearestExisting()`, which is not
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
 * is local because this file must never import `hostpath.ts` (see the
 * header) and `resolveWorkspacePath()` is host-bound `.mts`; this is the
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
  const toolsRoot = opts.toolsRoot ?? join(root, ".c64-re-tools");
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
