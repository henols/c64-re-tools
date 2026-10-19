// Tidying that AP SDK leaves to its caller:
// - A project install must not change the home directory. AP SDK writes the
//   Windsurf MCP declaration to ~/.codeium/windsurf/mcp_config.json even in
//   project scope, and records it in the project manifest, so a project
//   uninstall would also remove a declaration that a global install made.
// - AP SDK's uninstall deletes the installed files but leaves their
//   directories, and leaves each MCP configuration file with an empty server
//   list. Only empty directories and files with nothing else in them go.

import { FAMILIES } from "../machine.ts";
import { existsSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const PLUGIN_ID = "c64-re-tools";

export type Scope = "project" | "global";

export interface InstallItem {
  harness: string;
  kind: string;
  name: string;
  files: string[];
  detail?: { mergeKey?: string; names?: string[] };
}

interface Manifest {
  version: number;
  plugins: Record<string, { items: InstallItem[] } & Record<string, unknown>>;
}

/** The directory that the manifest and relative item paths belong to. */
export function scopeRoot(scope: Scope, cwd = process.cwd()): string {
  return scope === "global" ? homedir() : cwd;
}

function manifestPath(scope: Scope, cwd = process.cwd()): string {
  return join(scopeRoot(scope, cwd), ".ap-sdk", "install-manifest.json");
}

function readManifest(path: string): Manifest | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Manifest;
  } catch {
    return undefined;
  }
}

/** The recorded items of this plugin, for the given harnesses (all when undefined). */
export function installedItems(scope: Scope, targets: readonly string[] | undefined, cwd = process.cwd()): InstallItem[] {
  const items = readManifest(manifestPath(scope, cwd))?.plugins[PLUGIN_ID]?.items ?? [];
  return targets === undefined ? items : items.filter((item) => targets.includes(item.harness));
}

/** The harnesses of a --target value; undefined means all of them. */
export function parseTargets(value: string | undefined): string[] | undefined {
  return value === undefined ? undefined : value.split(",").map((target) => target.trim()).filter((target) => target !== "");
}

const WINDSURF_MCP = () => join(homedir(), ".codeium", "windsurf", "mcp_config.json");
const WINDSURF_KEY = "mcpServers";

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** What the Windsurf configuration held before an install, to put it back after a project install. */
export interface WindsurfBefore {
  /** The file's bytes, or undefined when the file did not exist. */
  bytes: Buffer | undefined;
  hadServer: boolean;
}

export function windsurfBefore(): WindsurfBefore {
  const path = WINDSURF_MCP();
  const servers = readJson(path)?.[WINDSURF_KEY] as Record<string, unknown> | undefined;
  let bytes: Buffer | undefined;
  try {
    bytes = readFileSync(path);
  } catch {
    bytes = undefined;
  }
  return { bytes, hadServer: servers !== undefined && FAMILIES.some((family) => family in servers) };
}

/**
 * After a project install for Windsurf: puts the home configuration back as
 * it was, and removes the Windsurf MCP item from the project manifest.
 * Returns a note for the user, or undefined when Windsurf was not a target.
 */
export function undoWindsurfProjectMcp(before: WindsurfBefore, cwd = process.cwd()): string | undefined {
  const manifestFile = manifestPath("project", cwd);
  const manifest = readManifest(manifestFile);
  const entry = manifest?.plugins[PLUGIN_ID];
  const item = entry?.items.find((candidate) => candidate.harness === "windsurf" && candidate.kind === "mcp" && candidate.files.length > 0);
  if (manifest === undefined || entry === undefined || item === undefined) return undefined;

  const path = WINDSURF_MCP();
  if (before.bytes !== undefined) {
    // The file existed: its bytes go back unchanged.
    if (!existsSync(path) || !readFileSync(path).equals(before.bytes)) writeFileSync(path, before.bytes);
  } else {
    // The install made the file: it goes when it holds only this declaration.
    const root = readJson(path);
    const servers = root?.[WINDSURF_KEY] as Record<string, unknown> | undefined;
    if (root !== undefined && servers !== undefined) {
      for (const family of FAMILIES) delete servers[family];
      if (isEmptyConfig(root, WINDSURF_KEY)) {
        unlinkSync(path);
        removeEmptyDirectories(dirname(path), homedir());
      } else {
        writeFileSync(path, `${JSON.stringify(root, null, 2)}\n`);
      }
    }
  }
  entry.items = entry.items.filter((candidate) => candidate !== item);
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return before.hadServer
    ? "Windsurf reads MCP servers only from your home directory. Its c64-re-tools declaration from a global install stays as it is."
    : "Windsurf reads MCP servers only from your home directory, so this project install did not declare the MCP for Windsurf. To declare it, run: c64-re-tools install --global --target windsurf";
}

/** A configuration that holds nothing but an empty server list (and perhaps a $schema). */
function isEmptyConfig(root: Record<string, unknown>, mergeKey: string): boolean {
  const bucket = root[mergeKey];
  if (typeof bucket !== "object" || bucket === null || Object.keys(bucket).length > 0) return false;
  return Object.keys(root).every((key) => key === mergeKey || key === "$schema");
}

/** True when `path` is `root` itself or inside it. */
function isWithin(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel.split(sep)[0] !== "..";
}

/** Removes `directory` and its parents while they are empty, up to `stop` (never `stop` itself or anything outside it). */
export function removeEmptyDirectories(directory: string, stop: string): void {
  let current = resolve(directory);
  const limit = resolve(stop);
  while (current !== limit) {
    if (relative(limit, current) === "" || !isWithin(limit, current)) return;
    try {
      rmdirSync(current);
    } catch {
      return; // not empty, or gone
    }
    current = dirname(current);
  }
}

/**
 * After an uninstall: deletes MCP configuration files that hold nothing but
 * an empty server list, then the directories that the items left empty.
 */
export function tidyAfterUninstall(items: readonly InstallItem[], scope: Scope, cwd = process.cwd()): void {
  const root = scopeRoot(scope, cwd);
  const absolute = (file: string) => (isAbsolute(file) ? file : resolve(root, file));
  for (const item of items) {
    if (item.kind !== "mcp" || item.detail?.mergeKey === undefined) continue;
    for (const file of item.files.map(absolute)) {
      const config = existsSync(file) ? readJson(file) : undefined;
      if (config !== undefined && isEmptyConfig(config, item.detail.mergeKey)) unlinkSync(file);
    }
  }
  const directories = new Set<string>([dirname(manifestPath(scope, cwd))]);
  for (const item of items) for (const file of item.files) directories.add(dirname(absolute(file)));
  // Deepest first, so a parent is tried after its children.
  for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
    // Each file's own home: the scope root, or the home directory for a file outside it.
    const stop = isWithin(root, directory) ? root : homedir();
    removeEmptyDirectories(directory, stop);
  }
}

/**
 * After an install or update: deletes the files of the items that the
 * earlier install made and this one no longer has, for example a skill that
 * a version renamed, then the directories that they leave empty. Only the
 * harnesses that this install wrote count, and an MCP item never goes: its
 * file holds other servers too. A file that this install also wrote stays.
 * Returns the names of the removed items.
 */
export function removeDroppedItems(before: readonly InstallItem[], scope: Scope, cwd = process.cwd()): string[] {
  const root = scopeRoot(scope, cwd);
  const absolute = (file: string) => (isAbsolute(file) ? file : resolve(root, file));
  const after = installedItems(scope, undefined, cwd);
  const key = (item: InstallItem) => `${item.harness}/${item.kind}/${item.name}`;
  const kept = new Set(after.map(key));
  const harnesses = new Set(after.map((item) => item.harness));
  const keptFiles = new Set(after.flatMap((item) => item.files.map(absolute)));
  const dropped = before.filter((item) => item.kind !== "mcp" && harnesses.has(item.harness) && !kept.has(key(item)));
  const directories = new Set<string>();
  for (const item of dropped) {
    for (const file of item.files.map(absolute)) {
      if (keptFiles.has(file) || !isWithin(root, file)) continue;
      if (existsSync(file)) unlinkSync(file);
      directories.add(dirname(file));
    }
  }
  // Deepest first, so a parent is tried after its children.
  for (const directory of [...directories].sort((a, b) => b.length - a.length)) removeEmptyDirectories(directory, root);
  return [...new Set(dropped.map((item) => item.name))];
}

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

/** AP SDK's report without its Windsurf MCP line and that line's detail, for when the CLI undid that item. */
export function withoutWindsurfMcp(output: string): string {
  const lines = output.split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*\S+\s+windsurf\s+mcp\s/.test(lines[index]!.replace(ANSI, ""))) {
      if (lines[index + 1]?.replace(ANSI, "").trim().startsWith("\u21b3")) index++;
      continue;
    }
    kept.push(lines[index]!);
  }
  return kept.join("\n");
}
