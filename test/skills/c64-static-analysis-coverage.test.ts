// Coverage as static-analysis evidence: the seeds it gives, the check
// it makes, and a DXA run that finds the code that only a vector reaches.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { COVERAGE, coverageEntries, coverageSeedKinds, dxaFallThrough, executedStarts, romOnlyRanges } from "../../src/c64.ts";
import { openForRead, openForWrite, withWrite } from "../../src/knowledge/database.ts";
import { importFindings } from "../../src/knowledge/import.ts";
import { regionsOverlapping } from "../../src/knowledge/read.ts";
import { addReference, classifyRegion, renameSymbol } from "../../src/knowledge/write.ts";
import { DXA, findTool } from "../../src/native/discover.ts";
import { codeEntries, coverageConflicts, explainGaps, imageReader, referenceTargets, writtenNotExecuted, type ImageByte } from "../../skills/c64-static-analysis/scripts/lib/coverage.ts";
import { VECTORED_ROUTINE, vectoredPrg } from "../fixtures/prg/vectored.ts";
import { importCoverage, importImage, importPrg } from "../fixtures/program.ts";
import { readEnvelope } from "../kit.ts";

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

const cases: string[] = [];
after(() => {
  for (const root of cases) rmSync(root, { recursive: true, force: true });
});

/** A project of its own: the coverage of the knowledge only grows. */
function fresh(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-analysis-case-"));
  cases.push(root);
  return root;
}

const analyzeScript = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/static-analysis.ts");
const analyzeIn = (root: string, ...args: string[]) => spawnSync(process.execPath, [...process.execArgv, analyzeScript, "analyze", ...args], { cwd: root, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
/** The body of a run: the envelope must be ok:true. */
const bodyOf = (run: ReturnType<typeof analyzeIn>) => {
  const { envelope, json } = readEnvelope(run.stdout, run.status);
  assert.equal(envelope.ok, true, run.stdout);
  return json;
};

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

test("after an executed JSR the next instruction starts a flow, and a branch target or a return point is a code start, not a routine", () => {
  // The Bruce Lee run: the decompiler took a called routine for one that does not return and left the code after the JSR undecoded.
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

test("DXA gets only the coverage starts that no other seed reaches by fall-through, as the instruction after a JSR", () => {
  // The Bruce Lee run: 1187 coverage starts, most of them after a JSR, went over the limit of 1024 entry points.
  const image = new Uint8Array(0x10000);
  // $c000 JSR $c100 / $c003 JSR $c100 / $c006 RTS; $c100 RTS; $c200 LDA #1 / RTS is reached only through a vector.
  image.set([0x20, 0x00, 0xc1, 0x20, 0x00, 0xc1, 0x60], 0xc000);
  image[0xc100] = 0x60;
  image.set([0xa9, 0x01, 0x60], 0xc200);
  const map = mapWith([0xc000, 0xc003, 0xc006, 0xc100, 0xc200, 0xc202]);
  const byteAt = imageReader(image, "flat64k");
  const starts = coverageEntries(map, byteAt);
  const reached = dxaFallThrough(starts, map, byteAt, []);
  assert.deepEqual(starts.filter((start) => !reached.has(start)), [0xc000, 0xc100, 0xc200]);
  assert.deepEqual([...dxaFallThrough([0xc003], map, byteAt, [])], [0xc006], "a seed is not in the set unless another seed reaches it");
});

test("the fall-through for DXA stops where DXA does not follow the next instruction", () => {
  const image = new Uint8Array(0x10000);
  image[0xc100] = 0x60;
  // A JSR into a data range: $c300 JSR $c400 / $c303 LDA #1 / RTS.
  image.set([0x20, 0x00, 0xc4, 0xa9, 0x01, 0x60], 0xc300);
  // An instruction that no run executed: $c320 JSR $c100 / $c323 NOP / $c324 RTS.
  image.set([0x20, 0x00, 0xc1, 0xea, 0x60], 0xc320);
  // An executed instruction in a data range: $c330 JSR $c100 / $c333 LDA #1 / RTS.
  image.set([0x20, 0x00, 0xc1, 0xa9, 0x01, 0x60], 0xc330);
  // An operand that holds another executed start: $c340 JSR $c100 / $c343 BIT $ea60, where $c344 RTS also runs / $c346 JSR $c100 / RTS.
  image.set([0x20, 0x00, 0xc1, 0x2c, 0x60, 0xea, 0x20, 0x00, 0xc1, 0x60], 0xc340);
  // A branch into a data range: $c380 BEQ $c3f0 / $c382 JSR $c100 / RTS.
  image.set([0xf0, 0x6e, 0x20, 0x00, 0xc1, 0x60], 0xc380);
  const map = mapWith([0xc100, 0xc300, 0xc303, 0xc305, 0xc320, 0xc324, 0xc330, 0xc333, 0xc335, 0xc340, 0xc343, 0xc344, 0xc346, 0xc349, 0xc380, 0xc382, 0xc385]);
  const byteAt = imageReader(image, "flat64k");
  const starts = coverageEntries(map, byteAt);
  const reached = dxaFallThrough(starts, map, byteAt, [{ start: 0xc333, end: 0xc334 }, { start: 0xc3f0, end: 0xc40f }]);
  assert.deepEqual(starts.filter((start) => !reached.has(start)), [0xc100, 0xc300, 0xc303, 0xc320, 0xc324, 0xc330, 0xc333, 0xc340, 0xc344, 0xc346, 0xc380, 0xc385]);
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

test("the jump and call targets from code of any origin are DXA entry points, but not in data, in dual-use bytes or outside the image", () => {
  const db = openForWrite(fresh());
  importFindings(db, {
    analyzer: "decompiler",
    coverage: [{ start: 0x4000, end: 0x4fff }],
    authoritative: { symbols: true, regions: true, references: true },
    symbols: [],
    regions: [{ start: 0x4000, end: 0x40ff, type: "code" }, { start: 0x4100, end: 0x41ff, type: "bytes" }],
    references: [
      { from: 0x4000, to: 0x4050, kind: "jump" },
      { from: 0x4003, to: 0x4060, kind: "call" },
      // A read is no flow.
      { from: 0x4006, to: 0x4070, kind: "read" },
      // Into a data range, into dual-use bytes, and out of the image.
      { from: 0x4009, to: 0x4080, kind: "jump" },
      { from: 0x400c, to: 0x4091, kind: "jump" },
      { from: 0x400f, to: 0x9000, kind: "call" },
      // From bytes that the knowledge holds as data.
      { from: 0x4100, to: 0x40a0, kind: "jump" },
    ],
  });
  classifyRegion(db, { origin: "llm" }, { start: 0x4090, end: 0x4092, type: "dual-use" });
  addReference(db, { origin: "llm" }, { from: 0x4012, to: 0x40b0, kind: "jump" });
  const image: ImageByte = (address) => (address >= 0x4000 && address <= 0x4fff ? 0xea : undefined);
  assert.deepEqual(referenceTargets(db, image, [{ start: 0x4080, end: 0x408f }]), [0x4050, 0x4060, 0x40b0]);
  db.close();
});

test("analyzer code on bytes that a run wrote and never executed is listed with the instructions that reach it", () => {
  const db = openForWrite(fresh());
  importFindings(db, {
    analyzer: "decompiler",
    coverage: [{ start: 0x4000, end: 0x6fff }],
    authoritative: { symbols: true, regions: true, references: true },
    symbols: [],
    regions: [{ start: 0x4000, end: 0x400f, type: "code" }, { start: 0x5000, end: 0x500f, type: "code" }, { start: 0x6000, end: 0x600f, type: "code" }],
    references: [{ from: 0x4003, to: 0x5000, kind: "call" }, { from: 0x5004, to: 0x5008, kind: "jump" }],
  });
  const map = mapWith([0x4000, 0x6000]);
  for (const address of [0x5001, 0x5002, 0x6004]) map[address] = (map[address] ?? 0) | COVERAGE.ramWrite;
  assert.deepEqual(writtenNotExecuted(db, "decompiler", map), [{ start: 0x5000, end: 0x500f, from: [0x4003] }], "executed code and code that no run wrote are not listed");
  db.close();
});

test("each coverage gap gets the reason of its refused seed, the instruction that holds it, the data range that holds it, or not-reached", () => {
  const gaps = explainGaps(
    [0x1001, 0x2000, 0x3000, 0x4000],
    [{ address: 0x1000, bytes: "ad3412" }],
    [{ address: 0x2000, reason: "into-data" }],
    [{ start: 0x3000, end: 0x30ff }],
  );
  assert.deepEqual(gaps, [
    { address: 0x1001, reason: "inside-instruction", at: 0x1000 },
    { address: 0x2000, reason: "into-data" },
    { address: 0x3000, reason: "in-data", range: { start: 0x3000, end: 0x30ff } },
    { address: 0x4000, reason: "not-reached" },
  ]);
});

/**
 * A flat image whose program calls the KERNAL and stops: $080d JSR $FFE4 / BRK.
 * The RAM under the KERNAL holds leftover code at $ffe4, and its IRQ vector at
 * $fffe points to leftover code at $0016. The run executed the ROM there, never the RAM.
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

test("the RAM under ROM that the runs never read or ran is data for the analysis run", () => {
  const { image, map } = kernalCall();
  map[0xe000] = COVERAGE.romExecute | COVERAGE.ramExecute;
  map[0xa000] = COVERAGE.romRead | COVERAGE.ramRead;
  map[0xa001] = COVERAGE.romRead;
  assert.deepEqual(romOnlyRanges(map, imageReader(image, "flat64k")), [{ start: 0xa001, end: 0xa001 }, { start: 0xffe4, end: 0xffe9 }, { start: 0xfffe, end: 0xffff }], "RAM that a run read or ran is not in a range");
  const prg = Uint8Array.from([0x00, 0xa0, 0x00, 0x00]);
  assert.deepEqual(romOnlyRanges(map, imageReader(prg, "prg")), [{ start: 0xa001, end: 0xa001 }], "only bytes of the image");
});

test("with coverage, the decompiler does not follow a KERNAL call or the IRQ vector into the RAM under the KERNAL", { timeout: 120_000 }, () => {
  const { image, map } = kernalCall();
  const root = fresh();
  // The program and the RAM under the KERNAL that holds bytes like code.
  importImage(root, image, { segments: [{ start: 0x0016, end: 0x0019 }, { start: 0x080d, end: 0x0810 }, { start: 0xffe4, end: 0xffe9 }, { start: 0xfffe, end: 0xffff }] });
  importCoverage(root, { "kernal-run.bin": map });
  const run = analyzeIn(root, "--entry", "$080d");
  const json = bodyOf(run) as { coverageSeeds: unknown };
  // $080d and the return point after JSR $ffe4.
  assert.deepEqual(json.coverageSeeds, { entryPoints: 2, used: 2, romOnlyRanges: 2, romOnlyUsed: 2 }, run.stdout);
  const db = openForRead(root);
  const typeAt = (address: number) => regionsOverlapping(db, address, address).find((region) => region.origin === "decompiler")?.type;
  assert.equal(typeAt(0x080d), "code", run.stdout);
  assert.notEqual(typeAt(0xffe4), "code", "the KERNAL call stays in ROM");
  assert.notEqual(typeAt(0x0016), "code", "BRK does not follow the IRQ vector under the KERNAL");
  db?.close();
});

test("with coverage, DXA finds the code that only a vector reaches", { skip: dxaSkip, timeout: 120_000 }, () => {
  const root = fresh();
  importPrg(root, vectoredPrg);
  const analyze = () => bodyOf(analyzeIn(root, "--analyzer", "dxa")) as Record<string, unknown>;
  const codeAt = (address: number) => {
    const db = openForRead(root);
    const region = regionsOverlapping(db, address, address)[0];
    db?.close();
    return region?.type;
  };
  analyze();
  assert.notEqual(codeAt(VECTORED_ROUTINE), "code", "without coverage the routine looks like data");
  importCoverage(root, { "run.bin": mapWith([0x080d, 0x080f, 0x0812, 0x0814, 0x0817, VECTORED_ROUTINE, VECTORED_ROUTINE + 3]) });
  const seeded = analyze();
  assert.deepEqual(seeded.coverageSeeds, { entryPoints: 2, used: 2, romOnlyRanges: 0, romOnlyUsed: 0 }, JSON.stringify(seeded));
  assert.equal(codeAt(VECTORED_ROUTINE), "code");
  assert.deepEqual(seeded.coverageConflicts, []);
});

test("with the jump targets of the decompiler, DXA keeps the code that only a branch reaches when that route runs into a BIT operand", { skip: dxaSkip, timeout: 120_000 }, () => {
  // $1000 LDA $60 / BMI $1009 / DEC $60 / BEQ $1012 / RTS; $1009 BEQ $100c / RTS
  // $100c DEC $66 / BMI $1016 / RTS: only the BEQ at $1009 reaches it. $1011 NOP is not used.
  // $1012 LDA $29 / BNE $1016; $1016 LDA $65 / BNE $1020 / INC $64 / BCS $1023 / NOP / NOP
  // $1020 LDA #$07 / $1022 BIT $00a9, whose operand $1023 is LDA #$00 / STA $64 / RTS
  const code = [0xa5, 0x60, 0x30, 0x05, 0xc6, 0x60, 0xf0, 0x0a, 0x60, 0xf0, 0x01, 0x60, 0xc6, 0x66, 0x30, 0x06, 0x60, 0xea, 0xa5, 0x29];
  const root = fresh();
  importPrg(root, Uint8Array.from([0x00, 0x10, ...code, 0xd0, 0x00, 0xa5, 0x65, 0xd0, 0x06, 0xe6, 0x64, 0xb0, 0x05, 0xea, 0xea, 0xa9, 0x07, 0x2c, 0xa9, 0x00, 0x85, 0x64, 0x60]));
  const dxaTypeAt = (address: number) => {
    const db = openForRead(root);
    const region = regionsOverlapping(db, address, address).find((row) => row.origin === "dxa");
    db?.close();
    return region?.type;
  };
  bodyOf(analyzeIn(root, "--analyzer", "dxa", "--entry", "$1000"));
  assert.equal(dxaTypeAt(0x100c), "bytes", "from the entry alone, DXA drops the route that runs into the BIT operand");
  bodyOf(analyzeIn(root, "--entry", "$1000"));
  const again = bodyOf(analyzeIn(root, "--analyzer", "dxa", "--entry", "$1000")) as { conflicts: unknown[] };
  assert.equal(dxaTypeAt(0x100c), "code");
  assert.deepEqual(again.conflicts, []);
});

test("with coverage, a branch target after an RTS is no decompiler function, and no executed start is missing", { timeout: 120_000 }, () => {
  // $0810 LDA $02 / BEQ $0815 / RTS / $0815 INC $d020 / RTS: the coverage seed at $0815 must not become FUN_0815.
  const prg = Buffer.from([0x10, 0x08, 0xa5, 0x02, 0xf0, 0x01, 0x60, 0xee, 0x20, 0xd0, 0x60]);
  const root = fresh();
  importPrg(root, prg);
  importCoverage(root, { "branch.bin": mapWith([0x0810, 0x0812, 0x0815, 0x0818]) });
  const run = analyzeIn(root, "--entry", "$0810");
  const json = bodyOf(run) as { functions: { listed: Array<{ entry: string }> }; coverageGaps: { count: number } };
  assert.deepEqual(json.functions.listed.map((fn) => fn.entry), ["$0810"], run.stdout);
  assert.equal(json.coverageGaps.count, 0, run.stdout);
});

test("a routine of the knowledge outside the program is a refused seed, but only an --entry outside the program asks to correct the knowledge", { timeout: 120_000 }, () => {
  // $0810 RTS. The program copies a routine to $c000 when it runs: the knowledge names it there.
  const root = fresh();
  importPrg(root, Buffer.from([0x10, 0x08, 0x60]));
  withWrite((db) => renameSymbol(db, { origin: "llm" }, { address: 0xc000, name: "copied_routine", kind: "routine" }), root);
  const copied = analyzeIn(root, "--entry", "$0810");
  assert.deepEqual((bodyOf(copied) as { seeds: { refused: { listed: unknown[] } } }).seeds.refused.listed, [{ address: "$c000", reason: "outside-program" }], copied.stdout);
  assert.doesNotMatch(readEnvelope(copied.stdout, copied.status).envelope.hint ?? "", /did not decode/);
  const wrong = analyzeIn(root, "--entry", "$0810", "--entry", "$c100");
  assert.match(readEnvelope(wrong.stdout, wrong.status).envelope.hint ?? "", /did not decode 1 seeds/);
});

test("with coverage, the decompiler makes a function of the code that only a vector reaches", { timeout: 120_000 }, () => {
  const root = fresh();
  importPrg(root, vectoredPrg);
  importCoverage(root, { "run.bin": mapWith([0x080d, 0x080f, 0x0812, 0x0814, 0x0817, VECTORED_ROUTINE, VECTORED_ROUTINE + 3]) });
  const run = analyzeIn(root, "--entry", "$080d");
  const json = bodyOf(run) as { functions: { listed: Array<{ entry: string }> } };
  assert.ok(json.functions.listed.some((fn) => fn.entry === "$0820"), run.stdout);
});
