// Coverage for mcp-module.mjs -- the ONE resolution ladder skill scripts use
// to reach a module inside the OTHER package's `src/mcp/vice/` tree.
//
// Real files, no fixtures: this repo's own layout already has
// `src/mcp/vice/vsf-slice.ts` and `src/mcp/vice/host-tool-client.ts` on disk,
// so the "in-repo rung resolves" cases exercise the real tree rather than a
// synthetic stand-in -- and prove "no per-file special-casing" by resolving
// TWO different real file names through the identical code path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { resolveMcpModule, refusalMessage, TARGET_PACKAGE } from "./mcp-module.mjs";

/** Runs `fn` with `process.env.VICE_MCP_DIR` set to `value` (or deleted when
 * `value` is `undefined`), always restoring the prior value afterward -- this
 * module reads the env var at call time (inside `ladder()`), so an in-process
 * override is sufficient; no subprocess needed. */
function withViceMcpDir(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, "VICE_MCP_DIR");
  const prior = process.env.VICE_MCP_DIR;
  try {
    if (value === undefined) delete process.env.VICE_MCP_DIR;
    else process.env.VICE_MCP_DIR = value;
    return fn();
  } finally {
    if (had) process.env.VICE_MCP_DIR = prior;
    else delete process.env.VICE_MCP_DIR;
  }
}

test("TARGET_PACKAGE is the published MCP-side package name", () => {
  assert.equal(TARGET_PACKAGE, "@henols/vice-mcp");
});

test("resolveMcpModule: with VICE_MCP_DIR cleared, resolves the in-repo relative rung for vsf-slice.ts", () => {
  withViceMcpDir(undefined, () => {
    const result = resolveMcpModule("vsf-slice.ts");
    assert.equal(result.ok, true);
    assert.equal(result.rung, "in-repo relative path");
    assert.ok(existsSync(result.path), `expected ${result.path} to exist`);
    assert.ok(result.path.endsWith(join("mcp", "vice", "vsf-slice.ts")));
  });
});

test("resolveMcpModule: VICE_MCP_DIR rung resolves too, and is preferred over the in-repo path", () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-module-test-"));
  try {
    const fake = join(dir, "vsf-slice.ts");
    writeFileSync(fake, "// fake stand-in, not the real module\n");
    withViceMcpDir(dir, () => {
      const result = resolveMcpModule("vsf-slice.ts");
      assert.equal(result.ok, true);
      assert.equal(result.rung, "VICE_MCP_DIR");
      assert.equal(result.path, resolve(fake));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveMcpModule: no per-file special-casing -- host-tool-client.ts resolves through the identical rungs", () => {
  withViceMcpDir(undefined, () => {
    const result = resolveMcpModule("host-tool-client.ts");
    assert.equal(result.ok, true);
    assert.equal(result.rung, "in-repo relative path");
    assert.ok(existsSync(result.path));
    assert.ok(result.path.endsWith(join("mcp", "vice", "host-tool-client.ts")));
  });
});

test("resolveMcpModule: no rung resolves -- refuses by name, naming every rung tried and instructing VICE_MCP_DIR", () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-module-test-empty-"));
  try {
    withViceMcpDir(dir, () => {
      const result = resolveMcpModule("this-file-does-not-exist-anywhere.ts");
      assert.equal(result.ok, false);
      assert.equal(result.rungs.length, 3);
      assert.match(result.message, /could not resolve this-file-does-not-exist-anywhere\.ts/);
      assert.ok(result.message.includes(join(dir, "this-file-does-not-exist-anywhere.ts")));
      assert.match(result.message, /in-repo relative path/);
      assert.match(result.message, /@henols\/vice-mcp/);
      assert.match(result.message, /Set VICE_MCP_DIR/);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveMcpModule: returns the full rung list (never short-circuited) on a refusal", () => {
  withViceMcpDir(undefined, () => {
    const result = resolveMcpModule("this-file-does-not-exist-either.ts");
    assert.equal(result.ok, false);
    assert.equal(result.rungs.length, 3);
    const names = result.rungs.map((r) => r.rung);
    assert.deepEqual(names, ["VICE_MCP_DIR", "in-repo relative path", "@henols/vice-mcp package"]);
  });
});

test("refusalMessage: builds text naming every rung and the instruction to set VICE_MCP_DIR, independent of resolveMcpModule", () => {
  const rungs = [
    { rung: "VICE_MCP_DIR", path: null, note: "VICE_MCP_DIR is not set" },
    { rung: "in-repo relative path", path: "/some/path/thing.ts", note: null },
    { rung: "@henols/vice-mcp package", path: null, note: "not resolvable" },
  ];
  const message = refusalMessage("thing.ts", rungs);
  assert.match(message, /could not resolve thing\.ts/);
  assert.ok(message.includes("/some/path/thing.ts"));
  assert.match(message, /Set VICE_MCP_DIR to the directory holding thing\.ts/);
});
