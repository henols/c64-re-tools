// The start screen of a loader program in VICE: the loader of a generated
// source shows it and waits for a key or a fire button that no step of a run
// or a scenario gives. Not each VICE can press a key of the keyboard matrix,
// so test and run let the program come to the wait, then set the PC to the
// code after the wait, as the check of the loader does. The replay core does
// the same in recording.ts.

import { formatC64Address } from "#src/c64.ts";
import type { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { startScreenLabels } from "#src/knowledge/start-screen.ts";

/** The frames from RUN to the wait: the copies or the unpack of the loader, then the screen. */
export const START_SCREEN_FRAMES = 3000;

/**
 * Goes past the start screen of a program whose symbols have the labels of a
 * shown start screen. "skipped" when it went past, "none" when the program
 * shows no start screen, or the problem when the program did not come to the wait.
 */
export async function passStartScreen(client: Pick<ViceSessionClient, "runUntil" | "registersSet">, symbols: ReadonlyMap<string, number>): Promise<"skipped" | "none" | { problem: string }> {
  const labels = startScreenLabels(symbols);
  if (labels === undefined) return "none";
  const reached = await client.runUntil({ target: { kind: "address", address: labels.wait, space: "c64" }, timeoutFrames: START_SCREEN_FRAMES });
  if (!reached.reached) return { problem: `the program did not come to the wait of its start screen at ${formatC64Address(labels.wait)} in ${START_SCREEN_FRAMES} frames; it stopped at ${formatC64Address(reached.pc)}` };
  await client.registersSet("c64", { pc: labels.continue });
  return "skipped";
}
