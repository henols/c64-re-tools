// The c64run session: one replay core (a C64 emulator, see tools/c64run.c) for
// the life of a skill script. The process, the command queue and the stop are
// those of every line core (line-core.ts).

import { WireFailure } from "../protocol/messages.ts";
import { C64RUN, INSTALL_STEPS } from "./discover.ts";
import { LineCoreSession, openLineCore, statusFields } from "./line-core.ts";
import type { ToolContext } from "./run.ts";

/** The command protocol that this module speaks; c64run --version and version name it. */
export const C64RUN_PROTOCOL = 4;

/** CPU cycles in one PAL frame: 312 lines of 63 cycles. */
export const PAL_FRAME_CYCLES = 19_656;

/** The machine state that most commands answer with. */
export interface CoreStatus {
  /** CPU cycles since the opcode fetch at the reset vector. */
  tick: number;
  /** At an opcode fetch: pc is the address of the next instruction. */
  sync: boolean;
  pc: number;
  a: number;
  x: number;
  y: number;
  s: number;
  p: number;
  line: number;
  cycle: number;
  /** FNV-1a of RAM from $0002 and of colour RAM. */
  hash: string;
  /** The word after "ok", if any: "reached" or "not-reached" for run-pc and run-reads. */
  word?: string;
}

export function parseStatus(answer: string): CoreStatus {
  const { fields, word } = statusFields(answer);
  const hex = (key: string) => Number.parseInt(fields.get(key) ?? "", 16);
  if (!fields.has("tick")) throw new WireFailure("operation-failed", `c64run gave no machine state: ${answer}`);
  return {
    tick: Number(fields.get("tick")),
    sync: fields.get("sync") === "1",
    pc: hex("pc"),
    a: hex("a"),
    x: hex("x"),
    y: hex("y"),
    s: hex("s"),
    p: hex("p"),
    line: Number(fields.get("line")),
    cycle: Number(fields.get("cycle")),
    hash: fields.get("hash") ?? "",
    ...(word === undefined ? {} : { word }),
  };
}

const SPEC = { tool: C64RUN, protocol: C64RUN_PROTOCOL };

export class C64RunSession extends LineCoreSession {
  /** Starts c64run (C64RT_C64RUN, else c64run on PATH) and checks its protocol. Refuses by name when it is missing. */
  static open(context: ToolContext): Promise<C64RunSession> {
    return openLineCore(SPEC, context, (process) => new C64RunSession(SPEC, process));
  }

  /** A command that answers with the machine state. */
  async status(text: string): Promise<CoreStatus> {
    return parseStatus(await this.command(text));
  }

  /** Power-on: the CPU stops at the reset vector, tick 0. Missing ROMs refuse with the remedy. */
  async init(romFolder?: string): Promise<CoreStatus> {
    try {
      return await this.status(romFolder === undefined ? "init" : `init ${romFolder}`);
    } catch (error) {
      if (error instanceof WireFailure && /no ROM/.test(error.message)) {
        throw new WireFailure(
          "installation-incomplete",
          `${error.message}. c64run needs the C64 ROMs kernal-901227-03.bin, basic-901226-01.bin and chargen-901225-01.bin. ${INSTALL_STEPS}`,
        );
      }
      throw error;
    }
  }
}
