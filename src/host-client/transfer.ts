// Reads project files on the client side for transfer to the Host Runtime.
// The host never sees a client path: only bytes and the file's type.

import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { checkOutputPath, fileProject, isInside, projectRoot, readGroup, resolveProjectFile, resolveReadFile, writeProblem } from "../project.ts";
import { isRefusal } from "../errors.ts";
import { MAX_ATTACHMENT_BYTES } from "../protocol/framing.ts";
import { WireFailure } from "../protocol/messages.ts";
import { MAX_TREE_FILES, type SourceTree } from "../protocol/tools.ts";

/** A file that an MCP tool reads or writes: its absolute path, and its project. */
export interface ToolFile {
  file: string;
  root: string;
}

/**
 * The file of a path input of an MCP tool, with the project that the project
 * rules find for it (fileProject). Refuses a relative path: the agent cannot
 * see the working folder of the MCP server.
 */
export function toolFile(path: string, access: "read" | "write"): ToolFile {
  if (!isAbsolute(path)) throw new WireFailure("invalid-input", `${path} is relative. Give the absolute path of the file.`);
  const file = resolve(path);
  return { file, root: fileProject(file, access) };
}

/** The file of an MCP `out`, checked before the tool does any work with the checks that every --out of a script gets. */
export function checkOut(path: string): ToolFile {
  const target = toolFile(path, "write");
  checkOutputPath(target.file, "file", { root: target.root, what: "out" });
  return target;
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
export function readProjectFile(path: string, options: { root?: string; what?: string } = {}): ProjectFile {
  const root = options.root ?? currentProject();
  let real: string;
  try {
    real = resolveReadFile(path, root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WireFailure("not-found", `${options.what === undefined ? "" : `${options.what}: `}There is no file at ${path}${isAbsolute(path) ? "" : " in the project folder"}.`);
    }
    if (isRefusal(error) && error.code === "invalid-input") {
      const group = readGroup(root);
      const where = group === undefined ? `the project folder ${root}` : `the group folder ${group.root} of the project`;
      throw new WireFailure("invalid-input", `${options.what === undefined ? "" : `${options.what}: `}${path} leads out of ${where}. Give a path that stays inside it.`);
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

/** The JSON value of a project file. Text that is not JSON is invalid-input with `notJson` of the parse error. */
export function readProjectJson(path: string, notJson: (message: string) => string = (message) => `${path} is not JSON: ${message}`): unknown {
  const text = readProjectFile(path).bytes.toString("utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new WireFailure("invalid-input", notJson((error as Error).message));
  }
}

/**
 * The refusal for a write that the file system refused because of the path
 * (a folder, a file in place of a folder, no permission): invalid-input with
 * the path. Undefined for another error, which is no fault of the path.
 */
export function writeRefusal(error: unknown, path: string, what?: string): WireFailure | undefined {
  const message = writeProblem(error, path, what);
  return message === undefined ? undefined : new WireFailure("invalid-input", message);
}

/**
 * Writes bytes to a project file on the client side, making its directories
 * and overwriting it. First the check of checkOutputPath, which a script also
 * does on its output options before any work. Throws WireFailure(invalid-input)
 * for a path outside the project, also one that leaves it through a symbolic
 * link, for a path in the knowledge, and for a path that the file system
 * refuses: a folder, a file in place of a folder, no permission.
 */
export function writeProjectFile(path: string, bytes: Uint8Array, options: { root?: string; what?: string } = {}): void {
  const root = options.root ?? currentProject();
  const refuse = () => new WireFailure("invalid-input", `${options.what === undefined ? "" : `${options.what}: `}${path} leads out of the project folder ${root}. Give a path that stays inside it.`);
  let file: string;
  try {
    file = checkOutputPath(path, "file", { root, ...(options.what === undefined ? {} : { what: options.what }) });
  } catch (error) {
    if (isRefusal(error)) throw new WireFailure(error.code, error.message);
    throw error;
  }
  try {
    mkdirSync(dirname(file), { recursive: true });
    // Again after the folders are made: another process can change the folders between the check and the write.
    if (!isInside(realpathSync(root), realpathSync(dirname(file)))) throw refuse();
    let link = false;
    try {
      link = lstatSync(file).isSymbolicLink();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (link) throw refuse();
    writeFileSync(file, bytes);
  } catch (error) {
    throw writeRefusal(error, path, options.what) ?? error;
  }
}

/** Directories never staged: version control and the toolkit's own project state. */
const SKIPPED_DIRECTORIES = new Set([".git", ".hg", ".svn", ".c64-re-tools"]);

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

/**
 * Reads a project folder as a source tree for staging: ordinary
 * files with relative POSIX paths. A symbolic link is followed only when its
 * target stays inside the source root; otherwise the tree is refused.
 */
export function readProjectTree(path: string, options: { root?: string } = {}): { files: SourceTree; contents: Buffer[] } {
  const projectRootPath = options.root ?? currentProject();
  let sourceRoot: string;
  try {
    sourceRoot = resolveProjectFile(path, projectRootPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WireFailure("not-found", `There is no directory ${path} in the project folder.`);
    if (isRefusal(error) && error.code === "invalid-input") throw new WireFailure("invalid-input", `${path} leads out of the project folder ${projectRootPath}. Give a directory inside it, relative to the project folder or absolute.`);
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

/** A path from `from` to `to`, with /. */
const posixRelative = (from: string, to: string) => relative(from, to).split(sep).join("/");

/**
 * Reads a source root and its include folders as one source tree for
 * staging, as readProjectTree does. An include folder is relative to the
 * source root, or absolute, and can be anywhere in the project folder. The
 * tree starts at the lowest folder that holds all these folders, but it holds
 * only their files. `sourceDir` is the source root in the tree, "" at its
 * top, and `includeDirs` are the include folders relative to the source root.
 */
export function readSourceTree(sourceRoot: string, includes: readonly string[], options: { root?: string } = {}): { files: SourceTree; contents: Buffer[]; sourceDir: string; includeDirs: string[] } {
  const projectRootPath = options.root ?? currentProject();
  const sourceTree = readProjectTree(sourceRoot, { root: projectRootPath });
  const project = realpathSync(projectRootPath);
  const source = resolveProjectFile(sourceRoot, projectRootPath);
  const missing = (folder: string) => new WireFailure("not-found", `There is no include folder ${folder} with files in the project folder. Give an include folder inside the project folder, relative to the source root or absolute.`);
  const folders = includes.map((folder) => {
    const outside = new WireFailure("invalid-input", `The include folder ${folder} is outside the project folder. Give an include folder inside the project folder, relative to the source root or absolute.`);
    const candidate = resolve(source, folder);
    let real: string | undefined;
    try {
      real = realpathSync(candidate);
    } catch {
      real = undefined;
    }
    // The real location decides: an absolute folder can reach the project folder through a link, for example /tmp to /private/tmp.
    if (!isInside(project, real ?? candidate)) throw outside;
    if (real === undefined || !statSync(real).isDirectory()) throw missing(folder);
    return { folder, real };
  });
  let top = source;
  for (const { real } of folders) while (!isInside(top, real)) top = dirname(top);
  // Each folder is read once: a folder inside another comes with the files of that folder.
  const roots = [...new Set([source, ...folders.map(({ real }) => real)])];
  const files: SourceTree = [];
  const contents: Buffer[] = [];
  for (const root of roots.filter((root) => !roots.some((other) => other !== root && isInside(other, root)))) {
    const tree = root === source ? sourceTree : readProjectTree(posixRelative(project, root) || ".", { root: project });
    const prefix = posixRelative(top, root);
    files.push(...tree.files.map((file) => ({ ...file, path: prefix === "" ? file.path : `${prefix}/${file.path}` })));
    contents.push(...tree.contents);
  }
  if (files.length > MAX_TREE_FILES) throw new WireFailure("limit-exceeded", `The source root and the include folders have more than ${MAX_TREE_FILES} files.`);
  if (files.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) throw new WireFailure("limit-exceeded", `The source root and the include folders hold more than ${MAX_ATTACHMENT_BYTES} bytes.`);
  for (const { folder, real } of folders) {
    const inside = posixRelative(top, real);
    if (!files.some((file) => inside === "" || file.path.startsWith(`${inside}/`))) throw missing(folder);
  }
  return { files, contents, sourceDir: posixRelative(top, source), includeDirs: folders.map(({ real }) => posixRelative(source, real) || ".") };
}
