// The spectrum-assembler script: assembles project source with sjasmplus,
// which it runs itself, and writes the program into the project.

import { posix } from "node:path";

import { formatAddress } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { readProjectTree, writeReported } from "#src/host-client/transfer.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { knowledgeNames, projectMainSpace } from "#src/knowledge/names.ts";
import { requireProgram } from "#src/knowledge/program.ts";
import { machineOf } from "#src/knowledge/project-machine.ts";
import { localToolContext } from "#src/native/local.ts";
import { assemble, type SjasmplusParams } from "#src/native/sjasmplus.ts";
import { showSymbol, symbolsFileText } from "#src/native/acme.ts";
import { listed, OPTIONS, reply, runScript, UsageError } from "#src/script.ts";
import { compareMemory } from "./lib/compare.ts";

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
  summary: "Assembles project source with sjasmplus and writes the ZX Spectrum program into the project.",
  names: knowledgeNames,
  mainSpace: projectMainSpace,
  commands: [
    {
      name: "build",
      summary:
        "Assembles the source and writes the bytes from the first to the last address that it fills. result is PASS when it assembles (and with --compare, when each byte that it fills is the byte of the program in the knowledge), else FAIL with the diagnostics or the differences.",
      subjects: [
        { name: "<source-root>", help: "the folder in the project that holds all the source files of the program" },
        { name: "<entry>", help: "the main source file, relative to the source root. It sets its addresses with ORG and has no DEVICE" },
      ],
      options: {
        out: { ...OPTIONS.out, output: "file", value: "<file.bin>", help: "where to write the bytes, relative to the project folder", required: true },
        include: { kind: "text", value: "<dir>", multiple: true, help: "an include folder, relative to the source root" },
        define: { kind: "text", value: "NAME=VALUE", multiple: true, help: "an assembler symbol: an integer ($hex allowed) or true/false" },
        model: { kind: "choice", choices: ["48k", "128k"], value: "<model>", help: "the device of the build. Default: the model of the project machine, else 48k" },
        compare: { kind: "flag", help: "check the bytes against the program in the knowledge, each segment" },
        "max-listed": { ...OPTIONS["max-listed"], help: "list at most n symbols (default 50). The count is always given" },
        "out-symbols": { kind: "path", output: "file", value: "<file.json>", help: 'write the symbols to this project file as {"symbols": [...]}: the symbols of the rebuild for a test run' },
      },
      notes: "Before --compare, put the program bytes into the project knowledge.",
      run: async (call) => {
        const [sourceRoot, entry] = [call.subject(0), call.subject(1)];
        const db = openForRead();
        let program: ReturnType<typeof requireProgram> | undefined;
        let projectModel: "48k" | "128k" = "48k";
        try {
          projectModel = machineOf(db).id === "spectrum128" ? "128k" : "48k";
          // Read the reference before sjasmplus runs, so a project without it stops at once.
          if (call.flag("compare")) program = requireProgram(db, machineOf(db).spaces.main);
        } finally {
          db?.close();
        }
        const tree = readProjectTree(sourceRoot);
        if (!tree.files.some((file) => file.path === entry)) throw new Refusal("not-found", `${entry} is not a file in ${sourceRoot}. Give the main source file relative to the source root.`);
        for (const folder of call.strings("include")) {
          const inside = posix.normalize(folder.replaceAll("\\", "/")).replace(/\/+$/, "");
          if (inside === "." || inside === ".." || inside.startsWith("../") || posix.isAbsolute(inside)) continue;
          if (!tree.files.some((file) => file.path.startsWith(`${inside}/`))) {
            throw new Refusal("not-found", `There is no include folder ${folder} with files in the source root ${sourceRoot}. Give --include a folder relative to the source root.`);
          }
        }
        const params: SjasmplusParams = {
          files: tree.files,
          entrySource: entry,
          includeDirs: call.strings("include"),
          defines: Object.fromEntries(call.strings("define").map(parseDefine)),
          model: (call.string("model") as "48k" | "128k" | undefined) ?? projectModel,
        };
        const { result, attachments } = await assemble(params, tree.contents, localToolContext());
        if (!result.assembled) return reply({ result: "FAIL", assembled: false, diagnostics: result.diagnostics }, { hint: "The source has errors, and no bytes were written. Correct the source at the file and the line of each diagnostic. Then run build again." });
        const memory = attachments![0]!;
        const segments = result.segments!;
        const [start, end] = [segments[0]!.start, segments.at(-1)!.end];
        const written = writeReported(call.string("out")!, memory.subarray(start, end + 1), { what: "--out" });
        const compared = program === undefined ? undefined : compareMemory(memory, segments, program);
        const symbolsPath = call.string("out-symbols");
        const symbols = listed(result.symbols!, call.count("max-listed")!, showSymbol, "a larger --max-listed, or --out-symbols <file.json> for the whole list");
        const hints = [
          ...(compared !== undefined && !compared.matches ? ["A byte of the build is not the byte of the program in the knowledge. Read compare.segments: each segment that is different gives its first difference."] : []),
          ...(compared !== undefined && compared.matches && !compared.identical ? ["Each byte that the build fills is the byte of the knowledge. The build does not fill all bytes of the program: compare.segments gives the uncovered bytes of each segment."] : []),
          ...(symbols.rest === undefined ? [] : [`symbols is cut. To get all symbols, give ${symbols.rest}.`]),
        ];
        return reply({
          result: compared !== undefined && !compared.matches ? "FAIL" : "PASS",
          assembled: true,
          model: params.model,
          ...written,
          range: { start: formatAddress(start), end: formatAddress(end) },
          segments: segments.map((segment) => ({ start: formatAddress(segment.start), end: formatAddress(segment.end) })),
          bytes: result.bytes,
          symbols,
          ...(symbolsPath === undefined ? {} : { symbolsFile: writeReported(symbolsPath, symbolsFileText(result.symbols!), { what: "--out-symbols" }) }),
          diagnostics: result.diagnostics,
          ...(compared === undefined ? {} : { compare: compared }),
        }, hints.length === 0 ? {} : { hint: hints.join(" ") });
      },
    },
  ],
});
