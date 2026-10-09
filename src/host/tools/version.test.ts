import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import { C1541, isOlderThanMinimum, viceVersionOf } from "../../native/discover.ts";
import { ProcessSupervisor } from "../../native/processes.ts";
import { standIn } from "../../native/standin.testkit.ts";
import { requireMinimumVersion } from "./version.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-version-"));
const supervisor = new ProcessSupervisor();
after(async () => {
  await supervisor.stopAll();
  rmSync(scratch, { recursive: true, force: true });
});
const posixOnly = process.platform === "win32" ? "the stand-in tools are shell scripts" : false;

test("VICE versions are read from the tools' version lines and compared with 3.9", () => {
  assert.deepEqual(viceVersionOf("c1541 (VICE 3.10)"), { major: 3, minor: 10 });
  assert.deepEqual(viceVersionOf("x64sc (VICE 3.7.1)"), { major: 3, minor: 7 });
  assert.equal(viceVersionOf("no version here"), undefined);
  assert.equal(isOlderThanMinimum({ major: 3, minor: 7 }), true);
  assert.equal(isOlderThanMinimum({ major: 3, minor: 8 }), true);
  assert.equal(isOlderThanMinimum({ major: 3, minor: 9 }), false);
  assert.equal(isOlderThanMinimum({ major: 3, minor: 10 }), false);
  assert.equal(isOlderThanMinimum({ major: 4, minor: 0 }), false);
});

test("a c1541 from an older VICE or with an unreadable version is refused by name with the remedy, never by its path; a current one is let through", { skip: posixOnly }, async () => {
  const context = { supervisor, signal: new AbortController().signal };
  const old = standIn(scratch, "c1541-old", ["c1541 (VICE 3.7.1)"]);
  await assert.rejects(
    requireMinimumVersion(C1541, old, context),
    (error: unknown) =>
      error instanceof WireFailure &&
      error.code === "installation-incomplete" &&
      error.message.startsWith("c1541 comes from VICE 3.7, and c64-re-tools needs VICE 3.9 or later.") &&
      !error.message.includes(scratch),
  );
  await requireMinimumVersion(C1541, standIn(scratch, "c1541-new", ["c1541 (VICE 3.10)"]), context);
  await assert.rejects(
    requireMinimumVersion(C1541, standIn(scratch, "c1541-odd", ["something else"]), context),
    (error: unknown) =>
      error instanceof WireFailure &&
      error.code === "installation-incomplete" &&
      error.message.startsWith("c1541 does not tell its VICE version") &&
      error.message.includes(C1541.remedy) &&
      !error.message.includes(scratch),
  );
});

test("a caller that cancels does not cancel the version check that another caller waits for", { skip: posixOnly, timeout: 30_000 }, async () => {
  const slow = join(scratch, "c1541-slow");
  writeFileSync(slow, "#!/bin/sh\nsleep 0.5\necho 'c1541 (VICE 3.10)'\n");
  chmodSync(slow, 0o755);
  const leaving = new AbortController();
  const first = requireMinimumVersion(C1541, slow, { supervisor, signal: leaving.signal });
  const second = requireMinimumVersion(C1541, slow, { supervisor, signal: new AbortController().signal });
  leaving.abort();
  await second;
  await first;
});
