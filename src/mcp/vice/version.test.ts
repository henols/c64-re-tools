// Coverage of version.ts's runtime precedence and the invariants around it.
//
// This file used to also cover a bespoke version-RESOLUTION algorithm (a
// `VERSION` template resolved against the published version under four named
// rules). That algorithm, its template and the CLI that drove it are gone --
// the git tag is the version now, and the publish workflow reads it from the
// ref -- so those tests went with the code they exercised rather than being
// rewritten against nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DEV_PLACEHOLDER, runtimeVersion } from "./version.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function scratchDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

// Anchored on `.claude-plugin/`, the repo-root marker. It used to anchor on
// the `VERSION` file, which no longer exists.
function findRepoRoot(from: string): string {
  let dir = from;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, ".claude-plugin"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not find repo root walking up from ${from}`);
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

test("placeholder consistency: every derived version string in the tree equals DEV_PLACEHOLDER", () => {
  const root = findRepoRoot(HERE);
  const readJson = (rel: string) => JSON.parse(readFileSync(join(root, rel), "utf8"));

  const vicePkg = readJson("src/mcp/vice/package.json");
  const installerPkg = readJson("installer/package.json");
  const pluginJson = readJson(".claude-plugin/plugin.json");
  const marketplaceJson = readJson(".claude-plugin/marketplace.json");

  assert.equal(vicePkg.version, DEV_PLACEHOLDER, "src/mcp/vice/package.json .version");
  assert.equal(installerPkg.version, DEV_PLACEHOLDER, "installer/package.json .version");
  assert.equal(
    installerPkg.dependencies["@henols/vice-mcp"],
    DEV_PLACEHOLDER,
    "installer/package.json .dependencies[@henols/vice-mcp]"
  );
  assert.equal(pluginJson.version, DEV_PLACEHOLDER, ".claude-plugin/plugin.json .version");
  assert.equal(marketplaceJson.version, DEV_PLACEHOLDER, ".claude-plugin/marketplace.json .version");
  assert.equal(
    marketplaceJson.plugins[0].version,
    DEV_PLACEHOLDER,
    ".claude-plugin/marketplace.json .plugins[0].version"
  );
});
