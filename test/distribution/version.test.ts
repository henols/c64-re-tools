import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { FEATURE, MANIFESTS, mismatches, packageVersion, releaseOf, set, versionsIn, withFeatureVersion, withVersion } from "../../distribution/version.ts";

const root = resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-version-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("every plugin manifest names the version of package.json", () => {
  assert.deepEqual(mismatches(root), []);
  for (const file of MANIFESTS) assert.ok(versionsIn(readFileSync(join(root, file), "utf8")).length > 0, `${file} names a version`);
});

test("a release tag names the version and the dist-tag", () => {
  assert.deepEqual(releaseOf("v2.0.0"), { version: "2.0.0", channel: "latest" });
  assert.deepEqual(releaseOf("v2.0.0-rc.2"), { version: "2.0.0-rc.2", channel: "next" });
  assert.deepEqual(releaseOf("v12.3.40-beta.1"), { version: "12.3.40-beta.1", channel: "next" });
  for (const tag of ["2.0.0", "v2.0", "v2.0.0.1", "vx.y.z", "v2.0.0-", "v2.0.0-rc..1", "release-2.0.0"]) {
    assert.throws(() => releaseOf(tag), /is not a release tag/, tag);
  }
});

test("withVersion changes only the version fields", () => {
  const text = '{\n  "name": "x",\n  "version": "1.0.0",\n  "plugins": [{ "version": "1.0.0", "args": ["-y", "a"] }]\n}\n';
  assert.equal(withVersion(text, "2.0.0-rc.2"), text.replaceAll('"1.0.0"', '"2.0.0-rc.2"'));
});

test("set writes the version into package.json and every manifest, and nothing else", () => {
  const copy = join(scratch, "repo");
  mkdirSync(copy);
  cpSync(join(root, "package.json"), join(copy, "package.json"));
  cpSync(join(root, ".claude-plugin"), join(copy, ".claude-plugin"), { recursive: true });
  mkdirSync(join(copy, FEATURE, ".."), { recursive: true });
  cpSync(join(root, FEATURE), join(copy, FEATURE));
  const before = readFileSync(join(copy, "package.json"), "utf8");
  set(copy, "2.0.0-rc.2");
  assert.equal(packageVersion(copy), "2.0.0-rc.2");
  assert.deepEqual(mismatches(copy), []);
  assert.equal(readFileSync(join(copy, "package.json"), "utf8"), withVersion(before, "2.0.0-rc.2"));
  const feature = JSON.parse(readFileSync(join(copy, FEATURE), "utf8")) as { version: string; dependsOn: Record<string, { version: string }> };
  assert.equal(feature.version, "2.0.0-rc.2");
  assert.deepEqual(Object.values(feature.dependsOn).map((dependency) => dependency.version), ["24", "21"], "the Node and Java versions stay");
});

test("the Feature's own version is its first version field", () => {
  assert.throws(() => withFeatureVersion('{ "dependsOn": { "x": { "version": "24" } }, "version": "1.0.0" }', "2.0.0"), /not the top-level one/);
});
