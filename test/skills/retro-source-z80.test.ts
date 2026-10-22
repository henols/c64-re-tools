// The source of a ZX Spectrum program: sjasmplus text that gives the bytes of
// the snapshot in the knowledge again, with the files, the source map and
// not_executed.json of a C64 source, so that the documentation can link to it.
// Skipped when sjasmplus is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/cpu/coverage.ts";
import { Z80 } from "../../src/cpu/z80.ts";
import { findTool, SJASMPLUS } from "../../src/native/discover.ts";
import { renderZ80, sjasmplusExpression, z80Instructions } from "../../skills/retro-source/scripts/lib/z80-source.ts";
import { keyboardCounterSnapshot, z80Snapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(SJASMPLUS);
} catch {
  skip = "sjasmplus is not installed: run tools/install-sjasmplus.sh or set C64RT_SJASMPLUS";
}
const skills = resolve(import.meta.dirname, "../../skills");
const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-z80-source-"));
  mkdirSync(join(root, ".c64-re-tools", "local"), { recursive: true });
  roots.push(root);
  return root;
}

function run(root: string, skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: root, encoding: "utf8", timeout: 300_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}

const knowledge = (root: string, ...args: string[]) => assert.equal(run(root, "retro-knowledge", "knowledge.ts", ...args).status, 0, args.join(" "));

test("the source of the counter has its names and labels in its files, and gives all 48 KiB of the snapshot again", { skip, timeout: 300_000 }, () => {
  const root = project();
  writeFileSync(join(root, "counter.z80"), keyboardCounterSnapshot());
  for (const args of [["image", "counter.z80"], ["classify", "$8000-$8026", "code"], ["classify", "$8030-$8044", "code"], ["rename", "$8030", "count"], ["rename", "$9000", "presses"]]) knowledge(root, ...args);
  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src");
  assert.equal(generated.status, 0, JSON.stringify(generated.json));
  assert.deepEqual([generated.json.result, generated.json.instructions, generated.json.check], ["PASS", 27, { identical: true, segments: [{ start: "$4000", end: "$ffff", identical: true }] }]);
  assert.deepEqual(
    (generated.json.files as Array<{ out: string }>).map((file) => file.out),
    ["src/segments/segment_4000.asm", "src/constants.asm", "src/main.asm", ".c64-re-tools/local/generated/src/source-map.json"],
  );
  assert.equal(generated.json.sourceMap, ".c64-re-tools/local/generated/src/source-map.json");
  assert.match(readFileSync(join(root, "src", "main.asm"), "utf8"), /\tINCLUDE "constants.asm"\n\n\tORG \$4000\n\tINCLUDE "segments\/segment_4000.asm"\n$/);
  const text = readFileSync(join(root, "src", "segments", "segment_4000.asm"), "utf8");
  // $5c3a is an immediate value in ld iy,nn: a number, not the platform name ERR_NR.
  for (const line of ["\tds 16384,$00", "\tld iy,$5c3a", "l_8015:", "\tjr c,l_8015", "\tcall z,count", "count:", "\tld ix,presses", "presses:"]) assert.ok(text.includes(line), line);
  assert.doesNotMatch(readFileSync(join(root, "src", "constants.asm"), "utf8"), /ERR_NR/);
  const map = JSON.parse(readFileSync(join(root, ".c64-re-tools", "local", "generated", "src", "source-map.json"), "utf8")) as { space: string; labels: Array<{ name: string; file: string; line: number }> };
  const count = map.labels.find((label) => label.name === "count")!;
  assert.equal(map.space, "spectrum");
  assert.equal(readFileSync(join(root, "src", count.file), "utf8").split("\n")[count.line - 1], "count:");
  const loader = run(root, "retro-source", "source.ts", "generate", "--out", "src", "--loader");
  assert.equal(loader.status, 2);
  assert.match(loader.envelope.error!, /--loader works only for the C64/);
  const unknown = run(root, "retro-source", "source.ts", "generate", "--out", "src", "--entry", "zz");
  assert.equal(unknown.status, 2);
  assert.match(unknown.envelope.error!, /--entry: zz is not a name in the knowledge/);
});

test("an instruction that sjasmplus encodes in another way is written as db with its text", { skip, timeout: 300_000 }, () => {
  const root = project();
  const ram = new Uint8Array(0xc000);
  // $8000: ED 63 00 90 (ld ($9000),hl in its second encoding) ; RET
  ram.set([0xed, 0x63, 0x00, 0x90, 0xc9], 0x8000 - 0x4000);
  writeFileSync(join(root, "alt.z80"), z80Snapshot(ram, { pc: 0x8000, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 }));
  for (const args of [["image", "alt.z80"], ["classify", "$8000-$8004", "code"]]) knowledge(root, ...args);
  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src");
  assert.deepEqual([generated.json.result, generated.json.instructions, generated.json.asBytes], ["PASS", 1, { count: 1, listed: ["$8000"] }]);
  assert.match(readFileSync(join(root, "src", "segments", "segment_4000.asm"), "utf8"), /\tdb \$ed,\$63,\$00,\$90\t; ld \(\$9000\),hl\n\tret\n/);
});

// $8000 ld hl,$0000 ; ld de,$0020 ; call $028e ; ld hl,($5c3e) ; ld ($5c3d),hl
// $800f ld hl,$9002 ; ld a,$90 ; ld a,$02 ; jp $8019
// $8019 ret ; $801a ld a,$01 ; ret (the flow from --entry $801a)
const PLATFORM_CODE = [0x21, 0x00, 0x00, 0x11, 0x20, 0x00, 0xcd, 0x8e, 0x02, 0x2a, 0x3e, 0x5c, 0x22, 0x3d, 0x5c, 0x21, 0x02, 0x90, 0x3e, 0x90, 0x3e, 0x02, 0xc3, 0x19, 0x80, 0xc9, 0x3e, 0x01, 0xc9];

function platformProject(): string {
  const root = project();
  const ram = new Uint8Array(0xc000);
  ram.set(PLATFORM_CODE, 0x8000 - 0x4000);
  writeFileSync(join(root, "game.z80"), z80Snapshot(ram, { pc: 0x8000, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 }));
  for (const args of [["image", "game.z80"], ["classify", "$8000-$8019", "code"], ["rename", "$8000", "start"], ["rename", "$9002", "frames"]]) knowledge(root, ...args);
  return root;
}

test("a platform name names only an operand that is an address: an immediate value stays a number", { skip, timeout: 300_000 }, () => {
  const root = platformProject();
  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src");
  assert.equal(generated.json.result, "PASS", JSON.stringify(generated.json));
  const text = readFileSync(join(root, "src", "segments", "segment_4000.asm"), "utf8");
  for (const line of ["\tld hl,$0000\n", "\tld de,$0020\n", "\tcall KEY_SCAN\n", "\tld hl,(ERR_SP+1)\n", "\tld (ERR_SP),hl\n", "\tld hl,frames\n", "\tjp l_8019\n"]) assert.ok(text.includes(line), line);
  const constants = readFileSync(join(root, "src", "constants.asm"), "utf8");
  assert.match(constants, /^KEY_SCAN\tEQU \$028e\t; /m);
  assert.match(constants, /^ERR_SP\tEQU \$5c3d\t; /m);
  assert.doesNotMatch(constants, /START|NEXT_CHAR/);
});

test("the source writes the operand expressions, the modules and the marks of the code that no run executed, and the documentation links to it", { skip, timeout: 300_000 }, () => {
  const root = platformProject();
  for (const args of [
    ["operand", "$800f", "--expr", "frames"],
    ["operand", "$8012", "--hi", "frames"],
    ["operand", "$8014", "--lo", "frames"],
    ["module", "$800f", "logic/frames.asm", "--title", "The frame counter"],
  ]) knowledge(root, ...args);
  // A run executed $8000-$800e: the rest of the code did not run.
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x8000, 0x8003, 0x8006, 0x8009, 0x800c]) coverage[address] = COVERAGE.ramExecute;
  writeFileSync(join(root, "run.bin"), coverage);
  knowledge(root, "coverage", "run.bin");
  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src", "--entry", "$801a");
  assert.equal(generated.json.result, "PASS", JSON.stringify(generated.json));
  assert.equal(generated.json.operandExpressions, 3);
  assert.deepEqual(generated.json.notExecuted, { instructions: 7, count: 1, listed: [{ start: "$800f", end: "$801c" }] });
  const module = readFileSync(join(root, "src", "logic", "frames.asm"), "utf8");
  assert.ok(module.includes("; The frame counter\n; $800f-$ffff\n"), module);
  for (const line of ["; not executed $800f-$801c\n\tld hl,frames\n", "\tld a,high (frames)\n", "\tld a,low (frames)\n", "\tret\n\tld a,$01\n\tret\n"]) assert.ok(module.includes(line), line);
  assert.match(readFileSync(join(root, "src", "main.asm"), "utf8"), /\tINCLUDE "segments\/segment_4000.asm"\n\tINCLUDE "logic\/frames.asm"\n$/);
  const report = JSON.parse(readFileSync(join(root, ".c64-re-tools", "local", "generated", "src", "not_executed.json"), "utf8")) as Record<string, unknown>;
  assert.deepEqual([report.instructions, report.files], [7, { "logic/frames.asm": 1 }]);

  // The documentation of the Spectrum program: the reference and the links to the source.
  const reference = run(root, "retro-docs", "docs.ts", "generate", "src", "--out", "docs/reference");
  assert.equal(reference.status, 0, JSON.stringify(reference.json));
  assert.ok(existsSync(join(root, "docs", "reference", "modules", "logic", "frames.md")));
  writeFileSync(join(root, "README.md"), "# Game\n\nThe counter `frames` `$9002` counts the frames.\n");
  const linked = run(root, "retro-docs", "docs.ts", "link", "README.md", "docs", "--source", "src");
  assert.equal(linked.json.result, "PASS", JSON.stringify(linked.json));
  assert.match(readFileSync(join(root, "README.md"), "utf8"), /\[`frames` `\$9002`\]\(src\/logic\/frames\.asm#L\d+\)/);

  // A generation without the module removes the module file of the earlier run.
  knowledge(root, "unmodule", "$800f");
  const again = run(root, "retro-source", "source.ts", "generate", "--out", "src");
  assert.equal(again.json.result, "PASS");
  assert.ok((again.json.removed as string[]).includes("src/logic/frames.asm"), JSON.stringify(again.json.removed));
  assert.equal(existsSync(join(root, "src", "logic")), false);
});

test("an operand expression of the knowledge is written in the syntax of sjasmplus", () => {
  assert.equal(sjasmplusExpression("<table+1"), "low (table+1)");
  assert.equal(sjasmplusExpression(">(table+$100) | 1"), "high ((table+$100))|1");
  assert.equal(sjasmplusExpression("<a & $0f"), "low (a)&$0f");
  assert.equal(sjasmplusExpression("a XOR !b"), "a ^ ~b");
  assert.equal(sjasmplusExpression("buffer - 1"), "buffer-1");
  assert.equal(sjasmplusExpression("(a << 2) >> 1"), "(a<<2)>>1");
});

test("an operand expression that sjasmplus refuses or assembles to other bytes is a number with its reason, and a platform name in an expression gets its EQU", () => {
  // $8000 ld hl,$5c3d ; ld a,$5c ; ret
  const bytes = new Map([0x21, 0x3d, 0x5c, 0x3e, 0x5c, 0xc9].map((value, offset) => [0x8000 + offset, value]));
  const input = {
    segments: [{ start: 0x8000, end: 0x8005 }],
    byteAt: (address: number) => bytes.get(address) ?? 0,
    cpu: Z80,
    symbols: [],
    regions: [{ start: 0x8000, end: 0x8005, type: "code" }],
    comments: [],
    platform: [{ address: 0x5c3d, end: 0x5c3e, name: "ERR_SP", meaning: "The error return." }],
    operands: [
      { address: 0x8000, select: "value" as const, symbol: "ERR_SP" },
      { address: 0x8003, select: "hi" as const, symbol: "ERR_SP" },
    ],
    header: [],
  };
  const instructions = z80Instructions(input);
  const encoded = new Set(instructions.map((instruction) => instruction.address));
  const written = renderZ80(input, instructions, encoded);
  const text = written.files.find((file) => file.name === "segments/segment_8000.asm")!.text;
  assert.match(text, /\tld hl,ERR_SP\n\tld a,high \(ERR_SP\)\n/);
  assert.match(written.files.find((file) => file.name === "constants.asm")!.text, /^ERR_SP\tEQU \$5c3d\t; The error return\.$/m);
  assert.deepEqual(written.expressions.map((item) => item.address), [0x8000, 0x8003]);
  const blamed = renderZ80(input, instructions, encoded, new Map([[0x8003, "The expression gives other bytes than the program."]]));
  assert.match(blamed.files.find((file) => file.name === "segments/segment_8000.asm")!.text, /\tld a,\$5c\t; = >ERR_SP\n/);
  assert.deepEqual(blamed.operandsAsNumbers, [{ address: 0x8003, expression: ">ERR_SP", reason: "The expression gives other bytes than the program." }]);
});
