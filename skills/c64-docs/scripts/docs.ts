// The c64-docs script. generate writes the reference pages of a program from
// the knowledge, the source map of c64-source and the program in the
// knowledge; the pages are generated and never edited. link links the name
// mentions of the documentation to the source and the reference, and checks
// every link and image of the pages.

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, posix } from "node:path";

import { Refusal } from "#src/errors.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { writeProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { conflicts } from "#src/knowledge/conflicts.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { programImage, type ProgramImage } from "#src/knowledge/program.ts";
import { currentRevision, listComments, listModules, listReferences, listRegions, listSymbols } from "#src/knowledge/read.ts";
import { resolveProjectFile, resolveProjectPath } from "#src/project.ts";
import { listed, OPTIONS, runScript, UsageError, type Call } from "#src/script.ts";
import { checkLinks, linkPage, type Files, type Problem } from "./lib/links.ts";
import { buildReference, GENERATED_MARK } from "./lib/reference.ts";
import { readSourceMap } from "./lib/source-map.ts";

// ---------------------------------------------------------------------------
// generate

/** The files of an earlier run in `directory`, the real folder of --out, or a refusal that names a file of a person. */
function oldFiles(out: string, directory: string): string[] {
  if (!existsSync(directory)) return [];
  const found: string[] = [];
  const walk = (relative: string) => {
    for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })) {
      const path = posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      const generated = path.endsWith(".md") ? readFileSync(join(directory, path), "utf8").startsWith(GENERATED_MARK) : path.startsWith("images/") && path.endsWith(".png");
      if (!generated) throw new WireFailure("invalid-input", `${posix.join(out, path)} is not a page of docs.ts generate. Nothing was written. Give --out a directory that holds only the reference, and keep the pages of a person outside it.`);
      found.push(path);
    }
  };
  walk("");
  return found;
}

function generate(call: Call): Record<string, unknown> {
  const source = call.subject(0);
  const out = call.string("out")!;
  // The files of an earlier run are deleted: only in a folder that is inside the project, also after its symbolic links.
  let directory = resolveProjectPath(out);
  if (existsSync(directory)) {
    try {
      directory = resolveProjectFile(out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project folder that stays inside it, also through symbolic links, not ${out}`);
    }
  }
  const map = readSourceMap(source);
  const db = openForRead();
  let knowledge;
  let image: ProgramImage | undefined;
  try {
    image = programImage(db, map.space);
    const found = conflicts(db).length;
    if (found > 0) throw new Refusal("conflict", `The knowledge has ${found} conflict${found === 1 ? "" : "s"} from a git merge. Nothing was written. Run c64-knowledge's knowledge.ts merge, then generate the source and the reference again.`);
    const revision = currentRevision(db);
    // A source of another revision has other lines: the links would point to the wrong code.
    if (map.revision !== revision) {
      throw new WireFailure("invalid-input", `${map.pathOf("source-map.json")} is from knowledge revision ${map.revision}, and the knowledge is at revision ${revision}. Nothing was written. Generate the source again with c64-source, then run docs.ts generate.`);
    }
    knowledge = {
      revision,
      symbols: listSymbols(db, undefined, undefined, undefined, map.space),
      regions: listRegions(db, undefined, undefined, undefined, map.space),
      comments: listComments(db, undefined, undefined, map.space),
      references: listReferences(db, undefined, undefined, undefined, map.space),
      modules: listModules(db, undefined, undefined, map.space),
    };
  } finally {
    db?.close();
  }
  const old = oldFiles(out, directory);
  const built = buildReference({
    out: posix.normalize(out),
    map,
    ...knowledge,
    ...(image === undefined ? {} : { image: { byteAt: image.byteAt, inImage: (address: number) => image.segments.some((segment) => address >= segment.start && address <= segment.end) } }),
  });
  for (const path of old) rmSync(join(directory, path), { force: true });
  const written = built.files.map((file) => writeReported(file.path, file.bytes, { what: "--out" }));
  return { out, revision: knowledge.revision, index: posix.join(posix.normalize(out), "index.md"), ...built.counts, files: listed(written, call.count("max-listed")!), program: image === undefined ? "none: put the program into the knowledge with knowledge.ts image to decode the tables and show the graphics" : "the knowledge" };
}

// ---------------------------------------------------------------------------
// link

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

function link(call: Call): Record<string, unknown> {
  const check = call.flag("check");
  const given = [...new Set(call.subjects.map((path) => posix.normalize(path)))];
  for (const path of given) if (!files.inside(path)) throw new UsageError(`<page> must be a path relative to the project folder that stays inside it, not ${path}`);
  for (const path of given) {
    if (!path.endsWith(".md") && files.exists(path) && !isDirectory(path)) throw new UsageError(`<pages> takes .md files and directories, not ${path}`);
  }
  const directories = given.filter((path) => !path.endsWith(".md") || isDirectory(path));
  const map = readSourceMap(call.string("source")!);
  const givenReference = call.string("reference");
  // The default reference: the reference/ folder in a given folder, or beside a given page.
  const besides = given.map((path) => (directories.includes(path) ? path : posix.dirname(path)));
  const reference = givenReference === undefined ? besides.map((path) => posix.join(path, "reference")).find((path) => isDirectory(path)) : posix.normalize(givenReference);
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
    problems.push({ page: map.pathOf("source-map.json"), line: 1, kind: "stale-reference", message: `The source is from knowledge revision ${map.revision}, and the knowledge is at ${revision}. Generate the source and the reference again, then run docs.ts link.` });
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
      problems.push({ page, line: 1, kind: "stale-reference", message: `${page} is from knowledge revision ${stamp[1]}, and the source from ${map.revision}. Run docs.ts generate again.` });
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
    if (check) continue;
    writeProjectFile(page, Buffer.from(linked.text, "utf8"));
    texts.set(page, linked.text);
  }
  const byKind: Record<string, number> = {};
  for (const problem of problems) byKind[problem.kind] = (byKind[problem.kind] ?? 0) + 1;
  const output: Record<string, unknown> = {
    pages: pages.length,
    ...(reference === undefined ? { reference: "none: no reference/ folder is in or beside the given pages. Give --reference <dir>, or run docs.ts generate for links to the entries" } : { reference }),
    ...(check ? { notUpToDate: { links, pages: changedPages } } : { linked: { links, pages: changedPages } }),
    problems: { byKind, ...listed(problems, call.count("max-listed")!, (problem) => ({ at: `${problem.page}:${problem.line}`, kind: problem.kind, message: problem.message })) },
  };
  return { result: problems.length > 0 || (check && links > 0) ? "FAIL" : "PASS", ...output };
}

const SOURCE = { kind: "path", value: "<dir>", help: "the source folder of c64-source, with its source-map.json, relative to the project folder" } as const;

await runScript({
  name: "docs",
  summary: "Generates the reference pages of a program, and links the name mentions of the documentation to the source and the reference.",
  commands: [
    {
      name: "generate",
      summary: "Writes the reference pages: a page for each module, and pages for the names, the variables, the tables, the memory map and the graphics.",
      subjects: [{ name: "<source-dir>", help: SOURCE.help }],
      options: {
        out: { ...OPTIONS.out, output: "folder", value: "<dir>", help: "the folder for the reference pages, relative to the project folder, for example docs/reference. generate writes only there and refuses a page in it that it did not write", required: true },
        "max-listed": OPTIONS["max-listed"],
      },
      notes: "When the knowledge has the program of the source (knowledge.ts image of the c64-knowledge skill), the reference decodes the tables and shows the graphics.",
      run: (call) => {
        if (!isDirectory(call.subject(0))) throw new Refusal("not-found", `There is no folder ${call.subject(0)} in the project folder. Give the source folder of c64-source.`);
        return generate(call);
      },
    },
    {
      name: "link",
      summary: "Links the name mentions of the pages to the source and the reference, and checks every link and image. result is FAIL when a page has a problem, or with --check when a link is not up to date.",
      subjects: [{ name: "<page>", help: ".md files and folders of the documentation, relative to the project folder, for example README.md docs. link reads each file and every .md file below each folder", list: true }],
      options: {
        source: { ...SOURCE, required: true },
        reference: { kind: "path", value: "<dir>", help: "the reference pages of docs.ts generate. The default is the first reference/ folder in a given folder or beside a given page" },
        check: { kind: "flag", help: "write nothing. FAIL when a link is not up to date or a page has a problem" },
        "max-listed": OPTIONS["max-listed"],
      },
      notes: "A name in backticks gets a link to its line in the source. An address in backticks after the name gets a link to the entry of the name in the reference.",
      run: link,
    },
  ],
});
