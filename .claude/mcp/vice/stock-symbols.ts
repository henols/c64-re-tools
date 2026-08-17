#!/usr/bin/env node
// stock-symbols.ts
//
// DERIV-04's store: `vice_symbols_load` and `vice_symbols_lookup`, the
// client-side symbol table this codebase carries no other implementation of.
// This is the ONLY module that may call stock-address.ts's
// setSymbolResolver() -- that file's ONE holder is the single seam, and a
// second holder or a family-local address->name map is that file's own
// named anti-pattern ("Never add a second resolver holder").
//
// Both tools are `needsSession: false` (D-04 of Phase 4): loading or
// looking up a symbol never opens a monitor connection and therefore never
// halts the user's running program -- a genuine ergonomic win over the
// fork, whose implementation lives inside the emulator process.
//
// WHY hostpath.ts IS NEVER IMPORTED HERE, spelled out: hostpath.ts
// translates a container path into a HOST path for a filename stock VICE
// ITSELF OPENS ACROSS THE WIRE. `vice_symbols_load` reads the file with
// Node's `fs` inside the MCP server's OWN process; there is no wire
// filename argument at all, so the translation does not apply and applying
// it would read the wrong file (or nothing). hostpath-consumers.test.ts's
// closed five-member production consumer set (containerpath.ts,
// install-resources.ts, stock-paths.ts, vice-proxy.ts, vice-sync.ts) must
// stay exactly five -- this module joining it would fail that test outright.
//
// The confirmed input format is a VICE label file, one `al C:xxxx .Name`
// line per symbol, verified against ACME's `--vicelabels` output via
// acme-build/scripts/acme.mjs's own parser (curateLabels(),
// `/^al\s+C:[0-9a-f]+\s+\.(\S+)/i`). STATED ASSUMPTION, NOT A VERIFIED FACT:
// regenerator2000's `--export_lbl` is *expected* to emit the same syntax,
// but R2000-16(c) has never been run -- hence the parser below SKIPS
// unrecognised lines rather than refusing the whole file, and no comment or
// doc here may claim "regenerator2000-compatible" as verified.
//
// WHAT NOT TO DO:
//   - Never add a second resolver holder or call setSymbolResolver() from
//     any other new Phase 5 module -- this file is the one seam.
//   - Never import hostpath.ts, stock-paths.ts, containerpath.ts or
//     vice-proxy.ts from this file (see above).
//   - Never build a success-result object literal by hand (an "isError"
//     field set to the negative literal) outside derivedAnswer() -- every
//     success on this module's two handlers goes through it, exactly as
//     stock-handler.ts's own header requires.
//   - Never merge a newly-loaded table into the previous one -- a load is a
//     REPLACE, matching the fork's own single-active-symbol-table framing
//     (T-05-02-05).
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

import { ViceError, type ViceErrorOptions } from "./vice.ts";
import { repoRoot } from "./repo-root.ts";
import { parseAddress, setSymbolResolver, type SymbolResolver } from "./stock-address.ts";
import { derivedAnswer, isErrorText } from "./stock-handler.ts";
import type { DerivedPureHandler } from "./stock-derived.ts";

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-memory.ts, stock-disassemble.ts et al. each carry a private copy
 * rather than a shared import). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Module constants.
// ---------------------------------------------------------------------------

/** The confirmed VICE label-file line shape: `al C:xxxx .Name`. Group 1 is
 * the hex address (1-4 digits, either case); group 2 is the symbol name.
 * Anchored at line start -- leading whitespace is trimmed off each line
 * before matching. Deliberately case-sensitive on the literal `al`/`C:`
 * text (unlike acme.mjs's own `/i` parser) since every producer this repo
 * has verified emits exactly that casing; only the hex digits themselves
 * accept either case. */
const VICE_LABEL_LINE_RE = /^al\s+C:([0-9a-fA-F]{1,4})\s+\.(\S+)/;

/** T-05-02-03: three independent resource ceilings, each refusing with both
 * the observed value and the limit named. */
const MAX_LABEL_FILE_BYTES = 2 * 1024 * 1024;
const MAX_LABEL_FILE_LINES = 50000;
const MAX_SYMBOLS = 20000;

/** D-05-02: `'auto'` does no format sniffing -- it parses the `al C:xxxx
 * .Name` pattern only and reports the count actually loaded, whether that
 * is `0` or not. `'kickasm'`/`'simple'` are refused by name (no skill or
 * script in this repo produces either). */
const SUPPORTED_FORMATS = ["auto", "vice"];
const REFUSED_FORMATS = ["kickasm", "simple"];

/** The one address/byte-count error type this module ever throws -- never a
 * bare Error, matching vice.ts's established ViceError hierarchy
 * (stock-address.ts's StockAddressError, stock-paths.ts's StockPathError
 * are the sibling precedents). */
export class StockSymbolsError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "StockSymbolsError";
  }
}

interface SymbolTable {
  byName: Map<string, number>;
  byAddress: Map<number, string>;
}

// ---------------------------------------------------------------------------
// Path containment (T-05-02-01/02) -- resolve `path` against repoRoot() and
// refuse anything whose resolved absolute path is neither the root itself
// nor prefixed by `root + sep`, including via a symlink. Never calls
// hostpath.ts (see this file's header).
// ---------------------------------------------------------------------------

function isContained(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

/** Resolves `pathArg` against `repoRoot()`, refusing anything that escapes
 * the workspace either directly or via a symlink, and returns the ONE
 * canonical path that is checked, opened and reported. The rule (WR-08): the
 * path that is containment-checked is the path that is opened and the path
 * that is reported -- returning the pre-`realpathSync` string made the
 * check advisory, because `statSync`/`readFileSync` re-traverse symlinks
 * independently of this function's own check. */
function resolveLabelFilePath(pathArg: unknown): string {
  if (typeof pathArg !== "string" || pathArg.trim() === "") {
    throw new StockSymbolsError(`path must be a non-empty string, got ${typeof pathArg === "string" ? "an empty/whitespace-only string" : typeof pathArg}`);
  }

  const root = repoRoot();
  const resolved = resolve(root, pathArg.trim());

  if (!isContained(resolved, root)) {
    throw new StockSymbolsError(`"${resolved}" is outside the workspace root (${root}) -- a symbol file must live inside the workspace`);
  }

  let real: string;
  try {
    real = realpathSync(resolved);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StockSymbolsError(`"${resolved}" was not found`);
    }
    throw new StockSymbolsError(`could not resolve "${resolved}" (${err instanceof Error ? err.message : String(err)})`);
  }

  if (!isContained(real, root)) {
    throw new StockSymbolsError(
      `"${resolved}" resolves (via symlink) to "${real}", which is outside the workspace root (${root}) -- ` +
        `a symbol file must live inside the workspace`,
    );
  }

  // WR-08: the path that is checked is the path that is opened and the path
  // that is reported -- `real` (the fully-resolved, containment-checked
  // path), never `resolved` (the pre-canonicalisation string). Returning
  // `resolved` made the containment check advisory: statSync()/readFileSync()
  // re-traverse any symlink in `resolved`, so a component swapped after the
  // check on `real` but before those calls could read a file outside the
  // workspace while the check above had passed on a different, already-gone
  // resolution of the same string. Both checks above stay (the pre-realpath
  // check on `resolved` gives the clearer error for an obviously out-of-tree
  // argument); only the returned path changes.
  return real;
}

// ---------------------------------------------------------------------------
// Parsing -- defensive per Pitfall 5: an unrecognised line is skipped and
// counted, never a whole-file refusal.
// ---------------------------------------------------------------------------

function parseViceLabelFile(text: string): {
  table: SymbolTable;
  symbolCount: number;
  skippedLines: number;
  duplicateNames: number;
  lineCount: number;
} {
  const lines = text.split("\n");
  const lineCount = lines.length;
  if (lineCount > MAX_LABEL_FILE_LINES) {
    throw new StockSymbolsError(`the label file has ${lineCount} lines, which exceeds the ${MAX_LABEL_FILE_LINES}-line ceiling`);
  }

  const byName = new Map<string, number>();
  const byAddress = new Map<number, string>();
  let skippedLines = 0;
  let duplicateNames = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      skippedLines += 1;
      continue;
    }
    const match = VICE_LABEL_LINE_RE.exec(line);
    if (!match) {
      skippedLines += 1;
      continue;
    }
    const address = parseInt(match[1]!, 16);
    // Defensively unreachable given the {1,4} hex bound above, but never
    // trust a parsed value blindly -- an out-of-range address is counted as
    // skipped rather than thrown.
    if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
      skippedLines += 1;
      continue;
    }
    const name = match[2]!;
    if (byName.has(name)) {
      duplicateNames += 1;
    }
    byName.set(name, address); // last definition wins
    if (!byAddress.has(address)) {
      byAddress.set(address, name); // first name for an address wins
    }
  }

  if (byName.size > MAX_SYMBOLS) {
    throw new StockSymbolsError(`the label file defines ${byName.size} distinct symbol names, which exceeds the ${MAX_SYMBOLS}-symbol ceiling`);
  }

  return { table: { byName, byAddress }, symbolCount: byName.size, skippedLines, duplicateNames, lineCount };
}

// ---------------------------------------------------------------------------
// Module state about THIS module's own load -- not a second resolver
// holder. loadedTable/loadedSymbolCount let handleSymbolsLookup answer
// without re-reading the file. (WR-11: a third field tracking the last-
// loaded path was write-only -- assigned on every load and cleared on
// reset, but read nowhere in the codebase. Deleted rather than replaced
// with an answer field: adding a key to either answer would require a
// tools-manifest.stock.json change this plan deliberately excludes.)
// ---------------------------------------------------------------------------

let loadedTable: SymbolTable | null = null;
let loadedSymbolCount = 0;

/** Builds one SymbolResolver implementing BOTH directions and installs it
 * into stock-address.ts's existing holder via setSymbolResolver() -- a load
 * is a REPLACE, never a merge: whatever was installed before is discarded. */
function installSymbolTable(table: SymbolTable): void {
  const resolver: SymbolResolver = {
    resolve: (name) => table.byName.get(name),
    nameFor: (address) => table.byAddress.get(address),
  };
  setSymbolResolver(resolver);
}

/** Test-only reset, following stock-paths.ts's setIsInsideContainerForTest()
 * / stock-runstate.ts's resetRunStateTrackersForTest() precedent: a
 * module-level reset exported from the module that owns the state. Also
 * clears stock-address.ts's holder so no test leaks a loaded table into
 * another file's run. */
export function resetSymbolStoreForTest(): void {
  loadedTable = null;
  loadedSymbolCount = 0;
  setSymbolResolver(null);
}

// ---------------------------------------------------------------------------
// vice_symbols_load
// ---------------------------------------------------------------------------

export const handleSymbolsLoad: DerivedPureHandler = async (args, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_symbols_load: arguments must be an object");
  }

  let format = "auto";
  if (args.format !== undefined) {
    if (typeof args.format !== "string") {
      return isErrorText(`vice_symbols_load: format must be a string, got ${typeof args.format}`);
    }
    if (REFUSED_FORMATS.includes(args.format)) {
      return isErrorText(
        `vice_symbols_load: format "${args.format}" is not supported on the stock backend -- only VICE-format label files ` +
          `("al C:xxxx .Name" lines, as produced by ACME's --vicelabels) are supported. format must be "auto" or "vice".`,
      );
    }
    if (!SUPPORTED_FORMATS.includes(args.format)) {
      return isErrorText(
        `vice_symbols_load: format "${args.format}" is not one of the fork's declared values (auto, kickasm, vice, simple) -- ` +
          `only "auto" and "vice" are supported on the stock backend.`,
      );
    }
    format = args.format;
  }

  let resolvedPath: string;
  try {
    resolvedPath = resolveLabelFilePath(args.path);
  } catch (err) {
    return isErrorText(`vice_symbols_load: ${err instanceof Error ? err.message : String(err)}`);
  }

  let size: number;
  try {
    size = statSync(resolvedPath).size;
  } catch (err) {
    return isErrorText(`vice_symbols_load: could not stat "${resolvedPath}" (${err instanceof Error ? err.message : String(err)})`);
  }
  if (size > MAX_LABEL_FILE_BYTES) {
    return isErrorText(`vice_symbols_load: "${resolvedPath}" is ${size} bytes, which exceeds the ${MAX_LABEL_FILE_BYTES}-byte ceiling`);
  }

  let text: string;
  try {
    text = readFileSync(resolvedPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return isErrorText(`vice_symbols_load: "${resolvedPath}" was not found`);
    }
    if (code === "EACCES") {
      return isErrorText(`vice_symbols_load: permission denied reading "${resolvedPath}"`);
    }
    if (code === "EISDIR") {
      return isErrorText(`vice_symbols_load: "${resolvedPath}" is a directory, not a file`);
    }
    return isErrorText(`vice_symbols_load: could not read "${resolvedPath}" (${err instanceof Error ? err.message : String(err)})`);
  }

  let parsed: ReturnType<typeof parseViceLabelFile>;
  try {
    parsed = parseViceLabelFile(text);
  } catch (err) {
    return isErrorText(`vice_symbols_load: ${err instanceof Error ? err.message : String(err)}`);
  }

  const replaced = loadedTable !== null;
  installSymbolTable(parsed.table);
  loadedTable = parsed.table;
  loadedSymbolCount = parsed.symbolCount;

  const payload: Record<string, unknown> = {
    path: args.path,
    resolvedPath,
    format: "vice",
    symbolCount: parsed.symbolCount,
    skippedLines: parsed.skippedLines,
    duplicateNames: parsed.duplicateNames,
    lineCount: parsed.lineCount,
    replaced,
  };
  if (parsed.symbolCount === 0) {
    payload.note =
      `no "al C:xxxx .Name" lines were found in this file -- this is not an error. If the file was produced by ` +
      `KickAssembler or another non-VICE format, it is not supported on the stock backend (format: "${format}").`;
  }

  return derivedAnswer(payload);
};

// ---------------------------------------------------------------------------
// vice_symbols_lookup
// ---------------------------------------------------------------------------

export const handleSymbolsLookup: DerivedPureHandler = async (args, _deps) => {
  if (!isPlainObject(args)) {
    return isErrorText("vice_symbols_lookup: arguments must be an object");
  }

  const hasName = args.name !== undefined;
  const hasAddress = args.address !== undefined;

  if (!hasName && !hasAddress) {
    return isErrorText("vice_symbols_lookup: exactly one of name or address is required");
  }
  if (hasName && hasAddress) {
    return isErrorText("vice_symbols_lookup: name and address are mutually exclusive -- supply exactly one");
  }

  const noTableNote = loadedTable === null ? "no symbol table is loaded -- call vice_symbols_load first" : undefined;

  if (hasName) {
    if (typeof args.name !== "string") {
      return isErrorText(`vice_symbols_lookup: name must be a string, got ${typeof args.name}`);
    }
    const address = loadedTable?.byName.get(args.name);
    const payload: Record<string, unknown> = { query: { name: args.name }, found: address !== undefined, symbolCount: loadedSymbolCount };
    if (address !== undefined) {
      payload.name = args.name;
      payload.address = address;
    }
    if (noTableNote) {
      payload.note = noTableNote;
    }
    return derivedAnswer(payload);
  }

  let address: number;
  try {
    address = parseAddress(args.address, { what: "address" });
  } catch (err) {
    return isErrorText(`vice_symbols_lookup: ${err instanceof Error ? err.message : String(err)}`);
  }
  const name = loadedTable?.byAddress.get(address);
  // `query` echoes the value the lookup was PERFORMED AGAINST -- the parsed
  // `address` local -- never the caller's raw `args.address`. parseAddress()
  // accepts "$d020"/"0xd020" strings as well as numbers, but this tool's
  // declared outputSchema pins `query.address` to `type: "number"`; echoing
  // the raw argument would make the answer's own shape depend on the
  // caller's formatting choice and violate that schema (WR-01, D-05-18).
  const payload: Record<string, unknown> = { query: { address }, found: name !== undefined, symbolCount: loadedSymbolCount };
  if (name !== undefined) {
    payload.name = name;
    payload.address = address;
  }
  if (noTableNote) {
    payload.note = noTableNote;
  }
  return derivedAnswer(payload);
};
