// The project: the nearest folder at or above the working directory that
// holds .c64-re-tools/, below the home folder, the way git finds .git. A skill
// script can name it with --project <folder>; a project path of a script is
// relative to that folder, or absolute inside it. An MCP tool takes absolute
// paths only, and the project of a file is the project at or above it
// (fileProject). .c64-re-tools/local/ holds what the agent saves for itself
// and ignores itself in git.

import { Refusal } from "./errors.ts";
import { accessSync, constants, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep, win32 } from "node:path";

/** The folder that marks a project and holds its knowledge. */
export const PROJECT_DIRECTORY = ".c64-re-tools";

/** The folder for machine-local scratch: saved results, batches and step files. */
export const LOCAL_DIRECTORY = "local";

/** The folder in LOCAL_DIRECTORY for the reports of a generated source: its source map and the code that no run executed. */
const GENERATED_DIRECTORY = "generated";

/**
 * The folder of the reports of the source that was generated into `out`, relative
 * to the project folder: .c64-re-tools/local/generated/<out>. The source folder
 * then holds only source files.
 */
export function generatedDirectory(out: string): string {
  return posix.join(PROJECT_DIRECTORY, LOCAL_DIRECTORY, GENERATED_DIRECTORY, posix.normalize(out.split("\\").join("/")).replace(/\/+$/, ""));
}

/** The .gitignore of LOCAL_DIRECTORY: git ignores everything in it, the .gitignore too. */
const LOCAL_GITIGNORE = "# Machine-local scratch of c64-re-tools (saved results, batches, step files). Never committed.\n*\n";

/** How deep a working directory without a project is searched for projects below it. */
const SEARCH_DEPTH = 3;

/** At most this many projects are named in a refusal. */
const LISTED_PROJECTS = 20;

/** How a refusal of a script tells the caller to name a project. */
const SCRIPT_REMEDY = "Give --project <folder>";

/** The folder that --project chose for this process, or undefined. */
let chosen: string | undefined;

/** The group when --project chose a group folder: the project lookup refuses it, and only a command that works on a group uses it. */
let chosenGroup: ProjectGroup | undefined;

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

/**
 * The home folder as the environment gives it and at its real location: the
 * home folder can be a symbolic link, and the working directory of a process
 * is a real location.
 */
function homeFolders(): string[] {
  const home = homedir();
  if (homes?.home !== home) {
    let real = home;
    try {
      real = realLocation(home);
    } catch {
      // The home folder as the environment gives it.
    }
    homes = { home, folders: real === home ? [home] : [home, real] };
  }
  return homes.folders;
}

/** The spellings of the home folder, found once for each home folder that the environment gives. */
let homes: { home: string; folders: string[] } | undefined;

/** True when `folder` is the home folder, in either spelling. */
function isHome(folder: string): boolean {
  return homeFolders().includes(folder);
}

/**
 * True for the root of a file system, the home folder and each folder above
 * it: they hold the files of the whole machine or user, so they are never a
 * project without .c64-re-tools/. By text and by real location.
 */
function isTop(folder: string): boolean {
  let spellings = [folder];
  try {
    spellings = [folder, realLocation(folder)];
  } catch {
    // The text alone.
  }
  return spellings.some((each) => dirname(each) === each || homeFolders().some((home) => isInside(each, home)));
}

/** `start` and each folder above it, nearest first, below the home folder when `start` is under it. */
function foldersUpFrom(start: string): string[] {
  const homes = homeFolders();
  if (homes.includes(start)) return [];
  const underHome = homes.some((home) => isInside(home, start));
  const folders: string[] = [];
  for (let folder = start; ; folder = dirname(folder)) {
    if (underHome && homes.includes(folder)) break;
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
 * The nearest entry at or above `path` that exists: `path` itself, or a
 * folder above it. ENOENT and ENOTDIR (a file where a folder must be) mean that
 * an entry does not exist. Any other error of the file system, for example no
 * permission, is thrown for the caller to report.
 */
export function nearestEntry(path: string): string {
  for (let entry = path; ; entry = dirname(entry)) {
    try {
      lstatSync(entry);
      return entry;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code !== "ENOENT" && code !== "ENOTDIR") || dirname(entry) === entry) throw error;
    }
  }
}

/**
 * What the project rules find from the folder `start`: the nearest folder at
 * or above it with .c64-re-tools/, below the home folder. Without one, `start`
 * itself, unless it is the root of a file system, the home folder or a folder
 * above it (top, isTop), has projects below it, or is a folder of a group that is no
 * project: then why it is in no project, so no write lands outside a project.
 * `plain` marks `start` as a project without .c64-re-tools/.
 */
type Lookup = { root: string; plain?: true } | { top: true } | { below: string[] } | { group: ProjectGroup };

function lookUp(start: string): Lookup {
  for (const folder of foldersUpFrom(start)) {
    if (isProject(folder)) return { root: folder };
  }
  if (isTop(start)) return { top: true };
  const below = projectsBelow(start);
  if (below.length > 0) return { below };
  // A folder of a group that is no project, for example its docs/: a write there would make it a project of the group.
  const group = groupAbove(start);
  return group === undefined ? { root: start, plain: true } : { group };
}

/** The nearest group folder above `start`, or undefined. The search stops at the first one. */
function groupAbove(start: string): ProjectGroup | undefined {
  for (const folder of foldersUpFrom(start).slice(1)) {
    const group = groupAt(folder);
    if (group !== undefined) return group;
  }
  return undefined;
}

/** The projects of a group, relative to `start` and with /. */
function groupProjects(group: ProjectGroup, start: string): string {
  return listed([...group.projects.values()].map((project) => relative(start, project).split(sep).join("/")));
}

/**
 * The project of the working directory `cwd` by the project rules (lookUp).
 * A folder in no project is a Refusal that names the projects and the remedy.
 */
export function findProject(cwd: string = process.cwd()): string {
  const start = resolve(cwd);
  const found = lookUp(start);
  if ("root" in found) return found.root;
  if ("top" in found) throw new Refusal("invalid-input", `${isHome(start) ? "The home folder" : start} is not a project folder. Start in a project folder, or give --project <folder>.`);
  if ("below" in found) throw new Refusal("invalid-input", `${start} is not a project folder. These folders below it are projects: ${listed(found.below)}. ${SCRIPT_REMEDY} with one of them.`);
  throw new Refusal("invalid-input", `${start} is in the group folder ${found.group.root}, and it is not a project folder. The projects of the group are ${groupProjects(found.group, start)}. ${SCRIPT_REMEDY} with one of them. To make this folder a new project of the group, give the folder itself: .`);
}

/**
 * The project of the absolute path `file` that an MCP tool reads or writes:
 * the nearest folder at or above the file with .c64-re-tools/, below the home
 * folder. The lookup starts at the folder of the file, or at the first folder
 * above it that exists, because a new file can be in a new folder. Without one,
 * the project is the folder where the MCP server started, where the agent
 * started, when the project rules (lookUp) make that folder a project without
 * .c64-re-tools/, and the file is in it. A file that a tool only reads can also
 * be in a group folder outside its projects: then the project is the first
 * project of the group, whose reads reach the group folder. Any other file is
 * a Refusal with the remedy.
 */
export function fileProject(file: string, access: "read" | "write"): string {
  let start: string;
  try {
    start = nearestEntry(dirname(resolve(file)));
    // A file, or a link to nothing, where a folder must be: the folder above it.
    if (statSync(start, { throwIfNoEntry: false })?.isDirectory() !== true) start = dirname(start);
  } catch (error) {
    throw new Refusal("invalid-input", `${file} cannot be reached: the file system refuses a folder of its path (${(error as NodeJS.ErrnoException).code ?? "an error"}). Give a file in a project folder that you can read.`);
  }
  const marked = foldersUpFrom(start).find(isProject);
  if (marked !== undefined) {
    ensureLocal(marked);
    return marked;
  }
  // Each call looks again: a project made below the start folder ends its place as a project.
  const cwd = resolve(process.cwd());
  const started = lookUp(cwd);
  const plain = "root" in started && started.plain === true ? started.root : undefined;
  if (plain !== undefined && insideReally(plain, file) !== undefined) return plain;
  if (isTop(start)) throw new Refusal("invalid-input", `${file} is not in a project folder. Give a file in a folder that has .c64-re-tools/, or start the agent in a project folder.`);
  const group = groupAt(start) ?? groupAbove(start);
  if (group !== undefined) {
    if (access === "read") return [...group.projects.values()][0]!;
    throw new Refusal("invalid-input", `${file} is in the group folder ${group.root}, and not in a project of the group. The projects of the group are ${groupProjects(group, start)}. Give a file in one of them.`);
  }
  // The projects below the folder name the remedy, but only in the start folder: a search elsewhere can read a large part of the disk.
  const below = insideReally(cwd, start) === undefined ? [] : projectsBelow(start);
  if (below.length > 0) throw new Refusal("invalid-input", `${file} is in ${start}, and it is not a project folder. These folders below it are projects: ${listed(below)}. Give a file in one of them.`);
  const where = plain === undefined ? "" : `, or is the folder where the agent started, ${plain}, or a folder in it`;
  throw new Refusal("invalid-input", `${file} is not in a project folder. A project folder has .c64-re-tools/${where}.`);
}

/** The refusal of a group folder as a project: a write there would make it a project, and then it is no group. */
function groupRefusal(path: string, group: ProjectGroup): Refusal {
  return new Refusal("invalid-input", `${path} is a group folder, not a project folder. These folders in it are projects: ${listed([...group.projects.keys()])}. ${SCRIPT_REMEDY} with one of them.`);
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
  if (isHome(path)) throw new Refusal("invalid-input", "The home folder is not a project folder.");
  if (isTop(path) && !isProject(path)) throw new Refusal("invalid-input", `${folder} is the root of a file system or a folder above the home folder, and it is not a project folder. Give a project folder.`);
  // A project inside another project is a project of its own, as the lookup from a working directory in it finds.
  const outer = isProject(path) ? undefined : foldersUpFrom(path).slice(1).find(isProject);
  if (outer !== undefined) {
    throw new Refusal("invalid-input", `${folder} is inside the project ${relative(cwd, outer) || outer}. Give that project folder.`);
  }
  return path;
}

/**
 * A group folder: a folder of a git repository, in no project, that holds two or more
 * projects, for example one project for each version of a game. Its pages can
 * link into each project, and a page of a project into the other projects.
 */
export interface ProjectGroup {
  root: string;
  /** The absolute folder of each project in the group, by its folder name, sorted. */
  projects: Map<string, string>;
}

/** True when `folder` or a folder above it holds .git. */
function inRepository(folder: string): boolean {
  return foldersUpFrom(folder).some((each) => existsSync(join(each, ".git")));
}

/**
 * The group at `folder`: its folders that are projects and are not a git
 * repository of their own. Undefined when `folder` is the home folder, is in a
 * project, is in no git repository, or holds fewer than two projects.
 */
export function groupAt(folder: string): ProjectGroup | undefined {
  const root = resolve(folder);
  if (isHome(root) || dirname(root) === root) return undefined;
  if (foldersUpFrom(root).some(isProject) || !inRepository(root)) return undefined;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const projects = new Map<string, string>();
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const path = join(root, entry.name);
    if (isProject(path) && !existsSync(join(path, ".git"))) projects.set(entry.name, path);
  }
  // One project alone is no group: a group holds the versions of one program.
  return projects.size < 2 ? undefined : { root, projects };
}

/** The group of the project `root`: the folder above it, when that is a group that holds the project. */
export function groupOf(root: string): ProjectGroup | undefined {
  const group = groupAt(dirname(resolve(root)));
  return group?.projects.get(basename(resolve(root))) === resolve(root) ? group : undefined;
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
  if (isHome(root)) throw new Refusal("invalid-input", "The home folder cannot be the folder of a new project.");
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

/** Sets the project of this process from --project. Refuses a folder that the rules refuse. */
export function useProject(folder: string): void {
  chosen = namedProject(folder);
  chosenGroup = groupAt(chosen);
}

/** The group of a run that works on a group: the group folder that --project names, else the group folder that is the working directory. */
export function namedGroup(): ProjectGroup | undefined {
  return chosen === undefined ? groupAt(process.cwd()) : chosenGroup;
}

/** The project folder of this process: the --project choice, else the project lookup from the working directory. A group folder is refused. */
export function projectRoot(): string {
  if (chosenGroup !== undefined) throw groupRefusal(chosenGroup.root, chosenGroup);
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

/** The real location of `path`: the real location of its longest part that exists, and the rest as it is. Throws an error of the file system as nearestEntry does. */
export function realLocation(path: string): string {
  const existing = nearestEntry(path);
  return join(realpathSync(existing), relative(existing, path));
}

/**
 * The absolute path `candidate` in the spelling of the folder `root`, when it
 * is inside `root`: by its text, or by its real location. An absolute path can
 * reach a folder through a symbolic link, for example /tmp to /private/tmp on
 * macOS, or a linked work folder. The last part of `candidate` stays as it
 * is: the caller checks a link there. Undefined when it is outside.
 */
function insideReally(root: string, candidate: string): string | undefined {
  if (isInside(root, candidate)) return candidate;
  let realRoot: string;
  let real: string;
  try {
    realRoot = realLocation(root);
    real = join(realLocation(dirname(candidate)), basename(candidate));
  } catch {
    // A path that the file system refuses (no permission, a link to nothing) is not inside.
    return undefined;
  }
  return isInside(realRoot, real) ? join(root, relative(realRoot, real)) : undefined;
}

/** The remedy of a project path that leads out of its folder: the two forms that a script takes. */
const INSIDE_REMEDY = "Give a path inside it, relative to the project folder or absolute.";

/**
 * The absolute path of a project path: relative to the project folder `root`,
 * or absolute. It must stay inside the project folder. An absolute path that
 * reaches the project folder through a symbolic link comes back in the
 * spelling of `root`.
 */
export function resolveProjectPath(path: string, root = projectRoot()): string {
  if (path.length === 0) {
    throw new Refusal("invalid-input", "A project path must not be empty.");
  }
  const candidate = resolve(root, path);
  const inside = isAbsolute(path) ? insideReally(root, candidate) : isInside(root, candidate) ? candidate : undefined;
  if (inside !== undefined) return inside;
  throw new Refusal("invalid-input", `${path} leads out of the project folder ${root}. ${INSIDE_REMEDY}`);
}

/** The folder of the committed knowledge text in PROJECT_DIRECTORY. */
export const KNOWLEDGE_TEXT_DIRECTORY = "knowledge";

/** The index of the knowledge in LOCAL_DIRECTORY. */
export const KNOWLEDGE_INDEX_FILE = "knowledge.db";

/** The index and the files that SQLite keeps beside it. */
const KNOWLEDGE_INDEX_FILES = ["", "-wal", "-shm", "-journal"].map((suffix) => `${KNOWLEDGE_INDEX_FILE}${suffix}`);

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
  if (parts[1] === LOCAL_DIRECTORY && parts.length === 3 && KNOWLEDGE_INDEX_FILES.includes(parts[2]!)) return `${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/${parts[2]}`;
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
  const outside = () => new Refusal("invalid-input", `${what === undefined ? "" : `${what}: `}${path} leads out of the project folder ${root}. Give a path that stays inside it.`);
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
      throw new Refusal("invalid-input", `${prefix} is the index of the knowledge${path === part ? "" : ` (${part})`}. Only the commands that change the project knowledge write it: a write there destroys the index. Give another file name, for example ${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/<other name>.`);
    }
    throw new Refusal("invalid-input", `${prefix} is in ${part}, the knowledge of the project. Only the commands that change the project knowledge write it: a write there destroys the knowledge. Give a path outside ${part}, for example ${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/<${kind === "folder" ? "folder" : "file"}>.`);
  };
  let target: string;
  try {
    target = resolveProjectPath(path, root);
  } catch {
    throw outside();
  }
  inKnowledge(relative(root, target));
  // The nearest entry that exists: the path itself, or a folder above it.
  let existing: string;
  try {
    existing = nearestEntry(target);
  } catch (error) {
    throw problem(error);
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

/**
 * Refuses with `fail` an absolute path in a file that the project keeps, for
 * example the program of a run file: such a file must work in each copy of
 * the project. A path that is absolute on any system counts, so a file from
 * Windows is refused on Linux too. `field` names the path in the refusal.
 */
export function refuseAbsoluteInFile(value: unknown, field: string, fail: (message: string) => never): void {
  if (typeof value === "string" && win32.isAbsolute(value)) fail(`${field}: give the path relative to the project folder, so the file works in each copy of the project, not ${value}`);
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

/** The group of each project that a read resolved a path for. */
const readGroups = new Map<string, ProjectGroup | undefined>();

/** The group folder of the project `root`, or undefined: the folder that a read of the project can reach. */
export function readGroup(root: string): ProjectGroup | undefined {
  if (!readGroups.has(root)) readGroups.set(root, groupOf(root));
  return readGroups.get(root);
}

/**
 * Resolves a path that a command only reads, relative to the project folder
 * or absolute, as resolveProjectPath does. In a group the path can also lead
 * into the group folder, so a version reads the files of the other versions,
 * for example ../v1/releases/game.prg. A write stays in the project.
 */
export function resolveReadPath(path: string, root = projectRoot()): string {
  const group = readGroup(root);
  if (group === undefined || path.length === 0) return resolveProjectPath(path, root);
  const candidate = resolve(root, path);
  const inside = isAbsolute(path) ? insideReally(group.root, candidate) : isInside(group.root, candidate) ? candidate : undefined;
  if (inside !== undefined) return inside;
  throw new Refusal("invalid-input", `${path} leads out of the group folder ${group.root} of the project. ${INSIDE_REMEDY}`);
}

/** resolveReadPath to an existing entry whose real location is inside the project, or in a group inside the group folder, as resolveProjectFile does. */
export function resolveReadFile(path: string, root = projectRoot()): string {
  const group = readGroup(root);
  if (group === undefined) return resolveProjectFile(path, root);
  const real = realpathSync(resolveReadPath(path, root));
  if (!isInside(realpathSync(group.root), real)) {
    throw new Refusal("invalid-input", `${path} leads out of the group folder of the project through a symbolic link.`);
  }
  return real;
}
