// The c64-provenance comparison: differences, agreeing groups and alignment.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { compareReleases, suggestShift } from "../../skills/c64-provenance/scripts/compare.ts";
import { separate } from "../../skills/c64-provenance/scripts/separate.ts";
import { seededBytes } from "../kit.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-provenance-"));
after(() => rmSync(project, { recursive: true, force: true }));

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
  assert.deepEqual(suggestShift(at("release", 0x0801, base), at("moved", 0x0901, base)), { shift: -256, matches: 2041 });
});

test("the script compares PRG files and applies a shift", () => {
  const prg = (start: number, bytes: Uint8Array) => Buffer.concat([Buffer.from([start & 0xff, start >> 8]), bytes]);
  writeFileSync(join(project, "release.prg"), prg(0x0801, base));
  writeFileSync(join(project, "moved.prg"), prg(0x0901, base));
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const loose = spawnSync(process.execPath, [...process.execArgv, script, "release.prg", "moved.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(loose.status, 0, loose.stdout + loose.stderr);
  const unaligned = JSON.parse(loose.stdout) as { identicalShare: number; suggestedShifts: Array<{ release: number; shift: number }> };
  assert.ok(unaligned.identicalShare < 0.5);
  assert.deepEqual(unaligned.suggestedShifts.map((item) => [item.release, item.shift]), [[2, -256]]);
  const aligned = JSON.parse(spawnSync(process.execPath, [...process.execArgv, script, "release.prg", "moved.prg", "--shift", "2:-256"], { cwd: project, encoding: "utf8" }).stdout) as Record<string, unknown>;
  assert.equal(aligned.differingBytes, 0);
  assert.equal(aligned.identicalShare, 1);
  const bad = spawnSync(process.execPath, [...process.execArgv, script, "release.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(bad.status, 2);
});

test("a missing release is not-found", () => {
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  writeFileSync(join(project, "one.prg"), Buffer.from([0x01, 0x08, 0xea]));
  const missing = spawnSync(process.execPath, [...process.execArgv, script, "one.prg", "missing.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  assert.equal((JSON.parse(missing.stdout) as { error: { code: string } }).error.code, "not-found");
});

test("an image release counts only inside its segments, and a common range never joins across a gap (D50)", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(base.subarray(0, 0x100), 0x0801);
  memory.set(base.subarray(0x200, 0x300), 0x0a01);
  mkdirSync(join(project, "unpacked"), { recursive: true });
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ image: "image.bin", segments: [{ start: "$0801", end: "$0900" }, { start: "$0a01", end: "$0b00" }] }));
  writeFileSync(join(project, "whole.prg"), Buffer.concat([Buffer.from([0x01, 0x08]), crackA]));
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "unpacked/image.json", "whole.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as { common: unknown; differences: Array<{ start: string; end: string }>; identicalBytes: number };
  assert.deepEqual(result.common, [{ start: "$0801", end: "$0900" }, { start: "$0a01", end: "$0b00" }]);
  assert.deepEqual(result.differences.map((difference) => [difference.start, difference.end]), [["$0900", "$0900"]], "the patch at $0900-$0902 counts only where the image has bytes");
  const steps = spawnSync(process.execPath, [...process.execArgv, script, "unpacked/image.json", "whole.prg", "--steps", "s.json"], { cwd: project, encoding: "utf8" });
  assert.equal(steps.status, 2, "--steps needs --run");
});

test("separate gives each range its stage and access, each code region its reachability, and what runs outside the image (D51)", () => {
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

test("the separate command reads an image with its stages and writes all ranges to --out", () => {
  const memory = new Uint8Array(0x10000);
  memory.fill(0xea, 0x2000, 0x20ff);
  mkdirSync(join(project, "one"), { recursive: true });
  writeFileSync(join(project, "one", "image.bin"), memory);
  writeFileSync(
    join(project, "one", "image.json"),
    JSON.stringify({ entry: "$2000", image: "image.bin", segments: [{ start: "$2000", end: "$20ff" }], stages: [{ stage: 0, entry: "$0810", wrote: [{ start: "$2000", end: "$207f" }] }, { stage: 1, entry: "$2000", wrote: [{ start: "$2080", end: "$20ff" }] }] }),
  );
  writeFileSync(join(project, "one", "cov.bin"), new Uint8Array(0x10000));
  const script = resolve(import.meta.dirname, "../../skills/c64-provenance/scripts/provenance.ts");
  const run = spawnSync(process.execPath, [...process.execArgv, script, "separate", "one/image.json", "--coverage", "one/cov.bin", "--out", "one/separate.json", "--max-listed", "1"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, any>;
  assert.deepEqual(result.bytesByStage, { 0: 128, 1: 128, none: 0 });
  assert.equal(result.bytesByAccess.untouched, 256);
  assert.equal(result.ranges.count, 2);
  assert.equal(result.ranges.listed.length, 1);
  assert.equal((JSON.parse(readFileSync(join(project, "one", "separate.json"), "utf8")) as { ranges: unknown[] }).ranges.length, 2);
  assert.equal(spawnSync(process.execPath, [...process.execArgv, script, "separate", "one/image.json", "--run", "5"], { cwd: project, encoding: "utf8" }).status, 2);
});
