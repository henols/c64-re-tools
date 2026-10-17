// The routine graph of the knowledge: which routine calls, jumps
// to or dispatches through a table to which other routine, and the same
// graph as a mermaid flowchart. The callers give the rows, so the graph needs
// no database and the documentation and the knowledge script draw one graph.

import { formatC64Address } from "../c64.ts";
import type { ReferenceKind, SymbolKind } from "./schema.ts";

/** How one routine reaches another: a call, a jump, or an entry of a table of addresses. */
export type EdgeKind = "call" | "jump" | "table";

export interface GraphReference {
  from: number;
  to: number;
  kind: ReferenceKind | "table";
}

export interface RoutineHead {
  address: number;
  name: string;
}

export interface GraphEdge {
  from: number;
  to: number;
  /** The strongest kind of the references that make the edge: a call, then a table entry, then a jump. */
  kind: EdgeKind;
  /** The references that make the edge. */
  count: number;
}

const STRENGTH: Record<EdgeKind, number> = { call: 3, table: 2, jump: 1 };

/**
 * The routine heads: every routine of the knowledge, and every call or table
 * target, which another routine enters at its start. A head without a name of
 * the knowledge gets the name that `nameOf` gives.
 */
export function routineHeads(symbols: ReadonlyArray<{ address: number; name: string; kind: SymbolKind }>, references: readonly GraphReference[], nameOf: (address: number) => string): RoutineHead[] {
  const names = new Map(symbols.map((symbol) => [symbol.address, symbol.name]));
  const heads = new Set(symbols.filter((symbol) => symbol.kind === "routine").map((symbol) => symbol.address));
  for (const reference of references) if (reference.kind === "call" || reference.kind === "table") heads.add(reference.to);
  return [...heads].sort((a, b) => a - b).map((address) => ({ address, name: names.get(address) ?? nameOf(address) }));
}

/**
 * The head that holds an address: the nearest head at or below it, when no
 * boundary (a module start) lies between the two.
 */
export function ownerOf(heads: readonly RoutineHead[], boundaries: readonly number[], address: number): RoutineHead | undefined {
  let low = 0;
  let high = heads.length - 1;
  let found: RoutineHead | undefined;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (heads[middle]!.address <= address) {
      found = heads[middle];
      low = middle + 1;
    } else high = middle - 1;
  }
  if (found === undefined) return undefined;
  return boundaries.some((boundary) => boundary > found.address && boundary <= address) ? undefined : found;
}

/** The edges between routines: each call, jump or table reference from one head's code to another head; a jump inside a routine is no edge. */
export function routineEdges(heads: readonly RoutineHead[], boundaries: readonly number[], references: readonly GraphReference[]): GraphEdge[] {
  const edges = new Map<string, GraphEdge>();
  for (const reference of references) {
    if (reference.kind !== "call" && reference.kind !== "jump" && reference.kind !== "table") continue;
    const from = ownerOf(heads, boundaries, reference.from);
    const to = ownerOf(heads, boundaries, reference.to);
    if (from === undefined || to === undefined || from.address === to.address) continue;
    // A jump into the middle of another routine is an edge to that routine.
    const key = `${from.address}:${to.address}`;
    const edge = edges.get(key);
    if (edge === undefined) edges.set(key, { from: from.address, to: to.address, kind: reference.kind, count: 1 });
    else {
      edge.count++;
      if (STRENGTH[reference.kind] > STRENGTH[edge.kind]) edge.kind = reference.kind;
    }
  }
  return [...edges.values()].sort((a, b) => a.from - b.from || a.to - b.to);
}

const ARROWS: Record<EdgeKind, string> = { call: "-->", table: "==>", jump: "-.->" };

/**
 * A mermaid flowchart of the edges: a node per head with its name and
 * address, a solid arrow for a call, a thick one for a table entry and a
 * dotted one for a jump. The heads in `own` are drawn as rounded nodes.
 */
export function mermaidGraph(heads: readonly RoutineHead[], edges: readonly GraphEdge[], own: ReadonlySet<number> = new Set()): string {
  const used = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  for (const address of own) used.add(address);
  const id = (address: number) => `n${address.toString(16).padStart(4, "0")}`;
  const lines = ["flowchart LR"];
  for (const head of heads) {
    if (!used.has(head.address)) continue;
    const label = `${head.name}<br/>${formatC64Address(head.address).toUpperCase()}`;
    lines.push(own.has(head.address) ? `  ${id(head.address)}("${label}")` : `  ${id(head.address)}["${label}"]`);
  }
  for (const edge of edges) lines.push(`  ${id(edge.from)} ${ARROWS[edge.kind]} ${id(edge.to)}`);
  return lines.join("\n");
}
