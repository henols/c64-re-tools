// node:test coverage of binmon-fixtures.ts's response-frame encoder,
// synthetic VERIF-02 case builders, and captured-fixture loader. Colocated,
// same harness shape as vice-probe.test.ts -- no fixture-loading framework,
// plain node:fs against a tmp directory for the loader's own tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
