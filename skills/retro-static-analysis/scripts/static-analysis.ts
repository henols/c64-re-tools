// The retro-static-analysis script: analyzes the program in the knowledge
// with DXA (fast first pass) or Ghidra (deeper), which it runs itself, seeded
// from current knowledge and the coverage of the knowledge, and imports the
// structural findings into .c64-re-tools/knowledge/.

import { projectMainSpace } from "#src/knowledge/names.ts";
import { C64 } from "#src/machine.ts";
import { machineOf, mainSpaceOf } from "#src/knowledge/project-machine.ts";
import { prgRange } from "#src/c64.ts";
import { COVERAGE } from "#src/cpu/coverage.ts";
import { formatAddress } from "#src/address.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { analyze as analyzeWithDxa } from "#src/native/dxa.ts";
import { analyze as analyzeWithGhidra } from "#src/native/ghidra/analyze.ts";
import { localToolContext } from "#src/native/local.ts";
import { GHIDRA_LIMITS } from "#src/native/types.ts";
import { openForRead, withWrite } from "#src/knowledge/database.ts";
import { analyzedBytes, operandImages, programCoverage, requireProgram } from "#src/knowledge/program.ts";
import { applyBatch, type BatchOperation } from "#src/knowledge/write.ts";
import { importFindings, runProvenance, type ImportConflict, type ImportContext, type ImportResult, type NormalizedFindings } from "#src/knowledge/import.ts";
import { currentRevision, listMacros, listMacroUses, listPatches, listReferences, listRegions, listSymbols } from "#src/knowledge/read.ts";
import { SEMANTIC_ORIGINS, type Analyzer } from "#src/knowledge/schema.ts";
import { platformNamesOfSpace, romUseOfProgram, type RomUse } from "#src/platform.ts";
import { listed, OPTIONS, reply, runScript, UsageError, type Call } from "#src/script.ts";
import { codeEntries, coverageConflicts, coverageEntries, coverageSeedKinds, executedStarts, imageReader, romOnlyRanges, type ImageByte } from "./lib/coverage.ts";
import { dxaFindings, ghidraFindings, outsideRom, seedsFromKnowledge } from "./lib/findings.ts";
import { findIdioms } from "./lib/idioms.ts";
import { instructionList, z80InstructionList } from "./lib/instructions.ts";
import { findZ80Idioms } from "./lib/z80-idioms.ts";
import { CATALOGUE, findMacroUses, type MacroCandidate } from "./lib/macros.ts";
import { findPitfalls, type Pitfall } from "./lib/pitfalls.ts";
import { findPointers, type PointerCandidate } from "./lib/pointers.ts";

/** The rest of a cut label or function list: the knowledge has all of them as analyzer names. */
const ALL_NAMES = "a larger --max-listed. The project knowledge has all of them as analyzer names";

/**
 * The result with a hint for what the agent does next: conflicts to examine,
 * analyzer data over executed code to classify, and macro candidates to write.
 * The envelope adds the sentence for a cut list.
 */
function withHint(body: Record<string, unknown>, conflicts: number, coverageConflicts: number, macros: { candidates: number; applied: boolean; revision: string | null | undefined }) {
  const hints: string[] = [];
  if (conflicts > 0) hints.push("The analysis and the project knowledge disagree at each place in conflicts. Find the correct answer in the emulator. Then correct the project knowledge.");
  if (coverageConflicts > 0) hints.push("The coverage shows executed code in each range of coverageConflicts. Classify each range as code, or as dual-use when its bytes are also data, in the project knowledge.");
  if (typeof macros.revision === "string") hints.push("The project knowledge has the macro candidates now. Generate the source again.");
  else if (!macros.applied && macros.candidates > 0) hints.push("Examine idioms.candidates.macros. To write them to the project knowledge, run the analysis again with --apply-macros.");
  if (hints.length === 0) return body;
  return reply(body, { hint: hints.join(" ") });
}

/** A pitfall with $ addresses and what goes wrong. */
function showPitfall(pitfall: Pitfall) {
  return {
    kind: pitfall.kind,
    at: formatAddress(pitfall.at),
    store: formatAddress(pitfall.store),
    problem: "A read of $D011 gives raster bit 8 in bit 7; the write sets bit 8 of the raster compare. Clear bit 7 (AND #$7F) unless the code wants a compare at line 256 or later.",
  };
}

/** A pointer candidate with $ addresses, and the operand writes that would name it. */
function showPointer(candidate: PointerCandidate) {
  if (candidate.kind === "sprite pointer") {
    return { kind: candidate.kind, at: formatAddress(candidate.at), to: formatAddress(candidate.to), value: `$${candidate.value.toString(16).padStart(2, "0")}`, target: formatAddress(candidate.target), assumes: "VIC bank 0 and the screen at $0400" };
  }
  return { kind: candidate.kind, to: formatAddress(candidate.to), target: formatAddress(candidate.target), low: formatAddress(candidate.low), high: formatAddress(candidate.high) };
}

/** A macro candidate with $ addresses and its source line. */
function showMacro(candidate: MacroCandidate) {
  return { macro: candidate.macro, start: formatAddress(candidate.start), end: formatAddress(candidate.end), args: candidate.args, text: `+${candidate.macro} ${candidate.args.join(", ")}` };
}

/**
 * The macro candidates in the current code regions of every origin,
 * with the names of the knowledge in their args, else the platform names of
 * the ROMs that the program uses, as retro-source names them. A candidate is left out when
 * a name or a reference target is inside it, or a patch or a use overlaps it:
 * retro-source would write its instructions. The same use in the knowledge is
 * known. The writes are the candidates with the macros they need, without the
 * candidates that start at an address of `skip`. A macro of the catalogue that
 * the knowledge has with another body leaves its candidates out of the writes.
 */
function macroCandidates(space: string, byteAt: ImageByte, romUse: RomUse, skip: ReadonlySet<number>) {
  const db = openForRead();
  try {
    // The platform names that retro-source uses: a name of a ROM that the program does not use is no arg.
    const platform = new Map(platformNamesOfSpace(space, romUse).map((entry) => [entry.address, entry.name]));
    const semantic = new Map(listSymbols(db, undefined, undefined, [...SEMANTIC_ORIGINS], space).map((symbol) => [symbol.address, symbol.name]));
    const code = listRegions(db, undefined, "code", undefined, space);
    const found = findMacroUses(byteAt, code, (address) => semantic.get(address) ?? platform.get(address));
    const named = new Set([...listSymbols(db, undefined, undefined, undefined, space).map((symbol) => symbol.address), ...listReferences(db, undefined, undefined, undefined, space).map((reference) => reference.to)]);
    const patches = listPatches(db, undefined, undefined, undefined, space);
    const uses = listMacroUses(db, undefined, undefined, undefined, space);
    const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start <= b.end && b.start <= a.end;
    const candidates: MacroCandidate[] = [];
    let known = 0;
    let leftOut = 0;
    for (const candidate of found) {
      const same = uses.find((use) => use.start === candidate.start && use.end === candidate.end && use.macro === candidate.macro && use.args.join(",") === candidate.args.join(","));
      if (same !== undefined) known++;
      else if ([...named].some((address) => address > candidate.start && address <= candidate.end) || patches.some((patch) => overlaps(patch, candidate)) || uses.some((use) => overlaps(use, candidate))) leftOut++;
      else candidates.push(candidate);
    }
    // A macro of the catalogue goes into the writes unless the knowledge has it; with another body, its uses stay out.
    const macros = new Map(listMacros(db, undefined, space).map((macro) => [macro.name, macro]));
    const writes: BatchOperation[] = [];
    const other = new Set<string>();
    const chosen = candidates.filter((candidate) => !skip.has(candidate.start));
    for (const idiom of CATALOGUE.filter((item) => chosen.some((candidate) => candidate.macro === item.name))) {
      const existing = macros.get(idiom.name);
      if (existing === undefined) writes.push({ op: "macro", space, name: idiom.name, params: [...idiom.params], body: idiom.body, comment: idiom.comment });
      else if (existing.params.join(",") !== idiom.params.join(",") || existing.body !== idiom.body) other.add(idiom.name);
    }
    for (const candidate of chosen) {
      if (other.has(candidate.macro)) continue;
      writes.push({ op: "use", space, start: candidate.start, end: candidate.end, macro: candidate.macro, args: candidate.args });
    }
    const notCandidates = [...skip].filter((address) => !candidates.some((candidate) => candidate.start === address)).sort((a, b) => a - b);
    return { candidates, known, leftOut, writes, skipped: candidates.length - chosen.length, notCandidates, otherMacros: [...other].map((name) => `The knowledge has another macro ${name}: its candidates are not written.`) };
  } finally {
    db?.close();
  }
}

/** One conflict: what the knowledge has, and what the analyzer found, under the analyzer's name. */
function showConflict(conflict: ImportConflict, analyzer: Analyzer): Record<string, unknown> {
  if (conflict.category === "code-evidence") {
    return {
      range: { start: formatAddress(conflict.start), end: formatAddress(conflict.end) },
      [analyzer]: conflict.finding,
      ...(conflict.executed === undefined ? {} : { executed: formatAddress(conflict.executed) }),
      ...(conflict.symbol === undefined ? {} : { knowledge: { ...conflict.symbol, address: formatAddress(conflict.symbol.address) } }),
      problem: conflict.executed !== undefined ? "a run executed code here: the data finding is not imported" : "the knowledge has a code name here: the data finding is not imported",
    };
  }
  if (conflict.category === "symbol") {
    return {
      at: formatAddress(conflict.address),
      knowledge: { name: conflict.current.name, kind: conflict.current.kind, origin: conflict.current.origin, at: formatAddress(conflict.current.address) },
      [analyzer]: conflict.finding,
      problem: conflict.reason === "kind" ? "code and data disagree" : "another address has this name",
    };
  }
  return {
    range: { start: formatAddress(conflict.start), end: formatAddress(conflict.end) },
    knowledge: conflict.current,
    [analyzer]: conflict.finding,
    problem: "code and data disagree",
  };
}

/**
 * Imports one analyzer's findings as one revision, refused when knowledge
 * changed since the seeds were read. A refused import creates no knowledge.
 * The revision records the image hash and the analyzer version.
 */
function record(findings: NormalizedFindings, revision: string, description: string, provenance: Pick<ImportContext, "inputHash" | "toolVersion" | "evidence">) {
  let imported: ImportResult;
  try {
    imported = withWrite((db) => importFindings(db, findings, { expectedRevision: revision, description, ...provenance }));
  } catch (error) {
    if (error instanceof Refusal && error.code === "stale-revision") {
      throw new Refusal("stale-revision", "The knowledge changed during the analysis. Nothing was imported. Run the analysis again.");
    }
    throw error;
  }
  return {
    revision: imported.revision,
    changes: { names: imported.names, ...(imported.symbols.retired === 0 ? {} : { symbols: { retired: imported.symbols.retired } }), regions: imported.regions, references: imported.references },
    conflicts: imported.conflicts.map((conflict) => showConflict(conflict, findings.analyzer)),
  };
}

async function analyze(call: Call): Promise<unknown> {
  const entries = call.addresses("entry");
  const decompile = call.addresses("decompile");
  if (decompile.length > 32) throw new UsageError("--decompile takes at most 32 routines");
  const max = call.count("max-listed")!;
  const analyzer = call.string("analyzer") as "dxa" | "ghidra";
  const listingPath = call.string("out-listing");
  const instructionsPath = call.string("out-instructions");
  const applyMacros = call.flag("apply-macros");
  const skip = new Set(call.addresses("skip"));
  if (skip.size > 0 && !applyMacros) throw new UsageError("--skip works only with --apply-macros: it names a macro candidate that the run does not write");
  if (analyzer === "dxa" && decompile.length > 0) throw new UsageError("--decompile works only with --analyzer ghidra");
  if (analyzer === "ghidra" && listingPath !== undefined) throw new UsageError("--out-listing works only with --analyzer dxa");
  if (analyzer === "dxa" && instructionsPath !== undefined) throw new UsageError("--out-instructions works only with --analyzer ghidra");
  const space = call.space;
  const reader = openForRead();
  const program = requireProgram(reader, space);
  const machine = machineOf(reader);
  // DXA, the 6502 idioms, macros, pointers and pitfalls read 6502 code: a Z80 program gets Ghidra and the Z80 idioms.
  const z80 = machine.cpu.id === "z80";
  if (z80 && analyzer === "dxa") {
    reader?.close();
    throw new UsageError(`--analyzer dxa reads only 6502 code, and the ${machine.name} has a Z80. Use --analyzer ghidra`);
  }
  if (applyMacros && !machine.macros) {
    reader?.close();
    throw new UsageError(`--apply-macros writes macros, and the generated source of the ${machine.name} has no macros. Remove --apply-macros`);
  }
  // The ROM of the machine is not the program: no entry point there, and the analyzer does not decode it.
  const rom = space === machine.spaces.main ? machine.rom : [];
  const romOf = (address: number) => rom.find((range) => address >= range.start && address <= range.end);
  for (const entry of entries) {
    const range = romOf(entry);
    if (range === undefined) continue;
    reader?.close();
    throw new UsageError(`--entry ${formatAddress(entry)} is in the ROM of the ${machine.name} (${formatAddress(range.start)}-${formatAddress(range.end)}). The knowledge holds the program, not the ROM: give an entry point of the program`);
  }
  // A coverage map is of the C64 CPU: VICE keeps none for the drive.
  const covered = space === mainSpaceOf(reader) ? programCoverage(reader) : undefined;
  const coverage = covered?.map;
  const { bytes, kind: imageKind } = analyzedBytes(program);
  // The analyzer sees all bytes it gets; the coverage seeds only the program, as retro-source does.
  const byteAt = imageReader(bytes, imageKind);
  const inProgram: ImageByte = (address) => (program.segments.some((segment) => address >= segment.start && address <= segment.end) ? program.byteAt(address) : undefined);
  // With coverage, a code finding over an executed instruction start replaces the data of the other analyzer.
  const executed = coverage === undefined ? {} : { executed: (address: number) => (coverage[address]! & COVERAGE.ramExecute) !== 0 };
  const loaded = imageKind === "flat64k" ? { start: 0x0000, end: 0xffff } : prgRange(bytes);
  // The idioms read only the program: a table that runs past a segment gets no targets from the 0 bytes of the 64 KiB.
  const idioms = z80 ? undefined : findIdioms(inProgram, { start: loaded.start, end: loaded.end }, covered);

  const revision = currentRevision(reader);
  const seeds = seedsFromKnowledge(reader, entries, space, executed.executed);
  // Knowledge routines and --entry first, then code regions and JMP tables, then idioms, then coverage, up to the seed bound:
  // at most GHIDRA_LIMITS.entryPoints (1024) entry points for both analyzers, and for Ghidra at most
  // GHIDRA_LIMITS.codeStarts (8192) coverage flow starts that are code in a routine. coverageSeeds gives what was used.
  const fromCoverage = coverage === undefined ? [] : coverageEntries(coverage, inProgram, machine.cpu);
  // A Spectrum snapshot gives its PC as the entry of the program: it is a seed too.
  const snapshotEntry = z80 && program.entry !== undefined ? [program.entry] : [];
  const known = [...new Set([...seeds.entryPoints, ...snapshotEntry, ...codeEntries(reader, byteAt, space)])];
  // Ghidra takes the coverage as code starts without a function; DXA has one list.
  const kinds = analyzer === "dxa" || coverage === undefined ? { routines: fromCoverage, codeStarts: [] } : coverageSeedKinds(coverage, inProgram, machine.cpu);
  // The Z80 idioms follow the code from every seed and the entry of the program.
  const restarts = z80 ? findZ80Idioms(inProgram, { start: loaded.start, end: loaded.end }, [...known, ...kinds.routines, ...kinds.codeStarts, ...(program.entry === undefined ? [] : [program.entry])]) : undefined;
  const ordered = [...new Set([...known, ...(idioms?.entryPoints ?? []), ...kinds.routines])].filter((entry) => romOf(entry) === undefined);
  seeds.entryPoints = ordered.slice(0, GHIDRA_LIMITS.entryPoints).sort((a, b) => a - b);
  const codeStarts = [...new Set([...kinds.codeStarts, ...(restarts?.codeStarts ?? [])])].filter((entry) => !seeds.entryPoints.includes(entry)).slice(0, GHIDRA_LIMITS.codeStarts);
  // Idiom tables and the RAM under ROM that the runs never used are data for this run too; semantic data ranges come first.
  // A range with an entry point of the knowledge or --entry in it is left out: that code stays code.
  // The RAM under a ROM that the program can switch out: a Z80 machine has none.
  const fromRom = coverage === undefined || z80 ? [] : romOnlyRanges(coverage, byteAt).filter((range) => !known.some((entry) => entry >= range.start && entry <= range.end));
  const dataRanges = [...rom, ...seeds.dataRanges];
  for (const range of [...(idioms ?? restarts)!.dataRanges, ...fromRom]) if (!dataRanges.some((seed) => range.start <= seed.end && range.end >= seed.start)) dataRanges.push(range);
  seeds.dataRanges = dataRanges.slice(0, GHIDRA_LIMITS.dataRanges);
  const romUsed = fromRom.filter((range) => seeds.dataRanges.includes(range)).length;
  const coverageUsed = fromCoverage.filter((entry) => seeds.entryPoints.includes(entry) || codeStarts.includes(entry)).length;
  // Drive code and banks get no platform names.
  const platform = platformNamesOfSpace(space);
  reader?.close();
  /** Imports the idioms as their own revision, after the analyzer's, and gives their part of the result. */
  const idiomsResult = () => {
    if (restarts !== undefined) {
      const imported = withWrite((db) => importFindings(db, { ...restarts.findings, space }, { description: "Z80 idioms in the program" }));
      return {
        idioms: {
          ...restarts.counts,
          revision: imported.revision,
          changes: { regions: imported.regions, references: imported.references },
          conflicts: imported.conflicts.map((conflict) => showConflict(conflict, "heuristic")),
        },
      };
    }
    const found = idioms!;
    const imported = withWrite((db) => importFindings(db, { ...found.findings, space }, { description: "Idioms in the program" }));
    // The macro candidates read the code regions after both imports.
    const macros = macroCandidates(space, byteAt, romUseOfProgram(coverage, program.state), skip);
    // With --apply-macros, the candidates and their macros are a third revision of the LLM.
    const written = applyMacros && macros.writes.length > 0 ? withWrite((db) => applyBatch(db, { origin: "llm", description: "Macro candidates in the program", image: operandImages(db) }, macros.writes)) : undefined;
    // Platform pitfalls are C64 facts: drive code and banks get none. Pitfalls and pointers read the code regions after both imports.
    const codeDb = openForRead();
    const code = listRegions(codeDb, undefined, "code", undefined, space);
    const pitfalls = space === C64.spaces.main ? findPitfalls(byteAt, code) : [];
    const pointers = findPointers(byteAt, { start: loaded.start, end: loaded.end }, code, {
      platform: (address) => platform.some((entry) => address >= entry.address && address <= entry.end),
      sprites: listRegions(codeDb, undefined, "sprite", undefined, space),
    });
    codeDb?.close();
    return {
      idioms: {
        ...found.counts,
        revision: imported.revision,
        changes: { regions: imported.regions, references: imported.references },
        conflicts: imported.conflicts.map((conflict) => showConflict(conflict, "heuristic")),
        // Candidates are not knowledge: a larger --max-listed gives more of them.
        candidates: {
          dop: listed(found.candidates.dop, max, formatAddress, "a larger --max-listed"),
          selfModified: listed(found.candidates.selfModified, max, formatAddress, "a larger --max-listed"),
          pointers: listed(pointers, max, showPointer, "a larger --max-listed"),
          pitfalls: listed(pitfalls, max, showPitfall, "a larger --max-listed"),
          macros: {
            ...listed(macros.candidates, max, showMacro, "a larger --max-listed"),
            ...(macros.known === 0 ? {} : { known: macros.known }),
            ...(macros.leftOut === 0 ? {} : { leftOut: macros.leftOut }),
            ...(written === undefined ? {} : { revision: written.revision, writes: macros.writes.length }),
            ...(macros.skipped === 0 ? {} : { skipped: macros.skipped }),
            ...(macros.notCandidates.length === 0 ? {} : { notCandidates: macros.notCandidates.map(formatAddress) }),
            ...(macros.otherMacros.length === 0 ? {} : { otherMacros: macros.otherMacros }),
          },
        },
      },
    };
  };
  /** The coverage part of a result: its seeds, and the analyzer data that it shows to be code. */
  const coverageResult = () => {
    if (coverage === undefined) return {};
    const db = openForRead();
    const conflicts = coverageConflicts(db, coverage);
    db?.close();
    return {
      coverageSeeds: { entryPoints: fromCoverage.length, used: coverageUsed, ...(z80 ? {} : { romOnlyRanges: fromRom.length, romOnlyUsed: romUsed }) },
      coverageConflicts: conflicts.map(({ region, executed }) => ({
        range: { start: formatAddress(region.start), end: formatAddress(region.end) },
        knowledge: { type: region.type, origin: region.origin },
        executed,
        problem: "coverage shows code",
      })),
    };
  };
  if (analyzer === "dxa") {
    const { result, attachments } = await analyzeWithDxa({ imageKind, ...seeds }, bytes, localToolContext());
    const listing = attachments[0]!.toString("utf8");
    // The listing is written only after the import: a refused import leaves no new file.
    const imported = record({ ...dxaFindings(result), space, ...executed }, revision, "DXA analysis of the program", runProvenance(bytes, result.toolVersion));
    let written: ReturnType<typeof writeReported> | undefined;
    if (listingPath !== undefined) {
      try {
        written = writeReported(listingPath, listing, { what: "--out-listing" });
      } catch (error) {
        const recorded = imported.revision === null ? "The knowledge did not change." : `The knowledge has the findings as revision ${imported.revision}.`;
        throw new WireFailure(isRefusal(error) ? error.code : "operation-failed", `The script did not write the listing to ${listingPath}: ${(error as Error).message.replace(/\.$/, "")}. ${recorded}`);
      }
    }
    const found = idiomsResult();
    const body = {
      analyzer: "dxa",
      ...(space === C64.spaces.main ? {} : { space }),
      ...found,
      ...coverageResult(),
      coverage: result.coverage.map((range) => ({ start: formatAddress(range.start), end: formatAddress(range.end) })),
      ...imported,
      regions: result.regions.map((region) => ({ start: formatAddress(region.start), end: formatAddress(region.end), classification: region.classification })),
      labels: listed(result.labels, max, (label) => ({ address: formatAddress(label.address), name: label.name }), ALL_NAMES),
      ...(written === undefined ? {} : { listing: written }),
    };
    return withHint(body, imported.conflicts.length + found.idioms.conflicts.length, body.coverageConflicts?.length ?? 0, ("candidates" in found.idioms ? { candidates: found.idioms.candidates.macros.count, applied: applyMacros, revision: found.idioms.candidates.macros.revision } : { candidates: 0, applied: false, revision: undefined }));
  }

  const { result } = await analyzeWithGhidra({ imageKind, ...seeds, codeStarts, decompile }, bytes, localToolContext(), machine);
  // Executed instruction starts that Ghidra did not decode: the instruction list and the source miss them.
  const decoded = new Set(result.instructions.map((instruction) => instruction.address));
  const imported = record({ ...outsideRom(ghidraFindings(result, machine.cpu.id), rom), space, ...executed }, revision, "Ghidra analysis of the program", runProvenance(bytes, result.toolVersion));
  const found = idiomsResult();
  // A start inside a dual-use region is a known overlap, for example the second instruction of a BIT skip: one list cannot hold both.
  // Read after the idioms, which write those regions.
  const overlapDb = coverage === undefined ? undefined : openForRead();
  const overlaps = listRegions(overlapDb, undefined, "dual-use", undefined, space);
  overlapDb?.close();
  const gaps = coverage === undefined ? [] : executedStarts(coverage, inProgram).filter((address) => address >= loaded.start && address <= loaded.end && !decoded.has(address) && !overlaps.some((region) => address >= region.start && address <= region.end));
  let instructions: Record<string, unknown> | undefined;
  if (instructionsPath !== undefined) {
    const list = z80 ? z80InstructionList(result.instructions, coverage) : instructionList(result.instructions, coverage);
    instructions = { count: list.length, ...writeReported(instructionsPath, `${JSON.stringify(list, null, 1)}\n`, { what: "--out-instructions" }) };
  }
  const body = {
    analyzer: "ghidra",
    ...(space === machine.spaces.main ? {} : { space }),
    ...(instructions === undefined ? {} : { instructions }),
    ...found,
    ...coverageResult(),
    ...(coverage === undefined ? {} : { coverageGaps: listed(gaps, max, formatAddress, "a larger --max-listed") }),
    coverage: result.coverage.map((range) => ({ start: formatAddress(range.start), end: formatAddress(range.end) })),
    ...imported,
    functions: listed(result.functions, max, (fn) => ({ entry: formatAddress(fn.entry), name: fn.name }), ALL_NAMES),
    decompilations: result.decompilations.map((item) => ({ entry: formatAddress(item.entry), text: item.text, ...(item.truncated ? { truncated: true } : {}) })),
    ...((result.notDecompiled ?? []).length === 0
      ? {}
      : { notDecompiled: result.notDecompiled!.map((item) => ({ entry: formatAddress(item.entry), reason: item.reason })) }),
  };
  return withHint(body, imported.conflicts.length + found.idioms.conflicts.length, body.coverageConflicts?.length ?? 0, ("candidates" in found.idioms ? { candidates: found.idioms.candidates.macros.count, applied: applyMacros, revision: found.idioms.candidates.macros.revision } : { candidates: 0, applied: false, revision: undefined }));
}

await runScript({
  name: "static-analysis",
  summary: "Analyzes the program in the knowledge with DXA or Ghidra, seeded from the knowledge and its coverage, and imports the structural findings into the knowledge.",
  names: knowledgeNames,
  mainSpace: projectMainSpace,
  commands: [
    {
      name: "analyze",
      summary: "Runs the analyzer over the program in the knowledge and imports what it finds as one revision, then the idioms of the CPU as a second one.",
      options: {
        analyzer: { kind: "choice", value: "<dxa|ghidra>", choices: ["dxa", "ghidra"], default: "ghidra", help: "dxa (a fast first pass) or ghidra (deeper, the default)" },
        entry: { ...OPTIONS.entry, multiple: true, help: "an entry point of the program" },
        decompile: { kind: "address", value: "<address>", multiple: true, help: "ghidra: a routine to decompile, at most 32" },
        space: OPTIONS.space,
        "max-listed": { ...OPTIONS["max-listed"], help: "list at most n labels, functions or candidates (default 50, 0 for none). The counts are always given, and the knowledge has all labels and functions" },
        "out-listing": { kind: "path", output: "file", value: "<file>", help: "dxa: write the disassembly listing to this project file" },
        "out-instructions": { kind: "path", output: "file", value: "<file>", help: "ghidra: write every instruction (address, bytes, mnemonic, mode, operand, target, executed) to this project file as JSON" },
        "apply-macros": { kind: "flag", help: "write the macro candidates (the macros and their uses) to the project knowledge as one revision of the LLM" },
        skip: { kind: "address", value: "<address>", multiple: true, help: "with --apply-macros: the start of a macro candidate that is not correct. The run does not write it" },
      },
      notes: "The program and the coverage come from the project knowledge: put them into the project knowledge first. The executed code of the coverage gives entry points. Routine symbols in the knowledge are entry points too. Ghidra needs at least one entry point. DXA finds the SYS of a BASIC start by itself.",
      run: analyze,
    },
  ],
});
