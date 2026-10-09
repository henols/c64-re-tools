// The c64-knowledge script: reads and writes .c64-re-tools/knowledge.db in the
// project directory (the working directory) and prints one compact JSON result.

import type { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { KnowledgeError, openForRead, withWrite } from "#src/knowledge/database.ts";
import { historyAt, historyNamed, revision, revisions, type HistoryEntry } from "#src/knowledge/history.ts";
import {
  at,
  listComments,
  listReferences,
  listRegions,
  listSymbols,
  search,
  type CommentRow,
  type ReferenceRow,
  type RegionRow,
  type SymbolRow,
} from "#src/knowledge/read.ts";
import {
  COMMENT_PLACEMENTS,
  REFERENCE_KINDS,
  REGION_TYPES,
  SYMBOL_KINDS,
  type CommentPlacement,
  type ReferenceKind,
  type RegionType,
  type SymbolKind,
} from "#src/knowledge/schema.ts";
import {
  addReference,
  classifyRegion,
  removeComment,
  removeReference,
  removeSymbol,
  renameSymbol,
  revert,
  setComment,
  unclassifyRegion,
  type WriteContext,
} from "#src/knowledge/write.ts";
import { runScript, UsageError } from "#src/script.ts";

const USAGE = `knowledge.ts <command> [arguments] [options]

Read (no database needed):
  at <address>                        everything known at one address
  search <text>                       symbol names and comment texts
  symbols [--start A --end A --kind K]
  regions [--start A --end A --type T]
  comments [--start A --end A]
  references [--start A --end A --kind K]
  history <address> | history --name <name>
  revisions [--limit N --before N]
  revision <id>

Write (one revision each; creates the database when needed):
  rename <address> <name> [--kind K]
  remove-symbol <address>
  classify <start> <end> <type>
  unclassify <start> <end>
  comment <address> <line|side> <text>
  uncomment <address> <line|side>
  reference <from> <to> <kind>
  unreference <from> <to> <kind>
  revert <revision>

Write options:
  --reason <text>          why, kept with the revision
  --expect-revision <N>    refuse the write if knowledge changed after revision N
  --origin user|llm        who decided (default llm)

Addresses are $ and four hex digits; quote them in a shell: '$2100'.`;

function address(value: string | undefined, what = "address"): number {
  if (value === undefined) throw new UsageError(`${what} is missing`);
  try {
    return parseC64Address(value);
  } catch {
    throw new UsageError(`${what} must be $ followed by four hex digits, for example '$2100', not ${value}`);
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
const symbol = (row: SymbolRow) => ({ address: formatC64Address(row.address), name: row.name, kind: row.kind, origin: row.origin, revision: row.revision });
const region = (row: RegionRow) => ({ start: formatC64Address(row.start), end: formatC64Address(row.end), type: row.type, origin: row.origin, revision: row.revision });
const comment = (row: CommentRow) => ({ address: formatC64Address(row.address), placement: row.placement, text: row.text, origin: row.origin, revision: row.revision });
const reference = (row: ReferenceRow) => ({ from: formatC64Address(row.from), to: formatC64Address(row.to), kind: row.kind, origin: row.origin, revision: row.revision });

function historyEntry(entry: HistoryEntry) {
  const shown =
    entry.entity === "symbol"
      ? symbol(entry.row)
      : entry.entity === "region"
        ? region(entry.row)
        : entry.entity === "comment"
          ? comment(entry.row)
          : reference(entry.row);
  const { revision: _revision, ...row } = shown;
  return { entity: entry.entity, ...row, fromRevision: entry.from, ...(entry.to === undefined ? {} : { toRevision: entry.to }) };
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
      help: { type: "boolean" },
    },
  });
  const [command, ...args] = positionals;
  if (values.help || command === undefined) throw new UsageError("");
  const range = { start: values.start === undefined ? 0x0000 : address(values.start, "--start"), end: values.end === undefined ? 0xffff : address(values.end, "--end") };

  const read = new Set(["at", "search", "symbols", "regions", "comments", "references", "history", "revisions", "revision"]);
  const write = new Set(["rename", "remove-symbol", "classify", "unclassify", "comment", "uncomment", "reference", "unreference", "revert"]);
  // Refuse a mistyped command before anything opens, so no database appears by accident.
  if (!read.has(command) && !write.has(command)) throw new UsageError(`unknown command: ${command}`);
  if (read.has(command)) {
    const db = openForRead();
    try {
      switch (command) {
        case "at": {
          const known = at(db, address(args[0]));
          return {
            address: formatC64Address(known.address),
            ...(known.symbol === undefined ? {} : { symbol: symbol(known.symbol) }),
            ...(known.region === undefined ? {} : { region: region(known.region) }),
            comments: known.comments.map(comment),
            referencesFrom: known.referencesFrom.map(reference),
            referencesTo: known.referencesTo.map(reference),
            revision: known.revision,
          };
        }
        case "search": {
          if (args[0] === undefined || args[0] === "") throw new UsageError("search needs text");
          const found = search(db, args[0], values.limit === undefined ? 50 : integer(values.limit, "--limit"));
          return { symbols: found.symbols.map(symbol), comments: found.comments.map(comment) };
        }
        case "symbols":
          return { symbols: listSymbols(db, range, values.kind === undefined ? undefined : oneOf(SYMBOL_KINDS, values.kind, "--kind")).map(symbol) };
        case "regions":
          return { regions: listRegions(db, range, values.type === undefined ? undefined : oneOf(REGION_TYPES, values.type, "--type")).map(region) };
        case "comments":
          return { comments: listComments(db, range).map(comment) };
        case "references":
          return { references: listReferences(db, range, values.kind === undefined ? undefined : oneOf(REFERENCE_KINDS, values.kind, "--kind")).map(reference) };
        case "history":
          return { history: (values.name === undefined ? historyAt(db, address(args[0])) : historyNamed(db, values.name)).map(historyEntry) };
        case "revisions": {
          const options: { limit?: number; before?: number } = {};
          if (values.limit !== undefined) options.limit = integer(values.limit, "--limit");
          if (values.before !== undefined) options.before = integer(values.before, "--before");
          return { revisions: revisions(db, options) };
        }
        default: {
          const changes = revision(db, integer(args[0], "revision"));
          return { revision: changes.revision, added: changes.added.map(historyEntry), closed: changes.closed.map(historyEntry) };
        }
      }
    } finally {
      db?.close();
    }
  }

  const context: WriteContext = { origin: values.origin === undefined ? "llm" : oneOf(["user", "llm"] as const, values.origin, "--origin") };
  if (values.reason !== undefined) context.description = values.reason;
  if (values["expect-revision"] !== undefined) context.expectedRevision = integer(values["expect-revision"], "--expect-revision");
  // Every argument is checked before the database opens: a refused write creates no database.
  const operation = writeOperation(command, args, values.kind, context);
  return withWrite(operation);
}

type WriteOperation = (db: DatabaseSync) => unknown;

function writeOperation(command: string, args: string[], kind: string | undefined, context: WriteContext): WriteOperation {
  switch (command) {
    case "rename": {
      if (args[1] === undefined) throw new UsageError("name is missing");
      const request: { address: number; name: string; kind?: SymbolKind } = { address: address(args[0]), name: args[1] };
      if (kind !== undefined) request.kind = oneOf(SYMBOL_KINDS, kind, "--kind");
      return (db) => {
        const result = renameSymbol(db, context, request);
        return { revision: result.revision, symbol: symbol(result.current), ...(result.previous === undefined ? {} : { previous: symbol(result.previous) }) };
      };
    }
    case "remove-symbol": {
      const request = { address: address(args[0]) };
      return (db) => ({ revision: removeSymbol(db, context, request).revision });
    }
    case "classify": {
      const request = { start: address(args[0], "start"), end: address(args[1], "end"), type: oneOf(REGION_TYPES, args[2], "type") as RegionType };
      return (db) => {
        const result = classifyRegion(db, context, request);
        return { revision: result.revision, regions: result.current.map(region), ...(result.previous === undefined ? {} : { previous: result.previous.map(region) }) };
      };
    }
    case "unclassify": {
      const request = { start: address(args[0], "start"), end: address(args[1], "end") };
      return (db) => ({ revision: unclassifyRegion(db, context, request).revision });
    }
    case "comment": {
      if (args.length < 3) throw new UsageError("text is missing");
      const request = { address: address(args[0]), placement: oneOf(COMMENT_PLACEMENTS, args[1], "placement") as CommentPlacement, text: args.slice(2).join(" ") };
      return (db) => {
        const result = setComment(db, context, request);
        return { revision: result.revision, comment: comment(result.current) };
      };
    }
    case "uncomment": {
      const request = { address: address(args[0]), placement: oneOf(COMMENT_PLACEMENTS, args[1], "placement") };
      return (db) => ({ revision: removeComment(db, context, request).revision });
    }
    case "reference": {
      const request = { from: address(args[0], "from"), to: address(args[1], "to"), kind: oneOf(REFERENCE_KINDS, args[2], "kind") as ReferenceKind };
      return (db) => {
        const result = addReference(db, context, request);
        return { revision: result.revision, reference: reference(result.current) };
      };
    }
    case "unreference": {
      const request = { from: address(args[0], "from"), to: address(args[1], "to"), kind: oneOf(REFERENCE_KINDS, args[2], "kind") };
      return (db) => ({ revision: removeReference(db, context, request).revision });
    }
    case "revert": {
      const request = { revision: integer(args[0], "revision") };
      return (db) => ({ revision: revert(db, context, request).revision });
    }
    default:
      throw new UsageError(`unknown command: ${command}`);
  }
}

await runScript(() => run(process.argv.slice(2)), { usage: USAGE, refusals: [KnowledgeError] });
