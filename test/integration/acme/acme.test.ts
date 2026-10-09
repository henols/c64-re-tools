// Real-ACME checks of the ACME adapter, run where the skill script runs it.
// Skipped (never passed) when ACME is not installed on this machine.

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { readProjectTree } from "../../../src/host-client/transfer.ts";
import { assemble } from "../../../src/native/acme.ts";
import { ACME, findTool } from "../../../src/native/discover.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { AcmeParams } from "../../../src/native/types.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-acme-"));
cpSync(resolve(import.meta.dirname, "../../fixtures/asm/counter"), join(project, "src"), { recursive: true });
writeFileSync(join(project, "src", "bad.a"), "* = $c000\n        lda #$123\n        jmp nowhere\n");
const supervisor = new ProcessSupervisor();
supervisor.installExitGuard();
after(() => rmSync(project, { recursive: true, force: true }));

async function run(params: Omit<AcmeParams, "files" | "includeDirs" | "defines"> & Partial<AcmeParams>) {
  const tree = readProjectTree("src", { root: project });
  const { result, attachments } = await assemble({ includeDirs: [], defines: {}, ...params, files: tree.files }, tree.contents, { supervisor, signal: new AbortController().signal });
  return { ...result, program: attachments?.[0] };
}

test("the fixture assembles to a PRG with its load range and symbols", { skip: acmeSkip }, async () => {
  const result = await run({ entrySource: "main.a", includeDirs: ["lib"] });
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.equal(result.loadRange?.start, 0x0801);
  assert.equal(result.program?.readUInt16LE(0), 0x0801);
  assert.equal(result.loadRange?.bytes, result.program!.length - 2);
  const byName = new Map(result.symbols!.map((symbol) => [symbol.name, symbol]));
  assert.deepEqual(byName.get("start"), { name: "start", kind: "address", value: 0x080d, used: false });
  assert.deepEqual(byName.get("MAX"), { name: "MAX", kind: "constant", value: 10, used: true });
  assert.equal(byName.get("UNUSED_CONSTANT")?.used, false);
  assert.equal(byName.get("RESULT")?.kind, "constant", "$c100 is outside the program");
});

test("defines and setPc reach the assembly", { skip: acmeSkip }, async () => {
  writeFileSync(join(project, "src", "define.a"), "        lda #VALUE\n");
  const result = await run({ entrySource: "define.a", defines: { VALUE: 7 }, setPc: 0xc000 });
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...result.program!], [0x00, 0xc0, 0xa9, 0x07]);
});

test("source errors are a domain result with diagnostics, not a failure", { skip: acmeSkip }, async () => {
  const result = await run({ entrySource: "bad.a" });
  assert.equal(result.assembled, false);
  assert.equal(result.program, undefined);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.file === "bad.a" && diagnostic.line === 2), JSON.stringify(result.diagnostics));
  for (const diagnostic of result.diagnostics) assert.doesNotMatch(diagnostic.file ?? "", /^\//, "no temporary paths");
});
