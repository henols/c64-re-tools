// c64-docs link.ts: links the name mentions of the documentation to the
// source and the reference, and checks every link and image of the pages.
// With --check it writes nothing and fails when a page is not up to date.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { parseArgs } from "node:util";

import { WireFailure } from "#src/host-client/tools.ts";
import { writeProjectFile } from "#src/host-client/transfer.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { currentRevision, listSymbols } from "#src/knowledge/read.ts";
import { resolveProjectFile, resolveProjectPath } from "#src/project.ts";
import { runBody, UsageError } from "#src/script.ts";
import { checkLinks, linkPage, type Files, type Problem } from "./lib/links.ts";
import { GENERATED_MARK } from "./lib/reference.ts";
import { readSourceMap } from "./lib/source-map.ts";

const USAGE = `link.ts <pages>... --source <dir> [--reference <dir>] [--check]

  <pages>...         .md files and directories of the documentation, relative to
                     the project folder, for example README.md docs; link.ts reads
                     each file and every .md file below each directory
  --source <dir>     the source directory of c64-source, with its source-map.json
  --reference <dir>  the reference pages of generate.ts; the default is the
                     reference/ folder of the first directory that has one
  --check            write nothing; fail when a link is not up to date or a page
                     has a problem

A name in backticks gets a link to its line in the source. An address in
backticks after the name gets a link to the entry of the name in the reference.
The result is one JSON object.`;

const MAX_LISTED = 50;
/** A name outside the image covers the addresses up to the next name, at most this many. */
const MAX_BODY = 256;

const isDirectory = (path: string) => {
  const real = resolveProjectPath(path);
  return existsSync(real) && statSync(real).isDirectory();
};

function markdownFiles(directory: string): string[] {
  if (!isDirectory(directory)) throw new WireFailure("not-found", `There is no directory ${directory} in the project folder.`);
  let root: string;
  try {
    root = resolveProjectFile(directory);
  } catch {
    throw new WireFailure("invalid-input", `${directory} leads out of the project folder through a symbolic link.`);
  }
  const found: string[] = [];
  const walk = (relative: string) => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = posix.join(relative, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md")) found.push(posix.join(directory, path));
    }
  };
  walk("");
  return found;
}

/** The text of each file that the run read: a page, a source file or a reference page is read once. */
const texts = new Map<string, string | undefined>();

const files: Files = {
  inside: (path) => {
    try {
      resolveProjectPath(path);
      return true;
    } catch {
      return false;
    }
  },
  exists: (path) => {
    try {
      resolveProjectFile(path);
      return true;
    } catch {
      return false;
    }
  },
  text: (path) => {
    if (texts.has(path)) return texts.get(path);
    let text: string | undefined;
    try {
      const real = resolveProjectFile(path);
      text = statSync(real).isFile() ? readFileSync(real, "utf8") : undefined;
    } catch {
      text = undefined;
    }
    texts.set(path, text);
    return text;
  },
};

/** A .md entry of a directory that is a symbolic link to no file, or to a file outside the project. */
const unreadable = (page: string): Problem => ({ page, line: 1, kind: "missing-file", message: `${page} is a symbolic link to no file or to a file outside the project folder.` });

function run(argv: string[]): { output: Record<string, unknown>; failed: boolean } {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { source: { type: "string" }, reference: { type: "string" }, check: { type: "boolean" }, help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  if (positionals.length === 0) throw new UsageError("give the pages: .md files and directories of the documentation, for example README.md docs");
  if (values.source === undefined) throw new UsageError("give --source <dir>: the source directory of c64-source");
  const given = [...new Set(positionals.map((path) => posix.normalize(path)))];
  for (const [option, path] of [...given.map((path) => ["<pages>", path] as const), ["--source", values.source], ["--reference", values.reference]] as const) {
    if (path === undefined) continue;
    if (!files.inside(path)) throw new UsageError(`${option} must be a path relative to the project folder that stays inside it, not ${path}`);
  }
  for (const path of given) {
    if (!path.endsWith(".md") && files.exists(path) && !isDirectory(path)) throw new UsageError(`<pages> takes .md files and directories, not ${path}`);
  }
  const directories = given.filter((path) => !path.endsWith(".md") || isDirectory(path));
  const map = readSourceMap(values.source);
  const reference = values.reference === undefined ? directories.map((path) => posix.join(path, "reference")).find((path) => isDirectory(path)) : posix.normalize(values.reference);
  const problems: Problem[] = [];
  const db = openForRead();
  let symbols;
  let revision;
  try {
    revision = currentRevision(db);
    symbols = listSymbols(db, undefined, undefined, undefined, map.space);
  } finally {
    db?.close();
  }
  if (map.revision !== revision) {
    problems.push({ page: map.pathOf("source-map.json"), line: 1, kind: "stale-reference", message: `The source is from knowledge revision ${map.revision}, and the knowledge is at ${revision}. Generate the source and the reference again, then run link.ts.` });
  }
  const addresses = new Map<string, number>();
  for (const label of map.labels) addresses.set(label.name, label.address);
  for (const symbol of symbols) addresses.set(symbol.name, symbol.address);
  // A routine runs to the next routine; any other name to the next name of the knowledge, in its file, and outside the image at most MAX_BODY bytes.
  const routines = symbols.filter((symbol) => symbol.kind === "routine").map((symbol) => symbol.address).sort((a, b) => a - b);
  const named = [...new Set(symbols.map((symbol) => symbol.address))].sort((a, b) => a - b);
  const kinds = new Map(symbols.map((symbol) => [symbol.name, symbol.kind]));
  const bodyEnds = new Map<string, number | undefined>();
  const bodyEnd = (name: string) => {
    if (bodyEnds.has(name)) return bodyEnds.get(name);
    const address = addresses.get(name);
    let end: number | undefined;
    if (address !== undefined) {
      const next = ((kinds.get(name) === "routine" ? routines : named).find((other) => other > address) ?? 0x10000) - 1;
      const file = map.lineOf(address)?.file;
      if (file === undefined) end = Math.min(next, address + MAX_BODY - 1);
      else {
        end = address;
        while (end < next && map.lineOf(end + 1)?.file === file) end++;
      }
    }
    bodyEnds.set(name, end);
    return end;
  };
  const nameAt = new Map(symbols.map((symbol) => [symbol.address, symbol.name]));
  /** The routine, else the name, whose body holds an address. */
  const placeOf = (address: number) => {
    for (const list of [routines, named]) {
      let start: number | undefined;
      for (const other of list) if (other <= address) start = other;
      const name = start === undefined ? undefined : nameAt.get(start);
      if (name !== undefined && (bodyEnd(name) ?? start!) >= address) return name;
    }
    return undefined;
  };

  // The entries of the reference: each <a id> that is a name.
  const entries = new Map<string, string>();
  const referencePages = reference === undefined ? [] : markdownFiles(reference);
  for (const page of referencePages) {
    const text = files.text(page);
    if (text === undefined) {
      problems.push(unreadable(page));
      continue;
    }
    const stamp = /^<!-- Generated by c64-docs from knowledge revision (\S+) /.exec(text);
    if (text.startsWith(GENERATED_MARK) && stamp !== null && stamp[1] !== map.revision) {
      problems.push({ page, line: 1, kind: "stale-reference", message: `${page} is from knowledge revision ${stamp[1]}, and the source from ${map.revision}. Run generate.ts again.` });
    }
    for (const match of text.matchAll(/<a id="([^"]+)"><\/a>/g)) if (addresses.has(match[1]!) && !entries.has(match[1]!)) entries.set(match[1]!, `${page}#${match[1]}`);
  }
  const inside = (path: string, directory: string | undefined) => directory !== undefined && (path === directory || path.startsWith(`${directory}/`));
  const context = {
    addressOf: (name: string) => addresses.get(name),
    codeOf: (name: string) => {
      const label = map.labelOf(name);
      return label === undefined ? undefined : `${map.pathOf(label.file)}#L${label.line}`;
    },
    entryOf: (name: string) => entries.get(name),
    bodyEnd,
    placeOf,
    lineOf: (address: number) => {
      const line = map.lineOf(address);
      return line === undefined ? undefined : `${map.pathOf(line.file)}#L${line.line}`;
    },
    managed: (path: string) => inside(path, posix.normalize(map.directory)) || inside(path, reference),
  };

  const pages = [...new Set(given.flatMap((path) => {
    if (directories.includes(path)) return markdownFiles(path);
    if (files.text(path) === undefined) throw new WireFailure("not-found", `There is no file ${path} in the project folder.`);
    return [path];
  }))];
  const changedPages: string[] = [];
  let links = 0;
  for (const page of pages) {
    const text = files.text(page);
    if (text === undefined) {
      problems.push(unreadable(page));
      continue;
    }
    // A generated page is right by its making: it is only checked.
    const generated = text.startsWith(GENERATED_MARK);
    const linked = generated ? { text, changed: 0, problems: [] } : linkPage(text, { page, ...context });
    problems.push(...linked.problems, ...checkLinks(page, linked.text, files));
    if (linked.changed === 0) continue;
    links += linked.changed;
    changedPages.push(page);
    if (values.check) continue;
    writeProjectFile(page, Buffer.from(linked.text, "utf8"));
    texts.set(page, linked.text);
  }
  const byKind: Record<string, number> = {};
  for (const problem of problems) byKind[problem.kind] = (byKind[problem.kind] ?? 0) + 1;
  const output: Record<string, unknown> = {
    pages: pages.length,
    ...(reference === undefined ? { reference: "none: run generate.ts for links to the entries" } : { reference }),
    ...(values.check ? { notUpToDate: { links, pages: changedPages } } : { linked: { links, pages: changedPages } }),
    problems: { count: problems.length, byKind, listed: problems.slice(0, MAX_LISTED).map((problem) => ({ at: `${problem.page}:${problem.line}`, kind: problem.kind, message: problem.message })) },
  };
  return { output, failed: problems.length > 0 || (values.check === true && links > 0) };
}

await runBody(
  (argv) => {
    const { output, failed } = run(argv);
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
