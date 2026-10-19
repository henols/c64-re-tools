import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { parseTargets, removeDroppedItems, removeEmptyDirectories, tidyAfterUninstall, undoWindsurfProjectMcp, windsurfBefore, withoutWindsurfMcp } from "./cleanup.ts";

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
        { harness: "claude", kind: "mcp", name: "c64-re-tools", files: [".mcp.json"], detail: { mergeKey: "mcpServers", names: ["c64-re-tools"] } },
        { harness: "opencode", kind: "mcp", name: "c64-re-tools", files: ["opencode.json"], detail: { mergeKey: "mcp", names: ["c64-re-tools"] } },
      ],
      "project",
      root,
    );
    assert.deepEqual(readdirSync(root).sort(), [".claude", "opencode.json"], "the configuration with other settings stays");
    assert.deepEqual(readdirSync(join(root, ".claude")), ["agents"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an empty directory outside the stop directory stays", () => {
  const base = mkdtempSync(join(tmpdir(), "c64-re-tools-tidy-"));
  try {
    const root = join(base, "root");
    const sibling = join(base, "elsewhere", "empty");
    mkdirSync(root);
    mkdirSync(sibling, { recursive: true });
    removeEmptyDirectories(sibling, root);
    assert.deepEqual(readdirSync(base).sort(), ["elsewhere", "root"]);
    assert.deepEqual(readdirSync(join(base, "elsewhere")), ["empty"]);
  } finally {
    rmSync(base, { recursive: true, force: true });
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
  const servers = { ...((existing.mcpServers as Record<string, unknown> | undefined) ?? {}), c64: { command: "npx", args: ["-y", "new"] } };
  writeFileSync(file, JSON.stringify({ ...existing, mcpServers: servers }, null, 2));
  mkdirSync(join(project, ".ap-sdk"), { recursive: true });
  const item = { harness: "windsurf", kind: "mcp", name: "c64-re-tools", files: [file], detail: { mergeKey: "mcpServers", names: ["c64-re-tools"] } };
  writeFileSync(join(project, ".ap-sdk", "install-manifest.json"), JSON.stringify({ version: 1, plugins: { "c64-re-tools": { items: [item] } } }));
  return file;
}

test("a project install puts a Windsurf home file back byte for byte, also one with a global declaration", () => {
  for (const original of ['{"theme":"dark"}', '{"mcpServers":{"other":{"command":"x"}}}\r\n', '{ "mcpServers": { "c64": { "command": "old" } } }']) {
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

test("a directory in the root whose name starts with two dots is inside the root", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-tidy-"));
  try {
    mkdirSync(join(root, "..skills", "c64-disk"), { recursive: true });
    tidyAfterUninstall([{ harness: "claude", kind: "skill", name: "c64-disk", files: ["..skills/c64-disk/SKILL.md"] }], "project", root);
    assert.deepEqual(readdirSync(root), [], "the empty directories go");
    mkdirSync(join(root, "..x", "deep"), { recursive: true });
    removeEmptyDirectories(join(root, "..x", "deep"), root);
    assert.deepEqual(readdirSync(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an install removes the skill files of the earlier version that it no longer has, and keeps the rest", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-dropped-"));
  try {
    const write = (path: string) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), "x");
    };
    const skill = (harness: string, name: string, files: string[]) => ({ harness, kind: "skill", name, files });
    const before = [
      skill("claude", "c64-emulator", [".claude/skills/c64-emulator/SKILL.md", ".claude/skills/shared.md"]),
      skill("claude", "c64-disk", [".claude/skills/c64-disk/SKILL.md"]),
      skill("codex", "c64-emulator", [".agents/skills/c64-emulator/SKILL.md"]),
      { harness: "claude", kind: "mcp", name: "c64-re-tools", files: [".mcp.json"] },
    ];
    for (const item of before) for (const file of item.files) write(file);
    write(".claude/skills/c64-emulator/notes.md");
    // The new install: claude only, c64-emulator renamed to emulator, and no MCP item recorded.
    const after = [skill("claude", "emulator", [".claude/skills/emulator/SKILL.md", ".claude/skills/shared.md"]), skill("claude", "c64-disk", [".claude/skills/c64-disk/SKILL.md"])];
    for (const item of after) for (const file of item.files) write(file);
    write(".ap-sdk/install-manifest.json");
    writeFileSync(join(root, ".ap-sdk", "install-manifest.json"), JSON.stringify({ version: 1, plugins: { "c64-re-tools": { items: after } } }));

    // An install that failed before it wrote its manifest: the manifest still has every earlier item.
    const manifest = readFileSync(join(root, ".ap-sdk", "install-manifest.json"), "utf8");
    writeFileSync(join(root, ".ap-sdk", "install-manifest.json"), JSON.stringify({ version: 1, plugins: { "c64-re-tools": { items: before } } }));
    assert.deepEqual(removeDroppedItems(before, "project", root), [], "an unchanged manifest drops nothing");
    assert.equal(readdirSync(join(root, ".claude", "skills", "c64-emulator")).includes("SKILL.md"), true);
    writeFileSync(join(root, ".ap-sdk", "install-manifest.json"), manifest);

    assert.deepEqual(removeDroppedItems(before, "project", root), ["c64-emulator"]);
    const exists = (path: string) => readdirSync(dirname(join(root, path))).includes(path.split("/").at(-1)!);
    assert.equal(exists(".claude/skills/c64-emulator/SKILL.md"), false);
    assert.equal(exists(".claude/skills/c64-emulator/notes.md"), true, "a file that no install wrote stays");
    assert.equal(exists(".claude/skills/shared.md"), true, "a file that the new install also wrote stays");
    assert.equal(exists(".agents/skills/c64-emulator/SKILL.md"), true, "a harness that this install did not write stays");
    assert.equal(exists(".mcp.json"), true, "an MCP file stays");
    assert.equal(exists(".claude/skills/c64-disk/SKILL.md"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the directories of a removed skill go when nothing else is in them", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-dropped-"));
  try {
    mkdirSync(join(root, ".claude", "skills", "old", "scripts"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "old", "SKILL.md"), "x");
    writeFileSync(join(root, ".claude", "skills", "old", "scripts", "old.ts"), "x");
    mkdirSync(join(root, ".claude", "skills", "new"), { recursive: true });
    mkdirSync(join(root, ".ap-sdk"));
    const after = [{ harness: "claude", kind: "skill", name: "new", files: [".claude/skills/new/SKILL.md"] }];
    writeFileSync(join(root, ".ap-sdk", "install-manifest.json"), JSON.stringify({ version: 1, plugins: { "c64-re-tools": { items: after } } }));
    removeDroppedItems([{ harness: "claude", kind: "skill", name: "old", files: [".claude/skills/old/SKILL.md", ".claude/skills/old/scripts/old.ts"] }], "project", root);
    assert.deepEqual(readdirSync(join(root, ".claude", "skills")), ["new"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
