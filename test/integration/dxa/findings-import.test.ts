// Through the real skill scripts and real DXA, which the script runs itself:
// a fixture PRG goes through DXA, normalized findings and the importer into
// the knowledge; a second, seeded run changes the result and retires the
// obsolete DXA facts, keeps the history and protects the semantic knowledge.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { DXA, findTool } from "../../../src/native/discover.ts";
import { openForRead, withWrite } from "../../../src/knowledge/database.ts";
import { historyAt } from "../../../src/knowledge/history.ts";
import { regionsOverlapping, symbolAt } from "../../../src/knowledge/read.ts";
import { classifyRegion, renameSymbol } from "../../../src/knowledge/write.ts";
import { analysisSubjectPrg } from "../../fixtures/prg/analysis-subject.ts";
import { importPrg } from "../../fixtures/program.ts";
import { nthIn } from "../../../src/knowledge/revisions.testkit.ts";
import { readEnvelope } from "../../kit.ts";

let skip: string | false = false;
try {
  findTool(DXA);
} catch {
  skip = "dxa is not installed: install dxa or set C64RT_DXA to run this test";
}

const script = resolve(import.meta.dirname, "../../../skills/c64-static-analysis/scripts/static-analysis.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-m7-"));
after(() => rmSync(project, { recursive: true, force: true }));

async function analyzeDxa(): Promise<{ status: number | null; json: Record<string, unknown> }> {
  // No Host Runtime: the script would fail if it asked one for DXA.
  const child = spawn(process.execPath, [...process.execArgv, script, "analyze", "--analyzer", "dxa"], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: readEnvelope(stdout, status).json as Record<string, unknown> };
}

const regions = () => {
  const db = openForRead(project);
  const list = regionsOverlapping(db, 0, 0xffff).map((region) => [region.start, region.end, region.type, region.origin]);
  db?.close();
  return list;
};

test("DXA findings reconcile through the importer and protect semantic knowledge", { skip, timeout: 300_000 }, async () => {
  // 1. The program goes into the knowledge; the first DXA pass makes its regions and labels DXA knowledge.
  importPrg(project, analysisSubjectPrg);
  const first = await analyzeDxa();
  assert.equal(first.status, 0, JSON.stringify(first.json));
  assert.equal(first.json.revision, nthIn(project, 2));
  assert.deepEqual(regions(), [
    [0x0801, 0x080c, "bytes", "dxa"],
    [0x080d, 0x0815, "code", "dxa"],
    [0x0816, 0x0817, "bytes", "dxa"],
    [0x0818, 0x0823, "code", "dxa"],
    [0x0824, 0x0827, "bytes", "dxa"],
  ]);

  // 2. Semantic work: the LLM names the routine, the user says what the table is.
  withWrite((db) => renameSymbol(db, { origin: "llm", expectedRevision: nthIn(project, 2) }, { address: 0x0818, name: "init_result", kind: "routine" }), project);
  withWrite((db) => classifyRegion(db, { origin: "user", expectedRevision: nthIn(project, 3) }, { start: 0x0824, end: 0x0827, type: "sprite" }), project);

  // 3. A changed program: NOPs instead of the JMP let the code run on into the routine, so the two
  //    unused bytes become reachable code. (A JMP to them is not enough: DXA keeps them as data.)
  const changed = Buffer.from(analysisSubjectPrg);
  changed.set([0xea, 0xea, 0xea, 0xea, 0xea], 0x0813 - 0x0801 + 2);
  importPrg(project, changed);
  const second = await analyzeDxa();
  assert.equal(second.status, 0, JSON.stringify(second.json));
  assert.equal(second.json.revision, nthIn(project, 6));
  assert.deepEqual(second.json.conflicts, [], "a finer data type from the user is no conflict");
  assert.deepEqual((second.json.changes as { regions: unknown }).regions, { added: 1, changed: 0, retired: 3, unchanged: 1, suppressed: 0 });
  assert.deepEqual(regions(), [
    [0x0801, 0x080c, "bytes", "dxa"],
    [0x080d, 0x0823, "code", "dxa"],
    [0x0824, 0x0827, "sprite", "user"],
  ]);
  const db = openForRead(project);
  assert.deepEqual(symbolAt(db, 0x0818), { space: "c64", address: 0x0818, name: "init_result", kind: "routine", origin: "llm", revision: nthIn(project, 3) }, "the echoed seed stays semantic");
  const regionHistory = historyAt(db, 0x0816).flatMap((entry) => (entry.entity === "region" ? [[entry.row.type, entry.row.origin, entry.to ?? null]] : []));
  assert.deepEqual(regionHistory, [
    ["bytes", "dxa", nthIn(project, 6)],
    ["code", "dxa", null],
  ], "the retired DXA data region stays in the history");
  const nameHistory = historyAt(db, 0x0818).flatMap((entry) => (entry.entity === "symbol" || entry.entity === "analyzer-name" ? [[entry.entity, entry.row.name, entry.row.origin, entry.to ?? null]] : []));
  assert.deepEqual(nameHistory, [
    ["analyzer-name", "l818", "dxa", null],
    ["symbol", "init_result", "llm", null],
  ], "the DXA label stays a second name next to the name of the LLM");
  db?.close();
});
