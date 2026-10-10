import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { MANIFESTS, mismatches, packageVersion, sync, versionsIn, withVersion } from "../../distribution/version.ts";

const root = resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-version-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("every plugin manifest names the version of package.json", () => {
  assert.deepEqual(mismatches(root), []);
  for (const file of MANIFESTS) assert.ok(versionsIn(readFileSync(join(root, file), "utf8")).length > 0, `${file} names a version`);
});

test("withVersion changes only the version fields", () => {
  const text = '{\n  "name": "x",\n  "version": "1.0.0",\n  "plugins": [{ "version": "1.0.0", "args": ["-y", "a"] }]\n}\n';
  assert.equal(withVersion(text, "2.0.0-rc.2"), text.replaceAll('"1.0.0"', '"2.0.0-rc.2"'));
  assert.deepEqual(versionsIn(withVersion(text, "2.0.0-rc.2")), ["2.0.0-rc.2", "2.0.0-rc.2"]);
});

test("sync copies a bumped package.json version into every manifest", () => {
  const copy = join(scratch, "repo");
  mkdirSync(copy);
  cpSync(join(root, "package.json"), join(copy, "package.json"));
  cpSync(join(root, ".claude-plugin"), join(copy, ".claude-plugin"), { recursive: true });
  const bumped = { ...(JSON.parse(readFileSync(join(copy, "package.json"), "utf8")) as Record<string, unknown>), version: "9.9.9-rc.7" };
  writeFileSync(join(copy, "package.json"), `${JSON.stringify(bumped, null, 2)}\n`);
  assert.equal(mismatches(copy).length, MANIFESTS.length);
  sync(copy);
  assert.equal(packageVersion(copy), "9.9.9-rc.7");
  assert.deepEqual(mismatches(copy), []);
});
