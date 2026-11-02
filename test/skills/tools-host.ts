// A Host Runtime in the test process that runs the host tools (c1541, petcat) and no emulator.

import { after } from "node:test";

import { startHostServer, type HostServer } from "../../src/host/server.ts";
import { createToolDispatcher } from "../../src/host/tools/index.ts";
import { ProcessSupervisor } from "../../src/native/processes.ts";
import { WireFailure } from "../../src/protocol/messages.ts";

/**
 * The address (host:port) of a host with the host tools and no emulator. The
 * host starts at the first call and closes after the tests of the file.
 */
export function toolsHost(): () => Promise<string> {
  let server: Promise<HostServer> | undefined;
  after(async () => {
    await (await server)?.close();
  });
  return async () => {
    server ??= (() => {
      const supervisor = new ProcessSupervisor();
      supervisor.installExitGuard();
      return startHostServer({
        port: 0,
        createViceSession: async () => {
          throw new WireFailure("machine-unavailable", "no emulators here");
        },
        tools: createToolDispatcher({ supervisor }),
      });
    })();
    const { host, port } = await server;
    return `${host}:${port}`;
  };
}
