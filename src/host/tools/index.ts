// The typed tool dispatcher of the Host Runtime. The host runs only
// VICE and the tools that come with it (c1541, petcat); skill scripts run
// ACME, DXA and Ghidra themselves. One entry per operation, never a
// generic executable route.

import type { ViceVersion } from "../../native/discover.ts";
import type { ProcessSupervisor } from "../../native/processes.ts";
import type { ToolContext } from "../../native/run.ts";
import type { ToolOperation, ToolOperations } from "../../protocol/tools.ts";
import type { ToolDispatcher } from "../server.ts";
import { inspect } from "./c1541.ts";
import { decode } from "./petcat.ts";
import { hostStatus } from "./status.ts";

/** Runs one operation with its validated parameters and attachments. */
type Adapter<O extends ToolOperation> = (
  params: ToolOperations[O]["params"],
  attachments: Buffer[],
  context: ToolContext,
) => Promise<{ result: ToolOperations[O]["result"]; attachments?: Buffer[] }>;

const ADAPTERS: { [O in ToolOperation]: Adapter<O> } = {
  "host.status": (_params, _attachments, context) => hostStatus(context),
  "c1541.inspect": (params, attachments, context) => inspect(params, attachments[0]!, context),
  "petcat.decode": (_params, attachments, context) => decode(attachments[0]!, context),
};

/** `vice`: the version that the host read from the emulator at start, for host.status. */
export function createToolDispatcher(options: { supervisor: ProcessSupervisor; env?: NodeJS.ProcessEnv; log?: (line: string) => void; vice?: ViceVersion }): ToolDispatcher {
  return (op, params, attachments, signal) => {
    const context = { supervisor: options.supervisor, signal, env: options.env, log: options.log };
    if (op === "host.status") return hostStatus(context, options.vice) as ReturnType<ToolDispatcher>;
    return ADAPTERS[op](params, attachments, context);
  };
}
