import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { after, test } from "node:test";

import { encodeFrame, FrameDecoder, WireFailure, type Request } from "../protocol.ts";
import { ViceSessionClient } from "./vice-session.ts";

const servers: Server[] = [];
after(() => {
  for (const server of servers) server.close();
});

/** A fake host: answers hello with ready, then hands each request to `onRequest`. */
async function fakeHost(onRequest: (socket: Socket, request: Request) => void): Promise<NodeJS.ProcessEnv> {
  const server = createServer((socket) => {
    const decoder = new FrameDecoder();
    socket.on("data", (chunk) => {
      for (const message of decoder.push(chunk) as Array<{ type: string }>) {
        if (message.type === "hello") socket.write(encodeFrame({ type: "ready" }));
        else onRequest(socket, message as Request);
      }
    });
    socket.on("error", () => {});
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { C64RT_HOST: `127.0.0.1:${(server.address() as { port: number }).port}` };
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("a malformed result is refused and the connection dropped", async () => {
  const env = await fakeHost((socket, request) => socket.write(encodeFrame({ type: "reply", id: request.id, result: { state: "dancing" } })));
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  await assert.rejects(client.status(), failsWith("operation-failed"));
  await client.closed;
  await assert.rejects(client.status(), failsWith("machine-state-lost"));
});

test("losing the host fails pending and later operations as lost machine state", async () => {
  const env = await fakeHost((socket) => socket.destroy());
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  await assert.rejects(client.registersGet("c64"), (error: unknown) => {
    assert.ok(failsWith("machine-state-lost")(error));
    assert.match((error as Error).message, /c64-re-tools-host/);
    return true;
  });
  await assert.rejects(client.memoryRead({ address: 0, size: 1, space: "c64", view: "cpu" }), failsWith("machine-state-lost"));
});

test("closing the session fails an open request and later ones as closed, not as lost machine state", async () => {
  let received!: () => void;
  const requestReceived = new Promise<void>((resolve) => (received = resolve));
  const env = await fakeHost(() => received());
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  const isClosed = (error: unknown) => failsWith("machine-unavailable")(error) && /session is closed/.test((error as Error).message);
  const open = assert.rejects(client.status(), isClosed);
  await requestReceived;
  await client.close();
  await open;
  await assert.rejects(client.status(), isClosed);
});

test("replies are matched to their requests by id", async () => {
  const held: Request[] = [];
  let socketRef: Socket | undefined;
  const env = await fakeHost((socket, request) => {
    socketRef = socket;
    held.push(request);
    if (held.length < 2) return;
    // Answer in reverse order.
    for (const r of held.reverse()) {
      const result = r.op === "status" ? { state: "running", videoStandard: "pal", warp: false, window: false } : { address: 0x10, data: "ff" };
      socketRef.write(encodeFrame({ type: "reply", id: r.id, result }));
    }
  });
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  const [status, memory] = await Promise.all([client.status(), client.memoryRead({ address: 0x10, size: 1, space: "c64", view: "cpu" })]);
  assert.equal(status.state, "running");
  assert.equal(memory.data, "ff");
  await client.close();
});
