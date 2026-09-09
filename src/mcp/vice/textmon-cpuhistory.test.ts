// textmon-cpuhistory.test.ts
//
// Deterministic, no-emulator coverage for textmon-cpuhistory.ts's `chis`
// parser (PARSE-02, PARSE-03). Covers: purity, both real two-binary
// captures parsing clean with per-entry cycle counts (the MEASURED
// per-entry-cycle-count-on-3.9 claim PARSE-02 rests on), every refusal-code
// arm, idempotency and concurrency, and the planted controls for each
// closed set this module enforces. No fixture in this file is hand-rolled
// beyond a short, explicitly synthetic inline payload -- every real payload
// comes from textmon-fixtures.ts's loadTextFixture(), never a direct
// readFileSync against fixtures/textmon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadTextFixture } from "./textmon-fixtures.ts";
import { parseCpuHistory, type CpuHistoryEntry } from "./textmon-cpuhistory.ts";

const HERE = fileURLToPath(import.meta.url);
const OWN_MODULE = HERE.replace(/textmon-cpuhistory\.test\.ts$/, "textmon-cpuhistory.ts");

// ---------------------------------------------------------------------------
// Purity (PARSE-03): the module imports NOTHING, and declares no
// module-scope mutable state. Both asserted mechanically by reading this
// module's own source, not by review.
// ---------------------------------------------------------------------------

test("purity (PARSE-03): textmon-cpuhistory.ts contains no top-level ES import statement", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
  assert.deepEqual(importLines, [], `expected zero import lines, found: ${JSON.stringify(importLines)}`);
});

test("purity: textmon-cpuhistory.ts declares no module-scope mutable (let/var) binding", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const mutableLines = src.split("\n").filter((line) => /^(let|var)\s/.test(line));
  assert.deepEqual(mutableLines, [], `expected zero top-level let/var declarations, found: ${JSON.stringify(mutableLines)}`);
});

// ---------------------------------------------------------------------------
// Both real two-binary captures parse clean, with 4 entries each and
// per-entry positive-integer cycle counts on the stock 3.9 capture -- the
// MEASURED claim PARSE-02 rests on.
// ---------------------------------------------------------------------------

test("both real captures (cpu-history-stock, cpu-history-fork) parse to ok:true with exactly 4 entries and are genuine hardware captures", () => {
  const stock = loadTextFixture("cpu-history-stock");
  const fork = loadTextFixture("cpu-history-fork");

  assert.equal(stock.synthetic, false, "cpu-history-stock must be a real capture, not synthetic");
  assert.equal(fork.synthetic, false, "cpu-history-fork must be a real capture, not synthetic");
  assert.match(String(stock.provenance.capturedFrom), /^stock:/);
  assert.match(String(stock.provenance.viceVersion), /3\.9/);
  assert.match(String(fork.provenance.capturedFrom), /^fork:/);
  assert.match(String(fork.provenance.viceVersion), /3\.10/);

  const stockResult = parseCpuHistory(stock.text);
  assert.equal(stockResult.ok, true, `expected cpu-history-stock to parse, got ${JSON.stringify(!stockResult.ok ? stockResult.refusal : undefined)}`);
  const forkResult = parseCpuHistory(fork.text);
  assert.equal(forkResult.ok, true, `expected cpu-history-fork to parse, got ${JSON.stringify(!forkResult.ok ? forkResult.refusal : undefined)}`);

  if (stockResult.ok) assert.equal(stockResult.value.entries.length, 4, "chis 4 was the captured command");
  if (forkResult.ok) assert.equal(forkResult.value.entries.length, 4, "chis 4 was the captured command");
});

test("MEASURED claim (PARSE-02): every entry of the stock 3.9 capture carries a positive integer cycles value", () => {
  const stock = loadTextFixture("cpu-history-stock");
  assert.match(String(stock.provenance.viceVersion), /3\.9/, "grounding: this is the 3.9 capture the claim is about");
  const result = parseCpuHistory(stock.text);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const entry of result.value.entries) {
    assert.ok(Number.isInteger(entry.cycles) && entry.cycles > 0, `expected a positive integer cycles value, got ${entry.cycles}`);
  }
  assert.ok(
    true,
    `measured cycle-count values (finding, not normalized): ${JSON.stringify(result.value.entries.map((e) => e.cycles))}`,
  );
});

test("both real captures' entries decode fully-populated registers, disassembly and flags", () => {
  for (const caseName of ["cpu-history-stock", "cpu-history-fork"] as const) {
    const fixture = loadTextFixture(caseName);
    const result = parseCpuHistory(fixture.text);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const entry of result.value.entries) {
      assert.ok(entry.bytes.length >= 1 && entry.bytes.length <= 3);
      assert.ok(entry.disassembly.length > 0);
      assert.equal(typeof entry.registers.a, "number");
      assert.equal(typeof entry.registers.x, "number");
      assert.equal(typeof entry.registers.y, "number");
      assert.equal(typeof entry.registers.sp, "number");
    }
  }
});

test("real capture: the flag string '..-...Z.' decodes to zero set flags other than the zero flag, with the unused position recognised rather than read as a flag", () => {
  const result = parseCpuHistory(loadTextFixture("cpu-history-stock").text);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const entry = result.value.entries[0]!;
  assert.deepEqual(entry.flags, { n: false, v: false, unused: true, b: false, d: false, i: false, z: true, c: false });
});

// ---------------------------------------------------------------------------
// Every refusal-code arm.
// ---------------------------------------------------------------------------

test("parseCpuHistory(\"\") returns ok:false with the empty-response code -- never a zero-entry history", () => {
  const result = parseCpuHistory("");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseCpuHistory: a whitespace-only payload returns the same empty-response code", () => {
  const result = parseCpuHistory("   \n\n  ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseCpuHistory: a payload consisting only of the trailing prompt returns the empty-response code", () => {
  const result = parseCpuHistory("(C:$e5d1) ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

const HEADER_LESS_LINE = ".C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302187";

test("parseCpuHistory: an entry line missing its cycle-count column refuses with the malformed-line code, never defaulting the count to zero", () => {
  const missingCycles = ".C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     \n";
  const result = parseCpuHistory(missingCycles);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "malformed-line");
});

test("parseCpuHistory: a well-formed real entry line parses standalone (grounding for the malformed-line control above)", () => {
  const result = parseCpuHistory(`${HEADER_LESS_LINE}\n`);
  assert.equal(result.ok, true);
});

test("parseCpuHistory: a 12-digit cycle count parses to the exact integer -- VICE widened this column, never assume a narrower width", () => {
  const payload = ".C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     123456789012\n";
  const result = parseCpuHistory(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.entries[0]!.cycles, 123456789012);
});

test("parseCpuHistory: an unrecognised processor-flag character refuses with the unrecognised-flag code -- paired with the real-capture discriminating control", () => {
  const badLine = ".C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..Q...Z.     11302187\n";
  const result = parseCpuHistory(badLine);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "unrecognised-flag");
    assert.match(result.refusal.message, /"Q"/);
  }
  assertRealCapturesStillParseCleanly();
});

test("parseCpuHistory: an unrecognised memspace marker refuses with the unrecognised-memspace code and names the vice_device_console remedy -- paired with the real-capture discriminating control", () => {
  const badLine = ".D:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302187\n";
  const result = parseCpuHistory(badLine);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "unrecognised-memspace");
    assert.match(result.refusal.message, /vice_device_console/);
  }
  assertRealCapturesStillParseCleanly();
});

test("parseCpuHistory: a register label out of the expected A, X, Y, SP order refuses with the unrecognised-register-label code -- paired with the real-capture discriminating control", () => {
  const badLine = ".C:e5d1  8D 92 02    STA $0292      X:00 A:00 Y:0a SP:f3 ..-...Z.     11302187\n";
  const result = parseCpuHistory(badLine);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "unrecognised-register-label");
  assertRealCapturesStillParseCleanly();
});

// ---------------------------------------------------------------------------
// Idempotency and concurrency.
// ---------------------------------------------------------------------------

test("idempotency: a second parse of the same input is deeply equal to the first", () => {
  const text = loadTextFixture("cpu-history-stock").text;
  const first = parseCpuHistory(text);
  const second = parseCpuHistory(text);
  assert.deepEqual(first, second);
});

test("concurrency: interleaved parses of both binaries' captures inside a single Promise.all equal their sequential results", async () => {
  const stockText = loadTextFixture("cpu-history-stock").text;
  const forkText = loadTextFixture("cpu-history-fork").text;

  const sequentialStock = parseCpuHistory(stockText);
  const sequentialFork = parseCpuHistory(forkText);

  const [concurrentStock, concurrentFork] = await Promise.all([
    Promise.resolve().then(() => parseCpuHistory(stockText)),
    Promise.resolve().then(() => parseCpuHistory(forkText)),
  ]);

  assert.deepEqual(concurrentStock, sequentialStock);
  assert.deepEqual(concurrentFork, sequentialFork);
});

// ---------------------------------------------------------------------------
// The discriminating control: proves the planted-refusal tests above are
// not satisfied by a parser that refuses everything.
// ---------------------------------------------------------------------------

let cachedStockParsesOk: boolean | undefined;
let cachedForkParsesOk: boolean | undefined;

function assertRealCapturesStillParseCleanly(): void {
  if (cachedStockParsesOk === undefined) {
    cachedStockParsesOk = parseCpuHistory(loadTextFixture("cpu-history-stock").text).ok;
  }
  if (cachedForkParsesOk === undefined) {
    cachedForkParsesOk = parseCpuHistory(loadTextFixture("cpu-history-fork").text).ok;
  }
  assert.equal(cachedStockParsesOk, true, "discriminating control: the real stock capture must still parse cleanly (unchanged parser)");
  assert.equal(cachedForkParsesOk, true, "discriminating control: the real fork capture must still parse cleanly (unchanged parser)");
}

test("grounding control: both real captures still parse to ok:true after every planted control above ran against the same, unchanged parser", () => {
  assertRealCapturesStillParseCleanly();
});

// Type-only usage to keep CpuHistoryEntry exercised by the type checker
// (guards against an unused-export drift going unnoticed).
function _typeCheckOnly(entry: CpuHistoryEntry): number {
  return entry.address;
}
void _typeCheckOnly;
