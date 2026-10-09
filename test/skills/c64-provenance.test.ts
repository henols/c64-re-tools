// The c64-provenance comparison: differences, agreeing groups and alignment.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { compareReleases, suggestShift } from "../../skills/c64-provenance/scripts/compare.ts";
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

test("differences show the bytes of each release and which releases agree", () => {
  const releases = [
    { name: "release", start: 0x0801, bytes: base },
    { name: "crack-a", start: 0x0801, bytes: crackA },
    { name: "crack-b", start: 0x0801, bytes: crackB },
  ];
  const result = compareReleases(releases);
  assert.deepEqual(result.common, { start: 0x0801, end: 0x0801 + 2047 });
  assert.equal(result.differingBytes, 4);
  assert.deepEqual(result.differences.map((difference) => [difference.start, difference.end, difference.groups]), [
    [0x0900, 0x0902, [["release", "crack-b"], ["crack-a"]]],
    [0x0a00, 0x0a00, [["release", "crack-a"], ["crack-b"]]],
  ]);
  assert.deepEqual(result.differences[0]!.values["crack-a"], patch);
  assert.equal(compareReleases(releases, { from: 0x0a00, to: 0x0aff }).differingBytes, 1);
});

test("a release at another address gets a suggested shift", () => {
  const moved = { name: "moved", start: 0x0901, bytes: base };
  assert.deepEqual(suggestShift({ name: "release", start: 0x0801, bytes: base }, moved), { shift: -256, matches: 2041 });
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
