// The c64-field-debug script: appends one note to field-test/notes.jsonl in
// the project root. It imports nothing from src/, so a copy of the skill
// directory is a complete installation. This skill is for a field test only
// and is never part of the c64-re-tools package.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const USAGE = `note.ts --kind <kind> [options] "<text>"

Options:
  --kind <kind>                bug, confusion, doc, missing, workaround, thought,
                               comprehension, praise or quote
  --component <name>           the skill, the script or the MCP tool, for example
                               emulator, assembler.ts or c64_screen (default: general).
                               For quote: the skill that holds the words
  --severity <low|medium|high> how much the problem blocks the work (default: medium)
  --by <llm|user>              who writes the note (default: llm)
  --intent <text>              what you wanted to do
  --choice <text>              which skill or tool you chose, and why
  --expected <text>            what you expected
  --actual <text>              what you got
  --effect <text>              quote only: what you did or did not do because of
                               the words, in 3 words or more

A quote note holds words copied exactly from the SKILL.md or a references/*.md
file of an installed skill: 4 words or more, at most 5 quote notes. When no
skill text changed what you did, write one quote note with the text None.

The note goes to field-test/notes.jsonl in the current directory, as one JSON line.
The result is one JSON object with the file and the line number.`;

const KINDS = ["bug", "confusion", "doc", "missing", "workaround", "thought", "comprehension", "praise", "quote"];
const SEVERITIES = ["low", "medium", "high"];
const AUTHORS = ["llm", "user"];
const FILE = join("field-test", "notes.jsonl");
const CET_OFFSET_MS = 60 * 60 * 1000;
/** The installed skills: the script is at <project>/.claude/skills/c64-field-debug/scripts/note.ts. */
const SKILLS = join(import.meta.dirname, "..", "..");
const QUOTE_LIMIT = 5;
const QUOTE_WORDS = 4;
const EFFECT_WORDS = 3;
const NONE = "None.";

/** ISO 8601 at the fixed CET offset +01:00, as the rest of c64-re-tools writes a time. */
function isoCet(time: Date): string {
  return `${new Date(time.getTime() + CET_OFFSET_MS).toISOString().slice(0, -1)}+01:00`;
}

function fail(message: string): never {
  process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: `${message}\n\n${USAGE}` } })}\n`);
  process.exit(2);
}

/** The words of a text: a word has a letter or a digit, so a table rule or a list mark is none. */
const wordCount = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/** Skill text as a quote is compared with it: no backtick and no asterisk, and each run of whitespace one space. */
export function normalizeQuote(text: string): string {
  return text.replace(/[`*]/g, "").replace(/\s+/g, " ").trim();
}

/** The heading of a line of a markdown text: the nearest heading at or above it outside a code block, or "" before the first heading. */
function headingAt(text: string, line: number): string {
  let heading = "";
  let fenced = false;
  for (const row of text.split("\n").slice(0, line + 1)) {
    if (/^ {0,3}(```|~~~)/.test(row)) fenced = !fenced;
    const match = fenced ? null : /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(row);
    if (match !== null) heading = match[1]!;
  }
  return heading;
}

/** The line of the markdown text where the normalized words start, with the text normalized as normalizeQuote does; undefined when the words are not in it. */
function lineOf(text: string, words: string): number | undefined {
  let flat = "";
  const lines: number[] = [];
  let line = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === "\n") line += 1;
    if (char === "`" || char === "*") continue;
    const space = /\s/.test(char);
    if (space && flat.endsWith(" ")) continue;
    flat += space ? " " : char;
    lines.push(line);
  }
  const at = flat.indexOf(words);
  return at < 0 ? undefined : lines[at];
}

/** Where the words are in the SKILL.md or a references/*.md file of the skill folder: the file and the nearest heading above the words. Undefined when they are in none of these files. */
export function findQuote(skillDir: string, quote: string): { file: string; heading: string } | undefined {
  const words = normalizeQuote(quote);
  if (words === "") return undefined;
  const references = join(skillDir, "references");
  const files = [
    "SKILL.md",
    ...(existsSync(references) ? readdirSync(references).filter((name) => name.endsWith(".md")).sort().map((name) => `references/${name}`) : []),
  ];
  for (const file of files) {
    const path = join(skillDir, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const line = lineOf(text, words);
    if (line !== undefined) return { file, heading: headingAt(text, line) };
  }
  return undefined;
}

/** The quote notes that field-test/notes.jsonl holds now. */
function quoteNotes(): Array<Record<string, unknown>> {
  if (!existsSync(FILE)) return [];
  const notes: Array<Record<string, unknown>> = [];
  for (const line of readFileSync(FILE, "utf8").split("\n")) {
    try {
      const note = JSON.parse(line) as Record<string, unknown>;
      if (note.kind === "quote") notes.push(note);
    } catch {
      // A line that is not JSON is no note.
    }
  }
  return notes;
}

/** The fields of a quote note after its checks: where the words are in the skill, the words and the effect. */
function quoteFields(component: string, text: string, effect: string | undefined): Record<string, unknown> {
  const recorded = quoteNotes();
  if (text === NONE) {
    if (recorded.length > 0) fail(`a quote note with the text ${NONE} is only for a session with no other quote note, and ${FILE} has ${recorded.length}`);
    return { text, ...(effect === undefined ? {} : { effect }) };
  }
  if (recorded.some((note) => note.text === NONE)) fail(`${FILE} has a quote note with the text ${NONE}, so it takes no more quote notes`);
  if (recorded.length >= QUOTE_LIMIT) fail(`${FILE} has ${QUOTE_LIMIT} quote notes, the maximum`);
  const skills = existsSync(SKILLS) ? readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md"))).sort() : [];
  if (!skills.includes(component)) fail(`--component must be the installed skill that holds the words: ${skills.join(", ")}`);
  if (wordCount(normalizeQuote(text)) < QUOTE_WORDS) fail(`copy ${QUOTE_WORDS} words or more from the skill`);
  if (effect === undefined || wordCount(effect) < EFFECT_WORDS) fail(`--effect must say in ${EFFECT_WORDS} words or more what you did or did not do because of the words`);
  const found = findQuote(join(SKILLS, component), text);
  if (found === undefined) fail(`the words are not in ${component}/SKILL.md or ${component}/references/*.md. Copy them exactly from the skill text`);
  return { file: found.file, heading: found.heading, text, effect };
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
        effect: { type: "string" },
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
  const component = typeof values.component === "string" ? values.component : "general";
  const optional = (name: "intent" | "choice" | "expected" | "actual") => (typeof values[name] === "string" ? { [name]: values[name] } : {});
  const note =
    kind === "quote"
      ? { t: isoCet(new Date()), by, kind, component, ...quoteFields(component, text, typeof values.effect === "string" ? values.effect : undefined) }
      : {
          t: isoCet(new Date()),
          by,
          kind,
          component,
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

// The field report imports findQuote; only a run of the script writes a note. Node before 24.2 has no import.meta.main.
if (import.meta.main ?? resolve(process.argv[1] ?? "") === import.meta.filename) main(process.argv.slice(2));
