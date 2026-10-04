// Builds the distributable skills into dist/skills (08 §6): each script that
// a SKILL.md runs becomes one self-contained JavaScript file, so a skill copied
// out of this repository needs no src/. The SKILL.md and its references are
// copied with the script paths rewritten from .ts to .js. A skill that runs
// Ghidra gets its language and Ghidra scripts in scripts/ghidra/. The AP SDK plugin
// module goes next to them as dist/plugin.js, for c64-re-tools install.
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
    if (scripts.some((script) => readFileSync(join(target, "scripts", `${script}.js`), "utf8").includes("C64RT_6510"))) {
      for (const asset of ["language", "scripts"]) cpSync(join(root, "src", "native", "ghidra", asset), join(target, "scripts", "ghidra", asset), { recursive: true });
    }
    writeFileSync(join(target, "SKILL.md"), markdown.replace(SCRIPT_REFERENCE, "scripts/$1.js"));
    if (existsSync(join(source, "references"))) cpSync(join(source, "references"), join(target, "references"), { recursive: true });
  }
  return skills;
}

/** The plugin module of the installed package; AP SDK stays a package dependency. */
export async function bundlePlugin(outfile = join(root, "dist", "plugin.js")): Promise<void> {
  await build({
    entryPoints: [join(root, "distribution", "plugin.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    external: ["@jalco/ap-sdk"],
    legalComments: "none",
    logLevel: "warning",
  });
}

if (import.meta.main) {
  const skills = await bundleSkills();
  await bundlePlugin();
  console.log(`bundled ${skills.length} skills into dist/skills and the plugin into dist/plugin.js`);
}
