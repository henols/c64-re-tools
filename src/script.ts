// The one call contract of the skill scripts. A script is
//
//   node skills/c64-<X>/scripts/<X>.ts <command> [subjects...] [--option value ...]
//
// The command word comes first. The subjects are the files, addresses, ranges or
// names that the command acts on. Everything else is a named option; an option
// with a name from OPTIONS has the same meaning and parser in every script.
// A script prints one JSON envelope on one line:
//
//   {ok: true, command, body, hint?, nextAction?}            exit status 0
//   {ok: false, command?, code, error, hint?, nextAction?}   exit status 2
//
// A verdict (PASS, FAIL, INCONCLUSIVE) is in the body: a check that fails is a
// command that worked. error is one sentence: what is wrong. hint tells what to
// do. nextAction is a full command line that runs from any directory. With no
// arguments or with --help, the command is "help" and the body is the usage.
// Nothing is thrown out of a script: every failure becomes an error envelope.

import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { c64AddressOf, formatC64Address, SPACE_PATTERN, SYMBOL_NAME, type AddressRange } from "./c64.ts";
import { isRefusal, Refusal, splitMessage, type ErrorCode } from "./errors.ts";
import { checkOutputPath, projectRoot, resolveProjectPath, resolveReadPath, useProject, type OutputKind } from "./project.ts";
import { STOP_AND_ASK } from "./protocol/messages.ts";
import { elapsedMs, startTrace, trace, type TraceFields } from "./trace.ts";

/** A wrong command line: an invalid-input refusal that also shows the usage of the command. */
export class UsageError extends Refusal {
  override name = "UsageError";

  constructor(message: string, options: { hint?: string } = {}) {
    super("invalid-input", message, options);
  }
}

/** A result with a hint or a next command for the envelope. A command returns it in place of the bare body. */
export class Reply {
  readonly body: unknown;
  readonly hint?: string;
  readonly nextAction?: string;

  constructor(body: unknown, extra: { hint?: string | undefined; nextAction?: string | undefined }) {
    this.body = body;
    if (extra.hint !== undefined) this.hint = extra.hint;
    if (extra.nextAction !== undefined) this.nextAction = extra.nextAction;
  }
}

export function reply(body: unknown, extra: { hint?: string | undefined; nextAction?: string | undefined }): Reply {
  return new Reply(body, extra);
}

/** A word for a POSIX shell: as it is when that is safe, else in single quotes. */
export function shellWord(word: string): string {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

/**
 * The full command line of this script with `args`: node, the absolute path of
 * the script, the args, and --project with the absolute project folder when
 * there is one. It runs from any directory.
 */
export function commandLine(args: readonly string[]): string {
  let project: string | undefined;
  try {
    project = projectRoot();
  } catch {
    project = undefined;
  }
  return ["node", resolve(process.argv[1] ?? ""), ...args, ...(project === undefined ? [] : ["--project", project])].map(shellWord).join(" ");
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
  | "space" // c64, drive8, loading, or bank0 to bank255
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
  /**
   * path only: the command writes there, a file or files in a folder. The
   * path is checked before the command runs (checkOutputPath). Every option
   * --out and --out-<name> has it.
   */
  output?: OutputKind;
  /**
   * An option whose value has a form: an example of that form for a value
   * that is missing or starts with -, made from that value when it fits.
   * The message then gives the form, not --<name>=<value>.
   */
  example?: (given: string | undefined) => string;
}

/** The options that have one meaning in every script. A command can change the help, the value and whether it is required, never the kind. */
export const OPTIONS = {
  out: { kind: "path", value: "<path>", help: "write the output here, relative to the project folder" },
  space: { kind: "space", value: "<space>", help: "the knowledge space: c64 (the default), drive8 for 1541 drive code, loading for a captured stage of the loading, or bank0 to bank255 for a cartridge bank or another memory image of the program", default: "c64" },
  range: { kind: "range", value: "<start>-<end>", help: "only the addresses from start to end, for example '$c000-$cfff'" },
  entry: { kind: "address", value: "<address>", help: "an entry point of the program" },
  steps: { kind: "path", value: "<file>", help: "a JSON file of action steps that run after the start" },
  frames: { kind: "count", value: "<n>", help: "run for this number of video frames", min: 1, max: 1_000_000 },
  "timeout-frames": { kind: "count", value: "<n>", help: "stop a wait after this number of video frames", min: 1, max: 1_000_000 },
  "max-listed": { kind: "count", value: "<n>", help: "list at most n items of each list (default 50). The counts are always given", min: 0, max: 100_000, default: 50 },
  symbols: { kind: "path", value: "<file>", help: "the symbols of a build: the symbols file of the assembler, or a JSON map of name to $ address" },
  origin: { kind: "text", value: "<origin>", help: "user, llm, dxa, ghidra, heuristic, semantic (user and llm) or analyzer (dxa, ghidra and heuristic), or a comma list" },
  reason: { kind: "text", value: "<text>", help: "why: kept with the revision" },
  evidence: { kind: "text", value: "<kind:ref>", help: "what the change rests on: coverage:<map>, test:<file>, file:<file> or note:<text>", multiple: true },
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

  /** The full command line of `command` of this script with `args`, for nextAction. */
  next(command: string, ...args: string[]): string {
    return commandLine([command, ...args]);
  }

  /** The knowledge space of the command: --space, else c64. */
  get space(): string {
    return ("space" in this.#options ? this.string("space") : undefined) ?? "c64";
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

  /** An address: $ and 1 to 4 hex digits, or a name in `space` (default: the space of the command). */
  parseAddress(text: string, what: string, space = this.space): number {
    const value = c64AddressOf(text);
    if (value !== undefined) return value;
    if (!SYMBOL_NAME.test(text)) throw new UsageError(`${what} must be ${ADDRESS_FORM}, not ${JSON.stringify(text)}`);
    if (this.#names === undefined) throw new UsageError(`${what}: ${this.script}.ts ${this.command} takes no names. Give $ and 1 to 4 hex digits, not ${text}`);
    try {
      return this.#names(text, space);
    } catch (error) {
      if (isRefusal(error)) throw new UsageError(`${what}: ${error.message}`);
      throw error;
    }
  }

  /** A range <start>-<end>, each an address; the start is not after the end. */
  parseRange(text: string, what: string, space = this.space): AddressRange {
    const parts = rangeParts(text);
    if (parts === undefined) throw new UsageError(`${what} must be <start>-<end>, each ${ADDRESS_FORM}, for example '$c000-$cfff', not ${JSON.stringify(text)}`);
    const start = this.parseAddress(parts[0], `${what} start`, space);
    const end = this.parseAddress(parts[1], `${what} end`, space);
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

/**
 * A list in a result: its count and its first `max` items (--max-listed). When
 * the list is cut, rest tells how to get all of it.
 */
export function listed<T, U = T>(items: readonly T[], max: number, show: (item: T) => U = (item) => item as unknown as U, rest = "a larger --max-listed"): { count: number; listed: U[]; rest?: string } {
  return { count: items.length, listed: items.slice(0, max).map(show), ...(items.length > max ? { rest } : {}) };
}

// ---------------------------------------------------------------------------
// Usage

/** The conventions in the help of every script. */
export const CONVENTIONS = `Addresses are $ and 1 to 4 hex digits, for example '$c000' or '$fb', or a name: a symbol, else an analyzer name that only one analyzer gives. A range is <start>-<end>, for example '$c000-$cfff'. Quote them in a shell.
Paths are relative to the project folder. Every script takes --project <folder>: the project folder, relative to the working directory. Without it, the script uses the nearest folder at or above the working directory that holds .c64-re-tools/. In a group folder, give --project with a project of the group. A path that a command only reads can go into another project of the group, for example ../v1/original/game.prg.
Each command prints one JSON envelope: {ok: true, command, body, hint?, nextAction?} with exit status 0, or {ok: false, command?, code, error, hint?, nextAction?} with exit status 2.`;

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

/** The help body of one command: its synopsis, subjects and options. */
export function commandHelp(script: ScriptSpec, command: CommandSpec): Record<string, unknown> {
  return {
    command: command.name,
    synopsis: synopsis(script.name, command),
    summary: command.summary,
    subjects: (command.subjects ?? []).map((subject) => ({ name: subject.list ? `${subject.name}...` : subject.name, help: subject.help, ...(subject.optional ? { optional: true } : {}) })),
    options: Object.entries(command.options ?? {}).map(([name, spec]) => ({
      flag: optionLabel(name, spec),
      help: spec.help,
      ...(spec.required ? { required: true } : {}),
      ...(spec.multiple ? { repeatable: true } : {}),
      ...(spec.default === undefined ? {} : { default: spec.default }),
    })),
    ...(command.notes === undefined ? {} : { notes: command.notes }),
    conventions: CONVENTIONS,
  };
}

/** The help body of a script: its commands. */
export function scriptHelp(script: ScriptSpec): Record<string, unknown> {
  return {
    script: `${script.name}.ts`,
    summary: script.summary,
    commands: script.commands.map((command) => ({ name: command.name, summary: command.summary, synopsis: synopsis(script.name, command) })),
    conventions: CONVENTIONS,
  };
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
    if (spec.kind === "path" && (name === "out" || name.startsWith("out-")) && spec.output === undefined) throw fault(`--${name} of ${command.name} has no output kind (file or folder)`);
    if (spec.output !== undefined && spec.kind !== "path") throw fault(`--${name} of ${command.name} has an output kind, but it is a ${spec.kind}, not a path`);
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

/**
 * Refuses a path that is not relative to the project folder or that leads out
 * of it; a path that the command only reads can also lead into the group folder
 * of the project. A refusal of the project lookup itself passes on.
 */
function checkPath(text: string, what: string, read = false): void {
  const root = projectRoot();
  try {
    if (read) resolveReadPath(text, root);
    else resolveProjectPath(text, root);
  } catch (error) {
    if (isRefusal(error)) throw new UsageError(`${what}: ${error.message}`);
    throw error;
  }
}

/**
 * Refuses a range in two parts: two subjects '$1bc2' '$1bd0' where the command
 * takes one <range>, or --start and --end where it takes a range option. The
 * message gives the range as one token.
 */
function refuseSplitRange(command: CommandSpec, options: Readonly<Record<string, OptionSpec>>, argv: readonly string[], subjects?: readonly string[]): void {
  if (subjects === undefined) {
    const end = argv.indexOf("--");
    const words = end < 0 ? argv : argv.slice(0, end);
    const valueOf = (name: string) => {
      const index = words.findIndex((word) => word === `--${name}` || word.startsWith(`--${name}=`));
      if (index < 0) return undefined;
      const word = words[index]!;
      return word.includes("=") ? word.slice(word.indexOf("=") + 1) : (words[index + 1] ?? "");
    };
    const [start, last] = [valueOf("start"), valueOf("end")];
    const range = Object.entries(options).find(([, spec]) => spec.kind === "range")?.[0];
    if ((start === undefined && last === undefined) || range === undefined || "start" in options || "end" in options) return;
    throw new UsageError(`${command.name} takes no --start or --end. Give the range as one option: --${range} '${start || "<start>"}-${last || "<end>"}'`);
  }
  const specs = command.subjects ?? [];
  for (let index = 0; index + 1 < subjects.length; index++) {
    const spec = specs[Math.min(index, specs.length - 1)];
    const [first, second] = [subjects[index]!, subjects[index + 1]!];
    if (spec === undefined || !spec.name.includes("range") || rangeParts(first) !== undefined || !isAddressText(first) || c64AddressOf(second) === undefined) continue;
    throw new UsageError(`${spec.name} is one token <start>-<end>: give '${first}-${second}', not '${first}' '${second}'`);
  }
}

/** a, b and c. */
function wordList(words: readonly string[]): string {
  return words.length === 1 ? words[0]! : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** The options of a command for a message: --a, --b and --c, or a word that it has none. */
function optionList(options: Readonly<Record<string, OptionSpec>>): string {
  const names = Object.keys(options).map((name) => `--${name}`);
  if (names.length === 0) return "The command takes no options";
  return `Its options are ${wordList(names)}`;
}

/** True for a word that the command line reads as an option: - and one or more characters. A lone - is a subject (standard input). */
const isOptionWord = (word: string) => word.length > 1 && word.startsWith("-");

/**
 * Refuses the words of a command line that parseArgs refuses, with a message
 * that names the option and tells what to give: an option that the command
 * does not have, a flag with a value, an option without its value, a value
 * that starts with -, and a range option in two parts.
 */
function refuseOptionWords(script: ScriptSpec, command: CommandSpec, options: Readonly<Record<string, OptionSpec>>, argv: readonly string[]): void {
  const end = argv.indexOf("--");
  const words = end < 0 ? argv : argv.slice(0, end);
  for (let index = 0; index < words.length; index++) {
    const word = words[index]!;
    if (!isOptionWord(word)) continue;
    if (!word.startsWith("--")) {
      throw new UsageError(`${word} is not an option of ${command.name}: an option starts with --. ${optionList(options)}. Give a subject that starts with - after --, for example -- ${word}`);
    }
    const equals = word.indexOf("=");
    const name = equals < 0 ? word.slice(2) : word.slice(2, equals);
    const spec = options[name];
    if (spec === undefined) {
      const takers = script.commands.filter((other) => other.options !== undefined && name in other.options).map((other) => other.name);
      const where = takers.length === 0 ? `No command of ${script.name}.ts takes --${name}.` : `--${name} is an option of ${wordList(takers)}.`;
      throw new UsageError(`${command.name} has no option --${name}.`, { hint: `${where} ${optionList(options)}.` });
    }
    if (spec.kind === "flag") {
      if (equals >= 0) throw new UsageError(`--${name} is a flag: give --${name} without a value`);
      continue;
    }
    let value: string;
    let valueIndex = index;
    if (equals >= 0) {
      value = word.slice(equals + 1);
    } else {
      valueIndex = index + 1;
      const next = words[valueIndex];
      const form = (given: string | undefined) => (spec.example === undefined ? "" : `, for example --${name} ${spec.example(given)}`);
      if (next === undefined) throw new UsageError(`--${name} needs a value: give --${name} ${spec.value ?? "<value>"}${form(undefined)}`);
      if (isOptionWord(next)) {
        if (spec.example !== undefined) throw new UsageError(`--${name} needs a value of the form ${spec.value ?? "<value>"}: give --${name} ${spec.value ?? "<value>"}${form(next)}, not ${next}`);
        if ((spec.kind === "count" || spec.kind === "number") && /^-\d/.test(next)) {
          const range = spec.kind === "count" ? `a whole number from ${spec.min ?? 0} to ${spec.max ?? Number.MAX_SAFE_INTEGER}` : `a number from ${spec.min ?? 0} to ${spec.max ?? 0xffff}`;
          throw new UsageError(`--${name} must be ${range}, not ${JSON.stringify(next)}`);
        }
        throw new UsageError(`--${name} needs a value: give --${name} ${spec.value ?? "<value>"}, not ${next}. Give a value that starts with - as --${name}=${next}`);
      }
      value = next;
      index++;
    }
    // A range option in two parts: --range '$1bc2' '$1c00'.
    const second = words[valueIndex + 1];
    if (spec.kind === "range" && rangeParts(value) === undefined && isAddressText(value) && second !== undefined && c64AddressOf(second) !== undefined) {
      throw new UsageError(`--${name} is one token <start>-<end>: give --${name} '${value}-${second}', not '${value}' '${second}'`);
    }
  }
}

/**
 * Refuses an output path before the command does any work: a path that
 * leaves the project, a path in the knowledge, a folder where a file must be,
 * a file where a folder must be, or a folder that cannot be written.
 */
function checkOutput(text: string, what: string, kind: OutputKind): void {
  checkPath(text, what);
  checkOutputPath(text, kind, { root: projectRoot(), what });
}

/** Parses the command line of one command. Refuses a wrong count of subjects, an unknown option, a missing required option or a value of the wrong form. */
export function parseCall(script: ScriptSpec, command: CommandSpec, argv: readonly string[]): Call {
  const options = commandOptions(command);
  refuseSplitRange(command, options, argv);
  refuseOptionWords(script, command, options, argv);
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      options: Object.fromEntries(Object.entries(options).map(([name, spec]) => [name, { type: spec.kind === "flag" ? "boolean" : "string", ...(spec.multiple ? { multiple: true } : {}) }])),
    });
  } catch {
    // refuseOptionWords gives a message of its own for each word that parseArgs refuses; this is the last guard.
    throw new UsageError(`the command line of ${command.name} is not correct. Give each option as --name <value>, each flag as --name, and a subject that starts with - after --`);
  }
  const values = parsed.values as Record<string, string | boolean | string[] | undefined>;
  const subjects = parsed.positionals;
  refuseSplitRange(command, options, argv, subjects);
  const specs = command.subjects ?? [];
  const last = specs.at(-1);
  const least = specs.filter((subject) => !subject.optional).length;
  const most = last?.list ? Number.POSITIVE_INFINITY : specs.length;
  if (subjects.length < least || subjects.length > most) {
    const named = specs.length === 0 ? "no subjects" : specs.map((subject) => (subject.list ? `${subject.name}...` : subject.name)).join(" ");
    throw new UsageError(subjects.length < least ? sentence(`${command.name} needs ${named}`) : `${sentence(`${command.name} takes ${named}`)} ${JSON.stringify(subjects[most])} is one too many.`);
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
      if (spec.kind === "space" && !SPACE_PATTERN.test(text)) throw new UsageError(`--${name} must be c64, drive8, loading, or bank0 to bank255, not ${JSON.stringify(text)}`);
      if (spec.kind === "choice" && !(spec.choices ?? []).includes(text)) throw new UsageError(`--${name} must be one of ${(spec.choices ?? []).join(", ")}, not ${JSON.stringify(text)}`);
      if (spec.kind === "path") {
        if (spec.output === undefined) checkPath(text, `--${name}`, true);
        else checkOutput(text, `--${name}`, spec.output);
      }
    }
  }
  const call = new Call(script.name, command.name, subjects, options, values, script.names);
  // Counts and numbers have no names: check them now, so that a wrong one is refused before the command starts.
  for (const [name, spec] of Object.entries(options)) if ((spec.kind === "count" || spec.kind === "number") && values[name] !== undefined) call.counts(name);
  return call;
}

// ---------------------------------------------------------------------------
// Running

/** A hint for a body with a cut list: the rest of the first list that has one. */
function cutListHint(body: unknown): string | undefined {
  const lists = (value: unknown, depth: number): string | undefined => {
    if (typeof value !== "object" || value === null || depth > 2) return undefined;
    const rest = (value as { rest?: unknown; count?: unknown }).rest;
    if (typeof rest === "string" && typeof (value as { count?: unknown }).count === "number") return rest;
    for (const item of Object.values(value)) {
      const found = lists(item, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const rest = lists(body, 0);
  return rest === undefined ? undefined : `A list in the body is cut: count gives its full size. To get the rest, give ${rest}.`;
}

/** The text with a full stop at its end, so that another sentence can follow it. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** What the envelope needs of a script. */
interface Envelope {
  name: string;
  /** Runs with the command line without --project. Calls found() with the command once it is known. Returns the body, or a Reply. */
  perform: (argv: string[], found: (command: string) => void) => unknown;
}

/**
 * The envelope of every script. It takes --project and runs the script. It
 * prints one JSON envelope line. Every failure, also one outside the command
 * (an exception or a rejection that nothing caught), prints an ok:false
 * envelope with exit status 2. A refusal keeps its code; a wrong command line
 * is invalid-input with the help command as nextAction; any other failure is
 * operation-failed, and its stack goes to the trace only.
 */
async function envelope(script: Envelope): Promise<void> {
  startTrace("script", { warn: (line) => process.stderr.write(`${line}\n`) });
  const started = performance.now();
  let printed = false;
  let commandName: string | undefined;

  const print = (value: Record<string, unknown>, status: number) => {
    if (printed) return;
    printed = true;
    process.stdout.write(`${JSON.stringify(value)}\n`);
    process.exitCode = status;
  };

  const fail = (error: unknown) => {
    let code: ErrorCode;
    let shown: { error: string; hint?: string };
    let nextAction: string | undefined;
    if (isRefusal(error)) {
      code = error.code;
      const stop = code === "installation-incomplete";
      const message = stop && error.message.endsWith(STOP_AND_ASK) ? error.message.slice(0, -STOP_AND_ASK.length).trim() : error.message;
      shown = splitMessage(message, (error as { hint?: string }).hint);
      if (stop) shown = { error: shown.error, hint: shown.hint === undefined ? STOP_AND_ASK : `${sentence(shown.hint)} ${STOP_AND_ASK}` };
      if (error instanceof UsageError) {
        const help = `To get the usage, run ${script.name}.ts${commandName === undefined ? "" : ` ${commandName}`} --help.`;
        shown = { error: shown.error, hint: shown.hint === undefined ? help : `${sentence(shown.hint)} ${help}` };
        nextAction = commandLine(commandName === undefined ? [] : [commandName, "--help"]);
      }
    } else {
      code = "operation-failed";
      const where = commandName === undefined ? `${script.name}.ts` : `${script.name}.ts ${commandName}`;
      const text = (error instanceof Error ? error.message : String(error)).replace(/\.$/, "");
      shown = { error: `${where} failed inside c64-re-tools: ${text}.`, hint: "This is a fault of the toolkit, not of the call. Give this message to the user. Set C64RT_TRACE to get its details in the trace." };
    }
    const message = shown.hint === undefined ? shown.error : `${shown.error} ${shown.hint}`;
    trace().event("script.end", { ms: elapsedMs(started), status: 2, error: { code, message }, ...(isRefusal(error) ? {} : { stack: error instanceof Error ? error.stack : String(error) }) } as TraceFields);
    print({ ok: false, ...(commandName === undefined ? {} : { command: commandName }), code, error: shown.error, ...(shown.hint === undefined ? {} : { hint: shown.hint }), ...(nextAction === undefined ? {} : { nextAction }) }, 2);
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
    const { body, hint, nextAction } = result instanceof Reply ? result : { body: result ?? {}, hint: undefined, nextAction: undefined };
    const cut = cutListHint(body);
    const shownHint = hint === undefined ? cut : cut === undefined || hint.includes("--max-listed") ? hint : `${sentence(hint)} ${cut}`;
    print({ ok: true, command: commandName ?? "help", body: body ?? {}, ...(shownHint === undefined ? {} : { hint: shownHint }), ...(nextAction === undefined ? {} : { nextAction }) }, 0);
    trace().event("script.end", { ms: elapsedMs(started), status: 0, result: body });
  } catch (error) {
    fail(error);
  }
}

/** Runs a script of the command contract: the command word, then its subjects and options. */
export async function runScript(script: ScriptSpec): Promise<void> {
  await envelope({
    name: script.name,
    perform: (argv, found) => {
      const [first, ...rest] = argv;
      const help = `To get the subjects and the options of one command, run ${script.name}.ts <command> --help.`;
      if (first === undefined) {
        found("help");
        return reply(scriptHelp(script), { hint: help });
      }
      if (first.startsWith("-")) {
        if (asksHelp(argv)) {
          found("help");
          return reply(scriptHelp(script), { hint: help });
        }
        throw new UsageError(`${first} comes before the command.`, { hint: `Give a command first: ${wordList(script.commands.map((command) => command.name))}.` });
      }
      const command = script.commands.find((item) => item.name === first);
      if (command === undefined) throw new UsageError(`${first} is not a command of ${script.name}.ts.`, { hint: `The commands are ${wordList(script.commands.map((item) => item.name))}.` });
      found(command.name);
      if (asksHelp(rest)) {
        found("help");
        return commandHelp(script, command);
      }
      return command.run(parseCall(script, command, rest));
    },
  });
}
