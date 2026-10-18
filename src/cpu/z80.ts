// The Z80 as a Cpu. The decoder splits an opcode into x (bits 7-6), y (5-3),
// z (2-0), p (5-4) and q (3), as in "Decoding Z80 opcodes" (z80.info), for
// every prefix: none, CB, ED, DD/FD (IX/IY) and DD CB d op / FD CB d op. It
// knows the undocumented forms (IXH, IXL, SLL, the register copy of DD CB) and
// gives an ED opcode with no instruction as a two-byte NOP. The text is in the
// Zilog syntax that sjasmplus reads.

import type { ByteAt, Cpu, Instruction } from "../cpu.ts";

const R = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];
const RP = ["bc", "de", "hl", "sp"];
const RP2 = ["bc", "de", "hl", "af"];
const CC = ["nz", "z", "nc", "c", "po", "pe", "p", "m"];
const ALU = ["add a,", "adc a,", "sub ", "sbc a,", "and ", "xor ", "or ", "cp "];
const ROT = ["rlc", "rrc", "rl", "rr", "sla", "sra", "sll", "srl"];
const IM = ["0", "0", "1", "2", "0", "0", "1", "2"];
const BLOCK = [
  ["ldi", "cpi", "ini", "outi"],
  ["ldd", "cpd", "ind", "outd"],
  ["ldir", "cpir", "inir", "otir"],
  ["lddr", "cpdr", "indr", "otdr"],
];
const LOAD_ACC = ["rlca", "rrca", "rla", "rra", "daa", "cpl", "scf", "ccf"];

const byte = (value: number) => `$${(value & 0xff).toString(16).padStart(2, "0")}`;
const word = (value: number) => `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
const signed = (value: number) => (value < 0x80 ? value : value - 0x100);

/** The register names under an index prefix: hl is ix, h and l are ixh and ixl, (hl) is (ix+d). */
interface Names {
  r: (index: number) => string;
  rp: (index: number) => string;
  rp2: (index: number) => string;
  hl: string;
}

function names(index: "" | "ix" | "iy", displacement: number | undefined, memory: boolean): Names {
  if (index === "") return { r: (i) => R[i]!, rp: (i) => RP[i]!, rp2: (i) => RP2[i]!, hl: "hl" };
  const d = displacement ?? 0;
  const at = `(${index}${signed(d) < 0 ? "-" : "+"}${byte(Math.abs(signed(d)))})`;
  // With a memory operand (ix+d), the other h and l of the instruction stay h and l.
  const r = (i: number) => (i === 6 ? at : !memory && i === 4 ? `${index}h` : !memory && i === 5 ? `${index}l` : R[i]!);
  return { r, rp: (i) => (i === 2 ? index : RP[i]!), rp2: (i) => (i === 2 ? index : RP2[i]!), hl: index };
}

/** Does the opcode (without prefix) use (hl) as a memory operand, which takes a displacement under DD or FD? */
function usesMemoryHl(opcode: number): boolean {
  const x = opcode >> 6;
  const y = (opcode >> 3) & 7;
  const z = opcode & 7;
  if (x === 0) return (z === 4 || z === 5 || z === 6) && y === 6;
  if (x === 1) return opcode !== 0x76 && (y === 6 || z === 6);
  if (x === 2) return z === 6;
  return false;
}

export const Z80: Cpu = {
  id: "z80",
  maxInstructionLength: 4,
  decode(byteAt: ByteAt, address: number): Instruction | undefined {
    const first = byteAt(address);
    if (first === undefined) return undefined;
    let missing = false;
    const at = (offset: number) => {
      const value = byteAt((address + offset) & 0xffff);
      if (value === undefined) missing = true;
      return value ?? 0;
    };
    const decoded = decodeAt(first, at, address);
    // An operand outside the image: the length stands, the values do not.
    if (missing) {
      delete decoded.text;
      delete decoded.branch;
      delete decoded.jump;
      delete decoded.callTarget;
    }
    return decoded;
  },
};

function decodeAt(first: number, at: (offset: number) => number, address: number): Instruction {
  if (first === 0xcb) return cb(at(1), names("", undefined, false), 2);
  if (first === 0xed) return ed(at(1), at);
  if (first === 0xdd || first === 0xfd) {
    const index = first === 0xdd ? "ix" : "iy";
    const opcode = at(1);
    // A prefix before another prefix does nothing: it is an instruction of one byte.
    if (opcode === 0xdd || opcode === 0xfd || opcode === 0xed) return { length: 1, fallsThrough: true, call: false, text: "nop" };
    if (opcode === 0xcb) return indexedCb(index, at(2), at(3));
    const memory = usesMemoryHl(opcode);
    const displacement = memory ? at(2) : undefined;
    // An immediate operand comes after the displacement.
    return main(opcode, (offset) => at(offset + (memory ? 2 : 1)), address, names(index, displacement, memory), 1 + (memory ? 1 : 0));
  }
  return main(first, (offset) => at(offset), address, names("", undefined, false), 0);
}

/** An unprefixed opcode, or one after DD/FD; `operand(1)` is its first operand byte, `extra` the bytes before it. */
function main(opcode: number, operand: (offset: number) => number, address: number, n: Names, extra: number): Instruction {
  const x = opcode >> 6;
  const y = (opcode >> 3) & 7;
  const z = opcode & 7;
  const p = y >> 1;
  const q = y & 1;
  const plain = (length: number, text: string, more: Partial<Instruction> = {}): Instruction => ({ length: length + extra, fallsThrough: true, call: false, text, ...more });
  const nn = () => operand(1) | (operand(2) << 8);
  const relative = () => (address + extra + 2 + signed(operand(1))) & 0xffff;
  if (x === 0) {
    switch (z) {
      case 0:
        if (y === 0) return plain(1, "nop");
        if (y === 1) return plain(1, "ex af,af'");
        if (y === 2) return plain(2, `djnz ${word(relative())}`, { branch: relative() });
        if (y === 3) return plain(2, `jr ${word(relative())}`, { jump: relative(), fallsThrough: false });
        return plain(2, `jr ${CC[y - 4]},${word(relative())}`, { branch: relative() });
      case 1:
        return q === 0 ? plain(3, `ld ${n.rp(p)},${word(nn())}`) : plain(1, `add ${n.hl},${n.rp(p)}`);
      case 2: {
        const target = ["(bc)", "(de)", `(${word(nn())})`, `(${word(nn())})`][p]!;
        const register = p === 2 ? n.hl : "a";
        const length = p >= 2 ? 3 : 1;
        return plain(length, q === 0 ? `ld ${target},${register}` : `ld ${register},${target}`);
      }
      case 3:
        return plain(1, `${q === 0 ? "inc" : "dec"} ${n.rp(p)}`);
      case 4:
        return plain(1, `inc ${n.r(y)}`);
      case 5:
        return plain(1, `dec ${n.r(y)}`);
      case 6:
        return plain(2, `ld ${n.r(y)},${byte(operand(1))}`);
      default:
        return plain(1, LOAD_ACC[y]!);
    }
  }
  if (x === 1) {
    if (opcode === 0x76) return plain(1, "halt");
    return plain(1, `ld ${n.r(y)},${n.r(z)}`);
  }
  if (x === 2) return plain(1, `${ALU[y]}${n.r(z)}`);
  switch (z) {
    case 0:
      return plain(1, `ret ${CC[y]}`);
    case 1:
      if (q === 0) return plain(1, `pop ${n.rp2(p)}`);
      if (p === 0) return plain(1, "ret", { fallsThrough: false });
      if (p === 1) return plain(1, "exx");
      if (p === 2) return plain(1, `jp (${n.hl})`, { fallsThrough: false });
      return plain(1, `ld sp,${n.hl}`);
    case 2:
      return plain(3, `jp ${CC[y]},${word(nn())}`, { branch: nn() });
    case 3:
      if (y === 0) return plain(3, `jp ${word(nn())}`, { jump: nn(), fallsThrough: false });
      if (y === 2) return plain(2, `out (${byte(operand(1))}),a`);
      if (y === 3) return plain(2, `in a,(${byte(operand(1))})`);
      return plain(1, ["", "", "", "", `ex (sp),${n.hl}`, "ex de,hl", "di", "ei"][y]!);
    case 4:
      return plain(3, `call ${CC[y]},${word(nn())}`, { call: true, callTarget: nn() });
    case 5:
      if (q === 0) return plain(1, `push ${n.rp2(p)}`);
      return plain(3, `call ${word(nn())}`, { call: true, callTarget: nn() });
    case 6:
      return plain(2, `${ALU[y]}${byte(operand(1))}`);
    default:
      return plain(1, `rst ${byte(y * 8)}`, { call: true, callTarget: y * 8 });
  }
}

function cb(opcode: number, n: Names, length: number): Instruction {
  const x = opcode >> 6;
  const y = (opcode >> 3) & 7;
  const z = opcode & 7;
  const text = x === 0 ? `${ROT[y]} ${n.r(z)}` : `${["", "bit", "res", "set"][x]} ${y},${n.r(z)}`;
  return { length, fallsThrough: true, call: false, text };
}

/** DD CB d op and FD CB d op. With a register other than (hl), rotations, RES and SET also copy the result into it. */
function indexedCb(index: "ix" | "iy", displacement: number, opcode: number): Instruction {
  const x = opcode >> 6;
  const y = (opcode >> 3) & 7;
  const z = opcode & 7;
  const memory = names(index, displacement, true).r(6);
  const copy = z === 6 || x === 1 ? "" : `,${R[z]}`;
  const text = x === 0 ? `${ROT[y]} ${memory}${copy}` : `${["", "bit", "res", "set"][x]} ${y},${memory}${copy}`;
  return { length: 4, fallsThrough: true, call: false, text };
}

function ed(opcode: number, at: (offset: number) => number): Instruction {
  const x = opcode >> 6;
  const y = (opcode >> 3) & 7;
  const z = opcode & 7;
  const p = y >> 1;
  const q = y & 1;
  const plain = (length: number, text: string, more: Partial<Instruction> = {}): Instruction => ({ length, fallsThrough: true, call: false, text, ...more });
  if (x === 1) {
    switch (z) {
      case 0:
        return plain(2, y === 6 ? "in (c)" : `in ${R[y]},(c)`);
      case 1:
        return plain(2, y === 6 ? "out (c),0" : `out (c),${R[y]}`);
      case 2:
        return plain(2, `${q === 0 ? "sbc" : "adc"} hl,${RP[p]}`);
      case 3: {
        const target = `(${word(at(2) | (at(3) << 8))})`;
        return plain(4, q === 0 ? `ld ${target},${RP[p]}` : `ld ${RP[p]},${target}`);
      }
      case 4:
        return plain(2, "neg");
      case 5:
        return plain(2, y === 1 ? "reti" : "retn", { fallsThrough: false });
      case 6:
        return plain(2, `im ${IM[y]}`);
      default:
        return plain(2, ["ld i,a", "ld r,a", "ld a,i", "ld a,r", "rrd", "rld", "nop", "nop"][y]!);
    }
  }
  if (x === 2 && z <= 3 && y >= 4) return plain(2, BLOCK[y - 4]![z]!);
  return plain(2, "nop");
}
