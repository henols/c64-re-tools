// A p-code interpreter for integer operations over byte-addressed spaces,
// machine-neutral: it knows no CPU, only the p-code that SLEIGH gives. A value
// that depends on an unknown byte is unknown (undefined). The analysis uses it
// to find the target of an indirect jump from the stores before it; the
// language tests use it to execute one instruction.

import type { PcodeOp, Varnode } from "./wasm.ts";

/** Where an instruction leaves the flow; next is unknown for a computed target that the state does not give. */
export type Exit = { kind: "fall" } | { kind: "branch" | "call" | "return" | "indirect"; next: number | undefined } | { kind: "stop" };

/** Values are kept below 2^48, so sizes up to 6 bytes are exact. */
const MAX_SIZE = 6;

const mask = (size: number) => 2 ** (8 * Math.min(size, MAX_SIZE)) - 1;
/** The value modulo 2^(8 * size), also for a negative value. */
const wrap = (value: number, size: number) => ((value % (mask(size) + 1)) + mask(size) + 1) % (mask(size) + 1);
const signed = (value: number, size: number) => (value >= 2 ** (8 * size - 1) ? value - 2 ** (8 * size) : value);

export class PcodeState {
  /** Space name to byte offset to byte value. */
  private readonly spaces = new Map<string, Map<number, number>>();
  private readonly memory: (address: number) => number | undefined;

  /** memory gives the RAM bytes that no store of this state wrote, or undefined for an unknown byte. */
  constructor(memory: (address: number) => number | undefined = () => undefined) {
    this.memory = memory;
  }

  private bytes(space: string): Map<number, number> {
    let bytes = this.spaces.get(space);
    if (bytes === undefined) this.spaces.set(space, (bytes = new Map()));
    return bytes;
  }

  get(varnode: Varnode): number | undefined {
    if (varnode.space === "const") return varnode.offset & mask(varnode.size);
    const bytes = this.spaces.get(varnode.space);
    let value = 0;
    for (let index = 0; index < varnode.size; index++) {
      const at = varnode.space === "ram" ? (varnode.offset + index) & 0xffff : varnode.offset + index;
      const byte = bytes?.get(at) ?? (varnode.space === "ram" ? this.memory(at) : undefined);
      if (byte === undefined) return undefined;
      value += byte * 2 ** (8 * index);
    }
    return value;
  }

  set(varnode: Varnode, value: number | undefined): void {
    const bytes = this.bytes(varnode.space);
    for (let index = 0; index < varnode.size; index++) {
      const at = varnode.space === "ram" ? (varnode.offset + index) & 0xffff : varnode.offset + index;
      if (value === undefined) bytes.delete(at);
      else bytes.set(at, Math.floor(value / 2 ** (8 * index)) & 0xff);
    }
  }

  /** Forgets every RAM byte: a store through an unknown pointer can change any of them. */
  forgetRam(): void {
    this.spaces.delete("ram");
  }

  /** Forgets every value: after a call, the routine can have changed anything. */
  forget(): void {
    this.spaces.clear();
  }

  /** Runs the p-code of one instruction and tells where the flow goes. */
  run(pcode: readonly PcodeOp[]): Exit {
    for (let index = 0; index < pcode.length; ) {
      const operation = pcode[index]!;
      const inputs = operation.in.map((varnode) => this.get(varnode));
      const [a, b] = inputs;
      const size = operation.out?.size ?? operation.in[0]?.size ?? 1;
      const known = a !== undefined && b !== undefined;
      let out: number | undefined;
      switch (operation.op) {
        case "COPY":
        case "INT_ZEXT":
          out = a;
          break;
        case "INT_SEXT":
          out = a === undefined ? undefined : signed(a, operation.in[0]!.size);
          break;
        case "INT_ADD":
          out = known ? a + b : undefined;
          break;
        case "INT_SUB":
          out = known ? a - b : undefined;
          break;
        case "INT_MULT":
          out = known ? a * b : undefined;
          break;
        case "INT_DIV":
          out = known && b !== 0 ? Math.floor(a / b) : undefined;
          break;
        case "INT_REM":
          out = known && b !== 0 ? a % b : undefined;
          break;
        case "INT_AND":
          out = known ? bitwise(a, b, (x, y) => x & y) : undefined;
          break;
        case "INT_OR":
          out = known ? bitwise(a, b, (x, y) => x | y) : undefined;
          break;
        case "INT_XOR":
          out = known ? bitwise(a, b, (x, y) => x ^ y) : undefined;
          break;
        case "INT_NEGATE":
          out = a === undefined ? undefined : mask(size) - a;
          break;
        case "INT_2COMP":
          out = a === undefined ? undefined : -a;
          break;
        case "INT_LEFT":
          out = known ? (b >= 8 * size ? 0 : a * 2 ** b) : undefined;
          break;
        case "INT_RIGHT":
          out = known ? Math.floor(a / 2 ** b) : undefined;
          break;
        case "INT_SRIGHT":
          out = known ? Math.floor(signed(a, operation.in[0]!.size) / 2 ** b) : undefined;
          break;
        case "INT_EQUAL":
          out = known ? Number(a === b) : undefined;
          break;
        case "INT_NOTEQUAL":
          out = known ? Number(a !== b) : undefined;
          break;
        case "INT_LESS":
          out = known ? Number(a < b) : undefined;
          break;
        case "INT_LESSEQUAL":
          out = known ? Number(a <= b) : undefined;
          break;
        case "INT_SLESS":
          out = known ? Number(signed(a, operation.in[0]!.size) < signed(b, operation.in[1]!.size)) : undefined;
          break;
        case "INT_SLESSEQUAL":
          out = known ? Number(signed(a, operation.in[0]!.size) <= signed(b, operation.in[1]!.size)) : undefined;
          break;
        case "INT_CARRY":
          out = known ? Number(a + b > mask(operation.in[0]!.size)) : undefined;
          break;
        case "INT_SCARRY":
        case "INT_SBORROW": {
          if (!known) break;
          const width = operation.in[0]!.size;
          const result = operation.op === "INT_SCARRY" ? signed(a, width) + signed(b, width) : signed(a, width) - signed(b, width);
          out = Number(result < -(2 ** (8 * width - 1)) || result >= 2 ** (8 * width - 1));
          break;
        }
        case "BOOL_NEGATE":
          out = a === undefined ? undefined : Number(a === 0);
          break;
        case "BOOL_AND":
          out = known ? Number(a !== 0 && b !== 0) : undefined;
          break;
        case "BOOL_OR":
          out = known ? Number(a !== 0 || b !== 0) : undefined;
          break;
        case "BOOL_XOR":
          out = known ? Number((a !== 0) !== (b !== 0)) : undefined;
          break;
        case "PIECE":
          out = known ? a * 2 ** (8 * operation.in[1]!.size) + b : undefined;
          break;
        case "SUBPIECE":
          out = known ? Math.floor(a / 2 ** (8 * b)) : undefined;
          break;
        case "POPCOUNT":
          out = a === undefined ? undefined : [...a.toString(2)].filter((bit) => bit === "1").length;
          break;
        case "LOAD":
          out = b === undefined ? undefined : this.get({ space: "ram", offset: b & 0xffff, size: operation.out!.size });
          break;
        case "STORE":
          if (b === undefined) this.forgetRam();
          else this.set({ space: "ram", offset: b & 0xffff, size: operation.in[2]!.size }, inputs[2]);
          break;
        case "BRANCH":
        case "CBRANCH": {
          const target = operation.in[0]!;
          const taken = operation.op === "BRANCH" ? 1 : b;
          if (taken === undefined) return target.space === "const" ? { kind: "stop" } : { kind: "branch", next: undefined };
          if (taken !== 0) {
            // A const target is a p-code relative branch inside this instruction.
            if (target.space === "const") {
              index += signed(target.offset & mask(target.size), target.size);
              continue;
            }
            return { kind: "branch", next: target.offset };
          }
          break;
        }
        case "BRANCHIND":
          return { kind: "indirect", next: a === undefined ? undefined : a & 0xffff };
        case "CALL":
          return { kind: "call", next: operation.in[0]!.offset };
        case "CALLIND":
          return { kind: "call", next: a === undefined ? undefined : a & 0xffff };
        case "RETURN":
          return { kind: "return", next: a === undefined ? undefined : a & 0xffff };
        case "CALLOTHER":
          // An opaque operation: its result is unknown, and a jam ends the flow at its branch to itself.
          break;
        default:
          break;
      }
      if (operation.out !== null) this.set(operation.out, out === undefined ? undefined : wrap(out, operation.out.size));
      index++;
    }
    return { kind: "fall" };
  }
}

/** A bitwise operation on values that can be wider than the 32 bits of JavaScript's operators. */
function bitwise(a: number, b: number, operation: (x: number, y: number) => number): number {
  const low = operation(a % 2 ** 24, b % 2 ** 24) >>> 0;
  const high = operation(Math.floor(a / 2 ** 24), Math.floor(b / 2 ** 24)) >>> 0;
  return high * 2 ** 24 + (low & 0xffffff);
}
