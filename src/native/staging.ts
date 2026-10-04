// Request-owned temporary workspaces (04 §7, 16 §3). Everything staged lives
// outside the user's project and is removed when the request ends.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { isRelativePath, WireFailure, type SourceTree } from "../protocol.ts";
import type { ProcessSupervisor } from "./processes.ts";

export class Workspace {
  readonly root: string;
  readonly #release: () => void;

  private constructor(root: string, release: () => void) {
    this.root = root;
    this.#release = release;
  }

  /**
   * A fresh, empty workspace in the temporary directory. With a supervisor,
   * the workspace is also removed if its process dies.
   */
  static create(owner?: Pick<ProcessSupervisor, "ownPath">, prefix = "c64-re-tools-request-"): Workspace {
    const root = mkdtempSync(join(tmpdir(), prefix));
    return new Workspace(root, owner?.ownPath(root) ?? (() => {}));
  }

  /** The absolute path of a relative path inside the workspace; refuses any escape. */
  path(path: string): string {
    if (!isRelativePath(path)) throw new WireFailure("invalid-input", `${path} is not a relative path inside the workspace.`);
    const full = resolve(this.root, path);
    const fromRoot = relative(this.root, full);
    if (fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
      throw new WireFailure("invalid-input", `${path} leaves the workspace.`);
    }
    return full;
  }

  /** Writes a transferred tree under `directory` as ordinary files. Returns the directory's absolute path. */
  materialize(directory: string, files: SourceTree, contents: readonly Uint8Array[]): string {
    const base = this.path(directory);
    mkdirSync(base, { recursive: true });
    files.forEach((file, index) => {
      const target = this.path(`${directory}/${file.path}`);
      mkdirSync(dirname(target), { recursive: true });
      // wx: never write through a file or link that is already there.
      writeFileSync(target, contents[index]!, { flag: "wx" });
    });
    return base;
  }

  /** A directory inside the workspace, created empty. */
  directory(path: string): string {
    const full = this.path(path);
    rmSync(full, { recursive: true, force: true });
    mkdirSync(full, { recursive: true });
    return full;
  }

  remove(): void {
    rmSync(this.root, { recursive: true, force: true });
    this.#release();
  }
}
