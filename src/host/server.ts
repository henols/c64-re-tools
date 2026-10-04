import { timingSafeEqual } from "node:crypto";
import { createServer, type Server, type Socket } from "node:net";

import {
  attachmentCount,
  checkHello,
  TOOL_OPERATIONS,
  validateToolParams,
  VICE_OPERATIONS,
  type ToolOperation,
  type ToolOperations,
  encodeFrame,
  MessageReader,
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
  /**
   * Runs one operation. The session serializes its own work. Throws
   * WireFailure for domain failures. `attachments` holds the bytes the
   * operation takes (see attachmentCount).
   */
  handle<O extends ViceOperation>(op: O, params: ViceOperations[O]["params"], attachments?: Buffer[]): Promise<ViceOperations[O]["result"]>;
  /** Stops the emulator and drops queued work. Safe to call more than once. */
  close(): Promise<void>;
}

/** Starts a VICE session. Throws WireFailure with an actionable code when it cannot. */
export type ViceSessionFactory = (options: { videoStandard: VideoStandard }) => Promise<ViceSessionHandle>;

/**
 * Runs one native-tool request. `signal` aborts when the client goes away; the
 * tool must then stop its children and remove its workspace. Throws WireFailure.
 */
export type ToolDispatcher = <O extends ToolOperation>(
  op: O,
  params: ToolOperations[O]["params"],
  attachments: Buffer[],
  signal: AbortSignal,
) => Promise<{ result: ToolOperations[O]["result"]; attachments?: Buffer[] }>;

export interface HostServerOptions {
  createViceSession: ViceSessionFactory;
  /** Native-tool requests on "tool" connections; without it they are refused. */
  tools?: ToolDispatcher;
  /** Defaults to 127.0.0.1 (D5). More addresses listen on the same port, for example a container bridge. */
  host?: string;
  /** Extra addresses to listen on, on the same port as `host`. */
  extraHosts?: string[];
  /**
   * The shared secret (D6). A connection that arrives on an address that is
   * not loopback must send it in its hello; without a token such a
   * connection is refused.
   */
  token?: string;
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
  readonly #toolAbort = new AbortController();
  #isTool = false;
  readonly #reader = new MessageReader();

  /** A connection on a loopback address needs no token; any other needs the host's token (D6). */
  #checkToken(token: string | undefined): WireError | undefined {
    if (isLoopback(this.#socket.localAddress ?? "")) return undefined;
    const expected = this.#options.token;
    const matches =
      expected !== undefined && token !== undefined && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (matches) return undefined;
    return {
      code: "installation-incomplete",
      message: "The c64-re-tools host runtime refused this client: a connection from outside the host needs C64RT_HOST_TOKEN with the same value on both sides.",
    };
  }
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

  #send(message: HostMessage, attachments: readonly Uint8Array[] = []): void {
    if (this.#state !== "closed" && !this.#socket.destroyed) this.#socket.write(encodeFrame(message, attachments));
  }

  #abort(reason: string): void {
    this.#log(`closing connection: ${reason}`);
    this.#socket.destroy();
  }

  #receive(chunk: Buffer): void {
    try {
      for (const { message, attachments } of this.#reader.push(chunk)) {
        if (this.#state === "closed") return;
        this.#dispatch(message, attachments);
      }
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      this.#abort(`protocol error: ${error.message}`);
    }
  }

  #dispatch(raw: unknown, attachments: Buffer[]): void {
    const message = parseClientMessage(raw);
    if (this.#state === "handshake") {
      if (message.type !== "hello") throw new ProtocolError("first message is not hello");
      clearTimeout(this.#handshakeTimer);
      const mismatch = checkHello(message) ?? this.#checkToken(message.token);
      if (mismatch !== undefined) {
        this.#log(`refusing a client: ${mismatch.message}`);
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
    void this.#answer(message, attachments);
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

  async #answer(request: Request, attachments: Buffer[]): Promise<void> {
    try {
      let result: unknown;
      let replyAttachments: Buffer[] = [];
      if (this.#isTool) {
        if (!(TOOL_OPERATIONS as readonly string[]).includes(request.op) || this.#options.tools === undefined) {
          throw new WireFailure("invalid-input", `unknown operation: ${String(request.op)}`);
        }
        const op = request.op as ToolOperation;
        const params = validateToolParams(op, request.params, attachments);
        const answer = await this.#options.tools(op, params, attachments, this.#toolAbort.signal);
        result = answer.result;
        replyAttachments = answer.attachments ?? [];
      } else {
        if (this.#session === undefined || !(VICE_OPERATIONS as readonly string[]).includes(request.op)) {
          throw new WireFailure("invalid-input", `unknown operation: ${String(request.op)}`);
        }
        const op = request.op as ViceOperation;
        const params = validateViceParams(op, request.params);
        if (attachments.length !== attachmentCount(op)) {
          throw new WireFailure("invalid-input", `${op} takes ${attachmentCount(op)} file attachment(s)`);
        }
        result = await this.#session.handle(op, params, attachments);
      }
      this.#send({ type: "reply", id: request.id, result }, replyAttachments);
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
    // Tool work for a client that is gone stops: its children and workspaces go too.
    this.#toolAbort.abort();
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
/** True for 127.0.0.0/8 and ::1, also in their IPv4-mapped IPv6 form. */
export function isLoopback(address: string): boolean {
  const plain = address.startsWith("::ffff:") ? address.slice(7) : address;
  return plain === "::1" || /^127\.\d+\.\d+\.\d+$/.test(plain);
}

export async function startHostServer(options: HostServerOptions): Promise<HostServer> {
  const log = options.log ?? (() => {});
  const host = options.host ?? "127.0.0.1";
  const connections = new Set<Connection>();
  const servers: Server[] = [];
  const listen = (address: string, port: number) => {
    const server: Server = createServer((socket) => {
      const connection = new Connection(socket, options, log);
      connections.add(connection);
      void connection.closed.then(() => connections.delete(connection));
    });
    servers.push(server);
    return new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: address, port, exclusive: true }, () => {
        server.off("error", reject);
        const bound = server.address();
        if (bound === null || typeof bound === "string") reject(new Error("listener has no TCP address"));
        else resolve(bound.port);
      });
    });
  };

  let port: number;
  try {
    port = await listen(host, options.port);
    // The extra addresses share the port, so one endpoint setting reaches every address.
    for (const extra of options.extraHosts ?? []) await listen(extra, port);
  } catch (error) {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    throw error;
  }

  let closing: Promise<void> | undefined;
  return {
    host,
    port,
    close() {
      closing ??= (async () => {
        const stopped = Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
        await Promise.all([...connections].map((connection) => connection.close()));
        await stopped;
      })();
      return closing;
    },
  };
}
