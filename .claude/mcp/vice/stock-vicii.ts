#!/usr/bin/env node
// stock-vicii.ts
//
// vice_vicii_get_state -- a DERIVED tool (DERIV-05): its answer is computed
// CLIENT-SIDE from bytes ONE MEM_GET returns, never from a single
// binary-monitor opcode the way a direct tool's answer is. Registered
// through withDerivedTool("vice_vicii_get_state", { needsSession: true }, ...)
// in stock-dispatch.ts (05-07's task), never withStockSession().
//
// WHY THIS FILE EXISTS: half of criterion 3 -- "a user can read decoded
// VIC-II state on the stock backend". The binary monitor has no VIC-II
// command at all; the readable memory-mapped register block $D000-$D02E is
// all there is, and CLAUDE.md's constraint is explicit that VIC-II
// *internal* state (raster-IRQ latch, VC/VCBASE, RC, the bad-line flip-flop,
// the border flip-flops, the per-sprite DMA sequencer) is not recoverable on
// stock. Criterion 3 turns entirely on representing that honestly instead of
// defaulting a missing field to `0` or omitting the key.
//
// WHAT NOT TO DO:
//   - Never turn `sidefx` on, and never accept an argument that could turn
//     it on. $D01E (sprite-sprite collision) and $D01F (sprite-background
//     collision) CLEAR ON READ in hardware -- this tool exists specifically
//     to read them, so a side-effecting read would destroy the very state
//     the caller asked for. ONE unconditional `sidefx: false` read covers
//     the whole $D000-$D02E block; there is no per-register branch anywhere
//     in this file.
//   - Do not conflate $D019/$D01A with the collision registers. $D019 is an
//     interrupt STATUS register that does NOT clear on read (it is cleared
//     only by WRITING a 1 to a bit), and $D01A is a plain enable mask with
//     no read side effects at all. Both are decoded exactly like every other
//     byte in the block -- the discipline is one unconditional read, never a
//     per-register side-effect decision.
//   - Never report an internal-only field as `0` or omit its key. The six
//     unrecoverable fields are enumerated once in VICII_UNAVAILABLE_FIELDS
//     and the `unavailable` object on the answer is BUILT from that
//     registry, never as six hand-written literals, so the registry and the
//     answer cannot drift.
//   - Never resolve $D018's screen/charset/bitmap pointers to absolute
//     addresses here. They are bank-relative (the VIC bank lives in CIA2
//     port A, $DD00, outside this chip's register block) -- report them as
//     `screenOffset`/`charsetOffset`/`bitmapOffset` with `relativeTo: "vic
//     bank"| and let vice_cia_get_state (cia: 2) report vicBank and
//     vice_sprite_get resolve the whole pointer chain. Duplicating that
//     arithmetic here would be the "re-deriving a cross-cutting seam
//     locally" anti-pattern for a field the caller can already get from two
//     other tools.
//   - Never send anything but MEM_GET -- no ExitLoop/Exit/Continue, i.e.
//     never an unrequested resume (Phase 3 D-05). `runState` on the answer
//     (via stockAnswer()) reports the halt honestly.
//   - Never build the answer outside stockAnswer() (D-06).
//   - Never import hostpath.ts or vice-proxy.ts -- this tool takes no path
//     argument at all, and hostpath-consumers.test.ts gates this file's
//     absence from the closed host-path consumer set.
//
// FIELD-NAME PROVENANCE (Assumption A4's mitigation): every bit-field name
// below was transcribed once from
// .claude/skills/c64-memory-mapping/memmap.json's own entries for $D011
// (Screen control register #1 / VIC Control Register), $D012 (raster line),
// $D016 (Screen control register #2 / VIC Control Register), $D018 (Memory
// setup register / VIC Memory Control Register), $D019 (Interrupt status
// register / VIC Interrupt Flag Register) and $D01A (Interrupt control
// register / IRQ Mask Register), and cross-checked at write time. There is
// no automated drift check against that file -- a "committed literal,
// cross-checked once" posture, matching Phase 4 D-06's stance for the
// disassembler's opcode table.
import { CommandType, memGetBody } from "./stock-protocol.ts";
import { convertWireError, isErrorText, stockAnswer, type StockSessionHandler } from "./stock-handler.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-memory.ts, stock-disassemble.ts et al.). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Start of the VIC-II's memory-mapped register block. */
export const VICII_BASE = 0xd000;
/** End of the VIC-II's memory-mapped register block (inclusive). */
export const VICII_END = 0xd02e;
/** Length in bytes of [VICII_BASE, VICII_END] inclusive -- 47. */
export const VICII_LENGTH = VICII_END - VICII_BASE + 1;

/**
 * The six VIC-II fields the binary monitor's memory-mapped register block
 * cannot express, each paired with a reason naming WHY it is unreadable and,
 * where applicable, WHAT is readable instead. `decodeVicii()` builds the
 * answer's `unavailable` object from this registry -- never as hand-written
 * literals -- so the two cannot drift (T-05-03-02's mitigation).
 */
export const VICII_UNAVAILABLE_FIELDS: readonly (readonly [string, string])[] = Object.freeze([
  [
    "rasterIrqLine",
    "the raster-compare latch written to $D012 plus $D011 bit 7 -- reading those addresses returns the CURRENT raster line, not the compare value, and the binary monitor has no VIC-II command that exposes the latch. The current raster line IS available as this answer's own rasterLine.",
  ],
  [
    "videoCounter",
    "the VIC-II's internal VC/VCBASE video matrix counter -- not exposed anywhere in the memory-mapped register map.",
  ],
  [
    "rowCounter",
    "the VIC-II's internal RC character-row counter -- not exposed anywhere in the memory-mapped register map.",
  ],
  [
    "badLineCondition",
    "the internal bad-line flip-flop that gates VIC-II DMA steals -- not exposed anywhere in the memory-mapped register map.",
  ],
  [
    "borderFlipFlops",
    "the internal vertical and horizontal border flip-flops that gate the border unit -- not exposed anywhere in the memory-mapped register map.",
  ],
  [
    "spriteDmaState",
    "the internal per-sprite DMA / MC / MCBASE sequencer state -- not exposed anywhere in the memory-mapped register map.",
  ],
]);

/** Returns the eight per-bit booleans of `raw`, bit 0 first, so callers do
 * not repeat the shift/mask idiom eight times per register. */
function bits8(raw: number): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < 8; i += 1) {
    out.push(((raw >> i) & 1) === 1);
  }
  return out;
}

/**
 * Pure decoder over exactly 47 bytes covering $D000-$D02E. Throws a plain
 * `Error` on any other length -- the handler guards the length before
 * calling this, so a mismatch here is a programmer-error path, never a
 * caller-facing one.
 */
export function decodeVicii(bytes: Uint8Array): Record<string, unknown> {
  if (bytes.length !== VICII_LENGTH) {
    throw new Error(`decodeVicii: expected exactly ${VICII_LENGTH} bytes, got ${bytes.length}`);
  }

  const registersHex = Buffer.from(bytes).toString("hex");

  const spriteX: number[] = [];
  const spriteY: number[] = [];
  const msbByte = bytes[0x10]!;
  for (let i = 0; i < 8; i += 1) {
    const low = bytes[0x00 + i * 2]!;
    const msb = (msbByte >> i) & 1;
    spriteX.push(low | (msb << 8));
    spriteY.push(bytes[0x01 + i * 2]!);
  }

  const spriteEnabled = bits8(bytes[0x15]!);
  const spriteExpandY = bits8(bytes[0x17]!);
  const spritePriorityBehindBackground = bits8(bytes[0x1b]!);
  const spriteMulticolour = bits8(bytes[0x1c]!);
  const spriteExpandX = bits8(bytes[0x1d]!);
  const spriteColour: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    spriteColour.push(bytes[0x27 + i]! & 0x0f);
  }

  const control1Raw = bytes[0x11]!;
  const control1 = {
    raw: control1Raw,
    yScroll: control1Raw & 0x07,
    rows25: ((control1Raw >> 3) & 1) === 1,
    screenOn: ((control1Raw >> 4) & 1) === 1,
    bitmapMode: ((control1Raw >> 5) & 1) === 1,
    extendedBackgroundMode: ((control1Raw >> 6) & 1) === 1,
    rasterMsb: ((control1Raw >> 7) & 1) === 1,
  };

  const control2Raw = bytes[0x16]!;
  const control2 = {
    raw: control2Raw,
    xScroll: control2Raw & 0x07,
    columns40: ((control2Raw >> 3) & 1) === 1,
    multicolourMode: ((control2Raw >> 4) & 1) === 1,
  };

  const rasterLine = bytes[0x12]! | (((control1Raw >> 7) & 1) << 8);
  const lightPenX = bytes[0x13]!;
  const lightPenY = bytes[0x14]!;

  const memorySetupRaw = bytes[0x18]!;
  const memorySetup = {
    raw: memorySetupRaw,
    screenOffset: ((memorySetupRaw >> 4) & 0x0f) * 1024,
    charsetOffset: ((memorySetupRaw >> 1) & 0x07) * 2048,
    bitmapOffset: ((memorySetupRaw >> 3) & 0x01) * 8192,
    relativeTo: "vic bank",
  };

  const interruptStatusRaw = bytes[0x19]!;
  const interruptStatus = {
    raw: interruptStatusRaw,
    rasterIrq: (interruptStatusRaw & 1) === 1,
    spriteBackgroundCollisionIrq: ((interruptStatusRaw >> 1) & 1) === 1,
    spriteSpriteCollisionIrq: ((interruptStatusRaw >> 2) & 1) === 1,
    lightPenIrq: ((interruptStatusRaw >> 3) & 1) === 1,
    anyIrqPending: ((interruptStatusRaw >> 7) & 1) === 1,
  };

  const interruptEnableRaw = bytes[0x1a]!;
  const interruptEnable = {
    raw: interruptEnableRaw,
    rasterIrqEnabled: (interruptEnableRaw & 1) === 1,
    spriteBackgroundCollisionIrqEnabled: ((interruptEnableRaw >> 1) & 1) === 1,
    spriteSpriteCollisionIrqEnabled: ((interruptEnableRaw >> 2) & 1) === 1,
    lightPenIrqEnabled: ((interruptEnableRaw >> 3) & 1) === 1,
  };

  const spriteSpriteCollisionRaw = bytes[0x1e]!;
  const spriteSpriteCollision = {
    raw: spriteSpriteCollisionRaw,
    sprites: bits8(spriteSpriteCollisionRaw),
  };

  const spriteBackgroundCollisionRaw = bytes[0x1f]!;
  const spriteBackgroundCollision = {
    raw: spriteBackgroundCollisionRaw,
    sprites: bits8(spriteBackgroundCollisionRaw),
  };

  const borderColour = bytes[0x20]! & 0x0f;
  const backgroundColour = bytes[0x21]! & 0x0f;
  const extraBackgroundColour1 = bytes[0x22]! & 0x0f;
  const extraBackgroundColour2 = bytes[0x23]! & 0x0f;
  const extraBackgroundColour3 = bytes[0x24]! & 0x0f;
  const spriteMulticolour1 = bytes[0x25]! & 0x0f;
  const spriteMulticolour2 = bytes[0x26]! & 0x0f;

  const unavailable: Record<string, { available: false; reason: string }> = {};
  for (const [name, reason] of VICII_UNAVAILABLE_FIELDS) {
    unavailable[name] = { available: false, reason };
  }

  return {
    registersHex,
    spriteX,
    spriteY,
    spriteEnabled,
    spriteExpandY,
    spritePriorityBehindBackground,
    spriteMulticolour,
    spriteExpandX,
    spriteColour,
    control1,
    control2,
    rasterLine,
    lightPenX,
    lightPenY,
    memorySetup,
    interruptStatus,
    interruptEnable,
    spriteSpriteCollision,
    spriteBackgroundCollision,
    borderColour,
    backgroundColour,
    extraBackgroundColour1,
    extraBackgroundColour2,
    extraBackgroundColour3,
    spriteMulticolour1,
    spriteMulticolour2,
    unavailable,
  };
}

export const handleViciiGetState: StockSessionHandler = async (args, session, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_vicii_get_state: arguments must be an object");
  }

  const unexpected = Object.keys(args);
  if (unexpected.length > 0) {
    return isErrorText(`vice_vicii_get_state: unexpected argument(s): ${unexpected.join(", ")} -- this tool takes no arguments`);
  }

  const body = memGetBody({ sidefx: false, start: VICII_BASE, end: VICII_END, memspace: 0x00, bank: 0x0000 });

  let response;
  try {
    response = await session.client.send(CommandType.MemoryGet, body);
  } catch (err) {
    return convertWireError("vice_vicii_get_state", err);
  }

  if (response.type !== "memory_get") {
    return isErrorText(
      `vice_vicii_get_state: the binary monitor replied with an unexpected response type ("${response.type}"), expected "memory_get"`,
    );
  }

  if (response.bytes.length !== VICII_LENGTH) {
    return isErrorText(
      `vice_vicii_get_state: expected ${VICII_LENGTH} byte(s), got ${response.bytes.length} -- a short read is a wrong answer, not a partial success`,
    );
  }

  return stockAnswer(session.client, {
    base: VICII_BASE,
    end: VICII_END,
    length: VICII_LENGTH,
    ...decodeVicii(response.bytes),
  });
};
