// Coverage as static-analysis evidence (D44): the seeds it gives, the check
// it makes, and a DXA run that finds the code that only a vector reaches.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { joinCoverage } from "../../src/host-client/coverage.ts";
import { openForRead, openForWrite } from "../../src/knowledge/database.ts";
import { importFindings } from "../../src/knowledge/import.ts";
import { regionsOverlapping } from "../../src/knowledge/read.ts";
import { classifyRegion } from "../../src/knowledge/write.ts";
import { DXA, findTool } from "../../src/native/discover.ts";
import { codeEntries, coverageConflicts, coverageEntries, imageReader, readCoverageMaps } from "../../skills/c64-static-analysis/scripts/coverage.ts";
import { VECTORED_ROUTINE, vectoredPrg } from "../fixtures/prg/vectored.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-analysis-coverage-"));
const home = process.cwd();
beforeEach(() => process.chdir(project));
afterEach(() => process.chdir(home));
after(() => rmSync(project, { recursive: true, force: true }));

let dxaSkip: string | false = false;
try {
  findTool(DXA);
} catch {
  dxaSkip = "dxa is not installed";
}

function mapWith(starts: number[]): Uint8Array {
  const map = new Uint8Array(0x10000);
  for (const start of starts) map[start] = COVERAGE.ramExecute;
  return map;
}

test("coverage seeds the first instruction of each flow, not every instruction", () => {
  const image = new Uint8Array(0x10000);
  // $c000 LDA #1 / $c002 STA $d020 / $c005 RTS / $c006 LDA #2 (only a call reaches it) / $c010 NOP after a gap.
  image.set([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x60, 0xa9, 0x02], 0xc000);
  image[0xc010] = 0xea;
  const entries = coverageEntries(mapWith([0xc000, 0xc002, 0xc005, 0xc006, 0xc010]), imageReader(image, "flat64k"));
  assert.deepEqual(entries, [0xc000, 0xc006, 0xc010]);
});

test("a coverage file for analysis covers all 64 KiB", () => {
  writeFileSync(join(project, "part.bin"), new Uint8Array(256));
  assert.throws(() => readCoverageMaps(["part.bin"]), /has 256 bytes; a full coverage file has 65536/);
  writeFileSync(join(project, "a.bin"), mapWith([0x1000]));
  writeFileSync(join(project, "b.bin"), mapWith([0x2000]));
  const runs = readCoverageMaps(["a.bin", "b.bin"]);
  assert.equal(runs.length, 2, "one map for each file");
  const joined = joinCoverage(runs);
  assert.equal(joined[0x1000], COVERAGE.ramExecute);
  assert.equal(joined[0x2000], COVERAGE.ramExecute, "runs join");
});

test("code regions and JMP tables are entry points, and analyzer data over executed code is a conflict", () => {
  const db = openForWrite(project);
  const image = new Uint8Array(0x10000);
  image.set([0x4c, 0x00, 0x30, 0x4c, 0x00, 0x31], 0x2000);
  classifyRegion(db, { origin: "llm" }, { start: 0x2000, end: 0x2005, type: "jumps" });
  classifyRegion(db, { origin: "user" }, { start: 0x4000, end: 0x40ff, type: "code" });
  assert.deepEqual(codeEntries(db, imageReader(image, "flat64k")).sort((a, b) => a - b), [0x2000, 0x2003, 0x3000, 0x3100, 0x4000]);
  importFindings(db, { analyzer: "dxa", coverage: [{ start: 0x5000, end: 0x50ff }], authoritative: { symbols: true, regions: true, references: true }, symbols: [], regions: [{ start: 0x5000, end: 0x50ff, type: "bytes" }], references: [] });
  const conflicts = coverageConflicts(db, mapWith([0x5010, 0x5012, 0x4000]));
  assert.deepEqual(conflicts.map(({ region, executed }) => [region.start, region.end, region.origin, executed]), [[0x5000, 0x50ff, "dxa", 2]], "the user's code region is no conflict");
  db.close();
});

test("with coverage, DXA finds the code that only a vector reaches", { skip: dxaSkip, timeout: 120_000 }, () => {
  writeFileSync(join(project, "vectored.prg"), vectoredPrg);
  writeFileSync(join(project, "run.bin"), mapWith([0x080d, 0x080f, 0x0812, 0x0814, 0x0817, VECTORED_ROUTINE, VECTORED_ROUTINE + 3]));
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
  const analyze = (...args: string[]) => {
    const run = spawnSync(process.execPath, [...process.execArgv, script, "vectored.prg", "--analyzer", "dxa", ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    return JSON.parse(run.stdout) as Record<string, unknown>;
  };
  const codeAt = (address: number) => {
    const db = openForRead(project);
    const region = regionsOverlapping(db, address, address)[0];
    db?.close();
    return region?.type;
  };
  analyze();
  assert.notEqual(codeAt(VECTORED_ROUTINE), "code", "without coverage the routine looks like data");
  const seeded = analyze("--coverage", "run.bin");
  assert.deepEqual(seeded.coverageSeeds, { entryPoints: 2, used: 2 }, JSON.stringify(seeded));
  assert.equal(codeAt(VECTORED_ROUTINE), "code");
  assert.deepEqual(seeded.coverageConflicts, []);
});

test("with coverage, Ghidra makes a function of the code that only a vector reaches", { skip: process.env.C64RT_GHIDRA ? false : "set C64RT_GHIDRA to run Ghidra", timeout: 600_000 }, () => {
  writeFileSync(join(project, "vectored.prg"), vectoredPrg);
  writeFileSync(join(project, "run.bin"), mapWith([0x080d, 0x080f, 0x0812, 0x0814, 0x0817, VECTORED_ROUTINE, VECTORED_ROUTINE + 3]));
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "vectored.prg", "--entry", "$080d", "--coverage", "run.bin"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = JSON.parse(run.stdout) as { functions: { listed: Array<{ entry: string }> } };
  assert.ok(json.functions.listed.some((fn) => fn.entry === "$0820"), run.stdout);
});
