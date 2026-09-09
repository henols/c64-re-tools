// textmon-registers.test.ts
//
// Deterministic, no-emulator coverage for textmon-registers.ts's `io`
// parser (PARSE-02, PARSE-03). Mirrors textmon-memmap.test.ts and
// textmon-profile.test.ts's shape: purity, both real two-binary captures
// parsing clean, the sprite-table header-derived-offset proof, every
// refusal code (including the two source-traced degradation outcomes),
// idempotency and concurrency, and the planted controls each paired with
// the discriminating assertion that both real captures still parse. No
// fixture in this file is hand-rolled beyond short, explicitly synthetic
// inline payloads and targeted string mutations of the real captured
// text -- every real payload comes from textmon-fixtures.ts's
// loadTextFixture(), never a direct readFileSync against fixtures/textmon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadTextFixture } from "./textmon-fixtures.ts";
import { parseIoRegisters, type IoRegistersParseResult } from "./textmon-registers.ts";

const HERE = fileURLToPath(import.meta.url);
const OWN_MODULE = HERE.replace(/textmon-registers\.test\.ts$/, "textmon-registers.ts");

// ---------------------------------------------------------------------------
// Purity (PARSE-03).
// ---------------------------------------------------------------------------

test("purity (PARSE-03): textmon-registers.ts contains no top-level ES import statement", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
  assert.deepEqual(importLines, [], `expected zero import lines, found: ${JSON.stringify(importLines)}`);
});

test("purity: textmon-registers.ts declares no module-scope mutable (let/var) binding", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const mutableLines = src.split("\n").filter((line) => /^(export\s+)?(let|var)\s/.test(line));
  assert.deepEqual(mutableLines, [], `expected zero top-level let/var declarations, found: ${JSON.stringify(mutableLines)}`);
});

test("sprite-table column offsets are derived from the Sprites: header line's own token positions, never a literal width constant", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  assert.match(src, /matchAll\(\/\\S\+\/g\)/, "expected the header line to be tokenized via a regex scan, not a literal width table");
  assert.doesNotMatch(
    src,
    /\[\s*8\s*,\s*12\s*,\s*16\s*,\s*20/,
    "expected no hardcoded sprite-column boundary array -- offsets must come from the header line itself",
  );
});

// ---------------------------------------------------------------------------
// Both real captures parse clean, both sidecars record the parameterized
// command, and the border-colour/raster-position divergence is asserted
// exactly as fixtures/textmon/README.md's own measured finding.
// ---------------------------------------------------------------------------

test("both real captures (register-decode-stock, register-decode-fork) parse to ok:true with exactly one VIC-II section, and are genuine hardware captures with the parameterized command", () => {
  const stock = loadTextFixture("register-decode-stock");
  const fork = loadTextFixture("register-decode-fork");

  assert.equal(stock.synthetic, false, "register-decode-stock must be a real capture, not synthetic");
  assert.equal(fork.synthetic, false, "register-decode-fork must be a real capture, not synthetic");
  assert.equal(stock.provenance.command, "io $d020");
  assert.equal(fork.provenance.command, "io $d020");

  const stockResult = parseIoRegisters(stock.text);
  assert.equal(stockResult.ok, true, `expected register-decode-stock to parse, got ${JSON.stringify(!stockResult.ok ? stockResult.refusal : undefined)}`);
  const forkResult = parseIoRegisters(fork.text);
  assert.equal(forkResult.ok, true, `expected register-decode-fork to parse, got ${JSON.stringify(!forkResult.ok ? forkResult.refusal : undefined)}`);

  if (stockResult.ok) {
    assert.equal(stockResult.value.sections.length, 1);
    assert.equal(stockResult.value.sections[0]!.chip, "VIC-II");
  }
  if (forkResult.ok) {
    assert.equal(forkResult.value.sections.length, 1);
    assert.equal(forkResult.value.sections[0]!.chip, "VIC-II");
  }
});

test("both captures decode exactly 64 dump bytes, and the $D020 border-colour byte is identical across the two captures", () => {
  const stock = parseIoRegisters(loadTextFixture("register-decode-stock").text);
  const fork = parseIoRegisters(loadTextFixture("register-decode-fork").text);
  assert.equal(stock.ok, true);
  assert.equal(fork.ok, true);
  if (!stock.ok || !fork.ok) return;

  assert.equal(stock.value.sections[0]!.dump.bytes.length, 64);
  assert.equal(fork.value.sections[0]!.dump.bytes.length, 64);
  assert.equal(stock.value.sections[0]!.dump.baseAddress, 0xd000);

  // $D020 is offset 0x20 (32) from the $D000 base -- the first byte of the
  // third dump row. MEASURED (diff of the two committed fixtures): this
  // byte is UNCHANGED between stock and fork; only the raster-related
  // fields (row 2's bytes, the "Raster cycle/line" prose, and VC/VCBASE/
  // Phi1) differ.
  const stockBorderByte = stock.value.sections[0]!.dump.bytes[0x20];
  const forkBorderByte = fork.value.sections[0]!.dump.bytes[0x20];
  assert.equal(stockBorderByte, forkBorderByte, "expected the $D020 dump byte to be identical across both captures");
  assert.equal(stockBorderByte, 0xfe);
  // The decoded prose's border colour is this same byte's low nibble.
  assert.equal(stock.value.sections[0]!.decoded.borderColor, 0x0e);
  assert.equal(fork.value.sections[0]!.decoded.borderColor, 0x0e);
});

test("the two captures' raster positions differ -- recorded as a finding (fixtures/textmon/README.md's own measured divergence), never normalized", () => {
  const stock = parseIoRegisters(loadTextFixture("register-decode-stock").text);
  const fork = parseIoRegisters(loadTextFixture("register-decode-fork").text);
  assert.equal(stock.ok, true);
  assert.equal(fork.ok, true);
  if (!stock.ok || !fork.ok) return;

  const stockRaster = stock.value.sections[0]!.decoded;
  const forkRaster = fork.value.sections[0]!.decoded;
  const differs = stockRaster.rasterCycle !== forkRaster.rasterCycle || stockRaster.rasterLine !== forkRaster.rasterLine;
  assert.ok(
    differs,
    `expected the raster cycle/line to differ between captures (finding, not normalized): ` +
      `stock=${stockRaster.rasterCycle}/${stockRaster.rasterLine}, fork=${forkRaster.rasterCycle}/${forkRaster.rasterLine}`,
  );
});

test("every sprite-table row decodes to exactly eight columns, for both real captures", () => {
  const stock = parseIoRegisters(loadTextFixture("register-decode-stock").text);
  const fork = parseIoRegisters(loadTextFixture("register-decode-fork").text);
  assert.equal(stock.ok, true);
  assert.equal(fork.ok, true);
  if (!stock.ok || !fork.ok) return;

  for (const result of [stock.value, fork.value]) {
    assert.equal(result.sections[0]!.sprites.columns, 8);
    assert.equal(result.sections[0]!.sprites.rows.length, 10);
    for (const row of result.sections[0]!.sprites.rows) {
      assert.equal(row.values.length, 8, `row ${row.label} must have exactly 8 values`);
    }
  }
});

test("the sprite table's X-Pos row -- which has NO separating space between adjacent values in the real capture -- still decodes to eight distinct $000-shaped values, proving header-derived slicing rather than a whitespace split", () => {
  const stock = parseIoRegisters(loadTextFixture("register-decode-stock").text);
  assert.equal(stock.ok, true);
  if (!stock.ok) return;
  const xPosRow = stock.value.sections[0]!.sprites.rows.find((r) => r.label === "X-Pos");
  assert.ok(xPosRow);
  assert.deepEqual(xPosRow!.values, ["$000", "$000", "$000", "$000", "$000", "$000", "$000", "$000"]);
});

test("no unrecognised lines for a well-formed real capture -- unrecognisedLines is empty for both real captures", () => {
  const stock = parseIoRegisters(loadTextFixture("register-decode-stock").text);
  const fork = parseIoRegisters(loadTextFixture("register-decode-fork").text);
  assert.equal(stock.ok, true);
  assert.equal(fork.ok, true);
  if (!stock.ok || !fork.ok) return;
  assert.deepEqual(stock.value.unrecognisedLines, []);
  assert.deepEqual(fork.value.unrecognisedLines, []);
});

// ---------------------------------------------------------------------------
// Every refusal-code arm, including the two degradation outcomes.
// ---------------------------------------------------------------------------

test('parseIoRegisters("") returns ok:false with the empty-response code -- never a zero-section reply', () => {
  const result = parseIoRegisters("");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseIoRegisters: a whitespace-only payload returns the same empty-response code", () => {
  const result = parseIoRegisters("   \n\n  ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseIoRegisters: a payload consisting only of the trailing prompt returns the empty-response code", () => {
  const result = parseIoRegisters("(C:$d040) ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test('source-traced (monitor.c:1980-2000, not live-observed): a payload of VICE\'s own "No details available." degradation line returns its own named no-details-available outcome carrying the observed string, never an empty successful decode', () => {
  const result = parseIoRegisters("No details available.\n(C:$d040) ");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "no-details-available");
    assert.match(result.refusal.message, /No details available\./);
  }
});

test('source-traced (monitor.c:1980-2000, not live-observed): a payload of VICE\'s own "No I/O regs available" degradation line returns its own named no-io-regs-available outcome carrying the observed string, never an empty successful decode', () => {
  const result = parseIoRegisters("No I/O regs available\n(C:$d040) ");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "no-io-regs-available");
    assert.match(result.refusal.message, /No I\/O regs available/);
  }
});

// ---------------------------------------------------------------------------
// Planted controls -- each mutates the REAL stock capture text at exactly
// one point, and each is paired with the discriminating assertion that
// both unchanged real captures still parse cleanly.
// ---------------------------------------------------------------------------

let cachedStockParsesOk: boolean | undefined;
let cachedForkParsesOk: boolean | undefined;

function assertRealCapturesStillParseCleanly(): void {
  if (cachedStockParsesOk === undefined) {
    cachedStockParsesOk = parseIoRegisters(loadTextFixture("register-decode-stock").text).ok;
  }
  if (cachedForkParsesOk === undefined) {
    cachedForkParsesOk = parseIoRegisters(loadTextFixture("register-decode-fork").text).ok;
  }
  assert.equal(cachedStockParsesOk, true, "discriminating control: the real stock capture must still parse cleanly (unchanged parser)");
  assert.equal(cachedForkParsesOk, true, "discriminating control: the real fork capture must still parse cleanly (unchanged parser)");
}

function realStockText(): string {
  return loadTextFixture("register-decode-stock").text;
}

test("planted control: a dump row with a non-hex byte refuses with the malformed-dump code -- paired with the real-capture discriminating control", () => {
  const mutated = realStockText().replace(
    ">C:d030  ff ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................",
    ">C:d030  zz ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................",
  );
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "malformed-dump");
  assertRealCapturesStillParseCleanly();
});

test("planted control: a dump row with other than sixteen values refuses with the malformed-dump code -- paired with the real-capture discriminating control", () => {
  const mutated = realStockText().replace(
    ">C:d030  ff ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................",
    ">C:d030  ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................",
  );
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "malformed-dump");
  assertRealCapturesStillParseCleanly();
});

test("planted control: a memspace marker other than the main CPU's refuses with unrecognised-memspace, naming the vice_device_console reset remedy -- paired with the real-capture discriminating control", () => {
  const mutated = realStockText().replace(">C:d000", ">D:d000");
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "unrecognised-memspace");
    assert.match(result.refusal.message, /vice_device_console/);
  }
  assertRealCapturesStillParseCleanly();
});

test("planted control: a recognised label with an unparseable value refuses with unparseable-value, naming the label -- paired with the real-capture discriminating control", () => {
  const mutated = realStockText().replace("Raster cycle/line: 0/311 IRQ: 311", "Raster cycle/line: 0/311 IRQ: zzz");
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "unparseable-value");
    assert.match(result.refusal.message, /Raster cycle\/line/);
  }
  assertRealCapturesStillParseCleanly();
});

test("planted control: a sprite row whose label is outside the closed ten-label set refuses with unrecognised-sprite-row -- paired with the real-capture discriminating control", () => {
  const mutated = realStockText().replace(
    "Color:     1   2   3   4   5   6   7   c",
    "Bogus1:    1   2   3   4   5   6   7   c",
  );
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "unrecognised-sprite-row");
  assertRealCapturesStillParseCleanly();
});

test("planted control: a Sprites: header declaring other than eight columns refuses with sprite-column-count -- paired with the real-capture discriminating control", () => {
  const mutated = realStockText().replace(
    "Sprites: S.0 S.1 S.2 S.3 S.4 S.5 S.6 S.7",
    "Sprites: S.0 S.1 S.2 S.3 S.4 S.5 S.6",
  );
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "sprite-column-count");
  assertRealCapturesStillParseCleanly();
});

test("planted control: an unrecognised decoded-prose line is preserved verbatim in unrecognisedLines and never populates a typed field", () => {
  const injected = "Unknown: something unexpected here";
  const mutated = realStockText().replace(
    "Mode: Standard Text (ECM/BMM/MCM=0/0/0)",
    `${injected}\nMode: Standard Text (ECM/BMM/MCM=0/0/0)`,
  );
  const result = parseIoRegisters(mutated);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.value.unrecognisedLines.includes(injected), `expected ${JSON.stringify(injected)} in unrecognisedLines`);
  // The typed decode is otherwise unaffected -- every other recognised
  // field decoded exactly as it does for the unmutated real capture.
  assert.equal(result.value.sections[0]!.decoded.rasterIrqLine, 311);
  assert.equal(result.value.sections[0]!.decoded.mode.name, "Standard Text");
  assertRealCapturesStillParseCleanly();
});

// ---------------------------------------------------------------------------
// Idempotency and concurrency.
// ---------------------------------------------------------------------------

test("idempotency: a second parse of the same input is deeply equal to the first", () => {
  const text = loadTextFixture("register-decode-stock").text;
  const first = parseIoRegisters(text);
  const second = parseIoRegisters(text);
  assert.deepEqual(first, second);
});

test("concurrency: interleaved parses of both binaries' captures equal their sequential results", async () => {
  const stockText = loadTextFixture("register-decode-stock").text;
  const forkText = loadTextFixture("register-decode-fork").text;

  const sequentialStock = parseIoRegisters(stockText);
  const sequentialFork = parseIoRegisters(forkText);

  const results: IoRegistersParseResult[] = await Promise.all([
    Promise.resolve().then(() => parseIoRegisters(stockText)),
    Promise.resolve().then(() => parseIoRegisters(forkText)),
    Promise.resolve().then(() => parseIoRegisters(stockText)),
    Promise.resolve().then(() => parseIoRegisters(forkText)),
  ]);

  assert.deepEqual(results[0], sequentialStock);
  assert.deepEqual(results[1], sequentialFork);
  assert.deepEqual(results[2], sequentialStock);
  assert.deepEqual(results[3], sequentialFork);
});
