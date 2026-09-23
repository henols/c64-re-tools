// transfer-hash.test.mts
//
// Phase 64 (XFER-05/XFER-06): unit coverage of the streaming hash+count
// Transform and the declared-vs-observed comparison, with no socket and no
// filesystem I/O at all. This module has NO sibling ".mjs" import, so it is
// safe to import directly, unbuilt (unlike broker-transfer.test.mts, which
// must build() first -- see that file's own header comment).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES } from "./transfer-hash.mts";

test("TRANSFER_MAX_BYTES is sixteen mebibytes", () => {
  assert.equal(TRANSFER_MAX_BYTES, 16 * 1024 * 1024);
  assert.equal(TRANSFER_MAX_BYTES, 16777216);
});

test("createHashAndCountTransform: digest of a buffer containing 0x00 and 0x80..0xFF matches createHash('sha256') directly", async () => {
  const bytes = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) bytes[i] = i;
  const expectedSha256 = createHash("sha256").update(bytes).digest("hex");

  const transform = createHashAndCountTransform();
  const chunks: Buffer[] = [];
  transform.on("data", (chunk: Buffer) => chunks.push(chunk));
  await pipeline(Readable.from([bytes]), transform);

  const result = transform.result();
  assert.equal(result.sha256, expectedSha256);
  assert.equal(result.byteLength, 256);
  assert.ok(Buffer.concat(chunks).equals(bytes), "the Transform must pass every byte through unchanged");
});

test("createHashAndCountTransform: a 0-byte stream produces byteLength 0 and the empty-input sha256", async () => {
  const expectedEmptySha256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");

  const transform = createHashAndCountTransform();
  await pipeline(Readable.from([]), transform);

  const result = transform.result();
  assert.equal(result.byteLength, 0);
  assert.equal(result.sha256, expectedEmptySha256);
});

test("createHashAndCountTransform: result() is idempotent -- calling it twice returns the same digest", async () => {
  const transform = createHashAndCountTransform();
  await pipeline(Readable.from([Buffer.from("hello")]), transform);
  const first = transform.result();
  const second = transform.result();
  assert.deepEqual(first, second);
});

test("createHashAndCountTransform: the cap comparison is strictly-greater -- capBytes observed is accepted, capBytes+1 is refused", async () => {
  const capBytes = 10;
  const exact = createHashAndCountTransform({ capBytes });
  await pipeline(Readable.from([Buffer.alloc(capBytes, 0x41)]), exact);
  assert.equal(exact.result().byteLength, capBytes);

  const over = createHashAndCountTransform({ capBytes });
  await assert.rejects(() => pipeline(Readable.from([Buffer.alloc(capBytes + 1, 0x41)]), over));
});

test("createHashAndCountTransform: refuses with a message naming both the observed size and the limit", async () => {
  const capBytes = 4;
  const transform = createHashAndCountTransform({ capBytes });
  await assert.rejects(
    () => pipeline(Readable.from([Buffer.alloc(5, 0x41)]), transform),
    (err: unknown) => {
      assert.match((err as Error).message, /4/);
      assert.match((err as Error).message, /5/);
      assert.match((err as Error).message, /sixteen mebibytes|cap/i);
      return true;
    },
  );
});

test("verifyObserved: agreement returns ok:true", () => {
  const expected = { byteLength: 10, sha256: "abc" };
  const observed = { byteLength: 10, sha256: "abc" };
  assert.deepEqual(verifyObserved(expected, observed), { ok: true });
});

test("verifyObserved: a byteLength mismatch refuses naming which field disagreed and both values", () => {
  const result = verifyObserved({ byteLength: 10, sha256: "abc" }, { byteLength: 5, sha256: "abc" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /byte count/);
    assert.match(result.reason, /10/);
    assert.match(result.reason, /5/);
  }
});

test("verifyObserved: a sha256 mismatch refuses naming which field disagreed and both digests", () => {
  const result = verifyObserved({ byteLength: 10, sha256: "abc" }, { byteLength: 10, sha256: "def" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /digest/);
    assert.match(result.reason, /abc/);
    assert.match(result.reason, /def/);
  }
});
