// The MCP tool names that the skills and the README use: every one exists on a
// machine server, and no name keeps the c64_ prefix that the tools had before
// one server per machine family.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { debugTools } from "../../src/mcp/tools/debug.ts";
import { executionTools } from "../../src/mcp/tools/execution.ts";
import { inputTools } from "../../src/mcp/tools/input.ts";
import { machineTools } from "../../src/mcp/tools/machine.ts";
import { mediaTools } from "../../src/mcp/tools/media.ts";
import { memoryTools } from "../../src/mcp/tools/memory.ts";
import { spectrumTools } from "../../src/mcp/tools/spectrum.ts";
import { videoTools } from "../../src/mcp/tools/video.ts";

const ROOT = join(import.meta.dirname, "../..");
/** The tools of each machine server. */
const SERVERS: Record<string, Set<string>> = {
  c64: new Set([...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools].map((tool) => tool.name)),
  spectrum: new Set(spectrumTools.map((tool) => tool.name)),
};

const docs = () => [
  ...readdirSync(join(ROOT, "skills")).flatMap((skill) => {
    const folder = join(ROOT, "skills", skill);
    const references = readdirSync(folder).includes("references") ? readdirSync(join(folder, "references")).map((file) => join(folder, "references", file)) : [];
    return [join(folder, "SKILL.md"), ...references];
  }),
  join(ROOT, ".github", "README.md"),
];

test("no skill doc and no README names a tool with the old c64_ prefix", () => {
  for (const file of docs()) assert.doesNotMatch(readFileSync(file, "utf8"), /\bc64_(?!source_loader_jump)[a-z_]+\b/, file);
});

test("every tool in the tool table of retro-emulator is a tool of each server that its row names, and the table names every tool", () => {
  const text = readFileSync(join(ROOT, "skills", "retro-emulator", "SKILL.md"), "utf8");
  const rows = text.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Need") && !line.startsWith("|---"));
  const named = new Map(Object.keys(SERVERS).map((server) => [server, new Set<string>()]));
  for (const row of rows) {
    const cells = row.split("|").map((cell) => cell.trim());
    // The tool names come first in a cell; the inputs after " with " are no tools.
    const tools = [...cells[2]!.split(" with ")[0]!.matchAll(/`([a-z_]+)`/g)].map((match) => match[1]!);
    const servers = cells[3] === "all" ? Object.keys(SERVERS) : [cells[3]!];
    assert.ok(tools.length > 0, `${row} names a tool`);
    for (const server of servers) {
      assert.ok(SERVERS[server] !== undefined, `${row}: ${server} is no server`);
      for (const tool of tools) {
        assert.ok(SERVERS[server]!.has(tool), `${tool} is no tool of the ${server} server`);
        named.get(server)!.add(tool);
      }
    }
  }
  for (const [server, tools] of Object.entries(SERVERS)) for (const tool of tools) assert.ok(named.get(server)!.has(tool), `the table does not name ${tool} of the ${server} server`);
});
