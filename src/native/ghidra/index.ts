// Headless Ghidra, run by the c64-static-analysis script. Ghidra runs with a settings
// directory of its own per request: the c64-re-tools NMOS 6510 language goes
// in there as an extension, so the user's Ghidra installation and settings
// never change. Ghidra compiles the language from its source on first load.
// Projects are disposable and live in the request workspace.

import { cpSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { WireFailure } from "../../protocol.ts";
import { findOnPath, isExecutableFile } from "../discover.ts";
import type { ProcessSupervisor } from "../processes.ts";
import type { Workspace } from "../staging.ts";
import { outputTail, runToolOrFail, type ToolRun } from "../run.ts";

export const GHIDRA_LANGUAGE = "C64RT_6510:LE:16:nmos";
// Next to this module. New URL literals, so an installed skill gets the directories too.
export const LANGUAGE_DIRECTORY = fileURLToPath(new URL("./language/", import.meta.url));
export const SCRIPT_DIRECTORY = fileURLToPath(new URL("./scripts/", import.meta.url));

const REMEDY =
  "Install Ghidra on the machine that runs the skill scripts and set C64RT_GHIDRA to its installation directory " +
  "(the directory that holds support/analyzeHeadless), or put analyzeHeadless on PATH.";

export interface GhidraInstallation {
  /** The installation directory. */
  root: string;
  analyzeHeadless: string;
  /** For example ghidra_12.1.3_PUBLIC: the name of Ghidra's settings directory. */
  settingsName: string;
  version: string;
}

/** Ghidra's launcher is a shell script, and a batch file on Windows. */
const LAUNCHER_SUFFIX = process.platform === "win32" ? ".bat" : "";

function installationAt(root: string, source: string): GhidraInstallation {
  const analyzeHeadless = join(root, "support", `analyzeHeadless${LAUNCHER_SUFFIX}`);
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

/** The version of a Ghidra installation as a result and the tool status name it, for example "Ghidra 12.1.3". */
export function ghidraVersion(ghidra: GhidraInstallation): string {
  return `Ghidra ${ghidra.version}`;
}

/** Finds Ghidra: C64RT_GHIDRA names the installation directory, else analyzeHeadless on PATH. */
export function findGhidra(env: NodeJS.ProcessEnv = process.env): GhidraInstallation {
  const configured = env.C64RT_GHIDRA;
  if (configured !== undefined && configured !== "") {
    if (!isAbsolute(configured)) throw new WireFailure("installation-incomplete", `C64RT_GHIDRA on this machine is not an absolute path. ${REMEDY}`);
    return installationAt(configured, "C64RT_GHIDRA");
  }
  const found = findOnPath(["analyzeHeadless"], env, [LAUNCHER_SUFFIX]);
  if (found !== undefined) return installationAt(resolve(dirname(realpathSync(found)), ".."), "analyzeHeadless on PATH");
  throw new WireFailure("installation-incomplete", `Ghidra is not installed on this machine. ${REMEDY}`);
}

/**
 * The user name in the name of Ghidra's settings directory: Java's user.name
 * without spaces and without a domain before the last backslash or slash. Java gives "?"
 * for a user without an entry in the password database, where Node throws.
 */
export function ghidraUserName(lookup: () => string = () => userInfo().username): string {
  let name: string;
  try {
    name = lookup();
  } catch {
    name = "?";
  }
  name = name.split(" ").join("");
  return name.slice(Math.max(name.lastIndexOf("\\"), name.lastIndexOf("/")) + 1);
}

/**
 * Makes a Ghidra settings directory inside the workspace with the NMOS 6510
 * language installed as an extension. Returns the environment that makes
 * Ghidra use it.
 */
export function prepareSettings(workspace: Workspace, ghidra: GhidraInstallation, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const config = workspace.directory("ghidra-config");
  const cache = workspace.directory("ghidra-cache");
  // With XDG_CONFIG_HOME set, Ghidra keeps its settings in [<user>-]ghidra/<settings name> below it: with
  // the user name only when that directory lies outside the user's home. The temporary directory is
  // outside it on Linux and macOS but inside it on Windows (in AppData), so both names get it.
  for (const application of [`${ghidraUserName()}-ghidra`, "ghidra"]) {
    const extension = join(config, application, ghidra.settingsName, "Extensions", "C64RT");
    mkdirSync(join(extension, "data"), { recursive: true });
    cpSync(LANGUAGE_DIRECTORY, join(extension, "data", "languages"), { recursive: true });
    writeFileSync(join(extension, "extension.properties"), `name=C64RT\ndescription=c64-re-tools NMOS 6510 language\nauthor=c64-re-tools\ncreatedOn=\nversion=${ghidra.version}\n`);
    writeFileSync(join(extension, "Module.manifest"), "");
  }
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
  const run = await runToolOrFail("Ghidra", "The Ghidra analysis", { argv, cwd: options.workspace.root, timeoutMs: options.timeoutMs }, { supervisor: options.supervisor, signal: options.signal, env });
  if (run.code !== 0 || /^ERROR REPORT SCRIPT ERROR|Exception in thread "main"/m.test(run.stdout + run.stderr)) {
    // Ghidra's own error lines tell the user what to fix.
    const tail = outputTail("Ghidra", run, options.workspace.root, /ERROR|Exception|Error:/);
    throw new WireFailure("operation-failed", `Ghidra stopped with an error${tail === "" ? ` (exit ${run.code}).` : `.${tail}`}`);
  }
  return run;
}
