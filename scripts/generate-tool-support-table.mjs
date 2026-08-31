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
// drift by src/mcp/vice/tool-support-table.test.mjs's byte-identity test.
//
// D-E, ONE SOURCE OF TRUTH: this script imports CAPABILITY_REGISTRY directly
// from src/mcp/vice/capability-registry.ts rather than holding any reason
// text of its own. If a Note column reads wrong, the fix is always in that
// registry, never here.
//
// NEW CROSS-BOUNDARY PRECEDENT: every existing script under scripts/ only
// reads JSON out of src/mcp/vice/ (see check-skill-tool-coverage.mjs). This
// is the first script/ file to import src/mcp/vice/*.ts directly. That
// works because this whole repo runs on Node's native TypeScript
// type-stripping (no build step for the shipped server) and a repo-root .mjs
// importing a sibling .ts resolves and executes with no flag under Node
// 22.22 -- verified empirically this session. Importing (D-E, single source
// of truth) is preferred here over re-reading vice.ts's DENY_LIST as text,
// for the same reason: two readers of the same fact can never disagree.
//
// WHAT THIS SCRIPT NEVER DOES: it never writes anything except through the
// CLI's direct-invocation guard at the bottom (following
// src/mcp/vice/test-gate.mjs's import.meta.url guard), and
// generateToolSupportTable() itself performs zero I/O side effects beyond the
// readFileSync calls needed to compute its return value -- it is a pure
// function of its inputs, which is what makes
// src/mcp/vice/tool-support-table.test.mjs's fixture-driven structural
// tests possible.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { CAPABILITY_REGISTRY } from "../src/mcp/vice/capability-registry.ts";
import { DENY_LIST } from "../src/mcp/vice/vice.ts";
import { resolveContainedRoot } from "./lib/audit-root.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = dirname(HERE);

/**
 * Every path this script reads AND THE ONE IT WRITES, derived from a single
 * `root`. This is not a tidying-up. The phase-32 audit has to observe this
 * generator FAILING against a planted subject, and the only safe way to do
 * that is to point the whole script -- including `outputPath` -- at a
 * synthetic tree. While the write target was a module-scope constant anchored
 * on `import.meta.url`, any such measurement would have clobbered the
 * repository's real `docs/tool-support.md`, a file the milestone close gate
 * requires byte-identical (and which `tool-support-table.test.mjs` pins).
 *
 * WHAT NOT TO DO: do not reintroduce a second path constant derived from
 * `DEFAULT_ROOT` outside this function. A root threaded through only SOME of
 * the paths reads one tree and writes another, which is worse than no flag at
 * all -- it would make a planted violation silently unobservable while still
 * overwriting the real table.
 */
function paths(root) {
  const viceDir = join(root, "src/mcp/vice");
  return {
    root,
    viceDir,
    forkManifestPath: join(viceDir, "tools-manifest.json"),
    stockManifestPath: join(viceDir, "tools-manifest.stock.json"),
    proxySourcePath: join(viceDir, "vice-proxy.ts"),
    outputPath: join(root, "docs/tool-support.md"),
  };
}

const DEFAULT_PATHS = paths(DEFAULT_ROOT);

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

/** Markdown table cells cannot contain a raw pipe or newline -- registry
 * prose (row.name, row.note) is user-facing and may acquire either in the
 * future (WR-04, 08-REVIEW.md:330-362). Escaped here, at the ONE emission
 * point, rather than at each field's origin -- so a future third free-text
 * column needs no new escaping call site of its own. */
const cell = (text) => text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

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
 * Any OTHER captured identifier that resolves to neither a loop-variable
 * pattern nor a `const IDENT: ToolDefinition = {...}` declaration throws --
 * a silently dropped identifier is the same incompleteness failure as a
 * hand-curated exclusion, and worse, because it leaves no trace to notice.
 *
 * A SECOND loop registration exists, structurally identical in shape
 * (`tools[IDENT.name] = ...` inside `for (const IDENT of
 * ANNO_TOOL_DEFINITIONS)`) but semantically different: the anno_* family is
 * not a VICE emulator capability at all (D-16/Rule A18 -- the annotation
 * store is a proxy-local SQLite file and never touches VICE), so it has no
 * fork-vs-stock availability distinction for this table to render. It is
 * excluded the SAME way the manifest loop's own `def` is -- structurally, by
 * matching its own loop-variable pattern -- rather than added to the
 * "synthetic, available on both backends" set the three single-const
 * registrations (vice_result_continue/vice_recycle/vice_diagnose) belong to.
 */
export function discoverSyntheticToolNames(proxySource) {
  const REGISTRATION_RE = /tools\[(\w+)\.name\]\s*=/g;
  const LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+manifestTools\s*\)/;
  const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/;

  const loopVarMatch = proxySource.match(LOOP_VAR_RE);
  const loopVar = loopVarMatch ? loopVarMatch[1] : null;
  const annoLoopVarMatch = proxySource.match(ANNO_LOOP_VAR_RE);
  const annoLoopVar = annoLoopVarMatch ? annoLoopVarMatch[1] : null;

  const seenIdents = new Set();
  const names = [];
  let match;
  while ((match = REGISTRATION_RE.exec(proxySource)) !== null) {
    const ident = match[1];
    if (seenIdents.has(ident)) continue;
    seenIdents.add(ident);

    if (ident === loopVar) continue; // the manifest loop's own registration -- not synthetic
    if (ident === annoLoopVar) continue; // the anno_* family's own loop registration -- not a VICE capability at all

    // WR-08: bound the search to THIS declaration's own body before extracting
    // its name, so a declaration with no `name:` field (a spread, a computed
    // key, a helper-built definition) throws below instead of the unbounded
    // `[\s\S]*?` walking past the closing brace and silently borrowing a LATER
    // declaration's `name:` -- a plausible-looking wrong tool name is worse
    // than the throw the header comment above already promises.
    //
    // This bounding expression is independently written in three places
    // (here, tool-support-table.test.mjs, capability-registry.test.ts) BY
    // DESIGN -- each is a separate witness proving the other two right, the
    // same reason tool-support-table.test.mjs never imports this function.
    // Do not "helpfully" extract a shared bounding helper; that would
    // collapse three independent witnesses into one and destroy the property.
    const declOpenRe = new RegExp(`const\\s+${ident}\\s*:\\s*ToolDefinition\\s*=\\s*\\{`);
    const declStart = proxySource.search(declOpenRe);
    if (declStart === -1) {
      throw new Error(
        `generate-tool-support-table: could not resolve synthetic tool registration identifier ` +
          `"${ident}" (from \`tools[${ident}.name] = ...\`) to a declaration -- expected a ` +
          `\`const ${ident}: ToolDefinition = { ... }\` declaration in vice-proxy.ts. Add the ` +
          "declaration, or if this is not a synthetic proxy-local tool registration, fix the discovery " +
          "regex explicitly rather than silently dropping the identifier.",
      );
    }
    const declEndOffset = proxySource.slice(declStart + 1).search(/\n(?:const|function|export)\s/);
    const declBody =
      declEndOffset === -1 ? proxySource.slice(declStart) : proxySource.slice(declStart, declStart + 1 + declEndOffset);
    const declMatch = declBody.match(/^[^{]*\{\s*name:\s*"([^"]+)"/);
    if (!declMatch) {
      throw new Error(
        `generate-tool-support-table: "${ident}"'s own declaration body (bounded up to the next ` +
          `top-level const/function/export) has no \`name: "..."\` field -- refusing to borrow a ` +
          "later declaration's name. Add a `name:` field to this declaration.",
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
    forkManifestPath = DEFAULT_PATHS.forkManifestPath,
    stockManifestPath = DEFAULT_PATHS.stockManifestPath,
    registry = CAPABILITY_REGISTRY,
    proxySourcePath = DEFAULT_PATHS.proxySourcePath,
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
    lines.push(`| ${cell(row.name)} | ${forkCell} | ${stockCell} | ${cell(row.note)} |`);
  }
  lines.push("");
  lines.push(
    "See `docs/stock-vice-parity.md` for the full narrative reasoning behind every divergence above.",
  );

  return lines.join("\n") + "\n";
}

// -------------------------------------------------------------------- CLI
//
// `--root <dir>` is the ONLY new surface here, and it is the only testability
// seam this script has: there is deliberately no environment-variable
// override, no `--check` bypass and no waiver file anywhere in it (the
// no-relaxation-hatch rule recorded in `scripts/audit-gate.mjs`'s header).
// Same argv shape as that file's own `parseArgs()`.
function parseArgs(argv) {
  let root;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      root = argv[i + 1];
      i += 1;
    }
  }
  return { root };
}

function main() {
  const { root: rootArg } = parseArgs(process.argv.slice(2));

  // A REFUSAL (an out-of-repository --root) and a TYPO (a --root inside the
  // repository that does not exist) exit with the SAME code, so they are
  // separated by their message -- the WR-03 contract behind audit-gate.mjs's
  // own try/catch, where a mistyped root used to surface as an uncaught ENOENT
  // indistinguishable from a legitimate refusal.
  let root;
  try {
    root = resolveContainedRoot(rootArg, { repoRoot: DEFAULT_ROOT });
  } catch (e) {
    process.stderr.write(
      `generate-tool-support-table: REFUSED -- ${e?.message ?? String(e)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const p = paths(root);
  try {
    if (!existsSync(p.root)) {
      throw new Error(
        `--root resolves to ${p.root}, which does not exist. This is a TYPO, not a ` +
          "containment refusal: the path is inside the repository root but there is no such " +
          "directory.",
      );
    }
    const outputDir = dirname(p.outputPath);
    if (!existsSync(outputDir)) {
      throw new Error(
        `${outputDir} does not exist, so the table cannot be written there. A --root tree must ` +
          "carry its own docs/ directory; this script never creates one, because a synthetic " +
          "tree that silently grows directories is not the tree the operator thought they " +
          "pointed at.",
      );
    }
    const doc = generateToolSupportTable({
      forkManifestPath: p.forkManifestPath,
      stockManifestPath: p.stockManifestPath,
      proxySourcePath: p.proxySourcePath,
    });
    writeFileSync(p.outputPath, doc);
    // The unflagged invocation's message stays byte-identical to the pre-flag
    // one (`relative()` yields exactly `docs/tool-support.md` for the default
    // root); the `under --root` clause appears ONLY when a root was supplied,
    // so an operator can never mistake which tree was written.
    const rel = relative(p.root, p.outputPath);
    const where = p.root === DEFAULT_ROOT ? "" : ` under --root ${p.root}`;
    process.stderr.write(`generate-tool-support-table: wrote ${rel}${where}\n`);
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
