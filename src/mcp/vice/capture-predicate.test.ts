// capture-predicate.test.ts -- `CAP-02`'s and `REPRO-03`'s behavioural half:
// the run-equivalence predicate, the `$0000`/`$0001` port normalisation, the
// argv identity digest, and the three-term stop-identity oracle.
//
// THE ONE PROPERTY THIS FILE EXISTS TO PROVE: that the predicate can FAIL. A
// predicate that cannot fail passes every control put to it, and a fail-ability
// guard built on one proves nothing while looking green. So every assertion
// here that a comparison FAILS is paired, in the same test, with a
// clean-subject run that PASSES -- the red is then attributable to the plant
// rather than to the fixture, to the harness, or to an unrelated refusal firing
// first. A control that could not have gone green is not a control.
//
// `CAP-03`'s STRUCTURAL half lives in `capture-seam.test.ts`, deliberately
// separately: this file drives behaviour through the two modules' exported
// functions, that one reads their source text. Splitting them keeps each file's
// failure output about one kind of defect.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { codeOnly } from "./shipped-modules.ts";
import {
  argvDigest,
  bin8,
  CaptureComparisonError,
  compareCaptures,
  formatComparison,
  hex2,
  hex4,
  IMAGE_BYTES,
  normalisePorts,
  parseAllowList,
  popcount,
  TRANSIENT_ALLOW_LIST_CAP,
} from "./capture-predicate.ts";
import { compareStopIdentity, ORACLE_TERMS, StopOracleError } from "./stop-oracle.ts";
import type { StopIdentity } from "./stop-oracle.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** A full-length synthetic capture, filled with a repeatable pattern rather
 * than zeros: an all-zero pair would compare equivalent for the wrong reason,
 * and a bug that returned an empty or short buffer somewhere would be invisible
 * against a background of zeros. */
function syntheticImage(seed = 1): Uint8Array {
  const image = new Uint8Array(IMAGE_BYTES);
  for (let i = 0; i < IMAGE_BYTES; i++) image[i] = (i * 31 + seed * 7) & 0xff;
  return image;
}

/** A copy with the named addresses given the named values. Returns a COPY, and
 * never `image.slice()`: `Buffer.prototype.slice` is an alias for `subarray`,
 * so a `slice`-based helper would mutate the caller's buffer for exactly the
 * input type a real caller passes. */
function withBytes(image: Uint8Array, changes: Record<number, number>): Uint8Array {
  const copy = new Uint8Array(image);
  for (const [addr, value] of Object.entries(changes)) copy[Number(addr)] = value;
  return copy;
}

/** A committed-artifact-shaped allow-list over the given addresses. */
function allowListOf(addresses: number[]) {
  return parseAllowList({
    release: "synthetic-release",
    entries: addresses.map((address) => ({ address, pairs: ["run1-run2"] })),
  });
}

// ---------------------------------------------------------------------------
// 1. The committed contracts
// ---------------------------------------------------------------------------

test("the committed transient allow-list size cap is 64, and the oracle has four scalar terms", () => {
  // Pinned as literals rather than read from the modules and compared to
  // themselves: both numbers are PRE-COMMITMENTS, and a test that derived them
  // from the code would go green on any drift in either direction.
  assert.equal(TRANSIENT_ALLOW_LIST_CAP, 64);
  assert.equal(IMAGE_BYTES, 65536);
  assert.deepEqual([...ORACLE_TERMS], ["pc", "hitCount", "line", "cycle"]);
  assert.equal(ORACLE_TERMS.length, 4);
});

test("both new modules are in package.json files[], or every structural census over them is vacuous", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  for (const name of ["capture-predicate.ts", "stop-oracle.ts"]) {
    assert.equal(
      pkg.files.includes(name),
      true,
      `${name} must be listed: capture-seam.test.ts's census scans a set DERIVED from files[], so an unlisted module sits outside its scope entirely`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. The tracer: one synthetic pair through the predicate to a verdict
// ---------------------------------------------------------------------------

test("compareCaptures: three differing addresses, two allow-listed -- the third fails and the lists are ascending", () => {
  const a = syntheticImage();
  const b = withBytes(a, { 0x1000: 0x00, 0x2000: 0x00, 0x3000: 0x00 });
  // Deliberately supplied out of order, so an ascending output cannot come from
  // the input's ordering.
  const allowList = allowListOf([0x2000, 0x1000]);

  const r = compareCaptures(a, b, allowList);
  assert.equal(r.verdict, "not-equivalent");
  assert.equal(r.pass, false);
  assert.deepEqual(r.differing, [0x3000], "the address outside the allow-list is the divergence");
  assert.deepEqual(r.allowed, [0x1000, 0x2000], "the allow-listed addresses are reported ascending");
  assert.equal(r.allowListSize, 2);
  assert.equal(r.cap, 64);

  // The clean control on the SAME pair: make the third address agree and the
  // verdict flips. Without this half, the red above could be a blanket refusal.
  const c = withBytes(a, { 0x1000: 0x00, 0x2000: 0x00 });
  const clean = compareCaptures(a, c, allowList);
  assert.equal(clean.verdict, "equivalent");
  assert.equal(clean.pass, true);
  assert.deepEqual(clean.differing, []);
  assert.deepEqual(clean.allowed, [0x1000, 0x2000]);
});

test("compareStopIdentity: two identical stops are identical, and a differing frame line reports exactly that term", () => {
  const stop: StopIdentity = { pc: 0xea31, hitCount: 1, line: 257, cycle: 57 };
  const same = compareStopIdentity(stop, { ...stop });
  assert.equal(same.identical, true);
  assert.deepEqual(same.differingTerms, []);
  assert.equal(same.frameTermAsserted, true);

  const oneFrameOff = compareStopIdentity(stop, { ...stop, line: 258 });
  assert.equal(oneFrameOff.identical, false);
  assert.deepEqual(oneFrameOff.differingTerms, ["line"]);
});

// ---------------------------------------------------------------------------
// 3. Length refusals, and the copy guarantee
// ---------------------------------------------------------------------------

test("compareCaptures refuses an image of the wrong length, naming the length -- never a trivial equivalence", () => {
  const full = syntheticImage();
  // The clean control first, so the refusals below are attributable to the
  // length and not to the fixture.
  assert.equal(compareCaptures(full, syntheticImage(), []).verdict, "equivalent");

  assert.throws(
    () => compareCaptures(new Uint8Array(0), new Uint8Array(0), []),
    (err: unknown) => {
      assert.ok(err instanceof CaptureComparisonError);
      assert.match(err.message, /is 0 byte\(s\)/);
      assert.match(err.message, /65536/);
      return true;
    },
    "two zero-length buffers agree at every address they have -- refusing is the only honest answer",
  );
  assert.throws(() => compareCaptures(full, new Uint8Array(65535), []), /is 65535 byte\(s\)/);
  assert.throws(() => compareCaptures(new Uint8Array(65537), full, []), /is 65537 byte\(s\)/);
});

test("normalisePorts returns a COPY -- the caller's image is unchanged after the call", () => {
  const image = syntheticImage();
  const before = [image[0x0000], image[0x0001]];

  const out = normalisePorts(image, { dirRead: 47, dataRead: 55 });
  assert.equal(out.length, IMAGE_BYTES);
  assert.notEqual(out, image, "the returned image must not be the same object");
  assert.deepEqual(
    [image[0x0000], image[0x0001]],
    before,
    "writing the normalised ports must not reach the caller's buffer -- Buffer.prototype.slice is a VIEW, so a slice-based copy would land here",
  );

  // And the fields land at the right addresses: $0000 is DIRECTION, $0001 is
  // DATA. Two distinguishable values, so an address swap reds.
  assert.equal(out[0x0000], 47, "$0000 takes dirRead");
  assert.equal(out[0x0001], 55, "$0001 takes dataRead");
});

// ---------------------------------------------------------------------------
// 4. The argv identity digest
// ---------------------------------------------------------------------------

test("argvDigest is order-sensitive and refuses an empty array by name", () => {
  const ab = argvDigest(["a", "b"]);
  const ba = argvDigest(["b", "a"]);
  assert.notEqual(ab, ba, "an argv digest that is order-insensitive cannot key a reproducible run");
  assert.equal(argvDigest(["a", "b"]), ab, "and it is stable for the same input");
  assert.match(ab, /^[0-9a-f]{64}$/, "sha256, lowercase hex");

  assert.throws(
    () => argvDigest([]),
    (err: unknown) => {
      assert.ok(err instanceof CaptureComparisonError);
      assert.match(err.message, /empty argv array/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// 5. Module posture: pure, byte-taking, path-free, and reaching neither
//    path-translation seam nor each other
// ---------------------------------------------------------------------------

/** Every module specifier a source names, read from the source itself. Run with
 * literal bodies KEPT, because an import specifier IS a string literal --
 * blanking literal bodies would make the thing under assertion unobservable. */
function moduleSpecifiers(src: string): string[] {
  const code = codeOnly(src, true);
  return [...code.matchAll(/["']([^"'\n]*)["']/g)]
    .map((m) => m[1])
    .filter((s) => /^(node:|\.{1,2}\/)/.test(s));
}

test("neither module imports anything but node builtins -- no path-translation seam, and not each other", () => {
  const predicate = moduleSpecifiers(readFileSync(join(HERE, "capture-predicate.ts"), "utf8"));
  const oracle = moduleSpecifiers(readFileSync(join(HERE, "stop-oracle.ts"), "utf8"));

  // Pinned exactly rather than filtered: the point is that the closed set is
  // SHORT, and a filtered assertion would pass a module that added a seam
  // import the filter did not name.
  assert.deepEqual(predicate, ["node:crypto"], "the predicate needs sha256 and nothing else");
  assert.deepEqual(oracle, [], "the oracle is four scalars in, one record out -- it imports nothing at all");
});

test("no exported function in either module takes a filesystem path -- every one takes bytes, scalars or a parsed value", () => {
  // Read from the source rather than asserted in prose: the signature is the
  // property that keeps path traversal out of these modules' threat surface,
  // and a header sentence cannot notice when an edit falsifies it.
  //
  // Whitespace is normalised because a signature broken across lines is the
  // same signature; a trailing comma from a multi-line parameter list is
  // dropped for the same reason.
  const signaturesOf = (name: string): string[][] => {
    const code = codeOnly(readFileSync(join(HERE, name), "utf8"));
    return [...code.matchAll(/export function (\w+)\(([^)]*)\)/g)].map((m) => [
      m[1],
      m[2].replace(/\s+/g, " ").trim().replace(/,$/, ""),
    ]);
  };

  assert.deepEqual(signaturesOf("capture-predicate.ts"), [
    ["popcount", "n: number"],
    ["parseAllowList", "json: unknown"],
    ["normalisePorts", "image: Uint8Array, ports: PortReads"],
    ["compareCaptures", "a: Uint8Array, b: Uint8Array, allowList: TransientAllowList | readonly number[]"],
    ["formatComparison", "comparison: CaptureComparison, limit = 0"],
    ["argvDigest", "argv: readonly string[]"],
  ]);
  assert.deepEqual(signaturesOf("stop-oracle.ts"), [["compareStopIdentity", "a: StopIdentity, b: StopIdentity"]]);
});

test("the report vocabulary is carried across in kind: hex4, hex2, bin8 and popcount behave as compare.mjs's do", () => {
  assert.equal(hex4(0x1000), "$1000");
  assert.equal(hex4(0x00ff), "$00FF");
  assert.equal(hex2(0x2f), "$2F");
  assert.equal(bin8(0x37), "%00110111");
  assert.equal(popcount(0), 0);
  assert.equal(popcount(0x01), 1);
  assert.equal(popcount(0xff), 8);

  // And a rendered report names the verdict in that vocabulary.
  const a = syntheticImage();
  const b = withBytes(a, { 0x4000: 0x00 });
  const text = formatComparison(compareCaptures(a, b, []));
  assert.match(text, /VERDICT: not-equivalent/);
  assert.match(text, /\$4000/);
});

// ---------------------------------------------------------------------------
// 6. The oracle refuses a partial record
// ---------------------------------------------------------------------------

test("compareStopIdentity refuses a stop record missing a term, naming the term and the side", () => {
  const whole: StopIdentity = { pc: 0xea31, hitCount: 1, line: 257, cycle: 57 };
  // The clean control: the same shape, complete, compares fine.
  assert.equal(compareStopIdentity(whole, { ...whole }).identical, true);

  const partial = { pc: 0xea31, line: 257, cycle: 57 } as unknown as StopIdentity;
  assert.throws(
    () => compareStopIdentity(whole, partial),
    (err: unknown) => {
      assert.ok(err instanceof StopOracleError);
      assert.equal(err.term, "hitCount");
      assert.equal(err.side, "b");
      assert.match(err.message, /hitCount/);
      assert.match(err.message, /side b/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// 7. D-25's corpus-free half: the planted ONE-BIT control, with its clean
//    control in the same test
//
// The plant is one bit and not one byte, deliberately. `compare.mjs` -- the
// vocabulary ancestor this predicate replaces -- classifies a one-bit
// difference as "drift" and lets it PASS anywhere. A control planting a whole
// byte would go green against that inherited rule and prove nothing, which is
// exactly the vacuity this file's header is about.
// ---------------------------------------------------------------------------

test("planted ONE-BIT difference outside the allow-list FAILS, and the same pair before the plant PASSES", () => {
  const a = syntheticImage();

  // The clean control, first and on the same buffers: byte-identical images
  // compare equivalent. If this half ever reds, the plant below proves nothing.
  const identical = new Uint8Array(a);
  const clean = compareCaptures(a, identical, allowListOf([0x1000]));
  assert.equal(clean.verdict, "equivalent");
  assert.deepEqual(clean.differing, []);
  assert.deepEqual(clean.allowed, []);

  // Exactly ONE bit, at an address the allow-list does not name.
  const planted = new Uint8Array(a);
  planted[0x5000] = a[0x5000] ^ 0x01;
  assert.equal(popcount(a[0x5000] ^ planted[0x5000]), 1, "the plant must be one bit, or this control is the weaker one");

  const red = compareCaptures(a, planted, allowListOf([0x1000]));
  assert.equal(red.verdict, "not-equivalent", "a one-bit difference outside the allow-list must FAIL -- there is no drift tolerance here");
  assert.deepEqual(red.differing, [0x5000]);
  assert.equal(red.divergence[0].bits, 1, "and it is reported as one bit, which no verdict reads");
});

test("the predicate does not distinguish bit counts: a full-byte difference at the same address fails identically", () => {
  const a = syntheticImage();

  const oneBit = new Uint8Array(a);
  oneBit[0x5000] = a[0x5000] ^ 0x01;
  const wholeByte = new Uint8Array(a);
  wholeByte[0x5000] = a[0x5000] ^ 0xff;

  const r1 = compareCaptures(a, oneBit, []);
  const r8 = compareCaptures(a, wholeByte, []);
  assert.equal(r1.verdict, "not-equivalent");
  assert.equal(r8.verdict, "not-equivalent");
  assert.deepEqual(r1.differing, r8.differing, "the verdict and the reported address are the same at one bit and at eight");
  assert.equal(r1.divergence[0].bits, 1);
  assert.equal(r8.divergence[0].bits, 8);
});

test("planted ONE-BIT difference AT an allow-listed address is allowed -- proving the earlier red was not a blanket refusal", () => {
  const a = syntheticImage();
  const planted = new Uint8Array(a);
  planted[0x1000] = a[0x1000] ^ 0x01;

  const r = compareCaptures(a, planted, allowListOf([0x1000]));
  assert.equal(r.verdict, "equivalent", "the allow-list must actually do work, or the plant above reds for the wrong reason");
  assert.deepEqual(r.allowed, [0x1000]);
  assert.deepEqual(r.differing, []);

  // And the same plant with the address NOT allow-listed reds -- the pairing is
  // what attributes the green above to the allow-list rather than to the plant
  // having failed to land.
  const withoutList = compareCaptures(a, planted, []);
  assert.equal(withoutList.verdict, "not-equivalent");
  assert.deepEqual(withoutList.differing, [0x1000]);
});

// ---------------------------------------------------------------------------
// 8. The cap boundary, as a boundary -- and it VOIDS rather than warns
// ---------------------------------------------------------------------------

test("parseAllowList accepts exactly 64 entries and refuses 65, naming both numbers and returning no artifact", () => {
  const entriesOf = (n: number) =>
    Array.from({ length: n }, (_unused, i) => ({ address: 0x1000 + i, pairs: ["run1-run2"] }));

  // The clean control at the boundary itself: 64 is ACCEPTED. Without it, the
  // refusal below could be a list-length bug at any threshold.
  const atCap = parseAllowList({ release: "synthetic-release", entries: entriesOf(64) });
  assert.equal(atCap.entries.length, 64);
  assert.equal(atCap.addresses.length, 64);
  assert.equal(atCap.addresses[0], 0x1000, "and the derived address list is ascending");

  let artifact: unknown = "not-assigned";
  assert.throws(
    () => {
      artifact = parseAllowList({ release: "synthetic-release", entries: entriesOf(65) });
    },
    (err: unknown) => {
      assert.ok(err instanceof CaptureComparisonError);
      assert.match(err.message, /65/);
      assert.match(err.message, /64/);
      assert.match(err.message, /VOIDS the derivation/);
      return true;
    },
  );
  assert.equal(artifact, "not-assigned", "the cap VOIDS the derivation -- it must not warn and hand back a usable list");
});

test("compareCaptures refuses a bare allow-list array over the cap too, so the array form is not a widening route", () => {
  const a = syntheticImage();
  // Clean control: 64 addresses is accepted on the same route.
  const atCap = Array.from({ length: 64 }, (_unused, i) => 0x1000 + i);
  assert.equal(compareCaptures(a, new Uint8Array(a), atCap).verdict, "equivalent");

  assert.throws(() => compareCaptures(a, new Uint8Array(a), [...atCap, 0x2000]), /over the committed cap of 64/);
});

// ---------------------------------------------------------------------------
// 9. Range-shaped notation, refused BY NAME
// ---------------------------------------------------------------------------

test("parseAllowList refuses range-shaped entries by name, and the same addresses written individually parse", () => {
  // The clean control: the enumerated form of the very same addresses.
  const enumerated = parseAllowList({
    release: "synthetic-release",
    entries: [
      { address: 0x1000, pairs: ["run1-run2"] },
      { address: 0x1001, pairs: ["run1-run2"] },
      { address: 0x1002, pairs: ["run1-run2"] },
    ],
  });
  assert.deepEqual(enumerated.addresses, [0x1000, 0x1001, 0x1002]);

  // (a) a start/end span object
  assert.throws(
    () =>
      parseAllowList({
        release: "synthetic-release",
        entries: [{ start: 0x1000, end: 0x1002, pairs: ["run1-run2"] }],
      }),
    (err: unknown) => {
      assert.ok(err instanceof CaptureComparisonError);
      assert.match(err.message, /range-shaped key "start"/);
      assert.match(err.message, /ENUMERATED and is never a range/);
      return true;
    },
  );

  // (b) an address written as a two-element array used as a span
  assert.throws(
    () =>
      parseAllowList({
        release: "synthetic-release",
        entries: [{ address: [0x1000, 0x1002], pairs: ["run1-run2"] }],
      }),
    (err: unknown) => {
      assert.ok(err instanceof CaptureComparisonError);
      assert.match(err.message, /two-element array/);
      assert.match(err.message, /ENUMERATED and is never a range/);
      return true;
    },
  );
});

test("parseAllowList refuses a duplicate address, an out-of-range address and a missing release", () => {
  const base = { address: 0x1000, pairs: ["run1-run2"] };
  // Clean control on the same shape.
  assert.equal(parseAllowList({ release: "r", entries: [base] }).entries.length, 1);

  assert.throws(() => parseAllowList({ release: "r", entries: [base, { ...base }] }), /repeats address \$1000/);
  assert.throws(() => parseAllowList({ release: "r", entries: [{ address: 0x10000, pairs: [] }] }), /not an integer in 0\.\.65535/);
  assert.throws(() => parseAllowList({ release: "r", entries: [{ address: 1.5, pairs: [] }] }), /not an integer in 0\.\.65535/);
  assert.throws(() => parseAllowList({ release: "", entries: [] }), /must name the release/);
  assert.throws(() => parseAllowList({ release: "r" }), /must carry an entries array/);
  assert.throws(() => parseAllowList([base]), /must be a JSON object/);
});

// ---------------------------------------------------------------------------
// 10. Adjacency: the allow-list is a SET of addresses, never a neighbourhood
// ---------------------------------------------------------------------------

test("adjacency: with only $1000 allow-listed, $1000 is allowed while $0FFF and $1001 each fail", () => {
  const a = syntheticImage();
  const list = allowListOf([0x1000]);

  const on = new Uint8Array(a);
  on[0x1000] = a[0x1000] ^ 0x01;
  const onResult = compareCaptures(a, on, list);
  assert.equal(onResult.verdict, "equivalent");
  assert.deepEqual(onResult.allowed, [0x1000]);

  const below = new Uint8Array(a);
  below[0x0fff] = a[0x0fff] ^ 0x01;
  const belowResult = compareCaptures(a, below, list);
  assert.equal(belowResult.verdict, "not-equivalent", "one address below an allow-listed one is NOT allow-listed");
  assert.deepEqual(belowResult.differing, [0x0fff]);

  const above = new Uint8Array(a);
  above[0x1001] = a[0x1001] ^ 0x01;
  const aboveResult = compareCaptures(a, above, list);
  assert.equal(aboveResult.verdict, "not-equivalent", "and neither is one address above it");
  assert.deepEqual(aboveResult.differing, [0x1001]);
});

// ---------------------------------------------------------------------------
// 11. Empty and degenerate cases
// ---------------------------------------------------------------------------

test("an EMPTY allow-list is legal, and two byte-identical images compare equivalent under it", () => {
  const a = syntheticImage();
  const empty = parseAllowList({ release: "synthetic-release", entries: [] });
  assert.deepEqual(empty.addresses, []);

  const r = compareCaptures(a, new Uint8Array(a), empty);
  assert.equal(r.verdict, "equivalent");
  assert.equal(r.allowListSize, 0);
  assert.deepEqual(r.differing, []);
  assert.deepEqual(r.allowed, []);

  // And it is not a blanket pass: one planted bit under the empty list reds.
  const planted = new Uint8Array(a);
  planted[0x0400] = a[0x0400] ^ 0x01;
  assert.equal(compareCaptures(a, planted, empty).verdict, "not-equivalent");
});

test("a single-address allow-list over a zero-difference pair reports empty differing AND empty allowed", () => {
  const a = syntheticImage();
  const r = compareCaptures(a, new Uint8Array(a), allowListOf([0x1000]));
  assert.equal(r.verdict, "equivalent");
  assert.deepEqual(r.differing, []);
  assert.deepEqual(r.allowed, [], "an allow-listed address that did not differ is not reported as allowed");
  assert.equal(r.allowListSize, 1);
});

// ---------------------------------------------------------------------------
// 12. Ordering and symmetry
// ---------------------------------------------------------------------------

test("compareCaptures is symmetric in its two arguments, and differing is ascending by address", () => {
  const a = syntheticImage();
  // Planted out of address order, so an ascending result cannot come from the
  // order the plants were applied in.
  const b = withBytes(a, { 0x8000: 0x00, 0x0100: 0x00, 0xc000: 0x00 });

  const ab = compareCaptures(a, b, []);
  const ba = compareCaptures(b, a, []);
  assert.equal(ab.verdict, ba.verdict);
  assert.deepEqual(ab.differing, [0x0100, 0x8000, 0xc000]);
  assert.deepEqual(ba.differing, ab.differing, "the reported list must not depend on which image was passed first");

  // The per-row a/b values DO swap, which is the only asymmetry there should be.
  assert.equal(ab.divergence[0].a, ba.divergence[0].b);
});

test("the allowed list is ascending too, whatever order the allow-list enumerated", () => {
  const a = syntheticImage();
  const b = withBytes(a, { 0x0100: 0x00, 0x8000: 0x00, 0xc000: 0x00 });
  const list = allowListOf([0xc000, 0x0100, 0x8000]);
  const r = compareCaptures(a, b, list);
  assert.equal(r.verdict, "equivalent");
  assert.deepEqual(r.allowed, [0x0100, 0x8000, 0xc000]);
});

// ---------------------------------------------------------------------------
// 13. The port normalisation is load-bearing, proven by the pairing
// ---------------------------------------------------------------------------

test("a pair differing ONLY at $0000/$0001 is equivalent after normalisation and NOT equivalent without it", () => {
  const a = syntheticImage();
  // Two raster-position artefacts: the same machine state, two different phi1
  // bus values left in mem_ram[0]/mem_ram[1].
  const b = withBytes(a, { 0x0000: 0x11, 0x0001: 0x22 });
  const aAlt = withBytes(a, { 0x0000: 0x99, 0x0001: 0xaa });

  // WITHOUT normalisation: not equivalent, and both addresses are divergent.
  // This is the half that proves the normalisation below is doing the work.
  const raw = compareCaptures(aAlt, b, []);
  assert.equal(raw.verdict, "not-equivalent");
  assert.deepEqual(raw.differing, [0x0000, 0x0001]);

  // WITH normalisation, both sides carrying the same CPU-visible port reads.
  const ports = { dirRead: 47, dataRead: 55 };
  const normalised = compareCaptures(normalisePorts(aAlt, ports), normalisePorts(b, ports), []);
  assert.equal(normalised.verdict, "equivalent");
  assert.deepEqual(normalised.differing, []);

  // And the two addresses were NOT spent on the allow-list to get there.
  assert.equal(normalised.allowListSize, 0);
});

test("normalisePorts refuses a wrong-length image and a non-byte port value, naming what it saw", () => {
  const a = syntheticImage();
  // Clean control.
  assert.equal(normalisePorts(a, { dirRead: 0, dataRead: 255 }).length, IMAGE_BYTES);

  assert.throws(() => normalisePorts(new Uint8Array(4096), { dirRead: 47, dataRead: 55 }), /is 4096 byte\(s\)/);
  assert.throws(() => normalisePorts(a, { dirRead: 256, dataRead: 55 }), /byte values in 0\.\.255/);
  assert.throws(() => normalisePorts(a, { dirRead: -1, dataRead: 55 }), /byte values in 0\.\.255/);
});

// ---------------------------------------------------------------------------
// 14. The argv digest: NUL-joined, not space-joined
// ---------------------------------------------------------------------------

test("argvDigest is NUL-joined, so an argument containing a space is not the same as two arguments", () => {
  const oneArg = argvDigest(["a b"]);
  const twoArgs = argvDigest(["a", "b"]);
  assert.notEqual(
    oneArg,
    twoArgs,
    "a space join would collapse these two genuinely different argvs onto one digest",
  );
  assert.match(oneArg, /^[0-9a-f]{64}$/);
  assert.match(twoArgs, /^[0-9a-f]{64}$/);
  assert.equal(oneArg, oneArg.toLowerCase(), "lowercase hex");

  assert.throws(() => argvDigest(["a", 1 as unknown as string]), /argv\[1\] is not a string/);
});

// ---------------------------------------------------------------------------
// 15. Oracle edges
// ---------------------------------------------------------------------------

test("REPRO-03 adjacency: identical pc and hitCount but a frame position one frame apart is NOT identical", () => {
  const stop: StopIdentity = { pc: 0xea31, hitCount: 1, line: 257, cycle: 57 };
  // Clean control on the same record.
  assert.equal(compareStopIdentity(stop, { ...stop }).identical, true);

  const oneFrame = compareStopIdentity(stop, { ...stop, line: stop.line + 1 });
  assert.equal(oneFrame.identical, false, "the frame term is what makes a two-term oracle insufficient");
  assert.deepEqual(oneFrame.differingTerms, ["line"]);

  const oneCycle = compareStopIdentity(stop, { ...stop, cycle: stop.cycle + 1 });
  assert.equal(oneCycle.identical, false);
  assert.deepEqual(oneCycle.differingTerms, ["cycle"]);
});

test("compareStopIdentity is symmetric, and differingTerms is ordered as ORACLE_TERMS", () => {
  const a: StopIdentity = { pc: 0xea31, hitCount: 1, line: 257, cycle: 57 };
  const b: StopIdentity = { pc: 0x0816, hitCount: 2, line: 100, cycle: 12 };

  const ab = compareStopIdentity(a, b);
  const ba = compareStopIdentity(b, a);
  assert.equal(ab.identical, ba.identical);
  assert.deepEqual(ab.differingTerms, ba.differingTerms, "the verdict must not depend on argument order");
  assert.deepEqual(ab.differingTerms, [...ORACLE_TERMS], "all four differ, reported in the declared order");

  // A subset, still in declared order rather than in the order they were found.
  const subset = compareStopIdentity(a, { ...a, cycle: 99, pc: 0x1234 });
  assert.deepEqual(subset.differingTerms, ["pc", "cycle"]);
});

test("compareStopIdentity refuses every absent or non-integer term, on either side, naming both", () => {
  const whole: StopIdentity = { pc: 0xea31, hitCount: 1, line: 257, cycle: 57 };
  assert.equal(compareStopIdentity(whole, { ...whole }).identical, true);

  for (const term of ORACLE_TERMS) {
    const partial = { ...whole } as Record<string, number>;
    delete partial[term];
    assert.throws(
      () => compareStopIdentity(partial as unknown as StopIdentity, whole),
      (err: unknown) => {
        assert.ok(err instanceof StopOracleError);
        assert.equal(err.term, term);
        assert.equal(err.side, "a");
        return true;
      },
      `an absent ${term} must be refused rather than silently passed`,
    );
  }

  assert.throws(() => compareStopIdentity(whole, { ...whole, cycle: 1.5 }), /not a finite integer on side b/);
  assert.throws(() => compareStopIdentity(whole, { ...whole, line: Number.NaN }), /not a finite integer on side b/);
  assert.throws(() => compareStopIdentity(null as unknown as StopIdentity, whole), /side a is not a stop record/);
});
