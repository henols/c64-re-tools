// The c64-memory-map lookup and decoders.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

import { decode, IO, lookup, ROM } from "../../skills/c64-memory-map/scripts/platform.ts";

test("platform addresses have names; application RAM says so", () => {
  assert.equal(lookup(0xd020).name, "EXTCOL");
  assert.equal(lookup(0xffd2).name, "CHROUT");
  assert.equal(lookup(0x0314).name, "CINV");
  assert.equal(lookup(0x0315).entryStart, 0x0314, "the second byte of a vector points to its start");
  assert.equal(lookup(0x00fb).name, "FREEZP");
  assert.deepEqual(lookup(0xc000), { address: 0xc000, kind: "application", area: "free RAM", meaning: "Free RAM. The application decides what is here." });
  assert.equal(lookup(0x2000).kind, "application");
  assert.equal(lookup(0xd800).area, "color RAM");
});

test("I/O registers repeat through their area", () => {
  assert.deepEqual([lookup(0xd060).name, lookup(0xd060).mirrorOf], ["EXTCOL", 0xd020]);
  assert.deepEqual([lookup(0xd43b).name, lookup(0xd43b).mirrorOf], ["RANDOM", 0xd41b]);
  assert.deepEqual([lookup(0xdc1d).name, lookup(0xdc1d).mirrorOf], ["CIAICR", 0xdc0d]);
  assert.equal(lookup(0xd02f).name, undefined, "$d02f-$d03f are unused");
  assert.match(lookup(0xdc0d).meaning, /^CIA 1: Interrupt control/);
  assert.equal(IO[0]!.registers.length, 47);
  assert.equal(IO[1]!.registers.length, 29);
});

test("the KERNAL jump table has 39 entries of 3 bytes from $ff81", () => {
  const table = ROM.filter((entry) => entry.meaning.startsWith("KERNAL jump table"));
  assert.equal(table.length, 39);
  assert.deepEqual([table[0]!.start, table[0]!.name, table.at(-1)!.start, table.at(-1)!.name], [0xff81, "CINT", 0xfff3, "IOBASE"]);
  assert.equal(lookup(0xffe4).name, "GETIN");
});

test("register values decode to their C64 meaning", () => {
  assert.deepEqual(
    [0x37, 0x36, 0x35, 0x34, 0x33, 0x31, 0x30].map((value) => {
      const result = decode(0x01, value);
      return [result.$a000, result.$d000, result.$e000];
    }),
    [
      ["BASIC ROM", "I/O", "KERNAL ROM"],
      ["RAM", "I/O", "KERNAL ROM"],
      ["RAM", "I/O", "RAM"],
      ["RAM", "RAM", "RAM"],
      ["BASIC ROM", "character ROM", "KERNAL ROM"],
      ["RAM", "character ROM", "RAM"],
      ["RAM", "RAM", "RAM"],
    ],
  );
  assert.deepEqual(decode(0xd018, 0x15, 0x97), {
    screenOffset: "$0400",
    characterOffset: "$1000",
    bitmapOffset: "$0000",
    bank: 0,
    screen: "$0400",
    characters: "$1000",
    bitmap: "$0000",
    note: "In banks 0 and 2 the VIC-II sees the character ROM at offsets $1000-$1FFF.",
  });
  assert.equal(decode(0xd018, 0x38, 0x96).screen, "$4c00", "bank 1 starts at $4000");
  assert.deepEqual(decode(0xdd00, 0x94), { vicBank: 3, vicAddresses: "$c000-$ffff" });
  assert.deepEqual(decode(0xd011, 0x1b), { yScroll: 3, rows: 25, displayEnabled: true, bitmapMode: false, extendedColorMode: false, rasterBit8: 0 });
  assert.deepEqual(decode(0xd016, 0x18), { xScroll: 0, columns: 40, multicolorMode: true });
  assert.deepEqual(decode(0xd015, 0b10000101), { sprites: [0, 2, 7] });
  assert.deepEqual(decode(0xd019, 0x81), { sources: ["raster"], anyInterrupt: true });
  assert.deepEqual(decode(0xdc0d, 0x7f).write, { disables: ["timer A", "timer B", "TOD alarm", "serial port", "FLAG line"] });
  assert.throws(() => decode(0xd020, 1), RangeError);
});

test("the script answers in JSON and refuses bad input", () => {
  const script = resolve(import.meta.dirname, "../../skills/c64-memory-map/scripts/memmap.ts");
  const at = spawnSync(process.execPath, [script, "at", "$d020", "53281", "%1111111111111110"], { encoding: "utf8" });
  assert.equal(at.status, 0);
  assert.deepEqual(
    (JSON.parse(at.stdout) as { addresses: Array<{ name: string }> }).addresses.map((address) => address.name),
    ["EXTCOL", "BGCOL0", "IRQ vector"],
  );
  const bad = spawnSync(process.execPath, [script, "decode", "$d020", "1"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.equal((JSON.parse(bad.stdout) as { error: { code: string } }).error.code, "invalid-input");
});
