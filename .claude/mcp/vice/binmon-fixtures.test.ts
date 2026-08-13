// node:test coverage of binmon-fixtures.ts's response-frame encoder,
// synthetic VERIF-02 case builders, and captured-fixture loader. Colocated,
// same harness shape as vice-probe.test.ts -- no fixture-loading framework,
// plain node:fs against a tmp directory for the loader's own tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  encodeResponseFrame,
  syntheticJamFrame,
  syntheticUnknownTypeFrame,
  syntheticDuplicateReplyStream,
  syntheticDesyncStream,
  syntheticDisplayGetFrame,
  chunkBytes,
  loadCapturedFixture,
  MissingFixtureError,
  VICE_STX,
  VICE_API_VERSION,
  VICE_BROADCAST_REQUEST_ID,
  RESPONSE_HEADER_LEN,
} from "./binmon-fixtures.ts";

test("encodeResponseFrame: builds the normative 12-byte response header", () => {
  const frame = encodeResponseFrame({
    responseType: 0x61,
    errorCode: 0x00,
    requestId: 0xffffffff,
    body: Buffer.alloc(0),
  });
  assert.equal(frame.length, RESPONSE_HEADER_LEN);
  assert.equal(frame[0], VICE_STX);
  assert.equal(frame[1], VICE_API_VERSION);
  assert.equal(frame.readUInt32LE(2), 0);
  assert.equal(frame[6], 0x61);
  assert.equal(frame[7], 0x00);
  assert.equal(frame.readUInt32LE(8), 0xffffffff);
});

test("encodeResponseFrame: bodyLength override can deliberately lie about body.length", () => {
  const body = Buffer.from([1, 2, 3]);
  const frame = encodeResponseFrame({ responseType: 0x01, requestId: 1, body, bodyLength: 99 });
  assert.equal(frame.readUInt32LE(2), 99);
  assert.equal(frame.length, RESPONSE_HEADER_LEN + body.length);
});

test("syntheticJamFrame: response type 0x61, zero-length body, broadcast request id", () => {
  const frame = syntheticJamFrame();
  assert.equal(frame.length, RESPONSE_HEADER_LEN);
  assert.equal(frame[6], 0x61);
  assert.equal(frame[7], 0x00);
  assert.equal(frame.readUInt32LE(8), VICE_BROADCAST_REQUEST_ID);
});

test("syntheticUnknownTypeFrame: response-type byte is 0x00", () => {
  const frame = syntheticUnknownTypeFrame();
  assert.equal(frame[6], 0x00);
});

test("syntheticDisplayGetFrame: declared body length matches actual, total size exceeds 157,000 bytes", () => {
  const frame = syntheticDisplayGetFrame();
  assert.ok(frame.length > 157000, `frame too small: ${frame.length}`);
  assert.equal(frame.readUInt32LE(2), frame.length - RESPONSE_HEADER_LEN);
});

test("syntheticDesyncStream: valid frame, one non-0x02 garbage byte, then a second valid frame", () => {
  const stream = syntheticDesyncStream();
  let offset = 0;
  let frames = 0;
  let desyncs = 0;
  while (offset < stream.length) {
    if (stream[offset] !== VICE_STX) {
      offset += 1;
      desyncs += 1;
      continue;
    }
    const bodyLen = stream.readUInt32LE(offset + 2);
    offset += RESPONSE_HEADER_LEN + bodyLen;
    frames += 1;
  }
  assert.equal(frames, 2, "expected exactly two valid frames");
  assert.ok(desyncs >= 1, "expected at least one non-STX byte to resync past");
});

test("syntheticDuplicateReplyStream: two byte-identical frames, same non-broadcast request id", () => {
  const stream = syntheticDuplicateReplyStream(42);
  assert.equal(stream.length % 2, 0);
  const frameLen = stream.length / 2;
  const first = stream.subarray(0, frameLen);
  const second = stream.subarray(frameLen);
  assert.ok(first.equals(second));
  assert.equal(first.readUInt32LE(8), 42);
  assert.notEqual(first.readUInt32LE(8), VICE_BROADCAST_REQUEST_ID);
});

test("chunkBytes: one single-byte Buffer per input byte, in order, reassembling to the original", () => {
  const original = Buffer.from([10, 20, 30, 40]);
  const chunks = chunkBytes(original, 1);
  assert.equal(chunks.length, 4);
  for (const c of chunks) assert.equal(c.length, 1);
  assert.ok(Buffer.concat(chunks).equals(original));
});

test("loadCapturedFixture: throws a named MissingFixtureError (not a bare ENOENT) when the .bin is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "binmon-fixtures-test-"));
  try {
    assert.throws(() => loadCapturedFixture("display-get", { dir }), MissingFixtureError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadCapturedFixture: returns { bytes, provenance } when present", () => {
  const dir = mkdtempSync(join(tmpdir(), "binmon-fixtures-test-"));
  try {
    const bin = Buffer.from([1, 2, 3]);
    writeFileSync(join(dir, "display-get.bin"), bin);
    writeFileSync(
      join(dir, "display-get.json"),
      JSON.stringify({
        capturedFrom: "stock",
        viceVersion: "3.9.0.0",
        capturedAt: new Date().toISOString(),
        command: "DISPLAY_GET (0x84)",
      }),
    );
    const result = loadCapturedFixture("display-get", { dir });
    assert.ok(result.bytes.equals(bin));
    assert.equal(result.provenance.capturedFrom, "stock");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadCapturedFixture: a sidecar missing a required provenance key also throws MissingFixtureError", () => {
  const dir = mkdtempSync(join(tmpdir(), "binmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "display-get.bin"), Buffer.from([1]));
    writeFileSync(join(dir, "display-get.json"), JSON.stringify({ capturedFrom: "stock" }));
    assert.throws(() => loadCapturedFixture("display-get", { dir }), MissingFixtureError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// WR-10: provenance a caller can assert on, and a corrupt sidecar that fails
// like every other unusable sidecar rather than as a bare SyntaxError.
// ---------------------------------------------------------------------------

test("WR-10 loadCapturedFixture: a CORRUPT sidecar throws MissingFixtureError, not a bare SyntaxError", () => {
  const dir = mkdtempSync(join(tmpdir(), "binmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "display-get.bin"), Buffer.from([1]));
    writeFileSync(join(dir, "display-get.json"), "{ this is not json");
    assert.throws(
      () => loadCapturedFixture("display-get", { dir }),
      (err: unknown) => {
        assert.ok(err instanceof MissingFixtureError, `expected MissingFixtureError, got ${String(err)}`);
        assert.ok(!(err instanceof SyntaxError));
        assert.match((err as Error).message, /unreadable or malformed/);
        assert.match((err as Error).message, /probe-binmon\.mjs --capture display-get/, "the regenerate command must be named, as for every other unusable sidecar");
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WR-10 loadCapturedFixture: a sidecar that parses to a non-object (a bare array) is also MissingFixtureError", () => {
  const dir = mkdtempSync(join(tmpdir(), "binmon-fixtures-test-"));
  try {
    writeFileSync(join(dir, "display-get.bin"), Buffer.from([1]));
    writeFileSync(join(dir, "display-get.json"), "[1,2,3]");
    assert.throws(() => loadCapturedFixture("display-get", { dir }), MissingFixtureError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WR-10 loadCapturedFixture: `synthetic` is surfaced as a real boolean, and only a sidecar that SAYS so claims hardware provenance", () => {
  const dir = mkdtempSync(join(tmpdir(), "binmon-fixtures-test-"));
  try {
    const base = { viceVersion: "3.9.0.0", capturedAt: new Date().toISOString(), command: "DISPLAY_GET (0x84)" };
    writeFileSync(join(dir, "display-get.bin"), Buffer.from([1]));

    writeFileSync(join(dir, "display-get.json"), JSON.stringify({ ...base, capturedFrom: "synthesized-fallback", synthetic: true }));
    assert.equal(loadCapturedFixture("display-get", { dir }).synthetic, true);

    writeFileSync(join(dir, "display-get.json"), JSON.stringify({ ...base, capturedFrom: "stock:/usr/bin/x64sc" }));
    assert.equal(loadCapturedFixture("display-get", { dir }).synthetic, false, "a sidecar with no flag is treated as a real capture -- the flag is opt-in");

    // A non-boolean must NOT be coerced into "recorded": a truthy string like
    // "false" would otherwise silently promote a synthetic fixture.
    writeFileSync(join(dir, "display-get.json"), JSON.stringify({ ...base, capturedFrom: "x", synthetic: "true" }));
    assert.equal(loadCapturedFixture("display-get", { dir }).synthetic, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WR-10: the three committed fixtures report synthetic: true, matching the recorded 2026-08-13 D-19 override", () => {
  for (const caseName of ["display-get", "event-interleaved", "checkpoint-list"] as const) {
    const loaded = loadCapturedFixture(caseName);
    assert.equal(loaded.synthetic, true, `${caseName} is spec-synthesized, not hardware-recorded -- it must say so`);
    assert.equal(loaded.provenance.capturedFrom, "synthesized-fallback");
  }
});

test("WR-10: binmon-fixtures.ts's own header does not claim the three fixtures are real captures", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "binmon-fixtures.ts"), "utf8");
  const header = source.slice(0, source.indexOf("import "));
  // Matches the CLAIM ("... are captured for real by ...") rather than the
  // phrase, so the correction below is free to quote what it replaced.
  assert.ok(
    !/are captured for real/.test(header),
    "the module that LOADS the fixtures is the worst place for a stale claim of hardware provenance",
  );
  assert.match(header, /NOT currently real captures/, "the header must state the fixtures' actual provenance");
  assert.match(header, /re-record-binmon-fixtures-against-real-stock-vice/, "and point at the re-capture follow-up");
});

// ---------------------------------------------------------------------------
// fixture: the three VERIF-02 cases committed under fixtures/binmon/ by plan
// 02-02 (currently synthesized from the spec -- see
// fixtures/binmon/README.md and docs/phase2-backend-probe-evidence.md for the
// 2026-08-13 override -- but loaded and asserted on exactly as a real capture
// would be; the well-formedness assertions below do not depend on the
// bytes' origin). Named so `--test-name-pattern="fixture"` matches all six.
// ---------------------------------------------------------------------------

const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command"] as const;

/** Walk a concatenated response-frame stream and return each frame's header
 * fields plus body, asserting every frame's declared body length matches
 * the bytes actually present and that no trailing partial frame remains. */
function decomposeFrames(bytes: Buffer): Array<{ responseType: number; errorCode: number; requestId: number; body: Buffer }> {
  const frames: Array<{ responseType: number; errorCode: number; requestId: number; body: Buffer }> = [];
  let offset = 0;
  while (offset < bytes.length) {
    assert.ok(
      offset + RESPONSE_HEADER_LEN <= bytes.length,
      `truncated header at offset ${offset} (${bytes.length - offset} byte(s) remain, need ${RESPONSE_HEADER_LEN})`,
    );
    assert.equal(bytes[offset], VICE_STX, `frame at offset ${offset} does not start with STX`);
    const bodyLen = bytes.readUInt32LE(offset + 2);
    const responseType = bytes[offset + 6];
    const errorCode = bytes[offset + 7];
    const requestId = bytes.readUInt32LE(offset + 8);
    const bodyStart = offset + RESPONSE_HEADER_LEN;
    const bodyEnd = bodyStart + bodyLen;
    assert.ok(
      bodyEnd <= bytes.length,
      `frame at offset ${offset} declares body length ${bodyLen} but only ${bytes.length - bodyStart} byte(s) remain`,
    );
    frames.push({ responseType, errorCode, requestId, body: bytes.subarray(bodyStart, bodyEnd) });
    offset = bodyEnd;
  }
  assert.equal(offset, bytes.length, "trailing partial frame after the last complete frame");
  return frames;
}

for (const caseName of ["display-get", "event-interleaved", "checkpoint-list"] as const) {
  test(`fixture: ${caseName}.bin loads through loadCapturedFixture() without throwing`, () => {
    assert.doesNotThrow(() => loadCapturedFixture(caseName));
  });

  test(`fixture: ${caseName}.json sidecar carries all four provenance keys with non-empty string values`, () => {
    const { provenance } = loadCapturedFixture(caseName);
    for (const key of REQUIRED_PROVENANCE_KEYS) {
      assert.ok(key in provenance, `sidecar missing key "${key}"`);
      assert.equal(typeof provenance[key], "string", `sidecar key "${key}" is not a string`);
      assert.ok((provenance[key] as string).length > 0, `sidecar key "${key}" is an empty string`);
    }
  });

  test(`fixture: ${caseName}.bin decomposes into at least one complete frame with no trailing partial frame`, () => {
    const { bytes } = loadCapturedFixture(caseName);
    const frames = decomposeFrames(bytes);
    assert.ok(frames.length >= 1, "expected at least one complete frame");
  });
}

test("fixture: display-get.bin is larger than 157,000 bytes", () => {
  const { bytes } = loadCapturedFixture("display-get");
  assert.ok(bytes.length > 157000, `display-get.bin too small: ${bytes.length} bytes`);
});

test("fixture: event-interleaved.bin carries at least one broadcast-id frame and at least one non-broadcast-id frame", () => {
  const { bytes } = loadCapturedFixture("event-interleaved");
  const frames = decomposeFrames(bytes);
  assert.ok(
    frames.some((f) => f.requestId === VICE_BROADCAST_REQUEST_ID),
    "expected at least one frame at the broadcast request id (0xffffffff)",
  );
  assert.ok(
    frames.some((f) => f.requestId !== VICE_BROADCAST_REQUEST_ID),
    "expected at least one frame at a non-broadcast request id",
  );
});

test("fixture: checkpoint-list.bin carries at least two frames sharing one non-broadcast request id", () => {
  const { bytes } = loadCapturedFixture("checkpoint-list");
  const frames = decomposeFrames(bytes);
  const counts = new Map<number, number>();
  for (const f of frames) {
    if (f.requestId === VICE_BROADCAST_REQUEST_ID) continue;
    counts.set(f.requestId, (counts.get(f.requestId) ?? 0) + 1);
  }
  assert.ok(
    Array.from(counts.values()).some((n) => n >= 2),
    `expected at least two frames sharing one non-broadcast request id, got counts: ${JSON.stringify(Array.from(counts.entries()))}`,
  );
});
