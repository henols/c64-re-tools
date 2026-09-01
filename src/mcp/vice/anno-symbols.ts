#!/usr/bin/env node
// anno-symbols.ts -- the ONE authoritative place in this repo for the
// PRE-SPAWN half of the symbol round trip between an annotation store and
// stock VICE's symbol table (ANNO-14/ANNO-15, ARCHITECTURE.md Rule A20).
//
// WHAT LEFT, WHAT STAYED, AND WHERE THE ROUTE RETURNS (plan 29-10, D-01/D-14,
// 2026-08-30). Read this paragraph before looking for a function that is not
// here.
//
//   WHAT LEFT: the ROUTE. `exportLabels()`, `importLabels()` and
//   `regenerateAndReload()` are gone. All three drove the retired external
//   static-analysis child -- one built and spawned its `--export_lbl` argv,
//   one built its `--import_lbl` argv and held its stdio session open across a
//   save-and-verify, one wrote a name through its curated tool surface before
//   re-exporting. Every module they reached was deleted in the same commit,
//   so the functions could not have been kept in any form that still ran.
//
//   WHAT STAYED: the KNOWLEDGE. The label-file format is not this module's to
//   re-parse (`stock-symbols.ts` owns it, see below), but the DISCIPLINE
//   around it is this project's own and survives intact:
//     - `validateLabelFileForImport()`, below, is the whole pre-spawn gate the
//       deleted `importLabels()` ran BEFORE any child existed: the byte-size
//       ceiling check (T-11-LBL-SIZE), the single-parser pass, and the
//       per-name ACME identifier validation that REJECTS rather than
//       sanitizes (T-11-NAME-INJECT, closed) while naming the offending name,
//       its 1-based line number and that line's own text. It is unchanged
//       from the code it was lifted out of; it never touched the deleted
//       modules and so had no reason to go with them.
//     - `ImportLabelsResult`'s discriminated union, and the reason it is one:
//       a caller must not be able to read `importedNames` and mistake "the
//       import call returned no error" for "the names are actually on disk".
//     - The three rules of the `.lbl` loop, recorded in WHAT NOT TO DO below:
//       the store is the merge point, `vice_symbols_load` is
//       replace-not-merge so a regeneration is WHOLE, and no second
//       `al C:xxxx .Name` parser is ever added here.
//     - The two measured facts about the retired producer's own behaviour,
//       kept in the past tense because they are why the discipline has the
//       shape it has, not because anything still calls that producer.
//
//   WHERE THE ROUTE RETURNS: **NO PHASE CURRENTLY OWNS ITS RETURN**, and the
//   earlier version of this line said otherwise. It forecast that the `.lbl`
//   round trip would be rebuilt over the annotation store alongside the ACME
//   export oracle. Half of that happened on 2026-08-31 -- the ACME export
//   route came back as the `anno export-asm` CLI verb -- but the work that
//   rebuilt it covered that route ONLY: no requirement and no success
//   criterion of it mentioned `export-lbl` or `import-lbl`. So the forecast
//   was wrong, and it is CORRECTED here rather than deleted, because deleting
//   a withdrawal notice erases the record that a capability went missing and
//   why. `.planning/PROJECT.md` carries the dated ANNO-14/ANNO-15 notice and
//   says the same thing: this is a temporary loss of a capability that was
//   genuinely Validated, not a completed one being tidied away. The
//   demonstration was made end to end against genuine unpatched stock `x64sc`
//   and that record still stands. A reader checking today whether the symbol
//   round trip works should read this as: it does not, nobody currently owns
//   making it work again, and the specification for whoever eventually does is
//   the measured-facts block below.
//
// WHY THIS FILE EXISTS: static-analysis symbols going OUT to VICE and
// live-discovered symbols coming IN from VICE must flow through explicit
// adapter code -- neither side may parse the other's internal representation
// (Rule A20). This module is that adapter's own side of the boundary. It
// reuses `stock-symbols.ts`'s existing `al C:xxxx .Name` parser
// (`parseViceLabelFile()`, exported there for exactly this reuse) rather than
// adding this repo's THIRD copy of that format -- `stock-symbols.ts` and
// `acme-build/scripts/acme.mjs`'s `curateLabels()` are the two that already
// exist.
//
// MEASURED FACTS, PAST TENSE, kept because they are the reasons for the
// discipline above rather than instructions to anyone:
//   - `--export_lbl` exported USER labels only. Measured (Phase 9, and
//     re-confirmed by the round-trip test that was deleted with its subject):
//     an annotated project emitted exactly the labels a caller had set, and
//     the auto-generated `a_D011` / `a_D020` / `e_FFD2` externals were NOT
//     exported. A rebuilt exporter that emits an `a_`-prefixed name is
//     emitting something the old one did not.
//   - `--import_lbl` under plain `--headless` DISCARDED. `main.rs:800-806`
//     was `if headless && !mcp_server { return Ok(()) }`: an import ran into
//     memory and then hit that early return without ever calling save, so the
//     import was silently discarded -- measured live: two names imported that
//     way, and a subsequent export read back from disk returned only the
//     pre-existing label. The lesson that outlives the producer is the one
//     `ImportLabelsResult` encodes: never report an import as persisted on
//     the strength of a no-error response.
//
// WHAT NOT TO DO, named concretely:
//   - Never add a second `al C:xxxx .Name` regex anywhere in this file.
//     Every read of a label file's TEXT goes through `stock-symbols.ts`'s
//     exported `parseViceLabelFile()` (T-11-LBL-PARSER-DUP).
//   - Never call `vice_symbols_load` (`stock-symbols.ts`'s handlers)
//     incrementally. A rebuilt regeneration path regenerates the WHOLE `.lbl`
//     and returns its path for the CALLER to hand to `vice_symbols_load`
//     exactly once -- `vice_symbols_load` is deliberately replace-not-merge
//     (T-05-02-05), so a full regeneration is what keeps that semantics
//     correct rather than a limitation. A merge mode on `vice_symbols_load`
//     itself was rejected: it would reopen a v0.2.0 decision and make a tool
//     advertised on both backends diverge in semantics.
//   - Never let an illegal label name from a `.lbl` file reach a spawned
//     child (T-11-NAME-INJECT, closed). `validateLabelFileForImport()` below
//     validates every name against `anno-acme-ident.ts`'s
//     `assertLegalAcmeIdentifier()` BEFORE any argv is built -- REJECT, never
//     sanitize. Any rebuilt import route must call it first, for the same
//     reason and in the same position -- the obligation is on the route,
//     whenever one is built, and is not held by a numbered phase.
import { readFileSync, statSync } from "node:fs";

import { parseViceLabelFile, MAX_LABEL_FILE_BYTES } from "./stock-symbols.ts";
import { assertLegalAcmeIdentifier } from "./anno-acme-ident.ts";

/** This module's own error class, minimal shape (message-only, `.name` set to
 * the class name). Never thrown for a ceiling violation on a `.lbl` file's
 * TEXT -- those come from `stock-symbols.ts`'s `StockSymbolsError`, surfaced
 * verbatim, never re-wrapped as this class. Reserved for this module's OWN
 * failure modes: an oversized file caught before `parseViceLabelFile()` is
 * ever called, or (T-11-NAME-INJECT, closed) an illegal label name caught
 * before any child could be spawned -- naming the offending name, its 1-based
 * line number, and that line's own text. */
export class AnnoSymbolsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnoSymbolsError";
  }
}

export interface LabelEntry {
  name: string;
  address: number;
}

export interface ExportLabelsOptions {
  projectPath: string;
  outPath: string;
}

export interface ExportLabelsResult {
  path: string;
  symbolCount: number;
  symbols: LabelEntry[];
  skippedLines: number;
  duplicateNames: number;
  lineCount: number;
}

export interface ImportLabelsOptions {
  projectPath: string;
  lblPath: string;
}

export interface ImportLabelsVerified {
  diskVerified: true;
  importedNames: string[];
  /** The fresh, independent export result used to prove persistence -- a
   * caller can inspect it without re-exporting itself. */
  exported: ExportLabelsResult;
}

export interface ImportLabelsUnverified {
  diskVerified: false;
  importedNames: string[];
  /** Names present in the imported `.lbl` file that a fresh export from
   * disk did NOT contain. Always non-empty when `diskVerified` is `false`. */
  missingNames: string[];
  reason: string;
}

/**
 * A discriminated union, deliberately -- `diskVerified: true` and
 * `diskVerified: false` are structurally distinct shapes, so a caller cannot
 * read `result.importedNames` and mistake "the import call returned no error"
 * for "the names are actually on disk".
 *
 * KEPT ACROSS THE CUT (plan 29-10). The route that produced it is gone; the
 * distinction it encodes is the whole lesson of the `--import_lbl` discard
 * measured in this module's header. Because no phase currently owns rebuilding
 * that route, this type is its only surviving contract; whenever a route IS
 * built it is expected to return this shape rather than
 * invent a weaker one. A rebuilt route that returns a bare name list has
 * silently dropped the property this type exists to make unrepresentable.
 */
export type ImportLabelsResult = ImportLabelsVerified | ImportLabelsUnverified;

export interface ValidatedLabelFile {
  /** Every label name the file declares, in file order. */
  names: string[];
  /** The file's full text, already read -- returned so a caller never reads
   * it a second time to locate a line. */
  text: string;
  /** `parseViceLabelFile()`'s own counts, passed through unchanged. */
  symbolCount: number;
  skippedLines: number;
  duplicateNames: number;
  lineCount: number;
}

/**
 * THE PRE-SPAWN GATE (T-11-LBL-SIZE + T-11-NAME-INJECT, both closed) -- the
 * half of the deleted `importLabels()` that never touched a child process,
 * lifted out unchanged when the route around it was removed (plan 29-10).
 *
 * In order, and the order matters:
 *   1. A byte-size check against `stock-symbols.ts`'s own
 *      `MAX_LABEL_FILE_BYTES`, so an oversized file is refused before it is
 *      even read into memory.
 *   2. One full `parseViceLabelFile()` pass, whose `StockSymbolsError`
 *      ceiling violations (`MAX_LABEL_FILE_LINES`/`MAX_SYMBOLS`) propagate
 *      VERBATIM rather than being re-wrapped.
 *   3. Every discovered name validated against `anno-acme-ident.ts`'s
 *      `assertLegalAcmeIdentifier()`. An illegal name throws
 *      `AnnoSymbolsError` naming the offending name, its 1-based line
 *      number, and that line's own text -- REJECT, never sanitize.
 *
 * The offending line is located by a substring search over the already-read
 * text, never a second `al C:` regex (this module's header forbids a third
 * parser for that format).
 *
 * A rebuilt import route -- whenever one is built, since no phase currently
 * owns writing it -- calls this FIRST, before it builds any argv. That
 * position is the property T-11-NAME-INJECT was closed on: no illegal name can
 * reach a child, because no child exists yet when this runs.
 */
export function validateLabelFileForImport({ lblPath }: { lblPath: string }): ValidatedLabelFile {
  let size: number;
  try {
    size = statSync(lblPath).size;
  } catch (err) {
    throw new AnnoSymbolsError(
      `validateLabelFileForImport: could not stat "${lblPath}" (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (size > MAX_LABEL_FILE_BYTES) {
    throw new AnnoSymbolsError(
      `validateLabelFileForImport: "${lblPath}" is ${size} bytes, which exceeds the ${MAX_LABEL_FILE_BYTES}-byte ceiling`,
    );
  }

  const text = readFileSync(lblPath, "utf8");
  // stock-symbols.ts's ONE parser, never a second regex. A ceiling violation
  // here (StockSymbolsError) propagates unmodified.
  const parsed = parseViceLabelFile(text);
  const names = Array.from(parsed.table.byName.keys());

  for (const name of names) {
    try {
      assertLegalAcmeIdentifier(name, "importLabels label name");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const lines = text.split(/\r?\n/);
      const lineIndex = lines.findIndex((line) => line.includes(name));
      const lineNumber = lineIndex === -1 ? 0 : lineIndex + 1;
      const lineText = lineIndex === -1 ? "(line not found)" : lines[lineIndex];
      throw new AnnoSymbolsError(
        `validateLabelFileForImport: "${lblPath}" line ${lineNumber} carries an illegal label name "${name}" ` +
          `(${reason}) -- line text: ${JSON.stringify(lineText)}. REJECTED, never sanitized or quoted, before ` +
          "any child is spawned.",
      );
    }
  }

  return {
    names,
    text,
    symbolCount: parsed.symbolCount,
    skippedLines: parsed.skippedLines,
    duplicateNames: parsed.duplicateNames,
    lineCount: parsed.lineCount,
  };
}
