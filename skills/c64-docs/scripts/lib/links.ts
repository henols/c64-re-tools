// The links of a page written by a person. A name in backticks links to
// its line in the source; the address after it links to the entry of the name
// in the reference, or, for an address inside the routine or the data of the
// name ("draw_room $0AAF", a place in draw_room), to the line of that address. A link that points into the source or the reference is
// managed: docs.ts link writes it again when a line moves. Other links stay as the
// person wrote them; docs.ts link only checks that their targets exist.

import { posix } from "node:path";

import { anchorsOf, linksOf, proseLines } from "./markdown.ts";

export interface LinkContext {
  /** The page, relative to the project folder. */
  page: string;
  /** The address of a name of the knowledge or of the source; undefined for a word that is no name. */
  addressOf: (name: string) => number | undefined;
  /** The project path and line of the label of a name, as path#Lnn. */
  codeOf: (name: string) => string | undefined;
  /** The project path and anchor of the entry of a name, as path#name. */
  entryOf: (name: string) => string | undefined;
  /** The last address of the routine or data of a name: an address up to it is a place inside the name. */
  bodyEnd: (name: string) => number | undefined;
  /** The project path and line that writes an address, as path#Lnn. */
  lineOf: (address: number) => string | undefined;
  /** The name of the routine or data that holds an address, for a message. */
  placeOf: (address: number) => string | undefined;
  /** True for a project path that docs.ts link manages: a file of the source or a page of the reference. */
  managed: (path: string) => boolean;
}

export type ProblemKind = "unknown-name" | "wrong-address" | "missing-file" | "missing-anchor" | "missing-line" | "outside-project" | "stale-reference";

export interface Problem {
  page: string;
  /** 1 is the first line. */
  line: number;
  kind: ProblemKind;
  message: string;
}

const NAME = String.raw`([A-Za-z_][A-Za-z0-9_]*)(\+(?:\$[0-9A-Fa-f]{1,4}|[0-9]+))?`;
const ADDRESS = String.raw`\$([0-9A-Fa-f]{2,4})(?:-\$[0-9A-Fa-f]{2,4})?`;
const TICK = "`";
/**
 * A name in backticks, linked or not, with an optional address in backticks
 * after it, linked or not. Groups: 1 the [ of a linked name, 2 the name, 3 its
 * offset, 4 the target of the name, 5 the space or bracket between them, 6 the
 * address text, 7 its start digits, 8 the target of the address.
 */
const MENTION = new RegExp(
  String.raw`(\[)?${TICK}${NAME}${TICK}(?:\]\(([^)\s]*)\))?(?:(\s*\(\s*|\s+)\[?${TICK}(${ADDRESS})${TICK}(?:\]\(([^)\s]*)\))?)?`,
  "g",
);

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
  const lines = proseLines(text).map((line, index) => {
    if (!line.prose) return line.text;
    return line.text.replace(MENTION, (whole: string, open: string | undefined, name: string, offset: string | undefined, nameTarget: string | undefined, space: string | undefined, addressText: string | undefined, digits: string | undefined, addressTarget: string | undefined, at: number, all: string) => {
      // "[`x`]" without a target is no link of ours: leave it.
      if (open !== undefined && nameTarget === undefined) return whole;
      const ownLink = (target: string | undefined) => target !== undefined && !context.managed(targetPath(context.page, target) ?? "");
      const address = context.addressOf(name);
      const report = (kind: ProblemKind, message: string) => problems.push({ page: context.page, line: index + 1, kind, message });
      // In a list "`a`/`b` `$1000`/`$1010`" the address belongs to another name: the name gets its link, the address stays as it is.
      const namePart = open === undefined ? `${TICK}${name}${offset ?? ""}${TICK}` : `[${TICK}${name}${offset ?? ""}${TICK}](${nameTarget})`;
      const listed = addressText !== undefined && (all[at - 1] === "/" || all[at + whole.length] === "/");
      const rest = listed ? whole.slice(namePart.length) : "";
      const claimed = addressText !== undefined;
      if (listed) addressText = digits = addressTarget = undefined;
      if (address === undefined) {
        // A word in backticks is no claim of a name; with an address after it, or with a link of ours, it is.
        if (claimed || (nameTarget !== undefined && !ownLink(nameTarget))) {
          report("unknown-name", `\`${name}\` is no name of the knowledge or the source. Apply the name to the knowledge, or correct the page.`);
        }
        return whole;
      }
      const delta = offset === undefined ? 0 : offset.startsWith("+$") ? Number.parseInt(offset.slice(2), 16) : Number.parseInt(offset.slice(1), 10);
      const given = digits === undefined ? undefined : Number.parseInt(digits, 16);
      const place = given !== undefined && given !== address + delta && given > address && given <= (context.bodyEnd(name) ?? address);
      if (given !== undefined && given !== address + delta && !place) {
        const expected = `$${(address + delta).toString(16).toUpperCase().padStart(4, "0")}`;
        const holder = context.placeOf(given!);
        report("wrong-address", `\`${name}${offset ?? ""}\` is ${expected} in the knowledge, and the page gives ${addressText}${holder === undefined || holder === name ? "" : `, a place in \`${holder}\``}. Correct the name or the address.${digits!.length <= 2 ? ` For a value, write \`${name}\` = \`${addressText}\`.` : ""}`);
      }
      const shownName = `${TICK}${name}${offset ?? ""}${TICK}`;
      const code = context.codeOf(name);
      const nameLink = ownLink(nameTarget) ? `[${shownName}](${nameTarget})` : code === undefined ? shownName : `[${shownName}](${relative(context.page, code)})`;
      let result = nameLink;
      if (addressText !== undefined) {
        const entry = place ? context.lineOf(given!) : context.entryOf(name);
        const shownAddress = `${TICK}${addressText}${TICK}`;
        result += space! + (ownLink(addressTarget) ? `[${shownAddress}](${addressTarget})` : entry === undefined ? shownAddress : `[${shownAddress}](${relative(context.page, entry)})`);
      }
      result += rest;
      if (result !== whole) changed++;
      return result;
    });
  });
  return { text: lines.join("\n"), changed, problems };
}

/** The files that a check reads: their text, or undefined when the file does not exist. */
export interface Files {
  exists: (path: string) => boolean;
  /** The text of a project file, or undefined when it is no file. */
  text: (path: string) => string | undefined;
  inside: (path: string) => boolean;
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
      report("outside-project", `${link.target} leaves the project folder.`);
      continue;
    }
    if (!files.exists(path)) {
      report("missing-file", `${link.target}: there is no ${path}.`);
      continue;
    }
    if (fragment === undefined || fragment === "") continue;
    const line = /^L(\d+)(?:-L?\d+)?$/.exec(fragment);
    if (path.endsWith(".md")) {
      if (!anchorsAt(path).has(fragment)) report("missing-anchor", `${link.target}: ${path} has no anchor ${fragment}.`);
    } else if (line !== null) {
      const count = lineCount(path);
      if (Number(line[1]) > count) report("missing-line", `${link.target}: ${path} has ${count} lines.`);
    }
  }
  return problems;
}
