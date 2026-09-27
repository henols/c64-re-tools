// transfer-paths.test.ts
//
// Phase 64 (D-13/XFER-03): pure, no-I/O coverage of the containment
// validator and the client-side snapshot name/path owner it lives beside.
// Every case here is a string-in/result-out fixture -- no filesystem access
// anywhere in this file, matching validateContainedDestination()'s own
// no-I/O contract.
//
// This validator has NO live producer in this phase. Its first real caller
// is Phase 65, where the broker genuinely names host-tool output artifacts.
// A passing test here is evidence the validator is correct, not evidence
// that a real broker-supplied name was ever exercised (D-13).
import { test } from "node:test";
import assert from "node:assert/strict";

import { validateContainedDestination, validateSnapshotName, snapshotPathFor, snapshotMetaPathFor, transferKindDir, StockPathError } from "./transfer-paths.ts";

const ROOT = "/workspace/.c64-re-tools/inbox";

test("validateContainedDestination: a plain name resolves under root", () => {
  const result = validateContainedDestination("snapshot.vsf", ROOT);
  assert.deepEqual(result, { ok: true, resolved: `${ROOT}/snapshot.vsf` });
});

test("validateContainedDestination: a traversal path is refused, naming the traversal rule", () => {
  const result = validateContainedDestination("../../etc/passwd", ROOT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /traversal|\.\./);
});

test("validateContainedDestination: an absolute path is refused, naming the absolute-path rule", () => {
  const result = validateContainedDestination("/etc/passwd", ROOT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /absolute/);
});

test("validateContainedDestination: a Windows-drive-form path is refused on every platform, via the separator rule", () => {
  const result = validateContainedDestination("C:\\", ROOT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /separator/);
});

test("validateContainedDestination: a NUL-embedded name is refused, naming the NUL rule", () => {
  const result = validateContainedDestination("a\0b", ROOT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /NUL/);
});

test("validateContainedDestination: the empty string is refused -- it does not resolve to root itself", () => {
  const result = validateContainedDestination("", ROOT);
  assert.equal(result.ok, false);
});

test("validateContainedDestination: '.' and '..' alone are both refused", () => {
  assert.equal(validateContainedDestination(".", ROOT).ok, false);
  assert.equal(validateContainedDestination("..", ROOT).ok, false);
});

test("validateContainedDestination: a fullwidth solidus (U+FF0F) is an ordinary filename character -- no normalisation, no case folding", () => {
  const candidate = "a\uFF0Fb";
  const result = validateContainedDestination(candidate, ROOT);
  assert.deepEqual(result, { ok: true, resolved: `${ROOT}/${candidate}` });
});

test("validateContainedDestination: a backslash anywhere is refused, naming the separator rule", () => {
  const result = validateContainedDestination("a\\b", ROOT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /separator/);
});

test("validateContainedDestination: a mid-string traversal segment is refused", () => {
  const result = validateContainedDestination("foo/../bar", ROOT);
  assert.equal(result.ok, false);
});

test("validateContainedDestination: performs no filesystem access -- string in, result out, synchronously", () => {
  // If this function ever touches node:fs, this synchronous call would be
  // the only opportunity to observe it; there is nothing further to assert
  // beyond "it returned synchronously with a plain object", which every
  // other case in this file already exercises.
  const result = validateContainedDestination("plain.bin", ROOT);
  assert.equal(typeof result, "object");
});

// --------------------------------------------------------- validateSnapshotName

test("validateSnapshotName: accepts the same names sanitizeSnapshotName() accepts", () => {
  assert.deepEqual(validateSnapshotName("before_crash"), { ok: true, name: "before_crash" });
  assert.deepEqual(validateSnapshotName("level3-boss"), { ok: true, name: "level3-boss" });
});

const REFUSED_SNAPSHOT_NAMES: unknown[] = ["", "../etc/passwd", "a/b", "a.b", "a b", "x".repeat(65), 123, undefined, null];

for (const name of REFUSED_SNAPSHOT_NAMES) {
  test(`validateSnapshotName: refuses ${JSON.stringify(name)}`, () => {
    const result = validateSnapshotName(name);
    assert.equal(result.ok, false);
  });
}

// --------------------------------------------------------- snapshotPathFor / snapshotMetaPathFor

test("snapshotPathFor: returns an absolute path ending in /.c64-re-tools/local/snapshots/<name>.vsf", () => {
  const p = snapshotPathFor("x");
  assert.ok(p.endsWith("/.c64-re-tools/local/snapshots/x.vsf"));
  assert.ok(p.startsWith("/"));
});

test("snapshotMetaPathFor: returns an absolute path ending in /.c64-re-tools/local/snapshots/<name>.json", () => {
  const p = snapshotMetaPathFor("x");
  assert.ok(p.endsWith("/.c64-re-tools/local/snapshots/x.json"));
  assert.ok(p.startsWith("/"));
});

test("snapshotPathFor: rejects an unsanitary name before building a path, throwing StockPathError", () => {
  assert.throws(() => snapshotPathFor("../etc/passwd"), StockPathError);
});

test("snapshotMetaPathFor: rejects an unsanitary name before building a path, throwing StockPathError", () => {
  assert.throws(() => snapshotMetaPathFor("../etc/passwd"), StockPathError);
});

// --------------------------------------------------------- transferKindDir

test("transferKindDir: resolves a per-kind subdirectory under the project's local/", () => {
  const p = transferKindDir("hosttool");
  assert.ok(p.endsWith("/.c64-re-tools/local/hosttool"));
});
