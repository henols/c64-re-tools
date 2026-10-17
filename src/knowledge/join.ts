// Joins the batches of agents that worked in parallel, each on its own range
// of addresses, into one batch for apply. The owner of an address is
// the batch whose range holds it: its name, comment, operand and module win
// there; at an address that no batch owns, the first batch in the order given
// wins. A name that a batch gave to an address, and that the join replaced
// with the name of another batch, is replaced in that batch's operand
// expressions and macro args too. The join writes no knowledge.

import { replaceIdentifiers } from "./expression.ts";
import type { BatchOperation } from "./write.ts";

export interface Batch {
  /** The file the batch came from, for the report. */
  file: string;
  /** The range of addresses that the batch owns. */
  owner?: { start: number; end: number };
  ops: BatchOperation[];
}

/** One place where batches gave different values: the value that stays, and the batches whose value the join left out. */
export interface JoinChoice {
  what: "name" | "comment" | "operand" | "module" | "macro";
  space: string;
  /** The address, or for a macro its name. */
  at: number | string;
  kept: { file: string; value: string };
  left: Array<{ file: string; value: string }>;
}

/** A clash that the join cannot decide: one name, or one module file, at two addresses. */
export interface JoinClash {
  what: "name" | "file";
  value: string;
  space: string;
  places: Array<{ address: number; file: string }>;
}

export interface JoinResult {
  ops: BatchOperation[];
  choices: JoinChoice[];
  clashes: JoinClash[];
  /** Writes that were the same in more than one batch, and that the join wrote once. */
  repeated: number;
}

type Op<K extends BatchOperation["op"]> = Extract<BatchOperation, { op: K }>;
const spaceOf = (op: { space?: string }) => op.space ?? "c64";

/** The value of a keyed write as text, to compare and report it. */
function valueOf(op: BatchOperation): string {
  switch (op.op) {
    case "rename":
      return op.kind === undefined ? op.name : `${op.name} (${op.kind})`;
    case "comment":
      return op.text;
    case "operand":
      return op.expression ?? `${op.select} ${op.symbol ?? ""}${op.offset === undefined || op.offset === 0 ? "" : op.offset > 0 ? `+${op.offset}` : op.offset}`;
    case "module":
      return op.title === undefined ? op.file : `${op.file} (${op.title})`;
    case "macro":
      return `${op.name}(${(op.params ?? []).join(", ")})`;
    default:
      return JSON.stringify(op);
  }
}

export function joinBatches(batches: readonly Batch[]): JoinResult {
  const owns = (batch: Batch, address: number) => batch.owner !== undefined && address >= batch.owner.start && address <= batch.owner.end;
  const choices: JoinChoice[] = [];
  const clashes: JoinClash[] = [];

  /** For each key, the write that stays: the owner's last write, else the first batch's last write. */
  function choose<K extends "rename" | "comment" | "operand" | "module" | "macro">(op: K, what: JoinChoice["what"], keyOf: (write: Op<K>) => string, at: (write: Op<K>) => number | string) {
    const all = new Map<string, Array<{ batch: Batch; write: Op<K> }>>();
    for (const batch of batches) {
      for (const write of batch.ops) {
        if (write.op !== op) continue;
        const key = keyOf(write as Op<K>);
        all.set(key, [...(all.get(key) ?? []), { batch, write: write as Op<K> }]);
      }
    }
    const kept = new Map<string, { batch: Batch; write: Op<K> }>();
    for (const [key, candidates] of all) {
      const place = at(candidates[0]!.write);
      const owner = typeof place === "number" ? candidates.filter((candidate) => owns(candidate.batch, place)) : [];
      // A batch can write a place twice; its last write counts, as in apply.
      const pick = (owner.length > 0 ? owner : candidates.filter((candidate) => candidate.batch === candidates[0]!.batch)).at(-1)!;
      kept.set(key, pick);
      const left = candidates.filter((candidate) => candidate.batch !== pick.batch && valueOf(candidate.write) !== valueOf(pick.write));
      const distinct = [...new Map(left.map((candidate) => [`${candidate.batch.file}|${valueOf(candidate.write)}`, candidate])).values()];
      if (distinct.length > 0) {
        choices.push({
          what,
          space: spaceOf(pick.write),
          at: place,
          kept: { file: pick.batch.file, value: valueOf(pick.write) },
          left: distinct.map((candidate) => ({ file: candidate.batch.file, value: valueOf(candidate.write) })),
        });
      }
    }
    return kept;
  }

  const names = choose("rename", "name", (write) => `${spaceOf(write)}|${write.address}`, (write) => write.address);
  // Name clashes: one name for two addresses after the choice.
  const byName = new Map<string, Array<{ address: number; file: string }>>();
  for (const { batch, write } of names.values()) {
    const key = `${spaceOf(write)}|${write.name}`;
    byName.set(key, [...(byName.get(key) ?? []), { address: write.address, file: batch.file }]);
  }
  for (const [key, places] of byName) {
    if (places.length > 1) clashes.push({ what: "name", value: key.split("|")[1]!, space: key.split("|")[0]!, places: places.sort((a, b) => a.address - b.address) });
  }
  // A name that a batch gave and the join replaced: each batch's names follow the join's names.
  const finalName = new Map<string, string>();
  for (const write of names.values()) finalName.set(`${spaceOf(write.write)}|${write.write.address}`, write.write.name);
  const renamedIn = new Map<Batch, Map<string, string>>();
  for (const batch of batches) {
    const map = new Map<string, string>();
    for (const write of batch.ops) {
      if (write.op !== "rename") continue;
      const now = finalName.get(`${spaceOf(write)}|${write.address}`);
      if (now !== undefined && now !== write.name) map.set(`${spaceOf(write)}|${write.name}`, now);
    }
    renamedIn.set(batch, map);
  }
  const follow = (batch: Batch, space: string, text: string) => {
    const map = renamedIn.get(batch)!;
    if (map.size === 0) return text;
    try {
      return replaceIdentifiers(text, (name) => map.get(`${space}|${name}`) ?? name);
    } catch {
      // Text that is no expression stays as the batch wrote it; apply refuses it then.
      return text;
    }
  };

  const comments = choose("comment", "comment", (write) => `${spaceOf(write)}|${write.address}|${write.placement}`, (write) => write.address);
  const operands = choose("operand", "operand", (write) => `${spaceOf(write)}|${write.address}`, (write) => write.address);
  const modules = choose("module", "module", (write) => `${spaceOf(write)}|${write.start}`, (write) => write.start);
  const macros = choose("macro", "macro", (write) => `${spaceOf(write)}|${write.name}`, (write) => write.name);
  const byFile = new Map<string, Array<{ address: number; file: string }>>();
  for (const { batch, write } of modules.values()) {
    const key = `${spaceOf(write)}|${write.file}`;
    byFile.set(key, [...(byFile.get(key) ?? []), { address: write.start, file: batch.file }]);
  }
  for (const [key, places] of byFile) {
    if (places.length > 1) clashes.push({ what: "file", value: key.split("|")[1]!, space: key.split("|")[0]!, places: places.sort((a, b) => a.address - b.address) });
  }

  // The order of the joined batch: removals, the regions of other batches and then the owner's (a later classify wins
  // where they overlap), the names, the comments, the modules, the references, the macros, then the writes that use names.
  let repeated = 0;
  const seen = new Set<string>();
  const once = (write: BatchOperation) => {
    const key = JSON.stringify(write);
    if (seen.has(key)) {
      repeated++;
      return false;
    }
    seen.add(key);
    return true;
  };
  const named = new Set([...names.values()].map(({ write }) => `${spaceOf(write)}|${write.address}`));
  const removals: BatchOperation[] = [];
  const foreignRegions: BatchOperation[] = [];
  const ownRegions: BatchOperation[] = [];
  const references: BatchOperation[] = [];
  const rest: BatchOperation[] = [];
  for (const batch of batches) {
    for (const write of batch.ops) {
      switch (write.op) {
        case "remove-symbol":
          // A name from any batch wins over a removal at the same address.
          if (!named.has(`${spaceOf(write)}|${write.address}`) && once(write)) removals.push(write);
          break;
        case "classify":
        case "unclassify":
          if (once(write)) (owns(batch, write.start) ? ownRegions : foreignRegions).push(write);
          break;
        case "reference":
        case "unreference":
          if (once(write)) references.push(write);
          break;
        case "rename":
        case "comment":
        case "operand":
        case "module":
        case "macro":
          break;
        case "use":
          if (once(write)) rest.push({ ...write, args: (write.args ?? []).map((arg) => follow(batch, spaceOf(write), arg)) });
          break;
        default:
          if (once(write)) rest.push(write);
      }
    }
  }
  const kept = <T extends { batch: Batch; write: BatchOperation }>(map: Map<string, T>) => [...map.values()].map(({ write }) => write);
  const operandWrites = [...operands.values()].map(({ batch, write }) => ({
    ...write,
    ...(write.symbol === undefined ? {} : { symbol: follow(batch, spaceOf(write), write.symbol) }),
    ...(write.expression === undefined ? {} : { expression: follow(batch, spaceOf(write), write.expression) }),
  }));
  return {
    ops: [...removals, ...foreignRegions, ...ownRegions, ...kept(names), ...kept(comments), ...kept(modules), ...references, ...kept(macros), ...operandWrites, ...rest],
    choices,
    clashes,
    repeated,
  };
}
