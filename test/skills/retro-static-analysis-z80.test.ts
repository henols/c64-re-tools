// The static analysis of a ZX Spectrum program: the Z80 idioms (the inline
// bytes of RST $08 and RST $28), and Ghidra's Z80 language on a project with a
// snapshot.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { findZ80Idioms } from "../../skills/retro-static-analysis/scripts/lib/z80-idioms.ts";
import { keyboardCounterSnapshot } from "../fixtures/z80/keyboard-counter.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";

const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-z80-analysis-"));
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
after(() => rmSync(project, { recursive: true, force: true }));

function run(skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: project, encoding: "utf8", timeout: 600_000 });
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}

test("the code that the entry reaches gives the inline bytes of RST $08 and RST $28 as data, and the code after end-calc as a code start", () => {
  const memory = new Map<number, number>();
  const put = (address: number, bytes: number[]) => bytes.forEach((byte, index) => memory.set(address + index, byte));
  // $8000: CALL $8010 ; RST $08 ; DEFB $0b (an error code)
  put(0x8000, [0xcd, 0x10, 0x80, 0xcf, 0x0b]);
  // $8010: RST $28 ; DEFB $a1, $0f, $38 (stk-one, addition, end-calc) ; RET
  put(0x8010, [0xef, 0xa1, 0x0f, 0x38, 0xc9]);
  // $8020: an RST $08 that no code reaches is no idiom.
  put(0x8020, [0xcf, 0x01]);
  const found = findZ80Idioms((address) => memory.get(address), { start: 0x8000, end: 0x80ff }, [0x8000]);
  assert.deepEqual(found.dataRanges, [
    { start: 0x8004, end: 0x8004 },
    { start: 0x8011, end: 0x8013 },
  ]);
  assert.deepEqual(found.codeStarts, [0x8014]);
  assert.deepEqual(found.counts, { errorRestarts: 1, calculatorRestarts: 1 });
  assert.deepEqual(found.findings.regions.map((region) => region.type), ["bytes", "bytes"]);
});

test("calculator literals without end-calc in reach are no idiom", () => {
  const bytes = [0xef, ...Array.from({ length: 200 }, () => 0xa1)];
  const found = findZ80Idioms((address) => bytes[address - 0x8000], { start: 0x8000, end: 0x80ff }, [0x8000]);
  assert.deepEqual([found.dataRanges, found.codeStarts, found.counts.calculatorRestarts], [[], [], 0]);
});

test("a Spectrum project refuses DXA, and Ghidra's Z80 language finds the routines of the counter and its call", { timeout: 600_000 }, () => {
  writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
  assert.equal(run("retro-knowledge", "knowledge.ts", "image", "counter.z80").status, 0);
  const dxa = run("retro-static-analysis", "static-analysis.ts", "analyze", "--analyzer", "dxa");
  assert.equal(dxa.status, 2);
  assert.match(dxa.envelope.error!, /--analyzer dxa reads only 6502 code, and the ZX Spectrum 48K has a Z80/);
  const analyzed = run("retro-static-analysis", "static-analysis.ts", "analyze", "--out-instructions", ".c64-re-tools/local/instructions.json");
  assert.equal(analyzed.status, 0, JSON.stringify(analyzed.json));
  const functions = (analyzed.json.functions as { listed: Array<{ entry: string }> }).listed.map((fn) => fn.entry);
  assert.ok(functions.includes("$8000") && functions.includes("$8030"), functions.join(", "));
  assert.deepEqual(analyzed.json.idioms, { ...(analyzed.json.idioms as object), errorRestarts: 0, calculatorRestarts: 0 });
  const references = run("retro-knowledge", "knowledge.ts", "references", "--range", "$8012-$8014").json;
  assert.match(JSON.stringify(references), /"to":"\$8030"/);
});
