import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { parseTargets, removeEmptyDirectories, tidyAfterUninstall, undoWindsurfProjectMcp, windsurfBefore, withoutWindsurfMcp } from "./cleanup.ts";

const ESC = String.fromCharCode(27);

test("the AP SDK report loses only its Windsurf MCP line and that line's detail, also in colour", () => {
  const report = [
    "  c64-re-tools — Installed (project)",
    "",
    `  ${ESC}[32m✓${ESC}[0m windsurf   skill   c64-unpacker → .windsurf/skills/c64-unpacker`,
    `  ${ESC}[32m✓${ESC}[0m windsurf   mcp     c64-re-tools → /home/user/.codeium/windsurf/mcp_config.json`,
    `           ${ESC}[2m↳ merged 1 server(s) under "mcpServers"${ESC}[0m`,
    `  ${ESC}[32m✓${ESC}[0m claude     mcp     c64-re-tools → .mcp.json`,
    `           ${ESC}[2m↳ merged 1 server(s) under "mcpServers"${ESC}[0m`,
    "",
  ].join("\n");
  const kept = withoutWindsurfMcp(report);
  assert.doesNotMatch(kept, /mcp_config\.json/);
  assert.match(kept, /windsurf {3}skill/);
  assert.match(kept, /claude {5}mcp/);
  assert.equal(kept.split("\n").length, report.split("\n").length - 2);
});

test("--target splits into harnesses; no value means all", () => {
  assert.equal(parseTargets(undefined), undefined);
  assert.deepEqual(parseTargets("claude, gemini,,"), ["claude", "gemini"]);
});

test("empty directories go up to the stop directory; a directory with a file stays", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-tidy-"));
  try {
    mkdirSync(join(root, ".claude", "skills", "c64-disk", "src", "host-client"), { recursive: true });
    mkdirSync(join(root, ".claude", "agents"), { recursive: true });
    writeFileSync(join(root, ".claude", "agents", "mine.md"), "kept");
    mkdirSync(join(root, ".ap-sdk"));
    writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: {} }));
    writeFileSync(join(root, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json", mcp: {}, theme: "dark" }));
    tidyAfterUninstall(
      [
        { harness: "claude", kind: "skill", name: "c64-disk", files: [".claude/skills/c64-disk/src/host-client/tools.ts"] },
        { harness: "claude", kind: "mcp", name: ["c64-re-tools"], files: [".mcp.json"], detail: { mergeKey: "mcpServers", names: ["c64-re-tools"] } },
        { harness: "opencode", kind: "mcp", name: ["c64-re-tools"], files: ["opencode.json"], detail: { mergeKey: "mcp", names: ["c64-re-tools"] } },
      ],
      "project",
      root,
    );
    assert.deepEqual(readdirSync(root).sort(), [".claude", "opencode.json"], "the configuration with other settings stays");
    assert.deepEqual(readdirSync(join(root, ".claude")), ["agents"]);
    removeEmptyDirectories(join(root, "..", "elsewhere"), root);
    assert.ok(readdirSync(root).length > 0, "nothing outside the stop directory is touched");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Runs `body` with a temporary home directory and project; both go afterwards. */
function withHomeAndProject(body: (home: string, project: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), "c64-re-tools-home-"));
  const project = mkdtempSync(join(tmpdir(), "c64-re-tools-project-"));
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    body(home, project);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  }
}

/** What AP SDK does in a project install for Windsurf: merges into the home file and records it in the project manifest. */
function installLikeApSdk(home: string, project: string): string {
  const file = join(home, ".codeium", "windsurf", "mcp_config.json");
  mkdirSync(dirname(file), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    existing = {};
  }
  const servers = { ...((existing.mcpServers as Record<string, unknown> | undefined) ?? {}), "c64-re-tools": { command: "npx", args: ["-y", "new"] } };
  writeFileSync(file, JSON.stringify({ ...existing, mcpServers: servers }, null, 2));
  mkdirSync(join(project, ".ap-sdk"), { recursive: true });
  const item = { harness: "windsurf", kind: "mcp", name: ["c64-re-tools"], files: [file], detail: { mergeKey: "mcpServers", names: ["c64-re-tools"] } };
  writeFileSync(join(project, ".ap-sdk", "install-manifest.json"), JSON.stringify({ version: 1, plugins: { "c64-re-tools": { items: [item] } } }));
  return file;
}

test("a project install puts a Windsurf home file back byte for byte, also one with a global declaration", () => {
  for (const original of ['{"theme":"dark"}', '{"mcpServers":{"other":{"command":"x"}}}\r\n', '{ "mcpServers": { "c64-re-tools": { "command": "old" } } }']) {
    withHomeAndProject((home, project) => {
      const file = join(home, ".codeium", "windsurf", "mcp_config.json");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, original);
      const before = windsurfBefore();
      installLikeApSdk(home, project);
      assert.notEqual(undoWindsurfProjectMcp(before, project), undefined);
      assert.equal(readFileSync(file, "utf8"), original);
      const manifest = JSON.parse(readFileSync(join(project, ".ap-sdk", "install-manifest.json"), "utf8"));
      assert.deepEqual(manifest.plugins["c64-re-tools"].items, [], "the Windsurf MCP item leaves the project manifest");
    });
  }
});

test("a project install removes the Windsurf home file and directories that it made", () => {
  withHomeAndProject((home, project) => {
    const before = windsurfBefore();
    installLikeApSdk(home, project);
    assert.notEqual(undoWindsurfProjectMcp(before, project), undefined);
    assert.deepEqual(readdirSync(home), []);
  });
});
