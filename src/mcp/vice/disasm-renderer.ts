// disasm-renderer.ts
//
// The pure `render(instructions, opts) -> string` / `renderLine(instruction,
// opts) -> string` pair that turns decoded 6510 instructions (04-03's
// `Instruction[]`) into ACME-ready `!cpu 6510` source. D-05's standalone
// module: no protocol, no symbol-store, no emulator, no `node:` builtin.
// `stock-disassemble.ts` (04-05) wires the real symbol resolver in via
// `RenderOptions.symbolFor`; this file never imports `stock-address.ts`
// itself, so it stays importable by anything that only has an
// `Instruction[]` in hand (Phase 5's backtrace, Phase 6's CPU-history decode
// -- neither has a live symbol store).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// 04-06 feeds this module's `render()` output to a real `acme` process and
// asserts the reassembled bytes match the original stream exactly (the
// byte-exact round-trip criterion 4 requires). 04-05's `stock_disassemble`
// tool answer returns the same string in its `listing` field. Both consumers
// depend on the two invariants this file exists to enforce:
//   - D-09: every opcode ACME's `!cpu 6510` cannot express goes out as
//     `!byte` with all its bytes, never as a mnemonic ACME would reject.
//   - D-11: the rendered operand's width always equals the decoded
//     instruction's width, forced explicitly (`mnemonic+2`) wherever ACME
//     would otherwise re-encode a small absolute address to zero page.
//
// ---------------------------------------------------------------------------
// THE `+2` SPELLING IS AN ASSUMPTION, NOT A VERIFIED FACT (see the plan)
// ---------------------------------------------------------------------------
// ACME's documented size-forcing postfix syntax is `mnemonic+1` / `+2` /
// `+3`. ACME is not installed in this execution environment, so nothing here
// proves that spelling against a real assembler. **04-06's real-ACME
// round-trip is the proof** -- if ACME rejects `+2`, 04-06 corrects this
// file (it lists `disasm-renderer.ts` in its own `files_modified` for
// exactly this reason). Do not invent a different mechanism (padding with
// extra `!byte`, etc.) to dodge this uncertainty; `+2` is the one spelling
// this module emits everywhere the width invariant requires forcing.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never import `stock-*.ts`/`vice*.ts`/any `node:` builtin -- in
//     particular never `stock-address.ts`. The symbol lookup arrives only as
//     `opts.symbolFor`, an injected function (D-05); 04-05 wires the real
//     resolver in at the tool layer, not here.
//   - Never emit a mnemonic for an instruction whose `acmeExpressible` is
//     `false`. That is the exclusion-list approach D-09 rejected -- it ships
//     output that provably does not reassemble. Render every one of its
//     bytes as `!byte` instead, with the mnemonic moved into a comment.
//   - Never substitute a symbol into an immediate operand (the `#<`/`#>`
//     high/low-byte ambiguity, D-11) or into any zeropage-family operand (a
//     symbol whose value resolves `>= $0100` would silently widen the
//     instruction).
//   - Never emit a substituted symbol name without also emitting its own
//     `name = $XXXX` definition line in the listing header -- criterion 4's
//     "reassembles with zero external declarations" depends on it.

import type { DisasmNote, Instruction } from "./disasm-decoder.ts";
import type { AddressingMode } from "./disasm-opcodes.ts";

/**
 * Options controlling `render()`/`renderLine()`. `symbolFor` is DISASM-06's
 * injected resolver -- 04-05 wires `stock-address.ts`'s real symbol store
 * behind it; this module never imports that store itself (D-05).
 */
export interface RenderOptions {
  showSymbols?: boolean;
  symbolFor?: (address: number) => string | undefined;
  origin?: number;
}

/** Resolved, fully-defaulted options this module's internals actually work
 * against -- computed once per `render()`/`renderLine()` call. */
interface ResolvedOptions {
  showSymbols: boolean;
  symbolFor?: (address: number) => string | undefined;
  origin?: number;
}

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-schema-check.ts, disasm-decoder.ts et al. -- the one-line predicate
 * is repeated per file, never centrally imported). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True iff `value` is a representable, non-negative whole number -- the
 * same narrowing `disasm-decoder.ts` uses for its own numeric options. */
function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function resolveOptions(opts: RenderOptions | undefined): ResolvedOptions {
  const o = isPlainObject(opts) ? opts : {};
  return {
    showSymbols: o.showSymbols === true,
    symbolFor: typeof o.symbolFor === "function" ? (o.symbolFor as (address: number) => string | undefined) : undefined,
    origin: isNonNegativeSafeInteger(o.origin) ? o.origin : undefined,
  };
}

/** Renders an 8-bit value as ACME hex syntax, e.g. `$0f`. */
function hex2(value: number): string {
  return `$${(value & 0xff).toString(16).padStart(2, "0")}`;
}

/** Renders a 16-bit value as ACME hex syntax, e.g. `$d020`. */
function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

/** D-10's fixed note-text vocabulary. Every note renders through this table
 * -- never a note's own bare string literal -- so the wording stays in one
 * place. */
const NOTE_TEXT: Readonly<Record<DisasmNote, string>> = {
  "nmos-page-wrap": "NMOS page-wrap: the high byte is fetched from $xx00, not the next page",
  truncated: "truncated -- partial instruction at the end of the requested range",
  "acme-unassemblable": "not expressible in ACME !cpu 6510",
  "illegal-opcode": "illegal opcode",
};

/** Joins every note on an instruction into one `;`-comment body, in the
 * decoder's own fixed note order, `" | "`-separated (D-10). Returns `""`
 * when there are no notes -- callers must check for that before adding a
 * leading `; `. */
function formatNotesComment(notes: DisasmNote[]): string {
  if (notes.length === 0) return "";
  return notes.map((note) => NOTE_TEXT[note]).join(" | ");
}

/**
 * DISASM-06's substitution gate. Returns a resolved symbol only when
 * `opts.showSymbols` is `true`, `opts.symbolFor` is supplied, and it returns
 * a name for `address`. Callers decide, by operand role, whether they are
 * even allowed to call this at all -- immediate and zeropage-family operand
 * renderers never call it (D-11's own table).
 */
function resolveSymbol(address: number, opts: ResolvedOptions): { name: string; address: number } | undefined {
  if (!opts.showSymbols || !opts.symbolFor) return undefined;
  const name = opts.symbolFor(address);
  return name !== undefined ? { name, address } : undefined;
}

/** The suffix ACME syntax needs for an absolute-family addressing mode.
 * Typed against `disasm-opcodes.ts`'s own `AddressingMode` -- the opcode
 * table's shared vocabulary, not a locally re-derived one. */
function absoluteSuffix(mode: AddressingMode): "" | ",x" | ",y" {
  if (mode === "absolute_x") return ",x";
  if (mode === "absolute_y") return ",y";
  return "";
}

/**
 * Renders the "mnemonic + operand" text for an expressible instruction --
 * the part that, for a D-09 `!byte` substitution, moves into the trailing
 * comment instead of being emitted as real ACME source. Never called for a
 * truncated instruction (operand unknown by construction).
 */
function renderMnemonicOperand(instr: Instruction, opts: ResolvedOptions): { text: string; symbol?: { name: string; address: number } } {
  const m = instr.mnemonic;

  switch (instr.mode) {
    case "implicit":
    case "accumulator":
      return { text: m };

    case "immediate":
      // D-11: never substituted -- the `#<`/`#>` high/low-byte ambiguity.
      return { text: `${m} #${hex2(instr.operand!.value)}` };

    case "zeropage":
      // D-11: never substituted -- a symbol >= $0100 would widen this.
      return { text: `${m} ${hex2(instr.operand!.value)}` };

    case "zeropage_x":
      return { text: `${m} ${hex2(instr.operand!.value)},x` };

    case "zeropage_y":
      return { text: `${m} ${hex2(instr.operand!.value)},y` };

    case "indirect_x":
      return { text: `${m} (${hex2(instr.operand!.value)},x)` };

    case "indirect_y":
      return { text: `${m} (${hex2(instr.operand!.value)}),y` };

    case "indirect": {
      // `jmp ($xxxx)` has exactly one encoding -- substitution is safe, no
      // width force is ever needed.
      const value = instr.operand!.value;
      const symbol = resolveSymbol(value, opts);
      const addrText = symbol?.name ?? hex4(value);
      return { text: `${m} (${addrText})`, ...(symbol !== undefined ? { symbol } : {}) };
    }

    case "relative": {
      // A branch is always 2 bytes; ACME computes the offset from the
      // label, so substitution can never change the encoding.
      const target = instr.resolvedTarget!;
      const symbol = resolveSymbol(target, opts);
      const addrText = symbol?.name ?? hex4(target);
      return { text: `${m} ${addrText}`, ...(symbol !== undefined ? { symbol } : {}) };
    }

    case "absolute":
    case "absolute_x":
    case "absolute_y": {
      // D-11's width invariant: a value below $0100 renders with ACME's
      // `+2` size-forcing postfix, whether or not a symbol is substituted --
      // otherwise ACME would re-encode it to zero page and shrink the
      // instruction.
      const value = instr.operand!.value;
      const symbol = resolveSymbol(value, opts);
      const addrText = symbol?.name ?? hex4(value);
      const forceSize = value < 0x100;
      const mnemonic = forceSize ? `${m}+2` : m;
      const suffix = absoluteSuffix(instr.mode);
      return { text: `${mnemonic} ${addrText}${suffix}`, ...(symbol !== undefined ? { symbol } : {}) };
    }
  }
}

/** ACME source indent for instruction/directive lines -- purely cosmetic,
 * comments cannot affect assembly. */
const INDENT = "        ";

/**
 * Renders one `Instruction` to its listing line(s), applying D-09's `!byte`
 * substitution for anything ACME cannot express (or that decoded as
 * truncated) and D-10's note-comment vocabulary. Returns the substituted
 * symbol, if any, so `render()` can collect it into the header's symbol
 * definitions.
 */
function renderInstructionLine(instr: Instruction, opts: ResolvedOptions): { text: string; symbol?: { name: string; address: number } } {
  const notesText = formatNotesComment(instr.notes);

  if (instr.notes.includes("truncated")) {
    // DISASM-05: the operand is unknown -- never render a mnemonic. Emit
    // every byte that exists so the following instruction (if any) is never
    // reached; there is none, since a truncated instruction is always last.
    const bytesHex = instr.bytes.map(hex2).join(", ");
    return { text: `${INDENT}!byte ${bytesHex}  ; ${notesText}` };
  }

  if (!instr.acmeExpressible) {
    // D-09: every byte goes out as `!byte`, keeping the following
    // instruction at the correct address. The mnemonic and operand a human
    // reader needs move into the trailing comment instead.
    const { text: mnemonicOperand, symbol } = renderMnemonicOperand(instr, opts);
    const bytesHex = instr.bytes.map(hex2).join(", ");
    const comment = notesText ? `${mnemonicOperand}  [${notesText}]` : mnemonicOperand;
    return { text: `${INDENT}!byte ${bytesHex}  ; ${comment}`, ...(symbol !== undefined ? { symbol } : {}) };
  }

  const { text: mnemonicOperand, symbol } = renderMnemonicOperand(instr, opts);
  const text = notesText ? `${INDENT}${mnemonicOperand}  ; ${notesText}` : `${INDENT}${mnemonicOperand}`;
  return { text, ...(symbol !== undefined ? { symbol } : {}) };
}

/**
 * Renders a single instruction to one listing line -- no `!cpu 6510`
 * header, no origin, no symbol definitions. `render()` is what produces a
 * self-contained listing; this is the per-instruction primitive it and
 * standalone callers (e.g. Phase 5's backtrace, when it wants one rendered
 * line without a whole listing) share.
 */
export function renderLine(instruction: Instruction, opts?: RenderOptions): string {
  const resolved = resolveOptions(opts);
  return renderInstructionLine(instruction, resolved).text;
}

/**
 * Renders a full, self-contained ACME `!cpu 6510` listing: the header
 * (`!cpu 6510`, one `name = $XXXX` definition per substituted symbol sorted
 * by address, then `* = $XXXX`), followed by one line per instruction. This
 * is what 04-06 feeds to a real `acme` process and what 04-05's tool answer
 * returns as `listing`.
 */
export function render(instructions: Instruction[], opts?: RenderOptions): string {
  const resolved = resolveOptions(opts);
  const list = Array.isArray(instructions) ? instructions : [];

  const symbols = new Map<string, number>();
  const instructionLines: string[] = [];

  for (const instr of list) {
    const { text, symbol } = renderInstructionLine(instr, resolved);
    instructionLines.push(text);
    if (symbol !== undefined) symbols.set(symbol.name, symbol.address);
  }

  const lines: string[] = ["!cpu 6510"];

  const sortedSymbols = [...symbols.entries()].sort((a, b) => a[1] - b[1]);
  for (const [name, address] of sortedSymbols) {
    lines.push(`${name} = ${hex4(address)}`);
  }

  const origin = resolved.origin ?? list[0]?.address ?? 0;
  lines.push(`* = ${hex4(origin)}`);

  lines.push(...instructionLines);

  return lines.join("\n");
}
