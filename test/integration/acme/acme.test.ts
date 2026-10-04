// Real-ACME checks through the real Host Runtime server and tools client.
// Skipped (never passed) when ACME is not installed on this machine.

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { assemble } from "../../../src/host-client/tools.ts";
import { ProcessSupervisor } from "../../../src/host/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { ACME, findTool } from "../../../src/host/tools/discover.ts";
import { createToolDispatcher } from "../../../src/host/tools/index.ts";
import { WireFailure } from "../../../src/protocol.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-acme-"));
cpSync(resolve(import.meta.dirname, "../../fixtures/asm/counter"), join(project, "src"), { recursive: true });
writeFileSync(join(project, "src", "bad.a"), "* = $c000\n        lda #$123\n        jmp nowhere\n");
process.chdir(project);

let server: HostServer;
let env: NodeJS.ProcessEnv;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function host(): Promise<NodeJS.ProcessEnv> {
  if (env !== undefined) return env;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({
    port: 0,
    createViceSession: async () => {
      throw new WireFailure("machine-unavailable", "no emulators here");
    },
    tools: createToolDispatcher({ supervisor }),
  });
  env = { C64RT_HOST: `${server.host}:${server.port}` };
  return env;
}

test("the fixture assembles to a PRG with its load range and symbols", { skip: acmeSkip }, async () => {
  const result = await assemble({ sourceRoot: "src", entrySource: "main.a", includeDirs: ["lib"] }, { env: await host() });
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
  const result = await assemble({ sourceRoot: "src", entrySource: "define.a", defines: { VALUE: 7 }, setPc: 0xc000 }, { env: await host() });
  assert.equal(result.assembled, true, JSON.stringify(result.diagnostics));
  assert.deepEqual([...result.program!], [0x00, 0xc0, 0xa9, 0x07]);
});

test("source errors are a domain result with diagnostics, not a failure", { skip: acmeSkip }, async () => {
  const result = await assemble({ sourceRoot: "src", entrySource: "bad.a" }, { env: await host() });
  assert.equal(result.assembled, false);
  assert.equal(result.program, undefined);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.file === "bad.a" && diagnostic.line === 2), JSON.stringify(result.diagnostics));
  for (const diagnostic of result.diagnostics) assert.doesNotMatch(diagnostic.file ?? "", /^\//, "no host paths");
});
