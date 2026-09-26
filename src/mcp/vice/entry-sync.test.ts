// entry-sync.test.ts
//
// The committed entry artifacts (build.ts ENTRY_ARTIFACTS: the vice-mcp bin
// and the installer CLI) must equal a fresh build of their .mts sources. A
// stale bin is what npm would publish, so drift is a test failure. Builds
// through the SAME buildEntries() into a scratch root, so the banner and the
// shebang handling never exist in two implementations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildEntries, ENTRY_ARTIFACTS, REPO_ROOT } from "./build.ts";

test("every committed entry artifact is byte-identical to a fresh build of its .mts source", () => {
  const scratch = mkdtempSync(join(tmpdir(), "entry-sync-"));
  try {
    buildEntries({ outRoot: scratch });
    assert.ok(ENTRY_ARTIFACTS.length > 0, "ENTRY_ARTIFACTS is empty -- nothing is being checked");
    for (const { emitted } of ENTRY_ARTIFACTS) {
      const fresh = readFileSync(join(scratch, emitted));
      let committed: Buffer;
      try {
        committed = readFileSync(join(REPO_ROOT, emitted));
      } catch {
        assert.fail(`${emitted} is missing but a fresh build produces it -- run \`node build.ts\` and commit it`);
      }
      assert.ok(fresh.equals(committed), `${emitted} is STALE -- run \`node build.ts\` in src/mcp/vice and commit the result`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("every entry artifact keeps its shebang on line 1, so it still runs as a package bin", () => {
  for (const { source, emitted } of ENTRY_ARTIFACTS) {
    const text = readFileSync(join(REPO_ROOT, emitted), "utf8");
    assert.ok(text.startsWith("#!/usr/bin/env node\n"), `${emitted} does not start with a shebang`);
    assert.ok(text.includes(`from ${source}.`), `${emitted} does not carry the generated banner naming ${source}`);
  }
});
