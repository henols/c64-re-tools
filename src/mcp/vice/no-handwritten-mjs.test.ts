// no-handwritten-mjs.test.ts
//
// This project is TypeScript only. Every JavaScript file in the tree must be
// compiler output that build.ts owns: a host-bound artifact under
// src/mcp/vice/resources/ or an entry artifact beside its .mts source. Any
// other .mjs/.js/.cjs is hand-written JavaScript and fails here. This is a
// filename check over `git ls-files` (tracked plus untracked, not ignored),
// never a scan of source text. The classifier has a planted-violation proof
// so the test cannot pass by classifying nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { ENTRY_ARTIFACTS, HOST_BOUND_ARTIFACTS, REPO_ROOT } from "./build.ts";

/** Third-party trees that ship their own JavaScript and are not ours. */
const THIRD_PARTY_PREFIXES = [".agents/"];

const JS_FILE = /\.(mjs|cjs|js)$/;

const ALLOWED = new Set<string>([
  ...HOST_BOUND_ARTIFACTS.map((rel) => `src/mcp/vice/resources/${rel}`),
  ...ENTRY_ARTIFACTS.map((a) => a.emitted),
]);

/** Returns every path in `paths` that is JavaScript and not owned by build.ts. */
function handWrittenJs(paths: string[]): string[] {
  return paths
    .filter((p) => JS_FILE.test(p))
    .filter((p) => !THIRD_PARTY_PREFIXES.some((prefix) => p.startsWith(prefix)))
    .filter((p) => !p.split("/").includes("node_modules"))
    .filter((p) => !ALLOWED.has(p))
    .sort();
}

function repoFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\n").filter((line) => line !== "");
}

test("planted violations are caught and build-owned output is not", () => {
  const planted = [
    "skills/c64-basic/scripts/petcat.mjs",
    "test/skills/helper.js",
    "src/mcp/vice/tool.cjs",
    "src/mcp/vice/resources/not-in-the-build-list.mjs",
  ];
  const owned = [
    "src/mcp/vice/resources/vice-broker.mjs",
    "src/mcp/vice/vice-cli.mjs",
    ".agents/skills/mastra/scripts/provider-registry.mjs",
    "src/mcp/vice/node_modules/x/index.js",
    "src/mcp/vice/stock-tools.ts",
  ];
  assert.deepEqual(handWrittenJs([...planted, ...owned]), [...planted].sort());
});

test("no hand-written JavaScript exists in the tree", () => {
  const files = repoFiles();
  assert.ok(files.length > 500, `git ls-files returned only ${files.length} paths -- the scan is not looking at the repository`);
  for (const allowed of ALLOWED) {
    assert.ok(files.includes(allowed), `build-owned ${allowed} is missing from the tree -- run \`node build.ts\``);
  }
  assert.deepEqual(
    handWrittenJs(files),
    [],
    "hand-written JavaScript found. Write TypeScript instead: plain .ts for code that runs from the checkout, " +
      "or an .mts compiled by build.ts (HOST_BOUND_ARTIFACTS / ENTRY_ARTIFACTS) for code that runs from node_modules."
  );
});
