// The status report of the CLI: the tools on this machine and the Host
// Runtime with its tools.

import { hostTools, type ToolCallOptions } from "../host-client/tools.ts";
import type { ToolStatus } from "../protocol.ts";

/** One line per tool under `heading`: its version, or why it does not run. */
export function toolLines(heading: string, tools: readonly ToolStatus[]): string[] {
  return [
    heading,
    ...tools.map((tool) =>
      tool.runs
        ? `  ${tool.name}: ${tool.version} (${tool.path})`
        : tool.found
          ? `  ${tool.name}: found at ${tool.path} but it does not run. ${tool.problem}`
          : `  ${tool.name}: missing. ${tool.problem}`,
    ),
  ];
}

/**
 * Whether the Host Runtime answers, and the tools it has. VICE and its tools
 * live on the host; it finds and runs each one. One request shows both that
 * the host answers and what it has.
 */
export async function hostStatusLines(options: ToolCallOptions = {}): Promise<string[]> {
  let tools: ToolStatus[];
  try {
    tools = await hostTools(options);
  } catch (error) {
    return [`Host Runtime: not reachable. ${(error as Error).message}`];
  }
  return ["Host Runtime: reachable", ...toolLines("Tools on the host:", tools)];
}
