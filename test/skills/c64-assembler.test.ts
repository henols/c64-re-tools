// The c64-assembler script with real ACME, which it runs itself.
// Skipped (never passed) when ACME is not installed.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COPIER_LINE } from "../../src/build-name.ts";
import { COVERAGE } from "../../src/c64.ts";
import { withRead, withWrite } from "../../src/knowledge/database.ts";
import { setImage, startScreenKey } from "../../src/knowledge/program.ts";
import { currentStartScreen, type StartScreenRow } from "../../src/knowledge/read.ts";
import { START_SCREEN_FILE, startScreenPlan } from "../../src/knowledge/start-screen.ts";
import { setStartScreen } from "../../src/knowledge/write.ts";
import { packLoader, settingsLines } from "../../src/loader.ts";
import { assemble } from "../../src/native/acme.ts";
import { ACME, EXOMIZER, findTool } from "../../src/native/discover.ts";
import { localToolContext } from "../../src/native/local.ts";
import { packStage, planStage, STAGE_FILE } from "../../src/stage.ts";
import { START_SCREEN_CODE } from "../../skills/c64-source/scripts/lib/loader.ts";
import { readEnvelope, seededBytes, type ScriptEnvelope } from "../kit.ts";
import { importPrg } from "../fixtures/program.ts";

let acmeSkip: string | false = false;
try {
  findTool(ACME);
} catch {
  acmeSkip = "ACME is not installed: install acme or set C64RT_ACME to run these tests";
}
let exomizerSkip: string | false = acmeSkip;
try {
  findTool(EXOMIZER);
} catch {
  exomizerSkip ||= "Exomizer is not installed: install exomizer or set C64RT_EXOMIZER to run these tests";
}

const script = resolve(import.meta.dirname, "../../skills/c64-assembler/scripts/assembler.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-assembler-"));
cpSync(resolve(import.meta.dirname, "../fixtures/asm/counter"), join(project, "src"), { recursive: true });
/** More project folders of the tests, removed at the end. */
const projects: string[] = [];
after(() => {
  for (const folder of [project, ...projects]) rmSync(folder, { recursive: true, force: true });
});

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

test("the script writes the program into the project and reports symbols, and the symbols file in symbols/ has the whole list, without the unused constants", { skip: acmeSkip }, async () => {
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
  assert.equal((json.symbolsFile as { out: string }).out, "build/symbols/counter.json");
  const file = JSON.parse(readFileSync(join(project, "build", "symbols", "counter.json"), "utf8")) as { symbols: Array<{ name: string }> };
  assert.equal(file.symbols.length, count);
  assert.equal(file.symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), undefined, "the file has no unused constant without --all-symbols");
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
  // Each switch at its default: the clean program. The start screen is on by default, the leftovers are off. An entry other than main.asm adds its name.
  writeFileSync(join(source, "config.asm"), "START_SCREEN = 1\nLEFTOVERS = 0 ; off\n");
  assert.deepEqual(await out("loader.asm"), ["build/clean_loader.prg", "build/symbols/clean_loader.json"]);
  // The loader.asm of the packed form is only the copier: its build does not write over the loader program of generate.
  writeFileSync(join(source, "loader.asm"), `${COPIER_LINE}\n* = $0801\n        rts\n`);
  assert.deepEqual(await out("loader.asm"), ["build/clean_copier.prg", "build/symbols/clean_copier.json"]);
  // A switch that is not its default names the build.
  writeFileSync(join(source, "config.asm"), "START_SCREEN = 0\nLEFTOVERS = 1\nTRAINER = 1\n");
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

test("a bad --define and --space without --compare are refused before ACME runs", { skip: acmeSkip }, async () => {
  for (const args of [
    ["build", "src", "main.a", "--out", "build/none.prg", "--define", "X=abc"],
    ["build", "src", "main.a", "--out", "build/none.prg", "--space", "drive8"],
  ]) {
    const { status, json } = await assembleScript(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal((json.error as { code: string }).code, "invalid-input");
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
});

test("--compare checks the build against the program in the knowledge and fails on a difference", { skip: acmeSkip }, async () => {
  const release = await assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--release", "NONE");
  assert.deepEqual(release.json.error, { code: "not-found", message: "There is no release NONE in the knowledge. Record the release in the project knowledge first, or give the label of a recorded release." });
  // The reference is the program of the first test with one byte changed.
  const changed = readFileSync(join(project, "build", "counter.prg"));
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

test("--compare names each different byte in a leftover that the build leaves out with LEFTOVERS = 0", { skip: acmeSkip }, () => {
  const folder = mkdtempSync(join(tmpdir(), "c64-re-tools-assembler-leftovers-"));
  projects.push(folder);
  mkdirSync(join(folder, "src", "leftovers"), { recursive: true });
  writeFileSync(join(folder, "src", "config.asm"), "LEFTOVERS = 0\n");
  writeFileSync(join(folder, "src", "main.asm"), '!source "config.asm"\n* = $1000\n        lda #$01\n!if LEFTOVERS { !source "leftovers/leftover_1002.asm" } else { !skip 2 }\n        rts\n');
  writeFileSync(join(folder, "src", "leftovers", "leftover_1002.asm"), "; Leftovers $1002-$1003: 2 bytes that nothing uses.\n        !byte $0c,$0d\n");
  importPrg(folder, Buffer.from([0x00, 0x10, 0xa9, 0x01, 0x0c, 0x0d, 0x60]));
  const leftovers = [{ start: "$1002", end: "$1003", file: "leftovers/leftover_1002.asm", differences: 2 }];
  const clean = buildIn(folder, ["src", "main.asm", "--compare"]);
  assert.equal(clean.json.result, "FAIL");
  assert.deepEqual(clean.json.compare.segments, [{ start: "$1000", end: "$1004", result: "different", differences: 2, leftovers }]);
  assert.match(String(clean.envelope.hint), /^The program is different from the reference program only in the leftovers that this build leaves out\. All other bytes are identical\. 2 different bytes are in leftovers .* give --switch LEFTOVERS=1\./);
  assert.equal(buildIn(folder, ["src", "main.asm", "--compare", "--switch", "LEFTOVERS=1"]).json.result, "PASS");
});

/**
 * A captured program whose loader has the packed form: 40 parts, more copies than the plain copier does.
 * $1000 LDA #$00 / STA $d020 / RTS with the patch of TRAINER at $1000-$1001, 80 bytes at $1010 that nothing uses (a leftover),
 * and 39 parts of 4 bytes from $2000. Generate writes the source and loader.asm; its check of the loader does not run here.
 */
function packedProject(): { project: string; segments: Array<{ start: number; end: number }>; leftovers: Array<{ start: string; end: string }> } {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-assembler-switch-"));
  projects.push(root);
  const memory = new Uint8Array(0x10000);
  memory.set([0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60], 0x1000);
  memory.set(seededBytes(1, 80), 0x1010);
  const segments = [{ start: 0x1000, end: 0x105f }, ...Array.from({ length: 39 }, (_, index) => ({ start: 0x2000 + index * 16, end: 0x2003 + index * 16 }))];
  for (const segment of segments.slice(1)) memory.set(seededBytes(segment.start, 4), segment.start);
  const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  mkdirSync(join(root, "unpacked"));
  writeFileSync(join(root, "unpacked", "image.bin"), memory);
  writeFileSync(join(root, "unpacked", "image.json"), JSON.stringify({ entry: "$1000", image: "image.bin", segments: segments.map((segment) => ({ start: hex(segment.start), end: hex(segment.end) })) }));
  writeFileSync(
    join(root, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: "$1000", a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: Object.fromEntries([0, 1, 2, 3].map((page) => [hex(page << 8), "00".repeat(256)])),
    }),
  );
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x1000, 0x1002, 0x1005]) coverage[address] = COVERAGE.ramExecute;
  writeFileSync(join(root, "run.bin"), coverage);
  writeFileSync(join(root, "batch.json"), JSON.stringify([{ op: "classify", start: "$1010", end: "$105f", type: "bytes" }, { op: "patch", start: "$1000", end: "$1001", switch: "TRAINER", code: "        lda #1" }]));
  const knowledge = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
  for (const args of [["image", "unpacked/image.json"], ["coverage", "run.bin"], ["release", "BASE", "--file", "unpacked/image.json", "--base"], ["switch", "TRAINER", "--kind", "trainer"], ["apply", "batch.json"]]) {
    const run = spawnSync(process.execPath, [...process.execArgv, knowledge, ...args], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, `${args.join(" ")}: ${run.stdout}`);
  }
  const generate = spawnSync(process.execPath, [...process.execArgv, resolve(import.meta.dirname, "../../skills/c64-source/scripts/source.ts"), "generate", "--out", "src", "--loader"], { cwd: root, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" }, encoding: "utf8" });
  const json = readEnvelope(generate.stdout, generate.status).json as { check: { identical: boolean }; leftovers: { listed: Array<{ start: string; end: string }> }; loader: { verified: boolean; reason: string } };
  assert.equal(json.check.identical, true, generate.stdout);
  assert.match(json.loader.reason, /^The check of clean_loader\.prg did not run/, "the loader was packed, and only its check needs the host");
  assert.ok(readFileSync(join(root, "src", "loader.asm"), "utf8").split("\n").includes(COPIER_LINE), "the packed form");
  return { project: root, segments, leftovers: json.leftovers.listed };
}

/** Runs the script in another project folder. */
function buildIn(folder: string, args: string[], env: NodeJS.ProcessEnv = {}): { status: number | null; json: any; envelope: ScriptEnvelope } {
  const run = spawnSync(process.execPath, [...process.execArgv, script, "build", ...args], { cwd: folder, env: { ...process.env, C64RT_HOST: "127.0.0.1:1", ...env }, encoding: "utf8" });
  return { status: run.status, ...readEnvelope(run.stdout, run.status) };
}

test("--switch builds other switch values and leaves config.asm as it is; with the packed form it also packs the loader program of these values, and wraps it in the show stage of a start screen of a captured stage, as generate does", { skip: exomizerSkip, timeout: 600_000 }, async () => {
  const { project: folder, segments, leftovers } = packedProject();
  const config = readFileSync(join(folder, "src", "config.asm"), "utf8");
  // The pack of generate at the defaults: the loaded ranges are the segments without the leftover, and loader.asm names the copier.
  assert.deepEqual(leftovers.map(({ start, end }) => [start, end]), [["$1010", "$105f"]]);
  const loaded = [{ start: 0x1000, end: 0x100f }, ...segments.slice(1)];
  const copier = Number.parseInt(/--entry '\$([0-9a-f]{4})'/.exec(readFileSync(join(folder, "src", "loader.asm"), "utf8"))![1]!, 16);
  assert.equal(buildIn(folder, ["src", "main.asm"]).status, 0);
  assert.equal(buildIn(folder, ["src", "loader.asm"]).json.out, "build/clean_copier.prg");
  const reference = await packLoader(readFileSync(join(folder, "build", "clean.prg")), readFileSync(join(folder, "build", "clean_copier.prg")), { loaded, copier }, localToolContext());

  const clean = buildIn(folder, ["src", "main.asm", "--switch", "TRAINER=0"]);
  assert.equal(clean.status, 0, JSON.stringify(clean.json));
  assert.equal(clean.json.out, "build/clean.prg");
  assert.deepEqual([clean.json.loader.out, clean.json.loader.symbolsFile.out, clean.json.loader.verified], ["build/clean_loader.prg", "build/symbols/clean_loader.json", false]);
  assert.deepEqual(readFileSync(join(folder, "build", "clean_loader.prg")), reference.program, "the same packed program as generate --loader");
  assert.deepEqual(clean.json.loader.packed, { packedBytes: reference.packedBytes, unpackedBytes: reference.unpackedBytes });

  const trainer = buildIn(folder, ["src", "main.asm", "--switch", "TRAINER=1"]);
  assert.equal(trainer.status, 0, JSON.stringify(trainer.json));
  assert.deepEqual([trainer.json.out, trainer.json.loader.out], ["build/custom_trainer.prg", "build/custom_trainer_loader.prg"]);
  assert.equal(readFileSync(join(folder, "build", "custom_trainer.prg"))[2 + 1], 0x01, "the patch of TRAINER is in");
  assert.ok(existsSync(join(folder, "build", "symbols", "custom_trainer_loader.json")));
  assert.equal(readFileSync(join(folder, "src", "config.asm"), "utf8"), config, "config.asm stays as it is");

  // Refused: with --release, a name that config.asm does not have, and the packed form without Exomizer (nothing is written).
  for (const [args, env, pattern] of [
    [["--switch", "TRAINER=1", "--release", "BASE"], {}, /^--switch does not work with --release/],
    [["--switch", "TRAINERS=1"], {}, /^TRAINERS is not a switch of config\.asm\. Give a switch of config\.asm: TRAINER, LEFTOVERS\./],
    [["--switch", "LEFTOVERS=1"], { C64RT_EXOMIZER: join(folder, "no-exomizer") }, /^C64RT_EXOMIZER .*does not name an executable Exomizer file/],
  ] as Array<[string[], NodeJS.ProcessEnv, RegExp]>) {
    const refused = buildIn(folder, ["src", "main.asm", ...args], env);
    assert.equal(refused.status, 2, args.join(" "));
    assert.match(refused.json.error.message, pattern);
  }
  assert.equal(existsSync(join(folder, "build", "custom_leftovers.prg")), false);

  // A start screen of a captured stage: the show stage wraps the packed loader, with the bytes of the stage from start_screen_stage.asm.
  const row: StartScreenRow = { space: "c64", mode: "text", screen: 0x0400, charset: 0x1000, colour: 1, border: 0, background: 0, stage: "loading", origin: "llm", revision: "r" };
  const screen = [{ start: 0x0400, body: new Uint8Array(1000).fill(0x20) }];
  withWrite((db) => {
    setImage(db, { origin: "llm" }, { space: "loading", segments: [{ start: 0x0400, end: 0x07e7 }], byteAt: () => 0x20 });
    setStartScreen(db, { origin: "llm" }, { mode: row.mode, screen: row.screen, charset: row.charset!, colour: row.colour!, border: row.border, background: row.background, stage: "loading" });
  }, folder);
  rmSync(join(folder, "build", "custom_trainer.prg"));
  const unstaged = buildIn(folder, ["src", "main.asm", "--switch", "TRAINER=1"]);
  assert.equal(unstaged.status, 0, JSON.stringify(unstaged.json));
  assert.ok(existsSync(join(folder, "build", "custom_trainer.prg")), "without start_screen_stage.asm, the build writes main.asm and tells why it wrote no loader");
  assert.deepEqual(Object.keys(unstaged.json.loader), ["written", "reason"]);
  assert.match(unstaged.json.loader.reason, /^The start screen is of the captured stage loading, and src has no start_screen_stage\.asm with its bytes\./);

  // generate writes the files of the show stage only with a checked loader: here they come from a plan of the stage.
  const sourceFiles = () => ["config.asm", "switches.asm", "loader.asm", START_SCREEN_FILE, STAGE_FILE].filter((name) => existsSync(join(folder, "src", name))).map((name) => ({ name, text: readFileSync(join(folder, "src", name), "utf8") }));
  const settings = settingsLines({ switches: existsSync(join(folder, "src", "switches.asm")), config: true });
  const key = withRead((db) => startScreenKey(db, currentStartScreen(db)!), folder);
  const stageFile = (fileKey: string) => writeFileSync(join(folder, "src", STAGE_FILE), planStage({ inner: [], innerStart: 0x080d, innerPort: 0x37, stage: screen, row, plan: startScreenPlan(row), settings, header: [], key: fileKey, codeSize: 300 }).text);
  writeFileSync(join(folder, "src", START_SCREEN_FILE), START_SCREEN_CODE);
  // A file of another start screen, or of an earlier state of the stage, has another key: its bytes are not of this start screen.
  stageFile("0123456789abcdef");
  const old = buildIn(folder, ["src", "main.asm", "--switch", "TRAINER=1"]);
  assert.deepEqual(Object.keys(old.json.loader), ["written", "reason"]);
  assert.match(old.json.loader.reason, /^start_screen_stage\.asm of src is not of the start screen of the knowledge now: .* Generate the source with the loader again\.$/);
  stageFile(key);
  const before = sourceFiles();
  const staged = buildIn(folder, ["src", "main.asm", "--switch", "TRAINER=0"]);
  assert.equal(staged.status, 0, JSON.stringify(staged.json));
  assert.deepEqual([staged.json.loader.out, staged.json.loader.stage?.space, staged.json.loader.verified], ["build/clean_loader.prg", "loading", false]);
  assert.deepEqual(staged.json.loader.packed, { packedBytes: reference.packedBytes, unpackedBytes: reference.unpackedBytes }, "the packed loader of these switch values is in the show stage");
  // The show stage of generate around the same packed loader: planned again, and packed with the bytes of the stage.
  const assembleStage = async (text: string) => {
    const files = [...before.filter((file) => file.name !== STAGE_FILE && file.name !== "loader.asm"), { name: STAGE_FILE, text }];
    const contents = files.map((file) => Buffer.from(file.text));
    const { result, attachments } = await assemble({ files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: STAGE_FILE, includeDirs: [], defines: {} }, contents, localToolContext());
    assert.equal(result.assembled, true, result.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
    return { program: attachments![0]!, symbols: result.symbols ?? [] };
  };
  const shown = await packStage(reference.program, { parts: screen }, row, { settings, header: [], key }, assembleStage, localToolContext());
  assert.deepEqual(readFileSync(join(folder, "build", "clean_loader.prg")), shown.packed.program);
  const names = (JSON.parse(readFileSync(join(folder, "build", "symbols", "clean_loader.json"), "utf8")) as { symbols: Array<{ name: string }> }).symbols.map((symbol) => symbol.name);
  for (const name of ["c64_source_stage", "loader_start_screen_wait", "loader_start_screen_continue", "loader_copier_src"]) assert.ok(names.includes(name), name);
  assert.deepEqual(sourceFiles(), before, "the source stays as it is");
});
