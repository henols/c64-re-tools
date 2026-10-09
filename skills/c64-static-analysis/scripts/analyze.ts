// The c64-static-analysis script: analyzes a project program with DXA (fast
// first pass) or Ghidra (deeper), which it runs itself, seeded from
// current knowledge, and imports the structural findings into
// .c64-re-tools/knowledge.db.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { analyze as analyzeWithDxa } from "#src/native/dxa.ts";
import { analyze as analyzeWithGhidra } from "#src/native/ghidra/analyze.ts";
import { localToolContext } from "#src/native/local.ts";
import { KnowledgeError, openForRead, withWrite } from "#src/knowledge/database.ts";
import { importFindings, runProvenance, type Analyzer, type ImportConflict, type ImportContext, type ImportResult, type NormalizedFindings } from "#src/knowledge/import.ts";
import { currentRevision } from "#src/knowledge/read.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { dxaFindings, ghidraFindings, seedsFromKnowledge } from "./findings.ts";

const USAGE = `analyze.ts <image> [options]

  <image>                 a PRG file, relative to the project directory
  --analyzer <name>       dxa (fast first pass) or ghidra (deeper, the default)
  --flat64k               the image is 64 KiB of memory from $0000, not a PRG
  --entry <address>       an entry point, for example '$080d' (repeatable)
  --decompile <address>   ghidra: a routine to decompile, at most 32 (repeatable)
  --listing <file>        dxa: write the disassembly listing to this project file

Routine symbols in knowledge are entry points too. Ghidra needs at least one
entry point; dxa finds the SYS of a BASIC start by itself. The result is one
JSON object. Addresses are $ and four hex digits.`;

const MAX_LISTED_FUNCTIONS = 200;

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
 * changed since the seeds were read. A refused import creates no knowledge.db.
 * The revision records the image hash and the analyzer version.
 */
function record(findings: NormalizedFindings, revision: number, description: string, provenance: Pick<ImportContext, "inputHash" | "toolVersion">) {
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
    changes: { symbols: imported.symbols, regions: imported.regions, references: imported.references },
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
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one image");
  const image = positionals[0]!;
  const entries = addresses(values.entry, "--entry");
  const decompile = addresses(values.decompile, "--decompile");
  if (decompile.length > 32) throw new UsageError("--decompile takes at most 32 routines");
  const analyzer = values.analyzer ?? "ghidra";
  if (analyzer !== "dxa" && analyzer !== "ghidra") throw new UsageError(`--analyzer must be dxa or ghidra, not ${analyzer}`);
  if (analyzer === "dxa" && decompile.length > 0) throw new UsageError("--decompile works only with --analyzer ghidra");
  if (analyzer === "ghidra" && values.listing !== undefined) throw new UsageError("--listing works only with --analyzer dxa");
  let listingPath: string | undefined;
  if (values.listing !== undefined) {
    try {
      listingPath = resolveProjectPath(values.listing);
    } catch {
      throw new UsageError(`--listing must be a path relative to the project directory that stays inside it, not ${values.listing}`);
    }
  }

  const reader = openForRead();
  const revision = currentRevision(reader);
  const seeds = seedsFromKnowledge(reader, entries);
  reader?.close();

  const imageKind = values.flat64k ? "flat64k" : "prg";
  const bytes = readProjectFile(image).bytes;
  if (analyzer === "dxa") {
    const { result, attachments } = await analyzeWithDxa({ imageKind, ...seeds }, bytes, localToolContext());
    const listing = attachments[0]!.toString("utf8");
    // The listing is written only after the import: a refused import leaves no new file.
    const imported = record(dxaFindings(result), revision, `DXA analysis of ${image}`, runProvenance(bytes, result.toolVersion));
    if (listingPath !== undefined) {
      try {
        mkdirSync(dirname(listingPath), { recursive: true });
        writeFileSync(listingPath, listing);
      } catch (error) {
        const recorded = imported.revision === null ? "The knowledge did not change." : `The knowledge has the findings as revision ${imported.revision}.`;
        throw new WireFailure("operation-failed", `The script did not write the listing to ${values.listing}: ${(error as Error).message}. ${recorded}`);
      }
    }
    return {
      analyzer: "dxa",
      coverage: result.coverage.map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
      ...imported,
      regions: result.regions.map((region) => ({ start: formatC64Address(region.start), end: formatC64Address(region.end), classification: region.classification })),
      labels: result.labels.slice(0, MAX_LISTED_FUNCTIONS).map((label) => ({ address: formatC64Address(label.address), name: label.name })),
      ...(result.labels.length > MAX_LISTED_FUNCTIONS ? { moreLabels: result.labels.length - MAX_LISTED_FUNCTIONS } : {}),
      ...(listingPath === undefined ? {} : { listing: values.listing }),
    };
  }

  const { result } = await analyzeWithGhidra({ imageKind, ...seeds, decompile }, bytes, localToolContext());
  const imported = record(ghidraFindings(result), revision, `Ghidra analysis of ${image}`, runProvenance(bytes, result.toolVersion));
  return {
    analyzer: "ghidra",
    coverage: result.coverage.map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
    ...imported,
    functions: result.functions.slice(0, MAX_LISTED_FUNCTIONS).map((fn) => ({ entry: formatC64Address(fn.entry), name: fn.name })),
    ...(result.functions.length > MAX_LISTED_FUNCTIONS ? { moreFunctions: result.functions.length - MAX_LISTED_FUNCTIONS } : {}),
    decompilations: result.decompilations.map((item) => ({ entry: formatC64Address(item.entry), text: item.text, ...(item.truncated ? { truncated: true } : {}) })),
    ...((result.notDecompiled ?? []).length === 0
      ? {}
      : { notDecompiled: result.notDecompiled!.map((item) => ({ entry: formatC64Address(item.entry), reason: withRemedy(item.reason) })) }),
  };
}

await runScript(() => run(process.argv.slice(2)), { usage: USAGE, refusals: [KnowledgeError] });
