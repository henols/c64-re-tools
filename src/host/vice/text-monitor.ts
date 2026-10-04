// VICE remote text monitor client, used only for operations the binary monitor
// cannot do (warp, file load/attach, checkpoint ignore counts, device switch).
// Raw monitor syntax never leaves src/host/vice.
//
// Framing, as observed on stock VICE 3.10: every command ends with a prompt
// such as "(C:$e5cf) ", but a command that makes VICE enter the monitor gets
// an extra prompt first. So prompts cannot delimit answers. Each command is
// followed by a sentinel `~ $nnnn` whose distinctive four-line answer marks
// where the command's own output ends. The sentinel is sent only after a
// prompt shows the command was taken: VICE drops the rest of an input chunk
// when the command in it makes VICE enter the monitor. Only idempotent
// commands go through here (see RESEND_AFTER_MS).

import { connect, type Socket } from "node:net";

export class TextMonitorError extends Error {
  override name = "TextMonitorError";
}

const PROMPT = /\((?:C|\d+):\$[0-9a-f]{4}\) /g;
export const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
/**
 * How long to wait for the prompt before sending the command once more. Stock
 * VICE very rarely drops a command line (seen once, never reproduced); every
 * command this client sends is idempotent, so a repeat is harmless.
 */
const RESEND_AFTER_MS = 3_000;

function sentinelPattern(nonce: number): RegExp {
  const hex = nonce.toString(16).padStart(4, "0");
  return new RegExp(`\\+${nonce}\\n\\$${hex}\\n[0-7]+\\n%[01 ]+\\n\\((?:C|\\d+):\\$[0-9a-f]{4}\\) `);
}

/** Strips prompts and surrounding blank space from a command's raw output. */
export function cleanOutput(raw: string): string {
  return raw.replace(PROMPT, "").replace(/\r/g, "").trim();
}

export class TextMonitor {
  readonly closed: Promise<Error | undefined>;
  readonly #socket: Socket;
  #buffer = "";
  #wake: (() => void) | undefined;
  #queue: Promise<unknown> = Promise.resolve();
  #nonce = 0x1000 + Math.floor(Math.random() * 0x1000);
  #closedByUs = false;
  #failure: Error | undefined;

  private constructor(socket: Socket) {
    this.#socket = socket;
    socket.setNoDelay(true);
    socket.on("data", (chunk) => {
      this.#buffer += chunk.toString("latin1");
      this.#wake?.();
    });
    socket.on("error", (error) => (this.#failure ??= new TextMonitorError(`text monitor connection failed: ${error.message}`)));
    this.closed = new Promise((resolve) => {
      socket.on("close", () => {
        this.#wake?.();
        resolve(this.#closedByUs ? undefined : (this.#failure ?? new TextMonitorError("VICE closed the text monitor connection")));
      });
    });
  }

  static connect(port: number, host = "127.0.0.1", timeoutMs = 2_000): Promise<TextMonitor> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new TextMonitorError(`text monitor connect to port ${port} timed out`));
      }, timeoutMs);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.removeAllListeners("error");
        resolve(new TextMonitor(socket));
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(new TextMonitorError(`text monitor connect to port ${port} failed: ${error.message}`));
      });
    });
  }

  /**
   * Runs one idempotent command and returns its output without prompts.
   * Commands run one at a time. A command makes VICE stop the machine if it
   * was running.
   */
  command(line: string, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS): Promise<string> {
    if (/[\r\n]/.test(line)) return Promise.reject(new TypeError("a monitor command must be one line"));
    const run = this.#queue.then(() => this.#exchange(line, timeoutMs));
    this.#queue = run.catch(() => {});
    return run;
  }

  close(): Promise<void> {
    this.#closedByUs = true;
    this.#socket.destroy();
    return this.closed.then(() => {});
  }

  async #exchange(line: string, timeoutMs: number): Promise<string> {
    if (this.#socket.destroyed) throw new TextMonitorError("text monitor connection is closed");
    this.#nonce = this.#nonce >= 0xfffe ? 0x1000 : this.#nonce + 1;
    const sentinel = sentinelPattern(this.#nonce);
    const deadline = Date.now() + timeoutMs;
    // Anything left over belongs to no command; drop it so it cannot be misread.
    this.#buffer = "";
    this.#socket.write(`${line}\n`);
    const prompted = () => new RegExp(PROMPT.source).test(this.#buffer);
    const resendAt = Math.min(deadline, Date.now() + RESEND_AFTER_MS);
    try {
      await this.#waitFor(prompted, resendAt, timeoutMs);
    } catch (error) {
      if (this.#socket.destroyed || Date.now() >= deadline) throw error;
      this.#socket.write(`${line}\n`);
      await this.#waitFor(prompted, deadline, timeoutMs);
    }
    this.#socket.write(`~ $${this.#nonce.toString(16)}\n`);
    let match: RegExpExecArray | null = null;
    await this.#waitFor(() => (match = sentinel.exec(this.#buffer)) !== null, deadline, timeoutMs);
    const found = match as unknown as RegExpExecArray;
    const output = this.#buffer.slice(0, found.index);
    this.#buffer = this.#buffer.slice(found.index + found[0].length);
    return cleanOutput(output);
  }

  async #waitFor(done: () => boolean, deadline: number, timeoutMs: number): Promise<void> {
    while (!done()) {
      if (this.#socket.destroyed) throw new TextMonitorError("text monitor connection closed during a command");
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        // The raw tail goes to the host log only; it is never shown to the LLM.
        throw new TextMonitorError(`text monitor command got no answer in ${timeoutMs} ms (received: ${JSON.stringify(this.#buffer.slice(-200))})`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.#wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.#wake = undefined;
    }
  }
}
