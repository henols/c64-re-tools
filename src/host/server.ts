import { createServer, type Server, type Socket } from "node:net";

import {
  checkHello,
  encodeFrame,
  FrameDecoder,
  parseClientMessage,
  ProtocolError,
  validateViceParams,
  type HostMessage,
  type Request,
  type VideoStandard,
  type ViceOperation,
  type ViceOperations,
  type WireError,
  WireFailure,
} from "../protocol.ts";

/** One live VICE session, owned by one connection. */
export interface ViceSessionHandle {
  /** Runs one operation. The session serializes its own work. Throws WireFailure for domain failures. */
  handle<O extends ViceOperation>(op: O, params: ViceOperations[O]["params"]): Promise<ViceOperations[O]["result"]>;
  /** Stops the emulator and drops queued work. Safe to call more than once. */
  close(): Promise<void>;
}

/** Starts a VICE session. Throws WireFailure with an actionable code when it cannot. */
export type ViceSessionFactory = (options: { videoStandard: VideoStandard }) => Promise<ViceSessionHandle>;

export interface HostServerOptions {
  createViceSession: ViceSessionFactory;
  /** Defaults to 127.0.0.1 (D5). */
  host?: string;
  /** 0 picks a free port. */
  port: number;
  /** How long a new connection may stay silent before it must send hello. */
  handshakeTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface HostServer {
  readonly host: string;
  readonly port: number;
  /** Stops listening, closes every connection and stops every session. */
  close(): Promise<void>;
}

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;

function toWireError(error: unknown, fallback: WireError): WireError {
  return error instanceof WireFailure ? error.toWire() : fallback;
}

/** Owns one client connection: handshake, then requests against at most one VICE session. */
class Connection {
  readonly closed: Promise<void>;
  #state: "handshake" | "starting" | "open" | "closed" = "handshake";
  #session: ViceSessionHandle | undefined;
  #starting: Promise<ViceSessionHandle | undefined> | undefined;
  #shuttingDown = false;
  #isTool = false;
  readonly #decoder = new FrameDecoder();
  readonly #socket: Socket;
  readonly #options: HostServerOptions;
  readonly #log: (line: string) => void;
  readonly #handshakeTimer: NodeJS.Timeout;
  #resolveClosed!: () => void;

  constructor(socket: Socket, options: HostServerOptions, log: (line: string) => void) {
    this.#socket = socket;
    this.#options = options;
    this.#log = log;
    this.closed = new Promise((resolve) => (this.#resolveClosed = resolve));
    this.#handshakeTimer = setTimeout(
      () => this.#abort("no hello before the handshake timeout"),
      options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
    );
    socket.setNoDelay(true);
    socket.on("data", (chunk) => this.#receive(chunk));
    socket.on("error", (error) => this.#log(`connection error: ${error.message}`));
    socket.on("close", () => void this.#shutdown());
  }

  /** Closes the connection and its session. */
  close(): Promise<void> {
    this.#socket.destroy();
    return this.closed;
  }

  #send(message: HostMessage): void {
    if (this.#state !== "closed" && !this.#socket.destroyed) this.#socket.write(encodeFrame(message));
  }

  #abort(reason: string): void {
    this.#log(`closing connection: ${reason}`);
    this.#socket.destroy();
  }

  #receive(chunk: Buffer): void {
    try {
      for (const raw of this.#decoder.push(chunk)) {
        if (this.#state === "closed") return;
        this.#dispatch(raw);
      }
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      this.#abort(`protocol error: ${error.message}`);
    }
  }

  #dispatch(raw: unknown): void {
    const message = parseClientMessage(raw);
    if (this.#state === "handshake") {
      if (message.type !== "hello") throw new ProtocolError("first message is not hello");
      clearTimeout(this.#handshakeTimer);
      const mismatch = checkHello(message);
      if (mismatch !== undefined) {
        this.#log("refusing a client from another installation");
        this.#send({ type: "error", error: mismatch });
        this.#socket.end();
        this.#state = "closed";
        return;
      }
      if (message.role === "tool") {
        this.#isTool = true;
        this.#state = "open";
        this.#send({ type: "ready" });
        return;
      }
      this.#state = "starting";
      void this.#startSession(message.videoStandard ?? "pal");
      return;
    }
    if (message.type !== "request") throw new ProtocolError("hello sent twice");
    if (this.#state !== "open") throw new ProtocolError("request sent before ready");
    void this.#answer(message);
  }

  async #startSession(videoStandard: VideoStandard): Promise<void> {
    this.#starting = this.#options.createViceSession({ videoStandard }).catch((error: unknown) => {
      this.#log(`VICE session failed to start: ${error instanceof Error ? error.message : String(error)}`);
      this.#send({
        type: "error",
        error: toWireError(error, { code: "machine-unavailable", message: "The emulator could not be started." }),
      });
      this.#socket.end();
      return undefined;
    });
    const session = await this.#starting;
    // A connection closed while starting is shut down by #shutdown, which awaits #starting.
    if (session === undefined || this.#state === "closed") return;
    this.#session = session;
    this.#state = "open";
    this.#send({ type: "ready" });
  }

  async #answer(request: Request): Promise<void> {
    try {
      if (this.#isTool || this.#session === undefined) {
        throw new WireFailure("invalid-input", `unknown operation: ${String(request.op)}`);
      }
      const params = validateViceParams(request.op, request.params);
      const result = await this.#session.handle(request.op, params);
      this.#send({ type: "reply", id: request.id, result });
    } catch (error) {
      if (!(error instanceof WireFailure)) {
        this.#log(`operation ${String(request.op)} failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
      }
      this.#send({
        type: "reply",
        id: request.id,
        error: toWireError(error, { code: "operation-failed", message: "The operation failed inside the host runtime." }),
      });
    }
  }

  async #shutdown(): Promise<void> {
    if (this.#shuttingDown) return;
    this.#shuttingDown = true;
    this.#state = "closed";
    clearTimeout(this.#handshakeTimer);
    const session = this.#session ?? (await this.#starting);
    this.#session = undefined;
    try {
      await session?.close();
    } catch (error) {
      this.#log(`session close failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.#resolveClosed();
  }
}

/** Starts the Host Runtime listener. Each connection owns at most one VICE session. */
export async function startHostServer(options: HostServerOptions): Promise<HostServer> {
  const log = options.log ?? (() => {});
  const host = options.host ?? "127.0.0.1";
  const connections = new Set<Connection>();
  const server: Server = createServer((socket) => {
    const connection = new Connection(socket, options, log);
    connections.add(connection);
    void connection.closed.then(() => connections.delete(connection));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host, port: options.port, exclusive: true }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("listener has no TCP address");

  let closing: Promise<void> | undefined;
  return {
    host,
    port: address.port,
    close() {
      closing ??= (async () => {
        const stopped = new Promise<void>((resolve) => server.close(() => resolve()));
        await Promise.all([...connections].map((connection) => connection.close()));
        await stopped;
      })();
      return closing;
    },
  };
}
