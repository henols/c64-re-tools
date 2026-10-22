// The session of the MCP server: one at a time, opened again after a loss.

import { WireFailure } from "../protocol/messages.ts";
import { elapsedMs, trace } from "../trace.ts";
import type { SessionSource } from "./server.ts";

/** What the session source needs of the session client of a family. */
export interface SessionClient {
  readonly closed: Promise<void>;
  readonly lost: boolean;
  readonly answered: boolean;
  readonly unreportedLoss: WireFailure | undefined;
  close(): Promise<void>;
}

/**
 * One session at a time (1 MCP = 1 session = 1 VICE). It opens at start; if
 * that fails (for example the host was not running yet), the next tool call
 * tries again. When the host connection is lost, the next call opens a new
 * session. A lost session that the emulator answered first gives its
 * machine-state-lost once, unless a pending call got it already. Close stops
 * an open that is still waiting for the host at once. A host of another
 * release refuses the new session: then that refusal comes instead of the
 * machine-state-lost, since it tells what to do.
 */
export function sessionSource<C extends SessionClient>(openClient: (signal: AbortSignal) => Promise<C>, log: (line: string) => void, name = "C64"): { get: SessionSource<C>; close(): Promise<void> } {
  let opening: Promise<C> | undefined;
  let lostNotice: WireFailure | undefined;
  let closed = false;
  const stop = new AbortController();
  const open = () => {
    const started = performance.now();
    const current = (async () => openClient(stop.signal))();
    opening = current;
    void current.then(
      (client) => {
        trace().event("session.opened", { ms: elapsedMs(started) });
        void client.closed.then(() => drop(current, client));
      },
      () => {},
    );
    current.catch((error: unknown) => {
      log(`session not opened: ${error instanceof Error ? error.message : String(error)}`);
      if (opening === current) opening = undefined;
    });
    return current;
  };
  /** Forgets a lost session, once; the next call opens a new one. */
  const drop = (current: Promise<C>, client: C) => {
    if (closed || opening !== current) return;
    log("the connection to the host runtime was lost; the next call opens a new session");
    opening = undefined;
    if (client.answered) lostNotice = client.unreportedLoss;
  };
  open();
  const get = async (): Promise<C> => {
    if (closed) throw new WireFailure("machine-unavailable", `The ${name} session is shutting down.`);
    if (lostNotice !== undefined) {
      const notice = lostNotice;
      lostNotice = undefined;
      // A host of another release refuses the new session: that refusal tells what to do, the lost machine state does not.
      const refusal = await (opening ?? open()).then(
        () => undefined,
        (error: unknown) => (error instanceof WireFailure && error.code === "installation-incomplete" ? error : undefined),
      );
      throw refusal ?? notice;
    }
    const current = opening ?? open();
    const client = await current;
    if (!client.lost) return client;
    // The loss is known here before the close event reaches drop.
    drop(current, client);
    return get();
  };
  return {
    get,
    async close() {
      closed = true;
      stop.abort();
      const session = await opening?.catch(() => undefined);
      await session?.close();
    },
  };
}
