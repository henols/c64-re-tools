// The c64-knowledge script: reads and writes .c64-re-tools/knowledge/ in the
// project folder (--project, or the one found from the working directory) and
// prints one compact JSON result.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address, SYMBOL_NAME } from "#src/c64.ts";
import { ImageError, readImage } from "#src/host-client/image.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { CONFLICT_RULES, conflicts, type Conflict } from "#src/knowledge/conflicts.ts";
import { KnowledgeError, openForRead, withWrite } from "#src/knowledge/database.ts";
import { operandText } from "#src/knowledge/expression.ts";
import { historyAt, historyNamed, historyOfMacro, revision, revisionNote, revisions, type HistoryEntry } from "#src/knowledge/history.ts";
import {
  at,
  analyzerNamed,
  currentRevision,
  listAnalyzerNames,
  listComments,
  listMacros,
  listMacroUses,
  listModules,
  listOperands,
  listPatches,
  listSpaces,
  listReferences,
  listRegions,
  listSuppressions,
  listSymbols,
  search,
  symbolNamed,
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
import {
  COMMENT_PLACEMENTS,
  DEFAULT_SPACE,
  EVIDENCE_KINDS,
  OPERAND_SELECTS,
  ORIGINS,
  REFERENCE_KINDS,
  REGION_TYPES,
  SPACE,
  SYMBOL_KINDS,
  type CommentPlacement,
  type OperandSelect,
  type Origin,
  type ReferenceKind,
  type RegionType,
  type SymbolKind,
} from "#src/knowledge/schema.ts";
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
import { runScript, UsageError } from "#src/script.ts";

const USAGE = `knowledge.ts <command> [arguments] [options]

Read (no database needed):
  at <address>                        everything known at one address
  search <text>                       symbol names, analyzer names and comment texts
  symbols [--start A --end A --kind K --origin O] [--analyzer]
                                      --analyzer: the second names that DXA, Ghidra
                                      and the idioms gave (D74)
  regions [--start A --end A --type T --origin O]
  comments [--start A --end A --origin O]
  references [--start A --end A --kind K --origin O]
  suppressions [--start A --end A]   places that removals keep free of analyzer facts
  modules [--start A --end A --origin O]   where the files of generated source start
  operands [--start A --end A --origin O]  operand expressions of instructions
  patches [--start A --end A --switch S --origin O]   code that a switch puts in
  switches                            each switch with the ranges of its patches
  macros [--origin O]                 the macros of the generated source
  uses [--start A --end A --macro M --origin O]   instructions written as a macro
  spaces                              the address spaces that hold knowledge
  history <address> | history --name <name> | history --macro <name>
  revisions [--limit N --before R]
  revision <revision>
  export --out <file> [--start A --end A --origin O]   all current knowledge to a project file

Every command takes --space S: c64 (the default), drive8 for code in the 1541
drive, or bank0 to bank255 for cartridge banks. A write in a batch can name its
own space.

Read option --origin O: user, llm, dxa, ghidra, heuristic, semantic (user and
llm) or analyzer (dxa, ghidra and heuristic), or a comma list. search takes it too.

Write (one revision each; creates .c64-re-tools/knowledge/ when needed):
  rename <address> <name> [--kind K]
  remove-symbol <address>
  classify <start> <end> <type> [--element N]
  unclassify <start> <end>
  comment <address> <line|side> <text>
  uncomment <address> <line|side>
  reference <from> <to> <kind>
  unreference <from> <to> <kind>
  module <start> <file.asm> [--title T]   a file of generated source starts here
  unmodule <start>
  operand <address> --lo|--hi|--value <symbol> [--offset N] --image <file>
  operand <address> --expr <text> --image <file>
                           write the operand of the instruction at <address> as
                           an expression: the low or high byte of symbol + N, the
                           value symbol + N, or ACME expression text; refused when
                           it does not give the operand in the image (image.json
                           or PRG); give a negative offset as --offset=-1
  unoperand <address>
  patch <start> <end> <SWITCH> --code <text>|--code-file <file>|--nop [--comment T] --image <file>
                           ACME code that replaces <start>-<end> when the build
                           defines SWITCH as 1 (c64-assembler --define SWITCH=1);
                           NOP fills the rest of the range; --nop puts only NOP
  unpatch <start>
  macro <name> [--params a,b] --body <text>|--body-file <file> [--comment T]
                           an ACME macro; the body names a param with a dot: .a
  unmacro <name>
  use <start> <end> <macro> [--args "x, y"] --image <file>
                           write the instructions <start>-<end> as one use of
                           the macro, with one expression for each param
  unuse <start>
  revert <revision>
  merge                    decide the conflicts that a git merge of two
                           computers' work left: of the rows of one conflict,
                           the newest stays; one revision for all
  apply <file>             many writes from a JSON file ('-' reads standard input),
                           all as one revision, or none when one is refused;
                           operand, patch and use writes need --image <file>

Write options:
  --reason <text>          why, kept with the revision
  --evidence <kind:ref>    what the change rests on: coverage:<file>, test:<file>,
                           file:<file> or note:<text> (repeatable)
  --expect-revision <R>    refuse the write if knowledge changed after revision R
  --origin user|llm        who decided (default llm)

Addresses are $ and four hex digits; quote them in a shell: '$2100'. A name
also gives an address: a symbol name first, then an analyzer name.
A revision is its id, for example 20261015T214501.123-k3f9qz, or a start of
the id that only one revision has; 0 is the knowledge before every revision.`;

/** The space whose names give addresses: the --space of the command. */
let nameSpace = DEFAULT_SPACE;

/** An address as $ and four hex digits, or the address of a symbol name, else of an analyzer name (D74). */
function address(value: string | undefined, what = "address"): number {
  if (value === undefined) throw new UsageError(`${what} is missing`);
  if (SYMBOL_NAME.test(value)) return addressOfName(value, what);
  try {
    return parseC64Address(value);
  } catch {
    throw new UsageError(`${what} must be $ followed by four hex digits, for example '$2100', or a name, not ${value}`);
  }
}

function addressOfName(name: string, what: string): number {
  const db = openForRead();
  try {
    const symbol = symbolNamed(db, name, nameSpace);
    if (symbol !== undefined) return symbol.address;
    const second = analyzerNamed(db, name, nameSpace);
    if (second.length === 1) return second[0]!.address;
    if (second.length > 1) throw new UsageError(`${what}: the analyzers give ${name} to ${second.map((row) => `${formatC64Address(row.address)} (${row.origin})`).join(" and ")}; give the address`);
    throw new UsageError(`${what}: no symbol or analyzer name is ${name}`);
  } finally {
    db?.close();
  }
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined, what: string): T {
  if (value === undefined || !(values as readonly string[]).includes(value)) throw new UsageError(`${what} must be one of: ${values.join(", ")}`);
  return value as T;
}

function integer(value: string | undefined, what: string): number {
  if (value === undefined || !/^\d+$/.test(value)) throw new UsageError(`${what} must be a whole number`);
  return Number(value);
}

// Output shapes: addresses as $xxxx, nothing internal.
/** The space of a row, shown only when it is not the C64 (D53). */
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

/** A conflict of a git merge (D69): what is wrong, and the rows, oldest first. */
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

function run(argv: string[]): unknown {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      start: { type: "string" },
      end: { type: "string" },
      kind: { type: "string" },
      type: { type: "string" },
      name: { type: "string" },
      limit: { type: "string" },
      before: { type: "string" },
      reason: { type: "string" },
      "expect-revision": { type: "string" },
      origin: { type: "string" },
      element: { type: "string" },
      evidence: { type: "string", multiple: true },
      out: { type: "string" },
      title: { type: "string" },
      space: { type: "string" },
      lo: { type: "string" },
      hi: { type: "string" },
      value: { type: "string" },
      expr: { type: "string" },
      offset: { type: "string" },
      image: { type: "string" },
      code: { type: "string" },
      "code-file": { type: "string" },
      nop: { type: "boolean" },
      comment: { type: "string" },
      params: { type: "string" },
      body: { type: "string" },
      "body-file": { type: "string" },
      args: { type: "string" },
      switch: { type: "string" },
      macro: { type: "string" },
      analyzer: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const [command, ...args] = positionals;
  if (values.help || command === undefined) throw new UsageError("");
  if (values.space !== undefined && !SPACE.test(values.space)) throw new UsageError("--space must be c64, drive8, or bank0 to bank255");
  const space = values.space ?? DEFAULT_SPACE;
  nameSpace = space;
  const range = { start: values.start === undefined ? 0x0000 : address(values.start, "--start"), end: values.end === undefined ? 0xffff : address(values.end, "--end") };

  const read = new Set(["at", "search", "symbols", "regions", "comments", "references", "suppressions", "modules", "operands", "patches", "switches", "macros", "uses", "spaces", "history", "revisions", "revision", "export"]);
  const write = new Set(["rename", "remove-symbol", "classify", "unclassify", "comment", "uncomment", "reference", "unreference", "module", "unmodule", "operand", "unoperand", "patch", "unpatch", "macro", "unmacro", "use", "unuse", "revert", "apply", "merge"]);
  // Refuse a mistyped command before anything opens, so no database appears by accident.
  if (!read.has(command) && !write.has(command)) throw new UsageError(`unknown command: ${command}`);
  if (read.has(command)) {
    const origins = values.origin === undefined ? undefined : originFilter(values.origin);
    if (command === "export" && values.out === undefined) throw new UsageError("export needs --out <file>");
    const db = openForRead();
    try {
      const answer = readAnswer(db, command, args, values, range, origins, space);
      const found = conflicts(db);
      // A git merge can leave conflicts: every read shows them until merge decides them (D69).
      return found.length === 0 ? answer : { ...answer, conflicts: found.map(showConflict) };
    } finally {
      db?.close();
    }
  }

  const context: WriteContext = { origin: values.origin === undefined ? "llm" : oneOf(["user", "llm"] as const, values.origin, "--origin") };
  if (values.reason !== undefined) context.description = values.reason;
  if (values["expect-revision"] !== undefined) context.expectedRevision = values["expect-revision"];
  if (values.evidence !== undefined) context.evidence = values.evidence.map(evidenceOf);
  // Every argument is checked before the database opens: a refused write creates no database.
  if (values.title !== undefined && command !== "module") throw new UsageError("--title works only with module");
  for (const option of ["lo", "hi", "value", "expr", "offset"] as const) {
    if (values[option] !== undefined && command !== "operand") throw new UsageError(`--${option} works only with operand`);
  }
  const only: Array<[keyof typeof values, readonly string[]]> = [
    ["image", ["operand", "patch", "use", "apply"]],
    ["code", ["patch"]],
    ["code-file", ["patch"]],
    ["nop", ["patch"]],
    ["comment", ["patch", "macro"]],
    ["params", ["macro"]],
    ["body", ["macro"]],
    ["body-file", ["macro"]],
    ["args", ["use"]],
  ];
  for (const [option, commands] of only) {
    if (values[option] !== undefined && !commands.includes(command)) throw new UsageError(`--${option} works only with ${commands.join(", ")}`);
  }
  const operation =
    command === "apply"
      ? applyOperation(args, context, space, values.image)
      : command === "operand"
        ? operandOperation(args, values, context, space)
        : command === "patch" || command === "macro" || command === "use"
          ? sourceOperation(command, args, values, context, space)
          : writeOperation(command, args, values.kind, values.element, context, values.title, space);
  return withWrite(operation);
}

type ReadValues = {
  analyzer?: boolean | undefined;
  kind?: string | undefined;
  type?: string | undefined;
  name?: string | undefined;
  limit?: string | undefined;
  before?: string | undefined;
  out?: string | undefined;
  switch?: string | undefined;
  macro?: string | undefined;
};

/** The answer of one read command. */
function readAnswer(db: DatabaseSync | undefined, command: string, args: string[], values: ReadValues, range: { start: number; end: number }, origins: Origin[] | undefined, space: string): Record<string, unknown> {
  switch (command) {
    case "at": {
      const known = at(db, address(args[0]), space);
      return {
        ...(space === DEFAULT_SPACE ? {} : { space }),
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
    }
    case "search": {
      if (args[0] === undefined || args[0] === "") throw new UsageError("search needs text");
      const found = search(db, args[0], values.limit === undefined ? 50 : integer(values.limit, "--limit"), origins, space);
      return { symbols: found.symbols.map(symbol), analyzerNames: found.analyzerNames.map(symbol), comments: found.comments.map(comment) };
    }
    case "symbols": {
      const kind = values.kind === undefined ? undefined : oneOf(SYMBOL_KINDS, values.kind, "--kind");
      if (values.analyzer) return { analyzerNames: listAnalyzerNames(db, range, kind, origins, space).map(symbol) };
      return { symbols: listSymbols(db, range, kind, origins, space).map(symbol) };
    }
    case "regions":
      return { regions: listRegions(db, range, values.type === undefined ? undefined : oneOf(REGION_TYPES, values.type, "--type"), origins, space).map(region) };
    case "comments":
      return { comments: listComments(db, range, origins, space).map(comment) };
    case "references":
      return { references: listReferences(db, range, values.kind === undefined ? undefined : oneOf(REFERENCE_KINDS, values.kind, "--kind"), origins, space).map(reference) };
    case "export": {
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
      const bytes = Buffer.from(`${JSON.stringify(exported, null, 2)}\n`, "utf8");
      writeProjectFile(values.out!, bytes, { what: "--out" });
      return {
        out: values.out,
        bytes: bytes.length,
        counts: { symbols: exported.symbols.length, analyzerNames: exported.analyzerNames.length, regions: exported.regions.length, comments: exported.comments.length, references: exported.references.length, suppressions: exported.suppressions.length, modules: exported.modules.length, operands: exported.operands.length, patches: exported.patches.length, macros: exported.macros.length, macroUses: exported.macroUses.length },
        revision: exported.revision,
      };
    }
    case "suppressions": {
      const rows = listSuppressions(db, range, space);
      const reasons = reasonsOf(db, rows);
      return { suppressions: rows.map((row) => ({ ...suppression(row), ...(reasons.has(row.revision) ? { reason: reasons.get(row.revision) } : {}) })) };
    }
    case "modules":
      return { modules: listModules(db, range, origins, space).map(module) };
    case "operands":
      return { operands: listOperands(db, range, origins, space).map(operand) };
    case "patches":
      return { patches: listPatches(db, range, values.switch, origins, space).map(patch) };
    case "switches": {
      const switches = new Map<string, PatchRow[]>();
      for (const row of listPatches(db, undefined, undefined, undefined, space)) switches.set(row.switch, [...(switches.get(row.switch) ?? []), row]);
      return {
        switches: [...switches].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, rows]) => ({ name, define: `--define ${name}=1`, patches: rows.map((row) => ({ start: formatC64Address(row.start), end: formatC64Address(row.end) })) })),
      };
    }
    case "macros":
      return { macros: listMacros(db, origins, space).map(macro) };
    case "uses":
      return { uses: listMacroUses(db, range, values.macro, origins, space).map(macroUse) };
    case "spaces":
      return { spaces: listSpaces(db) };
    case "history":
      // Each row with the reason and the evidence of the revision that wrote it (F-26).
      return {
        history: (values.macro !== undefined ? historyOfMacro(db, values.macro, space) : values.name === undefined ? historyAt(db, address(args[0]), space) : historyNamed(db, values.name, space)).map((entry) => ({ ...historyEntry(entry), ...revisionNote(db, entry.from) })),
      };
    case "revisions": {
      const options: { limit?: number; before?: string } = {};
      if (values.limit !== undefined) options.limit = integer(values.limit, "--limit");
      if (values.before !== undefined) options.before = values.before;
      return { revisions: revisions(db, options) };
    }
    default: {
      if (args[0] === undefined) throw new UsageError("revision is missing");
      const changes = revision(db, args[0]);
      return { revision: changes.revision, added: changes.added.map(historyEntry), closed: changes.closed.map(historyEntry) };
    }
  }
}

/** --origin for reads: one origin, semantic (user and llm), analyzer (dxa and ghidra), or a comma list. */
function originFilter(value: string): Origin[] {
  const origins = new Set<Origin>();
  for (const part of value.split(",")) {
    if (part === "semantic") origins.add("user").add("llm");
    else if (part === "analyzer") origins.add("dxa").add("ghidra").add("heuristic");
    else origins.add(oneOf(ORIGINS, part, "--origin"));
  }
  return [...origins];
}

/** --evidence kind:ref. A file kind names a project file and keeps its SHA-256, so a later change of the file shows. */
function evidenceOf(value: string): Evidence {
  const colon = value.indexOf(":");
  const kind = oneOf(EVIDENCE_KINDS, colon < 0 ? value : value.slice(0, colon), "--evidence kind");
  const ref = colon < 0 ? "" : value.slice(colon + 1);
  if (ref === "") throw new UsageError(`--evidence needs ${kind}:<${kind === "note" ? "text" : "file"}>`);
  if (kind === "note") return { kind, ref };
  return { kind, ref, sha256: createHash("sha256").update(readProjectFile(ref).bytes).digest("hex") };
}

/**
 * The image that operand, patch and macro use writes are checked against (D65,
 * D72, D73), with the platform names. A byte outside the segments of the image
 * is not in the image.
 */
function operandImage(path: string | undefined, what: string): OperandImage {
  if (path === undefined) throw new UsageError(`${what} checks the write against the image: give --image <image.json|prg>`);
  let image: ReturnType<typeof readImage>;
  try {
    image = readImage(path);
  } catch (error) {
    if (error instanceof ImageError) throw new UsageError(error.message);
    throw error;
  }
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

/** operand <address> with one of --lo, --hi, --value or --expr. */
function operandOperation(args: string[], values: Record<string, unknown>, context: WriteContext, space: string): WriteOperation {
  const given = (["lo", "hi", "value", "expr"] as const).filter((option) => values[option] !== undefined);
  if (given.length !== 1) throw new UsageError("operand needs exactly one of --lo, --hi, --value or --expr");
  const select: OperandSelect = given[0]!;
  const request: { space: string; address: number; select: OperandSelect; symbol?: string; offset?: number; expression?: string } = { space, address: address(args[0]), select };
  if (select === "expr") {
    if (values.offset !== undefined) throw new UsageError("--offset works with --lo, --hi and --value, not with --expr");
    request.expression = values.expr as string;
  } else {
    request.symbol = values[select] as string;
    if (values.offset !== undefined) request.offset = offsetOf(values.offset, "--offset");
  }
  const image = operandImage(values.image as string | undefined, "operand");
  return (db) => {
    const result = setOperand(db, { ...context, image }, request);
    return { revision: result.revision, operand: operand(result.current), ...(result.previous === undefined ? {} : { previous: operand(result.previous) }) };
  };
}

/** A comma list of params or args; an empty text is an empty list. */
const commaList = (value: string) => (value.trim() === "" ? [] : value.split(",").map((item) => item.trim()));

/** The text of an option, or of the project file that a --*-file option names; exactly one of them. */
function textOrFile(values: Record<string, unknown>, option: string, what: string): string | undefined {
  const inline = values[option] as string | undefined;
  const file = values[`${option}-file`] as string | undefined;
  if (inline !== undefined && file !== undefined) throw new UsageError(`give --${option} or --${option}-file, not both`);
  if (file !== undefined) return readProjectFile(file).bytes.toString("utf8");
  if (inline === undefined) return undefined;
  if (inline === "") throw new UsageError(`${what} is empty`);
  return inline;
}

/** patch, macro and use: the writes of the generated source (D72, D73). */
function sourceOperation(command: "patch" | "macro" | "use", args: string[], values: Record<string, unknown>, context: WriteContext, space: string): WriteOperation {
  const comment = values.comment as string | undefined;
  switch (command) {
    case "patch": {
      if (args[2] === undefined) throw new UsageError("the switch name is missing");
      const code = textOrFile(values, "code", "--code");
      if ((code === undefined) === (values.nop !== true)) throw new UsageError("patch needs exactly one of --code, --code-file or --nop");
      const request = { space, start: address(args[0], "start"), end: address(args[1], "end"), switch: args[2], code: code ?? "", ...(comment === undefined ? {} : { comment }) };
      const image = operandImage(values.image as string | undefined, "patch");
      return (db) => {
        const result = setPatch(db, { ...context, image }, request);
        return { revision: result.revision, patch: patch(result.current), ...(result.previous === undefined ? {} : { previous: patch(result.previous) }) };
      };
    }
    case "macro": {
      if (args[0] === undefined) throw new UsageError("the macro name is missing");
      const body = textOrFile(values, "body", "--body");
      if (body === undefined) throw new UsageError("macro needs --body or --body-file");
      const request = { space, name: args[0], params: commaList((values.params as string | undefined) ?? ""), body, ...(comment === undefined ? {} : { comment }) };
      return (db) => {
        const result = setMacro(db, context, request);
        return { revision: result.revision, macro: macro(result.current), ...(result.previous === undefined ? {} : { previous: macro(result.previous) }) };
      };
    }
    case "use": {
      if (args[2] === undefined) throw new UsageError("the macro name is missing");
      const request = { space, start: address(args[0], "start"), end: address(args[1], "end"), macro: args[2], args: commaList((values.args as string | undefined) ?? "") };
      const image = operandImage(values.image as string | undefined, "use");
      return (db) => {
        const result = setMacroUse(db, { ...context, image }, request);
        return { revision: result.revision, use: macroUse(result.current), ...(result.previous === undefined ? {} : { previous: macroUse(result.previous) }) };
      };
    }
  }
}

/** apply <file>: the batch as BatchOperation values, checked before the database opens. */
function applyOperation(args: string[], context: WriteContext, space: string, imagePath: string | undefined): WriteOperation {
  if (args.length !== 1) throw new UsageError("apply needs one file, or - for standard input");
  const text = args[0] === "-" ? readFileSync(0, "utf8") : readProjectFile(args[0]!).bytes.toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`the batch is not JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new UsageError("the batch is a JSON list of writes, for example [{\"op\": \"rename\", \"address\": \"$2100\", \"name\": \"update_player\"}]");
  const operations = parsed.map((item, index) => batchOperation(item, `write ${index + 1}`, space));
  const checked = operations.some((operation) => operation.op === "operand" || operation.op === "patch" || operation.op === "use");
  const withImage = checked ? { ...context, image: operandImage(imagePath, "apply with operand, patch or use writes") } : context;
  return (db) => {
    const applied = applyBatch(db, withImage, operations);
    // replaced: each write that replaced a row of another origin, with that row as previous gives it for one write (b2/07).
    const replaced = applied.steps.flatMap((step, index) =>
      step.previous === undefined
        ? []
        : [{ write: index + 1, op: operations[index]!.op, previous: shownPrevious(step.previous) }],
    );
    return { revision: applied.revision, writes: applied.steps.length, replaced };
  };
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

/** One write of a batch. A write names its own space, or takes the one of --space. */
function batchOperation(item: unknown, at: string, space: string): BatchOperation {
  const operation = batchFields(item, at);
  const own = (item as Record<string, unknown>).space;
  if (own !== undefined && typeof own !== "string") throw new UsageError(`${at}: space must be a string`);
  return { ...operation, space: own ?? space };
}

/** The fields of one write of a batch, with its addresses parsed. */
function batchFields(item: unknown, at: string): BatchOperation {
  if (typeof item !== "object" || item === null || Array.isArray(item)) throw new UsageError(`${at}: a write is an object with op`);
  const fields = item as Record<string, unknown>;
  const op = oneOf(Object.keys(BATCH_FIELDS) as Array<BatchOperation["op"]>, String(fields.op), `${at}: op`);
  const unknown = Object.keys(fields).filter((key) => key !== "op" && key !== "space" && !BATCH_FIELDS[op].includes(key));
  if (unknown.length > 0) throw new UsageError(`${at}: ${op} takes ${BATCH_FIELDS[op].join(", ")}, not ${unknown.join(", ")}`);
  const text = (key: string) => {
    if (typeof fields[key] !== "string") throw new UsageError(`${at}: ${key} must be a string`);
    return fields[key] as string;
  };
  const place = (key: string) => address(text(key), `${at}: ${key}`);
  // A list is a JSON list of strings or a comma list.
  const list = (key: string) => {
    const value = fields[key];
    if (value === undefined) return [];
    if (typeof value === "string") return commaList(value);
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new UsageError(`${at}: ${key} must be a list of strings or a comma list`);
    return (value as string[]).map((item) => item.trim());
  };
  const optional = (key: string) => (fields[key] === undefined ? {} : { [key]: text(key) });
  switch (op) {
    case "rename":
      return { op, address: place("address"), name: text("name"), ...(fields.kind === undefined ? {} : { kind: oneOf(SYMBOL_KINDS, text("kind"), `${at}: kind`) }) };
    case "remove-symbol":
      return { op, address: place("address") };
    case "classify": {
      if (fields.element !== undefined && typeof fields.element !== "number") throw new UsageError(`${at}: element must be a number`);
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

type WriteOperation = (db: DatabaseSync) => unknown;

function writeOperation(command: string, args: string[], kind: string | undefined, element: string | undefined, context: WriteContext, title: string | undefined, space: string): WriteOperation {
  switch (command) {
    case "rename": {
      if (args[1] === undefined) throw new UsageError("name is missing");
      const request: { space: string; address: number; name: string; kind?: SymbolKind } = { space, address: address(args[0]), name: args[1] };
      if (kind !== undefined) request.kind = oneOf(SYMBOL_KINDS, kind, "--kind");
      return (db) => {
        const result = renameSymbol(db, context, request);
        return { revision: result.revision, symbol: symbol(result.current), ...(result.previous === undefined ? {} : { previous: symbol(result.previous) }) };
      };
    }
    case "remove-symbol": {
      const request = { space, address: address(args[0]) };
      return (db) => ({ revision: removeSymbol(db, context, request).revision });
    }
    case "classify": {
      const request = {
        space,
        start: address(args[0], "start"),
        end: address(args[1], "end"),
        type: oneOf(REGION_TYPES, args[2], "type") as RegionType,
        ...(element === undefined ? {} : { element: integer(element, "--element") }),
      };
      return (db) => {
        const result = classifyRegion(db, context, request);
        return { revision: result.revision, regions: result.current.map(region), ...(result.previous === undefined ? {} : { previous: result.previous.map(region) }) };
      };
    }
    case "unclassify": {
      const request = { space, start: address(args[0], "start"), end: address(args[1], "end") };
      return (db) => ({ revision: unclassifyRegion(db, context, request).revision });
    }
    case "comment": {
      if (args.length < 3) throw new UsageError("text is missing");
      const request = { space, address: address(args[0]), placement: oneOf(COMMENT_PLACEMENTS, args[1], "placement") as CommentPlacement, text: args.slice(2).join(" ") };
      return (db) => {
        const result = setComment(db, context, request);
        return { revision: result.revision, comment: comment(result.current) };
      };
    }
    case "uncomment": {
      const request = { space, address: address(args[0]), placement: oneOf(COMMENT_PLACEMENTS, args[1], "placement") };
      return (db) => ({ revision: removeComment(db, context, request).revision });
    }
    case "reference": {
      const request = { space, from: address(args[0], "from"), to: address(args[1], "to"), kind: oneOf(REFERENCE_KINDS, args[2], "kind") as ReferenceKind };
      return (db) => {
        const result = addReference(db, context, request);
        return { revision: result.revision, reference: reference(result.current) };
      };
    }
    case "unreference": {
      const request = { space, from: address(args[0], "from"), to: address(args[1], "to"), kind: oneOf(REFERENCE_KINDS, args[2], "kind") };
      return (db) => ({ revision: removeReference(db, context, request).revision });
    }
    case "module": {
      if (args[1] === undefined) throw new UsageError("file is missing");
      const request = { space, start: address(args[0], "start"), file: args[1], ...(title === undefined ? {} : { title }) };
      return (db) => {
        const result = setModule(db, context, request);
        return { revision: result.revision, module: module(result.current) };
      };
    }
    case "unmodule": {
      const request = { space, start: address(args[0], "start") };
      return (db) => ({ revision: removeModule(db, context, request).revision });
    }
    case "unoperand": {
      const request = { space, address: address(args[0]) };
      return (db) => ({ revision: removeOperand(db, context, request).revision });
    }
    case "unpatch": {
      const request = { space, start: address(args[0], "start") };
      return (db) => ({ revision: removePatch(db, context, request).revision });
    }
    case "unmacro": {
      if (args[0] === undefined) throw new UsageError("the macro name is missing");
      const request = { space, name: args[0] };
      return (db) => ({ revision: removeMacro(db, context, request).revision });
    }
    case "unuse": {
      const request = { space, start: address(args[0], "start") };
      return (db) => ({ revision: removeMacroUse(db, context, request).revision });
    }
    case "merge": {
      if (args.length > 0) throw new UsageError("merge takes no arguments");
      const platform = new Map(platformNames().map((entry) => [entry.name, entry.address]));
      return (db) => {
        const merged = mergeConflicts(db, context, platform);
        return { revision: merged.revision, choices: merged.current.map(showChoice) };
      };
    }
    case "revert": {
      if (args[0] === undefined) throw new UsageError("revision is missing");
      const request = { revision: args[0] };
      return (db) => ({ revision: revert(db, context, request).revision });
    }
    default:
      throw new UsageError(`unknown command: ${command}`);
  }
}

await runScript((argv) => run(argv), { usage: USAGE, refusals: [KnowledgeError] });
