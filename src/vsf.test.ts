import assert from "node:assert/strict";
import { test } from "node:test";

import { pressSnapshotRestore, setSnapshotMatrix, snapshotModule } from "./vsf.ts";
import { buildSnapshot, cpuModule, keyboardModule } from "./vsf.testkit.ts";

test("a module of a snapshot file is found by name, and its data is a view into the file", () => {
  const file = buildSnapshot([cpuModule(5n), keyboardModule(), { name: "C64MEM", major: 0, minor: 1, data: Buffer.from("ram") }]);
  const memory = snapshotModule(file, "C64MEM")!;
  assert.deepEqual([memory.major, memory.minor, memory.data.toString()], [0, 1, "ram"]);
  memory.data[0] = 0x52;
  assert.equal(snapshotModule(file, "C64MEM")!.data.toString(), "Ram");
  assert.equal(snapshotModule(file, "SID"), undefined);
  assert.equal(snapshotModule(Buffer.from("no snapshot"), "C64MEM"), undefined);
});

test("the matrix goes into keyarr by row and into rev_keyarr by column", () => {
  const file = buildSnapshot([keyboardModule()]);
  assert.equal(setSnapshotMatrix(file, [0x10, 0x80, 0, 0, 0, 0, 0, 0x20]), undefined);
  const data = snapshotModule(file, "KEYBOARD")!.data;
  const dwords = Array.from({ length: 24 }, (_, index) => data.readUInt32LE(index * 4));
  // keyarr: F1 (row 0 bit 4), LSHIFT (row 1 bit 7), CBM (row 7 bit 5); rows 8-15 stay 0.
  assert.deepEqual(dwords.slice(0, 16), [0x10, 0x80, 0, 0, 0, 0, 0, 0x20, 0, 0, 0, 0, 0, 0, 0, 0]);
  // rev_keyarr: column 4 has row 0, column 5 row 7, column 7 row 1.
  assert.deepEqual(dwords.slice(16), [0, 0, 0, 0, 0x01, 0x80, 0, 0x02]);
  assert.equal(setSnapshotMatrix(file, [0, 0, 0, 0, 0, 0, 0, 0]), undefined);
  assert.ok(data.every((byte) => byte === 0), "all keys up again");
});

test("RESTORE makes an NMI pending at the clock of the snapshot", () => {
  const file = buildSnapshot([cpuModule(123_456n, { pending: 0x40 })]);
  assert.equal(pressSnapshotRestore(file), undefined);
  const data = snapshotModule(file, "MAINC64CPU")!.data;
  assert.equal(data.readUInt32LE(83), 0x41, "IK_NMI is set beside the other pending interrupts");
  assert.equal(data.readBigUInt64LE(43), 123_456n, "nmi_clk is the clock");
});

test("RESTORE gives no new NMI edge while another source holds the NMI line, or one is pending", () => {
  for (const nmi of [{ nnmi: 1 }, { pending: 1 }]) {
    const file = buildSnapshot([cpuModule(9n, nmi)]);
    const before = Buffer.from(file);
    assert.equal(pressSnapshotRestore(file), undefined);
    assert.deepEqual(file, before);
  }
});

test("VICE 3.9 names the CPU module MAINCPU 1.4, with the same data", () => {
  const cpu = { ...cpuModule(7n), name: "MAINCPU", minor: 4 };
  const file = buildSnapshot([cpu]);
  assert.equal(pressSnapshotRestore(file), undefined);
  assert.equal(snapshotModule(file, "MAINCPU")!.data.readUInt32LE(83), 1);
});

test("a module of another version is not changed", () => {
  const keyboard = { ...keyboardModule(), minor: 2 };
  assert.match(setSnapshotMatrix(buildSnapshot([keyboard]), [1]) ?? "", /KEYBOARD 1\.2 with 96 bytes, and c64-re-tools knows 1\.1 with 96/);
  assert.match(setSnapshotMatrix(buildSnapshot([cpuModule(1n)]), [1]) ?? "", /has no module KEYBOARD/);
  assert.match(pressSnapshotRestore(buildSnapshot([{ ...cpuModule(1n), major: 2 }])) ?? "", /MAINC64CPU 2\.5/);
  assert.match(pressSnapshotRestore(buildSnapshot([keyboardModule()])) ?? "", /has no module MAINC64CPU or MAINCPU/);
});
