// The c64-assembler script against a real Host Runtime server with real ACME.
// Skipped (never passed) when ACME is not installed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../src/host/processes.ts";
import { startHostServer, type HostServer } from "../../src/host/server.ts";
import { ACME, findTool } from "../../src/host/tools/discover.ts";
import { createToolDispatcher } from "../../src/host/tools/index.ts";
import { WireFailure } from "../../src/protocol.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-assembler/scripts/assemble.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-assembler-"));
cpSync(resolve(import.meta.dirname, "../fixtures/asm/counter"), join(project, "src"), { recursive: true });
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

async function assembleScript(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: await hostEnv() }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("the script writes the program into the project and reports symbols", { skip: acmeSkip }, async () => {
  const { status, json } = await assembleScript("--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/counter.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.assembled, true);
  assert.equal(json.output, "build/counter.prg");
  assert.deepEqual((json.loadRange as { start: string }).start, "$0801");
  const program = readFileSync(join(project, "build", "counter.prg"));
  assert.equal(program.readUInt16LE(0), 0x0801);
  const symbols = json.symbols as Array<Record<string, unknown>>;
  assert.deepEqual(symbols.find((symbol) => symbol.name === "start"), { name: "start", kind: "address", address: "$080d", used: false });
  assert.deepEqual(symbols.find((symbol) => symbol.name === "MAX"), { name: "MAX", kind: "constant", value: 10, used: true });
});

test("source errors print diagnostics, exit 1 and write no program", { skip: acmeSkip }, async () => {
  writeFileSync(join(project, "src", "broken.a"), "* = $c000\n  lda #$123\n");
  const { status, json } = await assembleScript("--source-root", "src", "--entry", "broken.a", "--out", "build/broken.prg");
  assert.equal(status, 1);
  assert.equal(json.assembled, false);
  assert.equal((json.diagnostics as Array<{ line: number }>)[0]?.line, 2);
  assert.equal(existsSync(join(project, "build", "broken.prg")), false);
});

test("bad options are refused before anything is sent", { skip: acmeSkip }, async () => {
  for (const args of [
    ["--source-root", "src", "--entry", "main.a"],
    ["--source-root", "src", "--entry", "main.a", "--out", "../escape.prg"],
    ["--source-root", "src", "--entry", "main.a", "--out", "x.prg", "--define", "X=abc"],
    ["--source-root", "src", "--entry", "main.a", "--out", "x.prg", "--set-pc", "2049"],
  ]) {
    const { status, json } = await assembleScript(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
  }
});
