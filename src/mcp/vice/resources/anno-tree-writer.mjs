#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-tree-writer.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-tree-writer.mts
//
// WHY THIS FILE EXISTS: writes an exported ACME source tree -- planned as file
// names and bytes by anno-export-asm.mts -- into a directory, under the
// output-directory contract. It holds no store, so the client writes a tree
// the broker planned with the same code a local export uses.
//
// WHAT NOT TO DO:
//   - Never import the store here, directly or through another module: the
//     client loads this file.
//   - Never delete anything to make room. A directory holding an entry this
//     tree would not write is refused by name.
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
/** D47-B: the tree's three fixed file names. DERIVED from nothing but this
 * module's own naming convention -- never from a store row -- so a store's
 * free text can never reach one of these three names. */
export const ROOT_FILE_NAME = "root.a";
export const SYMBOLS_FILE_NAME = "symbols.a";
export const UNSCOPED_FILE_NAME = "unscoped.a";
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
 * `root.a` is written LAST, through a temp name in the same directory followed
 * by a rename into place, so an interrupted write leaves no root an assembler
 * could start from.
 */
export function writeExportAsmTree(outDir, plan, force) {
    const namesToWrite = plan.files.map((file) => file.name);
    const existingEntries = existsSync(outDir) ? readdirSync(outDir) : [];
    if (existingEntries.length > 0) {
        if (!force) {
            throw new Error(`exportAsmTree: the output directory "${outDir}" already holds ${existingEntries.length} ` +
                `${existingEntries.length === 1 ? "entry" : "entries"} -- refusing to write into it. An export writes a whole tree and will ` +
                `not mix its files with whatever is already there. Pass \`force: true\` to ask for the overwrite explicitly if this directory ` +
                `holds a previous export of this same store.`);
        }
        const namesToWriteSet = new Set(namesToWrite);
        const unexpected = existingEntries.filter((entry) => !namesToWriteSet.has(entry));
        if (unexpected.length > 0) {
            throw new Error(`exportAsmTree: the output directory "${outDir}" holds ${JSON.stringify(unexpected)}, which this export would NOT write -- ` +
                `refusing the overwrite. \`force: true\` means "replace the tree I exported here before", never "remove whatever is in my ` +
                `way": every name this export itself produces may be overwritten, but any other entry is left untouched. Remove it yourself, ` +
                `or point --out at an empty directory.`);
        }
    }
    mkdirSync(outDir, { recursive: true });
    for (const file of plan.files) {
        if (file.name === ROOT_FILE_NAME)
            continue;
        writeFileSync(join(outDir, file.name), file.bytes);
    }
    const root = plan.files.find((file) => file.name === ROOT_FILE_NAME);
    if (root !== undefined) {
        const rootTmpPath = join(outDir, `${ROOT_FILE_NAME}.tmp-${process.pid}`);
        writeFileSync(rootTmpPath, root.bytes);
        renameSync(rootTmpPath, join(outDir, ROOT_FILE_NAME));
    }
}
