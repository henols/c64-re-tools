// node:test coverage of refresh-manifest.ts -- the module's first-ever test
// (01.6.1-06 Task 1). Structural template: incident-record.test.ts's
// env-var-redirect-to-tmpdir helper (VICE_TOOLS_MANIFEST here, mirroring
// that file's VICE_INCIDENTS_DIR); network shape borrowed from vice.test.ts's
// stub-http-server idiom, since this module calls vice.ts's serverInfo(),
// the same seam that test already stubs. Both are plain local HTTP servers
// standing in for the host handshake's PEER -- not a route to the emulator,
// and not the transport itself. Nothing here opens a connection to a real
// VICE instance; mcp__vice__* remains the only permitted route (CLAUDE.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "./refresh-manifest.ts";
import { useInstance, activeInstance } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Snapshot the real manifest before any test runs, so a final test can prove
// it was never touched -- structurally true anyway (every write-triggering
// test below redirects VICE_TOOLS_MANIFEST to a tmpdir first), but asserted
// directly rather than merely relied upon.
const REAL_MANIFEST_PATH = join(HERE, "tools-manifest.json");
let realManifestBefore: Buffer | null;
try {
  realManifestBefore = readFileSync(REAL_MANIFEST_PATH);
} catch {
  realManifestBefore = null;
}

async function withTempManifestPath<T>(fn: (path: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "vice-manifest-test-"));
  const path = join(dir, "tools-manifest.json");
  const prevPath = process.env.VICE_TOOLS_MANIFEST;
  const prevExitCode = process.exitCode;
  process.env.VICE_TOOLS_MANIFEST = path;
  try {
    return await fn(path);
  } finally {
    if (prevPath === undefined) delete process.env.VICE_TOOLS_MANIFEST;
    else process.env.VICE_TOOLS_MANIFEST = prevPath;
    process.exitCode = prevExitCode;
    rmSync(dir, { recursive: true, force: true });
  }
}

interface JsonRpcMessage {
  id: number | string;
  method: string;
}

/** A stub server speaking just enough MCP to answer `initialize` (always
 * succeeds) and `tools/list` (answered by `toolsListResult`, which the
 * caller controls per test -- a tools array, an object with none, or an
 * error object to simulate a rejected handshake). This stubs the
 * transport's PEER, exactly as vice.test.ts's own stub server does; it is
 * not a route to the real emulator. */
async function withStubHost<T>(
  toolsListResult: (msg: JsonRpcMessage) => unknown,
  fn: (port: number) => Promise<T> | T
): Promise<T> {
  const srv = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const msg: JsonRpcMessage = JSON.parse(body);
      const isError = msg.method === "initialize" && initializeShouldFail;
      if (msg.method === "initialize" && !initializeShouldFail) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05" } }));
        return;
      }
      if (isError) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            error: { code: -32000, message: "handshake rejected for testing" },
          })
        );
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: toolsListResult(msg) }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as AddressInfo).port;

  const originalInstance = activeInstance();
  try {
    useInstance({ port, url: `http://127.0.0.1:${port}/mcp`, epochFile: originalInstance.epochFile });
    return await fn(port);
  } finally {
    srv.close();
    useInstance(originalInstance);
  }
}

// Mutable per-test flag `withStubHost`'s closure reads -- simplest way to
// let one test drive a rejected handshake without a second helper shape.
let initializeShouldFail = false;

test("main() writes a manifest whose generated_at/endpoint/tools match a stub host's advertised tool list", async () => {
  initializeShouldFail = false;
  await withTempManifestPath(async (path) => {
    await withStubHost(
      () => ({
        tools: [
          { name: "vice_ping", description: "Ping the server" },
          { name: "vice_memory_read", description: "Read memory" },
        ],
      }),
      async () => {
        await main();
        const written = JSON.parse(readFileSync(path, "utf8"));
        assert.equal(typeof written.generated_at, "string");
        assert.equal(typeof written.endpoint, "string");
        assert.deepEqual(
          written.tools.map((t: { name: string }) => t.name),
          ["vice_ping", "vice_memory_read"]
        );
      }
    );
  });
});

test("main() respects VICE_TOOLS_MANIFEST -- the write lands at the redirected path, never the real sibling default", async () => {
  initializeShouldFail = false;
  await withTempManifestPath(async (path) => {
    await withStubHost(
      () => ({ tools: [{ name: "vice_ping" }] }),
      async () => {
        await main();
        assert.ok(readFileSync(path, "utf8").length > 0, "the redirected path must receive the write");
      }
    );
  });
  // The real manifest's bytes are unaffected by the test above -- checked
  // again at the end of this file's run in the dedicated snapshot test.
});

test("a rejected handshake leaves an existing manifest byte-identical and sets a non-zero exit code", async () => {
  initializeShouldFail = true;
  await withTempManifestPath(async (path) => {
    const original = { generated_at: "2020-01-01T00:00:00.000Z", endpoint: "http://stale", tools: [] };
    writeFileSync(path, JSON.stringify(original, null, 2) + "\n", "utf8");
    const before = readFileSync(path);

    await withStubHost(
      () => ({ tools: [] }), // never reached -- initialize itself is rejected
      async () => {
        await main();
      }
    );

    const after = readFileSync(path);
    assert.ok(before.equals(after), "the file on disk must be byte-identical after a rejected handshake");
    assert.notEqual(process.exitCode, 0, "a rejected handshake must set a non-zero exit code");
  });
});

test("a host that answers tools/list with no tools array at all yields a written manifest whose tools is an empty array", async () => {
  initializeShouldFail = false;
  await withTempManifestPath(async (path) => {
    await withStubHost(
      () => ({}), // no `tools` key whatsoever
      async () => {
        await main();
        const written = JSON.parse(readFileSync(path, "utf8"));
        assert.deepEqual(written.tools, []);
      }
    );
  });
});

test("after a successful write, no leftover tmp sibling remains and the file's mode is restricted", async () => {
  initializeShouldFail = false;
  await withTempManifestPath(async (path) => {
    await withStubHost(
      () => ({ tools: [{ name: "vice_ping" }] }),
      async () => {
        await main();
        const dir = dirname(path);
        const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
        assert.deepEqual(leftovers, [], "no tmp-* sibling may remain in the destination directory");
        const mode = statSync(path).mode;
        assert.equal(mode & 0o077, 0, "the written manifest must not be group- or world-readable");
      }
    );
  });
});

test("importing the module performs no handshake and writes nothing -- the entry-point guard", () => {
  const modulePath = fileURLToPath(new URL("./refresh-manifest.ts", import.meta.url));
  const tmpDir = mkdtempSync(join(tmpdir(), "vice-manifest-noop-test-"));
  const tmpManifest = join(tmpDir, "tools-manifest.json");
  try {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(modulePath)});\nconsole.log("NOOP");`],
      {
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, VICE_TOOLS_MANIFEST: tmpManifest },
      }
    );
    assert.equal(result.status, 0, `expected clean exit; stderr: ${result.stderr}`);
    assert.equal(result.stdout.trim(), "NOOP");
    assert.throws(() => readFileSync(tmpManifest), "a bare import must not write a manifest anywhere");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("the real tools-manifest.json is untouched by this entire test run", () => {
  let realManifestAfter: Buffer | null;
  try {
    realManifestAfter = readFileSync(REAL_MANIFEST_PATH);
  } catch {
    realManifestAfter = null;
  }
  if (realManifestBefore === null) {
    assert.equal(realManifestAfter, null, "the real manifest must not have been created by this test run");
  } else {
    assert.ok(
      realManifestAfter !== null && realManifestBefore.equals(realManifestAfter),
      "the real tools-manifest.json must be byte-identical before and after this test file's run"
    );
  }
});
