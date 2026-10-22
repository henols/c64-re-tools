// The analysis from seeds: a recursive descent over the instructions that the
// SLEIGH decoder gives, with flows and references read from their p-code.
// Entry points and call targets are functions; data ranges are never decoded.
// A byte that an operand reads or writes, and that is no code, is data.
// The target of an indirect jump comes from the stores of the straight-line
// code before it, or else from the pointer in the image.

import { SYMBOL_NAME } from "../../c64.ts";
import type { GhidraInstruction, GhidraResult } from "../types.ts";
import { PcodeState } from "./pcode.ts";
import { decode, type Decoded, type Varnode } from "./wasm.ts";

export interface WalkSeeds {
  entryPoints: number[];
  codeStarts: number[];
  dataRanges: Array<{ start: number; end: number }>;
  labels: Array<{ address: number; name: string }>;
}

interface Instruction {
  decoded: Decoded;
  flows: number[];
  fallthrough: boolean;
  references: Array<{ to: number; type: "call" | "jump" | "read" | "write" }>;
  /** The addresses that an operand reads or writes without an index. */
  accessed: number[];
}

/** The longest straight-line run before an indirect jump that gives its target. */
const MAX_CHAIN = 32;

const isRam = (varnode: Varnode) => varnode.space === "ram";

/** The value of the operand bytes after the first byte, little-endian; undefined without operand bytes. */
function operandValue(bytes: readonly number[]): number | undefined {
  if (bytes.length === 2) return bytes[1]!;
  if (bytes.length === 3) return bytes[1]! | (bytes[2]! << 8);
  return undefined;
}

/** Decodes [start, end] from the seeds; the image bytes are already loaded at start. */
export function walk(image: Uint8Array, start: number, end: number, seeds: WalkSeeds): Omit<GhidraResult, "decompilations" | "completeness" | "toolVersion"> {
  const isData = new Uint8Array(0x10000);
  for (const range of seeds.dataRanges) isData.fill(1, range.start, range.end + 1);
  const imageByte = (address: number) => (address >= start && address <= end ? image[address - start] : undefined);

  const instructions = new Map<number, Instruction>();
  /** The start of the instruction that holds each byte, or -1. */
  const owner = new Int32Array(0x10000).fill(-1);
  const functions = new Set(seeds.entryPoints);
  const work = [...seeds.entryPoints, ...seeds.codeStarts];

  while (work.length > 0) {
    const address = work.pop()!;
    if (address < start || address > end || instructions.has(address) || owner[address] !== -1 || isData[address]) continue;
    let decoded: Decoded;
    try {
      decoded = decode(address);
    } catch {
      continue;
    }
    const last = address + decoded.length - 1;
    let free = last <= end;
    for (let at = address; free && at <= last; at++) free = owner[at] === -1 && !isData[at];
    if (!free) continue;

    const instruction: Instruction = { decoded, flows: [], fallthrough: true, references: [], accessed: [] };
    const reference = (to: number, type: Instruction["references"][number]["type"]) => instruction.references.push({ to, type });
    const access = (to: number, type: "read" | "write") => {
      reference(to, type);
      instruction.accessed.push(to);
    };
    const operand = operandValue(decoded.bytes);
    // Unique and register varnodes that hold an operand address plus an index.
    const indexed = new Map<string, number>();
    const key = (varnode: Varnode) => `${varnode.space}:${varnode.offset}`;
    const jams = decoded.pcode.some((operation) => operation.op === "CALLOTHER");
    for (const operation of decoded.pcode) {
      const [first, second] = operation.in;
      switch (operation.op) {
        case "BRANCH":
        case "CBRANCH":
          if (isRam(first!)) {
            // A jam branches to itself: the flow ends there.
            if (first!.offset === address && operation.op === "BRANCH" && jams) instruction.fallthrough = false;
            else {
              instruction.flows.push(first!.offset);
              reference(first!.offset, "jump");
              if (operation.op === "BRANCH") instruction.fallthrough = false;
            }
          }
          break;
        case "CALL":
          if (isRam(first!)) {
            instruction.flows.push(first!.offset);
            reference(first!.offset, "call");
            functions.add(first!.offset);
          }
          break;
        case "RETURN":
          instruction.fallthrough = false;
          break;
        case "BRANCHIND": {
          instruction.fallthrough = false;
          const target = indirectTarget(address, decoded, instructions, owner, imageByte);
          if (target !== undefined) {
            instruction.flows.push(target);
            reference(target, "jump");
          }
          break;
        }
        case "LOAD":
        case "STORE": {
          const type = operation.op === "LOAD" ? "read" : "write";
          if (second!.space === "const") access(second!.offset & 0xffff, type);
          else if (indexed.has(key(second!))) reference(indexed.get(key(second!))!, type);
          break;
        }
        case "INT_ADD": {
          // An address operand plus an index register: the reference goes to the operand address.
          const constant = operation.in.find((varnode) => varnode.space === "const");
          if (operation.out !== null && constant !== undefined && constant.offset === operand) indexed.set(key(operation.out), operand);
          break;
        }
        case "COPY":
        case "INT_ZEXT":
        case "INT_AND":
          if (operation.out !== null && first !== undefined && indexed.has(key(first))) indexed.set(key(operation.out), indexed.get(key(first))!);
          break;
      }
      if (!["BRANCH", "CBRANCH", "CALL", "LOAD", "STORE"].includes(operation.op)) {
        for (const input of operation.in) if (isRam(input)) access(input.offset, "read");
        if (operation.out !== null && isRam(operation.out)) access(operation.out.offset, "write");
      }
    }
    owner.fill(address, address, last + 1);
    instructions.set(address, instruction);
    for (const flow of instruction.flows) work.push(flow);
    // Last in, first out: the next instruction is decoded first, so the code before an indirect jump is known.
    if (instruction.fallthrough) work.push(last + 1);
  }

  for (const instruction of instructions.values()) {
    for (const address of instruction.accessed) if (address >= start && address <= end && owner[address] === -1) isData[address] = 1;
  }

  const labels = new Map(seeds.labels.map((label) => [label.address, label.name]));
  const sorted = [...instructions.keys()].sort((a, b) => a - b);
  const seen = new Set<string>();
  const references: GhidraResult["references"] = [];
  for (const from of sorted) {
    for (const { to, type } of instructions.get(from)!.references) {
      const id = `${from}:${to}:${type}`;
      if (seen.has(id)) continue;
      seen.add(id);
      references.push({ from, to, type });
    }
  }
  return {
    coverage: [{ start, end }],
    functions: [...functions]
      .filter((entry) => instructions.has(entry))
      .sort((a, b) => a - b)
      .map((entry) => {
        const name = labels.get(entry);
        return name !== undefined && SYMBOL_NAME.test(name) ? { entry, name, nameSource: "seed" as const } : { entry, name: `FUN_${hex4(entry)}`, nameSource: "generated" as const };
      }),
    regions: regions(start, end, (address) => (owner[address] !== -1 ? "code" : isData[address] ? "data" : undefined)),
    references,
    instructions: sorted.map((address): GhidraInstruction => {
      const { decoded, flows } = instructions.get(address)!;
      return { address, bytes: decoded.bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(""), mnemonic: decoded.mnemonic.toLowerCase(), operands: decoded.operands, flows };
    }),
  };
}

/** The target of the indirect jump at address, or undefined; a zero pointer is no target. */
function indirectTarget(address: number, decoded: Decoded, instructions: Map<number, Instruction>, owner: Int32Array, imageByte: (address: number) => number | undefined): number | undefined {
  const chain: Decoded[] = [];
  for (let at = address; chain.length < MAX_CHAIN && at > 0; ) {
    const previous = owner[at - 1]!;
    const instruction = previous === -1 ? undefined : instructions.get(previous);
    if (instruction === undefined || !instruction.fallthrough) break;
    chain.unshift(instruction.decoded);
    at = previous;
  }
  const state = new PcodeState(imageByte);
  for (const instruction of chain) if (state.run(instruction.pcode).kind === "call") state.forget();
  const exit = state.run(decoded.pcode);
  return exit.kind === "indirect" && exit.next !== undefined && exit.next !== 0 ? exit.next : undefined;
}

function regions(start: number, end: number, kind: (address: number) => "code" | "data" | undefined): GhidraResult["regions"] {
  const result: GhidraResult["regions"] = [];
  for (let address = start; address <= end; address++) {
    const classification = kind(address);
    if (classification === undefined) continue;
    const previous = result.at(-1);
    if (previous !== undefined && previous.classification === classification && previous.end === address - 1) previous.end = address;
    else result.push({ start: address, end: address, classification });
  }
  return result;
}

const hex4 = (value: number) => value.toString(16).padStart(4, "0");
