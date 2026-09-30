// compare.test.ts -- the same-binary comparison: the route-dependent mask,
// drift versus divergence, and the one-line JSON result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compare, isVolatile } from "../../../skills/c64-ram-capture/scripts/compare.ts";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills", "c64-ram-capture", "scripts", "compare.ts");

function pattern(): Buffer {
  const buf = Buffer.alloc(65536);
  for (let i = 0; i < buf.length; i++) buf[i] = (i * 7) & 0xff;
  return buf;
}

function run(dir: string, ...argv: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...argv], { cwd: dir, encoding: "utf8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout, result: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
}

test("the memory-read route masks $D000-$DFFF, the snapshot route does not", () => {
  assert.equal(isVolatile(0xd020, "memory-read"), true);
  assert.equal(isVolatile(0xd020, "snapshot"), false);
  assert.equal(isVolatile(0x0100, "snapshot"), true);
  const a = pattern();
  const b = Buffer.from(a);
  b[0xd400] ^= 0xff;
  assert.equal(compare(a, b, "memory-read").pass, true);
  assert.equal(compare(a, b, "snapshot").pass, false);
});

test("one differing bit is drift and passes, two bits is divergence and fails", () => {
  const a = pattern();
  const oneBit = Buffer.from(a);
  oneBit[0x8000] ^= 0x01;
  const twoBits = Buffer.from(a);
  twoBits[0x8000] ^= 0x03;
  const drift = compare(a, oneBit, "snapshot");
  assert.equal(drift.pass, true);
  assert.equal(drift.drift.length, 1);
  assert.equal(compare(a, twoBits, "snapshot").pass, false);
});

test("compare and floor refuse to run without --route", () => {
  const dir = mkdtempSync(join(tmpdir(), "compare-test-"));
  try {
    writeFileSync(join(dir, "a.bin"), pattern());
    writeFileSync(join(dir, "b.bin"), pattern());
    for (const verb of ["compare", "floor"]) {
      const r = run(dir, verb, "a.bin", "b.bin");
      assert.equal(r.status, 1, verb);
      assert.match(r.result.message, /needs --route/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a snapshot-route difference in $D000-$DFFF fails, and the result names it", () => {
  const dir = mkdtempSync(join(tmpdir(), "compare-test-"));
  try {
    const a = pattern();
    const b = Buffer.from(a);
    b[0xd020] ^= 0x0f;
    writeFileSync(join(dir, "a.bin"), a);
    writeFileSync(join(dir, "b.bin"), b);
    const snap = run(dir, "compare", "a.bin", "b.bin", "--route", "snapshot", "--json");
    assert.equal(snap.status, 1);
    assert.equal(snap.result.verdict, "FAIL");
    assert.deepEqual(snap.result.divergence, ["$D020"]);
    const read = run(dir, "compare", "a.bin", "b.bin", "--route", "memory-read");
    assert.equal(read.status, 0);
    assert.equal(read.result.counts.volatile, 1);
    assert.match(read.stdout, /VERDICT: PASS/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a --limit value is never read as an image path, and digest refuses a short image", () => {
  const dir = mkdtempSync(join(tmpdir(), "compare-test-"));
  try {
    writeFileSync(join(dir, "a.bin"), pattern());
    writeFileSync(join(dir, "b.bin"), pattern());
    writeFileSync(join(dir, "short.bin"), Buffer.alloc(10));
    const r = run(dir, "compare", "a.bin", "--limit", "5", "b.bin", "--route", "memory-read");
    assert.equal(r.status, 0, JSON.stringify(r.result));
    const d = run(dir, "digest", "short.bin");
    assert.equal(d.status, 1);
    assert.match(d.result.message, /10 bytes, expected 65536/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
