#!/usr/bin/env node
// dxa-run.ts
//
// Phase 35, plan 35-01 (DXA-02): CONTAINER-SIDE orchestration ONLY for the
// `dxa.disassemble` host tool. Reaches dxa through
// `runHostToolFromContainer("dxa.disassemble", …)` (host-tool-client.ts) and
// NEVER `node:child_process` -- SEAM-05's `BANNED_COMMAND_SHAPES` already
// names `dxa`, so a direct spawn here is a caught violation, not an
// invisible one.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` (mirrors host-tool-client.ts's
// own stated rule for itself). The response's listing path has ALREADY been
// translated through `containerPath()` by `runHostToolFromContainer()`
// (host-tool-client.ts's own `translateHostToolResponse()`) before this
// module ever sees it on the container route; on the host route the two
// coordinate systems are the same filesystem, so no translation is needed
// there either. This module therefore reads the listing at the path the
// response returns AS GIVEN -- it never calls `hostPath()` (the wrong
// direction entirely) and never needs to call `containerPath()` a second
// time.
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
// resulting workspace-relative paths into the wire request; it adds no new
// `HostToolId` argument key (plan 35-01 already landed all five path keys on
// `dxa.disassemble`) and touches no allowlist table.
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { runHostToolFromContainer, type HostToolClientResult, type RunHostToolFromContainerOptions } from "./host-tool-client.ts";
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
  outDir?: string;
  /** Phase 35, plan 35-04 (DXA-03). AN ALTERNATIVE to supplying
   * `datablocksPath`/`labelsPath` directly: this module emits `knownDataRows`
   * to per-invocation `-B`/`-l` files (`dxa-blocks.ts`'s `emitDataBlocks()`/
   * `emitLabels()`) under the same directory `outDir` resolves to, and wires
   * the resulting paths into the wire request in their place. Mutually
   * exclusive with `datablocksPath`/`labelsPath` -- supplying both throws,
   * naming which pair collided, rather than silently preferring one. When
   * the emitters select zero ranges/labels, the corresponding wire argument
   * is OMITTED entirely (never a path to a file that was never written) --
   * `dxa-blocks.ts`'s own zero-rows contract, propagated rather than
   * re-decided here. */
  knownDataRows?: readonly KnownDataRow[];
}

/** The function shape `runHostToolFromContainer()` itself has -- named here
 * so `DxaRunOptions.run` below can be typed without importing a value this
 * module does not otherwise need. */
export type DxaRunFn = (tool: string, args: Record<string, unknown>, opts: RunHostToolFromContainerOptions) => Promise<HostToolClientResult>;

export interface DxaRunOptions {
  /** Test seam, mirroring `HostToolDeps`'s own injectable shape
   * (host-tool.mts): an injectable runner, defaulting to
   * `runHostToolFromContainer()`. Lets a hermetic test drive this module
   * with no host process at all. */
  run?: DxaRunFn;
  /** Passed straight through to the (injected or default) runner's own
   * `dir`/`repoRoot` options. */
  dir?: string;
  repoRoot?: string;
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
function readLocalImageBytes(root: string, relativePath: string): Uint8Array {
  return readFileSync(join(root, relativePath));
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
  if (args.knownDataRows !== undefined) {
    if (datablocksPath !== undefined || labelsPath !== undefined) {
      throw new Error(
        "runDxaDisassemble: knownDataRows is mutually exclusive with datablocksPath/labelsPath -- supply the rows OR pre-written paths, never both",
      );
    }
    // Per-invocation paths under the SAME directory dxa.disassemble's own
    // server-side default resolves outDir to (dirname(imagePath)) when the
    // caller omits outDir -- mirrored here so the emitted files land where
    // the resolved image and listing already do. Workspace-relative
    // strings throughout: emitDataBlocks()/emitLabels() are handed the
    // absolute path (root-joined) to WRITE to; the wire argument stays the
    // workspace-relative string, exactly like every other path field here.
    const outDirRelative = args.outDir ?? dirname(args.image);
    const imageStem = basename(args.image).replace(/\.[^./]+$/, "");
    const blocksRelPath = `${outDirRelative}/${imageStem}.dxa-blocks.txt`;
    const labelsRelPath = `${outDirRelative}/${imageStem}.dxa-labels.lbl`;

    const blocksResult = emitDataBlocks(args.knownDataRows, join(root, blocksRelPath));
    if (blocksResult.path !== undefined) datablocksPath = blocksRelPath;

    const labelsResult = emitLabels(args.knownDataRows, join(root, labelsRelPath));
    if (labelsResult.path !== undefined) labelsPath = labelsRelPath;
  }

  const run = opts.run ?? runHostToolFromContainer;
  const wireArgs: Record<string, unknown> = { image: args.image, imageKind: args.imageKind };
  if (args.entrypointsPath !== undefined) wireArgs.entrypointsPath = args.entrypointsPath;
  if (datablocksPath !== undefined) wireArgs.datablocksPath = datablocksPath;
  if (labelsPath !== undefined) wireArgs.labelsPath = labelsPath;
  if (args.outDir !== undefined) wireArgs.outDir = args.outDir;

  const runOpts: RunHostToolFromContainerOptions = {};
  if (opts.dir !== undefined) runOpts.dir = opts.dir;
  if (opts.repoRoot !== undefined) runOpts.repoRoot = opts.repoRoot;

  const response = await run("dxa.disassemble", wireArgs, runOpts);
  if (!response.ok) {
    throw new Error(`runDxaDisassemble: dxa.disassemble refused: ${response.message}`);
  }
  const listingResult = response.results[0];
  if (listingResult === undefined) {
    throw new Error("runDxaDisassemble: dxa.disassemble reported no listing output");
  }

  // Read at the path the response returns, AS GIVEN -- already
  // container-translated by runHostToolFromContainer() where applicable; see
  // this module's own header for why no second translation belongs here.
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
