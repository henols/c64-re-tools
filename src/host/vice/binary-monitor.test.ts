import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { after, test } from "node:test";

import {
  BinaryMonitor,
  Command,
  decodeBanks,
  decodeMemory,
  decodeProgramCounter,
  decodeRegisters,
  decodeRegistersAvailable,
  encodeCommand,
  EVENT_REQUEST_ID,
  memoryGetBody,
  MonitorConnectionError,
  MonitorError,
  MonitorTimeoutError,
  ResponseDecoder,
  type MonitorResponse,
} from "./binary-monitor.ts";

const hex = (text: string) => Buffer.from(text.replace(/[^0-9a-f]/gi, ""), "hex");

/** Builds a response frame the way VICE does. */
function response(type: number, requestId: number, body: Buffer = Buffer.alloc(0), error = 0): Buffer {
  const header = Buffer.alloc(12);
  header[0] = 0x02;
  header[1] = 0x02;
  header.writeUInt32LE(body.length, 2);
  header[6] = type;
  header[7] = error;
  header.writeUInt32LE(requestId, 8);
  return Buffer.concat([header, body]);
}

test("commands are framed as in the manual's checkpoint example", () => {
  const frame = encodeCommand(0x1234dead, Command.checkpointSet, hex("e2fc e3fc 01 01 04 01"));
  assert.deepEqual(frame, hex("02 02 08000000 adde3412 12 e2fc e3fc 01 01 04 01"));
});

test("a command without a body has a zero length field", () => {
  assert.deepEqual(encodeCommand(1, Command.ping), hex("02 02 00000000 01000000 81"));
});

test("the manual's register event and stopped event decode", () => {
  const registers = hex("02 02 26000000 31 00 ffffffff 0900 03 03 cfe5 03 00 0000");
  // The manual elides the rest of the array; pad it to the stated 0x26 length.
  const padded = Buffer.concat([registers, Buffer.alloc(0x26 - (registers.length - 12))]);
  const stopped = hex("02 02 02000000 62 00 ffffffff cfe5");
  const responses = new ResponseDecoder().push(Buffer.concat([padded, stopped]));
  assert.equal(responses.length, 2);
  assert.equal(responses[0]!.type, 0x31);
  assert.equal(responses[0]!.requestId, EVENT_REQUEST_ID);
  assert.deepEqual(decodeRegisters(responses[0]!.body).slice(0, 2), [
    { id: 3, value: 0xe5cf },
    { id: 0, value: 0 },
  ]);
  assert.equal(responses[1]!.type, 0x62);
  assert.equal(decodeProgramCounter(responses[1]!.body), 0xe5cf);
});

test("the decoder reassembles responses split at every byte and handles empty bodies", () => {
  const stream = Buffer.concat([response(0x81, 7), response(0x01, 8, hex("0300 a9008d"))]);
  for (let split = 0; split <= stream.length; split++) {
    const decoder = new ResponseDecoder();
    const all = [...decoder.push(stream.subarray(0, split)), ...decoder.push(stream.subarray(split))];
    assert.deepEqual(
      all.map((r) => [r.type, r.requestId, r.body.toString("hex")]),
      [
        [0x81, 7, ""],
        [0x01, 8, "0300a9008d"],
      ],
    );
  }
});

test("the decoder refuses a stream that is not the binary monitor protocol", () => {
  assert.throws(() => new ResponseDecoder().push(Buffer.from("READY.\r\nxxxxxxxx")), MonitorConnectionError);
  const wrongApi = response(0x81, 1);
  wrongApi[1] = 0x01;
  assert.throws(() => new ResponseDecoder().push(wrongApi), /API version/);
});

test("body codecs follow the manual", () => {
  assert.deepEqual(memoryGetBody({ start: 0xe000, end: 0xe00f, memspace: 1, bank: 1 }), hex("00 00e0 0fe0 01 0100"));
  assert.deepEqual(memoryGetBody({ start: 0, end: 1, memspace: 0, bank: 0, sideEffects: true }), hex("01 0000 0100 00 0000"));
  assert.deepEqual(decodeMemory(hex("0400 01020304")), hex("01020304"));
  // A full 64 KiB read reports length 0; the body is still authoritative.
  assert.equal(decodeMemory(Buffer.concat([hex("0000"), Buffer.alloc(65536)])).length, 65536);
  assert.deepEqual(decodeRegistersAvailable(hex("0200 05 03 10 02 5043 04 05 08 02 464c")), [
    { id: 3, bits: 16, name: "PC" },
    { id: 5, bits: 8, name: "FL" },
  ]);
  assert.deepEqual(decodeBanks(hex("0200 06 0000 03 637075 06 0100 03 72616d")), [
    { id: 0, name: "cpu" },
    { id: 1, name: "ram" },
  ]);
});

// ---------------------------------------------------------------------------
// Correlation against a fake monitor server

const servers: Server[] = [];
after(() => {
  for (const server of servers) server.close();
});

async function fakeMonitor(onCommand: (socket: Socket, requestId: number, command: number, body: Buffer) => void) {
  const server = createServer((socket) => {
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 11) {
        const length = pending.readUInt32LE(2);
        if (pending.length < 11 + length) break;
        onCommand(socket, pending.readUInt32LE(6), pending[10]!, pending.subarray(11, 11 + length));
        pending = pending.subarray(11 + length);
      }
    });
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no address");
  return BinaryMonitor.connect(address.port);
}

test("responses are matched by request id and events go to listeners", async () => {
  const monitor = await fakeMonitor((socket, id, command) => {
    // Like VICE entering the monitor: register event, stopped event, then the answer.
    socket.write(Buffer.concat([response(0x31, EVENT_REQUEST_ID, hex("0000")), response(0x62, EVENT_REQUEST_ID, hex("cfe5")), response(command, id)]));
  });
  const events: MonitorResponse[] = [];
  monitor.onEvent((event) => events.push(event));
  const reply = await monitor.request(Command.ping);
  assert.equal(reply.type, Command.ping);
  assert.deepEqual(
    events.map((event) => event.type),
    [0x31, 0x62],
  );
  await monitor.close();
});

test("concurrent requests resolve with their own responses even out of order", async () => {
  const held: Array<[Socket, number, number]> = [];
  const monitor = await fakeMonitor((socket, id, command) => {
    held.push([socket, id, command]);
    if (held.length === 2) {
      for (const [s, i, c] of held.reverse()) s.write(response(c, i, Buffer.from([i])));
    }
  });
  const [first, second] = await Promise.all([monitor.request(Command.ping), monitor.request(Command.viceInfo)]);
  assert.equal(first.type, Command.ping);
  assert.equal(second.type, Command.viceInfo);
  assert.notEqual(first.requestId, second.requestId);
  await monitor.close();
});

test("checkpoint-list style answers collect the earlier same-id responses", async () => {
  const monitor = await fakeMonitor((socket, id) => {
    socket.write(Buffer.concat([response(0x11, id, hex("01")), response(0x11, id, hex("02")), response(0x14, id, hex("02000000"))]));
  });
  const reply = await monitor.request(Command.checkpointList);
  assert.equal(reply.type, 0x14);
  assert.deepEqual(
    reply.extras.map((extra) => extra.body.toString("hex")),
    ["01", "02"],
  );
  await monitor.close();
});

test("a response of another type for a request rejects it at once", async () => {
  const monitor = await fakeMonitor((socket, id) => socket.write(response(0x11, id, Buffer.alloc(23))));
  const started = Date.now();
  await assert.rejects(monitor.request(Command.memoryGet, Buffer.alloc(8), 5000), (error: unknown) => error instanceof MonitorConnectionError && /type 0x11/.test((error as Error).message));
  assert.ok(Date.now() - started < 1000);
  await monitor.close();
});

test("checkpoint set resolves on its checkpoint-info answer", async () => {
  const monitor = await fakeMonitor((socket, id) => socket.write(response(0x11, id, Buffer.alloc(23))));
  assert.equal((await monitor.request(Command.checkpointSet, Buffer.alloc(8))).type, 0x11);
  await monitor.close();
});

test("a VICE error code rejects with MonitorError", async () => {
  const monitor = await fakeMonitor((socket, id, command) => socket.write(response(command, id, Buffer.alloc(0), 0x01)));
  await assert.rejects(monitor.request(Command.resourceGet), (error: unknown) => error instanceof MonitorError && error.errorCode === 0x01);
  await monitor.close();
});

test("a request without an answer times out and a late answer is ignored", async () => {
  let late: (() => void) | undefined;
  const monitor = await fakeMonitor((socket, id, command) => {
    late = () => socket.write(response(command, id));
  });
  await assert.rejects(monitor.request(Command.ping, undefined, 30), /no response/);
  late?.();
  // The connection stays usable.
  const next = monitor.request(Command.ping, undefined, 30);
  await assert.rejects(next, /no response/);
  await monitor.close();
});

test("while a request is overdue, later ones wait briefly; its late answer ends that; Infinity never times out", async () => {
  // A held VICE: nothing is answered until release() runs every command in order.
  const held: Array<() => void> = [];
  let holding = true;
  const monitor = await fakeMonitor((socket, id, command) => {
    const answer = () => socket.write(response(command, id));
    if (holding) held.push(answer);
    else answer();
  });
  monitor.overdueTimeoutMs = 50;
  await assert.rejects(monitor.request(Command.ping, undefined, 50), MonitorTimeoutError);
  // Overdue: a long limit is cut to the short one, but the command is still sent.
  await assert.rejects(monitor.request(Command.ping, undefined, 60_000), MonitorTimeoutError);
  assert.equal(held.length, 2);
  let settled = false;
  const waiting = monitor.request(Command.ping, undefined, Infinity).finally(() => (settled = true));
  // A request sent after it times out at the short limit; the one with no limit still waits.
  await assert.rejects(monitor.request(Command.ping, undefined, 60_000), MonitorTimeoutError);
  assert.equal(settled, false);
  holding = false;
  for (const answer of held.splice(0)) answer();
  await waiting;
  // The late answers came: the full limit applies again.
  await monitor.request(Command.ping, undefined, 60_000);
  await monitor.close();
});

test("the peer closing the connection rejects pending requests and reports why", async () => {
  const monitor = await fakeMonitor((socket) => socket.destroy());
  await assert.rejects(monitor.request(Command.ping), MonitorConnectionError);
  assert.ok((await monitor.closed) instanceof MonitorConnectionError);
  await assert.rejects(monitor.request(Command.ping), /closed/);
});

test("closing it ourselves resolves closed without a reason", async () => {
  const monitor = await fakeMonitor(() => {});
  await monitor.close();
  assert.equal(await monitor.closed, undefined);
});

test("connecting where nothing listens fails with MonitorConnectionError", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  server.close();
  await once(server, "close");
  await assert.rejects(BinaryMonitor.connect(address.port), MonitorConnectionError);
});
