#!/usr/bin/env node
// Copies the canonical skills from the repo's .claude/skills/ into installer/skills/
// so `npm pack`/`npm publish` bundles them into the @henols/c64-re-tools tarball.
// The canonical source of truth stays .claude/skills/ (also used by the Claude Code
// plugin); installer/skills/ is a generated, gitignored copy regenerated on every
// pack via the package's `prepack` script.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, rmSync, mkdirSync, readdirSync, cpSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/scripts
const INSTALLER_ROOT = dirname(HERE); // installer
const REPO_ROOT = dirname(INSTALLER_ROOT); // repo root
const SRC = join(REPO_ROOT, ".claude", "skills");
const DEST = join(INSTALLER_ROOT, "skills");

if (!existsSync(SRC)) {
  console.error(`sync-skills: FAIL -- skills source not found at ${SRC}`);
  process.exit(1);
}

const names = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (names.length === 0) {
  console.error(`sync-skills: FAIL -- no skill directories under ${SRC}`);
  process.exit(1);
}

// Rebuild DEST from scratch so a removed/renamed skill never lingers in the tarball.
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const name of names) {
  cpSync(join(SRC, name), join(DEST, name), { recursive: true });
}

console.error(`sync-skills: copied ${names.length} skill(s) into ${DEST}: ${names.join(", ")}`);
