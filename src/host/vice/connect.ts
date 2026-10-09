// The TCP connect that both VICE monitor clients share.

import { connect, type Socket } from "node:net";

/**
 * Connects to a VICE monitor port and wraps the socket with `wrap` at once.
 * Rejects with the error that `failure` makes from a message when the
 * connection fails or takes longer than `timeoutMs`.
 */
export function connectWithTimeout<T>(options: {
  port: number;
  host: string;
  timeoutMs: number;
  wrap: (socket: Socket) => T;
  failure: (message: string) => Error;
}): Promise<T> {
  const { port, host, timeoutMs, wrap, failure } = options;
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(failure(`connect to port ${port} timed out`));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.removeAllListeners("error");
      resolve(wrap(socket));
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(failure(`connect to port ${port} failed: ${error.message}`));
    });
  });
}
