// Regression coverage for wireMcp() -- the only function in this repository
// that reads, edits and rewrites a file it does not own (a consumer
// project's .mcp.json). Before this file, PKG-01's merge half had zero
// automated coverage: `scripts/package.sh` validates only that the vice
// server's args mention the plugin-root variable, never non-clobbering or
// refusal behaviour.
//
// Every assertion here drives the shipped `installer/bin/cli.mjs` directly
// (wireMcp/readJson exported via the entry-point dispatch guard at the
// bottom of that file) -- there is no second, test-local copy of the merge
// logic. See .planning/phases/16-packaging-and-repo-shape/16-03-PLAN.md.
//
// Happy-path cases (this file's first half) call wireMcp() in-process,
// since it only returns/writes on success. Refusal cases (second half) go
// through a subprocess: wireMcp() calls process.exit(1) on a malformed
// consumer config, which would kill the test runner if called in-process.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { wireMcp, readJson } from "./bin/cli.mjs";

const CLI_PATH = fileURLToPath(new URL("./bin/cli.mjs", import.meta.url));

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "wire-mcp-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/**
 * Drives wireMcp() through a real child process, importing it from the
 * shipped bin/cli.mjs by absolute path (--input-type=module -e), never a
 * shell string. Used only for refusal cases, where wireMcp()'s own
 * process.exit(1) would otherwise terminate the in-process test runner.
 */
function runWireMcpSubprocess(target, opts) {
  const script = [
    `import { wireMcp } from ${JSON.stringify(CLI_PATH)};`,
    `wireMcp(${JSON.stringify(target)}, ${JSON.stringify(opts)});`,
  ].join("\n");
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
  });
}

const DEFAULT_OPTS = { force: false, dryRun: false, vendor: false };

// ---------------------------------------------------------------------------
// Happy paths -- nine behaviours from this plan's Task 1, in-process.
// ---------------------------------------------------------------------------

test("absent consumer config: creates .mcp.json with exactly one mcpServers key, vice; creates missing parent dir", async () => {
  await withTempDir((dir) => {
    const target = join(dir, "nested", "project");
    assert.equal(existsSync(target), false);

    const result = wireMcp(target, DEFAULT_OPTS);
    assert.equal(result.action, "added");
    assert.equal(existsSync(target), true);

    const mcpPath = join(target, ".mcp.json");
    assert.equal(existsSync(mcpPath), true);
    const parsed = readJson(mcpPath);
    assert.equal(typeof parsed, "object");
    assert.deepEqual(Object.keys(parsed.mcpServers), ["vice"]);
  });
});

test("consumer config with two unrelated servers: key set becomes both plus vice, unrelated values deep-equal input", async () => {
  const unrelatedA = { command: "node", args: ["server-a.js", "--flag"] };
  const unrelatedB = {
    command: "python3",
    args: ["-m", "server_b"],
    env: { API_KEY: "secret-b", DEBUG: "0" },
    timeout: 60000,
  };
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    writeFileSync(
      mcpPath,
      JSON.stringify({ mcpServers: { alpha: unrelatedA, beta: unrelatedB } }, null, 2) + "\n"
    );

    const result = wireMcp(dir, DEFAULT_OPTS);
    assert.equal(result.action, "added");

    const parsed = readJson(mcpPath);
    assert.deepEqual(Object.keys(parsed.mcpServers).sort(), ["alpha", "beta", "vice"]);
    assert.deepEqual(parsed.mcpServers.alpha, unrelatedA);
    assert.deepEqual(parsed.mcpServers.beta, unrelatedB);
  });
});

test("consumer config with unrelated top-level keys beside mcpServers: those keys survive unchanged", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const unrelatedTopLevel = { nested: true, list: [1, 2, 3] };
    writeFileSync(
      mcpPath,
      JSON.stringify({ mcpServers: {}, someTopLevelKey: unrelatedTopLevel, schemaVersion: 3 }, null, 2) + "\n"
    );

    wireMcp(dir, DEFAULT_OPTS);

    const parsed = readJson(mcpPath);
    assert.deepEqual(parsed.someTopLevelKey, unrelatedTopLevel);
    assert.equal(parsed.schemaVersion, 3);
    assert.ok(Object.prototype.hasOwnProperty.call(parsed.mcpServers, "vice"));
  });
});

test("consumer config {}: mcpServers is created and vice added", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    writeFileSync(mcpPath, "{}");

    const result = wireMcp(dir, DEFAULT_OPTS);
    assert.equal(result.action, "added");

    const parsed = readJson(mcpPath);
    assert.deepEqual(Object.keys(parsed.mcpServers), ["vice"]);
  });
});

test("consumer config with mcpServers: null: coerced to an object, vice added rather than refused", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    writeFileSync(mcpPath, JSON.stringify({ mcpServers: null }));

    const result = wireMcp(dir, DEFAULT_OPTS);
    assert.equal(result.action, "added");

    const parsed = readJson(mcpPath);
    assert.deepEqual(Object.keys(parsed.mcpServers), ["vice"]);
  });
});

test("consumer config with mcpServers: 42: coerced to an object, vice added rather than refused", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    writeFileSync(mcpPath, JSON.stringify({ mcpServers: 42 }));

    const result = wireMcp(dir, DEFAULT_OPTS);
    assert.equal(result.action, "added");

    const parsed = readJson(mcpPath);
    assert.deepEqual(Object.keys(parsed.mcpServers), ["vice"]);
  });
});

test("existing vice entry, different command/args/env, no force: file bytes unchanged, outcome is kept", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const initial =
      JSON.stringify(
        { mcpServers: { vice: { command: "custom-launcher", args: ["--pinned"], env: { X: "1" } } } },
        null,
        2
      ) + "\n";
    writeFileSync(mcpPath, initial);
    const before = readFileSync(mcpPath, "utf8");

    const result = wireMcp(dir, DEFAULT_OPTS);
    assert.equal(result.action, "kept");

    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
  });
});

test("existing vice entry, different command/args/env, with force: vice replaced, unrelated servers survive", async () => {
  const unrelated = { command: "node", args: ["other.js"] };
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    writeFileSync(
      mcpPath,
      JSON.stringify(
        {
          mcpServers: {
            vice: { command: "custom-launcher", args: ["--pinned"], env: { X: "1" } },
            other: unrelated,
          },
        },
        null,
        2
      ) + "\n"
    );

    const result = wireMcp(dir, { force: true, dryRun: false, vendor: false });
    assert.equal(result.action, "updated");

    const parsed = readJson(mcpPath);
    assert.notDeepEqual(parsed.mcpServers.vice, { command: "custom-launcher", args: ["--pinned"], env: { X: "1" } });
    assert.equal(parsed.mcpServers.vice.command, "npx");
    assert.deepEqual(parsed.mcpServers.other, unrelated);
  });
});

test("idempotence: applying the merge twice without force yields identical content after the second run", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");

    wireMcp(dir, DEFAULT_OPTS);
    const afterFirst = readFileSync(mcpPath, "utf8");

    wireMcp(dir, DEFAULT_OPTS);
    const afterSecond = readFileSync(mcpPath, "utf8");

    assert.equal(afterSecond, afterFirst);
  });
});

test("dry-run, absent-file case: writes nothing, reports what would have happened", async () => {
  await withTempDir((dir) => {
    const target = join(dir, "project");
    const mcpPath = join(target, ".mcp.json");

    const result = wireMcp(target, { force: false, dryRun: true, vendor: false });

    assert.equal(existsSync(mcpPath), false);
    assert.equal(result.action, "added");
  });
});

test("dry-run, existing-file case: file content byte-identical before and after, reports what would have happened", async () => {
  const unrelated = { command: "node", args: ["other.js"] };
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const content = JSON.stringify({ mcpServers: { other: unrelated } }, null, 2) + "\n";
    writeFileSync(mcpPath, content);
    const before = readFileSync(mcpPath, "utf8");

    const result = wireMcp(dir, { force: false, dryRun: true, vendor: false });

    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.equal(result.action, "added");
  });
});

// ---------------------------------------------------------------------------
// Refusal paths -- six malformed consumer-config shapes from this plan's
// Task 2, each proven to refuse totally: non-zero exit, message names the
// file, bytes unchanged, AND no sibling file/dir appears in the scratch
// directory (a refusal that leaves a backup or temp file behind would pass
// the bytes-unchanged check but still be a partial refusal).
// ---------------------------------------------------------------------------

test("refuses truncated JSON: non-zero exit, message names the file, bytes unchanged, no sibling created", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = '{"mcpServers": {';
    writeFileSync(mcpPath, before);
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});

test("refuses an empty (zero-byte) consumer config file -- distinct from a missing file, which instead creates one; easy pair for a future refactor to collapse", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = "";
    writeFileSync(mcpPath, before);
    assert.equal(readFileSync(mcpPath, "utf8").length, 0, "fixture must be a genuine zero-byte file");
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.equal(after.length, 0, "empty file stays zero bytes after refusal");
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});

test("refuses a JSON array root: non-zero exit naming it is not an object, bytes unchanged, no sibling created", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = "[]";
    writeFileSync(mcpPath, before);
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    assert.ok(res.stderr.includes("is not a JSON object"), `stderr should say not-an-object: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});

test("refuses the JSON literal null: non-zero exit, bytes unchanged, no sibling created", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = "null";
    writeFileSync(mcpPath, before);
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});

test("refuses a bare JSON string: non-zero exit, bytes unchanged, no sibling created", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = '"hello"';
    writeFileSync(mcpPath, before);
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});

test("refuses a bare JSON number: non-zero exit, bytes unchanged, no sibling created", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = "42";
    writeFileSync(mcpPath, before);
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});

test("refuses JSON-with-comments: intended/deliberate behaviour, not a gap -- readJson() is a plain JSON.parse, comment-bearing input is unparseable, and refusing to touch the file is strictly safer than guessing at the author's intent and rewriting it", async () => {
  await withTempDir((dir) => {
    const mcpPath = join(dir, ".mcp.json");
    const before = '{\n  // a human comment JSON.parse cannot handle\n  "mcpServers": {}\n}\n';
    writeFileSync(mcpPath, before);
    const entriesBefore = readdirSync(dir).sort();

    const res = runWireMcpSubprocess(dir, DEFAULT_OPTS);

    assert.notEqual(res.status, 0);
    assert.ok(res.stderr.includes(mcpPath), `stderr should name ${mcpPath}: ${res.stderr}`);
    assert.ok(res.stderr.includes("not valid JSON"), `stderr should say not-valid-JSON: ${res.stderr}`);
    const after = readFileSync(mcpPath, "utf8");
    assert.equal(after, before);
    assert.deepEqual(readdirSync(dir).sort(), entriesBefore);
  });
});
