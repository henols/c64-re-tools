// The show stage of a start screen from a captured stage: the picture is not
// in the program at the entry, so it shows before the loader. Exomizer packs
// the loader as it is in memory before it starts (the plain loader file, or
// the parts of the packed form), the bytes of the stage that the start screen
// uses at their own addresses, the bytes of the loader that those cover in a
// stash, and the show code into one loader program. The show code shows the
// screen with start-screen.asm, calls the routine of the stage, waits for a
// key or a fire button, stops the interrupts of the stage, sets the CIAs as
// RUN leaves them, copies the stash back and starts the loader.

import { type AddressRange, formatC64Address, formatC64Byte } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import type { StartScreenRow } from "#src/knowledge/read.ts";
import { placePieces, START_SCREEN_FILE, startScreenValues, subtract, type StartScreenPlan } from "./loader.ts";

/** Bytes at an address. */
export interface StagePart {
  start: number;
  body: Uint8Array;
}

export interface StageInput {
  /** The loader as it is in memory before it starts: the plain loader file, or the parts of the packed form. */
  inner: StagePart[];
  /** Where the loader starts, and the value of $01 that it needs there: $080d with $37, or the copier of the packed form with $34. */
  innerStart: number;
  innerPort: number;
  /** The bytes of the stage that the start screen uses, in address order, at $0400 or higher. */
  stage: StagePart[];
  /** The colour RAM of the capture of the stage, when the start screen takes its colours from it: the show code holds it. */
  colourRam?: Uint8Array;
  row: StartScreenRow;
  plan: StartScreenPlan;
  /** The lines that include switches.asm or config.asm, for START_SCREEN. */
  settings: string[];
  header: string[];
  /** The bytes of the show code without its copy table (stageCodeSize). */
  codeSize: number;
}

export interface StagePlan {
  /** Where the show code runs. */
  code: number;
  /** The parts of the loader under the bytes of the stage: where the show code copies them back from. */
  stash: Array<{ target: AddressRange; at: number }>;
  /** start_screen_stage.asm: the show code at `code`, and each part of the stage at its own address. */
  text: string;
}

/** The file of the show stage in the generated source. */
export const STAGE_FILE = "start_screen_stage.asm";
/** The labels of the show stage: its start and the end of the show code. */
export const STAGE_START = "c64_source_stage";
export const STAGE_CODE_END = "c64_source_stage_code_end";
/** The label of the colour RAM of the capture in the show code. */
export const STAGE_COLOURS = "c64_source_stage_colours";
/** The label of a part of the stage: its first byte and the byte after it. */
export const stageLabel = (start: number, part: "from" | "end") => `stage_${part}_${start.toString(16).padStart(4, "0")}`;

/** One copy of the stash: the length, where it is read and where it is written. */
const COPY_ENTRY = 6;
/** X indexes the table, so the table holds at most this many copies in 256 bytes. */
const MAX_COPIES = Math.floor((256 - 2) / COPY_ENTRY);
/** Where the show code can run: RAM that no ROM and no I/O hides when $01 is $37, as for the call of the stage. */
const CODE_AREAS: readonly AddressRange[] = [
  { start: 0x0400, end: 0x9fff },
  { start: 0xc000, end: 0xcfff },
];
/** The RAM that the stash can use: the copy runs with all RAM in, and not on the hardware vectors. */
const STASH_AREA: AddressRange = { start: 0x0400, end: 0xfff9 };
/** The free ranges that a refusal names. */
const SHOWN_FREE = 8;

const show = (range: AddressRange) => `${formatC64Address(range.start)}-${formatC64Address(range.end)}`;
const rangeOf = (part: StagePart): AddressRange => ({ start: part.start, end: part.start + part.body.length - 1 });

/** The ranges in address order, with each run of touching or overlapping ranges as one. */
function merged(ranges: readonly AddressRange[]): AddressRange[] {
  const out: AddressRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = out.at(-1);
    if (last !== undefined && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else out.push({ ...range });
  }
  return out;
}

/** The byte of the parts at an address; the last part that holds it wins. */
function byteOf(parts: readonly StagePart[], address: number): number {
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index]!;
    if (address >= part.start && address < part.start + part.body.length) return part.body[address - part.start]!;
  }
  throw new WireFailure("operation-failed", `No part holds ${formatC64Address(address)}. This is a defect of the script.`);
}

/**
 * Plans the show stage: the show code in a free range where it can run with
 * the KERNAL in, and the bytes of the loader under the stage in the other free
 * ranges. Refuses by name when the memory is too small.
 */
export function planStage(input: StageInput): StagePlan {
  const used = merged([...input.inner.map(rangeOf), ...input.stage.map(rangeOf)]);
  const free = subtract(STASH_AREA, used);
  const covered = merged(input.inner.map(rangeOf)).flatMap((inner) => input.stage.map(rangeOf).flatMap((part) => (part.start <= inner.end && inner.start <= part.end ? [{ start: Math.max(part.start, inner.start), end: Math.min(part.end, inner.end) }] : [])));
  const stashed = merged(covered).map((range) => ({ what: `the loader at ${show(range)}`, range, bytes: (address: number) => byteOf(input.inner, address) }));
  const refuse = (why: string): never => {
    const largest = [...free].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, SHOWN_FREE);
    const ranges = largest.length === 0 ? "none" : largest.map((range) => `${show(range)} (${range.end - range.start + 1} bytes)`).join(", ");
    throw new WireFailure("invalid-input", `${why} The largest free ranges outside the loader and the bytes of the stage: ${ranges}. Capture the stage with less memory, so that its program holds only the start screen and the routine of the call.`);
  };
  for (let copies = Math.max(stashed.length, 1); copies <= MAX_COPIES; ) {
    const size = input.codeSize + COPY_ENTRY * copies + 2;
    let best: { code: number; pieces: NonNullable<ReturnType<typeof placePieces>> } | undefined;
    for (const range of free) {
      for (const area of CODE_AREAS) {
        const start = Math.max(range.start, area.start);
        const code = { start, end: start + size - 1 };
        if (code.end > Math.min(range.end, area.end)) continue;
        const pieces = placePieces(free.flatMap((other) => subtract(other, [code])), stashed, (other) => Math.abs(other.start - code.start));
        if (pieces !== undefined && (best === undefined || pieces.length < best.pieces.length)) best = { code: code.start, pieces };
      }
    }
    if (best === undefined) return refuse(`The show stage needs ${size} free bytes for its code in $0400-$9fff or $c000-$cfff, and ${stashed.reduce((sum, item) => sum + item.range.end - item.range.start + 1, 0)} more free bytes for the bytes of the loader under the stage.`);
    if (best.pieces.length <= copies) {
      const stash = best.pieces.map((piece) => ({ target: piece.target, at: piece.at }));
      return { code: best.code, stash, text: stageText(input, best.code, stash) };
    }
    copies = best.pieces.length;
  }
  return refuse(`The show stage needs more than ${MAX_COPIES} copies for the bytes of the loader under the stage.`);
}

/** The bytes as !byte lines of 16. */
function byteLines(part: StagePart): string[] {
  const lines: string[] = [];
  for (let offset = 0; offset < part.body.length; offset += 16) lines.push(`        !byte ${[...part.body.subarray(offset, offset + 16)].map(formatC64Byte).join(",")}`);
  return lines;
}

/** start_screen_stage.asm with the show code at `code` and the stash table of `stash`. */
export function stageText(input: StageInput, code: number, stash: StagePlan["stash"]): string {
  const { row } = input;
  const lines = [
    ...input.header.map((line) => `; ${line}`),
    `; The show stage of the start screen from ${row.stage}: Exomizer packs it with the loader into the loader program, with --entry '${formatC64Address(code)}'.`,
    "; It shows the start screen, waits for a key or a fire button, copies back the bytes of the loader that the stage covers, and starts the loader.",
    "",
    "!cpu 6510",
    ...input.settings,
    "",
    ...startScreenValues(row, input.plan),
    ...(row.call === undefined ? [] : [`c64_source_ss_call = ${formatC64Address(row.call)} ; the routine of ${row.stage} that the start screen calls before it waits`]),
    "",
    `* = ${formatC64Address(code)}`,
    STAGE_START,
    "        sei",
    `!zone c64_source_start_screen {`,
    `!source "${START_SCREEN_FILE}"`,
    "}",
    "!zone c64_source_stage {",
    "        sei",
    "        lda #$35",
    "        sta $01",
    "        ; The interrupts and the sound of the stage stop, and the display is off.",
    "        lda #$7f",
    "        sta $dc0d",
    "        sta $dd0d",
    "        lda #$00",
    "        sta $d01a",
    "        sta $d418",
    "        sta $d015",
    "        lda #$0f",
    "        sta $d019",
    "        lda #$0b",
    "        sta $d011",
    "        ; The CIA timers as RUN leaves them, as the loader expects: CIA 1 timer A",
    "        ; runs with the latch $4025 for the interrupt, the others stop at $ffff.",
    "        lda #$00",
    "        sta $dc0e",
    "        sta $dc0f",
    "        sta $dd0e",
    "        sta $dd0f",
    "        lda #$ff",
    "        sta $dc06",
    "        sta $dc07",
    "        sta $dd04",
    "        sta $dd05",
    "        sta $dd06",
    "        sta $dd07",
    "        lda #$08",
    "        sta $dc0f",
    "        sta $dd0e",
    "        sta $dd0f",
    "        lda #$25",
    "        sta $dc04",
    "        lda #$40",
    "        sta $dc05",
    "        lda #$11",
    "        sta $dc0e",
    "        lda #$81",
    "        sta $dc0d",
    "        lda $dc0d",
    "        lda $dd0d",
    "        ; The stash goes back to the loader, with all RAM in.",
    "        lda #$34",
    "        sta $01",
    "        ldx #0",
    ".next   lda .table,x",
    "        ora .table+1,x",
    "        beq .done",
    "        lda .table,x",
    "        sta .count",
    "        lda .table+1,x",
    "        sta .count+1",
    "        lda .table+2,x",
    "        sta .read+1",
    "        lda .table+3,x",
    "        sta .read+2",
    "        lda .table+4,x",
    "        sta .write+1",
    "        lda .table+5,x",
    "        sta .write+2",
    "        ldy #0",
    ".read   lda $ffff,y",
    ".write  sta $ffff,y",
    "        iny",
    "        bne +",
    "        inc .read+2",
    "        inc .write+2",
    "+       lda .count",
    "        bne +",
    "        dec .count+1",
    "+       dec .count",
    "        lda .count",
    "        ora .count+1",
    "        bne .read",
    "        txa",
    "        clc",
    `        adc #${COPY_ENTRY}`,
    "        tax",
    "        jmp .next",
    `.done   lda #${formatC64Byte(input.innerPort)}`,
    "        sta $01",
    `        jmp ${formatC64Address(input.innerStart)}`,
    ".count  !word 0",
    ".table",
    ...stash.map((item) => `        !word ${item.target.end - item.target.start + 1}, ${formatC64Address(item.at)}, ${formatC64Address(item.target.start)} ; ${show(item.target)} of the loader`),
    "        !word 0",
    "}",
    ...(input.colourRam === undefined ? [] : [`; The colour RAM of the capture of ${row.stage}.`, STAGE_COLOURS, ...byteLines({ start: 0, body: input.colourRam })]),
    STAGE_CODE_END,
  ];
  // Each part at its own address: the code is in a free range, so no part overlaps it, and the build never runs past $ffff.
  for (const part of input.stage) {
    lines.push("", `; ${row.stage} ${show(rangeOf(part))}`, `* = ${formatC64Address(part.start)}`, stageLabel(part.start, "from"), ...byteLines(part), stageLabel(part.start, "end"));
  }
  return `${lines.join("\n")}\n`;
}

/**
 * What Exomizer packs: the loader without the bytes under the stage, the
 * stash, the bytes of the stage at their addresses and the show code. `build`
 * is the build of start_screen_stage.asm; `labels` gives its labels.
 */
export function stageParts(input: StageInput, plan: StagePlan, build: Uint8Array, labels: (name: string) => number): StagePart[] {
  const start = build[0]! | (build[1]! << 8);
  const slice = (from: number, to: number) => build.subarray(2 + from - start, 2 + to - start);
  const stageRanges = input.stage.map(rangeOf);
  const loader = input.inner.flatMap((part) => subtract(rangeOf(part), stageRanges).map((range) => ({ start: range.start, body: part.body.subarray(range.start - part.start, range.end - part.start + 1) })));
  const stash = plan.stash.map((item) => ({ start: item.at, body: Uint8Array.from({ length: item.target.end - item.target.start + 1 }, (_, offset) => byteOf(input.inner, item.target.start + offset)) }));
  const stage = input.stage.map((part) => ({ start: part.start, body: slice(labels(stageLabel(part.start, "from")), labels(stageLabel(part.start, "end"))) }));
  return [...loader, ...stash, ...stage, { start: plan.code, body: slice(plan.code, labels(STAGE_CODE_END)) }];
}
