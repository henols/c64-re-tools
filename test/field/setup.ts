// The field test on one machine, from this checkout: packs it, makes a fresh
// project and runs the kit's install.ts there with the tarball. The host and
// Claude Code then share the project's trace directory. For a dev container,
// use the kit from a git clone of the release tag instead (see docs/debug-install.md).
//
//   node test/field/setup.ts <project-dir>

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const shell = process.platform === "win32";

function main(): void {
  const target = process.argv[2];
  if (target === undefined) {
    console.error("usage: node test/field/setup.ts <project-dir>");
    process.exit(2);
  }
  const project = resolve(target);
  if (existsSync(project) && readdirSync(project).length > 0) {
    console.error(`${project} exists and is not empty. Give a new or an empty directory.`);
    process.exit(1);
  }
  const tarballs = join(dirname(project), `${basename(project)}-tarballs`);
  mkdirSync(tarballs, { recursive: true });

  console.log("Packing this checkout ...");
  const scratch = mkdtempSync(join(tmpdir(), "c64-field-pack-"));
  let tarball: string;
  try {
    const pack = spawnSync("npm", ["pack", "--pack-destination", scratch], { cwd: root, encoding: "utf8", shell, stdio: ["ignore", "pipe", "inherit"] });
    if (pack.status !== 0) process.exit(1);
    const packed = join(scratch, readdirSync(scratch).find((name) => name.endsWith(".tgz"))!);
    // npx keys its cache by the spec: a name with the content hash never meets an older tarball of the same version.
    const hash = createHash("sha256").update(readFileSync(packed)).digest("hex").slice(0, 12);
    tarball = join(tarballs, basename(packed).replace(/\.tgz$/, `-${hash}.tgz`));
    // A copy, not a rename: the temporary directory can be another file system.
    copyFileSync(packed, tarball);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  mkdirSync(project, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: project });
  const install = spawnSync(process.execPath, [...process.execArgv, join(import.meta.dirname, "kit", "install.ts"), "--package", tarball], { cwd: project, stdio: "inherit" });
  process.exit(install.status ?? 1);
}

main();
