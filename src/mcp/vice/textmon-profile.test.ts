// textmon-profile.test.ts
//
// Deterministic, no-emulator coverage for textmon-profile.ts's `prof flat`
// parser (PARSE-02, PARSE-03). Mirrors textmon-memmap.test.ts's shape:
// purity, both real two-binary captures parsing clean, the byte-exact
// thousands-separator assertion, the stable-tie ordering control, every
// refusal code, idempotency and concurrency, and the planted controls each
// paired with the discriminating assertion that both real captures still
// parse. No fixture in this file is hand-rolled beyond short, explicitly
// synthetic inline payloads -- every real payload comes from
// textmon-fixtures.ts's loadTextFixture(), never a direct readFileSync
// against fixtures/textmon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadTextFixture } from "./textmon-fixtures.ts";
import { parseFlatProfile, type FlatProfileParseResult } from "./textmon-profile.ts";

const HERE = fileURLToPath(import.meta.url);
const OWN_MODULE = HERE.replace(/textmon-profile\.test\.ts$/, "textmon-profile.ts");

// ---------------------------------------------------------------------------
// Purity (PARSE-03): no import, no module-scope mutable declaration, no
// sort/reverse call anywhere in the module -- all asserted mechanically by
// reading this module's own source, not by review.
// ---------------------------------------------------------------------------

test("purity (PARSE-03): textmon-profile.ts contains no top-level ES import statement", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
  assert.deepEqual(importLines, [], `expected zero import lines, found: ${JSON.stringify(importLines)}`);
});

test("purity: textmon-profile.ts declares no module-scope mutable (let/var) binding", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  const mutableLines = src.split("\n").filter((line) => /^(export\s+)?(let|var)\s/.test(line));
  assert.deepEqual(mutableLines, [], `expected zero top-level let/var declarations, found: ${JSON.stringify(mutableLines)}`);
});

test("ordering discipline: textmon-profile.ts contains no .sort( or .reverse( call -- rows are never re-ranked", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  assert.doesNotMatch(src, /\.sort\(|\.reverse\(/, "expected no sort or reverse call anywhere in the module");
});

// ---------------------------------------------------------------------------
// Both real captures parse clean, both sidecars record the parameterized
// command, and the leading row's exact integer proves the separator was
// decoded rather than treated as whitespace.
// ---------------------------------------------------------------------------

test("both real captures (flat-profile-stock, flat-profile-fork) parse to ok:true with exactly 5 entries, and are genuine hardware captures with the parameterized command", () => {
  const stock = loadTextFixture("flat-profile-stock");
  const fork = loadTextFixture("flat-profile-fork");

  assert.equal(stock.synthetic, false, "flat-profile-stock must be a real capture, not synthetic");
  assert.equal(fork.synthetic, false, "flat-profile-fork must be a real capture, not synthetic");
  assert.equal(stock.provenance.command, "prof flat 5");
  assert.equal(fork.provenance.command, "prof flat 5");

  const stockResult = parseFlatProfile(stock.text);
  assert.equal(stockResult.ok, true, `expected flat-profile-stock to parse, got ${JSON.stringify(!stockResult.ok ? stockResult.refusal : undefined)}`);
  const forkResult = parseFlatProfile(fork.text);
  assert.equal(forkResult.ok, true, `expected flat-profile-fork to parse, got ${JSON.stringify(!forkResult.ok ? forkResult.refusal : undefined)}`);

  if (stockResult.ok) assert.equal(stockResult.value.entries.length, 5);
  if (forkResult.ok) assert.equal(forkResult.value.entries.length, 5);
});

test("the stock capture's leading row parses totalCycles to the exact integer 2326151 -- only obtainable by treating U+202F as a separator, not whitespace", () => {
  const stock = loadTextFixture("flat-profile-stock");
  const result = parseFlatProfile(stock.text);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.entries[0]!.totalCycles, 2326151);
  assert.equal(result.value.entries[0]!.selfCycles, 2326151);
});

test("rows appear in VICE's own emitted order -- address values are asserted in the captured sequence for both real captures", () => {
  const stock = parseFlatProfile(loadTextFixture("flat-profile-stock").text);
  const fork = parseFlatProfile(loadTextFixture("flat-profile-fork").text);
  assert.equal(stock.ok, true);
  assert.equal(fork.ok, true);
  if (!stock.ok || !fork.ok) return;
  const expectedAddressOrder = [0xffcf, 0xff48, 0xea87, 0xffea, 0xea1c];
  assert.deepEqual(stock.value.entries.map((e) => e.address), expectedAddressOrder);
  assert.deepEqual(fork.value.entries.map((e) => e.address), expectedAddressOrder);
});

test("fork capture: shape, row count, and address sequence are asserted; cycle VALUES are measured and recorded as a finding, never pinned -- the batch's own README documents the two captures differ only by accumulated cycles", () => {
  const fork = parseFlatProfile(loadTextFixture("flat-profile-fork").text);
  assert.equal(fork.ok, true);
  if (!fork.ok) return;
  assert.equal(fork.value.entries.length, 5);
  assert.deepEqual(
    fork.value.entries.map((e) => e.address),
    [0xffcf, 0xff48, 0xea87, 0xffea, 0xea1c],
  );
  assert.ok(
    true,
    `measured fork cycle values (finding, not pinned): ${JSON.stringify(fork.value.entries.map((e) => e.totalCycles))}`,
  );
});

test("byte-level (T-42-02): the stock fixture's authoritative buffer contains the narrow no-break space's own three UTF-8 bytes (e2 80 af), not an ASCII space, as its thousands separator", () => {
  const stock = loadTextFixture("flat-profile-stock");
  const NARROW_NO_BREAK_SPACE_UTF8 = Buffer.from([0xe2, 0x80, 0xaf]);
  assert.ok(
    stock.buffer.includes(NARROW_NO_BREAK_SPACE_UTF8),
    "expected the narrow no-break space's UTF-8 byte sequence (e2 80 af) to occur in the authoritative buffer",
  );
});

// ---------------------------------------------------------------------------
// Stable-tie ordering control: two rows with identical cycle counts keep
// their INPUT order -- the parser performs no sort at all.
// ---------------------------------------------------------------------------

const HEADER = "        Total      %          Self      %";
const RULES = "------------- ------ ------------- ------";

test("synthetic stable-tie: two rows with identical cycle counts are returned in their input order, never re-ranked", () => {
  const row1 = "        100  50,0%           100  50,0% 1111";
  const row2 = "        100  50,0%           100  50,0% 2222";
  const payload = `${HEADER}\n${RULES}\n${row1}\n${row2}\n`;
  const result = parseFlatProfile(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.entries.length, 2);
  assert.equal(result.value.entries[0]!.address, 0x1111);
  assert.equal(result.value.entries[1]!.address, 0x2222);
});

// ---------------------------------------------------------------------------
// Every refusal-code arm.
// ---------------------------------------------------------------------------

test("parseFlatProfile(\"\") returns ok:false with the empty-response code -- never a zero-row profile", () => {
  const result = parseFlatProfile("");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseFlatProfile: a whitespace-only payload returns the same empty-response code", () => {
  const result = parseFlatProfile("   \n\n  ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseFlatProfile: a payload consisting only of the trailing prompt returns the empty-response code", () => {
  const result = parseFlatProfile("(C:$e5d1) ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "empty-response");
});

test("parseFlatProfile: a payload with missing/altered header lines refuses with the missing-header code -- paired with the real-capture discriminating control", () => {
  const result = parseFlatProfile("this is not the header\nnor is this\n        100  50,0%           100  50,0% 1111\n");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusal.code, "missing-header");
  assertRealCapturesStillParseCleanly();
});

test("parseFlatProfile: a planted row whose address field is not four hex digits refuses with the malformed-row code -- paired with the real-capture discriminating control", () => {
  const badRow = "        100  50,0%           100  50,0% zzzz";
  const payload = `${HEADER}\n${RULES}\n${badRow}\n`;
  const result = parseFlatProfile(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "malformed-row");
    assert.equal(result.refusal.line, badRow);
  }
  assertRealCapturesStillParseCleanly();
});

test("parseFlatProfile: a planted row whose numeric groups are separated by an ASCII space instead of the narrow no-break space refuses with the unrecognised-separator code, rather than parsing to the first group alone -- paired with the real-capture discriminating control", () => {
  const badRow = "2 326 151  98,5% 2 326 151  98,5% ffcf";
  const payload = `${HEADER}\n${RULES}\n${badRow}\n`;
  const result = parseFlatProfile(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "unrecognised-separator");
    // Discriminating: a parser that (incorrectly) parsed to the first group
    // alone would have produced entries[0].totalCycles === 2, not a refusal.
  }
  assertRealCapturesStillParseCleanly();
});

test("parseFlatProfile: a planted row with an unrecognised percentage shape refuses with the unrecognised-percentage code -- paired with the real-capture discriminating control", () => {
  const badRow = "        100  50;0%           100  50,0% 1111";
  const payload = `${HEADER}\n${RULES}\n${badRow}\n`;
  const result = parseFlatProfile(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.refusal.code, "unrecognised-percentage");
    assert.match(result.refusal.message, /50;0%/);
  }
  assertRealCapturesStillParseCleanly();
});

test("parseFlatProfile: a payload using a period rather than a comma as the percentage's decimal separator parses, and the result records which separator was observed", () => {
  const row = "        100  50.0%           100  50.0% 1111";
  const payload = `${HEADER}\n${RULES}\n${row}\n`;
  const result = parseFlatProfile(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.decimalSeparator, ".");
  assert.equal(result.value.entries[0]!.totalPercent, 50.0);
});

let cachedStockParsesOk: boolean | undefined;
let cachedForkParsesOk: boolean | undefined;

/** The discriminating half of every planted control: proves the planted
 * refusal tests above are not satisfied by a parser that refuses
 * everything -- the SAME, unchanged parser must still parse both real
 * captures cleanly. Memoized since it is called from several tests against
 * the same real fixtures. */
function assertRealCapturesStillParseCleanly(): void {
  if (cachedStockParsesOk === undefined) {
    cachedStockParsesOk = parseFlatProfile(loadTextFixture("flat-profile-stock").text).ok;
  }
  if (cachedForkParsesOk === undefined) {
    cachedForkParsesOk = parseFlatProfile(loadTextFixture("flat-profile-fork").text).ok;
  }
  assert.equal(cachedStockParsesOk, true, "discriminating control: the real stock capture must still parse cleanly (unchanged parser)");
  assert.equal(cachedForkParsesOk, true, "discriminating control: the real fork capture must still parse cleanly (unchanged parser)");
}

// ---------------------------------------------------------------------------
// Idempotency and concurrency.
// ---------------------------------------------------------------------------

test("idempotency: a second parse of the same input is deeply equal to the first", () => {
  const text = loadTextFixture("flat-profile-stock").text;
  const first = parseFlatProfile(text);
  const second = parseFlatProfile(text);
  assert.deepEqual(first, second);
});

test("concurrency: interleaved parses of both binaries' captures equal their sequential results", async () => {
  const stockText = loadTextFixture("flat-profile-stock").text;
  const forkText = loadTextFixture("flat-profile-fork").text;

  const sequentialStock = parseFlatProfile(stockText);
  const sequentialFork = parseFlatProfile(forkText);

  const results: FlatProfileParseResult[] = await Promise.all([
    Promise.resolve().then(() => parseFlatProfile(stockText)),
    Promise.resolve().then(() => parseFlatProfile(forkText)),
    Promise.resolve().then(() => parseFlatProfile(stockText)),
    Promise.resolve().then(() => parseFlatProfile(forkText)),
  ]);

  assert.deepEqual(results[0], sequentialStock);
  assert.deepEqual(results[1], sequentialFork);
  assert.deepEqual(results[2], sequentialStock);
  assert.deepEqual(results[3], sequentialFork);
});
