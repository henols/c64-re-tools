// The npm package and the VICE MCP declaration that starts it. This module
// only reads package.json, so a caller that needs the declaration does not
// build the plugin.

import { FAMILIES, type Family } from "../src/machine.ts";
import { PACKAGE } from "../src/package.ts";

/**
 * The agent starts the MCP server through npx with the newest version of the
 * channel it was installed from, so it updates itself and an install from a
 * prerelease does not start a release; nothing is linked or installed globally.
 * The entry point is TypeScript, run by tsx: Node does not strip types under
 * node_modules.
 */
export function mcpServerFor(platform: NodeJS.Platform, family: Family = "c64"): { command: string; args: string[] } {
  const npx = ["-y", `--package=${PACKAGE.name}@${PACKAGE.tag}`, "c64-re-tools-mcp", "--machine", family];
  // On native Windows npx is a .cmd shim, which a harness starts only through cmd /c.
  return platform === "win32" ? { command: "cmd", args: ["/c", "npx", ...npx] } : { command: "npx", args: npx };
}

/**
 * The MCP servers that an install declares: one per machine family, named
 * after it. C64RT_MACHINES (comma-separated families, set by install
 * --machines) chooses them; the C64 without it. The plugin is evaluated on the
 * machine where install runs.
 */
export function mcpServers(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): Record<string, { command: string; args: string[] }> {
  const chosen = (env.C64RT_MACHINES ?? "c64").split(",").filter((family): family is Family => (FAMILIES as readonly string[]).includes(family));
  return Object.fromEntries((chosen.length === 0 ? (["c64"] as Family[]) : chosen).map((family) => [family, mcpServerFor(platform, family)]));
}
