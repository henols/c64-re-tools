#!/usr/bin/env node
// smoke-packed.ts
//
// WHY THIS FILE EXISTS: the proof that the npm package runs from
// node_modules, where Node refuses to strip types. `npm run smoke` only
// proves the type-stripped checkout route. This script:
//   1. builds dist/ (`node build.ts --server`);
//   2. runs this directory's vice-cli.mjs with type stripping switched off
//      (`--no-experimental-strip-types`): an MCP initialize + tools/list
//      handshake and `anno --help`, so any `.ts` load fails the run;
//   3. packs the package (`npm pack`, which runs `prepack`), extracts the
//      tarball as real files into <scratch>/node_modules/@henols/vice-mcp,
//      symlinks that copy's node_modules to this directory's (offline), and
//      runs the extracted bin: the MCP handshake, `anno --help`, and
//      `broker --help`, which the broker refuses with its usage line before
//      it starts anything. It also loads the extracted
//      dist/memmap-lookup.js and reads memmap.json through it.
// It prints a one-line JSON verdict on stdout and exits non-zero on any
// failure.
//
// Usage: node smoke-packed.ts   (from src/mcp/vice, after `npm ci`)
//
// WHAT NOT TO DO:
//   - Never start a broker or an emulator. `broker --help` must stay an
//     argument the broker refuses at parse time.
//   - Never leave the scratch directory behind: /tmp can be RAM-backed.
//   - Never leave a dist/ this run created: vice-cli.mjs prefers dist/ when
//     it exists, so a stale build would shadow later source edits in a
//     checkout.
//   - Never pass a child a shell string; every spawn takes an argv array.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { mcpHandshake } from "./smoke.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(HERE, "dist");
const PACKAGE_NAME = "@henols/vice-mcp";
const CHILD_TIMEOUT_MS = 60_000;
const CHILD_ENV = { ...process.env, VICE_SKIP_RESOURCE_INSTALL: "1", MASTRA_TELEMETRY_DISABLED: "1" };

/** One named check and what it observed. */
interface Check {
  name: string;
  detail: string;
}

const checks: Check[] = [];

function pass(name: string, detail: string): void {
  checks.push({ name, detail });
  process.stderr.write(`smoke-packed: ok -- ${name}: ${detail}\n`);
}

/** Runs `node <args>` to completion and returns its status and output. The
 * child is SIGKILLed if it outlives CHILD_TIMEOUT_MS. */
function runNode(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: CHILD_ENV,
    timeout: CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.error) throw new Error(`node ${args.join(" ")}: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** `anno --help` must exit 0 and print the usage block. */
function checkAnnoHelp(label: string, nodeArgs: string[], cwd: string): void {
  const r = runNode([...nodeArgs, "anno", "--help"], cwd);
  if (r.status !== 0 || !/usage \(/.test(r.stdout)) {
    throw new Error(`${label} anno --help: exit ${r.status}, stdout ${JSON.stringify(r.stdout.slice(0, 200))}, stderr ${JSON.stringify(r.stderr.slice(0, 400))}`);
  }
  pass(`${label} anno --help`, "exit 0, usage printed");
}

async function checkHandshake(label: string, nodeArgs: string[], cwd: string): Promise<void> {
  const { serverName, toolCount } = await mcpHandshake(process.execPath, nodeArgs, cwd);
  if (toolCount === 0) throw new Error(`${label} handshake: tools/list advertised no tools`);
  pass(`${label} MCP handshake`, `server ${serverName}, ${toolCount} tool(s)`);
}

async function main(): Promise<void> {
  const distExisted = existsSync(DIST_DIR);
  const scratch = mkdtempSync(join(tmpdir(), "vice-mcp-packed-"));
  try {
    // 1. Build dist/.
    execFileSync(process.execPath, ["build.ts", "--server"], { cwd: HERE, stdio: ["ignore", "inherit", "inherit"] });
    const distFiles = readdirSync(DIST_DIR).length;
    pass("build --server", `${distFiles} file(s) in dist/`);

    // 2. The checkout's bin with type stripping off.
    const noStrip = ["--no-experimental-strip-types", join(HERE, "vice-cli.mjs")];
    await checkHandshake("checkout (no type stripping)", noStrip, HERE);
    checkAnnoHelp("checkout (no type stripping)", noStrip, HERE);

    // 3. Pack, extract as real files under a scratch node_modules, run.
    execFileSync("npm", ["pack", "--pack-destination", scratch, "--silent"], {
      cwd: HERE,
      stdio: ["ignore", "ignore", "inherit"],
    });
    const tarballs = readdirSync(scratch).filter((f) => f.endsWith(".tgz"));
    if (tarballs.length !== 1) throw new Error(`npm pack produced ${tarballs.length} tarball(s) in ${scratch}: ${JSON.stringify(tarballs)}`);
    const tarball = tarballs[0];
    const pkgDir = join(scratch, "node_modules", ...PACKAGE_NAME.split("/"));
    mkdirSync(pkgDir, { recursive: true });
    execFileSync("tar", ["-xzf", join(scratch, tarball), "-C", pkgDir, "--strip-components=1"], { stdio: ["ignore", "ignore", "inherit"] });
    for (const required of ["vice-cli.mjs", "dist/vice-proxy.js", "dist/vsf-slice.js", "dist/tool-location.mjs", "dist/memmap.json", "resources/vice-broker.mjs"]) {
      if (!existsSync(join(pkgDir, required))) throw new Error(`the packed package lacks ${required}`);
    }
    symlinkSync(join(HERE, "node_modules"), join(pkgDir, "node_modules"), "dir");
    pass("npm pack + extract", `${tarball} extracted to .../node_modules/${PACKAGE_NAME}`);

    const bin = [join(pkgDir, "vice-cli.mjs")];
    await checkHandshake("packed", bin, scratch);
    checkAnnoHelp("packed", bin, scratch);

    const broker = runNode([...bin, "broker", "--help"], scratch);
    if (broker.status !== 1 || !broker.stderr.includes("usage: vice-broker.mjs")) {
      throw new Error(`packed broker --help: expected exit 1 with the broker usage line, got exit ${broker.status}, stderr ${JSON.stringify(broker.stderr.slice(0, 400))}`);
    }
    pass("packed broker --help", "refused with its usage line, exit 1, no broker started");

    const memmapModule: unknown = await import(pathToFileURL(join(pkgDir, "dist", "memmap-lookup.js")).href);
    const lookup = memmapModule as { MEMMAP_PATH: string; loadMemmap: () => readonly unknown[] };
    if (!lookup.MEMMAP_PATH.startsWith(pkgDir + sep)) {
      throw new Error(`packed memmap-lookup reads ${lookup.MEMMAP_PATH}, outside the package ${pkgDir}`);
    }
    const entries = lookup.loadMemmap().length;
    if (entries === 0) throw new Error("packed memmap-lookup loaded no entries");
    pass("packed memmap-lookup", `${entries} entries from the package-local memmap.json`);

    process.stdout.write(JSON.stringify({ ok: true, distFiles, tarball, checks: checks.map((c) => c.name) }) + "\n");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    if (!distExisted) rmSync(DIST_DIR, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  process.stderr.write(`smoke-packed: FAIL -- ${message}\n`);
  process.stdout.write(JSON.stringify({ ok: false, message, checks: checks.map((c) => c.name) }) + "\n");
  process.exitCode = 1;
}
