// The source of a ZX Spectrum program in the syntax of sjasmplus: main.asm sets
// the address of each segment with ORG and includes the files in address order,
// one file for each module and for each part of a segment that no module holds,
// as the source of a C64 program has them. constants.asm holds the platform
// names that the program uses and the names of the knowledge at addresses that
// no line starts. The instructions of the code regions (and of the flows from
// --entry) are written as the Z80 decoder gives them, with names in place of
// their addresses and the operand expressions of the knowledge; the other bytes
// are db and ds lines, with the comments of the knowledge.
//
// A platform name names only an operand that is an address: the target of a
// jump, a branch or a call, or a memory access (nn). An immediate value (ld
// hl,$0000) stays a number unless the program holds that address: then it gets
// the name of the source there.
//
// The Z80 has instructions with more than one encoding (for example ED 63,
// which sjasmplus writes as 22 for "ld (nn),hl"). A probe source assembles each
// decoded instruction at its own address with numbers only; an instruction
// whose bytes the probe does not give again is written as db, with its text in
// the comment, so the source gives the bytes of the program again.

import { type AddressRange, formatAddress, formatByte } from "#src/address.ts";
import { labelProblem, type Cpu, type Instruction } from "#src/cpu.ts";
import { COVERAGE } from "#src/cpu/coverage.ts";
import { operandIsAddress } from "#src/cpu/z80.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { identifiers, operandText, type OperandExpression } from "#src/knowledge/expression.ts";
import { splitPieces, type OperandAsNumber, type PieceFile, type SourceItem, type SourceLabel } from "./source.ts";

export interface Z80SourceInput {
  segments: readonly AddressRange[];
  byteAt: (address: number) => number;
  cpu: Cpu;
  symbols: ReadonlyArray<{ address: number; name: string }>;
  regions: ReadonlyArray<{ start: number; end: number; type: string }>;
  comments: ReadonlyArray<{ address: number; placement: "line" | "side"; text: string }>;
  /** The platform names of the machine: the first address of each entry, its last address and what it is. */
  platform: ReadonlyArray<{ address: number; end?: number; name: string; meaning: string }>;
  modules?: ReadonlyArray<{ start: number; file: string; title?: string }>;
  /** Operand expressions of the knowledge, by instruction address. */
  operands?: ReadonlyArray<OperandExpression & { address: number }>;
  /** Joined coverage files: an instruction that no run executed is marked. */
  coverage?: Uint8Array;
  /** More addresses where code starts: the source decodes the flow from each one up to the first instruction that does not go on. */
  entries?: readonly number[];
  header: readonly string[];
}

export interface Z80Instruction {
  address: number;
  length: number;
  text: string;
  /** The address that the operand of the instruction gives: a word operand or a relative target. */
  target?: number;
  /** True when the target is an address that the instruction uses: a jump, a branch, a call or a memory access. False for an immediate value. */
  addressOperand?: boolean;
  /** The operand that an expression can name: its offset in the instruction and its size. Undefined for a relative operand. */
  operand?: { offset: number; size: 1 | 2 };
}

const DATA_PER_LINE = 16;
/** A run of this many equal bytes or more is one ds line. */
const MIN_RUN = 16;
/** The region type whose bytes the source decodes as instructions. */
const CODE_TYPE = "code";
/** The region types that a name+offset operand cannot name: code. */
const NOT_TABLES: readonly string[] = [CODE_TYPE, "jumps", "dual-use"];

/** The instructions of the code regions, decoded from the start of each region, and of the flow from each entry. Each one is inside its segment and outside the data regions. */
export function z80Instructions(input: Pick<Z80SourceInput, "segments" | "byteAt" | "cpu" | "regions" | "entries">): Z80Instruction[] {
  const inSegment = (address: number) => input.segments.find((segment) => address >= segment.start && address <= segment.end);
  const byteAt = (address: number) => (inSegment(address) === undefined ? undefined : input.byteAt(address));
  const isData = (address: number) => input.regions.some((region) => region.type !== CODE_TYPE && address >= region.start && address <= region.end);
  const instructions: Z80Instruction[] = [];
  const covered = new Set<number>();
  const decodeAt = (address: number, last: number): { instruction: Z80Instruction; decoded: Instruction } | undefined => {
    const decoded = input.cpu.decode(byteAt, address);
    const end = address + (decoded?.length ?? 1) - 1;
    if (decoded?.text === undefined || end > last || inSegment(address) !== inSegment(end)) return undefined;
    const { operand } = decoded;
    const target =
      operand === undefined ? undefined : operand.relative ? (decoded.branch ?? decoded.jump) : operand.size === 2 ? input.byteAt(address + operand.offset) | (input.byteAt(address + operand.offset + 1) << 8) : undefined;
    const instruction: Z80Instruction = {
      address,
      length: decoded.length,
      text: decoded.text,
      ...(target === undefined ? {} : { target, addressOperand: operandIsAddress(decoded) }),
      ...(operand === undefined || operand.relative === true ? {} : { operand: { offset: operand.offset, size: operand.size } }),
    };
    return { instruction, decoded };
  };
  const add = (instruction: Z80Instruction) => {
    instructions.push(instruction);
    for (let offset = 0; offset < instruction.length; offset++) covered.add(instruction.address + offset);
  };
  for (const region of input.regions.filter((item) => item.type === CODE_TYPE).sort((a, b) => a.start - b.start)) {
    let address = region.start;
    while (address <= region.end) {
      const found = decodeAt(address, region.end);
      if (found === undefined) {
        address++;
        continue;
      }
      add(found.instruction);
      address += found.instruction.length;
    }
  }
  for (const entry of [...new Set(input.entries ?? [])].sort((a, b) => a - b)) {
    let address = entry;
    for (;;) {
      const segment = inSegment(address);
      const found = segment === undefined ? undefined : decodeAt(address, segment.end);
      if (found === undefined) break;
      const { instruction, decoded } = found;
      if (Array.from({ length: instruction.length }, (_, offset) => address + offset).some((at) => covered.has(at) || isData(at))) break;
      add(instruction);
      if (!decoded.fallsThrough || decoded.halts === true) break;
      address += instruction.length;
    }
  }
  return instructions.sort((a, b) => a.address - b.address);
}

/** The probe: each instruction at its own address, with numbers only. */
export function z80ProbeSource(instructions: readonly Z80Instruction[]): string {
  return `${instructions.map((instruction) => `\tORG ${formatAddress(instruction.address)}\n\t${instruction.text}`).join("\n")}\n`;
}

/** The instructions whose bytes the probe build gives again. */
export function z80Encoded(instructions: readonly Z80Instruction[], built: Uint8Array, byteAt: (address: number) => number): Set<number> {
  const same = new Set<number>();
  for (const instruction of instructions) {
    let equal = true;
    for (let offset = 0; offset < instruction.length && equal; offset++) equal = built[instruction.address + offset] === byteAt(instruction.address + offset);
    if (equal) same.add(instruction.address);
  }
  return same;
}

const EXPRESSION_TOKEN = /^(\s+|\$[0-9A-Fa-f]+|%[01]+|[0-9]+|>>>|<<|>>|XOR\b|[A-Za-z_.][A-Za-z0-9_]*|[-+*/%&|!<>()])/;

/**
 * An operand expression of the knowledge (ACME syntax) in the syntax of
 * sjasmplus: a unary < or > is low or high of everything up to the next &,
 * XOR or | (ACME gives them that priority), ! is ~ and XOR is ^. The other
 * operators have the same meaning and priority in both.
 */
export function sjasmplusExpression(text: string): string {
  const tokens: string[] = [];
  for (let rest = text; rest.length > 0; ) {
    const token = EXPRESSION_TOKEN.exec(rest)?.[0];
    if (token === undefined) throw new WireFailure("invalid-input", `The operand expression "${text}" has an unknown character: "${rest[0]}".`);
    if (token.trim() !== "") tokens.push(token);
    rest = rest.slice(token.length);
  }
  const isOperand = (token: string | undefined) => token !== undefined && (token === ")" || (/^[$%0-9A-Za-z_.]/.test(token) && token !== "XOR"));
  const convert = (from: number, to: number): string => {
    let out = "";
    for (let index = from; index < to; index++) {
      const token = tokens[index]!;
      const unary = index === from || !isOperand(tokens[index - 1]);
      if (unary && (token === "<" || token === ">")) {
        // The operand of < or >: up to an &, XOR or | outside brackets, or the ) that closes the brackets around it.
        let end = index + 1;
        for (let depth = 0; end < to; end++) {
          const next = tokens[end]!;
          if (next === "(") depth++;
          else if (next === ")") {
            if (depth === 0) break;
            depth--;
          } else if (depth === 0 && (next === "&" || next === "|" || next === "XOR")) break;
        }
        out += `${token === "<" ? "low" : "high"} (${convert(index + 1, end)})`;
        index = end - 1;
        continue;
      }
      if (unary && token === "!") out += "~";
      else if (token === "XOR") out += " ^ ";
      else out += token;
    }
    return out;
  };
  return convert(0, tokens.length);
}

/** True when one bracket pair holds all of the text: sjasmplus reads such an operand as a memory access. */
function enclosed(text: string): boolean {
  if (!text.startsWith("(") || !text.endsWith(")")) return false;
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")") depth--;
    if (depth === 0 && index < text.length - 1) return false;
  }
  return true;
}

/** The text with the last `old` replaced by `value`. */
function replaceLast(text: string, old: string, value: string): string {
  const at = text.lastIndexOf(old);
  return at < 0 ? text : `${text.slice(0, at)}${value}${text.slice(at + old.length)}`;
}

export interface Z80Rendered {
  /** The files of the source, without the mark line: one file for each piece, constants.asm and main.asm. */
  files: Array<{ name: string; text: string }>;
  pieces: PieceFile[];
  instructions: number;
  dataBytes: number;
  /** The instructions that the source writes as db: sjasmplus encodes their text in another way. */
  asBytes: number[];
  /** With coverage: runs of instructions that no run executed. */
  notExecuted?: { instructions: number; ranges: AddressRange[] };
  /** The source map: the line of each name, and the line of each address that the source writes (1 is the first line of the text). */
  labels: SourceLabel[];
  items: SourceItem[];
  /** Each instruction written with an operand expression: its file and line (1 is the first line of the text). */
  expressions: Array<{ address: number; length: number; file: string; line: number }>;
  /** Operand expressions written as numbers, in address order. */
  operandsAsNumbers: OperandAsNumber[];
  unusedModules: Array<{ start: number; file: string }>;
  namedLabels: number;
  generatedLabels: number;
}

/**
 * The source files. `encoded` holds the instructions that sjasmplus encodes as
 * the program has them; `numbers` the operand expressions that the source writes
 * as numbers, with the reason.
 */
export function renderZ80(input: Z80SourceInput, instructions: readonly Z80Instruction[], encoded: ReadonlySet<number>, numbers: ReadonlyMap<number, string> = new Map()): Z80Rendered {
  const inImage = (address: number) => input.segments.some((segment) => address >= segment.start && address <= segment.end);
  const at = new Map(instructions.map((instruction) => [instruction.address, instruction]));
  const labelAt = new Map<number, string>();
  for (const symbol of input.symbols) {
    const problem = labelProblem(symbol.name, input.cpu);
    if (problem !== undefined) throw new WireFailure("invalid-input", `The symbol ${symbol.name} at ${formatAddress(symbol.address)}: ${problem} Rename the symbol in the project knowledge.`);
    if (!labelAt.has(symbol.address)) labelAt.set(symbol.address, symbol.name);
  }
  const knowledgeNames = new Set(input.symbols.map((symbol) => symbol.name));
  const taken = new Set(labelAt.values());

  // The operand expressions: a knowledge symbol of a name wins over a platform name.
  const byName = new Map<string, number>();
  for (const entry of input.platform) if (!byName.has(entry.name)) byName.set(entry.name, entry.address);
  for (const symbol of input.symbols) byName.set(symbol.name, symbol.address);
  const platformByName = new Map<string, Z80SourceInput["platform"][number]>();
  for (const entry of input.platform) if (!knowledgeNames.has(entry.name) && !platformByName.has(entry.name)) platformByName.set(entry.name, entry);
  const operandsAsNumbers: OperandAsNumber[] = [];
  const unwritten = new Map<number, string>();
  const expressions = new Map<number, string>();
  for (const row of [...(input.operands ?? [])].sort((a, b) => a.address - b.address)) {
    const expression = operandText(row);
    const asNumber = (reason: string) => {
      operandsAsNumbers.push({ address: row.address, expression, reason });
      unwritten.set(row.address, expression);
    };
    const instruction = at.get(row.address);
    if (instruction?.operand === undefined) asNumber("The source has no instruction with an operand value at this address.");
    else if (!encoded.has(row.address)) asNumber("sjasmplus writes this instruction with other bytes, so the source has it as bytes.");
    else {
      const missing = identifiers(expression).filter((name) => !byName.has(name));
      const reason = numbers.get(row.address);
      if (missing.length > 0) asNumber(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not a symbol of the knowledge or a platform name. Name the address in the project knowledge, or record the operand expression again.`);
      else if (reason !== undefined) asNumber(reason);
      else expressions.set(row.address, expression);
    }
  }

  // A target of a jump, branch or call at an instruction start gets a name of the source, as l_8015. An instruction with an expression names what its expression names.
  const generated = new Set<number>();
  for (const instruction of instructions) {
    const target = instruction.target;
    if (target === undefined || labelAt.has(target) || !at.has(target) || !encoded.has(instruction.address) || expressions.has(instruction.address)) continue;
    const name = `l_${target.toString(16).padStart(4, "0")}`;
    if (taken.has(name)) continue;
    labelAt.set(target, name);
    taken.add(name);
    generated.add(target);
  }
  // A platform name only where the knowledge has no name: of the address, or the same name elsewhere.
  const platformAt = new Map([...platformByName.values()].filter((entry) => !labelAt.has(entry.address) && !taken.has(entry.name)).map((entry) => [entry.address, entry]));
  const usedPlatform = new Set<string>();
  const tableStart = (address: number) => input.regions.find((region) => !NOT_TABLES.includes(region.type) && address > region.start && address <= region.end && labelAt.has(region.start))?.start;
  /**
   * The name of an operand target. An address that the instruction uses gets its
   * own name, else name+offset inside a named data region or a platform entry of
   * more bytes. An immediate value gets a name only where the program holds it.
   */
  const nameOf = (target: number, address: boolean): string | undefined => {
    const own = labelAt.get(target);
    if (own !== undefined && (address || inImage(target))) return own;
    const platform = address ? platformAt.get(target) : undefined;
    if (platform !== undefined) {
      usedPlatform.add(platform.name);
      return platform.name;
    }
    const start = inImage(target) ? tableStart(target) : undefined;
    if (start !== undefined) return `${labelAt.get(start)!}+${target - start}`;
    if (!address) return undefined;
    const entry = [...platformAt.values()].find((row) => row.end !== undefined && target > row.address && target <= row.end);
    if (entry === undefined) return undefined;
    usedPlatform.add(entry.name);
    return `${entry.name}+${target - entry.address}`;
  };
  // The platform names of the expressions: constants.asm defines each one, also where the program has a label of its own.
  for (const expression of expressions.values()) for (const name of identifiers(expression)) if (platformByName.has(name)) usedPlatform.add(name);

  const lineComments = new Map<number, string[]>();
  const sideComments = new Map<number, string>();
  for (const comment of input.comments) {
    if (!inImage(comment.address)) continue;
    if (comment.placement === "line") lineComments.set(comment.address, [...(lineComments.get(comment.address) ?? []), ...comment.text.split(/\r?\n/)]);
    else sideComments.set(comment.address, comment.text.replace(/\s*\r?\n\s*/g, " "));
  }
  const { pieces, unusedModules } = splitPieces(input.segments, input.modules ?? []);
  const result: Z80Rendered = { files: [], pieces, instructions: 0, dataBytes: 0, asBytes: [], labels: [], items: [], expressions: [], operandsAsNumbers, unusedModules, namedLabels: 0, generatedLabels: 0 };
  const { coverage } = input;
  const notExecuted = { instructions: 0, ranges: [] as AddressRange[] };
  const placed = new Set<number>();

  for (const piece of pieces) {
    const out: string[] = [`; ${piece.title}`, `; ${formatAddress(piece.start)}-${formatAddress(piece.end)}`, ""];
    /** True while the instructions before have not executed: they form one range. */
    let running = false;
    let markLine = 0;
    /** Marks the start of a range of instructions that no run executed, or makes the open range longer. */
    const mark = (instruction: Z80Instruction) => {
      const executed = coverage === undefined || (coverage[instruction.address]! & COVERAGE.ramExecute) !== 0;
      if (!executed) {
        const last = instruction.address + instruction.length - 1;
        if (running) notExecuted.ranges.at(-1)!.end = last;
        else {
          notExecuted.ranges.push({ start: instruction.address, end: last });
          markLine = out.length;
          out.push("");
        }
        // The mark gives the range, so a reader finds it in the full list.
        const range = notExecuted.ranges.at(-1)!;
        out[markLine] = `; not executed ${formatAddress(range.start)}-${formatAddress(range.end)}`;
        notExecuted.instructions++;
      }
      running = !executed;
    };
    /** The comments and the label of an address, then its line with the side comments, in the source map. */
    const emit = (address: number, end: number, text: string, sides: readonly string[], instruction?: Z80Instruction) => {
      for (const comment of lineComments.get(address) ?? []) out.push(`; ${comment}`.trimEnd());
      const label = labelAt.get(address);
      if (label !== undefined) {
        out.push(`${label}:`);
        result.labels.push({ address, name: label, file: piece.file, line: out.length });
        placed.add(address);
        if (generated.has(address)) result.generatedLabels++;
        else result.namedLabels++;
      }
      if (instruction === undefined) running = false;
      else mark(instruction);
      const notes = [...sides, sideComments.get(address)].filter((item) => item !== undefined && item !== "");
      out.push(`\t${text}${notes.length === 0 ? "" : `\t; ${notes.join(" | ")}`}`);
      result.items.push({ start: address, end, file: piece.file, line: out.length });
    };
    /** True when a data line or run can go on at the address: no label, instruction or comment starts there. */
    const free = (next: number) => !labelAt.has(next) && !at.has(next) && !lineComments.has(next) && !sideComments.has(next);
    /** True when MIN_RUN equal bytes start at the address, inside the piece. */
    const startsRun = (address: number) => {
      if (address + MIN_RUN - 1 > piece.end) return false;
      for (let offset = 1; offset < MIN_RUN; offset++) if (input.byteAt(address + offset) !== input.byteAt(address)) return false;
      return true;
    };
    let address = piece.start;
    while (address <= piece.end) {
      const instruction = at.get(address);
      if (instruction !== undefined && address + instruction.length - 1 <= piece.end) {
        const last = address + instruction.length - 1;
        // A comment at an operand byte shows with its address, as in the listing of the knowledge.
        const inner: string[] = [];
        for (let inside = address + 1; inside <= last; inside++) {
          for (const comment of lineComments.get(inside) ?? []) inner.push(`${formatAddress(inside)}: ${comment}`);
          if (sideComments.has(inside)) inner.push(`${formatAddress(inside)}: ${sideComments.get(inside)!}`);
        }
        const notWritten = unwritten.get(address);
        const sides = [...(notWritten === undefined ? [] : [`= ${notWritten}`]), ...inner];
        if (encoded.has(address)) {
          let text = instruction.text;
          const expression = expressions.get(address);
          if (expression !== undefined && instruction.operand !== undefined) {
            const { offset, size } = instruction.operand;
            const value = size === 2 ? input.byteAt(address + offset) | (input.byteAt(address + offset + 1) << 8) : input.byteAt(address + offset);
            const plain = size === 2 ? formatAddress(value) : formatByte(value);
            const shown = sjasmplusExpression(expression);
            // An immediate value in one bracket pair would be a memory access: the brackets go, the value stays.
            text = replaceLast(text, plain, enclosed(shown) && !text.includes(`(${plain})`) ? shown.slice(1, -1) : shown);
          } else if (instruction.target !== undefined) {
            const name = nameOf(instruction.target, instruction.addressOperand === true);
            if (name !== undefined) text = replaceLast(text, formatAddress(instruction.target), name);
          }
          emit(address, last, text, sides, instruction);
          if (expression !== undefined) result.expressions.push({ address, length: instruction.length, file: piece.file, line: out.length });
          result.instructions++;
        } else {
          // An instruction that sjasmplus encodes in another way: its bytes, with its text.
          const bytes = Array.from({ length: instruction.length }, (_, offset) => formatByte(input.byteAt(address + offset)));
          emit(address, last, `db ${bytes.join(",")}`, [instruction.text, ...sides], instruction);
          result.asBytes.push(address);
          result.dataBytes += instruction.length;
        }
        address = last + 1;
        continue;
      }
      let run = address + 1;
      while (run <= piece.end && free(run) && input.byteAt(run) === input.byteAt(address)) run++;
      if (run - address >= MIN_RUN) {
        emit(address, run - 1, `ds ${run - address},${formatByte(input.byteAt(address))}`, []);
        result.dataBytes += run - address;
        address = run;
        continue;
      }
      // Bytes up to the next label, instruction, run, piece end or the end of the line.
      const values: string[] = [];
      let next = address;
      while (next <= piece.end && values.length < DATA_PER_LINE && (next === address || (free(next) && !startsRun(next)))) {
        values.push(formatByte(input.byteAt(next)));
        next++;
      }
      emit(address, next - 1, `db ${values.join(",")}`, []);
      result.dataBytes += values.length;
      address = next;
    }
    result.files.push({ name: piece.file, text: `${out.join("\n")}\n` });
  }

  // constants.asm: the platform names that the source uses, then the names that no line starts (an address outside the program or inside an instruction).
  const constants = ["; The names of addresses that no line of the source starts."];
  const constantLine = (address: number, name: string, text: string) => {
    constants.push(text);
    result.labels.push({ address, name, file: "constants.asm", line: constants.length });
  };
  const platformLines = [...platformByName.values()].filter((entry) => usedPlatform.has(entry.name)).sort((a, b) => a.address - b.address);
  if (platformLines.length > 0) {
    constants.push("", "; The platform names that the program uses.");
    for (const entry of platformLines) constantLine(entry.address, entry.name, `${entry.name}\tEQU ${formatAddress(entry.address)}\t; ${entry.meaning}`);
  }
  const equates = [...labelAt].filter(([address]) => !placed.has(address)).sort(([a], [b]) => a - b);
  if (equates.length > 0) {
    constants.push("", "; The names of the knowledge at addresses that no line starts.");
    for (const [address, name] of equates) constantLine(address, name, `${name}\tEQU ${formatAddress(address)}`);
  }
  result.files.push({ name: "constants.asm", text: `${constants.join("\n")}\n` });

  const main = [...input.header.map((line) => `; ${line}`), "", '\tINCLUDE "constants.asm"'];
  for (const piece of pieces) {
    if (piece.segmentStart) main.push("", `\tORG ${formatAddress(piece.start)}`);
    main.push(`\tINCLUDE "${piece.file}"`);
  }
  result.files.push({ name: "main.asm", text: `${main.join("\n")}\n` });
  if (coverage !== undefined) result.notExecuted = notExecuted;
  result.operandsAsNumbers.sort((a, b) => a.address - b.address);
  return result;
}
