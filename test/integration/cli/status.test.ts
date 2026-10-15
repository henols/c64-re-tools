import assert from "node:assert/strict";
import { test } from "node:test";

import { startHostServer, type ToolDispatcher } from "../../../src/host/server.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";
import { PACKAGE } from "../../../src/package.ts";
import { type HostInfo, type ToolStatus } from "../../../src/protocol/tools.ts";
import { hostStatusLines, mixedViceBuilds, toolLines } from "../../../src/cli/status.ts";

const HOST: HostInfo = { version: PACKAGE.version, platform: "linux", release: "6.12.0", arch: "x64" };

const HOST_TOOLS: ToolStatus[] = [
  { name: "VICE", found: true, path: "/opt/vice/bin/x64sc", version: "3.9", runs: true, flaws: ["Bits 5-7 read low."] },
  { name: "c1541", found: true, path: "/opt/vice/bin/c1541", runs: false, problem: "It stops at once. Install VICE again." },
  { name: "petcat", found: false, runs: false, problem: "Install VICE, which includes petcat." },
];

test("status names each tool with its version, or why it does not run", () => {
  assert.deepEqual(toolLines("Tools here:", HOST_TOOLS), [
    "Tools here:",
    "  VICE: 3.9 (/opt/vice/bin/x64sc)",
    "    Known flaw: Bits 5-7 read low.",
    "  c1541: found at /opt/vice/bin/c1541 but it does not run. It stops at once. Install VICE again.",
    "  petcat: missing. Install VICE, which includes petcat.",
  ]);
});

test("status shows a Host Runtime that answers, with the tools on the host", async () => {
  const requests: string[] = [];
  const tools = (async (op) => {
    requests.push(op);
    return { result: { host: HOST, tools: HOST_TOOLS } };
  }) as ToolDispatcher;
  const server = await startHostServer({
    port: 0,
    tools,
    createViceSession: () => Promise.reject(new WireFailure("machine-unavailable", "No VICE in this test.")),
  });
  try {
    assert.deepEqual(await hostStatusLines({ env: { C64RT_HOST: `${server.host}:${server.port}` } }), {
      lines: [`Host Runtime: reachable, c64-re-tools ${PACKAGE.version} on linux 6.12.0 (x64)`, ...toolLines("Tools on the host:", HOST_TOOLS)],
      ready: false,
    });
    assert.deepEqual(requests, ["host.status"]);
  } finally {
    await server.close();
  }
});

test("status shows a Host Runtime that does not answer as not reachable, with the cause", async () => {
  const server = await startHostServer({ port: 0, createViceSession: () => Promise.reject(new Error("unused")) });
  const endpoint = `${server.host}:${server.port}`;
  await server.close();
  const { lines, ready } = await hostStatusLines({ env: { C64RT_HOST: endpoint } });
  assert.equal(ready, false);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /^Host Runtime: not reachable\. \S/);
  assert.doesNotMatch(lines[0]!, /Stop the task/, "the instruction for an agent is not for a person");
});

test("status warns when x64sc, c1541 and petcat come from different VICE builds (R2-11)", () => {
  const tool = (name: string, version: string): ToolStatus => ({ name, found: true, path: `/bin/${name}`, version, runs: true });
  assert.equal(mixedViceBuilds([tool("VICE", "x64sc (VICE 3.10)"), tool("c1541", "c1541 (VICE 3.10)"), tool("petcat", "petcat (VICE 3.10)")]), undefined);
  const mixed = mixedViceBuilds([tool("VICE", "x64sc (VICE 3.10 SVN r46282)"), tool("c1541", "c1541 (VICE 3.10)"), tool("petcat", "petcat (VICE 3.10)")]);
  assert.match(mixed ?? "", /^the VICE tools come from different VICE builds: x64sc \(VICE 3\.10 SVN r46282\) \(\/bin\/VICE\), c1541 \(VICE 3\.10\)/);
});
