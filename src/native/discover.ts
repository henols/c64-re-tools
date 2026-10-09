// One discovery rule for every native tool: C64RT_<TOOL> names
// the executable, else the tool's usual name on PATH. A missing tool is
// refused by name with the remedy; nothing is ever installed.

import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute, join, posix, win32 } from "node:path";

import { WireFailure } from "../protocol/messages.ts";

export interface ToolSpec {
  /** Human name, for messages. */
  name: string;
  /** Environment variable that can name the executable. */
  envVar: string;
  /** Executable names to look for on PATH, in order. */
  binaries: string[];
  /** Where the tool runs: the Host Runtime's machine, or the skill script's. */
  where: "on the host" | "on this machine";
  /** What the user does when the tool is missing. */
  remedy: string;
}

export const ACME: ToolSpec = {
  name: "ACME",
  envVar: "C64RT_ACME",
  binaries: ["acme"],
  where: "on this machine",
  remedy: "Install the ACME cross-assembler on the machine that runs the skill scripts so that acme is on PATH, or set C64RT_ACME to its full path.",
};

export const C1541: ToolSpec = {
  name: "c1541",
  envVar: "C64RT_C1541",
  binaries: ["c1541"],
  where: "on the host",
  remedy: "Install VICE 3.9 or later on the host (c1541 comes with it) so that c1541 is on PATH, or set C64RT_C1541 to its full path, then restart the Host Runtime.",
};

export const PETCAT: ToolSpec = {
  name: "petcat",
  envVar: "C64RT_PETCAT",
  binaries: ["petcat"],
  where: "on the host",
  remedy: "Install VICE 3.9 or later on the host (petcat comes with it) so that petcat is on PATH, or set C64RT_PETCAT to its full path, then restart the Host Runtime.",
};

export const DXA: ToolSpec = {
  name: "dxa",
  envVar: "C64RT_DXA",
  binaries: ["dxa"],
  where: "on this machine",
  remedy: "Install dxa (from the xa package, https://www.floodgap.com/retrotech/xa/) on the machine that runs the skill scripts so that dxa is on PATH, or set C64RT_DXA to its full path.",
};

export const VICE: ToolSpec = {
  name: "VICE (x64sc)",
  envVar: "C64RT_VICE",
  binaries: ["x64sc"],
  where: "on the host",
  remedy: "Install VICE 3.9 or later on the host so that x64sc is on PATH, or set C64RT_VICE to the full path of x64sc, then restart the Host Runtime.",
};

/**
 * The oldest VICE that works: 3.7 has no monitor profiler, and its CPU
 * history, until-return and c1541 chain output differ.
 */
export const MIN_VICE = { major: 3, minor: 9 } as const;

/** "x64sc (VICE 3.10)", "c1541 (VICE 3.9)" or "VICE 3.9.0": the major and minor version. */
export function viceVersionOf(text: string): { major: number; minor: number } | undefined {
  const match = /VICE (\d+)\.(\d+)/.exec(text);
  return match === null ? undefined : { major: Number(match[1]), minor: Number(match[2]) };
}

export function isOlderThanMinimum(version: { major: number; minor: number }): boolean {
  return version.major < MIN_VICE.major || (version.major === MIN_VICE.major && version.minor < MIN_VICE.minor);
}

/** A file this process may run. Windows has no execute permission (X_OK checks nothing there): a file is enough. */
export function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (process.platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The value of an environment variable. Windows ignores the case of the name,
 * also in a copied environment, where PATH is often named "Path".
 */
export function environmentValue(env: NodeJS.ProcessEnv, name: string, platform: NodeJS.Platform = process.platform): string | undefined {
  if (platform !== "win32" || env[name] !== undefined) return env[name];
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name.toUpperCase());
  return key === undefined ? undefined : env[key];
}

/** The extensions that the supervisor can start on Windows: programs directly, batch files through cmd.exe. */
const STARTABLE = [".com", ".exe", ".bat", ".cmd"];

/**
 * The suffixes that a name on PATH can have. On Windows, the PATHEXT
 * extensions that the supervisor can start, in PATHEXT order, and never the
 * bare name: Windows does not start a file without an extension. Elsewhere
 * only the bare name.
 */
export function pathSuffixes(env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string[] {
  if (platform !== "win32") return [""];
  const listed = (environmentValue(env, "PATHEXT", platform) ?? "").split(";").map((suffix) => suffix.trim().toLowerCase());
  const suffixes = listed.filter((suffix, index) => STARTABLE.includes(suffix) && listed.indexOf(suffix) === index);
  return suffixes.length === 0 ? STARTABLE : suffixes;
}

/** The first executable named `binary + suffix` in a PATH directory, in PATH order; undefined when there is none. */
export function findOnPath(binaries: readonly string[], env: NodeJS.ProcessEnv, suffixes: readonly string[] = pathSuffixes(env), platform: NodeJS.Platform = process.platform): string | undefined {
  const delimiter = platform === "win32" ? win32.delimiter : posix.delimiter;
  for (const dir of (environmentValue(env, "PATH", platform) ?? "").split(delimiter)) {
    if (dir === "") continue;
    for (const binary of binaries) {
      for (const suffix of suffixes) {
        const candidate = join(dir, binary + suffix);
        if (isExecutableFile(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

/** Finds a tool's executable. Throws WireFailure(installation-incomplete) naming the tool and the remedy. */
export function findTool(tool: ToolSpec, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[tool.envVar];
  if (configured !== undefined && configured !== "") {
    if (isAbsolute(configured) && isExecutableFile(configured)) return configured;
    throw new WireFailure("installation-incomplete", `${tool.envVar} ${tool.where} does not name an executable ${tool.name} file. ${tool.remedy}`);
  }
  const found = findOnPath(tool.binaries, env);
  if (found !== undefined) return found;
  throw new WireFailure("installation-incomplete", `${tool.name} is not installed ${tool.where}. ${tool.remedy}`);
}
