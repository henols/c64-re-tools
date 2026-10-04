// Bounded native-tool execution (16 §3): argv only, no shell, a host-owned
// timeout, capped output, and the whole process group stopped on timeout or abort.

import type { ProcessSupervisor } from "../processes.ts";

export const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
export const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;

export interface ToolRun {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** True when output beyond the limit was dropped. */
  truncated: boolean;
}

export async function runTool(options: {
  argv: string[];
  cwd: string;
  supervisor: ProcessSupervisor;
  signal: AbortSignal;
  timeoutMs?: number;
  outputLimit?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<ToolRun> {
  const limit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;
  const child = options.supervisor.spawn(options.argv, {
    cwd: options.cwd,
    ...(options.env === undefined ? {} : { env: options.env }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  // "exit" can come before the output streams finish; "close" comes after both.
  const closed = new Promise<void>((resolve) => {
    if (child.pid < 0) resolve();
    else child.child.once("close", () => resolve());
  });
  const output = { stdout: "", stderr: "", truncated: false };
  const collect = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
    const room = limit - output.stdout.length - output.stderr.length;
    if (room <= 0) {
      output.truncated = true;
      return;
    }
    const text = chunk.toString("utf8");
    if (text.length > room) output.truncated = true;
    output[stream] += text.slice(0, room);
  };
  child.child.stdout?.on("data", collect("stdout"));
  child.child.stderr?.on("data", collect("stderr"));

  let timedOut = false;
  let aborted = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void child.stop();
  }, options.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS);
  const onAbort = () => {
    aborted = true;
    void child.stop();
  };
  if (options.signal.aborted) onAbort();
  else options.signal.addEventListener("abort", onAbort, { once: true });

  const status = await child.exited;
  await closed;
  clearTimeout(timer);
  options.signal.removeEventListener("abort", onAbort);
  // A tool that exited on its own may have left descendants in its group.
  await child.stop();
  return { ...status, ...output, timedOut, aborted };
}
