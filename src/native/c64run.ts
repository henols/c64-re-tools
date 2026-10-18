// The c64run session: one replay core (a C64 emulator, see
// tools/c64run.c) for the life of a skill script,
// driven by one command line and one answer line at a time over its stdin and
// stdout. It is started through the supervisor like every native tool, so it
// stops with the script.

import { createInterface } from "node:readline";

import { WireFailure } from "../protocol/messages.ts";
import { C64RUN, findTool, INSTALL_STEPS } from "./discover.ts";
import type { SupervisedProcess } from "./processes.ts";
import type { ToolContext } from "./run.ts";

/** The command protocol that this module speaks; c64run --version and version name it. */
export const C64RUN_PROTOCOL = 2;

/** CPU cycles in one PAL frame: 312 lines of 63 cycles. */
export const PAL_FRAME_CYCLES = 19_656;

const STOP_MS = 5_000;

/** The machine state that most commands answer with. */
export interface CoreStatus {
  /** CPU cycles since the opcode fetch at the reset vector. */
  tick: number;
  /** At an opcode fetch: pc is the address of the next instruction. */
  sync: boolean;
  pc: number;
  a: number;
  x: number;
  y: number;
  s: number;
  p: number;
  line: number;
  cycle: number;
  /** FNV-1a of RAM from $0002 and of colour RAM. */
  hash: string;
  /** The word after "ok", if any: "reached" or "not-reached" for run-pc and run-reads. */
  word?: string;
}

export function parseStatus(answer: string): CoreStatus {
  const parts = answer.split(" ").slice(1);
  const fields = new Map<string, string>();
  let word: string | undefined;
  for (const part of parts) {
    const at = part.indexOf("=");
    if (at < 0) word ??= part;
    else fields.set(part.slice(0, at), part.slice(at + 1));
  }
  const hex = (key: string) => Number.parseInt(fields.get(key) ?? "", 16);
  if (!fields.has("tick")) throw new WireFailure("operation-failed", `c64run gave no machine state: ${answer}`);
  return {
    tick: Number(fields.get("tick")),
    sync: fields.get("sync") === "1",
    pc: hex("pc"),
    a: hex("a"),
    x: hex("x"),
    y: hex("y"),
    s: hex("s"),
    p: hex("p"),
    line: Number(fields.get("line")),
    cycle: Number(fields.get("cycle")),
    hash: fields.get("hash") ?? "",
    ...(word === undefined ? {} : { word }),
  };
}

export class C64RunSession {
  readonly #process: SupervisedProcess;
  readonly #waiting: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  #stderr = "";
  #ended: WireFailure | undefined;

  private constructor(process: SupervisedProcess) {
    this.#process = process;
    const child = process.child;
    // A core that ended (or never started) closes its stdin: the exit handler reports it.
    child.stdin!.on("error", () => {});
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => (this.#stderr = (this.#stderr + chunk).slice(-4000)));
    createInterface({ input: child.stdout! }).on("line", (line) => this.#waiting.shift()?.resolve(line));
    void process.exited.then((status) => {
      const how = status.spawnError !== undefined ? `did not start (${status.spawnError})` : `ended (exit ${status.code ?? status.signal})`;
      this.#ended = new WireFailure(status.spawnError !== undefined ? "installation-incomplete" : "operation-failed", `c64run ${how}.${this.#stderr === "" ? "" : ` ${this.#stderr.trim()}`}`);
      for (const waiting of this.#waiting.splice(0)) waiting.reject(this.#ended);
    });
  }

  /** Starts c64run (C64RT_C64RUN, else c64run on PATH) and checks its protocol. Refuses by name when it is missing. */
  static async open(context: ToolContext): Promise<C64RunSession> {
    const env = context.env ?? process.env;
    const path = findTool(C64RUN, env);
    const session = new C64RunSession(context.supervisor.spawn([path], { stdio: ["pipe", "pipe", "pipe"], env }));
    const onAbort = () => void session.close();
    context.signal.addEventListener("abort", onAbort, { once: true });
    const version = await session.command("version");
    const protocol = Number(/protocol=(\d+)/.exec(version)?.[1]);
    if (protocol !== C64RUN_PROTOCOL) {
      await session.close();
      throw new WireFailure("installation-incomplete", `${path} speaks c64run protocol ${Number.isNaN(protocol) ? "(none)" : protocol}; c64-re-tools needs protocol ${C64RUN_PROTOCOL}. ${C64RUN.remedy}`);
    }
    return session;
  }

  /** Sends one command and gives its "ok ..." answer. An "err ..." answer throws operation-failed. */
  command(text: string): Promise<string> {
    if (this.#ended !== undefined) return Promise.reject(this.#ended);
    const answer = new Promise<string>((resolve, reject) => this.#waiting.push({ resolve, reject }));
    this.#process.child.stdin!.write(`${text}\n`);
    return answer.then((line) => {
      if (line.startsWith("ok")) return line;
      throw new WireFailure("operation-failed", `c64run ${text.split(" ")[0]}: ${line.replace(/^err /, "")}`);
    });
  }

  /** A command that answers with the machine state. */
  async status(text: string): Promise<CoreStatus> {
    return parseStatus(await this.command(text));
  }

  /** Power-on: the CPU stops at the reset vector, tick 0. Missing ROMs refuse with the remedy. */
  async init(romFolder?: string): Promise<CoreStatus> {
    try {
      return await this.status(romFolder === undefined ? "init" : `init ${romFolder}`);
    } catch (error) {
      if (error instanceof WireFailure && /no ROM/.test(error.message)) {
        throw new WireFailure(
          "installation-incomplete",
          `${error.message}. c64run needs the C64 ROMs kernal-901227-03.bin, basic-901226-01.bin and chargen-901225-01.bin: set C64RT_C64_ROMS to a folder with them (the C64 folder of VICE has them). ${INSTALL_STEPS}`,
        );
      }
      throw error;
    }
  }

  /** Writes bytes into RAM (the RAM view), in parts that fit one command line. */
  async write(address: number, bytes: Uint8Array): Promise<void> {
    for (let at = 0; at < bytes.length; at += 4096) {
      await this.command(`write ${((address + at) & 0xffff).toString(16)} ${Buffer.from(bytes.subarray(at, at + 4096)).toString("hex")}`);
    }
  }

  /** RAM bytes (the RAM view). */
  async peek(address: number, size: number): Promise<Uint8Array> {
    const parts: Buffer[] = [];
    for (let at = 0; at < size; at += 4096) {
      const answer = await this.command(`peek ${((address + at) & 0xffff).toString(16)} ${Math.min(4096, size - at)}`);
      parts.push(Buffer.from(answer.slice(3), "hex"));
    }
    return Buffer.concat(parts);
  }

  /** Ends c64run: quit, then the stop of its process group (at once when it ended, else after STOP_MS). */
  async close(): Promise<void> {
    if (this.#ended === undefined) {
      this.#process.child.stdin!.end("quit\n");
      await Promise.race([this.#process.exited, new Promise((resolve) => setTimeout(resolve, STOP_MS).unref())]);
    }
    await this.#process.stop();
  }
}
