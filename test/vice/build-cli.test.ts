// build-cli.test.ts -- `node build.ts --server` honours --out-dir, replaces the
// output in one swap, and runs when reached through a symlink.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { VICE_DIR } from "./paths.ts";

test("build.ts --server writes to --out-dir, drops stale files and leaves dist/ alone", { timeout: 240_000 }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "build-cli-"));
  try {
    const out = join(scratch, "server-out");
    spawnSync("mkdir", ["-p", out]);
    writeFileSync(join(out, "stale.js"), "// stale\n");
    const distBefore = existsSync(join(VICE_DIR, "dist")) ? readdirSync(join(VICE_DIR, "dist")).length : -1;

    const r = spawnSync(process.execPath, [join(VICE_DIR, "build.ts"), "--server", "--out-dir", out], { encoding: "utf8", cwd: scratch });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, new RegExp(`server file\\(s\\) to ${out}`));
    const files = readdirSync(out);
    assert.ok(files.includes("vice-proxy.js"), "the server graph is in --out-dir");
    assert.equal(files.includes("stale.js"), false, "a file the build did not produce is gone");
    assert.equal(readdirSync(scratch).some((n) => n.includes(".old-")), false, "the set-aside copy is removed");
    const distAfter = existsSync(join(VICE_DIR, "dist")) ? readdirSync(join(VICE_DIR, "dist")).length : -1;
    assert.equal(distAfter, distBefore, "the default dist/ was not touched");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("build.ts runs when reached through a symlink", { timeout: 240_000 }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "build-cli-link-"));
  try {
    const link = join(scratch, "build-link.ts");
    symlinkSync(join(VICE_DIR, "build.ts"), link);
    const out = join(scratch, "server-out");
    const r = spawnSync(process.execPath, [link, "--server", "--out-dir", out], { encoding: "utf8", cwd: scratch });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(out, "vice-proxy.js")), "the entry guard fired through the symlink");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
