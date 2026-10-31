import assert from "node:assert/strict";
import type { Socket } from "node:net";
import { test } from "node:test";

import { failsWith } from "../errors.testkit.ts";
import { encodeFrame, MAX_FRAME_BYTES } from "../protocol/framing.ts";
import type { Request } from "../protocol/messages.ts";
import { readyHost } from "./fake-host.testkit.ts";
import { LostBeforeAnswer, ViceSessionClient } from "./vice-session.ts";

/** A fake host: answers hello with ready, then hands each request to `onRequest`. */
const fakeHost = (onRequest: (socket: Socket, request: Request) => void) => readyHost((socket, message) => onRequest(socket, message as Request));

test("a malformed result is refused and the connection dropped", async () => {
  const env = await fakeHost((socket, request) => socket.write(encodeFrame({ type: "reply", id: request.id, result: { state: "dancing" } })));
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  await assert.rejects(client.status(), failsWith("operation-failed"));
  await client.closed;
  await assert.rejects(client.status(), failsWith("machine-state-lost"));
});

const HIT = { point: 0, pc: 0xc005, bytes: "8d11d0", text: "STA $d011", a: 0x1b, x: 0, y: 0, sp: 0xf6, frame: 0, rasterLine: 100, rasterCycle: 20, address: 0xd011, value: 0x1b };
const TRACE = { points: [{ kind: "write" as const, start: 0xd011, end: 0xd011 }], frames: 3000, maxHits: 20_000 };

test("trace hits come as the attachment of the reply, also many more than one message holds", async () => {
  const hits = Array.from({ length: 20_000 }, (_, index) => ({ ...HIT, frame: Math.floor(index / 10) }));
  const env = await fakeHost((socket, request) =>
    socket.write(encodeFrame({ type: "reply", id: request.id, result: { hits: hits.length, frames: 2000, end: "hits", pc: 0xc008 } }, [Buffer.from(JSON.stringify(hits))])),
  );
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  try {
    assert.ok(JSON.stringify(hits).length > MAX_FRAME_BYTES);
    assert.deepEqual(await client.trace(TRACE), { hits, frames: 2000, end: "hits", pc: 0xc008 });
  } finally {
    await client.close();
  }
});

test("trace hits that are malformed, or not as many as the reply tells, are refused and the connection dropped", async () => {
  for (const [count, attachments] of [
    [1, []],
    [2, [Buffer.from(JSON.stringify([HIT]))]],
    [1, [Buffer.from(JSON.stringify([{ ...HIT, a: 256 }]))]],
    [1, [Buffer.from("[{")]],
  ] as const) {
    const env = await fakeHost((socket, request) => socket.write(encodeFrame({ type: "reply", id: request.id, result: { hits: count, frames: 1, end: "frames", pc: 0 } }, attachments)));
    const client = await ViceSessionClient.open({ videoStandard: "pal", env });
    await assert.rejects(client.trace(TRACE), failsWith("operation-failed"));
    await client.closed;
  }
});

test("losing the host before the emulator answered fails pending and later operations as a call to do again", async () => {
  const env = await fakeHost((socket) => socket.destroy());
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  await assert.rejects(client.registersGet("c64"), (error: unknown) => error instanceof LostBeforeAnswer && failsWith("machine-unavailable", /No machine state was lost/)(error));
  await assert.rejects(client.memoryRead({ address: 0, size: 1, space: "c64", view: "cpu" }), (error: unknown) => error instanceof LostBeforeAnswer);
  assert.equal(client.lost, true);
});

test("a lost session tells whether it served calls and whether a call got the loss", async () => {
  // A host that answers warp and then drops the connection on the next request.
  let requests = 0;
  const env = await fakeHost((socket, request) => {
    requests++;
    if (requests === 1) socket.write(encodeFrame({ type: "reply", id: request.id, result: { enabled: true } }));
    else socket.destroy();
  });
  const fresh = await ViceSessionClient.open({ videoStandard: "pal", env });
  assert.equal(fresh.answered, false);
  await fresh.warp(true);
  assert.equal(fresh.answered, true);
  assert.equal(fresh.unreportedLoss, undefined, "a session that lives has no loss");
  await assert.rejects(fresh.warp(true), failsWith("machine-state-lost"));
  assert.equal(fresh.unreportedLoss, undefined, "the pending call got the loss");

  // The host drops a session between calls: nobody got the loss yet.
  let socketOf!: Socket;
  const quiet = await fakeHost((socket, request) => {
    socketOf = socket;
    socket.write(encodeFrame({ type: "reply", id: request.id, result: { enabled: true } }));
  });
  const idle = await ViceSessionClient.open({ videoStandard: "pal", env: quiet });
  await idle.warp(true);
  socketOf.destroy();
  await idle.closed;
  assert.ok(failsWith("machine-state-lost", /next call starts a new machine/)(idle.unreportedLoss));
});

test("closing the session fails an open request and later ones as closed, not as lost machine state", async () => {
  let received!: () => void;
  const requestReceived = new Promise<void>((resolve) => (received = resolve));
  const env = await fakeHost(() => received());
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  const isClosed = failsWith("machine-unavailable", /session is closed/);
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
      const result = r.op === "status" ? { state: "running", videoStandard: "pal", warp: false, window: false, cartridge: false } : { address: 0x10, data: "ff" };
      socketRef.write(encodeFrame({ type: "reply", id: r.id, result }));
    }
  });
  const client = await ViceSessionClient.open({ videoStandard: "pal", env });
  const [status, memory] = await Promise.all([client.status(), client.memoryRead({ address: 0x10, size: 1, space: "c64", view: "cpu" })]);
  assert.equal(status.state, "running");
  assert.equal(memory.data, "ff");
  await client.close();
});
