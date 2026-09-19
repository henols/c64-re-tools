// prereq-readme-gen.ts
//
// The one place that turns `src/mcp/vice/prerequisites.json` into README.md's
// install tables. `prereq-readme-gen.test.ts`, colocated beside this module,
// is the guard that fails the build the moment the two drift -- it parses
// the committed README region back into records and compares those against
// this module's own derivation, never against rendered bytes (D-10).
//
// WHAT NOT TO DO:
// - Do not import from `tool-location.mts`. That module is `.mts` --
//   host-bound, compiled into `resources/` by `build.ts` -- and this module
//   is plain repo tooling that never crosses that seam (see CONVENTIONS.md's
//   `.mts` vs `.ts` rule). Mirror its declaration-reading shape; do not
//   import it.
// - Do not add a label map for the ecosystem ids. `src/mcp/vice/prerequisites.json`
//   is frozen (D-02, Phase 61 61-CONTEXT.md); the ecosystem column IS the raw
//   declaration id (D-03), and a generator-side label map would reintroduce
//   exactly the second place that can disagree with the first -- the failure
//   this milestone exists to remove.
// - Do not wrap, reformat, escape, or otherwise touch a rendered cell's text.
//   A cell is the declaration's `text`, character for character (D-05); the
//   guard compares cells by exact string equality because of this.
// - Never run, spawn, or imply that this project runs a remedy command on
//   the user's behalf. Every rendered remedy stays a line the user types.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

/** One entry of a `remedies.<platform>` array: a single ecosystem's install
 * remedy, carried verbatim from the declaration. */
export interface RemedyEntry {
  ecosystem: string;
  text: string;
  provenance: string;
  source: string;
}

/** The four platform keys a declaration record's `remedies` may carry. Any
 * key may be absent -- a record with only a `universal` remedy carries no
 * `linux`/`darwin`/`win32` keys at all. */
export interface RemedyBlock {
  linux?: RemedyEntry[];
  darwin?: RemedyEntry[];
  win32?: RemedyEntry[];
  universal?: RemedyEntry[];
}

/** Where a declared tool's location can be overridden from. `envVar` is
 * absent for a tool with no environment-variable override (it still may be
 * file-overridable). */
export interface ToolLocationInfo {
  envVar?: string;
  fileOverridable: boolean;
  reason?: string;
}

/** One declared prerequisite record, keyed by its own `id` under `tools`. */
export interface ToolDeclarationRecord {
  id: string;
  location: ToolLocationInfo;
  kind: string;
  marker?: string;
  versionFloor?: string;
  unblocks: { skills: string[]; mcp: string[] };
  remedies: RemedyBlock;
}

/** The whole shape of `src/mcp/vice/prerequisites.json`. */
export interface ToolDeclaration {
  schemaVersion: number;
  tools: Record<string, ToolDeclarationRecord>;
}

/** One row of the generated VICE ecosystem table: a raw ecosystem id, the
 * platform labels it was seen under (deduped, in first-seen order), and the
 * install command carried character for character from the declaration. */
export interface EcosystemRow {
  ecosystem: string;
  platforms: string[];
  text: string;
}

/** One row of the generated prerequisite overview: a declared record's id,
 * what it unblocks (split into its two declared arrays so each cell carries
 * one kind of data), its one-line remedy, and how its location can be
 * overridden. */
export interface OverviewRow {
  id: string;
  skills: string[];
  mcp: string[];
  remedy: string;
  locationOverride: string;
}

/** The result of splicing a generated body into a marker-delimited region:
 * the (possibly unchanged) full text, whether it actually changed, and a
 * named failure when the markers could not be found unambiguously. Never
 * thrown -- a caller decides what to do with a non-empty `error`. */
export interface SpliceResult {
  text: string;
  changed: boolean;
  error?: string;
}

/** The result of regenerating every region this module owns: which region
 * names actually changed, and any named failures encountered along the way.
 * `readmePath` is written only when the combined text differs from what was
 * on disk. */
export interface WriteGeneratedRegionsResult {
  rewrote: string[];
  errors: string[];
}

/** The exact command every failure message and every generated banner
 * names -- the one line a developer runs after editing the declaration. */
export const REGENERATE_COMMAND = "npm --prefix src/mcp/vice run generate:readme";

/** Fixed, hardcoded translations of the schema's four platform keys into the
 * words a reader sees in a generated cell. This is NOT the ecosystem-label
 * map D-02/D-03 forbid: an ecosystem id (`fedora-rpmfusion`) names one of an
 * open, declaration-defined set and a label for it would encode knowledge
 * the declaration deliberately does not carry. A platform key is one of a
 * closed set of exactly four strings fixed by the JSON schema itself, and
 * translating `darwin` to `macOS` encodes nothing about any individual
 * declaration record. */
export const PLATFORM_LABELS: Readonly<Record<"linux" | "darwin" | "win32" | "universal", string>> = Object.freeze({
  linux: "linux",
  darwin: "macOS",
  win32: "Windows",
  universal: "any platform",
});

/** The fixed iteration order over a record's `remedies` block, mirroring
 * `remedyTextsFor()`'s own platform-then-universal discipline
 * (`tool-location.mts:953-972`). */
export const PLATFORM_ORDER: readonly ("linux" | "darwin" | "win32" | "universal")[] = [
  "linux",
  "darwin",
  "win32",
  "universal",
];

/** The three declaration records that ship in one VICE package and carry
 * identical remedy trees. The ecosystem table is derived from the first of
 * these; the guard proves all three agree. */
export const VICE_PACKAGE_TOOL_IDS: readonly string[] = ["x64sc", "c1541", "petcat"];

/** The generated VICE ecosystem table's header row, in column order. */
export const ECOSYSTEM_TABLE_COLUMNS: readonly string[] = ["Ecosystem", "Platforms", "Install command"];

/** The region name for the VICE ecosystem table -- one of the two regions
 * this module owns inside README.md. */
export const ECOSYSTEM_REGION = "vice-ecosystems";

/** The region name for the eight-record prerequisite overview -- the second
 * region this module owns inside README.md. */
export const OVERVIEW_REGION = "prerequisite-overview";

/** The generated prerequisite overview table's header row, in column order.
 * "What it unblocks" is split into its two declared arrays (skills, MCP
 * tools) so each cell carries one kind of data and the guard's comparison
 * stays total (D-11). */
export const OVERVIEW_TABLE_COLUMNS: readonly string[] = [
  "Prerequisite",
  "Unblocks (skills)",
  "Unblocks (MCP tools)",
  "Remedy",
  "Location override",
];

/** The overview's Remedy cell for a record with no `universal` remedy of its
 * own -- `x64sc`, `c1541` and `petcat`, whose remedies are ecosystem-specific
 * and already rendered once in the VICE ecosystem table. Deliberately not a
 * positional phrase naming a table "above" or "below": the cell must not go
 * false if README.md's sections are ever reordered. */
export const OVERVIEW_REMEDY_POINTER = "See the VICE per-package-manager table.";

/** The overview's "Unblocks" cell text for a record whose `unblocks.skills`
 * or `unblocks.mcp` array is empty. */
export const EMPTY_UNBLOCKS = "none";

/** The overview's Location override cell for a record with no `envVar` but
 * with `location.fileOverridable === true`. */
export const FILE_ONLY_OVERRIDE = ".c64-re-tools/tools.json";

/** The overview's Location override cell for a record with neither an
 * `envVar` nor `location.fileOverridable === true`. */
export const NO_LOCATION_OVERRIDE = "none";

/** Returns the literal HTML-comment marker pair that delimits a named
 * generated region inside README.md. */
export function regionMarkers(name: string): { start: string; end: string } {
  return {
    start: `<!-- prereq-gen:${name}:start -->`,
    end: `<!-- prereq-gen:${name}:end -->`,
  };
}

/** Reads and parses the declaration file at `declPath`. Takes the path as an
 * option (rather than resolving it internally) so a planted fixture tree can
 * be fed to the same code as the committed one (CLAUDE.md's Injection
 * convention). Throws only on a missing file or invalid JSON -- both are
 * caller-visible programmer errors, never a shape this module recovers
 * from silently. */
export function readDeclarationFile({ declPath }: { declPath: string }): ToolDeclaration {
  return JSON.parse(readFileSync(declPath, "utf8")) as ToolDeclaration;
}

/** Counts non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/** Derives the VICE ecosystem table's rows from the declaration's `toolId`
 * record (default: `VICE_PACKAGE_TOOL_IDS[0]`, i.e. `x64sc`). Walks
 * `remedies` in `PLATFORM_ORDER`; a `(ecosystem, text)` pair seen for the
 * first time appends a new row in encounter order, and a later occurrence of
 * the SAME pair appends its platform label to the existing row instead of
 * adding a second row (D-04) -- this is what collapses Homebrew's identical
 * `linux` and `darwin` entries into one row carrying `platforms: ["linux",
 * "macOS"]`. Pure function: no I/O, never throws (an unknown `toolId`
 * yields an empty array rather than a lookup error). */
export function deriveEcosystemRows(
  declaration: ToolDeclaration,
  { toolId = VICE_PACKAGE_TOOL_IDS[0]! }: { toolId?: string } = {},
): EcosystemRow[] {
  const record = declaration.tools[toolId];
  if (!record) return [];

  const rows: EcosystemRow[] = [];
  const index = new Map<string, EcosystemRow>();

  for (const platform of PLATFORM_ORDER) {
    const entries = record.remedies[platform] ?? [];
    const label = PLATFORM_LABELS[platform];
    for (const entry of entries) {
      const key = `${entry.ecosystem} ${entry.text}`;
      const existing = index.get(key);
      if (existing) {
        if (!existing.platforms.includes(label)) existing.platforms.push(label);
      } else {
        const row: EcosystemRow = { ecosystem: entry.ecosystem, platforms: [label], text: entry.text };
        index.set(key, row);
        rows.push(row);
      }
    }
  }

  return rows;
}

/** Renders `rows` as a markdown table whose header is `ECOSYSTEM_TABLE_COLUMNS`
 * and whose data rows carry the raw ecosystem id, the platform labels joined
 * with `", "`, and the install command reproduced character for character --
 * no backticks, no escaping, no wrapping of any kind (D-05). */
export function renderEcosystemTable(rows: EcosystemRow[]): string {
  const header = `| ${ECOSYSTEM_TABLE_COLUMNS.join(" | ")} |`;
  const separator = `| ${ECOSYSTEM_TABLE_COLUMNS.map(() => "---").join(" | ")} |`;
  const dataLines = rows.map((row) => `| ${row.ecosystem} | ${row.platforms.join(", ")} | ${row.text} |`);
  return [header, separator, ...dataLines].join("\n");
}

/** Derives the prerequisite overview's rows: one per entry of `tools`, in
 * the declaration's own key order. `skills` and `mcp` come from
 * `unblocks.skills` and `unblocks.mcp` verbatim; `remedy` is the first entry
 * of `remedies.universal` when that key exists and is non-empty, taken
 * character for character (D-05), and otherwise `OVERVIEW_REMEDY_POINTER`;
 * `locationOverride` is `location.envVar` when present, otherwise
 * `FILE_ONLY_OVERRIDE` when `location.fileOverridable` is exactly `true`,
 * otherwise `NO_LOCATION_OVERRIDE`. Pure function: no I/O, never throws. */
export function deriveOverviewRows(declaration: ToolDeclaration): OverviewRow[] {
  return Object.entries(declaration.tools).map(([id, record]) => {
    const universal = record.remedies.universal;
    const remedy = universal && universal.length > 0 ? universal[0]!.text : OVERVIEW_REMEDY_POINTER;
    const locationOverride = record.location.envVar
      ? record.location.envVar
      : record.location.fileOverridable === true
        ? FILE_ONLY_OVERRIDE
        : NO_LOCATION_OVERRIDE;
    return {
      id,
      skills: record.unblocks.skills,
      mcp: record.unblocks.mcp,
      remedy,
      locationOverride,
    };
  });
}

/** Renders `rows` as a markdown table whose header is `OVERVIEW_TABLE_COLUMNS`:
 * the raw id; the skills joined with `", "` or `EMPTY_UNBLOCKS` when empty;
 * the mcp ids joined the same way; the remedy exactly as derived; and the
 * location override exactly as derived. No backticks, no escaping, no
 * wrapping (D-05). */
export function renderOverviewTable(rows: OverviewRow[]): string {
  const header = `| ${OVERVIEW_TABLE_COLUMNS.join(" | ")} |`;
  const separator = `| ${OVERVIEW_TABLE_COLUMNS.map(() => "---").join(" | ")} |`;
  const dataLines = rows.map((row) => {
    const skillsCell = row.skills.length > 0 ? row.skills.join(", ") : EMPTY_UNBLOCKS;
    const mcpCell = row.mcp.length > 0 ? row.mcp.join(", ") : EMPTY_UNBLOCKS;
    return `| ${row.id} | ${skillsCell} | ${mcpCell} | ${row.remedy} | ${row.locationOverride} |`;
  });
  return [header, separator, ...dataLines].join("\n");
}

/** The comment inserted at the top of every generated region, naming the
 * exact command that reproduces it. The only place this text is produced --
 * a guard comparing regions never re-derives it. */
function generatedBannerComment(): string {
  return `<!-- Generated by \`${REGENERATE_COMMAND}\`. Edit src/mcp/vice/prerequisites.json and regenerate -- do not hand-edit this region. -->`;
}

/** Replaces everything strictly between the named region's start and end
 * markers with a generated banner comment naming `REGENERATE_COMMAND`, a
 * blank line, `body`, and a blank line. If either marker is missing, or
 * either appears more than once, returns the input unchanged and reports
 * the condition through `error` rather than throwing. */
export function spliceRegion(markdownText: string, regionName: string, body: string): SpliceResult {
  const { start, end } = regionMarkers(regionName);
  const startCount = countOccurrences(markdownText, start);
  const endCount = countOccurrences(markdownText, end);
  if (startCount !== 1 || endCount !== 1) {
    return {
      text: markdownText,
      changed: false,
      error: `region "${regionName}": expected exactly one start marker and one end marker, found ${startCount} start / ${endCount} end -- run \`${REGENERATE_COMMAND}\` after fixing the markers`,
    };
  }

  const startIdx = markdownText.indexOf(start);
  const endIdx = markdownText.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return {
      text: markdownText,
      changed: false,
      error: `region "${regionName}": markers not found in the expected start-then-end order`,
    };
  }

  const before = markdownText.slice(0, startIdx + start.length);
  const after = markdownText.slice(endIdx);
  const newText = `${before}\n${generatedBannerComment()}\n\n${body}\n\n${after}`;
  return { text: newText, changed: newText !== markdownText };
}

/** Reads the declaration and the README at the given paths, splices every
 * region this module owns, and writes `readmePath` only when the resulting
 * text actually differs from what was already on disk. Returns which region
 * names were rewritten (i.e. changed) and any named splice failures. Both
 * paths are options (not resolved internally) so a planted fixture tree can
 * be fed to the same code as the committed one. */
export function writeGeneratedRegions({
  declPath,
  readmePath,
}: {
  declPath: string;
  readmePath: string;
}): WriteGeneratedRegionsResult {
  const declaration = readDeclarationFile({ declPath });
  const originalText = readFileSync(readmePath, "utf8");
  let text = originalText;
  const rewrote: string[] = [];
  const errors: string[] = [];

  const ecosystemBody = renderEcosystemTable(deriveEcosystemRows(declaration));
  const ecosystemResult = spliceRegion(text, ECOSYSTEM_REGION, ecosystemBody);
  if (ecosystemResult.error) {
    errors.push(ecosystemResult.error);
  } else if (ecosystemResult.changed) {
    text = ecosystemResult.text;
    rewrote.push(ECOSYSTEM_REGION);
  }

  const overviewBody = renderOverviewTable(deriveOverviewRows(declaration));
  const overviewResult = spliceRegion(text, OVERVIEW_REGION, overviewBody);
  if (overviewResult.error) {
    errors.push(overviewResult.error);
  } else if (overviewResult.changed) {
    text = overviewResult.text;
    rewrote.push(OVERVIEW_REGION);
  }

  if (text !== originalText) {
    writeFileSync(readmePath, text, "utf8");
  }

  return { rewrote, errors };
}

/** The plain `.git`-marker walk, copied (not imported) from
 * `phase58-citation-ledger.test.ts` (itself mirrored from
 * `phase50-findings-contract.test.ts`). Deliberately NOT `repoRoot()` from
 * `repo-root.ts`: that function's first branch returns
 * `env.CLAUDE_PROJECT_DIR` whenever it is set, which under plugin semantics
 * names the CONSUMING project and under a worktree run names the primary
 * checkout -- neither is the tree this generator reads from and writes into
 * when run directly as `node prereq-readme-gen.ts --write` (61-RESEARCH.md
 * Open Question 3). */
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));

// CLI entry point, guarded on being the main module. `--write` resolves
// `declPath` as `prerequisites.json` beside this module and `readmePath` as
// `README.md` at the repository root, then writes any changed regions.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes("--write")) {
    const repoRoot = findRepoRoot(HERE);
    const declPath = join(HERE, "prerequisites.json");
    const readmePath = join(repoRoot, "README.md");
    const { rewrote, errors } = writeGeneratedRegions({ declPath, readmePath });
    for (const error of errors) {
      console.error(error);
    }
    if (errors.length > 0) {
      process.exitCode = 1;
    } else {
      console.log(
        rewrote.length > 0
          ? `Regenerated region(s): ${rewrote.join(", ")}`
          : "No changes -- README.md already matches prerequisites.json",
      );
    }
  } else {
    console.error("Usage: node prereq-readme-gen.ts --write");
    process.exitCode = 1;
  }
}
