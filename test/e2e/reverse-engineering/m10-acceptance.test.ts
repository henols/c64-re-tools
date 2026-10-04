// Milestone 10 acceptance (19 §12): an unknown C64 artifact goes through the
// whole chain with the real skill scripts and the built Host Runtime:
//   disk → BASIC → packing → DXA → knowledge → seeded Ghidra →
//   reconstructed source → ACME → c64-testing PASS.
// Needs real VICE (C64RT_LIVE_VICE), Ghidra (C64RT_GHIDRA), DXA, ACME, c1541
// and petcat.

import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";

import { ACME, C1541, DXA, findTool, PETCAT } from "../../../src/native/discover.ts";
import { findGhidra } from "../../../src/native/ghidra/index.ts";
import { basicCounterPrg } from "../../fixtures/prg/basic-counter.ts";
import { liveEnv, liveSkip } from "../../integration/vice/live.ts";

let skip: string | false = liveSkip;
let c1541 = "";
if (skip === false) {
  try {
    c1541 = findTool(C1541);
    findTool(PETCAT);
    findTool(ACME);
    findTool(DXA);
    findGhidra();
  } catch (error) {
    skip = `a native tool is missing: ${(error as Error).message}`;
  }
}

const root = resolve(import.meta.dirname, "../../..");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m10-"));
let host: ChildProcess | undefined;
after(async () => {
  if (host !== undefined && host.exitCode === null) {
    const exited = once(host, "exit");
    host.kill("SIGTERM");
    await exited;
  }
  rmSync(project, { recursive: true, force: true });
});

async function hostAddress(): Promise<string> {
  host = spawn(process.execPath, [resolve(root, "src/host/main.ts"), "--port", "0"], { env: liveEnv(), stdio: ["ignore", "pipe", "inherit"] });
  const [line] = (await once(createInterface({ input: host.stdout! }), "line")) as [string];
  return `127.0.0.1:${/:(\d+)$/.exec(line)![1]}`;
}

async function skill(address: string, name: string, file: string, ...args: string[]): Promise<{ status: number | null; stdout: string; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [join(root, "skills", name, "scripts", file), ...args], { cwd: project, env: { ...process.env, C64RT_HOST: address }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, stdout, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("an unknown disk becomes understood, rebuilt and verified", { skip, timeout: 900_000 }, async () => {
  // The unknown artifact: a disk made by real c1541.
  mkdirSync(join(project, "original"));
  writeFileSync(join(project, "original", "game.prg"), basicCounterPrg);
  const made = spawnSync(c1541, ["-format", "mystery,m1", "d64", "original/mystery.d64", "-write", "original/game.prg", "game"], { cwd: project, encoding: "utf8" });
  assert.equal(made.status, 0, made.stdout + made.stderr);
  rmSync(join(project, "original", "game.prg"));
  const address = await hostAddress();
  const run = (name: string, file: string, ...args: string[]) => skill(address, name, file, ...args);

  // 1. Media: list the disk and extract the start file.
  const directory = await run("c64-disk", "disk.ts", "directory", "original/mystery.d64");
  assert.deepEqual((directory.json.entries as Array<{ name: string }>).map((entry) => entry.name), ["GAME"]);
  assert.equal((await run("c64-disk", "disk.ts", "read", "original/mystery.d64", "GAME", "--out", "extracted/game.prg")).status, 0);

  // 2. BASIC: the start line hands over to machine code at $080d.
  const basic = await run("c64-basic", "basic.ts", "extracted/game.prg");
  assert.deepEqual(basic.json.handoffs, [{ kind: "sys", line: 10, address: "$080d" }]);

  // 3. Packing: the BASIC start is the same; the file is too short for entropy evidence.
  const packing = await run("c64-unpacker", "unpack.ts", "inspect", "extracted/game.prg");
  assert.deepEqual(packing.json.basicStart, { line: 10, sys: "$080d" });

  // 4. A fast DXA first pass into knowledge: it finds the BASIC start by itself.
  const first = await run("c64-static-analysis", "analyze.ts", "extracted/game.prg", "--analyzer", "dxa", "--listing", "analysis/game.lst");
  assert.equal(first.status, 0, first.stdout);
  assert.deepEqual(first.json.regions, [
    { start: "$0801", end: "$080c", classification: "data" },
    { start: "$080d", end: "$0823", classification: "code" },
  ]);

  // 5. Semantic investigation: name what the routine and its variable are.
  for (const args of [
    ["rename", "$080d", "main", "--kind", "routine", "--reason", "entry point from BASIC"],
    ["rename", "$c100", "counter", "--kind", "variable", "--reason", "counted to ten"],
    ["rename", "$0821", "done", "--kind", "label", "--reason", "endless loop after the count"],
  ]) {
    const renamed = await run("c64-knowledge", "knowledge.ts", ...args);
    assert.notEqual(renamed.json.revision, undefined, renamed.stdout);
  }

  // 6. Deeper analysis seeded with the names.
  const second = await run("c64-static-analysis", "analyze.ts", "extracted/game.prg", "--entry", "$080d", "--decompile", "$080d");
  assert.deepEqual(second.json.conflicts, []);
  assert.match((second.json.decompilations as Array<{ text: string }>)[0]!.text, /void main\(void\)/);

  // 7. Source reconstruction and the ACME build.
  cpSync(resolve(root, "test/fixtures/asm/reconstructed"), join(project, "rebuild"), { recursive: true });
  const built = await run("c64-assembler", "assemble.ts", "--source-root", "rebuild", "--entry", "game.a", "--out", "build/game.prg");
  assert.equal(built.status, 0, built.stdout);
  writeFileSync(join(project, "build", "game.json"), built.stdout);

  // 8. Functional verification: the rebuild behaves as the original.
  writeFileSync(
    join(project, "counts.json"),
    JSON.stringify({
      name: "counts to ten and turns the border green",
      original: { program: "extracted/game.prg", symbols: "knowledge" },
      rebuild: { program: "build/game.prg", symbols: "build/game.json" },
      steps: [
        { reset: "hard" },
        { frames: 150 },
        { load: true },
        { registers: { pc: "main" } },
        { runUntil: { at: "done" }, timeoutFrames: 100 },
        { frames: 2 },
        { observe: "counted", memory: ["counter"], screen: {}, vicii: true },
      ],
    }),
  );
  const verified = await run("c64-testing", "test.ts", "counts.json");
  assert.deepEqual(verified.json, { result: "PASS", scenario: "counts to ten and turns the border green", checkpoints: ["counted"], differences: [] });
  assert.equal(verified.status, 0);
});
