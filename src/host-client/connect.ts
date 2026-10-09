// Deterministic connection to the Host Runtime and the compatibility handshake.

import { connect as connectTcp, type Socket } from "node:net";

import { encodeFrame, MessageReader } from "../protocol/framing.ts";
import { DEFAULT_HOST_PORT, HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS, HOST_PROTOCOL_ID, HOST_PROTOCOL_VERSION, parseHostMessage, ProtocolError, WireFailure, type ErrorCode, type Hello, type HostMessage, type Ping, type Request, type Role, type VideoStandard } from "../protocol/messages.ts";

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
 * The endpoints to try, in order: C64RT_HOST=host:port alone when set,
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

function stopped(role: Role): WireFailure {
  return new WireFailure(
    role === "vice-session" ? "machine-unavailable" : "operation-failed",
    "The connection to the c64-re-tools host runtime stopped before the host runtime was ready.",
  );
}

/** Resolves undefined when the endpoint refuses, does not answer in time, or `signal` stops the attempt. */
function tcpConnect(endpoint: Endpoint, signal: AbortSignal | undefined): Promise<Socket | undefined> {
  return new Promise((resolve) => {
    const socket = connectTcp({ host: endpoint.host, port: endpoint.port });
    const fail = () => finish(undefined);
    const finish = (result: Socket | undefined) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", fail);
      if (result === undefined) socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(fail, CONNECT_TIMEOUT_MS);
    signal?.addEventListener("abort", fail, { once: true });
    socket.once("connect", () => {
      socket.removeAllListeners("error");
      finish(socket);
    });
    socket.once("error", fail);
  });
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
  #heartbeat = false;

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
        // A broken frame, or a listener that throws, ends the connection with a
        // reason; nothing escapes the socket handler.
        this.#failure =
          error instanceof ProtocolError
            ? error
            : new Error(`could not handle a message from the host runtime: ${error instanceof Error ? error.message : String(error)}`);
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
    /** Stops the connect and the handshake at once; the open then fails and its socket is closed. */
    signal?: AbortSignal;
  }): Promise<HostConnection> {
    const signal = options.signal;
    let socket: Socket | undefined;
    for (const endpoint of hostEndpoints(options.env)) {
      if (signal?.aborted) break;
      socket = await tcpConnect(endpoint, signal);
      if (socket !== undefined) break;
    }
    if (signal?.aborted) {
      socket?.destroy();
      throw stopped(options.role);
    }
    if (socket === undefined) throw unreachable(options.role);

    const connection = new HostConnection(socket);
    const hello: Hello = { type: "hello", protocol: HOST_PROTOCOL_ID, version: HOST_PROTOCOL_VERSION, role: options.role };
    if (options.videoStandard !== undefined) hello.videoStandard = options.videoStandard;
    // A host that listens beyond loopback checks this shared secret.
    const token = (options.env ?? process.env).C64RT_HOST_TOKEN;
    if (token !== undefined && token !== "") hello.token = token;

    const stop = () => void connection.close();
    signal?.addEventListener("abort", stop, { once: true });
    const answer = await new Promise<HostMessage | Error>((resolve) => {
      const timer = setTimeout(() => resolve(new Error("no answer to hello in time")), DEFAULT_READY_TIMEOUT_MS);
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
    signal?.removeEventListener("abort", stop);
    if (signal?.aborted) {
      await connection.close();
      throw stopped(options.role);
    }

    if (!(answer instanceof Error) && answer.type === "ready") {
      connection.#startHeartbeat();
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
   * without a close then fails like a closed one. The timers never keep
   * the process alive.
   */
  #startHeartbeat(): void {
    this.#heartbeat = true;
    const ping: Ping = { type: "ping" };
    this.#pingTimer = setInterval(() => this.#send(ping), HEARTBEAT_INTERVAL_MS).unref();
    this.#restartSilence();
  }

  #restartSilence(): void {
    if (!this.#heartbeat || this.#socket.destroyed) return;
    clearTimeout(this.#silenceTimer);
    this.#silenceTimer = setTimeout(() => {
      this.#failure ??= new Error(`the host runtime sent nothing for ${HEARTBEAT_TIMEOUT_MS} ms`);
      this.#socket.destroy();
    }, HEARTBEAT_TIMEOUT_MS).unref();
  }

  #send(message: Hello | Request | Ping): void {
    if (!this.#socket.destroyed) this.#socket.write(encodeFrame(message));
  }
}
