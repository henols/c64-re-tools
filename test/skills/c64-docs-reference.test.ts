// The reference pages from the knowledge and the source map, in-process.

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildReference } from "../../skills/c64-docs/scripts/lib/reference.ts";
import type { SourceMap } from "../../skills/c64-docs/scripts/lib/source-map.ts";

const row = { space: "c64", origin: "llm", revision: "1" } as const;

test("the code of an I/O register is no reader or writer of the data in RAM under it at $d000-$dfff", () => {
  // play_sound writes SIGVOL $d418, copy_sprites reads the sprites at $d400; the sprites are in RAM under the SID.
  const items = [
    { start: 0x1000, end: 0x1002, file: "game.asm", line: 2 },
    { start: 0x1010, end: 0x1012, file: "game.asm", line: 4 },
    { start: 0xd400, end: 0xd43f, file: "sprites.asm", line: 2 },
  ];
  const labels = [
    { address: 0x1000, name: "play_sound", file: "game.asm", line: 1 },
    { address: 0x1010, name: "copy_sprites", file: "game.asm", line: 3 },
    { address: 0xd400, name: "sprites", file: "sprites.asm", line: 1 },
  ];
  const map: SourceMap = {
    directory: "src",
    mapPath: ".c64-re-tools/local/generated/src/source-map.json",
    space: "c64",
    revision: "1",
    files: ["game.asm", "sprites.asm"],
    labels,
    labelOf: (name) => labels.find((label) => label.name === name),
    lineOf: (address) => items.find((item) => address >= item.start && address <= item.end),
    pathOf: (file) => `src/${file}`,
  };
  const { files } = buildReference({
    out: "docs/reference",
    map,
    revision: "1",
    symbols: [
      { ...row, address: 0x1000, name: "play_sound", kind: "routine" },
      { ...row, address: 0x1010, name: "copy_sprites", kind: "routine" },
      { ...row, address: 0xd400, name: "sprites", kind: "data" },
    ],
    regions: [
      { ...row, start: 0x1000, end: 0x1012, type: "code" },
      { ...row, start: 0xd400, end: 0xd43f, type: "sprite", element: 64 },
    ],
    comments: [],
    references: [
      { ...row, from: 0x1000, to: 0xd418, kind: "write" },
      { ...row, from: 0x1010, to: 0xd400, kind: "read" },
    ],
    modules: [],
    image: { byteAt: () => 0, inImage: (address: number) => (address >= 0x1000 && address <= 0x1012) || (address >= 0xd400 && address <= 0xd43f) },
  } as never);
  const sprites = files.find((file) => file.path === "docs/reference/modules/sprites.md")!.bytes.toString("utf8");
  assert.match(sprites, /- \*\*Read by:\*\* .*copy_sprites/);
  assert.doesNotMatch(sprites, /play_sound/, "the write of SIGVOL is no write of the sprites");
});

test("a platform name in the memory map covers only its register: RANDOM is no writer of the color RAM, SP0Y none of SP1Y", () => {
  const items = [
    { start: 0x1000, end: 0x1002, file: "game.asm", line: 2 },
    { start: 0x1010, end: 0x1012, file: "game.asm", line: 4 },
    { start: 0x1020, end: 0x1022, file: "game.asm", line: 6 },
  ];
  const labels = [
    { address: 0x1000, name: "get_random", file: "game.asm", line: 1 },
    { address: 0x1010, name: "fill_color", file: "game.asm", line: 3 },
    { address: 0x1020, name: "move_sprites", file: "game.asm", line: 5 },
    { address: 0xd001, name: "SP0Y", file: "constants.asm", line: 1 },
    { address: 0xd41b, name: "RANDOM", file: "constants.asm", line: 2 },
  ];
  const map: SourceMap = {
    directory: "src",
    mapPath: ".c64-re-tools/local/generated/src/source-map.json",
    space: "c64",
    revision: "1",
    files: ["constants.asm", "game.asm"],
    labels,
    labelOf: (name) => labels.find((label) => label.name === name),
    lineOf: (address) => items.find((item) => address >= item.start && address <= item.end),
    pathOf: (file) => `src/${file}`,
  };
  const { files } = buildReference({
    out: "docs/reference",
    map,
    revision: "1",
    symbols: ["get_random", "fill_color", "move_sprites"].map((name, index) => ({ ...row, address: 0x1000 + index * 0x10, name, kind: "routine" })),
    regions: [{ ...row, start: 0x1000, end: 0x1022, type: "code" }],
    comments: [],
    references: [
      { ...row, from: 0x1000, to: 0xd41b, kind: "read" },
      { ...row, from: 0x1010, to: 0xd800, kind: "write" },
      { ...row, from: 0x1020, to: 0xd001, kind: "write" },
      { ...row, from: 0x1020, to: 0xd003, kind: "write" },
    ],
    modules: [],
    image: { byteAt: () => 0, inImage: (address: number) => address >= 0x1000 && address <= 0x1022 },
  } as never);
  const memoryMap = files.find((file) => file.path === "docs/reference/memory-map.md")!.bytes.toString("utf8");
  const rowOf = (name: string) => memoryMap.split("\n").find((line) => line.includes(`id="${name}"`))!;
  assert.match(rowOf("RANDOM"), /^\| `\$D41B` \|.*get_random/);
  assert.doesNotMatch(rowOf("RANDOM"), /fill_color/);
  assert.match(rowOf("SP0Y"), /^\| `\$D001` \|.*move_sprites/);
});

test("a platform name has a reader where the source line names it or uses a macro: an indexed use says so, and lda $d000,x with the character ROM in is no SP0X reader", () => {
  const items = [
    { start: 0x1000, end: 0x1002, file: "game.asm", line: 2 },
    { start: 0x1003, end: 0x1005, file: "game.asm", line: 7 },
    { start: 0x1010, end: 0x1012, file: "game.asm", line: 4 },
    { start: 0x1020, end: 0x1022, file: "game.asm", line: 6 },
    { start: 0x1030, end: 0x1034, file: "game.asm", line: 9 },
  ];
  const text = ["read_fire", "        lda CIAPRA,x ; X = 1 reads port B", "copy_font", "        lda $d000,x", "place_sprite", "        sta SP0X", "        lda CIAPRA", "wait_frame", "        +wait_line $80"];
  const labels = [
    { address: 0x1000, name: "read_fire", file: "game.asm", line: 1 },
    { address: 0x1010, name: "copy_font", file: "game.asm", line: 3 },
    { address: 0x1020, name: "place_sprite", file: "game.asm", line: 5 },
    { address: 0x1030, name: "wait_frame", file: "game.asm", line: 8 },
    { address: 0xd000, name: "SP0X", file: "constants.asm", line: 1 },
    { address: 0xd012, name: "RASTER", file: "constants.asm", line: 3 },
    { address: 0xdc00, name: "CIAPRA", file: "constants.asm", line: 2 },
  ];
  const map: SourceMap = {
    directory: "src",
    mapPath: ".c64-re-tools/local/generated/src/source-map.json",
    space: "c64",
    revision: "1",
    files: ["constants.asm", "game.asm"],
    labels,
    labelOf: (name) => labels.find((label) => label.name === name),
    lineOf: (address) => items.find((item) => address >= item.start && address <= item.end),
    pathOf: (file) => `src/${file}`,
    textOf: (line) => (line.file === "game.asm" ? text[line.line - 1]?.replace(/;.*$/, "") : undefined),
  };
  const { files } = buildReference({
    out: "docs/reference",
    map,
    revision: "1",
    symbols: ["read_fire", "copy_font", "place_sprite", "wait_frame"].map((name, index) => ({ ...row, address: 0x1000 + index * 0x10, name, kind: "routine" })),
    regions: [{ ...row, start: 0x1000, end: 0x1034, type: "code" }],
    comments: [],
    references: [
      { ...row, from: 0x1000, to: 0xdc00, kind: "read" },
      { ...row, from: 0x1003, to: 0xdc00, kind: "read" },
      { ...row, from: 0x1010, to: 0xd000, kind: "read" },
      { ...row, from: 0x1020, to: 0xd000, kind: "write" },
      { ...row, from: 0x1031, to: 0xd012, kind: "read" },
    ],
    modules: [],
    image: { byteAt: () => 0, inImage: (address: number) => address >= 0x1000 && address <= 0x1034 },
  } as never);
  const memoryMap = files.find((file) => file.path === "docs/reference/memory-map.md")!.bytes.toString("utf8");
  const rowOf = (name: string) => memoryMap.split("\n").find((line) => line.includes(`id="${name}"`))!;
  assert.match(rowOf("CIAPRA"), /read_fire.*\(indexed\)/, "the index can reach the registers after CIAPRA");
  assert.equal(rowOf("CIAPRA").split("[`read_fire`]").length, 2, "a routine with a direct and an indexed use shows once");
  assert.match(rowOf("RASTER"), /wait_frame/, "the macro body reads RASTER");
  assert.doesNotMatch(rowOf("SP0X"), /copy_font/, "the source does not name SP0X there");
  assert.match(rowOf("SP0X"), /place_sprite/);
  assert.doesNotMatch(rowOf("SP0X"), /\(indexed\)/);
});

test("a label that another file reaches only by a pointer keeps its entry: the CPU enters it through a vector", () => {
  // init sets the IRQ vector to irq_handler (lda #<irq_handler); game_loop is a label that only game jumps to.
  const items = [
    { start: 0x1000, end: 0x1004, file: "init.asm", line: 2 },
    { start: 0x1100, end: 0x1102, file: "game.asm", line: 2 },
    { start: 0x1108, end: 0x110a, file: "game.asm", line: 4 },
    { start: 0x1110, end: 0x1112, file: "game.asm", line: 6 },
  ];
  const labels = [
    { address: 0x1000, name: "init", file: "init.asm", line: 1 },
    { address: 0x1100, name: "game", file: "game.asm", line: 1 },
    { address: 0x1108, name: "game_loop", file: "game.asm", line: 3 },
    { address: 0x1110, name: "irq_handler", file: "game.asm", line: 5 },
  ];
  const map: SourceMap = {
    directory: "src",
    mapPath: ".c64-re-tools/local/generated/src/source-map.json",
    space: "c64",
    revision: "1",
    files: ["init.asm", "game.asm"],
    labels,
    labelOf: (name) => labels.find((label) => label.name === name),
    lineOf: (address) => items.find((item) => address >= item.start && address <= item.end),
    pathOf: (file) => `src/${file}`,
  };
  const { files } = buildReference({
    out: "docs/reference",
    map,
    revision: "1",
    symbols: [
      { ...row, address: 0x1000, name: "init", kind: "routine" },
      { ...row, address: 0x1100, name: "game", kind: "routine" },
      { ...row, address: 0x1108, name: "game_loop", kind: "label" },
      { ...row, address: 0x1110, name: "irq_handler", kind: "label" },
    ],
    regions: [{ ...row, start: 0x1000, end: 0x1112, type: "code" }],
    comments: [],
    references: [
      { ...row, from: 0x1000, to: 0x1110, kind: "pointer" },
      { ...row, from: 0x1108, to: 0x1108, kind: "jump" },
    ],
    modules: [],
    image: { byteAt: () => 0, inImage: (address: number) => address >= 0x1000 && address <= 0x1112 },
  } as never);
  const game = files.find((file) => file.path === "docs/reference/modules/game.md")!.bytes.toString("utf8");
  assert.match(game, /### \[`irq_handler`\]/);
  assert.doesNotMatch(game, /### \[`game_loop`\]/, "only code of its own file enters game_loop");
});
