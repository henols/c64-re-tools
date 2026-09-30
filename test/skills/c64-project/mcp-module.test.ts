// Coverage for mcp-module.ts -- the ONE resolution ladder skill scripts use
// to reach a module inside the OTHER package's `src/mcp/vice/` tree.
//
// Real files, no fixtures: this repo's own layout already has
// `src/mcp/vice/vsf-slice.ts` and `src/mcp/vice/transfer-paths.ts` on disk,
// so the "in-repo rung resolves" cases exercise the real tree rather than a
// synthetic stand-in -- and prove "no per-file special-casing" by resolving
// TWO different real file names through the identical code path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { invokeHostTool, invokeHostToolSync, publishedSubpath, resolveMcpModule, refusalMessage } from "../../../skills/c64-project/scripts/mcp-module.ts";

/** Runs `fn` with `process.env.VICE_MCP_DIR` set to `value` (or deleted when
 * `value` is `undefined`), always restoring the prior value afterward -- this
 * module reads the env var at call time (inside `ladder()`), so an in-process
 * override is sufficient; no subprocess needed. */
function withViceMcpDir<T>(value: string | undefined, fn: () => T): T {
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

test("resolveMcpModule: no per-file special-casing -- transfer-paths.ts resolves through the identical rungs", () => {
  withViceMcpDir(undefined, () => {
    const result = resolveMcpModule("transfer-paths.ts");
    assert.equal(result.ok, true);
    assert.equal(result.rung, "in-repo relative path");
    assert.ok(existsSync(result.path));
    assert.ok(result.path.endsWith(join("mcp", "vice", "transfer-paths.ts")));
  });
});

test("resolveMcpModule: the compiled endpoint client resolves through the in-repo rung", () => {
  withViceMcpDir(undefined, () => {
    const result = resolveMcpModule("resources/host-tool-endpoint.mjs");
    assert.equal(result.ok, true);
    assert.equal(result.rung, "in-repo relative path");
    assert.ok(result.path.endsWith(join("mcp", "vice", "resources", "host-tool-endpoint.mjs")));
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
  assert.match(message, /Claude Code plugin/, "the refusal names the plugin remedy");
  assert.doesNotMatch(message, /--vendor|npx/, "the refusal never names an install route");
});

test("publishedSubpath: a TypeScript target maps to its compiled dist/ copy, since Node never strips types under node_modules", () => {
  assert.equal(publishedSubpath("vsf-slice.ts"), "dist/vsf-slice.js");
  assert.equal(publishedSubpath("tool-location.mts"), "dist/tool-location.mjs");
  assert.equal(publishedSubpath("resources/host-tool-endpoint.mjs"), "resources/host-tool-endpoint.mjs");
  assert.equal(publishedSubpath("memmap.json"), "memmap.json");
});

// ---------------------------------------------------------------------------
// invokeHostTool with a stand-in endpoint client. The client is written into a
// scratch VICE_MCP_DIR at test time; it reads --tools-root and --args from its
// argv like the real one, writes the files the args name, and prints a reply.
// ---------------------------------------------------------------------------

const FAKE_CLIENT = `
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const argv = process.argv;
const arg = (name) => argv[argv.indexOf(name) + 1];
const args = JSON.parse(arg("--args"));
const root = arg("--tools-root");
if (args.fail) {
  console.log(JSON.stringify({ ok: false, message: args.fail }));
} else {
  const results = args.files.map((name) => {
    const path = join(root, name);
    writeFileSync(path, "produced " + name);
    return { path, sha256: "x", byteLength: 1 };
  });
  console.log("noise before the reply");
  console.log(JSON.stringify({ ok: true, tool: "fake", results }));
}
`;

function fakeEndpoint(): string {
  const dir = mkdtempSync(join(tmpdir(), "mcp-module-endpoint-"));
  mkdirSync(join(dir, "resources"));
  writeFileSync(join(dir, "resources", "host-tool-endpoint.mjs"), FAKE_CLIENT);
  return dir;
}

test("invokeHostTool moves each produced file into destDir and removes its staging directory", async () => {
  const endpoint = fakeEndpoint();
  const dest = mkdtempSync(join(tmpdir(), "mcp-module-dest-"));
  try {
    const response = await withViceMcpDirAsync(endpoint, () => invokeHostTool("fake", { files: ["a.txt", "b.txt"] }, { destDir: dest }));
    assert.equal(response.ok, true);
    assert.deepEqual(readdirSync(dest).sort(), ["a.txt", "b.txt"]);
    assert.equal(readFileSync(join(dest, "a.txt"), "utf8"), "produced a.txt");
    assert.deepEqual(response.results?.map((r) => r.path).sort(), [join(dest, "a.txt"), join(dest, "b.txt")]);
  } finally {
    rmSync(endpoint, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("invokeHostTool passes a client failure reply through and leaves destDir empty", async () => {
  const endpoint = fakeEndpoint();
  const dest = mkdtempSync(join(tmpdir(), "mcp-module-dest-"));
  try {
    const response = await withViceMcpDirAsync(endpoint, () => invokeHostTool("fake", { fail: "no broker" }, { destDir: dest }));
    assert.deepEqual(response, { ok: false, message: "no broker" });
    assert.deepEqual(readdirSync(dest), []);
  } finally {
    rmSync(endpoint, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("invokeHostToolSync returns the client's reply and removes its staging directory", () => {
  const endpoint = fakeEndpoint();
  try {
    const response = withViceMcpDir(endpoint, () => invokeHostToolSync("fake", { files: [] }));
    assert.equal(response.ok, true);
  } finally {
    rmSync(endpoint, { recursive: true, force: true });
  }
});

async function withViceMcpDirAsync<T>(value: string, fn: () => Promise<T>): Promise<T> {
  const prior = process.env.VICE_MCP_DIR;
  process.env.VICE_MCP_DIR = value;
  try {
    return await fn();
  } finally {
    if (prior === undefined) delete process.env.VICE_MCP_DIR;
    else process.env.VICE_MCP_DIR = prior;
  }
}
