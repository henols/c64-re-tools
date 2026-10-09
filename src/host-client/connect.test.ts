import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { after, test, type TestContext } from "node:test";

import { encodeFrame, FrameDecoder, HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS, WireFailure, type HostMessage } from "../protocol.ts";
import { DEFAULT_READY_TIMEOUT_MS, HostConnection, hostEndpoints } from "./connect.ts";

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

/** A fake host that answers the first frame with `answer` (or raw bytes). `received` runs when a frame arrives. */
async function fakeHost(answer: HostMessage | Buffer | "silent" | "hangup", received: () => void = () => {}): Promise<NodeJS.ProcessEnv> {
  const server = createServer((socket: Socket) => {
    const decoder = new FrameDecoder();
    socket.on("data", (chunk) => {
      if (decoder.push(chunk).length === 0) return;
      received();
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
    assert.match((error as Error).message, /npx -y --package=@henols\/c64-re-tools@latest c64-re-tools-host/);
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

/**
 * A host that answers hello with ready, then answers each ping with pong while
 * `answer` holds. `pinged(n)` settles when the n-th ping arrives.
 */
async function heartbeatHost(answer: () => boolean): Promise<{ env: NodeJS.ProcessEnv; pinged: (n: number) => Promise<void> }> {
  let pings = 0;
  const waiting: Array<{ n: number; resolve: () => void }> = [];
  const server = createServer((socket: Socket) => {
    const decoder = new FrameDecoder();
    socket.on("data", (chunk) => {
      for (const message of decoder.push(chunk) as Array<{ type: string }>) {
        if (message.type === "hello") socket.write(encodeFrame({ type: "ready" }));
        if (message.type === "ping") {
          pings++;
          if (answer()) socket.write(encodeFrame({ type: "pong" }));
          for (const wait of waiting.filter((entry) => entry.n <= pings)) wait.resolve();
        }
      }
    });
    socket.on("error", () => {});
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    env: { C64RT_HOST: `127.0.0.1:${(server.address() as { port: number }).port}` },
    pinged: (n) => (n <= pings ? Promise.resolve() : new Promise((resolve) => waiting.push({ n, resolve }))),
  };
}

/** Moves the mocked clock on one second at a time, and lets the sockets run between the steps. */
async function advance(t: TestContext, ms: number): Promise<void> {
  for (let passed = 0; passed < ms; passed += 1_000) {
    t.mock.timers.tick(1_000);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("after ready the client pings at the interval, and a host that answers keeps the connection past the silence limit", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const host = await heartbeatHost(() => true);
  const connection = await HostConnection.open({ role: "vice-session", env: host.env });
  let gone = false;
  void connection.closed.then(() => (gone = true));
  const fifth = host.pinged(5);
  await advance(t, 5 * HEARTBEAT_INTERVAL_MS);
  await fifth;
  assert.ok(5 * HEARTBEAT_INTERVAL_MS > HEARTBEAT_TIMEOUT_MS);
  assert.equal(gone, false);
  await connection.close();
});

test("a host that stops answering closes the connection with a reason", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  let answering = true;
  const host = await heartbeatHost(() => answering);
  const connection = await HostConnection.open({ role: "vice-session", env: host.env });
  answering = false;
  await advance(t, HEARTBEAT_TIMEOUT_MS);
  const reason = await connection.closed;
  assert.match(String(reason), new RegExp(`sent nothing for ${HEARTBEAT_TIMEOUT_MS} ms`));
});

test("a message handler that throws closes the connection with a named reason instead of crashing the process", async () => {
  const connection = await HostConnection.open({ role: "vice-session", env: await fakeHost({ type: "ready" }) });
  connection.onMessage(() => {
    throw new TypeError("handler broke");
  });
  connection.send({ type: "request", id: 1, op: "status", params: {} });
  const reason = await connection.closed;
  assert.match(String(reason), /could not handle a message from the host runtime: handler broke/);
});

test("a stop signal ends a handshake that waits for the host at once and closes the socket", { timeout: 10_000 }, async () => {
  let helloReceived!: () => void;
  const hello = new Promise<void>((resolve) => (helloReceived = resolve));
  let hostSocketClosed!: Promise<unknown>;
  const server = createServer((socket: Socket) => {
    hostSocketClosed = once(socket, "close");
    socket.on("data", () => helloReceived());
    socket.on("error", () => {});
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const env = { C64RT_HOST: `127.0.0.1:${(server.address() as { port: number }).port}` };
  const stop = new AbortController();
  const opening = HostConnection.open({ role: "vice-session", env, signal: stop.signal });
  await hello;
  stop.abort();
  await assert.rejects(opening, (error: unknown) => failsWith("machine-unavailable")(error) && /stopped before the host runtime was ready/.test((error as Error).message));
  await hostSocketClosed;
  await assert.rejects(HostConnection.open({ role: "tool", env, signal: stop.signal }), failsWith("operation-failed"));
});

test("a host that hangs up fails the handshake without hanging", async () => {
  await assert.rejects(HostConnection.open({ role: "vice-session", env: await fakeHost("hangup") }), failsWith("machine-unavailable"));
});

test("a host that stays silent fails the handshake when the ready time ends, and not before", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  let helloReceived!: () => void;
  const hello = new Promise<void>((resolve) => (helloReceived = resolve));
  const opening = HostConnection.open({ role: "vice-session", env: await fakeHost("silent", helloReceived) });
  let settled = false;
  opening.then(
    () => (settled = true),
    () => (settled = true),
  );
  await hello;
  t.mock.timers.tick(DEFAULT_READY_TIMEOUT_MS - 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await assert.rejects(opening, failsWith("machine-unavailable"));
});
