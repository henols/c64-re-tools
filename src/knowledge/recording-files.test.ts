import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { coverageMapOf } from "./recording-files.ts";

const root = mkdtempSync(join(tmpdir(), "c64-re-tools-recording-files-"));
after(() => rmSync(root, { recursive: true, force: true }));

test("a recording folder names its coverage map; a map file and a missing path stay as they are; a folder without a recording is refused", () => {
  mkdirSync(join(root, ".c64-re-tools"));
  mkdirSync(join(root, "tests", "recordings", "walk"), { recursive: true });
  for (const name of ["recording.json", "reads.txt", "coverage.bin"]) writeFileSync(join(root, "tests", "recordings", "walk", name), "");
  writeFileSync(join(root, "run.bin"), "");
  assert.equal(coverageMapOf("tests/recordings/walk", root), "tests/recordings/walk/coverage.bin");
  assert.equal(coverageMapOf("tests/recordings/walk/", root), "tests/recordings/walk/coverage.bin");
  assert.equal(coverageMapOf("run.bin", root), "run.bin");
  assert.equal(coverageMapOf("none.bin", root), "none.bin");
  assert.throws(() => coverageMapOf("tests/recordings", root), /tests\/recordings is a folder that holds no recording/);
});
