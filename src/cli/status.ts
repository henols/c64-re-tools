// The status report of the CLI: the installed skills and MCP declarations,
// the tools on this machine and the Host Runtime with its tools.

import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { installedItems, scopeRoot, type InstallItem, type Scope } from "./cleanup.ts";
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
    // status is read by a person: the instruction for an agent stays out.
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

/**
 * The skills and MCP declarations that install wrote for this project and
 * globally: the c64-re-tools version of each harness's skills,
 * from their package.json, and the command that starts the MCP server. A
 * warning names skills of another version than this one.
 */
export function installedLines(cwd = process.cwd()): string[] {
  const lines: string[] = [];
  for (const scope of ["project", "global"] as const satisfies readonly Scope[]) {
    const items = installedItems(scope, undefined, cwd);
    if (items.length === 0) continue;
    const root = scopeRoot(scope, cwd);
    lines.push(`Installed ${scope === "project" ? `in this project (${root})` : "globally"}:`);
    for (const harness of [...new Set(items.map((item) => item.harness))]) {
      const skills = items.filter((item) => item.harness === harness && item.kind === "skill");
      const versions = [...new Set(skills.map((item) => skillVersion(item, root)).filter((version) => version !== undefined))];
      if (skills.length > 0) {
        lines.push(`  ${harness}: ${skills.length} skills, c64-re-tools ${versions.length === 0 ? "of an unknown version" : versions.join(" and ")}`);
        const other = versions.filter((version) => version !== PACKAGE.version);
        if (other.length > 0) lines.push(`  Warning: the ${harness} skills are c64-re-tools ${other.join(" and ")} and this is ${PACKAGE.version}. Run npx -y ${PACKAGE.name}@${PACKAGE.tag} update${scope === "global" ? " --global" : ""} to install this version.`);
      }
      for (const item of items.filter((candidate) => candidate.harness === harness && candidate.kind === "mcp")) {
        lines.push(`  ${harness} MCP server: ${mcpCommand(item, root) ?? `declared in ${item.files.join(", ")}`}`);
      }
    }
  }
  if (lines.length === 0) return ["Installed: nothing in this project or globally."];
  lines.push("  The MCP server gives its own version in the result of c64_status.");
  return lines;
}

function itemPath(file: string, root: string): string {
  return isAbsolute(file) ? file : join(root, file);
}

/** The version in the package.json of an installed skill; a skill without scripts has none. */
function skillVersion(item: InstallItem, root: string): string | undefined {
  const file = item.files.find((candidate) => candidate.endsWith("/package.json") || candidate.endsWith("\\package.json"));
  if (file === undefined) return undefined;
  try {
    const { version } = JSON.parse(readFileSync(itemPath(file, root), "utf8")) as { version?: unknown };
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

/** The command of the MCP server in a JSON configuration file, or undefined for another format. */
function mcpCommand(item: InstallItem, root: string): string | undefined {
  const key = item.detail?.mergeKey;
  const [file] = item.files;
  if (key === undefined || file === undefined) return undefined;
  try {
    const servers = (JSON.parse(readFileSync(itemPath(file, root), "utf8")) as Record<string, unknown>)[key] as Record<string, { command?: unknown; args?: unknown }> | undefined;
    const server = servers?.[item.name];
    if (typeof server?.command !== "string") return undefined;
    const args = Array.isArray(server.args) ? server.args.filter((arg): arg is string => typeof arg === "string") : [];
    return [server.command, ...args].join(" ");
  } catch {
    return undefined;
  }
}
