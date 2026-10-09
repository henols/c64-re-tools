// Request-owned temporary workspaces. Everything staged lives
// outside the user's project and is removed when the request ends.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { WireFailure } from "../protocol/messages.ts";
import { isRelativePath, type SourceTree } from "../protocol/tools.ts";
import type { ProcessSupervisor } from "./processes.ts";

/** How often a removal tries again when a file is busy, for example one that Windows still holds open. */
const REMOVE_RETRIES = 5;

export class Workspace {
  readonly root: string;
  /** The owner's release, when a supervisor owns the workspace. */
  readonly #release: (() => void) | undefined;

  private constructor(root: string, release: (() => void) | undefined) {
    this.root = root;
    this.#release = release;
  }

  /**
   * A fresh, empty workspace in the temporary directory. With a supervisor,
   * the workspace is also removed if its process dies.
   */
  static create(owner?: Pick<ProcessSupervisor, "ownPath">, prefix = "c64-re-tools-request-"): Workspace {
    const root = mkdtempSync(join(tmpdir(), prefix));
    return new Workspace(root, owner?.ownPath(root));
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
      const content = contents[index];
      if (content === undefined) throw new WireFailure("invalid-input", `The request gives no bytes for ${file.path}.`);
      const target = this.path(`${directory}/${file.path}`);
      mkdirSync(dirname(target), { recursive: true });
      // wx: never write through a file or link that is already there.
      writeFileSync(target, content, { flag: "wx" });
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

  /**
   * Removes the workspace. An owned workspace that cannot be removed stays
   * owned, and its supervisor removes it when its process ends: the error is
   * not thrown, so that it cannot replace the failure of the request that
   * used the workspace. Without an owner the error is thrown.
   */
  remove(): void {
    try {
      rmSync(this.root, { recursive: true, force: true, maxRetries: REMOVE_RETRIES });
    } catch (error) {
      if (this.#release === undefined) throw error;
      return;
    }
    this.#release?.();
  }
}
