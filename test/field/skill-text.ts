// The skill text of a field test: the passages that the agent says changed
// what it did (its quote notes), and the size of the skill text it had (the
// words of each installed skill, as bundle.ts counts them).

const NONE = "None.";

/** The section of the quote notes, in the sequence of the notes: the skill, the file and the heading, the words, the effect, and if foundNow finds the words in the current skill text. */
export function quotesSection(notes: ReadonlyArray<Record<string, unknown>>, foundNow: (component: string, words: string) => boolean): string[] {
  const quotes = notes.filter((note) => note.kind === "quote");
  if (quotes.length === 0) return ["No quote notes."];
  const lines: string[] = [];
  let number = 0;
  for (const note of quotes) {
    const component = String(note.component ?? "");
    const words = String(note.text ?? "");
    if (words === NONE) {
      lines.push(NONE);
      continue;
    }
    number += 1;
    const heading = typeof note.heading === "string" && note.heading !== "" ? `under "${note.heading}"` : "before the first heading";
    const where = typeof note.file === "string" ? `${note.file}, ${heading}` : "no file";
    lines.push(
      `${number}. **${component}**, ${where} (${foundNow(component, words) ? "found now" : "not found in the current text"})`,
      `   - Words: "${words}"`,
      `   - Effect: ${String(note.effect ?? "")}`,
    );
  }
  return lines;
}

/** The section of the skill text size: the words of each installed skill, most first, and the total. */
export function skillSizeSection(words: Readonly<Record<string, number>>): string[] {
  const skills = Object.entries(words).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (skills.length === 0) return ["No skill sizes in the bundle."];
  const total = skills.reduce((sum, [, count]) => sum + count, 0);
  return [`Total: ${total} words in ${skills.length} skills, each SKILL.md with its references/*.md.`, "", "| Skill | Words |", "|---|---|", ...skills.map(([name, count]) => `| ${name} | ${count} |`)];
}
