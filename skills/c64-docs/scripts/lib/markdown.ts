// What the documentation scripts read in a Markdown page: the lines outside
// code blocks and HTML comments, the anchors that a link can name, and the
// links and images with their targets.

/** The lines of a page and, for each one, whether it is prose: outside fenced code (also mermaid) and outside HTML comments. */
export function proseLines(text: string): Array<{ text: string; prose: boolean }> {
  const lines = text.split("\n");
  let fence: string | undefined;
  let comment = false;
  return lines.map((line) => {
    const opening = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence !== undefined) {
      if (opening !== null && opening[1]!.startsWith(fence[0]!) && opening[1]!.length >= fence.length && line.trim() === opening[1]) fence = undefined;
      return { text: line, prose: false };
    }
    if (opening !== null) {
      fence = opening[1]!;
      return { text: line, prose: false };
    }
    if (comment) {
      if (line.includes("-->")) comment = false;
      return { text: line, prose: false };
    }
    if (line.trimStart().startsWith("<!--")) {
      comment = !line.includes("-->");
      return { text: line, prose: false };
    }
    return { text: line, prose: true };
  });
}

/** The id that GitHub and VS Code give a heading: lower case, without punctuation, spaces as hyphens. */
export function headingSlug(heading: string): string {
  const text = heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .trim()
    .toLowerCase();
  return text.replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

/** The anchors of a page: each <a id> or <a name>, and each heading slug, with -1, -2 for a slug that comes again. */
export function anchorsOf(text: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const line of proseLines(text)) {
    for (const match of line.text.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) anchors.add(match[1]!);
    if (!line.prose) continue;
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line.text);
    if (heading === null) continue;
    const slug = headingSlug(heading[1]!);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

export interface Link {
  /** 1 is the first line. */
  line: number;
  image: boolean;
  target: string;
}

/** The links and images of the prose lines; links inside inline code are not links. */
export function linksOf(text: string): Link[] {
  const links: Link[] = [];
  proseLines(text).forEach((line, index) => {
    if (!line.prose) return;
    // Inline code that holds no link text: `[x](y)` inside one pair of backticks is code, not a link.
    const outside = line.text.replace(/`[^`]*`/g, (code) => (code.includes("](") ? " ".repeat(code.length) : code));
    for (const match of outside.matchAll(/(!?)\[(?:[^\]`]|`[^`]*`)*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      links.push({ line: index + 1, image: match[1] === "!", target: match[2]! });
    }
  });
  return links;
}
