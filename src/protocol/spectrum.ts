// The ZX Spectrum session operations of the Host Runtime wire: their
// vocabulary, shapes and parameter checks. The host runs them on ZEsarUX.

import { invalid, isInteger, isObject, isOneOf, onlyFields } from "./messages.ts";

export const SPECTRUM_RUN_STATES = ["running", "stopped"] as const;
export type SpectrumRunState = (typeof SPECTRUM_RUN_STATES)[number];

export const SPECTRUM_MAX_MEMORY_READ = 4096;
export const SPECTRUM_MAX_MEMORY_WRITE = 4096;
export const SPECTRUM_MAX_DISASSEMBLE = 256;
export const SPECTRUM_MAX_HISTORY = 1000;
export const SPECTRUM_MAX_FRAMES = 3000;
export const SPECTRUM_MAX_STEPS = 10_000;
export const SPECTRUM_MAX_TEXT = 256;

/** Why the CPU stopped: a breakpoint, a watchpoint, the frame count of a run, or the end of a run_until. */
export const SPECTRUM_STOP_REASONS = ["breakpoint", "watchpoint", "frames", "steps", "target", "timeout", "pause"] as const;
export type SpectrumStopReason = (typeof SPECTRUM_STOP_REASONS)[number];

export interface Z80RegisterValues {
  pc: number;
  sp: number;
  af: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  iy: number;
  af2: number;
  bc2: number;
  de2: number;
  hl2: number;
  i: number;
  r: number;
  im: number;
  iff1: boolean;
  iff2: boolean;
}

/** The register names that registersSet takes: the 16-bit pairs and I and R. */
export const Z80_WRITABLE = ["pc", "sp", "af", "bc", "de", "hl", "ix", "iy", "af2", "bc2", "de2", "hl2", "i", "r"] as const;
export type Z80Writable = (typeof Z80_WRITABLE)[number];

export interface SpectrumStatus {
  state: SpectrumRunState;
  model: "48k" | "128k";
  /** The PC when the CPU is stopped. */
  pc?: number;
  stopReason?: SpectrumStopReason;
  pointId?: number;
}

export interface SpectrumStop {
  state: SpectrumRunState;
  /** The PC where the CPU stopped; none while it runs. */
  pc?: number;
  stopReason?: SpectrumStopReason;
  pointId?: number;
  /** The t-states since the last timing start. */
  tstates?: number;
}

export interface SpectrumPoint {
  id: number;
  kind: "breakpoint" | "watchpoint";
  start: number;
  end: number;
  access?: "read" | "write" | "both";
  enabled: boolean;
}

export interface SpectrumInstruction {
  address: number;
  bytes: string;
  text: string;
}

export interface SpectrumUla {
  border: number;
  /** The last value written to port $7ffd (128K); undefined on the 48K. */
  port7ffd?: number;
  /** The RAM bank at $c000 (128K). */
  pagedBank?: number;
  /** The RAM bank that the ULA shows: 5 or 7 (128K). */
  screenBank?: number;
  /** The ROM at $0000 (128K): 0 or 1. */
  rom?: number;
  /** True when the 128K paging is locked until a reset. */
  pagingLocked?: boolean;
}

export interface SpectrumOperations {
  status: { params: Record<string, never>; result: SpectrumStatus };
  reset: { params: { run: boolean }; result: SpectrumStop };
  execution: { params: { action: "pause" | "resume" | "step" | "advance-frames"; count?: number }; result: SpectrumStop };
  runUntil: { params: { address: number; timeoutFrames: number }; result: SpectrumStop & { reached: boolean } };
  breakpoint: { params: { action: "add"; address: number } | { action: "remove"; id: number } | { action: "list" }; result: { points: SpectrumPoint[] } };
  watchpoint: { params: { action: "add"; start: number; end: number; access: "read" | "write" | "both" } | { action: "remove"; id: number } | { action: "list" }; result: { points: SpectrumPoint[] } };
  memoryRead: { params: { address: number; size: number }; result: { address: number; data: string } };
  memoryWrite: { params: { address: number; data: string }; result: { address: number; bytesWritten: number } };
  registersGet: { params: Record<string, never>; result: Z80RegisterValues };
  registersSet: { params: { values: Partial<Record<Z80Writable, number>> }; result: Z80RegisterValues };
  disassemble: { params: { address: number; count: number }; result: { instructions: SpectrumInstruction[] } };
  cpuHistory: { params: { count: number }; result: { pcs: number[] } };
  memmap: { params: { action: "clear" | "read" }; result: { cleared?: boolean; ranges?: Array<{ start: number; end: number; flags: number }> } };
  screen: { params: Record<string, never>; result: { width: number; height: number } };
  keyboard: { params: { text: string }; result: { typed: number } };
  keys: { params: { keys: string[]; frames: number }; result: SpectrumStop };
  joystick: { params: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }; result: { set: boolean } };
  autostart: { params: { type: "tap" | "tzx" | "z80" | "sna" | "zsf" }; result: SpectrumStop };
  programLoad: { params: { address: number }; result: { address: number; size: number } };
  snapshot: { params: { action: "save" | "restore" | "remove"; name: string } | { action: "list" }; result: { names: string[] } };
  snapshotExport: { params: Record<string, never>; result: { bytes: number } };
  timing: { params: { action: "start" | "read" }; result: { tstates: number } };
  ula: { params: Record<string, never>; result: SpectrumUla };
  ay: { params: Record<string, never>; result: { selected: number; registers: number[] } };
}
export type SpectrumOperation = keyof SpectrumOperations;

export const SPECTRUM_OPERATIONS = [
  "status",
  "reset",
  "execution",
  "runUntil",
  "breakpoint",
  "watchpoint",
  "memoryRead",
  "memoryWrite",
  "registersGet",
  "registersSet",
  "disassemble",
  "cpuHistory",
  "memmap",
  "screen",
  "keyboard",
  "keys",
  "joystick",
  "autostart",
  "programLoad",
  "snapshot",
  "snapshotExport",
  "timing",
  "ula",
  "ay",
] as const satisfies readonly SpectrumOperation[];

/** The file attachments that an operation takes: the media of autostart and the bytes of programLoad. */
export function spectrumAttachmentCount(op: SpectrumOperation): number {
  return op === "autostart" || op === "programLoad" ? 1 : 0;
}

const address = (value: unknown, what: string) => {
  if (!isInteger(value, 0, 0xffff)) invalid(`${what} must be an address from $0000 to $ffff`);
  return value;
};
const NAME = /^[A-Za-z0-9._-]{1,64}$/;
const name = (value: unknown) => {
  if (typeof value !== "string" || !NAME.test(value)) invalid("name must be 1 to 64 letters, digits, dots, underscores or hyphens");
  return value;
};
const bool = (value: unknown, what: string) => {
  if (value !== undefined && typeof value !== "boolean") invalid(`${what} must be true or false`);
  return value === true;
};

/** Checks the params of an operation; throws WireFailure invalid-input for bad ones. */
export function validateSpectrumParams<O extends SpectrumOperation>(op: O, params: unknown): SpectrumOperations[O]["params"] {
  if (!isObject(params)) invalid("parameters must be an object");
  const as = (value: unknown) => value as SpectrumOperations[O]["params"];
  switch (op) {
    case "status":
    case "registersGet":
    case "screen":
    case "snapshotExport":
    case "ula":
    case "ay":
      onlyFields(params, []);
      return as({});
    case "reset":
      onlyFields(params, ["run"]);
      return as({ run: bool(params.run, "run") });
    case "execution": {
      onlyFields(params, ["action", "count"]);
      if (!isOneOf(["pause", "resume", "step", "advance-frames"] as const, params.action)) invalid("action must be pause, resume, step or advance-frames");
      if (params.action === "step" || params.action === "advance-frames") {
        const max = params.action === "step" ? SPECTRUM_MAX_STEPS : SPECTRUM_MAX_FRAMES;
        if (params.count !== undefined && !isInteger(params.count, 1, max)) invalid(`count must be 1 to ${max}`);
        return as({ action: params.action, count: params.count ?? 1 });
      }
      return as({ action: params.action });
    }
    case "runUntil":
      onlyFields(params, ["address", "timeoutFrames"]);
      if (!isInteger(params.timeoutFrames, 1, SPECTRUM_MAX_FRAMES)) invalid(`timeoutFrames must be 1 to ${SPECTRUM_MAX_FRAMES}`);
      return as({ address: address(params.address, "address"), timeoutFrames: params.timeoutFrames });
    case "breakpoint":
    case "watchpoint": {
      if (params.action === "list") {
        onlyFields(params, ["action"]);
        return as({ action: "list" });
      }
      if (params.action === "remove") {
        onlyFields(params, ["action", "id"]);
        if (!isInteger(params.id, 1, 100)) invalid("id must be 1 to 100");
        return as({ action: "remove", id: params.id });
      }
      if (params.action !== "add") invalid("action must be add, remove or list");
      if (op === "breakpoint") {
        onlyFields(params, ["action", "address"]);
        return as({ action: "add", address: address(params.address, "address") });
      }
      onlyFields(params, ["action", "start", "end", "access"]);
      const start = address(params.start, "start");
      const end = address(params.end ?? params.start, "end");
      if (end < start) invalid("end must not be before start");
      if (!isOneOf(["read", "write", "both"] as const, params.access)) invalid("access must be read, write or both");
      return as({ action: "add", start, end, access: params.access });
    }
    case "memoryRead": {
      onlyFields(params, ["address", "size"]);
      const start = address(params.address, "address");
      if (!isInteger(params.size, 1, SPECTRUM_MAX_MEMORY_READ)) invalid(`size must be 1 to ${SPECTRUM_MAX_MEMORY_READ}`);
      if (start + params.size > 0x10000) invalid("the range must not go past $ffff");
      return as({ address: start, size: params.size });
    }
    case "memoryWrite": {
      onlyFields(params, ["address", "data"]);
      const start = address(params.address, "address");
      if (typeof params.data !== "string" || !/^(?:[0-9a-f]{2})+$/.test(params.data) || params.data.length / 2 > SPECTRUM_MAX_MEMORY_WRITE) {
        invalid(`data must be 1 to ${SPECTRUM_MAX_MEMORY_WRITE} bytes as lowercase hex`);
      }
      if (start + params.data.length / 2 > 0x10000) invalid("the range must not go past $ffff");
      return as({ address: start, data: params.data });
    }
    case "registersSet": {
      onlyFields(params, ["values"]);
      if (!isObject(params.values) || Object.keys(params.values).length === 0) invalid("values must name at least one register");
      for (const [register, value] of Object.entries(params.values)) {
        if (!isOneOf(Z80_WRITABLE, register)) invalid(`${register} is not a register that a write takes: ${Z80_WRITABLE.join(", ")}`);
        const max = register === "i" || register === "r" ? 0xff : 0xffff;
        if (!isInteger(value, 0, max)) invalid(`${register} must be 0 to ${max}`);
      }
      return as({ values: params.values });
    }
    case "disassemble":
      onlyFields(params, ["address", "count"]);
      if (!isInteger(params.count, 1, SPECTRUM_MAX_DISASSEMBLE)) invalid(`count must be 1 to ${SPECTRUM_MAX_DISASSEMBLE}`);
      return as({ address: address(params.address, "address"), count: params.count });
    case "cpuHistory":
      onlyFields(params, ["count"]);
      if (!isInteger(params.count, 1, SPECTRUM_MAX_HISTORY)) invalid(`count must be 1 to ${SPECTRUM_MAX_HISTORY}`);
      return as({ count: params.count });
    case "memmap":
      onlyFields(params, ["action"]);
      if (!isOneOf(["clear", "read"] as const, params.action)) invalid("action must be clear or read");
      return as({ action: params.action });
    case "keyboard":
      onlyFields(params, ["text"]);
      if (typeof params.text !== "string" || params.text.length === 0 || params.text.length > SPECTRUM_MAX_TEXT || !/^[\x20-\x7e\n]+$/.test(params.text)) {
        invalid(`text must be 1 to ${SPECTRUM_MAX_TEXT} printable ASCII characters or newlines`);
      }
      return as({ text: params.text });
    case "keys":
      onlyFields(params, ["keys", "frames"]);
      if (!Array.isArray(params.keys) || params.keys.length === 0 || params.keys.length > 8 || !params.keys.every((key) => typeof key === "string")) invalid("keys must name 1 to 8 keys");
      if (!isInteger(params.frames, 1, SPECTRUM_MAX_FRAMES)) invalid(`frames must be 1 to ${SPECTRUM_MAX_FRAMES}`);
      return as({ keys: params.keys, frames: params.frames });
    case "joystick":
      onlyFields(params, ["up", "down", "left", "right", "fire"]);
      return as({ up: bool(params.up, "up"), down: bool(params.down, "down"), left: bool(params.left, "left"), right: bool(params.right, "right"), fire: bool(params.fire, "fire") });
    case "autostart":
      onlyFields(params, ["type"]);
      if (!isOneOf(["tap", "tzx", "z80", "sna", "zsf"] as const, params.type)) invalid("type must be tap, tzx, z80, sna or zsf");
      return as({ type: params.type });
    case "programLoad":
      onlyFields(params, ["address"]);
      return as({ address: address(params.address, "address") });
    case "snapshot":
      if (params.action === "list") {
        onlyFields(params, ["action"]);
        return as({ action: "list" });
      }
      onlyFields(params, ["action", "name"]);
      if (!isOneOf(["save", "restore", "remove"] as const, params.action)) invalid("action must be save, restore, remove or list");
      return as({ action: params.action, name: name(params.name) });
    case "timing":
      onlyFields(params, ["action"]);
      if (!isOneOf(["start", "read"] as const, params.action)) invalid("action must be start or read");
      return as({ action: params.action });
  }
  return invalid(`unknown operation ${String(op)}`);
}
