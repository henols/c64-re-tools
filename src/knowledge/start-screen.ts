// The start screen of a captured stage, from the entry state of its capture:
// the VIC-II registers and the VIC bank give the mode and the addresses, and
// the colour RAM of the capture gives the colours. Thus the start screen of a
// stage needs no address from the user.

import { Refusal } from "../errors.ts";
import type { StartScreenMode } from "./schema.ts";

/** The fields of a start screen that the capture of a stage gives. */
export interface StageScreen {
  mode: StartScreenMode;
  screen: number;
  bitmap?: number;
  charset?: number;
  border: number;
  background: number;
  /** The colours are the colour RAM of the capture: not for hires. */
  colourRam?: true;
}

/** The bytes of an I/O area of an entry state: io.<name>.bytes as hex, when the capture has them. */
function ioBytes(state: Record<string, unknown> | undefined, name: string): Buffer | undefined {
  const io = state?.io as Record<string, { bytes?: unknown }> | undefined;
  const bytes = io?.[name]?.bytes;
  return typeof bytes === "string" && /^([0-9a-f]{2})+$/i.test(bytes) ? Buffer.from(bytes, "hex") : undefined;
}

/** The colour RAM of the capture of a stage: 1000 colours from $d800, or undefined when the capture has none. */
export function capturedColourRam(state: Record<string, unknown> | undefined): Uint8Array | undefined {
  const bytes = ioBytes(state, "colour");
  return bytes === undefined || bytes.length !== 1000 ? undefined : Uint8Array.from(bytes, (value) => value & 0x0f);
}

/**
 * The start screen that the capture of a stage shows: its mode, its screen,
 * its bitmap or charset, its colours and the colour RAM. Refuses by name when
 * the capture does not show a start screen that the loader can show.
 */
export function startScreenOfStage(state: Record<string, unknown> | undefined, stage: string): StageScreen {
  const again = `Capture the stage again while it shows the screen, and put the capture into the project knowledge with image --space ${stage}.`;
  const vic = ioBytes(state, "vic");
  const cia2 = ioBytes(state, "cia2");
  if (state === undefined || vic === undefined || vic.length < 0x2f || cia2 === undefined) throw new Refusal("not-found", `The program in ${stage} has no entry state with the VIC-II and CIA 2. ${again}`);
  const [d011, d016, d018] = [vic[0x11]!, vic[0x16]!, vic[0x18]!];
  if ((d011 & 0x10) === 0) throw new Refusal("invalid-input", `The capture in ${stage} has the display off ($d011 = $${d011.toString(16).padStart(2, "0")}). ${again}`);
  if ((d011 & 0x40) !== 0) throw new Refusal("invalid-input", `The capture in ${stage} shows a screen in the extended colour mode, which a start screen does not have.`);
  const bitmap = (d011 & 0x20) !== 0;
  const multicolour = (d016 & 0x10) !== 0;
  if (!bitmap && multicolour) throw new Refusal("invalid-input", `The capture in ${stage} shows a multicolour text screen, which a start screen does not have.`);
  const bank = (3 - (cia2[0]! & 0x03)) << 14;
  const mode: StartScreenMode = bitmap ? (multicolour ? "multicolour" : "hires") : "text";
  const screen = bank + ((d018 >> 4) & 0x0f) * 0x400;
  const colourRam = mode === "hires" ? undefined : capturedColourRam(state);
  if (mode !== "hires" && colourRam === undefined) throw new Refusal("not-found", `The capture in ${stage} has no colour RAM: it is from an older version. ${again}`);
  return {
    mode,
    screen,
    ...(bitmap ? { bitmap: bank + ((d018 >> 3) & 1) * 0x2000 } : { charset: bank + ((d018 >> 1) & 7) * 0x800 }),
    border: vic[0x20]! & 0x0f,
    background: vic[0x21]! & 0x0f,
    ...(colourRam === undefined ? {} : { colourRam: true as const }),
  };
}

