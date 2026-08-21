#!/usr/bin/env node
// r2000-symbols.ts -- the ONE authoritative place in this repo for the
// symbol round trip between regenerator2000's annotation store and stock
// VICE's symbol table (R2000-14/R2000-15, ARCHITECTURE.md Rule A20).
//
// WHY THIS FILE EXISTS: static-analysis symbols going OUT to VICE
// (`exportLabels()`) and live-discovered symbols coming IN from VICE
// (`importLabels()`) must flow through explicit adapter code -- neither side
// may parse the other's internal representation (Rule A20). This module is
// that adapter. It reuses `stock-symbols.ts`'s existing `al C:xxxx .Name`
// parser (`parseViceLabelFile()`, exported there for exactly this reuse)
// rather than adding this repo's THIRD copy of that format --
// `stock-symbols.ts` and `acme-build/scripts/acme.mjs`'s `curateLabels()`
// are the two that already exist.
//
// MEASURED FACTS this module's behaviour depends on:
//   - `--export_lbl` exports USER labels only. Measured (Phase 9, and
//     re-confirmed by this plan's own round-trip test): an annotated
//     project emits exactly the labels a caller set via
//     `r2000_set_label_name`/`--import_lbl` -- the auto-generated `a_D011` /
//     `a_D020` / `e_FFD2` externals are NOT exported. A test asserting an
//     `a_`-prefixed name appears in an `exportLabels()` result is testing
//     the wrong thing.
//   - `--import_lbl` under plain `--headless` DISCARDS. `main.rs:800-806` is
//     `if headless && !mcp_server { return Ok(()) }`: an argv of
//     `--import_lbl <path> --headless <proj>` imports the labels into
//     memory and then hits that early return WITHOUT ever calling save, so
//     the import is silently discarded -- measured live: two names imported
//     that way, and a subsequent `--export_lbl` read back from disk
//     returned only the pre-existing label. `r2000-launch.ts`'s
//     `buildImportLblArgs()` makes this combination unbuildable by always
//     pairing `--mcp-server-stdio` (which sets both `headless` AND
//     `mcp_server`, `main.rs:709-711`, skipping the early return) --
//     `r2000-symbol-roundtrip.test.ts` pins the trap itself with a
//     hand-built argv, so that builder's pairing stays provably load-bearing
//     rather than merely assumed.
//
// WHAT NOT TO DO, named concretely:
//   - Never add a second `al C:xxxx .Name` regex anywhere in this file.
//     Every read of a label file's TEXT goes through
//     `stock-symbols.ts`'s exported `parseViceLabelFile()`.
//   - Never call `vice_symbols_load` (`stock-symbols.ts`'s handlers)
//     incrementally. `regenerateAndReload()` below regenerates the WHOLE
//     `.lbl` and returns its path for the CALLER to hand to
//     `vice_symbols_load` exactly once -- `vice_symbols_load` is
//     deliberately replace-not-merge (T-05-02-05), so a full regeneration is
//     what keeps that semantics correct rather than a limitation. A merge
//     mode on `vice_symbols_load` itself was rejected: it would reopen a
//     v0.2.0 decision and make a tool advertised on both backends diverge in
//     semantics.
//   - Never build `--import_lbl`'s argv by hand in this file. It comes ONLY
//     from `r2000-launch.ts`'s `buildImportLblArgs()` -- there is no literal
//     `"--import_lbl"` string anywhere below.
//   - Never report an import as persisted on the strength of a
//     no-error response alone. `importLabels()` below proves persistence
//     TWICE: once via `saveAndVerify()`'s content-hash check (inside the
//     import session), and independently via a fresh `exportLabels()` from
//     disk, in a BRAND NEW process, after the import session has fully
//     closed. `ImportLabelsResult` is a discriminated union
//     (`diskVerified: true | false`) specifically so a caller cannot
//     mistake "the import call returned no error" for "the names are
//     actually on disk".
//   - Never let an illegal label name from a `.lbl` file reach a spawned
//     child (T-11-NAME-INJECT, closed). `importLabels()` validates every
//     name against `r2000-acme-ident.ts`'s `assertLegalAcmeIdentifier()`
//     BEFORE `buildImportLblArgs()` is ever called -- REJECT, never
//     sanitize, matching `r2000-tools.ts`'s `r2000_set_label_name` posture.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildExportLblArgs, buildImportLblArgs, runR2000 } from "./r2000-launch.ts";
import { withR2000Session, saveAndVerify } from "./r2000-mcp-client.ts";
import { runR2000Tool } from "./r2000-tools.ts";
import { parseViceLabelFile, MAX_LABEL_FILE_BYTES } from "./stock-symbols.ts";
import { assertLegalAcmeIdentifier } from "./r2000-acme-ident.ts";

/** This module's own error class, following `r2000-tools.ts`'s
 * `R2000StorePathError` / `r2000-launch.ts`'s `R2000ViceFlagError` minimal
 * shape (message-only, `.name` set to the class name). Never thrown for a
 * ceiling violation on a `.lbl` file's TEXT -- those come from
 * `stock-symbols.ts`'s `StockSymbolsError`, surfaced verbatim, never
 * re-wrapped as this class. Reserved for this module's OWN failure modes:
 * a nonzero regenerator2000 exit, a missing output file despite a zero
 * exit, an oversized file caught before `parseViceLabelFile()` is ever
 * called, or (T-11-NAME-INJECT, closed) an illegal label name caught in
 * `importLabels()` before any child is spawned -- naming the offending
 * name, its 1-based line number, and that line's own text. */
export class R2000SymbolsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2000SymbolsError";
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

/**
 * The export leg (R2000-14). Runs `buildExportLblArgs()` through
 * `runR2000()`, then READS THE PRODUCED FILE BACK through
 * `stock-symbols.ts`'s existing parser to validate it and return the parsed
 * symbol list plus a count.
 *
 * The read-back is not optional, for two independent reasons: a
 * regenerator2000 exit code has lied before (`r2000-verify.ts`'s founding
 * incident, D-10 -- a zero exit alongside content that should have failed),
 * and the parse is the only thing that proves the produced file is in the
 * format `vice_symbols_load` actually accepts. Ceiling violations from
 * `parseViceLabelFile()` (`StockSymbolsError`) are surfaced VERBATIM, never
 * re-wrapped -- only this function's OWN failure modes (nonzero exit,
 * missing file, oversized file) throw `R2000SymbolsError`.
 */
export async function exportLabels({ projectPath, outPath }: ExportLabelsOptions): Promise<ExportLabelsResult> {
  const argv = buildExportLblArgs({ projectPath, outPath });
  const result = runR2000(argv);
  if (result.status !== 0) {
    throw new R2000SymbolsError(
      `exportLabels: regenerator2000 exited ${result.status} for "${projectPath}" -- stderr: ${result.stderr || "(empty)"}`,
    );
  }
  if (!existsSync(outPath)) {
    throw new R2000SymbolsError(
      `exportLabels: regenerator2000 exited 0 but did not produce "${outPath}" -- a lying zero exit code has ` +
        "happened before (r2000-verify.ts's founding incident, D-10); refusing to trust the exit code alone.",
    );
  }

  let size: number;
  try {
    size = statSync(outPath).size;
  } catch (err) {
    throw new R2000SymbolsError(
      `exportLabels: could not stat "${outPath}" (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (size > MAX_LABEL_FILE_BYTES) {
    throw new R2000SymbolsError(
      `exportLabels: "${outPath}" is ${size} bytes, which exceeds the ${MAX_LABEL_FILE_BYTES}-byte ceiling`,
    );
  }

  const text = readFileSync(outPath, "utf8");
  // Reused verbatim -- stock-symbols.ts's ONE parser, never a second regex.
  // A ceiling violation here (StockSymbolsError) propagates unmodified.
  const parsed = parseViceLabelFile(text);

  const symbols: LabelEntry[] = Array.from(parsed.table.byName.entries()).map(([name, address]) => ({ name, address }));

  return {
    path: outPath,
    symbolCount: parsed.symbolCount,
    symbols,
    skippedLines: parsed.skippedLines,
    duplicateNames: parsed.duplicateNames,
    lineCount: parsed.lineCount,
  };
}

export interface ImportLabelsOptions {
  projectPath: string;
  lblPath: string;
}

export interface ImportLabelsVerified {
  diskVerified: true;
  importedNames: string[];
  /** The fresh, independent `exportLabels()` result used to prove
   * persistence -- a caller can inspect it without re-exporting itself. */
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
 * `diskVerified: false` are structurally distinct shapes, so a caller
 * cannot read `result.importedNames` and mistake "the import call returned
 * no error" for "the names are actually on disk" (the plan's own required
 * distinction). Only the `true` variant carries `exported`; only the
 * `false` variant carries `missingNames`/`reason`.
 */
export type ImportLabelsResult = ImportLabelsVerified | ImportLabelsUnverified;

/**
 * The import leg (R2000-15, the D-28 path). Runs `buildImportLblArgs()` --
 * which ALWAYS carries `--mcp-server-stdio` -- and, over that SAME stdio
 * session, calls `r2000_save_project` through `r2000-mcp-client.ts`'s
 * `saveAndVerify()`. `--import_lbl` mutates only IN-MEMORY state
 * (`main.rs:800-806` is why the save must be explicit); `saveAndVerify()`
 * proves the save changed the project file's own content hash on disk.
 *
 * That alone is `r2000-mcp-client.ts`'s own T-11-FALSESUCCESS proof, not
 * THIS module's. `importLabels()` proves persistence a SECOND, independent
 * way: after the import session has fully closed, a BRAND NEW process
 * (`exportLabels()`, a fresh `runR2000()` child) re-reads the project from
 * disk and re-exports its labels. Only when every name in the caller's
 * `.lbl` file appears in that fresh export does this function report
 * `diskVerified: true`.
 *
 * The caller-supplied `.lbl` file itself is ceiling-checked BEFORE any
 * child process is spawned (T-11-LBL-SIZE): a byte-size check against
 * `stock-symbols.ts`'s own `MAX_LABEL_FILE_BYTES`, then a full
 * `parseViceLabelFile()` pass, whose `StockSymbolsError` ceiling violations
 * (`MAX_LABEL_FILE_LINES`/`MAX_SYMBOLS`) propagate verbatim -- an oversized
 * or over-populated `.lbl` never reaches regenerator2000 at all.
 *
 * Every discovered name is then validated against `r2000-acme-ident.ts`'s
 * `assertLegalAcmeIdentifier()`, also BEFORE any spawn (T-11-NAME-INJECT,
 * closed): an illegal name throws `R2000SymbolsError` naming the offending
 * name, its 1-based line number, and that line's own text -- REJECT, never
 * sanitize, the same posture `r2000-tools.ts`'s `r2000_set_label_name`
 * takes on the tool-surface entry route.
 */
export async function importLabels({ projectPath, lblPath }: ImportLabelsOptions): Promise<ImportLabelsResult> {
  let size: number;
  try {
    size = statSync(lblPath).size;
  } catch (err) {
    throw new R2000SymbolsError(
      `importLabels: could not stat "${lblPath}" (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (size > MAX_LABEL_FILE_BYTES) {
    throw new R2000SymbolsError(
      `importLabels: "${lblPath}" is ${size} bytes, which exceeds the ${MAX_LABEL_FILE_BYTES}-byte ceiling`,
    );
  }

  const inputText = readFileSync(lblPath, "utf8");
  // Reused verbatim -- same parser as exportLabels(). A ceiling violation
  // here (StockSymbolsError) propagates unmodified, before any spawn.
  const inputParsed = parseViceLabelFile(inputText);
  const importedNames = Array.from(inputParsed.table.byName.keys());

  // T-11-NAME-INJECT (route B, closed): every discovered label name is
  // validated against the one ACME identifier seam (r2000-acme-ident.ts)
  // BEFORE any child is spawned -- REJECT, never sanitize, matching
  // r2000-tools.ts's r2000_set_label_name posture. The offending line is
  // located by a substring search over the already-read inputText, never a
  // second `al C:` regex (this module's own header forbids a third parser
  // for that format, T-11-LBL-PARSER-DUP).
  for (const name of importedNames) {
    try {
      assertLegalAcmeIdentifier(name, "importLabels label name");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const inputLines = inputText.split(/\r?\n/);
      const lineIndex = inputLines.findIndex((line) => line.includes(name));
      const lineNumber = lineIndex === -1 ? 0 : lineIndex + 1;
      const lineText = lineIndex === -1 ? "(line not found)" : inputLines[lineIndex];
      throw new R2000SymbolsError(
        `importLabels: "${lblPath}" line ${lineNumber} carries an illegal label name "${name}" (${reason}) -- ` +
          `line text: ${JSON.stringify(lineText)}. REJECTED, never sanitized or quoted, before any child is spawned.`,
      );
    }
  }

  // buildImportLblArgs() is the ONLY producer of this argv -- there is no
  // literal "--import_lbl" string anywhere in this file.
  const argv = buildImportLblArgs({ projectPath, lblPath });
  await withR2000Session(projectPath, (call) => saveAndVerify(projectPath, call), { argv });

  // Independent proof #2: a brand-new process, after the import session has
  // fully closed, re-reads the project from disk and re-exports its labels.
  const verifyDir = mkdtempSync(join(tmpdir(), "r2000-symbols-verify-"));
  try {
    const reExportPath = join(verifyDir, "reexport.lbl");
    const exported = await exportLabels({ projectPath, outPath: reExportPath });
    const exportedNames = new Set(exported.symbols.map((s) => s.name));
    const missingNames = importedNames.filter((n) => !exportedNames.has(n));

    if (missingNames.length > 0) {
      return {
        diskVerified: false,
        importedNames,
        missingNames,
        reason:
          `importLabels: saveAndVerify() reported a changed content hash for "${projectPath}", but a fresh ` +
          `exportLabels() from disk is missing ${missingNames.length} of ${importedNames.length} imported ` +
          `name(s): ${missingNames.join(", ")}`,
      };
    }

    return { diskVerified: true, importedNames, exported };
  } finally {
    rmSync(verifyDir, { recursive: true, force: true });
  }
}

export interface RegenerateAndReloadOptions {
  projectPath: string;
  outPath: string;
  address: number;
  name: string;
}

export interface RegenerateAndReloadResult {
  path: string;
  symbolCount: number;
  symbols: LabelEntry[];
}

/**
 * D-29: the store is the merge point for a live-discovered name. Writes
 * `name` at `address` into the store FIRST (via the curated
 * `r2000_set_label_name`, `r2000-tools.ts`'s `runR2000Tool()` -- which
 * auto-saves internally before its session exits), THEN regenerates the
 * WHOLE `.lbl` with `exportLabels()`, and returns the path for the CALLER
 * to hand to `vice_symbols_load` EXACTLY ONCE.
 *
 * This function deliberately does NOT call `vice_symbols_load` itself --
 * see this module's header for why an incremental/repeated load would
 * violate `vice_symbols_load`'s replace-not-merge semantics (T-05-02-05).
 *
 * Note (T-11-NAME-INJECT, closed): an illegal `name` now REJECTS this
 * function's returned promise -- `r2000_set_label_name`'s own pre-spawn
 * `assertLegalLabelArg()` gate (`r2000-tools.ts`) fires inside
 * `runR2000Tool()`'s `assertCuratedTool()` call, before `runR2000Tool()`'s
 * own `try` block, rather than surfacing as `setResult.isError` the way a
 * regenerator2000-side failure would. This function had no production
 * caller when that note was written, so no existing behaviour depended on
 * the old `isError`-shaped outcome -- superseded in place by the formal
 * status below rather than left as an aside.
 *
 * LIBRARY-ONLY (Phase 11 IN-02, D-11.1-06): as of this phase,
 * `regenerateAndReload()` is a library-only export -- available for
 * programmatic use, with NO PRODUCTION CALLER anywhere in this repo
 * (`.claude/mcp/vice/`, `.claude/skills/`, `scripts/`). A future phase must
 * not assume it is wired into any real workflow just because it is the
 * named D-29 live-discovery merge point.
 *
 * The proven live path for the symbol round trip is NOT this function --
 * it is `r2000 export-lbl` -> `vice_symbols_load` -> live discovery ->
 * `r2000_set_label_name` -> `r2000 import-lbl`, documented as one closed
 * loop in `c64-program-recon/SKILL.md`. `R2000-15` is satisfied through
 * that sequence, not through this convenience wrapper. Giving this
 * function a caller would mean inventing a new CLI verb or skill entry
 * point it was never actually proven through -- out of this phase's scope
 * fence (11.1-CONTEXT.md).
 *
 * ADOPTION CONDITION: if `regenerateAndReload()` ever acquires a real
 * production caller, the `LIBRARY-ONLY` marker above must be deleted in
 * the SAME commit that adds the caller. `r2000-symbol-roundtrip.test.ts`
 * enforces this as a biconditional, in both directions: zero callers
 * requires the marker present; one or more callers requires the marker
 * absent. The two can never legally disagree.
 */
export async function regenerateAndReload({
  projectPath,
  outPath,
  address,
  name,
}: RegenerateAndReloadOptions): Promise<RegenerateAndReloadResult> {
  const setResult = await runR2000Tool("r2000_set_label_name", { project: projectPath, address, name });
  if (setResult.isError) {
    throw new R2000SymbolsError(
      `regenerateAndReload: r2000_set_label_name failed for "${name}" at ${address}: ` +
        `${setResult.content.map((c) => c.text).join(" ")}`,
    );
  }

  const exported = await exportLabels({ projectPath, outPath });
  return { path: exported.path, symbolCount: exported.symbolCount, symbols: exported.symbols };
}
