// Reads project files on the client side for transfer to the Host Runtime.
// The host never sees a client path: only bytes and the file's type.

import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

import { projectRoot, resolveProjectFile } from "../project.ts";
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
export function readProjectFile(path: string, options: { root?: string; maxBytes?: number } = {}): ProjectFile {
  const root = options.root ?? projectRoot();
  const maxBytes = options.maxBytes ?? MAX_ATTACHMENT_BYTES;
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
  if (stat.size > maxBytes) {
    throw new WireFailure("limit-exceeded", `${path} has ${stat.size} bytes; the limit is ${maxBytes} bytes.`);
  }
  return { bytes: readFileSync(real), type: extname(real).slice(1).toLowerCase() };
}

/** Directories never staged: version control and the toolkit's own project state. */
const SKIPPED_DIRECTORIES = new Set([".git", ".hg", ".svn", ".c64-re-tools"]);

function inside(root: string, path: string): boolean {
  const fromRoot = relative(root, path);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(sep));
}

/**
 * Reads a project directory as a source tree for staging (16 §4): ordinary
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
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = join(directory, entry.name);
      let target = full;
      if (lstatSync(full).isSymbolicLink()) {
        target = realpathSync(full);
        if (!inside(sourceRoot, target)) {
          throw new WireFailure("invalid-input", `${relative(projectRootPath, full)} links outside ${path}; staging refuses it.`);
        }
      }
      const stat = statSync(target);
      if (stat.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(full);
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
  walk(sourceRoot);
  return { files, contents };
}
