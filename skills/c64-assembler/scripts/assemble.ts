// The c64-assembler script: assembles project source with ACME, which it runs
// itself, and writes the program into the project.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address, SPACE_PATTERN } from "#src/c64.ts";
import { readProjectTree } from "#src/host-client/transfer.ts";
import { assemble } from "#src/native/acme.ts";
import { localToolContext } from "#src/native/local.ts";
import type { AcmeParams } from "#src/native/types.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runBody, UsageError } from "#src/script.ts";
import { compareBuild } from "./lib/compare.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { requireProgram, type ProgramImage } from "#src/knowledge/program.ts";
import { DEFAULT_SPACE } from "#src/knowledge/schema.ts";

const USAGE = `assemble.ts --source-root <dir> --entry <file> --out <file.prg> [options]

  --source-root <dir>      folder in the project to assemble from; all of it is sent
  --entry <file>           the main source file, relative to the source root
  --out <file.prg>         where to write the program, relative to the project
  --include <dir>          include directory relative to the source root (repeatable)
  --define NAME=VALUE      assembler symbol: an integer ($hex allowed) or true/false (repeatable)
  --set-pc <address>       start address when the source sets none, for example '$0801'
  --compare                check the program byte by byte against the program in the
                           knowledge, each segment; put it in with knowledge.ts
                           image of the c64-knowledge skill
  --space <space>          with --compare: the knowledge space of the program, c64 (the
                           default), drive8, or bank0 to bank255
  --plain                  write the bytes only, without the 2-byte load address of a PRG
  --all-symbols            list also the constants that the source does not use

The result is one JSON object. Addresses and symbol values are $ and at least four hex digits.`;

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
      compare: { type: "boolean" },
      space: { type: "string" },
      plain: { type: "boolean" },
      "all-symbols": { type: "boolean" },
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
    throw new UsageError(`--out must be a path relative to the project folder that stays inside it, not ${out}`);
  }
  if (values.space !== undefined && !values.compare) throw new UsageError("--space works only with --compare");
  const space = values.space ?? DEFAULT_SPACE;
  if (!SPACE_PATTERN.test(space)) throw new UsageError("--space must be c64, drive8, or bank0 to bank255");
  // Read the program before ACME runs, so a project without it stops at once.
  let program: ProgramImage | undefined;
  if (values.compare) {
    const db = openForRead();
    try {
      program = requireProgram(db, space);
    } finally {
      db?.close();
    }
  }
  const defines = Object.fromEntries((values.define ?? []).map(parseDefine));
  let setPc: number | undefined;
  if (values["set-pc"] !== undefined) {
    try {
      setPc = parseC64Address(values["set-pc"]);
    } catch {
      throw new UsageError(`--set-pc must be $ followed by four hex digits, not ${values["set-pc"]}`);
    }
  }
  const tree = readProjectTree(sourceRoot);
  if (!tree.files.some((file) => file.path === entry)) throw new UsageError(`--entry ${entry} is not a file in ${sourceRoot}`);
  const params: AcmeParams = { files: tree.files, entrySource: entry, includeDirs: values.include ?? [], defines, ...(setPc === undefined ? {} : { setPc }) };

  const { result, attachments } = await assemble(params, tree.contents, localToolContext());
  if (!result.assembled) return { output: { assembled: false, diagnostics: result.diagnostics }, failed: true };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, values.plain ? attachments![0]!.subarray(2) : attachments![0]!);
  const range = result.loadRange!;
  const compared = program === undefined ? undefined : compareBuild(attachments![0]!, program);
  // An include file of platform names gives many constants that the program does not use.
  const listed = result.symbols!.filter((symbol) => values["all-symbols"] || symbol.kind === "address" || symbol.used);
  return {
    output: {
      assembled: true,
      output: out,
      ...(values.plain ? { plain: true } : {}),
      loadRange: { start: formatC64Address(range.start), end: formatC64Address(range.end), bytes: range.bytes },
      symbols: listed.map((symbol) =>
        symbol.kind === "address"
          ? { name: symbol.name, kind: "address", address: formatC64Address(symbol.address), used: symbol.used }
          : { name: symbol.name, kind: "constant", value: `$${symbol.value.toString(16).padStart(4, "0")}`, used: symbol.used },
      ),
      ...(values["all-symbols"] ? {} : { unusedConstants: result.symbols!.length - listed.length }),
      diagnostics: result.diagnostics,
      ...(compared === undefined ? {} : { compare: compared }),
    },
    // A build that differs from its reference is a failed check.
    failed: compared !== undefined && !compared.identical,
  };
}

await runBody(
  async (argv) => {
    const { output, failed } = await run(argv);
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
