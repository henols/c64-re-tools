#!/usr/bin/env node
// stock-address.ts
//
// THE ONE address parser for the stock backend (D-04). Every stock handler
// that accepts an address or a byte count parses it through parseAddress()/
// parseByteCount() here -- never a second, re-derived regex or range check
// in a family module.
//
// WHY THIS FILE EXISTS: re-deriving an address parser per tool family is
// this codebase's own named anti-pattern ("re-deriving a cross-cutting seam
// locally") -- the memory and checkpoint families (Phase 3) both need
// identical decimal/$hex/0x parsing and identical 0..0xffff range
// enforcement, and D-04 requires a single pluggable symbol-resolution hook
// so Phase 5's symbol store (DERIV-04) can fill it later without every call
// site changing.
//
// WHAT NOT TO DO:
//   - Never re-derive an address regex in a family module -- import
//     parseAddress()/parseByteCount() from here instead.
//   - Never treat a bare decimal string as hex here. This is the MCP
//     argument surface an agent (or a caller) types a value into, not
//     VICE's own condition lexer -- CLAUDE.md's "bare integer literals are
//     hex by default" rule belongs to the checkpoint-condition emitter, not
//     this parser. Do not conflate the two.
//   - Never implement symbol resolution in Phase 3. setSymbolResolver() is
//     a deliberately empty extension point until Phase 5's DERIV-04 symbol
//     store installs a real one; the default here stays `null`.
import { ViceError, type ViceErrorOptions } from "./vice.ts";

export interface SymbolResolver {
  resolve(name: string): number | undefined;
}

// The ONE module-level holder for the installed resolver. `null` in Phase 3
// -- no symbol resolution happens until a later phase installs one.
let symbolResolver: SymbolResolver | null = null;

/** The deliberately-empty extension point Phase 5's DERIV-04 symbol store
 * fills. Passing `null` (the Phase 3 default) restores the "no symbol table
 * loaded" refusal. */
export function setSymbolResolver(resolver: SymbolResolver | null): void {
  symbolResolver = resolver;
}

/** The one address/byte-count error type this module ever throws -- never a
 * bare Error, matching vice.ts's established ViceError hierarchy. */
export class StockAddressError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockAddressError";
  }
}

/** A bare word that COULD be a symbol name -- checked only after every
 * numeric form below has already failed to match, so a malformed numeric
 * string (e.g. "0xzz") is refused as malformed, never misread as a
 * candidate symbol. */
const SYMBOL_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function inAddressRange(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffff;
}

/**
 * Parses `input` into a 0..0xffff address (D-04). Accepted forms: a JS
 * `number` in range; a `"$hex"` string (leading `$`, hex digits,
 * case-insensitive); a `"0x"`/`"0X"` string; or a bare decimal string
 * (`"4096"`) -- decimal here, deliberately, since this is the MCP argument
 * surface, not VICE's own condition lexer where bare literals are hex.
 * Surrounding whitespace is trimmed. A symbolic name (matching
 * `/^[A-Za-z_][A-Za-z0-9_.]*$/`) refuses with "no symbol table is loaded"
 * when no resolver is installed, or "not a known symbol" when a resolver IS
 * installed but returns `undefined` -- never a parse/syntax error either
 * way (D-04's explicit requirement).
 */
export function parseAddress(input: unknown, opts: { what?: string } = {}): number {
  const what = opts.what ?? "address";

  if (typeof input === "number") {
    if (!inAddressRange(input)) {
      throw new StockAddressError(`${what}: ${input} is out of range -- expected an integer 0..65535 ($0000-$ffff)`);
    }
    return input;
  }

  if (typeof input !== "string") {
    throw new StockAddressError(`${what}: expected a number, a decimal string, a "$hex" string, or a "0x" string, got ${typeof input}`);
  }

  const trimmed = input.trim();

  if (trimmed === "") {
    throw new StockAddressError(`${what}: empty string is not a valid address`);
  }

  if (trimmed.startsWith("$")) {
    const hexPart = trimmed.slice(1);
    if (hexPart === "" || !/^[0-9a-fA-F]+$/.test(hexPart)) {
      throw new StockAddressError(`${what}: "${trimmed}" is not a valid "$hex" address -- expected "$" followed by hex digits, e.g. "$D019"`);
    }
    const value = parseInt(hexPart, 16);
    if (!inAddressRange(value)) {
      throw new StockAddressError(`${what}: "${trimmed}" (0x${value.toString(16)}) is out of range -- expected 0..65535 ($0000-$ffff)`);
    }
    return value;
  }

  if (/^0[xX]/.test(trimmed)) {
    const hexPart = trimmed.slice(2);
    if (hexPart === "" || !/^[0-9a-fA-F]+$/.test(hexPart)) {
      throw new StockAddressError(`${what}: "${trimmed}" is not a valid "0x" address -- expected "0x" followed by hex digits, e.g. "0xD019"`);
    }
    const value = parseInt(hexPart, 16);
    if (!inAddressRange(value)) {
      throw new StockAddressError(`${what}: "${trimmed}" (0x${value.toString(16)}) is out of range -- expected 0..65535 ($0000-$ffff)`);
    }
    return value;
  }

  if (/^[0-9]+$/.test(trimmed)) {
    const value = parseInt(trimmed, 10);
    if (!inAddressRange(value)) {
      throw new StockAddressError(`${what}: "${trimmed}" is out of range -- expected a decimal integer 0..65535`);
    }
    return value;
  }

  if (SYMBOL_NAME_RE.test(trimmed)) {
    if (!symbolResolver) {
      throw new StockAddressError(
        `${what}: "${trimmed}" looks like a symbol name, but no symbol table is loaded -- use a numeric address ` +
          `(decimal, "$hex", or "0x...") instead`,
      );
    }
    const resolved = symbolResolver.resolve(trimmed);
    if (resolved === undefined) {
      throw new StockAddressError(`${what}: "${trimmed}" is not a known symbol`);
    }
    if (!inAddressRange(resolved)) {
      throw new StockAddressError(`${what}: symbol "${trimmed}" resolved to ${resolved}, which is out of range 0..65535`);
    }
    return resolved;
  }

  throw new StockAddressError(`${what}: "${trimmed}" is not a valid address -- expected a decimal number, "$hex", "0x...", or a known symbol name`);
}

/**
 * Parses a byte count through the same numeric forms as parseAddress() --
 * decimal, "$hex", "0x..." -- never through the symbol path (a byte count
 * is never symbolic). Refuses `0`, negatives, non-integers, and anything
 * above `max` (default `0xffff`), so the `size`-style range check is not
 * re-derived per family either.
 */
export function parseByteCount(input: unknown, opts: { max?: number; what?: string } = {}): number {
  const max = opts.max ?? 0xffff;
  const what = opts.what ?? "byte count";

  let value: number;
  if (typeof input === "number") {
    if (!Number.isInteger(input)) {
      throw new StockAddressError(`${what}: ${input} is not an integer`);
    }
    value = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (/^\$[0-9a-fA-F]+$/.test(trimmed)) {
      value = parseInt(trimmed.slice(1), 16);
    } else if (/^0[xX][0-9a-fA-F]+$/.test(trimmed)) {
      value = parseInt(trimmed.slice(2), 16);
    } else if (/^[0-9]+$/.test(trimmed)) {
      value = parseInt(trimmed, 10);
    } else {
      throw new StockAddressError(`${what}: "${trimmed}" is not a valid byte count -- expected a decimal number, "$hex", or "0x..."`);
    }
  } else {
    throw new StockAddressError(`${what}: expected a number or a numeric string, got ${typeof input}`);
  }

  if (value <= 0 || value > max) {
    throw new StockAddressError(`${what}: ${value} is out of range -- expected 1..${max}`);
  }
  return value;
}
