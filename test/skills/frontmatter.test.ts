// Every skill directory holds a SKILL.md whose frontmatter names the skill
// as its directory does and says when to use it.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const skills = resolve(import.meta.dirname, "../../skills");

test("each skill has SKILL.md with a matching name and a description", () => {
  const directories = existsSync(skills) ? readdirSync(skills, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
  assert.ok(directories.length > 0, "no skills found");
  for (const directory of directories) {
    const text = readFileSync(join(skills, directory.name, "SKILL.md"), "utf8");
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
    assert.ok(frontmatter, `${directory.name}: SKILL.md has no frontmatter`);
    const field = (name: string) => new RegExp(`^${name}: (.+)$`, "m").exec(frontmatter[1]!)?.[1];
    assert.equal(field("name"), directory.name);
    const description = field("description");
    assert.ok(description !== undefined && description.length > 40 && description.length <= 1024, `${directory.name}: description`);
    assert.doesNotMatch(text, /;/, `${directory.name}: STE bans the semicolon`);
  }
});
