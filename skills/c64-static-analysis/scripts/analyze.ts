// The c64-static-analysis script: analyzes a project program with DXA (fast
// first pass) or Ghidra (deeper), which it runs itself, seeded from
// current knowledge, and imports the structural findings into
// .c64-re-tools/knowledge/.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { COVERAGE, formatC64Address, parseC64Address, prgRange } from "#src/c64.ts";
import { joinCoverage } from "#src/host-client/coverage.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { analyze as analyzeWithDxa } from "#src/native/dxa.ts";
import { analyze as analyzeWithGhidra } from "#src/native/ghidra/analyze.ts";
import { localToolContext } from "#src/native/local.ts";
import { GHIDRA_LIMITS } from "#src/native/types.ts";
import { KnowledgeError, openForRead, withWrite } from "#src/knowledge/database.ts";
import { importFindings, runProvenance, type Analyzer, type ImportConflict, type ImportContext, type ImportResult, type NormalizedFindings } from "#src/knowledge/import.ts";
import { currentRevision, listMacros, listMacroUses, listPatches, listReferences, listRegions, listSymbols } from "#src/knowledge/read.ts";
import { DEFAULT_SPACE, SPACE } from "#src/knowledge/schema.ts";
import { platformNames } from "#src/platform.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { codeEntries, coverageConflicts, coverageEntries, coverageSeedKinds, executedStarts, imageReader, readCoverageMaps, romOnlyRanges, type ImageByte } from "./lib/coverage.ts";
import { dxaFindings, ghidraFindings, seedsFromKnowledge } from "./lib/findings.ts";
import { findIdioms } from "./lib/idioms.ts";
import { instructionList } from "./lib/instructions.ts";
import { CATALOGUE, findMacroUses, type MacroCandidate } from "./lib/macros.ts";
import { findPointers, type PointerCandidate } from "./lib/pointers.ts";

const USAGE = `analyze.ts <image> [options]

  <image>                 a PRG file, relative to the project folder
  --analyzer <name>       dxa (fast first pass) or ghidra (deeper, the default)
  --flat64k               the image is 64 KiB of memory from $0000, not a PRG
  --entry <address>       an entry point, for example '$080d' (repeatable)
  --decompile <address>   ghidra: a routine to decompile, at most 32 (repeatable)
  --listing <file>        dxa: write the disassembly listing to this project file
  --instructions <file>   ghidra: write every instruction (address, bytes, mnemonic,
                          mode, operand, target, executed) to this project file as JSON
  --coverage <file>       a coverage map of 64 KiB from c64_memmap (repeatable): its
                          executed code is seeded, and analyzer data over it is reported
  --max-listed <n>        list at most n labels, functions or candidates (default 50,
                          0 for none); the counts are always given, and knowledge has
                          all labels and functions
  --space <space>         the knowledge space of the image: c64 (the default), drive8
                          for 1541 drive code, or bank0 to bank255 for a cartridge bank
  --macro-batch <file>    write the macro candidates as an apply batch of c64-knowledge
                          (the macros and their uses) to this project file

Routine symbols in knowledge are entry points too. Ghidra needs at least one
entry point; dxa finds the SYS of a BASIC start by itself. The result is one
JSON object. Addresses are $ and four hex digits.`;

const DEFAULT_MAX_LISTED = 50;

/** The first `max` items, the count, and where to read the rest when the list is cut. */
function listed<T, U>(items: T[], max: number, show: (item: T) => U, all: string) {
  return { count: items.length, listed: items.slice(0, max).map(show), ...(items.length > max ? { rest: all } : {}) };
}

/** A pointer candidate with $ addresses, and the operand writes that would name it (D65). */
function showPointer(candidate: PointerCandidate) {
  const hex = formatC64Address;
  if (candidate.kind === "sprite pointer") {
    return { kind: candidate.kind, at: hex(candidate.at), to: hex(candidate.to), value: `$${candidate.value.toString(16).padStart(2, "0")}`, target: hex(candidate.target), assumes: "VIC bank 0 and the screen at $0400" };
  }
  return { kind: candidate.kind, to: hex(candidate.to), target: hex(candidate.target), low: hex(candidate.low), high: hex(candidate.high) };
}

/** A macro candidate with $ addresses and its source line (D73). */
function showMacro(candidate: MacroCandidate) {
  return { macro: candidate.macro, start: formatC64Address(candidate.start), end: formatC64Address(candidate.end), args: candidate.args, text: `+${candidate.macro} ${candidate.args.join(", ")}` };
}

/**
 * The macro candidates (D73) in the current code regions of every origin,
 * with the names of the knowledge in their args. A candidate is left out when
 * a name or a reference target is inside it, or a patch or a use overlaps it:
 * c64-source would write its instructions. The same use in the knowledge is
 * known. With `batchPath`, the candidates go to an apply batch with the
 * macros they need; a macro of the catalogue that the knowledge has with
 * another body leaves its candidates out of the batch.
 */
function macroCandidates(space: string, image: string, byteAt: ImageByte, batchPath: string | undefined) {
  const db = openForRead();
  try {
    const platform = space === DEFAULT_SPACE ? new Map(platformNames().map((entry) => [entry.address, entry.name])) : new Map<number, string>();
    const semantic = new Map(listSymbols(db, undefined, undefined, ["user", "llm"], space).map((symbol) => [symbol.address, symbol.name]));
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
    if (batchPath === undefined) return { candidates, known, leftOut };
    // A macro of the catalogue goes into the batch unless the knowledge has it; with another body, its uses stay out.
    const macros = new Map(listMacros(db, undefined, space).map((macro) => [macro.name, macro]));
    const batch: Array<Record<string, unknown>> = [];
    const batched: MacroCandidate[] = [];
    const other = new Set<string>();
    for (const idiom of CATALOGUE.filter((item) => candidates.some((candidate) => candidate.macro === item.name))) {
      const existing = macros.get(idiom.name);
      if (existing === undefined) batch.push({ op: "macro", name: idiom.name, params: idiom.params, body: idiom.body, comment: idiom.comment, ...(space === DEFAULT_SPACE ? {} : { space }) });
      else if (existing.params.join(",") !== idiom.params.join(",") || existing.body !== idiom.body) other.add(idiom.name);
    }
    for (const candidate of candidates) {
      if (other.has(candidate.macro)) continue;
      batched.push(candidate);
      batch.push({ op: "use", start: formatC64Address(candidate.start), end: formatC64Address(candidate.end), macro: candidate.macro, args: candidate.args, ...(space === DEFAULT_SPACE ? {} : { space }) });
    }
    if (batch.length > 0) writeProjectFile(batchPath, Buffer.from(`${JSON.stringify(batch, null, 1)}\n`), { what: "--macro-batch" });
    return {
      candidates,
      known,
      leftOut,
      batch: {
        out: batchPath,
        writes: batch.length,
        ...(other.size === 0 ? {} : { otherMacros: [...other].map((name) => `The knowledge has another macro ${name}: its candidates are not in the batch.`) }),
        ...(batch.length === 0 ? {} : { apply: `knowledge.ts apply ${batchPath} --image ${image} --reason "macro uses of 6502 idioms"` }),
      },
    };
  } finally {
    db?.close();
  }
}

/** A decompiler that did not start gets the remedy: Ghidra ships no native decompiler for macOS. */
function withRemedy(reason: string): string {
  return reason.startsWith("the Ghidra decompiler did not start")
    ? `${reason} On macOS, build the native decompiler once: in <Ghidra>/support/gradle run ./gradlew buildNatives.`
    : reason;
}

function addresses(values: string[] | undefined, option: string): number[] {
  return (values ?? []).map((value) => {
    try {
      return parseC64Address(value);
    } catch {
      throw new UsageError(`${option} must be $ followed by four hex digits, not ${value}`);
    }
  });
}

/** One conflict: what the knowledge has, and what the analyzer found, under the analyzer's name. */
function showConflict(conflict: ImportConflict, analyzer: Analyzer): Record<string, unknown> {
  if (conflict.category === "symbol") {
    return {
      at: formatC64Address(conflict.address),
      knowledge: { name: conflict.current.name, kind: conflict.current.kind, origin: conflict.current.origin, at: formatC64Address(conflict.current.address) },
      [analyzer]: conflict.finding,
      problem: conflict.reason === "kind" ? "code and data disagree" : "another address has this name",
    };
  }
  return {
    range: { start: formatC64Address(conflict.start), end: formatC64Address(conflict.end) },
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
    if (error instanceof KnowledgeError && error.code === "stale-revision") {
      throw new KnowledgeError("stale-revision", "The knowledge changed during the analysis. Nothing was imported. Run the analysis again.");
    }
    throw error;
  }
  return {
    revision: imported.revision,
    changes: { names: imported.names, ...(imported.symbols.retired === 0 ? {} : { symbols: { retired: imported.symbols.retired } }), regions: imported.regions, references: imported.references },
    conflicts: imported.conflicts.map((conflict) => showConflict(conflict, findings.analyzer)),
  };
}

async function run(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      analyzer: { type: "string" },
      flat64k: { type: "boolean" },
      entry: { type: "string", multiple: true },
      decompile: { type: "string", multiple: true },
      listing: { type: "string" },
      "max-listed": { type: "string" },
      coverage: { type: "string", multiple: true },
      instructions: { type: "string" },
      space: { type: "string" },
      "macro-batch": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one image");
  const image = positionals[0]!;
  const entries = addresses(values.entry, "--entry");
  const decompile = addresses(values.decompile, "--decompile");
  if (decompile.length > 32) throw new UsageError("--decompile takes at most 32 routines");
  const maxListed = values["max-listed"] ?? String(DEFAULT_MAX_LISTED);
  if (!/^\d{1,5}$/.test(maxListed)) throw new UsageError(`--max-listed must be a whole number, not ${maxListed}`);
  const max = Number(maxListed);
  const analyzer = values.analyzer ?? "ghidra";
  if (analyzer !== "dxa" && analyzer !== "ghidra") throw new UsageError(`--analyzer must be dxa or ghidra, not ${analyzer}`);
  if (analyzer === "dxa" && decompile.length > 0) throw new UsageError("--decompile works only with --analyzer ghidra");
  if (analyzer === "ghidra" && values.listing !== undefined) throw new UsageError("--listing works only with --analyzer dxa");
  if (analyzer === "dxa" && values.instructions !== undefined) throw new UsageError("--instructions works only with --analyzer ghidra");
  let listingPath: string | undefined;
  if (values.listing !== undefined) {
    try {
      listingPath = resolveProjectPath(values.listing);
    } catch {
      throw new UsageError(`--listing must be a path relative to the project folder that stays inside it, not ${values.listing}`);
    }
  }

  if (values["macro-batch"] !== undefined) {
    try {
      resolveProjectPath(values["macro-batch"]);
    } catch {
      throw new UsageError(`--macro-batch must be a path relative to the project folder that stays inside it, not ${values["macro-batch"]}`);
    }
  }

  const space = values.space ?? DEFAULT_SPACE;
  if (!SPACE.test(space)) throw new UsageError("--space must be c64, drive8, or bank0 to bank255");
  // A coverage map is of the C64 CPU: VICE keeps none for the drive (D53).
  if (space !== DEFAULT_SPACE && values.coverage !== undefined) throw new UsageError("--coverage works only in space c64");
  const imageKind = values.flat64k ? "flat64k" : "prg";
  const bytes = readProjectFile(image).bytes;
  const runs = readCoverageMaps(values.coverage ?? []);
  const coverage = runs.length === 0 ? undefined : joinCoverage(runs);
  const byteAt = imageReader(bytes, imageKind);
  // With coverage, a code finding over an executed instruction start replaces the data of the other analyzer (D58), and the files are the evidence.
  const executed = coverage === undefined ? {} : { executed: (address: number) => (coverage[address]! & COVERAGE.ramExecute) !== 0 };
  const coverageEvidence = coverage === undefined ? {} : { evidence: (values.coverage ?? []).map((path) => ({ kind: "coverage" as const, ref: path, sha256: createHash("sha256").update(readProjectFile(path).bytes).digest("hex") })) };

  let loaded: { start: number; end: number };
  try {
    loaded = imageKind === "flat64k" ? { start: 0x0000, end: bytes.length - 1 } : prgRange(bytes);
  } catch (error) {
    throw new UsageError(`${image}: ${(error as Error).message}`);
  }
  const idioms = findIdioms(byteAt, { start: loaded.start, end: loaded.end }, runs);

  const reader = openForRead();
  const revision = currentRevision(reader);
  const seeds = seedsFromKnowledge(reader, entries, space);
  // Knowledge routines and --entry first, then code regions and JMP tables, then idioms, then coverage, up to the seed bound (D44).
  const fromCoverage = coverage === undefined ? [] : coverageEntries(coverage, byteAt);
  const known = [...seeds.entryPoints, ...codeEntries(reader, byteAt, space)];
  // Ghidra takes the coverage as code starts without a function (D74); DXA has one list.
  const kinds = analyzer === "dxa" || coverage === undefined ? { routines: fromCoverage, codeStarts: [] } : coverageSeedKinds(coverage, byteAt);
  const ordered = [...new Set([...known, ...idioms.entryPoints, ...kinds.routines])];
  seeds.entryPoints = ordered.slice(0, GHIDRA_LIMITS.entryPoints).sort((a, b) => a - b);
  const codeStarts = kinds.codeStarts.filter((entry) => !seeds.entryPoints.includes(entry)).slice(0, GHIDRA_LIMITS.codeStarts);
  // Idiom tables and the RAM under ROM that the runs never used are data for this run too; semantic data ranges come first.
  // A range with an entry point of the knowledge or --entry in it is left out: that code stays code.
  const fromRom = coverage === undefined ? [] : romOnlyRanges(coverage, byteAt).filter((range) => !known.some((entry) => entry >= range.start && entry <= range.end));
  const dataRanges = [...seeds.dataRanges];
  for (const range of [...idioms.dataRanges, ...fromRom]) if (!dataRanges.some((seed) => range.start <= seed.end && range.end >= seed.start)) dataRanges.push(range);
  seeds.dataRanges = dataRanges.slice(0, GHIDRA_LIMITS.dataRanges);
  const romUsed = fromRom.filter((range) => seeds.dataRanges.includes(range)).length;
  const coverageUsed = fromCoverage.filter((entry) => seeds.entryPoints.includes(entry) || codeStarts.includes(entry)).length;
  // Platform names are C64 names: drive code and banks get none.
  const platform = space === DEFAULT_SPACE ? platformNames() : [];
  const pointers = findPointers(byteAt, { start: loaded.start, end: loaded.end }, {
    platform: (address) => platform.some((entry) => address >= entry.address && address <= entry.end),
    sprites: listRegions(reader, undefined, "sprite", undefined, space),
  });
  reader?.close();
  /** Imports the idioms as their own revision, after the analyzer's, and gives their part of the result. */
  const idiomsResult = () => {
    const imported = withWrite((db) => importFindings(db, { ...idioms.findings, space }, { description: `Idioms in ${image}` }));
    // The macro candidates read the code regions after both imports (D73).
    const macros = macroCandidates(space, image, byteAt, values["macro-batch"]);
    return {
      idioms: {
        ...idioms.counts,
        revision: imported.revision,
        changes: { regions: imported.regions, references: imported.references },
        conflicts: imported.conflicts.map((conflict) => showConflict(conflict, "heuristic")),
        // Candidates are not knowledge: a larger --max-listed gives more of them.
        candidates: {
          dop: listed(idioms.candidates.dop, max, formatC64Address, "a larger --max-listed"),
          selfModified: listed(idioms.candidates.selfModified, max, formatC64Address, "a larger --max-listed"),
          pointers: listed(pointers, max, showPointer, "a larger --max-listed"),
          macros: {
            ...listed(macros.candidates, max, showMacro, "a larger --max-listed, or --macro-batch <file>"),
            ...(macros.known === 0 ? {} : { known: macros.known }),
            ...(macros.leftOut === 0 ? {} : { leftOut: macros.leftOut }),
            ...(macros.batch === undefined ? {} : { batch: macros.batch }),
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
      coverageSeeds: { entryPoints: fromCoverage.length, used: coverageUsed, romOnlyRanges: fromRom.length, romOnlyUsed: romUsed },
      coverageConflicts: conflicts.map(({ region, executed }) => ({
        range: { start: formatC64Address(region.start), end: formatC64Address(region.end) },
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
    const imported = record({ ...dxaFindings(result), space, ...executed }, revision, `DXA analysis of ${image}`, { ...runProvenance(bytes, result.toolVersion), ...coverageEvidence });
    if (listingPath !== undefined) {
      try {
        mkdirSync(dirname(listingPath), { recursive: true });
        writeFileSync(listingPath, listing);
      } catch (error) {
        const recorded = imported.revision === null ? "The knowledge did not change." : `The knowledge has the findings as revision ${imported.revision}.`;
        throw new WireFailure("operation-failed", `The script did not write the listing to ${values.listing}: ${(error as Error).message}. ${recorded}`);
      }
    }
    const found = idiomsResult();
    return {
      analyzer: "dxa",
      ...(space === DEFAULT_SPACE ? {} : { space }),
      ...found,
      ...coverageResult(),
      coverage: result.coverage.map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
      ...imported,
      regions: result.regions.map((region) => ({ start: formatC64Address(region.start), end: formatC64Address(region.end), classification: region.classification })),
      labels: listed(result.labels, max, (label) => ({ address: formatC64Address(label.address), name: label.name }), "c64-knowledge: knowledge.ts symbols"),
      ...(listingPath === undefined ? {} : { listing: values.listing }),
    };
  }

  const { result } = await analyzeWithGhidra({ imageKind, ...seeds, codeStarts, decompile }, bytes, localToolContext());
  // Executed instruction starts that Ghidra did not decode: the instruction list and the source miss them.
  const decoded = new Set(result.instructions.map((instruction) => instruction.address));
  const gaps = coverage === undefined ? [] : executedStarts(coverage, byteAt).filter((address) => address >= loaded.start && address <= loaded.end && !decoded.has(address));
  const imported = record({ ...ghidraFindings(result), space, ...executed }, revision, `Ghidra analysis of ${image}`, { ...runProvenance(bytes, result.toolVersion), ...coverageEvidence });
  const found = idiomsResult();
  let instructions: { out: string; count: number } | undefined;
  if (values.instructions !== undefined) {
    const list = instructionList(result.instructions, coverage);
    writeProjectFile(values.instructions, Buffer.from(`${JSON.stringify(list, null, 1)}\n`), { what: "--instructions" });
    instructions = { out: values.instructions, count: list.length };
  }
  return {
    analyzer: "ghidra",
    ...(space === DEFAULT_SPACE ? {} : { space }),
    ...(instructions === undefined ? {} : { instructions }),
    ...found,
    ...coverageResult(),
    ...(coverage === undefined ? {} : { coverageGaps: listed(gaps, max, formatC64Address, "a larger --max-listed") }),
    coverage: result.coverage.map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
    ...imported,
    functions: listed(result.functions, max, (fn) => ({ entry: formatC64Address(fn.entry), name: fn.name }), "c64-knowledge: knowledge.ts symbols --kind routine"),
    decompilations: result.decompilations.map((item) => ({ entry: formatC64Address(item.entry), text: item.text, ...(item.truncated ? { truncated: true } : {}) })),
    ...((result.notDecompiled ?? []).length === 0
      ? {}
      : { notDecompiled: result.notDecompiled!.map((item) => ({ entry: formatC64Address(item.entry), reason: withRemedy(item.reason) })) }),
  };
}

await runScript((argv) => run(argv), { usage: USAGE, refusals: [KnowledgeError] });
