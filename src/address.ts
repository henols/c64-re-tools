// Addresses for every machine: the 16-bit address as text ($ and 1 to 4 hex
// digits), address ranges, tables of addresses, the kinds of reference, and the
// syntax of a symbol name.

import { Refusal } from "./errors.ts";

/** An address as text: $ and 1 to 4 hex digits, either case. */
const ADDRESS_PATTERN = /^\$([0-9a-fA-F]{1,4})$/;

/** The address that the text gives ($ and 1 to 4 hex digits), or undefined. */
export function addressOf(text: string): number | undefined {
  const match = ADDRESS_PATTERN.exec(text);
  return match === null ? undefined : Number.parseInt(match[1]!, 16);
}

/** Returns the value when it is an address (0-$ffff). Refuses it otherwise. */
function checkAddress(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Refusal("invalid-input", `${value} is not an address: an address is from $0000 to $ffff.`);
  return value;
}

/** The address of $ and 1 to 4 hex digits. Refuses other text. */
export function parseAddress(text: string): number {
  const value = addressOf(text);
  if (value === undefined) throw new Refusal("invalid-input", `${JSON.stringify(text)} is not an address: give $ and 1 to 4 hex digits, for example $c000 or $fb.`);
  return value;
}

export function formatAddress(value: number): string {
  return `$${checkAddress(value).toString(16).padStart(4, "0")}`;
}

/** A byte as $xx. Refuses a value outside 0-255. */
export function formatByte(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new Refusal("invalid-input", `${value} is not a byte: a byte is from 0 to 255.`);
  return `$${value.toString(16).padStart(2, "0")}`;
}

/** An inclusive span of addresses. */
export interface AddressRange {
  start: number;
  end: number;
}

/** The tables of addresses: words, or words minus 1 for an RTS dispatch; a split table has all low bytes, then all high bytes. */
export const POINTER_TABLE_TYPES = ["addresses", "addresses-split", "rts-addresses", "rts-addresses-split"] as const;
export type PointerTableType = (typeof POINTER_TABLE_TYPES)[number];

/** The entries of a table of addresses in [start, end]: the address of each low and high byte, and the target that the entry names. */
export function pointerTableEntries(table: { start: number; end: number; type: PointerTableType }, byteAt: (address: number) => number): Array<{ low: number; high: number; target: number }> {
  const length = table.end - table.start + 1;
  const split = table.type === "addresses-split" || table.type === "rts-addresses-split";
  const minus = table.type === "rts-addresses" || table.type === "rts-addresses-split" ? 1 : 0;
  const count = Math.floor(length / 2);
  return Array.from({ length: count }, (_, index) => {
    const low = split ? table.start + index : table.start + 2 * index;
    const high = split ? table.start + count + index : low + 1;
    return { low, high, target: ((byteAt(low) | (byteAt(high) << 8)) + minus) & 0xffff };
  });
}

/** How code refers to an address. A pointer is code that builds the address from immediates. */
export const REFERENCE_KINDS = ["call", "jump", "read", "write", "reference", "pointer"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** A symbol or label name: assembler label syntax, at most 64 characters; a leading dot marks a local label. */
export const SYMBOL_NAME = /^\.?[A-Za-z_][A-Za-z0-9_]{0,63}$/;
