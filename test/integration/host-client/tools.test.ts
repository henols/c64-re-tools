// Contract test for native-tool requests: the real tools client against the
// real Host Runtime server with a stub dispatcher.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { assemble, callTool } from "../../../src/host-client/tools.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { startHostServer, type HostServer, type ToolDispatcher } from "../../../src/host/server.ts";
import { WireFailure } from "../../../src/protocol.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-tools-"));
mkdirSync(join(project, "src", "lib"), { recursive: true });
writeFileSync(join(project, "src", "main.a"), "* = $0801\n");
writeFileSync(join(project, "src", "lib", "consts.a"), "COLOR = 2\n");
process.chdir(project);

const servers: HostServer[] = [];
after(async () => {
  await Promise.all(servers.map((server) => server.close()));
  rmSync(project, { recursive: true, force: true });
});

async function host(tools?: ToolDispatcher): Promise<NodeJS.ProcessEnv> {
  const server = await startHostServer({
    port: 0,
    createViceSession: async () => {
      throw new WireFailure("machine-unavailable", "no emulators in this test");
    },
    ...(tools === undefined ? {} : { tools }),
  });
  servers.push(server);
  return { C64RT_HOST: `${server.host}:${server.port}` };
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("a tool request carries the source tree and gets the program back as an attachment", async () => {
  let seen: { params: unknown; files: string[] } | undefined;
  const env = await host(async (op, params, attachments) => {
    seen = { params, files: attachments.map(String) };
    assert.equal(op, "acme.assemble");
    return {
      result: { assembled: true, loadRange: { start: 0x0801, end: 0x0802, bytes: 2 }, symbols: [{ name: "start", kind: "address", value: 0x0801, used: true }], diagnostics: [] },
      attachments: [Buffer.from([0x01, 0x08, 0xea, 0x60])],
    } as never;
  });
  const result = await assemble({ sourceRoot: "src", entrySource: "main.a", includeDirs: ["lib"], defines: { DEBUG: 1 }, setPc: 0x0801 }, { env });
  assert.equal(result.assembled, true);
  assert.deepEqual([...result.program!], [0x01, 0x08, 0xea, 0x60]);
  assert.deepEqual(seen, {
    params: { files: [{ path: "lib/consts.a", size: 10 }, { path: "main.a", size: 10 }], entrySource: "main.a", includeDirs: ["lib"], defines: { DEBUG: 1 }, setPc: 0x0801 },
    files: ["COLOR = 2\n", "* = $0801\n"],
  });
});

test("tool errors and refusals keep their code", async () => {
  const env = await host(async () => {
    throw new WireFailure("installation-incomplete", "ACME (acme) is not installed on the host.");
  });
  await assert.rejects(assemble({ sourceRoot: "src", entrySource: "main.a" }, { env }), failsWith("installation-incomplete"));
  // The host validates parameters: an entry that is not in the tree.
  await assert.rejects(assemble({ sourceRoot: "src", entrySource: "nope.a" }, { env }), failsWith("invalid-input"));
  // A host without tool support refuses tool operations; a tool connection refuses emulator operations.
  const plain = await host();
  await assert.rejects(callTool("acme.assemble", { files: [], entrySource: "x", includeDirs: [], defines: {} }, [], { env: plain }), failsWith("invalid-input"));
  await assert.rejects(callTool("status" as never, {} as never, [], { env }), failsWith("invalid-input"));
  await assert.rejects(ViceSessionClient.open({ videoStandard: "pal", env }), failsWith("machine-unavailable"));
});

test("a client that disconnects aborts its tool request", async () => {
  let aborted: Promise<void> | undefined;
  let started!: () => void;
  const running = new Promise<void>((resolve) => (started = resolve));
  const env = await host(async (_op, _params, _attachments, signal) => {
    aborted = new Promise((resolve) => signal.addEventListener("abort", () => resolve()));
    started();
    await aborted;
    throw new WireFailure("operation-failed", "aborted");
  });
  const { HostConnection } = await import("../../../src/host-client/connect.ts");
  const connection = await HostConnection.open({ role: "tool", env });
  connection.send({ type: "request", id: 1, op: "acme.assemble", params: { files: [{ path: "a.a", size: 1 }], entrySource: "a.a", includeDirs: [], defines: {} } } as never, [Buffer.from("x")]);
  await running;
  await connection.close();
  await aborted;
});
