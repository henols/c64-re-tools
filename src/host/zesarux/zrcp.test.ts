import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import { Zrcp } from "./zrcp.ts";

/** A ZRCP server that answers each line in order with "<line> done" and a prompt; "slow" takes `slowMs`. */
async function server(slowMs: number): Promise<{ port: number; close: () => void }> {
  const sockets: Socket[] = [];
  const listener = createServer((socket) => {
    sockets.push(socket);
    socket.write("Welcome\ncommand> ");
    let buffer = "";
    let queue = Promise.resolve();
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        queue = queue.then(async () => {
          if (line === "slow") await new Promise((resolve) => setTimeout(resolve, slowMs));
          if (!socket.destroyed) socket.write(`${line} done\ncommand@cpu-step> `);
        });
      }
    });
  });
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const address = listener.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return {
    port: address.port,
    close: () => {
      for (const socket of sockets) socket.destroy();
      listener.close();
    },
  };
}

const closers: Array<() => void> = [];
after(() => closers.forEach((close) => close()));

test("a command that times out is machine-unavailable, and its late answer does not go to the next command", async () => {
  const fake = await server(300);
  closers.push(fake.close);
  const zrcp = await Zrcp.connect(fake.port, 2_000);
  closers.push(() => zrcp.close());
  await assert.rejects(zrcp.command("slow", 50), (error) => error instanceof WireFailure && error.code === "machine-unavailable" && /no answer/.test(error.message));
  assert.equal(await zrcp.command("next"), "next done");
  assert.equal(await zrcp.command("after", 1_000), "after done");
});

test("a command with no timeout waits for its answer", async () => {
  const fake = await server(200);
  closers.push(fake.close);
  const zrcp = await Zrcp.connect(fake.port, 2_000);
  closers.push(() => zrcp.close());
  assert.equal(await zrcp.command("slow", "none"), "slow done");
});

test("a closed connection is machine-unavailable", async () => {
  const fake = await server(0);
  const zrcp = await Zrcp.connect(fake.port, 2_000);
  fake.close();
  await assert.rejects(zrcp.command("next"), (error) => error instanceof WireFailure && error.code === "machine-unavailable");
  zrcp.close();
});
