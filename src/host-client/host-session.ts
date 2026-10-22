// The long-lived Host Runtime connection of one emulator session: requests
// with their ids, the replies with their attachments, and the loss of the
// connection. The session client of each machine family builds on it.

import { ProtocolError, WireFailure } from "../protocol/messages.ts";
import type { HostConnection } from "./connect.ts";

const HOST_LOST =
  "The connection to the c64-re-tools host runtime was lost. The emulator and its machine state are gone: memory, registers, breakpoints, snapshots and the loaded program. " +
  "The next call starts a new machine when the Host Runtime (c64-re-tools-host) runs. Load the program again and set the breakpoints again.";
const LOST_BEFORE_ANSWER = "The connection to the c64-re-tools host runtime was lost before the emulator answered. No machine state was lost. Do the call again.";

/** The loss of a session that never answered: it had no machine state, so the caller can do the call again on a new session. */
export class SessionLostBeforeAnswer extends WireFailure {
  constructor() {
    super("machine-unavailable", LOST_BEFORE_ANSWER);
  }
}

interface Pending {
  op: string;
  resolve: (value: unknown, attachments: Buffer[]) => void;
  reject: (error: Error) => void;
}

export class HostSession {
  /** Settles when the session is gone, whether it was closed or the host went away. */
  readonly closed: Promise<void>;
  readonly #connection: HostConnection;
  readonly #pending = new Map<number, Pending>();
  readonly #closedMessage: string;
  #nextId = 1;
  #lost: WireFailure | undefined;
  #answered = false;
  #lossReported = false;

  /** `check` refuses a result that does not have the shape of its operation; `closedMessage` is the error after close. */
  constructor(connection: HostConnection, options: { check?: (op: string, result: unknown) => unknown; closedMessage: string }) {
    this.#connection = connection;
    this.#closedMessage = options.closedMessage;
    connection.onMessage((message, attachments) => {
      // Anything but a reply after the handshake breaks the contract.
      if (message.type !== "reply") return this.#fail();
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return;
      this.#pending.delete(message.id);
      this.#answered = true;
      if ("error" in message) {
        pending.reject(new WireFailure(message.error.code, message.error.message));
        return;
      }
      try {
        pending.resolve(options.check === undefined ? message.result : options.check(pending.op, message.result), attachments);
      } catch (error) {
        pending.reject(
          new WireFailure(
            "operation-failed",
            error instanceof ProtocolError ? "The c64-re-tools host runtime sent an invalid reply." : "The c64-re-tools MCP server could not read the reply of the host runtime.",
          ),
        );
        this.#fail();
      }
    });
    this.closed = connection.closed.then(() => {
      this.#lost ??= this.#answered ? new WireFailure("machine-state-lost", HOST_LOST) : new SessionLostBeforeAnswer();
      this.#lossReported = this.#pending.size > 0;
      for (const pending of this.#pending.values()) pending.reject(this.#lost);
      this.#pending.clear();
    });
  }

  /** True when the connection to the host is gone, whatever the reason. */
  get lost(): boolean {
    return this.#lost !== undefined;
  }

  /** True when the emulator answered a request: then the session had machine state to lose. */
  get answered(): boolean {
    return this.#answered;
  }

  /** The loss of a lost session, when no request got it; undefined while the session lives. */
  get unreportedLoss(): WireFailure | undefined {
    return this.#lost?.code === "machine-state-lost" && !this.#lossReported ? this.#lost : undefined;
  }

  /** Ends the session; the host stops its emulator. Later requests fail as closed. */
  async close(): Promise<void> {
    this.#lost ??= new WireFailure("machine-unavailable", this.#closedMessage);
    await this.#connection.close();
    await this.closed;
  }

  /** One request: the reply's result and the attachments that came with it. */
  request<R>(op: string, params: unknown, attachments: readonly Uint8Array[] = []): Promise<{ result: R; attachments: Buffer[] }> {
    if (this.#lost !== undefined) {
      this.#lossReported = true;
      return Promise.reject(this.#lost);
    }
    const id = this.#nextId;
    this.#nextId = this.#nextId >= 0xffff_ffff ? 1 : this.#nextId + 1;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { op, resolve: (result, received) => resolve({ result: result as R, attachments: received }), reject });
      this.#connection.send({ type: "request", id, op: op as never, params: params as never }, attachments);
    });
  }

  /** Drops a connection whose host broke the protocol; pending work fails as lost. */
  #fail(): void {
    void this.#connection.close();
  }
}
