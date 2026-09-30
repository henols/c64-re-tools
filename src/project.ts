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
  const fromRoot = relative(root, candidate);
  if (fromRoot === "" || (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))) {
    return candidate;
  }

  throw new TypeError("Project path escapes the project root");
}
