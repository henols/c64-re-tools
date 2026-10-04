// The typed native-tool dispatcher (18 §8): one entry per supported
// operation, never a generic executable route.

import type { ProcessSupervisor } from "../processes.ts";
import type { ToolDispatcher } from "../server.ts";
import { assemble } from "./acme.ts";

export function createToolDispatcher(options: { supervisor: ProcessSupervisor; env?: NodeJS.ProcessEnv; log?: (line: string) => void }): ToolDispatcher {
  return (async (op, params, attachments, signal) => {
    const context = { supervisor: options.supervisor, signal, ...(options.env === undefined ? {} : { env: options.env }), ...(options.log === undefined ? {} : { log: options.log }) };
    switch (op) {
      case "acme.assemble":
        return assemble(params, attachments, context);
    }
    throw new Error(`no adapter for ${String(op)}`);
  }) as ToolDispatcher;
}
