// The zxrun session: one ZX Spectrum 48K replay core (see tools/zxrun.c) for the
// life of a skill script. The process, the command queue and the stop are those
// of every line core (line-core.ts).

import { WireFailure } from "../protocol/messages.ts";
import { ZXRUN } from "./discover.ts";
import { LineCoreSession, openLineCore, statusFields } from "./line-core.ts";
import type { ToolContext } from "./run.ts";

/** The command protocol that this module speaks; zxrun --version and version name it. */
export const ZXRUN_PROTOCOL = 1;

/** CPU cycles in one 48K frame: 312 lines of 224 cycles. */
export const ZX48_FRAME_CYCLES = 69_888;

/** The machine state that most zxrun commands answer with. */
export interface ZxStatus {
  /** CPU cycles since the first opcode fetch after init or load-z80. */
  tick: number;
  /** At an opcode fetch: pc is the address of the next instruction. */
  sync: boolean;
  pc: number;
  af: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  iy: number;
  sp: number;
  im: number;
  iff: boolean;
  line: number;
  cycle: number;
  /** FNV-1a of the 48 KiB of RAM. */
  hash: string;
  /** The word after "ok", if any: "reached" or "not-reached" for run-pc and run-reads. */
  word?: string;
}

export function parseZxStatus(answer: string): ZxStatus {
  const { fields, word } = statusFields(answer);
  const hex = (key: string) => Number.parseInt(fields.get(key) ?? "", 16);
  if (!fields.has("tick")) throw new WireFailure("operation-failed", `zxrun gave no machine state: ${answer}`);
  return {
    tick: Number(fields.get("tick")),
    sync: fields.get("sync") === "1",
    pc: hex("pc"),
    af: hex("af"),
    bc: hex("bc"),
    de: hex("de"),
    hl: hex("hl"),
    ix: hex("ix"),
    iy: hex("iy"),
    sp: hex("sp"),
    im: Number(fields.get("im")),
    iff: fields.get("iff") === "1",
    line: Number(fields.get("line")),
    cycle: Number(fields.get("cycle")),
    hash: fields.get("hash") ?? "",
    ...(word === undefined ? {} : { word }),
  };
}

const SPEC = { tool: ZXRUN, protocol: ZXRUN_PROTOCOL };

export class ZxRunSession extends LineCoreSession {
  /** Starts zxrun (C64RT_ZXRUN, else zxrun on PATH) and checks its protocol. Refuses by name when it is missing. */
  static open(context: ToolContext): Promise<ZxRunSession> {
    return openLineCore(SPEC, context, (process) => new ZxRunSession(SPEC, process));
  }

  /** A command that answers with the machine state. */
  async status(text: string): Promise<ZxStatus> {
    return parseZxStatus(await this.command(text));
  }

  /** Power-on: the CPU stops at its first opcode fetch, tick 0. A missing ROM refuses with the remedy. */
  async init(romFolder?: string): Promise<ZxStatus> {
    try {
      return await this.status(romFolder === undefined ? "init" : `init ${romFolder}`);
    } catch (error) {
      if (error instanceof WireFailure && /no ROM/.test(error.message)) {
        throw new WireFailure("installation-incomplete", `${error.message}. zxrun needs the 48K ROM 48.rom. ${ZXRUN.remedy}`);
      }
      throw error;
    }
  }

  /** Loads a .z80 snapshot; the CPU stops at its pc, tick 0. */
  loadZ80(path: string): Promise<ZxStatus> {
    return this.status(`load-z80 ${path}`);
  }
}
