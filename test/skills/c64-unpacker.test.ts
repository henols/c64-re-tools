// The c64-unpacker packing evidence. No emulator needed.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { inspect } from "../../skills/c64-unpacker/scripts/evidence.ts";
import { xorPackedPrg } from "../fixtures/prg/xor-packed.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-unpacker-"));
after(() => rmSync(project, { recursive: true, force: true }));

const stub = [0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];

test("random bytes after a BASIC start look packed", () => {
  const result = inspect(Uint8Array.from([...stub, ...randomBytes(4096)]));
  assert.equal(result.packing, "likely");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  assert.equal((result.entropy as { blocks: number }).blocks, 16);
});

test("code-like bytes do not look packed", () => {
  // A plain routine pattern repeated: LDA abs,X / STA abs,Y / INX / BNE.
  const code = Array.from({ length: 4096 }, (_, index) => [0xbd, 0x00, 0x20, 0x99, 0x00, 0x30, 0xe8, 0xd0, 0xf7][index % 9]!);
  const result = inspect(Uint8Array.from([0x00, 0xc0, ...code]));
  assert.equal(result.packing, "unlikely");
  assert.equal(result.basicStart, null);
  assert.deepEqual(result.loadRange, { start: "$c000", end: "$cfff" });
});

test("a short program is unclear, and the script reports it", () => {
  writeFileSync(join(project, "packed.prg"), xorPackedPrg);
  const script = resolve(import.meta.dirname, "../../skills/c64-unpacker/scripts/unpack.ts");
  const run = spawnSync(process.execPath, [script, "inspect", "packed.prg"], { cwd: project, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const result = JSON.parse(run.stdout) as Record<string, unknown>;
  assert.equal(result.packing, "unclear");
  assert.deepEqual(result.basicStart, { line: 10, sys: "$080d" });
  for (const args of [["inspect"], ["capture", "packed.prg"], ["capture", "packed.prg", "--until", "49152", "--out", "x.prg"], ["unpack", "packed.prg"]]) {
    const bad = spawnSync(process.execPath, [script, ...args], { cwd: project, encoding: "utf8" });
    assert.equal(bad.status, 2, args.join(" "));
  }
});
