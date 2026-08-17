#!/usr/bin/env node
// stock-sprites.ts
//
// vice_sprite_get / vice_sprite_inspect -- DERIVED tools (DERIV-06): the
// binary monitor has no sprite command at all, so both answers are
// pointer-chain arithmetic plus bit rendering computed CLIENT-SIDE over
// MEM_GET reads. Registered through withDerivedTool(..., { needsSession:
// true }, ...) in stock-dispatch.ts by 05-07 (wave 3) -- THIS PLAN DOES NOT
// REGISTER EITHER TOOL. No write to stock-dispatch.ts, stock-derived.ts,
// tools-manifest.stock.json or package.json happens here.
//
// PROVENANCE (required reading before touching the four geometry
// functions below): vicBank(), vicBankBase(), screenBase() and
// spriteDataAddress() are PORTED, NOT RE-DERIVED, from
// .claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs's own
// vicBank()/screenBase()/spriteDataAddresses map, which carries a
// committed, verified fixture: dd00_raw=193 (0xC1), d018_raw=49 (0x31) ->
// screen_base=35840. stock-sprites.test.ts re-asserts the SAME fixture as
// its own cross-check -- do not change any of the four expressions without
// also updating that committed fixture's provenance. The skill's
// JavaScript is copied here, never imported at runtime -- .claude/skills/
// is a different package, absent from .claude/mcp/vice's files[], so a
// runtime cross-package import would be missing from the published
// tarball.
//
// WHAT NOT TO DO:
//   - Never import hostpath.ts or vice-proxy.ts -- hostpath-consumers.test.ts
//     gates this file's absence from the closed host-path consumer set
//     (D-02). This tool takes no path argument at all.
//   - Never set sidefx: true on any read. The VIC-II block read includes
//     $D01E/$D01F, which CLEAR ON READ in hardware -- every read here is
//     sidefx: false, with no argument anywhere to override it.
//   - Never issue an unrequested resume (Phase 3 D-05) -- MEM_GET only.
//     `runState` on the answer (via stockAnswer()) reports the halt
//     honestly.
//   - Never validate the sprite index with stock-address.ts's
//     parseByteCount() -- that helper refuses 0, which is a valid (and the
//     most commonly inspected) sprite index. The index is validated here
//     as an explicit integer 0..7 instead (see parseSpriteIndex()).
//   - Never build the answer outside stockAnswer() (D-06) -- that is
//     exactly how an answer ships without `runState`.
import { CommandType, memGetBody } from "./stock-protocol.ts";
import { convertWireError, isErrorText, stockAnswer, type StockErrorResult, type StockSessionHandler } from "./stock-handler.ts";
import type { StockConnectSession } from "./stock-connect.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-memory.ts, stock-disassemble.ts et al. each keep a private copy
 * rather than sharing one import). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

const VICII_BASE = 0xd000;
const VICII_END = 0xd02e;
const VICII_LENGTH = 0x2f;

const CIA2_PORT_A = 0xdd00;

const SPRITE_POINTER_TABLE_OFFSET = 0x3f8;
const SPRITE_COUNT = 8;
const SPRITE_DATA_BYTES = 63;
const SPRITE_ROWS = 21;
const SPRITE_HIRES_COLUMNS = 24;
const SPRITE_MULTICOLOUR_COLUMNS = 12;

/** The fork's own manifest description, quoted verbatim in shape (four
 * mappings separated by ", ") so a caller sees the exact bit-pair legend
 * without decoding pixels themselves. */
export const SPRITE_ASCII_LEGEND =
  "'.' = transparent (00), '#' = sprite colour (10), '@' = multicolour 1 (01), '%' = multicolour 2 (11)";

/** vice_sprite_inspect's `format` values actually served on stock (D-05-03). */
export const SERVED_INSPECT_FORMATS = ["ascii", "binary"];

/** vice_sprite_inspect's `format` values refused by name (D-05-03) -- built
 * for a value nothing calls, mirroring the SHOT-01..SHOT-05 cut. */
export const REFUSED_INSPECT_FORMATS = ["png_base64"];

// ---------------------------------------------------------------------------
// Geometry helpers -- PORTED VERBATIM from dump-artifacts.mjs. Do not change
// any of these four expressions; they are fixture-verified (see the
// provenance paragraph above) and re-deriving them from the hardware
// description a second time is exactly the anti-pattern this plan exists to
// avoid.
// ---------------------------------------------------------------------------

/** VIC-II bank number (0-3), from $DD00 bits 0-1. The stored value is the
 * INVERSE of the bank number. */
export function vicBank(dd00Raw: number): number {
  return 3 - (dd00Raw & 3);
}

/** Absolute base address of the selected VIC-II bank (16 KB windows). */
export function vicBankBase(dd00Raw: number): number {
  return vicBank(dd00Raw) * 16384;
}

/** Screen memory base address: $D018 bits 4-7 (screen pointer, in
 * 1024-byte units relative to the VIC bank) added to the bank's own base. */
export function screenBase(d018Raw: number, dd00Raw: number): number {
  return vicBankBase(dd00Raw) + ((d018Raw >> 4) & 0x0f) * 1024;
}

/** Absolute address of one sprite's 63-byte data block, from its pointer
 * table byte (each unit is 64 bytes, relative to the VIC bank's own base). */
export function spriteDataAddress(dd00Raw: number, pointerByte: number): number {
  return vicBankBase(dd00Raw) + pointerByte * 64;
}

/**
 * Returns a note when `address` (already resolved to an absolute address)
 * falls in the character-ROM shadow window inside VIC banks 0 and 2
 * ($1000-$1FFF relative to the bank base). In those two banks the VIC-II
 * chip fetches character ROM in that window, while MEM_GET always returns
 * the RAM underneath it -- so bytes reported for a screen or sprite-data
 * address resolved into that window may not be what the chip is actually
 * fetching. Returns null otherwise.
 */
function spriteRomWindowNote(address: number, bank: number): string | null {
  if (bank !== 0 && bank !== 2) {
    return null;
  }
  const relative = address & 0x3fff;
  if (relative < 0x1000 || relative > 0x1fff) {
    return null;
  }
  return (
    `address 0x${address.toString(16)} falls in VIC bank ${bank}'s character-ROM window ` +
    `($1000-$1FFF relative to the bank base) -- the VIC-II chip sees character ROM there, ` +
    `while MEM_GET returns the RAM underneath it, so the bytes reported may not be what the chip is fetching`
  );
}

/**
 * Validates a sprite index as an explicit integer 0..7, accepting a number
 * or its decimal-string form. Deliberately NOT stock-address.ts's
 * parseByteCount() -- that helper refuses 0 outright, and sprite 0 is a
 * valid (and the most commonly inspected) sprite index; refusing it would
 * be a correctness bug wearing a validation costume.
 */
function parseSpriteIndex(value: unknown, toolName: string): number {
  let parsed: number;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
    parsed = parseInt(value.trim(), 10);
  } else {
    throw new Error(`${toolName}: sprite index must be an integer 0..7, got ${JSON.stringify(value)}`);
  }
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 7) {
    throw new Error(`${toolName}: sprite index must be an integer 0..7, got ${JSON.stringify(value)}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Shared read helper -- BOTH handleSpriteGet and handleSpriteInspect call
// this ONE private function for their three common reads (VIC-II block,
// $DD00, sprite pointer table), so a fourth read can never be added with a
// different sidefx flag by only one of the two call sites.
// ---------------------------------------------------------------------------

interface SpriteContext {
  ok: true;
  /** The 47-byte $D000-$D02E block, indexable by `address - VICII_BASE`. */
  viciiBytes: Uint8Array;
  dd00: number;
  d018: number;
  bank: number;
  bankBase: number;
  screenBaseAddr: number;
  pointerTableAddress: number;
  /** The 8 pointer-table bytes, one per sprite. */
  pointerBytes: Uint8Array;
  /** Non-null spriteRomWindowNote() results gathered so far (the screen
   * base check only -- per-sprite data-address notes are added by each
   * handler once it knows which sprite(s) it needs). */
  notes: string[];
}

interface SpriteContextError {
  ok: false;
  result: StockErrorResult;
}

type SpriteContextResult = SpriteContext | SpriteContextError;

/**
 * Performs the three reads common to both sprite tools: the VIC-II block
 * ($D000-$D02E), $DD00 (VIC bank, one byte, a SEPARATE read because $DD00 is
 * far from $D000-$D02E and a single request spanning both would pull ~3.3 KB
 * of unrelated I/O and RAM across the wire for one byte), and the resolved
 * sprite pointer table (8 bytes at screenBase + $3F8). Every read is
 * sidefx: false. Refuses (before sending) if the resolved pointer-table
 * range would exceed the 16-bit address space.
 */
async function readSpriteContext(toolName: string, session: StockConnectSession): Promise<SpriteContextResult> {
  const viciiBody = memGetBody({ sidefx: false, start: VICII_BASE, end: VICII_END, memspace: 0x00, bank: 0x0000 });
  let viciiResponse;
  try {
    viciiResponse = await session.client.send(CommandType.MemoryGet, viciiBody);
  } catch (err) {
    return { ok: false, result: convertWireError(toolName, err) };
  }
  if (viciiResponse.type !== "memory_get") {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: the binary monitor replied with an unexpected response type ("${viciiResponse.type}"), expected "memory_get"`,
      ),
    };
  }
  if (viciiResponse.bytes.length !== VICII_LENGTH) {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: expected ${VICII_LENGTH} byte(s) for the VIC-II block, got ${viciiResponse.bytes.length} -- a short read is a wrong answer, not a partial success`,
      ),
    };
  }

  // $DD00 is far from $D000-$D02E -- a second, small read rather than one
  // wide request spanning both, which would pull ~3.3 KB of unrelated I/O
  // and RAM across the wire for one byte.
  const dd00Body = memGetBody({ sidefx: false, start: CIA2_PORT_A, end: CIA2_PORT_A, memspace: 0x00, bank: 0x0000 });
  let dd00Response;
  try {
    dd00Response = await session.client.send(CommandType.MemoryGet, dd00Body);
  } catch (err) {
    return { ok: false, result: convertWireError(toolName, err) };
  }
  if (dd00Response.type !== "memory_get") {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: the binary monitor replied with an unexpected response type ("${dd00Response.type}"), expected "memory_get"`,
      ),
    };
  }
  if (dd00Response.bytes.length !== 1) {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: expected 1 byte(s) for $DD00, got ${dd00Response.bytes.length} -- a short read is a wrong answer, not a partial success`,
      ),
    };
  }

  const dd00 = dd00Response.bytes[0]!;
  const d018 = viciiResponse.bytes[0xd018 - VICII_BASE]!;
  const bank = vicBank(dd00);
  const bankBase = vicBankBase(dd00);
  const screenBaseAddr = screenBase(d018, dd00);

  const pointerTableAddress = screenBaseAddr + SPRITE_POINTER_TABLE_OFFSET;
  const pointerTableEnd = pointerTableAddress + 7;
  if (pointerTableEnd > 0xffff) {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: the resolved sprite pointer table (screenBase 0x${screenBaseAddr.toString(16)} + 0x3f8) ` +
          `would end at 0x${pointerTableEnd.toString(16)}, past the 16-bit address space -- refusing before sending`,
      ),
    };
  }

  const pointerBody = memGetBody({ sidefx: false, start: pointerTableAddress, end: pointerTableEnd, memspace: 0x00, bank: 0x0000 });
  let pointerResponse;
  try {
    pointerResponse = await session.client.send(CommandType.MemoryGet, pointerBody);
  } catch (err) {
    return { ok: false, result: convertWireError(toolName, err) };
  }
  if (pointerResponse.type !== "memory_get") {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: the binary monitor replied with an unexpected response type ("${pointerResponse.type}"), expected "memory_get"`,
      ),
    };
  }
  if (pointerResponse.bytes.length !== 8) {
    return {
      ok: false,
      result: isErrorText(
        `${toolName}: expected 8 byte(s) for the sprite pointer table, got ${pointerResponse.bytes.length} -- a short read is a wrong answer, not a partial success`,
      ),
    };
  }

  const notes: string[] = [];
  const screenNote = spriteRomWindowNote(screenBaseAddr, bank);
  if (screenNote !== null && !notes.includes(screenNote)) {
    notes.push(screenNote);
  }

  return {
    ok: true,
    viciiBytes: viciiResponse.bytes,
    dd00,
    d018,
    bank,
    bankBase,
    screenBaseAddr,
    pointerTableAddress,
    pointerBytes: pointerResponse.bytes,
    notes,
  };
}

// ---------------------------------------------------------------------------
// vice_sprite_get
// ---------------------------------------------------------------------------

export const handleSpriteGet: StockSessionHandler = async (args, session, _deps) => {
  const toolName = "vice_sprite_get";

  if (!isPlainObject(args)) {
    return isErrorText(`${toolName}: arguments must be an object`);
  }

  const unexpected = Object.keys(args).filter((key) => key !== "sprite");
  if (unexpected.length > 0) {
    return isErrorText(`${toolName}: unexpected argument(s): ${unexpected.join(", ")} -- the only accepted argument is "sprite"`);
  }

  let spriteIndex: number | undefined;
  if (args.sprite !== undefined) {
    try {
      spriteIndex = parseSpriteIndex(args.sprite, toolName);
    } catch (err) {
      return isErrorText(err instanceof Error ? err.message : String(err));
    }
  }

  const context = await readSpriteContext(toolName, session);
  if (!context.ok) {
    return context.result;
  }

  const bytes = context.viciiBytes;
  const d015 = bytes[0xd015 - VICII_BASE]!;
  const d010 = bytes[0xd010 - VICII_BASE]!;
  const d017 = bytes[0xd017 - VICII_BASE]!;
  const d01b = bytes[0xd01b - VICII_BASE]!;
  const d01c = bytes[0xd01c - VICII_BASE]!;
  const d01d = bytes[0xd01d - VICII_BASE]!;
  const d025 = bytes[0xd025 - VICII_BASE]!;
  const d026 = bytes[0xd026 - VICII_BASE]!;

  const notes = [...context.notes];

  const allSprites: Record<string, unknown>[] = [];
  for (let index = 0; index < SPRITE_COUNT; index += 1) {
    const pointer = context.pointerBytes[index]!;
    const dataAddress = spriteDataAddress(context.dd00, pointer);
    const dataNote = spriteRomWindowNote(dataAddress, context.bank);
    if (dataNote !== null && !notes.includes(dataNote)) {
      notes.push(dataNote);
    }
    allSprites.push({
      index,
      enabled: ((d015 >> index) & 1) === 1,
      x: bytes[index * 2]! | (((d010 >> index) & 1) << 8),
      y: bytes[1 + index * 2]!,
      colour: bytes[0x27 + index]! & 0x0f,
      multicolour: ((d01c >> index) & 1) === 1,
      expandX: ((d01d >> index) & 1) === 1,
      expandY: ((d017 >> index) & 1) === 1,
      priorityBehindBackground: ((d01b >> index) & 1) === 1,
      pointer,
      dataAddress,
    });
  }

  const sprites = spriteIndex !== undefined ? [allSprites[spriteIndex]!] : allSprites;

  const payload: Record<string, unknown> = {
    ...(spriteIndex !== undefined ? { sprite: spriteIndex } : {}),
    vicBank: context.bank,
    vicBankBase: context.bankBase,
    cia2PortARaw: context.dd00,
    memorySetupRaw: context.d018,
    screenBase: context.screenBaseAddr,
    pointerTableAddress: context.pointerTableAddress,
    spriteMulticolour1: d025 & 0x0f,
    spriteMulticolour2: d026 & 0x0f,
    sprites,
    count: sprites.length,
    notes,
  };

  return stockAnswer(session.client, payload);
};

// ---------------------------------------------------------------------------
// Renderers -- mode-independent bit dump (renderSpriteBinary) and the two
// native-resolution ASCII modes (renderSpriteAscii), per D-05-04: 24 columns
// for hi-res, 12 for multicolour, always 21 rows. No normalisation, no
// expansion scaling -- these render the sprite's 63-byte DATA BLOCK, which
// is fixed-size regardless of how the VIC-II stretches it on screen via the
// X/Y expansion bits.
// ---------------------------------------------------------------------------

/** Bit-pair value (0..3) -> ASCII legend character. NOT the natural numeric
 * order -- the fork's own legend assigns %10 (2) to the sprite colour ('#')
 * and %01 (1) to multicolour 1 ('@'), so a "simplification" that maps
 * 0,1,2,3 to '.','@','#','%' in a naively-derived order would coincidentally
 * match here, but do not re-derive this table from "the numeric value" --
 * it is the fork's fixed legend, quoted, not computed. */
const MULTICOLOUR_LEGEND: Record<number, string> = { 0: ".", 1: "@", 2: "#", 3: "%" };

/** 21 strings of 24 "0"/"1" characters, MSB first within each byte, three
 * bytes per row. Mode-independent -- this is the raw bit dump. */
export function renderSpriteBinary(bytes: Uint8Array): string[] {
  if (bytes.length !== SPRITE_DATA_BYTES) {
    throw new Error(`renderSpriteBinary: expected ${SPRITE_DATA_BYTES} bytes, got ${bytes.length}`);
  }
  const rows: string[] = [];
  for (let row = 0; row < SPRITE_ROWS; row += 1) {
    let line = "";
    for (let col = 0; col < 3; col += 1) {
      const byte = bytes[row * 3 + col]!;
      for (let bit = 7; bit >= 0; bit -= 1) {
        line += (byte >> bit) & 1 ? "1" : "0";
      }
    }
    rows.push(line);
  }
  return rows;
}

/**
 * 21 strings, native resolution per mode. Hi-res (multicolour === false): 24
 * characters per row, one per bit, MSB first; a set bit renders '#', a clear
 * bit renders '.'. Multicolour (multicolour === true): 12 characters per
 * row, one per bit PAIR, taken MSB-first in pairs across the three bytes,
 * mapped through MULTICOLOUR_LEGEND.
 */
export function renderSpriteAscii(bytes: Uint8Array, multicolour: boolean): string[] {
  if (bytes.length !== SPRITE_DATA_BYTES) {
    throw new Error(`renderSpriteAscii: expected ${SPRITE_DATA_BYTES} bytes, got ${bytes.length}`);
  }
  const rows: string[] = [];
  for (let row = 0; row < SPRITE_ROWS; row += 1) {
    let line = "";
    if (!multicolour) {
      for (let col = 0; col < 3; col += 1) {
        const byte = bytes[row * 3 + col]!;
        for (let bit = 7; bit >= 0; bit -= 1) {
          line += (byte >> bit) & 1 ? "#" : ".";
        }
      }
    } else {
      for (let col = 0; col < 3; col += 1) {
        const byte = bytes[row * 3 + col]!;
        for (let pair = 3; pair >= 0; pair -= 1) {
          const value = (byte >> (pair * 2)) & 0b11;
          line += MULTICOLOUR_LEGEND[value];
        }
      }
    }
    rows.push(line);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// vice_sprite_inspect
// ---------------------------------------------------------------------------

export const handleSpriteInspect: StockSessionHandler = async (args, session, _deps) => {
  const toolName = "vice_sprite_inspect";

  if (!isPlainObject(args)) {
    return isErrorText(`${toolName}: arguments must be an object`);
  }

  const unexpected = Object.keys(args).filter((key) => key !== "sprite_number" && key !== "format");
  if (unexpected.length > 0) {
    return isErrorText(
      `${toolName}: unexpected argument(s): ${unexpected.join(", ")} -- the only accepted arguments are "sprite_number" and "format"`,
    );
  }

  if (args.sprite_number === undefined) {
    return isErrorText(`${toolName}: sprite_number is required`);
  }
  let spriteIndex: number;
  try {
    spriteIndex = parseSpriteIndex(args.sprite_number, toolName);
  } catch (err) {
    return isErrorText(err instanceof Error ? err.message : String(err));
  }

  // All `format` refusals happen before any wire send.
  let format = "ascii";
  if (args.format !== undefined) {
    if (typeof args.format !== "string") {
      return isErrorText(`${toolName}: format must be a string, got ${typeof args.format}`);
    }
    if (REFUSED_INSPECT_FORMATS.includes(args.format)) {
      return isErrorText(
        `${toolName}: format "png_base64" was cut from this milestone with SHOT-01..SHOT-05 -- no skill calls it. ` +
          `Served formats are: ${SERVED_INSPECT_FORMATS.join(", ")}.`,
      );
    }
    if (!SERVED_INSPECT_FORMATS.includes(args.format)) {
      return isErrorText(
        `${toolName}: format must be one of ${SERVED_INSPECT_FORMATS.join(", ")}, got ${JSON.stringify(args.format)}`,
      );
    }
    format = args.format;
  }

  const context = await readSpriteContext(toolName, session);
  if (!context.ok) {
    return context.result;
  }

  const bytes = context.viciiBytes;
  const d015 = bytes[0xd015 - VICII_BASE]!;
  const d010 = bytes[0xd010 - VICII_BASE]!;
  const d017 = bytes[0xd017 - VICII_BASE]!;
  const d01b = bytes[0xd01b - VICII_BASE]!;
  const d01c = bytes[0xd01c - VICII_BASE]!;
  const d01d = bytes[0xd01d - VICII_BASE]!;
  const d025 = bytes[0xd025 - VICII_BASE]!;
  const d026 = bytes[0xd026 - VICII_BASE]!;

  const pointer = context.pointerBytes[spriteIndex]!;
  const dataAddress = spriteDataAddress(context.dd00, pointer);
  const dataEnd = dataAddress + SPRITE_DATA_BYTES - 1;
  if (dataEnd > 0xffff) {
    return isErrorText(
      `${toolName}: sprite ${spriteIndex}'s resolved data address (pointer 0x${pointer.toString(16)} -> ` +
        `0x${dataAddress.toString(16)}) would end at 0x${dataEnd.toString(16)}, past the 16-bit address space -- refusing before sending`,
    );
  }

  const dataBody = memGetBody({ sidefx: false, start: dataAddress, end: dataEnd, memspace: 0x00, bank: 0x0000 });
  let dataResponse;
  try {
    dataResponse = await session.client.send(CommandType.MemoryGet, dataBody);
  } catch (err) {
    return convertWireError(toolName, err);
  }
  if (dataResponse.type !== "memory_get") {
    return isErrorText(
      `${toolName}: the binary monitor replied with an unexpected response type ("${dataResponse.type}"), expected "memory_get"`,
    );
  }
  if (dataResponse.bytes.length !== SPRITE_DATA_BYTES) {
    return isErrorText(
      `${toolName}: expected ${SPRITE_DATA_BYTES} byte(s) for the sprite data block, got ${dataResponse.bytes.length} -- a short read is a wrong answer, not a partial success`,
    );
  }

  const multicolour = ((d01c >> spriteIndex) & 1) === 1;
  const expandX = ((d01d >> spriteIndex) & 1) === 1;
  const expandY = ((d017 >> spriteIndex) & 1) === 1;

  const notes = [...context.notes];
  const dataNote = spriteRomWindowNote(dataAddress, context.bank);
  if (dataNote !== null && !notes.includes(dataNote)) {
    notes.push(dataNote);
  }
  if (expandX || expandY) {
    notes.push(
      "the rendered grid is the sprite's 24x21 data block and is NOT scaled by the X/Y expansion bits -- " +
        "the VIC-II stretches the sprite on screen, but MEM_GET returns the unscaled 63-byte block",
    );
  }

  const rows = format === "binary" ? renderSpriteBinary(dataResponse.bytes) : renderSpriteAscii(dataResponse.bytes, multicolour);
  const width = multicolour ? SPRITE_MULTICOLOUR_COLUMNS : SPRITE_HIRES_COLUMNS;

  const payload: Record<string, unknown> = {
    sprite: spriteIndex,
    format,
    multicolour,
    enabled: ((d015 >> spriteIndex) & 1) === 1,
    x: bytes[spriteIndex * 2]! | (((d010 >> spriteIndex) & 1) << 8),
    y: bytes[1 + spriteIndex * 2]!,
    colour: bytes[0x27 + spriteIndex]! & 0x0f,
    expandX,
    expandY,
    priorityBehindBackground: ((d01b >> spriteIndex) & 1) === 1,
    spriteMulticolour1: d025 & 0x0f,
    spriteMulticolour2: d026 & 0x0f,
    vicBank: context.bank,
    pointer,
    dataAddress,
    width,
    height: SPRITE_ROWS,
    bytes: Array.from(dataResponse.bytes),
    rows,
    ...(format === "ascii" ? { ascii: rows.join("\n"), legend: SPRITE_ASCII_LEGEND } : {}),
    notes,
  };

  return stockAnswer(session.client, payload);
};
