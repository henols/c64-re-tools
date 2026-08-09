#!/usr/bin/env node
// @henols/c64-re-tools installer.
//
// Installs the C64 reverse-engineering skills and wires the VICE MCP server into
// a target project:
//   npx @henols/c64-re-tools [targetDir] [--force] [--dry-run] [--vendor]
//
//   * copies the bundled skills into <target>/.claude/skills/
//   * merges a `vice` server entry into <target>/.mcp.json (never clobbering
//     other servers), launching it via `npx -y @henols/vice-mcp`
//   * with --vendor, also `npm install`s @henols/vice-mcp into the project and
//     wires .mcp.json to the local copy (pinned/offline use)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  cpSync,
} from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/bin (packed) or repo installer/bin (dev)
const PKG_ROOT = dirname(HERE);
const SKILLS_SRC = join(PKG_ROOT, "skills");

const SELF = readJson(join(PKG_ROOT, "package.json")) ?? {};
const SELF_VERSION = typeof SELF.version === "string" ? SELF.version : "0.0.0";
const MCP_PKG = "@henols/vice-mcp";
// Wire the project to the exact vice-mcp version this installer was built against.
const MCP_VERSION =
  (SELF.dependencies && typeof SELF.dependencies[MCP_PKG] === "string"
    ? SELF.dependencies[MCP_PKG].replace(/^[\^~]/, "")
    : SELF_VERSION);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function parseArgs(argv) {
  const opts = { force: false, dryRun: false, vendor: false, help: false, target: undefined };
  for (const arg of argv) {
    if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run" || arg === "-n") opts.dryRun = true;
    else if (arg === "--vendor") opts.vendor = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("-")) {
      console.error(`c64-re-tools: unknown flag ${JSON.stringify(arg)} (try --help)`);
      process.exit(2);
    } else if (opts.target === undefined) opts.target = arg;
    else {
      console.error(`c64-re-tools: unexpected extra argument ${JSON.stringify(arg)} (try --help)`);
      process.exit(2);
    }
  }
  return opts;
}

const HELP = `c64-re-tools -- install the C64 reverse-engineering skills + VICE MCP server into a project

Usage:
  npx @henols/c64-re-tools [targetDir] [options]

Arguments:
  targetDir            Project to install into (default: current directory)

Options:
  --force              Overwrite existing skills and an existing 'vice' MCP entry
  --vendor             Also 'npm install -D ${MCP_PKG}' into the project and wire
                       .mcp.json to the local copy (pinned/offline), instead of npx
  --dry-run, -n        Show what would change without writing anything
  --help, -h           Show this help

What it does:
  1. Copies bundled skills into <target>/.claude/skills/
  2. Adds a 'vice' server to <target>/.mcp.json (other servers are preserved)

Requires Node >= 22.18 to RUN the vice MCP server (this installer runs on Node >= 18).`;

function viceServerEntry(vendor) {
  return {
    command: "npx",
    args: vendor ? [MCP_PKG] : ["-y", `${MCP_PKG}@${MCP_VERSION}`],
    timeout: 150000,
    env: { MASTRA_TELEMETRY_DISABLED: "1" },
  };
}

function installSkills(target, { force, dryRun }) {
  if (!existsSync(SKILLS_SRC)) {
    console.error(
      `c64-re-tools: FAIL -- bundled skills not found at ${SKILLS_SRC}. ` +
        `(In a dev checkout, run 'node scripts/sync-skills.mjs' first.)`
    );
    process.exit(1);
  }
  const names = readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const destRoot = join(target, ".claude", "skills");
  const installed = [];
  const skipped = [];
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

function wireMcp(target, { force, dryRun, vendor }) {
  const mcpPath = join(target, ".mcp.json");
  let config = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    const parsed = readJson(mcpPath);
    if (parsed === undefined) {
      console.error(
        `c64-re-tools: FAIL -- ${mcpPath} exists but is not valid JSON. ` +
          `Refusing to overwrite it; fix or remove it and re-run.`
      );
      process.exit(1);
    }
    config = parsed;
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      console.error(`c64-re-tools: FAIL -- ${mcpPath} is not a JSON object.`);
      process.exit(1);
    }
    if (typeof config.mcpServers !== "object" || config.mcpServers === null) {
      config.mcpServers = {};
    }
  }
  const existed = Object.prototype.hasOwnProperty.call(config.mcpServers, "vice");
  let action;
  if (existed && !force) {
    action = "kept"; // leave the user's existing entry alone
  } else {
    action = existed ? "updated" : "added";
    if (!dryRun) {
      config.mcpServers.vice = viceServerEntry(vendor);
      mkdirSync(dirname(mcpPath), { recursive: true });
      writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n");
    }
  }
  return { mcpPath, action };
}

function vendorInstall(target, { dryRun }) {
  const spec = `${MCP_PKG}@${MCP_VERSION}`;
  if (dryRun) return { ran: false, spec };
  const res = spawnSync("npm", ["install", "--save-dev", spec], {
    cwd: target,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.error(
      `c64-re-tools: WARN -- 'npm install --save-dev ${spec}' exited ${res.status}. ` +
        `Skills and .mcp.json were still written; install the package manually if needed.`
    );
    return { ran: true, ok: false, spec };
  }
  return { ran: true, ok: true, spec };
}

function main() {
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

  console.error(`c64-re-tools ${SELF_VERSION} -> ${target}${opts.dryRun ? "  (dry run)" : ""}`);

  const skills = installSkills(target, opts);
  if (opts.vendor) vendorInstall(target, opts);
  const mcp = wireMcp(target, opts);

  // Summary
  console.error("");
  console.error(`  skills  -> ${skills.destRoot}`);
  console.error(
    `            ${skills.installed.length} installed${
      opts.force ? "" : `, ${skills.skipped.length} already present (use --force to overwrite)`
    } of ${skills.total}`
  );
  if (skills.installed.length) console.error(`            + ${skills.installed.join(", ")}`);
  if (skills.skipped.length && !opts.force)
    console.error(`            = ${skills.skipped.join(", ")} (kept)`);
  console.error(`  mcp     -> ${mcp.mcpPath}`);
  if (mcp.action === "kept") {
    console.error(`            'vice' already configured -- kept (use --force to overwrite)`);
  } else {
    console.error(
      `            'vice' ${mcp.action}${
        opts.vendor ? ` (local ${MCP_PKG})` : ` (npx -y ${MCP_PKG}@${MCP_VERSION})`
      }`
    );
  }
  console.error("");
  if (opts.dryRun) {
    console.error("Dry run -- nothing was written.");
  } else {
    console.error("Done. Restart Claude Code in this project so it picks up the skills and MCP server.");
    console.error("Note: running the vice MCP server requires Node >= 22.18 (or >= 23.6).");
  }
}

main();
