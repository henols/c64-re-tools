// An opt-in trace for the person who debugs a run. With C64RT_TRACE=<directory>
// in the environment, each process appends its events as JSON lines to a file
// of its own in that directory; unset, every call does nothing. The trace is
// for people: nothing of it reaches the agent, and no result depends on it.

import { appendFileSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { fileStampCet, isoCet } from "./time.ts";

export const TRACE_VARIABLE = "C64RT_TRACE";

/** The programs that write a trace, each to a file named after it. */
export type TraceKind = "host" | "mcp" | "script" | "cli";

/** The fields of one event. `t`, `kind` and `event` are set by the trace; a field that is undefined is left out. */
export type TraceFields = Record<string, unknown>;

const TEXT_LIMIT = 2_000;
const ITEM_LIMIT = 32;
const DEPTH_LIMIT = 4;
const RESERVED = new Set(["t", "kind", "event"]);

/**
 * A value as the trace records it: bytes become their count, text and arrays
 * beyond a limit are cut and say so, an Error keeps its name, message and
 * code, and an object deeper than four levels ends in "…".
 */
export function summarize(value: unknown, depth = 0): unknown {
  if (value instanceof Uint8Array) return { bytes: value.length };
  if (typeof value === "string") return value.length > TEXT_LIMIT ? `${value.slice(0, TEXT_LIMIT)}… (${value.length} characters)` : value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return { name: value.name, message: value.message, ...(typeof code === "string" ? { code } : {}) };
  }
  if (typeof value !== "object" || value === null) return value;
  if (depth >= DEPTH_LIMIT) return "…";
  if (Array.isArray(value)) {
    const items = value.slice(0, ITEM_LIMIT).map((item) => summarize(item, depth + 1));
    return value.length > ITEM_LIMIT ? [...items, `… (${value.length} items)`] : items;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, summarize(item, depth + 1)]));
}

/**
 * The version of c64-re-tools that runs, from the package.json next to src/:
 * the package's own, or the one that install writes into a skill. Undefined
 * when there is none.
 */
function runningVersion(): string | undefined {
  try {
    const { version } = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { version?: unknown };
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

/** Milliseconds since `since`, a performance.now() reading, to a tenth. */
export function elapsedMs(since: number): number {
  return Math.round((performance.now() - since) * 10) / 10;
}

export class Trace {
  readonly kind: TraceKind;
  /** The directory of the trace, or undefined when the trace is off. */
  readonly dir: string | undefined;
  /** The file this trace appends to, or undefined when the trace is off. */
  readonly file: string | undefined;
  #broken = false;

  private constructor(kind: TraceKind, dir: string | undefined, file: string | undefined) {
    this.kind = kind;
    this.dir = dir;
    this.file = file;
  }

  /** A trace that records nothing. */
  static off(kind: TraceKind): Trace {
    return new Trace(kind, undefined, undefined);
  }

  /**
   * A trace into `dir`, created when it is missing. The file is
   * `<kind>-<CET time>-<pid>.jsonl`, and its first event is `trace.start`.
   * Throws when the directory cannot be used.
   */
  static open(kind: TraceKind, dir: string, now = new Date()): Trace {
    mkdirSync(dir, { recursive: true });
    const trace = new Trace(kind, dir, join(dir, `${kind}-${fileStampCet(now)}-${process.pid}.jsonl`));
    trace.event("trace.start", { version: runningVersion(), pid: process.pid, argv: process.argv.slice(1), cwd: process.cwd(), node: process.version, platform: process.platform });
    return trace;
  }

  get on(): boolean {
    return this.file !== undefined && !this.#broken;
  }

  /** Appends one event. A write that fails turns the trace off; nothing throws. */
  event(name: string, fields: TraceFields = {}): void {
    if (!this.on) return;
    const line: Record<string, unknown> = { t: isoCet(), kind: this.kind, event: name };
    for (const [key, value] of Object.entries(fields)) {
      if (!RESERVED.has(key) && value !== undefined) line[key] = summarize(value);
    }
    try {
      appendFileSync(this.file!, `${JSON.stringify(line)}\n`);
    } catch {
      this.#broken = true;
    }
  }

  /** A free-text line, as the programs print to stderr, recorded as the event `log`. */
  log(line: string): void {
    this.event("log", { line });
  }

  /**
   * Copies a file that would otherwise go away (VICE's own log) next to the
   * trace, as `<kind>-<pid>-<name>`. A copy that fails is recorded, not thrown.
   */
  keep(source: string, name: string): void {
    if (!this.on) return;
    const target = join(this.dir!, `${this.kind}-${process.pid}-${name}`);
    try {
      copyFileSync(source, target);
      this.event("trace.kept", { source, file: target });
    } catch (error) {
      this.event("trace.keep-failed", { source, error });
    }
  }
}

// Off until a program calls startTrace; the kind is a placeholder until then.
let current = Trace.off("script");

/**
 * Switches the trace of this process on when `env` (the environment by
 * default) has C64RT_TRACE, and off otherwise. A directory that cannot be used
 * leaves the trace off and reports that through `warn`. Called once, at the
 * start of a program.
 */
export function startTrace(kind: TraceKind, options: { env?: NodeJS.ProcessEnv; warn?: (line: string) => void } = {}): Trace {
  const dir = (options.env ?? process.env)[TRACE_VARIABLE];
  if (dir === undefined || dir === "") {
    current = Trace.off(kind);
    return current;
  }
  try {
    current = Trace.open(kind, dir);
  } catch (error) {
    current = Trace.off(kind);
    options.warn?.(`${TRACE_VARIABLE}=${dir} cannot be used (${error instanceof Error ? error.message : String(error)}); the trace is off.`);
  }
  return current;
}

/** The trace of this process: off until startTrace switches it on. */
export function trace(): Trace {
  return current;
}
