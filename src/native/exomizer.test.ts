import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDesfx, sfxArguments } from "./exomizer.ts";

test("the pack gives the entry first, a C64 target without the effect, and the inputs last in load order", () => {
  assert.deepEqual(sfxArguments("exomizer", { entry: 0x080d }, ["in/0.prg", "in/1.prg"], "out/packed.prg"), ["exomizer", "sfx", "2061", "-t64", "-n", "-o", "out/packed.prg", "in/0.prg", "in/1.prg"]);
  assert.deepEqual(sfxArguments("exomizer", { entry: 0x0400, exitMemory: 0x35 }, ["in/0.prg"], "out/packed.prg").slice(-2), ["-Di_ram_exit=53", "in/0.prg"]);
});

test("the entry and the cycles are read from the output of desfx", () => {
  const output = ' Decrunch took 2.473925 Mcycles, speed was 16.23 kB/Mc (61.63 c/B).\n Writing "out/unpacked.prg" as prg, saving from $03FF to $FC02, entry at $0400.\n';
  assert.deepEqual(parseDesfx(output), { entry: 0x0400, cycles: 2_473_925 });
  assert.deepEqual(parseDesfx(' Writing "a.out" as prg, saving from $0801 to $9000, entry at $080D.'), { entry: 0x080d });
  assert.equal(parseDesfx("Error, can't find entry1 point."), undefined);
});
