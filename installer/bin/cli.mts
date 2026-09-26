#!/usr/bin/env node
// cli.mts
//
// WHY THIS FILE EXISTS: the @henols/c64-re-tools installer. It copies the
// bundled skills into <target>/.claude/skills/ and nothing else:
//   npx @henols/c64-re-tools [targetDir] [--force] [--dry-run]
// It runs from node_modules (npx), where Node never strips types, so
// build.ts compiles it to cli.mjs beside this file.
//
// WHAT NOT TO DO:
//   - Never install anything and never spawn npm or npx. The VICE MCP server
//     comes from the Claude Code plugin; this CLI only says so.
//   - Never write or edit a consumer's .mcp.json.
//   - Never import a package-local .ts: only node: builtins, because this
//     package ships only the compiled cli.mjs and targets Node >= 18.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/bin (packed) or repo installer/bin (dev)
const PKG_ROOT = dirname(HERE);
const SKILLS_SRC = join(PKG_ROOT, "skills");

/** Where the MCP server comes from, named in the help, the summary and the
 * refusal of a removed flag. */
export const MCP_SERVER_REMEDY =
  "The VICE MCP server is not installed by this tool. Enable it through the Claude Code plugin: " +
  "`/plugin marketplace add henols/c64-re-tools`, then `/plugin install c64-re-tools@c64-re-tools`.";

/** Flags this installer used to accept and now refuses by name. */
const REMOVED_FLAGS: Record<string, string> = {
  "--vendor": "--vendor is removed: this installer never installs packages.",
};

interface Options {
  force: boolean;
  dryRun: boolean;
  help: boolean;
  target: string | undefined;
}

function readVersion(): string {
  try {
    const pkg: unknown = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));
    if (typeof pkg === "object" && pkg !== null && "version" in pkg && typeof pkg.version === "string") {
      return pkg.version;
    }
  } catch {
    // fall through: an unreadable manifest only affects the banner line
  }
  return "0.0.0";
}

function refuse(message: string): never {
  console.error(`c64-re-tools: ${message}`);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { force: false, dryRun: false, help: false, target: undefined };
  for (const arg of argv) {
    if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run" || arg === "-n") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (Object.hasOwn(REMOVED_FLAGS, arg)) refuse(`${REMOVED_FLAGS[arg]} ${MCP_SERVER_REMEDY}`);
    else if (arg.startsWith("-")) refuse(`unknown flag ${JSON.stringify(arg)} (try --help)`);
    else if (opts.target === undefined) opts.target = arg;
    else refuse(`unexpected extra argument ${JSON.stringify(arg)} (try --help)`);
  }
  return opts;
}

const HELP = `c64-re-tools -- install the C64 reverse-engineering skills into a project

Usage:
  npx @henols/c64-re-tools [targetDir] [options]

Arguments:
  targetDir            Project to install into (default: current directory)

Options:
  --force              Overwrite existing skills
  --dry-run, -n        Show what would change without writing anything
  --help, -h           Show this help

What it does:
  Copies bundled skills into <target>/.claude/skills/. Nothing else is written
  and nothing is installed.

${MCP_SERVER_REMEDY}

The skill scripts run on Node >= 24 (this installer runs on Node >= 18).`;

interface SkillsResult {
  destRoot: string;
  installed: string[];
  skipped: string[];
  total: number;
}

function installSkills(target: string, { force, dryRun }: Options): SkillsResult {
  if (!existsSync(SKILLS_SRC)) {
    console.error(
      `c64-re-tools: FAIL -- bundled skills not found at ${SKILLS_SRC}. ` +
        `(In a dev checkout, run 'node scripts/sync-skills.ts' first.)`
    );
    process.exit(1);
  }
  const names = readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const destRoot = join(target, ".claude", "skills");
  const installed: string[] = [];
  const skipped: string[] = [];
  for (const name of names) {
    const dest = join(destRoot, name);
    if (existsSync(dest) && !force) {
      skipped.push(name);
      continue;
    }
    if (!dryRun) {
      mkdirSync(destRoot, { recursive: true });
      cpSync(join(SKILLS_SRC, name), dest, { recursive: true, force: true });
    }
    installed.push(name);
  }
  return { destRoot, installed, skipped, total: names.length };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }
  const target = resolve(opts.target ?? process.cwd());
  if (!existsSync(target)) {
    console.error(`c64-re-tools: FAIL -- target directory does not exist: ${target}`);
    process.exit(1);
  }

  console.error(`c64-re-tools ${readVersion()} -> ${target}${opts.dryRun ? "  (dry run)" : ""}`);

  const skills = installSkills(target, opts);

  console.error("");
  console.error(`  skills  -> ${skills.destRoot}`);
  console.error(
    `            ${skills.installed.length} installed${
      opts.force ? "" : `, ${skills.skipped.length} already present (use --force to overwrite)`
    } of ${skills.total}`
  );
  if (skills.installed.length) console.error(`            + ${skills.installed.join(", ")}`);
  if (skills.skipped.length && !opts.force) console.error(`            = ${skills.skipped.join(", ")} (kept)`);
  console.error("");
  console.error(MCP_SERVER_REMEDY);
  console.error("");
  if (opts.dryRun) {
    console.error("Dry run -- nothing was written.");
  } else {
    console.error("Done. Restart Claude Code in this project so it picks up the skills.");
    console.error("Note: the skill scripts require Node >= 24.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
