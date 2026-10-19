import assert from "node:assert/strict";
import { test } from "node:test";

import { filledSegments, parseSjasmplusDiagnostics, parseSjasmplusSymbols, wrapperSource } from "./sjasmplus.ts";

test("the wrapper sets the device, fills the memory with the marker, includes the entry source and saves the memory", () => {
  const text = wrapperSource({ files: [], entrySource: "src/main.asm", includeDirs: [], defines: {}, model: "128k" }, 0xaa, "C:\\tmp\\memory.bin");
  assert.equal(text, '\tDEVICE ZXSPECTRUM128\n\tORG 0\n\tBLOCK 65536, 170\n\tINCLUDE "src/main.asm"\n\tSAVEBIN "C:/tmp/memory.bin", 0, 65536\n');
});

test("the bytes of the program are where both memories hold the same byte", () => {
  const first = new Uint8Array(0x10000).fill(0xaa);
  const second = new Uint8Array(0x10000).fill(0x55);
  first.set([0xf3, 0xc9], 0x8000);
  second.set([0xf3, 0xc9], 0x8000);
  first[0x9000] = second[0x9000] = 0;
  assert.deepEqual(filledSegments(first, second), [
    { start: 0x8000, end: 0x8001 },
    { start: 0x9000, end: 0x9000 },
  ]);
});

test("sjasmplus diagnostics and symbols are read; a line of the wrapper has no location", () => {
  const output = "main.asm(3): error: Unrecognized instruction: foo bar\nmain.asm(4): warning[out]: value 0x123 is truncated\n__c64rt_build_0.asm(4): error: some wrapper error\n";
  assert.deepEqual(parseSjasmplusDiagnostics(output, "__c64rt_build_0.asm"), [
    { severity: "error", file: "main.asm", line: 3, message: "Unrecognized instruction: foo bar" },
    { severity: "warning", file: "main.asm", line: 4, message: "value 0x123 is truncated" },
    { severity: "error", message: "some wrapper error" },
  ]);
  assert.deepEqual(parseSjasmplusSymbols("count: EQU 0x00008030\nLIMIT: EQU 0x00000010\n", [{ start: 0x8000, end: 0x80ff }]), [
    { name: "LIMIT", kind: "constant", value: 0x10, used: true },
    { name: "count", kind: "address", address: 0x8030, used: true },
  ]);
});
