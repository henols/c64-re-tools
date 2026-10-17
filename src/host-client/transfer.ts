// Reads project files on the client side for transfer to the Host Runtime.
// The host never sees a client path: only bytes and the file's type.

import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";

import { isInside, projectRoot, resolveProject, resolveProjectFile, resolveProjectPath } from "../project.ts";
import { MAX_ATTACHMENT_BYTES } from "../protocol/framing.ts";
import { WireFailure } from "../protocol/messages.ts";
import { MAX_TREE_FILES, type SourceTree } from "../protocol/tools.ts";

/**
 * The project folder of a call that names it with `project` (relative to the
 * working directory) or not. Throws WireFailure when the rules
 * refuse it, for example at a folder with several projects below it.
 */
export function projectFolder(project: string | undefined): string {
  return resolveProject(project, process.cwd(), { remedy: "Give project: <folder>" });
}

/** The project folder of this process (--project or the project lookup), or a WireFailure. */
function currentProject(): string {
  return projectRoot();
}

export interface ProjectFile {
  bytes: Buffer;
  /** Lowercase extension without the dot; empty when the file has none. */
  type: string;
}

/**
 * Reads one project file. Throws WireFailure: invalid-input for a path the
 * project rules refuse, not-found when nothing is there, limit-exceeded when
 * the file is too large to transfer.
 */
export function readProjectFile(path: string, options: { root?: string } = {}): ProjectFile {
  const root = options.root ?? currentProject();
  let real: string;
  try {
    real = resolveProjectFile(path, root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WireFailure("not-found", `There is no file at ${path} in the project folder.`);
    }
    if (error instanceof TypeError) {
      throw new WireFailure("invalid-input", `${path}: give a path relative to the project folder that stays inside it.`);
    }
    throw error;
  }
  const stat = statSync(real);
  if (!stat.isFile()) throw new WireFailure("invalid-input", `${path} is not a file.`);
  if (stat.size > MAX_ATTACHMENT_BYTES) {
    throw new WireFailure("limit-exceeded", `${path} has ${stat.size} bytes. The limit is ${MAX_ATTACHMENT_BYTES} bytes.`);
  }
  return { bytes: readFileSync(real), type: extname(path).slice(1).toLowerCase() };
}

/**
 * Writes bytes to a project file on the client side, making its directories
 * and overwriting it. Throws WireFailure(invalid-input) for a path outside the
 * project, also one that leaves it through a symbolic link.
 */
export function writeProjectFile(path: string, bytes: Uint8Array, options: { root?: string; what?: string } = {}): void {
  const root = options.root ?? currentProject();
  const refuse = () => new WireFailure("invalid-input", `${options.what ?? path}: give a path relative to the project folder that stays inside it, not ${path}.`);
  let file: string;
  try {
    file = resolveProjectPath(path, root);
  } catch {
    throw refuse();
  }
  // The nearest folder that exists must be inside the project before a folder is made below it.
  let existing = dirname(file);
  while (!existsSync(existing)) existing = dirname(existing);
  if (!isInside(realpathSync(root), realpathSync(existing))) throw refuse();
  mkdirSync(dirname(file), { recursive: true });
  if (!isInside(realpathSync(root), realpathSync(dirname(file)))) throw refuse();
  let link = false;
  try {
    link = lstatSync(file).isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (link) throw refuse();
  writeFileSync(file, bytes);
}

/** Directories never staged: version control and the toolkit's own project state. */
const SKIPPED_DIRECTORIES = new Set([".git", ".hg", ".svn", ".c64-re-tools"]);

/**
 * Reads a project folder as a source tree for staging: ordinary
 * files with relative POSIX paths. A symbolic link is followed only when its
 * target stays inside the source root; otherwise the tree is refused.
 */
/** What a result says of a file that it wrote: the path, the size and the SHA-256. The MCP tools and the scripts report a written file in this form. */
export interface Written {
  out: string;
  bytes: number;
  sha256: string;
}

/** Writes the bytes to a project file as writeProjectFile does, and reports the file. */
export function writeReported(path: string, data: Uint8Array | string, options: { root?: string; what?: string } = {}): Written {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  writeProjectFile(path, bytes, options);
  return { out: path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export function readProjectTree(path: string, options: { root?: string } = {}): { files: SourceTree; contents: Buffer[] } {
  const projectRootPath = options.root ?? currentProject();
  let sourceRoot: string;
  try {
    sourceRoot = resolveProjectFile(path, projectRootPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WireFailure("not-found", `There is no directory ${path} in the project folder.`);
    if (error instanceof TypeError) throw new WireFailure("invalid-input", `${path}: give a directory relative to the project folder that stays inside it.`);
    throw error;
  }
  if (!statSync(sourceRoot).isDirectory()) throw new WireFailure("invalid-input", `${path} is not a directory.`);

  const files: SourceTree = [];
  const contents: Buffer[] = [];
  let total = 0;
  // `realDirectory` is where `directory` really is; `ancestors` holds the real
  // location of every directory on the walk down to it, so a link to one of
  // them is a loop.
  const walk = (directory: string, realDirectory: string, ancestors: Set<string>): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = join(directory, entry.name);
      let target = join(realDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        target = realpathSync(full);
        if (!isInside(sourceRoot, target)) {
          throw new WireFailure("invalid-input", `${relative(projectRootPath, full)} links outside ${path}. Staging refuses a link that goes outside the source directory.`);
        }
      }
      const stat = statSync(target);
      if (stat.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        if (ancestors.has(target)) {
          throw new WireFailure("invalid-input", `${relative(projectRootPath, full)} points at a directory that contains it. Staging refuses a link loop.`);
        }
        walk(full, target, new Set(ancestors).add(target));
        continue;
      }
      if (!stat.isFile()) continue;
      if (files.length >= MAX_TREE_FILES) throw new WireFailure("limit-exceeded", `${path} has more than ${MAX_TREE_FILES} files.`);
      total += stat.size;
      if (total > MAX_ATTACHMENT_BYTES) throw new WireFailure("limit-exceeded", `${path} holds more than ${MAX_ATTACHMENT_BYTES} bytes.`);
      files.push({ path: relative(sourceRoot, full).split(sep).join("/"), size: stat.size });
      contents.push(readFileSync(target));
    }
  };
  walk(sourceRoot, sourceRoot, new Set([sourceRoot]));
  return { files, contents };
}
