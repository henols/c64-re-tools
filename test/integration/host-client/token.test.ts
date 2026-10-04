// Container binding (D5/D6): a host that also listens beyond loopback needs
// the shared token from those clients; loopback clients need none.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { after, test } from "node:test";

import { HostConnection } from "../../../src/host-client/connect.ts";
import { isLoopback, startHostServer, type HostServer } from "../../../src/host/server.ts";
import { HOST_PROTOCOL_VERSION, parseClientMessage, ProtocolError, WireFailure } from "../../../src/protocol.ts";

const TOKEN = "a-shared-secret-of-some-length";
const outside = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === "IPv4" && !address.internal)?.address;
const skip = outside === undefined ? "this machine has no non-loopback IPv4 address" : false;

let server: HostServer | undefined;
after(async () => {
  await server?.close();
});

async function host(): Promise<HostServer> {
  server ??= await startHostServer({
    port: 0,
    extraHosts: [outside!],
    token: TOKEN,
    createViceSession: async () => {
      throw new WireFailure("machine-unavailable", "no emulators here");
    },
  });
  return server;
}

const connect = async (address: string, token?: string) => {
  const env: NodeJS.ProcessEnv = { C64RT_HOST: `${address}:${(await host()).port}` };
  if (token !== undefined) env.C64RT_HOST_TOKEN = token;
  const connection = await HostConnection.open({ role: "tool", env });
  await connection.close();
};

const refused = (error: unknown) => error instanceof WireFailure && error.code === "installation-incomplete" && /C64RT_HOST_TOKEN/.test(error.message);

test("loopback clients need no token", { skip }, async () => {
  await connect("127.0.0.1");
});

test("a client from outside loopback needs the right token", { skip }, async () => {
  await assert.rejects(connect(outside!), refused);
  await assert.rejects(connect(outside!, "a-wrong-secret-of-some-length!"), refused);
  await assert.rejects(connect(outside!, "short"), refused);
  await connect(outside!, TOKEN);
});

test("loopback addresses are recognised, also IPv4-mapped", () => {
  for (const address of ["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"]) assert.equal(isLoopback(address), true, address);
  for (const address of ["0.0.0.0", "172.17.0.1", "::ffff:10.0.0.1", "::"]) assert.equal(isLoopback(address), false, address);
});

test("a hello token must be a short string", () => {
  const hello = { type: "hello", protocol: "c64-re-tools-host", version: HOST_PROTOCOL_VERSION, role: "tool" };
  assert.equal(parseClientMessage({ ...hello, token: "x" }).type, "hello");
  assert.throws(() => parseClientMessage({ ...hello, token: 42 }), ProtocolError);
  assert.throws(() => parseClientMessage({ ...hello, token: "x".repeat(257) }), ProtocolError);
});

test("the host refuses --listen beyond loopback without a long enough token", () => {
  const main = resolve(import.meta.dirname, "../../../src/host/main.ts");
  const env = { ...process.env };
  delete env.C64RT_HOST_TOKEN;
  const run = spawnSync(process.execPath, [main, "--port", "0", "--listen", "10.255.255.1"], { encoding: "utf8", env });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /C64RT_HOST_TOKEN/);
  const short = spawnSync(process.execPath, [main, "--port", "0", "--listen", "10.255.255.1"], { encoding: "utf8", env: { ...env, C64RT_HOST_TOKEN: "short" } });
  assert.equal(short.status, 2);
});
