// The c64-source script (D48): generates ACME source from an image, current
// knowledge and Ghidra's instructions, which it runs itself, and checks with
// ACME that the source assembles to the image byte by byte. With --loader it
// also writes a loader that recreates the entry state, simulates it, and
// checks it in the emulator. Exit status: 0 when every check passes, 1 when
// one fails, 2 for a bad call.

import { posix } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address, prgRange, textToPetscii } from "#src/c64.ts";
import { autostartLoaded, RUN_LIMIT_FRAMES } from "#src/host-client/autostart.ts";
import { readCoverageFiles } from "#src/host-client/coverage.ts";
import { MAX_MEMORY_READ, WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { KnowledgeError, openForRead } from "#src/knowledge/database.ts";
import { currentRevision, listComments, listModules, listReferences, listRegions, listSymbols } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, SPACE, type Space } from "#src/knowledge/schema.ts";
import { assemble } from "#src/native/acme.ts";
import { analyze } from "#src/native/ghidra/analyze.ts";
import { localToolContext } from "#src/native/local.ts";
import { GHIDRA_LIMITS, type Diagnostic } from "#src/native/types.ts";
import { platformNames } from "#src/platform.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { planLoader, readEntryState, simulate, type EntryState, type LoaderPlan } from "./loader.ts";
import { OPCODES } from "./opcodes.ts";
import { instructionText, layout, literalOperand, probeForms, render, type Layout, type Range } from "./source.ts";

const USAGE = `generate.ts <image> --out <dir> [options]

  <image>            an image.json of the c64-unpacker skill, or a PRG, relative to
                     the project directory
  --out <dir>        the directory for the source files, relative to the project
  --entry <address>  an entry point for Ghidra, for example '$080d' (repeatable)
  --coverage <file>  a coverage map of 64 KiB from c64_memmap (repeatable): code
                     that no run executed is marked and listed
  --space <space>    the knowledge space of the image: c64 (the default), drive8, or
                     bank0 to bank255; --coverage and --loader are for c64 only
  --loader           also write loader.asm and loader.prg: the loader copies the
                     segments into place, sets the entry state from entry_state.json
                     next to image.json, and jumps to the entry; it is checked in
                     the emulator

The result is one JSON object. Addresses are $ and four hex digits.`;

const MAX_LISTED = 20;
const PROBE_BASE = 0x1000;
const PROBE_SLOT = 4;
/** The copies of a full 64 KiB take about 140 frames. */
const LOADER_FRAMES = 1500;

interface Image {
  path: string;
  segments: Range[];
  byteAt: (address: number) => number;
  /** The bytes that Ghidra analyzes, and how. */
  analyzed: { bytes: Buffer; kind: "prg" | "flat64k" };
  entry?: number;
  /** entry_state.json next to image.json, when it exists. */
  statePath?: string;
}

function readImage(path: string): Image {
  const { bytes } = readProjectFile(path);
  if (!path.endsWith(".json")) {
    let range: ReturnType<typeof prgRange>;
    try {
      range = prgRange(bytes);
    } catch (error) {
      throw new UsageError(`${path}: ${(error as Error).message}`);
    }
    return { path, segments: [{ start: range.start, end: range.end }], byteAt: (address) => range.body[address - range.start]!, analyzed: { bytes, kind: "prg" } };
  }
  const fail = (what: string): never => {
    throw new UsageError(`${path} is not an image.json of the c64-unpacker skill: ${what}`);
  };
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    return fail((error as Error).message);
  }
  const address = (value: unknown, what: string) => (typeof value === "string" && /^\$[0-9a-f]{4}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fail(`${what} is not a $ address`));
  if (typeof manifest.image !== "string") fail("it has no image");
  if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) fail("it has no segments");
  const segments = (manifest.segments as Array<Record<string, unknown>>)
    .map((segment, index) => ({ start: address(segment.start, `segment ${index + 1} start`), end: address(segment.end, `segment ${index + 1} end`) }))
    .sort((a, b) => a.start - b.start);
  segments.forEach((segment, index) => {
    if (segment.end < segment.start) fail(`the segment at ${formatC64Address(segment.start)} ends before it starts`);
    if (index > 0 && segment.start <= segments[index - 1]!.end) fail(`the segments at ${formatC64Address(segments[index - 1]!.start)} and ${formatC64Address(segment.start)} overlap`);
  });
  const directory = posix.dirname(path);
  const memory = readProjectFile(posix.join(directory, manifest.image as string)).bytes;
  if (memory.length !== 0x10000) fail(`its image has ${memory.length} bytes, not 65536`);
  const image: Image = { path, segments, byteAt: (at) => memory[at]!, analyzed: { bytes: memory, kind: "flat64k" }, statePath: posix.join(directory, "entry_state.json") };
  if (manifest.entry !== undefined) image.entry = address(manifest.entry, "entry");
  return image;
}

/** The knowledge of one space that the source uses, read once. */
function readKnowledge(space: Space) {
  const db = openForRead();
  try {
    return {
      revision: currentRevision(db),
      symbols: listSymbols(db, undefined, undefined, undefined, space),
      regions: listRegions(db, undefined, undefined, undefined, space),
      comments: listComments(db, undefined, undefined, space),
      modules: listModules(db, undefined, undefined, space),
      references: listReferences(db, undefined, undefined, undefined, space),
    };
  } finally {
    db?.close();
  }
}

/** Ghidra's instruction starts and lengths inside the image, seeded from the entry and from knowledge of any origin. */
async function decode(image: Image, knowledge: ReturnType<typeof readKnowledge>, entries: number[]): Promise<Map<number, number>> {
  const inImage = (address: number) => image.segments.some((segment) => address >= segment.start && address <= segment.end);
  const seeds = new Set<number>([...(image.entry === undefined ? [] : [image.entry]), ...entries]);
  for (const symbol of knowledge.symbols) if (symbol.kind === "routine") seeds.add(symbol.address);
  for (const region of knowledge.regions) {
    if (CODE_REGION_TYPES.includes(region.type)) seeds.add(region.start);
    if (region.type === "jumps") for (let at = region.start; at + 2 <= region.end; at += 3) seeds.add(at);
  }
  const entryPoints = [...seeds].filter(inImage).sort((a, b) => a - b);
  if (entryPoints.length === 0) {
    throw new UsageError("Ghidra needs an entry point: give --entry, or record a routine or a code region in knowledge with the c64-knowledge skill");
  }
  const dataRanges = knowledge.regions
    .filter((region) => !CODE_REGION_TYPES.includes(region.type) && region.type !== "dual-use")
    .flatMap((region) => image.segments.filter((segment) => region.start <= segment.end && segment.start <= region.end).map((segment) => ({ start: Math.max(region.start, segment.start), end: Math.min(region.end, segment.end) })));
  const { result } = await analyze(
    { imageKind: image.analyzed.kind, entryPoints: entryPoints.slice(0, GHIDRA_LIMITS.entryPoints), dataRanges: dataRanges.slice(0, GHIDRA_LIMITS.dataRanges), labels: [], decompile: [] },
    image.analyzed.bytes,
    localToolContext(),
  );
  const instructions = new Map<number, number>();
  for (const instruction of result.instructions) {
    const bytes = Buffer.from(instruction.bytes, "hex");
    const inside = Array.from({ length: bytes.length }, (_, offset) => instruction.address + offset).every((address, offset) => inImage(address) && image.byteAt(address) === bytes[offset]);
    if (inside) instructions.set(instruction.address, bytes.length);
  }
  return instructions;
}

/** Assembles files given as text with ACME; the program or the diagnostics. */
async function assembleFiles(files: Array<{ name: string; text: string }>, entry: string): Promise<{ program?: Buffer; start?: number; diagnostics: Diagnostic[] }> {
  const contents = files.map((file) => Buffer.from(file.text, "utf8"));
  const { result, attachments } = await assemble(
    { files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: entry, includeDirs: [], defines: {} },
    contents,
    localToolContext(),
  );
  if (!result.assembled) return { diagnostics: result.diagnostics };
  return { program: attachments![0]!, start: result.loadRange!.start, diagnostics: result.diagnostics };
}

/**
 * Assembles one instruction of each opcode form that the source uses, each
 * in its own slot. A form that ACME refuses, or writes with other bytes, is
 * written as bytes in the source.
 */
async function probe(laid: Layout): Promise<Set<string>> {
  const asBytes = new Set<string>();
  for (let round = 0; round < 3; round++) {
    const forms = probeForms(laid).filter((item) => !asBytes.has(item.form.key));
    if (forms.length === 0) return asBytes;
    const lines = ["!cpu 6510"];
    const lineOf = new Map<number, string>();
    forms.forEach((item, index) => {
      const slot = PROBE_BASE + PROBE_SLOT * index;
      const { mode } = OPCODES[item.form.opcode]!;
      const operand =
        mode === "imp"
          ? ""
          : mode === "rel"
            ? formatC64Address((slot + 2 + (item.bytes[1]! < 0x80 ? item.bytes[1]! : item.bytes[1]! - 0x100)) & 0xffff)
            : literalOperand(item.form.opcode, item.bytes.length === 3 ? item.bytes[1]! | (item.bytes[2]! << 8) : item.bytes[1]!);
      lines.push(`* = ${formatC64Address(slot)}`);
      lines.push(`        ${instructionText(item.form.opcode, item.form.suffix, operand)}`);
      lineOf.set(lines.length, item.form.key);
    });
    const built = await assembleFiles([{ name: "probe.asm", text: `${lines.join("\n")}\n` }], "probe.asm");
    if (built.program === undefined) {
      const refused = built.diagnostics.filter((diagnostic) => diagnostic.severity === "error" && diagnostic.line !== undefined && lineOf.has(diagnostic.line));
      if (refused.length === 0) throw new WireFailure("operation-failed", `ACME refused the opcode probe: ${built.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`);
      for (const diagnostic of refused) asBytes.add(lineOf.get(diagnostic.line!)!);
      continue;
    }
    forms.forEach((item, index) => {
      const offset = 2 + PROBE_BASE + PROBE_SLOT * index - built.start!;
      const same = item.bytes.every((byte, at) => built.program![offset + at] === byte);
      if (!same) asBytes.add(item.form.key);
    });
    return asBytes;
  }
  throw new WireFailure("operation-failed", "ACME refused the opcode probe three times.");
}

interface SegmentCheck {
  start: string;
  end: string;
  result: "identical" | "different" | "not covered";
  differences?: number;
  firstDifference?: { address: string; built: number; image: number };
}

/** Compares the assembled program with the image, segment by segment. */
function check(program: Buffer, start: number, image: Image): { identical: boolean; segments: SegmentCheck[] } {
  const end = start + program.length - 3;
  const segments = image.segments.map((segment): SegmentCheck => {
    const shown = { start: formatC64Address(segment.start), end: formatC64Address(segment.end) };
    if (segment.start < start || segment.end > end) return { ...shown, result: "not covered" };
    let differences = 0;
    let first: SegmentCheck["firstDifference"];
    for (let address = segment.start; address <= segment.end; address++) {
      const built = program[2 + address - start]!;
      if (built === image.byteAt(address)) continue;
      differences++;
      first ??= { address: formatC64Address(address), built, image: image.byteAt(address) };
    }
    return differences === 0 ? { ...shown, result: "identical" } : { ...shown, result: "different", differences, firstDifference: first! };
  });
  return { identical: segments.every((segment) => segment.result === "identical"), segments };
}

/** Reads RAM in parts. */
async function readRam(client: ViceSessionClient, start: number, size: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (let at = start; at < start + size; at += MAX_MEMORY_READ) {
    parts.push(Buffer.from((await client.memoryRead({ address: at, size: Math.min(MAX_MEMORY_READ, start + size - at), space: "c64", view: "ram" })).data, "hex"));
  }
  return Buffer.concat(parts);
}

/** Runs the loader in the emulator to the entry and compares memory, $00/$01 and the registers with the entry state. */
async function runLoader(path: string, program: Buffer, plan: LoaderPlan, image: Image, state: EntryState): Promise<{ verified: boolean; differences: string[] }> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    await client.reset({ mode: "hard", run: false });
    if (!(await autostartLoaded(client, path, program))) return { verified: false, differences: ["The loader was not in memory after autostart."] };
    await client.keyboard(textToPetscii("RUN\n"));
    const copier = await client.runUntil({ target: { kind: "address", address: plan.copier, space: "c64" }, timeoutFrames: RUN_LIMIT_FRAMES });
    if (!copier.reached) return { verified: false, differences: [`The loader did not get to its copier at ${formatC64Address(plan.copier)}; it stopped at ${formatC64Address(copier.pc)}.`] };
    const entry = await client.runUntil({ target: { kind: "address", address: state.pc, space: "c64" }, timeoutFrames: LOADER_FRAMES });
    if (!entry.reached) return { verified: false, differences: [`The loader did not get to the entry ${formatC64Address(state.pc)}; it stopped at ${formatC64Address(entry.pc)}.`] };
    const memory = await readRam(client, 0x0000, 0x10000);
    const port = Buffer.from((await client.memoryRead({ address: 0x0000, size: 2, space: "c64", view: "cpu" })).data, "hex");
    const registers = await client.registersGet("c64");
    const differences: string[] = [];
    const byte = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
    const differ = (what: string, got: number, wanted: number) => got !== wanted && differences.push(`${what} is ${byte(got)}, not ${byte(wanted)}`);
    for (const segment of image.segments) {
      for (let address = Math.max(segment.start, 2); address <= segment.end; address++) differ(formatC64Address(address), memory[address]!, image.byteAt(address));
    }
    for (let address = 2; address < 0x400; address++) if (address !== plan.stackByte) differ(formatC64Address(address), memory[address]!, state.pages[address]!);
    differ("$00", port[0]!, state.port[0]);
    differ("$01", port[1]!, state.port[1]);
    differ("a", registers.a, state.a);
    differ("x", registers.x, state.x);
    differ("y", registers.y, state.y);
    differ("sp", registers.sp, state.sp);
    const flags = (["n", "v", "d", "i", "z", "c"] as const).reduce((value, name, index) => value | (registers.flags[name] ? [0x80, 0x40, 0x08, 0x04, 0x02, 0x01][index]! : 0), 0);
    differ("flags", flags, state.flags & 0xcf);
    return { verified: differences.length === 0, differences: differences.slice(0, MAX_LISTED) };
  } finally {
    await client.close();
  }
}

async function run(argv: string[]): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { out: { type: "string" }, entry: { type: "string", multiple: true }, coverage: { type: "string", multiple: true }, space: { type: "string" }, loader: { type: "boolean" }, help: { type: "boolean" } },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one image");
  if (values.out === undefined) throw new UsageError("generate needs --out <dir>");
  try {
    resolveProjectPath(values.out);
  } catch {
    throw new UsageError(`--out must be a path relative to the project directory that stays inside it, not ${values.out}`);
  }
  const entries = (values.entry ?? []).map((value) => {
    try {
      return parseC64Address(value);
    } catch {
      throw new UsageError(`--entry must be $ followed by four hex digits, not ${value}`);
    }
  });
  const space = values.space ?? DEFAULT_SPACE;
  if (!SPACE.test(space)) throw new UsageError("--space must be c64, drive8, or bank0 to bank255");
  if (space !== DEFAULT_SPACE && (values.coverage !== undefined || values.loader)) throw new UsageError("--coverage and --loader work only in space c64");
  const image = readImage(positionals[0]!);
  const coverage = readCoverageFiles(values.coverage ?? [], (message) => {
    throw new UsageError(message);
  });
  if (values.loader && (image.statePath === undefined || image.entry === undefined)) throw new UsageError("--loader needs an image.json with an entry and an entry_state.json next to it, from c64-unpacker capture");
  // Read the entry state before the long steps, so a missing file stops the run at once.
  const state = values.loader ? readEntryState(readProjectFile(image.statePath!).bytes.toString("utf8"), image.statePath!) : undefined;
  const knowledge = readKnowledge(space);
  const instructions = await decode(image, knowledge, entries);
  const laid = layout({
    segments: image.segments,
    byteAt: image.byteAt,
    ...(image.entry === undefined ? {} : { entry: image.entry }),
    instructions,
    symbols: knowledge.symbols,
    regions: knowledge.regions,
    comments: knowledge.comments,
    modules: knowledge.modules,
    referenceTargets: knowledge.references.map((reference) => reference.to),
    ...(coverage === undefined ? {} : { coverage }),
    // The platform names are C64 names: drive code and banks get none.
    ...(space === DEFAULT_SPACE ? { platform: new Map(platformNames().map((item) => [item.address, item.name])) } : {}),
  });
  const asBytes = await probe(laid);
  const header = [`Generated by c64-source from ${image.path}${space === DEFAULT_SPACE ? "" : ` in space ${space}`} and knowledge revision ${knowledge.revision}.`, "Change names, comments, regions and modules in knowledge, then generate again."];
  const rendered = render(laid, asBytes, header);
  const files = [...rendered.files];
  let loader: LoaderPlan | undefined;
  if (state !== undefined) {
    const segments = image.segments.map((segment) => ({ ...segment, files: laid.pieces.filter((piece) => piece.start >= segment.start && piece.start <= segment.end).map((piece) => piece.file) }));
    loader = planLoader({ segments, byteAt: image.byteAt, state, entry: image.entry!, header: [`Loader generated by c64-source from ${image.path}.`, "It copies the segments into place, sets the entry state and jumps to the entry."] });
    files.push({ name: "loader.asm", text: loader.text });
  }
  for (const file of files) writeProjectFile(`${values.out}/${file.name}`, Buffer.from(file.text, "utf8"), { what: "--out" });

  const output: Record<string, unknown> = {
    out: values.out,
    files: files.map((file) => file.name),
    revision: knowledge.revision,
    instructions: rendered.instructions,
    dataBytes: rendered.dataBytes,
    ...(rendered.undecodedBytes === 0 ? {} : { undecodedBytes: rendered.undecodedBytes }),
    labels: { named: laid.namedLabels, generated: laid.generatedLabels },
    ...(rendered.asBytes.length === 0
      ? {}
      : { asBytes: { count: rendered.asBytes.length, listed: rendered.asBytes.slice(0, MAX_LISTED).map((item) => ({ address: formatC64Address(item.address), instruction: item.text })) } }),
    ...(rendered.notExecuted === undefined
      ? {}
      : {
          notExecuted: {
            instructions: rendered.notExecuted.instructions,
            ranges: rendered.notExecuted.ranges.length,
            listed: rendered.notExecuted.ranges.slice(0, MAX_LISTED).map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
          },
        }),
    ...(laid.unusedModules.length === 0 ? {} : { unusedModules: laid.unusedModules.map((module) => ({ start: formatC64Address(module.start), file: module.file })) }),
  };
  const built = await assembleFiles(files, "main.asm");
  if (built.program === undefined) {
    return { output: { ...output, check: { identical: false, diagnostics: built.diagnostics.slice(0, MAX_LISTED) } }, failed: true };
  }
  const checked = check(built.program, built.start!, image);
  output.check = checked;
  if (!checked.identical || loader === undefined || state === undefined) return { output, failed: !checked.identical };

  const loaderBuilt = await assembleFiles(files, "loader.asm");
  if (loaderBuilt.program === undefined) return { output: { ...output, loader: { verified: false, diagnostics: loaderBuilt.diagnostics.slice(0, MAX_LISTED) } }, failed: true };
  const program = loaderBuilt.program;
  // The simulation: the loader in memory as it loads, then every copy in its order, byte by byte.
  const memory = new Int16Array(0x10000).fill(-1);
  program.subarray(2).forEach((byte, offset) => (memory[loaderBuilt.start! + offset] = byte));
  const expected = (address: number) => (image.segments.some((segment) => address >= segment.start && address <= segment.end) ? image.byteAt(address) : state.pages[address]!);
  const wrongPacking = loader.blocks.find((block) => {
    for (let address = block.range.start; address <= block.range.end; address++) if (memory[block.packedAt + address - block.range.start] !== block.bytes(address)) return true;
    return false;
  });
  if (loaderBuilt.start !== 0x0801 || loaderBuilt.start + program.length - 3 !== loader.end || wrongPacking !== undefined) {
    throw new WireFailure("operation-failed", `The assembled loader does not have the planned layout${wrongPacking === undefined ? "" : ` (${wrongPacking.what})`}. This is a defect of the c64-source script.`);
  }
  const wrong = simulate(memory, loader.copies, expected);
  if (wrong !== undefined) throw new WireFailure("operation-failed", `The simulated loader writes a wrong byte at ${formatC64Address(wrong)}. This is a defect of the c64-source script.`);
  const loaderPath = `${values.out}/loader.prg`;
  writeProjectFile(loaderPath, program, { what: "--out" });
  (output.files as string[]).push("loader.prg");
  const ran = await runLoader(loaderPath, program, loader, image, state);
  output.loader = {
    program: loaderPath,
    copies: loader.copies.map((copy) => ({ what: copy.what, to: `${formatC64Address(copy.target.start)}-${formatC64Address(copy.target.end)}` })),
    copier: formatC64Address(loader.copier),
    stackByte: formatC64Address(loader.stackByte),
    ...ran,
  };
  return { output, failed: !ran.verified };
}

await runScript(
  async () => {
    const { output, failed } = await run(process.argv.slice(2));
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE, refusals: [KnowledgeError] },
);
