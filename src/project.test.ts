import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

import { resolveProjectPath } from "./project.ts";

const root = process.cwd();

test("project paths stay under the harness working directory", () => {
  assert.equal(resolveProjectPath("src/main.a", root), resolve(root, "src/main.a"));
  assert.throws(() => resolveProjectPath("../outside", root), /escapes/);
  assert.throws(() => resolveProjectPath(resolve(root, "absolute"), root), /relative/);
});
