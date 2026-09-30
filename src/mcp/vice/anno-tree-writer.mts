#!/usr/bin/env node
// anno-tree-writer.mts
//
// WHY THIS FILE EXISTS: writes an exported ACME source tree -- planned as file
// names and bytes by anno-export-asm.mts -- into a directory, under the
// output-directory contract. It holds no store: the CLI writes the tree the
// export-asm report planned from the project's store.
//
// WHAT NOT TO DO:
//   - Never import the store here, directly or through another module: the
//     client loads this file.
//   - Never delete anything to make room. A directory holding an entry this
//     tree would not write is refused by name.
//   - Never write through an existing entry. A planned name that is a
//     symlink (or anything but a regular file) is refused, and every file is
//     written to a temp name and renamed into place, so a write can never
//     follow a link out of the directory.
import { existsSync, lstatSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** D47-B: the tree's three fixed file names. DERIVED from nothing but this
 * module's own naming convention -- never from a store row -- so a store's
 * free text can never reach one of these three names. */
export const ROOT_FILE_NAME = "root.a";
export const SYMBOLS_FILE_NAME = "symbols.a";
export const UNSCOPED_FILE_NAME = "unscoped.a";

/** One file of a planned tree. */
export interface ExportAsmTreeFile {
  name: string;
  bytes: Uint8Array;
}

/** A whole tree, planned before anything is written: every file in write
 * order -- `root.a` LAST -- and the `!source` order `root.a` carries. */
export interface ExportAsmTreePlan {
  files: ExportAsmTreeFile[];
  sourceOrder: string[];
}

/**
 * Writes a planned tree into `outDir`, under the output-directory contract.
 * Two rules, both evaluated BEFORE the first write -- a refusal that has
 * already written half a tree has left an artefact a later assemble might
 * succeed on.
 *
 * Rule one, without `force`: a directory holding ANY entry at all is refused
 * by name, unconditionally. An export writes a whole tree and will not mix its
 * files with whatever the directory already held.
 *
 * Rule two, with `force`: the caller is asking "this directory already holds a
 * tree I exported before, replace it" -- never "remove whatever is in my way".
 * Anything in the directory that is NOT one of the planned names is refused by
 * name; nothing is ever deleted to make room for it.
 *
 * Rule three, always: an existing entry under a planned name must be a
 * regular file. A symlink there is refused by name, because a write through
 * it would land wherever it points.
 *
 * Every file is written to a temp name in the same directory and renamed into
 * place, and `root.a` is renamed LAST, so an interrupted write leaves no root
 * an assembler could start from.
 */
export function writeExportAsmTree(outDir: string, plan: ExportAsmTreePlan, force: boolean): void {
  const namesToWrite = plan.files.map((file) => file.name);
  const existingEntries = existsSync(outDir) ? readdirSync(outDir) : [];
  if (existingEntries.length > 0) {
    if (!force) {
      throw new Error(
        `exportAsmTree: the output directory "${outDir}" already holds ${existingEntries.length} ` +
          `${existingEntries.length === 1 ? "entry" : "entries"} -- refusing to write into it. An export writes a whole tree and will ` +
          `not mix its files with whatever is already there. Pass \`force: true\` to ask for the overwrite explicitly if this directory ` +
          `holds a previous export of this same store.`,
      );
    }
    const namesToWriteSet = new Set(namesToWrite);
    const unexpected = existingEntries.filter((entry) => !namesToWriteSet.has(entry));
    if (unexpected.length > 0) {
      throw new Error(
        `exportAsmTree: the output directory "${outDir}" holds ${JSON.stringify(unexpected)}, which this export would NOT write -- ` +
          `refusing the overwrite. \`force: true\` means "replace the tree I exported here before", never "remove whatever is in my ` +
          `way": every name this export itself produces may be overwritten, but any other entry is left untouched. Remove it yourself, ` +
          `or point --out at an empty directory.`,
      );
    }
    const notFiles = existingEntries.filter((entry) => !lstatSync(join(outDir, entry)).isFile());
    if (notFiles.length > 0) {
      throw new Error(
        `exportAsmTree: the output directory "${outDir}" holds ${JSON.stringify(notFiles)} under a name this export writes, and it is ` +
          `not a regular file (a symlink or a directory) -- refusing the overwrite, because a write there would land wherever it ` +
          `points. Remove it yourself, or point --out at an empty directory.`,
      );
    }
  }
  mkdirSync(outDir, { recursive: true });

  const ordered = [...plan.files.filter((file) => file.name !== ROOT_FILE_NAME), ...plan.files.filter((file) => file.name === ROOT_FILE_NAME)];
  for (const file of ordered) {
    const tmpPath = join(outDir, `.${file.name}.tmp-${process.pid}`);
    writeFileSync(tmpPath, file.bytes, { flag: "wx" });
    renameSync(tmpPath, join(outDir, file.name));
  }
}
