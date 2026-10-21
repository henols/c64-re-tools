// The c64-source generator: the ACME opcode table, the layout and text
// of the source, the loader plan, and with real ACME and Ghidra the
// byte-identical round trip. The ACME and Ghidra parts are skipped (never
// passed) when the tool is not installed.

import assert from "node:assert/strict";
import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE, instructionLength } from "../../src/c64.ts";
import { assemble } from "../../src/native/acme.ts";
import { ACME, EXOMIZER, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";
import { localToolContext } from "../../src/native/local.ts";
import { ciaSection, copyOrder, loaderLimits, packLoader, planLoader, loaderState, loaderSymbols, simulate, START_SCREEN_CODE, START_SCREEN_FILE, START_SCREEN_SIZES, startScreenPlan, stopCause, type EntryCia, type EntryState } from "../../skills/c64-source/scripts/lib/loader.ts";
import { WireFailure } from "../../src/protocol/messages.ts";
import { MODE_LENGTH, OPCODES } from "../../src/opcodes.ts";
import { configText, configValues, entriesInData, entryOutsideImage, layout, render, type SourceInput, type SourceSwitch } from "../../skills/c64-source/scripts/lib/source.ts";
import { planStage, STAGE_CODE_END, STAGE_FILE, stageParts, type StageInput } from "../../skills/c64-source/scripts/lib/stage.ts";
import { decode, describeAddress, platformNames } from "../../src/platform.ts";
import type { StartScreenRow } from "../../src/knowledge/read.ts";
import { readEnvelope, seededBytes } from "../kit.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}
let exomizerSkip: string | false = acmeSkip;
try {
  findTool(EXOMIZER);
} catch {
  exomizerSkip ||= "Exomizer is not installed: install exomizer or set C64RT_EXOMIZER to run these tests";
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

test("a comment at an operand byte (knowledge of an older version) shows with its address in the side comment, as in the listing", () => {
  // $1bc9 LDA $0104, $1bcc RTS.
  const bytes = [0xad, 0x04, 0x01, 0x60];
  const instructions = new Map([[0x1bc9, 3], [0x1bcc, 1]]);
  const comments: SourceInput["comments"] = [{ address: 0x1bc9, placement: "side", text: "the mode" }, { address: 0x1bca, placement: "side", text: "mid-instruction comment" }];
  const text = textOf(render(layout(input(bytes, 0x1bc9, { instructions, comments })), new Set(), []), "segment_1bc9.asm");
  assert.match(text, /lda \$0104 +; the mode \$1bca: mid-instruction comment\n/);
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
  assert.throws(() => layout(input(bytes, 0x1000, { symbols: [{ address: 0x1000, name: "inc" }] })), /The symbol inc at \$1000: inc is the name of a 6502 instruction, which ACME cannot read as a label/);
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

test("the loader plan puts the copier on free pages, and a loader that would load into the I/O area gets the packed form", () => {
  const byteAt = () => 0;
  const header: string[] = [];
  const large = planLoader({ segments: [{ start: 0x1000, end: 0xdfff, files: ["a.asm"] }], byteAt, state: state(), entry: 0x1000, header });
  assert.deepEqual(large.packed, { start: 0x0b00 });
  assert.equal(large.copier, 0x0b00, "the highest free page with room below the segment");
  const plan = planLoader({ segments: [{ start: 0x0801, end: 0x0fff, files: ["a.asm"] }, { start: 0xc000, end: 0xc3ff, files: ["b.asm"] }], byteAt, state: state(), entry: 0x0810, header });
  assert.equal(plan.copier, 0xc400);
  assert.equal(plan.stackByte, 0x01f6);
  assert.match(plan.text, /ldx #\$f5\n {8}txs\n {8}lda #\$24\n {8}sta \$01f6/);
  assert.match(plan.text, /\n {8}plp\nc64_source_loader_jump jmp \$0810\n/, "the check of the loader stops at this label");
  assert.doesNotMatch(plan.text, /macros\.asm/);
  const withMacros = planLoader({ segments: [{ start: 0x0801, end: 0x0fff, files: ["a.asm"] }], byteAt, state: state(), entry: 0x0810, header, macros: true });
  assert.match(withMacros.text, /^!source "constants\.asm"\n!source "macros\.asm"\n/m, "the source of the loader has the macros");
});

test("an image too large for one loader file gets a packed loader: the copier at a free range writes only the parts below $0400", () => {
  // Found in a field run on a 62 KB game: the end of the plain loader was past $ffff, and the address check threw instead of a reason.
  const byteAt = (address: number) => address & 0xff;
  const header: string[] = [];
  const plan = planLoader({ segments: [{ start: 0x0300, end: 0x0fff, files: ["a.asm"] }, { start: 0x2000, end: 0xffff, files: ["b.asm"] }], byteAt, state: state(), entry: 0x0810, entryName: "start", header });
  assert.deepEqual(plan.packed, { start: 0x1b00 });
  assert.equal(plan.copier, 0x1b00, "the highest free page with room for the copier and the bytes of pages 0-3");
  // 167 bytes of copier code, a table of 2 copies and its end, then 766 + 256 bytes of pages 0-3.
  assert.equal(plan.end, 0x1b00 + 167 + 2 * 7 + 2 + 766 + 256 - 1);
  assert.deepEqual(
    plan.copies.map((copy) => [copy.what, copy.target.start, copy.target.end, copy.source.start]),
    [
      ["entry state $0002-$02ff", 0x0002, 0x02ff, 0x1b00 + 183],
      ["segment $0300-$0fff, part $0300-$03ff", 0x0300, 0x03ff, 0x1b00 + 183 + 766],
    ],
  );
  assert.match(plan.text, /\n\* = \$1b00\nloader_copier_src\n!zone loader_copier \{\n/);
  assert.match(plan.text, /\nc64_source_loader_jump jmp \$0810 ; start in main\.asm\n/, "main.asm, which has the label, is not in this build");
  assert.match(plan.text, /\n {8}!word loader_end_0300 - loader_from_0300, loader_from_0300, \$0300 : !byte 0 ; segment \$0300-\$0fff, part \$0300-\$03ff\n/);
  assert.match(plan.text, /--entry '\$1b00' and --exit-memory '\$34'/);
  assert.doesNotMatch(plan.text, /!source|!pseudopc/, "the segments are not in loader.asm");

  // Without a free page with room, the copier goes to the start of a free range.
  const unaligned = planLoader({ segments: [{ start: 0x0400, end: 0x1234, files: ["a.asm"] }, { start: 0x1700, end: 0xffff, files: ["b.asm"] }], byteAt, state: state(), entry: 0x0810, header });
  assert.equal(unaligned.copier, 0x1235);
  assert.equal(unaligned.end, 0x1235 + 167 + 7 + 2 + 1022 - 1);
  assert.deepEqual(unaligned.copies.map((copy) => copy.what), ["entry state $0002-$03ff"]);

  // Without free room, the refusal names the end past $ffff, the sizes and the free ranges.
  assert.throws(
    () => planLoader({ segments: [{ start: 0x0400, end: 0x0bff, files: ["a.asm"] }, { start: 0x0c10, end: 0xffff, files: ["b.asm"] }], byteAt, state: state(), entry: 0x0810, header }),
    (error: Error) => {
      assert.ok(error instanceof WireFailure);
      assert.equal(error.message, "The plain loader would end past $ffff, after $cfff: loading it would write the I/O area. A packed loader needs one free range of 176 bytes or more for its copier, and 1022 more free bytes for pages 0-3, in $0400-$9fff or $c000-$cfff outside the segments. The largest free ranges there: $0c00-$0c0f (16 bytes). Write the loader by hand.");
      return true;
    },
  );
});

test("with real ACME, a packed loader puts the copier in one free range and pages 0-3 in pieces in other ranges, with the image bytes between them", { skip: acmeSkip }, async () => {
  // Found in a field run on a 57 KB game: no free range held the copier and pages 0-3 together.
  // Free: $c000-$c2ff and $c400-$c5ff. The copier with a part of pages 0-3 fills $c000-$c2ff; the rest goes to $c400.
  const byteAt = (address: number) => (address * 3) & 0xff;
  const pages = Uint8Array.from({ length: 0x400 }, (_, index) => (index * 13 + 5) & 0xff);
  const segments = [{ start: 0x0400, end: 0xbfff }, { start: 0xc300, end: 0xc3ff }, { start: 0xc600, end: 0xffff }];
  const plan = planLoader({ segments: segments.map((segment) => ({ ...segment, files: [] })), byteAt, state: state({ pages }), entry: 0x0810, header: [] });
  assert.deepEqual(plan.packed, { start: 0xc000 });
  assert.equal(plan.copier, 0xc000);
  assert.deepEqual(
    plan.copies.map((copy) => [copy.what, copy.target.start, copy.target.end, copy.source.start]),
    [
      ["entry state $0002-$03ff, bytes $0002-$024a", 0x0002, 0x024a, 0xc000 + 167 + 2 * 7 + 2],
      ["entry state $0002-$03ff, bytes $024b-$03ff", 0x024b, 0x03ff, 0xc400],
    ],
  );
  assert.equal(plan.end, 0xc400 + 0x03ff - 0x024b);
  const contents = [Buffer.from(plan.text)];
  const { result, attachments } = await assemble({ files: [{ path: "loader.asm", size: contents[0]!.length }], entrySource: "loader.asm", includeDirs: [], defines: {} }, contents, localToolContext());
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  const program = attachments![0]!;
  assert.equal(program.readUInt16LE(0), 0xc000);
  assert.equal(program.length - 2, plan.end - 0xc000 + 1);
  const memory = new Int16Array(0x10000).fill(-1);
  program.subarray(2).forEach((byte, offset) => (memory[0xc000 + offset] = byte));
  for (let address = 0xc300; address <= 0xc3ff; address++) assert.equal(memory[address], byteAt(address), "the build keeps the bytes of the segment between the ranges");
  assert.equal(simulate(memory, plan.copies, (address) => pages[address]!), undefined);
});

test("a loader that stops early names the first copier byte that is not the file's byte, and else the first byte that a copy did not write", () => {
  // Found in a field run on a 46 KB game: the only message was the address where the loader stopped.
  const plan = { loaded: [{ start: 0x1000, end: 0x10ff }], blocks: [], copies: [{ what: "segment $1000-$10ff", target: { start: 0x1000, end: 0x10ff }, source: { start: 0x0900, end: 0x09ff }, backward: false }], copier: 0xc000, stackByte: 0x01f6, end: 0xa0ff, text: "" };
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
  // The packed form: the unpack puts the copier in place.
  ram[0xc010] = 0x00;
  assert.equal(stopCause(ram, { ...plan, end: 0xc0ff, packed: { start: 0xc000 } }, 0xc000, (address) => file(address + 0xa000 - 0xc000), false, expected), `The copier at $c010 holds $00, not $${file(0xa010).toString(16).padStart(2, "0")} of the build of loader.asm: the unpack did not write it.`);
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

test("a loader for a start screen of a captured stage is always the packed form, also for a small program", () => {
  const segments = [{ start: 0x1000, end: 0x10ff, files: [] }];
  assert.equal(planLoader({ segments, byteAt: () => 0xea, state: state(), entry: 0x1000, header: [] }).packed, undefined);
  assert.notEqual(planLoader({ segments, byteAt: () => 0xea, state: state(), entry: 0x1000, header: [], packed: true }).packed, undefined);
});

test("a plain loader with more copies than its copier can do gets the packed form, for example for many leftovers", () => {
  // 40 parts of 4 bytes, as the leftovers between them give.
  const segments = Array.from({ length: 40 }, (_, index) => ({ start: 0x1000 + index * 16, end: 0x1003 + index * 16, files: [] }));
  const plan = planLoader({ segments, byteAt: () => 0xea, state: state(), entry: 0x1000, header: [] });
  assert.notEqual(plan.packed, undefined);
  assert.deepEqual(plan.loaded, segments.map(({ start, end }) => ({ start, end })));
});

test("with real ACME and Exomizer, a 62 KiB image with RAM at $d000-$dfff packs into loader.prg that unpacks to every byte and jumps to the copier", { skip: exomizerSkip, timeout: 600_000 }, async () => {
  // $0801-$bfff and $c800-$ffff: the copier with pages 0-3 goes to $c000.
  const segments = [{ start: 0x0801, end: 0xbfff }, { start: 0xc800, end: 0xffff }];
  // Bytes that pack badly to $5fff and under the I/O area, NOPs elsewhere. Exomizer takes minutes for some regular patterns.
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) memory.fill(0xea, segment.start, segment.end + 1);
  memory.set(seededBytes(3, 0x6000 - 0x0801), 0x0801);
  memory.set(seededBytes(4, 0x1000), 0xd000);
  const source: SourceInput = { ...input([0], 0x0801, { regions: segments.map((segment) => ({ ...segment, type: "bytes" as const })) }), segments, byteAt: (address) => memory[address]! };
  const rendered = render(layout(source), new Set(), []);
  const pages = Uint8Array.from({ length: 0x400 }, (_, index) => (index * 13 + 5) & 0xff);
  const plan = planLoader({ segments: segments.map((segment) => ({ ...segment, files: [] })), byteAt: source.byteAt, state: state({ pages }), entry: 0x0810, header: [] });
  assert.deepEqual(plan.packed, { start: 0xc000 });
  assert.equal(plan.copier, 0xc000);
  const build = async (files: Array<{ name: string; text: string }>, entrySource: string) => {
    const contents = files.map((file) => Buffer.from(file.text));
    const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource, includeDirs: [], defines: {} }, contents, localToolContext());
    assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
    return attachments![0]!;
  };
  const files = [...rendered.files, { name: "loader.asm", text: plan.text }];
  const main = await build(files, "main.asm");
  const copier = await build(files, "loader.asm");
  assert.equal(copier.readUInt16LE(0), 0xc000);
  assert.equal(copier.length - 2, plan.end - 0xc000 + 1, "the build has the planned size");
  // The copies of the copier give pages $0002-$03ff.
  const after = new Int16Array(0x10000).fill(-1);
  copier.subarray(2).forEach((byte, offset) => (after[0xc000 + offset] = byte));
  assert.equal(simulate(after, plan.copies, (address) => pages[address]!), undefined);

  // The unpack in the emulator of Exomizer gives every byte of both builds, also under the I/O area, and jumps to the copier; else packLoader refuses.
  const packed = await packLoader(main, copier, plan, localToolContext());
  assert.equal(packed.program.readUInt16LE(0), 0x0801);
  assert.equal(packed.unpackedBytes, 0xc000 - 0x0801 + 0x10000 - 0xc800 + plan.end - 0xc000 + 1, "the loaded ranges of main.asm and the copier: the gap between the segments is not packed");
  assert.ok(packed.packedBytes < packed.unpackedBytes, JSON.stringify({ packed: packed.packedBytes }));
});

/** A start screen of the knowledge: a Koala picture at $6000 in VIC bank 1. */
const koala = (overrides: Partial<StartScreenRow> = {}): StartScreenRow => ({ space: "c64", mode: "multicolour", screen: 0x5c00, bitmap: 0x6000, colours: 0x7f40, border: 0, background: 6, origin: "llm", revision: "r", ...overrides });
/** An entry state with the VIC-II, as a capture of this version has it. */
const vicState = (overrides: Partial<EntryState> = {}) => state({ vic: { registers: new Uint8Array(0x2f), bank: 3 }, ...overrides });

test("a start screen gives the VIC-II values from its addresses, and the loader refuses one that is not in the program or a state without the VIC-II", () => {
  assert.deepEqual(startScreenPlan(koala()), { d011: 0x3b, d016: 0x18, d018: 0x79, bank: 1, border: 0, background: 6, colourMode: 2 });
  assert.deepEqual(startScreenPlan(koala({ mode: "text", screen: 0x0400, bitmap: undefined as never, charset: 0x1000, colours: undefined as never, colour: 14 })), { d011: 0x1b, d016: 0x08, d018: 0x15, bank: 0, border: 0, background: 6, colourMode: 1 });
  assert.equal(startScreenPlan(koala({ mode: "hires", screen: 0xcc00, bitmap: 0xe000, colours: undefined as never })).d018, 0x39);
  const byteAt = () => 0;
  const segments = [{ start: 0x4000, end: 0x8fff, files: ["a.asm"] }];
  assert.throws(() => planLoader({ segments, byteAt, state: state(), entry: 0x4000, header: [], startScreen: koala() }), /no VIC-II values/);
  assert.throws(() => planLoader({ segments: [{ start: 0x4000, end: 0x8000, files: ["a.asm"] }], byteAt, state: vicState(), entry: 0x4000, header: [], startScreen: koala() }), /The start screen part colours \(\$7f40-\$8327\) is not in one segment/);
  const plan = planLoader({ segments, byteAt, state: vicState(), entry: 0x4000, header: [], config: true, startScreen: koala({ comment: "The loading picture." }) });
  assert.match(plan.text, /^!source "config\.asm"\n!source "constants\.asm"\n\n; The start screen: multicolour, screen \$5c00, bitmap \$6000\. The loading picture\.\nc64_source_ss_d011 = \$3b\n/m);
  assert.match(plan.text, /\nc64_source_ss_bank = \$02 ; VIC bank \$4000-\$7fff\n/);
  assert.match(plan.text, /\n\.done\n!zone c64_source_start_screen \{\n!source "start_screen\.asm"\n\}\n {8}lda #\$35\n/, "after the copies, before the VIC-II part");
  assert.match(plan.text, /lda loader_copier_src\+\$200,x\n {8}sta \$c200,x\n/, "the stub moves three pages");
  assert.equal(plan.copier, 0xc000);
  assert.deepEqual(plan.startScreen, startScreenPlan(koala()));
  const packed = planLoader({ segments: [{ start: 0x0801, end: 0xbfff, files: ["a.asm"] }, { start: 0xd000, end: 0xdfff, files: ["b.asm"] }], byteAt, state: vicState(), entry: 0x0810, header: [], switches: true, startScreen: koala() });
  assert.ok(packed.packed !== undefined);
  assert.match(packed.text, /^!source "switches\.asm"\n\n; The start screen/m, "the packed form reads the switches too");
});

test("config.asm has START_SCREEN with the default 1 when the knowledge has a start screen, and keeps a 0", () => {
  const rendered = render(layout(input([0xea], 0x1000, { startScreen: true })), new Set(), []);
  assert.match(textOf(rendered, "config.asm"), /\n; Start screen: on by default\nSTART_SCREEN = 1 ; the loader shows the start screen/);
  // A release is the bytes of its file: its build has no start screen.
  const release = render(layout(input([0xea], 0x1000, { startScreen: true, releases: [{ label: "ORIGINAL", file: "original.prg", base: true }] })), new Set(), []);
  assert.match(textOf(release, "switches.asm"), /!ifdef RELEASE_ORIGINAL \{\n {8}START_SCREEN = 0\n\}/);
  assert.equal(rendered.files.some((file) => file.name === "switches.asm"), false, "without releases there is no switches.asm");
  assert.deepEqual([...configValues(configText({ switches: [], patches: new Map(), startScreen: true, leftovers: [] }, new Map([["START_SCREEN", 0]])))], [["START_SCREEN", 0]]);
  assert.equal(render(layout(input([0xea], 0x1000)), new Set(), []).files.some((file) => file.name === "config.asm"), false);
});

test("with real ACME, the start screen code has its planned size in each colour mode, for START_SCREEN 0 and 1", { skip: acmeSkip }, async () => {
  for (const [mode, size] of START_SCREEN_SIZES.entries()) {
    for (const on of [0, 1]) {
      const values = { d011: 0x3b, d016: 0x18, d018: 0x79, bank: 2, border: 0, background: 6, colour_mode: mode, colour: 1, colours: 0x7f40 };
      const text = ["!cpu 6510", "* = $c000", ...Object.entries(values).map(([name, value]) => `c64_source_ss_${name} = ${value}`), `START_SCREEN = ${on}`, '!zone c64_source_start_screen {', '!source "start_screen.asm"', "}"].join("\n");
      const files = [{ path: "test.asm", text }, { path: "start_screen.asm", text: START_SCREEN_CODE }];
      const contents = files.map((file) => Buffer.from(file.text));
      const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.path, size: contents[index]!.length })), entrySource: "test.asm", includeDirs: [], defines: {} }, contents, localToolContext());
      assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
      assert.equal(attachments![0]!.length - 2, size, `colour mode ${mode}, START_SCREEN ${on}`);
      const label = (name: string) => result.symbols!.some((symbol) => symbol.name === name);
      assert.ok(label("loader_start_screen_wait") && label("loader_start_screen_continue"));
    }
  }
});

test("with real ACME, a loader with a start screen assembles to its planned layout in the plain and the packed form", { skip: acmeSkip }, async () => {
  const bytes = Array.from({ length: 0x8000 }, (_, offset) => offset & 0xff);
  const source = input(bytes, 0x0800, { regions: [{ start: 0x0800, end: 0x87ff, type: "bytes" }], startScreen: true });
  const rendered = render(layout(source), new Set(), []);
  const build = async (text: string) => {
    const files = [...rendered.files, { name: "loader.asm", text }, { name: "start_screen.asm", text: START_SCREEN_CODE }];
    const contents = files.map((file) => Buffer.from(file.text));
    const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "loader.asm", includeDirs: [], defines: {} }, contents, localToolContext());
    assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
    return { program: attachments![0]!, symbols: result.symbols! };
  };
  for (const row of [koala(), koala({ colours: undefined as never, colour: 3 }), koala({ mode: "hires", colours: undefined as never })]) {
    const plan = planLoader({ segments: [{ start: 0x0800, end: 0x87ff, files: ["segment_0800.asm"] }], byteAt: source.byteAt, state: vicState({ pc: 0x0800 }), entry: 0x0800, header: [], config: true, startScreen: row });
    const { program, symbols } = await build(plan.text);
    assert.equal(program.length - 2, plan.end - 0x0801 + 1, `the plan has the size of the code, ${row.mode}`);
    const wait = symbols.find((symbol) => symbol.name === "loader_start_screen_wait")!;
    const at = wait.kind === "address" ? wait.address : wait.value;
    assert.ok(at > plan.copier && at < plan.copier + 0x300, "the start screen runs in the copier pages");
  }
  const packedSource: SourceInput = { ...input([], 0x0800, { startScreen: true }), segments: [{ start: 0x0800, end: 0xbfff }, { start: 0xd000, end: 0xdfff }], byteAt: (address) => address & 0xff };
  const packedRendered = render(layout(packedSource), new Set(), []);
  const packed = planLoader({ segments: [{ start: 0x0800, end: 0xbfff, files: ["segment_0800.asm"] }, { start: 0xd000, end: 0xdfff, files: ["segment_d000.asm"] }], byteAt: packedSource.byteAt, state: vicState({ pc: 0x0800 }), entry: 0x0800, header: [], config: true, startScreen: koala() });
  const files = [...packedRendered.files, { name: "loader.asm", text: packed.text }, { name: "start_screen.asm", text: START_SCREEN_CODE }];
  const contents = files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: "loader.asm", includeDirs: [], defines: {} }, contents, localToolContext());
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.equal(attachments![0]!.length - 2, packed.end - packed.packed!.start + 1, "the packed form has its planned layout");
});

test("an entry state file is read with its flags as PLP reads them, and a wrong one is refused", () => {
  const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page) => [page, "00".repeat(256)]));
  const read = loaderState({ registers: { pc: "$0810", a: 1, x: 2, y: 3, sp: 0xf0, flags: { n: true, i: true, c: true } }, cpuPort: { $00: 0x2f, $01: 0x35 }, pages }, "e.json");
  assert.equal(read.flags, 0xa5);
  assert.deepEqual(read.port, [0x2f, 0x35]);
  assert.throws(() => loaderState({ registers: { pc: "$0810" } }, "e.json"), /e\.json is not an entry state of a program capture: registers\.a is not a byte/);
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
  assert.match(rendered.operandsAsNumbers[2]!.reason, /^nowhere is not a symbol of the knowledge or a platform name\. Name the address in the project knowledge, or record the operand expression again\.$/);
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
  // Files of an earlier run go, files of a person stay, and so does the loader of an earlier run with --loader.
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "segment_9000.asm"), "; Generated by c64-source. Do not edit: change the knowledge and generate again.\n");
  writeFileSync(join(project, "src", "loader.asm"), "; Generated by c64-source. Do not edit: change the knowledge and generate again.\n");
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
  const json = readEnvelope(stdout, status).json as { result: string; check: { identical: boolean }; asBytes: { listed: Array<{ address: string; instruction: string }> }; files: Array<{ out: string; bytes: number; sha256: string }>; removed: string[] };
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
  assert.deepEqual(readdirSync(join(project, "src")).sort(), ["constants.asm", "loader.asm", "loader.prg", "main.asm", "notes.asm", "segment_1000.asm", "source-map.json"]);
  assert.deepEqual(json.removed.sort(), ["src/not_executed.json", "src/segment_9000.asm"], "the result lists each file that the run removed");
  // The kept loader.asm has no knowledge revision, and the knowledge has no entry state to write it again.
  assert.deepEqual((readEnvelope(stdout, status).json as { staleLoader: unknown }).staleLoader, { files: ["src/loader.asm", "src/loader.prg"], noEntryState: true });
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
  const notExecuted = (readEnvelope(covered.stdout, covered.status).json as { notExecuted: { count: number; rest?: string } }).notExecuted;
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

test("with real Ghidra and ACME, generate tells which leftovers changed since the earlier run", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // 10 SYS2061, $080d RTS, then 16 bytes that nothing uses. The BASIC line gives the entry, and it stays.
  const basic = [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x01, 0x08, ...basic, 0x60, ...Array.from({ length: 16 }, (_, index) => index + 1)]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  const write = (...args: string[]) => assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, ...args], { cwd: project, encoding: "utf8" }).status, 0, args.join(" "));
  const coverage = new Uint8Array(0x10000);
  coverage[0x080d] = COVERAGE.ramExecute;
  writeFileSync(join(project, "run.bin"), coverage);
  write("image", "test.prg");
  write("rename", "$080d", "start", "--kind", "routine");
  write("classify", "$0801-$080c", "bytes");
  write("classify", "$080e-$081d", "bytes");
  write("coverage", "run.bin");
  const generate = () => {
    const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout);
    return (readEnvelope(run.stdout, run.status).json as { leftovers?: { bytes: number; changed?: unknown } }).leftovers;
  };
  // The first run has no earlier run to compare with.
  assert.deepEqual(generate(), { bytes: 16, count: 1, listed: [{ start: "$080e", end: "$081d", bytes: 16, file: "leftover_080e.asm" }] });
  // A charset stays: the leftovers of the next run lose its bytes.
  write("classify", "$0816-$081d", "charset");
  assert.deepEqual(generate()?.changed, { added: [], removed: [{ start: "$0816", end: "$081d" }] });
  // The same knowledge again: nothing changed.
  assert.equal(generate()?.changed, undefined);
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
  // An operand expression is for an instruction of a code region.
  write("classify", "$1000-$100b", "code");
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
  const json = readEnvelope(generated.stdout, generated.status).json as { check: { identical: boolean }; operandExpressions: number; operandsAsNumbers: unknown };
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
  // One segment of $0400-$ffff: too large for the plain loader, and no free range for the copier of the packed form. $1000 is RTS.
  const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  const segments = [{ start: 0x0400, end: 0xffff }];
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
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const json = readEnvelope(run.stdout, run.status).json as { result: string; check: { identical: boolean }; files: Array<{ out: string }>; loader: { verified: boolean; reason: string } };
  assert.equal(json.result, "FAIL");
  assert.equal(json.check.identical, true);
  assert.ok((json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("main.asm") && !(json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("loader.asm"));
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, /A packed loader needs one free range of \d+ bytes or more for its copier/);
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
  const reason = /^The entry \$0801 is in no segment of the image: the image does not hold the program\. Capture the program again, so that a segment holds the entry\./;
  const withLoader = generate("--loader");
  assert.equal(withLoader.status, 0, withLoader.stdout + withLoader.stderr);
  const { envelope, json } = readEnvelope(withLoader.stdout, withLoader.status) as { envelope: { hint?: string; nextAction?: string }; json: { result: string; check: { identical: boolean }; files: Array<{ out: string }>; entryOutside: { entry: string; reason: string }; loader: { verified: boolean; reason: string } } };
  assert.equal(json.result, "FAIL");
  assert.match(envelope.hint!, /Capture the program again, so that a segment holds the entry/);
  assert.match(envelope.nextAction!, /^node \/.*source\.ts generate --out src --entry '\$1000' --loader --project /, "the same generate command, to run after the capture");
  assert.equal(json.check.identical, true);
  assert.ok((json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("main.asm") && !(json.files.map((file) => file.out.split("/").at(-1)!).filter((name) => name.endsWith(".asm"))).includes("loader.asm"));
  assert.equal(json.entryOutside.entry, "$0801");
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, reason);
  const source = generate();
  assert.equal(source.status, 0, source.stdout + source.stderr);
  const sourceJson = readEnvelope(source.stdout, source.status).json as { result: string; entryOutside: { reason: string } };
  assert.equal(sourceJson.result, "FAIL");
  assert.match(sourceJson.entryOutside.reason, reason);
  // With no --entry and no knowledge, the image has no seed for Ghidra: still entryOutside, not a usage error.
  const unseeded = generate("--no-seed", "--loader");
  assert.equal(unseeded.status, 0, unseeded.stdout + unseeded.stderr);
  const data = readEnvelope(unseeded.stdout, unseeded.status).json as { result: string; instructions: number; entryOutside: { reason: string }; loader: { verified: boolean } };
  assert.equal(data.result, "FAIL");
  assert.equal(data.instructions, 0);
  assert.match(data.entryOutside.reason, reason);
  assert.equal(data.loader.verified, false);
});

test("with real ACME, a space with no known code gives a source of data only, without an entry and without Ghidra", { skip: acmeSkip, timeout: 120_000 }, () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // A key page in a cartridge bank: 256 bytes of data, no entry, no routine and no code region.
  writeFileSync(join(project, "keys.prg"), Buffer.from([0x00, 0xcf, ...Array.from({ length: 256 }, (_, index) => (index * 7) & 0xff)]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  for (const args of [["image", "keys.prg", "--space", "bank3"], ["classify", "$cf00-$cf7f", "bytes", "--space", "bank3"]]) {
    assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, ...args], { cwd: project }).status, 0, args.join(" "));
  }
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--space", "bank3", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1", C64RT_GHIDRA: join(project, "no-ghidra") },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const { envelope, json } = readEnvelope(run.stdout, run.status) as { envelope: { hint?: string; nextAction?: string }; json: { result: string; instructions: number; dataBytes: number; dataOnly: string; check: { identical: boolean } } };
  assert.deepEqual([json.result, json.instructions, json.dataBytes, json.check.identical], ["PASS", 0, 256, true]);
  assert.match(json.dataOnly, /^The knowledge has no entry, routine, code region or executed address in this space\. Thus the source has only data\. For instructions, give --entry, or record a code region in the project knowledge\./);
  assert.match(envelope.hint!, /record a code region in the project knowledge\. Then generate again\.$/);
  assert.match(envelope.nextAction!, /^node \/.*source\.ts generate --out src --space bank3 --project /);
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
  assert.match(loaderLimits({}).join("\n"), /no CIA values.*Capture the program again at its entry point/, "an entry state from an older version");
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

/** The rendered files with each value set in config.asm, as a user edits it. */
function withConfig(rendered: ReturnType<typeof render>, values: Record<string, number>): ReturnType<typeof render> {
  const set = (text: string) => Object.entries(values).reduce((out, [name, value]) => out.replace(new RegExp(`^(${name} *= )[01]`, "m"), `$1${value}`), text);
  return { ...rendered, files: rendered.files.map((file) => (file.name === "config.asm" ? { ...file, text: set(file.text) } : file)) };
}

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

test("a range of leftovers is a file of its own that only LEFTOVERS = 1 builds; the module that it cuts goes on in a file of its own", () => {
  const source = patchInput([], { modules: [{ start: 0x1000, file: "game.asm", title: "The game" }], leftovers: [{ start: 0x1008, end: 0x100b }], releases: [{ label: "ORIGINAL", file: "original.prg", base: true }] });
  const laid = layout(source);
  assert.deepEqual(laid.pieces.map((piece) => [piece.file, piece.start, piece.end, piece.leftover]), [["game.asm", 0x1000, 0x1007, false], ["leftover_1008.asm", 0x1008, 0x100b, true], ["game_100c.asm", 0x100c, 0x1013, false]]);
  assert.equal(laid.pieces[2]!.title, "The game, from $100c");
  const rendered = render(laid, new Set(), []);
  assert.match(textOf(rendered, "main.asm"), /!source "game\.asm"\n!if LEFTOVERS \{ !source "leftover_1008\.asm" \} else \{ !skip 4 \}\n!source "game_100c\.asm"\n/);
  assert.match(textOf(rendered, "main.asm"), /!source "switches\.asm"/, "main.asm gets LEFTOVERS from switches.asm");
  assert.match(textOf(rendered, "config.asm"), /\n; Leftovers: off by default\nLEFTOVERS = 0 ; 4 bytes in 1 leftover_xxxx\.asm file that nothing uses\./);
  assert.match(textOf(rendered, "switches.asm"), /!ifdef RELEASE_ORIGINAL \{\n {8}LEFTOVERS = 1\n\}/, "each release has the leftovers");
  assert.match(textOf(rendered, "leftover_1008.asm"), /^; Leftovers \$1008-\$100b: 4 bytes that nothing uses\./);
  // A module that starts in the leftovers goes on after them.
  const inside = layout(patchInput([], { modules: [{ start: 0x1000, file: "game.asm" }, { start: 0x100a, file: "table.asm", title: "The table" }], leftovers: [{ start: 0x1008, end: 0x100b }] }));
  assert.deepEqual(inside.pieces.map((piece) => [piece.file, piece.start, piece.end]), [["game.asm", 0x1000, 0x1007], ["leftover_1008.asm", 0x1008, 0x100b], ["table_100c.asm", 0x100c, 0x1013]]);
  assert.equal(inside.pieces[2]!.title, "The table, from $100c");
  // Without releases and switches, switches.asm only includes config.asm.
  const alone = render(layout(patchInput([], { leftovers: [{ start: 0x1008, end: 0x100b }] })), new Set(), []);
  assert.equal(textOf(alone, "switches.asm").trimEnd().split("\n").at(-1), '!source "config.asm"');
  assert.equal(render(layout(patchInput([])), new Set(), []).files.some((file) => file.name === "config.asm"), false, "no leftovers, no config.asm");
});

test("with real ACME, the source with LEFTOVERS = 1 gives the program, and with 0 it leaves out the leftovers and keeps every address", { skip: acmeSkip }, async () => {
  const source = patchInput([], { leftovers: [{ start: 0x1008, end: 0x100b }] });
  const laid = layout(source);
  const rendered = render(laid, new Set(), []);
  const original = Array.from({ length: 20 }, (_, offset) => source.byteAt(0x1000 + offset));
  const withLeftovers = { ...rendered, files: rendered.files.map((file) => (file.name === "config.asm" ? { ...file, text: configText(laid, new Map([["LEFTOVERS", 1]])) } : file)) };
  assert.deepEqual((await assembleRendered(withLeftovers)).bytes, original);
  const clean = (await assembleRendered(rendered)).bytes!;
  assert.equal(clean.length, original.length);
  assert.deepEqual([...clean.slice(0, 8), ...clean.slice(12)], [...original.slice(0, 8), ...original.slice(12)], "the bytes after the leftovers keep their addresses");
  assert.notDeepEqual(clean.slice(8, 12), original.slice(8, 12));
});

test("the show stage runs where the KERNAL can be in, and puts the loader bytes under the stage in a stash; without room it refuses with the free ranges", () => {
  const row: StartScreenRow = { space: "c64", mode: "multicolour", screen: 0xcc00, bitmap: 0xe000, colours: 0x8328, border: 0, background: 6, stage: "bank1", call: 0x0a00, origin: "llm", revision: "r" };
  const stageInput = (inner: StageInput["inner"], stage: StageInput["stage"]): StageInput => ({ inner, innerStart: 0x080d, innerPort: 0x37, stage, row, plan: startScreenPlan(row), settings: [], header: [], codeSize: 300 });
  const plan = planStage(stageInput([{ start: 0x0801, body: new Uint8Array(0x500) }], [{ start: 0x0a00, body: new Uint8Array(0x20) }, { start: 0xcc00, body: new Uint8Array(1000) }]));
  assert.equal(plan.code, 0x0400, "the first free range that the code fits");
  assert.deepEqual(plan.stash.map((item) => item.target), [{ start: 0x0a00, end: 0x0a1f }]);
  const at = plan.stash[0]!.at;
  assert.ok(at >= 0x0400 + 300 + 8 && at + 0x1f <= 0x0800, "the stash is in free memory after the code");
  assert.match(plan.text, /c64_source_ss_call = \$0a00 /);
  assert.match(plan.text, new RegExp(`!word 32, \\$${at.toString(16).padStart(4, "0")}, \\$0a00 ; \\$0a00-\\$0a1f of the loader`));
  assert.match(plan.text, /jmp \$080d\n/);
  // The colour RAM of the capture is in the show code: the start screen copies it from there.
  const { colours: _colours, ...picture } = row;
  const fromCapture: StartScreenRow = { ...picture, colourRam: true };
  const withColours = planStage({ ...stageInput([{ start: 0x0801, body: new Uint8Array(0x500) }], [{ start: 0xcc00, body: new Uint8Array(1000) }]), row: fromCapture, plan: startScreenPlan(fromCapture), colourRam: Uint8Array.from({ length: 1000 }, (_, index) => index & 0x0f), codeSize: 1300 });
  assert.match(withColours.text, /\nc64_source_ss_colour_mode = \$02\n/);
  assert.match(withColours.text, /\nc64_source_ss_colours = c64_source_stage_colours\n/);
  assert.match(withColours.text, /\nc64_source_stage_colours\n {8}!byte \$00,\$01,\$02,/);
  assert.equal((withColours.text.split("\nc64_source_stage_colours\n")[1]!.split("c64_source_stage_code_end")[0]!.match(/\$[0-9a-f]{2}/g) ?? []).length, 1000);
  assert.throws(() => planStage(stageInput([{ start: 0x0400, body: new Uint8Array(0xcc00) }], [{ start: 0xe000, body: new Uint8Array(8000) }])), /The show stage needs 308 free bytes for its code in \$0400-\$9fff or \$c000-\$cfff.* The largest free ranges outside the loader and the bytes of the stage: \$d000-\$dfff \(4096 bytes\)/);
});

test("with real ACME, the show stage builds when its code is high and the parts of the stage are large: each part is at its own address", { skip: acmeSkip }, async () => {
  const row: StartScreenRow = { space: "c64", mode: "multicolour", screen: 0x0400, bitmap: 0x2000, colours: 0x5800, border: 0, background: 6, stage: "loading", origin: "llm", revision: "r" };
  // The loader and the stage fill $0400-$bfff, so the code goes to $c000, and 17 KB of the stage is below it.
  const stage = [
    { start: 0x0400, body: Uint8Array.from({ length: 1000 }, (_, index) => index & 0xff) },
    { start: 0x2000, body: Uint8Array.from({ length: 0x4000 }, (_, index) => (index * 7) & 0xff) },
  ];
  const input: StageInput = { inner: [{ start: 0x0801, body: new Uint8Array(0x17ff).fill(0xea) }, { start: 0x6000, body: new Uint8Array(0x6000).fill(0xea) }], innerStart: 0x080d, innerPort: 0x37, stage, row, plan: startScreenPlan(row), settings: [], header: [], codeSize: 600 };
  const plan = planStage(input);
  assert.ok(plan.code >= 0xc000, "the code is high");
  assert.doesNotMatch(plan.text, /!pseudopc/);
  const files = [
    { name: START_SCREEN_FILE, text: START_SCREEN_CODE },
    { name: STAGE_FILE, text: plan.text },
  ];
  const contents = files.map((file) => Buffer.from(file.text));
  const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: STAGE_FILE, includeDirs: [], defines: {} }, contents, localToolContext());
  assert.equal(result.assembled, true, result.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
  const labels = new Map((result.symbols ?? []).map((symbol) => [symbol.name, symbol.kind === "address" ? symbol.address : symbol.value]));
  const parts = stageParts(input, plan, attachments![0]!, (name) => labels.get(name)!);
  for (const part of stage) assert.deepEqual([...parts.find((item) => item.start === part.start)!.body], [...part.body], `the part at ${part.start.toString(16)}`);
  assert.equal(parts.at(-1)!.start, plan.code);
  assert.equal(parts.at(-1)!.body.length, labels.get(STAGE_CODE_END)! - plan.code);
});

test("the symbols of loader.prg hold the labels of both builds, and refuse a name with two values", () => {
  const merged = loaderSymbols(
    [{ name: "main", kind: "address", address: 0x0810, used: true }, { name: "START_SCREEN", kind: "constant", value: 1, used: false }, { name: "game_start", kind: "constant", value: 0xc000, used: false }],
    [{ name: "loader_start_screen_wait", kind: "address", address: 0xc123, used: true }, { name: "START_SCREEN", kind: "constant", value: 1, used: true }, { name: "game_start", kind: "address", address: 0xc000, used: false }],
  );
  assert.deepEqual(merged.map((symbol) => [symbol.name, symbol.kind, symbol.used]), [["START_SCREEN", "constant", true], ["game_start", "address", false], ["loader_start_screen_wait", "address", true], ["main", "address", true]]);
  assert.throws(() => loaderSymbols([{ name: "main", kind: "address", address: 0x0810, used: true }], [{ name: "main", kind: "address", address: 0x0820, used: true }]), /give main two values, 2064 and 2080/);
});

/** A switch that no release has on: off in the program and, by default, off in the build. */
const offSwitch = (name: string): SourceSwitch => ({ name, kind: "change", default: 0, base: 0, releases: [] });

/** $1000 LDA #$00; $1002 STA $d020; $1005 JMP $1000; $1008 eight data bytes; $1010 LDA $1003; $1013 RTS. */
function patchInput(patches: NonNullable<SourceInput["patches"]>, overrides: Partial<SourceInput> = {}): SourceInput {
  const bytes = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x4c, 0x00, 0x10, 1, 2, 3, 4, 5, 6, 7, 8, 0xad, 0x03, 0x10, 0x60];
  const instructions = new Map([[0x1000, 2], [0x1002, 3], [0x1005, 3], [0x1010, 3], [0x1013, 1]]);
  const switches = [...new Set(patches.map((patch) => patch.switch))].map(offSwitch);
  return input(bytes, 0x1000, { instructions, regions: [{ start: 0x1008, end: 0x100f, type: "bytes" }], symbols: [{ address: 0x1002, name: "store" }], patches, switches, ...overrides });
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
  assert.match(textOf(rendered, "config.asm"), /\n; Other changes\nCRACK = 0 ; on in no release\. \$1000-\$1004\nDEBUG = 0 ; on in no release\. \$1008-\$100b\n$/);
  assert.match(textOf(rendered, "switches.asm"), /\n\n!source "config\.asm"\n$/, "without releases, every build reads config.asm");
  assert.match(textOf(rendered, "main.asm"), /!source "switches\.asm"\n!source "constants\.asm"\n/);
  assert.match(textOf(rendered, "constants.asm"), /^; Names/);
});

test("a patch that cuts an instruction, leaves its file or has the name of a label is not written", () => {
  const laid = layout(
    patchInput(
      [
        { start: 0x1001, end: 0x1004, switch: "CUT", code: "" },
        { start: 0x1006, end: 0x1007, switch: "CUT", code: "" },
        { start: 0x1008, end: 0x1009, switch: "store", code: "" },
        { start: 0x100c, end: 0x1011, switch: "LONG", code: "" },
        { start: 0x1013, end: 0x1013, switch: "GONE", code: "" },
      ],
      { modules: [{ start: 0x1010, file: "tail.asm" }], switches: ["CUT", "store", "LONG"].map(offSwitch) },
    ),
  );
  assert.deepEqual(
    laid.patchesNotWritten.map((row) => [row.start, row.reason]),
    [
      [0x1001, "The range cuts the instruction at $1000."],
      [0x1006, "The range cuts the instruction at $1005."],
      [0x1008, "The switch name store is also a name of the source."],
      [0x100c, "The range runs past the end of the file segment_1000.asm at $100f: a patch is in one file."],
      [0x1013, "The switch GONE is not a switch of the knowledge."],
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
  assert.deepEqual((await assembleRendered(withConfig(rendered, { CRACK: 1 }))).bytes, on);
  const nop = [...image];
  nop.splice(8, 4, 0xea, 0xea, 0xea, 0xea);
  assert.deepEqual((await assembleRendered(withConfig(rendered, { DEBUG: 1 }))).bytes, nop, "empty code is only NOP");
  const long = render(layout(patchInput([{ ...CRACK, code: "        lda #1\n        sta $d021\n        rts" }])), new Set(), []);
  assert.deepEqual((await assembleRendered(long)).bytes, image, "off, the code is not assembled");
  const refused = await assembleRendered(withConfig(long, { CRACK: 1 }));
  assert.equal(refused.bytes, undefined);
  assert.deepEqual(refused.messages, ["!error: The patch CRACK at $1000 has 6 (0x6) bytes; the range has 5."]);
});

/**
 * The program of ORIGINAL has a protection call at $1000 and four data bytes
 * at $1008. V2 has the protection and the fix A there, V3 has the fix B and
 * no protection.
 */
function releaseInput(): SourceInput {
  return patchInput(
    [
      { start: 0x1000, end: 0x1004, switch: "PROTECTION", code: "", comment: "No check." },
      { start: 0x1008, end: 0x100b, switch: "FIX_A", code: "        !byte 9, 9, 9, 9" },
      { start: 0x1008, end: 0x100b, switch: "FIX_B", code: "        !byte 7, 7, 7, 7" },
    ],
    {
      switches: [
        { name: "FIX_A", kind: "fix", default: 1, base: 0, releases: ["V2"], comment: "Fix A." },
        { name: "FIX_B", kind: "fix", default: 0, base: 0, releases: ["V3"] },
        { name: "PROTECTION", kind: "protection", default: 0, base: 1, releases: ["ORIGINAL", "V2"], comment: "The check." },
      ],
      releases: [
        { label: "V3", file: "original/v3.prg", base: false },
        { label: "ORIGINAL", file: "original/game.prg", base: true, comment: "The first release." },
        { label: "V2", file: "original/v2.prg", base: false },
      ],
    },
  );
}

test("config.asm has the value of every switch by kind, switches.asm each release; a patch of a switch that the program has on holds its off state", () => {
  const rendered = render(layout(releaseInput()), new Set(), []);
  assert.equal(
    textOf(rendered, "config.asm"),
    [
      "; Generated by c64-source. Edit the values here: generate keeps them.",
      "; The switches of the build. Each switch is 0 or 1: change a value, then build again.",
      "; The defaults give the clean program: copy protection, trainers, cheats and",
      "; changes of a crack are 0, and the fixes of the releases are 1.",
      "; generate adds a new switch with its default and removes a switch that the",
      "; knowledge does not have. The build of a release does not read this file.",
      "",
      "; Copy protection: off by default",
      "PROTECTION = 0 ; on in ORIGINAL, V2. $1000-$1004. The check.",
      "",
      "; Fixes of the releases: on by default",
      "FIX_A      = 1 ; on in V2. $1008-$100b. Fix A.",
      "FIX_B      = 0 ; on in V3. $1008-$100b",
      "",
    ].join("\n"),
  );
  assert.deepEqual([...configValues(textOf(rendered, "config.asm"))], [["PROTECTION", 0], ["FIX_A", 1], ["FIX_B", 0]]);
  assert.equal(
    textOf(rendered, "switches.asm"),
    [
      "; The releases of the knowledge. config.asm holds the value of each switch.",
      "; Build a release with -DRELEASE_<label>=1 (the build option --release <label>):",
      "; then each switch has the value of that release, and the build does not read config.asm.",
      "",
      "; ORIGINAL (the program of the knowledge): original/game.prg. The first release.",
      "!ifdef RELEASE_ORIGINAL {",
      "        FIX_A = 0",
      "        FIX_B = 0",
      "        PROTECTION = 1",
      "}",
      "",
      "; V2: original/v2.prg",
      "!ifdef RELEASE_V2 {",
      "        FIX_A = 1",
      "        FIX_B = 0",
      "        PROTECTION = 1",
      "}",
      "",
      "; V3: original/v3.prg",
      "!ifdef RELEASE_V3 {",
      "        FIX_A = 0",
      "        FIX_B = 1",
      "        PROTECTION = 0",
      "}",
      "",
      '!ifndef RELEASE_ORIGINAL { !ifndef RELEASE_V2 { !ifndef RELEASE_V3 { !source "config.asm" } } }',
      "",
    ].join("\n"),
  );
  const text = textOf(rendered, "segment_1000.asm");
  assert.match(text, /^!zone patch_PROTECTION_1000 \{\n\.patch_start\n!if PROTECTION = 0 \{\n {8}; PROTECTION off: 5 bytes at \$1000-\$1004, NOP after the code\n {8}; No check\.\n {8}!if \* - \.patch_start > 5 .*\n\} else \{\n {8}lda #\$00\n {8}sta \$d020\n\}\n\}\n/m);
  assert.match(
    text,
    /^!zone patch_FIX_A_1008 \{\n\.patch_start\n!if FIX_A \{ !if FIX_B \{ !error "FIX_A and FIX_B change \$1008-\$100b: turn on one of them\." \} \}\n!if FIX_A \{\n.*\n {8}!byte 9, 9, 9, 9\n.*\n\} else \{ !if FIX_B \{\n.*\n {8}!byte 7, 7, 7, 7\n.*\n\} else \{\n {8}!byte \$01,\$02,\$03,\$04\n\}\}\n\}\n/m,
  );
});

test("with real ACME, each release builds its bytes, the default build is the clean program, config.asm sets the switches, and two alternatives stop ACME", { skip: acmeSkip }, async () => {
  const source = releaseInput();
  const image = Array.from({ length: 20 }, (_, offset) => source.byteAt(0x1000 + offset));
  const rendered = render(layout(source), new Set(), []);
  const bytes = (changes: Array<[number, number[]]>) => {
    const out = [...image];
    for (const [at, values] of changes) out.splice(at, values.length, ...values);
    return out;
  };
  const nop = [0xea, 0xea, 0xea, 0xea, 0xea];
  assert.deepEqual((await assembleRendered(rendered, { RELEASE_ORIGINAL: 1 })).bytes, image, "the base release is the program");
  assert.deepEqual((await assembleRendered(rendered, { RELEASE_V2: 1 })).bytes, bytes([[8, [9, 9, 9, 9]]]));
  assert.deepEqual((await assembleRendered(rendered, { RELEASE_V3: 1 })).bytes, bytes([[0, nop], [8, [7, 7, 7, 7]]]));
  assert.deepEqual((await assembleRendered(rendered)).bytes, bytes([[0, nop], [8, [9, 9, 9, 9]]]), "the default: no protection, fix A");
  assert.deepEqual((await assembleRendered(withConfig(rendered, { PROTECTION: 1, FIX_A: 0 }))).bytes, image, "the values of config.asm");
  assert.deepEqual((await assembleRendered(withConfig(rendered, { PROTECTION: 1 }), { RELEASE_V3: 1 })).bytes, bytes([[0, nop], [8, [7, 7, 7, 7]]]), "a release does not read config.asm");
  assert.match((await assembleRendered(rendered, { PROTECTION: 1 })).messages.join(), /Symbol already defined/, "config.asm sets the switches, not a define");
  const both = await assembleRendered(withConfig(rendered, { FIX_B: 1 }));
  assert.equal(both.bytes, undefined);
  assert.deepEqual(both.messages, ["!error: FIX_A and FIX_B change $1008-$100b: turn on one of them."]);
});


test("with real Ghidra and ACME, the script builds each switch on and reports it; a patch too long fails the run", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  // $1000 LDA #$00; STA $d020; JMP $1000.
  writeFileSync(join(project, "test.prg"), Uint8Array.from([0x00, 0x10, 0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x4c, 0x00, 0x10]));
  const knowledge = (...args: string[]) => spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts"), ...args], { cwd: project, encoding: "utf8" });
  assert.equal(knowledge("image", "test.prg").status, 0);
  assert.equal(knowledge("rename", "$1000", "start", "--kind", "routine").status, 0);
  // V2 is the release with a grey border: its file is the program with the code of the CRACK patch.
  writeFileSync(join(project, "v2.prg"), Uint8Array.from([0x00, 0x10, 0xa9, 0x01, 0x8d, 0x21, 0xd0, 0x4c, 0x00, 0x10]));
  assert.equal(knowledge("release", "ORIGINAL", "--file", "test.prg", "--base").status, 0);
  assert.equal(knowledge("release", "V2", "--file", "v2.prg").status, 0);
  assert.equal(knowledge("switch", "CRACK", "--kind", "crack", "--releases", "V2").status, 0);
  assert.equal(knowledge("switch", "BIG", "--kind", "change", "--default", "0").status, 0);
  assert.equal(knowledge("patch", "$1000-$1004", "CRACK", "--code", "        lda #1\n        sta $d021").status, 0);
  // Plain instructions that are longer than the range are refused at the write; code with a label is checked only by the build.
  assert.equal(knowledge("patch", "$1005-$1007", "BIG", "--code", "        nop\n        nop\n        nop\n        nop").status, 2);
  assert.equal(knowledge("patch", "$1005-$1007", "BIG", "--code", "        nop\n.more   nop\n        nop\n        nop").status, 0);
  const generate = () => spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], { cwd: project, encoding: "utf8" });
  type Result = {
    check: { identical: boolean };
    switches: Array<{ name: string; result: string; changedBytes?: number; overflow?: Array<{ start: string; message: string }> }>;
    config?: { file: string; notDefault: Array<{ name: string; value: number; default: number }> };
    default: { in: string[]; result: string; changedBytes?: number };
    releases: Array<{ label: string; result: string }>;
  };
  const first = generate();
  assert.equal(first.status, 0, first.stdout);
  const json = readEnvelope(first.stdout, first.status).json as Result & { result: string };
  assert.equal(json.result, "FAIL", "a switch that does not fit fails the run");
  assert.equal(json.check.identical, true, "the build of the base release gives the image");
  assert.deepEqual(json.switches.map((item) => [item.name, item.result]), [["BIG", "overflow"], ["CRACK", "fits"]]);
  assert.deepEqual(json.default, { in: [], result: "fits", changedBytes: 0 });
  assert.deepEqual(json.releases.map((item) => [item.label, item.result]), [["ORIGINAL", "identical"], ["V2", "identical"]], "each release builds to its file");
  assert.deepEqual(json.switches[0]!.overflow, [{ start: "$1005", message: "The patch BIG at $1005 has 4 (0x4) bytes; the range has 3." }]);
  assert.equal(json.switches[1]!.changedBytes, 2);
  assert.equal(knowledge("unpatch", "$1005").status, 0);
  const second = generate();
  assert.equal(second.status, 0, second.stdout);
  assert.deepEqual((readEnvelope(second.stdout, second.status).json as Result).switches.map((item) => [item.name, item.result]), [["CRACK", "fits"]]);
  // The user turns CRACK on in config.asm: generate keeps the value and says so, and the checks still build from the knowledge.
  const config = join(project, "src", "config.asm");
  writeFileSync(config, readFileSync(config, "utf8").replace(/^CRACK = 0/m, "CRACK = 1"));
  const third = generate();
  assert.equal(third.status, 0, third.stdout);
  assert.deepEqual((readEnvelope(third.stdout, third.status).json as Result).config, { file: "src/config.asm", notDefault: [{ name: "CRACK", value: 1, default: 0 }] });
  assert.match(readFileSync(config, "utf8"), /^CRACK = 1 ; on in V2\. \$1000-\$1004$/m);
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

test("a macro arg that is a platform name of a ROM that the program does not use gets that reason, not that it is no platform name", () => {
  const laid = layout(
    macroInput([{ start: 0x1000, end: 0x1005, macro: "inc16", args: ["CHRGET"] }, { start: 0x1006, end: 0x100b, macro: "inc16", args: ["nowhere"] }], {
      platform: [{ address: 0xd020, end: 0xd020, name: "EXTCOL" }],
      platformLeftOut: new Set(["CHRGET"]),
    }),
  );
  assert.deepEqual(laid.macrosAsInstructions.map((row) => [row.start, row.reason]), [
    [0x1000, "CHRGET is a platform name of a ROM that the program does not use, so the source leaves it out (romNamesLeftOut). Name the address in the project knowledge, or record the macro use again with other args."],
    [0x1006, "nowhere is not a symbol of the knowledge or a platform name. Name the address in the project knowledge, or record the macro use again with other args."],
  ]);
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
  const json = readEnvelope(run.stdout, run.status).json as { check: { identical: boolean }; files: Array<{ out: string }>; macroUses: number; macrosAsInstructions: { listed: Array<{ start: string; macro: string; reason: string }> } };
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

/**
 * $1000 LDA $dd0e / LDA #$1b / STA $d011 / STA $d012 / STA $d800,X / STA $d012 / LDA $d040 / JSR $d100 / RTS,
 * and RAM at $d000-$dfff in the image (a game copies sprites there with $01=$00): a named data region.
 */
function ioInput(overrides: Partial<SourceInput> = {}): SourceInput {
  const code = [0xad, 0x0e, 0xdd, 0xa9, 0x1b, 0x8d, 0x11, 0xd0, 0x8d, 0x12, 0xd0, 0x9d, 0x00, 0xd8, 0x8d, 0x12, 0xd0, 0xad, 0x40, 0xd0, 0x20, 0x00, 0xd1, 0x60];
  const memory = new Uint8Array(0x10000);
  memory.set(code, 0x1000);
  memory.set(seededBytes(5, 0x1000), 0xd000);
  memory[0xd100] = 0x60;
  const instructions = new Map([[0x1000, 3], [0x1003, 2], [0x1005, 3], [0x1008, 3], [0x100b, 3], [0x100e, 3], [0x1011, 3], [0x1014, 3], [0x1017, 1], [0xd100, 1]]);
  return {
    ...input([0], 0x1000),
    segments: [{ start: 0x1000, end: 0x1000 + code.length - 1 }, { start: 0xd000, end: 0xdfff }],
    byteAt: (address) => memory[address]!,
    instructions,
    symbols: [{ address: 0xd000, name: "fighter_extra_sprites" }, { address: 0xd100, name: "under_io" }],
    regions: [{ start: 0xd000, end: 0xd0ff, type: "bytes" }, { start: 0xd100, end: 0xd100, type: "code" }, { start: 0xd101, end: 0xdfff, type: "bytes" }],
    platform: platformNames(),
    describe: describeAddress,
    decode,
    io: { start: 0xd000, end: 0xdfff },
    ...overrides,
  };
}

/** The code lines of segment_1000.asm without their side comments. */
const ioCode = (rendered: ReturnType<typeof render>) => textOf(rendered, "segment_1000.asm").split("\n").filter((line) => line.startsWith(" ")).map((line) => line.split(";")[0]!.trim());

test("a read or write in the I/O area names the register, also where the image holds RAM; the data label of the RAM stays", () => {
  const rendered = render(layout(ioInput()), new Set(), []);
  assert.deepEqual(ioCode(rendered), ["lda CI2CRA", "lda #$1b", "sta SCROLY", "sta RASTER", "sta $d800,x", "sta RASTER", "lda $d040", "jsr under_io", "rts"]);
  // The register gets its decoded value, as a register outside the image does.
  assert.match(textOf(rendered, "segment_1000.asm"), /sta SCROLY +; \$d011: yScroll 3, rows 25, displayEnabled, rasterBit8 0\n/);
  const data = textOf(rendered, "segment_d000.asm");
  assert.match(data, /^fighter_extra_sprites\n {8}!byte /m);
  assert.doesNotMatch(data, /^(RASTER|SCROLY|CI2CRA|l_d|fighter_extra_sprites\+)/m, "a register gets no label line in the data");
  const constants = textOf(rendered, "constants.asm");
  assert.match(constants, /^; A name of an address inside the image names the register there, not the RAM of the program\.$/m);
  assert.match(constants, /^SCROLY += \$d011 ; Control 1: .* Used: written 1\.$/m);
  assert.match(constants, /^RASTER += \$d012 ; .* Used: written 2\.$/m);
  assert.match(constants, /^CI2CRA += \$dd0e ; CIA 2: .* Used: read 1\.$/m);
  assert.doesNotMatch(constants, /fighter_extra_sprites|under_io|\$d800|\$d040/);
});

test("a platform name of a knowledge operand expression stays as written and is a constant, also where the image holds RAM or a knowledge name", () => {
  const operands: SourceInput["operands"] = [{ address: 0x100e, select: "value", symbol: "RASTER" }];
  assert.deepEqual(ioCode(render(layout(ioInput({ operands })), new Set(), [])).slice(3, 6), ["sta RASTER", "sta $d800,x", "sta RASTER"]);
  // A knowledge name at $d012 names the RAM: the plain operand is that label, the expression keeps the register.
  const symbols = [...ioInput().symbols, { address: 0xd012, name: "sprite_row", origin: "llm" as const }];
  const rendered = render(layout(ioInput({ operands, symbols })), new Set(), []);
  assert.deepEqual(ioCode(rendered).slice(3, 6), ["sta sprite_row", "sta $d800,x", "sta RASTER"]);
  assert.match(textOf(rendered, "segment_d000.asm"), /^sprite_row\n/m);
  assert.match(textOf(rendered, "constants.asm"), /^RASTER += \$d012 ; .* Used: written 1\.$/m);
  // Without the I/O area (drive code, a bank), the RAM of the image keeps its data label.
  const { io: _io, describe: _describe, ...plain } = ioInput({ platform: [] });
  assert.deepEqual(ioCode(render(layout(plain), new Set(), [])).slice(0, 5), ["lda l_dd0e", "lda #$1b", "sta fighter_extra_sprites+17", "sta fighter_extra_sprites+18", "sta l_d800,x"]);
});

test("with real ACME, registers named over the RAM of the image assemble to the same bytes", { skip: acmeSkip }, async () => {
  const operands: SourceInput["operands"] = [{ address: 0x100e, select: "value", symbol: "RASTER" }];
  const symbols = [...ioInput().symbols, { address: 0xd012, name: "sprite_row", origin: "llm" as const }];
  for (const source of [ioInput(), ioInput({ operands }), ioInput({ operands, symbols })]) {
    const { bytes, messages } = await assembleRendered(render(layout(source), new Set(), []));
    assert.ok(bytes !== undefined, messages.join("; "));
    const at = (address: number) => bytes[address - 0x1000];
    assert.deepEqual([0x1000, 0x1017, 0xd000, 0xd012, 0xd100, 0xdfff].map(at), [0x1000, 0x1017, 0xd000, 0xd012, 0xd100, 0xdfff].map(source.byteAt));
    assert.equal(bytes.length, 0xe000 - 0x1000);
    assert.deepEqual(bytes.slice(0xd000 - 0x1000), Array.from({ length: 0x1000 }, (_, offset) => source.byteAt(0xd000 + offset)));
    assert.deepEqual(bytes.slice(0, 0x18), Array.from({ length: 0x18 }, (_, offset) => source.byteAt(0x1000 + offset)));
  }
});

/** A project with a captured program at $1000-$1003 (RTS first), its entry and its entry state. */
function capturedProject(entry: string): { project: string; knowledge: string; generate: (...args: string[]) => SpawnSyncReturns<string> } {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  const memory = new Uint8Array(0x10000);
  memory.set([0x60, 0xea, 0xea, 0xea], 0x1000);
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), memory);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry, image: "image.bin", segments: [{ start: "$1000", end: "$1003" }] }));
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: entry, a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [`$${(page << 8).toString(16).padStart(4, "0")}`, "00".repeat(256)])),
    }),
  );
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "image", "unpacked/image.json"], { cwd: project }).status, 0);
  const generate = (...args: string[]) =>
    spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src", ...args], {
      cwd: project,
      env: { ...process.env, C64RT_HOST: "127.0.0.1:1", ...(ghidraSkip === false ? {} : { C64RT_GHIDRA: join(project, "no-ghidra") }) },
      encoding: "utf8",
    });
  return { project, knowledge, generate };
}

/** A loader.asm as generate writes it, of a knowledge revision. */
const loaderOf = (revision: string) => `; Generated by c64-source. Do not edit: change the knowledge and generate again.\n; Loader generated by c64-source from knowledge revision ${revision}.\n`;

test("with real ACME, a run without --loader says when the loader that it keeps is of another knowledge revision", { skip: acmeSkip, timeout: 120_000 }, () => {
  // The entry $0801 is in no segment: Ghidra does not run, and the knowledge has an entry state.
  const { project, generate } = capturedProject("$0801");
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "loader.asm"), loaderOf("1"));
  writeFileSync(join(project, "src", "loader.prg"), Uint8Array.from([0x01, 0x08]));
  const run = generate();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const { envelope, json } = readEnvelope(run.stdout, run.status) as { envelope: { hint?: string; nextAction?: string }; json: { revision: string; staleLoader?: unknown } };
  assert.deepEqual(json.staleLoader, { files: ["src/loader.asm", "src/loader.prg"], revision: "1" });
  assert.match(envelope.hint!, /The loader files in staleLoader\.files are of another knowledge revision, and the run kept them\. To write the loader of this revision, generate with --loader\.$/);
  assert.match(envelope.nextAction!, /^node \/.*source\.ts generate --out src --loader --project /);
  assert.deepEqual(readdirSync(join(project, "src")).filter((name) => name.startsWith("loader")).sort(), ["loader.asm", "loader.prg"], "the run keeps the loader");
  // A loader of this revision, and a loader.asm of the user, are not stale.
  for (const text of [loaderOf(json.revision), "; my loader\n"]) {
    writeFileSync(join(project, "src", "loader.asm"), text);
    const again = generate();
    assert.equal((readEnvelope(again.stdout, again.status).json as { staleLoader?: unknown }).staleLoader, undefined, text);
  }
});

test("with real ACME, a stale loader of a knowledge without an entry state gets no --loader action", { skip: acmeSkip, timeout: 120_000 }, () => {
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-source-"));
  projects.push(project);
  writeFileSync(join(project, "data.prg"), Buffer.from([0x00, 0xc0, ...Array.from({ length: 64 }, (_, index) => index)]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "image", "data.prg"], { cwd: project }).status, 0);
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "loader.asm"), "; Generated by c64-source. Do not edit: change the knowledge and generate again.\n");
  const run = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: "127.0.0.1:1", C64RT_GHIDRA: join(project, "no-ghidra") },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const { envelope, json } = readEnvelope(run.stdout, run.status) as { envelope: { hint?: string; nextAction?: string }; json: { result: string; staleLoader?: unknown } };
  assert.equal(json.result, "PASS");
  assert.deepEqual(json.staleLoader, { files: ["src/loader.asm"], noEntryState: true });
  assert.match(envelope.hint!, /The knowledge has no entry state, so --loader cannot write them again\. Remove them when the build does not use them\.$/);
  assert.doesNotMatch(envelope.nextAction ?? "", /--loader/);
});

test("with real Ghidra and ACME, a --loader run whose check cannot run keeps the loader.prg of an earlier run and says why", { skip: ghidraSkip, timeout: 600_000 }, async () => {
  const { project, knowledge, generate } = capturedProject("$1000");
  mkdirSync(join(project, "src"));
  writeFileSync(join(project, "src", "loader.prg"), Uint8Array.from([0x01, 0x08]));
  // C64RT_HOST names a port where no host runs.
  const run = generate("--loader");
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const json = readEnvelope(run.stdout, run.status).json as { result: string; check: { identical: boolean }; files: Array<{ out: string }>; removed: string[]; loader: { verified: boolean; reason: string; kept?: string } };
  assert.equal(json.result, "FAIL");
  assert.equal(json.check.identical, true);
  assert.equal(json.loader.verified, false);
  assert.match(json.loader.reason, /^The check of loader\.prg did not run, so the script kept the loader\.prg of an earlier run\. The c64-re-tools host runtime is not running or cannot be reached\./);
  assert.equal(json.loader.kept, "src/loader.prg");
  assert.ok(json.files.some((file) => file.out === "src/loader.asm"), "loader.asm is written");
  assert.ok(!json.files.some((file) => file.out === "src/loader.prg"), "loader.prg is not in the written files");
  assert.equal(json.removed, undefined, "a host problem does not remove a committed loader.prg");
  assert.deepEqual([...readFileSync(join(project, "src", "loader.prg"))], [0x01, 0x08], "the loader.prg of the earlier run keeps its bytes");
  assert.ok(!readdirSync(join(project, ".c64-re-tools", "local")).includes("loader-check"), "the scratch file of the check goes");
  // A run without --loader keeps loader.asm: it is of this revision until the knowledge changes.
  const same = generate();
  assert.equal((readEnvelope(same.stdout, same.status).json as { staleLoader?: unknown }).staleLoader, undefined);
  assert.equal(spawnSync(process.execPath, [...process.execArgv, knowledge, "rename", "$1000", "start", "--kind", "routine"], { cwd: project }).status, 0);
  const changed = generate();
  const { envelope, json: body } = readEnvelope(changed.stdout, changed.status) as { envelope: { nextAction?: string }; json: { staleLoader: { files: string[]; revision: string } } };
  assert.deepEqual(body.staleLoader.files, ["src/loader.asm", "src/loader.prg"]);
  assert.match(envelope.nextAction!, /^node \/.*source\.ts generate --out src --loader --project /);
});
