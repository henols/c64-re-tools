// A ZRCP client: the remote command protocol of ZEsarUX over TCP. ZEsarUX
// answers each command line with its output and then a prompt ("command> ",
// or "command@cpu-step> " in step mode). One command runs at a time. A run
// command answers only when the CPU stops: a breakpoint, or data that the
// client sends (pause sends one line feed for that).
//
// A command that gets no answer in time makes the connection unusable: a
// subsequent prompt could be either its late answer or the next command's.
// Close the socket rather than assign a response to the wrong command.
//
// The line feed of an interrupt can cross a stop of the run in flight: then
// ZEsarUX reads it at its prompt as an empty command and answers it with one
// more prompt, which no command waits for. So the first command after an
// interrupt syncs first: it sends get-version, whose answer is never empty,
// and drops each empty answer before it.

import { Socket } from "node:net";

import { WireFailure } from "../../protocol/messages.ts";

const PROMPT = /command(@cpu-step)?> /;
/** How long a sync waits for each answer. */
const SYNC_MS = 10_000;
const RESTART = "Restart the c64-re-tools MCP server: that starts a new emulator.";

export class Zrcp {
  readonly #socket: Socket;
  #buffer = "";
  #waiting: { resolve: (text: string) => void; reject: (error: Error) => void; timer: NodeJS.Timeout | undefined } | undefined;
  #queue: Promise<unknown> = Promise.resolve();
  #closed: Error | undefined;
  /** True after an interrupt: an empty answer of ZEsarUX to its line feed can still come. */
  #mustSync = false;

  private constructor(socket: Socket) {
    this.#socket = socket;
    socket.setEncoding("latin1");
    socket.on("data", (chunk: string) => {
      this.#buffer += chunk;
      this.#deliver();
    });
    const lost = () => this.#fail(new WireFailure("machine-unavailable", `ZEsarUX closed its remote connection. ${RESTART}`));
    socket.on("error", lost);
    socket.on("close", lost);
  }

  /** Rejects any pending command and closes the transport: its response boundary is no longer trustworthy. */
  #fail(error: Error): void {
    this.#closed ??= error;
    const waiting = this.#waiting;
    this.#waiting = undefined;
    if (waiting !== undefined) {
      clearTimeout(waiting.timer);
      waiting.reject(this.#closed);
    }
    this.#socket.destroy();
  }

  #deliver(): void {
    const prompt = PROMPT.exec(this.#buffer);
    if (prompt === null || this.#waiting === undefined) return;
    const text = this.#buffer.slice(0, prompt.index);
    this.#buffer = this.#buffer.slice(prompt.index + prompt[0].length);
    const waiting = this.#waiting;
    this.#waiting = undefined;
    clearTimeout(waiting.timer);
    waiting.resolve(text);
  }

  /** Connects, retrying until the port opens or `timeoutMs` passes, and reads the greeting. */
  static async connect(port: number, timeoutMs = 10_000): Promise<Zrcp> {
    const started = Date.now();
    for (;;) {
      try {
        const socket = await new Promise<Socket>((resolve, reject) => {
          const socket = new Socket();
          socket.once("error", reject);
          socket.connect(port, "127.0.0.1", () => {
            socket.off("error", reject);
            // Each command is a short line that waits for its answer: Nagle's delay would add tens of ms to each.
            socket.setNoDelay(true);
            resolve(socket);
          });
        });
        const zrcp = new Zrcp(socket);
        await zrcp.#wait(timeoutMs);
        return zrcp;
      } catch (error) {
        if (Date.now() - started > timeoutMs) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  /** The text up to the next prompt; with "none" it waits until the prompt comes or the connection closes. */
  #wait(timeoutMs: number | "none"): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.#closed !== undefined) return reject(this.#closed);
      const timer =
        timeoutMs === "none"
          ? undefined
          : setTimeout(() => {
              this.#fail(new WireFailure("machine-unavailable", `ZEsarUX gave no answer in ${Math.round(timeoutMs / 1000)} s. ${RESTART}`));
            }, timeoutMs);
      this.#waiting = { resolve, reject, timer };
      this.#deliver();
    });
  }

  /** Sends one command line and gives its output, without the prompt. `timeoutMs` "none" waits until it answers. */
  command(text: string, timeoutMs: number | "none" = 10_000): Promise<string> {
    const run = this.#queue.then(async () => {
      if (this.#closed !== undefined) throw this.#closed;
      if (this.#mustSync) await this.#sync();
      const answer = this.#wait(timeoutMs);
      this.#socket.write(`${text}\n`);
      return answer;
    });
    this.#queue = run.catch(() => {});
    return run.then((output) => output.replace(/\r/g, "").trimEnd());
  }

  /** Sends one line feed: data that ends a run command. The next command syncs first. */
  interrupt(): void {
    if (this.#closed !== undefined) return;
    this.#mustSync = true;
    this.#socket.write("\n");
  }

  /** Drops the empty answers to the line feeds of interrupts: they come before the answer of get-version, which is never empty. */
  async #sync(): Promise<void> {
    this.#mustSync = false;
    let answer = this.#wait(SYNC_MS);
    this.#socket.write("get-version\n");
    while ((await answer).trim() === "") answer = this.#wait(SYNC_MS);
  }

  get closed(): boolean {
    return this.#closed !== undefined;
  }

  close(): void {
    this.#fail(new WireFailure("machine-unavailable", `ZEsarUX remote connection closed. ${RESTART}`));
  }
}
