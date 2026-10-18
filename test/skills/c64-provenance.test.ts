// The c64-provenance comparison: differences, agreeing groups and alignment.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { compareReleases, shiftSuggestion, suggestShifts } from "../../skills/c64-provenance/scripts/lib/compare.ts";
import { separate } from "../../skills/c64-provenance/scripts/lib/separate.ts";
import { seededBytes } from "../kit.ts";
import { importCoverage, importImage } from "../fixtures/program.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-provenance-"));
const programs: string[] = [];
after(() => {
  rmSync(project, { recursive: true, force: true });
  for (const root of programs) rmSync(root, { recursive: true, force: true });
});

/** A project of its own for one program in the knowledge. */
function fresh(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-provenance-program-"));
  programs.push(root);
  return root;
}

const base = seededBytes(0x6510, 2048);
const crackA = Buffer.from(base);
// A patched check: three bytes that always differ from the base.
const patch = [0, 1, 2].map((index) => base[0x0900 - 0x0801 + index]! ^ 0x55);
crackA.set(patch, 0x0900 - 0x0801);
const crackB = Buffer.from(base);
crackB[0x0a00 - 0x0801] = crackB[0x0a00 - 0x0801]! ^ 0xff; // a changed text byte

/** A release with one segment from `start`. */
const at = (name: string, start: number, bytes: Uint8Array) => ({ name, segments: [{ start, end: start + bytes.length - 1 }], byteAt: (address: number) => bytes[address - start]! });

test("differences show the bytes of each release and which releases agree", () => {
  const releases = [
    at("release", 0x0801, base),
    at("crack-a", 0x0801, crackA),
    at("crack-b", 0x0801, crackB),
  ];
  const result = compareReleases(releases);
  assert.deepEqual(result.common, [{ start: 0x0801, end: 0x0801 + 2047 }]);
  assert.equal(result.differingBytes, 4);
  assert.deepEqual(result.differences.map((difference) => [difference.start, difference.end, difference.groups]), [
    [0x0900, 0x0902, [["release", "crack-b"], ["crack-a"]]],
    [0x0a00, 0x0a00, [["release", "crack-a"], ["crack-b"]]],
  ]);
  assert.deepEqual(result.differences[0]!.values["crack-a"], patch);
  assert.equal(compareReleases(releases, { from: 0x0a00, to: 0x0aff }).differingBytes, 1);
});

test("a release at another address gets a suggested shift", () => {
  assert.deepEqual(suggestShifts(at("release", 0x0801, base), at("moved", 0x0901, base)), [{ shift: -256, matches: 2041 }]);
});

test("data that stayed and code that moved both get a shift, and the present alignment is marked current", () => {
  const data = seededBytes(0x1234, 256);
  const code = seededBytes(0x6510, 2048);
  const prg = (bytes: Uint8Array[]) => Buffer.concat([Buffer.from([0x00, 0x20]), ...bytes]);
  writeFileSync(join(project, "stay.prg"), prg([data, code]));
  writeFileSync(join(project, "grow.prg"), prg([data, new Uint8Array(256), code]));
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "compare", "stay.prg", "grow.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as { identicalShare: number; suggestedShifts: Array<{ release: number; shift: number; current?: true }> };
  assert.ok(result.identicalShare < 0.5);
  assert.deepEqual(result.suggestedShifts.map((item) => [item.release, item.shift, item.current ?? false]), [[2, -256, false], [2, 0, true]]);
});

test("a shift that moves a segment out of $0000-$ffff is not suggested: the opposite shift of release 1 is, or the reason", () => {
  const found = { shift: 920, matches: 3544 };
  const high = { name: "high", segments: [{ start: 0x5000, end: 0x9000 }, { start: 0xe000, end: 0xffff }], byteAt: () => 0 };
  const low = { name: "low", segments: [{ start: 0x0801, end: 0x9000 }], byteAt: () => 0 };
  assert.deepEqual(shiftSuggestion([low, low], [0, 0], 1, found), { release: 2, shift: 920, matchingSequences: 3544 });
  assert.deepEqual(shiftSuggestion([low, low], [0, 100], 1, found), { release: 2, shift: 1020, matchingSequences: 3544 }, "the full value for --shift");
  assert.deepEqual(shiftSuggestion([low, high], [0, 0], 1, found), { release: 1, shift: -920, matchingSequences: 3544 });
  const none = shiftSuggestion([low, high, low], [0, 0, 0], 1, found);
  assert.equal("shift" in none, false);
  assert.match((none as { reason: string }).reason, /release 2 moved by 920 puts \$e000-\$ffff past \$ffff/);
  const zero = { name: "zero", segments: [{ start: 0x0000, end: 0x00ff }], byteAt: () => 0 };
  assert.match((shiftSuggestion([zero, high], [0, 0], 1, found) as { reason: string }).reason, /release 1 moved by -920 puts \$0000-\$00ff below \$0000/);
});

test("the script compares PRG files and applies a shift", () => {
  const prg = (start: number, bytes: Uint8Array) => Buffer.concat([Buffer.from([start & 0xff, start >> 8]), bytes]);
  writeFileSync(join(project, "release.prg"), prg(0x0801, base));
  writeFileSync(join(project, "moved.prg"), prg(0x0901, base));
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const loose = spawnSync(process.execPath, [...process.execArgv, script, "compare", "release.prg", "moved.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(loose.status, 0, loose.stdout + loose.stderr);
  const unaligned = JSON.parse(loose.stdout) as { identicalShare: number; suggestedShifts: Array<{ release: number; shift: number }> };
  assert.ok(unaligned.identicalShare < 0.5);
  assert.deepEqual(unaligned.suggestedShifts.map((item) => [item.release, item.shift]), [[2, -256]]);
  const aligned = JSON.parse(spawnSync(process.execPath, [...process.execArgv, script, "compare", "release.prg", "moved.prg", "--shift", "2:-256"], { cwd: project, encoding: "utf8" }).stdout) as Record<string, unknown>;
  assert.equal(aligned.differingBytes, 0);
  assert.equal(aligned.identicalShare, 1);
  assert.deepEqual((aligned.releases as Array<{ shift: number }>).map((item) => item.shift), [0, -256]);
  const bad = spawnSync(process.execPath, [...process.execArgv, script, "compare", "release.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(bad.status, 2);
  const twice = spawnSync(process.execPath, [...process.execArgv, script, "compare", "release.prg", "moved.prg", "--shift", "2:-256", "--shift", "2:256"], { cwd: project, encoding: "utf8" });
  assert.equal(twice.status, 2, twice.stdout);
  const { error } = JSON.parse(twice.stdout) as { error: { code: string; message: string } };
  assert.equal(error.code, "invalid-input");
  assert.match(error.message, /^--shift gives release 2 more than one shift \(-256 and 256\)\. Give one --shift for each release/);
  const refused = (args: string[]) => {
    const run = spawnSync(process.execPath, [...process.execArgv, script, "compare", ...args], { cwd: project, encoding: "utf8" });
    assert.equal(run.status, 2, run.stdout);
    return JSON.parse(run.stdout).error as { code: string; message: string };
  };
  const third = refused(["release.prg", "moved.prg", "--shift", "3:-1280"]);
  assert.equal(third.code, "invalid-input");
  assert.match(third.message, /^--shift 3:-1280: there is no release 3\. This compare has 2 releases: give a release number from 1 to 2\n/);
  assert.match(refused(["release.prg", "moved.prg", "--shift", "2-256"]).message, /^--shift must be <release number>:<bytes>, for example 2:-256, not 2-256\n/);
});

test("compare refuses a disk, tape or cartridge image with the remedy, as the unpacker does", () => {
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  writeFileSync(join(project, "game.d64"), Buffer.alloc(174848));
  writeFileSync(join(project, "one.prg"), Buffer.from([0x01, 0x08, 0xea]));
  const run = spawnSync(process.execPath, [...process.execArgv, script, "compare", "one.prg", "game.d64"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 2, run.stdout);
  assert.deepEqual(JSON.parse(run.stdout).error, {
    code: "invalid-input",
    message: "game.d64 is a disk image (.d64), not a PRG. Get the PRG out of it with disk.ts read (or disk.ts crt for a cartridge) of the c64-disk skill.",
  });
  // An unknown name in the steps stops the call before an emulator starts (no host listens at port 1).
  writeFileSync(join(project, "name.json"), JSON.stringify([{ runUntil: { target: { kind: "address", address: "nonsense" } } }]));
  const named = spawnSync(process.execPath, [...process.execArgv, script, "compare", "one.prg", "one.prg", "--frames", "10", "--steps", "name.json"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(named.status, 2, named.stdout);
  assert.equal(JSON.parse(named.stdout).error.code, "invalid-input");
  assert.match(JSON.parse(named.stdout).error.message, /^--steps name\.json: step 1: nonsense is not a name in the knowledge/);
});

test("a missing release is not-found", () => {
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  writeFileSync(join(project, "one.prg"), Buffer.from([0x01, 0x08, 0xea]));
  const missing = spawnSync(process.execPath, [...process.execArgv, script, "compare", "one.prg", "missing.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(missing.status, 2, missing.stdout + missing.stderr);
  assert.equal((JSON.parse(missing.stdout) as { error: { code: string } }).error.code, "not-found");
});

test("an image release counts only inside its segments, and a common range never joins across a gap", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(base.subarray(0, 0x100), 0x0801);
  memory.set(base.subarray(0x200, 0x300), 0x0a01);
  mkdirSync(join(project, "unpacked"), { recursive: true });
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ image: "image.bin", segments: [{ start: "$0801", end: "$0900" }, { start: "$0a01", end: "$0b00" }] }));
  writeFileSync(join(project, "whole.prg"), Buffer.concat([Buffer.from([0x01, 0x08]), crackA]));
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "compare", "unpacked/image.json", "whole.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as { common: unknown; differences: Array<{ start: string; end: string }>; identicalBytes: number };
  assert.deepEqual(result.common, [{ start: "$0801", end: "$0900" }, { start: "$0a01", end: "$0b00" }]);
  assert.deepEqual(result.differences.map((difference) => [difference.start, difference.end]), [["$0900", "$0900"]], "the patch at $0900-$0902 counts only where the image has bytes");
  const steps = spawnSync(process.execPath, [...process.execArgv, script, "compare", "unpacked/image.json", "whole.prg", "--steps", "s.json"], { cwd: project, encoding: "utf8" });
  assert.equal(steps.status, 2, "--steps needs --run");
});

test("separate gives each range its stage and access, each code region its reachability, and what runs outside the image", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0x20, 0x08, 0x10, 0x60, 0x01, 0x02, 0x03, 0x04, 0x60, 0x00, 0xea, 0x60], 0x1000);
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = COVERAGE.ramExecute;
  coverage[0x1003] = COVERAGE.ramExecute;
  coverage[0x1008] = COVERAGE.ramExecute;
  coverage[0x1004] = COVERAGE.ramRead;
  coverage[0x1005] = COVERAGE.ramWrite;
  coverage[0x1006] = COVERAGE.ramRead | COVERAGE.ramWrite;
  coverage[0xc000] = COVERAGE.ramRead;
  coverage[0xc100] = COVERAGE.ramWrite | COVERAGE.ramExecute;
  coverage[0xc200] = COVERAGE.ramExecute;
  const found = separate({
    segments: [{ start: 0x1000, end: 0x100b }],
    memory,
    entry: 0x1000,
    stages: [
      { entry: 0x0810, wrote: [{ start: 0x1000, end: 0x1007 }] },
      { entry: 0x1000, wrote: [{ start: 0x1004, end: 0x100b }] },
    ],
    coverage,
    codeRegions: [
      { start: 0x1000, end: 0x1003, type: "code" },
      { start: 0x1008, end: 0x1008, type: "code" },
      { start: 0x100a, end: 0x100b, type: "code" },
    ],
    references: [{ from: 0x1000, to: 0x1008, kind: "call" }],
  });
  assert.deepEqual(found.ranges, [
    { start: 0x1000, end: 0x1003, stage: 0, access: "executed" },
    { start: 0x1004, end: 0x1004, stage: 1, access: "read" },
    { start: 0x1005, end: 0x1005, stage: 1, access: "written" },
    { start: 0x1006, end: 0x1006, stage: 1, access: "read-written" },
    { start: 0x1007, end: 0x1007, stage: 1, access: "untouched" },
    { start: 0x1008, end: 0x1008, stage: 1, access: "executed" },
    { start: 0x1009, end: 0x100b, stage: 1, access: "untouched" },
  ]);
  assert.deepEqual(
    found.codeRegions.map((region) => [region.start, region.reachable, region.executed]),
    [
      [0x1000, true, true],
      [0x1008, true, true],
      [0x100a, false, false],
    ],
  );
  assert.deepEqual(found.outside, { read: [{ start: 0xc000, end: 0xc000 }], executed: [{ start: 0xc200, end: 0xc200 }], generated: [{ start: 0xc100, end: 0xc100 }] });
});

test("a code region whose last instruction runs on reaches the next address; RTS, RTI, JMP, BRK and JAM do not run on", () => {
  const memory = new Uint8Array(0x10000);
  // $2000 LDA #$01 / STA $d020 runs on into $2005: JSR $3000 runs on into $2008: BNE $2008 runs on into $200a: JMP $200a.
  // After the JMP, $200d is reached by nothing; the RTS, RTI, BRK and JAM regions do not run on into the region after them.
  memory.set([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x20, 0x00, 0x30, 0xd0, 0xfe, 0x4c, 0x0a, 0x20, 0xea, 0x60, 0xea, 0x40, 0xea, 0x00, 0xea, 0x02, 0xea], 0x2000);
  const region = (start: number, end: number) => ({ start, end, type: "code" });
  const found = separate({
    segments: [{ start: 0x2000, end: 0x2015 }],
    memory,
    entry: 0x2000,
    codeRegions: [region(0x2000, 0x2004), region(0x2005, 0x2007), region(0x2008, 0x2009), region(0x200a, 0x200c), region(0x200d, 0x200e), region(0x200f, 0x2010), region(0x2011, 0x2012), region(0x2013, 0x2014), region(0x2015, 0x2015)],
    references: [],
  });
  assert.deepEqual(
    found.codeRegions.map((item) => [item.start, item.reachable]),
    [
      [0x2000, true],
      [0x2005, true],
      [0x2008, true],
      [0x200a, true],
      [0x200d, false],
      [0x200f, false],
      [0x2011, false],
      [0x2013, false],
      [0x2015, false],
    ],
  );
  const reachedFrom = (code: number[]) => {
    const bytes = new Uint8Array(0x10000);
    bytes.set([...code, 0xea], 0x4000);
    return separate({ segments: [{ start: 0x4000, end: 0x4000 + code.length }], memory: bytes, entry: 0x4000, codeRegions: [region(0x4000, 0x4000 + code.length - 1), region(0x4000 + code.length, 0x4000 + code.length)], references: [] }).codeRegions[1]!.reachable;
  };
  assert.deepEqual([[0x60], [0x40], [0x4c, 0x00, 0x40], [0x6c, 0x00, 0x40], [0x00], [0x02], [0xf2]].map(reachedFrom), [false, false, false, false, false, false, false]);
  assert.deepEqual([[0xea], [0x20, 0x00, 0x50], [0xf0, 0x02], [0x18]].map(reachedFrom), [true, true, true, true]);
  // The Bruce Lee cold start: SEI ... LDA $d011 is code, AND #$ef is a dual-use region (also the IRQ vector), STA $d011 is code again.
  const coldStart = (gap: number[]) => {
    const bytes = new Uint8Array(0x10000);
    bytes.set([0x78, 0xd8, 0xa2, 0xff, 0x9a, 0xad, 0x11, 0xd0, ...gap, 0x8d, 0x11, 0xd0, 0x60], 0x0400);
    const next = 0x0408 + gap.length;
    return separate({ segments: [{ start: 0x03ff, end: next + 3 }], memory: bytes, entry: 0x0400, codeRegions: [region(0x0400, 0x0407), region(next, next + 3)], references: [] }).codeRegions[1]!.reachable;
  };
  assert.equal(coldStart([0x29, 0xef]), true, "the CPU runs through the AND #$ef of no code region into the next code region");
  assert.equal(coldStart([0x60, 0xea]), false, "an RTS between the regions does not run on");
});

test("generated code outside the image joins over gaps of up to two operand bytes, never over the image", () => {
  const coverage = new Uint8Array(0x10000);
  const ran = COVERAGE.ramWrite | COVERAGE.ramExecute;
  // Opcodes at $c000, $c002, $c005; $c009 is four bytes on; $1ffe-$2002 goes over the image byte $2000.
  for (const address of [0xc000, 0xc002, 0xc005, 0xc009, 0x1ffe, 0x2001]) coverage[address] = ran;
  const found = separate({ segments: [{ start: 0x2000, end: 0x2000 }], memory: new Uint8Array(0x10000), coverage, codeRegions: [], references: [] });
  assert.deepEqual(found.outside.generated, [
    { start: 0x1ffe, end: 0x1ffe },
    { start: 0x2001, end: 0x2001 },
    { start: 0xc000, end: 0xc005 },
    { start: 0xc009, end: 0xc009 },
  ]);
});

test("the separate command reads the program with its stages and the coverage from the knowledge and writes all ranges to --out", () => {
  const memory = new Uint8Array(0x10000);
  memory.fill(0xea, 0x2000, 0x20ff);
  const root = fresh();
  const stages = [{ stage: 0, entry: "$0810", wrote: [{ start: "$2000", end: "$207f" }] }, { stage: 1, entry: "$2000", wrote: [{ start: "$2080", end: "$20ff" }] }];
  importImage(root, memory, { segments: [{ start: 0x2000, end: 0x20ff }], entry: 0x2000, stages });
  // Code that the program wrote and ran outside the image: three pieces.
  const coverage = new Uint8Array(0x10000);
  for (const address of [0xc000, 0xc010, 0xc020]) coverage[address] = COVERAGE.ramWrite | COVERAGE.ramExecute;
  importCoverage(root, { "cov.bin": coverage });
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "separate", "--out", "separate.json", "--max-listed", "1"], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, any>;
  assert.deepEqual(result.bytesByStage, { 0: 128, 1: 128, none: 0 });
  assert.equal(result.bytesByAccess.untouched, 256);
  assert.equal(result.ranges.count, 2);
  assert.equal(result.ranges.listed.length, 1);
  assert.equal(result.outside.generated.count, 3);
  assert.deepEqual(result.outside.generated.listed, [{ start: "$c000", end: "$c000" }], "--max-listed caps the outside lists too");
  assert.deepEqual(result.outside.read, { count: 0, listed: [] });
  assert.deepEqual(result.codeRegions, { total: 0, unreachable: { count: 0, listed: [] } }, "unreachable is a list like the others");
  const written = JSON.parse(readFileSync(join(root, "separate.json"), "utf8")) as { ranges: unknown[]; outside: { generated: unknown[] } };
  assert.equal(written.ranges.length, 2);
  assert.equal(written.outside.generated.length, 3);
  assert.equal(spawnSync(process.execPath, [...process.execArgv, script, "separate", "--frames", "5"], { cwd: root, encoding: "utf8" }).status, 2);
  assert.equal(spawnSync(process.execPath, [...process.execArgv, script, "separate", "image.json"], { cwd: root, encoding: "utf8" }).status, 2, "separate takes no release");
  const empty = spawnSync(process.execPath, [...process.execArgv, script, "separate"], { cwd: fresh(), encoding: "utf8" });
  assert.equal(empty.status, 2, "no program in the knowledge");
  assert.match(empty.stdout, /knowledge\.ts image/);
});

test("separate says when the program has no stage log, and a run of releases without differences says why nothing ran", () => {
  const memory = new Uint8Array(0x10000);
  memory.fill(0xea, 0x3000, 0x30ff);
  const root = fresh();
  importImage(root, memory, { segments: [{ start: 0x3000, end: 0x30ff }], entry: 0x3000 });
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const separated = spawnSync(process.execPath, [...process.execArgv, script, "separate"], { cwd: root, encoding: "utf8" });
  assert.equal(separated.status, 0, separated.stdout + separated.stderr);
  const result = JSON.parse(separated.stdout) as Record<string, unknown>;
  assert.match(String(result.noStages), /no stage log/);
  assert.equal(result.bytesByStage, undefined);

  const prg = Buffer.concat([Buffer.from([0x01, 0x08]), base]);
  writeFileSync(join(project, "same-a.prg"), prg);
  writeFileSync(join(project, "same-b.prg"), prg);
  // No difference: no emulator starts, so no host is needed.
  const run = spawnSync(process.execPath, [...process.execArgv, script, "compare", "same-a.prg", "same-b.prg", "--frames", "10"], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const compared = JSON.parse(run.stdout) as { run: { releases: object; skipped?: string } };
  assert.deepEqual(compared.run.releases, {});
  assert.match(compared.run.skipped ?? "", /no differences/);
});
