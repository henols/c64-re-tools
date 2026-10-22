import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { Refusal } from "../errors.ts";
import { openForWrite, textPath } from "./database.ts";
import { machineOf, mainSpaceOf } from "./project-machine.ts";
import { requireProgram, setImage } from "./program.ts";
import { listSymbols, symbolAt } from "./read.ts";
import { applyBatch, classifyRegion, renameSymbol, revert, setMacro, setModule, setOperand, setStartScreen, writeMachine } from "./write.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function project() {
  const folder = mkdtempSync(join(tmpdir(), "c64-re-tools-machine-"));
  roots.push(folder);
  return { folder, db: openForWrite(folder) };
}

const refused = (code: string, pattern: RegExp) => (error: unknown) => error instanceof Refusal && error.code === code && pattern.test(error.message);

test("a project whose knowledge names no machine is a C64, and its default space is c64", () => {
  const { db } = project();
  assert.equal(machineOf(db).id, "c64");
  assert.equal(mainSpaceOf(db), "c64");
  renameSymbol(db, { origin: "llm" }, { address: 0xc000, name: "start" });
  assert.equal(symbolAt(db, 0xc000)?.space, "c64");
  assert.throws(() => renameSymbol(db, { origin: "llm" }, { address: 0x8000, name: "main", space: "spectrum" }), refused("invalid-input", /spectrum is no space of the Commodore 64/));
  db.close();
});

test("a Spectrum project writes in its own spaces, a 128K RAM bank only at $c000-$ffff", () => {
  const { folder, db } = project();
  assert.equal(writeMachine(db, { origin: "user" }, { machine: "spectrum128" }).current.space, "spectrum");
  assert.equal(machineOf(db).name, "ZX Spectrum 128K");
  renameSymbol(db, { origin: "llm" }, { address: 0x8000, name: "main" });
  assert.equal(listSymbols(db)[0]?.space, "spectrum", "the default space is the CPU view");
  renameSymbol(db, { origin: "llm" }, { address: 0xc000, name: "level_data", space: "ram3" });
  assert.throws(() => renameSymbol(db, { origin: "llm" }, { address: 0x4000, name: "too_low", space: "ram3" }), refused("invalid-input", /ram3 holds \$c000-\$ffff only/));
  assert.throws(() => renameSymbol(db, { origin: "llm" }, { address: 0x8000, name: "elsewhere", space: "c64" }), refused("invalid-input", /c64 is no space of the ZX Spectrum 128K/));
  assert.throws(() => applyBatch(db, { origin: "llm" }, [{ op: "rename", address: 0xc000, name: "x", space: "drive8" }]), refused("invalid-input", /drive8 is no space/));
  // The machine row goes to text with its space.
  const line = JSON.parse(readFileSync(join(textPath(folder), "machine.jsonl"), "utf8").trim()) as Record<string, unknown>;
  assert.deepEqual([line.space, line.machine, line.origin], ["spectrum", "spectrum128", "user"]);
  db.close();
});

test("a machine without a space for the current knowledge is refused; the same machine again writes nothing", () => {
  const { db } = project();
  writeMachine(db, { origin: "user" }, { machine: "spectrum128" });
  renameSymbol(db, { origin: "llm" }, { address: 0xc000, name: "bank_code", space: "ram1" });
  assert.throws(() => writeMachine(db, { origin: "user" }, { machine: "spectrum48" }), refused("conflict", /rows in ram1, and the ZX Spectrum 48K has no such space/));
  assert.throws(() => writeMachine(db, { origin: "user" }, { machine: "c64" }), refused("conflict", /rows in ram1, and the Commodore 64 has no such space/));
  assert.equal(writeMachine(db, { origin: "user" }, { machine: "spectrum128" }).revision, null);
  assert.throws(() => writeMachine(db, { origin: "user" }, { machine: "c128" }), refused("invalid-input", /"c128" is not a machine/));
  db.close();
});

test("a revert gives back the machine of the revision it restores", () => {
  const { db } = project();
  const first = writeMachine(db, { origin: "user" }, { machine: "spectrum48" }).revision!;
  writeMachine(db, { origin: "user" }, { machine: "spectrum128" });
  assert.equal(machineOf(db).id, "spectrum128");
  revert(db, { origin: "user" }, { revision: first });
  assert.equal(machineOf(db).id, "spectrum48");
  db.close();
});

test("a Spectrum project checks names and operands with the Z80: ld is no label, LD HL,nn has a word operand, JR a distance", () => {
  const { db } = project();
  writeMachine(db, { origin: "user" }, { machine: "spectrum48" });
  assert.throws(() => renameSymbol(db, { origin: "llm" }, { address: 0x9000, name: "ld" }), refused("invalid-input", /ld is the name of a Z80 instruction, register or condition/));
  renameSymbol(db, { origin: "llm" }, { address: 0x9000, name: "counter" });
  renameSymbol(db, { origin: "llm" }, { address: 0x9010, name: "lda" });
  // $8000 LD HL,$9000 ; $8003 JR $8000 ; $8005 LD A,$05
  const code = new Map([[0x8000, 0x21], [0x8001, 0x00], [0x8002, 0x90], [0x8003, 0x18], [0x8004, 0xfb], [0x8005, 0x3e], [0x8006, 0x05]]);
  const image = () => ({ byteAt: (address: number) => code.get(address), platform: new Map<string, number>() });
  classifyRegion(db, { origin: "llm" }, { start: 0x8000, end: 0x8006, type: "code" });
  assert.equal(setOperand(db, { origin: "llm", image }, { address: 0x8000, select: "value", symbol: "counter" }).current.symbol, "counter");
  assert.throws(() => setOperand(db, { origin: "llm", image }, { address: 0x8003, select: "value", symbol: "counter" }), refused("invalid-input", /is a branch: its operand is a distance/));
  assert.throws(() => setOperand(db, { origin: "llm", image }, { address: 0x8001, select: "value", symbol: "counter" }), refused("invalid-input", /\$8001 is not the start of an instruction/));
  assert.throws(() => setOperand(db, { origin: "llm", image }, { address: 0x8005, select: "value", symbol: "counter" }), refused("invalid-input", /gives \$9000, but the operand in the image is \$05/));
  db.close();
});

test("a Spectrum project refuses a space of the C64, a start screen before its checks, macros, classify in the ROM, and a model that its entry state does not name", () => {
  const { db } = project();
  writeMachine(db, { origin: "user" }, { machine: "spectrum48" });
  assert.throws(() => requireProgram(db), refused("not-found", /Put the program into the project knowledge with image: a \.z80 or \.sna snapshot/));
  setImage(db, { origin: "user" }, { segments: [{ start: 0x8000, end: 0x8003 }], byteAt: () => 0, entry: 0x8000, state: { registers: { pc: "$8000", af: "$0000" }, border: 7 } });
  assert.throws(() => requireProgram(db, "c64"), refused("invalid-input", /c64 is no space of the ZX Spectrum 48K, the machine of the project: its spaces are spectrum/));
  // An empty request: the machine refuses it before the checks of a start screen.
  assert.throws(() => setStartScreen(db, { origin: "user" }, {} as Parameters<typeof setStartScreen>[2]), refused("invalid-input", /A start screen is for the C64 loader of the generated source, and the machine of the project is the ZX Spectrum 48K/));
  assert.throws(() => setMacro(db, { origin: "llm" }, { name: "copy_block", body: "ldir" }), refused("invalid-input", /The generated source of the ZX Spectrum 48K writes no macros/));
  assert.throws(() => applyBatch(db, { origin: "llm" }, [{ op: "use", start: 0x8000, end: 0x8001, macro: "copy_block", args: [] }]), refused("invalid-input", /writes no macros/));
  assert.equal(setModule(db, { origin: "llm" }, { start: 0x8000, file: "input/count.asm" }).current.file, "input/count.asm");
  assert.throws(() => classifyRegion(db, { origin: "llm" }, { start: 0x0010, end: 0x0020, type: "bytes" }), refused("invalid-input", /\$0010-\$0020 is in the ROM of the ZX Spectrum 48K \(\$0000-\$3fff\)/));
  assert.throws(() => writeMachine(db, { origin: "user" }, { machine: "spectrum128" }), refused("conflict", /The entry state of the program in the knowledge is of a ZX Spectrum 48K snapshot, not of the ZX Spectrum 128K/));
  db.close();
});
