// node:test coverage of version.ts's template-resolution algorithm (D-2),
// runtime precedence (D-4) and the single-seam invariant (D-5). Every row of
// CONTEXT.md's worked-example table is driven from ONE in-test table below --
// this repo's no-second-list convention -- rather than six separate `test()`
// bodies that could silently drift from the spec one at a time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEV_PLACEHOLDER,
  parseTemplate,
  resolveVersion,
  compareVersions,
  readTemplate,
  runtimeVersion,
} from "./version.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function scratchDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

// ============================================================================
// resolveVersion() -- the six worked examples from CONTEXT.md, verbatim.
// ============================================================================

const WORKED_EXAMPLES: Array<{
  template: string;
  published: string | null;
  version: string;
  rule: "pinned" | "no-published" | "prefix-differs" | "prefix-matches";
}> = [
  { template: "0.2.-", published: "0.1.12", version: "0.2.0", rule: "prefix-differs" },
  { template: "0.2.-", published: "0.2.0", version: "0.2.1", rule: "prefix-matches" },
  { template: "0.3.-", published: "0.2.7", version: "0.3.0", rule: "prefix-differs" },
  { template: "0.-.-", published: "0.2.7", version: "0.3.0", rule: "prefix-matches" },
  { template: "1.0.0", published: "9.9.9", version: "1.0.0", rule: "pinned" },
  { template: "0.2.-", published: null, version: "0.2.0", rule: "no-published" },
];

test("resolveVersion(): all six CONTEXT.md worked examples resolve to the stated version AND rule", () => {
  for (const row of WORKED_EXAMPLES) {
    const result = resolveVersion(row.template, row.published);
    assert.equal(
      result.version,
      row.version,
      `template=${row.template} published=${row.published} expected version ${row.version}, got ${result.version}`
    );
    assert.equal(
      result.rule,
      row.rule,
      `template=${row.template} published=${row.published} expected rule ${row.rule}, got ${result.rule}`
    );
    assert.equal(result.template, row.template);
    assert.equal(result.published, row.published);
  }
});

test("resolveVersion(): the repo's real VERSION resolves to 0.2.0 against an injected published 0.1.12 (D-3)", () => {
  // HERE is .claude/mcp/vice/ -- three levels up is the repo root.
  const realTemplate = readTemplate(join(HERE, "..", "..", ".."));
  assert.ok(realTemplate, "expected a real repo-root VERSION file to exist");
  const result = resolveVersion(realTemplate as string, "0.1.12");
  assert.equal(result.version, "0.2.0");
});

test("parseTemplate(): throws on every malformed shape", () => {
  const bad = ["0.2", "0.2.-.-", "0.x.-", "0.2.-x", "", "   "];
  for (const raw of bad) {
    assert.throws(() => parseTemplate(raw), `expected parseTemplate(${JSON.stringify(raw)}) to throw`);
  }
});

test("parseTemplate(): accepts a well-formed template and returns its three components", () => {
  assert.deepEqual(parseTemplate("0.2.-"), ["0", "2", "-"]);
  assert.deepEqual(parseTemplate("1.0.0"), ["1", "0", "0"]);
});

test("resolveVersion(): an unparseable published string behaves as no-published", () => {
  const result = resolveVersion("0.2.-", "not-a-version");
  assert.equal(result.rule, "no-published");
  assert.equal(result.version, "0.2.0");
});

test("resolveVersion(): a published prerelease suffix is stripped before comparison", () => {
  const result = resolveVersion("0.2.-", "0.2.0-rc.1");
  assert.equal(result.rule, "prefix-matches");
  assert.equal(result.version, "0.2.1");
});

test("compareVersions(): orders a numeric 3-tuple correctly and reports equality", () => {
  assert.equal(compareVersions("0.1.12", "0.2.0"), -1);
  assert.equal(compareVersions("0.2.0", "0.2.1"), -1);
  assert.equal(compareVersions("0.2.1", "0.10.0"), -1);
  assert.equal(compareVersions("0.2.0", "0.1.12"), 1);
  assert.equal(compareVersions("0.2.1", "0.2.1"), 0);
});

// ============================================================================
// readTemplate()
// ============================================================================

test("readTemplate(): trims trailing whitespace/newline from a real VERSION file", () => {
  const dir = scratchDir("version-readtemplate-");
  try {
    writeFileSync(join(dir, "VERSION"), "0.2.-  \n", "utf8");
    assert.equal(readTemplate(dir), "0.2.-");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readTemplate(): returns null, never throws, when no VERSION file exists", () => {
  const dir = scratchDir("version-readtemplate-missing-");
  try {
    assert.equal(readTemplate(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================================
// runtimeVersion() -- D-4 precedence, never throws.
// ============================================================================

test("runtimeVersion(): a real package.json version wins and the repoRoot thunk is never invoked (published-tarball silence guarantee)", () => {
  const dir = scratchDir("version-runtime-pkg-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ version: "0.4.7" }), "utf8");
    let calls = 0;
    const result = runtimeVersion({
      pkgJsonPath: pkgPath,
      repoRoot: () => {
        calls++;
        return dir;
      },
    });
    assert.equal(result, "0.4.7");
    assert.equal(calls, 0, "repoRoot() thunk must not be invoked when package.json already carries a real version");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtimeVersion(): a DEV_PLACEHOLDER package.json falls through to the repo-root VERSION template, rendered dev", () => {
  const dir = scratchDir("version-runtime-dev-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ version: DEV_PLACEHOLDER }), "utf8");
    writeFileSync(join(dir, "VERSION"), "0.2.-\n", "utf8");
    const result = runtimeVersion({ pkgJsonPath: pkgPath, repoRoot: () => dir });
    assert.equal(result, "0.2.0-dev");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtimeVersion(): a pinned repo-root VERSION template returns verbatim, with no -dev suffix", () => {
  const dir = scratchDir("version-runtime-pinned-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ version: DEV_PLACEHOLDER }), "utf8");
    writeFileSync(join(dir, "VERSION"), "1.0.0\n", "utf8");
    const result = runtimeVersion({ pkgJsonPath: pkgPath, repoRoot: () => dir });
    assert.equal(result, "1.0.0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtimeVersion(): degrades to DEV_PLACEHOLDER without throwing when given nothing, a missing package.json, or a throwing repoRoot thunk", () => {
  assert.equal(runtimeVersion({}), DEV_PLACEHOLDER);

  const missingPkg = join(scratchDir("version-runtime-missing-"), "package.json");
  assert.equal(runtimeVersion({ pkgJsonPath: missingPkg }), DEV_PLACEHOLDER);

  const dir = scratchDir("version-runtime-throws-");
  try {
    const pkgPath = join(dir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ version: DEV_PLACEHOLDER }), "utf8");
    const result = runtimeVersion({
      pkgJsonPath: pkgPath,
      repoRoot: () => {
        throw new Error("boom");
      },
    });
    assert.equal(result, DEV_PLACEHOLDER);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Task 2 adds a placeholder-consistency invariant, a single-implementation
// guard over scripts/version.mjs, and a PROXY_VERSION guard over
// vice-proxy.ts to this file -- once those consumers exist.
