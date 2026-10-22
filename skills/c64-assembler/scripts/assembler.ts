// The c64-assembler script: assembles project source with ACME, which it runs
// itself, and writes the program into the project.

import { BUILD_DIRECTORY, type BuildKind, buildName, CONFIG_FILE, configValues, symbolsPath } from "#src/build-name.ts";
import { formatAddress } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { readSourceTree, writeReported } from "#src/host-client/transfer.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { releaseImage, requireProgram } from "#src/knowledge/program.ts";
import { listSwitches, releaseLabeled } from "#src/knowledge/read.ts";
import { LEFTOVERS_SWITCH, RELEASE_DEFINE, START_SCREEN_SWITCH, type Space } from "#src/knowledge/schema.ts";
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

/** The default of each switch of a generated source: the knowledge gives them, the start screen is in and the leftovers are out. */
function switchDefaults(space: Space): Map<string, number> {
  const db = openForRead();
  try {
    return new Map([[START_SCREEN_SWITCH, 1], [LEFTOVERS_SWITCH, 0], ...listSwitches(db, undefined, space).map((row) => [row.name, row.default] as const)]);
  } finally {
    db?.close();
  }
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
        out: { ...OPTIONS.out, output: "file", value: "<file.prg>", help: "where to write the program, relative to the project folder. The default is build/<build>.prg: release_<label> with --release, else clean or custom_<switches> from config.asm, with _<entry> for an entry other than main.asm" },
        include: { kind: "text", value: "<folder>", multiple: true, help: "an include folder: a path relative to the source root, inside the project folder" },
        define: { kind: "text", value: "NAME=VALUE", multiple: true, help: "an assembler symbol: an integer ($hex allowed) or true/false" },
        "set-pc": { kind: "address", value: "<address>", help: "the start address when the source sets none, for example '$0801'" },
        release: { kind: "text", value: "<label>", help: `build a release of the knowledge: defines ${RELEASE_DEFINE}<label>=1, so each switch has the value of that release. With --compare, the reference is the file of the release` },
        compare: { kind: "flag", help: "check the program byte by byte against the program in the knowledge (or the file of --release), each segment" },
        space: { kind: "space", value: "<space>", help: "with --compare or --release: the knowledge space of the program: c64 (the default), drive8, loading, or bank0 to bank255" },
        plain: { kind: "flag", help: "write the bytes only, without the 2-byte load address of a PRG" },
        "all-symbols": { kind: "flag", help: "list also the constants that the source does not use" },
        "max-listed": { ...OPTIONS["max-listed"], help: "list at most n symbols (default 50). The count is always given" },
      },
      notes: "Symbol values are $ and at least four hex digits. Before --compare, put the program bytes into the project knowledge. Without --release, the build has the switch values of config.asm. With the defaults, this is the clean program, which is not the bytes of a release when a switch has a default that the base release does not have. Set a switch in config.asm, not with --define: ACME stops with Symbol already defined.",
      run: async (call) => {
        const [sourceRoot, entry] = [call.subject(0), call.subject(1)];
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
              if (call.flag("compare")) program = releaseImage(db, label, call.space);
            }
          } finally {
            db?.close();
          }
        }
        const setPc = call.address("set-pc");
        const { contents, ...tree } = readSourceTree(sourceRoot, call.strings("include"));
        if (!tree.files.some((file) => file.path === (tree.sourceDir === "" ? entry : `${tree.sourceDir}/${entry}`))) throw new Refusal("not-found", `${entry} is not a file in ${sourceRoot}. Give the main source file relative to the source root.`);
        // The name of the build tells what it is: the release, or the switch values of config.asm.
        const config = tree.files.findIndex((file) => file.path === (tree.sourceDir === "" ? CONFIG_FILE : `${tree.sourceDir}/${CONFIG_FILE}`));
        const kind: BuildKind | undefined = label !== undefined ? { release: label } : config < 0 ? undefined : { values: configValues(contents[config]!.toString("utf8")), defaults: switchDefaults(call.space) };
        const plain = call.flag("plain");
        const out = call.string("out") ?? `${BUILD_DIRECTORY}/${buildName(entry, kind)}.${plain ? "bin" : "prg"}`;
        const params: AcmeParams = { ...tree, entrySource: entry, defines: { ...releaseDefine, ...Object.fromEntries(call.strings("define").map(parseDefine)) }, ...(setPc === undefined ? {} : { setPc }) };

        const { result, attachments } = await assemble(params, contents, localToolContext());
        if (!result.assembled) return reply({ result: "FAIL", assembled: false, diagnostics: result.diagnostics }, { hint: "The source has errors, and no program was written. Correct the source at the file and the line of each diagnostic. Then run build again." });
        const written = writeReported(out, plain ? attachments![0]!.subarray(2) : attachments![0]!, { what: "--out" });
        const range = result.loadRange!;
        const compared = program === undefined ? undefined : compareBuild(attachments![0]!, program);
        // An include file of platform names gives many constants that the program does not use.
        const all = call.flag("all-symbols");
        const shown = result.symbols!.filter((symbol) => all || symbol.kind === "address" || symbol.used);
        const symbols = listedItems(shown, call.count("max-listed")!, showSymbol, `a larger --max-listed, or read ${symbolsPath(out)}`);
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
          loadRange: { start: formatAddress(range.start), end: formatAddress(range.end), bytes: range.bytes },
          symbols,
          // The symbols of the program for a test run, in symbols/ next to it.
          symbolsFile: writeReported(symbolsPath(out), symbolsFileText(shown), { what: "--out" }),
          ...(all ? {} : { unusedConstants: result.symbols!.length - shown.length }),
          diagnostics: result.diagnostics,
          ...(compared === undefined ? {} : { compare: compared }),
        }, hints.length === 0 ? {} : { hint: hints.join(" ") });
      },
    },
  ],
});
