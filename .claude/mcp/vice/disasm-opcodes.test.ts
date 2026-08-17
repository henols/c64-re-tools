// node:test coverage of disasm-opcodes.ts -- D-06's independent bit-pattern
// derivation test. Its entire value is that it does NOT depend on the
// source the table was transcribed from (cc65's opc6502x.c): deriveMode()
// below re-derives each opcode's addressing mode from the 6502's own
// `aaabbbcc` bit structure, so a transcription typo in disasm-opcodes.ts
// fails HERE, independently of whatever produced the table. This is the
// same ethic as this repo's own post-mortem lesson from Phase 2/3: "a green
// suite written by the same pass that wrote the code proves less than it
// looks like it does."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { OPCODES, LENGTH_FOR_MODE, type AddressingMode } from "./disasm-opcodes.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------ 1. Shape

describe("shape", () => {
  test("exactly 256 entries, indexed by opcode byte", () => {
    assert.equal(OPCODES.length, 256);
  });

  test("every entry's length equals LENGTH_FOR_MODE[entry.mode]", () => {
    for (let op = 0; op < 256; op++) {
      const entry = OPCODES[op]!;
      assert.equal(entry.length, LENGTH_FOR_MODE[entry.mode], `opcode $${op.toString(16).padStart(2, "0")}`);
    }
  });

  test("every mnemonic is a lowercase three-letter string", () => {
    for (let op = 0; op < 256; op++) {
      assert.match(OPCODES[op]!.mnemonic, /^[a-z]{3}$/, `opcode $${op.toString(16).padStart(2, "0")}`);
    }
  });
});

// ------------------------------------------------- 2. Bit-pattern derivation

/**
 * Re-derives an opcode's addressing mode from the 6502's own `aaabbbcc` bit
 * decomposition (`cc = opcode & 0b11`, `bbb = (opcode >> 2) & 0b111`,
 * `aaa = opcode >> 5`), independently of disasm-opcodes.ts. Returns `null`
 * where the uniform rule for that (cc, bbb, aaa) combination does not apply
 * -- those opcodes are the table's genuine irregulars and must appear in
 * IRREGULARS below instead.
 *
 * cc === 0b01 (ORA/AND/EOR/ADC/STA/LDA/CMP/SBC, aaa 0-7): the addressing
 * mode is uniform across ALL eight aaa rows for a given bbb -- even where a
 * row has no legal instruction in that slot (e.g. STA has no immediate
 * form; $89 is the illegal NOP-immediate reuse of that slot), the MODE
 * still matches, because deriveMode only asserts mode, not mnemonic.
 */
const CC01_BY_BBB: Record<number, AddressingMode> = {
  0b000: "indirect_x",
  0b001: "zeropage",
  0b010: "immediate",
  0b011: "absolute",
  0b100: "indirect_y",
  0b101: "zeropage_x",
  0b110: "absolute_y",
  0b111: "absolute_x",
};

/**
 * cc === 0b11 (the illegal-combo group: SLO/RLA/SRE/RRA/SAX/LAX/DCP/ISC by
 * aaa 0-7) shares cc=0b01's per-bbb column layout, with two exceptions
 * handled separately below: bbb=0b010 (immediate) is never actually
 * SLO/RLA/.../ISC-immediate -- every aaa's "immediate" slot in this group is
 * repurposed as a distinct, differently-named illegal opcode (ANC, ANC,
 * ALR, ARR, ANE, LXA, SBX, the duplicate SBC) -- and bbb=0b101/0b111 (see
 * isYIndexedRow below).
 */
const CC11_BY_BBB: Record<number, AddressingMode> = {
  0b000: "indirect_x",
  0b001: "zeropage",
  0b011: "absolute",
  0b100: "indirect_y",
  0b110: "absolute_y",
};

/**
 * cc === 0b00 (BIT/JMP/JMP-indirect/STY/LDY/CPY/CPX, aaa 0-7, plus two
 * whole-column "implied op" families that share cc=00 incidentally: bbb=2
 * is PHP/PLP/PHA/PLA/DEY/TAY/INY/INX and bbb=6 is
 * CLC/SEC/CLI/SEI/TYA/CLV/TXS/... -- both uniformly "implicit" regardless
 * of aaa). bbb=0 and bbb=3 are uniform EXCEPT for the aaa rows handled as
 * explicit exceptions in deriveMode(); bbb=4 (the eight conditional
 * branches) follows a completely different "xxy10000" bit pattern and is
 * always null here.
 */
const CC00_BY_BBB: Record<number, AddressingMode> = {
  0b000: "immediate",
  0b001: "zeropage",
  0b010: "implicit",
  0b011: "absolute",
  0b101: "zeropage_x",
  0b110: "implicit",
  0b111: "absolute_x",
};

/**
 * STX/LDX and their illegal-opcode counterparts SAX/LAX are the one
 * documented family that uses Y-indexing instead of X, at exactly the
 * "zeropage,X" (bbb=0b101) and "absolute,X" (bbb=0b111) slots -- true for
 * both cc=0b10 (STX aaa=4, LDX aaa=5) and cc=0b11 (SAX aaa=4, LAX aaa=5).
 */
function isYIndexedRow(aaa: number): boolean {
  return aaa === 4 || aaa === 5;
}

function deriveMode(opcode: number): AddressingMode | null {
  const cc = opcode & 0b11;
  const bbb = (opcode >> 2) & 0b111;
  const aaa = opcode >> 5;

  if (cc === 0b01) return CC01_BY_BBB[bbb]!;

  if (cc === 0b11) {
    if (bbb === 0b101) return isYIndexedRow(aaa) ? "zeropage_y" : "zeropage_x";
    if (bbb === 0b111) return isYIndexedRow(aaa) ? "absolute_y" : "absolute_x";
    return CC11_BY_BBB[bbb] ?? null; // bbb=0b010: the combo-op column, always null
  }

  if (cc === 0b00) {
    // aaa 0-3 at bbb=0: BRK/JSR/RTI/RTS -- a control-flow exception, not
    // part of the BIT/JMP/STY/LDY/CPY/CPX-immediate family that otherwise
    // uniformly occupies this column for aaa 4-7.
    if (bbb === 0b000 && aaa <= 3) return null;
    // aaa=3 at bbb=3: JMP ($xxxx) indirect -- the one exception in an
    // otherwise uniform "absolute" column (BIT/JMP-abs/STY/LDY/CPY/CPX).
    if (bbb === 0b011 && aaa === 3) return null;
    // bbb=4: the eight conditional branches follow the "xxy10000" pattern,
    // not this one.
    if (bbb === 0b100) return null;
    return CC00_BY_BBB[bbb] ?? null;
  }

  // cc === 0b10 (ASL/ROL/LSR/ROR/STX/LDX/DEC/INC, aaa 0-7)
  if (bbb === 0b001) return "zeropage";
  if (bbb === 0b011) return "absolute";
  if (bbb === 0b101) return isYIndexedRow(aaa) ? "zeropage_y" : "zeropage_x";
  if (bbb === 0b111) return isYIndexedRow(aaa) ? "absolute_y" : "absolute_x";
  if (bbb === 0b110) return "implicit";
  // bbb=0: aaa 0-3 are JAM (no legal ASL/ROL/LSR/ROR-immediate exists); aaa
  // 4-7 are uniformly "immediate" (STX has no immediate form legally, so
  // its slot is NOP-immediate reuse, but the mode still matches; LDX # is
  // the legitimate one).
  if (bbb === 0b000) return aaa <= 3 ? null : "immediate";
  // bbb=2: aaa 0-3 are the four shift ops' accumulator form (ASL/ROL/LSR/
  // ROR A); aaa 4-7 are the single-byte register-transfer/NOP family
  // (TXA/TAX/DEX/NOP) -- "implicit", not "accumulator".
  if (bbb === 0b010) return aaa <= 3 ? "accumulator" : "implicit";
  // bbb=4: JAM, uniformly, for every aaa.
  return null;
}

/**
 * Every opcode for which deriveMode() legitimately cannot produce a mode
 * (see the comments above): BRK/JSR/RTI/RTS, the one JMP-indirect, the
 * eight conditional branches, all 12 JAMs, and the eight cc=0b11
 * "immediate combo-op" opcodes (ANC x2, ALR, ARR, ANE, LXA, SBX, the
 * duplicate SBC). 33 entries total. Verified against masswerk.at and
 * oxyron.de in addition to cc65.
 */
const IRREGULARS: Record<number, { mode: AddressingMode; length: 1 | 2 | 3 }> = {
  0x00: { mode: "implicit", length: 1 }, // brk
  0x02: { mode: "implicit", length: 1 }, // jam
  0x0b: { mode: "immediate", length: 2 }, // anc
  0x10: { mode: "relative", length: 2 }, // bpl
  0x12: { mode: "implicit", length: 1 }, // jam
  0x20: { mode: "absolute", length: 3 }, // jsr
  0x22: { mode: "implicit", length: 1 }, // jam
  0x2b: { mode: "immediate", length: 2 }, // anc
  0x30: { mode: "relative", length: 2 }, // bmi
  0x32: { mode: "implicit", length: 1 }, // jam
  0x40: { mode: "implicit", length: 1 }, // rti
  0x42: { mode: "implicit", length: 1 }, // jam
  0x4b: { mode: "immediate", length: 2 }, // alr
  0x50: { mode: "relative", length: 2 }, // bvc
  0x52: { mode: "implicit", length: 1 }, // jam
  0x60: { mode: "implicit", length: 1 }, // rts
  0x62: { mode: "implicit", length: 1 }, // jam
  0x6b: { mode: "immediate", length: 2 }, // arr
  0x6c: { mode: "indirect", length: 3 }, // jmp (indirect)
  0x70: { mode: "relative", length: 2 }, // bvs
  0x72: { mode: "implicit", length: 1 }, // jam
  0x8b: { mode: "immediate", length: 2 }, // ane
  0x90: { mode: "relative", length: 2 }, // bcc
  0x92: { mode: "implicit", length: 1 }, // jam
  0xab: { mode: "immediate", length: 2 }, // lxa
  0xb0: { mode: "relative", length: 2 }, // bcs
  0xb2: { mode: "implicit", length: 1 }, // jam
  0xcb: { mode: "immediate", length: 2 }, // sbx
  0xd0: { mode: "relative", length: 2 }, // bne
  0xd2: { mode: "implicit", length: 1 }, // jam
  0xeb: { mode: "immediate", length: 2 }, // sbc (duplicate)
  0xf0: { mode: "relative", length: 2 }, // beq
  0xf2: { mode: "implicit", length: 1 }, // jam
};

describe("bit-pattern derivation (exhaustive over all 256 opcodes)", () => {
  test("every opcode either matches deriveMode() or is a declared irregular", () => {
    for (let op = 0; op < 256; op++) {
      const hex = `$${op.toString(16).padStart(2, "0")}`;
      const derived = deriveMode(op);
      if (derived !== null) {
        assert.equal(OPCODES[op]!.mode, derived, `${hex}: expected derived mode "${derived}"`);
      } else {
        assert.ok(op in IRREGULARS, `${hex}: not derivable and missing from IRREGULARS`);
        const declared = IRREGULARS[op]!;
        assert.equal(OPCODES[op]!.mode, declared.mode, `${hex}: IRREGULARS mode mismatch`);
        assert.equal(OPCODES[op]!.length, declared.length, `${hex}: IRREGULARS length mismatch`);
      }
    }
  });

  test("IRREGULARS has no dead entries -- every listed opcode's mode is genuinely NOT derivable", () => {
    for (const key of Object.keys(IRREGULARS)) {
      const op = Number(key);
      const derived = deriveMode(op);
      assert.equal(derived, null, `$${op.toString(16).padStart(2, "0")} is listed in IRREGULARS but deriveMode() would have matched it (dead entry hiding a real defect)`);
    }
  });

  test("IRREGULARS has exactly 33 entries", () => {
    assert.equal(Object.keys(IRREGULARS).length, 33);
  });
});

// ------------------------------------------------------------- 3. NOP class

// CORRECTION (ROADMAP.md criterion 2 and 04-CONTEXT.md D-09 both say
// "twelve NOP variants" -- that figure does not match any standard
// 6502/6510 opcode enumeration; see 04-RESEARCH.md Common Pitfalls
// Pitfall 1). The real illegal-NOP class is 27 opcodes across 6
// addressing-mode groups, verified against cc65's live source, masswerk.at
// and oxyron.de. Do NOT reduce this to twelve hardcoded cases.
const NOP_CLASS: ReadonlyArray<{ opcodes: number[]; mode: AddressingMode; length: 1 | 2 | 3 }> = [
  { opcodes: [0x1a, 0x3a, 0x5a, 0x7a, 0xda, 0xfa], mode: "implicit", length: 1 },
  { opcodes: [0x80, 0x82, 0x89, 0xc2, 0xe2], mode: "immediate", length: 2 },
  { opcodes: [0x04, 0x44, 0x64], mode: "zeropage", length: 2 },
  { opcodes: [0x14, 0x34, 0x54, 0x74, 0xd4, 0xf4], mode: "zeropage_x", length: 2 },
  { opcodes: [0x0c], mode: "absolute", length: 3 },
  { opcodes: [0x1c, 0x3c, 0x5c, 0x7c, 0xdc, 0xfc], mode: "absolute_x", length: 3 },
];

describe("NOP class -- 27 opcodes across 6 addressing-mode groups (see correction comment above)", () => {
  for (const group of NOP_CLASS) {
    for (const op of group.opcodes) {
      test(`$${op.toString(16).padStart(2, "0")}: illegal nop, ${group.mode}, length ${group.length}`, () => {
        const entry = OPCODES[op]!;
        assert.equal(entry.mnemonic, "nop");
        assert.equal(entry.mode, group.mode);
        assert.equal(entry.length, group.length);
        assert.equal(entry.illegal, true);
      });
    }
  }

  test("exactly 27 illegal nop entries across the whole table", () => {
    const illegalNops = OPCODES.filter((e) => e.mnemonic === "nop" && e.illegal);
    assert.equal(illegalNops.length, 27);
  });

  test("$EA is the only legal nop", () => {
    const legalNops = OPCODES.map((e, op) => ({ e, op })).filter(({ e }) => e.mnemonic === "nop" && !e.illegal);
    assert.equal(legalNops.length, 1);
    assert.equal(legalNops[0]!.op, 0xea);
  });

  test("the 6 NOP_CLASS groups above cover exactly the 27 illegal opcodes, no overlap, no gap", () => {
    const all = NOP_CLASS.flatMap((g) => g.opcodes);
    assert.equal(all.length, 27);
    assert.equal(new Set(all).size, 27); // no duplicates across groups
    const illegalNopOpcodes = OPCODES.map((e, op) => ({ e, op }))
      .filter(({ e }) => e.mnemonic === "nop" && e.illegal)
      .map(({ op }) => op);
    assert.deepEqual([...all].sort((a, b) => a - b), illegalNopOpcodes.sort((a, b) => a - b));
  });
});

// ------------------------------------------------------------- 4. JAM class

const JAM_OPCODES = [0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2];

describe("JAM class -- exactly 12 opcodes", () => {
  for (const op of JAM_OPCODES) {
    test(`$${op.toString(16).padStart(2, "0")}: jam, implicit, length 1, illegal, acmeExpressible`, () => {
      const entry = OPCODES[op]!;
      assert.equal(entry.mnemonic, "jam");
      assert.equal(entry.mode, "implicit");
      assert.equal(entry.length, 1);
      assert.equal(entry.illegal, true);
      // "jam" is in acme-build/SKILL.md's 18 verified !cpu 6510 illegal
      // mnemonics, so ACME accepts it.
      assert.equal(entry.acmeExpressible, true);
    });
  }

  test("exactly 12 jam entries across the whole table", () => {
    const jams = OPCODES.filter((e) => e.mnemonic === "jam");
    assert.equal(jams.length, 12);
  });
});

// ---------------------------------------------------- 5. acmeExpressible seed

describe("acmeExpressible seed sanity (D-09: 04-06's real-ACME assertion test is the authority for every value here, not this suite)", () => {
  test("every legal (illegal===false) entry is acmeExpressible", () => {
    for (let op = 0; op < 256; op++) {
      const entry = OPCODES[op]!;
      if (!entry.illegal) {
        assert.equal(entry.acmeExpressible, true, `$${op.toString(16).padStart(2, "0")}`);
      }
    }
  });

  test("every entry seeded acmeExpressible===false is illegal", () => {
    for (let op = 0; op < 256; op++) {
      const entry = OPCODES[op]!;
      if (!entry.acmeExpressible) {
        assert.equal(entry.illegal, true, `$${op.toString(16).padStart(2, "0")}`);
      }
    }
  });

  test("$8B (ane), $AB (lxa), $EB (duplicate sbc) are seeded not acmeExpressible", () => {
    assert.equal(OPCODES[0x8b]!.acmeExpressible, false);
    assert.equal(OPCODES[0xab]!.acmeExpressible, false);
    assert.equal(OPCODES[0xeb]!.acmeExpressible, false);
  });

  test("all 21 multi-byte NOP-class opcodes are seeded not acmeExpressible", () => {
    const multiByteNops = NOP_CLASS.filter((g) => g.length > 1).flatMap((g) => g.opcodes);
    assert.equal(multiByteNops.length, 21);
    for (const op of multiByteNops) {
      assert.equal(OPCODES[op]!.acmeExpressible, false, `$${op.toString(16).padStart(2, "0")}`);
    }
  });

  test("the 6 implied 1-byte NOPs are seeded per the table -- 04-06's real-ACME assertion test is the authority, not this assertion", () => {
    // This suite only pins whatever disasm-opcodes.ts currently states; it
    // does not itself judge whether ACME would accept a 1-byte NOP variant
    // like $1A. If 04-06 finds ACME disagrees, that test corrects the seed,
    // not this one.
    for (const op of [0x1a, 0x3a, 0x5a, 0x7a, 0xda, 0xfa]) {
      assert.equal(typeof OPCODES[op]!.acmeExpressible, "boolean", `$${op.toString(16).padStart(2, "0")}`);
    }
  });
});

// --------------------------------------------------------------- 6. Purity

describe("purity (DISASM-07 / D-05)", () => {
  test("disasm-opcodes.ts has zero import statements once comment lines are stripped", () => {
    const source = readFileSync(join(HERE, "disasm-opcodes.ts"), "utf8");
    // Strip `//`-comment lines before counting -- this module's own header
    // comment legitimately talks ABOUT imports ("never add an import"), so
    // counting against the raw file would false-positive on that prose.
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    const importLines = codeOnly.split("\n").filter((line) => /^\s*import\s/.test(line));
    assert.deepEqual(importLines, []);
  });
});
