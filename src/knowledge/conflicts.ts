// Conflicts (D69): current rows that break a current-row rule. One computer
// never writes them, but git joins the knowledge of two computers line by
// line, so after a merge two names can be current at one address, or two
// regions can overlap. Reads show them; writes are refused until a merge
// revision decides them.

import type { DatabaseSync } from "node:sqlite";

import type { HistoryEntry } from "./history.ts";
import {
  COMMENT_COLUMNS,
  MACRO_COLUMNS,
  MACRO_USE_COLUMNS,
  MODULE_COLUMNS,
  OPERAND_COLUMNS,
  PATCH_COLUMNS,
  REFERENCE_COLUMNS,
  REGION_COLUMNS,
  SUPPRESSION_COLUMNS,
  SYMBOL_COLUMNS,
  toComment,
  toMacro,
  toMacroUse,
  toModule,
  toOperand,
  toPatch,
  toReference,
  toRegion,
  toSuppression,
  toSymbol,
} from "./read.ts";
import type { Space } from "./schema.ts";
import { compareText, sqlName } from "./text.ts";

/** The current-row rules, each with what breaks it. */
export const CONFLICT_RULES = {
  "symbol-address": "two symbols at one address",
  "analyzer-name-address": "two names of one analyzer at one address",
  "analyzer-name-name": "one analyzer name at two addresses",
  "symbol-name": "one name at two addresses",
  region: "regions that overlap",
  comment: "two comments at one place",
  reference: "the same reference two times",
  operand: "two operand expressions at one address",
  "module-start": "two modules at one address",
  "module-file": "one module file at two addresses",
  "suppression-symbol": "the same symbol suppression two times",
  "suppression-reference": "the same reference suppression two times",
  "suppression-region": "region suppressions that overlap",
  patch: "patches that overlap",
  macro: "two macros with one name",
  "macro-use": "macro uses that overlap",
} as const;
export type ConflictRule = keyof typeof CONFLICT_RULES;

/** One row of a conflict: the row with its revisions and its id. */
export type ConflictRow = HistoryEntry & { id: string };

/** Current rows that break one rule together, oldest first. */
export interface Conflict {
  rule: ConflictRule;
  space: Space;
  rows: ConflictRow[];
}

type Raw = Record<string, unknown>;

interface TableRule {
  rule: ConflictRule;
  table: string;
  entity: HistoryEntry["entity"];
  columns: string;
  map: (raw: Raw) => HistoryEntry["row"];
  /** The columns that must differ between current rows, or "overlap" for address ranges. */
  key: readonly string[] | "overlap";
  /** Rows of the table that the rule is about. */
  where?: string;
}

const RULES: readonly TableRule[] = [
  { rule: "symbol-address", table: "symbols", entity: "symbol", columns: SYMBOL_COLUMNS, map: toSymbol, key: ["address"] },
  { rule: "symbol-name", table: "symbols", entity: "symbol", columns: SYMBOL_COLUMNS, map: toSymbol, key: ["name"] },
  { rule: "analyzer-name-address", table: "analyzer_names", entity: "analyzer-name", columns: SYMBOL_COLUMNS, map: toSymbol, key: ["address", "origin"] },
  { rule: "analyzer-name-name", table: "analyzer_names", entity: "analyzer-name", columns: SYMBOL_COLUMNS, map: toSymbol, key: ["name", "origin"] },
  { rule: "region", table: "regions", entity: "region", columns: REGION_COLUMNS, map: toRegion, key: "overlap" },
  { rule: "comment", table: "comments", entity: "comment", columns: COMMENT_COLUMNS, map: toComment, key: ["address", "placement"] },
  { rule: "reference", table: "references", entity: "reference", columns: REFERENCE_COLUMNS, map: toReference, key: ["from_address", "to_address", "kind"] },
  { rule: "operand", table: "operands", entity: "operand", columns: OPERAND_COLUMNS, map: toOperand, key: ["address"] },
  { rule: "module-start", table: "modules", entity: "module", columns: MODULE_COLUMNS, map: toModule, key: ["start_address"] },
  { rule: "module-file", table: "modules", entity: "module", columns: MODULE_COLUMNS, map: toModule, key: ["file"] },
  { rule: "suppression-symbol", table: "suppressions", entity: "suppression", columns: SUPPRESSION_COLUMNS, map: toSuppression, key: ["start_address"], where: "entity = 'symbol'" },
  {
    rule: "suppression-reference",
    table: "suppressions",
    entity: "suppression",
    columns: SUPPRESSION_COLUMNS,
    map: toSuppression,
    key: ["start_address", "to_address", "kind"],
    where: "entity = 'reference'",
  },
  { rule: "suppression-region", table: "suppressions", entity: "suppression", columns: SUPPRESSION_COLUMNS, map: toSuppression, key: "overlap", where: "entity = 'region'" },
  { rule: "patch", table: "patches", entity: "patch", columns: PATCH_COLUMNS, map: toPatch, key: "overlap" },
  { rule: "macro", table: "macros", entity: "macro", columns: MACRO_COLUMNS, map: toMacro, key: ["name"] },
  { rule: "macro-use", table: "macro_uses", entity: "macro-use", columns: MACRO_USE_COLUMNS, map: toMacroUse, key: "overlap" },
];

function conflictRow(rule: TableRule, raw: Raw): ConflictRow {
  return { entity: rule.entity, row: rule.map(raw), from: raw.valid_from_revision as string, id: raw.id as string } as ConflictRow;
}

const byAge = (a: ConflictRow, b: ConflictRow) => compareText(a.from, b.from) || compareText(a.id, b.id);

/** The current rows of one rule that share a key, in groups. */
function sameKey(db: DatabaseSync, rule: TableRule, key: readonly string[]): Conflict[] {
  const where = `valid_to_revision IS NULL${rule.where === undefined ? "" : ` AND ${rule.where}`}`;
  const columns = ["space", ...key].join(", ");
  const rows = db
    .prepare(`SELECT ${rule.columns}, id FROM ${sqlName(rule.table)} WHERE ${where} AND (${columns}) IN (SELECT ${columns} FROM ${sqlName(rule.table)} WHERE ${where} GROUP BY ${columns} HAVING count(*) > 1)`)
    .all() as Raw[];
  const groups = new Map<string, Conflict>();
  for (const raw of rows) {
    const id = JSON.stringify(["space", ...key].map((column) => raw[column]));
    const group = groups.get(id) ?? { rule: rule.rule, space: raw.space as Space, rows: [] };
    group.rows.push(conflictRow(rule, raw));
    groups.set(id, group);
  }
  return [...groups.values()];
}

/** The current rows of one rule whose address ranges overlap, in groups of rows that overlap in a chain. */
function overlapping(db: DatabaseSync, rule: TableRule): Conflict[] {
  const rows = db
    .prepare(`SELECT ${rule.columns}, id FROM ${sqlName(rule.table)} WHERE valid_to_revision IS NULL${rule.where === undefined ? "" : ` AND ${rule.where}`} ORDER BY space, start_address, end_address`)
    .all() as Raw[];
  const conflicts: Conflict[] = [];
  let group: Conflict | undefined;
  let end = -1;
  for (const raw of rows) {
    if (group !== undefined && raw.space === group.space && (raw.start_address as number) <= end) {
      group.rows.push(conflictRow(rule, raw));
      end = Math.max(end, raw.end_address as number);
      continue;
    }
    if (group !== undefined && group.rows.length > 1) conflicts.push(group);
    group = { rule: rule.rule, space: raw.space as Space, rows: [conflictRow(rule, raw)] };
    end = raw.end_address as number;
  }
  if (group !== undefined && group.rows.length > 1) conflicts.push(group);
  return conflicts;
}

/** Every conflict of the knowledge, rule by rule; the rows of each, oldest first. */
export function conflicts(db: DatabaseSync | undefined): Conflict[] {
  if (db === undefined) return [];
  return RULES.flatMap((rule) => (rule.key === "overlap" ? overlapping(db, rule) : sameKey(db, rule, rule.key))).map((conflict) => ({ ...conflict, rows: conflict.rows.sort(byAge) }));
}

/** The table of a conflict rule. */
export function conflictTable(rule: ConflictRule): string {
  return RULES.find((item) => item.rule === rule)!.table;
}
