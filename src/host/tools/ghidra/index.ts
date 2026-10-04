// Headless Ghidra for the Host Runtime (16 §10). Ghidra runs with a settings
// directory of its own per request: the c64-re-tools NMOS 6510 language goes
// in there as an extension, so the user's Ghidra installation and settings
// never change. Ghidra compiles the language from its source on first load.
// Projects are disposable and live in the request workspace.

import { accessSync, constants, cpSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

import { WireFailure } from "../../../protocol.ts";
import type { ProcessSupervisor } from "../../processes.ts";
import type { Workspace } from "../../staging.ts";
import { runTool, type ToolRun } from "../run.ts";

export const GHIDRA_LANGUAGE = "C64RT_6510:LE:16:nmos";
export const LANGUAGE_DIRECTORY = join(import.meta.dirname, "language");
export const SCRIPT_DIRECTORY = join(import.meta.dirname, "scripts");

const REMEDY =
  "Install Ghidra on the host and set C64RT_GHIDRA to its installation directory (the directory that holds support/analyzeHeadless), " +
  "or put analyzeHeadless on PATH, then restart c64-re-tools-host.";

export interface GhidraInstallation {
  /** The installation directory. */
  root: string;
  analyzeHeadless: string;
  /** For example ghidra_12.1.3_PUBLIC: the name of Ghidra's settings directory. */
  settingsName: string;
  version: string;
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function installationAt(root: string, source: string): GhidraInstallation {
  const analyzeHeadless = join(root, "support", "analyzeHeadless");
  let properties: string;
  try {
    if (!isExecutableFile(analyzeHeadless)) throw new Error("no analyzeHeadless");
    properties = readFileSync(join(root, "Ghidra", "application.properties"), "utf8");
  } catch {
    throw new WireFailure("installation-incomplete", `${source} does not point to a Ghidra installation. ${REMEDY}`);
  }
  const value = (key: string) => new RegExp(`^${key.replace(/\./g, "\\.")}=(.*)$`, "m").exec(properties)?.[1]?.trim();
  const version = value("application.version");
  const release = value("application.release.name");
  if (version === undefined || release === undefined) throw new WireFailure("installation-incomplete", `The Ghidra installation at ${source} has no version. ${REMEDY}`);
  return { root, analyzeHeadless, settingsName: `ghidra_${version}_${release}`, version };
}

/** Finds Ghidra: C64RT_GHIDRA names the installation directory, else analyzeHeadless on PATH. */
export function findGhidra(env: NodeJS.ProcessEnv = process.env): GhidraInstallation {
  const configured = env.C64RT_GHIDRA;
  if (configured !== undefined && configured !== "") {
    if (!isAbsolute(configured)) throw new WireFailure("installation-incomplete", `C64RT_GHIDRA on the host is not an absolute path. ${REMEDY}`);
    return installationAt(configured, "C64RT_GHIDRA");
  }
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir === "") continue;
    const candidate = join(dir, "analyzeHeadless");
    if (isExecutableFile(candidate)) return installationAt(resolve(dirname(realpathSync(candidate)), ".."), "analyzeHeadless on PATH");
  }
  throw new WireFailure("installation-incomplete", `Ghidra is not installed on the host. ${REMEDY}`);
}

/**
 * Makes a Ghidra settings directory inside the workspace with the NMOS 6510
 * language installed as an extension. Returns the environment that makes
 * Ghidra use it.
 */
export function prepareSettings(workspace: Workspace, ghidra: GhidraInstallation, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const config = workspace.directory("ghidra-config");
  const cache = workspace.directory("ghidra-cache");
  // With XDG_CONFIG_HOME set, Ghidra keeps its settings in <user>-ghidra/<settings name> below it.
  const extension = join(config, `${userInfo().username}-ghidra`, ghidra.settingsName, "Extensions", "C64RT");
  mkdirSync(join(extension, "data"), { recursive: true });
  cpSync(LANGUAGE_DIRECTORY, join(extension, "data", "languages"), { recursive: true });
  writeFileSync(join(extension, "extension.properties"), `name=C64RT\ndescription=c64-re-tools NMOS 6510 language\nauthor=c64-re-tools\ncreatedOn=\nversion=${ghidra.version}\n`);
  writeFileSync(join(extension, "Module.manifest"), "");
  return { ...env, XDG_CONFIG_HOME: config, XDG_CACHE_HOME: cache };
}

export interface HeadlessOptions {
  ghidra: GhidraInstallation;
  workspace: Workspace;
  /** Workspace-relative path of the file to import. */
  file: string;
  baseAddress: number;
  /** Scripts from these directories, before and after analysis, with their arguments. */
  scriptDirectories: string[];
  preScripts?: Array<{ name: string; args: string[] }>;
  postScripts?: Array<{ name: string; args: string[] }>;
  analyze: boolean;
  timeoutMs: number;
  supervisor: ProcessSupervisor;
  signal: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

/** Imports one file into a disposable project and runs the scripts. Fails on timeout, abort or a Ghidra error exit. */
export async function runHeadless(options: HeadlessOptions): Promise<ToolRun> {
  const env = prepareSettings(options.workspace, options.ghidra, options.env);
  const project = options.workspace.directory("ghidra-project");
  const argv = [
    options.ghidra.analyzeHeadless,
    project,
    "request",
    "-import",
    options.workspace.path(options.file),
    "-processor",
    GHIDRA_LANGUAGE,
    "-loader",
    "BinaryLoader",
    "-loader-baseAddr",
    `0x${options.baseAddress.toString(16)}`,
    "-scriptPath",
    options.scriptDirectories.join(";"),
    "-deleteProject",
  ];
  if (!options.analyze) argv.push("-noanalysis");
  else argv.push("-analysisTimeoutPerFile", String(Math.ceil(options.timeoutMs / 1000)));
  for (const script of options.preScripts ?? []) argv.push("-preScript", script.name, ...script.args);
  for (const script of options.postScripts ?? []) argv.push("-postScript", script.name, ...script.args);
  const run = await runTool({ argv, cwd: options.workspace.root, supervisor: options.supervisor, signal: options.signal, timeoutMs: options.timeoutMs, env });
  if (run.aborted) throw new WireFailure("operation-failed", "The Ghidra analysis was cancelled.");
  if (run.timedOut) throw new WireFailure("operation-failed", `Ghidra did not finish within ${options.timeoutMs / 1000} seconds.`);
  if (run.code !== 0 || /^ERROR REPORT SCRIPT ERROR|Exception in thread "main"/m.test(run.stdout + run.stderr)) {
    throw new WireFailure("operation-failed", "Ghidra stopped with an error.");
  }
  return run;
}
