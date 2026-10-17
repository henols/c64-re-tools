// The c64-assembler script with real ACME, which it runs itself.
// Skipped (never passed) when ACME is not installed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { STOP_AND_ASK } from "../../src/protocol/messages.ts";
import { importPrg } from "../fixtures/program.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-assembler/scripts/assemble.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-assembler-"));
cpSync(resolve(import.meta.dirname, "../fixtures/asm/counter"), join(project, "src"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));

async function assembleScript(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
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
  assert.deepEqual(symbols.find((symbol) => symbol.name === "MAX"), { name: "MAX", kind: "constant", value: "$000a", used: true });
  assert.equal(symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), undefined, "an unused constant is left out");
  assert.equal(json.unusedConstants, 1);
});

test("--all-symbols lists the unused constants, and --plain writes the bytes without the load address", { skip: acmeSkip }, async () => {
  const { status, json } = await assembleScript("--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/counter.bin", "--plain", "--all-symbols");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.plain, true);
  assert.equal(json.unusedConstants, undefined);
  const symbols = json.symbols as Array<Record<string, unknown>>;
  assert.deepEqual(symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), { name: "UNUSED_CONSTANT", kind: "constant", value: "$0063", used: false });
  const plain = readFileSync(join(project, "build", "counter.bin"));
  assert.deepEqual(plain, readFileSync(join(project, "build", "counter.prg")).subarray(2));
  assert.equal(plain.length, (json.loadRange as { bytes: number }).bytes);
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

test("a missing ACME is refused with the stop instruction", async () => {
  const child = spawn(process.execPath, [...process.execArgv, script, "--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/none.prg"], { cwd: project, env: { ...process.env, C64RT_ACME: join(project, "no-acme") }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const { error } = JSON.parse(stdout) as { error: { code: string; message: string } };
  assert.equal(status, 2);
  assert.equal(error.code, "installation-incomplete");
  assert.ok(error.message.endsWith(STOP_AND_ASK), error.message);
});

test("--compare checks the build against the program in the knowledge and fails on a difference", { skip: acmeSkip }, async () => {
  const first = await assembleScript("--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/reference.prg");
  assert.equal(first.status, 0, JSON.stringify(first.json));
  const refused = await assembleScript("--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(refused.status, 2, "no program in the knowledge yet");
  assert.match((refused.json.error as { message: string }).message, /knowledge\.ts image/);
  importPrg(project, readFileSync(join(project, "build", "reference.prg")));
  const same = await assembleScript("--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(same.status, 0, JSON.stringify(same.json));
  assert.equal((same.json.compare as { identical: boolean }).identical, true);
  const changed = readFileSync(join(project, "build", "reference.prg"));
  changed[10] = changed[10]! ^ 0xff;
  importPrg(project, changed);
  const different = await assembleScript("--source-root", "src", "--entry", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(different.status, 1, "a build that differs is a failed check");
  const [segment] = (different.json.compare as { segments: Array<{ result: string; firstDifference: { address: string } }> }).segments;
  assert.equal(segment!.result, "different");
  assert.equal(segment!.firstDifference.address, "$0809");
});
