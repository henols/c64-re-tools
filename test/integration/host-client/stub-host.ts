// A real Host Runtime server for the client tests that starts no emulator.

import { after } from "node:test";

import { startHostServer, type HostServer, type ToolDispatcher } from "../../../src/host/server.ts";
import { WireFailure } from "../../../src/protocol/messages.ts";

/**
 * Starts a Host Runtime server on a free port whose emulator sessions fail as machine-unavailable,
 * with the tool dispatcher when one is given. It closes after the test, or after the file when it starts outside a test.
 */
export async function noEmulatorHost(options: { host?: string; tools?: ToolDispatcher } = {}): Promise<HostServer> {
  const server = await startHostServer({
    ...options,
    port: 0,
    createViceSession: async () => {
      throw new WireFailure("machine-unavailable", "no emulators in this test");
    },
  });
  after(() => server.close());
  return server;
}
