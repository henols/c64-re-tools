// The source of a ZX Spectrum program: sjasmplus text that gives the bytes of
// the snapshot in the knowledge again. Skipped when sjasmplus is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { findTool, SJASMPLUS } from "../../src/native/discover.ts";
import { keyboardCounterSnapshot, z80Snapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

let skip: string | false = false;
try {
  findTool(SJASMPLUS);
} catch {
  skip = "sjasmplus is not installed: run tools/install-sjasmplus.sh or set C64RT_SJASMPLUS";
}
const skills = resolve(import.meta.dirname, "../../skills");
const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-z80-source-"));
  mkdirSync(join(root, ".c64-re-tools", "local"), { recursive: true });
  roots.push(root);
  return root;
}

function run(root: string, skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: root, encoding: "utf8", timeout: 300_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}

test("the source of the counter has its names and labels, and gives all 48 KiB of the snapshot again", { skip, timeout: 300_000 }, () => {
  const root = project();
  writeFileSync(join(root, "counter.z80"), keyboardCounterSnapshot());
  for (const args of [["image", "counter.z80"], ["classify", "$8000-$8026", "code"], ["classify", "$8030-$8044", "code"], ["rename", "$8030", "count"], ["rename", "$9000", "presses"]]) {
    assert.equal(run(root, "retro-knowledge", "knowledge.ts", ...args).status, 0, args.join(" "));
  }
  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src");
  assert.equal(generated.status, 0, JSON.stringify(generated.json));
  assert.deepEqual([generated.json.result, generated.json.instructions, generated.json.check], ["PASS", 27, { identical: true, segments: [{ start: "$4000", end: "$ffff", identical: true }] }]);
  const text = readFileSync(join(root, "src", "main.asm"), "utf8");
  for (const line of ["ERR_NR\tEQU $5c3a", "\tORG $4000", "\tds 16384,$00", "\tld iy,ERR_NR", "l_8015:", "\tjr c,l_8015", "\tcall z,count", "count:", "\tld ix,presses", "presses:"]) assert.ok(text.includes(line), line);
  const loader = run(root, "retro-source", "source.ts", "generate", "--out", "src", "--loader");
  assert.equal(loader.status, 2);
  assert.match(loader.envelope.error!, /--loader works only for the C64/);
});

test("an instruction that sjasmplus encodes in another way is written as db with its text", { skip, timeout: 300_000 }, () => {
  const root = project();
  const ram = new Uint8Array(0xc000);
  // $8000: ED 63 00 90 (ld ($9000),hl in its second encoding) ; RET
  ram.set([0xed, 0x63, 0x00, 0x90, 0xc9], 0x8000 - 0x4000);
  writeFileSync(join(root, "alt.z80"), z80Snapshot(ram, { pc: 0x8000, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 }));
  for (const args of [["image", "alt.z80"], ["classify", "$8000-$8004", "code"]]) assert.equal(run(root, "retro-knowledge", "knowledge.ts", ...args).status, 0);
  const generated = run(root, "retro-source", "source.ts", "generate", "--out", "src");
  assert.deepEqual([generated.json.result, generated.json.instructions, generated.json.asBytes], ["PASS", 1, { count: 1, listed: ["$8000"] }]);
  assert.match(readFileSync(join(root, "src", "main.asm"), "utf8"), /\tdb \$ed,\$63,\$00,\$90\t; ld \(\$9000\),hl\n\tret\n/);
});
