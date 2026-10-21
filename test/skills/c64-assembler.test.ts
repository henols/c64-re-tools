// The c64-assembler script with real ACME, which it runs itself.
// Skipped (never passed) when ACME is not installed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { STOP_AND_ASK } from "../../src/protocol/messages.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";
import { importPrg } from "../fixtures/program.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-assembler/scripts/assembler.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-assembler-"));
cpSync(resolve(import.meta.dirname, "../fixtures/asm/counter"), join(project, "src"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));

async function assembleScript(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope }> {
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, ...readEnvelope(stdout, status) };
}

test("the script writes the program into the project and reports symbols", { skip: acmeSkip }, async () => {
  const { status, json } = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/counter.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal(json.assembled, true);
  assert.equal(json.out, "build/counter.prg");
  assert.match(String(json.sha256), /^[0-9a-f]{64}$/);
  assert.deepEqual((json.loadRange as { start: string }).start, "$0801");
  const program = readFileSync(join(project, "build", "counter.prg"));
  assert.equal(program.readUInt16LE(0), 0x0801);
  const { count, listed: symbols } = json.symbols as { count: number; listed: Array<Record<string, unknown>> };
  assert.equal(count, symbols.length);
  assert.deepEqual(symbols.find((symbol) => symbol.name === "start"), { name: "start", kind: "address", address: "$080d", used: false });
  assert.deepEqual(symbols.find((symbol) => symbol.name === "MAX"), { name: "MAX", kind: "constant", value: "$000a", used: true });
  assert.equal(symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), undefined, "an unused constant is left out");
  assert.equal(json.unusedConstants, 1);
});

test("--max-listed limits the symbols in the result, and the symbols file in symbols/ has the whole list, without the unused constants", { skip: acmeSkip }, async () => {
  const { status, json, envelope } = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/counter.prg", "--max-listed", "1");
  assert.equal(status, 0, JSON.stringify(json));
  const symbols = json.symbols as { count: number; listed: unknown[]; rest: string };
  assert.equal(symbols.listed.length, 1);
  assert.ok(symbols.count > 1);
  assert.equal(symbols.rest, "a larger --max-listed, or read build/symbols/counter.json");
  const file = JSON.parse(readFileSync(join(project, "build", "symbols", "counter.json"), "utf8")) as { symbols: Array<{ name: string }> };
  assert.equal(file.symbols.length, symbols.count);
  assert.equal(file.symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), undefined, "the file has no unused constant without --all-symbols");
  assert.match(String(envelope.hint), /symbols is cut\. To get all symbols, give a larger --max-listed, or read build\/symbols\/counter\.json\./);
  assert.equal((json.symbolsFile as { out: string }).out, "build/symbols/counter.json");
  assert.ok(!existsSync(join(project, "build", "counter.json")), "no symbols file beside the program");
});

test("without --out, the name of the build tells what it is: the switch values of config.asm, and the entry", { skip: acmeSkip }, async () => {
  const source = join(project, "named");
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, "main.asm"), "* = $0801\n        rts\n");
  writeFileSync(join(source, "loader.asm"), "* = $0801\n        nop\n        rts\n");
  const out = async (...args: string[]) => {
    const { status, json } = await assembleScript("build", "named", ...args);
    assert.equal(status, 0, JSON.stringify(json));
    return [json.out, (json.symbolsFile as { out: string }).out];
  };
  // No config.asm: the name of the entry.
  assert.deepEqual(await out("main.asm"), ["build/main.prg", "build/symbols/main.json"]);
  // Each switch at its default: the clean program. The start screen is on by default, the leftovers are off.
  writeFileSync(join(source, "config.asm"), "START_SCREEN = 1\nLEFTOVERS = 0 ; off\n");
  assert.deepEqual(await out("main.asm"), ["build/clean.prg", "build/symbols/clean.json"]);
  assert.deepEqual(await out("loader.asm"), ["build/clean_loader.prg", "build/symbols/clean_loader.json"]);
  // A switch that is not its default names the build.
  writeFileSync(join(source, "config.asm"), "START_SCREEN = 0\nLEFTOVERS = 1\nTRAINER = 1\n");
  assert.deepEqual(await out("loader.asm"), ["build/custom_no_start_screen_leftovers_trainer_loader.prg", "build/symbols/custom_no_start_screen_leftovers_trainer_loader.json"]);
  assert.deepEqual(await out("main.asm", "--plain"), ["build/custom_no_start_screen_leftovers_trainer.bin", "build/symbols/custom_no_start_screen_leftovers_trainer.json"]);
});

test("--all-symbols lists the unused constants, and --plain writes the bytes without the load address", { skip: acmeSkip }, async () => {
  const { status, json } = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/counter.bin", "--plain", "--all-symbols");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.plain, true);
  assert.equal(json.unusedConstants, undefined);
  const symbols = (json.symbols as { listed: Array<Record<string, unknown>> }).listed;
  assert.deepEqual(symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), { name: "UNUSED_CONSTANT", kind: "constant", value: "$0063", used: false });
  const plain = readFileSync(join(project, "build", "counter.bin"));
  assert.deepEqual(plain, readFileSync(join(project, "build", "counter.prg")).subarray(2));
  assert.equal(plain.length, (json.loadRange as { bytes: number }).bytes);
});

test("source errors are a FAIL with the diagnostics and write no program", { skip: acmeSkip }, async () => {
  writeFileSync(join(project, "src", "broken.a"), "* = $c000\n  lda #$123\n");
  const { status, json, envelope } = await assembleScript("build", "src", "broken.a", "--out", "build/broken.prg");
  assert.equal(status, 0, "a source with errors is a FAIL verdict, not an error");
  assert.match(String(envelope.hint), /Correct the source at the file and the line of each diagnostic/);
  assert.equal(json.result, "FAIL");
  assert.equal(json.assembled, false);
  assert.equal((json.diagnostics as Array<{ line: number }>)[0]?.line, 2);
  assert.equal(existsSync(join(project, "build", "broken.prg")), false);
});

test("bad options are refused before anything is sent", { skip: acmeSkip }, async () => {
  for (const args of [
    ["build", "src", "main.a", "--out", "../escape.prg"],
    ["build", "src", "main.a", "--out", "x.prg", "--define", "X=abc"],
    ["build", "src", "main.a", "--out", "x.prg", "--set-pc", "2049"],
    ["build", "src", "main.a", "--out", "x.prg", "--space", "drive8"],
  ]) {
    const { status, json } = await assembleScript(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
  }
  for (const folder of ["nolib", "../nolib", "main.a"]) {
    const missing = await assembleScript("build", "src", "main.a", "--include", folder, "--out", "build/none.prg");
    assert.equal(missing.status, 2, folder);
    assert.deepEqual(missing.json.error, { code: "not-found", message: `There is no include folder ${folder} with files in the project folder. Give an include folder relative to the source root, inside the project folder.` });
  }
  for (const folder of ["../..", "/usr/share"]) {
    const outside = await assembleScript("build", "src", "main.a", "--include", folder, "--out", "build/none.prg");
    assert.equal(outside.status, 2, folder);
    assert.deepEqual(outside.json.error, { code: "invalid-input", message: `The include folder ${folder} is outside the project folder. Give an include folder relative to the source root, inside the project folder.` });
  }
  assert.equal(existsSync(join(project, "build", "none.prg")), false);
});

test("an include folder beside the source root holds generated source: build src boot.asm --include ../build", { skip: acmeSkip }, async () => {
  mkdirSync(join(project, "build"), { recursive: true });
  writeFileSync(join(project, "src", "boot.asm"), "!source \"consts.a\"\n* = $c000\n!source \"tables.asm\"\n        lda #MAX\n        rts\n");
  writeFileSync(join(project, "build", "tables.asm"), "        lda #$12\n");
  const { status, json } = await assembleScript("build", "src", "boot.asm", "--include", "../build", "--include", "lib", "--out", "build/boot.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.deepEqual([...readFileSync(join(project, "build", "boot.prg"))], [0x00, 0xc0, 0xa9, 0x12, 0xa9, 0x0a, 0x60]);
  writeFileSync(join(project, "build", "tables.asm"), "        lda #$123\n");
  const failed = await assembleScript("build", "src", "boot.asm", "--include", "../build", "--include", "lib", "--out", "build/boot.prg");
  assert.equal(failed.json.result, "FAIL");
  assert.deepEqual((failed.json.diagnostics as Array<{ file: string; line: number }>).map(({ file, line }) => ({ file, line })), [{ file: "../build/tables.asm", line: 1 }]);
});

test("a missing ACME is refused with the stop instruction", async () => {
  const child = spawn(process.execPath, [...process.execArgv, script, "build", "src", "main.a", "--include", "lib", "--out", "build/none.prg"], { cwd: project, env: { ...process.env, C64RT_ACME: join(project, "no-acme") }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const { error } = readEnvelope(stdout, status).json as { error: { code: string; message: string } };
  assert.equal(status, 2);
  assert.equal(error.code, "installation-incomplete");
  assert.ok(error.message.endsWith(STOP_AND_ASK), error.message);
});

test("--compare checks the build against the program in the knowledge and fails on a difference", { skip: acmeSkip }, async () => {
  const first = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/reference.prg");
  assert.equal(first.status, 0, JSON.stringify(first.json));
  const refused = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(refused.status, 2, "no program in the knowledge yet");
  assert.equal((refused.json.error as { code: string }).code, "not-found");
  assert.match((refused.json.error as { message: string }).message, /no program/);
  const release = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--release", "NONE");
  assert.deepEqual(release.json.error, { code: "not-found", message: "There is no release NONE in the knowledge. Record the release in the project knowledge first, or give the label of a recorded release." });
  importPrg(project, readFileSync(join(project, "build", "reference.prg")));
  const same = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(same.status, 0, JSON.stringify(same.json));
  assert.equal((same.json.compare as { identical: boolean }).identical, true);
  const changed = readFileSync(join(project, "build", "reference.prg"));
  changed[10] = changed[10]! ^ 0xff;
  importPrg(project, changed);
  const different = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(different.status, 0, "a build that differs is a failed check, not an error");
  assert.equal(different.json.result, "FAIL");
  assert.match(String(different.envelope.hint), /^The program is not identical to the reference program\. Read compare\.segments/);
  const [segment] = (different.json.compare as { segments: Array<{ result: string; firstDifference: { address: string } }> }).segments;
  assert.equal(segment!.result, "different");
  assert.equal(segment!.firstDifference.address, "$0809");
  assert.match(JSON.stringify(segment!.firstDifference), /^\{"address":"\$0809","built":"\$[0-9a-f]{2}","reference":"\$[0-9a-f]{2}"\}$/);
});
