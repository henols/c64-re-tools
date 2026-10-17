// The c64-knowledge script: reads and writes .c64-re-tools/knowledge/ in the
// project folder (--project, or the one found from the working directory).
// Each command prints one JSON result.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { formatC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { readImage } from "#src/host-client/image.ts";
import { readProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { CONFLICT_RULES, conflicts, type Conflict } from "#src/knowledge/conflicts.ts";
import { openForRead, withWrite } from "#src/knowledge/database.ts";
import { operandText } from "#src/knowledge/expression.ts";
import { historyAt, historyNamed, historyOfMacro, revision, revisionNote, revisions, type HistoryEntry } from "#src/knowledge/history.ts";
import { joinBatches, type Batch, type JoinChoice, type JoinClash } from "#src/knowledge/join.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { addCoverage, coverageRuns, programCoverage, programImage, requireProgram, setImage, type ImageRequest } from "#src/knowledge/program.ts";
import {
  analyzerNamesAt,
  at,
  commentsAt,
  currentRevision,
  listAnalyzerNames,
  listComments,
  listMacros,
  listMacroUses,
  listModules,
  listOperands,
  listPatches,
  listReferences,
  listRegions,
  listSpaces,
  listSuppressions,
  listSymbols,
  operandAt,
  referencesFrom,
  referencesTo,
  search,
  symbolAt,
  type CommentRow,
  type MacroRow,
  type MacroUseRow,
  type ModuleRow,
  type OperandRow,
  type PatchRow,
  type ReferenceRow,
  type RegionRow,
  type SuppressionRow,
  type SymbolRow,
} from "#src/knowledge/read.ts";
import { ANALYZERS, COMMENT_PLACEMENTS, DEFAULT_SPACE, EVIDENCE_KINDS, isSemantic, OPERAND_SELECTS, ORIGINS, REFERENCE_KINDS, REGION_TYPES, SEMANTIC_ORIGINS, SYMBOL_KINDS, type Origin, type OperandSelect } from "#src/knowledge/schema.ts";
import {
  addReference,
  applyBatch,
  classifyRegion,
  mergeConflicts,
  removeComment,
  removeMacro,
  removeMacroUse,
  removeModule,
  removeOperand,
  removePatch,
  removeReference,
  removeSymbol,
  renameSymbol,
  revert,
  setComment,
  setMacro,
  setMacroUse,
  setModule,
  setOperand,
  setPatch,
  unclassifyRegion,
  type BatchOperation,
  type BatchStep,
  type Evidence,
  type MergeChoice,
  type OperandImage,
  type WriteContext,
} from "#src/knowledge/write.ts";
import { platformNames } from "#src/platform.ts";
import { isInside, LOCAL_DIRECTORY, PROJECT_DIRECTORY, projectRelative, projectRoot, resolveProjectPath } from "#src/project.ts";
import { OPTIONS, runScript, UsageError, type Call, type CommandSpec, type OptionSpec, type SubjectSpec } from "#src/script.ts";
import { listing, listingText, type ListingSource } from "./lib/listing.ts";

function oneOf<T extends string>(values: readonly T[], value: string | undefined, what: string): T {
  if (value === undefined || !(values as readonly string[]).includes(value)) throw new UsageError(`${what} must be one of: ${values.join(", ")}`);
  return value as T;
}

// Output shapes: addresses as $xxxx, nothing internal.
/** The space of a row, shown only when it is not the C64. */
const spaceOf = (row: { space: string }) => (row.space === "c64" ? {} : { space: row.space });
const symbol = (row: SymbolRow) => ({ ...spaceOf(row), address: formatC64Address(row.address), name: row.name, kind: row.kind, origin: row.origin, revision: row.revision });
const region = (row: RegionRow) => ({
  ...spaceOf(row),
  start: formatC64Address(row.start),
  end: formatC64Address(row.end),
  type: row.type,
  ...(row.element === undefined ? {} : { element: row.element, count: (row.end - row.start + 1) / row.element }),
  origin: row.origin,
  revision: row.revision,
});
const comment = (row: CommentRow) => ({ ...spaceOf(row), address: formatC64Address(row.address), placement: row.placement, text: row.text, origin: row.origin, revision: row.revision });
const module = (row: ModuleRow) => ({ ...spaceOf(row), start: formatC64Address(row.start), file: row.file, ...(row.title === undefined ? {} : { title: row.title }), origin: row.origin, revision: row.revision });
const operand = (row: OperandRow) => ({
  ...spaceOf(row),
  address: formatC64Address(row.address),
  select: row.select,
  ...(row.symbol === undefined ? {} : { symbol: row.symbol }),
  ...(row.offset === 0 ? {} : { offset: row.offset }),
  ...(row.expression === undefined ? {} : { expression: row.expression }),
  text: operandText(row),
  origin: row.origin,
  revision: row.revision,
});
const patch = (row: PatchRow) => ({
  ...spaceOf(row),
  start: formatC64Address(row.start),
  end: formatC64Address(row.end),
  bytes: row.end - row.start + 1,
  switch: row.switch,
  code: row.code,
  ...(row.comment === undefined ? {} : { comment: row.comment }),
  origin: row.origin,
  revision: row.revision,
});
const macro = (row: MacroRow) => ({ ...spaceOf(row), name: row.name, params: row.params, body: row.body, ...(row.comment === undefined ? {} : { comment: row.comment }), origin: row.origin, revision: row.revision });
const macroUse = (row: MacroUseRow) => ({
  ...spaceOf(row),
  start: formatC64Address(row.start),
  end: formatC64Address(row.end),
  macro: row.macro,
  args: row.args,
  text: `+${row.macro}${row.args.length === 0 ? "" : ` ${row.args.join(", ")}`}`,
  origin: row.origin,
  revision: row.revision,
});
const reference = (row: ReferenceRow) => ({ ...spaceOf(row), from: formatC64Address(row.from), to: formatC64Address(row.to), kind: row.kind, origin: row.origin, revision: row.revision });
function suppression(row: SuppressionRow) {
  const place =
    row.entity === "symbol"
      ? { address: formatC64Address(row.start) }
      : row.entity === "region"
        ? { start: formatC64Address(row.start), end: formatC64Address(row.end) }
        : { from: formatC64Address(row.start), to: formatC64Address(row.to!), kind: row.kind! };
  return { ...spaceOf(row), suppresses: row.entity, ...place, origin: row.origin, revision: row.revision };
}

function historyEntry(entry: HistoryEntry) {
  const shown =
    entry.entity === "symbol" || entry.entity === "analyzer-name"
      ? symbol(entry.row)
      : entry.entity === "region"
        ? region(entry.row)
        : entry.entity === "comment"
          ? comment(entry.row)
          : entry.entity === "reference"
            ? reference(entry.row)
            : entry.entity === "module"
              ? module(entry.row)
              : entry.entity === "operand"
                ? operand(entry.row)
                : entry.entity === "patch"
                  ? patch(entry.row)
                  : entry.entity === "macro"
                    ? macro(entry.row)
                    : entry.entity === "macro-use"
                      ? macroUse(entry.row)
                      : suppression(entry.row);
  const { revision: _revision, ...row } = shown;
  return { entity: entry.entity, ...row, fromRevision: entry.from, ...(entry.to === undefined ? {} : { toRevision: entry.to }) };
}

/** A conflict of a git merge: what is wrong, and the rows, oldest first. */
function showConflict(conflict: Conflict) {
  return { conflict: CONFLICT_RULES[conflict.rule], ...spaceOf(conflict), rows: conflict.rows.map(historyEntry) };
}

/** What merge decided for one conflict: the row that stays and the rows it closed. */
function showChoice(choice: MergeChoice) {
  return { conflict: CONFLICT_RULES[choice.rule], ...spaceOf(choice), kept: historyEntry(choice.kept), closed: choice.closed.map(historyEntry) };
}

/** The reason of each revision that wrote one of the rows. */
function reasonsOf(db: DatabaseSync | undefined, rows: SuppressionRow[]): Map<string, string> {
  const reasons = new Map<string, string>();
  const query = db?.prepare("SELECT description FROM revisions WHERE id = ?");
  for (const { revision } of rows) {
    if (query === undefined || reasons.has(revision)) continue;
    const found = query.get(revision) as { description: string | null } | undefined;
    if (found?.description != null) reasons.set(revision, found.description);
  }
  return reasons;
}

/** The lookups of a listing: the program and the coverage in the knowledge, the knowledge of the space and the platform names of the C64. */
function listingSource(db: DatabaseSync | undefined, space: string): ListingSource {
  const image = requireProgram(db, space);
  const coverage = programCoverage(db, space)?.map;
  const inside = (at: number) => image.segments.some((segment) => at >= segment.start && at <= segment.end);
  const platform = new Map(space === DEFAULT_SPACE ? platformNames().map((entry) => [entry.address, entry.name]) : []);
  return {
    byteAt: (at) => (inside(at) ? image.byteAt(at) : undefined),
    // A user or LLM name, else the platform name; an analyzer name in symbols (knowledge from an older version) gives way to it.
    nameOf: (at) => {
      const own = symbolAt(db, at, space);
      return own !== undefined && isSemantic(own.origin) ? own.name : (platform.get(at) ?? own?.name);
    },
    secondNames: (at) => analyzerNamesAt(db, at, space).map((row) => row.name),
    regions: listRegions(db, undefined, undefined, undefined, space),
    comments: (at) => {
      const rows = commentsAt(db, at, space);
      const side = rows.find((row) => row.placement === "side")?.text;
      return { line: rows.filter((row) => row.placement === "line").flatMap((row) => row.text.split(/\r?\n/)), ...(side === undefined ? {} : { side }) };
    },
    operand: (at) => {
      const row = operandAt(db, at, space);
      return row === undefined ? undefined : operandText(row);
    },
    references: (at) => ({ in: referencesTo(db, at, space).length, out: referencesFrom(db, at, space).length }),
    ...(coverage === undefined ? {} : { coverage }),
  };
}

/** --origin for reads: one origin, semantic (user and llm), analyzer (dxa and ghidra), or a comma list. */
function originFilter(value: string): Origin[] {
  const origins = new Set<Origin>();
  for (const part of value.split(",")) {
    if (part === "semantic") for (const origin of SEMANTIC_ORIGINS) origins.add(origin);
    else if (part === "analyzer") for (const origin of ANALYZERS) origins.add(origin);
    else origins.add(oneOf(ORIGINS, part, "--origin"));
  }
  return [...origins];
}

/** A project path as the knowledge names it: one spelling for each file, so ./runs/a.bin and runs/a.bin are the same file. */
function knowledgePath(path: string, what: string): string {
  try {
    return projectRelative(path);
  } catch {
    throw new UsageError(`${what} must be a path relative to the project folder that stays inside it, not ${path}`);
  }
}

/**
 * --evidence kind:ref. A file kind names a project file and keeps its SHA-256, so a later change of the file shows.
 * A file in .c64-re-tools/local/ is refused: git ignores it, and the move that keeps it changes the path.
 */
function evidenceOf(value: string, space: string): Evidence {
  const colon = value.indexOf(":");
  const kind = oneOf(EVIDENCE_KINDS, colon < 0 ? value : value.slice(0, colon), "--evidence kind");
  const given = colon < 0 ? "" : value.slice(colon + 1);
  if (given === "") throw new UsageError(`--evidence needs ${kind}:<${kind === "note" ? "text" : "file"}>`);
  if (kind === "note") return { kind, ref: given };
  const ref = knowledgePath(given, `--evidence ${kind}:<file>`);
  // A coverage map is evidence by the name that coverage imported it with: the latest import into the space of the write.
  if (kind === "coverage") {
    const db = openForRead();
    try {
      const run = coverageRuns(db).filter((item) => item.name === ref && item.space === space).at(-1);
      const where = space === DEFAULT_SPACE ? "" : ` in ${space}`;
      if (run === undefined) throw new UsageError(`--evidence coverage:${given} names no coverage map of the knowledge${where}: import the map with coverage${space === DEFAULT_SPACE ? "" : ` --space ${space}`} first`);
      return { kind, ref, sha256: run.sha256, ...(run.space === DEFAULT_SPACE ? {} : { space: run.space }) };
    } finally {
      db?.close();
    }
  }
  const bytes = readProjectFile(ref).bytes;
  const root = projectRoot();
  if (isInside(join(root, PROJECT_DIRECTORY, LOCAL_DIRECTORY), resolveProjectPath(ref, root))) {
    throw new UsageError(`--evidence ${kind}:${ref} is in ${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/, which git ignores: move it to a folder that git keeps (a run folder to runs/<name>/) and give the new path`);
  }
  return { kind, ref, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** An image.json of c64-unpacker capture or a PRG as a write of the program, with the entry state of the capture. */
function imageRequest(path: string, space: string): ImageRequest {
  const image = readImage(path);
  const request: ImageRequest = { space, segments: image.segments, byteAt: image.byteAt };
  if (image.entry !== undefined) request.entry = image.entry;
  if (image.stages !== undefined) request.stages = image.stages;
  if (image.state !== undefined) request.state = image.state.raw;
  return request;
}

/**
 * The program in the knowledge that operand, patch and macro use writes
 * are checked against, with the platform names. A byte outside
 * the segments of the program is not in it.
 */
function operandImage(db: DatabaseSync, space: string): OperandImage {
  const image = requireProgram(db, space);
  const inside = (at: number) => image.segments.some((segment) => at >= segment.start && at <= segment.end);
  return { byteAt: (at) => (inside(at) ? image.byteAt(at) : undefined), platform: new Map(platformNames().map((entry) => [entry.name, entry.address])) };
}

/** An offset: a whole number in decimal or $ hex, with an optional minus sign. */
function offsetOf(value: unknown, what: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const match = typeof value === "string" ? /^(-?)(\$[0-9A-Fa-f]{1,4}|[0-9]{1,5})$/.exec(value) : null;
  if (match === null) throw new UsageError(`${what} must be a whole number such as 1, -1 or '$1000'`);
  const size = match[2]!.startsWith("$") ? Number.parseInt(match[2]!.slice(1), 16) : Number(match[2]);
  return match[1] === "-" ? -size : size;
}

/** A row that a write of a batch replaced, in its output shape. */
function shownPrevious(row: NonNullable<BatchStep["previous"]>) {
  if (Array.isArray(row)) return row.map(region);
  if ("select" in row) return operand(row);
  if ("switch" in row) return patch(row);
  if ("body" in row) return macro(row);
  if ("macro" in row) return macroUse(row);
  return symbol(row);
}

const BATCH_FIELDS: Record<BatchOperation["op"], string[]> = {
  rename: ["address", "name", "kind"],
  "remove-symbol": ["address"],
  classify: ["start", "end", "type", "element"],
  unclassify: ["start", "end"],
  comment: ["address", "placement", "text"],
  uncomment: ["address", "placement"],
  reference: ["from", "to", "kind"],
  unreference: ["from", "to", "kind"],
  module: ["start", "file", "title"],
  unmodule: ["start"],
  operand: ["address", "select", "symbol", "offset", "expression"],
  unoperand: ["address"],
  patch: ["start", "end", "switch", "code", "comment"],
  unpatch: ["start"],
  macro: ["name", "params", "body", "comment"],
  unmacro: ["name"],
  use: ["start", "end", "macro", "args"],
  unuse: ["start"],
};

/** A write of a batch as JSON again: addresses as $ and four hex digits, the C64 space left out. */
function batchJson(write: BatchOperation): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(write)) {
    if (key === "space" && value === DEFAULT_SPACE) continue;
    out[key] = ["address", "start", "end", "from", "to"].includes(key) && typeof value === "number" ? formatC64Address(value) : value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Commands

type WriteOperation = (db: DatabaseSync) => unknown;

/** The address and revision subjects of the commands. */
const ADDRESS: SubjectSpec = { name: "<address>", help: "an address or a name" };
const RANGE: SubjectSpec = { name: "<range>", help: "<start>-<end>, each an address or a name, for example '$1000-$10ff'" };
const START: SubjectSpec = { name: "<start>", help: "the start address of the row" };
const REVISION: SubjectSpec = { name: "<revision>", help: "a revision id, or a start of the id that only one revision has; 0 is the knowledge before every revision" };

const SPACE = { space: OPTIONS.space };
const FILTER = { ...SPACE, range: OPTIONS.range, origin: OPTIONS.origin };
const SYMBOL_KIND: OptionSpec = { kind: "choice", value: "<kind>", choices: SYMBOL_KINDS, help: `one of ${SYMBOL_KINDS.join(", ")}` };
const REFERENCE_KIND: OptionSpec = { kind: "choice", value: "<kind>", choices: REFERENCE_KINDS, help: `one of ${REFERENCE_KINDS.join(", ")}` };
const WRITE: Record<string, OptionSpec> = {
  ...SPACE,
  by: { kind: "choice", value: "<user|llm>", choices: SEMANTIC_ORIGINS, default: "llm", help: "who decided: user, or llm (the default)" },
  reason: OPTIONS.reason,
  evidence: OPTIONS.evidence,
  "expect-revision": OPTIONS["expect-revision"],
};

/** The rows from --range, or every address. */
const rangeOf = (call: Call) => call.range("range") ?? { start: 0x0000, end: 0xffff };
const originsOf = (call: Call) => {
  const value = call.string("origin");
  return value === undefined ? undefined : originFilter(value);
};

/** A read command: it opens the knowledge for reading, and its answer shows the conflicts that a git merge left. */
function readCommand(spec: Omit<CommandSpec, "run">, answer: (db: DatabaseSync | undefined, call: Call) => Record<string, unknown>): CommandSpec {
  return {
    ...spec,
    options: { ...SPACE, ...spec.options },
    run: (call) => {
      const db = openForRead();
      try {
        const result = answer(db, call);
        const found = conflicts(db);
        return found.length === 0 ? result : { ...result, conflicts: found.map(showConflict) };
      } finally {
        db?.close();
      }
    },
  };
}

/** A write command: every value is checked before the knowledge opens, so a refused write makes no knowledge folder. */
function writeCommand(spec: Omit<CommandSpec, "run">, prepare: (call: Call) => WriteOperation): CommandSpec {
  return {
    ...spec,
    notes: [spec.notes, "A write is one revision. It makes .c64-re-tools/knowledge/ when it is not there."].filter((note) => note !== undefined).join("\n"),
    options: { ...spec.options, ...WRITE },
    run: (call) => withWrite(prepare(call)),
  };
}

/** The write context of --by, --reason, --expect-revision and --evidence. */
function contextOf(call: Call): WriteContext {
  const context: WriteContext = { origin: call.string("by") as WriteContext["origin"] };
  const reason = call.string("reason");
  if (reason !== undefined) context.description = reason;
  const expected = call.string("expect-revision");
  if (expected !== undefined) context.expectedRevision = expected;
  const evidence = call.strings("evidence");
  if (evidence.length > 0) context.evidence = evidence.map((value) => evidenceOf(value, call.space));
  return context;
}

/** A write that reports the revision and the row it wrote, and the row it replaced. */
function shown<T, U>(result: { revision: string | null; current: T; previous?: T | undefined }, name: string, show: (row: T) => U) {
  return { revision: result.revision, [name]: show(result.current), ...(result.previous === undefined ? {} : { previous: show(result.previous) }) };
}

/** The text of an option, or of the project file that a --*-file option names; exactly one of them. */
function textOrFile(call: Call, option: string): string | undefined {
  const inline = call.string(option);
  const file = call.string(`${option}-file`);
  if (inline !== undefined && file !== undefined) throw new UsageError(`give --${option} or --${option}-file, not both`);
  if (file !== undefined) return readProjectFile(file).bytes.toString("utf8");
  return inline;
}

/** A comma list of params or args; an empty text is an empty list. */
const commaList = (value: string) => (value.trim() === "" ? [] : value.split(",").map((item) => item.trim()));

const READ_COMMANDS: CommandSpec[] = [
  readCommand({ name: "at", summary: "Everything known at one address.", subjects: [ADDRESS] }, (db, call) => {
    const known = at(db, call.parseAddress(call.subject(0), "<address>"), call.space);
    return {
      ...(call.space === DEFAULT_SPACE ? {} : { space: call.space }),
      address: formatC64Address(known.address),
      ...(known.symbol === undefined ? {} : { symbol: symbol(known.symbol) }),
      ...(known.analyzerNames.length === 0 ? {} : { analyzerNames: known.analyzerNames.map(symbol) }),
      ...(known.region === undefined ? {} : { region: region(known.region) }),
      comments: known.comments.map(comment),
      referencesFrom: known.referencesFrom.map(reference),
      referencesTo: known.referencesTo.map(reference),
      ...(known.operand === undefined ? {} : { operand: operand(known.operand) }),
      ...(known.patch === undefined ? {} : { patch: patch(known.patch) }),
      ...(known.macroUse === undefined ? {} : { macroUse: macroUse(known.macroUse) }),
      ...(known.suppressions.length === 0 ? {} : { suppressions: known.suppressions.map(suppression) }),
      revision: known.revision,
    };
  }),
  readCommand(
    {
      name: "search",
      summary: "Symbol names, analyzer names and comment texts that hold the text.",
      subjects: [{ name: "<text>", help: "the text to find" }],
      options: { origin: OPTIONS.origin, limit: { kind: "count", value: "<n>", min: 1, max: 10_000, default: 50, help: "at most n rows of each kind (default 50)" } },
    },
    (db, call) => {
      const found = search(db, call.subject(0), call.count("limit")!, originsOf(call), call.space);
      return { symbols: found.symbols.map(symbol), analyzerNames: found.analyzerNames.map(symbol), comments: found.comments.map(comment) };
    },
  ),
  readCommand(
    { name: "symbols", summary: "The symbols, or with --analyzer the second names that DXA, Ghidra and the idioms gave.", options: { ...FILTER, kind: SYMBOL_KIND, analyzer: { kind: "flag", help: "the analyzer names in place of the symbols" } } },
    (db, call) => {
      const kind = call.string("kind") as (typeof SYMBOL_KINDS)[number] | undefined;
      if (call.flag("analyzer")) return { analyzerNames: listAnalyzerNames(db, rangeOf(call), kind, originsOf(call), call.space).map(symbol) };
      return { symbols: listSymbols(db, rangeOf(call), kind, originsOf(call), call.space).map(symbol) };
    },
  ),
  readCommand({ name: "regions", summary: "The regions: code, data, tables and the other types.", options: { ...FILTER, type: { kind: "choice", value: "<type>", choices: REGION_TYPES, help: `one of ${REGION_TYPES.join(", ")}` } } }, (db, call) => ({
    regions: listRegions(db, rangeOf(call), call.string("type") as (typeof REGION_TYPES)[number] | undefined, originsOf(call), call.space).map(region),
  })),
  readCommand({ name: "comments", summary: "The comments.", options: FILTER }, (db, call) => ({ comments: listComments(db, rangeOf(call), originsOf(call), call.space).map(comment) })),
  readCommand({ name: "references", summary: "The references: calls, jumps, reads, writes and pointers.", options: { ...FILTER, kind: REFERENCE_KIND } }, (db, call) => ({
    references: listReferences(db, rangeOf(call), call.string("kind") as (typeof REFERENCE_KINDS)[number] | undefined, originsOf(call), call.space).map(reference),
  })),
  readCommand({ name: "suppressions", summary: "The places that removals keep free of analyzer facts, with the reason of each.", options: { range: OPTIONS.range } }, (db, call) => {
    const rows = listSuppressions(db, rangeOf(call), call.space);
    const reasons = reasonsOf(db, rows);
    return { suppressions: rows.map((row) => ({ ...suppression(row), ...(reasons.has(row.revision) ? { reason: reasons.get(row.revision) } : {}) })) };
  }),
  readCommand({ name: "modules", summary: "Where the files of the generated source start.", options: FILTER }, (db, call) => ({ modules: listModules(db, rangeOf(call), originsOf(call), call.space).map(module) })),
  readCommand({ name: "operands", summary: "The operand expressions of instructions.", options: FILTER }, (db, call) => ({ operands: listOperands(db, rangeOf(call), originsOf(call), call.space).map(operand) })),
  readCommand({ name: "patches", summary: "The code that a switch puts in.", options: { ...FILTER, switch: { kind: "text", value: "<switch>", help: "only the patches of this switch" } } }, (db, call) => ({
    patches: listPatches(db, rangeOf(call), call.string("switch"), originsOf(call), call.space).map(patch),
  })),
  readCommand({ name: "switches", summary: "Each switch with the ranges of its patches." }, (db, call) => {
    const switches = new Map<string, PatchRow[]>();
    for (const row of listPatches(db, undefined, undefined, undefined, call.space)) switches.set(row.switch, [...(switches.get(row.switch) ?? []), row]);
    return {
      switches: [...switches].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, rows]) => ({ name, define: `--define ${name}=1`, patches: rows.map((row) => ({ start: formatC64Address(row.start), end: formatC64Address(row.end) })) })),
    };
  }),
  readCommand({ name: "macros", summary: "The macros of the generated source.", options: { origin: OPTIONS.origin } }, (db, call) => ({ macros: listMacros(db, originsOf(call), call.space).map(macro) })),
  readCommand({ name: "uses", summary: "The instructions written as a macro.", options: { ...FILTER, macro: { kind: "text", value: "<name>", help: "only the uses of this macro" } } }, (db, call) => ({
    uses: listMacroUses(db, rangeOf(call), call.string("macro"), originsOf(call), call.space).map(macroUse),
  })),
  readCommand({ name: "spaces", summary: "The address spaces that hold knowledge." }, (db) => ({ spaces: listSpaces(db) })),
  readCommand({ name: "program", summary: "The program in the knowledge: its segments and entry, and the coverage maps that coverage imported, with the ranges." }, (db, call) => {
    const image = programImage(db, call.space);
    const ranges = db === undefined ? [] : (db.prepare("SELECT kind, count(*) AS count FROM current_coverage WHERE space = ? GROUP BY kind ORDER BY kind").all(call.space) as Array<{ kind: string; count: number }>);
    return {
      ...(call.space === DEFAULT_SPACE ? {} : { space: call.space }),
      image:
        image === undefined
          ? null
          : {
              segments: image.segments.map((segment) => ({ start: formatC64Address(segment.start), end: formatC64Address(segment.end) })),
              bytes: image.segments.reduce((sum, segment) => sum + segment.end - segment.start + 1, 0),
              ...(image.entry === undefined ? {} : { entry: formatC64Address(image.entry) }),
              state: image.state !== undefined,
              stages: image.stages?.length ?? 0,
            },
      coverage: { maps: [...new Set(coverageRuns(db).filter((run) => run.space === call.space).map((run) => run.name))], ranges: Object.fromEntries(ranges.map((row) => [row.kind, row.count])) },
    };
  }),
  readCommand(
    {
      name: "history",
      summary: "The rows at an address, of a name or of a macro, through all revisions, each with the reason and the evidence of its revision.",
      subjects: [{ ...ADDRESS, optional: true }],
      options: { name: { kind: "text", value: "<name>", help: "the history of a name in place of an address" }, macro: { kind: "text", value: "<name>", help: "the history of a macro in place of an address" } },
      notes: "Give exactly one of <address>, --name and --macro.",
    },
    (db, call) => {
      const name = call.string("name");
      const macroName = call.string("macro");
      if ([call.subjects.length > 0, name !== undefined, macroName !== undefined].filter(Boolean).length !== 1) throw new UsageError("history needs exactly one of <address>, --name and --macro");
      const entries = macroName !== undefined ? historyOfMacro(db, macroName, call.space) : name !== undefined ? historyNamed(db, name, call.space) : historyAt(db, call.parseAddress(call.subject(0), "<address>"), call.space);
      return { history: entries.map((entry) => ({ ...historyEntry(entry), ...revisionNote(db, entry.from) })) };
    },
  ),
  readCommand(
    { name: "revisions", summary: "The revisions, newest first.", options: { limit: { kind: "count", value: "<n>", min: 1, max: 100_000, help: "at most n revisions" }, before: { kind: "text", value: "<revision>", help: "only the revisions before this one" } } },
    (db, call) => {
      const options: { limit?: number; before?: string } = {};
      const limit = call.count("limit");
      if (limit !== undefined) options.limit = limit;
      const before = call.string("before");
      if (before !== undefined) options.before = before;
      return { revisions: revisions(db, options) };
    },
  ),
  readCommand({ name: "revision", summary: "The rows that one revision added and closed.", subjects: [REVISION] }, (db, call) => {
    const changes = revision(db, call.subject(0));
    return { revision: changes.revision, added: changes.added.map(historyEntry), closed: changes.closed.map(historyEntry) };
  }),
  readCommand({ name: "export", summary: "All current knowledge to a project file as JSON.", options: { ...FILTER, out: { ...OPTIONS.out, value: "<file>", help: "the JSON file, relative to the project folder", required: true } } }, (db, call) => {
    const range = rangeOf(call);
    const origins = originsOf(call);
    const space = call.space;
    const exported = {
      revision: currentRevision(db),
      ...(space === DEFAULT_SPACE ? {} : { space }),
      symbols: listSymbols(db, range, undefined, origins, space).map(symbol),
      analyzerNames: listAnalyzerNames(db, range, undefined, origins, space).map(symbol),
      regions: listRegions(db, range, undefined, origins, space).map(region),
      comments: listComments(db, range, origins, space).map(comment),
      references: listReferences(db, range, undefined, origins, space).map(reference),
      suppressions: listSuppressions(db, range, space).map(suppression),
      modules: listModules(db, range, origins, space).map(module),
      operands: listOperands(db, range, origins, space).map(operand),
      patches: listPatches(db, range, undefined, origins, space).map(patch),
      macros: listMacros(db, origins, space).map(macro),
      macroUses: listMacroUses(db, range, undefined, origins, space).map(macroUse),
    };
    const counts = Object.fromEntries(Object.entries(exported).flatMap(([key, value]) => (Array.isArray(value) ? [[key, value.length]] : [])));
    return { counts, revision: exported.revision, ...writeReported(call.string("out")!, `${JSON.stringify(exported, null, 2)}\n`, { what: "--out" }) };
  }),
  readCommand(
    {
      name: "listing",
      summary: "The program as ACME lines with names, operand expressions, comments, the access of each line in the coverage (x executed, r read, w written) and the references in and out.",
      subjects: [RANGE],
      options: { out: { ...OPTIONS.out, value: "<file>", help: "write the listing as text to this file in place of the lines in the result" } },
    },
    (db, call) => {
      const { start, end } = call.parseRange(call.subject(0), "<range>");
      const lines = listing(listingSource(db, call.space), start, end);
      const out = call.string("out");
      if (out !== undefined) return { lines: lines.length, ...writeReported(out, listingText(lines), { what: "--out" }) };
      return { lines: lines.map((row) => ({ ...row, address: formatC64Address(row.address) })) };
    },
  ),
];

const WRITE_COMMANDS: CommandSpec[] = [
  writeCommand({ name: "rename", summary: "Gives an address a name.", subjects: [ADDRESS, { name: "<name>", help: "the new name: assembler label syntax" }], options: { kind: SYMBOL_KIND } }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, address: call.parseAddress(call.subject(0), "<address>"), name: call.subject(1), ...(call.string("kind") === undefined ? {} : { kind: call.string("kind") as (typeof SYMBOL_KINDS)[number] }) };
    return (db) => shown(renameSymbol(db, context, request), "symbol", symbol);
  }),
  writeCommand({ name: "remove-symbol", summary: "Removes the name at an address.", subjects: [ADDRESS] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, address: call.parseAddress(call.subject(0), "<address>") };
    return (db) => ({ revision: removeSymbol(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "classify",
      summary: "Gives a range a region type.",
      subjects: [RANGE, { name: "<type>", help: `one of ${REGION_TYPES.join(", ")}` }],
      options: { element: { kind: "count", value: "<n>", min: 1, max: 0x10000, help: "the bytes of one element of a table: the length of the range is a multiple of it" } },
    },
    (call) => {
      const context = contextOf(call);
      const element = call.count("element");
      const request = { space: call.space, ...call.parseRange(call.subject(0), "<range>"), type: oneOf(REGION_TYPES, call.subject(1), "<type>"), ...(element === undefined ? {} : { element }) };
      return (db) => {
        const result = classifyRegion(db, context, request);
        return { revision: result.revision, regions: result.current.map(region), ...(result.previous === undefined ? {} : { previous: result.previous.map(region) }) };
      };
    },
  ),
  writeCommand({ name: "unclassify", summary: "Removes the region types of a range.", subjects: [RANGE] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, ...call.parseRange(call.subject(0), "<range>") };
    return (db) => ({ revision: unclassifyRegion(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "comment",
      summary: "Writes a comment at an address: a line of its own above it, or at the end of its line.",
      subjects: [ADDRESS, { name: "<placement>", help: `one of ${COMMENT_PLACEMENTS.join(", ")}` }, { name: "<text>", help: "the comment", list: true }],
    },
    (call) => {
      const context = contextOf(call);
      const request = { space: call.space, address: call.parseAddress(call.subject(0), "<address>"), placement: oneOf(COMMENT_PLACEMENTS, call.subject(1), "<placement>"), text: call.rest(2).join(" ") };
      return (db) => {
        const result = setComment(db, context, request);
        return { revision: result.revision, comment: comment(result.current) };
      };
    },
  ),
  writeCommand({ name: "uncomment", summary: "Removes a comment.", subjects: [ADDRESS, { name: "<placement>", help: `one of ${COMMENT_PLACEMENTS.join(", ")}` }] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, address: call.parseAddress(call.subject(0), "<address>"), placement: oneOf(COMMENT_PLACEMENTS, call.subject(1), "<placement>") };
    return (db) => ({ revision: removeComment(db, context, request).revision });
  }),
  ...(["reference", "unreference"] as const).map((name) =>
    writeCommand(
      {
        name,
        summary: name === "reference" ? "Records that code at one address refers to another." : "Removes a reference.",
        subjects: [{ name: "<from>", help: "the address of the instruction" }, { name: "<to>", help: "the address it refers to" }, { name: "<kind>", help: `one of ${REFERENCE_KINDS.join(", ")}` }],
      },
      (call) => {
        const context = contextOf(call);
        const request = { space: call.space, from: call.parseAddress(call.subject(0), "<from>"), to: call.parseAddress(call.subject(1), "<to>"), kind: oneOf(REFERENCE_KINDS, call.subject(2), "<kind>") };
        return name === "reference"
          ? (db) => {
              const result = addReference(db, context, request);
              return { revision: result.revision, reference: reference(result.current) };
            }
          : (db) => ({ revision: removeReference(db, context, request).revision });
      },
    ),
  ),
  writeCommand(
    { name: "module", summary: "Records that a file of the generated source starts at an address.", subjects: [START, { name: "<file.asm>", help: "the source file" }], options: { title: { kind: "text", value: "<text>", help: "the title of the file" } } },
    (call) => {
      const context = contextOf(call);
      const title = call.string("title");
      const request = { space: call.space, start: call.parseAddress(call.subject(0), "<start>"), file: call.subject(1), ...(title === undefined ? {} : { title }) };
      return (db) => {
        const result = setModule(db, context, request);
        return { revision: result.revision, module: module(result.current) };
      };
    },
  ),
  writeCommand({ name: "unmodule", summary: "Removes the module that starts at an address.", subjects: [START] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, start: call.parseAddress(call.subject(0), "<start>") };
    return (db) => ({ revision: removeModule(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "operand",
      summary: "Writes the operand of the instruction at an address as an expression.",
      subjects: [ADDRESS],
      options: {
        lo: { kind: "text", value: "<symbol>", help: "the low byte of symbol + offset" },
        hi: { kind: "text", value: "<symbol>", help: "the high byte of symbol + offset" },
        value: { kind: "text", value: "<symbol>", help: "the value symbol + offset" },
        expr: { kind: "text", value: "<text>", help: "ACME expression text" },
        offset: { kind: "text", value: "<n>", help: "with --lo, --hi or --value: a whole number such as 1, '$1000' or, as --offset=-1, a negative one" },
      },
      notes: "Give exactly one of --lo, --hi, --value and --expr. The write is refused when the expression does not give the operand in the program of the knowledge.",
    },
    (call) => {
      const context = contextOf(call);
      const given = (["lo", "hi", "value", "expr"] as const).filter((option) => call.string(option) !== undefined);
      if (given.length !== 1) throw new UsageError("operand needs exactly one of --lo, --hi, --value or --expr");
      const select: OperandSelect = given[0]!;
      const offset = call.string("offset");
      const request: { space: string; address: number; select: OperandSelect; symbol?: string; offset?: number; expression?: string } = { space: call.space, address: call.parseAddress(call.subject(0), "<address>"), select };
      if (select === "expr") {
        if (offset !== undefined) throw new UsageError("--offset works with --lo, --hi and --value, not with --expr");
        request.expression = call.string("expr")!;
      } else {
        request.symbol = call.string(select)!;
        if (offset !== undefined) request.offset = offsetOf(offset, "--offset");
      }
      return (db) => shown(setOperand(db, { ...context, image: operandImage(db, call.space) }, request), "operand", operand);
    },
  ),
  writeCommand({ name: "unoperand", summary: "Removes the operand expression at an address.", subjects: [ADDRESS] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, address: call.parseAddress(call.subject(0), "<address>") };
    return (db) => ({ revision: removeOperand(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "patch",
      summary: "ACME code that replaces a range when the build defines the switch as 1 (c64-assembler --define SWITCH=1). NOP fills the rest of the range.",
      subjects: [RANGE, { name: "<switch>", help: "the switch name" }],
      options: {
        code: { kind: "text", value: "<text>", help: "the ACME code" },
        "code-file": { kind: "path", value: "<file>", help: "a project file with the ACME code" },
        nop: { kind: "flag", help: "put only NOP" },
        comment: { kind: "text", value: "<text>", help: "a comment for the patch" },
      },
      notes: "Give exactly one of --code, --code-file and --nop.",
    },
    (call) => {
      const context = contextOf(call);
      const code = textOrFile(call, "code");
      if ((code === undefined) === !call.flag("nop")) throw new UsageError("patch needs exactly one of --code, --code-file or --nop");
      const commentText = call.string("comment");
      const request = { space: call.space, ...call.parseRange(call.subject(0), "<range>"), switch: call.subject(1), code: code ?? "", ...(commentText === undefined ? {} : { comment: commentText }) };
      return (db) => shown(setPatch(db, { ...context, image: operandImage(db, call.space) }, request), "patch", patch);
    },
  ),
  writeCommand({ name: "unpatch", summary: "Removes the patch that starts at an address.", subjects: [START] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, start: call.parseAddress(call.subject(0), "<start>") };
    return (db) => ({ revision: removePatch(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "macro",
      summary: "Writes an ACME macro. The body names a param with a dot: .a",
      subjects: [{ name: "<name>", help: "the macro name" }],
      options: {
        params: { kind: "text", value: "<a,b>", help: "the params, a comma list" },
        body: { kind: "text", value: "<text>", help: "the body" },
        "body-file": { kind: "path", value: "<file>", help: "a project file with the body" },
        comment: { kind: "text", value: "<text>", help: "a comment for the macro" },
      },
      notes: "Give --body or --body-file.",
    },
    (call) => {
      const context = contextOf(call);
      const body = textOrFile(call, "body");
      if (body === undefined || body === "") throw new UsageError("macro needs --body or --body-file with text");
      const commentText = call.string("comment");
      const request = { space: call.space, name: call.subject(0), params: commaList(call.string("params") ?? ""), body, ...(commentText === undefined ? {} : { comment: commentText }) };
      return (db) => shown(setMacro(db, context, request), "macro", macro);
    },
  ),
  writeCommand({ name: "unmacro", summary: "Removes a macro that no use has.", subjects: [{ name: "<name>", help: "the macro name" }] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, name: call.subject(0) };
    return (db) => ({ revision: removeMacro(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "use",
      summary: "Writes the instructions of a range as one use of a macro.",
      subjects: [RANGE, { name: "<macro>", help: "the macro name" }],
      options: { args: { kind: "text", value: "<x, y>", help: "one expression for each param, a comma list" } },
    },
    (call) => {
      const context = contextOf(call);
      const request = { space: call.space, ...call.parseRange(call.subject(0), "<range>"), macro: call.subject(1), args: commaList(call.string("args") ?? "") };
      return (db) => {
        const result = setMacroUse(db, { ...context, image: operandImage(db, call.space) }, request);
        return { revision: result.revision, use: macroUse(result.current), ...(result.previous === undefined ? {} : { previous: macroUse(result.previous) }) };
      };
    },
  ),
  writeCommand({ name: "unuse", summary: "Removes the macro use that starts at an address.", subjects: [START] }, (call) => {
    const context = contextOf(call);
    const request = { space: call.space, start: call.parseAddress(call.subject(0), "<start>") };
    return (db) => ({ revision: removeMacroUse(db, context, request).revision });
  }),
  writeCommand(
    {
      name: "image",
      summary: "Puts the program into the knowledge: its bytes, and for an image.json of a c64-unpacker capture also the entry, the entry state and the stages. Only changed bytes write.",
      subjects: [{ name: "<file>", help: "an image.json of c64-unpacker capture or loads, or a PRG" }],
    },
    (call) => {
      const context = contextOf(call);
      const request = imageRequest(call.subject(0), call.space);
      return (db) => {
        const { revision, current } = setImage(db, context, request);
        return { revision, ...spaceOf(current), bytes: current.bytes, rowsAdded: current.rowsAdded, rowsClosed: current.rowsClosed, entryChanged: current.entry };
      };
    },
  ),
  writeCommand(
    {
      name: "coverage",
      summary: "Joins coverage maps of c64_memmap or of a run into the coverage of the knowledge. Each map is named by its path: --evidence coverage:<path> cites it.",
      subjects: [{ name: "<map>", help: "a 64 KiB coverage map", list: true }],
    },
    (call) => {
      const context = contextOf(call);
      const maps = call.subjects.map((path) => ({ bytes: readProjectFile(path).bytes, name: knowledgePath(path, "<map>") }));
      return (db) => {
        const { revision, current } = addCoverage(db, context, { space: call.space, maps });
        return { revision, ...spaceOf(current), imported: current.imported, known: current.known, ranges: current.ranges };
      };
    },
  ),
  writeCommand({ name: "revert", summary: "Undoes one revision with a new revision.", subjects: [REVISION] }, (call) => {
    const context = contextOf(call);
    const request = { revision: call.subject(0) };
    return (db) => ({ revision: revert(db, context, request).revision });
  }),
  writeCommand({ name: "merge", summary: "Decides the conflicts that a git merge of two computers' work left: of the rows of one conflict, the newest stays. One revision for all." }, (call) => {
    const context = contextOf(call);
    const platform = new Map(platformNames().map((entry) => [entry.name, entry.address]));
    return (db) => {
      const merged = mergeConflicts(db, context, platform);
      return { revision: merged.revision, choices: merged.current.map(showChoice) };
    };
  }),
  writeCommand(
    {
      name: "apply",
      summary: "Many writes from a JSON file, all as one revision, or none when one is refused.",
      subjects: [{ name: "<file>", help: "the batch: a JSON list of writes, or - for standard input" }],
      notes: 'A write is {"op": "<command>", ...}, for example {"op": "rename", "address": "$2100", "name": "update_player"}. A range is "start" and "end". A write can name its own "space". operand, patch and use writes are checked against the program of their space.',
    },
    (call) => {
      const context = contextOf(call);
      const path = call.subject(0);
      const text = path === "-" ? readFileSync(0, "utf8") : readProjectFile(path).bytes.toString("utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new Refusal("invalid-input", `the batch ${path} is not JSON: ${(error as Error).message}`);
      }
      if (!Array.isArray(parsed)) throw new Refusal("invalid-input", `the batch ${path} is a JSON list of writes, for example [{"op": "rename", "address": "$2100", "name": "update_player"}]`);
      const operations = parsed.map((item, index) => batchOperation(call, item, `write ${index + 1}`));
      const checked = operations.some((operation) => operation.op === "operand" || operation.op === "patch" || operation.op === "use");
      return (db) => {
        const applied = applyBatch(db, checked ? { ...context, image: operandImage(db, call.space) } : context, operations);
        // replaced: each write that replaced a row of another origin, with that row as previous gives it for one write.
        const replaced = applied.steps.flatMap((step, index) => (step.previous === undefined ? [] : [{ write: index + 1, op: operations[index]!.op, previous: shownPrevious(step.previous) }]));
        return { revision: applied.revision, writes: applied.steps.length, replaced };
      };
    },
  ),
];

/** join: the batches of agents that worked in parallel, as one batch for apply. It writes no knowledge. */
const JOIN: CommandSpec = {
  name: "join",
  summary: "Joins the batches of agents that worked in parallel into one batch for apply. It writes no knowledge.",
  subjects: [{ name: "<batch>", help: 'a batch: a list of writes, or {"owner": {"start": "$1000", "end": "$1fff"}, "ops": [...]}', list: true }],
  options: { ...SPACE, out: { ...OPTIONS.out, value: "<file>", help: "the joined batch, relative to the project folder", required: true } },
  notes: "At an address in the owner range of a batch, its name, comment, operand and module win, and its regions come last. One name or one module file at two addresses writes nothing.",
  run: (call) => {
    if (call.subjects.length < 2) throw new UsageError("join needs two or more batch files");
    const batches: Batch[] = call.subjects.map((file) => {
      let value: unknown;
      try {
        value = JSON.parse(readProjectFile(file).bytes.toString("utf8"));
      } catch (error) {
        if (error instanceof SyntaxError) throw new Refusal("invalid-input", `${file} is not JSON: ${error.message}`);
        throw error;
      }
      const shaped = Array.isArray(value) ? { ops: value } : (value as { owner?: unknown; ops?: unknown });
      if (typeof shaped !== "object" || shaped === null || !Array.isArray(shaped.ops)) throw new Refusal("invalid-input", `${file}: a batch is a list of writes, or {"owner": {"start": "$1000", "end": "$1fff"}, "ops": [...]}`);
      let owner: Batch["owner"];
      if (shaped.owner !== undefined) {
        const given = shaped.owner as { start?: unknown; end?: unknown };
        if (typeof given !== "object" || given === null || typeof given.start !== "string" || typeof given.end !== "string" || Object.keys(given).length !== 2) {
          throw new Refusal("invalid-input", `${file}: owner must be {"start": "<address>", "end": "<address>"}, for example {"start": "$1000", "end": "$1fff"}`);
        }
        owner = { start: call.parseAddress(given.start, `${file}: owner.start`), end: call.parseAddress(given.end, `${file}: owner.end`) };
        if (owner.end < owner.start) throw new Refusal("invalid-input", `${file}: the owner range ends before it starts`);
      }
      const ops = (shaped.ops as unknown[]).map((item, index) => batchOperation(call, item, `${file}: write ${index + 1}`));
      return { file, ...(owner === undefined ? {} : { owner }), ops };
    });
    const owned = batches.filter((batch) => batch.owner !== undefined);
    for (const [index, batch] of owned.entries()) {
      const other = owned.slice(index + 1).find((next) => next.owner!.start <= batch.owner!.end && batch.owner!.start <= next.owner!.end);
      if (other !== undefined) throw new Refusal("invalid-input", `The owner ranges of ${batch.file} and ${other.file} overlap. Give each address one owner.`);
    }
    const joined = joinBatches(batches);
    const choice = (item: JoinChoice) => ({ ...item, at: typeof item.at === "number" ? formatC64Address(item.at) : item.at, ...(item.space === DEFAULT_SPACE ? { space: undefined } : {}) });
    if (joined.clashes.length > 0) {
      const clash = (item: JoinClash) => `${item.what} ${item.value} at ${item.places.map((place) => `${formatC64Address(place.address)} (${place.file})`).join(" and ")}${item.space === DEFAULT_SPACE ? "" : ` in ${item.space}`}`;
      throw new Refusal("conflict", `The batches give one ${joined.clashes.map(clash).join(", one ")}. Nothing was written. Give each name and each module file one address in the batches, then join again.`);
    }
    const out = call.string("out")!;
    return { writes: joined.ops.length, repeated: joined.repeated, choices: joined.choices.map(choice), apply: `knowledge.ts apply ${out}`, ...writeReported(out, `${JSON.stringify(joined.ops.map(batchJson), null, 1)}\n`, { what: "--out" }) };
  },
};

/** One write of a batch. A write names its own space, or takes the one of --space. */
function batchOperation(call: Call, item: unknown, at: string): BatchOperation {
  if (typeof item !== "object" || item === null || Array.isArray(item)) throw new Refusal("invalid-input", `${at}: a write is an object with op`);
  const own = (item as Record<string, unknown>).space;
  if (own !== undefined && typeof own !== "string") throw new Refusal("invalid-input", `${at}: space must be a string`);
  const space = (own as string | undefined) ?? call.space;
  return { ...batchFields(item as Record<string, unknown>, at, (text, what) => call.parseAddress(text, what, space)), space };
}

/** The fields of one write of a batch, with its addresses parsed. */
function batchFields(fields: Record<string, unknown>, at: string, address: (text: string, what: string) => number): BatchOperation {
  const op = oneOf(Object.keys(BATCH_FIELDS) as Array<BatchOperation["op"]>, String(fields.op), `${at}: op`);
  const unknown = Object.keys(fields).filter((key) => key !== "op" && key !== "space" && !BATCH_FIELDS[op].includes(key));
  if (unknown.length > 0) throw new Refusal("invalid-input", `${at}: ${op} takes ${BATCH_FIELDS[op].join(", ")}, not ${unknown.join(", ")}`);
  const text = (key: string) => {
    if (typeof fields[key] !== "string") throw new Refusal("invalid-input", `${at}: ${key} must be a string`);
    return fields[key] as string;
  };
  const place = (key: string) => address(text(key), `${at}: ${key}`);
  // A list is a JSON list of strings or a comma list.
  const list = (key: string) => {
    const value = fields[key];
    if (value === undefined) return [];
    if (typeof value === "string") return commaList(value);
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Refusal("invalid-input", `${at}: ${key} must be a list of strings or a comma list`);
    return (value as string[]).map((item) => item.trim());
  };
  const optional = (key: string) => (fields[key] === undefined ? {} : { [key]: text(key) });
  switch (op) {
    case "rename":
      return { op, address: place("address"), name: text("name"), ...(fields.kind === undefined ? {} : { kind: oneOf(SYMBOL_KINDS, text("kind"), `${at}: kind`) }) };
    case "remove-symbol":
      return { op, address: place("address") };
    case "classify": {
      if (fields.element !== undefined && typeof fields.element !== "number") throw new Refusal("invalid-input", `${at}: element must be a number`);
      return { op, start: place("start"), end: place("end"), type: oneOf(REGION_TYPES, text("type"), `${at}: type`), ...(fields.element === undefined ? {} : { element: fields.element as number }) };
    }
    case "unclassify":
      return { op, start: place("start"), end: place("end") };
    case "comment":
      return { op, address: place("address"), placement: oneOf(COMMENT_PLACEMENTS, text("placement"), `${at}: placement`), text: text("text") };
    case "uncomment":
      return { op, address: place("address"), placement: oneOf(COMMENT_PLACEMENTS, text("placement"), `${at}: placement`) };
    case "module":
      return { op, start: place("start"), file: text("file"), ...(fields.title === undefined ? {} : { title: text("title") }) };
    case "unmodule":
      return { op, start: place("start") };
    case "operand": {
      const select = oneOf(OPERAND_SELECTS, text("select"), `${at}: select`);
      return {
        op,
        address: place("address"),
        select,
        ...(fields.symbol === undefined ? {} : { symbol: text("symbol") }),
        ...(fields.offset === undefined ? {} : { offset: offsetOf(fields.offset, `${at}: offset`) }),
        ...(fields.expression === undefined ? {} : { expression: text("expression") }),
      };
    }
    case "unoperand":
      return { op, address: place("address") };
    case "patch":
      return { op, start: place("start"), end: place("end"), switch: text("switch"), code: fields.code === undefined ? "" : text("code"), ...optional("comment") };
    case "macro":
      return { op, name: text("name"), params: list("params"), body: text("body"), ...optional("comment") };
    case "unmacro":
      return { op, name: text("name") };
    case "use":
      return { op, start: place("start"), end: place("end"), macro: text("macro"), args: list("args") };
    case "unpatch":
    case "unuse":
      return { op, start: place("start") };
    case "reference":
    case "unreference":
      return { op, from: place("from"), to: place("to"), kind: oneOf(REFERENCE_KINDS, text("kind"), `${at}: kind`) };
  }
}

await runScript({
  name: "knowledge",
  summary: "Reads and writes the knowledge of the project: names, regions, comments, references, the program and its coverage, and the source knowledge. A read needs no knowledge folder. Every command takes --space: c64 (the default), drive8 for 1541 drive code, or bank0 to bank255 for cartridge banks.",
  names: knowledgeNames,
  commands: [...READ_COMMANDS, ...WRITE_COMMANDS, JOIN],
});
