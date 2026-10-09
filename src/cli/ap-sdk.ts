// Runs the AP SDK CLI of this package's own dependency as a bounded native
// run: its own process group, a time limit, and the whole group stopped when
// the limit ends or the CLI stops.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runToolOrFail, type ToolContext } from "../native/run.ts";
import { WireFailure } from "../protocol.ts";

/** How long one AP SDK install, update or uninstall may take. */
export const AP_SDK_TIMEOUT_MS = 120_000;

const PLUGIN = fileURLToPath(new URL("../../distribution/plugin.ts", import.meta.url));

export interface ApSdkRun {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs `ap-sdk <command> <plugin or id> <flags>`. Returns its exit status and
 * what it printed. Throws WireFailure(operation-failed) with the name AP SDK
 * when it does not start, stops on a signal, does not finish within the time
 * limit, or the run is cancelled.
 */
export async function runApSdk(
  command: "install" | "uninstall",
  flags: readonly string[],
  context: ToolContext,
  options: { cli?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<ApSdkRun> {
  const cli = options.cli ?? join(dirname(fileURLToPath(import.meta.resolve("@jalco/ap-sdk"))), "cli.js");
  // execArgv keeps the TypeScript loader (tsx) for the plugin module under node_modules.
  const argv = [process.execPath, ...process.execArgv, cli, command, command === "uninstall" ? "c64-re-tools" : PLUGIN, ...flags];
  const run = await runToolOrFail("AP SDK", "The AP SDK run", { argv, cwd: process.cwd(), timeoutMs: options.timeoutMs ?? AP_SDK_TIMEOUT_MS }, {
    ...context,
    env: options.env ?? context.env,
  });
  if (run.code === null) throw new WireFailure("operation-failed", run.signal === null ? "AP SDK did not start." : `AP SDK stopped on signal ${run.signal}.`);
  return { code: run.code, stdout: run.stdout, stderr: run.stderr };
}
