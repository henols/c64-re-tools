// Reads project files on the client side for transfer to the Host Runtime.
// The host never sees a client path: only bytes and the file's type.

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

import { isInside, projectRoot, resolveProjectFile } from "../project.ts";
import { MAX_ATTACHMENT_BYTES, MAX_TREE_FILES, WireFailure, type SourceTree } from "../protocol.ts";

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
  const root = options.root ?? projectRoot();
  let real: string;
  try {
    real = resolveProjectFile(path, root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WireFailure("not-found", `There is no file at ${path} in the project directory.`);
    }
    if (error instanceof TypeError) {
      throw new WireFailure("invalid-input", `${path}: give a path relative to the project directory that stays inside it.`);
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

/** Directories never staged: version control and the toolkit's own project state. */
const SKIPPED_DIRECTORIES = new Set([".git", ".hg", ".svn", ".c64-re-tools"]);

/**
 * Reads a project directory as a source tree for staging: ordinary
 * files with relative POSIX paths. A symbolic link is followed only when its
 * target stays inside the source root; otherwise the tree is refused.
 */
export function readProjectTree(path: string, options: { root?: string } = {}): { files: SourceTree; contents: Buffer[] } {
  const projectRootPath = options.root ?? projectRoot();
  let sourceRoot: string;
  try {
    sourceRoot = resolveProjectFile(path, projectRootPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WireFailure("not-found", `There is no directory ${path} in the project directory.`);
    if (error instanceof TypeError) throw new WireFailure("invalid-input", `${path}: give a directory relative to the project directory that stays inside it.`);
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
