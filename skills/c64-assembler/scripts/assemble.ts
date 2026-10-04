// The c64-assembler script: assembles project source with ACME through the
// Host Runtime and writes the program into the project.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "../../../src/c64.ts";
import { assemble, WireFailure } from "../../../src/host-client/tools.ts";
import { resolveProjectPath } from "../../../src/project.ts";

const USAGE = `assemble.ts --source-root <dir> --entry <file> --out <file.prg> [options]

  --source-root <dir>      project directory to assemble from; all of it is sent
  --entry <file>           the main source file, relative to the source root
  --out <file.prg>         where to write the program, relative to the project
  --include <dir>          include directory relative to the source root (repeatable)
  --define NAME=VALUE      assembler symbol: an integer ($hex allowed) or true/false (repeatable)
  --set-pc <address>       start address when the source sets none, for example '$0801'

The result is one JSON object. Addresses are $ and four hex digits.`;

class UsageError extends Error {}

function parseDefine(text: string): [string, number | boolean] {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/.exec(text);
  if (match === null) throw new UsageError(`--define needs NAME=VALUE, not ${text}`);
  const value = match[2]!;
  if (value === "true" || value === "false") return [match[1]!, value === "true"];
  if (/^\$[0-9a-fA-F]+$/.test(value)) return [match[1]!, Number.parseInt(value.slice(1), 16)];
  if (/^-?\d+$/.test(value)) return [match[1]!, Number(value)];
  throw new UsageError(`--define ${match[1]} needs an integer or true/false, not ${value}`);
}

async function run(argv: string[]): Promise<{ output: unknown; failed: boolean }> {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      "source-root": { type: "string" },
      entry: { type: "string" },
      out: { type: "string" },
      include: { type: "string", multiple: true },
      define: { type: "string", multiple: true },
      "set-pc": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  const sourceRoot = values["source-root"];
  const entry = values.entry;
  const out = values.out;
  if (sourceRoot === undefined || entry === undefined || out === undefined) throw new UsageError("--source-root, --entry and --out are necessary");
  let outPath: string;
  try {
    outPath = resolveProjectPath(out);
  } catch {
    throw new UsageError(`--out must be a path relative to the project directory that stays inside it, not ${out}`);
  }
  const request: Parameters<typeof assemble>[0] = {
    sourceRoot,
    entrySource: entry,
    includeDirs: values.include ?? [],
    defines: Object.fromEntries((values.define ?? []).map(parseDefine)),
  };
  if (values["set-pc"] !== undefined) {
    try {
      request.setPc = parseC64Address(values["set-pc"]);
    } catch {
      throw new UsageError(`--set-pc must be $ followed by four hex digits, not ${values["set-pc"]}`);
    }
  }

  const result = await assemble(request);
  if (!result.assembled) return { output: { assembled: false, diagnostics: result.diagnostics }, failed: true };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.program!);
  const range = result.loadRange!;
  return {
    output: {
      assembled: true,
      output: out,
      loadRange: { start: formatC64Address(range.start), end: formatC64Address(range.end), bytes: range.bytes },
      symbols: result.symbols!.map((symbol) =>
        symbol.kind === "address"
          ? { name: symbol.name, kind: "address", address: formatC64Address(symbol.value), used: symbol.used }
          : { name: symbol.name, kind: "constant", value: symbol.value, used: symbol.used },
      ),
      diagnostics: result.diagnostics,
    },
    failed: false,
  };
}

try {
  const { output, failed } = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (failed) process.exitCode = 1;
} catch (error) {
  if (error instanceof WireFailure) {
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
