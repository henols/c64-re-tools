// Bounded native-tool execution: argv only, no shell, a fixed
// timeout, capped output, and the whole process group stopped on timeout or abort.

import { realpathSync } from "node:fs";
import { sep } from "node:path";
import { StringDecoder } from "node:string_decoder";

import { WireFailure } from "../protocol.ts";
import type { ProcessSupervisor } from "./processes.ts";

export const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
export const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;

/** What running a native tool needs from its caller: the supervisor that owns it, the request's abort signal, and optionally its environment and a log. */
export interface ToolContext {
  supervisor: ProcessSupervisor;
  signal: AbortSignal;
  env?: NodeJS.ProcessEnv | undefined;
  log?: ((line: string) => void) | undefined;
}

export interface ToolRun {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** True when output beyond the limit was dropped. */
  truncated: boolean;
  /** The error code, for example ENOENT, when the program did not start. */
  spawnError?: string;
}

const TAIL_LINES = 20;
const TAIL_CHARS = 2_000;

/**
 * The last lines that a tool printed, for a refusal: empty lines and lines
 * that do not match `only` are left out, and so is the workspace root in a
 * path. At most 20 lines and 2000 characters. Empty when nothing is left.
 */
export function outputTail(tool: string, run: Pick<ToolRun, "stdout" | "stderr">, root: string, only?: RegExp): string {
  const roots = new Set([root]);
  try {
    roots.add(realpathSync(root));
  } catch {
    // The workspace is gone: only the root as given is left out.
  }
  const variants = [...roots].flatMap((path) => [path, path.split(sep).join("/")]).sort((a, b) => b.length - a.length);
  const withoutRoot = (line: string) => variants.reduce((text, path) => text.split(`${path}${sep}`).join("").split(`${path}/`).join("").split(path).join("."), line);
  const lines = `${run.stdout}\n${run.stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && (only === undefined || only.test(line)))
    .slice(-TAIL_LINES)
    .map(withoutRoot);
  while (lines.length > 1 && lines.join("\n").length > TAIL_CHARS) lines.shift();
  const first = lines[0];
  if (first === undefined) return "";
  lines[0] = first.slice(-TAIL_CHARS);
  return `\nThe last output of ${tool}:\n  ${lines.join("\n  ")}`;
}

/** Spawn errors that mean the file is not a program that this system can start. */
const NOT_A_PROGRAM = new Set(["ENOENT", "EACCES", "ENOEXEC", "EFTYPE", "EINVAL", "EPERM", "ENOTDIR"]);

export async function runTool(options: {
  argv: string[];
  cwd: string;
  supervisor: ProcessSupervisor;
  signal: AbortSignal;
  timeoutMs?: number;
  outputLimit?: number;
  env?: NodeJS.ProcessEnv | undefined;
}): Promise<ToolRun> {
  const limit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;
  const child = options.supervisor.spawn(options.argv, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
  // "exit" can come before the output streams finish; "close" comes after both.
  const closed = new Promise<void>((resolve) => {
    if (child.pid < 0) resolve();
    else child.child.once("close", () => resolve());
  });
  const output = { stdout: "", stderr: "", truncated: false };
  // The limit counts bytes. A decoder per stream keeps a character whose bytes arrive in two chunks whole.
  let bytes = 0;
  const decoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
  const collect = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
    const room = limit - bytes;
    if (chunk.length > room) output.truncated = true;
    if (room <= 0) return;
    const kept = chunk.subarray(0, room);
    bytes += kept.length;
    output[stream] += decoders[stream].write(kept);
  };
  child.child.stdout?.on("data", collect("stdout"));
  child.child.stderr?.on("data", collect("stderr"));

  let timedOut = false;
  let aborted = false;
  // A failed stop here is not lost: the stop after the exit below tries again and rejects the run.
  const stopQuietly = () => {
    void child.stop().catch(() => {});
    // A process outside the group can hold the output pipes open: the run does not wait for it.
    child.child.stdout?.destroy();
    child.child.stderr?.destroy();
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stopQuietly();
  }, options.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS);
  const onAbort = () => {
    aborted = true;
    stopQuietly();
  };
  if (options.signal.aborted) onAbort();
  else options.signal.addEventListener("abort", onAbort, { once: true });

  try {
    const status = await child.exited;
    // A tool that exited may have left descendants in its group, and they can hold its output
    // pipes open: stop them before the wait for the end of the output.
    await child.stop();
    await closed;
    output.stdout += decoders.stdout.end();
    output.stderr += decoders.stderr.end();
    return { ...status, ...output, timedOut, aborted };
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Runs one task of a named tool and turns a cancelled or timed-out run, a
 * program that did not start and a stop by a signal into a WireFailure. With
 * `truncated`, output beyond the limit is refused with that message too. Any
 * exit code is returned to the caller. `root` (the default is `cwd`) is left
 * out of the tool output that a refusal quotes.
 */
export async function runToolOrFail(
  tool: string,
  task: string,
  options: { argv: string[]; cwd: string; timeoutMs: number; outputLimit?: number; truncated?: string; root?: string },
  context: ToolContext,
): Promise<ToolRun> {
  const { truncated, root, ...runOptions } = options;
  const run = await runTool({ ...runOptions, supervisor: context.supervisor, signal: context.signal, env: context.env });
  if (run.aborted) throw new WireFailure("operation-failed", `${task} was cancelled.`);
  if (run.timedOut) throw new WireFailure("operation-failed", `${tool} did not finish within ${options.timeoutMs / 1000} seconds.`);
  if (run.spawnError !== undefined) {
    if (NOT_A_PROGRAM.has(run.spawnError)) throw new WireFailure("installation-incomplete", `${tool} is not a program that this system can start (${run.spawnError}). Install it again.`);
    throw new WireFailure("operation-failed", `${tool} did not start (${run.spawnError}).`);
  }
  // A tool that a signal stopped has crashed: that is not a result of the task.
  if (run.signal !== null) throw new WireFailure("operation-failed", `${tool} stopped on the signal ${run.signal}.${outputTail(tool, run, root ?? options.cwd)}`);
  if (run.truncated && truncated !== undefined) throw new WireFailure("operation-failed", truncated);
  return run;
}
