#!/usr/bin/env node
// disassemble.ts
//
// WHY THIS FILE EXISTS: the one script of the c64-disassembler skill. It
// disassembles a C64 .prg or flat 64K image with two host tools, and it
// installs the Ghidra language those runs need:
//   - `analyze`: Ghidra analysis with the committed VolatileCarve.java
//     pre-script and GhidraStructExport.java post-script. It produces the
//     export file that the c64-annotations skill imports.
//   - `listing`: a dxa `-a dump` listing, parsed into code/data ranges.
//   - `install-extension`: builds the `6502:LE:16:nmos` language (all 105
//     undocumented opcodes) into GHIDRA_HOME.
// `analyze` and `listing` locate `ghidra-run.ts` / `dxa-run.ts` in the MCP
// tree with resolveMcpModule() (c64-project) and run them with
// `process.execPath`. `install-extension` is one typed host-tool request
// through invokeHostTool() (c64-project).
//
// WHAT NOT TO DO:
//   - Never spawn Ghidra, analyzeHeadless, sleigh or dxa. They live on the
//     host and are reached only through the broker. The one spawn here is
//     `process.execPath` on an MCP module that resolveMcpModule() located.
//   - Never statically import anything from src/. The MCP tree ships
//     separately from this skill; a static import crashes when it is absent.
//   - Never guess the processor, the image kind or an entry point. Each is
//     a required flag or a file the caller supplies, and a missing one is
//     refused by name. A wrong guess is spent on the whole analysis.
//   - Never use the `prg` route's fixed default base ($0801) for a .prg.
//     Ghidra's BinaryLoader loads the 2-byte header as memory, so the base
//     is computed from the header (load address - 2) to put the body at its
//     real load address.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { HostToolResponse, InvokeHostToolOptions, McpModuleResolution } from "../../c64-project/scripts/mcp-module.ts";
import { loadSibling } from "./sibling.ts";

const SELF = fileURLToPath(import.meta.url);

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string };

/** What one spawned MCP module run returned. */
export interface ModuleRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** The side-effecting leaves, each defaulting to the real one. Tests fake
 * `runModule` and `invokeHostTool` so no broker, Ghidra or dxa is needed. */
export interface DisassembleDeps {
  /** Locates a file in the MCP tree. Defaults to c64-project's
   * resolveMcpModule(). */
  resolveModule?: (fileName: string) => McpModuleResolution;
  /** Runs `process.execPath <modulePath> ...argv`. */
  runModule?: (modulePath: string, argv: string[]) => Promise<ModuleRun>;
  /** One host-tool request. Defaults to c64-project's invokeHostTool(). */
  invokeHostTool?: (tool: string, args: object, opts: InvokeHostToolOptions) => Promise<HostToolResponse>;
  readFile?: (path: string) => Uint8Array;
  cwd?: () => string;
}

/** Parsed CLI options. */
export interface DisassembleOpts {
  image?: string;
  kind?: string;
  processor?: string;
  entrypoints?: string;
  dataRanges?: string;
  datablocks?: string;
  labels?: string;
  knownData?: string;
  runId?: string;
  loaderBaseAddr?: string;
  moduleName?: string;
  projectRoot?: string;
  unknown: string[];
}

/** The module name the extension installs under when none is given:
 * `<GHIDRA_HOME>/Ghidra/Extensions/C64NmosLanguage/`. Reusing one name
 * makes a second install overwrite the first instead of declaring the
 * same language id twice. */
export const DEFAULT_EXTENSION_MODULE = "C64NmosLanguage";

/** The same anchored shape ghidra-project.mts checks a run id against. */
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const LOADER_BASE_ADDR_PATTERN = /^0x[0-9a-f]{1,4}$/;
const KINDS = ["prg", "flat64k"] as const;

const VALUE_FLAGS: Record<string, keyof DisassembleOpts> = {
  "--image": "image",
  "--kind": "kind",
  "--processor": "processor",
  "--entrypoints": "entrypoints",
  "--data-ranges": "dataRanges",
  "--datablocks": "datablocks",
  "--labels": "labels",
  "--known-data": "knownData",
  "--run-id": "runId",
  "--loader-base-addr": "loaderBaseAddr",
  "--module-name": "moduleName",
  "--project-root": "projectRoot",
};

export function parseOpts(argv: string[]): DisassembleOpts {
  const o: DisassembleOpts = { unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const key = VALUE_FLAGS[a];
    if (key === undefined) {
      o.unknown.push(a);
      continue;
    }
    const v = argv[++i];
    if (v === undefined) o.unknown.push(a);
    else (o as unknown as Record<string, string>)[key] = v;
  }
  return o;
}

const refuse = (message: string): ScriptResult => ({ ok: false, message });

// ------------------------------------------------------------- the seam

interface Mcp {
  resolveModule: NonNullable<DisassembleDeps["resolveModule"]>;
  invokeHostTool: NonNullable<DisassembleDeps["invokeHostTool"]>;
}

/** c64-project's mcp-module.ts, loaded when first used so a missing sibling
 * skill is a named refusal. Injected deps replace its two functions. */
async function loadMcp(deps: DisassembleDeps): Promise<{ ok: true; mcp: Mcp } | { ok: false; message: string }> {
  if (deps.resolveModule && deps.invokeHostTool) {
    return { ok: true, mcp: { resolveModule: deps.resolveModule, invokeHostTool: deps.invokeHostTool } };
  }
  const load = await loadSibling(() => import("../../c64-project/scripts/mcp-module.ts"), "mcp-module.ts", "c64-disassembler");
  if (!load.ok) return load;
  return {
    ok: true,
    mcp: {
      resolveModule: deps.resolveModule ?? load.mod.resolveMcpModule,
      invokeHostTool: deps.invokeHostTool ?? load.mod.invokeHostTool,
    },
  };
}

function defaultRunModule(modulePath: string, argv: string[]): Promise<ModuleRun> {
  return new Promise((done) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(process.execPath, [modulePath, ...argv], { stdio: ["ignore", "pipe", "pipe"], shell: false });
    } catch (e) {
      done({ status: null, stdout: "", stderr: e instanceof Error ? e.message : String(e) });
      return;
    }
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (err) => done({ status: null, stdout, stderr: `${stderr}${err.message}` }));
    child.on("close", (status) => done({ status, stdout, stderr }));
  });
}

/** Runs one MCP module and returns its last stdout line, parsed. The
 * module's own `ok` decides success, never its exit code alone. */
async function runMcpModule(mcp: Mcp, deps: DisassembleDeps, fileName: string, argv: string[]): Promise<ScriptResult> {
  const found = mcp.resolveModule(fileName);
  if (!found.ok) return refuse(found.message);
  const run = await (deps.runModule ?? defaultRunModule)(found.path, argv);
  const lines = run.stdout.split("\n").filter((l) => l.trim() !== "");
  const last = lines[lines.length - 1];
  const stderrTail = run.stderr.trim().split("\n").slice(-5).join("\n");
  if (last === undefined) {
    return refuse(`${fileName} printed no result (exit ${run.status})${stderrTail ? `: ${stderrTail}` : ""}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(last);
  } catch {
    return refuse(`${fileName} printed a non-JSON last line (exit ${run.status}): ${last}`);
  }
  if (typeof parsed !== "object" || parsed === null || typeof (parsed as { ok?: unknown }).ok !== "boolean") {
    return refuse(`${fileName} printed a result with no boolean "ok": ${last}`);
  }
  const result = parsed as ScriptResult;
  if (result.ok && run.status !== 0) return refuse(`${fileName} exited ${run.status} after printing ok:true: ${last}`);
  if (!result.ok && typeof result.message !== "string") return refuse(`${fileName} refused without a message: ${last}`);
  return result;
}

// ------------------------------------------------------------- shared checks

function checkImageAndKind(verb: string, o: DisassembleOpts): ScriptResult | null {
  if (o.unknown.length > 0) return refuse(`${verb}: unknown or incomplete option(s): ${o.unknown.join(" ")}`);
  if (!o.image) return refuse(`${verb} needs --image <path>: the .prg or flat 64K image to disassemble`);
  if (!o.kind) {
    return refuse(`${verb} needs --kind prg|flat64k: the image kind is never guessed from the file name or size`);
  }
  if (!(KINDS as readonly string[]).includes(o.kind)) {
    return refuse(`${verb}: --kind must be "prg" or "flat64k"; got ${JSON.stringify(o.kind)}`);
  }
  return null;
}

/** A run id from the image name: every character outside [A-Za-z0-9_-]
 * becomes "-", capped at 64. Null when nothing usable is left. */
export function runIdFromImage(imagePath: string): string | null {
  const stem = basename(imagePath).replace(/\.[^./]+$/, "");
  const id = stem.replace(/[^A-Za-z0-9_-]/g, "-").replace(/^[^A-Za-z0-9]+/, "").slice(0, 64);
  return RUN_ID_PATTERN.test(id) ? id : null;
}

/** The Ghidra loader base for a .prg: two bytes below its load address, so
 * the header lands at load-2..load-1 and the body at its real address. */
export function prgLoaderBase(bytes: Uint8Array): { ok: true; base: string; loadAddress: number } | { ok: false; message: string } {
  if (bytes.length < 3) return { ok: false, message: `not a .prg: ${bytes.length} byte(s), fewer than a 2-byte load address and one body byte` };
  const loadAddress = bytes[0]! | (bytes[1]! << 8);
  if (loadAddress < 2) {
    return { ok: false, message: `the .prg load address $${loadAddress.toString(16).padStart(4, "0")} leaves no room for the 2-byte header below it; pass --loader-base-addr` };
  }
  return { ok: true, base: `0x${(loadAddress - 2).toString(16)}`, loadAddress };
}

// ------------------------------------------------------------- verbs

/** `analyze`: Ghidra analysis plus the structural export. */
export async function runAnalyze(o: DisassembleOpts, deps: DisassembleDeps = {}): Promise<ScriptResult> {
  const bad = checkImageAndKind("analyze", o);
  if (bad) return bad;
  if (!o.processor) {
    return refuse(
      "analyze needs --processor <Ghidra language id>: 6502:LE:16:nmos (documented + undocumented opcodes, " +
        "needs install-extension) or 6502:LE:16:default (stock Ghidra, documented opcodes only). It is never guessed",
    );
  }
  if (o.loaderBaseAddr !== undefined && !LOADER_BASE_ADDR_PATTERN.test(o.loaderBaseAddr)) {
    return refuse(`analyze: --loader-base-addr must be 0x followed by 1-4 lowercase hex digits; got ${JSON.stringify(o.loaderBaseAddr)}`);
  }
  const loaded = await loadMcp(deps);
  if (!loaded.ok) return refuse(loaded.message);
  const { mcp } = loaded;

  const cwd = (deps.cwd ?? process.cwd)();
  const imageAbs = resolve(cwd, o.image!);
  let bytes: Uint8Array;
  try {
    bytes = (deps.readFile ?? readFileSync)(imageAbs);
  } catch (e) {
    return refuse(`analyze: cannot read --image ${imageAbs}: ${e instanceof Error ? e.message : String(e)}`);
  }

  let loaderBaseAddr = o.loaderBaseAddr;
  if (o.kind === "prg") {
    if (loaderBaseAddr === undefined) {
      const base = prgLoaderBase(bytes);
      if (!base.ok) return refuse(`analyze: ${imageAbs}: ${base.message}`);
      loaderBaseAddr = base.base;
    }
  } else if (bytes.length !== 65536) {
    return refuse(`analyze: --kind flat64k needs an image of exactly 65536 bytes; ${imageAbs} has ${bytes.length}`);
  }

  const runId = o.runId ?? runIdFromImage(imageAbs);
  if (runId === null || !RUN_ID_PATTERN.test(runId)) {
    return refuse(`analyze: no usable run id${o.runId ? ` in ${JSON.stringify(o.runId)}` : ` from the image name ${basename(imageAbs)}`}; pass --run-id matching ${RUN_ID_PATTERN.source}`);
  }

  const exportScript = mcp.resolveModule("vendor/ghidra-scripts/GhidraStructExport.java");
  if (!exportScript.ok) return refuse(exportScript.message);
  const scriptsDir = dirname(exportScript.path);

  const argv = [
    "--run-id", runId,
    "--import-path", imageAbs,
    "--processor", o.processor,
    "--import-route", o.kind!,
    "--noanalysis",
    "--script-path", scriptsDir,
    "--pre-script", join(scriptsDir, "VolatileCarve.java"),
    "--post-script", exportScript.path,
    "--export-path", `${runId}.ghidra-export.txt`,
  ];
  if (loaderBaseAddr !== undefined) argv.push("--loader-base-addr", loaderBaseAddr);
  if (o.entrypoints) argv.push("--entrypoints-path", resolve(cwd, o.entrypoints));
  if (o.dataRanges) argv.push("--data-ranges-path", resolve(cwd, o.dataRanges));
  if (o.projectRoot) argv.push("--project-root", resolve(cwd, o.projectRoot));

  const result = await runMcpModule(mcp, deps, "ghidra-run.ts", argv);
  if (!result.ok) return result;
  return { ...result, runId, importRoute: o.kind, loaderBaseAddr: loaderBaseAddr ?? "0x0", entrypoints: o.entrypoints ? resolve(cwd, o.entrypoints) : null };
}

/** `listing`: a dxa listing, parsed into code/data ranges. */
export async function runListing(o: DisassembleOpts, deps: DisassembleDeps = {}): Promise<ScriptResult> {
  const bad = checkImageAndKind("listing", o);
  if (bad) return bad;
  if (o.knownData && (o.datablocks || o.labels)) {
    return refuse("listing: --known-data is an alternative to --datablocks/--labels; pass the rows OR the files, never both");
  }
  const loaded = await loadMcp(deps);
  if (!loaded.ok) return refuse(loaded.message);

  const cwd = (deps.cwd ?? process.cwd)();
  const argv = ["--image", resolve(cwd, o.image!), "--image-kind", o.kind!];
  if (o.entrypoints) argv.push("--entrypoints-path", resolve(cwd, o.entrypoints));
  if (o.datablocks) argv.push("--datablocks-path", resolve(cwd, o.datablocks));
  if (o.labels) argv.push("--labels-path", resolve(cwd, o.labels));
  if (o.knownData) argv.push("--known-data-rows", resolve(cwd, o.knownData));
  if (o.projectRoot) argv.push("--project-root", resolve(cwd, o.projectRoot));

  const result = await runMcpModule(loaded.mcp, deps, "dxa-run.ts", argv);
  if (!result.ok) return result;
  return { ...result, entrypoints: o.entrypoints ? resolve(cwd, o.entrypoints) : null };
}

/** `install-extension`: builds the `6502:LE:16:nmos` language into
 * `<GHIDRA_HOME>/Ghidra/Extensions/<module>/`. The broker returns a copy of
 * the compiled .sla; it lands in a temporary directory that is removed. */
export async function runInstallExtension(o: DisassembleOpts, deps: DisassembleDeps = {}): Promise<ScriptResult> {
  if (o.unknown.length > 0) return refuse(`install-extension: unknown or incomplete option(s): ${o.unknown.join(" ")}`);
  const moduleName = o.moduleName ?? DEFAULT_EXTENSION_MODULE;
  if (!RUN_ID_PATTERN.test(moduleName)) {
    return refuse(`install-extension: --module-name must match ${RUN_ID_PATTERN.source}; got ${JSON.stringify(moduleName)}`);
  }
  const loaded = await loadMcp(deps);
  if (!loaded.ok) return refuse(loaded.message);

  const staging = mkdtempSync(join(tmpdir(), "c64re-ghidra-ext-"));
  try {
    const r = await loaded.mcp.invokeHostTool("ghidra.installExtension", { moduleName }, { destDir: staging });
    if (!r.ok) return refuse(r.message);
    const sla = r.results?.[0];
    return {
      ok: true,
      tool: "ghidra.installExtension",
      moduleName,
      language: "6502:LE:16:nmos",
      sla: sla ? { name: basename(sla.path), sha256: sla.sha256, byteLength: sla.byteLength } : null,
      exitStatus: r.exitStatus ?? null,
      stderrTail: r.stderrTail ?? "",
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export const VERBS = {
  analyze: runAnalyze,
  listing: runListing,
  "install-extension": runInstallExtension,
} satisfies Record<string, (o: DisassembleOpts, deps?: DisassembleDeps) => Promise<ScriptResult>>;

function selfPath(): string {
  const r = relative(process.cwd(), SELF);
  return !r || r.startsWith("..") || isAbsolute(r) ? SELF : r;
}

export function usage(): string {
  const s = selfPath();
  return `usage: node ${s} <command> [options]

  analyze --image FILE --kind prg|flat64k --processor LANG-ID
          [--entrypoints FILE] [--data-ranges FILE] [--run-id ID] [--loader-base-addr 0xNNNN] [--project-root DIR]
      Ghidra analysis + structural export (import it with c64-annotations)
  listing --image FILE --kind prg|flat64k
          [--entrypoints FILE] [--datablocks FILE] [--labels FILE] [--known-data ROWS.json] [--project-root DIR]
      dxa disassembly listing, parsed into code/data ranges
  install-extension [--module-name NAME]
      build the 6502:LE:16:nmos language (undocumented opcodes) into GHIDRA_HOME

Never guesses the processor, the image kind or an entry point. The last
stdout line is one JSON result.`;
}

/** The whole CLI as a function. Never rejects. */
export async function main(argv: string[], deps: DisassembleDeps = {}): Promise<ScriptResult> {
  const [cmd, ...rest] = argv;
  if (!cmd || !Object.hasOwn(VERBS, cmd)) {
    return refuse(cmd ? `unknown command ${JSON.stringify(cmd)}\n${usage()}` : usage());
  }
  try {
    return await VERBS[cmd as keyof typeof VERBS](parseOpts(rest), deps);
  } catch (e) {
    return refuse(e instanceof Error ? e.message : String(e));
  }
}

// Guarded so a test can import the exports above without running the CLI.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await main(process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
