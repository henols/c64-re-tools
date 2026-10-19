// ACME, the assembler of the C64: its patch rule.

import type { AssemblerDialect } from "../assembler.ts";
import { MNEMONICS } from "../opcodes.ts";

/** The data directives whose length the items give: the bytes of each item. */
const DATA_ITEM_BYTES: Record<string, number> = { "!byte": 1, "!by": 1, "!8": 1, "!08": 1, "!word": 2, "!wo": 2, "!16": 2 };

/**
 * The least count of bytes that ACME patch code assembles to, when each line
 * is empty, a comment, a data directive (!byte, !word, !fill with a number) or
 * a 6510 instruction without a label. An instruction is 1 byte without an
 * operand (or with A), else at least 2. Undefined for code with another line,
 * for example a label, a macro use or a condition: then only the build of the
 * switch (c64-source generate) gives the length.
 */
export function leastPatchBytes(code: string): number | undefined {
  let bytes = 0;
  for (const raw of code.split("\n")) {
    if (/["']/.test(raw)) return undefined;
    const line = raw.replace(/;.*$/, "").trim();
    if (line === "") continue;
    const [word, ...rest] = line.split(/\s+/);
    const lower = word!.toLowerCase();
    const operand = rest.join(" ");
    const itemBytes = DATA_ITEM_BYTES[lower];
    if (itemBytes !== undefined) {
      if (operand === "") return undefined;
      bytes += itemBytes * operand.split(",").length;
      continue;
    }
    if (lower === "!fill" || lower === "!fi") {
      const count = /^(?:\$([0-9a-f]+)|([0-9]+))\s*(?:,|$)/i.exec(operand);
      if (count === null) return undefined;
      bytes += count[1] === undefined ? Number.parseInt(count[2]!, 10) : Number.parseInt(count[1], 16);
      continue;
    }
    const instruction = /^([a-z]{3})(?:\+([123]))?$/.exec(lower);
    if (instruction === null || !MNEMONICS.has(instruction[1]!)) return undefined;
    if (instruction[2] !== undefined) bytes += 1 + Number(instruction[2]);
    else bytes += operand === "" || operand.toLowerCase() === "a" ? 1 : 2;
  }
  return bytes;
}

export const ACME: AssemblerDialect = { id: "acme", name: "ACME", leastPatchBytes };
