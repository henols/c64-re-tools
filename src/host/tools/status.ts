// host.status: VICE and the tools that come with it, each found the way its
// operations find it and run once with a version option (D14).

import type { ToolStatus } from "../../protocol.ts";
import { C1541, findTool, PETCAT } from "../../native/discover.ts";
import type { ToolContext } from "../../native/run.ts";
import { probeTools } from "../../native/status.ts";
import { findVice } from "../vice/process.ts";

export async function hostStatus(context: ToolContext): Promise<{ result: { tools: ToolStatus[] } }> {
  const tools = await probeTools(
    [
      { name: "VICE (x64sc)", find: findVice, args: ["-version"], pattern: /^x64sc \(VICE \d/ },
      { name: "c1541", find: (env) => findTool(C1541, env), args: ["-version"], pattern: /^c1541 \(VICE \d/ },
      { name: "petcat", find: (env) => findTool(PETCAT, env), args: ["-version"], pattern: /^petcat \(VICE \d/ },
    ],
    context,
  );
  return { result: { tools } };
}
