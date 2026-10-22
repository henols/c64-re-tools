// Z80 idioms of the ZX Spectrum that hide code from a disassembler: the ROM
// restarts that take inline bytes. RST $08 reports the error whose code is the
// byte after it and does not come back. RST $28 runs the calculator on the
// literals after it, up to end-calc ($38), and comes back after end-calc.
// The script follows the code from the entry points with the Z80 decoder, so
// only an RST that is reached is an idiom: an inline byte becomes a data
// region, and the code after the calculator literals becomes a code start.

import { Z80 } from "#src/cpu/z80.ts";
import type { NormalizedFindings } from "#src/knowledge/import.ts";
import type { ImageByte } from "./coverage.ts";

const RST_08 = 0xcf;
const RST_28 = 0xef;
const END_CALC = 0x38;
/** The longest run of calculator literals that the script looks for end-calc in. */
const MAX_LITERALS = 128;

export interface Z80Idioms {
  findings: NormalizedFindings;
  /** The code after the calculator literals of each RST $28: code starts for the same run. */
  codeStarts: number[];
  /** The inline bytes: data for the same run. */
  dataRanges: Array<{ start: number; end: number }>;
  counts: { errorRestarts: number; calculatorRestarts: number };
}

/** The idioms that the code reached from `entries` holds, inside `range` and the program (`byteAt` gives a byte). */
export function findZ80Idioms(byteAt: ImageByte, range: { start: number; end: number }, entries: number[]): Z80Idioms {
  const regions: NormalizedFindings["regions"] = [];
  const codeStarts: number[] = [];
  const counts = { errorRestarts: 0, calculatorRestarts: 0 };
  const inside = (address: number) => address >= range.start && address <= range.end && byteAt(address) !== undefined;
  const seen = new Set<number>();
  const queue = entries.filter(inside);
  while (queue.length > 0) {
    let at = queue.pop()!;
    while (inside(at) && !seen.has(at)) {
      seen.add(at);
      const opcode = byteAt(at)!;
      if (opcode === RST_08) {
        if (inside(at + 1)) regions.push({ start: at + 1, end: at + 1, type: "bytes" });
        counts.errorRestarts++;
        break;
      }
      if (opcode === RST_28) {
        let end = at + 1;
        while (end <= at + MAX_LITERALS && inside(end) && byteAt(end) !== END_CALC) end++;
        // Without end-calc in reach, the literals are not known: the script stops there.
        if (!inside(end) || byteAt(end) !== END_CALC) break;
        regions.push({ start: at + 1, end, type: "bytes" });
        codeStarts.push(end + 1);
        counts.calculatorRestarts++;
        at = end + 1;
        continue;
      }
      const instruction = Z80.decode(byteAt, at);
      if (instruction === undefined) break;
      for (const target of [instruction.branch, instruction.jump, instruction.callTarget]) if (target !== undefined && inside(target)) queue.push(target);
      if (!instruction.fallsThrough || instruction.halts) break;
      at += instruction.length;
    }
  }
  const starts = [...new Set(codeStarts)].sort((a, b) => a - b);
  const dataRanges = regions.map((region) => ({ start: region.start, end: region.end })).sort((a, b) => a.start - b.start);
  return {
    findings: {
      analyzer: "heuristic",
      coverage: [{ start: range.start, end: range.end }],
      authoritative: { symbols: false, regions: false, references: false },
      symbols: [],
      regions,
      references: [],
    },
    codeStarts: starts,
    dataRanges,
    counts,
  };
}
