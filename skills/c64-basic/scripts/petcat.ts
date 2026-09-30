#!/usr/bin/env node
// petcat.ts -- BASIC detokenization + SYS-handover driver. One capability:
// decode a BASIC program's stub to readable text and resolve the numeric
// address it hands over to machine code, when that address is a literal.
//
// Reached ONLY through the host-tool execution seam -- the project owner's
// rule of 2026-08-28 is that this script runs container-side, `petcat` lives
// host-side, and there is no container PATH to find it on. This file never spawns `petcat` itself; it constructs a
// TYPED request (`petcat.decode`) and hands it to the compiled endpoint
// client through mcp-module.ts's invokeHostTool(), which uploads the image
// to the broker and moves the listing into the output directory.
//
// WHAT NOT TO DO:
//   - Never spawn the conversion binary (`petcat`) directly from this
//     script, even as a "just this once" fallback. A direct call works on
//     the developer's own host and silently fails inside a container -- the
//     exact failure this seam exists to remove.
//   - Never guess an entry point when the seam reports a null one. A
//     guessed address is spent on a disassembler downstream, and a wrong
//     one is expensive there -- report the decline and its reason exactly
//     as the seam gave them, never a fallback value.
import { realpathSync } from "node:fs";
import { dirname, relative, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { HostToolResponse, InvokeHostToolOptions } from "../../c64-project/scripts/mcp-module.ts";
import { loadSibling } from "./sibling.ts";

/** invokeHostTool() from the c64-project skill, loaded when first used so a
 * missing sibling skill is a named refusal, not a crash at import. */
async function invokeHostTool(tool: string, args: object, opts: InvokeHostToolOptions): Promise<HostToolResponse> {
  const mcp = await loadSibling(() => import("../../c64-project/scripts/mcp-module.ts"), "mcp-module.ts", "c64-basic");
  return mcp.ok ? mcp.mod.invokeHostTool(tool, args, opts) : { ok: false, message: mcp.message };
}

const SELF = fileURLToPath(import.meta.url);

// How to refer to this script in hints, from wherever we were run.
function selfPath() {
  const r = relative(process.cwd(), SELF);
  return !r || r.startsWith("..") || isAbsolute(r) ? SELF : r;
}

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string; [key: string]: unknown };

const refuse = (message: string): ScriptResult => ({ ok: false, message });

/** Parsed CLI options. */
export interface PetcatOpts {
  json: boolean;
  image?: string;
  outDir?: string;
}

// ------------------------------------------------------------- capabilities

/**
 * Detokenizes `--image` (required) to readable BASIC text and resolves its
 * `SYS` handover point, when it has one. `--out-dir` is optional, defaulting
 * to the image's own directory. Prints the seam's response verbatim as one line of
 * JSON when `--json` is given -- the response IS the reportable shape
 * (`{ ok, tool, exitStatus, results, stderrTail, entrypoint,
 * entrypointReason }` / `{ ok: false, message }`), so no reshaping happens
 * here.
 */
async function runDecode(argv: string[]): Promise<ScriptResult> {
  const o = parseOpts(argv);
  if (!o.image) return refuse(`usage: decode --image <path.prg> [--out-dir <dir>] [--json]`);

  const imageAbs = resolve(o.image);
  const outDirAbs = o.outDir ? resolve(o.outDir) : dirname(imageAbs);

  const response = await invokeHostTool("petcat.decode", { image: imageAbs }, { destDir: outDirAbs });
  if (!o.json) report(response);
  return response;
}

function report(response: HostToolResponse) {
  if (!response.ok) return;
  // Print exactly what the seam reported, decline included. Never guess an
  // entry point. A missing entrypoint is a decline, like a null one.
  if (response.entrypoint !== null && response.entrypoint !== undefined) {
    console.log(`entry point: ${response.entrypoint} (${response.entrypointReason})`);
  } else {
    console.log(`entry point not resolved: ${response.entrypointReason ?? "the seam gave no reason"}`);
  }
  for (const r of response.results ?? []) {
    console.log(`${r.path}  (${r.byteLength} bytes, sha256 ${r.sha256})`);
  }
}

// ------------------------------------------------------------------ options

// Exported so petcat.test.ts can cover this file's
// own CLI-option parsing as a pure unit, mirroring c1541.ts's own exported
// parsers -- never spawns anything, never needs petcat installed.
export function parseOpts(argv: string[]): PetcatOpts {
  const o: PetcatOpts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--image") o.image = argv[++i];
    else if (a === "--out-dir") o.outDir = argv[++i];
  }
  return o;
}

// --------------------------------------------------------------------- main
//
// The CLI dispatch runs only when this file is the process entry point, so a
// test can import the exports above. realpathSync() makes the check true
// through a symlinked install too.

// True when this file is the process entry point, also when it runs through a symlink.
const invokedDirectly = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

/** The whole CLI as a function. Never rejects. */
export async function main(argv: string[]): Promise<ScriptResult> {
  const [cmd, ...rest] = argv;
  if (cmd !== "decode") {
    const usage = `usage: node ${selfPath()} <command> [options]

  decode --image <path.prg> [--out-dir <dir>] [--json]   detokenize a BASIC program and resolve its SYS handover point

Never invokes petcat directly and never guesses an entry point -- a computed
SYS argument is reported as a named decline, never an address. The last stdout
line is one JSON result.

options: --image PATH  --out-dir DIR  --json`;
    return refuse(cmd ? `unknown command ${JSON.stringify(cmd)}\n${usage}` : usage);
  }
  try {
    return await runDecode(rest);
  } catch (e) {
    return refuse(e instanceof Error ? e.message : String(e));
  }
}

if (invokedDirectly) {
  const result = await main(process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
