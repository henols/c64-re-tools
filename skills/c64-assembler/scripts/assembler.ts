// The c64-assembler script: assembles project source with ACME, which it runs
// itself, and writes the program into the project.

import { formatC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { readProjectTree, writeReported } from "#src/host-client/transfer.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { requireProgram, type ProgramImage } from "#src/knowledge/program.ts";
import { assemble } from "#src/native/acme.ts";
import { localToolContext } from "#src/native/local.ts";
import type { AcmeParams } from "#src/native/types.ts";
import { OPTIONS, runScript, UsageError } from "#src/script.ts";
import { compareBuild } from "./lib/compare.ts";

function parseDefine(text: string): [string, number | boolean] {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/.exec(text);
  if (match === null) throw new UsageError(`--define needs NAME=VALUE, not ${text}`);
  const value = match[2]!;
  if (value === "true" || value === "false") return [match[1]!, value === "true"];
  if (/^\$[0-9a-fA-F]+$/.test(value)) return [match[1]!, Number.parseInt(value.slice(1), 16)];
  if (/^-?\d+$/.test(value)) return [match[1]!, Number(value)];
  throw new UsageError(`--define ${match[1]} needs an integer or true/false, not ${value}`);
}

await runScript({
  name: "assembler",
  summary: "Assembles project source with ACME and writes the program into the project.",
  names: knowledgeNames,
  commands: [
    {
      name: "build",
      summary: "Assembles the source and writes the program. result is PASS when it assembles (and with --compare, when it is the program of the knowledge), else FAIL with the diagnostics or the differences.",
      subjects: [
        { name: "<source-root>", help: "the folder in the project to assemble from: all of it is sent" },
        { name: "<entry>", help: "the main source file, relative to the source root" },
      ],
      options: {
        out: { ...OPTIONS.out, value: "<file.prg>", help: "where to write the program, relative to the project folder", required: true },
        include: { kind: "text", value: "<dir>", multiple: true, help: "an include folder, relative to the source root" },
        define: { kind: "text", value: "NAME=VALUE", multiple: true, help: "an assembler symbol: an integer ($hex allowed) or true/false" },
        "set-pc": { kind: "address", value: "<address>", help: "the start address when the source sets none, for example '$0801'" },
        compare: { kind: "flag", help: "check the program byte by byte against the program in the knowledge, each segment" },
        space: { ...OPTIONS.space, help: "with --compare: the knowledge space of the program: c64 (the default), drive8, or bank0 to bank255" },
        plain: { kind: "flag", help: "write the bytes only, without the 2-byte load address of a PRG" },
        "all-symbols": { kind: "flag", help: "list also the constants that the source does not use" },
      },
      notes: "Symbol values are $ and at least four hex digits. Put the program into the knowledge with knowledge.ts image of the c64-knowledge skill before --compare.",
      run: async (call) => {
        const [sourceRoot, entry] = [call.subject(0), call.subject(1)];
        const out = call.string("out")!;
        // Read the program before ACME runs, so a project without it stops at once.
        let program: ProgramImage | undefined;
        if (call.flag("compare")) {
          const db = openForRead();
          try {
            program = requireProgram(db, call.space);
          } finally {
            db?.close();
          }
        }
        const setPc = call.address("set-pc");
        const tree = readProjectTree(sourceRoot);
        if (!tree.files.some((file) => file.path === entry)) throw new Refusal("not-found", `${entry} is not a file in ${sourceRoot}. Give the main source file relative to the source root.`);
        const params: AcmeParams = { files: tree.files, entrySource: entry, includeDirs: call.strings("include"), defines: Object.fromEntries(call.strings("define").map(parseDefine)), ...(setPc === undefined ? {} : { setPc }) };

        const { result, attachments } = await assemble(params, tree.contents, localToolContext());
        if (!result.assembled) return { result: "FAIL", assembled: false, diagnostics: result.diagnostics };
        const plain = call.flag("plain");
        const written = writeReported(out, plain ? attachments![0]!.subarray(2) : attachments![0]!, { what: "--out" });
        const range = result.loadRange!;
        const compared = program === undefined ? undefined : compareBuild(attachments![0]!, program);
        // An include file of platform names gives many constants that the program does not use.
        const all = call.flag("all-symbols");
        const listed = result.symbols!.filter((symbol) => all || symbol.kind === "address" || symbol.used);
        return {
          // A build that differs from its reference is a failed check.
          result: compared !== undefined && !compared.identical ? "FAIL" : "PASS",
          assembled: true,
          ...written,
          ...(plain ? { plain: true } : {}),
          loadRange: { start: formatC64Address(range.start), end: formatC64Address(range.end), bytes: range.bytes },
          symbols: listed.map((symbol) =>
            symbol.kind === "address"
              ? { name: symbol.name, kind: "address", address: formatC64Address(symbol.address), used: symbol.used }
              : { name: symbol.name, kind: "constant", value: `$${symbol.value.toString(16).padStart(4, "0")}`, used: symbol.used },
          ),
          ...(all ? {} : { unusedConstants: result.symbols!.length - listed.length }),
          diagnostics: result.diagnostics,
          ...(compared === undefined ? {} : { compare: compared }),
        };
      },
    },
  ],
});
