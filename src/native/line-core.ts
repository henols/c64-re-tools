// A replay core session: one core process (c64run, zxrun) for the life of a
// skill script, driven by one command line and one answer line at a time over
// its stdin and stdout. It is started through the supervisor like every native
// tool, so it stops with the script.

import { createInterface } from "node:readline";

import { WireFailure } from "../protocol/messages.ts";
import { findTool, type ToolSpec } from "./discover.ts";
import type { SupervisedProcess } from "./processes.ts";
import type { ToolContext } from "./run.ts";

const STOP_MS = 5_000;
/** How long a core may take to answer a command, beyond the run up to a target tick. */
const COMMAND_MS = 30_000;
/** The slowest run that a command limit allows for: c64run runs about 6 million cycles per second. */
const SLOWEST_CYCLES_PER_SECOND = 1_000_000;

/**
 * The time limit of a command, so that a core that hangs cannot keep the
 * script running. run, run-pc and run-reads end with the absolute tick that
 * they run to at most; the others answer at once.
 */
export function commandLimitMs(text: string): number {
  const [name, ...rest] = text.split(" ");
  const target = name === "run" || name === "run-pc" || name === "run-reads" ? Number(rest.at(-1)) : 0;
  return COMMAND_MS + (Number.isFinite(target) ? (target * 1000) / SLOWEST_CYCLES_PER_SECOND : 0);
}

/** The core program and the command protocol that its session speaks. */
export interface LineCoreSpec {
  tool: ToolSpec;
  protocol: number;
}

export class LineCoreSession {
  readonly #name: string;
  readonly #process: SupervisedProcess;
  readonly #waiting: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  #stderr = "";
  #ended: WireFailure | undefined;

  constructor(spec: LineCoreSpec, process: SupervisedProcess) {
    this.#name = spec.tool.name;
    this.#process = process;
    const child = process.child;
    // A core that ended (or never started) closes its stdin: the exit handler reports it.
    child.stdin!.on("error", () => {});
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => (this.#stderr = (this.#stderr + chunk).slice(-4000)));
    createInterface({ input: child.stdout! }).on("line", (line) => this.#waiting.shift()?.resolve(line));
    void process.exited.then((status) => {
      const how = status.spawnError !== undefined ? `did not start (${status.spawnError})` : `ended (exit ${status.code ?? status.signal})`;
      // A core stopped because it did not answer keeps that reason.
      this.#ended ??= new WireFailure(status.spawnError !== undefined ? "installation-incomplete" : "operation-failed", `${this.#name} ${how}.${this.#stderr === "" ? "" : ` ${this.#stderr.trim()}`}`);
      for (const waiting of this.#waiting.splice(0)) waiting.reject(this.#ended);
    });
  }

  /**
   * Sends one command and gives its "ok ..." answer. An "err ..." answer throws operation-failed.
   * A core that does not answer within the limit is stopped: every command then fails.
   */
  command(text: string, limitMs = commandLimitMs(text)): Promise<string> {
    if (this.#ended !== undefined) return Promise.reject(this.#ended);
    const answer = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#ended = new WireFailure("operation-failed", `${this.#name} ${text.split(" ")[0]} did not answer in ${Math.ceil(limitMs / 1000)} s; the core is stopped.`);
        for (const waiting of this.#waiting.splice(0)) waiting.reject(this.#ended);
        void this.#process.stop().catch(() => {});
      }, limitMs);
      const done = () => clearTimeout(timer);
      this.#waiting.push({
        resolve: (line) => (done(), resolve(line)),
        reject: (error) => (done(), reject(error)),
      });
    });
    this.#process.child.stdin!.write(`${text}\n`);
    return answer.then((line) => {
      if (line.startsWith("ok")) return line;
      throw new WireFailure("operation-failed", `${this.#name} ${text.split(" ")[0]}: ${line.replace(/^err /, "")}`);
    });
  }

  /** Writes bytes into memory, in parts that fit one command line. */
  async write(address: number, bytes: Uint8Array): Promise<void> {
    for (let at = 0; at < bytes.length; at += 4096) {
      await this.command(`write ${((address + at) & 0xffff).toString(16)} ${Buffer.from(bytes.subarray(at, at + 4096)).toString("hex")}`);
    }
  }

  /** Memory bytes as the core's peek command gives them. */
  async peek(address: number, size: number): Promise<Uint8Array> {
    const parts: Buffer[] = [];
    for (let at = 0; at < size; at += 4096) {
      const answer = await this.command(`peek ${((address + at) & 0xffff).toString(16)} ${Math.min(4096, size - at)}`);
      parts.push(Buffer.from(answer.slice(3), "hex"));
    }
    return Buffer.concat(parts);
  }

  /** Ends the core: quit, then the stop of its process group (at once when it ended, else after STOP_MS). */
  async close(): Promise<void> {
    if (this.#ended === undefined) {
      this.#process.child.stdin!.end("quit\n");
      await Promise.race([this.#process.exited, new Promise((resolve) => setTimeout(resolve, STOP_MS).unref())]);
    }
    await this.#process.stop();
  }
}

/**
 * Starts the core (its C64RT_ variable, else its name on PATH) and checks its
 * protocol. Refuses by name when it is missing or speaks another protocol.
 */
export async function openLineCore<T extends LineCoreSession>(spec: LineCoreSpec, context: ToolContext, make: (process: SupervisedProcess) => T): Promise<T> {
  const env = context.env ?? process.env;
  const path = findTool(spec.tool, env);
  const session = make(context.supervisor.spawn([path], { stdio: ["pipe", "pipe", "pipe"], env }));
  const onAbort = () => void session.close();
  context.signal.addEventListener("abort", onAbort, { once: true });
  const version = await session.command("version");
  const protocol = Number(/protocol=(\d+)/.exec(version)?.[1]);
  if (protocol !== spec.protocol) {
    await session.close();
    throw new WireFailure("installation-incomplete", `${path} speaks ${spec.tool.name} protocol ${Number.isNaN(protocol) ? "(none)" : protocol}; c64-re-tools needs protocol ${spec.protocol}. ${spec.tool.remedy}`);
  }
  return session;
}

/** The fields of a status answer ("ok [word] key=value ..."): the values and the first bare word. */
export function statusFields(answer: string): { fields: Map<string, string>; word?: string } {
  const fields = new Map<string, string>();
  let word: string | undefined;
  for (const part of answer.split(" ").slice(1)) {
    const at = part.indexOf("=");
    if (at < 0) word ??= part;
    else fields.set(part.slice(0, at), part.slice(at + 1));
  }
  return word === undefined ? { fields } : { fields, word };
}
