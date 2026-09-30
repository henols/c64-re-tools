// Coverage for compare-cross-binary.ts's cross-binary comparison rules --
// the mask machinery that makes this module a different instrument from
// compare.ts, not a copy of it.
//
// Every image in this file is a fixed 65536-byte pattern buffer with planted
// differences -- no fixture file, no emulator, no scratch directory outside
// mkdtempSync(tmpdir()). CLI behaviour runs the real script with spawnSync
// and asserts on the exit status and the last-line JSON result. A handful of
// the mask's own edge properties -- the VIC-II mirroring fold in particular --
// are asserted directly against the module's exported functions.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { IMAGE_VOLATILE, isImageVolatile, isIoVolatile, classify } from "../../../skills/c64-ram-capture/scripts/compare-cross-binary.ts";
import { buildChipState } from "../../../skills/c64-ram-capture/scripts/dump-artifacts.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
// The scripts under test live in the skill folder; this test lives in test/skills/.
const SCRIPT_DIR = join(HERE, "..", "..", "..", "skills", "c64-ram-capture", "scripts");
const SCRIPT = join(SCRIPT_DIR, "compare-cross-binary.ts");
const IMAGE_BYTES = 65536;

function scratchDir() {
  return mkdtempSync(join(tmpdir(), "compare-cross-binary-"));
}

/** A deterministic 64K pattern buffer -- never all-zero, so an accidental
 * "everything equal" bug in the classifier cannot pass silently. */
function basePattern() {
  const buf = Buffer.alloc(IMAGE_BYTES);
  for (let i = 0; i < IMAGE_BYTES; i++) buf[i] = i & 0xff;
  return buf;
}

function writeImage(dir: string, name: string, buf: Buffer) {
  const p = join(dir, name);
  writeFileSync(p, buf);
  return p;
}

function writeJson(dir: string, name: string, obj: unknown) {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

/** Runs `cross`. With no --state, the route defaults to --route memory-read. */
function runCross(argv: string[], { cwd }: { cwd?: string } = {}) {
  const args = argv.includes("--state") || argv.includes("--route") ? argv : [...argv, "--route", "memory-read"];
  const r = spawnSync(process.execPath, [SCRIPT, "cross", ...args], {
    cwd: cwd ?? HERE,
    encoding: "utf8",
    timeout: 30000,
  });
  const stdout = r.stdout ?? "";
  const result = JSON.parse(stdout.trim().split("\n").pop() ?? "") as { ok: boolean; message?: string; [key: string]: unknown };
  return { status: r.status, stdout, result, message: result.message ?? "" };
}

function runNoVerb() {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", timeout: 30000 });
  return { status: r.status, result: JSON.parse((r.stdout ?? "").trim().split("\n").pop() ?? "") };
}

/** A `vice_vicii_get_state` registers object: 47 bytes, `overrides` by address. */
function vicRegisters(overrides: Record<string, number> = {}) {
  const bytes = Buffer.alloc(47);
  for (const [k, v] of Object.entries(overrides)) bytes[parseInt(k.slice(1), 16) - 0xd000] = v;
  return { registersHex: bytes.toString("hex"), spriteX: [0, 0, 0, 0, 0, 0, 0, 0] };
}

// ---------------------------------------------------------------------------
// Direct mask assertions (exported functions -- safe to import per the
// guarded dispatch tail).
// ---------------------------------------------------------------------------

test("mask: $D020, $D015 and $D018 are NOT masked in either table", () => {
  assert.equal(isImageVolatile(0xd020, "memory-read"), false);
  assert.equal(isImageVolatile(0xd015, "memory-read"), false);
  assert.equal(isImageVolatile(0xd018, "memory-read"), false);
  assert.equal(isIoVolatile(0xd020), false);
  assert.equal(isIoVolatile(0xd015), false);
  assert.equal(isIoVolatile(0xd018), false);
});

test("mask: $D012 and $D019 ARE masked", () => {
  assert.equal(isIoVolatile(0xd012), true);
  assert.equal(isIoVolatile(0xd019), true);
});

test("mask: the VIC-II mirroring fold catches a masked register's regression at every mirror", () => {
  // $D011 (masked) mirrors to $D051, $D091, ... every $40 within $D000-$D3FF.
  assert.equal(isIoVolatile(0xd011), true);
  assert.equal(isIoVolatile(0xd051), true);
  assert.equal(isIoVolatile(0xd091), true);
  assert.equal(isIoVolatile(0xd391), true);
  // $D020 (NOT masked) mirrors the same way and stays unmasked at every mirror.
  assert.equal(isIoVolatile(0xd020), false);
  assert.equal(isIoVolatile(0xd060), false);
  assert.equal(isIoVolatile(0xd3e0), false);
});

test("mask: snapshot route does not mask $D000-$DFFF in the image; memory-read route does mask the volatile parts of it", () => {
  assert.equal(isImageVolatile(0xd012, "snapshot"), false);
  assert.equal(isImageVolatile(0xd012, "memory-read"), true);
  assert.equal(isImageVolatile(0xd020, "snapshot"), false);
  assert.equal(isImageVolatile(0xd020, "memory-read"), false);
});

test("mask: IMAGE_VOLATILE is exported and non-empty", () => {
  assert.ok(Array.isArray(IMAGE_VOLATILE) && IMAGE_VOLATILE.length > 0);
});

test("classify: no drift bucket -- a one-bit divergence outside every mask fails just like a multi-bit one", () => {
  const imgA = basePattern();
  const imgB = Buffer.from(imgA);
  imgB[0x8000] ^= 0x01; // exactly one bit
  const r = classify({ imgA, imgB, route: "memory-read", regMapA: null, regMapB: null });
  assert.equal(r.pass, false);
  assert.equal(r.divergence.length, 1);
  assert.equal(r.divergence[0].addr, 0x8000);
});

// ---------------------------------------------------------------------------
// CLI: usage
// ---------------------------------------------------------------------------

test("cli: no verb gives a refusal that carries the usage", () => {
  const r = runNoVerb();
  assert.equal(r.status, 1);
  assert.match(r.result.message, /usage: node compare-cross-binary\.ts/);
});

test("cross: with no state sidecar and no --route, the route is refused as unknown", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const r = spawnSync(process.execPath, [SCRIPT, "cross", pa, pb], { encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 1);
    assert.match(JSON.parse(r.stdout.trim().split("\n").pop() ?? "").message, /needs the capture route/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: a state sidecar with no route is refused by name", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", { registers: vicRegisters() });
    const sb = writeJson(dir, "b.state.json", { route: "memory-read", registers: vicRegisters() });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.equal(r.status, 1);
    assert.match(r.message, /a\.state\.json: the state sidecar declares route undefined/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: reads the chip-state sidecar that dump-artifacts write-set writes", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const raw = {
      dd00_raw: 0xc3, d018_raw: 0x15, port01_raw: 0x37, sprite_pointers: [0, 0, 0, 0, 0, 0, 0, 0],
      captured_at: "2026-09-29T00:00:00Z", route: "memory-read" as const,
    };
    const sa = writeJson(dir, "a.state.json", buildChipState({ ...raw, registers: vicRegisters({ $D020: 14 }) }));
    const sb = writeJson(dir, "b.state.json", buildChipState({ ...raw, registers: vicRegisters({ $D020: 6 }) }));
    const r = runCross([pa, pb, "--state", sa, sb, "--json"]);
    assert.equal(r.status, 1, r.stdout);
    assert.equal(r.result.verdict, "FAIL");
    assert.deepEqual(r.result.divergence, [{ addr: "$D020", a: 14, b: 6, domain: "register" }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: a registers object with no registersHex is refused by name", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", { route: "memory-read", registers: { PC: 2049 } });
    const sb = writeJson(dir, "b.state.json", { route: "memory-read", registers: vicRegisters() });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.equal(r.status, 1);
    assert.match(r.message, /registersHex/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// No drift bucket, narrowed I/O mask, route awareness, image-length refusal
// ---------------------------------------------------------------------------

test("cross: a one-bit RAM difference outside every masked span fails (exit 1)", () => {
  const dir = scratchDir();
  try {
    const imgA = basePattern();
    const imgB = Buffer.from(imgA);
    imgB[0x9000] ^= 0x01;
    const pa = writeImage(dir, "a.bin", imgA);
    const pb = writeImage(dir, "b.bin", imgB);
    const r = runCross([pa, pb]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /VERDICT: FAIL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const reg of ["$D020", "$D015", "$D018"]) {
  test(`cross: a one-bit ${reg} chip-state difference fails (exit 1) and names the register`, () => {
    const dir = scratchDir();
    try {
      const img = basePattern();
      const pa = writeImage(dir, "a.bin", img);
      const pb = writeImage(dir, "b.bin", img);
      const sa = writeJson(dir, "a.state.json", { route: "memory-read", registers: vicRegisters({ [reg]: 0x00 }) });
      const sb = writeJson(dir, "b.state.json", { route: "memory-read", registers: vicRegisters({ [reg]: 0x01 }) });
      const r = runCross([pa, pb, "--state", sa, sb]);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /VERDICT: FAIL/);
      assert.ok(r.stdout.includes(reg), `expected ${reg} named in output:\n${r.stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const reg of ["$D012", "$D019"]) {
  test(`cross: a ${reg} chip-state difference passes as volatile (exit 0)`, () => {
    const dir = scratchDir();
    try {
      const img = basePattern();
      const pa = writeImage(dir, "a.bin", img);
      const pb = writeImage(dir, "b.bin", img);
      const sa = writeJson(dir, "a.state.json", { route: "memory-read", registers: vicRegisters({ [reg]: 0x00 }) });
      const sb = writeJson(dir, "b.state.json", { route: "memory-read", registers: vicRegisters({ [reg]: 0x7f }) });
      const r = runCross([pa, pb, "--state", sa, sb]);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /VERDICT: PASS/);
      assert.match(r.stdout, /volatile \(excluded from the verdict\): 1/);
      assert.ok(r.stdout.includes(reg), `expected ${reg} named under the volatile bucket:\n${r.stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("cross: a mismatched route pair is refused, names both routes, and exits non-zero without a verdict", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", { route: "snapshot" });
    const sb = writeJson(dir, "b.state.json", { route: "memory-read" });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.notEqual(r.status, 0);
    assert.match(r.message, /snapshot/);
    assert.match(r.message, /memory-read/);
    assert.doesNotMatch(r.stdout, /VERDICT:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: an image that is not exactly 65536 bytes is refused with its byte count in the message", () => {
  const dir = scratchDir();
  try {
    const pa = join(dir, "short.bin");
    writeFileSync(pa, Buffer.alloc(100));
    const pb = writeImage(dir, "b.bin", basePattern());
    const r = runCross([pa, pb]);
    assert.notEqual(r.status, 0);
    assert.match(r.message, /100 bytes, expected 65536/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Allowlist and per-binary logical checkpoints
// ---------------------------------------------------------------------------

test("cross: an allowlist entry with a whitespace-only why is refused, naming the offending range", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const al = writeJson(dir, "allow.json", {
      entries: [{ start: 0x8000, endInclusive: 0x8000, domain: "image", why: "   " }],
    });
    const r = runCross([pa, pb, "--allowlist", al]);
    assert.notEqual(r.status, 0);
    assert.match(r.message, /\$8000/);
    assert.match(r.message, /why/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: an allowlist entry overlapping a masked span is refused, naming the overlap", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const al = writeJson(dir, "allow.json", {
      entries: [{ start: 0x0000, endInclusive: 0x0000, domain: "image", why: "deliberate test overlap" }],
    });
    const r = runCross([pa, pb, "--allowlist", al]);
    assert.notEqual(r.status, 0);
    assert.match(r.message, /overlap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: a pair that PASSES with an allowlist FAILS with --no-allowlist, same two images both times", () => {
  const dir = scratchDir();
  try {
    const imgA = basePattern();
    const imgB = Buffer.from(imgA);
    imgB[0x8000] = (imgB[0x8000] + 1) & 0xff;
    const pa = writeImage(dir, "a.bin", imgA);
    const pb = writeImage(dir, "b.bin", imgB);
    const al = writeJson(dir, "allow.json", {
      entries: [{ start: 0x8000, endInclusive: 0x8000, domain: "image", why: "intentional test diff" }],
    });

    const withAllow = runCross([pa, pb, "--allowlist", al]);
    assert.equal(withAllow.status, 0, withAllow.stdout);
    assert.match(withAllow.stdout, /VERDICT: PASS/);
    assert.match(withAllow.stdout, /allowlisted \(intentional difference, excluded from the verdict\): 1/);

    const withoutAllow = runCross([pa, pb, "--allowlist", al, "--no-allowlist"]);
    assert.equal(withoutAllow.status, 1);
    assert.match(withoutAllow.stdout, /VERDICT: FAIL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: two captures declaring different logical checkpoints are refused, naming both", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", { route: "memory-read", checkpoint_name: "checkpoint-a" });
    const sb = writeJson(dir, "b.state.json", { route: "memory-read", checkpoint_name: "checkpoint-b" });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.notEqual(r.status, 0);
    assert.match(r.message, /checkpoint-a/);
    assert.match(r.message, /checkpoint-b/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: a successful run's header carries MASK_NARROWED_AT and one resolved checkpoint address per capture", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", {
      route: "memory-read",
      checkpoint_name: "hazard_raster_entry",
      checkpoint_address: 0x10c2,
    });
    const sb = writeJson(dir, "b.state.json", {
      route: "memory-read",
      checkpoint_name: "hazard_raster_entry",
      checkpoint_address: 0x10c5,
    });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /MASK_NARROWED_AT:/);
    assert.match(r.stdout, /A {2}checkpoint hazard_raster_entry @ \$10C2/);
    assert.match(r.stdout, /B {2}checkpoint hazard_raster_entry @ \$10C5/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Byte identity is a recorded extra, never the verdict
// ---------------------------------------------------------------------------

test("cross: byte-identical images with identical sidecars produce VERDICT: PASS and full, non-omitted bucket-count lines", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", { route: "memory-read", registers: vicRegisters({ $D020: 14 }) });
    const sb = writeJson(dir, "b.state.json", { route: "memory-read", registers: vicRegisters({ $D020: 14 }) });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /BYTE_IDENTICAL: yes/);
    assert.match(r.stdout, /volatile \(excluded from the verdict\): 0/);
    assert.match(r.stdout, /allowlisted \(intentional difference, excluded from the verdict\): 0/);
    assert.match(r.stdout, /DIVERGENCE — fails the comparison: 0/);
    assert.match(r.stdout, /VERDICT: PASS/);
    // Classification actually ran, rather than short-circuiting on equal
    // digests -- and BYTE_IDENTICAL never substitutes for the verdict: no
    // single line carries both tokens.
    const offendingLine = r.stdout
      .split("\n")
      .find((line) => line.includes("BYTE_IDENTICAL") && line.includes("VERDICT"));
    assert.equal(offendingLine, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cross: byte-identical images whose sidecars differ at $D020 still FAIL (exit 1)", () => {
  const dir = scratchDir();
  try {
    const img = basePattern();
    const pa = writeImage(dir, "a.bin", img);
    const pb = writeImage(dir, "b.bin", img);
    const sa = writeJson(dir, "a.state.json", { route: "memory-read", registers: vicRegisters({ $D020: 14 }) });
    const sb = writeJson(dir, "b.state.json", { route: "memory-read", registers: vicRegisters({ $D020: 6 }) });
    const r = runCross([pa, pb, "--state", sa, sb]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /BYTE_IDENTICAL: yes/);
    assert.match(r.stdout, /VERDICT: FAIL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
