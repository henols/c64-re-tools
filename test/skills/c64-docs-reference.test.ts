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
