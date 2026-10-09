import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export function projectRoot(): string {
  return process.cwd();
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
