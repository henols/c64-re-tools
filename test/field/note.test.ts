import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { findQuote } from "./kit/c64-field-debug/scripts/note.ts";

const SKILL = [
  "---",
  "name: c64-demo",
  "description: Use this skill to show the quote check.",
  "---",
  "",
  "# c64-demo",
  "",
  "## Rules",
  "",
  "Always **read the `knowledge` file**",
  "before you   change the source.",
  "",
  "```",
  "# not a heading",
  "node demo.ts run",
  "```",
  "",
].join("\n");

/** A skill folder with a SKILL.md and one reference, in a temporary directory. */
function skillFolder(root: string): string {
  const skill = join(root, "c64-demo");
  mkdirSync(join(skill, "references"), { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), SKILL);
  writeFileSync(join(skill, "references", "points.md"), "A watchpoint stops one time for each address.\n\n## Ranges ##\n\nA range has a start and an end.\n");
  return skill;
}

test("findQuote finds the words with whitespace, backticks and asterisks ignored, and gives the file and the nearest heading above them", () => {
  const root = mkdtempSync(join(tmpdir(), "c64-quote-"));
  try {
    const skill = skillFolder(root);
    assert.deepEqual(findQuote(skill, "read the knowledge file before you change"), { file: "SKILL.md", heading: "Rules" });
    assert.deepEqual(findQuote(skill, "node `demo.ts` run"), { file: "SKILL.md", heading: "Rules" }, "a # line in a code block is no heading");
    assert.deepEqual(findQuote(skill, "Use this skill to show"), { file: "SKILL.md", heading: "" });
    assert.deepEqual(findQuote(skill, "A range has a start"), { file: "references/points.md", heading: "Ranges" });
    assert.equal(findQuote(skill, "Read the knowledge file before"), undefined, "the comparison is case-sensitive");
    assert.equal(findQuote(join(root, "missing"), "read the knowledge file"), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("note.ts records a quote note with its place in the skill, and refuses a quote that breaks a rule", () => {
  const project = mkdtempSync(join(tmpdir(), "c64-quote-project-"));
  try {
    const skills = join(project, ".claude", "skills");
    const script = join(skills, "c64-field-debug", "scripts", "note.ts");
    cpSync(join(import.meta.dirname, "kit", "c64-field-debug", "scripts", "note.ts"), script);
    skillFolder(skills);
    const note = (...args: string[]) => {
      const run = spawnSync(process.execPath, [...process.execArgv, script, "--kind", "quote", ...args], { cwd: project, encoding: "utf8" });
      return { status: run.status, error: run.status === 0 ? "" : String((JSON.parse(run.stdout) as { error: { message: string } }).error.message.split("\n")[0]) };
    };
    const quote = (words: string) => note("--component", "c64-demo", "--effect", "I read it first.", words);
    const notes = () => readFileSync(join(project, "field-test", "notes.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);

    assert.match(note("--component", "c64-other", "--effect", "I read it first.", "read the knowledge file").error, /--component must be the installed skill/);
    assert.match(quote("read the knowledge").error, /copy 4 words or more/);
    assert.match(note("--component", "c64-demo", "--effect", "Read it.", "read the knowledge file").error, /--effect must say in 3 words or more/);
    assert.match(quote("read the source file").error, /the words are not in c64-demo\/SKILL.md/);

    assert.equal(quote("read the knowledge file").status, 0);
    const [first] = notes();
    assert.deepEqual({ ...first, t: undefined }, { t: undefined, by: "llm", kind: "quote", component: "c64-demo", file: "SKILL.md", heading: "Rules", text: "read the knowledge file", effect: "I read it first." });
    assert.match(note("None.").error, /only for a session with no other quote note/);
    for (const words of ["before you change the", "A range has a", "A watchpoint stops one", "Use this skill to"]) assert.equal(quote(words).status, 0);
    assert.match(quote("A range has a start").error, /has 5 quote notes, the maximum/);

    rmSync(join(project, "field-test"), { recursive: true });
    assert.equal(note("None.").status, 0);
    assert.deepEqual({ ...notes()[0], t: undefined }, { t: undefined, by: "llm", kind: "quote", component: "general", text: "None." });
    assert.match(quote("read the knowledge file").error, /has a quote note with the text None\./);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
