// The npm package and the VICE MCP declaration that starts it. This module
// only reads package.json, so a caller that needs the declaration does not
// build the plugin.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The name and version of this npm package, from its package.json. */
export const PACKAGE = (() => {
  const metadata = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { name: string; version: string };
  return { name: metadata.name, version: metadata.version };
})();

/**
 * The agent starts the MCP server through npx with the latest published
 * version, so it updates itself; nothing is linked or installed globally.
 * The entry point is TypeScript, run by tsx: Node does not strip types under
 * node_modules.
 */
export function mcpServerFor(platform: NodeJS.Platform): { command: string; args: string[] } {
  const npx = ["-y", `--package=${PACKAGE.name}@latest`, "c64-re-tools-mcp"];
  // On native Windows npx is a .cmd shim, which a harness starts only through cmd /c.
  return platform === "win32" ? { command: "cmd", args: ["/c", "npx", ...npx] } : { command: "npx", args: npx };
}

/** The declaration for the machine where install runs: the plugin is evaluated there. */
export const MCP_SERVER = mcpServerFor(process.platform);
