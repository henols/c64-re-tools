// The spectrum-assembler script with real sjasmplus: a build of the keyboard
// counter, checked against the snapshot in the knowledge. Skipped when sjasmplus
// is not installed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { findTool, SJASMPLUS } from "../../src/native/discover.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";
import { keyboardCounterCode, keyboardCounterSnapshot } from "../fixtures/z80/keyboard-counter.ts";

let skip: string | false = false;
try {
  findTool(SJASMPLUS);
} catch {
  skip = "sjasmplus is not installed: run tools/install-sjasmplus.sh or set C64RT_SJASMPLUS";
}
const skills = resolve(import.meta.dirname, "../../skills");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-spectrum-assembler-"));
mkdirSync(join(project, ".c64-re-tools", "local"), { recursive: true });
mkdirSync(join(project, "src"));
after(() => rmSync(project, { recursive: true, force: true }));

function run(skill: string, script: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const child = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", script), ...args], { cwd: project, encoding: "utf8", timeout: 120_000 });
  assert.equal(child.stderr, "", child.stderr);
  const { envelope, json } = readEnvelope(child.stdout, child.status);
  return { status: child.status, json: json as Record<string, unknown>, envelope };
}

const SOURCE = `        org $8000
start:  di
        ld sp,$8ff0
        ld iy,$5c3a
        im 1
        ei
loop:   ld a,$fe
        in a,($fe)
        rra
        jr c,space
        call count
space:  ld bc,$7ffe
        in a,(c)
        and AND_MASK
        call z,count
        ld hl,$9002
        inc (hl)
        halt
        jp loop
        ds 9
count:  ld hl,$9000
        inc (hl)
        ld a,(hl)
        and 7
        out ($fe),a
        ld ix,$9000
        inc (ix+1)
        bit 0,(ix+1)
        ret
`;

test("a build of the counter is the program of the snapshot, and a change shows the first byte that differs", { skip, timeout: 120_000 }, () => {
  writeFileSync(join(project, "counter.z80"), keyboardCounterSnapshot());
  assert.equal(run("retro-knowledge", "knowledge.ts", "image", "counter.z80").status, 0);
  writeFileSync(join(project, "src", "main.asm"), SOURCE);
  const built = run("spectrum-assembler", "assembler.ts", "build", "src", "main.asm", "--out", ".c64-re-tools/local/counter.bin", "--compare", "--define", "AND_MASK=1");
  assert.equal(built.status, 0, JSON.stringify(built.json));
  assert.deepEqual([built.json.result, built.json.model, built.json.range, built.json.bytes], ["PASS", "48k", { start: "$8000", end: "$8044" }, 69]);
  assert.deepEqual([...readFileSync(join(project, ".c64-re-tools/local/counter.bin"))], [...keyboardCounterCode]);
  assert.deepEqual((built.json.compare as { matches: boolean; identical: boolean }).matches, true);
  assert.equal((built.json.compare as { identical: boolean }).identical, false, "the snapshot holds all of the RAM");
  assert.match(String(built.envelope.hint), /The build does not fill all bytes of the program/);

  const changed = run("spectrum-assembler", "assembler.ts", "build", "src", "main.asm", "--out", ".c64-re-tools/local/counter.bin", "--compare", "--define", "AND_MASK=3");
  assert.deepEqual([changed.status, changed.json.result], [0, "FAIL"], "a FAIL verdict is a result, not an error");
  assert.match(String(changed.envelope.hint), /Read compare\.segments/);
  const segment = (changed.json.compare as { segments: Array<{ firstDifference: unknown }> }).segments[0]!;
  assert.deepEqual(segment.firstDifference, { address: "$801b", built: "$03", reference: "$01" });

  writeFileSync(join(project, "src", "bad.asm"), "        org $8000\n        foo bar\n");
  const bad = run("spectrum-assembler", "assembler.ts", "build", "src", "bad.asm", "--out", ".c64-re-tools/local/bad.bin");
  assert.deepEqual([bad.status, bad.json.result, bad.json.assembled], [0, "FAIL", false]);
  assert.match(String(bad.envelope.hint), /Correct the source at the file and the line of each diagnostic/);
  assert.deepEqual(bad.json.diagnostics, [{ severity: "error", file: "bad.asm", line: 2, message: "Unrecognized instruction: foo bar" }]);
});
