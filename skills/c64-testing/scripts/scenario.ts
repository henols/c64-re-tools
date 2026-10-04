// Functional-equivalence scenarios (13): a small JSON scenario of ordered
// steps runs on the original and then on the rebuild in one VICE session.
// Observations name semantic symbols that resolve per side, comparisons are
// explicit, and the result is PASS, FAIL or INCONCLUSIVE.

import { readFileSync } from "node:fs";

import { formatC64Address, parseC64Address, textToPetscii } from "../../../src/c64.ts";
import { WireFailure } from "../../../src/host-client/tools.ts";
import type { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { openForRead } from "../../../src/knowledge/database.ts";
import { listSymbols } from "../../../src/knowledge/read.ts";
import { resolveProjectPath } from "../../../src/project.ts";

export class ScenarioError extends Error {}

export type Side = "original" | "rebuild";
export const SIDES: Side[] = ["original", "rebuild"];

/** A "$xxxx" address or a symbol name that each side resolves on its own. */
export type Location = string;

export interface MemoryObservation {
  at: Location;
  /** Bytes from `at`; 1 when not given. */
  size?: number;
  /** The largest allowed difference per byte; 0 when not given. */
  tolerance?: number;
}

export interface ScreenPolicy {
  /** The largest allowed fraction of different pixels; 0 (exact) when not given. */
  maxMismatchRatio?: number;
  /** Rectangles that the comparison ignores, in screen pixels. */
  mask?: Array<{ x: number; y: number; width: number; height: number }>;
}

export type Step =
  | { reset: "hard" | "soft" }
  | { load: true }
  | { autostart: true }
  | { write: { at: Location; bytes: number[] } }
  | { registers: Partial<Record<"pc" | "a" | "x" | "y" | "sp", number | Location>> }
  | { joystick: { port: 1 | 2; direction: string; fire?: boolean } }
  | { type: string }
  | { frames: number }
  | { runUntil: { at: Location } | { memory: { at: Location; equals: number } }; timeoutFrames: number }
  | { observe: string; memory?: Array<Location | MemoryObservation>; registers?: string[]; screen?: ScreenPolicy; vicii?: boolean; sprites?: number[] };

export interface Subject {
  program: string;
  /** "knowledge" for knowledge.db, a project JSON file (c64-assembler output or a name → "$xxxx" map), or "none". */
  symbols: string;
}

export interface Scenario {
  name: string;
  videoStandard?: "pal" | "ntsc";
  original: Subject;
  rebuild: Subject;
  steps: Step[];
}

export type Outcome = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface Difference {
  checkpoint: string;
  what: string;
  original: unknown;
  rebuild: unknown;
}

export interface ScenarioResult {
  result: Outcome;
  scenario: string;
  /** Why the result is INCONCLUSIVE. */
  reason?: string;
  checkpoints: string[];
  differences: Difference[];
}

const STEP_KINDS = ["reset", "load", "autostart", "write", "registers", "joystick", "type", "frames", "runUntil", "observe"];

/** Reads and checks a scenario file. Throws ScenarioError naming the first problem. */
export function readScenario(path: string): Scenario {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolveProjectPath(path), "utf8"));
  } catch (error) {
    throw new ScenarioError(`cannot read the scenario ${path}: ${(error as Error).message}`);
  }
  const scenario = value as Scenario;
  const fail = (message: string): never => {
    throw new ScenarioError(`scenario ${path}: ${message}`);
  };
  if (typeof scenario !== "object" || scenario === null) fail("is not a JSON object");
  if (typeof scenario.name !== "string" || scenario.name === "") fail("needs a name");
  for (const side of SIDES) {
    const subject = scenario[side];
    if (typeof subject?.program !== "string" || typeof subject.symbols !== "string") fail(`${side} needs a program and symbols`);
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) fail("needs steps");
  const labels = new Set<string>();
  scenario.steps.forEach((step, index) => {
    // An observe step names what it observes with "memory" and "registers" too.
    const keys = "observe" in (step ?? {}) ? ["observe"] : Object.keys(step ?? {}).filter((key) => STEP_KINDS.includes(key));
    if (keys.length !== 1) fail(`step ${index + 1} must have exactly one of ${STEP_KINDS.join(", ")}`);
    if ("observe" in step) {
      if (typeof step.observe !== "string" || step.observe === "" || labels.has(step.observe)) fail(`step ${index + 1} needs a new checkpoint name`);
      labels.add(step.observe);
    }
    if ("runUntil" in step && !(Number.isInteger(step.timeoutFrames) && step.timeoutFrames > 0)) fail(`step ${index + 1} needs timeoutFrames`);
    if ("frames" in step && !(Number.isInteger(step.frames) && step.frames > 0)) fail(`step ${index + 1} needs a positive frame count`);
  });
  if (labels.size === 0) fail("observes nothing; add an observe step");
  return scenario;
}

/** Name → address for one side. */
export function loadSymbols(subject: Subject): Map<string, number> {
  const symbols = new Map<string, number>();
  if (subject.symbols === "none") return symbols;
  if (subject.symbols === "knowledge") {
    const db = openForRead();
    for (const symbol of listSymbols(db)) symbols.set(symbol.name, symbol.address);
    db?.close();
    return symbols;
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolveProjectPath(subject.symbols), "utf8"));
  } catch (error) {
    throw new ScenarioError(`cannot read the symbols ${subject.symbols}: ${(error as Error).message}`);
  }
  // c64-assembler output, or a plain name → "$xxxx" map. A constant in the
  // assembler output counts too: RAM variables such as "counter = $c100" lie
  // outside the program, so the assembler reports them as constants.
  const assembled = (value as { symbols?: Array<{ name: string; address?: string; value?: number }> }).symbols;
  const entries: Array<[string, unknown]> = Array.isArray(assembled)
    ? assembled.flatMap((symbol): Array<[string, unknown]> => {
        if (symbol.address !== undefined) return [[symbol.name, symbol.address]];
        if (Number.isInteger(symbol.value) && symbol.value! >= 0 && symbol.value! <= 0xffff) return [[symbol.name, formatC64Address(symbol.value!)]];
        return [];
      })
    : Object.entries(value as Record<string, unknown>);
  for (const [name, address] of entries) {
    try {
      symbols.set(name, parseC64Address(String(address)));
    } catch {
      throw new ScenarioError(`the symbol ${name} in ${subject.symbols} has no $xxxx address`);
    }
  }
  return symbols;
}

/** A failure that makes the comparison impossible: the result is INCONCLUSIVE. */
class Inconclusive extends Error {}

export function resolve(location: Location, symbols: Map<string, number>, side: Side): number {
  if (location.startsWith("$")) {
    try {
      return parseC64Address(location);
    } catch {
      throw new ScenarioError(`${location} is not $ followed by four hex digits`);
    }
  }
  const address = symbols.get(location);
  if (address === undefined) throw new Inconclusive(`the ${side} side has no symbol ${location}`);
  return address;
}

interface Observation {
  memory: Array<{ label: string; bytes: number[]; tolerance: number }>;
  registers: Record<string, number>;
  screen?: { match: boolean; mismatchingPixels: number; mismatchRatio: number; bounds?: unknown };
  vicii?: unknown;
  sprites?: unknown;
}

/** A session baseline name for a checkpoint: letters, digits, dots, underscores or hyphens. */
function baselineName(label: string): string {
  return `test-${label}`.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
}

async function runSide(client: ViceSessionClient, scenario: Scenario, side: Side, symbols: Map<string, number>): Promise<Map<string, Observation>> {
  const subject = scenario[side];
  const observations = new Map<string, Observation>();
  const at = (location: Location) => resolve(location, symbols, side);
  const stop = async () => {
    if ((await client.status()).state === "running") await client.execution({ action: "pause", space: "c64" });
  };
  // The control ports start released on each side.
  await client.joystick({ port: 1, direction: "center", fire: false });
  await client.joystick({ port: 2, direction: "center", fire: false });
  for (const step of scenario.steps) {
    // Observe first: an observe step may also carry "registers" or "memory".
    if ("observe" in step) {
      const observation: Observation = { memory: [], registers: {} };
      for (const item of step.memory ?? []) {
        const spec = typeof item === "string" ? { at: item } : item;
        const read = await client.memoryRead({ address: at(spec.at), size: spec.size ?? 1, space: "c64", view: "cpu" });
        observation.memory.push({ label: spec.size !== undefined && spec.size > 1 ? `${spec.at} (${spec.size} bytes)` : spec.at, bytes: [...Buffer.from(read.data, "hex")], tolerance: spec.tolerance ?? 0 });
      }
      if (step.registers !== undefined) {
        const registers = (await client.registersGet("c64")) as unknown as Record<string, number>;
        for (const name of step.registers) observation.registers[name] = registers[name]!;
      }
      if (step.vicii) observation.vicii = await client.vicii();
      if (step.sprites !== undefined) observation.sprites = (await client.sprites(step.sprites)).sprites;
      if (step.screen !== undefined) {
        const baseline = baselineName(step.observe);
        if (side === "original") {
          await client.screenCapture(baseline);
        } else {
          const compared = await client.screenCompare({ baseline, maxMismatchRatio: step.screen.maxMismatchRatio ?? 0, mask: step.screen.mask ?? [], includeDiff: false });
          observation.screen = { match: compared.match, mismatchingPixels: compared.mismatchingPixels, mismatchRatio: compared.mismatchRatio, ...(compared.bounds === undefined ? {} : { bounds: compared.bounds }) };
          await client.screenDiscard(baseline);
        }
      }
      observations.set(step.observe, observation);
    } else if ("reset" in step) {
      // Stopped at the reset vector, so frame counts from here are exact.
      await client.reset({ mode: step.reset, run: false });
    } else if ("load" in step) {
      await client.programLoad({ path: subject.program });
    } else if ("autostart" in step) {
      await client.autostart({ path: subject.program, index: 0, run: true });
    } else if ("write" in step) {
      await stop();
      await client.memoryWrite({ address: at(step.write.at), data: Buffer.from(step.write.bytes).toString("hex"), space: "c64", view: "cpu" });
    } else if ("registers" in step) {
      await stop();
      const values: Record<string, number> = {};
      for (const [name, value] of Object.entries(step.registers)) values[name] = typeof value === "number" ? value : at(value as Location);
      await client.registersSet("c64", values);
    } else if ("joystick" in step) {
      await client.joystick({ port: step.joystick.port, direction: step.joystick.direction as never, fire: step.joystick.fire ?? false });
    } else if ("type" in step) {
      await client.keyboard(textToPetscii(step.type));
    } else if ("frames" in step) {
      await stop();
      await client.execution({ action: "advance-frames", count: step.frames, space: "c64" });
    } else if ("runUntil" in step) {
      const target =
        "at" in step.runUntil
          ? { kind: "address" as const, address: at(step.runUntil.at), space: "c64" as const }
          : { kind: "memory" as const, address: at(step.runUntil.memory.at), operator: "eq" as const, value: step.runUntil.memory.equals, space: "c64" as const, view: "cpu" as const };
      const reached = await client.runUntil({ target, timeoutFrames: step.timeoutFrames });
      if (!reached.reached) {
        throw new Inconclusive(`the ${side} side did not reach the checkpoint before ${step.timeoutFrames} frames (it stopped by ${reached.stopReason} at ${formatC64Address(reached.pc)})`);
      }
    }
  }
  return observations;
}

/** The differences between the two sides' observations at each checkpoint, under the scenario's rules. */
export function compare(original: Map<string, Observation>, rebuild: Map<string, Observation>): Difference[] {
  const differences: Difference[] = [];
  for (const [checkpoint, left] of original) {
    const right = rebuild.get(checkpoint)!;
    left.memory.forEach((item, index) => {
      const other = right.memory[index]!;
      if (item.bytes.some((byte, at) => Math.abs(byte - other.bytes[at]!) > item.tolerance)) {
        const show = (bytes: number[]) => (bytes.length === 1 ? bytes[0] : Buffer.from(bytes).toString("hex"));
        differences.push({ checkpoint, what: `memory ${item.label}`, original: show(item.bytes), rebuild: show(other.bytes) });
      }
    });
    for (const [name, value] of Object.entries(left.registers)) {
      if (right.registers[name] !== value) differences.push({ checkpoint, what: `register ${name}`, original: value, rebuild: right.registers[name] });
    }
    const screenDiffers = right.screen !== undefined && !right.screen.match;
    if (screenDiffers) differences.push({ checkpoint, what: "screen", original: "baseline", rebuild: right.screen });
    if (left.vicii !== undefined && JSON.stringify(left.vicii) !== JSON.stringify(right.vicii)) differences.push({ checkpoint, what: "VIC-II state", original: left.vicii, rebuild: right.vicii });
    if (left.sprites !== undefined && JSON.stringify(left.sprites) !== JSON.stringify(right.sprites)) differences.push({ checkpoint, what: "sprites", original: left.sprites, rebuild: right.sprites });
  }
  return differences;
}

/** Runs the scenario on the original, then on the rebuild, in one VICE session. */
export async function runScenario(client: ViceSessionClient, scenario: Scenario): Promise<ScenarioResult> {
  const checkpoints = scenario.steps.flatMap((step) => ("observe" in step ? [step.observe] : []));
  const observed = new Map<Side, Map<string, Observation>>();
  for (const side of SIDES) {
    try {
      observed.set(side, await runSide(client, scenario, side, loadSymbols(scenario[side])));
    } catch (error) {
      if (error instanceof Inconclusive) return { result: "INCONCLUSIVE", scenario: scenario.name, reason: error.message, checkpoints, differences: [] };
      if (error instanceof WireFailure) {
        return { result: "INCONCLUSIVE", scenario: scenario.name, reason: `the ${side} side could not run: ${error.message}`, checkpoints, differences: [] };
      }
      throw error;
    }
  }
  const differences = compare(observed.get("original")!, observed.get("rebuild")!);
  return { result: differences.length === 0 ? "PASS" : "FAIL", scenario: scenario.name, checkpoints, differences };
}
