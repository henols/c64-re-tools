// The typed tool dispatcher of the Host Runtime (18 §8). The host runs only
// VICE and the tools that come with it (c1541, petcat); skill scripts run
// ACME, DXA and Ghidra themselves (D16). One entry per operation, never a
// generic executable route.

import type { ProcessSupervisor } from "../../native/processes.ts";
import type { ToolContext } from "../../native/run.ts";
import type { C1541Params } from "../../protocol.ts";
import type { ToolDispatcher } from "../server.ts";
import { inspect } from "./c1541.ts";
import { decode } from "./petcat.ts";
import { hostStatus } from "./status.ts";

export function createToolDispatcher(options: { supervisor: ProcessSupervisor; env?: NodeJS.ProcessEnv; log?: (line: string) => void }): ToolDispatcher {
  return (async (op, params, attachments, signal) => {
    const context: ToolContext = { supervisor: options.supervisor, signal, env: options.env, log: options.log };
    switch (op) {
      case "host.status":
        return hostStatus(context);
      case "c1541.inspect":
        return inspect(params as C1541Params, attachments[0]!, context);
      case "petcat.decode":
        return decode(attachments[0]!, context);
    }
    throw new Error(`no adapter for ${String(op)}`);
  }) as ToolDispatcher;
}
