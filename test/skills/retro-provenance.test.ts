// The retro-provenance comparison: differences, agreeing groups and alignment.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/cpu/coverage.ts";
import { formatAddress } from "../../src/address.ts";
import { align, compareReleases, identicalShare, shiftSuggestion, suggestShifts } from "../../skills/retro-provenance/scripts/lib/compare.ts";
import { separate } from "../../src/knowledge/separate.ts";
import { readEnvelope, seededBytes } from "../kit.ts";
import { importCoverage, importImage } from "../fixtures/program.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-provenance-"));
const programs: string[] = [];
after(() => {
  rmSync(project, { recursive: true, force: true });
  for (const root of programs) rmSync(root, { recursive: true, force: true });
});

const script = resolve(import.meta.dirname, "../../skills/retro-provenance/scripts/provenance.ts");

/** Runs the script in `cwd`: the exit status, the envelope, and json (the body, or { error: { code, message } }). */
function provenance(args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const spawned = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd, encoding: "utf8", ...(env === undefined ? {} : { env }) });
  return { status: spawned.status, stdout: spawned.stdout, stderr: spawned.stderr, ...readEnvelope(spawned.stdout, spawned.status) };
}

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
  const run = provenance(["compare", "stay.prg", "grow.prg"], project);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = run.json as { identicalShare: number; suggestedShifts: Array<{ release: number; shift: number; current?: true }> };
  assert.ok(result.identicalShare < 0.5);
  assert.deepEqual(result.suggestedShifts.map((item) => [item.release, item.shift, item.current ?? false]), [[2, -256, false], [2, 0, true]]);
  // The next compare takes the first suggested shift that the run does not have.
  assert.match(run.envelope.hint ?? "", /^identicalShare is low/);
  assert.match(run.envelope.nextAction ?? "", /^node \/\S*provenance\.ts compare stay\.prg grow\.prg --shift 2:-256 --project \//);
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
  const aligned = provenance(["compare", "release.prg", "moved.prg", "--shift", "2:-256"], project).json as Record<string, unknown>;
  assert.equal(aligned.differingBytes, 0);
  assert.equal(aligned.identicalShare, 1);
  assert.deepEqual((aligned.releases as Array<{ shift: number }>).map((item) => item.shift), [0, -256]);
  const twice = provenance(["compare", "release.prg", "moved.prg", "--shift", "2:-256", "--shift", "2:256"], project);
  assert.equal(twice.status, 2, twice.stdout);
  const { error } = twice.json as { error: { code: string; message: string } };
  assert.equal(error.code, "invalid-input");
  assert.match(error.message, /^--shift gives release 2 more than one shift \(-256 and 256\)\. Give one --shift for each release/);
  const refused = (args: string[]) => {
    const run = provenance(["compare", ...args], project);
    assert.equal(run.status, 2, run.stdout);
    return run.json.error as { code: string; message: string };
  };
  const third = refused(["release.prg", "moved.prg", "--shift", "3:-1280"]);
  assert.equal(third.code, "invalid-input");
  assert.match(third.message, /^--shift 3:-1280: there is no release 3\. This compare has 2 releases: give a release number from 1 to 2\./);
  assert.match(refused(["release.prg", "moved.prg", "--shift", "2-256"]).message, /^--shift must be <release>:<bytes>, for example 2:-256, not 2-256\./);
  // A bare negative number is not taken as an option: the message gives the form with that number, not --shift=-1280.
  assert.match(refused(["release.prg", "moved.prg", "--shift", "-1280"]).message, /^--shift needs a value of the form <release>:<bytes>: give --shift <release>:<bytes>, for example --shift 2:-1280, not -1280/);
});

// Two builds of one game: X M Y R Z, and X I Y M Z. I is inserted, R is removed, and M moved past Y.
const part = { x: seededBytes(0x1001, 256), m: seededBytes(0x1002, 64), y: seededBytes(0x1003, 512), r: seededBytes(0x1004, 24), z: seededBytes(0x1005, 256), i: seededBytes(0x1006, 32) };
const buildA = Buffer.concat([part.x, part.m, part.y, part.r, part.z]);
const buildB = Buffer.concat([part.x, part.i, part.y, part.m, part.z]);

test("align maps two builds in blocks with their own shifts: a moved block crosses, an inserted and a removed block are in no block", () => {
  const result = align(at("a", 0x1000, buildA), at("b", 0x1000, buildB), { start: 0x0000, end: 0xffff }, 16);
  assert.deepEqual(
    result.blocks.map((block) => [block.a.start, block.a.end, block.b.start, block.b.end, block.shift, block.bytes]),
    [
      [0x1000, 0x10ff, 0x1000, 0x10ff, 0, 256],
      [0x1100, 0x113f, 0x1320, 0x135f, 0x220, 64],
      [0x1140, 0x133f, 0x1120, 0x131f, -32, 512],
      [0x1358, 0x1457, 0x1360, 0x145f, 8, 256],
    ],
  );
  assert.deepEqual(result.onlyInA, [{ start: 0x1340, end: 0x1357 }]);
  assert.deepEqual(result.onlyInB, [{ start: 0x1100, end: 0x111f }]);
  assert.equal(result.alignedShare, identicalShare(2 * 1088, 24 + 32));
  // --min-block drops a short block: M is then removed in a and inserted in b.
  const long = align(at("a", 0x1000, buildA), at("b", 0x1000, buildB), { start: 0x0000, end: 0xffff }, 100);
  assert.deepEqual(long.blocks.map((block) => block.shift), [0, -32, 8]);
  assert.deepEqual(long.onlyInA, [{ start: 0x1100, end: 0x113f }, { start: 0x1340, end: 0x1357 }]);
  assert.deepEqual(long.onlyInB, [{ start: 0x1100, end: 0x111f }, { start: 0x1320, end: 0x135f }]);
  // Only the bytes in the range count.
  assert.deepEqual(align(at("a", 0x1000, buildA), at("b", 0x1000, buildB), { start: 0x1000, end: 0x10ff }, 16).blocks.map((block) => [block.a.start, block.a.end, block.shift]), [[0x1000, 0x10ff, 0]]);
});

test("compare --align maps two image.json files, and refuses --shift, and --min-block without --align", () => {
  const image = (folder: string, bytes: Uint8Array) => {
    const memory = new Uint8Array(0x10000);
    memory.set(bytes, 0x1000);
    mkdirSync(join(project, folder), { recursive: true });
    writeFileSync(join(project, folder, "image.bin"), memory);
    writeFileSync(join(project, folder, "image.json"), JSON.stringify({ image: "image.bin", segments: [{ start: "$1000", end: formatAddress(0x1000 + bytes.length - 1) }] }));
  };
  image("build-a", buildA);
  image("build-b", buildB);
  const compare = (args: string[]) => provenance(["compare", "build-a/image.json", "build-b/image.json", ...args], project);
  const run = compare(["--align"]);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = run.json as Record<string, any>;
  assert.deepEqual(result.blocks[1], { a: { start: "$1100", end: "$113f" }, b: { start: "$1320", end: "$135f" }, shift: 544, bytes: 64 });
  assert.equal(result.blocks.length, 4);
  assert.deepEqual(result.onlyInA, [{ start: "$1340", end: "$1357" }]);
  assert.deepEqual(result.onlyInB, [{ start: "$1100", end: "$111f" }]);
  assert.equal(result.alignedShare, 0.975);
  assert.ok(result.identicalShare < 0.5, "the same addresses differ after the inserted block");
  assert.equal(result.suggestedShifts, undefined, "no shift suggestions in align mode");
  assert.equal(result.differences, undefined);
  const ranged = compare(["--align", "--min-block", "100", "--range", "$1100-$13ff"]).json as Record<string, any>;
  assert.deepEqual(ranged.blocks.map((block: { shift: number }) => block.shift), [-32, 8], "M is too short, and Z is cut at the end of the range");
  const refused = (args: string[]) => {
    const failed = compare(args);
    assert.equal(failed.status, 2, failed.stdout);
    return (failed.json as { error: { code: string; message: string } }).error;
  };
  assert.match(refused(["--align", "--shift", "2:-32"]).message, /^--align does not work with --shift/);
  assert.match(refused(["--min-block", "20"]).message, /^--min-block works only with --align/);
});

test("compare refuses an unknown name in the steps before an emulator starts", () => {
  writeFileSync(join(project, "one.prg"), Buffer.from([0x01, 0x08, 0xea]));
  // An unknown name in the steps stops the call before an emulator starts (no host listens at port 1).
  writeFileSync(join(project, "name.json"), JSON.stringify([{ runUntil: { target: { kind: "address", address: "nonsense" } } }]));
  const named = provenance(["compare", "one.prg", "one.prg", "--frames", "10", "--steps", "name.json"], project, { ...process.env, C64RT_HOST: "127.0.0.1:1" });
  assert.equal(named.status, 2, named.stdout);
  assert.equal(named.json.error.code, "invalid-input");
  assert.match(named.json.error.message, /^--steps name\.json: step 1: nonsense is not a name in the knowledge/);
});

test("an image release counts only inside its segments, and a common range never joins across a gap", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(base.subarray(0, 0x100), 0x0801);
  memory.set(base.subarray(0x200, 0x300), 0x0a01);
  mkdirSync(join(project, "unpacked"), { recursive: true });
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ image: "image.bin", segments: [{ start: "$0801", end: "$0900" }, { start: "$0a01", end: "$0b00" }] }));
  writeFileSync(join(project, "whole.prg"), Buffer.concat([Buffer.from([0x01, 0x08]), crackA]));
  const run = provenance(["compare", "unpacked/image.json", "whole.prg"], project);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = run.json as { common: unknown; differences: Array<{ start: string; end: string }>; identicalBytes: number };
  assert.deepEqual(result.common, [{ start: "$0801", end: "$0900" }, { start: "$0a01", end: "$0b00" }]);
  assert.deepEqual(result.differences.map((difference) => [difference.start, difference.end]), [["$0900", "$0900"]], "the patch at $0900-$0902 counts only where the image has bytes");
  const steps = provenance(["compare", "unpacked/image.json", "whole.prg", "--steps", "s.json"], project);
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
  const run = provenance(["separate", "--out", "separate.json", "--max-listed", "1"], root);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = run.json as Record<string, any>;
  assert.deepEqual(result.bytesByStage, { 0: 128, 1: 128, none: 0 });
  assert.equal(result.bytesByAccess.untouched, 256);
  assert.equal(result.ranges.count, 2);
  assert.equal(result.ranges.listed.length, 1);
  assert.equal(result.ranges.rest, "separate.json");
  assert.match(run.envelope.hint ?? "", /cut: count gives its full size\. separate\.json holds all items\./);
  assert.equal(result.outside.generated.count, 3);
  assert.deepEqual(result.outside.generated.listed, [{ start: "$c000", end: "$c000" }], "--max-listed caps the outside lists too");
  assert.deepEqual(result.outside.read, { count: 0, listed: [] });
  assert.deepEqual(result.codeRegions, { total: 0, unreachable: { count: 0, listed: [] } }, "unreachable is a list like the others");
  const written = JSON.parse(readFileSync(join(root, "separate.json"), "utf8")) as { ranges: unknown[]; outside: { generated: unknown[] } };
  assert.equal(written.ranges.length, 2);
  assert.equal(written.outside.generated.length, 3);
});

test("separate says when the program has no stage log, and a run of releases without differences says why nothing ran", () => {
  const memory = new Uint8Array(0x10000);
  memory.fill(0xea, 0x3000, 0x30ff);
  const root = fresh();
  importImage(root, memory, { segments: [{ start: 0x3000, end: 0x30ff }], entry: 0x3000 });
  const separated = provenance(["separate"], root);
  assert.equal(separated.status, 0, separated.stdout + separated.stderr);
  const result = separated.json as Record<string, unknown>;
  assert.match(String(result.noStages), /no stage log/);
  assert.equal(result.bytesByStage, undefined);

  const prg = Buffer.concat([Buffer.from([0x01, 0x08]), base]);
  writeFileSync(join(project, "same-a.prg"), prg);
  writeFileSync(join(project, "same-b.prg"), prg);
  // No difference: no emulator starts, so no host is needed.
  const run = provenance(["compare", "same-a.prg", "same-b.prg", "--frames", "10"], project, { ...process.env, C64RT_HOST: "127.0.0.1:1" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const compared = run.json as { run: { releases: object; skipped?: string } };
  assert.deepEqual(compared.run.releases, {});
  assert.match(compared.run.skipped ?? "", /no differences/);
});

test("separate starts the reachability at the entry and at each hardware vector in the image, and names the roots", () => {
  const memory = new Uint8Array(0x10000);
  memory.set([0x60], 0x1000); // the entry: RTS
  memory.set([0x40], 0x1100); // the IRQ handler: RTI, which no call or jump reaches
  memory.set([0x00, 0x12, 0x00, 0x10, 0x00, 0x11], 0xfffa); // NMI $1200, RESET $1000, IRQ $1100
  const region = (start: number, end: number) => ({ start, end, type: "code" });
  const codeRegions = [region(0x1000, 0x1000), region(0x1100, 0x1100)];
  const withVectors = separate({ segments: [{ start: 0x1000, end: 0x1100 }, { start: 0xfffa, end: 0xffff }], memory, entry: 0x1000, codeRegions, references: [] });
  assert.deepEqual(withVectors.roots, [
    { address: 0x1000, from: "entry" },
    { address: 0x1200, from: "NMI vector $fffa" },
    { address: 0x1000, from: "RESET vector $fffc" },
    { address: 0x1100, from: "IRQ vector $fffe" },
  ]);
  assert.deepEqual(withVectors.codeRegions.map((item) => [item.start, item.reachable]), [[0x1000, true], [0x1100, true]], "the IRQ handler is reachable by its vector");
  // Without the vectors in the image, only the entry is a root.
  const withoutVectors = separate({ segments: [{ start: 0x1000, end: 0x1100 }, { start: 0xfffa, end: 0xfffe }], memory, entry: 0x1000, codeRegions, references: [] });
  assert.deepEqual(withoutVectors.roots, [{ address: 0x1000, from: "entry" }, { address: 0x1200, from: "NMI vector $fffa" }, { address: 0x1000, from: "RESET vector $fffc" }], "the IRQ vector needs both of its bytes in the image");
  assert.deepEqual(withoutVectors.codeRegions.map((item) => [item.start, item.reachable]), [[0x1000, true], [0x1100, false]]);
  // No entry, but the vectors: the reachability starts at the vectors.
  const noEntry = separate({ segments: [{ start: 0x1000, end: 0x1100 }, { start: 0xfffa, end: 0xffff }], memory, codeRegions, references: [] });
  assert.deepEqual(noEntry.codeRegions.map((item) => [item.start, item.reachable]), [[0x1000, true], [0x1100, true]]);
  // No root at all: no reachability.
  const none = separate({ segments: [{ start: 0x1000, end: 0x1100 }], memory, codeRegions, references: [] });
  assert.deepEqual(none.roots, []);
  assert.equal(none.codeRegions[0]!.reachable, undefined);
});

test("the separate command names the roots of the reachability in the result and in --out", () => {
  const memory = new Uint8Array(0x10000);
  memory.fill(0xea, 0x2000, 0x20ff);
  memory.set([0x00, 0x20, 0x00, 0x20, 0x80, 0x20], 0xfffa);
  const root = fresh();
  importImage(root, memory, { segments: [{ start: 0x2000, end: 0x20ff }, { start: 0xfffa, end: 0xffff }], entry: 0x2000 });
  const run = provenance(["separate", "--out", "separate.json"], root);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const roots = [
    { address: "$2000", from: "entry" },
    { address: "$2000", from: "NMI vector $fffa" },
    { address: "$2000", from: "RESET vector $fffc" },
    { address: "$2080", from: "IRQ vector $fffe" },
  ];
  assert.deepEqual((run.json as { roots: unknown }).roots, roots);
  assert.deepEqual((JSON.parse(readFileSync(join(root, "separate.json"), "utf8")) as { roots: unknown }).roots, roots);
});

test("the identical share is 1 only when no byte differs, and 0 only when no byte is identical", () => {
  assert.deepEqual(
    [identicalShare(35974, 1), identicalShare(10, 0), identicalShare(0, 10), identicalShare(0, 0), identicalShare(1, 35974), identicalShare(29, 71)],
    [0.999, 1, 0, 0, 0.001, 0.29],
  );
});
