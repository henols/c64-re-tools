// The c64-memory-map lookup and decoders.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { assemble } from "../../src/native/acme.ts";
import { ACME, findTool } from "../../src/native/discover.ts";
import { localToolContext } from "../../src/native/local.ts";
import { Refusal } from "../../src/errors.ts";
import { areaOf, decode, describeAddress, IO, lookup, platformNames, ROM } from "../../src/platform.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-memmap-"));
after(() => rmSync(project, { recursive: true, force: true }));
let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run this test";
}

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

test("each address has one area: a chip register block, or a memory area with its meaning", () => {
  assert.deepEqual(areaOf(0xd020), { name: "VIC-II registers", start: 0xd000, end: 0xd3ff, kind: "platform" });
  assert.deepEqual(areaOf(0xdc0d), { name: "CIA 1 registers", start: 0xdc00, end: 0xdcff, kind: "platform" });
  assert.deepEqual(areaOf(0x00fb), { name: "zero page", start: 0x0000, end: 0x00ff, kind: "platform", meaning: "Zero page. The system uses most of it; $FB-$FE are free." });
  assert.equal(areaOf(0x2000).kind, "application");
  for (let address = 0; address <= 0xffff; address++) assert.equal(areaOf(address).name, lookup(address).area, `area of ${address.toString(16)}`);
  assert.deepEqual(describeAddress(0xd060), { area: areaOf(0xd020), mirrorOf: 0xd020 });
  assert.deepEqual(describeAddress(0xd020), { area: areaOf(0xd020) });
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
  assert.throws(() => decode(0xd020, 1), (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /There is no decoder for \$d020/.test(error.message));
});

const script = resolve(import.meta.dirname, "../../skills/c64-memory-map/scripts/memory-map.ts");

/** Runs memory-map.ts and reads its envelope; json is the body, or { error } for a refusal. */
function memoryMap(args: string[], cwd?: string): { status: number | null; json: any; envelope: ScriptEnvelope } {
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { encoding: "utf8", ...(cwd === undefined ? {} : { cwd }) });
  return { status: run.status, ...readEnvelope(run.stdout, run.status) };
}

test("the script answers in JSON and refuses bad input", () => {
  const at = memoryMap(["at", "$d020", "$D021", "$fffe", "$fb"]);
  assert.equal(at.status, 0);
  assert.deepEqual(
    (at.json as { addresses: Array<{ name: string }> }).addresses.map((address) => address.name),
    ["EXTCOL", "BGCOL0", "IRQ vector", "FREEZP"],
  );
  assert.equal(at.envelope.hint, undefined, "platform addresses need no hint");
  const free = memoryMap(["at", "$c000", "$d020"]);
  assert.equal(free.envelope.hint, "The program decides the use of $c000. Find its use in the disassembly or in the emulator.");
  for (const address of ["53281", "%1111111111111110", "d020"]) {
    const refused = memoryMap(["at", address]);
    assert.equal(refused.status, 2, address);
    assert.equal(refused.json.error.code, "invalid-input", address);
  }
  const unknown = memoryMap(["at", "d020"]);
  assert.equal(unknown.envelope.error, "<address>: d020 is not a C64 platform name and not a name in the knowledge.");
  assert.match(unknown.envelope.hint!, /^Give a \$ address, a platform name that the command list or export shows \(for example SCROLY or CHROUT\), or a symbol of the project knowledge\./);
  // The platform names of memory-map itself, in any letter case, for at and decode.
  const named = memoryMap(["at", "SCROLY", "chrout"]).json as { addresses: Array<{ address: string; name: string }> };
  assert.deepEqual(named.addresses.map((address) => [address.address, address.name]), [["$d011", "SCROLY"], ["$ffd2", "CHROUT"]]);
  const decoded = memoryMap(["decode", "SCROLY", "$1b"]).json as { register: string; name: string };
  assert.deepEqual([decoded.register, decoded.name], ["$d011", "SCROLY"]);
  const vic = memoryMap(["list", "vic"]);
  assert.deepEqual([vic.json.entries.count, vic.json.entries.listed.length, vic.json.entries.listed[0]!.name, vic.json.entries.rest, vic.envelope.nextAction], [47, 47, "SP0X", undefined, undefined]);
  const system = memoryMap(["list", "system", "--max-listed", "2"]);
  assert.deepEqual([system.json.entries.count, system.json.entries.listed.length, system.json.entries.rest], [108, 2, "a larger --max-listed, or the command export for every platform name"]);
  assert.equal(system.envelope.hint, "The list is cut. To get all 108 entries, give --max-listed 108.");
  assert.match(system.envelope.nextAction!, /^node \/\S+memory-map\.ts list system --max-listed 108( --project \S+)?$/);
  const value = memoryMap(["decode", "$1", "%00110111"]);
  assert.equal(value.json.value, "$37", "a value takes $ and hex, decimal, or % and binary");
  const bad = memoryMap(["decode", "$d020", "1"]);
  assert.equal(bad.status, 2);
  assert.equal(bad.json.error.code, "invalid-input");
  // --bank is only for $d018: another register refuses it, and does not ignore it.
  const bank = memoryMap(["decode", "$d011", "$1b", "--bank", "$97"]);
  assert.equal(bank.status, 2, JSON.stringify(bank.envelope));
  assert.equal(bank.envelope.error, "--bank works only with $d018 (VMCSB), not with $d011.");
  assert.match(bank.envelope.hint!, /^Remove --bank\./);
  const vmcsb = memoryMap(["decode", "VMCSB", "$15", "--bank", "$97"]);
  assert.deepEqual([vmcsb.status, vmcsb.envelope.hint], [0, undefined]);
  assert.match(memoryMap(["decode", "VMCSB", "$15"]).envelope.hint!, /give --bank with the value of \$dd00/);
  const help = memoryMap([]);
  assert.deepEqual([help.envelope.command, help.json.commands.map((command: { name: string }) => command.name)], ["help", ["at", "decode", "list", "export"]]);
});

test("every address in $d000-$dfff says that it is visible only while $01 maps I/O in", () => {
  const run = memoryMap(["at", "$d020", "$d800", "$dbff", "$de00", "$cfff", "$e000"]);
  assert.equal(run.status, 0);
  const visible = (run.json as { addresses: Array<{ visible?: string }> }).addresses.map((address) => address.visible !== undefined);
  assert.deepEqual(visible, [true, true, true, true, false, false]);
});

test("the platform names are symbols, each name once", () => {
  const names = platformNames();
  assert.ok(names.every((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item.name)));
  assert.equal(new Set(names.map((item) => item.name)).size, names.length);
  assert.ok(names.some((item) => item.name === "EXTCOL" && item.address === 0xd020));
  assert.ok(names.some((item) => item.name === "CHROUT" && item.address === 0xffd2));
});

test("export writes the platform names as an ACME include that ACME reads", { skip: acmeSkip }, async () => {
  const run = memoryMap(["export", "--out", "src/hw.asm"], project);
  assert.equal(run.status, 0, JSON.stringify(run.envelope));
  assert.equal(run.json.names, platformNames().length);
  const include = readFileSync(join(project, "src", "hw.asm"));
  assert.match(include.toString(), /^EXTCOL = \$d020 +; Border color/m);
  assert.match(include.toString(), /^ADRAY2 = \$05 +;/m);
  const main = Buffer.from('!source "hw.asm"\n* = $1000\n        sta EXTCOL\n        jsr CHROUT\n        lda ADRAY2\n        sta (ADRAY2),y\n');
  const { result, attachments } = await assemble(
    { files: [{ path: "hw.asm", size: include.length }, { path: "main.asm", size: main.length }], entrySource: "main.asm", includeDirs: [], defines: {} },
    [include, main],
    localToolContext(),
  );
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...attachments![0]!.subarray(2)], [0x8d, 0x20, 0xd0, 0x20, 0xd2, 0xff, 0xa5, 0x05, 0x91, 0x05]);
  assert.equal(memoryMap(["export"], project).status, 2);
});
