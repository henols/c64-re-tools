// The project (D67): the nearest folder at or above the working directory that
// holds .c64-re-tools/, below the home folder, the way git finds .git. A skill
// script names it with --project <folder> and an MCP tool with `project`. Every
// project path is relative to that folder (D68).

import { readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** The folder that marks a project and holds its knowledge. */
export const PROJECT_DIRECTORY = ".c64-re-tools";

/** How deep a working directory without a project is searched for projects below it. */
const SEARCH_DEPTH = 3;

/** At most this many projects are named in a refusal. */
const LISTED_PROJECTS = 20;

/** A refusal of the project rules, with a stable code, shown to the LLM unchanged. */
export class ProjectError extends Error {
  override name = "ProjectError";
  readonly code: "invalid-input" | "not-found";

  constructor(code: "invalid-input" | "not-found", message: string) {
    super(message);
    this.code = code;
  }
}

/** How a refusal tells the caller to name a project: "--project <folder>" for a script, "project" for an MCP tool. */
export interface ProjectRemedy {
  remedy?: string;
}

const SCRIPT_REMEDY = "Give --project <folder>";

/** The folder that --project chose for this process, or undefined. */
let chosen: string | undefined;

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
 * The project of the working directory `cwd` by the D67 rules: the nearest
 * folder at or above it with .c64-re-tools/, below the home folder. Without
 * one, `cwd` itself, unless projects are below it or it is the home folder:
 * then a ProjectError names them and the remedy, so no write lands outside a
 * project.
 */
export function findProject(cwd: string = process.cwd(), options: ProjectRemedy = {}): string {
  const start = resolve(cwd);
  const remedy = options.remedy ?? SCRIPT_REMEDY;
  for (const folder of foldersUpFrom(start)) {
    if (isProject(folder)) return folder;
  }
  if (start === homedir()) {
    throw new ProjectError("invalid-input", `The home folder is not a project folder. Start in a project folder, or ${remedy.charAt(0).toLowerCase()}${remedy.slice(1)}.`);
  }
  const below = projectsBelow(start);
  if (below.length > 0) {
    throw new ProjectError("invalid-input", `${start} is not a project folder. These folders below it are projects: ${listed(below)}. ${remedy} with one of them.`);
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
  if (folder.length === 0) throw new ProjectError("invalid-input", "The project folder must not be empty.");
  const path = resolve(cwd, folder);
  const stat = statSync(path, { throwIfNoEntry: false });
  if (stat === undefined) throw new ProjectError("not-found", `There is no folder ${folder}.`);
  if (!stat.isDirectory()) throw new ProjectError("invalid-input", `${folder} is not a folder.`);
  if (path === homedir()) throw new ProjectError("invalid-input", "The home folder is not a project folder.");
  const outer = foldersUpFrom(path).slice(1).find(isProject);
  if (outer !== undefined) {
    throw new ProjectError("invalid-input", `${folder} is inside the project ${relative(cwd, outer) || "."}. Give that project folder.`);
  }
  return path;
}

/** The project of an MCP call or another caller without process state: `folder` when given, else the D67 lookup from `cwd`. */
export function resolveProject(folder: string | undefined, cwd: string = process.cwd(), options: ProjectRemedy = {}): string {
  return folder === undefined ? findProject(cwd, options) : namedProject(folder, cwd);
}

/** Sets the project of this process from --project. Throws ProjectError for a folder that the rules refuse. */
export function useProject(folder: string): void {
  chosen = namedProject(folder);
}

/** The project folder of this process: the --project choice, else the D67 lookup from the working directory. */
export function projectRoot(): string {
  return chosen ?? findProject();
}

export function resolveProjectPath(path: string, root = projectRoot()): string {
  if (path.length === 0) {
    throw new TypeError("Project path must not be empty");
  }
  if (isAbsolute(path)) {
    throw new TypeError("Project path must be relative");
  }

  const candidate = resolve(root, path);
  if (isInside(root, candidate)) return candidate;
  throw new TypeError("Project path escapes the project root");
}

/** True when `candidate` is `root` or below it. Both are absolute paths. */
export function isInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot === "" || (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot));
}

/**
 * Resolves a project-relative path to an existing file system entry whose real
 * location is inside the project too, so a symbolic link cannot reach outside
 * it. Throws TypeError for a refused path; lets ENOENT through.
 */
export function resolveProjectFile(path: string, root = projectRoot()): string {
  const candidate = resolveProjectPath(path, root);
  const real = realpathSync(candidate);
  if (!isInside(realpathSync(root), real)) {
    throw new TypeError("Project path escapes the project root through a symbolic link");
  }
  return real;
}
