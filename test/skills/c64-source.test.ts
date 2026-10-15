// The c64-source generator (D48): the ACME opcode table, the layout and text
// of the source, the loader plan, and with real ACME and Ghidra the
// byte-identical round trip. The ACME and Ghidra parts are skipped (never
// passed) when the tool is not installed.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { instructionLength } from "../../src/c64.ts";
import { assemble } from "../../src/native/acme.ts";
import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { localToolContext } from "../../src/native/local.ts";
import { copyOrder, planLoader, readEntryState, simulate, type EntryState } from "../../skills/c64-source/scripts/loader.ts";
import { MODE_LENGTH, OPCODES } from "../../skills/c64-source/scripts/opcodes.ts";
import { layout, render, type SourceInput } from "../../skills/c64-source/scripts/source.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}
let ghidraSkip: string | false = acmeSkip;
try {
  findGhidra();
} catch {
  ghidraSkip = "Ghidra is not installed: set C64RT_GHIDRA to the Ghidra installation directory to run these tests";
}

const projects: string[] = [];
after(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
});

function input(bytes: number[], start: number, overrides: Partial<SourceInput> = {}): SourceInput {
  return {
    segments: [{ start, end: start + bytes.length - 1 }],
    byteAt: (address) => bytes[address - start]!,
    instructions: new Map(),
    symbols: [],
    regions: [],
    comments: [],
    modules: [],
    referenceTargets: [],
    ...overrides,
  };
}

const textOf = (rendered: ReturnType<typeof render>, name: string) => rendered.files.find((file) => file.name === name)!.text;

test("the ACME table has every opcode, with the 6502 length of each", () => {
  for (let opcode = 0; opcode < 0x100; opcode++) {
    const entry = OPCODES[opcode];
    assert.ok(entry !== undefined, `opcode ${opcode.toString(16)}`);
    assert.equal(MODE_LENGTH[entry.mode], instructionLength(opcode), `opcode ${opcode.toString(16)} ${entry.mnemonic}`);
  }
});

test("operands get names, forced sizes and labels inside instructions", () => {
  // $1000: LDA $0012 (absolute), STA $1007 (into the next instruction), LDA #0, LDA $1010 (zero page? no: absolute), JMP $1000
  const bytes = [0xad, 0x12, 0x00, 0x8d, 0x07, 0x10, 0xa9, 0x00, 0xad, 0x20, 0xd0, 0x4c, 0x00, 0x10];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 2], [0x1008, 3], [0x100b, 3]]);
  const laid = layout(input(bytes, 0x1000, { instructions, symbols: [{ address: 0xd020, name: "border" }, { address: 0x1000, name: "start" }] }));
  const rendered = render(laid, new Set(), ["header"]);
  const text = textOf(rendered, "segment_1000.asm");
  assert.match(text, /^start\n {8}lda\+2 \$0012$/m);
  assert.match(text, /sta l_1007\nl_1007 = \* \+ 1\n {8}lda #\$00/);
  assert.match(text, /lda border\n {8}jmp start/);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nborder = $d020\n");
  assert.match(textOf(rendered, "main.asm"), /^; header\n\n!cpu 6510\n!source "constants.asm"\n\n\* = \$1000\n!source "segment_1000.asm"\n$/);
  assert.deepEqual([laid.namedLabels, laid.generatedLabels], [1, 1]);
});

test("tables, strings and sprites are written by their region type", () => {
  const bytes = [0x0b, 0x10, 0x0b, 0x10, 0x0a, 0x0a, 0x10, 0x10, 0x48, 0x49, 0x00, 0x60];
  const regions: SourceInput["regions"] = [
    { start: 0x1000, end: 0x1003, type: "addresses" },
    { start: 0x1004, end: 0x1007, type: "rts-addresses-split" },
    { start: 0x1008, end: 0x100a, type: "petscii" },
  ];
  const text = textOf(render(layout(input(bytes, 0x1000, { regions, instructions: new Map([[0x100b, 1]]) })), new Set(), []), "segment_1000.asm");
  assert.match(text, /!word l_100b,l_100b/);
  assert.match(text, /!byte <\(l_100b-1\),<\(l_100b-1\),>\(l_100b-1\),>\(l_100b-1\)/);
  assert.match(text, /!pet "hi"\n {8}!byte \$00\nl_100b\n {8}rts/);
});

test("knowledge that ACME cannot use is refused by name", () => {
  const bytes = [0x60];
  assert.throws(() => layout(input(bytes, 0x1000, { symbols: [{ address: 0x1000, name: "inc" }] })), /The symbol inc at \$1000 has the name of an instruction/);
  assert.throws(() => layout(input(bytes, 0x1000, { modules: [{ start: 0x1000, file: "main.asm" }] })), /which the generator writes itself/);
  const unused = layout(input(bytes, 0x1000, { modules: [{ start: 0x2000, file: "far.asm" }] })).unusedModules;
  assert.deepEqual(unused, [{ start: 0x2000, file: "far.asm" }]);
});

test("modules split a segment into files, each to the next module or the end of the segment", () => {
  const bytes = Array.from({ length: 32 }, () => 0xea);
  const laid = layout(input(bytes, 0x1000, { modules: [{ start: 0x1010, file: "second.asm", title: "Second half" }] }));
  assert.deepEqual(
    laid.pieces.map((piece) => [piece.file, piece.start, piece.end, piece.segmentStart]),
    [
      ["segment_1000.asm", 0x1000, 0x100f, true],
      ["second.asm", 0x1010, 0x101f, false],
    ],
  );
});

const state = (overrides: Partial<EntryState> = {}): EntryState => ({ pc: 0x0810, a: 0, x: 0, y: 0, sp: 0xf6, flags: 0x24, port: [0x2f, 0x37], pages: new Uint8Array(0x400), ...overrides });

test("the copy order lets no copy write over a source that is still to be copied, and a cycle has no order", () => {
  const copies = [
    { what: "a", target: { start: 0x2000, end: 0x20ff }, source: { start: 0x0900, end: 0x09ff } },
    { what: "b", target: { start: 0x0900, end: 0x09ff }, source: { start: 0x0a00, end: 0x0aff } },
  ];
  assert.deepEqual(copyOrder(copies), [0, 1], "a first: b writes over the packed bytes of a");
  assert.equal(copyOrder([copies[1]!, { what: "c", target: { start: 0x0a00, end: 0x0aff }, source: { start: 0x0900, end: 0x09ff } }]), undefined);

  const memory = new Int16Array(0x10000).fill(-1);
  for (let address = 0x0900; address <= 0x0aff; address++) memory[address] = address & 0xff;
  const ordered = copyOrder(copies)!.map((index) => ({ ...copies[index]!, backward: false }));
  assert.equal(simulate(memory, ordered, (address) => (address >= 0x2000 ? address & 0xff : (address + 0x100) & 0xff)), undefined);
});

test("the loader plan refuses a loader that would load into the I/O area, and puts the copier on free pages", () => {
  const byteAt = () => 0;
  const header: string[] = [];
  assert.throws(() => planLoader({ segments: [{ start: 0x1000, end: 0xdfff, files: ["a.asm"] }], byteAt, state: state(), entry: 0x1000, header }), /after \$cfff/);
  const plan = planLoader({ segments: [{ start: 0x0801, end: 0x0fff, files: ["a.asm"] }, { start: 0xc000, end: 0xc3ff, files: ["b.asm"] }], byteAt, state: state(), entry: 0x0810, header });
  assert.equal(plan.copier, 0xc400);
  assert.equal(plan.stackByte, 0x01f6);
  assert.match(plan.text, /ldx #\$f5\n {8}txs\n {8}lda #\$24\n {8}sta \$01f6/);
});

test("an entry state file is read with its flags as PLP reads them, and a wrong one is refused", () => {
  const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page) => [page, "00".repeat(256)]));
  const read = readEntryState(JSON.stringify({ registers: { pc: "$0810", a: 1, x: 2, y: 3, sp: 0xf0, flags: { n: true, i: true, c: true } }, cpuPort: { $00: 0x2f, $01: 0x35 }, pages }), "e.json");
  assert.equal(read.flags, 0xa5);
  assert.deepEqual(read.port, [0x2f, 0x35]);
  assert.throws(() => readEntryState(JSON.stringify({ registers: { pc: "$0810" } }), "e.json"), /e.json is not an entry_state.json/);
});

test("with real ACME, data of every kind assembles to the same bytes", { skip: acmeSkip }, async () => {
  const bytes = Array.from({ length: 0x600 }, (_, index) => index & 0xff);
  const regions: SourceInput["regions"] = [
    { start: 0x2000, end: 0x20ff, type: "petscii" },
    { start: 0x2100, end: 0x21ff, type: "screen" },
    { start: 0x2200, end: 0x22ff, type: "words" },
    { start: 0x2300, end: 0x23ff, type: "addresses-split" },
    { start: 0x2400, end: 0x24ff, type: "sprite" },
    { start: 0x2500, end: 0x25ff, type: "rts-addresses" },
  ];
  const rendered = render(layout(input(bytes, 0x2000, { regions })), new Set(), []);
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], bytes);
});

test("with real ACME, zero-page names outside the image assemble to zero-page instructions", { skip: acmeSkip }, async () => {
  // LDA $66, STA ($66),Y, LDA $66,X, LDA $0005 (absolute), RTS; $66 and $05 have names and lie outside the image.
  const bytes = [0xa5, 0x66, 0x91, 0x66, 0xb5, 0x66, 0xad, 0x05, 0x00, 0x60];
  const instructions = new Map([[0x1000, 2], [0x1002, 2], [0x1004, 2], [0x1006, 3], [0x1009, 1]]);
  const symbols = [{ address: 0x66, name: "ptr" }, { address: 0x05, name: "small" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, symbols })), new Set(), []);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nsmall = $05\nptr = $66\n");
  assert.match(textOf(rendered, "segment_1000.asm"), /sta \(ptr\),y\n {8}lda ptr,x\n {8}lda\+2 small\n/);
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], bytes);
});

test("with real Ghidra and ACME, the script writes source that assembles to the program, aliases as bytes", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // LDX #0; LDA $0012 (absolute); SBC #1 as $eb; NOP as $1a; ANC #$0f as $0b and as $2b; STA into the next LDA; BIT skip; RTS.
  const code = [0xa2, 0x00, 0xad, 0x12, 0x00, 0xeb, 0x01, 0x1a, 0x0b, 0x0f, 0x2b, 0x0f, 0x8d, 0x10, 0x10, 0xa9, 0x00, 0x2c, 0xa9, 0x01, 0x60];
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, ...code]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "rename", "$1000", "start", "--kind", "routine"], { cwd: project }).status, 0);
  const child = spawn(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "test.prg", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const json = JSON.parse(stdout) as { check: { identical: boolean }; asBytes: { listed: Array<{ address: string; instruction: string }> }; files: string[] };
  assert.equal(status, 0, stdout);
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.asBytes.listed, [
    { address: "$1005", instruction: "sbc #$01" },
    { address: "$1007", instruction: "nop" },
    { address: "$100a", instruction: "anc #$0f" },
  ]);
  assert.deepEqual(json.files, ["segment_1000.asm", "constants.asm", "main.asm"]);
  const text = readFileSync(join(project, "src", "segment_1000.asm"), "utf8");
  assert.match(text, /^start\n {8}ldx #\$00\n {8}lda\+2 \$0012$/m);
  assert.match(text, /l_1010 = \* \+ 1\n {8}lda #\$00/);

  const refused = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "test.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(refused.status, 2, "--out is necessary");
});

test("with real Ghidra and ACME, a loader that cannot be planned still gives the checked source and says why (F-24)", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // 40 segments of 4 bytes: more copies than one loader can do. The first one starts with RTS.
  const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  const segments = Array.from({ length: 40 }, (_, index) => ({ start: 0x1000 + index * 16, end: 0x1003 + index * 16 }));
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) memory.fill(0x11, segment.start, segment.end + 1);
  memory[0x1000] = 0x60;
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry: "$1000", image: "image.bin", segments: segments.map((segment) => ({ start: hex(segment.start), end: hex(segment.end) })) }));
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: "$1000", a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [hex(page << 8), "00".repeat(256)])),
    }),
  );
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/generate.ts"), "unpacked/image.json", "--out", "src", "--loader"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    encoding: "utf8",
  });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const json = JSON.parse(run.stdout) as { check: { identical: boolean }; files: string[]; loader: { verified: boolean; reason: string } };
  assert.equal(json.check.identical, true);
  assert.ok(json.files.includes("main.asm") && !json.files.includes("loader.asm"));
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, /needs 41 copies|needs 40 copies/);
});

test("with coverage, each run of instructions that no run executed is marked and listed (D49)", () => {
  // $1000 NOP (executed), $1001 NOP, $1002 NOP, $1003-$1004 data, $1005 RTS
  const bytes = [0xea, 0xea, 0xea, 0x00, 0x00, 0x60];
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = 0x04;
  const instructions = new Map([[0x1000, 1], [0x1001, 1], [0x1002, 1], [0x1005, 1]]);
  const regions: SourceInput["regions"] = [{ start: 0x1003, end: 0x1004, type: "bytes" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, regions, coverage })), new Set(), []);
  assert.deepEqual(rendered.notExecuted, { instructions: 3, ranges: [{ start: 0x1001, end: 0x1002 }, { start: 0x1005, end: 0x1005 }] });
  assert.match(textOf(rendered, "segment_1000.asm"), /^ {8}nop\n; not executed\n {8}nop\n {8}nop\n {8}!byte \$00,\$00\n; not executed\n {8}rts\n$/m);
  assert.equal(render(layout(input(bytes, 0x1000, { instructions, regions })), new Set(), []).notExecuted, undefined);
});

test("an address without a knowledge name gets its platform name; a knowledge name wins, and a taken platform name is not used (D52)", () => {
  // STA $D020, STA $D021, JSR $FFD2, RTS
  const bytes = [0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x20, 0xd2, 0xff, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = new Map([[0xd020, "EXTCOL"], [0xd021, "BGCOL0"], [0xffd2, "CHROUT"]]);
  const laid = layout(input(bytes, 0x1000, { instructions, platform, symbols: [{ address: 0xd021, name: "background" }, { address: 0x2000, name: "CHROUT" }] }));
  const rendered = render(laid, new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta EXTCOL\n {8}sta background\n {8}jsr \$ffd2\n/);
  assert.equal(textOf(rendered, "constants.asm"), "; Names outside the image.\nEXTCOL = $d020\nbackground = $d021\n");
});
