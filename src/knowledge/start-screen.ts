// The start screen of a captured stage, from the entry state of its capture:
// the VIC-II registers and the VIC bank give the mode and the addresses, and
// the colour RAM of the capture gives the colours. Thus the start screen of a
// stage needs no address from the user.

import { d018Offsets, formatC64Byte, vicBankBase } from "../c64.ts";
import { Refusal } from "../errors.ts";
import { LEFTOVERS_SWITCH, START_SCREEN_SWITCH, type StartScreenMode } from "./schema.ts";

/** The labels of the start screen in a generated loader: its wait for a key or a fire button, and the code after the wait. */
export const START_SCREEN_WAIT = "loader_start_screen_wait";
export const START_SCREEN_CONTINUE = "loader_start_screen_continue";
/** The label of the loader's jump to the entry, in ACME's symbol list. */
export const LOADER_JUMP = "c64_source_loader_jump";

/**
 * The wait and the code after the wait of the start screen that a build shows,
 * from the symbols of the build; undefined when the build shows none. A build
 * with START_SCREEN = 0 or LEFTOVERS = 1 has both labels but skips the screen
 * (the start screen code of the generated source). A symbol file without the
 * constants is a build with the default values: the screen is on.
 */
export function startScreenLabels(symbols: ReadonlyMap<string, number>): { wait: number; continue: number } | undefined {
  const wait = symbols.get(START_SCREEN_WAIT);
  const resume = symbols.get(START_SCREEN_CONTINUE);
  if (wait === undefined || resume === undefined) return undefined;
  if ((symbols.get(START_SCREEN_SWITCH) ?? 1) === 0 || (symbols.get(LEFTOVERS_SWITCH) ?? 0) !== 0) return undefined;
  return { wait, continue: resume };
}

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

/** How a refusal names the capture: the program that has no entry state, the capture, and how to capture it again. */
interface Named {
  program: string;
  capture: string;
  again: string;
}

/**
 * The screen that the VIC-II of an entry state shows: its mode, its screen, its
 * bitmap or charset and its colours of the border and the background, from the
 * VIC-II registers and the VIC bank of CIA 2. Refuses by name when the capture
 * does not show a screen that the loader can show.
 */
function vicScreen(state: Record<string, unknown> | undefined, named: Named): Omit<StageScreen, "colourRam"> {
  const vic = ioBytes(state, "vic");
  const cia2 = ioBytes(state, "cia2");
  if (state === undefined || vic === undefined || vic.length < 0x2f || cia2 === undefined) throw new Refusal("not-found", `${named.program} has no entry state with the VIC-II and CIA 2. ${named.again}`);
  const [d011, d016, d018] = [vic[0x11]!, vic[0x16]!, vic[0x18]!];
  if ((d011 & 0x10) === 0) throw new Refusal("invalid-input", `${named.capture} has the display off ($d011 = ${formatC64Byte(d011)}). ${named.again}`);
  if ((d011 & 0x40) !== 0) throw new Refusal("invalid-input", `${named.capture} shows a screen in the extended colour mode, which a start screen does not have.`);
  const bitmap = (d011 & 0x20) !== 0;
  const multicolour = (d016 & 0x10) !== 0;
  if (!bitmap && multicolour) throw new Refusal("invalid-input", `${named.capture} shows a multicolour text screen, which a start screen does not have.`);
  const bank = vicBankBase(cia2[0]!);
  const offsets = d018Offsets(d018);
  return {
    mode: bitmap ? (multicolour ? "multicolour" : "hires") : "text",
    screen: bank + offsets.screen,
    ...(bitmap ? { bitmap: bank + offsets.bitmap } : { charset: bank + offsets.characters }),
    border: vic[0x20]! & 0x0f,
    background: vic[0x21]! & 0x0f,
  };
}

/**
 * The start screen that the capture of a stage shows: its mode, its screen,
 * its bitmap or charset, its colours and the colour RAM. Refuses by name when
 * the capture does not show a start screen that the loader can show.
 */
export function startScreenOfStage(state: Record<string, unknown> | undefined, stage: string): StageScreen {
  const again = `Capture the stage again while it shows the screen, and put the capture into the project knowledge with image --space ${stage}.`;
  const shown = vicScreen(state, { program: `The program in ${stage}`, capture: `The capture in ${stage}`, again });
  const colourRam = shown.mode === "hires" ? undefined : capturedColourRam(state);
  if (shown.mode !== "hires" && colourRam === undefined) throw new Refusal("not-found", `The capture in ${stage} has no colour RAM: it is from an older version. ${again}`);
  return { ...shown, ...(colourRam === undefined ? {} : { colourRam: true as const }) };
}

/** The bytes of the colour RAM. */
const COLOURS = 1000;

/**
 * The first address of the program from $0400 where 1000 bytes hold the
 * colours (the low 4 bits of each byte), outside $d000-$dfff, where the loader
 * sees the I/O area. Undefined when the program has no such bytes.
 */
function findColours(colours: Uint8Array, byteAt: (address: number) => number | undefined): number | undefined {
  for (let start = 0x0400; start + COLOURS - 1 <= 0xffff; start++) {
    if (start <= 0xdfff && start + COLOURS - 1 >= 0xd000) continue;
    let offset = 0;
    while (offset < COLOURS) {
      const byte = byteAt(start + offset);
      if (byte === undefined || (byte & 0x0f) !== colours[offset]) break;
      offset++;
    }
    if (offset === COLOURS) return start;
  }
  return undefined;
}

const CAPTURE_AGAIN = "Capture the program again while it shows the screen. Then give the image.json of that capture.";

/**
 * The start screen in the program that a capture of the program shows: the
 * mode, the addresses and the border and background colours from the VIC-II
 * and CIA 2 of the capture. Refuses by name when the capture does not show a
 * start screen that the loader can show.
 */
export function startScreenOfCapture(state: Record<string, unknown> | undefined, path: string): Omit<StageScreen, "colourRam"> {
  return vicScreen(state, { program: `The capture ${path}`, capture: `The capture ${path}`, again: CAPTURE_AGAIN });
}

/**
 * The colour RAM of a capture as the program gives it: one colour, or the
 * address of 1000 bytes that the program has (findColours). Refuses with the
 * reason when the program cannot give the colours.
 */
export function coloursOfCapture(state: Record<string, unknown> | undefined, path: string, byteAt: (address: number) => number | undefined): { colour: number } | { colours: number } {
  const colours = capturedColourRam(state);
  if (colours === undefined) throw new Refusal("not-found", `The capture ${path} has no colour RAM: it is from an older version. ${CAPTURE_AGAIN}`);
  if (colours.every((colour) => colour === colours[0])) return { colour: colours[0]! };
  const found = findColours(colours, byteAt);
  if (found === undefined) {
    throw new Refusal(
      "not-found",
      `The colour RAM of the capture ${path} has more than one colour, and the program of the knowledge has no 1000 bytes with these colours from $0400, outside $d000-$dfff. Thus the loader cannot set the colours. If a stage of the loading shows the screen, record the start screen of that stage.`,
    );
  }
  return { colours: found };
}
