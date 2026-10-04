// One discovery rule for every native host tool (16 §15): C64RT_<TOOL> names
// the executable, else the tool's usual name on PATH. A missing tool is
// refused by name with the remedy; nothing is ever installed.

import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

import { WireFailure } from "../../protocol.ts";

export interface ToolSpec {
  /** Human name, for messages. */
  name: string;
  /** Environment variable that can name the executable. */
  envVar: string;
  /** Executable names to look for on PATH, in order. */
  binaries: string[];
  /** What the user does when the tool is missing. */
  remedy: string;
}

export const ACME: ToolSpec = {
  name: "ACME",
  envVar: "C64RT_ACME",
  binaries: ["acme"],
  remedy: "Install the ACME cross-assembler on the host so that acme is on PATH, or set C64RT_ACME to its full path, then restart c64-re-tools-host.",
};

export const C1541: ToolSpec = {
  name: "c1541",
  envVar: "C64RT_C1541",
  binaries: ["c1541"],
  remedy: "Install VICE on the host (c1541 comes with it) so that c1541 is on PATH, or set C64RT_C1541 to its full path, then restart c64-re-tools-host.",
};

export const PETCAT: ToolSpec = {
  name: "petcat",
  envVar: "C64RT_PETCAT",
  binaries: ["petcat"],
  remedy: "Install VICE on the host (petcat comes with it) so that petcat is on PATH, or set C64RT_PETCAT to its full path, then restart c64-re-tools-host.",
};

export const DXA: ToolSpec = {
  name: "dxa",
  envVar: "C64RT_DXA",
  binaries: ["dxa"],
  remedy: "Install dxa (from the xa package, https://www.floodgap.com/retrotech/xa/) on the host so that dxa is on PATH, or set C64RT_DXA to its full path, then restart c64-re-tools-host.",
};

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Finds a tool's executable. Throws WireFailure(installation-incomplete) naming the tool and the remedy. */
export function findTool(tool: ToolSpec, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[tool.envVar];
  if (configured !== undefined && configured !== "") {
    if (isAbsolute(configured) && isExecutableFile(configured)) return configured;
    throw new WireFailure("installation-incomplete", `${tool.envVar} on the host does not name an executable ${tool.name} file. ${tool.remedy}`);
  }
  const suffixes = process.platform === "win32" ? [".exe", ""] : [""];
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir === "") continue;
    for (const binary of tool.binaries) {
      for (const suffix of suffixes) {
        const candidate = join(dir, binary + suffix);
        if (isExecutableFile(candidate)) return candidate;
      }
    }
  }
  throw new WireFailure("installation-incomplete", `${tool.name} is not installed on the host. ${tool.remedy}`);
}
