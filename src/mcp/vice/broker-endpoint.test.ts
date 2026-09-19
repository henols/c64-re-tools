// broker-endpoint.test.ts
//
// Plan 62-01, task 1: the genuine end-to-end case (a real listener, a real
// dial, a completed handshake), plus the structural assertions that keep
// this module's own written-down contract honest -- no filesystem access,
// no import of the legacy discovery-record client, and the two mirrored
// magic-string literals in byte-identical agreement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { startControlListener, HELLO_PROTOCOL_MAGIC as SERVER_HELLO_PROTOCOL_MAGIC, newControlToken } from "./broker-control.mts";
import { dialBrokerEndpoint, DIAL_CANDIDATES, HELLO_PROTOCOL_MAGIC } from "./broker-endpoint.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_ENDPOINT_TS = join(HERE, "broker-endpoint.ts");
const BROKER_CONTROL_MTS = join(HERE, "broker-control.mts");

/** Strips `//` line comments and `/* ... *\/` block comments -- the same
 * stripCommentLines() idiom hostpath-consumers.test.ts and
 * tool-location-consumers.test.ts already use for exactly this reason: this
 * module's own header comments NAME the forbidden fs calls and the legacy
 * client module (explaining what NOT to do), so a naive raw-source
 * substring check would trip on its own prose rather than on real code. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return;
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true;
        return;
      }
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return;
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// The genuine end-to-end case.
// ---------------------------------------------------------------------------

test("dialBrokerEndpoint completes a real handshake end to end against a real listener on an ephemeral port", async () => {
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0, // ephemeral -- never the production port literal
    token,
    onAcquire: async () => ({ ok: false, reason: "internal" }),
    onRelease: () => {},
    onRecycle: async () => ({ port: null, pid: null, viceBin: null, killStage: "no_signal", epochBefore: null, outcome: "n/a", reason: "no stub configured" }),
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 16,
      basePort: 6600,
      backend: "stock" as const,
    }),
    onMonitorClaim: () => ({ ok: false, code: "internal" as const }),
    onMonitorRelease: () => ({ ok: false, code: "internal" as const }),
    onHostTool: async () => ({ ok: false, message: "no onHostTool stub configured" }),
  });
  try {
    const result = await dialBrokerEndpoint({ port: listener.port, candidates: ["127.0.0.1"] });
    assert.equal(result.ok, true, `expected a completed handshake, got ${JSON.stringify(result)}`);
    if (result.ok) {
      assert.equal(result.port, listener.port);
      assert.equal(result.host, "127.0.0.1");
      assert.equal(typeof result.version, "string");
      assert.equal(result.tag, "control");
    }
  } finally {
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// The default candidate list.
// ---------------------------------------------------------------------------

test("DIAL_CANDIDATES is exactly the two fixed hosts, loopback first", () => {
  assert.deepEqual(DIAL_CANDIDATES, ["127.0.0.1", "host.docker.internal"]);
});

// ---------------------------------------------------------------------------
// Structural assertions: no filesystem access, no legacy-client import.
// ---------------------------------------------------------------------------

test("broker-endpoint.ts never touches the filesystem and never imports the legacy discovery-record client", () => {
  // readFileSync, not a shell grep -- four source files in this tree carry
  // NUL bytes that a shell grep silently skips (see this repo's own
  // documented gotcha); readFileSync with "utf8" never truncates on one.
  // Comment-stripped, because this module's own header comments NAME the
  // forbidden calls and the legacy module while explaining why they are
  // forbidden -- a raw substring check would trip on that prose, not on
  // real code.
  const source = stripCommentLines(readFileSync(BROKER_ENDPOINT_TS, "utf8"));
  for (const forbidden of ["readFileSync(", "existsSync(", "readFile(", "broker.json", "vice-broker-client"]) {
    assert.ok(!source.includes(forbidden), `broker-endpoint.ts must not contain ${JSON.stringify(forbidden)} outside of comments`);
  }
});

test("the mirrored HELLO_PROTOCOL_MAGIC literal in broker-endpoint.ts is byte-identical to broker-control.mts's own definition", () => {
  assert.equal(HELLO_PROTOCOL_MAGIC, SERVER_HELLO_PROTOCOL_MAGIC);

  // Belt and braces: read both literals directly out of source, not just
  // out of the imported runtime values, so a copy-paste that diverges only
  // in a comment-adjacent duplicate would still be caught.
  const clientSource = readFileSync(BROKER_ENDPOINT_TS, "utf8");
  const serverSource = readFileSync(BROKER_CONTROL_MTS, "utf8");
  const clientMatch = clientSource.match(/export const HELLO_PROTOCOL_MAGIC = "([^"]+)"/);
  const serverMatch = serverSource.match(/export const HELLO_PROTOCOL_MAGIC = "([^"]+)"/);
  assert.ok(clientMatch, "broker-endpoint.ts must export HELLO_PROTOCOL_MAGIC as a string literal");
  assert.ok(serverMatch, "broker-control.mts must export HELLO_PROTOCOL_MAGIC as a string literal");
  assert.equal(clientMatch![1], serverMatch![1]);
});
