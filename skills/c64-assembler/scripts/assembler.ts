// The c64-assembler script: assembles project source with ACME, which it runs
// itself, and writes the program into the project. With --switch, a generated
// source gets other switch values: the script changes them in its copy of
// config.asm, so the file stays as it is, and the build name follows from the
// values. A generated source with loader.asm then also gets its loader
// program with the same values: the build of loader.asm in the plain form,
// and in the packed form the pack of the build of main.asm with the build of
// loader.asm, the copier, as generate packs it. No check of that loader runs.
// When the knowledge or the builds do not permit the pack, the build writes
// the program of main.asm and no loader program, and tells why.

import { posix } from "node:path";

import { BUILD_DIRECTORY, type BuildKind, buildName, CONFIG_FILE, configValues, COPIER_LINE, symbolsPath, withConfigValues } from "#src/build-name.ts";
import { type AddressRange, formatC64Address } from "#src/c64.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { readSourceTree, writeReported } from "#src/host-client/transfer.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { releaseImage, requireProgram } from "#src/knowledge/program.ts";
import { currentStartScreen, listSwitches, releaseLabeled } from "#src/knowledge/read.ts";
import { LEFTOVER_FOLDER, LEFTOVERS_SWITCH, RELEASE_DEFINE, START_SCREEN_SWITCH, type Space } from "#src/knowledge/schema.ts";
import { checkPackedBuilds, COPIER_SOURCE, leftoverRange, loaderSymbols, packedRanges, packLoader, type PackedLoader } from "#src/loader.ts";
import { assemble, showSymbol, symbolsFileText } from "#src/native/acme.ts";
import { EXOMIZER, findTool } from "#src/native/discover.ts";
import { localToolContext } from "#src/native/local.ts";
import type { AcmeParams, AssembledSymbol } from "#src/native/types.ts";
import { listed as listedItems, OPTIONS, reply, runScript, UsageError } from "#src/script.ts";
import { compareBuild, type LeftOutLeftover, type Reference } from "#src/compare.ts";

/** The loader of a generated source, which a build of main.asm with --switch also makes. */
const LOADER_FILE = "loader.asm";

function parseDefine(text: string): [string, number | boolean] {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/.exec(text);
  if (match === null) throw new UsageError(`--define needs NAME=VALUE, not ${text}`);
  const value = match[2]!;
  if (value === "true" || value === "false") return [match[1]!, value === "true"];
  if (/^\$[0-9a-fA-F]+$/.test(value)) return [match[1]!, Number.parseInt(value.slice(1), 16)];
  if (/^-?\d+$/.test(value)) return [match[1]!, Number(value)];
  throw new UsageError(`--define ${match[1]} needs an integer or true/false, not ${value}`);
}

/** The values of --switch, by name: each is 0 or 1, and each name comes once. */
function parseSwitches(texts: readonly string[]): Map<string, 0 | 1> {
  const values = new Map<string, 0 | 1>();
  for (const text of texts) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=([01])$/.exec(text);
    if (match === null) throw new UsageError(`--switch needs NAME=0 or NAME=1, not ${text}`);
    if (values.has(match[1]!)) throw new UsageError(`--switch gives ${match[1]} two times. Give each switch one time.`);
    values.set(match[1]!, match[2] === "1" ? 1 : 0);
  }
  return values;
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

/** What the packed form needs from the knowledge of the space: the loaded ranges. Refuses a start screen of a captured stage and a segment below $0400. */
function packedLoaded(leftovers: readonly AddressRange[], space: Space): AddressRange[] {
  const db = openForRead();
  try {
    return packedRanges(requireProgram(db, space).segments, leftovers, currentStartScreen(db, space)?.stage);
  } finally {
    db?.close();
  }
}

/** The message of a refusal of `work`, or undefined when it did not refuse: a refusal of the loader program does not stop the build of main.asm. */
function refusalOf(work: () => void): string | undefined {
  try {
    work();
    return undefined;
  } catch (error) {
    if (isRefusal(error)) return error.message;
    throw error;
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
        out: { ...OPTIONS.out, output: "file", value: "<file.prg>", help: "where to write the program, relative to the project folder. The default is build/<build>.prg: release_<label> with --release, else clean or custom_<switches> from the switch values, with _<entry> for an entry other than main.asm" },
        include: { kind: "text", value: "<folder>", multiple: true, help: "an include folder: a path relative to the source root, inside the project folder" },
        define: { kind: "text", value: "NAME=VALUE", multiple: true, help: "an assembler symbol: an integer ($hex allowed) or true/false. Not for a switch of config.asm: give --switch" },
        switch: { kind: "text", value: "NAME=VALUE", multiple: true, help: "a switch of config.asm with the value 0 or 1 for this build. config.asm stays as it is. With main.asm and a loader.asm, the build also writes the loader program with these values" },
        "set-pc": { kind: "address", value: "<address>", help: "the start address when the source sets none, for example '$0801'" },
        release: { kind: "text", value: "<label>", help: `build a release of the knowledge: defines ${RELEASE_DEFINE}<label>=1, so each switch has the value of that release. With --compare, the reference is the file of the release` },
        compare: { kind: "flag", help: "check the program byte by byte against the program in the knowledge (or the file of --release), each segment" },
        space: { kind: "space", value: "<space>", help: "with --compare or --release: the knowledge space of the program: c64 (the default), drive8, loading, or bank0 to bank255" },
        plain: { kind: "flag", help: "write the bytes only, without the 2-byte load address of a PRG" },
        "all-symbols": { kind: "flag", help: "list also the constants that the source does not use" },
        "max-listed": { ...OPTIONS["max-listed"], help: "list at most n symbols (default 50). The count is always given" },
      },
      notes:
        "Symbol values are $ and at least four hex digits. Before --compare, put the program bytes into the project knowledge. Without --release, the build has the switch values of config.asm and of --switch. With the defaults, this is the clean program, which is not the bytes of a release when a switch has a default that the base release does not have. The defaults leave out the leftovers (LEFTOVERS = 0): compare.segments gives each different leftover in leftovers. Give a switch with --switch, not with --define: ACME stops with Symbol already defined. The loader program of --switch is not checked: loader.verified is false.",
      run: async (call) => {
        const [sourceRoot, entry] = [call.subject(0), call.subject(1)];
        // Read the reference before ACME runs, so a project without it stops at once.
        let program: Reference | undefined;
        const label = call.string("release");
        const switches = parseSwitches(call.strings("switch"));
        if (call.string("space") !== undefined && !call.flag("compare") && label === undefined) throw new UsageError("--space works only with --compare or --release: it names the knowledge space of the program");
        if (switches.size > 0 && label !== undefined) throw new UsageError("--switch does not work with --release: a release build has the switch values of that release");
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
        const inSource = (name: string) => tree.files.findIndex((file) => file.path === (tree.sourceDir === "" ? name : `${tree.sourceDir}/${name}`));
        const textOf = (index: number) => contents[index]!.toString("utf8");
        if (inSource(entry) < 0) throw new Refusal("not-found", `${entry} is not a file in ${sourceRoot}. Give the main source file relative to the source root.`);
        const config = inSource(CONFIG_FILE);
        if (switches.size > 0) {
          // ACME refuses a define of a symbol that config.asm sets: the values go into the copy of config.asm that ACME gets.
          if (config < 0) throw new Refusal("invalid-input", `${sourceRoot} has no ${CONFIG_FILE}, so the source has no switches. Give --switch only for a generated source with switches.`);
          const known = configValues(textOf(config));
          const unknown = [...switches.keys()].filter((name) => !known.has(name));
          if (unknown.length > 0) throw new Refusal("invalid-input", `${unknown.join(", ")} ${unknown.length === 1 ? "is not a switch" : "are not switches"} of ${CONFIG_FILE}. Give a switch of ${CONFIG_FILE}: ${[...known.keys()].join(", ")}.`);
          const changed = Buffer.from(withConfigValues(textOf(config), switches), "utf8");
          contents[config] = changed;
          tree.files[config] = { ...tree.files[config]!, size: changed.length };
        }
        // The name of the build tells what it is: the release, or the switch values.
        const kind: BuildKind | undefined = label !== undefined ? { release: label } : config < 0 ? undefined : { values: configValues(textOf(config)), defaults: switchDefaults(call.space) };
        // The leftover files of a generated source, each with its range from its first line. A build with LEFTOVERS = 0 skips them; a release has them.
        const folder = posix.join(tree.sourceDir, LEFTOVER_FOLDER);
        const leftovers: LeftOutLeftover[] = tree.files.flatMap((file, index) => {
          const range = posix.dirname(file.path) === folder ? leftoverRange(textOf(index)) : undefined;
          return range === undefined ? [] : [{ ...range, file: `${LEFTOVER_FOLDER}/${posix.basename(file.path)}` }];
        });
        const leftOut = kind !== undefined && "values" in kind && kind.values.get(LEFTOVERS_SWITCH) === 0 ? leftovers : [];
        const plain = call.flag("plain");
        const out = call.string("out") ?? `${BUILD_DIRECTORY}/${buildName(entry, kind, textOf(inSource(entry)))}.${plain ? "bin" : "prg"}`;
        const params: AcmeParams = { ...tree, entrySource: entry, defines: { ...releaseDefine, ...Object.fromEntries(call.strings("define").map(parseDefine)) }, ...(setPc === undefined ? {} : { setPc }) };

        // With --switch, main.asm of a generated source with a loader also gives the loader program of these values.
        const loaderIndex = switches.size > 0 && entry === "main.asm" ? inSource(LOADER_FILE) : -1;
        let loaded: AddressRange[] | undefined;
        // Why the build writes no loader program.
        let noLoader: string | undefined;
        if (loaderIndex >= 0 && textOf(loaderIndex).split(/\r?\n/).includes(COPIER_LINE)) {
          // The packed form: the loaded ranges are the segments of the program without the leftover files of the source.
          noLoader = refusalOf(() => {
            loaded = packedLoaded(leftovers, call.space);
          });
          // The toolkit never installs a tool: without Exomizer the build refuses by name before ACME runs.
          if (noLoader === undefined) findTool(EXOMIZER);
        }

        const { result, attachments } = await assemble(params, contents, localToolContext());
        if (!result.assembled) return reply({ result: "FAIL", assembled: false, diagnostics: result.diagnostics }, { hint: "The source has errors, and no program was written. Correct the source at the file and the line of each diagnostic. Then run build again." });
        const built = attachments![0]!;
        // An include file of platform names gives many constants that the program does not use.
        const all = call.flag("all-symbols");
        const shownOf = (symbols: readonly AssembledSymbol[]) => symbols.filter((symbol) => all || symbol.kind === "address" || symbol.used);
        const shown = shownOf(result.symbols!);

        // The loader is made before a file is written: a refusal writes nothing.
        let loader: { program: Buffer; symbols: AssembledSymbol[]; packed?: PackedLoader } | undefined;
        if (loaderIndex >= 0 && noLoader === undefined) {
          const copier = await assemble({ ...params, entrySource: LOADER_FILE }, contents, localToolContext());
          if (!copier.result.assembled) {
            const [first] = copier.result.diagnostics;
            const where = first === undefined ? "" : `: ${first.file ?? LOADER_FILE}${first.line === undefined ? "" : ` line ${first.line}`}: ${first.message}`;
            throw new Refusal("operation-failed", `${LOADER_FILE} does not assemble with these switch values${where}. Generate the source with the loader again. If it still does not assemble, give this message to the user.`);
          }
          const copierBuild = copier.attachments![0]!;
          const symbols = loaderSymbols(result.symbols!, copier.result.symbols!);
          if (loaded === undefined) loader = { program: copierBuild, symbols };
          else {
            const at = copier.result.symbols!.find((symbol) => symbol.name === COPIER_SOURCE);
            if (at?.kind !== "address") throw new Refusal("invalid-input", `${LOADER_FILE} has no label ${COPIER_SOURCE} at its copier. Generate the source with the loader again.`);
            const packedFrom = loaded;
            noLoader = refusalOf(() => checkPackedBuilds(built, copierBuild, packedFrom));
            if (noLoader === undefined) {
              const packed = await packLoader(built, copierBuild, { loaded: packedFrom, copier: at.address }, localToolContext());
              loader = { program: packed.program, symbols, packed };
            }
          }
        }

        const written = writeReported(out, plain ? built.subarray(2) : built, { what: "--out" });
        const range = result.loadRange!;
        const compared = program === undefined ? undefined : compareBuild(built, program, leftOut);
        const symbols = listedItems(shown, call.count("max-listed")!, showSymbol, `a larger --max-listed, or read ${symbolsPath(out)}`);
        // A build that differs from its reference is a failed check.
        const different = compared !== undefined && !compared.identical;
        // The bytes that differ in the leftovers that the build leaves out, and the other bytes that differ or that the build does not hold.
        const inLeftovers = (compared?.segments ?? []).flatMap((segment) => segment.leftovers ?? []).reduce((sum, leftover) => sum + leftover.differences, 0);
        const others = (compared?.segments ?? []).reduce((sum, segment) => sum + (segment.differences ?? 0) + (segment.uncovered ?? 0), 0) - inLeftovers;
        const leftoverHint = `${inLeftovers} different ${inLeftovers === 1 ? "byte is" : "bytes are"} in leftovers that this build leaves out, because ${LEFTOVERS_SWITCH} is 0. compare.segments gives these leftovers in leftovers, each with its file. To build the leftovers, give --switch ${LEFTOVERS_SWITCH}=1.`;
        const loaderPath = `${BUILD_DIRECTORY}/${buildName(LOADER_FILE, kind)}.prg`;
        const hints = [
          ...(different && others > 0 ? [`The program is not identical to the reference program. Read compare.segments: each segment that is different gives its first difference${inLeftovers > 0 ? " outside the leftovers that this build leaves out" : ""}.`] : []),
          ...(different && others === 0 ? ["The program is different from the reference program only in the leftovers that this build leaves out. All other bytes are identical."] : []),
          ...(different && inLeftovers > 0 ? [leftoverHint] : []),
          ...(different && others > 0 && label === undefined ? ["Without --release, a source with switches builds with the values of config.asm and --switch, and that program can differ from the base release. To check a release, give --release <label> with --compare."] : []),
          ...(symbols.rest === undefined ? [] : [`symbols is cut. To get all symbols, give ${symbols.rest}.`]),
          ...(loader === undefined ? [] : ["loader.out is the loader program of these switch values. No check of the loader program ran, so loader.verified is false."]),
          ...(noLoader === undefined ? [] : ["The build wrote the program of main.asm, but no loader program of these switch values: loader.reason tells why."]),
        ];
        return reply({
          result: different ? "FAIL" : "PASS",
          assembled: true,
          ...written,
          ...(plain ? { plain: true } : {}),
          loadRange: { start: formatC64Address(range.start), end: formatC64Address(range.end), bytes: range.bytes },
          symbols,
          // The symbols of the program for a test run, in symbols/ next to it.
          symbolsFile: writeReported(symbolsPath(out), symbolsFileText(shown), { what: "--out" }),
          ...(all ? {} : { unusedConstants: result.symbols!.length - shown.length }),
          diagnostics: result.diagnostics,
          ...(compared === undefined ? {} : { compare: compared }),
          ...(noLoader !== undefined ? { loader: { written: false, reason: noLoader } } : {}),
          ...(loader === undefined
            ? {}
            : {
                loader: {
                  ...writeReported(loaderPath, loader.program),
                  symbolsFile: writeReported(symbolsPath(loaderPath), symbolsFileText(shownOf(loader.symbols))),
                  ...(loader.packed === undefined ? {} : { packed: { packedBytes: loader.packed.packedBytes, unpackedBytes: loader.packed.unpackedBytes } }),
                  verified: false,
                },
              }),
        }, hints.length === 0 ? {} : { hint: hints.join(" ") });
      },
    },
  ],
});
