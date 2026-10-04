// The portable c64-re-tools plugin for @jalco/ap-sdk (08 §2-3): the bundled
// skills with their scripts and references, and the VICE MCP declaration.
// AP SDK maps it to each harness's native layout; nothing at run time
// depends on it.
//
// The skills come from the bundles in dist/skills (distribution/bundle.ts):
// next to this module once it is built into dist/, or in ../dist/skills when
// it runs from the repository.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { definePlugin, defineSkill, type Skill } from "@jalco/ap-sdk";

/** The MCP server runs from the installed npm package, never through npx (that installs on every launch). */
export const MCP_COMMAND = "c64-re-tools-mcp";

function skillsDirectory(): string {
  const candidates = [join(import.meta.dirname, "skills"), join(import.meta.dirname, "..", "dist", "skills")];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error("No bundled skills: run the build (node distribution/bundle.ts) first.");
  return found;
}

function packageVersion(): string {
  for (const candidate of [join(import.meta.dirname, "..", "package.json"), join(import.meta.dirname, "..", "..", "package.json")]) {
    if (existsSync(candidate)) {
      const metadata = JSON.parse(readFileSync(candidate, "utf8")) as { name?: string; version?: string };
      if (metadata.name === "@henols/c64-re-tools" && metadata.version !== undefined) return metadata.version;
    }
  }
  return "0.0.0";
}

function filesBelow(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((path) => join(directory, path))
    .filter((path) => statSync(path).isFile())
    .sort();
}

/** One bundled skill: SKILL.md frontmatter and body, scripts (executable) and references. */
export function loadSkill(directory: string): Skill {
  const text = readFileSync(join(directory, "SKILL.md"), "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (frontmatter === null) throw new Error(`${directory}/SKILL.md has no frontmatter`);
  const field = (name: string) => {
    const value = new RegExp(`^${name}: (.+)$`, "m").exec(frontmatter[1]!)?.[1];
    if (value === undefined) throw new Error(`${directory}/SKILL.md has no ${name}`);
    return value;
  };
  const resources = [...filesBelow(join(directory, "scripts")), ...filesBelow(join(directory, "references"))].map((path) => ({
    path: relative(directory, path).split("\\").join("/"),
    content: readFileSync(path, "utf8"),
    ...(path.endsWith(".js") ? { executable: true } : {}),
  }));
  return defineSkill({
    name: field("name"),
    description: field("description"),
    instructions: text.slice(frontmatter[0].length).replace(/^\n+/, ""),
    ...(resources.length > 0 ? { resources } : {}),
  });
}

export function c64Plugin() {
  const directory = skillsDirectory();
  const skills = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => loadSkill(join(directory, name)));
  return definePlugin({
    id: "c64-re-tools",
    version: packageVersion(),
    description: "Commodore 64 reverse engineering and development: a live VICE emulator, static analysis, disk and BASIC tools, project knowledge, building and testing.",
    author: { name: "Henrik Olsson" },
    homepage: "https://github.com/henols/c64-re-tools",
    license: "MIT",
    skills,
    mcpServers: { "c64-re-tools": { command: MCP_COMMAND } },
  });
}

export default c64Plugin();
