// The c64-assembler script: assembles project source with ACME, which it runs
// itself, and writes the program into the project.

import { posix } from "node:path";

import { formatC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { readImage } from "#src/host-client/image.ts";
import { readProjectTree, writeReported } from "#src/host-client/transfer.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { requireProgram } from "#src/knowledge/program.ts";
import { releaseLabeled } from "#src/knowledge/read.ts";
import { RELEASE_DEFINE } from "#src/knowledge/schema.ts";
import { assemble, showSymbol, symbolsFileText } from "#src/native/acme.ts";
import { localToolContext } from "#src/native/local.ts";
import type { AcmeParams, AssembledSymbol } from "#src/native/types.ts";
import { listed as listedItems, OPTIONS, reply, runScript, UsageError } from "#src/script.ts";
import { compareBuild, type Reference } from "#src/compare.ts";

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
      summary: "Assembles the source and writes the program. result is PASS when it assembles (and with --compare, when it is the program of the knowledge or of the --release), else FAIL with the diagnostics or the differences.",
      subjects: [
        { name: "<source-root>", help: "the folder in the project that holds all the source files of the program" },
        { name: "<entry>", help: "the main source file, relative to the source root" },
      ],
      options: {
        out: { ...OPTIONS.out, output: "file", value: "<file.prg>", help: "where to write the program, relative to the project folder", required: true },
        include: { kind: "text", value: "<dir>", multiple: true, help: "an include folder, relative to the source root" },
        define: { kind: "text", value: "NAME=VALUE", multiple: true, help: "an assembler symbol: an integer ($hex allowed) or true/false" },
        "set-pc": { kind: "address", value: "<address>", help: "the start address when the source sets none, for example '$0801'" },
        release: { kind: "text", value: "<label>", help: `build a release of the knowledge: defines ${RELEASE_DEFINE}<label>=1, so each switch has the value of that release. With --compare, the reference is the file of the release` },
        compare: { kind: "flag", help: "check the program byte by byte against the program in the knowledge (or the file of --release), each segment" },
        space: { kind: "space", value: "<space>", help: "with --compare or --release: the knowledge space of the program: c64 (the default), drive8, or bank0 to bank255" },
        plain: { kind: "flag", help: "write the bytes only, without the 2-byte load address of a PRG" },
        "all-symbols": { kind: "flag", help: "list also the constants that the source does not use" },
        "max-listed": { ...OPTIONS["max-listed"], help: "list at most n symbols (default 50). The count is always given" },
        "out-symbols": { kind: "path", output: "file", value: "<file.json>", help: "write the listed symbols to this project file as {\"symbols\": [...]}: the names of the rebuild for a test run. Without --all-symbols, the file does not have the constants that the source does not use" },
      },
      notes: "Symbol values are $ and at least four hex digits. Before --compare, put the program bytes into the project knowledge. Without --release, the build has the switch values of config.asm. With the defaults, this is the clean program, which is not the bytes of a release when a switch has a default that the base release does not have. Set a switch in config.asm, not with --define: ACME stops with Symbol already defined.",
      run: async (call) => {
        const [sourceRoot, entry] = [call.subject(0), call.subject(1)];
        const out = call.string("out")!;
        // Read the reference before ACME runs, so a project without it stops at once.
        let program: Reference | undefined;
        const label = call.string("release");
        if (call.string("space") !== undefined && !call.flag("compare") && label === undefined) throw new UsageError("--space works only with --compare or --release: it names the knowledge space of the program");
        let releaseDefine: Record<string, number> = {};
        if (call.flag("compare") || label !== undefined) {
          const db = openForRead();
          try {
            if (label === undefined) program = requireProgram(db, call.space);
            else {
              const release = releaseLabeled(db, label, call.space);
              if (release === undefined) throw new Refusal("not-found", `There is no release ${label} in the knowledge. Record the release in the project knowledge first, or give the label of a recorded release.`);
              releaseDefine = { [`${RELEASE_DEFINE}${label}`]: 1 };
              if (call.flag("compare")) program = release.base ? requireProgram(db, call.space) : readImage(release.file);
            }
          } finally {
            db?.close();
          }
        }
        const setPc = call.address("set-pc");
        const tree = readProjectTree(sourceRoot);
        if (!tree.files.some((file) => file.path === entry)) throw new Refusal("not-found", `${entry} is not a file in ${sourceRoot}. Give the main source file relative to the source root.`);
        // ACME sees only the files of the source root: an include folder holds some of them. A path out of the root is refused later.
        for (const folder of call.strings("include")) {
          const inside = posix.normalize(folder.replaceAll("\\", "/")).replace(/\/+$/, "");
          if (inside === "." || inside === ".." || inside.startsWith("../") || posix.isAbsolute(inside)) continue;
          if (!tree.files.some((file) => file.path.startsWith(`${inside}/`))) {
            throw new Refusal("not-found", `There is no include folder ${folder} with files in the source root ${sourceRoot}. Give --include a folder relative to the source root.`);
          }
        }
        const params: AcmeParams = { files: tree.files, entrySource: entry, includeDirs: call.strings("include"), defines: { ...releaseDefine, ...Object.fromEntries(call.strings("define").map(parseDefine)) }, ...(setPc === undefined ? {} : { setPc }) };

        const { result, attachments } = await assemble(params, tree.contents, localToolContext());
        if (!result.assembled) return reply({ result: "FAIL", assembled: false, diagnostics: result.diagnostics }, { hint: "The source has errors, and no program was written. Correct the source at the file and the line of each diagnostic. Then run build again." });
        const plain = call.flag("plain");
        const written = writeReported(out, plain ? attachments![0]!.subarray(2) : attachments![0]!, { what: "--out" });
        const range = result.loadRange!;
        const compared = program === undefined ? undefined : compareBuild(attachments![0]!, program);
        // An include file of platform names gives many constants that the program does not use.
        const all = call.flag("all-symbols");
        const shown = result.symbols!.filter((symbol) => all || symbol.kind === "address" || symbol.used);
        const symbolsPath = call.string("out-symbols");
        const symbols = listedItems(shown, call.count("max-listed")!, showSymbol, "a larger --max-listed, or --out-symbols <file.json> for the whole list");
        // A build that differs from its reference is a failed check.
        const different = compared !== undefined && !compared.identical;
        const hints = [
          ...(different ? ["The program is not identical to the reference program. Read compare.segments: each segment that is different gives its first difference."] : []),
          ...(different && label === undefined ? ["Without --release, a source with switches builds with the values of config.asm, and that program can differ from the base release. To check a release, give --release <label> with --compare."] : []),
          ...(symbols.rest === undefined ? [] : [`symbols is cut. To get all symbols, give ${symbols.rest}.`]),
        ];
        return reply({
          result: different ? "FAIL" : "PASS",
          assembled: true,
          ...written,
          ...(plain ? { plain: true } : {}),
          loadRange: { start: formatC64Address(range.start), end: formatC64Address(range.end), bytes: range.bytes },
          symbols,
          ...(symbolsPath === undefined ? {} : { symbolsFile: writeReported(symbolsPath, symbolsFileText(shown), { what: "--out-symbols" }) }),
          ...(all ? {} : { unusedConstants: result.symbols!.length - shown.length }),
          diagnostics: result.diagnostics,
          ...(compared === undefined ? {} : { compare: compared }),
        }, hints.length === 0 ? {} : { hint: hints.join(" ") });
      },
    },
  ],
});
