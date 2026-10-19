// The zxrun session: one ZX Spectrum 48K or 128K replay core (see tools/zxrun.c) for the
// life of a skill script. The process, the command queue and the stop are those
// of every line core (line-core.ts).

import { WireFailure } from "../protocol/messages.ts";
import { ZXRUN } from "./discover.ts";
import { LineCoreSession, openLineCore, statusFields } from "./line-core.ts";
import type { ToolContext } from "./run.ts";

/** The command protocol that this module speaks; zxrun --version and version name it. */
export const ZXRUN_PROTOCOL = 2;

/** CPU cycles in one frame: 312 lines of 224 cycles on the 48K, 311 lines of 228 cycles on the 128K. */
export const ZX_FRAME_CYCLES = { "48k": 69_888, "128k": 70_908 } as const;

export type ZxModel = keyof typeof ZX_FRAME_CYCLES;

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
  model: ZxModel;
  /** The last write to port $7ffd on the 128K (0 on the 48K): the paged bank in bits 0-2. */
  port7ffd: number;
  /** FNV-1a of the RAM: 3 banks on the 48K, 8 on the 128K. */
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
    model: fields.get("model") === "128k" ? "128k" : "48k",
    port7ffd: hex("port7ffd"),
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

  /** Power-on of a model: the CPU stops at its first opcode fetch, tick 0. A missing ROM refuses with the remedy. */
  init(model: ZxModel, romFolder?: string): Promise<ZxStatus> {
    return this.#withRoms(this.status(romFolder === undefined ? `init ${model}` : `init ${model} ${romFolder}`));
  }

  /** Loads a .z80 snapshot of a 48K or a 128K; the machine becomes that model, and the CPU stops at its pc, tick 0. */
  loadZ80(path: string): Promise<ZxStatus> {
    return this.#withRoms(this.status(`load-z80 ${path}`));
  }

  async #withRoms(answer: Promise<ZxStatus>): Promise<ZxStatus> {
    try {
      return await answer;
    } catch (error) {
      if (error instanceof WireFailure && /no ROM/.test(error.message)) {
        throw new WireFailure("installation-incomplete", `${error.message}. zxrun needs the ROMs 48.rom and 128.rom. ${ZXRUN.remedy}`);
      }
      throw error;
    }
  }
}
