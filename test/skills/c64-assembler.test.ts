// The c64-assembler script with real ACME, which it runs itself.
// Skipped (never passed) when ACME is not installed.

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { COPIER_LINE } from "../../src/build-name.ts";
import { COVERAGE } from "../../src/c64.ts";
import { withWrite } from "../../src/knowledge/database.ts";
import { setImage } from "../../src/knowledge/program.ts";
import { applyBatch, setRelease, setStartScreen, setSwitch } from "../../src/knowledge/write.ts";
import { packLoader } from "../../src/loader.ts";
import { ACME, EXOMIZER } from "../../src/native/discover.ts";
import { localToolContext } from "../../src/native/local.ts";
import { runScriptSync, scratchDir, seededBytes, skillScript, toolSkip, type ScriptRun } from "../kit.ts";
import { importCoverage, importPrg } from "../fixtures/program.ts";
import { capturedProject, writeKnowledge } from "./source-kit.ts";

const acmeSkip = toolSkip(ACME);
const exomizerSkip = toolSkip(ACME, EXOMIZER);

const script = skillScript("c64-assembler", "assembler.ts");
const project = scratchDir("assembler");
cpSync(resolve(import.meta.dirname, "../fixtures/asm/counter"), join(project, "src"), { recursive: true });

/** Runs the script in the project folder. */
const assembleScript = (...args: string[]): ScriptRun => runScriptSync(script, args, { cwd: project });

test("the script writes the program into the project and reports symbols, and the symbols file in symbols/ has the whole list, without the unused constants", { skip: acmeSkip }, () => {
  const { status, json } = assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/counter.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal(json.assembled, true);
  assert.equal(json.out, "build/counter.prg");
  assert.match(String(json.sha256), /^[0-9a-f]{64}$/);
  assert.deepEqual(json.loadRange.start, "$0801");
  const program = readFileSync(join(project, "build", "counter.prg"));
  assert.equal(program.readUInt16LE(0), 0x0801);
  const { count, listed: symbols }: { count: number; listed: Array<Record<string, unknown>> } = json.symbols;
  assert.equal(count, symbols.length);
  assert.deepEqual(symbols.find((symbol) => symbol.name === "start"), { name: "start", kind: "address", address: "$080d", used: false });
  assert.deepEqual(symbols.find((symbol) => symbol.name === "MAX"), { name: "MAX", kind: "constant", value: "$000a", used: true });
  assert.equal(symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), undefined, "an unused constant is left out");
  assert.equal(json.unusedConstants, 1);
  assert.equal(json.symbolsFile.out, "build/symbols/counter.json");
  const file = JSON.parse(readFileSync(join(project, "build", "symbols", "counter.json"), "utf8")) as { symbols: Array<{ name: string }> };
  assert.equal(file.symbols.length, count);
  assert.equal(file.symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), undefined, "the file has no unused constant without --all-symbols");
  assert.ok(!existsSync(join(project, "build", "counter.json")), "no symbols file beside the program");
});

test("without --out, the name of the build tells what it is: the switch values of config.asm, and the entry", { skip: acmeSkip }, () => {
  const source = join(project, "named");
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, "main.asm"), "* = $0801\n        rts\n");
  writeFileSync(join(source, "loader.asm"), "* = $0801\n        nop\n        rts\n");
  const out = (...args: string[]) => {
    const { status, json } = assembleScript("build", "named", ...args);
    assert.equal(status, 0, JSON.stringify(json));
    return [json.out, json.symbolsFile.out];
  };
  // No config.asm: the name of the entry.
  assert.deepEqual(out("main.asm"), ["build/main.prg", "build/symbols/main.json"]);
  // Each switch at its default: the clean program. The start screen is on by default, the leftovers are off. An entry other than main.asm adds its name.
  writeFileSync(join(source, "config.asm"), "START_SCREEN = 1\nLEFTOVERS = 0 ; off\n");
  assert.deepEqual(out("loader.asm"), ["build/clean_loader.prg", "build/symbols/clean_loader.json"]);
  // The loader.asm of the packed form is only the copier: its build does not write over the loader program of generate.
  writeFileSync(join(source, "loader.asm"), `${COPIER_LINE}\n* = $0801\n        rts\n`);
  assert.deepEqual(out("loader.asm"), ["build/clean_copier.prg", "build/symbols/clean_copier.json"]);
  // A switch that is not its default names the build.
  writeFileSync(join(source, "config.asm"), "START_SCREEN = 0\nLEFTOVERS = 1\nTRAINER = 1\n");
  assert.deepEqual(out("main.asm", "--plain"), ["build/custom_no_start_screen_leftovers_trainer.bin", "build/symbols/custom_no_start_screen_leftovers_trainer.json"]);
});

test("--all-symbols lists the unused constants, and --plain writes the bytes without the load address", { skip: acmeSkip }, () => {
  const { status, json } = assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/counter.bin", "--plain", "--all-symbols");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.plain, true);
  assert.equal(json.unusedConstants, undefined);
  const symbols: Array<Record<string, unknown>> = json.symbols.listed;
  assert.deepEqual(symbols.find((symbol) => symbol.name === "UNUSED_CONSTANT"), { name: "UNUSED_CONSTANT", kind: "constant", value: "$0063", used: false });
  const plain = readFileSync(join(project, "build", "counter.bin"));
  assert.deepEqual(plain, readFileSync(join(project, "build", "counter.prg")).subarray(2));
  assert.equal(plain.length, json.loadRange.bytes);
});

test("source errors are a FAIL with the diagnostics and write no program", { skip: acmeSkip }, () => {
  writeFileSync(join(project, "src", "broken.a"), "* = $c000\n  lda #$123\n");
  const { status, json, envelope } = assembleScript("build", "src", "broken.a", "--out", "build/broken.prg");
  assert.equal(status, 0, "a source with errors is a FAIL verdict, not an error");
  assert.match(String(envelope.hint), /Correct the source at the file and the line of each diagnostic/);
  assert.equal(json.result, "FAIL");
  assert.equal(json.assembled, false);
  assert.equal(json.diagnostics[0]?.line, 2);
  assert.equal(existsSync(join(project, "build", "broken.prg")), false);
});

test("a bad --define and --space without --compare are refused before ACME runs", { skip: acmeSkip }, () => {
  for (const args of [
    ["build", "src", "main.a", "--out", "build/none.prg", "--define", "X=abc"],
    ["build", "src", "main.a", "--out", "build/none.prg", "--space", "drive8"],
  ]) {
    const { status, json } = assembleScript(...args);
    assert.equal(status, 2, args.join(" "));
    assert.equal(json.error.code, "invalid-input");
  }
  assert.equal(existsSync(join(project, "build", "none.prg")), false);
});

test("an include folder beside the source root holds generated source: build src boot.asm --include ../build", { skip: acmeSkip }, () => {
  mkdirSync(join(project, "build"), { recursive: true });
  writeFileSync(join(project, "src", "boot.asm"), "!source \"consts.a\"\n* = $c000\n!source \"tables.asm\"\n        lda #MAX\n        rts\n");
  writeFileSync(join(project, "build", "tables.asm"), "        lda #$12\n");
  const { status, json } = assembleScript("build", "src", "boot.asm", "--include", "../build", "--include", "lib", "--out", "build/boot.prg");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.deepEqual([...readFileSync(join(project, "build", "boot.prg"))], [0x00, 0xc0, 0xa9, 0x12, 0xa9, 0x0a, 0x60]);
});

test("--compare checks the build against the program in the knowledge and fails on a difference", { skip: acmeSkip }, () => {
  const release = assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--release", "NONE");
  assert.deepEqual(release.json.error, { code: "not-found", message: "There is no release NONE in the knowledge. Record the release in the project knowledge first, or give the label of a recorded release." });
  // The reference is the program of the first test with one byte changed.
  const changed = readFileSync(join(project, "build", "counter.prg"));
  changed[10] = changed[10]! ^ 0xff;
  importPrg(project, changed);
  const different = assembleScript("build", "src", "main.a", "--include", "lib", "--out", "build/again.prg", "--compare");
  assert.equal(different.status, 0, "a build that differs is a failed check, not an error");
  assert.equal(different.json.result, "FAIL");
  assert.match(String(different.envelope.hint), /^The program is not identical to the reference program\. Read compare\.segments/);
  const [segment] = different.json.compare.segments;
  assert.equal(segment!.result, "different");
  assert.equal(segment!.firstDifference.address, "$0809");
  assert.match(JSON.stringify(segment!.firstDifference), /^\{"address":"\$0809","built":"\$[0-9a-f]{2}","reference":"\$[0-9a-f]{2}"\}$/);
});

test("--compare names each different byte in a leftover that the build leaves out with LEFTOVERS = 0", { skip: acmeSkip }, () => {
  const folder = scratchDir("assembler-leftovers");
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
  const code = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60, ...new Array<number>(10).fill(0), ...seededBytes(1, 80)];
  const parts = [{ start: 0x1000, bytes: code }, ...Array.from({ length: 39 }, (_, index) => ({ start: 0x2000 + index * 16, bytes: seededBytes(0x2000 + index * 16, 4) }))];
  const { project: root, generate } = capturedProject(0x1000, parts);
  const coverage = new Uint8Array(0x10000);
  for (const address of [0x1000, 0x1002, 0x1005]) coverage[address] = COVERAGE.ramExecute;
  importCoverage(root, { "run.bin": coverage });
  writeKnowledge(root, (db, context) => {
    setRelease(db, context, { label: "BASE", base: true });
    setSwitch(db, context, { name: "TRAINER", kind: "trainer" });
    applyBatch(db, context, [{ op: "classify", start: 0x1010, end: 0x105f, type: "bytes" }, { op: "patch", start: 0x1000, end: 0x1001, switch: "TRAINER", code: "        lda #1" }]);
  });
  const { stdout, json } = generate("--loader");
  assert.equal(json.check.identical, true, stdout);
  assert.match(json.loader.reason, /^The check of clean_loader\.prg did not run/, "the loader was packed, and only its check needs the host");
  assert.ok(readFileSync(join(root, "src", "loader.asm"), "utf8").split("\n").includes(COPIER_LINE), "the packed form");
  return { project: root, segments: parts.map(({ start, bytes }) => ({ start, end: start + bytes.length - 1 })), leftovers: json.leftovers.listed };
}

/** Runs the script in another project folder. */
function buildIn(folder: string, args: string[], env: NodeJS.ProcessEnv = {}): ScriptRun {
  return runScriptSync(script, ["build", ...args], { cwd: folder, env });
}

test("--switch builds other switch values and leaves config.asm as it is; with the packed form it also packs the loader program of these values, as generate packs it", { skip: exomizerSkip, timeout: 600_000 }, async () => {
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

  // A start screen of a captured stage: only generate makes that loader program, so the build writes main.asm and tells why it wrote no loader.
  withWrite((db) => {
    setImage(db, { origin: "llm" }, { space: "loading", segments: [{ start: 0x0400, end: 0x07e7 }], byteAt: () => 0x20 });
    setStartScreen(db, { origin: "llm" }, { mode: "text", screen: 0x0400, charset: 0x1000, colour: 1, border: 0, background: 0, stage: "loading" });
  }, folder);
  rmSync(join(folder, "build", "custom_trainer.prg"));
  const staged = buildIn(folder, ["src", "main.asm", "--switch", "TRAINER=1"]);
  assert.equal(staged.status, 0, JSON.stringify(staged.json));
  assert.ok(existsSync(join(folder, "build", "custom_trainer.prg")));
  assert.deepEqual(Object.keys(staged.json.loader), ["written", "reason"]);
  assert.equal(staged.json.loader.written, false);
  assert.match(staged.json.loader.reason, /captured stage loading/);
});
