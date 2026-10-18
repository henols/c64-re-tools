// The project: the nearest folder at or above the working directory that
// holds .c64-re-tools/, below the home folder, the way git finds .git. A skill
// script names it with --project <folder> and an MCP tool with `project`. Every
// project path is relative to that folder. .c64-re-tools/local/ holds what
// the agent saves for itself and ignores itself in git.

import { Refusal } from "./errors.ts";
import { accessSync, constants, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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

/** True when `folder` holds .c64-re-tools/. A folder that cannot be read (no permission) is not a project. */
function isProject(folder: string): boolean {
  try {
    return statSync(join(folder, PROJECT_DIRECTORY), { throwIfNoEntry: false })?.isDirectory() === true;
  } catch {
    return false;
  }
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
 * The folder of a new project that `folder` names, relative to the project
 * `currentRoot` or absolute, and the zip file beside it (`<folder>.zip`). The
 * folder must not exist or be empty. It must be outside the current project
 * and must not hold it, and no folder above it is a project: then the new
 * project is a project of its own.
 */
export function newProjectFolder(folder: string, currentRoot: string): { root: string; zip: string } {
  if (folder.length === 0) throw new Refusal("invalid-input", "The folder of the new project must not be empty.");
  const root = resolve(currentRoot, folder);
  const zip = `${root}.zip`;
  if (dirname(root) === root) throw new Refusal("invalid-input", `${folder} is the root of a file system. Give a folder for the new project.`);
  if (root === homedir()) throw new Refusal("invalid-input", "The home folder cannot be the folder of a new project.");
  if (isInside(currentRoot, root)) throw new Refusal("invalid-input", `${folder} is inside the project ${currentRoot}. Give a folder outside it, for example ../${basename(root)}.`);
  if (isInside(root, currentRoot)) throw new Refusal("invalid-input", `${folder} holds the project ${currentRoot}. Give a folder outside it.`);
  const outer = foldersUpFrom(root).slice(1).find(isProject);
  if (outer !== undefined) throw new Refusal("invalid-input", `${folder} is inside the project ${outer}. Give a folder that is in no project.`);
  const stat = statSync(root, { throwIfNoEntry: false });
  if (stat !== undefined && !stat.isDirectory()) throw new Refusal("invalid-input", `${folder} is not a folder.`);
  if (stat !== undefined && readdirSync(root).length > 0) throw new Refusal("conflict", `${folder} is not empty. Give a new or empty folder, or remove the folder of an earlier export.`);
  if (existsSync(zip)) throw new Refusal("conflict", `${zip} exists. Remove the zip file of an earlier export, or give another folder.`);
  return { root, zip };
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

/** The folder of the committed knowledge text in PROJECT_DIRECTORY. The knowledge (src/knowledge/database.ts) has the same name. */
export const KNOWLEDGE_TEXT_DIRECTORY = "knowledge";

/** The index of the knowledge in LOCAL_DIRECTORY, and the files that SQLite keeps beside it. The knowledge has the same name. */
const KNOWLEDGE_INDEX = /^knowledge\.db(?:-wal|-shm|-journal)?$/;

/**
 * The part of the knowledge that a path relative to the project folder is in:
 * the text in .c64-re-tools/knowledge/ or the index in .c64-re-tools/local/.
 * Undefined for every other path. Letter case does not count: some file
 * systems do not tell the cases apart.
 */
export function knowledgePart(fromRoot: string): string | undefined {
  const parts = fromRoot.split(/[\\/]+/).filter((part) => part !== "" && part !== ".").map((part) => part.toLowerCase());
  if (parts[0] !== PROJECT_DIRECTORY) return undefined;
  if (parts[1] === KNOWLEDGE_TEXT_DIRECTORY) return `${PROJECT_DIRECTORY}/${KNOWLEDGE_TEXT_DIRECTORY}/`;
  if (parts[1] === LOCAL_DIRECTORY && parts.length === 3 && KNOWLEDGE_INDEX.test(parts[2]!)) return `${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/${parts[2]}`;
  return undefined;
}

/** What a command writes at an output path: one file, or files in a folder. */
export type OutputKind = "file" | "folder";

/** Why a file cannot be written, by the error code of the file system; the codes that are a fault of the path. */
const WRITE_PROBLEMS: Record<string, string> = {
  EISDIR: "is a folder. Give the path of a file",
  EEXIST: "has a file where a folder must be. Give a path whose folders are folders",
  ENOTDIR: "has a file where a folder must be. Give a path whose folders are folders",
  ENOENT: "is in a folder that does not exist",
  EACCES: "cannot be written: there is no permission. Give a path that you can write",
  EPERM: "cannot be written: there is no permission. Give a path that you can write",
  EROFS: "is on a file system that is read-only. Give another path",
  ENAMETOOLONG: "is too long. Give a shorter path",
};

/**
 * The message for a write that the file system refused because of the path
 * (a folder, a file in place of a folder, no permission): the path and what
 * to do. Undefined for another error, which is no fault of the path.
 */
export function writeProblem(error: unknown, path: string, what?: string): string | undefined {
  const problem = WRITE_PROBLEMS[(error as NodeJS.ErrnoException | undefined)?.code ?? ""];
  return problem === undefined ? undefined : `${what === undefined ? "" : `${what}: `}${path} ${problem}.`;
}

/**
 * Checks a path that a command writes, before the command does any work. The
 * path must stay inside the project, also through symbolic links, and must
 * not be in the knowledge (only the c64-knowledge skill writes it). A file
 * must not be a folder or a symbolic link; a folder must be a folder. The
 * nearest folder that exists must be a folder that can be written. Returns
 * the absolute path. Throws a Refusal (invalid-input) whose message starts
 * with `what` (for example --out). writeProjectFile does the same check for
 * each file that it writes.
 */
export function checkOutputPath(path: string, kind: OutputKind, options: { root?: string; what?: string } = {}): string {
  const root = options.root ?? projectRoot();
  const what = options.what;
  const outside = () => new Refusal("invalid-input", `${what ?? path}: give a path relative to the project folder that stays inside it, not ${path}.`);
  const problem = (error: unknown) => {
    const message = writeProblem(error, path, what);
    return message === undefined ? error : new Refusal("invalid-input", message);
  };
  const inKnowledge = (fromRoot: string) => {
    const part = knowledgePart(fromRoot);
    if (part === undefined) return;
    const prefix = `${what === undefined ? "" : `${what}: `}${path}`;
    // The index is one file in the folder for local files: another name in that folder is good.
    if (!part.endsWith("/")) {
      throw new Refusal("invalid-input", `${prefix} is the index of the knowledge${path === part ? "" : ` (${part})`}. Only the c64-knowledge skill writes it: a write there destroys the index. Give another file name, for example ${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/<other name>.`);
    }
    throw new Refusal("invalid-input", `${prefix} is in ${part}, the knowledge of the project. Only the c64-knowledge skill writes it: a write there destroys the knowledge. Give a path outside ${part}, for example ${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/<${kind === "folder" ? "folder" : "file"}>.`);
  };
  let target: string;
  try {
    target = resolveProjectPath(path, root);
  } catch {
    throw outside();
  }
  inKnowledge(relative(root, target));
  // The nearest entry that exists: the path itself, or a folder above it.
  let existing = target;
  for (;;) {
    let found;
    try {
      found = lstatSync(existing, { throwIfNoEntry: false });
    } catch (error) {
      throw problem(error);
    }
    if (found !== undefined) break;
    existing = dirname(existing);
  }
  const realRoot = realpathSync(root);
  if (existing === target && kind === "file" && lstatSync(target).isSymbolicLink()) throw outside();
  const real = realpathSync(existing);
  if (!isInside(realRoot, real)) throw outside();
  inKnowledge(relative(realRoot, join(real, relative(existing, target))));
  const stat = statSync(real);
  if (existing === target && kind === "file") {
    if (stat.isDirectory()) throw problem({ code: "EISDIR" });
  } else if (existing === target && !stat.isDirectory()) {
    throw new Refusal("invalid-input", `${what === undefined ? "" : `${what}: `}${path} is a file, but ${what ?? "the path"} needs a folder. Give the path of a folder, or a new path for the folder.`);
  } else if (!stat.isDirectory()) {
    throw problem({ code: "ENOTDIR" });
  }
  try {
    accessSync(real, constants.W_OK);
  } catch (error) {
    throw problem(error);
  }
  return target;
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
