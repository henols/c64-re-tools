// The project: the nearest folder at or above the working directory that
// holds .c64-re-tools/, below the home folder, the way git finds .git. A skill
// script names it with --project <folder> and an MCP tool with `project`. Every
// project path is relative to that folder. .c64-re-tools/local/ holds what
// the agent saves for itself and ignores itself in git.

import { Refusal } from "./errors.ts";
import { existsSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** The folder that marks a project and holds its knowledge. */
export const PROJECT_DIRECTORY = ".c64-re-tools";

/** The folder for machine-local scratch: saved results, batches and step files. */
export const LOCAL_DIRECTORY = "local";

/** The .gitignore of LOCAL_DIRECTORY: git ignores everything in it, the .gitignore too. */
const LOCAL_GITIGNORE = "# Machine-local scratch of c64-re-tools (saved results, batches, step files). Never committed.\n*\n";

/** How deep a working directory without a project is searched for projects below it. */
const SEARCH_DEPTH = 3;

/** At most this many projects are named in a refusal. */
const LISTED_PROJECTS = 20;

/** How a refusal tells the caller to name a project: "--project <folder>" for a script, "project" for an MCP tool. */
export interface ProjectRemedy {
  remedy?: string;
}

const SCRIPT_REMEDY = "Give --project <folder>";

/** The folder that --project chose for this process, or undefined. */
let chosen: string | undefined;

/** The project that the project lookup found from a working directory, kept for the next call from the same directory. */
let found: { cwd: string; root: string } | undefined;

function isProject(folder: string): boolean {
  return statSync(join(folder, PROJECT_DIRECTORY), { throwIfNoEntry: false })?.isDirectory() === true;
}

/** `start` and each folder above it, nearest first, below the home folder when `start` is under it. */
function foldersUpFrom(start: string): string[] {
  const home = homedir();
  const underHome = start !== home && isInside(home, start);
  if (start === home) return [];
  const folders: string[] = [];
  for (let folder = start; ; folder = dirname(folder)) {
    if (underHome && folder === home) break;
    folders.push(folder);
    if (dirname(folder) === folder) break;
  }
  return folders;
}

/** The projects below `start` to SEARCH_DEPTH, relative to it and sorted. Dot folders and node_modules are skipped. */
function projectsBelow(start: string): string[] {
  const found: string[] = [];
  const visit = (folder: string, depth: number) => {
    let entries;
    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(folder, entry.name);
      if (isProject(path)) found.push(relative(start, path));
      else if (depth < SEARCH_DEPTH) visit(path, depth + 1);
    }
  };
  visit(start, 1);
  return found.sort();
}

function listed(projects: readonly string[]): string {
  const shown = projects.slice(0, LISTED_PROJECTS).join(", ");
  return projects.length > LISTED_PROJECTS ? `${shown} and ${projects.length - LISTED_PROJECTS} more` : shown;
}

/**
 * The project of the working directory `cwd` by the project rules: the nearest
 * folder at or above it with .c64-re-tools/, below the home folder. Without
 * one, `cwd` itself, unless projects are below it or it is the home folder:
 * then a Refusal names them and the remedy, so no write lands outside a
 * project.
 */
export function findProject(cwd: string = process.cwd(), options: ProjectRemedy = {}): string {
  const start = resolve(cwd);
  const remedy = options.remedy ?? SCRIPT_REMEDY;
  for (const folder of foldersUpFrom(start)) {
    if (isProject(folder)) return folder;
  }
  if (start === homedir()) {
    throw new Refusal("invalid-input", `The home folder is not a project folder. Start in a project folder, or ${remedy.charAt(0).toLowerCase()}${remedy.slice(1)}.`);
  }
  const below = projectsBelow(start);
  if (below.length > 0) {
    throw new Refusal("invalid-input", `${start} is not a project folder. These folders below it are projects: ${listed(below)}. ${remedy} with one of them.`);
  }
  return start;
}

/**
 * The project folder that `folder` names, relative to `cwd` or absolute. It
 * must be a folder. It is the project as given, also without .c64-re-tools/
 * (the first write makes it), but not a folder inside another project or the
 * home folder.
 */
export function namedProject(folder: string, cwd: string = process.cwd()): string {
  if (folder.length === 0) throw new Refusal("invalid-input", "The project folder must not be empty.");
  const path = resolve(cwd, folder);
  const stat = statSync(path, { throwIfNoEntry: false });
  if (stat === undefined) throw new Refusal("not-found", `There is no folder ${folder}.`);
  if (!stat.isDirectory()) throw new Refusal("invalid-input", `${folder} is not a folder.`);
  if (path === homedir()) throw new Refusal("invalid-input", "The home folder is not a project folder.");
  // A project inside another project is a project of its own, as the lookup from a working directory in it finds.
  const outer = isProject(path) ? undefined : foldersUpFrom(path).slice(1).find(isProject);
  if (outer !== undefined) {
    throw new Refusal("invalid-input", `${folder} is inside the project ${relative(cwd, outer) || outer}. Give that project folder.`);
  }
  return path;
}

/**
 * Makes .c64-re-tools/local/ with its .gitignore when the project has
 * .c64-re-tools/ and local/ has no .gitignore yet. A folder that is not
 * yet a project gets nothing. A failure (for example a read-only project) is
 * left to the write into local/ that needs the folder.
 */
export function ensureLocal(root: string): void {
  const local = join(root, PROJECT_DIRECTORY, LOCAL_DIRECTORY);
  const gitignore = join(local, ".gitignore");
  if (existsSync(gitignore) || !isProject(root)) return;
  try {
    mkdirSync(local, { recursive: true });
    writeFileSync(gitignore, LOCAL_GITIGNORE, { flag: "wx" });
  } catch {
    // Another process made it, or the project is read-only.
  }
}

/** The project of an MCP call or another caller without process state: `folder` when given, else the project lookup from `cwd`. */
export function resolveProject(folder: string | undefined, cwd: string = process.cwd(), options: ProjectRemedy = {}): string {
  const root = folder === undefined ? findProject(cwd, options) : namedProject(folder, cwd);
  ensureLocal(root);
  return root;
}

/** Sets the project of this process from --project. Refuses a folder that the rules refuse. */
export function useProject(folder: string): void {
  chosen = namedProject(folder);
}

/** The project folder of this process: the --project choice, else the project lookup from the working directory. */
export function projectRoot(): string {
  let root = chosen;
  if (root === undefined) {
    const cwd = process.cwd();
    if (found?.cwd !== cwd) found = { cwd, root: findProject(cwd) };
    root = found.root;
  }
  // Each call: the first write of a process can make .c64-re-tools/ after the lookup.
  ensureLocal(root);
  return root;
}

export function resolveProjectPath(path: string, root = projectRoot()): string {
  if (path.length === 0) {
    throw new Refusal("invalid-input", "A project path must not be empty.");
  }
  if (isAbsolute(path)) {
    throw new Refusal("invalid-input", `${path} is not relative: give a path relative to the project folder.`);
  }

  const candidate = resolve(root, path);
  if (isInside(root, candidate)) return candidate;
  throw new Refusal("invalid-input", `${path} leads out of the project folder: give a path that stays inside it.`);
}

/** A project path in one spelling: relative to the project folder, with / and without ./, .. or a double /. Refuses a path as resolveProjectPath does. */
export function projectRelative(path: string, root = projectRoot()): string {
  return relative(root, resolveProjectPath(path, root)).split(sep).join("/");
}

/** True when `candidate` is `root` or below it. Both are absolute paths. */
export function isInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot === "" || (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot));
}

/**
 * Resolves a project-relative path to an existing file system entry whose real
 * location is inside the project too, so a symbolic link cannot reach outside
 * it. Refuses a path that leads out; lets ENOENT through.
 */
export function resolveProjectFile(path: string, root = projectRoot()): string {
  const candidate = resolveProjectPath(path, root);
  const real = realpathSync(candidate);
  if (!isInside(realpathSync(root), real)) {
    throw new Refusal("invalid-input", `${path} leads out of the project folder through a symbolic link.`);
  }
  return real;
}
