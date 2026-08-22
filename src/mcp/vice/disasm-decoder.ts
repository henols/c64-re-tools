// disasm-decoder.ts
//
// The pure `decode(bytes, startAddress, opts) -> Instruction[]` function --
// D-05's standalone module. Phase 5's backtrace (DERIV-02) and Phase 6's
// CPU-history decode (GAIN-01) import THIS file directly, never a tool
// module, so a protocol import here would force those consumers to pull in
// transport code they do not need. This module has no emulator, no
// protocol, no network -- its only input is a byte array. Note: DERIV-02 and
// GAIN-01 were both cut from v0.2.0 scope on 2026-08-17 -- see the
// startAddress bound below, which is now defense-in-depth on a currently
// unreachable path rather than a guard against a live in-process caller.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS RATHER THAN LIVING INSIDE THE TOOL HANDLER
// ---------------------------------------------------------------------------
// `stock-disassemble.ts` (04-05) is the tool-facing consumer, but three other
// consumers need decoding without a socket in the picture at all: the
// renderer (04-04), Phase 5's backtrace and Phase 6's CPU-history decode.
// Keeping decode() import-free of `stock-*.ts`/`vice*.ts`/any `node:`
// builtin means all four can depend on this one file without dragging in
// transport code.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never import `stock-*.ts`, `vice*.ts` or any `node:` builtin -- the
//     only import is `./disasm-opcodes.ts`.
//   - Never throw on malformed input; return `notes: ["truncated"]` for a
//     partial instruction or `[]` for a malformed top-level argument.
//   - Never fabricate operand bytes that were not in `bytes` (DISASM-05 is
//     precisely the requirement that a partial instruction is reported, not
//     invented).
//   - Never add recursion or an unbounded loop -- the bound is what makes an
//     attacker-controlled memory image safe to decode (04-RESEARCH.md
//     Security Domain, T-04-03-01).
//   - Never fold the `<= 0xffff` upper bound into `isNonNegativeSafeInteger()`
//     or apply it to `opts.count`/`opts.end` -- those two stay unbounded by
//     design (04-REVIEW.md IN-03: the loop is always bounded by
//     `bytes.length`, so an absurd value degrades to "no effective limit",
//     never a crash or hang). Bounding them would be a behaviour change
//     dressed up as a consistency fix. The upper bound belongs only in the
//     separate `isValidStartAddress()` guard below.

import { OPCODES, type AddressingMode } from "./disasm-opcodes.ts";

/**
 * D-10's structured note vocabulary. A closed union, not a free string, so
 * the renderer (04-04) and Phase 5's backtrace can switch on it
 * exhaustively.
 */
export type DisasmNote = "nmos-page-wrap" | "truncated" | "acme-unassemblable" | "illegal-opcode";

/**
 * A decoded instruction's operand. `role` and `width` together are what
 * DISASM-06's substitution rule (D-11) reads to decide whether a symbol can
 * safely replace a literal. `value` is the operand as encoded (for
 * `relative`, the raw signed offset -- the resolved address lives in
 * `Instruction.resolvedTarget`). `width` is the operand's byte width (1 or
 * 2), always equal to `entry.length - 1`.
 */
export interface DecodedOperand {
  role: "immediate" | "zeropage" | "absolute" | "relative" | "indirect";
  value: number;
  width: 1 | 2;
}

/**
 * One decoded 6502/6510 instruction. `notes` is always present (empty array
 * when there is nothing to say), never `undefined`. `bytes` holds every
 * byte the instruction consumed, including a partial instruction's bytes.
 */
export interface Instruction {
  address: number;
  bytes: number[];
  opcode: number;
  mnemonic: string;
  mode: AddressingMode;
  illegal: boolean;
  acmeExpressible: boolean;
  operand?: DecodedOperand;
  resolvedTarget?: number;
  notes: DisasmNote[];
}

export interface DecodeOptions {
  count?: number;
  end?: number;
}

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-checkpoints.ts, stock-schema-check.ts et al. -- the one-line
 * predicate is repeated per file, never centrally imported). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True iff `value` is a representable, non-negative whole number -- the
 * shared narrowing for `startAddress`, `opts.count` and `opts.end`. A
 * non-integer, negative or non-safe-integer ("absurd") value is treated as
 * absent rather than thrown on; argument-validation refusal text is the
 * tool's job (04-05), not this module's. */
function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** True iff `value` is a valid `startAddress` -- a safe, non-negative integer
 * that additionally fits in the C64's 16-bit address space (`<= 0xffff`).
 * Deliberately separate from `isNonNegativeSafeInteger()` rather than an
 * upper bound folded into it: `opts.count`/`opts.end` must stay unbounded
 * (see the `WHAT NOT TO DO` block above and 04-REVIEW.md IN-03), so only
 * `startAddress` gets this stricter narrowing. Mirrors `stock-address.ts`'s
 * `inAddressRange()` without importing it -- D-05 keeps this module's only
 * import to `./disasm-opcodes.ts`. */
function isValidStartAddress(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
}

/** Interprets `b` as an 8-bit two's-complement signed byte, per DISASM-04's
 * branch resolution rule: `signed8(b) = b < 0x80 ? b : b - 0x100`. */
function signed8(b: number): number {
  return b < 0x80 ? b : b - 0x100;
}

/** Builds the `notes` array in the plan's mandated, deterministic order:
 * `"truncated"` first (rule 3), then `"nmos-page-wrap"` (rule 7), then
 * `"illegal-opcode"` and `"acme-unassemblable"` (rule 8) -- so the
 * renderer's output and the round-trip test are stable. */
function buildNotes(flags: { truncated: boolean; pageWrap: boolean; illegal: boolean; acmeExpressible: boolean }): DisasmNote[] {
  const notes: DisasmNote[] = [];
  if (flags.truncated) notes.push("truncated");
  if (flags.pageWrap) notes.push("nmos-page-wrap");
  if (flags.illegal) notes.push("illegal-opcode");
  if (!flags.acmeExpressible) notes.push("acme-unassemblable");
  return notes;
}

/**
 * Decodes `bytes` as a stream of 6502/6510 instructions starting at
 * `startAddress`. Bounded by construction (T-04-03-01): a single `while`
 * loop over a byte cursor, every iteration consumes at least one byte, no
 * recursion anywhere in this file. Never throws -- malformed input (a
 * non-`Uint8Array` `bytes`, a negative or non-integer `startAddress`, or a
 * `startAddress` above `0xffff`, the top of the 16-bit address space)
 * returns `[]` rather than wrapping the address into range and returning a
 * plausible-looking but wrong listing.
 */
export function decode(bytes: Uint8Array, startAddress: number, opts: DecodeOptions = {}): Instruction[] {
  if (!(bytes instanceof Uint8Array)) return [];
  if (!isValidStartAddress(startAddress)) return [];

  const options = isPlainObject(opts) ? opts : {};
  const count = isNonNegativeSafeInteger(options.count) ? options.count : undefined;
  const end = isNonNegativeSafeInteger(options.end) ? options.end : undefined;

  const instructions: Instruction[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    if (count !== undefined && instructions.length >= count) break;

    // Rule 2: address arithmetic wraps at 16 bits.
    const address = (startAddress + offset) & 0xffff;

    // Rule 9: an instruction starting past `end` is dropped entirely, not
    // emitted. Checked against the START address, before the opcode byte is
    // even read -- an instruction starting at or before `end` is emitted in
    // full even if its last byte lies past `end`.
    if (end !== undefined && address > end) break;

    const opcodeByte = bytes[offset]!;
    const entry = OPCODES[opcodeByte]!;
    const available = bytes.length - offset;

    if (available < entry.length) {
      // Rule 3 / DISASM-05: truncated instruction. Only the bytes that
      // actually exist are recorded; operand/resolvedTarget are omitted;
      // never fabricate the missing bytes. The loop stops here.
      const rawBytes: number[] = [];
      for (let i = 0; i < available; i++) rawBytes.push(bytes[offset + i]!);

      instructions.push({
        address,
        bytes: rawBytes,
        opcode: opcodeByte,
        mnemonic: entry.mnemonic,
        mode: entry.mode,
        illegal: entry.illegal,
        acmeExpressible: entry.acmeExpressible,
        notes: buildNotes({ truncated: true, pageWrap: false, illegal: entry.illegal, acmeExpressible: entry.acmeExpressible }),
      });
      break;
    }

    const rawBytes: number[] = [];
    for (let i = 0; i < entry.length; i++) rawBytes.push(bytes[offset + i]!);
    const b1 = entry.length >= 2 ? rawBytes[1]! : undefined;
    const b2 = entry.length >= 3 ? rawBytes[2]! : undefined;

    let operand: DecodedOperand | undefined;
    let resolvedTarget: number | undefined;
    let pageWrap = false;

    // Rule 4: operand extraction by mode.
    switch (entry.mode) {
      case "implicit":
      case "accumulator":
        break;

      case "immediate":
        operand = { role: "immediate", value: b1!, width: 1 };
        break;

      case "zeropage":
      case "zeropage_x":
      case "zeropage_y":
      case "indirect_x":
      case "indirect_y":
        operand = { role: "zeropage", value: b1!, width: 1 };
        break;

      case "relative":
        // Rule 5, DISASM-04: raw signed offset stays in `operand.value`;
        // the resolved absolute target (wrapped at 16 bits) is separate.
        operand = { role: "relative", value: b1!, width: 1 };
        resolvedTarget = (address + 2 + signed8(b1!)) & 0xffff;
        break;

      case "absolute":
      case "absolute_x":
      case "absolute_y": {
        const value = b1! | (b2! << 8);
        operand = { role: "absolute", value, width: 2 };
        // Rule 6: jmp absolute ($4C) and jsr absolute ($20) also resolve a
        // control-flow target, so a consumer never has to special-case
        // which operand is the target.
        if (entry.mode === "absolute" && (opcodeByte === 0x4c || opcodeByte === 0x20)) {
          resolvedTarget = value;
        }
        break;
      }

      case "indirect": {
        const value = b1! | (b2! << 8);
        operand = { role: "indirect", value, width: 2 };
        // Rule 7, D-10: NMOS page-wrap bug, jmp ($xxFF) only ($6C is the
        // only opcode using this mode).
        if (opcodeByte === 0x6c && (value & 0x00ff) === 0x00ff) {
          pageWrap = true;
        }
        break;
      }
    }

    instructions.push({
      address,
      bytes: rawBytes,
      opcode: opcodeByte,
      mnemonic: entry.mnemonic,
      mode: entry.mode,
      illegal: entry.illegal,
      acmeExpressible: entry.acmeExpressible,
      ...(operand !== undefined ? { operand } : {}),
      ...(resolvedTarget !== undefined ? { resolvedTarget } : {}),
      notes: buildNotes({ truncated: false, pageWrap, illegal: entry.illegal, acmeExpressible: entry.acmeExpressible }),
    });

    offset += entry.length;
  }

  return instructions;
}
