// The one call contract of the skill scripts. A script is
//
//   node skills/c64-<X>/scripts/<X>.ts <command> [subjects...] [--option value ...]
//
// The command word comes first. The subjects are the files, addresses, ranges or
// names that the command acts on. Everything else is a named option; an option
// with a name from OPTIONS has the same meaning and parser in every script.
// A script prints one JSON object on one line. An error is
// {"error":{"code","message"}}. Exit status: 0 done or PASS, 1 FAIL, 2 error,
// 3 INCONCLUSIVE. Nothing is thrown out of a script: every failure becomes an error.

import { parseArgs } from "node:util";

import { c64AddressOf, formatC64Address, SPACE_PATTERN, SYMBOL_NAME, type AddressRange } from "./c64.ts";
import { isRefusal, Refusal, type ErrorCode } from "./errors.ts";
import { useProject } from "./project.ts";
import { shownMessage } from "./protocol/messages.ts";
import { elapsedMs, startTrace, trace, type TraceFields } from "./trace.ts";

/** A wrong command line: an invalid-input refusal that also shows the usage of the command. */
export class UsageError extends Refusal {
  override name = "UsageError";

  constructor(message: string) {
    super("invalid-input", message);
  }
}

/** A fault of the toolkit, not of the call: a script that declares its options wrong. */
function fault(message: string): Refusal {
  return new Refusal("operation-failed", `${message}. This is a fault of the toolkit, not of the call.`);
}

// ---------------------------------------------------------------------------
// Declarations

/** How an option value parses. */
export type OptionKind =
  | "flag" // no value: true when given
  | "text" // any text
  | "path" // a path relative to the project folder
  | "count" // a whole number in decimal
  | "number" // a value: $ and hex digits, decimal, or % and binary digits
  | "address" // $ and 1 to 4 hex digits, or a name
  | "range" // <start>-<end>, each an address
  | "space" // c64, drive8, or bank0 to bank255
  | "choice"; // one of `choices`

export interface OptionSpec {
  kind: OptionKind;
  /** The value in the usage, for example <file>. Not for a flag. */
  value?: string;
  help: string;
  multiple?: boolean;
  required?: boolean;
  choices?: readonly string[];
  /** count and number: the smallest and the largest value. */
  min?: number;
  max?: number;
  /** The value when the option is not given. */
  default?: number | string;
}

/** The options that have one meaning in every script. A command can change the help, the value and whether it is required, never the kind. */
export const OPTIONS = {
  out: { kind: "path", value: "<path>", help: "write the output here, relative to the project folder" },
  space: { kind: "space", value: "<space>", help: "the knowledge space: c64 (the default), drive8 for 1541 drive code, or bank0 to bank255 for a cartridge bank", default: "c64" },
  range: { kind: "range", value: "<start>-<end>", help: "only the addresses from start to end, for example '$c000-$cfff'" },
  entry: { kind: "address", value: "<address>", help: "an entry point of the program" },
  steps: { kind: "path", value: "<file>", help: "a JSON file of action steps that run after the start" },
  frames: { kind: "count", value: "<n>", help: "run for this number of video frames", min: 1, max: 1_000_000 },
  "timeout-frames": { kind: "count", value: "<n>", help: "stop a wait after this number of video frames", min: 1, max: 1_000_000 },
  "max-listed": { kind: "count", value: "<n>", help: "list at most n items of each list (default 50). The counts are always given", min: 0, max: 100_000, default: 50 },
  symbols: { kind: "path", value: "<file>", help: "the symbols of a build: the c64-assembler output, or a JSON map of name to $ address" },
  origin: { kind: "text", value: "<origin>", help: "user, llm, dxa, ghidra, heuristic, semantic (user and llm) or analyzer (dxa, ghidra and heuristic), or a comma list" },
  reason: { kind: "text", value: "<text>", help: "why: kept with the revision" },
  evidence: { kind: "text", value: "<kind:ref>", help: "what the change rests on: coverage:<import>, test:<file>, file:<file> or note:<text>", multiple: true },
  "expect-revision": { kind: "text", value: "<revision>", help: "refuse the write when the knowledge changed after this revision" },
} as const satisfies Record<string, OptionSpec>;

export interface SubjectSpec {
  /** The name in the usage, for example <address>. */
  name: string;
  help: string;
  optional?: boolean;
  /** The last subject only: one or more (or zero or more when optional). */
  list?: boolean;
}

export interface CommandSpec {
  name: string;
  /** One line: what the command does. */
  summary: string;
  subjects?: readonly SubjectSpec[];
  options?: Readonly<Record<string, OptionSpec>>;
  /** More text for the usage of the command. */
  notes?: string;
  run: (call: Call) => unknown;
}

/** Gives the address of a name in a space; refuses a name that it does not know. */
export type NameResolver = (name: string, space: string) => number;

export interface ScriptSpec {
  /** The script name without .ts, for example knowledge. */
  name: string;
  summary: string;
  commands: readonly CommandSpec[];
  /** Resolves names in addresses and ranges. Without it, a name is refused. */
  names?: NameResolver;
}

// ---------------------------------------------------------------------------
// Values

const NUMBER_PATTERNS = [/^\$([0-9a-fA-F]{1,8})$/, /^%([01]{1,32})$/, /^(\d{1,10})$/];

/** A value as $ and hex digits, % and binary digits, or decimal digits; undefined for other text. */
export function numberOf(text: string): number | undefined {
  const [hex, binary, decimal] = NUMBER_PATTERNS.map((pattern) => pattern.exec(text)?.[1]);
  if (hex !== undefined) return Number.parseInt(hex, 16);
  if (binary !== undefined) return Number.parseInt(binary, 2);
  if (decimal !== undefined) return Number(decimal);
  return undefined;
}

/** True when the text has the form of an address: $ and 1 to 4 hex digits, or a name. */
export function isAddressText(text: string): boolean {
  return c64AddressOf(text) !== undefined || SYMBOL_NAME.test(text);
}

/** Splits <start>-<end>. A name has no hyphen, so the first hyphen is the split. */
function rangeParts(text: string): [string, string] | undefined {
  const parts = text.split("-");
  return parts.length === 2 && isAddressText(parts[0]!) && isAddressText(parts[1]!) ? [parts[0]!, parts[1]!] : undefined;
}

const ADDRESS_FORM = "$ and 1 to 4 hex digits, for example '$c000' or '$fb', or a name";

/** The parsed command line of one command, with the parsers for its values. */
export class Call {
  readonly script: string;
  readonly command: string;
  readonly subjects: readonly string[];
  readonly #options: Readonly<Record<string, OptionSpec>>;
  readonly #values: Readonly<Record<string, string | boolean | string[] | undefined>>;
  readonly #names: NameResolver | undefined;

  constructor(script: string, command: string, subjects: readonly string[], options: Readonly<Record<string, OptionSpec>>, values: Readonly<Record<string, string | boolean | string[] | undefined>>, names: NameResolver | undefined) {
    this.script = script;
    this.command = command;
    this.subjects = subjects;
    this.#options = options;
    this.#values = values;
    this.#names = names;
  }

  /** The knowledge space of the command: --space, else c64. */
  get space(): string {
    return "space" in this.#options ? this.string("space")! : "c64";
  }

  /** Subject `index` as text. */
  subject(index: number): string {
    const value = this.subjects[index];
    if (value === undefined) throw new UsageError(`${this.command} needs subject ${index + 1}`);
    return value;
  }

  /** The subjects from `index` to the end. */
  rest(index: number): string[] {
    return this.subjects.slice(index);
  }

  // Parsers for text: a subject, or a value in a JSON file. `what` names the value in an error.

  /** An address: $ and 1 to 4 hex digits, or a name in the space of the command. */
  parseAddress(text: string, what: string): number {
    const value = c64AddressOf(text);
    if (value !== undefined) return value;
    if (!SYMBOL_NAME.test(text)) throw new UsageError(`${what} must be ${ADDRESS_FORM}, not ${JSON.stringify(text)}`);
    if (this.#names === undefined) throw new UsageError(`${what}: ${this.script}.ts ${this.command} takes no names. Give $ and 1 to 4 hex digits, not ${text}`);
    try {
      return this.#names(text, this.space);
    } catch (error) {
      if (isRefusal(error)) throw new UsageError(`${what}: ${error.message}`);
      throw error;
    }
  }

  /** A range <start>-<end>, each an address; the start is not after the end. */
  parseRange(text: string, what: string): AddressRange {
    const parts = rangeParts(text);
    if (parts === undefined) throw new UsageError(`${what} must be <start>-<end>, each ${ADDRESS_FORM}, for example '$c000-$cfff', not ${JSON.stringify(text)}`);
    const start = this.parseAddress(parts[0], `${what} start`);
    const end = this.parseAddress(parts[1], `${what} end`);
    if (end < start) throw new UsageError(`${what} ends at ${formatC64Address(end)}, before its start ${formatC64Address(start)}`);
    return { start, end };
  }

  /** A value: $ and hex digits, decimal, or % and binary digits, from `min` to `max`. */
  parseNumber(text: string, what: string, min = 0, max = 0xffff): number {
    const value = numberOf(text);
    if (value === undefined || value < min || value > max) throw new UsageError(`${what} must be a number from ${min} to ${max} ($ and hex, decimal, or % and binary), not ${JSON.stringify(text)}`);
    return value;
  }

  /** A whole number in decimal, from `min` to `max`. */
  parseCount(text: string, what: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    if (!/^\d{1,15}$/.test(text) || Number(text) < min || Number(text) > max) throw new UsageError(`${what} must be a whole number from ${min} to ${max}, not ${JSON.stringify(text)}`);
    return Number(text);
  }

  // Options by name. Each getter checks that the command declares the option with a fitting kind.

  #spec(name: string, kinds: readonly OptionKind[]): OptionSpec {
    const spec = this.#options[name];
    if (spec === undefined || !kinds.includes(spec.kind)) throw fault(`${this.script}.ts ${this.command}: the option --${name} is not declared as ${kinds.join(" or ")}`);
    return spec;
  }

  #texts(name: string, kinds: readonly OptionKind[]): string[] {
    const spec = this.#spec(name, kinds);
    const value = this.#values[name];
    if (value === undefined) return spec.default === undefined ? [] : [String(spec.default)];
    return Array.isArray(value) ? value : [String(value)];
  }

  flag(name: string): boolean {
    this.#spec(name, ["flag"]);
    return this.#values[name] === true;
  }

  /** text, path, space or choice: the value, or the default, or undefined. */
  string(name: string): string | undefined {
    return this.#texts(name, ["text", "path", "space", "choice"])[0];
  }

  strings(name: string): string[] {
    return this.#texts(name, ["text", "path", "space", "choice"]);
  }

  /** count or number: the value, or the default, or undefined. */
  count(name: string): number | undefined {
    return this.counts(name)[0];
  }

  counts(name: string): number[] {
    const spec = this.#spec(name, ["count", "number"]);
    return this.#texts(name, ["count", "number"]).map((text) => (spec.kind === "count" ? this.parseCount(text, `--${name}`, spec.min, spec.max) : this.parseNumber(text, `--${name}`, spec.min, spec.max)));
  }

  address(name: string): number | undefined {
    return this.addresses(name)[0];
  }

  addresses(name: string): number[] {
    return this.#texts(name, ["address"]).map((text) => this.parseAddress(text, `--${name}`));
  }

  range(name: string): AddressRange | undefined {
    return this.ranges(name)[0];
  }

  ranges(name: string): AddressRange[] {
    return this.#texts(name, ["range"]).map((text) => this.parseRange(text, `--${name}`));
  }
}

// ---------------------------------------------------------------------------
// Usage

/** The text at the end of every usage. */
export const CONTRACT_USAGE = `Addresses are $ and 1 to 4 hex digits, for example '$c000' or '$fb', or a name: a symbol, else an analyzer name that only one analyzer gives. A range is <start>-<end>, for example '$c000-$cfff'. Quote them in a shell.
Paths are relative to the project folder. Every script takes --project <folder>: the project folder, relative to the working directory. Without it, the script uses the nearest folder at or above the working directory that holds .c64-re-tools/.
The result is one JSON object on one line. An error is {"error":{"code":"...","message":"..."}}.
Exit status: 0 done or PASS, 1 FAIL, 2 error, 3 INCONCLUSIVE.`;

function optionLabel(name: string, spec: OptionSpec): string {
  return spec.kind === "flag" ? `--${name}` : `--${name} ${spec.value ?? "<value>"}`;
}

function synopsis(script: string, command: CommandSpec): string {
  const parts = [`${script}.ts`, command.name];
  for (const subject of command.subjects ?? []) {
    const name = subject.list ? `${subject.name}...` : subject.name;
    parts.push(subject.optional ? `[${name}]` : name);
  }
  for (const [name, spec] of Object.entries(command.options ?? {})) {
    const label = optionLabel(name, spec);
    parts.push(spec.required ? label : `[${label}]${spec.multiple ? "..." : ""}`);
  }
  return parts.join(" ");
}

function table(rows: Array<[string, string]>): string[] {
  const width = Math.max(0, ...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, help]) => `  ${label.padEnd(width)}${help}`);
}

export function commandUsage(script: ScriptSpec, command: CommandSpec): string {
  const rows: Array<[string, string]> = [
    ...(command.subjects ?? []).map((subject): [string, string] => [subject.name, subject.help]),
    ...Object.entries(command.options ?? {}).map(([name, spec]): [string, string] => [optionLabel(name, spec), `${spec.help}${spec.multiple ? " (repeatable)" : ""}`]),
  ];
  return [synopsis(script.name, command), "", command.summary, ...(rows.length === 0 ? [] : ["", ...table(rows)]), ...(command.notes === undefined ? [] : ["", command.notes]), "", CONTRACT_USAGE].join("\n");
}

export function scriptUsage(script: ScriptSpec): string {
  return [
    `${script.name}.ts <command> [subjects...] [options]`,
    "",
    script.summary,
    "",
    "Commands:",
    ...table(script.commands.map((command) => [command.name, command.summary])),
    "",
    `Give ${script.name}.ts <command> --help for the subjects and options of one command.`,
    "",
    CONTRACT_USAGE,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Parsing

/** The options of a command, checked against OPTIONS: a shared name keeps its kind. */
function commandOptions(command: CommandSpec): Record<string, OptionSpec> {
  const options = { ...(command.options ?? {}) };
  for (const [name, spec] of Object.entries(options)) {
    const shared = (OPTIONS as Record<string, OptionSpec>)[name];
    if (shared !== undefined && shared.kind !== spec.kind) throw fault(`--${name} of ${command.name} is a ${spec.kind}, but OPTIONS has it as a ${shared.kind}`);
    if (name === "help" || name === "project") throw fault(`--${name} of ${command.name}: the contract owns this option`);
  }
  return options;
}

/**
 * Takes --project <folder> and --project=<folder> out of a command line, up to "--".
 * Returns the folder and the other arguments. Refuses a --project without a folder or a second --project.
 */
export function takeProject(argv: readonly string[]): { project?: string; argv: string[] } {
  const rest: string[] = [];
  let project: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (argument === "--") {
      rest.push(...argv.slice(index));
      break;
    }
    let value: string | undefined;
    if (argument === "--project") {
      value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) throw new UsageError("--project needs a folder");
      index++;
    } else if (argument.startsWith("--project=")) {
      value = argument.slice("--project=".length);
      if (value === "") throw new UsageError("--project needs a folder");
    } else {
      rest.push(argument);
      continue;
    }
    if (project !== undefined) throw new UsageError("give --project only once");
    project = value;
  }
  return project === undefined ? { argv: rest } : { project, argv: rest };
}

/** True when --help comes before "--". */
function asksHelp(argv: readonly string[]): boolean {
  const end = argv.indexOf("--");
  return (end < 0 ? argv : argv.slice(0, end)).includes("--help");
}

/** Parses the command line of one command. Refuses a wrong count of subjects, an unknown option, a missing required option or a value of the wrong form. */
export function parseCall(script: ScriptSpec, command: CommandSpec, argv: readonly string[]): Call {
  const options = commandOptions(command);
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      options: Object.fromEntries(Object.entries(options).map(([name, spec]) => [name, { type: spec.kind === "flag" ? "boolean" : "string", ...(spec.multiple ? { multiple: true } : {}) }])),
    });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const values = parsed.values as Record<string, string | boolean | string[] | undefined>;
  const subjects = parsed.positionals;
  const specs = command.subjects ?? [];
  const last = specs.at(-1);
  const least = specs.filter((subject) => !subject.optional).length;
  const most = last?.list ? Number.POSITIVE_INFINITY : specs.length;
  if (subjects.length < least || subjects.length > most) {
    const named = specs.length === 0 ? "no subjects" : specs.map((subject) => (subject.list ? `${subject.name}...` : subject.name)).join(" ");
    throw new UsageError(subjects.length < least ? `${command.name} needs ${named}` : `${command.name} takes ${named}. ${JSON.stringify(subjects[most])} is one too many`);
  }
  for (const [name, spec] of Object.entries(options)) {
    const value = values[name];
    if (value === undefined) {
      if (spec.required) throw new UsageError(`${command.name} needs ${optionLabel(name, spec)}`);
      continue;
    }
    for (const text of Array.isArray(value) ? value : [value]) {
      if (typeof text !== "string") continue;
      if (text === "") throw new UsageError(`--${name} needs a value`);
      if (spec.kind === "address" && !isAddressText(text)) throw new UsageError(`--${name} must be ${ADDRESS_FORM}, not ${JSON.stringify(text)}`);
      if (spec.kind === "range" && rangeParts(text) === undefined) throw new UsageError(`--${name} must be <start>-<end>, each ${ADDRESS_FORM}, for example '$c000-$cfff', not ${JSON.stringify(text)}`);
      if (spec.kind === "space" && !SPACE_PATTERN.test(text)) throw new UsageError(`--${name} must be c64, drive8, or bank0 to bank255, not ${JSON.stringify(text)}`);
      if (spec.kind === "choice" && !(spec.choices ?? []).includes(text)) throw new UsageError(`--${name} must be one of ${(spec.choices ?? []).join(", ")}, not ${JSON.stringify(text)}`);
    }
  }
  const call = new Call(script.name, command.name, subjects, options, values, script.names);
  // Counts and numbers have no names: check them now, so that a wrong one is refused before the command starts.
  for (const [name, spec] of Object.entries(options)) if ((spec.kind === "count" || spec.kind === "number") && values[name] !== undefined) call.counts(name);
  return call;
}

// ---------------------------------------------------------------------------
// Running

/** The exit status of a result: 1 for FAIL, 3 for INCONCLUSIVE, else 0. */
function exitStatusOf(result: unknown): number {
  const outcome = (result as { result?: unknown } | null | undefined)?.result;
  return outcome === "FAIL" ? 1 : outcome === "INCONCLUSIVE" ? 3 : 0;
}

/** True for an error that node:util parseArgs throws for a wrong command line. */
function isParseArgsError(error: unknown): error is Error {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return error instanceof Error && typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_");
}

/** What the envelope needs of a script: its name for messages, and the usage for a wrong command line. */
interface Envelope {
  name: string;
  /** The usage to show for a wrong command line, by the command that was found (or undefined). */
  usage: (command: string | undefined) => string;
  /** Runs with the command line without --project. Calls found() with the command once it is known. Returns the value to print; { text } for help. */
  perform: (argv: string[], found: (command: string) => void) => unknown;
}

/**
 * The envelope of every script. It takes --project and runs the script. It
 * prints the result as one JSON line. Every failure, also one outside the
 * command (an exception or a rejection that nothing caught), prints one
 * {"error":{code,message}} line with exit status 2. A refusal keeps its code; a
 * wrong command line is invalid-input with the usage; any other failure is
 * operation-failed, and its stack goes to the trace only.
 */
async function envelope(script: Envelope): Promise<void> {
  startTrace("script", { warn: (line) => process.stderr.write(`${line}\n`) });
  const started = performance.now();
  let printed = false;
  let commandName: string | undefined;

  const print = (value: unknown, status: number) => {
    if (printed) return;
    printed = true;
    process.stdout.write(`${JSON.stringify(value)}\n`);
    // A body of runBody may have set its own status for a FAIL.
    process.exitCode = status === 0 ? (process.exitCode ?? 0) : status;
  };

  const fail = (error: unknown) => {
    let code: ErrorCode;
    let message: string;
    if (error instanceof UsageError || isParseArgsError(error)) {
      code = "invalid-input";
      message = `${error.message}\n\n${script.usage(commandName)}`;
    } else if (isRefusal(error)) {
      code = error.code;
      message = shownMessage(error);
    } else {
      code = "operation-failed";
      const where = commandName === undefined ? `${script.name}.ts` : `${script.name}.ts ${commandName}`;
      message = `${where} failed inside c64-re-tools: ${error instanceof Error ? error.message : String(error)}. This is a fault of the toolkit, not of the call. Set C64RT_TRACE to get its details in the trace.`;
    }
    trace().event("script.end", { ms: elapsedMs(started), status: 2, error: { code, message }, ...(isRefusal(error) ? {} : { stack: error instanceof Error ? error.stack : String(error) }) } as TraceFields);
    print({ error: { code, message } }, 2);
  };

  // A failure that nothing caught, for example in a callback of a child process: one error line, then the end.
  // The write finishes before the exit: a pipe on Windows writes later.
  const fatal = (error: unknown) => {
    fail(error);
    process.stdout.write("", () => process.exit(2));
  };
  process.on("uncaughtException", fatal);
  process.on("unhandledRejection", fatal);

  try {
    const { project, argv } = takeProject(process.argv.slice(2));
    if (project !== undefined) useProject(project);
    const result = await script.perform(argv, (command) => {
      commandName = command;
    });
    const status = exitStatusOf(result);
    print(result ?? {}, status);
    trace().event("script.end", { ms: elapsedMs(started), status, result });
  } catch (error) {
    fail(error);
  }
}

/** Runs a script of the command contract: the command word, then its subjects and options. */
export async function runScript(script: ScriptSpec): Promise<void> {
  await envelope({
    name: script.name,
    usage: (name) => {
      const command = script.commands.find((item) => item.name === name);
      return command === undefined ? scriptUsage(script) : commandUsage(script, command);
    },
    perform: (argv, found) => {
      const [first, ...rest] = argv;
      if (first === undefined || first.startsWith("-")) {
        if (asksHelp(argv)) return { text: scriptUsage(script) };
        throw new UsageError(`give a command: ${script.commands.map((command) => command.name).join(", ")}`);
      }
      const command = script.commands.find((item) => item.name === first);
      if (command === undefined) throw new UsageError(`${first} is not a command of ${script.name}.ts. The commands are ${script.commands.map((item) => item.name).join(", ")}`);
      found(command.name);
      if (asksHelp(rest)) return { text: commandUsage(script, command) };
      return command.run(parseCall(script, command, rest));
    },
  });
}

/**
 * The envelope of a script that does not use the command contract yet: the body
 * gets the command line without --project and returns the result. The errors
 * and the exit status follow the contract. The last script that moves to
 * runScript deletes this.
 */
export async function runBody(body: (argv: string[]) => unknown, options: { usage: string }): Promise<void> {
  const name = process.argv[1]?.split(/[\\/]/).at(-1)?.replace(/\.ts$/, "") ?? "script";
  await envelope({
    name,
    usage: () => `${options.usage}\n\n${CONTRACT_USAGE}`,
    perform: (argv) => (asksHelp(argv) ? { text: `${options.usage}\n\n${CONTRACT_USAGE}` } : body(argv)),
  });
}
