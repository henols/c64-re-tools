// Macro candidates: runs of instructions that a macro of the fixed
// catalogue writes as one line, found in code regions and only reported.

import assert from "node:assert/strict";
import { test } from "node:test";

import { assemble } from "../../src/native/acme.ts";
import { ACME, findTool } from "../../src/native/discover.ts";
import { localToolContext } from "../../src/native/local.ts";
import { imageReader } from "../../skills/retro-static-analysis/scripts/lib/coverage.ts";
import { CATALOGUE, findMacroUses } from "../../skills/retro-static-analysis/scripts/lib/macros.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}

/** One idiom of each kind, zero page and absolute, from $1000; RTS ($60) between them ends no run. */
const PARTS: Array<{ bytes: number[]; macro: string; args: string[] }> = [
  { bytes: [0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc], macro: "inc16", args: ["ptr"] },
  { bytes: [0xee, 0x00, 0x20, 0xd0, 0x03, 0xee, 0x01, 0x20], macro: "inc16", args: ["$2000"] },
  { bytes: [0xee, 0xfb, 0x00, 0xd0, 0x03, 0xee, 0xfc, 0x00], macro: "inc16", args: ["$00fb"] },
  { bytes: [0xa5, 0xfd, 0xd0, 0x02, 0xc6, 0xfe, 0xc6, 0xfd], macro: "dec16", args: ["$fd"] },
  { bytes: [0x18, 0xa5, 0xfb, 0x69, 0x28, 0x85, 0xfb, 0x90, 0x02, 0xe6, 0xfc], macro: "add16_8", args: ["ptr", "$28"] },
  { bytes: [0x18, 0xad, 0x00, 0x20, 0x69, 0x40, 0x8d, 0x00, 0x20, 0xad, 0x01, 0x20, 0x69, 0x01, 0x8d, 0x01, 0x20], macro: "add16", args: ["$2000", "$0140"] },
  { bytes: [0x38, 0xa5, 0xfb, 0xe9, 0x40, 0x85, 0xfb, 0xa5, 0xfc, 0xe9, 0x01, 0x85, 0xfc], macro: "sub16", args: ["ptr", "$0140"] },
  { bytes: [0xa9, 0x00, 0x8d, 0x14, 0x03, 0xa9, 0x30, 0x8d, 0x15, 0x03], macro: "set16", args: ["CINV", "irq"] },
  // A value below $0100 is a number, also where a zero-page name has that address.
  { bytes: [0xa9, 0xfb, 0x8d, 0x00, 0x20, 0xa9, 0x00, 0x8d, 0x01, 0x20], macro: "set16", args: ["$2000", "$00fb"] },
  { bytes: [0xa5, 0xfb, 0x85, 0xfd, 0xa5, 0xfc, 0x85, 0xfe], macro: "mov16", args: ["$fd", "ptr"] },
  { bytes: [0xa9, 0x80, 0xcd, 0x12, 0xd0, 0xd0, 0xfb], macro: "wait_line", args: ["$80"] },
];
const NAMES = new Map([[0x00fb, "ptr"], [0x0314, "CINV"], [0x3000, "irq"]]);

/** The parts one after the other from $1000, each followed by an RTS, and where each part starts. */
function program(parts: ReadonlyArray<{ bytes: number[] }>): { memory: Uint8Array; starts: number[]; end: number } {
  const memory = new Uint8Array(0x10000);
  const starts: number[] = [];
  let at = 0x1000;
  for (const part of parts) {
    starts.push(at);
    memory.set([...part.bytes, 0x60], at);
    at += part.bytes.length + 1;
  }
  return { memory, starts, end: at - 1 };
}

test("each idiom of the catalogue is found in a code region, zero page and absolute, with names of the knowledge in its args", () => {
  const { memory, starts, end } = program(PARTS);
  const found = findMacroUses(imageReader(memory, "flat64k"), [{ start: 0x1000, end }], (address) => NAMES.get(address));
  assert.deepEqual(
    found,
    PARTS.map((part, index) => ({ macro: part.macro, start: starts[index]!, end: starts[index]! + part.bytes.length - 1, args: part.args })),
  );
  assert.deepEqual(findMacroUses(imageReader(memory, "flat64k"), [], (address) => NAMES.get(address)), [], "no code region, no candidate");
});

test("a run that is near an idiom is not a candidate", () => {
  const near = [
    [0xe6, 0xfb, 0xd0, 0x03, 0xe6, 0xfc],
    [0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfd],
    [0xe6, 0xfb, 0xd0, 0x03, 0xee, 0xfc, 0x00],
    [0x18, 0xa5, 0xfb, 0x69, 0x28, 0x85, 0xfc, 0x90, 0x02, 0xe6, 0xfc],
    [0x38, 0xa5, 0xfb, 0x69, 0x40, 0x85, 0xfb, 0xa5, 0xfc, 0x69, 0x01, 0x85, 0xfc],
    [0xa9, 0x00, 0x8d, 0x14, 0x03, 0xa9, 0x30, 0x8d, 0x16, 0x03],
    [0xa9, 0x80, 0xcd, 0x11, 0xd0, 0xd0, 0xfb],
  ];
  const { memory, end } = program(near.map((bytes) => ({ bytes })));
  assert.deepEqual(findMacroUses(imageReader(memory, "flat64k"), [{ start: 0x1000, end }], () => undefined), []);
});

test("with real ACME, each body of the catalogue with the found args gives the bytes it was found in", { skip: acmeSkip }, async () => {
  const { memory, starts } = program(PARTS);
  const found = findMacroUses(imageReader(memory, "flat64k"), [{ start: 0x1000, end: 0x1fff }], (address) => NAMES.get(address));
  const macros = CATALOGUE.map((idiom) => `!macro ${idiom.name} ${idiom.params.map((param) => `.${param}`).join(", ")} {\n${idiom.body}\n}`).join("\n");
  const names = [...NAMES].map(([address, name]) => `${name} = $${address.toString(16).padStart(address < 0x100 ? 2 : 4, "0")}`);
  const uses = found.flatMap((candidate) => [`* = $${candidate.start.toString(16)}`, `        +${candidate.macro} ${candidate.args.join(", ")}`]);
  const text = Buffer.from(["!cpu 6510", ...names, macros, ...uses].join("\n") + "\n");
  const { result, attachments } = await assemble({ files: [{ path: "uses.asm", size: text.length }], entrySource: "uses.asm", includeDirs: [], defines: {} }, [text], localToolContext());
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  const built = attachments![0]!;
  const start = result.loadRange!.start;
  PARTS.forEach((part, index) => {
    const at = 2 + starts[index]! - start;
    assert.deepEqual([...built.subarray(at, at + part.bytes.length)], part.bytes, `${part.macro} ${part.args.join(", ")}`);
  });
});
