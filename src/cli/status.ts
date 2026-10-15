// The status report of the CLI: the tools on this machine and the Host
// Runtime with its tools.

import { hostTools, type ToolCallOptions } from "../host-client/tools.ts";
import { STOP_AND_ASK } from "../protocol/messages.ts";
import type { ToolStatus } from "../protocol/tools.ts";

/** One line per tool under `heading`: its version, or why it does not run; then each known flaw of it. */
export function toolLines(heading: string, tools: readonly ToolStatus[]): string[] {
  return [
    heading,
    ...tools.flatMap((tool) => [
      tool.runs
        ? `  ${tool.name}: ${tool.version} (${tool.path})`
        : tool.found
          ? `  ${tool.name}: found at ${tool.path} but it does not run. ${tool.problem}`
          : `  ${tool.name}: missing. ${tool.problem}`,
      ...(tool.flaws ?? []).map((flaw) => `    Known flaw: ${flaw}`),
    ]),
  ];
}

/**
 * Whether the Host Runtime answers, and the tools it has. VICE and its tools
 * live on the host; it finds and runs each one. One request shows both that
 * the host answers and what it has. `ready` is true when the host answers and
 * every tool on it runs.
 */
export async function hostStatusLines(options: ToolCallOptions = {}): Promise<{ lines: string[]; ready: boolean }> {
  let tools: ToolStatus[];
  try {
    tools = await hostTools(options);
  } catch (error) {
    // status is read by a person: the instruction for an agent (D37) stays out.
    return { lines: [`Host Runtime: not reachable. ${(error as Error).message.replace(` ${STOP_AND_ASK}`, "")}`], ready: false };
  }
  return { lines: ["Host Runtime: reachable", ...toolLines("Tools on the host:", tools)], ready: tools.every((tool) => tool.runs) };
}
