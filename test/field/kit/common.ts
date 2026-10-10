// Shared by the field kit's install and bundle scripts. The kit imports
// nothing from src/: a git clone of the release tag is all it needs, also
// inside a container where the c64-re-tools checkout does not exist.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export const PACKAGE_NAME = "@henols/c64-re-tools";
export const RUN_FILE = "field-test/run.json";

/** What install.ts records for bundle.ts and report.ts. */
export interface FieldRun {
  project: string;
  /** The npx package spec: a registry spec such as @henols/c64-re-tools@next, or a tarball path. */
  spec: string;
  /** The version that the spec named at install time, when it could be found. */
  version?: string;
  traceDir: string;
  /** The commit of the kit, when it runs from a git clone. */
  kitCommit?: string;
  inContainer: boolean;
  platform: NodeJS.Platform;
  node: string;
  createdAt: string;
}

const CET_OFFSET_MS = 60 * 60 * 1000;

/** ISO 8601 at the fixed CET offset +01:00, as c64-re-tools writes every time. */
export function isoCet(time: Date = new Date()): string {
  return `${new Date(time.getTime() + CET_OFFSET_MS).toISOString().slice(0, -1)}+01:00`;
}

/** The CET time to the second, for a file name, with no colon. */
export function fileStampCet(time: Date = new Date()): string {
  return isoCet(time).slice(0, 19).replace(/:/g, "-");
}

/** True when this process runs in a Docker or Podman container, or a dev container. */
export function inContainer(env: NodeJS.ProcessEnv = process.env): boolean {
  return existsSync("/.dockerenv") || existsSync("/run/.containerenv") || env.REMOTE_CONTAINERS === "true" || env.CODESPACES === "true" || env.DEVCONTAINER === "true";
}

/** Runs a program and returns its output; npx and npm need a shell on Windows. */
export function run(command: string, args: string[], options: { cwd?: string; inherit?: boolean; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: process.platform === "win32" && (command === "npx" || command === "npm"),
    stdio: options.inherit === true ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout: options.timeoutMs,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? (result.error?.message ?? "") };
}
