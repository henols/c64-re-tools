// host.status: VICE and the tools that come with it, each found the way its
// operations find it and run once with a version option. A tool from a
// VICE older than MIN_VICE is reported as not working, as its operations refuse it.

import type { ToolStatus } from "../../protocol.ts";
import { C1541, findTool, isOlderThanMinimum, MIN_VICE, PETCAT, VICE, viceVersionOf, type ToolSpec } from "../../native/discover.ts";
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

export async function hostStatus(context: ToolContext): Promise<{ result: { tools: ToolStatus[] } }> {
  const specs = [VICE, C1541, PETCAT];
  const tools = await probeTools(
    [
      { name: VICE.name, find: findVice, args: ["-version"], pattern: /^x64sc \(VICE \d/ },
      { name: C1541.name, find: (env) => findTool(C1541, env), args: ["-version"], pattern: /^c1541 \(VICE \d/ },
      { name: PETCAT.name, find: (env) => findTool(PETCAT, env), args: ["-version"], pattern: /^petcat \(VICE \d/ },
    ],
    context,
  );
  return { result: { tools: tools.map((status, index) => requireMinimum(status, specs[index]!)) } };
}
