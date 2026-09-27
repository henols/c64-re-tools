// entry-sync.test.ts
//
// The committed entry artifacts (build.ts ENTRY_ARTIFACTS: the vice-mcp bin)
// are what npm publishes. Each one must keep its shebang on line 1 and carry
// the generated banner that names its .mts source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ENTRY_ARTIFACTS, REPO_ROOT } from "./build.ts";

test("every entry artifact keeps its shebang on line 1, so it still runs as a package bin", () => {
  assert.ok(ENTRY_ARTIFACTS.length > 0, "ENTRY_ARTIFACTS is empty -- nothing is being checked");
  for (const { source, emitted } of ENTRY_ARTIFACTS) {
    const text = readFileSync(join(REPO_ROOT, emitted), "utf8");
    assert.ok(text.startsWith("#!/usr/bin/env node\n"), `${emitted} does not start with a shebang`);
    assert.ok(text.includes(`from ${source}.`), `${emitted} does not carry the generated banner naming ${source}`);
  }
});
