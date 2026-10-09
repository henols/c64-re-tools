import assert from "node:assert/strict";
import { connect, type Socket } from "node:net";
import { networkInterfaces } from "node:os";
import { after, test } from "node:test";

import {
  encodeFrame,
  HOST_PROTOCOL_ID,
  HOST_PROTOCOL_VERSION,
  type ClientMessage,
  WireFailure,
} from "../protocol.ts";
import { FrameDecoder } from "../protocol.testkit.ts";
import { ListenError, parsePort, startHostServer, type HostServer, type ViceSessionFactory, type ViceSessionHandle } from "./server.ts";

const hello = { type: "hello", protocol: HOST_PROTOCOL_ID, version: HOST_PROTOCOL_VERSION, role: "vice-session" } as const;

/** A raw framed client: no host-client code, so these tests pin the wire. */
class RawClient {
  readonly messages: unknown[] = [];
  readonly closed: Promise<void>;
  readonly #socket: Socket;
  readonly #decoder = new FrameDecoder();
  #waiters: Array<() => void> = [];

  private constructor(socket: Socket) {
    this.#socket = socket;
    this.closed = new Promise((resolve) => socket.on("close", () => resolve()));
    // A reset from the host ends in "close" too.
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      this.messages.push(...this.#decoder.push(chunk));
      for (const wake of this.#waiters.splice(0)) wake();
    });
    socket.on("close", () => {
      for (const wake of this.#waiters.splice(0)) wake();
    });
  }

  /** With `halfOpen`, the client never closes its side by itself, also after the host has ended its side. */
  static open(server: HostServer, host = server.host, halfOpen = false): Promise<RawClient> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port: server.port, allowHalfOpen: halfOpen }, () => resolve(new RawClient(socket)));
      socket.once("error", reject);
    });
  }

  send(message: ClientMessage): void {
    this.#socket.write(encodeFrame(message));
  }

  sendRaw(bytes: Buffer): void {
    this.#socket.write(bytes);
  }

  /** Resolves with the next unread message, or undefined once the host has closed. */
  async next(): Promise<unknown> {
    while (this.messages.length === 0) {
      if (this.#socket.destroyed || this.#socket.readableEnded) return undefined;
      await new Promise<void>((resolve) => this.#waiters.push(resolve));
    }
    return this.messages.shift();
  }

  end(): void {
    this.#socket.end();
  }
}

interface StubLog {
  started: Array<{ videoStandard: string }>;
  closed: number;
}

function stubFactory(log: StubLog, overrides: Partial<ViceSessionHandle> = {}): ViceSessionFactory {
  return async ({ videoStandard }) => {
    log.started.push({ videoStandard });
    return {
      async handle(op, params) {
        if (op === "status") return { state: "running", videoStandard, warp: false, window: false } as never;
        if (op === "memoryRead") return { address: (params as { address: number }).address, data: "00" } as never;
        throw new WireFailure("unsupported-in-space", "stub");
      },
      async close() {
        log.closed++;
      },
      ...overrides,
    };
  };
}

const servers: HostServer[] = [];
after(async () => {
  await Promise.all(servers.map((server) => server.close()));
});

async function serve(factory: ViceSessionFactory, handshakeTimeoutMs?: number, heartbeatTimeoutMs?: number): Promise<HostServer> {
  const server = await startHostServer({
    port: 0,
    createViceSession: factory,
    ...(handshakeTimeoutMs === undefined ? {} : { handshakeTimeoutMs }),
    ...(heartbeatTimeoutMs === undefined ? {} : { heartbeatTimeoutMs }),
  });
  servers.push(server);
  return server;
}

test("the host binds to loopback only", async () => {
  const server = await serve(stubFactory({ started: [], closed: 0 }));
  assert.equal(server.host, "127.0.0.1");
  assert.ok(server.port > 0);
});

test("a vice-session handshake starts one session and answers ready", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send({ ...hello, videoStandard: "ntsc" });
  assert.deepEqual(await client.next(), { type: "ready" });
  assert.deepEqual(log.started, [{ videoStandard: "ntsc" }]);
  client.end();
});

test("the video standard defaults to PAL", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send(hello);
  await client.next();
  assert.deepEqual(log.started, [{ videoStandard: "pal" }]);
  client.end();
});

test("a protocol version mismatch is refused as installation-incomplete and closed", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send({ ...hello, version: HOST_PROTOCOL_VERSION + 1 });
  const reply = (await client.next()) as { type: string; error: { code: string } };
  assert.equal(reply.type, "error");
  assert.equal(reply.error.code, "installation-incomplete");
  assert.equal(await client.next(), undefined);
  await client.closed;
  assert.equal(log.started.length, 0, "no emulator may start for a mismatched client");
});

test("a malformed frame closes the connection and its session", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send(hello);
  await client.next();
  const header = Buffer.alloc(4);
  header.writeUInt32BE(5, 0);
  client.sendRaw(Buffer.concat([header, Buffer.from("{oops", "utf8")]));
  await client.closed;
  await waitFor(() => log.closed === 1);
});

test("an oversized frame header closes the connection", async () => {
  const client = await RawClient.open(await serve(stubFactory({ started: [], closed: 0 })));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(0xffff_ffff, 0);
  client.sendRaw(header);
  await client.closed;
});

test("a request before hello closes the connection", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send({ type: "request", id: 1, op: "status", params: {} });
  await client.closed;
  assert.equal(log.started.length, 0);
});

test("a silent connection is closed after the handshake timeout", async () => {
  const client = await RawClient.open(await serve(stubFactory({ started: [], closed: 0 }), 50));
  await client.closed;
});

test("requests are dispatched to the session and replies carry their id", async () => {
  const client = await RawClient.open(await serve(stubFactory({ started: [], closed: 0 })));
  client.send(hello);
  await client.next();
  client.send({ type: "request", id: 41, op: "status", params: {} });
  assert.deepEqual(await client.next(), { type: "reply", id: 41, result: { state: "running", videoStandard: "pal", warp: false, window: false } });
  client.send({ type: "request", id: 42, op: "registersGet", params: { space: "drive8" } });
  assert.deepEqual(await client.next(), {
    type: "reply",
    id: 42,
    error: { code: "unsupported-in-space", message: "stub" },
  });
  client.end();
});

test("invalid parameters are answered with invalid-input without reaching the session", async () => {
  let handled = 0;
  const factory = stubFactory({ started: [], closed: 0 }, {
    async handle() {
      handled++;
      return {} as never;
    },
  });
  const client = await RawClient.open(await serve(factory));
  client.send(hello);
  await client.next();
  client.send({ type: "request", id: 1, op: "memoryRead", params: { address: 0x10000, size: 1, space: "c64", view: "cpu" } });
  const reply = (await client.next()) as { error: { code: string } };
  assert.equal(reply.error.code, "invalid-input");
  client.send({ type: "request", id: 2, op: "format-disk" as never, params: {} });
  assert.equal(((await client.next()) as { error: { code: string } }).error.code, "invalid-input");
  assert.equal(handled, 0);
  client.end();
});

test("an unexpected session exception becomes operation-failed without internals", async () => {
  const factory = stubFactory({ started: [], closed: 0 }, {
    async handle() {
      throw new Error("ECONNRESET 127.0.0.1:41234 /tmp/vice-x");
    },
  });
  const client = await RawClient.open(await serve(factory));
  client.send(hello);
  await client.next();
  client.send({ type: "request", id: 9, op: "status", params: {} });
  const reply = (await client.next()) as { error: { code: string; message: string } };
  assert.equal(reply.error.code, "operation-failed");
  assert.doesNotMatch(reply.error.message, /ECONNRESET|127\.0\.0\.1|tmp/);
  client.end();
});

test("a session that fails to start is reported and the connection closed", async () => {
  const client = await RawClient.open(
    await serve(async () => {
      throw new WireFailure("installation-incomplete", "VICE (x64sc) is not installed.");
    }),
  );
  client.send(hello);
  assert.deepEqual(await client.next(), {
    type: "error",
    error: { code: "installation-incomplete", message: "VICE (x64sc) is not installed." },
  });
  await client.closed;
});

test("closing the connection closes its session", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send(hello);
  await client.next();
  client.end();
  await waitFor(() => log.closed === 1);
});

test("a ping is answered with pong and never reaches the session", async () => {
  const log: StubLog = { started: [], closed: 0 };
  let handled = 0;
  const client = await RawClient.open(await serve(stubFactory(log, { handle: async () => (handled++, {}) as never })));
  client.send(hello);
  assert.deepEqual(await client.next(), { type: "ready" });
  client.send({ type: "ping" });
  assert.deepEqual(await client.next(), { type: "pong" });
  assert.equal(handled, 0);
  client.end();
});

test("a ping before ready closes the connection", async () => {
  const client = await RawClient.open(await serve(stubFactory({ started: [], closed: 0 })));
  client.send({ type: "ping" });
  await client.closed;
});

test("a ready client that sends nothing for the heartbeat timeout is closed with its session (D18)", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log), undefined, 100));
  client.send(hello);
  assert.deepEqual(await client.next(), { type: "ready" });
  // Silent, like a client behind a connection that vanished without a close.
  await client.closed;
  await waitFor(() => log.closed === 1);
});

test("a client that keeps pinging stays open past the heartbeat timeout", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log), undefined, 150));
  client.send(hello);
  await client.next();
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    client.send({ type: "ping" });
    assert.deepEqual(await client.next(), { type: "pong" });
  }
  assert.equal(log.closed, 0);
  client.end();
  await waitFor(() => log.closed === 1);
});

test("a connection closed while its session starts still closes that session", async () => {
  const log: StubLog = { started: [], closed: 0 };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const inner = stubFactory(log);
  let entered = false;
  const client = await RawClient.open(
    await serve(async (options) => {
      entered = true;
      await gate;
      return inner(options);
    }),
  );
  client.send(hello);
  await waitFor(() => entered);
  client.end();
  await client.closed;
  release();
  await waitFor(() => log.closed === 1);
});

test("two connections own two independent sessions", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const server = await serve(stubFactory(log));
  const first = await RawClient.open(server);
  const second = await RawClient.open(server);
  first.send(hello);
  second.send(hello);
  await first.next();
  await second.next();
  assert.equal(log.started.length, 2);
  first.end();
  await waitFor(() => log.closed === 1);
  second.send({ type: "request", id: 1, op: "status", params: {} });
  assert.equal(((await second.next()) as { id: number }).id, 1);
  second.end();
  await waitFor(() => log.closed === 2);
});

test("closing the server closes every session", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const server = await startHostServer({ port: 0, createViceSession: stubFactory(log) });
  const clients = await Promise.all([RawClient.open(server), RawClient.open(server)]);
  for (const client of clients) client.send(hello);
  for (const client of clients) await client.next();
  await server.close();
  assert.equal(log.closed, 2);
  await Promise.all(clients.map((client) => client.closed));
});

test("a tool connection is ready without starting an emulator", async () => {
  const log: StubLog = { started: [], closed: 0 };
  const client = await RawClient.open(await serve(stubFactory(log)));
  client.send({ ...hello, role: "tool" });
  assert.deepEqual(await client.next(), { type: "ready" });
  client.send({ type: "request", id: 1, op: "status", params: {} });
  assert.equal(((await client.next()) as { error: { code: string } }).error.code, "invalid-input");
  assert.equal(log.started.length, 0);
  client.end();
});

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("operations get exactly the attachments they take", async () => {
  const seen: Buffer[][] = [];
  const factory = stubFactory({ started: [], closed: 0 }, {
    async handle(_op, _params, attachments) {
      seen.push(attachments ?? []);
      return { attached: true } as never;
    },
  });
  const client = await RawClient.open(await serve(factory));
  client.send(hello);
  await client.next();
  client.sendRaw(encodeFrame({ type: "request", id: 1, op: "diskAttach", params: { type: "d64" } }, [Buffer.from("disk")]));
  assert.deepEqual(await client.next(), { type: "reply", id: 1, result: { attached: true } });
  assert.deepEqual(seen, [[Buffer.from("disk")]]);
  client.send({ type: "request", id: 2, op: "diskAttach", params: { type: "d64" } });
  assert.equal(((await client.next()) as { error: { code: string } }).error.code, "invalid-input");
  client.sendRaw(encodeFrame({ type: "request", id: 3, op: "status", params: {} }, [Buffer.from("x")]));
  assert.equal(((await client.next()) as { error: { code: string } }).error.code, "invalid-input");
  assert.equal(seen.length, 1);
  client.end();
});

const outside = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === "IPv4" && !address.internal)?.address;

test("a token with multibyte characters is refused, and the host keeps serving", { skip: outside === undefined ? "this machine has no non-loopback IPv4 address" : false }, async () => {
  const token = "a-shared-secret-of-some-length";
  const server = await startHostServer({ port: 0, extraHosts: [outside!], token, createViceSession: stubFactory({ started: [], closed: 0 }) });
  servers.push(server);
  // The same number of characters as the token, but twice the bytes in UTF-8.
  const client = await RawClient.open(server, outside!);
  client.send({ ...hello, role: "tool", token: "\u00e9".repeat(token.length) });
  const reply = (await client.next()) as { type: string; error: { code: string } };
  assert.equal(reply.type, "error");
  assert.equal(reply.error.code, "installation-incomplete");
  await client.closed;
  const next = await RawClient.open(server, outside!);
  next.send({ ...hello, role: "tool", token });
  assert.deepEqual(await next.next(), { type: "ready" });
  next.end();
});

test("a session factory that throws at once is reported, and the host keeps serving", async () => {
  let calls = 0;
  const inner = stubFactory({ started: [], closed: 0 });
  const factory = ((options) => {
    calls++;
    if (calls === 1) throw new WireFailure("installation-incomplete", "VICE (x64sc) is not installed.");
    return inner(options);
  }) as ViceSessionFactory;
  const server = await serve(factory);
  const client = await RawClient.open(server);
  client.send(hello);
  assert.deepEqual(await client.next(), { type: "error", error: { code: "installation-incomplete", message: "VICE (x64sc) is not installed." } });
  await client.closed;
  const next = await RawClient.open(server);
  next.send(hello);
  assert.deepEqual(await next.next(), { type: "ready" });
  next.end();
});

test("a refused client that never closes its side is cut off", { timeout: 10_000 }, async () => {
  const refused = await RawClient.open(await serve(stubFactory({ started: [], closed: 0 })), undefined, true);
  refused.send({ ...hello, version: HOST_PROTOCOL_VERSION + 1 });
  assert.equal(((await refused.next()) as { type: string }).type, "error");
  await untilCutOff(refused);
  const failed = await RawClient.open(
    await serve(async () => {
      throw new WireFailure("machine-unavailable", "The emulator could not be started.");
    }),
    undefined,
    true,
  );
  failed.send(hello);
  assert.equal(((await failed.next()) as { type: string }).type, "error");
  await untilCutOff(failed);
});

/** Writes until a write fails: the host has then closed the connection on its side too. */
async function untilCutOff(client: RawClient): Promise<void> {
  let cut = false;
  void client.closed.then(() => (cut = true));
  while (!cut) {
    client.send({ type: "ping" });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test("a port is decimal digits from 0 to 65535 and nothing else", () => {
  for (const [text, port] of [["0", 0], ["6464", 6464], ["65535", 65535], ["007", 7]] as const) assert.equal(parsePort(text), port, text);
  for (const text of ["", " 7 ", "1e3", "0x10", "-1", "65536", "7.0", "+7", "99999999"]) assert.equal(parsePort(text), undefined, JSON.stringify(text));
});

test("a port in use names the address and the port that failed", async () => {
  const busy = await serve(stubFactory({ started: [], closed: 0 }));
  await assert.rejects(
    startHostServer({ port: busy.port, createViceSession: stubFactory({ started: [], closed: 0 }) }),
    (error: unknown) => error instanceof ListenError && error.code === "EADDRINUSE" && error.address === "127.0.0.1" && error.port === busy.port,
  );
  // An extra address that fails reports the port the first address got, not the 0 that was asked for.
  let tried = 0;
  await assert.rejects(startHostServer({ port: 0, extraHosts: ["127.0.0.1"], createViceSession: stubFactory({ started: [], closed: 0 }) }), (error: unknown) => {
    tried = error instanceof ListenError && error.code === "EADDRINUSE" && error.address === "127.0.0.1" ? error.port : -1;
    return true;
  });
  assert.ok(tried > 0, `the error names port ${tried}`);
});
