import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { detoursSection, scriptCommands } from "./detours.ts";

test("scriptCommands finds the commands of a skill script, also through a variable on an earlier line", () => {
  assert.deepEqual(scriptCommands("node .claude/skills/c64-knowledge/scripts/knowledge.ts at '$1000'"), ["knowledge at"]);
  assert.deepEqual(scriptCommands('K="node .claude/skills/c64-knowledge/scripts/knowledge.ts"\nfor a in 1 2; do $K at "$a"; done; node $K listing x'), ["knowledge at", "knowledge listing"]);
  assert.deepEqual(scriptCommands("node $K at '$1000'"), [], "a variable that holds no script");
});

test("detoursSection counts each tool use once and sorts the detours by kind", () => {
  const dir = mkdtempSync(join(tmpdir(), "c64-detours-"));
  try {
    const record = (id: string, name: string, input: Record<string, unknown>) => JSON.stringify({ message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
    const filter = record("a", "Bash", { command: "K=.claude/skills/c64-knowledge/scripts/knowledge.ts; node $K at '$1000' | python3 -c \"import json,sys; json.load(sys.stdin)\"" });
    const own = record("b", "Bash", { command: "python3 - <<'EOF'\nprint(bytes.fromhex('0010'))\nEOF" });
    mkdirSync(join(dir, "session", "subagents"), { recursive: true });
    // Two write watchpoints on $fed0-$fed1, the second one in other letters, and one on $fed0 alone.
    const watch = (id: string, start: string, end?: string) => record(id, "mcp__spectrum__watchpoint", { action: "add", start, ...(end === undefined ? {} : { end }), access: "write" });
    writeFileSync(join(dir, "session.jsonl"), [filter, own, "not json", watch("d", "$fed0", "$fed1"), watch("e", "$FED0", "$fed1"), watch("f", "$fed0")].join("\n"));
    writeFileSync(join(dir, "session", "subagents", "agent.jsonl"), [filter, record("c", "Write", { file_path: "/p/decode.py", content: "" })].join("\n"));
    const lines = detoursSection(dir);
    assert.match(lines[0]!, /^- Tool uses: 6\. mcp__spectrum__watchpoint × 3, Bash × 2, Write × 1\.$/);
    assert.match(lines[1]!, /^- Skill script commands: 1\. knowledge at × 1\.$/);
    const counts = Object.fromEntries(lines.filter((line) => /^\| [A-Z]/.test(line) && !line.startsWith("| Detour")).map((line) => line.split(" | ").map((cell) => cell.replace(/^\| | \|$/g, ""))));
    assert.equal(counts["Own code that is not only a filter of a script result"], "1");
    assert.equal(counts["Code that filters a script result"], "1");
    assert.equal(counts["Scripts that the agent wrote"], "1");
    assert.equal(counts["Reads of the knowledge files"], "0");
    assert.equal(counts["Write watchpoints armed again on one range"], "1");
    const rearmed = lines.indexOf("### Write watchpoints armed again on one range");
    assert.deepEqual(lines.slice(rearmed + 2), ['- `mcp__spectrum__watchpoint {"action":"add","start":"$FED0","end":"$fed1","access":"write"}`']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(detoursSection(join(dir, "gone")), ["No transcripts in the bundle."]);
});
