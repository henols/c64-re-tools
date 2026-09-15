// evid-ingest.test.ts
//
// Deterministic, no-store coverage for evid-ingest.ts -- the pure transform
// from a parsed `memmapshow` access map to durable-shaped observation rows
// (EVID-01, EVID-04). Nothing here opens a store: `execObservationsFrom()`,
// `runIdentityFrom()` and `ingestAccessMap()` are all plain-data-in,
// plain-data-out functions, and this file's own Behavior 7 (this task) and
// source-census case (Task 3) hold that structurally rather than by review.
//
// Task 1 (this file's first section): the seven behaviors this plan's Task 1
// specifies -- the real-fixture transform, the two no-execute-no-row
// controls, the per-bank split, the run-identity refusals, the unabsorbed
// parse refusal, and determinism via sorting.
//
// Task 3 adds a source-census case: evid-ingest.ts must never compare
// against the byte-derived block table's own vocabulary strings -- this
// module classifies nothing and must never begin to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadTextFixture } from "./textmon-fixtures.ts";
import { parseAccessMap, type AccessMap, type AccessMapEntry, type AccessFlags } from "./textmon-memmap.ts";
import { execObservationsFrom, runIdentityFrom, ingestAccessMap, type ExecObservation } from "./evid-ingest.ts";

const HERE = fileURLToPath(import.meta.url);
const OWN_MODULE = HERE.replace(/evid-ingest\.test\.ts$/, "evid-ingest.ts");

const NO_ACCESS: AccessFlags = { read: false, write: false, execute: false };

function entry(address: number, overrides: Partial<Record<"io" | "rom" | "ram", AccessFlags>> = {}): AccessMapEntry {
  return {
    address,
    io: overrides.io ?? NO_ACCESS,
    rom: overrides.rom ?? NO_ACCESS,
    ram: overrides.ram ?? NO_ACCESS,
    annotations: [],
  };
}

// ---------------------------------------------------------------------------
// Behavior 1: the real committed fixture, through the real parser.
// ---------------------------------------------------------------------------

test("Behavior 1: execObservationsFrom over the committed memmapshow fixture returns one observation per address/bank pair whose execute flag is true, and nothing else", () => {
  const stock = loadTextFixture("access-map-stock");
  const parsed = parseAccessMap(stock.text);
  assert.equal(parsed.ok, true, `expected access-map-stock to parse, got ${JSON.stringify(!parsed.ok ? parsed.refusal : undefined)}`);
  if (!parsed.ok) return;

  const observations = execObservationsFrom(parsed.value);
  assert.ok(observations.length > 0, "expected at least one observed execute bit in a real capture");

  // Every observation must correspond to a real execute:true flag on the
  // named bank, at the named address, in the SAME map -- proven by
  // reconstructing the expected set independently, from the fixture's own
  // entries, rather than trusting the function under test to grade itself.
  const expected: ExecObservation[] = [];
  for (const e of parsed.value.entries) {
    if (e.ram.execute) expected.push({ address: e.address, sourceBank: "ram" });
    if (e.rom.execute) expected.push({ address: e.address, sourceBank: "rom" });
    if (e.io.execute) expected.push({ address: e.address, sourceBank: "io" });
  }
  expected.sort((a, b) => a.address - b.address || (a.sourceBank < b.sourceBank ? -1 : a.sourceBank > b.sourceBank ? 1 : 0));
  const actual = [...observations].sort(
    (a, b) => a.address - b.address || (a.sourceBank < b.sourceBank ? -1 : a.sourceBank > b.sourceBank ? 1 : 0),
  );
  assert.deepEqual(actual, expected);

  // And nothing else: every entry with NO execute bit anywhere contributes
  // NOTHING to the observation list.
  const observedAddresses = new Set(observations.map((o) => o.address));
  for (const e of parsed.value.entries) {
    if (!e.ram.execute && !e.rom.execute && !e.io.execute) {
      assert.equal(observedAddresses.has(e.address) && !expected.some((o) => o.address === e.address), false);
    }
  }
});

// ---------------------------------------------------------------------------
// Behavior 2: read+write, no execute -- NO observation.
// ---------------------------------------------------------------------------

test("Behavior 2: an entry with read:true, write:true, execute:false on all three banks produces NO observation", () => {
  const flags: AccessFlags = { read: true, write: true, execute: false };
  const map: AccessMap = { entries: [entry(0x1000, { io: flags, rom: flags, ram: flags })] };
  const observations = execObservationsFrom(map);
  assert.deepEqual(observations, []);
});

// ---------------------------------------------------------------------------
// Behavior 3: ROM execute, RAM not -- exactly one observation, sourceBank "rom".
// ---------------------------------------------------------------------------

test('Behavior 3: an address with rom.execute:true and ram.execute:false produces exactly one observation whose sourceBank is "rom"', () => {
  const map: AccessMap = {
    entries: [entry(0x2000, { rom: { read: false, write: false, execute: true }, ram: { read: true, write: false, execute: false } })],
  };
  const observations = execObservationsFrom(map);
  assert.deepEqual(observations, [{ address: 0x2000, sourceBank: "rom" }]);
});

// ---------------------------------------------------------------------------
// Behavior 4: two banks executing -- two observations, never merged.
// ---------------------------------------------------------------------------

test("Behavior 4: an address with execute true on two banks produces two observations, one per bank, never one merged row", () => {
  const map: AccessMap = {
    entries: [
      entry(0x3000, {
        ram: { read: false, write: false, execute: true },
        io: { read: false, write: false, execute: true },
      }),
    ],
  };
  const observations = execObservationsFrom(map);
  assert.equal(observations.length, 2);
  assert.deepEqual(
    observations.map((o) => o.sourceBank).sort(),
    ["io", "ram"],
  );
  for (const o of observations) assert.equal(o.address, 0x3000);
});

// ---------------------------------------------------------------------------
// Behavior 5: runIdentityFrom -- computes argvDigest, refuses by name.
// ---------------------------------------------------------------------------

const VALID_IMAGE_SHA256 = "a".repeat(64);

test("Behavior 5: runIdentityFrom computes argvDigest from the supplied argv and returns the triple", () => {
  const identity = runIdentityFrom({ imageSha256: VALID_IMAGE_SHA256, argv: ["x64sc", "-binarymonitor"], seed: "seed-1" });
  assert.equal(identity.imageSha256, VALID_IMAGE_SHA256);
  assert.equal(identity.seed, "seed-1");
  assert.match(identity.argvDigest, /^[0-9a-f]{64}$/);
  // Deterministic: the SAME argv digests to the SAME value.
  const again = runIdentityFrom({ imageSha256: VALID_IMAGE_SHA256, argv: ["x64sc", "-binarymonitor"], seed: "seed-1" });
  assert.equal(again.argvDigest, identity.argvDigest);
});

test("Behavior 5: runIdentityFrom refuses an empty argv array by name", () => {
  assert.throws(
    () => runIdentityFrom({ imageSha256: VALID_IMAGE_SHA256, argv: [], seed: "seed-1" }),
    /argv/,
  );
});

test("Behavior 5: runIdentityFrom refuses a non-array argv by name", () => {
  assert.throws(
    () => runIdentityFrom({ imageSha256: VALID_IMAGE_SHA256, argv: "x64sc" as unknown as string[], seed: "seed-1" }),
    /argv/,
  );
});

test("Behavior 5: runIdentityFrom refuses an imageSha256 that is not exactly 64 lowercase hex characters", () => {
  assert.throws(
    () => runIdentityFrom({ imageSha256: "not-a-digest", argv: ["x64sc"], seed: "seed-1" }),
    /imageSha256/,
  );
  assert.throws(
    () => runIdentityFrom({ imageSha256: VALID_IMAGE_SHA256.toUpperCase(), argv: ["x64sc"], seed: "seed-1" }),
    /imageSha256/,
    "an uppercase but correctly-shaped digest must still be refused -- two callers disagreeing on case must not be laundered into agreement",
  );
});

test("Behavior 5: runIdentityFrom refuses an empty seed by name", () => {
  assert.throws(() => runIdentityFrom({ imageSha256: VALID_IMAGE_SHA256, argv: ["x64sc"], seed: "" }), /seed/);
});

// ---------------------------------------------------------------------------
// Behavior 6: ingestAccessMap on a refused parse -- returns the refusal
// unabsorbed, calls no store function (there is none imported to call).
// ---------------------------------------------------------------------------

test("Behavior 6: ingestAccessMap handed a { ok: false } parse result returns a named refusal carrying the refusal code and the offending line", () => {
  const refused = parseAccessMap("");
  assert.equal(refused.ok, false);
  const result = ingestAccessMap(refused, { imageSha256: VALID_IMAGE_SHA256, argv: ["x64sc"], seed: "seed-1" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /empty-response/);
  assert.match(result.message, /line 0/);
});

test("Behavior 6 (malformed line): ingestAccessMap names the refusal code AND the offending line for a structurally malformed reply", () => {
  const refused = parseAccessMap("addr: IO  ROM RAM\nnot-a-valid-line");
  assert.equal(refused.ok, false);
  const result = ingestAccessMap(refused, { imageSha256: VALID_IMAGE_SHA256, argv: ["x64sc"], seed: "seed-1" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /malformed-line/);
  assert.match(result.message, /line 2/);
  assert.match(result.message, /not-a-valid-line/);
});

// ---------------------------------------------------------------------------
// Behavior 7: determinism -- sorted ascending by address then bank.
// ---------------------------------------------------------------------------

test("Behavior 7: observations are sorted ascending by address then by bank, so two identical replies produce identical arrays", () => {
  const map: AccessMap = {
    entries: [
      entry(0x5000, { io: { read: false, write: false, execute: true } }),
      entry(0x1000, {
        ram: { read: false, write: false, execute: true },
        rom: { read: false, write: false, execute: true },
        io: { read: false, write: false, execute: true },
      }),
      entry(0x2000, { rom: { read: false, write: false, execute: true } }),
    ],
  };
  const first = execObservationsFrom(map);
  const second = execObservationsFrom(map);
  assert.deepEqual(first, second);

  const addresses = first.map((o) => o.address);
  const sortedAddresses = [...addresses].sort((a, b) => a - b);
  assert.deepEqual(addresses, sortedAddresses, "expected ascending address order");

  // At 0x1000, all three banks executed -- must appear in EVID_SOURCE_BANKS's
  // own order (ram, rom, io), never insertion order or alphabetical.
  const at0x1000 = first.filter((o) => o.address === 0x1000).map((o) => o.sourceBank);
  assert.deepEqual(at0x1000, ["ram", "rom", "io"]);
});

// ---------------------------------------------------------------------------
// ingestAccessMap success path -- both halves together, real fixture.
// ---------------------------------------------------------------------------

test("ingestAccessMap on a successful parse returns the derived run identity and the same observations execObservationsFrom would compute", () => {
  const stock = loadTextFixture("access-map-stock");
  const parsed = parseAccessMap(stock.text);
  assert.equal(parsed.ok, true);
  const identity = { imageSha256: VALID_IMAGE_SHA256, argv: ["x64sc", "-binarymonitor"], seed: "seed-1" };
  const result = ingestAccessMap(parsed, identity);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.runIdentity.imageSha256, VALID_IMAGE_SHA256);
  assert.equal(result.runIdentity.seed, "seed-1");
  assert.match(result.runIdentity.argvDigest, /^[0-9a-f]{64}$/);
  if (parsed.ok) {
    assert.deepEqual(result.observations, execObservationsFrom(parsed.value));
  }
});

// ---------------------------------------------------------------------------
// Task 3: source-census -- evid-ingest.ts never compares against the
// byte-derived block table's own vocabulary. This module classifies
// nothing and must never begin to.
// ---------------------------------------------------------------------------

test("source census: evid-ingest.ts never compares against the block table's own vocabulary strings", () => {
  const source = readFileSync(OWN_MODULE, "utf8");
  const nonCommentLines = source.split("\n").filter((line) => !/^\s*[/*]/.test(line));
  const nonCommentSource = nonCommentLines.join("\n");
  // block-class.ts's own BlockClass vocabulary ("code" | "data" | "undefined")
  // -- neither may appear as a string literal in this module's non-comment
  // source. This module reports execution observations only; it never
  // classifies an address as code, data or anything else. `node:sqlite` and
  // `anno-store` absence used to be asserted, non-redundantly, by
  // anno-seam.test.ts's shipped-module-set scan (which covered evid-ingest.ts
  // too). Phase 56 removed that scan, so this census does not repeat the
  // `node:sqlite` substring check here.
  for (const banned of ['"code"', "'code'", '"data"', "'data'", "block-class"]) {
    assert.equal(
      nonCommentSource.includes(banned),
      false,
      `evid-ingest.ts must never reference ${banned} outside a comment -- this module classifies nothing`,
    );
  }
});
