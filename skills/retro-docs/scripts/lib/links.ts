// The links of a page written by a person. A name in backticks with its
// address in backticks after it ("draw_room $09BC") is one link to the line of
// the name in the source, or, for an address inside the routine or the data of
// the name ("draw_room $0AAF", a place in draw_room), to the line of that
// address. A name without an address gets no link: the person gives the
// address only where a reader needs the code. A link that points into the
// source or the reference is managed: docs.ts link writes it again when a line
// moves. Other links stay as the person wrote them; docs.ts link only checks
// that their targets exist. In a group folder, a label before the name
// ("v2:draw_room $09BC") names the project of the group that has the name.

import { posix } from "node:path";

import { anchorsOf, linksOf, proseLines } from "./markdown.ts";

/** The names of one project: of its knowledge and of its source. */
export interface Names {
  /** The address of a name of the knowledge or of the source; undefined for a word that is no name. */
  addressOf: (name: string) => number | undefined;
  /** The path and line of the label of a name, as path#Lnn. */
  codeOf: (name: string) => string | undefined;
  /** The last address of the routine or data of a name: an address up to it is a place inside the name. */
  bodyEnd: (name: string) => number | undefined;
  /** The path and line that writes an address, as path#Lnn. */
  lineOf: (address: number) => string | undefined;
  /** The name of the routine or data that holds an address, for a message. */
  placeOf: (address: number) => string | undefined;
}

export interface LinkContext {
  /** The page, relative to the folder of the run: the project, or the group folder. */
  page: string;
  /**
   * The names of the project of a label, or for no label of the project of the
   * page. A problem when the label or the page names no project. Undefined
   * for a label without a group: the mention is no mention.
   */
  names: (label: string | undefined) => Names | { kind: ProblemKind; message: string } | undefined;
  /** True for a path that docs.ts link manages: a file of the source or a page of the reference. */
  managed: (path: string) => boolean;
}

export type ProblemKind = "unknown-name" | "wrong-address" | "repeated-link" | "link-in-table" | "missing-file" | "missing-anchor" | "missing-line" | "outside-project" | "outside-group" | "unknown-label" | "unlabelled-name" | "stale-reference";

export interface Problem {
  page: string;
  /** 1 is the first line. */
  line: number;
  kind: ProblemKind;
  message: string;
}

const NAME = String.raw`([A-Za-z_][A-Za-z0-9_]*)(\+(?:\$[0-9A-Fa-f]{1,4}|[0-9]+))?`;
const ADDRESS = String.raw`\$([0-9A-Fa-f]{2,4})(?:-\$[0-9A-Fa-f]{2,4})?`;
/** The label of a project: the name of its folder. */
const LABEL = String.raw`([A-Za-z0-9_][A-Za-z0-9_.-]*):`;
const TICK = "`";
/**
 * A name in backticks and an address in backticks after it, as text or as one
 * link. Groups: 1 the [ of the link, 2 the label, 3 the name, 4 its offset, 5
 * the space between them, 6 the address text, 7 its start digits, 8 the target
 * of the link.
 */
const MENTION = new RegExp(String.raw`(\[)?${TICK}(?:${LABEL})?${NAME}${TICK}(\s+)${TICK}(${ADDRESS})${TICK}(?:\]\(([^)\s]*)\))?`, "g");
const HEADING = /^#{1,6}\s/;
const TABLE_ROW = /^\s*\|/;

const relative = (page: string, target: string) => {
  const [path, fragment] = target.split("#");
  const shown = posix.relative(posix.dirname(page), path!) || posix.basename(path!);
  return fragment === undefined ? shown : `${shown}#${fragment}`;
};
/** The project path of a link target, without its fragment; undefined for a link out of the project (a URL, or a page anchor only). */
export function targetPath(page: string, target: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return undefined;
  const raw = target.split("#")[0]!;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    // A % that starts no escape ("100%.md") is part of the name.
  }
  return posix.normalize(posix.join(posix.dirname(page), path));
}

/** Writes the links of the name mentions of a page; returns the new text, the number of links changed and the problems. */
export function linkPage(text: string, context: LinkContext): { text: string; changed: number; problems: Problem[] } {
  const problems: Problem[] = [];
  let changed = 0;
  // The first link of each name and address in the section: a heading starts a new section.
  let linkedAt = new Map<string, number>();
  const lines = proseLines(text).map((line, index) => {
    if (!line.prose) return line.text;
    if (HEADING.test(line.text)) linkedAt = new Map();
    const inTable = TABLE_ROW.test(line.text);
    return line.text.replace(MENTION, (whole: string, open: string | undefined, label: string | undefined, name: string, offset: string | undefined, space: string, addressText: string, digits: string, target: string | undefined) => {
      // "[`x` `$10`]" without a target, or "`x` `$10`](y)" in a link of the person: no link of ours, leave it.
      if ((open === undefined) !== (target === undefined)) return whole;
      // A link to another target than the source is the person's own link: it stays as it is.
      if (target !== undefined && !context.managed(targetPath(context.page, target) ?? "")) return whole;
      const report = (kind: ProblemKind, message: string) => problems.push({ page: context.page, line: index + 1, kind, message });
      const labelled = `${label === undefined ? "" : `${label}:`}${name}`;
      const names = context.names(label);
      if (names === undefined) return whole;
      if ("kind" in names) {
        report(names.kind, `\`${labelled}\` ${addressText}: ${names.message}`);
        return whole;
      }
      const address = names.addressOf(name);
      const shown = `${TICK}${labelled}${offset ?? ""}${TICK}${space}${TICK}${addressText}${TICK}`;
      if (address === undefined) {
        report("unknown-name", `\`${labelled}\` is no name of the knowledge or the source${label === undefined ? "" : ` of the project ${label}`}. Record the name in the project knowledge, or correct the page.`);
        return whole;
      }
      const delta = offset === undefined ? 0 : offset.startsWith("+$") ? Number.parseInt(offset.slice(2), 16) : Number.parseInt(offset.slice(1), 10);
      const given = Number.parseInt(digits, 16);
      const place = given !== address + delta && given > address && given <= (names.bodyEnd(name) ?? address);
      if (given !== address + delta && !place) {
        const expected = `$${(address + delta).toString(16).toUpperCase().padStart(4, "0")}`;
        const holder = names.placeOf(given);
        report("wrong-address", `\`${labelled}${offset ?? ""}\` is ${expected} in the knowledge, and the page gives ${addressText}${holder === undefined || holder === name ? "" : `, a place in \`${holder}\``}. Correct the name or the address.${digits.length <= 2 ? ` For a value, write \`${name}\` = \`${addressText}\`.` : ""}`);
        // A mention with a problem gets no link: the text stays as the person wrote it until it is correct.
        return whole;
      }
      if (inTable) {
        report("link-in-table", `\`${labelled}${offset ?? ""}\` ${addressText} is a link in a table. Write \`${labelled}\` without the address in the table, and link it in the text above the table.`);
        return whole;
      }
      const key = `${labelled}${offset ?? ""} ${given}`;
      const first = linkedAt.get(key);
      if (first !== undefined) {
        report("repeated-link", `\`${labelled}${offset ?? ""}\` ${addressText} has a link at line ${first} of this section already. Write \`${labelled}\` without the address here.`);
        return whole;
      }
      linkedAt.set(key, index + 1);
      // The name links to its line; a place inside it or a byte after it links to the line of that address.
      const code = given === address ? names.codeOf(name) : (names.lineOf(given) ?? names.codeOf(name));
      const result = code === undefined ? shown : `[${shown}](${relative(context.page, code)})`;
      if (result !== whole) changed++;
      return result;
    });
  });
  return { text: lines.join("\n"), changed, problems };
}

/** The files that a check reads: their text, or undefined when the file does not exist. */
export interface Files {
  exists: (path: string) => boolean;
  /** The text of a file, or undefined when it is no file. */
  text: (path: string) => string | undefined;
  /** True for a path in the folder of the run: the project, or the group folder. */
  inside: (path: string) => boolean;
  /** True when the folder of the run is a group folder or a project in one: a link may go into the other projects. */
  group: boolean;
  /** A path as the messages give it: relative to the folder where the pages were given. */
  shown: (path: string) => string;
}

/** Checks that each link and image of a page reaches a file, and its anchor or line. */
export function checkLinks(page: string, text: string, files: Files): Problem[] {
  const problems: Problem[] = [];
  const anchors = new Map<string, Set<string>>();
  const anchorsAt = (path: string) => {
    if (!anchors.has(path)) anchors.set(path, anchorsOf(path === page ? text : (files.text(path) ?? "")));
    return anchors.get(path)!;
  };
  const lineCounts = new Map<string, number>();
  const lineCount = (path: string) => {
    if (!lineCounts.has(path)) lineCounts.set(path, (files.text(path) ?? "").split("\n").length);
    return lineCounts.get(path)!;
  };
  for (const link of linksOf(text)) {
    const report = (kind: ProblemKind, message: string) => problems.push({ page, line: link.line, kind, message });
    const fragment = link.target.includes("#") ? link.target.slice(link.target.indexOf("#") + 1) : undefined;
    if (/^[a-z][a-z0-9+.-]*:/i.test(link.target)) continue;
    const path = link.target.startsWith("#") ? page : targetPath(page, link.target)!;
    if (!files.inside(path)) {
      if (files.group) report("outside-group", `${link.target} leaves the group folder.`);
      else report("outside-project", `${link.target} leaves the project folder.`);
      continue;
    }
    if (!files.exists(path)) {
      report("missing-file", `${link.target}: there is no ${files.shown(path)}.`);
      continue;
    }
    if (fragment === undefined || fragment === "") continue;
    const line = /^L(\d+)(?:-L?\d+)?$/.exec(fragment);
    if (path.endsWith(".md")) {
      if (!anchorsAt(path).has(fragment)) report("missing-anchor", `${link.target}: ${files.shown(path)} has no anchor ${fragment}.`);
    } else if (line !== null) {
      const count = lineCount(path);
      if (Number(line[1]) > count) report("missing-line", `${link.target}: ${files.shown(path)} has ${count} lines.`);
    }
  }
  return problems;
}
