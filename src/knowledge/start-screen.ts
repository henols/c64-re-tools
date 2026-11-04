// The start screen of a captured stage, from the entry state of its capture:
// the VIC-II registers and the VIC bank give the mode and the addresses, and
// the colour RAM of the capture gives the colours. Thus the start screen of a
// stage needs no address from the user. Also the values that the start screen
// code of a generated loader gets from a start screen of the knowledge.

import { createHash } from "node:crypto";

import { formatC64Address, formatC64Byte, vicScreenMemory } from "../c64.ts";
import { Refusal } from "../errors.ts";
import { isRomFont, type StartScreenRow } from "./read.ts";
import { LEFTOVERS_SWITCH, START_SCREEN_SWITCH, type StartScreenMode } from "./schema.ts";

/** The file of the start screen code in the generated source. */
export const START_SCREEN_FILE = "start_screen.asm";

/** The VIC-II values of a start screen, as the start screen code sets them. */
export interface StartScreenPlan {
  d011: number;
  d016: number;
  d018: number;
  /** The VIC bank: 0 for $0000-$3fff to 3 for $c000-$ffff. */
  bank: number;
  border: number;
  background: number;
  /** 0: no colour RAM (hires), 1: one colour, 2: a copy of 1000 bytes. */
  colourMode: 0 | 1 | 2;
}

/** The VIC-II values that show a start screen of the knowledge. */
export function startScreenPlan(row: StartScreenRow): StartScreenPlan {
  const bank = row.screen >> 14;
  const base = (row.bitmap === undefined ? ((row.charset! & 0x3fff) >> 11) << 1 : ((row.bitmap & 0x3fff) >> 13) << 3) | 0x01;
  return {
    d011: row.mode === "text" ? 0x1b : 0x3b,
    d016: row.mode === "multicolour" ? 0x18 : 0x08,
    d018: (((row.screen & 0x3fff) >> 10) << 4) | base,
    bank,
    border: row.border,
    background: row.background,
    colourMode: row.colours !== undefined || row.colourRam === true ? 2 : row.colour !== undefined ? 1 : 0,
  };
}

/**
 * The key of a start screen of a captured stage: what the bytes of its show
 * stage are made from. These are the fields of the start screen (not its
 * comment) and the revision of the space of the stage (`stageRevision`), which
 * changes with each capture, patch or coverage there. Another key means that
 * a show stage of the source is not of this start screen.
 */
export function startScreenKey(row: StartScreenRow, stageRevision: string): string {
  const fields = [row.space, row.mode, row.screen, row.bitmap, row.charset, row.colours, row.colour, row.border, row.background, row.stage, row.call, row.colourRam, stageRevision];
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex").slice(0, 16);
}

/** The lines of loader.asm or of the show stage that give the start screen code its values. */
export function startScreenValues(row: StartScreenRow, plan: StartScreenPlan): string[] {
  const value = (name: string, number: number, comment?: string) => `c64_source_ss_${name} = ${formatC64Byte(number)}${comment === undefined ? "" : ` ; ${comment}`}`;
  const font = row.charset !== undefined && isRomFont(row.charset) ? " (the character ROM)" : "";
  const what = [`screen ${formatC64Address(row.screen)}`, ...(row.bitmap === undefined ? [] : [`bitmap ${formatC64Address(row.bitmap)}`]), ...(row.charset === undefined ? [] : [`charset ${formatC64Address(row.charset)}${font}`])];
  return [
    `; The start screen: ${row.mode}, ${what.join(", ")}.${row.comment === undefined ? "" : ` ${row.comment.replace(/\s*\r?\n\s*/g, " ")}`}`,
    value("d011", plan.d011),
    value("d016", plan.d016),
    value("d018", plan.d018),
    value("bank", 3 - plan.bank, `VIC bank ${formatC64Address(plan.bank << 14)}-${formatC64Address((plan.bank << 14) + 0x3fff)}`),
    value("border", plan.border),
    value("background", plan.background),
    value("colour_mode", plan.colourMode),
    value("colour", row.colour ?? 0),
    // The colour RAM of a captured stage is in the show code: STAGE_COLOURS in src/stage.ts.
    `c64_source_ss_colours = ${row.colourRam === true ? "c64_source_stage_colours" : formatC64Address(row.colours ?? 0)}`,
  ];
}

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
  const [d011, d016] = [vic[0x11]!, vic[0x16]!];
  if ((d011 & 0x10) === 0) throw new Refusal("invalid-input", `${named.capture} has the display off ($d011 = ${formatC64Byte(d011)}). ${named.again}`);
  if ((d011 & 0x40) !== 0) throw new Refusal("invalid-input", `${named.capture} shows a screen in the extended colour mode, which a start screen does not have.`);
  const bitmap = (d011 & 0x20) !== 0;
  const multicolour = (d016 & 0x10) !== 0;
  if (!bitmap && multicolour) throw new Refusal("invalid-input", `${named.capture} shows a multicolour text screen, which a start screen does not have.`);
  return {
    mode: bitmap ? (multicolour ? "multicolour" : "hires") : "text",
    ...vicScreenMemory(vic, cia2),
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
