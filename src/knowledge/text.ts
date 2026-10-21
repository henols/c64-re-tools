// The committed knowledge as text: .c64-re-tools/knowledge/ holds
// revisions.jsonl and one <table>.jsonl for each fact table. Each line is one
// JSON object with its keys in a fixed order, and the lines are sorted, so a
// change of the knowledge is a small diff and git can join the work of two
// computers line by line (merge=union). The index in local/ is made from
// this text.

import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

import { Refusal } from "../errors.ts";
import { isoCet } from "../time.ts";

/** The value of "no revision": empty knowledge. It sorts before every revision id. */
export const NO_REVISION = "0";

/** A revision id: the CET time in ISO 8601 basic form to the millisecond, then six random characters. */
export const REVISION_ID = /^[0-9]{8}T[0-9]{6}\.[0-9]{3}-[0-9a-z]{6}$/;

/** A row id: the id of the revision that added the row, then the order of the row in that revision. */
const ROW_ID = /^([0-9]{8}T[0-9]{6}\.[0-9]{3}-[0-9a-z]{6})\/([1-9][0-9]*)$/;

const CET_OFFSET_MS = 60 * 60 * 1000;

/** `time` as `20261015T214501.123`: CET at +01:00, ISO 8601 basic form. */
function stamp(ms: number): string {
  return isoCet(new Date(ms)).slice(0, 23).replace(/[-:]/g, "");
}

/** The time of a revision id, in milliseconds. */
function timeOf(id: string): number {
  const [, year, month, day, hour, minute, second, milli] = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})/.exec(id)!;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number(milli)) - CET_OFFSET_MS;
}

/** Compares text by code unit, as SQLite does: revision ids sort in time order this way. */
export const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * A new revision id that sorts after `latest`: the time now, or one
 * millisecond after `latest` when the clock is not ahead of it. The random
 * part keeps the ids of two computers apart.
 */
export function newRevisionId(latest: string, now: Date = new Date(), random: Uint8Array = randomBytes(6)): string {
  const time = latest === NO_REVISION ? now.getTime() : Math.max(now.getTime(), timeOf(latest) + 1);
  return `${stamp(time)}-${Array.from(random.subarray(0, 6), (byte) => ALPHABET[byte % ALPHABET.length]).join("")}`;
}

export function rowId(revision: string, order: number): string {
  return `${revision}/${order}`;
}

/**
 * How a value of a column is written: an address as "$c000", a whole number,
 * text, bytes as lowercase hex digits, or a JSON value that the index keeps as
 * JSON text.
 */
type Format = "address" | "integer" | "text" | "hex" | "json";

interface Field {
  key: string;
  column: string;
  format: Format;
  optional?: boolean;
}

/** One fact table: its file, its fields in line order, and the column that sorts its lines after the space (an address, or a name). */
export interface TableSpec {
  table: string;
  file: string;
  fields: readonly Field[];
  sort: string;
}

const field = (key: string, column: string, format: Format, optional = false): Field => ({ key, column, format, ...(optional ? { optional } : {}) });
const space = field("space", "space", "text");
const origin = field("origin", "origin", "text");

/** The fact tables. Each line has `id`, these fields, then `added` and `closed` (the revisions; closed is null while the row is current). */
export const TABLES: readonly TableSpec[] = [
  { table: "symbols", file: "symbols.jsonl", sort: "address", fields: [space, field("address", "address", "address"), field("name", "name", "text"), field("kind", "kind", "text"), origin] },
  // The names that analyzers give: a second name of an address, for reference.
  { table: "analyzer_names", file: "analyzer_names.jsonl", sort: "address", fields: [space, field("address", "address", "address"), field("name", "name", "text"), field("kind", "kind", "text"), origin] },
  {
    table: "regions",
    file: "regions.jsonl",
    sort: "start_address",
    fields: [space, field("start", "start_address", "address"), field("end", "end_address", "address"), field("type", "type", "text"), field("element", "element", "integer", true), origin],
  },
  {
    table: "comments",
    file: "comments.jsonl",
    sort: "address",
    fields: [space, field("address", "address", "address"), field("placement", "placement", "text"), field("text", "text", "text"), origin],
  },
  {
    table: "references",
    file: "references.jsonl",
    sort: "from_address",
    fields: [space, field("from", "from_address", "address"), field("to", "to_address", "address"), field("kind", "kind", "text"), origin],
  },
  {
    table: "suppressions",
    file: "suppressions.jsonl",
    sort: "start_address",
    fields: [
      space,
      field("entity", "entity", "text"),
      field("start", "start_address", "address"),
      field("end", "end_address", "address"),
      field("to", "to_address", "address", true),
      field("kind", "kind", "text", true),
      origin,
    ],
  },
  {
    table: "modules",
    file: "modules.jsonl",
    sort: "start_address",
    fields: [space, field("start", "start_address", "address"), field("file", "file", "text"), field("title", "title", "text", true), origin],
  },
  {
    table: "operands",
    file: "operands.jsonl",
    sort: "address",
    fields: [
      space,
      field("address", "address", "address"),
      field("select", "selector", "text"),
      field("symbol", "symbol", "text", true),
      field("offset", "offset", "integer"),
      field("expression", "expression", "text", true),
      origin,
    ],
  },
  {
    table: "patches",
    file: "patches.jsonl",
    sort: "start_address",
    fields: [
      space,
      field("start", "start_address", "address"),
      field("end", "end_address", "address"),
      field("switch", "switch_name", "text"),
      field("code", "code", "text"),
      field("comment", "comment", "text", true),
      origin,
    ],
  },
  // Every switch of the patches in one place: its kind, its default and the releases that have it on.
  {
    table: "switches",
    file: "switches.jsonl",
    sort: "name",
    fields: [
      space,
      field("name", "name", "text"),
      field("kind", "kind", "text"),
      field("default", "default_value", "integer"),
      field("releases", "releases", "text"),
      field("comment", "comment", "text", true),
      origin,
    ],
  },
  // The releases of the program: the file of each, and the one whose bytes are the program.
  {
    table: "releases",
    file: "releases.jsonl",
    sort: "label",
    fields: [space, field("label", "label", "text"), field("file", "file", "text"), field("sha256", "sha256", "text"), field("base", "base", "integer"), field("comment", "comment", "text", true), origin],
  },
  {
    table: "macros",
    file: "macros.jsonl",
    sort: "name",
    fields: [space, field("name", "name", "text"), field("params", "params", "text"), field("body", "body", "text"), field("comment", "comment", "text", true), origin],
  },
  {
    table: "macro_uses",
    file: "macro_uses.jsonl",
    sort: "start_address",
    fields: [space, field("start", "start_address", "address"), field("end", "end_address", "address"), field("macro", "macro", "text"), field("args", "args", "text"), origin],
  },
  // The start screen of the program: the loader of the generated source shows it before the entry.
  {
    table: "start_screens",
    file: "start_screen.jsonl",
    sort: "screen",
    fields: [
      space,
      field("mode", "mode", "text"),
      field("screen", "screen", "address"),
      field("bitmap", "bitmap", "address", true),
      field("charset", "charset", "address", true),
      field("colours", "colours", "address", true),
      field("colour", "colour", "integer", true),
      field("border", "border", "integer"),
      field("background", "background", "integer"),
      field("comment", "comment", "text", true),
      origin,
    ],
  },
  // The program itself: its bytes, at most 64 to a row, so a changed byte changes one line.
  { table: "memory", file: "memory.jsonl", sort: "address", fields: [space, field("at", "address", "address"), field("bytes", "bytes", "hex"), origin] },
  // Where the program starts, the machine state there, and the stages of its unpacker.
  {
    table: "entries",
    file: "entry.jsonl",
    sort: "address",
    fields: [space, field("entry", "address", "address"), field("state", "state", "json", true), field("stages", "stages", "json", true), origin],
  },
  // What the runs did: the union of the coverage maps as ranges of one kind each.
  { table: "coverage", file: "coverage.jsonl", sort: "start_address", fields: [space, field("kind", "kind", "text"), field("start", "start_address", "address"), field("end", "end_address", "address"), origin] },
];

export const REVISIONS_FILE = "revisions.jsonl";

/** The revision fields in line order; `evidence` comes last. */
const REVISION_FIELDS: readonly Field[] = [
  field("id", "id", "text"),
  field("time", "created_at", "text"),
  field("origin", "origin", "text"),
  field("operation", "operation", "text"),
  field("reason", "description", "text", true),
  field("inputHash", "input_hash", "text", true),
  field("toolVersion", "tool_version", "text", true),
  field("restores", "restored_revision", "text", true),
  field("restoresSpace", "restored_space", "text", true),
];

/** The SQL name of a table: "references" is a keyword. */
export const sqlName = (table: string) => (table === "references" ? '"references"' : table);

type Raw = Record<string, unknown>;

function formatted(value: unknown, format: Format): unknown {
  if (format === "address") return `$${(value as number).toString(16).padStart(4, "0")}`;
  return format === "json" ? JSON.parse(value as string) : value;
}

function lineOf(raw: Raw, fields: readonly Field[], extra: Raw): string {
  const line: Raw = {};
  for (const { key, column, format, optional } of fields) {
    const value = raw[column];
    if (value === null && optional) continue;
    line[key] = formatted(value, format);
  }
  return JSON.stringify({ ...line, ...extra });
}

const spaceOrder = (space: string) => (space === "c64" ? -2 : space === "drive8" ? -1 : Number(space.slice(4)));

/** The sort key of a row: space, address (or name), the revision that added it, its order in that revision. */
function compareRows(spec: TableSpec) {
  const order = (raw: Raw) => Number(ROW_ID.exec(raw.id as string)?.[2] ?? 0);
  const key = (a: unknown, b: unknown) => (typeof a === "number" ? a - (b as number) : compareText(a as string, b as string));
  return (a: Raw, b: Raw) =>
    spaceOrder(a.space as string) - spaceOrder(b.space as string) ||
    key(a[spec.sort], b[spec.sort]) ||
    compareText(a.valid_from_revision as string, b.valid_from_revision as string) ||
    order(a) - order(b) ||
    compareText(a.id as string, b.id as string);
}

/** The text of one fact table: every row, current and closed, one line each, sorted. */
export function tableText(db: DatabaseSync, spec: TableSpec): string {
  const rows = (db.prepare(`SELECT * FROM ${sqlName(spec.table)}`).all() as Raw[]).sort(compareRows(spec));
  return rows.map((raw) => `${lineOf(raw, [field("id", "id", "text"), ...spec.fields], { added: raw.valid_from_revision, closed: raw.valid_to_revision })}\n`).join("");
}

/** The text of the revision log: every revision with its evidence, oldest first. */
export function revisionsText(db: DatabaseSync): string {
  const evidence = db.prepare("SELECT kind, ref, sha256, space FROM evidence WHERE revision = ? ORDER BY id");
  return (db.prepare("SELECT * FROM revisions ORDER BY id").all() as Raw[])
    .map((raw) => {
      const items = (evidence.all(raw.id as string) as Raw[]).map((item) => ({ kind: item.kind, ref: item.ref, ...(item.sha256 === null ? {} : { sha256: item.sha256 }), ...(item.space === null ? {} : { space: item.space }) }));
      return `${lineOf(raw, REVISION_FIELDS, items.length === 0 ? {} : { evidence: items })}\n`;
    })
    .join("");
}

export const sha256 = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");

/** The files of the knowledge: their text and its SHA-256. A file that is not knowledge text is refused. */
export function readText(directory: string): Map<string, { text: string; sha256: string }> {
  const known = new Set([REVISIONS_FILE, ...TABLES.map((spec) => spec.file)]);
  const files = new Map<string, { text: string; sha256: string }>();
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith(".jsonl")) continue;
    if (!known.has(name)) throw new Refusal("invalid-database", `.c64-re-tools/knowledge/${name} is not a knowledge file. Knowledge files are ${[...known].join(", ")}.`);
    const bytes = readFileSync(join(directory, name));
    files.set(name, { text: bytes.toString("utf8"), sha256: sha256(bytes) });
  }
  return files;
}

/** Writes a file through a temporary file and a rename, so a reader never sees half of it. */
export function writeAtomic(path: string, text: string): void {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, text);
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

/** One line of a knowledge file that cannot be read. */
function bad(file: string, line: number, message: string): never {
  throw new Refusal("invalid-database", `.c64-re-tools/knowledge/${file}:${line}: ${message}`);
}

function parseLines(file: string, text: string): Array<{ line: number; value: Raw }> {
  const lines: Array<{ line: number; value: Raw }> = [];
  text.split("\n").forEach((source, index) => {
    if (source.trim().length === 0) return;
    let value: unknown;
    try {
      value = JSON.parse(source);
    } catch {
      bad(file, index + 1, "the line is not JSON.");
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) bad(file, index + 1, "the line is not a JSON object.");
    lines.push({ line: index + 1, value: value as Raw });
  });
  return lines;
}

/** The column values of one line, checked against its fields. */
function columnsOf(file: string, line: number, value: Raw, fields: readonly Field[], extra: readonly string[]): Raw {
  const allowed = new Set([...fields.map((item) => item.key), ...extra]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) bad(file, line, `the key ${JSON.stringify(key)} is not known.`);
  const columns: Raw = {};
  for (const { key, column, format, optional } of fields) {
    const item = value[key];
    if (item === undefined || item === null) {
      if (!optional) bad(file, line, `the key ${JSON.stringify(key)} is missing.`);
      columns[column] = null;
    } else if (format === "address") {
      if (typeof item !== "string" || !/^\$[0-9a-f]{4}$/.test(item)) bad(file, line, `${key} must be an address such as "$c000".`);
      columns[column] = Number.parseInt(item.slice(1), 16);
    } else if (format === "integer") {
      if (!Number.isInteger(item)) bad(file, line, `${key} must be a whole number.`);
      columns[column] = item;
    } else if (format === "hex") {
      if (typeof item !== "string" || !/^(?:[0-9a-f]{2})+$/.test(item)) bad(file, line, `${key} must be bytes as lowercase hex digits.`);
      columns[column] = item;
    } else if (format === "json") {
      if (typeof item !== "object") bad(file, line, `${key} must be a JSON object or list.`);
      columns[column] = JSON.stringify(item);
    } else {
      if (typeof item !== "string") bad(file, line, `${key} must be text.`);
      columns[column] = item;
    }
  }
  return columns;
}

/** The lines of one file joined by id: git can keep the same line of both sides of a merge. */
function joinById<T extends { id: string }>(file: string, entries: Array<{ line: number; row: T }>, join: (a: T, b: T) => T | undefined): T[] {
  const byId = new Map<string, { line: number; row: T }>();
  for (const entry of entries) {
    const known = byId.get(entry.row.id);
    if (known === undefined) {
      byId.set(entry.row.id, entry);
      continue;
    }
    const joined = join(known.row, entry.row);
    if (joined === undefined) bad(file, entry.line, `the id ${entry.row.id} is also on line ${known.line} with other values.`);
    byId.set(entry.row.id, { line: known.line, row: joined });
  }
  return [...byId.values()].map((entry) => entry.row);
}

interface RevisionLine {
  id: string;
  columns: Raw;
  evidence: Array<{ kind: unknown; ref: unknown; sha256: unknown; space: unknown }>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function parseRevisions(text: string): RevisionLine[] {
  const entries = parseLines(REVISIONS_FILE, text).map(({ line, value }) => {
    const columns = columnsOf(REVISIONS_FILE, line, value, REVISION_FIELDS, ["evidence"]);
    if (!REVISION_ID.test(columns.id as string)) bad(REVISIONS_FILE, line, `${JSON.stringify(columns.id)} is not a revision id.`);
    const evidence = value.evidence ?? [];
    if (!Array.isArray(evidence) || evidence.some((item) => typeof item !== "object" || item === null)) bad(REVISIONS_FILE, line, "evidence must be a list of objects.");
    const items = (evidence as Raw[]).map((item) => {
      for (const key of Object.keys(item)) if (!["kind", "ref", "sha256", "space"].includes(key)) bad(REVISIONS_FILE, line, `the evidence key ${JSON.stringify(key)} is not known.`);
      return { kind: item.kind, ref: item.ref, sha256: item.sha256 ?? null, space: item.space ?? null };
    });
    return { line, row: { id: columns.id as string, columns, evidence: items } };
  });
  return joinById(REVISIONS_FILE, entries, (a, b) => (same(a, b) ? a : undefined));
}

interface RowLine {
  id: string;
  columns: Raw;
}

function parseRows(spec: TableSpec, text: string): RowLine[] {
  const entries = parseLines(spec.file, text).map(({ line, value }) => {
    const columns = columnsOf(spec.file, line, value, [field("id", "id", "text"), ...spec.fields, field("added", "valid_from_revision", "text"), field("closed", "valid_to_revision", "text", true)], []);
    const id = ROW_ID.exec(columns.id as string);
    if (id === null) bad(spec.file, line, `${JSON.stringify(columns.id)} is not a row id.`);
    if (id[1] !== columns.valid_from_revision) bad(spec.file, line, `the row ${columns.id} must be added in revision ${id[1]}.`);
    if (columns.valid_to_revision !== null && !REVISION_ID.test(columns.valid_to_revision as string)) bad(spec.file, line, `${JSON.stringify(columns.valid_to_revision)} is not a revision id.`);
    return { line, row: { id: columns.id as string, columns } };
  });
  // A closed line wins over the open line of the same row; of two closed lines, the earlier close wins.
  return joinById(spec.file, entries, (a, b) => {
    const { valid_to_revision: closedA, ...restA } = a.columns;
    const { valid_to_revision: closedB, ...restB } = b.columns;
    if (!same(restA, restB)) return undefined;
    if (closedA === null) return b;
    if (closedB === null) return a;
    return (closedA as string) <= (closedB as string) ? a : b;
  });
}

/**
 * Fills an empty index from the text of the knowledge. A line that the index
 * refuses (an unknown origin, a revision that is not in the log) is refused
 * with its file and row.
 */
export function loadText(db: DatabaseSync, files: ReadonlyMap<string, { text: string }>): void {
  const insertRevision = db.prepare(`INSERT INTO revisions (${REVISION_FIELDS.map((item) => item.column).join(", ")}) VALUES (${REVISION_FIELDS.map(() => "?").join(", ")})`);
  const insertEvidence = db.prepare("INSERT INTO evidence (revision, kind, ref, sha256, space) VALUES (?, ?, ?, ?, ?)");
  const revisions = parseRevisions(files.get(REVISIONS_FILE)?.text ?? "").sort((a, b) => compareText(a.id, b.id));
  for (const revision of revisions) {
    try {
      insertRevision.run(...(REVISION_FIELDS.map((item) => revision.columns[item.column]) as Array<string | null>));
      for (const item of revision.evidence) insertEvidence.run(revision.id, item.kind as string, item.ref as string, item.sha256 as string | null, item.space as string | null);
    } catch (error) {
      throw new Refusal("invalid-database", `.c64-re-tools/knowledge/${REVISIONS_FILE}: the revision ${revision.id} is not valid: ${(error as Error).message}`);
    }
  }
  for (const spec of TABLES) {
    const text = files.get(spec.file)?.text;
    if (text === undefined) continue;
    const columns = ["id", ...spec.fields.map((item) => item.column), "valid_from_revision", "valid_to_revision"];
    const insert = db.prepare(`INSERT INTO ${sqlName(spec.table)} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
    for (const row of parseRows(spec, text)) {
      try {
        insert.run(...(columns.map((column) => row.columns[column]) as Array<string | number | null>));
      } catch (error) {
        throw new Refusal("invalid-database", `.c64-re-tools/knowledge/${spec.file}: the row ${row.id} is not valid: ${(error as Error).message}`);
      }
    }
  }
}
