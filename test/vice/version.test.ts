// Coverage of version.mts's runtime precedence and the invariants around it.
//
// This file used to also cover a bespoke version-RESOLUTION algorithm (a
// `VERSION` template resolved against the published version under four named
// rules). That algorithm, its template and the CLI that drove it are gone --
// the git tag is the version now, and the publish workflow reads it from the
// ref -- so those tests went with the code they exercised rather than being
// rewritten against nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEV_PLACEHOLDER, runtimeVersion } from "../../src/mcp/vice/version.mts";

function scratchDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("runtimeVersion(): a real package.json version wins -- the published-tarball path", () => {
  const dir = scratchDir("ver-pkg-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ version: "1.2.3" }), "utf8");
    assert.equal(runtimeVersion({ pkgJsonPath: pkgPath }), "1.2.3");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtimeVersion(): a DEV_PLACEHOLDER package.json is not reported as a release", () => {
  const dir = scratchDir("ver-dev-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ version: DEV_PLACEHOLDER }), "utf8");
    assert.equal(runtimeVersion({ pkgJsonPath: pkgPath }), DEV_PLACEHOLDER);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtimeVersion(): degrades to DEV_PLACEHOLDER without throwing on no input, a missing file, or malformed JSON", () => {
  assert.equal(runtimeVersion(), DEV_PLACEHOLDER);
  assert.equal(runtimeVersion({ pkgJsonPath: join(tmpdir(), "definitely-absent-package.json") }), DEV_PLACEHOLDER);

  const dir = scratchDir("ver-bad-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, "{ this is not json", "utf8");
    assert.equal(runtimeVersion({ pkgJsonPath: pkgPath }), DEV_PLACEHOLDER);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
