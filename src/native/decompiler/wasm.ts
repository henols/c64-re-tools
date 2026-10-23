// The Ghidra SLEIGH decoder and decompiler for the c64-re-tools 6510
// language, as a WebAssembly module (built from native/sleigh/). It has no imports and holds one program image at a time.
// A panic in the module traps: the instance is then dropped and the next
// load makes a new one.

import { Refusal } from "../../errors.ts";
import { C64RT_WASM } from "./c64rt-wasm.ts";

/** The decoder and decompiler, as a result names its tool. */
export const SLEIGH_VERSION = "ghidra-decompiler 2.1.0";

export interface Varnode {
  /** "ram", "const", "register" or "unique". */
  space: string;
  offset: number;
  size: number;
}

export interface PcodeOp {
  /** Ghidra's name of the operation, for example "INT_ADD" or "CBRANCH". */
  op: string;
  out: Varnode | null;
  in: Varnode[];
  /** The name of a CALLOTHER operation, for example "jam". */
  userop?: string | null;
}

export interface Decoded {
  length: number;
  bytes: number[];
  mnemonic: string;
  operands: string;
  pcode: PcodeOp[];
}

interface Exports {
  memory: WebAssembly.Memory;
  alloc(length: number): number;
  out_ptr(): number;
  load(image: number, length: number, base: number): number;
  decode(address: number): number;
  name(address: number, text: number, length: number, kind: number): number;
  decompile(address: number): number;
}

const utf8 = new TextDecoder();

let module: WebAssembly.Module | undefined;
let instance: Exports | undefined;

function exports(): Exports {
  module ??= new WebAssembly.Module(Buffer.from(C64RT_WASM, "base64"));
  instance ??= new WebAssembly.Instance(module, {}).exports as unknown as Exports;
  return instance;
}

/** Runs one call; a trap drops the instance, and the reply's error becomes a Refusal. */
function call<T>(run: (wasm: Exports) => number): T {
  const wasm = exports();
  let length: number;
  try {
    length = run(wasm);
  } catch (error) {
    instance = undefined;
    throw new Refusal("operation-failed", `the decompiler stopped: ${error instanceof Error ? error.message : String(error)}`);
  }
  const reply = JSON.parse(utf8.decode(new Uint8Array(wasm.memory.buffer, wasm.out_ptr(), length))) as T & { error?: string };
  if (reply.error !== undefined) throw new Refusal("operation-failed", reply.error);
  return reply;
}

/** Copies bytes into a buffer of the module, which the called function takes. */
function put(wasm: Exports, bytes: Uint8Array): number {
  const pointer = wasm.alloc(bytes.length);
  new Uint8Array(wasm.memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
}

/** The program image that decode, name and decompile work on: the bytes at base. */
export function loadImage(bytes: Uint8Array, base: number): void {
  call((wasm) => wasm.load(put(wasm, bytes), bytes.length, base));
}

/** The instruction at an address of the loaded image. */
export function decode(address: number): Decoded {
  return call((wasm) => wasm.decode(address));
}

/** Gives the decompiler the name of a routine or of a data address. */
export function setName(address: number, name: string, kind: "function" | "data"): void {
  const text = new TextEncoder().encode(name);
  call((wasm) => wasm.name(address, put(wasm, text), text.length, kind === "function" ? 0 : 1));
}

/** The C text of the routine at an address. */
export function decompile(address: number): string {
  return call<{ text: string }>((wasm) => wasm.decompile(address)).text;
}
