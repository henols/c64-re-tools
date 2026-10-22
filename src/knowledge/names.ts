// Names as addresses: the one place where a name in a command line, a step
// or a scenario becomes an address. A symbol comes first. An analyzer name
// counts when no symbol has the name and the analyzers that give it give it
// to one address.

import type { DatabaseSync } from "node:sqlite";

import { addressOf, formatAddress } from "../address.ts";
import { Refusal } from "../errors.ts";
import { openForRead } from "./database.ts";
import { analyzerNamed, listAnalyzerNames, listSymbols, symbolNamed } from "./read.ts";
import { type Space, type SymbolKind } from "./schema.ts";
import type { Machine } from "../machine.ts";
import { machineOf, mainSpaceOf } from "./project-machine.ts";

/** The address of a name in a space. Refuses a name that no symbol and no analyzer has, and an analyzer name at two addresses. */
export function addressOfName(db: DatabaseSync | undefined, name: string, space: Space = mainSpaceOf(db)): number {
  const symbol = symbolNamed(db, name, space);
  if (symbol !== undefined) return symbol.address;
  const rows = analyzerNamed(db, name, space);
  const addresses = [...new Set(rows.map((row) => row.address))];
  if (addresses.length === 1) return addresses[0]!;
  const where = space === mainSpaceOf(db) ? "" : ` in ${space}`;
  if (addresses.length > 1) throw new Refusal("invalid-input", `the analyzers give ${name} to ${rows.map((row) => `${formatAddress(row.address)} (${row.origin})`).join(" and ")}${where}. Give the address.`);
  throw new Refusal("not-found", `${name} is not a name in the knowledge${where}. Give a $ address, or a symbol or an analyzer name of the project knowledge${where}.`);
}

/** Every name of a space with its address: the symbols, and each analyzer name that addressOfName accepts. With kinds, only names of those kinds. */
export function nameTable(db: DatabaseSync | undefined, space: Space = mainSpaceOf(db), kinds?: readonly SymbolKind[]): Map<string, number> {
  const fits = (row: { kind: SymbolKind }) => kinds === undefined || kinds.includes(row.kind);
  const names = new Map<string, number>();
  for (const symbol of listSymbols(db, undefined, undefined, undefined, space)) if (fits(symbol)) names.set(symbol.name, symbol.address);
  const analyzer = new Map<string, Set<number>>();
  for (const row of listAnalyzerNames(db, undefined, undefined, undefined, space)) if (fits(row)) analyzer.set(row.name, (analyzer.get(row.name) ?? new Set()).add(row.address));
  for (const [name, addresses] of analyzer) if (!names.has(name) && addresses.size === 1) names.set(name, [...addresses][0]!);
  return names;
}

/** The main space of the project's machine: the default space of a script command. */
export function projectMainSpace(): Space {
  const db = openForRead();
  try {
    return mainSpaceOf(db);
  } finally {
    db?.close();
  }
}

/** The machine of the project: the machine of its knowledge, else the C64. */
export function projectMachine(): Machine {
  const db = openForRead();
  try {
    return machineOf(db);
  } finally {
    db?.close();
  }
}

/** addressOfName on the knowledge of the project: the name resolver of the scripts. */
export function knowledgeNames(name: string, space?: string): number {
  const db = openForRead();
  try {
    return addressOfName(db, name, space);
  } finally {
    db?.close();
  }
}

/** An address of a step or a file: $ and 1 to 4 hex digits, else a name of the knowledge in the space. */
export function knowledgeAt(space?: Space): (location: string) => number {
  return (location) => addressOf(location) ?? knowledgeNames(location, space);
}
