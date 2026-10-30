import assert from "node:assert/strict";
import { test } from "node:test";

import { quotesSection, skillSizeSection } from "./skill-text.ts";

test("quotesSection gives each quote note with its place and effect, and if the current skill text still has the words", () => {
  const notes = [
    { kind: "thought", component: "emulator", text: "Not a quote." },
    { kind: "quote", component: "c64-knowledge", file: "SKILL.md", heading: "Rules", text: "Read the knowledge first.", effect: "I read it first." },
    { kind: "quote", component: "emulator", file: "references/points.md", heading: "", text: "A watchpoint stops once.", effect: "I armed it again." },
  ];
  const foundNow = (component: string, words: string) => component === "c64-knowledge" && words === "Read the knowledge first.";
  assert.deepEqual(quotesSection(notes, foundNow), [
    '1. **c64-knowledge**, SKILL.md, under "Rules" (found now)',
    '   - Words: "Read the knowledge first."',
    "   - Effect: I read it first.",
    "2. **emulator**, references/points.md, before the first heading (not found in the current text)",
    '   - Words: "A watchpoint stops once."',
    "   - Effect: I armed it again.",
  ]);
  assert.deepEqual(quotesSection([{ kind: "quote", component: "general", text: "None." }], foundNow), ["None."]);
  assert.deepEqual(quotesSection(notes.slice(0, 1), foundNow), ["No quote notes."]);
});

test("skillSizeSection gives the words of each skill, most first, and the total", () => {
  assert.deepEqual(skillSizeSection({ "c64-disk": 800, emulator: 2400, "c64-knowledge": 1600 }), [
    "Total: 4800 words in 3 skills, each SKILL.md with its references/*.md.",
    "",
    "| Skill | Words |",
    "|---|---|",
    "| emulator | 2400 |",
    "| c64-knowledge | 1600 |",
    "| c64-disk | 800 |",
  ]);
  assert.deepEqual(skillSizeSection({}), ["No skill sizes in the bundle."]);
});
