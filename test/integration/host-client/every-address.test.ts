// A host on every address: a client from outside loopback, for example a dev
// container through host.docker.internal, connects with no setting.

import { networkInterfaces } from "node:os";
import { test } from "node:test";

import { HostConnection } from "../../../src/host-client/connect.ts";
import { noEmulatorHost } from "./stub-host.ts";

const outside = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === "IPv4" && !address.internal)?.address;

test("a client on an address that is not loopback connects with no setting", { skip: outside === undefined ? "this machine has no non-loopback IPv4 address" : false }, async () => {
  const server = await noEmulatorHost({ host: "0.0.0.0" });
  for (const address of ["127.0.0.1", outside!]) {
    const connection = await HostConnection.open({ role: "tool", env: { C64RT_HOST: `${address}:${server.port}` } });
    await connection.close();
  }
});
