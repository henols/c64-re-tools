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
