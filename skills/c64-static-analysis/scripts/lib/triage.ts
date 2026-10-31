// The facts that decide a disagreement of code and data in a range: what the
// runs did there, the references into it, and whether static flow from code
// that a run executed reaches it, also through branches that no run took.

import { COVERAGE, instructionLength } from "#src/c64.ts";
import { computedFlows, NO_FALL_THROUGH } from "#src/knowledge/separate.ts";
import { isSemantic, type ReferenceKind } from "#src/knowledge/schema.ts";
import { OPCODES } from "#src/opcodes.ts";

export interface FlowInput {
  /** 64 KiB with the program bytes at their addresses. */
  memory: Uint8Array;
  inImage: (address: number) => boolean;
  /** The joined coverage of the knowledge: its executed instruction starts are the roots. */
  coverage: Uint8Array;
  /** The references of the knowledge. A jump or call of the user, the LLM or the idiom pass is a flow. */
  references: ReadonlyArray<{ from: number; to: number; kind: string; origin?: string | undefined }>;
  /** True for an address in data of the user or the LLM: a flow goes into it and ends there. */
  isData: (address: number) => boolean;
  /** True for a reference that the user or the LLM removed: the flow does not go there. */
  removedReference: (reference: { from: number; to: number; kind: ReferenceKind }) => boolean;
}

/**
 * The addresses that static flow from executed code goes to: the instruction
 * starts that a run executed, and from each instruction that the flow
 * decodes, the run on to the next instruction, a branch target, a JMP or JSR
 * target, a jump or call reference of the user, the LLM or the idiom pass,
 * and the computed flows that the bytes of the program resolve (as for the
 * reachability of the code regions). A JMP or JSR whose address bytes a run
 * wrote goes only where the computed flows go. A flow outside the program or
 * into data of the user or the LLM ends there, and a flow whose jump or call
 * reference the user or the LLM removed does not go.
 */
export function flowFromExecuted(input: FlowInput): Set<number> {
  const { memory, coverage } = input;
  const follow = new Map<number, number[]>();
  for (const reference of input.references) {
    if ((reference.kind !== "jump" && reference.kind !== "call") || !(isSemantic(reference.origin) || reference.origin === "heuristic")) continue;
    follow.set(reference.from, [...(follow.get(reference.from) ?? []), reference.to]);
  }
  const written = (address: number) => (coverage[address & 0xffff]! & COVERAGE.ramWrite) !== 0;
  const entered = new Set<number>();
  const decoded = new Set<number>();
  const queue: number[] = [];
  const removed = (from: number, to: number) => input.removedReference({ from, to, kind: "jump" }) || input.removedReference({ from, to, kind: "call" });
  const enter = (to: number, from?: number) => {
    const address = to & 0xffff;
    if (entered.has(address) || (from !== undefined && removed(from, address))) return;
    entered.add(address);
    if (input.inImage(address) && !input.isData(address)) queue.push(address);
  };
  const walk = () => {
    while (queue.length > 0) {
      const at = queue.pop()!;
      if (decoded.has(at)) continue;
      decoded.add(at);
      const opcode = memory[at]!;
      if (!NO_FALL_THROUGH.has(opcode)) enter(at + instructionLength(opcode));
      if (OPCODES[opcode]!.mode === "rel") {
        const offset = memory[(at + 1) & 0xffff]!;
        enter(at + 2 + (offset < 0x80 ? offset : offset - 0x100), at);
      }
      if ((opcode === 0x4c || opcode === 0x20) && !written(at + 1) && !written(at + 2)) enter(memory[(at + 1) & 0xffff]! | (memory[(at + 2) & 0xffff]! << 8), at);
      for (const to of follow.get(at) ?? []) enter(to);
    }
  };
  for (let address = 0; address < 0x10000; address++) if ((coverage[address]! & COVERAGE.ramExecute) !== 0 && input.inImage(address)) enter(address);
  walk();
  // The computed flows read the stores of all decoded code: new code can resolve more of them.
  for (;;) {
    const before = entered.size;
    for (const flow of computedFlows({ starts: [...decoded], memory, inImage: input.inImage, coverage, references: input.references }).targets) if (decoded.has(flow.from)) enter(flow.to, flow.from);
    if (entered.size === before) return entered;
    walk();
  }
}

/** The facts of one range in disagreement. */
export interface RangeFacts {
  /** With coverage: the executed instruction starts, and the bytes that a run read and wrote, in the range. */
  access?: { executed: number; read: number; written: number };
  /** The references of the knowledge into the range from outside it, one for each source and kind. */
  references: Array<{ from: number; kind: ReferenceKind }>;
  /** With coverage: true when static flow from executed code goes into the range. */
  reachable?: boolean;
}

/** The facts of each range, read from the coverage, the references of the knowledge and the flow from executed code. */
export function rangeFacts(coverage: Uint8Array | undefined, references: ReadonlyArray<{ from: number; to: number; kind: ReferenceKind }>, flow: Set<number> | undefined): (range: { start: number; end: number }) => RangeFacts {
  return ({ start, end }) => {
    const inside = (address: number) => address >= start && address <= end;
    const into = new Map<string, { from: number; kind: ReferenceKind }>();
    for (const reference of references) if (inside(reference.to) && !inside(reference.from)) into.set(`${reference.from}|${reference.kind}`, { from: reference.from, kind: reference.kind });
    const facts: RangeFacts = { references: [...into.values()].sort((a, b) => a.from - b.from || a.kind.localeCompare(b.kind)) };
    if (coverage !== undefined) {
      const access = { executed: 0, read: 0, written: 0 };
      for (let address = start; address <= end; address++) {
        if ((coverage[address]! & COVERAGE.ramExecute) !== 0) access.executed++;
        if ((coverage[address]! & COVERAGE.ramRead) !== 0) access.read++;
        if ((coverage[address]! & COVERAGE.ramWrite) !== 0) access.written++;
      }
      facts.access = access;
    }
    if (flow !== undefined) {
      let reachable = false;
      for (let address = start; address <= end && !reachable; address++) reachable = flow.has(address);
      facts.reachable = reachable;
    }
    return facts;
  };
}
