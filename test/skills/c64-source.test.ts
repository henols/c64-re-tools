// The c64-source generator: the ACME opcode table, the layout and text
// of the source, the loader plan, and with real ACME and Ghidra the
// byte-identical round trip. The ACME and Ghidra parts are skipped (never
// passed) when the tool is not installed.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE, instructionLength } from "../../src/c64.ts";
import { assemble } from "../../src/native/acme.ts";
import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { localToolContext } from "../../src/native/local.ts";
import { ciaSection, copyOrder, loaderLimits, planLoader, loaderState, simulate, stopCause, type EntryCia, type EntryState } from "../../skills/c64-source/scripts/lib/loader.ts";
import { MODE_LENGTH, OPCODES } from "../../src/opcodes.ts";
import { entriesInData, entryOutsideImage, layout, render, type SourceInput } from "../../skills/c64-source/scripts/lib/source.ts";
import { decode, describeAddress, platformNames } from "../../src/platform.ts";

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
/** The head of constants.asm without platform areas. */
const CONSTANTS = '; Names of addresses outside the image.\n; "Used" counts the instructions and table entries of this source that use the name.\n\n';

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
  assert.equal(textOf(rendered, "constants.asm"), `${CONSTANTS}border = $d020 ; Used: read 1.\n`);
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

test("a charset is written one character of 8 bytes to a line, without !fill", () => {
  const bytes = Array.from({ length: 24 }, (_, index) => (index < 16 ? 0 : index));
  const regions: SourceInput["regions"] = [{ start: 0x2000, end: 0x2017, type: "charset" }];
  const text = textOf(render(layout(input(bytes, 0x2000, { regions })), new Set(), []), "segment_2000.asm");
  const lines = text.split("\n").filter((line) => line.includes("!byte"));
  assert.deepEqual(
    lines.map((line) => line.trim()),
    ["!byte $00,$00,$00,$00,$00,$00,$00,$00", "!byte $00,$00,$00,$00,$00,$00,$00,$00", "!byte $10,$11,$12,$13,$14,$15,$16,$17"],
  );
  assert.doesNotMatch(text, /!fill/);
});

test("the source map gives the line of each name and of each address that the source writes", () => {
  // $1000: LDA $d020; STA $1007 (into the next instruction); LDA #0; RTS; then a table of two words.
  const bytes = [0xad, 0x20, 0xd0, 0x8d, 0x07, 0x10, 0xa9, 0x00, 0x60, 0x00, 0x10, 0x06, 0x10];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 2], [0x1008, 1]]);
  const regions: SourceInput["regions"] = [{ start: 0x1009, end: 0x100c, type: "addresses" }];
  const symbols = [{ address: 0xd020, name: "border" }, { address: 0x1000, name: "start" }, { address: 0x1009, name: "table" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, regions, symbols, comments: [{ address: 0x1006, placement: "line", text: "clear" }] })), new Set(), []);
  const lineOf = (file: string, line: number) => textOf(rendered, file).split("\n")[line - 1]!;
  const labels = new Map(rendered.labels.map((label) => [label.name, label]));
  assert.deepEqual([...labels.keys()].sort(), ["border", "l_1006", "l_1007", "start", "table"]);
  for (const label of rendered.labels) assert.match(lineOf(label.file, label.line), new RegExp(`^${label.name}( |$)`), label.name);
  assert.equal(labels.get("border")!.file, "constants.asm");
  assert.deepEqual(
    rendered.items.map((item) => [item.start, item.end, lineOf(item.file, item.line).trim()]),
    [
      [0x1000, 0x1002, "lda border"],
      [0x1003, 0x1005, "sta l_1007"],
      [0x1006, 0x1007, "lda #$00"],
      [0x1008, 0x1008, "rts"],
      [0x1009, 0x100c, "!word start,l_1006"],
    ],
  );
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
  assert.match(plan.text, /\n {8}plp\nc64_source_loader_jump jmp \$0810\n/, "the check of the loader stops at this label");
  assert.doesNotMatch(plan.text, /macros\.asm/);
  const withMacros = planLoader({ segments: [{ start: 0x0801, end: 0x0fff, files: ["a.asm"] }], byteAt, state: state(), entry: 0x0810, header, macros: true });
  assert.match(withMacros.text, /^!source "constants\.asm"\n!source "macros\.asm"\n/m, "the source of the loader has the macros");
});

test("a loader that stops early names the first copier byte that is not the file's byte, and else the first byte that a copy did not write", () => {
  // Found in a field run on a 46 KB game: the only message was the address where the loader stopped.
  const plan = { blocks: [], copies: [{ what: "segment $1000-$10ff", target: { start: 0x1000, end: 0x10ff }, source: { start: 0x0900, end: 0x09ff }, backward: false }], copier: 0xc000, stackByte: 0x01f6, end: 0xa0ff, text: "" };
  const file = (address: number) => (address * 7) & 0xff;
  const expected = (address: number) => address & 0xff;
  const ram = new Uint8Array(0x10000);
  for (let offset = 0; offset <= 0xff; offset++) ram[0xc000 + offset] = file(0xa000 + offset);
  for (let address = 0x1000; address <= 0x10ff; address++) ram[address] = expected(address);
  assert.equal(stopCause(ram, plan, 0xa000, file, true, expected), undefined, "all as planned");
  ram[0xc010] = file(0xa010) ^ 0xff;
  assert.equal(stopCause(ram, plan, 0xa000, file, false, expected), `The copier at $c010 holds $${(file(0xa010) ^ 0xff).toString(16).padStart(2, "0")}, not $${file(0xa010).toString(16).padStart(2, "0")} from $a010 of the loader file; $a010 is under a ROM, so the move read the ROM.`);
  ram[0xc010] = file(0xa010);
  ram[0x1020] = 0x99;
  assert.equal(stopCause(ram, plan, 0xa000, file, false, expected), undefined, "the copier did not run, so the copies are not checked");
  assert.equal(stopCause(ram, plan, 0xa000, file, true, expected), "The copy of segment $1000-$10ff wrote $99 at $1020, not $20.");
});

/** Runs the copy table at the end of an assembled loader on a memory model, as the copier does. */
function runCopyTable(program: Buffer, copies: number): Int16Array {
  const memory = new Int16Array(0x10000).fill(-1);
  program.subarray(2).forEach((byte, offset) => (memory[0x0801 + offset] = byte));
  const table = program.length - 2 - 7 * copies;
  for (let index = 0; index < copies; index++) {
    const word = (offset: number) => program[table + 7 * index + offset]! | (program[table + 7 * index + offset + 1]! << 8);
    const [length, read, write, backward] = [word(0), word(2), word(4), program[table + 7 * index + 6] === 1];
    for (let step = 0; step < length; step++) memory[backward ? write - step : write + step] = memory[backward ? read - step : read + step]!;
  }
  return memory;
}

test("with real ACME, the loader takes its copies and its jump from labels, so code that moves still loads", { skip: acmeSkip }, async () => {
  // $1000-$103f unused; $1040 LDA #<$c000 / LDA $1050 / JMP $1040; data to $10ff. A second segment at $c000.
  const bytes = Array.from({ length: 0x100 }, (_, offset) => (offset < 0x40 ? 0 : offset & 0xff));
  bytes.splice(0x40, 8, 0xa9, 0x00, 0xad, 0x50, 0x10, 0x4c, 0x40, 0x10);
  const source: SourceInput = {
    ...input(bytes, 0x1000, {
      entry: 0x1040,
      instructions: new Map([[0x1040, 2], [0x1042, 3], [0x1045, 3]]),
      regions: [{ start: 0x1000, end: 0x103f, type: "unused" }, { start: 0x1048, end: 0x10ff, type: "bytes" }, { start: 0xc000, end: 0xc0ff, type: "bytes" }],
      symbols: [{ address: 0x1040, name: "entry" }, { address: 0xc000, name: "tab" }],
      operands: [{ address: 0x1040, select: "lo", symbol: "tab" }],
    }),
    segments: [{ start: 0x1000, end: 0x10ff }, { start: 0xc000, end: 0xc0ff }],
    byteAt: (address) => (address >= 0xc000 ? address & 0x7f : bytes[address - 0x1000]!),
  };
  const laid = layout(source);
  const rendered = render(laid, new Set(), []);
  const plan = planLoader({
    segments: [{ start: 0x1000, end: 0x10ff, files: ["segment_1000.asm"] }, { start: 0xc000, end: 0xc0ff, files: ["segment_c000.asm"] }],
    byteAt: source.byteAt,
    state: state({ pc: 0x1040 }),
    entry: 0x1040,
    entryName: laid.names.get(0x1040)!,
    header: [],
  });
  assert.match(plan.text, /\n- {7}lda loader_copier_src,x\n/);
  assert.match(plan.text, /\n {8}!word loader_end_1000 - loader_from_1000, loader_from_1000, loader_to_1000 : !byte 0 ; segment \$1000-\$10ff\n/);
  assert.match(plan.text, /\nc64_source_loader_jump jmp entry\n/);
  const build = async (files: Array<{ name: string; text: string }>, entrySource: string) => {
    const contents = files.map((file) => Buffer.from(file.text));
    const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource, includeDirs: [], defines: {} }, contents, localToolContext());
    assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
    return { program: attachments![0]!, symbols: result.symbols ?? [] };
  };
  const files = [...rendered.files, { name: "loader.asm", text: plan.text }];
  const unchanged = await build(files, "loader.asm");
  const memory = runCopyTable(unchanged.program, plan.copies.length);
  for (const segment of source.segments) for (let address = segment.start; address <= segment.end; address++) assert.equal(memory[address], source.byteAt(address), `$${address.toString(16)}`);

  // 16 fill bytes fewer: the code from the entry moves down by 16, the copies and the jump follow it.
  const moved = files.map((file) => (file.name === "segment_1000.asm" ? { ...file, text: file.text.replace("!fill 64, $00", "!fill 48, $00") } : file));
  assert.notDeepEqual(moved, files);
  const main = await build(moved, "main.asm");
  const relocated = await build(moved, "loader.asm");
  const after = runCopyTable(relocated.program, plan.copies.length);
  main.program.subarray(2, 2 + 0xf0).forEach((byte, offset) => assert.equal(after[0x1000 + offset], byte, `$${(0x1000 + offset).toString(16)}`));
  for (let address = 0xc000; address <= 0xc0ff; address++) assert.equal(after[address], source.byteAt(address));
  assert.deepEqual([...main.program.subarray(2 + 0x30, 2 + 0x38)], [0xa9, 0x00, 0xad, 0x40, 0x10, 0x4c, 0x30, 0x10], "the code at $1030 names its moved targets");
  const value = (name: string) => {
    const symbol = relocated.symbols.find((item) => item.name === name)!;
    return symbol.kind === "address" ? symbol.address : symbol.value;
  };
  const at = 2 + value("loader_copier_src") - 0x0801 + (value("c64_source_loader_jump") - plan.copier);
  assert.deepEqual([...relocated.program.subarray(at, at + 3)], [0x4c, 0x30, 0x10], "the loader jumps to the moved entry");
});

test("with real ACME, the loader stub switches the BASIC ROM out before it moves a copier at $a000 or higher", { skip: acmeSkip }, async () => {
  // Found in a field run on a 46 KB game: with the BASIC ROM in, the stub moved ROM bytes as the copier.
  const bytes = Array.from({ length: 0xa000 }, (_, offset) => offset & 0xff);
  const source = input(bytes, 0x1000, { regions: [{ start: 0x1000, end: 0xafff, type: "bytes" }] });
  const rendered = render(layout(source), new Set(), []);
  const plan = planLoader({ segments: [{ start: 0x1000, end: 0xafff, files: ["segment_1000.asm"] }], byteAt: source.byteAt, state: state({ pc: 0x1000 }), entry: 0x1000, header: [] });
  const files = [...rendered.files, { name: "loader.asm", text: plan.text }];
  const contents = files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "loader.asm", includeDirs: [], defines: {} }, contents, localToolContext());
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  const program = attachments![0]!;
  assert.equal(program.length - 2, plan.end - 0x0801 + 1, "the plan has the size of the stub");
  assert.deepEqual([...program.subarray(2 + 0x080d - 0x0801, 2 + 0x0812 - 0x0801)], [0x78, 0xa9, 0x34, 0x85, 0x01], "sei, lda #$34, sta $01");
  const copierSource = result.symbols!.find((symbol) => symbol.name === "loader_copier_src")!;
  assert.ok(copierSource.kind === "address" && copierSource.address >= 0xa000, "the copier lies under the BASIC ROM");
});

test("an entry state file is read with its flags as PLP reads them, and a wrong one is refused", () => {
  const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page) => [page, "00".repeat(256)]));
  const read = loaderState({ registers: { pc: "$0810", a: 1, x: 2, y: 3, sp: 0xf0, flags: { n: true, i: true, c: true } }, cpuPort: { $00: 0x2f, $01: 0x35 }, pages }, "e.json");
  assert.equal(read.flags, 0xa5);
  assert.deepEqual(read.port, [0x2f, 0x35]);
  assert.throws(() => loaderState({ registers: { pc: "$0810" } }, "e.json"), /e\.json is not an entry state of a c64-unpacker capture: registers\.a is not a byte/);
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

test("with real ACME, zero-page names outside the image assemble to zero-page instructions, and an address inside a platform entry is NAME+n", { skip: acmeSkip }, async () => {
  // LDA $66, STA ($66),Y, LDA $66,X, LDA $0005 (absolute), STA $0319, LDA $04, LDA $0004 (absolute), RTS;
  // $66 and $05 have names, NMINV is $0318-$0319 and ADRAY1 $03-$04, all outside the image.
  const bytes = [0xa5, 0x66, 0x91, 0x66, 0xb5, 0x66, 0xad, 0x05, 0x00, 0x8d, 0x19, 0x03, 0xa5, 0x04, 0xad, 0x04, 0x00, 0x60];
  const instructions = new Map([[0x1000, 2], [0x1002, 2], [0x1004, 2], [0x1006, 3], [0x1009, 3], [0x100c, 2], [0x100e, 3], [0x1011, 1]]);
  const symbols = [{ address: 0x66, name: "ptr" }, { address: 0x05, name: "small" }];
  const platform = [{ address: 0x03, end: 0x04, name: "ADRAY1" }, { address: 0x0318, end: 0x0319, name: "NMINV" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, symbols, platform })), new Set(), []);
  assert.equal(textOf(rendered, "constants.asm"), `${CONSTANTS}ADRAY1 = $03   ; Used: read 2.\nsmall  = $05   ; Used: read 1.\nptr    = $66   ; Used: read 2, pointer 1.\nNMINV  = $0318 ; Used: written 1.\n`);
  assert.match(textOf(rendered, "segment_1000.asm"), /sta \(ptr\),y\n {8}lda ptr,x\n {8}lda\+2 small\n {8}sta NMINV\+1\n {8}lda ADRAY1\+1\n {8}lda\+2 ADRAY1\+1\n/);
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], bytes);
});

/**
 * $1000 LDA #$20 / LDX #$10 / LDA $101f,X / LDA #$18 / LDA $1021 / STA $d020 / RTS / LDA #$05,
 * then a table at $1020. The knowledge names the operands of all but the last two.
 */
function operandInput(overrides: Partial<SourceInput> = {}): SourceInput {
  const bytes = [0xa9, 0x20, 0xa2, 0x10, 0xbd, 0x1f, 0x10, 0xa9, 0x18, 0xad, 0x21, 0x10, 0x8d, 0x20, 0xd0, 0x60, 0xa9, 0x05, ...Array.from({ length: 14 }, () => 0xea), 1, 2, 3, 4];
  const instructions = new Map([[0x1000, 2], [0x1002, 2], [0x1004, 3], [0x1007, 2], [0x1009, 3], [0x100c, 3], [0x100f, 1], [0x1010, 2]]);
  return input(bytes, 0x1000, {
    instructions,
    regions: [{ start: 0x1020, end: 0x1023, type: "bytes" }],
    symbols: [{ address: 0x1020, name: "table" }, { address: 0x2000, name: "charset" }, { address: 0xd020, name: "ld020", origin: "dxa" }],
    platform: [{ address: 0x0400, end: 0x07e7, name: "VICSCN" }, { address: 0xd020, end: 0xd020, name: "EXTCOL" }],
    ...overrides,
  });
}

const OPERANDS: SourceInput["operands"] = [
  { address: 0x1000, select: "lo", symbol: "table" },
  { address: 0x1002, select: "hi", symbol: "table" },
  { address: 0x1004, select: "value", symbol: "table", offset: -1 },
  { address: 0x1007, select: "expr", expression: "((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10)" },
  { address: 0x1009, select: "expr", expression: "(table + 1)" },
  { address: 0x100c, select: "value", symbol: "ld020" },
  { address: 0x100f, select: "expr", expression: "1" },
  { address: 0x1010, select: "expr", expression: "nowhere + 5" },
  { address: 0x1001, select: "lo", symbol: "table" },
];

test("operand expressions are written in place of numbers, with the names of the source", () => {
  const without = render(layout(operandInput()), new Set(), []);
  assert.deepEqual(render(layout(operandInput({ operands: [] })), new Set(), []).files, without.files, "no operand expressions, the same source");
  assert.match(textOf(without, "segment_1000.asm"), /lda l_101f,x/, "without an expression the target gets a label");
  const rendered = render(layout(operandInput({ operands: OPERANDS })), new Set(), []);
  const text = textOf(rendered, "segment_1000.asm");
  const lines = text.split("\n").map((line) => line.trim());
  const first = lines.indexOf("lda #<table");
  assert.deepEqual(lines.slice(first, first + 8), [
    "lda #<table",
    "ldx #>table",
    "lda table-1,x",
    "lda #((VICSCN & $3c00) >> 6) | ((charset & $3800) >> 10)",
    "lda 0+(table + 1)",
    "sta EXTCOL",
    "rts                             ; = 1",
    "lda #$05                        ; = nowhere + 5",
  ]);
  assert.doesNotMatch(text, /l_101f/, "the byte before the table gets no label");
  assert.equal(textOf(rendered, "constants.asm"), `${CONSTANTS}VICSCN  = $0400 ; Used: address 1.\ncharset = $2000 ; Used: address 1.\nEXTCOL  = $d020 ; Used: written 1.\n`);
  assert.deepEqual(
    rendered.operandsAsNumbers.map((row) => [row.address, row.expression]),
    [[0x1001, "<table"], [0x100f, "1"], [0x1010, "nowhere + 5"]],
  );
  assert.match(rendered.operandsAsNumbers[2]!.reason, /No symbol and no platform name is nowhere/);
  assert.deepEqual(rendered.expressions.map((row) => [row.address, row.line]), [[0x1000, 4], [0x1002, 5], [0x1004, 6], [0x1007, 7], [0x1009, 8], [0x100c, 9]]);
  const demoted = render(layout(operandInput({ operands: OPERANDS })), new Set(), [], new Map([[0x1000, "a reason"]]));
  assert.ok(textOf(demoted, "segment_1000.asm").includes("        lda #$20                        ; = <table\n"));
  assert.deepEqual(demoted.operandsAsNumbers[0], { address: 0x1000, expression: "<table", reason: "a reason" });
});

test("with real ACME, operand expressions assemble to the same bytes", { skip: acmeSkip }, async () => {
  const source = operandInput({ operands: OPERANDS });
  const rendered = render(layout(source), new Set(), []);
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], Array.from({ length: 0x24 }, (_, offset) => source.byteAt(0x1000 + offset)));
});

test("with real Ghidra and ACME, the script writes source that assembles to the program, aliases as bytes", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // LDX #0; LDA $0012 (absolute); SBC #1 as $eb; NOP as $1a; ANC #$0f as $0b and as $2b; STA into the next LDA; BIT skip; RTS.
  const code = [0xa2, 0x00, 0xad, 0x12, 0x00, 0xeb, 0x01, 0x1a, 0x0b, 0x0f, 0x2b, 0x0f, 0x8d, 0x10, 0x10, 0xa9, 0x00, 0x2c, 0xa9, 0x01, 0x60];
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, ...code]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "image", "test.prg"], { cwd: project }).status, 0);
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "rename", "$1000", "start", "--kind", "routine"], { cwd: project }).status, 0);
  // Files of an earlier run go, files of a person stay.
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "segment_9000.asm"), "; Generated by c64-source. Do not edit: change the knowledge and generate again.\n");
  writeFileSync(join(project, "src", "loader.prg"), Uint8Array.from([0x01, 0x08]));
  writeFileSync(join(project, "src", "notes.asm"), "; my notes\n");
  writeFileSync(join(project, "src", "not_executed.json"), "{}\n");
  const child = spawn(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const json = JSON.parse(stdout) as { result: string; check: { identical: boolean }; asBytes: { listed: Array<{ address: string; instruction: string }> }; files: Array<{ out: string; bytes: number; sha256: string }> };
  assert.equal(status, 0, stdout);
  assert.equal(json.result, "PASS");
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.asBytes.listed, [
    { address: "$1005", instruction: "sbc #$01" },
    { address: "$1007", instruction: "nop" },
    { address: "$100a", instruction: "anc #$0f" },
  ]);
  assert.deepEqual((json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))), ["segment_1000.asm", "constants.asm", "main.asm"]);
  assert.ok(json.files.some((file) => file.out === "src/source-map.json"), "the source map is a written file too");
  const text = readFileSync(join(project, "src", "segment_1000.asm"), "utf8");
  assert.match(text, /^; Generated by c64-source\. /);
  assert.match(text, /^start\n {8}ldx #\$00\n {8}lda\+2 \$0012$/m);
  assert.deepEqual(readdirSync(join(project, "src")).sort(), ["constants.asm", "main.asm", "notes.asm", "segment_1000.asm", "source-map.json"]);
  // The source map counts the mark line, so each line is the line in the file.
  const map = JSON.parse(readFileSync(join(project, "src", "source-map.json"), "utf8")) as { files: string[]; labels: Array<{ address: string; name: string; file: string; line: number }>; items: Array<{ start: string; file: string; line: number }> };
  assert.deepEqual(map.files, (json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))));
  const startLabel = map.labels.find((label) => label.name === "start")!;
  assert.deepEqual([startLabel.address, startLabel.file, text.split("\n")[startLabel.line - 1]], ["$1000", "segment_1000.asm", "start"]);
  const first = map.items.find((item) => item.start === "$1000")!;
  assert.equal(text.split("\n")[first.line - 1], "        ldx #$00");
  assert.match(text, /l_1010 = \* \+ 1\n {8}lda #\$00/);

  // With coverage, every range that no run executed goes to not_executed.json, and its mark gives the range.
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x1000, 0x1002]) coverage[address] = COVERAGE.ramExecute;
  writeFileSync(join(project, "run.bin"), coverage);
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "coverage", "run.bin"], { cwd: project }).status, 0);
  const covered = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    encoding: "utf8",
  });
  assert.equal(covered.status, 0, covered.stdout);
  const notExecuted = (JSON.parse(covered.stdout) as { notExecuted: { count: number; rest?: string } }).notExecuted;
  const all = JSON.parse(readFileSync(join(project, "src", "not_executed.json"), "utf8")) as { files: Record<string, number>; ranges: Array<{ start: string; end: string; file?: string; routine?: string }> };
  assert.equal(all.ranges.length, notExecuted.count);
  assert.equal(all.ranges[0]!.start, "$1005");
  // Each range names its file and the routine before it, so a report can group them.
  assert.deepEqual([all.ranges[0]!.file, all.ranges[0]!.routine], ["segment_1000.asm", "start"]);
  assert.deepEqual(all.files, { "segment_1000.asm": all.ranges.length });
  const marks = readFileSync(join(project, "src", "segment_1000.asm"), "utf8").match(/^; not executed .*$/gm);
  assert.deepEqual(marks, all.ranges.map((range) => `; not executed ${range.start}-${range.end}`));

  const refused = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate"], { cwd: project, encoding: "utf8" });
  assert.equal(refused.status, 2, "--out is necessary");
  const named = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "test.prg", "--out", "src"], { cwd: project, encoding: "utf8" });
  assert.equal(named.status, 2, "the program comes from the knowledge, not from a path");
});

test("with real Ghidra and ACME, an operand expression that ACME assembles to other bytes is written as its number", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // $1000 LDA #$0b / STA $0314 / LDA #$10 / STA $0315 / RTS, then the handler at $100b: RTS.
  const code = [0xa9, 0x0b, 0x8d, 0x14, 0x03, 0xa9, 0x10, 0x8d, 0x15, 0x03, 0x60, 0x60];
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, ...code]));
  // An older program with $11 at $1006: an expression that fits it does not fit test.prg.
  writeFileSync(join(project, "old.prg"), Uint8Array.from([0x00, 0x10, ...code.map((byte, index) => (index === 6 ? 0x11 : byte))]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  const write = (...args: string[]) => assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, ...args], { cwd: project, encoding: "utf8" }).status, 0, args.join(" "));
  write("image", "test.prg");
  write("rename", "$1000", "start", "--kind", "routine");
  write("rename", "$100b", "handler", "--kind", "routine");
  write("operand", "$1000", "--lo", "handler");
  write("operand", "$1002", "--value", "CINV");
  write("image", "old.prg");
  write("operand", "$1005", "--expr", ">handler+$100");
  write("image", "test.prg");
  const generated = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    encoding: "utf8",
  });
  assert.equal(generated.status, 0, generated.stdout);
  const json = JSON.parse(generated.stdout) as { check: { identical: boolean }; operandExpressions: number; operandsAsNumbers: unknown };
  assert.equal(json.check.identical, true);
  assert.equal(json.operandExpressions, 2);
  assert.deepEqual(json.operandsAsNumbers, { count: 1, listed: [{ address: "$1005", expression: ">handler+$100", reason: "ACME assembles it to $11, and the image has $10." }] });
  const lines = readFileSync(join(project, "src", "segment_1000.asm"), "utf8").split("\n").map((line) => line.trim());
  const first = lines.indexOf("lda #<handler");
  assert.deepEqual(lines.slice(first, first + 4), ["lda #<handler", "sta CINV", "lda #$10                        ; = >handler+$100", "sta CINV+1"]);
});

test("with real Ghidra and ACME, a loader that cannot be planned still gives the checked source and says why", { skip: ghidraSkip, timeout: 600_000 }, async () => {
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
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "image", "unpacked/image.json"], { cwd: project }).status, 0);
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src", "--loader"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
    encoding: "utf8",
  });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const json = JSON.parse(run.stdout) as { check: { identical: boolean }; files: Array<{ out: string }>; loader: { verified: boolean; reason: string } };
  assert.equal(json.check.identical, true);
  assert.ok((json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("main.asm") && !(json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("loader.asm"));
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, /needs 41 copies|needs 40 copies/);
});

test("with real Ghidra and ACME, an image whose entry is in no segment gives the checked source and fails", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // The program at $0801 is missing: the image has only $1000-$1003, which starts with RTS.
  const memory = new Uint8Array(0x10000);
  memory.set([0x60, 0xea, 0xea, 0xea], 0x1000);
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry: "$0801", image: "image.bin", segments: [{ start: "$1000", end: "$1003" }] }));
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: "$0801", a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [`$${(page << 8).toString(16).padStart(4, "0")}`, "00".repeat(256)])),
    }),
  );
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "image", "unpacked/image.json"], { cwd: project }).status, 0);
  const generate = (...args: string[]) =>
    spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src", ...(args.includes("--no-seed") ? [] : ["--entry", "$1000"]), ...args.filter((arg) => arg !== "--no-seed")], {
      cwd: project,
      env: { ...process.env, C64RT_HOST: "127.0.0.1:1" },
      encoding: "utf8",
    });
  const reason = /^The entry \$0801 is in no segment of the image: the image does not hold the program\. Capture it again/;
  const withLoader = generate("--loader");
  assert.equal(withLoader.status, 1, withLoader.stdout + withLoader.stderr);
  const json = JSON.parse(withLoader.stdout) as { check: { identical: boolean }; files: Array<{ out: string }>; entryOutside: { entry: string; reason: string }; loader: { verified: boolean; reason: string } };
  assert.equal(json.check.identical, true);
  assert.ok((json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("main.asm") && !(json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("loader.asm"));
  assert.equal(json.entryOutside.entry, "$0801");
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, reason);
  const source = generate();
  assert.equal(source.status, 1, source.stdout + source.stderr);
  assert.match((JSON.parse(source.stdout) as { entryOutside: { reason: string } }).entryOutside.reason, reason);
  // With no --entry and no knowledge, the image has no seed for Ghidra: still entryOutside, not a usage error.
  const unseeded = generate("--no-seed", "--loader");
  assert.equal(unseeded.status, 1, unseeded.stdout + unseeded.stderr);
  const data = JSON.parse(unseeded.stdout) as { instructions: number; entryOutside: { reason: string }; loader: { verified: boolean } };
  assert.equal(data.instructions, 0);
  assert.match(data.entryOutside.reason, reason);
  assert.equal(data.loader.verified, false);
});

test("with coverage, each run of instructions that no run executed is marked and listed", () => {
  // $1000 NOP (executed), $1001 NOP, $1002 NOP, $1003-$1004 data, $1005 RTS
  const bytes = [0xea, 0xea, 0xea, 0x00, 0x00, 0x60];
  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = 0x04;
  const instructions = new Map([[0x1000, 1], [0x1001, 1], [0x1002, 1], [0x1005, 1]]);
  const regions: SourceInput["regions"] = [{ start: 0x1003, end: 0x1004, type: "bytes" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, regions, coverage })), new Set(), []);
  assert.deepEqual(rendered.notExecuted, { instructions: 3, ranges: [{ start: 0x1001, end: 0x1002 }, { start: 0x1005, end: 0x1005 }] });
  assert.match(textOf(rendered, "segment_1000.asm"), /^ {8}nop\n; not executed \$1001-\$1002\n {8}nop\n {8}nop\n {8}!byte \$00,\$00\n; not executed \$1005-\$1005\n {8}rts\n$/m);
  assert.equal(render(layout(input(bytes, 0x1000, { instructions, regions })), new Set(), []).notExecuted, undefined);
});

test("an address without a knowledge name gets its platform name; a knowledge name wins, and a taken platform name is not used", () => {
  // STA $D020, STA $D021, JSR $FFD2, RTS
  const bytes = [0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x20, 0xd2, 0xff, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = [{ address: 0xd020, end: 0xd020, name: "EXTCOL" }, { address: 0xd021, end: 0xd021, name: "BGCOL0" }, { address: 0xffd2, end: 0xffd4, name: "CHROUT" }];
  const laid = layout(input(bytes, 0x1000, { instructions, platform, symbols: [{ address: 0xd021, name: "background" }, { address: 0x2000, name: "CHROUT" }] }));
  const rendered = render(laid, new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta EXTCOL\n {8}sta background\n {8}jsr \$ffd2\n/);
  assert.equal(textOf(rendered, "constants.asm"), `${CONSTANTS}EXTCOL     = $d020 ; Used: written 1.\nbackground = $d021 ; Used: written 1.\n`);
});

test("an analyzer name gives way to the platform name, and a user or LLM name still wins", () => {
  // STA $D020, STA $D021, STA $0314, RTS
  const bytes = [0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x8d, 0x14, 0x03, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = [{ address: 0xd020, end: 0xd020, name: "EXTCOL" }, { address: 0xd021, end: 0xd021, name: "BGCOL0" }, { address: 0x0314, end: 0x0315, name: "CINV" }];
  const symbols: SourceInput["symbols"] = [
    { address: 0xd020, name: "ld020", origin: "dxa" },
    { address: 0xd021, name: "background", origin: "llm" },
    { address: 0x0314, name: "l0314", origin: "ghidra" },
    { address: 0x3000, name: "l3000", origin: "dxa" },
  ];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, platform, symbols })), new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta EXTCOL\n {8}sta background\n {8}sta CINV\n/);
  assert.equal(textOf(rendered, "constants.asm"), `${CONSTANTS}CINV       = $0314 ; Used: written 1.\nEXTCOL     = $d020 ; Used: written 1.\nbackground = $d021 ; Used: written 1.\n`);
});

test("an address inside a platform entry gets NAME+n only when it has no name of its own and the entry name is in use", () => {
  // STA $0319, STA $0315, STA $0317, RTS
  const bytes = [0x8d, 0x19, 0x03, 0x8d, 0x15, 0x03, 0x8d, 0x17, 0x03, 0x60];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 3], [0x1009, 1]]);
  const platform = [{ address: 0x0314, end: 0x0315, name: "CINV" }, { address: 0x0316, end: 0x0317, name: "CBINV" }, { address: 0x0318, end: 0x0319, name: "NMINV" }];
  // $0315 has a knowledge name; $0316 has a knowledge name too, so $0317 is that name +1; NMINV is taken by another address.
  const symbols = [{ address: 0x0315, name: "irqHigh" }, { address: 0x0316, name: "brkVector" }, { address: 0x2000, name: "NMINV" }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, platform, symbols })), new Set(), []);
  assert.match(textOf(rendered, "segment_1000.asm"), / {8}sta \$0319\n {8}sta irqHigh\n {8}sta brkVector\+1\n/);
  assert.equal(textOf(rendered, "constants.asm"), `${CONSTANTS}irqHigh   = $0315 ; Used: written 1.\nbrkVector = $0316 ; Used: written 1.\n`);
});

test("constants.asm groups its names by platform area, and says what each name is and how the source uses it", () => {
  // LDA $0C, STA $0C, LDA ($FB),Y, STA $D020, STA $D021, STA $D060, JSR $FFD2, RTS, then a pointer table with $C000
  const bytes = [0xa5, 0x0c, 0x85, 0x0c, 0xb1, 0xfb, 0x8d, 0x20, 0xd0, 0x8d, 0x21, 0xd0, 0x8d, 0x60, 0xd0, 0x20, 0xd2, 0xff, 0x60, 0x00, 0xc0];
  const instructions = new Map([[0x1000, 2], [0x1002, 2], [0x1004, 2], [0x1006, 3], [0x1009, 3], [0x100c, 3], [0x100f, 3], [0x1012, 1]]);
  const symbols = [{ address: 0x0c, name: "joy_state" }, { address: 0xd021, name: "background" }, { address: 0xd060, name: "border_mirror" }, { address: 0xc000, name: "buffer" }];
  const regions: SourceInput["regions"] = [{ start: 0x1013, end: 0x1014, type: "addresses" }];
  // A knowledge comment wins over the platform meaning.
  const comments: SourceInput["comments"] = [{ address: 0x0c, placement: "side", text: "Joystick 2 bits,\nlow active." }, { address: 0xd020, placement: "line", text: "Flashes on a hit." }];
  const rendered = render(layout(input(bytes, 0x1000, { instructions, symbols, regions, comments, platform: platformNames(), describe: describeAddress })), new Set(), []);
  assert.equal(
    textOf(rendered, "constants.asm"),
    [
      "; Names of addresses outside the image, by memory area.",
      '; "Used" counts the instructions and table entries of this source that use the name.',
      "",
      "; Zero page $0000-$00ff",
      "; Zero page. The system uses most of it; $FB-$FE are free.",
      "joy_state     = $0c   ; Joystick 2 bits, low active. Used: read 1, written 1.",
      "FREEZP        = $fb   ; Free zero page: the system does not use these bytes. Used: pointer 1.",
      "",
      "; Free RAM $c000-$cfff",
      "; Free RAM. The application decides what is here.",
      "buffer        = $c000 ; Used: table 1.",
      "",
      "; VIC-II registers $d000-$d3ff",
      "EXTCOL        = $d020 ; Flashes on a hit. Used: written 1.",
      "background    = $d021 ; BGCOL0: Background color 0 (bits 0-3). Used: written 1.",
      "border_mirror = $d060 ; Mirror of $d020 (EXTCOL). Used: written 1.",
      "",
      "; KERNAL ROM or RAM $e000-$ffff",
      "; KERNAL ROM when $01 bit 1 is set, else RAM.",
      "CHROUT        = $ffd2 ; KERNAL jump table: Writes the character in A to the output channel. Used: called 1.",
      "",
    ].join("\n"),
  );
});

test("an --entry in a data region of the knowledge is reported with the region", () => {
  const regions = [
    { start: 0x0000, end: 0x04ff, type: "bytes" as const, origin: "dxa" },
    { start: 0x0500, end: 0x05ff, type: "code" as const, origin: "user" },
    { start: 0x0600, end: 0x07ff, type: "dual-use" as const, origin: "llm" },
  ];
  assert.deepEqual(entriesInData([0x0400, 0x0500, 0x0600, 0x0900], regions), [{ entry: 0x0400, region: regions[0] }]);
});

test("an image entry in no segment is named: the image does not hold the program", () => {
  const segments = [{ start: 0xc2ff, end: 0xcfff }, { start: 0xe000, end: 0xfffe }];
  assert.match(entryOutsideImage(0x0801, segments)!, /^The entry \$0801 is in no segment of the image: the image does not hold the program\./);
  assert.equal(entryOutsideImage(0xc300, segments), undefined);
  assert.equal(entryOutsideImage(undefined, segments), undefined);
});

/** A CIA at the entry: counters, controls and interrupt flags in their registers. */
function entryCia(timerA: number, timerB: number, controlA: number, controlB: number, hidden: Omit<EntryCia, "registers">, flags = 0): EntryCia {
  const registers = new Uint8Array(16);
  registers.set([timerA & 0xff, timerA >> 8, timerB & 0xff, timerB >> 8], 4);
  registers.set([flags, controlA, controlB], 0x0d);
  return { registers, ...hidden };
}

function ciaState(cia1: EntryCia, cia2: EntryCia): EntryState {
  return { pc: 0x1000, a: 0, x: 0, y: 0, sp: 0xff, flags: 0x20, port: [0x2f, 0x37], pages: new Uint8Array(0x400), vic: { registers: new Uint8Array(0x2f), bank: 3 }, cia: [cia1, cia2] };
}

const KERNAL_CIA2 = () => entryCia(0xffff, 0xffff, 0x08, 0x08, { latchA: 0xffff, latchB: 0xffff, interruptMask: 0 });

test("the loader sets only the CIA timers that differ from the KERNAL's, and a running one counts to its entry value", () => {
  const section = ciaSection(ciaState(entryCia(0x1234, 0xffff, 0x01, 0x08, { latchA: 0x4025, latchB: 0xffff, interruptMask: 0x01 }), KERNAL_CIA2()))!;
  // Stop, load, start, latch, and read the flags away; after the start come 12 + 4 cycles and the tail of 33, less the start delay of 1.
  assert.deepEqual(section.ops.map((op) => op.text), [
    "lda #$00", "sta $dc0e",
    "lda #$64", "sta $dc04", "lda #$12", "sta $dc05",
    "lda #$01", "sta $dc0e",
    "lda #$25", "sta $dc04", "lda #$40", "sta $dc05",
    "lda $dc0d",
  ]);
  assert.equal(0x1264 - 0x1234, 12 + 4 + 33 - 1);
  assert.deepEqual(section.plan.timers[0], { cia: 1, timer: "A", control: 0x01, latch: 0x4025, counterAtJump: 0x1237 });
  assert.deepEqual(section.plan.limits, []);
  assert.deepEqual(loaderLimits({ cia: section.plan }), []);
  assert.match(loaderLimits({}).join("\n"), /no CIA values.*Capture the program again with c64-unpacker/, "an entry state from an older version");
});

test("a CIA timer that the loader cannot set as it was is a named limit", () => {
  // CIA 1 timer A runs so near $ffff that the cycles to the entry do not fit; timer B is stopped with a counter that is not its latch.
  const near = ciaSection(ciaState(entryCia(0xfff0, 0x1000, 0x01, 0x08, { latchA: 0xffff, latchB: 0x2000, interruptMask: 0x01 }, 0x01), KERNAL_CIA2()))!;
  assert.equal(near.plan.timers[0]!.counterAtJump, undefined);
  assert.equal(near.plan.timers[1]!.counterAtJump, 0x2000, "a stopped timer loads its latch");
  assert.equal(near.plan.limits.length, 3);
  assert.match(near.plan.limits.join("\n"), /CIA 1 timer A counts from \$fff0/);
  assert.match(near.plan.limits.join("\n"), /CIA 1 timer B is stopped with the counter \$1000 and the latch \$2000/);
  assert.match(near.plan.limits.join("\n"), /CIA 1 has the interrupt flags \$01 at the entry/);
  // A latch with the high byte of the counter needs only its low byte: no limit.
  const low = ciaSection(ciaState(entryCia(0x1234, 0x1210, 0x01, 0x08, { latchA: 0x4025, latchB: 0x1280, interruptMask: 0x01 }), KERNAL_CIA2()))!;
  assert.deepEqual(low.plan.limits, []);
  assert.equal(low.plan.timers[1]!.counterAtJump, 0x1210);
  // Without the CIA state, the loader sets nothing.
  assert.equal(ciaSection({ ...ciaState(KERNAL_CIA2(), KERNAL_CIA2()), cia: undefined } as unknown as EntryState), undefined);
});

/** Assembles rendered files with ACME; the program bytes after the load address, or the diagnostics. */
async function assembleRendered(rendered: ReturnType<typeof render>, defines: Record<string, number> = {}): Promise<{ bytes?: number[]; messages: string[] }> {
  const contents = rendered.files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble(
    { files: rendered.files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "main.asm", includeDirs: [], defines },
    contents,
    localToolContext(),
  );
  return { ...(result.assembled ? { bytes: [...attachments![0]!.subarray(2)] } : {}), messages: result.diagnostics.map((diagnostic) => diagnostic.message) };
}

/** $1000 LDA #$00; $1002 STA $d020; $1005 JMP $1000; $1008 eight data bytes; $1010 LDA $1003; $1013 RTS. */
function patchInput(patches: NonNullable<SourceInput["patches"]>, overrides: Partial<SourceInput> = {}): SourceInput {
  const bytes = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x4c, 0x00, 0x10, 1, 2, 3, 4, 5, 6, 7, 8, 0xad, 0x03, 0x10, 0x60];
  const instructions = new Map([[0x1000, 2], [0x1002, 3], [0x1005, 3], [0x1010, 3], [0x1013, 1]]);
  return input(bytes, 0x1000, { instructions, regions: [{ start: 0x1008, end: 0x100f, type: "bytes" }], symbols: [{ address: 0x1002, name: "store" }], patches, ...overrides });
}

const CRACK = { start: 0x1000, end: 0x1004, switch: "CRACK", code: "        lda #1\n        sta $d021", comment: "A grey border." };

test("a patch is written as !if SWITCH { code, NOP } else { original }, with its inner names before it", () => {
  const laid = layout(patchInput([CRACK, { start: 0x1008, end: 0x100b, switch: "DEBUG", code: "" }]));
  assert.deepEqual(laid.patchesNotWritten, []);
  const rendered = render(laid, new Set(), []);
  assert.equal(rendered.patches, 2);
  const text = textOf(rendered, "segment_1000.asm");
  assert.match(
    text,
    /^l_1000\nstore = \* \+ 2\nl_1003 = \* \+ 3\n!zone patch_CRACK_1000 \{\n\.patch_start\n!if CRACK \{\n {8}; CRACK on: 5 bytes at \$1000-\$1004, NOP after the code\n {8}; A grey border\.\n {8}lda #1\n {8}sta \$d021\n {8}!if \* - \.patch_start > 5 \{ !error .*\} else \{ !fill 5 - \(\* - \.patch_start\), \$ea \}\n\} else \{\n {8}lda #\$00\n {8}sta \$d020\n\}\n\}\n {8}jmp l_1000\n/m,
  );
  assert.match(text, /!if DEBUG \{\n.*\n {8}!if \* - \.patch_start > 4 .*\n\} else \{\n {8}!byte \$01,\$02,\$03,\$04\n\}\n\}\n {8}!byte \$05,\$06,\$07,\$08\n/);
  assert.match(textOf(rendered, "constants.asm"), /^; Switches: .*\n.*\n!ifndef CRACK \{ CRACK = 0 \} ; 1 patch: \$1000-\$1004\n!ifndef DEBUG \{ DEBUG = 0 \} ; 1 patch: \$1008-\$100b\n\n; Names/);
});

test("a patch that cuts an instruction, leaves its file or has the name of a label is not written", () => {
  const laid = layout(
    patchInput(
      [
        { start: 0x1001, end: 0x1004, switch: "CUT", code: "" },
        { start: 0x1006, end: 0x1007, switch: "CUT", code: "" },
        { start: 0x1008, end: 0x1009, switch: "store", code: "" },
        { start: 0x100c, end: 0x1011, switch: "LONG", code: "" },
      ],
      { modules: [{ start: 0x1010, file: "tail.asm" }] },
    ),
  );
  assert.deepEqual(
    laid.patchesNotWritten.map((row) => [row.start, row.reason]),
    [
      [0x1001, "The range cuts the instruction at $1000."],
      [0x1006, "The range cuts the instruction at $1005."],
      [0x1008, "The switch name store is also a name of the source."],
      [0x100c, "The range runs past the end of the file segment_1000.asm at $100f: a patch is in one file."],
    ],
  );
  assert.equal(laid.patches.size, 0);
});

test("with real ACME, a switch off gives the image, on changes only its range, and a patch too long stops ACME", { skip: acmeSkip }, async () => {
  const source = patchInput([CRACK, { start: 0x1008, end: 0x100b, switch: "DEBUG", code: "" }]);
  const image = Array.from({ length: 20 }, (_, offset) => source.byteAt(0x1000 + offset));
  const rendered = render(layout(source), new Set(), []);
  assert.deepEqual((await assembleRendered(rendered)).bytes, image);
  const on = [...image];
  on.splice(0, 5, 0xa9, 0x01, 0x8d, 0x21, 0xd0);
  assert.deepEqual((await assembleRendered(rendered, { CRACK: 1 })).bytes, on);
  const nop = [...image];
  nop.splice(8, 4, 0xea, 0xea, 0xea, 0xea);
  assert.deepEqual((await assembleRendered(rendered, { DEBUG: 1 })).bytes, nop, "empty code is only NOP");
  const long = render(layout(patchInput([{ ...CRACK, code: "        lda #1\n        sta $d021\n        rts" }])), new Set(), []);
  assert.deepEqual((await assembleRendered(long)).bytes, image, "off, the code is not assembled");
  const refused = await assembleRendered(long, { CRACK: 1 });
  assert.equal(refused.bytes, undefined);
  assert.deepEqual(refused.messages, ["!error: The patch CRACK at $1000 has 6 (0x6) bytes; the range has 5."]);
});

test("with real Ghidra and ACME, the script builds each switch on and reports it; a patch too long fails the run", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // $1000 LDA #$00; STA $d020; JMP $1000.
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, 0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x4c, 0x00, 0x10]));
  const knowledge = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts"), ...args], { cwd: project, encoding: "utf8" });
  assert.equal(knowledge("image", "test.prg").status, 0);
  assert.equal(knowledge("rename", "$1000", "start", "--kind", "routine").status, 0);
  assert.equal(knowledge("patch", "$1000-$1004", "CRACK", "--code", "        lda #1\n        sta $d021").status, 0);
  assert.equal(knowledge("patch", "$1005-$1007", "BIG", "--code", "        nop\n        nop\n        nop\n        nop").status, 0);
  const generate = () => spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], { cwd: project, encoding: "utf8" });
  type Result = { check: { identical: boolean }; switches: Array<{ name: string; result: string; changedBytes?: number; overflow?: Array<{ start: string; message: string }> }> };
  const first = generate();
  assert.equal(first.status, 1, first.stdout);
  const json = JSON.parse(first.stdout) as Result;
  assert.equal(json.check.identical, true, "off, every switch gives the image");
  assert.deepEqual(json.switches.map((item) => [item.name, item.result]), [["BIG", "overflow"], ["CRACK", "fits"]]);
  assert.deepEqual(json.switches[0]!.overflow, [{ start: "$1005", message: "The patch BIG at $1005 has 4 (0x4) bytes; the range has 3." }]);
  assert.equal(json.switches[1]!.changedBytes, 2);
  assert.equal(knowledge("unpatch", "$1005").status, 0);
  const second = generate();
  assert.equal(second.status, 0, second.stdout);
  assert.deepEqual((JSON.parse(second.stdout) as Result).switches.map((item) => [item.name, item.result]), [["CRACK", "fits"]]);
});

const INC16 = { name: "inc16", params: ["dst"], body: "        inc .dst\n        bne +\n        inc .dst+1\n+", comment: "Adds 1 to a 16-bit value." };

/** $1000 INC $fb; BNE +2; INC $fc; $1006 INC $fd; BNE +2; INC $fe; $100c RTS. ptr is $fb. */
function macroInput(macroUses: NonNullable<SourceInput["macroUses"]>, overrides: Partial<SourceInput> = {}): SourceInput {
  const bytes = [0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0xe6, 0xfd, 0xd0, 0x02, 0xe6, 0xfe, 0x60];
  const instructions = new Map([[0x1000, 2], [0x1002, 2], [0x1004, 2], [0x1006, 2], [0x1008, 2], [0x100a, 2], [0x100c, 1]]);
  return input(bytes, 0x1000, { instructions, symbols: [{ address: 0x1000, name: "start" }, { address: 0x00fb, name: "ptr" }], macros: [INC16], macroUses, ...overrides });
}

test("a macro use is one +name args line, and macros.asm holds the macros", () => {
  const laid = layout(macroInput([{ start: 0x1000, end: 0x1005, macro: "inc16", args: ["ptr"] }, { start: 0x1006, end: 0x100b, macro: "inc16", args: ["ptr+2"] }], { comments: [{ address: 0x1004, placement: "side", text: "high byte" }] }));
  assert.deepEqual(laid.macrosAsInstructions, []);
  const rendered = render(laid, new Set(), []);
  assert.equal(textOf(rendered, "segment_1000.asm"), `; Segment $1000-$100c\n; $1000-$100c\n\nstart\n        +inc16 ptr                      ; high byte\n        +inc16 ptr+2\n        rts\n`);
  assert.equal(textOf(rendered, "macros.asm"), "; Macros of the knowledge. The source writes a use as +name args.\n\n; Adds 1 to a 16-bit value.\n!macro inc16 .dst {\n        inc .dst\n        bne +\n        inc .dst+1\n+\n}\n");
  assert.deepEqual(rendered.macroLines, new Map([["inc16", { first: 4, last: 9 }]]));
  assert.match(textOf(rendered, "main.asm"), /!source "constants\.asm"\n!source "macros\.asm"\n/);
  assert.match(textOf(rendered, "constants.asm"), /^ptr = \$fb ; Used: macro argument 2\.$/m);
  assert.equal(rendered.instructions, 7);
  assert.deepEqual(rendered.uses.map((use) => [use.start, use.line]), [[0x1000, 5], [0x1006, 6]]);
  const without = render(layout(macroInput([], { macros: [] })), new Set(), []);
  assert.equal(without.files.some((file) => file.name === "macros.asm"), false, "no macros, no macros.asm");
});

test("a macro use with a label inside it, in a patch, of a missing macro or not of whole instructions is written as its instructions", () => {
  const laid = layout(
    macroInput(
      [
        { start: 0x1000, end: 0x1005, macro: "inc16", args: ["ptr"] },
        { start: 0x1006, end: 0x100b, macro: "inc16", args: ["ptr", "1"] },
        { start: 0x100c, end: 0x100c, macro: "nothing", args: [] },
      ],
      { symbols: [{ address: 0x1004, name: "high" }, { address: 0x00fb, name: "ptr" }] },
    ),
  );
  assert.deepEqual(
    laid.macrosAsInstructions.map((row) => [row.start, row.reason]),
    [
      [0x1000, "The source has a label at $1004, inside the use."],
      [0x1006, "The macro has 1 params, and the use gives 2 args."],
      [0x100c, "There is no macro nothing."],
    ],
  );
  const cut = layout(macroInput([{ start: 0x1001, end: 0x1005, macro: "inc16", args: ["ptr"] }, { start: 0x1006, end: 0x100b, macro: "inc16", args: ["$fd"] }], { patches: [{ start: 0x1008, end: 0x1009, switch: "SKIP", code: "" }] }));
  assert.deepEqual(cut.macrosAsInstructions.map((row) => [row.start, row.reason]), [[0x1001, "The range is not a run of whole instructions of one file."], [0x1006, "The use lies in a patch."]]);
  const text = textOf(render(laid, new Set(), []), "segment_1000.asm");
  assert.match(text, /^ {8}inc ptr\n {8}bne l_1006\nhigh\n {8}inc \$fc\nl_1006\n/m, "a use written as instructions names its targets");
  const blamed = render(layout(macroInput([{ start: 0x1000, end: 0x1005, macro: "inc16", args: ["ptr"] }])), new Set(), [], new Map(), new Map([[0x1000, "ACME refuses it."]]));
  assert.deepEqual(blamed.uses, []);
  assert.deepEqual(blamed.macrosAsInstructions, [{ start: 0x1000, end: 0x1005, macro: "inc16", reason: "ACME refuses it." }]);
});

test("with real ACME, macro uses assemble to the same bytes", { skip: acmeSkip }, async () => {
  const source = macroInput([{ start: 0x1000, end: 0x1005, macro: "inc16", args: ["ptr"] }, { start: 0x1006, end: 0x100b, macro: "inc16", args: ["$fd"] }]);
  const rendered = render(layout(source), new Set(), []);
  assert.equal(rendered.uses.length, 2);
  assert.deepEqual((await assembleRendered(rendered)).bytes, Array.from({ length: 13 }, (_, offset) => source.byteAt(0x1000 + offset)));
});

test("with real Ghidra and ACME, a macro use that ACME refuses or assembles to other bytes is written as its instructions, and the source stays identical", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // $1000, $1006 and $100c INC $fb/$fd/$02; BNE +2; INC $fc/$fe/$03; $1012 RTS.
  const code = [0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0xe6, 0xfd, 0xd0, 0x02, 0xe6, 0xfe, 0xe6, 0x02, 0xd0, 0x02, 0xe6, 0x03, 0x60];
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, ...code]));
  const knowledge = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts"), ...args], { cwd: project, encoding: "utf8" });
  writeFileSync(join(project, "batch.json"), JSON.stringify([
    { op: "rename", address: "$1000", name: "start", kind: "routine" },
    { op: "rename", address: "$00fb", name: "ptr" },
    { op: "macro", name: "inc16", params: ["dst"], body: "        inc .dst\n        bne +\n        inc .dst+1\n+" },
    { op: "macro", name: "short", params: ["dst"], body: "        inc .dst" },
    { op: "macro", name: "broken", params: ["dst"], body: "        lda .dst\n        lda no_such_name" },
    { op: "use", start: "$1000", end: "$1005", macro: "inc16", args: ["ptr"] },
    { op: "use", start: "$1006", end: "$100b", macro: "short", args: ["$fd"] },
    { op: "use", start: "$100c", end: "$1011", macro: "broken", args: ["$02"] },
  ]));
  assert.equal(knowledge("image", "test.prg").status, 0);
  assert.equal(knowledge("apply", "batch.json").status, 0);
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout);
  const json = JSON.parse(run.stdout) as { check: { identical: boolean }; files: Array<{ out: string }>; macroUses: number; macrosAsInstructions: { listed: Array<{ start: string; macro: string; reason: string }> } };
  assert.equal(json.check.identical, true);
  assert.deepEqual(json.files.map((file) => file.out), ["src/segment_1000.asm", "src/constants.asm", "src/macros.asm", "src/main.asm", "src/source-map.json"]);
  assert.equal(json.macroUses, 1);
  assert.deepEqual(json.macrosAsInstructions.listed.map((row) => [row.start, row.macro]), [["$1006", "short"], ["$100c", "broken"]]);
  assert.equal(json.macrosAsInstructions.listed[0]!.reason, "ACME assembles it to 2 bytes, and the range has 6.");
  assert.match(json.macrosAsInstructions.listed[1]!.reason, /^ACME refuses the macro broken: Value not defined \(no_such_name\)/);
  assert.match(readFileSync(join(project, "src", "segment_1000.asm"), "utf8"), /^start\n {8}\+inc16 ptr\n {8}inc \$fd\n/m);
});

test("an operand inside a named table without its own name is the table's name plus the offset", () => {
  // $1000 LDA $1015 / LDA $1018 / RTS; $1010-$101f a table named room_colours; $1018 is a reference target and gets no label of its own; $1003 in code keeps its label.
  const bytes = [0xad, 0x15, 0x10, 0xad, 0x18, 0x10, 0x60, ...Array.from({ length: 9 }, () => 0), ...Array.from({ length: 16 }, (_, index) => index)];
  const instructions = new Map([[0x1000, 3], [0x1003, 3], [0x1006, 1]]);
  const laid = layout(
    input(bytes, 0x1000, {
      instructions,
      symbols: [{ address: 0x1010, name: "room_colours" }],
      regions: [{ start: 0x1010, end: 0x101f, type: "bytes" }],
      referenceTargets: [0x1018, 0x1003],
    }),
  );
  const text = textOf(render(laid, new Set(), []), "segment_1000.asm");
  assert.match(text, / {8}lda room_colours\+5\nl_1003\n {8}lda room_colours\+8\n/);
  assert.doesNotMatch(text, /l_1015|l_1018/);
  // The table data has no label line at the offset: ACME refuses a label room_colours+5 (found on Bruce Lee).
  assert.doesNotMatch(text, /^room_colours\+5/m);
  assert.match(text, /^room_colours\n {8}!byte \$00,\$01,\$02,\$03,\$04,\$05,\$06,\$07\n/m);
});

test("an immediate stored to a register with a decoder gets the decoded value as a side comment; a knowledge side comment wins", () => {
  // $1000 LDA #$1b / STA $d011 / LDX #$15 / STX $d018 / LDA #$00 / STA $d020 (no decoder)
  const bytes = [0xa9, 0x1b, 0x8d, 0x11, 0xd0, 0xa2, 0x15, 0x8e, 0x18, 0xd0, 0xa9, 0x00, 0x8d, 0x20, 0xd0];
  const instructions = new Map([[0x1000, 2], [0x1002, 3], [0x1005, 2], [0x1007, 3], [0x100a, 2], [0x100c, 3]]);
  const laid = layout(input(bytes, 0x1000, { instructions, decode, comments: [{ address: 0x1007, placement: "side", text: "Charset at $1000." }] }));
  const text = textOf(render(laid, new Set(), []), "segment_1000.asm");
  assert.match(text, /sta \$d011 +; \$d011: yScroll 3, rows 25, displayEnabled, rasterBit8 0\n/);
  assert.match(text, /stx \$d018 +; Charset at \$1000\.\n/);
  assert.match(text, /sta \$d020\n/);
});
