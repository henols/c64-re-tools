// The start screen of a loader program in VICE: the loader of a generated
// source shows it and waits for a key or a fire button. Not each VICE can
// press a key of the keyboard matrix, so test and run let the program come to
// the wait, then set the PC to the code after the wait, as the check of the
// loader does. Steps that name the wait or the code after the wait test the
// start screen itself: then the program stays at its start screen. The replay
// core goes past the start screen in recording.ts.

import { formatC64Address } from "#src/c64.ts";
import { stepLocations as actionStepLocations, type ActionStep, type Location } from "#src/host-client/steps.ts";
import type { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { startScreenLabels } from "#src/knowledge/start-screen.ts";
import type { RunStep } from "./runs.ts";
import type { Step } from "./scenario.ts";

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

/** The names and addresses of a step of a run or a scenario: its points, its memory and its pc, or those of an action step. */
function stepLocations(step: RunStep | Step): Location[] {
  if ("trace" in step) return step.points.flatMap((point) => [point.start, ...(point.end === undefined ? [] : [point.end])]);
  if ("expect" in step) return [...(step.memory ?? []).map((item) => item.address), ...(step.registers?.pc === undefined ? [] : [step.registers.pc])];
  if ("observe" in step) {
    if (step.memory === undefined || step.memory === "all") return [];
    return step.memory.flatMap((item) => (typeof item === "string" ? [item] : [item.address, ...("exclude" in item ? (item.exclude ?? []).map((excluded) => excluded.address) : [])]));
  }
  // A step of another kind than an action step has no location.
  return actionStepLocations(step as ActionStep);
}

/**
 * True when a step names the start screen: a name or an address of the step
 * resolves with `at`, as the step resolves it, to the wait or to the code
 * after the wait. Such steps test the start screen itself, so test and run do
 * not go past it. A name that `at` does not resolve names no start screen: its
 * step gives the problem when it runs.
 */
export function namesStartScreen(steps: ReadonlyArray<RunStep | Step>, at: (location: Location) => number, symbols: ReadonlyMap<string, number>): boolean {
  const labels = startScreenLabels(symbols);
  if (labels === undefined) return false;
  const named = (location: Location): boolean => {
    try {
      const address = at(location);
      return address === labels.wait || address === labels.continue;
    } catch {
      return false;
    }
  };
  return steps.some((step) => stepLocations(step).some(named));
}
