#!/usr/bin/env node
// disassemble.test.ts -- the c64-disassembler skill script, hermetic.
//
// The spawn (`runModule`) and the host-tool call (`invokeHostTool`) are
// faked through DisassembleDeps, so no broker, Ghidra or dxa is needed.
// resolveModule stays the real c64-project ladder in the cases that check
// what it finds: rung 2 (the in-repo path) must reach ghidra-run.ts,
// dxa-run.ts and the vendored Ghidra scripts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_EXTENSION_MODULE,
  main,
  parseOpts,
  prgLoaderBase,
  runIdFromImage,
  type DisassembleDeps,
  type ModuleRun,
} from "../../../skills/c64-disassembler/scripts/disassemble.ts";
import { resolveMcpModule, type HostToolResponse } from "../../../skills/c64-project/scripts/mcp-module.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "..", "..", "skills", "c64-disassembler", "scripts", "disassemble.ts");

interface Recorded {
  calls: { modulePath: string; argv: string[] }[];
  hostCalls: { tool: string; args: object }[];
}

/** Deps whose spawn records its argv and answers with `reply`. */
function fakeDeps(reply: ModuleRun, extra: Partial<DisassembleDeps> = {}): { deps: DisassembleDeps; rec: Recorded } {
  const rec: Recorded = { calls: [], hostCalls: [] };
  const deps: DisassembleDeps = {
    resolveModule: resolveMcpModule,
    invokeHostTool: async (tool, args) => {
      rec.hostCalls.push({ tool, args });
      return { ok: false, message: "unexpected host-tool call" };
    },
    runModule: async (modulePath, argv) => {
      rec.calls.push({ modulePath, argv });
      return reply;
    },
    cwd: () => "/work",
    readFile: () => Uint8Array.from([0x01, 0x08, 0x60]),
    ...extra,
  };
  return { deps, rec };
}

const OK_REPLY: ModuleRun = { status: 0, stdout: 'progress\n{"ok":true,"runLogPath":"/p/r.log"}\n', stderr: "" };

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

// ------------------------------------------------------------ pure helpers

test("parseOpts: reads each value flag and collects unknown flags", () => {
  const o = parseOpts(["--image", "a.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos", "--bogus"]);
  assert.equal(o.image, "a.prg");
  assert.equal(o.kind, "prg");
  assert.equal(o.processor, "6502:LE:16:nmos");
  assert.deepEqual(o.unknown, ["--bogus"]);
});

test("parseOpts: a value flag with no value is reported as unknown", () => {
  assert.deepEqual(parseOpts(["--image"]).unknown, ["--image"]);
});

test("prgLoaderBase: the base is two bytes below the load address", () => {
  const r = prgLoaderBase(Uint8Array.from([0x01, 0x08, 0x60]));
  assert.deepEqual(r, { ok: true, base: "0x7ff", loadAddress: 0x0801 });
  const c = prgLoaderBase(Uint8Array.from([0x00, 0xc0, 0x60]));
  assert.equal(c.ok && c.base, "0xbffe");
});

test("prgLoaderBase: refuses a file too short to be a .prg, and a load address below 2", () => {
  assert.equal(prgLoaderBase(Uint8Array.from([0x01, 0x08])).ok, false);
  assert.equal(prgLoaderBase(Uint8Array.from([0x01, 0x00, 0x60])).ok, false);
});

test("runIdFromImage: sanitises the image stem to the run-id shape", () => {
  assert.equal(runIdFromImage("/x/Game Title v1.prg"), "Game-Title-v1");
  assert.equal(runIdFromImage("/x/..prg"), null);
});

// ------------------------------------------------------------ analyze

test("analyze: refuses a missing --image, --kind and --processor by name, before any spawn", async () => {
  const { deps, rec } = fakeDeps(OK_REPLY);
  const noImage = await main(["analyze", "--kind", "prg", "--processor", "6502:LE:16:nmos"], deps);
  assert.equal(noImage.ok, false);
  assert.match(noImage.ok ? "" : noImage.message, /--image/);
  const noKind = await main(["analyze", "--image", "a.prg", "--processor", "6502:LE:16:nmos"], deps);
  assert.match(noKind.ok ? "" : noKind.message, /--kind prg\|flat64k.*never guessed/);
  const badKind = await main(["analyze", "--image", "a.prg", "--kind", "bin", "--processor", "6502:LE:16:nmos"], deps);
  assert.match(badKind.ok ? "" : badKind.message, /--kind must be/);
  const noProc = await main(["analyze", "--image", "a.prg", "--kind", "prg"], deps);
  assert.match(noProc.ok ? "" : noProc.message, /--processor.*never guessed/);
  assert.equal(rec.calls.length, 0);
});

test("analyze: spawns ghidra-run.ts with the committed scripts, absolute paths and the header-derived base", async () => {
  const { deps, rec } = fakeDeps(OK_REPLY);
  const r = await main(
    ["analyze", "--image", "game.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos", "--entrypoints", "ep.txt", "--data-ranges", "dr.txt"],
    deps,
  );
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  assert.equal(rec.calls.length, 1);
  const { modulePath, argv } = rec.calls[0]!;
  assert.match(modulePath, /[/\\]src[/\\]mcp[/\\]vice[/\\]ghidra-run\.ts$/);
  assert.equal(flag(argv, "--run-id"), "game");
  assert.equal(flag(argv, "--import-path"), "/work/game.prg");
  assert.equal(flag(argv, "--processor"), "6502:LE:16:nmos");
  assert.equal(flag(argv, "--import-route"), "prg");
  assert.equal(flag(argv, "--loader-base-addr"), "0x7ff");
  assert.ok(argv.includes("--noanalysis"));
  assert.equal(flag(argv, "--entrypoints-path"), "/work/ep.txt");
  assert.equal(flag(argv, "--data-ranges-path"), "/work/dr.txt");
  assert.equal(flag(argv, "--export-path"), "game.ghidra-export.txt");
  const scriptDir = dirname(flag(argv, "--pre-script")!);
  assert.ok(existsSync(join(scriptDir, "GhidraStructExport.java")));
  assert.equal(flag(argv, "--pre-script"), join(scriptDir, "VolatileCarve.java"));
  assert.ok(existsSync(flag(argv, "--pre-script")!));
  assert.equal(flag(argv, "--post-script"), join(scriptDir, "GhidraStructExport.java"));
  assert.equal(flag(argv, "--project-root"), undefined);
  if (r.ok) {
    assert.equal(r.runLogPath, "/p/r.log", "the module's own result fields pass through");
    assert.equal(r.loaderBaseAddr, "0x7ff");
    assert.equal(r.entrypoints, "/work/ep.txt");
  }
});

test("analyze: flat64k refuses an image that is not 65536 bytes, and sends no base of its own", async () => {
  const { deps, rec } = fakeDeps(OK_REPLY);
  const small = await main(["analyze", "--image", "mem.bin", "--kind", "flat64k", "--processor", "6502:LE:16:default"], deps);
  assert.match(small.ok ? "" : small.message, /exactly 65536 bytes/);
  assert.equal(rec.calls.length, 0);

  const full = fakeDeps(OK_REPLY, { readFile: () => new Uint8Array(65536) });
  const r = await main(["analyze", "--image", "mem.bin", "--kind", "flat64k", "--processor", "6502:LE:16:default"], full.deps);
  assert.equal(r.ok, true);
  assert.equal(flag(full.rec.calls[0]!.argv, "--loader-base-addr"), undefined);
});

test("analyze: an explicit --loader-base-addr wins, and a malformed one is refused", async () => {
  const { deps, rec } = fakeDeps(OK_REPLY);
  await main(["analyze", "--image", "g.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos", "--loader-base-addr", "0x801"], deps);
  assert.equal(flag(rec.calls[0]!.argv, "--loader-base-addr"), "0x801");
  const bad = await main(["analyze", "--image", "g.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos", "--loader-base-addr", "801"], deps);
  assert.match(bad.ok ? "" : bad.message, /--loader-base-addr/);
});

test("analyze: the module's refusal passes through verbatim with a non-zero outcome", async () => {
  const reply: ModuleRun = { status: 1, stdout: '{"ok":false,"message":"runGhidraAnalyze: ghidra.analyze refused: no broker"}\n', stderr: "" };
  const { deps } = fakeDeps(reply);
  const r = await main(["analyze", "--image", "g.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos"], deps);
  assert.deepEqual(r, { ok: false, message: "runGhidraAnalyze: ghidra.analyze refused: no broker" });
});

test("analyze: no output, non-JSON output, and ok:true with a non-zero exit are each refused", async () => {
  const args = ["analyze", "--image", "g.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos"];
  const empty = await main(args, fakeDeps({ status: 1, stdout: "", stderr: "boom" }).deps);
  assert.match(empty.ok ? "" : empty.message, /printed no result.*boom/);
  const junk = await main(args, fakeDeps({ status: 0, stdout: "not json\n", stderr: "" }).deps);
  assert.match(junk.ok ? "" : junk.message, /non-JSON/);
  const liar = await main(args, fakeDeps({ status: 3, stdout: '{"ok":true}\n', stderr: "" }).deps);
  assert.match(liar.ok ? "" : liar.message, /exited 3 after printing ok:true/);
});

test("analyze: an unresolvable module is refused with the ladder's own message", async () => {
  const { deps, rec } = fakeDeps(OK_REPLY, {
    resolveModule: (f) => ({ ok: false, rungs: [], message: `could not resolve ${f}.` }),
  });
  const r = await main(["analyze", "--image", "g.prg", "--kind", "prg", "--processor", "6502:LE:16:nmos"], deps);
  assert.match(r.ok ? "" : r.message, /could not resolve vendor\/ghidra-scripts\/GhidraStructExport\.java/);
  assert.equal(rec.calls.length, 0);
});

// ------------------------------------------------------------ listing

test("listing: spawns dxa-run.ts with absolute paths and the required kind", async () => {
  const { deps, rec } = fakeDeps({ status: 0, stdout: '{"ok":true,"listingPath":"/p/g.dxa-dump.lst"}\n', stderr: "" });
  const r = await main(["listing", "--image", "g.prg", "--kind", "prg", "--entrypoints", "ep.txt", "--known-data", "rows.json", "--project-root", "proj"], deps);
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  const { modulePath, argv } = rec.calls[0]!;
  assert.match(modulePath, /[/\\]dxa-run\.ts$/);
  assert.deepEqual(argv, [
    "--image", "/work/g.prg",
    "--image-kind", "prg",
    "--entrypoints-path", "/work/ep.txt",
    "--known-data-rows", "/work/rows.json",
    "--project-root", "/work/proj",
  ]);
});

test("listing: refuses a missing kind, and --known-data together with --datablocks", async () => {
  const { deps, rec } = fakeDeps(OK_REPLY);
  const noKind = await main(["listing", "--image", "g.prg"], deps);
  assert.match(noKind.ok ? "" : noKind.message, /--kind/);
  const both = await main(["listing", "--image", "g.prg", "--kind", "prg", "--known-data", "r.json", "--datablocks", "b.txt"], deps);
  assert.match(both.ok ? "" : both.message, /never both/);
  assert.equal(rec.calls.length, 0);
});

// ------------------------------------------------------------ install-extension

test("install-extension: sends one ghidra.installExtension request with the default module name", async () => {
  const hostCalls: { tool: string; args: object }[] = [];
  const reply: HostToolResponse = {
    ok: true,
    tool: "ghidra.installExtension",
    exitStatus: 0,
    results: [{ path: "/tmp/x/6502_nmos.sla", sha256: "abc", byteLength: 42 }],
    stderrTail: "",
  };
  const { deps } = fakeDeps(OK_REPLY, {
    invokeHostTool: async (tool, args) => {
      hostCalls.push({ tool, args });
      return reply;
    },
  });
  const r = await main(["install-extension"], deps);
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  assert.deepEqual(hostCalls, [{ tool: "ghidra.installExtension", args: { moduleName: DEFAULT_EXTENSION_MODULE } }]);
  if (r.ok) {
    assert.deepEqual(r.sla, { name: "6502_nmos.sla", sha256: "abc", byteLength: 42 });
    assert.equal(r.language, "6502:LE:16:nmos");
  }
});

test("install-extension: refuses a bad module name and passes a seam refusal through", async () => {
  const { deps } = fakeDeps(OK_REPLY, {
    invokeHostTool: async () => ({ ok: false, message: 'host_tool "ghidra.installExtension" refuses: no Ghidra installation directory is known' }),
  });
  const bad = await main(["install-extension", "--module-name", "../x"], deps);
  assert.match(bad.ok ? "" : bad.message, /--module-name must match/);
  const refused = await main(["install-extension", "--module-name", "MyExt"], deps);
  assert.deepEqual(refused, { ok: false, message: 'host_tool "ghidra.installExtension" refuses: no Ghidra installation directory is known' });
});

// ------------------------------------------------------------ the CLI itself

test("CLI: an unknown command prints one ok:false JSON line and exits non-zero", () => {
  const r = spawnSync(process.execPath, [SCRIPT, "frobnicate"], { encoding: "utf8", timeout: 30_000 });
  assert.notEqual(r.status, 0);
  const last = r.stdout.trim().split("\n").pop() ?? "";
  const parsed = JSON.parse(last);
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /unknown command "frobnicate"/);
});

test("CLI: a refused flag set is the last stdout line, with no spawn and no broker", () => {
  const scratch = mkdtempSync(join(tmpdir(), "disassemble-cli-"));
  try {
    writeFileSync(join(scratch, "x.prg"), Buffer.from([0x01, 0x08, 0x60]));
    const r = spawnSync(process.execPath, [SCRIPT, "analyze", "--image", join(scratch, "x.prg"), "--kind", "prg"], { encoding: "utf8", timeout: 30_000 });
    assert.equal(r.status, 1);
    const parsed = JSON.parse(r.stdout.trim().split("\n").pop() ?? "");
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /--processor/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
