// The status report of the CLI: the tools on this machine and the Host
// Runtime with its tools.

import { hostTools, type ToolCallOptions } from "../host-client/tools.ts";
import { viceVersionOf } from "../native/discover.ts";
import { PACKAGE } from "../package.ts";
import { STOP_AND_ASK } from "../protocol/messages.ts";
import type { HostInfo, ToolStatus } from "../protocol/tools.ts";

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
  let host: HostInfo;
  let tools: ToolStatus[];
  try {
    ({ host, tools } = await hostTools(options));
  } catch (error) {
    // status is read by a person: the instruction for an agent (D37) stays out.
    return { lines: [`Host Runtime: not reachable. ${(error as Error).message.replace(` ${STOP_AND_ASK}`, "")}`], ready: false };
  }
  const mixed = mixedViceBuilds(tools);
  return {
    lines: [
      `Host Runtime: reachable, c64-re-tools ${host.version} on ${host.platform} ${host.release} (${host.arch})`,
      ...(host.version === PACKAGE.version ? [] : [`  Warning: the Host Runtime is c64-re-tools ${host.version} and this is ${PACKAGE.version}. Start the host again so that both are the same version.`]),
      ...toolLines("Tools on the host:", tools),
      ...(mixed === undefined ? [] : [`  Warning: ${mixed}`]),
    ],
    ready: tools.every((tool) => tool.runs),
  };
}

/** A warning when x64sc, c1541 and petcat that run come from different VICE versions or builds. */
export function mixedViceBuilds(tools: readonly ToolStatus[]): string | undefined {
  const running = tools.filter((tool) => tool.runs && tool.version !== undefined);
  const builds = running.map((tool) => {
    const version = viceVersionOf(tool.version!);
    return version === undefined ? tool.version! : `VICE ${version.major}.${version.minor}${version.revision === undefined ? "" : ` SVN r${version.revision}`}`;
  });
  if (new Set(builds).size <= 1) return undefined;
  return `the VICE tools come from different VICE builds: ${running.map((tool) => `${tool.version} (${tool.path})`).join(", ")}. Put x64sc, c1541 and petcat of one VICE first on PATH, or set C64RT_VICE, C64RT_C1541 and C64RT_PETCAT.`;
}
