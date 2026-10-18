// A ZRCP client: the ZEsarUX remote command protocol over TCP. ZEsarUX answers
// each command line with its output and then a prompt ("command> ", or
// "command@cpu-step> " in step mode). One command runs at a time.

import { createServer, Socket } from "node:net";

const PROMPT = /command(@cpu-step)?> $/;

export class Zrcp {
  readonly #socket: Socket;
  #buffer = "";
  #waiting: { resolve: (text: string) => void; reject: (error: Error) => void; timer: NodeJS.Timeout } | undefined;
  #queue: Promise<unknown> = Promise.resolve();
  #closed: Error | undefined;
  /** True after a prompt of step mode. */
  stepMode = false;

  private constructor(socket: Socket) {
    this.#socket = socket;
    socket.setEncoding("latin1");
    socket.on("data", (chunk: string) => {
      this.#buffer += chunk;
      const prompt = PROMPT.exec(this.#buffer);
      if (prompt === null || this.#waiting === undefined) return;
      const text = this.#buffer.slice(0, prompt.index);
      this.stepMode = prompt[1] !== undefined;
      this.#buffer = "";
      const waiting = this.#waiting;
      this.#waiting = undefined;
      clearTimeout(waiting.timer);
      waiting.resolve(text);
    });
    const end = (error: Error) => {
      this.#closed = error;
      this.#waiting?.reject(error);
      this.#waiting = undefined;
    };
    socket.on("error", end);
    socket.on("close", () => end(new Error("ZRCP connection closed")));
  }

  /** Connects, retrying until the port opens or `timeoutMs` passes, and reads the greeting. */
  static async connect(port: number, timeoutMs = 10_000): Promise<{ zrcp: Zrcp; greeting: string; connectMs: number }> {
    const started = Date.now();
    for (;;) {
      try {
        const socket = await new Promise<Socket>((resolve, reject) => {
          const socket = new Socket();
          socket.once("error", reject);
          socket.connect(port, "127.0.0.1", () => {
            socket.off("error", reject);
            resolve(socket);
          });
        });
        const zrcp = new Zrcp(socket);
        const greeting = await zrcp.#wait(timeoutMs);
        return { zrcp, greeting, connectMs: Date.now() - started };
      } catch (error) {
        if (Date.now() - started > timeoutMs) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  #wait(timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.#closed !== undefined) return reject(this.#closed);
      const timer = setTimeout(() => {
        this.#waiting = undefined;
        reject(new Error(`no ZRCP prompt in ${timeoutMs} ms; got ${JSON.stringify(this.#buffer.slice(-200))}`));
      }, timeoutMs);
      this.#waiting = { resolve, reject, timer };
      // The prompt may already be in the buffer.
      this.#socket.emit("data", "");
    });
  }

  /** Sends one command line and gives its output (without the prompt). */
  command(text: string, timeoutMs = 10_000): Promise<string> {
    const run = this.#queue.then(() => {
      const answer = this.#wait(timeoutMs);
      this.#socket.write(`${text}\n`);
      return answer;
    });
    this.#queue = run.catch(() => {});
    return run.then((output) => output.replace(/\r/g, "").trimEnd());
  }

  close(): void {
    this.#socket.destroy();
  }
}

/** A free TCP port on 127.0.0.1. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address !== null ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}
