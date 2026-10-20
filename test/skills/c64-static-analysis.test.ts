// The c64-static-analysis script with real Ghidra and DXA, which it runs
// itself. Skipped (never passed) when Ghidra is not found.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { DXA, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { openForRead } from "../../src/knowledge/database.ts";
import { analyzerNamesAt, listReferences, regionsOverlapping, symbolAt } from "../../src/knowledge/read.ts";
import { analysisSubjectPrg, MAIN, ROUTINE, TABLE_START } from "../fixtures/prg/analysis-subject.ts";
import { nthIn } from "../../src/knowledge/revisions.testkit.ts";
import { importPrg } from "../fixtures/program.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

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

const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/static-analysis.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-analysis-"));
// The program is the first revision of the knowledge.
importPrg(project, analysisSubjectPrg);
after(() => rmSync(project, { recursive: true, force: true }));

async function analyze(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope }> {
  const child = spawn(process.execPath, [...process.execArgv, script, "analyze", ...args], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, ...readEnvelope(stdout, status) };
}

test("an analysis imports Ghidra's structure into knowledge and reports it", { skip, timeout: 600_000 }, async () => {
  const { status, json } = await analyze("--entry", "$080d", "--decompile", "$0818", "--max-listed", "1");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.coverage, [{ start: "$0801", end: "$0827" }]);
  assert.equal(json.revision, nthIn(project, 2));
  assert.deepEqual((json.changes as { names: unknown }).names, { added: 2, changed: 0, retired: 0, unchanged: 0, suppressed: 0 });
  assert.deepEqual(json.conflicts, []);
  // The rest of the list is in the knowledge as the analyzer names of Ghidra.
  assert.deepEqual(json.functions, { count: 2, listed: [{ entry: "$080d", name: "FUN_080d" }], rest: "a larger --max-listed. The project knowledge has all of them as analyzer names" });
  assert.equal((json.decompilations as Array<{ entry: string }>)[0]?.entry, "$0818");

  const db = openForRead(project);
  assert.equal(symbolAt(db, ROUTINE), undefined, "an analyzer name is no symbol");
  assert.equal(analyzerNamesAt(db, ROUTINE)[0]?.origin, "ghidra");
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
  const { status, json } = await analyze("--analyzer", "dxa", "--out-listing", "analysis/game.lst");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.analyzer, "dxa");
  assert.equal((json.listing as { out: string }).out, "analysis/game.lst");
  assert.deepEqual(json.regions, [
    { start: "$0801", end: "$080c", classification: "data" },
    { start: "$080d", end: "$0815", classification: "code" },
    { start: "$0816", end: "$0817", classification: "data" },
    { start: "$0818", end: "$0823", classification: "code" },
    { start: "$0824", end: "$0827", classification: "data" },
  ]);
  assert.match(readFileSync(join(project, "analysis", "game.lst"), "utf8"), /jsr /);
  const labels = json.labels as { count: number; listed: unknown[]; rest?: string };
  assert.equal(labels.listed.length, labels.count, "a short list is not cut");
  assert.equal(labels.rest, undefined);

  const cutRun = await analyze("--analyzer", "dxa", "--max-listed", "1");
  const cut = cutRun.json.labels as { count: number; listed: unknown[]; rest?: string };
  assert.equal(cut.count, labels.count);
  assert.equal(cut.listed.length, 1);
  assert.equal(cut.rest, "a larger --max-listed. The project knowledge has all of them as analyzer names");
  // The envelope tells that a list is cut.
  assert.match(cutRun.envelope.hint ?? "", /A list in the body is cut/);
  const db = openForRead(project);
  // DXA's own facts sit beside Ghidra's from the test above; it does not replace them.
  assert.ok(regionsOverlapping(db, 0x0801, 0x080c).some((region) => region.origin === "dxa" && region.type === "bytes"));
  db?.close();
});

test("bad calls are refused before anything is sent", { skip }, async () => {
  for (const args of [
    ["game.prg"],
    ["--entry", "2061"],
    ["--processor", "6502"],
    ["--analyzer", "ida"],
    ["--analyzer", "dxa", "--decompile", "$0818"],
    ["--out-listing", "x.lst"],
    ["--max-listed", "-1"],
    ["--max-listed", "many"],
  ]) {
    const { status, json } = await analyze(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
  }
});
