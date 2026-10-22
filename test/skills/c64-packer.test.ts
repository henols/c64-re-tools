// The c64-packer script with a fake Exomizer: the pack call, the check of the
// unpacked bytes and the entry, and what the script writes. The fake "packs"
// the merged inputs as they are, and its desfx gives back the largest
// contiguous range, as the real one does. No Exomizer needed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

const script = resolve(import.meta.dirname, "../../skills/c64-packer/scripts/packer.ts");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-packer-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

// The fake: "sfx <entry> ... -o <out> <inputs>" writes a PRG at $0801 that holds
// the entry and the merged inputs; "desfx -o <out> <packed>" writes back the
// largest contiguous range of them and names the entry. FAKE_EXO_* change it.
const FAKE = `#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const argv = process.argv.slice(2);
if (process.env.FAKE_EXO_LOG) appendFileSync(process.env.FAKE_EXO_LOG, JSON.stringify(argv) + "\\n");
const out = argv[argv.indexOf("-o") + 1];
if (argv[0] === "sfx") {
  if (process.env.FAKE_EXO_FAIL) { console.error("Error: the data overlaps the decrunch table."); process.exit(1); }
  const entry = Number(argv[1]);
  const memory = new Uint8Array(65536);
  const loaded = new Uint8Array(65536);
  for (const file of argv.slice(argv.indexOf("-o") + 2).filter((arg) => !arg.startsWith("-"))) {
    const prg = readFileSync(file);
    const start = prg[0] | (prg[1] << 8);
    memory.set(prg.subarray(2), start);
    loaded.fill(1, start, start + prg.length - 2);
  }
  let best = [0, 0];
  for (let at = 0; at < 65536; ) {
    if (!loaded[at]) { at++; continue; }
    let end = at;
    while (end < 65536 && loaded[end]) end++;
    if (end - at > best[1] - best[0]) best = [at, end];
    at = end;
  }
  const body = memory.subarray(best[0], best[1]);
  writeFileSync(out, Buffer.concat([Buffer.from([0x01, 0x08, entry & 0xff, entry >> 8, best[0] & 0xff, best[0] >> 8]), body]));
  console.log(" Crunched data reduced 10 bytes (10.00%)");
} else if (argv[0] === "desfx") {
  const packed = readFileSync(argv.at(-1));
  let entry = packed[2] | (packed[3] << 8);
  if (process.env.FAKE_EXO_ENTRY) entry = Number.parseInt(process.env.FAKE_EXO_ENTRY, 16);
  const unpacked = Buffer.from(packed.subarray(4));
  if (process.env.FAKE_EXO_CORRUPT) unpacked[5] ^= 0xff;
  writeFileSync(out, unpacked);
  console.log(" Decrunch took 0.985248 Mcycles, speed was 1.00 kB/Mc (1.00 c/B).");
  console.log(\` Writing "\${out}" as prg, saving from $0000 to $0000, entry at $\${entry.toString(16).toUpperCase().padStart(4, "0")}.\`);
}
`;

function fakeExomizer(): string {
  const fake = join(scratch, "exomizer.ts");
  writeFileSync(fake, FAKE);
  chmodSync(fake, 0o755);
  // Windows starts no script by its shebang: a .cmd file runs it through Node.
  if (process.platform !== "win32") return fake;
  const program = join(scratch, "exomizer.cmd");
  writeFileSync(program, `@"${process.execPath}" "${fake}" %*\r\n`);
  return program;
}
const exomizer = fakeExomizer();

const prg = (start: number, bytes: number[]) => Buffer.from([start & 0xff, start >> 8, ...bytes]);
/** 10 SYS2061, then code at $080d. */
const BASIC = prg(0x0801, [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, 0xee, 0x20, 0xd0, 0x4c, 0x0d, 0x08]);

let projects = 0;
/** A project with these files in it. */
function project(files: Record<string, Buffer>): string {
  const root = join(scratch, `project-${++projects}`);
  mkdirSync(join(root, ".c64-re-tools"), { recursive: true });
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), bytes);
  }
  return root;
}

async function packer(root: string, args: string[], env: Record<string, string> = {}): Promise<{ status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope }> {
  const child = spawn(process.execPath, [...process.execArgv, script, "pack", ...args], {
    cwd: root,
    env: { ...process.env, C64RT_EXOMIZER: exomizer, C64RT_HOST: "127.0.0.1:1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  const { envelope, json } = readEnvelope(stdout, status);
  return { status, json: json as Record<string, unknown>, envelope };
}

test("a BASIC program is packed with its SYS address as the entry and checked", { timeout: 60_000 }, async () => {
  const root = project({ "build/game.prg": BASIC });
  const log = join(root, "argv.jsonl");
  const { status, json, envelope } = await packer(root, ["build/game.prg", "--out", "build/game-packed.prg"], { FAKE_EXO_LOG: log });
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal(envelope.hint, "Run build/game-packed.prg in the emulator with RUN. Make sure that the program starts and works.");
  assert.equal(json.out, "build/game-packed.prg");
  assert.equal(json.entry, "$080d");
  assert.equal(json.unpackedBytes, BASIC.length - 2);
  assert.equal(json.unpackSeconds, 1);
  assert.deepEqual(json.inputs, [{ file: "build/game.prg", loadRange: { start: "$0801", end: "$0812" }, bytes: 18 }]);
  assert.deepEqual(json.check, { entry: "$080d", identical: true, segments: [{ start: "$0801", end: "$0812", result: "identical" }] });
  assert.equal(readFileSync(join(root, "build", "game-packed.prg")).readUInt16LE(0), 0x0801);
  const [sfx, desfx] = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line) as string[]);
  assert.deepEqual(sfx!.slice(0, 4), ["sfx", String(0x080d), "-t64", "-n"]);
  assert.equal(desfx![0], "desfx");
});

test("several files go into one program in load order, with --entry and --exit-memory", { timeout: 60_000 }, async () => {
  const root = project({ "a.prg": prg(0x1000, [1, 2, 3, 4]), "b.prg": prg(0x1002, [9, 9, 5, 6]) });
  const log = join(root, "argv.jsonl");
  const { status, json } = await packer(root, ["a.prg", "b.prg", "--entry", "$1000", "--exit-memory", "$35", "--out", "packed.prg"], { FAKE_EXO_LOG: log });
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "PASS");
  assert.equal(json.exitMemory, "$35");
  assert.deepEqual((json.check as { segments: unknown[] }).segments, [{ start: "$1000", end: "$1005", result: "identical" }]);
  const [sfx] = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line) as string[]);
  assert.ok(sfx!.includes("-Di_ram_exit=53"), JSON.stringify(sfx));
  assert.deepEqual(sfx!.slice(-2).map((path) => path.replaceAll("\\", "/").split("/").at(-1)), ["0.prg", "1.prg"]);
});

test("a program that unpacks to other bytes or jumps elsewhere is FAIL and is not written", { timeout: 60_000 }, async () => {
  const root = project({ "game.prg": BASIC });
  const corrupt = await packer(root, ["game.prg", "--out", "packed.prg"], { FAKE_EXO_CORRUPT: "1" });
  assert.equal(corrupt.status, 0, JSON.stringify(corrupt.json));
  assert.equal(corrupt.json.result, "FAIL");
  assert.match(corrupt.envelope.hint!, /The script did not write it\. Do not use it\./);
  assert.equal(corrupt.json.out, undefined);
  assert.deepEqual((corrupt.json.check as { segments: unknown[] }).segments, [{ start: "$0801", end: "$0812", result: "different", differences: 1, firstDifference: { address: "$0804", built: "$ff", reference: "$00" } }]);
  const elsewhere = await packer(root, ["game.prg", "--out", "packed.prg"], { FAKE_EXO_ENTRY: "fce2" });
  assert.equal(elsewhere.status, 0, JSON.stringify(elsewhere.json));
  assert.equal(elsewhere.json.result, "FAIL");
  assert.equal((elsewhere.json.check as { entry: string }).entry, "$fce2");
  assert.equal(existsSync(join(root, "packed.prg")), false);
});

test("a check that does not hold all inputs is INCONCLUSIVE", { timeout: 60_000 }, async () => {
  const root = project({ "low.prg": prg(0x1000, [1, 2, 3, 4]), "high.prg": prg(0x8000, [5, 6]) });
  const { status, json, envelope } = await packer(root, ["low.prg", "high.prg", "--entry", "$1000", "--out", "packed.prg"]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "INCONCLUSIVE");
  assert.match(envelope.hint!, /^The check does not hold all bytes of the inputs\. Run packed\.prg in the emulator/);
  assert.deepEqual((json.check as { segments: unknown[] }).segments, [
    { start: "$1000", end: "$1003", result: "identical" },
    { start: "$8000", end: "$8001", result: "not covered", uncovered: 2 },
  ]);
});

test("wrong calls are refused before Exomizer runs: no SYS, an entry below $0400, the output as an input, a wrong --exit-memory", { timeout: 60_000 }, async () => {
  const root = project({ "code.prg": prg(0xc000, [0x60]) });
  const log = join(root, "argv.jsonl");
  const refused = async (args: string[], message: RegExp) => {
    const { status, json } = await packer(root, args, { FAKE_EXO_LOG: log });
    assert.equal(status, 2, JSON.stringify(json));
    const error = json.error as { code: string; message: string };
    assert.equal(error.code, "invalid-input");
    assert.match(error.message, message);
  };
  await refused(["code.prg", "--out", "packed.prg"], /^There is no SYS address in code\.prg\. It loads at \$c000, not at \$0801 where BASIC starts\. Give --entry/);
  await refused(["code.prg", "--entry", "$0300", "--out", "packed.prg"], /below \$0400/);
  await refused(["code.prg", "--entry", "$c000", "--out", "./code.prg"], /is the input code\.prg/);
  await refused(["code.prg", "--entry", "$c000", "--exit-memory", "$30", "--out", "packed.prg"], /--exit-memory/);
  assert.equal(existsSync(log), false, "Exomizer did not run");
});

test("an Exomizer that cannot pack is an error with its message", { timeout: 60_000 }, async () => {
  const root = project({ "game.prg": BASIC });
  const { status, json } = await packer(root, ["game.prg", "--out", "packed.prg"], { FAKE_EXO_FAIL: "1" });
  assert.equal(status, 2, JSON.stringify(json));
  const error = json.error as { code: string; message: string };
  assert.equal(error.code, "operation-failed");
  assert.match(error.message, /Exomizer could not pack the program \(exit 1\)\. The last output of Exomizer:\n {2}Error: the data overlaps the decrunch table\./);
});
