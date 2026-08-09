#!/usr/bin/env node
// Validates what `npm publish` would ship for both npm packages, WITHOUT
// publishing: it runs `npm pack --dry-run --json` in each package dir (which
// also runs the installer's prepack skill-sync) and asserts the tarball's file
// list is correct and lean. Run locally or in CI before the publish job.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

function packFiles(dir) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    name: entry.name,
    version: entry.version,
    files: (entry.files ?? []).map((f) => f.path),
  };
}

// --- @henols/vice-mcp -------------------------------------------------------
const vice = packFiles(join(ROOT, ".claude/mcp/vice"));
need(vice.name === "@henols/vice-mcp", `vice-mcp: name is "${vice.name}", expected "@henols/vice-mcp"`);
need(vice.files.includes("vice-proxy.ts"), "vice-mcp: missing vice-proxy.ts (bin entry)");
need(vice.files.includes("tools-manifest.json"), "vice-mcp: missing tools-manifest.json");
need(vice.files.includes("container-guard.mts"), "vice-mcp: missing container-guard.mts (imported by vice.ts)");
need(vice.files.some((f) => f.startsWith("resources/")), "vice-mcp: missing resources/");
need(!vice.files.some((f) => f.includes("node_modules/")), "vice-mcp: node_modules/ leaked into tarball");
need(
  !vice.files.some((f) => /\.test\.(ts|mts|mjs|js)$/.test(f)),
  "vice-mcp: test files leaked into tarball"
);
need(!vice.files.some((f) => f.startsWith("fixtures/")), "vice-mcp: fixtures/ leaked into tarball");

// --- @henols/c64-re-tools (installer) ---------------------------------------
const inst = packFiles(join(ROOT, "installer"));
need(inst.name === "@henols/c64-re-tools", `installer: name is "${inst.name}", expected "@henols/c64-re-tools"`);
need(inst.files.includes("bin/cli.mjs"), "installer: missing bin/cli.mjs (bin entry)");
const skillMds = inst.files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
need(skillMds.length === 6, `installer: expected 6 skills with SKILL.md, found ${skillMds.length}`);
need(!inst.files.some((f) => f.includes("node_modules/")), "installer: node_modules/ leaked into tarball");

if (errors.length) {
  console.error("check-npm-packages: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `check-npm-packages: OK\n` +
    `  ${vice.name}@${vice.version} -- ${vice.files.length} files\n` +
    `  ${inst.name}@${inst.version} -- ${inst.files.length} files, ${skillMds.length} skills`
);
