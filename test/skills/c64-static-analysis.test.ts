// The c64-static-analysis script against a real Host Runtime server with real
// Ghidra. Skipped (never passed) when Ghidra is not found.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../src/host/processes.ts";
import { startHostServer, type HostServer } from "../../src/host/server.ts";
import { DXA, findTool } from "../../src/host/tools/discover.ts";
import { findGhidra } from "../../src/host/tools/ghidra/index.ts";
import { createToolDispatcher } from "../../src/host/tools/index.ts";
import { openForRead } from "../../src/knowledge/database.ts";
import { listReferences, regionsOverlapping, symbolAt } from "../../src/knowledge/read.ts";
import { WireFailure } from "../../src/protocol.ts";
import { analysisSubjectPrg, MAIN, ROUTINE, TABLE_START } from "../fixtures/prg/analysis-subject.ts";

let skip: string | false = false;
try {
  findGhidra();
} catch {
  skip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run these tests";
}

let dxaSkip: string | false = false;
try {
  findTool(DXA);
} catch {
  dxaSkip = "dxa is not installed: install dxa or set C64RT_DXA to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-analysis-"));
writeFileSync(join(project, "game.prg"), analysisSubjectPrg);
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function hostEnv(): Promise<string> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({
      port: 0,
      createViceSession: async () => {
        throw new WireFailure("machine-unavailable", "no emulators here");
      },
      tools: createToolDispatcher({ supervisor }),
    });
  }
  return `${server.host}:${server.port}`;
}

async function analyze(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: await hostEnv() }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("an analysis imports Ghidra's structure into knowledge and reports it", { skip, timeout: 600_000 }, async () => {
  const { status, json } = await analyze("game.prg", "--entry", "$080d", "--decompile", "$0818");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.coverage, [{ start: "$0801", end: "$0827" }]);
  assert.equal(json.revision, 1);
  assert.deepEqual((json.changes as { symbols: unknown }).symbols, { added: 2, changed: 0, retired: 0, unchanged: 0 });
  assert.deepEqual(json.conflicts, []);
  assert.deepEqual(json.functions, [
    { entry: "$080d", name: "FUN_080d" },
    { entry: "$0818", name: "FUN_0818" },
  ]);
  assert.equal((json.decompilations as Array<{ entry: string }>)[0]?.entry, "$0818");

  const db = openForRead(project);
  assert.equal(symbolAt(db, ROUTINE)?.origin, "ghidra");
  assert.deepEqual(regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.origin]), [
    [MAIN, 0x0815, "code", "ghidra"],
    [ROUTINE, 0x0823, "code", "ghidra"],
    // LDA $0824 makes Ghidra define the byte it reads.
    [TABLE_START, TABLE_START, "bytes", "ghidra"],
  ]);
  assert.ok(listReferences(db).some((reference) => reference.from === 0x081d && reference.to === TABLE_START && reference.kind === "read"));
  db?.close();
});

test("a DXA pass imports its regions and labels and writes the listing", { skip: dxaSkip, timeout: 120_000 }, async () => {
  const { status, json } = await analyze("game.prg", "--analyzer", "dxa", "--listing", "analysis/game.lst");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.analyzer, "dxa");
  assert.equal(json.listing, "analysis/game.lst");
  assert.deepEqual(json.regions, [
    { start: "$0801", end: "$080c", classification: "data" },
    { start: "$080d", end: "$0815", classification: "code" },
    { start: "$0816", end: "$0817", classification: "data" },
    { start: "$0818", end: "$0823", classification: "code" },
    { start: "$0824", end: "$0827", classification: "data" },
  ]);
  assert.match(readFileSync(join(project, "analysis", "game.lst"), "utf8"), /jsr /);
  const db = openForRead(project);
  // DXA's own facts sit beside Ghidra's from the test above; it does not replace them.
  assert.ok(regionsOverlapping(db, 0x0801, 0x080c).some((region) => region.origin === "dxa" && region.type === "bytes"));
  db?.close();
});

test("bad calls are refused before anything is sent", { skip }, async () => {
  for (const args of [
    [],
    ["game.prg", "--entry", "2061"],
    ["game.prg", "--processor", "6502"],
    ["game.prg", "--analyzer", "ida"],
    ["game.prg", "--analyzer", "dxa", "--decompile", "$0818"],
    ["game.prg", "--listing", "x.lst"],
  ]) {
    const { status, json } = await analyze(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
  }
});
