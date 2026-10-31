// A fake Host Runtime for the client tests: a loopback server that reads the framed wire and answers as a test tells it.

import { once } from "node:events";
import { createServer, type AddressInfo, type Socket } from "node:net";
import { after } from "node:test";

import { encodeFrame } from "../protocol/framing.ts";
import { FrameDecoder } from "../protocol/framing.testkit.ts";
import type { ClientMessage, Hello } from "../protocol/messages.ts";
import { PACKAGE } from "../package.ts";

/**
 * Starts a fake host on a free loopback port and returns the environment that points a client at it.
 * `onMessage` gets each message that a client sends, with the socket to answer on; `onConnection` gets each socket first.
 * Nagle is off, as on the real host: else a delayed ACK costs about 40 ms for each round trip.
 * The server closes after the test, or after the file when it starts outside a test.
 */
export async function fakeHost(onMessage: (socket: Socket, message: ClientMessage) => void, onConnection: (socket: Socket) => void = () => {}): Promise<NodeJS.ProcessEnv> {
  const server = createServer({ noDelay: true }, (socket) => {
    onConnection(socket);
    const decoder = new FrameDecoder();
    socket.on("data", (chunk) => {
      for (const message of decoder.push(chunk)) onMessage(socket, message as ClientMessage);
    });
    socket.on("error", () => {});
  });
  after(() => server.close());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { C64RT_HOST: `127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/** A fake host that answers hello with ready of this release, and gives each later message to `onMessage`. */
export function readyHost(onMessage: (socket: Socket, message: Exclude<ClientMessage, Hello>) => void): Promise<NodeJS.ProcessEnv> {
  return fakeHost((socket, message) => {
    if (message.type === "hello") socket.write(encodeFrame({ type: "ready", release: PACKAGE.version }));
    else onMessage(socket, message);
  });
}
