import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import { PACKAGE } from "../package.ts";
import { installedLines } from "./status.ts";

const project = mkdtempSync(join(tmpdir(), "c64-re-tools-status-"));
after(() => rmSync(project, { recursive: true, force: true }));

function write(path: string, content: unknown): void {
  mkdirSync(dirname(join(project, path)), { recursive: true });
  writeFileSync(join(project, path), JSON.stringify(content));
}

test("status names the version of the installed skills, warns on another version, and gives the MCP command (b's R2-01)", () => {
  assert.match(installedLines(project).join("\n"), /^Installed: nothing in this project or globally\.$|^Installed globally:/);
  const skill = (name: string, scripts: boolean) => ({ harness: "claude", kind: "skill", name, files: [`.claude/skills/${name}/SKILL.md`, ...(scripts ? [`.claude/skills/${name}/package.json`] : [])] });
  write(".ap-sdk/install-manifest.json", {
    version: 1,
    plugins: {
      "c64-re-tools": {
        scope: "project",
        items: [skill("c64-knowledge", true), skill("c64-emulator", false), { harness: "claude", kind: "mcp", name: "c64-re-tools", files: [".mcp.json"], detail: { mergeKey: "mcpServers", names: ["c64-re-tools"] } }],
      },
    },
  });
  write(".claude/skills/c64-knowledge/package.json", { name: PACKAGE.name, version: "2.0.0-rc.1" });
  write(".mcp.json", { mcpServers: { "c64-re-tools": { command: "npx", args: ["-y", "--package=@henols/c64-re-tools@next", "c64-re-tools-mcp"] } } });
  const lines = installedLines(project);
  const at = lines.indexOf(`Installed in this project (${project}):`);
  assert.ok(at >= 0, lines.join("\n"));
  assert.deepEqual(lines.slice(at + 1, at + 4), [
    "  claude: 2 skills, c64-re-tools 2.0.0-rc.1",
    `  Warning: the claude skills are c64-re-tools 2.0.0-rc.1 and this is ${PACKAGE.version}. Run npx -y ${PACKAGE.name}@${PACKAGE.tag} update to install this version.`,
    "  claude MCP server: npx -y --package=@henols/c64-re-tools@next c64-re-tools-mcp",
  ]);
  assert.equal(lines.at(-1), "  The MCP server gives its own version in the result of c64_status.");
  write(".claude/skills/c64-knowledge/package.json", { name: PACKAGE.name, version: PACKAGE.version });
  const again = installedLines(project);
  const section = again.slice(again.indexOf(`Installed in this project (${project}):`) + 1, again.indexOf("Installed globally:") > 0 ? again.indexOf("Installed globally:") : undefined);
  assert.ok(!section.some((line) => line.includes("Warning")), "the same version gives no warning");
});
