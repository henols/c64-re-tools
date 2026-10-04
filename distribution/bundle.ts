// Builds the distributable skills into dist/skills (08 §6): each script that
// a SKILL.md runs becomes one self-contained JavaScript file, so a skill copied
// out of this repository needs no src/. The SKILL.md and its references are
// copied with the script paths rewritten from .ts to .js.
//
// Run: node distribution/bundle.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const SCRIPT_REFERENCE = /scripts\/([a-z][a-z0-9-]*)\.ts/g;

/** The scripts that a SKILL.md runs, by file name. */
export function scriptsOf(skillMarkdown: string): string[] {
  return [...new Set([...skillMarkdown.matchAll(SCRIPT_REFERENCE)].map((match) => match[1]!))].sort();
}

export async function bundleSkills(output = join(root, "dist", "skills")): Promise<string[]> {
  rmSync(output, { recursive: true, force: true });
  const skills = readdirSync(join(root, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const skill of skills) {
    const source = join(root, "skills", skill);
    const target = join(output, skill);
    mkdirSync(target, { recursive: true });
    const markdown = readFileSync(join(source, "SKILL.md"), "utf8");
    const scripts = scriptsOf(markdown);
    for (const script of scripts) {
      const entry = join(source, "scripts", `${script}.ts`);
      if (!existsSync(entry)) throw new Error(`${skill}/SKILL.md runs scripts/${script}.ts, which does not exist`);
      await build({
        entryPoints: [entry],
        outfile: join(target, "scripts", `${script}.js`),
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node24",
        legalComments: "none",
        logLevel: "warning",
      });
    }
    writeFileSync(join(target, "SKILL.md"), markdown.replace(SCRIPT_REFERENCE, "scripts/$1.js"));
    if (existsSync(join(source, "references"))) cpSync(join(source, "references"), join(target, "references"), { recursive: true });
  }
  return skills;
}

if (import.meta.main) {
  const skills = await bundleSkills();
  console.log(`bundled ${skills.length} skills into dist/skills`);
}
