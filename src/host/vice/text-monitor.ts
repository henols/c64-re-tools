// VICE remote text monitor client, used only for operations the binary monitor
// cannot do (warp, file load/attach, checkpoint ignore counts, device switch).
// Raw monitor syntax never leaves src/host/vice.
//
// Framing: every command ends with a prompt
// such as "(C:$e5cf) ", but a command that makes VICE enter the monitor gets
// an extra prompt first. So prompts cannot delimit answers. Each command is
// followed by a sentinel `~ $nnnn` whose distinctive four-line answer marks
// where the command's own output ends. The sentinel is sent only after a
// prompt shows the command was taken: VICE drops the rest of an input chunk
// when the command in it makes VICE enter the monitor. Only idempotent
// commands go through here (see resendAfterMs).
//
// VICE sometimes reads a line but runs it only when more input comes. So a
// late sentinel is sent again, and stray sentinel answers are removed from
// output. VICE also prints its step message here when the binary monitor
// steps, sometimes after the next text command was sent; no command of this
// client steps, so that message is removed from output too.

import type { Socket } from "node:net";

import { connectWithTimeout } from "./connect.ts";

export class TextMonitorError extends Error {
  override name = "TextMonitorError";
}

/** A command got no answer in time, but the connection is open; it may still run later. */
export class TextMonitorTimeoutError extends TextMonitorError {
  override name = "TextMonitorTimeoutError";
}

const PROMPT = /\((?:C|\d+):\$[0-9a-f]{4}\) /g;
export const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
/** The default of TextMonitor.resendAfterMs. */
const RESEND_AFTER_MS = 3_000;
/** The default of TextMonitor.overdueTimeoutMs. */
const OVERDUE_COMMAND_TIMEOUT_MS = 1_000;
/** The default of TextMonitor.sentinelResendMs. */
const SENTINEL_RESEND_MS = 1_000;
/** The longest delay a Node timer takes. */
const MAX_TIMER_MS = 2_147_483_647;
const ANY_SENTINEL_ANSWER = /\+\d+\n\$[0-9a-f]{4}\n[0-7]+\n%[01 ]+\n/g;
const STEP_MESSAGE = /^Stepping through the next \d+ instruction\(s\)\.\n/gm;

function sentinelPattern(nonce: number): RegExp {
  const hex = nonce.toString(16).padStart(4, "0");
  return new RegExp(`\\+${nonce}\\n\\$${hex}\\n[0-7]+\\n%[01 ]+\\n\\((?:C|\\d+):\\$[0-9a-f]{4}\\) `);
}

/** Strips prompts, stray sentinel answers, step messages and surrounding blank space from a command's raw output. */
export function cleanOutput(raw: string): string {
  return raw.replace(/\r/g, "").replace(ANY_SENTINEL_ANSWER, "").replace(STEP_MESSAGE, "").replace(PROMPT, "").trim();
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
  /** The time limit of a command that names none. */
  defaultTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS;
  /**
   * How long to wait for any answer before sending the command once more.
   * VICE sometimes holds a command line until more input comes; every
   * command this client sends is idempotent, so a repeat is harmless. A
   * command that has printed output but no prompt yet still runs, and is not
   * sent again.
   */
  resendAfterMs = RESEND_AFTER_MS;
  /** How long to wait for a sentinel's answer before sending the sentinel again. */
  sentinelResendMs = SENTINEL_RESEND_MS;
  /** While an earlier command timed out, later ones are waited for only this long (see BinaryMonitor). */
  overdueTimeoutMs = OVERDUE_COMMAND_TIMEOUT_MS;
  /** Set when a command timed out; cleared by the next command that is answered. */
  #overdue = false;

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
    return connectWithTimeout({
      port,
      host,
      timeoutMs,
      wrap: (socket) => new TextMonitor(socket),
      failure: (message) => new TextMonitorError(`text monitor ${message}`),
    });
  }

  /**
   * Runs one idempotent command and returns its output without prompts.
   * Commands run one at a time. A command makes VICE stop the machine if it
   * was running. `timeoutMs` Infinity waits with no limit, also after a
   * command that timed out.
   */
  command(line: string, timeoutMs = this.defaultTimeoutMs): Promise<string> {
    if (/[\r\n]/.test(line)) return Promise.reject(new TypeError("a monitor command must be one line"));
    const run = this.#queue.then(async () => {
      try {
        const limit = this.#overdue && timeoutMs !== Infinity ? Math.min(timeoutMs, this.overdueTimeoutMs) : timeoutMs;
        const output = await this.#exchange(line, limit);
        this.#overdue = false;
        return output;
      } catch (error) {
        if (error instanceof TextMonitorTimeoutError) this.#overdue = true;
        throw error;
      }
    });
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
    const prompted = () => new RegExp(PROMPT.source).exec(this.#buffer);
    const resendAt = Math.min(deadline, Date.now() + this.resendAfterMs);
    try {
      await this.#waitFor(prompted, resendAt, timeoutMs);
    } catch (error) {
      if (this.#socket.destroyed || Date.now() >= deadline) throw error;
      // Output without a prompt: VICE runs the command and still prints. A repeat would run it twice.
      if (cleanOutput(this.#buffer) === "") this.#socket.write(`${line}\n`);
      await this.#waitFor(prompted, deadline, timeoutMs);
    }
    const sentinelLine = `~ $${this.#nonce.toString(16)}\n`;
    for (;;) {
      this.#socket.write(sentinelLine);
      let found: RegExpExecArray;
      try {
        found = await this.#waitFor(() => sentinel.exec(this.#buffer), Math.min(deadline, Date.now() + this.sentinelResendMs), timeoutMs);
      } catch (error) {
        if (this.#socket.destroyed || Date.now() >= deadline) throw error;
        continue;
      }
      const output = this.#buffer.slice(0, found.index);
      this.#buffer = this.#buffer.slice(found.index + found[0].length);
      return cleanOutput(output);
    }
  }

  /** Waits until `probe` finds something in the received text, and returns what it found. */
  async #waitFor<T>(probe: () => T | null, deadline: number, timeoutMs: number): Promise<T> {
    for (;;) {
      const found = probe();
      if (found !== null) return found;
      if (this.#socket.destroyed) throw new TextMonitorError("text monitor connection closed during a command");
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        // The raw tail goes to the host log only; it is never shown to the LLM.
        throw new TextMonitorTimeoutError(`text monitor command got no answer in ${timeoutMs} ms (received: ${JSON.stringify(this.#buffer.slice(-200))})`);
      }
      await new Promise<void>((resolve) => {
        // No timer for a wait with no limit; a timer longer than Node allows would fire at once.
        const timer = remaining === Infinity ? undefined : setTimeout(resolve, Math.min(remaining, MAX_TIMER_MS));
        this.#wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.#wake = undefined;
    }
  }
}
