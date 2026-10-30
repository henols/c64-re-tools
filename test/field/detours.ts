// The detours of a field test: what the agent did beside the skill scripts and
// the MCP tools, counted from the Claude Code transcripts of the bundle. A note
// tells what the agent remembered; a detour that worked leaves no note, so the
// count shows the gaps of the toolkit that the notes do not.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Every tool use in the .jsonl files under dir, the transcripts of subagents too, once each. */
export function toolUses(dir: string): ToolUse[] {
  const uses = new Map<string, ToolUse>();
  const files = existsSync(dir) ? readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".jsonl")) : [];
  for (const file of files.sort()) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      let record: { message?: { role?: string; content?: unknown } };
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      const content = record.message?.role === "assistant" ? record.message.content : undefined;
      if (!Array.isArray(content)) continue;
      for (const part of content as Array<Record<string, unknown>>) {
        if (part.type !== "tool_use" || typeof part.id !== "string" || uses.has(part.id)) continue;
        uses.set(part.id, { id: part.id, name: String(part.name), input: (part.input ?? {}) as Record<string, unknown> });
      }
    }
  }
  return [...uses.values()];
}

/** The shell variables that hold a skill script, as in `K=.../knowledge.ts`: the name and the script. */
function scriptVariables(command: string): Map<string, string> {
  const variables = new Map<string, string>();
  for (const match of command.matchAll(/(?:^|[\s;&|(])([A-Za-z_]\w*)=["']?(?:node\s+)?\S*?skills\/[\w.-]+\/scripts\/([\w.-]+)\.ts\b/g)) variables.set(match[1]!, match[2]!);
  return variables;
}

/** The skill script commands of one shell command as `<script> <command>`, also through a variable that holds the script, as in `K=.../knowledge.ts; node $K at`. */
export function scriptCommands(command: string, variables = scriptVariables(command)): string[] {
  const found: string[] = [];
  for (const match of command.matchAll(/skills\/[\w.-]+\/scripts\/([\w.-]+)\.ts["']?[ \t]+([a-z][\w-]*)/g)) found.push(`${match[1]} ${match[2]}`);
  for (const match of command.matchAll(/\$\{?([A-Za-z_]\w*)\}?["']?[ \t]+([a-z][\w-]*)/g)) {
    const script = variables.get(match[1]!);
    if (script !== undefined) found.push(`${script} ${match[2]}`);
  }
  return found;
}

/** The kinds of detour, in the sequence of the report, each with the test of a tool use. */
const DETOURS: ReadonlyArray<{ kind: string; test: (use: ToolUse, command: string) => boolean }> = [
  { kind: "Own code that is not only a filter of a script result", test: (_use, command) => inlineCode(command) && !filtersScript(command) },
  { kind: "Code that filters a script result", test: (_use, command) => filtersScript(command) },
  { kind: "Scripts that the agent wrote", test: (use, command) => (use.name === "Write" && /\.(py|ts|js|mjs|sh)$/.test(String(use.input.file_path ?? ""))) || /cat\s+>\s*\S+\.(py|ts|js|mjs|sh)\b/.test(command) },
  { kind: "Reads of the knowledge files", test: (_use, command) => /\.c64-re-tools\/knowledge\//.test(command) },
  { kind: "Text searches in listings and source", test: (_use, command) => /(^|[|;&(\s])(grep|rg|sed|awk)\s/.test(command) && /\.(asm|lst|s)\b|listing|(^|[\s/])src\//.test(command) },
  { kind: "Searches in the skill files", test: (_use, command) => /(^|[|;&(\s])(grep|rg|sed|awk|head|tail)\s/.test(command) && /skills\/[\w.-]+\/(SKILL\.md|references\/)/.test(command) },
  { kind: "Byte dumps", test: (_use, command) => /(^|[|;&(\s])(xxd|hexdump|od)\s/.test(command) || /open\([^)]*['"]rb['"]/.test(command) },
];

const inlineCode = (command: string) => /\b(python3?|node)\b(\s+-I)?\s+(-c|-e|-)(\s|$)/.test(command);
/** Inline code next to a skill script that only reads JSON: it decodes no bytes and writes no file. */
const filtersScript = (command: string) => inlineCode(command) && scriptCommands(command).length > 0 && /json\.load|JSON\.parse/.test(command) && !/fromhex|open\([^)]*['"][rw]b['"]|json\.dump\(|writeFileSync/.test(command);

const shown = (command: string) => `\`${command.replace(/\s*\n\s*/g, " ⏎ ").replace(/`/g, "'").slice(0, 220)}\``;

/** The Detours section of the report: the counts of the tool uses, of the skill script commands and of each kind of detour, with the first examples. */
export function detoursSection(dir: string): string[] {
  const uses = toolUses(dir);
  if (uses.length === 0) return ["No transcripts in the bundle."];
  const tools = new Map<string, number>();
  const commands = new Map<string, number>();
  const detours = new Map<string, string[]>(DETOURS.map(({ kind }) => [kind, []]));
  for (const use of uses) {
    tools.set(use.name, (tools.get(use.name) ?? 0) + 1);
    const command = use.name === "Bash" ? String(use.input.command ?? "") : "";
    for (const found of scriptCommands(command)) commands.set(found, (commands.get(found) ?? 0) + 1);
    for (const { kind, test } of DETOURS) if (test(use, command)) detours.get(kind)!.push(use.name === "Bash" ? command : String(use.input.file_path));
  }
  const top = (counts: Map<string, number>, limit: number) => [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => `${name} × ${count}`).join(", ");
  const lines = [
    `- Tool uses: ${uses.length}. ${top(tools, 12)}.`,
    `- Skill script commands: ${[...commands.values()].reduce((sum, count) => sum + count, 0)}. ${top(commands, 15) || "none"}.`,
    "",
    "| Detour | Count |",
    "|---|---|",
    ...DETOURS.map(({ kind }) => `| ${kind} | ${detours.get(kind)!.length} |`),
  ];
  for (const { kind } of DETOURS) {
    const found = detours.get(kind)!;
    if (found.length === 0) continue;
    lines.push("", `### ${kind}`, "", ...found.slice(0, 5).map((command) => `- ${shown(command)}`));
  }
  return lines;
}
