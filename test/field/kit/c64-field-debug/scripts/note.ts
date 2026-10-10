// The c64-field-debug script: appends one note to field-test/notes.jsonl in
// the project root. It imports nothing from src/, so a copy of the skill
// directory is a complete installation. This skill is for a field test only
// and is never part of the c64-re-tools package.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const USAGE = `note.ts --kind <kind> [options] "<text>"

Options:
  --kind <kind>                bug, confusion, doc, missing, workaround, thought,
                               comprehension or praise
  --component <name>           the skill, the script or the MCP tool, for example
                               c64-emulator, assemble.ts or c64_screen (default: general)
  --severity <low|medium|high> how much the problem blocks the work (default: medium)
  --by <llm|user>              who writes the note (default: llm)
  --intent <text>              what you wanted to do
  --choice <text>              which skill or tool you chose, and why
  --expected <text>            what you expected
  --actual <text>              what you got

The note goes to field-test/notes.jsonl in the current directory, as one JSON line.
The result is one JSON object with the file and the line number.`;

const KINDS = ["bug", "confusion", "doc", "missing", "workaround", "thought", "comprehension", "praise"];
const SEVERITIES = ["low", "medium", "high"];
const AUTHORS = ["llm", "user"];
const FILE = join("field-test", "notes.jsonl");
const CET_OFFSET_MS = 60 * 60 * 1000;

/** ISO 8601 at the fixed CET offset +01:00, as the rest of c64-re-tools writes a time. */
function isoCet(time: Date): string {
  return `${new Date(time.getTime() + CET_OFFSET_MS).toISOString().slice(0, -1)}+01:00`;
}

function fail(message: string): never {
  process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: `${message}\n\n${USAGE}` } })}\n`);
  process.exit(2);
}

function parse(argv: string[]): ReturnType<typeof parseArgs<{ args: string[]; strict: true; allowPositionals: true; options: Record<string, { type: "string" | "boolean" }> }>> {
  try {
    return parseArgs({
      args: argv,
      strict: true,
      allowPositionals: true,
      options: {
        kind: { type: "string" },
        component: { type: "string" },
        severity: { type: "string" },
        by: { type: "string" },
        intent: { type: "string" },
        choice: { type: "string" },
        expected: { type: "string" },
        actual: { type: "string" },
        help: { type: "boolean" },
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function main(argv: string[]): void {
  const { values, positionals } = parse(argv);
  if (values.help === true) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const text = positionals.join(" ").trim();
  if (text === "") fail("give the note text");
  const kind = values.kind;
  if (typeof kind !== "string" || !KINDS.includes(kind)) fail(`--kind must be one of ${KINDS.join(", ")}`);
  const severity = typeof values.severity === "string" ? values.severity : "medium";
  if (!SEVERITIES.includes(severity)) fail(`--severity must be one of ${SEVERITIES.join(", ")}`);
  const by = typeof values.by === "string" ? values.by : "llm";
  if (!AUTHORS.includes(by)) fail(`--by must be one of ${AUTHORS.join(", ")}`);
  const optional = (name: "intent" | "choice" | "expected" | "actual") => (typeof values[name] === "string" ? { [name]: values[name] } : {});
  const note = {
    t: isoCet(new Date()),
    by,
    kind,
    component: typeof values.component === "string" ? values.component : "general",
    severity,
    ...optional("intent"),
    ...optional("choice"),
    ...optional("expected"),
    ...optional("actual"),
    text,
  };
  mkdirSync("field-test", { recursive: true });
  appendFileSync(FILE, `${JSON.stringify(note)}\n`);
  const line = readFileSync(FILE, "utf8").split("\n").filter((entry) => entry !== "").length;
  process.stdout.write(`${JSON.stringify({ written: FILE, line })}\n`);
}

main(process.argv.slice(2));
