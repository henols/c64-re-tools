// The c64-static-analysis script: analyzes a project program with Ghidra
// through the Host Runtime, seeded from current knowledge, and imports the
// structural findings into .c64-re-tools/knowledge.db.

import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "../../../src/c64.ts";
import { analyzeWithGhidra, WireFailure } from "../../../src/host-client/tools.ts";
import { KnowledgeError, openForRead, openForWrite } from "../../../src/knowledge/database.ts";
import { importFindings, type ImportConflict } from "../../../src/knowledge/import.ts";
import { currentRevision } from "../../../src/knowledge/read.ts";
import { ghidraFindings, seedsFromKnowledge } from "./findings.ts";

const USAGE = `analyze.ts <image> [options]

  <image>                 a PRG file, relative to the project directory
  --flat64k               the image is 64 KiB of memory from $0000, not a PRG
  --entry <address>       an entry point, for example '$080d' (repeatable)
  --decompile <address>   a routine to decompile, at most 32 (repeatable)

Routine symbols in knowledge are entry points too. The result is one JSON
object. Addresses are $ and four hex digits.`;

const MAX_LISTED_FUNCTIONS = 200;

class UsageError extends Error {}

function addresses(values: string[] | undefined, option: string): number[] {
  return (values ?? []).map((value) => {
    try {
      return parseC64Address(value);
    } catch {
      throw new UsageError(`${option} must be $ followed by four hex digits, not ${value}`);
    }
  });
}

function showConflict(conflict: ImportConflict): Record<string, unknown> {
  if (conflict.category === "symbol") {
    return {
      at: formatC64Address(conflict.address),
      knowledge: { name: conflict.current.name, kind: conflict.current.kind, origin: conflict.current.origin, at: formatC64Address(conflict.current.address) },
      ghidra: conflict.finding,
      problem: conflict.reason === "kind" ? "code and data disagree" : "another address has this name",
    };
  }
  return {
    range: { start: formatC64Address(conflict.start), end: formatC64Address(conflict.end) },
    knowledge: conflict.current,
    ghidra: conflict.finding,
    problem: "code and data disagree",
  };
}

async function run(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: { flat64k: { type: "boolean" }, entry: { type: "string", multiple: true }, decompile: { type: "string", multiple: true }, help: { type: "boolean" } },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one image");
  const image = positionals[0]!;
  const entries = addresses(values.entry, "--entry");
  const decompile = addresses(values.decompile, "--decompile");
  if (decompile.length > 32) throw new UsageError("--decompile takes at most 32 routines");

  const reader = openForRead();
  const revision = currentRevision(reader);
  const seeds = seedsFromKnowledge(reader, entries);
  reader?.close();

  const result = await analyzeWithGhidra({ image, imageKind: values.flat64k ? "flat64k" : "prg", ...seeds, decompile });

  const db = openForWrite();
  let imported;
  try {
    imported = importFindings(db, ghidraFindings(result), { expectedRevision: revision, description: `Ghidra analysis of ${image}` });
  } finally {
    db.close();
  }
  return {
    coverage: result.coverage.map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
    revision: imported.revision,
    symbols: imported.symbols,
    regions: imported.regions,
    references: imported.references,
    conflicts: imported.conflicts.map(showConflict),
    functions: result.functions.slice(0, MAX_LISTED_FUNCTIONS).map((fn) => ({ entry: formatC64Address(fn.entry), name: fn.name })),
    ...(result.functions.length > MAX_LISTED_FUNCTIONS ? { moreFunctions: result.functions.length - MAX_LISTED_FUNCTIONS } : {}),
    decompilations: result.decompilations.map((item) => ({ entry: formatC64Address(item.entry), text: item.text, ...(item.truncated ? { truncated: true } : {}) })),
  };
}

try {
  process.stdout.write(`${JSON.stringify(await run(process.argv.slice(2)))}\n`);
} catch (error) {
  if (error instanceof WireFailure || error instanceof KnowledgeError) {
    process.stdout.write(`${JSON.stringify({ error: { code: error.code, message: error.message } })}\n`);
    process.exitCode = 1;
  } else if (error instanceof UsageError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    const message = (error as Error).message;
    process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: message === "" ? USAGE : `${message}\n\n${USAGE}` } })}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
