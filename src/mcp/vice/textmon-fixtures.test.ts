// node:test coverage of textmon-fixtures.ts's captured-fixture loader --
// mirrors binmon-fixtures.test.ts's own loader-test idioms (a temporary
// directory created and removed in a finally block for the negative cases,
// a loop over the committed cases for the positive ones), retargeted at the
// text-monitor fixture tree. Corpus-free: this file needs no emulator, so it
// joins the automated set (MANUAL_ONLY_TESTS stays untouched -- see
// test-gate.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadTextFixture,
  listTextFixtures,
  MissingTextFixtureError,
  REQUIRED_PROVENANCE_KEYS,
  TEXTMON_FIXTURE_DIR,
} from "./textmon-fixtures.ts";

test("REQUIRED_PROVENANCE_KEYS: the same five keys binmon-fixtures.ts requires, as this module's own copy", () => {
  assert.deepEqual([...REQUIRED_PROVENANCE_KEYS], ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"]);
});

test("loadTextFixture: throws a named MissingTextFixtureError (not a bare ENOENT) when the .txt payload is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    writeFileSync(
      join(dir, "access-map.json"),
      JSON.stringify({
        capturedFrom: "stock:/usr/bin/x64sc",
        viceVersion: "x64sc (VICE 3.9)",
        capturedAt: new Date().toISOString(),
        command: "memmapshow",
        synthetic: false,
      }),
    );
    assert.throws(
      () => loadTextFixture("access-map", { dir }),
      (err: unknown) => {
        assert.ok(err instanceof MissingTextFixtureError, `expected MissingTextFixtureError, got ${String(err)}`);
        assert.match((err as Error).message, /access-map\.txt/);
        assert.match((err as Error).message, /regenerate it with/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTextFixture: throws a named MissingTextFixtureError when the sidecar is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "access-map.txt"), "addr: IO  ROM RAM\n");
    assert.throws(
      () => loadTextFixture("access-map", { dir }),
      (err: unknown) => {
        assert.ok(err instanceof MissingTextFixtureError, `expected MissingTextFixtureError, got ${String(err)}`);
        assert.match((err as Error).message, /access-map\.json/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTextFixture: returns { buffer, provenance, text, synthetic } for a complete pair, with buffer.length equal to the on-disk .txt file's byte length", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    const payload = "addr: IO  ROM RAM\n0000: --- --- rw- (dummy)\n(C:$e5d4) ";
    writeFileSync(join(dir, "access-map.txt"), payload, "utf8");
    writeFileSync(
      join(dir, "access-map.json"),
      JSON.stringify({
        capturedFrom: "stock:/usr/bin/x64sc",
        viceVersion: "x64sc (VICE 3.9)",
        capturedAt: new Date().toISOString(),
        command: "memmapshow",
        synthetic: false,
      }),
    );
    const result = loadTextFixture("access-map", { dir });
    const onDiskSize = statSync(join(dir, "access-map.txt")).size;
    assert.equal(result.buffer.length, onDiskSize, "the returned buffer's length must equal the on-disk file's byte length -- the bytes are authoritative, never round-tripped through a string");
    assert.ok(result.buffer.equals(Buffer.from(payload, "utf8")));
    assert.equal(result.text, payload, "text is a lossy convenience decode of the same bytes");
    assert.equal(result.provenance.capturedFrom, "stock:/usr/bin/x64sc");
    assert.equal(result.synthetic, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTextFixture: a sidecar missing a required provenance key throws MissingTextFixtureError naming the missing key(s)", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "access-map.txt"), "addr: IO  ROM RAM\n");
    writeFileSync(join(dir, "access-map.json"), JSON.stringify({ capturedFrom: "stock:/usr/bin/x64sc" }));
    assert.throws(
      () => loadTextFixture("access-map", { dir }),
      (err: unknown) => {
        assert.ok(err instanceof MissingTextFixtureError, `expected MissingTextFixtureError, got ${String(err)}`);
        assert.match((err as Error).message, /viceVersion/);
        assert.match((err as Error).message, /synthetic/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// WR-04 (39-REVIEW.md): the test above only ever removes four keys at once
// (everything but capturedFrom) and only ever asserts on two of those four --
// it cannot distinguish "the loader enforces all five keys" from "the loader
// happens to enforce whichever two this one test bothered to check". This
// loop proves each key's absence is refused INDIVIDUALLY, with the other
// four present, by asserting the thrown message names exactly the one key
// omitted -- one sub-case per REQUIRED_PROVENANCE_KEYS entry, five total.
for (const omittedKey of REQUIRED_PROVENANCE_KEYS) {
  test(`loadTextFixture: a sidecar missing only "${omittedKey}" throws MissingTextFixtureError naming it`, () => {
    const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
    try {
      const fullProvenance: Record<string, unknown> = {
        capturedFrom: "stock:/usr/bin/x64sc",
        viceVersion: "x64sc (VICE 3.9)",
        capturedAt: new Date().toISOString(),
        command: "memmapshow",
        synthetic: false,
      };
      delete fullProvenance[omittedKey];
      writeFileSync(join(dir, "access-map.txt"), "addr: IO  ROM RAM\n");
      writeFileSync(join(dir, "access-map.json"), JSON.stringify(fullProvenance));
      assert.throws(
        () => loadTextFixture("access-map", { dir }),
        (err: unknown) => {
          assert.ok(err instanceof MissingTextFixtureError, `expected MissingTextFixtureError, got ${String(err)}`);
          assert.match(
            (err as Error).message,
            new RegExp(omittedKey),
            `message must name the one key actually omitted ("${omittedKey}")`,
          );
          return true;
        },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("loadTextFixture: a CORRUPT (unparseable) sidecar throws MissingTextFixtureError, not a bare SyntaxError", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "access-map.txt"), "addr: IO  ROM RAM\n");
    writeFileSync(join(dir, "access-map.json"), "{ this is not json");
    assert.throws(
      () => loadTextFixture("access-map", { dir }),
      (err: unknown) => {
        assert.ok(err instanceof MissingTextFixtureError, `expected MissingTextFixtureError, got ${String(err)}`);
        assert.ok(!(err instanceof SyntaxError));
        assert.match((err as Error).message, /unreadable or malformed/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadTextFixture: a sidecar that parses to a non-object (a bare array) is also MissingTextFixtureError", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "access-map.txt"), "addr: IO  ROM RAM\n");
    writeFileSync(join(dir, "access-map.json"), "[1,2,3]");
    assert.throws(() => loadTextFixture("access-map", { dir }), MissingTextFixtureError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("listTextFixtures: a half-written pair (only a .txt, no .json) is invisible -- never half-loadable", () => {
  const dir = mkdtempSync(join(tmpdir(), "textmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "complete-case.txt"), "x");
    writeFileSync(
      join(dir, "complete-case.json"),
      JSON.stringify({ capturedFrom: "stock:/usr/bin/x64sc", viceVersion: "v", capturedAt: new Date().toISOString(), command: "x", synthetic: false }),
    );
    writeFileSync(join(dir, "half-written.txt"), "y"); // no matching .json
    writeFileSync(
      join(dir, "half-written-other.json"),
      JSON.stringify({ capturedFrom: "stock:/usr/bin/x64sc", viceVersion: "v", capturedAt: new Date().toISOString(), command: "x", synthetic: false }),
    ); // no matching .txt
    const cases = listTextFixtures({ dir });
    assert.deepEqual(cases, ["complete-case"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every committed sidecar under fixtures/textmon/ STATES its provenance as a real capture, with a capturedFrom naming the kind and path of the binary that actually answered", () => {
  const cases = listTextFixtures();
  assert.ok(cases.length >= 6, `expected at least 6 committed cases, got ${cases.length}`);
  for (const caseName of cases) {
    const loaded = loadTextFixture(caseName);
    assert.equal(typeof loaded.provenance.synthetic, "boolean", `${caseName}.json must STATE synthetic as a boolean`);
    assert.equal(loaded.synthetic, false, `${caseName} is a real, hardware-recorded capture -- it must say so`);
    assert.match(
      String(loaded.provenance.capturedFrom),
      /^(stock|fork):\//,
      `${caseName}.json's capturedFrom must name a real binary's kind and absolute path`,
    );
  }
});

test("the committed fixture tree contains captures from at least two distinct binary paths", () => {
  const cases = listTextFixtures();
  const kinds = new Set(cases.map((c) => String(loadTextFixture(c).provenance.capturedFrom).split(":")[0]));
  const paths = new Set(cases.map((c) => String(loadTextFixture(c).provenance.capturedFrom)));
  assert.ok(kinds.size >= 1, "at least one kind must be represented");
  assert.ok(paths.size >= 2, `expected at least 2 distinct capturedFrom values across committed fixtures, got ${paths.size}`);
});

test("TEXTMON_FIXTURE_DIR points at the committed fixtures/textmon directory next to this module", () => {
  assert.match(TEXTMON_FIXTURE_DIR, /fixtures[/\\]textmon$/);
});
