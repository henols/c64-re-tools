import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { parseTargets, removeEmptyDirectories, tidyAfterUninstall, withoutWindsurfMcp } from "./cleanup.ts";

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
