#!/usr/bin/env bash
# Build and validate the installable c64-re-tools plugin package.
#
# Produces dist/c64-re-tools-<version>.zip from the repository's tracked files
# (via `git archive`, so node_modules, the gitignored tools/ deployment target,
# and any local scratch never leak into the artifact) plus a .sha256 sidecar.
# Before packaging it validates the manifests and layout so a broken plugin
# never ships. Runnable locally and in CI; the CI workflow calls it verbatim.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "package: ERROR: $*" >&2; exit 1; }
note() { echo "package: $*"; }

command -v node >/dev/null 2>&1 || fail "node is required"
command -v git  >/dev/null 2>&1 || fail "git is required"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git work tree"

# --- Validate manifests + layout (fail closed) --------------------------------
note "validating plugin manifests and layout ..."
node - "$ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const errors = [];
const readJson = (rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { errors.push(`missing ${rel}`); return null; }
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { errors.push(`${rel} is not valid JSON: ${e.message}`); return null; }
};
const mustExist = (rel) => { if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`); };

const plugin = readJson(".claude-plugin/plugin.json");
const market = readJson(".claude-plugin/marketplace.json");
const mcp    = readJson(".mcp.json");

if (plugin) {
  if (!plugin.name) errors.push("plugin.json: missing name");
  if (!plugin.version) errors.push("plugin.json: missing version");
}
if (market) {
  if (!Array.isArray(market.plugins) || market.plugins.length === 0)
    errors.push("marketplace.json: plugins[] is empty");
}
// Names + versions must agree across manifests, or `/plugin install name@marketplace` breaks.
if (plugin && market && Array.isArray(market.plugins) && market.plugins[0]) {
  const mp = market.plugins[0];
  if (mp.name !== plugin.name)
    errors.push(`name mismatch: plugin.json "${plugin.name}" vs marketplace plugins[0] "${mp.name}"`);
  if (mp.version !== plugin.version)
    errors.push(`version mismatch: plugin.json "${plugin.version}" vs marketplace plugins[0] "${mp.version}"`);
  if (market.version && market.version !== plugin.version)
    errors.push(`version mismatch: marketplace "${market.version}" vs plugin "${plugin.version}"`);
}
// The bundled MCP server must launch from the plugin root, not a machine-specific path.
if (mcp) {
  const args = JSON.stringify(mcp.mcpServers?.vice?.args ?? []);
  if (!args.includes("${CLAUDE_PLUGIN_ROOT}"))
    errors.push(".mcp.json: vice server args must reference ${CLAUDE_PLUGIN_ROOT}");
}

// Required files.
[".mcp.json", "scripts/ensure-mcp-deps.sh",
 ".claude/mcp/vice/package.json", ".claude/mcp/vice/package-lock.json",
 ".claude/mcp/vice/vice-proxy.ts"].forEach(mustExist);

// Every skill directory must carry a SKILL.md.
const skillsDir = path.join(root, ".claude/skills");
if (fs.existsSync(skillsDir)) {
  for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (d.isDirectory() && !fs.existsSync(path.join(skillsDir, d.name, "SKILL.md")))
      errors.push(`skill "${d.name}" has no SKILL.md`);
  }
} else {
  errors.push("missing .claude/skills/");
}

if (errors.length) {
  console.error("package: manifest/layout validation failed:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`package: manifests OK (plugin "${plugin.name}" v${plugin.version})`);
NODE

VERSION="$(node -p "require('./.claude-plugin/plugin.json').version")"
NAME="$(node -p "require('./.claude-plugin/plugin.json').name")"

# --- Build the artifact from tracked files only -------------------------------
OUTDIR="$ROOT/dist"
mkdir -p "$OUTDIR"
ZIP="$OUTDIR/${NAME}-${VERSION}.zip"
rm -f "$ZIP" "$ZIP.sha256"

note "building $ZIP from tracked files at HEAD ..."
git archive --format=zip --prefix="${NAME}-${VERSION}/" -o "$ZIP" HEAD

# Guard: the artifact must never contain node_modules or the deployment target.
if unzip -l "$ZIP" | grep -qE '/(node_modules|tools)/'; then
  fail "artifact unexpectedly contains node_modules/ or tools/ — check .gitignore / tracked files"
fi

sha256sum "$ZIP" | awk -v f="$(basename "$ZIP")" '{print $1"  "f}' > "$ZIP.sha256"

note "done:"
echo "  artifact : $ZIP"
echo "  files    : $(unzip -l "$ZIP" | tail -1 | awk '{print $2}')"
echo "  sha256   : $(cut -d' ' -f1 "$ZIP.sha256")"
