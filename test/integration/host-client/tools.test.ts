// Contract test for native-tool requests: the real tools client against the
// real Host Runtime server with a stub dispatcher.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";

import { callTool, decodeBasic, inspectDisk } from "../../../src/host-client/tools.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { startHostServer, type HostServer, type ToolDispatcher } from "../../../src/host/server.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-tools-"));
mkdirSync(join(project, "src", "lib"), { recursive: true });
writeFileSync(join(project, "src", "main.a"), "* = $0801\n");
writeFileSync(join(project, "src", "lib", "consts.a"), "COLOR = 2\n");
mkdirSync(join(project, "media"));
writeFileSync(join(project, "media", "game.D64"), Buffer.from([0xd6, 0x40]));
writeFileSync(join(project, "media", "loader.prg"), Buffer.from([0x01, 0x08, 0x00, 0x00]));
const home = process.cwd();
// Project paths are relative to the working directory: each test runs in the project.
beforeEach(() => process.chdir(project));
// Windows cannot remove the current directory.
afterEach(() => process.chdir(home));

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

test("tool errors and refusals keep their code", async () => {
  const env = await host(async () => {
    throw new WireFailure("installation-incomplete", "petcat is not installed on the host.");
  });
  await assert.rejects(decodeBasic({ program: "media/loader.prg" }, { env }), failsWith("installation-incomplete"));
  // The host validates parameters: a disk request without its action.
  await assert.rejects(callTool("c1541.inspect", { imageType: "d64" } as never, [Buffer.from([0])], { env }), failsWith("invalid-input"));
  // A host without tool support refuses tool operations; a tool connection refuses emulator operations.
  const plain = await host();
  await assert.rejects(callTool("petcat.decode", {}, [Buffer.from([1, 8, 0, 0])], { env: plain }), failsWith("invalid-input"));
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
  connection.send({ type: "request", id: 1, op: "petcat.decode", params: {} } as never, [Buffer.from([1, 8, 0, 0])]);
  await running;
  await connection.close();
  await aborted;
});

test("a disk request sends the image with its type and gets a read file back as data", async () => {
  const seen: unknown[] = [];
  const env = await host(async (op, params, attachments) => {
    seen.push({ op, params, image: [...attachments[0]!] });
    return { result: { action: "read", found: true, name: "GAME", bytes: 3 }, attachments: [Buffer.from([1, 8, 0x60])] } as never;
  });
  const read = await inspectDisk({ image: "media/game.D64", action: "read", name: "game" }, { env });
  assert.deepEqual(read, { action: "read", found: true, name: "GAME", bytes: 3, data: Buffer.from([1, 8, 0x60]) });
  assert.deepEqual(seen, [{ op: "c1541.inspect", params: { action: "read", imageType: "d64", name: "game" }, image: [0xd6, 0x40] }]);
  await assert.rejects(inspectDisk({ image: "media/loader.prg", action: "directory" }, { env }), failsWith("invalid-input"));
  await assert.rejects(inspectDisk({ image: "media/game.D64", action: "directory", name: "X" }, { env }), failsWith("invalid-input"));
});

test("a BASIC request sends the program and gets the decoded listing", async () => {
  const decoded = { decoded: true, loadAddress: 0x0801, basicEnd: 0x0803, listing: "", lines: [], handoffs: [] };
  const env = await host(async (op, params, attachments) => {
    assert.equal(op, "petcat.decode");
    assert.deepEqual(params, {});
    assert.deepEqual([...attachments[0]!], [0x01, 0x08, 0x00, 0x00]);
    return { result: decoded } as never;
  });
  assert.deepEqual(await decodeBasic({ program: "media/loader.prg" }, { env }), decoded);
  await assert.rejects(decodeBasic({ program: "media/missing.prg" }, { env }), failsWith("not-found"));
});
