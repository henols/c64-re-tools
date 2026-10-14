// Autostart without the autostart's own RUN: the caller decides when the
// program starts, so keys it types later never mix with VICE's typing.

import type { ViceSessionClient } from "./vice-session.ts";

/** How often, and for how long, a load is checked. */
export const LOAD_POLL_FRAMES = 25;
export const LOAD_LIMIT_FRAMES = 1500;

/**
 * Autostarts the PRG at `path` with run false and advances frames until its
 * first bytes are at its load address. Returns false when they do not arrive
 * within LOAD_LIMIT_FRAMES.
 */
export async function autostartLoaded(client: ViceSessionClient, path: string, prg: Uint8Array): Promise<boolean> {
  const load = prg[0]! | (prg[1]! << 8);
  const head = Buffer.from(prg.subarray(2, Math.min(prg.length, 2 + 64))).toString("hex");
  await client.autostart({ path, index: 0, run: false });
  for (let frames = 0; frames < LOAD_LIMIT_FRAMES; frames += LOAD_POLL_FRAMES) {
    await client.execution({ action: "advance-frames", count: LOAD_POLL_FRAMES, space: "c64" });
    if ((await client.memoryRead({ address: load, size: head.length / 2, space: "c64", view: "ram" })).data === head) return true;
  }
  return false;
}
