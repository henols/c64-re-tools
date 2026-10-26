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
          if (line === "silent") return;
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

test("a timed-out command closes the connection before any late answer can reach another command", async () => {
  const fake = await server(300);
  closers.push(fake.close);
  const zrcp = await Zrcp.connect(fake.port, 2_000);
  closers.push(() => zrcp.close());
  await assert.rejects(zrcp.command("slow", 50), (error) => error instanceof WireFailure && error.code === "machine-unavailable" && /no answer/.test(error.message));
  assert.equal(zrcp.closed, true);
  await assert.rejects(zrcp.command("next"), (error) => error instanceof WireFailure && error.code === "machine-unavailable");
});

test("a command that never replies cannot consume the response to a queued command", async () => {
  const fake = await server(0);
  closers.push(fake.close);
  const zrcp = await Zrcp.connect(fake.port, 2_000);
  closers.push(() => zrcp.close());
  const first = zrcp.command("silent", 50);
  const queued = assert.rejects(zrcp.command("next"), (error) => error instanceof WireFailure && error.code === "machine-unavailable");
  await assert.rejects(first, (error) => error instanceof WireFailure && error.code === "machine-unavailable");
  await queued;
  assert.equal(zrcp.closed, true);
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

test("the line feed of an interrupt that crosses the stop of a run leaves no empty answer for the next command", async () => {
  // As ZEsarUX: "run" answers when the CPU stops, and a line feed at the prompt gets a prompt of its own.
  const sockets: Socket[] = [];
  const listener = createServer((socket) => {
    sockets.push(socket);
    socket.write("Welcome\ncommand> ");
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (line === "run") setTimeout(() => socket.write("Running until a breakpoint\nPC=1234\ncommand@cpu-step> "), 30);
        else if (line === "") socket.write("command@cpu-step> ");
        else if (line === "get-version") socket.write("13.0\ncommand@cpu-step> ");
        else socket.write(`${line} done\ncommand@cpu-step> `);
      }
    });
  });
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  closers.push(() => {
    for (const socket of sockets) socket.destroy();
    listener.close();
  });
  const zrcp = await Zrcp.connect((listener.address() as { port: number }).port, 2_000);
  closers.push(() => zrcp.close());
  const run = zrcp.command("run", "none");
  // The run stops on its own; the line feed of a pause reaches ZEsarUX at its prompt.
  await new Promise((resolve) => setTimeout(resolve, 60));
  zrcp.interrupt();
  assert.match(await run, /PC=1234/);
  assert.equal(await zrcp.command("get-registers"), "get-registers done");
  assert.equal(await zrcp.command("read-memory"), "read-memory done");
  // Two line feeds, and one that ends the run: no answer is left over either way.
  zrcp.interrupt();
  zrcp.interrupt();
  assert.equal(await zrcp.command("next"), "next done");
});
