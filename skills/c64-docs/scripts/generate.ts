// c64-docs generate.ts (D80): the reference pages of a program from the
// knowledge, the source map of c64-source and the image. The pages are
// generated and never edited; the pages of a person link to them.

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, posix } from "node:path";
import { parseArgs } from "node:util";

import { ImageError, readImage } from "#src/host-client/image.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { writeProjectFile } from "#src/host-client/transfer.ts";
import { conflicts } from "#src/knowledge/conflicts.ts";
import { KnowledgeError, openForRead } from "#src/knowledge/database.ts";
import { currentRevision, listComments, listModules, listReferences, listRegions, listSymbols } from "#src/knowledge/read.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { buildReference, GENERATED_MARK } from "./lib/reference.ts";
import { readSourceMap } from "./lib/source-map.ts";

const USAGE = `generate.ts --source <dir> --out <dir> [--image <file>]

  --source <dir>   the source directory of c64-source, with its source-map.json,
                   relative to the project folder
  --out <dir>      the directory for the reference pages, relative to the project
                   folder, for example docs/reference; generate.ts writes only
                   there and refuses a page in it that it did not write
  --image <file>   the image of the source: an image.json of the c64-unpacker
                   skill, or a PRG; it decodes the tables and shows the graphics

The result is one JSON object.`;

/** The files of an earlier run, or a refusal that names a file of a person. */
function oldFiles(out: string): string[] {
  const directory = resolveProjectPath(out);
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
      if (!generated) throw new WireFailure("invalid-input", `${posix.join(out, path)} is not a page of generate.ts. Nothing was written. Give --out a directory that holds only the reference, and keep the pages of a person outside it.`);
      found.push(path);
    }
  };
  walk("");
  return found;
}

function run(argv: string[]): Record<string, unknown> {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { source: { type: "string" }, out: { type: "string" }, image: { type: "string" }, help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  if (positionals.length > 0) throw new UsageError(`generate.ts takes no positional arguments, not ${positionals[0]}`);
  if (values.source === undefined) throw new UsageError("give --source <dir>: the source directory of c64-source");
  if (values.out === undefined) throw new UsageError("give --out <dir>: the directory for the reference pages");
  for (const [option, path] of [["--source", values.source], ["--out", values.out]] as const) {
    try {
      resolveProjectPath(path);
    } catch {
      throw new UsageError(`${option} must be a path relative to the project folder that stays inside it, not ${path}`);
    }
  }
  const map = readSourceMap(values.source);
  let image: ReturnType<typeof readImage> | undefined;
  if (values.image !== undefined) {
    try {
      image = readImage(values.image);
    } catch (error) {
      if (error instanceof ImageError) throw new UsageError(error.message);
      throw error;
    }
  }
  const db = openForRead();
  let knowledge;
  try {
    const found = conflicts(db).length;
    if (found > 0) throw new KnowledgeError("conflict", `The knowledge has ${found} conflict${found === 1 ? "" : "s"} from a git merge. Nothing was written. Run c64-knowledge's knowledge.ts merge, then generate the source and the reference again.`);
    const revision = currentRevision(db);
    // A source of another revision has other lines: the links would point to the wrong code.
    if (map.revision !== revision) {
      throw new WireFailure("invalid-input", `${map.pathOf("source-map.json")} is from knowledge revision ${map.revision}, and the knowledge is at revision ${revision}. Nothing was written. Generate the source again with c64-source, then run generate.ts.`);
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
  const old = oldFiles(values.out);
  const built = buildReference({
    out: posix.normalize(values.out),
    map,
    ...knowledge,
    ...(image === undefined ? {} : { image: { path: image.path, byteAt: image.byteAt, inImage: (address: number) => image.segments.some((segment) => address >= segment.start && address <= segment.end) } }),
  });
  const directory = resolveProjectPath(values.out);
  for (const path of old) rmSync(join(directory, path), { force: true });
  for (const file of built.files) writeProjectFile(file.path, file.bytes, { what: "--out" });
  return { out: values.out, revision: knowledge.revision, index: posix.join(posix.normalize(values.out), "index.md"), ...built.counts, image: image?.path ?? "none: give --image to decode the tables and show the graphics" };
}

await runScript(run, { usage: USAGE, refusals: [KnowledgeError] });
