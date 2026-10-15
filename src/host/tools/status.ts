// host.status: VICE and the tools that come with it, each found the way its
// operations find it and run once with a version option. A tool from a
// VICE older than MIN_VICE is reported as not working, as its operations refuse it.
// VICE itself is reported with the version that the host read from the
// running emulator at start: the Homebrew x64sc of VICE 3.10 on macOS stops
// on -version ("argv[0] is NULL") although the emulator runs.

import type { ToolStatus } from "../../protocol/tools.ts";
import { C1541, findTool, isOlderThanMinimum, MIN_VICE, PETCAT, VICE, viceFlaws, viceVersionOf, type ToolSpec, type ViceVersion } from "../../native/discover.ts";
import type { ToolContext } from "../../native/run.ts";
import { probeTools } from "../../native/status.ts";
import { findVice } from "../vice/process.ts";

function requireMinimum(status: ToolStatus, tool: ToolSpec): ToolStatus {
  if (!status.runs) return status;
  const version = viceVersionOf(status.version ?? "");
  if (version !== undefined && !isOlderThanMinimum(version)) return status;
  const found = version === undefined ? "It does not tell its VICE version" : `It comes from VICE ${version.major}.${version.minor}`;
  return { ...status, runs: false, problem: `${found}, and c64-re-tools needs VICE ${MIN_VICE.major}.${MIN_VICE.minor} or later. ${tool.remedy}` };
}

/** The version text of a VICE version, as x64sc -version prints it. */
const versionText = (version: ViceVersion) => `x64sc (VICE ${version.major}.${version.minor}${version.revision === undefined ? "" : ` SVN r${version.revision}`})`;

/** `started`: the version that the host read from the emulator at start; without it, VICE is probed with -version too. */
export async function hostStatus(context: ToolContext, started?: ViceVersion): Promise<{ result: { tools: ToolStatus[] } }> {
  const specs = [VICE, C1541, PETCAT];
  const probed = await probeTools(
    [
      ...(started === undefined ? [{ name: VICE.name, find: findVice, args: ["-version"], pattern: /^x64sc \(VICE \d/ }] : []),
      { name: C1541.name, find: (env) => findTool(C1541, env), args: ["-version"], pattern: /^c1541 \(VICE \d/ },
      { name: PETCAT.name, find: (env) => findTool(PETCAT, env), args: ["-version"], pattern: /^petcat \(VICE \d/ },
    ],
    context,
  );
  const tools = started === undefined ? probed : [{ name: VICE.name, found: true, path: findVice(context.env ?? process.env), version: versionText(started), runs: true }, ...probed];
  const checked = tools.map((status, index) => requireMinimum(status, specs[index]!));
  // VICE runs with its known flaws; status names them (D56).
  const vice = checked[0]!;
  const version = vice.runs ? viceVersionOf(vice.version ?? "") : undefined;
  const flaws = version === undefined ? [] : viceFlaws(version);
  if (flaws.length > 0) checked[0] = { ...vice, flaws };
  return { result: { tools: checked } };
}
