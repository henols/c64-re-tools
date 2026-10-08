// Deterministic connection to the Host Runtime and the compatibility handshake.

import { connect as connectTcp, type Socket } from "node:net";

import {
  DEFAULT_HOST_PORT,
  encodeFrame,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  HOST_PROTOCOL_ID,
  HOST_PROTOCOL_VERSION,
  parseHostMessage,
  MessageReader,
  ProtocolError,
  WireFailure,
  type ErrorCode,
  type Hello,
  type HostMessage,
  type Ping,
  type Request,
  type Role,
  type VideoStandard,
} from "../protocol.ts";

export interface Endpoint {
  host: string;
  port: number;
}

/** How long one endpoint may take to accept a TCP connection. */
const CONNECT_TIMEOUT_MS = 1_500;
/**
 * How long the host may take to answer hello. A VICE session starts its
 * emulator first, and the host tries the start up to three times.
 */
export const DEFAULT_READY_TIMEOUT_MS = 120_000;

/**
 * The endpoints to try, in order (D5): C64RT_HOST=host:port alone when set,
 * else loopback, then the Docker and Podman host bridges.
 */
export function hostEndpoints(env: NodeJS.ProcessEnv = process.env): Endpoint[] {
  const override = env.C64RT_HOST;
  if (override !== undefined && override !== "") {
    const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d{1,5})$/.exec(override);
    const port = match === null ? NaN : Number(match[3]);
    if (match === null || !(port > 0 && port <= 0xffff)) {
      throw new WireFailure("installation-incomplete", "C64RT_HOST must have the form host:port, for example 127.0.0.1:6464.");
    }
    return [{ host: match[1] ?? match[2]!, port }];
  }
  return ["127.0.0.1", "host.docker.internal", "host.containers.internal"].map((host) => ({ host, port: DEFAULT_HOST_PORT }));
}

function unreachable(role: Role): WireFailure {
  const code: ErrorCode = role === "vice-session" ? "machine-unavailable" : "operation-failed";
  return new WireFailure(
    code,
    "The c64-re-tools host runtime is not running or cannot be reached. Start it on the host (npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host) and try again.",
  );
}

function tcpConnect(endpoint: Endpoint): Promise<Socket | undefined> {
  return new Promise((resolve) => {
    const socket = connectTcp({ host: endpoint.host, port: endpoint.port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(undefined);
    }, CONNECT_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.removeAllListeners("error");
      resolve(socket);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(undefined);
    });
  });
}

export interface Heartbeat {
  intervalMs: number;
  timeoutMs: number;
}

/** A handshaken, framed connection to the Host Runtime. */
export class HostConnection {
  /** Settles when the connection is gone; carries the reason unless we closed it. */
  readonly closed: Promise<Error | undefined>;
  readonly #socket: Socket;
  readonly #reader = new MessageReader();
  #listener: ((message: HostMessage, attachments: Buffer[]) => void) | undefined;
  #failure: Error | undefined;
  #closedByUs = false;
  #pingTimer: NodeJS.Timeout | undefined;
  #silenceTimer: NodeJS.Timeout | undefined;
  #heartbeat: Heartbeat | undefined;

  private constructor(socket: Socket) {
    this.#socket = socket;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 10_000);
    this.closed = new Promise((resolve) => {
      socket.on("close", () => resolve(this.#closedByUs ? undefined : (this.#failure ?? new Error("the host runtime closed the connection"))));
    });
    socket.on("error", (error) => (this.#failure ??= error));
    socket.on("close", () => {
      clearInterval(this.#pingTimer);
      clearTimeout(this.#silenceTimer);
    });
    socket.on("data", (chunk) => {
      this.#restartSilence();
      try {
        for (const { message, attachments } of this.#reader.push(chunk)) {
          const parsed = parseHostMessage(message);
          if (parsed.type !== "pong") this.#listener?.(parsed, attachments);
        }
      } catch (error) {
        if (!(error instanceof ProtocolError)) throw error;
        this.#failure = error;
        socket.destroy();
      }
    });
  }

  /**
   * Connects to the first endpoint that accepts, then handshakes. Once an
   * endpoint accepts, its answer is final: no later endpoint is tried.
   */
  static async open(options: {
    role: Role;
    videoStandard?: VideoStandard;
    env?: NodeJS.ProcessEnv;
    readyTimeoutMs?: number;
    /** Defaults to a ping every 10 s and a 30 s silence limit (D18). */
    heartbeat?: Heartbeat;
  }): Promise<HostConnection> {
    let socket: Socket | undefined;
    for (const endpoint of hostEndpoints(options.env)) {
      socket = await tcpConnect(endpoint);
      if (socket !== undefined) break;
    }
    if (socket === undefined) throw unreachable(options.role);

    const connection = new HostConnection(socket);
    const hello: Hello = { type: "hello", protocol: HOST_PROTOCOL_ID, version: HOST_PROTOCOL_VERSION, role: options.role };
    if (options.videoStandard !== undefined) hello.videoStandard = options.videoStandard;
    // A host that listens beyond loopback checks this shared secret (D6).
    const token = (options.env ?? process.env).C64RT_HOST_TOKEN;
    if (token !== undefined && token !== "") hello.token = token;

    const answer = await new Promise<HostMessage | Error>((resolve) => {
      const timer = setTimeout(() => resolve(new Error("no answer to hello in time")), options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS);
      connection.#listener = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
      void connection.closed.then((reason) => {
        clearTimeout(timer);
        resolve(reason ?? new Error("closed"));
      });
      connection.#send(hello);
    });
    connection.#listener = undefined;

    if (!(answer instanceof Error) && answer.type === "ready") {
      connection.#startHeartbeat(options.heartbeat ?? { intervalMs: HEARTBEAT_INTERVAL_MS, timeoutMs: HEARTBEAT_TIMEOUT_MS });
      return connection;
    }
    await connection.close();
    if (answer instanceof Error) {
      if (answer instanceof ProtocolError) {
        throw new WireFailure("installation-incomplete", "The c64-re-tools host runtime speaks a different protocol. Install the same c64-re-tools release on both sides.");
      }
      throw new WireFailure(
        options.role === "vice-session" ? "machine-unavailable" : "operation-failed",
        "The c64-re-tools host runtime did not finish the handshake. Check that it is running and try again.",
      );
    }
    if (answer.type === "error") throw new WireFailure(answer.error.code, answer.error.message);
    throw new WireFailure("installation-incomplete", "The c64-re-tools host runtime answered out of turn. Install the same c64-re-tools release on both sides.");
  }

  /** Receives every message after the handshake, with any attachments. */
  onMessage(listener: (message: HostMessage, attachments: Buffer[]) => void): void {
    this.#listener = listener;
  }

  send(request: Request, attachments: readonly Uint8Array[] = []): void {
    if (!this.#socket.destroyed) this.#socket.write(encodeFrame(request, attachments));
  }

  close(): Promise<void> {
    this.#closedByUs = true;
    this.#socket.destroy();
    return this.closed.then(() => {});
  }

  /**
   * Pings the host so it knows this client is alive, and closes the connection
   * when the host has sent nothing for the timeout: a host that vanished
   * without a close then fails like a closed one (D18). The timers never keep
   * the process alive.
   */
  #startHeartbeat(heartbeat: Heartbeat): void {
    this.#heartbeat = heartbeat;
    const ping: Ping = { type: "ping" };
    this.#pingTimer = setInterval(() => this.#send(ping), heartbeat.intervalMs).unref();
    this.#restartSilence();
  }

  #restartSilence(): void {
    if (this.#heartbeat === undefined || this.#socket.destroyed) return;
    clearTimeout(this.#silenceTimer);
    const timeout = this.#heartbeat.timeoutMs;
    this.#silenceTimer = setTimeout(() => {
      this.#failure ??= new Error(`the host runtime sent nothing for ${timeout} ms`);
      this.#socket.destroy();
    }, timeout).unref();
  }

  #send(message: Hello | Request | Ping): void {
    if (!this.#socket.destroyed) this.#socket.write(encodeFrame(message));
  }
}
