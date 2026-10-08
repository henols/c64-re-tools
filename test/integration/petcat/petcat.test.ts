// Real-petcat checks of the petcat adapter. Skipped (never passed) when
// petcat is not installed on this machine.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { findTool, PETCAT } from "../../../src/native/discover.ts";
import { decode } from "../../../src/host/tools/petcat.ts";
import { borderLoopPrg } from "../../fixtures/prg/border-loop.ts";

let petcat = "";
let skip: string | false = false;
try {
  petcat = findTool(PETCAT);
} catch {
  skip = "petcat is not installed: install VICE or set C64RT_PETCAT to run these tests";
}

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-petcat-"));
const supervisor = new ProcessSupervisor();
supervisor.installExitGuard();
after(() => rmSync(scratch, { recursive: true, force: true }));

const context = () => ({ supervisor, signal: new AbortController().signal });

test("a BASIC loader decodes to its listing and its SYS handoff", { skip }, async () => {
  const { result } = await decode(Buffer.from(borderLoopPrg), context());
  assert.deepEqual(result, {
    decoded: true,
    loadAddress: 0x0801,
    basicEnd: 0x080d,
    listing: "10 sys2061",
    lines: [{ number: 10, text: "sys2061" }],
    handoffs: [{ kind: "sys", line: 10, address: 0x080d }],
  });
});

test("a program tokenized by petcat decodes back, with handoffs only from program text", { skip }, async () => {
  const source = [
    '10 print"{clr}hello":poke53280,0',
    "20 sys 4096*2+13",
    "30 rem sys 1234",
    '40 data sys,"x"',
    "50 sys peek(43)+256*peek(44)",
    "60 x=usr(5)",
  ];
  writeFileSync(join(scratch, "p.txt"), `${source.join("\n")}\n`);
  const tokenize = spawnSync(petcat, ["-w2", "-o", "p.prg", "--", "p.txt"], { cwd: scratch, encoding: "utf8" });
  assert.equal(tokenize.status, 0, tokenize.stderr);
  const { result } = await decode(readFileSync(join(scratch, "p.prg")), context());
  assert.ok(result.decoded);
  assert.deepEqual(result.lines.map((line) => `${line.number} ${line.text}`), source);
  assert.equal(result.listing, source.join("\n"));
  assert.deepEqual(result.handoffs, [
    { kind: "sys", line: 20, address: 8205 },
    { kind: "sys", line: 50, computed: true },
    { kind: "usr", line: 60, computed: true },
  ]);
});

test("bytes that are no BASIC program are not decoded", { skip }, async () => {
  const { result } = await decode(Buffer.from([0x00, 0xc0, 0x0b, 0xc0, 0xff, 0xff, 0xa9, 0x00]), context());
  assert.equal(result.decoded, false);
  assert.ok(!result.decoded && /above 63999/.test(result.reason));
});
