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
const TOOLS = new Set([...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools, ...spectrumTools].map((tool) => tool.name));

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

test("every tool in the tool table of retro-emulator is a tool of a machine server", () => {
  const text = readFileSync(join(ROOT, "skills", "retro-emulator", "SKILL.md"), "utf8");
  const rows = text.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Need") && !line.startsWith("|---"));
  // The tool names come first in a cell; the inputs after " with " or " (" are no tools.
  const named = rows.flatMap((row) => [...(row.split("|")[2] ?? "").split(/ with | \(/)[0]!.matchAll(/`([a-z_]+)`/g)].map((match) => match[1]!));
  assert.ok(named.length > 20, "the table names the tools");
  for (const name of named) assert.ok(TOOLS.has(name), `${name} is no tool`);
});
