// The portable c64-re-tools plugin for @jalco/ap-sdk: the skills
// with their TypeScript scripts, the src/ modules those scripts reach, their
// references, and the VICE MCP declaration. AP SDK maps it to each harness's
// native layout; nothing at run time depends on it.
//
// Nothing is built: an installed skill holds the same .ts files as this
// repository, and Node runs them by type stripping. Skill scripts import
// src/ through the "#src/*" subpath import; each installed skill gets a
// package.json that maps it to its own copy of those modules.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { definePlugin, defineSkill, type Skill } from "@jalco/ap-sdk";

import { MCP_SERVER, PACKAGE } from "./package.ts";

const root = resolve(import.meta.dirname, "..");
const SOURCE = join(root, "src");
const SCRIPT_REFERENCE = /scripts\/([a-z][a-z0-9-]*)\.ts/g;
/**
 * The modules a file reaches: static and dynamic imports, re-exports, and
 * new URL("...", import.meta.url) for a module that is spawned or an asset
 * directory. Only relative and #src specifiers; packages are node: built-ins.
 */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\bnew URL\(\s*)(["'])((?:\.\.?\/|#src\/)[^"']*)\1/g;

/**
 * The package.json of an installed skill: ES modules, #src/* resolved inside
 * the skill, and the version of c64-re-tools that the copy comes from.
 */
export const SKILL_PACKAGE = `${JSON.stringify({ type: "module", version: PACKAGE.version, imports: { "#src/*": "./src/*" } }, null, 2)}\n`;

/** The scripts that a SKILL.md runs, by file name. */
export function scriptsOf(skillMarkdown: string): string[] {
  return [...new Set([...skillMarkdown.matchAll(SCRIPT_REFERENCE)].map((match) => match[1]!))].sort();
}

function filesBelow(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((path) => join(directory, path))
    .filter((path) => statSync(path).isFile())
    .sort();
}

const inside = (directory: string, path: string) => path === directory || path.startsWith(directory + sep);

/**
 * Every file that the given scripts reach, transitively: the scripts, their
 * sibling modules, and the src/ modules and asset directories below them.
 * A reach out of the skill directory and src/ is an error.
 */
export function closureOf(skillDirectory: string, scripts: readonly string[]): string[] {
  const found = new Set<string>();
  const pending = [...scripts];
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (found.has(file)) continue;
    if (!inside(SOURCE, file) && !inside(skillDirectory, file)) throw new Error(`${relative(root, file)} is outside the skill and src/`);
    if (!existsSync(file)) throw new Error(`${relative(root, file)} does not exist`);
    if (statSync(file).isDirectory()) {
      pending.push(...filesBelow(file));
      continue;
    }
    found.add(file);
    if (!file.endsWith(".ts")) continue;
    for (const match of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
      const specifier = match[2]!;
      pending.push(specifier.startsWith("#src/") ? join(SOURCE, specifier.slice("#src/".length)) : resolve(dirname(file), specifier));
    }
  }
  return [...found].sort();
}

/** One skill: SKILL.md frontmatter and body, scripts (executable), the src/ modules they reach, and references. */
function loadSkill(directory: string): Skill {
  const text = readFileSync(join(directory, "SKILL.md"), "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (frontmatter === null) throw new Error(`${directory}/SKILL.md has no frontmatter`);
  const field = (name: string) => {
    const value = new RegExp(`^${name}: (.+)$`, "m").exec(frontmatter[1]!)?.[1];
    if (value === undefined) throw new Error(`${directory}/SKILL.md has no ${name}`);
    return value;
  };
  const scripts = scriptsOf(text).map((script) => join(directory, "scripts", `${script}.ts`));
  const code = closureOf(directory, scripts).map((path) => ({
    path: (inside(SOURCE, path) ? relative(root, path) : relative(directory, path)).split("\\").join("/"),
    content: readFileSync(path, "utf8"),
    ...(scripts.includes(path) ? { executable: true } : {}),
  }));
  const references = filesBelow(join(directory, "references")).map((path) => ({ path: relative(directory, path).split("\\").join("/"), content: readFileSync(path, "utf8") }));
  const resources = [...code, ...references, ...(scripts.length > 0 ? [{ path: "package.json", content: SKILL_PACKAGE }] : [])];
  return defineSkill({
    name: field("name"),
    description: field("description"),
    instructions: text.slice(frontmatter[0].length).replace(/^\n+/, ""),
    ...(resources.length > 0 ? { resources } : {}),
  });
}

function c64Plugin() {
  const skills = readdirSync(join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => loadSkill(join(root, "skills", name)));
  return definePlugin({
    id: "c64-re-tools",
    version: PACKAGE.version,
    description: "Commodore 64 reverse engineering and development: a live VICE emulator, static analysis, disk and BASIC tools, project knowledge, building and testing.",
    author: { name: "Henrik Olsson" },
    homepage: "https://github.com/henols/c64-re-tools",
    license: "MIT",
    skills,
    mcpServers: { "c64-re-tools": MCP_SERVER },
  });
}

export default c64Plugin();
