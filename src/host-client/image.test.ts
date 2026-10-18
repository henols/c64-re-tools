import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { readImage, readPrg } from "./image.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-image-"));
const cwd = process.cwd();
before(() => {
  mkdirSync(join(project, ".c64-re-tools"));
  writeFileSync(join(project, "game.d64"), Buffer.alloc(174848));
  writeFileSync(join(project, "game.TAP"), Buffer.alloc(64));
  writeFileSync(join(project, "game.prg"), Buffer.from([0x00, 0xc0, 0xea, 0x60]));
  process.chdir(project);
});
after(() => {
  process.chdir(cwd);
  rmSync(project, { recursive: true, force: true });
});

test("readImage refuses a disk, tape or cartridge image by its extension, with the message of readPrg", () => {
  const disk = "game.d64 is a disk image (.d64), not a PRG. Get the PRG out of it with disk.ts read (or disk.ts crt for a cartridge) of the c64-disk skill.";
  assert.throws(() => readImage("game.d64"), { code: "invalid-input", message: disk });
  assert.throws(() => readPrg("game.d64"), { code: "invalid-input", message: disk });
  assert.throws(() => readImage("game.TAP"), { code: "invalid-input", message: /^game\.TAP is a tape file \(\.tap\), not a PRG\./ });
});

test("readImage reads a PRG as one segment at its load address", () => {
  const image = readImage("game.prg");
  assert.deepEqual(image.segments, [{ start: 0xc000, end: 0xc001 }]);
  assert.equal(image.byteAt(0xc001), 0x60);
});
