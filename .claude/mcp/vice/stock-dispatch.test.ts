// node:test coverage of stock-dispatch.ts. Task 1: the manifest selector
// (manifestPathForBackend()) and the two committed manifests it chooses
// between. Task 2 (added later in this same file): the lease-to-session
// seam (ensureStockSession()). Every test in this file is pure/offline --
// no broker process, no emulator, matching this plan's own environment
// constraint.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { manifestPathForBackend } from "./stock-dispatch.ts";
import { DENY_LIST } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK_MANIFEST_PATH = join(HERE, "tools-manifest.json");
const STOCK_MANIFEST_PATH = join(HERE, "tools-manifest.stock.json");

interface ManifestToolEntry {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface Manifest {
  generated_at: string;
  endpoint: string;
  tools: ManifestToolEntry[];
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8"));
}

// --------------------------------------------------------- manifestPathForBackend

test("manifest/backend: fork with no override resolves to <hereDir>/tools-manifest.json", () => {
  assert.equal(manifestPathForBackend("fork", HERE, undefined), join(HERE, "tools-manifest.json"));
});

test("manifest/backend: stock with no override resolves to <hereDir>/tools-manifest.stock.json", () => {
  assert.equal(manifestPathForBackend("stock", HERE, undefined), join(HERE, "tools-manifest.stock.json"));
});

test("manifest/backend: VICE_TOOLS_MANIFEST override wins for the fork backend, resolved", () => {
  assert.equal(manifestPathForBackend("fork", HERE, "/tmp/custom.json"), join("/tmp/custom.json"));
});

test("manifest/backend: VICE_TOOLS_MANIFEST override wins for the stock backend too -- same override, same resolved path", () => {
  const forkOverride = manifestPathForBackend("fork", HERE, "/tmp/custom.json");
  const stockOverride = manifestPathForBackend("stock", HERE, "/tmp/custom.json");
  assert.equal(stockOverride, forkOverride);
});

// --------------------------------------------------------- tools-manifest.stock.json shape

test("manifest/backend: tools-manifest.stock.json parses and carries the same three top-level keys as the fork manifest", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const fork = readManifest(FORK_MANIFEST_PATH);
  for (const key of ["generated_at", "endpoint", "tools"] as const) {
    assert.ok(key in stock, `stock manifest missing top-level key "${key}"`);
    assert.ok(key in fork, `fork manifest missing top-level key "${key}"`);
  }
});

test("manifest/backend: tools-manifest.stock.json's tools array contains a vice_ping entry", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  assert.ok(stock.tools.some((t) => t.name === "vice_ping"), "expected a vice_ping entry in the stock manifest");
});

test("manifest/backend: every stock tool name also exists in the fork manifest with an identical inputSchema", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const fork = readManifest(FORK_MANIFEST_PATH);
  for (const tool of stock.tools) {
    const match = fork.tools.find((t) => t.name === tool.name);
    assert.ok(match, `stock tool "${tool.name}" has no counterpart in the fork manifest`);
    assert.deepEqual(tool.inputSchema, match!.inputSchema, `"${tool.name}" inputSchema differs between backends`);
  }
});

test("manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const name of DENY_LIST) {
    assert.ok(!stock.tools.some((t) => t.name === name), `DENY_LIST name "${name}" must never appear in the stock manifest`);
  }
});
