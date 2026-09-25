#!/usr/bin/env node
// petcat -> BASIC detokenization + SYS-handover driver. One capability:
// decode a BASIC program's stub to readable text and resolve the numeric
// address it hands over to machine code, when that address is a literal.
//
// Reached ONLY through the host-tool execution seam -- the project owner's
// rule of 2026-08-28 is that this script runs container-side, `petcat` lives
// host-side, and there is no container PATH to find it on. This file never spawns `petcat` itself; it constructs a
// TYPED request (`petcat.decode`) and hands it to the compiled endpoint
// client through mcp-module.mjs's invokeHostTool(), which uploads the image
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
import { dirname, relative, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { invokeHostTool } from "../../c64-ram-capture/scripts/mcp-module.mjs";

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

// How to refer to this script in hints, from wherever we were run.
function selfPath() {
  const r = relative(process.cwd(), SELF);
  return !r || r.startsWith("..") || isAbsolute(r) ? SELF : r;
}

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

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
async function runDecode(argv) {
  const o = parseOpts(argv);
  if (!o.image) die(`usage: decode --image <path.prg> [--out-dir <dir>] [--json]`);

  const imageAbs = resolve(o.image);
  const outDirAbs = o.outDir ? resolve(o.outDir) : dirname(imageAbs);

  const response = await invokeHostTool("petcat.decode", { image: imageAbs }, { destDir: outDirAbs });
  report(response, o);
  process.exit(response.ok ? 0 : 1);
}

function report(response, { json }) {
  if (json) {
    console.log(JSON.stringify(response));
    return;
  }
  if (!response.ok) {
    console.error(`petcat call FAILED: ${response.message}`);
    return;
  }
  // WHAT NOT TO DO (this file's own header): never guess an entry point --
  // print exactly what the seam reported, decline included.
  if (response.entrypoint !== null) {
    console.log(`entry point: ${response.entrypoint} (${response.entrypointReason})`);
  } else {
    console.log(`entry point not resolved: ${response.entrypointReason}`);
  }
  for (const r of response.results ?? []) {
    console.log(`${r.path}  (${r.byteLength} bytes, sha256 ${r.sha256})`);
  }
}

// ------------------------------------------------------------------ options

// Exported so petcat.test.mjs can cover this file's
// own CLI-option parsing as a pure unit, mirroring c1541.mjs's own exported
// parsers -- never spawns anything, never needs petcat installed.
export function parseOpts(argv) {
  const o = { json: false };
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
// The CLI dispatch below MUST be guarded to run only
// when this file is the actual entry point, not merely imported -- mirrors
// c1541.mjs's own entry-point guard verbatim (the "Rule 3
// fix, discovered mid-execution"), added there after an unguarded dispatch
// ran with the TEST RUNNER's own process.argv on every import of
// c1541.test.mjs, printing the usage banner and calling process.exit(0)
// before a single test() call ever registered. Nothing imports petcat.mjs as
// a module today (confirmed by grep across src/ and scripts/), so this was
// latent rather than live here -- but the next petcat.test.mjs that imports
// a pure helper from this file would reintroduce the exact bug c1541.mjs
// already found and fixed once. Same shape
// (`resolve(process.argv[1]) === fileURLToPath(import.meta.url)`), never a
// second guard shape invented for this sibling script.

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const VERBS = {
    decode: (argv) => runDecode(argv),
  };
  if (!cmd || !VERBS[cmd]) {
    console.log(`usage: node ${selfPath()} <command> [options]

  decode --image <path.prg> [--out-dir <dir>] [--json]   detokenize a BASIC program and resolve its SYS handover point

Never invokes petcat directly and never guesses an entry point -- a computed
SYS argument is reported as a named decline, never an address.

options: --image PATH  --out-dir DIR  --json`);
    process.exit(cmd ? 1 : 0);
  }
  await VERBS[cmd](rest);
}
