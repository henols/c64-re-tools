// Coverage for src/skills/c64-program-recon/scripts/derive.mjs -- the
// c64-program-recon skill's CLI, which derives VIC banking/mode, sprite
// pointers and reset/IRQ vector state from register values and a RAM image.
// It has no external dependency (pure arithmetic, no assembler, no
// emulator), which is what makes it the one script of the three PKG-02
// subjects whose every verb can be specified exhaustively.
//
// derive.mjs's `main(process.argv.slice(2))` call sits unconditionally at
// module scope (no entry-point guard), so importing it would also run it.
// Every case here is therefore a subprocess: an argument vector of
// `process.execPath` + [scriptPath, verb, ...flags], never a shell string.
//
// This file lives in src/mcp/vice/ -- not next to derive.mjs -- because test
// discovery here (this package's `npm test` glob and `test-gate.mjs`'s
// enumeration) is a non-recursive listing of ONE directory. A test file
// under src/skills/c64-program-recon/scripts/ would never be discovered by
// either gate. The script itself is reached by a relative path computed
// from this file's own URL, joined outward into the sibling skills tree.
//
// The script's own error convention is `error: <message>` on stderr with
// exit 1 for a runtime error, but its three dispatch outcomes are NOT
// uniform: no-argument/--help/-h all print usage and exit 0; an unknown verb
// prints the SAME usage text but exits 2; a caught runtime error (missing
// required flag, bad vectors path/size) prints `error: ...` and exits 1.
// All three codes are asserted separately below, never assumed uniform.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Two levels up out of src/mcp/vice/, back down into the sibling skills
// tree -- see this file's own header for why this hop, not a colocated
// test, is the only route discovery actually exercises.
const SCRIPT_PATH = join(HERE, "..", "..", "skills", "c64-program-recon", "scripts", "derive.mjs");

const REQUIRED_IMAGE_SIZE = 65536;

test("derive.mjs is resolved at the expected relative path (a wrong path here would silently skip every case below)", () => {
  assert.ok(
    existsSync(SCRIPT_PATH),
    `expected derive.mjs at ${SCRIPT_PATH} -- this suite depends on that relative hop staying correct`,
  );
});

// ---------------------------------------------------------------------------
// Subprocess helper -- argument vector only, never a shell string.
// ---------------------------------------------------------------------------

function runDerive(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "derive-cli-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const USAGE_MARKER = "derive.mjs vic";

// ---------------------------------------------------------------------------
// Dispatch: no args / --help / -h / unknown verb -- three distinct exit
// codes, each asserted on its own.
// ---------------------------------------------------------------------------

test("no arguments: prints usage and exits 0", () => {
  const r = runDerive([]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, new RegExp(USAGE_MARKER));
});

test("--help: prints the same usage text and exits 0", () => {
  const r = runDerive(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, new RegExp(USAGE_MARKER));
});

test("-h: prints the same usage text and exits 0", () => {
  const r = runDerive(["-h"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, new RegExp(USAGE_MARKER));
});

test("an unknown verb: prints usage and exits 2 -- a different code from the no-argument case, which is itself the specification", () => {
  const r = runDerive(["bogus-verb"]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, new RegExp(USAGE_MARKER));
});

// ---------------------------------------------------------------------------
// vic verb -- decode assertions against the script's own usage example,
// hand-derived from its published bank/mode/charset formulas (derive.mjs's
// bankOf(), modeOf(), the charset/bitmap branch in vic()) and pinned as
// literals so a formula change fails this test rather than the test
// following the change.
//
// --dd00 3E --d018 18 --d011 1B --d016 C8 (the script's own usage example):
//   dd00=$3E -> sel = 3E & 3 = 2 -> bank = 3-2 = 1 -> base = $4000
//   d018=$18 -> VM = (18>>4)&F = 1 -> screen = base + 1*$400 = $4400
//            -> CB = (18>>1)&7 = 4 -> not in char-ROM shadow (bank 1) -> charset = base + 4*$800 = $6000
//   d011=$1B, d016=$C8 -> ECM=0 BMM=0 MCM=0 -> "standard text"
// ---------------------------------------------------------------------------

test("vic verb with all four registers from its own usage example decodes bank/screen/charset/mode", () => {
  const r = runDerive(["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B", "--d016", "C8"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /VIC bank 1, base \$4000/);
  assert.match(r.stdout, /screen RAM {5}\$4400-\$47E7/);
  assert.match(r.stdout, /charset {8}\$6000-\$67FF {2}\(256 chars\)/);
  assert.match(r.stdout, /mode: standard text {2}\(ECM=0 BMM=0 MCM=0\)/);
});

test("vic verb with only the two required registers: the two optional registers take their documented defaults ($1B/$C8) and the run still exits 0", () => {
  const withDefaults = runDerive(["vic", "--dd00", "3E", "--d018", "18"]);
  const explicit = runDerive(["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B", "--d016", "C8"]);
  assert.equal(withDefaults.status, 0);
  assert.equal(withDefaults.stdout, explicit.stdout, "omitting --d011/--d016 must match the explicit $1B/$C8 defaults byte-for-byte");
});

test("vic verb with a required argument missing (--d018 omitted): exits 1 naming the missing argument", () => {
  const r = runDerive(["vic", "--dd00", "3E"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /error: missing --d018/);
});

test("vic verb: radix markers (bare hex, dollar-prefixed, 0x-prefixed, binary) for the same values all produce byte-identical stdout", () => {
  const bare = runDerive(["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B", "--d016", "C8"]);
  const dollar = runDerive(["vic", "--dd00", "$3E", "--d018", "$18", "--d011", "$1B", "--d016", "$C8"]);
  const hex0x = runDerive(["vic", "--dd00", "0x3E", "--d018", "0x18", "--d011", "0x1B", "--d016", "0xC8"]);
  const binary = runDerive([
    "vic",
    "--dd00",
    "%00111110",
    "--d018",
    "%00011000",
    "--d011",
    "%00011011",
    "--d016",
    "%11001000",
  ]);
  assert.equal(bare.status, 0);
  // Compared against each other, never against a hardcoded block, so this
  // case stays true if the output format is ever reformatted.
  assert.equal(dollar.stdout, bare.stdout);
  assert.equal(hex0x.stdout, bare.stdout);
  assert.equal(binary.stdout, bare.stdout);
});

test("vic verb determinism: run twice with identical arguments produces byte-identical stdout", () => {
  const first = runDerive(["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B", "--d016", "C8"]);
  const second = runDerive(["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B", "--d016", "C8"]);
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
});

// ---------------------------------------------------------------------------
// sprites verb -- pinned against its own usage example.
// ---------------------------------------------------------------------------

test("sprites verb with the pointer list from its own usage example: exits 0 and emits one entry per enabled sprite", () => {
  const r = runDerive([
    "sprites",
    "--dd00",
    "3E",
    "--d018",
    "18",
    "--d015",
    "FF",
    "--ptrs",
    "20,21,22,23,24,25,26,27",
  ]);
  assert.equal(r.status, 0);
  const enabledLines = r.stdout.split("\n").filter((l) => /^\s*\d\s+yes\s/.test(l));
  assert.equal(enabledLines.length, 8, "with $D015=$FF all 8 sprites are enabled, one row each");
  assert.match(r.stdout, /\$20\s+\$4800-\$483E/);
});

test("sprites verb with the enable mask omitted: the documented default ($FF) is used", () => {
  const withDefault = runDerive([
    "sprites",
    "--dd00",
    "3E",
    "--d018",
    "18",
    "--ptrs",
    "20,21,22,23,24,25,26,27",
  ]);
  const explicitFF = runDerive([
    "sprites",
    "--dd00",
    "3E",
    "--d018",
    "18",
    "--d015",
    "FF",
    "--ptrs",
    "20,21,22,23,24,25,26,27",
  ]);
  assert.equal(withDefault.status, 0);
  assert.equal(withDefault.stdout, explicitFF.stdout, "omitting --d015 must match the documented $FF default");
});

test("sprites verb with an empty pointer list: exits 0 and emits the documented degenerate result rather than crashing (observed, not assumed)", () => {
  const r = runDerive(["sprites", "--dd00", "3E", "--d018", "18", "--d015", "FF"]);
  assert.equal(r.status, 0);
  // Observed behaviour, pinned: with no --ptrs, every enabled row prints a
  // blank pointer/address pair rather than throwing.
  const rows = r.stdout.split("\n").filter((l) => /^\s*\d\s+yes\s/.test(l));
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.match(row, /--\s+---------/, `expected a blank pointer/address pair, got: ${row}`);
  }
});

// ---------------------------------------------------------------------------
// vectors verb -- exact-size requirement in both directions, plus a decode
// against recognisable planted values.
// ---------------------------------------------------------------------------

test("vectors verb against a synthetic image of exactly the required size decodes the vector rows, including a planted retargeted value", () => {
  withTempDir((dir) => {
    const imgPath = join(dir, "image.bin");
    const buf = Buffer.alloc(REQUIRED_IMAGE_SIZE, 0);
    // $0314/$0315 (CINV, the KERNAL IRQ vector) -> a recognisable planted
    // little-endian value, $1234, distinct from its $EA31 default.
    buf[0x0314] = 0x34;
    buf[0x0315] = 0x12;
    writeFileSync(imgPath, buf);
    // --port $37 (loram=1, hiram=1, charen=1) keeps the KERNAL IRQ block
    // live (not DORMANT) so the planted retarget is actually reported.
    const r = runDerive(["vectors", imgPath, "--port", "37"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\$0314\/\$0315 {2}\$1234 {3}\$EA31 {3}\*\*\* RETARGETED \*\*\*/);
  });
});

test("vectors verb against an image one byte short and one byte long: both exit 1 naming the required size (65536) and the size received", () => {
  withTempDir((dir) => {
    const shortPath = join(dir, "short.bin");
    const longPath = join(dir, "long.bin");
    writeFileSync(shortPath, Buffer.alloc(REQUIRED_IMAGE_SIZE - 1));
    writeFileSync(longPath, Buffer.alloc(REQUIRED_IMAGE_SIZE + 1));

    const short = runDerive(["vectors", shortPath]);
    assert.equal(short.status, 1);
    assert.match(short.stderr, /expected a 65536-byte image, got 65535/);

    const long = runDerive(["vectors", longPath]);
    assert.equal(long.status, 1);
    assert.match(long.stderr, /expected a 65536-byte image, got 65537/);
  });
});

test("vectors verb with no path, and with a path-shaped argument that is actually a flag: exits 1 with the documented message", () => {
  const noPath = runDerive(["vectors"]);
  assert.equal(noPath.status, 1);
  assert.match(noPath.stderr, /error: vectors needs an image path/);

  const flagAsPath = runDerive(["vectors", "--all"]);
  assert.equal(flagAsPath.status, 1);
  assert.match(flagAsPath.stderr, /error: vectors needs an image path/);
});
