// The context for running native tools inside a skill script or the CLI
// (D16): one supervisor whose exit guard stops every tool process group when
// the script ends, also on Ctrl+C or SIGTERM.

import { ProcessSupervisor } from "./processes.ts";

export interface LocalToolContext {
  supervisor: ProcessSupervisor;
  signal: AbortSignal;
}

let shared: LocalToolContext | undefined;

/** The script's one tool context; created on first use. */
export function localToolContext(): LocalToolContext {
  if (shared !== undefined) return shared;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const controller = new AbortController();
  // A signal ends the script through process.exit, so the exit guard runs.
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
    process.once(signal, () => {
      controller.abort();
      process.exit(code);
    });
  }
  shared = { supervisor, signal: controller.signal };
  return shared;
}
