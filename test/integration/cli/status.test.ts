import assert from "node:assert/strict";
import { test } from "node:test";

import { startHostServer, type ToolDispatcher } from "../../../src/host/server.ts";
import { WireFailure, type ToolStatus } from "../../../src/protocol.ts";
import { hostStatusLines, toolLines } from "../../../src/cli/status.ts";

const HOST_TOOLS: ToolStatus[] = [
  { name: "VICE", found: true, path: "/opt/vice/bin/x64sc", version: "3.9", runs: true },
  { name: "c1541", found: true, path: "/opt/vice/bin/c1541", runs: false, problem: "It stops at once. Install VICE again." },
  { name: "petcat", found: false, runs: false, problem: "Install VICE, which includes petcat." },
];

test("status names each tool with its version, or why it does not run", () => {
  assert.deepEqual(toolLines("Tools here:", HOST_TOOLS), [
    "Tools here:",
    "  VICE: 3.9 (/opt/vice/bin/x64sc)",
    "  c1541: found at /opt/vice/bin/c1541 but it does not run. It stops at once. Install VICE again.",
    "  petcat: missing. Install VICE, which includes petcat.",
  ]);
});

test("status shows a Host Runtime that answers, with the tools on the host", async () => {
  const requests: string[] = [];
  const tools = (async (op) => {
    requests.push(op);
    return { result: { tools: HOST_TOOLS } };
  }) as ToolDispatcher;
  const server = await startHostServer({
    port: 0,
    tools,
    createViceSession: () => Promise.reject(new WireFailure("machine-unavailable", "No VICE in this test.")),
  });
  try {
    assert.deepEqual(await hostStatusLines({ env: { C64RT_HOST: `${server.host}:${server.port}` } }), [
      "Host Runtime: reachable",
      ...toolLines("Tools on the host:", HOST_TOOLS),
    ]);
    assert.deepEqual(requests, ["host.status"]);
  } finally {
    await server.close();
  }
});

test("status shows a Host Runtime that does not answer as not reachable, with the cause", async () => {
  const server = await startHostServer({ port: 0, createViceSession: () => Promise.reject(new Error("unused")) });
  const endpoint = `${server.host}:${server.port}`;
  await server.close();
  const lines = await hostStatusLines({ env: { C64RT_HOST: endpoint } });
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /^Host Runtime: not reachable\. \S/);
});
