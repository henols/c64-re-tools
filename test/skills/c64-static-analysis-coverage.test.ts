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
import { codeEntries, coverageConflicts, coverageEntries, coverageSeedKinds, executedStarts, imageReader, readCoverageMaps, romOnlyRanges } from "../../skills/c64-static-analysis/scripts/lib/coverage.ts";
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

test("after an executed JSR the next instruction starts a flow, and a branch target or a return point is a code start, not a routine (D74)", () => {
  // The Bruce Lee run: Ghidra took a called routine for one that does not return and left the code after the JSR undecoded.
  const image = new Uint8Array(0x10000);
  // $c000 JSR $c100 / $c003 BNE $c007 / $c005 LDA #1 / $c007 RTS; $c100 RTS; $c200 is reached only through a vector.
  image.set([0x20, 0x00, 0xc1, 0xd0, 0x02, 0xa9, 0x01, 0x60], 0xc000);
  image[0xc100] = 0x60;
  image[0xc200] = 0x60;
  const map = mapWith([0xc000, 0xc003, 0xc007, 0xc100, 0xc200]);
  const byteAt = imageReader(image, "flat64k");
  assert.deepEqual(coverageEntries(map, byteAt), [0xc000, 0xc003, 0xc007, 0xc100, 0xc200]);
  assert.deepEqual(coverageSeedKinds(map, byteAt), { routines: [0xc000, 0xc100, 0xc200], codeStarts: [0xc003, 0xc007] });
  assert.deepEqual(executedStarts(map, byteAt), [0xc000, 0xc003, 0xc007, 0xc100, 0xc200]);
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

/**
 * A flat image whose program calls the KERNAL and stops: $080d JSR $FFE4 / BRK.
 * The RAM under the KERNAL holds leftover code at $ffe4, and its IRQ vector at
 * $fffe points to leftover code at $0016. The run executed the ROM there, never the RAM (R2-07).
 */
function kernalCall(): { image: Uint8Array; map: Uint8Array } {
  const image = new Uint8Array(0x10000);
  image.set([0x20, 0xe4, 0xff, 0x00], 0x080d);
  image.set([0xa9, 0x00, 0x8d, 0x00, 0x04, 0x60], 0xffe4);
  image.set([0x16, 0x00], 0xfffe);
  image.set([0xee, 0x20, 0xd0, 0x60], 0x0016);
  const map = mapWith([0x080d, 0x0810]);
  for (let address = 0xffe4; address <= 0xffe9; address++) map[address] = address === 0xffe4 ? COVERAGE.romExecute : COVERAGE.romRead;
  map[0xfffe] = COVERAGE.romRead;
  map[0xffff] = COVERAGE.romRead;
  return { image, map };
}

test("the RAM under ROM that the runs never read or ran is data for the analysis run (R2-07)", () => {
  const { image, map } = kernalCall();
  map[0xe000] = COVERAGE.romExecute | COVERAGE.ramExecute;
  map[0xa000] = COVERAGE.romRead | COVERAGE.ramRead;
  map[0xa001] = COVERAGE.romRead;
  assert.deepEqual(romOnlyRanges(map, imageReader(image, "flat64k")), [{ start: 0xa001, end: 0xa001 }, { start: 0xffe4, end: 0xffe9 }, { start: 0xfffe, end: 0xffff }], "RAM that a run read or ran is not in a range");
  const prg = Uint8Array.from([0x00, 0xa0, 0x00, 0x00]);
  assert.deepEqual(romOnlyRanges(map, imageReader(prg, "prg")), [{ start: 0xa001, end: 0xa001 }], "only bytes of the image");
});

test("with coverage, Ghidra does not follow a KERNAL call or the IRQ vector into the RAM under the KERNAL (R2-07)", { skip: process.env.C64RT_GHIDRA ? false : "set C64RT_GHIDRA to run Ghidra", timeout: 600_000 }, () => {
  const { image, map } = kernalCall();
  writeFileSync(join(project, "kernal.bin"), image);
  writeFileSync(join(project, "kernal-run.bin"), map);
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "kernal.bin", "--flat64k", "--entry", "$080d", "--coverage", "kernal-run.bin"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = JSON.parse(run.stdout) as { coverageSeeds: unknown };
  // $080d and the return point after JSR $ffe4.
  assert.deepEqual(json.coverageSeeds, { entryPoints: 2, used: 2, romOnlyRanges: 2, romOnlyUsed: 2 }, run.stdout);
  const db = openForRead(project);
  const typeAt = (address: number) => regionsOverlapping(db, address, address).find((region) => region.origin === "ghidra")?.type;
  assert.equal(typeAt(0x080d), "code", run.stdout);
  assert.notEqual(typeAt(0xffe4), "code", "the KERNAL call stays in ROM");
  assert.notEqual(typeAt(0x0016), "code", "BRK does not follow the IRQ vector under the KERNAL");
  db?.close();
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
  assert.deepEqual(seeded.coverageSeeds, { entryPoints: 2, used: 2, romOnlyRanges: 0, romOnlyUsed: 0 }, JSON.stringify(seeded));
  assert.equal(codeAt(VECTORED_ROUTINE), "code");
  assert.deepEqual(seeded.coverageConflicts, []);
});

test("with coverage, a branch target after an RTS is no Ghidra function, and no executed start is missing (D74, M23.4)", { skip: process.env.C64RT_GHIDRA ? false : "set C64RT_GHIDRA to run Ghidra", timeout: 600_000 }, () => {
  // $0810 LDA $02 / BEQ $0815 / RTS / $0815 INC $d020 / RTS: before M23.4 the coverage seed at $0815 became FUN_0815.
  const prg = Buffer.from([0x10, 0x08, 0xa5, 0x02, 0xf0, 0x01, 0x60, 0xee, 0x20, 0xd0, 0x60]);
  writeFileSync(join(project, "branch.prg"), prg);
  writeFileSync(join(project, "branch.bin"), mapWith([0x0810, 0x0812, 0x0815, 0x0818]));
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "branch.prg", "--entry", "$0810", "--coverage", "branch.bin"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = JSON.parse(run.stdout) as { functions: { listed: Array<{ entry: string }> }; coverageGaps: { count: number } };
  assert.deepEqual(json.functions.listed.map((fn) => fn.entry), ["$0810"], run.stdout);
  assert.equal(json.coverageGaps.count, 0, run.stdout);
});

test("with coverage, Ghidra makes a function of the code that only a vector reaches", { skip: process.env.C64RT_GHIDRA ? false : "set C64RT_GHIDRA to run Ghidra", timeout: 600_000 }, () => {
  writeFileSync(join(project, "vectored.prg"), vectoredPrg);
  writeFileSync(join(project, "run.bin"), mapWith([0x080d, 0x080f, 0x0812, 0x0814, 0x0817, VECTORED_ROUTINE, VECTORED_ROUTINE + 3]));
  const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "vectored.prg", "--entry", "$080d", "--coverage", "run.bin"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  const json = JSON.parse(run.stdout) as { functions: { listed: Array<{ entry: string }> } };
  assert.ok(json.functions.listed.some((fn) => fn.entry === "$0820"), run.stdout);
});
