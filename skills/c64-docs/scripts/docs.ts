// The c64-docs script. generate writes the reference pages of a program from
// the knowledge, the source map that c64-source writes next to the generated
// source, and the program bytes in the knowledge; the pages are generated and
// never edited. link links the name
// mentions of the documentation to the source and the reference, and checks
// every link and image of the pages.

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";

import { Refusal } from "#src/errors.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { writeProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { conflicts } from "#src/knowledge/conflicts.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { programImage, type ProgramImage } from "#src/knowledge/program.ts";
import { currentRevision, listComments, listModules, listReferences, listRegions, listSymbols } from "#src/knowledge/read.ts";
import { groupOf, namedGroup, projectRoot, resolveProjectFile, resolveProjectPath, type ProjectGroup } from "#src/project.ts";
import { listed, OPTIONS, reply, runScript, UsageError, type Call, type Reply } from "#src/script.ts";
import { checkLinks, linkPage, type Files, type LinkContext, type Names, type Problem } from "./lib/links.ts";
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

function generate(call: Call): Reply {
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
    if (found > 0) throw new Refusal("conflict", `The knowledge has ${found} conflict${found === 1 ? "" : "s"} from a git merge. Nothing was written. Resolve the merge conflicts of the project knowledge. Then generate the source again from the knowledge, and run generate again.`);
    const revision = currentRevision(db);
    // A source of another revision has other lines: the links would point to the wrong code.
    if (map.revision !== revision) {
      throw new WireFailure("invalid-input", `${map.mapPath} is from knowledge revision ${map.revision}, and the knowledge is at revision ${revision}. Nothing was written. Generate the source again from the knowledge. Then run generate again.`);
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
  const files = listed(written, call.count("max-listed")!);
  const hints: string[] = [];
  if (image === undefined) hints.push("The knowledge has no program bytes. Thus the reference does not decode the tables and does not show the graphics. To get them, put the program bytes into the project knowledge and run generate again.");
  if (files.rest !== undefined) hints.push(`files is cut. To list all files, give ${files.rest}.`);
  hints.push("Write the pages of the documentation. Then run nextAction to link them to the source.");
  // The next step links the entry page and the folder above the reference, with the reference given, so that it also finds a reference that is not named reference/.
  const parent = posix.dirname(posix.normalize(out));
  return reply(
    { out, revision: knowledge.revision, index: posix.join(posix.normalize(out), "index.md"), ...built.counts, files, program: image === undefined ? "none" : "the knowledge" },
    { hint: hints.join(" "), nextAction: call.next("link", "README.md", ...(parent === "." ? [] : [parent]), "--source", source, "--reference", posix.normalize(out)) },
  );
}

// ---------------------------------------------------------------------------
// link

/** A name outside the image covers the addresses up to the next name, at most this many. */
const MAX_BODY = 256;

const isDirectory = (path: string, root = projectRoot()) => {
  const real = resolveProjectPath(path, root);
  return existsSync(real) && statSync(real).isDirectory();
};

/**
 * The folder of a link run. Without a group it is the project. With a group
 * it is the group folder: the paths of the run are relative to it, and a page
 * can link into each project of the group.
 */
interface Scope {
  /** The absolute folder that the paths of the run are relative to. */
  root: string;
  group: ProjectGroup | undefined;
  /** The folder of the given pages, relative to root: the project of the run, or "" for root itself. */
  base: string;
  /** True when the run is on the group folder: the project lookup refuses it, so nextAction gives it as --project. */
  unnamed: boolean;
}

/** A project of the run, and its folder relative to the root of the run. */
interface Member {
  /** The folder name in a group; undefined without a group. */
  label: string | undefined;
  root: string;
  prefix: string;
}

function linkScope(): Scope {
  let root: string;
  try {
    root = projectRoot();
  } catch (error) {
    // The project lookup refuses a group folder: given with --project or as the working directory, link works on the group.
    const group = namedGroup();
    if (group === undefined) throw error;
    return { root: group.root, group, base: "", unnamed: true };
  }
  const group = groupOf(root);
  if (group === undefined) return { root, group, base: "", unnamed: false };
  return { root: group.root, group, base: basename(root), unnamed: false };
}

/** True when `path` is `directory` or below it; every path is below "". */
const within = (path: string, directory: string | undefined) => directory !== undefined && (directory === "" || path === directory || path.startsWith(`${directory}/`));

function link(call: Call): Reply {
  const check = call.flag("check");
  const scope = linkScope();
  const { root, group } = scope;
  const folder = group !== undefined && scope.base === "" ? "the group folder" : "the project folder";
  const toRun = (path: string) => posix.normalize(posix.join(scope.base, path));
  const shown = (path: string) => (scope.base === "" ? path : posix.relative(scope.base, path));
  const members: Member[] = group === undefined ? [{ label: undefined, root, prefix: "" }] : [...group.projects].map(([label, project]) => ({ label, root: project, prefix: label }));
  const memberOf = (path: string) => members.find((member) => within(path, member.prefix));

  /** The text of each file that the run read: a page, a source file or a reference page is read once. */
  const texts = new Map<string, string | undefined>();
  const files: Files = {
    inside: (path) => {
      try {
        resolveProjectPath(path, root);
        return true;
      } catch {
        return false;
      }
    },
    exists: (path) => {
      try {
        resolveProjectFile(path, root);
        return true;
      } catch {
        return false;
      }
    },
    text: (path) => {
      if (texts.has(path)) return texts.get(path);
      let text: string | undefined;
      try {
        const real = resolveProjectFile(path, root);
        text = statSync(real).isFile() ? readFileSync(real, "utf8") : undefined;
      } catch {
        text = undefined;
      }
      texts.set(path, text);
      return text;
    },
    group: group !== undefined,
    shown,
  };
  const markdownFiles = (directory: string): string[] => {
    if (!isDirectory(directory, root)) throw new WireFailure("not-found", `There is no directory ${shown(directory)} in ${folder}.`);
    let real: string;
    try {
      real = resolveProjectFile(directory, root);
    } catch {
      throw new WireFailure("invalid-input", `${shown(directory)} leads out of ${folder} through a symbolic link.`);
    }
    const found: string[] = [];
    const walk = (relative: string) => {
      for (const entry of readdirSync(join(real, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const path = posix.join(relative, entry.name);
        // A dot folder is no documentation: .c64-re-tools/ holds the knowledge and the scratch of the agent, .git/ the history.
        if (entry.isDirectory() && entry.name.startsWith(".")) continue;
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".md")) found.push(posix.join(directory, path));
      }
    };
    walk("");
    return found;
  };
  /** A .md entry of a directory that is a symbolic link to no file, or to a file outside the folder of the run. */
  const unreadable = (page: string): Problem => ({ page, line: 1, kind: "missing-file", message: `${shown(page)} is a symbolic link to no file or to a file outside ${folder}.` });

  const given = [...new Set(call.subjects.map((path) => posix.normalize(path)))];
  const pagesGiven = given.map(toRun);
  given.forEach((path, index) => {
    if (!within(pagesGiven[index]!, scope.base) || !files.inside(pagesGiven[index]!)) throw new UsageError(`<page> must be a path relative to ${folder} that stays inside it, not ${path}`);
  });
  given.forEach((path, index) => {
    const page = pagesGiven[index]!;
    if (!page.endsWith(".md") && files.exists(page) && !isDirectory(page, root)) throw new UsageError(`<pages> takes .md files and directories, not ${path}`);
  });
  const directories = pagesGiven.filter((path) => !path.endsWith(".md") || isDirectory(path, root));
  // --source and --reference are relative to each project folder: the projects of a group have the same layout.
  const inProjectFolder = (name: string, value: string) => {
    const path = posix.normalize(value.replaceAll("\\", "/"));
    if (posix.isAbsolute(path) || /^[A-Za-z]:/.test(path) || path === ".." || path.startsWith("../")) throw new UsageError(`--${name} must be a path relative to the project folder that stays inside it, not ${value}`);
    return path;
  };
  const source = inProjectFolder("source", call.string("source")!);
  const givenReference = call.string("reference");
  const checkedReference = givenReference === undefined ? undefined : inProjectFolder("reference", givenReference);
  // The default reference: the reference/ folder in a given folder, or beside a given page, of a project.
  const besides = pagesGiven.map((path) => (directories.includes(path) ? path : posix.dirname(path)));
  const foundReference = besides.map((path) => posix.join(path, "reference")).find((path) => memberOf(path) !== undefined && isDirectory(path, root));
  const reference = checkedReference !== undefined ? checkedReference : foundReference === undefined ? undefined : foundReference.slice(memberOf(foundReference)!.prefix.length).replace(/^\//, "");
  const referenceOf = (member: Member) => (reference === undefined ? undefined : posix.join(member.prefix, reference));
  const problems: Problem[] = [];

  /** The names of a project, read the first time a page needs them. A project with given pages is read before the pages. */
  const loaded = new Map<Member, Names>();
  const load = (member: Member, required: boolean): Names => {
    const done = loaded.get(member);
    if (done !== undefined) return done;
    const of = member.label === undefined ? "" : ` of the project ${member.label}`;
    const inProject = (path: string) => posix.join(member.prefix, path);
    let map;
    try {
      map = readSourceMap(source, member.root);
    } catch (error) {
      if (member.label === undefined || !(error instanceof WireFailure)) throw error;
      throw new WireFailure(error.code, `In the project ${member.label}: ${error.message}`);
    }
    const db = openForRead(member.root);
    let symbols;
    let revision;
    try {
      revision = currentRevision(db);
      symbols = listSymbols(db, undefined, undefined, undefined, map.space);
    } finally {
      db?.close();
    }
    if (map.revision !== revision) {
      problems.push({ page: inProject(map.mapPath), line: 1, kind: "stale-reference", message: `The source${of} is from knowledge revision ${map.revision}, and the knowledge is at ${revision}. Generate the source and the reference again, then run docs.ts link.` });
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

    // The pages of the reference: each must be from the revision of the source.
    const referenceDirectory = referenceOf(member);
    const referencePages = referenceDirectory === undefined || (!required && !isDirectory(referenceDirectory, root)) ? [] : markdownFiles(referenceDirectory);
    for (const page of referencePages) {
      const text = files.text(page);
      if (text === undefined) {
        problems.push(unreadable(page));
        continue;
      }
      const stamp = /^<!-- Generated by c64-docs from knowledge revision (\S+) /.exec(text);
      if (text.startsWith(GENERATED_MARK) && stamp !== null && stamp[1] !== map.revision) {
        problems.push({ page, line: 1, kind: "stale-reference", message: `${shown(page)} is from knowledge revision ${stamp[1]}, and the source${of} from ${map.revision}. Run docs.ts generate again.` });
      }
    }
    const names: Names = {
      addressOf: (name) => addresses.get(name),
      codeOf: (name) => {
        const label = map.labelOf(name);
        return label === undefined ? undefined : `${inProject(map.pathOf(label.file))}#L${label.line}`;
      },
      bodyEnd,
      placeOf,
      lineOf: (address) => {
        const line = map.lineOf(address);
        return line === undefined ? undefined : `${inProject(map.pathOf(line.file))}#L${line.line}`;
      },
    };
    loaded.set(member, names);
    return names;
  };
  for (const member of members) if (pagesGiven.some((page) => memberOf(page) === member)) load(member, true);

  const labels = members.map((member) => member.label!);
  const namesFor = (page: string) => (label: string | undefined): ReturnType<LinkContext["names"]> => {
    if (group === undefined) return label === undefined ? load(members[0]!, false) : undefined;
    if (label === undefined) {
      const own = memberOf(page);
      if (own !== undefined) return load(own, false);
      return { kind: "unlabelled-name", message: `A page of the group folder must name the project of each name. Write the folder of the project before the name, for example \`${labels[0]}:name\`.` };
    }
    const member = members.find((each) => each.label === label);
    if (member === undefined) return { kind: "unknown-label", message: `${label} is no project of the group folder. The projects are ${labels.join(", ")}. Correct the label.` };
    return load(member, false);
  };
  const managed = (path: string) => members.some((member) => within(path, posix.join(member.prefix, source)) || within(path, referenceOf(member)));

  const pages = [...new Set(pagesGiven.flatMap((path) => {
    if (directories.includes(path)) return markdownFiles(path);
    if (files.text(path) === undefined) throw new WireFailure("not-found", `There is no file ${shown(path)} in ${folder}.`);
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
    const linked = generated ? { text, changed: 0, problems: [] } : linkPage(text, { page, names: namesFor(page), managed });
    problems.push(...linked.problems, ...checkLinks(page, linked.text, files));
    if (linked.changed === 0) continue;
    links += linked.changed;
    changedPages.push(shown(page));
    if (check) continue;
    writeProjectFile(page, Buffer.from(linked.text, "utf8"), { root });
    texts.set(page, linked.text);
  }
  const byKind: Record<string, number> = {};
  for (const problem of problems) byKind[problem.kind] = (byKind[problem.kind] ?? 0) + 1;
  const shownProblems = listed(problems, call.count("max-listed")!, (problem) => ({
    at: `${shown(problem.page)}:${problem.line}`,
    ...(group === undefined ? {} : { project: memberOf(problem.page)?.label ?? "shared" }),
    kind: problem.kind,
    message: problem.message,
  }));
  const output: Record<string, unknown> = {
    ...(group === undefined ? {} : { group: { folder: scope.base === "" ? "." : "..", projects: labels } }),
    pages: pages.length,
    reference: reference ?? "none",
    ...(check ? { notUpToDate: { links, pages: changedPages } } : { linked: { links, pages: changedPages } }),
    problems: { byKind, ...shownProblems },
  };
  const again = (withCheck: boolean) =>
    call.next("link", ...call.subjects, "--source", call.string("source")!, ...(givenReference === undefined ? [] : ["--reference", givenReference]), ...(withCheck ? ["--check"] : []), ...(scope.unnamed ? ["--project", root] : []));
  const hints: string[] = [];
  let nextAction: string | undefined;
  if (reference === undefined) hints.push("No reference/ folder is in or beside the given pages, so the links to the reference are not checked. Give --reference <dir>, or run generate first.");
  if (problems.length > 0) {
    hints.push("Correct each problem in problems.listed as its message tells. Then run nextAction.");
    if (shownProblems.rest !== undefined) hints.push(`problems is cut. To list all problems, give ${shownProblems.rest}.`);
    nextAction = again(check);
  } else if (check && links > 0) {
    hints.push("Some links are not up to date. Run nextAction to write them.");
    nextAction = again(false);
  }
  return reply({ result: problems.length > 0 || (check && links > 0) ? "FAIL" : "PASS", ...output }, { ...(hints.length === 0 ? {} : { hint: hints.join(" ") }), nextAction });
}

const SOURCE = { kind: "path", value: "<dir>", help: "the folder of the source that was generated from the knowledge, relative to the project folder" } as const;

await runScript({
  name: "docs",
  summary: "Generates the reference pages of a program, and links the names in the documentation to their lines in the source.",
  commands: [
    {
      name: "generate",
      summary: "Writes the reference pages: a page for each module, and pages for the tables, the memory map with the variables, and the graphics.",
      subjects: [{ name: "<source-dir>", help: SOURCE.help }],
      options: {
        out: { ...OPTIONS.out, output: "folder", value: "<dir>", help: "the folder for the reference pages, relative to the project folder, for example docs/reference. generate writes only there and refuses a page in it that it did not write", required: true },
        "max-listed": OPTIONS["max-listed"],
      },
      notes: "When the project knowledge has the program bytes, the reference decodes the tables and shows the graphics.",
      run: (call) => {
        if (!isDirectory(call.subject(0))) throw new Refusal("not-found", `There is no folder ${call.subject(0)} in the project folder. Give the folder of the source that was generated from the knowledge.`);
        return generate(call);
      },
    },
    {
      name: "link",
      summary: "Links each name with its address in the pages to its line in the source, and checks every link and image. result is FAIL when a page has a problem, or with --check when a link is not up to date.",
      subjects: [{ name: "<page>", help: ".md files and folders of the documentation, relative to the project folder or the group folder, for example README.md docs. link reads each file and every .md file below each folder", list: true }],
      options: {
        // Text, not a path of the run: in a group, each project has the source and the reference at this path.
        source: { kind: "text", value: "<dir>", help: `${SOURCE.help}. In a group, the same folder in each project`, required: true },
        reference: { kind: "text", value: "<dir>", help: "the folder of the reference pages of generate, relative to the project folder; in a group, the same folder in each project. The default is the first reference/ folder in a given folder or beside a given page" },
        check: { kind: "flag", help: "write nothing. FAIL when a link is not up to date or a page has a problem" },
        "max-listed": OPTIONS["max-listed"],
      },
      notes: "A name in backticks with its address in backticks after it, for example `draw_room` `$09BC`, becomes one link to the line of the name in the source. A name without an address gets no link. A name gets one link in each section, and a table gets no links. In a group folder, write the folder of the project before the name, for example `v2:draw_room` `$09BC`.",
      run: link,
    },
  ],
});
