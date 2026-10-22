// The c64-basic script against a real Host Runtime server with real petcat.
// Skipped (never passed) when petcat is not installed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../src/host/server.ts";
import { findTool, PETCAT } from "../../src/native/discover.ts";
import { createToolDispatcher } from "../../src/host/tools/index.ts";
import { WireFailure } from "../../src/protocol/messages.ts";
import { borderLoopPrg } from "../fixtures/prg/border-loop.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(PETCAT);
} catch {
  skip = "petcat is not installed: install VICE or set C64RT_PETCAT to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-basic/scripts/basic.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-basic-"));
writeFileSync(join(project, "loop.prg"), borderLoopPrg);
writeFileSync(join(project, "code.prg"), Buffer.from([0x00, 0xc0, 0x0b, 0xc0, 0xff, 0xff, 0xa9, 0x00]));
// 10 PRINT: BASIC that starts no machine code.
writeFileSync(join(project, "print.prg"), Buffer.from([0x01, 0x08, 0x07, 0x08, 0x0a, 0x00, 0x99, 0x00, 0x00, 0x00]));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function hostEnv(): Promise<string> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({
      port: 0,
      createViceSession: async () => {
        throw new WireFailure("machine-unavailable", "no emulators here");
      },
      tools: createToolDispatcher({ supervisor }),
    });
  }
  return `${server.host}:${server.port}`;
}

async function basic(...args: string[]): Promise<{ status: number | null; json: Record<string, any>; envelope: ScriptEnvelope }> {
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: await hostEnv() }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, ...readEnvelope(stdout, status) };
}

test("a BASIC loader gives its listing and a handoff into the code after BASIC", { skip }, async () => {
  const { status, json, envelope } = await basic("list", "loop.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(envelope.hint, "Disassemble the machine code at $080d.");
  assert.deepEqual(json, {
    loadRange: { start: "$0801", end: "$0812" },
    basicEnd: "$080d",
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
