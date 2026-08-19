#!/usr/bin/env node
// generate-tool-support-table.mjs
//
// WHY THIS FILE EXISTS (DIST-01, D-D): before this script, "which backend
// supports which tool" lived only in a reader's head, reconstructed by
// diffing tools-manifest.json against tools-manifest.stock.json by eye. That
// is exactly the hand-derivation criterion 4 forbids. This script computes
// the whole answer mechanically from three inputs -- the two shipped
// manifests plus capability-registry.ts -- and emits it as one markdown
// document, docs/tool-support.md. The committed copy is guarded against
// drift by .claude/mcp/vice/tool-support-table.test.mjs's byte-identity test.
//
// D-E, ONE SOURCE OF TRUTH: this script imports CAPABILITY_REGISTRY directly
// from .claude/mcp/vice/capability-registry.ts rather than holding any reason
// text of its own. If a Note column reads wrong, the fix is always in that
// registry, never here.
//
// NEW CROSS-BOUNDARY PRECEDENT: every existing script under scripts/ only
// reads JSON out of .claude/mcp/vice/ (see check-skill-tool-coverage.mjs). This
// is the first script/ file to import .claude/mcp/vice/*.ts directly. That
// works because this whole repo runs on Node's native TypeScript
// type-stripping (no build step for the shipped server) and a repo-root .mjs
// importing a sibling .ts resolves and executes with no flag under Node
// 22.22 -- verified empirically this session. Importing (D-E, single source
// of truth) is preferred here over re-reading vice.ts's DENY_LIST as text,
// for the same reason: two readers of the same fact can never disagree.
//
// WHAT THIS SCRIPT NEVER DOES: it never writes anything except through the
// CLI's direct-invocation guard at the bottom (following
// .claude/mcp/vice/test-gate.mjs's import.meta.url guard), and
// generateToolSupportTable() itself performs zero I/O side effects beyond the
// readFileSync calls needed to compute its return value -- it is a pure
// function of its inputs, which is what makes
// .claude/mcp/vice/tool-support-table.test.mjs's fixture-driven structural
// tests possible.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { CAPABILITY_REGISTRY } from "../.claude/mcp/vice/capability-registry.ts";
import { DENY_LIST } from "../.claude/mcp/vice/vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const VICE_DIR = join(ROOT, ".claude/mcp/vice");

const DEFAULT_FORK_MANIFEST_PATH = join(VICE_DIR, "tools-manifest.json");
const DEFAULT_STOCK_MANIFEST_PATH = join(VICE_DIR, "tools-manifest.stock.json");
const DEFAULT_PROXY_SOURCE_PATH = join(VICE_DIR, "vice-proxy.ts");
const OUTPUT_PATH = join(ROOT, "docs/tool-support.md");

const REGEN_COMMAND = "node scripts/generate-tool-support-table.mjs";

/** Human-facing label per capability-registry.ts category (Pitfall 3): the
 * "hardware" label must be visibly distinct from "descoped" so a reader can
 * tell "will never work" from "nobody built it yet" without opening
 * docs/stock-vice-parity.md. Only the hardware label carries the literal
 * token "unrecoverable", mirroring capabilityRefusalMessage()'s own
 * never-use-that-word-for-descoped contract in capability-registry.ts. */
const CATEGORY_LABEL = {
  hardware: "hardware-unrecoverable",
  descoped: "not yet built (descoped)",
  "stock-only-gain": "stock-only gain",
};

const AVAILABLE_MARK = "✅"; // checkmark
const UNAVAILABLE_MARK = "—"; // em dash

/**
 * Two-hop discovery of the proxy-local synthetic tool names (research
 * Pitfall 2): `vice-proxy.ts` registers `vice_result_continue`,
 * `vice_recycle` and `vice_diagnose` on BOTH backends via
 * `tools[IDENT.name] = ...` sites where `IDENT` is a module-level
 * `const IDENT: ToolDefinition = { name: "..." }` declaration -- never a
 * string literal at the registration site itself. The manifest loop's own
 * `tools[def.name] = ...` site uses the SAME shape but `def` is a `for (const
 * def of manifestTools)` loop variable, not a `ToolDefinition` declaration,
 * so it is excluded structurally (by matching the loop-variable pattern),
 * never by hardcoding the name "def".
 *
 * Any OTHER captured identifier that resolves to neither the loop-variable
 * pattern nor a `const IDENT: ToolDefinition = {...}` declaration throws --
 * a silently dropped identifier is the same incompleteness failure as a
 * hand-curated exclusion, and worse, because it leaves no trace to notice.
 */
export function discoverSyntheticToolNames(proxySource) {
  const REGISTRATION_RE = /tools\[(\w+)\.name\]\s*=/g;
  const LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+manifestTools\s*\)/;

  const loopVarMatch = proxySource.match(LOOP_VAR_RE);
  const loopVar = loopVarMatch ? loopVarMatch[1] : null;

  const seenIdents = new Set();
  const names = [];
  let match;
  while ((match = REGISTRATION_RE.exec(proxySource)) !== null) {
    const ident = match[1];
    if (seenIdents.has(ident)) continue;
    seenIdents.add(ident);

    if (ident === loopVar) continue; // the manifest loop's own registration -- not synthetic

    const declRe = new RegExp(
      `const\\s+${ident}\\s*:\\s*ToolDefinition\\s*=\\s*\\{[\\s\\S]*?name:\\s*"([^"]+)"`,
    );
    const declMatch = proxySource.match(declRe);
    if (!declMatch) {
      throw new Error(
        `generate-tool-support-table: could not resolve synthetic tool registration identifier ` +
          `"${ident}" (from \`tools[${ident}.name] = ...\`) to a literal tool name -- expected a ` +
          `\`const ${ident}: ToolDefinition = { name: "..." }\` declaration in vice-proxy.ts. Add the ` +
          "declaration, or if this is not a synthetic proxy-local tool registration, fix the discovery " +
          "regex explicitly rather than silently dropping the identifier.",
      );
    }
    names.push(declMatch[1]);
  }
  return names.sort();
}

/**
 * Pure. Returns the complete markdown document as a string; performs no
 * writes. Every option defaults to the real repo path or the real imported
 * CAPABILITY_REGISTRY -- overriding any of them is what makes
 * tool-support-table.test.mjs's fixture-driven structural tests and Task 1's
 * own transient-edit proofs possible without ever touching a real file.
 */
export function generateToolSupportTable(options = {}) {
  const {
    forkManifestPath = DEFAULT_FORK_MANIFEST_PATH,
    stockManifestPath = DEFAULT_STOCK_MANIFEST_PATH,
    registry = CAPABILITY_REGISTRY,
    proxySourcePath = DEFAULT_PROXY_SOURCE_PATH,
  } = options;

  const forkManifest = JSON.parse(readFileSync(forkManifestPath, "utf8"));
  const stockManifest = JSON.parse(readFileSync(stockManifestPath, "utf8"));
  const proxySource = readFileSync(proxySourcePath, "utf8");

  const forkNames = new Set(forkManifest.tools.map((t) => t.name));
  const stockNames = new Set(stockManifest.tools.map((t) => t.name));

  // Remove every DENY_LIST name from both sets -- host meta-tools, not
  // capabilities, already carrying a different refusal shape (vice.ts).
  for (const deniedName of DENY_LIST) {
    forkNames.delete(deniedName);
    stockNames.delete(deniedName);
  }

  // Add the mechanically-discovered proxy-local synthetic names to BOTH
  // sets -- they are advertised on both backends regardless of which raw
  // manifest happens to list them (research Pitfall 2).
  const syntheticNames = discoverSyntheticToolNames(proxySource);
  for (const name of syntheticNames) {
    forkNames.add(name);
    stockNames.add(name);
  }

  const unionNames = new Set([...forkNames, ...stockNames]);
  const sortedNames = [...unionNames].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const registryByName = new Map(registry.map((entry) => [entry.name, entry]));

  let sharedCount = 0;
  let forkOnlyCount = 0;
  let stockOnlyCount = 0;
  const rows = [];

  for (const name of sortedNames) {
    const onFork = forkNames.has(name);
    const onStock = stockNames.has(name);
    let note = "";

    if (onFork && onStock) {
      sharedCount += 1;
    } else {
      if (onFork) forkOnlyCount += 1;
      else stockOnlyCount += 1;

      const entry = registryByName.get(name);
      if (!entry) {
        throw new Error(
          `generate-tool-support-table: "${name}" is available on only one backend ` +
            `(fork=${onFork}, stock=${onStock}) but has no capability-registry.ts entry -- add one ` +
            "naming the reason; a silent blank Note is how this table would rot.",
        );
      }
      const label = CATEGORY_LABEL[entry.category];
      note = `${label}: ${entry.reason}`;
      if (entry.alternative) note += ` ${entry.alternative}`;
    }

    rows.push({ name, onFork, onStock, note });
  }

  const lines = [];
  lines.push(
    `<!-- GENERATED FILE -- DO NOT EDIT BY HAND. Regenerate with: ${REGEN_COMMAND} -->`,
  );
  lines.push("");
  lines.push("# VICE MCP tool support by backend");
  lines.push("");
  lines.push(
    "The fork and stock backends deliberately advertise different tool lists. A tool advertised " +
      "on both backends keeps the same name and a backward-compatible argument shape on either " +
      "one — stock may add optional parameters but never removes, retypes, or newly-requires " +
      "one. Calling a tool the " +
      "active backend does not advertise returns an error naming the reason and the backend that " +
      "does provide it.",
  );
  lines.push("");
  lines.push(`- Total tools: ${rows.length}`);
  lines.push(`- Available on both backends: ${sharedCount}`);
  lines.push(`- Fork-only: ${forkOnlyCount}`);
  lines.push(`- Stock-only: ${stockOnlyCount}`);
  lines.push(`- Fork manifest generated at: ${forkManifest.generated_at}`);
  lines.push(`- Stock manifest generated at: ${stockManifest.generated_at}`);
  lines.push("");
  lines.push(`Legend: ${AVAILABLE_MARK} available, ${UNAVAILABLE_MARK} not available.`);
  lines.push("");
  lines.push("| Tool | Fork | Stock | Note |");
  lines.push("|------|------|-------|------|");
  for (const row of rows) {
    const forkCell = row.onFork ? AVAILABLE_MARK : UNAVAILABLE_MARK;
    const stockCell = row.onStock ? AVAILABLE_MARK : UNAVAILABLE_MARK;
    lines.push(`| ${row.name} | ${forkCell} | ${stockCell} | ${row.note} |`);
  }
  lines.push("");
  lines.push(
    "See `docs/stock-vice-parity.md` for the full narrative reasoning behind every divergence above.",
  );

  return lines.join("\n") + "\n";
}

// -------------------------------------------------------------------- CLI
function main() {
  try {
    const doc = generateToolSupportTable();
    writeFileSync(OUTPUT_PATH, doc);
    process.stderr.write(`generate-tool-support-table: wrote docs/tool-support.md\n`);
  } catch (e) {
    process.stderr.write(`generate-tool-support-table: FAILED -- ${e.message}\n`);
    process.exitCode = 1;
  }
}

// Only run when invoked directly, never when imported by
// tool-support-table.test.mjs -- follows test-gate.mjs's own guard shape.
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
