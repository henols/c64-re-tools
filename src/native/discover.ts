// One discovery rule for every native tool: C64RT_<TOOL> names
// the executable, else the tool's usual name on PATH. A missing tool is
// refused by name with the remedy; nothing is ever installed.

import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute, join, posix, win32 } from "node:path";

import { WireFailure } from "../protocol/messages.ts";

/** The remedy for a missing native tool: the dev container of c64-re-tools installs every one. */
export const INSTALL_STEPS = "The dev container of c64-re-tools installs it at each start: restart the container, or rebuild it. Without that dev container, set it up as https://github.com/henols/c64-re-tools#dev-container tells.";

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
  remedy: INSTALL_STEPS,
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
  remedy: INSTALL_STEPS,
};

export const C64RUN: ToolSpec = {
  name: "c64run",
  envVar: "C64RT_C64RUN",
  binaries: ["c64run"],
  where: "on this machine",
  remedy: INSTALL_STEPS,
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

/** A VICE version; `revision` is the SVN revision of a build from VICE's source tree (nightly builds), absent for a release. */
export interface ViceVersion {
  major: number;
  minor: number;
  revision?: number;
}

/** "x64sc (VICE 3.10)", "c1541 (VICE 3.9)", "VICE 3.9.0" or "x64sc (VICE 3.10 SVN r45999)": the major and minor version, and the SVN revision. */
export function viceVersionOf(text: string): ViceVersion | undefined {
  const match = /VICE (\d+)\.(\d+)(?:[.\d]*)(?: SVN r(\d+))?/.exec(text);
  if (match === null) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), ...(match[3] === undefined ? {} : { revision: Number(match[3]) }) };
}

/**
 * Known flaws of VICE versions that c64-re-tools still runs on. A flaw
 * is not worked around: it is named with the VICE version that fixes it.
 * `upTo` is the last flawed major.minor; `fixedRevision` the first SVN
 * revision with the fix, for builds from VICE's source tree.
 */
const VICE_FLAWS = [
  {
    upTo: { major: 3, minor: 10 },
    fixedRevision: 45971,
    text:
      "VICE 3.10 and older hold bits 5-7 of CIA 1 ports A and B low with the joystick device that c64-re-tools uses (VICE bug #2202). " +
      "$DC00 and $DC01 read $1F with no input. A program that waits for one key of the keyboard matrix (for example LDA $DC01 / CMP #$EF for SPACE) waits forever. " +
      "A program that compares the full byte of a joystick port also waits forever. " +
      "A KERNAL tape LOAD of a .tap image stops after FOUND, with no LOADING, and the C64 shows READY. The fix is in the next VICE release, and in VICE nightly builds now (SVN r45971 or later). " +
      "Install the latest VICE when this matters.",
  },
] as const;

/** The known flaws of this VICE version, as text for a person or an agent. */
export function viceFlaws(version: ViceVersion): string[] {
  return VICE_FLAWS.filter((flaw) => {
    const newer = version.major > flaw.upTo.major || (version.major === flaw.upTo.major && version.minor > flaw.upTo.minor);
    return !newer && (version.revision === undefined || version.revision < flaw.fixedRevision);
  }).map((flaw) => flaw.text);
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
