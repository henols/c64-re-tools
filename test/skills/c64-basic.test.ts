// The c64-basic script against a real Host Runtime server with real petcat.
// Skipped (never passed) when petcat is not installed.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { PETCAT } from "../../src/native/discover.ts";
import { borderLoopPrg } from "../fixtures/prg/border-loop.ts";
import { runScript, scratchDir, skillScript, toolSkip } from "../kit.ts";
import { toolsHost } from "./tools-host.ts";

const skip = toolSkip(PETCAT);

const script = skillScript("c64-basic", "basic.ts");
const project = scratchDir("basic");
writeFileSync(join(project, "loop.prg"), borderLoopPrg);
writeFileSync(join(project, "code.prg"), Buffer.from([0x00, 0xc0, 0x0b, 0xc0, 0xff, 0xff, 0xa9, 0x00]));
// 10 PRINT: BASIC that starts no machine code.
writeFileSync(join(project, "print.prg"), Buffer.from([0x01, 0x08, 0x07, 0x08, 0x0a, 0x00, 0x99, 0x00, 0x00, 0x00]));
const host = toolsHost();

async function basic(...args: string[]) {
  return runScript(script, args, { cwd: project, host: await host() });
}

test("a BASIC loader gives its listing and a handoff into the code after BASIC", { skip }, async () => {
  const { status, json, envelope } = await basic("list", "loop.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(envelope.hint, "Disassemble the machine code at $080d.");
  assert.deepEqual(json, {
    loadRange: { start: "$0801", end: "$0812" },
    basicEnd: "$080d",
    machineCode: { start: "$080d", end: "$0812", fileOffset: 14 },
    listing: "10 sys2061",
    handoffs: [{ kind: "sys", line: 10, address: "$080d" }],
  });
});

test("BASIC without SYS or USR gives no handoff, and a hint where to look", { skip }, async () => {
  const { status, json, envelope } = await basic("list", "print.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.handoffs, []);
  assert.equal(envelope.hint, "The BASIC starts no machine code with SYS or USR. Look in the listing for a POKE into a vector or a LOAD of another file.");
});

test("machine code is no BASIC program, with the hint to disassemble it", { skip }, async () => {
  const code = await basic("list", "code.prg");
  assert.equal(code.status, 2);
  assert.equal(code.envelope.code, "invalid-input");
  assert.equal(code.envelope.error, "code.prg is no BASIC program: Line number 65535 is above 63999, so the bytes are no BASIC program.");
  assert.equal(code.envelope.hint, "Usually the file is machine code. Disassemble it from its load address.");
});
