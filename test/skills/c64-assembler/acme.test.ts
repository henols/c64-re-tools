// acme.test.ts -- the build verb over the real host-tool seam. Needs `acme`
// on PATH, or it skips with that reason. The seam runs against this file's
// own harness broker.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { startHarnessBroker } from "../../vice/broker-harness.ts";
import type { HarnessBroker } from "../../vice/broker-harness.ts";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills", "c64-assembler", "scripts", "acme.ts");
const SOURCE = "!cpu 6510\n* = $0801\n!byte $0b,$08,$0a,$00,$9e,$32,$30,$36,$31,$00,$00,$00\n* = $080d\nlda #$00\nsta $d020\nrts\n";

const onPath = (process.env.PATH ?? "").split(":").some((d) => existsSync(join(d, "acme")));
const SKIP = onPath ? false : "acme is not on PATH -- the live build cases are skipped";

let broker: HarnessBroker | null = null;
before(async () => {
  if (SKIP) return;
  broker = await startHarnessBroker();
});
after(async () => {
  await broker?.stop();
});

function run(cwd: string, ...argv: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: "utf8", env: broker?.childEnv ?? process.env, timeout: 60_000 });
  return { status: r.status, stdout: r.stdout, result: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
}

test("build -o other.prg leaves an existing <source>.prg untouched", { skip: SKIP }, () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-test-"));
  try {
    writeFileSync(join(dir, "game.asm"), SOURCE);
    writeFileSync(join(dir, "game.prg"), "KEEP ME");
    const r = run(dir, "build", "game.asm", "-o", "other.prg", "--json");
    assert.equal(r.status, 0, JSON.stringify(r.result));
    assert.equal(readFileSync(join(dir, "game.prg"), "utf8"), "KEEP ME");
    assert.ok(existsSync(join(dir, "other.prg")));
    assert.ok(existsSync(join(dir, "other.sym")));
    assert.deepEqual(readFileSync(join(dir, "other.prg")).subarray(0, 2), Buffer.from([0x01, 0x08]));
    assert.equal(r.result.prg, join(dir, "other.prg"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed build ends with ok:false and a message, also with --json", { skip: SKIP }, () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-test-"));
  try {
    writeFileSync(join(dir, "bad.asm"), "!cpu 6510\n* = $0801\nlda #$1234\n");
    const r = run(dir, "build", "bad.asm");
    assert.equal(r.status, 1);
    assert.equal(r.result.ok, false);
    assert.match(r.result.message, /build FAILED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing source file and an unknown command are refusals, not stack traces", () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-test-"));
  try {
    const missing = run(dir, "build", "nope.asm");
    assert.equal(missing.status, 1);
    assert.match(missing.result.message, /no such source file/);
    assert.match(run(dir, "frobnicate").result.message, /unknown command "frobnicate"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("new writes a scaffold and refuses to overwrite an existing file", () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-test-"));
  try {
    assert.equal(run(dir, "new", "x.asm").status, 0);
    const again = run(dir, "new", "x.asm");
    assert.equal(again.status, 1);
    assert.match(again.result.message, /already exists/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
