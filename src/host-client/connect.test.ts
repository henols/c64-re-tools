import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { after, test } from "node:test";

import { encodeFrame, FrameDecoder, WireFailure, type HostMessage } from "../protocol.ts";
import { HostConnection, hostEndpoints } from "./connect.ts";

test("the default endpoints are loopback, then the Docker and Podman host bridges", () => {
  assert.deepEqual(hostEndpoints({}), [
    { host: "127.0.0.1", port: 6464 },
    { host: "host.docker.internal", port: 6464 },
    { host: "host.containers.internal", port: 6464 },
  ]);
});

test("C64RT_HOST replaces the endpoint list", () => {
  assert.deepEqual(hostEndpoints({ C64RT_HOST: "192.168.1.5:7000" }), [{ host: "192.168.1.5", port: 7000 }]);
  assert.deepEqual(hostEndpoints({ C64RT_HOST: "[::1]:6464" }), [{ host: "::1", port: 6464 }]);
  for (const bad of ["localhost", "host:", "host:0", "host:70000", ":6464"]) {
    assert.throws(() => hostEndpoints({ C64RT_HOST: bad }), WireFailure, bad);
  }
});

const servers: Server[] = [];
after(() => {
  for (const server of servers) server.close();
});

/** A fake host that answers the first frame with `answer` (or raw bytes). */
async function fakeHost(answer: HostMessage | Buffer | "silent" | "hangup"): Promise<NodeJS.ProcessEnv> {
  const server = createServer((socket: Socket) => {
    const decoder = new FrameDecoder();
    socket.on("data", (chunk) => {
      if (decoder.push(chunk).length === 0) return;
      if (answer === "silent") return;
      if (answer === "hangup") socket.destroy();
      else socket.write(Buffer.isBuffer(answer) ? answer : encodeFrame(answer));
    });
    socket.on("error", () => {});
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { C64RT_HOST: `127.0.0.1:${(server.address() as { port: number }).port}` };
}

async function closedPort(): Promise<NodeJS.ProcessEnv> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  server.close();
  await once(server, "close");
  return { C64RT_HOST: `127.0.0.1:${port}` };
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("a ready host yields an open connection", async () => {
  const connection = await HostConnection.open({ role: "vice-session", env: await fakeHost({ type: "ready" }) });
  await connection.close();
});

test("a host error during the handshake is passed through unchanged", async () => {
  const env = await fakeHost({ type: "error", error: { code: "installation-incomplete", message: "VICE (x64sc) is not installed on the host." } });
  await assert.rejects(HostConnection.open({ role: "vice-session", env }), (error: unknown) => {
    assert.ok(failsWith("installation-incomplete")(error));
    assert.equal((error as Error).message, "VICE (x64sc) is not installed on the host.");
    return true;
  });
});

test("a host that is not running is machine-unavailable for a VICE session and names the remedy", async () => {
  await assert.rejects(HostConnection.open({ role: "vice-session", env: await closedPort() }), (error: unknown) => {
    assert.ok(failsWith("machine-unavailable")(error));
    assert.match((error as Error).message, /c64-re-tools-host/);
    assert.doesNotMatch((error as Error).message, /127\.0\.0\.1|\d{4,}/);
    return true;
  });
  await assert.rejects(HostConnection.open({ role: "tool", env: await closedPort() }), failsWith("operation-failed"));
});

test("a host speaking another protocol is installation-incomplete", async () => {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(3, 0);
  const env = await fakeHost(Buffer.concat([header, Buffer.from("{x}")]));
  await assert.rejects(HostConnection.open({ role: "vice-session", env }), failsWith("installation-incomplete"));
});

test("a host that hangs up or stays silent fails the handshake without hanging", async () => {
  await assert.rejects(HostConnection.open({ role: "vice-session", env: await fakeHost("hangup") }), failsWith("machine-unavailable"));
  await assert.rejects(
    HostConnection.open({ role: "vice-session", env: await fakeHost("silent"), readyTimeoutMs: 50 }),
    failsWith("machine-unavailable"),
  );
});
