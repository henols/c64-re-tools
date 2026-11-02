// Helpers of the tests of source.ts generate: a project with a captured
// program in its knowledge, knowledge writes without a script run, and the run
// of generate itself.

import type { DatabaseSync } from "node:sqlite";

import { formatC64Address } from "../../src/c64.ts";
import { withWrite } from "../../src/knowledge/database.ts";
import { operandImages } from "../../src/knowledge/program.ts";
import type { WriteContext } from "../../src/knowledge/write.ts";
import { platformNames } from "../../src/platform.ts";
import { importImage } from "../fixtures/program.ts";
import { runScriptSync, scratchDir, skillScript, type ScriptRun } from "../kit.ts";

const SOURCE = skillScript("c64-source", "source.ts");
const PLATFORM = new Map(platformNames().map((entry) => [entry.name, entry.address]));

/** Runs source.ts generate --out src in the project, without a Host Runtime. */
export function generate(project: string, ...args: string[]): ScriptRun {
  return runScriptSync(SOURCE, ["generate", "--out", "src", ...args], { cwd: project });
}

/** Writes knowledge as knowledge.ts does for the LLM: operand, patch and macro use writes are checked against the program and the platform names. */
export function writeKnowledge<T>(project: string, work: (db: DatabaseSync, context: WriteContext) => T): T {
  return withWrite((db) => work(db, { origin: "llm", image: operandImages(db, PLATFORM) }), project);
}

/** The entry state of a capture at `entry`: the registers, the CPU port of the KERNAL and pages 0-3. */
function captureState(entry: number): Record<string, unknown> {
  return {
    registers: { pc: formatC64Address(entry), a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: false, z: false, c: false } },
    cpuPort: { $00: 0x2f, $01: 0x37 },
    pages: Object.fromEntries([0, 1, 2, 3].map((page) => [formatC64Address(page << 8), "00".repeat(256)])),
  };
}

/**
 * A project whose knowledge has a captured program: the bytes of each
 * segment, the entry and the entry state. The default is $1000-$1003, RTS first.
 */
export function capturedProject(
  entry: number,
  segments: Array<{ start: number; bytes: ArrayLike<number> }> = [{ start: 0x1000, bytes: [0x60, 0xea, 0xea, 0xea] }],
): { project: string; generate: (...args: string[]) => ScriptRun } {
  const project = scratchDir("source");
  const memory = new Uint8Array(0x10000);
  for (const segment of segments) memory.set(segment.bytes, segment.start);
  importImage(project, memory, { segments: segments.map(({ start, bytes }) => ({ start, end: start + bytes.length - 1 })), entry, state: captureState(entry) });
  return { project, generate: (...args) => generate(project, ...args) };
}
