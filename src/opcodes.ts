// The ACME spelling of each 6510 opcode (D48, D78): the mnemonic and the addressing
// mode, undocumented opcodes included. Ghidra gives the instruction
// boundaries; this table gives the text. Where several opcodes share one
// spelling, ACME writes only one of them: the generator finds those with a
// probe and writes the others as bytes.

export type Mode = "imp" | "imm" | "zp" | "zpx" | "zpy" | "abs" | "abx" | "aby" | "ind" | "izx" | "izy" | "rel";

export interface Opcode {
  mnemonic: string;
  mode: Mode;
}

const ROWS = `
00 brk imp|01 ora izx|02 jam imp|03 slo izx|04 nop zp|05 ora zp|06 asl zp|07 slo zp|08 php imp|09 ora imm|0a asl imp|0b anc imm|0c nop abs|0d ora abs|0e asl abs|0f slo abs
10 bpl rel|11 ora izy|12 jam imp|13 slo izy|14 nop zpx|15 ora zpx|16 asl zpx|17 slo zpx|18 clc imp|19 ora aby|1a nop imp|1b slo aby|1c nop abx|1d ora abx|1e asl abx|1f slo abx
20 jsr abs|21 and izx|22 jam imp|23 rla izx|24 bit zp|25 and zp|26 rol zp|27 rla zp|28 plp imp|29 and imm|2a rol imp|2b anc imm|2c bit abs|2d and abs|2e rol abs|2f rla abs
30 bmi rel|31 and izy|32 jam imp|33 rla izy|34 nop zpx|35 and zpx|36 rol zpx|37 rla zpx|38 sec imp|39 and aby|3a nop imp|3b rla aby|3c nop abx|3d and abx|3e rol abx|3f rla abx
40 rti imp|41 eor izx|42 jam imp|43 sre izx|44 nop zp|45 eor zp|46 lsr zp|47 sre zp|48 pha imp|49 eor imm|4a lsr imp|4b asr imm|4c jmp abs|4d eor abs|4e lsr abs|4f sre abs
50 bvc rel|51 eor izy|52 jam imp|53 sre izy|54 nop zpx|55 eor zpx|56 lsr zpx|57 sre zpx|58 cli imp|59 eor aby|5a nop imp|5b sre aby|5c nop abx|5d eor abx|5e lsr abx|5f sre abx
60 rts imp|61 adc izx|62 jam imp|63 rra izx|64 nop zp|65 adc zp|66 ror zp|67 rra zp|68 pla imp|69 adc imm|6a ror imp|6b arr imm|6c jmp ind|6d adc abs|6e ror abs|6f rra abs
70 bvs rel|71 adc izy|72 jam imp|73 rra izy|74 nop zpx|75 adc zpx|76 ror zpx|77 rra zpx|78 sei imp|79 adc aby|7a nop imp|7b rra aby|7c nop abx|7d adc abx|7e ror abx|7f rra abx
80 nop imm|81 sta izx|82 nop imm|83 sax izx|84 sty zp|85 sta zp|86 stx zp|87 sax zp|88 dey imp|89 nop imm|8a txa imp|8b ane imm|8c sty abs|8d sta abs|8e stx abs|8f sax abs
90 bcc rel|91 sta izy|92 jam imp|93 sha izy|94 sty zpx|95 sta zpx|96 stx zpy|97 sax zpy|98 tya imp|99 sta aby|9a txs imp|9b tas aby|9c shy abx|9d sta abx|9e shx aby|9f sha aby
a0 ldy imm|a1 lda izx|a2 ldx imm|a3 lax izx|a4 ldy zp|a5 lda zp|a6 ldx zp|a7 lax zp|a8 tay imp|a9 lda imm|aa tax imp|ab lxa imm|ac ldy abs|ad lda abs|ae ldx abs|af lax abs
b0 bcs rel|b1 lda izy|b2 jam imp|b3 lax izy|b4 ldy zpx|b5 lda zpx|b6 ldx zpy|b7 lax zpy|b8 clv imp|b9 lda aby|ba tsx imp|bb las aby|bc ldy abx|bd lda abx|be ldx aby|bf lax aby
c0 cpy imm|c1 cmp izx|c2 nop imm|c3 dcp izx|c4 cpy zp|c5 cmp zp|c6 dec zp|c7 dcp zp|c8 iny imp|c9 cmp imm|ca dex imp|cb sbx imm|cc cpy abs|cd cmp abs|ce dec abs|cf dcp abs
d0 bne rel|d1 cmp izy|d2 jam imp|d3 dcp izy|d4 nop zpx|d5 cmp zpx|d6 dec zpx|d7 dcp zpx|d8 cld imp|d9 cmp aby|da nop imp|db dcp aby|dc nop abx|dd cmp abx|de dec abx|df dcp abx
e0 cpx imm|e1 sbc izx|e2 nop imm|e3 isc izx|e4 cpx zp|e5 sbc zp|e6 inc zp|e7 isc zp|e8 inx imp|e9 sbc imm|ea nop imp|eb sbc imm|ec cpx abs|ed sbc abs|ee inc abs|ef isc abs
f0 beq rel|f1 sbc izy|f2 jam imp|f3 isc izy|f4 nop zpx|f5 sbc zpx|f6 inc zpx|f7 isc zpx|f8 sed imp|f9 sbc aby|fa nop imp|fb isc aby|fc nop abx|fd sbc abx|fe inc abx|ff isc abx`;

export const OPCODES: readonly Opcode[] = (() => {
  const table: Opcode[] = [];
  for (const cell of ROWS.trim().split(/[|\n]/)) {
    const [code, mnemonic, mode] = cell.trim().split(" ");
    table[Number.parseInt(code!, 16)] = { mnemonic: mnemonic!, mode: mode as Mode };
  }
  return table;
})();

export const MODE_LENGTH: Record<Mode, 1 | 2 | 3> = { imp: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };

/** Every mnemonic in the table: a symbol with one of these names would read as an instruction. */
export const MNEMONICS: ReadonlySet<string> = new Set(OPCODES.map((opcode) => opcode.mnemonic));

const ZERO_PAGE_OF: Partial<Record<Mode, Mode>> = { abs: "zp", abx: "zpx", aby: "zpy" };

/** True when the mnemonic also has the zero-page form of an absolute mode: ACME would pick it for a small operand. */
export function hasZeroPageForm(mnemonic: string, mode: Mode): boolean {
  const zeroPage = ZERO_PAGE_OF[mode];
  return zeroPage !== undefined && OPCODES.some((opcode) => opcode.mnemonic === mnemonic && opcode.mode === zeroPage);
}

/** True for a mode whose operand is an address (or a branch target), so a name can stand for it. */
export function takesAddress(mode: Mode): boolean {
  return mode !== "imp" && mode !== "imm";
}

export function isZeroPageMode(mode: Mode): boolean {
  return mode === "zp" || mode === "zpx" || mode === "zpy" || mode === "izx" || mode === "izy";
}

/** How an instruction uses the address of its operand, in the order a summary lists them. */
export const USE_KINDS = ["read", "written", "modified", "called", "jumped to", "jumped through", "branched to", "pointer", "address", "table", "macro argument"] as const;
export type UseKind = (typeof USE_KINDS)[number];

const WRITES = new Set(["sta", "stx", "sty", "sax", "sha", "shx", "shy", "tas"]);
const MODIFIES = new Set(["inc", "dec", "asl", "lsr", "rol", "ror", "slo", "rla", "sre", "rra", "dcp", "isc"]);

/** The use of the operand address of an instruction that takes an address. Through (zp),y and (zp,x) the address is a pointer. */
export function useKind(opcode: number): UseKind {
  const { mnemonic, mode } = OPCODES[opcode]!;
  if (mode === "izx" || mode === "izy") return "pointer";
  if (mode === "rel") return "branched to";
  if (mnemonic === "jsr") return "called";
  if (mnemonic === "jmp") return mode === "ind" ? "jumped through" : "jumped to";
  if (WRITES.has(mnemonic)) return "written";
  if (MODIFIES.has(mnemonic)) return "modified";
  return "read";
}

const hex2 = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
const hex4 = (value: number) => `$${value.toString(16).padStart(4, "0")}`;

/** The text of the instruction in `bytes` at `pc`, for example "sta $d011" or "bne $c002". */
export function instructionText(bytes: readonly number[], pc: number): string {
  const { mnemonic, mode } = OPCODES[bytes[0]!]!;
  const low = bytes[1] ?? 0;
  const word = low | ((bytes[2] ?? 0) << 8);
  const operand: Record<Mode, string> = {
    imp: "",
    imm: `#${hex2(low)}`,
    zp: hex2(low),
    zpx: `${hex2(low)},x`,
    zpy: `${hex2(low)},y`,
    abs: hex4(word),
    abx: `${hex4(word)},x`,
    aby: `${hex4(word)},y`,
    ind: `(${hex4(word)})`,
    izx: `(${hex2(low)},x)`,
    izy: `(${hex2(low)}),y`,
    rel: hex4((pc + 2 + (low < 0x80 ? low : low - 0x100)) & 0xffff),
  };
  return operand[mode] === "" ? mnemonic : `${mnemonic} ${operand[mode]}`;
}

/**
 * The address that a read or write of the instruction in `bytes` uses, with X
 * and Y as they were before it; `byteAt` reads a zero-page pointer. Undefined
 * for a mode that uses no memory operand.
 */
export function operandAddress(bytes: readonly number[], x: number, y: number, byteAt: (address: number) => number): number | undefined {
  const { mode } = OPCODES[bytes[0]!]!;
  const low = bytes[1] ?? 0;
  const word = low | ((bytes[2] ?? 0) << 8);
  const pointer = (at: number) => byteAt(at & 0xff) | (byteAt((at + 1) & 0xff) << 8);
  switch (mode) {
    case "zp":
      return low;
    case "zpx":
      return (low + x) & 0xff;
    case "zpy":
      return (low + y) & 0xff;
    case "abs":
      return word;
    case "abx":
      return (word + x) & 0xffff;
    case "aby":
      return (word + y) & 0xffff;
    case "izx":
      return pointer(low + x);
    case "izy":
      return (pointer(low) + y) & 0xffff;
    default:
      return undefined;
  }
}
