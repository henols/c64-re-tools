// Autostart without the autostart's own RUN: the caller decides when the
// program starts, so keys it types later never mix with VICE's typing.

import { textToPetscii } from "../c64.ts";
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

/** CURLIN high byte: $ff while BASIC waits in direct mode, a line number's high byte while a program runs. */
const CURLIN_HIGH = 0x003a;
export const RUN_LIMIT_FRAMES = 300;

/**
 * Autostart that returns only when the program runs: load without VICE's
 * own RUN, type RUN, and wait until BASIC runs a program line. A key that a
 * later step types then reaches the program, never the READY prompt. Returns
 * why it did not start, or undefined when it runs.
 */
export async function runProgram(client: ViceSessionClient, path: string, prg: Uint8Array): Promise<"not-loaded" | "not-started" | undefined> {
  if (!(await autostartLoaded(client, path, prg))) return "not-loaded";
  return (await typeRun(client)) ? undefined : "not-started";
}

/**
 * Types RUN at the READY prompt and stops where BASIC starts the first line,
 * before its SYS. Every tool that starts a loaded program this way reaches
 * its entry at the same raster line and timer values. False when BASIC
 * runs no line within RUN_LIMIT_FRAMES.
 */
export async function typeRun(client: ViceSessionClient): Promise<boolean> {
  await client.keyboard(textToPetscii("RUN\n"));
  const started = await client.runUntil({
    target: { kind: "memory", address: CURLIN_HIGH, operator: "ne", value: 0xff, space: "c64", view: "ram" },
    timeoutFrames: RUN_LIMIT_FRAMES,
  });
  return started.reached;
}
