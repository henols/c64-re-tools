// The source of a ZX Spectrum program: sjasmplus text that gives the bytes of
// the snapshot in the knowledge again, with the files, the source map and
// not_executed.json of a C64 source, so that the documentation can link to it.
// The rules of the text are calls of the lib; the build and the end-to-end flow
// are skipped when sjasmplus is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/cpu/coverage.ts";
import { Z80 } from "../../src/cpu/z80.ts";
import { MACHINES } from "../../src/machine.ts";
import { findTool, SJASMPLUS } from "../../src/native/discover.ts";
import { platformNamesOfSpace } from "../../src/platform.ts";
import { refuseC64Work, renderZ80, sjasmplusExpression, z80Instructions, z80Source, type Z80SourceInput } from "../../skills/retro-source/scripts/lib/z80-source.ts";
import { importCoverage } from "../fixtures/program.ts";
import { z80Snapshot } from "../fixtures/z80/keyboard-counter.ts";
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

function run(root: string, skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: root, encoding: "utf8", timeout: 300_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}

// $8000 ld hl,$0000 ; ld de,$0020 ; call $028e ; ld hl,($5c3e) ; ld ($5c3d),hl
// $800f ld hl,$9002 ; ld a,$90 ; ld a,$02 ; jp $8019
// $8019 ret ; $801a ld a,$01 ; ret (the flow from --entry $801a)
const PLATFORM_CODE = [0x21, 0x00, 0x00, 0x11, 0x20, 0x00, 0xcd, 0x8e, 0x02, 0x2a, 0x3e, 0x5c, 0x22, 0x3d, 0x5c, 0x21, 0x02, 0x90, 0x3e, 0x90, 0x3e, 0x02, 0xc3, 0x19, 0x80, 0xc9, 0x3e, 0x01, 0xc9];

test("a platform name names only an operand that is an address and gets its EQU; an immediate value stays a number unless the knowledge names it", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(PLATFORM_CODE, 0x8000);
  const input: Z80SourceInput = {
    segments: [{ start: 0x4000, end: 0xffff }],
    byteAt: (address) => memory[address]!,
    cpu: Z80,
    symbols: [{ address: 0x8000, name: "start" }, { address: 0x9002, name: "frames" }],
    regions: [{ start: 0x8000, end: 0x8019, type: "code" }],
    comments: [],
    platform: platformNamesOfSpace("spectrum"),
    header: [],
  };
  const instructions = z80Instructions(input);
  const rendered = renderZ80(input, instructions, new Set(instructions.map((instruction) => instruction.address)));
  const file = (name: string) => rendered.files.find((item) => item.name === name)!.text;
  const text = file("segments/segment_4000.asm");
  for (const line of ["\tds 16384,$00\n", "\tld hl,$0000\n", "\tld de,$0020\n", "\tcall KEY_SCAN\n", "\tld hl,(ERR_SP+1)\n", "\tld (ERR_SP),hl\n", "\tld hl,frames\n", "\tjp l_8019\n"]) assert.ok(text.includes(line), line);
  const constants = file("constants.asm");
  assert.match(constants, /^KEY_SCAN\tEQU \$028e\t; /m);
  assert.match(constants, /^ERR_SP\tEQU \$5c3d\t; /m);
  assert.doesNotMatch(constants, /START|NEXT_CHAR/);
  assert.match(file("main.asm"), /\tINCLUDE "constants.asm"\n\n\tORG \$4000\n\tINCLUDE "segments\/segment_4000.asm"\n$/);
});

test("an operand expression of the knowledge is written in the syntax of sjasmplus", () => {
  assert.equal(sjasmplusExpression("<table+1"), "low (table+1)");
  assert.equal(sjasmplusExpression(">(table+$100) | 1"), "high ((table+$100))|1");
  assert.equal(sjasmplusExpression("<a & $0f"), "low (a)&$0f");
  assert.equal(sjasmplusExpression("a XOR !b"), "a ^ ~b");
  assert.equal(sjasmplusExpression("buffer - 1"), "buffer-1");
  assert.equal(sjasmplusExpression("(a << 2) >> 1"), "(a<<2)>>1");
});

test("the source of a Z80 program refuses the loader, and the patches, switches and macro uses that only the C64 source writes", () => {
  const none = { patches: [], switches: [], macroUses: [] };
  refuseC64Work(MACHINES.spectrum48, false, none);
  assert.throws(() => refuseC64Work(MACHINES.spectrum48, true, none), { code: "invalid-input", message: /^--loader works only for the C64/ });
  assert.throws(() => refuseC64Work(MACHINES.spectrum48, false, { ...none, switches: [{}] }), { code: "invalid-input", message: /^The knowledge has switches, which the source of a Z80 program does not write/ });
});

test("an instruction that sjasmplus encodes in another way is db with its text, and an operand expression that gives other bytes is its number with the reason", { skip, timeout: 120_000 }, async () => {
  // $8000 ld ($9000),hl in its second encoding ED 63 ; $8004 ld hl,$5c3d ; $8007 ld a,$5c ; $8009 ret
  const memory = new Uint8Array(0x10000);
  memory.set([0xed, 0x63, 0x00, 0x90, 0x21, 0x3d, 0x5c, 0x3e, 0x5c, 0xc9], 0x8000);
  const input: Z80SourceInput = {
    segments: [{ start: 0x8000, end: 0x8009 }],
    byteAt: (address) => memory[address]!,
    cpu: Z80,
    symbols: [],
    regions: [{ start: 0x8000, end: 0x8009, type: "code" }],
    comments: [],
    platform: [{ address: 0x5c3d, end: 0x5c3e, name: "ERR_SP", meaning: "The error return." }],
    // The low byte of ERR_SP is $3d, not the $5c of the program.
    operands: [
      { address: 0x8004, select: "value", symbol: "ERR_SP" },
      { address: 0x8007, select: "lo", symbol: "ERR_SP" },
    ],
    header: [],
  };
  const { rendered, built } = await z80Source(input, z80Instructions(input), "48k", { mark: "; the mark", rounds: 6 });
  assert.ok(!("diagnostics" in built), JSON.stringify(built));
  assert.deepEqual([...built.memory.subarray(0x8000, 0x800a)], [...memory.subarray(0x8000, 0x800a)]);
  assert.deepEqual(rendered.asBytes, [0x8000]);
  assert.match(rendered.files.find((file) => file.name === "segments/segment_8000.asm")!.text, /\tdb \$ed,\$63,\$00,\$90\t; ld \(\$9000\),hl\n\tld hl,ERR_SP\n\tld a,\$5c\t; = <ERR_SP\n\tret\n/);
  assert.match(rendered.files.find((file) => file.name === "constants.asm")!.text, /^ERR_SP\tEQU \$5c3d\t; The error return\.$/m);
  assert.deepEqual(rendered.operandsAsNumbers.map((item) => [item.address, item.expression]), [[0x8007, "<ERR_SP"]]);
  assert.match(rendered.operandsAsNumbers[0]!.reason, /gives other bytes than the program/);
});

test("the source of a snapshot gives all its bytes again with the operand expressions, the modules and the marks of the code that no run executed, and the documentation links to it", { skip, timeout: 300_000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-z80-source-"));
  mkdirSync(join(root, ".c64-re-tools", "local"), { recursive: true });
  roots.push(root);
  const ram = new Uint8Array(0xc000);
  ram.set(PLATFORM_CODE, 0x8000 - 0x4000);
  writeFileSync(join(root, "game.z80"), z80Snapshot(ram, { pc: 0x8000, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 }));
  assert.equal(run(root, "retro-knowledge", "knowledge.ts", "image", "game.z80").status, 0);
  writeFileSync(
    join(root, "batch.json"),
    JSON.stringify([
      { op: "classify", start: "$8000", end: "$8019", type: "code" },
      { op: "rename", address: "$8000", name: "start" },
      { op: "rename", address: "$9002", name: "frames" },
      { op: "operand", address: "$800f", select: "expr", expression: "frames" },
      { op: "operand", address: "$8012", select: "hi", symbol: "frames" },
      { op: "operand", address: "$8014", select: "lo", symbol: "frames" },
      { op: "module", start: "$800f", file: "logic/frames.asm", title: "The frame counter" },
    ]),
  );
  const applied = run(root, "retro-knowledge", "knowledge.ts", "apply", "batch.json");
  assert.equal(applied.status, 0, JSON.stringify(applied.json));
  // A run executed $8000-$800e: the rest of the code did not run.
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x8000, 0x8003, 0x8006, 0x8009, 0x800c]) coverage[address] = COVERAGE.ramExecute;
  importCoverage(root, { "run.bin": coverage });

  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src", "--entry", "$801a");
  assert.equal(generated.json.result, "PASS", JSON.stringify(generated.json));
  assert.deepEqual(generated.json.check, { identical: true, segments: [{ start: "$4000", end: "$ffff", identical: true }] });
  assert.equal(generated.json.sourceMap, ".c64-re-tools/local/generated/src/source-map.json");
  assert.equal(generated.json.operandExpressions, 3);
  assert.deepEqual(generated.json.notExecuted, { instructions: 7, count: 1, listed: [{ start: "$800f", end: "$801c" }] });
  const module = readFileSync(join(root, "src", "logic", "frames.asm"), "utf8");
  assert.ok(module.includes("; The frame counter\n; $800f-$ffff\n"), module);
  for (const line of ["; not executed $800f-$801c\n\tld hl,frames\n", "\tld a,high (frames)\n", "\tld a,low (frames)\n", "\tret\n\tld a,$01\n\tret\n"]) assert.ok(module.includes(line), line);
  assert.match(readFileSync(join(root, "src", "main.asm"), "utf8"), /\tINCLUDE "segments\/segment_4000.asm"\n\tINCLUDE "logic\/frames.asm"\n$/);
  const report = JSON.parse(readFileSync(join(root, ".c64-re-tools", "local", "generated", "src", "not_executed.json"), "utf8")) as Record<string, unknown>;
  assert.deepEqual([report.instructions, report.files], [7, { "logic/frames.asm": 1 }]);

  // The documentation of the Spectrum program: the reference, and a link through the source map to the line of the name.
  const reference = run(root, "retro-docs", "docs.ts", "generate", "src", "--out", "docs/reference");
  assert.equal(reference.status, 0, JSON.stringify(reference.json));
  assert.ok(existsSync(join(root, "docs", "reference", "modules", "logic", "frames.md")));
  writeFileSync(join(root, "README.md"), "# Game\n\nThe counter `frames` `$9002` counts the frames.\n");
  const linked = run(root, "retro-docs", "docs.ts", "link", "README.md", "docs", "--source", "src");
  assert.equal(linked.json.result, "PASS", JSON.stringify(linked.json));
  const line = /\[`frames` `\$9002`\]\(src\/logic\/frames\.asm#L(\d+)\)/.exec(readFileSync(join(root, "README.md"), "utf8"));
  assert.ok(line !== null);
  assert.equal(module.split("\n")[Number(line[1]) - 1], "frames:");
});
